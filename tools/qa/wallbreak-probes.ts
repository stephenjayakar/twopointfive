// The 'wallbreak' probe family (src/game/wallbreak.ts — interior walls and cover coming apart under rounds and blasts), run through probes.ts:
//   bun run tools/qa/probes.ts wallbreak | wallbreak-blast | wallbreak-fire | wallbreak-cover | wallbreak-seams | wallbreak-caps | wallbreak-reset |
//                               wallbreak-determinism | wallbreak-checkpoint | wallbreak-off [--verbose] [--level block-squads]
// Headless = the Proxy device: nothing is drawn. What is asserted is the ONE MODEL — after each break the questions the game asks of the level agree:
//   (blast)        a charge against a partition on a loud level opens a hole a man fits through: before, the round's ray / the sight test / the sound test / the feet /
//                  the nav route all say WALL; after, all five say OPEN (the round's ray passes, eyes pass, sound goes straight, a man's circle is not pushed, the
//                  nav route runs through it), the picture's static list is the collision's list object for object, the hidden authored box is out of both, a
//                  light's reach mask gains cells past the hole, the smoke solver was told, the AI's feed has a walkable 'hole' row naming the nav cells;
//   (fire)         sustained rifle fire into one column opens a PORT: rounds / eyes / sound pass at chest height, feet and the nav route do not; the row says so;
//                  fire kept on the sill takes it too → a walkable gap; a first round alone opens nothing;
//   (cover)        a crate chewed by fire until nothing stands: before it stopped the ray, the sight line and the feet; after, none of them, its nav cells are
//                  floor, the row says dead; what stood on it is gone from where it was;
//   (seams)        doors and glass are NOT this engine's: a blast and a magazine beside / into a door leave every leaf's state as it was; g.destr.blast tells its
//                  onBlast subscribers, then g.doors.blast(at, tearM, who) — BEFORE the walls are judged — and reports the counts they
//                  add (res.doors, res.panes); a row another system files through walls.note reaches the feed's listeners; with the switch off nobody is called;
//   (caps)         every wall of the level blasted end to end and every crate shot: appended statics ≤ WALLS.maxPieces, the box table has head-room, debris ≤ its
//                  pool, the feed ≤ its ring; with the piece cap forced tiny, the over-cap change is REFUSED whole (cells back, lists consistent, counted);
//   (reset)        restartEncounter after a wrecked minute: the static list is the authored one, every authored flag word as it was, the nav grid bit for bit, the
//                  wall is a wall again to all five questions, a 'reset' row is filed;
//   (determinism)  the same seeded wreck twice → the same log, pieces, nav grid, feed;
//   (checkpoint)   a save after the wreck carries the walls; loaded into the same game and into a fresh one the same cells are open, the same pieces stand, the
//                  nav grid is the same, the fingerprint never moved; a file naming a breakable this level has not is refused;
//   (off)          the switches: with THE ONE SWITCH off (destructionSwitch.ts DESTRUCTION.on — how every older probe and the base's digests run) the same rounds
//                  and the same blast call touch nothing and the run digests exactly as a run that never called blast; at chaos 0 likewise; with tune.wallBreak
//                  off at chaos 0.5 the lane's old destruction runs and the level still stands.
import { standUp, ROOT, fake } from './headless.ts';
import { readFileSync } from 'node:fs';
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const { fireWeapon, armThrough } = await import(`${ROOT}/src/game/combat.ts`);
const { GUNWALL } = await import(`${ROOT}/src/game/gunwall.ts`);
const { DOORBLAST, DOORSHOT } = await import(`${ROOT}/src/game/doorblast.ts`);
const { WEAPONS } = await import(`${ROOT}/src/game/weapons.ts`);
const { Particles } = await import(`${ROOT}/src/render/particles.ts`);
const WB = await import(`${ROOT}/src/game/wallbreak.ts`);
const { WALLS, WALL_STATS, WALL_LOG } = WB;
const { BoxFlag } = await import(`${ROOT}/src/scene/boxes.ts`);
const { reachLevel, reachMaskFor } = await import(`${ROOT}/src/render/reach.ts`);
const { WORLD } = await import(`${ROOT}/src/scene/world.ts`);
const { PLAYER_ID } = await import(`${ROOT}/src/game/consts.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { levelFingerprint, canLoad } = await import(`${ROOT}/src/game/savestate.ts`);
const { digestGame } = await import(`${ROOT}/src/game/digest.ts`);
const { DESTRUCTION, FURNBLAST } = await import(`${ROOT}/src/game/destructionSwitch.ts`);
const { COVERFIRE } = await import(`${ROOT}/src/game/coverfire.ts`);

type Vec3 = [number, number, number];
const DT = 1 / 60;
const VERBOSE = process.argv.includes('--verbose');
const LEVEL = (() => { const i = process.argv.indexOf('--level'); return i >= 0 ? process.argv[i + 1] : 'block-squads'; })();
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f2 = (x: number) => x.toFixed(2);
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { const ok = all; console.log(`=== ${title.split(':')[0]}: ${ok ? 'ALL PASS' : 'FAILURES above'} ===`); return ok; } };
}
const resetStats = () => { for (const k of Object.keys(WALL_STATS)) (WALL_STATS as any)[k] = 0; WALL_LOG.length = 0; };
const DEFAULTS = JSON.parse(JSON.stringify(WALLS));
const restoreKnobs = () => { for (const k of Object.keys(DEFAULTS)) (WALLS as any)[k] = JSON.parse(JSON.stringify(DEFAULTS[k])); };

/** the harness Game on the loud level at `chaos`, a Particles attached, the smoke stand-in recording what it is told, everyone deaf, blind and out of the way */
async function stage(seed: number, chaos: number, level = LEVEL, sw = true) {
  Math.random = seeded(seed); restoreKnobs(); DESTRUCTION.on = sw;   // (the probes raise THE ONE SWITCH themselves; probes.ts' run() puts it back off after each)
  const lv = level === 'office' ? undefined : loadLevel(parseLevelData(readFileSync(`${ROOT}/levels/${level}.json`, 'utf8')));
  const W = await standUp(lv ? { level: lv } : {}); const { game, engine } = W;
  engine.particles = new Particles(fake('device'), fake('sceneLayout')); engine.settings.gpuParticles = true;
  const told: { c: Vec3; r: number }[] = []; W.smoke.obstaclesChanged = (c: Vec3, r: number) => { told.push({ c: [...c] as Vec3, r }); };
  game.godMode = true; game.aiEnabled = false; game.player.visibility = 0.02; game.tune.chaos = chaos; resetStats();
  for (let i = 0; i < 3; i++) W.step(DT);
  for (const gd of game.guards) { gd.hold = true; gd.pinned = true; gd.heardUpTo = 1e12; gd.flashlight.enabled = false; }
  game.player.slot = 'rifle'; game.player.holstered = false;
  return { W, game, engine, told };
}
/** a partition column with open floor on both sides, away from doors and the wall's ends: the wall, its column, the two standing points a / b either side */
function pickWall(game: any, skip = 0): { id: number; box: any; alongX: boolean; mid: Vec3; n: Vec3; a: Vec3; b: Vec3 } | null {
  const nav = game.col.nav; const free = (p: Vec3) => !nav.blocked[nav.idx(Math.floor(p[0] / nav.cell), Math.floor(p[2] / nav.cell))];
  let seen = 0;
  for (const w of game.destr.walls.all()) {
    if (w.kind !== 'wall') continue; const b = w.box; const alongX = b.h[0] >= b.h[2]; const L = (alongX ? b.h[0] : b.h[2]);
    if (L < 1.6) continue;
    const nCol = Math.min(32, Math.max(1, Math.round(2 * L / WALLS.col))), wCol = 2 * L / nCol;   // (the engine's own columns: stand on a column's centre, never a seam)
    for (let k = 0; k < nCol; k++) {
      const u = -L + (k + 0.5) * wCol; if (u < -L + 1.4 || u > L - 1.4) continue;
      const mid: Vec3 = alongX ? [b.c[0] + u, 0, b.c[2]] : [b.c[0], 0, b.c[2] + u]; const n: Vec3 = alongX ? [0, 0, 1] : [1, 0, 0];
      const a = v3.mad(mid, n, 1.2), bb = v3.mad(mid, n, -1.2);
      if (!free(a) || !free(bb) || !free(v3.mad(mid, n, 0.7)) || !free(v3.mad(mid, n, -0.7))) continue;
      if (game.col.solidBlocked([a[0], 1.3, a[2]], [mid[0] + n[0] * 0.2, 1.3, mid[2] + n[2] * 0.2]) || game.col.solidBlocked([bb[0], 1.3, bb[2]], [mid[0] - n[0] * 0.2, 1.3, mid[2] - n[2] * 0.2])) continue;
      if (game.doors.list.some((d: any) => Math.hypot(d.frameCentre[0] - mid[0], d.frameCentre[2] - mid[2]) < 2.2)) continue;
      if (seen++ < skip) break;
      return { id: w.id, box: b, alongX, mid, n, a, b: bb };
    }
  }
  return null;
}
/** the five questions between two standing points either side of something */
function ask(game: any, a: Vec3, b: Vec3, mid: Vec3) {
  const col = game.col; const A: Vec3 = [a[0], 1.3, a[2]], B: Vec3 = [b[0], 1.3, b[2]]; const d = v3.sub(B, A); const L = v3.len(d);
  const hit = col.raycast(A, v3.scale(d, 1 / L), L);
  const q: Vec3 = [mid[0], 0, mid[2]]; const moved = col.collideCircle(q, 0.3, 0.25, 1.5) ? Math.hypot(q[0] - mid[0], q[2] - mid[2]) : 0;
  col.sound.invalidate(); const pr = col.sound.propagate([a[0], 1.6, a[2]], [b[0], 1.6, b[2]]);
  const path = col.nav.findPath(a, b); let pl = Infinity; if (path) { pl = 0; let p = a; for (const w of path) { pl += Math.hypot(w[0] - p[0], w[2] - p[2]); p = w; } }
  const navMid = col.nav.blocked[col.nav.idx(Math.floor(mid[0] / col.nav.cell), Math.floor(mid[2] / col.nav.cell))];
  return { ray: !!hit, rayIndex: hit ? hit.index : -1, sight: col.segmentBlocked([a[0], 1.6, a[2]], [b[0], 1.6, b[2]]), shot: col.shotBlocked(A, B), sound: col.solidBlocked([a[0], 1.6, a[2]], [b[0], 1.6, b[2]]), soundDirect: pr.direct, soundLen: pr.pathLen, feet: moved > 0.01, path: pl, navMid, straight: Math.hypot(a[0] - b[0], a[2] - b[2]) };
}
const words = (q: ReturnType<typeof ask>) => `ray ${q.ray ? 'stops' : 'passes'} · sight ${q.sight ? 'blocked' : 'clear'} · shot ${q.shot ? 'blocked' : 'clear'} · sound ${q.soundDirect ? 'direct' : 'routed'} ${f2(q.soundLen)} m · feet ${q.feet ? 'pushed out' : 'stand in it'} · nav route ${isFinite(q.path) ? f2(q.path) + ' m' : 'none'} (straight ${f2(q.straight)})`;
const navHash = (game: any) => { let h = 0x811c9dc5; const b = game.col.nav.blocked; for (let i = 0; i < b.length; i++) { h ^= b[i]; h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
const piecesOf = (game: any) => { const out: string[] = []; const a = game.destr.walls.authored; for (let i = a; i < game.col.boxes.length; i++) { const b = game.col.boxes[i]; if (b.flags & BoxFlag.NoShadow) continue; out.push([...b.c, ...b.h].map((x: number) => x.toFixed(3)).join(',')); } return out.sort(); };
const flagsOf = (game: any) => game.col.boxes.slice(0, game.destr.walls.authored).map((b: any) => b.flags);
function lists(game: any, engine: any): string | null {
  const c = game.col.boxes, w = engine.world.statics; if (c.length !== w.length) return `collision ${c.length} statics vs the picture's ${w.length}`;
  for (let i = 0; i < c.length; i++) if (c[i] !== w[i]) return `static ${i} is not the same box in the two lists`;
  for (let i = game.destr.walls.authored; i < c.length; i++) { const b = c[i]; for (const v of [...b.c, ...b.h]) if (!isFinite(v)) return `piece ${i} not finite`; if (Math.min(...b.h) <= 0) return `piece ${i} has no size`; }
  return null;
}
/** fire `n` rifle rounds from `from` at `at` (Sam's own rounds through fireWeapon — the real path: col.raycast → destr.round) */
function fire(W: any, from: Vec3, at: Vec3, n: number, gap = 6): number {
  const game = W.game; game.teleportPlayer([from[0], 0, from[2]]); const yaw = Math.atan2(at[0] - from[0], at[2] - from[2]); game.player.char.bodyYaw = game.player.char.aimYaw = yaw; W.step(DT);
  let fired = 0;
  for (let r = 0; r < n; r++) { fireWeapon(game, game.player.char, at, true, { weapon: WEAPONS.fn2000 }); fired++; for (let f = 0; f < gap; f++) W.step(DT); }
  return fired;
}

// ================================================================ blast
export async function wallbreakBlast(): Promise<boolean> {
  const F = family(`wallbreak-blast: a charge against a partition opens a hole a man fits through — and every question agrees (${LEVEL})`);
  const { W, game, engine, told } = await stage(11, 0.5);
  const inv = game.destr.walls.inventory();
  F.verdict(inv.walls > 0 && inv.cover > 0, 'the level has partitions and cover to break', `${inv.walls} partition walls (${f2(inv.wallM)} m), ${inv.cover} pieces of cover, of ${game.col.boxes.length} statics`);
  const pick = pickWall(game); if (!pick) { F.verdict(false, 'a partition with floor both sides', 'none found'); return F.done(); }
  const { a, b, mid, n } = pick;
  const before = ask(game, a, b, mid); const fp0 = levelFingerprint(game).fp; const statics0 = game.col.boxes.length;
  F.verdict(before.ray && before.rayIndex === pick.id && before.sight && before.shot && before.sound && before.feet && before.navMid === 1 && before.path > before.straight * 1.5, 'before: it is a wall to all five',
    `wall #${pick.id} at (${f2(mid[0])}, ${f2(mid[2])}): ${words(before)}`);
  // a light whose mask does not reach the far side
  const farCell = Math.floor(b[2] - WORLD.min[2]) * WORLD.gridW + Math.floor(b[0] - WORLD.min[0]); const nearSide = (l: any) => (l.pos[0] - mid[0]) * n[0] + (l.pos[2] - mid[2]) * n[2] > 0;
  const masks0 = new Map<any, number>(); for (const l of engine.lights.lights) if (l.reach) masks0.set(l, reachLevel(l.reach, farCell));
  const heard: any[] = []; const off = game.destr.walls.onChange((c: any) => heard.push(c));
  const serial0 = game.destr.walls.serial;
  const at: Vec3 = [mid[0] + n[0] * 0.3, 0.3, mid[2] + n[2] * 0.3];
  const res = game.destr.blast(at, { who: PLAYER_ID }); off();
  for (let f = 0; f < 240; f++) W.step(DT);
  const after = ask(game, a, b, mid);
  F.verdict(res.walls >= 1 && res.opened > 0 && res.serial > serial0, 'the entry point reports what it broke', `g.destr.blast(at, {who}) → ${JSON.stringify(res)}`);
  F.verdict(!after.ray && !after.sight && !after.shot && !after.sound && after.soundDirect && !after.feet && after.navMid === 0 && after.path < before.path && after.path <= after.straight * 1.3, 'after: it is open to all five',
    words(after));
  // a man walks through it: a circle of the player's radius swept from a to b is never pushed
  { let stuck = 0; for (let s = 0; s <= 40; s++) { const p: Vec3 = v3.lerp(a, b, 0.2 + 0.6 * s / 40); const q: Vec3 = [p[0], 0, p[2]]; if (game.col.collideCircle(q, 0.3, 0.25, 1.5) && Math.hypot(q[0] - p[0], q[2] - p[2]) > 0.01) stuck++; }
    F.verdict(stuck === 0, 'a man-sized circle walks straight through', `41 stations from 0.7 m this side to 0.7 m that side, ${stuck} pushed`); }
  const row = heard.find(c => c.kind === 'hole' && c.id === pick.id);
  F.verdict(!!row && row.walkable && row.sight && row.opened.length > 0 && row.who === PLAYER_ID && row.cause === 'blast' && row.opened.every((i: number) => game.col.nav.blocked[i] === 0), 'the AI is told: a walkable hole, with the nav cells that opened',
    row ? `row serial ${row.serial}: kind ${row.kind}, cause ${row.cause}, walkable ${row.walkable}, ${row.opened.length} nav cells, rect [${row.rect.map(f2).join(', ')}], who ${row.who}; since(${serial0}) → ${game.destr.walls.since(serial0)?.length} rows` : `no hole row (heard ${heard.map(c => c.kind).join(',')})`);
  const lerr = lists(game, engine); const ab = game.col.boxes[pick.id];
  F.verdict(!lerr && (ab.flags & BoxFlag.NoShadow) !== 0 && (ab.flags & BoxFlag.NoPrimary) !== 0 && game.col.boxes.length > statics0, 'the picture and the collision read the same boxes',
    lerr ?? `${game.col.boxes.length - statics0} pieces appended to both lists (object for object), the authored box hidden from the raster and every ray; geomSerial ${engine.world.geomSerial}`);
  // reach masks
  let gained = 0, lightsNear = 0; for (const [l, lv0] of masks0) { if (!nearSide(l) || Math.hypot(l.pos[0] - mid[0], l.pos[2] - mid[2]) > l.range) continue; lightsNear++; if (lv0 === 0 && reachLevel(l.reach, farCell) > 0) gained++; }
  F.verdict(game.reachPending === 0 && (gained > 0 || lightsNear === 0), "the lights' reach masks were re-derived past the hole", `${lightsNear} masked lights in range on the charge's side, ${gained} now reach the far side's cell where they did not; queue drained`);
  { // the masks are re-decided only behind the changed rects (reach.ts ReachOnly): they must equal a whole re-derivation on the level as it now stands
    const solid = (game as any).reachSolid, interior = game.reachInterior; let cmp = 0, bad = 0;
    for (const l of (game as any).reachLights) { if (game.beacons.some((b: any) => b.light === l)) continue;   // a beacon's spot turns: its source points are wherever it faced when the mask was made
      const full = reachMaskFor(solid, l.pos, l.kind === 3 || l.kind === 1 ? l.dir : [0, 0, 0], l.radius, interior); cmp++;
      const cells: string[] = []; for (let ci = 0; ci < 40 * 28; ci++) { const x = (ci % 40) + 0.5, z = Math.floor(ci / 40) + 0.5; if (Math.hypot(x - l.pos[0], z - l.pos[2]) > l.range + 1) continue;   // past its range a light adds nothing: reachChanged leaves those lights alone
        if (reachLevel(full, ci) !== reachLevel(l.reach, ci)) cells.push(`${ci % 40},${Math.floor(ci / 40)}:${reachLevel(l.reach, ci)}→${reachLevel(full, ci)}`); }
      if (cells.length) { bad++; if (VERBOSE) console.log(`    ${l.name} at ${f2(l.pos[0])},${f2(l.pos[2])} range ${f2(l.range)} r ${l.radius}: ${cells.slice(0, 12).join(' ')}`); } }
    F.verdict(bad === 0, 'every masked light carries the mask a whole re-derivation gives, inside its range', `${cmp} lights compared, ${bad} differ`);
    let dirs = 0, dbad = 0; for (const l of engine.lights.lights) if (l.kind === 2 && l.reachDir) { const inc = l.reachDir; game.buildDirReach(l); dirs++; for (let k = 0; k < inc.length; k++) if (inc[k] !== l.reachDir[k]) { dbad++; break; } }
    if (dirs) F.verdict(dbad === 0, "the moon's mask too", `${dirs} directional lights compared, ${dbad} differ`);
  }
  F.verdict(told.length > 0, 'the smoke solver was told its obstacles changed', `${told.length} obstaclesChanged calls, the first r ${f2(told[0]?.r ?? 0)} m at (${told[0]?.c.map(f2).join(', ')})`);
  F.verdict(levelFingerprint(game).fp === fp0, 'the level fingerprint did not move', `fp ${fp0} before and after ${game.col.boxes.length - statics0} appended statics`);
  if (VERBOSE) console.log(WALL_LOG.join('\n'));
  return F.done();
}

// ================================================================ fire
export async function wallbreakFire(): Promise<boolean> {
  const F = family(`wallbreak-fire: sustained fire opens a port rounds and eyes pass — feet do not (${LEVEL})`);
  const { W, game } = await stage(12, 0.5);
  const pick = pickWall(game); if (!pick) { F.verdict(false, 'a partition with floor both sides', 'none found'); return F.done(); }
  const { a, b, mid } = pick; const before = ask(game, a, b, mid);
  const tgt: Vec3 = [mid[0], 1.3, mid[2]];
  fire(W, a, tgt, 1);
  F.verdict(game.destr.walls.serial === 0 && ask(game, a, b, mid).ray, 'one round opens nothing', `serial ${game.destr.walls.serial}, the wall still stops the ray`);
  let rounds = 1; while (rounds < 40 && game.destr.walls.serial === 0) { fire(W, a, tgt, 1); rounds++; }
  const port = ask(game, a, b, mid); const row = game.destr.walls.changes[0];
  F.verdict(rounds === Math.ceil(WALLS.tough.drywall), `the port opens on round ${rounds} at chaos 0.5`, `WALLS.tough.drywall ${WALLS.tough.drywall} rifle rounds into one column`);
  F.verdict(!port.ray && !port.sight && !port.shot && !port.sound && port.soundDirect, 'rounds, eyes and sound pass the port', words(port));
  F.verdict(port.feet && port.navMid === 1 && Math.abs(port.path - before.path) < 0.01, 'feet and the nav route do not', `feet pushed out, nav cell still blocked, route ${f2(port.path)} m (before ${f2(before.path)})`);
  F.verdict(!!row && row.kind === 'port' && !row.walkable && row.sight && row.cause === 'fire' && row.opened.length === 0, 'the row says port, not walkable', row ? `kind ${row.kind}, walkable ${row.walkable}, sight ${row.sight}, cause ${row.cause}` : 'no row');
  // a round fired now really crosses: it stops in something past the wall
  { const s0 = WALL_STATS.rounds; fire(W, a, tgt, 3); F.verdict(WALL_STATS.rounds === s0, 'the next rounds go through the port', `3 more rounds at the same point: ${WALL_STATS.rounds - s0} stopped in this partition's column`); }
  // the sill
  const low: Vec3 = [mid[0], 0.35, mid[2]]; let sillRounds = 0; while (sillRounds < 40 && !game.destr.walls.changes.some((c: any) => c.kind === 'hole')) { fire(W, a, low, 1); sillRounds++; }
  const gap = ask(game, a, b, mid);
  F.verdict(sillRounds === Math.ceil(WALLS.tough.drywall * WALLS.sillK), `fire kept on the sill takes it on round ${sillRounds}`, `tough × sillK = ${WALLS.tough.drywall * WALLS.sillK}`);
  F.verdict(gap.feet === (gap.navMid === 1) && !gap.ray, 'one column wide (0.5 m): the feet and the nav grid give the same answer', `feet ${gap.feet ? 'pushed out' : 'free'} at the column's centre, nav cell ${gap.navMid ? 'blocked' : 'free'}, route ${f2(gap.path)} m — ${gap.navMid ? 'too narrow for a man (0.3 m body, 0.34 m nav clearance)' : 'a man fits'}; the ray passes floor to top`);
  F.verdict(game.destr.walls.changes.at(-1).walkable === (game.destr.walls.changes.at(-1).opened.length > 0), "the row's walkable = a nav cell really opened", `walkable ${game.destr.walls.changes.at(-1).walkable}, opened ${game.destr.walls.changes.at(-1).opened.length}`);
  if (VERBOSE) console.log(WALL_LOG.join('\n'));
  return F.done();
}

// ================================================================ pressed to it
/** A man PRESSED to a partition has his muzzle out of its far face (combat.ts armThrough): the hit scan starts beyond the wall and never meets it. Under the
 *  switch that round is given to the column his arm crosses (combat.ts wallAcrossArm); with the switch off it is nobody's, as on the base.
 *  Asked with 'guns come down at walls' (gunwall.ts) held off: on the shipped stand that rule lowers his rifle before the muzzle is through, so there is no
 *  such round to ask about — the rule a round fired from inside the wood answers to is what is held here, for whoever's gun does get there. */
export async function wallbreakPressed(): Promise<boolean> {
  const F = family(`wallbreak-pressed: a round fired with the muzzle through a partition is counted on it (${LEVEL})`);
  const gunwall = GUNWALL.on; GUNWALL.on = false;
  const run = async (sw: boolean) => {
    const { W, game } = await stage(12, 0.5, LEVEL, sw); const pick = sw ? pickWall(game) : null;
    // (switch off: the engine has indexed nothing — the same wall is found with it on first, and stood at by its place)
    return { W, game, pick };
  };
  const on = await run(true); if (!on.pick) { F.verdict(false, 'a partition with floor both sides', 'none found'); return F.done(); }
  const { mid, n } = on.pick; const from = v3.mad(mid, n, 0.6) as Vec3, at = v3.mad(mid, n, 0.3) as Vec3, tgt: Vec3 = [mid[0] - n[0] * 3, 1.3, mid[2] - n[2] * 3];
  const press = (W: any) => { const game = W.game; game.teleportPlayer([from[0], 0, from[2]]); game.puppet = { goal: [at[0], 0, at[2]], aim: tgt };   // (walked into it: a teleport stands him on a free nav cell, a stride off)
    for (let i = 0; i < 90; i++) W.step(DT); return armThrough(game, game.player.char); };
  const shoot = (W: any, k: number) => { for (let r = 0; r < k; r++) { fireWeapon(W.game, W.game.player.char, tgt, true, { weapon: WEAPONS.fn2000 }); for (let f = 0; f < 6; f++) W.step(DT); } };
  const poked = press(on.W);
  F.verdict(poked, 'walked up against it with the rifle up, his muzzle is beyond the wall (armThrough)', `player (${f2(on.game.player.char.pos[0])}, ${f2(on.game.player.char.pos[2])}) · muzzle (${f2(on.game.player.char.muzzle[0])}, ${f2(on.game.player.char.muzzle[2])}) · wall at (${f2(mid[0])}, ${f2(mid[2])})`);
  shoot(on.W, 1);
  F.verdict(WALL_STATS.rounds === 1 && on.game.destr.walls.serial === 0, 'one round fired there is counted on the partition and opens nothing', `engine rounds ${WALL_STATS.rounds}, serial ${on.game.destr.walls.serial}`);
  let rounds = 1; while (rounds < 40 && on.game.destr.walls.serial === 0) { shoot(on.W, 1); rounds++; }
  const row = on.game.destr.walls.changes[0];
  F.verdict(rounds === Math.ceil(WALLS.tough.drywall) && !!row && row.kind === 'port' && row.cause === 'fire' && row.who === PLAYER_ID, `the column gives on round ${rounds}, as it does from across the room`, row ? `kind ${row.kind}, cause ${row.cause}, whose ${row.who === PLAYER_ID ? 'his' : row.who}` : 'no row');
  const off = await run(false); const pokedOff = press(off.W); shoot(off.W, 8);
  F.verdict(pokedOff && WALL_STATS.rounds === 0 && off.game.destr.walls.serial === 0, 'THE ONE SWITCH off: the same eight rounds are nobody\'s, as on the base', `armThrough ${pokedOff}, engine rounds ${WALL_STATS.rounds}, serial ${off.game.destr.walls.serial}`);
  const fo = await run(true); COVERFIRE.on = false; const pokedFo = press(fo.W); shoot(fo.W, 8); COVERFIRE.on = true;
  F.verdict(pokedFo && WALL_STATS.rounds === 0 && fo.game.destr.walls.serial === 0, 'the aimed-fire piece\'s switch off under the destruction\'s (PT_COVERFIRE=0): the same eight rounds count nothing, as on the engine\'s own build', `armThrough ${pokedFo}, engine rounds ${WALL_STATS.rounds}, serial ${fo.game.destr.walls.serial}`);
  DESTRUCTION.on = false; GUNWALL.on = gunwall;
  return F.done();
}

// ================================================================ cover
export async function wallbreakCover(): Promise<boolean> {
  const F = family(`wallbreak-cover: cover chewed by fire until it neither hides nor protects (${LEVEL})`);
  const { W, game, engine } = await stage(13, 0.5);
  const nav = game.col.nav; const free = (p: Vec3) => !nav.blocked[nav.idx(Math.floor(p[0] / nav.cell), Math.floor(p[2] / nav.cell))];
  let done = 0, skipped = 0;
  for (const c of game.destr.walls.all()) {
    if (c.kind !== 'cover' || c.box.h[1] * 2 < 0.7 || Math.min(c.box.h[0], c.box.h[2]) < 0.3) continue;
    const bx = c.box; const mid: Vec3 = [bx.c[0], 0, bx.c[2]]; const yH = Math.min(0.9, bx.c[1] + bx.h[1] - 0.15);
    let a: Vec3 | null = null, b: Vec3 | null = null;
    for (const n of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]] as Vec3[]) { const ext = (n[0] ? bx.h[0] : bx.h[2]) + 0.9; const p = v3.mad(mid, n, ext), q = v3.mad(mid, n, -(ext - 0.82)), far = v3.mad(mid, n, ext + 0.6); if (free(p) && free(far) && !game.col.solidBlocked([far[0], 1.3, far[2]], [p[0], 1.3, p[2]])) { a = far; b = q; break; } }
    if (!a || !b) continue;
    const ah: Vec3 = [a[0], yH, a[2]], bh: Vec3 = [b[0], yH, b[2]];
    const hit0 = game.col.raycast(ah, v3.normalize(v3.sub(bh, ah)), v3.dist(ah, bh)); if (!hit0 || game.destr.walls.breakableAt(hit0.index)?.id !== c.id) continue;
    const hitB = game.col.raycast(bh, v3.normalize(v3.sub(ah, bh)), v3.dist(ah, bh)); if (!hitB || game.destr.walls.breakableAt(hitB.index)?.id !== c.id) continue;   // (it alone stands between the two points)
    // is it the only thing a man's body meets on this spot (a crate under a rack's shelf is not: the shelf still stops him once the crate is gone)?
    const alone = !game.col.boxes.some((o: any, i: number) => i !== c.id && !(o.flags & (BoxFlag.NoShadow | BoxFlag.Glass)) && o.c[1] + o.h[1] > 0.25 && o.c[1] - o.h[1] < 1.5 && Math.abs(o.c[0] - mid[0]) < Math.abs(Math.cos(o.yaw)) * o.h[0] + Math.abs(Math.sin(o.yaw)) * o.h[2] + 0.3 && Math.abs(o.c[2] - mid[2]) < Math.abs(Math.sin(o.yaw)) * o.h[0] + Math.abs(Math.cos(o.yaw)) * o.h[2] + 0.3);
    const q0: Vec3 = [mid[0], 0, mid[2]]; const feet0 = game.col.collideCircle(q0, 0.3, 0.25, 1.5);
    const before = { ray: true, sight: game.col.segmentBlocked(ah, bh), shot: game.col.shotBlocked(ah, bh), feet: feet0, nav: nav.blocked[nav.idx(Math.floor(mid[0] / nav.cell), Math.floor(mid[2] / nav.cell))] };
    F.verdict(before.sight && before.shot && before.feet && before.nav === 1, `before: ${c.surf} cover #${c.id} hides and protects`, `${f2(bx.h[0] * 2)} × ${f2(bx.h[1] * 2)} × ${f2(bx.h[2] * 2)} m at (${f2(mid[0])}, ${f2(mid[2])}), ${c.cells} cells: ray stops · sight blocked · shot blocked · feet pushed · nav blocked`);
    const serial0 = game.destr.walls.serial; let rounds = 0; const debris0 = game.destr.debris.stats.spawned; const rounds0 = WALL_STATS.rounds;
    // walk the fire across it the way a man hosing a crate does: from where he stands, aim at whatever of it still stops the round (judged from the MUZZLE, as the round flies)
    fire(W, a, [mid[0], yH, mid[2]], 0);
    while (rounds < 400) {
      const now = game.destr.walls.all().find((x: any) => x.id === c.id); if (now.open === now.cells) break;
      const mz = game.player.char.muzzle as Vec3; let aim: Vec3 | null = null;
      scan: for (const y of [yH, 0.45, 0.25]) for (let i = 0; i < 7; i++) for (let k = 0; k < 7; k++) {
        const lx = (((i + 1) >> 1) * (i & 1 ? 1 : -1)) / 3 * bx.h[0] * 0.92, lz = (((k + 1) >> 1) * (k & 1 ? 1 : -1)) / 3 * bx.h[2] * 0.92; const cs = Math.cos(bx.yaw), sn = Math.sin(bx.yaw);
        const t: Vec3 = [bx.c[0] + cs * lx + sn * lz, Math.max(bx.c[1] - bx.h[1] + 0.05, Math.min(y, bx.c[1] + bx.h[1] - 0.05)), bx.c[2] - sn * lx + cs * lz];
        const h = game.col.raycast(mz, v3.normalize(v3.sub(t, mz)), v3.dist(mz, t) + 0.3); if (h && game.destr.walls.breakableAt(h.index)?.id === c.id) { aim = t; break scan; }
      }
      if (!aim) break;
      fireWeapon(game, game.player.char, aim, true, { weapon: WEAPONS.fn2000 }); rounds++; for (let f = 0; f < 4; f++) W.step(DT);
      if (rounds === 12 && game.destr.walls.serial === serial0 && WALL_STATS.rounds === rounds0) break;   // not one round reached it: furniture (a chair, a prop) stands in the line — not a piece this probe can chew
    }
    if (WALL_STATS.rounds === rounds0) { skipped++; continue; }
    for (let f = 0; f < 120; f++) W.step(DT);
    const now = game.destr.walls.all().find((x: any) => x.id === c.id);
    const hit1 = game.col.raycast(ah, v3.normalize(v3.sub(bh, ah)), v3.dist(ah, bh)); const q1: Vec3 = [mid[0], 0, mid[2]];
    const after = { ray: !!hit1 && game.destr.walls.breakableAt(hit1.index)?.id === c.id, sight: game.col.segmentBlocked(ah, bh), shot: game.col.shotBlocked(ah, bh), feet: game.col.collideCircle(q1, 0.3, 0.25, 1.5) && Math.hypot(q1[0] - mid[0], q1[2] - mid[2]) > 0.01, nav: nav.blocked[nav.idx(Math.floor(mid[0] / nav.cell), Math.floor(mid[2] / nav.cell))] };
    const rows = game.destr.walls.since(serial0) ?? [];
    F.verdict(now.open === now.cells && rows.some((r: any) => r.kind === 'cover' && r.dead && r.id === c.id), `it is gone after ${rounds} rifle rounds`, `${now.open}/${now.cells} cells open; ${rows.length} rows (${rows.filter((r: any) => r.kind === 'cover').length} cover, the last dead ${rows.at(-1)?.dead}); toughness ${WALLS.tough[c.surf]} a cell; ${game.destr.debris.stats.spawned - debris0} chunks thrown`);
    F.verdict(!after.ray && !after.sight && !after.shot && (!alone || (!after.feet && after.nav === 0)), alone ? 'after: it stops nothing and the floor under it is floor' : 'after: it stops no round and no eye (a rack shelf over the spot still stops a man: feet and nav agree)', `ray ${after.ray ? 'stops' : 'passes'} · sight ${after.sight ? 'blocked' : 'clear'} · shot ${after.shot ? 'blocked' : 'clear'} · feet ${after.feet ? 'pushed' : 'free'} · nav ${after.nav ? 'blocked' : 'free'}; ${rows.reduce((s: number, r: any) => s + r.opened.length, 0)} nav cells opened in all`);
    // nothing that stood on it is left in the air: every solid thing over its footprint off the floor has something solid under it or beside it
    { let left = 0; const ex = Math.abs(Math.cos(bx.yaw)) * bx.h[0] + Math.abs(Math.sin(bx.yaw)) * bx.h[2], ez = Math.abs(Math.sin(bx.yaw)) * bx.h[0] + Math.abs(Math.cos(bx.yaw)) * bx.h[2];
      const box3 = (o: any) => { const hx = Math.abs(Math.cos(o.yaw)) * o.h[0] + Math.abs(Math.sin(o.yaw)) * o.h[2], hz = Math.abs(Math.sin(o.yaw)) * o.h[0] + Math.abs(Math.cos(o.yaw)) * o.h[2]; return [o.c[0] - hx, o.c[0] + hx, o.c[1] - o.h[1], o.c[1] + o.h[1], o.c[2] - hz, o.c[2] + hz]; };
      const solids = game.col.boxes.filter((o: any) => !(o.flags & (BoxFlag.NoShadow | BoxFlag.Glass)));
      for (const o of solids) {
        const A = box3(o); if (A[2] < 0.1 || A[2] > 2.2 || (A[1] - A[0]) * (A[5] - A[4]) > 4) continue; if (Math.abs(o.c[0] - bx.c[0]) > ex - 0.02 || Math.abs(o.c[2] - bx.c[2]) > ez - 0.02) continue;
        const touching = solids.some((k: any) => { if (k === o) return false; const K = box3(k); return Math.min(A[1], K[1]) - Math.max(A[0], K[0]) > -0.05 && Math.min(A[3], K[3]) - Math.max(A[2], K[2]) > -0.07 && Math.min(A[5], K[5]) - Math.max(A[4], K[4]) > -0.05; });
        if (!touching) { left++; if (VERBOSE) console.log('    in the air: #' + game.col.boxes.indexOf(o), o.c.map(f2).join(','), o.h.map((x: number) => f2(x * 2)).join('×'), 'flags', o.flags); }
      }
      F.verdict(left === 0, 'nothing that stood on it is left in the air', `${WALL_STATS.falls} statics fell with it so far (${WALL_STATS.floating} too big to throw and left), ${left} solid statics over its footprint touch nothing`); }
    const lerr = lists(game, engine); F.verdict(!lerr, 'lists consistent', lerr ?? `${game.col.boxes.length} statics in both`);
    if (++done >= 2) break;
  }
  const nCover = game.destr.walls.inventory().cover;
  if (done > 0) F.verdict(true, 'found cover to chew', `${done} pieces tested`);
  else console.log(`- NOTE — no piece of cover on this level stands clear enough to test from both sides (${nCover} indexed, ${skipped} with furniture in the line): nothing checked here`);
  if (VERBOSE) console.log(WALL_LOG.join('\n'));
  return F.done();
}

// ================================================================ seams
const keepState = (game: any) => JSON.stringify(game.doors.list.map((d: any) => [d.def.name, d.locked, d.lockBroken]));
const leafState = (game: any) => JSON.stringify(game.doors.list.map((d: any) => [d.def.name, d.locked, d.lockBroken, +d.angle.toFixed(4), +d.vel.toFixed(4)]));
export async function wallbreakSeams(): Promise<boolean> {
  const F = family(`wallbreak-seams: doors and glass are their owners'; the blast call list (${LEVEL})`);
  const { W, game } = await stage(14, 0.5);
  const d = game.doors.list.find((x: any) => !x.def.steel) ?? game.doors.list[0];
  if (!d) { F.verdict(true, 'no doors on this level', 'nothing to test'); return F.done(); }
  const fc = d.frameCentre as Vec3; const at: Vec3 = [fc[0] + 0.5, 0.3, fc[2] + 0.5];
  // (1) nothing of mine touches a leaf: a default charge half a metre off the frame, then a magazine into the leaf (no stepping in between: the doors' own closer is not what is measured).
  //     The doors' OWN answer to a blast (doorblast.ts: a leaf off its hinges, on the shipped stand) is held off for this one call — it is the door owner's, and its count is `doors`.
  //     So is the doors' own answer to the rounds (doorblast.ts DOORSHOT: the engine hands each round that met a leaf to leafRound, and the leaf goes in pieces on its toll, a multiple of the count that opens
  //     plasterboard): held off for the magazine — with it off, the hand-off itself must leave every leaf and keep as it was.
  const s0 = leafState(game), k0 = keepState(game);
  const doorBlast = DOORBLAST.on; DOORBLAST.on = false;
  const res0 = game.destr.blast(at, { who: PLAYER_ID }); const s1 = leafState(game);
  DOORBLAST.on = doorBlast;
  const nx = Math.sin(d.def.closedDir), nz = -Math.cos(d.def.closedDir); const nav = game.col.nav; let from: Vec3 = [fc[0] + nx * 1.5, 0, fc[2] + nz * 1.5];
  if (nav.blocked[nav.idx(Math.floor(from[0] / nav.cell), Math.floor(from[2] / nav.cell))]) from = [fc[0] - nx * 1.5, 0, fc[2] - nz * 1.5];
  const doorShot = DOORSHOT.on; DOORSHOT.on = false;
  fire(W, from, [fc[0], 1.1, fc[2]], 12, 2);
  DOORSHOT.on = doorShot;
  F.verdict(s1 === s0 && keepState(game) === k0 && res0.doors === 0 && !game.destr.walls.changes.some((c: any) => c.kind === 'door'), 'a charge by a door and 12 rounds into its leaf change no leaf from here', `${d.def.name}: locked / lockBroken / angle / vel of all ${game.doors.list.length} leaves untouched by the blast, every keep whole after the magazine; blast → ${JSON.stringify(res0)}; no 'door' row filed by the engine`);
  // (2) the call list, in order, before the walls are judged
  const pick = pickWall(game); if (!pick) { console.log('- NOTE — no partition with floor both sides on this level: the call order is not checked here'); return F.done(); }
  const p: Vec3 = [pick.mid[0] + pick.n[0] * 0.3, 0.3, pick.mid[2] + pick.n[2] * 0.3];
  const calls: string[] = []; const standing = () => !!ask(game, pick.a, pick.b, pick.mid).ray;
  const un = game.destr.onBlast((b: any) => { calls.push(`sub r=${f2(b.radius)} p=${b.power} who=${b.who} wall=${standing() ? 'up' : 'open'}`); b.res.panes += 2; });   // (as the glass would: told first, adds its count)
  const hadDoorBlast = typeof game.doors.blast === 'function';
  if (!hadDoorBlast) game.doors.blast = (a: Vec3, tearM: number, who: number) => { calls.push(`doors tearM=${f2(tearM)} who=${who} wall=${standing() ? 'up' : 'open'}`); return [d]; };
  const seen: any[] = []; const unCh = game.destr.walls.onChange((c: any) => seen.push(c));
  const res = game.destr.blast(p, { who: PLAYER_ID, radius: 2.5, power: 1 });
  const want = hadDoorBlast ? 1 : 2;
  F.verdict(calls.length === want && calls[0].startsWith('sub r=2.50') && calls.every(c => c.endsWith('wall=up')) && !standing() && (hadDoorBlast || calls[1].startsWith('doors tearM=1.50')),
    'subscribers, then the doors, are told BEFORE the wall is judged', calls.join(' | ') + ` → then the wall: ${standing() ? 'STILL UP' : 'holed'}`);
  F.verdict((hadDoorBlast || res.doors === 1) && res.panes === 2 && res.walls >= 1, 'their counts come back on the one result', JSON.stringify(res));
  // (3) another system's row reaches the feed
  const n0 = seen.length; const row = game.destr.walls.note({ kind: 'door', cause: 'blast', id: 0, name: d.def.name, pos: [fc[0], 1, fc[2]], rect: [fc[0] - 0.6, fc[2] - 0.6, fc[0] + 0.6, fc[2] + 0.6], opened: [], walkable: true, sight: true, dead: true, who: PLAYER_ID });
  F.verdict(seen.length === n0 + 1 && seen[n0] === row && row.serial === game.destr.walls.serial && game.destr.walls.since(row.serial - 1)?.[0] === row, "a 'door' row filed through walls.note reaches the listeners and the ring", `serial ${row.serial}, t ${f2(row.t)}`);
  un(); unCh();
  // (4) unsubscribed, and with the switch off, nobody is called
  let bangsOff = 0; const bang0 = game.destr.bang; game.destr.bang = function (this: any, ...a: any[]) { bangsOff++; return bang0.apply(this, a); };
  calls.length = 0; DESTRUCTION.on = false; const resOff = game.destr.blast(p, { who: PLAYER_ID }); const quietOff = bangsOff; game.destr.blast(p, { who: PLAYER_ID, chaos: false }); DESTRUCTION.on = true; game.destr.bang = bang0;
  F.verdict(calls.length === 0 && resOff.walls === 0 && resOff.doors === 0 && resOff.panes === 0, 'with the one switch off the blast calls nobody and returns zeros', JSON.stringify(resOff));
  F.verdict(quietOff === 1 && bangsOff === 1, 'with the switch off it is the old bang(), once (a grenade that calls blast() is the grenade it was), and nothing at all with chaos: false', `bang calls: ${quietOff} for a plain blast, ${bangsOff - quietOff} more with chaos: false`);
  if (!hadDoorBlast) delete game.doors.blast;
  return F.done();
}

// ================================================================ caps
export async function wallbreakCaps(): Promise<boolean> {
  const F = family(`wallbreak-caps: the whole level wrecked stays inside its pools (${LEVEL})`);
  const { W, game, engine } = await stage(15, 1);
  // drawn things off the floor that touch nothing that exists (the level may author a few: only NEW ones are the engine's doing)
  const floaters = (): Set<number> => { const st = engine.world.statics, GONE = BoxFlag.NoPrimary | BoxFlag.NoShadow, e = 0.06, out = new Set<number>();
    const bb = st.map((b: any) => { const r = b.yaw ? Math.hypot(b.h[0], b.h[2]) : 0; return [b.c[0] - (r || b.h[0]), b.c[0] + (r || b.h[0]), b.c[1] - b.h[1], b.c[1] + b.h[1], b.c[2] - (r || b.h[2]), b.c[2] + (r || b.h[2])]; });
    const is = (i: number) => (st[i].flags & GONE) !== GONE;
    for (let i = 0; i < st.length; i++) { const b = st[i], a = bb[i]; if ((b.flags & BoxFlag.NoPrimary) || (b.flags & BoxFlag.Glass) || a[2] <= 0.06 || (a[1] - a[0]) * (a[5] - a[4]) > 6) continue;
      let held = false; for (let j = 0; j < st.length && !held; j++) { if (j === i || !is(j)) continue; const c = bb[j]; held = Math.min(a[1], c[1]) - Math.max(a[0], c[0]) > -e && Math.min(a[3], c[3]) - Math.max(a[2], c[2]) > -e && Math.min(a[5], c[5]) - Math.max(a[4], c[4]) > -e; }
      if (!held) out.add(i); }
    return out; };
  const float0 = floaters();
  let blasts = 0, peakDebris = 0;
  for (const w of game.destr.walls.all()) {
    const b = w.box; const alongX = b.h[0] >= b.h[2]; const L = alongX ? b.h[0] : b.h[2];
    for (let u = -L; u <= L; u += 1.2) { const at: Vec3 = alongX ? [b.c[0] + u, 0.4, b.c[2] + ((blasts & 1) ? 0.3 : -0.3)] : [b.c[0] + ((blasts & 1) ? 0.3 : -0.3), 0.4, b.c[2] + u]; game.destr.blast(at, { who: PLAYER_ID, radius: 2.6 }); blasts++; W.step(DT); peakDebris = Math.max(peakDebris, game.destr.debris.list.length); }
  }
  for (let f = 0; f < 120; f++) { W.step(DT); peakDebris = Math.max(peakDebris, game.destr.debris.list.length); }
  const inv = game.destr.walls.inventory(); const all = game.destr.walls.all(); const gone = all.filter((x: any) => x.open === x.cells).length;
  F.verdict(inv.pieces <= WALLS.maxPieces && engine.world.statics.length <= engine.world.maxBoxes - 768, 'appended statics inside the cap, the box table has head-room', `${blasts} blasts: ${inv.pieces} / ${WALLS.maxPieces} pieces, ${engine.world.statics.length} statics of a ${engine.world.maxBoxes} table; ${gone}/${all.length} breakables wholly gone, ${inv.touched} touched; refused ${WALL_STATS.refused}`);
  F.verdict(peakDebris <= game.destr.debris.cap(), 'debris inside its pool', `peak ${peakDebris} / ${game.destr.debris.cap()} chunks; ${WALL_STATS.chunks} thrown, ${WALL_STATS.chunksDemoted} demoted to chips`);
  F.verdict(game.destr.walls.changes.length <= WALLS.maxChanges && game.destr.walls.serial >= game.destr.walls.changes.length, 'the feed inside its ring', `${game.destr.walls.changes.length} / ${WALLS.maxChanges} rows kept of ${game.destr.walls.serial}; since(0) → ${game.destr.walls.since(0) === null ? 'null (re-read the level)' : 'rows'}`);
  const lerr = lists(game, engine); F.verdict(!lerr, 'lists consistent, pieces finite', lerr ?? 'ok');
  { const fl = [...floaters()].filter(i => !float0.has(i)); const st = engine.world.statics;
    F.verdict(fl.length === 0, 'the wreck leaves nothing drawn hanging in the air', fl.length ? `${fl.length} new: ${fl.slice(0, 6).map(i => `#${i} at (${f2(st[i].c[0])}, ${f2(st[i].c[1])}, ${f2(st[i].c[2])}) ${f2(st[i].h[0] * 2)}×${f2(st[i].h[1] * 2)}×${f2(st[i].h[2] * 2)}`).join(' · ')}` : `${float0.size} authored that way before, no new one after; ${WALL_STATS.falls} things fell, ${WALL_STATS.floating} too big to throw and left`); }
  { const d = digestGame(game, true); F.verdict(!!d, 'the game still digests and steps', `${game.guards.length} men, t ${f2(game.time)}`); }
  // the piece cap forced tiny
  { const S = await stage(16, 0.5); WALLS.maxPieces = 3; const g2 = S.game; const furn0 = FURNBLAST.on; FURNBLAST.on = false;   /* the WALL engine's cap alone: a refused wall changes nothing — the furniture on the charge's own side going is furnblast's business, probed there */ const pick = pickWall(g2)!; resetStats();
    const r1 = g2.destr.blast([pick.mid[0] + pick.n[0] * 0.3, 0.3, pick.mid[2] + pick.n[2] * 0.3], {});
    const p1 = g2.destr.walls.inventory().pieces; const pick2 = pickWall(g2, 1);
    let r2: any = null, state0 = '', state1 = '';
    if (pick2) { state0 = JSON.stringify(g2.destr.walls.all().map((x: any) => x.open)) + navHash(g2); r2 = g2.destr.blast([pick2.mid[0] + pick2.n[0] * 0.3, 0.3, pick2.mid[2] + pick2.n[2] * 0.3], { chaos: false }); state1 = JSON.stringify(g2.destr.walls.all().map((x: any) => x.open)) + navHash(g2); }
    const le = lists(g2, S.engine); FURNBLAST.on = furn0;
    F.verdict(g2.destr.walls.inventory().pieces <= 3 && !le && (!pick2 || (WALL_STATS.refused > 0 && (r2.walls === 0 ? state0 === state1 : true))), 'over the cap a change is refused whole', `cap 3: first blast walls ${r1.walls} → ${p1} pieces; second wall: walls ${r2?.walls}, refused ${WALL_STATS.refused}, cells + nav ${state0 === state1 ? 'unchanged' : 'changed (a wall that fit)'}; ${le ?? 'lists consistent'}`);
    restoreKnobs(); }
  return F.done();
}

/** the wreck the reset / determinism / checkpoint probes share: two blasts, a ported column, a blasted crate, a small charge by a door frame */
function wreck(W: any, game: any): { pick: any } {
  const pick = pickWall(game)!; const { a, mid, n } = pick;
  game.destr.blast([mid[0] + n[0] * 0.3, 0.3, mid[2] + n[2] * 0.3], { who: PLAYER_ID });
  for (let f = 0; f < 30; f++) W.step(DT);
  const p2 = pickWall(game, 1); if (p2) fire(W, p2.a, [p2.mid[0], 1.3, p2.mid[2]], 8);
  const cov = game.destr.walls.all().find((c: any) => c.kind === 'cover' && c.box.h[1] * 2 > 0.7); if (cov) game.destr.blast([cov.box.c[0] + cov.box.h[0] + 0.3, 0.3, cov.box.c[2]], { who: PLAYER_ID, radius: 1.5 });
  const d = game.doors.list[0]; if (d) game.destr.blast([d.frameCentre[0] + 0.4, 0.3, d.frameCentre[2] + 0.4], { radius: 1.2 });
  game.teleportPlayer([a[0], 0, a[2]]);
  for (let f = 0; f < 120; f++) W.step(DT);
  return { pick };
}

// ================================================================ reset
export async function wallbreakReset(): Promise<boolean> {
  const F = family(`wallbreak-reset: a restart puts the level back bit for bit (${LEVEL})`);
  const { W, game, engine } = await stage(17, 0.5);
  const flags0 = flagsOf(game), nav0 = navHash(game), n0 = game.col.boxes.length;
  const p0 = pickWall(game)!; const q0 = ask(game, p0.a, p0.b, p0.mid);
  const { pick } = wreck(W, game);
  const wrecked = { pieces: game.destr.walls.inventory().pieces, nav: navHash(game), touched: game.destr.walls.inventory().touched };
  F.verdict(wrecked.pieces > 0 && wrecked.nav !== nav0, 'the wreck changed the level', `${wrecked.touched} breakables touched, ${wrecked.pieces} pieces, nav ${nav0} → ${wrecked.nav}`);
  const s0 = game.destr.walls.serial;
  game.restartEncounter(); for (let f = 0; f < 30; f++) W.step(DT);
  const flags1 = flagsOf(game); let diff = 0; for (let i = 0; i < flags0.length; i++) if (flags0[i] !== flags1[i]) diff++;
  F.verdict(game.col.boxes.length === n0 && engine.world.statics.length === n0 && diff === 0, 'the static list is the authored one, every flag word as it was', `${game.col.boxes.length} statics (authored ${n0}), ${diff} flag words differ`);
  F.verdict(navHash(game) === nav0, 'the nav grid is back bit for bit', `nav ${navHash(game)}`);
  const q1 = ask(game, pick.a, pick.b, pick.mid);
  F.verdict(JSON.stringify(q1) === JSON.stringify(q0), 'the wall is a wall again to all five', words(q1));
  const rows = game.destr.walls.since(s0) ?? [];
  F.verdict(rows.length === 1 && rows[0].kind === 'reset', "a 'reset' row is filed", `${rows.map((r: any) => r.kind + '/' + r.cause).join(', ')}`);
  F.verdict(game.destr.walls.snapshot() === undefined, 'nothing left for a checkpoint to carry', `snapshot() → ${JSON.stringify(game.destr.walls.snapshot())}`);
  for (let f = 0; f < 60; f++) W.step(DT);
  F.verdict(game.reachPending === 0, 'reach masks re-derived', `queue ${game.reachPending}`);
  return F.done();
}

// ================================================================ determinism
export async function wallbreakDeterminism(): Promise<boolean> {
  const F = family(`wallbreak-determinism: the same wreck twice is the same wreck (${LEVEL})`);
  const run = async () => { const { W, game } = await stage(18, 1); wreck(W, game); return { log: WALL_LOG.join('|'), pieces: piecesOf(game).join('|'), nav: navHash(game), feed: JSON.stringify(game.destr.walls.changes), debris: game.destr.debris.list.map((c: any) => c.box.c.map((x: number) => x.toFixed(4)).join(',')).join('|'), digest: JSON.stringify(digestGame(game, true)) }; };
  const A = await run(), B = await run();
  for (const k of ['log', 'pieces', 'nav', 'feed', 'debris', 'digest'] as const) F.verdict(A[k] === B[k] && A[k].length > 0, `${k} identical`, `${A[k].length} chars${k === 'nav' ? ' (' + A.nav + ')' : ''}`);
  return F.done();
}

// ================================================================ checkpoint
export async function wallbreakCheckpoint(): Promise<boolean> {
  const F = family(`wallbreak-checkpoint: a save carries the broken level; a load does not load a lie (${LEVEL})`);
  const { W, game } = await stage(19, 0.5);
  const fp0 = levelFingerprint(game).fp;
  const { pick } = wreck(W, game);
  const state = () => ({ open: JSON.stringify(game.destr.walls.all().map((x: any) => [x.id, x.open])), pieces: piecesOf(game).join('|'), nav: navHash(game) });
  const s0 = state(); const save = W.snapshot('wrecked', true); const json = JSON.stringify(save);
  F.verdict(!!save.walls && save.walls.b.length > 0 && save.level.fp === fp0, 'the file carries the walls; the fingerprint is the authored level', `walls slice ${JSON.stringify(save.walls).length} B (${save.walls?.b.length} breakables) of a ${json.length} B file; fp ${save.level.fp} (${save.level.boxes} boxes)`);
  // load into the same game after more damage
  game.destr.blast([pick.mid[0] + 3, 0.3, pick.mid[2]], { radius: 3 }); for (let f = 0; f < 10; f++) W.step(DT);
  Math.random = seeded(55); W.restore(JSON.parse(json)); const s1 = state();   // (seeded before each load: a load builds fresh men, and their construction draws dice)
  F.verdict(s1.open === s0.open && s1.pieces === s0.pieces && s1.nav === s0.nav, 'loaded into the same game: the same cells, pieces and nav grid', `nav ${s1.nav}; ${piecesOf(game).length} pieces standing`);
  const q = ask(game, pick.a, pick.b, pick.mid);
  F.verdict(!q.ray && !q.sight && !q.feet && q.navMid === 0, 'the hole is a hole after the load', words(q));
  const last = game.destr.walls.changes.at(-1);
  F.verdict(last.kind === 'reset' && last.cause === 'load', "the AI gets one 're-read' row for the load", `${last.kind}/${last.cause} serial ${last.serial}`);
  // into a fresh game
  { const S = await stage(20, 0.5); const g2 = S.game; const why = canLoad(g2, JSON.parse(json)); Math.random = seeded(55); S.W.restore(JSON.parse(json));
    const t = { open: JSON.stringify(g2.destr.walls.all().map((x: any) => [x.id, x.open])), pieces: piecesOf(g2).join('|'), nav: navHash(g2) };
    F.verdict(why === null && t.open === s0.open && t.pieces === s0.pieces && t.nav === s0.nav, 'loaded into a fresh game: the same level', `canLoad ${why ?? 'ok'}; nav ${t.nav}`);
    // continue ≡ load: the next seconds digest the same from both
    // (Sam's yaw is left out: it follows each harness's own cursor and camera — an input, not state)
    const dig = (g: any) => { const d = digestGame(g, true) as any; if (d.player) delete d.player.yaw; return JSON.stringify(d); };
    Math.random = seeded(77); for (let f = 0; f < 120; f++) W.step(DT); const dA = dig(game);
    Math.random = seeded(77); for (let f = 0; f < 120; f++) S.W.step(DT); const dB = dig(g2);
    if (dA !== dB && VERBOSE) { const A = JSON.parse(dA), B = JSON.parse(dB); const walk = (x: any, y: any, path: string) => { if (JSON.stringify(x) === JSON.stringify(y)) return; if (x && y && typeof x === 'object' && typeof y === 'object') { for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) walk(x[k], y[k], `${path}.${k}`); } else console.log('    differs', path, JSON.stringify(x)?.slice(0, 80), '≠', JSON.stringify(y)?.slice(0, 80)); }; walk(A, B, '$'); }
    F.verdict(dA === dB, 'two seconds on, the two games digest identically', `${dA.length} chars (the whole game digest but the cursor-led yaw)`);
    const bad = JSON.parse(json); bad.walls.b[0][0] = 3; const whyBad = canLoad(g2, bad);
    F.verdict(typeof whyBad === 'string' && /walls/.test(whyBad), "a file naming a breakable this level has not is refused", `canLoad → ${whyBad}`);
    const old = JSON.parse(json); delete old.walls; S.W.restore(old); F.verdict(g2.col.boxes.length === g2.destr.walls.authored, 'a file from before the slice loads the level as authored', `${g2.col.boxes.length} statics`); }
  return F.done();
}

// ================================================================ off
export async function wallbreakOff(): Promise<boolean> {
  const F = family(`wallbreak-off: the switches (${LEVEL})`);
  // (`furn` false: the furniture rule held off for the run — what stands at the wall going is furnblast's business, probed there, and it moves the nav and the feed's serial with no wall touched)
  // (`blast` 'bang': the call the one build made where the goal's callers now call blast() — Destruction.bang, the lane's old shake of the clutter round it)
  const run = async (chaos: number, wallBreak: boolean, sw = true, blast: boolean | 'bang' = true, furn = true) => {
    const { W, game } = await stage(21, chaos, LEVEL, sw); game.tune.wallBreak = wallBreak; const n0 = game.col.boxes.length, nav0 = navHash(game), flags0 = JSON.stringify(flagsOf(game));
    const furn0 = FURNBLAST.on; if (!furn) FURNBLAST.on = false;
    const pick = pickWall(game)!; fire(W, pick.a, [pick.mid[0], 1.3, pick.mid[2]], 12);
    const at: Vec3 = [pick.mid[0] + pick.n[0] * 0.3, 0.3, pick.mid[2] + pick.n[2] * 0.3]; if (blast === 'bang') game.destr.bang(at, PLAYER_ID);
    const res = blast === true ? game.destr.blast(at, { who: PLAYER_ID }) : { walls: 0, cover: 0, doors: 0, panes: 0, opened: 0, serial: 0 };
    const cov = game.destr.walls.all().find((c: any) => c.kind === 'cover'); if (cov) fire(W, [cov.box.c[0] + 2, 0, cov.box.c[2]], [cov.box.c[0], cov.box.c[1], cov.box.c[2]], 12);
    for (let f = 0; f < 60; f++) W.step(DT); FURNBLAST.on = furn0;
    return { res, serial: game.destr.walls.serial, statics: game.col.boxes.length === n0, nav: navHash(game) === nav0, flags: JSON.stringify(flagsOf(game)) === flags0, flagsNow: JSON.stringify(flagsOf(game)), stats: JSON.stringify(WALL_STATS), snap: game.destr.walls.snapshot(), digest: JSON.stringify(digestGame(game, true)), destr: JSON.stringify(game.destr.stats ?? null) + game.destr.debris.list.length };
  };
  // (the switch off, blast() is the one build's bang() and no more: the clutter in its reach goes as it always did — on the rebuilt block the mess table's things stand
  //  by the wall this picks — so the run is held against one that called bang() there, not against the level as authored)
  const sw = await run(0.5, true, false), never = await run(0.5, true, false, 'bang');
  F.verdict(sw.serial === 0 && sw.statics && sw.nav && sw.flagsNow === never.flagsNow && sw.snap === undefined && Object.values(JSON.parse(sw.stats)).every(v => v === 0) && JSON.stringify(sw.res) === '{"walls":0,"cover":0,"doors":0,"panes":0,"opened":0,"serial":0}',
    'the one switch off at chaos 0.5: nothing here ever runs', `12 rounds into a column, a charge against it, 12 rounds into a crate: blast → ${JSON.stringify(sw.res)}, counters all zero, statics / nav as authored, every static's flags as the one build's bang there leaves them (as authored ${sw.flags}), no walls slice in a save`);
  F.verdict(sw.digest === never.digest && sw.destr === never.destr, 'and the run digests exactly as one that called the one build\'s bang there, not blast', `game digest ${sw.digest.length} chars equal; the lane's own counters and debris equal`);
  const zero = await run(0, true);
  F.verdict(zero.serial === 0 && zero.statics && zero.nav && zero.flags && zero.snap === undefined && Object.values(JSON.parse(zero.stats)).every(v => v === 0) && zero.res.walls === 0, 'chaos 0 with the switch on: nothing here ever runs', `blast → ${JSON.stringify(zero.res)}, counters all zero, statics / flags / nav as authored`);
  const off = await run(0.5, false, true, true, false);   // (the WALL engine's switch alone, as wallbreak-caps asks its cap: on the shipped stand the rebuilt block has lived-in things at the wall this picks)
  F.verdict(off.serial === 0 && off.statics && off.nav && off.snap === undefined && off.res.walls === 0, 'tune.wallBreak off at chaos 0.5: the level stands', `blast → ${JSON.stringify(off.res)}; statics and nav as authored (the lane's old marks / dust / clutter still run)`);
  const on = await run(0.5, true);
  F.verdict(on.serial > 0 && !on.statics && !on.nav, 'on at chaos 0.5: it breaks', `serial ${on.serial}, blast → ${JSON.stringify(on.res)}`);
  DESTRUCTION.on = false;
  return F.done();
}

// ================================================================ wallsFor: the read-only ask
export async function wallbreakWallsFor(): Promise<boolean> {
  const F = family(`wallbreak-wallsfor: "which walls would a blast here open" says what the blast then does, and changes nothing by asking (${LEVEL})`);
  const lines = (game: any, a: Vec3, b: Vec3) => { const A: Vec3 = [a[0], 1.3, a[2]], B: Vec3 = [b[0], 1.3, b[2]]; const d = v3.sub(B, A); const L = v3.len(d);
    return { ray: !!game.col.raycast(A, v3.scale(d, 1 / L), L), sight: game.col.segmentBlocked([a[0], 1.6, a[2]], [b[0], 1.6, b[2]]), shot: game.col.shotBlocked(A, B), sound: game.col.solidBlocked([a[0], 1.6, a[2]], [b[0], 1.6, b[2]]) }; };
  const say = (q: { ray: boolean; sight: boolean; shot: boolean; sound: boolean }) => `ray ${q.ray ? 'stops' : 'passes'} · sight ${q.sight ? 'blocked' : 'clear'} · shot ${q.shot ? 'blocked' : 'clear'} · sound ${q.sound ? 'blocked' : 'clear'}`;
  const opens = (game: any) => new Map<number, number>(game.destr.walls.all().map((w: any) => [w.id, w.open]));
  const world = (game: any) => JSON.stringify([flagsOf(game), game.col.boxes.length, game.col.dynamicBoxes.length, navHash(game), game.destr.walls.serial, JSON.stringify(WALL_STATS), [...opens(game)]]);
  const { W, game } = await stage(11, 0.5);
  const pick = pickWall(game); if (!pick) { F.verdict(false, 'a partition with floor both sides', 'none found'); return F.done(); }
  const { a, b, mid, n } = pick; const at: Vec3 = [mid[0] + n[0] * 0.3, 0.3, mid[2] + n[2] * 0.3];
  const destr = game.destr; const dyn0 = game.col.dynamicBoxes; const w0 = world(game); const dig0 = JSON.stringify(digestGame(game, true));
  const fc = destr.wallsFor(at); const mine = fc.find((w: any) => w.id === pick.id);
  F.verdict(!!mine && mine.cells > 0 && mine.hole && mine.kind === 'wall' && mine.standing.length === 1 && mine.standing[0] === pick.box && mine.left.length > 0, 'the wall the charge is against is listed, holed at the floor, with what it leaves standing',
    `${fc.length} listed: ${fc.map((w: any) => `#${w.id} ${w.kind} ${w.cells} cells${w.hole ? ' (hole)' : ''} → ${w.left.length} left`).join(', ')}`);
  const shut = lines(game, a, b); const seen = destr.withWallsOpen(fc, () => lines(game, a, b)); const shutAgain = lines(game, a, b);
  F.verdict(shut.ray && shut.sight && shut.shot && shut.sound && !seen.ray && !seen.sight && !seen.shot && !seen.sound && JSON.stringify(shut) === JSON.stringify(shutAgain), 'inside the view the line through it is open to all four, outside it is the wall again',
    `as it stands: ${say(shut)} | inside withWallsOpen: ${say(seen)}`);
  { let threw = false; try { destr.withWallsOpen(fc, () => { destr.withWallsOpen(fc, () => lines(game, a, b)); throw new Error('x'); }); } catch { threw = true; }
    F.verdict(threw && world(game) === w0 && game.col.dynamicBoxes === dyn0 && JSON.stringify(digestGame(game, true)) === dig0, 'asking, a nested view and a view whose question throws leave the game as it was',
      `box flags, statics, the dynamic list (the same array), nav, the engine's serial, its counters, every wall's open cells and the game digest (${dig0.length} chars): unchanged`); }
  // every wall near the burst, asked from far off along a line that crosses a part the forecast opens: the forecast's answer inside the view = the game's answer after the real blast
  const far = [-1, 1].map(s => [mid[0] + n[0] * 1.2 * s, 0, mid[2] + n[2] * 1.2 * s] as Vec3);
  const probesAt: [Vec3, Vec3][] = [[a, b]]; for (const du of [-0.5, 0.5]) { const t: Vec3 = pick.alongX ? [du, 0, 0] : [0, 0, du]; probesAt.push([v3.add(far[0], t), v3.add(far[1], t)]); }
  const fore = destr.withWallsOpen(fc, () => probesAt.map(([p, q]) => lines(game, p, q)));
  // (the forecast is of the WALL engine's own pass — wouldOpen is blast()'s plan — so the furniture rule is held out of the blast it is compared with: through the
  //  hole it razes a breakable shelf standing behind the wall by the wall engine's road, a row the plan does not hold and was never meant to. As -off and -caps do)
  const o0 = opens(game); const furn0 = FURNBLAST.on; FURNBLAST.on = false; const res = destr.blast(at, { who: PLAYER_ID }); FURNBLAST.on = furn0; const o1 = opens(game);
  const real = probesAt.map(([p, q]) => lines(game, p, q));
  const grew = [...o1].filter(([id, k]) => k > (o0.get(id) ?? 0)).map(([id, k]) => [id, k - (o0.get(id) ?? 0)] as [number, number]);
  const want = new Map<number, number>(fc.map((w: any) => [w.id, w.cells])); const miss = grew.filter(([id, k]) => want.get(id) !== k), extra = fc.filter((w: any) => !grew.some(([id]) => id === w.id));
  F.verdict(res.walls + res.cover > 0 && miss.length === 0 && extra.length === 0, 'the real blast opens the same walls, cell for cell', `blast → ${JSON.stringify(res)}; opened ${grew.map(([id, k]) => `#${id}: ${k}`).join(', ')}${miss.length ? ` | NOT as forecast: ${miss.map(([id, k]) => `#${id} ${k} (forecast ${want.get(id) ?? 'none'})`).join(', ')}` : ''}${extra.length ? ` | forecast but not opened: ${extra.map((w: any) => '#' + w.id).join(', ')}` : ''}`);
  F.verdict(JSON.stringify(fore) === JSON.stringify(real), 'and three lines across it read the same in the forecast as after the blast', probesAt.map((_, i) => `${i}: ${say(fore[i])}${JSON.stringify(fore[i]) === JSON.stringify(real[i]) ? '' : ` ≠ after: ${say(real[i])}`}`).join(' | '));
  // a second burst beside the hole: the wall is pieces now (standing = its pieces, not the authored box)
  for (let f = 0; f < 90; f++) W.step(DT);
  { const t: Vec3 = pick.alongX ? [1.1, 0, 0] : [0, 0, 1.1]; const at2 = v3.add(at, t); const p2: [Vec3, Vec3] = [v3.add(far[0], t), v3.add(far[1], t)];
    const fc2 = destr.wallsFor(at2); const m2 = fc2.find((w: any) => w.id === pick.id); const before2 = lines(game, p2[0], p2[1]);
    const fore2 = destr.withWallsOpen(fc2, () => lines(game, p2[0], p2[1])); const q0 = opens(game); destr.blast(at2, { who: PLAYER_ID }); const q1 = opens(game); const real2 = lines(game, p2[0], p2[1]);
    const g2 = (q1.get(pick.id) ?? 0) - (q0.get(pick.id) ?? 0);
    F.verdict(!!m2 && m2.standing.length > 1 && !m2.standing.includes(pick.box) && m2.cells === g2 && JSON.stringify(fore2) === JSON.stringify(real2), 'a second burst beside the hole: the same, on a wall that is already pieces',
      m2 ? `#${pick.id} stands as ${m2.standing.length} pieces; forecast ${m2.cells} more cells, the blast opened ${g2}; the line 1.1 m along: ${say(before2)} → forecast ${say(fore2)} | after ${say(real2)}` : 'the wall was not listed'); }
  // what a plain burst never opens, and the switches
  { const hard = game.destr.walls.all().filter((w: any) => w.kind === 'wall'); let listed = 0, asked = 0;
    for (const sw of game.col.boxes.slice(0, game.destr.walls.authored)) { if (asked >= 40) break; if (hard.some((w: any) => w.box === sw) || (sw.flags & (BoxFlag.NoShadow | BoxFlag.Glass)) || sw.h[1] < 1 || Math.min(sw.h[0], sw.h[2]) > 0.2 || Math.max(sw.h[0], sw.h[2]) < 1) continue;
      asked++; const id = game.col.boxes.indexOf(sw); for (const s of [-1, 1]) { const thin = sw.h[0] < sw.h[2] ? 0 : 2; const p: Vec3 = [sw.c[0], 0.3, sw.c[2]]; p[thin] += s * (sw.h[thin] + 0.3); if (destr.wallsFor(p).some((w: any) => w.id === id)) listed++; } }
    F.verdict(asked > 0 && listed === 0, 'a wall the engine does not break (the shell, steel) is never listed for a plain burst', `${asked} thin tall statics that are not breakable partitions, a burst 0.3 m off each face: ${listed} listed`); }
  { const N = 400; const pts: Vec3[] = []; for (let i = 0; i < N; i++) pts.push([mid[0] + ((i * 37) % 23 - 11) * 0.7, 0.3, mid[2] + ((i * 53) % 19 - 9) * 0.7]);
    const t0 = performance.now(); let k = 0; for (const p of pts) k += destr.wallsFor(p, { radius: 3, power: 1 }).length; const us = (performance.now() - t0) * 1000 / N;
    console.log('  (cost of an ask, not judged: a wall clock) ' + `${N} asks over a 15 m square of the floor: ${us.toFixed(0)} µs each, ${(k / N).toFixed(1)} walls a burst on average`); }
  { const z = await stage(11, 0); const pz = pickWall(z.game)!; const atz: Vec3 = [pz.mid[0] + pz.n[0] * 0.3, 0.3, pz.mid[2] + pz.n[2] * 0.3]; const c0 = z.game.destr.wallsFor(atz).length;
    const s = await stage(11, 0.5, LEVEL, false); const cs = s.game.destr.wallsFor(atz).length;
    const t = await stage(11, 0.5); t.game.tune.wallBreak = false; const ct = t.game.destr.wallsFor(atz).length; const viewed = t.game.destr.withWallsOpen([], () => 7);
    F.verdict(c0 === 0 && cs === 0 && ct === 0 && viewed === 7, 'chaos 0, the one switch off, wall breaking off: nothing is listed', `${c0} / ${cs} / ${ct} listed; an empty view just runs the question`); }
  DESTRUCTION.on = false;
  return F.done();
}

if (import.meta.main) {
  const which = process.argv[2] ?? 'all'; const T: Record<string, () => Promise<boolean>> = { blast: wallbreakBlast, fire: wallbreakFire, pressed: wallbreakPressed, cover: wallbreakCover, seams: wallbreakSeams, caps: wallbreakCaps, reset: wallbreakReset, determinism: wallbreakDeterminism, checkpoint: wallbreakCheckpoint, off: wallbreakOff, wallsfor: wallbreakWallsFor };
  let ok = true; for (const [k, fn] of Object.entries(T)) if (which === 'all' || which === k) ok = (await fn()) && ok;
  process.exit(ok ? 0 : 1);
}
