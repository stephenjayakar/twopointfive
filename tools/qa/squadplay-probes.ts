// The 'squadplay' family: the four in two pairs PLAYED FROM THE KEYS — the press menu (orders.ts) and the pairs' behaviour (doortools.ts) on one tree — run
// through probes.ts:
//   bun run tools/qa/probes.ts squadplay | squadplay-go | squadplay-wait | squadplay-try | squadplay-side | squadplay-key | squadplay-off
// PASS / FAIL each, all headless (the Game of headless.ts under the room clear's staging with NIGHTBREACH.squad = 4 — the page's ?squad4 — Sam in god mode and
// planted dark, the defenders kept dazzled: this family is about what the keys give and to whom, the fights are the 'pairs' family's). EVERY ORDER HERE IS A
// PRESS: the harness cursor on a world point, then one-frame presses of T / X / B / F / a digit / the wheel / Space, as the page's listeners write them — no
// probe calls orders.give() — and the rig counts the keys and mouse buttons DOWN on every frame: 'nothing held' means that count never left zero. Nothing here
// looks at a picture; what the panel would draw is read as the rows orders.hud() hands it.
//   squadplay-go    the word from the keys: F, the word's own key, with or without a menu up — a floor menu and Sam's own show it as their 'go' row (key F,
//                   under its own header, naming who is waiting; greyed with the reason when nobody is; a door menu has no such row: F there is 'wait for
//                   my word') — two pairs stacked on a room's two doors go on the same frame either way; to one pair it is that pair's alone, and the
//                   squad block says who is left waiting
//   squadplay-wait  a door tool given ON THE WORD from the menu: the 'wait for my word' row of the door tools' page (digit 5 there, F, or the highlight + Space) flips, the menu stays up, the
//                   rows that will wait say so, and the row then given stacks, calls ready and waits; a bang on one door and a quiet open on the other, then one
//                   press of F: the bang first, both pairs in behind it. The row is not sticky (off on the next menu) and is not offered where it means nothing
//   squadplay-try   the other two 'Try it' cases of the pairs page by presses: red holds the corridor while blue bangs and clears the break room; red stacked
//                   on the manager's door steps back when blue is given a charge on it, and F — the orders going to blue — blows it and sends blue in
//   squadplay-side  the menu greys and words its rows for the face of the door the MEN will work from (orders.forMen), asked once when it opens and again
//                   only when who it goes to changes — not on every refresh
//   squadplay-key   F is one thing at a time: a second tap after the word is not the breach drill's 'stack up' (red is not pulled out of its entry); the 'go'
//                   row on one man's menu names him; the squad block says 'F blows it' of a set charge only while F would, and a charge on a word that
//                   is still waiting for the other pair is not blown by a second F; F with a door menu up is the wait row's second key (from the door's first page it
//                   turns to the tools with the row on)
//   squadplay-off   the pair build (two teammates) has none of it: no 'go' row, no 'wait' row, the digits past 5 (and 0) do nothing, F is not the word (unless the small squad's word, DOORTOOLS.wordSmall, is on: then it is, from a plain stack); and with four,
//                   DOORTOOLS.wordOnKey false leaves F as it was
import { standUp, ROOT } from './headless.ts';
const { NIGHTBREACH } = await import(`${ROOT}/src/game/nightbreach.ts`);
const { ROOMCLEAR } = await import(`${ROOT}/src/game/roomclear.ts`);
const { DOORTOOLS } = await import(`${ROOT}/src/game/doortools.ts`);
const { ORDERS, WORD_HEAD, sideOf } = await import(`${ROOT}/src/game/orders.ts`);
const { SILENT, squadSilent } = await import(`${ROOT}/src/game/silent.ts`);
const { WORDS } = await import(`${ROOT}/src/game/words.ts`);
const { CMDRING } = await import(`${ROOT}/src/game/cmdring.ts`);

const DT = 1 / 60;
/** the keys of the door menu since no order is on a digit above 5: 5 on its first page turns to the door tools' page, where the four are 1 to 4 */
const TOOLS = 'Digit5', OPEN = 'Digit1', BANG = 'Digit2', CHARGE = 'Digit3';
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x));
const at = (p: number[]) => `(${p[0].toFixed(1)}, ${p[2].toFixed(1)})`;
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const names = (l: any[]) => l.map((g: any) => g.callsign).join(' + ');
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const DT_DEFAULTS = JSON.parse(JSON.stringify(DOORTOOLS)), RC_DEFAULTS = { ...ROOMCLEAR }, NB_DEFAULTS = { ...NIGHTBREACH }, ORD_DEFAULTS = { ...ORDERS, followBack: [...ORDERS.followBack] };
const reset = () => { Object.assign(DOORTOOLS, JSON.parse(JSON.stringify(DT_DEFAULTS))); Object.assign(ROOMCLEAR, RC_DEFAULTS); Object.assign(NIGHTBREACH, NB_DEFAULTS); Object.assign(ORDERS, ORD_DEFAULTS, { followBack: [...ORD_DEFAULTS.followBack] }); };
/** every probe leaves the knob tables as it found them, pass, fail or throw */
const guarded = (fn: () => Promise<boolean>) => async () => { try { return await fn(); } finally { reset(); } };

// where Sam stands: the corridor outside both of the break room's doors · by the manager's door
const CORRIDOR: number[] = [25.0, 0, 11.0], MANAGER: number[] = [24.0, 0, 11.2];
/** the corridor spot the holding pair is put on (the pairs family's): between the break room's north door and the storage door · open floor on the aisle */
const FLANK: number[] = [28.5, 0, 11.0], SPOT: number[] = [15, 0, 17.6];
const BREAKROOM = { x0: 28.12, x1: 35.88, z0: 12.26, z1: 23.88 };
const inBounds = (b: { x0: number; x1: number; z0: number; z1: number }, p: number[], m = 0) => p[0] > b.x0 - m && p[0] < b.x1 + m && p[2] > b.z0 - m && p[2] < b.z1 + m;

/** One game under a seed: the room clear staged with `squad` teammates (default four), Sam in god mode, dark, at `sam`, the defenders dazzled every frame. */
async function rig(seed: number, sam: number[], o: { squad?: 2 | 4; knobs?: () => void } = {}) {
  reset(); Object.assign(NIGHTBREACH, { squad: o.squad ?? 4 }); o.knobs?.();
  Math.random = seeded(seed);
  const W: any = await standUp(); const game = W.game, input = W.input; const RC = game.roomClear, NB = game.nightBreach, O = game.orders, D = game.doorTools;
  game.godMode = true; const why = RC.start(seed);
  const K = ORDERS;
  const R = { W, game, input, RC, NB, O, D, why,
    /** the most keys + mouse buttons DOWN at the start of any frame so far (a one-frame press is not a key down: `pressed` / `clicked`, never `keys` / `buttons`) */
    held: 0, /** every press made, in order (the report's 'how') */ keys: [] as string[], post: null as null | (() => void),
    get ops(): any[] { return NB.ops; },
    step(n = 1) { for (let i = 0; i < n; i++) {
      game.player.visibility = 0.05; for (const h of NB.hostiles) if (h.state !== 'dead') h.dazzledUntil = game.time + 5;
      R.held = Math.max(R.held, input.keys.size + (input.buttons ? 1 : 0));
      W.step(DT); R.post?.(); } },
    until(pred: () => boolean, secs: number) { for (let i = 0; i < secs * 60 && !pred(); i++) R.step(); return pred(); },
    door(name: string): any { return game.doors.list.find((d: any) => d.def.name === name); },
    men(who: any, down = false): any[] { return O.men(who, { down }); },
    /** the cursor on a world point · on a door · on Sam himself (nobody's floor: T there steps the element, B is 'fall in') */
    cursor(p: number[]) { return W.cursorAt([p[0], p[1], p[2]]); },
    /** (on the part of the doorway the camera can see, as a player points: from where Sam stands a wall hides the foot of some doors, and a cursor there is on
     *  that wall's top — so the first of the frame's middle, its head and its foot that the cursor's own pick calls this door) */
    onDoor(name: string): boolean { const d = R.door(name), c = d.frameCentre;
      for (const y of [1.0, 2.0, 0.1]) { R.cursor([c[0], y, c[2]]); const t = O.targetUnder(input, W.cam, W.canvas); if (t.kind === 'door' && t.door === d) return true; }
      return false; },
    onSam() { const p = game.player.char.pos; return R.cursor([p[0], 1.0, p[2]]); },
    /** the cursor where its own pick calls the spot Sam's (nobody's floor, no teammate) — from where the camera stands, or, with a wall between it and
     *  him (the corridor's, from the south), after a quarter turn or two of the camera, as a player turns it with Q / E. False: no such view */
    onSelf(): boolean { const p = game.player.char.pos, yaw0 = W.cam.yaw;
      for (const turn of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        if (turn) { W.cam.yaw = yaw0 + turn; for (let i = 0; i < 30; i++) R.step(); }
        for (const y of [0.05, 1.0]) { R.cursor([p[0], y, p[2]]); const t = O.targetUnder(input, W.cam, W.canvas); if (t.kind === 'none' && !t.man) return true; } }
      return false; },
    /** one-frame presses, as the page's listeners write them (several codes: all in the one frame) */
    press(...codes: string[]) { for (const c of codes) { input.pressed.add(c); } R.keys.push(codes.map(c => c.replace(/^Key|^Digit/, '')).join('+')); R.step(); },
    wheel(d: number) { input.wheel += d; R.keys.push(d > 0 ? 'wheel↓' : 'wheel↑'); R.step(); },
    /** T, with the cursor on Sam, until the orders go to `want` (at most a lap) */
    who(want: 'all' | 'red' | 'blue'): boolean { R.onSam(); for (let i = 0; i < 4 && O.who !== want; i++) R.press(K.whoKey); return O.who === want; },
    /** X with the cursor on a door / a floor point: the menu, up */
    menuOnDoor(name: string): any { R.onDoor(name); R.press(K.key); return O.menu; },
    menuOnFloor(p: number[]): any { R.cursor(p); R.press(K.key); return O.menu; },
    /** X on a door, then 5: the door tools' page of its menu */
    toolsOnDoor(name: string): any { R.menuOnDoor(name); R.press(TOOLS); return O.menu; },
    /** the open menu as the panel gets it: its rows after the who row, each '<key> <text>' under its header (a header shown once: `cont` rows are under the last) */
    rows(): { key: string; text: string; head: string; off: boolean }[] { const m = O.hud().menu; if (!m) return []; let head = '';
      return m.rows.slice(1).filter((r: any) => r.kind !== 'cancel').map((r: any) => { if (!r.cont) head = r.label; return { key: r.opts[0]?.key ?? '', text: r.opts[0]?.text ?? '', head, off: !!r.off }; }); },
    row(key: string) { return R.rows().find(r => r.key === key) ?? null; },
    /** the squad block's lines while the menu is down (the keyed ones as '[F] …') */
    notes(): string[] { const s = O.hud().status[0]; return s ? s.opts.map((o: any) => `${o.key ? `[${o.key}] ` : ''}${o.text}`) : []; },
    last(): any { return O.log[O.log.length - 1] ?? null; },
    set(who: any = 'all', secs = 35) { return R.until(() => R.men(who).every((m: any) => O.of(m)?.arrived), secs); },
    where(who: any = 'all') { return R.men(who, true).map((m: any) => `${m.callsign} ${m.state === 'dead' ? 'DOWN' : at(m.char.pos)} [${O.statusOf(m)}]`).join(' · '); },
    beatT(op: any, what: string): number { return op?.beats.find((b: any) => b.what === what || b.what.startsWith(what))?.t ?? NaN; },
  };
  R.step(30); game.teleportPlayer(sam); R.step(60);   // (a second for the follow camera to settle on him: the cursor is put on world points through it)
  return R;
}
const line = (l: any) => l ? `${l.order} → ${l.who.join(' + ')} on ${l.target}` : 'nothing';
const fmtRows = (rows: { key: string; text: string; head: string; off: boolean }[]) => rows.map(r => `${r.key} ${r.text}${r.off ? ' (greyed)' : ''}`).join(' | ');
/** the word's row by its text ('go — nobody waiting.', 'go · blue'): never the squad's posture rows, 'go silent' / 'go loud' (src/game/silent.ts), which the
 *  page lists beside it on a floor's menu and on Sam's own — on the first page's spare digit, 5, under their own header */
const isGo = (text: string) => /^go( [—·] |$)/.test(text), SQUAD_HEAD = 'the whole squad';
/** red stacked on the break room's north door, blue on its west door — by T and the quick key B on each door */
function stackBoth(R: any): boolean {
  const a = R.who('red'); R.onDoor('breakroom_n'); R.press(ORDERS.quickKey); const l1 = R.last();
  const b = R.who('blue'); R.onDoor('breakroom_w'); R.press(ORDERS.quickKey); const l2 = R.last();
  return a && b && l1?.order === 'stack' && l1.target === 'door:breakroom_n' && l2?.order === 'stack' && l2.target === 'door:breakroom_w' && R.set('all', 40);
}

// ============================================================================================================================ squadplay-go
export const squadplayGo = guarded(async () => {
  const { verdict, done } = family('squadplay-go: the word from the keys — F, with a menu up (its go row) and with none');
  const K = ORDERS, F = DOORTOOLS.blowKey;
  // ---- nobody waiting: the row is there on every kind of target, greyed, and giving it is refused
  { const R = await rig(5, CORRIDOR); const { O } = R;
    // (SILENT.on, as the page has it: 'go silent' is a row of the floor's menu and of Sam's own, on 5 under the whole squad's header — live with nobody waiting,
    //  it is not the word — and 'go' stays the F row beside it. A door's menu lists neither: its 5 is the door tools. The harness's older stand has no such row.)
    const sil = !!SILENT.on;
    R.menuOnFloor(SPOT); const onFloor = R.row('F'), silFloor = R.rows().filter(r => /^go (silent|loud)$/.test(r.text)); R.press(K.key);
    R.menuOnDoor('breakroom_n'); const rows = R.rows(); R.press(K.key);
    const found = R.onSelf(); R.press(K.key); const self = found && O.menu?.target.kind === 'none' && !O.menu.target.man, mine = R.rows(), onSam = R.row('F'), n0 = O.log.length;
    for (let i = O.menu?.rows.findIndex((d: any) => d.id === 'go') ?? 0; i > 0; i--) R.wheel(60); const hl = O.menu?.rows[O.menu.sel]?.id; R.press('Space'); const up = !!O.menu;
    const silMine = mine.filter(r => /^go (silent|loud)$/.test(r.text)), silOk = (l: typeof mine) => sil ? l.length === 1 && l[0].key === '5' && l[0].text === 'go silent' && l[0].head === SQUAD_HEAD && !l[0].off : l.length === 0;
    verdict(!!onFloor && !!onSam && self && mine.length === (sil ? 4 : 3) && silOk(silMine) && silOk(silFloor) && onFloor.head === WORD_HEAD && onSam.head === WORD_HEAD && onSam.off && /^go — nobody waiting\.$/.test(onSam.text) && mine.filter(r => r.key === 'F').length === 1 && mine.filter(r => isGo(r.text)).length === 1 && !rows.some(r => /^go\b/.test(r.text) || r.head === WORD_HEAD || r.head === SQUAD_HEAD) && rows.length === 5 && rows.every((r, i) => r.key === String(i + 1)),
      sil ? 'nobody waiting: \'go\' is the F row of a floor menu and of Sam\'s own, under its own header, greyed with the reason — on no digit, and not the live \'go silent\' beside it (5, under the whole squad\'s header); a door menu has neither row (F there is \'wait for my word\'): its five rows are 1 to 5'
        : 'nobody waiting: \'go\' is the F row of a floor menu and of Sam\'s own, under its own header, greyed with the reason — on no digit; a door menu has no such row (F there is \'wait for my word\'): its five rows are 1 to 5', `floor: ${onFloor ? `${onFloor.head} › ${onFloor.key} ${onFloor.text}` : 'no row'} · Sam: ${fmtRows(mine)} · door: ${fmtRows(rows)}`);
    verdict(hl === 'go' && O.log.length === n0 && !up && R.D.stats.words === 0, 'the greyed row given (the wheel onto it, Space): no order goes out, no word is given, the menu is away', `highlight on '${hl}' · orders logged ${O.log.length - n0} · words ${R.D.stats.words} · menu up ${up}`); }
  // ---- two doors, one word: by F with a floor menu up (its go row), and by F alone
  for (const how of ['menu', 'F'] as const) {
    const R = await rig(9, CORRIDOR); const { O, D } = R;
    const stacked = stackBoth(R);
    const blueNote = R.notes().filter(s => /waiting/.test(s)).join(' ; ');   // (the orders still go to blue: F would be blue's alone)
    const gold = R.who('all'), goldNote = R.notes().filter(s => /waiting/.test(s)).join(' ; ');
    let row: any = null, away = true; if (how === 'menu') { R.menuOnFloor(SPOT); R.step(10); row = R.row('F'); R.press(F); away = O.menu === null; } else R.press(F);
    const l = R.last(), ops = [...D.ops], gos = () => ops.map((op: any) => R.beatT(op, 'go'));
    R.until(() => !D.ops.length, 40); R.step(60);
    const g2 = gos(), same = ops.length === 2 && Math.abs(g2[0] - g2[1]) < 1.5 * DT, inAll = ops.every((op: any) => op.ended === 'in');
    verdict(stacked && gold && /^\[F\] go · blue waiting/.test(blueNote) && /^\[F\] go · red \+ blue waiting/.test(goldNote), `(${how}) T + B on each door stacks red north and blue west, and the squad block names who F would send: blue while the orders go to blue, both once they go to gold`, `stacked ${stacked} · to blue: "${blueNote}" · to gold: "${goldNote}" · ${R.keys.join(' ')}`);
    if (how === 'menu') verdict(!!row && !row.off && row.text === 'go · red + blue' && row.head === WORD_HEAD, '(menu) the row reads who would go and is live', row ? `${row.head} › ${row.key} ${row.text}${row.off ? ' (greyed)' : ''}` : 'no go row');
    verdict(l?.order === 'go' && l.who.length === 4 && D.stats.words === 1 && same && inAll && away && R.held === 0, `(${how}) ${how === 'menu' ? 'X, then F (the menu goes away with it)' : 'one press of F'}: the word goes to all four, both doors go on the same frame, both orders end 'in' — nothing held`, `${line(l)} · words ${D.stats.words} · ${ops.map((op: any, i: number) => `${op.door.def.name} (${names(op.men)}) go at ${f2(g2[i])}, ended '${op.ended}'`).join(' · ')} · most keys held ${R.held}`);
  }
  // ---- the word to one pair by F: the other keeps its stack, and the block says who is still waiting
  { const R = await rig(9, CORRIDOR); const { O, D } = R; const dw = R.door('breakroom_w');
    const stacked = stackBoth(R), red = R.who('red'); R.press(F); const l = R.last(), ops = [...D.ops];
    R.until(() => !D.ops.length, 40); R.step(60);
    const blue = R.men('blue'), still = blue.every((m: any) => O.of(m)?.order === 'stack' && O.of(m).door === dw && !inBounds(BREAKROOM, m.char.pos, -0.3));
    const note = R.notes().filter(s => /waiting/.test(s)).join(' ; ');
    verdict(stacked && red && l?.order === 'go' && l.who.join(' + ') === 'Red One + Red Two' && ops.length === 1 && ops[0].ended === 'in' && still, 'the orders going to red, F: red goes in at its door and blue stays stacked on its own', `${line(l)} · ${ops.map((op: any) => `${op.door.def.name} ended '${op.ended}'`).join(' · ')} · ${R.where('blue')}`);
    // (the squad's only keys, cmdring.ts `only`: there is no who key to turn to blue with, so the word is theirs — it frees whoever stands waiting on it)
    if (CMDRING.only) verdict(/^\[F\] go · blue waiting/.test(note), '… and with red in, the squad block offers F for blue, who are the ones still waiting (the squad\'s only keys: the word frees whoever waits on it)', `"${note}"`);
    else verdict(/^blue waiting · T, then F$/.test(note), '… and with red in, the squad block says blue is still waiting and how to reach them (no key offered: F would not be theirs)', `"${note}"`);
    const toBlue = CMDRING.only ? O.who === 'red' : R.who('blue'); R.press(F); const l2 = R.last(); R.until(() => !D.ops.length, 40);
    verdict(toBlue && l2?.order === 'go' && l2.who.join(' + ') === 'Blue One + Blue Two' && D.stats.words === 2 && R.held === 0, CMDRING.only ? 'F again, the orders still going to red: blue goes — nothing held' : 'T to blue, F: blue goes — nothing held', `${line(l2)} · words ${D.stats.words} · ${R.keys.join(' ')}`); }
  return done();
});

// ============================================================================================================================ squadplay-wait
export const squadplayWait = guarded(async () => {
  const { verdict, done } = family('squadplay-wait: a door tool given ON THE WORD from the menu — a row that flips, never a key held');
  const K = ORDERS, F = DOORTOOLS.blowKey, W0 = K.waitKey;
  const R = await rig(5, CORRIDOR); const { O, D } = R;
  // ---- red: X on the north door, 5 (the door tools), 5 again (the wait row), then 2 (bang and clear)
  const red = R.who('red'); R.menuOnDoor('breakroom_n'); R.step(10); const first = R.rows(), opener = R.row('5'); R.press(TOOLS); R.step(5);
  const before = R.rows(), w0 = before[before.length - 1];
  R.press(W0); const up1 = !!O.menu, after = R.rows(), w1 = after[after.length - 1], n1 = O.log.length;
  const waits = after.filter(r => /^wait · /.test(r.text)).map(r => r.key).join(','), waits0 = before.filter(r => /^wait · /.test(r.text)).length;
  // (row 4 by DOORTOOLS.outsidePlain, on in the page: the ONE order 'clear from outside', which waits for the word like the rows above it and says so the
  //  same way — given on the word further down. With the switch off, as on the harness's older stand, row 4 turns to the threshold's page and says the word is on behind it.)
  const plain = !!DOORTOOLS.outsidePlain;
  const row4 = plain ? after[3]?.text === 'wait · clear from outside' && before[3]?.text === 'clear from outside' && waits === '1,2,4,G' : / · on my word: ON$/.test(after[3]?.text ?? '') && !/on my word/.test(before[3]?.text ?? '') && waits === '1,2,G';
  verdict(red && first.length === 5 && /^door tools ▸ · F: on my word$/.test(opener?.text ?? '') && O.menu?.page === 'tools' && W0 === 'Digit5' && w0?.key === '5' && w0.head === WORD_HEAD && /^wait for my word \(F\) · off$/.test(w0.text) && before.length === 6 && before.slice(0, 4).every((r, i) => r.key === String(i + 1)) && before[4].key === 'G', 'the door menu for the four: row 5 turns to the door tools\' page, whose four tools are 1 to 4 (frag and clear rides its own letter, G) and which ends in a \'wait for my word\' row on digit 5, off, under the word\'s header', `${fmtRows(first)} ▸ ${fmtRows(before)}`);
  verdict(up1 && /^wait for my word \(F\) · ON$/.test(w1?.text ?? '') && row4 && after[2]?.key === '3' && !/^wait · /.test(after[2].text) && waits0 === 0 && n1 === 0,
    plain ? '5 pressed: the row is ON, the menu is still up, no order has gone, and the rows that will wait say so first (\'wait · …\') — open and clear, bang and clear, clear from outside on row 4, frag and clear (not the charge)'
      : '5 pressed: the row is ON, the menu is still up, no order has gone, and the rows that will wait say so first (\'wait · …\') — open and clear, bang and clear, frag and clear (not the charge) — and row 4, the turn to the threshold\'s page, says the word is on behind it', `menu up ${up1} · orders logged ${n1} · ${fmtRows(after)}`);
  R.press(BANG); const l1 = R.last(), op1 = D.ops[0];
  verdict(l1?.order === 'bangClear' && l1.who.join(' + ') === 'Red One + Red Two' && !!op1?.onWord && !O.menu, '2: bang and clear goes to red ON THE WORD, and the menu is away', `${line(l1)} · the door order waits on the word: ${!!op1?.onWord}`);
  // ---- blue: X on the west door, 5 — the row is off again; the wheel up to it, Space, then 1 (open and clear)
  const blue = R.who('blue'); R.toolsOnDoor('breakroom_w'); R.step(10);
  const fresh = R.rows(), sticky = /ON/.test(fresh[fresh.length - 1]?.text ?? '');
  R.wheel(-60); R.wheel(-60); const sel = O.menu?.sel, hl = O.hud().menu?.rows[O.hud().menu.primary]; R.press('Space'); const up2 = !!O.menu, on2 = !!O.menu?.onWord;
  R.press(OPEN); const l2 = R.last(), op2 = D.ops.find((o: any) => o.kind === 'openClear');
  verdict(blue && !sticky, 'the next menu starts with the row off: waiting is asked for each time, never left on', `the row on the fresh menu: "${fresh[fresh.length - 1]?.text}"`);
  verdict(sel === 5 && /wait for my word/.test(hl?.opts[0]?.text ?? '') && up2 && on2 && l2?.order === 'openClear' && l2.who.join(' + ') === 'Blue One + Blue Two' && !!op2?.onWord, 'the wheel up twice puts the highlight on it (past the close row), Space flips it with the menu still up, then 1: open and clear goes to blue on the word', `highlight on row ${sel} "${hl?.opts[0]?.text}" · menu up after Space ${up2}, on ${on2} · ${line(l2)} · waits on the word: ${!!op2?.onWord}`);
  // ---- both stack, call ready, and wait; then gold, F
  const ready = R.until(() => D.ops.length === 2 && D.ops.every((o: any) => o.phase === 'ready'), 45); R.step(180);
  const still = D.ops.length === 2 && D.ops.every((o: any) => o.phase === 'ready'), gold = R.who('all'), note = R.notes().filter(s => /^\[F\]/.test(s)).join(' ; ');
  verdict(ready && still && gold && /^\[F\] go · red \+ blue waiting/.test(note), 'both pairs stack, call ready and are still waiting three seconds on; the squad block offers F for both', `ready ${ready} · still ready 3 s on ${still} · "${note}" · ${R.where()}`);
  R.press(F); const l3 = R.last(), ops = [...D.ops], rop = ops.find((o: any) => o.kind === 'bangClear'), bop = ops.find((o: any) => o.kind === 'openClear');
  R.until(() => !D.ops.length, 45); R.step(120);
  const bang = R.beatT(rop, 'bang'), rgo = R.beatT(rop, 'go'), bshove = R.beatT(bop, 'shove'), bgo = R.beatT(bop, 'go');
  verdict(l3?.order === 'go' && l3.who.length === 4 && bang < bgo && Math.abs(bshove - rgo) < 2.5 * DT && bgo >= rgo && ops.every((o: any) => o.ended === 'in') && R.held === 0, 'one press of F: the bang goes first at the north door, the west door is shoved as the bang door\'s men go, both orders end \'in\' — two doors, one word, a bang on one, from the keys alone with nothing held',
    `${line(l3)} · red (bang, north) bang ${f2(bang)} go ${f2(rgo)} · blue (open, west) shove ${f2(bshove)} go ${f2(bgo)} · ended ${ops.map((o: any) => `'${o.ended}'`).join(' ')} · most keys held ${R.held} · ${R.keys.join(' ')}`);
  // ---- the wait row's digit and a tool's in ONE frame is that tool on the word; F from the door's first page turns to the tools with the row on (and a
  // ---- plain stack up from that page waits for nothing); where the row means nothing it is not there and neither key does anything
  { const R2 = await rig(5, CORRIDOR); const O2 = R2.O, D2 = R2.D;
    R2.who('red'); R2.toolsOnDoor('breakroom_n'); R2.press(W0, OPEN); const l = R2.last(), w = !!D2.ops[0]?.onWord;
    R2.who('blue'); R2.menuOnDoor('breakroom_w'); R2.press(F); const page = O2.menu?.page, onF = !!O2.menu?.onWord, nF = O2.log.length; R2.press(OPEN); const lf = R2.last(), wf = !!D2.ops.find((o: any) => o.door === R2.door('breakroom_w'))?.onWord;
    R2.who('red'); R2.menuOnDoor('breakroom_n'); R2.press('Digit1'); const lp = R2.last();   // (stack up is on the first page, where there is no wait row: it is given as ever)
    R2.who('blue'); R2.menuOnFloor(SPOT); const fl = R2.rows(), n0 = O2.log.length, slot0 = R2.game.player.slot; R2.press(W0); const up = !!O2.menu, n1 = O2.log.length;
    // (SILENT.on, as the page has it: a floor menu's 5 is 'go silent' — given, the menu is away and the squad is silent; it moves nobody, so it is not an order
    //  of the log; the row then reads 'go loud'. 0 is asked of that second menu. With the switch off 5 is no row's key there and both keys find the one menu up.)
    const sil = !!SILENT.on, silent = squadSilent(R2.game), fl2 = sil ? (R2.menuOnFloor(SPOT), R2.rows()) : fl;
    R2.press('Digit0'); const up0 = !!O2.menu, n2 = O2.log.length; R2.press(K.key);
    verdict(l?.order === 'openClear' && w && page === 'tools' && onF && nF === 1 && lf?.order === 'openClear' && wf && lp?.order === 'stack', '5 (the wait row) and 1 in the same frame on the tools page: open and clear on the word; F on the door\'s first page: the tools page with the row ON and no order yet, then 1 is open and clear on the word; 1 on a first page: a plain stack up (it has nothing to wait for)', `${line(l)} · waits ${w} · F: page ${page}, on ${onF}, orders ${nF} · then ${line(lf)} · waits ${wf} · then ${line(lp)}`);
    const five = fl.find(r => r.key === '5'), five2 = fl2.find(r => r.key === '5');
    const on5 = sil ? five?.text === 'go silent' && five.head === SQUAD_HEAD && !up && silent && five2?.text === 'go loud' && squadSilent(R2.game) : !five && up && !silent;
    verdict(!fl.some(r => /wait for my word/.test(r.text)) && !fl2.some(r => /wait for my word/.test(r.text)) && on5 && n1 === n0 && up0 && n2 === n0 && R2.game.player.slot === slot0,
      sil ? 'a floor menu has no \'wait\' row: 5 there is \'go silent\' — the menu goes away, the squad is silent, nothing is logged (it moves nobody) and the row then reads \'go loud\'; 0 does nothing: the menu stays, no order, Sam\'s slot as it was'
        : 'a floor menu has no \'wait\' row, and 5 and 0 there do nothing: the menu stays, no order, Sam\'s slot as it was', `floor rows: ${fmtRows(fl)} · menu up ${up} / ${up0} · orders logged ${n2 - n0}${sil ? ` · silent ${silent} · then: ${fmtRows(fl2.filter(r => r.key === '5'))}` : ''}`); }
  // ---- 'clear from outside' on the word (DOORTOOLS.outsidePlain: the tools' row 4 is that one order): 5, then 4 — red holds the north door's jambs and waits
  if (DOORTOOLS.outsidePlain) { const R3 = await rig(5, CORRIDOR); const O3 = R3.O, D3 = R3.D;
    const red = R3.who('red'); R3.toolsOnDoor('breakroom_n'); R3.step(5); R3.press(W0); const r4 = R3.row('4'); R3.press('Digit4'); const l = R3.last(), op = D3.ops[0], away = !O3.menu;
    R3.until(() => D3.ops.length === 1 && D3.ops[0].phase === 'ready', 45); R3.step(180);
    const waiting = D3.ops.length === 1 && D3.ops[0] === op && !R3.beatT(op, 'go') && R3.men('red').every((m: any) => !inBounds(BREAKROOM, m.char.pos, -0.3)), note = R3.notes().filter(s => /waiting/.test(s)).join(' ; ');
    verdict(red && r4?.text === 'wait · clear from outside' && l?.order === 'thresholdHold' && l.who.join(' + ') === 'Red One + Red Two' && l.target === 'door:breakroom_n' && !!op?.onWord && away && waiting && /red waiting/.test(note) && D3.stats.words === 0,
      '5, then 4: clear from outside goes to red ON THE WORD and the menu is away — three seconds after they are ready nobody has gone, the room is not entered, and the squad block says red is waiting', `${line(l)} · waits on the word: ${!!op?.onWord} · phase '${op?.phase}' · "${note}" · ${R3.where('red')} · words ${D3.stats.words}`); }
  return done();
});

// ============================================================================================================================ squadplay-try
export const squadplayTry = guarded(async () => {
  const { verdict, done } = family('squadplay-try: hold while clearing, and a tool on a held door — by presses');
  const K = ORDERS, F = DOORTOOLS.blowKey;
  // ---- hold while clearing: T to red, B on the corridor spot, X + 4 (hold); T to blue, X on the west door, 5, 2 (bang and clear)
  { const R = await rig(5, CORRIDOR); const { O, D } = R;
    const red = R.who('red'); R.cursor(FLANK); R.press(K.quickKey); const l0 = R.last(); const there = R.set('red', 30);
    R.menuOnFloor(FLANK); R.press('Digit4'); const l1 = R.last(); R.step(60);
    const reds = R.men('red'), arcs = reds.map((m: any) => O.statusOf(m)), posts = reds.map((m: any) => [...m.char.pos]);
    const blue = R.who('blue'); R.toolsOnDoor('breakroom_w'); R.step(10); const row = R.row('2'); R.press(BANG); const l2 = R.last(), op = D.ops[0];
    let kept = true, strayed = 0; R.post = () => { reds.forEach((m: any, i: number) => { if (m.state === 'dead') return; if (O.of(m)?.order !== 'hold') kept = false; strayed = Math.max(strayed, dist(m.char.pos, posts[i])); }); };
    const ended = R.until(() => !D.ops.length, 50); R.step(60); R.post = null;
    verdict(red && l0?.order === 'move' && there && l1?.order === 'hold' && l1.who.join(' + ') === 'Red One + Red Two' && arcs.every((s: string) => WORDS.on ? /^holding\b/.test(s) && !/\b(north|south|east|west)\b/.test(s) : /^holding · /.test(s)) && (WORDS.on || arcs[0] !== arcs[1]),   // (the dialogue pass on: the row names the place watched or says 'holding', never a bearing)
      'T, B on the corridor spot, then X and 4: red goes there and holds, a way out each', `${line(l0)} · ${line(l1)} · ${reds.map((m: any, i: number) => `${m.callsign} [${arcs[i]}]`).join(' · ')}`);
    verdict(blue && /^bang and clear/.test(row?.text ?? '') && !row?.off && l2?.order === 'bangClear' && l2.who.join(' + ') === 'Blue One + Blue Two' && op?.men.length === 2 && ended && op.ended === 'in' && kept && strayed < 1 && R.held === 0, 'T, X on the west door, 5, 2: blue bangs and clears the break room while red keeps its hold from the order to the end — nothing held', `${line(l2)} · blue's order ended '${op?.ended}' · red still on 'hold' throughout ${kept}, never more than ${f2(strayed)} m off · most keys held ${R.held} · ${R.keys.join(' ')}`); }
  // ---- a tool on a held door: T to red, B on the manager's door; T to blue, X on it, 5, 3 (charge); F blows it
  { const R = await rig(5, MANAGER); const { O, D } = R; const d = R.door('manager');
    const red = R.who('red'); R.onDoor('manager'); R.press(K.quickKey); const l0 = R.last(); const set = R.set('red', 35);
    const reds = R.men('red'), before = reds.map((m: any) => [...O.of(m).post]);
    const blue = R.who('blue'); R.toolsOnDoor('manager'); R.step(10); const row = R.row('3'); R.press(CHARGE); const l1 = R.last(), op = D.ops[0]; R.step(2);
    const as = reds.map((m: any) => O.of(m)), back = as.every((a: any, i: number) => a?.order === 'stack' && a.door === d && String(a.there).startsWith('rear security') && dist(a.post, before[i]) > 0.5);
    const armed = R.until(() => D.set.length === 1, 45); R.step(30);
    const note = R.notes().filter(s => /^\[F\]/.test(s)).join(' ; ');
    R.press(F); const l2 = R.last(); const blown = R.until(() => D.set.length === 0, 2); R.until(() => !D.ops.length, 40); R.step(60);
    const stillRed = reds.every((m: any) => m.state === 'dead' || (O.of(m)?.order === 'stack' && O.of(m).door === d));
    verdict(red && l0?.order === 'stack' && set && blue && /^breach with a charge/.test(row?.text ?? '') && !row?.off && l1?.order === 'charge' && l1.who.join(' + ') === 'Blue One + Blue Two' && back, 'red stacked on the manager\'s door by T + B; T, X on it, 5, 3: the charge is blue\'s, and red steps back to rear security with its order still \'stack up\' on that door', `${line(l0)} · ${line(l1)} · ${reds.map((m: any, i: number) => `${m.callsign} ${at(before[i])} → ${at(as[i].post)} [${as[i].there}]`).join(' · ')}`);
    verdict(armed && /^\[F\] go · blue waiting/.test(note) && l2?.order === 'go' && l2.who.join(' + ') === 'Blue One + Blue Two' && blown && op?.ended === 'in' && stillRed && R.held === 0, 'the charge set, the block offers F; F: the charge is blown and blue goes in behind it — red keeps its order; nothing held', `set ${armed} · "${note}" · ${line(l2)} · blown ${blown} · blue's order ended '${op?.ended}' · red still on 'stack' ${stillRed} · most keys held ${R.held} · ${R.keys.join(' ')}`); }
  return done();
});

// ============================================================================================================================ squadplay-side
export const squadplaySide = guarded(async () => {
  const { verdict, done } = family('squadplay-side: the menu greys and words its rows for the men\'s face of the door, asked once per menu');
  const K = ORDERS;
  // red sent into the break room (T, B on its floor); Sam in the corridor: the north door's corridor face is Sam's, its room face is red's
  const R = await rig(5, CORRIDOR); const { O, game: g } = R; const dn = R.door('breakroom_n');
  R.who('red'); R.cursor([31.5, 0, 16.5]); R.press(K.quickKey); const inRoom = R.set('red', 40) && R.men('red').every((m: any) => inBounds(BREAKROOM, m.char.pos));
  let asks = 0; const sideFor = O.sideFor.bind(O); O.sideFor = (...a: any[]) => { asks++; return sideFor(...a); };
  const M = R.menuOnDoor('breakroom_n'); const a1 = asks; const samSide = sideOf(dn, g.player.char.pos), want = O.forMen({ kind: 'door', at: dn.frameCentre, door: dn, side: samSide }, R.men('red')).side; asks = a1;
  const head = O.hud().menu?.rows[1]?.label ?? '';
  const read0 = M?.readT ?? NaN; R.step(Math.round(3.5 * 60)); const a2 = asks, up = !!O.menu, reread = (O.menu?.readT ?? NaN) - read0;   // (three refreshes of the why-nots on: the men's side is not asked again)
  verdict(inRoom && !!M && M.menSide === want && want !== samSide && / · far side$/.test(head), 'red in the break room, Sam in the corridor, X on the north door: the menu is for red\'s face of it (the room\'s), and its header says so', `in the room ${inRoom} · Sam's face ${samSide} · the men's ${want} · the menu's ${M?.menSide} · header "${head}"`);
  verdict(a1 === 1 && a2 === 1 && up && reread >= 2.9, 'the men\'s face is asked once when the menu opens — not again over 3.5 s of the menu up, while the rows were re-read (three times)', `asked ${a1} on opening · ${a2} after 3.5 s · the rows last re-read ${f2(reread)} s after the opening · menu up ${up}`);
  // each row's greying is what give() will say for those men on THEIR face — compared with what Sam's face would have greyed
  const t = { ...M.target, side: want }, tSam = { ...M.target, side: samSide }; const men = R.men('red');
  const mine = M.rows.map((d: any) => O.whyNot(d, t, d.only ? (d.only(O, men, t).length ? d.only(O, men, t) : men) : men)), sams = M.rows.map((d: any) => O.whyNot(d, tSam, men));
  const diff = M.rows.map((d: any, i: number) => mine[i] !== sams[i] ? `${d.id}: men's face "${mine[i] ?? 'ok'}" / Sam's face "${sams[i] ?? 'ok'}"` : '').filter(Boolean);
  const said = (rows: any[], why: any[]) => rows.map((d: any, i: number) => `${d.id}${why[i] ? ` ✗ ${why[i]}` : ''}`).join(' · '), first = said(M.rows, M.why), firstOk = M.why.join('|') === mine.join('|');
  // … and the same on the door tools' page (5), which is the same menu on the same face: turning to it and back asks nothing again
  R.press(TOOLS); const onPage = M.page === 'tools' && O.menu === M, mineT = M.rows.map((d: any) => O.whyNot(d, t, d.only ? (d.only(O, men, t).length ? d.only(O, men, t) : men) : men)), toolsOk = M.rows.length === 5 /* (the tools' four on 1 to 4, and the frag row on G at the foot) */ && M.why.join('|') === mineT.join('|'), tools = said(M.rows, M.why);
  R.press('Escape'); const backOk = O.menu === M && M.page === null && asks === a2;
  verdict(firstOk && onPage && toolsOk && backOk, 'every row — the first page\'s, and the door tools\' page behind 5 — is greyed (or not) as it would be for those men on their face of the door; turning the page and back (Esc) asks for no face again', `rows ${first} ▸ ${tools}${diff.length ? ` · differs from Sam's face on: ${diff.join(' ; ')}` : ' · (no first-page row differs by face here)'} · asked ${asks} in all`);
  R.onSam(); R.press(K.whoKey); const a3 = asks, who = O.who, head2 = O.hud().menu?.rows[1]?.label ?? '', side2 = O.menu?.menSide;
  const want2 = O.forMen({ kind: 'door', at: dn.frameCentre, door: dn, side: samSide }, R.men('blue')).side; asks = a3;
  verdict(who === 'blue' && a3 === 2 && side2 === want2 && (want2 === samSide) === !/far side/.test(head2), 'T with the menu up (the orders now blue\'s): asked once more, for blue, and the header follows their face', `who ${who} · asked ${a3} in all · blue's face ${want2} · the menu's ${side2} · header "${head2}"`);
  R.press('Digit1'); const l = R.last(); R.set('blue', 40); const posts = R.men('blue').map((m: any) => O.of(m)?.post), sides = posts.map((p: any) => p ? sideOf(dn, p) : 0);
  verdict(l?.order === 'stack' && l.who.join(' + ') === 'Blue One + Blue Two' && sides.every((s: number) => s === want2) && R.held === 0, '1: blue stacks on the face the menu was showing', `${line(l)} · blue's marks on face ${sides.join(', ')} (the menu showed ${want2}) · ${R.where('blue')}`);
  // ---- a row the two faces disagree on: red in the room, blue out in the corridor across from the door. From red's face a charge has blue behind the door; from Sam's it would not
  { const R = await rig(5, CORRIDOR); const { O, game: g } = R; const dn = R.door('breakroom_n');
    R.who('red'); R.cursor([31.5, 0, 16.5]); R.press(K.quickKey); R.who('blue'); R.onDoor('storage'); R.press(K.quickKey); const there = R.set('all', 40);   // (blue stacked on the storage door, across the corridor from the north door)
    R.who('red'); const M = R.toolsOnDoor('breakroom_n'); R.step(10); const row = R.row('3'), samSide = sideOf(dn, g.player.char.pos);
    const ch = M?.rows.find((d: any) => d.id === 'charge'), bySam = ch ? O.whyNot(ch, { ...M.target, side: samSide }, R.men('red')) : '?', row6 = R.row('2');
    verdict(there && M?.menSide === -samSide && !!row?.off && /is behind that door\.$/.test(row.text) && bySam !== M.why[M.rows.indexOf(ch)], 'red in the room, blue stacked across the corridor from the north door, the orders to red: the charge row is greyed for a teammate behind the door — which greying by Sam\'s own face would have missed', `Sam's face ${samSide} · the menu's ${M?.menSide} · row "${row?.text}" · by Sam's face it would read: ${bySam ?? 'ok (not greyed)'} · ${R.where()}`);
    const n0 = O.log.length, b0 = R.D.bangs; R.press(BANG); const n1 = O.log.length; R.toolsOnDoor('breakroom_n'); R.press(CHARGE); R.step(30);
    verdict(!!row6?.off && /is behind that door\.$/.test(row6.text) && n1 === n0 && O.log.length === n0 && R.D.ops.length === 0 && R.D.bangs === b0 && R.D.set.length === 0, '… and so is bang and clear (nobody bangs a place his own men stand in); 2, then 3, pressed on the greyed rows of the tools page: give() refuses both as the menu said — no order, no can taken, no charge', `row "${row6?.text}" · orders logged ${O.log.length - n0} · door orders ${R.D.ops.length} · bangs ${R.D.bangs} of ${b0}`); }
  return done();
});

// ============================================================================================================================ squadplay-key
export const squadplayKey = guarded(async () => {
  const { verdict, done } = family('squadplay-key: F is one thing at a time, and the block only promises what F will do');
  const K = ORDERS, F = DOORTOOLS.blowKey;
  // ---- a second tap of F does not hand red to the breach drill mid-entry
  { const R = await rig(9, CORRIDOR); const { O, D, NB } = R;
    const stacked = stackBoth(R); R.who('all'); R.press(F); const ops = [...D.ops], st0 = NB.state;
    R.step(20); R.press(F); const st1 = NB.state; R.step(100); R.press(F); const st2 = NB.state, live = D.ops.length;   // (0.35 s on: a double tap · 2 s on: red is in its door order)
    R.until(() => !D.ops.length, 40);
    verdict(stacked && ops.length === 2 && st0 === 'staged' && st1 === 'staged' && st2 === 'staged' && live > 0 && ops.every((o: any) => o.ended === 'in') && D.stats.words === 1, 'F, F again a third of a second on, F again two seconds on (red inside its entry): one word, the drill never starts, both entries run to \'in\'', `drill '${st0}' → '${st1}' → '${st2}' · words ${D.stats.words} · ${ops.map((o: any) => `${o.door.def.name} ended '${o.ended}'`).join(' · ')}`);
    R.step(120); R.who('all'); R.press(F); R.step(5);
    verdict(NB.state === 'stacking', '… and with every entry over, F is the drill\'s key again', `drill '${NB.state}'`); }
  // ---- the go row on a menu opened on ONE man names him, not everybody waiting
  { const R = await rig(9, CORRIDOR); const { O, D } = R;
    const stacked = stackBoth(R); R.who('all'); const b1 = R.ops[2]; R.cursor([b1.char.pos[0], 1.2, b1.char.pos[2]]); R.press(K.key); R.step(10);
    const who = O.hud().menu?.rows[0].label, row = R.row('F'); R.press(F); const l = R.last(), away = O.menu === null;
    verdict(stacked && who === 'orders to Blue One' && row?.text === 'go · Blue One' && l?.order === 'go' && l.who.join(' + ') === 'Blue One' && away && D.stats.words === 1, 'both pairs waiting, the orders to gold, X on Blue One: his menu\'s F row reads \'go · Blue One\' — who it would send — and F with that menu up sends him and nobody else (the menu goes away)', `"${who}" · row "${row?.key} ${row?.text}" · ${line(l)} · menu away ${away} · words ${D.stats.words}`); }
  // ---- a charge that is not the addressed men's: the block does not say F blows it while F is their word
  { const R = await rig(5, MANAGER); const { O, D } = R;
    // (red's door here, the storage door, is locked, and on the SHIPPED stand the first word at a door nobody knew was locked ends 'found shut' with red still
    // stacked on it — DOORTOOLS.testDoor, a FROZEN_HOLDS row, held by doortest-check.ts. These lines are about what F is and what the block says once red
    // HAS gone in, so the word boots the door as it did; the next rig and `guarded` put the knob back.)
    DOORTOOLS.testDoor = false;
    R.who('blue'); R.toolsOnDoor('manager'); R.press(CHARGE); const armed = R.until(() => D.set.length === 1, 45);
    R.who('red'); R.onDoor('storage'); R.press(K.quickKey); const on = R.set('red', 40);
    const n1 = R.notes().filter(s => /charge set|waiting/.test(s)).join(' ; ');
    R.press(F); const l1 = R.last(), kept = D.set.length === 1; R.step(30);
    const n2 = R.notes().filter(s => /charge set|waiting/.test(s)).join(' ; ');
    const self = R.onSelf(); R.press(K.key); const grey = R.row('F'), g0 = O.log.length, w0 = D.stats.words; R.press(F); R.step(5); const refused = !O.menu && D.set.length === 1 && O.log.length === g0 && D.stats.words === w0;
    R.press(F); const blown = R.until(() => D.set.length === 0, 2); R.until(() => !D.ops.length, 40);
    verdict(armed && on && /^charge set · manager door(?: · [^;]*)? ; \[F\] go · red waiting$/.test(n1) && l1?.order === 'go' && l1.who.join(' + ') === 'Red One + Red Two' && kept, 'blue\'s charge set, red stacked on another door, the orders to red: the block offers F as red\'s word and does not say it blows the charge — and F sends red alone, the charge stays', `"${n1}" · ${line(l1)} · charge still set ${kept}`);
    verdict(self && !!grey?.off && refused, 'a menu up whose F row is greyed (nobody waiting): F is that row and no more — refused, the menu away; the press does not reach the trigger and the charge stays set', `row: ${grey ? `${grey.key} ${grey.text}${grey.off ? ' (greyed)' : ''}` : 'none'} · menu up ${!!O.menu} · charges set after it ${refused ? 1 : D.set.length} · words ${D.stats.words - w0}`);
    verdict(/^charge set · manager door — press F to blow it(?: · [^;]*)?$/.test(n2) && blown, 'red gone in: the block now says F blows the charge (and does not send the player to T for it) — and F does', `"${n2}" · blown ${blown}`); }
  // ---- a charge on a word still waiting for the other pair is not blown by a second F: the block says what the word waits for
  { const R = await rig(5, MANAGER); const { O, D } = R;
    R.who('red'); R.toolsOnDoor('manager'); R.press(CHARGE); const armed = R.until(() => D.set.length === 1 && D.ops[0]?.phase === 'armed', 50);   // (set, and red stood off from it)
    R.who('blue'); R.toolsOnDoor('breakroom_w'); R.press(K.waitKey, OPEN); R.who('all');
    R.press(F); const l = R.last(), n1 = R.notes().filter(s => /charge set|word given/.test(s)).join(' ; ');
    R.step(10); R.press(F); R.step(5); const still = D.set.length === 1, words = D.stats.words;
    const ops = [...D.ops], ch = ops.find((o: any) => o.kind === 'charge'), op = ops.find((o: any) => o.kind === 'openClear');
    R.until(() => !D.ops.length, 60); const blast = R.beatT(ch, 'blow'), cgo = R.beatT(ch, 'go'), ogo = R.beatT(op, 'go');
    verdict(armed && l?.order === 'go' && l.who.length === 4 && /^charge set · manager door — on the word(?: · [^;]*)? ; word given · waiting for blue$/.test(n1) && still && words === 1, 'red\'s charge set, blue told to open and clear a far door on the word and still walking, F: the word is given and waits for blue — the block says so, and a second F blows nothing', `${line(l)} · "${n1}" · charge still set after the second F ${still} · words ${words}`);
    verdict(ops.length === 2 && ops.every((o: any) => o.ended === 'in') && cgo - blast < DOORTOOLS.entryCap + 0.5, '… then blue is on its door, the charge goes, and red is in behind its own blast (not left outside a blown door)', `charge: ${(ch?.beats ?? []).map((b: any) => `${f2(b.t)} ${b.what}`).join(' | ')} · blue: go ${f2(ogo)}, ended '${op?.ended}'`); }
  // ---- F with a door menu up is the wait row's second key; on a floor menu it is still the word
  { const R = await rig(9, CORRIDOR); const { O, D } = R;
    const stacked = stackBoth(R); R.who('red'); R.menuOnDoor('storage'); R.press(F); const on = !!O.menu?.onWord && O.menu.page === 'tools', w0 = D.stats.words; R.press(F); const off = !!O.menu && !O.menu.onWord && O.menu.page === 'tools'; R.press(K.key);
    R.menuOnFloor(SPOT); R.press(F); const w1 = D.stats.words, l = R.last();
    verdict(stacked && on && w0 === 0 && off && w1 === 1 && l?.order === 'go' && l.who.join(' + ') === 'Red One + Red Two' && R.held === 0, 'red and blue stacked, the orders to red: F with a DOOR menu up turns to the door tools with \'wait for my word\' on, and there flips it off again (no word given); with a floor menu up it is the word — nothing held', `door menu: on ${on}, words ${w0}, off again ${off} · floor menu: words ${w1}, ${line(l)}`); }
  return done();
});

// ============================================================================================================================ squadplay-off
export const squadplayOff = guarded(async () => {
  const { verdict, done } = family('squadplay-off: the pair build has none of it; and with four, wordOnKey off leaves F as it was');
  const K = ORDERS, F = DOORTOOLS.blowKey;
  { const R = await rig(5, CORRIDOR, { squad: 2 }); const { O, D, NB } = R;
    R.menuOnDoor('breakroom_n'); R.step(10); const rows = R.rows(), heads = new Set(rows.map(r => r.head)), n0 = O.log.length;
    R.press('Digit0'); const up = !!O.menu, n1 = O.log.length; R.press('Digit9'); const up9 = !!O.menu, n2 = O.log.length;
    R.press(TOOLS); const tools = R.rows(), pageOk = O.menu?.page === 'tools' && !O.menu.wordRow; R.press('Escape'); const backOk = !!O.menu && O.menu.page === null;
    R.press('Digit1'); const l = R.last(); R.set('all', 35);
    verdict(R.ops.length === 2 && rows.length === 5 && rows.every((r, i) => r.key === String(i + 1)) && rows[4].text === 'door tools ▸' && heads.size === 1 && !/far side/.test([...heads][0]) && pageOk && tools.length === 5 && tools.slice(0, 4).every((r, i) => r.key === String(i + 1)) && !/^\d$/.test(String(tools[4].key ?? '')) /* (the frag row at the foot: on G, no digit) */ && !tools.some(r => r.head === WORD_HEAD || /wait for my word|^go\b/.test(r.text)),
      'two teammates: the door menu is its five rows under the one header and, behind 5, the four door tools on 1 to 4 with the frag row on G under them — no \'go\', no \'wait for my word\', no key past 5', `${fmtRows(rows)} ▸ ${fmtRows(tools)}`);
    verdict(up && n1 === n0 && up9 && n2 === n0 && backOk && l?.order === 'stack', '0 and 9 with the menu up do nothing (it stays, no order); Esc on the tools page steps back to the first; 1 then stacks the pair', `after 0: menu up ${up}, orders ${n1 - n0} · after 9: menu up ${up9}, orders ${n2 - n0} · back on the first page ${backOk} · ${line(l)}`);
    const st0 = NB.state, pre = R.notes().filter(s => /waiting/.test(s)); R.press(F); R.step(30); const note = R.notes().filter(s => /waiting/.test(s)), go = O.log.filter((x: any) => x.order === 'go').length;
    // (the small squad's word, DOORTOOLS.wordSmall, on in the page: there the stacked pair DOES wait on F — `probes.ts wordsmall` owns that rule; this line says which of the two a stand has)
    if (DOORTOOLS.wordSmall) verdict(pre.length === 1 && /^\[F\] go\b/.test(pre[0]) && D.stats.words === 1 && go === 1 && R.last()?.order === 'go' && NB.state === st0 && note.length === 0,
      'DOORTOOLS.wordSmall on: F with the pair stacked IS the word — the block offered it on F, one \'go\' is filed, the breach drill is not touched and nobody is left waiting', `"${pre.join(' ; ')}" · words ${D.stats.words} · go ${go} · ${line(R.last())} · drill '${st0}' → '${NB.state}' · waiting lines ${note.length}`);
    else verdict(D.stats.words === 0 && go === 0 && pre.length === 0 && note.length === 0 && NB.state !== st0, 'F with the pair stacked is not the word: it is the breach drill\'s key as before, and the block offers no \'go\'', `words ${D.stats.words} · drill '${st0}' → '${NB.state}' · waiting lines ${note.length}`); }
  { const R = await rig(9, CORRIDOR, { knobs: () => { DOORTOOLS.wordOnKey = false; } }); const { O, D, NB } = R;
    const stacked = stackBoth(R); R.who('all'); const note = R.notes().filter(s => /waiting/.test(s)).join(' ; '), st0 = NB.state;
    R.press(F); R.step(30); const w0 = D.stats.words, st1 = NB.state;
    // (SILENT.on, as the page has it: the squad's posture row would have the first page's spare digit, but on this build the word keeps 5, as it had it, and
    //  'go silent' rides no digit — the wheel reaches it. The word's row is told from it by its text.)
    const sil = !!SILENT.on;
    R.menuOnFloor(SPOT); const goRow = R.rows().find(r => isGo(r.text)), silRows = R.rows().filter(r => /^go (silent|loud)$/.test(r.text)); R.press('Digit5'); const l = R.last();
    const silOk = sil ? silRows.length === 1 && silRows[0].text === 'go silent' && silRows[0].key === '' && silRows[0].head === SQUAD_HEAD && !squadSilent(R.game) : silRows.length === 0;
    verdict(stacked && w0 === 0 && st1 !== st0 && /^red \+ blue waiting on your word/.test(note) && goRow?.key === '5' && goRow.head === WORD_HEAD && silOk && l?.order === 'go' && l.who.join(' + ') === 'Blue One + Blue Two' && D.stats.words === 1,
      sil ? 'four, DOORTOOLS.wordOnKey false: F is not the word (the drill takes it, as before), the block names who is waiting without a key, and the floor menu\'s go row — on digit 5 then, never above it, \'go silent\' beside it on no digit — still gives it (to blue: red is the drill\'s by then) and silences nobody'
        : 'four, DOORTOOLS.wordOnKey false: F is not the word (the drill takes it, as before), the block names who is waiting without a key, and the floor menu\'s go row — on digit 5 then, never above it — still gives it (to blue: red is the drill\'s by then)', `"${note}" · F: words ${w0}, drill '${st0}' → '${st1}' · go row "${goRow?.key} ${goRow?.text}"${sil ? ` · silent row "${silRows[0]?.key} ${silRows[0]?.text}"` : ''} · then X, 5: ${line(l)} · words ${D.stats.words}`); }
  // one press sends a breach drill that is set AND a pair waiting on the word
  { const R = await rig(9, CORRIDOR); const { O, D, NB } = R;
    R.press(F); const setOk = R.until(() => NB.state === 'set', 40);
    const blue = R.who('blue'); R.onDoor('storage'); R.press(K.quickKey); const on = R.set('blue', 40); R.who('all');
    R.press(F); const l = R.last(), st = NB.state; R.step(5);
    verdict(setOk && blue && on && l?.order === 'go' && l.who.join(' + ') === 'Blue One + Blue Two' && st === 'going' && D.ops.length === 1, 'red set on the F drill, blue stacked on storage, the orders to gold: ONE press of F sends blue on the word and the drill in', `drill set ${setOk} · blue stacked ${on} · ${line(l)} · drill '${st}' · door orders under way ${D.ops.length}`); }
  return done();
});
