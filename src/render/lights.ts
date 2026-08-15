// Runtime analytic light list → GPU buffer (struct Light in common.wgsl, 64 B each).
import { Vec3, v3, DEG } from '../math/vec';
import { makeBuffer } from '../gpu/device';
import { LightDef } from '../scene/level';
import { REACH_ROW_WORDS, REACH_ALL } from './reach';

export interface RtLight {
  name: string; group: string;
  kind: 0 | 1 | 2 | 3;        // point, spot, directional, area (one-sided disk: dir = normal, radius = disk radius)
  pos: Vec3; dir: Vec3;
  color: Vec3; intensity: number;
  range: number; innerDeg: number; outerDeg: number;
  radius: number;             // physical size (m): clamps 1/d^2 and shortens shadow rays
  volumetric: number;
  owner: number;              // character id whose proxies don't shadow this light (e.g. the guard holding it)
  enabled: boolean;
  fixtureBox: number;         // emissive glow-card box index or -1
  flicker: number;            // 0 = steady; >0 = flicker amount (runtime modulation)
  /** transient lights (muzzle flashes) expire when ttl hits 0 */
  ttl: number; age: number; peakIntensity: number;
  /** a light its owner drives frame by frame (the weather's lightning stroke: game/weather.ts) that must still be treated as TRANSIENT by the renderer — the
   *  kind word's 256 bit: kept out of every accumulated signal (cascades, gather history), lit through the history-free direct pass only — without the ttl
   *  envelope above touching its intensity or retiring it. Counts toward numTransient like a ttl light. */
  transient?: boolean;
  /** wide, soft emitter (ceiling panels, screens, street lamps): its own denoise class in the direct pass. Explicit, not radius-derived. */
  broad?: boolean;
  /** an AREA light registered for an emissive MARKING (game.ts: the vending windows): the marked box's index << 2 | the marking's ordinal in its list. Rides in the
   *  kind word's bits 11‥24 with bit 10 set (common.wgsl lightMarkRef) so the reflection pass can texture this light's ANALYTIC highlight with the marking's own
   *  pattern at the mirror point (markings.wgsl markPatternRatio) — a uniform rectangle otherwise. undefined = not a marking's light. */
  markRef?: number;
  /** which 1 m cells of the level this light can possibly reach (reach.ts; REACH_ROW_WORDS u32, bit ci = cell cz*gridW+cx) — undefined = anywhere */
  reach?: Uint32Array;
  /** DIRECTIONAL lights only (the moon, the breach's sun): the cells with any unblocked path toward it (reach.ts reachMaskForDirectional) — consulted INSTEAD of `reach`
   *  while LightSet.dirMasks is on (the ReSTIR estimator; the leader / tail path keeps the all-ones row it always had, bit for bit) */
  reachDir?: Uint32Array;
  /** a hand-held / carried spot (the guards' torches and weapon lights, Sam's rail light): under settings.torchBounceCards its footprint on the surface it hits
   *  becomes an analytic one-bounce emitter for the final gather (render/shaders/cards.wgsl) instead of a hotspot the gather's rays must find */
  card?: boolean;
  /** the GPU slot this light was uploaded to last frame (index into `lights` in the shaders), −1 when it was not (disabled / zero intensity / over MAX_LIGHTS) */
  slot?: number;
  /** GLASS experiment: bits of the panes listed to the GPU this frame (world.glassList order) this light can possibly shine through — set by engine.ts
   *  glassLightMasks before upload(), packed above the owner byte (24 panes); undefined / 0 = none */
  glassMask?: number;
}

export const MAX_LIGHTS = 64;
if (MAX_LIGHTS > 64) throw new Error('lights: MAX_LIGHTS > 64 — volumetrics.wgsl keeps its per-ray beam selection in a 64-bit mask (selLo/selHi); widen it first');   // (a WGSL shift by k ≥ 32 wraps: light 70 would alias light 38)
/** The per-light reach rows (reach.ts) ride in ONE uniform binding (scene group binding 12, `array<vec4u, REACH_VEC4S>` in common.wgsl — a uniform,
 *  not a seventh scene storage buffer, so every pipeline stays inside the WebGPU default of 8 storage buffers per stage): MAX_LIGHTS rows ×
 *  REACH_ROW_WORDS u32. That caps the block at maxUniformBufferBindingSize's default (64 KB) and needs a 16-byte multiple (vec4u stride) —
 *  64 × 70 × 4 = 17920 B today; the LightSet constructor refuses anything else so a grid resize / MAX_LIGHTS bump cannot silently break it. */
export const REACH_BYTES = MAX_LIGHTS * REACH_ROW_WORDS * 4;
/** vec4u elements of that uniform array (frame.ts injects it into the scene prelude as REACH_VEC4S) */
export const REACH_VEC4S = REACH_BYTES / 16;

/** Torch bounce cards: the light SLOTS (this frame's upload) whose footprint cards.wgsl should build — every uploaded, steady, spot-kind `card` light,
 *  the `max` nearest `target` (the view's look-at point on the floor) first if there are more. Pure; engine.render calls it after upload(). */
export function cardSlotsFor(lights: RtLight[], target: Vec3, max: number): number[] {
  const cands: { slot: number; d2: number }[] = [];
  for (const l of lights) if (l.card && l.kind === 1 && l.ttl < 0 && (l.slot ?? -1) >= 0) { const dx = l.pos[0] - target[0], dz = l.pos[2] - target[2]; cands.push({ slot: l.slot!, d2: dx * dx + dz * dz }); }
  if (cands.length > max) cands.sort((a, b) => a.d2 - b.d2);
  return cands.slice(0, max).map(c => c.slot);
}

export function lightFromDef(d: LightDef): RtLight {
  return {
    name: d.name, group: d.group, kind: d.kind === 'point' ? 0 : d.kind === 'spot' ? 1 : 2,
    pos: v3.copy(d.pos), dir: v3.normalize(d.dir), color: v3.copy(d.color), intensity: d.intensity,
    range: d.range, innerDeg: d.innerDeg, outerDeg: d.outerDeg, radius: d.kind === 'dir' ? (d.radius ?? 0) : (d.radius ?? 0.05),
    volumetric: d.volumetric, owner: 0, enabled: d.enabled, fixtureBox: d.fixtureBox ?? -1, flicker: 0, ttl: -1, age: 0, peakIntensity: d.intensity, broad: !!d.broad,
  };
}

export class LightSet {
  lights: RtLight[] = [];
  buf: GPUBuffer;
  /** per uploaded light slot, its reach mask row (reach.ts) — binding 12 of the scene group, a REACH_BYTES uniform block */
  reachBuf: GPUBuffer;
  private reachData = new Uint32Array(MAX_LIGHTS * REACH_ROW_WORDS);
  private data = new ArrayBuffer(MAX_LIGHTS * 64);
  private f32 = new Float32Array(this.data); private u32 = new Uint32Array(this.data);
  /** number of lights uploaded last frame (enabled only) */
  activeCount = 0;
  /** indices (into `lights`) of the uploaded lights, in GPU order */
  activeIdx: number[] = [];
  /** LIGHT IDENTITY ACROSS FRAMES (ReSTIR DI, render/shaders/restir.wgsl): the slot order is just array order minus disabled / dark lights, so a torch switching
   *  off or a muzzle flash expiring renumbers everything after it. Each upload therefore also keeps the PREVIOUS upload's records (`prevData`, prevCount × 64 B:
   *  the lights as they were — the estimator's 'target last frame') and two byte maps by object identity: `slotFwd[p]` = the slot this frame of the light that
   *  was in slot p last frame (255 = not uploaded now), `slotInv[s]` = last frame's slot of the light now in slot s (255 = new this frame). */
  prevData = new Uint8Array(MAX_LIGHTS * 64); prevCount = 0; private prev32 = new Uint32Array(this.prevData.buffer);
  slotFwd = new Uint8Array(MAX_LIGHTS).fill(255); slotInv = new Uint8Array(MAX_LIGHTS).fill(255);
  /** use RtLight.reachDir for directional lights that carry one (engine.render sets it from settings.restir before upload; off = every row exactly as before) */
  dirMasks = false;

  constructor(private device: GPUDevice) {
    this.buf = makeBuffer(device, MAX_LIGHTS * 64, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST, 'lights');
    if (REACH_BYTES > 65536 || REACH_BYTES % 16 !== 0) throw new Error(`lightReach uniform block: MAX_LIGHTS ${MAX_LIGHTS} × REACH_ROW_WORDS ${REACH_ROW_WORDS} × 4 = ${REACH_BYTES} bytes — it must stay ≤ 65536 (the default maxUniformBufferBindingSize) and a multiple of 16 (array<vec4u> stride); shrink the reach grid (scene/world.ts gridW·gridH → render/reach.ts) or MAX_LIGHTS (render/lights.ts)`);
    this.reachBuf = makeBuffer(device, REACH_BYTES, GPUBufferUsage.UNIFORM | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST, 'lightReach');   // (bindable either way: frame.ts reachBinding picks the layout)
    this.reachData.fill(0xffffffff); device.queue.writeBuffer(this.reachBuf, 0, this.reachData);
  }

  add(l: RtLight): RtLight { this.lights.push(l); return l; }
  remove(l: RtLight) { const i = this.lights.indexOf(l); if (i >= 0) this.lights.splice(i, 1); }

  /** Spawn a short-lived point light (muzzle flash). */
  flash(pos: Vec3, color: Vec3, intensity: number, range: number, ttl: number, owner: number): RtLight {
    return this.add({ name: 'flash', group: 'transient', kind: 0, pos: v3.copy(pos), dir: [0, -1, 0], color, intensity, range, innerDeg: 0, outerDeg: 180, radius: 0.08, volumetric: 1.0, owner, enabled: true, fixtureBox: -1, flicker: 0, ttl, age: 0, peakIntensity: intensity });
  }

  update(dt: number, time: number) {
    for (let i = this.lights.length - 1; i >= 0; i--) {
      const l = this.lights[i];
      if (l.ttl >= 0) {
        // a flash shorter than a frame must still deliver its energy: intensity for THIS frame = the (1-x)^2.2 envelope averaged
        // over [age, age+dt] (F = its antiderivative), evaluated BEFORE advancing age; retired only once a frame has shown it
        if (l.age >= l.ttl) { this.lights.splice(i, 1); continue; }
        const x0 = l.age / l.ttl, x1 = Math.min(1, (l.age + Math.max(dt, 1e-4)) / l.ttl);
        const F = (x: number) => -Math.pow(1 - x, 3.2) / 3.2;
        l.intensity = l.peakIntensity * (F(x1) - F(x0)) / Math.max(x1 - x0, 1e-6);
        l.age += dt;
      }
    }
    void time;
  }

  /** the lowest slot of the last upload holding a TRANSIENT light (ttl / flagged), = the slot count when none: transients are appended as they are born, so they sit at the tail and the
   *  gather's per-hit subtraction walk (gather_common directAtPoint / directOnScreen) can start here — it still tests every slot it visits, so a steady light after it costs nothing but a skip */
  firstTransientSlot = 0;
  upload(time: number) {
    const f = this.f32, u = this.u32; let n = 0; this.activeIdx.length = 0; let firstT = -1;
    { const words = Math.max(1, this.activeCount) * 16, p32 = this.prev32; for (let i = 0; i < words; i++) p32[i] = u[i]; } this.prevCount = this.activeCount;   // last frame's records (prevCount × 64 B, word for word), before they are overwritten in place — no per-frame view (review R1.4)
    this.slotFwd.fill(255); this.slotInv.fill(255);
    for (let i = 0; i < this.lights.length; i++) {
      const l = this.lights[i]; const prevSlot = l.slot ?? -1; l.slot = -1;
      if (n >= MAX_LIGHTS || !l.enabled || l.intensity <= 0) continue;
      if (prevSlot >= 0 && prevSlot < this.prevCount) { this.slotFwd[prevSlot] = n; this.slotInv[n] = prevSlot; }   // the same RtLight object, last frame's slot → this frame's
      let inten = l.intensity;
      if (l.flicker > 0) {
        const s = Math.sin(time * 61 + i * 3.1) * Math.sin(time * 17.3 + i) + Math.sin(time * 7.1 + i * 0.7) * 0.5;
        inten *= 1 - l.flicker * (s > 0.55 ? 0.85 : s > 0.3 ? 0.3 : 0.0);
      }
      const o = n * 16;
      // kind low byte + flags: 256 = transient (ttl light: excluded from accumulated signals), 512 = broad emitter class (wide penumbrae → its own denoise)
      f[o] = l.pos[0]; f[o + 1] = l.pos[1]; f[o + 2] = l.pos[2]; u[o + 3] = l.kind | (l.ttl >= 0 || l.transient ? 256 : 0) | (l.broad ? 512 : 0) | (l.markRef !== undefined && l.markRef >= 0 && l.markRef < 16384 ? 1024 | (l.markRef << 11) : 0);   // + bit 10 / bits 11‥24: the emissive marking this light stands for (RtLight.markRef)
      f[o + 4] = l.dir[0]; f[o + 5] = l.dir[1]; f[o + 6] = l.dir[2]; f[o + 7] = l.range;
      f[o + 8] = l.color[0] * inten; f[o + 9] = l.color[1] * inten; f[o + 10] = l.color[2] * inten; f[o + 11] = Math.cos(l.outerDeg * DEG);
      f[o + 12] = Math.cos(Math.min(l.innerDeg, l.outerDeg - 0.5) * DEG); f[o + 13] = l.volumetric; u[o + 14] = ((l.owner & 0xff) | (((l.glassMask ?? 0) & 0xffffff) << 8)) >>> 0; f[o + 15] = l.radius;   // owner byte + the glass pane mask above it (common.wgsl lightGlassMask)
      this.reachData.set((this.dirMasks && l.reachDir) ? l.reachDir : (l.reach ?? REACH_ALL), n * REACH_ROW_WORDS);   // the slot's reach row follows the light into whatever slot it lands in this frame (a directional light's own mask only under dirMasks)
      this.activeIdx.push(i); l.slot = n; if (firstT < 0 && (l.ttl >= 0 || l.transient)) firstT = n; n++;
    }
    this.activeCount = n; this.firstTransientSlot = firstT < 0 ? n : firstT;
    this.device.queue.writeBuffer(this.buf, 0, this.data, 0, Math.max(64, n * 64));
    this.device.queue.writeBuffer(this.reachBuf, 0, this.reachData.buffer, 0, Math.max(1, n) * REACH_ROW_WORDS * 4);   // whole rows of the live slots (a multiple of 4 bytes, all writeBuffer asks; rows past n are never read: the shaders stop at frame.numLights)
    return n;
  }
}
