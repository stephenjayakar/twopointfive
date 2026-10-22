// HIS OWN CHARGE GOES OFF FROM HIS OWN ACTIONS, NOT FROM THE SQUAD'S KEY (src/game/ownblow.ts OWNBLOW.on; the row in player.ts buildInteractables, the
// act in game.ts, the key's press in doortools.ts input and wallcharge.ts input). On in the page (`?ownblow=0`), off in the module and on the frozen stand
// (`TPS_OWNBLOW=1`): this check raises it itself, so it reads the same on both stands.
//   bun run tools/qa/probes.ts ownblow        (family `player`)        OWNBLOW_BREAK=1 = the switch left off and the same lines asked: must FAIL (all but `off`)
//
// The charge is set by his own hands through the door's own row (the interaction key on it, held to the end), as owncharge-check sets one.
//   the row      a charge of his on a locked door: at the door its rows are the door's and 'blow the charge' after them, never past the fourth; stood off
//                with nothing in reach it is the only row, on the interaction key. The door's line and the message name no key (the row has its own)
//   the key      the squad's key pressed with only his own charge set: nothing goes and the charge stands (the press is not used up: it is the squad's)
//   a tap        the interaction key tapped, stood off: one blast, the door in, that charge spent
//   the ring     at the door, the interaction key kept down puts his ring up with a wedge for it (its words warn he is too close); the wedge's digit blows it
//   back at it   stood off the row is the highlighted one; back at the door the highlight is the door's first row again, a tap there is the door's and
//                the charge stands, and while his hands are at that the row is not offered
//   the squad's  a charge the squad set on his order and left to his call has no row of his, and the squad's key blows it as it did
//   behind his   the squad told to stand off behind HIS charge: the squad's key is still the word — it goes and they are in behind it
//   past the cap stood off beside a row that is listed past the cap (his own stuck camera's 'take it back'): that row is the top one and the tap's, his
//                charge's is under it
//   a wall       a wall charge by his own hands: at its foot a bare tap is refused and the row greyed (it would kill him there: WALLKILL); stood off, the squad's key leaves
//                it, the row is there, and a tap opens the wall
//   off          the switch off: no row, and the squad's key blows his charge, as it did
//   recordings   the switch rides the knob snapshot; one from before the key puts it off; FROZEN_HOLDS has its row
import { ROOT } from './headless.ts';
import { rig } from './doortools-probes.ts';

export async function ownBlowCheck(): Promise<boolean> {
  const BRK = process.env.OWNBLOW_BREAK === '1'; let all = true;
  const verdict = (ok: boolean, what: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}\n    ${detail}`); };
  console.log(`\n=== ownblow: his own charge goes off from his own actions, not the squad's key${BRK ? ' (the switch off: must fail)' : ''} ===`);
  const { OWNBLOW } = await import(`${ROOT}/src/game/ownblow.ts`); const { OWNCHARGE } = await import(`${ROOT}/src/game/owncharge.ts`); const { HANDRING } = await import(`${ROOT}/src/game/handring.ts`);
  const { WALLSNAP } = await import(`${ROOT}/src/game/wallsnap.ts`); const { CMDRING } = await import(`${ROOT}/src/game/cmdring.ts`);
  const { DOORTOOLS, doorPt } = await import(`${ROOT}/src/game/doortools.ts`); const { wallPt, WALLCHARGE, WALLKILL } = await import(`${ROOT}/src/game/wallcharge.ts`); const { SAMSTUN } = await import(`${ROOT}/src/game/samstun.ts`); const K = await import(`${ROOT}/src/game/kit.ts`);
  const { knobsSnapshot, applyKnobs } = await import(`${ROOT}/src/game/journal.ts`); const { FROZEN_HOLDS } = await import(`${ROOT}/src/host/profile.ts`);
  const was = { on: OWNBLOW.on, stun: SAMSTUN.on, safe: WALLCHARGE.safe, kill: WALLKILL.on, own: OWNCHARGE.on, ring: HANDRING.on, early: HANDRING.early, press: WALLSNAP.press, kit: K.KIT.on, cards: K.KIT.members.map((m: any) => ({ ...m })), rnd: Math.random }, log = console.log, err = console.error, warn = console.warn;
  const quiet = async <T>(f: () => T | Promise<T>): Promise<T> => { console.log = console.error = console.warn = () => { }; try { return await f(); } finally { console.log = log; console.error = err; console.warn = warn; } };
  const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
  const faceToward = (d: any, p: number[]): 1 | -1 => (dist(doorPt(d, d.def.width / 2, 1, 1), p) <= dist(doorPt(d, d.def.width / 2, 1, -1), p) ? 1 : -1);
  const shut = (d: any) => { d.angle = 0; d.vel = 0; d.latched = true; };
  const rows = (g: any) => (g.nearby as any[]).filter(r => r.kind !== 'cancel').map(r => `${r.kind}:${r.verb ?? '-'}`);
  /** the switches as this check wants them (a stand-up pins them: raised after). The blast is his too, as the page has it: who is 'too close' hangs on it */
  const stand = (on: boolean, ring = false) => { OWNCHARGE.on = true; SAMSTUN.on = true; OWNBLOW.on = on && !BRK; HANDRING.on = ring; HANDRING.early = ring; WALLSNAP.press = false; };
  /** stood at arm's length off the leaf, the door's 'set a charge' row given and held to the end */
  const setByHand = (R: any, d: any, side: 1 | -1): boolean => { const g = R.game; g.teleportPlayer(doorPt(d, d.def.width / 2, 0.75, side)); R.step(12); const n0 = R.D.set.length;
    if (!g.selectVerb('door', 'charge')) return false; R.input.pressed.add('Space'); R.step(); if (!g.player.charging) return false;
    const ok = R.until(() => R.D.set.length > n0 || !g.player.charging, DOORTOOLS.setSecs + 2) && R.D.set.length > n0; R.step(3); return ok; };
  /** a man alone in the office with two charges on his card, one of them set by hand on the manager's locked door: the rig, the door, its face */
  const alone = async (on: boolean, ring = false) => { const R: any = await quiet(() => rig(11, { stage: false })); stand(on, ring); const g = R.game; K.KIT.on = true;
    Object.assign(K.KIT.members[0], { charges: 2 });
    if ((K as any).kitStealthOn?.()) { K.kitMission((K as any).kitStealthHand(0, false)); const m: any = K.KIT.members[0]; for (const f of ['smoke', 'bangs', 'frags', 'shells', 'cams']) m[f] = 0; m.wand = false; m.charges = 2; K.kitMission(null); }
    K.kitSolo(g); const d = R.door('manager'); shut(d); g.player.crouch = true; g.teleportPlayer(doorPt(d, d.def.width / 2, 0.75, 1)); R.step(12);
    const side: 1 | -1 = (g.nearby as any[]).some(r => r.verb === 'pick') ? 1 : -1; g.player.crouch = false; const set = setByHand(R, d, side);
    return { R, g, D: R.D, d, side, set, off: () => { g.teleportPlayer(doorPt(d, d.def.width / 2 + 2.6, 1.0, side)); R.step(8); } }; };
  const tap = (R: any) => { R.input.pressed.add('Space'); R.input.keys.add('Space'); R.step(); R.input.keys.delete('Space'); R.step(3); };
  const opened = (d: any) => !!d.off || (!d.latched && !!d.lockBroken);
  try {
    // ---- the row
    { const A = await alone(true), { R, g, D, d } = A; const at = rows(g), i = at.indexOf('charge:blow'), line = (g.nearby as any[]).filter(r => r.kind === 'door').map(r => r.line1).join(' | '), said = R.said.filter((t: string) => /charge set on/.test(t)).pop() ?? '';
      A.off(); const far = rows(g), row = (g.nearby as any[])[0];
      verdict(A.set && D.set[0]?.by === 'Sam' && i > 0 && i < CMDRING.wedges - 1 && at.slice(0, i).every(r => r.startsWith('door:')) && far.join() === 'charge:blow' && /blow the charge/.test(row?.line2 ?? '') && /^charge set/.test(row?.line1 ?? '')
        && /charge set$/.test(line) && /charge set on the manager door$/.test(said) && !/blows it/.test(line + said),
        'a charge of his own on a door: at the door \'blow the charge\' comes after the door\'s rows, never past the fourth; stood off it is the only row, on the interaction key; no line names a key for it (its row has one)',
        `set by hand ${A.set} (by ${D.set[0]?.by}) · at the door: ${at.join(' ')} · stood off: ${far.join(' ') || 'no row'} · its row: "${row?.line1}" / "${row?.line2}" · the door's line: ${line} · said: ${said}`);
      // ---- the key
      const b0 = D.stats.blown; R.input.pressed.add('KeyF'); R.step(); R.step(20);
      verdict(D.stats.blown === b0 && D.set.length === 1 && !opened(d), 'the squad\'s key with only his own charge set: nothing goes and the charge stands', `blown ${D.stats.blown - b0} · set ${D.set.length} · the door ${opened(d) ? 'IN' : 'shut'}`);
      // ---- a tap
      const n0 = D.charges, bangs0 = R.bangs.length; tap(R); R.step(3);
      verdict(D.stats.blown === b0 + 1 && D.set.length === 0 && R.bangs.length === bangs0 + 1 && opened(d) && D.charges === n0 && rows(g).indexOf('charge:blow') < 0, 'the interaction key tapped, stood off: one blast, the door in, the charge spent, the row gone',
        `blown ${D.stats.blown - b0} · blasts ${R.bangs.length - bangs0} · the door ${opened(d) ? 'in' : 'SHUT'} · set ${D.set.length} · count ${D.charges} · rows after: ${rows(g).join(' ') || 'none'}`); }
    // ---- the ring
    { const A = await alone(true, true), { R, g, D, d } = A; const at = rows(g), i = at.indexOf('charge:blow'), b0 = D.stats.blown, warned = /too close: you/.test((g.nearby as any[])[i]?.line1 ?? '') && !(g.nearby as any[])[i]?.off;
      R.input.pressed.add('Space'); R.input.keys.add('Space'); for (let n = 0; n < Math.ceil((HANDRING.holdSecs + 0.1) * 60); n++) R.step(); const up = !!g.player.sel.ring; R.input.keys.delete('Space'); R.step(2); const stays = !!g.player.sel.ring, mid = D.stats.blown;
      R.input.pressed.add(`Digit${i + 1}`); R.step(); R.step(3);
      verdict(A.set && i > 0 && warned && up && stays && mid === b0 && D.stats.blown === b0 + 1 && opened(d) && !g.player.sel.ring, 'at the door, the interaction key kept down puts the ring up with a wedge for it (its words warn he is too close; a door\'s charge is his to take), and that wedge\'s digit blows it',
        `rows: ${at.join(' ')} · its row warns and is not greyed ${warned} · the ring ${up ? 'up' : 'NOT up'}, standing after the key ${stays} · blown before the digit ${mid - b0}, after digit ${i + 1}: ${D.stats.blown - b0} · the door ${opened(d) ? 'in' : 'SHUT'}`); }
    // ---- back at it
    { const A = await alone(true), { R, g, D, d, side } = A, pl = g.player; A.off(); const farHover = `${g.hover?.kind}:${g.hover?.verb}`; g.teleportPlayer(doorPt(d, d.def.width / 2, 0.75, side)); R.step(12);
      const at = rows(g), hover = `${g.hover?.kind}:${g.hover?.verb}`, b0 = D.stats.blown; tap(R); R.step(4);
      const doing = ['kick', 'picking', 'easing', 'doorMove', 'charging'].filter(k => !!pl[k]).join('+'), during = rows(g);
      verdict(A.set && farHover === 'charge:blow' && at.includes('charge:blow') && hover.startsWith('door:') && D.stats.blown === b0 && D.set.length === 1 && doing !== '' && !during.includes('charge:blow'),
        'stood off, his row is the highlighted one; back at the door the highlight is the door\'s again, a tap is the door\'s and the charge stands; with his hands at that the row is not offered',
        `stood off, highlighted: ${farHover} · back at the door: ${at.join(' ')}, highlighted ${hover} · the tap: blown ${D.stats.blown - b0}, set ${D.set.length}, his hands at ${doing || 'NOTHING'} · rows then: ${during.join(' ') || 'none'}`); }
    // ---- beside a row past the cap
    { const A = await alone(true), { R, g, D } = A, pl = g.player; const { STICKY } = await import(`${ROOT}/src/game/stickycam.ts`), sk = { on: STICKY.on, take: STICKY.take };
      try { A.off(); const p = pl.char.pos; STICKY.on = true; STICKY.take = true; if (!pl.rifle.attachments.includes('ring')) pl.rifle.attachments.push('ring');
        pl.cams.push({ pos: [p[0] + 0.5, 1.2, p[2]], n: [-1, 0, 0], vel: null, age: 5, si: -1, id: 900 }); R.step(4);
        const at = rows(g), hv = `${g.hover?.kind}:${g.hover?.verb}`, b0 = D.stats.blown, c0 = pl.cams.length; tap(R); R.step(4);
        verdict(A.set && at.join(' ') === 'cam:takeCam charge:blow' && hv === 'cam:takeCam' && D.stats.blown === b0 && D.set.length === 1 && pl.cams.length === c0 - 1, 'stood off beside his own stuck camera: the camera\'s row is the top one and his charge\'s under it — a tap takes the camera back and the charge stands',
          `rows: ${at.join(' ') || 'none'} · highlighted ${hv} · the tap: blown ${D.stats.blown - b0}, set ${D.set.length}, cameras ${c0} → ${pl.cams.length}`);
      } finally { STICKY.on = sk.on; STICKY.take = sk.take; } }
    // ---- the squad's own charge, and the squad behind his
    { const R: any = await quiet(() => rig(7, { door: 'breakroom_w' })); stand(true); const { D, game: g } = R, d = R.door('breakroom_w');
      const why = R.give('charge', 'breakroom_w'), armed = R.until(() => D.ops[0]?.phase === 'armed', 45); g.teleportPlayer([25.0, 0, 18.9]); R.step(5);
      const by = D.set[0]?.by, mine = rows(g).includes('charge:blow'), b0 = D.stats.blown; R.press('KeyF'); R.step(3);
      verdict(why === null && armed && !!by && by !== 'Sam' && !mine && D.stats.blown === b0 + 1, 'a charge the squad set and left to his call is no row of his, and the squad\'s key blows it as it did', `armed ${armed} (by ${by}) · a row of his: ${mine} · blown on the key ${D.stats.blown - b0}`); }
    { const R: any = await quiet(() => rig(7, { door: 'breakroom_w' })); stand(true); const { D, game: g } = R, d = R.door('breakroom_w'), side = faceToward(d, [20, 0, 18.9]);
      const set = setByHand(R, d, side); g.teleportPlayer([25.0, 0, 18.9]); R.step(5); const w = R.give('charge', 'breakroom_w'), op = D.ops[0], armed = R.until(() => op?.phase === 'armed', 45), b0 = D.stats.blown;
      R.press('KeyF'); const crossed = R.until(() => op.crossed.size > 0, 8);
      verdict(set && w === null && armed && D.stats.blown === b0 + 1 && crossed, 'the squad stood off behind HIS charge: the squad\'s key is the word, it goes and they are in behind it', `set by hand ${set} · the order ${w === null ? 'taken' : w} · armed ${armed} · blown ${D.stats.blown - b0} · crossed ${crossed}`); }
    // ---- a wall
    { const WP: any = await import('./wallcharge-probes.ts'), R: any = await WP.rig('block-squads', 13, { squad: false }); OWNBLOW.on = !BRK; HANDRING.on = false; WALLSNAP.press = false; WALLCHARGE.safe = true; WALLKILL.on = true;
      const { C, game: g } = R, P = WP.partitions(R)[0], foot = wallPt(P.W, 0, 0.55);
      g.teleportPlayer(foot); R.aim(P.top, 150); g.selectVerb('wall', 'charge'); R.press('Space'); const set = R.until(() => C.set.length === 1, DOORTOOLS.setSecs + 1), Wc = C.set[0]?.wall, said = R.said.filter((t: string) => /charge set on the wall/.test(t)).pop() ?? '';
      R.step(6); const god = !!g.godMode, godGrey = !!g.hover?.off; g.godMode = false;   // (the rig's player cannot be hurt: nothing holds his tap, and the row is not greyed)
      R.step(6); const foot0 = rows(g), fh = `${g.hover?.kind}:${g.hover?.verb}`, grey = !!g.hover?.off, s0 = R.said.length; R.input.pressed.add('Space'); R.input.keys.add('Space'); R.step(); R.input.keys.delete('Space'); R.step(5);
      const held = C.set.length === 1 && !C.holeAt(Wc) && !g.player.down, word = R.said.slice(s0).filter((t: string) => /too close to your own charge/.test(t)).length;
      g.teleportPlayer(wallPt(Wc ?? P.W, 3, 0.8)); R.step(4); const far = rows(g); R.press('KeyF'); R.step(4); const kept = C.set.length === 1 && !C.holeAt(Wc);
      R.input.pressed.add('Space'); R.input.keys.add('Space'); R.step(); R.input.keys.delete('Space'); R.step(5); const hole = !!C.holeAt(Wc);
      verdict(set && C.stats.bySam === 1 && fh === 'charge:blow' && (!god || !godGrey) && grey && held && word === 1 && far.includes('charge:blow') && !/blows it/.test(said) && kept && hole && C.set.length === 0, 'a wall charge by his own hands: at its foot, where it would kill him, the row is greyed and a bare tap is refused; stood off, the squad\'s key leaves it, his row is there, and a tap opens the wall',
        `set ${set} · said: ${said} · at its foot: ${foot0.join(' ') || 'no row'}, highlighted ${fh}, greyed ${grey} (a player nothing can hurt: ${god ? `greyed ${godGrey}` : 'not this rig'}); a tap there: ${held ? 'the charge stands, he is up' : 'IT WENT'}, the word ${word} · stood off: ${far.join(' ') || 'no row'} · after the squad's key: ${kept ? 'still set, the wall whole' : 'GONE'} · after the tap: ${hole ? 'a hole' : 'NO HOLE'}, set ${C.set.length}`); }
    // ---- off
    { const A = await alone(false), { R, g, D, d } = A; OWNBLOW.on = false; R.step(2); const at = rows(g), line = (g.nearby as any[]).filter(r => r.kind === 'door').map(r => r.line1).join(' | '); A.off(); const far = rows(g), b0 = D.stats.blown; tap(R); const mid = D.stats.blown; R.press('KeyF'); R.step(3);
      verdict(A.set && !at.includes('charge:blow') && far.length === 0 && /charge set · F blows it/.test(line) && mid === b0 && D.stats.blown === b0 + 1 && opened(d), 'the switch off: no row of his, the door\'s line names the squad\'s key, and that key blows his charge, as it did',
        `at the door: ${at.join(' ')} · stood off: ${far.join(' ') || 'no row'} · the door's line: ${line} · a tap of the interaction key: blown ${mid - b0} · the squad's key: blown ${D.stats.blown - b0}`); }
    // ---- recordings
    { const A = await alone(true), g = A.g; OWNBLOW.on = !BRK; const snap: any = JSON.parse(JSON.stringify(knobsSnapshot(g))), rides = snap.tables?.OWNBLOW?.on === true; const old = JSON.parse(JSON.stringify(snap)); delete old.tables.OWNBLOW;
      const both = await quiet(() => { applyKnobs(g, old); const off = OWNBLOW.on === false; applyKnobs(g, snap); return [off, OWNBLOW.on === true]; }), row = (FROZEN_HOLDS as Record<string, string>)['OWNBLOW.on'];
      verdict(rides && both[0] && both[1] && row === 'TPS_OWNBLOW=1', 'the switch rides the knob snapshot; a recording from before the key replays with it off; FROZEN_HOLDS has its row',
        `in the snapshot ${rides} · one without the key: off ${both[0]} · one with it: on ${both[1]} · the row '${row}'`); }
  } finally { OWNBLOW.on = was.on; SAMSTUN.on = was.stun; WALLCHARGE.safe = was.safe; WALLKILL.on = was.kill; OWNCHARGE.on = was.own; HANDRING.on = was.ring; HANDRING.early = was.early; WALLSNAP.press = was.press; K.KIT.on = was.kit; K.kitLoad(null, ''); for (let i = 0; i < was.cards.length; i++) K.KIT.members[i] = was.cards[i]; Math.random = was.rnd; console.log = log; console.error = err; console.warn = warn; }
  console.log(`=== ownblow: ${all ? 'ALL PASS' : 'FAIL'} ===`);
  return all;
}
