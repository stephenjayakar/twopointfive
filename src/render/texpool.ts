// Render-target recycling + the little kernels that make a recycled target as good as a fresh one (and a resized history as good as the old one).
//
// WHY (measured 08-11, M4 Max, high 1777×1000, serialized frames): a change of internal size — an adaptive-ladder step, a preset's cap, a gather / beam
// divisor flip — destroyed and re-created ~40 textures (~230 MB at high). The frame after paid +7…+20 ms of WALL time that no compute pass accounted for:
// fresh allocations plus the implementation's first-use clears of every one of them, wedged between the passes. And every screen-space temporal history
// (direct light per class + its depth, the indirect, the specular) restarted from nothing: one frame of raw estimates — a visible flash of noise. So:
//  * TexturePool: released targets are parked by (kind, format, size, usage) instead of destroyed; a size the ladder returns to (its scale lives on a 0.05
//    grid — ui/quality.ts SCALE_STEP — so there are only a handful per preset) gets its whole target set back for nothing. LRU-evicted past a byte budget.
//  * TargetOps: `blit16` / `nearest32f` resample an old history into its new-size successor (render/shaders/resample.wgsl), `clear` zeroes a parked target
//    whose stale contents could be read before they are rewritten. All in ONE compute pass per resize (passes.ts), a fraction of a millisecond.
// engine.settings.keepHistories (default on) is the switch: off = destroy + create + restart, byte for byte the old path (passes.ts / gbuffer.ts branch on it).
import { makeShader, computePipelineAsync } from '../gpu/device';
import resampleSrc from './shaders/resample.wgsl' with { type: 'text' };

const BPP: Partial<Record<GPUTextureFormat, number>> = { rgba16float: 8, rgba32float: 16, rgba32uint: 16, r32float: 4, r32uint: 4, rgba8unorm: 4, bgra8unorm: 4, rgb10a2unorm: 4, depth32float: 4, r16float: 2, rg16float: 4, r8unorm: 1, rg8unorm: 2 };
export interface Tex2DDesc { label: string; size: [number, number]; format: GPUTextureFormat; usage: GPUTextureUsageFlags }
const kindOf = (label: string) => label.replace(/\d+$/, '');   // 'directH01' → 'directH', 'bloomD3' → 'bloomD': a parked target only serves its own kind again (labels stay truthful in captures / error messages)
export const texBytes = (d: Tex2DDesc) => d.size[0] * d.size[1] * (BPP[d.format] ?? 8);

/** Size-keyed LRU pool of 2D textures. acquire() hands back a parked texture of the same kind / format / size / usage if there is one (reused: true — the
 *  caller decides whether its stale contents matter), else creates; release() parks; anything past `budget` bytes parked is destroyed oldest-first. */
export class TexturePool {
  private free = new Map<string, GPUTexture[]>();
  private lru: { key: string; tex: GPUTexture; bytes: number; t: number }[] = [];   // parked textures in release order, oldest first
  parkedBytes = 0;
  /** parked bytes allowed before eviction; passes.ts keeps it at ~2 × the LARGEST target set it has allocated (min 64 MB): room for the full-scale set plus a smaller one
   *  while the ladder sits below 1.0, whatever the current size (a budget that followed the current size evicted the full-scale set on the way down — the one set sure to be wanted
   *  back). At high on the reference pane that is ≤ ~400 MB parked, at verylow ≤ ~90 MB; nothing stays parked past maxAgeMs anyway. */
  budget = 64 << 20;
  /** parked textures older than this are destroyed by tick() (ms): a size not revisited within a minute and a half is not the ladder oscillating, and the memory is better returned */
  maxAgeMs = 90_000;
  stats = { hits: 0, misses: 0, evicted: 0, aged: 0, createdBytes: 0 };
  constructor(private device: GPUDevice) {}
  private key(d: Tex2DDesc) { return `${kindOf(d.label)}|${d.format}|${d.size[0]}x${d.size[1]}|${d.usage}`; }
  acquire(d: Tex2DDesc): { tex: GPUTexture; reused: boolean } {
    const key = this.key(d); const list = this.free.get(key);
    if (list && list.length) {
      const tex = list.pop()!; if (!list.length) this.free.delete(key);   // (an emptied size key goes too: the ladder walks dozens of sizes a session — review R1.3)
      const i = this.lru.findIndex(e => e.tex === tex); if (i >= 0) { this.parkedBytes -= this.lru[i].bytes; this.lru.splice(i, 1); }
      this.stats.hits++; return { tex, reused: true };
    }
    this.stats.misses++; this.stats.createdBytes += texBytes(d);
    return { tex: this.device.createTexture({ label: d.label, size: d.size, format: d.format, usage: d.usage }), reused: false };
  }
  release(tex: GPUTexture | null | undefined, d?: Tex2DDesc): void {
    if (!tex) return;
    const desc: Tex2DDesc = d ?? { label: tex.label, size: [tex.width, tex.height], format: tex.format, usage: tex.usage };
    const key = this.key(desc); const bytes = texBytes(desc);
    let list = this.free.get(key); if (!list) { list = []; this.free.set(key, list); }
    list.push(tex); this.lru.push({ key, tex, bytes, t: performance.now() }); this.parkedBytes += bytes;
    this.evict();
  }
  private destroyHead() { const e = this.lru.shift()!; const list = this.free.get(e.key); if (list) { const i = list.indexOf(e.tex); if (i >= 0) list.splice(i, 1); if (!list.length) this.free.delete(e.key); } this.parkedBytes -= e.bytes; e.tex.destroy(); }
  /** distinct (kind, format, size, usage) keys with something parked — never an empty list behind a key (probes / the pool proof read it) */
  get keyCount(): number { return this.free.size; }
  get parkedCount(): number { return this.lru.length; }
  /** destroy parked textures oldest-first until under budget (all of them with everything = true) */
  evict(everything = false): void { while (this.lru.length && (everything || this.parkedBytes > this.budget)) { this.destroyHead(); this.stats.evicted++; } }
  /** once a frame (engine.render): let go of anything parked longer than maxAgeMs */
  tick(now = performance.now()): void { while (this.lru.length && now - this.lru[0].t > this.maxAgeMs) { this.destroyHead(); this.stats.aged++; } }
  get summary(): string { return `pool: ${(this.parkedBytes / 1048576).toFixed(0)} MB parked in ${this.lru.length} targets / ${this.free.size} sizes (budget ${(this.budget / 1048576).toFixed(0)}) · ${this.stats.hits} hits ${this.stats.misses} misses · ${this.stats.evicted} evicted ${this.stats.aged} aged out`; }
}

/** The housekeeping kernels of resample.wgsl: encode into an open compute pass. */
export class TargetOps {
  private lBlit: GPUBindGroupLayout; private lNearest: GPUBindGroupLayout; private lNearestU: GPUBindGroupLayout; private lC16: GPUBindGroupLayout; private lC32f: GPUBindGroupLayout; private lC32u: GPUBindGroupLayout; private lC4x32u: GPUBindGroupLayout;
  private pBlit!: GPUComputePipeline; private pNearest!: GPUComputePipeline; private pNearestU!: GPUComputePipeline; private pC16!: GPUComputePipeline; private pC32f!: GPUComputePipeline; private pC32u!: GPUComputePipeline; private pC4x32u!: GPUComputePipeline;
  private mod: GPUShaderModule;
  constructor(private device: GPUDevice, private linSamp: GPUSampler) {
    const CS = GPUShaderStage.COMPUTE;
    const st = (format: GPUTextureFormat): GPUStorageTextureBindingLayout => ({ access: 'write-only', format, viewDimension: '2d' });
    this.lBlit = device.createBindGroupLayout({ label: 'resampleBlit', entries: [{ binding: 0, visibility: CS, texture: { sampleType: 'float', viewDimension: '2d' } }, { binding: 1, visibility: CS, sampler: { type: 'filtering' } }, { binding: 2, visibility: CS, storageTexture: st('rgba16float') }] });
    this.lNearest = device.createBindGroupLayout({ label: 'resampleNearest', entries: [{ binding: 0, visibility: CS, texture: { sampleType: 'unfilterable-float', viewDimension: '2d' } }, { binding: 4, visibility: CS, storageTexture: st('r32float') }] });
    this.lNearestU = device.createBindGroupLayout({ label: 'resampleNearestU', entries: [{ binding: 6, visibility: CS, texture: { sampleType: 'uint', viewDimension: '2d' } }, { binding: 5, visibility: CS, storageTexture: st('r32uint') }] });
    this.lC16 = device.createBindGroupLayout({ label: 'clear16', entries: [{ binding: 2, visibility: CS, storageTexture: st('rgba16float') }] });
    this.lC32f = device.createBindGroupLayout({ label: 'clear32f', entries: [{ binding: 4, visibility: CS, storageTexture: st('r32float') }] });
    this.lC32u = device.createBindGroupLayout({ label: 'clear32u', entries: [{ binding: 5, visibility: CS, storageTexture: st('r32uint') }] });
    this.lC4x32u = device.createBindGroupLayout({ label: 'clear4x32u', entries: [{ binding: 7, visibility: CS, storageTexture: st('rgba32uint') }] });
    this.mod = makeShader(device, resampleSrc, 'resample');
  }
  /** the seven kernels, compiled off the GPU process's main thread (gpu/device.ts computePipelineAsync) — passes.ts init awaits it before the first resize can need them */
  async init(): Promise<void> {
    const device = this.device, mod = this.mod;
    const mk = (label: string, layout: GPUBindGroupLayout, entryPoint: string) => computePipelineAsync(device, { label, layout: device.createPipelineLayout({ bindGroupLayouts: [layout] }), compute: { module: mod, entryPoint } });
    [this.pBlit, this.pNearest, this.pNearestU, this.pC16, this.pC32f, this.pC32u, this.pC4x32u] = await Promise.all([
      mk('resampleBlit16', this.lBlit, 'blit16'), mk('resampleNearest32f', this.lNearest, 'nearest32f'), mk('resampleNearest32u', this.lNearestU, 'nearest32u'),
      mk('clear16', this.lC16, 'clear16'), mk('clear32f', this.lC32f, 'clear32f'), mk('clear32u', this.lC32u, 'clear32u'), mk('clear4x32u', this.lC4x32u, 'clear4x32u') ]);
  }
  private wg(p: GPUComputePassEncoder, t: GPUTexture) { p.dispatchWorkgroups(Math.ceil(t.width / 8), Math.ceil(t.height / 8)); }
  /** dst (rgba16float, any size) ← bilinear(src) over the whole of both */
  blit16(p: GPUComputePassEncoder, src: GPUTexture, dst: GPUTexture): void {
    p.setPipeline(this.pBlit); p.setBindGroup(0, this.device.createBindGroup({ layout: this.lBlit, entries: [{ binding: 0, resource: src.createView() }, { binding: 1, resource: this.linSamp }, { binding: 2, resource: dst.createView() }] })); this.wg(p, dst);
  }
  /** dst (r32float, any size) ← nearest(src) */
  nearest32f(p: GPUComputePassEncoder, src: GPUTexture, dst: GPUTexture): void {
    p.setPipeline(this.pNearest); p.setBindGroup(0, this.device.createBindGroup({ layout: this.lNearest, entries: [{ binding: 0, resource: src.createView() }, { binding: 4, resource: dst.createView() }] })); this.wg(p, dst);
  }
  /** dst (r32uint, any size) ← nearest(src) — the v3 denoiser's packed depth | history-length texels */
  nearest32u(p: GPUComputePassEncoder, src: GPUTexture, dst: GPUTexture): void {
    p.setPipeline(this.pNearestU); p.setBindGroup(0, this.device.createBindGroup({ layout: this.lNearestU, entries: [{ binding: 6, resource: src.createView() }, { binding: 5, resource: dst.createView() }] })); this.wg(p, dst);
  }
  /** zero a storage texture (rgba16float / r32float / r32uint / rgba32uint; anything else is left alone — render attachments are cleared by their own passes) */
  clear(p: GPUComputePassEncoder, t: GPUTexture): boolean {
    if (t.format === 'rgba16float') { p.setPipeline(this.pC16); p.setBindGroup(0, this.device.createBindGroup({ layout: this.lC16, entries: [{ binding: 2, resource: t.createView() }] })); }
    else if (t.format === 'r32float') { p.setPipeline(this.pC32f); p.setBindGroup(0, this.device.createBindGroup({ layout: this.lC32f, entries: [{ binding: 4, resource: t.createView() }] })); }
    else if (t.format === 'r32uint') { p.setPipeline(this.pC32u); p.setBindGroup(0, this.device.createBindGroup({ layout: this.lC32u, entries: [{ binding: 5, resource: t.createView() }] })); }
    else if (t.format === 'rgba32uint') { p.setPipeline(this.pC4x32u); p.setBindGroup(0, this.device.createBindGroup({ layout: this.lC4x32u, entries: [{ binding: 7, resource: t.createView() }] })); }
    else return false;
    this.wg(p, t); return true;
  }
}
