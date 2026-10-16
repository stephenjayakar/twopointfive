// BLAST_PACE (src/game/destructionSwitch.ts) moves picture-only work off the frame a wall goes on. This holds what the PICTURE reads against the old pace once the
// frames after the blast have run: per level, the same partitions blasted in two stands — the pace on, and off (all of it on the blast frame, as it was) — then
//   · every light's reach mask (game.ts reachChanged / reachTick; the turning beacons aside — theirs is a mask of the frame it was decided on, by either pace),
//   · the rain's drip lines (rainFx.ts: found again in shares),
//   · the game's digest (play itself),
// compared between the two. Also how many frames after the blast each took to land under the pace.
//   bun run tools/qa/blast-pace-check.ts [--levels depot,block,warehouse,block-squads,office] [--blasts 3] [--frames 240]
//   exit 0 = equal on every level · 1 = something differs (named) · 2 = unknown flag
import { standUp, ROOT } from './headless.ts';
import { readFileSync } from 'node:fs';
const argv = process.argv.slice(2), KNOWN = ['--levels', '--blasts', '--frames'];
for (const a of argv) if (a.startsWith('--') && !KNOWN.includes(a)) { console.error(`unknown flag ${a} — ${KNOWN.join(' ')}`); process.exit(2); }
const arg = (k: string, d: string) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const { DESTRUCTION, BLAST_PACE } = await import(`${ROOT}/src/game/destructionSwitch.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { PLAYER_ID } = await import(`${ROOT}/src/game/consts.ts`);
const { rainDripPoints, rainDripPending } = await import(`${ROOT}/src/game/rainFx.ts`);
const { digestGame } = await import(`${ROOT}/src/game/digest.ts`);
const LEVELS = arg('--levels', 'depot,block,warehouse,block-squads,office').split(','), BLASTS = +arg('--blasts', '3'), FRAMES = +arg('--frames', '240'), DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const maskOf = (l: any) => { const m = l.kind === 2 ? l.reachDir : l.reach; return m ? Array.from(m as Uint32Array).join(',') : ''; };

async function run(level: string, pace: boolean) {
  Math.random = seeded(7); DESTRUCTION.on = true; BLAST_PACE.on = pace;
  const lv = level === 'office' ? undefined : loadLevel(parseLevelData(readFileSync(`${ROOT}/levels/${level}.json`, 'utf8')));
  const W = await standUp(lv ? { level: lv } : {}); const { game, engine } = W as any;
  game.godMode = true; game.aiEnabled = false; game.tune.chaos = 0.5; engine.settings.particleRain = true;   // (the drip lines are found whenever the switch is on, drawn or not)
  for (let i = 0; i < 3; i++) W.step(DT);
  const walls = game.destr.walls.all().filter((w: any) => w.kind === 'wall' && Math.max(w.box.h[0], w.box.h[2]) >= 1.6);
  const rows: { masks: string; drips: string; digest: string; reachFrames: number; dripFrames: number }[] = []; let done = 0;
  for (const w of walls) {
    if (done >= BLASTS) break;
    const b = w.box, alongX = b.h[0] >= b.h[2]; const at = alongX ? [b.c[0], 0.3, b.c[2] + 0.3] : [b.c[0] + 0.3, 0.3, b.c[2]];
    const res = game.destr.blast(at, { who: PLAYER_ID }); if (!res.walls) continue; done++;
    let reachFrames = -1, dripFrames = -1, still = 0, n0 = engine.world.statics.length;
    for (let f = 1; f <= FRAMES; f++) { W.step(DT);
      if (reachFrames < 0 && game.reachPending === 0) reachFrames = f;
      const n = engine.world.statics.length; if (n !== n0) { n0 = n; still = 0; dripFrames = -1; } else still++;
      if (dripFrames < 0 && still > 0 && !rainDripPending(game)) dripFrames = f; }
    if (rainDripPending(game)) dripFrames = -1;   // (a walk still going when the frames are up: rainDripPoints below would finish it whole — said, and counted a failure)
    rows.push({ masks: engine.lights.lights.map((l: any) => game.beacons.some((b: any) => b.light === l) ? 'beacon' : maskOf(l)).join('|'),   // (a blackout beacon's turning spot is decided for where it points on the frame it is decided: by either pace a mask of its moment — left out, as reach-cost.ts leaves it out)
      drips: JSON.stringify(rainDripPoints(game)), digest: JSON.stringify(digestGame(game, true)), reachFrames, dripFrames });
  }
  return rows;
}
let bad = 0;
for (const level of LEVELS) {
  const on = await run(level, true), off = await run(level, false); BLAST_PACE.on = true;
  if (on.length !== off.length) { console.log(`- FAIL — ${level}: ${on.length} blasts with the pace, ${off.length} without`); bad++; continue; }
  let m = 0, d = 0, g = 0; for (let i = 0; i < on.length; i++) { if (on[i].masks !== off[i].masks || on[i].reachFrames < 0) m++; if (on[i].drips !== off[i].drips || on[i].dripFrames < 0) d++; if (on[i].digest !== off[i].digest) g++; }
  const n = on.length, pts = on.length ? JSON.parse(on[on.length - 1].drips).length : 0;
  console.log(`- ${m || d || g ? 'FAIL' : 'PASS'} — ${level}: ${n} walls blasted, ${FRAMES} frames after each: reach masks equal ${n - m} of ${n} · drip lines equal ${n - d} of ${n} (${pts} points) · digest equal ${n - g} of ${n} · masks landed ${on.map(r => r.reachFrames).join(' ')} frames after the blast with the pace (${off.map(r => r.reachFrames).join(' ')} without) · drip lines ${on.map(r => r.dripFrames).join(' ')} (${off.map(r => r.dripFrames).join(' ')})`);
  if (m || d || g) bad++;
}
console.log(bad ? `=== blast-pace-check: ${bad} level(s) differ ===` : '=== blast-pace-check: ALL PASS ===');
process.exit(bad ? 1 : 0);
