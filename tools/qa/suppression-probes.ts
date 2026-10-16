// The 'suppression' probe family (run through probes.ts: `bun run tools/qa/probes.ts suppression | sup-math | sup-pin | sup-sam | sup-hostage [--verbose]`):
// lane R3 of docs/internal/sc20k-design.md §4 — one scalar per living character raised by the rounds fireWeapon traces passing or striking close to him
// (suppression.ts noteRound), halving every 1.1 s, and what the guards do under it (flinch / head down / shift to cover, all behind tune.suppression) plus the
// one mechanical thing it does to Sam in this lane (his rounds open up).
//   sup-math     the model driven with synthetic segments: passes at 0.5 / 1.5 / 2.5 m and impacts at 0.5 / 2.0 / 3.0 m match the formula to 1e-6, ordered, and
//                nothing beyond the radii; the shooter, the man the round went into, a held man and a dead one accrue nothing; a round whose closest approach lies
//                inside minTravel of the muzzle adds nothing, one from further does; the half-life; the clamp; temperament; the diminished accrual with the head down;
//                Sam accrues by the same rule.
//   sup-pin      staged, twice — flag on, then the control with tune.suppression = false: Kowalski alert 8.8 m down the cubicle aisle from a lit god-mode Sam, Novak
//                alert in the cross-aisle; Sam puts six rounds past Kowalski's head, then keeps one going past every 0.4 s. ON: his scalar crosses 0.6 inside the six,
//                he is crouched with the gun down within 0.5 s of it, not one round leaves him while his head is down, one line from the suppression pool, and after
//                4 s of it he shifts ≥ 1.5 m to a spot with cover from Sam (crouched-chest hidden) and gets there; OFF: the scalar still crosses 0.6 (it is physics)
//                but he never crouches, never says any of it, never shifts, and fires several rounds at his weapon's cadence.
//   sup-sam      (1) Kowalski planted 16 m up the corridor firing at a lit god-mode Sam for 8 s: the rounds that MISS raise Sam's scalar (peak ≥ 0.25), the ones that
//                find him add nothing (he is shot, not suppressed); (2) ten rounds through the real click path at the wall in front of him: dead-on at s 0 (angular
//                RMS muzzle → impact < 0.003), opened up at s 0.8 (RMS > 0.01 ≈ samSpread·0.8/√6), and dead-on again with the flag off or under the tour's puppet
//                (tune.aimModel pinned off for these four: the aim model's own settled cone is measured by the aim family, aim-probes.ts).
//   sup-hostage  the break-room hold (standoff-probes' staging, gun variant), Kowalski + Reyes in the standoff in front: Sam fires past their heads for 10 s — both
//                pinned, both crouch, both stay in the standoff, and with muzzle discipline on NOT ONE round comes back (suppression never makes a man fire).
//                Staged with the gun-hold rule OFF on either stand (gunhold.ts GUNHOLD.on, set after the stand-up): with it on the men in front of the gun do not
//                stay in the ring to be pinned — they run for cover and go round — and what they do then is tools/qa/gunhold-check.ts's to hold.
import { standUp, ROOT } from './headless.ts';
import { stageHold, bringIn, bearingPoint, place, park } from './standoff-probes.ts';
const { v3, DEG } = await import(`${ROOT}/src/math/vec.ts`);
const { fireWeapon } = await import(`${ROOT}/src/game/combat.ts`);
const { resetChase, pairOf } = await import(`${ROOT}/src/game/guards.ts`);
const { SUPPRESSION, noteRound, suppressionLines, SUPPRESSION_DEBUG } = await import(`${ROOT}/src/game/suppression.ts`);
const { TEMPERAMENT } = await import(`${ROOT}/src/game/game.ts`);
const { GUNHOLD } = await import(`${ROOT}/src/game/gunhold.ts`);

type Vec3 = [number, number, number];
const DT = 1 / 60;
const VERBOSE = process.argv.includes('--verbose');
const f1 = (x: number) => x.toFixed(1), f2 = (x: number) => x.toFixed(2), f3 = (x: number) => x.toFixed(3);
const posS = (p: Vec3 | null | undefined) => p ? `(${f1(p[0])}, ${f1(p[2])})` : '—';
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const chest = (c: any): Vec3 => c.bones.chest ?? v3.add(c.pos, [0, 1.1, 0]);
const head = (c: any): Vec3 => c.bones.head ?? v3.add(c.pos, [0, 1.6, 0]);
/** alert on Sam where he stands, licensed (a sighting this frame), no CONTACT beat, the gun coming round in `fireCd`, every chase clock zeroed, free (not the tour's pinned) */
function armAlert(gd: any, game: any, fireCd = 0.3) { gd.hold = false; gd.pinned = false; gd.dazzledUntil = -1; gd.state = 'alert'; gd.awareness = 1; gd.reactT = 0; gd.fireCd = fireCd; gd.weapon.rearm(); gd.reloadT = -1; gd.lastKnown = v3.copy(game.player.char.pos); gd.lastSeenT = game.time; gd.sightT = game.time; gd.ledT = game.time; resetChase(gd); }
const POOL = new Set<string>([...suppressionLines(), 'he\'s got us pinned!', 'they\'ve got us pinned!']);
function verdict(ok: boolean, label: string, detail: string) { console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}: ${detail}`); return ok; }

// ================================================================ (a) the model, driven
export async function supMath() {
  console.log('\n=== sup-math: the scalar off synthetic segments — passes / impacts against the formula, the exclusions (shooter, the man hit, held, dead, inside minTravel), half-life, clamp, temperament, head-down accrual, Sam by the same rule ===');
  Math.random = seeded(701);
  const W = await standUp(); const { game } = W; const S = SUPPRESSION;
  game.godMode = true; game.aiEnabled = true; game.player.visibility = 0.02;
  for (let i = 0; i < 5; i++) W.step(DT);
  const [A, B, C] = game.guards;   // Kowalski (steady ×1) is the subject; Novak (nervy) and Reyes (hard) for the temperament check; B's Character is the shooter
  for (const gd of game.guards) { gd.hold = true; gd.pinned = true; gd.heardUpTo = 1e12; }   // nobody walks off or listens: this is arithmetic
  place(A, [21.0, 0, 17.9], -Math.PI / 2); place(B, [26.5, 0, 13.2], Math.PI); place(C, [14.0, 0, 13.3], 0);
  A.hold = B.hold = C.hold = true; A.pinned = B.pinned = C.pinned = true;
  game.teleportPlayer([8.0, 0, 11.3]); W.step(DT); W.step(DT);
  let allPass = true; const fails: string[] = []; const rows: string[] = [];
  const shooter = game.player.char;   // Sam's rounds on them (× 1); a colleague's are × friendlyK — checked on its own below
  const near = (d: number) => S.wNear * Math.max(0, 1 - d / S.nearR), hitT = (d: number) => S.wHit * Math.max(0, 1 - d / S.hitR);
  /** one synthetic round FROM `from` TO `to` (nobody hit unless said), everybody's scalar zeroed first; returns what it added to `sub` */
  const shot = (sub: any, from: Vec3, to: Vec3, hit: any = null) => { for (const gd of game.guards) { gd.sup.v = 0; gd.sup.kick = 0; } game.player.sup.v = 0; noteRound(game, shooter, from, to, hit); return sub.sup.v; };
  const CA = chest(A.char);
  // passes: a level segment from 10 m west of his chest to 10 m east of it, offset sideways (z) by d — closest approach d at s* = 10
  for (const d of [0.5, 1.5, 2.5]) {
    const from: Vec3 = [CA[0] - 10, CA[1], CA[2] + d], to: Vec3 = [CA[0] + 10, CA[1], CA[2] + d];
    const got = shot(A, from, to); const want = near(d) + hitT(v3.dist(to, CA));
    rows.push(`pass ${d} m → +${f3(got)} (formula ${f3(want)})`); if (Math.abs(got - want) > 1e-6) fails.push(`pass at ${d} m added ${got} (formula ${want})`);
  }
  { const p05 = shot(A, [CA[0] - 10, CA[1], CA[2] + 0.5], [CA[0] + 10, CA[1], CA[2] + 0.5]), p15 = shot(A, [CA[0] - 10, CA[1], CA[2] + 1.5], [CA[0] + 10, CA[1], CA[2] + 1.5]), p25 = shot(A, [CA[0] - 10, CA[1], CA[2] + 2.5], [CA[0] + 10, CA[1], CA[2] + 2.5]);
    if (!(p05 > p15 && p15 > 0 && p25 === 0)) fails.push(`passes not ordered / not zero beyond nearR: 0.5 → ${p05}, 1.5 → ${p15}, 2.5 → ${p25}`); }
  // impacts: from 10 m west, stopping d metres short of (west of) his chest — closest approach = the impact
  for (const d of [0.5, 2.0, 3.0]) {
    const from: Vec3 = [CA[0] - 10, CA[1], CA[2]], to: Vec3 = [CA[0] - d, CA[1], CA[2]];
    const got = shot(A, from, to); const want = near(d) + hitT(d);
    rows.push(`impact ${d} m short → +${f3(got)} (formula ${f3(want)})`); if (Math.abs(got - want) > 1e-6) fails.push(`impact at ${d} m added ${got} (formula ${want})`);
    if (d === 3.0 && got !== 0) fails.push(`an impact 3 m off still added ${got}`);
  }
  // the doc's worked case: two rounds into 'the jamb' 0.6 m off his chest ≈ pinned; one ≈ a flinch
  { const from: Vec3 = [CA[0] - 10, CA[1], CA[2] + 0.6], to: Vec3 = [CA[0], CA[1], CA[2] + 0.6]; const one = shot(A, from, to); noteRound(game, shooter, from, to, null); const two = A.sup.v;
    rows.push(`the jamb 0.6 m off: one round ${f3(one)} (flinch ≥ ${S.flinch}: ${one >= S.flinch}), two ${f3(two)} (pinned ≥ ${S.pinned}: ${two >= S.pinned})`);
    if (!(one >= S.flinch && one < S.pinned && two >= S.pinned)) fails.push(`the worked case: one round ${one}, two ${two} (want flinch, then pinned)`); }
  // exclusions
  { const from: Vec3 = [CA[0] - 10, CA[1], CA[2] + 0.4], to: Vec3 = [CA[0] + 10, CA[1], CA[2] + 0.4];
    for (const gd of game.guards) gd.sup.v = 0; noteRound(game, A.char, from, to, null); const self = A.sup.v;   // his own round (from wherever): nothing
    for (const gd of game.guards) gd.sup.v = 0; noteRound(game, B.char, from, to, null); const friendly = A.sup.v; const bySam = shot(A, from, to);   // a colleague's round past him: × friendlyK of what Sam's does
    rows.push(`a colleague's round: +${f3(friendly)} vs Sam's +${f3(bySam)} (× ${S.friendlyK})`); if (Math.abs(friendly - bySam * S.friendlyK) > 1e-6) fails.push(`a colleague's round added ${friendly} ≠ ${bySam}×${S.friendlyK}`);
    const asHit = shot(A, from, [CA[0], CA[1], CA[2]], A.char);                                            // the round went INTO him: shot, not suppressed
    A.held = { by: 'player', since: game.time, variant: 'arm', phase: 'held', reverse: false }; const heldV = shot(A, from, to); A.held = null;   // in Sam's arm: nothing
    const closeFrom: Vec3 = [CA[0] - 2.5, CA[1], CA[2] + 0.3], closeTo: Vec3 = [CA[0] + 10, CA[1], CA[2] + 0.3]; const tooClose = shot(A, closeFrom, closeTo);   // closest approach 2.5 m out of the muzzle (< minTravel): nothing
    const farFrom: Vec3 = [CA[0] - 4.0, CA[1], CA[2] + 0.3]; const farEnough = shot(A, farFrom, closeTo);                                                     // 4 m out: counts
    rows.push(`exclusions: own round ${self}, the man hit ${asHit}, held ${heldV}, s* 2.5 m (< minTravel ${S.minTravel}) ${tooClose}, s* 4.0 m ${f3(farEnough)}`);
    if (self !== 0) fails.push(`his own round added ${self}`); if (asHit !== 0) fails.push(`the man the round went into accrued ${asHit}`); if (heldV !== 0) fails.push(`a held man accrued ${heldV}`);
    if (tooClose !== 0) fails.push(`a round whose closest approach was 2.5 m out of the muzzle added ${tooClose} (minTravel ${S.minTravel})`); if (!(farEnough > 0.2)) fails.push(`a round from 4 m out passing at 0.3 m added only ${farEnough}`); }
  // temperament: the same round of Sam's (0.5 m past the chest, from 10 m off) for each man — × his keen
  { const one = (gd: any) => { const Cg = chest(gd.char); for (const x of game.guards) x.sup.v = 0; noteRound(game, shooter, [Cg[0] - 10, Cg[1], Cg[2] + 0.5], [Cg[0] + 10, Cg[1], Cg[2] + 0.5], null); return gd.sup.v; };
    const a = one(A), b = one(B), c = one(C); const kb = S.keen[TEMPERAMENT[B.callsign]] ?? 1, kc = S.keen[TEMPERAMENT[C.callsign]] ?? 1;
    rows.push(`temperament: ${A.callsign} (${TEMPERAMENT[A.callsign]}) ${f3(a)} · ${B.callsign} (${TEMPERAMENT[B.callsign]}, ×${kb}) ${f3(b)} · ${C.callsign} (${TEMPERAMENT[C.callsign]}, ×${kc}) ${f3(c)}`);
    if (!(kb !== 1 || kc !== 1)) fails.push('staging: neither of the other two has a keen ≠ 1 (TEMPERAMENT changed?)');
    if (Math.abs(b - a * kb) > 1e-6) fails.push(`${B.callsign}'s accrual ${b} ≠ ${a}×${kb}`); if (Math.abs(c - a * kc) > 1e-6) fails.push(`${C.callsign}'s accrual ${c} ≠ ${a}×${kc}`); }
  // head already down: × downAccrual
  { const from: Vec3 = [CA[0] - 10, CA[1], CA[2] + 0.5], to: Vec3 = [CA[0] + 10, CA[1], CA[2] + 0.5]; const up = shot(A, from, to); A.sup.latched = true; const down = shot(A, from, to); A.sup.latched = false;
    rows.push(`head down: +${f3(down)} vs +${f3(up)} up (× ${S.downAccrual})`); if (Math.abs(down - up * S.downAccrual) > 1e-6) fails.push(`head-down accrual ${down} ≠ ${up}×${S.downAccrual}`); }
  // clamp: a dozen close rounds never take it past the cap
  { const from: Vec3 = [CA[0] - 10, CA[1], CA[2] + 0.2], to: Vec3 = [CA[0] + 10, CA[1], CA[2] + 0.2]; shot(A, from, to); for (let i = 0; i < 12; i++) noteRound(game, shooter, from, to, null);
    rows.push(`clamp: 13 rounds at 0.2 m → ${f3(A.sup.v)} (cap ${S.cap})`); if (A.sup.v > S.cap + 1e-9 || !Number.isFinite(A.sup.v)) fails.push(`13 close rounds took it to ${A.sup.v} (cap ${S.cap})`); }
  // Sam by the same rule (keen 1, no friendly factor): a guard's round past HIS chest
  { const CS = chest(game.player.char); const from: Vec3 = [CS[0] + 10, CS[1], CS[2] + 0.5], to: Vec3 = [CS[0] - 10, CS[1], CS[2] + 0.5]; game.player.sup.v = 0; noteRound(game, B.char, from, to, null); const got = game.player.sup.v, want = near(0.5) + hitT(v3.dist(to, CS));
    rows.push(`Sam: pass 0.5 m → +${f3(got)} (formula ${f3(want)}), .suppression getter ${f3(game.player.suppression)}`); if (Math.abs(got - want) > 1e-6) fails.push(`Sam accrued ${got} (formula ${want})`); if (game.player.suppression !== got) fails.push('Player.suppression getter does not read sup.v'); }
  // half-life: from 1.0, no rounds, 1.1 s of frames → 0.5 (± a frame's worth); the kick drains fast; dead men are zeroed
  { for (const gd of game.guards) gd.sup.v = 0; A.sup.v = 1; A.sup.kick = 0.5; game.player.sup.v = 1; const n = Math.round(S.halfLife / DT); for (let i = 0; i < n; i++) W.step(DT);
    const k1 = Math.pow(2, -DT / S.halfLife); rows.push(`half-life: 1.0 → ${f3(A.sup.v)} after ${n} frames (${f2(n * DT)} s), Sam 1.0 → ${f3(game.player.sup.v)}, kick 0.5 → ${f3(A.sup.kick)}`);
    if (Math.abs(A.sup.v - 0.5) > 1 - k1 + 1e-6) fails.push(`decayed to ${A.sup.v} in ${n} frames (want 0.5 ± ${(1 - k1).toFixed(4)})`); if (Math.abs(game.player.sup.v - 0.5) > 1 - k1 + 1e-6) fails.push(`Sam decayed to ${game.player.sup.v}`); if (A.sup.kick > 0.01) fails.push(`kick still ${A.sup.kick} after 1.1 s`);
    C.sup.v = 0.7; C.state = 'dead'; W.step(DT); const deadV = C.sup.v; rows.push(`dead: 0.7 → ${deadV} the next frame`); if (deadV !== 0) fails.push(`a dead man kept ${deadV}`); }
  allPass = verdict(fails.length === 0, 'the model', `\n    ${rows.join('\n    ')}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`) && allPass;
  console.log(`=== sup-math: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}

// ================================================================ (b) staged: a man pinned down the aisle, then shifted
const SAM_AISLE: Vec3 = [17.2, 0, 17.9], A_POST: Vec3 = [26.0, 0, 17.9], B_POST: Vec3 = [19.75, 0, 21.0];   // the cubicle farm's main aisle (z ≈ 18): Sam at its west end, Kowalski 8.8 m east (inside the 9 m he holds and fires from), Novak in the south cross-aisle 4 m off Sam
async function stageAisle(seed: number, flagOn: boolean) {
  Math.random = seeded(seed);
  const W = await standUp(); const { game } = W;
  game.godMode = true; game.aiEnabled = true; game.tune.suppression = flagOn;
  for (let i = 0; i < 5; i++) W.step(DT);
  const [A, B, C] = game.guards; park(C, 2);
  const pl = game.player; game.teleportPlayer(v3.copy(SAM_AISLE)); pl.slot = 'pistol'; pl.holstered = false; pl.crouch = false; pl.pistol.lightOn = false;
  pl.char.bodyYaw = pl.char.aimYaw = Math.PI / 2; W.step(DT); W.step(DT); pl.visibility = 0.9;
  place(A, A_POST, -Math.PI / 2); place(B, B_POST, Math.atan2(SAM_AISLE[0] - B_POST[0], SAM_AISLE[2] - B_POST[2]));
  A.heardUpTo = B.heardUpTo = 1e12;   // (deaf: the shots' hearing events would only re-alert alert men; nothing here is about ears)
  armAlert(A, game, 0.3); armAlert(B, game, 0.5);
  const lines: { t: number; who: string; text: string; radio: boolean }[] = []; const origSay = game.say.bind(game);
  game.say = (gd: any, text: string, radio = false) => { lines.push({ t: game.time, who: gd.callsign, text, radio }); return origSay(gd, text, radio); };
  const dbg: string[] = []; SUPPRESSION_DEBUG.log = VERBOSE ? (s: string) => dbg.push(`${f2(game.time)} ${s}`) : null;
  return { W, game, A, B, pl, lines, dbg };
}
/** Sam's synthetic round past A's head: `side` metres square off the Sam→him line (level) from his body AXIS (the pelvis: a man jogging bent low carries his head a
 *  foot ahead of it, and a round 'beside the head' on the trailing side is a round in the ribs), at a hand under head height — it flies on to whatever stops it */
function pastHead(game: any, A: any, side: number) {
  const pc = game.player.char; const h = head(A.char); const ax = A.char.bones.hips ?? A.char.pos; const m = pc.muzzle;
  const dx = ax[0] - m[0], dz = ax[2] - m[2]; const L = Math.hypot(dx, dz) || 1; const px = -dz / L, pz = dx / L;
  fireWeapon(game, pc, [ax[0] + px * side, h[1] - 0.08, ax[2] + pz * side], true);
}
interface PinRun { crossT: number; crossRound: number; crouchT: number; poseT: number; duckT: number; alive: boolean; downShots: number; shots: number[]; poolLines: { t: number; text: string }[]; otherLines: string[]; displaceT: number; cover: Vec3 | null; coverDist: number; coverHidden: boolean; reachedT: number; minToCover: number; endPos: Vec3; maxStep: number; peak: number; samPeak: number; bShots: number; exc: string; crouchFrames: number; trace: string[]; }
async function pinRun(flagOn: boolean): Promise<PinRun> {
  const { W, game, A, B, pl, lines, dbg } = await stageAisle(flagOn ? 721 : 722, flagOn);   // (different seeds are fine: the control's expectations are qualitative)
  const R: PinRun = { crossT: -1, crossRound: -1, crouchT: -1, poseT: -1, duckT: -1, alive: true, downShots: 0, shots: [], poolLines: [], otherLines: [], displaceT: -1, cover: null, coverDist: 0, coverHidden: false, reachedT: -1, minToCover: Infinity, endPos: [0, 0, 0], maxStep: 0, peak: 0, samPeak: 0, bShots: 0, exc: '', crouchFrames: 0, trace: [] };
  const t0 = game.time; let rounds = 0, nextVolley = 0, nextKeep = 1.6; let prev = v3.copy(A.char.pos); const post = v3.copy(A.char.pos);
  try {
    for (let f = 0; f < 60 * 11; f++) {
      const t = game.time - t0;
      pl.visibility = 0.9; A.lastSeenT = B.lastSeenT = game.time; A.lastKnown = v3.copy(pl.char.pos); B.lastKnown = v3.copy(pl.char.pos);   // (eyes on him throughout: this is about what the rounds do to a man IN a fight, not about finding Sam)
      if (rounds < 6 && t >= nextVolley) { pastHead(game, A, rounds % 2 ? 0.45 : -0.45); rounds++; nextVolley = t + 0.22; }          // the six, at the Five-seveN's cadence, either side of his head
      else if (rounds >= 6 && t < 7.5 && t >= nextKeep) { pastHead(game, A, rounds % 2 ? 0.5 : -0.5); rounds++; nextKeep = t + 0.4; }   // then one every 0.4 s to keep his head down (until 7.5 s: after that he is left alone)
      const vBefore = A.sup.v;
      W.step(DT);
      const S = A.sup; R.peak = Math.max(R.peak, S.v); R.samPeak = Math.max(R.samPeak, pl.sup.v);
      if (R.crossT < 0 && S.v >= SUPPRESSION.pinned) { R.crossT = game.time - t0; R.crossRound = rounds; }
      const an = A.char.anim; const down = S.downT > 0 || S.latched;
      if (an.crouchTarget >= 0.99) R.crouchFrames++;
      if (R.crossT >= 0 && R.crouchT < 0 && an.crouchTarget >= 0.99) R.crouchT = game.time - t0;
      if (R.crossT >= 0 && R.poseT < 0 && an.crouch >= 0.9) R.poseT = game.time - t0;   // (the pose itself follows the target at damp 10: all the way down ~0.25 s on)
      if (R.crossT >= 0 && R.duckT < 0 && an.upper === 'none' && an.stance === 'lowReady') R.duckT = game.time - t0;
      if (A.state === 'dead') R.alive = false;
      for (const e of game.events) if (e.kind === 'guardShot' && e.time === game.time) { if (v3.distXZ(e.pos, A.char.pos) < 0.05) { R.shots.push(game.time - t0); if (down && flagOn) R.downShots++; } else if (v3.distXZ(e.pos, B.char.pos) < 0.05) R.bShots++; }
      if (S.cover && R.displaceT < 0) { R.displaceT = game.time - t0; R.cover = v3.copy(S.cover); R.coverDist = v3.distXZ(S.cover, post); R.coverHidden = game.col.segmentBlocked([pl.char.pos[0], 1.15, pl.char.pos[2]], [S.cover[0], 0.9, S.cover[2]]); }
      if (R.cover) { const d = v3.distXZ(A.char.pos, R.cover); R.minToCover = Math.min(R.minToCover, d); if (R.reachedT < 0 && !S.cover && d < 0.8) R.reachedT = game.time - t0; }
      R.maxStep = Math.max(R.maxStep, v3.distXZ(prev, A.char.pos)); prev = v3.copy(A.char.pos);
      if (f % 30 === 0 || (S.v >= SUPPRESSION.pinned) !== (vBefore >= SUPPRESSION.pinned)) R.trace.push(`${f2(game.time - t0)}s A sup ${f2(S.v)} ${S.cover ? 'SHIFT→' + posS(S.cover) : down ? `DOWN ${f1(S.downT)}s pinnedT ${f1(S.pinnedT)}` : S.v >= SUPPRESSION.flinch ? 'flinch' : '-'} pos ${posS(A.char.pos)} crouch ${f2(an.crouch)}/${an.crouchTarget} ${an.upper}/${an.stance} fireCd ${f2(A.fireCd)} state ${A.state} seen ${f2(game.time - A.lastSeenT)}s · B sup ${f2(B.sup.v)} · Sam sup ${f2(pl.sup.v)} · rounds ${rounds}`);
    }
  } catch (e: any) { R.exc = String(e?.stack ?? e); }
  R.endPos = v3.copy(A.char.pos);
  for (const l of lines) { if (l.who !== A.callsign && l.who !== B.callsign) continue; if (POOL.has(l.text)) R.poolLines.push({ t: l.t - t0, text: `${l.who}: ${l.text}` }); else R.otherLines.push(`${f1(l.t - t0)}s ${l.who}: ${l.text}`); }
  if (VERBOSE) { console.log('    ' + R.trace.join('\n    ')); if (dbg.length) console.log('    debug: ' + dbg.slice(0, 80).join('\n    debug: ')); }
  SUPPRESSION_DEBUG.log = null;
  return R;
}
export async function supPin() {
  console.log('\n=== sup-pin: Kowalski alert 8.8 m down the cubicle aisle, Sam (god, lit) puts six past his head then one every 0.4 s — ON: pinned inside the six, crouched + gun down within 0.5 s, silent while down, one line from the pool, shifted ≥ 1.5 m to cover after 4 s; OFF (control): the number moves, the man does not ===');
  let allPass = true;
  const on = await pinRun(true), off = await pinRun(false);
  const gaps = (s: number[]) => s.slice(1).map((x, i) => f2(x - s[i])).join(' ');
  {
    const R = on; const fails: string[] = [];
    if (R.exc) fails.push('exception: ' + R.exc.split('\n')[0]);
    if (!R.alive) fails.push('staging: Kowalski died — one of the rounds "past" him found him');
    if (R.crossT < 0) fails.push(`his scalar never reached ${SUPPRESSION.pinned} (peak ${f2(R.peak)})`); else if (R.crossRound > 6) fails.push(`pinned only on round ${R.crossRound} (want inside the six)`);
    if (R.crossT >= 0 && (R.crouchT < 0 || R.crouchT - R.crossT > 0.5)) fails.push(`crouched ${R.crouchT < 0 ? 'never' : f2(R.crouchT - R.crossT) + ' s after crossing'} (want ≤ 0.5 s)`);
    if (R.crossT >= 0 && (R.duckT < 0 || R.duckT - R.crossT > 0.5)) fails.push(`gun lowered (upper none + low ready) ${R.duckT < 0 ? 'never' : f2(R.duckT - R.crossT) + ' s after crossing'}`);
    if (R.downShots) fails.push(`${R.downShots} round(s) left him while his head was down`);
    if (R.shots.length >= off.shots.length && off.shots.length > 0) fails.push(`fired ${R.shots.length} rounds pinned vs ${off.shots.length} in the control (want fewer)`);
    if (R.poolLines.length < 1) fails.push('not one line from the suppression pool'); if (R.poolLines.filter(l => l.t < 6).length > 2) fails.push(`${R.poolLines.filter(l => l.t < 6).length} suppression lines inside 6 s (want the one, two at most: the clocks)`);
    if (R.displaceT < 0) fails.push(`never shifted (pinnedT needs ${SUPPRESSION.displaceAfter} s head-down running)`);
    else { if (R.displaceT < 3.9) fails.push(`shifted at +${f2(R.displaceT)} s — before ${SUPPRESSION.displaceAfter} s of it`); if (R.coverDist < 1.5) fails.push(`the cover spot is only ${f2(R.coverDist)} m from his post (want ≥ 1.5)`); if (!R.coverHidden) fails.push(`the cover spot ${posS(R.cover)} is open to Sam at crouched-chest height`); if (R.reachedT < 0) fails.push(`never got to it (nearest ${f2(R.minToCover)} m)`); }
    if (R.maxStep > 0.3) fails.push(`moved ${f2(R.maxStep)} m in one frame`);
    const ok = fails.length === 0; allPass &&= ok;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — ON: pinned +${f2(R.crossT)} s (round ${R.crossRound}, peak ${f2(R.peak)}); crouch ordered +${R.crouchT >= 0 ? f2(R.crouchT - R.crossT) : '—'} s / gun down +${R.duckT >= 0 ? f2(R.duckT - R.crossT) : '—'} s / all the way down +${R.poseT >= 0 ? f2(R.poseT - R.crossT) : '—'} s after; his rounds ${R.shots.length} [${R.shots.map(f2).join(' ')}] (${R.downShots} while down); lines: ${R.poolLines.map(l => `${f1(l.t)}s ${l.text}`).join(' · ') || '—'}; shift +${R.displaceT >= 0 ? f2(R.displaceT) : '—'} s → ${posS(R.cover)} ${f2(R.coverDist)} m off his post, hidden ${R.coverHidden}, reached +${R.reachedT >= 0 ? f2(R.reachedT) : '—'} s (nearest ${f2(R.minToCover)} m), ended at ${posS(R.endPos)}; Novak's rounds ${R.bShots}; Sam's own scalar peaked ${f2(R.samPeak)} under their fire${R.otherLines.length ? `\n    other lines: ${R.otherLines.slice(0, 6).join(' · ')}` : ''}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
    if (!ok && !VERBOSE) console.log('    ' + R.trace.join('\n    '));
  }
  {
    const R = off; const fails: string[] = [];
    if (R.exc) fails.push('exception: ' + R.exc.split('\n')[0]);
    if (!R.alive) fails.push('staging: Kowalski died — one of the rounds "past" him found him');
    if (R.crossT < 0) fails.push(`flag off: the scalar never reached ${SUPPRESSION.pinned} either (peak ${f2(R.peak)}) — it is physics, it must`);
    if (R.crouchFrames) fails.push(`flag off: crouched on ${R.crouchFrames} frame(s)`);
    if (R.poolLines.length) fails.push(`flag off: said ${R.poolLines.map(l => `"${l.text}"`).join(', ')}`);
    if (R.displaceT >= 0) fails.push('flag off: shifted to cover');
    if (R.shots.length < 4) fails.push(`flag off: only ${R.shots.length} rounds in 11 s with eyes on a lit Sam 8.8 m off (want ≥ 4 at the 9 mm's cadence)`);
    const ok = fails.length === 0; allPass &&= ok;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — OFF (control): scalar peak ${f2(R.peak)} (crossed +${R.crossT >= 0 ? f2(R.crossT) : '—'} s); crouch frames ${R.crouchFrames}; his rounds ${R.shots.length} [${R.shots.map(f2).join(' ')}] gaps [${gaps(R.shots)}] vs ON [${gaps(on.shots)}]; pool lines ${R.poolLines.length}; shifts ${R.displaceT >= 0 ? 1 : 0}; ended at ${posS(R.endPos)}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
    if (!ok && !VERBOSE) console.log('    ' + R.trace.join('\n    '));
  }
  console.log(`=== sup-pin: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}

// ================================================================ (c) Sam: raised by their misses, opening his rounds up
export async function supSam() {
  console.log('\n=== sup-sam: (1) a guard\'s misses down 16 m of corridor raise Sam\'s scalar, his hits do not; (2) ten clicked rounds at the wall in front of him: dead-on at s 0, opened up at s 0.8, dead-on again with the flag off / under the puppet ===');
  let allPass = true;
  // ---- (1)
  {
    Math.random = seeded(731);
    const W = await standUp(); const { game } = W; const pl0 = game.player;
    game.godMode = true; game.aiEnabled = true;
    for (let i = 0; i < 5; i++) W.step(DT);
    const [A, B, C] = game.guards; park(B, 1); park(C, 2);
    game.teleportPlayer([26.0, 0, 11.4]); pl0.slot = 'pistol'; pl0.holstered = false; pl0.crouch = false; W.step(DT); W.step(DT); pl0.visibility = 0.9;
    place(A, [10.0, 0, 11.3], Math.PI / 2); A.heardUpTo = 1e12; armAlert(A, game, 0.3); A.pinned = true;   // (planted: at 16 m he would otherwise close to 9 first)
    let peak = 0, rounds = 0, hits = 0, misses = 0, addOnHit = 0, exc = ''; const adds: string[] = [];
    try {
      for (let f = 0; f < 60 * 8; f++) {
        pl0.visibility = 0.9; A.lastSeenT = game.time; A.lastKnown = v3.copy(pl0.char.pos);
        const before = pl0.sup.v; pl0.hitFlash = 0;   // (set to 1 by a round that finds him, eased down at the end of the same update: anything over 0.9 after the step is a hit this frame)
        W.step(DT);
        const shot = game.events.some((e: any) => e.kind === 'guardShot' && e.time === game.time);
        if (shot) { rounds++; const hit = pl0.hitFlash > 0.9; if (hit) { hits++; if (pl0.sup.v > before * Math.pow(2, -DT / SUPPRESSION.halfLife) + 1e-9) addOnHit++; } else { misses++; adds.push(f3(pl0.sup.lastAdd)); } }
        peak = Math.max(peak, pl0.sup.v);
      }
    } catch (e: any) { exc = String(e?.stack ?? e); }
    const fails: string[] = [];
    if (exc) fails.push('exception: ' + exc.split('\n')[0]);
    if (rounds < 5) fails.push(`only ${rounds} rounds from him in 8 s`); if (!misses) fails.push('every round found Sam — nothing to measure (spread at 16 m should miss most)');
    if (peak < 0.25) fails.push(`Sam's scalar peaked at ${f2(peak)} under ${misses} misses (want ≥ 0.25)`);
    if (addOnHit) fails.push(`${addOnHit} round(s) that HIT Sam also raised his scalar (the man hit is shot, not suppressed)`);
    const ok = fails.length === 0; allPass &&= ok;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — (1) ${rounds} rounds at 16 m: ${hits} found him (added nothing: ${addOnHit === 0}), ${misses} went past (adds ${adds.slice(0, 8).join(' ')}${adds.length > 8 ? ' …' : ''}) → Sam's scalar peaked ${f2(peak)}, .suppression now ${f2(pl0.suppression)}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
  }
  // ---- (2) dispersion through the real click path
  {
    const FROM: Vec3 = [21.5, 0, 11.5], WALL: Vec3 = [21.5, 1.2, 10.0];   // the weapons probe's own staging: the corridor's north wall 1.5 m in front of him, plainly under the cursor from the camera (a far point down the corridor is roofed over from where the camera sits, and the cursor's ray lands on whatever is between) — the DIRECTION muzzle → impact is what is measured, so the range does not matter
    const runOne = async (label: string, sup: number, cfg: (game: any) => void) => {
      Math.random = seeded(741);
      const W = await standUp(); const { game, input } = W; const pl = game.player;
      game.godMode = true; game.tune.aimModel = false; for (let i = 0; i < 5; i++) W.step(DT);   // (the aim model off: its settled cone — aim.ts AIM.player.baseStand, ± a third of a degree — is the aim family's to measure; this is suppression's term alone, dead-on under it at rest)
      game.guards.forEach((gd: any, i: number) => park(gd, i));
      game.teleportPlayer(v3.copy(FROM)); pl.slot = 'pistol'; pl.holstered = false; pl.crouch = false; pl.pistol.lightOn = false; game.infiniteAmmo = true;
      W.cam.yaw = 0; W.cam.rebuild?.(); cfg(game);
      for (let f = 0; f < 120; f++) { if (game.puppet) game.puppet.aim = v3.copy(WALL); else W.cursorAt(WALL); W.step(DT); }   // (two seconds for the follow camera to come over him and settle: the cursor's world point is only the wall once the wall is squarely on the screen)
      const onScreen = game.puppet ? true : W.cursorAt(WALL);
      const log: any[] = []; W.audioLog = log; const hits: Vec3[] = []; const aims: Vec3[] = []; let fired = 0, range = 0;
      for (let f = 0; f < 60 * 5 && hits.length < 10; f++) {
        if (game.puppet) { game.puppet.aim = v3.copy(WALL); } else W.cursorAt(WALL);
        pl.sup.v = sup;   // (held there: what a burst into his cover a moment ago left him with)
        if (f % 16 === 0) input.clicked |= 1;
        const n0 = log.length; W.step(DT);
        let m: Vec3 | null = null; for (let i = n0; i < log.length; i++) { const a = log[i]; if (a.name === 'pistolSuppressed' && a.pos) { m = a.pos; fired++; aims.push(v3.copy(game.aimPoint)); } if (a.name === 'bulletImpact' && a.pos && m) { hits.push(v3.copy(a.pos)); range += v3.dist(a.pos, m); } }
      }
      W.audioLog = null; range /= Math.max(1, hits.length);
      // the scatter of the IMPACTS about their mean, over the range, as an angle: a round sent dead-on lands on the very point clicked whatever the muzzle was doing
      // (the arm coming up into the aim, the kick of the round before), so at rest this is zero to the float; a cone shows as impacts strewn about the point
      let mean: Vec3 = [0, 0, 0]; for (const h of hits) mean = v3.add(mean, h); mean = v3.scale(mean, 1 / Math.max(1, hits.length));
      const off = hits.map(h => v3.dist(h, mean)); const rms = Math.sqrt(off.reduce((s, a) => s + a * a, 0) / Math.max(1, off.length)) / Math.max(0.1, range);
      let aimWander = 0; for (const a of aims) aimWander = Math.max(aimWander, v3.dist(a, aims[0]));   // (staging check: the point clicked on must hold still, or the scatter is the camera's)
      return { label, sup, fired, n: hits.length, rms, max: Math.max(0, ...off) / Math.max(0.1, range), onScreen, aimWander, range };
    };
    const rest = await runOne('s 0', 0, () => {}), hot = await runOne('s 0.8', 0.8, () => {}), flagOff = await runOne('s 0.8, flag off', 0.8, g => { g.tune.suppression = false; }), puppet = await runOne('s 0.8, puppet', 0.8, g => { g.puppet = { goal: null, aim: v3.copy(WALL) }; });
    const want = SUPPRESSION.samSpread * 0.8 / Math.sqrt(6);   // per-axis uniform ± spread/2 on two axes across the line → RMS angle ≈ spread·√(2/12)
    const fails: string[] = [];
    for (const r of [rest, hot, flagOff, puppet]) { if (r.n < 8) fails.push(`${r.label}: only ${r.n} impacts recorded of ${r.fired} rounds`); if (!r.onScreen) fails.push(`${r.label}: staging — the wall point is not on the screen for the cursor`); if (r.aimWander > 0.02) fails.push(`${r.label}: staging — the aim point wandered ${f3(r.aimWander)} m between rounds (the camera, not the gun)`); }
    if (rest.rms > 0.003) fails.push(`at rest the rounds scatter ${f3(rest.rms)} rad RMS (want dead-on, < 0.003)`);
    if (hot.rms < 0.01) fails.push(`at s 0.8 the rounds scatter only ${f3(hot.rms)} rad RMS (want ≥ 0.01; formula ≈ ${f3(want)})`); if (hot.rms > 3 * want) fails.push(`at s 0.8 the scatter ${f3(hot.rms)} is over 3× the formula's ${f3(want)}`);
    if (flagOff.rms > 0.003) fails.push(`flag off: still scattered ${f3(flagOff.rms)} at s 0.8`); if (puppet.rms > 0.003) fails.push(`under the puppet: scattered ${f3(puppet.rms)} at s 0.8 (the tour's double-taps must land)`);
    const ok = fails.length === 0; allPass &&= ok;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — (2) scatter of ten clicked rounds' impacts about the point clicked, over the ${f2(rest.range)} m, as an angle: ${[rest, hot, flagOff, puppet].map(r => `${r.label}: RMS ${f3(r.rms)} max ${f3(r.max)} rad (${r.n}/${r.fired}, aim wander ${f3(r.aimWander)} m)`).join(' · ')}; formula at 0.8 ≈ ${f3(want)} rad${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
  }
  console.log(`=== sup-sam: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}

// ================================================================ (d) the hold: pinned watchers still never fire
export async function supHostage() {
  console.log('\n=== sup-hostage: Sam holds Novak in the break room (gun to his head), Kowalski + Reyes in the standoff in front; Sam fires past THEIR heads for 10 s, the gun-hold rule off — both pinned, both crouch, both stay in it, and with muzzle discipline on not one round comes back ===');
  let allPass = true;
  const AT: Vec3 = [33.0, 0, 17.8], FACE = 190;
  const S = await stageHold(751, 1, AT, FACE * DEG, true, true); const { W, game, victim, lines } = S as any;
  const rule = GUNHOLD.on; GUNHOLD.on = false;   // after the stand-up (which writes the stand's own value): suppression in the ring standoff is the subject, and the ring in front of a drawn pistol exists only without the rule
  const A = game.guards[0], C = game.guards[2]; const men = [A, C];
  const P0 = pairOf(game); if (!P0) { GUNHOLD.on = rule; console.log('- FAIL — staging: no pair (the grab did not take)'); console.log('=== sup-hostage: FAILURES above ==='); return false; }
  const centre = v3.copy(P0.centre);
  bringIn(game, A, bearingPoint(centre, FACE + 18, 4.7), centre); bringIn(game, C, bearingPoint(centre, FACE - 22, 4.9), centre);
  const t0 = game.time; let exc = '', holdEnded = ''; let guardShots = 0, samRounds = 0, nextShot = 1.5, k = 0;
  const dbg: string[] = []; SUPPRESSION_DEBUG.log = VERBOSE ? (s: string) => dbg.push(`${f2(game.time - t0)} ${s}`) : null;
  const st = new Map<any, { enterT: number; pinnedT: number; crouchT: number; soFrames: number; frames: number; peak: number; downFrames: number }>(men.map(m => [m, { enterT: -1, pinnedT: -1, crouchT: -1, soFrames: 0, frames: 0, peak: 0, downFrames: 0 }]));
  const log: string[] = [];
  try {
    for (let f = 0; f < 60 * 12; f++) {
      const t = game.time - t0;
      if (t >= nextShot && t < 11.5) {   // a round past EACH of them — 0.45 m square off his body axis at a hand under head height (pastHead's rule: beside the head of a man leaning into his aim is in his ribs) — every 0.45 s from 1.5 s (they have entered and had their beat by then)
        for (const m of men) { if (m.state === 'dead') continue; const h = head(m.char); const ax = m.char.bones.hips ?? m.char.pos; const mu = game.player.char.muzzle; const dx = ax[0] - mu[0], dz = ax[2] - mu[2]; const L = Math.hypot(dx, dz) || 1; const sg = (k++ % 2) ? 1 : -1;
          fireWeapon(game, game.player.char, [ax[0] - dz / L * 0.45 * sg, h[1] - 0.08, ax[2] + dx / L * 0.45 * sg], true); samRounds++; }
        nextShot = t + 0.45;
      }
      W.step(DT);
      const P = pairOf(game); if (!P) { holdEnded = `${f2(game.time - t0)}s: victim ${victim.state}/${victim.downKind ?? '-'}, holding ${game.player.holding?.phase ?? 'null'}, Sam down ${game.player.down}`; break; }
      guardShots += game.events.filter((e: any) => e.kind === 'guardShot' && e.time === game.time).length;
      for (const m of men) { const T = st.get(m)!; if (m.standoff && T.enterT < 0) T.enterT = game.time - t0; if (T.enterT < 0 || m.state === 'dead') continue; T.frames++; if (m.standoff) T.soFrames++; T.peak = Math.max(T.peak, m.sup.v); if (T.pinnedT < 0 && m.sup.v >= SUPPRESSION.pinned) T.pinnedT = game.time - t0; if (m.sup.downT > 0 || m.sup.latched) T.downFrames++; if (T.crouchT < 0 && m.char.anim.crouchTarget >= 0.99) T.crouchT = game.time - t0; }
      if (f % 60 === 0) log.push(`${f2(game.time - t0)}s ${men.map(m => `${m.callsign} ${m.state}${m.standoff ? '/so' : ''} sup ${f2(m.sup.v)}${m.sup.latched || m.sup.downT > 0 ? ' DOWN' : ''}${m.sup.cover ? ' SHIFT' : ''} crouch ${f2(m.char.anim.crouch)} ${m.char.anim.upper}/${m.char.anim.stance} fireCd ${f2(m.fireCd)}`).join(' · ')} · Sam sup ${f2(game.player.sup.v)} · ${victim.callsign} ${victim.state}${victim.held ? '/held' : ''} sup ${f2(victim.sup.v)}`);
    }
  } catch (e: any) { exc = String(e?.stack ?? e); }
  game.puppet = null; SUPPRESSION_DEBUG.log = null; GUNHOLD.on = rule;
  if (VERBOSE && dbg.length) console.log('    debug: ' + dbg.filter(s => !/round by/.test(s)).slice(0, 40).join('\n    debug: '));
  const fails: string[] = [];
  if (exc) fails.push('exception: ' + exc.split('\n')[0]);
  if (holdEnded) fails.push('the hold ended: ' + holdEnded);
  if (guardShots) fails.push(`${guardShots} guard round(s) with ${victim.callsign} alive in Sam's arm — suppression made somebody fire, or broke the discipline`);
  if (samRounds < 30) fails.push(`Sam only got ${samRounds} rounds off`);
  for (const m of men) { const T = st.get(m)!;
    if (m.state === 'dead') fails.push(`staging: ${m.callsign} died (${m.downKind}/${m.downBy}) — a round "past" him found him`);
    if (m.sup.displaces) fails.push(`${m.callsign} shifted to cover ${m.sup.displaces}× — a man in the standoff stays in it`);
    if (T.enterT < 0) { fails.push(`${m.callsign} never entered the standoff`); continue; }
    if (T.pinnedT < 0) fails.push(`${m.callsign}'s scalar never reached ${SUPPRESSION.pinned} (peak ${f2(T.peak)}) with rounds past his head every second`);
    if (T.crouchT < 0) fails.push(`${m.callsign} never crouched`);
    if (T.soFrames < 0.9 * T.frames) fails.push(`${m.callsign} was in the standoff on only ${T.soFrames}/${T.frames} frames after entering (head down in the open room, the pair should stay in his view)`); }
  if (victim.sup.v !== 0 && victim.held) fails.push(`the held man carries ${f2(victim.sup.v)} (held men accrue nothing)`);
  const ok = fails.length === 0; allPass &&= ok;
  console.log(`- ${ok ? 'PASS' : 'FAIL'} — Sam's rounds ${samRounds}, guard rounds ${guardShots}; ${men.map(m => { const T = st.get(m)!; return `${m.callsign}: entered +${T.enterT >= 0 ? f2(T.enterT) : '—'} s, pinned +${T.pinnedT >= 0 ? f2(T.pinnedT) : '—'} s (peak ${f2(T.peak)}), crouched +${T.crouchT >= 0 ? f2(T.crouchT) : '—'} s, head-down ${f1(T.downFrames * DT)} s, standoff ${T.soFrames}/${T.frames} fr, ${m.sup.displaces} shift(s)`; }).join(' · ')}; ${victim.callsign} ${victim.state}${victim.held ? '/held' : ''}\n    lines: ${lines.filter((l: any) => l.t > t0 && !l.radio).slice(0, 10).map((l: any) => `${f1(l.t - t0)}s ${l.who}: "${l.text}"`).join(' · ') || '—'}\n    ${log.join('\n    ')}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
  console.log(`=== sup-hostage: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}
