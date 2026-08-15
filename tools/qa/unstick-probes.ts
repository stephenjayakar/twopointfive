// The 'unstick' probe (run through probes.ts: `bun run tools/qa/probes.ts unstick`, also part of `grab` and `all`): a living, AI-driven man left standing where his
// capsule fits but the nav bake has no way out — the cell under him blocked and all four beside it (guards.ts strandedAt: A* cannot leave such a cell, so every
// plan came back empty and every state read that as 'arrived'). The review lane's heavy grab soak found the one way play produces it: a hold walked into the
// hand's breadth between a cubicle desk's end and the partition at (22.66, 21.88), ended there by a teleporting stimulus (as by Sam being shot), and the man never
// walked again. guards.ts un-stick: a plan that comes back empty from a stranded cell (or the frame a hold ends on one) deals him a side-step to the nearest free
// cell within 1.2 m that nothing solid stands between, walked on his own feet through the ordinary movement and push-out, and the goal is planned afresh from
// there; wedged even so he is stood on the free cell outright (a counted, logged snap — none should be needed here).
//   (a) a calm man planted on that spot with a fix 5 m off: on a free cell and pathing inside 2 s, metres nearer the fix at 5 s (before: 0.00 m in 5 s);
//   (b) a hold staged so the man stands on the spot when a teleport frees him: he comes off it and is hunting inside 3 s, walked not snapped, never in a wall;
//   (c) men on FREE cells never touch any of it: three patrols walked 10 s from a seeded boot deal no leg and no snap, and their position trace hashes the same
//       as on the tree before the un-stick (printed, for the lane report to compare);
//   (d) the whole floor: every stranded cell with a spot a man can genuinely stand on (a 0.29 m circle clear of every static) and a fix reachable from near
//       it — a hundred-odd: corners behind chairs, the planter, between a parked car and the fence — gets the man planted and 4 s: he must walk off (nearly)
//       every one, may be snapped off the last few (counted, named), and must be left standing on none.
import { standUp, ROOT } from './headless.ts';
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const { startGrab } = await import(`${ROOT}/src/game/player.ts`);
const { HOLD } = await import(`${ROOT}/src/game/character.ts`);
const guardsMod = await import(`${ROOT}/src/game/guards.ts`);
/** the un-stick's counters and its stranded test — absent on a tree from before it (the probe then measures the old behaviour: the 'before' numbers) */
const UNSTICK: { legs: number; snaps: number } = guardsMod.UNSTICK ?? { legs: 0, snaps: 0 };
const HAVE_FIX = !!guardsMod.UNSTICK;

type Vec3 = [number, number, number];
const DT = 1 / 60;
/** the soak's spot: the nook north of the desk end, west of the partition, in the cubicle farm — cell (45, 43) of the 0.5 m grid, blocked with all four neighbours */
const NOOK: Vec3 = [22.66, 0, 21.90];
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f2 = (x: number) => x.toFixed(2), f3 = (x: number) => x.toFixed(3);
const posS = (p: Vec3) => `(${f2(p[0])}, ${f2(p[2])})`;
function place(gd: any, p: Vec3, yaw: number) { gd.char.pos = v3.copy(p); gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.char.bodyYaw = gd.char.aimYaw = yaw; gd.char.aimPitch = 0; gd.path = []; gd.pathGoal = null; gd.lastPos = v3.copy(p); gd.char.update(0); gd.char.update(DT); }
/** out of it on the lot east of the building: the scripted hold, deaf, blind */
function park(gd: any, i: number) { gd.hold = true; gd.heardUpTo = 1e12; gd.dazzledUntil = 1e9; place(gd, [37.5, 0, 6 + i * 1.5], Math.PI / 2); }
/** how far a body's circle sits inside the statics right now (its own push-out re-run on a copy) */
function penetration(col: any, p: Vec3, r: number): number { const q = v3.copy(p); col.collideCircle(q, r, 0.2, 1.5, 3); return v3.distXZ(q, p); }
/** the stranded test as guards.ts has it (own cell blocked and the four beside it), worked here too so a tree without the export still reports it */
function stranded(game: any, p: Vec3): boolean {
  if (guardsMod.strandedAt) return guardsMod.strandedAt(game, p[0], p[2]);
  const nav = game.col.nav, cs = nav.cell; return nav.isBlocked(p[0], p[2]) && nav.isBlocked(p[0] + cs, p[2]) && nav.isBlocked(p[0] - cs, p[2]) && nav.isBlocked(p[0], p[2] + cs) && nav.isBlocked(p[0], p[2] - cs);
}
/** a free, reachable point about `r` metres from `from` (reachable from the free cell nearest it — from the spot itself nothing is, that is the point) */
function goalNear(game: any, from: Vec3, r: number): Vec3 {
  const nav = game.col.nav; const foot = nav.nearestFreePoint(from[0], from[2]);
  for (let deg = 180; deg < 540; deg += 15) {
    const a = deg * Math.PI / 180; const p: Vec3 = [from[0] + Math.sin(a) * r, 0, from[2] + Math.cos(a) * r];
    if (nav.isBlocked(p[0], p[2])) continue;
    const path = foot ? nav.findPath(foot, p) : null; if (!path?.length) continue;
    let L = 0, q = foot; for (const w of path) { L += v3.distXZ(q, w); q = w; } if (L > r * 1.8) continue;   // round the partition is fine, round the building is another probe
    return p;
  }
  return [from[0] - r, 0, from[2]];
}
async function boot(seed: number) {
  Math.random = seeded(seed);
  const W = await standUp(); const { game } = W;
  game.player.visibility = 0.02; game.godMode = true;
  for (let i = 0; i < 5; i++) W.step(DT);
  const byRoute = (name: string) => game.guards.find((x: any) => game.level.routes[x.routeI]?.name === name);
  return { W, game, byRoute };
}

export async function unstick() {
  console.log('\n=== unstick: a man left standing on a nav cell no plan can leave side-steps to the nearest free cell and carries on (guards.ts un-stick) ===');
  console.log(`    (tree ${HAVE_FIX ? 'WITH' : 'WITHOUT'} the un-stick: ${HAVE_FIX ? 'PASS / FAIL' : 'these are the BEFORE numbers — (a) and (b) are expected to fail'})`);
  let allPass = true;
  const legs0 = UNSTICK.legs, snaps0 = UNSTICK.snaps;

  // ---------------------------------------------------------------- (a) planted on the spot, calm-ish (suspicious, a fix 5 m off, no reaction beat left): off it and pathing inside 2 s
  {
    const { W, game, byRoute } = await boot(101);
    const A = byRoute('cubicles'); const others = game.guards.filter((x: any) => x !== A);
    others.forEach((o: any, i: number) => park(o, i));
    game.teleportPlayer([5, 0, 15]); game.playerInvisible = true;   // Sam out of it: this is about the man's feet, not his eyes
    place(A, NOOK, Math.PI / 2);
    const fits = penetration(game.col, A.char.pos, A.char.radius), isStranded = stranded(game, A.char.pos), cellBlocked = game.col.nav.isBlocked(NOOK[0], NOOK[2]);
    const goal = goalNear(game, NOOK, 5);
    A.state = 'suspicious'; A.awareness = 0.5; A.reactT = 0; A.searchT = 0; A.lastKnown = v3.copy(goal); A.wait = 0; A.hold = false; A.heardUpTo = 1e12;
    const p0 = v3.copy(A.char.pos); const d0 = v3.distXZ(p0, goal);
    let freeAt = -1, pathingAt = -1, maxStep = 0, maxPen = 0, prev = v3.copy(p0); const legsA = UNSTICK.legs, snapsA = UNSTICK.snaps;
    const trace: string[] = [];
    for (let i = 1; i <= 300; i++) {
      W.step(DT);
      const p = A.char.pos; maxStep = Math.max(maxStep, v3.distXZ(p, prev)); prev = v3.copy(p); maxPen = Math.max(maxPen, penetration(game.col, p, A.char.radius));
      if (freeAt < 0 && !game.col.nav.isBlocked(p[0], p[2])) freeAt = i;
      if (pathingAt < 0 && !game.col.nav.isBlocked(p[0], p[2]) && A.path.length - A.pathI >= 1 && A.speed > 0.3 && v3.distXZ(p, p0) > 0.3) pathingAt = i;
      if (i % 30 === 0) trace.push(`${(i * DT).toFixed(1)}s ${posS(p)} ${A.state} path ${A.pathI}/${A.path.length} spd ${f2(A.speed)} cell ${game.col.nav.isBlocked(p[0], p[2]) ? 'blocked' : 'free'}`);
    }
    const moved = v3.distXZ(A.char.pos, p0), gained = d0 - v3.distXZ(A.char.pos, goal);
    const fails: string[] = [];
    if (fits > 0.02 || !isStranded || !cellBlocked) fails.push(`staging: the spot must fit his capsule (${f3(fits)} m inside statics) AND be stranded (cell blocked ${cellBlocked}, stranded ${isStranded})`);
    if (freeAt < 0 || freeAt * DT > 2) fails.push(`on a free cell after ${freeAt < 0 ? 'never' : (freeAt * DT).toFixed(2) + ' s'} (want ≤ 2 s)`);
    if (pathingAt < 0 || pathingAt * DT > 2) fails.push(`walking a real path after ${pathingAt < 0 ? 'never' : (pathingAt * DT).toFixed(2) + ' s'} (want ≤ 2 s)`);
    if (gained < 1.5) fails.push(`only ${f2(gained)} m nearer the fix after 5 s (want ≥ 1.5)`);
    if (maxStep > 0.3) fails.push(`a one-frame move of ${f2(maxStep)} m — snapped, not walked`);
    if (maxPen > 0.03) fails.push(`inside static geometry by ${f3(maxPen)} m on the way`);
    if (UNSTICK.snaps !== snapsA) fails.push(`${UNSTICK.snaps - snapsA} snap(s) — the walk should have done it`);
    if (HAVE_FIX && UNSTICK.legs - legsA !== 1) fails.push(`${UNSTICK.legs - legsA} legs dealt (want exactly 1)`);
    const ok = fails.length === 0; allPass &&= ok;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — (a) planted at ${posS(NOOK)} (capsule ${f3(fits)} m in, cell blocked ${cellBlocked}, stranded ${isStranded}), fix ${posS(goal)} ${f2(d0)} m off: free cell at ${freeAt < 0 ? 'never' : (freeAt * DT).toFixed(2) + ' s'}, pathing at ${pathingAt < 0 ? 'never' : (pathingAt * DT).toFixed(2) + ' s'}; after 5 s moved ${f2(moved)} m, ${f2(gained)} m nearer; biggest frame ${f3(maxStep)} m; legs +${UNSTICK.legs - legsA} snaps +${UNSTICK.snaps - snapsA}\n    ${trace.join('\n    ')}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
    // the same man in plain PATROL on the spot (his route's next point the goal): the commonest state a hold hands back to once he calms
    {
      const { W: W2, game: g2, byRoute: br2 } = await boot(102);
      const P = br2('cubicles'); g2.guards.filter((x: any) => x !== P).forEach((o: any, i: number) => park(o, i));
      g2.teleportPlayer([5, 0, 15]); g2.playerInvisible = true;
      place(P, NOOK, Math.PI / 2); P.state = 'patrol'; P.awareness = 0; P.wait = 0; P.hold = false; P.heardUpTo = 1e12; P.wp = 4;   // (wp 4 = (26.4, 23) — up the aisle east of the nook)
      const q0 = v3.copy(P.char.pos); let free2 = -1, step2 = 0, pv = v3.copy(q0);
      for (let i = 1; i <= 300; i++) { W2.step(DT); const p = P.char.pos; step2 = Math.max(step2, v3.distXZ(p, pv)); pv = v3.copy(p); if (free2 < 0 && !g2.col.nav.isBlocked(p[0], p[2])) free2 = i; }
      const moved2 = v3.distXZ(P.char.pos, q0); const f: string[] = [];
      if (free2 < 0 || free2 * DT > 2) f.push(`patrol: on a free cell after ${free2 < 0 ? 'never' : (free2 * DT).toFixed(2) + ' s'}`); if (moved2 < 1.5) f.push(`patrol: moved ${f2(moved2)} m in 5 s`); if (step2 > 0.3) f.push(`patrol: a ${f2(step2)} m frame`);
      const ok2 = f.length === 0; allPass &&= ok2;
      console.log(`- ${ok2 ? 'PASS' : 'FAIL'} — (a′) the same spot in plain patrol (next waypoint ${posS(g2.level.routes[P.routeI].points[P.wp % g2.level.routes[P.routeI].points.length])}): free cell at ${free2 < 0 ? 'never' : (free2 * DT).toFixed(2) + ' s'}, moved ${f2(moved2)} m in 5 s, now ${posS(P.char.pos)} wp ${P.wp} path ${P.pathI}/${P.path.length}${f.length ? '\n    ✗ ' + f.join('\n    ✗ ') : ''}`);
    }
  }

  // ---------------------------------------------------------------- (b) the soak's own case: a hold ends (a teleport takes Sam's hands off him) with the man stood on the spot
  {
    const { W, game, byRoute } = await boot(103);
    const A = byRoute('cubicles'); game.guards.filter((x: any) => x !== A).forEach((o: any, i: number) => park(o, i));
    game.player.holstered = true;   // the arm variant (nothing here fires)
    // grab him out on the aisle north of the nook, facing east, then stand the PAIR so that he is on the spot: Sam HOLD.dist behind him on the pair's facing, the
    // cursor far out east at their height so updateHold holds that facing (it turns the pair toward the cursor), a few frames for placeHeld to seat him
    place(A, [22.3, 0, 22.8], Math.PI / 2); A.state = 'patrol'; A.awareness = 0; A.heardUpTo = 1e12; A.hold = false;
    game.teleportPlayer([22.3 - 0.8, 0, 22.8]); W.step(DT);
    startGrab(game, A);
    let held = false; for (let i = 0; i < 120 && !(held = game.player.holding?.phase === 'held'); i++) { W.cursorAt([40, 1.2, 22.8]); W.step(DT); }
    const pl = game.player; const sam: Vec3 = [NOOK[0] - HOLD.dist, 0, NOOK[2]];
    pl.char.pos = v3.copy(sam); pl.safe = v3.copy(sam); pl.char.bodyYaw = pl.char.aimYaw = Math.PI / 2; pl.char.vel = [0, 0, 0];   // (the harness's hand: what teleportPlayer does to Sam, without taking his hands off the man)
    for (let i = 0; i < 20; i++) { W.cursorAt([40, 1.2, NOOK[2]]); W.step(DT); }
    const hp = v3.copy(A.char.pos); const wasStranded = stranded(game, hp), fitB = penetration(game.col, hp, A.char.radius), stillHeld = !!A.held && game.player.holding?.g === A;
    const legsB = UNSTICK.legs, snapsB = UNSTICK.snaps;
    game.teleportPlayer([12, 0, 19.5]);   // the soak's teleporting stimulus: cancelActions → freeHeld('cancel') → handBack — he is his own man again, on the spot
    const freedNow = !A.held && !game.player.holding;
    let offAt = -1, huntingAt = -1, maxStep = 0, maxPen = 0, prev = v3.copy(A.char.pos); const trace: string[] = [];
    for (let i = 1; i <= 180; i++) {
      W.step(DT);
      const p = A.char.pos; maxStep = Math.max(maxStep, v3.distXZ(p, prev)); prev = v3.copy(p); maxPen = Math.max(maxPen, penetration(game.col, p, A.char.radius));
      if (offAt < 0 && !game.col.nav.isBlocked(p[0], p[2])) offAt = i;
      if (huntingAt < 0 && offAt > 0 && (A.state === 'alert' || A.state === 'search') && !stranded(game, p) && (A.path.length > 0 || A.state === 'search')) huntingAt = i;
      if (i % 20 === 0) trace.push(`${(i * DT).toFixed(2)}s ${posS(p)} ${A.state} aw ${f2(A.awareness)} reactT ${f2(A.reactT)} path ${A.pathI}/${A.path.length} spd ${f2(A.speed)} cell ${game.col.nav.isBlocked(p[0], p[2]) ? 'blocked' : 'free'}`);
    }
    // and he keeps going: another 7 s, he must not be back on a stranded cell going nowhere (the search deals him spots; every one used to be 'arrived' on the spot)
    let strandedFrames = 0; const p3 = v3.copy(A.char.pos);
    for (let i = 0; i < 420; i++) { W.step(DT); if (stranded(game, A.char.pos) && A.speed < 0.1) strandedFrames++; }
    const roamed = v3.distXZ(A.char.pos, p3);
    const fails: string[] = [];
    if (!held || !stillHeld) fails.push(`staging: the hold ${held ? 'came off while the pair was stood on the spot' : 'never took'}`);
    if (!wasStranded || fitB > 0.02) fails.push(`staging: held at ${posS(hp)} — stranded ${wasStranded}, ${f3(fitB)} m inside statics (want stranded and fitting)`);
    if (!freedNow) fails.push('the teleport did not free him');
    if (offAt < 0) fails.push('never came off the blocked cell in 3 s'); else if (offAt * DT > 3) fails.push(`off it only at ${(offAt * DT).toFixed(2)} s`);
    if (huntingAt < 0) fails.push(`not hunting (alert / search with a path, off the stranded cell) inside 3 s — ${A.state} path ${A.pathI}/${A.path.length}`);
    if (maxStep > 0.3) fails.push(`a one-frame move of ${f2(maxStep)} m — snapped, not walked`);
    if (maxPen > 0.03) fails.push(`inside static geometry by ${f3(maxPen)} m on the way`);
    if (UNSTICK.snaps !== snapsB) fails.push(`${UNSTICK.snaps - snapsB} snap(s)`);
    if (HAVE_FIX && UNSTICK.legs - legsB < 1) fails.push('no leg was dealt');
    if (strandedFrames > 90) fails.push(`stranded and still again for ${(strandedFrames * DT).toFixed(1)} s of the following 7 s`);
    const ok = fails.length === 0; allPass &&= ok;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — (b) held on the spot at ${posS(hp)} (stranded ${wasStranded}, ${f3(fitB)} m in), Sam teleported off him: freed ${freedNow}; off the blocked cell at ${offAt < 0 ? 'never' : (offAt * DT).toFixed(2) + ' s'}, hunting at ${huntingAt < 0 ? 'never' : (huntingAt * DT).toFixed(2) + ' s'}; biggest frame ${f3(maxStep)} m, max penetration ${f3(maxPen)} m; legs +${UNSTICK.legs - legsB} snaps +${UNSTICK.snaps - snapsB}; then roamed ${f2(roamed)} m more in 7 s (${(strandedFrames * DT).toFixed(1)} s stranded-and-still), now ${A.state} at ${posS(A.char.pos)}\n    ${trace.join('\n    ')}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
  }

  // ---------------------------------------------------------------- (c) free-standing men are untouched: 10 s of the three patrols from a seeded boot — no leg, no snap, and the trace hash to compare across trees
  {
    const { W, game } = await boot(104);
    game.teleportPlayer([2, 0, 2]); game.playerInvisible = true; for (const x of game.guards) x.heardUpTo = 1e12;   // nobody sees or hears anything: pure route walking (waits, doors, the corridor's turnabout)
    const legsC = UNSTICK.legs, snapsC = UNSTICK.snaps;
    let h = 2166136261 >>> 0; let blockedFrames = 0; const ends: string[] = [];
    const mix = (n: number) => { h ^= n & 0xffff; h = Math.imul(h, 16777619) >>> 0; h ^= (n >>> 16) & 0xffff; h = Math.imul(h, 16777619) >>> 0; };
    for (let i = 0; i < 600; i++) {
      W.step(DT);
      for (const x of game.guards) { const p = x.char.pos; mix(Math.round(p[0] * 1000)); mix(Math.round(p[2] * 1000)); if (game.col.nav.isBlocked(p[0], p[2])) blockedFrames++; }
    }
    for (const x of game.guards) ends.push(`${game.level.routes[x.routeI].name} ${posS(x.char.pos)} wp ${x.wp}`);
    const fails: string[] = [];
    if (UNSTICK.legs !== legsC || UNSTICK.snaps !== snapsC) fails.push(`the un-stick engaged on free-standing patrols: legs +${UNSTICK.legs - legsC}, snaps +${UNSTICK.snaps - snapsC}`);
    const ok = fails.length === 0; allPass &&= ok;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — (c) three patrols, 10 s, seeded: legs +${UNSTICK.legs - legsC} snaps +${UNSTICK.snaps - snapsC}; guard-frames spent on blocked cells ${blockedFrames} (passing through, never stranded); position-trace hash ${h.toString(16).padStart(8, '0')} (the same on the tree before the un-stick = identical feet); ends: ${ends.join(' · ')}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
  }

  // ---------------------------------------------------------------- (d) the whole floor: every stranded cell a man can genuinely stand in, planted with a reachable fix, 4 s each
  {
    const { W, game } = await boot(105);
    const nav = game.col.nav, col = game.col, cs = nav.cell;
    game.teleportPlayer([2, 0, 2]); game.playerInvisible = true;
    const standable = (px: number, pz: number) => { const q: Vec3 = [px, 0, pz]; return !col.collideCircle(q, 0.29, 0.2, 1.5, 1); };   // no static overlaps a 29 cm circle there at all (a centimetre's grace for a man flush against a face) — a spot pushes from two sides cancel on is not one
    const fixFor = (from: Vec3): Vec3 | null => {   // a free point 3‥6 m off reachable (by a path not absurdly longer) from the free cell nearest the spot
      const foot = nav.nearestFreePoint(from[0], from[2]); if (!foot) return null;
      for (let deg = 0; deg < 360; deg += 20) for (const r of [5, 4, 6, 3]) {
        const a = deg * Math.PI / 180; const p: Vec3 = [from[0] + Math.sin(a) * r, 0, from[2] + Math.cos(a) * r];
        if (nav.isBlocked(p[0], p[2])) continue; const path = nav.findPath(foot, p); if (!path?.length) continue;
        let L = 0, q: Vec3 = foot; for (const w of path) { L += v3.distXZ(q, w); q = w; } if (L > r * 2.5) continue;
        return p;
      }
      return null;
    };
    const spots: { p: Vec3; fix: Vec3 }[] = [];
    for (let z = 0; z < nav.H; z++) for (let x = 0; x < nav.W; x++) {
      if (!nav.blocked[nav.idx(x, z)] || !stranded(game, [(x + 0.5) * cs, 0, (z + 0.5) * cs])) continue;
      let found: Vec3 | null = null;
      for (let i = 0; i < 5 && !found; i++) for (let j = 0; j < 5 && !found; j++) { const px = x * cs + 0.05 + i * 0.1, pz = z * cs + 0.05 + j * 0.1; if (standable(px, pz) && stranded(game, [px, 0, pz])) found = [px, 0, pz]; }
      if (!found) continue; const fix = fixFor(found); if (fix) spots.push({ p: found, fix });
    }
    const A = game.guards[1]; game.guards.filter((x: any) => x !== A).forEach((o: any, i: number) => park(o, i));
    let walked = 0, snapped = 0, stuck = 0, worstPen = 0; const offT: number[] = []; const notes: string[] = [];
    for (const { p: s, fix } of spots) {
      place(A, s, 0); A.state = 'suspicious'; A.awareness = 0.5; A.reactT = 0; A.searchT = 0; A.wait = 0; A.hold = false; A.heardUpTo = 1e12; A.stallRef = null; A.stuckT = 0; A.lastKnown = v3.copy(fix);
      const snapsS = UNSTICK.snaps; let offAt = -1, snapD = 0, prev = v3.copy(s), maxPen = 0;
      for (let i = 1; i <= 240; i++) {
        W.step(DT); const p = A.char.pos; const st = v3.distXZ(p, prev); prev = v3.copy(p); if (UNSTICK.snaps !== snapsS && !snapD) snapD = st;
        maxPen = Math.max(maxPen, penetration(col, p, 0.29)); if (offAt < 0 && !nav.isBlocked(p[0], p[2])) offAt = i;
        A.awareness = Math.max(A.awareness, 0.4); if (A.state === 'patrol') A.state = 'suspicious';   // (keep him wanting the fix for the four seconds)
      }
      worstPen = Math.max(worstPen, maxPen);
      const moved = v3.distXZ(A.char.pos, s);
      if (UNSTICK.snaps !== snapsS) { snapped++; notes.push(`snapped ${f2(snapD)} m off ${posS(s)}`); }
      else if (offAt < 0 || moved < 0.5 || (nav.isBlocked(A.char.pos[0], A.char.pos[2]) && A.speed < 0.1)) { stuck++; notes.push(`STUCK at ${posS(s)}: moved ${f2(moved)}, ${A.state} path ${A.pathI}/${A.path.length}, cell ${nav.isBlocked(A.char.pos[0], A.char.pos[2]) ? 'blocked' : 'free'}`); }
      else { walked++; offT.push(offAt * DT); }
      if (maxPen > 0.06) notes.push(`${f3(maxPen)} m inside statics on the way off ${posS(s)}`);
    }
    offT.sort((a, b) => a - b);
    const fails: string[] = [];
    if (spots.length < 40) fails.push(`only ${spots.length} stranded-and-standable spots found — the sweep is not looking at the floor it thinks it is`);
    if (stuck > 0) fails.push(`${stuck} spot(s) he never got off`);
    if (walked < 0.9 * spots.length) fails.push(`walked off only ${walked}/${spots.length} — the rest were snaps (${snapped}): the leg test is refusing walks that work`);
    if (worstPen > 0.12) fails.push(`pushed ${f3(worstPen)} m into static geometry on some leg`);
    const ok = fails.length === 0; allPass &&= ok;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — (d) the floor: ${spots.length} stranded cells with a standable spot and a reachable fix; walked off ${walked} (off the blocked cell in ${offT.length ? `${f2(offT[0])}‥${f2(offT[offT.length - 1])} s, median ${f2(offT[offT.length >> 1])}` : '-'} s), snapped ${snapped}, left standing ${stuck}; worst brush with the statics ${f3(worstPen)} m${notes.length ? '\n    · ' + notes.join('\n    · ') : ''}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
  }

  console.log(`    (un-stick totals this probe: legs +${UNSTICK.legs - legs0}, snaps +${UNSTICK.snaps - snaps0})`);
  console.log(`=== unstick: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}
