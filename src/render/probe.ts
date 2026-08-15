// GPU irradiance queries with async readback (1–2 frames latency). Used for the stealth light meter.
import { makeBuffer, makeShader, computePipelineAsync } from '../gpu/device';
import { Vec3 } from '../math/vec';
import { scenePrelude } from './frame';
import lightingCommon from './shaders/lighting_common.wgsl' with { type: 'text' };
import probeSrc from './shaders/probe.wgsl' with { type: 'text' };

export const MAX_QUERIES = 32;

export class IrradianceProbe {
  private pipe!: GPUComputePipeline; private layout: GPUBindGroupLayout; private bg: GPUBindGroup | null = null; private bgDice: GPUTextureView | null = null;
  private mod: GPUShaderModule; private pipeLayout: GPUPipelineLayout;
  private queryBuf: GPUBuffer; private resultBuf: GPUBuffer; private paramBuf: GPUBuffer;
  private readbacks: GPUBuffer[] = []; private inflight: { buf: GPUBuffer; keys: string[] }[] = [];
  private qData = new Float32Array(MAX_QUERIES * 8); private qU32 = new Uint32Array(this.qData.buffer);
  private pending: { key: string; pos: Vec3; skipOwner: number; b?: Vec3 }[] = [];
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
  async init(): Promise<void> { this.pipe ??= await computePipelineAsync(this.device, { label: 'probe', layout: this.pipeLayout, compute: { module: this.mod, entryPoint: 'main' } }); }

  /** Queue a query for this frame. */
  query(key: string, pos: Vec3, skipOwner = 0) { if (this.pending.length < MAX_QUERIES) this.pending.push({ key, pos, skipOwner }); }
  /** Smoke transmittance along a→b (result[0] in 0..1). */
  querySegment(key: string, a: Vec3, b: Vec3) { if (this.pending.length < MAX_QUERIES) this.pending.push({ key, pos: a, skipOwner: 0, b }); }
  get(key: string): [number, number, number] | undefined { return this.results.get(key); }

  get hasPending() { return this.pending.length > 0; }
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
    this.countData[0] = n; this.device.queue.writeBuffer(this.paramBuf, 0, this.countData);
    const pass = enc.beginComputePass({ label: 'probe', timestampWrites: ts });
    pass.setPipeline(this.pipe); pass.setBindGroup(0, sceneBG); pass.setBindGroup(1, this.bg);
    pass.dispatchWorkgroups(Math.ceil(n / 32)); pass.end();
    let rb = this.readbacks.pop();
    if (!rb) rb = this.device.createBuffer({ size: MAX_QUERIES * 16, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    enc.copyBufferToBuffer(this.resultBuf, 0, rb, 0, n * 16);
    this.inflight.push({ buf: rb, keys: this.pending.map(p => p.key) });
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
