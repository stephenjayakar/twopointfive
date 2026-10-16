// THE KEEPER: one page visit's tape written out as it is played (kept.ts has the format, keepstore.ts the store). Every `KEEP.secs` the page calls beat(): what the
// replay ring and the run tape gained since the last beat is taken as a piece (game/replaybuf.ts since() — a few slices, asked between two steps), made a line of
// JSON, gzipped and put in the store; flush() does the same at once and without the gzip, for a page that is going away. Nothing is asked of the player and
// nothing is sent anywhere. A visit is filed only once it has been PLAYED (`played()`: the game has stepped in the player's hands — a title page left running its
// attract reel keeps nothing); from then on every piece is, the reel included.
// The keeper only reads its source. No game code is imported: the source is the buffer's two methods, the head a callback.
import type { KeptPiece, KeptHead } from './kept';
import { headLine, pieceLine } from './kept';
import type { KeptStore, KeptRow, Body } from './keepstore';
import { KEEP, gzip, pruneKept, keepBudget } from './keepstore';

export interface KeepSource { since(): KeptPiece | null; }
export interface KeeperOpts {
  sid: string; store: KeptStore;
  /** the game has been stepped in the player's hands (not a show's) */
  played: () => boolean;
  head: () => KeptHead;
  now?: () => string; gz?: ((text: string) => Promise<Blob>) | null;
  /** bytes of kept tapes allowed (default: keepstore.ts keepBudget) */
  budget?: () => Promise<number>;
  /** a word for the player: said once when keeping stops */
  say?: (text: string) => void;
}

/** the head is made again (the floor's drawing, the switches) once in this many pieces */
const HEAD_EVERY = 6;

export class ReplayKeeper {
  readonly sid: string;
  /** why keeping stopped ('' = it has not) */
  broke = '';
  readonly stats = { pieces: 0, bytes: 0, failed: 0, let: 0, beats: 0, ms: 0, worstMs: 0, again: 0 };
  private row: KeptRow; private seq = 0; private headKey = ''; private started = false;
  private r0 = NaN; private rN = 0;
  private q: Promise<void> = Promise.resolve(); private fails = 0;
  /** bytes of every kept visit as last counted, and the room there is */
  private total = -1; private max = Infinity;
  private now: () => string; private gz: ((text: string) => Promise<Blob>) | null;
  constructor(private src: KeepSource, private o: KeeperOpts) {
    this.sid = o.sid; this.now = o.now ?? (() => new Date().toISOString()); this.gz = o.gz === undefined ? gzip : o.gz;
    const at = this.now(); this.row = { sid: o.sid, startedAt: at, lastAt: at, scenario: '', url: '', seconds: 0, pieces: 0, bytes: 0 };
  }
  get filed(): KeptRow { return { ...this.row }; }
  /** every write asked for so far has settled */
  idle(): Promise<void> { return this.q; }

  /** one beat: the piece since the last, on its way to the store. `sync`: put as it stands, now (the page is going away: no time to gzip) */
  beat(sync = false): void {
    if (this.broke) return;
    if (!sync && this.gone) this.back();   // (the page's own timer is running: it is alive)
    if (!this.started) { if (!this.o.played()) return; this.started = true; }
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    let text: string, head: string | undefined; const seq = this.seq;
    try {
      const P = this.src.since(); if (!P) { if (sync) this.drain(true); return; }
      const at = this.now();
      // (the head is the floor's whole drawing: made and held against the last one on the first piece, every HEAD_EVERY-th after and as the page goes — the LAST one stands)
      if (!this.headKey || sync || seq % HEAD_EVERY === 0) {
        const H = this.o.head(), key = JSON.stringify(H);
        if (key !== this.headKey) { this.headKey = key; head = headLine(this.sid, at, H); }
        this.row.scenario = H.level.scenario ?? H.level.file ?? ''; this.row.url = H.url ?? ''; if (H.commit) this.row.commit = H.commit;
      }
      text = pieceLine(this.sid, seq, at, P);
      const S = P.samples; if (S.length) { if (Number.isNaN(this.r0)) this.r0 = S[0].r; this.rN = S[S.length - 1].r; }
      this.row.lastAt = at; this.row.seconds = Number.isNaN(this.r0) ? 0 : Math.round((this.rN - this.r0) * 10) / 10;
    } catch (e) { this.stop(`the tape could not be read (${String((e as Error)?.message ?? e)})`); return; }
    this.seq = seq + 1; this.stats.beats++;
    if (t0) { const ms = performance.now() - t0; this.stats.ms += ms; if (ms > this.stats.worstMs) this.stats.worstMs = ms; }
    if (sync || !this.gz) {   // (the puts are ASKED now, in this turn of the page — and first every earlier piece still waiting on its gzip, as it stands)
      const ps = this.drain(sync); ps.push(this.write(seq, text, head, sync)); this.q = this.q.then(() => Promise.all(ps).then(() => {}));
    } else {
      const gz = this.gz; this.pend.set(seq, { text, head });
      this.q = this.q.then(async () => {
        if (!this.pend.has(seq)) return;
        let body: Body = text; try { body = await gz(text); } catch { /* kept as text */ }
        if (this.pend.delete(seq)) await this.write(seq, body, head);   // (false: a flush wrote it as text while it was being packed)
      });
    }
  }
  /** pieces taken from the source whose put has not been asked yet (their gzip is running, or waits its turn) */
  private pend = new Map<number, { text: string; head: string | undefined }>();
  /** every piece still waiting on its gzip is put as it stands, now (their puts asked in this turn of the page) */
  private drain(going = false): Promise<void>[] {
    const ps: Promise<void>[] = [];
    for (const [q, w] of [...this.pend].sort((x, y) => x[0] - y[0])) { this.pend.delete(q); ps.push(this.write(q, w.text, w.head, going)); }
    if (ps.length) this.q = this.q.then(() => Promise.all(ps).then(() => {}));
    return ps;
  }
  /** the page is going away, or somebody wants the store current: what there is, now */
  flush(): Promise<void> { this.beat(true); return this.q; }
  /** THE PAGE IS GOING (pagehide): what there is, now, and the visit is marked as left — the list of replays opened a moment later reads it as a finished run,
   *  not as 'being played' for the WRITING_MS a silent page is given. A visit with nothing filed gets no mark. */
  leave(): Promise<void> {
    if (this.broke) return this.q;
    this.beat(true);
    if (this.row.pieces > 0 && !this.broke) { this.gone = true; this.mark(true); }
    return this.q;
  }
  /** …and it is alive after all (the browser brought it back, its tab is in front again, or its timer beats): the mark comes off — and IF THE VISIT WAS
   *  REMOVED WHILE THE PAGE WAS AWAY (the list's ✕ takes a visit its page has left; a full disk lets one go) it starts again from here: the floor's drawing
   *  goes with the next piece and the row counts from nothing, so what is filed from now on is a tape that reads (its front marked missing), not pieces
   *  with no start */
  back(): void {
    if (this.gone) { this.gone = false; this.mark(false); }
    if (this.broke || !this.seq) return;
    const S = this.o.store, sid = this.sid;
    this.q = this.q.then(async () => {   // (asked once every write before it has settled: a piece still on its way is not a visit removed)
      try { if ((await S.head(sid)) !== null || (await S.rows()).some(r => r.sid === sid)) return; } catch { return; }
      this.headKey = ''; this.row.bytes = 0; this.r0 = NaN; this.total = -1; this.stats.again++; });
  }
  private gone = false;
  private mark(gone: boolean): void {
    let p: Promise<unknown>; try { p = this.o.store.left(this.sid, gone); } catch { p = Promise.resolve(); }
    const done = p.then(() => {}, () => {}); this.q = this.q.then(() => done);
  }

  /** `going` = the page is leaving: the store's `putNow`, where it has one (nothing read back before the write) */
  private async write(seq: number, body: Body, head: string | undefined, going = false): Promise<void> {
    if (this.broke) return;
    const len = typeof body === 'string' ? body.length : body.size;
    this.row.pieces = Math.max(this.row.pieces, seq + 1); this.row.bytes += len;
    const S = this.o.store;
    let ok = await (going && S.putNow ? S.putNow({ ...this.row }, seq, body, head) : S.put({ ...this.row }, seq, body, head));
    if (!ok) {   // (a full disk: the oldest tapes make room, and the piece is tried once more)
      this.stats.failed++;
      try { const out = await pruneKept(this.o.store, Math.max(0, (await this.room()) * 0.5), this.sid); this.stats.let += out.length; this.total = -1; } catch { /* */ }
      ok = await this.o.store.put({ ...this.row }, seq, body, head);
    }
    if (!ok) { this.row.bytes -= len; if (head !== undefined) this.headKey = '';   // (the head goes again with the next piece)
      if (++this.fails >= 3) this.stop('this browser would not keep it (no storage, or none left)'); return; }
    this.fails = 0; this.stats.pieces++; this.stats.bytes += len;
    // the budget: counted once, then kept as a running sum; over it, the oldest visits are let go
    try {
      if (this.total < 0) { let n = 0; for (const r of await this.o.store.rows()) n += r.bytes; this.total = n; this.max = await this.room(); } else this.total += len;
      if (this.total > this.max) {
        const out = await pruneKept(this.o.store, this.max * 0.9, this.sid); this.stats.let += out.length; this.total = -1;
        if (this.row.bytes > this.max) this.stop('this one page visit is past everything this browser may keep');
      }
    } catch { /* */ }
  }
  private room(): Promise<number> { return (this.o.budget ?? keepBudget)(); }
  private stop(why: string): void { if (this.broke) return; this.broke = why; try { this.o.say?.(`Replays are no longer being kept: ${why}`); } catch { /* */ } }
  summary(): string {
    return this.broke ? `kept tape OFF: ${this.broke}` : !this.started ? 'kept tape: waiting for play' : `kept tape ${this.sid}: ${this.row.seconds.toFixed(0)} s of play in ${this.row.pieces} pieces · ${(this.row.bytes / 1048576).toFixed(1)} MB · every ${KEEP.secs} s`;
  }
}
