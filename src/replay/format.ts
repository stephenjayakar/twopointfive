// THE REPLAY FILE (the maintainer, 10-11: "a replay system where we can always save a replay after the fact and then a viewer where i can annotate bugs").
// A replay is a TRACE of what happened — who stood where, facing what, doing what, on which route; the rounds, the doors, the words — sampled off the running game
// by game/replaybuf.ts and saved after the fact (F7 on the game page). It is NOT a recording the simulation is run again from (that is the session journal, F10 —
// game/journal.ts — which must be started before the thing happens and refuses a squad on the floor): nothing here is re-simulated to be read, so a replay opens
// on ANY later build, whatever has happened to the level, the doors or the save format since. The viewer (replay.html → src/replay/viewer.ts) draws it as a map
// with a scrubber and takes NOTES — a moment, a spot, words — which are kept IN the file; tools/qa/replay-at.ts reads file and notes in a thread.
//
// No import from the game: the viewer page and the bun tool read a file with this module alone.
//
// SHAPE. `samples` are taken `hz` times a second of PLAY (a paused game adds none). Each carries `r` = seconds on the replay's own clock (the sum of the steps
// played since the page booted: it never goes back — a restart or a checkpoint load does not rewind it), `t` = the game's clock then, `n` = how many game steps
// had run. Everything else in a sample is DELTA-coded against the samples before it, back to the last KEYFRAME (`k: 1`, one every few seconds, and always the
// first of a file): `m` = the men who moved, `x` = the men whose doing changed, `d` = the doors that moved; a keyframe lists every man and every door there is.
// A man is named by his index in `cast` (append-only: a restart's new men are new entries). decode() below unfolds all of it into plain per-sample tables.

export const REPLAY_VERSION = 1;
/** how a 'mark' line that files a PAGE ERROR starts (ui/replaykey.ts files one at the play moment the error came; the viewer and replay-at.ts find them by it) */
export const ERROR_MARK = 'the page hit an error: ';
/** a restart's mark opens with this (game/replaybuf.ts writes it: a fresh run, the men and the clock's story start over; a checkpoint load is not one) */
export const RESTART_MARK = 'restart (';
/** where the run a file ENDS in began: the last restart's moment (seconds from the file's start); 0 when the file holds none — its first sample is that run's, or as
 *  far back as the ring went. The viewer opens a file saved from the end card ('card') here: the card is about THIS run, and the ring may hold the tries before it. */
export const lastRun = (f: { lines: ReplayLine[] }): number => f.lines.reduce((r, l) => l.k === 'mark' && typeof l.text === 'string' && l.text.startsWith(RESTART_MARK) && l.r > r ? l.r : r, 0);
/** is this line a page error's */
export const isErrorMark = (l: ReplayLine): boolean => l.k === 'mark' && typeof l.text === 'string' && l.text.startsWith(ERROR_MARK);
/** the page errors a file holds, oldest first: the moment (seconds from the file's start) and the error's words */
export const errorMarks = (f: { lines: ReplayLine[] }): { r: number; text: string }[] => f.lines.filter(isErrorMark).map(l => ({ r: l.r, text: l.text.slice(ERROR_MARK.length) }));

/** what the player's row of the cast is called (replaybuf.ts writes it; a reader puts it on an older file's row) */
export const PLAYER_NAME = 'Player';
/** one of the cast: Sam, a man of any side, a civilian */
export interface CastRow {
  /** 'player' | 'man' | 'civ' */
  kind: 'player' | 'man' | 'civ';
  name: string;
  /** the side: 'player' for Sam; teams.ts's name for the rest ('guard', 'operative', 'hostile', 'civilian' …) */
  team: string;
  /** the character id rounds and sounds name their maker by */
  id: number;
  /** a spawned unit (a teammate, a response man) and the pair he was dealt into */
  unit?: boolean; pair?: string;
  /** what he carries */
  weapon?: string;
}
/** where a man is: [cast index, x, z, body yaw°, aim yaw°, awareness % (Sam: how lit he is %)] — metres to the centimetre; yaw 0 faces +z, 90 faces +x */
export type ManPos = [number, number, number, number, number, number];
/** what a man is doing — every field absent when it does not apply */
export interface ManDo {
  /** his state: patrol | suspicious | alert | search | dead (Sam: 'up' | 'down') */
  st?: string;
  /** the squad order he is on, in the HUD's own words ('stack: on his way') */
  ord?: string;
  /** somebody else has his feet: 'script' (a drill, the level's script), 'held' (in Sam's arm), 'pinned', 'hold' */
  by?: string;
  /** his errand, where the AI names one (task kind, body duty, a need, a tactics role) */
  task?: string;
  /** where his feet are going */
  goal?: [number, number];
  /** the route still ahead of him, from his next waypoint on */
  path?: [number, number][];
  /** who his gun is on: a cast index, or -1 = nobody */
  foe?: number;
  /** where he last knew his man to be */
  fix?: [number, number];
  /** what he is saying */
  say?: string;
  /** how he went down ('shot', 'struck', 'wounded' …) */
  down?: string;
  crouch?: boolean;
  /** rounds are keeping his head down (0‥1, in quarters) */
  sup?: number;
  /** Sam: what is in his hands */
  slot?: string;
  /** Sam: the sound he is making (0‥1, in tenths) */
  noise?: number;
}
/** a door: [index into map.doors, angle° from shut, bits: 1 latched · 2 locked · 4 lock broken · 8 off its hinges] */
export type DoorPos = [number, number, number];
/** a thing in the air or on its fuse: [kind, x, z, y] */
export type ItemPos = [string, number, number, number];

export interface Sample {
  r: number; t: number; n: number; k?: 1;
  m?: ManPos[]; x?: [number, ManDo][]; d?: DoorPos[]; i?: ItemPos[];
  /** the camera when it changed: [look-at x, z, yaw°, distance] */
  c?: [number, number, number, number];
  /** Sam's aim point on the floor when it changed */
  a?: [number, number];
  /** men who are no longer in the game from this sample on (a restart, a unit sent home) */
  gone?: number[];
}
/** something that happened at a moment: a round (with where it went), a blast, a kick, a door, a whistle … `who` = a cast index or -1 */
export interface ReplayEvent { r: number; k: string; x: number; z: number; who: number; to?: [number, number]; loud?: number; w?: string; }
/** a line: the HUD's message line ('msg'), an order given ('order'), the debrief's timeline ('chron'), the replay's own ('mark': a restart, a load, a page error — ERROR_MARK) */
export interface ReplayLine { r: number; k: 'msg' | 'order' | 'chron' | 'mark'; text: string; }
/** a NOTE the maintainer put on the replay in the viewer: a moment (`r`, with the game clock and step count of the nearest sample), a spot on the floor (or none), words */
export interface ReplayNote { id: string; r: number; t: number; n: number; pos: [number, number] | null; text: string; at: string; }

/** the floor as a drawing: every solid thing between knee and head height as a turned rectangle — [x, z, half-width, half-depth, yaw°, kind] with kind 0 = a wall
 *  (floor to above head height), 1 = low (furniture, cover), 2 = glass — and the doors' hinges */
export interface ReplayMap {
  bounds: [number, number, number, number];
  boxes: number[];
  doors: { name: string; hinge: [number, number]; dir: number; width: number }[];
}

/** THE RUN TAPE (game/runtape.ts): what a headless game is walked through the same run with (tools/qa/rerun.ts) — the recipe, then per step (`f`, from the game's
 *  first) its dt, the player's input and camera, the values the game read off the GPU, and what was done to the game from outside a step. */
export type TapeVal = number | string | null | [number];
/** a tape value read back (`f32`: the sensor values of a tape that says `sens.f32`; [x] = a double kept whole) */
export const tapeNum = (e: TapeVal, f32 = false): number | undefined => e === null ? undefined : typeof e === 'number' ? (f32 ? Math.fround(e) : e) : typeof e !== 'string' ? e[0] : e === 'nan' ? NaN : e === '-0' ? -0 : e === 'inf' ? Infinity : e === '-inf' ? -Infinity : Number(e);
/** a sensor value as a `sens.f32` tape writes it — THE SESSION JOURNAL'S OWN ENCODING (game/sensors.ts SensorEnc: either's reader reads the other's values, the
 *  replay probes hold it): a 32-bit float as nine significant digits (they name exactly one), any other number whole as [x]. Written straight at nine digits,
 *  with no search for a shorter text that would do: this runs inside the step, once per value that changed */
export const tapeF32 = (v: number | undefined): TapeVal => { if (v === undefined) return null; if (v !== v) return 'nan'; if (v === 0) return Object.is(v, -0) ? '-0' : 0; if (!Number.isFinite(v)) return v > 0 ? 'inf' : '-inf';
  const q = +v.toPrecision(9); return Math.fround(q) === v ? q : [v]; };
/** a step's input where it differs from the step before: keys held, keys that went down, clicked bits, buttons, the cursor, the wheel */
export interface TapeInput { k?: string[]; p?: string[]; c?: number; b?: number; m?: [number, number]; w?: number; }
export interface RunTape {
  v: 1; ticks: number;
  /** the game's die, the page's query (+ its level file), the scenario up at the first step, and the journal's env / knobs snapshots (journal.ts EnvSnap / KnobsSnap);
   *  `stand` = where the game stood (the real page, or a headless tool's shipped / frozen stand: a re-run stands the same way; `words` = the stand's env words a
   *  tool was started with, src/host/standEnv.ts), `tables` = every registered knob table that is NOT in `knobs.tables` (knobs.ts knobRegistry — a recording's
   *  tables are a subset of the registry), `kit` = the kit cards (kit.ts KIT: in no registry). All absent on a tape from before they were carried: such a page tape
   *  is re-run on the page's switches for its query, nothing kept per machine */
  recipe: { seed: number | null; search: string; levelFile?: string; scenario: string | null; env: unknown; knobs: unknown; stand?: 'page' | 'shipped' | 'frozen'; words?: Record<string, string>; tables?: Record<string, unknown>; kit?: { on: boolean; members: unknown[] } };
  /** [count, dt] runs · [f, css w, css h, px w, px h] · [f, mask, …changed of: look-at x y z, yaw, pitch, distance, aspect, fov, aim lead] · [f, input] */
  dt: [number, number][]; view: number[][]; cam: TapeVal[][]; input: [number, TapeInput][];
  /** THE LENS, where it was not the pose's: a row for every step whose view matrices were NOT what its nine camera numbers build (camera.ts rebuild) — the host
   *  wrote the pose after the camera last rebuilt (a card closing, an orbit, the tour's pan, a tool) and the step's cursor ray was read off the matrices as they stood.
   *  [f, yaw] = the pose's own with this yaw in place of its own (the usual case: a yaw written a frame ahead of its matrices); [f, …view-projection 16, …its inverse
   *  16, eye x y z, forward x y z] = the matrices themselves. A step with no row: the pose's own. PRESENT, if empty, on every tape made since: absent = a tape from
   *  before it, where tapewalk.ts guesses the yaw of an orbit's step and knows nothing of the rest */
  lens?: TapeVal[][];
  /** the sensor reads: `keys` by index; a row = [f, the step's read sequence as key indices (null: as the step before), values] — values in full with a
   *  sequence, else [position, value, …] for the ones that changed. null = no answer yet; 'nan' / 'inf' / '-inf' / '-0' as words. `f32`: a plain number among
   *  the VALUES is a 32-bit float written to nine significant digits (what the renderer hands back; read it with Math.fround: exact, and half the text), a
   *  value that is not one is [the double]. Absent (a tape from before it): every number is the double itself. Read both with `tapeNum` */
  sens: { keys: string[]; rows: [number, number[] | null, TapeVal[]][]; f32?: 1 };
  /** from outside a step, before step f: 'restart' · 'flags' {…} · 'tune' {…} · 'table' [name, {…}] · 'kit' {…} · 'pose' [the player's place x y z, velocity x y z,
   *  body yaw, aim yaw, hands empty 0 | 1, low 0 | 1 — each a TapeVal: where he was put from outside a step] — and one row that is not from outside: 'posein', the
   *  same ten values, where a restart made INSIDE step f left him (a page's own staging behind it). Both are done by game/runtape.ts tapePoses */
  x: [number, string, unknown?][];
}

export interface ReplayFile {
  v: number; game: 'twopointsix'; kind: 'replay';
  savedAt: string;
  /** the page visit this file is a window of, where the page keeps its tapes by itself (kept.ts: the same id heads that visit's kept tape — a dump is de-duplicated by it) */
  session?: string;
  /** why it was saved: 'key' (F7), 'error: …' (the page's own crash handler), a tool's word. NOT where to look for 'does this file hold a crash': a file saved by the key after an error holds it too — errorMarks() */
  why: string;
  /** the build: the commit the dev server was started on, where it says */
  commit?: string;
  /** the page's query (the level file, the scenario and its seed, the visit's switches) and the browser */
  url?: string; userAgent?: string;
  /** the level's fingerprint (savestate.ts levelFingerprint) and, where known, its file and the scenario's title */
  level: { fp: string; boxes: number; file?: string; scenario?: string };
  /** the game's own die: what it was seeded with */
  seed?: number;
  /** the sandbox switches as they stood at the save — read these before calling a thing a bug */
  flags: Record<string, boolean | number | string>;
  hz: number;
  /** seconds of play in the file, and how much the buffer was asked to keep */
  seconds: number; keep: number;
  map: ReplayMap;
  cast: CastRow[];
  samples: Sample[];
  events: ReplayEvent[];
  lines: ReplayLine[];
  notes: ReplayNote[];
  /** the run tape, when the run could be taped from its first step (else why not): present = `bun run tools/qa/replay-at.ts <file> --rerun` can walk a game to a note */
  rerun?: RunTape | { dead: string; tick: number };
}

/** THE BALLISTIC SHIELD IS GONE FROM THE GAME (10-18). A run tape re-runs the game from its inputs, so a run made with a shield man in it cannot be re-run:
 *  he would stage with his own gun and the run part from the tape at the first round his plate stopped. Both readers say so in words before a re-run starts
 *  (the page's engineplay.ts, tools/qa/rerun.ts); the map viewer plays such a file as ever — its samples are the recording itself. A tape was made with one
 *  when the shield was in that game (its SHIELD table on: every tape before 10-15, a `?shield` visit after) AND a teammate's card carried it or the level
 *  issued it (the long hall's issue block did until the shield went). A card on a man who did not come that day reads the same: such a tape is refused too. */
export function tapeShield(T: RunTape): boolean {
  const rc = T.recipe, tb = (rc.knobs as { tables?: Record<string, unknown> } | null)?.tables?.SHIELD ?? rc.tables?.SHIELD;
  if ((tb as { on?: unknown } | undefined)?.on !== true) return false;
  const carded = rc.kit?.on !== false && (rc.kit?.members ?? []).some((c, i) => i > 0 && (c as { shield?: unknown } | null)?.shield === true);
  const issued = /(^|\/)hall(-gwot)?\.json$/.test(rc.levelFile ?? '') && !new URLSearchParams(rc.search ?? '').has('noissue');
  return carded || issued;
}
export const TAPE_SHIELD = 'This replay was recorded with a ballistic shield, which is no longer in the game';

/** a file's sanity, in words ('' = fine) */
export function checkReplay(F: Partial<ReplayFile> | null | undefined): string {
  if (!F || typeof F !== 'object') return 'not an object';
  if (F.game !== 'twopointsix' || F.kind !== 'replay') return (F as { v?: unknown; save?: unknown }).save ? 'this is a session journal (F10), not a replay (F7): tools/qa/replay.ts reads it' : 'not a twopointsix replay';
  if (F.v !== REPLAY_VERSION) return `replay version ${F.v} (this reader knows ${REPLAY_VERSION})`;
  if (!Array.isArray(F.samples) || !Array.isArray(F.cast) || !Array.isArray(F.events) || !Array.isArray(F.lines)) return 'samples / cast / events / lines missing';
  if (!F.map || !Array.isArray(F.map.boxes) || !Array.isArray(F.map.doors) || !Array.isArray(F.map.bounds) || F.map.bounds.length !== 4) return 'the map is missing';
  if (typeof F.why !== 'string' || typeof F.savedAt !== 'string' || !F.level || typeof F.level !== 'object' || typeof F.seconds !== 'number') return 'the head is incomplete (why / savedAt / level / seconds)';
  if (!Array.isArray(F.notes)) return 'the notes list is missing';
  if (F.samples.length && F.samples[0].k !== 1) return 'the first sample is not a keyframe';
  for (let i = 1; i < F.samples.length; i++) if (!(F.samples[i].r >= F.samples[i - 1].r)) return `sample ${i} goes back in time`;
  if (!Array.isArray(F.notes)) return 'notes missing';
  return '';
}

/** a man at one sample, unfolded */
export interface ManAt { x: number; z: number; yaw: number; aim: number; aw: number; do: ManDo; }
/** a file unfolded: per sample, per cast index, where he was and what he was doing (null = not in the game then); the doors' angles and bits; the camera; the aim */
export interface Decoded {
  file: ReplayFile;
  r: Float64Array;
  men: (ManAt | null)[][];
  doors: { ang: number; bits: number }[][];
  cam: ([number, number, number, number] | null)[];
  aim: ([number, number] | null)[];
}
export function decode(file: ReplayFile): Decoded {
  for (const c of file.cast) if (c.kind === 'player') c.name = PLAYER_NAME;   // (a file kept before the player lost his name says 'Sam')
  const S = file.samples, nC = file.cast.length, nD = file.map.doors.length;
  const r = new Float64Array(S.length); const men: (ManAt | null)[][] = [], doors: { ang: number; bits: number }[][] = [], cam: Decoded['cam'] = [], aim: Decoded['aim'] = [];
  let curM: (ManAt | null)[] = new Array(nC).fill(null), curD = Array.from({ length: nD }, () => ({ ang: 0, bits: 0 }));
  let curC: [number, number, number, number] | null = null, curA: [number, number] | null = null;
  for (let s = 0; s < S.length; s++) {
    const q = S[s]; r[s] = q.r;
    const nextM: (ManAt | null)[] = q.k ? new Array(nC).fill(null) : curM.slice();   // (a keyframe lists every man there is: anybody it leaves out is gone)
    if (q.gone) for (const ci of q.gone) nextM[ci] = null;
    for (const p of q.m ?? []) { const was = curM[p[0]]; nextM[p[0]] = { x: p[1], z: p[2], yaw: p[3], aim: p[4], aw: p[5], do: was ? was.do : {} }; }
    for (const [ci, d] of q.x ?? []) { const at = nextM[ci]; if (at) nextM[ci] = { ...at, do: d }; }
    if (q.d) { curD = curD.map(d => ({ ...d })); for (const [i, ang, bits] of q.d) if (curD[i]) { curD[i].ang = ang; curD[i].bits = bits; } }
    if (q.c) curC = q.c; if (q.a) curA = q.a;
    curM = nextM; men.push(curM); doors.push(curD); cam.push(curC); aim.push(curA);
  }
  return { file, r, men, doors, cam, aim };
}
/** the last sample at or before replay time `r` (0 when before the first) */
export function sampleAt(D: Decoded, r: number): number {
  let lo = 0, hi = D.r.length - 1; if (hi < 0) return 0;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (D.r[mid] <= r) lo = mid; else hi = mid - 1; }
  return lo;
}
/** m:ss.s */
export function clock(sec: number): string { const s = Math.round(Math.max(0, sec) * 10) / 10; const m = Math.floor(s / 60);   // (to the tenth FIRST: 299.96 is 5:00.0, not 4:60.0)
  return `${m}:${(s - m * 60).toFixed(1).padStart(4, '0')}`; }
/** a man's doing in one line of words */
export function doWords(d: ManDo, cast: CastRow[]): string {
  const out: string[] = [];
  if (d.st) out.push(d.st); if (d.down) out.push(`(${d.down})`);
  if (d.ord) out.push(`order ${d.ord}`); if (d.by) out.push(`[${d.by}]`); if (d.task) out.push(`task ${d.task}`);
  if (d.crouch) out.push('crouched'); if (d.slot) out.push(d.slot);
  if (d.foe !== undefined && d.foe >= 0) out.push(`gun on ${cast[d.foe]?.name ?? '?'}`);
  if (d.goal) out.push(`going to (${d.goal[0]}, ${d.goal[1]})`);
  if (d.path?.length) out.push(`route ${d.path.length} pts → (${d.path[d.path.length - 1][0]}, ${d.path[d.path.length - 1][1]})`);
  if (d.fix) out.push(`fix (${d.fix[0]}, ${d.fix[1]})`);
  if (d.sup) out.push(`suppressed ${d.sup}`);
  if (d.say) out.push(`says “${d.say}”`);
  return out.join(' · ');
}
/** the name a replay file goes out under */
export function replayName(f: ReplayFile): string { return `twopointsix-replay-${f.savedAt.replace(/[:.]/g, '-').replace(/Z$/, '')}-${Math.round(f.seconds)}s${f.notes.length ? `-${f.notes.length}notes` : ''}.json`; }
/** hand a replay to the browser as ONE file, the notes that have words in it, gzipped when it is large (the viewer and the tools read both): the map viewer's
 *  'Download with notes' and the engine replay's Save. The name it went out under. */
export async function downloadReplay(F: ReplayFile): Promise<string> {
  const out: ReplayFile = { ...F, notes: F.notes.filter(n => n.text.trim()) }; let name = replayName(out);
  const text = JSON.stringify(out); let blob = new Blob([text], { type: 'application/json' });
  if (text.length > 3e6 && typeof CompressionStream !== 'undefined') { try { blob = await new Response(blob.stream().pipeThrough(new CompressionStream('gzip'))).blob(); name += '.gz'; } catch { /* plain */ } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  return name;
}

// ── ONE WINDOW (the maintainer, 10-15: "replays should just play in the current window, not open a new tab"): the game page leaves a mark when it goes to a
//    replay, and each replay page's '‹ Game' reads it. Here, not in ui/replaykey.ts, because the map viewer's page reads it too and carries none of the game.
/** where this window was when it left for a replay (sessionStorage: this tab's own): the address, the history SLOT it was in (the Navigation API's entry key —
 *  the count of entries cannot tell where a window stands once it has gone Back) and the shelf entry it left for. ONE TRIP'S: a game page that is up again drops it
 *  (ReplayKey's constructor, and its pageshow for a page handed back as it was left), so a replay reached later by another road finds none and goes to the
 *  game's own page. */
export const CAME_FROM = 'twopointsix.replay.from';
type Slots = { currentEntry?: { key?: string } | null; entries?: () => { key: string }[]; traverseTo?: (key: string) => { committed?: Promise<unknown>; finished: Promise<unknown> } };
const slots = (): Slots | null => { try { return (globalThis as { navigation?: Slots }).navigation ?? null; } catch { return null; } };
/** this window goes to a replay page — never a new tab — leaving the mark its way back reads */
export function leaveFor(url: string, id: number): void {
  try { sessionStorage.setItem(CAME_FROM, JSON.stringify({ href: location.href, key: slots()?.currentEntry?.key ?? null, id })); } catch { /* a private window: Back is the browser's */ }
  location.assign(url);
}
/** the way back from a replay page on shelf entry `id` to the game it was left for: THAT entry of this window's history when it is still there (however many
 *  hops between the replay and the map lie between — the browser may hand the game page back as it was left), else the address left, else `home`. A mark left
 *  for another shelf entry, or by no game page, is not trusted. No Navigation API (an older browser): the address. */
export function backToGame(id: number | null, home: string): void {
  // (ONE PRESS, ONE GOING: a second inside the wait is not a second road — and the mark is READ, not taken: a press after the wait, on a page still here, goes the
  // same way again and not to `home`. The game page drops the mark when it is up again: ReplayKey's constructor, and its pageshow)
  const now = performance.now(); if (now - wentAt < BACK_MS) return; wentAt = now;
  try { window.addEventListener('pageshow', () => { wentAt = -1e9; }, { once: true }); } catch { /* */ }   // (this page handed back as it was left takes the next press at once)
  let from: { href?: string; key?: string | null; id?: number } | null = null;
  try { from = JSON.parse(sessionStorage.getItem(CAME_FROM) ?? 'null'); } catch { /* */ }
  if (from && (id === null || from.id !== id || typeof from.href !== 'string' || /[?&]playtape=/.test(from.href))) from = null;
  const to = from?.href ?? home, N = slots(), key = from?.key;
  let there = false; try { there = !!key && !!N?.traverseTo && !!N.entries?.().some(e => e.key === key); } catch { /* */ }
  if (!there) { location.assign(to); return; }
  // (a traverse that fails rejects BOTH its promises: each is caught — the page's own net for a rejection nobody caught is a fatal card — and the address makes it good)
  try { const T = N!.traverseTo!(key!); T.committed?.catch(() => { /* finished's catch goes by the address */ }); T.finished.catch(() => { if (document.visibilityState === 'visible') location.assign(to); }); } catch { location.assign(to); }
}
let wentAt = -1e9; const BACK_MS = 8000;
