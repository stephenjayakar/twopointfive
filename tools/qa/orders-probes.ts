// The 'squadorders' family (game/orders.ts — Sam's live orders to the AI squad: X / the middle button = the menu, up until an order is picked; B = the target's own order at once; T = who takes them), run through probes.ts:
//   bun run tools/qa/probes.ts squadorders | orders-off | orders-menu | orders-move | orders-cover | orders-stack | orders-fallin | orders-one | orders-nightbreach | orders-seams   [--verbose]
// PASS / FAIL each, all headless (the Game of headless.ts). The squad is the night breach's pair (game.nightBreach.start(), as ?nightbreach stages it) unless a
// probe says otherwise; every order is given THROUGH THE INPUT — the harness cursor put on a world point (W.cursorAt → the game's own aim ray), X / B / T / digits /
// the wheel / clicks / Esc written into the harness Input as a keyboard and mouse would, every one a one-frame PRESS (no order waits on a key held or let go) — never by calling give() (orders-seams apart, which says so). The defenders in the break
// room are kept dazzled (and blind fire off) wherever a probe is about WHERE the men go: this family is not about the fight. Sam's visibility is planted dark,
// as in the nightbreach family (no light meter headless).
// NOT held here: how the menu reads and feels on the page (the panel's rows are checked as data, never drawn), the men's carriage as a picture, sound. Sam's
// walk in orders-fallin is the harness placing him a step a frame along a nav path (teleportPlayer), not WASD; where doors are
// one-way (DOORWAY.oneWay) he walks it on his own feet instead, since no player can be set down through a shut door.
//   orders-off         no squad on the floor: X, B, T and the middle button are dead (ten seeded seconds digest the same with and without them), no menu, no HUD block, give() refuses
//   orders-menu        the menu offers only what fits the reticle's target: floor = move / cover / fall in / hold · door = stack / cover / fall in / hold · Sam
//                      himself (nothing) = fall in / hold · a teammate = his alone; a press of X puts the list up, frozen on the target, and it stays up with every key
//                      up; Space or the middle button again gives the highlighted row; the cancel row, Esc, X again, a right click and a left click (Sam's
//                      trigger, always) give nothing; a digit picks at once and never reaches Sam's weapon slots, the wheel moves the highlight and never
//                      his pace; the quick key is the target's first row; an order registered for doors shows on doors only; the HUD names who and what
//   orders-move        move there: both men on two spots abreast at the point, facing the way they were sent, 'set.' called once; hold position mid-run stops
//                      them where they are and they stay
//   orders-cover       cover that way / this door: each man turns his gun onto it where he stands, and stays on it
//   orders-stack       stack up, four cases (the break room's west door from either side, its north door from the corridor and from inside): a man on each jamb
//                      — both in file on the free one where the other has no floor — off the opening, on the side Sam is on, facing the door along the wall,
//                      muzzles on it, and they stay; 'set.' called once
//   orders-fallin      fall in: the pair closes up; Sam walks from the cubicles' aisle through the west door, across the break room and out of its (shut) north
//                      door into the corridor — both men stay within a few metres the whole way, open the door themselves and end beside him on the far side;
//                      turning on the spot does not move them
//   orders-one         T picks one man: his order leaves the other where he was, without an order; the cursor on a teammate does the same without T; a man down
//                      drops out of the cycle
//   orders-nightbreach the two systems together: an order while the pair is set on the breach calls the breach off (no kick), F stacks them again; once the
//                      breach is going an order is refused and the breach runs to 'clear'; then fall in brings both out to Sam; a recall once they are inside ends
//                      the drill ('recalled' — and a recall of one man hands the other to the fight AI); an order that cannot be carried out never calls
//                      the breach off; with the point man dead on the stack (the drill's 'failed') the survivor still takes orders
//   orders-seams       what the later parts build on: a man the fight AI has (script ended, alert, eyes on) is left to it on his post and taken back once cold; an
//                      owner that refuses keeps its men; a show taking the floor drops every order
import { standUp, ROOT } from './headless.ts';
const { NIGHTBREACH } = await import(`${ROOT}/src/game/nightbreach.ts`);
const { ORDERS, doorIdWords } = await import(`${ROOT}/src/game/orders.ts`);   // (doorIdWords: a door's name as the squad says it — it follows the dialogue pass, so the expected words do too)
const { COVER } = await import(`${ROOT}/src/game/cover.ts`);
const { WORDS } = await import(`${ROOT}/src/game/words.ts`);
const { DOORSTAY, DOORWAY } = await import(`${ROOT}/src/game/doors.ts`);
const { FRIENDS } = await import(`${ROOT}/src/game/friends.ts`);
const { digestGame } = await import(`${ROOT}/src/game/digest.ts`);
const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);
const { endGuardScript } = await import(`${ROOT}/src/game/squad.ts`);
const { DOORTOOLS } = await import(`${ROOT}/src/game/doortools.ts`);
const { SILENT } = await import(`${ROOT}/src/game/silent.ts`);
const { SQUADTHROW } = await import(`${ROOT}/src/game/squadthrow.ts`);
const { START } = await import(`${ROOT}/src/game/startfile.ts`);
const { HOLDFIRE } = await import(`${ROOT}/src/game/holdfire.ts`);

const DT = 1 / 60;
const VERBOSE = process.argv.includes('--verbose');
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x));
const at = (p: number[]) => `(${f2(p[0])}, ${f2(p[2])})`;
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const NB_DEFAULTS = { ...NIGHTBREACH }, ORD_DEFAULTS = { ...ORDERS, followBack: [...ORDERS.followBack] };
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const yawTo = (a: number[], b: number[]) => Math.atan2(b[0] - a[0], b[2] - a[2]);
const ids = (rows: any[]) => rows.map((r: any) => r.id).join(' ');

/** One game under a seed. `nb`: the night breach staged (its pair = the squad). `quiet`: the defenders kept dazzled every frame (they neither see nor fire). */
async function rig(seed: number, o: { nb?: boolean; quiet?: boolean; knobs?: Record<string, unknown> } = {}) {
  Object.assign(NIGHTBREACH, NB_DEFAULTS, { blindFire: false }, o.knobs ?? {});
  Math.random = seeded(seed);
  const W: any = await standUp(); const game = W.game, NB = game.nightBreach, O = game.orders, input = W.input;
  (await import(`${ROOT}/src/game/cmdring.ts`)).CMDRING.wholeSquad = false;   // (these lines step who the orders go to with T, the wheel and the cursor, outside plan mode, as the menu was built: the rule that only plan mode picks a part of the squad is held off here and has its own lines, wholesquad-check)
  (await import(`${ROOT}/src/game/cmdring.ts`)).CMDRING.only = false;   // (the menu's own keys and the middle button, as these lines were written: `probes.ts qonly` has the page's, where the ring carries every order)
  const why = o.nb === false ? null : NB.start();
  const R = { W, game, NB, O, input, why, quiet: o.quiet !== false, samHit: false, said: [] as { who: string; text: string; t: number }[],
    /** run before every frame (Sam's walk) */
    pre: null as null | (() => void),
    step(n = 1) {
      for (let i = 0; i < n; i++) {
        game.player.visibility = 0.05;
        if (R.quiet) for (const h of NB.hostiles) if (h.state !== 'dead') h.dazzledUntil = game.time + 5;
        R.pre?.();
        W.step(DT);
        for (const gd of game.guards) { const b = gd.bubble; if (b && !heard.has(b)) { heard.add(b); R.said.push({ who: gd.callsign, text: b.text, t: game.time }); } }
        if (game.player.down || game.player.hitFlash > 0) R.samHit = true;
      }
    },
    until(pred: () => boolean, secs: number) { for (let i = 0; i < secs * 60 && !pred(); i++) R.step(); return pred(); },
    /** the reticle on a world point (the harness cursor → the game's aim ray on the next frame) */
    aim(p: number[]) { return W.cursorAt([p[0], p[1], p[2]]); },
    /** a one-frame key (a tap) */
    key(code: string) { input.pressed.add(code); R.step(); },
    /** the quick key pressed with the cursor on p: the target's own order, at once */
    quick(p: number[]) { R.aim(p); input.pressed.add(ORDERS.quickKey); R.step(); },
    /** X PRESSED (one frame — nothing is held) with the cursor on p: the menu comes up there; then `secs` more of frames with every key up */
    openX(p: number[], secs = 0.4) { R.aim(p); input.pressed.add(ORDERS.key); R.step(); const n = Math.round(secs * 60) - 1; for (let i = 0; i < n; i++) R.step(); },
    /** Esc pressed: the menu goes down with no order */
    esc() { input.pressed.add('Escape'); R.step(); },
    /** a left click as the page's mouse writes it: the press bit for one frame, the held bit until the button comes up a few frames on */
    click() { input.clicked |= 1; input.buttons |= 1; R.step(); input.buttons &= ~1; R.step(); },
    /** press X on p, then the row's digit a third of a second later (X long since up): the n-th row — more digits walk the menu's pages (5, 1 = the door
     *  tools' page, its first row) */
    pick(p: number[], ...n: number[]) { R.openX(p, 0.35); for (const k of n) { input.pressed.add(`Digit${k}`); R.step(); } },
    door(name: string): any { return game.doors.list.find((d: any) => d.def.name === name); },
    lines(text: RegExp, since = 0) { return R.said.filter(s => s.t >= since && text.test(s.text)); },
  };
  const heard = new WeakSet<any>();
  return R;
}
/** every probe leaves the knob tables as it found them, pass, fail or throw */
const guarded = (fn: () => Promise<boolean>) => async () => { try { return await fn(); } finally { Object.assign(NIGHTBREACH, NB_DEFAULTS); Object.assign(ORDERS, ORD_DEFAULTS, { followBack: [...ORD_DEFAULTS.followBack] }); } };
const lastOrder = (O: any) => O.log[O.log.length - 1] ?? null;
// What the first page holds under the stand's own rules — read once a game is stood up (the stand sets the switches then), never at the top of the file. The
// page as it opens adds two rows to the four of a floor spot: the squad's throw (SQUADTHROW.on — on G, no digit of its own, floor only) and the squad's
// posture, 'go silent' (SILENT.on — on the spare digit, 5, on the floor and on nothing; a door's 5 is still its tools). With both off the lists are the
// four and the two they always were. The HUD block's header carries the posture's word in front of who the orders go to.
const floorIds = (): string[] => ['move', 'cover', 'fallIn', 'hold', ...(SQUADTHROW.on ? ['throwThere'] : []), ...(SILENT.on ? ['silent'] : [])];
const noneIds = (): string[] => ['fallIn', 'hold', ...(SILENT.on ? ['silent'] : [])];
const postureWord = (): string => SILENT.on ? (SILENT.start ? 'SILENT · ' : 'loud · ') : '';
const wordsOf = (d: any, t: any): string => !d ? '—' : typeof d.label === 'string' ? d.label : d.label(t);
const logLine = (l: any) => l ? `${l.order} → ${l.who.join(' + ')} on ${l.target}` : 'nothing';

// open floor on the east–west aisle that runs from the pair's start to the break room's west door, in plain view of the camera (nothing between it and the
// floor there: orders-move checks the reticle's point is the point asked for) — and the same for a spot back west of the pair, in the aisle they start in
const AISLE: number[] = [15, 0, 17.6], AISLE_FAR: number[] = [21, 0, 17.6], WEST: number[] = [7.5, 0, 17.6];

export const ordersOff = guarded(async () => {
  const { verdict, done } = family('orders-off: with no squad on the floor X, B, T and the middle button are dead');
  const run = async (keys: boolean) => { const R = await rig(5, { nb: false }); Math.random = seeded(77);
    for (let i = 0; i < 600; i++) { if (keys) { if (i === 100) R.input.pressed.add(ORDERS.key); if (i === 160) R.input.pressed.add(ORDERS.whoKey); if (i === 220) R.input.pressed.add(ORDERS.quickKey); if (i === 280) R.input.clicked |= 2; if (i === 340) R.input.pressed.add(ORDERS.key); } R.step(); }
    return R; };
  const A = await run(false), B = await run(true); const O = B.O;
  const hud = O.hud();
  verdict(!O.active && O.menu === null && O.log.length === 0 && O.who === 'all' && hud.menu === null && hud.status.length === 0, 'inert: no squad, no menu, no order logged, no HUD block after X, T, B, a middle click and X again',
    `active ${O.active} · menu ${O.menu} · log ${O.log.length} · hud rows ${hud.status.length} · ${O.summary()}`);
  const why = O.give('fallIn');
  verdict(why === 'no squad', 'give() refuses with the reason', `give('fallIn') → ${why}`);
  const da = JSON.stringify(digestGame(A.game, true)), db = JSON.stringify(digestGame(B.game, true));
  verdict(da === db, 'ten seeded seconds digest the same with and without the keys', `digest ${da.length} chars · ${da === db ? 'equal' : 'DIFFERENT'}`);
  return done();
});

export const ordersMenu = guarded(async () => {
  const { verdict, done } = family('orders-menu: the menu offers what fits the target, and only that');
  const R = await rig(11); const { game: g, O, input } = R; const [b1, b2] = O.squad(); const sam = g.player.char;
  R.step(30);
  const start = [b1, b2].map((m: any) => [...m.char.pos]);
  const W = R.door('breakroom_w');
  const floor = floorIds().join(' '), none = noneIds().join(' '), thr = !!SQUADTHROW.on, sil = !!SILENT.on, nNew = (thr ? 1 : 0) + (sil ? 1 : 0);
  // --- the three targets, by the cursor. X is PRESSED: one frame, nothing held from here on
  R.openX(AISLE, 1 / 60);
  const early = O.menu ? { hud: !!O.hud().menu } : null; const heldKeys = input.keys.size + input.buttons;
  R.step(40);   // (two thirds of a second with every key up: it stays)
  const mF = O.menu; const hudF = O.hud();
  verdict(!!early && early.hud && heldKeys === 0 && !!mF && mF.target.kind === 'floor' && ids(mF.rows) === floor,
    `X pressed on open floor: the list is up on that frame with move / cover / fall in / hold${thr ? ' / throw' : ''}${sil ? ' / go silent' : ''}, and still up two thirds of a second later with no key down`, `on the press: up ${!!early?.hud} · keys + buttons down ${heldKeys} · 40 frames on: up ${!!mF} · target ${mF?.target.kind} ${mF ? at(mF.target.at) : ''} · rows: ${mF ? ids(mF.rows) : '—'}`);
  const rowsF = hudF.menu?.rows ?? [];
  // (the rows the page adds sit between the four and the cancel row: the throw on G with what is left of each can, then 'go silent' on 5 under the whole
  //  squad's own header — each asked for where its switch is on, and no row there where it is off)
  const thrRow = thr ? rowsF[5] : null, silRow = sil ? rowsF[5 + (thr ? 1 : 0)] : null;
  const newOk = (!thr || (thrRow?.opts[0].key === 'G' && /^throw · frag \d+ · bang \d+ ▸/.test(thrRow.opts[0].text))) && (!sil || (silRow?.opts[0].key === '5' && silRow.opts[0].text === 'go silent' && silRow.label === 'the whole squad'));
  verdict(!!hudF.menu && hudF.menu.open && rowsF.length === 6 + nNew && newOk && rowsF[0].label === 'orders to all' && rowsF[0].opts[0].key === 'T' && rowsF[rowsF.length - 1].kind === 'cancel' && rowsF.slice(1, 5).map((r: any) => r.opts[0].text).join(' | ') === 'move there | cover that way | fall in | hold position' && rowsF.slice(1, 5).every((r: any, i: number) => r.opts[0].key === String(i + 1)) && rowsF[1].label === 'on that spot' && hudF.menu.primary === 1 && hudF.status.length === 0,
    `the panel gets the open menu as its rows: who the order goes to (with T's choices), four numbered orders under what they are about, ${thr ? 'the throw on G, ' : ''}${sil ? 'the squad\'s "go silent" on 5, ' : ''}a cancel row — in place of the squad block`, `"${rowsF[0]?.label}" [${rowsF[0]?.opts[0]?.key} ${rowsF[0]?.opts[0]?.text}] · "${rowsF[1]?.label}": ${rowsF.slice(1).map((r: any) => r.kind === 'cancel' ? '[cancel]' : `${r.opts[0].key} ${r.opts[0].text}`).join(' · ')} · hint "${hudF.menu?.hint}"`);
  // frozen on the target: the cursor wanders onto the door while the list is up — the list does not change
  R.aim(W.frameCentre); R.step(6);
  verdict(O.menu?.target.kind === 'floor' && ids(O.menu.rows) === floor, 'the open list is frozen on what it was opened on (the cursor moved onto a door meanwhile)', `target ${O.menu?.target.kind} · rows: ${O.menu ? ids(O.menu.rows) : '—'}`);
  // Esc backs out: nothing issued
  input.pressed.add('Escape'); R.step(); R.step(20); const escMenu = O.menu;
  verdict(escMenu === null && O.log.length === 0, 'Esc backs out: no order', `menu ${escMenu} · orders logged ${O.log.length}`);
  // the wheel moves the highlight (never Sam's pace); Space on the cancel row issues nothing
  const pace0 = g.player.pace;
  R.openX(AISLE, 0.35); const sel: number[] = [O.menu.sel];
  const nF = floorIds().length;   // (a notch a row: as many notches as the list is long — four, and one each for the throw and the posture where the page has them — end on the cancel row)
  for (let k = 0; k < nF; k++) { input.wheel += 100; R.step(); sel.push(O.menu.sel); }
  R.key('Space');
  verdict(sel.join(',') === Array.from({ length: nF + 1 }, (_, i) => i).join(',') && O.menu === null && O.log.length === 0 && g.player.pace === pace0 && g.player.sel.downT < 0, 'the wheel walks the highlight down to the cancel row; Space there closes the list with no order; Sam\'s walking pace is untouched', `highlight ${sel.join(' → ')} · orders logged ${O.log.length} · pace ${f2(pace0)} → ${f2(g.player.pace)}`);
  // the other ways down: X again, a right click, the trigger — no order from any of them; and the left click is still Sam's shot
  const gun = g.player.firearm, shots0 = gun.shotsFired;
  R.openX(AISLE, 0.2); const up1 = !!O.menu; R.key(ORDERS.key); const dn1 = O.menu === null;
  R.openX(AISLE, 0.2); input.clicked |= 4; R.step(); const dn3 = O.menu === null;
  R.openX(AISLE, 0.2); R.click(); const dn4 = O.menu === null; R.step(20);
  verdict(up1 && dn1 && dn3 && dn4 && O.log.length === 0 && (g.player.gunInHand() ? gun.shotsFired === shots0 + 1 : true), 'X again closes it; a right click closes it; a left click closes it and is Sam\'s trigger all the same — none of them gives an order', `X: up ${up1} then down ${dn1} · right click: down ${dn3} · left click: down ${dn4}, rounds fired ${shots0} → ${gun.shotsFired} (${g.player.gunInHand() ? 'gun in hand' : 'nothing in hand'}) · orders logged ${O.log.length}`);
  // door
  R.openX(W.frameCentre, 0.4); const mD = O.menu; const hudD = O.hud().menu; R.aim(AISLE); R.esc();
  // (row 4 of the tools under the stand's own rule. The pages as they were: the turn to the threshold's page, and that page's three rows. DOORTOOLS.outsidePlain,
  //  on in the page: no such page — row 4 IS the one order, 'clear from outside', and nothing is filed behind it)
  const toolsD: any[] = mD ? O.rowsFor(mD.target, 'tools') : [], four = toolsD[3], fourWords = DOORTOOLS.outsidePlain && mD ? wordsOf(four, mD.target) : '';
  const fourOk = !!mD && (DOORTOOLS.outsidePlain ? ids(toolsD) === 'openClear bangClear charge thresholdHold fragClear' && four?.id === 'thresholdHold' && String(four.key) === '4' && !four.opens && fourWords === 'clear from outside' && O.rowsFor(mD.target, 'thr').length === 0
    : ids(O.rowsFor(mD.target, 'tools')) === 'openClear bangClear charge thr fragClear' && ids(O.rowsFor(mD.target, 'thr')) === 'thresholdHold threshold outside');
  verdict(!!mD && mD.target.kind === 'door' && mD.target.door === W && ids(mD.rows) === 'stack cover fallIn hold tools' && fourOk && hudD?.rows[2].opts[0].text === 'cover this door' && /^door tools ▸/.test(hudD?.rows[5].opts[0].text ?? '') && hudD?.rows[5].opts[0].key === '5' && /^on .*door/.test(hudD?.rows[1].label ?? ''),
    'X pressed on a door: stack up / cover this door / fall in / hold — no "move there" — and then, on 5, the row that turns to the door tools\' own page of four (doortools.ts; its own family holds them)', `target ${mD?.target.kind} ${mD?.target.door?.def.name} · rows: ${mD ? ids(mD.rows) : '—'} · tools page: ${mD ? ids(O.rowsFor(mD.target, 'tools')) : '—'} ▸ ${mD ? ids(O.rowsFor(mD.target, 'thr')) : '—'} · ${hudD?.rows.slice(1, 6).map((r: any) => `${r.opts[0].key} ${r.opts[0].text}`).join(' | ')}${DOORTOOLS.outsidePlain ? ` · the tools' ${four?.key}: "${fourWords}", the one order — no page behind it` : ''}`);
  // Sam himself: nothing to point at
  R.openX(sam.pos, 0.4); const mN = O.menu; R.esc();
  verdict(!!mN && mN.target.kind === 'none' && !mN.target.man && ids(mN.rows) === none && mN.men.length === 2, sil ? 'X pressed on Sam himself (nothing to point at): fall in / hold and the squad\'s own "go silent" — nothing that needs a place —, to the pair' : 'X pressed on Sam himself (nothing to point at): fall in / hold only, to the pair', `target ${mN?.target.kind} · rows: ${mN ? ids(mN.rows) : '—'} · to ${mN?.men.map((m: any) => m.callsign).join(' + ')}`);
  // a teammate under the reticle: his alone
  R.openX(b2.char.pos, 0.4); const mM = O.menu; const headM = O.hud().menu?.rows[0].label; R.esc();
  verdict(!!mM && mM.target.kind === 'none' && mM.target.man === b2 && mM.men.length === 1 && mM.men[0] === b2 && ids(mM.rows) === none, 'X pressed on a teammate: the order is his alone', `target ${mM?.target.kind} man ${mM?.target.man?.callsign} · to ${mM?.men.map((m: any) => m.callsign).join(' + ')} · head "${headM}"${sil ? ` · rows: ${mM ? ids(mM.rows) : '—'}` : ''}`);
  // the cursor's own point, not the auto-aim's: floor a pace east of Blue Two (inside the snap's 60 px of him and of a ceiling panel)
  let beside: number[] | null = null;   // a free floor point clear of the men where the auto-aim snaps the reticle off somewhere else (a ceiling panel, a monitor, a man)
  let plain: number[] | null = null;   // (the first such floor point where it does NOT snap away: what is asked where the reticle takes no teammate — friends.ts FRIENDS.noSnap — and nothing else is near)
  search: for (const z of [20, 20.5, 21, 21.5, 19.5, 17.5, 18]) for (let x = 6.5; x <= 11; x += 0.5) { const p = [x, 0, z];
    if (g.col.nav.isBlocked(x, z) || [b1, b2].some((m: any) => dist(m.char.pos, p) < 1.2) || dist(sam.pos, p) < 1.5) continue;
    R.aim(p); R.step(); if (!g.aimSnap || dist(g.aimPoint, p) < 1) { if (!plain && dist(b2.char.pos, p) < 2.2) plain = p; continue; }
    const cv = R.W.canvas, ray = R.W.cam.ray(input.mouseX / cv.clientWidth, input.mouseY / cv.clientHeight);
    if ([b1, b2].every((m: any) => m.char.rayHit(ray.ro, ray.rd, 200) < 0)) { beside = p; break search; } }   // (and the cursor is not ON a man: his head hides the floor behind him)
  const snapped = [...g.aimPoint]; const snapTo = g.aimGuard?.callsign ?? g.aimTarget?.name ?? 'a light';
  if (beside) { R.openX(beside, 0.4); const mS = O.menu; R.esc();
    verdict(!!mS && mS.target.kind === 'floor' && dist(mS.target.at, beside) < 0.3 && ids(mS.rows) === floor, 'the menu takes the cursor\'s own world point: a floor spot is that floor, wherever the auto-aim snapped the reticle to',
      `target ${mS?.target.kind} ${mS ? at(mS.target.at) : ''} for ${at(beside)} · the auto-aim had the reticle on ${snapTo} at ${at(snapped)} y ${f2(snapped[1])}, ${f2(dist(snapped, beside))} m away`); }
  else if (FRIENDS.noSnap && plain) { R.aim(plain); R.step(); const stayed = !g.aimGuard && dist(g.aimPoint, plain) < 1; R.openX(plain, 0.4); const mS = O.menu; R.esc();
    verdict(stayed && !!mS && mS.target.kind === 'floor' && dist(mS.target.at, plain) < 0.3 && ids(mS.rows) === floor, 'the menu takes the cursor\'s own world point: with no ring on teammates the reticle stays on the floor beside one, and that floor is the target',
      `target ${mS?.target.kind} ${mS ? at(mS.target.at) : ''} for ${at(plain)} · reticle ${stayed ? 'on the cursor' : 'snapped away'} · rows ${mS ? ids(mS.rows) : '—'}`); }
  else verdict(false, 'the menu takes the cursor\'s own world point', 'found no floor point where the auto-aim snaps away — the check did not run');
  // Esc is used up by the menu: the same press is not the Space selector's as well (the direct key, and the page's Game.escape() ahead of the frame)
  R.openX(AISLE, 0.4); input.pressed.add('Escape'); O.input(DT, input, R.W.cam, R.W.canvas); const e1 = O.menu === null && !input.pressed.has('Escape'); R.step();
  R.openX(AISLE, 0.4); const used = g.escape(); input.pressed.add('Escape'); O.input(DT, input, R.W.cam, R.W.canvas); const e2 = used && O.menu === null && !input.pressed.has('Escape'); R.step();
  verdict(e1 && e2 && O.log.length === 0, 'Esc on the open menu is taken out of the frame\'s input (pressed in the frame, or handled by Game.escape() ahead of it)', `in-frame ${e1} · via Game.escape() ${e2}`);
  // an order a later part registers for doors: on doors, nowhere else
  let ran = 0;
  O.register({ id: 'testCharge', page: 'tools', label: 'test: door tool', targets: ['door'], issue: () => { ran++; } });
  R.openX(W.frameCentre, 0.4); const rD1 = ids(O.menu.rows), tgtD = O.menu.target; input.pressed.add('Digit5'); R.step(); const rD = `${rD1} ▸ ${ids(O.menu.rows)}`, kD = O.menu.rows.map((r: any) => r.key).join(''); R.esc(); const backD = O.menu?.page === null && O.menu.target === tgtD; R.esc();
  R.openX(AISLE, 0.4); const rF = ids(O.menu.rows); R.esc();
  R.openX(sam.pos, 0.4); const rN = ids(O.menu.rows); R.esc();
  R.pick(W.frameCentre, 5, 5);
  const regLog = lastOrder(O); O.unregister('testCharge'); O.log.length = 0;
  verdict(rD === `stack cover fallIn hold tools ▸ openClear bangClear charge ${DOORTOOLS.outsidePlain ? 'thresholdHold' : 'thr'} fragClear testCharge` && kD === '12345' && backD && rF === floor && rN === none && ran === 1 && regLog?.order === 'testCharge' && O.menu === null, 'a door order registered by a later part on the door tools\' page shows on doors only, at the foot of that page on the next digit (5, after the tools\' 1 to 4 — never one above 5) — the built-in rows keep theirs — Esc on the page steps back to the first, and X, 5, 5 runs it', `door: ${rD} (page digits ${kD}, Esc back ${backD}) · floor: ${rF} · nothing: ${rN} · ran ${ran} · ${logLine(regLog)}`);
  const moved0 = Math.max(...[b1, b2].map((m: any, i: number) => dist(m.char.pos, start[i])));
  verdict(moved0 < 0.05 && O.log.length === 0, 'through all of that no order was given and nobody moved', `orders logged ${O.log.length} · most a man moved ${f2(moved0)} m`);
  // a digit picks at once and is not Sam's weapon slot
  const slot0 = g.player.slot;
  R.openX(AISLE, 0.35); input.pressed.add('Digit1'); R.step(); const afterDigit = O.menu; const l1 = lastOrder(O); R.step(20); const stillNone = O.menu;
  verdict(l1?.order === 'move' && l1.who.length === 2 && afterDigit === null && stillNone === null && O.log.length === 1 && g.player.slot === slot0, 'a digit picks its row at once (the list goes down with it, one order) and never reaches Sam\'s weapon slots', `${logLine(l1)} · orders logged ${O.log.length} · Sam's slot ${slot0} → ${g.player.slot}`);
  // the quick key = the first row for the target, with no menu
  R.step(30); R.quick(W.frameCentre); const tD = lastOrder(O); R.step(30); R.quick(sam.pos); const tN = lastOrder(O); R.step(30); R.quick(AISLE); const tF = lastOrder(O);
  verdict(tD?.order === 'stack' && tD.target === 'door:breakroom_w' && tN?.order === 'fallIn' && tF?.order === 'move' && O.log.length === 4, 'the quick key (B) is the first row at once: stack on a door, fall in on nothing, move on the floor', `${logLine(tD)} · ${logLine(tN)} · ${logLine(tF)}`);
  // the middle button: once puts the list up on the cursor, again gives the highlighted row (the first: the target's own) — nothing held, nothing typed
  R.step(30); const nM = O.log.length; R.aim(AISLE_FAR); input.clicked |= 2; R.step(); const upM = !!O.menu, firstM = O.menu?.rows[0]?.id; R.step(12); input.clicked |= 2; R.step(); const lM = lastOrder(O);
  verdict(upM && O.menu === null && O.log.length === nM + 1 && !!firstM && lM?.order === firstM, 'the middle mouse button puts the list up on the cursor; pressed again it gives the highlighted row (the first one)', `up ${upM} · first row ${firstM} · ${logLine(lM)} · orders logged ${O.log.length - nM}`);
  // the squad block
  R.step(30); const st = O.hud().status[0];
  verdict(!!st && st.label === `squad · ${postureWord()}orders to all` && st.opts.length === 7 && /^Blue One · /.test(st.opts[0].text) && /^Blue Two · /.test(st.opts[1].text) && /^charges \d+ · bangs \d+$/.test(st.opts[2].text) && /^frags \d+$/.test(st.opts[3].text) /* (the frag part's count, its own note) */ && st.opts[4].key === 'B' && /^move there · that spot$/.test(st.opts[4].text) && st.opts[5].key === 'X' && st.opts[6].key === 'T' && st.opts[6].text === 'who · [all] · Blue One · Blue Two',
    'with no menu open the panel carries the squad block: who the orders go to, each man and what he is doing, the door tools\' counts (SquadOrders.notes), what the quick key would give on what the cursor is on, the menu key, T\'s choices', st ? `${st.label} | ${st.opts.map((o: any) => `${o.key ? o.key + ' ' : ''}${o.text}`).join(' | ')}` : 'no block');
  verdict(!R.samHit, 'Sam was not hit', `hit ${R.samHit}`);
  return done();
});

export const ordersMove = guarded(async () => {
  const { verdict, done } = family('orders-move: move there puts the pair on the spot, hold stops them where they are');
  const R = await rig(11); const { game: g, O } = R; const [b1, b2] = O.squad(); const men = [b1, b2]; const sam = g.player.char;
  R.step(30);
  const from = men.map((m: any) => [...m.char.pos]); const t0 = g.time;
  // the staging the step-off line was written on: each man stands facing the way he is about to be sent, as the pair does where a staging leaves it with no
  // order. Where the team starts fallen in on Sam (START.fallIn, as the page has it) they stand facing wherever the file left them, and a man walks along his
  // body while it comes round (guards.ts followPath), so the same third of a second measured his turn, not his lean into the move. Staged as the Director
  // stages a man's yaw: body and gun written, then a dt-0 update so that the yaw he is drawn at (character.ts TURN) is the one written and not the old one
  // coming round. Not his order, his place or a table; with the switch off nothing here runs.
  const stood = men.map((m: any) => m.char.bodyYaw);
  if (START.fallIn) for (const m of men) { const c = m.char; c.bodyYaw = c.aimYaw = yawTo(c.pos, AISLE); c.update(0); }
  R.quick(AISLE); const aimed = [...g.aimPoint];
  const ack = R.said.filter(s => s.t >= t0);
  R.step(2); const first = men.map((m: any, i: number) => dist(m.char.pos, from[i]));   // (the order's own tick and two more: he is already off his spot)
  R.step(18); const early = men.map((m: any, i: number) => dist(m.char.pos, from[i]));
  const set = R.until(() => men.every((m: any) => O.of(m)?.arrived), 12); const tSet = g.time - t0;
  const face = yawTo(sam.pos, AISLE);
  const dPost = men.map((m: any) => dist(m.char.pos, O.of(m).post)), dAt = men.map((m: any) => dist(m.char.pos, AISLE)), apart = dist(b1.char.pos, b2.char.pos);
  const dYaw = men.map((m: any) => Math.abs(wrap(m.char.bodyYaw - face)));
  verdict(dist(aimed, AISLE) < 0.1 && lastOrder(O)?.order === 'move' && lastOrder(O).target === `floor:${AISLE[0].toFixed(1)},${AISLE[2].toFixed(1)}`, 'the cursor on a floor point, the quick key: "move there", to that point', `reticle ${at(aimed)} for ${at(AISLE)} · ${logLine(lastOrder(O))}`);
  verdict(ack.length === 1 && /moving|on it/.test(ack[0].text), 'the order is acknowledged in a word by one man', `said: ${ack.map(s => `${s.who} "${s.text}"`).join(', ') || 'nothing'}`);
  verdict(early.every(d => d > 0.1) && first.every(d => d > 0), 'they step off at once (a third of a second on, both are moving — a man leans into a move now, guards.ts PACE.accel: it was a quarter metre gone by then)', `moved after 0.33 s: ${early.map(f2).join(' / ')} m${START.fallIn ? ` · off his spot three ticks in ${first.map(d => (d * 1000).toFixed(1)).join(' / ')} mm · each turned to the heading first (they stood fallen in, at ${stood.map(f2).join(' / ')} rad)` : ''}`);
  verdict(set && dPost.every(d => d < 0.35) && dAt.every(d => d < 2.55) && apart > 0.8, 'both arrive: each on his own mark round the point, a body\'s room and more apart (roomfit.ts deals the marks from the room; it was two abreast at the point — roomfit-off holds that)', `in ${f2(tSet)} s · off his spot ${dPost.map(f2).join(' / ')} m · off the point ${dAt.map(f2).join(' / ')} m · apart ${f2(apart)} m · ${men.map((m: any) => at(m.char.pos)).join(' ')}`);
  R.step(60);
  verdict(men.every((m: any) => { const A = O.of(m); return !!A.watch && Math.abs(wrap(m.char.aimYaw - yawTo(m.char.pos, A.watch))) < 0.3; }) && men.every((m: any) => O.statusOf(m).startsWith('in position · ')), 'each has his gun on what the room dealt him and the HUD says "in position" and what he is on (it was: every man facing the way they were sent)', `off the heading ${dYaw.map(f2).join(' / ')} rad · ${men.map((m: any) => O.statusOf(m)).join(' / ')}`);
  const sets = R.lines(/^set\.$/, t0);
  verdict(sets.length === 1, '"set." is called once, when both are on their marks', `${sets.map(s => `${s.who} @${f2(s.t - t0)} s`).join(', ') || 'never'}`);
  const here = men.map((m: any) => [...m.char.pos]); R.step(60 * 6);
  const drift = men.map((m: any, i: number) => dist(m.char.pos, here[i]));
  verdict(drift.every(d => d < 0.1) && R.lines(/^set\.$/, t0).length === 1, 'six seconds on they have not shifted, and nobody said it again', `drift ${drift.map(f2).join(' / ')} m`);
  // hold, mid-run
  R.quick(AISLE_FAR); R.step(55);
  const mid = men.map((m: any) => [...m.char.pos]); const speed = men.map((m: any) => m.speed);
  R.pick(sam.pos, 4);   // the reticle on Sam himself: fall in (3) / hold (4) — the digits are the same on every target
  const held = lastOrder(O); const atOrder = men.map((m: any) => [...m.char.pos]);
  R.step(60 * 2); const after2 = men.map((m: any, i: number) => dist(m.char.pos, atOrder[i]));
  R.step(60 * 6); const after8 = men.map((m: any, i: number) => dist(m.char.pos, atOrder[i])); const toFar = men.map((m: any) => dist(m.char.pos, AISLE_FAR));
  verdict(held?.order === 'hold' && speed.every((s: number) => s > 1) && after2.every(d => d < 0.6) && after8.every(d => d < 0.6) && toFar.every(d => d > 1.5) && men.every((m: any) => O.statusOf(m) === 'holding' && m.speed < 0.1),
    'hold position while they run to a far spot: both stop within a stride of where they were and stay there', `${logLine(held)} · speed at the order ${speed.map(f2).join(' / ')} m/s · ${mid.map(at).join(' ')} · off it after 2 s ${after2.map(f2).join(' / ')} m, after 8 s ${after8.map(f2).join(' / ')} m · still ${toFar.map(f2).join(' / ')} m short of the far spot`);
  verdict(!R.samHit && R.NB.state === 'staged', 'Sam untouched, the breach still only staged', `hit ${R.samHit} · night breach ${R.NB.state}`);
  return done();
});

export const ordersCover = guarded(async () => {
  const { verdict, done } = family('orders-cover: cover turns a man onto the direction or the door, and he stays on it');
  const R = await rig(11); const { game: g, O } = R; const [b1, b2] = O.squad(); const men = [b1, b2];
  R.step(30); R.quick(AISLE); R.until(() => men.every((m: any) => O.of(m)?.arrived), 12); R.step(30);
  const offAim = (m: any, p: number[]) => Math.abs(wrap(m.char.aimYaw - yawTo(m.char.pos, p)));
  const cover = (label: string, p: number[], row: number, wantWords: RegExp, ackSince: number) => {
    const here = men.map((m: any) => [...m.char.pos]); const before = men.map((m: any) => offAim(m, p));
    R.pick(p, row); const l = lastOrder(O); const watch = men.map((m: any) => O.of(m)?.watch ?? [NaN, NaN, NaN]);
    const on = R.until(() => men.every((m: any) => O.of(m)?.arrived), 4); const tOn = g.time - l.t;
    const off = men.map((m: any) => offAim(m, p)), moved = men.map((m: any, i: number) => dist(m.char.pos, here[i]));
    let worst = 0; for (let i = 0; i < 60 * 8; i++) { R.step(); for (const m of men) worst = Math.max(worst, offAim(m, p)); }
    const moved8 = men.map((m: any, i: number) => dist(m.char.pos, here[i]));
    const words = men.map((m: any) => O.statusOf(m)); const up = men.map((m: any) => m.script?.upper); const body = men.map((m: any) => Math.abs(wrap(m.char.bodyYaw - yawTo(m.char.pos, p))));
    verdict(l.order === 'cover' && watch.every((w: number[]) => dist(w, p) < 0.1) && before.every(b => b > 0.5) && on && off.every(d => d < 0.2) && moved.every(d => d < 0.3), `${label}: each man turns his gun onto it where he stands`,
      `${logLine(l)} · watching ${at(watch[0])} for ${at(p)} · off it before ${before.map(f2).join(' / ')} rad → ${off.map(f2).join(' / ')} rad in ${f2(tOn)} s · moved ${moved.map(f2).join(' / ')} m`);
    verdict(worst < 0.2 && body.every(d => d < 0.4) && moved8.every(d => d < 0.3) && words.every((w: string) => wantWords.test(w)) && up.every((u: string) => u === 'aim'), `${label}: eight seconds on he is still on it — gun and body — and the HUD says where`,
      `worst off it ${f2(worst)} rad · body off it ${body.map(f2).join(' / ')} rad · moved ${moved8.map(f2).join(' / ')} m · upper ${up.join(' / ')} · "${words.join('" / "')}"`);
    const ack = R.said.filter(s => s.t >= ackSince && /covering|got it/.test(s.text));
    return ack;
  };
  const tA = g.time;
  const ackA = cover('cover that way (a floor point behind them, to the west)', WEST, 2, WORDS.on ? /^covering (?!.*\b(north|south|east|west)\b)\S/ : /^covering west$/, tA);   // (the dialogue pass on: the place by its name or 'that way', never a bearing — a row on the HUD has no compass)
  const tB = g.time;
  const W = R.door('breakroom_w');
  const ackB = cover('cover this door (the break room\'s west door)', W.frameCentre, 2, new RegExp(`^covering ${doorIdWords('breakroom_w')}$`), tB);
  verdict(ackA.length === 1 && ackB.length === 1, 'each cover order is acknowledged once', `${[...ackA, ...ackB].map(s => `${s.who} "${s.text}"`).join(', ')}`);
  verdict(!R.samHit, 'Sam was not hit', `hit ${R.samHit}`);
  return done();
});

export const ordersStack = guarded(async () => {
  const { verdict, done } = family('orders-stack: stack up puts the men on the door\'s jambs, on Sam\'s side');
  // (the PLAIN stack: where the men stand and face when every gun is the door's. With rear security on — COVER.stacked, as shipped — the pair's second man
  //  faces the way they came instead: that contract is cover-order's)
  const stackedWas = COVER.stacked; COVER.stacked = false; try {
  // three doors, each from the side Sam is put on: [door, where Sam stands, where the pair starts]
  // [door, where Sam is put, the words for that side, both men in file on one jamb?]
  const cases: [string, number[], string, boolean][] = [['breakroom_w', [24.5, 0, 17.6], 'the cubicles\' side', false], ['breakroom_w', [29.6, 0, 17.6], 'inside the break room', false],
    ['breakroom_n', [30.6, 0, 10.9], 'the corridor side', false], ['breakroom_n', [30.75, 0, 14.4], 'inside the break room (the counter runs off the hinge side: no floor at that jamb)', true]];
  let k = 0;
  for (const [name, samAt, sideWords, file] of cases) {
    const R = await rig(11 + k++); const { game: g, O } = R; const [b1, b2] = O.squad(); const men = [b1, b2];
    R.step(30); g.teleportPlayer(samAt); R.step(40);
    const d = R.door(name); const th = d.def.closedDir, u = [Math.cos(th), Math.sin(th)], H = d.def.hinge, w = d.def.width;
    const along = (p: number[]) => (p[0] - H[0]) * u[0] + (p[2] - H[1]) * u[1];           // metres down the closed leaf's line from the hinge: the opening is 0‥w
    const off = (p: number[]) => -(p[0] - H[0]) * u[1] + (p[2] - H[1]) * u[0];            // signed distance off the wall line
    const samSide = Math.sign(off(g.player.char.pos)); const t0 = g.time;
    R.quick(d.frameCentre); const l = lastOrder(O);
    const set = R.until(() => men.every((m: any) => O.of(m)?.arrived), 25); const tSet = g.time - t0;
    R.step(30);
    const a = men.map((m: any) => along(m.char.pos)), o = men.map((m: any) => off(m.char.pos) * samSide);
    const clear = a.every(x => x < -0.15 || x > w + 0.15), jamb = a.map(x => x < 0 ? -x : x - w);   // how far past the nearer jamb
    const split = (a[0] < 0) !== (a[1] < 0);
    // facing: along the wall, toward the opening
    const want = a.map(x => Math.atan2(u[0] * (x < 0 ? 1 : -1), u[1] * (x < 0 ? 1 : -1))), dFace = men.map((m: any, i: number) => Math.abs(wrap(m.char.bodyYaw - want[i])));
    const onDoor = men.map((m: any) => Math.abs(wrap(m.char.aimYaw - yawTo(m.char.pos, d.frameCentre))));
    const dPost = men.map((m: any) => O.of(m) ? dist(m.char.pos, O.of(m).post) : NaN);
    verdict(l?.order === 'stack' && l.target === `door:${name}` && set && dPost.every(x => x < 0.35), `${name} #${k}: the quick key on the door from ${sideWords} — both men reach their marks`, `${logLine(l)} · in ${f2(tSet)} s · off his mark ${dPost.map(f2).join(' / ')} m · ${men.map((m: any) => at(m.char.pos)).join(' ')}`);
    verdict(clear && split === !file && o.every(x => x > 0.25 && x < 0.9) && jamb.every(x => x < (split ? 0.8 : 1.7)) && dist(b1.char.pos, b2.char.pos) > 0.6, `${name}: ${file ? 'in file on the one free jamb' : 'a man on each jamb'} — out of the opening, against the wall, on Sam's side of it`,
      `${split ? 'one each side of the door' : 'both in file on one side'} · past the jamb ${jamb.map(f2).join(' / ')} m · off the wall (Sam's side +) ${o.map(f2).join(' / ')} m · opening 0‥${f2(w)}, the men at ${a.map(f2).join(' / ')}`);
    // (holdfire.ts, on as shipped: a man whose gun the rule holds on a man who has not noticed the team — and who has not fired — is not turned to the door; false for every man with the rule off, where each muzzle must be on it)
    const { holdFireOnMan } = await import(`${ROOT}/src/game/holdfire.ts`), onMan = men.map((m: any) => { const t = g.fight.opOf(m)?.tgt; return t ? Math.abs(wrap(m.char.aimYaw - yawTo(m.char.pos, t.char.pos))) : NaN; }), heldMan = men.map((m: any, i: number) => holdFireOnMan(g, m) && (g.fight.opOf(m)?.rounds ?? 0) === 0 && onMan[i] < 0.2), nHeld = heldMan.filter(Boolean).length;
    verdict(men.every((_: any, i: number) => heldMan[i] || (dFace[i] < 0.3 && onDoor[i] < 0.6)), `${name}: bladed along the wall toward the door, muzzles on it`, `${men.length - nHeld} on the door${nHeld ? ` · ${nHeld} held on a man (hold fire, no round fired, gun ${onMan.filter((_: number, i: number) => heldMan[i]).map(f2).join(' / ')} rad off him)` : ''} · off the wall line ${dFace.map(f2).join(' / ')} rad · gun off the doorway ${onDoor.map(f2).join(' / ')} rad · stance ${men.map((m: any) => m.script?.stance).join(' / ')}`);
    // ('the door untouched': with every leaf on its closer (the harness's older stand) the door they stack on is shut, and stays shut. Where doors stay as they
    //  are left (DOORSTAY.on, as the page has it) a pair that came THROUGH it to reach Sam's side has left it open behind them: there the leaf is where their
    //  walk left it, and what the hold must not do is move it.)
    const leaf0 = DOORSTAY.on ? d.angle : 0;
    const here = men.map((m: any) => [...m.char.pos]); R.step(60 * 6); const drift = men.map((m: any, i: number) => dist(m.char.pos, here[i]));
    const sets = R.lines(/^set\.$/, t0); const words = men.map((m: any) => O.statusOf(m));
    verdict(drift.every(x => x < 0.1) && sets.length === 1 && words.every((s: string) => s === `stacked · ${doorIdWords(name)}`) && Math.abs(d.angle - leaf0) < 0.05, `${name}: they hold the stack (six seconds, the door untouched), "set." called once, the HUD says "stacked"`,
      `drift ${drift.map(f2).join(' / ')} m · set. ${sets.map(s => `${s.who} @${f2(s.t - t0)} s`).join(', ') || 'never'} · "${words[0]}" · leaf angle ${f2(d.angle)}${leaf0 ? ` (${f2(leaf0)} as the hold began)` : ''}`);
    if (k === 1) {   // the cursor on a stacked man is the man (he stands inside the door's pick radius), on the doorway still the door
      const chest: number[] = [b1.char.pos[0], 1.2, b1.char.pos[2]];
      R.openX(chest, 0.4); const tM = O.menu?.target; R.esc();
      R.openX(d.frameCentre, 0.4); const tD = O.menu?.target; R.esc();
      verdict(tM?.kind === 'none' && tM.man === b1 && tD?.kind === 'door' && tD.door === d, `${name}: the cursor on a man stacked beside the door addresses the man; on the doorway, the door`, `on Blue One (${f2(dist(b1.char.pos, d.frameCentre))} m from the doorway's centre): ${tM?.kind} ${tM?.man?.callsign ?? ''} · on the doorway: ${tD?.kind} ${tD?.door?.def.name ?? ''}`);
    }
    if (!R.samHit) continue; verdict(false, `${name}: Sam was hit`, '');
  }
  } finally { COVER.stacked = stackedWas; }
  return done();
});

export const ordersFallIn = guarded(async () => {
  const { verdict, done } = family('orders-fallin: fall in keeps the pair with Sam across two rooms and through the doors');
  const R = await rig(11); const { game: g, O } = R; const [b1, b2] = O.squad(); const men = [b1, b2]; const sam = g.player.char;
  R.step(30);
  // away first, so that falling in is a real leg
  R.quick(AISLE_FAR); R.until(() => men.every((m: any) => O.of(m)?.arrived), 12);
  const far = men.map((m: any) => dist(m.char.pos, sam.pos)); const t0 = g.time;
  R.quick(sam.pos); const l = lastOrder(O);
  R.until(() => men.every((m: any) => O.of(m)?.arrived), 12); R.step(60);
  const near = men.map((m: any) => dist(m.char.pos, sam.pos));
  verdict(l?.order === 'fallIn' && far.every(d => d > 6) && near.every(d => d > 0.7 && d < 3.2) && dist(b1.char.pos, b2.char.pos) > 0.6 && men.every((m: any) => O.statusOf(m) === 'with you'), 'the quick key on Sam: the pair comes back from a far spot and stops short of him, in file',
    `${logLine(l)} · from ${far.map(f2).join(' / ')} m to ${near.map(f2).join(' / ')} m of Sam in ${f2(g.time - t0 - 1)} s · apart ${f2(dist(b1.char.pos, b2.char.pos))} m`);
  // turning on the spot: the men do not shuffle round him
  const here = men.map((m: any) => [...m.char.pos]);
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; R.aim([sam.pos[0] + Math.sin(a) * 4, 0, sam.pos[2] + Math.cos(a) * 4]); R.step(30); }
  const shuffled = men.map((m: any, i: number) => dist(m.char.pos, here[i]));
  verdict(shuffled.every(d => d < 0.15), 'Sam looks all the way round on the spot: the men stay where they stood', `moved ${shuffled.map(f2).join(' / ')} m while his reticle went round the compass`);
  // the walk: the aisle → the west door → across the break room → out of the north door → along the corridor
  const Wd = R.door('breakroom_w'), Nd = R.door('breakroom_n');
  const legs: number[][] = [[26.6, 0, 17.6], [29.6, 0, 17.6], [30.75, 0, 13.6], [30.75, 0, 11.0], [24, 0, 11.0]];
  const path: number[][] = [[sam.pos[0], 0, sam.pos[2]]]; let noPath = '';
  for (const p of legs) { const leg = g.col.nav.findPath(path[path.length - 1], p); if (!leg) { noPath = `no nav path to ${at(p)}`; break; } for (const q of leg) path.push([q[0], 0, q[2]]); path.push(p); }
  let seg = 0, t = 0; const SPEED = 1.55; let walked = 0;
  const worst = [0, 0], sum = [0, 0]; let frames = 0, far4 = 0; const nAngle: number[] = []; let nOpenedAt = NaN, firstManNorthAt = NaN;
  // WHERE DOORS OPEN ONE WAY (DOORWAY.oneWay, as the page has it) Sam walks the same path ON HIS OWN FEET: W held, the walk's forward turned onto the next
  // point of the path each frame (the walk keys' basis, written on the game's own seat camera for the walk and taken off after it: the heading is
  // the harness's, the step is his), his reticle 4 m ahead of him, at his own walking pace. Nothing places him and nothing works a door for him: a shut leaf in his way is opened by his body walking into it, pushed
  // or pulled, as a player's is. The harness carrying him through a shut leaf is a thing no player can do, and there it left the men to open both doors and
  // take their turns at them behind a Sam who had not slowed: the distance line then measured the harness. With the switch off the walk below is the
  // placed one, untouched.
  const feet = !!DOORWAY.oneWay; let lastAt = [...sam.pos];
  R.pre = feet ? () => {
    walked += dist(sam.pos, lastAt); lastAt = [...sam.pos];
    while (seg < path.length - 1 && dist(sam.pos, path[seg + 1]) < 0.15) seg++;
    if (seg >= path.length - 1) { R.input.keys.delete('KeyW'); return; }
    const b = path[seg + 1], dx = b[0] - sam.pos[0], dz = b[2] - sam.pos[2], l = Math.hypot(dx, dz) || 1; const fwd = [dx / l, 0, dz / l], right = [-fwd[2], 0, fwd[0]];
    g.seat.cam.planarBasis = () => ({ fwd, right }); R.input.keys.add('KeyW'); R.aim([sam.pos[0] + fwd[0] * 4, 0, sam.pos[2] + fwd[2] * 4]);
  } : () => {
    if (seg >= path.length - 1) return;
    let stepLeft = SPEED * DT;
    while (stepLeft > 0 && seg < path.length - 1) { const a = path[seg], b = path[seg + 1], L = dist(a, b); if (L - t <= stepLeft) { stepLeft -= L - t; seg++; t = 0; } else { t += stepLeft; stepLeft = 0; } }
    const a = path[seg], b = path[Math.min(seg + 1, path.length - 1)], L = dist(a, b) || 1, f = seg >= path.length - 1 ? 0 : t / L;
    g.teleportPlayer([a[0] + (b[0] - a[0]) * f, 0, a[2] + (b[2] - a[2]) * f]); walked += SPEED * DT;
  };
  const tWalk = g.time; let nAtSamCross = NaN;
  while (seg < path.length - 1 && g.time - tWalk < 90) {
    const zBefore = sam.pos[2]; R.step();
    if (zBefore >= 12.2 && sam.pos[2] < 12.2) nAtSamCross = Nd.angle;
    men.forEach((m: any, i: number) => { const d = dist(m.char.pos, sam.pos); worst[i] = Math.max(worst[i], d); sum[i] += d; if (d > 4) far4++; if (isNaN(firstManNorthAt) && m.char.pos[2] < 12.0) firstManNorthAt = g.time - tWalk; });
    if (isNaN(nOpenedAt) && Math.abs(Nd.angle) > 0.3) nOpenedAt = g.time - tWalk;
    frames++;
  }
  R.pre = null; const walkSecs = g.time - tWalk;
  if (feet) { R.input.keys.delete('KeyW'); delete g.seat.cam.planarBasis; walked += dist(sam.pos, lastAt); }
  R.until(() => men.every((m: any) => O.of(m)?.arrived), 8); R.step(60 * 2);
  const end = men.map((m: any) => dist(m.char.pos, sam.pos));
  const room = (p: number[]) => p[2] < 12.2 ? 'corridor' : p[0] > 28 ? 'break room' : 'cubicles';
  verdict(!noPath && seg >= path.length - 1, 'Sam\'s walk: 1.55 m/s along a nav path from the aisle, in at the west door, across the break room, out at the north door, along the corridor', noPath || `${f2(walked)} m in ${f2(walkSecs)} s · ended ${at(sam.pos)} (${room(sam.pos)})${feet ? ` · on his own feet, W held (${f2(walked / walkSecs)} m/s)` : ''}`);
  verdict(worst.every(d => d < 5) && far4 / (2 * frames) < 0.1, 'both men stay within a few metres of him the whole way', `furthest ${worst.map(f2).join(' / ')} m · mean ${sum.map(s => f2(s / frames)).join(' / ')} m · further than 4 m for ${f2(100 * far4 / (2 * frames))} % of the man-frames`);
  // (3.8 m, was 3.2: Sam stops beside the north door, and a place in the file that falls in its leaf's swing is slid back along the file — doorway.ts `swing`)
  verdict(end.every(d => d < 3.8) && men.every((m: any) => room(m.char.pos) === 'corridor') && men.every((m: any) => m.state !== 'dead'), 'they end beside him on the far side of both doors', `${end.map(f2).join(' / ')} m from Sam · ${men.map((m: any) => `${m.callsign} ${at(m.char.pos)} ${room(m.char.pos)}`).join(' · ')}`);
  verdict(!isNaN(firstManNorthAt) && (Math.abs(nAtSamCross) < 0.3 ? nOpenedAt > 0 : true), 'the north door: ' + (Math.abs(nAtSamCross) < 0.3 ? 'still shut behind Sam (the harness carried him through the leaf) — the men opened it themselves' : 'already open when the men reached it (Sam\'s body pushed it)'),
    `leaf angle as Sam crossed ${f2(nAtSamCross)} · open past 0.3 rad at ${f2(nOpenedAt)} s · first man through at ${f2(firstManNorthAt)} s · west door ${f2(Wd.angle)} rad`);
  verdict(!R.samHit, 'Sam was not hit', `hit ${R.samHit}`);
  if (VERBOSE) console.log('    path ' + path.filter((_, i) => i % 6 === 0).map(at).join(' '));
  return done();
});

export const ordersOne = guarded(async () => {
  const { verdict, done } = family('orders-one: an order to one man leaves the other alone');
  const R = await rig(11); const { game: g, O } = R; const [b1, b2] = O.squad(); const sam = g.player.char;
  R.step(30);
  const p2 = [...b2.char.pos];
  // (what Blue Two holds before any order of Sam's: nothing, where a staging leaves the men with none — and where the team starts fallen in, START.fallIn as
  //  the page has it, the unspoken 'fall in' he was staged on. Either way an order to Blue One alone must leave it exactly as it was.)
  const a2 = O.of(b2);
  R.key(ORDERS.whoKey); const who1 = O.who; const label1 = O.hud().status[0]?.label;
  R.quick(AISLE); const l1 = lastOrder(O);
  R.until(() => O.of(b1)?.arrived, 12); R.step(60);
  verdict(who1 === 0 && label1 === `squad · ${postureWord()}orders to Blue One` && l1?.order === 'move' && l1.who.join() === 'Blue One' && dist(b1.char.pos, AISLE) < 0.35 && dist(b2.char.pos, p2) < 0.05
    && (START.fallIn ? a2?.order === 'fallIn' && O.of(b2) === a2 && O.statusOf(b2) === 'with you' : O.of(b2) === null && O.statusOf(b2) === 'waiting'),
    START.fallIn ? 'T once = Blue One: "move there" moves him onto the point itself; Blue Two has not moved and is still on the fall-in the team started on, none of it touched' : 'T once = Blue One: "move there" moves him onto the point itself; Blue Two has not moved and has no order', `${label1} · ${logLine(l1)} · Blue One ${f2(dist(b1.char.pos, AISLE))} m off the point · Blue Two moved ${f2(dist(b2.char.pos, p2))} m, "${O.statusOf(b2)}"`);
  R.key(ORDERS.whoKey); const who2 = O.who; const p1 = [...b1.char.pos];
  R.pick(WEST, 2); const l2 = lastOrder(O); const w2 = O.of(b2)?.watch ?? [NaN, NaN, NaN]; R.until(() => O.of(b2)?.arrived, 4); R.step(60 * 3);
  const off2 = dist(w2, WEST) < 0.1 ? Math.abs(wrap(b2.char.aimYaw - yawTo(b2.char.pos, WEST))) : NaN;
  verdict(who2 === 1 && l2?.order === 'cover' && l2.who.join() === 'Blue Two' && off2 < 0.2 && O.of(b1)?.order === 'move' && dist(b1.char.pos, p1) < 0.05 && O.statusOf(b1).startsWith('in position'),
    'T again = Blue Two: "cover" turns him; Blue One keeps his own order and his spot', `orders to ${O.squad()[who2]?.callsign} · ${logLine(l2)} · Blue Two off it ${f2(off2)} rad · Blue One still "${O.statusOf(b1)}", moved ${f2(dist(b1.char.pos, p1))} m`);
  R.key(ORDERS.whoKey); const who3 = O.who;
  verdict(who3 === 'all', 'T a third time: back to all', `who ${who3}`);
  // the reticle on a teammate, with 'all' standing
  const q1 = [...b1.char.pos];
  R.quick(b2.char.pos); const l3 = lastOrder(O);
  R.until(() => O.of(b2)?.arrived, 10); R.step(60);
  verdict(l3?.order === 'fallIn' && l3.who.join() === 'Blue Two' && dist(b2.char.pos, sam.pos) < 3 && O.of(b1)?.order === 'move' && dist(b1.char.pos, q1) < 0.05, 'the cursor on Blue Two, the quick key: he alone falls in; Blue One stays on his spot',
    `${logLine(l3)} · Blue Two ${f2(dist(b2.char.pos, sam.pos))} m from Sam · Blue One moved ${f2(dist(b1.char.pos, q1))} m, "${O.statusOf(b1)}"`);
  // a man down drops out
  R.aim(AISLE_FAR); R.key(ORDERS.whoKey); const sel = O.who;   // (the cursor off Blue Two first: T on a man is that man)
  killGuard(g, b1, [1, 0, 0], true, 'shot', 'player'); R.step(30);
  const afterDeath = O.who; R.key(ORDERS.whoKey); const c1 = O.who; R.key(ORDERS.whoKey); const c2 = O.who;
  const st = O.hud().status[0];
  verdict(sel === 0 && afterDeath === 'all' && c1 === 1 && c2 === 'all' && O.of(b1) === null && /Blue One · down/.test(st?.opts[0].text ?? ''), 'Blue One picked, then down: the choice goes back to all, T skips him, the HUD says "down"', `who ${sel} → ${afterDeath} → T ${c1} → T ${c2} · "${st?.opts[0].text}"`);
  R.quick(AISLE); const l4 = lastOrder(O); R.until(() => O.of(b2)?.arrived, 12);
  verdict(l4?.order === 'move' && l4.who.join() === 'Blue Two' && dist(b2.char.pos, AISLE) < 0.4, 'an order to "all" now goes to the man left, onto the point itself', `${logLine(l4)} · ${f2(dist(b2.char.pos, AISLE))} m off the point`);
  { // the same with no order ever given (nothing for the men's tick to do): the chosen man dies → the next X still reaches the other
    const R2 = await rig(12); const O2 = R2.O; const [c1, c2] = O2.squad(); R2.step(30);
    R2.key(ORDERS.whoKey); const w0 = O2.who; killGuard(R2.game, c1, [1, 0, 0], true, 'shot', 'player'); R2.step(5); const w1 = O2.who; const lab = O2.hud().status[0]?.label;
    R2.quick(AISLE); const l5 = lastOrder(O2); R2.until(() => O2.of(c2)?.arrived, 12);
    verdict(w0 === 0 && w1 === 'all' && lab === `squad · ${postureWord()}orders to all` && l5?.order === 'move' && l5.who.join() === 'Blue Two' && dist(c2.char.pos, AISLE) < 0.4, 'the chosen man dies before any order was given: the choice still goes back to all and X reaches the other', `who ${w0} → ${w1} · "${lab}" · ${logLine(l5)}`);
  }
  return done();
});

export const ordersNightBreach = guarded(async () => {
  const { verdict, done } = family('orders-nightbreach: the order menu and the night breach\'s F hand the pair to each other');
  { // ---- set → an order calls it off → F again → going: refused → clear → fall in
    const R = await rig(11, { quiet: false }); const { game: g, O, NB } = R; const [b1, b2] = O.squad(); const men = [b1, b2]; const sam = g.player.char;
    const beat = (w: string) => { const b = NB.drill?.beats.find((x: any) => x.what === w); return b ? b.t : NaN; };
    R.step(60);
    R.key('KeyF'); const set = R.until(() => NB.state === 'set', 30); const stS = men.map((m: any) => O.statusOf(m));
    verdict(set && stS.every((s: string) => /^set · press F/.test(s)), 'F stacks the pair as before, and the HUD\'s squad block says so', `night breach ${NB.state} · "${stS.join('" / "')}"`);
    const dS = R.door('server_manager'); const tS = { kind: 'door', at: [dS.frameCentre[0], 0, dS.frameCentre[2]], door: dS, side: 1 };   // (the keypad door, from the far side of the floor: nobody can get to that face — and with ORDERS.workOut off, no floor at either jamb on it)
    const greyS = O.whyNot(O.defs.find((d: any) => d.id === 'stack'), tS); const whyS = O.give('stack', tS); R.step(30);
    verdict(!!greyS && !!whyS && NB.state === 'set' && O.log.length === 0, 'an order that cannot be carried out (a stack with no room at the door) is greyed on the menu with the reason, and trying it does not call the breach off', `the stack row on that door: "${greyS}" · give('stack') → ${whyS} · night breach ${NB.state}`);
    R.quick(AISLE); const l = lastOrder(O); const stateOff = NB.state;
    R.until(() => men.every((m: any) => O.of(m)?.arrived), 14); R.step(60 * 4);
    verdict(l?.order === 'move' && stateOff === 'staged' && NB.log.some((x: any) => x.what === 'order:off') && isNaN(beat('kick')) && men.every((m: any) => dist(m.char.pos, AISLE) < 2.55) && Math.abs(R.door('breakroom_w').angle) < 0.05,
      'an order while they are set calls the breach off: the pair leaves the door for the spot, nothing is kicked', `${logLine(l)} · night breach ${stateOff} · kick ${f2(beat('kick'))} · ${men.map((m: any) => f2(dist(m.char.pos, AISLE))).join(' / ')} m off the point · ${NB.summary()}`);
    R.key('KeyF'); R.step(5); const owned = men.map((m: any) => O.of(m));
    const set2 = R.until(() => NB.state === 'set', 30);
    verdict(set2 && owned.every((a: any) => a === null), 'F again: the drill takes the pair back (their orders dropped) and stacks them', `night breach ${NB.state} · orders left ${owned.filter(Boolean).length}`);
    R.key('KeyF'); R.step(20); const going = NB.state; const n = O.log.length;
    R.quick(sam.pos); const refusedLog = O.log.length === n; const stillOwned = men.every((m: any) => O.of(m) === null);
    const ended = R.until(() => NB.drill.phase === 'done', 45); R.step(60);
    verdict(going === 'going' && refusedLog && stillOwned && ended && NB.state === 'clear' && !isNaN(beat('kick')) && !isNaN(beat('bang')), 'once the breach is going an order is refused, and the breach runs on to "clear"', `at the order: ${going}, logged ${!refusedLog}, taken ${!stillOwned} · ended ${NB.state} · kick @${f2(beat('kick'))} bang @${f2(beat('bang'))} clear @${f2(beat('clear'))} · ${NB.summary()}`);
    const alive = men.filter((m: any) => m.state !== 'dead');
    R.quick(sam.pos); const l2 = lastOrder(O);
    const back = R.until(() => alive.every((m: any) => O.of(m)?.arrived), 25); R.step(60);
    verdict(alive.length === 2 && l2?.order === 'fallIn' && back && alive.every((m: any) => dist(m.char.pos, sam.pos) < 3.2), 'the room taken: "fall in" brings both men out of it to Sam', `${logLine(l2)} · ${alive.map((m: any) => `${m.callsign} ${f2(dist(m.char.pos, sam.pos))} m`).join(' · ')} · night breach ${NB.state}`);
    verdict(!R.samHit, 'Sam was not hit', `hit ${R.samHit}`);
  }
  { // ---- a recall once they are inside
    const R = await rig(11, { quiet: false }); const { game: g, O, NB } = R; const [b1, b2] = O.squad(); const men = [b1, b2]; const sam = g.player.char;
    R.step(60); R.key('KeyF'); R.until(() => NB.state === 'set', 30); R.key('KeyF');
    const inside = R.until(() => NB.state === 'inside', 30);
    R.quick(sam.pos); const l = lastOrder(O); const st = NB.state; let threw = '';
    try { R.step(60 * 12); } catch (e: any) { threw = String(e?.message ?? e); }
    const alive = men.filter((m: any) => m.state !== 'dead');
    verdict(inside && l?.order === 'fallIn' && st === 'recalled' && NB.drill.phase === 'done' && !threw && alive.every((m: any) => !!O.of(m)), 'an order once they are inside recalls them: the drill ends ("recalled"), the men are on Sam\'s order, the floor runs on',
      `${logLine(l)} · night breach ${st} · ${threw || 'no throw in 12 s'} · ${men.map((m: any) => `${m.callsign} ${m.state === 'dead' ? 'down' : `"${O.statusOf(m)}" ${f2(dist(m.char.pos, sam.pos))} m`}`).join(' · ')}`);
  }
  { // ---- a recall of ONE man: the drill is over for both — the other is not left a statue on its script
    const R = await rig(11, { quiet: false }); const { O, NB } = R; const [b1, b2] = O.squad(); const sam = R.game.player.char;
    R.step(60); R.key('KeyF'); R.until(() => NB.state === 'set', 30); R.key('KeyF'); R.until(() => NB.state === 'inside', 30);
    R.key(ORDERS.whoKey); R.quick(sam.pos); const l = lastOrder(O); R.step(30);
    verdict(l?.order === 'fallIn' && l.who.join() === 'Blue One' && NB.state === 'recalled' && !!O.of(b1) && O.of(b2) === null && (b2.state === 'dead' || (!b2.script && b2.hold && b2.pinned)),
      'one man recalled from inside: the drill ends for both, and the man with no order is handed to the fight AI where he stands (no script)', `${logLine(l)} · night breach ${NB.state} · Blue Two: ${b2.state}, script ${!!b2.script}, hold ${b2.hold}, pinned ${b2.pinned}, "${O.statusOf(b2)}"`);
  }
  { // ---- the drill 'failed' with a man up: he still takes orders
    const R = await rig(11); const { game: g, O, NB } = R; const [b1, b2] = O.squad(); const sam = g.player.char;
    R.step(60); R.key('KeyF'); R.until(() => NB.state === 'set', 30);
    killGuard(g, b1, [1, 0, 0], true, 'shot', 'player'); R.key('KeyF'); R.step(60 * 3);
    const st = NB.state, was = { script: !!b2.script, hold: b2.hold, pinned: b2.pinned, state: b2.state };
    R.quick(sam.pos); const l = lastOrder(O);
    const back = R.until(() => !!O.of(b2)?.arrived, 20); R.step(60 * 3);
    verdict(l?.order === 'fallIn' && l.who.join() === 'Blue Two' && back && dist(b2.char.pos, sam.pos) < 3.2 && !!b2.script && !!O.of(b2), 'the point man dead on the stack (the drill over): the survivor falls in on the order and stays on it',
      `night breach ${st} · before: script ${was.script} hold ${was.hold} pinned ${was.pinned} ${was.state} · ${logLine(l)} · Blue Two ${f2(dist(b2.char.pos, sam.pos))} m from Sam, "${O.statusOf(b2)}"`);
  }
  return done();
});

export const ordersSeams = guarded(async () => {
  const { verdict, done } = family('orders-seams: what the later parts build on');
  const R = await rig(11); const { game: g, O } = R; const [b1, b2] = O.squad(); const men = [b1, b2];
  R.step(30); R.quick(AISLE); R.until(() => men.every((m: any) => O.of(m)?.arrived), 12); R.step(30);
  // the fight layer's seam: Blue One's script ended 'alert' with eyes on somebody for two seconds (emulated: lastSeenT stamped), then nothing
  const post = [...O.of(b1).post]; endGuardScript(b1, 'alert');
  let scripted = 0, pinned = 0, n = 0; const words = new Set<string>();
  for (let i = 0; i < 120; i++) { b1.lastSeenT = g.time; R.step(); n++; if (b1.script) scripted++; if (b1.pinned) pinned++; words.add(O.statusOf(b1)); }
  const dHot = dist(b1.char.pos, post), stateHot = b1.state;
  const retaken = R.until(() => !!b1.script, 6); const tCold = g.time - b1.lastSeenT; R.until(() => !!O.of(b1)?.arrived, 6); R.step(30);
  verdict(scripted === 0 && pinned === n && words.size === 1 && words.has('in contact') && dHot < 0.5 && stateHot === 'alert', 'a man the fight AI has (script ended, alert, eyes on): orders leave him to it, rooted on his post, the HUD says "in contact"',
    `two seconds: scripted ${scripted}/${n} frames, pinned ${pinned}/${n} · "${[...words].join('", "')}" · ${f2(dHot)} m off his post · ${stateHot}`);
  verdict(retaken && tCold >= ORDERS.coldSecs - 0.05 && tCold < ORDERS.coldSecs + 0.2 && O.of(b1)?.order === 'move' && dist(b1.char.pos, post) < 0.35 && O.statusOf(b1).startsWith('in position') && O.of(b2)?.arrived === true,
    'his contact cold: he is back on his order, on his post', `re-taken ${f2(tCold)} s after the last sighting (coldSecs ${ORDERS.coldSecs}) · ${f2(dist(b1.char.pos, post))} m off his post · "${O.statusOf(b1)}" · state ${b1.state}`);
  // an owner that refuses keeps its men; one that lets go loses them (direct give(): this is the module's API, not the keys)
  let asked = 0; const owner = { name: 'test', owns: (gd: any) => gd === b2, release: (_: any) => { asked++; return 'busy — test owner'; }, status: () => 'owned by the test' };
  O.owners.push(owner); R.step(2);
  const dropped = O.of(b2) === null, st2 = O.statusOf(b2); const p2 = [...b2.char.pos];
  const why = O.give('move', O.targetAt(AISLE_FAR), 1); R.step(60);
  const whyAll = O.give('move', O.targetAt(AISLE_FAR), 'all'); R.step(60 * 3);
  O.owners.splice(O.owners.indexOf(owner), 1);
  verdict(dropped && st2 === 'owned by the test' && why === 'busy — test owner' && whyAll === null && asked === 2 && dist(b2.char.pos, p2) < 0.05 && O.of(b1)?.order === 'move' && dist(b1.char.pos, post) > 1,
    'another owner of a man (a drill): his order is dropped while it has him, its words are his HUD line, an order asks it to let go and a refusal stands — for him only', `dropped ${dropped} · "${st2}" · to him: ${why} · to all: ${whyAll ?? 'given'} (asked ${asked}×) · Blue Two moved ${f2(dist(b2.char.pos, p2))} m · Blue One "${O.statusOf(b1)}"`);
  // a show takes the floor
  O.give('hold', O.targetAt(g.player.char.pos), 'all'); R.step(5); const had = men.filter((m: any) => O.of(m)).length;
  g.touring = true; R.input.pressed.add(ORDERS.key); R.step(3); const left = men.filter((m: any) => O.of(m)).length; const hud = O.hud(); g.touring = false;
  verdict(had === 2 && left === 0 && !hud.menu && hud.status.length === 0, 'a show takes the floor (touring): every order is dropped, X is dead, the HUD block is gone', `orders ${had} → ${left} · hud rows ${hud.status.length}`);
  return done();
});


export const ordersEdges = guarded(async () => {
  const { verdict, done } = family('orders-edges: what cannot be done is refused aloud, and the men keep clear of Sam');
  const R = await rig(11); const { game: g, O, NB, input } = R; const [b1, b2] = O.squad(); const men = [b1, b2]; const sam = g.player.char;
  const def = (id: string) => O.defs.find((d: any) => d.id === id);
  R.step(30);
  // (a) a floor spot no path leads to (found by scanning the nav grid — called directly: the cursor cannot be put on a spot chosen this way)
  let island: number[] | null = null;
  for (let z = 4.75; z < 24 && !island; z += 0.5) for (let x = 4.75; x < 36 && !island; x += 0.5) if (!g.col.nav.isBlocked(x, z) && !g.col.nav.findPath(b1.char.pos, [x, 0, z])) island = [x, 0, z];
  if (island) {
    // ('nobody sets off' = each man is left exactly as the refused order found him: with no order where a staging gives none, and where the team starts
    //  fallen in — START.fallIn, as the page has it — still on that same fall-in, not one dealt anew)
    const had = men.map((m: any) => O.of(m));
    const tI = { kind: 'floor', at: island }; const t0 = g.time; const grey = O.whyNot(def('move'), tI); const why = O.give('move', tI); R.step(20);
    verdict(/can't get there/.test(grey ?? '') && !!why && O.log.length === 0 && R.lines(/can't get there/, t0).length === 1 && men.every((m: any, i: number) => had[i] ? O.of(m) === had[i] && had[i].order === 'fallIn' : !O.has(m)), 'move there onto floor no path reaches: the row is greyed, the order is refused, a man says why, nobody sets off',
      `free floor with no way to it at ${at(island)} · row: "${grey}" · give → ${why} · said: ${R.lines(/./, t0).map(l => `${l.who} "${l.text}"`).join(' ')}`);
  } else verdict(false, 'a free floor cell with no path to it exists in the office', 'none found');
  // (b) a door locked against Sam: the squad carries no keys of its own
  const locked = g.doors.list.filter((d: any) => d.locked && d.latched);
  let lockLine = 'no locked door whose room has no other way in'; let lockOk = false;
  // (ORDERS.walkTries, on in the page: a door nobody has tried is walked up to, not refused — probes.ts move-walktries has that. This line is the refusal
  //  itself, the lock read against Sam's ring: asked with the key held off, as the door would answer once a hand had been on it)
  const walkTries = ORDERS.walkTries; ORDERS.walkTries = false;
  try { for (const d of locked) {
    const th = d.def.closedDir, n = [-Math.sin(th) * -d.keySide, 0, Math.cos(th) * -d.keySide];   // into the room: away from the keyed face
    const inside = O.freeSpot([d.frameCentre[0] + n[0] * 1.6, 0, d.frameCentre[2] + n[2] * 1.6]); if (!inside) continue;
    const tL = { kind: 'floor', at: inside }; const grey = O.whyNot(def('move'), tL); if (!/locked/.test(grey ?? '')) continue;
    g.player.keys.add(d.lockId); const withKey = O.whyNot(def('move'), tL); g.player.keys.delete(d.lockId);
    lockOk = withKey === null; lockLine = `${d.def.name}: a spot behind it at ${at(inside)} → "${grey}" · with its key on Sam's ring → ${withKey === null ? 'offered' : `"${withKey}"`}`; break;
  } } finally { ORDERS.walkTries = walkTries; }
  verdict(lockOk, 'move there through a door locked against Sam is refused with the door named; with the key on his ring it is offered', lockLine);
  // (c) the fixed digits, and a greyed row on the panel
  R.openX(sam.pos, 0.4); const keysN = (O.hud().menu?.rows ?? []).slice(1, 3).map((r: any) => `${r.opts[0]?.key} ${r.opts[0]?.text}`); R.esc();
  R.openX(AISLE, 0.4); const keysF = (O.hud().menu?.rows ?? []).slice(1, 5).map((r: any) => `${r.opts[0]?.key} ${r.opts[0]?.text}`);
  // (d) the page losing focus takes the list down with no order; Space under the open list gives the highlighted row and is not the Space selector's press
  const nLog = O.log.length;
  input.pressed.add('Blur'); R.step(); const blurGone = O.menu === null && O.log.length === nLog; R.step(10);
  R.openX(AISLE, 0.3); input.wheel += 100; R.step(); const selRow = O.menu?.sel; input.pressed.add('Space'); R.step(); const selDown = g.player.sel.downT; const spaceGave = lastOrder(O); const spaceN = O.log.length - nLog;
  verdict(keysN.join(' | ') === '3 fall in | 4 hold position' && keysF.join(' | ') === '1 move there | 2 cover that way | 3 fall in | 4 hold position', 'the digits are the same on every target: fall in is 3 and hold is 4 with or without a target\'s own orders above them', `on Sam: ${keysN.join(' | ')} · on the floor: ${keysF.join(' | ')}`);
  verdict(blurGone && selRow === 1 && selDown < 0 && O.menu === null && spaceN === 1 && spaceGave?.order === 'cover', 'the page losing focus takes the list down with no order; Space under the open list gives the highlighted row (wheel to row 2: cover) and does not arm the Space selector', `after the blur: menu gone, no order ${blurGone} · highlight ${selRow} · Space → ${logLine(spaceGave)} (${spaceN} order) · selector down-time ${selDown}`);
  // (e) Sam in the line of a man's gun: the muzzle comes down until he is clear
  const p1 = b1.char.pos; const through: number[] = [p1[0] + (sam.pos[0] - p1[0]) * 3, 0, p1[2] + (sam.pos[2] - p1[2]) * 3];
  O.give('cover', { kind: 'floor', at: through }, 0); R.step(60); const upIn = b1.script?.upper, stIn = b1.script?.stance, lowIn = O.of(b1)?.low;
  const samWas = [...sam.pos]; g.teleportPlayer([samWas[0] + 2.2, 0, samWas[2] - 1.5]); R.step(60); const upOut = b1.script?.upper, lowOut = O.of(b1)?.low;
  verdict(lowIn === true && upIn === 'none' && stIn === 'lowReady' && lowOut === false && upOut === 'aim', 'cover ordered straight through Sam: the man faces it with his muzzle down, and brings the gun up once Sam has stepped out of the line', `Sam in the line: upper ${upIn}, stance ${stIn} · Sam clear: upper ${upOut}`);
  g.teleportPlayer(samWas); R.step(10);
  // (f) fall in, then Sam walks out and doubles straight back along his own trail: the file gets out of his way
  O.give('fallIn', { kind: 'none', at: [...sam.pos] }, 'all'); R.until(() => men.every((m: any) => O.of(m)?.arrived), 10); R.step(30);
  const out = g.col.nav.findPath(sam.pos, AISLE_FAR) ?? [];
  const route: number[][] = [[sam.pos[0], 0, sam.pos[2]], ...out.map((q: number[]) => [q[0], 0, q[2]]), AISLE_FAR];
  const back = [...route].reverse().slice(1); const whole = [...route, ...back.slice(0, Math.max(1, back.length - 2))];
  let seg = 0, t = 0; const SPEED = 1.55; let turnedAt = -1; let minBack = Infinity, minOut = Infinity;
  R.pre = () => { if (seg >= whole.length - 1) return; let left = SPEED * DT;
    while (left > 0 && seg < whole.length - 1) { const a = whole[seg], b = whole[seg + 1], L = dist(a, b); if (L - t <= left) { left -= L - t; seg++; t = 0; } else { t += left; left = 0; } }
    const a = whole[seg], b = whole[Math.min(seg + 1, whole.length - 1)], L = dist(a, b) || 1, f = seg >= whole.length - 1 ? 0 : t / L; g.teleportPlayer([a[0] + (b[0] - a[0]) * f, 0, a[2] + (b[2] - a[2]) * f]); };
  const tW = g.time;
  while (seg < whole.length - 1 && g.time - tW < 60) { R.step(); const d = Math.min(...men.map((m: any) => dist(m.char.pos, sam.pos))); if (seg >= route.length - 1) { if (turnedAt < 0) turnedAt = g.time - tW; minBack = Math.min(minBack, d); } else minOut = Math.min(minOut, d); }
  R.pre = null; R.step(90); const endD = men.map((m: any) => dist(m.char.pos, sam.pos));
  verdict(turnedAt > 0 && minBack > 0.55 && endD.every(d => d < 3.5), 'Sam walks 11 m out along the aisle and straight back the way he came: no man is ever within arm\'s reach of him on the way back, and the file is still with him at the end', `nearest a man came to Sam on the way out ${f2(minOut)} m · on the way back ${f2(minBack)} m · at the end ${endD.map(f2).join(' / ')} m`);
  // (g) the file closes up when the man ahead is taken off it
  const first = men.find((m: any) => O.of(m)?.follow === 0), second = men.find((m: any) => m !== first);
  const dSecond0 = dist(second.char.pos, sam.pos); O.give('hold', { kind: 'none', at: [...first.char.pos], man: first }); R.step(1);
  const rank = O.of(second)?.follow; g.teleportPlayer([sam.pos[0] - 3, 0, sam.pos[2]]); R.step(60 * 5); const dSecond1 = dist(second.char.pos, sam.pos);
  verdict(rank === 0 && O.of(first)?.order === 'hold' && dSecond1 < 2.0, 'the first man in the file is told to hold: the man behind him takes the first place behind Sam', `${second.callsign}'s place in the file ${rank} · he was ${f2(dSecond0)} m from Sam, after Sam moved on ${f2(dSecond1)} m`);
  // (g2) Sam leans 1.4 m out and comes back: nobody follows the lean
  O.give('fallIn', { kind: 'none', at: [...sam.pos] }, 'all'); R.until(() => men.every((m: any) => O.of(m)?.arrived), 10); R.step(60);
  { const o = [...sam.pos]; const away = men.reduce((a: number[], m: any) => [a[0] + o[0] - m.char.pos[0], 0, a[2] + o[2] - m.char.pos[2]], [0, 0, 0]); const L = Math.hypot(away[0], away[2]) || 1; const u = [away[0] / L, 0, away[2] / L];   // straight away from the men
    const along = (q: number[]) => (q[0] - o[0]) * u[0] + (q[2] - o[2]) * u[2]; const before = men.map((m: any) => along(m.char.pos)); let x = 0, dirn = 1, peak = -Infinity;
    R.pre = () => { if (dirn === 0) return; x += dirn * 1.55 * DT; if (x >= 1.4) dirn = -1; if (x <= 0 && dirn < 0) { x = 0; dirn = 0; } g.teleportPlayer([o[0] + u[0] * x, 0, o[2] + u[2] * x]); };
    for (let i = 0; i < 60 * 6; i++) { R.step(); peak = Math.max(peak, ...men.map((m: any) => along(m.char.pos))); } R.pre = null;
    const after = men.map((m: any) => along(m.char.pos));
    verdict(peak < 0.5 && after.every(a => a < 0.1), 'Sam steps 1.4 m out from where he stood and back again: no man ends up out past him (the trail of the lean is not somewhere to stand)', `along the lean (Sam's spot = 0): the men before ${before.map(f2).join(' / ')} m · furthest out any man got ${f2(peak)} m · after ${after.map(f2).join(' / ')} m`);
  }
  // (g3) the men take turns answering, each through both lines
  { const t0 = g.time; for (let k = 0; k < 4; k++) { O.give('fallIn', { kind: 'none', at: [...sam.pos] }, 'all'); R.step(20); }
    const by = (who: string) => [...new Set(R.lines(/on you|with you/, t0).filter(l => l.who === who).map(l => l.text))].sort().join(' + ');
    verdict(men.every((m: any) => by(m.callsign) === 'on you. + with you.'), 'four orders in a row: each man answers twice, once with each line', men.map((m: any) => `${m.callsign}: ${by(m.callsign)}`).join(' · ')); }
  // (g4) a mark no path reaches, handed over directly (the menu would have refused it): he stops trying, says so, and the mark comes to him
  if (island) { const t0 = g.time; O.newGroup(); O.assign(b1, { order: 'move', post: [...island], face: 0, going: 'moving', there: 'in position' }); const got = R.until(() => !!O.of(b1)?.arrived, 20);
    verdict(got && O.statusOf(b1) === 'stopped short' && R.lines(/can't get through/, t0).length === 1 && g.time - t0 < ((await import(`${ROOT}/src/game/teampace.ts`)).TEAMPACE.on ? 16 : 12), 'a man sent at a mark he cannot reach gives up within seconds, says so once, and stands where he got to', `"${O.statusOf(b1)}" after ${f2(g.time - t0)} s · said: ${R.lines(/can't/, t0).map(l => `${l.who} "${l.text}"`).join(' ')} · ${f2(dist(b1.char.pos, island))} m from the mark`); }
  // (g5) the short way is through a locked door but another way round is open: the order is offered and the men go round
  { const Rr = await rig(11); const { game: gr, O: Or } = Rr; const mm = Or.squad(); Rr.step(30);
    let line = 'no locked door with an open way round was found'; let ok = false;
    for (const d of gr.doors.list.filter((x: any) => x.locked && x.latched)) {
      const th = d.def.closedDir, n = [-Math.sin(th) * -d.keySide, 0, Math.cos(th) * -d.keySide]; const inside = Or.freeSpot([d.frameCentre[0] + n[0] * 1.6, 0, d.frameCentre[2] + n[2] * 1.6]); if (!inside) continue;
      const others = gr.doors.list.filter((x: any) => x !== d && x.locked); const was = others.map((x: any) => x.locked); others.forEach((x: any) => { x.locked = false; });   // every other lock picked
      const r = Or.route(mm[0], inside);
      if (r.why || !r.via.length) { others.forEach((x: any, i: number) => { x.locked = was[i]; }); continue; }
      const why = Or.give('move', { kind: 'floor', at: inside }, 0); let swung = 0; const t0 = gr.time;
      const got = Rr.until(() => { swung = Math.max(swung, Math.abs(d.angle)); return !!Or.of(mm[0])?.arrived; }, 40);
      ok = why === null && got && swung < 0.05 && dist(mm[0].char.pos, inside) < 0.6; line = `${d.def.name} locked, the other locks picked: a spot behind it at ${at(inside)} → offered, ${r.via.length} waypoints round · ${mm[0].callsign} there in ${f2(gr.time - t0)} s, ${f2(dist(mm[0].char.pos, inside))} m off it · the locked leaf swung ${f2(swung)} rad`; break;
    }
    verdict(ok, 'a spot whose short way in is a locked door but which has another way round: move there is offered, the man goes round, and the locked leaf never opens', line); }
  // (h) the fight seam's clock: handed over with no sighting on record he is still left alone for the cold time, and gunfire in his ear keeps him in it
  O.give('hold', { kind: 'none', at: [...b2.char.pos], man: b2 }); R.step(30);
  const lease = { yielded: 0, retaken: 0 }; O.fight = { yielded: () => { lease.yielded++; }, retaken: () => { lease.retaken++; } };
  b2.lastSeenT = -1000; endGuardScript(b2, 'alert'); const tY = g.time; R.until(() => !!b2.script, 6); const leftFor = g.time - tY;
  endGuardScript(b2, 'alert'); const tS = g.time; R.pre = () => { if (g.time - tS < 4) b2.witness.heard.lastShotT = g.time; }; R.until(() => !!b2.script, 12); R.pre = null; const withShots = g.time - tS;
  O.fight = null;
  verdict(leftFor > ORDERS.coldSecs - 0.2 && leftFor < ORDERS.coldSecs + 0.5 && withShots > 4 + ORDERS.coldSecs - 0.3 && O.of(b2)?.order === 'hold' && lease.yielded === 2 && lease.retaken === 2, 'a man handed to the fight AI with no sighting on record is left to it for the cold time, and for as long as shots keep reaching his ear; the lease is told of each hand-over and each return, in pairs', `no sighting: taken back after ${f2(leftFor)} s (cold time ${ORDERS.coldSecs}) · shots heard for 4 s: after ${f2(withShots)} s · lease yielded ${lease.yielded}, retaken ${lease.retaken}`);
  // (i) one man ordered off a breach stack that is still forming: the other does not walk on to the door alone
  const R2 = await rig(11); const { game: g2, O: O2, NB: NB2 } = R2; const [c1, c2] = O2.squad();
  R2.step(60); R2.key('KeyF'); R2.step(60); const st = NB2.state;
  const chest: number[] = [c1.char.pos[0], 1.2, c1.char.pos[2]]; R2.quick(chest); const l2 = lastOrder(O2); const c2At = [...c2.char.pos]; R2.step(60 * 4);
  const c2Moved = dist(c2.char.pos, c2At);
  verdict(st === 'stacking' && l2?.order === 'fallIn' && l2.who.length === 1 && NB2.state === 'staged' && c2Moved < 0.6 && c2.speed < 0.1, 'the pair is on its way to the breach stack and one man is ordered to fall in: the breach is off and the other man stops where he is', `night breach ${st} → ${NB2.state} · ${logLine(l2)} · ${c2.callsign} moved ${f2(c2Moved)} m in the next 4 s, "${O2.statusOf(c2)}"`);
  return done();
});
