// 'wallbreak-wear' (src/game/wallwear.ts — what a breakable SHOWS while it is shot, before it gives), run through probes.ts in the 'wallbreak' family:
//   bun run tools/qa/probes.ts wallbreak-wear [--level block-squads]
// Headless = nothing is drawn; what is asserted is that the look is ONLY a look:
//   (marks)      a counted round's own bullet mark becomes decal kind 'damage' look 3, param in [3, 4), on the partition's mid-plane with both faces inside its
//                sphere; the ring's COUNT is what it was; the cell's earlier marks grow as its count goes up and never shrink; when the port opens the cell's
//                list is dropped; the far face throws puffs and chips, never more than WEAR.maxBirths a round;
//   (same play)  the same seeded rounds with the look on and off: the game digest after every round, the walls' log / counts / open cells, the feed, the
//                debris pool, the decal count — all equal. Off, the mark is the bullet mark it always was;
//   (cover)      thick cover takes the mark on the face that was hit, nothing behind;
//   (reset)      restartEncounter: no mark, no list;
//   (checkpoint) a save in the middle carries the marks through the decal ring's own slice (nothing of this file is saved); the lists are dropped on load.
import { standUp, ROOT, fake } from './headless.ts';
import { readFileSync } from 'node:fs';
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const { fireWeapon } = await import(`${ROOT}/src/game/combat.ts`);
const { WEAPONS } = await import(`${ROOT}/src/game/weapons.ts`);
const { Particles } = await import(`${ROOT}/src/render/particles.ts`);
const { WALLS, WALL_STATS, WALL_LOG } = await import(`${ROOT}/src/game/wallbreak.ts`);
const { WEAR } = await import(`${ROOT}/src/game/wallwear.ts`);
const { WEAR_MARK } = await import(`${ROOT}/src/render/decals.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { digestGame } = await import(`${ROOT}/src/game/digest.ts`);
const { DESTRUCTION } = await import(`${ROOT}/src/game/destructionSwitch.ts`);

type Vec3 = [number, number, number];
const DT = 1 / 60;
const LEVEL = (() => { const i = process.argv.indexOf('--level'); return i >= 0 ? process.argv[i + 1] : 'block-squads'; })();
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f3 = (x: number) => x.toFixed(3);
const DEFAULTS = JSON.parse(JSON.stringify(WALLS));

/** as wallbreak-probes.ts stage(): the harness Game on the loud level at chaos 0.5 with THE ONE SWITCH up, a Particles attached, everyone deaf and blind */
async function stage(seed: number) {
  Math.random = seeded(seed); for (const k of Object.keys(DEFAULTS)) (WALLS as any)[k] = JSON.parse(JSON.stringify(DEFAULTS[k])); DESTRUCTION.on = true;
  const W = await standUp({ level: loadLevel(parseLevelData(readFileSync(`${ROOT}/levels/${LEVEL}.json`, 'utf8'))) }); const { game, engine } = W;
  engine.particles = new Particles(fake('device'), fake('sceneLayout')); engine.settings.gpuParticles = true;
  game.godMode = true; game.aiEnabled = false; game.player.visibility = 0.02; game.tune.chaos = 0.5;
  for (const k of Object.keys(WALL_STATS)) (WALL_STATS as any)[k] = 0; WALL_LOG.length = 0;
  for (let i = 0; i < 3; i++) W.step(DT);
  for (const gd of game.guards) { gd.hold = true; gd.pinned = true; gd.heardUpTo = 1e12; gd.flashlight.enabled = false; }
  game.player.slot = 'rifle'; game.player.holstered = false;
  return { W, game, engine };
}
/** a partition column with open floor both sides, away from doors and the wall's ends (wallbreak-probes.ts pickWall) */
function pickWall(game: any): { box: any; mid: Vec3; n: Vec3; a: Vec3; b: Vec3 } | null {
  const nav = game.col.nav; const free = (p: Vec3) => !nav.blocked[nav.idx(Math.floor(p[0] / nav.cell), Math.floor(p[2] / nav.cell))];
  for (const w of game.destr.walls.all()) {
    if (w.kind !== 'wall') continue; const b = w.box; const alongX = b.h[0] >= b.h[2]; const L = alongX ? b.h[0] : b.h[2];
    if (L < 1.6) continue;
    const nCol = Math.min(32, Math.max(1, Math.round(2 * L / WALLS.col))), wCol = 2 * L / nCol;
    for (let k = 0; k < nCol; k++) {
      const u = -L + (k + 0.5) * wCol; if (u < -L + 1.4 || u > L - 1.4) continue;
      const mid: Vec3 = alongX ? [b.c[0] + u, 0, b.c[2]] : [b.c[0], 0, b.c[2] + u]; const n: Vec3 = alongX ? [0, 0, 1] : [1, 0, 0];
      const a = v3.mad(mid, n, 1.2), bb = v3.mad(mid, n, -1.2);
      if (!free(a) || !free(bb) || !free(v3.mad(mid, n, 0.7)) || !free(v3.mad(mid, n, -0.7))) continue;
      if (game.col.solidBlocked([a[0], 1.3, a[2]], [mid[0] + n[0] * 0.2, 1.3, mid[2] + n[2] * 0.2]) || game.col.solidBlocked([bb[0], 1.3, bb[2]], [mid[0] - n[0] * 0.2, 1.3, mid[2] - n[2] * 0.2])) continue;
      if (game.doors.list.some((d: any) => Math.hypot(d.frameCentre[0] - mid[0], d.frameCentre[2] - mid[2]) < 2.2)) continue;
      return { box: b, mid, n, a, b: bb };
    }
  }
  return null;
}
function fire(W: any, from: Vec3, at: Vec3, n: number, each?: () => void) {
  const game = W.game; game.teleportPlayer([from[0], 0, from[2]]); const yaw = Math.atan2(at[0] - from[0], at[2] - from[2]); game.player.char.bodyYaw = game.player.char.aimYaw = yaw; W.step(DT);
  for (let r = 0; r < n; r++) { fireWeapon(game, game.player.char, at, true, { weapon: WEAPONS.fn2000 }); for (let f = 0; f < 6; f++) W.step(DT); each?.(); }
}
const cellsOf = (wear: any) => +(/cells (\d+)/.exec(wear.summary())?.[1] ?? -1);
const isWear = (d: any) => d?.kind === 'damage' && d.param >= WEAR_MARK.look && d.param < WEAR_MARK.look + WEAR_MARK.materials;
const marksOf = (game: any) => game.decals.list.filter(isWear);
/** the particles the look itself really queues (Particles.emit's own return, counted only inside WallWear.round): the most in one counted round so far */
function countBirths(engine: any, wear: any): () => number { let most = 0, cur = 0, inside = false; const P = engine.particles, emit = P.emit.bind(P), round = wear.round.bind(wear);
  P.emit = (...a: any[]) => { const k = emit(...a); if (inside) cur += k; return k; };
  wear.round = (...a: any[]) => { inside = true; cur = 0; try { round(...a); } finally { inside = false; most = Math.max(most, cur); } };
  return () => most; }

export async function wallbreakWear(): Promise<boolean> {
  const title = `wallbreak-wear: a shot wall shows it before it gives — and only shows it (${LEVEL})`;
  console.log(`\n=== ${title} ===`); let all = true;
  const verdict = (ok: boolean, label: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  const done = () => { console.log(`=== wallbreak-wear: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; };

  // ---------------------------------------------------------------- marks
  { const { W, game, engine } = await stage(12); const wear = game.destr.walls.wear;
    const pick = pickWall(game); if (!pick) { verdict(false, 'a partition with floor both sides', 'none found'); return done(); }
    const { a, mid, n, box } = pick; const half = Math.min(box.h[0], box.h[2]); const tgt: Vec3 = [mid[0], 1.3, mid[2]];
    const plays = () => game.decals.list.filter((d: any) => !d.look).length;   // (the marks play lays: what a blast or an opened wall leaves on the floor for the picture — floormess.ts — is not a round's mark)
    const n0 = plays(); const born = countBirths(engine, wear);
    fire(W, a, tgt, 1);
    const first = game.decals.list.at(-1); const off = first ? v3.dot(v3.sub(first.pos, [box.c[0], first.pos[1], box.c[2]]), n) : NaN;
    verdict(plays() === n0 + 1 && isWear(first) && first.param < WEAR_MARK.look + 1, "the round's own mark is the wear mark; the ring holds one more decal, as it would have", `decals ${n0} → ${plays()}; kind ${first?.kind}, param ${f3(first?.param ?? NaN)}`);
    const reachOf = (d: any) => WEAR_MARK.reach0 + WEAR_MARK.reach1 * (d.param % 1);
    verdict(half >= WEAR_MARK.minHalf && half <= WEAR_MARK.maxHalf && Math.abs(off) < 1e-3 && Math.abs(Math.sqrt(Math.max(0, first.radius ** 2 - reachOf(first) ** 2)) - half) < 1e-6, "on a thin partition it sits on the mid-plane, and its radius and strength give back the wall's half thickness (what the shader paints the two faces by)", `half thickness ${f3(half)} m, off the mid-plane ${off.toExponential(1)} m, radius ${f3(first.radius)} m (reach ${f3(Math.sqrt(Math.max(0, first.radius ** 2 - half ** 2)))} m)`);
    let grew = true, rounds = 1; let last = first.param; const track: string[] = [f3(first.param - 3)];
    while (rounds < 40 && game.destr.walls.serial === 0) {
      fire(W, a, tgt, 1); rounds++;
      if (game.destr.walls.serial === 0) { grew &&= first.param >= last - 1e-9; track.push(f3(first.param - 3)); last = first.param; }
    }
    verdict(grew && last > +track[0] + 3 + 0.2 && last < 4 && plays() === n0 + rounds, 'the first mark grows with its cell and stays a mark (strength < 1); one decal a round, no more', `strength by round ${track.join(' → ')}; decals ${plays()} after ${rounds} rounds`);
    verdict(rounds === Math.ceil(WALLS.tough.drywall) && cellsOf(wear) === 0, `the port opens on round ${rounds} as it always did, and the cell's list is dropped`, `WALLS.tough.drywall ${WALLS.tough.drywall}; ${wear.summary()}`);
    const births = born();
    verdict(wear.stats.puffs > 0 && wear.stats.chips > 0 && births > 0 && births <= WEAR.maxBirths, 'the far face throws puffs and chips, capped a round (counted off what the particle queue really took)', `${wear.stats.puffs} puffs, ${wear.stats.chips} chips over ${rounds} rounds; most the look queued in one round ${births} (cap ${WEAR.maxBirths})`);
    // a counted round that laid no mark (the decals off — as a muzzle pressed through the wall lays none): nothing adopted, nothing thrown
    { const m0 = wear.stats.marks, r0 = wear.stats.rounds, c0 = wear.stats.chips + wear.stats.puffs; const sig0 = JSON.stringify(game.decals.list.map((d: any) => [d.kind, d.param, d.radius, d.pos]));
      game.decals.enabled = false; fire(W, a, [tgt[0] + (n[0] ? 0 : -1), 1.3, tgt[2] + (n[2] ? 0 : -1)], 2); game.decals.enabled = true;
      verdict(wear.stats.rounds === r0 + 2 && wear.stats.marks === m0 && wear.stats.chips + wear.stats.puffs === c0 && JSON.stringify(game.decals.list.map((d: any) => [d.kind, d.param, d.radius, d.pos])) === sig0, 'a counted round that laid no mark adopts no other mark and throws nothing', `rounds ${r0} → ${wear.stats.rounds}, marks ${wear.stats.marks}, thrown ${c0} → ${wear.stats.chips + wear.stats.puffs}`); }
    // ---------------------------------------------------------------- reset
    fire(W, a, [tgt[0] + (n[0] ? 0 : 1), 1.3, tgt[2] + (n[2] ? 0 : 1)], 2);
    const had = marksOf(game).length; game.restartEncounter();
    verdict(had > 0 && game.decals.list.length === 0 && cellsOf(wear) === 0, 'restart puts the picture back: no mark, no list', `${had} wear marks before; after: decals ${game.decals.list.length}, ${wear.summary()}`);
  }

  // ---------------------------------------------------------------- same play, look on and off
  { const run = async (on: boolean) => {
      const { W, game } = await stage(31); game.destr.walls.wear.on = on;
      const pick = pickWall(game)!; const { a, b, mid, n } = pick; const side: Vec3 = [n[0] ? 0 : 1, 0, n[2] ? 0 : 1];
      const dig: string[] = []; const each = () => { dig.push(JSON.stringify(digestGame(game, true))); };
      fire(W, a, [mid[0], 1.3, mid[2]], 4, each);                                   // a cell part worn
      fire(W, b, [mid[0] + side[0], 1.4, mid[2] + side[2]], 7, each);               // the next column from the far side: a port
      fire(W, a, [mid[0] - side[0], 0.35, mid[2] - side[2]], 16, each);             // a sill: its upper first (a port), then the sill itself (a gap a man walks)
      fire(W, a, [mid[0], 1.3, mid[2]], 3, each);                                   // the first cell finished
      const marks = game.decals.list.map((d: any) => `${d.kind}:${f3(d.radius)}`);
      return { dig, log: WALL_LOG.join('|'), stats: JSON.stringify(WALL_STATS), feed: JSON.stringify(game.destr.walls.changes), open: JSON.stringify(game.destr.walls.all().map((x: any) => [x.id, x.open])),
        debris: game.destr.debris.list.map((c: any) => c.box.c.map((x: number) => x.toFixed(4)).join(',')).join('|'), decals: game.decals.list.length, marks, wear: game.destr.walls.wear.summary() };
    };
    const A = await run(true), B = await run(false);
    let diff = -1; for (let i = 0; i < Math.max(A.dig.length, B.dig.length); i++) if (A.dig[i] !== B.dig[i]) { diff = i; break; }
    verdict(diff < 0 && A.dig.length === 30, 'the game digest after every round is the same with the look on and off', diff < 0 ? `${A.dig.length} digests equal` : `first differs after round ${diff + 1}`);
    verdict(A.log === B.log && A.stats === B.stats && A.feed === B.feed && A.open === B.open && A.debris === B.debris && A.decals === B.decals, "the walls' log, counts, open cells, feed, the debris pool and the decal count are the same", `${A.log.split('|').length} log rows, stats ${A.stats}, ${A.decals} decals`);
    const onWear = A.marks.filter((m: string) => m.startsWith('damage')).length;
    verdict(onWear > B.marks.filter((m: string) => m.startsWith('damage')).length && B.marks.filter((m: string) => m.startsWith('bullet')).length > A.marks.filter((m: string) => m.startsWith('bullet')).length, 'off, the marks are the bullet marks they always were', `on: ${onWear} damage marks · ${A.wear}\n    off: ${B.marks.filter((m: string) => m.startsWith('bullet')).length} bullet marks, ${B.marks.filter((m: string) => m.startsWith('damage')).length} damage marks (the lane's own) · ${B.wear}`);
    verdict(/"holes":[1-9]/.test(A.stats) && /"ports":[3-9]/.test(A.stats), 'the script reached what it meant to: ports and a walkable gap', A.stats);
  }

  // ---------------------------------------------------------------- cover + checkpoint
  { const { W, game } = await stage(13); const wear = game.destr.walls.wear;
    const nav = game.col.nav; const free = (p: Vec3) => !nav.blocked[nav.idx(Math.floor(p[0] / nav.cell), Math.floor(p[2] / nav.cell))];
    let tried = false;
    for (const c of game.destr.walls.all()) {
      if (c.kind !== 'cover' || c.box.h[1] * 2 < 0.7 || Math.min(c.box.h[0], c.box.h[2]) < 0.3 || c.box.yaw) continue;
      const bx = c.box; const yH = Math.min(0.9, bx.c[1] + bx.h[1] - 0.15);
      for (const d of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]] as Vec3[]) {
        const ext = (d[0] ? bx.h[0] : bx.h[2]); const from = v3.mad([bx.c[0], 0, bx.c[2]], d, ext + 1.5); if (!free(from)) continue;
        const fh: Vec3 = [from[0], yH, from[2]], th: Vec3 = [bx.c[0], yH, bx.c[2]];
        const hit = game.col.raycast(fh, v3.normalize(v3.sub(th, fh)), 3); if (!hit || game.destr.walls.breakableAt(hit.index)?.id !== c.id) continue;
        const k0 = game.decals.list.length; fire(W, from, th, 1); const m = game.decals.list.slice(k0).find(isWear);
        const onFace = m ? Math.abs(Math.abs(v3.dot(v3.sub(m.pos, bx.c), d)) - ext) : NaN;
        verdict(game.decals.list.length >= k0 + 1 && isWear(m) && Math.floor(m.param - WEAR_MARK.look) === (c.surf === 'wood' ? 1 : c.surf === 'drywall' ? 0 : 2) && onFace < 0.01 && Math.abs(m.radius - (WEAR_MARK.reach0 + WEAR_MARK.reach1 * (m.param % 1))) < 1e-9, 'thick cover takes the mark on the face that was hit, nothing behind', `${c.surf} cover ${f3(ext * 2)} m deep: mark ${f3(onFace)} m off the face, radius ${f3(m?.radius ?? NaN)} m = its reach, material code ${Math.floor((m?.param ?? 3) - WEAR_MARK.look)}`);
        tried = true; break;
      }
      if (tried) break;
    }
    if (!tried) verdict(false, 'thick cover takes the mark on the face that was hit', 'no free-standing unrotated cover with a clear approach on this level: the check did not run');
    const pick = pickWall(game)!; fire(W, pick.a, [pick.mid[0], 1.3, pick.mid[2]], 3);
    const sig = () => JSON.stringify(marksOf(game).map((d: any) => [d.kind, f3(d.param), f3(d.radius), d.pos.map(f3), d.seed]));
    const before = sig(); const count = game.decals.list.length; const save = JSON.stringify(W.snapshot('wear', true));
    const wearKeys = Object.keys(JSON.parse(save)).filter(k => /wear/i.test(k));
    fire(W, pick.a, [pick.mid[0], 1.3, pick.mid[2]], 2);
    Math.random = seeded(55); W.restore(JSON.parse(save));
    verdict(sig() === before && game.decals.list.length === count && wearKeys.length === 0 && cellsOf(wear) === 0, "a load shows the wall as it was saved, through the ring's own slice; nothing of the look is in the file", `${marksOf(game).length} wear marks back as saved; file keys naming wear: ${wearKeys.length}; ${wear.summary()}`);
    fire(W, pick.a, [pick.mid[0], 1.3, pick.mid[2]], 1); const m = game.decals.list.at(-1);
    verdict(isWear(m) && m.param > 3.3 && m.param < 4, 'the next round after the load is marked at the strength of the count the file carried', `strength ${f3((m?.param ?? 3) - 3)} on the cell's 4th round`);
  }
  return done();
}
