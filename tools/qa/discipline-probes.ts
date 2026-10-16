// The 'standoff-discipline' probe (run through probes.ts: `bun run tools/qa/probes.ts standoff-discipline`; part of the `standoff` family and `all`): muzzle
// discipline round the human shield — the maintainer's "when Sam is holding a hostage, enemies should point but not fire" (guards.ts SHIELD_RELEASE_BEAT_*,
// Game.tune.muzzleDiscipline, on by default). While Sam has a living man up in front of him nobody who can see it fires, however clean the flank line and however
// long it lasts; the moment the man is out of the arm the plain fight has the round back, after a human beat (≥ 0.35 s).
//   (a) the canonical standoff — Novak held in the break room, Sam's facing FROZEN so his two colleagues can get all the way round to his back — run 20 s: not one
//       guardShot while the hold lasts; both men alert and in the standoff throughout; posed aiming (or at the low ready while a colleague stands in the line)
//       every frame after their beat; the flank line reached and HELD for seconds with the pistol up on Sam; at least one line said to him;
//   (b) then Space held on the man's row — the choke, in front of them, Sam lit: nothing while the elbow closes (he is still up), and the first round ≥ 0.35 s and
//       ≤ 4 s after he folds;
//   (c) the same staging with tune.muzzleDiscipline = false: a round DURING the hold (the flag is live, and (a) would catch a regression);
//   (d) the gun variant with the gun-hold rule OFF (gunhold.ts GUNHOLD.on false: `?nogunhold`, the frozen stand): Sam turns the pair onto Kowalski and fires past
//       Novak's head at him — kills him, and keeps firing into the room — while Reyes, watching all of it and free to work round to a line of his own, still never
//       puts a round past his colleague while he is up (Chaos Theory's answer: they do not shoot through their own man to answer fire);
//   (e) the same staging with the rule ON (the page as it ships): the discipline is what the rule left of it. Nobody fires before Sam has; the man in front of
//       the gun never fires at all; the one man who answers is Reyes, from the clean line at Sam's back (within 70° of dead astern), single rounds on the
//       standoff's slow cadence, and Novak never dies to his own side. What the men in FRONT do (run for cover, go round, look) is gunhold-check's.
// (d) and (e) set the switch themselves after the stand-up, so the probe asks the same on the frozen and the shipped stand.
import { ROOT } from './headless.ts';
import { stageHold, bringIn, bearingPoint } from './standoff-probes.ts';
const IK = 'Space';
const { v3, DEG } = await import(`${ROOT}/src/math/vec.ts`);
const { pairOf, flankShot, colleagueInLine, standoffSummary } = await import(`${ROOT}/src/game/guards.ts`);
const { GUNHOLD, gunHoldStats } = await import(`${ROOT}/src/game/gunhold.ts`);

type Vec3 = [number, number, number];
const DT = 1 / 60;
const f1 = (x: number) => x.toFixed(1), f2 = (x: number) => x.toFixed(2);
const FACE = 190;   // the break-room staging of standoff-flank: the pair faces SSW, the ring open round the west side to dead astern
const AT: Vec3 = [33.0, 0, 17.8];

/** per observer, per run: when he entered the standoff; frames since; frames NOT alert since; frames the record dropped with the pair still up; pose counts after
 *  his beat (aim / low ready for a man in the line / anything else); frames the flank line was his with no other colleague in it, and of those the frames the
 *  pistol was UP on Sam; his rounds (game time) */
interface Obs { enterT: number; frames: number; notAlert: number; lost: number; poseAim: number; poseLow: number; poseBad: number; lineFrames: number; aimOnLine: number; shots: number[]; inLineT: number; prevOk: boolean; }
const newObs = (): Obs => ({ enterT: -1, frames: 0, notAlert: 0, lost: 0, poseAim: 0, poseLow: 0, poseBad: 0, lineFrames: 0, aimOnLine: 0, shots: [], inLineT: -100, prevOk: false });
/** one frame's bookkeeping for `men` while the pair `P` stands. A 'clean' flank line: flankShot holds, has held for 0.25 s, AND no OTHER colleague stands in it
 *  now or stood in it within the last 0.25 s (two men can bunch behind the pair, and the low ready for the one in front is right) — the quarter second being
 *  muzzleCheck's own 0.2 s before a gun lowered for a man in the line (the held man, till the flank opened; a colleague) comes back up */
export function observe(game: any, men: any[], obs: Map<any, Obs>, P: any) {
  const t = game.time; const shotsNow = game.events.filter((e: any) => e.kind === 'guardShot' && e.time === t);
  for (const m of men) {
    const O = obs.get(m)!;
    if (m.standoff && O.enterT < 0) O.enterT = t;
    if (O.enterT < 0) continue;
    O.frames++; if (m.state !== 'alert') O.notAlert++; if (!m.standoff) O.lost++;
    if (m.reactT <= 0) { const an = m.char.anim; if (an.upper === 'aim' && !m.muzzleDown) O.poseAim++; else if (m.muzzleDown && an.stance === 'lowReady') O.poseLow++; else O.poseBad++; }
    const fs = flankShot(game, m, P);
    if (colleagueInLine(game, m, P.aim, P.held) || (fs.ok && !O.prevOk)) O.inLineT = t; O.prevOk = fs.ok;
    if (fs.ok && t - O.inLineT > 0.25 && m.reactT <= 0) { O.lineFrames++; if (m.char.anim.upper === 'aim' && !m.muzzleDown) O.aimOnLine++; }   // (after his beat: in it the gun is still coming round and the held man counts in his line like anybody)
    for (const e of shotsNow) if (v3.distXZ(e.pos, m.char.pos) < 0.05) O.shots.push(t);
  }
  return shotsNow.length;
}
const obsLine = (m: any, O: Obs, t0: number) => `${m.callsign}: entered +${O.enterT >= 0 ? f2(O.enterT - t0) : '—'} s, alert ${O.frames - O.notAlert}/${O.frames} fr, pose aim ${O.poseAim} · low-for-colleague ${O.poseLow} · other ${O.poseBad}, line held ${f1(O.lineFrames * DT)} s (gun up on Sam ${f1(O.aimOnLine * DT)} s), ${O.shots.length} rounds${O.shots.length ? ' [' + O.shots.map(t => f2(t - t0) + 's').join(' ') + ']' : ''}, fireCd ${f2(m.fireCd)}`;

export async function standoffDiscipline() {
  console.log('\n=== standoff-discipline: Sam holds Novak in the break room, facing frozen, Kowalski + Reyes free to get round him — (a) 20 s: they point, talk, flank, and fire NOTHING; (b) the choke in front of them: the first round ≥ 0.35 s and ≤ 4 s after he folds; (c) tune.muzzleDiscipline=false: rounds during the hold; (d) gun hold, gun-hold rule off, Sam shoots Kowalski past Novak\'s head and keeps firing: Reyes still holds his; (e) the same with the rule on: nobody fires first, nobody in front fires, Reyes answers from the clean line behind at a slow cadence ===');
  let allPass = true;
  // ================================================================ (a) + (b)
  {
    const S = await stageHold(381, 1, AT, FACE * DEG); const { W, game, victim, lines, msgs, faceDeg } = S;
    const A = game.guards[0], C = game.guards[2]; const men = [A, C]; const obs = new Map<any, Obs>(men.map(m => [m, newObs()]));
    const P0 = pairOf(game)!; const centre = v3.copy(P0.centre);
    bringIn(game, A, bearingPoint(centre, faceDeg + 15, 4.6), centre);   // Kowalski front-right of the pair (as they look) at 4.6 m, Reyes front-left at 4.8: both see it this frame
    bringIn(game, C, bearingPoint(centre, faceDeg - 25, 4.8), centre);
    const t0 = game.time; let exc = ''; let hits = 0, prevHit = game.player.hitFlash; let shotsDuring = 0; let holdEnded = ''; const log: string[] = [];
    // ---- (a) twenty seconds of it
    try {
      for (let f = 0; f < 60 * 20; f++) {
        W.step(DT); const t = game.time; const P = pairOf(game);
        if (game.player.hitFlash > prevHit + 1e-9) hits++; prevHit = game.player.hitFlash;
        if (!P) { holdEnded = `${f2(t - t0)}s: victim ${victim.state}/${victim.downKind ?? '-'}/${victim.downBy ?? '-'}, holding ${game.player.holding?.phase ?? 'null'}`; break; }
        shotsDuring += observe(game, men, obs, P);
        if (f % 120 === 0) log.push(`${f2(t - t0)}s ${standoffSummary(game) || '—'} · ${men.map(m => `${m.callsign} ${m.char.anim.upper}/${m.char.anim.stance}${m.muzzleDown ? '(down)' : ''}`).join(' ')}`);
      }
    } catch (e: any) { exc = String(e?.stack ?? e); }
    const tA = game.time;
    const barks = lines.filter(l => !l.radio && l.t > t0 && (l.who === A.callsign || l.who === C.callsign));
    {
      const fails: string[] = [];
      if (exc) fails.push('exception: ' + exc.split('\n')[0]);
      if (holdEnded) fails.push('the hold ended inside the 20 s: ' + holdEnded);
      if (shotsDuring) fails.push(`${shotsDuring} guard round(s) went out with Novak alive in Sam's arm`);
      if (hits) fails.push(`Sam was hit ${hits}×`);
      let bestLine = 0;
      for (const m of men) {
        const O = obs.get(m)!; const n = m.callsign;
        if (O.enterT < 0 || O.enterT - t0 > 1.5) { fails.push(`${n} entered the standoff ${O.enterT < 0 ? 'never' : f2(O.enterT - t0) + ' s in'} (want at once: the pair is in his view)`); continue; }
        if (O.notAlert) fails.push(`${n} was not alert on ${O.notAlert} of ${O.frames} frames after entering`);
        if (O.lost) fails.push(`${n}'s standoff record dropped on ${O.lost} frame(s) with the pair up and in view`);
        if (O.shots.length) fails.push(`${n} FIRED ${O.shots.length} round(s): ${O.shots.map(t => f2(t - t0) + 's').join(', ')}`);
        if (O.poseBad > 2) fails.push(`${n} posed neither aiming nor at the low ready for a colleague on ${O.poseBad} frames (aim ${O.poseAim}, low ${O.poseLow})`);
        if (O.lineFrames >= 30 && O.aimOnLine < 0.9 * O.lineFrames) fails.push(`${n} had a clean flank line ${f1(O.lineFrames * DT)} s but the pistol up on Sam only ${f1(O.aimOnLine * DT)} s of it (point, don't fire: want ≥ 90 %)`);
        if (m.fireCd < 0.35 - 1e-6) fails.push(`${n}'s fireCd is ${f2(m.fireCd)} (want ≥ 0.35 in hand for when the shield goes)`);
        bestLine = Math.max(bestLine, O.lineFrames);
      }
      if (bestLine * DT < 2) fails.push(`nobody got round to a clean flank line and held it (best ${f1(bestLine * DT)} s; want ≥ 2 s — the frozen facing leaves the whole west side open)`);
      if (!barks.length) fails.push('neither man said a word to Sam in 20 s');
      const ok = fails.length === 0; allPass &&= ok;
      console.log(`- ${ok ? 'PASS' : 'FAIL'} — (a) 20 s of the hold, discipline on: guard rounds ${shotsDuring}; Sam hit ${hits}×; Novak ${victim.state}${victim.held ? '/held:' + victim.held.phase : ''}; ${men.map(m => obsLine(m, obs.get(m)!, t0)).join(' · ')}\n    their lines: ${barks.map(l => `${f1(l.t - t0)}s ${l.who}: "${l.text}"`).join(' · ') || '—'}\n    ${log.join('\n    ')}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
    }
    // ---- (b) the choke, in front of them: its row chosen and tapped once (as the tour's beat does it) — it commits and runs on its own clock while the frozen-facing
    //      puppet stays on (rows perform under a puppet; the cursor sits under Sam's feet meanwhile, which turns nothing), Sam lit 0.7
    if (!holdEnded && !exc) {
      game.player.visibility = 0.7;
      const chose = game.selectVerb('held', 'choke'); W.input.pressed.add(IK);
      let endT = -1, chokeT = -1, firstShotT = -1, firstWho = '', shotsBefore = 0, gone = 0; const firstBy = new Map<any, number>(); let exc2 = ''; const log2: string[] = [];
      try {
        for (let f = 0; f < 60 * 12; f++) {
          const H = game.player.holding;
          if (endT < 0) { const s = game.player.char.pos; W.cursorAt([s[0], 0.02, s[2]]); if (H?.phase === 'choke' && chokeT < 0) chokeT = game.time; }
          W.step(DT); const t = game.time;
          if (endT < 0 && victim.state === 'dead') { endT = t; game.puppet = null; for (const m of men) if (!m.standoff) gone++; }
          const shotsNow = game.events.filter((e: any) => e.kind === 'guardShot' && e.time === t);
          if (endT < 0) shotsBefore += shotsNow.length;   // (the fold happens in updatePlayer, ahead of the guards: a round on that very frame is one AFTER it, at +0.00 s — and fails the beat below)
          else for (const e of shotsNow) { const m = men.find(x => v3.distXZ(e.pos, x.char.pos) < 0.05); if (m && !firstBy.has(m)) firstBy.set(m, t); if (firstShotT < 0) { firstShotT = t; firstWho = m?.callsign ?? '?'; } }
          if (f % 30 === 0) log2.push(`${f2(t - tA)}s hold ${H ? H.phase + ' ' + f2(H.t) : '—'} · Novak ${victim.state} · ${men.map(m => `${m.callsign} ${m.state}${m.standoff ? '/so' : ''} fireCd ${f2(m.fireCd)} react ${f2(Math.max(0, m.reactT))} seen ${f2(t - m.lastSeenT)}s ${m.char.anim.upper}${m.muzzleDown ? '(down)' : ''}`).join(' · ')}`);
          if (endT >= 0 && t - endT > 4.5) break;
        }
      } catch (e: any) { exc2 = String(e?.stack ?? e); }
      game.puppet = null;
      const fails: string[] = [];
      if (exc2) fails.push('exception: ' + exc2.split('\n')[0]);
      if (chokeT < 0) fails.push(`the choke never began (row chosen ${chose}, hover ${game.hover?.kind}/${game.hover?.verb})`);
      if (endT < 0) fails.push(`Novak never folded (${victim.state}, hold ${game.player.holding?.phase ?? 'null'})`);
      else {
        if (victim.downKind !== 'choked') fails.push(`Novak went down '${victim.downKind}' by ${victim.downBy} (want choked)`);
        if (shotsBefore) fails.push(`${shotsBefore} round(s) while the elbow was closing — the man still up in front of him`);
        if (gone !== men.length) fails.push(`only ${gone}/${men.length} standoff records dropped the frame he folded`);
        if (firstShotT < 0) fails.push('nobody fired in the 4.5 s after he folded, Sam standing lit (0.7) over the body');
        else { const d = firstShotT - endT; if (d < 0.35 - 1e-6) fails.push(`first round ${f2(d)} s after he folded (want ≥ 0.35: a start, not an execution)`); if (d > 4) fails.push(`first round only ${f2(d)} s after he folded (want ≤ 4)`); }
      }
      const ok = fails.length === 0; allPass &&= ok;
      console.log(`- ${ok ? 'PASS' : 'FAIL'} — (b) the choke in front of them: began +${chokeT >= 0 ? f2(chokeT - tA) : '—'} s, Novak folded +${endT >= 0 ? f2(endT - tA) : '—'} s (${victim.downKind ?? victim.state}); rounds while closing ${shotsBefore}; first round ${firstShotT >= 0 ? `+${f2(firstShotT - endT)} s after the fold (${firstWho})` : 'never'}; per man: ${men.map(m => `${m.callsign} ${firstBy.has(m) ? '+' + f2(firstBy.get(m)! - endT) + ' s' : '—'}`).join(', ')}; records dropped on the fold ${gone}/${men.length}\n    lines: ${lines.filter(l => l.t > tA).map(l => `${f1(l.t - tA)}s ${l.who}${l.radio ? ' (radio)' : ''}: "${l.text}"`).join(' · ') || '—'}\n    ${log2.join('\n    ')}\n    log tail: ${msgs.slice(-4).map(m => m.text).join(' | ')}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
    } else { allPass = false; console.log('- FAIL — (b) skipped: (a) did not leave a hold to end'); }
  }
  // ================================================================ (c) the flag off: the same twenty seconds fire
  {
    const S = await stageHold(383, 1, AT, FACE * DEG); const { W, game, victim, faceDeg } = S;
    game.tune.muzzleDiscipline = false;
    const A = game.guards[0], C = game.guards[2]; const men = [A, C]; const obs = new Map<any, Obs>(men.map(m => [m, newObs()]));
    const P0 = pairOf(game)!; const centre = v3.copy(P0.centre);
    bringIn(game, A, bearingPoint(centre, faceDeg + 15, 4.6), centre); bringIn(game, C, bearingPoint(centre, faceDeg - 25, 4.8), centre);
    const t0 = game.time; let exc = '', firstT = -1, shots = 0, holdEnded = '';
    try {
      for (let f = 0; f < 60 * 20; f++) {
        W.step(DT); const P = pairOf(game);
        if (!P) { holdEnded = `${f2(game.time - t0)}s (${victim.state}/${victim.downKind ?? '-'})`; break; }
        const n = observe(game, men, obs, P); shots += n; if (n && firstT < 0) firstT = game.time;
        if (firstT >= 0 && game.time - firstT > 3) break;
      }
    } catch (e: any) { exc = String(e?.stack ?? e); }
    game.puppet = null;
    const fails: string[] = [];
    if (exc) fails.push('exception: ' + exc.split('\n')[0]);
    if (!shots) fails.push(`not one round in 20 s with the discipline OFF${holdEnded ? ' (hold ended ' + holdEnded + ')' : ''} — the flag does nothing, or the flank never opened`);
    const ok = fails.length === 0; allPass &&= ok;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — (c) tune.muzzleDiscipline = false: ${shots} round(s) during the hold, the first +${firstT >= 0 ? f2(firstT - t0) : '—'} s in; ${men.map(m => obsLine(m, obs.get(m)!, t0)).join(' · ')}${holdEnded ? '; hold ended ' + holdEnded : ''}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
  }
  // ================================================================ (d) the gun hold, the gun-hold rule OFF: Sam fires past the man at Kowalski, and on into the room — Reyes, BEHIND the pair with the flank line his from the first second, holds it through all of it
  {
    const S = await stageHold(385, 1, AT, FACE * DEG, false, true); const { W, game, victim, lines, msgs, faceDeg } = S;   // (not frozen: Sam steers the pair onto Kowalski with the cursor, as a player lining up the shot does)
    const rule = { on: GUNHOLD.on, fire: GUNHOLD.fire }; GUNHOLD.on = false;   // after the stand-up (which writes the stand's own value): this case is the standoff WITHOUT the rule, on either stand — (e) is the one with it
    const A = game.guards[0], C = game.guards[2]; const men = [A, C]; const obs = new Map<any, Obs>(men.map(m => [m, newObs()]));
    const P0 = pairOf(game)!; const centre = v3.copy(P0.centre);
    bringIn(game, A, bearingPoint(centre, faceDeg + 15, 4.6), centre); bringIn(game, C, bearingPoint(centre, faceDeg + 180 - 12, 4.4), centre);   // Kowalski front-right at 4.6 m; Reyes a dozen degrees west of dead astern at 4.4 — the one place a round stops in Sam clear of Novak, and it stays his as Sam turns the pair the 15° onto Kowalski
    const variant = game.player.holding?.variant;
    const t0 = game.time; let exc = '', holdEnded = ''; let guardShots = 0, samShots = 0, hits = 0, prevHit = game.player.hitFlash, aDeadT = -1, clicks = 0, nextClick = 3.0; const log: string[] = [];
    let aimAtA: Vec3 = v3.add(A.char.pos, [0, 1.25, 0]);
    try {
      for (let f = 0; f < 60 * 16; f++) {
        if (A.state !== 'dead') aimAtA = v3.add(A.char.pos, [0, 1.25, 0]);   // on Kowalski's chest while he stands; where it was once he is down (the rounds go on past Novak into the room)
        W.cursorAt(aimAtA);
        const t = game.time - t0;
        if (t >= nextClick && clicks < 9) { W.input.clicked |= 1; clicks++; nextClick = t + 1.0; }
        W.step(DT); const P = pairOf(game);
        if (game.player.hitFlash > prevHit + 1e-9) hits++; prevHit = game.player.hitFlash;
        if (!P) { holdEnded = `${f2(game.time - t0)}s: victim ${victim.state}/${victim.downKind ?? '-'}/${victim.downBy ?? '-'}, holding ${game.player.holding?.phase ?? 'null'}, Sam down ${game.player.down}`; break; }
        guardShots += observe(game, men.filter(m => m.state !== 'dead'), obs, P);
        samShots += game.events.filter((e: any) => e.kind === 'shot' && e.time === game.time).length;
        if (aDeadT < 0 && A.state === 'dead') aDeadT = game.time;
        if (f % 90 === 0) log.push(`${f2(game.time - t0)}s ${standoffSummary(game) || '—'} · Sam's rounds ${samShots} · ${men.map(m => `${m.callsign} ${m.state}${m.standoff ? '/so' : ''} ${m.char.anim.upper}/${m.char.anim.stance}${m.muzzleDown ? '(down)' : ''} fireCd ${f2(m.fireCd)}`).join(' ')}`);
      }
    } catch (e: any) { exc = String(e?.stack ?? e); }
    game.puppet = null; GUNHOLD.on = rule.on; GUNHOLD.fire = rule.fire;
    const OC = obs.get(C)!;
    const fails: string[] = [];
    if (exc) fails.push('exception: ' + exc.split('\n')[0]);
    if (variant !== 'gun') fails.push(`staging: the hold is the '${variant}' variant (want gun: pistol drawn at the grab)`);
    if (holdEnded) fails.push('the hold ended: ' + holdEnded);
    if (samShots < 5) fails.push(`Sam got only ${samShots} round(s) off past him in ${clicks} clicks (want ≥ 5: the clicks must take)`);
    if (guardShots) fails.push(`${guardShots} guard round(s) answered Sam's fire with Novak alive in his arm: ${men.map(m => `${m.callsign} ${obs.get(m)!.shots.map(t => f2(t - t0) + 's').join(' ')}`).join(' · ')}`);
    if (aDeadT < 0 || A.downBy !== 'player') fails.push(`Kowalski ${A.state}/${A.downKind ?? '-'}/${A.downBy ?? '-'} at the end (want shot dead by Sam's rounds past the man — the point of the case)`);
    if (OC.enterT < 0) fails.push('Reyes never entered the standoff');
    else {
      if (OC.notAlert) fails.push(`Reyes not alert on ${OC.notAlert}/${OC.frames} frames`); if (OC.lost) fails.push(`Reyes' record dropped on ${OC.lost} frame(s)`); if (OC.poseBad > 2) fails.push(`Reyes posed neither aiming nor low-ready on ${OC.poseBad} frames`);
      if (OC.lineFrames * DT < 8) fails.push(`Reyes had a clean flank line for only ${f1(OC.lineFrames * DT)} s of 16 (want ≥ 8: he was put behind them for exactly that)`);
      if (OC.lineFrames >= 30 && OC.aimOnLine < 0.9 * OC.lineFrames) fails.push(`Reyes had a clean line ${f1(OC.lineFrames * DT)} s, pistol up on Sam only ${f1(OC.aimOnLine * DT)} s of it (point, don't fire)`);
    }
    if (victim.state === 'dead') fails.push(`Novak died in the arm: ${victim.downKind}/${victim.downBy}`);
    if (hits) fails.push(`Sam was hit ${hits}×`);
    const ok = fails.length === 0; allPass &&= ok;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — (d) gun hold (${variant}), gun-hold rule off, Sam fires ${samShots} round(s) past Novak (${clicks} clicks): Kowalski ${A.state}${aDeadT >= 0 ? ` (shot by ${A.downBy} +${f2(aDeadT - t0)} s)` : ''}; guard rounds ${guardShots}; Sam hit ${hits}×; Novak ${victim.state}; ${men.map(m => obsLine(m, obs.get(m)!, t0)).join(' · ')}\n    lines: ${lines.filter(l => l.t > t0 && !l.radio).map(l => `${f1(l.t - t0)}s ${l.who}: "${l.text}"`).join(' · ') || '—'}\n    ${log.join('\n    ')}\n    log tail: ${msgs.slice(-4).map(m => m.text).join(' | ')}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
  }
  // ================================================================ (e) the same gun hold with the gun-hold rule ON: what is left of the discipline once men answer a gun in the hold
  {
    const S = await stageHold(385, 1, AT, FACE * DEG, false, true); const { W, game, victim, lines, msgs, faceDeg } = S;
    const rule = { on: GUNHOLD.on, fire: GUNHOLD.fire }; GUNHOLD.on = true; GUNHOLD.fire = true;
    const A = game.guards[0], C = game.guards[2]; const men = [A, C]; const obs = new Map<any, Obs>(men.map(m => [m, newObs()]));
    const P0 = pairOf(game)!; const centre = v3.copy(P0.centre);
    bringIn(game, A, bearingPoint(centre, faceDeg + 15, 4.6), centre); bringIn(game, C, bearingPoint(centre, faceDeg + 180 - 12, 4.4), centre);   // (d)'s marks: Kowalski in front of the gun, Reyes a dozen degrees off dead astern
    const variant = game.player.holding?.variant;
    const t0 = game.time; let exc = '', holdEnded = ''; let samShots = 0, firstSam = -1, hits = 0, prevHit = game.player.hitFlash, clicks = 0, nextClick = 3.0; const log: string[] = [];
    const rounds: { t: number; who: string; rear: number }[] = [];   // every guard round: when, whose, and how far off dead astern of Sam he stood (degrees)
    let aimAtA: Vec3 = v3.add(A.char.pos, [0, 1.25, 0]);
    try {
      for (let f = 0; f < 60 * 16; f++) {
        if (A.state !== 'dead') aimAtA = v3.add(A.char.pos, [0, 1.25, 0]);
        W.cursorAt(aimAtA);
        const t = game.time - t0;
        if (t >= nextClick && clicks < 9) { W.input.clicked |= 1; clicks++; nextClick = t + 1.0; }
        W.step(DT); const P = pairOf(game);
        if (game.player.hitFlash > prevHit + 1e-9) hits++; prevHit = game.player.hitFlash;
        if (!P) { holdEnded = `${f2(game.time - t0)}s: victim ${victim.state}/${victim.downKind ?? '-'}/${victim.downBy ?? '-'}, holding ${game.player.holding?.phase ?? 'null'}, Sam down ${game.player.down}`; break; }
        const sam = game.events.filter((e: any) => e.kind === 'shot' && e.time === game.time).length; samShots += sam; if (sam && firstSam < 0) firstSam = game.time;
        for (const e of game.events.filter((e: any) => e.kind === 'guardShot' && e.time === game.time)) { const m = men.find(x => v3.distXZ(e.pos, x.char.pos) < 0.05); rounds.push({ t: game.time, who: m?.callsign ?? '?', rear: m ? flankShot(game, m, P).rear / DEG : 999 }); }
        observe(game, men.filter(m => m.state !== 'dead'), obs, P);
        if (f % 90 === 0) log.push(`${f2(game.time - t0)}s ${standoffSummary(game) || '—'} · Sam's rounds ${samShots} · ${men.map(m => `${m.callsign} ${m.state}${m.standoff ? '/so' : ''} ${m.char.anim.upper}/${m.char.anim.stance}${m.muzzleDown ? '(down)' : ''} fireCd ${f2(m.fireCd)}`).join(' ')}`);
      }
    } catch (e: any) { exc = String(e?.stack ?? e); }
    const stats = gunHoldStats(game);
    game.puppet = null; GUNHOLD.on = rule.on; GUNHOLD.fire = rule.fire;
    const fails: string[] = [];
    if (exc) fails.push('exception: ' + exc.split('\n')[0]);
    if (variant !== 'gun') fails.push(`staging: the hold is the '${variant}' variant (want gun: pistol drawn at the grab)`);
    if (holdEnded) fails.push('the hold ended: ' + holdEnded);
    if (samShots < 5) fails.push(`Sam got only ${samShots} round(s) off past him in ${clicks} clicks (want ≥ 5: the clicks must take)`);
    if (!stats.armed) fails.push('the gun-hold rule never armed: nobody answered the pistol in the hold (the switch is on)');
    const early = rounds.filter(r => firstSam < 0 || r.t < firstSam); if (early.length) fails.push(`${early.length} guard round(s) BEFORE Sam had fired: ${early.map(r => `${r.who} +${f2(r.t - t0)}s`).join(', ')} (the line at his back is held silent until he shoots)`);
    const front = rounds.filter(r => r.who !== C.callsign); if (front.length) fails.push(`${front.length} round(s) from a man who was not behind the pair: ${front.map(r => `${r.who} +${f2(r.t - t0)}s`).join(', ')} (the man in front of the gun runs, he does not shoot past his colleague)`);
    const wide = rounds.filter(r => r.rear > 70 + 1e-6); if (wide.length) fails.push(`${wide.length} round(s) from more than 70° off dead astern: ${wide.map(r => `${r.who} +${f2(r.t - t0)}s at ${f1(r.rear)}°`).join(', ')} (not the clean line at Sam's back)`);
    const mine = rounds.filter(r => r.who === C.callsign); let gap = Infinity; for (let i = 1; i < mine.length; i++) gap = Math.min(gap, mine[i].t - mine[i - 1].t);
    if (!mine.length) fails.push(`Reyes never fired from the line at Sam's back in ${f1((game.time - (firstSam < 0 ? game.time : firstSam)))} s of Sam shooting (the rule gives that line single aimed rounds)`);
    if (gap < 0.8) fails.push(`two of Reyes's rounds ${f2(gap)} s apart (want ≥ 0.8: single aimed rounds on the standoff's slow cadence, not his weapon's)`);
    if (victim.state === 'dead' && !/player/.test(String(victim.downBy))) fails.push(`Novak died in the arm to his own side: ${victim.downKind}/${victim.downBy}`);
    const ok = fails.length === 0; allPass &&= ok;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — (e) gun hold (${variant}), gun-hold rule on, Sam fires ${samShots} round(s) past Novak (${clicks} clicks, the first +${firstSam >= 0 ? f2(firstSam - t0) : '—'} s): guard rounds ${rounds.length} [${rounds.map(r => `${r.who} +${f2(r.t - t0)}s ${f1(r.rear)}°`).join(' · ')}]${Number.isFinite(gap) ? `, Reyes's closest two ${f2(gap)} s apart` : ''}; Kowalski ${A.state}${A.state === 'dead' ? '/' + A.downBy : ''}; Sam hit ${hits}×; Novak ${victim.state}; rule: ${JSON.stringify(stats)}\n    ${men.map(m => obsLine(m, obs.get(m)!, t0)).join(' · ')}\n    lines: ${lines.filter(l => l.t > t0 && !l.radio).map(l => `${f1(l.t - t0)}s ${l.who}: "${l.text}"`).join(' · ') || '—'}\n    ${log.join('\n    ')}\n    log tail: ${msgs.slice(-4).map(m => m.text).join(' | ')}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
  }
  console.log(`=== standoff-discipline: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}
