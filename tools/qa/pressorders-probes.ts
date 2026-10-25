// The 'pressorders' family: EVERY ORDER IS A KEY PRESS, NOTHING HELD — on every scenario of the merged build that takes orders (the maintainer, 10-04: "the
// current approach of needing to hold down a key doesn't feel great"; "still feels pretty hard to navigate the menus when i have to hold the x key"). Run through
// probes.ts:
//   bun run tools/qa/probes.ts pressorders | pressorders-roomclear | pressorders-squad4 | pressorders-rescue | pressorders-nightbreach | pressorders-nightbreach4
//                                          | pressorders-held | pressorders-search
// PASS / FAIL each, all headless (the Game of headless.ts; nothing is drawn — the menu is read as the data the panel is built from, never as a picture). Each
// scenario is staged the way its page flag stages it (main.ts: ?roomclear, ?squad4, ?rescue, ?nightbreach, ?nightbreach&squad4), with Sam in god mode and dark
// and the defenders kept dazzled: this family is about HOW an order is given, not the fight. Every order goes in THROUGH THE INPUT as a keyboard and mouse write
// it — the harness cursor on a world point, then ONE-FRAME presses (Input.pressed / .clicked / .wheel) — and the rig counts the keys and buttons DOWN
// (Input.keys / .buttons) at the top of every frame: 'nothing held' = that count never left zero over the whole run.
//   pressorders-<scenario>   X on a spot of floor, on a door, on Sam himself and on a teammate: the menu comes up, stays up with every key up, and lists the
//                  rows that target is expected to offer — a door's on two pages, its own five and the door tools behind row 5, no row on a digit above 5; then EVERY
//                  ROW IT OFFERS is given once on a fresh staging — X, then the row's digit (X, 5, then the digit for a door tool) — and must be
//                  logged as that order, to the right men, on that target, the menu gone and the men on it. Then the other ways in: B (the quick order) on
//                  each kind of target, the middle button twice, X + the wheel + Space, X + ↓ + Space; T stepping who the orders go to (and an order then going
//                  to them alone); the three ways to put the menu away giving nothing; F, the scenario's own word. For the four: 'wait for my word' flipped on
//                  the tools page's row 5, on F there, and on F from the door's first page; a tool given that way waiting on the door; and the word given on
//                  F — with a menu up (its go row shows F) and with none.
//                  The counts are printed: rows offered, rows given, orders logged, the most keys down on any frame.
//   pressorders-held   X physically HELD is one press: the menu comes up on the press and nothing more happens for as long as it is down; letting go gives
//                  nothing and closes nothing; a key already down with no press this frame (focus regained on a held key) opens nothing; the middle button
//                  held likewise; and a digit pressed while X is still down is the same pick as with it up — the held state is read by nobody
//   pressorders-search   the code search: no file on the order path reads a HELD key or button (Input.down / Input.keys / Input.lmb / mmb / rmb / buttons),
//                  nowhere in src/ is the held state of an order key read, every call that gives an order sits behind a press (or is the game's own doing),
//                  the Space hold-list (interact.ts — the stealth game's own tap / hold grammar) gives no order, and no line a player reads says to hold X
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { standUp, ROOT } from './headless.ts';
const { NIGHTBREACH } = await import(`${ROOT}/src/game/nightbreach.ts`);
const { ROOMCLEAR } = await import(`${ROOT}/src/game/roomclear.ts`);
const { RESCUE } = await import(`${ROOT}/src/game/rescue.ts`);
const { DOORTOOLS } = await import(`${ROOT}/src/game/doortools.ts`);
const { ORDERS, ORDER_DIGITS } = await import(`${ROOT}/src/game/orders.ts`);
const { FRAG } = await import(`${ROOT}/src/game/frag.ts`);

const DT = 1 / 60;
const VERBOSE = process.argv.includes('--verbose');
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const DEFAULTS = { DT: JSON.parse(JSON.stringify(DOORTOOLS)), RC: { ...ROOMCLEAR }, NB: { ...NIGHTBREACH }, RS: { ...RESCUE }, ORD: { ...ORDERS, followBack: [...ORDERS.followBack] } };
const reset = () => { Object.assign(DOORTOOLS, JSON.parse(JSON.stringify(DEFAULTS.DT))); Object.assign(ROOMCLEAR, DEFAULTS.RC); Object.assign(NIGHTBREACH, DEFAULTS.NB); Object.assign(RESCUE, DEFAULTS.RS); Object.assign(ORDERS, DEFAULTS.ORD, { followBack: [...DEFAULTS.ORD.followBack] }); };
/** every probe leaves the knob tables as it found them, and one that throws is a FAIL line, not a crash of the runner */
const guarded = (fn: () => Promise<boolean>) => async () => { try { return await fn(); } catch (e) { console.log(`- FAIL — the probe threw\n    ${e instanceof Error ? e.stack : String(e)}`); return false; } finally { reset(); } };
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);

/** A scenario as its page flag stages it, and where this probe works it from: the door Sam orders on, where he stands for it (off its line), a spot of open
 *  floor in his view. */
interface Scn { key: string; flag: string; squad: 2 | 4; stage(g: any): string | null; door: string; sam: number[]; spot: number[]; word: (g: any) => string[] }
const nbWord = (g: any) => g.nightBreach.log.map((l: any) => l.what).filter((w: string) => w.startsWith('order:'));
const SCENARIOS: Record<string, Scn> = {
  roomclear: { key: 'roomclear', flag: '?roomclear', squad: 2, stage: g => { g.fogOfWar.on = true; return g.roomClear.start(21); }, door: 'breakroom_w', sam: [25.0, 0, 18.9], spot: [22.6, 0, 19.4], word: nbWord },
  squad4: { key: 'squad4', flag: '?squad4', squad: 4, stage: g => { g.fogOfWar.on = true; return g.roomClear.start(21); }, door: 'breakroom_w', sam: [25.0, 0, 18.9], spot: [22.6, 0, 19.4], word: nbWord },
  rescue: { key: 'rescue', flag: '?rescue', squad: 2, stage: g => { g.fogOfWar.on = true; return g.rescue.start(); }, door: 'manager', sam: [24.0, 0, 11.2], spot: [21.5, 0, 11.6],
    word: g => g.rescue.log.map((l: any) => l.what).filter((w: string) => w.startsWith('order:')) },
  nightbreach: { key: 'nightbreach', flag: '?nightbreach', squad: 2, stage: g => g.nightBreach.start(), door: 'breakroom_w', sam: [25.0, 0, 18.9], spot: [22.6, 0, 19.4], word: nbWord },
  nightbreach4: { key: 'nightbreach4', flag: '?nightbreach&squad4', squad: 4, stage: g => g.nightBreach.start(), door: 'breakroom_w', sam: [25.0, 0, 18.9], spot: [22.6, 0, 19.4], word: nbWord },
};
/** what each kind of target is expected to offer, top to bottom (orders.ts's four; a door's fifth row turns to doortools.ts's page of door tools; the four's
 *  word 'go' on every target but a door, on F) */
const ROWS = {
  floor: ['move', 'cover', 'fallIn', 'hold'], door: ['stack', 'cover', 'fallIn', 'hold', 'tools'], none: ['fallIn', 'hold'],
};
const TOOL_ROWS = ['openClear', 'bangClear', 'charge', 'thr', 'fragClear'];   // (fragClear: frag.ts — at the foot of the page on a key of its own, G; no digit)
/** the page behind the tools page's row 4: working the room from the threshold, both forms, and the thin clear from outside that used to hold that slot */
const THR_ROWS = ['thresholdHold', 'threshold', 'outside'];
/** a door tool's order id → the kind of the operation it starts (both threshold forms start the one stage) */
const DOOR_TOOLS = new Map([['openClear', 'openClear'], ['bangClear', 'bangClear'], ['charge', 'charge'], ['fragClear', 'bangClear'], ['outside', 'outside'], ['thresholdHold', 'threshold'], ['threshold', 'threshold']]);

/** One game with the scenario staged. step() keeps Sam dark and the defenders dazzled, and counts what is DOWN at the top of every frame. */
async function rig(scn: Scn, seed = 21) {
  reset(); Object.assign(NIGHTBREACH, { squad: scn.squad });
  Math.random = seeded(seed);
  const log = console.log; if (!VERBOSE) console.log = () => { };
  let W: any; let why: string | null;
  try { W = await standUp(); W.game.godMode = true; why = scn.stage(W.game); } finally { console.log = log; }
  (await import(`${ROOT}/src/game/cmdring.ts`)).CMDRING.wholeSquad = false;   // (these lines step who the orders go to with T, the wheel and the cursor, outside plan mode, as the menu was built: the rule that only plan mode picks a part of the squad is held off here and has its own lines, wholesquad-check)
  (await import(`${ROOT}/src/game/cmdring.ts`)).CMDRING.only = false;   // (the menu's own keys and the middle button, as these lines were written: `probes.ts qonly` has the page's, where the ring carries every order)
  const opening: string[] = W.game.messages.map((m: any) => m.text);   // (what the staging said, before anything else speaks)
  const game = W.game, input = W.input, O = game.orders, D = game.doorTools;
  const R = { W, game, input, O, D, scn, why, opening,
    /** the most keys + mouse buttons DOWN at the top of any frame so far (a one-frame press is `pressed` / `clicked`, never `keys` / `buttons`) · frames run */
    held: 0, frames: 0,
    /** orders that went into the squad's log over the run (orders.ts log: one entry an order given — the menu's, B's, the word's, and any the scenario gives itself) */
    logged: 0,
    /** kept on a world point: the cursor is put back on it before every frame (the camera follows Sam: a screen point drifts off a world point) */
    aim: null as number[] | (() => number[]) | null,
    get ops(): any[] { return O.squad(); },
    hostiles(): any[] { return [...(game.nightBreach.hostiles ?? []), ...(game.rescue.hostiles ?? [])]; },
    step(n = 1) {
      const l = console.log; if (!VERBOSE) console.log = () => { };
      try { for (let i = 0; i < n; i++) {
        game.player.visibility = 0.05; for (const h of R.hostiles()) if (h.state !== 'dead') h.dazzledUntil = game.time + 5;
        if (R.aim) { const p = typeof R.aim === 'function' ? R.aim() : R.aim; W.cursorAt([p[0], p[1], p[2]]); }
        R.held = Math.max(R.held, input.keys.size + (input.buttons ? 1 : 0)); R.frames++;
        W.step(DT);
        for (let k = O.log.length - 1; k >= 0 && !seenLog.has(O.log[k]); k--) { seenLog.add(O.log[k]); R.logged++; } } } finally { console.log = l; }
    },
    until(pred: () => boolean, secs: number) { for (let i = 0; i < secs * 60 && !pred(); i++) R.step(); return pred(); },
    door(): any { return game.doors.list.find((d: any) => d.def.name === scn.door); },
    /** a one-frame press, as the page's keydown writes it (Input.pressed; the key is never in Input.keys) */
    press(code: string) { input.pressed.add(code); R.step(); },
    mmb() { input.clicked |= 2; R.step(); },
    rclick() { input.clicked |= 4; R.step(); },
    wheel(d: number) { input.wheel += d; R.step(); },
    last(): any { return O.log[O.log.length - 1] ?? null; },
    /** A FRESH STAGING (the scenario's own restart), Sam put where he works the door from — setup, not an order. `near`: the men are then called over BY PRESSES
     *  (X on Sam, 3 — fall in) and waited for, so an order on the door finds them with a way and a line to it, as in play. */
    fresh(near = false): boolean {
      const l = console.log; if (!VERBOSE) console.log = () => { };
      try { game.restartEncounter(); } finally { console.log = l; }
      R.aim = null; R.step(20); game.teleportPlayer(scn.sam); R.step(20);
      if (!near) return true;
      const before = O.log.length;
      R.aim = () => { const p = game.player.char.pos; return [p[0], 0.05, p[2]]; }; R.step(2); R.press(ORDERS.key); R.step(6); R.press('Digit3'); R.aim = null;
      const given = O.log.length === before + 1 && R.last()?.order === 'fallIn'; if (given) fallIns++;
      const sam = game.player.char.pos, reach = ORDERS.followBack[1] + 1.2 * R.ops.length;   // (the file behind him: the pair inside 4.8 m, the four inside 7.2)
      R.until(() => R.ops.every((m: any) => m.state === 'dead' || dist(m.char.pos, sam) < reach), 16); R.step(30);
      return given && R.ops.every((m: any) => dist(m.char.pos, sam) < reach);
    },
    /** the cursor on a kind of target, kept there */
    on(kind: Kind) { const p = game.player.char.pos, d = R.door();
      R.aim = kind === 'floor' ? scn.spot : kind === 'door' ? [d.frameCentre[0], 1.0, d.frameCentre[2]] : kind === 'none' ? () => [p[0], 0.05, p[2]] : () => { const m = R.ops[0].char.pos; return [m[0], 1.2, m[2]]; };
      R.step(2); },
    /** X pressed on what the cursor is on, then `wait` frames with every key up: the menu (or null) */
    openX(wait = 12): any { R.press(ORDERS.key); R.step(wait); return O.menu; },
  };
  let fallIns = 0; const seenLog = new WeakSet<object>();
  Object.defineProperty(R, 'fallIns', { get: () => fallIns });
  R.step(30);
  return R as typeof R & { fallIns: number };
}
type Kind = 'floor' | 'door' | 'none' | 'man';
const KINDS: { kind: Kind; words: string }[] = [{ kind: 'floor', words: 'a spot of floor' }, { kind: 'door', words: 'a door' }, { kind: 'none', words: 'Sam himself' }, { kind: 'man', words: 'a teammate' }];
const line = (l: any) => l ? `${l.order} → ${l.who.join(' + ')} on ${l.target}` : 'nothing';
const names = (l: any[]) => l.map((g: any) => g.callsign).join(' + ');

/** the whole sweep on one scenario */
async function sweep(scn: Scn): Promise<boolean> {
  const { verdict, done } = family(`pressorders-${scn.key}: ${scn.flag} — every order it offers given by key presses alone, nothing held`);
  const R = await rig(scn); const { O, D, game: g } = R; const four = scn.squad === 4;
  verdict(R.why === null && O.active && R.ops.length === scn.squad && O.paired === four, `${scn.flag} is staged with ${four ? 'the four in two pairs' : 'the pair'} to order`, `${R.why ?? 'started'} · squad ${names(R.ops)} · ${O.summary()}`);
  if (R.why !== null || !O.active) return done();
  { // what the player is told: the opening line names X for the orders, and the squad's block on the panel carries the keys
    R.on('floor'); const st = O.hud().status[0], keys = (st?.opts ?? []).filter((o: any) => o.key).map((o: any) => `[${o.key}] ${o.text}`);
    const told = R.opening.find((t: string) => /\bX: (?:your )?orders/.test(t)) ?? null, k = (c: string) => (st?.opts ?? []).some((o: any) => o.key === c);
    verdict(!!told && k('X') && k('T') && k('B') && !R.opening.concat(keys).some((t: string) => /hold(?:ing)? (?:down )?(?:the )?X\b/i.test(t)),
      'the opening line says X is the orders key, and the squad\'s block on the panel names X (orders), T (who) and B (the quick order) — nowhere "hold"', `"${(told ?? R.opening.join(' / ')).slice(0, 200)}" · panel: ${keys.join(' · ')}`); }
  let offered = 0, given = 0;
  const wantRows = (k: Kind) => [...(k === 'man' ? ROWS.none : ROWS[k]), ...(four && k !== 'door' ? ['go'] : [])];

  // ---- the menu on each kind of target: up on a press, still up with every key up, the rows it should have
  type Row = { id: string; key: number | undefined; hot: string | null; opens: string | null; why: string | null; path: number[] };
  const lists: Record<Kind, Row[]> = { floor: [], door: [], none: [], man: [] };
  const read = (M: any, via: number[]): Row[] => (M?.rows ?? []).map((r: any, i: number) => ({ id: r.id as string, key: r.key as number | undefined, hot: (r.hotKey ?? null) as string | null, opens: (r.opens ?? null) as string | null, why: (M.why[i] ?? null) as string | null, path: [...via, r.key ?? String(r.hotKey ?? '?').replace(/^Key/, '')] }));
  /** a page's keys: every row on its own digit from 1 to ORDER_DIGITS — or, with no digit, on a key of its own (the word: F) */
  const keysOk = (rows: Row[]) => { const d = rows.filter(r => r.key !== undefined).map(r => r.key as number); return new Set(d).size === d.length && d.every(k => k >= 1 && k <= ORDER_DIGITS) && rows.every(r => r.key !== undefined || r.hot === DOORTOOLS.blowKey || r.hot === FRAG.orderKey); };
  const show = (rows: Row[]) => rows.map(r => `${r.key ?? (r.hot ?? '?').replace(/^Key/, '')} ${r.id}${r.opens ? ' ▸' : ''}${r.why ? ` (greyed: ${r.why})` : ''}`).join(' · ');
  for (const { kind, words } of KINDS) {
    const near = R.fresh(kind === 'door'); R.on(kind);
    const M0 = R.openX(1), up1 = !!M0; R.step(40); const M = O.menu, stayed = M === M0 && !!M;   // (two thirds of a second with every key up)
    const tk = M?.target.kind, man = M?.target.kind === 'none' ? M.target.man : undefined;
    const rightKind = kind === 'man' ? tk === 'none' && man === R.ops[0] : kind === 'none' ? tk === 'none' && !man : tk === kind && (kind !== 'door' || M.target.door === R.door());
    const rows = read(M, []), hud = O.hud().menu, hint = hud?.hint ?? '';
    // a door's fifth row turns the menu to the door tools' page: read by that key, then Esc — back on the first page, the menu still up
    const opener = rows.find(r => r.opens); let page: Row[] = [], thr: Row[] = [], pageOk = kind !== 'door' && !opener, wait = '';
    if (opener && M) { R.press(`Digit${opener.key}`); R.step(3); const turned = O.menu === M && M.page === opener.opens; page = turned ? read(M, [opener.key as number]) : [];
      const waitRow = () => O.hud().menu?.rows[1 + M.rows.length]?.opts?.[0];
      const w = waitRow(); if (M.wordRow) wait = ` · ${w?.key} ${w?.text}`;
      let waitOk = four ? M.wordRow && w?.key === '5' : !M.wordRow;
      // the tools page's own opener: the page of threshold work behind it (Esc there steps back ONE page, to the tools)
      const deeper = page.find(r => r.opens); let turned2 = false, back1 = false;
      if (deeper) { R.press(`Digit${deeper.key}`); R.step(3); turned2 = O.menu === M && M.page === deeper.opens; thr = turned2 ? read(M, [opener.key as number, deeper.key as number]) : [];
        const w2 = waitRow(); waitOk &&= four ? M.wordRow && w2?.key === '5' : !M.wordRow;
        R.press('Escape'); R.step(2); back1 = O.menu === M && M.page === opener.opens; }
      R.press('Escape'); R.step(2); pageOk = kind === 'door' && turned && page.map(r => r.id).join(' ') === TOOL_ROWS.join(' ') && keysOk(page) && turned2 && back1 && thr.map(r => r.id).join(' ') === THR_ROWS.join(' ') && keysOk(thr) && waitOk && O.menu === M && M.page === null; }
    lists[kind] = [...rows, ...page, ...thr];
    verdict(near && up1 && stayed && rightKind && rows.map(r => r.id).join(' ') === wantRows(kind).join(' ') && keysOk(rows) && pageOk && !!hud?.open && !/\d/.test(hint),
      `X pressed on ${words}: the menu comes up on it, stays up with every key up, and lists what that target offers — each row on its own digit, none above ${ORDER_DIGITS}${kind === 'door' ? `; row ${opener?.key} turns to the door tools' page, and its row 4 to the threshold's (Esc: back a page at a time)` : ''}`,
      `${up1 ? 'up on the press' : 'NOT up'} · ${stayed ? 'still up 40 frames on' : 'GONE'} · target ${tk}${man ? `:${man.callsign}` : ''} · ${show(rows)}${page.length ? ` ▸ ${show(page)}${wait}` : ''}${thr.length ? ` ▸ ${show(thr)}` : ''} · panel hint "${hint}"`);
    R.press('Escape');
  }

  // ---- every row of every target, each on a fresh staging: X, then its digit (a door tool: X, the page's digit, then its own)
  for (const { kind, words } of KINDS) {
    const out: string[] = []; let ok = true, n = 0, got = 0;
    for (const row of lists[kind]) {
      if (row.id === 'go') continue;   // (greyed until somebody waits on the word: the four's own block below gives it, three times)
      if (row.opens) continue;         // (not an order: the row that turns the page — pressed on the way to every row behind it)
      const refused = row.id === 'fragClear' && scn.key === 'rescue' ? 'not with hostages on the floor.' : null;   // (a frag spares nobody: with hostages on the floor its row is there, greyed with the reason, and the key gives nothing)
      offered++; n++;
      const near = R.fresh(kind === 'door'); R.on(kind); const l0 = O.log.length;
      const M = R.openX(); for (const k of row.path.slice(0, -1)) { R.press(`Digit${k}`); R.step(2); }
      const i = M && O.menu === M ? M.rows.findIndex((r: any) => r.id === row.id) : -1, why = i >= 0 ? M.why[i] : 'not offered';
      R.press(row.key !== undefined ? `Digit${row.key}` : row.hot as string); const l = R.last(), fresh = O.log.length === l0 + 1;
      if (refused) { const held = near && why === refused && O.log.length === l0; R.step(2); if (held) { given++; got++; } else ok = false; out.push(`${row.path.join(' ')} ${row.id}: ${held ? `refused, as it must be (${why})` : `NOT REFUSED (${why ?? 'no reason'}, orders logged ${O.log.length - l0})`}`); if (O.menu) R.press(ORDERS.key); R.step(2); continue; }
      const to = kind === 'man' ? [R.ops[0]] : R.ops.filter((m: any) => m.state !== 'dead');
      const target = kind === 'door' ? l?.target === `door:${scn.door}` : kind === 'floor' ? String(l?.target).startsWith('floor:') : l?.target === 'none';
      R.step(2);
      const onIt = DOOR_TOOLS.has(row.id) ? D.ops.some((o: any) => o.kind === DOOR_TOOLS.get(row.id) && (row.id !== 'thresholdHold' && row.id !== 'threshold' || !!o.thrHold === (row.id === 'thresholdHold')) && o.door === R.door() && to.every((m: any) => o.men.includes(m))) : to.every((m: any) => O.of(m)?.order === row.id);
      const good = near && !why && fresh && l?.order === row.id && l.who.join(' + ') === names(to) && target && O.menu === null && onIt;
      if (good) { given++; got++; } else ok = false;
      out.push(`${row.path.join(' ')} ${row.id}: ${good ? 'given' : `NOT GIVEN (${!near ? 'the men never came over' : why ? `greyed: ${why}` : !fresh ? `orders logged ${O.log.length - l0}` : !onIt ? `logged ${line(l)} but the men are not on it: ${to.map((m: any) => O.statusOf(m)).join(', ')}` : line(l)})`}`);
     
    }
    verdict(ok && n > 0, `on ${words}: every row is given by X and then its digit${kind === 'door' ? ' (a door tool: X, 5, its digit; the threshold\'s: X, 5, 4, its digit)' : ''} — ${got} of ${n}, each logged as that order to the right men on that target, the menu gone`, out.join(' · '));
  }

  // ---- the other ways in, all presses
  { // B: the target's own first row at once, no menu
    const out: string[] = []; let ok = true;
    for (const [kind, want] of [['floor', 'move'], ['door', 'stack'], ['none', 'fallIn']] as [Kind, string][]) {
      const near = R.fresh(kind === 'door'); R.on(kind); const l0 = O.log.length; R.press(ORDERS.quickKey); const l = R.last();
      const good = near && O.log.length === l0 + 1 && l?.order === want && O.menu === null; ok &&= good; if (good) given++; offered++; out.push(`B on ${kind}: ${line(l)}`);
    }
    verdict(ok, 'B, the quick order, gives the target\'s own first row at once with no menu: move there on floor, stack up on a door, fall in on Sam', out.join(' · '));
  }
  { // the middle button twice · X, the wheel, Space · X, ↓ ↓, Space
    R.fresh(); R.on('floor'); let l0 = O.log.length; R.mmb(); const upA = !!O.menu; R.step(10); R.mmb(); const a = R.last(), okA = upA && O.log.length === l0 + 1 && a?.order === 'move' && O.menu === null;
    R.fresh(); R.on('floor'); l0 = O.log.length; R.openX(8); R.wheel(60); R.step(4); R.press('Space'); const b = R.last(), okB = O.log.length === l0 + 1 && b?.order === 'cover' && O.menu === null;
    R.fresh(); R.on('floor'); l0 = O.log.length; R.openX(8); R.press('ArrowDown'); R.press('ArrowDown'); R.step(4); R.press('Space'); const c = R.last(), okC = O.log.length === l0 + 1 && c?.order === 'fallIn' && O.menu === null;
    offered += 3; given += (okA ? 1 : 0) + (okB ? 1 : 0) + (okC ? 1 : 0);
    verdict(okA && okB && okC, 'off the digits: the middle button twice gives the first row; X, the wheel down a row, Space gives the second; X, ↓ ↓, Space the third', `middle ×2: ${line(a)} · wheel + Space: ${line(b)} · ↓↓ + Space: ${line(c)}`);
  }
  { // T: who the orders go to — stepped by presses, and the next order goes to them alone
    R.fresh(); R.on('floor'); const seq: string[] = [String(O.who)]; const ring = four ? 3 : 1 + scn.squad;
    for (let i = 0; i < ring; i++) { R.press(ORDERS.whoKey); seq.push(String(O.who)); }
    const wantSeq = four ? 'all red blue all' : `all ${R.ops.map((_: any, i: number) => i).join(' ')} all`;
    R.press(ORDERS.whoKey); const one = O.who, men1 = O.recipients().slice(), l0 = O.log.length; R.openX(8); R.press('Digit1'); const l = R.last(); R.step(2);
    const rest = R.ops.filter((m: any) => !men1.includes(m));
    const okOne = O.log.length === l0 + 1 && l?.order === 'move' && l.who.join(' + ') === names(men1) && men1.length === (four ? 2 : 1) && rest.every((m: any) => O.of(m)?.order !== 'move');
    R.press(ORDERS.whoKey); R.press(ORDERS.whoKey); const back = O.who === 'all';   // (two more presses: round to everyone again)
    R.on('man'); R.press(ORDERS.whoKey); const onMan = back && O.who === 0; R.on('floor'); const l1 = O.log.length; R.openX(8); R.press('Digit4'); const lm = R.last();
    const okMan = onMan && O.log.length === l1 + 1 && lm?.order === 'hold' && lm.who.join() === R.ops[0].callsign;
    offered += 2; given += (okOne ? 1 : 0) + (okMan ? 1 : 0);
    verdict(seq.join(' ') === wantSeq && okOne && okMan, `T steps who the orders go to (${four ? 'gold → red → blue → gold' : 'all → each man → all'}), T on a teammate picks him — and the next order goes to them alone`,
      `T ×${ring}: ${seq.join(' → ')} · then T (${String(one)}): ${line(l)} · T on ${R.ops[0].callsign}: ${line(lm)}`);
  }
  { // putting it away: X again, Esc, a right click — no order
    R.fresh(); R.on('floor'); const l0 = O.log.length; const outs: string[] = [];
    for (const [how, act] of [['X again', () => R.press(ORDERS.key)], ['Esc', () => R.press('Escape')], ['a right click', () => R.rclick()]] as [string, () => void][]) { const up = !!R.openX(8); act(); outs.push(`${how}: ${up && O.menu === null ? 'closed' : 'STILL UP'}`); R.step(3); }
    verdict(outs.every(s => s.endsWith('closed')) && O.log.length === l0, 'X again, Esc or a right click put the menu away, and no order is given', `${outs.join(' · ')} · orders logged ${O.log.length - l0}`);
  }
  { // F: the scenario's own word, a press
    R.aim = null; const l = console.log; if (!VERBOSE) console.log = () => { }; try { g.restartEncounter(); } finally { console.log = l; } R.step(40);
    const w0 = scn.word(g).length; R.press('KeyF'); R.step(4); const w = scn.word(g);
    const ok = w.length === w0 + 1; offered++; if (ok) given++;
    verdict(ok, 'F, the scenario\'s own word, is one press', `F from the start marks: ${w.slice(w0).join(', ') || 'nothing'} · ${scn.key === 'rescue' ? g.rescue.summary() : g.nightBreach.summary?.() ?? g.nightBreach.state}`.slice(0, 260));
  }
  if (four) {
    // 'wait for my word' is a ROW of the door tools' page flipped by a press (its digit, 5 — or F; F on the door's first page turns to the tools with it on), a
    // tool given that way waits on the door, and the word is a press of F: with a menu up (Sam's own: its go row shows F, and goes away with it) or with none
    const out: string[] = []; let ok = true;
    for (const [flip, word] of [['5, then 5', 'menu'], ['5, then F', 'KeyF'], ['F', 'KeyF']] as [string, string][]) {
      const near = R.fresh(true); R.on('door'); const M = R.openX(), tools = M?.rows.find((r: any) => r.opens)?.key;
      if (flip !== 'F') { R.press(`Digit${tools}`); R.step(2); } const hadRow = flip === 'F' ? !M?.wordRow : !!M?.wordRow;   // (the first page has no wait row of its own: F there turns the page)
      R.press(flip === '5, then 5' ? ORDERS.waitKey : 'KeyF'); const flipped = !!O.menu && O.menu === M && M.page === 'tools' && M.wordRow && M.onWord === true; R.step(6);
      const l0 = O.log.length; R.press('Digit1'); const l = R.last(); const op = D.ops.find((o: any) => o.kind === 'openClear' && o.door === R.door());
      const waits = O.log.length === l0 + 1 && l?.order === 'openClear' && !!op && op.onWord === true;
      const ready = R.until(() => !!op && op.phase === 'ready', 14); R.step(60); const still = !!op && op.phase === 'ready' && op.onWord && Number.isNaN(op.openT);
      const l1 = O.log.length;
      if (word === 'KeyF') { R.aim = scn.spot; R.step(2); R.press('KeyF'); } else { R.on('none'); const M2 = R.openX(); const gi = M2 ? M2.rows.findIndex((r: any) => r.id === 'go') : -1; if (!(gi >= 0 && !M2.why[gi] && M2.rows[gi].key === undefined && O.hud().menu?.rows[1 + gi]?.opts[0]?.key === 'F')) ok = false; R.press('KeyF'); if (O.menu) ok = false; }
      const lg = R.last(), went = O.log.length === l1 + 1 && lg?.order === 'go'; const moved = R.until(() => !op || !op.onWord, 3) && R.until(() => !D.ops.includes(op) || op.phase !== 'ready', 10);
      const good = near && hadRow && flipped && waits && ready && still && went && moved; ok &&= good; offered += 2; if (waits) given++; if (went) given++;
      out.push(`X, ${flip} puts the row on (${flipped ? 'ON, menu still up on the tools' : 'NO'}) → 1: ${line(l)}${waits ? ', waiting' : ''} → stacked and ${still ? 'held a second on the door' : 'DID NOT WAIT'} → the word on ${word === 'KeyF' ? 'F' : 'X (on Sam) then F'}: ${line(lg)}${moved ? ', and they go' : ', NOTHING MOVED'}`);
     
    }
    verdict(ok, 'the four: "wait for my word" is a row of the door tools\' page put on by a press (5 there, F there, or F from the door\'s first page), a tool given that way waits on the door, and the word is a press of F — with Sam\'s menu up, or none', out.join('\n    '));
  }
  verdict(given === offered && offered > 0, `${scn.flag}: every way of giving an order this probe tried was a press, and every one was taken`, `${given} of ${offered} given (rows by digit, B, the middle button, wheel / arrows + Space, T, F${four ? ', the word' : ''}) · ${R.fallIns} more "fall in" by X then 3 to call the men over · ${R.logged} orders in the squad's log over ${R.frames} frames`);
  verdict(R.held === 0, 'the probe gave all of that by presses alone: it left no key and no mouse button down on any frame (a check on the probe, not on the game — the game\'s side is the lines above and pressorders-held / -search)', `most keys + buttons down at the top of a frame, over ${R.frames} frames: ${R.held}`);
  return done();
}
export const pressRoomclear = guarded(() => sweep(SCENARIOS.roomclear));
export const pressSquad4 = guarded(() => sweep(SCENARIOS.squad4));
export const pressRescue = guarded(() => sweep(SCENARIOS.rescue));
export const pressNightbreach = guarded(() => sweep(SCENARIOS.nightbreach));
export const pressNightbreach4 = guarded(() => sweep(SCENARIOS.nightbreach4));

// ---------------------------------------------------------------- a key HELD is one press
export const pressHeld = guarded(async () => {
  const { verdict, done } = family('pressorders-held: X held down is one press — nothing waits on a key staying down or coming up');
  const R = await rig(SCENARIOS.roomclear); const { O, input } = R; const K = ORDERS.key;
  // held two seconds, then let go
  R.fresh(); R.on('floor'); const l0 = O.log.length;
  input.keys.add(K); input.pressed.add(K); R.step(); const up0 = O.menu, sel0 = up0?.sel, rows0 = up0?.rows.length; R.step(120); const during = O.menu === up0 && !!up0 && up0.sel === sel0 && up0.rows.length === rows0;
  input.keys.delete(K); R.step(60); const after = O.menu === up0 && !!up0;
  verdict(during && after && O.log.length === l0 && up0?.sel === sel0, 'X held two seconds, then let go: the menu came up on the press, nothing else happened while it was down, and letting go gave nothing and closed nothing',
    `up on the press ${!!up0} · the same menu, rows and highlighted row after 120 frames held ${during} · still up 60 frames after the key came up ${after} · orders logged ${O.log.length - l0}`);
  // a digit with X still physically down = the same pick
  R.press('Escape'); R.fresh(); R.on('floor'); const l1 = O.log.length;
  input.keys.add(K); input.pressed.add(K); R.step(); R.step(20); input.pressed.add('Digit1'); R.step(); const a = R.last(); input.keys.delete(K); R.step(10);
  R.fresh(); R.on('floor'); const l2 = O.log.length; R.openX(20); R.press('Digit1'); const b = R.last();
  verdict(O.log.length === l2 + 1 && l2 === l1 + 1 && a?.order === 'move' && b?.order === 'move' && a.who.join() === b.who.join() && O.menu === null, 'a digit pressed while X is still down gives the same order as with X long since up, and X coming up afterwards does nothing',
    `X down: ${line(a)} · X up: ${line(b)}`);
  // down with no press: nothing
  R.fresh(); R.on('floor'); const l3 = O.log.length; input.keys.add(K); R.step(90); const none = O.menu === null; input.keys.delete(K); R.step(10);
  input.keys.add('Digit1'); input.keys.add(ORDERS.quickKey); input.keys.add(ORDERS.whoKey); R.step(60); const who = O.who; input.keys.delete('Digit1'); input.keys.delete(ORDERS.quickKey); input.keys.delete(ORDERS.whoKey); R.step(5);
  verdict(none && O.menu === null && O.log.length === l3 && who === 'all', 'a key that is down with no press this frame (X; then B, T and a digit) does nothing: no menu, no order, who unchanged', `menu ${O.menu ? 'UP' : 'none'} · orders logged ${O.log.length - l3} · who ${String(who)}`);
  // the middle button held
  R.fresh(); R.on('floor'); const l4 = O.log.length; input.buttons |= 2; input.clicked |= 2; R.step(); const m0 = O.menu; R.step(90); const mDuring = O.menu === m0 && !!m0; input.buttons &= ~2; R.step(40); const mAfter = O.menu === m0 && !!m0;
  verdict(mDuring && mAfter && O.log.length === l4, 'the middle button held a second and a half, then let go: the menu came up on the press and is still up, no order', `held: ${mDuring} · after it came up: ${mAfter} · orders logged ${O.log.length - l4}`);
  R.press('Escape');
  return done();
});

// ---------------------------------------------------------------- the code search
const SRC = join(ROOT, 'src');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
function walk(dir: string, out: string[] = []): string[] { for (const f of readdirSync(dir)) { const p = join(dir, f); if (statSync(p).isDirectory()) walk(p, out); else if (/\.(ts|html)$/.test(f)) out.push(p); } return out; }
/** `re` over a file's lines, comments left in (a comment that says 'hold X' is a finding too where the search is for words) */
function hits(rel: string, re: RegExp): string[] { return read(rel).split('\n').map((ln, i) => re.test(ln) ? `${rel}:${i + 1}` : '').filter(Boolean); }
/** a line's CODE: what is left of it with the // comment and the string / template literals taken out */
const code = (ln: string) => ln.replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g, '""').replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '').replace(/\/\*.*?\*\//g, '');
/** a line's code with its strings kept (to read a literal key) */
const code0 = (ln: string) => ln.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '');
function codeHits(rel: string, re: RegExp): string[] { let block = false; return read(rel).split('\n').map((ln, i) => { if (block) { if (ln.includes('*/')) block = false; return ''; } if (/^\s*\/\*/.test(ln) && !ln.includes('*/')) { block = true; return ''; } return re.test(code(ln)) ? `${rel}:${i + 1}` : ''; }).filter(Boolean); }
export const pressSearch = guarded(async () => {
  const { verdict, done } = family('pressorders-search: the code search — no hold-to-order path is left');
  // (1) the files an order passes through read no held state at all
  const PATH = ['src/game/orders.ts', 'src/game/autopilot.ts', 'src/game/planlay.ts', 'src/game/doortools.ts', 'src/game/nightbreach.ts', 'src/game/roomclear.ts', 'src/game/rescue.ts', 'src/game/rescueflow.ts', 'src/game/roomfight.ts', 'src/game/squad.ts', 'src/game/fogofwar.ts'];
  const HELD = /\.(?:down|lmb|mmb|rmb)\(|\binput\??\.keys\b|\.keys\.has\(|\bbuttons\b(?!\s*(?:&=|\|=|=(?!=)))/;   // (any receiver — an alias of the Input is caught too; a write to buttons, orders.ts eating the click, is not a read)
  const held = PATH.flatMap(f => codeHits(f, HELD));
  const edges = PATH.map(f => `${f.split('/').pop()} ${codeHits(f, /\binput\??\.(hit|lmbHit|mmbHit|rmbHit)\(|\bpressed\.(has|delete)\(/).length}`);
  verdict(held.length === 0, `the ${PATH.length} files on the order path read no held key or button (Input.down / .keys / .lmb() / .mmb() / .rmb() / .buttons): 0 reads`, `held-state reads: ${held.length}${held.length ? ` — ${held.join(', ')}` : ''} · press / click edges read (hit, *Hit, pressed.has / .delete): ${edges.join(', ')}`);
  // (2) nowhere in src/ is the held state of one of the order keys read
  const all = walk(SRC).map(p => p.slice(ROOT.length + 1)).filter(f => f.endsWith('.ts'));
  const KEYS = [ORDERS.key, ORDERS.whoKey, ORDERS.quickKey, ORDERS.waitKey, DOORTOOLS.blowKey].map((k: string) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const heldKey = new RegExp(`(?:\\.down\\(|\\.keys\\.has\\()\\s*(?:['"\`](?:${KEYS})['"\`]|ORDERS\\.|DOORTOOLS\\.|K\\.(?:key|whoKey|quickKey|waitKey|waitAlt|blowKey)\\b)`);
  const hk = all.flatMap(f => hits(f, heldKey));
  // … and every held-key read in src/, by its argument: literals are none of the order keys, and the only two that are not literals are the walk keys and Space in interact.ts
  const downs = all.flatMap(f => read(f).split('\n').flatMap((ln, i) => [...code0(ln).matchAll(/\.down\(([^)]*)\)/g)].map(m => ({ at: `${f}:${i + 1}`, arg: m[1].trim() }))));
  const orderKeys = new Set<string>([ORDERS.key, ORDERS.whoKey, ORDERS.quickKey, ORDERS.waitKey, ORDERS.waitAlt, DOORTOOLS.blowKey]);
  const lit = downs.filter(d => /^['"`][A-Za-z0-9]+['"`]$/.test(d.arg)), named = downs.filter(d => !lit.includes(d));
  const badLit = lit.filter(d => orderKeys.has(d.arg.slice(1, -1))), badNamed = named.filter(d => !(d.at.startsWith('src/game/interact.ts:') && /^(MOVE_KEYS\[i\]|INTERACT_KEY)$/.test(d.arg)));
  hk.push(...badLit.map(d => d.at), ...badNamed.map(d => `${d.at} (${d.arg})`));
  verdict(hk.length === 0, `no file under src/ (${all.length} .ts files) asks whether an order key is DOWN (${[ORDERS.key, ORDERS.whoKey, ORDERS.quickKey, ORDERS.waitKey, DOORTOOLS.blowKey].join(', ')}, or a knob of ORDERS / DOORTOOLS): 0`, `matches: ${hk.length}${hk.length ? ` — ${hk.join(', ')}` : ''} · Input.down calls in src/: ${downs.length} — ${lit.length} on a literal key (${[...new Set(lit.map(d => d.arg.slice(1, -1)))].sort().join(' ')}), ${named.length} on a name (${named.map(d => `${d.at.split('/').pop()} ${d.arg}`).join(', ')})`);
  // (3) every call that gives an order: where it is, and what it sits behind
  const GIVE = /\b(?:orders|S|O)\.give\(|\.orders\.(?:open|pick)\(/, OWN: Record<string, RegExp> = { 'src/game/orders.ts': /\bthis\.(?:open|pick|give)\(/, 'src/game/rescue.ts': /\bthis\.orderDoor\(\)/, 'src/game/nightbreach.ts': /\bthis\.order\(\)/ };
  const game = all.filter(f => !f.startsWith('src/ui/') && f !== 'src/main.ts' && f !== 'src/host/kitView.ts');   // (the page's console hooks and the Tab panel's buttons are not play; nor is host/kitView.ts, the Team & kit door picture's staged orders: they run only in the `?kitview` instance, which takes no input and starts no run)
  const sites = game.flatMap(f => [...new Set([...codeHits(f, GIVE), ...(OWN[f] ? codeHits(f, OWN[f]) : [])])]);
  // (the wall charge's `order(at, who)` — wallcharge.ts — is its order BY CODE, the twin of doorTools.order: the page's console and probes call it, no key does.
  //  Its own give() is let through here, and held to that: nothing in the game may call it)
  const BYCODE = /^src\/game\/wallcharge\.ts:/, byCode = sites.filter(at => BYCODE.test(at)), byCodeCalls = game.flatMap(f => codeHits(f, /\bwallCharge\??\.order\(/));
  // (a quiet mission as two — quiet.ts — puts its one partner on 'fall in' once as the run is staged, as the rescue's two automatic fall-ins do: no key gives it.
  //  Let through, and held to that: one call in the file, and it is the fall in)
  const STAGED = /^src\/game\/quiet\.ts:/, staged = sites.filter(at => STAGED.test(at)), stagedOk = staged.length <= 1 && staged.every(at => { const ln = code0(read('src/game/quiet.ts').split('\n')[+at.split(':')[1] - 1]); return /\.give\('fallIn',/.test(ln) && (ln.match(/\.give\(/g) ?? []).length === 1; });   // (sites are counted per line: the line holds exactly one give, and it is the fall in)
  // (B's own pick — autopilot.ts autoQuick — and the plan the word's key sends — planlay.ts laySend — give through SquadOrders.give too: let through, and held to
  //  that: each is called from the game in ONE place, the press that orders.ts input() reads)
  const BEHIND = /^src\/game\/(autopilot|planlay)\.ts:/, behind = sites.filter(at => BEHIND.test(at)), entry = game.flatMap(f => codeHits(f, /\b(?:autoQuick|laySend)\(/)).filter(at => !/^src\/game\/(autopilot|planlay)\.ts:/.test(at));
  const behindOk = entry.every(at => at.startsWith('src/game/orders.ts:')) && entry.every(at => /input\.(hit|pressed\.delete)\(/.test(code0(read('src/game/orders.ts').split('\n')[+at.split(':')[1] - 1])));
  const outside = [...sites.filter(at => !/^src\/game\/(orders|doortools|rescue|nightbreach)\.ts:/.test(at) && !BYCODE.test(at) && !(STAGED.test(at) && stagedOk) && !(BEHIND.test(at) && behindOk)), ...byCodeCalls];
  // … the four files' own input reads: X / B / the middle button / digits / Space in orders.ts input(), F in the other three — all press edges (1), and the rescue's two automatic fall-ins
  const fRead = ['src/game/doortools.ts', 'src/game/rescue.ts', 'src/game/nightbreach.ts'].map(f => `${f.split('/').pop()}: ${codeHits(f, /\binput\.hit\(/).length} input.hit`);
  verdict(outside.length === 0 && sites.length > 0, 'every call that gives an order is in orders.ts (the menu, B), doortools.ts (the word on F), rescue.ts or nightbreach.ts (F) — none anywhere else in the game but a quiet pair\'s one staged fall in and the wall charge\'s order by code, which nothing in the game calls (B\'s pick in autopilot.ts and the laid plan in planlay.ts give behind orders.ts\'s own press)', `${sites.length - byCode.length - (stagedOk ? staged.length : 0) - (behindOk ? behind.length : 0) - (outside.length - byCodeCalls.length)} call sites in those four files (${['orders', 'doortools', 'rescue', 'nightbreach'].map(n => `${n}.ts ${sites.filter(at => at.startsWith(`src/game/${n}.ts:`)).length}`).join(', ')}) · quiet.ts, the staged partner's fall in: ${staged.length} · autopilot.ts / planlay.ts, behind ${entry.length} press line(s) of orders.ts: ${behind.length} · wallcharge.ts order(at) by code: ${byCode.length}, called from the game: ${byCodeCalls.length} · elsewhere in ${game.length} files: ${outside.length}${outside.length ? ` — ${outside.join(', ')}` : ''} · ${fRead.join(', ')}`);
  // (4) the Space hold-list is not an order path
  const sp = ['src/game/interact.ts', 'src/game/player.ts'].flatMap(f => codeHits(f, /\borders\.(?:give|open|pick)\(|\bdoorTools\.(?:order|go)\(|\.orderDoor\(|nightBreach\.order\(/));
  const kinds = read('src/game/game.ts').match(/export interface Interactable[\s\S]*?kind:\s*([^;]+);/)?.[1] ?? '';
  verdict(sp.length === 0 && kinds.length > 0 && !/order|squad|team/i.test(kinds), 'the Space list (tap = the top row, hold = the list: the stealth game\'s own grammar, left as it is) gives no order: nothing in interact.ts or player.ts calls one, and it has no row of that kind', `order calls there: ${sp.length} · its row kinds: ${kinds.replace(/\s+/g, ' ').slice(0, 220)}`);
  // (5) nothing a player reads says to hold X
  const WORDS = /\(hold: the list\)|(?:[Hh]old|HOLD)(?:ing|s)?[ -](?:down )?(?:the )?X\b(?! *[=.(])|\bX (?:is |key )?held\b|\bheld X\b|[Hh]old(?:ing)? (?:down )?(?:the )?(?:order|command) (?:key|menu)/;
  const shown = [...all, 'index.html'].flatMap(f => hits(f, WORDS));
  const tools = readdirSync(join(ROOT, 'tools/qa')).filter(f => /\.(ts|js)$/.test(f) && f !== 'pressorders-probes.ts').map(f => `tools/qa/${f}`).flatMap(f => hits(f, WORDS));
  verdict(shown.length === 0 && tools.length === 0, 'no line of the game, its page or its probes says to hold X (hint lines, panel tooltips, comments): 0', `src + index.html: ${shown.length}${shown.length ? ` — ${shown.join(', ')}` : ''} · tools/qa: ${tools.length}${tools.length ? ` — ${tools.join(', ')}` : ''}`);
  return done();
});
