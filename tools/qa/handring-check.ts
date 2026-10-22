// HIS OWN ACTIONS ARE A RING THAT STAYS — the check behind HANDRING.on (src/game/handring.ts; the rule in interact.ts updateInteract, the whistle's row in
// player.ts buildInteractables) and the page's board for it (src/host/keymap.ts `handWhen`, HAND). ON in the page (?handring=0 = the list on a held Space,
// the whistle on its key, as it was), OFF in the module and on the frozen stand (TPS_HANDRING=1).
//   bun run tools/qa/probes.ts handring        (family `player`)        HANDRING_BREAK=1 = the rule and the board's layer left off and the same lines asked: must FAIL
//   (all but the tap's line: a tap is the tap it was, rule on or off)
// the maintainer, 10-22: "radial menu for our own actions, remove existing menu in top left and awkward scrolling thing", "move whistle to our actions and
// remove v binding", "move our actions to E", "i think same would go for our actions (1-5 with the ring open)".
// WHAT IS ASKED:
//   the tap       at a door a tap does the top row (the leaf moves) and puts no ring up; on open floor a tap does nothing (the whistle is never a tap)
//   the ring      the key kept down: nothing before HANDRING.holdSecs, then the ring with a wedge for the door's row and the whistle on the LAST wedge; let
//                 go in the middle and it stays with no key held; his feet are his own under it
//   a digit       standing, the last wedge's digit whistles at once and the ring is gone — and it was no weapon slot; a digit with no wedge does nothing
//                 and the ring stays; the whistle's digit, or a click, before the breath is back lights it and the ring stays
//   a click       standing, with the pistol up: a left click does the lit wedge and no round leaves the gun
//   the cursor    the key kept down, the cursor out toward the last wedge the moment the ring is up, the key let go: that wedge is done (no second press)
//   under it      a ring that merely stands is nothing in hand: the wheel is his pace, the squad's key is free, a save is allowed
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
  const was = { on: HANDRING.on, back: BACKKEY.tab, slot: HANDSLOT.on, cmd: CMDRING.on, hands: CMDRING.hands, ws: WALLSNAP.on, press: WALLSNAP.press, kOn: K.KEYMAP.on, slotWhen: K.KEYMAP.slotWhen, handWhen: K.KEYMAP.handWhen, qFree: K.KEYMAP.qFree, qCmd: K.KEYMAP.qCmd };
  const log = console.log, err = console.error, warn = console.warn;
  const quiet = async <T>(f: () => T | Promise<T>): Promise<T> => { console.log = console.error = console.warn = () => { }; try { return await f(); } finally { console.log = log; console.error = err; console.warn = warn; } };
  const G: any = globalThis, hadLS = G.localStorage; const store = new Map<string, string>();
  G.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, String(v)); }, removeItem: (k: string) => { store.delete(k); } };
  try {
    const S = await quiet(() => world(true)); const { pl, g, step, tap, place, input, click, keys, setCursor } = S as any; WALLSNAP.press = false; CMDRING.on = false; CMDRING.hands = false; BACKKEY.tab = true;   // (the back key is Tab, as the page has it)
    const rule = (on: boolean) => { HANDRING.on = on && !BRK; };
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
      floor(); const r1 = rows(), b0 = WHISTLE_STATS.blown; tap(KEY); step(20); const quietTap = WHISTLE_STATS.blown === b0;
      verdict(moved && noRing && quietTap && r1 === 'none', 'a tap does the top row and puts no ring up; on open floor a tap does nothing (the whistle is never a tap)',
        `at the door [${r0}], the tap's row ${top}: the leaf ${a0.toFixed(2)} → ${leaf().toFixed(2)}, ring ${!noRing} · open floor [${r1}]: a tap blew ${WHISTLE_STATS.blown - b0}`); }
    // ---- the ring
    { rule(true); atDoor(); down(HOLD - 4); const early = up(); step(8); const v1 = view(), V = handRingView(g), hasDoor = !!V?.wedges.some((w: any) => w.key === 1), hasWhistle = !!V?.wedges.some((w: any) => w.key === LAST && /whistle/.test(w.text));
      lift(); const stays = standing(), v2 = view(); const z0 = pl.char.pos[2]; keys('KeyW'); step(30); keys(); const walked = Math.abs(pl.char.pos[2] - z0) > 0.2, still = standing(); tap('Tab'); step(2);
      verdict(!early && hasDoor && hasWhistle && stays && walked && still, 'the key kept down puts the ring up after the hold, the whistle on the last wedge; let go in the middle it stays; he can walk under it',
        `before the hold: ring ${early} · after: ${v1} · let go: ${v2} · W for half a second under it moved him ${Math.abs(pl.char.pos[2] - z0).toFixed(2)} m, the ring still standing ${still}`); }
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
  } finally { HANDRING.on = was.on; BACKKEY.tab = was.back; HANDSLOT.on = was.slot; CMDRING.on = was.cmd; CMDRING.hands = was.hands; WALLSNAP.on = was.ws; WALLSNAP.press = was.press; K.setKeys({}); K.KEYMAP.on = was.kOn; K.KEYMAP.slotWhen = was.slotWhen; K.KEYMAP.handWhen = was.handWhen; K.KEYMAP.qFree = was.qFree; K.KEYMAP.qCmd = was.qCmd; G.localStorage = hadLS; console.log = log; console.error = err; console.warn = warn; }
  console.log(`\n=== handring: ${all ? 'ALL PASS' : 'FAIL'} ===`);
  return all;
}
