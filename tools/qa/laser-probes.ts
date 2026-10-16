// The 'lasers' family: ENEMIES CARRY NO VISIBLE WEAPON LASER (combat.ts LASER; the maintainer, 10-06: "the enemies having super visible lasers is a bit much. it
// makes the game easier but if it's too hard w/o we can find other ways to signal", then "we should probably just remove them for realism, not just tone them
// down"). Run through probes.ts:
//   bun run tools/qa/probes.ts lasers | laser-off | laser-scenarios
// PASS / FAIL each, all headless: what is asked is WHICH BOXES the laser's draw hands the renderer and whether the game goes any differently without them
// (nothing is drawn — how it LOOKS is not judged here).
//   laser-off        the night game, a guard in the corridor:
//                      · his laser laid sixteen ways in each of patrol / suspicious / alert / search: by default not one box, line or dot (the old draw gave some);
//                      · LASER.enemy on = the boxes of the build before the switch, field for field (the old draw kept verbatim below as the reference);
//                      · through Game.update, the man hunting Sam down the corridor, aiming and firing: no frame's boxes hold a laser line or dot on his bore;
//                        the same seeded run with the switch on: nearly every frame's do;
//                      · those two runs end in the same game, digest for digest (rounds fired, hits, every man's state): nothing reads the laser.
//   laser-scenarios  every scenario on the start card's list:
//                      · a defender made to hunt, his laser turned eight ways: not one box by default; the switch = the old draw field for field, under that
//                        scenario's fog of war as it stands; a teammate's own laser is the old whole line either way;
//                      · Sam put in plain sight inside that defender's room and the scenario left to play for fifteen seconds (the defenders hunt and fire), switch off against
//                        switch on from the same seed: the same game, digest for digest.
import { standUp, ROOT } from './headless.ts';
import { stage } from './bang-tally.ts';
const { v3, quat } = await import(`${ROOT}/src/math/vec.ts`);
const { makeBox, BoxFlag } = await import(`${ROOT}/src/scene/boxes.ts`);
const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const CBM: any = await import(`${ROOT}/src/game/combat.ts`);
const { resetChase } = await import(`${ROOT}/src/game/guards.ts`);
const { digestGame, diffDigest } = await import(`${ROOT}/src/game/digest.ts`);
const LASER = CBM.LASER;

const DT = 1 / 60;
const VERBOSE = process.argv.includes('--verbose');
const seeded = (s: number) => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
function family(title: string) {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok: boolean, label: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAIL'} ===`); return all; } };
}
const guarded = (fn: () => Promise<boolean>) => async () => { try { return await fn(); } catch (e) { console.log(`- FAIL — the probe threw\n    ${e instanceof Error ? e.stack : String(e)}`); return false; } finally { LASER.enemy = false; } };
const quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { if (VERBOSE) return await fn(); const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => {}; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
const f2 = (x: number) => x.toFixed(2);

// ---------------------------------------------------------------- the draw as it was before the switch (combat.ts laserBoxes + beamBoxes at af55d89, verbatim): the reference.
// (FROZEN on purpose — it is what 'the switch puts the old lasers back' is measured against. A later, intended change to what a laser MEETS (laserBoxes' hit tests)
//  is made here too, and said so; nothing else below it changes.)
function beamBoxesOld(g: any, from: number[], dir: number[], L: number, out: any[], dot: boolean) {
  const red = [1, 0.06, 0.03];
  const hw = Math.max(0.0022, 0.45 * g.mPerPx); const gain = 0.0022 / hw;
  const up = Math.abs(dir[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0]; const x = v3.normalize(v3.cross(up, dir)); const y = v3.cross(dir, x);
  out.push(makeBox({ c: v3.mad(from, dir, L / 2), h: [hw, hw, L / 2], yaw: v3.yawOf(dir), rot: quat.fromBasis(x, y, dir), albedo: [0.02, 0, 0], emissive: v3.scale(red, 9 * gain), flags: BoxFlag.NoShadow | BoxFlag.Dynamic }));
  if (dot) { const end = v3.mad(from, dir, L - 0.006); out.push(makeBox({ c: end, h: [0.011, 0.011, 0.011], yaw: 0, albedo: [0.05, 0, 0], emissive: v3.scale(red, 40), flags: BoxFlag.NoShadow | BoxFlag.Dynamic })); }
}
export function laserBoxesOld(g: any, gd: any, out: any[]) {
  const c = gd.char; const from = v3.mad(c.muzzle, c.gunDir, 0.02); const dir = c.gunDir;
  if (!isFinite(dir[0]) || v3.len(dir) < 0.5) return;
  let L = 30; const wh = g.engine.world.raycast(from, dir, L, BoxFlag.NoShadow | BoxFlag.Glass, c.id & 0xff); if (wh) L = wh.t;
  const ph = g.props.raycast(from, dir, L); if (ph) L = Math.min(L, ph.t);
  { const tp = g.player.char.rayHit(from, dir, L); if (tp >= 0) L = Math.min(L, tp); }
  for (const o of g.guards) { if (o === gd || o.state === 'dead' || g.fogOfWar.hidden(o)) continue; const t = o.char.rayHit(from, dir, L); if (t >= 0) L = Math.min(L, t); }
  if (L < 0.05) return;
  const dot = !!(wh || ph || L < 30);
  const fog = g.fogOfWar;
  if (fog.active && fog.knobs.lasers && !fog.onTeam(gd)) {
    if (!fog.seen(gd)) return;
    for (const [t0, t1] of fog.beamRuns(from, dir, L)) if (t1 - t0 > 0.02) beamBoxesOld(g, v3.mad(from, dir, t0), dir, t1 - t0, out, dot && t1 >= L - 1e-6);
    return;
  }
  beamBoxesOld(g, from, dir, L, out, dot);
}
const isDot = (b: any) => b.h[2] <= 0.02;
const lineLen = (l: any[]) => l.filter(b => !isDot(b)).reduce((a, b) => a + 2 * b.h[2], 0);
const same = (a: any[], b: any[]) => JSON.stringify(a) === JSON.stringify(b);
const draw = (g: any, gd: any) => { const out: any[] = []; CBM.laserBoxes(g, gd, out); return out; };
const drawOld = (g: any, gd: any) => { const out: any[] = []; laserBoxesOld(g, gd, out); return out; };
/** lay his laser by hand: a muzzle and a unit bore (what the draw reads; nothing is stepped in between) */
const lay = (gd: any, muzzle: number[], dir: number[]) => { const n = Math.hypot(dir[0], dir[1], dir[2]); gd.char.muzzle = [...muzzle]; gd.char.gunDir = [dir[0] / n, dir[1] / n, dir[2] / n]; };
/** a laser's line or dot among a frame's boxes, on this man's bore (not a tripwire's beam across the corridor, not a tracer) */
const onBore = (gd: any, b: any) => { const m = gd.char.muzzle, d = gd.char.gunDir, r = v3.sub(b.c, m), t = v3.dot(r, d); return t > 0 && v3.len(v3.sub(r, v3.scale(d, t))) < 0.05; };
const laserLine = (gd: any) => (b: any) => !!(b.flags & BoxFlag.NoShadow) && b.h[0] < 0.02 && b.h[2] > 0.1 && b.emissive[0] > 0.1 && b.emissive[1] < b.emissive[0] * 0.1 && b.albedo[0] === 0.02 && onBore(gd, b);
const laserDot = (gd: any) => (b: any) => !!(b.flags & BoxFlag.NoShadow) && b.h[0] === 0.011 && b.h[2] === 0.011 && b.emissive[0] === 40 && onBore(gd, b);
const digest = (g: any) => JSON.stringify(digestGame(g, true));

/** the night office, guard 0 hunting Sam down fourteen metres of open corridor from a seeded boot, played `frames` frames: what the frames' boxes held of his
 *  laser, what he did, and the game it ended in */
async function corridorHunt(enemy: boolean, frames: number) {
  Math.random = seeded(85);
  const W: any = await standUp(); const g = W.game; g.godMode = true;
  for (let i = 0; i < 10; i++) W.step(DT);
  LASER.enemy = enemy;
  const gd = g.guards[0]; for (const o of g.guards.slice(1)) { o.hold = true; o.char.pos = [37.5, 0, 6 + g.guards.indexOf(o)]; o.char.update(0); }
  const place = (p: number[], face: number[]) => { gd.char.pos = v3.copy(p); gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.char.bodyYaw = gd.char.aimYaw = Math.atan2(face[0] - p[0], face[2] - p[2]); gd.char.aimPitch = 0; gd.path = []; gd.pathGoal = null; gd.char.anim.upper = 'aim'; gd.char.update(0); gd.char.update(DT); };
  await quiet(() => g.teleportPlayer([32, 0, 11.2])); place([20.5, 0, 11.2], [32, 0, 11.2]);
  gd.state = 'alert'; gd.awareness = 1; gd.reactT = 0; gd.fireCd = 0.3; gd.weapon.rearm(); gd.reloadT = -1; gd.lastKnown = [32, 0, 11.2]; gd.lastSeenT = g.time; resetChase(gd); gd.stuckT = 0; gd.dazzledUntil = -1; gd.hold = false; gd.pinned = true; gd.ledT = g.time;
  const fired0 = gd.weapon.shotsFired;
  let hunting = 0, withLine = 0, withDot = 0, armed = 0;
  for (let f = 0; f < frames; f++) {
    g.player.visibility = 1; W.step(DT);
    const hunts = (gd.state === 'alert' || gd.state === 'search'); if (hunts) hunting++;
    if (hunts && !gd.muzzleDown && !gd.held) armed++;   // (the frames the old game drew his laser in)
    if (g.dynBoxes.some(laserLine(gd))) withLine++; if (g.dynBoxes.some(laserDot(gd))) withDot++;
  }
  const shots = gd.weapon.shotsFired - fired0;
  LASER.enemy = false;
  return { hunting, armed, withLine, withDot, shots, digest: digest(g), raw: digestGame(g, true) };
}

export const laserOff = guarded(async () => {
  const F = family('laser-off: an enemy carries no visible laser — no line, no dot, in any state; the switch puts the old lasers back field for field; nothing reads them');
  Math.random = seeded(85);
  const W: any = await standUp(); const g = W.game; g.godMode = true; g.playerInvisible = true; g.aiEnabled = false;
  for (let i = 0; i < 10; i++) W.step(DT);
  const gd = g.guards[0]; for (const o of g.guards.slice(1)) { o.hold = true; o.char.pos = [37.5, 0, 6 + g.guards.indexOf(o)]; o.char.update(0); }
  W.engine.world.upload();
  const M = [20.5, 1.4, 11.2];   // in the corridor, fourteen metres of it open to the east
  const ways: number[][] = []; for (let k = 0; k < 12; k++) ways.push([Math.sin(k * Math.PI / 6), 0, Math.cos(k * Math.PI / 6)]); ways.push([1, -0.3, 0], [1, 0.25, 0.1], [0.2, -1, 0.1], [-1, 0.1, 0.6]);
  const states = ['patrol', 'suspicious', 'alert', 'search'];

  // ---- 1 · by default: nothing, whatever he is doing
  { let boxes = 0, old = 0;
    for (const st of states) { gd.state = st; for (const d of ways) { lay(gd, M, d); boxes += draw(g, gd).length; old += drawOld(g, gd).length; } }
    F.verdict(boxes === 0 && old >= states.length * ways.length, `1 a guard (${gd.team}) in ${states.join(' / ')}, his laser laid sixteen ways in each`,
      `boxes drawn: ${boxes} (want 0 — no line, no dot); the draw before the switch gave ${old} from the same stagings`); }

  // ---- 2 · the switch: the old draw, field for field
  { LASER.enemy = true; let diff = 0, boxes = 0, line = 0;
    for (const st of states) { gd.state = st; for (const d of ways) { lay(gd, M, d); const now = draw(g, gd), old = drawOld(g, gd); boxes += old.length; line += lineLen(old); if (!same(now, old)) diff++; } }
    LASER.enemy = false;
    F.verdict(diff === 0 && boxes >= states.length * ways.length, '2 LASER.enemy on: the lasers as they were', `${states.length * ways.length} stagings, ${boxes} boxes and ${f2(line)} m of line in the old draw; ${diff} stagings differ from it (want 0 — compared field for field)`); }

  // ---- 3 · through Game.update: hunting, aiming, firing
  const FRAMES = 420;
  const off = await corridorHunt(false, FRAMES), on = await corridorHunt(true, FRAMES), off2 = await corridorHunt(false, FRAMES);
  F.verdict(off.hunting > FRAMES * 0.5 && off.shots > 0 && off.withLine === 0 && off.withDot === 0 && on.withLine > on.armed * 0.9 && on.armed > FRAMES * 0.3,
    '3 the same guard hunting Sam down the corridor through Game.update, seven seconds, aiming and firing',
    `by default: hunting ${off.hunting} of ${FRAMES} frames, ${off.shots} rounds fired, frames whose boxes hold a laser line on his bore ${off.withLine}, a dot ${off.withDot} (want 0, 0) · the switch on, same seed: a line in ${on.withLine} frames and a dot in ${on.withDot} of the ${on.armed} he had his gun up hunting (want nearly all — the probe's own eye works)`);

  // ---- 4 · and the game is the same game
  { const d = off.digest === on.digest, control = off.digest === off2.digest; const why = d ? [] : diffDigest(off.raw, on.raw, 4);
    F.verdict(d && control, '4 nothing reads the laser: that run, the switch off against on', `${off.shots} rounds off, ${on.shots} on; the game after ${FRAMES} frames, digest for digest: ${d ? 'identical' : `DIFFERENT — ${why.join(' · ')}`} (the control — off twice: ${control ? 'identical' : 'DIFFERENT: this harness run is not repeatable, no verdict here'})`); }
  return F.done();
});

export const laserScenarios = guarded(async () => {
  const F = family('laser-scenarios: every scenario — no defender shows a laser, the switch puts the old one back under that fog of war, a teammate\'s is untouched, the game plays the same');
  for (const E of SCENARIOS as any[]) {
    const S: any = await quiet(() => stage(E.id, 1)); const { g, step } = S; const FW = g.fogOfWar;
    LASER.enemy = false; g.aiEnabled = false; step(3);
    const foe = S.defs.map((x: any) => x.gd).find((x: any) => x.state !== 'dead' && (!FW.active || FW.seen(x))) ?? g.guards.find((x: any) => x.team === 'hostile' && x.state !== 'dead');
    const mate = g.guards.find((x: any) => x.team === 'operative' && x.state !== 'dead');
    if (!foe) { F.verdict(false, `${E.title}: a defender to turn`, 'none standing after the staging'); continue; }
    // (a defender nobody sees showed nothing in the old draw either: bring Sam to where he is seen, if the fog is up)
    if (FW.active && !FW.seen(foe)) { await quiet(() => g.teleportPlayer([foe.char.pos[0] + 0.9, 0, foe.char.pos[2]])); step(2); }
    const c = foe.char, chest = c.bones.chest ?? [c.pos[0], 1.2, c.pos[2]];
    let boxes = 0, oldBoxes = 0, oldLine = 0, diff = 0;
    for (const st of ['alert', 'search']) { foe.state = st;
      for (let k = 0; k < 8; k++) {
        const dir = [Math.sin(k * Math.PI / 4), 0, Math.cos(k * Math.PI / 4)]; lay(foe, [chest[0] + dir[0] * 0.5, chest[1], chest[2] + dir[2] * 0.5], dir);
        const now = draw(g, foe), old = drawOld(g, foe);
        boxes += now.length; oldBoxes += old.length; oldLine += lineLen(old);
        LASER.enemy = true; if (!same(draw(g, foe), old)) diff++; LASER.enemy = false;
      } }
    let mateOk = true, mateNote = 'no teammate in this one';
    if (mate) { const mc = mate.char, mch = mc.bones.chest ?? [mc.pos[0], 1.2, mc.pos[2]]; let d2 = 0, n = 0;
      for (const sw of [false, true]) { LASER.enemy = sw; for (let k = 0; k < 8; k++) { const dir = [Math.sin(k * Math.PI / 4), 0, Math.cos(k * Math.PI / 4)]; lay(mate, [mch[0] + dir[0] * 0.5, mch[1], mch[2] + dir[2] * 0.5], dir); const old = drawOld(g, mate); n += old.length; if (!same(draw(g, mate), old)) d2++; } }
      LASER.enemy = false; mateOk = d2 === 0 && n > 0; mateNote = `${mate.callsign}'s own laser, eight ways, the switch off and on: ${d2} of 16 differ from the old draw's ${n} boxes (want 0)`; }
    // the scenario playing itself, off against on (and off again: the control)
    // (Sam, unhurt and in plain sight, put a step inside that defender's room: the defenders hunt and fire, the team answers as it will)
    const at = [foe.char.pos[0] + 0.9, 0, foe.char.pos[2]];
    const play = async (sw: boolean) => { const P: any = await quiet(() => stage(E.id, 1)); const pg = P.g; LASER.enemy = sw; pg.playerInvisible = false; await quiet(() => pg.teleportPlayer(at));
      const foes = pg.guards.filter((x: any) => x.team !== 'operative'); const f0 = foes.reduce((n: number, x: any) => n + x.weapon.shotsFired, 0); let hunted = 0;
      for (let f = 0; f < 900; f++) { pg.player.visibility = 1; P.W.step(DT); if (foes.some((x: any) => (x.state === 'alert' || x.state === 'search') && !x.muzzleDown && !x.held)) hunted++; }
      LASER.enemy = false; return { d: digest(pg), raw: digestGame(pg, true), hunted, shots: foes.reduce((n: number, x: any) => n + x.weapon.shotsFired, 0) - f0, dead: pg.guards.filter((x: any) => x.state === 'dead').length }; };
    const a = await play(false), b = await play(true), a2 = await play(false);
    const sameGame = a.d === b.d, control = a.d === a2.d;
    F.verdict(boxes === 0 && diff === 0 && oldLine > 1 && mateOk && sameGame && control && a.hunted > 60, `${E.title}: ${foe.callsign} (${foe.team}), fog of war ${FW.active ? 'up' : 'off'}`,
      `hunting, his laser turned eight ways in alert and in search: ${boxes} boxes (want 0; the old draw: ${oldBoxes} boxes, ${f2(oldLine)} m of line) · LASER.enemy on against the old draw, field for field: ${diff} of 16 differ (want 0) · ${mateNote} · fifteen seconds of it with Sam in that room, off against on: ${sameGame ? 'the same game, digest for digest' : `DIFFERENT — ${diffDigest(a.raw, b.raw, 3).join(' · ')}`} (a defender hunting with his gun up in ${a.hunted} of 900 frames, ${a.shots} rounds from their side, ${a.dead} men down at the end; the control, off twice: ${control ? 'identical' : 'DIFFERENT — not repeatable, no verdict'})`);
  }
  return F.done();
});
