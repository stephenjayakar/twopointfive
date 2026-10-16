// The 'coverfire' probes (src/game/coverfire.ts — a shooter who KNOWS a man is behind breakable cover or a thin partition puts aimed rounds into it until it gives).
//   bun run tools/qa/coverfire-probes.ts [cover|wall|seen|holds|stale|friend|all] [--verbose] [--level block-squads] [--seed N]
// Self-running (exit 0 = every check passed, 1 = a FAIL line, 2 = an unknown name); registering it in tools/qa/probes.ts is one line at merge.
// Headless = the Proxy device: nothing is drawn; the harness runs AIM.player.level 0. What is asserted, for BOTH SIDES and both of a teammate's fire paths
// (def = a defender on the fight AI · op = a teammate on the fight AI · order = a teammate under an order, the room fight's trigger):
//   (cover)   a man SEEN standing behind a carton stack, who then ducks behind it: the shooter's rounds go into the stack on one spot, a cell of it gives (the
//             engine's feed says so, cause fire), at least the engine's own count of rounds landed first, and until it gave no round ended beyond the stack;
//   (wall)    a man the shooter knows is a stride behind a thin partition (the sighting handed over by coverfireSaw — the record a real one leaves): the same
//             column takes the rounds until a port opens; the man behind is untouched until it does;
//   (seen)    the eyes-on hook asked directly: yes through the partition, no once the same man is behind something unindexed · a mate's call is good for a
//             crate, never for a wall · a clock gone back (a checkpoint load) forgets what every man knew;
//   (holds)   the same shooter, the same knowledge, and what stands in the line is NOT breakable (anything the engine has not indexed): no round · a partition
//             with a man really behind it whom the shooter has never seen: no round · the switch off: no round, no state;
//   (stale)   a sighting older than staleSecs starts nothing · a chew on a wall that will not give stops when the knowledge has aged out;
//   (friend)  one of the shooter's own side standing beyond the wall in the lane: no round.
import { standUp, ROOT } from './headless.ts';
import { readFileSync } from 'node:fs';
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { spawnUnit } = await import(`${ROOT}/src/game/guards.ts`);
const { order } = await import(`${ROOT}/src/game/squad.ts`);
const { DESTRUCTION } = await import(`${ROOT}/src/game/destructionSwitch.ts`);
const { WALLS, WALLS_DEFAULTS, WALL_STATS } = await import(`${ROOT}/src/game/wallbreak.ts`);
const { COVERFIRE, COVERFIRE_DEFAULTS, COVERFIRE_STATS, COVERFIRE_LOG, COVERFIRE_WHY, coverfireSaw, coverfireOn, coverfireReport, coverSeen } = await import(`${ROOT}/src/game/coverfire.ts`);
const { HOLDFIRE } = await import(`${ROOT}/src/game/holdfire.ts`);
const { FRAG } = await import(`${ROOT}/src/game/frag.ts`);
type Vec3 = [number, number, number];
const DT = 1 / 60;
const args = process.argv.slice(2);
const VERBOSE = args.includes('--verbose');
const argOf = (k: string, d: string) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const LEVEL = argOf('--level', 'block-squads'), SEED = +argOf('--seed', '11');
// (cover) wants a stack a kneeling man is HIDDEN by: the squad maps' tallest breakable cover is a metre (his head shows over it and he is simply shot at), the
// warehouse has 1.3 m crates and carton stacks
const COVER_LEVEL = argOf('--cover-level', 'warehouse');
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const realRandom = Math.random, holdFire0 = HOLDFIRE.on, defFrags0 = FRAG.defenders;

let fails = 0, checks = 0;
function check(ok: boolean, what: string) { checks++; if (!ok) fails++; console.log(`  - ${ok ? 'PASS' : 'FAIL'} — ${what}`); return ok; }
const flat = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);

type Kind = 'def' | 'op' | 'order';
const KINDS: Kind[] = ['def', 'op', 'order'];
const sideOf = (k: Kind) => k === 'def' ? 'hostile' : 'operative';
const wordOf = (k: Kind) => k === 'def' ? 'a defender (fight AI)' : k === 'op' ? 'a teammate (fight AI)' : 'a teammate under an order (room fight)';

interface Shot { t: number; from: Vec3; to: Vec3 }
async function stage(seed: number, knobs: Record<string, unknown> = {}, level = LEVEL) {
  Math.random = seeded(seed);
  Object.assign(COVERFIRE, JSON.parse(JSON.stringify(COVERFIRE_DEFAULTS)), knobs); Object.assign(WALLS, JSON.parse(JSON.stringify(WALLS_DEFAULTS)));
  for (const k of Object.keys(COVERFIRE_STATS)) (COVERFIRE_STATS as any)[k] = 0; COVERFIRE_LOG.length = 0; for (const k of Object.keys(COVERFIRE_WHY)) delete COVERFIRE_WHY[k];
  DESTRUCTION.on = true;
  const lv = loadLevel(parseLevelData(readFileSync(`${ROOT}/levels/${level}.json`, 'utf8')));
  const W: any = await standUp({ level: lv }); const g = W.game;
  // (two of the page's rules answer this file's staging before cover fire can, and each has a check of its own: an unfound squad holds its first round
  //  (holdfire.ts: the teammate under an order here would never fire at a man who has noticed nobody), and a defender who carries a frag throws it at a man down
  //  behind a stack (frag.ts: the man runs off it, rightly, and then nobody is behind the stack). Here the squad's fire is free and no defender carries one)
  HOLDFIRE.on = false; FRAG.defenders = false;
  for (const gd of g.guards) { gd.flashlight.enabled = false; g.engine.lights.remove(gd.flashlight); }
  g.guards = []; g.tune.civilians = false; g.tune.qrf = false; g.tune.devices = false; g.tune.chaos = 0.5; g.godMode = true;
  for (const grp of new Set<string>(g.targets.map((t: any) => t.group).filter(Boolean))) g.setGroup(grp, true);   // every fixture on: what a man sees here is geometry, not the dark
  const R = {
    W, g, shots: new Map<any, Shot[]>(), quiet: [] as any[], seenAt: 0,
    spawn(team: 'operative' | 'hostile', pos: Vec3, facing: Vec3, name: string) { return spawnUnit(g, { team, pos: [pos[0], 0, pos[2]], yaw: v3.yawTo([pos[0], 0, pos[2]], [facing[0], 0, facing[2]]), light: false, name }); },
    /** one frame: Sam dark and out of it, the men told to be quiet kept without a round, every round of everybody else's filed */
    step(n = 1) {
      for (let i = 0; i < n; i++) {
        g.player.visibility = 0.02;
        for (const q of R.quiet) { q.weapon.chamber = 0; q.weapon.mag = 0; q.fireCd = 9; }
        W.step(DT);
        for (const e of g.events) if (e.kind === 'guardShot' && e.time === g.time && e.to) { const gd = g.guards.find((x: any) => x.char.id === e.who); if (gd) { let L = R.shots.get(gd); if (!L) R.shots.set(gd, L = []); L.push({ t: g.time, from: [...e.from] as Vec3, to: [...e.to] as Vec3 }); } }
      }
    },
    until(pred: () => boolean, secs: number) { for (let i = 0; i < secs * 60 && !pred(); i++) R.step(); return pred(); },
    of(gd: any): Shot[] { return R.shots.get(gd) ?? []; },
  };
  // Sam out of everybody's fight: the free floor farthest from the level's middle, dark, god
  return R;
}
type Rig = Awaited<ReturnType<typeof stage>>;
const navFree = (g: any, p: Vec3) => { const nav = g.col.nav; const ix = Math.floor(p[0] / nav.cell), iz = Math.floor(p[2] / nav.cell); return ix >= 0 && iz >= 0 && ix < nav.W && iz < nav.H && !nav.blocked[nav.idx(ix, iz)]; };
/** Sam parked on free floor as far from `from` as the level goes (he is on nobody's line and in nobody's light) */
function parkSam(g: any, from: Vec3) {
  const nav = g.col.nav; let best: Vec3 | null = null, bd = -1;
  for (let iz = 1; iz < nav.H - 1; iz += 2) for (let ix = 1; ix < nav.W - 1; ix += 2) {
    if (nav.blocked[nav.idx(ix, iz)]) continue; const p: Vec3 = [(ix + 0.5) * nav.cell, 0, (iz + 0.5) * nav.cell]; const d = flat(p, from);
    if (d > bd) { bd = d; best = p; }
  }
  if (best) g.teleportPlayer(best);
}
/** the shooter of this kind made a man in a fight who has `T` for his enemy: the fight AI's man alert on a post, or a teammate under an order to hold and aim */
function arm(R: Rig, kind: Kind, S: any, T: any) {
  const g = R.g;
  if (kind === 'order') { order(S, { goal: null, upper: 'aim', aimAt: [T.char.pos[0], 1.25, T.char.pos[2]] }); return; }
  S.hold = false; S.pinned = true; S.state = 'alert'; S.awareness = 1; S.foe = T; S.reactT = 0.2; S.fireCd = 0.4; S.reloadT = -1; S.lastKnown = v3.copy(T.char.pos); S.aim?.clear?.();
  S.witness.alertedBy = 'radio'; S.witness.alertT = g.time;
}
/** does the shooter have the man in his eyes this frame (his own books: the fight AI's stamp, the room fight's meter) */
function sees(R: Rig, kind: Kind, S: any, T: any): boolean {
  const g = R.g;
  if (kind === 'order') { const m = g.fight.opOf(S)?.meters.get(T); return !!m && g.time - m.seenT < 0.05; }
  return S.foe === T && g.time - S.lastSeenT < 0.05;
}
/** a breakable carton stack a kneeling man is hidden by and a standing one is seen over, with free floor behind it and a clear lane in front */
function pickCover(g: any, skip = 0, tall = false): { id: number; index: number; surf: string; tp: Vec3; sp: Vec3; n: Vec3; far: number } | null {
  let seen = 0;
  for (const back of [6.5, 5, 3.5]) for (const w of g.destr.walls.all()) {
    if (w.kind !== 'cover') continue; const b = w.box; const top = b.c[1] + b.h[1]; if (tall ? top < 1.7 : top < 1.2 || top > 1.45) continue;
    for (const n of [[0, 0, 1], [0, 0, -1], [1, 0, 0], [-1, 0, 0]] as Vec3[]) for (const off of [0.45, 0.6]) {
      const hn = Math.abs(n[0]) * b.h[0] + Math.abs(n[2]) * b.h[2], hw = Math.abs(n[0]) * b.h[2] + Math.abs(n[2]) * b.h[0]; if (hw < 0.4) continue;
      const tp: Vec3 = [b.c[0] + n[0] * (hn + off), 0, b.c[2] + n[2] * (hn + off)], sp: Vec3 = [b.c[0] - n[0] * (hn + back), 0, b.c[2] - n[2] * (hn + back)];
      if (!navFree(g, tp) || !navFree(g, sp)) continue;
      const eye: Vec3 = [sp[0], 1.6, sp[2]], d = v3.normalize(v3.sub([tp[0], 1.62, tp[2]], eye)); const L = v3.dist(eye, [tp[0], 1.62, tp[2]]);
      if (!tall && g.col.raycast(eye, d, L)) continue;                                // a standing man's head is seen over it (tall: nothing of him is)
      const gun: Vec3 = [sp[0], 1.35, sp[2]], low: Vec3 = [tp[0], 0.55, tp[2]]; const dl = v3.normalize(v3.sub(low, gun));
      const h = g.col.raycast(gun, dl, v3.dist(gun, low)); if (!h || g.destr.walls.breakableAt(h.index)?.id !== w.id) continue;   // and the stack is the first thing in the low line
      if (g.props.raycast(gun, dl, v3.dist(gun, low))) continue;
      if (seen++ < skip) continue;
      return { id: w.id, index: h.index, surf: w.surf, tp, sp, n, far: hn + back + hn };
    }
  }
  return null;
}
/** a partition column with open floor on both sides, away from doors and the wall's ends (the wall probes' own search, with the shooter's lane kept clear) */
function pickWall(g: any, back = 5, skip = 0): { id: number; mid: Vec3; n: Vec3; tp: Vec3; sp: Vec3 } | null {
  let seen = 0;
  for (const w of g.destr.walls.all()) {
    if (w.kind !== 'wall') continue; const b = w.box; const alongX = b.h[0] >= b.h[2]; const L = alongX ? b.h[0] : b.h[2]; if (L < 1.6) continue;
    const nCol = Math.min(32, Math.max(1, Math.round(2 * L / WALLS.col))), wCol = 2 * L / nCol;
    for (let k = 0; k < nCol; k++) {
      const u = -L + (k + 0.5) * wCol; if (u < -L + 1.4 || u > L - 1.4) continue;
      const mid: Vec3 = alongX ? [b.c[0] + u, 0, b.c[2]] : [b.c[0], 0, b.c[2] + u];
      for (const s of [1, -1]) {
        const n: Vec3 = alongX ? [0, 0, s] : [s, 0, 0];
        const tp = v3.mad(mid, n, 1.2) as Vec3, sp = v3.mad(mid, n, -back) as Vec3;
        if (!navFree(g, tp) || !navFree(g, sp) || !navFree(g, v3.mad(mid, n, 0.7)) || !navFree(g, v3.mad(mid, n, -0.7))) continue;
        if (g.doors.list.some((d: any) => Math.hypot(d.frameCentre[0] - mid[0], d.frameCentre[2] - mid[2]) < 2.2)) continue;
        const gun: Vec3 = [sp[0], 1.35, sp[2]], at: Vec3 = [tp[0], 1.25, tp[2]]; const d = v3.normalize(v3.sub(at, gun)), D = v3.dist(gun, at);
        const h = g.col.raycast(gun, d, D); if (!h || g.destr.walls.breakableAt(h.index)?.id !== w.id) continue;       // the wall is the first thing in the line
        const h2 = g.col.raycast(v3.mad(gun, d, h.t + 0.3), d, D - h.t - 0.5); if (h2) continue;                       // and the only thing
        if (g.props.raycast(gun, d, D)) continue;
        if (seen++ < skip) continue;
        return { id: w.id, mid, n, tp, sp };
      }
    }
  }
  return null;
}
/** two free standing points with something the engine has NOT indexed between them, a stride behind it (concrete, an outer wall, a metal fitting: whatever this level has) */
function pickSolid(g: any): { tp: Vec3; sp: Vec3; index: number } | null {
  const nav = g.col.nav;
  for (let iz = 2; iz < nav.H - 2; iz++) for (let ix = 2; ix < nav.W - 2; ix++) {
    const tp: Vec3 = [(ix + 0.5) * nav.cell, 0, (iz + 0.5) * nav.cell]; if (!navFree(g, tp)) continue;
    for (const n of [[0, 0, 1], [0, 0, -1], [1, 0, 0], [-1, 0, 0]] as Vec3[]) {
      const sp = v3.mad(tp, n, 6.2) as Vec3; if (!navFree(g, sp)) continue;
      const gun: Vec3 = [sp[0], 1.35, sp[2]], at: Vec3 = [tp[0], 1.25, tp[2]]; const d = v3.normalize(v3.sub(at, gun)), D = v3.dist(gun, at);
      const h = g.col.raycast(gun, d, D); if (!h || h.index >= 1e6 || g.destr.walls.breakableAt(h.index)) continue;
      if (D - h.t > 2.2 || D - h.t < 0.9) continue;                                   // he is a stride behind it
      const low = g.col.raycast([sp[0], 0.6, sp[2]], d, D); if (!low || g.destr.walls.breakableAt(low.index)) continue;
      if (g.doors.list.some((dd: any) => Math.hypot(dd.frameCentre[0] - tp[0], dd.frameCentre[2] - tp[2]) < 3)) continue;
      return { tp, sp, index: h.index };
    }
  }
  return null;
}
const rowsOf = (g: any, from: number, id: number) => (g.destr.walls.since(from) ?? []).filter((r: any) => r.id === id);
const dump = (R: Rig) => { if (VERBOSE) { for (const l of COVERFIRE_LOG) console.log(`      ${l}`); console.log(`      why ${JSON.stringify(COVERFIRE_WHY)} · ${JSON.stringify(coverfireReport(R.g))}`); } };

// ================================================================ (cover)
async function cover() {
  console.log(`coverfire-cover (${COVER_LEVEL})`);
  for (const kind of KINDS) {
    // the first stack on which this shooter really sees the man standing and really loses him when he kneels (a defender: a teammate's eyes find a
    // kneeling man's head over a 1.3 m stack within the second, and then he is simply shot) — else a stack taller than a man, and the sighting handed over as in (wall)
    let X: any = null;
    for (let skip = 0; skip < 6 && !X && kind === 'def'; skip++) {
      const R = await stage(SEED, {}, COVER_LEVEL); const g = R.g; const P = pickCover(g, skip); if (!P) break;
      parkSam(g, P.tp);
      const T = R.spawn(kind === 'def' ? 'operative' : 'hostile', P.tp, P.sp, 'Target'), S = R.spawn(sideOf(kind), P.sp, P.tp, 'Shooter');
      T.god = true; R.quiet.push(T); order(T, { goal: null });
      R.step(20); arm(R, kind, S, T);
      if (!R.until(() => sees(R, kind, S, T), 4)) continue;
      const s0 = g.destr.walls.serial; order(T, { goal: null, crouch: true });
      R.until(() => T.char.anim.crouch > 0.9 && !sees(R, kind, S, T), 3);
      let lost = T.char.anim.crouch > 0.9; for (let i = 0; i < 20 && lost; i++) { R.step(); lost = !sees(R, kind, S, T); }   // (lost for a third of a second, not for a frame)
      if (!lost || rowsOf(g, s0, P.id).length) continue;
      X = { R, g, P, S, T, s0, how: 'sees a man standing behind a stack, and loses him when he kneels behind it', plant: 0 };
    }
    if (!X) {
      const R = await stage(SEED, {}, COVER_LEVEL); const g = R.g; const P = pickCover(g, 0, true);
      if (P) {
        parkSam(g, P.tp);
        const T = R.spawn(kind === 'def' ? 'operative' : 'hostile', P.tp, P.sp, 'Target'), S = R.spawn(sideOf(kind), P.sp, P.tp, 'Shooter');
        R.quiet.push(T); order(T, { goal: null }); R.step(20); arm(R, kind, S, T); R.step(30);
        if (!sees(R, kind, S, T) && !R.of(S).length) X = { R, g, P, S, T, s0: g.destr.walls.serial, how: 'knows a man is behind a stack taller than he is (the sighting handed over: his own eyes find a kneeling man over the lower ones)', plant: 4 };
      }
    }
    if (!check(!!X, `${kind}: ${wordOf(kind)} ${X?.how ?? `— no stack on ${COVER_LEVEL} fits the staging`}`)) continue;
    const { R, g, P, S, T, s0 } = X; const tough = (WALLS.tough as Record<string, number>)[P.surf] ?? 8;
    const t0 = g.time; T.god = false; const n0 = R.of(S).length;
    let aliveAtRow = false, rowT = -1;
    R.until(() => { if (g.time - t0 < X.plant) coverfireSaw(g, S, T); const rows = rowsOf(g, s0, P.id); if (rows.length && rowT < 0) { rowT = g.time; aliveAtRow = T.state !== 'dead'; } return rowT >= 0 || T.state === 'dead'; }, 14);
    const rows = rowsOf(g, s0, P.id), rep = coverfireReport(g); const fired = R.of(S).slice(n0).filter((s: any) => rowT < 0 || s.t <= rowT);
    dump(R);
    if (VERBOSE) console.log(`      T ${T.state} crouch ${T.char.anim.crouch.toFixed(2)} · S on ${JSON.stringify(coverfireOn(g, S))} · rounds at ${R.of(S).map((s: Shot) => (s.t - t0).toFixed(1)).join(' ')} · S script ${JSON.stringify(S.script ?? null).slice(0, 200)} mag ${S.weapon.mag} reloadUntil ${g.fight.opOf(S)?.reloadUntil}`);
    if (VERBOSE) for (const y of [1.25, 0.8, 0.55]) { const from = S.char.muzzle as Vec3, to: Vec3 = [T.char.pos[0], y, T.char.pos[2]]; const d = v3.normalize(v3.sub(to, from)); const h = g.col.raycast(from, d, v3.dist(from, to));
      const b = h && h.index < 1e6 ? g.col.boxes[h.index] : null; console.log(`      line to y ${y}: ${h ? `#${h.index} at ${h.t.toFixed(2)} of ${v3.dist(from, to).toFixed(2)} ${b ? `c ${b.c.map((x: number) => x.toFixed(2))} h ${b.h.map((x: number) => x.toFixed(2))}` : ''} breakable ${JSON.stringify(g.destr.walls.breakableAt(h.index)?.id ?? null)}` : 'clear'} · S ${S.state} foe ${S.foe === T} sawAgo ${(g.time - S.lastSeenT).toFixed(1)} muzzle ${from.map(x => x.toFixed(2))} T ${T.char.pos.map((x: number) => x.toFixed(2))} P ${JSON.stringify(P)}`); }
    check(rep.chews >= 1, `${kind}: he went on the stack once the man was down behind it (${rep.chews} chew, ${rep.shots} rounds, ${rep.landed} on it; ${(rowT - t0).toFixed(1)} s)`);
    check(rows.length > 0 && rows[0].kind === 'cover' && rows[0].cause === 'fire', `${kind}: a cell of the stack gave to fire (the engine's feed: ${rows.length ? `${rows[0].kind} by ${rows[0].cause}` : 'no row'})`);
    check(rep.landed >= tough, `${kind}: the engine's own count went in first (${rep.landed} rounds on it; a ${P.surf} cell wants ${tough})`);
    const past = fired.filter((s: any) => s.to[1] < (X.plant ? 1.8 : 1.15) && flat(s.from, s.to) > flat(s.from, P.tp) - 0.2);
    check(past.length === 0 && aliveAtRow, `${kind}: until it gave no low round ended beyond the stack and the man behind was untouched (${fired.length} rounds, ${past.length} past)`);
    check(rep.opened >= 1, `${kind}: the piece giving was counted as his (${rep.opened})`);
  }
}

// ================================================================ (wall)
async function wallRig(kind: Kind, knobs: Record<string, unknown> = {}, back = 5) {
  const R = await stage(SEED, knobs); const g = R.g; const P = pickWall(g, back); if (!P) return null;
  parkSam(g, P.tp);
  const T = R.spawn(kind === 'def' ? 'operative' : 'hostile', P.tp, P.sp, 'Target'), S = R.spawn(sideOf(kind), P.sp, P.tp, 'Shooter');
  R.quiet.push(T); order(T, { goal: null });
  R.step(20); arm(R, kind, S, T); R.step(30);
  return { R, g, P, S, T };
}
async function wall() {
  console.log(`coverfire-wall (${LEVEL})`);
  for (const kind of KINDS) {
    const X = await wallRig(kind); if (!X) { check(false, `${kind}: no partition on ${LEVEL} fits the staging`); continue; }
    const { R, g, P, S, T } = X;
    check(!sees(R, kind, S, T) && R.of(S).length === 0, `${kind}: before he knows anything: no eyes on the man, no round (${R.of(S).length})`);
    const s0 = g.destr.walls.serial, r0 = WALL_STATS.rounds; let rowT = -1, aliveAtRow = false, on: any = null;
    // he "saw him go in there": the sighting kept fresh for as long as a man would be sure of it (4 s), then it ages like any other
    const t0 = g.time;
    R.until(() => { if (g.time - t0 < 4 && rowT < 0) coverfireSaw(g, S, T); on = coverfireOn(g, S) ?? on; const rows = rowsOf(g, s0, P.id); if (rows.length && rowT < 0) { rowT = g.time; aliveAtRow = T.state !== 'dead'; } return rowT >= 0; }, 12);
    const rows = rowsOf(g, s0, P.id), rep = coverfireReport(g); const fired = R.of(S).filter(s => rowT < 0 || s.t <= rowT);
    dump(R);
    check(rep.chews >= 1 && on?.id === P.id && on?.kind === 'wall', `${kind}: ${wordOf(kind)} went on the partition the man is behind (${rep.chews} chew, wanted ${on?.want} rounds)`);
    check(rows.length > 0 && rows[0].kind === 'port' && rows[0].cause === 'fire', `${kind}: the column opened to a port by fire (${rows.length ? `${rows[0].kind} by ${rows[0].cause}` : 'no row'}; ${(rowT - t0).toFixed(1)} s)`);
    const need = Math.ceil(WALLS.tough.drywall / (g.tune.chaos * 2));
    check(rep.landed >= Math.min(need, 4) && fired.length <= COVERFIRE.maxRounds + COVERFIRE.slack, `${kind}: by the engine's count, held on one spot (${rep.landed} on it of ${fired.length} fired; a column wants ${need} rifle rounds at this chaos)`);
    const spread = fired.length ? Math.max(...fired.map(s => v3.dist(s.to, fired[0].to))) : 9;
    check(spread < 1.0, `${kind}: every round within a metre of the first (${spread.toFixed(2)} m)`);
    const past = fired.filter(s => flat(s.from, s.to) > flat(s.from, P.mid) + 0.35);
    check(past.length === 0 && aliveAtRow, `${kind}: until it opened no round ended beyond the wall and the man behind was untouched (${past.length} past)`);
    check(WALL_STATS.rounds - r0 >= rep.landed, `${kind}: the engine counted them (${WALL_STATS.rounds - r0} rounds on breakables)`);
  }
}

// ================================================================ (seen)
/** the hook's own answers, asked directly (the alert branch only asks it of a man free to move; the staged shooters stand on a post) */
async function seen() {
  console.log(`coverfire-seen (${LEVEL})`);
  // (a) eyes on, no line: the round may go when what blocks it is the partition, and not when the same man is next asked about behind something unindexed
  { const X = await wallRig('def'); if (!X) check(false, 'no partition fits');
    else { const { R, g, P, S, T } = X; const chest: Vec3 = [T.char.pos[0], 1.25, T.char.pos[2]];
      const a = coverSeen(g, S, T, chest), on = coverfireOn(g, S);
      check(a && on?.id === P.id, `eyes on, the line blocked by the partition: the round may go (${a}; on #${on?.id})`);
      // a point a stride behind the nearest thing in his reach the engine has NOT indexed
      const from = S.char.muzzle as Vec3; let solid: Vec3 | null = null;
      for (let k = 0; k < 32 && !solid; k++) { const a2 = k / 32 * Math.PI * 2, d: Vec3 = [Math.sin(a2), 0, Math.cos(a2)]; const h = g.col.raycast(from, d, 24);
        if (h && h.t > 2 && h.index < 1e6 && !g.destr.walls.breakableAt(h.index) && !g.props.raycast(from, d, h.t)) { solid = v3.mad(from, d, h.t + 1.2) as Vec3; } }
      if (!solid) check(false, 'nothing unindexed within his reach');
      else { for (const k of Object.keys(COVERFIRE_WHY)) delete COVERFIRE_WHY[k];
        const b = coverSeen(g, S, T, solid);
        check(!b && ((COVERFIRE_WHY.solid ?? 0) + (COVERFIRE_WHY.behind ?? 0)) > 0, `the same man next behind something unindexed, the chew on the partition still his: no round (${b}; ${JSON.stringify(COVERFIRE_WHY)})`); }
      const c = coverSeen(g, S, null, chest); check(!c, `nobody named: no (${c})`);
      // pressed to the partition (his muzzle against it or through it): not a round's to give
      const tow = v3.normalize([P.sp[0] - P.mid[0], 0, P.sp[2] - P.mid[2]]) as Vec3; S.char.pos = [P.mid[0] + tow[0] * 0.45, 0, P.mid[2] + tow[2] * 0.45]; R.quiet.push(S); R.step(3);
      for (const k of Object.keys(COVERFIRE_WHY)) delete COVERFIRE_WHY[k]; const d = coverSeen(g, S, T, chest);
      check(!d && (COVERFIRE_WHY.close ?? 0) > 0, `pressed to the partition, the same man behind it: no round (${d}; ${JSON.stringify(COVERFIRE_WHY)})`); } }
  // (b) a mate's call is good for a crate, never for a wall: the shooter has seen nothing himself, a mate beside him has eyes on the man behind the partition
  for (const kind of KINDS) {
    const X = await wallRig(kind); if (!X) continue; const { R, g, P, S, T } = X;
    const side: Vec3 = [-P.n[2], 0, P.n[0]]; let mp: Vec3 | null = null; for (const k of [1.2, -1.2, 2, -2]) { const q = v3.mad(P.sp, side, k) as Vec3; if (navFree(g, q)) { mp = q; break; } }
    if (!mp) { check(false, `${kind}: no floor beside the shooter for a mate`); continue; }
    const M = R.spawn(sideOf(kind), mp, P.tp, 'Mate'); R.quiet.push(M); order(M, { goal: null });
    const t0 = g.time; R.until(() => { if (g.time - t0 < 4) coverfireSaw(g, M, T); return false; }, 6);
    dump(R);
    check(R.of(S).length === 0 && (COVERFIRE_WHY.call ?? 0) > 0, `${kind}: a mate's call on a man behind a PARTITION: no round of his (${R.of(S).length}; refused as a call ${COVERFIRE_WHY.call ?? 0}×)`);
  }
  // (b2) …and a mate calling does not take a chew he holds on his OWN sighting away from him
  for (const kind of ['def', 'order'] as Kind[]) {
    const X = await wallRig(kind); if (!X) continue; const { R, g, P, S, T } = X;
    const side: Vec3 = [-P.n[2], 0, P.n[0]]; let mp: Vec3 | null = null; for (const k of [1.2, -1.2, 2, -2]) { const q = v3.mad(P.sp, side, k) as Vec3; if (navFree(g, q)) { mp = q; break; } }
    if (!mp) continue;
    const M = R.spawn(sideOf(kind), mp, P.tp, 'Mate'); R.quiet.push(M); order(M, { goal: null });
    const s0 = g.destr.walls.serial, t0 = g.time; R.until(() => { if (g.time - t0 < 4) { coverfireSaw(g, S, T, 0.4); coverfireSaw(g, M, T); } return rowsOf(g, s0, P.id).length > 0; }, 10);
    dump(R);
    check(R.of(S).length >= 4 && rowsOf(g, s0, P.id).length > 0, `${kind}: his own sighting AND a mate calling the same man: he still goes through the partition (${R.of(S).length} rounds, ${rowsOf(g, s0, P.id).length ? 'a port' : 'no port'})`);
  }
  // (c) the clock gone back (a checkpoint load): what every man knew is forgotten, nothing fires on it
  { const X = await wallRig('def'); if (X) { const { R, g, S, T } = X; R.step(120); coverfireSaw(g, S, T); R.step(2); const had = !!coverfireOn(g, S);
      g.time -= 1.5; S.fireCd = 0.2; R.step(1); const after = coverfireOn(g, S); const n0 = R.of(S).length; R.step(60 * 4);
      check(had && !after && R.of(S).length === n0, `the clock gone back: his chew and what he knew are forgotten (had ${had}, after ${!!after}, ${R.of(S).length - n0} rounds since)`); } }
  // (d) a restart's roster (game.ts resetGuards): nothing of the old men's is left to call
  { const X = await wallRig('def'); if (X) { const { R, g, S, T } = X; R.step(60); coverfireSaw(g, S, T); R.step(2); const had = !!coverfireOn(g, S);
      g.resetGuards(); R.shots.clear(); R.quiet.length = 0; R.step(60 * 3); const rep = coverfireReport(g); let shots = 0; for (const L of R.shots.values()) shots += L.length;
      check(had && rep.chews === 0 && rep.shots === 0, `a restart: what the old roster knew is gone with it (had ${had}; ${rep.chews} chews since, ${shots} rounds by anybody)`); } }
}

// ================================================================ (holds)
async function holds() {
  console.log(`coverfire-holds (${LEVEL})`);
  for (const kind of KINDS) {
    // (a) something the engine has not indexed in the line
    { const R = await stage(SEED); const g = R.g; const P = pickSolid(g);
      if (!P) check(false, `${kind}: no unbreakable thing on ${LEVEL} fits the staging`);
      else {
        parkSam(g, P.tp);
        const T = R.spawn(kind === 'def' ? 'operative' : 'hostile', P.tp, P.sp, 'Target'), S = R.spawn(sideOf(kind), P.sp, P.tp, 'Shooter');
        R.quiet.push(T); order(T, { goal: null }); R.step(20); arm(R, kind, S, T);
        const t0 = g.time; R.until(() => { if (g.time - t0 < 4) coverfireSaw(g, S, T); return false; }, 7);
        dump(R);
        check(R.of(S).length === 0 && coverfireReport(g).chews === 0 && (COVERFIRE_WHY.solid ?? 0) > 0, `${kind}: a man known behind something the engine has not indexed (static #${P.index}): no round (${R.of(S).length}; refused as solid ${COVERFIRE_WHY.solid ?? 0}×)`);
      } }
    // (b) a partition, a man really behind it, and the shooter has never seen him
    { const X = await wallRig(kind); if (!X) { check(false, `${kind}: no partition fits`); continue; }
      const { R, g, S } = X; R.step(60 * 6); dump(R);
      check(R.of(S).length === 0 && coverfireReport(g).chews === 0, `${kind}: a partition with a man behind it he has never seen: no round (${R.of(S).length})`); }
    // (c) the switch off: the same knowledge, nothing
    { const X = await wallRig(kind, { on: false }); if (!X) continue;
      const { R, g, S, T } = X; const t0 = g.time; let threw = false;
      R.until(() => { if (g.time - t0 < 4) { try { coverfireSaw(g, S, T); } catch { threw = true; } } return false; }, 6);
      const rep = coverfireReport(g);
      check(R.of(S).length === 0 && rep.on === 0 && rep.chews === 0 && rep.shots === 0 && !threw, `${kind}: COVERFIRE.on false: no round, nothing counted (${R.of(S).length})`); }
  }
  // (d) the destruction goal's own switch off: this one never runs under it
  { const X = await wallRig('def'); if (X) { const { R, g, S, T } = X; DESTRUCTION.on = false; const t0 = g.time; R.until(() => { if (g.time - t0 < 4) coverfireSaw(g, S, T); return false; }, 6);
    check(R.of(S).length === 0 && coverfireReport(g).on === 0, `DESTRUCTION.on false: this switch does not run by itself (${R.of(S).length} rounds)`); DESTRUCTION.on = true; } }
}

// ================================================================ (stale)
async function stale() {
  console.log(`coverfire-stale (${LEVEL})`);
  for (const kind of KINDS) {
    { const X = await wallRig(kind); if (!X) { check(false, `${kind}: no partition fits`); continue; }
      const { R, g, S, T } = X; coverfireSaw(g, S, T, COVERFIRE.staleSecs + 0.5); R.step(60 * 5); dump(R);
      check(R.of(S).length === 0, `${kind}: a sighting ${COVERFIRE.staleSecs + 0.5} s old starts nothing (${R.of(S).length} rounds)`); }
    { const X = await wallRig(kind); if (!X) continue;
      const { R, g, P, S, T } = X; WALLS.tough.drywall = 1e6; WALLS.tough.wood = 1e6; WALLS.tough.fabric = 1e6;   // a wall that will not give: only his knowledge can stop him
      COVERFIRE.maxRounds = 1e9; COVERFIRE.slack = 1e9;
      coverfireSaw(g, S, T); const t0 = g.time; R.step(Math.round(60 * (COVERFIRE.staleSecs + 6))); dump(R);
      const L = R.of(S); const last = L.length ? L[L.length - 1].t - t0 : -1;
      check(L.length > 0 && last <= COVERFIRE.staleSecs + 0.6, `${kind}: one sighting, a wall that never gives: he fires (${L.length}) and stops when it is ${COVERFIRE.staleSecs} s old (last round at ${last.toFixed(2)} s)`);
      check(rowsOf(g, 0, P.id).length === 0 && T.state !== 'dead', `${kind}: nothing opened and no round reached the man`); }
    { const X = await wallRig(kind, { slackK: 0.25, slack: 0 }); if (!X) continue;   // a budget of a quarter of what the wall wants: it stands when he has spent it
      const { R, g, P, S, T } = X; WALLS.tough.drywall = WALLS.tough.wood = WALLS.tough.fabric = 12;
      R.until(() => { coverfireSaw(g, S, T); return false; }, 15); dump(R);
      const L = R.of(S), rep = coverfireReport(g);
      check(rep.gaveUp >= 1 && rep.chews === 1 && L.length >= 3 && L.length <= 8 && rowsOf(g, 0, P.id).length === 0, `${kind}: knowledge kept fresh for 15 s, a wall that outlasts his budget: he leaves it and does not come back to it (${L.length} rounds, gave up ${rep.gaveUp}×, ${rep.chews} chew) — never a magazine after a magazine`); }
  }
}

// ================================================================ (friend)
async function friend() {
  console.log(`coverfire-friend (${LEVEL})`);
  for (const kind of KINDS) {
    const X = await wallRig(kind); if (!X) { check(false, `${kind}: no partition fits`); continue; }
    const { R, g, P, S, T } = X;
    // one of HIS side a stride beyond the man, on the line a round that got through would fly
    const fp = v3.mad(P.tp, P.n, 1.0) as Vec3; const F = R.spawn(sideOf(kind), navFree(g, fp) ? fp : P.tp, P.sp, 'Friend'); R.quiet.push(F); order(F, { goal: null }); F.god = true;
    const t0 = g.time; R.until(() => { if (g.time - t0 < 4) coverfireSaw(g, S, T); return false; }, 7); dump(R);
    const rep = coverfireReport(g);
    check(R.of(S).length === 0 && rep.heldFriend > 0, `${kind}: one of his own beyond the wall in the lane: no round (${R.of(S).length}; held for a friend ${rep.heldFriend}×)`);
  }
}

const FAMILIES: Record<string, () => Promise<void>> = { cover, wall, seen, holds, stale, friend };
const names = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && ['--level', '--seed', '--cover-level'].includes(args[i - 1])));
const want = !names.length || names.includes('all') ? Object.keys(FAMILIES) : names.map(n => n.replace(/^coverfire-/, ''));
const unknown = want.filter(n => !FAMILIES[n]);
if (unknown.length) { console.log(`unknown: ${unknown.join(', ')} — known: ${Object.keys(FAMILIES).join(', ')}, all`); process.exit(2); }
for (const n of want) { try { await FAMILIES[n](); } catch (e) { fails++; console.log(`  - FAIL — coverfire-${n} threw: ${(e as Error).stack ?? e}`); } }
Math.random = realRandom; DESTRUCTION.on = false; HOLDFIRE.on = holdFire0; FRAG.defenders = defFrags0;
Object.assign(COVERFIRE, JSON.parse(JSON.stringify(COVERFIRE_DEFAULTS))); Object.assign(WALLS, JSON.parse(JSON.stringify(WALLS_DEFAULTS)));
console.log(fails ? `=== coverfire-probes: ${fails} FAILED of ${checks} ===` : checks ? `=== coverfire-probes ${want.join(' ')}: ALL PASS (${checks} checks) ===` : '=== coverfire-probes: NO VERDICT ===');
process.exit(fails ? 1 : 0);
