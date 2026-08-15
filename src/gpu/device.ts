// WebGPU device bootstrap + small helpers.
export interface Gpu {
  device: GPUDevice;
  adapterInfo: string;
  canvas: HTMLCanvasElement;
  ctx: GPUCanvasContext;
  format: GPUTextureFormat;
  hasTimestamps: boolean;
  linearSampler: GPUSampler;
  nearestSampler: GPUSampler;
}

export async function initGpu(canvas: HTMLCanvasElement): Promise<Gpu> {
  if (!('gpu' in navigator)) throw new Error('WebGPU not available (navigator.gpu missing). Use a current Chrome/Edge/Safari.');
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
  if (!adapter) throw new Error('No WebGPU adapter available.');
  const want: GPUFeatureName[] = ['timestamp-query', 'float32-filterable'];
  const feats = want.filter(f => adapter.features.has(f));
  const lim = adapter.limits;
  const device = await adapter.requestDevice({
    requiredFeatures: feats,
    requiredLimits: {
      maxStorageBufferBindingSize: Math.min(lim.maxStorageBufferBindingSize, 1 << 30),
      maxBufferSize: Math.min(lim.maxBufferSize, 1 << 30),
      maxComputeInvocationsPerWorkgroup: lim.maxComputeInvocationsPerWorkgroup,
      maxComputeWorkgroupSizeX: lim.maxComputeWorkgroupSizeX,
      maxStorageBuffersPerShaderStage: lim.maxStorageBuffersPerShaderStage,
      maxStorageTexturesPerShaderStage: lim.maxStorageTexturesPerShaderStage,
      maxSampledTexturesPerShaderStage: lim.maxSampledTexturesPerShaderStage,
      maxColorAttachmentBytesPerSample: lim.maxColorAttachmentBytesPerSample,
    },
  });
  device.lost.then(info => { console.error('WebGPU device lost:', info.message); showFatal('GPU device lost: ' + info.message); });
  device.addEventListener('uncapturederror', (ev) => { console.error('WebGPU error:', (ev as GPUUncapturedErrorEvent).error.message); });
  const ctx = canvas.getContext('webgpu') as GPUCanvasContext;
  const format = navigator.gpu.getPreferredCanvasFormat();
  ctx.configure({ device, format, alphaMode: 'opaque' });
  const info = adapter.info;
  return {
    device, canvas, ctx, format,
    adapterInfo: `${info.vendor} ${info.architecture} ${info.description}`.trim(),
    hasTimestamps: feats.includes('timestamp-query'),
    linearSampler: device.createSampler({ magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'nearest', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge', addressModeW: 'clamp-to-edge' }),
    nearestSampler: device.createSampler({ magFilter: 'nearest', minFilter: 'nearest' }),
  };
}

export function showFatal(msg: string) {
  const el = document.getElementById('fatal'); if (el) { el.style.display = 'flex'; el.textContent = msg; }
}

export function makeBuffer(device: GPUDevice, size: number, usage: GPUBufferUsageFlags, label?: string): GPUBuffer {
  return device.createBuffer({ size: Math.max(16, (size + 3) & ~3), usage, label });
}
export function makeBufferWithData(device: GPUDevice, data: ArrayBufferView, usage: GPUBufferUsageFlags, label?: string): GPUBuffer {
  const buf = device.createBuffer({ size: Math.max(16, (data.byteLength + 3) & ~3), usage: usage | GPUBufferUsage.COPY_DST, label });
  device.queue.writeBuffer(buf, 0, data.buffer, data.byteOffset, data.byteLength);
  return buf;
}
// ---- ASYNC PIPELINE CREATION (the boot path). A synchronous createComputePipeline() returns at once on the page's thread, but Chrome's GPU process then
// compiles the kernel (WGSL → MSL → the Metal compiler) on ITS main thread the moment the first submit needs it — the thread that also composites the
// browser's own UI. Ninety-odd kernels with the whole scene prelude on a cold shader cache froze all of Chrome for seconds on first load (the designer's
// 'big hang when loading the page for the first time'). The …Async() forms compile on the GPU process's worker threads and resolve when the pipeline is
// READY, so nothing that reaches a submit ever waits on a compiler and the browser stays live while the start card counts them in. Every module keeps its
// layouts / buffers / bind-group layouts in its (cheap, synchronous) constructor and creates its pipelines in an `async init()` through these two helpers.
// A creation that REJECTS (a compile / validation failure) is logged and falls back to the synchronous call — which hands back the same invalid object the
// old code got, so a broken optional kernel degrades to the validation errors it always produced instead of a dead boot.
/** counts pipelines requested / resolved through the helpers below since the last reset — the start card's 'compiling shaders k / N' line and window.__boot read it */
export const pipelineProgress = {
  total: 0, done: 0, failed: 0,
  /** called after every resolution (main.ts repaints the boot card's status line off it) */
  onChange: null as null | ((done: number, total: number, label: string) => void),
  reset() { this.total = 0; this.done = 0; this.failed = 0; },
};
function track<T>(label: string, p: Promise<T>): Promise<T> {
  const P = pipelineProgress; P.total++;
  return p.then(v => { P.done++; P.onChange?.(P.done, P.total, label); return v; });
}
/** createComputePipelineAsync with progress accounting; on rejection logs and returns the synchronous (invalid-but-usable-as-before) pipeline. (Promise.resolve round the call: the QA
 *  harness's Proxy device answers with a non-thenable stand-in, which then simply resolves.) */
export function computePipelineAsync(device: GPUDevice, desc: GPUComputePipelineDescriptor): Promise<GPUComputePipeline> {
  return track(desc.label ?? 'compute', Promise.resolve(device.createComputePipelineAsync(desc)).catch(e => { pipelineProgress.failed++; console.error(`[pipeline] ${desc.label ?? '?'}: ${e?.message ?? e}`); return device.createComputePipeline(desc); }));
}
/** createRenderPipelineAsync, likewise */
export function renderPipelineAsync(device: GPUDevice, desc: GPURenderPipelineDescriptor): Promise<GPURenderPipeline> {
  return track(desc.label ?? 'render', Promise.resolve(device.createRenderPipelineAsync(desc)).catch(e => { pipelineProgress.failed++; console.error(`[pipeline] ${desc.label ?? '?'}: ${e?.message ?? e}`); return device.createRenderPipeline(desc); }));
}

/** Compile a WGSL module; logs compile messages with line context. */
export function makeShader(device: GPUDevice, code: string, label: string): GPUShaderModule {
  const mod = device.createShaderModule({ code, label });
  mod.getCompilationInfo().then(info => {
    for (const m of info.messages) {
      const lines = code.split('\n'); const ctxLine = lines[m.lineNum - 1] ?? '';
      const s = `[WGSL ${m.type}] ${label}:${m.lineNum}:${m.linePos} ${m.message}\n  > ${ctxLine.trim()}`;
      if (m.type === 'error') console.error(s); else console.warn(s);
    }
  });
  return mod;
}
