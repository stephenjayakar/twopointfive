// GPU pass timing via timestamp queries (falls back to no-op when unsupported).
/** One pass's raw interval in the last resolved frame: ms from that frame's earliest timestamp (see GpuTimer.lastRaw / unionMs). */
export interface PassInterval { name: string; begin: number; end: number }
export class GpuTimer {
  private querySet: GPUQuerySet | null = null;
  private resolveBuf: GPUBuffer | null = null;
  private readBufs: GPUBuffer[] = [];
  private capacity = 64; // pairs
  private names: string[] = [];
  /** passes declared idle THIS frame (idle()): reported as an explicit 0 without a query slot */
  private idles: string[] = [];
  private pending: { buf: GPUBuffer; names: string[]; idles: string[] } [] = [];
  /** Smoothed ms per pass name. */
  results = new Map<string, number>();
  /** Unsmoothed ms per pass name of the last readback that resolved, and how many readbacks have resolved so far — for scripted measurement
   *  (tools/qa/perf-harness.js averages these over serialized frames instead of waiting for the EMA in `results` to settle). */
  lastFrame = new Map<string, number>(); resolved = 0;
  /** The raw begin/end of every stamped pass of that same readback, in ms from the frame's earliest stamp, in encode order. Passes are NOT serialized on
   *  the GPU: Metal runs independent compute passes concurrently when the queue is saturated (the `direct` pass beside the whole cascade chain is the
   *  normal state at play cadence — docs/internal/p0a-cascades.md), and a pass's end − begin then spans time the GPU spent mostly on another pass. So a
   *  SUM of per-pass durations (total(), lastFrame summed) double-counts overlapped spans — by 35–55 % of the frame at high / medium in the field —
   *  while unionMs() is the wall span the GPU was actually busy with the listed passes. Per-pass numbers stay what they are (fine for a pass measured
   *  with frames serialized; misleading for a small pass that straddled a big one). */
  lastRaw: PassInterval[] = [];
  /** the earliest tick (ns, device timeline) of the last resolved readback: a pair older than it in the NEXT readback was not written that frame */
  private lastBeginTick: bigint = 0n;
  private lastSeen = new Map<string, number>(); private frameNo = 0;
  enabled: boolean;

  constructor(private device: GPUDevice, enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) return;
    this.querySet = device.createQuerySet({ type: 'timestamp', count: this.capacity * 2 });
    this.resolveBuf = device.createBuffer({ size: this.capacity * 16, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC });
  }

  beginFrame() {
    this.names.length = 0; this.idles.length = 0; this.frameNo++;
    // forget passes that stopped running (a smoke solver gone idle, removed cascades, idle probes)
    for (const [k, f] of this.lastSeen) if (this.frameNo - f > 30) { this.lastSeen.delete(k); this.results.delete(k); }
  }

  /** Returns timestampWrites for a pass descriptor (or undefined when disabled/full). */
  pass(name: string): GPUComputePassTimestampWrites | undefined {
    if (!this.enabled || this.names.length >= this.capacity) return undefined;
    const i = this.names.length; this.names.push(name); this.lastSeen.set(name, this.frameNo);
    return { querySet: this.querySet!, beginningOfPassWriteIndex: i * 2, endOfPassWriteIndex: i * 2 + 1 };
  }
  /** Declare that `name` deliberately did no GPU work this frame (a cache resting on its off frame): it counts as having run, at an explicit 0 ms, so the
   *  smoothed `results` average the pass at the rate it really runs at. Do NOT open an empty timed pass for this instead: an empty compute pass never
   *  writes its timestamp pair, the slot keeps whatever ticks an earlier frame left there, and their difference reads as a plausible phantom cost (the
   *  half-rate cascades read at ~93 % of full rate that way until 08-10 — docs/internal/p0a-cascades.md §4). */
  idle(name: string) { if (!this.enabled) return; this.idles.push(name); this.lastSeen.set(name, this.frameNo); }

  /** Call after encoding all passes, before submit. */
  resolve(enc: GPUCommandEncoder) {
    if (!this.enabled || (this.names.length === 0 && this.idles.length === 0)) return;
    const n = this.names.length;
    let rb = this.readBufs.pop();
    if (!rb) rb = this.device.createBuffer({ size: this.capacity * 16, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    if (n > 0) { enc.resolveQuerySet(this.querySet!, 0, n * 2, this.resolveBuf!, 0); enc.copyBufferToBuffer(this.resolveBuf!, 0, rb, 0, n * 16); }
    this.pending.push({ buf: rb, names: this.names.slice(), idles: this.idles.slice() });
  }

  /** Call after submit. Maps the oldest pending readback asynchronously. */
  afterSubmit() {
    if (!this.enabled) return;
    while (this.pending.length > 2) { const p = this.pending.shift()!; this.readBufs.push(p.buf); }
    const p = this.pending.shift(); if (!p) return;
    p.buf.mapAsync(GPUMapMode.READ).then(() => {
      const t = new BigInt64Array(p.buf.getMappedRange().slice(0));
      p.buf.unmap(); this.readBufs.push(p.buf);
      const totals = new Map<string, number>(); const raw: PassInterval[] = [];
      // A pass that took a slot and then encoded nothing (or an empty pass) leaves the ticks of whatever earlier frame last used that slot. Command buffers
      // START in order (though frames may overlap on the GPU), so a pair that begins before the PREVIOUS frame's first stamp is at least two frames stale:
      // it cost nothing this frame and must not enter the timeline or set its origin. (One-frame-stale pairs cannot be told apart from a frame that
      // overlapped its predecessor — which is why resting passes declare idle() rather than open empty passes.)
      // A never-written slot resolves to zeros (the query set's initial state): the same nothing.
      const fence = this.lastBeginTick; let t0: bigint | null = null;
      const stale = (b: bigint, e: bigint) => b < fence || (b === 0n && e === 0n);
      for (let i = 0; i < p.names.length; i++) { const b = t[i * 2], e = t[i * 2 + 1]; if (e >= b && !stale(b, e) && (t0 === null || b < t0)) t0 = b; }
      if (t0 !== null) this.lastBeginTick = t0;
      for (let i = 0; i < p.names.length; i++) {
        const b = t[i * 2], e = t[i * 2 + 1];
        if (stale(b, e)) { totals.set(p.names[i], totals.get(p.names[i]) ?? 0); continue; }   // stale / never-written pair (see above): an explicit nothing this frame
        const ms = Number(e - b) / 1e6;
        if (ms < 0 || ms > 1000) continue;
        totals.set(p.names[i], (totals.get(p.names[i]) ?? 0) + ms);
        const begin = Number(b - t0!) / 1e6; raw.push({ name: p.names[i], begin, end: begin + ms });
      }
      for (const k of p.idles) if (!totals.has(k)) totals.set(k, 0);   // resting passes: an honest zero this frame
      for (const [k, v] of totals) this.results.set(k, (this.results.get(k) ?? v) * 0.9 + v * 0.1);
      for (const k of this.results.keys()) if (!totals.has(k) && this.frameNo - (this.lastSeen.get(k) ?? -99) > 1) this.results.set(k, this.results.get(k)! * 0.5);   // not in this readback and not stamped lately: fade out instead of freezing at the last busy value
      this.lastFrame = totals; this.lastRaw = raw; this.resolved++;
    }).catch(() => { /* device lost or unmapped */ });
  }

  /** was `name` stamped THIS frame? (a pass that keeps its slot's old timestamps — one skipped for having no work, e.g. particles with nothing alive after a
   *  settings toggle — must not report the last busy frame's cost until the 30-frame expiry: the HUD read a phantom 6.9 ms 'particles' that way, 08-10) */
  ranThisFrame(name: string): boolean { return this.lastSeen.get(name) === this.frameNo; }
  total(exclude: string[] = []): number { let s = 0; for (const [k, v] of this.results) if (!exclude.includes(k) && this.frameNo - (this.lastSeen.get(k) ?? -99) <= 1) s += v; return s; }
  /** GPU-busy wall span of the last resolved frame over the passes not in `exclude` (ms): the UNION of their raw intervals — what the frame really cost on
   *  the GPU, however the driver overlapped the passes (see lastRaw). Pass the render passes here as everywhere (their stamps span the drawable wait). */
  unionMs(exclude: string[] = []): number {
    const iv = this.lastRaw.filter(r => !exclude.includes(r.name)).map(r => [r.begin, r.end]).sort((a, b) => a[0] - b[0]);
    let total = 0, cs = 0, ce = -1;
    for (const [b, e] of iv) { if (ce < 0) { cs = b; ce = e; } else if (b <= ce) ce = Math.max(ce, e); else { total += ce - cs; cs = b; ce = e; } }
    return ce < 0 ? 0 : total + (ce - cs);
  }
  /** Σ of the last resolved frame's unsmoothed per-pass durations over the passes not in `exclude` — the number every total used to be; minus unionMs() =
   *  how much of it was double-counted overlap. */
  sumMs(exclude: string[] = []): number { let s = 0; for (const [k, v] of this.lastFrame) if (!exclude.includes(k)) s += v; return s; }
}
