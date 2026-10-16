// THE KEPT TAPES' FORMAT — every run kept in the browser with no key pressed, and handed over as one file.
// (the maintainer, 10-11: "maybe a good model would be that we save all replays as we go (in browser storage?) and then i can just periodically dump all of them to
// you (and you dedup?) … without me needing to do a bunch of explicit curation")
// A page visit's tape is kept as PIECES: every few seconds the page hands over what the replay ring and the run tape have gained since the last piece
// (game/replaybuf.ts since()) and the piece is written to this browser's own storage (keepstore.ts). Pieces laid end to end are the whole visit — every run made on
// that page load, however long — where an F7 file is the ring's last five minutes. A DUMP is those pieces as lines of JSON, one line a record (`KeptLine`), gzipped
// in members that simply follow one another (so the page never has to hold or re-pack the whole thing):
//   {k:'dump'}   once, first: what the file holds
//   {k:'head'}   a visit's head (build, page query, level, switches, floor) — written with its first piece and again whenever it changed; the LAST one stands
//   {k:'piece'}  one piece, numbered from 0 within its visit
//   {k:'notes'}  notes put on a kept visit in the viewer
//   {k:'f7'}     a file saved by the key that the shelf holds: its notes and which visit it is a window of (the trace itself is in the visit's pieces)
//   {k:'file'}   a whole replay file the shelf holds whose visit is NOT kept here (saved before the page kept tapes, or its visit has been let go)
// `assemble` turns one visit's head and pieces back into a ReplayFile — the very thing F7 writes, so the viewer, tools/qa/replay-at.ts and the re-run read it as
// they read any other. No game code is imported: the viewer page and the reading tool (tools/qa/replay-dump.ts) load this file alone.
import type { CastRow, Sample, ReplayEvent, ReplayLine, ReplayNote, ReplayFile, RunTape } from './format';

export const KEPT_VERSION = 1;

/** the run tape's rows since the piece before (game/runtape.ts since()); `ticks` = steps taped so far, the first piece of a visit carries the recipe — and
 *  `f32`, how the visit's sensor values are written (format.ts RunTape.sens.f32: absent = every number the double itself) */
export interface TapePiece {
  ticks: number; recipe?: Omit<RunTape['recipe'], 'search' | 'levelFile'>; f32?: 1;
  dt: [number, number][]; view: number[][]; cam: RunTape['cam']; input: RunTape['input'];
  /** sensor keys first met in this piece (appended to the visit's list: a row's indices are into the whole list) */
  keys: string[]; sens: RunTape['sens']['rows']; x: RunTape['x'];
}
/** what the ring gained since the piece before, on the ring's own clock and cast indices; `cast` = rows first met in this piece (appended to the visit's cast) */
export interface KeptPiece {
  r: number; cast: CastRow[]; samples: Sample[]; events: ReplayEvent[]; lines: ReplayLine[];
  /** how many cast rows the visit had before this piece's (so a lost piece's rows leave a gap, not a shift) */
  c0?: number;
  /** the ring had forgotten rows nobody had taken: this piece starts at its head, a keyframe */
  gap?: true;
  tape?: TapePiece;
  /** the run tape ended here (why, and the step): the pieces before this one still walk a game up to where they reach */
  dead?: { dead: string; tick: number };
}
export type KeptHead = Pick<ReplayFile, 'v' | 'game' | 'commit' | 'url' | 'userAgent' | 'level' | 'seed' | 'flags' | 'hz' | 'keep' | 'map'>;

export type KeptLine =
  | { k: 'dump'; v: number; at: string; userAgent?: string; visits: { sid: string; pieces: number; bytes: number; startedAt: string; lastAt: string; sent?: string }[]; shelf: number }
  | ({ k: 'head'; sid: string; at: string } & KeptHead)
  | ({ k: 'piece'; sid: string; seq: number; at: string } & KeptPiece)
  | { k: 'notes'; sid: string; notes: ReplayNote[] }
  | { k: 'f7'; session?: string; savedAt: string; /** the step count at the file's last sample */ n?: number; seconds: number; why?: string; scenario?: string; notes: ReplayNote[] }
  | { k: 'file'; file: ReplayFile };

export const headLine = (sid: string, at: string, h: KeptHead): string => JSON.stringify({ k: 'head', sid, at, ...h }) + '\n';
export const pieceLine = (sid: string, seq: number, at: string, p: KeptPiece): string => JSON.stringify({ k: 'piece', sid, seq, at, ...p }) + '\n';

/** lines of JSON as records; a line that does not parse (a write cut short as the page went away) is counted, not thrown */
export function parseLines(text: string, into: KeptLine[] = []): { lines: KeptLine[]; bad: number } {
  let bad = 0;
  for (const row of text.split('\n')) { if (!row.trim()) continue; try { const o = JSON.parse(row) as KeptLine; if (o && typeof o === 'object' && typeof (o as { k?: unknown }).k === 'string') into.push(o); else bad++; } catch { bad++; } }
  return { lines: into, bad };
}

/** one visit as its records: the head that stands, the pieces by number (a number met twice is kept once: two dumps holding the same visit) */
export interface Visit { sid: string; head: (KeptHead & { at: string }) | null; pieces: Map<number, KeptPiece & { at: string }>; notes: ReplayNote[]; }
export function visitsOf(lines: KeptLine[], into = new Map<string, Visit>()): Map<string, Visit> {
  const of = (sid: string) => { let v = into.get(sid); if (!v) into.set(sid, v = { sid, head: null, pieces: new Map(), notes: [] }); return v; };
  for (const L of lines) {
    if (L.k === 'head') { const v = of(L.sid); if (!v.head || L.at >= v.head.at) { const { k: _k, sid: _s, ...h } = L; v.head = h; } }
    else if (L.k === 'piece') { const v = of(L.sid); if (!v.pieces.has(L.seq)) { const { k: _k, sid: _s, seq: _q, ...p } = L; v.pieces.set(L.seq, p); } }
    else if (L.k === 'notes') { const v = of(L.sid); for (const n of L.notes) if (!v.notes.some(m => m.id === n.id && m.r === n.r && m.text === n.text)) v.notes.push(n); }
  }
  return into;
}

export interface Assembled {
  file: ReplayFile;
  /** pieces used, the numbers that were missing below the last one, and the buffer's step count at the file's first and last sample */
  pieces: number; missing: number[]; n0: number; n1: number;
  /** how far the run tape walks (steps), and why it stops short of the end where it does */
  tapeTicks: number; tapeEnd: string;
}
const round3 = (x: number) => Math.round(x * 1000) / 1000;
/** b onto a, one by one (a spread of a long tape's rows is past what a call takes) */
const add = <T>(a: T[], b: readonly T[]): void => { for (let i = 0; i < b.length; i++) a.push(b[i]); };
const NOBODY: CastRow = { kind: 'man', name: '?', team: '?', id: -1 };
/** A VISIT AS A REPLAY FILE. The same rebasing file() does (r from the first sample, a line's r held inside the samples'); the cast indices are the ring's own, kept.
 *  A missing piece (a write the browser lost) does not lose the rest: the trace picks up at the next keyframe with a mark at the hole, and the run tape — which
 *  cannot skip — ends there. null: no head, or no piece with a sample in it. */
export function assemble(v: Visit, why = 'kept'): Assembled | null {
  if (!v.head || !v.pieces.size) return null;
  const seqs = [...v.pieces.keys()].sort((a, b) => a - b), last = seqs[seqs.length - 1], missing: number[] = [];
  for (let q = 0; q < last; q++) if (!v.pieces.has(q)) missing.push(q);
  const cast: CastRow[] = [], S: Sample[] = [], E: ReplayEvent[] = [], L: ReplayLine[] = [];
  // the run tape: whole while every piece from 0 is there and none said it ended
  let tape: RunTape | null = null, tapeOpen = true, tapeEnd = '', dead: { dead: string; tick: number } | null = null;
  let hole = false, prevSeq = -1;
  for (const q of seqs) {
    const P = v.pieces.get(q)!;
    const skipped = q !== prevSeq + 1; prevSeq = q;
    if (skipped) { hole = true; if (tapeOpen) { tapeOpen = false; tapeEnd = `piece ${q - 1} of the kept tape is missing`; } L.push({ r: P.samples[0]?.r ?? P.r, k: 'mark', text: `a piece of the kept tape is missing here (${q - 1}): the trace picks up at the next keyframe` }); }
    // (the cast is appended by every piece met; a missing piece's rows are not there, so the next piece's own base index says where its rows go)
    if (P.c0 !== undefined) while (cast.length < P.c0) cast.push({ ...NOBODY });
    add(cast, P.cast);
    if (P.gap) { hole = true; if (S.length) L.push({ r: P.samples[0]?.r ?? P.r, k: 'mark', text: 'the page kept nothing for a while before this (the ring had moved on): the trace picks up here' }); }
    for (const s of P.samples) { if (hole) { if (!s.k) continue; hole = false; } S.push(s); }
    add(E, P.events); add(L, P.lines);
    if (P.dead) { dead = P.dead; if (tapeOpen) { tapeOpen = false; tapeEnd = `${P.dead.dead} (step ${P.dead.tick})`; } L.push({ r: P.r, k: 'mark', text: `the run tape ends here: ${P.dead.dead}` }); }
    const T = P.tape;
    if (T && tapeOpen) {
      if (!tape) { if (!T.recipe) { tapeOpen = false; tapeEnd = 'the first piece of the run tape is missing'; continue; }
        tape = { v: 1, ticks: 0, recipe: { ...T.recipe, search: v.head.url ?? '', ...(v.head.level.file ? { levelFile: v.head.level.file } : {}) }, dt: [], view: [], cam: [], input: [], sens: { keys: [], rows: [], ...(T.f32 ? { f32: 1 as const } : {}) }, x: [] }; }
      for (const run of T.dt) { const D = tape.dt[tape.dt.length - 1]; if (D && D[1] === run[1]) D[0] += run[0]; else tape.dt.push([run[0], run[1]]); }
      add(tape.view, T.view); add(tape.cam, T.cam); add(tape.input, T.input); add(tape.sens.keys, T.keys); add(tape.sens.rows, T.sens); add(tape.x, T.x); tape.ticks = T.ticks;
    }
  }
  if (!S.length) return null;
  if (missing.length) { let need = 0; for (const s of S) { for (const m of s.m ?? []) need = Math.max(need, m[0] + 1); for (const x of s.x ?? []) need = Math.max(need, x[0] + 1); } while (cast.length < need) cast.push({ ...NOBODY }); }
  const r0 = S[0].r, rN = S[S.length - 1].r, rb = (r: number) => round3(r - r0);
  const H = v.head, notes = v.notes.slice().sort((a, b) => a.r - b.r);
  const { at: lastAt } = v.pieces.get(last)!;
  const { at: _at, ...head } = H;
  const file: ReplayFile = {
    ...head, kind: 'replay', savedAt: lastAt, why, session: v.sid,
    seconds: Math.round((rN - r0) * 10) / 10,
    cast, samples: S.map(s => ({ ...s, r: rb(s.r) })), events: E.map(e => ({ ...e, r: rb(e.r) })),
    lines: L.map(l => ({ ...l, r: Math.min(Math.max(rb(l.r), 0), rb(rN)) })).sort((a, b) => a.r - b.r),
    notes,
    ...(tape && tape.ticks ? { rerun: tape } : dead ? { rerun: dead } : {}),
  };
  return { file, pieces: seqs.length, missing, n0: S[0].n, n1: S[S.length - 1].n, tapeTicks: tape?.ticks ?? 0, tapeEnd };
}

/** a kept visit's name as a file */
export const keptName = (f: ReplayFile): string => `twopointsix-kept-${f.savedAt.replace(/[:.]/g, '-').replace('Z', '')}-${Math.round(f.seconds)}s.json`;
