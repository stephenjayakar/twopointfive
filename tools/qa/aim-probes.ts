// The 'aim' probe family (run through probes.ts: `bun run tools/qa/probes.ts aim | aim-unit | aim-first | aim-motion | aim-stop | aim-player | aim-off [--verbose]`;
// also part of `weapons`): the aim-settle model of src/game/aim.ts — one rule for the guards and for Sam, behind Game.tune.aimModel.
//   aim-unit    the model driven directly: a guard's track climbs to 1 in settleSecs with eyes + gun on Sam (quicker inside rangeRef, floored at nearK), drains with
//               the gun off him, holds through a blink, is gone past memSecs / on a bearing jump / with Sam down, is capped on the move and 1 for a pinned man; the
//               fouled bore (two short rounds from one spot = no line from there); the cone × at track 0 / 0.5 / 1 against the formula; the feet term (now vs
//               remembered); the target term off a synthetic bearing rate; Sam's track: caps at a sprint / walking, a new man resets it, off him and straight
//               back keeps it, crouched climbs quicker; his cone's terms; the ring's pixels follow the cone.
//   aim-first   a FREE alert man 8.5 m up the corridor from a lit standing god-mode Sam, from first sight: no round before reactT + acquireMin·settleSecs (± a
//               frame), the first round's cone ≥ 1.8× a settled one's and — over eight seeds — the first rounds miss by more than the settled ones; then the
//               weapons-identity staging (6.5 m, gun round in 0.3 s) with the man FREE, model off vs on over 45 s: rounds, how many found Sam, first round.
//   aim-motion  a pinned (settled, planted) man and a god-mode Sam 8 m off: standing / sprinting ACROSS his front / running straight AT him — hit fractions:
//               across ≤ 0.4 × standing, at him ≥ 0.8 × standing; the cones and bearing rates printed; the three canonical cones before → after.
//   aim-stop    a free man 20 m down the corridor from a lit standing Sam closes and fires: with the model ≥ 80 % of his rounds leave at ≤ stopToShoot m/s (he
//               brakes for each), the cone at the chase's 2.7 m/s is ≥ 2× a planted one's; the control (model off) fires on the run.
//   aim-player  ten clicked rounds at the corridor wall 12 m off straight after a sprint stop vs after 1.5 s still: scatter ratio ≥ 1.8; the terms behind it.
//   aim-off     tune.aimModel = false: tracks rest at 0, the gate is open, guardRound hands { spread } untouched (no steady), samAim 0, no braking, no ◎ —
//               and weapons-identity (run in the same families) stays green.
//   aim-snap    what the reticle TAKES (player.ts updateAim): a light only with the cursor on its dot (AIM.player.lightSnapPx) — every aimable light in the lobby
//               view swept on rings from the dot out to 58 px, against the same sweep at 60 (the reach it had, and what the harness stands at); a man standing
//               under a ceiling panel's picture with the cursor beside him, nearer the panel's dot than his chest: the reticle is on HIM and the clicked round
//               drops him — at 60 the panel takes it and the round goes into the ceiling; a light taken is kept while the camera's lead slides its dot from
//               under a cursor left where it was, the right button then OCPs it, and moving the cursor off lets go; a drawn fixture is taken anywhere on its box.
import { standUp, ROOT } from './headless.ts';
const { v3, DEG, wrapAngle, lerp } = await import(`${ROOT}/src/math/vec.ts`);
const { updateAim } = await import(`${ROOT}/src/game/player.ts`);
const { resetChase, playerGroundVel } = await import(`${ROOT}/src/game/guards.ts`);
const Aim = await import(`${ROOT}/src/game/aim.ts`);
const { AIM, trackGuard, trackPlayer, aimReady, guardRound, handsCone, aimBrake, playerAim, samAim, guardAcquired, noteBore, boreFouled, AIM_DEBUG } = Aim;
const { aimRingPx } = await import(`${ROOT}/src/ui/overlay.ts`);

type Vec3 = [number, number, number];
const DT = 1 / 60;
const VERBOSE = process.argv.includes('--verbose');
const f1 = (x: number) => x.toFixed(1), f2 = (x: number) => x.toFixed(2), f3 = (x: number) => x.toFixed(3);
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** A guard planted at `p` facing yaw, still, no path, free (not held / pinned), posed twice (bones where the sight tests read them). */
function place(gd: any, p: Vec3, yaw: number) { gd.char.pos = v3.copy(p); gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.char.bodyYaw = gd.char.aimYaw = yaw; gd.char.aimPitch = 0; gd.path = []; gd.pathGoal = null; gd.hold = false; gd.pinned = false; gd.char.update(0); gd.char.update(DT); }
/** parked out on the lot east of the building, held and pinned, facing east, deaf and blind */
function park(gd: any, i: number) { gd.hold = true; gd.pinned = true; gd.char.pos = [37.5, 0, 6 + i * 1.5]; gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.char.bodyYaw = gd.char.aimYaw = Math.PI / 2; gd.path = []; gd.pathGoal = null; gd.heardUpTo = 1e12; gd.dazzledUntil = 1e9; gd.char.update(0); }
/** alert on Sam where he stands, licensed (a sighting this frame), reaction beat `reactT`, the gun coming round in `fireCd`, chase clocks zeroed; `pinned` as asked (false = a free man) */
function armAlert(gd: any, game: any, fireCd = 0.3, reactT = 0, pinned = false) { gd.hold = false; gd.pinned = pinned; gd.dazzledUntil = -1; gd.heardUpTo = 1e12; gd.state = 'alert'; gd.awareness = 1; gd.reactT = reactT; gd.fireCd = fireCd; gd.weapon.rearm(); gd.reloadT = -1; gd.lastKnown = v3.copy(game.player.char.pos); gd.lastSeenT = game.time; gd.sightT = game.time; gd.ledT = game.time; resetChase(gd); }
function verdict(ok: boolean, label: string, detail: string) { console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}: ${detail}`); return ok; }
/** the angle (rad) between the round's flight (from → to off the guardShot / shot event) and the line from its muzzle to `at` — how far off the point it went */
function missAngle(e: any, at: Vec3): number { const d = v3.normalize(v3.sub(e.to, e.from)), w = v3.normalize(v3.sub(at, e.from)); return Math.acos(Math.max(-1, Math.min(1, v3.dot(d, w)))); }
const trunkOf = (game: any): Vec3 => { const pc = game.player.char; const t = pc.bones.spine2 ?? pc.bones.hips; return [t ? t[0] : pc.pos[0], pc.pos[1] + (game.player.crouch ? 0.8 : 1.25), t ? t[2] : pc.pos[2]]; };

// ================================================================ (a) the model, driven
export async function aimUnit() {
  console.log('\n=== aim-unit: the model driven directly — a guard\'s track (climb / drain / hold / gone / jump / capped / pinned), the cone × at track 0 · 0.5 · 1, the feet and target terms; Sam\'s track (caps, a new man, back onto him, crouched) and cone; the ring\'s pixels ===');
  Math.random = seeded(901);
  const W = await standUp(); const { game } = W; const G = AIM.guard, Y = AIM.player;
  game.godMode = true; game.aiEnabled = true; game.player.visibility = 0.9;
  for (let i = 0; i < 5; i++) W.step(DT);
  const [A, B, C] = game.guards; park(B, 1); park(C, 2);
  const pl = game.player; game.teleportPlayer([24.0, 0, 11.4]); pl.slot = 'pistol'; pl.holstered = false; pl.crouch = false; W.step(DT); W.step(DT);
  place(A, [14.0, 0, 11.3], Math.PI / 2); armAlert(A, game, 0.3, 0, false);   // 10 m west of Sam down the corridor, facing him, free
  const fails: string[] = []; const rows: string[] = [];
  const brgTo = () => { const t = trunkOf(game); return Math.atan2(t[0] - A.char.pos[0], t[2] - A.char.pos[2]); };
  const drive = (n: number, cfg: () => void) => { for (let i = 0; i < n; i++) { cfg(); game.time += DT; trackGuard(game, A, DT); } };   // (the model alone: nothing else moves, the clock does)
  // climb: eyes on him (lastSeenT now), gun on him → +dt/settleSecs a frame, 1 at settleSecs (± a frame)
  A.aim.clear(); let tAt55 = -1, tAt1 = -1;
  for (let i = 0; i < 200 && tAt1 < 0; i++) { A.lastSeenT = game.time + DT; A.char.aimYaw = brgTo(); game.time += DT; trackGuard(game, A, DT); const t = (i + 1) * DT; if (tAt55 < 0 && A.aim.track >= G.acquireMin - 1e-9) tAt55 = t; if (A.aim.track >= 1 - 1e-9) tAt1 = t; }
  rows.push(`climb: track ≥ ${G.acquireMin} at ${f3(tAt55)} s (formula ${f3(G.acquireMin * G.settleSecs)}), 1 at ${f3(tAt1)} s (settleSecs ${G.settleSecs})`);
  if (Math.abs(tAt1 - G.settleSecs) > 1.5 * DT + 1e-9) fails.push(`track reached 1 at ${tAt1} s (settleSecs ${G.settleSecs})`); if (Math.abs(tAt55 - G.acquireMin * G.settleSecs) > 1.5 * DT + 1e-9) fails.push(`gate track at ${tAt55} s (want ${G.acquireMin * G.settleSecs})`);
  if (!aimReady(game, A) || !guardAcquired(game, A)) fails.push(`at track ${A.aim.track} aimReady ${aimReady(game, A)} / acquired ${guardAcquired(game, A)}`);
  // nearer than rangeRef it goes quicker (× dist / rangeRef, floored at nearK): Sam put 3.2 m off him, then at arm's length
  { const spot = v3.copy(pl.char.pos);
    for (const [d, label] of [[3.2, '3.2 m'], [1.2, '1.2 m (floor)']] as [number, string][]) {
      game.teleportPlayer([A.char.pos[0] + d, 0, A.char.pos[2]]); A.aim.clear(); let t1 = -1;
      for (let i = 0; i < 200 && t1 < 0; i++) { A.lastSeenT = game.time + DT; A.char.aimYaw = brgTo(); game.time += DT; trackGuard(game, A, DT); if (A.aim.track >= 1 - 1e-9) t1 = (i + 1) * DT; }
      const dist = v3.distXZ(A.char.pos, pl.char.pos); const want = G.settleSecs * Math.min(1, Math.max(G.nearK, dist / G.rangeRef));
      rows.push(`near: at ${label} (${f2(dist)} m) → 1 at ${f3(t1)} s (settleSecs × ${f2(want / G.settleSecs)} = ${f3(want)})`); if (Math.abs(t1 - want) > 1.5 * DT + 1e-9) fails.push(`settle at ${f2(dist)} m took ${t1} s (want ${want})`);
    }
    game.teleportPlayer(spot); A.aim.clear(); drive(200, () => { A.lastSeenT = game.time + DT; A.char.aimYaw = brgTo(); }); }
  // the fouled bore: two rounds running that die a hand off the muzzle from one spot = no line from there until he is half a metre off it; a true round wipes it
  { const at: Vec3 = trunkOf(game); const ev = (flew: number) => { const from = v3.copy(A.char.muzzle); const d = v3.normalize(v3.sub(at, from)); game.events.push({ kind: 'guardShot', pos: v3.copy(A.char.pos), time: game.time, loud: true, level: 1, weapon: A.weapon.def.id, from, to: v3.mad(from, d, flew) }); noteBore(game, A, at); };
    ev(0.25); const one = boreFouled(game, A); ev(0.3); const two = boreFouled(game, A); const p0 = v3.copy(A.char.pos); A.char.pos = v3.add(p0, [0.7, 0, 0]); const moved = boreFouled(game, A); A.char.pos = p0;
    ev(0.25); ev(0.25); const again = boreFouled(game, A); ev(v3.dist(A.char.muzzle, at) - 0.28); const wiped = boreFouled(game, A);
    game.tune.aimModel = false; ev(0.25); ev(0.25); const offF = boreFouled(game, A) || !!A.aim.fouled; game.tune.aimModel = true;
    rows.push(`fouled bore: one short round ${one} · two ${two} · 0.7 m off that spot ${moved} · two more ${again} · a round that reached him ${wiped} · model off ${offF}`);
    if (one || !two || moved || !again || wiped || offF) fails.push(`bore foul logic: ${JSON.stringify({ one, two, moved, again, wiped, offF })}`);
    game.events.length = 0; }
  // drain: gun 90° off him, eyes still on → −loseRate·dt a frame
  { const t0 = A.aim.track; drive(6, () => { A.lastSeenT = game.time + DT; A.char.aimYaw = brgTo() + Math.PI / 2; }); const want = Math.max(0, t0 - G.loseRate * 6 * DT);
    rows.push(`drain: gun off him 6 frames → ${f3(A.aim.track)} (formula ${f3(want)})`); if (Math.abs(A.aim.track - want) > 1e-6) fails.push(`drained to ${A.aim.track} (want ${want})`); }
  // hold through a blink, gone past memSecs
  { drive(60, () => { A.lastSeenT = game.time + DT; A.char.aimYaw = brgTo(); }); const full = A.aim.track;
    const seenAt = game.time; drive(Math.floor(G.memSecs / DT) - 2, () => { A.lastSeenT = seenAt; A.char.aimYaw = brgTo(); }); const held = A.aim.track;
    drive(6, () => { A.lastSeenT = seenAt; }); const gone = A.aim.track;
    rows.push(`blink: ${f2(full)} held ${f2(held)} through ${f2(G.memSecs - 2 * DT)} s unseen, ${f2(gone)} at ${f2(game.time - seenAt)} s`); if (Math.abs(held - full) > 1e-9) fails.push(`a blink cost track: ${full} → ${held}`); if (gone !== 0) fails.push(`still ${gone} after ${game.time - seenAt} s unseen (memSecs ${G.memSecs})`); }
  // a bearing jump (Sam teleported 30°+ round him) → 0; the reaction beat / dazzle / not alert → no climb; Sam down → 0
  { drive(120, () => { A.lastSeenT = game.time + DT; A.char.aimYaw = brgTo(); }); const before = A.aim.track;
    game.teleportPlayer([14.0 + 10 * Math.sin(45 * DEG), 0, 11.3 + 10 * Math.cos(45 * DEG)]);   // (45° round from due east of him, into the cubicle farm — only the bearing matters to the model)
    A.lastSeenT = game.time + DT; game.time += DT; trackGuard(game, A, DT); const after = A.aim.track; const dB = Math.abs(wrapAngle(brgTo() - Math.PI / 2)) / DEG;
    rows.push(`jump: Sam moved ${f1(dB)}° round him in a frame → track ${f2(before)} → ${f2(after)}, bearing rate ${f3(A.aim.bearingRate)} (not fed the jump)`);
    if (dB <= G.jumpDeg) fails.push(`staging: the teleport only moved his bearing ${dB}°`); else { if (after !== 0) fails.push(`a ${dB}° jump left track ${after}`); if (A.aim.bearingRate > 0.5) fails.push(`the jump fed the bearing rate: ${A.aim.bearingRate}`); }
    game.teleportPlayer([24.0, 0, 11.4]); A.aim.clear(); drive(3, () => { A.lastSeenT = game.time + DT; A.char.aimYaw = brgTo(); });
    A.aim.track = 0.4; A.reactT = 0.5; drive(10, () => { A.lastSeenT = game.time + DT; A.char.aimYaw = brgTo(); }); const react = A.aim.track; A.reactT = 0;
    A.aim.track = 0.4; A.dazzledUntil = game.time + 5; drive(10, () => { A.lastSeenT = game.time + DT; A.char.aimYaw = brgTo(); }); const dazz = A.aim.track; A.dazzledUntil = -1;
    A.aim.track = 0.4; A.state = 'suspicious'; drive(10, () => { A.lastSeenT = game.time + DT; A.char.aimYaw = brgTo(); }); const sus = A.aim.track; A.state = 'alert';
    rows.push(`no climb: reacting ${f2(react)} · dazzled ${f2(dazz)} · suspicious ${f2(sus)} (from 0.40: they drain, never climb)`); for (const [k, v] of [['reacting', react], ['dazzled', dazz], ['suspicious', sus]] as [string, number][]) if (v > 0.4 + 1e-9) fails.push(`${k}: track climbed to ${v}`);
    A.aim.track = 0.8; pl.down = true; drive(1, () => { A.lastSeenT = game.time + DT; }); const dn = A.aim.track; pl.down = false;
    rows.push(`Sam down: 0.80 → ${f2(dn)}`); if (dn !== 0) fails.push(`Sam down left track ${dn}`); }
  // capped on the move; pinned = 1 whatever
  { A.aim.clear(); drive(200, () => { A.lastSeenT = game.time + DT; A.char.aimYaw = brgTo(); A.char.vel = [G.stopToShoot + 0.3, 0, 0]; }); const moving = A.aim.track;
    A.char.vel = [0, 0, 0]; drive(200, () => { A.lastSeenT = game.time + DT; A.char.aimYaw = brgTo(); }); const still = A.aim.track;
    A.char.vel = [G.stopToShoot + 0.3, 0, 0]; drive(1, () => { A.lastSeenT = game.time + DT; A.char.aimYaw = brgTo(); }); const clampd = A.aim.track; A.char.vel = [0, 0, 0];
    A.aim.clear(); A.pinned = true; A.lastSeenT = -100; drive(1, () => {}); const pinnedT = A.aim.track; A.pinned = false; A.lastSeenT = game.time;
    rows.push(`caps: at ${f1(G.stopToShoot + 0.3)} m/s → ${f2(moving)} (movingTrackCap ${G.movingTrackCap}) · still → ${f2(still)} · settled then moving → ${f2(clampd)} · pinned, unseen → ${f2(pinnedT)}`);
    if (Math.abs(moving - G.movingTrackCap) > 1e-9) fails.push(`moving track ${moving} (cap ${G.movingTrackCap})`); if (still < 1 - 1e-9) fails.push(`still track ${still}`); if (Math.abs(clampd - G.movingTrackCap) > 1e-9) fails.push(`settled man setting off kept ${clampd}`); if (pinnedT !== 1) fails.push(`pinned track ${pinnedT}`); }
  // the cone: hands × lerp(unsettledK, 1, track) (+ target + feet, both 0 here) — handsCone with the model on; the row's own line with it off
  { A.aim.clear(); A.aim.speedSm = 0; A.char.vel = [0, 0, 0]; drive(2, () => { A.lastSeenT = game.time + DT; A.char.aimYaw = brgTo(); });
    const S = A.weapon.def.aiSpread; const range = v3.dist(A.char.pos, pl.char.pos); const hands = S.base + Math.max(0, range - S.rangeFrom) * S.rangeK;
    const cones: string[] = [];
    for (const t of [0, 0.5, 1]) { A.aim.track = t; A.aim.bearingRate = 0; const got = handsCone(game, A, 0), want = hands * lerp(G.unsettledK, 1, t); cones.push(`track ${t}: ${f4(got)} (formula ${f4(want)}, ×${f2(got / hands)})`); if (Math.abs(got - want) > 1e-9) fails.push(`cone at track ${t}: ${got} ≠ ${want}`); }
    game.tune.aimModel = false; const off = handsCone(game, A, 0); game.tune.aimModel = true; const today = S.base + Math.min(S.moveCap, 0 * S.moveK) + Math.max(0, range - S.rangeFrom) * S.rangeK;
    rows.push(`cone at ${f1(range)} m (hands ${f4(hands)}): ${cones.join(' · ')} · model off ${f4(off)} (the row's line ${f4(today)})`); if (Math.abs(off - today) > 1e-12) fails.push(`model-off cone ${off} ≠ the row's ${today}`);
    // feet: now vs remembered; target: a synthetic bearing rate
    A.aim.track = 1; A.char.vel = [2.7, 0, 0]; const run = handsCone(game, A, 0); A.char.vel = [0, 0, 0]; A.aim.speedSm = 2.0; const skid = handsCone(game, A, 0); A.aim.speedSm = 0; const planted = handsCone(game, A, 0);
    A.aim.speedSm = 1.0; const walkStop = handsCone(game, A, 0); A.aim.speedSm = 0;
    rows.push(`feet: planted ${f4(planted)} · running 2.7 m/s ${f4(run)} (+${f4(run - planted)} = 2.7 × ${G.shooterMoveK}) · just skidded out of a run (remembered 2.0) ${f4(skid)} (+${f4(skid - planted)} = (2.0 − steadyPace ${G.steadyPace}) × ${G.shooterMoveK}) · stopped out of a walk (remembered 1.0) ${f4(walkStop)} (+0)`);
    if (Math.abs(run - planted - 2.7 * G.shooterMoveK) > 1e-9) fails.push(`running cone ${run} − planted ${planted} ≠ 2.7·${G.shooterMoveK}`); if (Math.abs(skid - planted - (2.0 - G.steadyPace) * G.shooterMoveK) > 1e-9) fails.push(`the remembered run did not count right: +${skid - planted}`); if (Math.abs(walkStop - planted) > 1e-9) fails.push(`a stop out of a walk still cost +${walkStop - planted}`); if (run < 2 * planted) fails.push(`running cone ${run} < 2× planted ${planted}`);
    A.aim.bearingRate = 0.59; const crossing = handsCone(game, A, 0); A.aim.bearingRate = 5; const capped = handsCone(game, A, 0); A.aim.bearingRate = 0;
    rows.push(`target: crossing 0.59 rad/s ${f4(crossing)} (+${f4(crossing - planted)} = min(${G.targetMoveCap}, 0.59 × ${G.targetMoveK})) · absurd rate capped ${f4(capped)} (+${f4(capped - planted)})`);
    if (Math.abs(crossing - planted - Math.min(G.targetMoveCap, 0.59 * G.targetMoveK)) > 1e-9) fails.push(`crossing term ${crossing - planted}`); if (Math.abs(capped - planted - G.targetMoveCap) > 1e-9) fails.push(`cap ${capped - planted} ≠ ${G.targetMoveCap}`);
    // guardRound: on → { spread, steady }, stamps lastShot; the gate
    A.aim.track = 0.3; const gated = aimReady(game, A); A.aim.track = 1; const r = guardRound(game, A, 0.02); const ls = A.aim.lastShot;
    rows.push(`gate at track 0.30: ${gated} · guardRound(extra 0.02) → ${JSON.stringify(r)}, lastShot ${ls ? `t ${f2(ls.t)} track ${ls.track} spread ${f4(ls.spread)}` : 'null'}`);
    if (gated) fails.push('aimReady true at track 0.3'); if (!r.steady || Math.abs(r.spread - (planted + 0.02)) > 1e-9) fails.push(`guardRound gave ${JSON.stringify(r)} (want spread ${planted + 0.02}, steady)`); if (!ls || ls.t !== game.time) fails.push('guardRound did not stamp lastShot'); }
  // ---- Sam
  { const P = pl.aim; game.aimGuard = null; pl.sprinting = false; pl.crouch = false; pl.char.vel = [0, 0, 0]; P.clear();
    const pdrive = (n: number, cfg: () => void) => { for (let i = 0; i < n; i++) { cfg(); pl.char.pos = [pl.char.pos[0] + pl.char.vel[0] * DT, pl.char.pos[1], pl.char.pos[2] + pl.char.vel[2] * DT]; game.time += DT; playerGroundVel(game); trackPlayer(game, DT); } };   // (Sam actually COVERS the ground his velocity claims, and the ground sample is taken each step: since review 08-10 #5 the model reads motion over the ground, not the commanded pace)
    let t1 = -1; for (let i = 0; i < 200 && t1 < 0; i++) { game.time += DT; trackPlayer(game, DT); if (P.track >= 1 - 1e-9) t1 = (i + 1) * DT; }
    rows.push(`Sam: free aim, still → track 1 at ${f3(t1)} s (settleSecs ${Y.settleSecs})`); if (Math.abs(t1 - Y.settleSecs) > 1.5 * DT + 1e-9) fails.push(`Sam settled at ${t1} s (want ${Y.settleSecs})`);
    playerGroundVel(game);   // (prime the ground sampler at rest so the first driven frame measures a real displacement)
    pl.sprinting = true; pl.char.vel = [4.7, 0, 0]; pdrive(2, () => {}); const sprint = P.track; pl.sprinting = false;
    pl.char.vel = [1.5, 0, 0]; pdrive(120, () => {}); const walk = P.track; pl.char.vel = [0, 0, 0];
    rows.push(`Sam: sprinting → ${f2(sprint)} (cap ${Y.sprintCap}) · walking 2 s → ${f2(walk)} (cap ${Y.walkCap})`); if (Math.abs(sprint - Y.sprintCap) > 1e-9) fails.push(`sprint track ${sprint}`); if (Math.abs(walk - Y.walkCap) > 1e-9) fails.push(`walking track ${walk}`);
    P.clear(); P.speedSm = 0; pl.crouch = true; let tc = -1; for (let i = 0; i < 200 && tc < 0; i++) { game.time += DT; trackPlayer(game, DT); if (P.track >= 1 - 1e-9) tc = (i + 1) * DT; } pl.crouch = false;
    rows.push(`Sam: crouched → 1 at ${f3(tc)} s (× ${Y.crouchK} quicker: ${f3(Y.settleSecs / Y.crouchK)})`); if (Math.abs(tc - Y.settleSecs / Y.crouchK) > 1.5 * DT + 1e-9) fails.push(`crouched settle ${tc} s`);
    // a new man resets; off him keeps; straight back keeps; another man resets
    pdrive(120, () => {}); const before = P.track; game.aimGuard = A; pdrive(1, () => {}); const ontoA = P.track;
    pdrive(120, () => { game.aimGuard = A; }); const onA = P.track; game.aimGuard = null; pdrive(3, () => {}); const offA = P.track; game.aimGuard = A; pdrive(1, () => {}); const backA = P.track;
    B.state = 'alert'; game.aimGuard = B; pdrive(1, () => {}); const ontoB = P.track; game.aimGuard = null; B.state = 'patrol';
    rows.push(`Sam: settled ${f2(before)} → onto Kowalski ${f2(ontoA)} (new man: 0) → held on him ${f2(onA)} → off him 3 fr ${f2(offA)} → straight back ${f2(backA)} (kept) → onto another ${f2(ontoB)} (0)`);
    if (ontoA !== 0 && !(ontoA <= DT / Y.settleSecs + 1e-9)) fails.push(`onto a man kept ${ontoA}`); if (onA < 1 - 1e-9) fails.push(`never settled on him: ${onA}`); if (offA < onA - 1e-9) fails.push(`off him cost ${onA - offA}`); if (backA < offA - 1e-9) fails.push(`straight back onto him cost track: ${offA} → ${backA}`); if (ontoB > DT / Y.settleSecs + 1e-9) fails.push(`another man kept ${ontoB}`);
    // his cone: base × settle + feet; 0 under the puppet / model off; samAim stamps
    P.clear(); P.track = 1; pl.char.vel = [0, 0, 0]; P.speedSm = 0; const still = playerAim(game); pl.char.vel = [1.55, 0, 0]; const walking = playerAim(game); pl.char.vel = [0, 0, 0]; P.speedSm = 3.0; const skid = playerAim(game); P.speedSm = 0; P.track = 0; const fresh = playerAim(game); P.track = 1;
    pl.crouch = true; const cr = playerAim(game); pl.crouch = false;
    game.puppet = { goal: null, aim: null }; const pup = samAim(game); game.puppet = null; game.tune.aimModel = false; const offv = samAim(game); game.tune.aimModel = true; const stamped = samAim(game); const pls = pl.aim.lastShot;
    rows.push(`Sam's cone: settled still ${f4(still.spread)} (base ${Y.baseStand}) · crouched ${f4(cr.spread)} · walking 1.55 ${f4(walking.spread)} (+${f4(walking.own)}) · skidded out of a sprint (3.0 remembered) ${f4(skid.spread)} (+${f4(skid.spread - still.spread)} = (3.0 − steadyPace ${Y.steadyPace}) × ${Y.shooterMoveK}) · unsettled ×${f2(fresh.settle)} ${f4(fresh.spread)} · puppet ${pup} · model off ${offv} · samAim ${f4(stamped)} stamps lastShot ${pls ? 'yes' : 'no'}`);
    if (Math.abs(still.spread - Y.baseStand) > 1e-9) fails.push(`settled cone ${still.spread} ≠ base ${Y.baseStand}`); if (Math.abs(cr.spread - Y.baseCrouch) > 1e-9) fails.push(`crouched cone ${cr.spread}`);
    if (Math.abs(walking.own - 1.55 * Y.shooterMoveK) > 1e-9) fails.push(`walking feet term ${walking.own}`); if (Math.abs(skid.spread - still.spread - (3.0 - Y.steadyPace) * Y.shooterMoveK) > 1e-9) fails.push(`remembered sprint +${skid.spread - still.spread}`);
    if (Math.abs(fresh.spread - Y.baseStand * Y.unsettledK) > 1e-9) fails.push(`unsettled cone ${fresh.spread} ≠ ${Y.baseStand * Y.unsettledK}`); if (pup !== 0 || offv !== 0) fails.push(`puppet ${pup} / off ${offv} not 0`); if (!pls || pls.t !== game.time) fails.push('samAim did not stamp lastShot');
    // the ring: pixels off the cone at the distance, clamped 10‥60, monotone
    const px = (s: number, d: number) => aimRingPx(s, d, W.cam, 1000);
    const r0 = px(0.012, 8), r1 = px(0.05, 8), r2 = px(0.4, 8), rmin = px(0.0001, 1), rfar = px(0.05, 16);
    rows.push(`ring: 0.012 rad × 8 m → ${f1(r0)} px · 0.05 → ${f1(r1)} · 0.4 → ${f1(r2)} (cap 60) · nothing → ${f1(rmin)} (floor 10) · 0.05 × 16 m → ${f1(rfar)}`);
    if (!(r0 >= 10 && r1 > r0 && r2 === 60 && rmin === 10 && rfar > r1)) fails.push(`ring pixels not monotone / clamped: ${r0} ${r1} ${r2} ${rmin} ${rfar}`); }
  const ok = fails.length === 0;
  verdict(ok, 'the model', `\n    ${rows.join('\n    ')}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
  console.log(`=== aim-unit: ${ok ? 'ALL PASS' : 'FAILURES above'} ===`);
  return ok;
}
const f4 = (x: number) => x.toFixed(4);

// ================================================================ (b) first sight → first round; the identity staging free, off vs on
interface FightRun { rounds: { t: number; miss: number; cone: number; track: number; speed: number; hit: boolean; dist: number }[]; firstT: number; hits: number; exc: string; trace: string[]; }
/** A free (or pinned) alert man at `gPos` facing Sam at `sPos` (lit, god mode, standing still), for `secs`: every round's time from t0, miss angle off Sam's trunk,
 *  the cone / track / speed it left with (aim.lastShot under the model; the row's line otherwise), whether it found him. */
async function fight(seed: number, o: { model: boolean; gPos: Vec3; sPos: Vec3; secs: number; fireCd: number; reactT: number; pinned?: boolean; carbine?: boolean }): Promise<FightRun> {
  Math.random = seeded(seed);
  const W = await standUp(); const { game } = W; const pl = game.player;
  game.godMode = true; game.aiEnabled = true; game.tune.aimModel = o.model; if (o.carbine) game.tune.carbineGuards = 'all';
  for (let i = 0; i < 5; i++) W.step(DT);
  const [A, B, C] = game.guards; park(B, 1); park(C, 2);
  game.teleportPlayer(v3.copy(o.sPos)); pl.slot = 'pistol'; pl.holstered = false; pl.crouch = false; pl.pistol.lightOn = false;
  place(A, o.gPos, Math.atan2(o.sPos[0] - o.gPos[0], o.sPos[2] - o.gPos[2])); W.step(DT); pl.visibility = 0.9;
  armAlert(A, game, o.fireCd, o.reactT, !!o.pinned);
  const R: FightRun = { rounds: [], firstT: -1, hits: 0, exc: '', trace: [] }; const t0 = game.time;
  const dbg: string[] = []; AIM_DEBUG.log = VERBOSE ? (s: string) => dbg.push(`${f2(game.time - t0)} ${s}`) : null;
  try {
    for (let f = 0; f < Math.round(o.secs / DT); f++) {
      pl.visibility = 0.9; pl.hitFlash = 0;
      const trunk = trunkOf(game);
      W.step(DT);
      for (const e of game.events) if (e.kind === 'guardShot' && e.time === game.time && e.from && e.to) {
        const ls = A.aim.lastShot; const hit = pl.hitFlash > 0.9;
        R.rounds.push({ t: game.time - t0, miss: missAngle(e, trunk), cone: ls && ls.t === game.time ? ls.spread : handsCone(game, A, 0), track: ls && ls.t === game.time ? ls.track : NaN, speed: Math.hypot(A.char.vel[0], A.char.vel[2]), hit, dist: v3.distXZ(A.char.pos, pl.char.pos) });
        if (hit) R.hits++; if (R.firstT < 0) R.firstT = game.time - t0;
      }
      if (f % 15 === 0) R.trace.push(`${f2(game.time - t0)}s ${A.state} track ${f2(A.aim.track)} brg ${f2(A.aim.bearingRate)} feet ${f2(A.aim.speedSm)} speed ${f2(A.speed)} fireCd ${f2(A.fireCd)} reactT ${f2(A.reactT)} dist ${f1(v3.distXZ(A.char.pos, pl.char.pos))}${A.aim.braking ? ' BRAKE' : ''} seen ${f2(game.time - A.lastSeenT)}s rounds ${R.rounds.length}`);
    }
  } catch (e: any) { R.exc = String(e?.stack ?? e); }
  AIM_DEBUG.log = null;
  if (VERBOSE) { console.log('    ' + R.trace.join('\n    ')); if (dbg.length) console.log('    debug: ' + dbg.slice(0, 60).join('\n    debug: ')); }
  return R;
}
const mean = (a: number[]) => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;

export async function aimFirst() {
  console.log('\n=== aim-first: a FREE alert man 8.5 m up the corridor from a lit standing Sam, from first sight — no round before reactT + acquireMin·settleSecs, the first round\'s cone ≥ 1.8× a settled one\'s, first rounds miss by more (8 seeds); then the weapons-identity staging FREE, model off vs on over 45 s ===');
  let allPass = true; const G = AIM.guard;
  const SAM: Vec3 = [24.0, 0, 11.4], GRD: Vec3 = [15.5, 0, 11.3];   // 8.5 m: inside the 9 m he holds and fires from — planted, so only the beat and the gate decide
  const REACT = 0.35;   // the alert transition's own beat
  {
    const runs: FightRun[] = []; for (let s = 0; s < 8; s++) runs.push(await fight(911 + s, { model: true, gPos: GRD, sPos: SAM, secs: 6, fireCd: 0, reactT: REACT }));
    const fails: string[] = []; const want = REACT + G.acquireMin * G.settleSecs;
    const firsts = runs.map(r => r.firstT); const firstCones = runs.map(r => r.rounds[0]?.cone ?? NaN), settledCones = runs.flatMap(r => r.rounds.filter(x => x.track >= 0.999).map(x => x.cone));
    const firstMiss = mean(runs.map(r => r.rounds[0]?.miss ?? 0)), settledMiss = mean(runs.flatMap(r => r.rounds.filter(x => x.track >= 0.999).map(x => x.miss)));
    for (const [i, r] of runs.entries()) { if (r.exc) fails.push(`seed ${911 + i}: exception ${r.exc.split('\n')[0]}`); if (r.firstT < 0) fails.push(`seed ${911 + i}: no round in 6 s`); else if (r.firstT < want - 1.5 * DT) fails.push(`seed ${911 + i}: first round at ${f3(r.firstT)} s — before reactT + acquireMin·settleSecs = ${f3(want)}`); else if (r.firstT > want + 0.35) fails.push(`seed ${911 + i}: first round only at ${f3(r.firstT)} s (want ≈ ${f3(want)}: the beat, the gate, a frame or two for the gun to come round)`); }
    const coneRatio = mean(firstCones) / Math.max(1e-9, mean(settledCones));
    if (!(coneRatio >= 1.8)) fails.push(`first-round cone ${f4(mean(firstCones))} is only ${f2(coneRatio)}× the settled ${f4(mean(settledCones))} (want ≥ 1.8)`);
    if (settledCones.length < 8) fails.push(`only ${settledCones.length} settled rounds across the runs`);
    if (!(firstMiss > 1.3 * settledMiss)) fails.push(`first rounds missed by ${f4(firstMiss)} rad, settled ones by ${f4(settledMiss)} — want the first plainly wider (> 1.3×)`);
    const ok = fails.length === 0; allPass &&= ok;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — from first sight (reactT ${REACT}, fireCd 0, free, 8.5 m): first round at ${firsts.map(f3).join(' / ')} s (floor ${f3(want)} = ${REACT} + ${G.acquireMin}×${G.settleSecs}); first-round cone ${f4(mean(firstCones))} vs settled ${f4(mean(settledCones))} (×${f2(coneRatio)}); mean miss angle first ${f4(firstMiss)} vs settled ${f4(settledMiss)} rad (${settledCones.length} settled rounds); tracks at the first round ${runs.map(r => f2(r.rounds[0]?.track ?? NaN)).join(' ')}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
    if (!ok && !VERBOSE) console.log('    ' + runs[0].trace.slice(0, 12).join('\n    '));
  }
  // ---- the identity staging (weapons-probes section 3: 6.5 m up the corridor, fireCd 0.3, reactT 0, 45 s) with the man FREE: off = today, on = the model
  {
    const off = await fight(502, { model: false, gPos: [17.5, 0, 11.3], sPos: SAM, secs: 45, fireCd: 0.3, reactT: 0 });
    const on = await fight(502, { model: true, gPos: [17.5, 0, 11.3], sPos: SAM, secs: 45, fireCd: 0.3, reactT: 0 });
    const pin = await fight(502, { model: true, gPos: [17.5, 0, 11.3], sPos: SAM, secs: 45, fireCd: 0.3, reactT: 0, pinned: true });
    const fails: string[] = []; const settleAt65 = G.settleSecs * Math.min(1, Math.max(G.nearK, 6.5 / G.rangeRef));   // (6.5 m is inside rangeRef: the man fills more of the sights, the settle is that much quicker — aim.ts settleTime)
    if (off.exc || on.exc || pin.exc) fails.push('exception: ' + (off.exc || on.exc || pin.exc).split('\n')[0]);
    if (!(on.firstT >= G.acquireMin * settleAt65 - 1.5 * DT)) fails.push(`model on, free: first round at ${f3(on.firstT)} s — under acquireMin·settle(6.5 m) ${f3(G.acquireMin * settleAt65)}`);
    if (on.firstT > G.acquireMin * settleAt65 + 0.2) fails.push(`model on, free: first round only at ${f3(on.firstT)} s (the gate opens at ${f3(G.acquireMin * settleAt65)})`);
    if (!(off.firstT < 0.4)) fails.push(`model off: first round at ${f3(off.firstT)} s (today's is 0.30: fireCd 0.3 and nothing else)`);
    if (Math.abs(pin.firstT - off.firstT) > DT + 1e-9 || pin.rounds.length !== off.rounds.length || pin.hits !== off.hits) fails.push(`pinned under the model (${f3(pin.firstT)} s, ${pin.rounds.length} rounds, ${pin.hits} hits) is not today's man (${f3(off.firstT)} s, ${off.rounds.length}, ${off.hits}) — the tour's posts would drift`);
    const ok = fails.length === 0; allPass &&= ok;
    const line = (r: FightRun, tag: string) => `${tag}: ${r.rounds.length} rounds in 45 s, ${r.hits} found a standing Sam (${r.rounds.length ? Math.round(100 * r.hits / r.rounds.length) : 0} %), first round +${f3(r.firstT)} s, cones ${f4(r.rounds[0]?.cone ?? NaN)} first / ${f4(mean(r.rounds.slice(2).map(x => x.cone)))} after`;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — the weapons-identity staging (6.5 m, gun round in 0.3 s, no beat), the man FREE:\n    BEFORE (model off) ${line(off, 'off')}\n    AFTER  (model on)  ${line(on, 'on ')}\n    (pinned under the model = the identity probe's own man: ${line(pin, 'pin')})${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
  }
  console.log(`=== aim-first: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}

// ================================================================ (c) target motion: standing / across / straight at him
export async function aimMotion() {
  console.log('\n=== aim-motion: a settled planted man (pinned) and a god-mode Sam about 8 m off — standing, sprinting ACROSS his front, running straight AT him: hit fractions across ≤ 0.4 × standing, at him ≥ 0.8 × standing; the three canonical cones before → after ===');
  let allPass = true; const G = AIM.guard;
  // ACROSS: the one clean crossing lane the floor has (found by a sweep of the nav grid for a straight walkable line with an eye-line to every cell of it): the man in
  // the aisle mouth east of the cubicles at (27.5, 17.5) facing east, Sam's line x = 34 through the break room's west side, z 13‥22.5 — 6.5 m off square-on, 8.3
  // at the ends (inside the 9 m he holds and fires from: a free man stays planted). AT HIM / STANDING use the corridor: the man at (10, 11.3) facing east.
  const LAT_G: Vec3 = [27.5, 0, 17.5], LAT_X = 34.0, LAT_Z0 = 13.0, LAT_Z1 = 22.5, EAST = Math.PI / 2;
  const COR_G: Vec3 = [10.0, 0, 11.3], COR_TOP: Vec3 = [18.9, 0, 11.4], COR_GOAL: Vec3 = [14.2, 0, 11.4], COR_STAND: Vec3 = [16.8, 0, 11.4];   // (the run starts just inside the 9 m he holds and fires from — a planted, settled man throughout, so the case differs from standing by the target's motion alone — and the standing reference is at the run's middle range)
  const stage = async (seed: number, model: boolean, gPos: Vec3, sPos: Vec3) => {
    Math.random = seeded(seed);
    const W = await standUp(); const { game, input } = W; const pl = game.player;
    game.godMode = true; game.aiEnabled = true; game.tune.aimModel = model;
    for (let i = 0; i < 5; i++) W.step(DT);
    const [A, B, C] = game.guards; park(B, 1); park(C, 2);
    game.teleportPlayer(v3.copy(sPos)); pl.slot = 'pistol'; pl.holstered = false; pl.crouch = false; pl.pistol.lightOn = false; W.step(DT); pl.visibility = 0.9;
    place(A, gPos, EAST); armAlert(A, game, 0.3, 0, false);   // free: the real fight branch (he holds and fires inside 9 m); settled once he has had his second on Sam
    for (let f = 0; f < 90; f++) { pl.visibility = 0.9; W.step(DT); }   // (a second and a half: lined up before anything is counted, so the three cases differ by the target alone)
    return { W, game, input, pl, A };
  };
  type Case = { rounds: number; hits: number; cones: number[]; brs: number[]; dists: number[]; speeds: number[] };
  const collect = (game: any, pl: any, A: any, K: Case) => { for (const e of game.events) if (e.kind === 'guardShot' && e.time === game.time) { K.rounds++; if (pl.hitFlash > 0.9) K.hits++; const ls = A.aim.lastShot; K.cones.push(ls && ls.t === game.time ? ls.spread : handsCone(game, A, 0)); K.brs.push(A.aim.bearingRate); K.dists.push(v3.distXZ(A.char.pos, pl.char.pos)); K.speeds.push(Math.hypot(pl.char.vel[0], pl.char.vel[2])); } };
  const runCases = async (model: boolean) => {
    const out: Record<string, Case> = {}; let exc = '';
    const traces: string[] = [];
    try {
      // standing square-on at 6.5 m in the crossing lane, 25 s
      { const { W, game, pl, A } = await stage(921, model, LAT_G, [LAT_X, 0, LAT_G[2]]); const K: Case = { rounds: 0, hits: 0, cones: [], brs: [], dists: [], speeds: [] };
        for (let f = 0; f < 60 * 25; f++) { pl.visibility = 0.9; pl.hitFlash = 0; W.step(DT); collect(game, pl, A, K); } out.standing = K; }
      // across: Sam sprints up and down x = LAT_X between LAT_Z0 and LAT_Z1 (the puppet's goal flipped at each end, Shift held), 75 s; rounds with him inside ±3.5 m of square-on count (at the ends he is turning: those are printed apart)
      { const { W, game, input, pl, A } = await stage(922, model, LAT_G, [LAT_X, 0, LAT_Z0]); const K: Case = { rounds: 0, hits: 0, cones: [], brs: [], dists: [], speeds: [] }; const all: Case = { rounds: 0, hits: 0, cones: [], brs: [], dists: [], speeds: [] };
        let goalZ = LAT_Z1; game.puppet = { goal: [LAT_X, 0, goalZ], aim: null }; input.keys.add('ShiftLeft');
        for (let f = 0; f < 60 * 75; f++) {
          pl.visibility = 0.9; pl.hitFlash = 0;
          if (Math.abs(pl.char.pos[2] - goalZ) < 0.6) { goalZ = goalZ > LAT_G[2] ? LAT_Z0 : LAT_Z1; game.puppet.goal = [LAT_X, 0, goalZ]; }
          W.step(DT);
          const near = Math.abs(pl.char.pos[2] - LAT_G[2]) < 3.5; collect(game, pl, A, near ? K : all);
          if (f % 30 === 0) traces.push(`across ${f2(f * DT)}s Sam (${f1(pl.char.pos[0])}, ${f1(pl.char.pos[2])}) ${f1(Math.hypot(pl.char.vel[0], pl.char.vel[2]))} m/s · ${A.state} track ${f2(A.aim.track)} brg ${f2(A.aim.bearingRate)} seen ${f2(game.time - A.lastSeenT)}s fireCd ${f2(A.fireCd)} blockedT ${f2(A.shotBlockedT)} dist ${f1(v3.distXZ(A.char.pos, pl.char.pos))} rounds ${K.rounds}+${all.rounds}`);
        }
        input.keys.delete('ShiftLeft'); game.puppet = null; out.across = K; out.acrossEnds = all; }
      // at him: down the corridor — Sam sprints from 8.9 m straight up the bore to 4 m off him, is put back at the top, again — 45 s; rounds with him between 4.5 and 9 m count
      { const { W, game, input, pl, A } = await stage(923, model, COR_G, COR_TOP); const K: Case = { rounds: 0, hits: 0, cones: [], brs: [], dists: [], speeds: [] };
        game.puppet = { goal: v3.copy(COR_GOAL), aim: null }; input.keys.add('ShiftLeft');
        for (let f = 0; f < 60 * 45; f++) {
          pl.visibility = 0.9; pl.hitFlash = 0;
          if (pl.char.pos[0] < COR_GOAL[0] + 0.6) { game.teleportPlayer(v3.copy(COR_TOP)); A.aim.lastBearing = NaN; A.lastSeenT = game.time; }   // (back to the top of the run: the same line, so spare the model the frame's blip — and his sight, which the teleport's frame would otherwise cost him)
          W.step(DT);
          const d = v3.distXZ(A.char.pos, pl.char.pos); if (d > 4.5 && d < 9) collect(game, pl, A, K);
          if (f % 30 === 0) traces.push(`atHim ${f2(f * DT)}s Sam (${f1(pl.char.pos[0])}, ${f1(pl.char.pos[2])}) ${f1(Math.hypot(pl.char.vel[0], pl.char.vel[2]))} m/s · ${A.state} track ${f2(A.aim.track)} brg ${f2(A.aim.bearingRate)} seen ${f2(game.time - A.lastSeenT)}s fireCd ${f2(A.fireCd)} dist ${f1(d)} rounds ${K.rounds}`);
        }
        input.keys.delete('ShiftLeft'); game.puppet = null; out.atHim = K; }
      // standing at 6.8 m in the corridor too (the at-him case's own reference: the middle of its run)
      { const { W, game, pl, A } = await stage(924, model, COR_G, COR_STAND); const K: Case = { rounds: 0, hits: 0, cones: [], brs: [], dists: [], speeds: [] };
        for (let f = 0; f < 60 * 25; f++) { pl.visibility = 0.9; pl.hitFlash = 0; W.step(DT); collect(game, pl, A, K); } out.standingCor = K; }
    } catch (e: any) { exc = String(e?.stack ?? e); }
    if (VERBOSE) console.log('    ' + traces.join('\n    '));
    return { out, exc, traces };
  };
  const on = await runCases(true), off = await runCases(false);
  const frac = (K?: Case) => K && K.rounds ? K.hits / K.rounds : 0;
  const desc = (K?: Case) => K ? `${K.hits}/${K.rounds} = ${f2(frac(K))} (cone ${f3(mean(K.cones))}, brg ${f2(mean(K.brs))} rad/s, ${f1(mean(K.dists))} m, Sam ${f1(mean(K.speeds))} m/s)` : '—';
  {
    const fails: string[] = []; const O = on.out;
    if (on.exc) fails.push('exception: ' + on.exc.split('\n')[0]);
    for (const k of ['standing', 'across', 'atHim', 'standingCor']) if (!O[k] || O[k].rounds < 12) fails.push(`${k}: only ${O[k]?.rounds ?? 0} rounds counted`);
    if (O.standing && O.across && !(frac(O.across) <= 0.4 * frac(O.standing) + 1e-9)) fails.push(`across: hit fraction ${f2(frac(O.across))} > 0.4 × standing ${f2(frac(O.standing))}`);
    if (O.standingCor && O.atHim && !(frac(O.atHim) >= 0.8 * frac(O.standingCor) - 1e-9)) fails.push(`at him: hit fraction ${f2(frac(O.atHim))} < 0.8 × standing ${f2(frac(O.standingCor))}`);
    if (O.across && !(mean(O.across.brs) > 0.4)) fails.push(`across: mean bearing rate only ${f2(mean(O.across.brs))} rad/s (a 4.7 m/s crossing 6.5 m off is ~0.7 square-on)`);
    if (O.atHim && !(mean(O.atHim.brs) < 0.12)) fails.push(`at him: mean bearing rate ${f2(mean(O.atHim.brs))} rad/s (straight up the bore should be ~0)`);
    if (O.across && !(mean(O.across.speeds) > 3.5)) fails.push(`across: staging — Sam only doing ${f1(mean(O.across.speeds))} m/s`); if (O.atHim && !(mean(O.atHim.speeds) > 3.5)) fails.push(`at him: staging — Sam only doing ${f1(mean(O.atHim.speeds))} m/s`);
    const ok = fails.length === 0; allPass &&= ok;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — model ON: standing 6.5 m ${desc(O.standing)} · ACROSS ${desc(O.across)} (the run's ends, not counted: ${desc(O.acrossEnds)}) · standing 6.8 m corridor ${desc(O.standingCor)} · AT HIM ${desc(O.atHim)}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
    if (!ok && !VERBOSE) console.log('    ' + on.traces.filter((_: string, i: number) => i % 3 === 0).slice(0, 40).join('\n    '));
  }
  {
    const O = off.out; const fails: string[] = []; if (off.exc) fails.push('exception: ' + off.exc.split('\n')[0]);
    const ok = fails.length === 0; allPass &&= ok;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — model OFF (today, for the record): standing 6.5 m ${desc(O.standing)} · across ${desc(O.across)} · standing corridor ${desc(O.standingCor)} · at him ${desc(O.atHim)}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
  }
  // the three canonical cones at exactly 8 m, settled, off the formulas (before = the row's line in fireWeapon; after = aim.ts guardTerms at track 1)
  {
    const S = { base: 0.05, moveK: 0.014, moveCap: 0.06, rangeFrom: 8, rangeK: 0.006 }; const v = 4.7, d = 8;
    const before = { standing: S.base, across: S.base + Math.min(S.moveCap, v * S.moveK), atHim: S.base + Math.min(S.moveCap, v * S.moveK) };
    const after = { standing: S.base, across: S.base + Math.min(G.targetMoveCap, (v / d) * G.targetMoveK), atHim: S.base + 0 };
    const fails: string[] = [];
    if (!(after.across > before.across)) fails.push(`across: after ${f3(after.across)} ≤ before ${f3(before.across)}`); if (!(after.atHim < before.atHim)) fails.push(`at him: after ${f3(after.atHim)} ≥ before ${f3(before.atHim)}`);
    const ok = fails.length === 0; allPass &&= ok;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — canonical cones at 8 m, settled (rad, ± half per axis): standing ${f3(before.standing)} → ${f3(after.standing)} · sprinting across (${v} m/s → ${f2(v / d)} rad/s) ${f3(before.across)} → ${f3(after.across)} · running straight at him ${f3(before.atHim)} → ${f3(after.atHim)}; and unsettled (track 0, first contact) standing ${f3(after.standing * G.unsettledK)}, at the gate (track ${G.acquireMin}) ${f3(after.standing * lerp(G.unsettledK, 1, G.acquireMin))}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
  }
  console.log(`=== aim-motion: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}

// ================================================================ (d) the shooter's own feet: he stops to shoot
export async function aimStop() {
  console.log('\n=== aim-stop: a free man 20 m down the corridor from a lit standing god-mode Sam closes and fires for 25 s — model on: ≥ 80 % of his rounds leave at ≤ stopToShoot m/s (he brakes for each), the cone at the chase\'s pace ≥ 2× a planted one\'s; model off (control): rounds on the run ===');
  let allPass = true; const G = AIM.guard;
  const SAM: Vec3 = [30.0, 0, 11.4], GRD: Vec3 = [10.0, 0, 11.3];
  const on = await fight(931, { model: true, gPos: GRD, sPos: SAM, secs: 25, fireCd: 0.3, reactT: 0.35 });
  const off = await fight(931, { model: false, gPos: GRD, sPos: SAM, secs: 25, fireCd: 0.3, reactT: 0.35 });
  {
    const fails: string[] = []; const R = on;
    if (R.exc) fails.push('exception: ' + R.exc.split('\n')[0]);
    const slow = R.rounds.filter(r => r.speed <= G.stopToShoot + 1e-6).length; const fracSlow = R.rounds.length ? slow / R.rounds.length : 0;
    if (R.rounds.length < 6) fails.push(`only ${R.rounds.length} rounds in 25 s`); if (fracSlow < 0.8) fails.push(`only ${Math.round(fracSlow * 100)} % of his rounds left at ≤ ${G.stopToShoot} m/s`);
    const closing = R.rounds.filter(r => r.dist > 9.2); if (closing.length < 2) fails.push(`only ${closing.length} rounds while still closing (> 9 m): he never shot on the way in`);
    const endDist = R.rounds.length ? R.rounds[R.rounds.length - 1].dist : NaN; if (!(endDist <= 9.5)) fails.push(`his last round came from ${f1(endDist)} m — he never closed to his 9 m`);
    // the composition: cone at 2.7 m/s vs planted, same track / range (the unit's numbers, asked of the live man's state)
    const ok = fails.length === 0; allPass &&= ok;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — model ON: ${R.rounds.length} rounds, first +${f2(R.firstT)} s; speed at each [${R.rounds.map(r => f2(r.speed)).join(' ')}] m/s → ${slow}/${R.rounds.length} at ≤ ${G.stopToShoot}; from [${R.rounds.map(r => f1(r.dist)).join(' ')}] m; tracks [${R.rounds.map(r => f2(r.track)).join(' ')}]; cones [${R.rounds.map(r => f3(r.cone)).join(' ')}]; ${R.hits} found Sam${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
    if (!ok && !VERBOSE) console.log('    ' + R.trace.filter((_, i) => i % 2 === 0).slice(0, 40).join('\n    '));
  }
  {
    const fails: string[] = []; const R = off;
    if (R.exc) fails.push('exception: ' + R.exc.split('\n')[0]);
    const running = R.rounds.filter(r => r.speed > G.stopToShoot).length;
    if (R.rounds.length < 6) fails.push(`control: only ${R.rounds.length} rounds`); if (running < 2) fails.push(`control: only ${running} rounds on the run — today's man fires while closing; the staging is not showing it`);
    const ok = fails.length === 0; allPass &&= ok;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — model OFF (control): ${R.rounds.length} rounds, first +${f2(R.firstT)} s; speed at each [${R.rounds.map(r => f2(r.speed)).join(' ')}] → ${running} on the run; from [${R.rounds.map(r => f1(r.dist)).join(' ')}] m; ${R.hits} found Sam${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
  }
  {   // the composition alone: a planted settled man vs the same man at the chase's pace (2.7 m/s), 12 m off
    Math.random = seeded(932); const W = await standUp(); const { game } = W; game.tune.aimModel = true; for (let i = 0; i < 3; i++) W.step(DT);
    const [A, B, C] = game.guards; park(B, 1); park(C, 2); game.teleportPlayer([26.0, 0, 11.4]); place(A, [14.0, 0, 11.3], Math.PI / 2); armAlert(A, game, 0.3, 0, false); W.step(DT);
    A.aim.track = 1; A.aim.bearingRate = 0; A.aim.speedSm = 0; A.char.vel = [0, 0, 0]; const planted = handsCone(game, A, 0); A.char.vel = [2.7, 0, 0]; const running = handsCone(game, A, 0); A.char.vel = [0, 0, 0];
    const fails: string[] = []; if (!(running >= 2 * planted)) fails.push(`running cone ${f4(running)} < 2× planted ${f4(planted)}`);
    const ok = fails.length === 0; allPass &&= ok;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — the composition at 12 m, settled: planted ${f4(planted)} rad · at the chase's 2.7 m/s ${f4(running)} (×${f2(running / planted)}) — and on the move his track is capped at ${G.movingTrackCap} < the gate's ${G.acquireMin}: nothing aimed leaves a running man at all${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
  }
  console.log(`=== aim-stop: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}

// ================================================================ (e) Sam: the sprint stop
export async function aimPlayer() {
  console.log('\n=== aim-player: ten clicked rounds at the corridor wall ~12 m off straight after a sprint stop vs after 1.5 s standing still — scatter ratio ≥ 1.8; the cone per round ===');
  let allPass = true; const Y = AIM.player;
  const FROM: Vec3 = [24.0, 0, 11.4], WALL: Vec3 = [36.0, 1.25, 11.4], RUNUP: Vec3 = [16.0, 0, 11.4];   // west → east up the corridor to FROM, the wall point 12 m on east at chest height
  const runOne = async (label: string, sprint: boolean, model = true) => {
    Math.random = seeded(941);
    const W = await standUp(); const { game, input } = W; const pl = game.player;
    game.godMode = true; game.tune.aimModel = model; for (let i = 0; i < 5; i++) W.step(DT);
    game.guards.forEach((gd: any, i: number) => park(gd, i));
    game.teleportPlayer(v3.copy(sprint ? RUNUP : FROM)); pl.slot = 'pistol'; pl.holstered = false; pl.crouch = false; pl.pistol.lightOn = false; game.infiniteAmmo = true;
    W.cam.yaw = -Math.PI / 2; W.cam.rebuild?.();
    for (let f = 0; f < 90; f++) W.step(DT);   // (the camera over him, the draw done)
    let stopF = -1;
    if (sprint) {   // the puppet runs him east at a sprint to FROM; the frame he is there the puppet lets go (samAim is dead-on under it) and the clicks begin
      game.puppet = { goal: v3.copy(FROM), aim: v3.copy(WALL) }; input.keys.add('ShiftLeft');
      for (let f = 0; f < 60 * 5; f++) { W.step(DT); if (v3.distXZ(pl.char.pos, FROM) < 0.35) { stopF = f; break; } }
      input.keys.delete('ShiftLeft'); game.puppet = null;
    } else { for (let f = 0; f < 90; f++) { W.cursorAt(WALL); W.step(DT); } }   // 1.5 s standing still with the point under the cursor
    const speedAtStop = Math.hypot(pl.char.vel[0], pl.char.vel[2]); const trackAtStop = pl.aim.track;
    const rounds: { miss: number; cone: number; track: number; own: number; t: number }[] = []; let fired = 0, snapped = 0; const t0 = game.time;
    for (let f = 0; f < 60 * 4 && rounds.length < 10; f++) {
      const onScr = W.cursorAt(WALL);
      if (f % 14 === 0 && onScr) input.clicked |= 1;
      W.step(DT);
      // each round against the line it was SENT down (player.ts: muzzle → the cursor's world point + 3 cm, this frame's game.aimPoint) — pure cone, whatever the camera and his sliding feet do to where that point is between rounds
      for (const e of game.events) if (e.kind === 'shot' && e.time === game.time && e.from && e.to && e.weapon) {
        fired++; if (game.aimGuard || game.aimTarget) snapped++;
        const ap = game.aimPoint; const sent = v3.normalize(v3.sub([ap[0], ap[1] + 0.03, ap[2]], e.from)), flew = v3.normalize(v3.sub(e.to, e.from));
        const ls = pl.aim.lastShot; rounds.push({ miss: Math.acos(Math.max(-1, Math.min(1, v3.dot(sent, flew)))), cone: ls && ls.t === game.time ? ls.spread : 0, track: ls && ls.t === game.time ? ls.track : pl.aim.track, own: ls && ls.t === game.time ? ls.own : 0, t: game.time - t0 });
      }
    }
    const rms = Math.sqrt(mean(rounds.map(r => r.miss * r.miss)));
    return { label, rounds, rms, fired, speedAtStop, trackAtStop, stopF, aimGuard: snapped > 0 };
  };
  const still = await runOne('1.5 s still', false), sprint = await runOne('sprint stop', true), offSprint = await runOne('sprint stop, model off', true, false);
  const fails: string[] = [];
  for (const r of [still, sprint, offSprint]) { if (r.rounds.length < 10) fails.push(`${r.label}: only ${r.rounds.length} rounds recorded (${r.fired} fired)`); if (r.aimGuard) fails.push(`${r.label}: staging — the reticle snapped to a man`); }
  if (sprint.stopF < 0) fails.push('sprint: never reached the stop');
  const ratio = sprint.rms / Math.max(1e-6, still.rms);
  if (!(ratio >= 1.8)) fails.push(`scatter after the sprint ${f4(sprint.rms)} rad RMS is only ${f2(ratio)}× the still ${f4(still.rms)} (want ≥ 1.8)`);
  const wantStill = Y.baseStand / Math.sqrt(6); if (still.rms > 2.5 * wantStill + 0.002) fails.push(`still scatter ${f4(still.rms)} — over 2.5× the settled cone's ${f4(wantStill)}`); if (still.rms < 0.25 * wantStill) fails.push(`still scatter ${f4(still.rms)} — the settled cone (${Y.baseStand} rad) is not reaching the rounds`);
  if (offSprint.rms > 0.003) fails.push(`model off: scattered ${f4(offSprint.rms)} after the sprint (want dead-on)`);
  if (!(sprint.trackAtStop <= Y.walkCap + 1e-9)) fails.push(`track at the sprint's end ${f2(sprint.trackAtStop)} (a sprint caps it at ${Y.sprintCap}, the last strides at ${Y.walkCap})`);
  const ok = fails.length === 0; allPass &&= ok;
  const rline = (r: any) => `${r.label}: RMS ${f4(r.rms)} rad over ${r.rounds.length} rounds; cones [${r.rounds.map((x: any) => f3(x.cone)).join(' ')}]; tracks [${r.rounds.map((x: any) => f2(x.track)).join(' ')}]; feet [${r.rounds.map((x: any) => f3(x.own)).join(' ')}]${r.stopF >= 0 ? `; stopped at f${r.stopF} doing ${f2(r.speedAtStop)} m/s, track ${f2(r.trackAtStop)}` : ''}`;
  console.log(`- ${ok ? 'PASS' : 'FAIL'} — ratio ${f2(ratio)}×\n    ${rline(still)}\n    ${rline(sprint)}\n    ${rline(offSprint)}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
  console.log(`=== aim-player: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}

// ================================================================ (f) off = today
export async function aimOff() {
  console.log('\n=== aim-off: tune.aimModel = false — tracks rest at 0 through a live fight, the gate open, guardRound = { spread } as it was (no steady), samAim 0, no braking, no ◎; weapons-identity (same families) is the frozen card ===');
  Math.random = seeded(951);
  const W = await standUp(); const { game } = W; const pl = game.player;
  game.godMode = true; game.aiEnabled = true; game.tune.aimModel = false;
  for (let i = 0; i < 5; i++) W.step(DT);
  const [A, B, C] = game.guards; park(B, 1); park(C, 2);
  game.teleportPlayer([30.0, 0, 11.4]); pl.slot = 'pistol'; pl.holstered = false; W.step(DT); pl.visibility = 0.9;
  place(A, [12.0, 0, 11.3], Math.PI / 2); armAlert(A, game, 0.3, 0.35, false);
  const fails: string[] = []; let maxTrack = 0, maxPl = 0, brakes = 0, marks = 0, rounds = 0, running = 0, steadyLeaks = 0;
  for (let f = 0; f < 60 * 15; f++) {
    pl.visibility = 0.9; W.step(DT);
    maxTrack = Math.max(maxTrack, A.aim.track); maxPl = Math.max(maxPl, pl.aim.track); if (A.aim.braking) brakes++; if (guardAcquired(game, A)) marks++;
    for (const e of game.events) if (e.kind === 'guardShot' && e.time === game.time) { rounds++; if (Math.hypot(A.char.vel[0], A.char.vel[2]) > AIM.guard.stopToShoot) running++; if (A.aim.lastShot) steadyLeaks++; }
  }
  const r = guardRound(game, A, 0.03); const ready = (A.aim.track = 0, aimReady(game, A)); const brk = aimBrake(game, A, 12, false); const sa = samAim(game); const pa = playerAim(game);
  if (maxTrack !== 0 || maxPl !== 0) fails.push(`tracks moved with the model off: guard ${maxTrack}, Sam ${maxPl}`);
  if (brakes || marks) fails.push(`braked ${brakes} frames / ◎ ${marks} frames with the model off`);
  if (JSON.stringify(r) !== JSON.stringify({ spread: 0.03 })) fails.push(`guardRound gave ${JSON.stringify(r)} (want {"spread":0.03})`);
  if (!ready || brk || sa !== 0 || pa.spread !== 0 || pa.track !== 1) fails.push(`aimReady ${ready} / aimBrake ${brk} / samAim ${sa} / playerAim ${JSON.stringify(pa)}`);
  if (steadyLeaks) fails.push(`${steadyLeaks} round(s) stamped aim.lastShot with the model off`);
  if (rounds < 6) fails.push(`only ${rounds} rounds in 15 s from 18 m closing`); if (running < 1) fails.push('not one round on the run — today\'s man fires while closing');
  const ok = fails.length === 0;
  console.log(`- ${ok ? 'PASS' : 'FAIL'} — 15 s of a free man closing from 18 m: ${rounds} rounds (${running} on the run), max track guard ${maxTrack} / Sam ${maxPl}, brake frames ${brakes}, ◎ frames ${marks}; guardRound → ${JSON.stringify(r)}, aimReady(track 0) ${ready}, aimBrake ${brk}, samAim ${sa}, playerAim ${JSON.stringify(pa)}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
  console.log(`=== aim-off: ${ok ? 'ALL PASS' : 'FAILURES above'} ===`);
  return ok;
}

// ================================================================ (g) what the reticle takes: a light only on its dot, a man beside one
export async function aimSnap() {
  console.log('\n=== aim-snap: the reticle takes a light only with the cursor on it (its dot ± lightSnapPx, or its own drawn box) — swept over every aimable light in view, against the reach it had (60 px); a man under a ceiling panel\'s picture, the cursor beside him and nearer the panel\'s dot: he is taken and the round drops him; a light taken is kept while the camera settles ===');
  const L0: number = Aim.AIM_DEFAULTS.player.lightSnapPx, SNAP: number = Aim.SNAP_PX; let allPass = true;   // (the SHIPPED reach: the harness itself stands at SNAP — src/host/standup.ts)
  const stage = async (seed: number, at: Vec3, reach: number) => {
    Math.random = seeded(seed); const W = await standUp(); const { game, input, cam, canvas } = W; AIM.player.lightSnapPx = reach;
    game.godMode = true; game.player.visibility = 0; for (let i = 0; i < 5; i++) W.step(DT);
    game.guards.forEach((gd: any, i: number) => park(gd, i));
    const pl = game.player; game.teleportPlayer(at); pl.slot = 'pistol'; pl.holstered = false; pl.crouch = false;
    input.mouseX = 800; input.mouseY = 500; for (let i = 0; i < 90; i++) W.step(DT);   // the camera settled on him
    const px = (p: Vec3) => cam.project(p, canvas.clientWidth, canvas.clientHeight);
    /** the reticle's answer for the cursor at (x, y) with the camera where it stands and nothing kept from the frame before */
    const takes = (x: number, y: number) => { input.mouseX = x; input.mouseY = y; game.aimTarget = null; updateAim(game, input, cam, canvas); return game.aimTarget; };
    return { W, game, input, cam, canvas, pl, px, takes };
  };
  try {
    { // ---- the sweep: the camera still, the cursor on rings round each light's dot
      const { game, input, px, takes } = await stage(941, [8.4, 0, 21.2], L0); const fails: string[] = [];
      const lights = game.targets.filter((t: any) => t.interactive && !t.broken).map((t: any) => ({ t, at: px(t.pos) })).filter((x: any) => x.at[2] && x.at[0] > 80 && x.at[0] < 1520 && x.at[1] > 80 && x.at[1] < 920);
      const radii = [0, L0 - 2, L0 + 2, Math.round((L0 + SNAP) / 2), SNAP - 2];
      const sweep = (reach: number) => {
        AIM.player.lightSnapPx = reach; const took = radii.map(() => 0), any = radii.map(() => 0), tried = radii.map(() => 0); let ceiling = 0;
        for (const { t, at } of lights) radii.forEach((r, k) => { for (let a = 0; a < (r ? 8 : 1); a++) {
          const got = takes(at[0] + r * Math.cos(a * Math.PI / 4), at[1] + r * Math.sin(a * Math.PI / 4)); tried[k]++;
          if (got === t) took[k]++; if (got) any[k]++; if (got && game.aimPoint[1] > 2.5) ceiling++;
          if (got) { const q = px(got.pos), d = Math.hypot(q[0] - input.mouseX, q[1] - input.mouseY); if (d >= reach + 1e-6) fails.push(`reach ${reach}: took ${got.name} from ${f1(d)} px off its dot`); }
          else if (r < reach - 1e-6 && !game.aimGuard) fails.push(`reach ${reach}: nothing taken ${r} px off ${t.name}'s dot`);
        } });
        return { took, any, tried, ceiling };
      };
      const now = sweep(L0), was = sweep(SNAP);
      const row = (R: ReturnType<typeof sweep>) => radii.map((r, k) => `${r} px ${R.took[k]}/${R.tried[k]}${R.any[k] > R.took[k] ? ` (+${R.any[k] - R.took[k]} a neighbour's nearer dot)` : ''}`).join(' · ');
      if (lights.length < 3) fails.push(`staging: only ${lights.length} aimable lights in the lobby view`);
      if (now.any[0] !== now.tried[0] || now.any[1] !== now.tried[1]) fails.push('on / just inside the dot a light was not taken'); if (now.took[2] + now.took[3] + now.took[4] !== 0) fails.push('a light taken from outside lightSnapPx');
      if (was.any[3] !== was.tried[3]) fails.push(`the knob at ${SNAP} does not give the old reach back (${radii[3]} px: a light taken ${was.any[3]}/${was.tried[3]})`);
      allPass = verdict(!fails.length, `${lights.length} aimable lights in the lobby view (none of them drawn: ceiling panels, a beacon), the cursor on rings round each dot: taken on the dot and at ${radii[1]} px, never at ${radii[2]} / ${radii[3]} / ${radii[4]} px — and the knob back at ${SNAP} takes them from there as it did`, fails.slice(0, 4).join('; ') || `lightSnapPx ${L0}: ${row(now)} (the gun at the ceiling on ${now.ceiling} of ${now.tried.reduce((a, b) => a + b, 0)} cursor spots) · at ${SNAP}: ${row(was)} (${was.ceiling})`) && allPass;
    }
    // ---- the man under a panel's picture: his chest L0 + 42 px to the side of the panel's dot, the cursor between them L0 + 8 px from the dot (beside him, not on him)
    const man = async (reach: number) => {
      const { W, game, input, cam, canvas, pl, px } = await stage(942, [8.6, 0, 23.3], reach); const A = game.guards[0]; const dDot = L0 + 8;
      const panel = game.targets.filter((t: any) => t.interactive && /^panel_/.test(t.name)).sort((a: any, b: any) => v3.distXZ(a.pos, pl.char.pos) - v3.distXZ(b.pos, pl.char.pos))[0];
      const chest = (): Vec3 => A.char.bones.chest ?? v3.add(A.char.pos, [0, 1.2, 0]);
      const spot = (): Vec3 => { const q = px(panel.pos); const r = cam.ray((q[0] - (L0 + 42)) / canvas.clientWidth, q[1] / canvas.clientHeight); const t = (1.2 - r.ro[1]) / r.rd[1]; return [r.ro[0] + r.rd[0] * t, 0, r.ro[2] + r.rd[2] * t]; };
      for (let k = 0; k < 4; k++) { const want = spot(), c = chest(); place(A, [A.char.pos[0] + want[0] - (k ? c[0] : A.char.pos[0]), 0, A.char.pos[2] + want[2] - (k ? c[2] : A.char.pos[2])], Math.PI); park2(A); W.step(DT); }   // (his chest bone, not his feet, onto the spot)
      let onHim = 0, onPanel = 0, onBody = 0, n = 0, dChest = 0;
      const frame = (click: boolean, count = true) => { const q = px(panel.pos), c = px(chest()); input.mouseX = q[0] - dDot; input.mouseY = q[1];
        const r = cam.ray(input.mouseX / canvas.clientWidth, input.mouseY / canvas.clientHeight);
        if (count) { dChest = Math.hypot(c[0] - input.mouseX, c[1] - input.mouseY); if (A.char.rayHit(r.ro, r.rd, 1e9) >= 0) onBody++; }
        if (click) input.clicked |= 1; W.step(DT); if (count) { n++; if (game.aimGuard === A) onHim++; if (game.aimTarget === panel) onPanel++; } };
      for (let i = 0; i < 60; i++) frame(false);   // (a second for his hands to settle on what the reticle has)
      const t0 = game.time; let shot: any = null; const seen = () => { shot ??= game.events.find((e: any) => e.kind === 'shot' && e.who === pl.char.id && e.time >= t0); };
      frame(true); seen(); for (let i = 0; i < 20; i++) { frame(false, false); seen(); }   // (the round away; what the reticle does over a body afterwards is not counted)
      return { panel: panel.name, onHim, onPanel, onBody, n, dDot, dChest, clear: !game.col.segmentBlocked(v3.add(pl.char.pos, [0, 1.3, 0]), chest()), dead: A.state === 'dead', toY: shot?.to ? shot.to[1] : NaN, fired: !!shot, range: v3.distXZ(pl.char.pos, A.char.pos) };
    };
    { const now = await man(L0), was = await man(SNAP); const fails: string[] = [];
      if (!now.clear || now.onBody || now.dChest < now.dDot + 8 || now.dChest > SNAP - 8) fails.push(`staging: line clear ${now.clear}, cursor on his body ${now.onBody} frames, ${f1(now.dChest)} px off his chest / ${now.dDot} off the dot`);
      if (now.onHim !== now.n || now.onPanel) fails.push(`the reticle on him ${now.onHim}/${now.n} frames, on the panel ${now.onPanel}`); if (!now.fired || !now.dead) fails.push(`fired ${now.fired}, he is ${now.dead ? 'down' : 'standing'} (the round ended at y ${f2(now.toY)})`);
      if (was.onPanel !== was.n || was.dead || !(was.toY > 2.5)) fails.push(`the control at ${SNAP} px: the panel had the reticle ${was.onPanel}/${was.n} frames, he is ${was.dead ? 'down' : 'standing'}, the round ended at y ${f2(was.toY)} (want the old miss into the ceiling)`);
      allPass = verdict(!fails.length, `a man ${f1(now.range)} m off under ${now.panel}'s picture, the cursor beside him — ${f1(now.dChest)} px from his chest, ${now.dDot} from the panel's dot: the reticle is on him every frame and the round drops him; with the reach back at ${SNAP} the panel takes it and the round goes into the ceiling`, fails.join('; ') || `lightSnapPx ${L0}: on him ${now.onHim}/${now.n}, down ${now.dead} (round to y ${f2(now.toY)}) · at ${SNAP}: on the panel ${was.onPanel}/${was.n}, down ${was.dead} (round to y ${f2(was.toY)})`) && allPass;
    }
    { // ---- kept while the camera settles: the cursor flicked onto a panel's dot and LEFT there — the aim point going up to the panel pans the picture under it
      const { W, game, input, pl, px } = await stage(943, [8.6, 0, 23.3], L0); const fails: string[] = [];
      const panel = game.targets.filter((t: any) => t.interactive && /^panel_/.test(t.name)).sort((a: any, b: any) => v3.distXZ(a.pos, pl.char.pos) - v3.distXZ(b.pos, pl.char.pos))[0];
      panel.on = true; W.step(DT);   // (the lobby's panels are switched off at night: lit, so the OCP below has something to put out)
      const q0 = px(panel.pos); input.mouseX = q0[0]; input.mouseY = q0[1]; let had = 0, drift = 0; const N = 90;
      const off = () => { const q = px(panel.pos); return Math.hypot(q[0] - input.mouseX, q[1] - input.mouseY); };
      for (let i = 0; i < N; i++) { W.step(DT); if (game.aimTarget === panel) had++; drift = Math.max(drift, off()); }
      pl.ocp.charge = 1; input.clicked |= 4; W.step(DT); const zapped = panel.disabledUntil > game.time;   // the right button a second and a half after landing on it
      const q = px(panel.pos), d = off() || 1; input.mouseX += (input.mouseX - q[0]) / d * (L0 + 6); input.mouseY += (input.mouseY - q[1]) / d * (L0 + 6); W.step(DT); const let_go = game.aimTarget !== panel;   // the cursor moved off, away from the dot
      if (had !== N) fails.push(`the panel had the reticle ${had}/${N} frames with the cursor left on the spot`); if (!zapped) fails.push('the right button then did not OCP it'); if (!let_go) fails.push(`the cursor moved ${L0 + 6} px further off and the panel still has the reticle`);
      if (drift >= SNAP) fails.push(`staging: the dot slid ${f1(drift)} px — past the men's reach, nothing holds that`);
      allPass = verdict(!fails.length, `the cursor put on ${panel.name}'s dot and left there: the camera's lead slides the dot ${f1(drift)} px from under it (reach ${L0}) and the panel keeps the reticle all ${N} frames, the right button OCPs it; the cursor moved ${L0 + 6} px further off lets it go at once`, fails.join('; ') || `kept ${had}/${N} · drift ${f1(drift)} px · OCP ${zapped} · let go ${let_go}`) && allPass;
    }
    { // ---- a DRAWN fixture is taken by pointing at it anywhere: the vending front, well off its dot
      const { game, input, px, takes } = await stage(944, [29.4, 0, 16.2], L0); const fails: string[] = [];
      const v = game.targets.find((t: any) => t.name === 'vending'), b = W0(game).statics[v.boxes[0]];
      const on: Vec3 = [b.c[0] + b.h[0] * 0.6, b.c[1] + b.h[1], b.c[2] + b.h[2] * 0.6], q = px(on), dot = px(v.pos); const dOn = Math.hypot(q[0] - dot[0], q[1] - dot[1]);
      const got = takes(q[0], q[1]); const beside = takes(dot[0], dot[1] - (dOn + 40));   // on its top face; then the same distance and more off the dot, past the box
      if (!q[2] || dOn <= L0 + 2 || dOn >= SNAP) fails.push(`staging: the point on its top is ${f1(dOn)} px off the dot`); if (got !== v) fails.push(`the cursor on the machine ${f1(dOn)} px off its dot took ${got?.name ?? 'nothing'}`); if (beside === v) fails.push('taken from off the box');
      void input;
      allPass = verdict(!fails.length, `the cursor ON the vending machine ${f1(dOn)} px off its dot takes it (it is drawn: pointing at it is pointing at it); off the box it does not`, fails.join('; ') || `on it: ${got?.name} · off it: ${beside?.name ?? 'nothing'}`) && allPass;
    }
  } finally { AIM.player.lightSnapPx = L0; }
  console.log(`=== aim-snap: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}
const W0 = (game: any) => game.engine.world;
/** held where he stands, deaf and blind (park() without the move to the lot) */
function park2(gd: any) { gd.hold = true; gd.pinned = true; gd.heardUpTo = 1e12; gd.dazzledUntil = 1e9; gd.state = 'patrol'; gd.awareness = 0; }
