// The 'standoff' probe family (run through probes.ts: `bun run tools/qa/probes.ts standoff | standoff-see | standoff-flank | standoff-ff | standoff-end |
// standoff-lost | standoff-door | standoff-tour | standoff-discipline`): slice 3 of docs/internal/grab-interrogate-design.md — the human shield. A colleague who can see the man in Sam's arm (guards.ts
// standoffPerceive) calls it in once, the floor locks down on the call, and instead of the chase and the shot he plays the standoff (guards.ts standoffAlert): keeps
// to the ring 3.5‥7 m off the pair, works round it toward Sam's back for the flank line (guards.ts flankShot: inside 70° of the pair's rear AND the round's segment
// ≥ 0.45 m off the man's axis AND nothing solid between), talks the while, and drops it the moment the hold ends (choked out in view: found there and then and the
// rounds follow, after a beat; let go: the plain fight) or four seconds out of sight of them. With muzzle discipline (Game.tune.muzzleDiscipline, the default) the
// line found is HELD, pistol up on Sam, and never fired while the man is in the arm (discipline-probes.ts has that family); with it off, single aimed rounds go down
// it as before — standoff-flank runs both. A colleague's round meets whichever body it reaches first (combat.ts fireWeapon): from in front, the man in the arm. Each
// stands the full game up headless (headless.ts), stages one situation, drives Sam's side through the real hold (startGrab, the cursor for the pair's facing, Space
// on the held row), PASS / FAIL.
import { standUp, ROOT } from './headless.ts';
const IK = 'Space';
const { v3, wrapAngle, DEG } = await import(`${ROOT}/src/math/vec.ts`);
const { fireWeapon } = await import(`${ROOT}/src/game/combat.ts`);
const { startGrab } = await import(`${ROOT}/src/game/player.ts`);
const guardsMod = await import(`${ROOT}/src/game/guards.ts`);
const { pairOf, flankShot, standoffSummary, escalationOf, colleagueInLine, STANDOFF_DEBUG } = guardsMod;
const VERBOSE = process.argv.includes('--verbose');
/** Freeze the pair's facing: the camera swung round BEHIND Sam on `deg` (so the cursor's ray comes down over his own shoulders, through nobody else) and the puppet's
 *  aim put at his own feet — updateHold turns the pair toward the cursor only when it lies more than 0.6 m off him, so it does not turn at all. Call once; the
 *  aim object is refreshed in place by keepFrozen each frame (Sam does not move under a goal-less puppet, but a shove would carry the point with him). */
export function freezeFacing(W: any, game: any, deg: number) { W.cam.yaw = deg * DEG + Math.PI; W.cam.rebuild(); const s = game.player.char.pos; game.puppet = { goal: null, aim: [s[0], 0.02, s[2]] }; }
function keepFrozen(game: any) { const P = game.puppet; if (!P?.aim) return; const s = game.player.char.pos; P.aim[0] = s[0]; P.aim[1] = 0.02; P.aim[2] = s[2]; }

type Vec3 = [number, number, number];
const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f1 = (x: number) => x.toFixed(1), f2 = (x: number) => x.toFixed(2);
const posS = (p: Vec3) => `(${f1(p[0])}, ${f1(p[2])})`;
/** plant a living man at `p` facing `yaw`, still, no path, posed twice (bones, muzzle) */
export function place(gd: any, p: Vec3, yaw: number) { gd.char.pos = v3.copy(p); gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.char.bodyYaw = gd.char.aimYaw = yaw; gd.char.aimPitch = 0; gd.path = []; gd.pathGoal = null; gd.hold = false; gd.pinned = false; gd.char.update(0); gd.char.update(DT); }
/** out of it: on the lot east of the building, held + pinned + blind + deaf (the doorway probes' parking) — the hostage call may take him to 'alert' on his mark and no further */
export function park(gd: any, i: number) { gd.hold = true; gd.pinned = true; gd.dazzledUntil = 1e9; gd.heardUpTo = 1e12; gd.char.pos = [37.5, 0, 6 + i * 1.5]; gd.char.vel = [0, 0, 0]; gd.path = []; gd.pathGoal = null; gd.char.update(0); }
export function tap(game: any) {
  const lines: { t: number; who: string; text: string; radio: boolean }[] = []; const msgs: { t: number; text: string }[] = [];
  const gsay = game.say.bind(game);
  game.say = (gd: any, text: string, radio = false) => { const r = gsay(gd, text, radio); if (gd.bubble && gd.bubble.text === text && gd.bubble.t === game.time) lines.push({ t: game.time, who: gd.callsign, text, radio }); return r; };
  const origMsg = game.msg.bind(game); game.msg = (text: string) => { msgs.push({ t: game.time, text }); return origMsg(text); };
  return { lines, msgs };
}
export const bearingPoint = (C: Vec3, deg: number, r: number): Vec3 => [C[0] + Math.sin(deg * DEG) * r, 0, C[2] + Math.cos(deg * DEG) * r];
/** the held man's clearance (m) off the segment a round from `gd`'s muzzle to Sam's near side would fly — worked here from scratch (the fire rule's own measure is
 *  guards.ts axisToSegment off the gun shoulder; the two differ by the hand's offset, a centimetre or so at the far end) */
export function roundClearance(game: any, gd: any): number {
  const P = pairOf(game); if (!P) return Infinity;
  const from = gd.char.muzzle as Vec3; const to = P.aim as Vec3;
  const d = v3.sub(to, from); const L = v3.len(d); const imp = L > 0.33 ? v3.mad(from, d, (L - 0.28) / L) : to;
  const dx = imp[0] - from[0], dz = imp[2] - from[2]; const L2 = dx * dx + dz * dz;
  const h = P.held.char.bones.hips ?? P.held.char.pos; const t = L2 > 1e-6 ? Math.max(0, Math.min(1, ((h[0] - from[0]) * dx + (h[2] - from[2]) * dz) / L2)) : 0;
  return Math.hypot(from[0] + dx * t - h[0], from[2] + dz * t - h[2]);
}
/** degrees off the pair's rear this man stands (0 = dead astern, 180 = square in front: the held man between) */
export function rearDeg(game: any, gd: any): number { const P = pairOf(game); if (!P) return NaN; const brg = Math.atan2(gd.char.pos[0] - P.sam[0], gd.char.pos[2] - P.sam[2]); return Math.abs(wrapAngle(brg - (P.facing + Math.PI))) / DEG; }

/** The shared staging: the level up, god mode, Sam dark (0.02 — the standoff never asks the meter), `victimI` planted at `at` facing `yaw` (held on the spot for the
 *  frame before the grab, so he does not turn for his route) and grabbed from 0.8 m behind (startGrab, stepped until the hold proper is on), everybody else parked
 *  unless the caller places them after; `freeze`: the pair's facing pinned on `yaw` from the grab on (freezeFacing) — else the caller steers with the cursor;
 *  `gun`: the Five-seveN DRAWN at the grab (the gun variant: pistol to his head, a click fires past him, HOLD Space the whip) — else holstered (the arm and its choke).
 *  Returns the world, the taps, and the pair's facing in degrees as it actually stands. */
/** what the pair's light meter reads in these stagings once the hold is on (ordinary corridor light) — see the note in stageHold */
export const STANDOFF_LIT = 0.6;
export async function stageHold(seed: number, victimI: number, at: Vec3, yaw: number, freeze = true, gun = false) {
  Math.random = seeded(seed);
  const W = await standUp(); const { game } = W;
  { const step0 = W.step.bind(W); W.step = (dt: number, follow?: Vec3 | null) => { keepFrozen(game); step0(dt, follow); }; }   // (a frozen facing's aim point rides with Sam)
  game.godMode = true; game.player.visibility = 0.02;
  for (let i = 0; i < 5; i++) W.step(DT);
  const victim = game.guards[victimI]; const others = game.guards.filter((x: any) => x !== victim);
  others.forEach((o: any) => park(o, game.guards.indexOf(o)));
  place(victim, at, yaw); victim.wp = 1; victim.hold = true;
  const behind: Vec3 = [at[0] - Math.sin(yaw) * 0.8, 0, at[2] - Math.cos(yaw) * 0.8];
  game.teleportPlayer(behind); game.player.crouch = true; game.player.slot = 'pistol'; game.player.holstered = !gun; W.step(DT); game.player.visibility = 0.02; victim.hold = false;   // (holstered unless asked: most of these are about the ARM hold and its choke — drawn makes it the gun variant and HOLD Space a whip)
  const taps = tap(game);
  startGrab(game, victim);
  if (freeze) freezeFacing(W, game, yaw / DEG); else { W.cam.yaw = yaw + Math.PI; W.cam.rebuild(); }
  for (let i = 0; i < 60 && game.player.holding?.phase !== 'held'; i++) { if (!freeze) W.cursorAt([at[0] + Math.sin(yaw) * 3, 0, at[2] + Math.cos(yaw) * 3]); W.step(DT); }
  // the man is HELD: from here the scenario these probes mean is 'colleagues confront a hostage-taker they can SEE' — the pair stands in ordinary corridor light (0.6).
  // (Since 08-11 a watcher acquires the pair through the light meter like anything else: pinned at the sneak-up 0.02 nobody beyond arm's reach would ever enter
  // the standoff — the maintainer's 'seen holding a man completely in the dark' bug was this file's old premise.) The headless world has no GPU meter, so hold it there each frame.
  game.player.visibility = STANDOFF_LIT; { const step1 = W.step.bind(W); W.step = (dt: number, follow?: Vec3 | null) => { if (game.player.holding) game.player.visibility = (game as any).__probeVis ?? STANDOFF_LIT; step1(dt, follow); }; }
  for (let i = 0; i < 10; i++) { if (!freeze) W.cursorAt([at[0] + Math.sin(yaw) * 3, 0, at[2] + Math.cos(yaw) * 3]); W.step(DT); }
  const P = pairOf(game); const faceDeg = P ? P.facing / DEG : yaw / DEG;
  return { W, game, victim, others, faceDeg, ...taps };
}
/** un-park a man onto a spot facing a point, calm and hearing again from now */
export function bringIn(game: any, gd: any, p: Vec3, face: Vec3, state: 'patrol' | 'suspicious' = 'patrol', fix: Vec3 | null = null) {
  gd.dazzledUntil = -1; gd.heardUpTo = game.eventSeq; place(gd, p, Math.atan2(face[0] - p[0], face[2] - p[2]));
  gd.state = state; gd.awareness = state === 'suspicious' ? 0.5 : 0; gd.lastKnown = fix ? v3.copy(fix) : null; gd.reactT = 0; gd.searchT = 0; gd.lastSeenT = -100; gd.sightT = -100;
}
/** per-frame track of one observer through a run */
export interface Track { enterT: number; firstLineT: number; shots: { t: number; clear: number; rear: number; ok: boolean; dist: number }[]; minDist: number; maxDistAfter: number; poseBad: number; poseAim: number; poseLow: number; frames: number; lostStandoff: number; }
export const newTrack = (): Track => ({ enterT: -1, firstLineT: -1, shots: [], minDist: Infinity, maxDistAfter: 0, poseBad: 0, poseAim: 0, poseLow: 0, frames: 0, lostStandoff: 0 });

// ================================================================ (1) a colleague walks in on the hold: he sees it, calls it once, the floor locks down ('hostage'), he comes to the ring and stands — no round while the man covers Sam, however Sam turns
export async function standoffSee() {
  console.log('\n=== standoff-see: Novak walks up the corridor onto Kowalski held — sawHeld, one call, lockdown by \'hostage\', the ring [3.5, 7] m, weapon up, and not one round in 15 s of Sam keeping the shield on him ===');
  let allPass = true;
  const S = await stageHold(301, 0, [14, 0, 11.2], Math.PI / 2, false); const { W, game, victim, lines, msgs } = S;
  const B = game.guards[1], C = game.guards[2];
  bringIn(game, B, [31.5, 0, 11.4], [14, 0, 11.2], 'suspicious', [19, 0, 11.2]);   // a noise up the corridor: he walks west into it and onto them
  const esc0 = game.escalation; const t0 = game.time;
  const T = newTrack(); const log: string[] = []; let escAt = -1; let exc = '';
  let hits = 0, prevHit = game.player.hitFlash;
  try {
    for (let f = 0; f < 60 * 22; f++) {
      W.cursorAt(v3.add(B.char.pos, [0, 1.2, 0]));   // Sam keeps turning the pair to hold the man square toward Novak
      W.step(DT);
      const t = game.time; const P = pairOf(game);
      if (game.player.hitFlash > prevHit + 1e-9) hits++; prevHit = game.player.hitFlash;
      if (!P) { log.push(`${f2(t)}s the hold ENDED (victim ${victim.state}, holding ${!!game.player.holding})`); break; }
      const dist = v3.distXZ(B.char.pos, P.centre);
      if (B.standoff && T.enterT < 0) T.enterT = t;
      if (T.enterT >= 0 && !B.standoff) T.lostStandoff++;
      if (escAt < 0 && game.escalation === 2) escAt = t;
      for (const e of game.events) if (e.kind === 'guardShot' && e.time === t) T.shots.push({ t, clear: roundClearance(game, B), rear: rearDeg(game, B), ok: flankShot(game, B, P).ok, dist });
      if (T.enterT >= 0) {
        T.frames++; T.minDist = Math.min(T.minDist, dist); if (t - T.enterT > 9) T.maxDistAfter = Math.max(T.maxDistAfter, dist);
        const an = B.char.anim; if (B.reactT <= 0) { if (an.upper === 'aim') T.poseAim++; else if (B.muzzleDown && an.stance === 'lowReady') T.poseLow++; else T.poseBad++; }
      }
      if (f % 60 === 0) log.push(`${f2(t)}s Novak ${B.state}${B.standoff ? '/standoff' : ''} at ${posS(B.char.pos)} ${f1(dist)} m, ${Math.round(rearDeg(game, B))}° off their rear, spd ${f2(B.speed)}, ${B.char.anim.upper}/${B.char.anim.stance}${B.muzzleDown ? ' (muzzle down)' : ''} · esc ${game.escalation} · ${standoffSummary(game) || '—'}`);
      if (T.enterT >= 0 && t - T.enterT > 15) break;
    }
  } catch (e: any) { exc = String(e?.stack ?? e); }
  const call = lines.filter(l => l.radio && /he's got Kowalski/.test(l.text));
  const order = lines.find(l => l.radio && /one of ours/.test(l.text));
  const barks = lines.filter(l => l.who === B.callsign && !l.radio && l.t >= (T.enterT < 0 ? 0 : T.enterT));
  const fails: string[] = [];
  if (exc) fails.push('exception: ' + exc.split('\n')[0]);
  if (T.enterT < 0) fails.push('Novak never entered the standoff');
  if (!B.witness.sawHeld || B.witness.sawHeld.who !== 'Kowalski') fails.push(`witness.sawHeld ${JSON.stringify(B.witness.sawHeld)} (want who Kowalski)`);
  if (B.witness.alertedBy !== 'sight') fails.push(`alertedBy ${B.witness.alertedBy} (want sight)`);
  if (B.state !== 'alert') fails.push(`Novak is ${B.state} (want alert)`);
  if (call.length !== 1) fails.push(`the call went out ${call.length}× (want exactly once): ${call.map(l => l.text).join(' | ')}`);
  if (esc0 !== 0 || game.escalation !== 2 || escAt < 0 || Math.abs(escAt - T.enterT) > DT + 1e-6) fails.push(`escalation ${esc0} → ${game.escalation}, at ${escAt < 0 ? 'never' : f2(escAt)} vs entry ${f2(T.enterT)} (want 0 → 2 the frame he saw it)`);
  if (!order) fails.push(`nobody gave the hostage lockdown order (radio lines: ${lines.filter(l => l.radio).map(l => `${l.who}: ${l.text}`).join(' | ')})`);
  if (T.shots.length) fails.push(`Novak fired ${T.shots.length} round(s) with Kowalski square between: ${T.shots.map(s => `${f2(s.t)}s clear ${f2(s.clear)} rear ${Math.round(s.rear)}°`).join(', ')}`);
  if (hits) fails.push(`Sam was hit ${hits}×`);
  if (!(T.maxDistAfter > 0) || T.maxDistAfter > 7.0 || T.minDist < 3.2) fails.push(`distance to the pair: min ${f2(T.minDist)}, max after settling ${f2(T.maxDistAfter)} (want ≥ 3.2 always, ≤ 7 once he has come over)`);
  if (T.poseBad > 2) fails.push(`posed neither aiming nor at the low ready for the man in his line on ${T.poseBad} frames (aim ${T.poseAim}, lowReady ${T.poseLow})`);
  if (T.lostStandoff > 0) fails.push(`the standoff record dropped on ${T.lostStandoff} frame(s) with the pair in plain view`);
  if (!barks.length) fails.push('he said nothing to Sam in 15 s');
  if (victim.state !== 'alert' && victim.state !== 'patrol' && victim.state !== 'suspicious') fails.push(`victim ${victim.state}`);
  if (C.standoff) fails.push('the parked man (blind, on the lot) carries a standoff record');
  const ok = fails.length === 0; allPass &&= ok;
  console.log(`- ${ok ? 'PASS' : 'FAIL'} — entered at ${T.enterT >= 0 ? f2(T.enterT - t0) + ' s after the grab' : 'never'}; call: "${call[0]?.text ?? '—'}"; order: "${order ? order.who + ': ' + order.text : '—'}"; esc ${esc0}→${game.escalation}; dist min ${f2(T.minDist)} / max after 9 s ${f2(T.maxDistAfter)}; rounds ${T.shots.length}; pose aim ${T.poseAim} · lowReady-for-him ${T.poseLow} · other ${T.poseBad} of ${T.frames}; Sam hit ${hits}×\n    Novak's lines: ${barks.map(l => `${f1(l.t - T.enterT)}s "${l.text}"`).join(' · ') || '—'}\n    ${log.join('\n    ')}\n    log tail: ${msgs.slice(-6).map(m => m.text).join(' | ')}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
  console.log(`=== standoff-see: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}

// ================================================================ (2) the flank: Sam's facing frozen in the break room; one man works round the ring to Sam's back — with muzzle discipline (the default) he plants on the line
// with the pistol UP on Sam and never fires it; with it off (Game.tune.muzzleDiscipline = false, the rule before) he fires single rounds only down the flank line; two men take opposite ways round either way
export async function standoffFlank() {
  console.log('\n=== standoff-flank: the pair planted in the break room facing WNW, Sam not turning — the observer(s) circle to his back inside ~8 s; discipline ON: the line held, gun up on Sam, NOT ONE round; discipline OFF: single rounds only when flankShot holds, every one ≥ 0.45 m off Novak\'s axis, ≥ 1.2 s apart; two men split ===');
  let allPass = true;
  const FACE = 190;   // the pair faces bearing 190° (toward the corridor wall, a shade west): the ring is open from their front all the way round the west side to dead astern; the counter and the east wall shut the other way at once
  for (const discipline of [true, false]) for (const two of [false, true]) {
    const S = await stageHold((two ? 322 : 321) + (discipline ? 2 : 0), 1, [33.0, 0, 17.8], FACE * DEG); const { W, game, victim, lines, faceDeg } = S;   // (frozen on FACE from the grab on: Sam stands and keeps facing there whatever they do)
    game.tune.muzzleDiscipline = discipline;
    const A = game.guards[0], C = game.guards[2];
    const P0 = pairOf(game)!; const centre = v3.copy(P0.centre);
    bringIn(game, A, bearingPoint(centre, faceDeg + 15, 4.6), centre);          // Kowalski just left of square in front of them (as they look), 4.6 m off
    if (two) bringIn(game, C, bearingPoint(centre, faceDeg - 25, 4.8), centre);   // Reyes to their front-right
    const men = two ? [A, C] : [A]; const tracks = new Map<any, Track & { lineFrames: number; aimOnLine: number; inLineT: number; prevOk: boolean }>(men.map(m => [m, { ...newTrack(), lineFrames: 0, aimOnLine: 0, inLineT: -100, prevOk: false }]));
    const log: string[] = []; let exc = ''; let hits = 0, prevHit = game.player.hitFlash; const t0 = game.time; let facingDrift = 0; const dbg: string[] = [];
    try {
      for (let f = 0; f < 60 * 16; f++) {
        STANDOFF_DEBUG.log = VERBOSE || (game.time - t0 > 6.5 && game.time - t0 < 10.5) ? (s: string) => dbg.push(`${f2(game.time - t0)}s ${s}`) : null;
        W.step(DT);
        const t = game.time; const P = pairOf(game);
        if (game.player.hitFlash > prevHit + 1e-9) hits++; prevHit = game.player.hitFlash;
        if (!P) { log.push(`${f2(t - t0)}s the hold ENDED (victim ${victim.state}/${victim.downKind ?? '-'}/${victim.downBy ?? '-'})`); break; }
        facingDrift = Math.max(facingDrift, Math.abs(wrapAngle(P.facing - FACE * DEG)));
        const shotsNow = game.events.filter((e: any) => e.kind === 'guardShot' && e.time === t);
        for (const m of men) {
          const T = tracks.get(m)!; const dist = v3.distXZ(m.char.pos, P.centre); const fs = flankShot(game, m, P);
          if (m.standoff && T.enterT < 0) T.enterT = t; if (T.enterT >= 0 && !m.standoff) T.lostStandoff++;
          if (fs.ok && T.firstLineT < 0) T.firstLineT = t;
          if (colleagueInLine(game, m, P.aim, P.held) || (fs.ok && !T.prevOk)) T.inLineT = t; T.prevOk = fs.ok;
          if (fs.ok && t - T.inLineT > 0.25 && m.reactT <= 0) { T.lineFrames++; if (m.char.anim.upper === 'aim' && !m.muzzleDown) T.aimOnLine++; }   // the line his (after his beat, and open a quarter second) and no OTHER colleague in it now or a quarter second ago (two men can bunch behind the pair: then the low ready is right; and a gun lowered for a man in the line takes 0.2 s to come back up), is the pistol UP and on Sam — not lowered?
          if (T.enterT >= 0) { T.frames++; T.minDist = Math.min(T.minDist, dist); }
          for (const e of shotsNow) if (v3.distXZ(e.pos, m.char.pos) < 0.05) T.shots.push({ t, clear: roundClearance(game, m), rear: rearDeg(game, m), ok: fs.ok, dist });
        }
        if (f % 60 === 0) log.push(`${f2(t - t0)}s ${standoffSummary(game) || men.map(m => `${m.callsign} ${m.state} ${f1(v3.distXZ(m.char.pos, P.centre))} m`).join(' | ')}${discipline ? ' · ' + men.map(m => `${m.callsign} ${m.char.anim.upper}/${m.char.anim.stance}${m.muzzleDown ? '(down)' : ''} fireCd ${f2(m.fireCd)}`).join(' ') : ''}`);
      }
    } catch (e: any) { exc = String(e?.stack ?? e); }
    game.puppet = null; STANDOFF_DEBUG.log = null;
    const fails: string[] = [];
    if (exc) fails.push('exception: ' + exc.split('\n')[0]);
    if (facingDrift > 0.1 || Math.abs(wrapAngle((faceDeg - FACE) * DEG)) > 0.1) fails.push(`staging: the pair's facing ${f1(faceDeg)}° drifted ${f2(facingDrift)} rad (want ${FACE}° held)`);
    if (victim.state === 'dead') fails.push(`Novak died in the arm: ${victim.downKind}/${victim.downBy}`);
    let anyFired = false, anyLine = false;
    for (const m of men) {
      const T = tracks.get(m)!; const name = m.callsign;
      if (T.enterT < 0) { fails.push(`${name} never entered the standoff`); continue; }
      if (T.lostStandoff) fails.push(`${name}'s standoff dropped on ${T.lostStandoff} frame(s) with them in view`);
      if (T.minDist < 3.1) fails.push(`${name} came within ${f2(T.minDist)} m of the pair`);
      if (T.firstLineT >= 0) anyLine = true;
      if (discipline) {   // the shield up the whole 16 s: not one round, whatever the line — and the line his, the pistol is UP on Sam (the point of it), not lowered and not put away
        if (T.shots.length) fails.push(`${name} FIRED ${T.shots.length} round(s) with Novak alive in the arm and muzzle discipline on: ${T.shots.map(s => `${f2(s.t - t0)}s ${Math.round(s.rear)}° clear ${f2(s.clear)}${s.ok ? ' (flank line)' : ''}`).join(', ')}`);
        if (T.lineFrames >= 30 && T.aimOnLine < 0.9 * T.lineFrames) fails.push(`${name} held the flank line ${f1(T.lineFrames * DT)} s but had the pistol up on Sam for only ${f1(T.aimOnLine * DT)} s of it (want ≥ 90 %: point, don't fire)`);
        if (m.fireCd < 0.35 - 1e-6) fails.push(`${name}'s fireCd ${f2(m.fireCd)} at the end (want ≥ 0.35 kept in hand for when the shield goes)`);
      } else {
        const bad = T.shots.filter(s => !s.ok); if (bad.length) fails.push(`${name} fired ${bad.length} round(s) WITHOUT the flank line: ${bad.map(s => `${f2(s.t - t0)}s ${Math.round(s.rear)}° clear ${f2(s.clear)} ${f1(s.dist)} m`).join(', ')}`);
        const close = T.shots.filter(s => s.clear < 0.45 - 0.02); if (close.length) fails.push(`${name}: ${close.length} round(s) passed nearer than 0.45 m to Novak's axis: ${close.map(s => f2(s.clear)).join(', ')}`);
        for (let i = 1; i < T.shots.length; i++) if (T.shots[i].t - T.shots[i - 1].t < 1.2 - 1e-6) fails.push(`${name}: rounds ${f2(T.shots[i - 1].t - t0)} s and ${f2(T.shots[i].t - t0)} s only ${f2(T.shots[i].t - T.shots[i - 1].t)} s apart (cadence ≥ 1.2 s)`);
      }
      if (T.shots.length) anyFired = true;
    }
    if (!two) {
      const T = tracks.get(A)!;
      if (T.firstLineT < 0 || T.firstLineT - T.enterT > 9) fails.push(`Kowalski's flank line opened ${T.firstLineT < 0 ? 'never' : f2(T.firstLineT - T.enterT) + ' s after entering'} (want within ~8 s)`);
      if (discipline) { if (T.lineFrames * DT < 3) fails.push(`Kowalski held a clean line for only ${f1(T.lineFrames * DT)} s of 16 (want ≥ 3 s planted on it)`); if (!lines.some(l => l.who === A.callsign && !l.radio && l.t > t0 && /have him|got him|got a line|there you are/.test(l.text))) fails.push('no \'I have him\' from Kowalski with the line his'); }
      else if (!T.shots.length) fails.push('Kowalski never fired from the flank (discipline off: the old rule should)');
      if ((A.standoff?.orbitM ?? 0) < 2 && T.firstLineT < 0) fails.push(`he walked only ${f2(A.standoff?.orbitM ?? 0)} m`);
    } else {
      const sa = A.standoff?.side, sc = C.standoff?.side;
      if (!(sa && sc && sa === -sc)) fails.push(`sides dealt: Kowalski ${sa}, Reyes ${sc} (want opposite)`);
      if (!anyLine) fails.push('neither man ever got round to a line in 16 s');
      if (!discipline && !anyFired) fails.push('neither man ever fired in 16 s (discipline off)');
    }
    if (hits && discipline) fails.push(`Sam was hit ${hits}× with the discipline on`);
    const ok = fails.length === 0; allPass &&= ok;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — discipline ${discipline ? 'ON ' : 'OFF'} · ${two ? 'TWO men (Kowalski front-right, Reyes front-left)' : 'ONE man (Kowalski, front-right)'}: ${men.map(m => { const T = tracks.get(m)!; return `${m.callsign} side ${m.standoff?.side ?? '?'} entered +${T.enterT >= 0 ? f2(T.enterT - t0) : '—'} s, line +${T.firstLineT >= 0 ? f2(T.firstLineT - T.enterT) : '—'} s after (held ${f1(T.lineFrames * DT)} s, gun up on Sam ${f1(T.aimOnLine * DT)} s of it), ${T.shots.length} rounds [${T.shots.map(s => `${f1(s.t - t0)}s ${Math.round(s.rear)}° clear ${f2(s.clear)}`).join('; ')}], min dist ${f2(T.minDist)}, walked ${f2(m.standoff?.orbitM ?? NaN)} m, fireCd ${f2(m.fireCd)}`; }).join(' · ')}; Sam hit ${hits}× (god mode); Novak ${victim.state}; facing drift ${f2(facingDrift)}\n    lines: ${lines.filter(l => l.t > t0).map(l => `${f1(l.t - t0)}s ${l.who}${l.radio ? ' (radio)' : ''}: "${l.text}"`).join(' · ') || '—'}\n    ${log.join('\n    ')}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}${!ok || VERBOSE ? '\n    orbit plans:\n      ' + dbg.filter(s => /TAKEN|nothing|plant|out of plans/.test(s) || VERBOSE).slice(0, 60).join('\n      ') : ''}`);
  }
  console.log(`=== standoff-flank: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}

// ================================================================ (3) friendly fire, forced: a round from square in front must cross Novak — he dies 'shot'/'guard', Sam untouched, the shooter says so, the hold drops by the 'man died in the arm' path, nothing throws; and from dead astern forty rounds find Sam and never him
export async function standoffFF() {
  console.log('\n=== standoff-ff: a colleague\'s round from square in front of the pair (forced — the AI never fires it) goes into the man in the arm: shot/guard, Sam unhurt (god mode OFF), "…I hit him", the hold drops, no exception; from dead astern rounds stop in Sam ===');
  let allPass = true;
  // (a) from the front, one forced round
  {
    const S = await stageHold(331, 1, [33.0, 0, 17.8], 190 * DEG); const { W, game, victim, lines, msgs, faceDeg } = S;
    const A = game.guards[0]; const P0 = pairOf(game)!;
    bringIn(game, A, bearingPoint(P0.centre, faceDeg, 4.2), P0.centre);   // square in front, on the ring
    for (let i = 0; i < 45; i++) W.step(DT);   // he sees it, calls it, comes up to aim (his CONTACT beat)
    const inStandoff = !!A.standoff; const escBefore = game.escalation; const raisedBefore = game.alarm.raisedAt; const linesBefore = lines.length;
    game.godMode = false; const hitsLeft0 = game.player.hitsLeft;
    const P = pairOf(game)!; const fsBefore = flankShot(game, A, P);
    A.char.anim.upper = 'aim'; A.char.aimYaw = Math.atan2(P.aim[0] - A.char.pos[0], P.aim[2] - A.char.pos[2]); A.char.aimPitch = 0; A.char.update(0); A.char.update(DT);   // gun up and on them (the AI has it at the low ready for exactly this reason)
    let exc = ''; const seedSave = Math.random; Math.random = seeded(7);   // (the spread's dice)
    try { fireWeapon(game, A.char, P.aim, false); } catch (e: any) { exc = String(e?.stack ?? e); }
    Math.random = seedSave;
    const deadNow = victim.state === 'dead'; const holdingSameFrame = !!game.player.holding;
    const samAfterShot = { down: game.player.down, hits: game.player.hitsLeft, flash: game.player.hitFlash }; const shotEvent = game.events.some((e: any) => e.kind === 'guardShot' && e.time === game.time);
    game.godMode = true;   // (what follows is the plain fight: the shield is gone and Kowalski will shoot Sam — that is (4)'s business, not this round's)
    try { for (let i = 0; i < 3; i++) W.step(DT); } catch (e: any) { exc ||= String(e?.stack ?? e); }
    const bark = lines.slice(linesBefore).find(l => l.who === A.callsign && /I hit him/.test(l.text));
    const raiseLine = lines.slice(linesBefore).find(l => l.radio && /lock it down|stays locked down|man down/.test(l.text));
    let exc2 = ''; try { for (let i = 0; i < 120; i++) W.step(DT); } catch (e: any) { exc2 = String(e?.stack ?? e); }
    game.puppet = null;
    const fails: string[] = [];
    if (!inStandoff) fails.push('staging: Kowalski was not in the standoff before the shot');
    if (fsBefore.ok) fails.push(`staging: flankShot said OK from square in front (rear ${Math.round(fsBefore.rear / DEG)}°, clear ${f2(fsBefore.clear)})`);
    if (exc || exc2) fails.push('exception: ' + (exc || exc2).split('\n')[0]);
    if (!deadNow || victim.downKind !== 'shot' || victim.downBy !== 'guard') fails.push(`Novak ${victim.state}/${victim.downKind}/${victim.downBy} (want dead/shot/guard on the frame)`);
    if (samAfterShot.down || samAfterShot.hits !== hitsLeft0 || samAfterShot.flash > 0.5) fails.push(`Sam took that round: down ${samAfterShot.down}, hits ${hitsLeft0} → ${samAfterShot.hits}, hitFlash ${f2(samAfterShot.flash)}`);
    if (!bark) fails.push(`no friendly-fire line from Kowalski (his lines: ${lines.slice(linesBefore).filter(l => l.who === A.callsign).map(l => l.text).join(' | ') || 'none'})`);
    if (!holdingSameFrame) fails.push('the hold vanished inside fireWeapon (want: dropped by updateHold next frame, the existing path)');
    if (game.player.holding || victim.held || game.player.char.anim.holdPose || victim.char.anim.heldPose) fails.push(`hold residue after 3 frames: holding ${!!game.player.holding} held ${!!victim.held} holdPose ${!!game.player.char.anim.holdPose} heldPose ${!!victim.char.anim.heldPose}`);
    if (game.escalation !== escBefore || raiseLine) fails.push(`the shot itself moved the alarm: ${escBefore} → ${game.escalation}${raiseLine ? `, "${raiseLine.text}"` : ''} (raisedAt ${f2(raisedBefore)} → ${f2(game.alarm.raisedAt)})`);
    if (game.mission.stats.kills !== 0) fails.push(`counted on Sam's card: kills ${game.mission.stats.kills}`);
    if (!victim.found) fails.push('the man who watched him drop did not count him found');
    if (A.standoff) fails.push('Kowalski still carries the standoff with the man dead');
    if (!shotEvent) fails.push('no guardShot event went out with the round');
    const ok = fails.length === 0; allPass &&= ok;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — (a) forced round from ${Math.round(fsBefore.rear / DEG)}° off their rear (clear ${f2(fsBefore.clear)}, flankShot ${fsBefore.ok}): Novak ${victim.state}/${victim.downKind}/${victim.downBy}, found ${victim.found}; Sam on that round: down ${samAfterShot.down} hits ${hitsLeft0}→${samAfterShot.hits} (god mode off); bark "${bark?.text ?? '—'}"; esc ${escBefore}→${game.escalation}; Kowalski now ${A.state}${A.standoff ? '/standoff' : ''}\n    log: ${msgs.slice(-5).map(m => m.text).join(' | ')}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
  }
  // (b) from dead astern, forty rounds (seeded spread): every one stops in Sam (god mode), none in Novak; from square in front, forty into a fresh pair each… no — one is enough (above); here the count from behind and from the 70° line
  {
    for (const [label, offRear] of [['dead astern', 0], ['60° off their rear (inside the fire rule)', 60], ['80° (just outside it)', 80], ['square on the flank, 90°', 90]] as [string, number][]) {
      const S = await stageHold(332 + offRear, 1, [33.0, 0, 17.8], 190 * DEG); const { W, game, victim, faceDeg } = S;
      const A = game.guards[0]; const P0 = pairOf(game)!;
      const spot = bearingPoint(P0.sam, faceDeg + 180 - offRear, 4.5);   // (round the WEST side of them: the east is counter and wall)
      bringIn(game, A, spot, P0.centre); A.hold = true; A.pinned = true;   // (planted: this is about the rounds, not his feet)
      for (let i = 0; i < 40; i++) W.step(DT);
      const P = pairOf(game)!; place(A, spot, Math.atan2(P.aim[0] - spot[0], P.aim[2] - spot[2])); A.char.anim.upper = 'aim'; A.char.update(0); A.char.update(DT);
      const fs = flankShot(game, A, P); const clear = roundClearance(game, A);
      let samHits = 0, heldDead = false, exc = ''; const seedSave = Math.random; Math.random = seeded(99);
      try { for (let i = 0; i < 40 && !heldDead; i++) { const hf = game.player.hitFlash; fireWeapon(game, A.char, P.aim, false); if (game.player.hitFlash > hf + 1e-9 || game.player.hitFlash === 1) samHits++; game.player.hitFlash = 0; heldDead = victim.state === 'dead'; } } catch (e: any) { exc = String(e?.stack ?? e); }
      Math.random = seedSave; game.puppet = null;
      const fails: string[] = [];
      if (exc) fails.push('exception: ' + exc.split('\n')[0]);
      if (offRear < 70) { if (heldDead) fails.push(`Novak was hit from ${label}`); if (samHits < 40) fails.push(`only ${samHits}/40 rounds found Sam from ${label}`); if (!fs.ok) fails.push(`flankShot refused the line from ${label} (rear ${Math.round(fs.rear / DEG)}°, clear ${f2(fs.clear)}, dist ${f1(fs.dist)})`); }
      else { if (fs.ok) fails.push(`flankShot ALLOWED the line from ${label} (rear ${Math.round(fs.rear / DEG)}°, clear ${f2(fs.clear)})`); }
      const ok = fails.length === 0; allPass &&= ok;
      console.log(`- ${ok ? 'PASS' : 'FAIL'} — (b) from ${label}, 4.5 m: flankShot ${fs.ok} (rear ${Math.round(fs.rear / DEG)}°, clear ${f2(fs.clear)} m by the shoulder line / ${f2(clear)} by the muzzle); 40 rounds → Sam ${samHits}, Novak ${heldDead ? 'HIT (dead)' : 'untouched'}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
    }
  }
  console.log(`=== standoff-ff: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}

// ================================================================ (4) how it ends: choked out in front of them → rounds within a second of the shield dropping, the body found there and then; let go → the plain fight, and the freed man is not shot by his friends
export async function standoffEnd() {
  console.log('\n=== standoff-end: (a) Sam chokes Novak out with Kowalski square in front — he fires within 1 s of the man dropping, and counts him found; (b) Sam lets him go — everyone plain alert, the freed man alive 4 s on ===');
  let allPass = true;
  for (const how of ['choke'] as const) for (const vis of [0.7, 0.02]) {   // (the E shove is gone: a hold ends in front of them by the choke — or by Sam going down, which standoff-ff covers)
    const S = await stageHold(how === 'choke' ? 341 : 345, 1, [33.0, 0, 17.8], 190 * DEG, false); const { W, game, victim, lines, msgs, faceDeg } = S;
    const A = game.guards[0]; const P0 = pairOf(game)!;
    bringIn(game, A, bearingPoint(P0.centre, faceDeg, 4.6), P0.centre);   // square in front on the ring: no line, and none coming (Sam keeps the man on him)
    game.player.visibility = vis; (game as any).__probeVis = vis;
    const t0 = game.time; let endT = -1, firstShotT = -1, foundT = -1, standoffGoneT = -1; let shotsBefore = 0; let exc = ''; const log: string[] = [];
    let freedDead = false; let hits = 0, prevHit = game.player.hitFlash; let victimAlertT = -1; let everStandoff = false;
    try {
      // 3 s of standoff first (he settles, talks), Sam holding the shield on him
      for (let f = 0; f < 60 * 3; f++) { W.cursorAt(v3.add(A.char.pos, [0, 1.2, 0])); W.step(DT); everStandoff ||= !!A.standoff; for (const e of game.events) if (e.kind === 'guardShot' && e.time === game.time) shotsBefore++; }
      if (game.hover?.kind !== 'held') log.push(`hover is ${game.hover?.kind} (want the held row)`);
      if (how === 'choke') { game.selectVerb('held', 'choke'); W.input.pressed.add(IK); } else W.input.pressed.add('KeyE');   // the choke's row, tapped once: it commits and runs on its own
      for (let f = 0; f < 60 * 8; f++) {
        if (endT < 0) W.cursorAt(v3.add(A.char.pos, [0, 1.2, 0]));
        W.step(DT); const t = game.time;
        if (game.player.hitFlash > prevHit + 1e-9) hits++; prevHit = game.player.hitFlash;
        if (endT < 0 && (how === 'choke' ? victim.state === 'dead' : !victim.held)) endT = t;
        if (endT < 0) for (const e of game.events) if (e.kind === 'guardShot' && e.time === t) shotsBefore++;
        if (endT >= 0 && firstShotT < 0) for (const e of game.events) if (e.kind === 'guardShot' && e.time === t && v3.distXZ(e.pos, A.char.pos) < 0.05) firstShotT = t;
        if (foundT < 0 && victim.found) foundT = t;
        if (standoffGoneT < 0 && endT >= 0 && !A.standoff) standoffGoneT = t;
        if ((how as string) === 'release' && victim.state === 'dead') freedDead = true;
        if ((how as string) === 'release' && victimAlertT < 0 && !victim.held && victim.state === 'alert') victimAlertT = t;
        if (f % 30 === 0) log.push(`${f2(t - t0)}s Kowalski ${A.state}${A.standoff ? '/standoff' : ''} ${f1(v3.distXZ(A.char.pos, game.player.char.pos))} m from Sam spd ${f2(A.speed)} fireCd ${f2(A.fireCd)} seen ${f2(t - A.lastSeenT)} s ago ${A.muzzleDown ? 'muzzleDown' : ''} · Novak ${victim.state}${victim.held ? '/held:' + victim.held.phase : ''} · hold ${game.player.holding?.phase ?? '—'}`);
        if (endT >= 0 && t - endT > 4.5) break;
      }
    } catch (e: any) { exc = String(e?.stack ?? e); }
    const fails: string[] = [];
    if (exc) fails.push('exception: ' + exc.split('\n')[0]);
    if (endT < 0) fails.push(`the hold never ended by ${how}`);
    if (shotsBefore) fails.push(`${shotsBefore} round(s) BEFORE the hold ended, with Novak square between`);
    if (vis <= 0.05) {   // IN THE DARK (since 08-11): a pair at 0.02 is a pair nobody has seen — no standoff can have formed, so no round and no finding follow the choke; Kowalski walks his beat none the wiser
      if (everStandoff) fails.push('a standoff formed round a pair standing in the dark (0.02)');
      if (firstShotT >= 0) fails.push(`a round was fired (+${f2(firstShotT - t0)} s) at a pair nobody could see`);
      if (A.state === 'alert') fails.push('Kowalski alert off a pair in the dark');
    } else {
    if (standoffGoneT < 0 || standoffGoneT - endT > DT + 1e-6) fails.push(`Kowalski's standoff dropped ${standoffGoneT < 0 ? 'never' : f2(standoffGoneT - endT) + ' s after'} (want the same frame)`);
    if (how === 'choke') {
      if (vis > 0.3) { if (firstShotT < 0 || firstShotT - endT > 1.0) fails.push(`first round ${firstShotT < 0 ? 'never' : f2(firstShotT - endT) + ' s'} after Novak dropped (want ≤ 1 s, Sam lit ${vis})`); }
      if (game.tune.muzzleDiscipline && firstShotT >= 0 && firstShotT - endT < 0.35 - 1e-6) fails.push(`first round only ${f2(firstShotT - endT)} s after Novak dropped (muzzle discipline keeps a beat of ≥ 0.35 s: a start, not an execution)`);
      if (foundT < 0 || foundT - endT > DT + 1e-6) fails.push(`Novak found ${foundT < 0 ? 'never' : f2(foundT - endT) + ' s after'} (want there and then)`);
      if (victim.downKind !== 'choked' || game.mission.stats.knockouts !== 1) fails.push(`Novak ${victim.downKind}, knockouts ${game.mission.stats.knockouts}`);
      if (A.witness.sawAct?.kind !== 'choked' || !A.witness.sawBody?.breathing) fails.push(`Kowalski's memory: sawAct ${JSON.stringify(A.witness.sawAct)}, sawBody ${JSON.stringify(A.witness.sawBody)} (want choked / breathing)`);
      if (game.mission.stats.bodies !== 1) fails.push(`bodies ${game.mission.stats.bodies} (want 1)`);
    } else {
      if (freedDead) fails.push('the freed man was shot by his friend');
      if (victimAlertT < 0) fails.push('the freed man never came round to alert');
      if (A.state !== 'alert') fails.push(`Kowalski ${A.state} after the release (want alert)`);
      if (victim.witness.wasHeld !== 1) fails.push(`wasHeld ${victim.witness.wasHeld}`);
    }
    }   // (lit cases)
    const ok = fails.length === 0; allPass &&= ok;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — (${how}${how === 'choke' ? `, Sam lit ${vis}` : ''}) hold ended +${endT >= 0 ? f2(endT - t0) : '—'} s; standoff dropped +${standoffGoneT >= 0 && endT >= 0 ? f2(standoffGoneT - endT) : '—'} s; first round +${firstShotT >= 0 && endT >= 0 ? f2(firstShotT - endT) : '—'} s after; ${how === 'choke' ? `found +${foundT >= 0 && endT >= 0 ? f2(foundT - endT) : '—'} s, ${victim.downKind}` : `Novak ${victim.state} (alert +${victimAlertT >= 0 && endT >= 0 ? f2(victimAlertT - endT) : '—'} s), alive ${!freedDead}`}; Sam hit ${hits}× (god mode); Kowalski now ${A.state}\n    lines: ${lines.filter(l => l.t > t0).map(l => `${f1(l.t - t0)}s ${l.who}${l.radio ? ' (radio)' : ''}: "${l.text}"`).join(' · ') || '—'}\n    ${log.join('\n    ')}\n    log tail: ${msgs.slice(-4).map(m => m.text).join(' | ')}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
  }
  console.log(`=== standoff-end: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}

// ================================================================ (5) view lost: the observer whisked round the corner — four seconds later he gives the standoff up for the plain chase on where they were, and takes it up again when he has them back in view
export async function standoffLost() {
  console.log('\n=== standoff-lost: Kowalski in the standoff, then put round the corner into the corridor — 4 s out of sight and the record drops (\'lost\'), he chases the pair\'s last fix, and re-enters on sight ===');
  let allPass = true;
  const S = await stageHold(351, 1, [33.0, 0, 17.8], 190 * DEG); const { W, game, victim, lines, faceDeg } = S;
  const A = game.guards[0]; const P0 = pairOf(game)!;
  bringIn(game, A, bearingPoint(P0.centre, faceDeg + 10, 4.6), P0.centre);
  for (let i = 0; i < 90; i++) W.step(DT);
  const entered = !!A.standoff; const t0 = game.time;
  place(A, [17.0, 0, 11.2], Math.PI / 2); A.stallRef = null;   // way out along the corridor, facing east: two walls between him and them, and more than four seconds' jog from any sight of them
  const seenT0 = A.standoff?.seenT ?? -1;
  let dropT = -1, reenterT = -1, pathT = -1, exc = ''; const log: string[] = [];
  try {
    for (let f = 0; f < 60 * 30; f++) {
      W.step(DT); const t = game.time;
      if (dropT < 0 && !A.standoff) dropT = t;
      if (dropT >= 0 && reenterT < 0 && A.standoff) reenterT = t;
      if (dropT >= 0 && pathT < 0 && A.path.length && A.pathI < A.path.length && A.speed > 0.3) pathT = t;
      if (VERBOSE && dropT >= 0 && f % 6 === 0) console.log(`      · ${f2(t - t0)}s ${A.state}${A.standoff ? '/so' : ''} pos ${posS(A.char.pos)} path ${A.pathI}/${A.path.length} goal ${A.pathGoal ? posS(A.pathGoal) : '—'} fix ${A.lastKnown ? posS(A.lastKnown) : '—'} spd ${f2(A.speed)} reactT ${f2(A.reactT)} seen ${f2(t - A.lastSeenT)} stall ${f2(A.alertStallT)} chase ${f2(A.chaseT)}`);
      if (f % 60 === 0) log.push(`${f2(t - t0)}s Kowalski ${A.state}${A.standoff ? '/standoff' : ''} at ${posS(A.char.pos)} spd ${f2(A.speed)} fix ${A.lastKnown ? posS(A.lastKnown) : '—'} path ${A.pathI}/${A.path.length} · ${standoffSummary(game) || '—'}`);
      if (reenterT >= 0 && t - reenterT > 2) break;
      if (!pairOf(game)) { log.push(`${f2(t - t0)}s hold ended (${victim.state})`); break; }
    }
  } catch (e: any) { exc = String(e?.stack ?? e); }
  game.puppet = null;
  const lost = lines.find(l => l.who === A.callsign && l.t >= t0 && /lost|where/.test(l.text));
  const fails: string[] = [];
  if (exc) fails.push('exception: ' + exc.split('\n')[0]);
  if (!entered) fails.push('staging: he was not in the standoff before being moved');
  if (dropT < 0 || Math.abs((dropT - seenT0) - 4) > 0.1) fails.push(`the record dropped ${dropT < 0 ? 'never' : f2(dropT - seenT0) + ' s'} after he last saw them (want 4)`);
  if (A.state !== 'alert' && reenterT < 0) fails.push(`after the drop he is ${A.state}`);
  if (pathT < 0 || pathT - dropT > 1.5) fails.push(`he set off for the pair's last fix ${pathT < 0 ? 'never' : f2(pathT - dropT) + ' s after the drop'} (want within ~1 s)`);
  if (!lost) fails.push('no \'lost them\' line');
  if (reenterT < 0) fails.push('he never took the standoff up again on getting them back in view (30 s)');
  const ok = fails.length === 0; allPass &&= ok;
  console.log(`- ${ok ? 'PASS' : 'FAIL'} — dropped ${dropT >= 0 ? f2(dropT - seenT0) + ' s after last sight' : 'never'}; "${lost?.text ?? '—'}"; set off +${pathT >= 0 && dropT >= 0 ? f2(pathT - dropT) : '—'} s; re-entered ${reenterT >= 0 ? '+' + f2(reenterT - dropT) + ' s after the drop' : 'never'}\n    ${log.join('\n    ')}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
  console.log(`=== standoff-lost: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}

// ================================================================ (6) the jog over from two rooms off, out through the door BEHIND him: the soak's 'standoff-far' (seed 1 @ 410 s) — a man in the conference room sees the pair
// across the corridor through the glazing, and his way to them leads away from them first (the conference door, then east along the corridor, then the cubicle opening). He must turn and GO — not hang at
// followPath's facing creep (0.26 m/s sideways into the wall) with his chest held toward them — whatever the door is doing: standing open, shut, or shut and locked (staff carry keys).
export async function standoffDoor() {
  console.log('\n=== standoff-door: the observer in the conference room, the pair in the NW cubicle aisle in his view through the glazing — his path leads off through the conference door behind him (open / shut / locked): he turns and jogs, is through the doorway inside ~4 s and at the ring inside ~9 s; never 3 s "far and going nowhere" (the soak\'s invariant), never popped ===');
  let allPass = true;
  for (const mode of ['open', 'shut', 'locked'] as const) {
    const S = await stageHold(371, 2, [22.0, 0, 16.9], -100 * DEG); const { W, game, victim, lines } = S;   // Reyes held in the aisle west of the blue cluster, the pair facing about west (frozen): in view from the conference room's east half through the corridor glazing and the cubicle opening
    const A = game.guards[0]; const d = game.doors.byName('conference');
    if (mode !== 'open') { d.angle = 0; d.vel = 0; d.latched = true; d.closing = false; d.locked = mode === 'locked'; d.place(); }   // (authored standing open into the room at −1.25, no closer)
    const P0 = pairOf(game)!;
    bringIn(game, A, [10.6, 0, 8.75], P0.centre, 'suspicious', v3.copy(P0.centre));   // Kowalski where the soak had him, turned toward them with a noise from there on his mind: he looks, and sees
    const t0 = game.time; let enterT = -1, goT = -1, jogT = -1, throughT = -1, ringT = -1, lostN = 0, farIdle = 0, farIdleMax = 0, worstStep = 0, minDoorDist = 9, doorMoved = false, exc = '';
    let prev = v3.copy(A.char.pos); const log: string[] = []; let hadStandoff = false;
    try {
      for (let f = 0; f < 60 * 16; f++) {
        W.step(DT); const t = game.time;
        const P = pairOf(game); if (!P) { log.push(`${f2(t - t0)}s the hold ENDED (${victim.state})`); break; }
        const p = A.char.pos; const dist = v3.distXZ(p, P.centre); const step = v3.distXZ(p, prev); prev = v3.copy(p); worstStep = Math.max(worstStep, step);
        if (A.standoff) { hadStandoff = true; if (enterT < 0) enterT = t; } else if (hadStandoff && A.state === 'alert') { lostN++; hadStandoff = false; }
        if (enterT >= 0 && goT < 0 && A.reactT <= 0) goT = t;                       // his CONTACT beat over: from here his feet are the standoff's
        if (goT >= 0 && jogT < 0 && A.speed > 1.2) jogT = t;
        if (goT >= 0 && throughT < 0 && p[2] > 10.45) throughT = t;                 // his centre clear of the corridor face of the doorway
        if (goT >= 0 && ringT < 0 && dist <= 7.5) ringT = t;
        if (Math.abs(d.angle) > 0.05 && mode !== 'open') doorMoved = true;
        minDoorDist = Math.min(minDoorDist, v3.distXZ(p, d.frameCentre));
        // the soak's own measure (standoff-far): in the standoff, further than 7.5 m, and neither walking a leg above 0.3 m/s nor in his beat nor dazzled — 3 s running of that is the violation
        const going = (A.path.length > 0 && A.pathI < A.path.length && A.speed > 0.3) || A.reactT > 0 || t < A.dazzledUntil;
        farIdle = A.standoff && dist > 7.5 && !going ? farIdle + DT : 0; farIdleMax = Math.max(farIdleMax, farIdle);
        if (f % 30 === 0 || (VERBOSE && f % 6 === 0)) { const wp = A.pathI < A.path.length ? A.path[A.pathI] : null; log.push(`${f2(t - t0)}s ${A.state}${A.standoff ? '/so' : ''} at ${posS(p)} yaw ${Math.round(A.char.bodyYaw / DEG)}° aim ${Math.round(A.char.aimYaw / DEG)}° spd ${f2(A.speed)} · ${f1(dist)} m · path ${A.pathI}/${A.path.length}${wp ? ` next ${posS(wp)} brg ${Math.round(Math.atan2(wp[0] - p[0], wp[2] - p[2]) / DEG)}°` : ''} · door ${f2(d.angle)}${d.latched ? 'L' : ''}${d.locked ? 'k' : ''} · seen ${A.standoff ? f1(t - A.standoff.seenT) + ' s ago' : '—'}`); }
        if (ringT >= 0 && t - ringT > 1.5) break;
      }
    } catch (e: any) { exc = String(e?.stack ?? e); }
    game.puppet = null;
    const fails: string[] = [];
    if (exc) fails.push('exception: ' + exc.split('\n')[0]);
    if (enterT < 0) fails.push('staging: Kowalski never entered the standoff (no view of the pair from the conference room?)');
    else {
      if (jogT < 0 || jogT - goT > 1.5) fails.push(`he was jogging (> 1.2 m/s) ${jogT < 0 ? 'never' : f2(jogT - goT) + ' s after his beat'} (want inside 1.5 s)`);
      if (throughT < 0 || throughT - goT > (mode === 'open' ? 3.5 : 5.5)) fails.push(`through the conference doorway ${throughT < 0 ? 'never' : f2(throughT - goT) + ' s after his beat'} (want inside ${mode === 'open' ? 3.5 : 5.5} s${mode !== 'open' ? ', the leaf pushed open on his key' : ''})`);
      if (ringT < 0 || ringT - goT > (mode === 'open' ? 8 : 10)) fails.push(`at the ring (≤ 7.5 m) ${ringT < 0 ? 'never — ' + f1(v3.distXZ(A.char.pos, game.player.char.pos)) + ' m off at the end' : f2(ringT - goT) + ' s after his beat'} (want inside ${mode === 'open' ? 8 : 10} s)`);
      if (farIdleMax >= 3) fails.push(`far from the pair and going nowhere for ${f2(farIdleMax)} s running (the soak's standoff-far fires at 3)`);
      if (mode !== 'open' && !doorMoved && throughT >= 0) fails.push('through the doorway but the shut leaf never moved (walked through it?)');
      if (worstStep > 0.3) fails.push(`popped: ${f2(worstStep)} m in one frame`);
      if (lostN > 1) fails.push(`the standoff dropped and was retaken ${lostN}× on the way (once, out of view through the doorway, is the plain chase by design; more is churn)`);
    }
    const ok = fails.length === 0; allPass &&= ok;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — door ${mode}: entered +${enterT >= 0 ? f2(enterT - t0) : '—'} s, beat over +${goT >= 0 ? f2(goT - enterT) : '—'}, jogging +${jogT >= 0 ? f2(jogT - goT) : '—'} s, through the doorway +${throughT >= 0 ? f2(throughT - goT) : '—'} s, at the ring +${ringT >= 0 ? f2(ringT - goT) : '—'} s (after the beat); far-and-idle max ${f2(farIdleMax)} s; worst frame step ${f2(worstStep)} m; standoff dropped ${lostN}×; door now ${f2(d.angle)}${d.latched ? 'L' : ''}${d.locked ? 'k' : ''}\n    lines: ${lines.filter(l => l.t > t0 && l.who === A.callsign).map(l => `${f1(l.t - t0)}s${l.radio ? ' (radio)' : ''} "${l.text}"`).join(' · ') || '—'}\n    ${log.join('\n    ')}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
  }
  console.log(`=== standoff-door: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}

// ================================================================ (7) nothing under the tour flag (quietUtility), nothing with the AI off, nothing for a scripted-hold / pinned man
export async function standoffTour() {
  console.log('\n=== standoff-tour: the same staging under quietUtility / with the AI off / with the observer held or pinned — no record, no sawHeld, no call, the alarm untouched ===');
  let allPass = true;
  for (const mode of ['quietUtility', 'aiOff', 'hold', 'pinned', 'control'] as const) {
    const S = await stageHold(361, 1, [33.0, 0, 17.8], 190 * DEG); const { W, game, lines, faceDeg } = S;
    const A = game.guards[0]; const P0 = pairOf(game)!;
    (game as any).__probeVis = mode === 'control' ? STANDOFF_LIT : 0.02;   // (the flag modes test that the machinery stays OFF under scripted flags — orthogonal to light, so the pair stays dark and ordinary sight cannot move the man off his mark either; control = a lit pair)
    if (mode === 'quietUtility') game.quietUtility = true; if (mode === 'aiOff') game.aiEnabled = false;
    bringIn(game, A, bearingPoint(P0.centre, faceDeg + 10, 4.6), P0.centre);
    if (mode === 'hold') A.hold = true; if (mode === 'pinned') A.pinned = true;
    let ever = false, exc = ''; const p0 = v3.copy(A.char.pos);
    try { for (let f = 0; f < 60 * 6; f++) { W.step(DT); ever ||= !!A.standoff; } } catch (e: any) { exc = String(e?.stack ?? e); }
    game.puppet = null;
    const call = lines.find(l => /he's got|one of ours/.test(l.text));
    const fails: string[] = [];
    if (exc) fails.push('exception: ' + exc.split('\n')[0]);
    if (mode === 'control') { if (!ever || !call || game.escalation !== 2) fails.push(`control: standoff ${ever}, call ${!!call}, esc ${game.escalation} (want all)`); }
    else {
      if (ever) fails.push('a standoff record appeared');
      if (A.witness.sawHeld) fails.push(`sawHeld written: ${JSON.stringify(A.witness.sawHeld)}`);
      if (call) fails.push(`the call went out: "${call.text}"`);
      if (game.escalation !== 0) fails.push(`escalation ${game.escalation}`);
      if (mode === 'hold' && v3.distXZ(A.char.pos, p0) > 0.3) fails.push(`the held-on-his-mark man moved ${f2(v3.distXZ(A.char.pos, p0))} m`);   // (pinned only binds a man in a fight: on patrol he walks his route as ever)
    }
    const ok = fails.length === 0; allPass &&= ok;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${mode}: standoff ever ${ever}, sawHeld ${!!A.witness.sawHeld}, call ${call ? `"${call.text}"` : 'none'}, esc ${escalationOf(game)}/${game.escalation}, Kowalski ${A.state} aw ${f2(A.awareness)}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
  }
  console.log(`=== standoff-tour: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}
