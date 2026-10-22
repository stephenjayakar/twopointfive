// EMPTY HANDS ARE A SLOT — the check behind HANDSLOT.on (src/game/handslot.ts; the rule in player.ts updatePlayer / updateHold) and the page's board for it
// (src/host/keymap.ts `slotWhen`, SLOT, ALIAS). ON in the page (?handslot=0 = E puts away and draws, as it was), OFF in the module and on the frozen
// stand (TPS_HANDSLOT=1).
//   bun run tools/qa/probes.ts handslot        (family `player`)        HANDSLOT_BREAK=1 = the rule and the board's layer left off and the same lines asked: must FAIL
// the maintainer, 10-22: "we also discussed having backtick be the empty state"; "when holding a guy, we can just have picking empty hands or pistol as the
// way to change equipment".
// WHAT IS ASKED:
//   the slot      with the pistol up, and with the rifle up: the slot's key empties his hands; pressed four times more they stay empty (it is never the way
//                 back); 1 draws the pistol, 2 the rifle
//   the old key   E's own code goes on putting away AND drawing, with the rule on (every recording and check that presses it means what it meant)
//   on a wall     back to a wall with the pistol chosen for the step off: the slot's key chooses empty hands for it, and a second press does not choose the
//                 pistol back; he steps off with nothing in his hands
//   a man held    the pistol at his head: the slot's key is the arm (and again leaves it the arm); 1 is the pistol at his head again (and again leaves it there)
//   off           the rule off: the slot's key does nothing to his hands, on the floor or with a man held
//   the board     while the page says the slot is on: the backtick key gives the slot's code, the backslash key the debugger's, E and 0 give nothing,
//                 every other key is itself; the slot's cap is backtick, the debugger's backslash; 'E puts it away' reads as backtick, a line naming
//                 the debugger's backtick reads backslash; the slot put on K by the player takes the words with it, is kept, and Reset is backtick again;
//                 a table kept with backtick on another row leaves the slot on 0; E's row kept on a key of its own is that key in caps and words; a 0
//                 in a line of words is a count; with the slot off its row holds no key against another row; and the board and the words are as they were
//   recordings    a recording carries the switch; one from before it replays with it off; the frozen stand holds it off by name
// Headless: the player's hands, the hold's variant, the board's answers. NOBODY HAS PLAYED IT.
import { ROOT } from './headless.ts';
import { world } from './wallsnap-probes.ts';
export async function handSlotCheck(): Promise<boolean> {
  const BRK = process.env.HANDSLOT_BREAK === '1'; let all = true;
  const verdict = (ok: boolean, what: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}\n    ${detail}`); };
  console.log(`\n=== handslot: empty hands are a slot${BRK ? ' (the rule and the board\'s layer off: must fail)' : ''} ===`);
  const { HANDSLOT, HANDSLOT_KEY } = await import(`${ROOT}/src/game/handslot.ts`); const { WALLSNAP } = await import(`${ROOT}/src/game/wallsnap.ts`);
  const { startGrab } = await import(`${ROOT}/src/game/player.ts`);
  const { knobsSnapshot, applyKnobs } = await import(`${ROOT}/src/game/journal.ts`); const { FROZEN_HOLDS } = await import(`${ROOT}/src/host/profile.ts`);
  const K = await import(`${ROOT}/src/host/keymap.ts`);
  const was = { on: HANDSLOT.on, ws: WALLSNAP.on, press: WALLSNAP.press, kOn: K.KEYMAP.on, slotWhen: K.KEYMAP.slotWhen, qFree: K.KEYMAP.qFree, qCmd: K.KEYMAP.qCmd }, log = console.log, err = console.error, warn = console.warn;
  const quiet = async <T>(f: () => T | Promise<T>): Promise<T> => { console.log = console.error = console.warn = () => { }; try { return await f(); } finally { console.log = log; console.error = err; console.warn = warn; } };
  const G: any = globalThis, hadLS = G.localStorage; const store = new Map<string, string>();
  G.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, String(v)); }, removeItem: (k: string) => { store.delete(k); } };
  try {
    const S = await quiet(() => world(true)); const { pl, g, step, tap, place, keys } = S as any; WALLSNAP.press = false;
    const rule = (on: boolean) => { HANDSLOT.on = on && !BRK; };
    const KEY = HANDSLOT_KEY, hands = () => pl.holstered ? 'empty' : pl.slot;
    const press = (k: string, n = 12) => { tap(k); step(n); };
    // ---- the slot
    { rule(true); const seen: string[] = [];
      for (const kit of ['pistol', 'rifle'] as const) {
        place(30, 2.4, 180, kit); const up = hands(); press(KEY, 40); const one = hands(); let stayed = true; for (let i = 0; i < 4; i++) { press(KEY, 20); stayed &&= hands() === 'empty'; }
        press('Digit1', 40); const d1 = hands(); press(KEY, 40); press('Digit2', 60); const d2 = hands(); press(KEY, 40);
        seen.push(`${kit}: up ${up}, the key → ${one}, four more ${stayed ? 'stay empty' : 'DREW'}, 1 → ${d1}, 2 → ${d2}, the key → ${hands()}`);
        if (up !== kit || one !== 'empty' || !stayed || d1 !== 'pistol' || d2 !== 'rifle' || hands() !== 'empty') seen.push('  ^ wrong');
      }
      verdict(!seen.some(s => s.includes('wrong')), 'the slot\'s key empties his hands and is never the way back; a digit draws', seen.join(' · ')); }
    // ---- the old key
    { rule(true); place(30, 2.4, 180, 'pistol'); press('KeyE', 40); const away = hands(); press('KeyE', 40); const back = hands();
      verdict(away === 'empty' && back === 'pistol', 'E\'s own code still puts away and draws with the rule on', `E → ${away}, E → ${back}`); }
    // ---- on a wall
    { rule(true); place(21, 11.0, 180, 'pistol'); press('KeyQ', 60); const onWall = !!pl.wall, drawn0 = pl.wall?.drawn;
      press(KEY, 10); const d1 = pl.wall?.drawn; press(KEY, 10); const d2 = pl.wall?.drawn; press('KeyQ', 60); const off = !pl.wall, after = hands();
      verdict(onWall && drawn0 === true && d1 === false && d2 === false && off && after === 'empty', 'on a wall the slot\'s key chooses empty hands for the step off, and a second press does not undo it',
        `on the wall ${onWall}, the pistol waiting ${drawn0} · the key → waiting ${d1} · again → ${d2} · stepped off ${off} with ${after} in his hands`); }
    // ---- a man held
    const hold = (kit: 'pistol' | 'empty') => {
      place(30, 2.4, 180, kit); const gd = g.guards[0]; gd.char.pos = [30, 0, 1.6]; gd.char.bodyYaw = Math.PI; gd.char.vel = [0, 0, 0]; gd.char.update(0); step(2);
      startGrab(g, gd); for (let i = 0; i < 240 && pl.holding?.phase !== 'held'; i++) step(1); step(60); return gd; };
    const letGo = (gd: any) => { g.dropHold?.(); if (pl.holding) { pl.holding = null; gd.held = undefined; } gd.char.pos = [38.5, 0, 1.5]; gd.char.update(0); step(10); };
    { rule(true); const gd = await quiet(() => hold('pistol')); const v0 = pl.holding?.variant;
      press(KEY, 70); const v1 = pl.holding?.variant; press(KEY, 70); const v2 = pl.holding?.variant; press('Digit1', 70); const v3 = pl.holding?.variant; press('Digit1', 70); const v4 = pl.holding?.variant;
      verdict(v0 === 'gun' && v1 === 'arm' && v2 === 'arm' && v3 === 'gun' && v4 === 'gun', 'with a man held the slot\'s key is the arm and 1 the pistol at his head, each pressed twice',
        `grabbed with the pistol: ${v0} · the key → ${v1} · again → ${v2} · 1 → ${v3} · again → ${v4}`);
      // ---- off (the hold's half)
      rule(false); press(KEY, 70); const o1 = pl.holding?.variant; press('KeyE', 70); const o2 = pl.holding?.variant; await quiet(() => letGo(gd));
      place(30, 2.4, 180, 'pistol'); press(KEY, 40); const o3 = hands(); press('Digit0', 40);
      verdict(!BRK && o1 === 'gun' && o2 === 'arm' && o3 === 'pistol' && hands() === 'pistol', 'the rule off: the slot\'s key does nothing, on the floor or with a man held (E swaps the hold as it did)',
        `held: the key → ${o1}, E → ${o2} · on the floor with the pistol up: the key → ${o3}`); }
    // ---- the board
    { K.KEYMAP.on = true; K.KEYMAP.qFree = false; K.KEYMAP.qCmd = false; K.setKeys({}); let live = true; K.KEYMAP.slotWhen = BRK ? null : () => live;
      const BOARD = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyR', 'KeyZ', 'KeyL', 'KeyN', 'KeyV', 'KeyB', 'KeyF', 'Space', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'ShiftLeft', 'KeyK', 'Minus'];
      const codes = () => `\` ${K.gameCode('Backquote') || '∅'} · \\ ${K.gameCode('Backslash') || '∅'} · E ${K.gameCode('KeyE') || '∅'} · 0 ${K.gameCode('Digit0') || '∅'}`;
      const on = K.gameCode('Backquote') === 'Digit0' && K.gameCode('Backslash') === 'Backquote' && K.gameCode('KeyE') === '' && K.gameCode('Digit0') === '' && BOARD.every(c => K.gameCode(c) === c);
      const caps = K.capNow('Digit0') === '`' && K.capNow('Backquote') === '\\' && K.keyCap('E') === '`';
      const w1 = K.keyText('E puts it away. A grab needs empty hands'), w2 = K.keyText('no questions over a gun — E holsters it, then Space asks him'), w3 = K.keyText('Esc pauses · ` opens the debugger (every knob)'), w4 = K.keyText('E', true);
      const words = w1 === '` puts it away. A grab needs empty hands' && w2 === 'no questions over a gun — ` holsters it, then Space asks him' && w3 === 'Esc pauses · \\ opens the debugger (every knob)' && w4 === '`';
      const seenOn = codes();
      const r = K.bindKey('Digit0', 'KeyK'), moved = r.ok && K.gameCode('KeyK') === 'Digit0' && K.gameCode('Backquote') === '' && K.capNow('Digit0') === 'K' && K.keyText('E puts it away') === 'K puts it away' && K.keysChanged();
      const kept = store.get('twopointsix.keys') ?? ''; K.resetKeys(); const reset = K.gameCode('Backquote') === 'Digit0' && !K.keysChanged() && store.get('twopointsix.keys') === undefined;
      // tables kept before the slot, and odd ones: backtick already another row's → the slot is on 0; E's row on a key of its own → that key in caps and words; '0' in a line of words is a count
      K.setKeys({ KeyN: 'Backquote', Backquote: 'KeyN' }); const taken = K.gameCode('Digit0') === 'Digit0' && K.gameCode('Backquote') === 'KeyN' && K.capNow('Digit0') === '0';
      K.setKeys({ KeyE: 'KeyG', KeyG: 'KeyE' }); const eKept = K.gameCode('KeyG') === 'KeyE' && K.keyCap('E') === 'G' && K.keyText('E puts it away') === 'G puts it away' && K.gameCode('Backquote') === 'Digit0';
      K.setKeys({}); const count = K.keyText('ammo 0 again') === 'ammo 0 again' && K.keyText('press 0') === 'press 0' && K.keyText('0', true) === '`';
      const odd = taken && eKept && count;
      live = false; K.setKeys({}); const sw = K.bindKey('KeyC', 'Digit0'), noRow = sw.ok && !sw.swapped && K.gameCode('Digit0') === 'KeyC' && JSON.stringify(K.keysKept()) === '{"KeyC":"Digit0"}'; K.resetKeys(); live = true; K.setKeys({});
      live = false; const offCodes = codes(), off = !BRK && ['Backquote', 'Backslash', 'KeyE', 'Digit0', ...BOARD].every(c => K.gameCode(c) === c) && K.keyText('E puts it away') === 'E puts it away' && K.capNow('KeyE') === 'E' && K.capNow('Backquote') === '`';
      verdict(on && caps && words && moved && reset && off && odd && noRow, 'the page\'s board: the slot on backtick, the debugger on backslash, E and 0 give nothing, the words follow; put on K, reset; kept tables; off = as it was',
        `on: ${seenOn}, the rest themselves ${on} · caps ${caps} · words ${words} ("${w1.slice(0, 16)}…", "${w3.slice(12, 22)}…") · on K ${moved} (kept ${kept || 'nothing'}) · Reset ${reset} · backtick already night vision's: the slot on 0 ${taken} · E kept on G: G in caps and words ${eKept} · a 0 in words is a count ${count} · slot off, crouch put on 0: no swap, no row kept ${noRow} · off: ${offCodes} ${off}`); }
    // ---- recordings
    { HANDSLOT.on = true; const snap: any = JSON.parse(JSON.stringify(knobsSnapshot(g))), has = typeof snap.tables?.HANDSLOT?.on === 'boolean' && !BRK;
      const old = JSON.parse(JSON.stringify(snap)); delete old.tables.HANDSLOT;
      const offOld = await quiet(() => { applyKnobs(g, old); const off = HANDSLOT.on === false; applyKnobs(g, snap); return off && HANDSLOT.on === true; });
      verdict(has && offOld && FROZEN_HOLDS['HANDSLOT.on'] === 'TPS_HANDSLOT=1', 'a recording carries the switch, one from before it replays with it off, the frozen stand holds it off by name',
        `carried ${has} · a file without it: off, and on again with it ${offOld} · the frozen stand's word ${FROZEN_HOLDS['HANDSLOT.on']}`); }
    void keys;
  } finally { HANDSLOT.on = was.on; WALLSNAP.on = was.ws; WALLSNAP.press = was.press; K.setKeys({}); K.KEYMAP.on = was.kOn; K.KEYMAP.slotWhen = was.slotWhen; K.KEYMAP.qFree = was.qFree; K.KEYMAP.qCmd = was.qCmd; G.localStorage = hadLS; console.log = log; console.error = err; console.warn = warn; }
  console.log(`\n=== handslot: ${all ? 'ALL PASS' : 'FAIL'} ===`);
  return all;
}
