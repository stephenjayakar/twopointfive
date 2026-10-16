// THE AIR FIELD — the wind as a small 2D FLUID over the whole level floor (shaders/air_field.wgsl), for the blown snow to ride. The maintainer on his GPU look at the
// snow level: the blown snow should 'feel like snow blowing around ... chaotic fluid dynamics, not just a single static pattern that lines up with the wind', and
// 'the nice thing of integrating with the fluid system is that you'll naturally get neat interactions where the wind hits a wall', 'like vortices past the edge of
// the door'. So: an incompressible-ish solve on a grid of AIR_RES cells a metre, walls / boxes / door leaves as solid cells, the ambient wind forced in wherever the
// sky is open, and what comes out is a texture of the air's velocity (and an upward LIFT) a cell that the grain particles sample.
// PICTURE ONLY: nothing in the simulation reads it, it takes no die and no wall clock (the caller hands it the game's clock), and it imports nothing from src/game.
// What lives here: the buffers, the one bind group every kernel shares, the numbers (AIR), the step's encoding (one compute pass, 4 + 2 × AIR.iterations small
// dispatches, ONE uniform write), the cell map's upload, the read-back for the test page (tools/qa/air-field-page.cjs) and a debug view.
//
// Three things about the model that are not in a textbook solver (the shader's head has the kernels):
//   THE RELAX   every open cell is pulled toward wind × its share over AIR.relaxTime. That is the wind coming over the wall tops; it is also what makes the field
//               forget (set the wind to 0 and it dies in a few relax times).
//   THE VENT    the pressure equation has a leak ∝ pressure (AIR.vent): air piling up on a wall goes UP and over, air sucked out of a lee is fed from above. Without
//               it 2D air has nowhere to go and a walled yard is dead still whatever the wind; with it a wall shelters AIR.relaxTime / AIR.vent's root in metres
//               (≈ 9 m at the numbers below for the last of it; in the pictures the calm is the first 3 or 4) and the solve is local. The vent's own upward speed is the LIFT channel.
//   THE CHAOS   a cubic advection that keeps small eddies, vorticity confinement that feeds them, and a boiling curl-noise push scaled by the local air speed, so
//               a wake sheds and wanders and no two seconds look alike. All three are gated by what drives the air (the wind, or a source): still air stays still.
//   SOURCES     besides the ambient wind, up to AIR_SRC_MAX local ones (setSources): a gust through an outside door, a wall vent, a ceiling diffuser spreading over
//               the floor. Indoors there may be no wind at all: the caps and gates then go by the strongest source. Under a roof the vent is AIR.roofVent (a
//               ceiling), so a room is nearly strict 2D: a draught in at its door curls and comes back out of it.
// NEVER SEEN ON A GPU: every number below was judged on Chromium's software adapter, from streak pictures of the read-back field (the test page writes them).
import { makeBuffer, makeShader, computePipelineAsync } from '../gpu/device';
import airSrc from './shaders/air_field.wgsl' with { type: 'text' };

export const AIR_RES = 5;                 // cells per metre (0.2 m cells)
/** local sources at most (setSources) */
export const AIR_SRC_MAX = 16;
/** the solver's numbers (authored data, live: read every step) */
export const AIR = {
  iterations: 10,     // red + black pressure sweeps a step (2 dispatches each)
  sor: 1.5,           // their over-relaxation (1 = plain Gauss–Seidel; under 2)
  relaxTime: 3,       // s over which open air is pulled to wind × share (longer = eddies live longer, walls shelter farther, gusts arrive later)
  roofRelaxTime: 2.5, // s: the same pull under a roof (toward still air: a room's own drag on a draught through its door, or on a vent's jet)
  vent: 0.04,         // s/m²: how readily pressure leaves upward (0 = strict 2D: a closed yard is airless; more = walls shelter less and eddies fade sooner)
  roofVent: 0.01,     // s/m²: the same under a roof (a ceiling: nearly none, so a draught in at a door comes back out of it; not 0, or a diffuser's air has nowhere to go)
  confine: 0.9,       // 1/s: vorticity confinement (what the advection's blur takes from an eddy, put back; too much = the field turns to grain-sized whirls) — only where the air moves (air_field.wgsl confineGate: none under a quarter of the drive)
  turb: 0.25,         // 1/s: the boiling curl-noise push, as a share of the local air speed a second
  turbSize: 1.7,      // m: the large boil's size (a second one at 0.45 × rides on it)
  turbRate: 0.45,     // 1/s: how fast the boil changes where it stands
  follow: 1,          // share 0‥1 of a CHANGE in the wind that open air takes at once (a gust is the air itself moving: without this the field hears of it a relax time late and at half strength)
  liftGain: 0.12,     // m/s of LIFT per m²/s² of pressure (the b channel)
  liftMax: 2.0,       // m/s: the lift's bound
  maxGain: 3.2,       // no face faster than this × what drives the air (the ambient wind, or the strongest source) …
  maxFloor: 0.6,      // … + this (m/s: what is left to die away once the wind has dropped)
  maxSpeed: 12,       // … and never faster than this, m/s
  seed: 1,            // the turbulence's lattice (another whole number = another weather)
  refSpeed: 1.5,      // m/s: air driven slower than this is solved AT this speed and slowed in time by as much (below) — 0 = every wind solved at its own speed
  scaleMin: 0.1,      // … and no slower in time than this × (a breath of wind still moves)
  scaleTime: 0.5,     // s over which that scale follows the drive (a gust rising, a door's draught ending)
};

const U_HEAD = 28, U_WORDS = U_HEAD + AIR_SRC_MAX * 8;   // air_field.wgsl AirU: 112 bytes, then the sources (2 × vec4f each)
const KERNELS = ['curl', 'advect', 'divergence', 'pressureRed', 'pressureBlack', 'project'] as const;

// rgba16float → floats, for the read-back
function halfToFloat(h: number): number {
  const s = (h & 0x8000) ? -1 : 1, e = (h >> 10) & 31, m = h & 1023;
  if (e === 0) return s * m * 2 ** -24;
  if (e === 31) return m ? NaN : s * Infinity;
  return s * (1 + m / 1024) * 2 ** (e - 15);
}

export class AirField {
  readonly w: number; readonly h: number;
  /** what the particles read: rgba16float, w × h, texel (i, j) = cell (i, j)'s CENTRE (world x = (i + ½) / AIR_RES): r, g = the air's velocity (m/s, world x and z),
   *  b = LIFT (m/s, upward), a = 1 in open air, 0 in a solid. The same view object for the instance's life. */
  readonly view: GPUTextureView;
  /** dispatches the last step() encoded (0 before the first) */
  dispatches = 0;
  /** the kernels are compiled (asynchronously, through gpu/device.ts computePipelineAsync like every other module's: counted on the start card, nothing ever
   *  waits on a compiler): until then step() encodes nothing — a caller that asks the timer for a slot checks this first */
  ready = false;
  /** resolves when `ready` turns true */
  readonly whenReady: Promise<void>;
  private readonly device: GPUDevice;
  private readonly out: GPUTexture; private readonly cellTex: GPUTexture;
  private readonly bufs: GPUBuffer[]; private readonly ubo: GPUBuffer;
  private pipes: Record<(typeof KERNELS)[number], GPUComputePipeline> | null = null;
  private readonly bind: GPUBindGroup;
  private readonly u = new ArrayBuffer(U_WORDS * 4); private readonly uf = new Float32Array(this.u); private readonly uu = new Uint32Array(this.u);
  private readonly gx: number; private readonly gy: number;
  private dead = false;
  private lastWind: [number, number] = [0, 0];
  private scale = -1; private clock = 0; private t0 = NaN;   // (the light-wind scale as last used · the solver's own clock, s · the caller's clock at the first step)
  private readonly src = new Float32Array(AIR_SRC_MAX * 8); private srcN = 0;

  constructor(device: GPUDevice, worldW: number, worldH: number) {
    this.device = device;
    const w = this.w = Math.max(1, Math.round(worldW * AIR_RES)), h = this.h = Math.max(1, Math.round(worldH * AIR_RES));
    const n = (w + 1) * (h + 1);   // (+ 1: the far rim's faces)
    this.gx = Math.ceil((w + 1) / 8); this.gy = Math.ceil((h + 1) / 8);
    const S = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST;
    const velA = makeBuffer(device, n * 8, S, 'air velA'), velB = makeBuffer(device, n * 8, S, 'air velB'), corner = makeBuffer(device, n * 8, S, 'air corner');
    const divg = makeBuffer(device, n * 16, S, 'air div'), pres = makeBuffer(device, n * 4, S, 'air pressure');
    this.bufs = [velA, velB, corner, divg, pres];
    this.ubo = makeBuffer(device, U_WORDS * 4, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, 'air uniforms');
    this.cellTex = device.createTexture({ label: 'air cells', size: [w, h], format: 'r8uint', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
    this.out = device.createTexture({ label: 'air field', size: [w, h], format: 'rgba16float', usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST });
    this.view = this.out.createView();
    // ONE layout for every kernel: each declares all eight bindings (a kernel that only reads a buffer still binds it read_write — within one dispatch a buffer is
    // bound once, so there is no clash), which is what lets the whole step run on one pre-made bind group set once.
    const C = GPUShaderStage.COMPUTE; const sb = (binding: number): GPUBindGroupLayoutEntry => ({ binding, visibility: C, buffer: { type: 'storage' } });
    const bgl = device.createBindGroupLayout({ label: 'air', entries: [
      { binding: 0, visibility: C, buffer: { type: 'uniform' } }, { binding: 1, visibility: C, texture: { sampleType: 'uint' } },
      sb(2), sb(3), sb(4), sb(5), sb(6), { binding: 7, visibility: C, storageTexture: { access: 'write-only', format: 'rgba16float' } }] });
    const layout = device.createPipelineLayout({ label: 'air', bindGroupLayouts: [bgl] }); const module = makeShader(device, airSrc, 'air_field');
    this.whenReady = Promise.all(KERNELS.map(k => computePipelineAsync(device, { label: `air ${k}`, layout, compute: { module, entryPoint: k } }))).then(list => {
      const pipes = {} as Record<(typeof KERNELS)[number], GPUComputePipeline>; KERNELS.forEach((k, i) => { pipes[k] = list[i]; });
      this.pipes = pipes; this.ready = true;
    });
    this.bind = device.createBindGroup({ label: 'air', layout: bgl, entries: [
      { binding: 0, resource: { buffer: this.ubo } }, { binding: 1, resource: this.cellTex.createView() },
      { binding: 2, resource: { buffer: velA } }, { binding: 3, resource: { buffer: velB } }, { binding: 4, resource: { buffer: corner } },
      { binding: 5, resource: { buffer: divg } }, { binding: 6, resource: { buffer: pres } }, { binding: 7, resource: this.view }] });
    // (a fresh texture is all zeros, which would read as a roof over everything: until setCells says otherwise the world is open and all of it forced)
    this.device.queue.writeTexture({ texture: this.cellTex }, new Uint8Array(w * h).fill(254), { bytesPerRow: w }, [w, h]);
    this.reset();
  }

  /** the obstacle / exposure map, one byte a cell, row-major (index j * w + i): 255 = SOLID; otherwise byte ÷ 254 = the share 0‥1 of the ambient wind forced there.
   *  rect [x0, z0, x1, z1] in cells, inclusive = only that part of `mask` (always the WHOLE map) is uploaded. A cell that turns solid loses its air on the next
   *  step; one that opens starts still. A thin thing at an angle (a door leaf) must be drawn 4-CONNECTED (each cell sharing an EDGE with the next): two solid cells
   *  that only touch at a corner let air through between them. */
  setCells(mask: Uint8Array, rect?: readonly [number, number, number, number]): void {
    const w = this.w, h = this.h; if (this.dead || mask.length < w * h) return;
    let x0 = 0, z0 = 0, x1 = w - 1, z1 = h - 1;
    if (rect) { x0 = Math.max(0, Math.floor(rect[0])); z0 = Math.max(0, Math.floor(rect[1])); x1 = Math.min(w - 1, Math.floor(rect[2])); z1 = Math.min(h - 1, Math.floor(rect[3])); if (x1 < x0 || z1 < z0) return; }
    this.device.queue.writeTexture({ texture: this.cellTex, origin: [x0, z0] }, mask, { offset: z0 * w + x0, bytesPerRow: w }, [x1 - x0 + 1, z1 - z0 + 1]);
  }

  /** LOCAL SOURCES, kept until the next call (n = 0 clears): n ≤ AIR_SRC_MAX records of 8 floats — [0] x, [1] z (world metres, the centre), [2] vx, [3] vz (m/s: the
   *  air velocity it drives at its centre: a gust through an open outside door, a wall vent), [4] radius (m: the Gaussian sigma of its footprint, cut at 2.5 sigma),
   *  [5] out (m/s: a RADIAL outflow peaking at one sigma: a ceiling diffuser's down-jet spreading over the floor; 0 = none), [6] rate (1/s: how hard the air is pulled
   *  to it at the centre), [7] spare. Open cells inside the footprint are relaxed toward v + radial × out × q × e^(½ − ½q²) (q = r / sigma) with weight
   *  e^(−q²) × (1 − e^(−rate · dt)); a radial source's own divergence is handed to the pressure solve, scaled by rate / (rate + 1 / AIR.roofRelaxTime) (how much of
   *  the pull survives the room's drag), so the projection keeps the outflow: at rate ≥ 2 the ring at one sigma holds over half of `out`. step() uploads them. */
  setSources(recs: Float32Array, n: number): void {
    n = Math.max(0, Math.min(AIR_SRC_MAX, Math.floor(n), Math.floor(recs.length / 8))); let k = 0;
    for (let i = 0; i < n; i++) { const o = i * 8; let ok = recs[o + 4] > 0 && recs[o + 6] > 0; for (let c = 0; c < 7 && ok; c++) ok = Number.isFinite(recs[o + c]);
      if (ok) { this.src.set(recs.subarray(o, o + 8), k * 8); k++; } }   // (a record with no footprint, no pull or a NaN in it is left out: nothing non-finite reaches the field)
    this.srcN = k;
  }

  /** one solver step, encoded on `enc` (one compute pass). wind = the ambient air velocity this frame (m/s, world x and z), gusts included; `time` = the caller's
   *  clock in seconds (the turbulence's evolution). dt ≤ 0 encodes nothing; dt is clamped to 1/30. ONE step per submitted encoder: the uniforms are a queue write. */
  step(enc: GPUCommandEncoder, dt: number, time: number, wind: readonly [number, number], ts?: GPUComputePassTimestampWrites): void {
    const P = this.pipes; if (this.dead || !P || !(dt > 0)) return;
    dt = Math.min(dt, 1 / 30);
    const A = AIR, f = this.uf, u = this.uu, wx = Number.isFinite(wind[0]) ? wind[0] : 0, wz = Number.isFinite(wind[1]) ? wind[1] : 0, len = Math.hypot(wx, wz);
    // what drives the air: the ambient wind, or indoors (no wind at all) the strongest source
    let drive = len; const S = this.src, n = this.srcN;
    for (let i = 0; i < n; i++) drive = Math.max(drive, Math.hypot(S[i * 8 + 2], S[i * 8 + 3]), Math.abs(S[i * 8 + 5]));
    // THE SAME AIR AT EVERY WIND. The pulls above are rates in real seconds (the relax, the boil, the vent), judged at a couple of m/s. Left alone, a light wind
    // (snow's is a third of a m/s at the ground) is all pull and no flow: a wall shelters one metre instead of nine, nothing sheds, the boil is the picture. So
    // air driven slower than AIR.refSpeed is solved as that speed's air — the wind and the sources ÷ k going in, the step × k long, the solver's clock × k — and
    // handed out × k (U.outScale): the same jets, lees and wakes in the same places, turning over as much slower as the wind is. k follows the drive over
    // AIR.scaleTime. At rest (nothing driving) the last k stands and the field dies away in real time, as it always did.
    let k = 1;
    if (A.refSpeed > 0) {
      if (drive > 1e-4) { const kT = Math.min(1, Math.max(A.scaleMin, drive / A.refSpeed)); this.scale = this.scale > 0 ? this.scale + (kT - this.scale) * (1 - Math.exp(-dt / Math.max(A.scaleTime, 1e-3))) : kT; }
      k = this.scale > 0 ? this.scale : 1;
    } else this.scale = -1;
    const kt = drive > 1e-4 ? k : 1; dt *= kt;
    const wxS = wx / k, wzS = wz / k, lenS = len / k, driveS = drive / k;
    if (!(this.t0 === this.t0)) this.t0 = time;
    const gate = Math.min(1, driveS);   // (confinement fades out under 1 m/s of drive: it feeds whatever spin there is, and still air must come to rest)
    f[0] = wxS; f[1] = wzS; f[2] = dt; f[3] = this.t0 + this.clock; this.clock += dt;
    u[4] = this.w; u[5] = this.h; u[6] = this.w + 1; f[7] = AIR_RES;
    f[8] = 1 - Math.exp(-dt / Math.max(A.relaxTime, 1e-3)); f[9] = 1 - Math.exp(-dt / Math.max(A.roofRelaxTime, 1e-3));
    f[10] = A.confine * dt * gate / AIR_RES; f[11] = A.turb * dt;
    f[12] = Math.max(A.turbSize, 2 / AIR_RES); f[13] = A.turbRate;
    f[14] = Math.max(0, A.vent) / (AIR_RES * AIR_RES * dt); f[15] = Math.min(1.95, Math.max(0.5, A.sor));
    f[16] = Math.max(0.05, Math.min(A.maxSpeed, A.maxGain * driveS + A.maxFloor)); f[17] = A.liftGain; f[18] = A.liftMax; f[19] = 1 / dt;
    f[20] = lenS; f[21] = A.seed; f[22] = (wxS - this.lastWind[0]) * A.follow; f[23] = (wzS - this.lastWind[1]) * A.follow;
    this.lastWind[0] = wxS; this.lastWind[1] = wzS;
    f[24] = driveS; u[25] = n; f[26] = Math.max(0, A.roofVent) / (AIR_RES * AIR_RES * dt); f[27] = k;
    const keep = 1 / Math.max(A.roofRelaxTime, 1e-3);
    for (let i = 0; i < n; i++) { const o = i * 8, q = U_HEAD + o, sig = Math.max(S[o + 4], 0.5 / AIR_RES), rate = S[o + 6];
      f[q] = S[o]; f[q + 1] = S[o + 1]; f[q + 2] = S[o + 2] / k; f[q + 3] = S[o + 3] / k; f[q + 4] = sig; f[q + 5] = S[o + 5] / k; f[q + 6] = 1 - Math.exp(-rate * dt); f[q + 7] = S[o + 5] / k / sig * rate / (rate + keep); }
    this.device.queue.writeBuffer(this.ubo, 0, this.u, 0, (U_HEAD + n * 8) * 4);
    const gx = this.gx, gy = this.gy, it = Math.max(1, Math.min(64, Math.round(A.iterations)));
    const pass = enc.beginComputePass({ label: 'air field', timestampWrites: ts }); pass.setBindGroup(0, this.bind);
    pass.setPipeline(P.curl); pass.dispatchWorkgroups(gx, gy);
    pass.setPipeline(P.advect); pass.dispatchWorkgroups(gx, gy);
    pass.setPipeline(P.divergence); pass.dispatchWorkgroups(gx, gy);
    for (let i = 0; i < it; i++) { pass.setPipeline(P.pressureRed); pass.dispatchWorkgroups(gx, gy); pass.setPipeline(P.pressureBlack); pass.dispatchWorkgroups(gx, gy); }
    pass.setPipeline(P.project); pass.dispatchWorkgroups(gx, gy);
    pass.end(); this.dispatches = 4 + 2 * it;
  }

  /** still air everywhere (a level restart). The cell map stays. */
  reset(): void {
    if (this.dead) return;
    this.scale = -1; this.clock = 0; this.t0 = NaN;
    this.lastWind[0] = this.lastWind[1] = 0;   // (the first step after this takes the whole wind as a change: the open field starts at the ambient, not from rest)
    const w = this.w, h = this.h, zero = new Float32Array((w + 1) * (h + 1) * 4);
    for (const b of this.bufs) this.device.queue.writeBuffer(b, 0, zero, 0, b.size / 4);
    // the texture until the first step: still air, a = 1 (half-float 1.0 = 0x3c00)
    const px = new Uint16Array(w * h * 4); for (let i = 3; i < px.length; i += 4) px[i] = 0x3c00;
    this.device.queue.writeTexture({ texture: this.out }, px, { bytesPerRow: w * 8 }, [w, h]);
  }

  destroy(): void {
    if (this.dead) return; this.dead = true;
    for (const b of this.bufs) b.destroy(); this.ubo.destroy(); this.cellTex.destroy(); this.out.destroy();
  }

  /** the current field (what `view` holds), read back: Float32Array of w * h * 4, texel (i, j) at (j * w + i) * 4. For the test page and a debug view: it maps a
   *  buffer (a frame or more late on a real GPU). */
  async readBack(): Promise<Float32Array> {
    const w = this.w, h = this.h, res = new Float32Array(w * h * 4); if (this.dead) return res;
    const row = Math.ceil(w * 8 / 256) * 256;
    const buf = this.device.createBuffer({ label: 'air read-back', size: row * h, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    const enc = this.device.createCommandEncoder(); enc.copyTextureToBuffer({ texture: this.out }, { buffer: buf, bytesPerRow: row }, [w, h]); this.device.queue.submit([enc.finish()]);
    await buf.mapAsync(GPUMapMode.READ);
    const src = new Uint16Array(buf.getMappedRange());
    for (let j = 0; j < h; j++) { const o = j * (row >> 1); for (let i = 0; i < w * 4; i++) res[j * w * 4 + i] = halfToFloat(src[o + i]); }
    buf.unmap(); buf.destroy(); return res;
  }
}
