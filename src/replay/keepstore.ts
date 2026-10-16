// THE KEPT TAPES' STORE: where the pieces of every page visit's tape live in this browser (kept.ts has the format and why), what is let go when the room runs
// out, and the DUMP — everything kept, as one file to hand to a thread. IndexedDB, a database of its own (the F7 shelf's is not touched), three stores:
//   `visits`  one small row a page visit: when, what, how many pieces, how many bytes, how many of them an earlier dump already carried, notes put on it
//   `heads`   the visit's head line as it stands (rewritten only when the switches or the floor changed)
//   `pieces`  [visit, number] → the piece's line, gzipped where the browser can (a Blob), the plain text where it was written as the page was going away
// Every call resolves: a browser without IndexedDB, a private window or a full disk is a store that says it did not keep it — the game is never held up.
// NOTHING HERE TALKS TO A NETWORK: a dump is a file the browser downloads, and the player attaches it where he likes.
// A memory twin (`memoryStore`) stands in under bun, where the headless check lays the same pieces through the same code.
import type { ReplayNote } from './format';
import type { KeptLine, Visit } from './kept';
import { KEPT_VERSION, parseLines, visitsOf } from './kept';
import { shelfNoted, shelfGet } from './shelf';

/** `secs` between pieces · `maxMB` of kept tapes at most, and never more than `share` of what the browser says this site may use · `openMs` an open of the
 *  database is waited on (shelf.ts SHELF.openMs: a browser can leave the request with no event at all) */
export const KEEP = { secs: 5, maxMB: 600, share: 0.5, openMs: 5000 };

export interface KeptRow {
  sid: string; startedAt: string; lastAt: string; scenario: string; url: string; commit?: string;
  /** seconds of play kept, pieces written, bytes they take */
  seconds: number; pieces: number; bytes: number;
  /** how many of its pieces a dump has carried (a visit that has grown since is dumped again whole: the reader drops what it has) and when */
  sent?: number; sentAt?: string;
  notes?: ReplayNote[];
  /** notes were put on it (or changed) since a dump last carried them */
  noted?: boolean;
  /** its page said it was going (pagehide): nobody is playing it. NEVER STORED ON THE ROW — `rows()` reads it off the store's own mark (`left` below), which a
   *  going page can write without reading the row back, and so without laying an old row over a note or a hand-over another tab wrote since */
  left?: boolean;
}
export type Body = Blob | string;
export interface KeptStore {
  /** one piece and the visit's row, together (the row's `sent` and `notes` are whoever wrote them last: never overwritten from here) */
  put(row: KeptRow, seq: number, body: Body, head?: string): Promise<boolean>;
  /** `put` for a page that is GOING AWAY: every request is asked in this very turn and the transaction told to commit, with nothing read back first (a
   *  transaction left waiting on a read when its page dies is thrown away whole, piece and row). The row is laid over the row this page last saw stored, so a
   *  `sent` or a note another tab wrote since this page's last put is the one thing it can miss. Absent = the store has no such hurry (`put` serves). */
  putNow?(row: KeptRow, seq: number, body: Body, head?: string): Promise<boolean>;
  /** the visit's page says it is going (`gone`), or that it is back and being played after all. One key of its own, asked in this very turn and told to
   *  commit: no row is read, written or made by it (a mark on a visit that was dropped lists nothing), and `drop` takes it with the visit. */
  left(sid: string, gone: boolean): Promise<boolean>;
  rows(): Promise<KeptRow[]>;
  head(sid: string): Promise<string | null>;
  bodies(sid: string): Promise<Body[]>;
  drop(sid: string): Promise<void>;
  patch(sid: string, fields: Partial<KeptRow>): Promise<boolean>;
}

const DB = 'twopointsix-kept', VISITS = 'visits', HEADS = 'heads', PIECES = 'pieces';
function open(): Promise<IDBDatabase | null> {
  return new Promise(res => {
    let over = false;
    const end = (db: IDBDatabase | null) => { if (over) { try { db?.close(); } catch { /* */ } return; } over = true; clearTimeout(t); res(db); };
    const t = setTimeout(() => end(null), KEEP.openMs);
    try {
      const rq = indexedDB.open(DB, 1);
      rq.onupgradeneeded = () => { const db = rq.result, has = (n: string) => db.objectStoreNames.contains(n);
        if (!has(VISITS)) db.createObjectStore(VISITS, { keyPath: 'sid' }); if (!has(HEADS)) db.createObjectStore(HEADS); if (!has(PIECES)) db.createObjectStore(PIECES); };
      rq.onsuccess = () => end(rq.result); rq.onerror = () => end(null); rq.onblocked = () => end(null);
    } catch { end(null); }
  });
}
const done = <T>(rq: IDBRequest<T>): Promise<T | null> => new Promise(res => { rq.onsuccess = () => res(rq.result); rq.onerror = () => res(null); });
const settled = (tx: IDBTransaction): Promise<boolean> => new Promise(res => { tx.oncomplete = () => res(true); tx.onabort = () => res(false); tx.onerror = () => res(false); });
const span = (sid: string) => IDBKeyRange.bound([sid, 0], [sid, Number.MAX_SAFE_INTEGER]);
/** where a visit's 'its page has gone' mark lives: the heads' store, under a key no visit id can be (an array; a head's key is the id, a string). No store of its
 *  own: that would be a new version of the database, and a page of an older build on this origin could then open none of it. */
const leftKey = (sid: string): [string, string] => ['left', sid];
const isLeftKey = (k: unknown): k is [string, string] => Array.isArray(k) && k.length === 2 && k[0] === 'left' && typeof k[1] === 'string';
/** the row as the keeper knows it laid over the row as stored: what a dump or the viewer wrote on it stays */
const merged = (old: KeptRow | undefined, row: KeptRow): KeptRow => ({ ...row, ...(old?.sent !== undefined ? { sent: old.sent, sentAt: old.sentAt } : {}), ...(old?.notes ? { notes: old.notes } : {}), ...(old?.noted ? { noted: true } : {}) });

/** this browser's store. One connection for the page's life (a piece every few seconds: not an open each); a call made before it is open waits for it. */
export function browserStore(): KeptStore {
  let dbp: Promise<IDBDatabase | null> | null = null, open1: IDBDatabase | null = null;
  /** each visit's row as this page last saw it stored (what `putNow` lays its row over) */
  const seen = new Map<string, KeptRow>();
  const db = () => dbp ??= open().then(d => { open1 = d; if (d) d.onversionchange = () => { try { d.close(); } catch { /* */ } dbp = null; open1 = null; }; else dbp = null; return d; });
  const now = (d: IDBDatabase, row: KeptRow, seq: number, body: Body, head?: string): Promise<boolean> => {
    const tx = d.transaction(head === undefined ? [VISITS, PIECES] : [VISITS, PIECES, HEADS], 'readwrite'), ok = settled(tx), m = merged(seen.get(row.sid), row);
    tx.objectStore(VISITS).put(m); tx.objectStore(PIECES).put(body, [row.sid, seq]);
    if (head !== undefined) tx.objectStore(HEADS).put(head, row.sid);
    try { tx.commit?.(); } catch { /* a browser without it commits by itself, if the page lives that long */ }
    seen.set(row.sid, m);
    return ok;
  };
  const run = async <T>(miss: T, f: (d: IDBDatabase) => Promise<T>): Promise<T> => { const d = await db(); if (!d) return miss; try { return await f(d); } catch { return miss; } };
  return {
    put: (row, seq, body, head) => run(false, d => {
      const tx = d.transaction(head === undefined ? [VISITS, PIECES] : [VISITS, PIECES, HEADS], 'readwrite'), ok = settled(tx), V = tx.objectStore(VISITS), rq = V.get(row.sid);
      rq.onsuccess = () => { const m = merged(rq.result as KeptRow | undefined, row); seen.set(row.sid, m); V.put(m); };
      tx.objectStore(PIECES).put(body, [row.sid, seq]);
      if (head !== undefined) tx.objectStore(HEADS).put(head, row.sid);
      return ok;
    }),
    putNow: (row, seq, body, head) => { const d = open1; if (!d) return run(false, d2 => now(d2, row, seq, body, head)); try { return now(d, row, seq, body, head); } catch { return Promise.resolve(false); } },
    rows: () => run([] as KeptRow[], async d => { const tx = d.transaction([VISITS, HEADS], 'readonly'), rq = tx.objectStore(VISITS).getAll(), kq = tx.objectStore(HEADS).getAllKeys();
      const [got, keys] = await Promise.all([done(rq), done(kq)]);   // (both asked for before either is waited on: a request's answer is heard only by a handler already on it)
      const rows = (got as KeptRow[] | null) ?? [], gone = new Set(((keys as unknown[] | null) ?? []).filter(isLeftKey).map(k => k[1]));
      return rows.map(r => { const { left: _stored, ...rest } = r; return gone.has(r.sid) ? { ...rest, left: true } : rest; }); }),
    left: (sid, gone) => { const f = (d: IDBDatabase): Promise<boolean> => { const tx = d.transaction(HEADS, 'readwrite'), ok = settled(tx), H = tx.objectStore(HEADS); if (gone) H.put(1, leftKey(sid)); else H.delete(leftKey(sid)); try { tx.commit?.(); } catch { /* */ } return ok; };
      const d = open1; if (!d) return run(false, f); try { return f(d); } catch { return Promise.resolve(false); } },
    head: sid => run(null as string | null, async d => { const h = await done(d.transaction(HEADS, 'readonly').objectStore(HEADS).get(sid)); return typeof h === 'string' ? h : null; }),
    bodies: sid => run([] as Body[], async d => ((await done(d.transaction(PIECES, 'readonly').objectStore(PIECES).getAll(span(sid)))) as Body[] | null) ?? []),
    drop: sid => run(undefined, async d => { const tx = d.transaction([VISITS, HEADS, PIECES], 'readwrite'), ok = settled(tx); tx.objectStore(VISITS).delete(sid); tx.objectStore(HEADS).delete(sid); tx.objectStore(HEADS).delete(leftKey(sid)); tx.objectStore(PIECES).delete(span(sid)); await ok; }),
    patch: (sid, fields) => run(false, d => { const tx = d.transaction(VISITS, 'readwrite'), ok = settled(tx), V = tx.objectStore(VISITS), rq = V.get(sid);
      rq.onsuccess = () => { const row = rq.result as KeptRow | undefined; if (row) { const m = { ...row, ...fields }; if (seen.has(sid)) seen.set(sid, m); V.put(m); } }; return ok; }),
  };
}
/** the same store in memory (the headless check; `full` = bytes it will hold before a put is refused, as a full disk refuses one) */
export function memoryStore(full = Infinity): KeptStore & { size(): number } {
  const V = new Map<string, KeptRow>(), H = new Map<string, string>(), P = new Map<string, Map<number, Body>>(), L = new Set<string>();
  const len = (b: Body) => typeof b === 'string' ? b.length : b.size, size = () => { let n = 0; for (const m of P.values()) for (const b of m.values()) n += len(b); return n; };
  return {
    size,
    put: async (row, seq, body, head) => { if (size() + len(body) > full) return false; V.set(row.sid, merged(V.get(row.sid), row)); let m = P.get(row.sid); if (!m) P.set(row.sid, m = new Map()); m.set(seq, body); if (head !== undefined) H.set(row.sid, head); return true; },
    rows: async () => [...V.values()].map(r => { const { left: _stored, ...rest } = r; return L.has(r.sid) ? { ...rest, left: true } : rest; }),
    left: async (sid, gone) => { if (gone) L.add(sid); else L.delete(sid); return true; },
    head: async sid => H.get(sid) ?? null,
    bodies: async sid => [...(P.get(sid) ?? new Map<number, Body>()).entries()].sort((a, b) => a[0] - b[0]).map(e => e[1]),
    drop: async sid => { V.delete(sid); H.delete(sid); P.delete(sid); L.delete(sid); },
    patch: async (sid, fields) => { const r = V.get(sid); if (!r) return false; V.set(sid, { ...r, ...fields }); return true; },
  };
}

/** text → one gzip member, where the browser can (null where it cannot: pieces are then kept, and dumped, as plain text) */
export const gzip: ((text: string) => Promise<Blob>) | null = typeof CompressionStream === 'undefined' ? null
  : (text: string) => new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))).blob();

/** how many bytes of tapes this browser keeps: `maxMB`, or `share` of what it says the site may use if that is less */
export async function keepBudget(): Promise<number> {
  let max = KEEP.maxMB * 1048576;
  try { const e = await navigator.storage?.estimate?.(); if (e?.quota) max = Math.min(max, e.quota * KEEP.share); } catch { /* */ }
  return max;
}
/** a visit some page wrote to this recently is taken to be still being played (a page files every KEEP.secs) — unless its page said it was going (`left`):
 *  a game just left for the list of replays is not being played, and its row must not say so for a minute */
export const WRITING_MS = 60000;
/** (the check's red path: REPLAYLEFT_BREAK=1 in front of tools/qa/replaykeep-probes.ts — a page has no process) */
const LEFT_BREAK = (() => { try { return String((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.REPLAYLEFT_BREAK ?? '') === '1'; } catch { return false; } })();
export const beingWritten = (r: KeptRow, nowMs = Date.now()): boolean => { if (r.left && !LEFT_BREAK) return false; const t = Date.parse(r.lastAt); return Number.isFinite(t) && Math.abs(nowMs - t) < WRITING_MS; };
/** a visit every piece of which a dump has carried */
export const wholeSent = (r: KeptRow): boolean => (r.sent ?? 0) >= r.pieces;
/** LET GO OF THE OLDEST until the kept tapes fit `max` bytes: visits a dump has already carried first, oldest first, then the rest oldest first — never `live`
 *  (the visit being written), nor a visit written inside the last WRITING_MS whose page has not said it left (still being played). Whole visits only: half a tape is not a tape.
 *  Returns what was dropped. */
export async function pruneKept(store: KeptStore, max: number, live: string | null = null, nowMs = Date.now()): Promise<KeptRow[]> {
  const rows = await store.rows(); let total = 0; for (const r of rows) total += r.bytes;
  if (total <= max) return [];
  const order = rows.filter(r => r.sid !== live && !beingWritten(r, nowMs)).sort((a, b) => (Number(wholeSent(b)) - Number(wholeSent(a))) || (a.lastAt < b.lastAt ? -1 : a.lastAt > b.lastAt ? 1 : 0));
  const out: KeptRow[] = [];
  for (const r of order) { if (total <= max) break; await store.drop(r.sid); total -= r.bytes; out.push(r); }
  return out;
}

export interface KeptSummary { visits: number; seconds: number; bytes: number; fresh: number; freshSeconds: number; freshBytes: number; /** visits a dump has carried whose notes it has not */ noted: number; rows: KeptRow[]; }
/** what is kept, newest first, and how much of it no dump has carried yet */
export async function keptSummary(store: KeptStore): Promise<KeptSummary> {
  const rows = (await store.rows()).sort((a, b) => a.lastAt < b.lastAt ? 1 : -1), S: KeptSummary = { visits: rows.length, seconds: 0, bytes: 0, fresh: 0, freshSeconds: 0, freshBytes: 0, noted: 0, rows };
  for (const r of rows) { S.seconds += r.seconds; S.bytes += r.bytes; if (!wholeSent(r)) { S.fresh++; S.freshSeconds += r.seconds; S.freshBytes += r.bytes; } else if (r.noted && r.notes?.length) S.noted++; }
  return S;
}

/** a piece's body as its text (a gzip member where the browser packed it) */
async function textOf(b: Body): Promise<string> {
  if (typeof b === 'string') return b;
  const u = new Uint8Array(await b.arrayBuffer());
  if (u[0] === 0x1f && u[1] === 0x8b) return new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  return new TextDecoder().decode(u);
}
/** one kept visit as its records, read out of the store (kept.ts assemble makes a replay file of it); null: not kept, or nothing of it reads */
export async function readVisit(store: KeptStore, sid: string): Promise<Visit | null> {
  const head = await store.head(sid), bodies = await store.bodies(sid); if (!head || !bodies.length) return null;
  const lines: KeptLine[] = []; parseLines(head, lines);
  for (const b of bodies) { try { parseLines(await textOf(b), lines); } catch { /* a piece that does not unpack is a missing piece */ } }
  const V = visitsOf(lines).get(sid) ?? null;
  if (V) { const row = (await store.rows()).find(r => r.sid === sid); if (row?.notes) V.notes = row.notes.slice(); }
  return V;
}

/** the F7 shelf's side of a dump (shelf.ts): the last shelf id a dump carried whole is remembered per browser */
const SHELF_SENT = 'twopointsix.kept.shelfSent';
const shelfSent = (): number => { try { return Number(localStorage.getItem(SHELF_SENT)) || 0; } catch { return 0; } };

export interface Dump { blob: Blob; name: string; visits: number; pieces: number; f7: number; files: number; /** call once the download has been handed over: marks what it carried */ sent(): Promise<void>; }
/** THE DUMP: every kept visit no dump has carried whole (`all`: every kept visit), then the F7 shelf's notes and the shelf's files whose visit is not kept, as one
 *  blob of gzip members (plain lines where the browser cannot gzip). null = nothing to hand over. `shelf: false` = the kept visits alone (the check under bun). */
export async function makeDump(store: KeptStore, opts: { all?: boolean; shelf?: boolean; gz?: ((text: string) => Promise<Blob>) | null; now?: string; userAgent?: string } = {}): Promise<Dump | null> {
  const gz = opts.gz === undefined ? gzip : opts.gz, now = opts.now ?? new Date().toISOString();
  const kept = await store.rows(), rows = kept.filter(r => r.pieces > 0 && (opts.all || !wholeSent(r))).sort((a, b) => a.startedAt < b.startedAt ? -1 : 1);
  const line = (o: KeptLine) => JSON.stringify(o) + '\n', z = async (text: string): Promise<Body> => gz ? gz(text) : text;
  let pieces = 0; const carried: [string, number, number][] = [], noted: string[] = [];
  const body: Body[] = [];
  for (const r of rows) {
    const head = await store.head(r.sid), bodies = await store.bodies(r.sid); if (!head || !bodies.length) continue;
    body.push(await z(head));
    for (const b of bodies) body.push(typeof b === 'string' ? await z(b) : b);   // (a piece written as the page went away is plain text: packed now)
    if (r.notes?.length) body.push(await z(line({ k: 'notes', sid: r.sid, notes: r.notes })));
    // (marked by the row's own count: a piece the store refused leaves a hole in the bodies, and the visit is handed over all the same)
    pieces += bodies.length; carried.push([r.sid, bodies.length, r.pieces]);
  }
  // notes put on a visit since a dump carried it: the notes alone (the reader has the tape)
  if (!opts.all) for (const r of kept) if (r.pieces > 0 && wholeSent(r) && r.noted && r.notes?.length) { body.push(await z(line({ k: 'notes', sid: r.sid, notes: r.notes }))); noted.push(r.sid); }
  // the shelf: a file saved by the key is a window of a visit — where that visit is kept, its notes are all a reader needs of it; else the file itself, once
  let f7 = 0, f7Fresh = 0, files = 0, shelfTop = 0; const keptAt = new Map(kept.map(r => [r.sid, Date.parse(r.lastAt)])), was = shelfSent();
  if (opts.shelf !== false) for (const s of await shelfNoted()) {
    shelfTop = Math.max(shelfTop, s.id);
    // (kept up to the file's save, give or take a few beats: a visit whose keeping stopped before the key was pressed does not stand in for the file)
    const till = s.session ? keptAt.get(s.session) : undefined, at = Date.parse(s.savedAt);
    const here = till !== undefined && !(till < at - 4 * KEEP.secs * 1000), fresh = s.id > was || !!opts.all;
    if (!here && fresh) { const f = await shelfGet(s.id); if (f) { body.push(await z(line({ k: 'file', file: f }))); files++; } }
    else if (s.notes.length || fresh) { body.push(await z(line({ k: 'f7', session: s.session, savedAt: s.savedAt, ...(s.n1 !== undefined ? { n: s.n1 } : {}), seconds: s.seconds, why: s.why, scenario: s.scenario, notes: s.notes }))); f7++; if (fresh) f7Fresh++; }
  }
  if (!carried.length && !files && !f7Fresh && !noted.length) return null;   // (notes on a file an earlier dump carried ride along with a dump; they do not make one)
  const top = await z(line({ k: 'dump', v: KEPT_VERSION, at: now, ...(opts.userAgent ? { userAgent: opts.userAgent } : {}), shelf: f7 + files,
    visits: rows.filter(r => carried.some(c => c[0] === r.sid)).map(r => ({ sid: r.sid, pieces: carried.find(c => c[0] === r.sid)![1], bytes: r.bytes, startedAt: r.startedAt, lastAt: r.lastAt, ...(r.sentAt ? { sent: r.sentAt } : {}) })) }));
  const parts: Body[] = [top, ...body];
  const stamp = now.replace(/[:.]/g, '-').replace('Z', ''), what = carried.length ? `${carried.length}-visit${carried.length === 1 ? '' : 's'}` : 'notes';
  return {
    blob: new Blob(parts, { type: gz ? 'application/gzip' : 'application/x-ndjson' }), name: `twopointsix-replays-${stamp}-${what}.ndjson${gz ? '.gz' : ''}`,
    visits: carried.length, pieces, f7, files,
    sent: async () => { for (const [sid, , n] of carried) await store.patch(sid, { sent: n, sentAt: now, noted: false }); for (const sid of noted) await store.patch(sid, { noted: false }); if (shelfTop > was) { try { localStorage.setItem(SHELF_SENT, String(shelfTop)); } catch { /* */ } } },
  };
}
