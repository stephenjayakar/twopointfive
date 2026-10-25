// FOG OF WAR — the renderer's half (game/fogofwar.ts has the rule and fills the FogFrame; shaders/fogofwar.wgsl is the kernel): one compute pass over the
// composite, in place, that pushes down every pixel whose surface none of the team's eyes can see in plan. Everything of it lives here: the pipeline (compiled
// the first frame the switch is on, asynchronously — the pass simply does not run until it is ready), its 288-B uniform (+ the lit fog's 3 KB of lamps), its copy of hdr (made at the
// composite's size on first use, re-made when that changes, let go when the switch goes off). passes.ts gives hdr the two usages the pass needs while the
// switch is on (setFog → STORAGE_BINDING + COPY_SRC, as GBAA has it) and calls encode() between GBAA and the resolve. Switch off = none of this exists and
// nothing is dispatched: the frame as it was.
// TWO PROGRAMS, ONE PICTURE (FogFrame.pass; the shader's head has the argument): 'hint' (as shipped) walks FOG_BINS level rays round each eye first and lets a pixel
// ask the one box its bearing's ray met before it walks the grid itself — a pixel nobody sees costs a box test or two an eye where it cost a walk an eye; 'old'
// (`?fogpass=old`, or `__fow.frame.pass = 'old'` live) is the kernel as it always was, token for token but for the soft edge's one call (fowEdge: 1 while FOG.edge is 0 or no sight table is written). While the program asked for is still compiling the other
// one draws the frame — the picture is the same — so a flip never leaves a frame without its fog.
import { cutSwap, ProgramSet, type CutSwappable } from './cutSwap';
import { makeShader } from '../gpu/device';
import { scenePrelude } from './frame';
import fogSrc from './shaders/fogofwar.wgsl' with { type: 'text' };
import sightSrc from './shaders/fogsight.wgsl' with { type: 'text' };

/** eyes the pass has ROOM for (the team: Sam + four — the four-man squad — and two more: a sticky camera's feed, a tutorial's lookout; the pair fills three
 *  and the kernel walks only the live ones). How many the game USES is game/fogofwar.ts FOG.eyes (5 until 10-24). The arrays in shaders/fogofwar.wgsl,
 *  fogsight.wgsl and common.wgsl FogSightT carry this number as a literal (and FogSightT.dist FOG_BINS × this / 4): change them together. 7 is the most
 *  the sight table holds: FOG_BINS × 8 × 4 B is the whole 64 KB a uniform block may be. */
export const FOG_EYES = 7;
/** bearing bins round an eye in the hint table (one texel a bin, one row an eye). shaders/fogofwar.wgsl FOW_BINS carries this number as a literal: change both together. */
export const FOG_BINS = 2048;
/** lamps the lit fog takes (FogFrame.lights; 64 B each, the scene's own Light record). shaders/fogofwar.wgsl FOW_LIGHTS and its array carry this number as a literal: change both together. */
export const FOG_LIGHTS = 48;
/** which program draws the fog: 'hint' = the table first, a grid walk only where the table has no answer · 'old' = a grid walk per eye per pixel, as it always was. Same picture. */
export type FogPassMode = 'hint' | 'old';
/** `?fogpass=old` (or =hint) for a visit; no page — the harness — 'hint' */
function fogPassFlag(): FogPassMode { try { const v = new URLSearchParams(location.search).get('fogpass'); if (v === 'old') return 'old'; } catch { /* no page */ } return 'hint'; }
/** What the game hands the pass each frame (one object, written in place by game/fogofwar.ts update): `on` false = no pass. */
export interface FogFrame {
  on: boolean;
  /** live eyes, ≤ FOG_EYES */
  count: number;
  /** per eye: x y z of the eye, then his character id (0 = none) */
  eyes: Float32Array;
  /** per eye: where it looks in plan (x, z; unit), the cosine of its half field (≤ −1.5 = all round), its all-round near field (m) */
  looks: Float32Array;
  dim: number; desat: number; topPad: number;
  /** THE SOFT EDGE (game/fogofwar.ts FOG.edge): the band, in metres, the fog comes in over across a sight edge, half on each side — 0 = the hard line as it
   *  was. Read from the sight table's head by the fog pass alone (shaders/fogofwar.wgsl fowEdge), so it softens only the full picture's fog */
  edge: number;
  /** the wedge's soft edge in the picture: the cosines of the half field less / plus half the soft band (softIn > softOut; both 0 = a hard line at the looks'
   *  own cosine), and the metres over which the near field's rim comes in (0 = a hard rim) — game/fogofwar.ts FOG.coneSoftDeg / coneNearSoftM */
  softIn: number; softOut: number; nearSoft: number;
  /** THE FOG'S OWN LIGHT (game/fogofwar.ts FOG.flat): > 0 = a pixel nobody sees is the surface's paint under one fixed light at this displayed level — nothing
   *  of the live frame; 0 = the live frame dimmed, as it was */
  flat: number;
  /** THE FOG LIT AS THE TEAM LAST KNEW IT (game/fogofwar.ts FOG.lit; read only while `flat` > 0): `lit` > 0 = a pixel nobody sees is its paint under
   *  `lightCount` lamps of `lights` (the level's own, each in the state the team last saw it in, + the sun or moon — the scene's Light record, 16 words a
   *  lamp: lights.ts packLight; `lightsU` = the same words as integers), each × `lit` × `dim` and traced against the boxes as handed to the picture, + a fill
   *  at `litFill` as displayed that `litAo` of is shut out within `litAoM` metres of a box; a lamp under `litCut` as displayed at a pixel is not traced.
   *  0 = the one fixed light at `flat`, as it was */
  lit: number; litFill: number; litCut: number; litAo: number; litAoM: number; lightCount: number; lights: Float32Array; lightsU: Uint32Array;
  /** THE FULL PICTURE UNDER THE FOG (game/fogofwar.ts FOG.full, rule 4g): true = a pixel nobody sees is the live frame dimmed again — and what must not show
   *  there is taken out where it is made (the lights' fog classes, lights.ts RtLight.fog, asked of the sight table FogSight writes at the head of the frame).
   *  `fullFlat` is then a fill ADDED to the dimmed frame (0 = none), shaped by `litAo` / `litAoM`; `lit`'s lamps are not read. false = `flat` / `lit` as they
   *  were — which the game fills all the same, and which the pass draws for as long as `sight` is false */
  full: boolean; fullFlat: number;
  /** THE AIR IS THE PLACE (game/fogofwar.ts FOG.air; under the full picture alone — it rides the sight table's head): true = the picture's march draws smoke and
   *  dust over floor the team does not see too (the fog pass then dims it with the ground under it); false = no plume there, as it was */
  air: boolean;
  /** THIN THINGS THAT STAND FREE DO NOT CUT THE SIGHT (game/fogofwar.ts FOG.thin; under the full picture alone — it rides the sight table): the picture's
   *  fog eye passes the statics whose bit is set in `thinBits` (bit i = box i; 4096 boxes), and what a man carries. false = every box stops it, as it was */
  thin: boolean;
  /** WHAT LIES STILL STAYS AS LAST SEEN (game/fogofwar.ts FOG.kept; under the full picture alone — it rides the sight table's head): a particle at rest
   *  on floor the team sees is marked (shaders/particles.wgsl) and is then drawn over that floor when nobody looks too, until something wakes it. false = a
   *  case, a chip or a leaf of paper at rest is cut the moment the team looks away, as it was */
  kept: boolean;
  /** which statics are thin and free, a bit a box index (game/fogofwar.ts thinBlock, off scene/thin.ts's marks), and the box list they were read off: its
   *  geometry serial and its count of statics. A frame drawn after the list changed and before the next fill (a wall rebuilt, a restart: an index is another
   *  box's by then — a leaf's, should the statics have shrunk) is drawn with the row off (FogSight.encode) */
  thinBits: Uint32Array; thinSerial: number; thinCount: number;
  /** the renderer's own (the engine writes it each frame, the game never): this frame's sight table is written — FogSight.live. While it is not (its program
   *  still compiling, or failed), no class cuts anything, so the full picture is NOT drawn: the fog is `flat` / `lit`'s, which shows nothing live */
  sight: boolean;
  /** the renderer's own switch (the game never writes it): which program draws the pass — the picture is the same either way (FogPassMode) */
  pass: FogPassMode;
}
export function makeFogFrame(): FogFrame { const lights = new Float32Array(FOG_LIGHTS * 16); return { on: false, count: 0, eyes: new Float32Array(FOG_EYES * 4), looks: new Float32Array(FOG_EYES * 4), dim: 0.4, desat: 0.75, topPad: 0.3, edge: 0, softIn: 0, softOut: 0, nearSoft: 0, full: false, fullFlat: 0, air: false, thin: false, thinBits: new Uint32Array(FOG_THIN_WORDS), thinSerial: -1, thinCount: -1, kept: false, sight: false, flat: 0, lit: 0, litFill: 0, litCut: 0, litAo: 0, litAoM: 0, lightCount: 0, lights, lightsU: new Uint32Array(lights.buffer), pass: fogPassFlag() }; }

const U_BYTES = FOG_EYES * 16 * 2 + 64;

// ---- the programs' text (shaders/fogofwar.wgsl: the kernel, then `//#SECTION name` blocks; a `//#T ` line is taken in by a program that asks for tag T, a line
//      carrying `//#OLD` is left out of the hinted one — so the text before the first section, untouched, is the old kernel)
for (const m of fogSrc.matchAll(/\/\/#(\w+)/g)) if (!['H', 'C', 'CH', 'OLD', 'SECTION'].includes(m[1])) console.error(`[fog of war] shaders/fogofwar.wgsl: unknown tag //#${m[1]} — the line stays a comment in every program`);
const SEC = (() => { const p = fogSrc.split(/^\/\/#SECTION (\w+)[^\n]*$/m); const o: Record<string, string> = { kernel: p[0] }; for (let i = 1; i < p.length; i += 2) o[p[i]] = p[i + 1]; return o; })();
function take(text: string, tags: string[]): string {
  let t = tags.includes('H') ? text.split('\n').filter(l => !l.includes('//#OLD')).join('\n') : text;
  for (const g of tags) t = t.replace(new RegExp(`^(\\s*)//#${g} `, 'gm'), '$1');
  return t;
}
/** one program's text, without the scene prelude. 'old' = the kernel alone (entry `main`); 'hint' = the hinted kernel + the table pass (entries `main`, `pre`);
 *  `count` = the counting twin of either (QA: what each pixel cost, stored instead of the picture) */
export function fogSource(mode: FogPassMode, count = false): string {
  if (mode === 'old') return count ? take(SEC.kernel + SEC.walk + SEC.count, ['C']) : SEC.kernel;
  return take(SEC.kernel + SEC.hint + SEC.walk + SEC.pre + (count ? SEC.count : ''), count ? ['H', 'C', 'CH'] : ['H']);
}
const other = (m: FogPassMode): FogPassMode => m === 'old' ? 'hint' : 'old';
interface FogProgram { main: GPUComputePipeline; pre: GPUComputePipeline | null }

export class FogPass {
  /** the two programs' pipelines (null until compiled; the cut set swaps these three fields — cutSwap.ts ProgramSet) */
  private pipeHint: GPUComputePipeline | null = null; private pipePre: GPUComputePipeline | null = null; private pipeOld: GPUComputePipeline | null = null;
  private building: Record<FogPassMode, boolean> = { hint: false, old: false }; private built: Record<FogPassMode, boolean> = { hint: false, old: false };
  private bad: Record<FogPassMode, boolean> = { hint: false, old: false };
  private layout: GPUBindGroupLayout | null = null; private layoutPre: GPUBindGroupLayout | null = null;
  private lbuf: GPUBuffer | null = null; private lsent = new Int32Array(FOG_LIGHTS * 16); private lsentN = -1;   // the lit fog's lamps (FogFrame.lights) and the words the buffer holds: written only when they differ (a lamp, the mains or the hour moved)
  private ubuf: GPUBuffer | null = null; private udata = new Float32Array(U_BYTES / 4);
  private copy: GPUTexture | null = null; private copyView: GPUTextureView | null = null; private cw = 0; private ch = 0;
  private hint: GPUTexture | null = null; private hintView: GPUTextureView | null = null; private bgPre: GPUBindGroup | null = null;
  private bg: GPUBindGroup | null = null; private bgKey: unknown[] = [];
  /** what the last dispatched frame was given (QA: qaRun runs it again) */
  private last: { sceneBG: GPUBindGroup; depthView: GPUTextureView; normalView: GPUTextureView; albedoView: GPUTextureView; w: number; h: number; count: number } | null = null;
  /** which programs have their cut twin in the cut set (while that set is live a program without one would meet cut pieces whole) */
  private cutHas: Record<FogPassMode, boolean> = { hint: false, old: false }; private cutPrograms: Partial<Record<FogPassMode, Promise<FogProgram>>> = {};
  /** frames the pass has been dispatched (QA: 0 = it never ran) */
  dispatched = 0;
  /** the program the last dispatched frame ran ('' = none yet) */
  ran: FogPassMode | '' = '';
  constructor(private device: GPUDevice, private sceneLayout: GPUBindGroupLayout) { }

  private has(m: FogPassMode): boolean { return m === 'old' ? !!this.pipeOld : !!(this.pipeHint && this.pipePre); }
  /** is a kernel compiled (encode() is a no-op until then) */
  get ready(): boolean { return this.has('hint') || this.has('old'); }
  /** neither program compiled: nothing is dimmed */
  get failed(): boolean { return this.bad.hint && this.bad.old; }
  /** a program's text as compiled: the scene prelude + its part of shaders/fogofwar.wgsl (the compile check reads the same string) */
  static source(mode: FogPassMode = 'hint'): string { return scenePrelude() + fogSource(mode); }

  private resources() {
    if (this.layout) return;
    const d = this.device;
    this.layout = d.createBindGroupLayout({ label: 'fogofwar', entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'float' } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: 'write-only', format: 'rgba16float' } },
      { binding: 2, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'depth' } },
      { binding: 3, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'float' } },
      { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
      { binding: 5, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'float' } },
      { binding: 6, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'uint' } },   // the hint table (the old kernel does not read it)
      { binding: 8, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },       // the lit fog's lamps
    ] });
    this.layoutPre = d.createBindGroupLayout({ label: 'fogofwarPre', entries: [
      { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
      { binding: 7, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: 'write-only', format: 'r32uint' } },
    ] });
    this.ubuf = d.createBuffer({ label: 'fogofwar', size: U_BYTES, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.lbuf = d.createBuffer({ label: 'fogLights', size: FOG_LIGHTS * 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.hint = this.hintTexture(FOG_EYES); this.hintView = this.hint.createView();
    this.bgPre = d.createBindGroup({ layout: this.layoutPre, entries: [{ binding: 4, resource: { buffer: this.ubuf } }, { binding: 7, resource: this.hintView }] });
  }
  private hintTexture(rows: number): GPUTexture { return this.device.createTexture({ label: 'fogHint', size: [FOG_BINS, rows], format: 'r32uint', usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC }); }
  /** one program's pipelines from `text` (prelude included): the kernel, and for the hinted one the table pass out of the same module */
  private async program(mode: FogPassMode, text: string, label: string): Promise<FogProgram> {
    const d = this.device, mod = makeShader(d, text, label);
    const pl = (l: GPUBindGroupLayout) => d.createPipelineLayout({ bindGroupLayouts: [this.sceneLayout, l] });
    const [main, pre] = await Promise.all([d.createComputePipelineAsync({ label, layout: pl(this.layout!), compute: { module: mod, entryPoint: 'main' } }),
      mode === 'hint' ? d.createComputePipelineAsync({ label: label + 'Pre', layout: pl(this.layoutPre!), compute: { module: mod, entryPoint: 'pre' } }) : null]);
    return { main, pre };
  }
  private put(mode: FogPassMode, P: FogProgram, into: Record<string, unknown>) { if (mode === 'old') into.pipeOld = P.main; else { into.pipeHint = P.main; into.pipePre = P.pre; } }
  private build(mode: FogPassMode = 'hint') {
    if (this.built[mode] || this.building[mode] || this.bad[mode]) return;
    this.building[mode] = true; this.resources();
    this.program(mode, FogPass.source(mode), mode === 'old' ? 'fogofwarOld' : 'fogofwar').then(P => {
      this.put(mode, P, this as unknown as Record<string, unknown>); this.built[mode] = true;
      cutSwap.remove(this); cutSwap.add(this);   // (a program that came later: the cut set is built again with it in)
    }, e => { this.bad[mode] = true; console.error(`[fog of war] the '${mode}' program did not compile${this.has(other(mode)) ? ` — the '${other(mode)}' one draws the pass` : ' — nothing is dimmed'}: ${e?.message ?? e}`); }).finally(() => { this.building[mode] = false; });
  }
  // ---- CUT BOXES — a calm room pays nothing (render/cutSwap.ts): the programs a second time, behind the cut prelude (their eye lines meet a cut piece's cut shape)
  private cutSet = new ProgramSet(); private cutSerial = 0;
  async buildCut(): Promise<void> {
    if (!this.layout) return;
    const cut: Record<string, unknown> = {}, serial = ++this.cutSerial, modes = (['hint', 'old'] as FogPassMode[]).filter(m => this.built[m]);
    await Promise.all(modes.map(async m => this.put(m, await (this.cutPrograms[m] ??= this.program(m, scenePrelude(true) + fogSource(m), m === 'old' ? 'fogofwarOldCut' : 'fogofwarCut')), cut)));   // (each twin is compiled once: a later call for one more program reuses the others')
    if (serial === this.cutSerial) { this.cutSet.set(this, cut); for (const m of modes) this.cutHas[m] = true; }   // (a later call covers more programs: only the newest set goes in)
  }
  useCut(on: boolean) { this.cutSet.use(this, on); }
  /** the switch went off: the copy is let go (the pipelines and the hint table are kept — a flip back on costs nothing) */
  release() { this.copy?.destroy(); this.copy = null; this.copyView = null; this.bg = null; this.cw = this.ch = 0; this.last = null; }

  /** After the composite (+ splat, + GBAA), before the resolve: hdr → the copy, then (hinted) the table pass and the kernel, which stores hdr. `hdr` must carry COPY_SRC +
   *  STORAGE_BINDING (passes.ts gives it both while its fog switch is on); `depthView` / `normalView` are the g-buffer's at the composite's size; `sceneBG` the scene
   *  group whose frame block rasterised them (the OUTPUT block under sharp direct). */
  encode(enc: GPUCommandEncoder, F: FogFrame, sceneBG: GPUBindGroup, hdr: GPUTexture, hdrView: GPUTextureView, w: number, h: number, depthView: GPUTextureView, normalView: GPUTextureView, albedoView: GPUTextureView, ts?: () => GPUComputePassTimestampWrites | undefined) {
    if (!F.on || F.count <= 0) return;
    const want: FogPassMode = F.pass === 'old' ? 'old' : 'hint';
    if (!this.has(want)) { this.build(want); if (this.bad[want]) this.build(other(want)); }   // (the one asked for did not compile: the other is made, and draws)
    const fit = (m: FogPassMode) => this.has(m) && (!this.cutSet.live || this.cutHas[m]);   // (on the cut set, a program whose cut twin is not in yet would meet cut pieces whole)
    const mode = fit(want) ? want : fit(other(want)) ? other(want) : this.has(want) ? want : this.has(other(want)) ? other(want) : null;   // (the other program draws the same picture while the one asked for compiles, or if it failed to)
    if (!mode) return;
    const d = this.device;
    if (!this.copy || this.cw !== w || this.ch !== h) {
      this.copy?.destroy();
      this.copy = d.createTexture({ label: 'fogCopy', size: [w, h], format: 'rgba16float', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC });
      this.copyView = this.copy.createView(); this.cw = w; this.ch = h; this.bg = null;
    }
    const K = this.bgKey;
    if (!this.bg || K[0] !== hdrView || K[1] !== depthView || K[2] !== normalView || K[3] !== albedoView) {
      this.bg = this.group(this.copyView!, hdrView, depthView, normalView, albedoView, this.hintView!);
      this.bgKey = [hdrView, depthView, normalView, albedoView];
    }
    const count = Math.min(F.count, FOG_EYES);
    const U = this.udata; U.set(F.eyes, 0); U.set(F.looks, FOG_EYES * 4);
    const o = FOG_EYES * 8; U[o] = count; U[o + 1] = F.dim; U[o + 2] = F.desat; U[o + 3] = F.topPad;
    const full = F.full && F.sight, flat = full ? F.fullFlat : F.flat;   // (the full picture only over a live sight table: without one nothing is cut, and the fog stays the lit one)
    U[o + 4] = F.softIn; U[o + 5] = F.softOut; U[o + 6] = F.nearSoft; U[o + 7] = flat;
    const nl = !full && F.lit > 0 && flat > 0 ? Math.min(F.lightCount, FOG_LIGHTS) : 0;
    U[o + 8] = full ? 1 : F.lit; U[o + 9] = full ? flat : F.litFill; U[o + 10] = nl; U[o + 11] = F.litCut; U[o + 12] = F.litAo; U[o + 13] = F.litAoM; U[o + 14] = full ? 1 : 0; U[o + 15] = 0;   // (the full picture: the fill alone goes through the lit block — no lamps — and lit2.z says it is ADDED to the dimmed frame)
    d.queue.writeBuffer(this.ubuf!, 0, U);
    if (nl > 0) { const now = F.lightsU, sent = this.lsent, words = nl * 16; let same = this.lsentN === nl; for (let w = 0; same && w < words; w++) same = (now[w] | 0) === sent[w];
      if (!same) { d.queue.writeBuffer(this.lbuf!, 0, F.lights.buffer, F.lights.byteOffset, nl * 64); for (let w = 0; w < words; w++) sent[w] = now[w] | 0; this.lsentN = nl; } }
    enc.copyTextureToTexture({ texture: hdr }, { texture: this.copy }, [w, h]);
    const p = enc.beginComputePass({ label: 'fogofwar', timestampWrites: ts?.() });   // (the timer's slot is taken only on a frame the pass really runs: an undispatched slot reads as a phantom cost — gpu/timer.ts)
    p.setBindGroup(0, sceneBG);
    if (mode === 'hint') { p.setPipeline(this.pipePre!); p.setBindGroup(1, this.bgPre!); p.dispatchWorkgroups(FOG_BINS / 64, count); }   // the table first: its own dispatch (so its own usage scope) inside the kernel's pass and its timer slot
    p.setPipeline(mode === 'old' ? this.pipeOld! : this.pipeHint!); p.setBindGroup(1, this.bg); p.dispatchWorkgroups(Math.ceil(w / 8), Math.ceil(h / 8)); p.end();
    this.dispatched++; this.ran = mode;
    const L = this.last ??= { sceneBG, depthView, normalView, albedoView, w, h, count }; L.sceneBG = sceneBG; L.depthView = depthView; L.normalView = normalView; L.albedoView = albedoView; L.w = w; L.h = h; L.count = count;
  }
  private group(src: GPUTextureView, out: GPUTextureView, depthView: GPUTextureView, normalView: GPUTextureView, albedoView: GPUTextureView, hintView: GPUTextureView): GPUBindGroup {
    return this.device.createBindGroup({ layout: this.layout!, entries: [{ binding: 0, resource: src }, { binding: 1, resource: out }, { binding: 2, resource: depthView }, { binding: 3, resource: normalView }, { binding: 5, resource: albedoView }, { binding: 4, resource: { buffer: this.ubuf! } }, { binding: 6, resource: hintView }, { binding: 8, resource: { buffer: this.lbuf! } }] });
  }

  // ---- QA (tools/qa/fog-pass-check.cjs): the LAST dispatched frame's inputs — its copy of hdr, its g-buffer, its uniform block, the scene as uploaded — through one
  //      program again into a scratch texture, read back. Nothing of the frame is touched. `count` false = the picture that program stores (rgba16float halves: two
  //      programs compared on the very same inputs); true = its counting twin (per pixel: walks, hint box tests, the walks' box tests, the walks' cells — and for the
  //      hinted one `pre`: per (bin, eye) the table ray's box tests | cells << 16). Compiled on first use, from the prelude of the set the frame is on (`cut`: with the cut rule
  //      while a cut piece is alive — render/cutSwap.ts), never part of a frame.
  private qaPrograms = new Map<string, Promise<FogProgram>>();
  async qaRun(mode: FogPassMode, count = false, cut = this.cutSet.live): Promise<{ w: number; h: number; halves: Uint16Array; pre: Uint32Array | null; cut: boolean } | null> {
    const L = this.last; if (!L || !this.copy) return null;
    const d = this.device, key = mode + (count ? '+count' : '') + (cut ? '+cut' : '');
    let job = this.qaPrograms.get(key); if (!job) { this.qaPrograms.set(key, job = this.program(mode, (cut ? scenePrelude(true) : scenePrelude()) + fogSource(mode, count), 'fogofwarQa')); job.catch(() => this.qaPrograms.delete(key)); }
    const P = await job, { w, h } = L, rows = FOG_EYES * 2;
    const out = d.createTexture({ label: 'fogQa', size: [w, h], format: 'rgba16float', usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST });
    const table = this.hintTexture(rows), tableView = table.createView();
    const stride = Math.ceil(w * 8 / 256) * 256, buf = d.createBuffer({ size: stride * h, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }), tbuf = d.createBuffer({ size: FOG_BINS * 4 * rows, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    const enc = d.createCommandEncoder();
    enc.copyTextureToTexture({ texture: this.copy }, { texture: out }, [w, h]);   // (the hinted kernel stores only what it changes: the scratch starts as hdr did)
    const p = enc.beginComputePass({ label: 'fogofwarQa' }); p.setBindGroup(0, L.sceneBG);
    if (P.pre) { p.setPipeline(P.pre); p.setBindGroup(1, d.createBindGroup({ layout: this.layoutPre!, entries: [{ binding: 4, resource: { buffer: this.ubuf! } }, { binding: 7, resource: tableView }] })); p.dispatchWorkgroups(FOG_BINS / 64, L.count); }
    p.setPipeline(P.main); p.setBindGroup(1, this.group(this.copyView!, out.createView(), L.depthView, L.normalView, L.albedoView, tableView)); p.dispatchWorkgroups(Math.ceil(w / 8), Math.ceil(h / 8)); p.end();
    enc.copyTextureToBuffer({ texture: out }, { buffer: buf, bytesPerRow: stride }, [w, h]); enc.copyTextureToBuffer({ texture: table }, { buffer: tbuf, bytesPerRow: FOG_BINS * 4 }, [FOG_BINS, rows]);
    d.queue.submit([enc.finish()]);
    await Promise.all([buf.mapAsync(GPUMapMode.READ), tbuf.mapAsync(GPUMapMode.READ)]);
    const raw = new Uint16Array(buf.getMappedRange()), halves = new Uint16Array(w * h * 4);
    for (let y = 0; y < h; y++) halves.set(raw.subarray(y * stride / 2, y * stride / 2 + w * 4), y * w * 4);
    const pre = P.pre && count ? new Uint32Array(tbuf.getMappedRange().slice(FOG_BINS * 4 * FOG_EYES, FOG_BINS * 4 * (FOG_EYES + L.count))) : null;
    buf.unmap(); tbuf.unmap(); buf.destroy(); tbuf.destroy(); out.destroy(); table.destroy();
    return { w, h, halves, pre, cut };
  }
}

// ---- THE SIGHT TABLE (game/fogofwar.ts rule 4g, shaders/fogsight.wgsl): where the team sees, as a table every pass of the picture can ask (common.wgsl
//      fogSeenAt, the scene group's binding 11 — a 58 KB UNIFORM: FOG_BINS × FOG_EYES distances, then the eyes, their looks, the count and the soft edges). One
//      32 × live-eyes-group dispatch at the head of the frame while the full-picture fog is on writes the distances (the same buffer, as storage); the CPU writes the
//      head. Nothing while it is off: the head's 'written' word is put back to 0 the frame the rule goes off, so a stale table is never asked.
/** the sight table's list of thin statics: this many u32 (a bit a box index — common.wgsl FogSightT.thin, an array<vec4u, FOG_THIN_WORDS / 4>) */
export const FOG_THIN_WORDS = 128;
const SIGHT_HEAD = FOG_BINS * FOG_EYES * 4, SIGHT_FLOATS_BYTES = FOG_EYES * 32 + 32, SIGHT_HEAD_BYTES = SIGHT_FLOATS_BYTES + FOG_THIN_WORDS * 4;
/** the table's size in bytes (common.wgsl FogSightT) — the engine's stand-in for the pass that writes it is as large */
export const FOG_SIGHT_BYTES = SIGHT_HEAD + SIGHT_HEAD_BYTES;
if (FOG_SIGHT_BYTES > 65536 || FOG_SIGHT_BYTES % 16 !== 0) throw new Error(`the fog's sight table: ${FOG_SIGHT_BYTES} B is over a uniform block's 64 KB or off a 16-byte row (FOG_EYES ${FOG_EYES} × FOG_BINS ${FOG_BINS})`);
export class FogSight implements CutSwappable {
  readonly buf: GPUBuffer;
  private pipe: GPUComputePipeline | null = null; private building = false; private bad = false;
  private layout: GPUBindGroupLayout; private ubuf: GPUBuffer; private bg: GPUBindGroup; private udata = new Float32Array(SIGHT_HEAD_BYTES / 4); private uwords = new Uint32Array(this.udata.buffer);
  /** the scene group's STAND-IN for the table (engine.ts fogSightStand: what this pass itself reads at binding 11, zeros but for this): the thin statics' bits are
   *  written there too, so the kernel's own rays find them (common.wgsl fogThinBox reads fogSight.thin whichever buffer is bound) */
  stand: GPUBuffer | null = null; /** the bits as last written there (null: never) */ private standBits: Uint32Array | null = null;
  /** the box world the frame is drawn from (engine.ts): the thin bits count only while they were read off its list as it now is */
  world: { statics: unknown[]; geomSerial: number } | null = null;
  private cutSet = new ProgramSet();
  /** the table holds this frame's answer (false = its 'written' word is 0: fogSeenAt answers 'seen' everywhere, and the fog pass does not draw the full picture) */
  live = false;
  /** frames the pass has been dispatched (QA) */
  dispatched = 0;
  constructor(private device: GPUDevice, private sceneLayout: GPUBindGroupLayout) {
    const d = device;
    this.buf = d.createBuffer({ label: 'fogSight', size: FOG_SIGHT_BYTES, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC });
    this.layout = d.createBindGroupLayout({ label: 'fogSight', entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
    ] });
    this.ubuf = d.createBuffer({ label: 'fogSightU', size: SIGHT_FLOATS_BYTES, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.bg = d.createBindGroup({ layout: this.layout, entries: [{ binding: 0, resource: { buffer: this.ubuf } }, { binding: 1, resource: { buffer: this.buf } }] });
  }
  /** the program's text as compiled (the compile check reads the same string) */
  static source(cut?: boolean): string { return (cut === undefined ? scenePrelude() : scenePrelude(cut)) + sightSrc; }
  private program(text: string, label: string): Promise<GPUComputePipeline> {
    const d = this.device;
    return d.createComputePipelineAsync({ label, layout: d.createPipelineLayout({ bindGroupLayouts: [this.sceneLayout, this.layout] }), compute: { module: makeShader(d, text, label), entryPoint: 'main' } });
  }
  private build() {
    if (this.pipe || this.building || this.bad) return;
    this.building = true;
    this.program(FogSight.source(), 'fogSight').then(p => { this.pipe = p; cutSwap.remove(this); cutSwap.add(this); },
      e => { this.bad = true; console.error(`[fog of war] the sight table's program did not compile — the fog stays the lit one: ${e?.message ?? e}`); }).finally(() => { this.building = false; });
  }
  async buildCut(): Promise<void> { if (!this.pipe) return; this.cutSet.set(this, { pipe: await this.program(FogSight.source(true), 'fogSightCut') }); }
  useCut(on: boolean) { this.cutSet.use(this, on); }
  /** At the head of the frame, before anything that lights a pixel. `sceneBGPlain` = the scene group whose binding 11 is the stand-in (this pass writes the
   *  table the frame's own group binds there). `F` null / off / not the full picture / no eye = no pass, and the table is marked unwritten. */
  encode(enc: GPUCommandEncoder, F: FogFrame | null, sceneBGPlain: GPUBindGroup) {
    const want = !!F && F.on && F.full && F.count > 0;
    if (want && !this.pipe) this.build();
    if (!want || !this.pipe) {
      if (this.live) { this.device.queue.writeBuffer(this.buf, SIGHT_HEAD + FOG_EYES * 32, new Float32Array(4)); this.live = false; }
      return;
    }
    const U = this.udata, count = Math.min(F!.count, FOG_EYES); U.set(F!.eyes, 0); U.set(F!.looks, FOG_EYES * 4);
    const W = this.world, thin = F!.thin && (!W || (W.geomSerial === F!.thinSerial && W.statics.length === F!.thinCount));   // (FOG.thin, and its bits still this box list's)
    for (let k = count; k < FOG_EYES; k++) U[k * 4 + 3] = 0;   // (a row past the count is no eye)
    const o = FOG_EYES * 8; U[o] = count; U[o + 1] = 1; U[o + 2] = F!.topPad; U[o + 3] = Math.max(0, F!.edge); U[o + 4] = F!.softIn; U[o + 5] = F!.softOut; U[o + 6] = F!.nearSoft; U[o + 7] = (F!.air ? 1 : 0) + (thin ? 2 : 0) + (F!.kept ? 4 : 0);   // (one whole number, three bits: common.wgsl fogSmokeOn / fogThinOn / fogKeptOn)
    this.uwords.set(F!.thinBits, SIGHT_FLOATS_BYTES / 4);
    this.device.queue.writeBuffer(this.ubuf, 0, U, 0, SIGHT_FLOATS_BYTES / 4); this.device.queue.writeBuffer(this.buf, SIGHT_HEAD, U);   // (this pass's own block is the floats alone: fogsight.wgsl SightU)
    if (this.stand && thin) { const T = F!.thinBits, was = this.standBits; let same = !!was; if (was) for (let i = 0; i < T.length; i++) if (T[i] !== was[i]) { same = false; break; }
      if (!same) { this.device.queue.writeBuffer(this.stand, SIGHT_HEAD + SIGHT_FLOATS_BYTES, T); (this.standBits ??= new Uint32Array(T.length)).set(T); } }
    const p = enc.beginComputePass({ label: 'fogSight' });
    p.setPipeline(this.pipe); p.setBindGroup(0, sceneBGPlain); p.setBindGroup(1, this.bg); p.dispatchWorkgroups(FOG_BINS / 64, count); p.end();   // (the live eyes' rows: a row past the count is no eye, and nothing reads its distances — fogSeenAt skips it)
    this.live = true; this.dispatched++;
  }
}
