// 'gunwall' — a raised weapon comes to the low ready at a wall instead of being drawn through it (src/game/gunwall.ts GUNWALL):
//   bun run tools/qa/probes.ts gunwall [--verbose]     (`bun run tools/qa/gunwall-probes.ts` runs it alone: exit 0 / 1)
// All headless, against the office's south outer wall (0.24 m thick, its outside face on the open strip at z 3.88):
//   gun-men       a teammate (FN2000), a defender (carbine) and a defender (pistol) stood pressed to it by an order, facing it, gun up: with the rule OFF the arm
//                 or the gun is in the wall (the watcher's rays: shoulder → hand → muzzle); ON the gun is at the low ready, pulled in, nothing of it in the wall,
//                 and the man says so (Guard.muzzleDown — the fire gates' bit). A metre and a half back the gun is up and the pose is the same to the bit.
//   gun-sam       Sam the same way with the pistol and the FN2000: off in the wall; on at the low ready, out of it, and a click fires nothing; back: it fires
//   gun-walk      a teammate WALKS at the wall with the rifle shouldered and stops against it: on, no frame of the walk has the gun in the wall
//   gun-beside    facing ALONG the wall, a hand off its face, and a wall well past the muzzle: the gun stays up (the rule asks the gun's own line)
//   gun-band      carried two millimetres at a time to the wall and back: the gun goes down once and comes up once, further out than it went down
//   gun-lock      aiming AT a point on the surface itself (the shotgun on a lock): it stays up
//   gun-hot       a man in his sights (GuardScript.over): down only while the gun IS in the wall — none of the room a calm man keeps
//   gun-model     the rule's worked-out carriages (copies of what character.ts's tables come out as) against the posed gun in open floor
//   gun-off       the rule off asks nothing and touches nothing; gun-harness: the frozen stand holds it off, the shipped stand turns it on
// THE HARNESS HAS NO GPU: nothing here is a picture. What is measured is where the bones and the muzzle the renderer is handed stand against the collision boxes.
import { standUp, ROOT } from './headless.ts';
import { gunThrough, carriageOf } from './gunwall-watch.ts';
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const { mulberry32 } = await import(`${ROOT}/src/math/dice.ts`);
const { AIM } = await import(`${ROOT}/src/game/aim.ts`);
const { GUNWALL, GUNWALL_STATS, gunWallModel } = await import(`${ROOT}/src/game/gunwall.ts`);
const { spawnUnit, despawnUnit } = await import(`${ROOT}/src/game/guards.ts`);
const { order } = await import(`${ROOT}/src/game/squad.ts`);
type Vec3 = [number, number, number];
const DT = 1 / 60;
const f2 = (x: number) => x.toFixed(2), f3 = (x: number) => x.toFixed(3);
let allPass = true;
const verdict = (ok: boolean, label: string, detail: string) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
const X = 12, NORTH = 0, PRESS = 3.56;   // (PRESS: a man's centre a body's radius and a finger off the wall's face)
let NEAR = 3.88;
function park(gd: any, i: number) { gd.hold = true; gd.pinned = true; gd.char.pos = [37.5, 0, 6 + i * 1.5]; gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.path = []; gd.pathGoal = null; gd.heardUpTo = 1e12; gd.flashlight.enabled = false; }
async function stage(seed: number, on: boolean) {
  Math.random = mulberry32(seed);
  const W: any = await standUp(); const g = W.game; GUNWALL.on = on; AIM.player.level = 1;   // (the shipped aim: the gun level along the cursor's heading)
  g.godMode = true; g.infiniteAmmo = false; g.player.visibility = 0.02;
  for (let i = 0; i < 5; i++) W.step(DT);
  g.guards.forEach((gd: any, i: number) => park(gd, i));
  const a = g.col.raycast([X, 1.3, 2], [0, 0, 1], 6); if (!a) throw new Error('gunwall: the south wall is not where the probe expects it');
  NEAR = 2 + a.t;
  return W;
}
/** a unit stood at z facing the wall by an order, gun up at a point well beyond it; the frames run until his pose has settled */
function manAt(W: any, team: 'operative' | 'guard', weapon: string, z: number, o: any = {}) {
  const g = W.game; const gd = spawnUnit(g, { team, pos: [X, 0, z], yaw: NORTH, weapon, light: false });
  order(gd, { goal: [X, 0, z], face: NORTH, aimAt: [X, 1.35, 12], upper: 'aim', hot: true, ...o });
  for (let i = 0; i < 90; i++) W.step(DT);
  return gd;
}
const snap = (W: any, c: any) => ({ how: carriageOf(c), through: gunThrough(W.game.col, c), muzzle: v3.copy(c.muzzle) as Vec3, short: NEAR - c.muzzle[2] });

async function gunMen() {
  console.log('\n=== gun-men: pressed to the wall, facing it, gun up — off: the gun is in the wall; on: the low ready, pulled in, out of it; back from the wall: up, the same pose ===');
  for (const [team, weapon, what] of [['operative', 'fn2000', 'teammate, FN2000'], ['guard', 'aks74u', 'defender, carbine'], ['guard', 'guard9mm', 'defender, pistol']] as const) {
    const Wo = await stage(31, false), a = manAt(Wo, team, weapon, PRESS), A = snap(Wo, a.char), Wn = await stage(31, true), b = manAt(Wn, team, weapon, PRESS), B = snap(Wn, b.char), fails: string[] = [];
    if (!A.through) fails.push(`off: nothing of the gun is in the wall (muzzle ${f3(A.short)} m short of the face) — the staging no longer reaches it`);
    if (a.muzzleDown) fails.push('off: his gun is down');
    if (B.through) fails.push(`on: the ${B.through.seg} is still in the wall`);
    if (!(B.short > 0.01)) fails.push(`on: the muzzle is ${f3(B.short)} m short of the face`);
    if (!b.muzzleDown) fails.push('on: he does not count his gun as down (muzzleDown)');
    if (b.char.anim.upper === 'aim' || b.char.anim.stance !== 'lowReady') fails.push(`on: he is posed ${b.char.anim.upper} / ${b.char.anim.stance}, not the low ready`);
    if (!(b.char.anim.gunWall > 0.3)) fails.push(`on: the low ready is not pulled in (gunWall ${f2(b.char.anim.gunWall)})`);
    despawnUnit(Wo.game, a); despawnUnit(Wn.game, b);
    const a2 = manAt(Wo, team, weapon, 2.0), b2 = manAt(Wn, team, weapon, 2.0), far = v3.len(v3.sub(a2.char.muzzle, b2.char.muzzle));
    if (b2.muzzleDown || b2.char.anim.upper !== 'aim' || b2.char.anim.gunWall !== 0) fails.push('on, back from the wall: the gun is not up');
    if (far > 1e-9) fails.push(`back from the wall the muzzle differs by ${far} m between the two`);
    verdict(!fails.length, `${what}: off the ${A.through?.seg ?? 'gun'} is in the wall (${A.how}); on it is at the low ready, the muzzle ${f2(B.short)} m short of the face; 1.9 m back it is up, to the bit`,
      fails.join('; ') || `he stands at z ${f2(b.char.pos[2])} · wall face ${f2(NEAR)} · off: muzzle z ${f3(A.muzzle[2])} · on: muzzle z ${f3(B.muzzle[2])}, ${B.how}, gunWall ${f2(b.char.anim.gunWall)}`);
  }
}

function hold(W: any, p: Vec3, n: number, click = false) { for (let i = 0; i < n; i++) { W.cursorAt(p); if (click && i === n - 1) W.input.clicked |= 1; W.step(DT); } }
function samAt(W: any, z: number, gun: 'rifle' | 'pistol') {
  const g = W.game, pl = g.player, input = W.input;
  g.teleportPlayer([X, 0, z]); pl.crouch = false; pl.char.bodyYaw = pl.char.aimYaw = NORTH; W.cam.yaw = 0; W.cam.rebuild(); W.step(DT);
  if (!(gun === 'rifle' ? pl.rifleUp : pl.pistolUp)) { input.pressed.add(gun === 'rifle' ? 'Digit2' : 'Digit1'); W.step(DT); }
  hold(W, [X, 0, 3.7], 20); if (gun === 'pistol' && !pl.pistol.lightOn) input.pressed.add('KeyL');   // (the pistol is up while its light is on)
  hold(W, [X, 0, 3.7], 90);
  const firearm = gun === 'rifle' ? pl.rifle : pl.pistol, r0 = firearm.roundsReady;
  hold(W, [X, 0, 3.7], 2, true); hold(W, [X, 0, 3.7], 20);
  return { ...snap(W, pl.char), fired: r0 - firearm.roundsReady, up: gun === 'rifle' ? pl.rifleUp : pl.pistolUp, upper: pl.char.anim.upper, z: pl.char.pos[2] as number };
}
async function gunSam() {
  console.log('\n=== gun-sam: Sam pressed to the wall, pistol then FN2000 — off: in the wall and it fires; on: the low ready, out of it, and a click fires nothing; back: it fires ===');
  for (const gun of ['pistol', 'rifle'] as const) {
    const off = samAt(await stage(32, false), 3.45, gun), W = await stage(32, true), on = samAt(W, 3.45, gun), back = samAt(W, 2.0, gun), fails: string[] = [];
    if (!off.up || !on.up) fails.push('the gun is not in his hands');
    if (!off.through) fails.push(`off: nothing of the gun is in the wall (muzzle ${f3(off.short)} m short) — the staging no longer reaches it`);
    if (off.fired !== 1) fails.push(`off: the click fired ${off.fired} rounds`);
    if (on.through) fails.push(`on: the ${on.through.seg} is still in the wall`);
    if (on.upper === 'aim') fails.push('on: he is still posed aiming');
    if (on.fired !== 0) fails.push(`on: the click fired ${on.fired} rounds with the gun down`);
    if (back.through || back.fired !== 1 || back.upper !== 'aim') fails.push(`on, back from the wall: ${back.upper}, fired ${back.fired}`);
    verdict(!fails.length, `${gun}: off it is in the wall and fires into it; on it is at the low ready ${f2(on.short)} m short of the face and stays silent; back from the wall it is up and fires`,
      fails.join('; ') || `he stands at z ${f2(on.z)} · wall face ${f2(NEAR)} · off: muzzle z ${f3(off.muzzle[2])} (${off.how}) · on: muzzle z ${f3(on.muzzle[2])} (${on.how ?? on.upper})`);
  }
}

async function gunWalk() {
  console.log('\n=== gun-walk: a teammate walks at the wall with the rifle shouldered and stops against it — on: no frame has the gun in the wall ===');
  const run = async (on: boolean) => { const W = await stage(33, on), g = W.game, gd = spawnUnit(g, { team: 'operative', pos: [X, 0, 1.4], yaw: NORTH, weapon: 'fn2000', light: false });
    order(gd, { goal: [X, 0, 1.4], face: NORTH, aimAt: [X, 1.35, 12], upper: 'aim', hot: true }); for (let i = 0; i < 60; i++) W.step(DT);
    order(gd, { goal: [X, 0, NEAR - 0.1], face: NORTH, aimAt: [X, 1.35, 12], upper: 'aim', hot: true });
    let through = 0, worst = 0, downAt = -1, frames = 0;
    for (let i = 0; i < 300; i++) { W.step(DT); frames++; const h = gunThrough(g.col, gd.char); if (h) { through++; worst = Math.max(worst, h.depth); } if (downAt < 0 && gd.muzzleDown) downAt = NEAR - gd.char.pos[2]; }
    return { through, worst, downAt, frames, z: gd.char.pos[2] as number, down: gd.muzzleDown as boolean }; };
  const off = await run(false), on = await run(true);
  verdict(off.through > 30 && on.through === 0 && on.down && NEAR - on.z < 0.45, 'walked into the wall: off the gun ends in it; on it came down before the wall and never touched it',
    `off: ${off.through} of ${off.frames} frames in the wall, ${f2(off.worst)} m deep · on: ${on.through} frames, down from ${f2(on.downAt)} m off the face · he ends ${f2(NEAR - on.z)} m off it`);
}

async function gunBeside() {
  console.log('\n=== gun-beside: the rule asks the gun\'s own line — along a wall, or with the wall past the muzzle, the gun stays up ===');
  const W = await stage(34, true), g = W.game;
  const a = spawnUnit(g, { team: 'operative', pos: [X, 0, NEAR - 0.33], yaw: Math.PI / 2, weapon: 'fn2000', light: false });
  order(a, { goal: [X, 0, NEAR - 0.33], face: Math.PI / 2, aimAt: [X + 12, 1.35, NEAR - 0.33], upper: 'aim', hot: true }); for (let i = 0; i < 90; i++) W.step(DT);
  verdict(!a.muzzleDown && a.char.anim.upper === 'aim' && !gunThrough(g.col, a.char), 'facing along the wall, shoulder to it: the rifle is up', `he stands ${f2(NEAR - a.char.pos[2])} m off the face · muzzleDown ${a.muzzleDown} · ${carriageOf(a.char)}`);
  despawnUnit(g, a);
  const b = manAt(W, 'operative', 'fn2000', NEAR - 0.95);
  verdict(!b.muzzleDown && b.char.anim.upper === 'aim', 'facing the wall from 0.95 m (the muzzle a forearm short of it): the rifle is up', `muzzle ${f2(NEAR - b.char.muzzle[2])} m short of the face · muzzleDown ${b.muzzleDown}`);
}

async function gunBand() {
  console.log('\n=== gun-band: carried to the wall and back two millimetres at a time — down once, up once, and up further out than down ===');
  const W = await stage(35, true), g = W.game, gd = manAt(W, 'operative', 'fn2000', 2.6);
  let downs = 0, ups = 0, downAt = 0, upAt = 0, was = false;
  const go = (z: number) => { gd.char.pos[2] = z; gd.script.goal = [X, 0, z]; for (let i = 0; i < 6; i++) W.step(DT); const low = gd.muzzleDown; if (low && !was) { downs++; downAt = NEAR - z; } if (!low && was) { ups++; upAt = NEAR - z; } was = low; };
  for (let z = 2.6; z <= PRESS + 1e-9; z += 0.002) go(z);   // (2 mm a step, six frames a step: the rule leads by his feet's own speed, and this is a crawl)
  for (let z = PRESS; z >= 2.6 - 1e-9; z -= 0.002) go(z);
  verdict(downs === 1 && ups === 1 && upAt > downAt + 0.03, 'the gun went down once on the way in and came up once on the way out, further from the wall than it went down', `down at ${f2(downAt)} m off the face (${downs}×) · up at ${f2(upAt)} m (${ups}×)`);
}

async function gunLock() {
  console.log('\n=== gun-lock: aiming AT the surface (the shotgun on a lock) — the gun stays up ===');
  const W = await stage(36, true), g = W.game, z = NEAR - 0.62;
  const a = manAt(W, 'operative', 'fn2000', z, { aimAt: [X - 0.15, 1.05, NEAR] });
  const up = !a.muzzleDown && a.char.anim.upper === 'aim'; despawnUnit(g, a);
  const b = manAt(W, 'operative', 'fn2000', z);
  verdict(up && b.muzzleDown, 'from 0.62 m: aimed at a point on the wall itself the rifle is up; aimed through it at a point beyond, it is down', `aimed at the wall: up ${up} · aimed beyond: down ${b.muzzleDown}`);
}

async function gunHot() {
  console.log('\n=== gun-hot: a man in his sights — the gun is down only while it IS in the wall, not for the room a calm man keeps ===');
  const W = await stage(37, true), g = W.game, gd = manAt(W, 'operative', 'fn2000', NEAR - 0.5);
  const put = (off: number, n: number) => { gd.char.pos[2] = NEAR - off; gd.script.goal = [X, 0, NEAR - off]; for (let i = 0; i < n; i++) W.step(DT); };
  put(0.7, 30); const calm = gd.muzzleDown;   // back out, inside the band: a calm man keeps it down
  gd.script.over = { aimAt: [X, 1.35, 12], face: null }; put(0.7, 60); const hotUp = !gd.muzzleDown && gd.char.anim.upper === 'aim' && !gunThrough(g.col, gd.char), short = NEAR - gd.char.muzzle[2];
  put(0.45, 60); const hotDown = gd.muzzleDown && !gunThrough(g.col, gd.char);
  verdict(calm && hotUp && hotDown, 'at 0.70 m, come back from the wall: calm the rifle is still down (the band); with a man in his sights it is up, clear of the wall; at 0.45 m it is down for him too',
    `calm down ${calm} · hot at 0.70 m: up ${hotUp}, muzzle ${f2(short)} m short of the face · hot at 0.45 m: down and clear ${hotDown}`);
}

async function gunModel() {
  console.log('\n=== gun-model: the rule\'s worked-out carriages against the posed gun, in open floor — a re-tuned carriage table that moves a muzzle shows here ===');
  for (const [team, weapon, what] of [['operative', 'fn2000', 'FN2000'], ['guard', 'aks74u', 'carbine'], ['guard', 'guard9mm', 'pistol']] as const) {
    const W = await stage(38, true), gd = manAt(W, team, weapon, 2.0), c = gd.char;
    const rel = (p: Vec3) => [p[2] - c.pos[2], p[0] - c.pos[0], p[1] - c.pos[1]];   // ahead (he faces north), to the side, up
    const M = rel(gunWallModel.raisedLine(c, 'aim', c.aimYaw).b), A = rel(c.muzzle), up = Math.max(Math.abs(M[0] - A[0]), Math.abs(M[1] - A[1])), upY = Math.abs(M[2] - A[2]);
    order(gd, { goal: [X, 0, 2.0], face: NORTH, aimAt: [X, 1.35, 12], upper: 'none', stance: 'lowReady', hot: true }); for (let i = 0; i < 90; i++) W.step(DT);
    const low = Math.abs(rel(c.muzzle)[0] - gunWallModel.lowReach(c));
    verdict(up < 0.06 && upY < 0.12 && low < 0.06 && c.anim.gunWall === 0, `${what}: the aim's muzzle is where the rule works it out to be, and the low ready reaches as far ahead as it reckons`,
      `aim: ${f3(up)} m off on the floor, ${f3(upY)} m in height · low ready: ${f3(low)} m off ahead (reckoned ${f2(gunWallModel.lowReach(c))} m)`);
  }
}

async function gunOff() {
  console.log('\n=== gun-off: the rule off asks nothing and touches nothing; the stands ===');
  const W = await stage(37, false), s0 = { ...GUNWALL_STATS }, gd = manAt(W, 'operative', 'fn2000', PRESS); samAt(W, 3.45, 'rifle');
  const asked = GUNWALL_STATS.asked - s0.asked, low = GUNWALL_STATS.lowered - s0.lowered;
  verdict(asked === 0 && low === 0 && gd.char.anim.gunWall === 0 && W.game.player.char.anim.gunWall === 0 && !gd.muzzleDown, 'off: no line asked, no gun lowered, no carriage pulled in — with a man and Sam both pressed to the wall', `asked ${asked} · lowered ${low} · gunWall ${gd.char.anim.gunWall} / ${W.game.player.char.anim.gunWall}`);
  const frozen = !process.env.TPS_PROFILE || process.env.TPS_PROFILE === 'frozen', word = process.env.TPS_GUNWALL;
  GUNWALL.on = frozen; await standUp();   // (stood up from the opposite of what the stand should leave)
  const want = frozen || word !== undefined ? word === '1' : true;
  verdict(GUNWALL.on === want, frozen ? 'standUp() on the frozen stand puts GUNWALL.on to what TPS_GUNWALL says (unset: off — every stored digest had the guns up)' : 'standUp() on the shipped stand turns it on, as the page does', `after standUp: ${GUNWALL.on} · TPS_GUNWALL ${word ?? 'unset'} · TPS_PROFILE ${process.env.TPS_PROFILE ?? 'unset'}`);
}

/** the whole card (probes.ts 'gunwall'): true = every check passed. The switches are put back as found. */
export async function gunWall(): Promise<boolean> {
  const was = GUNWALL.on, lvl = AIM.player.level; allPass = true;
  try { await gunMen(); await gunSam(); await gunWalk(); await gunBeside(); await gunBand(); await gunLock(); await gunHot(); await gunModel(); await gunOff(); }
  finally { GUNWALL.on = was; AIM.player.level = lvl; }
  console.log(`\n=== gunwall: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`); return allPass;
}
if (import.meta.main) process.exit((await gunWall()) ? 0 : 1);
