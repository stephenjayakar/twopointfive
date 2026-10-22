// HIS OWN ACTIONS ARE A RING THAT STAYS — the check behind HANDRING.on (src/game/handring.ts; the rule in interact.ts updateInteract, the whistle's row in
// player.ts buildInteractables) and the page's board for it (src/host/keymap.ts `handWhen`, HAND). ON in the page (?handring=0 = the list on a held Space,
// the whistle on its key, as it was), OFF in the module and on the frozen stand (TPS_HANDRING=1).
//   bun run tools/qa/probes.ts handring        (family `player`)        HANDRING_BREAK=1 = the rule and the board's layer left off and the same lines asked: must FAIL
// the maintainer, 10-22: "radial menu for our own actions, remove existing menu in top left and awkward scrolling thing", "move whistle to our actions and
// remove v binding", "move our actions to E", "i think same would go for our actions (1-5 with the ring open)".
// WHAT IS ASKED:
//   the tap       at a door a tap does the top row (the leaf moves) and puts no ring up; on open floor a tap does nothing (the whistle is never a tap)
//                 but say so, once: 'nothing in reach' (the key looked dead); a second tap straight after says no more, and with the rule off none is said
//   beside a thing a tap that finds no row beside a thing names the thing and why (handring.ts `near`; the maintainer on the stealth mission: "nothing in
//                 reach to close the door?"): a stride short of a door 'door · step closer', every tap (one line of it in the log); on the quiet tutorial mission, at the open back
//                 door with shutting a leaf taken off its frame's rows (as it was when he played it), 'door · not in this mission' (from a step short of it too); sprinting inside a door's reach 'door · stop sprinting'; a second tap with
//                 the leaf in his hand 'door · not now'; open floor, a door behind a wall and a door with a living man nearer still 'nothing in
//                 reach'; `near` off, the old word everywhere
//   the ring      the key kept down: nothing before HANDRING.holdSecs, then the ring with a wedge for the door's row and the whistle on the LAST wedge; let
//                 go in the middle and it stays with no key held; his feet are his own under it
//   early         a digit pressed with the key down and the ring not yet up (inside the hold) is its wedge at once, never the slot or the gun's setup
//   a digit       standing, the last wedge's digit whistles at once and the ring is gone — and it was no weapon slot; a digit with no wedge does nothing
//                 and the ring stays; the whistle's digit, or a click, before the breath is back lights it and the ring stays
//   a click       standing, with the pistol up: a left click does the lit wedge and no round leaves the gun
//   the cursor    the key kept down, the cursor out toward the last wedge the moment the ring is up, the key let go: that wedge is done (no second press)
//   under it      a ring that merely stands is nothing in hand: the wheel is his pace, the squad's key is free, a save is allowed
//   a save        a save kept in memory under a standing ring is put back with no ring (savestate.ts loadMem): his first click after is his own
//   put away      the key again does the lit wedge; a right click puts the ring away with nothing done; so does the back key
//   the rows      the whistle is a wedge and no row: the list and the highlight are as they were (nothing that reads them meets it); on open floor the
//                 ring is that one wedge; the whistle's old code still whistles (a recording, a check)
//   off           the rule off: the held key opens the list as it did (no ring), the digits are his slots
//   the board     while the page says so (and empty hands are a slot): the E key gives the interaction's code, the Space key and the V key give nothing,
//                 'Space  open' reads 'E  open' and 'E puts it away' still reads as the slot's key; without the slot, or with the rule off, Space and V are
//                 itself and V still gives nothing (the whistle is the ring's with or without the slot); the whistle's row can be given a key; a
//                 lesson's line for the whistle reads in the ring's words
//   recordings    a recording carries the switch; one from before it replays with it off; the frozen stand holds it off by name
// Headless: rows, the ring's view, what was done. The corner's one line and the ring as drawn are the page's (never seen on a GPU). NOBODY HAS PLAYED IT.
import { ROOT } from './headless.ts';
import { world } from './wallsnap-probes.ts';
export async function handRingCheck(): Promise<boolean> {
  const BRK = process.env.HANDRING_BREAK === '1'; let all = true;
  const verdict = (ok: boolean, what: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}\n    ${detail}`); };
  console.log(`\n=== handring: his own actions are a ring that stays${BRK ? ' (the rule and the board\'s layer off: must fail)' : ''} ===`);
  const { HANDRING } = await import(`${ROOT}/src/game/handring.ts`); const { HANDSLOT } = await import(`${ROOT}/src/game/handslot.ts`); const { CMDRING } = await import(`${ROOT}/src/game/cmdring.ts`);
  const { WALLSNAP } = await import(`${ROOT}/src/game/wallsnap.ts`); const { handRingView } = await import(`${ROOT}/src/game/interact.ts`);
  const { WHISTLE_STATS, WHISTLE } = await import(`${ROOT}/src/game/whistle.ts`); const { BACKKEY } = await import(`${ROOT}/src/game/backkey.ts`);
  const { knobsSnapshot, applyKnobs } = await import(`${ROOT}/src/game/journal.ts`); const { FROZEN_HOLDS } = await import(`${ROOT}/src/host/profile.ts`);
  const K = await import(`${ROOT}/src/host/keymap.ts`);
  const { playerBusy } = await import(`${ROOT}/src/game/savestate.ts`);
  const was = { on: HANDRING.on, early: HANDRING.early, empty: HANDRING.empty, near: HANDRING.near, back: BACKKEY.tab, slot: HANDSLOT.on, cmd: CMDRING.on, hands: CMDRING.hands, ws: WALLSNAP.on, press: WALLSNAP.press, kOn: K.KEYMAP.on, slotWhen: K.KEYMAP.slotWhen, handWhen: K.KEYMAP.handWhen, qFree: K.KEYMAP.qFree, qCmd: K.KEYMAP.qCmd };
  const log = console.log, err = console.error, warn = console.warn;
  const quiet = async <T>(f: () => T | Promise<T>): Promise<T> => { console.log = console.error = console.warn = () => { }; try { return await f(); } finally { console.log = log; console.error = err; console.warn = warn; } };
  const G: any = globalThis, hadLS = G.localStorage; const store = new Map<string, string>();
  G.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, String(v)); }, removeItem: (k: string) => { store.delete(k); } };
  try {
    const S = await quiet(() => world(true)); const { pl, g, step, tap, place, input, click, keys, setCursor } = S as any; WALLSNAP.press = false; CMDRING.on = false; CMDRING.hands = false; BACKKEY.tab = true;   // (the back key is Tab, as the page has it)
    const rule = (on: boolean) => { HANDRING.on = HANDRING.early = HANDRING.empty = HANDRING.near = on && !BRK; };
    const KEY = 'Space', LAST = CMDRING.wedges, HOLD = Math.ceil(HANDRING.holdSecs * 60);
    const door = g.doors.list.find((d: any) => d.def.name === 'conference'), fc = door.frameCentre;
    const rows = () => g.nearby.map((r: any) => `${r.kind}:${r.verb ?? '-'}`).join(' | ') || 'none';
    const view = () => { const v = handRingView(g); return v ? `ring [${v.wedges.map((w: any) => `${w.key} ${w.text}`).join(' · ')}] lit ${v.lit}${pl.sel.ring?.free ? ' standing' : ''}` : 'no ring'; };
    const up = () => !!handRingView(g), standing = () => !!pl.sel.ring?.free && pl.sel.open;
    const down = (n: number) => { input.pressed.add(KEY); input.keys.add(KEY); step(n); }, lift = (n = 2) => { input.keys.delete(KEY); step(n); };
    /** the ring up and standing: the key kept down past the hold, let go with the cursor in its middle */
    const stand = () => { down(HOLD + 4); lift(); };
    const breath = () => step(Math.ceil(WHISTLE.cooldown * 60) + 10);   // (the whistle's breath back)
    const floor = (kit: 'pistol' | 'rifle' | 'empty' = 'empty') => place(30, 2.4, 180, kit), atDoor = () => place(fc[0], fc[2] + 1.0, 180);
    const leaf = () => door.angle as number;
    // ---- the tap
    { rule(true); atDoor(); const r0 = rows(), a0 = leaf(), top = g.hover?.verb; tap(KEY); step(1); const noRing = !up(); step(40); const moved = Math.abs(leaf() - a0) > 0.05;
      const words = () => g.messages.filter((m: any) => m.text === 'nothing in reach').length as number;
      rule(false); floor(); g.messages.length = 0; tap(KEY); step(20); const offWord = words(); rule(true);
      floor(); const r1 = rows(), b0 = WHISTLE_STATS.blown; g.messages.length = 0; tap(KEY); step(20); const quietTap = WHISTLE_STATS.blown === b0, word1 = words(); tap(KEY); step(20); const word2 = words();
      verdict(moved && noRing && quietTap && r1 === 'none' && word1 === 1 && word2 === 1 && offWord === 0, 'a tap does the top row and puts no ring up; on open floor a tap does nothing (the whistle is never a tap) but say so, once',
        `at the door [${r0}], the tap's row ${top}: the leaf ${a0.toFixed(2)} → ${leaf().toFixed(2)}, ring ${!noRing} · open floor [${r1}]: a tap blew ${WHISTLE_STATS.blown - b0}, 'nothing in reach' said ${word1}, after a second tap ${word2} · the rule off: said ${offWord}`); }
    // ---- the ring
    { rule(true); atDoor(); down(HOLD - 4); const early = up(); step(8); const v1 = view(), V = handRingView(g), hasDoor = !!V?.wedges.some((w: any) => w.key === 1), hasWhistle = !!V?.wedges.some((w: any) => w.key === LAST && /whistle/.test(w.text));
      lift(); const stays = standing(), v2 = view(); const z0 = pl.char.pos[2]; keys('KeyW'); step(30); keys(); const walked = Math.abs(pl.char.pos[2] - z0) > 0.2, still = standing(); tap('Tab'); step(2);
      verdict(!early && hasDoor && hasWhistle && stays && walked && still, 'the key kept down puts the ring up after the hold, the whistle on the last wedge; let go in the middle it stays; he can walk under it',
        `before the hold: ring ${early} · after: ${v1} · let go: ${v2} · W for half a second under it moved him ${Math.abs(pl.char.pos[2] - z0).toFixed(2)} m, the ring still standing ${still}`); }
    // ---- a digit inside the hold
    { rule(true); floor('pistol'); breath(); const s0 = pl.slot, b0 = WHISTLE_STATS.blown; down(6); const notYet = !up(); tap(`Digit${LAST}`); step(2); const blew = WHISTLE_STATS.blown - b0, kept = pl.slot === s0 && !pl.holstered && !pl.setup, gone = !up(); lift(); step(4);
      atDoor(); place(fc[0], fc[2] + 1.0, 180, 'pistol'); step(4); const two = g.nearby[1]?.verb; down(6); tap('Digit1'); step(2); const noSetup = !pl.setup && pl.slot === 'pistol'; lift(); step(4); tap('Tab'); step(2);
      HANDRING.early = false; floor('pistol'); breath(); const b1 = WHISTLE_STATS.blown; down(6); tap(`Digit${LAST}`); step(2); const old = WHISTLE_STATS.blown === b1; lift(); step(4); tap('Tab'); step(2);
      verdict(notYet && blew === 1 && kept && gone && noSetup && old, 'a digit pressed with the key down and the ring not yet up is the ring\'s wedge at once, never the weapon slot or the gun\'s setup; with that off it is not the ring\'s',
        `0.1 s into the hold: no ring yet ${notYet} · ${LAST} then: whistled ${blew}, the pistol still in hand and no setup ${kept}, the ring gone ${gone} · at the door (second row ${two}), the pistol's own digit inside the hold: no setup opened ${noSetup} · early off: ${LAST} whistled nothing ${old}`); }
    // ---- a digit
    { rule(true); floor('pistol'); breath(); stand(); const s0 = pl.slot, b0 = WHISTLE_STATS.blown; tap('Digit3'); step(3); const none = up() && WHISTLE_STATS.blown === b0 && pl.slot === s0;
      tap(`Digit${LAST}`); step(3); const blew = WHISTLE_STATS.blown - b0, gone = !up(), slot = pl.slot === s0 && !pl.holstered;
      stand(); tap(`Digit${LAST}`); step(3); const grey = up() && WHISTLE_STATS.blown - b0 === 1, canSave = !/choosing/.test(String(g.saves?.why?.() ?? '')); click(); step(3); const greyClick = up() && WHISTLE_STATS.blown - b0 === 1; tap('Tab'); step(2); void canSave;
      verdict(none && blew === 1 && gone && slot && grey && greyClick, 'standing, a digit does its wedge at once and is no weapon slot; a digit with no wedge does nothing; a wedge that cannot be done now is lit and the ring stays',
        `3 (no wedge): the ring up ${none} · ${LAST}: whistled ${blew}, the ring gone ${gone}, the pistol still in hand ${slot} · ${LAST} again before the breath is back: the ring stays, nothing blown ${grey} · a click then: the same ${greyClick}`); }
    // ---- a click
    { rule(true); floor('pistol'); breath(); stand(); const b0 = WHISTLE_STATS.blown, r0 = pl.pistol.mag + (pl.pistol.chamber ? 1 : 0), lit = handRingView(g)?.lit; click(); step(6); const r1 = pl.pistol.mag + (pl.pistol.chamber ? 1 : 0);
      verdict(WHISTLE_STATS.blown - b0 === 1 && r1 === r0 && !up() && lit === LAST, 'standing, a left click does the lit wedge and no round leaves the gun',
        `lit ${lit} · the click whistled ${WHISTLE_STATS.blown - b0} · rounds ${r0} → ${r1} · the ring gone ${!up()}`); }
    // ---- the cursor
    { rule(true); atDoor(); breath(); const a0 = leaf(), b0 = WHISTLE_STATS.blown; setCursor(null); down(HOLD + 2); const R = pl.sel.ring, lit0 = handRingView(g)?.lit;   // (the cursor goes out the moment the ring is up: the hold was the wait)
      const ang = (-90 + (LAST - 1) * 360 / LAST) * Math.PI / 180; if (R) { input.mouseX = R.ax + Math.cos(ang) * 70; input.mouseY = R.ay + Math.sin(ang) * 70; } step(3); const lit1 = handRingView(g)?.lit; lift(3);
      verdict(lit0 === 1 && lit1 === LAST && WHISTLE_STATS.blown - b0 === 1 && !up() && Math.abs(leaf() - a0) < 0.01, 'the key kept down, the cursor out toward the last wedge, the key let go: that wedge is done',
        `lit ${lit0} → ${lit1} with the cursor out · let go: whistled ${WHISTLE_STATS.blown - b0}, the ring gone ${!up()}, the leaf did not move ${Math.abs(leaf() - a0) < 0.01}`); }
    // ---- put away
    { rule(true); floor(); breath(); stand(); const b0 = WHISTLE_STATS.blown; tap(KEY); step(3); const again = WHISTLE_STATS.blown - b0, g1 = !up(); input.keys.delete(KEY);
      breath(); stand(); const b1 = WHISTLE_STATS.blown; input.clicked |= 4; step(3); const rmb = !up() && WHISTLE_STATS.blown === b1;
      stand(); const u2 = up(); tap('Tab'); step(3); const tab = u2 && !up() && WHISTLE_STATS.blown === b1;
      atDoor(); const a0 = leaf(); stand(); tap('Tab'); step(20); const tabDoor = !up() && Math.abs(leaf() - a0) < 0.01 && g.nearby.indexOf(g.hover) === 0;
      verdict(again === 1 && g1 && rmb && tab && tabDoor, 'the key again does the lit wedge; a right click and the back key put the ring away with nothing done',
        `the key again: whistled ${again}, gone ${g1} · right click: away, nothing done ${rmb} · Tab: away, nothing done ${tab} · Tab at the door: the leaf did not move, the top row is the tap's again ${tabDoor}`); }
    // ---- under it
    { rule(true); atDoor(); stand(); const p0 = pl.pace; input.wheel = 100; step(1); input.wheel = 0; const paced = pl.pace < p0 && standing(), sq = g.orders.backFree(), sv = playerBusy(g) !== 'choosing an action', ch = !pl.choosing;
      input.wheel = -100; step(1); input.wheel = 0; tap('Tab'); step(2);
      verdict(paced && sq && sv && ch, 'a ring that merely stands is nothing in hand: the wheel is his pace, the squad\'s key is free, a save is allowed',
        `standing: the wheel took his pace ${p0.toFixed(2)} → down ${paced} · the squad's key free ${sq} · a save allowed ${sv} · not choosing ${ch}`); }
    // ---- a save in memory
    { rule(true); atDoor(); stand(); const stood = standing(), C: any = g.saves, r = C.writeMem(g, 'manual', 'ring'), key = r.info?.key; tap('Tab'); step(2); const away = !up();
      const why = key ? C.load(g, key) : 'no save'; const back = !!pl.sel.ring || pl.sel.open; step(2); const b0 = WHISTLE_STATS.blown, a0 = leaf(); click(); step(6); const clean = !up() && WHISTLE_STATS.blown === b0 && Math.abs(leaf() - a0) < 0.01;
      verdict(stood && r.ok && away && why === null && !back && clean, 'a save kept in memory under a standing ring (the whole game as it stood) is put back with no ring: his first click after the load is his own',
        `the ring stood at the save ${stood}, saved ${r.ok}${r.why ? ` (${r.why})` : ''} · Tab put it away ${away} · the load: ${why ?? 'done'} · a ring after it ${back} · a click then did no wedge ${clean}`); }
    // ---- the rows
    { rule(true); floor(); const alone = rows(); atDoor(); const withDoor = rows(), top = g.hover?.verb, topKind = g.hover?.kind; breath(); const b0 = WHISTLE_STATS.blown; tap('KeyV'); step(3); const old = WHISTLE_STATS.blown - b0;
      floor(); down(HOLD + 4); const onFloor = view(); lift(); tap('Tab'); step(2);
      verdict(alone === 'none' && !/whistle/.test(withDoor) && topKind === 'door' && old === 1 && /^ring \[5 whistle\] lit 5/.test(onFloor), 'the whistle is a wedge and no row: the list and the highlight are as they were; on open floor the ring is that one wedge; its old code still whistles',
        `open floor rows [${alone}], its ring: ${onFloor} · at the door [${withDoor}], the tap's row ${top} · the old code blew ${old}`); }
    // ---- off
    { rule(false); floor('pistol'); const none = rows(); atDoor(); const r = rows(); down(20); const list = pl.listOpen, noRing = !up(); lift(40);
      floor('pistol'); tap('Digit2'); step(60); const slot = pl.slot;
      verdict(!BRK && none === 'none' && !/whistle/.test(r) && list && noRing && slot === 'rifle', 'the rule off: the held key opens the list as it did, the digits are his slots',
        `open floor [${none}] · at the door [${r}] · held: the list open ${list}, a ring ${!noRing} · 2 → ${slot}`); }
    // ---- the board
    { K.KEYMAP.on = true; K.KEYMAP.qFree = false; K.KEYMAP.qCmd = false; K.setKeys({}); let slot = true, hand = true; K.KEYMAP.slotWhen = () => slot; K.KEYMAP.handWhen = BRK ? null : () => hand;
      const codes = () => `E ${K.gameCode('KeyE') || '∅'} · Space ${K.gameCode('Space') || '∅'} · V ${K.gameCode('KeyV') || '∅'}`;
      const REST = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyR', 'KeyZ', 'KeyL', 'KeyN', 'KeyB', 'KeyF', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'ShiftLeft', 'KeyK'];
      const on = K.gameCode('KeyE') === 'Space' && K.gameCode('Space') === '' && K.gameCode('KeyV') === '' && K.gameCode('Backquote') === 'Digit0' && REST.every(c => K.gameCode(c) === c), seenOn = codes();
      const w1 = K.keyText('Space  pull it shut'), w2 = K.keyText('E puts it away. A grab needs empty hands'), w3 = K.keyText('no questions over a gun — E holsters it, then Space asks him');
      const w4 = K.keyText('Space held, then 5, whistles the cook out'), w5 = K.keyText('V whistles him over');
      const words = w4 === 'E held, then 5, whistles the cook out' && w5 === 'V whistles him over' && K.capNow('Space') === 'E' && K.keyCap('Space') === 'E' && w1 === 'E  pull it shut' && w2 === '` puts it away. A grab needs empty hands' && w3 === 'no questions over a gun — ` holsters it, then E asks him';
      const b = K.bindKey('KeyV', 'KeyG'), bound = b.ok && K.gameCode('KeyG') === 'KeyV' && K.capNow('KeyV') === 'G'; K.resetKeys(); const reset = K.gameCode('KeyV') === '' && K.gameCode('KeyE') === 'Space';
      slot = false; const noSlot = codes(), plain = K.gameCode('KeyE') === 'KeyE' && K.gameCode('Space') === 'Space' && K.gameCode('KeyV') === '';
      slot = true; hand = false; const offCodes = codes(), off = !BRK && K.gameCode('KeyE') === '' && K.gameCode('Space') === 'Space' && K.gameCode('KeyV') === 'KeyV' && K.keyText('Space  pull it shut') === 'Space  pull it shut';
      verdict(on && words && bound && reset && plain && off, 'the page\'s board: his own actions on E, Space and V give nothing, the words follow; the whistle can be given a key; without the slot the ring is on Space; rule off, as it was',
        `on: ${seenOn}, the rest themselves ${on} · words ${words} ("${w1}", "${w3.slice(27)}") · the whistle put on G ${bound}, Reset ${reset} · no slot: ${noSlot} ${plain} · rule off: ${offCodes} ${off}`); }
    // ---- the lesson's line
    { const { lessonLine } = await import(`${ROOT}/src/game/lesson.ts`), LINE = 'V whistles the cook out. Then hide at once, at the mark';
      rule(true); const on = `▸ ${lessonLine(LINE)}`; rule(false); const off = `▸ ${lessonLine(LINE)}`;
      verdict(/▸ Space held, then 5, whistles the cook out\. Then hide/.test(on) && /▸ V whistles the cook out/.test(off) && !BRK, 'a lesson\'s line that names the whistle\'s old key says the ring\'s way while the rule is on (the page\'s words put the key in)',
        `on: "${on}" · off: "${off}"`); }
    // ---- recordings
    { HANDRING.on = true; const snap: any = JSON.parse(JSON.stringify(knobsSnapshot(g))), has = typeof snap.tables?.HANDRING?.on === 'boolean' && !BRK;
      const old = JSON.parse(JSON.stringify(snap)); delete old.tables.HANDRING;
      const offOld = await quiet(() => { applyKnobs(g, old); const off = HANDRING.on === false; applyKnobs(g, snap); return off && HANDRING.on === true; });
      verdict(has && offOld && FROZEN_HOLDS['HANDRING.on'] === 'TPS_HANDRING=1', 'a recording carries the switch, one from before it replays with it off, the frozen stand holds it off by name',
        `carried ${has} · a file without it: off, and on again with it ${offOld} · the frozen stand's word ${FROZEN_HOLDS['HANDRING.on']}`); }
    // ---- beside a thing (last: the mission stood up here puts every switch on its stand, and they are put back after it)
    { const { EMPTY_WHY } = await import(`${ROOT}/src/game/handring.ts`), FAR = `door · ${EMPTY_WHY.far}`, RUN = `door · ${EMPTY_WHY.run}`, HELD = `door · ${EMPTY_WHY.held}`, NONE = 'nothing in reach';
      // (what the corner would show is the selector's own word; the log takes a line of it once in a while)
      const clr = (G: any = g) => { G.messages.length = 0; G.player.sel.word = ''; G.player.sel.fileT = -1e9; }, said = (G: any = g) => (G.player.sel.word as string) || 'nothing said', short = () => place(fc[0], fc[2] + 1.8, 180);
      rule(true); atDoor(); step(90); short(); const r0 = rows(), a0 = leaf(); clr(); tap(KEY); step(20); const far1 = said(); pl.sel.word = ''; tap(KEY); step(20); const far2 = said(), lines = g.messages.filter((m: any) => m.text === FAR).length, still = Math.abs(leaf() - a0) < 0.01;
      HANDRING.near = false; short(); clr(); tap(KEY); step(20); const old = said(); rule(true);
      floor(); clr(); tap(KEY); step(20); const open = said();
      // sprinting away from inside its reach: the door is near enough, and it is his feet that are wrong
      place(fc[0], fc[2] + 0.5, 180); clr(); keys('ShiftLeft', 'KeyS'); step(8); const sprinting = pl.sprinting, offR = Math.hypot(pl.char.pos[0] - fc[0], pl.char.pos[2] - fc[2]); tap(KEY); step(2); keys(); step(20); const ran = said();
      // a wall between: the nearest door's marker is the level's, a stride and a half off through the plaster
      const walled = (() => { const col = g.col, eyeY = 1.3; for (const d of g.doors.list) { const c = d.frameCentre; for (let a = 0; a < 16; a++) { const q = [c[0] + Math.cos(a * Math.PI / 8) * 1.9, 0, c[2] + Math.sin(a * Math.PI / 8) * 1.9];
        const cut = (to: number[]) => { const k = 1 - 0.7 / Math.hypot(to[0] - q[0], to[2] - q[2]); return col.solidBlocked([q[0], eyeY, q[2]], [q[0] + (to[0] - q[0]) * k, eyeY, q[2] + (to[2] - q[2]) * k]); };   // (blocked well short of the door: a wall, not its own leaf)
        if (col.nav.isBlocked(q[0], q[2]) || !cut(d.pos) || !cut(c)) continue;
        if (g.doors.list.some((o: any) => o !== d && Math.min(Math.hypot(o.pos[0] - q[0], o.pos[2] - q[2]), Math.hypot(o.frameCentre[0] - q[0], o.frameCentre[2] - q[2])) < 2.4)) continue; return { q, name: d.def.name as string }; } } return null; })();
      let wall = 'no such place'; if (walled) { place(walled.q[0], walled.q[2], 180); const lone = !g.interactables.some((it: any) => it.kind !== 'door' && it.kind !== 'light' && it.kind !== 'wall' && Math.hypot(it.pos[0] - walled.q[0], it.pos[2] - walled.q[2]) < 2.3); clr(); tap(KEY); step(20); wall = lone ? said() : 'another thing stands there'; }
      // a living man nearer than the door, not yet his to grab: the tap was for him, and the door does not answer it
      const gd = g.guards.find((x: any) => x.state !== 'dead' && !x.unit), gp = gd ? [...gd.char.pos] : null; let man = 'no man'; short();
      if (gd) { const put = () => { gd.char.pos[0] = pl.char.pos[0] + 1.25; gd.char.pos[2] = pl.char.pos[2]; }; put(); step(2); put(); clr(); tap(KEY); step(4);
        const mk = g.interactables.find((it: any) => it.guard === gd); man = mk && !mk.inReach ? said() : 'he has no marker out of reach'; gd.char.pos[0] = gp![0]; gd.char.pos[2] = gp![2]; step(2); }
      // (a recording from before the word: the rest of the rule on, this off)
      const snap: any = JSON.parse(JSON.stringify(knobsSnapshot(g))), before = JSON.parse(JSON.stringify(snap)); delete before.tables.HANDRING.near;
      const kept = await quiet(() => { applyKnobs(g, before); const off = HANDRING.near === false && HANDRING.empty === !BRK; applyKnobs(g, snap); return off && HANDRING.near === !BRK; }) && FROZEN_HOLDS['HANDRING.near'] === 'TPS_HANDRING=1';
      // (the quiet tutorial mission as the page stands it: its frame names its rows. Shutting a door was not one of them when he played it, and is now
      // (the tutorial's own mend): the frame is asked both ways — with the open leaf's rows taken off its list, as it was, and with its list as built)
      const { standUp } = await import('./headless.ts'), { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`), { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
      const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`), { RAILS } = await import(`${ROOT}/src/game/rails.ts`), { readFileSync } = await import('node:fs'), rails0 = RAILS.on;
      let held = 'no mission', farHeld = '?', rowsIn = '?', rowsFree = '?', twice = '?', shutIt = false, inHand = false;
      const tables = JSON.parse(JSON.stringify(knobsSnapshot(g))), cmd1 = CMDRING.on; CMDRING.on = was.cmd;   // (the stand-up reads the squad ring's switch to set its dependents: the stand's own, not this check's)
      try { await quiet(async () => {
        const W: any = await standUp({ uploadEvery: 4, level: loadLevel(parseLevelData(readFileSync(`${ROOT}/levels/tut-quiet.json`, 'utf8'))), seed: 1 }); RAILS.on = true; startFromQuery(W.game, '?levelFile=tut-quiet.json&quiet'); rule(true);
        const q = W.game, I = W.input, DT = 1 / 60, L = q.level.scenarios.lesson, R = q.lesson.data?.rails, named: string[] | undefined = R?.rows, lean = named?.filter(v => v !== 'pull' && v !== 'ease'), back = q.doors.list.find((d: any) => d.def.name === 'back'), fb = back.frameCentre;
        const run = (n: number) => { for (let i = 0; i < n; i++) { W.cursorAt([fb[0], 1.0, fb[2]]); W.step(DT); } }, hit = (k: string) => { I.pressed.add(k); I.keys.add(k); run(1); I.keys.delete(k); run(1); };
        const qrows = () => q.nearby.map((r: any) => `${r.kind}:${r.verb ?? '-'}`).join(' | ') || 'none';
        q.restartEncounter(); run(30); q.lesson.i = L.steps.findIndex((x: any) => x.id === 'nook'); back.locked = false; q.teleportPlayer([fb[0], 0, fb[2] + 0.7]); run(12);   // (the step that sends him in through it: the key is his, the lock is done)
        hit('Space'); run(150); if (R) R.rows = lean;   // (the court side: 'push' is a row the mission names — and from here its list has no row for an open leaf)
        const opened = !back.isClosed(); q.teleportPlayer([fb[0] + 0.15, 0, fb[2] - 0.55]); /* (inside, a little to the latch's side: clear of the leaf's way home) */ run(12); rowsIn = qrows(); const b0 = back.angle; clr(q); hit('Space'); run(20);
        held = `${opened ? '' : 'the door did not open · '}${said(q)}${Math.abs(back.angle - b0) < 0.01 ? '' : ' · the leaf moved'}`;
        // …and from a step short of it the word is the same: 'step closer' to a leaf the mission will not let him shut would be a walk for nothing
        q.teleportPlayer([fb[0] + 0.15, 0, fb[2] - 1.8]); run(12); clr(q); hit('Space'); run(10); farHeld = `${qrows() === 'none' ? '' : `rows ${qrows()} · `}${said(q)}`; q.teleportPlayer([fb[0] + 0.15, 0, fb[2] - 0.55]); run(12);
        if (R) R.rows = named; run(3); rowsFree = qrows(); clr(q); hit('Space'); run(40); shutIt = Math.abs(back.angle - b0) > 0.05 && said(q) === 'nothing said';
        // …and a second tap with the leaf already in his hand is no fault of the mission's ('push' is a row it names). Only where a push is his hand's
        // work (hands.ts, the page's stand): on the frozen stand the leaf is simply open by then, and the row it has left is the one the mission lacks
        run(120); clr(q); hit('Space'); run(2); inHand = !!q.player.doorMove; hit('Space'); run(4); twice = said(q);
      }); } finally { await quiet(() => applyKnobs(g, tables)); CMDRING.on = cmd1; RAILS.on = rails0; }   // (every table as it stood before the mission was stood up)
      verdict(r0 === 'none' && far1 === FAR && far2 === FAR && lines === 1 && still && old === NONE && open === NONE && sprinting && offR < 1.35 && ran === RUN && wall === NONE && man === NONE && rowsIn === 'none' && held === HELD && farHeld === HELD && (!inHand || twice === `door · ${EMPTY_WHY.no}`) && shutIt && kept,
        'a tap that finds no row beside a thing names the thing and why: a stride short of a door, sprinting past it, and at a door the frame of a tutorial mission has no row for; open floor, a door behind a wall and a door with a man nearer are still nothing in reach',
        `1.8 m from the door [${r0}]: "${far1}", a second tap "${far2}" (one line of it in the log: ${lines === 1}), the leaf still ${still} · that word's switch off: "${old}" · open floor: "${open}" · sprinting ${sprinting} ${offR.toFixed(2)} m from it: "${ran}" · 1.9 m from ${walled ? `'${walled.name}'` : 'a door'} with a wall between: "${wall}" · 1.8 m from the door with a man 1.25 m off: "${man}" · the quiet mission with shutting a leaf off its rows, inside its open back door [${rowsIn}]: "${held}", from 1.8 m off it: "${farHeld}" · the same tap with the mission's rows as built [${rowsFree}]: the leaf moved and no word ${shutIt} · a second tap with the shut leaf ${inHand ? 'in his hand' : 'already swung open (no hand on it on this stand)'}: "${twice}" · a recording from before the word replays with it off, the frozen stand holds it by name ${kept}`); }
  } finally { HANDRING.on = was.on; HANDRING.early = was.early; HANDRING.empty = was.empty; HANDRING.near = was.near; BACKKEY.tab = was.back; HANDSLOT.on = was.slot; CMDRING.on = was.cmd; CMDRING.hands = was.hands; WALLSNAP.on = was.ws; WALLSNAP.press = was.press; K.setKeys({}); K.KEYMAP.on = was.kOn; K.KEYMAP.slotWhen = was.slotWhen; K.KEYMAP.handWhen = was.handWhen; K.KEYMAP.qFree = was.qFree; K.KEYMAP.qCmd = was.qCmd; G.localStorage = hadLS; console.log = log; console.error = err; console.warn = warn; }
  console.log(`\n=== handring: ${all ? 'ALL PASS' : 'FAIL'} ===`);
  return all;
}
