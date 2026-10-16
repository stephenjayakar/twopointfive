// TableDevice — the GPUDevice stand-in a native host handed the CPU render classes (that host was removed 2026-10; tools/qa/boxupload/fuzz.ts still drives this): every labelled `createBuffer` BoxWorld / LightSet /
// CharacterRenderer / Decals make ('boxGeo' 'boxMat' 'visibleBoxes' 'sceneInfo' 'capsules' 'lights' 'lightReach' 'jointMats' 'charInsts' 'decals' 'gridCells' 'gridItems' …)
// IS a shared-memory TABLE of `bytes × ring` (ring 3 = the frames in flight + one; slot s at base + s·bytes), and `queue.writeBuffer` = a memcpy into the CURRENT slot. The
// memory comes from an injected PROVIDER — natively `tps_table(name, bytes, ring)`'s pointer wrapped ONCE with `toArrayBuffer` (bun:ffi); a test hands a
// plain ArrayBuffer — so this module is browser-neutral (no bun:ffi, no Metal, importable by the page and the QA harness).
//
// THE RING RULE + THE CATCH-UP (§2.2): the JS writes slot f % 3 while the GPU reads f−1 and f−2 (tps_frame_begin's semaphore guarantees a slot is reused only after its frame
// completed). Per-frame writes cover their whole range every frame, but SPARSE ones — boxMat's marking / glass-cell tails (boxes.ts:363, :391), lightReach, decals — land in
// one slot only, and a naive current-slot write leaves the other two stale. So every write is stamped {frame, off, len} on its table, and `beginFrame(f)` REPLAYS every range
// written in the last two frames from the slot it was written in into slot s (oldest first, so a range written twice lands newest) BEFORE the packers run. Invariant, asserted by
// At submit, slot s equals what a single-buffer design would hold. Ring-1 tables (the host's own, `ringFor`) skip all of it.
//
// Everything else a GPUDevice has (createShaderModule, createBindGroupLayout, createTexture …) is the harness's anything-Proxy (src/host/stub.ts fake) — the CPU classes build
// their (unused) pipelines and bind groups against it as they do headless; `asGpuDevice()` is the Proxy that puts the two together for `HostApi.device`.
import { fake } from './stub';

/** shared memory for a table: `bytes × ring` contiguous bytes (slot s at s·bytes), stable for the process life; null = refused (the native side: a size mismatch on a re-get) */
export type TableProvider = (name: string, bytes: number, ring: number) => ArrayBuffer | null;

/** one write, as the ring's catch-up replays it */
interface DirtyRange { frame: number; off: number; len: number; }

export class TableBuffer {
  /** the whole `bytes × ring` region and a byte view per slot */
  readonly slots: Uint8Array[] = [];
  /** the writes of the last frames (pruned at beginFrame) */
  dirty: DirtyRange[] = [];
  /** the slot the last write went to (informational) */
  lastSlot = 0;
  constructor(readonly label: string, readonly size: number, readonly ring: number, readonly base: ArrayBuffer, readonly usage: number, readonly shared: boolean) {
    for (let s = 0; s < ring; s++) this.slots.push(new Uint8Array(base, s * size, size));
  }
  /** GPUBuffer surface the CPU classes touch */
  destroy(): void { /* tables live for the process life (§1.2 memory ownership) */ }
  get mapState(): 'unmapped' { return 'unmapped'; }
  unmap(): void { /* never mapped */ }
  mapAsync(): Promise<void> { return new Promise(() => { /* never: readbacks are the host's (probeAnswers), not a table's */ }); }
  getMappedRange(): ArrayBuffer { throw new Error(`TableBuffer '${this.label}': tables are not mappable`); }
}

export interface TableDeviceOpts {
  /** slots per table (3 = two frames in flight + the one being written; the design's default) */
  ring?: number;
  /** ring override by label (1 for a host-internal table); absent = opts.ring */
  ringFor?: (label: string) => number;
  /** how many past frames the catch-up replays (2 = the ring's other two slots) */
  catchUp?: number;
}

export class TableDevice {
  readonly tables = new Map<string, TableBuffer>();
  /** the frame the host is writing and its slot (beginFrame sets both) */
  frame = 0; slot = 0;
  /** what the catch-up copied last beginFrame (bytes, ranges) — the harness's numbers */
  stats = { writes: 0, bytesWritten: 0, catchUpBytes: 0, catchUpRanges: 0, refused: 0 };
  private anon = 0;
  private readonly ring: number; private readonly catchUp: number;
  readonly queue: { writeBuffer(buffer: TableBuffer, bufferOffset: number, data: BufferSource, dataOffset?: number, size?: number): void; submit(): void; onSubmittedWorkDone(): Promise<void> };

  constructor(private readonly provider: TableProvider, opts: TableDeviceOpts = {}) {
    this.ring = Math.max(1, opts.ring ?? 3); this.catchUp = Math.max(0, opts.catchUp ?? 2);
    const ringFor = opts.ringFor;
    this.ringOf = (label) => Math.max(1, ringFor?.(label) ?? this.ring);
    this.queue = {
      writeBuffer: (buffer, bufferOffset, data, dataOffset = 0, size) => this.write(buffer, bufferOffset, data, dataOffset, size),
      submit: () => { /* nothing to submit: the frame is one command buffer the host encodes at tps_frame_submit */ },
      onSubmittedWorkDone: () => Promise.resolve(),
    };
  }
  private readonly ringOf: (label: string) => number;

  /** GPUDevice.createBuffer: a table per label (`bytes` rounded up to 16 as gpu/device.ts makeBuffer already does; a re-get with the same size returns the same table) */
  createBuffer(desc: { label?: string; size: number; usage?: number; mappedAtCreation?: boolean }): TableBuffer {
    if (desc.mappedAtCreation) throw new Error(`TableDevice: mappedAtCreation buffers are not tables ('${desc.label ?? ''}')`);
    const label = desc.label ?? `anon${this.anon++}`; const size = Math.max(16, (desc.size + 15) & ~15); const ring = this.ringOf(label);
    const had = this.tables.get(label);
    if (had && had.size === size && had.ring === ring) return had;
    let base = this.provider(label, size, ring), shared = true;
    if (!base) { this.stats.refused++; console.error(`TableDevice: the host refused table '${label}' (${size} B × ${ring}${had ? `; a table of ${had.size} B exists` : ''}) — a private buffer stands in: the native side will not see its bytes`); base = new ArrayBuffer(size * ring); shared = false; }
    const t = new TableBuffer(label, size, ring, base, desc.usage ?? 0, shared);
    this.tables.set(label, t);
    return t;
  }

  /** the memcpy into the CURRENT slot, WebGPU's writeBuffer semantics: for an ArrayBufferView dataOffset / size are in ELEMENTS of the view, for an ArrayBuffer in bytes */
  private write(buffer: TableBuffer, bufferOffset: number, data: BufferSource, dataOffset: number, size?: number): void {
    if (!(buffer instanceof TableBuffer)) return;   // (a write into something the anything-Proxy made — a readback / staging buffer of a class nobody dispatches natively: dropped, as headless)
    let src: Uint8Array;
    if (ArrayBuffer.isView(data)) {
      const el = (data as ArrayBufferView & { BYTES_PER_ELEMENT?: number }).BYTES_PER_ELEMENT ?? 1;
      const byteOff = data.byteOffset + dataOffset * el; const byteLen = size !== undefined ? size * el : data.byteLength - dataOffset * el;
      src = new Uint8Array(data.buffer, byteOff, byteLen);
    } else {
      const byteLen = size !== undefined ? size : data.byteLength - dataOffset;
      src = new Uint8Array(data, dataOffset, byteLen);
    }
    if (bufferOffset + src.byteLength > buffer.size) throw new Error(`TableDevice: write past the end of '${buffer.label}' (${bufferOffset} + ${src.byteLength} > ${buffer.size})`);
    const s = buffer.ring === 1 ? 0 : this.slot;
    buffer.slots[s].set(src, bufferOffset); buffer.lastSlot = s;
    if (buffer.ring > 1) buffer.dirty.push({ frame: this.frame, off: bufferOffset, len: src.byteLength });
    this.stats.writes++; this.stats.bytesWritten += src.byteLength;
  }

  /** the host acquired frame f's slot (tps_frame_begin): slot = f % ring, then the CATCH-UP — every range written in the last `catchUp` frames copied from its own slot into this
   *  one, oldest first, so a sparse write two frames ago is present here and a range written twice lands newest; ranges older than that are forgotten. Call BEFORE the packers. */
  beginFrame(frame: number): number {
    this.frame = frame; this.slot = frame % this.ring;
    this.stats.catchUpBytes = 0; this.stats.catchUpRanges = 0;
    const oldest = frame - this.catchUp;
    for (const t of this.tables.values()) {
      if (t.ring === 1 || !t.dirty.length) continue;
      const keep: DirtyRange[] = [];
      for (const r of t.dirty) if (r.frame >= oldest) keep.push(r);   // (this frame's own stamps stay too: a write made before the first beginFrame — a boot-time table — or a retried begin must still reach the other slots on the next two begins; a same-slot copy is skipped below)
      keep.sort((a, b) => a.frame - b.frame);   // (stable: writes of one frame stay in their order)
      const dst = t.slots[this.slot];
      for (const r of keep) {
        const from = t.slots[r.frame % t.ring]; if (from === dst) continue;   // (a ring shorter than the catch-up window: that frame's slot IS this one)
        dst.set(from.subarray(r.off, r.off + r.len), r.off); this.stats.catchUpBytes += r.len; this.stats.catchUpRanges++;
      }
      t.dirty = keep;
    }
    return this.slot;
  }

  /** the slot's bytes of a table (the host packs the frame descriptor's pointers / the harness checks the invariant) */
  view(label: string, slot = this.slot): Uint8Array | null { const t = this.tables.get(label); return t ? t.slots[t.ring === 1 ? 0 : slot] : null; }

  /** the GPUDevice the CPU render classes take: createBuffer + queue are this device's, everything else the anything-Proxy (pipelines and bind groups nobody dispatches) */
  asGpuDevice(): GPUDevice {
    const self = this; const rest = fake('device');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new Proxy(rest, { get(_t, p, r) { if (p === 'createBuffer') return (d: any) => self.createBuffer(d); if (p === 'queue') return self.queue; if (p === 'label') return 'TableDevice'; return Reflect.get(rest, p, r); } }) as unknown as GPUDevice;
  }
}
