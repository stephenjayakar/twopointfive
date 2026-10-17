// A BLAST DOES TO THE PLAYER WHAT IT DOES TO ANYBODY — the check behind src/game/samstun.ts (SAMSTUN.on: on in the page, ?nosamstun; off on the frozen stand,
// TPS_SAMSTUN=1) and the two sites that feed it (frag.ts blast, combat.ts detonateStun).
//   bun run tools/qa/samstun-check.ts        (also `probes.ts samstun`)
// One man of the shift and Sam stood the SAME distance from the same blast, in the open, the AI off, and what each is left with compared:
//   (1) a frag in the wound band: both folded for the same seconds; Sam's feet do not move and no round leaves his gun until it runs out, then both do
//   (2) a frag with a wall between: neither is touched
//   (3) a stun canister with a line to both (the night game's rule): both blind for the same seconds; Sam's picture is white, the reticle takes nobody,
//       his feet are his own — and rooted with SAMSTUN.blindRoots
//   (4) a stun canister with a wall between: neither
//   (5) the room fight's rule: his own side's can beyond FLASH.ownM does nothing to him, inside it blinds him FLASH.ownSecs with no stagger; a defender's can
//       blinds and folds him by the numbers a defender gets from his
//   (6) the switch off: a frag leaves his feet free (the trigger still dead — FRAG.samStun), a stun canister does nothing to him
//   (7) a checkpoint taken mid-stagger and mid-dazzle keeps both
//   (8) never under the puppet's strings or a show
//   (9) a door charge's backblast reaches him as it reaches a teammate standing there
//   (10) a TEAMMATE's can (the door tools' bang, the breach drill: the thrower swapped off the guard list for the call) is his own side's to him, and where
//        the entry spares its own men it spares him
//   (11) folded, his hands do nothing: no takedown on the man in reach, a man in his arm goes loose, a can in the wind-up goes back on his belt — and the
//        pose it put on him is gone when it ends
//   (12) folded with the rifle in his hands (the blast landing mid-sprint), the launcher under it sends nothing until he is up
//   (13) folded on the rifle stack (the wall hold with the rifle): parked at an open corner he does not step out for a cursor round it and the rifle stays
//        low; folded while already out he stands where it caught him — and once up he steps out / back in again
// SAMSTUN_BREAK=1 = the switch left off for the 'on' lines: (1), (3), (5), (9), (10), (11), (12) and (13) must fail.   exit 0 = all hold · 1 = one does not
import { resolve } from 'node:path';
const ROOT = resolve(import.meta.dir, '../..');

export async function samstunCheck(): Promise<boolean> {
  const { rig } = await import('./frag-probes.ts');
  const { SAMSTUN, samBlind, samStaggered, samRooted, staggerPlayer } = await import(`${ROOT}/src/game/samstun.ts`);
  const { startGrab } = await import(`${ROOT}/src/game/player.ts`);
  const { readFileSync } = await import('node:fs');
  const { FRAG, FRAG_LOG, exposure } = await import(`${ROOT}/src/game/frag.ts`);
  const { FLASH, detonateStun } = await import(`${ROOT}/src/game/combat.ts`);
  const fx = await import(`${ROOT}/src/game/effects.ts`);
  let all = true; const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x));
  const line = (ok: boolean, s: string, detail = '') => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}${detail ? `\n    ${detail}` : ''}`); };
  console.log('\n=== samstun: a frag and a stun canister do to the player what they do to a man beside him ===');
  const was = { ...SAMSTUN }; const brk = process.env.SAMSTUN_BREAK === '1'; const ON = !brk;
  const P: number[] = [22, 0, 17.6];   // the corridor outside the break room (frag-probes.ts P0)
  const stand = async (seed: number, god = false) => { const R = await rig(seed); const g = R.game; g.aiEnabled = false; g.godMode = god; /* god mode OFF unless a line says so: the maintainer plays with it on, and a stun must not hang on it */ for (const x of g.guards) R.put(x, [60, 0, 60]); return R; };
  const left = (g: any, until: number) => Math.max(0, until - g.time);
  /** Sam at `q`, pistol up, settled */
  const sam = (R: any, q: number[], face: number[]) => { const g = R.game, pl = g.player; g.teleportPlayer([q[0], 0, q[2]]); const y = Math.atan2(face[0] - q[0], face[2] - q[2]); pl.char.bodyYaw = y; pl.char.aimYaw = y;
    R.input.pressed.add('Digit1'); R.step(2); if (!pl.pistolUp) { R.input.pressed.add('KeyE'); R.step(); } R.step(50); pl.fireCd = 0; pl.staggerUntil = -1; pl.dazzledUntil = -1; pl.sup.v = 0; };
  /** W held `n` frames with the trigger held: how far he went and the first frame a round left */
  const walkFire = (R: any, n: number, aim: number[], fire = true) => { const g = R.game, pl = g.player, p0 = [...pl.char.pos], r0 = pl.pistol.roundsReady; let fired = -1, moved = -1, stance = '';
    for (let i = 0; i < n; i++) { if (i === 10) stance = String(pl.char.anim.stance); R.W.cursorAt(aim); for (const k of ['KeyW']) R.input.keys.add(k); if (fire) { R.input.buttons |= 1; R.input.clicked |= 1; } R.step(); R.input.buttons = 0;
      if (fired < 0 && pl.pistol.roundsReady < r0) fired = i / 60; if (moved < 0 && Math.hypot(pl.char.pos[0] - p0[0], pl.char.pos[2] - p0[2]) > 0.05) moved = i / 60; }
    R.input.keys.delete('KeyW'); return { fired, moved, stance, went: Math.hypot(pl.char.pos[0] - p0[0], pl.char.pos[2] - p0[2]) }; };
  const can = (g: any, at: number[], who: number, fight = false) => { const lv = g.fight.live; g.fight.live = fight; try { detonateStun(g, { kind: 'flash', pos: [at[0], 0.05, at[2]], who } as any); } finally { g.fight.live = lv; } };
  try {
    // (1) a frag in the wound band, both in the open at the same distance
    { let done = false;
      for (let seed = 31; seed < 43 && !done; seed++) { const R = await stand(seed); const g = R.game, pl = g.player, gd = g.guards[0]; SAMSTUN.on = ON;
        const a = R.spot(P, 6.5, true), b = a && R.spot(P, 6.5, true, [a]); if (!a || !b) continue;
        R.put(gd, a, P); sam(R, b, P); R.step(3); const n0 = FRAG_LOG.length; R.frag(P, 0.05); R.until(() => FRAG_LOG.length > n0, 1); const rep = FRAG_LOG[FRAG_LOG.length - 1];
        if (gd.state === 'dead' || !(gd.staggerUntil > g.time) || rep.player !== 'wounded') continue;   // (the dice killed one of them at this seed: try the next)
        const sg = left(g, gd.staggerUntil), ss = left(g, pl.staggerUntil), rooted = samRooted(g);
        const hg = rep.hits.find((h: any) => h.id === gd.char.id), hs = rep.hits.find((h: any) => h.name === 'you'); const slope = (FRAG.stagger[1] - FRAG.stagger[0]) / FRAG.woundM;   // (the seconds are one line of the distance: the two men's differ by exactly what their distances do)
        const owed = hg && hs ? slope * (hg.d - hs.d) : NaN;
        const w = walkFire(R, Math.ceil((ss + 1.5) * 60), [P[0], 0.1, P[2]]);
        line(Math.abs((sg - ss) - owed) < 0.03 && ss > 1.1 && rooted && w.stance === 'lowReady' && w.moved >= ss - 0.15 && w.fired >= ss - 0.15 && w.moved < ss + 1 && w.fired < ss + 1.2,
          '(1) a frag 6.5 m off in the open folds the guard and Sam by one rule (the same seconds for the same distance, to 0.03 s); W and the trigger held, Sam\'s gun is at the low ready and he neither walks nor fires until they run out, then does both',
          `seed ${seed} · guard ${f2(hg?.d)} m: folded ${f2(sg)} s · Sam ${f2(hs?.d)} m: ${f2(ss)} s (the distance owes ${f2(owed)} s) · rooted ${rooted} · stance '${w.stance}' · first step after ${f2(w.moved)} s · first round after ${f2(w.fired)} s`); done = true; }
      if (!done) line(false, '(1) a frag in the wound band', 'no seed left both men wounded'); }
    // (2) a wall between
    { const R = await stand(44); const g = R.game, pl = g.player, gd = g.guards[0]; SAMSTUN.on = ON; const from = [P[0], 0.044 + FRAG.lift, P[2]]; const a = R.spot(P, 3.2, false); let b: number[] | null = null; const tried: number[][] = a ? [a] : [];
      for (let k = 0; a && k < 40 && !b; k++) { const q = R.spot(P, 3.2 + (k % 4) * 0.6, false, tried); if (!q) continue; tried.push(q); sam(R, q, P); const c = pl.char; if (exposure(g, from, c.pos, c.bones.head ?? [c.pos[0], 1.65, c.pos[2]]) === 0 && exposure(g, [P[0], 0.05 + FRAG.lift, P[2]], c.pos, c.bones.head ?? [c.pos[0], 1.65, c.pos[2]]) === 0) b = q; }   // (a spot the standing model's head does not peek out of)
      if (!a || !b) line(false, '(2) a frag with a wall between', 'no covered spots found'); else { R.put(gd, a, P); sam(R, b, P); const n0 = FRAG_LOG.length; R.frag(P, 0.05); R.until(() => FRAG_LOG.length > n0, 1); R.step(2);
        line(gd.state !== 'dead' && !(gd.staggerUntil > g.time) && !(pl.staggerUntil > g.time) && !pl.down, '(2) the same frag with a wall between it and each of them: neither is touched', `guard ${gd.state}, folded ${f2(left(g, gd.staggerUntil))} s · Sam folded ${f2(left(g, pl.staggerUntil))} s`); } }
    // (3) a stun canister with a line to both, the night game's rule
    { const R = await stand(45); const g = R.game, pl = g.player, gd = g.guards[0], other = g.guards[1]; SAMSTUN.on = ON; SAMSTUN.blindRoots = false;
      const a = R.spot(P, 4, true), b = a && R.spot(P, 4, true, [a]);
      if (!a || !b) line(false, '(3) a stun canister with a line to both', 'no open spots found'); else { R.put(gd, a, P); sam(R, b, P); R.step(2); can(g, P, 1);
        const dg = left(g, gd.dazzledUntil), ds = left(g, pl.dazzledUntil), white = samBlind(g); const fold = samStaggered(g);
        const B = fx.bang, at3 = [P[0], 0.05 + B.height, P[2]], dist3 = (h: number[]) => Math.hypot(h[0] - at3[0], h[1] - at3[1], h[2] - at3[2]); const mg = dist3(gd.char.bones.head), ms = dist3(pl.char.bones.head);
        const owed = (B.dazzleMin - B.dazzleSeconds) / B.dazzleRadius * (mg - ms);
        // the reticle: a man stood in plain view under the cursor is not taken while he is blind
        if (other) { R.put(other, [b[0] + (P[0] - b[0]) * 0.5, 0, b[2] + (P[2] - b[2]) * 0.5], b); other.dazzledUntil = -1; }
        const tgt = other ? [other.char.pos[0], 1.2, other.char.pos[2]] : P; R.W.cursorAt(tgt); R.step(2); const snapBlind = g.aimGuard;
        const w = walkFire(R, 40, tgt, false);
        SAMSTUN.blindRoots = true; const p1 = [...pl.char.pos]; R.step(15); const p2 = [...pl.char.pos]; R.input.keys.add('KeyW'); R.step(20); R.input.keys.delete('KeyW'); const held = Math.hypot(pl.char.pos[0] - p2[0], pl.char.pos[2] - p2[2]); void p1; SAMSTUN.blindRoots = false;
        R.until(() => samBlind(g) === 0, 8); R.W.cursorAt(other ? [other.char.pos[0], 1.2, other.char.pos[2]] : P); R.step(3); const snapAfter = g.aimGuard;
        line(Math.abs((dg - ds) - owed) < 0.03 && ds > fx.bang.dazzleMin && white === 1 && !fold && snapBlind === null && w.went > 0.3 && held < 0.05 && (!other || snapAfter === other),
          '(3) a stun canister 4 m off in plain view (the night game): the guard and Sam are blind for the same seconds; Sam\'s picture is white, the reticle takes nobody, his feet are his own (rooted with blindRoots), and the reticle is back when it clears',
          `guard ${f2(mg)} m: blind ${f2(dg)} s · Sam ${f2(ms)} m: ${f2(ds)} s (the distance owes ${f2(owed)} s) · white ${f2(white)} · folded ${fold} · reticle blind ${snapBlind ? snapBlind.callsign : 'nobody'} → after ${snapAfter ? snapAfter.callsign : 'nobody'} · walked ${f2(w.went)} m blind · with blindRoots ${f2(held)} m`); } }
    // (4) a wall between
    { const R = await stand(46); const g = R.game, pl = g.player, gd = g.guards[0]; SAMSTUN.on = ON; const from = [P[0], 0.35, P[2]];
      const hid = (q: number[]) => g.col.segmentBlocked(from, [q[0], 1.6, q[2]]) && g.col.segmentBlocked(from, [q[0], 1.65, q[2]]);
      let a: number[] | null = null, b: number[] | null = null; for (let k = 0; k < 400 && !b; k++) { const q = R.spot(P, 3 + (k % 4) * 0.5, false, a ? [a] : []); if (q && hid(q)) { if (!a) a = q; else b = q; } else break; }
      if (!a || !b) line(false, '(4) a stun canister with a wall between', 'no covered spots found'); else { R.put(gd, a, P); sam(R, b, P); R.step(2); can(g, P, 1);
        line(!(gd.dazzledUntil > g.time) && !(pl.dazzledUntil > g.time) && samBlind(g) === 0, '(4) the same canister with a wall between it and each of them: neither is blinded', `guard blind ${f2(left(g, gd.dazzledUntil))} s · Sam ${f2(left(g, pl.dazzledUntil))} s`); } }
    // (5) the room fight's rule: a can he has a line to is a defender's count on him whoever threw it; his own side's rule only where SAMSTUN.ownSeen is off
    { const R = await stand(47); const g = R.game, pl = g.player, gd = g.guards[0]; SAMSTUN.on = ON; SAMSTUN.ownSeen = true; gd.team = 'hostile';
      const a = R.spot(P, 4, true), b = a && R.spot(P, 4, true, [a]);
      if (!a || !b) line(false, '(5) the room fight\'s rule', 'no open spots found'); else { R.put(gd, a, P); sam(R, b, P); R.step(2); const clr = () => { pl.dazzledUntil = -1; pl.staggerUntil = -1; pl.fireCd = 0; };
        can(g, P, 1, true); const own = left(g, pl.dazzledUntil), ownFold = left(g, pl.staggerUntil), defFar = left(g, gd.dazzledUntil), defFold = left(g, gd.staggerUntil), rooted = samRooted(g);
        const near = [b[0] + (P[0] - b[0]) * 0.3, 0, b[2] + (P[2] - b[2]) * 0.3];
        SAMSTUN.ownSeen = false; clr(); can(g, P, 1, true); const oldFar = left(g, pl.dazzledUntil); clr(); can(g, near, 1, true); const oldNear = left(g, pl.dazzledUntil), oldFold = left(g, pl.staggerUntil); SAMSTUN.ownSeen = true;
        clr(); can(g, P, gd.char.id, true); const theirs = left(g, pl.dazzledUntil), theirFold = left(g, pl.staggerUntil);
        const B = fx.bang, at5 = [P[0], 0.05 + B.height, P[2]], dist5 = (h: number[]) => Math.hypot(h[0] - at5[0], h[1] - at5[1], h[2] - at5[2]); const du = (dist5(gd.char.bones.head) - dist5(pl.char.bones.head)) / B.dazzleRadius;
        const owedB = (FLASH.secs[1] - FLASH.secs[0]) * du, owedF = (FLASH.stagger[1] - FLASH.stagger[0]) * du;   // (one line of the distance each: the two men's differ by exactly what their distances do)
        line(Math.abs((defFar - own) - owedB) < 0.03 && Math.abs((defFold - ownFold) - owedF) < 0.03 && ownFold > 0.9 && own > 3.9 && rooted && Math.abs(theirs - own) < 0.03 && Math.abs(theirFold - ownFold) < 0.03
          && oldFar === 0 && Math.abs(oldNear - FLASH.ownSecs) < 0.05 && oldFold === 0,
          '(5) in a room fight, god mode off: his OWN can 4 m off in plain view blinds and folds him by the numbers the defender beside it got (a bad entry flashes you), and a defender\'s can there does the same to him; with SAMSTUN.ownSeen off his own can is the own-side rule his teammates get (nothing at 4 m, the own-side seconds on top of him, no fold)',
          `own can 4 m: Sam blind ${f2(own)} s, folded ${f2(ownFold)} s · the defender ${f2(defFar)} s, ${f2(defFold)} s (their distances owe ${f2(owedB)} / ${f2(owedF)} s) · a defender's can 4 m: Sam ${f2(theirs)} s, ${f2(theirFold)} s · ownSeen off: 4 m ${f2(oldFar)} s, ${f2(Math.hypot(near[0] - b[0], near[2] - b[2]))} m ${f2(oldNear)} s, folded ${f2(oldFold)} s`); } }
    // (6) the switch off
    { const R = await stand(48, true); const g = R.game, pl = g.player; SAMSTUN.on = false; sam(R, [P[0] - 6.5, 0, P[2]], P); R.step(2); can(g, [P[0] - 3, 0, P[2]], 1); const blind = left(g, pl.dazzledUntil);
      const n0 = FRAG_LOG.length; R.frag([pl.char.pos[0] + 1, 0, pl.char.pos[2]], 0.05); R.until(() => FRAG_LOG.length > n0, 1); const stamp = left(g, pl.staggerUntil); const w = walkFire(R, 60, [P[0], 0.1, P[2]]);
      line(blind === 0 && samBlind(g) === 0 && !samRooted(g) && stamp > 2 && w.moved >= 0 && w.moved < 0.3 && w.fired < 0, '(6) the switch off: a stun canister in plain view does nothing to him, and a frag a metre off (god mode) leaves his feet free — the trigger alone is dead, as FRAG.samStun has it',
        `blind ${f2(blind)} s · stagger stamp ${f2(stamp)} s read by nothing · first step after ${f2(w.moved)} s · round in the first second: ${w.fired >= 0}`); }
    // (7) a checkpoint keeps both
    { const R = await stand(49); const g = R.game, pl = g.player; SAMSTUN.on = true; g.teleportPlayer([P[0] - 4, 0, P[2]]); R.step(5); pl.staggerUntil = g.time + 2.5; pl.dazzledUntil = g.time + 5; pl.dazzledAt = [P[0], 0.3, P[2]];
      const s = R.W.snapshot('samstun', true); const a = [left(g, pl.staggerUntil), left(g, pl.dazzledUntil)]; pl.staggerUntil = -1; pl.dazzledUntil = -1; pl.dazzledAt = null; R.W.restore(s); const p2 = g.player;   // (a load makes a fresh Player)
      const b = [left(g, p2.staggerUntil), left(g, p2.dazzledUntil)]; const back = samRooted(g) && samBlind(g) === 1; const plain = await stand(50); plain.step(5); const s2 = plain.W.snapshot('plain', true);
      line(Math.abs(a[0] - b[0]) < 0.02 && Math.abs(a[1] - b[1]) < 0.02 && !!p2.dazzledAt && back && s2.player.stagU === undefined && s2.player.dazU === undefined, '(7) a checkpoint taken mid-stagger and mid-dazzle keeps both; one taken with neither running carries no such field',
        `saved ${a.map(f2).join(' / ')} s · after the load ${b.map(f2).join(' / ')} s, rooted and blind again: ${back} · plain file fields: ${s2.player.stagU} / ${s2.player.dazU}`); }
    // (8) never on the puppet's strings
    { const R = await stand(51); const g = R.game, pl = g.player; SAMSTUN.on = true; sam(R, [P[0] - 4, 0, P[2]], P); R.step(2); g.puppet = { goal: null } as any; can(g, P, 1); const blind = left(g, pl.dazzledUntil); g.puppet = null;
      g.touring = true; can(g, P, 1); const tour = left(g, pl.dazzledUntil); g.touring = false;
      pl.staggerUntil = g.time + 3; g.puppet = { goal: null } as any; const inert = !samStaggered(g) && !samRooted(g); g.puppet = null; pl.staggerUntil = -1;
      line(blind === 0 && tour === 0 && inert, '(8) a show\'s own canister never blinds its player: nothing on the puppet\'s strings, nothing under a tour', `puppet ${f2(blind)} s · tour ${f2(tour)} s · a frag's stamp read under the puppet: ${!inert}`); }
    // (9) a door charge: Sam a metre from it on its own side is dazzled the seconds a teammate standing there is; four metres back he is not
    { const { doorPt, DOORTOOLS } = await import(`${ROOT}/src/game/doortools.ts`); const out: string[] = []; let ok = true;
      for (const [b, want] of [[1.0, true], [4.0, false]] as [number, boolean][]) { const R = await stand(52); const g = R.game, pl = g.player, D = g.doorTools; SAMSTUN.on = ON;
        const d = g.doors.list.find((x: any) => x.def.name === 'breakroom') ?? g.doors.list.find((x: any) => !x.def.steel && !x.def.exterior); const side = 1 as 1 | -1;
        const q = doorPt(d, d.def.width / 2, b, side); g.teleportPlayer([q[0], 0, q[2]]); R.step(3); pl.dazzledUntil = -1; const lv = g.fight.live; g.fight.live = true;
        D.set.push({ door: d, side, t: g.time, by: 'probe' }); let res: any = null; try { res = D.blow(); } finally { g.fight.live = lv; }
        const secs = left(g, pl.dazzledUntil); out.push(`${d.def.name}, Sam ${b} m off: blind ${f2(secs)} s (a teammate there: ${b < DOORTOOLS.backblastM ? f2(DOORTOOLS.backblastSecs) : '0.00'} s) · "${R.said[R.said.length - 1]}"`);
        ok &&= !!res && (want ? Math.abs(secs - DOORTOOLS.backblastSecs) < 0.05 && /you were too close/.test(R.said.join('|')) : secs === 0); }
      line(ok, '(9) a door charge blown with Sam a metre from it on its own side dazzles him the seconds a teammate there gets; four metres back it does not', out.join('\n    ')); }
    // (10) a teammate's can: the callers that swap the thrower off the list say whose it is. Watched, it is a defender's count on him; with no line it is the
    // own-side rule, and nothing at all where the entry spares its own men
    { const R = await stand(53); const g = R.game, pl = g.player, gd = g.guards[0]; SAMSTUN.on = ON; SAMSTUN.ownSeen = true; gd.team = 'operative';
      const B = fx.bang, at = [P[0], 0.05 + B.height, P[2]], from = [at[0], at[1] + 0.3, at[2]], over = [at[0], at[1] + FLASH.lift, at[2]];
      const eyeOf = () => pl.char.bones.head ?? [pl.char.pos[0], 1.6, pl.char.pos[2]];
      const b = R.spot(P, 4, true); let h: number[] | null = null; const tried: number[][] = b ? [b] : [];   // h: no line to the fireball, but he shares its air (the concussion's reach) and it is not on top of him
      for (let k = 0; b && k < 80 && !h; k++) { const q = R.spot(P, 2.9 + (k % 5) * 0.4, false, tried); if (!q) continue; tried.push(q); g.teleportPlayer([q[0], 0, q[2]]); R.step(3); const e = eyeOf();
        if (!g.col.segmentBlocked(from, e) || !g.col.segmentBlocked(over, e)) continue; const pr = g.col.sound.propagate(at, e); if (pr.muffle <= 0.6 && pr.pathLen <= FLASH.concussM && Math.hypot(e[0] - at[0], e[1] - at[1], e[2] - at[2]) > FLASH.ownM + 0.2) h = q; }
      if (!b || !h) line(false, '(10) a teammate\'s can', `no ${b ? 'hidden spot inside the concussion\'s reach' : 'open spot'} found`); else {
        const all = g.guards, lv = g.fight.live; const thrown = (opt: any, at: number[], fight = true) => { pl.dazzledUntil = -1; pl.staggerUntil = -1; pl.fireCd = 0; g.guards = []; g.fight.live = fight; try { detonateStun(g, { kind: 'flash', pos: [at[0], 0.05, at[2]], who: gd.char.id } as any, false, opt); } finally { g.guards = all; g.fight.live = lv; } return [left(g, pl.dazzledUntil), left(g, pl.staggerUntil)]; };
        sam(R, b, P); R.step(2);
        const unsaid = thrown(undefined, P), watched = thrown({ side: 'operative' }, P), watchedSpared = thrown({ side: 'operative', spare: true }, P);
        const nightSpared = thrown({ side: 'operative', spare: true }, P, false);   // (outside a room fight — the night rule: watched, a spared man is flashed all the same; with ownSeen off he is spared as the caller's own men are)
        SAMSTUN.ownSeen = false; const oldWatched = thrown({ side: 'operative' }, P), oldSpared = thrown({ side: 'operative', spare: true }, P), oldNight = thrown({ side: 'operative', spare: true }, P, false); SAMSTUN.ownSeen = true;
        sam(R, h, P); R.step(2); const hUnsaid = thrown(undefined, P), hSaid = thrown({ side: 'operative' }, P), hSpared = thrown({ side: 'operative', spare: true }, P);
        const says = (f: string) => /detonateStun\(g, it, false, \{ side: (?:'operative'|g\.orders\.team)[ ,]/.test(readFileSync(`${ROOT}/src/game/${f}`, 'utf8')) && g.orders.team === 'operative';   // (the door tools name the side through the orders' own team since another cast can give them: the player's squad's is 'operative', asked of the live game here)
        line(watched[0] > 3.9 && watched[1] > 0.9 && Math.abs(watched[0] - unsaid[0]) < 0.03 && Math.abs(watchedSpared[0] - watched[0]) < 0.03 && oldWatched[0] === 0 && oldSpared[0] === 0 && nightSpared[0] > 1.9 && oldNight[0] === 0
          && hUnsaid[0] > 1.5 && hSaid[0] === 0 && hSaid[1] === 0 && hSpared[0] === 0 && says('doortools.ts') && says('breach.ts'),
          '(10) a teammate\'s can whose thrower is off the guard list for the call, god mode off: WATCHED from 4 m it blinds and folds him as a defender\'s would, on the team\'s side of the door too (nothing with SAMSTUN.ownSeen off); with NO LINE to it and said to be the team\'s it does nothing to him where a defender\'s would concuss him; the door tools\' bang and the breach drill both say whose it is',
          `watched, 4 m: unsaid (= a guard's) ${f2(unsaid[0])} / ${f2(unsaid[1])} s · said ${f2(watched[0])} / ${f2(watched[1])} s · said and spared ${f2(watchedSpared[0])} s · ownSeen off: ${f2(oldWatched[0])} s, spared ${f2(oldSpared[0])} s · the night rule, spared: ${f2(nightSpared[0])} s, ownSeen off ${f2(oldNight[0])} s\n    no line, ${f2(Math.hypot(h[0] - P[0], h[2] - P[2]))} m: unsaid ${f2(hUnsaid[0])} / ${f2(hUnsaid[1])} s · said ${f2(hSaid[0])} / ${f2(hSaid[1])} s · spared ${f2(hSpared[0])} s · doortools.ts says it: ${says('doortools.ts')} · breach.ts: ${says('breach.ts')}`); } }
    // (11) folded, his hands do nothing
    { const R = await stand(54); const g = R.game, pl = g.player, gd = g.guards[0]; SAMSTUN.on = ON; const b = R.spot(P, 3, true);
      if (!b) line(false, '(11) folded, his hands do nothing', 'no open spot found'); else {
        // a man in reach, his back to Sam, hands empty, a click
        const behind = () => { R.put(gd, [b[0], 0, b[2]], P); gd.dazzledUntil = -1; if (!pl.holstered) { R.input.pressed.add('KeyE'); R.step(); } R.step(20);   // (he settles to whatever way he faces with the AI off: Sam goes behind THAT)
          const y = gd.char.bodyYaw, at = gd.char.pos; g.teleportPlayer([at[0] - Math.sin(y) * 0.75, 0, at[2] - Math.cos(y) * 0.75]); pl.char.bodyYaw = pl.char.aimYaw = y; R.W.cursorAt([at[0], 1.2, at[2]]); R.step(4); };
        behind(); pl.fireCd = 0; const reach = !!g.nearby.find((it: any) => it.kind === 'guard' && it.inReach);
        staggerPlayer(g, 1.2, [1, 0, 0]); R.input.clicked |= 1; R.input.buttons |= 1; R.step(); R.input.buttons = 0; R.step(3); const tdFolded = !!pl.takedown || gd.state === 'dead';
        R.until(() => !samStaggered(g), 3); R.step(30); const clutchAfter = pl.char.anim.clutch;
        // a man in his arm when it comes
        behind(); pl.staggerUntil = -1; startGrab(g, gd); R.step(30); const held = !!pl.holding; staggerPlayer(g, 1.5, [1, 0, 0]); R.step(3); const loose = !pl.holding; R.until(() => !samStaggered(g), 3); R.step(20); const clutchLoose = pl.char.anim.clutch;
        // a can in the wind-up
        R.put(gd, [60, 0, 60]); pl.staggerUntil = -1; pl.fireCd = 0; R.input.pressed.add('Digit4'); R.step(30); const n0 = pl.flashbangs; R.W.cursorAt([b[0] + 4, 0.1, b[2]]); R.input.clicked |= 1; R.input.buttons |= 1; R.step(); R.input.buttons = 0;
        const wound = !!pl.pendingThrow, n1 = pl.flashbangs; staggerPlayer(g, 1, [1, 0, 0]); R.step(40); const n2 = pl.flashbangs, flew = g.items.items.some((it: any) => it.kind === "flash" && !it.fired);
        line(reach && !tdFolded && clutchAfter === 0 && held && loose && clutchLoose === 0 && wound && n1 === n0 - 1 && n2 === n0 && !flew,
          '(11) folded: a click on the man in reach behind starts no takedown, a man in his arm goes loose, a can in the wind-up goes back on his belt, and the hand comes off his ribs when it ends',
          `man in reach ${reach} · takedown while folded ${tdFolded} · clutch after ${clutchAfter} · held ${held} → loose ${loose} (clutch after ${clutchLoose}) · wind-up ${wound}: cans ${n0} → ${n1} → ${n2}, one in the air ${flew}`); } }
    // (12) folded with the rifle in his hands, the launcher under it stays shut too — also when the blast lands mid-sprint, the rifle at the low carriage (the tube runs on its own clock, not the trigger's)
    { const R = await stand(57); const g = R.game, pl = g.player; SAMSTUN.on = ON; const b = R.spot(P, 3, true);
      if (!b) line(false, '(12) folded, the launcher stays shut', 'no open spot found'); else {
        g.teleportPlayer([b[0], 0, b[2]]); R.input.pressed.add('Digit2'); R.step(2); if (!pl.rifleUp) { R.input.pressed.add('KeyE'); R.step(); } R.step(60);
        const rf = pl.rifle; rf.attIdx = rf.attachments.indexOf('ring'); rf.rings = 3; rf.ringCd = 0; pl.equipT = 0; pl.fireCd = 0; const up = pl.rifleUp && rf.attachment === 'ring';
        const aim = [P[0], 1.0, P[2]]; const rmb = () => { R.W.cursorAt(aim); R.input.buttons |= 2; R.input.clicked |= 4; R.step(); R.input.buttons = 0; R.W.cursorAt(aim); R.step(); };   // a press frame, then a frame with the button up: a launcher that sends on the press and one that sends on the release both get their frame
        for (let i = 0; i < 20; i++) { R.W.cursorAt(aim); R.input.keys.add('KeyW'); R.input.keys.add('ShiftLeft'); R.step(); }   // sprinting: the rifle is at the low carriage, not in the shoulder
        const sprint = pl.sprinting; staggerPlayer(g, 1.2, [1, 0, 0]); R.input.keys.delete('KeyW'); R.input.keys.delete('ShiftLeft'); let during = 0; const n0 = rf.rings;   // (the keys let go as it lands: with the stun off he would simply stand, shoulder the rifle and send one)
        while ((ON ? g.time + 0.05 < pl.staggerUntil : during < 34)) { rmb(); during++; if (during > 100) break; }   // (stops a pair short of the end: both frames of every pair are folded ones)
        R.input.keys.delete('KeyW'); R.input.keys.delete('ShiftLeft'); const n1 = rf.rings; R.step(40); rf.ringCd = 0; pl.fireCd = 0; pl.equipT = 0; let after = 0; while (rf.rings === n1 && after < 45) { rmb(); after++; }
        line(up && n1 === n0 && rf.rings === n1 - 1,
          '(12) folded with the rifle in his hands (the blast landing mid-sprint), the right button sends nothing from the launcher for as long as he is folded; once he is up it does',
          `rifle up, ring selected ${up} · sprinting when it landed ${sprint} · right button pressed and let go ${during} times folded: rings ${n0} → ${n1} · after: ${rf.rings} (${after} presses)`); } }
    // (13) folded on the rifle stack (wallsnap.ts): parked at an open corner with the cursor round it he does not step out and the rifle stays low; folded while already out he stays where it caught him, rifle low
    { const WS = await import('./wallsnap-probes.ts'); const { WALLSNAP } = await import(`${ROOT}/src/game/wallsnap.ts`); const { AIM } = await import(`${ROOT}/src/game/aim.ts`);
      const ws0 = { ...WALLSNAP }, lv0 = AIM.player.level, rnd0 = Math.random;
      try {
        const park = async () => { const S: any = await WS.world(true); SAMSTUN.on = ON; const CX = 10.2;   // (the cover probe's corner: the conference room's open doorway off the corridor's north wall; `hidden` is half a metre in from it, clear of the door's open leaf whatever the doorway's width)
          S.place(CX + 0.7, 10.8, 270, 'rifle'); S.setCursor([7, 1.2, 10.8]); S.step(10); S.tap('KeyQ'); S.step(40); S.keys('KeyA'); S.step(60); S.keys(); S.step(20); S.setCursor([CX - 4, 1.2, 11.2]); S.step(40);
          return { S, hidden: [CX - 0.5, 1.2, 8.4] as [number, number, number], seen: [CX - 4, 1.2, 11.2] as [number, number, number] }; };
        // parked, then folded, then the cursor round the corner
        const A = await park(); let g = A.S.g, pl = g.player, c = pl.char, w = pl.wall;
        const stagedA = !!w && w.kind === 'stack' && w.atEdge === 1 && !(w.lean > 0); const xA = c.pos[0];
        staggerPlayer(g, 2, [1, 0, 0]); A.S.setCursor(A.hidden); let outF = 0, upF = 0, movedA = 0, nA = 0; const r0 = pl.rifle.roundsReady;
        while (g.time + 0.05 < pl.staggerUntil && nA < 200) { if (nA % 20 === 10) A.S.click(); A.S.step(1); nA++; if (pl.wall?.lean > 0) outF++; if (c.anim.longStance === 'shoulder') upF++; movedA = Math.max(movedA, Math.abs(c.pos[0] - xA)); }
        const firedA = r0 - pl.rifle.roundsReady; let outAfter = -1; A.S.step(60, (f: number) => { if (outAfter < 0 && pl.wall?.lean >= 1) outAfter = f; });
        // out round the corner first, then folded, then the cursor back in plain view
        const B = await park(); g = B.S.g; pl = g.player; c = pl.char; w = pl.wall; B.S.setCursor(B.hidden); B.S.step(40);
        const stagedB = !!w && w.kind === 'stack' && w.lean >= 1; const xB = c.pos[0];
        staggerPlayer(g, 2, [1, 0, 0]); B.S.setCursor(B.seen); let inF = 0, upB = 0, movedB = 0, nB = 0;
        while (g.time + 0.05 < pl.staggerUntil && nB < 200) { B.S.step(1); nB++; if (!(pl.wall?.lean >= 1)) inF++; if (nB > 12 && c.anim.longStance === 'shoulder') upB++; movedB = Math.max(movedB, Math.abs(c.pos[0] - xB)); }   // (the rifle is given a fifth of a second to come down)
        let inAfter = -1; B.S.step(90, (f: number) => { if (inAfter < 0 && pl.wall && !(pl.wall.lean > 0)) inAfter = f; });
        line(stagedA && stagedB && outF === 0 && upF === 0 && movedA < 0.02 && firedA === 0 && outAfter >= 0 && inF === 0 && upB === 0 && movedB < 0.02 && inAfter >= 0,
          '(13) folded on the rifle stack: parked at an open corner, the cursor round it does not step him out and the rifle stays low, no round on a click; folded while out he stands where it caught him, rifle low; up again, he steps out / back in as the cursor says',
          `parked ${stagedA}: ${nA} folded frames — stepped out on ${outF}, rifle in the shoulder on ${upF}, moved ${movedA.toFixed(2)} m, rounds ${firedA} · out ${outAfter} frames after · already out ${stagedB}: ${nB} folded frames — in on ${inF}, rifle in the shoulder on ${upB}, moved ${movedB.toFixed(2)} m · back in ${inAfter} frames after`);
      } finally { Object.assign(WALLSNAP, ws0); AIM.player.level = lv0; Math.random = rnd0; } }
  } finally { Object.assign(SAMSTUN, was); }
  console.log(`=== samstun: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}

if (import.meta.main) process.exit((await samstunCheck()) ? 0 : 1);
