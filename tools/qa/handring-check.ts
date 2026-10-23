// HIS OWN ACTIONS ARE A RING THAT STAYS — the check behind HANDRING.on (src/game/handring.ts; the rule in interact.ts updateInteract, the whistle's row in
// player.ts buildInteractables) and the page's board for it (src/host/keymap.ts `handWhen`, HAND). ON in the page (?handring=0 = the list on a held Space,
// the whistle on its key, as it was), OFF in the module and on the frozen stand (TPS_HANDRING=1).
//   bun run tools/qa/probes.ts handring        (family `player`)        HANDRING_BREAK=1 = the rule and the board's layer left off and the same lines asked: must FAIL
//                                                                         HANDRING_BREAK=lone | loneWrap | bare | onThing | turn | corner = that one rule left off with the rest on: its own block must FAIL
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
  const BRK = process.env.HANDRING_BREAK === '1', ONE = process.env.HANDRING_BREAK ?? '', left = (k: string) => BRK || ONE === k; let all = true;
  if (ONE && !BRK && !['lone', 'loneWrap', 'bare', 'onThing', 'turn', 'corner'].includes(ONE)) { console.log(`HANDRING_BREAK=${ONE}: not 1 and not a rule's name (lone, loneWrap, bare, onThing, turn, corner)`); return false; }   // (HANDRING_BREAK=lone|loneWrap|bare|onThing|turn|corner: that one rule left off, the rest on — its own block must fail; `lone` fails the long label's block too, whose cursor is read on a pill)
  const verdict = (ok: boolean, what: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}\n    ${detail}`); };
  console.log(`\n=== handring: his own actions are a ring that stays${BRK ? ' (the rule and the board\'s layer off: must fail)' : ONE ? ` (HANDRING.${ONE} off, the rest on: its block must fail)` : ''} ===`);
  const { HANDRING } = await import(`${ROOT}/src/game/handring.ts`); const { HANDSLOT } = await import(`${ROOT}/src/game/handslot.ts`); const { CMDRING } = await import(`${ROOT}/src/game/cmdring.ts`);
  const { WALLSNAP } = await import(`${ROOT}/src/game/wallsnap.ts`); const { handRingView, handRingKeys } = await import(`${ROOT}/src/game/interact.ts`);
  const { WHISTLE_STATS, WHISTLE } = await import(`${ROOT}/src/game/whistle.ts`); const { BACKKEY } = await import(`${ROOT}/src/game/backkey.ts`);
  const { knobsSnapshot, applyKnobs } = await import(`${ROOT}/src/game/journal.ts`); const { FROZEN_HOLDS } = await import(`${ROOT}/src/host/profile.ts`);
  const K = await import(`${ROOT}/src/host/keymap.ts`); const { TWOGEARS } = await import(`${ROOT}/src/game/player.ts`);
  const { playerBusy } = await import(`${ROOT}/src/game/savestate.ts`);
  const was = { on: HANDRING.on, early: HANDRING.early, empty: HANDRING.empty, near: HANDRING.near, lone: HANDRING.lone, loneWrap: HANDRING.loneWrap, onThing: HANDRING.onThing, bare: HANDRING.bare, turn: HANDRING.turn, corner: HANDRING.corner, back: BACKKEY.tab, slot: HANDSLOT.on, cmd: CMDRING.on, hands: CMDRING.hands, ws: WALLSNAP.on, press: WALLSNAP.press, kOn: K.KEYMAP.on, slotWhen: K.KEYMAP.slotWhen, handWhen: K.KEYMAP.handWhen, qFree: K.KEYMAP.qFree, qCmd: K.KEYMAP.qCmd };
  const log = console.log, err = console.error, warn = console.warn;
  const quiet = async <T>(f: () => T | Promise<T>): Promise<T> => { console.log = console.error = console.warn = () => { }; try { return await f(); } finally { console.log = log; console.error = err; console.warn = warn; } };
  const G: any = globalThis, hadLS = G.localStorage; const store = new Map<string, string>();
  G.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, String(v)); }, removeItem: (k: string) => { store.delete(k); } };
  try {
    const S = await quiet(() => world(true)); const { pl, g, step, tap, place, input, click, keys, setCursor } = S as any; WALLSNAP.press = false; CMDRING.on = false; CMDRING.hands = false; BACKKEY.tab = true;   // (the back key is Tab, as the page has it)
    const rule = (on: boolean) => { HANDRING.on = HANDRING.early = HANDRING.empty = HANDRING.near = on && !BRK; HANDRING.lone = on && !left('lone'); HANDRING.loneWrap = on && !left('loneWrap'); HANDRING.onThing = on && !left('onThing'); HANDRING.bare = on && !left('bare'); HANDRING.turn = on && !left('turn'); HANDRING.corner = on && !left('corner'); };
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
      const ang = (-90 + (LAST - 1) * 360 / LAST) * Math.PI / 180; if (R) { input.mouseX = R.ax; input.mouseY = R.ay; step(1); input.mouseX = R.ax + Math.cos(ang) * 70; input.mouseY = R.ay + Math.sin(ang) * 70; } step(3); /* (from its middle, wherever it came up: on the thing with handring.ts onThing, at the cursor without) */ const lit1 = handRingView(g)?.lit; lift(3);
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
    { rule(true); atDoor(); stand(); const gears = TWOGEARS.on; TWOGEARS.on = false;   // (the wheel's own rule: two gears — player.ts TWOGEARS — gives the wheel to nobody, so it is held off for this line and put back)
      const p0 = pl.pace; input.wheel = 100; step(1); input.wheel = 0; const paced = pl.pace < p0 && standing(), sq = g.orders.backFree(), sv = playerBusy(g) !== 'choosing an action', ch = !pl.choosing;
      input.wheel = -100; step(1); input.wheel = 0; TWOGEARS.on = gears; tap('Tab'); step(2);
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
      const w1 = K.keyText('Space  pull it shut'), w2 = K.keyText('E puts it away. A grab needs empty hands'), w3 = K.keyText('press E to holster the gun first, then Space to question him');
      const w4 = K.keyText('Space held, then 5, whistles the cook out'), w5 = K.keyText('V whistles him over');
      const words = w4 === 'E held, then 5, whistles the cook out' && w5 === 'V whistles him over' && K.capNow('Space') === 'E' && K.keyCap('Space') === 'E' && w1 === 'E  pull it shut' && w2 === '` puts it away. A grab needs empty hands' && w3 === 'press ` to holster the gun first, then E to question him';
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
    // ---- one row (the pill's shape and the cursor on it: game/ringlone.ts — the picture itself is the page's, never seen here)
    { const { loneWedge, loneKey, lonePill, pillBox, wedgeMid, RING_HOLE, RING_BOX, LONE } = await import(`${ROOT}/src/game/ringlone.ts`), { ringWant, wedgeAt } = await import(`${ROOT}/src/game/cmdring.ts`), PROFILE = await import(`${ROOT}/src/host/profile.ts`);
      const digits = (V: any) => (V?.wedges ?? []).reduce((m: number, w: any) => m | 1 << w.key, 0);
      rule(true); floor(); breath(); stand(); const V1 = handRingView(g), one = loneWedge(V1), k1 = handRingKeys(g) === digits(V1); tap('Tab'); step(2);
      atDoor(); stand(); const V2 = handRingView(g), two = loneWedge(V2), k2 = handRingKeys(g) === digits(V2); tap('Tab'); step(2);
      // (the squad's ring is the same view: the first mission's ring on a door, and the pair mission's two wedges)
      const Q = { x: 0, y: 0, zoom: 1, lit: 0, tone: undefined, caption: 'squad · door', wedges: [{ key: 1, text: 'stack up', off: false, opens: false }] }, Q2 = { ...Q, wedges: [...Q.wedges, { key: 3, text: 'fall in', off: false, opens: false }] };
      const sq = loneWedge(Q), sq2 = loneWedge(Q2); HANDRING.lone = false; const offOne = loneWedge(V1), offSq = loneWedge(Q); rule(true);
      const N = CMDRING.wedges, bad: string[] = [], LONG = 'a row of far too many words'; let pills = 0;
      for (const text of ['go', 'push it open', 'cover this door', LONG]) for (const opens of [false, true]) for (let k = 1; k <= N; k++) { pills++;
        const P = lonePill({ key: k, text, opens }, N), a = wedgeMid(k, N), cx = (P.x0 + P.x1) / 2, cy = (P.y0 + P.y1) / 2, tw = P.textW, B = pillBox(k, N);
        const placed = P.x0 >= B.x0 - 1e-6 && P.x1 <= B.x1 + 1e-6 && (HANDRING.loneWrap ? P.y0 >= B.y0 - 1e-6 && P.y1 <= B.y1 + 1e-6 : Math.abs(P.y0 - B.y0) < 1e-6 && Math.abs(P.y1 - B.y1) < 1e-6) && tw <= LONE.max * LONE.char + 1e-6;   // (the pill drawn lies in the place the game reads, whatever its words)
        const e = LONE.h / 2, gap = Math.hypot(Math.max(P.x0 + e, Math.min(P.x1 - e, 0)), Math.max(P.y0 + e, Math.min(P.y1 - e, 0))) - e - RING_HOLE;   // (its round-ended outline against the middle's ring)
        const side = cx * Math.cos(a) + cy * Math.sin(a) > RING_HOLE, inBox = (x: number, y: number) => x >= P.x0 && x <= P.x1 && y >= P.y0 && y <= P.y1;
        const holds = inBox(P.nx, P.ny - 4) && (P.anchor === 'start' ? P.tx >= P.x0 && P.tx + tw <= P.x1 : P.tx <= P.x1 && P.tx - tw >= P.x0);
        const near = Math.abs(Math.cos(a)) < 0.2 ? P.nx < P.tx : Math.hypot(P.nx, P.ny - 4) < Math.hypot(P.tx + (P.anchor === 'start' ? tw : -tw) / 2, P.ty);   // (over the middle: the digit leads the words)
        const fits = P.x0 > -RING_BOX.x && P.x1 < RING_BOX.x && P.y0 > -RING_BOX.y && P.y1 < RING_BOX.y;   // (what the HUD is kept from under: ui/cmdring.ts clear)
        if (!(gap > 2 && side && holds && near && fits && placed)) bad.push(`${k} '${text}'${opens ? ' ▸' : ''}: gap ${gap.toFixed(1)} · on its side ${side} · holds its digit and words ${holds} · digit at the near end ${near} · inside the ring's box ${fits} · inside the place the game reads ${placed}`); }
      // (the cursor: a ring 1.5 times its px, the key down long since, the cursor been in the middle)
      const RS = () => ({ ax: 400, ay: 300, z: 1.5, t0: -9, lit: 0, armed: true }), at = (x: number, y: number) => ({ mouseX: 400 + x * 1.5, mouseY: 300 + y * 1.5 }) as any;
      const P1 = lonePill(Q.wedges[0], N), dig: [number, number] = [P1.nx, P1.ny - 4], end: [number, number] = [P1.x1 - 3, (P1.y0 + P1.y1) / 2], bitsOf = (V: any) => V.wedges.reduce((m: number, w: any) => m | 1 << w.key, 0), ask = (p: [number, number], V: any) => ringWant(RS(), at(p[0], p[1]), 0, 1, loneKey(() => bitsOf(V)));
      const onDig = ask(dig, Q), onEnd = ask(end, Q), up = ask([0, -70], Q), down = ask([0, 60], Q), inMid = ask([0, -8], Q), two2 = ask(dig, Q2), bare = ringWant(RS(), at(dig[0], dig[1]), 0, 1), fifth = wedgeAt(dig[0], dig[1], N);
      HANDRING.lone = false; const offDig = ask(dig, Q); rule(true);
      // (a recording keeps the cursor's px: the same px is the same row however the row is worded — and past a short pill's end, still its place)
      const QGo = { ...Q, wedges: [{ ...Q.wedges[0], text: 'go' }] }, QLong = { ...Q, wedges: [{ ...Q.wedges[0], text: LONG }] }, B1 = pillBox(1, N), pts: [number, number][] = [dig, end, [B1.x1 - 2, (B1.y0 + B1.y1) / 2], [B1.x0 + 2, (B1.y0 + B1.y1) / 2], [B1.x1 + 6, (B1.y0 + B1.y1) / 2], [0, 60], [80, 40]];
      const worded = pts.every(p => ask(p, QGo) === ask(p, Q) && ask(p, QLong) === ask(p, Q)), pastEnd = ask([lonePill(QGo.wedges[0], N).x1 + 12, (B1.y0 + B1.y1) / 2], QGo), beyond = ask([B1.x1 + 6, B1.y1 + 14], Q);
      const all: any = JSON.parse(JSON.stringify(knobsSnapshot(g))), km = { ...K.KEYMAP };
      const word = await quiet(() => { PROFILE.pageSwitches(new URLSearchParams('')); const on = HANDRING.lone; PROFILE.pageSwitches(new URLSearchParams('lonepill=0')); const off = HANDRING.lone, rest = HANDRING.on; applyKnobs(g, all); Object.assign(K.KEYMAP, km); return `${on ? 'on' : 'OFF'} as the page opens, ${off ? 'STILL ON' : 'off'} under ?lonepill=0${rest ? '' : ' (AND THE RING WITH IT)'}`; });
      const old = JSON.parse(JSON.stringify(all)); delete old.tables.HANDRING.lone;
      const offOld = await quiet(() => { applyKnobs(g, old); const off = HANDRING.lone === false; applyKnobs(g, all); return off && HANDRING.lone === !BRK; });
      verdict(!!one && one.key === LAST && V1!.wedges.length === 1 && k1 && k2 && !two && (V2?.wedges.length ?? 0) > 1 && sq?.key === 1 && !sq2 && !offOne && !offSq && bad.length === 0
        && onDig === 1 && onEnd === 1 && up === 1 && down !== 1 && inMid === 0 && fifth !== 1 && bare === fifth && two2 === fifth && offDig === fifth && worded && pastEnd === 1 && beyond !== 1
        && /^on as the page opens, off under/.test(word) && offOld && FROZEN_HOLDS['HANDRING.lone'] === 'TPS_HANDRING=1',
        'a ring with one row is a pill out on that row\'s side, clear of the middle, its digit and words inside, and the cursor anywhere on the pill is on that row, whatever the row says; two rows are the wheel; off, the slice and its own fifth of a turn',
        `his ring on open floor: ${V1?.wedges.length ?? 'no'} row, a pill on wedge ${one?.key ?? 'NONE'} · at a door: ${V2?.wedges.length ?? 'no'} rows, ${two ? 'A PILL' : 'the wheel'} · the digits the game reads are the wedges drawn, both times: ${k1 && k2} · a squad ring of one row: ${sq ? `a pill on ${sq.key}` : 'NO PILL'}, of two: ${sq2 ? 'A PILL' : 'the wheel'} · the rule off: ${offOne || offSq ? 'A PILL' : 'the slice'} · ${pills} pills (4 lengths of words, one past the longest drawn, with and without a page, ${N} wedges): ${bad.length ? bad.join(' | ') : 'all hold'}`
        + ` · the cursor on '1 stack up': on its digit (wedge ${fifth}'s fifth) → ${onDig}, on its far end → ${onEnd}, straight up → ${up}, straight down → ${down}, in the middle → ${inMid}; the same spot with two rows → ${two2}, with no pill asked → ${bare}, with the rule off → ${offDig} · the same ${pts.length} spots asked of 'go' and of a row of ${LONG.length} letters give what they give of 'stack up': ${worded} (12 px past the end of 'go''s pill → ${pastEnd}, outside the place → ${beyond}) · the page: ${word} · a file without the key: off ${offOld} · the frozen stand's word ${FROZEN_HOLDS['HANDRING.lone']}`); }
    // ---- a long label on a lone pill (HANDRING.loneWrap: two lines at full letter width, never squeezed into one — the picture itself is the page's)
    { const { lonePill, loneLines, pillBox, loneKey, wedgeMid, RING_HOLE, RING_BOX, LONE } = await import(`${ROOT}/src/game/ringlone.ts`), { ringWant } = await import(`${ROOT}/src/game/cmdring.ts`), PROFILE = await import(`${ROOT}/src/host/profile.ts`);
      rule(true); const N = CMDRING.wedges, bad: string[] = [], WALL = 'breach with a wall charge · 3 left', letters = (t: string) => t.replace(/[ ·]/g, '');
      // (label, opens, lines, and where it matters the lines themselves: the door tools' own long rows break at their dot, which is dropped)
      const LABELS: [string, boolean, number, string[]?][] = [['go', false, 1], ['cover this door', true, 1], ['a label of twenty ok', false, 1], [WALL, false, 2, ['breach with a wall', 'charge · 3 left']], ['a row of far too many words', true, 2],
        ['wall tools and the things beside them', true, 2], ['breachwithawallchargeandmore', false, 1], ['breachwithawallchargeand', true, 1], ['a row whose words run on and on well past what two lines of a pill can hold', false, 2],
        ['stand off · in behind the charge', false, 2, ['stand off', 'in behind the charge']], ['bang and clear · 3 left', false, 2, ['bang and clear', '3 left']], ['bang, then go in · 3 left', false, 2, ['bang, then go in', '3 left']], ['set a charge · 3 left', false, 2, ['set a charge', '3 left']],
        ['support hand grip point (arrows only)', true, 2, ['support hand grip', 'point (arrows only) ▸']], ['twelveletter twelveletter twelveletter', false, 2], ['aaaaaaaaaaaaaaaaaaaaaaaa ·', false, 1], ['a label whose dot has no room ·after it', false, 2], [' a label that starts with a space', false, 2], ['breach with a wall  charge and more', false, 2]];
      // (the pill of before the rule, written out again here: a short label's pill is that one to the last figure, rule on or off)
      const oldPill = (w: { key: number; text: string; opens: boolean }) => { const L = LONE, a = wedgeMid(w.key, N), c = Math.cos(a), px = L.r * c, py = L.r * Math.sin(a), e = L.h / 2, textW = Math.min((w.opens ? `${w.text} ▸` : w.text).length, L.max) * L.char, wd = L.h + textW + L.pad, mid = Math.abs(c) < 0.2, lf = !mid && c < 0, x0 = mid ? -wd / 2 : lf ? px + e - wd : px - e, x1 = x0 + wd, y0 = py - e, y1 = py + e, f = (v: number) => v.toFixed(1);
        return { d: `M${f(x0 + e)},${f(y0)} H${f(x1 - e)} A${e},${e} 0 0 1 ${f(x1 - e)},${f(y1)} H${f(x0 + e)} A${e},${e} 0 0 1 ${f(x0 + e)},${f(y0)} Z`, nx: lf ? x1 - e : x0 + e, ny: py + 4, tx: lf ? x1 - L.h : x0 + L.h, ty: py + 3.5, anchor: lf ? 'end' : 'start', x0, y0, x1, y1, textW }; };
      const asOld = (w: { key: number; text: string; opens: boolean }) => { const P: any = lonePill(w, N), O: any = oldPill(w); return Object.keys(O).every(k => P[k] === O[k]) && P.lines.length === 1 && P.lines[0].y === O.ty && P.lines[0].w === O.textW; };
      let pills = 0, shortOld = true;
      for (const [text, opens, want, as] of LABELS) for (let k = 1; k <= N; k++) { pills++;
        const w = { key: k, text, opens }, P = lonePill(w, N), B = pillBox(k, N), rows = loneLines(w), words = opens ? `${text} ▸` : text, e = LONE.h / 2;
        if (words.length <= LONE.max) shortOld &&= asOld(w); HANDRING.loneWrap = false; shortOld &&= asOld(w); HANDRING.loneWrap = !left('loneWrap');   // (…and with the rule off, a label of any length)
        const count = rows.length === want && P.lines.length === want && P.lines.every((l: any, i: number) => l.s === rows[i]) && (!as || as.every((t, i) => rows[i] === t));
        const fitsTwo = [...words].some((ch, i) => ch === ' ' && i > 0 && i <= LONE.max && words.length - i - 1 <= LONE.max && words.slice(i + 1) !== '▸');   // (some break leaves both lines in a pill's letters)
        const kept = letters(rows.join(' ')) === letters(words) && (rows.length < 2 || rows.every((r: string) => r.length > 0 && r !== '▸' && !/^·|·$|^ | $/.test(r)));   // (no line of two is empty, the arrow alone, or begins or ends on a dot or a space)
        const full = P.lines.every((l: any) => Math.abs(l.w - Math.min(l.s.length, LONE.max) * LONE.char) < 1e-6) && Math.abs(P.textW - Math.max(...P.lines.map((l: any) => l.w))) < 1e-6
          && (!fitsTwo || P.lines.every((l: any) => l.s.length <= LONE.max));   // (no letter squeezed, where the label can be broken to fit)
        const placed = P.x0 >= B.x0 - 1e-6 && P.x1 <= B.x1 + 1e-6 && P.y0 >= B.y0 - 1e-6 && P.y1 <= B.y1 + 1e-6, tallBy = P.y1 - P.y0;
        const gap = Math.hypot(Math.max(P.x0 + e, Math.min(P.x1 - e, 0)), Math.max(P.y0 + e, Math.min(P.y1 - e, 0))) - e - RING_HOLE;
        const fits = P.x0 > -RING_BOX.x && P.x1 < RING_BOX.x && P.y0 > -RING_BOX.y && P.y1 < RING_BOX.y;
        const inside = P.lines.every((l: any) => l.y - 9 >= P.y0 && l.y + 3 <= P.y1 && (P.anchor === 'start' ? P.tx >= P.x0 && P.tx + l.w <= P.x1 : P.tx <= P.x1 && P.tx - l.w >= P.x0)) && P.nx >= P.x0 && P.nx <= P.x1 && P.ny - 4 >= P.y0 + e - 1e-6 && P.ny - 4 <= P.y1 - e + 1e-6;
        const py = LONE.r * Math.sin(wedgeMid(k, N)), near = py < 0 ? P.y1 - (py + e) : P.y0 - (py - e), nearB = py < 0 ? B.y1 - (py + e) : B.y0 - (py - e);   // (the edge by the middle is a one-line pill's: a tall pill, and the place, grow away from it)
        const apart = P.lines.length < 2 || P.lines[1].y - P.lines[0].y >= 11, high = Math.abs(tallBy - (want > 1 ? (LONE.h + LONE.lead) : LONE.h)) < 1e-6 && Math.abs(near) < 1e-6 && Math.abs(nearB) < 1e-6 && Math.abs(B.y1 - B.y0 - LONE.h - LONE.lead) < 1e-6;
        if (!(count && kept && full && placed && gap > 2 && fits && inside && apart && high)) bad.push(`${k} '${words}': ${rows.map((r: string) => `'${r}'`).join(' / ')} · ${want} line(s) ${count} · every word kept ${kept} · full letter width ${full} · inside the place the game reads ${placed} · gap ${gap.toFixed(1)} · inside the ring's box ${fits} · digit and lines inside the pill ${inside} · lines apart ${apart} · its height ${tallBy.toFixed(0)}, its edge by the middle ${near.toFixed(1)} px from a one-line pill's (the place's ${nearB.toFixed(1)})`); }
      // (the picture of the maintainer's own row, and what a short row is: as it was, to the px)
      const PW = lonePill({ key: 3, text: WALL, opens: false }, N), shot = PW.lines.map((l: any) => l.s).join(' / '), on3 = JSON.stringify(lonePill({ key: 3, text: 'stack up', opens: false }, N)), box3 = pillBox(3, N), box1 = pillBox(1, N);
      // (the cursor: a spot on a tall pill's far line that is in another wedge's fifth of a turn is on the row with the rule, and not without)
      const RS = () => ({ ax: 400, ay: 300, z: 1.5, t0: -9, lit: 0, armed: true }), at = (x: number, y: number) => ({ mouseX: 400 + x * 1.5, mouseY: 300 + y * 1.5 }) as any, ask = (x: number, y: number) => ringWant(RS(), at(x, y), 0, 1, loneKey(() => 1 << 1));
      const P1 = lonePill({ key: 1, text: WALL, opens: false }, N), spot: [number, number] = [P1.x0 + 8, P1.y0 + 5], onFar = ask(spot[0], spot[1]), onNear = ask(P1.x0 + 8, P1.y1 - 5);
      const ask3 = (x: number, y: number) => ringWant(RS(), at(x, y), 0, 1, loneKey(() => 1 << 3)), P3 = lonePill({ key: 3, text: WALL, opens: false }, N), low: [number, number] = [P3.x1 - 8, P3.y1 - 4], onLow = ask3(low[0], low[1]);
      HANDRING.loneWrap = false; const offLow = ask3(low[0], low[1]);
      const OW = lonePill({ key: 3, text: WALL, opens: false }, N), off3 = JSON.stringify(lonePill({ key: 3, text: 'stack up', opens: false }, N)), obox3 = pillBox(3, N), offFar = ask(spot[0], spot[1]), offNear = ask(P1.x0 + 8, P1.y1 - 5);
      const offOne = OW.lines.length === 1 && Math.abs(OW.textW - LONE.max * LONE.char) < 1e-6 && Math.abs(OW.y1 - OW.y0 - LONE.h) < 1e-6 && Math.abs(obox3.y1 - obox3.y0 - LONE.h) < 1e-6, squeezed = (WALL.length / LONE.max).toFixed(2);
      rule(true);
      const all: any = JSON.parse(JSON.stringify(knobsSnapshot(g))), km = { ...K.KEYMAP };
      const word = await quiet(() => { const Q = (s: string) => { PROFILE.pageSwitches(new URLSearchParams(s)); return HANDRING.loneWrap; }; const on = Q(''), off = Q('lonewrap=0'), rest = HANDRING.lone, pillOff = Q('lonepill=0'), ringOff = Q('handring=0'); applyKnobs(g, all); Object.assign(K.KEYMAP, km);
        return `${on ? 'on' : 'OFF'} as the page opens, ${off ? 'STILL ON' : 'off'} under ?lonewrap=0${rest ? '' : ' (AND THE PILL WITH IT)'}, ${pillOff || ringOff ? 'STILL ON' : 'off'} with the pill and with the ring`; });
      const old = JSON.parse(JSON.stringify(all)); delete old.tables.HANDRING.loneWrap;
      const offOld = await quiet(() => { applyKnobs(g, old); const off = HANDRING.loneWrap === false; applyKnobs(g, all); return off && HANDRING.loneWrap === !left('loneWrap'); });
      verdict(bad.length === 0 && PW.lines.length === 2 && on3 === off3 && shortOld && Math.abs(box3.y1 - box3.y0 - (LONE.h + LONE.lead)) < 1e-6 && onFar === 1 && onNear === 1 && offFar !== 1 && offNear === 1 && onLow === 3 && offLow !== 3 && offOne
        && /^on as the page opens, off under \?lonewrap=0, off with/.test(word) && offOld && FROZEN_HOLDS['HANDRING.loneWrap'] === 'TPS_HANDRING=1',
        'a lone pill\'s label longer than the pill is two lines at full letter width, every word kept, inside the place the cursor is read on; a short label is the pill as it was; off, one line drawn tighter',
        `'${WALL}' (${WALL.length} letters) on wedge 3: ${shot}, set ${PW.lines.map((l: any) => l.w.toFixed(1)).join(' and ')} px wide, a pill ${(PW.x1 - PW.x0).toFixed(0)} by ${(PW.y1 - PW.y0).toFixed(0)} px · ${pills} pills (${LABELS.length} labels, ${N} wedges): ${bad.length ? bad.join(' | ') : 'all hold'}`
        + ` · 'stack up' with the rule and without: ${on3 === off3 ? 'the same pill' : 'DIFFERENT'}; every label of ${LONE.max} letters or fewer against the pill of before the rule, written out again: ${shortOld ? 'the same to the last figure' : 'DIFFERENT'} · the place the game reads: ${(box3.y1 - box3.y0).toFixed(0)} px tall with the rule, ${(obox3.y1 - obox3.y0).toFixed(0)} without (wedge 1's: ${box1.y0.toFixed(0)} to ${box1.y1.toFixed(0)})`
        + ` · the cursor on wedge 1's pill, its far line (another wedge's fifth of a turn) → ${onFar}, its near line → ${onNear}; with the rule off → ${offFar} and ${offNear}; on wedge 3's, the end of its lower line (${low[0].toFixed(0)}, ${low[1].toFixed(0)}) → ${onLow}, with the rule off → ${offLow} · off: ${OW.lines.length} line, ${WALL.length} letters set to the width of ${LONE.max} (${squeezed} letters in one's room) ${offOne ? '' : 'NOT AS IT WAS'} · the page: ${word} · a file without the key: off ${offOld} · the frozen stand's word ${FROZEN_HOLDS['HANDRING.loneWrap']}`); }
    // ---- on its thing (HANDRING.onThing: where it stands and what the cursor lights · HANDRING.bare: no line under it)
    { const { wedgeMid, RING_HOLE } = await import(`${ROOT}/src/game/ringlone.ts`), PROFILE = await import(`${ROOT}/src/host/profile.ts`), cam = (S as any).W.cam, VW = 1600, VH = 1000, N = CMDRING.wedges;
      const px = (p: number[]) => cam.project(p, VW, VH) as [number, number, boolean], far: [number, number] = [300, 820], cur = (x: number, y: number) => { setCursor(null); input.mouseX = x; input.mouseY = y; };
      const off = (R: any, p: number[]) => { const q = px(p); return Math.hypot(R.ax - q[0], R.ay - q[1]); }, lit = () => handRingView(g)?.lit ?? -1, ang = wedgeMid(LAST, N), cx = Math.cos(ang), cy = Math.sin(ang);
      /** the cursor kept `r` px (of the ring's own) out from the ring's middle toward the last wedge for `n` frames — the view leans after the cursor, and the ring stays on its thing */
      const out = (r: number, n: number) => { for (let i = 0; i < n; i++) { const R = pl.sel.ring; if (R) cur(R.ax + cx * r * R.z, R.ay + cy * r * R.z); step(1); } };
      // (at the door, the cursor nowhere near him: the ring is on the door, and a cursor straight onto a slice lights it)
      rule(true); atDoor(); breath(); cur(...far); step(90); stand(); const R1 = pl.sel.ring, T = g.nearby[0], V1 = handRingView(g), z = R1?.z ?? 1, ax = R1?.ax ?? 0, ay = R1?.ay ?? 0;
      const onIt = !!R1?.at && !!T && T.kind === 'door' && R1.at.every((v: number, i: number) => Math.abs(v - T.pos[i]) < 1e-6) && off(R1, T.pos) < 3, d1 = R1 && T ? `${off(R1, T.pos).toFixed(1)} px off it` : 'no ring', fromCur = Math.hypot(ax - far[0], ay - far[1]), stood = standing(), lit0 = lit(), cap = V1?.caption;
      HANDRING.bare = false; const capOld = handRingView(g)?.caption ?? ''; rule(true);
      out(260, 3); const past = lit();   // (out past the ring's own box that way, never through the middle: a direction alone lights nothing)
      // (a place of the wheel with no wedge is no slice: the cursor on it, then straight onto the last wedge's slice beside it — never off the wheel between — lights that slice; and a slice is a slice from the hole out, nearer in than the middle's own reach)
      const keysUp = (V1?.wedges ?? []).map((w: any) => w.key), bareK = [4, 3, 2].find(k => !keysUp.includes(k)) ?? 0, toK = (k: number, r: number, n: number) => { const a = wedgeMid(k, N); for (let i = 0; i < n; i++) { const R = pl.sel.ring; if (R) cur(R.ax + Math.cos(a) * r * R.z, R.ay + Math.sin(a) * r * R.z); step(1); } };
      toK(bareK, 34, 3); const onBare = lit(); out(34, 3); const fromBare = lit(); cur(...far); step(1); const offAgain = lit(); out((RING_HOLE + CMDRING.flickPx) / 2, 3); const inner = lit(); cur(...far); step(1); toK(1, 34, 3); const one1 = lit(); cur(...far); step(1); out(75, 3); const onWords = lit(); cur(...far); step(1); toK(1, 34, 3); cur(...far); step(1);
      out(34, 3); const onSlice = lit(), b0 = WHISTLE_STATS.blown; click(); step(4); const did = WHISTLE_STATS.blown - b0, gone = !up();
      // (the cursor already resting where that slice comes up: nothing lit by it, the key let go does nothing, a pixel's shake neither; off it and back on, lit)
      atDoor(); breath(); cur(...far); step(90); for (let i = 0; i < 40; i++) { const q = px(T.pos); cur(q[0] + cx * 34 * z, q[1] + cy * 34 * z); step(1); }   /* (the cursor brought to where that slice will be, and the view let settle on it) */
      const b1 = WHISTLE_STATS.blown; down(HOLD + 4); const R2 = pl.sel.ring, d2 = R2 ? Math.hypot(input.mouseX - R2.ax, input.mouseY - R2.ay) / R2.z : 0, same = !!R2 && d2 > CMDRING.flickPx + 2 && d2 < 42, rest = lit(); lift();
      const kept = standing() && WHISTLE_STATS.blown === b1; input.mouseX += 1; step(2); const shake = lit(); cur(...far); step(1); out(34, 3); const back = lit(); tap('Tab'); step(2);
      // (a point out of the view: the ring whole inside the view's edge — cmdring.ts ringPin, the squad ring's own, asked of his ring as it stands at the door)
      atDoor(); breath(); cur(...far); step(90); stand(); const R5 = pl.sel.ring;
      let edge = 'no ring'; if (R5?.at) { const { ringPin } = await import(`${ROOT}/src/game/cmdring.ts`), C5 = { ...R5 }, q = [VW + 900, 440], ex = CMDRING.edgeX * C5.z, ey = CMDRING.edgeY * C5.z; ringPin(C5, q[0], q[1], VW, VH); const inside = C5.ax >= ex - 0.01 && C5.ax <= VW - ex + 0.01 && C5.ay >= ey - 0.01 && C5.ay <= VH - ey + 0.01;
        edge = `its point at ${q[0].toFixed(0)}, ${q[1].toFixed(0)} of ${VW} × ${VH}, the ring at ${C5.ax.toFixed(0)}, ${C5.ay.toFixed(0)}: ${inside ? 'whole inside the edge' : 'NOT HELD INSIDE'}`; } tap('Tab'); step(2);
      // (open floor, the whistle alone: on his own body — and it goes with him as he walks under it; walked up to a thing, it stands on the thing)
      floor(); breath(); cur(...far); step(90); stand(); const R3 = pl.sel.ring, p = pl.char.pos, onBody = (R: any) => { const q = pl.char.pos; return !!R?.at && Math.abs(R.at[0] - q[0]) < 1e-6 && Math.abs(R.at[2] - q[2]) < 1e-6 && R.at[1] > q[1] + 0.5 && R.at[1] < q[1] + 1.8 && off(R, R.at) < 3; }, body = onBody(R3), rows3 = handRingView(g)?.wedges.length;
      const p0 = [p[0], p[2]]; input.keys.add('KeyW'); step(70); input.keys.delete('KeyW'); step(90); const walked = Math.hypot(pl.char.pos[0] - p0[0], pl.char.pos[2] - p0[1]), withHim = standing() && pl.sel.ring === R3 && onBody(R3);
      tap('Tab'); step(2);
      // (a step short of the door, where its rows are not his yet: the ring on his body — walked up to the door under it, the ring stands on the door)
      place(fc[0], fc[2] + 1.8, 180); breath(); cur(...far); step(90); stand(); const R6 = pl.sel.ring, rows5 = handRingView(g)?.wedges.length, short6 = onBody(R6);
      input.keys.add('KeyW'); step(45); input.keys.delete('KeyW'); step(90); const T2 = g.nearby[0], toThing = short6 && standing() && pl.sel.ring === R6 && !!T2 && T2.kind === 'door' && !!R6?.at && R6.at.every((v: number, i: number) => Math.abs(v - T2.pos[i]) < 1e-6) && off(R6, T2.pos) < 3, rows4 = handRingView(g)?.wedges.length; tap('Tab'); step(2);
      // (the rule off: at the cursor, as it was)
      HANDRING.onThing = false; atDoor(); breath(); cur(...far); stand(); const R4 = pl.sel.ring, atCur = !!R4 && !R4.at && Math.hypot(R4.ax - far[0], R4.ay - far[1]) < 1; tap('Tab'); step(2); rule(true);
      const all: any = JSON.parse(JSON.stringify(knobsSnapshot(g))), km = { ...K.KEYMAP };
      const word = await quiet(() => { const P = (q: string) => { PROFILE.pageSwitches(new URLSearchParams(q)); return `${HANDRING.onThing ? 'on its thing' : 'at the cursor'}, ${HANDRING.bare ? 'no line' : 'its line'}`; }, r = `as the page opens: ${P('')} · ?ringonthing=0: ${P('ringonthing=0')} · ?ringbare=0: ${P('ringbare=0')}`; applyKnobs(g, all); Object.assign(K.KEYMAP, km); return r; });
      const old = JSON.parse(JSON.stringify(all)); delete old.tables.HANDRING.onThing; delete old.tables.HANDRING.bare;
      const offOld = await quiet(() => { applyKnobs(g, old); const o = HANDRING.onThing === false && HANDRING.bare === false; applyKnobs(g, all); return o && HANDRING.onThing === !BRK; });
      verdict(onIt && fromCur > 200 && stood && lit0 === 1 && cap === '' && capOld.length > 0 && past === 1 && bareK > 0 && onBare === 1 && fromBare === LAST && offAgain === LAST && inner === LAST && one1 === 1 && onWords === LAST && onSlice === LAST && did === 1 && gone && same && rest === 1 && kept && shake === 1 && back === LAST && body && rows3 === 1 && walked > 1 && withHim && toThing && (rows4 ?? 0) > 1 && / whole inside the edge$/.test(edge) && atCur
        && word === 'as the page opens: on its thing, no line · ?ringonthing=0: at the cursor, no line · ?ringbare=0: on its thing, its line' && offOld && FROZEN_HOLDS['HANDRING.onThing'] === 'TPS_HANDRING=1' && FROZEN_HOLDS['HANDRING.bare'] === 'TPS_HANDRING=1',
        'his ring stands on the thing its first row is about, on his own body where there is none and with him as he walks, whole inside the view\'s edge, with no line of words under it; the cursor on a slice lights it, a cursor resting where a slice came up does not, nor a direction from outside the ring, nor a place with no wedge',
        `at the door, the cursor ${fromCur.toFixed(0)} px from where it came up: on the ${T?.kind ?? 'NOTHING'}'s own point ${onIt} (${d1}), standing ${stood}, lit ${lit0}, the line under it '${cap}' (with that switch off: '${capOld}') · the cursor 260 px out toward wedge ${LAST}, past the ring's own box and never through the middle: lit ${past} · onto wedge ${bareK}'s place, which has no wedge: lit ${onBare}, and from there straight onto wedge ${LAST}'s slice: lit ${fromBare} · on that slice ${((RING_HOLE + CMDRING.flickPx) / 2).toFixed(1)} px out, between the hole and the middle's reach: lit ${inner} · back on wedge 1's slice: lit ${one1}, then on wedge ${LAST}'s WORDS, 75 px out past the rim: lit ${onWords} · straight onto that slice from far off: lit ${onSlice}, a click whistled ${did}, the ring gone ${gone}`
        + ` · opened again with the cursor resting where that slice comes up (the cursor ${d2.toFixed(0)} px out on it: ${same}): lit ${rest}, the key let go: standing and nothing blown ${kept}, a pixel's shake: lit ${shake}, off it and back on: lit ${back} · open floor (${rows3} row): on his own body ${body}, and still on it after he walked ${walked.toFixed(1)} m under it ${withHim}; opened a step short of the door (${rows5} row, on his body ${short6}) and walked up to it: it stands on the door with the door's ${rows4} rows ${toThing} · ${edge} · the rule off: at the cursor ${atCur} · the page: ${word} · a file without the keys: off ${offOld} · the frozen stand's words ${FROZEN_HOLDS['HANDRING.onThing']}, ${FROZEN_HOLDS['HANDRING.bare']}`); }
    // ---- turned to the switch (HANDRING.turn: lightswitch.ts, handwork.ts — the row's own call, as a tap or a ring's wedge makes it)
    { const LS = await import(`${ROOT}/src/game/lightswitch.ts`), HW = await import(`${ROOT}/src/game/handwork.ts`), PROFILE = await import(`${ROOT}/src/host/profile.ts`), ls0 = LS.LIGHTSWITCH.on, hw0 = HW.HANDWORK.on; LS.LIGHTSWITCH.on = true; HW.HANDWORK.on = true; LS.lightSwitchReset(g);
      let out = 'no plate'; const res: any = {};
      try { const sw = LS.wallSwitches(g).find((x: any) => LS.switchLit(x));
        if (sw) { const face = Math.atan2(-sw.n[0], -sw.n[2]), faceDeg = face * 180 / Math.PI, offBy = () => { const d = face - pl.char.bodyYaw; return Math.abs(Math.atan2(Math.sin(d), Math.cos(d))) * 180 / Math.PI; };
          const lights = () => { if (!LS.switchLit(sw)) { LS.flipSwitch(g, sw, true, g.guards[0]?.char ?? pl.char); step(60); } };
          const run = (on: boolean, kit: 'empty' | 'pistol' = 'empty') => { rule(on); HANDRING.turn = on && !left('turn'); place(sw.stand[0], sw.stand[2], faceDeg + 180, kit); setCursor([sw.stand[0] + sw.n[0] * 4, 1, sw.stand[2] + sw.n[2] * 4]); step(50); lights();   // (his back to the plate: the cursor out in the room)
            const a0 = offBy(), gun = !!pl.pistolUp, want = HW.samWorkHand(g), did = LS.switchAct(g, pl, 'lightsOff'), dark = !LS.switchLit(sw); let planted = 0, hand = 0, which = -1, aMin = a0; const again: boolean[] = [];
            for (let f = 0; f < 90; f++) { input.keys.add('KeyW'); step(1); const I = pl.char.anim.workInfo(); if (HW.samWork(g)?.kind === 'switch') planted++; if (I.w > hand) { hand = I.w; which = I.hand; } aMin = Math.min(aMin, offBy()); } input.keys.delete('KeyW'); step(2);
            return { a0, did, dark, planted, hand, which, want, gun, aMin }; };
          const on = run(true), gun = run(true, 'pistol'), off = run(false); Object.assign(res, { on, gun, off });
          // (under the plant the plate's row is still on offer; a click lets go of it, the lights out and the trigger his; and a row given lets go of it too — the room flipped back, planted afresh)
          rule(true); HANDRING.turn = !left('turn'); place(sw.stand[0], sw.stand[2], faceDeg + 180, 'empty'); setCursor([sw.stand[0] + sw.n[0] * 4, 1, sw.stand[2] + sw.n[2] * 4]); step(50); lights(); LS.switchAct(g, pl, 'lightsOff'); step(3);
          const under = HW.samWork(g)?.kind === 'switch', rowsUnder = g.nearby.filter((r: any) => r.verb && !r.running).length; click(); step(2); res.let = { under, rowsUnder, freed: HW.samWork(g) === null, dark: !LS.switchLit(sw) }; step(40);
          { LS.switchAct(g, pl, 'lightsOn'); step(60); LS.switchAct(g, pl, 'lightsOff'); step(3); const row = g.nearby.find((r: any) => r.kind === 'switch' && r.verb), a = HW.samWork(g)?.kind === 'switch'; if (row) { pl.nearSel = g.nearby.indexOf(row); step(1); } const hv = g.hover?.verb ?? 'none'; if (row) { tap(KEY); step(6); } res.let.again = { a, row: row?.verb ?? 'none', hv, lit: LS.switchLit(sw) }; step(60); }
          // (pressed to the wall beside the plate: the lights go and he stays on the wall — a plant would take him off it)
          const r = [sw.n[2], 0, -sw.n[0]]; let wall = 'no wall hold in reach of the plate'; rule(true); HANDRING.turn = !left('turn');
          for (const side of [0.5, -0.5, 0.7, -0.7, 0.3, -0.3]) { lights(); place(sw.stand[0] + r[0] * side, sw.stand[2] + r[2] * side, faceDeg + 180, 'empty'); tap('KeyQ'); step(50);
            if (pl.wall && LS.switchNear(g, pl, LS.LIGHTSWITCH.reach) === sw) { const did = LS.switchAct(g, pl, 'lightsOff'), dark = !LS.switchLit(sw); let kept = true, planted = 0; for (let f = 0; f < 60; f++) { step(1); kept &&= !!pl.wall; if (HW.samWork(g)?.kind === 'switch') planted++; }
              res.wall = { did, dark, kept, planted }; wall = `the lights out ${did && dark}, still on the wall through the next second ${kept}, stood off it for the plate ${(planted / 60).toFixed(2)} s`; tap('KeyQ'); step(20); break; }
            if (pl.wall) { tap('KeyQ'); step(20); } }
          out = `his back to a plate (${on.a0.toFixed(0)}° off it), the row given: the lights out on the press ${on.dark}, then turned to within ${on.aMin.toFixed(0)}° of it, his hand at the plate (the work pose ${on.hand.toFixed(2)}), stood at it for ${(on.planted / 60).toFixed(2)} s with W held · his pistol up ${gun.gun}: the hand at the plate is his ${gun.which === 0 ? 'left' : 'RIGHT, THE PISTOL\'S'} (the rule's own: ${gun.want === 0 ? 'left' : 'right'}), empty-handed his ${on.which === 0 ? 'left' : 'right'} · three frames in, planted ${res.let.under} with ${res.let.rowsUnder} row on offer; a click: let go of ${res.let.freed}, the lights still out ${res.let.dark}; planted again (${res.let.again.a}) and the row '${res.let.again.row}' (the tap's: '${res.let.again.hv}') tapped under it: the room lit again ${res.let.again.lit} · pressed to the wall beside it: ${wall} · the rule off: ${off.a0.toFixed(0)}° off it and never nearer than ${off.aMin.toFixed(0)}°, stood ${(off.planted / 60).toFixed(2)} s, the lights out ${off.dark}`; } }
      finally { LS.lightSwitchReset(g); LS.LIGHTSWITCH.on = ls0; HW.HANDWORK.on = hw0; setCursor(null); rule(true); }
      const all: any = JSON.parse(JSON.stringify(knobsSnapshot(g))), km = { ...K.KEYMAP };
      const word = await quiet(() => { PROFILE.pageSwitches(new URLSearchParams('')); const on = HANDRING.turn; PROFILE.pageSwitches(new URLSearchParams('ringturn=0')); const off = HANDRING.turn, rest = HANDRING.on && HANDRING.onThing; PROFILE.pageSwitches(new URLSearchParams('handring=0')); const none = !HANDRING.on && !HANDRING.lone && !HANDRING.onThing && !HANDRING.bare && !HANDRING.turn; applyKnobs(g, all); Object.assign(K.KEYMAP, km); return `${on ? 'on' : 'OFF'} as the page opens, ${off ? 'STILL ON' : 'off'} under ?ringturn=0${rest ? '' : ' (AND THE REST WITH IT)'}, and ?handring=0 takes the four with the ring ${none}`; });
      const old = JSON.parse(JSON.stringify(all)); delete old.tables.HANDRING.turn;
      const offOld = await quiet(() => { applyKnobs(g, old); const o = HANDRING.turn === false; applyKnobs(g, all); return o && HANDRING.turn === !BRK; });
      const O = res.on, P = res.gun, F = res.off, W = res.wall, L = res.let;
      verdict(!!O && O.did && O.dark && O.a0 > 90 && O.aMin < 12 && O.hand > 0.85 && O.which === 1 && O.planted >= 18 && O.planted <= 60 * (LS.LIGHTSWITCH.handSecs + HANDRING.turnMax) + 2 && P.gun && P.did && P.want === 0 && P.which === 0 && P.aMin < 12 && !!W && W.did && W.dark && W.kept && W.planted === 0 && !!L && L.under && L.rowsUnder === 1 && L.freed && L.dark && L.again.a && L.again.row === 'lightsOn' && L.again.lit
        && F.did && F.dark && F.planted === 0 && F.aMin > 90 && /^on as the page opens, off under \?ringturn=0, and \?handring=0 takes the four with the ring true$/.test(word) && offOld && FROZEN_HOLDS['HANDRING.turn'] === 'TPS_HANDRING=1',
        'a row given at a wall switch with his back to it: the lights go on the press, then he turns to the plate and the hand that is free goes to it; a click lets go of it; from a wall hold he stays on the wall; off, the lights go and he stays as he was', `${out} · the page: ${word} · a file without the key: off ${offOld} · the frozen stand's word ${FROZEN_HOLDS['HANDRING.turn']}`); }
    // ---- the corner panel (HANDRING.corner: ui/corner.ts — the reduction; the panel as drawn is the page's, never seen here)
    { const { cornerRows, objectiveParts, cornerOn } = await import(`${ROOT}/src/ui/corner.ts`), PROFILE = await import(`${ROOT}/src/host/profile.ts`), OV = await import(`${ROOT}/src/ui/overlay.ts`);
      rule(true); const soft = (o: any) => o.gone ? `~${o.text}~` : o.text;
      const show = (R: any[]) => R.map((r: any) => (r.sec ? `{${r.label}${r.note ? ` (${r.note})` : ''}: ${r.opts[0].text}}` : r.opts.length ? r.opts.map((o: any) => o.key ? `[${o.key}] ${o.text}` : soft(o)).join(' / ') : `'${r.label}'`) + (r.dist !== undefined ? ` ${r.dist}m` : '') + (r.progress !== undefined ? ' ▬' : '')).join(' | ') || 'nothing';
      // (a row as the page makes it: the thing's name and state over what parseOpts reads off the row's own second line — player.ts buildInteractables)
      const made = (kind: string, label: string, line2: string, over: any = {}) => ({ kind, label, opts: OV.parseOpts(line2), inReach: true, off: false, ...over });
      // (the panel of his picture: a door's row under its heading, the squad's title, four men — one lost — what they carry, the quick key's line)
      const door = made('door', 'door · open', 'Space  push it shut  ·  or sprint into it');
      const men = ['Gold 1 · stacked on the lobby door', 'Gold 2 · stacked on the lobby door', 'Blue 1 · covering the hall', 'Blue 2 · down'].map((text, i) => ({ key: '', text, gone: i === 3 }));
      const squad = [{ kind: 'objective', label: 'squad · loud · orders to gold', inReach: true, off: false, tone: 'gold', opts: [...men, { key: '', text: 'charges 2 · bangs 3' }, { key: '', text: 'frags 2' }, { key: '', text: 'charge set · lobby door — press F to blow it' }, { key: 'Q', text: 'move there · that spot' }] }];
      const A = cornerRows([door], 0, squad, 'par 1:00 / 1:30 / 2:00 · objective ▸ clear the back office · 2 left', [{ key: 'F', text: 'blow the charge · lobby door' }], 'infiltrate'), a = show(A.rows), flat = JSON.stringify(A.rows);
      const three = a === '{objective (par 1:00 / 1:30 / 2:00): clear the back office · 2 left} | [Space] push it shut | [F] blow the charge · lobby door | [Q] move there · that spot | ~Blue 2 · down~' && A.primary === 1 && A.rows[0].stage === 'infiltrate' && A.rows.slice(1).every((r: any) => r.one && r.label === '') && !/Gold|Blue 1|charges 2|frags|squad ·|door · open|sprint|press F/.test(flat);
      // (each only while it has something to say)
      const B = cornerRows([], -1, [{ ...squad[0], opts: men.slice(0, 3) }], ''), C = cornerRows([], -1, [{ ...squad[0], opts: squad[0].opts.filter((o: any) => !o.gone) }], 'objective ▸ reach the server room'), D = cornerRows([door], 0, [], '');
      // (a man in reach: both clicks · a verb running: its own words and its bar, no heading · one with no bar · a committed move's line · the word an
      //  empty tap left, with how far · the old list's cancel row is not one — each second line as player.ts words it)
      const man = made('guard', 'guard', 'LMB  knock him out  ·  RMB  grab him'), pick = made('door', 'door · locked', 'picking… 40%  ·  Space or a step breaks off', { progress: 0.4 }), wand = made('door', 'door · shut', 'looking under it — the cursor turns the lens  ·  Space or a step pulls it out');
      const word = { kind: 'door', label: 'door · step closer', opts: [], inReach: false, off: false, dist: 1.4 }, cancel = { kind: 'cancel', label: '', opts: [], inReach: true, off: false };
      const E = cornerRows([man, cancel], -1, [], ''), F = cornerRows([pick], 0, [], ''), W = cornerRows([wand], 0, [], ''), H = cornerRows([word], -1, [], '');
      const shapes = show(E.rows) === '[LMB] knock him out | [RMB] grab him' && E.primary === -1 && show(F.rows) === 'picking… 40% / Space or a step breaks off ▬' && show(W.rows) === 'looking under it — the cursor turns the lens / Space or a step pulls it out' && show(H.rows) === "'door · step closer' 1.4m";
      // (the line's own word is its label, whatever it is; a run's end is all words under none)
      const P1 = objectiveParts('training 2/7 ▸ press the key at the door'), P2 = objectiveParts('structure taken · 3:21 · GOLD — press shift+enter to restart'), P3 = objectiveParts('objective ▸ 0:42 · the charge in the vault');
      const parts = P1?.label === 'training 2/7' && P1.note === '' && P1.text === 'press the key at the door' && P2?.label === '' && P2.text.startsWith('structure taken') && P3?.label === 'objective' && P3.text === '0:42 · the charge in the vault' && objectiveParts('  ') === null;
      // (the page's own feed, asked with no page: what the panel is handed here, at a door with the squad — the three things; with the rule off the list as it was)
      const fed = (on: boolean, here = false) => { rule(on); HANDRING.on = !BRK; if (!here) { atDoor(); breath(); } const D = OV.Overlay.prototype['deriveInteractions'].call({}, g); return { rows: D.rows as any[], primary: D.primary as number, top: !D.rows.some((r: any) => r.sec) }; };   // (`top`: no section in what the panel is handed, so the line at the top still says it — setInteractions blanks that line only for a section it drew)
      const line = g.objectiveText(), on = fed(true), off = fed(false); rule(true);
      const wired = on.rows.every((r: any) => r.sec || r.one) && on.rows.some((r: any) => r.one && r.opts[0]?.key) && on.primary >= 0 && !!on.rows[on.primary]?.one && (!line || (on.rows[0].sec === true && !on.top)) && off.rows.every((r: any) => !r.sec && !r.one) && off.rows[0]?.label.length > 0 && off.top;
      // (a charge set on this door by hand, him a stride from it and then well away: whatever the block's line says of a key, or of who it would catch,
      //  the corner's notes say — a key's line under that key, a warning under none, nothing where the block's line says neither — and the panel has it)
      const DT: any = g.doorTools, leafD = g.doors.list.find((d: any) => d.def.name === 'conference'), { SAM_BY } = await import(`${ROOT}/src/game/ownblow.ts`), set0 = DT.set.length;
      const chargeAt = (near: boolean) => { rule(true); if (near) atDoor(); else floor(); step(20);
        const hn: string = (DT.hudNotes() as any[]).map((n: any) => typeof n === 'string' ? n : n.text).find((t: string) => /^charge set/.test(t)) ?? '', cn: any[] = DT.cornerNotes(), key = /press \w+ to blow it/.test(hn), warn = (hn.match(/(TOO CLOSE|BEHIND THE DOOR):.*$/) ?? [''])[0];
        const notes = key ? cn.length === 1 && cn[0].key.length > 0 && /^blow the charge/.test(cn[0].text) && cn[0].text.endsWith(warn) : warn ? cn.length === 1 && cn[0].key === '' && /^charge set/.test(cn[0].text) && cn[0].text.endsWith(warn) : cn.length === 0;
        const want = cn.filter((o: any) => !o.key || g.orders.active).map((o: any) => o.text), got = fed(true, true).rows.filter((r: any) => r.one).flatMap((r: any) => r.opts.map((o: any) => o.text)), panel = want.every((t: string) => got.includes(t)) && (want.length > 0 || !got.some((t: string) => /^charge set|TOO CLOSE|BEHIND THE DOOR/.test(t)));   // (his own charge's row, 'blow the charge' on his key, is his list's and stands either way)
        return { ok: notes && panel, say: `the block '${hn}' → ${cn.length ? cn.map((o: any) => `[${o.key}] ${o.text}`).join(' | ') : 'nothing'}, the panel ${panel ? 'has it so' : `HAS [${got.join(' | ')}] FOR [${want.join(' | ')}]`}${notes ? '' : ' (THE NOTES ARE NOT THE BLOCK\'S)'}` }; };
      DT.set.push({ door: leafD, side: 1, t: g.time, by: SAM_BY }); const cNear = chargeAt(true), cFar = chargeAt(false); DT.set.length = set0; step(20); const cNone = DT.cornerNotes().length === 0; rule(true);
      const charge = set0 === 0 && cNear.ok && cFar.ok && cNone;
      // (the panel's own gate: the three things with the rule on, the list as it was under the tour's puppet, with his ring's rule off, with this one off)
      const gate = cornerOn(false), gatePup = !cornerOn(true); HANDRING.on = false; const gateRing = !cornerOn(false); rule(true); HANDRING.corner = false; const gateOff = !cornerOn(false); rule(true);
      const all: any = JSON.parse(JSON.stringify(knobsSnapshot(g))), km = { ...K.KEYMAP };
      const page = await quiet(() => { PROFILE.pageSwitches(new URLSearchParams('')); const on = HANDRING.corner; PROFILE.pageSwitches(new URLSearchParams('corner=0')); const off = HANDRING.corner, rest = HANDRING.on && HANDRING.lone; applyKnobs(g, all); Object.assign(K.KEYMAP, km); return `${on ? 'on' : 'OFF'} as the page opens, ${off ? 'STILL ON' : 'off'} under ?corner=0${rest ? '' : ' (AND THE REST WITH IT)'}`; });
      const old = JSON.parse(JSON.stringify(all)); delete old.tables.HANDRING.corner;
      const offOld = await quiet(() => { applyKnobs(g, old); const o = HANDRING.corner === false; applyKnobs(g, all); return o && HANDRING.corner === !left('corner'); });
      verdict(three && B.rows.length === 0 && show(C.rows) === '{objective: reach the server room} | [Q] move there · that spot' && show(D.rows) === '[Space] push it shut' && D.primary === 0 && shapes && parts && wired && charge && gate && gatePup && gateRing && gateOff
        && /^on as the page opens, off under \?corner=0$/.test(page) && offOld && FROZEN_HOLDS['HANDRING.corner'] === 'TPS_HANDRING=1',
        'the corner panel is the objective, a line for each key that does something now, and a man lost: no heading, no line per man, no counts, and each only while it has something to say',
        `his picture's panel (a door's row under its heading, the squad's title, four men one of them lost, what they carry, a charge set, the quick key): ${a}, the lit line ${A.primary} · three men and nothing to press: ${show(B.rows)} · nothing in reach: ${show(C.rows)} · alone at a door, no objective: ${show(D.rows)} · a man in reach: ${show(E.rows)} · a pick running: ${show(F.rows)} · the wand under a door: ${show(W.rows)} · after an empty tap: ${show(H.rows)} · a lesson's line: [${P1?.label}] ${P1?.text} · a run's end: [${P2?.label}] ${P2?.text.slice(0, 22)}… · the page's feed at a door here ('${line}'): ${show(on.rows)}, lit ${on.primary}, the top line ${on.top ? 'STILL SAYS IT' : 'says nothing'}; with the rule off ${off.rows.length} rows under '${off.rows[0]?.label}', the top line ${off.top ? 'says it' : 'SAYS NOTHING'} · a charge set on this door by hand, him at it: ${cNear.say}; him away: ${cFar.say}; none set: nothing ${cNone} · the panel takes it ${gate}, not under the tour's puppet ${gatePup}, not with his ring's rule off ${gateRing}, not with its own off ${gateOff} · the page: ${page} · a file without the key: off ${offOld} · the frozen stand's word ${FROZEN_HOLDS['HANDRING.corner']}`); }
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
      let held = 'no mission', farHeld = '?', rowsIn = '?', rowsFree = '?', twice = '?', shutIt = false, inHand = false, stepHeld = false;
      const tables = JSON.parse(JSON.stringify(knobsSnapshot(g))), cmd1 = CMDRING.on; CMDRING.on = was.cmd;   // (the stand-up reads the squad ring's switch to set its dependents: the stand's own, not this check's)
      try { await quiet(async () => {
        const W: any = await standUp({ uploadEvery: 4, level: loadLevel(parseLevelData(readFileSync(`${ROOT}/levels/tut-quiet.json`, 'utf8'))), seed: 1 }); RAILS.on = true; startFromQuery(W.game, '?levelFile=tut-quiet.json&quiet'); rule(true);
        const q = W.game, I = W.input, DT = 1 / 60, L = q.level.scenarios.lesson, R = q.lesson.data?.rails, named: string[] | undefined = R?.rows, lean = named?.filter(v => v !== 'pull' && v !== 'ease'), back = q.doors.list.find((d: any) => d.def.name === 'back'), fb = back.frameCentre;
        const run = (n: number) => { for (let i = 0; i < n; i++) { W.cursorAt([fb[0], 1.0, fb[2]]); W.step(DT); } }, hit = (k: string) => { I.pressed.add(k); I.keys.add(k); run(1); I.keys.delete(k); run(1); };
        const qrows = () => q.nearby.map((r: any) => `${r.kind}:${r.verb ?? '-'}`).join(' | ') || 'none';
        // (the mission is HELD at that step: stepping in through the door ends it, and the step after it takes the interaction key away, so every tap
        // below would be a key the frame had taken, with no row to ask about. This stand's own copy of the level: its `done` is put out of reach)
        const nook = L.steps.findIndex((x: any) => x.id === 'nook'); L.steps[nook].done = { is: 'men', down: 99 };
        q.restartEncounter(); run(30); q.lesson.i = nook; back.locked = false; q.teleportPlayer([fb[0], 0, fb[2] + 0.7]); run(12);   // (the step that sends him in through it: the key is his, the lock is done)
        hit('Space'); run(150); if (R) R.rows = lean;   // (the court side: 'push' is a row the mission names — and from here its list has no row for an open leaf)
        const opened = !back.isClosed(); q.teleportPlayer([fb[0] + 0.15, 0, fb[2] - 0.55]); /* (inside, a little to the latch's side: clear of the leaf's way home) */ run(12); rowsIn = qrows(); const b0 = back.angle; clr(q); hit('Space'); run(20);
        held = `${opened ? '' : 'the door did not open · '}${said(q)}${Math.abs(back.angle - b0) < 0.01 ? '' : ' · the leaf moved'}`;
        // …and from a step short of it the word is the same: 'step closer' to a leaf the mission will not let him shut would be a walk for nothing
        q.teleportPlayer([fb[0] + 0.15, 0, fb[2] - 1.8]); run(12); clr(q); hit('Space'); run(10); farHeld = `${qrows() === 'none' ? '' : `rows ${qrows()} · `}${said(q)}`; q.teleportPlayer([fb[0] + 0.15, 0, fb[2] - 0.55]); run(12);
        if (R) R.rows = named; run(3); rowsFree = qrows(); clr(q); hit('Space'); run(40); shutIt = Math.abs(back.angle - b0) > 0.05 && said(q) === 'nothing said';
        // …and a second tap with the leaf already in his hand is no fault of the mission's ('push' is a row it names). Only where a push is his hand's
        // work (hands.ts, the page's stand): on the frozen stand the leaf is simply open by then, and the row it has left is the one the mission lacks
        run(120); clr(q); hit('Space'); run(2); inHand = !!q.player.doorMove; hit('Space'); run(4); twice = said(q); stepHeld = q.lesson.i === nook;
      }); } finally { await quiet(() => applyKnobs(g, tables)); CMDRING.on = cmd1; RAILS.on = rails0; }   // (every table as it stood before the mission was stood up)
      verdict(r0 === 'none' && far1 === FAR && far2 === FAR && lines === 1 && still && old === NONE && open === NONE && sprinting && offR < 1.35 && ran === RUN && wall === NONE && man === NONE && rowsIn === 'none' && stepHeld && held === HELD && farHeld === HELD && (!inHand || twice === `door · ${EMPTY_WHY.no}`) && shutIt && kept,
        'a tap that finds no row beside a thing names the thing and why: a stride short of a door, sprinting past it, and at a door the frame of a tutorial mission has no row for; open floor, a door behind a wall and a door with a man nearer are still nothing in reach',
        `1.8 m from the door [${r0}]: "${far1}", a second tap "${far2}" (one line of it in the log: ${lines === 1}), the leaf still ${still} · that word's switch off: "${old}" · open floor: "${open}" · sprinting ${sprinting} ${offR.toFixed(2)} m from it: "${ran}" · 1.9 m from ${walled ? `'${walled.name}'` : 'a door'} with a wall between: "${wall}" · 1.8 m from the door with a man 1.25 m off: "${man}" · the quiet mission held at the step that sends him in${stepHeld ? '' : ' (THE STEP MOVED ON UNDER THE TAPS)'}, with shutting a leaf off its rows, inside its open back door [${rowsIn}]: "${held}", from 1.8 m off it: "${farHeld}" · the same tap with the mission's rows as built [${rowsFree}]: the leaf moved and no word ${shutIt} · a second tap with the shut leaf ${inHand ? 'in his hand' : 'already swung open (no hand on it on this stand)'}: "${twice}" · a recording from before the word replays with it off, the frozen stand holds it by name ${kept}`); }
  } finally { HANDRING.on = was.on; HANDRING.early = was.early; HANDRING.empty = was.empty; HANDRING.near = was.near; HANDRING.lone = was.lone; HANDRING.loneWrap = was.loneWrap; HANDRING.onThing = was.onThing; HANDRING.bare = was.bare; HANDRING.corner = was.corner; HANDRING.turn = was.turn; BACKKEY.tab = was.back; HANDSLOT.on = was.slot; CMDRING.on = was.cmd; CMDRING.hands = was.hands; WALLSNAP.on = was.ws; WALLSNAP.press = was.press; K.setKeys({}); K.KEYMAP.on = was.kOn; K.KEYMAP.slotWhen = was.slotWhen; K.KEYMAP.handWhen = was.handWhen; K.KEYMAP.qFree = was.qFree; K.KEYMAP.qCmd = was.qCmd; G.localStorage = hadLS; console.log = log; console.error = err; console.warn = warn; }
  console.log(`\n=== handring: ${all ? 'ALL PASS' : 'FAIL'} ===`);
  return all;
}
