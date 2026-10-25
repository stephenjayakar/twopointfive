// The 'orderui' family (game/orders.ts — the squad's command menu as a PRESS menu, and WHO an order goes to with four teammates in two pairs: NIGHTBREACH.squad
// = 4, the page's ?squad4), run through probes.ts:
//   bun run tools/qa/probes.ts orderui | orderui-four | orderui-hud | orderui-door | orderui-keys
// PASS / FAIL each, all headless (the Game of headless.ts under the room clear's staging, Sam in god mode and planted dark, the defenders kept dazzled: this
// family is about who is ordered and how, not the fight). Every order is given THROUGH THE INPUT as a keyboard and mouse would write it — the harness cursor on a
// world point, then one-frame presses of X / the middle button / T / B / a digit / the wheel / a click / Space — and the rig counts the keys and buttons DOWN on
// every frame: where a probe says "nothing held" that count never left zero. Nothing here looks at a picture: the colours, the ring on the target and how the
// menu reads on the page are checked as data, never drawn.
//   orderui-four   the same order (move there, one spot) given four times on four fresh floors — to the squad (X, then its digit), to the red pair (T; the middle
//                  button, the wheel, the middle button again), to the blue pair (T twice; X, then Space) and to one man (T with the cursor on him; the quick key B) — and
//                  each time only the addressed men take it and go; the others have no order and stay (started fallen in, START.fallIn: they keep that one
//                  order and stay with Sam); the HUD named who before the order was given
//   orderui-hud    what the panel says with four: the squad block's label / colour / marks for each choice of T, what B and X would do on what the cursor is on,
//                  the open menu's who row and header, T stepping the element while the menu is up, a menu opened on a teammate, the mark on the target, and
//                  the wheel as the element switch behind its knob
//   orderui-door   a door tool to one pair: 'open and clear' given to red is worked by red alone — blue is in nobody's order and stays; and with blue stacked on
//                  the same door first, red's order leaves blue's alone (what the two pairs then do at one door is printed, not judged: that is the pairs' part)
//   orderui-keys   what the menu takes of the frame's input, and what it never takes: Sam walks on with it up (frozen on its target), a digit with no row does
//                  nothing, B is dead while it is up; THE LEFT BUTTON IS ALWAYS HIS TRIGGER (a click with the menu up: the menu goes, no order, he fires —
//                  and behind ORDERS.clickGives the click gives the row and fires nothing); a right click is used up; the frame the menu opens on takes
//                  nothing else (X with a digit: the list is up, no order); two digits in one frame give one order and neither is a slot; a menu opened
//                  on one man goes away when he goes down, and so does a pair's when the pair is down — never on to everybody else; T on a man twice in
//                  the one-pair squad is back to all; a restart takes it down
import { standUp, ROOT } from './headless.ts';
const { NIGHTBREACH } = await import(`${ROOT}/src/game/nightbreach.ts`);
const { ROOMCLEAR } = await import(`${ROOT}/src/game/roomclear.ts`);
const { DOORTOOLS } = await import(`${ROOT}/src/game/doortools.ts`);
const { ORDERS, sideOf } = await import(`${ROOT}/src/game/orders.ts`);
const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);
const { SILENT } = await import(`${ROOT}/src/game/silent.ts`);
const { START } = await import(`${ROOT}/src/game/startfile.ts`);

const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x));
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const DT_DEFAULTS = JSON.parse(JSON.stringify(DOORTOOLS)), RC_DEFAULTS = { ...ROOMCLEAR }, NB_DEFAULTS = { ...NIGHTBREACH }, ORD_DEFAULTS = { ...ORDERS, followBack: [...ORDERS.followBack] };
const reset = () => { Object.assign(DOORTOOLS, JSON.parse(JSON.stringify(DT_DEFAULTS))); Object.assign(ROOMCLEAR, RC_DEFAULTS); Object.assign(NIGHTBREACH, NB_DEFAULTS); Object.assign(ORDERS, ORD_DEFAULTS, { followBack: [...ORD_DEFAULTS.followBack] }); };
/** every probe leaves the knob tables as it found them, pass, fail or throw */
const guarded = (fn: () => Promise<boolean>) => async () => { try { return await fn(); } finally { reset(); } };
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const names = (l: any[]) => l.map((g: any) => g.callsign).join(' + ');

// open floor on the aisle east of where the squad starts, in plain view of the camera · where Sam stands to work the break room's west door (off its line)
const SPOT: number[] = [15, 0, 17.6], SAM_W: number[] = [25.0, 0, 18.9];

/** One game under a seed: the room clear staged with four teammates (`squad: 2` = the pair), Sam in god mode and dark, the defenders dazzled every frame. */
async function rig(seed: number, o: { squad?: 2 | 4; sam?: number[] } = {}) {
  reset(); Object.assign(NIGHTBREACH, { squad: o.squad ?? 4 });
  Math.random = seeded(seed);
  const W: any = await standUp(); const game = W.game, input = W.input; const RC = game.roomClear, NB = game.nightBreach, O = game.orders, D = game.doorTools;
  (await import(`${ROOT}/src/game/cmdring.ts`)).CMDRING.wholeSquad = false;   // (these lines step who the orders go to with T, the wheel and the cursor, outside plan mode, as the menu was built: the rule that only plan mode picks a part of the squad is held off here and has its own lines, wholesquad-check)
  (await import(`${ROOT}/src/game/cmdring.ts`)).CMDRING.only = false;   // (the menu's own keys and the middle button, as these lines were written: `probes.ts qonly` has the page's, where the ring carries every order)
  game.godMode = true;
  const why = RC.start(seed);
  const R = { W, game, input, RC, NB, O, D, why,
    /** the most keys + mouse buttons DOWN at the start of any frame so far (a one-frame press is not a key down: `pressed` / `clicked`, never `keys` / `buttons`) */
    held: 0, post: null as null | (() => void),
    get ops(): any[] { return NB.ops; },
    step(n = 1) { for (let i = 0; i < n; i++) {
      game.player.visibility = 0.05; for (const h of NB.hostiles) if (h.state !== 'dead') h.dazzledUntil = game.time + 5;
      R.held = Math.max(R.held, input.keys.size + (input.buttons ? 1 : 0));
      W.step(DT); R.post?.(); } },
    until(pred: () => boolean, secs: number) { for (let i = 0; i < secs * 60 && !pred(); i++) R.step(); return pred(); },
    door(name: string): any { return game.doors.list.find((d: any) => d.def.name === name); },
    /** the cursor on a world point */
    cursor(p: number[]) { W.cursorAt([p[0], p[1], p[2]]); },
    on(m: any) { R.cursor([m.char.pos[0], 1.2, m.char.pos[2]]); },
    /** one-frame presses, as the page's listeners write them */
    press(code: string) { input.pressed.add(code); R.step(); },
    mmb() { input.clicked |= 2; R.step(); },
    click() { input.clicked |= 1; R.step(); },
    rclick() { input.clicked |= 4; R.step(); },
    wheel(d: number) { input.wheel += d; R.step(); },
    last(): any { return O.log[O.log.length - 1] ?? null; },
    status(): any { return O.hud().status[0] ?? null; },
  };
  R.step(30);
  if (o.sam) { game.teleportPlayer(o.sam); R.step(5); }
  return R;
}
const line = (l: any) => l ? `${l.order} → ${l.who.join(' + ')} on ${l.target}` : 'nothing';
/** the squad block's header for who the next order goes to. SILENT.on, as the page has it (src/game/silent.ts): the squad's posture is a word of the header,
 *  between the two — 'loud' in this family, where nobody says 'go silent' — and a row of a floor's menu and of one man's. With the switch off, as on the
 *  harness's older stand, the header has no such word and the menus no such row. */
//  (asked for once a floor is staged, never before: the stand's switches are set as the game stands up)
const head = (tag: string) => `squad · ${SILENT.on ? 'loud · ' : ''}orders to ${tag}`;
/** THE MEN AN ORDER IS NOT FOR. START.fallIn, as the page has it (src/game/startfile.ts): the four start on Sam's 'fall in', unspoken, so such a man has an
 *  order before anything is pressed — the one he started on. What the page promises of him is that he KEEPS it (the very same assignment after the press as
 *  before it, never the new order) and stays with Sam: on his own mark in the file, wherever Sam is. With the switch off, as on the harness's older stand, he
 *  has no order before or after, and stands where he stood. `kept`: his order now is the one he held then, and that one is what this stand starts him on. */
const kept = (O: any, m: any, was: any) => O.of(m) === was && (START.fallIn ? was?.order === 'fallIn' : was === null);
/** fallen in and there: on 'fall in', arrived, on the mark it gives him behind Sam */
const inFile = (O: any, m: any) => { const a = O.of(m); return a?.order === 'fallIn' && a.arrived && dist(m.char.pos, a.goal) < 0.3; };

// ---------------------------------------------------------------- the same order to the squad, to red, to blue, to one man
export const orderuiFour = guarded(async () => {
  const { verdict, done } = family('orderui-four: one order to the squad, to red, to blue and to one man — a press each, nothing held, and only the addressed men go');
  const K = ORDERS;
  const CASES: { name: string; tag: string; tone: string; want: number[]; address(R: any): void; give(R: any): void; how: string }[] = [
    { name: 'the squad', tag: 'GOLD', tone: 'gold', want: [0, 1, 2, 3], how: 'X pressed on the spot, then 1',
      address: () => {}, give: R => { R.cursor(SPOT); R.press(K.key); R.step(20); R.press('Digit1'); } },
    { name: 'the red pair', tag: 'RED', tone: 'red', want: [0, 1], how: 'T · the middle button on the spot, the wheel down a row and back, the middle button again',
      address: R => { R.cursor(SPOT); R.press(K.whoKey); }, give: R => { R.cursor(SPOT); R.mmb(); R.step(20); R.wheel(60); R.wheel(-60); R.mmb(); } },
    { name: 'the blue pair', tag: 'BLUE', tone: 'blue', want: [2, 3], how: 'T twice · X pressed on the spot, then Space',
      address: R => { R.cursor(SPOT); R.press(K.whoKey); R.press(K.whoKey); }, give: R => { R.cursor(SPOT); R.press(K.key); R.step(20); R.press('Space'); } },
    { name: 'one man (Blue Two)', tag: 'Blue Two', tone: 'blue', want: [3], how: 'T with the cursor on him · the quick key B on the spot',
      address: R => { R.on(R.ops[3]); R.press(K.whoKey); }, give: R => { R.cursor(SPOT); R.press(K.quickKey); } },
  ];
  for (const c of CASES) {
    const R = await rig(21); const { O } = R; const ops = R.ops; const p0 = ops.map((m: any) => [...m.char.pos]);
    if (ops.length !== 4) { verdict(false, `${c.name}: four teammates staged`, `${ops.length} staged (${R.why ?? 'started'})`); continue; }
    c.address(R); R.step(5);
    const st = R.status(), marks = (st?.opts ?? []).slice(0, 4).map((o: any) => o.text.slice(0, 1) === '▸' ? 1 : 0), wantMarks = ops.map((_: any, i: number) => c.want.length < 4 && c.want.includes(i) ? 1 : 0);
    verdict(st?.label === head(c.tag) && st.tone === c.tone && marks.join() === wantMarks.join(), `${c.name}: before the order the HUD says who it will go to`, `"${st?.label}" in ${st?.tone} · ${(st?.opts ?? []).slice(0, 4).map((o: any) => o.text).join(' | ')}`);
    const wantMen = c.want.map(i => ops[i]), rest = ops.filter((_: any, i: number) => !c.want.includes(i));
    const fallen = !!START.fallIn, was = rest.map((m: any) => O.of(m)), keeps = () => rest.every((m: any, i: number) => kept(O, m, was[i]));
    c.give(R); const l = R.last(); const menuGone = O.menu === null;
    const took = wantMen.every((m: any) => O.of(m)?.order === 'move'), restFree = keeps();
    R.until(() => wantMen.every((m: any) => O.of(m)?.arrived), 16); R.step(30);
    const got = wantMen.map((m: any) => dist(m.char.pos, SPOT)), stayed = rest.map((m: any) => dist(m.char.pos, p0[ops.indexOf(m)]));
    verdict(l?.order === 'move' && l.who.join(' + ') === names(wantMen) && O.log.length === 1 && menuGone && took && restFree && keeps(),   // (… as the order is given, and still once it is carried out)
      `${c.name}: "move there" goes to ${names(wantMen)} and to nobody else (${c.how})`, `${line(l)} · orders logged ${O.log.length} · the others: ${rest.length ? rest.map((m: any, i: number) => `${m.callsign} ${O.has(m) ? (fallen && kept(O, m, was[i]) ? 'keeps the fall in he started on' : 'HAS an order') : 'no order'}`).join(', ') : '—'}`);
    // (the rest, fallen in: they close up on Sam as the file re-forms without the men who left it — a step or so, he is standing still — so the promise there is
    //  each man on his own mark in the file and none of them inside the spot's spread; with no order they have nowhere to go: under 0.9 m from where they stood)
    const away = rest.map((m: any) => dist(m.char.pos, SPOT)), withSam = rest.every((m: any, i: number) => inFile(O, m) && away[i] > 3.55);
    verdict(got.every(d => d < 3.55) && (fallen ? withSam : stayed.every(d => d < 0.9)),   // (roomfit.ts: marks round the spot, within its spread for four)
      fallen ? `${c.name}: they go to the spot; the rest stay with Sam, each on his mark in the file and none of them at the spot` : `${c.name}: they go to the spot; the rest stay where they stood`,
      `off the spot: ${wantMen.map((m: any, i: number) => `${m.callsign} ${f2(got[i])} m`).join(', ')} · moved: ${rest.length ? rest.map((m: any, i: number) => `${m.callsign} ${f2(stayed[i])} m`).join(', ') : '—'}`
        + (fallen && rest.length ? ` · in the file: ${rest.map((m: any, i: number) => `${m.callsign} ${inFile(O, m) ? 'on his mark' : 'OFF his mark'}, ${f2(away[i])} m from the spot`).join(', ')}` : ''));
    verdict(R.held === 0, `${c.name}: no key or button was down on any frame`, `most keys + buttons down at once, over ${Math.round(R.game.time * 60)} frames: ${R.held}`);
  }
  return done();
});

// ---------------------------------------------------------------- what the panel says
export const orderuiHud = guarded(async () => {
  const { verdict, done } = family('orderui-hud: the panel always says who the next order goes to, and what it would be about');
  const R = await rig(22); const { O, game: g } = R; const ops = R.ops; const K = ORDERS; const d = R.door('breakroom_w');
  const txt = (st: any) => st ? `"${st.label}" (${st.tone}) · ${st.opts.map((o: any) => `${o.key ? `[${o.key}] ` : ''}${o.text}${o.tone ? ` (${o.tone})` : ''}`).join(' | ')}` : 'no block';
  const opt = (st: any, key: string) => st?.opts.find((o: any) => o.key === key)?.text ?? null;
  // closed, everyone
  R.cursor(SPOT); R.step(2); const s0 = R.status();
  verdict(s0?.label === head('GOLD') && s0.tone === 'gold' && s0.opts.slice(0, 4).map((o: any) => o.tone).join() === 'red,red,blue,blue' && s0.opts.slice(0, 4).every((o: any, i: number) => o.text.startsWith(`${ops[i].callsign} · `)) && opt(s0, 'T') === 'who · [GOLD] · red · blue' && opt(s0, 'B') === 'move there · that spot' && opt(s0, 'X') === 'orders · that spot',
    'no menu, everyone addressed, the cursor on open floor: GOLD, each man in his pair\'s colour with what he is doing, what B and X would do there, T\'s choices', txt(s0));
  // T: red, blue
  R.press(K.whoKey); const s1 = R.status(); R.press(K.whoKey); const s2 = R.status(); R.press(K.whoKey); const s3 = R.status();
  const mk = (st: any) => st.opts.slice(0, 4).map((o: any) => o.text.slice(0, 1)).join('');
  verdict(s1?.label === head('RED') && s1.tone === 'red' && mk(s1) === '▸▸··' && opt(s1, 'T') === 'who · gold · [RED] · blue' && s2?.label === head('BLUE') && s2.tone === 'blue' && mk(s2) === '··▸▸' && opt(s2, 'T') === 'who · gold · red · [BLUE]' && s3?.label === head('GOLD'),
    'T steps GOLD → RED → BLUE → GOLD: the label, its colour and a mark on each addressed man follow', `${txt(s1)}\n    ${txt(s2)}\n    then "${s3?.label}"`);
  // the cursor on a door / on a man
  R.cursor(d.frameCentre); R.step(2); const sD = R.status(); R.on(ops[2]); R.step(2); const sM = R.status();
  verdict(/^stack up · .*door$/.test(opt(sD, 'B') ?? '') && /^orders · .*door$/.test(opt(sD, 'X') ?? '') && opt(sM, 'B') === 'fall in · Blue One alone' && opt(sM, 'X') === 'orders · Blue One alone' && opt(sM, 'T') === 'who · Blue One (under the cursor)',
    'the cursor on a door: B would stack on it, X opens the menu on it; on a teammate: both are his alone, and T would address him', `door: [B] ${opt(sD, 'B')} · [X] ${opt(sD, 'X')}\n    man: [B] ${opt(sM, 'B')} · [X] ${opt(sM, 'X')} · [T] ${opt(sM, 'T')}`);
  // the menu up on the door, to red
  R.cursor(SPOT); R.press(K.whoKey); R.cursor(d.frameCentre); R.press(K.key); R.step(10);
  const m1 = O.hud().menu, mark1 = O.mark(), men1 = names(O.menu?.men ?? []);
  verdict(!!m1 && m1.rows[0].label === 'orders to RED · 2 men' && m1.rows[0].tone === 'red' && m1.rows[0].opts[0].key === 'T' && m1.rows[0].opts[0].text === 'gold · [RED] · blue' && /^on .*door$/.test(m1.rows[1].label) && m1.rows[1].opts[0].key === '1' && m1.primary === 1 && m1.rows[m1.rows.length - 1].kind === 'cancel' && m1.cancel === 'close — no order' && /middle click/.test(m1.hint) && men1 === 'Red One + Red Two' && O.hud().status.length === 0,
    'the menu up on a door with red addressed: a who row in red (with T\'s choices), the orders under what they are about, its own hint and cancel words — in place of the squad block', m1 ? `"${m1.rows[0].label}" (${m1.rows[0].tone}) [T] ${m1.rows[0].opts[0].text} · "${m1.rows[1].label}": ${m1.rows.slice(1, -1).map((r: any) => `${r.opts[0].key} ${r.opts[0].text}`).join(' · ')} · hint "${m1.hint}" · cancel "${m1.cancel}" · to ${men1}` : 'no menu');
  verdict(!!mark1 && mark1.tone === 'red' && /^RED → .*door$/.test(mark1.text) && dist(mark1.at, d.frameCentre) < 0.05, 'the mark for the page\'s ring sits on that door, in red, with who and what', mark1 ? `"${mark1.text}" (${mark1.tone}) at (${f2(mark1.at[0])}, ${f2(mark1.at[2])}) · door at (${f2(d.frameCentre[0])}, ${f2(d.frameCentre[2])})` : 'no mark');
  // T while it is up: the element steps, the menu stays on its target
  R.cursor(SPOT); R.press(K.whoKey); const m2 = O.hud().menu, men2 = names(O.menu?.men ?? []), t2 = O.menu?.target;
  R.on(ops[0]); R.press(K.whoKey); const m3 = O.hud().menu, men3 = names(O.menu?.men ?? []), t3 = O.menu?.target;
  verdict(m2?.rows[0].label === 'orders to BLUE · 2 men' && m2.rows[0].tone === 'blue' && men2 === 'Blue One + Blue Two' && t2?.kind === 'door' && t2.door === d && m3?.rows[0].label === 'orders to Red One' && m3.rows[0].tone === 'red' && m3.rows[0].opts[0].text === '[Red One] · gold' && men3 === 'Red One' && t3?.kind === 'door' && t3.door === d,
    'T with the menu up steps who it goes to (blue; then, with the cursor on Red One, him alone) and the menu stays up on its door', `"${m2?.rows[0].label}" to ${men2} · then "${m3?.rows[0].label}" [T] ${m3?.rows[0].opts[0].text} to ${men3} · target ${t3?.kind} ${t3?.door?.def.name}`);
  R.press('Escape'); const whoKept = O.who;
  // a menu opened ON a teammate, everyone standing as the choice
  R.cursor(SPOT); R.press(K.whoKey); const backAll = O.who;   // (T off a man, with one man standing: back to everyone)
  R.on(ops[2]); R.press(K.key); R.step(5); const m4 = O.hud().menu, men4 = names(O.menu?.men ?? []), ids4 = (O.menu?.rows ?? []).map((r: any) => r.id).join(' '); R.press('Escape');
  // (one man's menu: fall in, hold, the word — and, SILENT.on, 'go silent' between them, the whole squad's row on whoever's menu it is given from)
  const want4 = SILENT.on ? 'fallIn hold silent go' : 'fallIn hold go';
  verdict(whoKept === 0 && backAll === 'all' && m4?.rows[0].label === 'orders to Blue One' && m4.rows[0].tone === 'blue' && men4 === 'Blue One' && ids4 === want4 && m4.rows[1].label === 'on Blue One alone' && O.who === 'all' && O.log.length === 0,
    'a man addressed with T stays the choice after the menu closes, and T again is everyone; X pressed ON a teammate is a menu for him alone, and leaves the standing choice as it was', `after Esc: who ${whoKept} · T: ${backAll} · on Blue One: "${m4?.rows[0].label}" (${m4?.rows[0].tone}) "${m4?.rows[1].label}" rows ${ids4} to ${men4} · standing choice ${O.who} · orders logged ${O.log.length}`);
  // the wheel as RoN's element switch, behind its knob
  ORDERS.wheelElement = true;
  R.cursor(SPOT); R.press(K.key); R.step(5); const hint = O.hud().menu?.hint; R.wheel(60); const w1 = O.who, sel1 = O.menu?.sel; R.wheel(60); const w2 = O.who; R.wheel(-60); const w3 = O.who; R.press('Digit4'); const lw = R.last();
  ORDERS.wheelElement = false;
  verdict(w1 === 'red' && sel1 === 0 && w2 === 'blue' && w3 === 'red' && /wheel: who/.test(hint ?? '') && lw?.order === 'hold' && lw.who.join(' + ') === 'Red One + Red Two', 'ORDERS.wheelElement on: with the menu up the wheel steps who (down: red, blue; up: back to red) and leaves the highlight; the digit then gives the order to them', `wheel: ${w1} → ${w2} → ${w3} · highlight ${sel1} · hint "${hint}" · ${line(lw)}`);
  verdict(R.held === 0 && !g.player.down, 'no key or button was down on any frame of this', `most down at once: ${R.held}`);
  return done();
});

// ---------------------------------------------------------------- a door tool to one pair
export const orderuiDoor = guarded(async () => {
  const { verdict, done } = family('orderui-door: a door tool given to one pair is that pair\'s — the pair you address is the pair that works the door');
  const K = ORDERS;
  { // red alone opens and clears; blue has nothing to do with it
    const R = await rig(23, { sam: SAM_W }); const { O, D, game: g } = R; const ops = R.ops, d = R.door('breakroom_w'), sam = g.player.char; const p0 = ops.map((m: any) => [...m.char.pos]);
    // (START.fallIn: blue starts on Sam's 'fall in' and has come up the aisle to him by the door — so "never had an order" is, there, "never any order but the
    //  one it started on", and "where it stood" is in the file behind Sam: counted every frame, with the frames a blue man was on the room's side of the door)
    const fallen = !!START.fallIn, wasB = [2, 3].map(i => O.of(ops[i])); let blueOther = 0, blueAcross = 0;
    let blueInOp = 0, blueOrdered = 0, opMen = ''; R.post = () => { for (const op of D.ops) { if (!opMen) opMen = names(op.men); if (op.men.includes(ops[2]) || op.men.includes(ops[3])) blueInOp++; } if (O.has(ops[2]) || O.has(ops[3])) blueOrdered++;
      [2, 3].forEach((i, k) => { if (!kept(O, ops[i], wasB[k])) blueOther++; if (sideOf(d, ops[i].char.pos) !== sideOf(d, sam.pos)) blueAcross++; }); };
    R.cursor(SPOT); R.press(K.whoKey); const who = O.who;
    R.cursor(d.frameCentre); R.press(K.key); R.step(15); const tools = O.hud().menu?.rows.find((r: any) => r.opts[0]?.key === '5'); R.press('Digit5'); const page = O.menu?.page, row = O.hud().menu?.rows.find((r: any) => r.opts[0]?.key === '1'); R.press('Digit1'); const l = R.last();
    R.step(2); const started = D.ops.length;
    const ended = R.until(() => D.ops.length === 0, 40); R.step(60);
    const op = D.done[D.done.length - 1]; const side0 = sideOf(d, sam.pos); const inRoom = ops.map((m: any) => m.state !== 'dead' && sideOf(d, m.char.pos) !== side0);
    const blueMoved = [2, 3].map(i => dist(ops[i].char.pos, p0[i]));
    verdict(who === 'red' && /^door tools ▸/.test(tools?.opts[0].text ?? '') && page === 'tools' && /^open and clear/.test(row?.opts[0].text ?? '') && l?.order === 'openClear' && l.who.join(' + ') === 'Red One + Red Two' && started === 1 && opMen === 'Red One + Red Two',
      'T, X on the door, 5 (the door tools\' page), 1: "open and clear" is taken by the red pair, and the door order that starts has red in it and nobody else', `who ${who} · row 5 "${tools?.opts[0].text}" → page ${page} · row 1 "${row?.opts[0].text}" · ${line(l)} · the door order's men: ${opMen || '—'}`);
    const blueOwn = blueOther === 0 && (fallen ? blueAcross === 0 && [2, 3].every(i => inFile(O, ops[i])) : blueOrdered === 0 && blueMoved.every(x => x < 0.9));
    verdict(ended && inRoom[0] && inRoom[1] && !inRoom[2] && !inRoom[3] && blueInOp === 0 && blueOwn,
      fallen ? 'red works the door and goes in; blue was never in the door order, never had an order but the fall in it started on, and stays with Sam, in the file behind him — outside, on no frame on the room\'s side of the door'
        : 'red works the door and goes in; blue was never in the door order, never had an order, and stays where it stood, outside', `ended ${ended} (${op?.phase ?? '—'}) · through the door: ${ops.map((m: any, i: number) => `${m.callsign} ${inRoom[i] ? 'in' : 'out'}`).join(', ')} · frames blue was in the door order ${blueInOp}, had an order ${blueOrdered} · blue moved ${blueMoved.map(f2).join(' / ')} m`
        + (fallen ? ` · frames blue had any other order than the fall in it started on ${blueOther}, was on the room's side of the door ${blueAcross} · at the end: ${[2, 3].map(i => `${ops[i].callsign} ${f2(dist(ops[i].char.pos, sam.pos))} m from Sam, ${f2(dist(ops[i].char.pos, d.frameCentre))} m from the door on Sam's side, ${inFile(O, ops[i]) ? 'on his mark' : 'OFF his mark'}, "${O.statusOf(ops[i])}"`).join(' · ')}` : ''));
    verdict(R.held === 0, 'no key or button was down on any frame', `most down at once: ${R.held}`);
  }
  { // blue stacked on the door first, then red sent through it: red's order is red's, blue's stays blue's
    const R = await rig(24, { sam: SAM_W }); const { O, D, game: g } = R; const ops = R.ops, d = R.door('breakroom_w'), sam = g.player.char;
    R.cursor(SPOT); R.press(K.whoKey); R.press(K.whoKey); const who1 = O.who;
    R.cursor(d.frameCentre); R.press(K.quickKey); const l1 = R.last();
    const set = R.until(() => [2, 3].every(i => O.of(ops[i])?.arrived), 25); R.step(30);
    R.cursor(SPOT); R.press(K.whoKey); R.press(K.whoKey); const who2 = O.who;
    R.cursor(d.frameCentre); R.press(K.key); R.step(15); R.press('Digit5'); const why = O.menu ? O.menu.why[O.menu.rows.findIndex((r: any) => r.id === 'openClear')] : 'no menu'; R.press('Digit1'); const l2 = R.last(); R.step(2);
    const opMen = D.ops[0] ? names(D.ops[0].men) : '', blueKept = [2, 3].every(i => O.of(ops[i])?.order === 'stack');
    const given = l2?.order === 'openClear';
    verdict(who1 === 'blue' && l1?.order === 'stack' && l1.who.join(' + ') === 'Blue One + Blue Two' && set && who2 === 'red' && (given ? l2.who.join(' + ') === 'Red One + Red Two' && opMen === 'Red One + Red Two' && blueKept : !!why && O.log.length === 1 && blueKept),
      'blue stacked on the door (T twice, B), then "open and clear" (X, 5, 1) to red on the same door: it is red\'s alone — or refused with a reason — and blue keeps its own order either way', `${line(l1)} · set ${set} · then to ${who2}: ${given ? `${line(l2)} · the door order's men: ${opMen}` : `refused: "${why}"`} · blue still stacked: ${blueKept}`);
    // what the two pairs then do at the one door — printed, not judged here (the pairs' behaviour is its own part)
    const ended = R.until(() => D.ops.length === 0, 40); R.step(60); const side0 = sideOf(d, sam.pos);
    console.log(`    (not judged) after it: ended ${ended} (${D.done[D.done.length - 1]?.phase ?? '—'}) · ${ops.map((m: any) => `${m.callsign} ${m.state === 'dead' ? 'down' : sideOf(d, m.char.pos) !== side0 ? 'in the room' : 'outside'}, "${O.statusOf(m)}"`).join(' · ')}`);
  }
  return done();
});

// ---------------------------------------------------------------- the frame's input while the menu is up
export const orderuiKeys = guarded(async () => {
  const { verdict, done } = family('orderui-keys: what the menu takes of the frame\'s input, and what it never takes');
  const R = await rig(25); const { O, game: g, input, W } = R; const K = ORDERS; const sam = g.player.char;
  // Sam walks on with the menu up (movement keys are his, not the menu's): it stays, frozen on its target
  R.cursor(SPOT); R.press(K.key); R.step(5); const t0 = O.menu?.target, at0 = [...sam.pos];
  let walked = 0; for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) { const from = [...sam.pos]; input.keys.add(code); R.step(40); input.keys.delete(code); R.step(10); walked = Math.max(walked, dist(sam.pos, from)); }
  const stillUp = !!O.menu && O.menu.target === t0 && O.menu.target.kind === 'floor' && dist(O.menu.target.at, SPOT) < 0.3;
  verdict(walked > 0.5 && stillUp && O.log.length === 0, 'Sam walks with the menu up (W A S D held in turn): it stays up, on the spot it was opened on, and no order is given', `Sam moved up to ${f2(walked)} m a key, ${f2(dist(sam.pos, at0))} m in all · menu up ${!!O.menu} on ${O.menu?.target.kind} · orders logged ${O.log.length}`);
  // a digit with no row: nothing, and not his weapon slot; B: nothing while it is up
  const slot0 = g.player.slot; R.press('Digit7'); const up7 = !!O.menu; R.press(K.quickKey); const upB = !!O.menu;
  verdict(up7 && upB && O.log.length === 0 && g.player.slot === slot0, 'with the menu up a digit that has no row does nothing (and is not Sam\'s slot), and the quick key is dead', `after 7: up ${up7} · after B: up ${upB} · orders logged ${O.log.length} · slot ${slot0} → ${g.player.slot}`);
  // the left button is Sam's trigger with the menu up: the menu goes away, no order, he fires
  const gun = g.player.gunInHand(), n0 = gun?.shotsFired ?? NaN;
  input.clicked |= 1; input.buttons |= 1; R.step(); input.buttons &= ~1; R.step(20); const n1 = gun?.shotsFired ?? NaN, gone1 = O.menu === null, log1 = O.log.length;
  verdict(!!gun && gone1 && log1 === 0 && n1 === n0 + 1, 'a left click with the menu up is Sam\'s shot: the menu goes away, no order is given, a round is fired', gun ? `menu gone ${gone1} · orders logged ${log1} · rounds fired ${n0} → ${n1}` : 'Sam has no gun in hand: the check did not run');
  // … and behind the knob it is the pick instead
  ORDERS.clickGives = true;
  R.cursor(SPOT); R.press(K.key); R.step(5); input.clicked |= 1; input.buttons |= 1; R.step(); input.buttons &= ~1; R.step(20); const n2 = gun?.shotsFired ?? NaN, lPick = R.last();
  ORDERS.clickGives = false;
  verdict(lPick?.order === 'move' && lPick.who.length === 4 && O.menu === null && n2 === n1, 'ORDERS.clickGives on: the click gives the highlighted row and fires nothing', `${line(lPick)} · rounds fired ${n1} → ${n2}`);
  // a right click is used up by the menu
  R.cursor(SPOT); R.press(K.key); R.step(5); input.clicked |= 4; O.input(DT, input, W.cam, W.canvas); const rGone = O.menu === null, rBit = (input.clicked & 4) !== 0; R.step();
  verdict(rGone && !rBit, 'a right click with the menu up closes it and is taken out of the frame (not the OCP, not the ring)', `menu gone ${rGone} · the click still in the frame's input: ${rBit}`);
  // the frame it opens on is not the menu's; two digits in one frame are one order and no slot
  const nA = O.log.length; R.cursor(SPOT); input.pressed.add(K.key); input.pressed.add('Space'); R.step(); const upA = !!O.menu, logA = O.log.length - nA; R.step(10);
  const slotB = g.player.slot; input.pressed.add('Digit4'); input.pressed.add('Digit3'); R.step(); const lB = R.last(), logB = O.log.length - nA;
  verdict(upA && logA === 0 && O.menu === null && logB === 1 && lB?.order === 'fallIn' && g.player.slot === slotB, 'X and Space in one frame: the list comes up and nothing is given; then 3 and 4 in one frame: one order (the lower digit), and neither is Sam\'s slot', `on the press: up ${upA}, orders ${logA} · two digits: ${line(lB)} (${logB} order) · slot ${slotB} → ${g.player.slot}`);
  // the men a menu was for go down: the menu goes, the order never lands on everybody else
  // (blue is nobody's here: with START.fallIn it holds the fall in it started on throughout — the same assignment at the end, never the digit's order)
  { const R2 = await rig(26); const O2 = R2.O, ops = R2.ops; const was2 = [2, 3].map(i => O2.of(ops[i]));
    R2.on(ops[0]); R2.press(K.key); R2.step(5); const up = O2.menu?.men.length === 1;
    killGuard(R2.game, ops[0], [1, 0, 0], false, 'shot', 'player'); R2.step(2); R2.press('Digit4'); const a = { up: !!O2.menu, log: O2.log.length }; R2.step(70); const gone = O2.menu === null;
    R2.cursor(SPOT); R2.press(K.whoKey); const who = O2.who; R2.press(K.key); R2.step(5); const up2 = !!O2.menu;
    killGuard(R2.game, ops[1], [1, 0, 0], false, 'shot', 'player'); R2.step(2); const gone2 = O2.menu === null, who2 = O2.who; R2.press('Digit1'); R2.step(5);
    verdict(up && a.log === 0 && gone && who === 'red' && up2 && gone2 && who2 === 'all' && O2.log.length === 0 && [2, 3].every((i, k) => kept(O2, ops[i], was2[k])),
      'a menu opened on Red One, he goes down, 4 is pressed: nobody is ordered and the menu is gone; red addressed with one man left, he goes down: the menu goes at once and the digit orders nobody', `on him: up ${up} · after his death + 4: orders ${a.log}, menu ${gone ? 'gone' : 'up'} · red's menu up ${up2} → after the last red man: ${gone2 ? 'gone' : 'up'}, who ${who2} · orders logged ${O2.log.length} · blue ordered: ${START.fallIn ? `${[2, 3].some((i, k) => !kept(O2, ops[i], was2[k]))} (each still on the fall in he started on: ${[2, 3].map(i => `"${O2.statusOf(ops[i])}"`).join(', ')})` : [2, 3].some(i => O2.has(ops[i]))}`);
  }
  // the one pair: T on a man, T on him again = all (never round to the other man and back)
  { const R3 = await rig(27, { squad: 2 }); const O3 = R3.O, ops = R3.ops; const seq: any[] = [];
    R3.on(ops[0]); for (let i = 0; i < 4; i++) { R3.press(K.whoKey); seq.push(O3.who); } const tLine = R3.status()?.opts.find((o: any) => o.key === 'T')?.text;
    R3.press(K.whoKey); const tLine2 = R3.status()?.opts.find((o: any) => o.key === 'T')?.text;
    verdict(ops.length === 2 && seq.join() === '0,all,0,all' && tLine === 'who · Blue One (under the cursor)' && tLine2 === 'who · back to all', 'the pair, the cursor resting on Blue One: T is him, T again is all — and the HUD\'s T line says which it will be', `who after each T: ${seq.join(' ')} · T line "${tLine}" → "${tLine2}"`);
  }
  // a restart with it up
  NIGHTBREACH.squad = 4;   // (the pair's rig above set the knob: the restart below stages what it says)
  const nLog = O.log.length; R.cursor(SPOT); R.press(K.whoKey); R.press(K.key); R.step(5); const upR = !!O.menu, whoR = O.who; g.restartEncounter(); R.step(3);
  verdict(upR && whoR === 'red' && O.menu === null && O.who === 'all' && R.ops.length === 4 && O.log.length <= nLog, 'a restart with the menu up and red addressed: the menu is gone and the choice is back to everyone', `before: up ${upR}, who ${whoR} · after: menu ${O.menu ? 'up' : 'gone'}, who ${O.who}, ${R.ops.length} teammates`);
  return done();
});
