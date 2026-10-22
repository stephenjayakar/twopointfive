// 'lightwall' — a weapon light never shines from the far side of a wall its carrier is pressed to (src/game/lighting.ts LIGHTWALL / lensClear):
//   bun run tools/qa/probes.ts lightwall [--verbose]     (`bun run tools/qa/lightwall-probes.ts` runs it alone: exit 0 / 1)
// All headless, against the office's south outer wall (0.24 m thick, its outside face on the open strip at z 3.88):
//   wall-sam       Sam pressed to it, facing it, pistol then FN2000, the light on, the shipped level aim: with the rule OFF the light stands where the lens is
//                  drawn — beyond the near face (the pistol's through the far face, the rifle's inside the wall); ON it is on his side, the whole emitter clear of
//                  the face, its direction untouched; a metre and a half back it is at the lens, to the bit, either way
//   wall-men       a teammate with the FN2000 and a defender with the carbine stood the same way by an order (squad.ts): the same
//   wall-estimate  what the light's place feeds: the CPU's light estimate (guards.ts lightEstimateAt — how lit a man is to an AI eye when no renderer answers) on
//                  the wall's FAR side in front of Sam's pistol light — lit with the rule off, dark with it on; and on his own side unchanged
//   wall-leaf      a door leaf counts like a wall (the collision ray meets both), a wall he merely stands BESIDE does not
//   wall-harness   the frozen stand holds the rule off (every stored digest was taken with the light at its lens); the shipped default is on
// THE HARNESS HAS NO GPU: nothing here is a picture. What is measured is where the light the renderer is handed stands, and what the CPU reads from it.
import { standUp, ROOT } from './headless.ts';
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const { mulberry32 } = await import(`${ROOT}/src/math/dice.ts`);
const { AIM } = await import(`${ROOT}/src/game/aim.ts`);
const { LIGHTWALL, lensClear } = await import(`${ROOT}/src/game/lighting.ts`);
const { GUNWALL } = await import(`${ROOT}/src/game/gunwall.ts`);   // (held OFF here: these cards stage a gun IN a wall, which gunwall.ts no longer lets a man do — the light's own rule is what they measure)
const { spawnUnit, lightEstimateAt } = await import(`${ROOT}/src/game/guards.ts`);
const { order } = await import(`${ROOT}/src/game/squad.ts`);
const { rigLightPose, sc20kLightPose } = await import(`${ROOT}/src/game/rigProps.ts`);
type Vec3 = [number, number, number];
const DT = 1 / 60;
const f2 = (x: number) => x.toFixed(2), f3 = (x: number) => x.toFixed(3), p3 = (p: number[]) => p.map(f2).join(', ');
let allPass = true;
const verdict = (ok: boolean, label: string, detail: string) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
/** the strip south of the office: the outer wall's outside face is NEAR, its inside face FAR (found by ray in stage()); X = a stretch of it with nothing else about */
const X = 12, NORTH = 0;
let NEAR = 3.88, FAR = 4.12;
function park(gd: any, i: number) { gd.hold = true; gd.pinned = true; gd.char.pos = [37.5, 0, 6 + i * 1.5]; gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.path = []; gd.pathGoal = null; gd.heardUpTo = 1e12; gd.flashlight.enabled = false; }
async function stage(seed: number, on: boolean) {
  Math.random = mulberry32(seed);
  const W: any = await standUp(); const g = W.game; LIGHTWALL.on = on; GUNWALL.on = false; AIM.player.level = 1;   // (the shipped aim: the gun level along the cursor's heading — at 0 it is on the floor at the wall's foot and no lens reaches the wall)
  g.godMode = true; g.infiniteAmmo = true; g.player.visibility = 0.02;
  for (let i = 0; i < 5; i++) W.step(DT);
  g.guards.forEach((gd: any, i: number) => park(gd, i));
  const a = g.col.raycast([X, 1.3, 2], [0, 0, 1], 6), b = g.col.raycast([X, 1.3, 8], [0, 0, -1], 6); if (!a || !b) throw new Error('lightwall: the south wall is not where the probe expects it');
  NEAR = 2 + a.t; FAR = 8 - b.t;
  return W;
}
function hold(W: any, p: Vec3, n: number) { for (let i = 0; i < n; i++) { W.cursorAt(p); W.step(DT); } }
/** Sam at z on the strip facing the wall, `gun` up with its light on; → his light, the lens as drawn this frame, his gun shoulder */
function samAt(W: any, z: number, gun: 'rifle' | 'pistol') {
  const g = W.game, pl = g.player, input = W.input;
  g.teleportPlayer([X, 0, z]); pl.crouch = false; pl.char.bodyYaw = pl.char.aimYaw = NORTH; W.cam.yaw = 0; W.cam.rebuild(); W.step(DT);
  if (!(gun === 'rifle' ? pl.rifleUp : pl.pistolUp)) { input.pressed.add(gun === 'rifle' ? 'Digit2' : 'Digit1'); W.step(DT); }
  hold(W, [X, 0, 3.7], 60); if (!pl.light.enabled) { input.pressed.add('KeyL'); hold(W, [X, 0, 3.7], 30); }
  const c = pl.char, lens = (gun === 'rifle' ? sc20kLightPose(c) : rigLightPose(c));
  return { L: pl.light, at: v3.copy(pl.light.pos) as Vec3, beam: v3.copy(pl.light.dir) as Vec3, lit: pl.light.enabled as boolean, r: pl.light.radius as number, lens: lens.pos as Vec3, dir: lens.dir as Vec3, sh: v3.copy(c.bones.upperArmR) as Vec3, z: c.pos[2] as number, up: gun === 'rifle' ? pl.rifleUp : pl.pistolUp };
}
/** is there a static or a leaf between the shoulder and the light as it stands? (the watcher's question: tools/qa/lightwall-watch.ts) */
function beyond(W: any, sh: Vec3, at: Vec3): boolean { const d = v3.sub(at, sh), L = v3.len(d); return L > 1e-3 && !!W.game.col.raycast(sh, v3.scale(d, 1 / L), L); }

async function wallSam() {
  console.log('\n=== wall-sam: Sam pressed to the wall — off: the light is where the lens is, in or past the wall; on: his side of it; back from the wall: the lens, either way ===');
  for (const gun of ['pistol', 'rifle'] as const) {
    const off = samAt(await stage(21, false), 3.7, gun), W = await stage(21, true), on = samAt(W, 3.7, gun);
    const keep = on.r + LIGHTWALL.gap, fails: string[] = [];
    if (!off.up || !off.lit || !on.lit) fails.push('the gun is not up with its light on');
    if (!(off.at[2] > NEAR)) fails.push(`off: the light is at z ${f3(off.at[2])}, not past the near face ${f3(NEAR)} — the probe's staging no longer reaches the wall`);
    if (v3.len(v3.sub(off.at, off.lens)) > 1e-9) fails.push('off: the light is not at the lens');
    if (!(on.at[2] <= NEAR - keep + 1e-6)) fails.push(`on: the light is at z ${f3(on.at[2])}, its edge not ${LIGHTWALL.gap} m short of the face ${f3(NEAR)}`);
    if (!(on.at[2] > on.sh[2] - 1e-6)) fails.push('on: the light is behind his shoulder');
    if (beyond(W, on.sh, on.at)) fails.push('on: something solid still stands between his shoulder and the light');
    if (v3.len(v3.sub(on.beam, on.dir)) > 1e-9) fails.push('on: the beam was turned');
    const back = samAt(W, 2.4, gun); if (v3.len(v3.sub(back.at, back.lens)) > 1e-12) fails.push(`on, 1.5 m back: the light is ${f3(v3.len(v3.sub(back.at, back.lens)))} m off its lens`);
    verdict(!fails.length, `${gun}: off the light stands ${off.at[2] > FAR ? 'THROUGH the wall' : 'INSIDE the wall'}; on it is ${f2(NEAR - on.at[2])} m short of the face, the beam unturned; back from the wall it is the lens`,
      fails.join('; ') || `he stands at z ${f2(on.z)} · wall ${f2(NEAR)} … ${f2(FAR)} · lens ${p3(off.lens)} · off: light z ${f3(off.at[2])} · on: light z ${f3(on.at[2])} (emitter r ${f3(on.r)} + gap ${LIGHTWALL.gap})`);
  }
}

/** a unit stood facing the wall by an order, gun up, light burning; the frames run until his pose has settled */
function manAt(W: any, team: 'operative' | 'guard', weapon: string, z: number) {
  const g = W.game; const gd = spawnUnit(g, { team, pos: [X + (team === 'guard' ? 3 : -3), 0, z], yaw: NORTH, weapon, light: true });
  const at: Vec3 = [gd.char.pos[0], 0, z]; order(gd, { goal: at, face: NORTH, aimAt: [at[0], 1.35, 12], upper: 'aim', light: true, hot: true });
  for (let i = 0; i < 90; i++) W.step(DT);
  return gd;
}
async function wallMen() {
  console.log('\n=== wall-men: a teammate (FN2000) and a defender (carbine) pressed to the wall with their lights on ===');
  for (const [team, weapon, what] of [['operative', 'fn2000', 'teammate, FN2000'], ['guard', 'aks74u', 'defender, carbine']] as const) {
    const Wo = await stage(22, false), a = manAt(Wo, team, weapon, 3.7), Wn = await stage(22, true), b = manAt(Wn, team, weapon, 3.7), fails: string[] = [];
    const A = a.flashlight, B = b.flashlight, keep = B.radius + LIGHTWALL.gap;
    if (!A.enabled || !B.enabled) fails.push(`his light is not burning (off arm ${A.enabled}, on arm ${B.enabled})`);
    if (!(A.pos[2] > NEAR)) fails.push(`off: the light is at z ${f3(A.pos[2])}, not past the near face ${f3(NEAR)} — the staging no longer reaches the wall`);
    if (!beyond(Wo, a.char.bones.upperArmR, A.pos)) fails.push('off: nothing solid between his shoulder and the light');
    if (!(B.pos[2] <= NEAR - keep + 1e-6)) fails.push(`on: the light is at z ${f3(B.pos[2])}, its edge not ${LIGHTWALL.gap} m short of the face ${f3(NEAR)}`);
    if (beyond(Wn, b.char.bones.upperArmR, B.pos)) fails.push('on: something solid still stands between his shoulder and the light');
    if (v3.len(v3.sub(A.dir, B.dir)) > 0.02) fails.push('the beam points another way with the rule on');
    verdict(!fails.length, `${what}: off the light stands ${A.pos[2] > FAR ? 'THROUGH the wall' : 'INSIDE the wall'}; on it is ${f2(NEAR - B.pos[2])} m short of the face`,
      fails.join('; ') || `he stands at z ${f2(b.char.pos[2])} · wall ${f2(NEAR)} … ${f2(FAR)} · off: light ${p3(A.pos)} · on: light ${p3(B.pos)}`);
  }
}

async function wallEstimate() {
  console.log('\n=== wall-estimate: what a light\'s place feeds — the CPU light estimate on the far side of the wall, in front of Sam\'s pistol light ===');
  const read = async (on: boolean) => { const W = await stage(23, on), s = samAt(W, 3.7, 'pistol'), g = W.game;
    const only = (o: number) => o !== 1;   // (Sam's own light alone: every other carried light skipped — and the room's fixtures, by reading the difference with his switched off)
    const far: Vec3 = [s.at[0], s.at[1], FAR + 1.2];
    const lit = (p: Vec3) => { const a = lightEstimateAt(g, p, only); s.L.enabled = false; const b = lightEstimateAt(g, p, only); s.L.enabled = true; return a - b; };
    const farLit = lit(far), z = s.at[2];
    const b = samAt(W, NEAR - 2.0, 'pistol'), near: Vec3 = [b.at[0], b.at[1], NEAR - 0.15];   // (…and two metres back from the wall, a point in his beam just short of its near face: the rule has nothing to do there)
    return { far: farLit, near: lit(near), z }; };
  const off = await read(false), on = await read(true);
  verdict(off.far > 0.05 && on.far === 0, 'a point 1.2 m inside the building, straight ahead of the light: lit by it through the wall with the rule off, not lit with it on', `off: +${f3(off.far)} from his light (it stands at z ${f3(off.z)}) · on: +${f3(on.far)} (z ${f3(on.z)})`);
  verdict(off.near > 0.05 && Math.abs(off.near - on.near) < 1e-9, 'two metres back from the wall, a point in his beam on his own side of it: lit, and the same either way', `off +${f3(off.near)} · on +${f3(on.near)}`);
}

async function wallLeaf() {
  console.log('\n=== wall-leaf: a door leaf stops the light like a wall; a wall he stands beside does not ===');
  const W = await stage(24, true), g = W.game;
  // beside the wall: facing EAST along it, the light a hand off its face — nothing on the line from the shoulder, so the lens it is
  { const pl = g.player; g.teleportPlayer([X, 0, 3.46]); pl.char.bodyYaw = pl.char.aimYaw = Math.PI / 2; W.cam.yaw = Math.PI; W.cam.rebuild(); W.step(DT);
    if (!pl.pistolUp) { W.input.pressed.add('Digit1'); W.step(DT); } hold(W, [X + 8, 0, 3.4], 60); if (!pl.light.enabled) { W.input.pressed.add('KeyL'); hold(W, [X + 8, 0, 3.4], 30); }
    const lens = rigLightPose(pl.char).pos, off = v3.len(v3.sub(pl.light.pos, lens));
    verdict(pl.light.enabled && off < 1e-12 && lens[2] < NEAR, 'facing along the wall, the lens a hand off its face: the light is at the lens', `lens ${p3(lens)} · wall face z ${f2(NEAR)} · light ${f3(off)} m off the lens`); }
  // a shut door leaf: the first leaf standing shut that Sam can be put in front of
  { const d = g.doors.list.find((x: any) => Math.abs(x.angle) < 0.02 && !x.def.steel); if (!d) { verdict(false, 'a shut leaf to stand at', 'the level has no shut door'); return; }
    const u = d.dir(), W2 = d.def.width, mid: Vec3 = [d.def.hinge[0] + u[0] * W2 / 2, 0, d.def.hinge[1] + u[1] * W2 / 2], n: Vec3 = [-u[1], 0, u[0]];
    let best: any = null;
    for (const side of [1, -1]) { const pl = g.player, at: Vec3 = [mid[0] + n[0] * side * 0.42, 0, mid[2] + n[2] * side * 0.42]; if (g.col.nav.isBlocked(at[0], at[2])) continue;
      const yaw = Math.atan2(-n[0] * side, -n[2] * side), tgt: Vec3 = [mid[0] - n[0] * side * 6, 0, mid[2] - n[2] * side * 6];
      g.teleportPlayer(at); pl.char.bodyYaw = pl.char.aimYaw = yaw; W.cam.yaw = yaw; W.cam.rebuild(); W.step(DT); if (!pl.pistolUp) { W.input.pressed.add('Digit1'); W.step(DT); }
      for (let i = 0; i < 60; i++) { W.cursorAt(tgt); W.step(DT); if (Math.abs(d.angle) > 0.02) break; } if (!pl.light.enabled) { W.input.pressed.add('KeyL'); for (let i = 0; i < 20; i++) { W.cursorAt(tgt); W.step(DT); } }
      const sh = pl.char.bones.upperArmR, lens = rigLightPose(pl.char).pos, side0 = (p: Vec3) => (p[0] - mid[0]) * n[0] + (p[2] - mid[2]) * n[2];
      best = { name: d.def.name, shut: Math.abs(d.angle) < 0.02, lit: pl.light.enabled, lensSide: side0(lens) * side, lightSide: side0(pl.light.pos) * side, shSide: side0(sh) * side, through: beyond(W, sh, pl.light.pos) }; if (best.shut && best.lensSide < 0) break; }
    if (!best) { verdict(false, 'a shut leaf to stand at', 'no floor in front of the first shut door'); return; }
    verdict(best.shut && best.lit && best.lensSide < 0 && best.lightSide > 0 && !best.through, `pressed to the shut leaf of ${best.name}: the lens is drawn through it, the light stays on his side`, `his shoulder ${f2(best.shSide)} m off the leaf · lens ${f2(best.lensSide)} m (negative = beyond it) · light ${f2(best.lightSide)} m · leaf shut ${best.shut}`); }
}

async function wallSlant() {
  console.log('\n=== wall-slant: closing on the wall at a slant, a millimetre a step — the light never jumps, and its emitter never crosses the face ===');
  const W = await stage(25, true), g = W.game, r = 0.07, reach = 0.7, keep = r + LIGHTWALL.gap, rows: string[] = []; let ok = true;
  for (const deg of [90, 60, 30, 17]) {   // (the angle between the line and the wall's face)
    const a = deg * Math.PI / 180, dir: Vec3 = [Math.cos(a), 0, Math.sin(a)]; let prev: Vec3 | null = null, jump = 0, deep = -Infinity, pulled = 0, n = 0;
    for (let z = NEAR - 0.95; z < NEAR - keep - 0.005; z += 0.001)   // (the shoulder itself never nearer the face than the light is kept: his body does not get there)
      { const from: Vec3 = [X, 1.4, z], lens = v3.mad(from, dir, reach) as Vec3, at = lensClear(g, from, lens, r) as Vec3; n++;
      if (at !== lens) pulled++; if (prev) jump = Math.max(jump, v3.len(v3.sub(at, prev))); prev = at; deep = Math.max(deep, at[2] - (NEAR - keep)); }
    const good = pulled > 0 && jump < 0.012 && deep < 0.005;   // (5 mm: under the slant floor — 17° — the centre is kept a few millimetres less than radius + gap off the face, still clear of it)
    ok &&= good;
    rows.push(`${deg}°: ${pulled} of ${n} steps pulled back · largest move in one step ${(jump * 1000).toFixed(1)} mm · the light's centre at most ${(deep * 1000).toFixed(1)} mm past ${f2(keep)} m short of the face${good ? '' : '  <<<'}`);
  }
  verdict(ok, 'at 90°, 60°, 30° and 17° to the wall: the pull-back starts from nothing and grows; the centre stays radius + gap short of the face (to 5 mm)', rows.join('\n    '));
}

async function wallHarness() {
  console.log('\n=== wall-harness: the frozen stand holds the rule off, the page and the shipped stand turn it on ===');
  const frozen = !process.env.TPS_PROFILE || process.env.TPS_PROFILE === 'frozen', word = process.env.TPS_LIGHTWALL;
  LIGHTWALL.on = frozen; await standUp();   // (stood up from the opposite of what the stand should leave)
  const want = frozen || word !== undefined ? word === '1' : true;
  verdict(LIGHTWALL.on === want, frozen ? 'standUp() on the frozen stand puts LIGHTWALL.on to what TPS_LIGHTWALL says (unset: off — every stored digest had the light at its lens)' : 'standUp() on the shipped stand turns it on, as the page does', `after standUp: ${LIGHTWALL.on} · TPS_LIGHTWALL ${word ?? 'unset'} · TPS_PROFILE ${process.env.TPS_PROFILE ?? 'unset'}`);
}

/** the whole card (probes.ts 'lightwall'): true = every check passed. The switches are put back as found. */
export async function lightWall(): Promise<boolean> {
  const was = LIGHTWALL.on, gun = GUNWALL.on, lvl = AIM.player.level; allPass = true;
  try { await wallSam(); await wallMen(); await wallEstimate(); await wallLeaf(); await wallSlant(); await wallHarness(); }
  finally { LIGHTWALL.on = was; GUNWALL.on = gun; AIM.player.level = lvl; }
  console.log(`\n=== lightwall: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`); return allPass;
}
if (import.meta.main) process.exit((await lightWall()) ? 0 : 1);
