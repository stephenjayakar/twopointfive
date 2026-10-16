// 'aimlevel' — the player aims LEVEL, not at the floor (player.ts levelOn / freeAim, AIM.player.level; playtest 10-08: 'the player character looks kinda dumb pointing at the
// floor. that's not really what we intend to aim at'):
//   bun run tools/qa/probes.ts aimlevel [--verbose]     (in the 'aim', 'weapons' and 'player' families; `bun run tools/qa/aimlevel-probes.ts` runs it alone: exit 0 / 1)
// All headless, through the real input path (the cursor projected onto a world point, 1 / 2 / L, the left button), on the open strip south of the office:
//   level-pose     the cursor on the FLOOR 0.6 … 12 m ahead of him, FN2000 and pistol, standing and crouched: the aim pitch is 0, the bore and the weapon light within a
//                  few degrees of level, his head where it is when he aims far (not hunched over the gun) — at every distance; and with the knob at 0 the fault as it
//                  was: 2 m out the gun 30° and more at the ground
//   level-round    the round with nothing under the reticle (the aim model's cone off, so what is measured is the line itself; the rifle keeps its own hands' cone):
//                  flat — the pistol's within 6 cm over its whole 60 m — along the cursor's heading, and ON past the cursor's point; with the knob at 0 it ends in
//                  the floor there
//   level-man      a man standing 9 m off on that heading with the cursor on the floor 2.5 m out (nobody under the reticle): the level round drops him; with the knob
//                  at 0 it goes into the floor and he stands. The cursor ON him: taken by the reticle, the gun on his chest, dropped — the same either way
//   level-script   a scripted aim (Game.puppet.aim — the tour's, a showcase's authored point) is still that POINT, floor included, whatever the knob says
//   level-harness  the harness itself stands at 0 (every older probe, digest and tally was taken with the cursor parked mid-view and the gun on that point); the
//                  shipped value is 1
// THE HARNESS HAS NO GPU: nothing here is a picture. What is measured is the pose the renderer is handed (aimPitch, the bore, the light's direction, the head bone).
import { standUp, ROOT } from './headless.ts';
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const { AIM, AIM_DEFAULTS } = await import(`${ROOT}/src/game/aim.ts`);
type Vec3 = [number, number, number];
const DT = 1 / 60, DEG = 180 / Math.PI, VERBOSE = process.argv.includes('--verbose');
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f1 = (x: number) => x.toFixed(1), f2 = (x: number) => x.toFixed(2);
let allPass = true;
const verdict = (ok: boolean, label: string, detail: string) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
/** the open strip south of the office: 40 m clear east of here at chest and at shin height */
const P0: Vec3 = [12, 0, 2], EAST = Math.PI / 2;
const ahead = (d: number, side = 0): Vec3 => [P0[0] + d, 0, P0[2] + side];
function park(gd: any, i: number) { gd.hold = true; gd.pinned = true; gd.char.pos = [37.5, 0, 6 + i * 1.5]; gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.path = []; gd.pathGoal = null; gd.heardUpTo = 1e12; }
/** Sam on the strip facing east, everybody parked deaf, the knob at `level`; gun = 'rifle' (2, the equip beat waited out) or 'pistol' (1, drawn), its light ON (the pistol comes up with its light) */
async function stage(seed: number, level: 0 | 1, gun: 'rifle' | 'pistol') {
  Math.random = seeded(seed);
  const W: any = await standUp(); const { game, input } = W; AIM.player.level = level;
  game.godMode = true; game.infiniteAmmo = true; game.player.visibility = 0.02;
  for (let i = 0; i < 5; i++) W.step(DT);
  game.guards.forEach((gd: any, i: number) => park(gd, i));
  game.teleportPlayer(P0); game.player.crouch = false; game.player.char.bodyYaw = game.player.char.aimYaw = EAST; W.cam.yaw = Math.PI; W.cam.rebuild(); W.step(DT);   // (the camera south of him, looking north: the office's south wall is behind the strip, not across it)
  input.pressed.add(gun === 'rifle' ? 'Digit2' : 'Digit1'); W.step(DT);
  hold(W, ahead(8), 50); input.pressed.add('KeyL'); hold(W, ahead(8), 30);
  return W;
}
/** the cursor kept on a world point for n frames (re-projected every frame: the camera follows the aim) */
function hold(W: any, p: Vec3, n: number) { for (let i = 0; i < n; i++) { W.cursorAt(p); W.step(DT); } }
/** one click of the left button with the cursor on p; the 'shot' event it raised (from = the muzzle, to = where the round ended) */
function shoot(W: any, p: Vec3): { from: Vec3; to: Vec3 } | null {
  const g = W.game, seen = new Set(g.events); W.cursorAt(p); W.input.clicked |= 1; W.input.buttons |= 1; W.step(DT); W.input.buttons = 0;
  let out: { from: Vec3; to: Vec3 } | null = null; for (const e of g.events) if (!seen.has(e) && e.kind === 'shot' && e.from && e.to) out = { from: v3.copy(e.from), to: v3.copy(e.to) };
  hold(W, p, 20); return out;
}
const pose = (W: any) => { const pl = W.game.player, c = pl.char; return { pitch: c.aimPitch * DEG, bore: Math.asin(c.gunDir[1]) * DEG, light: pl.light.enabled ? Math.asin(pl.light.dir[1]) * DEG : NaN, head: c.bones.head[1], muzzle: c.muzzle[1] }; };
const DIST = [0.6, 1, 2, 4, 8, 12];

async function levelPose() {
  console.log('\n=== level-pose: the cursor on the floor near and far — the gun, its light and his head stay level; with the knob at 0 the gun goes to the ground as it did ===');
  for (const gun of ['rifle', 'pistol'] as const) {
    const W = await stage(11, 1, gun); const pl = W.game.player;
    for (const crouch of [false, true]) {
      pl.crouch = crouch; hold(W, ahead(8), 60); const far = pose(W); const fails: string[] = [], rows: string[] = [];
      if (!(gun === 'rifle' ? pl.rifleUp : pl.pistolUp)) fails.push('the gun is not in his hands'); if (!pl.light.enabled) fails.push('its light is not on');
      for (const d of DIST) {
        hold(W, ahead(d), 60); const ap = W.game.aimPoint, q = pose(W);
        if (Math.hypot(ap[0] - P0[0] - d, ap[2] - P0[2]) > 0.25 || ap[1] > 0.1) fails.push(`${d} m: the cursor is not on the floor there (aim point ${ap.map(f2).join(', ')})`);
        if (Math.abs(q.pitch) > 0.5) fails.push(`${d} m: aim pitch ${f1(q.pitch)}°`);
        if (q.bore < -4 || q.bore > 2.5) fails.push(`${d} m: bore ${f1(q.bore)}°`);
        if (!(Math.abs(q.light) <= 4)) fails.push(`${d} m: light ${f1(q.light)}°`);
        if (Math.abs(q.head - far.head) > 0.04) fails.push(`${d} m: head at ${f2(q.head)} m, ${f2(far.head)} aiming far`);
        rows.push(`${d} m: pitch ${f1(q.pitch)}° bore ${f1(q.bore)}° light ${f1(q.light)}° head ${f2(q.head)} muzzle ${f2(q.muzzle)}`);
      }
      verdict(!fails.length, `${gun}, ${crouch ? 'crouched' : 'standing'}: level with the cursor on the floor ${DIST[0]} … ${DIST[DIST.length - 1]} m out`, fails.slice(0, 4).join('; ') || (VERBOSE ? rows.join('\n    ') : `${rows[2]} · ${rows[5]}`));
    }
  }
  { const W = await stage(11, 0, 'rifle'); hold(W, ahead(2), 60); const near = pose(W); hold(W, ahead(8), 60); const far = pose(W);
    verdict(near.pitch < -25 && near.head < far.head - 0.05, 'the knob at 0 is the build as it was: the cursor on the floor 2 m out puts the gun on the ground and his head down over it', `2 m: pitch ${f1(near.pitch)}° bore ${f1(near.bore)}° light ${f1(near.light)}° head ${f2(near.head)} muzzle ${f2(near.muzzle)} · 8 m: pitch ${f1(far.pitch)}° head ${f2(far.head)}`); }
}

async function levelRound() {
  console.log('\n=== level-round: nothing under the reticle — the round flies flat along the cursor\'s heading and on past the cursor; with the knob at 0 it ends in the floor there ===');
  for (const gun of ['rifle', 'pistol'] as const) for (const crouch of [false, true]) {
    const W = await stage(12, 1, gun); W.game.tune.aimModel = false; W.game.player.crouch = crouch; hold(W, ahead(8), 60); const fails: string[] = [], rows: string[] = [];
    const tol = (run: number) => gun === 'pistol' ? 0.06 : 0.012 * run + 0.06;   // (the pistol at rest has no cone of its own: its round IS the line; the rifle's hands — rifleSpread — stay on)
    for (const [d, side] of [[1, 0], [2, -0.6], [4, -1], [12, -2]] as const) {   // (off the line to the SOUTH: the office wall is 2 m north of the strip)
      const p = ahead(d, side); hold(W, p, 60); const r = shoot(W, p); if (!r) { fails.push(`${d} m: no round`); continue; }
      const run = Math.hypot(r.to[0] - r.from[0], r.to[2] - r.from[2]), rise = r.to[1] - r.from[1];
      const err = Math.abs(Math.atan2(r.to[0] - r.from[0], r.to[2] - r.from[2]) - Math.atan2(p[0] - P0[0], p[2] - P0[2])) * DEG;
      if (run < 15) fails.push(`${d} m: the round went ${f1(run)} m`); if (Math.abs(rise) > tol(run)) fails.push(`${d} m: it ${rise < 0 ? 'fell' : 'rose'} ${f2(Math.abs(rise))} m over ${f1(run)} m`);
      if (r.to[1] < 0.5) fails.push(`${d} m: it ended ${f2(r.to[1])} m off the floor`); if (err > 2.5) fails.push(`${d} m: ${f1(err)}° off the cursor's heading`);
      rows.push(`${d} m: muzzle ${f2(r.from[1])} m → ${f2(r.to[1])} m after ${f1(run)} m, ${f1(err)}° off the heading`);
    }
    verdict(!fails.length, `${gun}, ${crouch ? 'crouched' : 'standing'}: the round is flat, on the heading and goes on past the cursor`, fails.slice(0, 4).join('; ') || (VERBOSE ? rows.join('\n    ') : `${rows[1]} · ${rows[3]}`));
  }
  { const W = await stage(12, 0, 'rifle'); const p = ahead(2); hold(W, p, 60); const r = shoot(W, p);
    verdict(!!r && r.to[1] < 0.1 && Math.hypot(r.to[0] - p[0], r.to[2] - p[2]) < 0.3, 'the knob at 0: the round goes into the floor under the cursor', r ? `ended at (${r.to.map(f2).join(', ')}), the cursor at (${p.map(f2).join(', ')})` : 'no round'); }
}

async function levelMan() {
  console.log('\n=== level-man: a man standing down the heading, the cursor on the floor short of him — the level round is his; the cursor on him is the reticle\'s as ever ===');
  const run = async (level: 0 | 1, onHim: boolean) => {
    const W = await stage(13, level, 'rifle'); const g = W.game, gd = g.guards[0];
    gd.char.pos = ahead(9); gd.char.bodyYaw = gd.char.aimYaw = EAST; hold(W, ahead(2.5), 5);
    const p: Vec3 = onHim ? v3.add(gd.char.pos, [0, 1.2, 0]) : ahead(2.5); hold(W, p, 60);
    const taken = g.aimGuard === gd, pitch = g.player.char.aimPitch * DEG; shoot(W, p); hold(W, p, 10);
    return { taken, pitch, down: gd.state === 'dead' };
  };
  const a = await run(1, false), b = await run(0, false), c = await run(1, true), d = await run(0, true);
  verdict(!a.taken && a.down && Math.abs(a.pitch) < 0.5, 'level: the cursor on the floor 2.5 m out, a man 9 m down that heading and not under the reticle — the round drops him', `reticle on him ${a.taken} · pitch ${f1(a.pitch)}° · down ${a.down}`);
  verdict(!b.taken && !b.down && b.pitch < -15, 'the knob at 0: the same click goes into the floor and he stands', `reticle on him ${b.taken} · pitch ${f1(b.pitch)}° · down ${b.down}`);
  verdict(c.taken && c.down && d.taken && d.down && Math.abs(c.pitch - d.pitch) < 0.2, 'the cursor ON him: the reticle takes him, the gun is on his chest and he drops — the same with the knob at 1 and at 0', `level: taken ${c.taken} pitch ${f1(c.pitch)}° down ${c.down} · at 0: taken ${d.taken} pitch ${f1(d.pitch)}° down ${d.down}`);
}

async function levelScript() {
  console.log('\n=== level-script: a scripted aim is still its authored point ===');
  const W = await stage(14, 1, 'rifle'); const g = W.game; g.puppet = { goal: null, aim: ahead(1.5) };
  for (let i = 0; i < 60; i++) W.step(DT); const pitch = g.player.char.aimPitch * DEG; g.puppet = null; hold(W, ahead(1.5), 60);
  verdict(pitch < -25 && Math.abs(g.player.char.aimPitch * DEG) < 0.5, 'Game.puppet.aim on the floor 1.5 m out: his gun goes down to it (a showcase\'s authored point); the strings let go, the cursor on the same spot: level', `scripted ${f1(pitch)}° · by hand ${f1(g.player.char.aimPitch * DEG)}°`);
}

async function levelHarness() {
  console.log('\n=== level-harness: the harness stands at 0, the game ships at 1 ===');
  AIM.player.level = 1; await standUp();
  verdict(AIM.player.level === 0 && AIM_DEFAULTS.player.level === 1, 'standUp() puts the knob at 0 (the gun on the parked cursor\'s point, as every older probe and tally had it); the shipped default is 1', `after standUp ${AIM.player.level} · AIM_DEFAULTS ${AIM_DEFAULTS.player.level}`);
}

/** the whole card (probes.ts 'aimlevel'): true = every check passed. The knob is put back as it was found. */
export async function aimLevel(): Promise<boolean> {
  const was = AIM.player.level; allPass = true;
  try { await levelPose(); await levelRound(); await levelMan(); await levelScript(); await levelHarness(); }
  finally { AIM.player.level = was; }
  console.log(`\n=== aimlevel: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`); return allPass;
}
if (import.meta.main) process.exit(await aimLevel() ? 0 : 1);
