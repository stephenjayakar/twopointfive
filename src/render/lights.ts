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
  /** set by whoever FLICKERS a fixture's `intensity` frame by frame (game/fire.ts): the strength a reader of the place's steady light takes it for (guards.ts
   *  lightEstimateAt, `steadyOnly`), where it hangs when its `pos` is made to wander and how big it is. Absent = `intensity` and `pos` are that. Nothing in the renderer reads it. */
  steady?: { intensity: number; pos: Vec3; /** … and its authored size: whoever flickers it may make the emitter as big as what burns (fire.ts FIRE.size) */ radius: number; /** … and its authored colour, when whoever flickers it also tints it (fire.ts FIRE.warm) */ color?: Vec3; /** … and its authored reach, when it also carries further (FIRE.reach) */ range?: number; /** … and that it has been out for a frame (fire.ts held) */ out?: boolean };
  /** a light its owner drives frame by frame (the weather's lightning stroke: game/weather.ts) that must still be treated as TRANSIENT by the renderer — the
   *  kind word's 256 bit: kept out of every accumulated signal (cascades, gather history), lit through the history-free direct pass only — without the ttl
   *  envelope above touching its intensity or retiring it. Counts toward numTransient like a ttl light. */
  transient?: boolean;
  /** wide, soft emitter (ceiling panels, screens, street lamps): its own denoise class in the direct pass. Explicit, not radius-derived. */
  broad?: boolean;
  /** an AREA light registered for an emissive MARKING (game.ts: the vending windows): the marked box's index << 2 | the marking's ordinal in its list. Rides in the
   *  kind word's bits 11‥24 with bit 10 set (common.wgsl lightMarkRef) so the reflection pass can texture this light's ANALYTIC highlight with the marking's own
   *  pattern at the mirror point (markings.wgsl markPatternAtMirror) — a uniform rectangle otherwise. undefined = not a marking's light. */
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
  /** THE FOG OF WAR'S LIGHT CLASS, SAID FOR THIS LIGHT (game/fogofwar.ts rule 4g: a lamp lit that the team last saw out; the kind word's bits 25 / 26,
   *  common.wgsl lightFogK): 1 = lights only what the team sees · 2 = lights only what it does not · undefined / 0 = whatever LightSet.fogClass makes of it
   *  (a carried light or a flash that is not the team's: 1 while the full picture is on; else a light like any other) */
  fog?: number;
  /** … a lamp that is OUT but that the team last saw lit: > 0 = uploaded at this intensity as a class-2 light (lit in the picture of the room nobody has looked
   *  into since), whatever `enabled` / `intensity` say. The game's own readers of the list never see it (they read enabled / intensity; probe.wgsl skips class 2) */
  fogGhost?: number;
  /** WHOSE DOING THIS LIGHT IS, FOR THE FOG'S CLASS ALONE (game/fogofwar.ts FOG.ours, lightBy): the character who set or threw what made it — a blast's
   *  flash, a round's ember. Not `owner`: the shadow rays still take every body, his too. Absent / 0 = the class goes by `owner` as ever */
  fogBy?: number;
}

/** the kind word's fog-of-war class bits (common.wgsl LIGHT_FOG_SEEN / LIGHT_FOG_UNSEEN; RtLight.fog) */
export const LIGHT_FOG_SEEN = 1 << 25, LIGHT_FOG_UNSEEN = 1 << 26;
/** the kind word's INFRARED bit (common.wgsl LIGHT_IR): a light only an image intensifier sees by — the goggles' illuminators (game/irlight.ts), kept in
 *  LightSet.ir and never in `lights`. The picture's passes take it like any light (it is uploaded only while the picture IS the tube's: LightSet.tube); the game's
 *  own readings — probe.wgsl's light meter through evalLightTrue, the cascades the meter reads its bounce from — never do. */
export const LIGHT_IR = 1 << 27;
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

/** ONE LIGHT'S GPU RECORD (common.wgsl struct Light, 16 words) into f / u — two views of one buffer — at word `o`: the one packing, for the scene's list
 *  (upload below) and for the lit fog's own list of lamps (game/fogofwar.ts litBlock → shaders/fogofwar.wgsl fowLights). `inten` scales the colour; `kindWord` is
 *  the kind with whatever flag bits the caller sets above its low byte, `ownerWord` the owner byte with the glass mask above it. */
export function packLight(f: Float32Array, u: Uint32Array, o: number, l: RtLight, inten: number, kindWord: number, volumetric: number, ownerWord: number) {
  f[o] = l.pos[0]; f[o + 1] = l.pos[1]; f[o + 2] = l.pos[2]; u[o + 3] = kindWord;
  f[o + 4] = l.dir[0]; f[o + 5] = l.dir[1]; f[o + 6] = l.dir[2]; f[o + 7] = l.range;
  f[o + 8] = l.color[0] * inten; f[o + 9] = l.color[1] * inten; f[o + 10] = l.color[2] * inten; f[o + 11] = Math.cos(l.outerDeg * DEG);
  f[o + 12] = Math.cos(Math.min(l.innerDeg, l.outerDeg - 0.5) * DEG); f[o + 13] = volumetric; u[o + 14] = ownerWord; f[o + 15] = l.radius;
}

/** the first n words of two buffers, bit for bit. Read signed and kept out of upload()'s body: mask words run past 2^31, and a loop over them inside that long function ran in a slow tier (0.03 ms a frame in the depot) */
function sameWords(a: Int32Array, b: Int32Array, n: number): boolean { for (let w = 0; w < n; w++) if (a[w] !== b[w]) return false; return true; }

export class LightSet {
  lights: RtLight[] = [];
  buf: GPUBuffer;
  /** per uploaded light slot, its reach mask row (reach.ts) — binding 12 of the scene group, a REACH_BYTES uniform block */
  reachBuf: GPUBuffer;
  private reachData = new Uint32Array(MAX_LIGHTS * REACH_ROW_WORDS);
  /** the reach buffer's rows as last written, word for word (upload writes the live rows only when they differ from this) */
  private reachSent = new Uint32Array(MAX_LIGHTS * REACH_ROW_WORDS).fill(0xffffffff);
  /** the reach rows are written whole next frame (a rollback snapshot put back: this book went back with the lights, the buffer did not — scene/boxes.ts forgetSent) */
  forgetSent() { this.reachSent.fill(0xffffffff); }
  private reachDataI = new Int32Array(this.reachData.buffer); private reachSentI = new Int32Array(this.reachSent.buffer);   // the same words read signed, for the compare alone (sameWords)
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
  /** THE INFRARED LIGHTS (LIGHT_IR; game/irlight.ts poses them every frame): a list of their own, so that no reader of `lights` — the CPU's light estimates, the
   *  fog of war's classes, the reach masks, a digest — can ever count one. Uploaded after `lights`, flagged infrared, and only while `tube` is up; enabled / intensity are read
   *  as for any light. In a tube frame it is a STEADY light like a carried torch (reservoirs, bounce, reflections: NOT a transient — a flood that burns for
   *  minutes on the flash's history-free path cost the gather a shadow ray per flood per hit, every frame); what a bare-eyed frame must not inherit is dropped
   *  wholesale the frame the tube comes off (engine.render: passes.restartHistories). */
  ir: RtLight[] = [];
  /** the picture this upload is for is the intensifier tube's (engine.render: settings.nvAmount past post.wgsl's swap) — the only picture an infrared light is in */
  tube = false;
  /** infrared lights in the last upload */
  irCount = 0;
  /** the most infrared lights an upload takes, in the list's order (the game files the player's first). Infinity = all of them: the picture as it is. The F8 sweep
   *  writes 0 and 1 for a row's window, to price them (ui/perfsweep.ts 'irLight' / 'irLightOne'). The PICTURE's alone: `ir`, the list the game reads, is untouched */
  irCap = Infinity;
  /** an infrared light has been uploaded since the picture last became the tube's (the engine asks when the tube comes off, and clears it) */
  irSpell = false;

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

  /** THE FOG OF WAR'S FULL PICTURE (game/fogofwar.ts rule 4g keeps this; `on` false = no light gets a class of its own accord): the team's own lights and the
   *  ids of its men. Asked at the UPLOAD — not written on the lights by the game's update — so that a flash born later in the same frame (a tracer's ember, a
   *  blast's afterglow: made after the fog's turn) is classed on its first and brightest frame. */
  fogTeam = { on: false, owners: new Set<number>(), lights: new Set<RtLight>() };
  /** the class `l` is uploaded with: what was said for it (RtLight.fog), else 1 — 'lights only what the team sees' — for every light a man carries who is
   *  not on the team and every flash and timed light that is not a teammate's own; never the sky's (the sun, the moon, the lightning) */
  fogClass(l: RtLight): number {
    if (l.fog) return l.fog;
    const T = this.fogTeam;
    const by = l.fogBy || l.owner;   // (a flash somebody made without carrying it is classed as his: RtLight.fogBy)
    return T.on && l.kind !== 2 && !T.lights.has(l) && (by !== 0 ? !T.owners.has(by) : l.ttl >= 0 || !!l.transient) ? 1 : 0;
  }
  /** the lowest slot of the last upload holding a TRANSIENT light (ttl / flagged), = the slot count when none: transients are appended as they are born, so they sit at the tail and the
   *  gather's per-hit subtraction walk (gather_common directAtPoint / directOnScreen) can start here — it still tests every slot it visits, so a steady light after it costs nothing but a skip */
  firstTransientSlot = 0;
  upload(time: number) {
    const f = this.f32, u = this.u32; let n = 0; this.activeIdx.length = 0; let firstT = -1;
    { const words = Math.max(1, this.activeCount) * 16, p32 = this.prev32; for (let i = 0; i < words; i++) p32[i] = u[i]; } this.prevCount = this.activeCount;   // last frame's records (prevCount × 64 B, word for word), before they are overwritten in place — no per-frame view (review R1.4)
    this.slotFwd.fill(255); this.slotInv.fill(255);
    const NL = this.lights.length, NI = this.tube ? this.ir.length : 0; this.irCount = 0;
    if (!NI) for (let i = 0; i < this.ir.length; i++) this.ir[i].slot = -1;
    for (let i = 0; i < NL + NI; i++) {
      const ir = i >= NL, l = ir ? this.ir[i - NL] : this.lights[i]; const prevSlot = l.slot ?? -1; l.slot = -1;   // (the infrared ones last, past the transients at `lights`' tail: the gather's walk from the first transient's slot tests each slot it visits and skips them)
      const ghost = (!l.enabled || l.intensity <= 0) && (l.fogGhost ?? 0) > 0;   // out, but lit in the fog's picture (RtLight.fogGhost)
      if (n >= MAX_LIGHTS || (ir && this.irCount >= this.irCap) || ((!l.enabled || l.intensity <= 0) && !ghost)) continue;   // (a lamp over the cap has lost its slot just above, as one out of the list has)
      if (prevSlot >= 0 && prevSlot < this.prevCount) { this.slotFwd[prevSlot] = n; this.slotInv[n] = prevSlot; }   // the same RtLight object, last frame's slot → this frame's
      let inten = ghost ? l.fogGhost! : l.intensity;
      if (l.flicker > 0) {
        const s = Math.sin(time * 61 + i * 3.1) * Math.sin(time * 17.3 + i) + Math.sin(time * 7.1 + i * 0.7) * 0.5;
        inten *= 1 - l.flicker * (s > 0.55 ? 0.85 : s > 0.3 ? 0.3 : 0.0);
      }
      const o = n * 16;
      // kind low byte + flags: 256 = transient (ttl light: excluded from accumulated signals), 512 = broad emitter class (wide penumbrae → its own denoise)
      const fc = ir ? 0 : ghost ? 2 : this.fogClass(l);
      packLight(f, u, o, l, inten, l.kind | (ir ? LIGHT_IR : 0) | (l.ttl >= 0 || l.transient ? 256 : 0) | (l.broad ? 512 : 0) | (l.markRef !== undefined && l.markRef >= 0 && l.markRef < 16384 ? 1024 | (l.markRef << 11) : 0) | (fc === 1 ? LIGHT_FOG_SEEN : fc === 2 ? LIGHT_FOG_UNSEEN : 0),   // + bit 10 / bits 11‥24: the emissive marking this light stands for (RtLight.markRef)
        l.volumetric, ((l.owner & 0xff) | (((l.glassMask ?? 0) & 0xffffff) << 8)) >>> 0);   // owner byte + the glass pane mask above it (common.wgsl lightGlassMask)
      this.reachData.set((this.dirMasks && l.reachDir) ? l.reachDir : (l.reach ?? REACH_ALL), n * REACH_ROW_WORDS);   // the slot's reach row follows the light into whatever slot it lands in this frame (a directional light's own mask only under dirMasks)
      this.activeIdx.push(i); l.slot = n; if (firstT < 0 && !ir && (l.ttl >= 0 || l.transient)) firstT = n; if (ir) { this.irCount++; this.irSpell = true; } n++;   // (activeIdx: an index past `lights` is into `ir`)
    }
    this.activeCount = n; this.firstTransientSlot = firstT < 0 ? n : firstT;
    this.device.queue.writeBuffer(this.buf, 0, this.data, 0, Math.max(64, n * 64));
    { const now = this.reachData, sent = this.reachSent, words = n * REACH_ROW_WORDS; const same = sameWords(this.reachDataI, this.reachSentI, words);   // the live slots' rows, only when they are not what the buffer already holds (a light's reach changes when it moves a cell or a door swings; most frames nothing does)
      if (!same) { this.device.queue.writeBuffer(this.reachBuf, 0, now.buffer, 0, words * 4); sent.set(now.subarray(0, words)); } }   // (whole rows of the live slots — a multiple of 4 bytes, all writeBuffer asks; rows past n are never read: the shaders stop at frame.numLights)
    return n;
  }
}
