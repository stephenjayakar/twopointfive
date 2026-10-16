// THE REPLAY SHELF: the replays this browser has saved (F7 on the game page — ui/replaykey.ts), in IndexedDB, where the viewer page (same origin) finds them without
// a file being picked: the game puts one on the shelf, the viewer lists them, opens one, and writes the notes back as they are typed. Browser only; every call
// resolves (a browser without IndexedDB, a private window: an empty shelf and puts that say they did not keep it).
// Two stores under one id: `rows` (when, how long, why — and the NOTES, so a note typed in the viewer rewrites a small row, never the megabytes) and `bodies` (the
// file's text, read only when a replay is opened). A write is done when its TRANSACTION is (a quota refusal at commit is a put that did not keep it).
import type { ReplayFile, ReplayNote } from './format';
import { errorMarks } from './format';

const DB = 'twopointsix-replays', ROWS = 'rows', BODIES = 'bodies';
/** the newest this many are kept; a put past it drops the oldest (a replay with notes on it is kept ahead of one without; the one just put is never the one dropped) */
export const SHELF_KEEP = 16;

export interface ShelfRow { id: number; savedAt: string; seconds: number; notes: number; why: string; scenario: string; bytes: number; /** the page visit it is a window of, where the page keeps its tapes (kept.ts) */ session?: string; /** the step count at its last sample */ n1?: number; /** the file holds a page error's line (format.ts errorMarks), whatever saved it; absent on rows from before the lines */ err?: boolean; }
interface Stored extends Omit<ShelfRow, 'notes'> { notes: ReplayNote[]; }

/** how long an open of the shelf is waited on. A browser can leave the request with no event at all (storage being cleared, a profile that is shutting down): past
 *  this the shelf is 'not here' for that call — F7 hands the file over as a download, the viewer lists nothing — and a database that turns up later is closed unused,
 *  so nothing is written after the caller was told it was not */
export const SHELF = { openMs: 5000 };
function open(): Promise<IDBDatabase | null> {
  return new Promise(res => {
    let over = false;
    const end = (db: IDBDatabase | null) => { if (over) { try { db?.close(); } catch { /* */ } return; } over = true; clearTimeout(t); res(db); };
    const t = setTimeout(() => end(null), SHELF.openMs);
    try {
      const rq = indexedDB.open(DB, 2);
      rq.onupgradeneeded = () => { const db = rq.result; for (const n of Array.from(db.objectStoreNames)) db.deleteObjectStore(n); db.createObjectStore(ROWS, { keyPath: 'id', autoIncrement: true }); db.createObjectStore(BODIES); };
      rq.onsuccess = () => end(rq.result); rq.onerror = () => end(null); rq.onblocked = () => end(null);
    } catch { end(null); }
  });
}
const done = <T>(rq: IDBRequest<T>): Promise<T | null> => new Promise(res => { rq.onsuccess = () => res(rq.result); rq.onerror = () => res(null); });
const settled = (tx: IDBTransaction): Promise<boolean> => new Promise(res => { tx.oncomplete = () => res(true); tx.onabort = () => res(false); tx.onerror = () => res(false); });
const rowOf = (f: ReplayFile, bytes: number): Omit<Stored, 'id'> => ({ savedAt: f.savedAt, seconds: f.seconds, notes: f.notes ?? [], why: f.why, scenario: f.level.scenario ?? f.level.file ?? '', bytes, ...(errorMarks(f).length ? { err: true } : {}), ...(f.session ? { session: f.session } : {}), ...(f.samples?.length ? { n1: f.samples[f.samples.length - 1].n } : {}) });
const listed = (r: Stored): ShelfRow => ({ ...r, notes: r.notes?.length ?? 0 });

/** put a replay on the shelf; its id, or null when the browser would not keep it */
export async function shelfPut(f: ReplayFile): Promise<number | null> {
  const db = await open(); if (!db) return null;
  try {
    const text = JSON.stringify({ ...f, notes: [] });   // (the notes live on the row)
    const tx = db.transaction([ROWS, BODIES], 'readwrite'), ok = settled(tx);
    const rq = tx.objectStore(ROWS).add(rowOf(f, text.length));
    rq.onsuccess = () => { tx.objectStore(BODIES).put(text, rq.result as number); };
    if (!(await ok)) return null;
    const id = rq.result as number; await prune(db, id); return id;
  } catch { return null; } finally { db.close(); }
}
/** the notes of a shelf entry, rewritten (the viewer, as a note is typed): the row alone */
export async function shelfNotes(id: number, notes: ReplayNote[]): Promise<boolean> {
  const db = await open(); if (!db) return false;
  try {
    const tx = db.transaction(ROWS, 'readwrite'), ok = settled(tx), st = tx.objectStore(ROWS), rq = st.get(id);
    rq.onsuccess = () => { const row = rq.result as Stored | undefined; if (row) st.put({ ...row, notes }); };
    return await ok;
  } catch { return false; } finally { db.close(); }
}
/** what is on the shelf, newest first (no file bodies) */
export async function shelfList(): Promise<ShelfRow[]> {
  const db = await open(); if (!db) return [];
  try { return (((await done(db.transaction(ROWS, 'readonly').objectStore(ROWS).getAll())) as Stored[] | null) ?? []).map(listed).sort((a, b) => b.id - a.id); }
  catch { return []; } finally { db.close(); }
}
/** the shelf's rows with their notes in full, newest first (the dump of kept tapes — keepstore.ts — carries an entry's notes without opening its body) */
export async function shelfNoted(): Promise<(Omit<ShelfRow, 'notes'> & { notes: ReplayNote[] })[]> {
  const db = await open(); if (!db) return [];
  try { return (((await done(db.transaction(ROWS, 'readonly').objectStore(ROWS).getAll())) as Stored[] | null) ?? []).map(r => ({ ...r, notes: r.notes ?? [] })).sort((a, b) => b.id - a.id); }
  catch { return []; } finally { db.close(); }
}
export async function shelfGet(id: number): Promise<ReplayFile | null> {
  const db = await open(); if (!db) return null;
  try {
    const tx = db.transaction([ROWS, BODIES], 'readonly'), row = done(tx.objectStore(ROWS).get(id)), body = done(tx.objectStore(BODIES).get(id));
    const r = (await row) as Stored | null | undefined, text = (await body) as string | null | undefined; if (!r || typeof text !== 'string') return null;
    const f = JSON.parse(text) as ReplayFile; f.notes = r.notes ?? []; return f;
  } catch { return null; } finally { db.close(); }
}
export async function shelfDelete(id: number): Promise<void> {
  const db = await open(); if (!db) return;
  try { const tx = db.transaction([ROWS, BODIES], 'readwrite'), ok = settled(tx); tx.objectStore(ROWS).delete(id); tx.objectStore(BODIES).delete(id); await ok; } catch { /* */ } finally { db.close(); }
}
async function prune(db: IDBDatabase, keep: number): Promise<void> {
  try {
    const all = (await done(db.transaction(ROWS, 'readonly').objectStore(ROWS).getAll())) as Stored[] | null; if (!all || all.length <= SHELF_KEEP) return;
    const drop = all.filter(r => r.id !== keep).sort((a, b) => (a.notes?.length ? 1 : 0) - (b.notes?.length ? 1 : 0) || a.id - b.id).slice(0, all.length - SHELF_KEEP);   // (un-noted first, oldest first)
    const tx = db.transaction([ROWS, BODIES], 'readwrite'), ok = settled(tx); for (const r of drop) { tx.objectStore(ROWS).delete(r.id); tx.objectStore(BODIES).delete(r.id); } await ok;
  } catch { /* */ }
}
