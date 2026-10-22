// THE SLOT IN HAND, PRESSED AGAIN, OPENS ITS SETUP — the check behind SLOTSETUP.on (src/game/slotsetup.ts; on in the page, ?slotsetup=0; off in the module
// and on the frozen stand, TPS_SLOTSETUP=1).
//   bun run tools/qa/probes.ts slotsetup                       (family `kit`)         TPS_PROFILE=shipped in front = the page's stand
//   SLOTSETUP_BREAK=1 bun run tools/qa/probes.ts slotsetup     the rule dead and the same lines asked: must FAIL
// EVERY LINE IS ASKED THROUGH THE INPUT: a digit, the back key or a click in a tick, the rifle staged in his hands as play stages it (fn2000-probes.ts).
// The rule is raised by hand for the lines that ask it and put down for the lines that ask the build before, so both stands run the same lines.
//   opens        2 with the rifle up: the setup is up, the launcher's load has not moved, the back key has something to back out of
//   the rows     2 1 the selector goes over and the setup shuts · 2 2 the next load · 2 3 the light · with `stay` a pick leaves it up for another
//   shuts        the back key (taken: nothing after it reads it) · the trigger (and the round goes) · a digit that is no row (4: the stun can is in his fist)
//                · by itself after `secs` · when the gun leaves his hands · when Space goes down for its list
//   the loads    a load he is out of is stepped over; with nothing else to put up the row has no digit
//   Esc, words   Game.escape shuts it (the pause is for nothing to back out of) · the lines that name the launcher's presses follow the rule
//   not opened   a double-tapped 2 from the sling draws the rifle and no more · a can's digit pressed again is as it was
//   the pistol   1 again: its setup; 3 its light
//   off          the build as it was: 2 again steps the load, nothing is ever up, and a run of the same keys ends in the same state as a game that never
//                had the module's hook asked (the field stays null, the digits reach the slot lines)
//   the journal  a recording from before the key (no SLOTSETUP table) replays with the rule off; one made with it on, on
//   the board    host/keymap.ts with `setFree`: Z and L give the game nothing, each row can be put on a key and then gives its code; without it, as built
import { ROOT } from './headless.ts';
type V = [number, number, number];
const DT = 1 / 60;
export async function slotSetupCheck(): Promise<boolean> {
  const BRK = process.env.SLOTSETUP_BREAK === '1'; let all = true;
  const verdict = (ok: boolean, what: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}\n    ${detail}`); };
  console.log(`\n=== slotsetup: the slot in hand pressed again opens its setup${BRK ? ' (the rule dead: must fail)' : ''} ===`);
  const { SLOTSETUP, slotSetupOpen, setupRows, loadKeys, lightKeys, slotSetupTakes } = await import(`${ROOT}/src/game/slotsetup.ts`);
  const { knobsSnapshot, applyKnobs } = await import(`${ROOT}/src/game/journal.ts`); const { FROZEN_HOLDS } = await import(`${ROOT}/src/host/profile.ts`);
  const { BACKKEY } = await import(`${ROOT}/src/game/backkey.ts`);
  const { stage, hudText } = await import('./fn2000-probes.ts');
  const was = { ...SLOTSETUP }, wasTab = BACKKEY.tab, log = console.log, err = console.error, warn = console.warn;
  const quiet = async <T>(f: () => T | Promise<T>): Promise<T> => { console.log = console.error = console.warn = () => { }; try { return await f(); } finally { console.log = log; console.error = err; console.warn = warn; } };
  const AHEAD: V = [35.5, 1.2, 11.5];
  const key = (W: any, code: string, n = 1) => { W.input.pressed.add(code); for (let i = 0; i < n; i++) { W.cursorAt(AHEAD); W.step(DT); } };
  const wait = (W: any, secs: number) => { for (let i = 0; i < Math.round(secs * 60); i++) { W.cursorAt(AHEAD); W.step(DT); } };
  /** the rifle in his hands, off the sling and settled, the rule as asked */
  const rifle = async (rule: boolean, seed = 4101) => quiet(async () => { SLOTSETUP.on = rule; SLOTSETUP.secs = was.secs; SLOTSETUP.settle = was.settle; SLOTSETUP.stay = false; const W: any = await stage(seed); SLOTSETUP.on = rule;
    const g = W.game, pl = g.player; g.aiEnabled = false; pl.rifle.shells = Math.max(pl.rifle.shells, 2);   // (a grenade for the launcher on every stand: a load he is out of is stepped over)
    for (let i = 0; i < 90 && (pl.equipT > 0 || !pl.rifleUp); i++) wait(W, DT); wait(W, 0.5); return { W, g, pl, rf: pl.rifle }; });
  const up = (g: any) => slotSetupOpen(g);
  try {
    // ---- opens
    { const { W, g, pl, rf } = await rifle(true); const a0 = rf.attachment, held = pl.rifleUp, able0 = g.backable();
      await quiet(() => key(W, 'Digit2')); const open = up(g), a1 = rf.attachment, able = g.backable(), slot = pl.slot, rows = setupRows(pl, 'rifle').map((r: any) => `${r.key} ${r.kind}`).join(' · ');
      verdict(held && !able0 && open && a1 === a0 && able && slot === 'rifle' && /1 mode/.test(rows) && /2 load/.test(rows), '2 with the rifle in his hands opens its setup: the load on the launcher has not moved, and the back key has something to back out of',
        `rifle up ${held} · setup up ${open} · load ${a0} → ${a1} · backable before ${able0}, after ${able} · rows: ${rows}`); }
    // ---- the rows: the same two presses each time
    { const { W, g, pl, rf } = await rifle(true); const m0 = rf.mode, a0 = rf.attachment, l0 = rf.lightOn;
      await quiet(() => { key(W, 'Digit2'); key(W, 'Digit1'); }); const m1 = rf.mode, shut1 = !up(g), slot1 = pl.slot;
      await quiet(() => { key(W, 'Digit2'); key(W, 'Digit2'); }); const a1 = rf.attachment, shut2 = !up(g);
      await quiet(() => { key(W, 'Digit2'); key(W, 'Digit3'); }); const l1 = rf.lightOn, shut3 = !up(g), slot3 = pl.slot, cans = pl.canisters;
      verdict(m1 !== m0 && shut1 && slot1 === 'rifle' && a1 !== a0 && shut2 && l1 !== l0 && shut3 && slot3 === 'rifle', '2 1 puts the selector over, 2 2 the next load on the launcher, 2 3 the light on; each pick shuts the setup and the rifle stays in his hands',
        `selector ${m0} → ${m1} (shut ${shut1}, slot ${slot1}) · load ${a0} → ${a1} (shut ${shut2}) · light ${l0} → ${l1} (shut ${shut3}, slot ${slot3}, smoke still ${cans})`); }
    { const { W, g, rf } = await rifle(true); SLOTSETUP.stay = true; const m0 = rf.mode, a0 = rf.attachment;
      await quiet(() => { key(W, 'Digit2'); key(W, 'Digit1'); }); const stay1 = up(g); await quiet(() => key(W, 'Digit2')); const stay2 = up(g), m1 = rf.mode, a1 = rf.attachment; SLOTSETUP.stay = false;
      verdict(stay1 && stay2 && m1 !== m0 && a1 !== a0, 'with `stay` a pick leaves the setup up: 2 1 2 sets the selector and then the load in one visit', `up after the first pick ${stay1}, after the second ${stay2} · selector ${m0} → ${m1} · load ${a0} → ${a1}`); }
    // ---- shuts
    { const A = await rifle(true); BACKKEY.tab = true; await quiet(() => key(A.W, 'Digit2')); const openA = up(A.g); await quiet(() => key(A.W, 'Tab')); const shutA = !up(A.g), slotA = A.pl.slot, ableA = A.g.backable(); BACKKEY.tab = wasTab;
      const B = await rifle(true); await quiet(() => key(B.W, 'Digit2')); const r0 = B.rf.roundsReady; await quiet(() => { B.W.cursorAt(AHEAD); B.W.input.clicked |= 1; B.W.input.buttons |= 1; B.W.step(DT); B.W.input.buttons &= ~1; wait(B.W, 0.1); }); const shutB = !up(B.g), fired = r0 - B.rf.roundsReady;
      const C = await rifle(true); await quiet(() => { key(C.W, 'Digit2'); key(C.W, 'Digit4'); }); const shutC = !up(C.g), slotC = C.pl.slot;
      const D = await rifle(true); await quiet(() => key(D.W, 'Digit2')); const mid = (await quiet(() => wait(D.W, SLOTSETUP.secs - 0.5)), up(D.g)); await quiet(() => wait(D.W, 1)); const shutD = !up(D.g), m0 = D.rf.mode; await quiet(() => key(D.W, 'Digit1', 3)); const slotD = D.pl.slot, m1 = D.rf.mode;
      const E = await rifle(true); await quiet(() => key(E.W, 'Digit2')); const openE = up(E.g); await quiet(() => key(E.W, 'KeyE', 2)); const shutE = openE && !up(E.g) && E.pl.setup === null, slung = E.pl.holstered;
      verdict(openA && shutA && !ableA && slotA === 'rifle' && shutB && fired === 1 && shutC && slotC === 'flash' && mid && shutD && slotD === 'pistol' && m1 === m0 && shutE && slung,
        'the setup shuts on the back key, on the trigger (the round goes), on a digit that is no row (4: the stun can comes to his fist), by itself after its seconds (a 1 after that is the pistol, as ever), and when the gun leaves his hands',
        `Tab: up ${openA} → shut ${shutA}, anything left to back out of ${ableA}, slot ${slotA} · click: shut ${shutB}, rounds gone ${fired} · 4: shut ${shutC}, slot ${slotC} · ${SLOTSETUP.secs} s: up half a second before ${mid}, shut after ${shutD}, then 1 → slot ${slotD}, selector ${m0} → ${m1} · slung with it up: shut ${shutE}, slung ${slung}`); }
    // ---- a load he is out of is stepped over; another list's digits shut it
    { const A = await rifle(true), rf = A.rf; if (!rf.attachments.includes('cam')) rf.attachments.push('cam'); rf.cams = 2; rf.shells = 0; const a0 = rf.attachment;   // (ring up · no grenade · two cameras behind it)
      await quiet(() => { key(A.W, 'Digit2'); key(A.W, 'Digit2'); }); const a1 = rf.attachment; rf.rings = 0; const rows = setupRows(A.pl, 'rifle').map((r: any) => r.kind).join(' ');   // (…and now nothing but the one that is up)
      await quiet(() => { key(A.W, 'Digit2'); key(A.W, 'Digit2'); }); const a2 = rf.attachment, shut = !up(A.g); rf.rings = 3; await quiet(() => { key(A.W, 'Digit2'); key(A.W, 'Digit2'); }); const a3 = rf.attachment;
      const B = await rifle(true); await quiet(() => key(B.W, 'Digit2')); const openB = up(B.g); await quiet(() => { B.W.input.keys.add('Space'); key(B.W, 'Space', 3); }); const down = B.pl.sel.downT >= 0 || B.pl.sel.open, shutB = down && B.pl.setup === null; B.W.input.keys.delete('Space');   // (Space going down: the list's own keys from here)
      verdict(a0 === 'ring' && a1 === 'cam' && !/load/.test(rows) && a2 === 'cam' && shut && a3 === 'ring' && openB && shutB, 'the load row steps over a load he is out of (ring to the camera, past the empty grenade), has no digit with nothing else to put up (2 2 then only shuts it), and comes back with a ring in the tube; Space going down for its list shuts the setup',
        `${a0} → ${a1} with no grenade · rows with the tube's other loads empty: ${rows || 'none'} · 2 2 then: ${a2}, shut ${shut} · three rings back: ${a3} · Space down: setup was ${openB}, the list's key held ${down}, gone ${shutB}`); }
    // ---- Esc where the back key's rule is off, and the words that name the presses
    { const A = await rifle(true); await quiet(() => key(A.W, 'Digit2')); const open = up(A.g), tk = (c: string) => slotSetupTakes(A.g, c), takeUp = `${tk('Digit1')} ${tk('Digit2')} ${tk('Digit3')} ${tk('Digit4')} ${tk('KeyX')}`, esc = A.g.escape(), gone = !up(A.g) && A.pl.setup === null, again = A.g.escape(), takeShut = `${tk('Digit1')} ${tk('Digit2')} ${tk('Digit3')}`, on = `${loadKeys()} · ${lightKeys()}`; SLOTSETUP.on = false; const off = `${loadKeys()} · ${lightKeys()}`, takeOff = tk('Digit2'); SLOTSETUP.on = true;
      verdict(open && esc && gone && !again && on === 'press 2, then 2 · its gun\'s key again, then 3' && off === '2 again · on L' && takeUp === 'true true true false false' && takeShut === 'false true false' && !takeOff,
        'Game.escape shuts an open setup and says so (Esc pauses only with nothing to back out of); the words name the presses as they are, \'2 again\' and \'on L\' with the rule off; the setup\'s own digits (the gun\'s, and a row\'s while it is up) are the ones the page does not let the carried aim go for',
        `up ${open} · escape() ${esc}, gone ${gone}, a second escape() ${again} · the words: '${on}', off '${off}' · its own keys with it up (1 2 3 4 X): ${takeUp}, shut (1 2 3): ${takeShut}, rule off (2): ${takeOff}`); }
    // ---- not opened
    { SLOTSETUP.on = true; const W: any = await quiet(() => stage(4102, false)); SLOTSETUP.on = true; const g = W.game, pl = g.player; g.aiEnabled = false; const rf = pl.rifle, a0 = rf.attachment;
      await quiet(() => { key(W, 'Digit2', 3); key(W, 'Digit2', 2); }); const mid = pl.equipT > 0, openEarly = up(g); await quiet(() => wait(W, 1.5)); const inHand = pl.rifleUp, a1 = rf.attachment, openLate = up(g);
      await quiet(() => { key(W, 'Digit3', 30); }); const smoke = pl.slot; await quiet(() => key(W, 'Digit3', 3)); const again = pl.slot, openCan = up(g);
      verdict(mid && !openEarly && inHand && a1 === a0 && !openLate && smoke === 'smoke' && again === 'smoke' && !openCan, 'a double-tapped 2 from the sling draws the rifle and no more (no setup, the load not moved); a can\'s digit pressed again is as it was',
        `second 2 came mid-draw ${mid} · setup up then ${openEarly}, once drawn ${openLate} · rifle in hand ${inHand} · load ${a0} → ${a1} · 3 → ${smoke}, 3 again → ${again}, setup ${openCan}`); }
    // ---- the pistol
    { SLOTSETUP.on = true; const W: any = await quiet(() => stage(4103, false)); SLOTSETUP.on = true; const g = W.game, pl = g.player; g.aiEnabled = false; const gun = pl.pistol;
      await quiet(() => { key(W, 'Digit3', 30); key(W, 'Digit1', 2); }); const inHand = !!pl.gunInHand(); await quiet(() => key(W, 'Digit1', 2)); const tap = up(g) || pl.setup !== null;   // (1 1 off a can, a twentieth of a second apart: the draw and no more)
      await quiet(() => wait(W, 0.7)); const drawn = pl.pistolUp, shut0 = !up(g), l0 = gun.lightOn; await quiet(() => key(W, 'Digit1')); const open = up(g), rows = setupRows(pl, 'pistol').map((r: any) => `${r.key} ${r.kind}`).join(' · ');
      await quiet(() => key(W, 'Digit3')); const l1 = gun.lightOn, slot = pl.slot, shut = !up(g);
      const C: any = await quiet(() => stage(4103, false)); SLOTSETUP.on = true; SLOTSETUP.settle = 0; await quiet(() => { key(C, 'Digit3', 30); key(C, 'Digit1', 2); key(C, 'Digit1', 2); }); const tap0 = slotSetupOpen(C.game), swap0 = C.game.player.equipT > 0; SLOTSETUP.settle = was.settle;   // (the same two taps with no settling time: what the time is there for — unless the swap's own time has his hands, as with the kit's handling on)
      verdict(drawn && inHand && !tap && (tap0 || swap0) && shut0 && open && /3 light/.test(rows) && l1 !== l0 && slot === 'pistol' && shut, '1 draws the pistol, and a double-tapped 1 is the draw and no more (with the settling time at 0 it opens the setup, where the swap itself takes no time); 1 again once it has settled opens its setup; 3 there is its light, and the pistol stays in his hand', `1 1 off a can: in his hand at the second ${inHand}, setup ${tap} (settle 0: ${tap0}${swap0 ? ', the swap still under way' : ''}) · drawn ${drawn} (no setup yet ${shut0}) · 1 again: up ${open} · rows: ${rows} · light ${l0} → ${l1} · slot ${slot} · shut ${shut}`); }
    // ---- the box (ui/handbox.ts) off the real overlay code, on the probes' stand-in page
    { const { W, g, pl } = await rifle(true); const shut = hudText(g), caps = (t: string) => (t.match(/kbd(\.no)?\{\d\}/g) ?? []).join(' ');
      await quiet(() => key(W, 'Digit2')); const open = hudText(g); await quiet(() => key(W, 'Tab')); pl.setup = null;
      pl.holding = {} as any; const held = hudText(g); pl.holding = null; pl.holstered = true; const away = hudText(g); pl.holstered = false; SLOTSETUP.on = false; const old = hudText(g); SLOTSETUP.on = true;
      const chord = (t: string) => /hb-chord/.test(t), lit = (t: string) => /div\.hb\.setup/.test(t);
      verdict(chord(shut) && !lit(shut) && /kbd\{2\}/.test(shut) && chord(open) && lit(open) && /kbd\{2\}.*kbd\{1\}.*kbd\{2\}.*kbd\{3\}/.test(open) && !/kbd\{[6-9]\}/.test(open) && !chord(held) && !chord(away) && /div\.hb\.(holstered|empty)/.test(away) && !/div\.hb/.test(old) && /div\.strip/.test(shut) && !/div\.strip/.test(old),
        'the kit column is the box: the gun\'s key and a cap before each row it can step are drawn on its second line, the box is marked while the setup is up, no cap is above 5; with a man in his arm or the gun put away the presses are not drawn; with the rule off the column is the one before',
        `shut: ${caps(shut)} (marked ${lit(shut)}) · up: ${caps(open)} (marked ${lit(open)}) · a man held: presses drawn ${chord(held)} · put away: ${chord(away)} · rule off: a box ${/div\.hb/.test(old)}, a strip ${/div\.strip/.test(old)}`); }
    // ---- a load: nothing is up after one
    { const { W, g, pl } = await rifle(true); const S: any = g.saves; S.runId ||= 'slotsetup-check'; const { takeSnapshot } = await import(`${ROOT}/src/game/rollback.ts`);
      const file = await quiet(() => S.write(g, 'harness', 'before')); await quiet(() => wait(W, 1));   // (a file from a second ago, the setup shut)
      await quiet(() => key(W, 'Digit2')); const upAtSave = up(g), m0 = pl.rifle.mode, k = 'slotsetup-check-mem';
      S.shelf.set(k, { info: { key: k, slot: 'manual', n: 0, label: 'the setup up', kind: 'manual', savedAt: 0, missionT: 0, stage: g.mission.stage, runId: S.runId, bytes: 0, mem: true }, snap: takeSnapshot(g), pic: null });   // (a save kept in memory, as with a team on the floor, taken with the setup up)
      await quiet(() => wait(W, 0.3)); const whyMem = await quiet(() => S.load(g, k)), memUp = up(g) || pl.setup !== null; await quiet(() => key(W, 'Digit1', 3)); const m1 = pl.rifle.mode, slot = pl.slot;
      await quiet(() => { key(W, 'Digit2', 90); key(W, 'Digit2'); }); const upAgain = up(g), whyFile = file.ok ? await quiet(() => S.load(g, file.state)) : file.why, fileUp = up(g); await quiet(() => wait(W, DT)); const fileUp2 = up(g) || g.player.setup !== null;   // (a file's load builds the player again)
      verdict(upAtSave && whyMem === null && !memUp && m1 === m0 && slot === 'pistol' && upAgain && whyFile === null && !fileUp && !fileUp2,
        'nothing is up after a load: a save kept in memory that was taken with the setup up comes back with it shut (a 1 then is the pistol, not the selector), and a file from before it opened shuts it too',
        `up at the save ${upAtSave} · memory load: ${whyMem ?? 'loaded'}, setup ${memUp}, then 1 → slot ${slot}, selector ${m0} → ${m1} · up again ${upAgain} · file load: ${whyFile ?? 'loaded'}, setup ${fileUp}, a frame on ${fileUp2}`); }
    // ---- off: the build as it was
    { const { W, g, pl, rf } = await rifle(false); const a0 = rf.attachment, m0 = rf.mode; await quiet(() => key(W, 'Digit2')); const a1 = rf.attachment, open = up(g) || pl.setup !== null;
      await quiet(() => key(W, 'Digit1', 20)); const slot = pl.slot, m1 = rf.mode; await quiet(() => { key(W, 'Digit2', 60); key(W, 'KeyZ', 2); }); const m2 = rf.mode;
      verdict(a1 !== a0 && !open && slot === 'pistol' && m1 === m0 && m2 !== m0, 'with the rule off, 2 again steps the launcher\'s load at once and nothing is ever up; 1 is the pistol; the selector\'s own code still turns it',
        `load ${a0} → ${a1} · setup ${open} · then 1 → slot ${slot}, selector ${m0} → ${m1} · the selector's code: ${m1} → ${m2}`); }
    // ---- the journal and the frozen row
    { const { g } = await rifle(true); const snap: any = JSON.parse(JSON.stringify(knobsSnapshot(g))), has = typeof snap.tables?.SLOTSETUP?.on === 'boolean'; const before = JSON.parse(JSON.stringify(snap)); delete before.tables.SLOTSETUP;
      const [old, now] = await quiet(() => { applyKnobs(g, before); const a = SLOTSETUP.on; applyKnobs(g, snap); return [a, SLOTSETUP.on]; });
      verdict(has && old === false && now === true && FROZEN_HOLDS['SLOTSETUP.on'] === 'TPS_SLOTSETUP=1', 'a recording carries the table: one from before the key replays with the rule off, one made with it on replays with it on; the frozen stand\'s row names its word',
        `table in a recording ${has} · replayed from before: on ${old} · replayed from now: on ${now} · FROZEN_HOLDS: ${FROZEN_HOLDS['SLOTSETUP.on']}`); }
    // ---- the board: Z and L give the game nothing until their rows are put on a key
    { const K = await import(`${ROOT}/src/host/keymap.ts`); const k0 = { ...K.KEYMAP }, kept = K.keysKept();
      try { K.KEYMAP.on = true; K.KEYMAP.setFree = !BRK; K.setKeys({});
        const z = K.gameCode('KeyZ'), l = K.gameCode('KeyL'), r = K.gameCode('KeyR'), capZ = K.capNow('KeyZ'), freed = K.keyFreed('KeyZ') && K.keyFreed('KeyL'), line = K.keyText('L is the weapon light');
        K.bindKey('KeyL', 'KeyO'); const o = K.gameCode('KeyO'), l2 = K.gameCode('KeyL'), capL = K.capNow('KeyL'); K.bindKey('KeyZ', 'KeyZ'); const z2 = K.gameCode('KeyZ');
        K.resetKeys(); const z3 = K.gameCode('KeyZ'); K.KEYMAP.setFree = false; const z4 = K.gameCode('KeyZ'), l4 = K.gameCode('KeyL');
        verdict(z === '' && l === '' && r === 'KeyR' && capZ === K.NONE && freed && line === 'L is the weapon light' && o === 'KeyL' && l2 === '' && capL === 'O' && z2 === 'KeyZ' && z3 === '' && z4 === 'KeyZ' && l4 === 'KeyL',
          'on the page\'s board Z and L give the game nothing and their rows read as having no key; a row put on a key gives its code (the light on O, the selector back on Z by hand); Reset frees them again; without the switch both are as built',
          `Z → '${z}', L → '${l}', R → '${r}' · Z's cap '${capZ}' · freed ${freed} · a line naming L unchanged ${line === 'L is the weapon light'} · light on O: O → '${o}', L → '${l2}', cap '${capL}' · Z put back by hand → '${z2}' · after Reset → '${z3}' · switch off: Z → '${z4}', L → '${l4}'`);
      } finally { Object.assign(K.KEYMAP, k0); K.setKeys(kept); } }
  } catch (x) { verdict(false, 'the check ran to its end', String((x as Error)?.stack ?? x).slice(0, 600)); }
  finally { Object.assign(SLOTSETUP, was); BACKKEY.tab = wasTab; console.log = log; console.error = err; console.warn = warn; }
  console.log(all ? '=== slotsetup: ALL PASS ===' : '=== slotsetup: FAIL ===');
  return all;
}
if (import.meta.main) process.exit((await slotSetupCheck()) ? 0 : 1);
