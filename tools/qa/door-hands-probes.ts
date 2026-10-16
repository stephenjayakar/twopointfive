// The 'door-hands' probe (run through probes.ts: `bun run tools/qa/probes.ts door-hands`, or this file directly): a man walking a door leaf open — or the player
// easing one by hand — puts his FREE hand on it (game.ts handsOnDoors decides who pushes which leaf and where the palm goes; character.ts doorLayer poses the arm).
// Staged headless on the real Game: (a) the player walking square into the shut conference door from the corridor at walk pace — pistol drawn (the left hand
// must go: the right has the gun), holstered (the free edge is on his right: the right hand), drawn while aiming 55° off to his left (the chest twist the layer
// has to invert), holstered aiming 55° off to his right (turned away: that shoulder is out of reach, the leading left goes), and crouch-walking (the hand level
// with the crouched shoulder, out along the leaf clear of the shoulder the crouch leans onto it); (b) the player cracking that door with Space held from just
// short of touching it — drawn, holstered (the idle stands right shoulder back: at arm's length only the left spans it), holstered aiming left (right shoulder
// forward: the right); (c) the break-room patrol (torch in his right hand) walking his own route out through the break-room's corridor door; (d) the lead's
// page test to the letter — cursor parked top-left (an aim behind him), no aim on the puppet, AI off, the WRIST bone against the leaf plane (pageCase). Per frame while
// the leaf is being pushed and the hand is eased in: the pushing hand's knuckle lies within 6 cm of the face he pushes (and never more than a centimetre into
// it) inside the leaf's rectangle less 5 cm, at 1.0‥1.45 m standing (0.75‥1.05 crouched) — for ≥ 80 % of those frames; it is the expected hand and only that
// hand; shoulder joint → wrist ≤ 0.66 m on both arms every frame (no hyper-extension); once the push ends the hand's weight is under 0.02 within 0.4 s;
// nothing NaN anywhere in his bones. PASS / FAIL per case: a pass prints its summary only; a failure adds what failed, the staging context, the off-tolerance
// samples and the frame trace.
import { standUp, ROOT } from './headless.ts';
const IK = 'Space';
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);

type Vec3 = [number, number, number];
const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f2 = (x: number) => x.toFixed(2), f3 = (x: number) => x.toFixed(3);

/** where a world point sits against door d's leaf: off = distance out of the face on the point's own side (− = inside the wood), along = from the hinge, W = leaf length */
function onLeaf(d: any, p: number[]) {
  const u = d.dir(); const px = p[0] - d.def.hinge[0], pz = p[2] - d.def.hinge[1];
  const perp = u[0] * pz - u[1] * px, along = px * u[0] + pz * u[1];
  return { off: Math.abs(perp) - d.thick / 2, side: perp >= 0 ? 1 : -1, along, W: d.def.width as number };
}
function finiteBones(c: any): boolean { for (const k in c.bones) { const b = c.bones[k]; if (!Number.isFinite(b[0]) || !Number.isFinite(b[1]) || !Number.isFinite(b[2])) return false; } return true; }

interface Watch { c: any; door: any; expect: 'L' | 'R'; label: string; yBand?: [number, number]; }   // yBand: where the knuckle must sit (default standing chest height, 1.0‥1.45)
interface Tally { pushFrames: number; easedFrames: number; onLeaf: number; wrongHand: number; maxReachL: number; maxReachR: number; nan: number; endT: number; offAt: number; maxOffAfter: number; peakW: number; worstInto: number; heights: number[]; trace: string[]; sideAtPush: number; }
const newTally = (): Tally => ({ pushFrames: 0, easedFrames: 0, onLeaf: 0, wrongHand: 0, maxReachL: 0, maxReachR: 0, nan: 0, endT: -1, offAt: -1, maxOffAfter: 0, peakW: 0, worstInto: 0, heights: [], trace: [], sideAtPush: 0 });

/** one frame's bookkeeping for a watched man against his door */
function observe(game: any, w: Watch, T: Tally, f: number) {
  const c = w.c, an = c.anim, d = w.door; const dp = an.doorPush; const hw = an.doorHands();
  if (!finiteBones(c) || !Number.isFinite(hw.L) || !Number.isFinite(hw.R)) T.nan++;
  T.maxReachL = Math.max(T.maxReachL, v3.dist(c.bones.upperArmL, c.bones.handL)); T.maxReachR = Math.max(T.maxReachR, v3.dist(c.bones.upperArmR, c.bones.handR));
  const wExp = w.expect === 'L' ? hw.L : hw.R, wOther = w.expect === 'L' ? hw.R : hw.L;
  T.peakW = Math.max(T.peakW, wExp, wOther);
  const pushing = !!dp && dp.w >= 1;
  if (pushing) {
    T.pushFrames++; T.endT = -1; T.offAt = -1;
    if (T.sideAtPush === 0) T.sideAtPush = onLeaf(d, c.pos).side;
    if (wOther > 0.1) T.wrongHand++;
    if (wExp > 0.9) {
      T.easedFrames++;
      const k = w.expect === 'L' ? c.bones.fingerL : c.bones.fingerR; const q = onLeaf(d, k);
      const [y0, y1] = w.yBand ?? [1.0, 1.45];
      const ok = q.side === T.sideAtPush && q.off <= 0.06 && q.off >= -0.01 && q.along >= 0.05 && q.along <= q.W - 0.05 && k[1] >= y0 && k[1] <= y1;
      if (ok) T.onLeaf++; if (q.side === T.sideAtPush) T.worstInto = Math.min(T.worstInto, q.off); else T.worstInto = Math.min(T.worstInto, -q.off - d.thick);
      T.heights.push(k[1]);
      if (!ok && T.trace.length < 14) T.trace.push(`      f${f} ✗ knuckle off ${f3(q.off)} along ${f2(q.along)}/${f2(q.W)} y ${f2(k[1])} side ${q.side}/${T.sideAtPush} door ${f2(d.angle)}`);
    }
  } else if (T.pushFrames > 0) {
    if (T.endT < 0) T.endT = game.time;
    const since = game.time - T.endT;
    if (wExp < 0.02 && T.offAt < 0) T.offAt = since;
    if (since > 0.4) T.maxOffAfter = Math.max(T.maxOffAfter, wExp);
  }
  if (f % 6 === 0 && T.trace.length < 60 && (pushing || (T.endT >= 0 && game.time - T.endT < 0.6))) {
    const k = w.expect === 'L' ? c.bones.fingerL : c.bones.fingerR; const q = onLeaf(d, k);
    T.trace.push(`      f${f} t${f2(game.time)} ${pushing ? 'PUSH' : 'after'} door ${f2(d.angle)} wL ${f2(hw.L)} wR ${f2(hw.R)} knuckle${w.expect} off ${f3(q.off)} along ${f2(q.along)} y ${f2(k[1])} pos (${f2(c.pos[0])}, ${f2(c.pos[2])}) aimOff ${f2(c.aimYaw - c.bodyYaw)} upper ${an.upper}${dp ? ` hand ${dp.hand < 0 ? '?' : dp.hand ? 'R' : 'L'}` : ''}`);
  }
}
/** the case's PASS / FAIL and what to print for it: the summary always; the failures, the staging `context`, the off-tolerance samples and the trace only when it failed */
function verdict(w: Watch, T: Tally, opts: { minPush?: number; minEased?: number; context?: string } = {}): { pass: boolean; lines: string[] } {
  const fails: string[] = [];
  const frac = T.easedFrames ? T.onLeaf / T.easedFrames : 0;
  if (T.pushFrames < (opts.minPush ?? 20)) fails.push(`only ${T.pushFrames} pushing frames — the staging never got him walking the leaf open`);
  if (T.easedFrames < (opts.minEased ?? 10)) fails.push(`the ${w.expect} hand never eased in (peak weight ${f2(T.peakW)}, ${T.easedFrames} eased frames)`);
  else if (frac < 0.8) fails.push(`hand on the leaf face only ${(100 * frac).toFixed(0)} % of the eased-in pushing frames (< 80 %)`);
  if (T.worstInto < -0.01) fails.push(`knuckle ${f3(-T.worstInto)} m INTO the leaf at worst`);
  if (T.wrongHand > 0) fails.push(`the other hand came up on ${T.wrongHand} pushing frames (expected only the ${w.expect})`);
  if (T.maxReachL > 0.66 || T.maxReachR > 0.66) fails.push(`hyper-extension: shoulder→wrist L ${f2(T.maxReachL)} R ${f2(T.maxReachR)} m (> 0.66)`);
  if (T.endT >= 0 && (T.offAt < 0 || T.offAt > 0.4)) fails.push(`after the push the hand took ${T.offAt < 0 ? 'for ever' : f2(T.offAt) + ' s'} to come off (> 0.4 s)`);
  if (T.maxOffAfter > 0.02) fails.push(`hand weight came back to ${f2(T.maxOffAfter)} more than 0.4 s after the push with no new push`);
  if (T.nan) fails.push(`${T.nan} frames with a NaN in the bones / weights`);
  const hs = T.heights; const hLine = hs.length ? `knuckle height ${f2(Math.min(...hs))}‥${f2(Math.max(...hs))} m` : 'no heights';
  const lines = [`- ${fails.length ? 'FAIL' : 'PASS'} — ${w.label}`, `    ${T.pushFrames} pushing frames, ${T.easedFrames} eased in, on the face ${T.easedFrames ? (100 * frac).toFixed(0) : '—'} %; ${hLine}; worst into-leaf ${f3(Math.max(0, -T.worstInto))} m; reach L ${f2(T.maxReachL)} R ${f2(T.maxReachR)}; off after ${T.offAt < 0 ? '—' : f2(T.offAt) + ' s'}; peak weight ${f2(T.peakW)}`];
  if (fails.length) {   // (a pass keeps its off-tolerance samples and the trace to itself: they are inside the 80 % / 1 cm the case allows)
    for (const fl of fails) lines.push('    ✗ ' + fl);
    if (opts.context) lines.push('    ' + opts.context);
    lines.push(...T.trace.slice(0, 40));
  }
  return { pass: fails.length === 0, lines };
}

/** the common stage: guards parked deaf on the lot (unless `keepGuard`), Sam invisible and immortal, the conference door pulled shut and latched */
async function stage(seed: number, keepGuard = -1) {
  Math.random = seeded(seed);
  const W = await standUp(); const { game } = W;
  game.playerInvisible = true; game.godMode = true;
  for (let i = 0; i < 10; i++) W.step(DT);
  game.guards.forEach((o: any, i: number) => { if (i === keepGuard) return; o.hold = true; o.heardUpTo = 1e12; o.char.pos = [37.5, 0, 5 + i * 1.5]; o.char.vel = [0, 0, 0]; o.path = []; o.pathGoal = null; o.char.update(0); });
  const conf = game.doors.byName('conference'); conf.angle = 0; conf.vel = 0; conf.latched = true; conf.closing = false; conf.quietT = 10; conf.place();
  return { W, game, conf };
}

// ================================================================ (a) the player walks the conference door open from the corridor
async function walkCase(label: string, opts: { holstered: boolean; aimSide?: number; crouch?: boolean; expect: 'L' | 'R' }): Promise<boolean> {
  const { W, game, conf } = await stage(5);
  const pl = game.player, pc = pl.char;
  game.teleportPlayer([9.72, 0, 11.35]); pl.holstered = opts.holstered; pl.slot = 'pistol'; pl.pistol.lightOn = false; pl.crouch = !!opts.crouch;
  pc.bodyYaw = pc.aimYaw = Math.PI; pc.update(0);
  const aim: Vec3 = opts.aimSide ? [9.72 + Math.sin(Math.PI + opts.aimSide) * 6, 1.2, 11.35 + Math.cos(Math.PI + opts.aimSide) * 6] : [9.72, 1.2, 4.5];
  game.puppet = { goal: [9.72, 0, 8.4], aim, walk: 1, crouch: !!opts.crouch };
  const w: Watch = { c: pc, door: conf, expect: opts.expect, label, yBand: opts.crouch ? [0.75, 1.05] : undefined }; const T = newTally();
  for (let f = 0; f < 60 * 5; f++) {
    if (opts.aimSide && game.puppet) game.puppet.aim = [pc.pos[0] + Math.sin(Math.PI + opts.aimSide) * 6, 1.2, pc.pos[2] + Math.cos(Math.PI + opts.aimSide) * 6];   // the aim point travels with him: a constant bearing off his walk
    W.step(DT); observe(game, w, T, f);
  }
  game.puppet = null;
  const v = verdict(w, T); console.log(v.lines.join('\n')); return v.pass;
}

// ================================================================ (b) the player eases the conference door from its 'ease it open' row (tapped: it runs on its own), standing off it (root 0.43 m off the leaf's mid-plane: 6 cm short of touching it)
async function crackCase(label: string, opts: { holstered: boolean; aimSide?: number; expect: 'L' | 'R' }): Promise<boolean> {
  const { W, game, conf } = await stage(6);
  const pl = game.player, pc = pl.char, input = W.input;
  game.teleportPlayer([9.75, 0, 10.6]); pl.holstered = opts.holstered; pl.slot = 'pistol'; pl.pistol.lightOn = false; pl.crouch = false;
  pc.pos = [9.75, 0, 10.43]; pl.safe = [9.75, 0, 10.43];   // (the teleport's own settle is head-height tall and stands him off the frame's head piece at 0.49; walking height clears it — put him where a careful step stops, the sweep re-based as a teleport does)
  pc.bodyYaw = pc.aimYaw = Math.PI; pc.update(0);
  const a = Math.PI + (opts.aimSide ?? 0); game.puppet = { goal: null, aim: [9.75 + Math.sin(a) * 5, 1.2, 10.47 + Math.cos(a) * 5] };   // the aim: dead ahead through the door, or off to one side (the chest twists that way, that shoulder goes back)
  for (let i = 0; i < 40; i++) W.step(DT);
  const hovered = game.useDoor === conf; const eased = game.selectVerb('door', 'ease');
  const w: Watch = { c: pc, door: conf, expect: opts.expect, label }; const T = newTally();
  input.pressed.add(IK);   // the row tapped: from the next frame it comes round at 0.55 rad/s on its own, standing at EASE_MAX ≈ 1.45 unless stopped
  let f = 0;
  for (; f < Math.round(2.6 / DT); f++) { W.step(DT); observe(game, w, T, f); }   // ~2.6 s: the whole ease and a moment standing open
  for (let i = 0; i < 90; i++, f++) { W.step(DT); observe(game, w, T, f); }
  game.puppet = null;
  const context = `(door hovered as useDoor at the start: ${hovered}, ease row ${eased}; eased to ${f2(conf.angle)} rad; player at (${f2(pc.pos[0])}, ${f2(pc.pos[2])}) yaw ${f2(pc.bodyYaw)} aim off ${f2(pc.aimYaw - pc.bodyYaw)})`;
  const v = verdict(w, T, { minEased: 15, context }); console.log(v.lines.join('\n')); return v.pass;
}

// ================================================================ (c) the break-room patrol walks his own route out through the break-room's corridor door
async function guardCase(label: string): Promise<boolean> {
  const GI = 2;   // routes[2] = lobby_break: (30.6, 16) → (33.5, 21) → (30.5, 13.0) → (14, 11.0) … — leg 3 → 4 goes out through breakroom_n
  const { W, game } = await stage(7, GI);
  const gd = game.guards[GI], c = gd.char; const d = game.doors.byName('breakroom_n');
  d.angle = 0; d.vel = 0; d.latched = true; d.closing = false; d.quietT = 10; d.place();
  game.teleportPlayer([6, 0, 22]);   // Sam out of it in the lobby
  c.pos = [30.6, 0, 14.2]; c.vel = [0, 0, 0]; c.bodyYaw = c.aimYaw = Math.PI; gd.state = 'patrol'; gd.awareness = 0; gd.wp = 3; gd.wait = 0; gd.path = []; gd.pathGoal = null; gd.hold = false; c.update(0); c.update(DT);
  const w: Watch = { c, door: d, expect: 'L', label }; const T = newTally();
  for (let f = 0; f < 60 * 9; f++) { W.step(DT); observe(game, w, T, f); }
  const context = `(guard ${gd.callsign} ended at (${f2(c.pos[0])}, ${f2(c.pos[2])}) ${gd.state}, drawn ${gd.drawn}, torch dropped ${!!gd.dropped}; door now ${f2(d.angle)})`;
  const v = verdict(w, T, { context }); console.log(v.lines.join('\n')); return v.pass;
}


// ================================================================ (d) the lead's page test, to the letter: guards parked, AI off, the cursor never moved (Input's own 0,0 — top-left of the view: an aim
// somewhere behind or beside him, which is what had him BACKING into the leaf and the layer, rightly, keeping a hand off wood behind his shoulders), teleport,
// puppet { goal, walk: true } with NO aim, and the measurement on the real skinned WRIST bone (bones.handL / handR after game.update, world space) against the real
// leaf plane (def.hinge, closedDir + angle) over the frames the leaf stands between 0.05 and 1.0 rad with a push live: within 6 cm of the face and never in it,
// 1.0‥1.45 m up, the elbow (forearm bone) below the wrist, the expected hand up and the other down — ≥ 80 % of those frames
async function pageCase(label: string, opts: { door: string; from: Vec3; to: Vec3; holstered: boolean; expect: 'L' | 'R'; shut?: boolean; seed?: number }): Promise<boolean> {
  Math.random = seeded(opts.seed ?? 707);   // (reseeded like stage(): the world's construction dice must not depend on whatever the previous case left in Math.random)
  const W = await standUp(); const { game, input } = W;
  for (let i = 0; i < 5; i++) W.step(DT);
  game.aiEnabled = false; game.godMode = true;
  game.guards.forEach((o: any, i: number) => { o.char.pos = [37, 0, 6 + i * 1.5]; o.char.update(0); });
  const d = game.doors.byName(opts.door); if (opts.shut) { d.angle = 0; d.vel = 0; d.latched = true; d.closing = false; d.place(); }
  game.teleportPlayer(opts.from); game.player.holstered = opts.holstered; game.player.slot = 'pistol'; game.player.pistol.lightOn = false;
  input.mouseX = 0; input.mouseY = 0;
  game.puppet = { goal: opts.to, walk: true } as any;
  const c = game.player.char; let frames = 0, ok = 0, wrong = 0; const bad: string[] = [];
  for (let f = 0; f < 300; f++) {
    W.step(DT);
    const dp = c.anim.doorPush; if (!dp || dp.w < 1 || Math.abs(d.angle) < 0.05 || Math.abs(d.angle) > 1.0) continue;
    frames++;
    const a = d.def.closedDir + d.angle, u = [Math.cos(a), Math.sin(a)]; const perp = (p: number[]) => u[0] * (p[2] - d.def.hinge[1]) - u[1] * (p[0] - d.def.hinge[0]);
    const wrist = opts.expect === 'L' ? c.bones.handL : c.bones.handR, elbow = opts.expect === 'L' ? c.bones.forearmL : c.bones.forearmR;
    const hw = c.anim.doorHands(); const wExp = opts.expect === 'L' ? hw.L : hw.R, wOther = opts.expect === 'L' ? hw.R : hw.L;
    const off = Math.abs(perp(wrist)) - d.thick / 2, sameSide = Math.sign(perp(wrist)) === Math.sign(perp(c.pos));
    const good = sameSide && off <= 0.06 && off >= -0.005 && wrist[1] >= 1.0 && wrist[1] <= 1.45 && elbow[1] < wrist[1] && wExp > 0.9;
    if (good) ok++; else if (bad.length < 6) bad.push(`      f${f} ✗ door ${f2(d.angle)} wrist off ${f3(off)}${sameSide ? '' : ' (FAR side)'} y ${f2(wrist[1])} elbow y ${f2(elbow[1])} w${opts.expect} ${f2(wExp)} other ${f2(wOther)} hand fed ${dp.hand < 0 ? '?' : dp.hand ? 'R' : 'L'} body ${f2(c.bodyYaw)} aimOff ${f2(c.anim.aimYawOffset)} backpedal ${game.player.backpedal}`);
    if (wOther > 0.1) wrong++;
  }
  const frac = frames ? ok / frames : 0; const fails: string[] = [];
  if (frames < 10) fails.push(`only ${frames} frames with the leaf between 0.05 and 1.0 rad under a live push (staging off)`);   // (10: a real 0.86 m leaf is walked from 0.05 to 1.0 rad in about three quarters of the frames a 1.16 m one took — 11 or 12 at a walk — the same stride on a shorter lever; the bar was 15 on the wide doors)
  if (frac < 0.8) fails.push(`wrist on the face, at height, elbow under it, ${opts.expect} hand up on only ${(100 * frac).toFixed(0)} % of those frames (< 80 %)`);
  if (wrong) fails.push(`the other hand came up on ${wrong} frames`);
  console.log(`- ${fails.length ? 'FAIL' : 'PASS'} — ${label}\n    ${frames} frames in the window, ${ok} good (${(100 * frac).toFixed(0)} %)${fails.map(x => '\n    ✗ ' + x).join('')}${fails.length && bad.length ? '\n' + bad.join('\n') : ''}`);   // (the odd bad frame inside the 80 % stays quiet on a pass)
  return fails.length === 0;
}

export async function doorHands(): Promise<boolean> {
  console.log('\n=== door-hands: a man walking a leaf open (or easing it) puts his free hand on it — where, which hand, how far, how fast it comes off ===');
  let all = true;
  all = await walkCase('player, pistol drawn (two-hand ready carry), walks square into the shut conference door: the LEFT hand goes on it', { holstered: false, expect: 'L' }) && all;
  all = await walkCase('player, holstered (hands free), same walk: the free edge is on his right, so the RIGHT hand', { holstered: true, expect: 'R' }) && all;
  all = await walkCase('player, pistol drawn, aiming 55° off to his left the whole way (the chest comes square for the push through the twist chain, and back): the left hand ON the leaf', { holstered: false, aimSide: 55 * Math.PI / 180, expect: 'L' }) && all;
  all = await walkCase('player, holstered, aiming 55° off to his RIGHT: he squares his shoulders to the leaf for the push (the head keeps the aim), edge on his right — the RIGHT hand', { holstered: true, aimSide: -55 * Math.PI / 180, expect: 'R' }) && all;
  all = await walkCase('player CROUCH-walks into it, pistol drawn: the left hand, level with the crouched shoulder (~0.9 m), pushed out along the leaf clear of the shoulder the crouch leans onto it', { holstered: false, crouch: true, expect: 'L' }) && all;
  all = await crackCase('player, pistol drawn, cracks the conference door with Space held (aim dead ahead): the left hand eases it, off again once out of reach / Space up', { holstered: false, expect: 'L' }) && all;
  all = await crackCase('player, holstered, cracks it aiming dead ahead: the idle stands right shoulder back, so at arm\'s length only the LEFT spans it', { holstered: true, expect: 'L' }) && all;
  all = await crackCase('player, holstered, cracks it aiming 40° to his left: he squares up to the leaf all the same (the aim only turns his head), so the same LEFT', { holstered: true, aimSide: 40 * Math.PI / 180, expect: 'L' }) && all;
  // the lead's page test (see pageCase): breakroom_n from the corridor is met facing north, its free edge (x 31.18) on his LEFT — the left hand whether the pistol
  // is drawn or holstered; from the break-room side the edge is on his right — the right when holstered; the conference door from the corridor likewise the right
  all = await pageCase('PAGE TEST breakroom_n from the corridor, DRAWN, cursor parked top-left (aim behind him): squares up to it, LEFT hand on the wood, elbow under the wrist', { door: 'breakroom_n', from: [30.66, 0, 10.9], to: [30.66, 0, 14.2], holstered: false, expect: 'L' }) && all;
  all = await pageCase('PAGE TEST breakroom_n from the corridor, HOLSTERED: the free edge is on his LEFT facing north, so the LEFT hand (not the right)', { door: 'breakroom_n', from: [30.66, 0, 10.9], to: [30.66, 0, 14.2], holstered: true, expect: 'L' }) && all;
  all = await pageCase('PAGE TEST breakroom_n from the break-room side, HOLSTERED: edge on his right facing south, the RIGHT hand', { door: 'breakroom_n', from: [30.66, 0, 13.5], to: [30.66, 0, 9.4], holstered: true, expect: 'R' }) && all;
  all = await pageCase('PAGE TEST breakroom_n from the break-room side, DRAWN: the left', { door: 'breakroom_n', from: [30.66, 0, 13.5], to: [30.66, 0, 9.4], holstered: false, expect: 'L' }) && all;
  all = await pageCase('PAGE TEST conference (pulled shut) from the corridor, HOLSTERED: edge on his right facing south, the RIGHT hand', { door: 'conference', from: [9.72, 0, 11.35], to: [9.72, 0, 8.3], holstered: true, expect: 'R', shut: true }) && all;
  all = await pageCase('PAGE TEST conference (pulled shut) from the corridor, DRAWN: the left', { door: 'conference', from: [9.72, 0, 11.35], to: [9.72, 0, 8.3], holstered: false, expect: 'L', shut: true }) && all;
  all = await pageCase('PAGE TEST conference (pulled shut) from inside the room, HOLSTERED: edge on his left facing north, the LEFT hand', { door: 'conference', from: [9.72, 0, 8.7], to: [9.72, 0, 12.0], holstered: true, expect: 'L', shut: true }) && all;
  all = await guardCase('the break-room patrol (torch in the right hand) walks his route out through the break-room corridor door: left hand on the leaf') && all;
  console.log(`\n=== door-hands: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}

if (import.meta.main) { const ok = await doorHands(); process.exit(ok ? 0 : 1); }
