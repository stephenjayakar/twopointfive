// The 'orderkeys' family: EVERY ORDER IS WITHIN REACH OF THE LEFT HAND — no row of any order menu, in any scenario on the start card's list, is on a digit above
// ORDER_DIGITS (5) (the maintainer, 10-04: "it's hard to hit numbers bigger than 5 when left hand is on wasd"). Run through probes.ts:
//   bun run tools/qa/probes.ts orderkeys | orderkeys-walk | orderkeys-give | orderkeys-four | orderkeys-high | orderkeys-table
// PASS / FAIL each, all headless (the Game of headless.ts stood up on each row's own level; nothing is drawn — the menu is read as the data the panel is built
// from). THE SCENARIOS are scene/scenarioList.ts SCENARIOS, row by row, each started the way a click on its row starts it (game/scenarioRun.ts startFromQuery
// on scenarioQuery(entry), on its own level file), plus the one hand-typed combination that stages a team the list does not (?nightbreach&squad4).
//   orderkeys-walk    in each scenario: X pressed on a spot of floor, on Sam, on a teammate and on a door, and the menu opened on EVERY door of the level;
//                     every page of every one of those menus is walked BY ITS KEYS (the row that opens a page pressed, Esc back, a right click back, X to
//                     close) and every row read twice — as the order table has it (OrderDef.key / hotKey) and as the panel shows it (hud().menu). A row FAILS
//                     when its digit is above ORDER_DIGITS, when it has no key at all, when its key is not one of the left hand's (X T B F, 1 to 5), when two
//                     rows of a page share a digit, or when the panel shows another key than the one that gives it. The hint line may name no digit.
//   orderkeys-give    in each scenario: every row of every page, on each kind of target, GIVEN by the keys the walk read — X, then the digits — on a fresh
//                     staging: the order is logged as that order and the menu is gone (a row greyed there, with its reason, must be refused and log
//                     nothing: it is counted apart). Only X and the digits 1 to ORDER_DIGITS are ever pressed.
//   orderkeys-four    the four's two rows that are not orders, from the left hand: 'wait for my word' flipped by its digit on the tools page, by F there,
//                     and by F from the door's first page (which turns to the tools with it on); the word given by F with a floor menu up and with none
//   orderkeys-high    the digits above ORDER_DIGITS (and 0) pressed with each page of each menu up: nothing given, the menu as it was, Sam's slot as it was
//   orderkeys-table   the table itself: ORDER_DIGITS is 5, the keys the orders read are X T B F and nothing else, register() never deals a digit above it
//                     (a page of twelve rows: five digits, the rest on the wheel), and no line of the order path names a digit key above it
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { standUp, ROOT } from './headless.ts';
const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const { scenarioQuery } = await import(`${ROOT}/src/scene/scenarios.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { NIGHTBREACH } = await import(`${ROOT}/src/game/nightbreach.ts`);
const { ROOMCLEAR } = await import(`${ROOT}/src/game/roomclear.ts`);
const { RESCUE } = await import(`${ROOT}/src/game/rescue.ts`);
const { DOORTOOLS } = await import(`${ROOT}/src/game/doortools.ts`);
const { ORDERS, ORDER_DIGITS, WORD_HEAD } = await import(`${ROOT}/src/game/orders.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { withOfficeScript, isOfficeFamily } = await import(`${ROOT}/src/scene/level.ts`);

const DT = 1 / 60;
const VERBOSE = process.argv.includes('--verbose');
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const clone = (o: any) => JSON.parse(JSON.stringify(o));
const DEFAULTS = { DT: clone(DOORTOOLS), RC: clone(ROOMCLEAR), NB: clone(NIGHTBREACH), RS: clone(RESCUE), ORD: clone(ORDERS) };
const reset = () => { Object.assign(DOORTOOLS, clone(DEFAULTS.DT)); Object.assign(ROOMCLEAR, clone(DEFAULTS.RC)); Object.assign(NIGHTBREACH, clone(DEFAULTS.NB)); Object.assign(RESCUE, clone(DEFAULTS.RS)); Object.assign(ORDERS, clone(DEFAULTS.ORD)); };
/** every probe leaves the knob tables as it found them, and one that throws is a FAIL line, not a crash of the runner */
const guarded = (fn: () => Promise<boolean>) => async () => { try { return await fn(); } catch (e) { console.log(`- FAIL — the probe threw\n    ${e instanceof Error ? e.stack : String(e)}`); return false; } finally { reset(); } };
const quiet = <T>(fn: () => T): T => { if (VERBOSE) return fn(); const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { }; try { return fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const levelOfFile = (file: string): any => { const data = parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8')); return isOfficeFamily(data) ? withOfficeScript(loadLevel(data)) : loadLevel(data); };

/** the scenarios walked: the list's rows, and the one team the list does not stage */
interface Scn { name: string; query: string; level?: string; squad: 2 | 4 }
const LIST: Scn[] = [
  ...SCENARIOS.map((e: any) => ({ name: e.title as string, query: scenarioQuery(e) as string, level: e.level as string | undefined, squad: e.squad as 2 | 4 })),
  { name: 'Night breach with the four (typed, not on the list)', query: '?nightbreach&squad4', squad: 4 },
];
/** the keys of the left hand an order may be on: its own four letters and the digits it reaches off W A S D */
const LETTERS = ['X', 'T', 'B', 'F', 'G'];   // (G: the door tools' frag row — the key beside F, where the page's five digits are taken)
const leftKey = (k: string) => LETTERS.includes(k) || (/^[1-9]$/.test(k) && Number(k) <= ORDER_DIGITS);
const nameOf = (code: string) => code.replace(/^Key|^Digit/, '');

/** One game on the scenario's own level with the scenario started as its row starts it. step() keeps Sam dark and the defenders dazzled (this family is about
 *  the keys, not the fight) and writes down every key code the probe presses. */
async function rig(scn: Scn, seed = 21) {
  reset(); Math.random = seeded(0x0b5e + seed * 7919);
  let W: any; let why: string | null = null;
  { const log = console.log, err = console.error, warn = console.warn; if (!VERBOSE) console.log = console.error = console.warn = () => { };
    try { W = await standUp({ uploadEvery: 4, ...(scn.level ? { level: levelOfFile(scn.level) } : {}) }); W.game.godMode = true; why = startFromQuery(W.game, new URLSearchParams(scn.query)).why; }
    finally { console.log = log; console.error = err; console.warn = warn; } }
  const game = W.game, input = W.input, O = game.orders, D = game.doorTools;
  const R = { W, game, input, O, D, scn, why,
    /** every key code this rig pressed, in order (the proof that nothing above ORDER_DIGITS was needed) */
    pressed: [] as string[],
    aim: null as number[] | (() => number[]) | null,
    get ops(): any[] { return O.squad(); },
    hostiles(): any[] { return [...(game.nightBreach.hostiles ?? []), ...(game.rescue.hostiles ?? [])]; },
    step(n = 1) { quiet(() => { for (let i = 0; i < n; i++) {
      game.player.visibility = 0.05; for (const h of R.hostiles()) if (h.state !== 'dead') h.dazzledUntil = game.time + 5;
      if (R.aim) { const p = typeof R.aim === 'function' ? R.aim() : R.aim; W.cursorAt([p[0], p[1], p[2]]); }
      W.step(DT); } }); },
    until(pred: () => boolean, secs: number) { for (let i = 0; i < secs * 60 && !pred(); i++) R.step(); return pred(); },
    /** a one-frame press, as the page's keydown writes it */
    press(code: string) { R.pressed.push(code); input.pressed.add(code); R.step(); },
    rclick() { input.clicked |= 4; R.step(); },
    last(): any { return O.log[O.log.length - 1] ?? null; },
    /** the scenario's own restart, Sam where it puts him */
    fresh() { quiet(() => game.restartEncounter()); R.aim = null; R.step(20); },
    /** Sam put on a free spot ~1.5 m off a door (either face, the first with floor), the cursor on the door: X then opens on it. False: no floor by it */
    atDoor(d: any): boolean {
      const th = d.def.closedDir, nx = -Math.sin(th), nz = Math.cos(th), c = d.frameCentre;
      for (const off of [1.5, -1.5, 1.2, -1.2, 2.0, -2.0]) { const p = [c[0] + nx * off, 0, c[2] + nz * off]; if (game.col.nav.isBlocked(p[0], p[2])) continue;
        quiet(() => game.teleportPlayer(p)); R.aim = [c[0], 1.0, c[2]]; R.step(20);
        if (O.targetUnder(input, W.cam, W.canvas).door === d) return true; }
      return false;
    },
    /** the cursor on a spot of floor near Sam that the orders take for floor (null: none found) */
    onFloor(): number[] | null {
      const s = game.player.char.pos;
      for (const r of [1.8, 2.4, 1.4, 3.0]) for (let k = 0; k < 8; k++) { const p = [s[0] + Math.sin(k * Math.PI / 4) * r, 0.03, s[2] + Math.cos(k * Math.PI / 4) * r];
        if (game.col.nav.isBlocked(p[0], p[2])) continue; R.aim = p; R.step(2); if (O.targetUnder(input, W.cam, W.canvas).kind === 'floor') return p; }
      return null;
    },
    onSam() { R.aim = () => { const p = game.player.char.pos; return [p[0], 0.05, p[2]]; }; R.step(2); },
    onMan(k = 0) { R.aim = () => { const m = R.ops[k].char.pos; return [m[0], 1.2, m[2]]; }; R.step(2); },
    /** X pressed on what the cursor is on, then a few frames with every key up: the menu (or null) */
    openX(wait = 6): any { R.press(ORDERS.key); R.step(wait); return O.menu; },
  };
  // the family's own red path (ORDERKEYS_BREAK=1 bun run tools/qa/probes.ts orderkeys-walk must FAIL): one tool put back on a digit out of reach
  if (process.env.ORDERKEYS_BREAK) { const d = O.defs.find((x: any) => x.id === 'bangClear'); if (d) d.key = 7; }
  R.step(30);
  return R;
}
type Rig = Awaited<ReturnType<typeof rig>>;

/** A page of an open menu, read both ways: the order table's rows and the panel's. */
interface RowRead { id: string; digit: number | null; hot: string | null; opens: string | null; why: string | null; shown: string }
interface PageRead { page: string | null; rows: RowRead[]; wait: { shown: string; digit: number } | null; hint: string; bad: string[]; /** the keys that turn the menu to it (walkMenu's): a digit, or the code of an opener's own letter */ via?: (number | string)[] }
function readPage(O: any): PageRead {
  const M = O.menu, hud = O.hud().menu; const bad: string[] = [];
  // the panel: [who row, …one row an order…, (the wait row), the cancel row]
  const panel = (hud?.rows ?? []).slice(1, 1 + M.rows.length);
  const rows: RowRead[] = M.rows.map((d: any, i: number) => ({ id: d.id, digit: d.key ?? null, hot: d.hotKey ? nameOf(d.hotKey) : null, opens: d.opens ?? null, why: M.why[i] ?? null, shown: String(panel[i]?.opts?.[0]?.key ?? '') }));
  const where = `page ${M.page ?? 'first'}`;
  const digits = rows.filter(r => r.digit !== null).map(r => r.digit as number);
  for (const r of rows) {
    if (r.digit !== null && !(Number.isInteger(r.digit) && r.digit >= 1 && r.digit <= ORDER_DIGITS)) bad.push(`${where}: '${r.id}' is on digit ${r.digit}`);
    if (r.digit === null && !r.hot) bad.push(`${where}: '${r.id}' has no key at all`);
    const want = r.digit !== null ? String(r.digit) : r.hot ?? '';
    if (r.shown !== want) bad.push(`${where}: '${r.id}' is given by ${want || 'nothing'} but the panel shows "${r.shown}"`);
    if (!leftKey(r.shown)) bad.push(`${where}: '${r.id}' shows "${r.shown}", not a key of the left hand`);
  }
  if (new Set(digits).size !== digits.length) bad.push(`${where}: two rows share a digit (${digits.join(' ')})`);
  if (digits.length > ORDER_DIGITS) bad.push(`${where}: ${digits.length} rows on digits`);
  let wait: PageRead['wait'] = null;
  if (M.wordRow) { const w = hud?.rows?.[1 + M.rows.length], shown = String(w?.opts?.[0]?.key ?? ''); wait = { shown, digit: /^[1-9]$/.test(shown) ? Number(shown) : 0 };
    if (w?.label !== WORD_HEAD || !/wait for my word/.test(w?.opts?.[0]?.text ?? '')) bad.push(`${where}: the wait row is not where the panel has it`);
    if (!leftKey(shown)) bad.push(`${where}: the wait row shows "${shown}"`);
    if (wait.digit && digits.includes(wait.digit)) bad.push(`${where}: the wait row shares digit ${wait.digit} with an order`); }
  const hint = String(hud?.hint ?? ''); if (/\d/.test(hint)) bad.push(`${where}: the hint line names a digit ("${hint}")`);
  for (const r of hud?.rows ?? []) for (const o of r.opts ?? []) if (/^\d+$/.test(o.key) && !(Number(o.key) >= 1 && Number(o.key) <= ORDER_DIGITS)) bad.push(`${where}: the panel shows key "${o.key}" (${o.text})`);
  return { page: M.page ?? null, rows, wait, hint, bad };
}
const rowWords = (r: RowRead) => `${r.digit ?? r.hot ?? '—'} ${r.id}${r.opens ? ' ▸' : ''}`;
const pageWords = (p: PageRead) => `${p.page ? `[${p.page}] ` : ''}${p.rows.map(rowWords).join(' · ')}${p.wait ? ` · ${p.wait.shown} wait` : ''}`;

/** The open menu walked by its keys: its first page read, each row that opens a page pressed (the page read — and the pages behind ITS openers, the same way;
 *  Esc back a page; pressed again; a right click back). Returns the pages, each with the digits that turn to it (`via`), and what went wrong on the way. The menu
 *  is left up on its first page. */
const keyCode = (k: number | string) => typeof k === 'number' ? `Digit${k}` : k;
function walkMenu(R: Rig): { pages: PageRead[]; bad: string[] } {
  const O = R.O, M = O.menu; const bad: string[] = [], pages: PageRead[] = [];
  /** the page now up, read, then every page behind it; false = the menu went away under the walk */
  const walk = (via: (number | string)[]): boolean => {
    const here = readPage(O); here.via = via; pages.push(here);
    const name = (p: string | null) => p === null ? 'the first page' : `'${p}'`;
    for (const r of here.rows.filter(x => x.opens)) {
      // (an opener sits on a digit, or on a letter of its own — the squad's throws are on G, where the first page's five digits are taken)
      if (r.digit === null && !r.hot) { bad.push(`'${r.id}' opens a page but has no key`); continue; }
      const k: number | string = r.digit ?? `Key${r.hot}`, code = keyCode(k);
      R.press(code); R.step(3);
      if (O.menu !== M || M.page !== r.opens) { bad.push(`${r.digit ?? r.hot} did not turn the menu to '${r.opens}'`); if (!O.menu) return false; continue; }
      if (!walk([...via, k])) return false;
      R.press('Escape'); R.step(2); if (O.menu !== M || M.page !== here.page) { bad.push(`Esc on '${r.opens}' did not step back to ${name(here.page)}`); if (!O.menu) return false; }
      R.press(code); R.step(2); R.rclick(); R.step(2); if (O.menu !== M || M.page !== here.page) { bad.push(`a right click on '${r.opens}' did not step back to ${name(here.page)}`); if (!O.menu) return false; }
    }
    return true;
  };
  walk([]);
  for (const p of pages) bad.push(...p.bad);
  return { pages, bad };
}

// ---------------------------------------------------------------- every menu of every scenario, walked
export const orderkeysWalk = guarded(async () => {
  const { verdict, done } = family(`orderkeys-walk: every order menu of every scenario on the list, walked by its keys — no row on a digit above ${ORDER_DIGITS}`);
  let menus = 0, rowsSeen = 0, top = 0; const shapes = new Set<string>();
  for (const scn of LIST) {
    const R = await rig(scn); const { O, game: g } = R; const bad: string[] = [], seen: string[] = []; let n = 0, doors = 0, rows = 0;
    if (R.why !== null || !O.active || R.ops.length !== scn.squad) { verdict(false, `${scn.name} (${scn.query}): staged with its ${scn.squad} teammates`, `${R.why ?? 'started'} · ${O.summary()}`); continue; }
    const take = (what: string, M: any) => {
      if (!M) { bad.push(`${what}: X opened no menu`); return; }
      const w = walkMenu(R); n++; bad.push(...w.bad.map(b => `${what} — ${b}`));
      for (const p of w.pages) { rows += p.rows.length + (p.wait ? 1 : 0); for (const r of p.rows) if (r.digit !== null) top = Math.max(top, r.digit); if (p.wait?.digit) top = Math.max(top, p.wait.digit); }
      const shape = w.pages.map(pageWords).join('  ‖  '); shapes.add(`${scn.squad === 4 ? 'four' : 'pair'} · ${M.target.kind === 'none' ? (M.target.man ? 'teammate' : 'Sam') : M.target.kind}: ${shape}`); if (!seen.includes(`${what.split(' ')[0]}: ${shape}`)) seen.push(`${what.split(' ')[0]}: ${shape}`);
      R.press(ORDERS.key); if (O.menu) bad.push(`${what}: X did not close the menu`);
    };
    // from where the scenario puts Sam: the floor, himself, a teammate — each by X on the cursor
    const spot = R.onFloor(); if (!spot) bad.push('no spot of floor found near Sam'); else { const M = R.openX(); if (M && M.target.kind !== 'floor') bad.push(`floor: the menu opened on ${M.target.kind}`); take('floor', M); }
    R.onSam(); { const M = R.openX(); if (M && !(M.target.kind === 'none' && !M.target.man)) bad.push(`Sam: the menu opened on ${M.target.kind}`); take('Sam', M); }
    R.onMan(0); { const M = R.openX(); if (M && !(M.target.kind === 'none' && M.target.man === R.ops[0])) bad.push(`teammate: the menu opened on ${M.target.kind}`); take('teammate', M); }
    // every door of the level: X on the cursor where Sam can be stood by it and the cursor finds it; else the menu opened on it directly (its keys pressed all the same)
    let byX = 0;
    for (const d of g.doors.list) {
      doors++; let M: any = null;
      if (R.atDoor(d)) { M = R.openX(); if (M && M.target.door === d) byX++; else { if (O.menu) R.press(ORDERS.key); M = null; } }
      if (!M) { R.aim = null; O.open(O.targetAt(d.frameCentre)); R.step(2); M = O.menu; if (M && M.target.door !== d) { bad.push(`door ${d.def.name}: opened on something else`); } }
      take(`door ${d.def.name}`, M);
    }
    const high = R.pressed.filter(c => /^Digit/.test(c) && !(Number(c.slice(5)) >= 1 && Number(c.slice(5)) <= ORDER_DIGITS));
    menus += n; rowsSeen += rows;
    verdict(bad.length === 0 && high.length === 0 && n === 3 + doors && byX > 0, `${scn.name} (${scn.query}): ${n} menus — the floor, Sam, a teammate and all ${doors} doors — every page walked by its keys, every row on 1 to ${ORDER_DIGITS} or F`,
      `${bad.length ? `WRONG: ${bad.slice(0, 6).join(' | ')}${bad.length > 6 ? ` (+${bad.length - 6} more)` : ''} · ` : ''}${rows} rows · ${byX} of ${doors} doors opened by X on the cursor · digits pressed above ${ORDER_DIGITS}: ${high.length}\n    ${seen.join('\n    ')}`);
  }
  verdict(top > 0 && top <= ORDER_DIGITS, `over all ${LIST.length} scenarios: the highest digit any row is on is ${top}`, `${menus} menus walked · ${rowsSeen} rows read · ${shapes.size} distinct menus:\n    ${[...shapes].sort().join('\n    ')}`);
  return done();
});

// ---------------------------------------------------------------- every row given by the keys the walk read
export const orderkeysGive = guarded(async () => {
  const { verdict, done } = family(`orderkeys-give: every row of every page given by X and digits 1 to ${ORDER_DIGITS}, in every scenario on the list`);
  let allGiven = 0, allGrey = 0, allRows = 0;
  for (const scn of LIST) {
    const R = await rig(scn); const { O, D, game: g } = R; if (R.why !== null || !O.active) { verdict(false, `${scn.name}: staged`, String(R.why)); continue; }
    // the door this scenario's rows are given on: the nearest to Sam's start that X on the cursor opens on, the men called over first (X on Sam, 3)
    const s0 = [...g.player.char.pos], doorsNear = [...g.doors.list].sort((a: any, b: any) => dist(a.frameCentre, s0) - dist(b.frameCentre, s0));
    let door: any = null; for (const d of doorsNear) { if (R.atDoor(d)) { door = d; break; } } R.fresh();
    const out: string[] = []; let given = 0, grey = 0, rowsN = 0, wrong = 0;
    /** the letters the walk found a page's opener on (the squad's throws: G) — pressed to turn to that page, and no other letter is */
    const openers = new Set<string>();
    const stage = (kind: string): boolean => {
      R.fresh();
      if (kind === 'door') { R.onSam(); R.openX(); R.press('Digit3'); R.aim = null;   // fall in, by presses: the men come to the door with Sam
        if (!door || !R.atDoor(door)) return false; const sam = g.player.char.pos; R.until(() => R.ops.every((m: any) => m.state === 'dead' || dist(m.char.pos, sam) < 3 + 1.2 * R.ops.length), 14); R.step(20); return true; }
      if (kind === 'floor') return !!R.onFloor(); if (kind === 'Sam') { R.onSam(); return true; } R.onMan(0); return true;
    };
    for (const kind of ['floor', 'door', 'Sam', 'teammate']) {
      if (!stage(kind)) { out.push(`${kind}: could not be staged`); wrong++; continue; }
      // the paths to press: [digit] for a row of the first page, [the digits that turn to its page …, digit] for a row of a page
      const M0 = R.openX(); if (!M0) { out.push(`${kind}: no menu`); wrong++; continue; }
      const w = walkMenu(R); R.press(ORDERS.key);
      const paths: { id: string; keys: (number | string)[] }[] = [];
      for (const p of w.pages) for (const r of p.rows) { if (r.opens || r.digit === null) continue; paths.push({ id: r.id, keys: [...(p.via ?? []), r.digit] }); }
      for (const path of paths) { for (const k of path.keys) if (typeof k === 'string') openers.add(k);
        rowsN++; if (!stage(kind)) { wrong++; continue; }
        const l0 = O.log.length; const M = R.openX(); for (const k of path.keys.slice(0, -1)) { R.press(keyCode(k)); R.step(2); }
        // (the rows are re-read on the frame of the press: the men may still be walking up, and a line one of them gains between the menu's read and the key is
        //  the game re-asking on the press as it always does, not a row answering wrongly)
        if (M && O.menu === M) O.refresh();
        const i = M && O.menu === M ? M.rows.findIndex((r: any) => r.id === path.id) : -1, why = i >= 0 ? M.why[i] : 'not on the page';
        // (the order is the first thing logged on the press; a scenario may log one of its own behind it — the rescue calls the other man in on Sam's first order)
        R.press(`Digit${path.keys[path.keys.length - 1]}`); const l = O.log[l0] ?? null, logged = O.log.length - l0, own = O.log.slice(l0 + 1).every((x: any) => x.order === 'fallIn'); R.step(2);
        const keys = `X ${path.keys.map(k => typeof k === 'number' ? k : nameOf(k)).join(' ')}`;
        if (!why && logged >= 1 && own && l?.order === path.id && O.menu === null) { given++; out.push(`${kind} ${keys} ${path.id}: given${logged > 1 ? ` (+${logged - 1} of the scenario's own)` : ''}`); }
        else if (why && logged === 0 && O.menu === null) { grey++; out.push(`${kind} ${keys} ${path.id}: greyed there (${why}) and refused`); }
        else { wrong++; out.push(`${kind} ${keys} ${path.id}: WRONG — ${why ? `greyed (${why}) ` : ''}logged ${logged}${l ? ` (${l.order})` : ''}, menu ${O.menu ? 'still up' : 'gone'}`); }
      }
    }
    const high = R.pressed.filter(c => /^Digit/.test(c) && !(Number(c.slice(5)) >= 1 && Number(c.slice(5)) <= ORDER_DIGITS)), other = [...new Set(R.pressed.filter(c => !/^Digit/.test(c) && c !== ORDERS.key && c !== 'Escape' && !openers.has(c)))];
    allGiven += given; allGrey += grey; allRows += rowsN; void D;
    verdict(wrong === 0 && rowsN > 0 && given > 0 && high.length === 0 && other.length === 0, `${scn.name} (${scn.query}): each of its ${rowsN} rows pressed by X and its digits answers as that row — ${given} given, ${grey} greyed where it stood and refused`,
      `${door ? `door ${door.def.name}` : 'NO DOOR Sam could be stood by'} · keys pressed: X, Esc, digits ${[...new Set(R.pressed.filter(c => /^Digit/.test(c)).map(c => c.slice(5)))].sort().join(' ')} · above ${ORDER_DIGITS}: ${high.length}${other.length ? ` · OTHER KEYS: ${other.join(' ')}` : ''}\n    ${out.join(' · ')}`);
  }
  verdict(allRows > 0 && allGiven + allGrey === allRows, `over all ${LIST.length} scenarios: every row answered to its keys`, `${allRows} rows · ${allGiven} given · ${allGrey} greyed and refused`);
  return done();
});

// ---------------------------------------------------------------- the four: the wait row and the word, from the left hand
export const orderkeysFour = guarded(async () => {
  const { verdict, done } = family('orderkeys-four: the four\'s "wait for my word" and the word itself, on keys of the left hand');
  for (const scn of LIST.filter(s => s.squad === 4)) {
    const R = await rig(scn); const { O, D, game: g } = R; if (R.why !== null || !O.active || !O.big) { verdict(false, `${scn.name}: staged with four`, `${R.why} · ${O.summary()}`); continue; }
    // the door: the nearest to Sam's start that X on the cursor opens on and whose 'open and clear' is live there (not a way out of the building, say)
    const s0 = [...g.player.char.pos]; let door: any = null;
    for (const d of [...g.doors.list].sort((a: any, b: any) => dist(a.frameCentre, s0) - dist(b.frameCentre, s0))) {
      if (!R.atDoor(d)) continue; const M = R.openX(); if (!M || M.target.door !== d) { if (O.menu) R.press(ORDERS.key); continue; }
      R.press(`Digit${M.rows.find((r: any) => r.opens)?.key}`); const i = O.menu ? O.menu.rows.findIndex((r: any) => r.id === 'openClear') : -1, live = !!O.menu && i >= 0 && !O.menu.why[i]; if (O.menu) R.press(ORDERS.key);
      if (live) { door = d; break; } }
    const out: string[] = []; let ok = !!door;
    const near = () => { R.fresh(); R.onSam(); R.openX(); R.press('Digit3'); R.aim = null; R.atDoor(door); const sam = g.player.char.pos; R.until(() => R.ops.every((m: any) => dist(m.char.pos, sam) < 8), 14); R.step(20); };
    if (door) for (const how of ['5 on the tools page', 'F on the tools page', 'F on the door\'s first page']) {
      near(); const M = R.openX(), toolsKey = M?.rows.find((r: any) => r.opens)?.key, p0 = M ? readPage(O) : null; let flipped = false;
      if (how.startsWith('F on the door')) { R.press(DOORTOOLS.blowKey); flipped = O.menu === M && M.page !== null && M.onWord === true; }
      else { R.press(`Digit${toolsKey}`); const p = readPage(O); if (how.startsWith('5')) R.press(`Digit${p.wait?.digit}`); else R.press(DOORTOOLS.blowKey); flipped = O.menu === M && M.onWord === true && (p.wait?.digit ?? 0) >= 1 && (p.wait?.digit ?? 9) <= ORDER_DIGITS; }
      const shown = O.menu ? readPage(O) : null, l0 = O.log.length, open = shown?.rows.find(r => r.id === 'openClear');
      R.press(`Digit${open?.digit}`); const l = R.last(), op = D.ops.find((o: any) => o.kind === 'openClear' && o.door === door), waits = O.log.length === l0 + 1 && l?.order === 'openClear' && !!op && op.onWord === true;
      const ready = R.until(() => !!op && op.phase === 'ready', 30); /* 30 s: Sam is PUT at the door here, so on the barracks the way to his face is not known floor and the men come the long way round (cleared.ts) */ R.step(40); const still = !!op && op.phase === 'ready' && Number.isNaN(op.openT);
      // the word, by F: once with a floor menu up (its row shows F), once with no menu
      const withMenu = how.startsWith('5'); let goShown = true; const l1 = O.log.length;
      if (withMenu) { R.onFloor(); const Mf = R.openX(); const pf = Mf ? readPage(O) : null, go = pf?.rows.find(r => r.id === 'go'); goShown = !!go && go.shown === nameOf(DOORTOOLS.blowKey) && go.digit === null && !go.why; }
      else { R.aim = null; R.step(2); }
      R.press(DOORTOOLS.blowKey); const lg = R.last(), went = O.log.length === l1 + 1 && lg?.order === 'go'; const moved = R.until(() => !op || !op.onWord || op.phase !== 'ready', 4);
      const good = !!toolsKey && toolsKey <= ORDER_DIGITS && !!p0 && flipped && waits && ready && still && goShown && went && moved; ok &&= good;
      out.push(`${how}: ${flipped ? 'wait ON, menu still up' : 'DID NOT FLIP'} → ${open?.digit} open and clear ${waits ? 'on the word' : 'NOT WAITING'} → ${still ? 'stacked and held' : 'DID NOT HOLD'} → F ${withMenu ? `with a floor menu up (its go row shows ${goShown ? 'F' : 'SOMETHING ELSE'})` : 'with no menu'}: ${went ? 'the word' : 'NO WORD'}${moved ? ', they go' : ', NOTHING MOVED'}`);
      if (O.menu) R.press(ORDERS.key);
    }
    // 'wait for my word' is the menu's, not the page's: on, a step back to the door's first page and into the tools again leaves it on (and the first page says so)
    if (door) { near(); const M = R.openX(), toolsKey = M?.rows.find((r: any) => r.opens)?.key; R.press(`Digit${toolsKey}`); R.press(`Digit${readPage(O).wait?.digit}`); const on0 = O.menu?.onWord === true;
      R.press('Escape'); const first = O.menu === M && M.page === null, said = (O.hud().menu?.rows ?? []).flatMap((r: any) => r.opts).find((o: any) => /▸/.test(o.text))?.text ?? '';
      R.press(`Digit${toolsKey}`); const kept = O.menu === M && M.page !== null && M.onWord === true; R.press(ORDERS.key); const gone = !O.menu; R.atDoor(door); const M2 = R.openX(), fresh = !!M2 && M2.onWord === false; if (O.menu) R.press(ORDERS.key);
      const good = on0 && first && /on my word: ON$/.test(said) && kept && gone && fresh; ok &&= good;
      out.push(`wait ON, Esc back, ${toolsKey} again: ${first ? `first page reads "${said}"` : 'NOT BACK ON THE FIRST PAGE'} → ${kept ? 'still ON on the tools page' : 'WAIT WAS DROPPED'} · a new menu starts ${fresh ? 'off' : 'ON'}`); }
    const high = R.pressed.filter(c => /^Digit/.test(c) && !(Number(c.slice(5)) >= 1 && Number(c.slice(5)) <= ORDER_DIGITS));
    verdict(ok && high.length === 0, `${scn.name} (${scn.query}): a tool given to wait and then sent, three ways, without a digit above ${ORDER_DIGITS}`, `${door ? `door ${door.def.name}` : 'NO DOOR'} · digits pressed above ${ORDER_DIGITS}: ${high.length}\n    ${out.join('\n    ')}`);
  }
  return done();
});

// ---------------------------------------------------------------- the digits above the reach do nothing
export const orderkeysHigh = guarded(async () => {
  const { verdict, done } = family(`orderkeys-high: the digits above ${ORDER_DIGITS} (and 0) give nothing, with any page of any menu up or with none`);
  const HIGH = ['Digit0', ...Array.from({ length: 9 - ORDER_DIGITS }, (_, i) => `Digit${ORDER_DIGITS + 1 + i}`)];
  for (const scn of [LIST.find(s => s.squad === 2 && !s.level)!, LIST.find(s => s.squad === 4 && !s.level)!]) {
    const R = await rig(scn); const { O, D, game: g, input } = R; if (R.why !== null || !O.active) { verdict(false, `${scn.name}: staged`, String(R.why)); continue; }
    const s0 = [...g.player.char.pos]; let door: any = null; for (const d of [...g.doors.list].sort((a: any, b: any) => dist(a.frameCentre, s0) - dist(b.frameCentre, s0))) { if (R.atDoor(d)) { door = d; break; } }
    const out: string[] = []; let ok = !!door; const l0 = O.log.length, slot0 = g.player.slot, ops0 = D.ops.length;
    const hit = (what: string) => { const M = O.menu, page = M?.page ?? null, sel = M?.sel, onWord = M?.onWord, rows = M?.rows.length;
      for (const c of HIGH) { input.pressed.add(c); R.step(); }
      const same = O.menu === M && (!M || (M.page === page && M.sel === sel && M.onWord === onWord && M.rows.length === rows)), quietLog = O.log.length === l0 && D.ops.length === ops0 && g.player.slot === slot0;
      ok &&= same && quietLog; out.push(`${what}: ${same ? 'as it was' : 'CHANGED'}${quietLog ? '' : ' · SOMETHING WAS GIVEN'}`); };
    R.aim = null; R.step(2); hit('no menu');
    R.onFloor(); R.openX(); hit('floor menu'); R.press(ORDERS.key);
    R.onSam(); R.openX(); hit('Sam menu'); R.press(ORDERS.key);
    if (door) { R.atDoor(door); const M = R.openX(); hit('door menu, first page'); const k = M?.rows.find((r: any) => r.opens)?.key; R.press(`Digit${k}`); ok &&= !!O.menu && O.menu.page !== null; hit('door menu, tools page');
      const k2 = O.menu?.rows.find((r: any) => r.opens)?.key; R.press(`Digit${k2}`); ok &&= !!O.menu && O.menu.page !== null && O.menu.page !== 'tools'; hit('door menu, threshold page'); R.press(ORDERS.key); }
    verdict(ok && O.menu === null, `${scn.name} (${scn.query}): ${HIGH.map(nameOf).join(' ')} pressed with each menu page up and with none — no order, no page turned, Sam's slot as it was`, `${out.join(' · ')} · orders logged ${O.log.length - l0} · slot ${slot0} → ${g.player.slot}`);
  }
  return done();
});

// ---------------------------------------------------------------- the table and the code
export const orderkeysTable = guarded(async () => {
  const { verdict, done } = family('orderkeys-table: the order table deals no digit above the reach, and the keys the orders read are the left hand\'s');
  const keys: [string, string][] = [[ORDERS.key, 'the menu'], [ORDERS.whoKey, 'who'], [ORDERS.quickKey, 'the quick order'], [ORDERS.waitKey, 'wait for my word'], [ORDERS.waitAlt, 'wait for my word (second key)'], [DOORTOOLS.blowKey, 'the word / the trigger']];
  const okKeys = keys.every(([k]) => leftKey(nameOf(k)));
  verdict(ORDER_DIGITS === 5 && okKeys, `ORDER_DIGITS is 5, and every key an order is read from is one of ${LETTERS.join(' ')} or 1 to 5`, keys.map(([k, v]) => `${nameOf(k)} ${v}`).join(' · '));
  { // every row the game registers, for the pair and for the four
    const out: string[] = []; let ok = true;
    for (const scn of [LIST.find(s => s.squad === 2 && !s.level)!, LIST.find(s => s.squad === 4 && !s.level)!]) {
      const R = await rig(scn); const defs: any[] = R.O.defs;
      const bad = defs.filter(d => !(d.key === undefined ? !!d.hotKey : Number.isInteger(d.key) && d.key >= 1 && d.key <= ORDER_DIGITS));
      ok &&= bad.length === 0 && defs.length > 0; out.push(`${scn.squad === 4 ? 'four' : 'pair'}: ${defs.map(d => `${d.page ? `${d.page}/` : ''}${d.id}=${d.key ?? nameOf(d.hotKey ?? '—')}`).join(' ')}${bad.length ? ` · BAD: ${bad.map(d => d.id).join(' ')}` : ''}`);
      if (scn.squad === 4) {   // the word fits a door target (the console's give('go') with the reticle on one) though no door menu lists it
        const d0 = R.game.doors.list[0], dt = { kind: 'door', at: [d0.frameCentre[0], 0, d0.frameCentre[2]], door: d0, side: 1 }, listed = R.O.rowsFor(dt).some((d: any) => d.id === 'go'), why = String(R.O.give('go', dt));
        ok &&= !listed && !/does not fit|no such/.test(why); out.push(`four, 'go' on a door target: ${listed ? 'LISTED on its menu' : 'not on its menu'} · give() answers "${why}"`); }
    }
    verdict(ok, 'every row the game registers is on a digit from 1 to 5 or on a key of its own', out.join('\n    '));
  }
  { // register() itself: more rows than digits, on the first page and on a page — never a digit above the reach, never two rows of a page on one digit
    const R = await rig(LIST.find(s => s.squad === 2 && !s.level)!); const O = R.O; const ids: string[] = [];
    for (let i = 0; i < 4; i++) { const id = `t-first-${i}`; ids.push(id); O.register({ id, label: id, targets: ['floor'], issue: () => { } }); }
    for (let i = 0; i < 12; i++) { const id = `t-page-${i}`; ids.push(id); O.register({ id, page: 'tools', label: id, targets: ['door'], issue: () => { } }); }
    O.register({ id: 't-nine', key: 9, label: 't-nine', targets: ['none'], issue: () => { } }); ids.push('t-nine');
    const defs: any[] = O.defs, over = defs.filter(d => d.key !== undefined && !(d.key >= 1 && d.key <= ORDER_DIGITS));
    const dup = (rows: any[]) => { const k = rows.filter(d => d.key !== undefined).map(d => d.key); return new Set(k).size !== k.length; };
    const floor = O.rowsFor({ kind: 'floor', at: [0, 0, 0] }), tools = O.rowsFor({ kind: 'door', at: [0, 0, 0], door: R.game.doors.list[0], side: 1 }, 'tools'), nine = defs.find(d => d.id === 't-nine');
    const keysOf = (rows: any[]) => rows.map(d => `${d.id}=${d.key ?? '·'}`).join(' ');
    for (const id of ids) O.unregister(id);
    verdict(over.length === 0 && !dup(floor) && !dup(tools) && tools.filter((d: any) => d.key !== undefined).length === ORDER_DIGITS && floor.filter((d: any) => d.key !== undefined).length === ORDER_DIGITS && nine?.key === 5,
      'register() with more rows than digits (four more on the floor\'s page, twelve more on the tools page, one that asks for 9): no digit above 5 is dealt, no two rows of a page share one, the rest are left to the wheel',
      `floor: ${keysOf(floor)}\n    tools: ${keysOf(tools)}\n    asked for 9 on Sam's menu: got ${nine?.key ?? 'none'}`);
  }
  { // the code: the order path names no digit key above the reach (a literal, or a loop bound it would have to read)
    const PATH = ['src/game/orders.ts', 'src/game/doortools.ts', 'src/game/nightbreach.ts', 'src/game/roomclear.ts', 'src/game/rescue.ts', 'src/game/rescueflow.ts'];
    const hits: string[] = [];
    for (const f of PATH) readFileSync(resolve(ROOT, f), 'utf8').split('\n').forEach((ln, i) => { const code = ln.replace(/\/\/.*$/, ''); if (/['"`]Digit[06-9]['"`]/.test(code)) hits.push(`${f}:${i + 1}`); });
    verdict(hits.length === 0, `no line of the ${PATH.length} files on the order path names a digit key above 5, or 0`, `literals 'Digit0' / 'Digit6' … 'Digit9' in code: ${hits.length}${hits.length ? ` — ${hits.join(', ')}` : ''}`);
  }
  return done();
});
