// The 'hold-pose' probe family (run through probes.ts: `bun run tools/qa/probes.ts hold-pose | hold-knife | hold-struggle`): what the hold LOOKS like, as far as
// a headless run can tell — the combat knife's boxes in Sam's fist for exactly the life of a hands-empty hold (rigProps.knifeBoxes off combat.ts handProps: there
// while Player.holding is the arm variant, gone the frame it ends however it ends, never in the pistol variant, never on anybody else, Sam's owner byte on every
// one), and the held man's fight through the choke (character.ts heldLayer, HOLD.struggle: head and hands moving frame to frame early, spent by the end, the two
// roots never moving for it, the choke still landing on HOLD.secs, no NaN in any bone) plus his breathing and tugging while merely held. Each stands the full game
// up headless (headless.ts), stages the corridor man with Sam crouched behind him, grabs him (player.ts startGrab — the press itself is grab-gate's business) and
// drives the rest through the real Space on his row.
import { standUp, ROOT } from './headless.ts';
const IK = 'Space';
const { v3, quat } = await import(`${ROOT}/src/math/vec.ts`);
const { startGrab, freeHeld } = await import(`${ROOT}/src/game/player.ts`);
const { HOLD } = await import(`${ROOT}/src/game/character.ts`);
const { KNIFE_TAG } = await import(`${ROOT}/src/game/rigProps.ts`);
const { KITANIM } = await import(`${ROOT}/src/game/kitanim.ts`);
const { PLAYER_ID } = await import(`${ROOT}/src/game/consts.ts`);
const { BoxFlag } = await import(`${ROOT}/src/scene/boxes.ts`);

type Vec3 = [number, number, number];
const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f2 = (x: number) => x.toFixed(2), mm = (x: number) => (x * 1000).toFixed(1);
function place(gd: any, p: Vec3, yaw: number) { gd.char.pos = v3.copy(p); gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.char.bodyYaw = gd.char.aimYaw = yaw; gd.char.aimPitch = 0; gd.path = []; gd.pathGoal = null; gd.char.update(0); gd.char.update(DT); }
function park(gd: any, i: number) { gd.hold = true; gd.pinned = true; gd.heardUpTo = 1e12; place(gd, [37.5, 0, 6 + i * 1.5], Math.PI / 2); }
/** the corridor man (A) planted at (14, 11.2) facing east, calm; B and C parked deaf on the lot; Sam crouched 0.8 m behind him with the pistol HOLSTERED (→ the arm
 *  hold and its knife) unless `gun` (→ drawn: the pistol-to-the-head hold, no knife); `drawn`: A carries his own pistol drawn (an edgy floor) instead of the torch */
async function stage(seed: number, gun = false, drawn = false) {
  Math.random = seeded(seed);
  const W = await standUp(); const { game } = W;
  game.godMode = true; game.player.visibility = 0.02;
  for (let i = 0; i < 5; i++) W.step(DT);
  const [A, B, C] = game.guards; park(B, 1); park(C, 2);
  const at: Vec3 = [14, 0, 11.2], yaw = Math.PI / 2;
  place(A, at, yaw); A.wp = 1; A.hold = true;
  if (drawn) { A.state = 'suspicious'; A.awareness = 0.4; A.lastKnown = [at[0] + 4, 0, at[2]]; A.reactT = 0; A.drawn = true; }
  game.teleportPlayer([at[0] - Math.sin(yaw) * 0.8, 0, at[2] - Math.cos(yaw) * 0.8]); game.player.crouch = true; game.player.slot = 'pistol'; game.player.holstered = !gun;
  W.cam.yaw = yaw + Math.PI; W.cam.rebuild(); W.step(DT); game.player.visibility = 0.02; A.hold = false;
  return { W, game, A, B, C };
}
const knives = (game: any): any[] => game.dynBoxes.filter((b: any) => b.name === KNIFE_TAG);
// With kit handling live (kitanim.ts: KITANIM.on and .equip — the page, the shipped stand, TPS_KITANIM=1) the knife is not gone the frame a hold ends: it stays in
// Sam's fist while the hold's pose lets go of the arm and is then SHEATHED BY HAND. So after a hold the rule there is 'in his fist at first, put away within
// SHEATHE_SECS, not seen again'; with the switch off it is the older 'gone that frame'.
const SHEATHE_SECS = 1.2;
const kitLive = (): boolean => KITANIM.on && KITANIM.equip;
/** steps `n` frames after a hold ended → first: boxes on the first of them · last: the last frame (1-based, 0 = never) a knife box was drawn · peak · back: one was
 *  drawn again after a frame without any · foreign: boxes owned by somebody other than Sam */
const sheathe = (W: any, game: any, n: number) => {
  let first = 0, last = 0, peak = 0, back = false, gap = false, foreign = 0;
  for (let i = 1; i <= n; i++) {
    W.step(DT); const ks = knives(game), k = ks.length; if (i === 1) first = k; peak = Math.max(peak, k); foreign += ks.filter((b: any) => b.owner !== PLAYER_ID).length;
    if (k) { if (gap) back = true; last = i; } else gap = true;
  }
  return { first, last, peak, back, foreign };
};
/** what is wrong with a `sheathe()` reading, by the stand's rule */
const sheatheFaults = (r: ReturnType<typeof sheathe>, what: string): string[] => {
  if (!kitLive()) return r.peak ? [`knife boxes after ${what}: next frame ${r.first}, later ${r.peak}`] : [];
  const f: string[] = [];
  if (!r.first) f.push(`kit handling live: no knife in his fist the frame after ${what} (want it kept, then sheathed by hand)`);
  if (r.last * DT > SHEATHE_SECS) f.push(`the knife was still drawn ${f2(r.last * DT)} s after ${what} (want sheathed within ${SHEATHE_SECS} s)`);
  if (r.back) f.push(`the knife came back after it was put away (${what})`);
  if (r.foreign) f.push(`${r.foreign} knife boxes not Sam's after ${what}`);
  return f;
};
/** the cursor 6 m dead ahead of Sam at chest height: updateHold turns the pair toward the cursor, so this keeps it facing where it faces (his row is THE row while
 *  he holds somebody, wherever the cursor is — Space still lands on it) */
function ahead(W: any, game: any) { const c = game.player.char; W.cursorAt([c.pos[0] + Math.sin(c.bodyYaw) * 6, 1.0, c.pos[2] + Math.cos(c.bodyYaw) * 6]); }
/** grab A and let the hold settle 1.5 s, facing held */
function grabSettle(W: any, game: any, A: any) { startGrab(game, A); for (let i = 0; i < 90; i++) { ahead(W, game); W.step(DT); } }
/** what is wrong with this frame's knife boxes if there should be a knife: four of them, Sam's owner byte, traced (Dynamic, not NoShadow), unlit, finite, by his right hand */
function knifeFaults(game: any): string[] {
  const ks = knives(game), out: string[] = [];
  if (ks.length !== 4) out.push(`${ks.length} knife boxes (want 4)`);
  const hand = game.player.char.bones.handR;
  for (const b of ks) {
    if (b.owner !== PLAYER_ID) out.push(`owner ${b.owner} (want ${PLAYER_ID})`);
    if (!(b.flags & BoxFlag.Dynamic) || (b.flags & BoxFlag.NoShadow)) out.push(`flags ${b.flags} (want Dynamic, traced)`);
    if (b.emissive[0] + b.emissive[1] + b.emissive[2] > 0) out.push('emissive');
    if (![...b.c, ...b.h, ...(b.rot ?? [])].every(Number.isFinite)) out.push('non-finite box');
    else if (hand && v3.dist(b.c, hand) > 0.35) out.push(`a box ${f2(v3.dist(b.c, hand))} m from his right hand`);
  }
  return out;
}
/** the blade box (the long dark one) as a world segment, or null */
function bladeSeg(game: any): { a: Vec3; b: Vec3; level: number } | null {
  const bl = knives(game).find((b: any) => b.h[2] > 0.08 && b.h[1] > 0.005); if (!bl || !bl.rot) return null;
  const dir: Vec3 = quat.rotate(bl.rot, [0, 0, 1]);   // the box's long axis (local +z) in the world: pommel → tip
  return { a: v3.mad(bl.c, dir, -bl.h[2]), b: v3.mad(bl.c, dir, bl.h[2]), level: Math.abs(dir[1]) };
}
function nanBones(...cs: any[]): number { let n = 0; for (const c of cs) for (const k in c.bones) for (const x of c.bones[k]) if (!Number.isFinite(x)) n++; return n; }

// ================================================================ (1) the knife: in the fist for exactly the life of a hands-empty hold, and nowhere else
export async function holdKnife() {
  console.log('\n=== hold-knife: the combat knife is drawn in Sam\'s right fist while — and only while — he holds a man with his hands empty; never in the pistol hold, never on anyone else ===');
  let allPass = true;
  // ---- (a) the arm hold all the way through a choke: none before, four boxes every frame from the grab's first to the man dropping, none from that frame on
  {
    const S = await stage(71); const { W, game, A } = S;
    const fails: string[] = [];
    for (let i = 0; i < 30; i++) { W.step(DT); if (knives(game).length) { fails.push(`knife boxes BEFORE the grab (frame ${i})`); break; } }
    startGrab(game, A);
    const variant = game.player.holding?.variant;
    let frames = 0, missing = 0, faultsSeen: string[] = [], grabFrames = 0, bladeFar = 0, bladeSteep = 0, minNeck = Infinity, maxNeck = 0;
    const stepCheck = () => {
      W.step(DT); if (!game.player.holding) return false; frames++;
      const f = knifeFaults(game); if (knives(game).length === 0) missing++; else if (f.length && faultsSeen.length < 3) faultsSeen.push(`${game.player.holding.phase} ${f2(game.player.holding.t)}: ${f.join(', ')}`);
      if (game.player.holding.phase === 'grab') grabFrames++;
      if (game.player.holding.phase === 'held' && game.player.holding.t > 0.5) {   // settled: the blade lies level across the front of his throat — within a hand of his neck column, never far off it
        const s = bladeSeg(game), neck = A.char.bones.neck, head = A.char.bones.head;
        if (s && neck && head) { const mid = v3.lerp(s.a, s.b, 0.5); const d = Math.hypot(mid[0] - (neck[0] + head[0]) / 2, mid[2] - (neck[2] + head[2]) / 2); minNeck = Math.min(minNeck, d); maxNeck = Math.max(maxNeck, d); if (d > 0.25 || mid[1] < neck[1] - 0.05 || mid[1] > head[1] + 0.08) bladeFar++; if (s.level > 0.3) bladeSteep++; }
      }
      return true;
    };
    while (game.player.holding?.phase === 'grab' && frames < 120) stepCheck();
    for (let i = 0; i < 120; i++) stepCheck();   // two seconds held
    W.cursorAt(v3.add(A.char.pos, [0, 1.35, 0])); W.step(DT); frames++;
    const t0 = game.time; let deadAt = -1, goneSameFrame = true;
    game.selectVerb('held', 'choke'); W.input.pressed.add(IK);   // the choke's row, tapped once: it commits and runs on its own
    for (let i = 0; i < 60 * 4 && deadAt < 0; i++) {
      const alive = stepCheck();
      if (!alive || A.state === 'dead') { deadAt = game.time - t0; if (knives(game).length) goneSameFrame = false; break; }
    }
    const away = sheathe(W, game, 120), after = away.peak;
    if (variant !== 'arm') fails.push(`hold variant ${variant} (staging: the pistol should be holstered → arm)`);
    if (grabFrames < 5) fails.push(`only ${grabFrames} frames of the grab observed`);
    if (missing) fails.push(`${missing} of ${frames} holding frames drew no knife`);
    if (faultsSeen.length) fails.push('box faults: ' + faultsSeen.join(' | '));
    if (bladeFar) fails.push(`the blade sat off his throat on ${bladeFar} settled frames (mid-blade ${f2(minNeck)}‥${f2(maxNeck)} m off the neck axis)`);
    if (bladeSteep) fails.push(`the blade was steeper than 17° on ${bladeSteep} settled frames`);
    if (deadAt < 0 || Math.abs(deadAt - (HOLD.secs.chokeHold + HOLD.secs.choke)) > 0.07) fails.push(`the choke put him down at +${f2(deadAt)} s of Space (want ${f2(HOLD.secs.chokeHold + HOLD.secs.choke)})`);
    if (A.downKind !== 'choked') fails.push(`A ${A.state}/${A.downKind} (want choked)`);
    if (!kitLive() && !goneSameFrame) fails.push('knife boxes still drawn on the frame the hold ended');
    fails.push(...sheatheFaults(away, 'the hold'));
    const ok = fails.length === 0; allPass &&= ok;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — (a) arm hold → choke: variant ${variant}; ${frames} holding frames (${grabFrames} of the reach), knife missing on ${missing}; settled blade ${f2(minNeck)}‥${f2(maxNeck)} m off his neck axis, level; down at +${f2(deadAt)} s as ${A.downKind}; gone the frame it ended: ${goneSameFrame}; boxes in the 2 s after: ${after}, last drawn +${f2(away.last * DT)} s${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
  }
  // ---- (b) the pistol hold: no knife at any point (grab, held, a whip to the end)
  {
    const S = await stage(72, true); const { W, game, A } = S;
    const fails: string[] = [];
    startGrab(game, A);
    const variant = game.player.holding?.variant; let seen = 0, frames = 0;
    for (let i = 0; i < 150; i++) { W.step(DT); frames++; if (knives(game).length) seen++; }
    W.cursorAt(v3.add(A.char.pos, [0, 1.35, 0])); W.step(DT);
    game.selectVerb('held', 'whip'); W.input.pressed.add(IK);   // the whip's row, tapped once
    for (let i = 0; i < 120 && A.state !== 'dead'; i++) { W.step(DT); frames++; if (knives(game).length) seen++; }
    for (let i = 0; i < 60; i++) { W.step(DT); frames++; if (knives(game).length) seen++; }
    if (variant !== 'gun') fails.push(`hold variant ${variant} (staging: drawn → gun)`);
    if (seen) fails.push(`knife boxes on ${seen} of ${frames} frames of a PISTOL hold`);
    if (A.downKind !== 'struck') fails.push(`the whip: A ${A.state}/${A.downKind} (want struck)`);
    const ok = fails.length === 0; allPass &&= ok;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — (b) pistol hold → whip: variant ${variant}; knife seen on ${seen} of ${frames} frames; A ${A.downKind}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
  }
  // ---- (c) the other ends: Sam shot down with him in the arm (freeHeld 'shot'), the tour / a teleport taking the hands (freeHeld 'cancel') — gone that frame; and a
  //      man grabbed with his OWN pistol drawn keeps it in the raised fist (his boxes are his, the knife's are Sam's)
  for (const why of ['shot', 'cancel'] as const) {
    const S = await stage(73 + (why === 'shot' ? 0 : 1), false, true); const { W, game, A } = S;
    const fails: string[] = [];
    startGrab(game, A);
    for (let i = 0; i < 90; i++) W.step(DT);
    const during = knives(game).length; const faults = knifeFaults(game);
    const foreign = game.dynBoxes.filter((b: any) => b.name === KNIFE_TAG && b.owner !== PLAYER_ID).length;
    const armed = A.char.anim.heldPose?.armed;
    freeHeld(game, why);
    const away = sheathe(W, game, 91), after1 = away.first, after = away.peak;
    if (during !== 4 || faults.length) fails.push(`while holding: ${during} boxes, faults ${faults.join(', ') || 'none'}`);
    if (foreign) fails.push(`${foreign} knife boxes owned by somebody other than Sam`);
    if (!armed) fails.push(`the drawn man's heldPose.armed = ${armed} (want true: his pistol stays in the raised fist)`);
    fails.push(...sheatheFaults(away, `freeHeld('${why}')`));
    const ok = fails.length === 0; allPass &&= ok;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — (c) freeHeld('${why}') on a drawn man: ${during} boxes while holding (armed ${armed}), ${after1} the frame after, ${after} later, last drawn +${f2(away.last * DT)} s${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
  }
  console.log(`=== hold-knife: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}

// ================================================================ (2) the fight: he struggles through the choke — a lot early, spent late — pose-only, on time, finite; and is no statue while merely held
export async function holdStruggle() {
  console.log('\n=== hold-struggle: choked, the held man thrashes (head / hands moving frame to frame early, spent by the end), the roots never move for it, the choke lands on time; held, he breathes and tugs ===');
  let allPass = true;
  /** per-frame travel (m) of the man's head joint and two hands over a window, and the roots' total drift */
  const track = (W: any, game: any, A: any, frames: number, keys?: () => void) => {
    const c = A.char, pc = game.player.char; let prevH = v3.copy(c.bones.head), prevL = v3.copy(c.bones.handL), prevR = v3.copy(c.bones.handR);
    const p0 = v3.copy(pc.pos), g0 = v3.copy(c.pos); const dH: number[] = [], dL: number[] = [], dR: number[] = [], dLat: number[] = []; let nan = 0, rootP = 0, rootG = 0, station = 0, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < frames; i++) {
      ahead(W, game); keys?.(); W.step(DT);
      if (!game.player.holding) break;
      nan += nanBones(c, pc);
      dH.push(v3.dist(c.bones.head, prevH)); dL.push(v3.dist(c.bones.handL, prevL)); dR.push(v3.dist(c.bones.handR, prevR));
      { const fw = pc.forward(); dLat.push(Math.abs((c.bones.head[0] - prevH[0]) * fw[2] - (c.bones.head[2] - prevH[2]) * fw[0])); }   // the side-to-side share of the head's travel (across the pair's facing): the thrash, not the loll forward or the sag down
      prevH = v3.copy(c.bones.head); prevL = v3.copy(c.bones.handL); prevR = v3.copy(c.bones.handR);
      rootP = Math.max(rootP, v3.distXZ(pc.pos, p0)); rootG = Math.max(rootG, v3.distXZ(c.pos, g0));
      const f = pc.forward(); station = Math.max(station, Math.hypot(c.pos[0] - (pc.pos[0] + f[0] * HOLD.dist), c.pos[2] - (pc.pos[2] + f[2] * HOLD.dist)));   // (his root off its station HOLD.dist dead ahead of Sam — what a pose leaking into the roots would show as, turn or no turn)
      minY = Math.min(minY, c.bones.head[1]); maxY = Math.max(maxY, c.bones.head[1]);
    }
    const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
    return { head: mean(dH), lat: mean(dLat), handL: mean(dL), handR: mean(dR), headMax: Math.max(0, ...dH), nan, rootP, rootG: Math.max(rootG, station), n: dH.length, headPP: maxY - minY };
  };
  // ---- (a) merely held, 4 s: not a statue (breathing, the odd tug) but nothing like a fight; roots still
  {
    const S = await stage(81); const { W, game, A } = S;
    grabSettle(W, game, A);
    const held = track(W, game, A, 240);
    const fails: string[] = [];
    if (game.player.holding?.phase !== 'held') fails.push(`phase ${game.player.holding?.phase} after 5.5 s of nothing (want held)`);
    if (held.nan) fails.push(`${held.nan} non-finite bone coordinates`);
    if (held.head < 0.00003) fails.push(`head all but frozen while held: ${mm(held.head)} mm/frame mean`);
    if (held.head > 0.0025) fails.push(`head thrashing while merely held: ${mm(held.head)} mm/frame mean (that is the choke's)`);
    if (held.rootP > 0.002 || held.rootG > 0.002) fails.push(`roots drifted: Sam ${mm(held.rootP)} mm, him ${mm(held.rootG)} mm`);
    const ok = fails.length === 0; allPass &&= ok;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — (a) held 4 s: mean travel/frame head ${mm(held.head)} mm (peak ${mm(held.headMax)}), hands L ${mm(held.handL)} R ${mm(held.handR)} mm; head height range ${mm(held.headPP)} mm; roots Sam ${mm(held.rootP)} him ${mm(held.rootG)} mm; NaN ${held.nan}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
  }
  // ---- (b) the choke all the way: early window (0.3–1.1 s in) vs late (the last half second before he goes); on time; roots still; then the ragdoll takes him
  {
    const S = await stage(82); const { W, game, A } = S;
    grabSettle(W, game, A);
    const t0 = game.time; let chosen = false; const down = () => { if (!chosen) { chosen = true; game.selectVerb('held', 'choke'); W.input.pressed.add(IK); } };   // the choke's row tapped ONCE (the first frame); it runs on its own from there
    const pre = track(W, game, A, Math.round((HOLD.secs.chokeHold + 0.3) / DT), down);           // the row tapped, the choke starting, the fight coming on
    const early = track(W, game, A, Math.round(0.8 / DT), down);                                  // 0.3 – 1.1 s into the choke
    const mid = track(W, game, A, Math.round((HOLD.secs.choke - 1.1 - 0.55) / DT), down);        // … up to the last 0.55 s
    const late = track(W, game, A, Math.round(0.45 / DT), down);                                  // the last half second but a few frames
    let deadAt = -1; for (let i = 0; i < 60 && deadAt < 0; i++) { down(); W.step(DT); if (A.state === 'dead') deadAt = game.time - t0; }
    let slept = false; for (let i = 0; i < 60 * 8 && !slept; i++) { W.step(DT); slept = !!A.char.ragdoll?.sleeping; }
    const nanAfter = nanBones(A.char, game.player.char);
    const fails: string[] = [];
    if (pre.nan + early.nan + mid.nan + late.nan + nanAfter) fails.push(`non-finite bones: ${pre.nan + early.nan + mid.nan + late.nan} during, ${nanAfter} after`);
    if (early.head < 0.002 || early.lat < 0.0012) fails.push(`no fight: head ${mm(early.head)} mm/frame early in the choke, ${mm(early.lat)} of it side to side (want > 2 / > 1.2)`);
    if (early.head < pre.head * 1.5) fails.push(`the choke's fight is no bigger than the held man's restlessness: ${mm(early.head)} vs ${mm(pre.head)} mm/frame`);
    if (early.handL < 0.002 || early.handR < 0.002) fails.push(`hands not clawing early: L ${mm(early.handL)} R ${mm(early.handR)} mm/frame (want > 2)`);
    if (late.lat > early.lat * 0.35) fails.push(`the thrash did not fade: ${mm(late.lat)} mm/frame side to side late vs ${mm(early.lat)} early (want < 35 %)`);
    for (const [k, r] of [['pre', pre], ['early', early], ['mid', mid], ['late', late]] as [string, any][]) if (r.rootP > 0.002 || r.rootG > 0.002) fails.push(`roots moved in the ${k} window: Sam ${mm(r.rootP)} him ${mm(r.rootG)} mm`);
    if (deadAt < 0 || Math.abs(deadAt - (HOLD.secs.chokeHold + HOLD.secs.choke)) > 0.07) fails.push(`down at +${f2(deadAt)} s of the tap (want ${f2(HOLD.secs.chokeHold + HOLD.secs.choke)} — the struggle must not touch the choke's clock)`);
    if (A.downKind !== 'choked') fails.push(`A ${A.state}/${A.downKind} (want choked)`);
    if (!slept) fails.push('the ragdoll never slept in 8 s');
    const ok = fails.length === 0; allPass &&= ok;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — (b) choke through: mean travel/frame (mm) head pre ${mm(pre.head)} early ${mm(early.head)} mid ${mm(mid.head)} late ${mm(late.head)} (side to side ${mm(pre.lat)} / ${mm(early.lat)} / ${mm(mid.lat)} / ${mm(late.lat)}); hands early L ${mm(early.handL)} R ${mm(early.handR)}, late L ${mm(late.handL)} R ${mm(late.handR)}; roots ≤ ${mm(Math.max(pre.rootP, early.rootP, mid.rootP, late.rootP, pre.rootG, early.rootG, mid.rootG, late.rootG))} mm; down +${f2(deadAt)} s as ${A.downKind}, ragdoll slept ${slept}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
  }
  // ---- (c) eased off at 1.2 s (a second tap): the fight dies down with the eased choke (no snap), he lives, the hold goes on
  {
    const S = await stage(83); const { W, game, A } = S;
    grabSettle(W, game, A);
    let chosen = false; const down = () => { if (!chosen) { chosen = true; game.selectVerb('held', 'choke'); W.input.pressed.add(IK); } };   // tapped once
    track(W, game, A, Math.round((HOLD.secs.chokeHold + 0.4) / DT), down);
    const during = track(W, game, A, Math.round(0.8 / DT), down);
    W.input.pressed.add(IK);   // the stopping tap (read in the first frame below)
    const justAfter = track(W, game, A, Math.round(0.25 / DT));
    for (let i = 0; i < 45; i++) W.step(DT);
    const settled = track(W, game, A, Math.round(1.0 / DT));
    const fails: string[] = [];
    if (game.player.holding?.phase !== 'held' || A.state === 'dead') fails.push(`after easing off: phase ${game.player.holding?.phase}, A ${A.state} (want held, alive)`);
    if (during.head < 0.002) fails.push(`no fight during: head ${mm(during.head)} mm/frame`);
    if (settled.lat > during.lat * 0.35) fails.push(`the fight went on after easing off: ${mm(settled.lat)} mm/frame side to side a second later vs ${mm(during.lat)} during`);
    if (justAfter.headMax > 0.03) fails.push(`a snap on release: head moved ${mm(justAfter.headMax)} mm in one frame`);
    if (during.nan + justAfter.nan + settled.nan) fails.push('non-finite bones');
    const ok = fails.length === 0; allPass &&= ok;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — (c) eased off at 1.2 s: head ${mm(during.head)} mm/frame during (${mm(during.lat)} side to side) → ${mm(justAfter.head)} just after (peak frame ${mm(justAfter.headMax)}) → ${mm(settled.head)} (${mm(settled.lat)}) a second on; phase ${game.player.holding?.phase}, A ${A.state}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
  }
  console.log(`=== hold-struggle: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}
