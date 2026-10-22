// THE OUTLINE IN THE DARK (host/findme.ts FINDME.outline, Options > Game): the player's own man, and his teammates, each rimmed when his own light meter
// says he is in the dark — his true silhouette, from the g-buffer's id target (shaders/outline.wgsl), not a figure drawn over the picture. One render pass
// onto the composite, after the fog of war and before the resolve: a blended triangle a man, scissored to the box round him the host hands in, the
// teammates first and the player last (where two rims meet, his is the one on top). Modelled on fogofwar.ts: nothing is built until the row is first
// on (the pipeline compiles off the frame; until it has, and for good if it fails, the pass draws nothing), and with the row off encode() is not called at all.
// It binds the id and depth targets and one small uniform buffer, a 32-byte slot a man picked by a dynamic offset: no scene group, no storage buffer, no
// copy of the composite. No timer row either: a render pass's stamp is not to be trusted on every backend (engine.ts says so of the particles' draw), and
// this one is a few scissored triangles. Men who stand close are each looked for in their own box, so where boxes overlap the pixels are read once a man.
// WHAT CARRIES A MAN'S OWNER AND IS NOT HIM: a round of his own for the frame it leaves the muzzle, a charge while his hands set it. They take the rim too.
import { makeShader } from '../gpu/device';
import outlineSrc from './shaders/outline.wgsl' with { type: 'text' };

/** One man to rim: whose pixels, how strongly, how wide, in what ink, and the box on the picture he is looked for in. */
export interface OutlineMan {
  on: boolean;
  /** the owner byte of the man to rim (the g-buffer's id, bits 20–27) */
  owner: number;
  /** 0 = nothing drawn … 1 = the rim at its full opacity (the light meter's word for THIS man, eased) */
  strength: number;
  /** that full opacity, 0 … 1 (the player's row, host/findme.ts FINDME.opacity) */
  alpha: number;
  /** the rim's colour as displayed, before the tone map (the exposure is taken out by the pass) */
  ink: [number, number, number];
  /** where he stands (his feet), and the box round that the rim is looked for in: `reach` metres each way in plan, `top` metres up */
  at: [number, number, number]; reach: number; top: number;
  /** the rim's width as a share of its own (the player's row, FINDME.width, for every man): 1 = OUTLINE's width */
  wide: number;
  /** what that rim COVERS, times this (1 for the player; a teammate's is the teammates' row, FINDME.mates: 0.5 = half as much beside him as beside the
   *  player on the same picture, 2 = twice — outlineRadius) */
  times: number;
  /** the renderer's own (the engine writes it each render, the host never): that box on the picture THIS render's camera draws, as fractions of it
   *  (x0, y0, x1, y1; y down; all 0 = he is behind the lens) — the pass draws inside it alone */
  rect: [number, number, number, number];
}
/** What the host hands the pass (one object, written in place: ui/findme.ts findMeOutline, once a frame): the player's own man, and his teammates
 *  (`mates`: a pool, each with its own `on`). `on` false = no pass at all, whatever the mates say. */
export interface OutlineFrame extends OutlineMan {
  mates: OutlineMan[];
  /** the renderer's own: the exposure the tone map will put on the composite */
  exposure: number;
}
export function makeOutlineMan(): OutlineMan { return { on: false, owner: 0, strength: 0, alpha: 1, ink: [0.5, 0.5, 0.5], at: [0, 0, 0], reach: 1.4, top: 2.3, wide: 1, times: 1, rect: [0, 0, 0, 0] }; }
export function makeOutlineFrame(): OutlineFrame { return { ...makeOutlineMan(), mates: [], exposure: 1 }; }

type Project = (p: [number, number, number]) => [number, number, boolean];
/** `F.rect` from the camera a render draws with (`project`: a world point to fractions of the picture + whether it is in front of the lens — FollowCamera
 *  .project(p, 1, 1)): the box's eight corners, padded. He behind the lens = an empty box, nothing drawn; a corner behind it with him in front (the lens
 *  inside the box) = the whole picture — if his middle is on or near the picture at all: a teammate off to the side of a low camera, his box across the
 *  lens's plane, is not looked for over every pixel of a picture he is not in. */
export function outlineBox(F: OutlineMan, project: Project) {
  const r = F.rect, a = F.at, PAD = 0.012, mid = project([a[0], a[1] + F.top * 0.5, a[2]]);
  if (!mid[2]) { r[0] = r[1] = r[2] = r[3] = 0; return; }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < 8; i++) {
    const [x, y, v] = project([a[0] + (i & 1 ? F.reach : -F.reach), a[1] + (i & 2 ? F.top : 0), a[2] + (i & 4 ? F.reach : -F.reach)]);
    if (!v) { r[0] = r[1] = 0; r[2] = r[3] = mid[0] > -0.5 && mid[0] < 1.5 && mid[1] > -0.5 && mid[1] < 1.5 ? 1 : 0; return; }
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  r[0] = x0 - PAD; r[1] = y0 - PAD; r[2] = x1 + PAD; r[3] = y1 + PAD;
}
/** every man of the frame boxed for one camera (the player, and each teammate who is on). Engine.render calls it, so every render — a still, a card's
 *  settled frame — has the boxes of its own camera. */
export function outlineBoxes(F: OutlineFrame, project: Project) {
  if (!F.on) return;
  outlineBox(F, project); for (const m of F.mates) if (m.on) outlineBox(m, project);
}

/** the rim's look: its width — a fraction of the composite's height, held
 *  between two pixel counts; the player's own share of that (OutlineFrame.wide) comes after (outlineRadius).
 *  THE WIDTH IS THREE QUARTERS OF WHAT IT WAS FIRST BUILT WITH (1 / 420, 1.5 to 3 pixels): the maintainer, having seen that on a GPU, "it's just a touch
 *  too fat". The quarter is a guess at 'a touch', and it is here, not in the player's row: a kept row at 1 follows this number when it is tuned again */
export const OUTLINE = { width: 1 / 560, minPx: 1.125, maxPx: 2.25, capPx: 4 };
/** the rim's radius on a composite `h` pixels high, the player's share `wide` of its width taken. Over 1 the row multiplies the radius. UNDER 1 IT SCALES
 *  WHAT THE RIM COVERS, not the radius: the shader fades the outer pixel (outline.wgsl: radius + 0.5 − the distance), so a rim of radius r covers r − 0.5
 *  of a pixel beside him — the pixel next to him is whole at 1.5 and gone at 0.5. So 0 = radius 0.5, nothing; 1 = OUTLINE's own; and between, the cover
 *  is its own times the row SQUARED: every step is a little less of it on any composite, finest where the rim is thinnest, and no kept row under 1 is
 *  drawn wider than the rule it replaces drew it (the row once multiplied the radius down to a floor of 0.9; the maintainer, at its least: "still large
 *  at 50%"). Under one pixel covered, 'thinner' can only be that pixel fainter: a line is never narrower than its pixel. `times` (a teammate's) multiplies that cover,
 *  whatever the row made it: half is half of the player's on the same picture, at any row. Never over `capPx`, whatever the two make (the shader reads
 *  a square of that radius round every pixel in the box): the widest row with the widest teammates stops there */
export function outlineRadius(h: number, wide = 1, times = 1): number {
  const own = Math.max(OUTLINE.minPx, Math.min(OUTLINE.maxPx, h * OUTLINE.width)), k = Math.max(0, wide), r = k >= 1 ? own * k : 0.5 + (own - 0.5) * k * k;
  return Math.min(OUTLINE.capPx, 0.5 + (r - 0.5) * Math.max(0, times));
}

/** the men one pass can rim (the player and a squad's teammates, with room), and a slot's stride in the uniform buffer (a dynamic offset's alignment) */
export const OUTLINE_MEN = 8;
const SLOT = 256;

export class OutlinePass {
  private pipe: GPURenderPipeline | null = null; private building = false; private bad = false;
  private layout: GPUBindGroupLayout | null = null; private ubuf: GPUBuffer | null = null;
  private offs = new Uint32Array(OUTLINE_MEN); private sc = new Int32Array(OUTLINE_MEN * 4);
  private udata = new ArrayBuffer(32); private uf = new Float32Array(this.udata); private uu = new Uint32Array(this.udata);
  private bg: GPUBindGroup | null = null; private bgView: GPUTextureView | null = null; private bgDepth: GPUTextureView | null = null;
  /** frames the rim was drawn (QA: 0 = it never was) */
  drawn = 0;
  constructor(private device: GPUDevice) {}

  private build() {
    if (this.building || this.bad) return; this.building = true;
    const d = this.device, FS = GPUShaderStage.FRAGMENT;
    this.layout = d.createBindGroupLayout({ label: 'outline', entries: [
      { binding: 0, visibility: FS, texture: { sampleType: 'uint' } },
      { binding: 1, visibility: FS, texture: { sampleType: 'depth' } },
      { binding: 2, visibility: FS, buffer: { type: 'uniform', hasDynamicOffset: true, minBindingSize: 32 } },
    ] });
    this.ubuf = d.createBuffer({ label: 'outline', size: OUTLINE_MEN * SLOT, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const mod = makeShader(d, outlineSrc, 'outline');
    const over: GPUBlendState = { color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'zero', dstFactor: 'one' } };
    d.createRenderPipelineAsync({ label: 'outline', layout: d.createPipelineLayout({ bindGroupLayouts: [this.layout] }), vertex: { module: mod, entryPoint: 'vs' },
      fragment: { module: mod, entryPoint: 'fs', targets: [{ format: 'rgba16float', blend: over }] }, primitive: { topology: 'triangle-list' } })
      .then(p => { this.pipe = p; }, e => { this.bad = true; console.error('[outline] its program did not compile: the outline in the dark is not drawn', e); })
      .finally(() => { this.building = false; });
  }

  /** the row went off: let go of the g-buffer's views (the pipeline, its few bytes and no texture, is kept for the next time) */
  release() { this.bg = null; this.bgView = null; this.bgDepth = null; }

  /** one man's 32 bytes into slot `i` and his scissor beside them; false = he has nothing to draw this frame (no strength, no width, off the picture) */
  private put(i: number, M: OutlineMan, exposure: number, w: number, h: number): boolean {
    if (!M.on || !(M.strength > 0.004) || !(M.wide > 0) || !(M.times > 0) || !(M.alpha > 0)) return false;   // (width and opacity: a frame built by hand — the host's own is off at either row's none)
    const x0 = Math.max(0, Math.floor(M.rect[0] * w)), y0 = Math.max(0, Math.floor(M.rect[1] * h)), x1 = Math.min(w, Math.ceil(M.rect[2] * w)), y1 = Math.min(h, Math.ceil(M.rect[3] * h));
    if (!(x1 > x0 && y1 > y0)) return false;   // (he is off the picture, or behind the lens)
    const k = 1 / Math.max(exposure, 1e-4);
    this.uf[0] = M.ink[0] * k; this.uf[1] = M.ink[1] * k; this.uf[2] = M.ink[2] * k; this.uf[3] = Math.min(1, M.alpha) * Math.min(1, M.strength);
    this.uu[4] = M.owner & 0xff; this.uf[5] = outlineRadius(h, M.wide, M.times);
    this.device.queue.writeBuffer(this.ubuf!, i * SLOT, this.udata);
    this.sc[i * 4] = x0; this.sc[i * 4 + 1] = y0; this.sc[i * 4 + 2] = x1 - x0; this.sc[i * 4 + 3] = y1 - y0; this.offs[i] = i * SLOT;
    return true;
  }

  /** After the composite (+ splat, + GBAA, + the fog of war), before the resolve. `hdrView` = the composite (a render target always); `idView` /
   *  `depthView` = the g-buffer's id and depth targets at the composite's size, `w` × `h`. One render pass, a scissored triangle a man (his teammates,
   *  then the player's over theirs: OUTLINE_MEN in all, his place kept), each with his own slot of the one uniform buffer. */
  encode(enc: GPUCommandEncoder, F: OutlineFrame, hdrView: GPUTextureView, idView: GPUTextureView, depthView: GPUTextureView, w: number, h: number) {
    if (!F.on) return;
    if (!this.pipe) { this.build(); return; }
    let n = 0;
    for (const m of F.mates) if (n < OUTLINE_MEN - 1 && this.put(n, m, F.exposure, w, h)) n++;
    if (this.put(n, F, F.exposure, w, h)) n++;
    if (!n) return;
    if (this.bgView !== idView || this.bgDepth !== depthView) { this.bgView = idView; this.bgDepth = depthView; this.bg = this.device.createBindGroup({ label: 'outline', layout: this.layout!, entries: [{ binding: 0, resource: idView }, { binding: 1, resource: depthView }, { binding: 2, resource: { buffer: this.ubuf!, offset: 0, size: 32 } }] }); }
    const p = enc.beginRenderPass({ label: 'outline', colorAttachments: [{ view: hdrView, loadOp: 'load', storeOp: 'store' }] });
    p.setPipeline(this.pipe);
    for (let i = 0; i < n; i++) { p.setBindGroup(0, this.bg!, this.offs, i, 1); p.setScissorRect(this.sc[i * 4], this.sc[i * 4 + 1], this.sc[i * 4 + 2], this.sc[i * 4 + 3]); p.draw(3); }
    p.end();
    this.drawn++;
  }
}
