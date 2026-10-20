// THE OUTLINE IN THE DARK (host/findme.ts FINDME.outline, Options > Game): the player's own man rimmed when the light meter says he is in the dark — his
// true silhouette, from the g-buffer's id target (shaders/outline.wgsl), not a figure drawn over the picture. One blended triangle onto the composite, after
// the fog of war and before the resolve, scissored to the box round him the host hands in. Modelled on fogofwar.ts: nothing is built until the row is first
// on (the pipeline compiles off the frame; until it has, and for good if it fails, the pass draws nothing), and with the row off encode() is not called at all.
// It binds the id and depth targets and its own 32 bytes: no scene group, no storage buffer, no copy of the composite. No timer row either: a render pass's
// stamp is not to be trusted on every backend (engine.ts says so of the particles' draw), and this one is a scissored triangle.
// WHAT CARRIES HIS OWNER AND IS NOT HIM: a round of his own for the frame it leaves the muzzle, a charge while his hands set it. They take the rim too.
import { makeShader } from '../gpu/device';
import outlineSrc from './shaders/outline.wgsl' with { type: 'text' };

/** What the host hands the pass (one object, written in place: ui/findme.ts findMeOutline, once a frame). `on` false = no pass. */
export interface OutlineFrame {
  on: boolean;
  /** the owner byte of the man to rim (the g-buffer's id, bits 20–27) */
  owner: number;
  /** 0 = nothing drawn … 1 = the rim at its full opacity (the light meter's word, eased) */
  strength: number;
  /** where he stands (his feet), and the box round that the rim is looked for in: `reach` metres each way in plan, `top` metres up */
  at: [number, number, number]; reach: number; top: number;
  /** the renderer's own (the engine writes both each render, the host never): that box on the picture THIS render's camera draws, as fractions of it
   *  (x0, y0, x1, y1; y down; all 0 = he is behind the lens) — the pass draws inside it alone — and the exposure the tone map will put on the composite */
  rect: [number, number, number, number]; exposure: number;
}
export function makeOutlineFrame(): OutlineFrame { return { on: false, owner: 0, strength: 0, at: [0, 0, 0], reach: 1.4, top: 2.3, rect: [0, 0, 0, 0], exposure: 1 }; }

/** `F.rect` from the camera a render draws with (`project`: a world point to fractions of the picture + whether it is in front of the lens — FollowCamera
 *  .project(p, 1, 1)): the box's eight corners, padded. He behind the lens = an empty box, nothing drawn; a corner behind it with him in front (the lens
 *  inside the box) = the whole picture. Engine.render calls it, so every render — a still, a card's settled frame — has the box of its own camera. */
export function outlineBox(F: OutlineFrame, project: (p: [number, number, number]) => [number, number, boolean]) {
  const r = F.rect, a = F.at, PAD = 0.012;
  if (!project([a[0], a[1] + F.top * 0.5, a[2]])[2]) { r[0] = r[1] = r[2] = r[3] = 0; return; }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < 8; i++) {
    const [x, y, v] = project([a[0] + (i & 1 ? F.reach : -F.reach), a[1] + (i & 2 ? F.top : 0), a[2] + (i & 4 ? F.reach : -F.reach)]);
    if (!v) { r[0] = r[1] = 0; r[2] = r[3] = 1; return; }
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  r[0] = x0 - PAD; r[1] = y0 - PAD; r[2] = x1 + PAD; r[3] = y1 + PAD;
}

/** the rim's look: its colour as displayed (before the tone map), its opacity at full strength, and its width — a fraction of the composite's height, held
 *  between two pixel counts */
export const OUTLINE = { ink: [0.42, 0.5, 0.55], alpha: 0.6, width: 1 / 420, minPx: 1.5, maxPx: 3 };

export class OutlinePass {
  private pipe: GPURenderPipeline | null = null; private building = false; private bad = false;
  private layout: GPUBindGroupLayout | null = null; private ubuf: GPUBuffer | null = null;
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
      { binding: 2, visibility: FS, buffer: { type: 'uniform' } },
    ] });
    this.ubuf = d.createBuffer({ label: 'outline', size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const mod = makeShader(d, outlineSrc, 'outline');
    const over: GPUBlendState = { color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'zero', dstFactor: 'one' } };
    d.createRenderPipelineAsync({ label: 'outline', layout: d.createPipelineLayout({ bindGroupLayouts: [this.layout] }), vertex: { module: mod, entryPoint: 'vs' },
      fragment: { module: mod, entryPoint: 'fs', targets: [{ format: 'rgba16float', blend: over }] }, primitive: { topology: 'triangle-list' } })
      .then(p => { this.pipe = p; }, e => { this.bad = true; console.error('[outline] its program did not compile: the outline in the dark is not drawn', e); })
      .finally(() => { this.building = false; });
  }

  /** the row went off: let go of the g-buffer's views (the pipeline, 32 bytes and no texture, is kept for the next time) */
  release() { this.bg = null; this.bgView = null; this.bgDepth = null; }

  /** After the composite (+ splat, + GBAA, + the fog of war), before the resolve. `hdrView` = the composite (a render target always); `idView` /
   *  `depthView` = the g-buffer's id and depth targets at the composite's size, `w` × `h`. */
  encode(enc: GPUCommandEncoder, F: OutlineFrame, hdrView: GPUTextureView, idView: GPUTextureView, depthView: GPUTextureView, w: number, h: number) {
    if (!F.on) return;
    if (!this.pipe) { this.build(); return; }
    if (!(F.strength > 0.004)) return;
    const x0 = Math.max(0, Math.floor(F.rect[0] * w)), y0 = Math.max(0, Math.floor(F.rect[1] * h)), x1 = Math.min(w, Math.ceil(F.rect[2] * w)), y1 = Math.min(h, Math.ceil(F.rect[3] * h));
    if (!(x1 > x0 && y1 > y0)) return;   // (he is off the picture, or behind the lens)
    const k = 1 / Math.max(F.exposure, 1e-4);
    this.uf[0] = OUTLINE.ink[0] * k; this.uf[1] = OUTLINE.ink[1] * k; this.uf[2] = OUTLINE.ink[2] * k; this.uf[3] = OUTLINE.alpha * Math.min(1, F.strength);
    this.uu[4] = F.owner & 0xff; this.uf[5] = Math.max(OUTLINE.minPx, Math.min(OUTLINE.maxPx, h * OUTLINE.width));
    this.device.queue.writeBuffer(this.ubuf!, 0, this.udata);
    if (this.bgView !== idView || this.bgDepth !== depthView) { this.bgView = idView; this.bgDepth = depthView; this.bg = this.device.createBindGroup({ label: 'outline', layout: this.layout!, entries: [{ binding: 0, resource: idView }, { binding: 1, resource: depthView }, { binding: 2, resource: { buffer: this.ubuf! } }] }); }
    const p = enc.beginRenderPass({ label: 'outline', colorAttachments: [{ view: hdrView, loadOp: 'load', storeOp: 'store' }] });
    p.setPipeline(this.pipe); p.setBindGroup(0, this.bg!); p.setScissorRect(x0, y0, x1 - x0, y1 - y0); p.draw(3); p.end();
    this.drawn++;
  }
}
