// The 'gunhold' probe family (run through probes.ts: `bun run tools/qa/probes.ts gunhold | gunhold-variant | gunhold-fire | gunhold-whip | gunhold-dialogue |
// hold-draw`): slice 4 of docs/internal/grab-interrogate-design.md — the pistol-to-the-head variant of the hold. What was in the hand at the grab decides it to
// begin with (player.ts grabVariant: the Five-seveN drawn → 'gun', holstered / a canister up → 'arm') and E swaps it once he is held (player.ts swapHold: draw —
// the gun to his head — or holster it and the knife is back; hold-draw below); in the gun variant the pistol stays drawn up beside his head (character.ts
// holdLayer, HOLD.gun), a click fires one round past him at what the reticle has (HOLD_FIRE_CD apart, HOLD_SPREAD wide, never into him), his one ROW is the
// pistol-whip (chosen and tapped it cocks at HOLD.secs.chokeHold and lands at HOLD.secs.whip: 'struck', breathing, a 0.35 thud; a second tap sooner checks it)
// instead of the choke, and there is no question row at all — questions are the arm's (holster first); there is no letting him go (the one hand-back left is
// Sam shot down with the man in his arm, freeHeld('shot')). Plus the dialogue follow-up: a held man's clock is the hold's own and an aborted whip / choke
// rattles him. Each stands the full game up headless (headless.ts), stages one situation, drives it through the REAL input path (input.keys / pressed /
// clicked, the rows — verbs.ts), prints what happened, PASS / FAIL.
import { standUp, ROOT } from './headless.ts';
import { holdRelease, endThenStop, endFor } from './verbs.ts';
const IK = 'Space';
const { v3, quat } = await import(`${ROOT}/src/math/vec.ts`);
const playerMod = await import(`${ROOT}/src/game/player.ts`);
const { startGrab, buildInteractables, HOLD_FIRE_CD } = playerMod;
/** how the grab's Space goes down in these probes by default: a one-frame tap (0 — down and up inside the frame, the tour's and the harness's kind), which grabs
 *  in that very frame as the old press-is-the-grab did, so every pose / timing number downstream is staged exactly as it was; pass a length to grabViaHold for
 *  the hold-and-let-go path instead (the grab then lands on the release — and the staged man is free and walking, so keep it short or he is out of reach). */
const PRESS_SECS = 0;
const { HOLD } = await import(`${ROOT}/src/game/character.ts`);
const { CLOSE } = await import(`${ROOT}/src/game/close.ts`);
const { isBreathing } = await import(`${ROOT}/src/game/game.ts`);
const { handProps, fireWeapon, bodyHit } = await import(`${ROOT}/src/game/combat.ts`);
const { KNIFE_TAG, SC20K_TAG } = await import(`${ROOT}/src/game/rigProps.ts`);
const { KITANIM } = await import(`${ROOT}/src/game/kitanim.ts`);
const Dlg = await import(`${ROOT}/src/game/dialogue.ts`);

type Vec3 = [number, number, number];
const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function place(gd: any, p: Vec3, yaw: number) { gd.char.pos = v3.copy(p); gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.char.bodyYaw = gd.char.aimYaw = yaw; gd.char.aimPitch = 0; gd.path = []; gd.pathGoal = null; gd.char.update(0); gd.char.update(DT); }
/** parked out on the lot east of the building, held (the scripted flag), facing east — deaf too unless said otherwise */
function park(gd: any, i: number, deaf = true) { gd.hold = true; place(gd, [37.5, 0, 6 + i * 1.5], Math.PI / 2); if (deaf) gd.heardUpTo = 1e12; }
function tap(game: any) {
  const msgs: { t: number; text: string }[] = [];
  const origMsg = game.msg.bind(game); game.msg = (text: string) => { msgs.push({ t: game.time, text }); return origMsg(text); };
  return { msgs };
}
function tapKey(W: any, code: string) { W.input.pressed.add(code); }
function click(W: any) { W.input.clicked |= 1; }
const f2 = (x: number) => x.toFixed(2), f3 = (x: number) => x.toFixed(3);
const vecS = (p: number[]) => `[${p.map(x => f2(x)).join(', ')}]`;

/** The staging: A (the corridor man, Kowalski — steady) planted at `at` facing `yaw`, calm, free; B and C parked deaf on the lot (unless `keep`); Sam crouched dark
 *  0.8 m behind A with the pistol DRAWN or HOLSTERED as asked; one settled frame. */
async function stage(seed: number, drawn: boolean, at: Vec3 = [14, 0, 11.2], yaw = Math.PI / 2, opts: { parkOthers?: boolean; lightOn?: boolean } = {}) {
  Math.random = seeded(seed);
  const W = await standUp(); const { game } = W;
  game.player.visibility = 0.02; game.godMode = true;
  game.player.slot = 'pistol'; game.player.holstered = !drawn; game.player.pistol.lightOn = !!opts.lightOn;
  for (let i = 0; i < 5; i++) W.step(DT);
  const [A, B, C] = game.guards;
  place(A, at, yaw); A.wp = 1;
  if (opts.parkOthers !== false) { park(B, 0); park(C, 1); }
  const behind: Vec3 = [at[0] - Math.sin(yaw) * 0.8, 0, at[2] - Math.cos(yaw) * 0.8];
  game.teleportPlayer(behind); game.player.crouch = true; W.cam.yaw = 0; W.cam.rebuild?.(); W.step(DT); game.player.visibility = 0.02;
  return { W, game, A, B, C, ...tap(game) };
}
/** grab A through the real press: the cursor on him, Space down for `secs`, then up — the grab lands on that release frame; returns the frame the hold began (−1 never) */
function grabViaHold(S: any, secs = PRESS_SECS): number {
  const { W, game, A } = S; let at = -1;
  W.cursorAt(v3.add(A.char.pos, [0, 1.35, 0]));
  if (secs <= DT) { W.input.pressed.add(IK); for (let i = 0; i < 3; i++) { W.step(DT); if (at < 0 && game.player.holding) at = Math.round(game.time / DT); } }   // a one-frame tap: down and up inside the frame — it grabs in that frame, the frame the old press did (the pose probes' numbers stay put)
  else holdRelease(W, IK, secs, () => { if (at < 0 && game.player.holding) at = Math.round(game.time / DT); });
  return at;
}
/** step until the hold proper has begun (phase 'held'), at most 2 s; then one more frame */
function untilHeld(S: any): boolean { const { W, game } = S; for (let i = 0; i < 120; i++) { if (game.player.holding?.phase === 'held') break; W.step(DT); } W.step(DT); return game.player.holding?.phase === 'held'; }
/** the pistol's boxes in Sam's hand this frame: handProps' output within `r` of his right wrist and above shoulder height (the gun up beside the man's head) — the
 *  stick parts (slide 9.5 cm, can 7.5, rail 5.5, grip 4.75 half-lengths; the goggles by his own head are all under 3) and, separately, a lit lens by them */
function pistolBoxesNearHand(game: any, r = 0.5): { n: number; lit: number; knife: number } {
  const out: any[] = []; handProps(game, out); const h = game.player.char.bones.handR; let n = 0, lit = 0;
  const mine = out.filter(b => b.owner === (game.player.char.id & 0xff) && v3.dist(b.c, h) < r && b.c[1] > 1.25);
  const near = mine.filter(b => b.name !== KNIFE_TAG && b.name !== SC20K_TAG);   // (the combat knife in the fist of an ARM hold is no pistol: counted apart; nor is the FN2000 slung on his back, whose butt rides up behind the right shoulder within reach of a raised wrist — lane R5)
  for (const b of near) if (b.h[2] >= 0.04) n++;
  for (const b of near) if (b.h[2] < 0.01 && b.emissive[0] + b.emissive[1] + b.emissive[2] > 0 && near.some(s => s.h[2] >= 0.05 && v3.dist(s.c, b.c) < 0.12)) lit++;   // (the rail light's lens: a thin lit box on the rail body, not a goggle lens up on his forehead)
  return { n, lit, knife: mine.filter(b => b.name === KNIFE_TAG).length };   // (by its own tag: what is neither pistol nor knife by the hand — the slung rifle's butt — is counted as neither)
}
/** the visual can's mouth and the drawn gun's rear, off the same numbers rigProps lays the boxes with (RIG.pistol: group off [0.039, 0.08, 0.035], slide from 0.02, can to 0.36) */
function gunEnds(c: any): { tip: Vec3; rear: Vec3 } {
  const hand = c.bones.handR, g = c.gunDir; const up = v3.scale(c.gunUnder(), -1); const side = v3.cross(up, g);
  const at = (a: number): Vec3 => v3.mad(v3.mad(v3.mad(hand, g, 0.035 + a), up, 0.08), side, 0.039) as Vec3;
  return { tip: at(0.36), rear: at(0.02) };
}
function segDist(p: number[], a: number[], b: number[]) { const ab = v3.sub(b, a); const t = Math.max(0, Math.min(1, v3.dot(v3.sub(p, a), ab) / v3.dot(ab, ab))); return v3.dist(p, v3.mad(a, ab, t)); }
/** the held man's skull centre (~10 cm up the head bone from its joint) */
function skullOf(c: any): Vec3 { return v3.mad(c.bones.head, quat.rotate(c.headRot(), [0, 1, 0]), 0.10) as Vec3; }

// ================================================================ (1) the variant follows the hand: drawn → 'gun' (pistol drawn up beside his head, its light with it, the gun row), holstered → 'arm' (as it was)
export async function gunholdVariant() {
  console.log('\n=== gunhold-variant: what is in the hand at the grab fixes the hold — drawn: the gun at his head (prop drawn, rail light live, the whip its one row, fire on a click); holstered: the arm, its question and choke rows, the pistol on the thigh ===');
  let allPass = true;
  // ---- (a) drawn, rail light on
  {
    const S = await stage(401, true, undefined, undefined, { lightOn: true }); const { W, game, A, msgs } = S; const { cam, canvas } = W;
    buildInteractables(game, cam, 0, 0, canvas.clientWidth, canvas.clientHeight);
    const rowBefore = game.interactables.find((x: any) => x.kind === 'guard' && x.guard === A)?.line2 ?? '';
    const at = grabViaHold(S); const heldOk = untilHeld(S);
    for (let i = 0; i < 60; i++) W.step(DT);   // a second for the layer's springs
    const H = game.player.holding, pl = game.player, c = pl.char;
    const props = pistolBoxesNearHand(game);
    const row = game.hover?.line2 ?? '', label = game.hover?.line1 ?? '';
    const light0 = pl.light.enabled, lightPos0 = v3.copy(pl.light.pos);
    // pose numbers, in the game: the can vs his skull, the muzzle vs his head, Sam's head off the pair's axis
    const sk = skullOf(A.char), ends = gunEnds(c); const canToSkull = segDist(sk, ends.rear, ends.tip);
    const muzzleToHead = v3.dist(c.muzzle, A.char.bones.head), muzzleToSkull = v3.dist(c.muzzle, sk);
    const fw = c.forward(), left: Vec3 = [fw[2], 0, -fw[0]]; const headOff = v3.dot(v3.sub(c.bones.head, c.pos), left), hisHeadOff = v3.dot(v3.sub(A.char.bones.head, c.pos), left);
    const wristUp = c.bones.handR[1], wristToHisShoulder = v3.dist(c.bones.handR, A.char.bones.upperArmR);
    const hisHands = [A.char.bones.handL[1] - A.char.pos[1], A.char.bones.handR[1] - A.char.pos[1]];
    // L: the light goes dark, the hold goes on
    tapKey(W, 'KeyL'); W.step(DT); const light1 = pl.light.enabled; tapKey(W, 'KeyL'); W.step(DT); const light2 = pl.light.enabled;
    const fails: string[] = [];
    if (at < 0 || !heldOk) fails.push(`staging: grab at frame ${at}, held ${heldOk}`);
    if (!/pistol to his head/.test(rowBefore)) fails.push(`the guard's row before the grab: "${rowBefore}" (want it to say the grab puts the pistol to his head)`);
    if (H?.variant !== 'gun' || A.held?.variant !== 'gun') fails.push(`variant ${H?.variant} / ${A.held?.variant} (want gun / gun)`);
    if (c.anim.hideHeldItem) fails.push('hideHeldItem is up: the pistol went to the thigh');
    if (props.n < 3) fails.push(`only ${props.n} pistol boxes by his raised hand (want slide + grip + can ≥ 3)`);
    if (props.knife) fails.push(`${props.knife} knife boxes in the GUN hold (the knife is the arm hold's)`);
    if (!light0) fails.push('rail light not lit in the gun hold with L on'); else if (v3.dist(lightPos0, c.bones.handR) > 0.4) fails.push(`rail light posed ${f2(v3.dist(lightPos0, c.bones.handR))} m from the gun hand`);
    if (props.lit < 1 && light0) fails.push('no lit lens box on the drawn pistol');
    if (light1 !== false || light2 !== true) fails.push(`L in the hold: ${light0} → ${light1} → ${light2} (want on → off → on)`);
    if (!/^Space\s+pistol-whip him/.test(row) || !/LMB\s+fire past him/.test(row) || !/E\s+holster — to question him/.test(row) || /“/.test(row) || game.nearby.length !== 1) fails.push(`held row: "${row}" ×${game.nearby.length} (want the whip as the one row, the click and E to holster as its hints — and no question row: those are the arm's)`);
    if (/let him go/.test(row)) fails.push(`held row still offers a release: "${row}" (there is no letting him go any more)`);
    if (!/pistol at his head/.test(label)) fails.push(`held label: "${label}"`);
    if (!msgs.some(m => /pistol at his head/.test(m.text) && /^got /.test(m.text))) fails.push(`grab log line does not name the variant: ${msgs.map(m => m.text).join(' | ')}`);
    if (canToSkull < 0.11 || canToSkull > 0.2) fails.push(`the can's line runs ${f3(canToSkull)} m from his skull centre (want 0.11–0.20: along the temple, not in it, not off in the air)`);
    if (ends.tip[1] < 1.45 || ends.tip[1] > 1.75) fails.push(`the can's mouth at height ${f2(ends.tip[1])} (want head height 1.45–1.75)`);
    if (muzzleToHead > 0.35) fails.push(`shot muzzle ${f2(muzzleToHead)} m from his head joint (want ≤ 0.35)`);
    if (headOff < 0.02) fails.push(`Sam's head ${f3(headOff)} m to the LEFT of the pair's axis (want out to the left, ≥ 0.02)`);
    if (wristToHisShoulder < 0.09) fails.push(`Sam's gun wrist ${f3(wristToHisShoulder)} m from the man's shoulder joint (inside his deltoid)`);
    if (hisHands[0] < 1.3 || hisHands[1] < 1.3) fails.push(`his hands at ${vecS(hisHands)} up (want half raised, ≥ 1.3)`);
    if (!game.player.holding || A.state === 'dead') fails.push('the hold ended');
    const ok = fails.length === 0; allPass &&= ok;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — (a) DRAWN: variant ${H?.variant}/${A.held?.variant}; guard row before: "${rowBefore}"; held row: "${label}" / "${row}"\n    pistol boxes by the raised hand: ${props.n} (${props.lit} lit); hideHeldItem ${c.anim.hideHeldItem}; rail light ${light0} at ${f2(v3.dist(lightPos0, c.bones.handR))} m off the wrist, L → ${light1} → ${light2}\n    pose: can line → his skull centre ${f3(canToSkull)} m, can mouth ${vecS(ends.tip)} (his skull ${vecS(sk)}), shot muzzle → head joint ${f2(muzzleToHead)} / skull ${f2(muzzleToSkull)} m; Sam's head ${f3(headOff)} m left of the axis (his ${f3(hisHeadOff)}); gun wrist y ${f2(wristUp)}, ${f3(wristToHisShoulder)} m off his shoulder joint; his hands ${vecS(hisHands)} up\n    log: ${msgs.map(m => m.text).join(' | ')}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
  }
  // ---- (b) holstered: the arm variant, unchanged — pistol on the thigh, the choke on its row, L dead
  {
    const S = await stage(402, false, undefined, undefined, { lightOn: true }); const { W, game, A, msgs } = S; const { cam, canvas } = W;
    buildInteractables(game, cam, 0, 0, canvas.clientWidth, canvas.clientHeight);
    const rowBefore = game.interactables.find((x: any) => x.kind === 'guard' && x.guard === A)?.line2 ?? '';
    grabViaHold(S); const heldOk = untilHeld(S); for (let i = 0; i < 60; i++) W.step(DT);
    const H = game.player.holding, c = game.player.char; const props = pistolBoxesNearHand(game); const row = game.nearby.map((r: any) => r.line2).join('  ·  ');   // both rows: the question (highlighted) and the choke with its E hint
    const lightOn = game.player.light.enabled;
    if (!CLOSE.heldClicks) click(W); W.step(DT); const shots = game.mission.stats.shots;   // (close.ts CLOSE.heldClicks: with the two buttons on, a left click in the arm is the knife — heldclicks-check.ts asks that; here the click is only made where it must fire nothing)
    let phaseDuring: string | undefined; endThenStop(W, 1.0, () => { if (A.held?.phase === 'choke') phaseDuring = 'choke'; }); W.step(DT); W.step(DT); const phaseAfter = game.player.holding?.phase;
    const fails: string[] = [];
    if (!heldOk) fails.push('staging: never held');
    if (/pistol/.test(rowBefore)) fails.push(`guard row holstered: "${rowBefore}" (should not promise the pistol)`);
    if (H?.variant !== 'arm' || A.held?.variant !== 'arm') fails.push(`variant ${H?.variant} / ${A.held?.variant} (want arm / arm)`);
    if (!c.anim.hideHeldItem) fails.push('hideHeldItem down in the arm hold');
    if (props.n > 0) fails.push(`${props.n} pistol boxes up by the hand in the arm hold`);
    if (props.knife !== 4) fails.push(`${props.knife} knife boxes in the fist of the arm hold (want 4: hold-pose-probes.ts has the rest of that)`);
    if (lightOn) fails.push('rail light lit in the arm hold');
    if (shots > 0) fails.push('a click fired in the arm hold');
    if (!/^Space\s+“/.test(row) || !/Space\s+choke him out/.test(row) || !(CLOSE.heldClicks ? /LMB\s+knife — lethal\s+·\s+RMB\s+choke him out\s+·\s+E\s+draw — gun to his head/ : /E\s+draw — gun to his head/).test(row) || (CLOSE.heldClicks ? /pistol-whip/ : /pistol-whip|LMB/).test(row)) fails.push(`held rows: "${row}" (want the question, the choke and E to draw)`);   // (close.ts CLOSE.heldClicks on: the arm hold's two buttons are worded on the choke row, LMB the knife and RMB the choke, ahead of E; off: no LMB on it)
    if (phaseDuring !== 'choke' || phaseAfter !== 'held' || A.state === 'dead') fails.push(`the choke chosen, stopped at 1 s: ${phaseDuring} → ${phaseAfter}, A ${A.state} (want choke → held, alive)`);
    const ok = fails.length === 0; allPass &&= ok;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — (b) HOLSTERED: variant ${H?.variant}/${A.held?.variant}; guard row before: "${rowBefore}"; held rows "${row.split('  ·  ').slice(1).join(' · ')}"; pistol boxes up ${props.n} (knife ${props.knife}), hideHeldItem ${c.anim.hideHeldItem}, light ${lightOn}, click → shots ${shots}; the choke stopped at 1 s: ${phaseDuring} → ${phaseAfter}\n    log: ${msgs.map(m => m.text).join(' | ')}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
  }
  // ---- (c) drawn but a canister up (the smoke slot): the arm variant too
  {
    const S = await stage(403, true); const { game, A } = S; game.player.slot = 'smoke'; game.player.holstered = false;
    grabViaHold(S); untilHeld(S);
    const fails: string[] = []; if (game.player.holding?.variant !== 'arm') fails.push(`smoke-slot grab: variant ${game.player.holding?.variant} (want arm)`); if (!game.player.char.anim.hideHeldItem) { for (let i = 0; i < 30; i++) S.W.step(DT); if (!game.player.char.anim.hideHeldItem) fails.push('the can stayed in the fist'); }
    const ok = fails.length === 0; allPass &&= ok;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — (c) a smoke can up: variant ${game.player.holding?.variant}, held item hidden ${game.player.char.anim.hideHeldItem} (A ${A.state})${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
  }
  console.log(`=== gunhold-variant: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}

// ================================================================ (2) firing past him: clicks → single rounds HOLD_FIRE_CD apart from beside his head, never into him, into the man 6 m ahead
export async function gunholdFire() {
  console.log('\n=== gunhold-fire: clicks in the gun hold — one round each, ≥ 0.7 s apart, leaving from beside his head, the held man never hit, the man 6 m ahead hit ===');
  let allPass = true;
  for (const [label, tgtOff, seed] of [['target dead ahead 6 m', [6, 0], 501], ['target 6 m ahead and 0.8 m to the left (across his face from the muzzle at his right jaw)', [6, 0.8], 502]] as [string, [number, number], number][]) {
    const S = await stage(seed, true, [14, 0, 11.2], Math.PI / 2, { parkOthers: false }); const { W, game, A, B, C, msgs } = S;
    park(C, 1);
    // the target: B planted ahead of the pair (east = +x; 'left' of a pair facing east = north = −z), his back to them, deaf and rooted so five rounds find him standing (the first may drop him)
    const T = B; T.hold = true; T.pinned = true; T.heardUpTo = 1e12; place(T, [14 + 0.27 + tgtOff[0], 0, 11.2 - tgtOff[1]], Math.PI / 2); T.state = 'patrol'; T.awareness = 0;
    grabViaHold(S); const heldOk = untilHeld(S); for (let i = 0; i < 40; i++) W.step(DT);
    const pl = game.player, c = pl.char;
    // the cursor on the target's chest; keep clicking every frame for 3.4 s
    const shots: { t: number; from: Vec3; muzzleToHead: number; muzzleToSkull: number; gunOut: number; aimGuard: string }[] = []; let lastFire = pl.lastFireT; let heldHit = false, tDown = -1; let fxSeen = game.fx.length;
    let maxFlinch = 0; const headRest = v3.sub(A.char.bones.head, A.char.pos);
    for (let i = 0; i < Math.round(3.4 / DT); i++) {
      const chest = T.char.bones.chest ?? v3.add(T.char.pos, [0, 1.2, 0]); W.cursorAt(T.state === 'dead' ? v3.add(T.char.pos, [0, 1.2, 0]) as Vec3 : chest);
      click(W);
      const headBefore = v3.copy(A.char.bones.head), skBefore = skullOf(A.char);
      W.step(DT);
      if (pl.lastFireT !== lastFire) {   // a round left this frame: its flash card sits 5 cm down the bore from the muzzle it left
        lastFire = pl.lastFireT;
        const card = game.fx.slice(fxSeen).find((e: any) => Math.abs(e.box.h[0] - 0.018) < 1e-4) ?? game.fx[game.fx.length - 1];
        const from = card ? v3.copy(card.box.c) : v3.copy(c.muzzle);
        shots.push({ t: game.time, from, muzzleToHead: v3.dist(from, headBefore), muzzleToSkull: v3.dist(from, skBefore), gunOut: pl.holding?.gunOut ?? -1, aimGuard: game.aimGuard ? game.aimGuard.callsign : game.aimTarget ? 'fixture' : 'point' });
      }
      fxSeen = game.fx.length;
      if (A.state === 'dead') heldHit = true;
      if (tDown < 0 && T.state === 'dead') tDown = game.time;
      maxFlinch = Math.max(maxFlinch, v3.dist(v3.sub(A.char.bones.head, A.char.pos), headRest));
      if (!pl.holding) break;
    }
    const gaps = shots.slice(1).map((s, i) => s.t - shots[i].t); const minGap = gaps.length ? Math.min(...gaps) : Infinity;
    for (let i = 0; i < 90; i++) W.step(DT);   // let the gun settle back on him
    const gunOutAfter = pl.holding?.gunOut ?? -1;
    const fails: string[] = [];
    if (!heldOk) fails.push('staging: never held');
    if (shots.length < 4 || shots.length > 6) fails.push(`${shots.length} rounds in 3.4 s of clicking (want 4–6 at ${HOLD_FIRE_CD} s)`);
    if (minGap < HOLD_FIRE_CD - 1e-6) fails.push(`two rounds ${f3(minGap)} s apart (want ≥ ${HOLD_FIRE_CD})`);
    if (heldHit || A.state === 'dead') fails.push(`the held man went down (${A.downKind}/${A.downBy})`);
    if (tDown < 0) fails.push(`the target 6 m ahead was never hit (${T.state})`);
    if (shots.some(s => s.muzzleToHead > 0.35)) fails.push(`a round left ${f2(Math.max(...shots.map(s => s.muzzleToHead)))} m from his head joint (want ≤ 0.35: from beside his head)`);
    if (shots.some(s => s.gunOut < 0.8)) fails.push(`a round left with the gun only ${f2(Math.min(...shots.map(s => s.gunOut)))} presented (want ≥ 0.8)`);
    if (shots.some(s => s.aimGuard === A.callsign)) fails.push('the auto-aim snapped to the man in the arm');
    if (game.mission.stats.shots !== shots.length) fails.push(`card shots ${game.mission.stats.shots} vs ${shots.length} seen`);
    if (!pl.holding) fails.push('the hold ended under fire');
    if (gunOutAfter > 0.05) fails.push(`gun still ${f2(gunOutAfter)} presented 1.5 s after the last round`);
    if (maxFlinch < 0.01) fails.push('the held man never flinched');
    const ok = fails.length === 0; allPass &&= ok;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}: ${shots.length} rounds at ${shots.map(s => f2(s.t - (shots[0]?.t ?? 0))).join(' / ')} s (min gap ${gaps.length ? f3(minGap) : '—'}); left from ${shots.map(s => f2(s.muzzleToHead)).join(' / ')} m off his head joint (${shots.map(s => f2(s.muzzleToSkull)).join(' / ')} off the skull), gun out ${shots.map(s => f2(s.gunOut)).join('/')}, aimed at ${[...new Set(shots.map(s => s.aimGuard))].join('/')}; held man ${A.state}, target ${T.state}${tDown >= 0 ? ` (down at ${f2(tDown - (shots[0]?.t ?? 0))} s after the first)` : ''}; his biggest flinch ${f3(maxFlinch)} m; gun back to ${f2(gunOutAfter)} after\n    log: ${msgs.filter(m => !/^got /.test(m.text)).map(m => m.text).join(' | ')}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
  }
  // ---- the skip itself, point blank: at rest the muzzle sits INSIDE his body cylinder (beside his jaw, < 0.28 m off his axis) — bodyHit's contact rule would put
  //      Sam's own round in him at t 0; fireWeapon must not even ask (the round goes on to the wall ahead)
  {
    const S = await stage(504, true); const { W, game, A } = S;
    grabViaHold(S); untilHeld(S); for (let i = 0; i < 40; i++) W.step(DT);
    const c = game.player.char, hc = A.char; const hips = hc.bones.hips ?? hc.pos;
    const offAxis = Math.hypot(c.muzzle[0] - hips[0], c.muzzle[2] - hips[2]);
    const ahead: Vec3 = v3.mad(v3.add(c.pos, [0, 1.4, 0]), c.forward(), 8) as Vec3;
    const wouldHit = bodyHit(hc, v3.copy(c.muzzle), v3.normalize(v3.sub(ahead, c.muzzle)), 60, true);   // what the loop would get for him if it asked
    fireWeapon(game, c, ahead, true);
    for (let i = 0; i < 3; i++) W.step(DT);
    const fails: string[] = [];
    if (offAxis > 0.28) fails.push(`staging: muzzle ${f3(offAxis)} m off his axis at rest — not inside his cylinder, the contact rule is not what is tested`);
    if (wouldHit < 0) fails.push('staging: bodyHit says the geometry would not have hit him anyway');
    if (A.state === 'dead') fails.push(`he took Sam's round (${A.downKind}/${A.downBy})`);
    if (!game.player.holding) fails.push('the hold ended');
    const ok = fails.length === 0; allPass &&= ok;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — point blank: muzzle ${f3(offAxis)} m off his axis (cylinder 0.28), bodyHit alone says t ${f2(wouldHit)} (a hit); fireWeapon past him → he is ${A.state}, hold ${!!game.player.holding}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
  }
  // ---- an empty gun: clicks dry-fire, nothing leaves, the row says so
  {
    const S = await stage(503, true); const { W, game, A, msgs } = S;
    game.player.pistol.mag = 0; game.player.pistol.chamber = 0; game.player.pistol.spare = [];
    grabViaHold(S); untilHeld(S); for (let i = 0; i < 30; i++) W.step(DT);
    const row = game.hover?.line2 ?? '';
    for (let i = 0; i < 60; i++) { click(W); W.step(DT); }
    const fails: string[] = [];
    if (game.mission.stats.shots > 0) fails.push('an empty gun fired'); if (!/empty/.test(row)) fails.push(`row does not say empty: "${row}"`); if (!msgs.some(m => /click — empty/.test(m.text))) fails.push('no dry-fire line'); if (!game.player.holding || A.state === 'dead') fails.push('hold ended');
    const ok = fails.length === 0; allPass &&= ok;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — empty gun: shots ${game.mission.stats.shots}, row "${row.split('  ·  ')[2] ?? row}", dry-fire lines ${msgs.filter(m => /click — empty/.test(m.text)).length}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
  }
  console.log(`=== gunhold-fire: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}

// ================================================================ (3) the pistol-whip: its row tapped → 'whip' at 0.35 s, down at 0.95 s struck / breathing, louder than the choke; a second tap at 0.5 s → still held, rattled
export async function gunholdWhip() {
  console.log('\n=== gunhold-whip: the whip row tapped in the gun hold — it cocks at 0.35 s and lands at +0.6 s (struck, breathing, a 0.35 thud, the ragdoll); tapped again at 0.5 s he is still held ===');
  let allPass = true;
  // ---- (a) all the way
  {
    const S = await stage(601, true); const { W, game, A, B, msgs } = S;
    grabViaHold(S); untilHeld(S); W.step(DT);
    let whipAt = -1, deadAt = -1; const t0 = game.time; const levels: number[] = []; let evSeen = 0;
    const headTrace: string[] = []; const skull0 = skullOf(A.char); let hitDist = Infinity;
    game.selectVerb('held', 'whip'); W.input.pressed.add(IK);   // the one row, tapped (its frame is the first stepped below)
    for (let i = 0; i < 60 * 3 && deadAt < 0; i++) {
      W.step(DT);
      for (const e of game.events.slice(0)) { if ((e as any).__seen) continue; (e as any).__seen = true; if (e.kind === 'prop' && e.who === game.player.char.id) levels.push(e.level ?? 0); }
      void evSeen;
      const H = game.player.holding;
      if (whipAt < 0 && H?.phase === 'whip') whipAt = game.time - t0;
      if (H?.phase === 'whip') { hitDist = Math.min(hitDist, v3.dist(game.player.char.bones.handR, skullOf(A.char))); if (Math.round(H.t * 60) % 6 === 0) headTrace.push(`t${f2(H.t)} hand→skull ${f2(v3.dist(game.player.char.bones.handR, skullOf(A.char)))}`); }
      if (deadAt < 0 && A.state === 'dead') deadAt = game.time - t0;
    }
    const heldStill = !!game.player.holding, hide0 = game.player.char.anim.hideHeldItem;
    for (let i = 0; i < 30; i++) W.step(DT);
    let sleptAt = -1, darkAt = -1; const torchLit0 = A.dropped?.kind;
    for (let i = 0; i < 60 * 8; i++) { W.step(DT); if (sleptAt < 0 && A.char.ragdoll?.sleeping) sleptAt = game.time - t0 - deadAt; if (darkAt < 0 && !A.flashlight.enabled) darkAt = game.time - t0 - deadAt; }
    const st = game.mission.stats; const hips = A.char.bones.hips; const skull1 = skullOf(A.char);
    const fw = game.player.char.forward(), left: Vec3 = [fw[2], 0, -fw[0]]; const fell = v3.sub(A.char.pos, game.player.char.pos); const fellFwd = v3.dot(fell, fw), fellLeft = v3.dot(fell, left);
    const fails: string[] = [];
    if (whipAt < 0 || Math.abs(whipAt - HOLD.secs.chokeHold) > 0.05) fails.push(`whip began at +${f2(whipAt)} s of the tap (want ${HOLD.secs.chokeHold})`);
    if (deadAt < 0 || deadAt < 0.9 - 1e-6 || deadAt > 1.1) fails.push(`went down at +${f2(deadAt)} s (want 0.9–1.1: ${HOLD.secs.chokeHold} + ${HOLD.secs.whip})`);
    if (A.downKind !== 'struck' || A.downBy !== 'player' || !isBreathing(A)) fails.push(`A ${A.state}/${A.downKind}/${A.downBy} breathing ${isBreathing(A)} (want dead/struck/player, breathing)`);
    if (heldStill || A.held) fails.push('hold not cleared on the frame he went');
    if (hide0) fails.push('the pistol left the hand at the strike (hideHeldItem)');
    if (game.player.takedown || game.player.holding) fails.push('something else started after he went');
    const maxLevel = levels.length ? Math.max(...levels) : 0; if (maxLevel < 0.34) fails.push(`loudest player 'prop' event ${f2(maxLevel)} (want the whip's 0.35 — louder than the choke's 0.15 / the fold's 0.3)`);
    if (!A.char.ragdoll) fails.push('no ragdoll'); if (sleptAt < 0) fails.push('ragdoll never slept in 8 s');
    if (!hips || hips[1] > 0.35) fails.push(`his hips at y ${hips ? f2(hips[1]) : '?'} (want on the floor)`);
    if (hitDist > 0.24) fails.push(`the gun hand never came within ${f2(hitDist)} m of his skull centre (want the frame on the bone: ≤ 0.24)`);
    if (st.knockouts !== 1 || st.kills !== 0) fails.push(`stats ko ${st.knockouts} kills ${st.kills} (want 1 / 0)`);
    if (!msgs.some(m => /pistol-whipped/.test(m.text))) fails.push(`no 'pistol-whipped' log line: ${msgs.map(m => m.text).join(' | ')}`);
    if (torchLit0 !== 'torch') fails.push(`dropped ${torchLit0 ?? 'nothing'} (want his torch)`); if (darkAt < 0 || darkAt > 1.2) fails.push(`torch dark at ${darkAt < 0 ? 'never' : '+' + f2(darkAt) + ' s'}`);
    if (game.player.char.anim.holdPose) fails.push("Sam's holdPose still set");
    // somebody finds him: out cold
    game.teleportPlayer([37.5, 0, 26.5]); game.player.crouch = false;
    B.hold = false; B.heardUpTo = game.eventSeq; place(B, [A.char.pos[0] + 5, 0, 11.2], -Math.PI / 2); B.state = 'patrol'; B.awareness = 0; B.wp = 3;
    let foundAt = -1; for (let f = 0; f < 60 * 30; f++) { W.step(DT); if (foundAt < 0 && A.found) foundAt = game.time; }
    if (foundAt < 0) fails.push('B never found him'); if (!B.witness.sawBody?.breathing) fails.push(`B.witness.sawBody ${JSON.stringify(B.witness.sawBody)} (want breathing)`);
    const ok = fails.length === 0; allPass &&= ok;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — (a) whip through: began +${f2(whipAt)} s, down +${f2(deadAt)} s as ${A.downKind}/${A.downBy} breathing ${isBreathing(A)}; loudest thud ${f2(maxLevel)} (events ${levels.map(l => f2(l)).join('/')}); gun hand → skull ${f2(hitDist)} m at closest; dropped ${A.dropped?.kind ?? '—'} dark +${darkAt >= 0 ? f2(darkAt) : '—'} s; ragdoll asleep +${sleptAt >= 0 ? f2(sleptAt) : '—'} s, hips y ${hips ? f2(hips[1]) : '?'}, fell ${f2(fellFwd)} m ahead / ${f2(fellLeft)} m left of Sam (skull moved ${vecS(v3.sub(skull1, skull0))}); card ko ${st.knockouts} kills ${st.kills}; found ${foundAt >= 0 ? 'yes, breathing ' + !!B.witness.sawBody?.breathing : 'never'}\n    ${headTrace.join(' · ')}\n    log: ${msgs.filter(m => !/^got |^teleported/.test(m.text)).map(m => m.text).join(' | ')}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
  }
  // ---- (b) a second tap at 0.5 s: back to held, alive, rattled (talk.abortT); then a full one still lands
  {
    const S = await stage(602, true); const { W, game, A, msgs } = S;
    grabViaHold(S); untilHeld(S); W.step(DT);
    const ag0 = Dlg.agitationOf(game, A);
    let phaseDuring: string | undefined; endThenStop(W, 0.5, () => { if (A.held?.phase === 'whip') phaseDuring = 'whip'; });
    W.step(DT); W.step(DT);
    const phaseAfter = game.player.holding?.phase; const ag1 = Dlg.agitationOf(game, A); const why = (Dlg.gather(game, A).why as string[]).join(', ');
    const fails: string[] = [];
    if (phaseDuring !== 'whip') fails.push(`0.5 s after choosing the whip: never reached whip`);
    if (phaseAfter !== 'held' || A.state === 'dead') fails.push(`after the stopping tap: phase ${phaseAfter}, A ${A.state} (want held, alive)`);
    if (!msgs.some(m => /goes back to/.test(m.text))) fails.push('no checked-it line');
    if (A.talk.abortT < 0) fails.push('talk.abortT not stamped');
    if (Math.abs(ag1 - ag0 - 0.2) > 0.03) fails.push(`agitation ${f2(ag0)} → ${f2(ag1)} (want +0.20 for the aborted whip)`);
    for (let i = 0; i < 40; i++) W.step(DT);
    const gunOutBack = game.player.holding?.gunOut ?? -1;
    endFor(W, HOLD.secs.chokeHold + HOLD.secs.whip + 0.1);
    if (A.state !== 'dead' || A.downKind !== 'struck') fails.push(`the second, full whip: A ${A.state}/${A.downKind}`);
    const ok = fails.length === 0; allPass &&= ok;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — (b) stopped at 0.5 s: phase ${phaseDuring} → ${phaseAfter}, alive; agitation ${f2(ag0)} → ${f2(ag1)} [${why}]; gun back on him (out ${f2(gunOutBack)}); the full one then: ${A.state}/${A.downKind}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
  }
  // ---- (c) at 20 Hz the strike still lands inside the window
  {
    Math.random = seeded(603);
    const W = await standUp(); const { game } = W; const dt = 1 / 20;
    game.player.visibility = 0.02; game.godMode = true; game.player.holstered = false;
    for (let i = 0; i < 3; i++) W.step(dt);
    const [A, B, C] = game.guards; place(A, [14, 0, 11.2], Math.PI / 2); A.wp = 1; park(B, 0); park(C, 1);
    game.teleportPlayer([13.2, 0, 11.2]); W.step(dt);
    startGrab(game, A); for (let i = 0; i < 20; i++) W.step(dt);
    W.cursorAt(v3.add(A.char.pos, [0, 1.6, 0])); W.step(dt);
    const t0 = game.time; let deadAt = -1; game.selectVerb('held', 'whip'); W.input.pressed.add(IK);
    for (let i = 0; i < 60 && deadAt < 0; i++) { W.step(dt); if (A.state === 'dead') deadAt = game.time - t0; }
    for (let i = 0; i < 40; i++) W.step(dt);
    const fails: string[] = []; if (deadAt < 0.9 - 1e-6 || deadAt > 1.15) fails.push(`down at +${f2(deadAt)} s at 20 Hz`); if (A.downKind !== 'struck') fails.push(`A ${A.state}/${A.downKind}`);
    const ok = fails.length === 0; allPass &&= ok;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — (c) 20 Hz: down at +${f2(deadAt)} s as ${A.downKind}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
  }
  console.log(`=== gunhold-whip: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}

// ================================================================ (4) the dialogue follow-up: no questions over a gun — there is no question row with the gun at his head (holster first — then they come, intel and all); the held clock
//                                                                    is the hold's (never re-stamped by presses, never lapsing), an aborted choke rattles him +0.2, the gun at his head +0.1
export async function gunholdDialogue() {
  console.log('\n=== gunhold-dialogue: the GUN hold has no question row (a chosen whip un-chosen at once leaves the dialogue untouched) — E holsters, then taps question him and his useful thing still comes; heldSinceOf = Guard.held.since through presses and past the sandbox lapse; +0.2 after an aborted choke; +0.1 for the gun at his head ===');
  let allPass = true;
  {   // ---- questions are the arm's: grabbed DRAWN, the only row is the whip — no question row to select, and three whips chosen and un-chosen inside their commit beat well apart do nothing at all
      //      to the dialogue (no Sam line, no answer, no stage, no 'you ▸' in the log) or to him; E holsters it (the arm, the knife); then three exchanges run as ever — Sam's line, the man's
      //      answer a beat later — and the steady corridor man gives his useful thing at the third
    const S = await stage(703, true); const { W, game, A, msgs } = S;
    grabViaHold(S); untilHeld(S); for (let i = 0; i < 30; i++) W.step(DT);
    const fails: string[] = [];
    if (game.player.holding?.variant !== 'gun') fails.push(`staging: variant ${game.player.holding?.variant} (want gun)`);
    const bubble0 = game.player.bubble; const row0 = game.hover?.line2 ?? ''; const rowsGun = game.nearby.map((r: any) => r.verb).join('/'); const canAsk = game.selectVerb('held', 'question');
    for (let q = 0; q < 3; q++) { tapKey(W, IK); W.step(DT); for (let i = 0; i < 6; i++) W.step(DT); tapKey(W, IK); W.step(DT); for (let i = 0; i < 142; i++) W.step(DT); }   // the whip chosen (the one row) and un-chosen 0.1 s in, 2.5 s apart
    const gunTaps = { stage: A.talk.stage, presses: A.talk.presses, ask: !!game.player.holding?.ask, samSpoke: game.player.bubble !== bubble0, you: msgs.filter(m => /^you ▸/.test(m.text)).length };
    if (rowsGun !== 'whip' || canAsk) fails.push(`gun rows [${rowsGun}], selectVerb(question) ${canAsk} (want the whip alone, no question to select)`);
    if (gunTaps.stage !== 0 || gunTaps.presses !== 0 || gunTaps.ask || gunTaps.samSpoke || gunTaps.you || A.state === 'dead' || A.talk.abortT >= 0) fails.push(`three whips chosen / un-chosen with the gun at his head: stage ${gunTaps.stage}, presses ${gunTaps.presses}, ask ${gunTaps.ask}, Sam spoke ${gunTaps.samSpoke}, 'you ▸' ×${gunTaps.you}, A ${A.state} abortT ${A.talk.abortT} (want nothing at all)`);
    if (!/E\s+holster — to question him/.test(row0) || /“/.test(row0)) fails.push(`gun row: "${row0}" (want E to holster, and no question offered)`);
    // E: holster it — the arm from here (the swap's own numbers are hold-draw's business; here only that questions come back, intact)
    tapKey(W, 'KeyE'); for (let i = 0; i < 30; i++) W.step(DT);
    const H1 = game.player.holding; const armed = { variant: H1?.variant, his: A.held?.variant, holstered: game.player.holstered, row: game.hover?.line2 ?? '' };
    if (armed.variant !== 'arm' || armed.his !== 'arm' || !armed.holstered) fails.push(`after E: variant ${armed.variant}/${armed.his}, holstered ${armed.holstered} (want arm/arm, holstered)`);
    if (!/^Space\s+“make him talk”/.test(armed.row)) fails.push(`arm row after E: "${armed.row}" (want the first question offered — nothing was spent over the gun)`);
    const stages: number[] = []; const beats: number[] = [];
    for (let q = 0; q < 3; q++) {
      for (let i = 0; i < 600 && !(game.player.holding && playerMod.heldTalk(game, game.player.holding).settled); i++) W.step(DT);
      const t0 = game.time; tapKey(W, IK); W.step(DT); const asked = !!game.player.holding?.ask;
      if (!asked) fails.push(`arm tap ${q + 1}: no exchange opened`);
      const st = A.talk.stage; for (let i = 0; i < 150 && A.talk.stage === st; i++) W.step(DT); stages.push(A.talk.stage); beats.push(game.time - t0);
    }
    const you = msgs.filter(m => /^you ▸/.test(m.text)).map(m => m.text.slice(6));
    if (stages.join('/') !== '1/2/3') fails.push(`stages after the three arm exchanges: ${stages.join('/')} (want 1/2/3)`);
    if (beats.some(b => b < 0.9 - 1e-6 || b > 1.4 + 2 * DT)) fails.push(`answers came ${beats.map(f2).join('/')} s after the taps (want Sam's beat, 0.9‥1.4 s)`);
    if (Dlg.temperamentOf(A) === 'steady' && !A.talk.given.size) fails.push(`the steady man gave nothing by the third exchange (talk.given empty) — the intel must still land after a spell under the gun`);
    if (you.length !== 3) fails.push(`'you ▸' lines: ${you.join(' | ')} (want Sam's three questions, and nothing from the gun taps)`);
    const gunLine = you.find(t => (Dlg.SAM_LINES.find((l: any) => l.text === t)?.needs ?? []).includes('gun')); if (gunLine) fails.push(`a [gun] line put as a question in the arm: "${gunLine}"`);
    if (!game.player.holding || A.state === 'dead') fails.push('the hold ended');
    const ok = fails.length === 0; allPass &&= ok;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — no questions over a gun: rows [${rowsGun}], question selectable ${canAsk}; three whips chosen and dropped → stage ${gunTaps.stage}, presses ${gunTaps.presses}, Sam spoke ${gunTaps.samSpoke}; row "${row0}"\n    E → ${armed.variant}, holstered ${armed.holstered}, row "${armed.row.split('  ·  ')[0]}"; three arm taps → stages ${stages.join('/')} on beats ${beats.map(f2).join('/')} s, gave [${[...A.talk.given].join(',') || '—'}]\n    Sam: ${you.join(' | ') || '—'}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
  }
  {
    const S = await stage(701, false); const { W, game, A } = S;   // the arm variant: the choke is the thing aborted here (the whip's abort is gunhold-whip (b))
    grabViaHold(S); untilHeld(S); W.step(DT);
    const since0 = A.held?.since ?? -9; const rec: string[] = [];
    const chk = (label: string) => { const hs = Dlg.heldSinceOf(game, A); rec.push(`${label}: t ${f2(game.time)} held.since ${f2(A.held?.since ?? -1)} talk.heldSince ${f2(A.talk.heldSince)} heldSinceOf ${f2(hs)} lastT ${f2(A.talk.lastT)}`); return hs; };
    const fails: string[] = [];
    if (Math.abs(chk('held') - since0) > 1e-6) fails.push('heldSinceOf ≠ held.since at the start');
    if (Math.abs(A.talk.heldSince - since0) > 1e-6) fails.push(`talk.heldSince ${f2(A.talk.heldSince)} vs held.since ${f2(since0)}: the two clocks disagree`);
    // three questions a couple of seconds apart
    for (let q = 0; q < 3; q++) { tapKey(W, IK); W.step(DT); for (let i = 0; i < 420; i++) W.step(DT); if (Math.abs(chk(`after press ${q + 1}`) - since0) > 1e-6) fails.push(`press ${q + 1} moved the held clock`); }   // (7 s apart: well past his longest answer)
    if (A.talk.stage < 3) fails.push(`staging: only ${A.talk.stage} exchanges went through`);
    // wait past the sandbox lapse (30 s) without a press, then press again: still the hold's clock, and interrogate() must not re-stamp talk.heldSince
    for (let i = 0; i < Math.round((Dlg.HOLD_LAPSE_SECS + 6) / DT); i++) W.step(DT);
    if (Math.abs(chk('36 s of silence later') - since0) > 1e-6) fails.push('the held clock lapsed after 30 s without a press');
    tapKey(W, IK); W.step(DT); W.step(DT);
    if (Math.abs(chk('after a late press') - since0) > 1e-6 || Math.abs(A.talk.heldSince - since0) > 1e-6) fails.push(`a press after the lapse re-stamped the clock (talk.heldSince ${f2(A.talk.heldSince)})`);
    const heldSecs = game.time - since0; const heldTerm = (Dlg.gather(game, A).why as string[]).find(w => /^held /.test(w)) ?? 'held —';
    // the abort term: ease off a choke at 1.5 s
    for (let i = 0; i < 90; i++) W.step(DT);
    const ag0 = Dlg.agitationOf(game, A); const why0 = (Dlg.gather(game, A).why as string[]).join(', ');
    endThenStop(W, 1.5); W.step(DT); W.step(DT);   // the choke chosen, on at 0.35, stopped by a tap at 1.5
    const ag1 = Dlg.agitationOf(game, A); const why1 = (Dlg.gather(game, A).why as string[]).join(', ');
    const termSum = (why: string) => why.split(', ').reduce((acc, w) => acc + (parseFloat(w.split(' ').pop() ?? '0') || 0), 0);   // the terms before the 0‥1 clamp (a steady man held 40 s sits below zero: the clamp would eat the difference)
    const raw0 = termSum(why0), raw1 = termSum(why1);
    if (game.player.holding?.phase !== 'held' || A.state === 'dead') fails.push(`after the aborted choke: ${game.player.holding?.phase}, A ${A.state}`);
    if (A.talk.abortT < 0) fails.push('abortT not stamped by the aborted choke');
    if (Math.abs(raw1 - raw0 - 0.2) > 0.03 || ag1 < ag0) fails.push(`agitation terms ${f3(raw0)} → ${f3(raw1)} (clamped ${f3(ag0)} → ${f3(ag1)}) across the aborted choke (want +0.20)`);
    // E does not let him go (nothing does): it DRAWS — the gun to his head, the hold going on, its clock untouched, and the gun term on him from that frame (+0.10);
    // the one hand-back left with Sam alive to watch is Sam shot down with the man in his arm (combat.ts hitPlayer → freeHeld('shot'), as grab-probes.ts
    // exercises it). The abort term outlives the hold for ABORT_RATTLE_SECS, then goes; the held clock reads -1 free
    tapKey(W, 'KeyE'); for (let i = 0; i < 30; i++) W.step(DT);
    if (game.player.holding?.phase !== 'held' || !A.held || game.player.holding.variant !== 'gun' || A.held.variant !== 'gun' || game.player.holstered) fails.push(`E in the hold: phase ${game.player.holding?.phase ?? 'gone'}, variant ${game.player.holding?.variant}/${A.held?.variant}, holstered ${game.player.holstered} (want still held — and drawn: the gun variant)`);
    if (Math.abs(chk('after E (drawn on him)') - since0) > 1e-6) fails.push('drawing on him moved the held clock');
    if (!/gunToHead \+0\.10/.test((Dlg.gather(game, A).why as string[]).join(', '))) fails.push(`no gunToHead term once drawn on him: [${(Dlg.gather(game, A).why as string[]).join(', ')}]`);
    game.freeHeld('shot'); for (let i = 0; i < 60; i++) W.step(DT);
    const hsFree = Dlg.heldSinceOf(game, A); const whyFree = (Dlg.gather(game, A).why as string[]).join(', ');
    if (game.player.holding || A.held) fails.push(`freeHeld('shot') did not hand him back: holding ${game.player.holding?.phase ?? 'null'}, held ${!!A.held}`);
    if (hsFree !== -1) fails.push(`heldSinceOf ${f2(hsFree)} once let go (want −1)`);
    if (!/aborted \+0\.20/.test(whyFree)) fails.push(`the abort term is gone the second he is free: [${whyFree}]`);
    for (let i = 0; i < Math.round((Dlg.ABORT_RATTLE_SECS + 2) / DT); i++) W.step(DT);
    const whyLater = (Dlg.gather(game, A).why as string[]).join(', ');
    if (/aborted/.test(whyLater)) fails.push(`the abort term still on him ${Dlg.ABORT_RATTLE_SECS} s after release: [${whyLater}]`);
    const ok = fails.length === 0; allPass &&= ok;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — arm hold ${f2(heldSecs)} s, ${A.talk.presses} presses: the clock stayed ${f2(since0)} throughout (${heldTerm}); aborted choke: terms ${f3(raw0)} → ${f3(raw1)} [${why1}] (clamped ${f2(ag0)} → ${f2(ag1)}); free: heldSinceOf ${hsFree}, [${whyFree}] → a minute on [${whyLater}]\n    ${rec.join('\n    ')}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
  }
  {   // the gun term: the same man grabbed drawn vs holstered, everything else equal
    const cell = async (drawn: boolean) => { const S = await stage(702, drawn); grabViaHold(S); untilHeld(S); for (let i = 0; i < 10; i++) S.W.step(DT); return { a: Dlg.agitationOf(S.game, S.A), why: (Dlg.gather(S.game, S.A).why as string[]).join(', ') }; };
    const arm = await cell(false), gun = await cell(true);
    const fails: string[] = []; if (Math.abs(gun.a - arm.a - 0.1) > 0.02) fails.push(`gun ${f3(gun.a)} vs arm ${f3(arm.a)} (want +0.10)`); if (!/gunToHead \+0\.10/.test(gun.why)) fails.push(`no gunToHead term: [${gun.why}]`);
    const ok = fails.length === 0; allPass &&= ok;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — the gun at his head: agitation arm ${f3(arm.a)} [${arm.why}] vs gun ${f3(gun.a)} [${gun.why}]${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
  }
  console.log(`=== gunhold-dialogue: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}

// ================================================================ (5) E with him in the arm: the OTHER hold — draw (the gun to his head) / holster (the knife back). player.ts swapHold: the variant, the hands
//                                                                    (holstered / slot), 0.3 s of lockout, no questions over the gun, one remark per hold, a question in flight dying unanswered; character.ts:
//                                                                    the fist handed over behind his shoulder (holdGunSide flips half way — the props with it), no pop, no NaN, the roots still
/** the knife's boxes in the frame's dynamic list (combat.ts handProps drew them this step) */
const knivesNow = (game: any): number => game.dynBoxes.filter((b: any) => b.name === KNIFE_TAG).length;
function nanBones(...cs: any[]): number { let n = 0; for (const c of cs) for (const k in c.bones) for (const x of c.bones[k]) if (!Number.isFinite(x)) n++; return n; }
/** Press E and step `secs`, tracing every frame: which tool is drawn (knife boxes / pistol boxes by the hand), the animator's side, the hand's travel, NaN, the two
 *  roots. `each(i)` runs before each step (inputs to try under the lockout). Returns the summary the assertions read. */
/** the cursor 6 m dead ahead of Sam at chest height: updateHold turns the pair toward the cursor, so this keeps it facing where it faces (his row is THE row while he
 *  holds somebody wherever the cursor is — Space / LMB still land on it); a cursor put 'on' the man reads the floor beyond him off the camera's ray and turns them */
function ahead(S: any) { const c = S.game.player.char; S.W.cursorAt([c.pos[0] + Math.sin(c.bodyYaw) * 6, 1.1, c.pos[2] + Math.cos(c.bodyYaw) * 6]); }
function swapTrace(S: any, secs: number, each?: (i: number) => void) {
  const { W, game, A } = S; const pc = game.player.char, hc = A.char;
  const p0 = v3.copy(pc.pos), g0 = v3.copy(hc.pos); let prev = v3.copy(pc.bones.handR);
  let firstKnife = -1, firstPistol = -1, lastKnife = -1, lastPistol = -1, both = 0, neither = 0, maxStep = 0, nan = 0, rootP = 0, rootG = 0, sideFlipAt = -1;
  const side0 = pc.anim.holdGunSide; const t0 = game.time; const n = Math.round(secs / DT);
  tapKey(W, 'KeyE');
  for (let i = 0; i < n; i++) {
    ahead(S); each?.(i); W.step(DT); const t = game.time - t0;
    const kn = knivesNow(game), pi = pistolBoxesNearHand(game, 0.6).n;
    if (kn) { if (firstKnife < 0) firstKnife = t; lastKnife = t; } if (pi) { if (firstPistol < 0) firstPistol = t; lastPistol = t; }
    if (kn && pi) both++; if (!kn && !pi) neither++;
    if (sideFlipAt < 0 && pc.anim.holdGunSide !== side0) sideFlipAt = t;
    const h = pc.bones.handR; maxStep = Math.max(maxStep, v3.dist(h, prev)); prev = v3.copy(h);
    nan += nanBones(pc, hc); rootP = Math.max(rootP, v3.distXZ(pc.pos, p0)); rootG = Math.max(rootG, v3.distXZ(hc.pos, g0));
  }
  return { firstKnife, firstPistol, lastKnife, lastPistol, both, neither: neither * DT, maxStep, nan, rootP, rootG, sideFlipAt };
}
const isSamText = (t: string) => Dlg.SAM_LINES.some((l: any) => l.text === t);
const samNeeds = (t: string): string[] => Dlg.SAM_LINES.find((l: any) => l.text === t)?.needs ?? [];
export async function holdDraw() {
  console.log('\n=== hold-draw: E mid-hold — holstered grab (arm, knife) → E → gun (pistol up over ~0.3 s behind his shoulder, LMB fires past him, the whip his one row, no question row) → E → arm (knife back, a tap questions, the choke row chokes); 0.3 s lockout (a status row: taps start nothing); a question in flight dies unanswered; one remark per hold; no pop / NaN / drift ===');
  let allPass = true;
  const verdict = (ok: boolean, label: string, detail: string, fails: string[]) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`); };
  const SW = HOLD.secs.swap;
  // ---- (a) the round trip: arm → E → gun (lockout, then a round past him, a tap that asks nothing) → E → arm (a tap that does, and the choke)
  {
    const S = await stage(901, false); const { W, game, A, msgs } = S;
    grabViaHold(S); const heldOk = untilHeld(S); for (let i = 0; i < 90; i++) { ahead(S); W.step(DT); }   // (settled, and facing held from here on)
    const fails: string[] = [];
    const H0 = game.player.holding; const pre = { variant: H0?.variant, knife: knivesNow(game), pistol: pistolBoxesNearHand(game).n, hide: game.player.char.anim.hideHeldItem, holstered: game.player.holstered };
    if (!heldOk || pre.variant !== 'arm' || pre.knife !== 4 || pre.pistol !== 0 || !pre.hide || !pre.holstered) fails.push(`staging: held ${heldOk}, ${pre.variant}, knife ${pre.knife} pistol ${pre.pistol} hide ${pre.hide} holstered ${pre.holstered} (want the arm hold: knife 4, no pistol)`);
    // E → gun, clicking every frame and tapping Space twice inside the lockout: nothing may come of those (the rows are a status line while the hand is between tools — a tap on it chooses nothing)
    const shots0 = game.mission.stats.shots; let whipSeen = false, lockRows = ''; const bubbleBefore = game.player.bubble;
    const tr = swapTrace(S, 0.45, i => { const t = i * DT; if (t < SW - 2 * DT) { click(W); if (i === 6 || i === 12) { lockRows = game.nearby.map((r: any) => r.verb ?? 'status').join('/'); tapKey(W, IK); } } if (game.player.holding?.phase === 'whip' || (game.player.holding?.windT ?? -1) >= 0) whipSeen = true; });
    const H = game.player.holding; const shotsLock = game.mission.stats.shots - shots0;
    const remark = game.player.bubble && game.player.bubble !== bubbleBefore ? game.player.bubble.text : null;
    if (H?.variant !== 'gun' || A.held?.variant !== 'gun' || game.player.holstered || game.player.slot !== 'pistol') fails.push(`after E: variant ${H?.variant}/${A.held?.variant}, holstered ${game.player.holstered}, slot ${game.player.slot} (want gun/gun, drawn, the pistol selected)`);
    if (tr.lastKnife >= 0) fails.push(`knife boxes still drawn ${f2(tr.lastKnife)} s after E (want gone from the key's frame: the variant is the gun's)`);
    if (tr.firstPistol < 0.05 || tr.firstPistol > SW) fails.push(`the pistol appeared in the hand at +${f2(tr.firstPistol)} s (want half way through the hand-over: 0.05‥${SW})`);
    if (tr.sideFlipAt < 0 || Math.abs(tr.sideFlipAt - tr.firstPistol) > DT + 1e-6) fails.push(`holdGunSide flipped at +${f2(tr.sideFlipAt)} s but the pistol appeared at +${f2(tr.firstPistol)} s (want the same frame)`);
    if (tr.both) fails.push(`knife AND pistol in the fist on ${tr.both} frame(s)`); if (tr.neither > SW) fails.push(`an empty fist for ${f2(tr.neither)} s (want ≤ ${SW})`);
    if (tr.maxStep > 0.12) fails.push(`the hand jumped ${f3(tr.maxStep)} m in one frame during the draw (want a travel, ≤ 0.12)`);
    if (tr.nan) fails.push(`${tr.nan} non-finite bone coordinates through the draw`);
    if (tr.rootP > 0.003 || tr.rootG > 0.003) fails.push(`roots moved for the draw: Sam ${f3(tr.rootP)} him ${f3(tr.rootG)} m`);
    if (shotsLock || whipSeen || lockRows !== 'status') fails.push(`inside the lockout: ${shotsLock} round(s), whip chosen ${whipSeen}, rows [${lockRows}] (want nothing from clicks / taps in the first ${SW} s — the one row a status line)`);
    if (game.player.char.anim.hideHeldItem || pistolBoxesNearHand(game).n < 3) fails.push(`0.45 s after E: hideHeldItem ${game.player.char.anim.hideHeldItem}, ${pistolBoxesNearHand(game).n} pistol boxes by the hand (want the gun up: ≥ 3)`);
    if (!remark || !isSamText(remark) || !samNeeds(remark).includes('gun')) fails.push(`Sam's remark on drawing: ${remark ? `"${remark}"` : 'none'} (want one of his [gun] lines over him)`);
    if (A.talk.stage !== 0 || A.talk.presses !== 0 || H?.ask) fails.push(`the remark / the lockout taps touched the dialogue: stage ${A.talk.stage} presses ${A.talk.presses} ask ${!!H?.ask}`);
    // now a click: one round past him (at the point 6 m ahead the cursor sits on), from beside his head, him untouched
    for (let i = 0; i < 12; i++) { ahead(S); W.step(DT); }
    const head = v3.copy(A.char.bones.head); click(W); let firedAt = -1; const tC = game.time;
    for (let i = 0; i < 30 && firedAt < 0; i++) { W.step(DT); if (game.mission.stats.shots > shots0) firedAt = game.time - tC; }
    const muzzleOff = v3.dist(game.player.char.muzzle, head);
    if (firedAt < 0) fails.push('a click 0.65 s after E fired nothing (the gun should be up and live by then)');
    if (A.state === 'dead') fails.push(`the held man took the round (${A.downKind})`);
    if (muzzleOff > 0.4) fails.push(`the round left ${f2(muzzleOff)} m from his head joint (want from beside it, ≤ 0.4)`);
    // with the gun at his head there is no question row: nothing to select, the whip is the one row (chosen and un-chosen here: nothing to the dialogue)
    for (let i = 0; i < 60; i++) W.step(DT);
    const bub1 = game.player.bubble; const canAsk = game.selectVerb('held', 'question'); const gunRows = game.nearby.map((r: any) => r.verb).join('/');
    tapKey(W, IK); W.step(DT); for (let i = 0; i < 6; i++) W.step(DT); tapKey(W, IK); W.step(DT); for (let i = 0; i < 83; i++) W.step(DT);
    const gunTap = { stage: A.talk.stage, presses: A.talk.presses, spoke: game.player.bubble !== bub1, hint: true };
    if (canAsk || gunRows !== 'whip' || gunTap.stage || gunTap.presses || gunTap.spoke || A.state === 'dead') fails.push(`the gun hold: question selectable ${canAsk}, rows [${gunRows}]; a whip chosen and dropped: stage ${gunTap.stage} presses ${gunTap.presses} Sam spoke ${gunTap.spoke} A ${A.state} (want no question row, nothing said, him up)`);
    // E → arm: the pistol on the thigh from the key's frame (holstered, as E does anywhere), the knife back in the fist half way through; no remark on the way (that is a holstering)
    for (let i = 0; i < 6; i++) { ahead(S); W.step(DT); }
    const bub2 = game.player.bubble;
    const tb = swapTrace(S, 0.45);
    const H2 = game.player.holding;
    if (H2?.variant !== 'arm' || A.held?.variant !== 'arm' || !game.player.holstered) fails.push(`after the second E: variant ${H2?.variant}/${A.held?.variant}, holstered ${game.player.holstered} (want arm/arm, holstered)`);
    if (tb.firstKnife < 0.05 || tb.firstKnife > SW) fails.push(`the knife came back at +${f2(tb.firstKnife)} s (want half way: 0.05‥${SW})`);
    if (tb.lastPistol >= 0) fails.push(`the pistol was still in the hand at +${f2(tb.lastPistol)} s after holstering (want it on the thigh from the key's frame)`);
    if (tb.both) fails.push(`knife AND pistol on ${tb.both} frame(s) holstering`); if (tb.neither > SW) fails.push(`empty fist ${f2(tb.neither)} s holstering`);
    if (tb.maxStep > 0.12 || tb.nan || tb.rootP > 0.003 || tb.rootG > 0.003) fails.push(`holstering: hand step ${f3(tb.maxStep)} m, NaN ${tb.nan}, roots ${f3(tb.rootP)}/${f3(tb.rootG)} m`);
    if (game.player.bubble !== bub2) fails.push(`Sam spoke on HOLSTERING: "${game.player.bubble?.text}"`);
    if (!game.player.char.anim.hideHeldItem || knivesNow(game) !== 4 || pistolBoxesNearHand(game).n) fails.push(`0.45 s after holstering: hide ${game.player.char.anim.hideHeldItem}, knife ${knivesNow(game)}, pistol ${pistolBoxesNearHand(game).n} (want the knife hold back: 4 / 0)`);
    // a tap now: an exchange — Sam's line (not a [gun] one), the answer a beat later
    for (let i = 0; i < 20; i++) W.step(DT);
    tapKey(W, IK); W.step(DT); const asked = !!game.player.holding?.ask; const q1 = game.player.bubble?.text ?? '';
    let ansAt = -1; const tQ = game.time; for (let i = 0; i < 120 && ansAt < 0; i++) { W.step(DT); if (A.talk.stage === 1) ansAt = game.time - tQ; }
    if (!asked || !isSamText(q1) || samNeeds(q1).includes('gun')) fails.push(`the arm tap: ask ${asked}, Sam "${q1}" (want a question up, and not a pistol line)`);
    if (ansAt < 0) fails.push('no answer within 2 s of the arm tap');
    // and the choke still ends it
    for (let i = 0; i < 60; i++) W.step(DT);
    let deadAt = -1; const tK = game.time; endFor(W, HOLD.secs.chokeHold + HOLD.secs.choke + 0.15, () => { if (deadAt < 0 && A.state === 'dead') deadAt = game.time - tK; });
    if (A.downKind !== 'choked' || Math.abs(deadAt - (HOLD.secs.chokeHold + HOLD.secs.choke)) > 0.07) fails.push(`the choke after all that: A ${A.state}/${A.downKind} at +${f2(deadAt)} s (want choked at ${f2(HOLD.secs.chokeHold + HOLD.secs.choke)})`);
    // (with kit handling live — kitanim.ts, on as shipped — the knife is not gone the frame the hold ends: it stays in his fist while the hold's pose lets go of
    //  the arm and is then sheathed by hand; there the rule is 'put away within 1.2 s and not seen again', as hold-pose-probes.ts hold-knife has it)
    if (KITANIM.on && KITANIM.equip) {
      let last = 0, back = false, gap = !knivesNow(game); for (let i = 1; i <= 120; i++) { W.step(DT); if (knivesNow(game)) { if (gap) back = true; last = i; } else gap = true; }
      if (last * DT > 1.2 || back) fails.push(`the knife after the hold ended: last drawn +${f2(last * DT)} s, back after being put away ${back} (want sheathed by hand within 1.2 s, once)`);
    } else if (knivesNow(game)) fails.push('knife boxes after the hold ended');
    verdict(fails.length === 0, '(a) arm → E → gun → E → arm: the hands, the props half way, the lockout, a round past him, no question over the gun, a question after, the choke',
      `draw: pistol at +${f2(tr.firstPistol)} s (side flip +${f2(tr.sideFlipAt)}), knife last +${tr.lastKnife < 0 ? '—' : f2(tr.lastKnife)}, empty ${f2(tr.neither)} s, hand step ≤ ${f3(tr.maxStep)} m, roots ${f3(tr.rootP)}/${f3(tr.rootG)}; lockout: ${shotsLock} rounds, whip ${whipSeen}; remark "${remark ?? '—'}"; round at +${f2(firedAt)} s of the click, ${f2(muzzleOff)} m off his head, A ${A.state === 'dead' ? A.downKind : 'alive then'}; gun tap → stage ${gunTap.stage}, hint ${gunTap.hint}\n    holster: knife at +${f2(tb.firstKnife)} s, pistol last +${tb.lastPistol < 0 ? '—' : f2(tb.lastPistol)}, empty ${f2(tb.neither)} s, hand step ≤ ${f3(tb.maxStep)}; arm tap → "${q1}", answer +${f2(ansAt)} s; choke → ${A.downKind} +${f2(deadAt)} s\n    log: ${msgs.filter(m => !/^teleported/.test(m.text)).map(m => m.text).join(' | ')}`, fails);
  }
  // ---- (b) arm → E → gun, a tap three frames after the key: nothing (the row is a status line under the lockout); a tap the frame the lockout ends: the whip, chokeHold later, landing 'struck'
  {
    const S = await stage(902, false); const { W, game, A } = S;
    grabViaHold(S); untilHeld(S); for (let i = 0; i < 40; i++) W.step(DT);
    const fails: string[] = [];
    tapKey(W, 'KeyE'); W.step(DT); W.step(DT); W.step(DT);
    const tE = game.time - 3 * DT; let whipAt = -1, deadAt = -1;
    tapKey(W, IK); W.step(DT); const early = (game.player.holding?.windT ?? -1) >= 0 || game.player.holding?.phase === 'whip';
    for (let i = 0; i < 60 && !game.nearby.some((r: any) => r.verb === 'whip' && !r.running); i++) W.step(DT);   // the whip row is back the frame the hand is on the gun
    const rowBackAt = game.time - tE; tapKey(W, IK);
    for (let i = 0; i < 150 && deadAt < 0; i++) { W.step(DT); if (whipAt < 0 && game.player.holding?.phase === 'whip') whipAt = game.time - tE; if (A.state === 'dead') deadAt = game.time - tE; }
    for (let i = 0; i < 30; i++) W.step(DT);
    const wantWhip = rowBackAt + HOLD.secs.chokeHold;
    if (early) fails.push('a tap 0.05 s after E chose the whip under the lockout');
    if (rowBackAt < SW - DT - 1e-6 || rowBackAt > SW + 2 * DT + 1e-6) fails.push(`the whip row came back +${f2(rowBackAt)} s after E (want ≈ the lockout, ${SW})`);
    if (whipAt < 0 || Math.abs(whipAt - wantWhip) > 2 * DT + 1e-6) fails.push(`the whip began +${f2(whipAt)} s after E (want ≈ ${f2(wantWhip)}: chokeHold after the tap that could take)`);
    if (A.downKind !== 'struck' || deadAt < 0 || Math.abs(deadAt - whipAt - HOLD.secs.whip) > 2 * DT) fails.push(`landed: A ${A.state}/${A.downKind} at +${f2(deadAt)} s (whip +${f2(whipAt)}; want struck ${HOLD.secs.whip} s after it began)`);
    if (nanBones(game.player.char, A.char)) fails.push('non-finite bones');
    verdict(fails.length === 0, '(b) draw, tap at once: nothing under the lockout; tap as the row comes back: the whip commits chokeHold later and lands', `early tap took ${early}; row back +${f2(rowBackAt)} s; whip +${f2(whipAt)} s after E, down +${f2(deadAt)} s as ${A.downKind}`, fails);
  }
  // ---- (c) grabbed DRAWN: E holsters (arm, knife, no remark — that is for drawing); E again 0.1 s later is swallowed by the lockout; E at +0.4 s draws (the remark now, once); a fourth
  //      and fifth E (holster, draw) bring no second remark
  {
    const S = await stage(903, true); const { W, game, A } = S;
    grabViaHold(S); untilHeld(S); for (let i = 0; i < 40; i++) W.step(DT);
    const fails: string[] = []; const seq: string[] = [];
    const v = () => `${game.player.holding?.variant}${game.player.holstered ? '(h)' : '(d)'}`;
    if (game.player.holding?.variant !== 'gun') fails.push(`staging: ${v()}`);
    const b0 = game.player.bubble; tapKey(W, 'KeyE'); for (let i = 0; i < 6; i++) W.step(DT); seq.push(`E → ${v()}`);
    if (game.player.holding?.variant !== 'arm' || !game.player.holstered) fails.push(`E on a drawn grab: ${v()} (want arm, holstered)`);
    if (game.player.bubble !== b0) fails.push(`a remark on HOLSTERING: "${game.player.bubble?.text}"`);
    tapKey(W, 'KeyE'); for (let i = 0; i < 6; i++) W.step(DT); seq.push(`E@+0.1 → ${v()}`);
    if (game.player.holding?.variant !== 'arm') fails.push('an E 0.1 s after the last was taken (want it swallowed by the lockout)');
    for (let i = 0; i < 14; i++) W.step(DT);
    tapKey(W, 'KeyE'); for (let i = 0; i < 30; i++) W.step(DT); seq.push(`E@+0.43 → ${v()}`);
    const r1 = game.player.bubble !== b0 ? game.player.bubble?.text ?? null : null;
    if (game.player.holding?.variant !== 'gun' || game.player.holstered) fails.push(`E after the lockout: ${v()} (want gun, drawn)`);
    if (!r1 || !samNeeds(r1).includes('gun')) fails.push(`no [gun] remark on the first draw of the hold: ${r1 ? `"${r1}"` : 'none'}`);
    const b1 = game.player.bubble;
    tapKey(W, 'KeyE'); for (let i = 0; i < 30; i++) W.step(DT); seq.push(`E → ${v()}`); tapKey(W, 'KeyE'); for (let i = 0; i < 30; i++) W.step(DT); seq.push(`E → ${v()}`);
    if (game.player.holding?.variant !== 'gun') fails.push(`after holster + draw again: ${v()}`);
    if (game.player.bubble !== b1) fails.push(`a SECOND remark this hold: "${game.player.bubble?.text}"`);
    if (knivesNow(game) || game.player.char.anim.hideHeldItem) fails.push(`ended drawn but knife ${knivesNow(game)} / hide ${game.player.char.anim.hideHeldItem}`);
    if (!game.player.holding || A.state === 'dead' || nanBones(game.player.char, A.char)) fails.push('hold ended / NaN');
    verdict(fails.length === 0, '(c) drawn grab: E holsters (no remark), E inside 0.3 s ignored, E after it draws (the remark, once), later draws silent', `${seq.join(' · ')}; remark "${r1 ?? '—'}"`, fails);
  }
  // ---- (d) a question in flight: tap (Sam asking), E 0.3 s in → the ask is dropped, Sam's bubble becomes the remark, and NO answer lands (stage stays 0); holster, tap → the same first
  //      exchange runs and lands (stage 1). Then, with the man mid-ANSWER, a fresh hold's draw makes no remark over him and does not cut him.
  {
    const S = await stage(904, false); const { W, game, A } = S;
    grabViaHold(S); untilHeld(S); for (let i = 0; i < 40; i++) W.step(DT);
    const fails: string[] = [];
    tapKey(W, IK); W.step(DT); const q0 = game.player.bubble?.text ?? ''; const asked0 = !!game.player.holding?.ask;
    for (let i = 0; i < 18; i++) W.step(DT);
    tapKey(W, 'KeyE'); W.step(DT);
    const afterE = { ask: !!game.player.holding?.ask, bubble: game.player.bubble?.text ?? '', variant: game.player.holding?.variant };
    for (let i = 0; i < 150; i++) W.step(DT);   // 2.5 s: well past any beat
    const st0 = A.talk.stage, pr0 = A.talk.presses;
    if (!asked0 || !q0) fails.push('staging: the first tap opened nothing');
    if (afterE.variant !== 'gun' || afterE.ask) fails.push(`E over the question: variant ${afterE.variant}, ask still ${afterE.ask} (want gun, the ask dropped)`);
    if (afterE.bubble === q0 || !samNeeds(afterE.bubble).includes('gun')) fails.push(`Sam's bubble after E: "${afterE.bubble}" (want the remark in place of "${q0}")`);
    if (st0 !== 0 || pr0 !== 0) fails.push(`an answer landed to the drawn-over question: stage ${st0} presses ${pr0} (want 0 / 0)`);
    tapKey(W, 'KeyE'); for (let i = 0; i < 30; i++) W.step(DT);
    tapKey(W, IK); W.step(DT); const asked1 = !!game.player.holding?.ask; let st1 = -1; for (let i = 0; i < 120; i++) { W.step(DT); if (A.talk.stage === 1) { st1 = 1; break; } }
    if (!asked1 || st1 !== 1) fails.push(`the re-put question after holstering: ask ${asked1}, stage ${A.talk.stage} (want the first exchange to run: → 1)`);
    // mid-answer draw, fresh hold on the same man? He is still held: tap again once ready, and draw while HE speaks
    for (let i = 0; i < 600 && !(game.player.holding && playerMod.heldTalk(game, game.player.holding).ready); i++) W.step(DT);
    tapKey(W, IK); W.step(DT); for (let i = 0; i < 120 && A.talk.stage < 2; i++) W.step(DT);
    const ab = A.bubble; const speaking = !!ab && game.time - ab.t < ab.dur - 0.3; const durBefore = ab?.dur ?? -1; const samB = game.player.bubble;
    // (this hold already remarked at the first draw — so stage a second man? No: the rule under test is 'no remark while he speaks' AND 'once per hold'; use H.remarked to tell them apart)
    const H = game.player.holding; if (H) H.remarked = false;   // (as if he had not yet: isolate the speaking rule)
    tapKey(W, 'KeyE'); W.step(DT); W.step(DT);
    if (!speaking) fails.push('staging: his second answer was not mid-line when E went down');
    if (game.player.bubble !== samB) fails.push(`Sam remarked OVER the man's answer: "${game.player.bubble?.text}"`);
    if (A.bubble !== ab || (ab && ab.dur < durBefore - 1e-9)) fails.push(`the man's answer was cut by the draw (dur ${f2(durBefore)} → ${f2(A.bubble?.dur ?? -1)})`);
    if (H && H.remarked) fails.push('remarked flag set though nothing was said');
    if (!game.player.holding || A.state === 'dead' || nanBones(game.player.char, A.char)) fails.push('hold ended / NaN');
    verdict(fails.length === 0, '(d) drawing over his own question: the ask dies unanswered (stage stands), the remark takes its place; holstered, the question runs afresh; drawing while the MAN speaks: no remark, no cut',
      `tap → "${q0}" · E +0.3 s → ask ${afterE.ask}, bubble "${afterE.bubble}" · 2.5 s on: stage ${st0} · E, tap → stage ${A.talk.stage >= 1 ? 1 : A.talk.stage} · mid-answer E: speaking ${speaking}, Sam silent ${game.player.bubble === samB}`, fails);
  }
  console.log(`=== hold-draw: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}
