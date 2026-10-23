// The 'ai-pass' probe family (run through probes.ts: `bun run tools/qa/probes.ts ai-pass | muzzle | motion | missing`): muzzle discipline (a colleague in the
// line → low ready, no round, a step aside in a fight), motion acuity (the sight-gain table from real displacement), and the net's radio check turning an
// undiscovered death into a stimulus. Each stands the full game up headless (headless.ts), stages one situation, steps it, prints what happened, PASS / FAIL.
import { standUp, ROOT } from './headless.ts';
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);
const guardsMod = await import(`${ROOT}/src/game/guards.ts`);
const { crouchPace } = await import(`${ROOT}/src/game/player.ts`);
const { sightGain } = guardsMod;

type Vec3 = [number, number, number];
const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** Every guard but [0] out of it: parked on the lot east of the building, held, deaf-and-blind. Returns [0]. */
function parkOthers(game: any): any {
  for (const o of game.guards.slice(1)) { o.hold = true; o.pinned = true; o.dazzledUntil = 1e9; o.heardUpTo = 1e12; o.char.pos = [37.5, 0, 6 + game.guards.indexOf(o)]; o.char.update(0); }
  return game.guards[0];
}
function placeGuard(gd: any, p: Vec3, face: Vec3) { gd.char.pos = v3.copy(p); gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.char.bodyYaw = gd.char.aimYaw = Math.atan2(face[0] - p[0], face[2] - p[2]); gd.char.aimPitch = 0; gd.path = []; gd.pathGoal = null; gd.char.update(0); gd.char.update(DT); }

// ================================================================ muzzle discipline
/** distance (m) from a vertical body axis at (ax, az), y in [y0, y1], to the segment a→b — the same measure guards.ts colleagueInLine keeps the men to */
function segToAxis(a: Vec3, b: Vec3, ax: number, az: number, y0: number, y1: number): number {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2]; const L2 = dx * dx + dz * dz; if (L2 < 1e-8) return Math.hypot(a[0] - ax, a[2] - az);
  const t = Math.max(0, Math.min(1, ((ax - a[0]) * dx + (az - a[2]) * dz) / L2));
  const px = a[0] + dx * t, py = a[1] + dy * t, pz = a[2] + dz * t; const ddy = py < y0 ? y0 - py : py > y1 ? py - y1 : 0;
  return Math.hypot(px - ax, pz - az, ddy);
}
const axisOf = (o: any) => { const h = o.char.bones.hips ?? o.char.pos; return { x: h[0], z: h[2], y0: o.char.pos[1] + 0.05, y1: o.char.bones.headTop?.[1] ?? 1.75 }; };

/** (1) The tour's own stack on the conference door (demo.ts CONFERENCE_CLEAR, run staged by squad.ts RoomClear): no. 2 tucked in 0.85 m behind no. 1 with his
 *  ordered aim high over the man's shoulder — the line from his gun shoulder to that point runs through no. 1's head. While both are planted in the stack: is
 *  no. 2's muzzle down (Guard.muzzleDown, the low-ready carry, gun axis pitched to the floor), where does his laser land, and is no. 1 (nobody ahead of him) left up?
 *  (2) The lockdown pair walking the leader's route in file: how much of the walk the follower's carry is lowered for the man ahead, and that it IS whenever the
 *  leader stands in the line of his carry. (3) A fight: Sam lit and rooted, one man licensed to shoot him from seven metres, a blinded colleague planted squarely
 *  in the line — then walking back and forth across it: the shooter must step aside and get his rounds off (first round inside ~2 s of being blocked), and over
 *  the whole run no round's muzzle→target segment may pass within 0.3 m of the living colleague's axis. PASS / FAIL each. */
export async function muzzle() {
  console.log('\n=== muzzle: low ready rather than a pistol pointed at a colleague — the stack, a pair in file, a man crossing the line in a fight ===');
  const { RoomClear } = await import(`${ROOT}/src/game/squad.ts`);
  const { CONFERENCE_CLEAR } = await import(`${ROOT}/src/game/demo.ts`);
  const { laserBoxes, LASER } = await import(`${ROOT}/src/game/combat.ts`);
  const { colleagueInLine, aimAhead } = guardsMod;
  let allPass = true; const verdict = (ok: boolean, label: string, detail: string) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  // ---- (1) the stack
  {
    Math.random = seeded(101);
    const W = await standUp(); const { game } = W;
    game.playerInvisible = true; game.godMode = true; game.quietUtility = true; game.teleportPlayer([6.3, 0, 12.8]); game.player.crouch = true;
    for (let i = 0; i < 10; i++) W.step(DT);
    const [a, b] = game.guards; for (const o of game.guards.slice(2)) o.hold = true;
    const d = game.doors.byName('conference'); d.reset(); d.angle = 0; d.vel = 0; d.latched = true; d.closing = false;
    const clear = new RoomClear(game, CONFERENCE_CLEAR, a, b); clear.start();
    let t = 0, planted = 0, bDown = 0, aDown = 0, pitchSum = 0; let laserEndY = NaN, laserLen = NaN, laserToA = NaN; const rows: string[] = [];
    for (let f = 0; f < 60 * 6 && clear.phase === 'stack'; f++) {
      clear.tick(t, DT); W.step(DT); t += DT;
      const both = !!a.script?.arrived && !!b.script?.arrived;
      if (both) {
        planted++; if (b.muzzleDown) { bDown++; pitchSum += b.char.gunDir[1]; } if (a.muzzleDown) aDown++;
        if (planted === 30) {   // half a second into the formed stack: where no. 2's beam actually lands
          const out: any[] = []; LASER.enemy = true; try { laserBoxes(game, b, out); } finally { LASER.enemy = false; }   // (the guards' lasers on, as before combat.ts LASER: out[0] is read as his beam)
          if (out.length) { const beam = out[0]; laserLen = beam.h[2] * 2; const from = v3.mad(b.char.muzzle, b.char.gunDir, 0.02); const end = v3.mad(from, b.char.gunDir, laserLen); laserEndY = end[1]; const A = axisOf(a); laserToA = segToAxis(from, end, A.x, A.z, A.y0, A.y1); }
        }
      }
      if (f % 30 === 29) rows.push(`    ${t.toFixed(1)}s phase ${clear.phase} · #1 arrived ${!!a.script?.arrived} down ${a.muzzleDown} · #2 arrived ${!!b.script?.arrived} down ${b.muzzleDown} gunDir.y ${b.char.gunDir[1].toFixed(2)} stance ${b.char.anim.stance}/${b.char.anim.upper} · gap ${v3.distXZ(a.char.pos, b.char.pos).toFixed(2)} m`);
    }
    const fracB = planted ? bDown / planted : 0, meanPitch = bDown ? pitchSum / bDown : 0;
    verdict(planted > 30 && fracB > 0.9 && aDown === 0 && meanPitch < -0.4, '(1) the stack on the conference door: no. 2 behind no. 1',
      `stack formed for ${(planted * DT).toFixed(1)} s of the phase; no. 2 muzzleDown ${(100 * fracB).toFixed(0)} % of it (want > 90), gun axis y ${meanPitch.toFixed(2)} while down (want < −0.4: on the floor), no. 1 lowered ${aDown} frames (want 0); no. 2's laser is OFF while lowered (combat.ts handProps) — had it been on at +0.5 s: ${isNaN(laserLen) ? '—' : `${laserLen.toFixed(2)} m long, landing at y ${laserEndY.toFixed(2)}, ${laserToA.toFixed(2)} m off no. 1's axis`}`);
    console.log(rows.join('\n'));
    clear.end('patrol');
  }
  // ---- (2) the lockdown pair in file
  {
    Math.random = seeded(102);
    const W = await standUp(); const { game } = W;
    game.playerInvisible = true; game.godMode = true; game.teleportPlayer([4.9, 0, 23.2]);
    for (let i = 0; i < 30; i++) W.step(DT);
    game.escalate(); game.escalate(); if (game.clearing) { game.clearing.cancel(); game.clearing = null; }
    for (let i = 0; i < 60 * 8; i++) W.step(DT);   // formed up
    const follower = game.guards.find((x: any) => x.leader); const leader = follower?.leader;
    if (!follower) verdict(false, '(2) lockdown pair in file', `no pair formed: ${game.escalationSummary()}`);
    else {
      let inFile = 0, downInFile = 0, inLineFrames = 0, downWhenInLine = 0, leaderDownByFollower = 0, walkFrames = 0; let pitchSum = 0, pitchN = 0;
      for (let f = 0; f < 60 * 40; f++) {
        W.step(DT);
        if (follower.state !== 'patrol' || leader.state !== 'patrol') continue;
        const gap = v3.distXZ(follower.char.pos, leader.char.pos); const lf = leader.char.forward();
        const behind = ((follower.char.pos[0] - leader.char.pos[0]) * lf[0] + (follower.char.pos[2] - leader.char.pos[2]) * lf[2]) < -0.3;
        const walking = follower.speed > 0.4; if (walking) walkFrames++;
        if (gap < 2.6 && behind && walking) { inFile++; if (follower.muzzleDown) { downInFile++; pitchSum += follower.char.gunDir[1]; pitchN++; } }
        const o = colleagueInLine(game, follower, aimAhead(follower.char));
        if (o === leader) { inLineFrames++; if (follower.muzzleDown) downWhenInLine++; }
        if (leader.muzzleDown && colleagueInLine(game, leader, aimAhead(leader.char)) === follower) leaderDownByFollower++;
      }
      const frac = inFile ? downInFile / inFile : 0, cons = inLineFrames ? downWhenInLine / inLineFrames : 1;
      verdict(inFile > 120 && frac > 0.4 && cons > 0.98 && (pitchN === 0 || pitchSum / pitchN < -0.4), '(2) lockdown pair walking in file (40 s)',
        `follower ${game.level.routes[follower.routeI].name} behind ${game.level.routes[leader.routeI].name}: walking in file ${(inFile * DT).toFixed(1)} s, carry lowered ${(100 * frac).toFixed(0)} % of that (want > 40); leader in the line of his carry ${(inLineFrames * DT).toFixed(1)} s → lowered ${(100 * cons).toFixed(1)} % of those frames (want ≥ 98: the probe re-asks after the pose, a frame skewed); gun axis y while lowered ${pitchN ? (pitchSum / pitchN).toFixed(2) : '—'}; leader lowered on the follower's account ${leaderDownByFollower} frames (a turnabout puts the follower ahead for a moment)`);
    }
  }
  // ---- (3) the fight: a colleague planted in the line where a side-step opens it (open ground) / where none can (a narrow corridor, dead centre) / crossing it
  type Fight = { key: string; label: string; GA: Vec3; SAM: Vec3; bOut: Vec3; bIn: Vec3; cross?: [Vec3, Vec3]; want: number };
  const fights: Fight[] = [
    { key: 'a', label: 'planted a hand off-centre in the line on open ground (a side-step opens it)', GA: [8, 0, 1.9], SAM: [15, 0, 1.9], bOut: [11.5, 0, 3.1], bIn: [11.5, 0, 2.05], want: 2.0 },
    { key: 'b', label: 'planted dead-centre in the line in 1.5 m of corridor (no side-step opens the angle — he has to push up past the man)', GA: [20, 0, 11.2], SAM: [27, 0, 11.2], bOut: [23.5, 0, 10.45], bIn: [23.5, 0, 11.2], want: 3.5 },
    { key: 'c', label: 'walking back and forth across the line in the corridor', GA: [20, 0, 11.2], SAM: [27, 0, 11.2], bOut: [23.5, 0, 10.45], bIn: [23.5, 0, 11.2], cross: [[23.5, 0, 11.9], [23.5, 0, 10.4]], want: 4.0 },
  ];
  for (const F of fights) {
    const crossing = !!F.cross;
    Math.random = seeded(103 + fights.indexOf(F));
    const W = await standUp(); const { game } = W;
    game.godMode = true; game.aiEnabled = true;
    for (let i = 0; i < 10; i++) W.step(DT);
    for (const o of game.guards.slice(2)) { o.hold = true; o.pinned = true; o.dazzledUntil = 1e9; o.heardUpTo = 1e12; o.char.pos = [37.5, 0, 8]; o.char.update(0); }
    const [A, B] = game.guards;
    const SAM = F.SAM, GA = F.GA;   // seven metres between them
    game.teleportPlayer(v3.copy(SAM)); game.player.visibility = 0.9; game.puppet = { goal: v3.copy(SAM), aim: [GA[0], 1.2, GA[2]] };
    placeGuard(A, GA, SAM);
    A.state = 'alert'; A.awareness = 1; A.reactT = 0; A.fireCd = 0.3; A.weapon.rearm(); A.reloadT = -1; A.lastKnown = v3.copy(SAM); A.lastSeenT = game.time; guardsMod.resetChase(A); A.pinned = false; A.hold = false; A.dazzledUntil = -1; A.heardUpTo = 1e12;
    // B: blind, deaf and rooted (dazzled for good, pinned) — first out of the way beside the line, then put INTO it once A has fired a couple of rounds clean
    placeGuard(B, F.bOut, [F.bOut[0], 0, F.bOut[2] - 5]); B.state = 'alert'; B.awareness = 1; B.pinned = true; B.hold = true; B.dazzledUntil = 1e9; B.heardUpTo = 1e12; B.lastKnown = null; B.reactT = 1e9;
    let shots = 0, badRounds = 0, worst = Infinity; const shotT: number[] = []; let blockedAt = -1, firstAfterBlock = -1; let steps = 0; let lastPathRef: any = null;
    const play = game.audio.play; game.audio.play = (n: string, ...rest: unknown[]) => {
      if (n === 'pistolLoud') {   // the round is leaving A's muzzle right now (fireWeapon plays it before the hit scan): its segment against B's axis
        shots++; shotT.push(game.time);
        const from = v3.copy(A.char.muzzle); const to = v3.add(game.player.char.pos, [0, game.player.crouch ? 0.8 : 1.25, 0]); const ax = axisOf(B);
        const dd = segToAxis(from, to, ax.x, ax.z, ax.y0, ax.y1); worst = Math.min(worst, dd); if (dd < 0.3) badRounds++;
        if (blockedAt >= 0 && firstAfterBlock < 0) firstAfterBlock = game.time - blockedAt;
      }
      return play(n, ...rest);
    };
    const rows: string[] = []; const t0 = game.time; let downFrames = 0; let bGoalW = true;
    for (let f = 0; f < 60 * 24; f++) {
      const t = game.time - t0;
      if (blockedAt < 0 && shots >= 2 && t > 2) {   // two clean rounds off: now the colleague goes into the line
        blockedAt = game.time;
        if (!crossing) { placeGuard(B, F.bIn, [F.bIn[0], 0, F.bIn[2] - 5]); B.pinned = true; B.hold = true; }
        else { B.pinned = false; B.hold = false; B.dazzledUntil = -1; B.reactT = 0; B.state = 'patrol'; B.awareness = 0; B.heardUpTo = 1e12; B.script = { goal: v3.copy(F.cross![0]), speed: 1.1, upper: 'relaxed', face: Math.PI / 2, strafe: false }; }
      }
      if (crossing && B.script?.arrived) { bGoalW = !bGoalW; B.script = { goal: v3.copy(F.cross![bGoalW ? 0 : 1]), speed: 1.1, upper: 'relaxed' }; }   // back and forth across the line, a body's width past it each way
      A.lastSeenT = game.time; A.awareness = 1; if (A.state !== 'alert') { A.state = 'alert'; A.reactT = 0; }   // (keep it a fight about the line, not about losing him)
      W.step(DT);
      if (A.muzzleDown) downFrames++;
      if (A.path !== lastPathRef) { lastPathRef = A.path; if (A.path.length === 1 && blockedAt >= 0) steps++; }
      if (f % 30 === 29) rows.push(`    ${t.toFixed(1).padStart(4)}s A ${A.state} (${A.char.pos[0].toFixed(2)}, ${A.char.pos[2].toFixed(2)}) down ${A.muzzleDown ? 'Y' : 'n'} spd ${A.speed.toFixed(2)} stance ${A.char.anim.stance}/${A.char.anim.upper} · B (${B.char.pos[0].toFixed(2)}, ${B.char.pos[2].toFixed(2)}) ${B.script ? 'walking' : 'planted'} · shots ${shots} bad ${badRounds}`);
    }
    game.audio.play = play; game.puppet = null;
    const ok = blockedAt >= 0 && badRounds === 0 && firstAfterBlock >= 0 && firstAfterBlock < F.want && shots >= 6;
    verdict(ok, `(3${F.key}) a fight with a colleague ${F.label}`,
      `${shots} rounds in 24 s, ${badRounds} within 0.3 m of the colleague's axis (want 0; nearest ${isFinite(worst) ? worst.toFixed(2) : '—'} m); blocked at +${blockedAt >= 0 ? (blockedAt - t0).toFixed(1) : '—'} s, first round after that +${firstAfterBlock >= 0 ? firstAfterBlock.toFixed(2) : 'never'} s (want < ${F.want}); side-steps taken ${steps}; A lowered ${(downFrames * DT).toFixed(1)} s of the run; A ends at (${A.char.pos[0].toFixed(2)}, ${A.char.pos[2].toFixed(2)}), ${v3.distXZ(A.char.pos, GA).toFixed(2)} m off his spot`);
    console.log(rows.filter((_, i) => i < 24).join('\n'));
  }
  console.log(`=== muzzle: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}

// ================================================================ missing colleagues: the radio check
/** The lobby man taken down quietly where nobody's route looks — (A) folded behind the reception desk, (B) hauled right out onto the grass west of the building —
 *  on a calm floor, Sam gone: NOTHING may come of it until the net's radio check (~90 s): then the count-in without him, his name asked for ~4 s later, a free
 *  man sent round his route ~8 s after the call, and either the body found on the way (the ordinary 'man down!' and its aftermath, the floor up on 'body') or
 *  the whole route walked and 'not at his post' putting the floor up a step on 'missing'. (D) two men down where no indoor eye can reach, one left: he runs the
 *  whole thing alone, one name per check. (C) the lockdown pair: the leader dies unseen and his body is spirited ten metres off through two walls — twenty
 *  seconds on, the follower calls him, gets nothing, reports him, and is himself sent round the route. PASS / FAIL. */
export async function missing() {
  console.log('\n=== missing: an undiscovered death becomes known through the radio check — and not a moment before ===');
  const { rollcallState } = guardsMod;
  let allPass = true; const verdict = (ok: boolean, label: string, detail: string) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  type Case = { key: string; label: string; body: Vec3; yaw: number };
  const cases: Case[] = [
    { key: 'A', label: 'body folded behind the reception desk (on the dead man\'s own loop: whoever walks it should come on him) — the shift alone on the floor', body: [7.6, 0, 16.1], yaw: -Math.PI / 2 },
    { key: 'B', label: 'body out on the grass west of the building (nowhere any route looks: the walk should come to nothing)', body: [2.0, 0, 7.0], yaw: Math.PI },
  ];
  for (const C of cases) {
    Math.random = seeded(C.key === 'A' ? 201 : 202);
    const W = await standUp(); const { game } = W;
    // (A) and (B) RESTAGED with the civilians OFF (probe-restaging lane, docs/internal/probe-restage.md; ko-probes.ts koRollcall is the same staging and carries the
    // measurement): the premise here is that the death becomes known through the SHIFT's radio check and the man it sends — but since the civilians merged (d7c3289)
    // the late worker's loop brings him on the body behind the reception desk ≈ 16 s after the man is sent (seed 201: Owen alarmed at +113.5 s, tells Novak at +119.6,
    // control puts the floor up on cause 'civilian' at +122.4), the run ends on that escalation and the walk never reaches the desk: neither 'found' nor 'not at his
    // post'. Whether "a civilian called it in first" is a legitimate THIRD outcome of this staging is the maintainer's call, not the probe's — until then the floor is
    // the shift alone, exactly what the probe was written against. (D) and (C) below keep the civilians ON: their bodies lie where no civilian goes, and that they
    // leak nothing there is worth holding.  TODO(civilians-on variant, awaiting the maintainer): a case 'A2' with them on, expecting cause 'civilian' before the walk.
    game.tune.civilians = false; game.civilians.length = 0;
    game.playerInvisible = true; game.godMode = true; game.teleportPlayer([37.5, 0, 26.5]);   // Sam out of it in the far corner of the lot
    const name = (gd: any) => `${gd.callsign}(${game.level.routes[gd.routeI].name})`;
    const lines: { t: number; who: string; text: string; radio: boolean }[] = []; const msgs: { t: number; text: string }[] = [];
    const origSay = game.say.bind(game); game.say = (gd: any, text: string, radio = false) => { lines.push({ t: game.time, who: name(gd), text, radio }); return origSay(gd, text, radio); };
    const origMsg = game.msg.bind(game); game.msg = (text: string) => { msgs.push({ t: game.time, text }); return origMsg(text); };
    for (let i = 0; i < 60 * 5; i++) W.step(DT);
    const victim = game.guards[2];   // lobby_break
    victim.char.pos = v3.copy(C.body); victim.char.vel = [0, 0, 0]; victim.char.bodyYaw = victim.char.aimYaw = C.yaw; victim.path = []; victim.pathGoal = null; victim.char.update(0); victim.char.update(DT);
    killGuard(game, victim, [Math.sin(C.yaw), 0, Math.cos(C.yaw)], true);
    const tKill = game.time; const R = rollcallState(game);
    let tCall = -1, tAsk = -1, tSend = -1, tFound = -1, tNotAtPost = -1, tEsc = -1; let checker: any = null; let escCause = '';
    let preLeak = '';   // anything at all reacting before the call
    const others = game.guards.filter((x: any) => x !== victim);
    for (let f = 0; f < 60 * 260; f++) {
      W.step(DT);
      const t = game.time;
      if (tCall < 0) {
        const l = lines.find(x => /sound off/.test(x.text)); if (l) tCall = l.t;
        else if (!preLeak) {
          if (victim.found) preLeak = `${t.toFixed(1)}s body marked found`;
          else if (game.escalation !== 0) preLeak = `${t.toFixed(1)}s escalation ${game.escalation}`;
          else for (const o of others) { if (o.state !== 'patrol' || o.task || o.bodyDuty) { preLeak = `${t.toFixed(1)}s ${name(o)} ${o.state}${o.task ? ' task:' + o.task.kind : ''}${o.bodyDuty ? ' bodyDuty' : ''} — last line: ${lines[lines.length - 1]?.text ?? '—'}`; break; } }
        }
      }
      if (tCall >= 0 && tAsk < 0) { const l = lines.find(x => x.t > tCall && x.text.includes(`${victim.callsign}?`)); if (l) tAsk = l.t; }
      if (tCall >= 0 && tSend < 0) { const c = others.find((x: any) => x.task?.kind === 'checkOn' && x.task.who === victim); if (c) { tSend = t; checker = c; } }
      if (tFound < 0 && victim.found) tFound = t;
      if (tNotAtPost < 0) { const l = lines.find(x => /not at his post/.test(x.text)); if (l) tNotAtPost = l.t; }
      if (tEsc < 0 && game.escalation > 0) { tEsc = t; escCause = lines.slice(-3).map(x => x.text).join(' | '); }
      if (tEsc >= 0 && t > tEsc + 3) break;
    }
    const rel = (t: number) => t >= 0 ? `+${(t - tKill).toFixed(1)} s` : 'never';
    const outcome = tFound >= 0 ? 'found' : tNotAtPost >= 0 ? 'not-at-post' : 'none';
    const fails: string[] = [];
    if (preLeak) fails.push(`something moved before the radio check: ${preLeak}`);
    if (tCall < 0 || tCall - tKill > 100) fails.push(`radio check at ${rel(tCall)} (want within 100 s of the kill)`);
    if (tAsk < 0 || Math.abs(tAsk - tCall - 4) > 0.6) fails.push(`his name asked for at ${tAsk >= 0 ? '+' + (tAsk - tCall).toFixed(1) + ' s after the call' : 'never'} (want ≈ +4 s)`);
    if (tSend < 0 || Math.abs(tSend - tCall - 8) > 0.6) fails.push(`a man sent at ${tSend >= 0 ? '+' + (tSend - tCall).toFixed(1) + ' s after the call' : 'never'} (want ≈ +8 s)`);
    if (outcome === 'none') fails.push('neither found nor reported not-at-post within the run');
    if (outcome === 'found' && !(tEsc >= 0 && game.escalation >= 1)) fails.push(`found but the floor stayed at ${game.escalation}`);
    if (outcome === 'not-at-post' && !(tEsc >= 0 && Math.abs(tEsc - tNotAtPost) < 0.1 && game.escalation === 1 && victim.missingRaised)) fails.push(`'not at his post' at ${rel(tNotAtPost)} but escalation ${game.escalation} at ${rel(tEsc)} raised=${victim.missingRaised}`);
    if (C.key === 'B' && outcome !== 'not-at-post') fails.push(`expected the walk to come to nothing out there, got ${outcome}`);
    verdict(fails.length === 0, `(${C.key}) ${C.label}`,
      `${name(victim)} killed at ${tKill.toFixed(1)} s · radio check ${rel(tCall)} · asked for ${rel(tAsk)} · ${checker ? name(checker) : 'nobody'} sent ${rel(tSend)} · ${outcome === 'found' ? `body FOUND ${rel(tFound)}` : outcome === 'not-at-post' ? `'not at his post' ${rel(tNotAtPost)}` : 'no outcome'} · floor → ${game.escalation} at ${rel(tEsc)}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
    const from = lines.findIndex(x => x.t >= (tCall >= 0 ? tCall : tKill) - 0.01);
    const merged = [...lines.slice(Math.max(0, from)).map(l => ({ t: l.t, s: `${l.who}${l.radio ? ' (radio)' : ''}: ${l.text}` })), ...msgs.filter(m => m.t >= tKill && /^radio: …/.test(m.text)).map(m => ({ t: m.t, s: `[log] ${m.text}` }))].sort((a, b) => a.t - b.t);
    console.log('    ' + merged.slice(0, 22).map(x => `${rel(x.t).padStart(9)} ${x.s}`).join('\n    '));
    console.log(`    (radio checks run this game: ${R.checks}; next due at ${R.nextAt >= 0 ? R.nextAt.toFixed(0) + ' s' : '—'})`);
  }
  // ---- (D) two men gone, one left: he runs the whole thing by himself, one name at a time, a fresh silence before a reported one. Both bodies lie on the strip NORTH
  // of the building, under the clerestory windows (the north wall's only openings start 2.05 m up: no eye indoors can see the ground out there, and no route or
  // errand goes there) — the premise is that neither death is discovered by eye, and the probe checks it. (They used to lie west of the building, one of them two
  // metres outside the lobby's floor-length glazing: in plain view through the arch from the corridor man's own patrol line for a frame a lap, 0.1° inside his
  // cone since the walk clip's retime — found at +57 s, called in, and so, correctly, never asked for by name: a found man is known. That was the probe's mistake.)
  {
    Math.random = seeded(204);
    const W = await standUp(); const { game } = W;
    game.playerInvisible = true; game.godMode = true; game.teleportPlayer([37.5, 0, 26.5]);
    const name = (gd: any) => `${gd.callsign}(${game.level.routes[gd.routeI].name})`;
    const lines: { t: number; who: string; text: string; radio: boolean }[] = []; const origSay = game.say.bind(game); game.say = (gd: any, text: string, radio = false) => { lines.push({ t: game.time, who: name(gd), text, radio }); return origSay(gd, text, radio); };
    for (let i = 0; i < 60 * 3; i++) W.step(DT);
    const [k, n, r] = game.guards;   // Kowalski stays; Novak and Reyes die out on the grass north of the building, unseen
    for (const [v, p] of [[n, [8.0, 0, 2.0]], [r, [26.0, 0, 2.0]]] as [any, Vec3][]) { v.char.pos = v3.copy(p); v.char.vel = [0, 0, 0]; v.path = []; v.pathGoal = null; v.char.update(0); v.char.update(DT); killGuard(game, v, [-1, 0, 0], true); }
    const t0 = game.time; let threw = ''; const asked: string[] = []; let sends = 0; let stillNothing = 0; let tCall = -1; let preLeak = ''; const transcript: { t: number; s: string }[] = [];
    try {
      for (let f = 0; f < 60 * 330; f++) {
        W.step(DT);
        const t = game.time;
        if (tCall < 0 && !preLeak) {   // the premise: until the net calls its check, nothing whatever has come of the two deaths
          if (n.found || r.found) preLeak = `${(t - t0).toFixed(1)} s: ${n.found ? n.callsign : r.callsign}'s body seen — by ${name(k)} at (${k.char.pos[0].toFixed(1)}, ${k.char.pos[2].toFixed(1)})`;
          else if (game.escalation !== 0) preLeak = `${(t - t0).toFixed(1)} s: escalation ${game.escalation}`;
          else if (k.state !== 'patrol' || k.task || k.bodyDuty) preLeak = `${(t - t0).toFixed(1)} s: ${name(k)} ${k.state}${k.task ? ' task:' + k.task.kind : ''}${k.bodyDuty ? ' bodyDuty' : ''}`;
        }
        for (const l of lines.splice(0)) {
          if (tCall < 0 && /^radio check/.test(l.text)) tCall = l.t;
          const m = /^(\w+)\? … \1, sound off/.exec(l.text); if (m) asked.push(m[1]);
          if (/going round his route|going to walk his route|going to check on/.test(l.text)) sends++; if (/still nothing from/.test(l.text)) stillNothing++;   // (the checker's own line, whether or not he was also the caller)
          if (/sound off|route|check on|not at his post|man down|it's \w+ — he's down|lock it down|weapons out/.test(l.text)) transcript.push({ t: l.t, s: `${l.who}${l.radio ? ' (radio)' : ''}: ${l.text}` });
        }
      }
    } catch (e: any) { threw = String(e?.stack ?? e); }
    const fails: string[] = [];
    if (threw) fails.push('EXCEPTION ' + threw.slice(0, 200));
    if (preLeak) fails.push(`something moved before the radio check: ${preLeak}`);
    if (n.found || r.found) fails.push(`a body was found by eye (${[n, r].filter((x: any) => x.found).map((x: any) => x.callsign).join(', ')}): the staging no longer keeps them out of sight`);
    if (tCall < 0 || tCall - t0 > 100) fails.push(`radio check at ${tCall >= 0 ? '+' + (tCall - t0).toFixed(1) + ' s' : 'never'} (want within 100 s of the kills)`);
    if (!(asked.includes(n.callsign) && asked.includes(r.callsign))) fails.push(`asked after ${asked.join(', ') || 'nobody'} — want both`);
    if (sends < 2) fails.push(`route walks begun ${sends} — want ≥ 2`);
    if (game.escalation < 1) fails.push(`floor ended ${game.escalationSummary()}`);
    if (k.state === 'dead') fails.push(`${k.callsign} died`);
    verdict(fails.length === 0, '(D) two men silent, one left on the floor', `first radio check ${tCall >= 0 ? '+' + (tCall - t0).toFixed(1) + ' s' : 'never'}; asked after, in order: ${asked.join(', ') || 'nobody'} (want both ${n.callsign} and ${r.callsign}); route walks begun ${sends} (want ≥ 2); 'still nothing' notes ${stillNothing}; bodies found by eye: ${[n, r].filter((x: any) => x.found).map((x: any) => x.callsign).join(', ') || 'none'}; floor now ${game.escalationSummary()}; ${(game.time - t0).toFixed(0)} s run${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
    console.log('    ' + transcript.slice(0, 14).map(x => `${('+' + (x.t - t0).toFixed(1) + ' s').padStart(9)} ${x.s}`).join('\n    '));
  }
  // ---- (C) partner awareness: the leader gone from under his follower's nose
  {
    Math.random = seeded(203);
    const W = await standUp(); const { game } = W;
    game.playerInvisible = true; game.godMode = true; game.teleportPlayer([37.5, 0, 26.5]);
    const name = (gd: any) => `${gd.callsign}(${game.level.routes[gd.routeI].name})`;
    const lines: { t: number; who: string; text: string }[] = []; const origSay = game.say.bind(game); game.say = (gd: any, text: string, radio = false) => { lines.push({ t: game.time, who: name(gd), text }); return origSay(gd, text, radio); };
    for (let i = 0; i < 30; i++) W.step(DT);
    game.escalate(); game.escalate(); if (game.clearing) { game.clearing.cancel(); game.clearing = null; }
    for (let i = 0; i < 60 * 15; i++) W.step(DT);   // formed up and walking
    const follower = game.guards.find((x: any) => x.leader && x.state !== 'dead');
    if (!follower) verdict(false, '(C) partner awareness', `no pair: ${game.escalationSummary()}`);
    else {
      const L = follower.leader; const R = rollcallState(game); R.nextAt = game.time + 400;   // (the scheduled check pushed right out: this is about the follower noticing, not the net)
      // the leader dies where he walks and the body is put ten metres off through walls (the storage room's far corner) — as if hauled off fast while the follower looked away
      killGuard(game, L, [1, 0, 0], true); const tKill = game.time;
      const rag = L.char.ragdoll; const hips0 = v3.copy(L.char.bones.hips ?? L.char.pos); const dest: Vec3 = [34.5, 0, 6.0];
      if (rag) { const dx = dest[0] - hips0[0], dz = dest[2] - hips0[2]; for (let i = 0; i < 16; i++) rag.nudge(i, dx, dz); }   // (all sixteen particles by the same offset: the body as it lies, elsewhere)
      L.char.update(DT);
      let tCallHim = -1, tSent = -1, tOutcome = -1; let sentWho: any = null;
      for (let f = 0; f < 60 * 200; f++) {
        W.step(DT);
        if (tCallHim < 0) { const l = lines.find(x => x.t > tKill && x.text.includes(`lost ${L.callsign}`)); if (l) tCallHim = l.t; }
        if (tSent < 0) { const c = game.guards.find((x: any) => x.state !== 'dead' && x.task?.kind === 'checkOn' && x.task.who === L); if (c) { tSent = game.time; sentWho = c; } }
        if (tOutcome < 0 && (L.found || lines.some(x => /not at his post/.test(x.text)))) tOutcome = game.time;
        if (tOutcome >= 0 && game.time > tOutcome + 2) break;
      }
      const rel = (t: number) => t >= 0 ? `+${(t - tKill).toFixed(1)} s` : 'never';
      const bodyAt = L.char.bones.hips ?? L.char.pos;
      const ok = tCallHim >= 0 && tCallHim - tKill < 40 && tSent >= 0 && tSent - tCallHim < 5 && tOutcome >= 0;
      verdict(ok, '(C) lockdown follower: his leader dead and gone ten metres through two walls while he looked away',
        `${name(L)} killed at ${tKill.toFixed(1)} s, body now at (${bodyAt[0].toFixed(1)}, ${bodyAt[2].toFixed(1)}); follower ${name(follower)} called him ${rel(tCallHim)} (want < 40 s: 20 s unseen + the walk-on), ${sentWho ? name(sentWho) : 'nobody'} sent round his route ${rel(tSent)}; outcome ${L.found ? 'body found' : tOutcome >= 0 ? "'not at his post'" : 'none'} ${rel(tOutcome)}; floor: ${game.escalationSummary()}`);
      console.log('    ' + lines.filter(l => l.t >= tKill - 0.01).slice(0, 14).map(l => `${rel(l.t).padStart(9)} ${l.who}: ${l.text}`).join('\n    '));
    }
  }
  console.log(`=== missing: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}

// ================================================================ motion acuity: the table
/** The sight-gain table off REAL displacement: a calm man held on the open cubicle aisle looking down it, deaf (this is about eyes), Sam put `dist` metres dead
 *  ahead at visibility `vis` and driven by the puppet back and forth about that spot — across the man's line of sight (tangential) or along it (radial) — at a
 *  still / creep / walk / sprint pace, so the velocity the men read is the ground he covers, not a number written into him. Per cell: the rate sightGain returns
 *  a second in (mean while in view), the seconds until 'huh?' (state suspicious) and until 'CONTACT!' (alert; the man is held, so past ~6 s of suspicion he lets it
 *  go and it reads '—'), capped at 60 s. `legacy` flips guards.ts AI_TUNE.motionAcuity off for the row (the old speed > 2 step) when the build has the switch. */
export async function motionTable(opts: { vis?: number[]; legacyToo?: boolean } = {}) {
  console.log('\n=== motion: sight gain from real displacement — rate /s · seconds to SUSPECT · seconds to ALERT (held man, calm floor, no smoke, deaf) ===');
  const TUNE = (guardsMod as any).AI_TUNE as { motionAcuity: boolean } | undefined;
  const modes: { name: string; legacy: boolean }[] = TUNE && opts.legacyToo !== false ? [{ name: 'BEFORE (speed>2 ? 1.5 : 1)', legacy: true }, { name: 'AFTER (motion acuity)', legacy: false }] : [{ name: TUNE ? 'AFTER (motion acuity)' : 'CURRENT BUILD', legacy: false }];
  const paces: { name: string; v: number; crouch: boolean; sprint: boolean }[] = [
    { name: 'still (crouched)', v: 0, crouch: true, sprint: false }, { name: 'creep 0.6 (crouched)', v: 0.6, crouch: true, sprint: false },
    { name: 'walk 1.4', v: 1.4, crouch: false, sprint: false }, { name: 'sprint 4.5', v: 4.5, crouch: false, sprint: true },
  ];
  const dists = [3, 6, 10]; const viss = opts.vis ?? [0.25, 0.5];
  // the rig: guard on the open strip north of the building at (6, 1.9) looking east (+x) down 30 m of clear ground; Sam east of him on the same line
  const G: Vec3 = [6, 0, 1.9]; const east: Vec3 = [36, 0, 1.9];
  const results: Record<string, { rate: number; tS: number; tA: number; letGo: boolean }> = {};
  for (const mode of modes) for (const vis of viss) for (const pace of paces) for (const dir of pace.v > 0 ? ['tangential', 'radial'] as const : ['—'] as const) for (const dist of dists) {
    Math.random = seeded(5);
    const W = await standUp(); const { game, input } = W;
    if (TUNE) TUNE.motionAcuity = !mode.legacy;
    game.godMode = true; game.aiEnabled = true;
    for (let i = 0; i < 5; i++) W.step(DT);
    const gd = parkOthers(game); gd.heardUpTo = 1e12;   // deaf: footsteps are the hearing model's business, this table is the eyes'
    placeGuard(gd, G, east); gd.hold = true; gd.state = 'patrol'; gd.awareness = 0; gd.lookPhase = 0;
    const S: Vec3 = [G[0] + dist, 0, G[2]];
    game.teleportPlayer(v3.copy(S)); game.player.crouch = pace.crouch; game.player.visibility = vis;
    game.player.char.bodyYaw = game.player.char.aimYaw = -Math.PI / 2;
    // oscillate about S: half-amplitude A along the chosen axis, turning about at the ends (the puppet's direction flips at once; speedSm carries the pace through)
    const A = pace.sprint ? 1.15 : 1.0; const axis: Vec3 = dir === 'radial' ? [1, 0, 0] : [0, 0, 1]; let sgn = 1;
    const walkScale = pace.v <= 0 ? 0 : pace.sprint ? pace.v / game.tune.playerSprint : pace.crouch ? pace.v / crouchPace(game) : pace.v / game.tune.playerWalk;
    game.puppet = { goal: pace.v > 0 ? v3.mad(S, axis, A) : null, aim: [G[0], 1.3, G[2]], crouch: pace.crouch, walk: walkScale };
    if (pace.sprint) input.keys.add('ShiftLeft');
    let tS = -1, tA = -1, letGo = false; let rateSum = 0, rateN = 0; const t0 = game.time; let sawSusp = false;
    for (let f = 0; f < 60 * 60 && tA < 0; f++) {
      if (pace.v > 0) { const p = game.player.char.pos; const off = (p[0] - S[0]) * axis[0] + (p[2] - S[2]) * axis[2]; if (off * sgn > A - 0.15) { sgn = -sgn; } game.puppet.goal = v3.mad(S, axis, A * sgn * 1.6); }
      game.player.visibility = vis;
      W.step(DT);
      const vis2 = guardsMod.canSee(game, gd);
      if (vis2.visible) { rateSum += sightGain(game, gd, vis2.dist); rateN++; }
      if (tS < 0 && gd.state === 'suspicious') { tS = game.time - t0; sawSusp = true; }
      if (sawSusp && gd.state === 'patrol' && tA < 0) letGo = true;
      if (tA < 0 && gd.state === 'alert') tA = game.time - t0;
    }
    input.keys.delete('ShiftLeft'); game.puppet = null;
    results[`${mode.name}|${vis}|${pace.name}|${dir}|${dist}`] = { rate: rateN ? rateSum / rateN : 0, tS, tA, letGo };
  }
  if (TUNE) TUNE.motionAcuity = true;
  const cell = (r: { rate: number; tS: number; tA: number; letGo: boolean } | undefined) => !r ? '?' : `${r.rate.toFixed(3)} · ${r.tS >= 0 ? r.tS.toFixed(1) + 's' : '—'} · ${r.tA >= 0 ? r.tA.toFixed(1) + 's' : r.letGo ? '—(let go)' : '—'}`;
  for (const vis of viss) {
    console.log(`\n--- visibility ${vis} ---`);
    for (const mode of modes) {
      console.log(`  ${mode.name}`);
      console.log('  ' + 'pace / direction'.padEnd(34) + dists.map(d => `${d} m`.padEnd(30)).join(''));
      for (const pace of paces) for (const dir of pace.v > 0 ? ['tangential', 'radial'] : ['—']) {
        console.log('  ' + `${pace.name}${dir !== '—' ? ' ' + dir : ''}`.padEnd(34) + dists.map(d => cell(results[`${mode.name}|${vis}|${pace.name}|${dir}|${d}`]).padEnd(30)).join(''));
      }
    }
  }
  console.log('\n  (cell = mean sightGain /s while in view · s to suspicious · s to alert; the man is held on his spot: a suspicion that has not become contact ~6 s after he took it up is let go, as a held man does)');
  return results;
}
