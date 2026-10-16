// GPU irradiance queries with async readback (1–2 frames latency). Used for the stealth light meter.
import { cutSwap, ProgramSet } from './cutSwap';
import { makeBuffer, makeShader, computePipelineAsync, writeWordsIfChanged } from '../gpu/device';
import { Vec3 } from '../math/vec';
import { scenePrelude } from './frame';
import lightingCommon from './shaders/lighting_common.wgsl' with { type: 'text' };
import probeSrc from './shaders/probe.wgsl' with { type: 'text' };

/** asks answered a frame. Everything on the GPU side is sized from this one number or from the count it is handed: the query / result / readback buffers
 *  below, probe.wgsl's runtime-sized arrays and its `i >= pp.count` guard, a dispatch of ⌈n / 32⌉ groups of the kernel's 32 threads — still two storage buffers.
 *  It was 32: Sam + the four + eleven defenders ask about fifty (two meters a unit, a smoke line a defender, the fog of war's). */
export const MAX_QUERIES = 64;
/** the last of the ranks an ask can carry (0 first; game/sensors.ts askRank deals them): on a frame that asks for more than the table holds the lowest ranks keep
 *  their places — see put() */
const LAST_RANK = 3;
type Ask = { key: string; pos: Vec3; skipOwner: number; b?: Vec3; rank: number };

export class IrradianceProbe {
  private pipe!: GPUComputePipeline; private layout: GPUBindGroupLayout; private bg: GPUBindGroup | null = null; private bgDice: GPUTextureView | null = null;
  private mod: GPUShaderModule; private pipeLayout: GPUPipelineLayout;
  private queryBuf: GPUBuffer; private resultBuf: GPUBuffer; private paramBuf: GPUBuffer;
  private readbacks: GPUBuffer[] = []; private inflight: { buf: GPUBuffer; keys: string[] }[] = [];
  private qData = new Float32Array(MAX_QUERIES * 8); private qU32 = new Uint32Array(this.qData.buffer);
  private pending: Ask[] = [];
  /** only ever written on a frame the table was full: the encode (by its serial) each key last had a place in — who has waited longest, for put()'s turns */
  private answered = new Map<string, number>(); private serial = 0; private tight = false;
  /** latest results by key: [maxAxis, mean, up] */
  results = new Map<string, [number, number, number]>();

  constructor(private device: GPUDevice, sceneLayout: GPUBindGroupLayout) {
    this.layout = device.createBindGroupLayout({ label: 'probe', entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      { binding: 2, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'float', viewDimension: '3d' } },
      { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
    ] });
    this.mod = makeShader(device, scenePrelude() + lightingCommon + probeSrc, 'probe');
    this.pipeLayout = device.createPipelineLayout({ bindGroupLayouts: [sceneLayout, this.layout] });   // (the kernel itself: init(), awaited by main.ts before the first frame)
    this.queryBuf = makeBuffer(device, MAX_QUERIES * 32, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST, 'probeQueries');
    this.resultBuf = makeBuffer(device, MAX_QUERIES * 16, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC, 'probeResults');
    this.paramBuf = makeBuffer(device, 16, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, 'probeParams');
  }

  /** the kernel, compiled off the GPU process's main thread (gpu/device.ts computePipelineAsync) — main.ts awaits it with the rest of the game's GPU init; never called headless */
  async init(): Promise<void> { this.pipe ??= await computePipelineAsync(this.device, { label: 'probe', layout: this.pipeLayout, compute: { module: this.mod, entryPoint: 'main' } }); cutSwap.add(this); }
  // ---- CUT BOXES — a calm room pays nothing (render/cutSwap.ts): the meter's kernel a second time, behind the cut prelude (ONE MODEL: the meter and the sight lines
  // meet a cut piece's cut shape while one is alive, as the picture's rays do)
  private cutSet = new ProgramSet();
  async buildCut(): Promise<void> {
    const pipe = await computePipelineAsync(this.device, { label: 'probeCut', layout: this.pipeLayout, compute: { module: makeShader(this.device, scenePrelude(true) + lightingCommon + probeSrc, 'probeCut'), entryPoint: 'main' } });
    this.cutSet.set(this, { pipe });
  }
  useCut(on: boolean) { this.cutSet.use(this, on); }

  /** Queue a query for this frame. `rank` (0 first ‥ 3 last): who keeps a place on a frame that asks for more than the table holds — put(). */
  query(key: string, pos: Vec3, skipOwner = 0, rank = 2) { this.put({ key, pos, skipOwner, rank }); }
  /** Smoke transmittance along a→b (result[0] in 0..1). */
  querySegment(key: string, a: Vec3, b: Vec3, rank = 1) { this.put({ key, pos: a, skipOwner: 0, b, rank }); }
  get(key: string): [number, number, number] | undefined { return this.results.get(key); }
  /** free places in the table this frame (0: full — an ask of the LAST rank made now is dropped; a lower rank's may still take a place from a higher's) */
  get room(): number { return MAX_QUERIES - this.pending.length; }

  /** ONE ASK INTO THE FRAME'S TABLE. While there is room: appended, the table exactly as it always was. Full, it used to be first come, first kept — and what a
   *  frame asks LAST is what the game leans on most (Sam's own meter, then the defenders' sight lines to him through smoke): with Sam, four teammates and eleven
   *  defenders up, every one of those lines was dropped on every frame. Now a full table gives a place up to an ask that outranks its holder, and inside a rank to
   *  a key that has waited longer than its holder's — so the lowest ranks always keep their places and the rank that straddles the limit takes TURNS (each of its
   *  keys answered every few frames, reading its last answer in between: `results` keeps it). The last rank stays first come: its asker (the fog of war) counts
   *  `room` and forgets what it could not ask. The list never grows past MAX_QUERIES. */
  private put(q: Ask) {
    const P = this.pending; if (P.length < MAX_QUERIES) { P.push(q); return; }
    this.tight = true;
    let j = P.findIndex(x => x.key === q.key);   // (asked again with the table still full — frames stepped with nothing rendered: the newer ask, in its place)
    if (j < 0) {
      const mine = this.answered.get(q.key) ?? -1; let worst = -1, when = -2;
      for (let i = 0; i < P.length; i++) {
        const x = P[i], t = this.answered.get(x.key) ?? -1;
        if (!(x.rank > q.rank || (x.rank === q.rank && q.rank < LAST_RANK && t > mine))) continue;   // (he yields to a lower rank, or — inside a rank — to a key that has waited longer)
        if (x.rank > worst || (x.rank === worst && t >= when)) { j = i; worst = x.rank; when = t; }   // (of those: the highest rank, then the most lately answered, then the last asked)
      }
    }
    if (j >= 0) P[j] = q;
  }

  get hasPending() { return this.pending.length > 0; }
  private countSent = new Uint32Array(4);
  private countData = new Uint32Array(4);   // (the count uniform, rewritten in place — review R1.4)

  encode(enc: GPUCommandEncoder, sceneBG: GPUBindGroup, diceView: GPUTextureView, ts?: GPUComputePassTimestampWrites) {
    const n = this.pending.length; if (n === 0) return;
    if (!this.bg || this.bgDice !== diceView) {
      this.bg = this.device.createBindGroup({ layout: this.layout, entries: [
        { binding: 0, resource: { buffer: this.queryBuf } }, { binding: 1, resource: { buffer: this.resultBuf } }, { binding: 2, resource: diceView }, { binding: 3, resource: { buffer: this.paramBuf } },
      ] });
      this.bgDice = diceView;
    }
    for (let i = 0; i < n; i++) { const q = this.pending[i]; const o = i * 8; this.qData[o] = q.pos[0]; this.qData[o + 1] = q.pos[1]; this.qData[o + 2] = q.pos[2]; this.qU32[o + 3] = q.skipOwner >>> 0; const b = q.b ?? q.pos; this.qData[o + 4] = b[0]; this.qData[o + 5] = b[1]; this.qData[o + 6] = b[2]; this.qU32[o + 7] = q.b ? 1 : 0; }
    this.device.queue.writeBuffer(this.queryBuf, 0, this.qData.buffer, 0, n * 32);
    this.countData[0] = n; writeWordsIfChanged(this.device, this.paramBuf, 0, this.countData, this.countSent);
    const pass = enc.beginComputePass({ label: 'probe', timestampWrites: ts });
    pass.setPipeline(this.pipe); pass.setBindGroup(0, sceneBG); pass.setBindGroup(1, this.bg);
    pass.dispatchWorkgroups(Math.ceil(n / 32)); pass.end();
    let rb = this.readbacks.pop();
    if (!rb) rb = this.device.createBuffer({ size: MAX_QUERIES * 16, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    enc.copyBufferToBuffer(this.resultBuf, 0, rb, 0, n * 16);
    this.inflight.push({ buf: rb, keys: this.pending.map(p => p.key) });
    if (this.tight) { if (this.answered.size > 1024) this.answered.clear(); this.serial++; for (const p of this.pending) this.answered.set(p.key, this.serial); this.tight = false; }
    this.pending.length = 0;
  }

  /** Call after queue.submit. */
  afterSubmit() {
    while (this.inflight.length > 3) { const x = this.inflight.shift()!; this.readbacks.push(x.buf); }
    const job = this.inflight.shift(); if (!job) return;
    job.buf.mapAsync(GPUMapMode.READ).then(() => {
      const f = new Float32Array(job.buf.getMappedRange().slice(0)); job.buf.unmap(); this.readbacks.push(job.buf);
      job.keys.forEach((k, i) => this.results.set(k, [f[i * 4], f[i * 4 + 1], f[i * 4 + 2]]));
    }).catch(() => { /* lost */ });
  }
}
