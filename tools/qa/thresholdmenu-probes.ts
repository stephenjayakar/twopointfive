// The 'thresholdmenu' family (game/doortools.ts THR_PAGE / HELD_PAGE — working a room from the threshold as an ORDER ON THE DOOR MENU, both forms, and what
// Sam can say next while the jambs are held), run through probes.ts:
//   bun run tools/qa/probes.ts thresholdmenu | thresholdmenu-rows | thresholdmenu-held
// (the family's own red path: THRESHOLDMENU_BREAK=1 bun run tools/qa/probes.ts thresholdmenu-rows must FAIL — one scenario's two forms trade keys.)
// PASS / FAIL each, all headless: every start-card scenario (scenarioList.ts) staged as the page stages it, and EVERYTHING GIVEN BY KEYS — X with the cursor on
// the door, then one-frame presses of digits 1 to 5 and F, as the page's keydown writes them. The stage itself (who stands where, who is shot from outside, the
// cans) is threshold-probes.ts's; this family is the way to it from the left hand. The harness has no picture: nothing here says how the panel LOOKS.
//   thresholdmenu-rows   in each scenario, on a door of a held room: X = the door's five rows; 5 = the tools, whose row 4 turns to the threshold's page;
//                        4 = that page — 1 hold the door until I say · 2 step in once it goes quiet · 3 clear from outside — the same rows on the same keys
//                        in all seven, both forms live, the four's 'wait for my word' on 5 of it (the pair's has none), Esc back a page at a time, and no
//                        row for a held threshold while nothing is held. Then X, 5, 4, 2 (a fresh staging) and X, 5, 4, 1 (another): each is logged as its
//                        order, puts the stage's operation on that door with the menu's men, and the stage STARTS — the leaf moved, the jambs manned
//                        (phase 'thr'), the second marked 'to hold'. With the door's menu up before the jambs are manned, its row 5 turns from the tools to the held
//                        threshold's on that frame; with the hold's page open and the hold ended under it, the rows grey in words at once, F there is
//                        refused (and starts nothing else), and the first page reads 'door tools' again, the highlight on it. No digit above ORDER_DIGITS is pressed anywhere.
//   thresholdmenu-held   in each scenario, four runs: the hold given by keys (the four's fourth run ON THE WORD — X, F, 4, 1, then F), the jambs manned; X on
//                        that door now reads 5 'threshold held ▸' in place of the tools (another door's menu still reads 'door tools'); 5 = 1 bang, then step in ·
//                        2 step in · no bang · 3 leave it · F go (F from the door's first page too: its row 5 says so); each pressed in a run of its own — the stage takes it ('told · step in' / 'told · bang
//                        and step in' / 'told · leave it' / 'the word'), the menu goes away, the men step in (or, told to leave, the order is over with
//                        nobody inside and the door's menu reads 'door tools' again)
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { standUp, ROOT } from './headless.ts';
const { DOORTOOLS, TOOLS_PAGE, THR_PAGE, HELD_PAGE } = await import(`${ROOT}/src/game/doortools.ts`);
const { ORDERS, ORDER_DIGITS, WORD_HEAD } = await import(`${ROOT}/src/game/orders.ts`);
const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const { scenarioQuery } = await import(`${ROOT}/src/scene/scenarios.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { withOfficeScript, isOfficeFamily } = await import(`${ROOT}/src/scene/level.ts`);
const { feelTables } = await import(`${ROOT}/src/game/teamfeel.ts`);

const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
/** every probe leaves the feel tables (teamfeel.ts: DOORTOOLS among them) as it found them, and one that throws is a FAIL line, not a crash of the runner */
const guarded = (fn: () => Promise<boolean>) => async () => { const T = feelTables(), keep = JSON.parse(JSON.stringify(T));
  try { return await fn(); } catch (e) { console.log(`- FAIL — the probe threw\n    ${e instanceof Error ? e.stack : String(e)}`); return false; } finally { for (const n of Object.keys(keep)) Object.assign(T[n], keep[n]); } };
async function quiet<T>(fn: () => T | Promise<T>): Promise<T> { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } }
const levelOfFile = (file: string): any => { const data = parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8')); return isOfficeFamily(data) ? withOfficeScript(loadLevel(data)) : loadLevel(data); };
const offOf = (d: any, p: number[], side: number) => { const th = d.def.closedDir; return (Math.cos(th) * (p[2] - d.def.hinge[1]) - Math.sin(th) * (p[0] - d.def.hinge[0])) * side; };
const alongOf = (d: any, p: number[]) => { const th = d.def.closedDir; return (p[0] - d.def.hinge[0]) * Math.cos(th) + (p[2] - d.def.hinge[1]) * Math.sin(th); };
const F = DOORTOOLS.blowKey as string, X = ORDERS.key as string;

/** a row of the open menu as the panel shows it */
interface Row { id: string; key: string; text: string; off: boolean; why: string | null; opens: string | null }
interface Page { page: string | null; rows: Row[]; wait: { key: string; text: string } | null }
const rowsOf = (p: Page | null) => p ? p.rows.map(r => `${r.key} ${r.id}${r.opens ? ' ▸' : ''}`).join(' · ') : '(no menu)';
const textOf = (p: Page | null) => p ? p.rows.map(r => `${r.key} ${r.text}${r.off ? ' (off)' : ''}`).join(' | ') + (p.wait ? ` | ${p.wait.key} ${p.wait.text}` : '') : '(no menu)';

/** a start-card scenario staged as the page stages it, under a seed (threshold-probes.ts's recipe: the page's chaos, Sam in god mode and pinned dark), with
 *  the keys of the page: the cursor held on a world point, one-frame presses */
async function stage(E: any, seed: number) {
  Math.random = seeded(0x9137 + seed * 7919);
  const W: any = await quiet(() => standUp({ uploadEvery: 4, ...(E.level ? { level: levelOfFile(E.level) } : {}) })); const g = W.game;
  g.godMode = true; g.tune.chaos = 0.5;
  let q = scenarioQuery(E) as string; if (E.kind === 'roomclear') q = q.replace(/roomclear(=\d+)?/, `roomclear=${seed}`);
  const { why } = await quiet(() => startFromQuery(g, new URLSearchParams(q))); if (why) throw new Error(`${E.id}: start refused — ${why}`);
  const O = g.orders, D = g.doorTools, input = W.input;
  const R = { E, W, g, O, D, input, aim: null as number[] | null, pressed: [] as string[],
    get team(): any[] { return O.squad(); },
    step(n = 1) { for (let i = 0; i < n; i++) { g.player.visibility = 0.05; if (R.aim) W.cursorAt([R.aim[0], R.aim[1], R.aim[2]]); W.step(DT); } },
    until(pred: () => boolean, secs: number) { for (let i = 0; i < secs * 60 && !pred(); i++) R.step(); return pred(); },
    /** a one-frame press, as the page's keydown writes it */
    press(code: string) { R.pressed.push(code); input.pressed.add(code); R.step(); },
    digit(n: number) { R.press(`Digit${n}`); R.step(2); },
    /** X on what the cursor is on, then a few frames with every key up */
    openX(): any { if (O.menu) O.close(); R.press(X); R.step(6); return O.menu; },
    /** the open menu's page, read off the order table and off the panel (rows[0] of the panel = who the orders go to) */
    read(): Page | null { const M = O.menu; if (!M) return null; const hud = O.hud().menu, body = (hud?.rows ?? []).slice(1, 1 + M.rows.length);
      const rows: Row[] = M.rows.map((d: any, i: number) => ({ id: d.id, key: String(body[i]?.opts?.[0]?.key ?? ''), text: String(body[i]?.opts?.[0]?.text ?? ''), off: !!body[i]?.off, why: M.why[i] ?? null, opens: d.opens ?? null }));
      const w = M.wordRow ? hud?.rows?.[1 + M.rows.length] : null;
      return { page: M.page ?? null, rows, wait: w && w.label === WORD_HEAD ? { key: String(w.opts?.[0]?.key ?? ''), text: String(w.opts?.[0]?.text ?? '') } : null }; },
    /** Sam put at p (a ghost: he is put there), the cursor on door d: true when X would open on that door, on face `side` of it */
    place(p: number[], d: any, side?: number): boolean {
      g.teleportPlayer([p[0], 0, p[2]]); R.aim = [d.frameCentre[0], 1.0, d.frameCentre[2]]; R.step(20);
      const t = O.targetUnder(input, W.cam, W.canvas); return t.kind === 'door' && t.door === d && (side === undefined || t.side === side); },
    last(): any { return O.log[O.log.length - 1] ?? null; },
    highest(): number { return Math.max(0, ...R.pressed.filter(c => /^Digit/.test(c)).map(c => Number(c.slice(5)))); },
  };
  // the family's own red path (THRESHOLDMENU_BREAK=1 bun run tools/qa/probes.ts thresholdmenu-rows must FAIL): in one scenario the two forms trade keys
  if (process.env.THRESHOLDMENU_BREAK && E.id === 'depot-four') { const a = O.defs.find((x: any) => x.id === 'thresholdHold'), b = O.defs.find((x: any) => x.id === 'threshold'); if (a && b) { const k = a.key; a.key = b.key; b.key = k; } }
  await quiet(() => R.step(20));
  return R;
}
type Rig = Awaited<ReturnType<typeof stage>>;

/** where the order is given in a scenario: a door, the face of it the squad works from, and a spot for the commander off the opening's line on that face */
interface Spot { door: string; sam: number[]; held: boolean }
/** The door this scenario's rows are given on: the nearest entry of a room that still holds a living defender (the room fight's own model) — else the nearest
 *  door at all — that X on the cursor opens on from a spot off its line, and where both forms of the order are live. Found once a scenario (the search steps
 *  the game: every run after it is staged afresh and goes straight to the spot). */
const SPOTS = new Map<string, Spot | string>();
const OWN_DOOR: Record<string, string> = { 'depot-four': 'c_w', 'glasshouse-four': 'front', 'pass-four': 'back' };
/** `own`: this file's probes ask the scenario's OWN_DOOR first; the checks that borrow the spot (calls, doortest, openhand) keep the nearest held door, as they were staged */
async function spotOf(E: any, own = false): Promise<Spot | string> { const k = own ? `${E.id}:own` : E.id; if (!SPOTS.has(k)) SPOTS.set(k, await findSpot(await stage(E, 1), own)); return SPOTS.get(k)!; }
async function findSpot(R: Rig, ownDoor = false): Promise<Spot | string> {
  const g = R.g, mid = R.team[0]?.char.pos ?? g.player.char.pos, why: string[] = [];
  const cands: { d: any; out: number[] | null; at: number[]; held: boolean }[] = [];
  const rooms = new Set<any>(); for (const def of g.fight.defs) if (def.room && def.room.entries.length && def.room.cells.size <= 500 && def.gd.state !== 'dead') rooms.add(def.room);
  for (const room of rooms) for (const ent of room.entries) cands.push({ d: ent.door, out: ent.out, at: ent.at, held: true });
  cands.sort((a, b) => flat(a.at, mid) - flat(b.at, mid));
  // (THE DEPOT'S DOOR: its nearest held door, the crew room's a_s, is 'the obvious one, and the watched one' since the depot was rebuilt (tools/levels/depot.ts) —
  // four men stacked on it are in a fire fight across the yard, and on the shipped stand the 40 s this family waits for a held door to go quiet end with nobody
  // left on it, so no menu opens at all. The rows are asked on the door threshold-probes.ts heldEntries(…, unwatched) leaves for a hold there: the store's c_w.
  // THE GLASSHOUSE'S: its nearest, the office, is behind glass — on the frozen stand the four are shot down while they stack on it ('nobody left on it' in the
  // stack phase); its front door takes every row on both stands.
  // THE PASS'S: its nearest, the tea room's yard door, is the door the level's lit windows look down the yard at — on the frozen stand the four are
  // shot down on it inside 3 s of the jambs being manned (traced: all four dead, 'nobody left on it' in the hold) and no menu opens; the kitchen's back door,
  // outside the wall (the level's second way in), takes every row on both stands)
  const own = ownDoor ? OWN_DOOR[R.E.id] : undefined; if (own) cands.sort((a, b) => Number(b.d.def.name === own) - Number(a.d.def.name === own));
  for (const d of [...g.doors.list].sort((a: any, b: any) => flat(a.frameCentre, mid) - flat(b.frameCentre, mid))) if (!cands.some(c => c.d === d)) cands.push({ d, out: null, at: d.frameCentre, held: false });
  for (const c of cands) {
    const th = c.d.def.closedDir, n = [-Math.sin(th), Math.cos(th)], faces = c.out ? [c.out] : [n, [-n[0], -n[1]]];
    for (const out of faces) { const lx = -out[1], lz = out[0];
      for (const [back, lat] of [[3.4, 1.6], [3.4, -1.6], [4.4, 1.2], [4.4, -1.2], [2.8, 2.2], [2.8, -2.2], [2.6, 0], [1.8, 0]]) {
        const p = [c.at[0] + out[0] * back + lx * lat, 0, c.at[2] + out[1] * back + lz * lat];
        if (g.col.nav.isBlocked(p[0], p[2]) || g.col.solidBlocked([p[0], 1.1, p[2]], [c.at[0] + out[0] * 0.7, 1.1, c.at[2] + out[1] * 0.7])) continue;
        const ok = await quiet(() => R.place(p, c.d)); if (!ok) continue;
        const M = await quiet(() => { const m = R.openX(); if (m) { R.digit(5); R.digit(4); } return R.O.menu; });
        const pg = M && M.target.door === c.d && M.page === THR_PAGE ? R.read() : null; if (R.O.menu) R.O.close();
        const forms = pg?.rows.filter(r => r.id === 'thresholdHold' || r.id === 'threshold') ?? [];
        if (forms.length === 2 && forms.every(r => !r.why)) return { door: c.d.def.name, sam: p, held: c.held };
        if (forms.length) why.push(`${c.d.def.name}: ${forms.map(r => r.why).find(Boolean)}`);
      } } }
  return `no door found where X opens on it and both forms are live${why.length ? ` (${[...new Set(why)].slice(0, 4).join(' · ')})` : ''}`;
}
/** a scenario staged afresh with the commander on the spot and the cursor on the door */
async function at(E: any, seed: number, spot: Spot) { const R = await stage(E, seed), d = R.g.doors.byName(spot.door); const on = await quiet(() => R.place(spot.sam, d)); return { R, d, on }; }
const opOn = (R: Rig, d: any) => R.D.ops.find((o: any) => o.kind === 'threshold' && o.door === d) ?? null;
const beatsOf = (op: any) => (op?.beats ?? []).map((b: any) => b.what as string);
const names = (men: any[]) => men.map(m => m.callsign).join(' + ');
/** men of the order over the frame line (on the far face from the squad's, within the opening) */
const inside = (op: any) => op.men.filter((m: any) => m.state !== 'dead' && offOf(op.door, m.char.pos, op.side) < -0.15 && alongOf(op.door, m.char.pos) > -0.6 && alongOf(op.door, m.char.pos) < op.door.def.width + 0.6);

/** THE PAGES AS THEY WERE, AND THE DOOR AS IT WAS. The SHIPPED stand has no threshold page and no held page: 'clear from outside' is one plain order on the
 *  tools' row 4 (DOORTOOLS.outsidePlain, a FROZEN_HOLDS row), and there the lead TRIES a door nobody knew was locked and the order ends, 'found shut', before
 *  a jamb is manned (DOORTOOLS.testDoor, another: the office's server door is such a door). doortest-check.ts and openhand-check.ts hold those two rules.
 *  This family is about the two pages and the stage behind them, so each probe asks for both as they were before its first stand-up — under 'shipped' no
 *  stand-up writes the table again, the frozen stand has both off already — and `guarded` puts the table back, so the next probe of the run gets its
 *  stand's own menu. */
export const pagesAsTheyWere = () => { DOORTOOLS.outsidePlain = false; DOORTOOLS.testDoor = false; };
/** `at`, and the cursor given up to a second more to come onto the door. The spot is found in a game that has already been put at other spots near the door;
 *  a run staged afresh puts Sam there from his start, and from a spot further back (the SHIPPED stand's lived-in rooms — LIVED.on, a FROZEN_HOLDS row — stand
 *  furniture on the glasshouse's nearer spots, so its spot is the one 4.4 m out) what is under the cursor 20 frames after the put is still the floor past the
 *  door: it is the door 9 frames later, and the X that follows opens on it. Read every frame, stopped at the first that is on the door — a run that is on the
 *  door at once (every frozen one) steps nothing. */
async function atDoor(E: any, seed: number, spot: Spot) { const r = await at(E, seed, spot); const { R, d } = r;
  for (let i = 0; i < 60 && !r.on; i++) r.on = await quiet(() => { R.step(); const t = R.O.targetUnder(R.input, R.W.cam, R.W.canvas); return t.kind === 'door' && t.door === d; });
  return r; }
const FIRST = 'stack cover fallIn hold tools', TOOLS = 'openClear bangClear charge thr fragClear', THR = 'thresholdHold threshold outside', HELD = 'thrBang thrStep thrLeave thrWord';   // (DOORTOOLS.thrBangFirst, as shipped: the bang is key 1 — calls-probes.ts holds the switch's other side)

// ---------------------------------------------------------------- both forms on the door menu, on one key path, in every scenario
export const thresholdmenuRows = guarded(async () => {
  const { verdict, done } = family('thresholdmenu-rows: working the room from the threshold is on the door menu in every scenario — X, 5, 4, then 1 (hold) or 2 (step in by itself)');
  pagesAsTheyWere();
  let ref: { shape: string; text: string; from: string } | null = null, top = 0; const paths = new Set<string>();
  for (const E of SCENARIOS) {
    const name = `${E.title} (${scenarioQuery(E)})`, four = E.squad === 4;
    const spot = await spotOf(E, true);
    if (typeof spot === 'string') { verdict(false, `${name}: a door to give it on`, spot); continue; }
    // ---- the pages, by their keys
    { const { R, d, on } = await atDoor(E, 1, spot); const bad: string[] = [];
      const M = await quiet(() => R.openX()), first = R.read();
      if (!on || !M || M.target.door !== d) bad.push(`X did not open on ${spot.door}`);
      if (first && first.rows.map(r => r.id).join(' ') !== FIRST) bad.push(`first page is "${rowsOf(first)}"`);
      if (first?.rows.some(r => r.opens === HELD_PAGE)) bad.push('a held threshold is offered with nothing held');
      await quiet(() => R.digit(5)); const tools = R.read();
      // (a door that stands open: 'shut that door' stands in for the charge on its digit — game/shutdoor.ts; the page's shape is the same page)
      const stoodOpen = !d.latched && Math.abs(d.angle) >= 0.6, idsOf = (p: typeof tools) => (p?.rows ?? []).map(r => stoodOpen && r.id === 'shutDoor' ? 'charge' : r.id).join(' ');
      if (tools?.page !== TOOLS_PAGE || idsOf(tools) !== TOOLS || tools!.rows.map(r => r.key).join('') !== '1234G') bad.push(`the tools page is "${rowsOf(tools)}"`);
      await quiet(() => R.digit(4)); const thr = R.read();
      if (thr?.page !== THR_PAGE || thr!.rows.map(r => r.id).join(' ') !== THR || thr!.rows.map(r => r.key).join('') !== '123') bad.push(`the threshold's page is "${rowsOf(thr)}"`);
      for (const p of [tools, thr]) if (p && (four ? !(p.wait?.key === '5' && /^wait for my word/.test(p.wait.text)) : !!p.wait)) bad.push(`page '${p.page}': ${four ? 'no \'wait for my word\' on 5' : 'a wait row for the pair'}`);
      for (const r of thr?.rows ?? []) if (r.why || r.off) bad.push(`'${r.id}' is greyed there: ${r.why}`);
      const shape = `${rowsOf(first)}  ‖  ${stoodOpen ? rowsOf(tools).replace('shutDoor', 'charge') : rowsOf(tools)}  ‖  ${rowsOf(thr)}`, text = (thr?.rows ?? []).map(r => `${r.key} ${r.text}`).join(' | ');
      if (!ref) ref = { shape, text, from: E.title }; else { if (shape !== ref.shape) bad.push(`the pages differ from ${ref.from}'s: "${shape}"`); if (text !== ref.text) bad.push(`the threshold page reads differently from ${ref.from}'s: "${text}"`); }
      await quiet(() => { R.press('Escape'); R.step(2); }); const back1 = R.O.menu === M && M.page === TOOLS_PAGE;
      await quiet(() => { R.press('Escape'); R.step(2); }); const back2 = R.O.menu === M && M.page === null;
      await quiet(() => { R.press('Escape'); R.step(2); }); const gone = R.O.menu === null;
      if (!back1 || !back2 || !gone) bad.push(`Esc: to the tools ${back1}, to the first page ${back2}, away ${gone}`);
      { const mine = R.O.log.filter((x: any) => !!R.O.defs.find((y: any) => y.id === x.order)?.page);   // (a scenario may log an order of its own under the walk — the rescue calls its pair in: not a row of these pages)
        if (mine.length || R.D.ops.length) bad.push(`reading it gave something (${mine.map((x: any) => x.order).join(', ') || 'no order'}, door orders ${R.D.ops.length})`); }
      top = Math.max(top, R.highest());
      verdict(!bad.length, `${name}: on ${spot.door} — X, 5, 4 is the threshold's page: 1 hold the door until I say · 2 step in once it goes quiet · 3 clear from outside${four ? ' · 5 wait for my word' : ''}; Esc steps back a page at a time`,
        bad.length ? `WRONG: ${bad.join(' | ')}` : `${shape}\n    ${textOf(thr)}${spot.held ? '' : ' · (no held room\'s door took the cursor: the nearest door instead)'}`); }
    // ---- each form given by its keys: the stage starts
    for (const [key, id, hold] of [[2, 'threshold', false], [1, 'thresholdHold', true]] as [number, string, boolean][]) {
      const { R, d, on } = await atDoor(E, 1, spot); const men = R.O.recipients(R.O.targetUnder(R.input, R.W.cam, R.W.canvas)), l0 = R.O.log.length;
      await quiet(() => { R.openX(); R.digit(5); R.digit(4); R.press(`Digit${key}`); });
      const l = R.last(), op = opOn(R, d), given = on && R.O.log.length === l0 + 1 && l?.order === id && R.O.menu === null && !!op && !!op.thrHold === hold && men.length > 0 && men.every((m: any) => op.men.includes(m));
      // (the hold: the door's menu put up at once and left up — its row 5 is the tools' until the jambs are manned, and the stand-in's on that frame)
      let swap = '';
      if (hold) { await quiet(() => R.openX()); swap = R.read()?.rows[4]?.id ?? '(no menu)'; }
      const t0 = R.g.time, manned = await quiet(() => R.until(() => !!op && (op.phase === 'thr' || !R.D.ops.includes(op)), 60)) && !!op && op.phase === 'thr';
      if (hold) { await quiet(() => R.step(2)); const r5 = R.read()?.rows[4]; swap += ` → ${r5?.id ?? '(no menu)'} "${r5?.text ?? ''}"`; }
      const b = beatsOf(op), marked = b.some((x: any) => /^threshold · /.test(x) && / · to hold$/.test(x) === hold), early = op ? inside(op).length : -1;
      paths.add(`X 5 4 ${key} = ${l?.order ?? 'nothing'}`);   // (what the keys GAVE, not what was asked for: a scenario whose keys give another order makes a third path) top = Math.max(top, R.highest());
      let after = '';
      if (hold && manned) {   // the hold ended under its own open page: the rows say so at once, the word's key on them is refused and is nobody else's, and the first page is the door's own again
        const swapped = /^tools → held "threshold held ▸ · F: go/.test(swap), sel0 = R.O.menu?.sel;
        await quiet(() => R.digit(5)); const pg = R.read(), was = pg?.page === HELD_PAGE;
        const r = R.D.thresholdTell('leave', spot.door); await quiet(() => R.step(2)); const stale = R.read();
        const grey = !!stale && stale.page === HELD_PAGE && stale.rows.length > 0 && stale.rows.every(x => x.off && !!x.why);
        const nb0 = R.g.nightBreach.state, l1 = R.O.log.length, ops1 = R.D.ops.length, set1 = R.D.set.length; await quiet(() => { R.press(F); R.step(2); });
        const refused = R.O.menu === null && R.O.log.length === l1 && R.D.ops.length === ops1 && R.D.set.length === set1 && R.g.nightBreach.state === nb0;
        await quiet(() => { R.openX(); R.digit(5); }); const tools = R.read(); await quiet(() => { R.press('Escape'); R.step(2); });
        const first = R.read(), own = tools?.page === TOOLS_PAGE && first?.page === null && first.rows.map(x => x.id).join(' ') === FIRST && R.O.menu?.sel === 4; if (R.O.menu) R.O.close();
        verdict(swapped && sel0 === 0 && was && r === null && grey && refused && own, `${name}: the menu follows the hold — up before the jambs are manned its row 5 turns from the tools to 'threshold held' on that frame; the hold ended under its own page, every row greys with the reason at once, F there is refused (and is not the drill's or a charge's), and the door's menu is its own five rows again`,
          `row 5 with the menu up: ${swap} (highlight on row ${sel0 === undefined ? '—' : sel0 + 1}) · page up: ${was ? rowsOf(pg) : `NOT THE HELD PAGE (${rowsOf(pg)})`} · told to leave from code: ${r ?? 'taken'} · two frames on: ${textOf(stale)} · F: ${refused ? 'refused, menu away, nothing started' : `WRONG (menu ${R.O.menu ? 'up' : 'away'}, orders +${R.O.log.length - l1}, door orders ${ops1} → ${R.D.ops.length}, the drill ${nb0} → ${R.g.nightBreach.state})`} · X, 5, Esc: ${rowsOf(first)}, highlight back on row ${(R.O.menu?.sel ?? -1) + 1 || 5}`);
      } else if (!hold && manned) {
        // (this form is on the jambs for a while before it goes by itself: the door's menu offers the same what-next then — read, not pressed)
        await quiet(() => { R.openX(); R.digit(5); }); const pg = R.read(), live = pg?.page === HELD_PAGE && pg!.rows.map(x => x.id).join(' ') === HELD && pg!.rows.filter(x => x.id !== 'thrBang').every(x => !x.off); if (R.O.menu) R.O.close();
        verdict(!!live, `${name}: while 'step in once it goes quiet' is still on the jambs, the door's menu offers the same what-next page, its rows live`, `X, 5: ${textOf(pg)}`);
        const stepped = await quiet(() => R.until(() => beatsOf(op).some((x: any) => /^step in/.test(x)) || !R.D.ops.includes(op), 90)); const bb = beatsOf(op);
        after = ` · (not judged here) left to itself: ${bb.some((x: any) => /^step in/.test(x)) ? `stepped in ${(op.beats.find((x: any) => /^step in/.test(x.what)).t - t0).toFixed(1)} s after the jambs were manned, told nothing (${bb.some((x: any) => /^told|^the word/.test(x)) ? 'BUT A TELL IS LOGGED' : 'no tell logged'})` : stepped ? `ended ${op.ended}` : 'still on the jambs 90 s on'}`; }
      verdict(given && manned && marked && early === 0, `${name}: X, 5, 4, ${key} — '${id}' is logged to the menu's men, the stage's order is on ${spot.door}${hold ? ' marked to hold' : ''}, and it STARTS: the leaf moved, the jambs manned, nobody over the line`,
        `${on ? '' : 'THE CURSOR WAS NOT ON THE DOOR · '}logged: ${l ? `${l.order} → ${(l.who ?? []).join(' + ')}` : 'nothing'} · menu ${R.O.menu ? 'STILL UP' : 'away'} · order: ${op ? `${op.kind}${op.thrHold ? ' (hold)' : ''} to ${names(op.men)}` : 'NONE'} · phase ${op?.phase ?? '—'} ${(R.g.time - t0).toFixed(1)} s on · ${b.filter((x: any) => /^stacked|^threshold/.test(x)).join(' → ') || 'no beat'} · over the line ${early}${after}`);
    }
  }
  // ---- Esc from the held page after its hold ended: one page back, and the highlight on row 5 (the tools' again), not thrown to row 1 — a pair and a four
  for (const E of SCENARIOS.filter((e: any) => e.id === 'room-clear-pair' || e.id === 'depot-four')) {
    const name = `${E.title} (${scenarioQuery(E)})`, spot = await spotOf(E, true); if (typeof spot === 'string') { verdict(false, `${name}: a door to give it on`, spot); continue; }
    const { R, d } = await atDoor(E, 1, spot); await quiet(() => { R.openX(); R.digit(5); R.digit(4); R.press('Digit1'); }); const op = opOn(R, d);
    const manned = await quiet(() => R.until(() => !!op && (op.phase === 'thr' || !R.D.ops.includes(op)), 60)) && !!op && op.phase === 'thr';
    await quiet(() => { R.openX(); R.digit(5); }); const was = R.read()?.page === HELD_PAGE; R.D.thresholdTell('leave', spot.door);
    await quiet(() => { R.step(2); R.press('Escape'); R.step(2); }); const first = R.read(), sel = R.O.menu?.sel; if (R.O.menu) R.O.close();
    verdict(manned && was && first?.page === null && first.rows.map(x => x.id).join(' ') === FIRST && sel === 4, `${name}: Esc from the held page after the hold ended is one page back to the door's own five rows, the highlight on row 5`,
      `${manned ? 'jambs manned' : 'THE JAMBS WERE NOT MANNED'} · the held page ${was ? 'up' : 'NOT UP'} · after leave + Esc: ${first ? `${rowsOf(first)}, highlight on row ${sel === undefined ? '—' : sel + 1}` : 'NO MENU'}`);
  }
  verdict(paths.size === 2 && top > 0 && top <= ORDER_DIGITS, `both forms are on the same key path in all ${SCENARIOS.length} scenarios, and no digit above ${ORDER_DIGITS} was pressed to give them`, `${[...paths].join(' · ')} · highest digit pressed ${top}`);
  return done();
});

// ---------------------------------------------------------------- what next, while the jambs are held
export const thresholdmenuHeld = guarded(async () => {
  const { verdict, done } = family('thresholdmenu-held: while a threshold is held on a door its menu offers what next — X, 5, then 1 bang, then step in · 2 step in · no bang · 3 leave it · F go');
  pagesAsTheyWere();
  const TELLS: { key: string; id: string; beat: RegExp; words: string; first?: boolean }[] = [
    { key: 'Digit1', id: 'thrBang', beat: /^told · bang and step in$/, words: 'bang, then step in' }, { key: 'Digit2', id: 'thrStep', beat: /^told · step in$/, words: 'step in · no bang' },
    { key: 'Digit3', id: 'thrLeave', beat: /^told · leave it$/, words: 'leave it' }, { key: F, id: 'thrWord', beat: /^the word$/, words: 'go (the word)' },
    { key: F, id: 'thrWord', beat: /^the word$/, words: 'go (the word), from the door\'s first page', first: true } ];
  let top = 0;
  for (const E of SCENARIOS) {
    const name = `${E.title} (${scenarioQuery(E)})`, four = E.squad === 4;
    const spot = await spotOf(E, true);
    if (typeof spot === 'string') { verdict(false, `${name}: a door to give it on`, spot); continue; }
    for (const T of TELLS) {
      const { R, d, on } = await atDoor(E, 1, spot), g = R.g, onWord = four && T.id === 'thrWord' && !T.first, how: string[] = [];
      // the hold, by keys — the four's last run on the word: X, F (wait ON, the tools up), 4, 1; stacked and waiting; F
      await quiet(() => { R.openX(); if (onWord) { R.press(F); R.step(2); } else R.digit(5); R.digit(4); R.press('Digit1'); });
      const op = opOn(R, d); let waited = true;
      if (onWord) { const set = !!op?.onWord; const ready = await quiet(() => R.until(() => !!op && op.phase === 'ready', 30)); await quiet(() => R.step(60)); const still = !!op && op.phase === 'ready' && beatsOf(op).every((x: any) => !/^threshold · /.test(x));
        await quiet(() => { R.aim = null; R.step(2); R.press(F); R.aim = [d.frameCentre[0], 1.0, d.frameCentre[2]]; }); waited = set && ready && still; how.push(`given on the word: ${set ? 'waits' : 'DOES NOT WAIT'}, ${ready && still ? 'stacked and held a second' : 'DID NOT HOLD THE STACK'}, then F`); }
      const manned = on && !!op && !!op.thrHold && await quiet(() => R.until(() => op.phase === 'thr' || !R.D.ops.includes(op), 60)) && op.phase === 'thr';
      const held = manned && (await quiet(() => R.until(() => beatsOf(op).some((x: any) => /^holding · on your word/.test(x)) || op.phase !== 'thr', 40)), op.phase === 'thr');   // (up to 40 s for the door to go quiet: held either way, said which)
      how.push(held ? (beatsOf(op).some((x: any) => /^holding · on your word/.test(x)) ? 'the door gone quiet, the lead holding on Sam\'s word' : 'the jambs manned, the door not yet quiet') : `THE HOLD NEVER CAME UP (phase ${op?.phase ?? 'no order'}${op?.ended ? `, ended ${op.ended}` : ''})`);
      // the menu on that door now, and on another
      const M = held ? await quiet(() => R.openX()) : null, first = R.read(), r5 = first?.rows[4];
      const other = g.doors.list.find((x: any) => x !== d), elsewhere = other ? R.O.rowsFor(R.O.targetAt(other.frameCentre)).map((x: any) => x.id).join(' ') : FIRST;
      const firstOk = !!M && M.target.door === d && first!.rows.map(r => r.id).join(' ') === 'stack cover fallIn hold held' && r5?.key === '5' && /^threshold held ▸ · F: go$/.test(r5.text) && !r5.off && elsewhere === FIRST;
      // (the word from the door's FIRST page: the held page is read through the order table, not turned to — the key is pressed with row 5 still shut)
      if (M && !T.first) await quiet(() => R.digit(5));
      const pg: Page | null = T.first ? (M ? { page: HELD_PAGE, wait: null, rows: R.O.rowsFor(M.target, HELD_PAGE, M.men).map((x: any) => ({ id: x.id, key: x.key ? String(x.key) : String(x.hotKey ?? '').replace(/^Key/, ''), text: R.O.labelOf(x, M.target), off: false, why: R.O.whyNot(x, M.target, M.men), opens: null })) } : null) : R.read();
      const row = pg?.rows.find(r => r.id === T.id);
      const pageOk = pg?.page === HELD_PAGE && pg!.rows.map(r => r.id).join(' ') === HELD && pg!.rows.map(r => r.key).join(' ') === `1 2 3 ${F.replace(/^Key/, '')}` && !!row && !row.off && !row.why && (T.first ? R.O.menu?.page === null : true);
      // the press
      const l0 = R.O.log.length, bangs0 = R.D.bangs, in0 = op ? inside(op).length : -1, tT = g.time;
      if (pg?.page === HELD_PAGE && R.O.menu) await quiet(() => { R.press(T.key); R.step(2); });
      const b = beatsOf(op), told = b.some((x: any) => T.beat.test(x)), l = R.O.log.length > l0 ? R.last() : null, logged = T.first ? (four ? R.O.log.length === l0 + 1 && l?.order === 'go' : R.O.log.length === l0) : R.O.log.length === l0 + 1 && l?.order === T.id, away = R.O.menu === null;
      let then = false, tail = '';
      if (T.id === 'thrLeave') { await quiet(() => R.step(240)); const over = !!op && !R.D.ops.includes(op) && op.ended === 'stood down', nobody = !!op && inside(op).length === 0;
        const M2 = await quiet(() => R.openX()), again = R.read(); if (R.O.menu) R.O.close();
        then = over && nobody && R.D.bangs === bangs0 && !!M2 && again!.rows.map(r => r.id).join(' ') === FIRST;
        tail = `${over ? 'the order is over (stood down)' : `NOT OVER (${op?.ended ?? op?.phase})`} · inside four seconds on: ${op ? inside(op).length : '—'} · bangs ${bangs0} → ${R.D.bangs} · the door's menu again: ${rowsOf(again)}`; }
      else { const stepped = !!op && await quiet(() => R.until(() => beatsOf(op).some((x: any) => /^step in/.test(x)) || !R.D.ops.includes(op), 45)) && beatsOf(op).some((x: any) => /^step in/.test(x));
        then = stepped; const st = op?.beats.find((x: any) => /^step in/.test(x.what));
        tail = `${stepped ? `step in ${(st.t - tT).toFixed(1)} s after the press` : `NO STEP IN (${op?.ended ? `ended ${op.ended}` : `phase ${op?.phase}`})`} · bangs ${bangs0} → ${R.D.bangs}`; }
      top = Math.max(top, R.highest());
      verdict(waited && manned && firstOk && pageOk && in0 === 0 && told && logged && away && then,
        `${name}: ${spot.door} held, then X${T.first ? '' : ', 5'}${T.key === F ? ', F' : `, ${T.key.slice(5)}`} — '${T.words}' ${T.first ? 'is the key the row names there' : 'is on the held door\'s own page'}, the stage takes it${T.id === 'thrLeave' ? ' and the order is over with nobody inside' : ' and the men step in'}`,
        `${how.join(' · ')}\n    first page: ${first ? `${rowsOf(first)} ("${r5?.text}")` : 'NO MENU'} · another door's: ${elsewhere}\n    its page: ${textOf(pg)}\n    ${T.key.replace(/^Key|^Digit/, '')}: ${told ? `"${b.find((x: any) => T.beat.test(x))}"` : `NOT TAKEN (beats: ${b.slice(-3).join(' → ')})`} · ${l ? `logged ${l.order} → ${(l.who ?? []).join(' + ')}` : T.first && !four ? 'the pair\'s word on its key: not an order of the log' : 'NOTHING LOGGED'} · menu ${away ? 'away' : 'STILL UP'} · over the line before it ${in0} · ${tail}`);
    }
  }
  verdict(top > 0 && top <= ORDER_DIGITS, `no digit above ${ORDER_DIGITS} was pressed through any of it`, `highest digit pressed ${top}`);
  return done();
});

// (calls-probes.ts drives the same pages with the menu's switches flipped: the rig, shared)
export { stage, at, spotOf, opOn, beatsOf, inside, rowsOf, textOf, quiet, guarded, family, FIRST, TOOLS };
