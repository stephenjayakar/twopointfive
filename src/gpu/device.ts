// WebGPU device bootstrap + small helpers.
import { shaderText } from './wgslTrim';
export interface Gpu {
  device: GPUDevice;
  adapterInfo: string;
  /** the adapter is the browser's software fallback: no GPU does the work (absent where the browser does not say) */
  adapterFallback?: boolean;
  canvas: HTMLCanvasElement;
  ctx: GPUCanvasContext;
  format: GPUTextureFormat;
  /** the canvas's texture may be sampled by a pass (initGpu `canvasRead`) */
  canvasRead?: boolean;
  hasTimestamps: boolean;
  linearSampler: GPUSampler;
}

// ---- A LOST DEVICE. The browser takes a page's device away in two very different ways. One is the page's own end: a load to another address, a closed tab, the
// Team & kit picture's window dropped — the device is 'destroyed' (Chrome: 'A valid external Instance reference no longer exists.') and nothing is wrong. The other is
// a real loss: the driver fell over, the GPU was reset or switched, the GPU process died. The first used to put the red card up on a page that was already leaving
// (and print an error for every kit picture closed); the second put the same card up and left it there, though a fresh load of the page is all it takes. Now: the
// first says nothing; the second loads the page again ONCE, and the card goes up — with the adapter, the browser's reason and how far the boot had got on it, so a
// report of it can be read — for a second loss inside a minute, or for a third in this tab however far apart (a machine that loses the device every load must reach
// the card, not load for ever). `?gpuretry=0` = the card at once for either, as it was.
export const GPU_LOST = { on: true, /** a second loss this soon after a retry is the card's */ windowMs: 60_000, /** retries a tab gets before every loss is the card's */ tries: 2, key: 'twopointsix.gpuLost' };
try { if (new URLSearchParams(location.search).get('gpuretry') === '0') GPU_LOST.on = false; } catch { /* no page (the harness) */ }
/** what the card says beside the browser's message: the adapter (initGpu), and where the boot stood (main.ts keeps `stage` up to date; '' once the game is up) */
export const gpuStory = { adapter: '', stage: '' };
let leaving = false;
try { addEventListener('pagehide', () => { leaving = true; }); addEventListener('beforeunload', () => { leaving = true; }); addEventListener('pageshow', () => { leaving = false; }); } catch { /* no page */ }   // (pageshow: a page handed back as it was, or a leave that was called off, is not leaving)
export type LostAct = 'quiet' | 'reload' | 'card';
/** what a lost device asks for: `reason` as the browser gave it, `leaving` = the page is on its way out, `last` = when this tab last retried (ms, null = never),
 *  `tries` = how many retries this tab has made */
export function lostAct(reason: string | undefined, leaving: boolean, last: number | null, now: number, retry: boolean, on = GPU_LOST.on, tries = last === null ? 0 : 1): LostAct {
  if (!on) return 'card';
  if (leaving || reason === 'destroyed') return 'quiet';
  return retry && tries < GPU_LOST.tries && (last === null || now - last >= GPU_LOST.windowMs) ? 'reload' : 'card';
}
/** the card's words for a loss: the browser's message, then one line of what this page knows (`retried` = retries this tab made before it) */
export function lostWords(message: string, reason: string | undefined, retried: number | boolean): string {
  const n = Number(retried);
  const more = [gpuStory.adapter, reason ? `reason: ${reason}` : '', gpuStory.stage, n > 1 ? `the page was loaded again ${n} times already` : n ? 'the page was loaded again once already' : ''].filter(Boolean).join(' · ');
  return `GPU device lost: ${message}${more ? `\n${more}` : ''}`;
}
function onLost(info: GPUDeviceLostInfo, retry: boolean) {
  // the tab's retries so far: 'count:when'
  let last: number | null = null, tries = 0;
  try { const [n, t] = (sessionStorage.getItem(GPU_LOST.key) ?? '').split(':').map(Number); if (n > 0 && t > 0) { tries = n; last = t; } } catch { /* no store: no retry is remembered, so none is made */ retry = false; }
  const act = lostAct(info.reason, leaving, last, Date.now(), retry, GPU_LOST.on, tries);
  if (act === 'quiet') { console.info(`WebGPU device gone (${info.reason ?? 'no reason given'}): ${info.message}`); return; }
  console.error('WebGPU device lost:', info.message);
  if (act === 'reload') { try { sessionStorage.setItem(GPU_LOST.key, `${tries + 1}:${Date.now()}`); location.reload(); return; } catch { /* the card instead */ } }
  showFatal(GPU_LOST.on ? lostWords(info.message, info.reason, retry ? tries : 0) : 'GPU device lost: ' + info.message);
}

/** `retry`: a real loss of the device loads the page again once before the card goes up (the game page asks for it; a tool page with work in it does not).
 *  `canvasRead`: the canvas's own texture may be SAMPLED by a pass as well as drawn into (render/savepic.ts boxes a frame down to a save's picture on the GPU);
 *  not asked = the canvas configured exactly as it always was. */
export async function initGpu(canvas: HTMLCanvasElement, opts: { retry?: boolean; canvasRead?: boolean } = {}): Promise<Gpu> {
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
  if (PIPE_QUEUE.on) installPipeQueue(device);
  device.lost.then(info => onLost(info, !!opts.retry));
  device.addEventListener('uncapturederror', (ev) => { console.error('WebGPU error:', (ev as GPUUncapturedErrorEvent).error.message); });
  const ctx = canvas.getContext('webgpu') as GPUCanvasContext;
  const format = navigator.gpu.getPreferredCanvasFormat();
  ctx.configure({ device, format, alphaMode: 'opaque', ...(opts.canvasRead ? { usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING } : {}) });
  const info = adapter.info;
  gpuStory.adapter = `${info.vendor} ${info.architecture} ${info.description}`.trim();
  return {
    device, canvas, ctx, format, canvasRead: !!opts.canvasRead,
    adapterInfo: gpuStory.adapter,
    adapterFallback: (info as { isFallbackAdapter?: boolean }).isFallbackAdapter === true,
    hasTimestamps: feats.includes('timestamp-query'),
    linearSampler: device.createSampler({ magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'nearest', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge', addressModeW: 'clamp-to-edge' }),
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
/** queue.writeBuffer(buf, offset, now's first `words` words) — unless `sent`, the caller's own record of what that range of the buffer holds word for word, already says so
 *  (then nothing is issued; true = it wrote). Only for a range NOTHING else writes, the GPU included, on a buffer that is never re-made under the record: a fresh buffer is all
 *  zeros and so is a fresh record. Words are compared as bits (a float's NaN or −0 is just a pattern). */
export function writeWordsIfChanged(device: GPUDevice, buf: GPUBuffer, offset: number, now: Uint32Array, sent: Uint32Array, words = now.length): boolean {
  let w = 0; while (w < words && now[w] === sent[w]) w++;
  if (w === words) return false;
  device.queue.writeBuffer(buf, offset, now.buffer, now.byteOffset, words * 4);
  for (; w < words; w++) sent[w] = now[w];
  return true;
}
// ---- ASYNC PIPELINE CREATION (the boot path). A synchronous createComputePipeline() returns at once on the page's thread, but Chrome's GPU process then
// compiles the kernel (WGSL → MSL → the Metal compiler) on ITS main thread the moment the first submit needs it — the thread that also composites the
// browser's own UI. Ninety-odd kernels with the whole scene prelude on a cold shader cache froze all of Chrome for seconds on first load (the maintainer's
// 'big hang when loading the page for the first time'). The …Async() forms compile on the GPU process's worker threads and resolve when the pipeline is
// READY, so nothing that reaches a submit ever waits on a compiler and the browser stays live while the start card counts them in. Every module keeps its
// layouts / buffers / bind-group layouts in its (cheap, synchronous) constructor and creates its pipelines in an `async init()` through these two helpers.
// A creation that REJECTS (a compile / validation failure) is logged and falls back to the synchronous call — which hands back the same invalid object the
// old code got, so a broken optional kernel degrades to the validation errors it always produced instead of a dead boot.
/** counts pipelines requested / resolved through the helpers below since the last reset — the start card's 'compiling shaders k / N' line and window.__boot read it */
export const pipelineProgress = {
  total: 0, done: 0, failed: 0,
  /** per pipeline, ms from the request to the pipeline being ready (all are in flight at once: a time includes the wait behind the others) — the boot line's and the benchmark's 'slowest' */
  times: [] as { label: string; ms: number }[],
  /** called after every resolution (main.ts repaints the boot card's status line off it) */
  onChange: null as null | ((done: number, total: number, label: string) => void),
  reset() { this.total = 0; this.done = 0; this.failed = 0; this.times.length = 0; },
};
function track<T>(label: string, p: Promise<T>): Promise<T> {
  const P = pipelineProgress; P.total++; const t = typeof performance !== 'undefined' ? performance.now() : 0;
  return p.then(v => { P.done++; if (P.times.length < 512 && typeof performance !== 'undefined') P.times.push({ label, ms: performance.now() - t }); P.onChange?.(P.done, P.total, label); return v; });
}
// ---- THE COMPILE QUEUE (2026-10-26, measured on a Windows machine: RTX 3080, Ryzen 3700X, Chrome 155, D3D12 + DXC). Chrome compiles every …Async pipeline on ONE pool
// of worker threads in its GPU process (15 workers on 16 hardware threads), and that pool is SHARED with Chrome's own drawing of the page: Skia Graphite rasterizes the
// HTML (the HUD, the cards, the menus) through Dawn and makes its little pipelines on the same workers. On D3D12 a big kernel of ours is a DXC compile of 5–25 s (the
// gathers, the march, the composites: everything in them is inlined into one function), so a burst of twenty of them holds every worker for that long — and Graphite's
// pipelines, asked for while the burst runs, wait behind it. The page then cannot be drawn at all: the trace of a played floor showed the raster's flush blocked 3–7 s at a
// time while the second (cut-box) set compiled after the boot, the picture frozen with it (15 s in one take). Metal compiles in a fraction of that, so the burst never
// starved anything on a Mac. So every …Async creation goes through this queue: at most `boot` in flight while the start card counts the boot's pipelines in (biggest module
// first, so the slowest compiles are not the last to start), and after the boot (`pipeQueue.settle()`, main.ts) at most `after` in flight, of which at most `low` are the
// background set's (modules compiled behind the cut prelude: `const CUT_BOXES: bool = true;`) — first come first served among the rest, so a pass's first-use pipeline
// is not stuck behind twenty background twins. A switch of the page, not a rule of the game (no knob, no FROZEN_HOLDS row: every stand compiles the same programs, only
// in a different order); `?pipequeue=0` = every creation straight to the browser, as it was.
export const PIPE_QUEUE = { on: true, /** in flight while the boot's count is open (0 = the machine's threads less two, at least 4) */ boot: 0, /** in flight after the boot */ after: 4, /** …of which background (cut-set) compiles */ low: 2,
  /** LATER (2026-10-26): the twins no first frame draws with the default settings (laterPipelineAsync below) are left out of the boot and compiled after it in the background lane; false = the boot waits for them too (`?pipelater=0`) */ later: true };
try { const q = new URLSearchParams(location.search); const v = q.get('pipequeue'); if (v === '0') PIPE_QUEUE.on = false; else if (v && /^\d+$/.test(v)) PIPE_QUEUE.boot = +v; if (q.get('pipelater') === '0') PIPE_QUEUE.later = false; } catch { /* no page (the harness) */ }
interface PipeJob { cost: number; low: boolean; later: boolean; seq: number; go: () => void }
/** the descriptors laterPipelineAsync handed the browser: the queue keeps them out of the boot and puts them in the background lane after it */
const laterDescs = new WeakSet<object>();
/** the queue's state (window.__pipeQueue on the page: in flight, waiting, the phase, the most that ever waited) */
export const pipeQueue = {
  phase: 'boot' as 'boot' | 'after', inflight: 0, inflightLow: 0, waiting: [] as PipeJob[], maxWaiting: 0, seq: 0,
  limit(): number { return this.phase === 'boot' ? (PIPE_QUEUE.boot || Math.max(4, ((typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 8) - 2)) : PIPE_QUEUE.after; },
  /** the boot's pipelines are in: from here at most `after` in flight, `low` of them background */
  settle() { this.phase = 'after'; this.pump(); },
  pump() {
    while (this.waiting.length && this.inflight < this.limit()) {
      let pick = -1;
      for (let i = 0; i < this.waiting.length; i++) {
        const j = this.waiting[i];
        if (j.later && this.phase === 'boot' && (this.inflight > 0 || this.waiting.some(w => !w.later))) continue;   // (a LATER twin never takes a worker from the boot's own pipelines: before settle() only once they are all done — a page that never settles still gets it)
        if (j.low && this.phase === 'after' && this.inflightLow >= PIPE_QUEUE.low) continue;
        if (pick < 0) { pick = i; continue; }
        const p = this.waiting[pick];
        const better = this.phase === 'boot' ? j.cost > p.cost : (p.low && !j.low) || (p.low === j.low && j.seq < p.seq);   // boot: biggest first · after: the foreground first, then in order
        if (better) pick = i;
      }
      if (pick < 0) return;
      const job = this.waiting.splice(pick, 1)[0]; this.inflight++; if (job.low) this.inflightLow++; job.go();
    }
  },
};
function installPipeQueue(device: GPUDevice) {
  const D = device as unknown as Record<string, unknown>;
  const meta = new WeakMap<GPUShaderModule, { cost: number; low: boolean }>();
  const csm = device.createShaderModule.bind(device);
  D.createShaderModule = (desc: GPUShaderModuleDescriptor) => { const m = csm(desc); meta.set(m, { cost: desc.code.length, low: desc.code.includes('const CUT_BOXES: bool = true;') }); return m; };
  const of = (mods: (GPUShaderModule | undefined)[]) => { let cost = 0, low = false; for (const m of new Set(mods)) { const x = m && meta.get(m); if (x) { cost += x.cost; low ||= x.low; } } return { cost, low }; };
  const queued = <T,>(mods: (GPUShaderModule | undefined)[], make: () => Promise<T>, later = false): Promise<T> => new Promise<T>((resolve, reject) => {
    const { cost, low } = of(mods); const Q = pipeQueue;
    const job: PipeJob = { cost, low: low || later, later, seq: Q.seq++, go: () => {
      let p: Promise<T>; try { p = make(); } catch (e) { p = Promise.reject(e); }
      p.then(resolve, reject).finally(() => { Q.inflight--; if (job.low) Q.inflightLow--; Q.pump(); });
    } };
    Q.waiting.push(job); Q.maxWaiting = Math.max(Q.maxWaiting, Q.waiting.length);
    queueMicrotask(() => Q.pump());   // (a burst made in one task is all queued before the first pick: the biggest of it starts first)
  });
  const cpa = device.createComputePipelineAsync.bind(device), rpa = device.createRenderPipelineAsync.bind(device);
  D.createComputePipelineAsync = (desc: GPUComputePipelineDescriptor) => queued([desc.compute.module], () => cpa(desc), laterDescs.has(desc));
  D.createRenderPipelineAsync = (desc: GPURenderPipelineDescriptor) => queued([desc.vertex.module, desc.fragment?.module], () => rpa(desc), laterDescs.has(desc));
  try { (window as unknown as Record<string, unknown>).__pipeQueue = pipeQueue; } catch { /* no page */ }
}

/** createComputePipelineAsync with progress accounting; on rejection logs and returns the synchronous (invalid-but-usable-as-before) pipeline. (Promise.resolve round the call: the QA
 *  harness's Proxy device answers with a non-thenable stand-in, which then simply resolves.) */
export function computePipelineAsync(device: GPUDevice, desc: GPUComputePipelineDescriptor): Promise<GPUComputePipeline> {
  return track(desc.label ?? 'compute', Promise.resolve(device.createComputePipelineAsync(desc)).catch(e => { pipelineProgress.failed++; console.error(`[pipeline] ${desc.label ?? '?'}: ${e?.message ?? e}`); return device.createComputePipeline(desc); }));
}
/** A pipeline the boot does NOT wait for (PIPE_QUEUE.later): a twin that no first frame draws with the default settings and whose pass has a fallback until it is in (render/passes.ts
 *  traceJobs says which and why). Not counted on the start card; the queue holds it until the boot's count is frozen and then compiles it in the background lane. On rejection,
 *  likewise logged, and the synchronous (invalid) pipeline. */
export function laterPipelineAsync(device: GPUDevice, desc: GPUComputePipelineDescriptor): Promise<GPUComputePipeline> {
  laterDescs.add(desc);
  return Promise.resolve(device.createComputePipelineAsync(desc)).catch(e => { console.error(`[pipeline] ${desc.label ?? '?'}: ${e?.message ?? e}`); return device.createComputePipeline(desc); });
}
/** laterPipelineAsync's render twin */
export function laterRenderPipelineAsync(device: GPUDevice, desc: GPURenderPipelineDescriptor): Promise<GPURenderPipeline> {
  laterDescs.add(desc);
  return Promise.resolve(device.createRenderPipelineAsync(desc)).catch(e => { console.error(`[pipeline] ${desc.label ?? '?'}: ${e?.message ?? e}`); return device.createRenderPipeline(desc); });
}
/** createRenderPipelineAsync, likewise */
export function renderPipelineAsync(device: GPUDevice, desc: GPURenderPipelineDescriptor): Promise<GPURenderPipeline> {
  return track(desc.label ?? 'render', Promise.resolve(device.createRenderPipelineAsync(desc)).catch(e => { pipelineProgress.failed++; console.error(`[pipeline] ${desc.label ?? '?'}: ${e?.message ?? e}`); return device.createRenderPipeline(desc); }));
}

/** createRenderPipelineAsync for a pipeline the caller can do WITHOUT: counted like the others, but a rejection hands back null (never the invalid synchronous pipeline) so the
 *  caller can tell that THIS one failed and fall back — `orElse` words the fallback on the one console line */
export function renderPipelineOrNull(device: GPUDevice, desc: GPURenderPipelineDescriptor, orElse = 'left out'): Promise<GPURenderPipeline | null> {
  return track(desc.label ?? 'render', Promise.resolve<GPURenderPipeline | null>(device.createRenderPipelineAsync(desc)).catch(e => { pipelineProgress.failed++; console.error(`[pipeline] ${desc.label ?? '?'}: ${e?.message ?? e} — ${orElse}`); return null; }));
}

/** Compile a WGSL module; logs compile messages with line context. */
export function makeShader(device: GPUDevice, source: string, label: string): GPUShaderModule {
  const code = shaderText(source);   // (cut to what its entry points reach — gpu/wgslTrim.ts; a message's line is a line of THIS text, printed below it)
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
