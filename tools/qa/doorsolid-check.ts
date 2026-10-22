// A LEAF PULLED OPEN IS SOLID TO THE PLAYER (src/game/doors.ts DOORWAY.solid; the maintainer: 'it's very easy to clip through a door when walking towards it and
// it swings out towards you, player should have to open it and walk aroudn it').
//   bun run tools/qa/doorsolid-check.ts        (or: bun run tools/qa/probes.ts doorsolid)        exit 0 = every line PASS, 1 = a FAIL line
//   bun run tools/qa/doorsolid-check.ts --survey office,tut-quiet,…     every wooden door of those levels walked at from the face it opens toward: a table, no verdict
// Headless, on the office. Two walkers: KEYS (the player's own walk and run keys held straight at the shut leaf from the face it opens toward, the way the
// maintainer met it) and WRITTEN (his place written a stride a frame, for the stagings a walk cannot make: a wall at his back, a hand on it standing still). The
// leaf's own line is read after every step. The rule and one-way leaves are set by the check itself on either stand (the frozen stand holds both off).
//   off        the rule off: the pulled leaf comes round THROUGH him (the build as it was — what the maintainer walked through)
//   walk       the rule on, at three places along the leaf: his hand takes it short of his chest, he is kept back from its swing and never moved off the
//              doorway's line, it is never through him, and with the keys still held he is in through the doorway
//   crouch     crouched: no hand ahead of him (it opens on his chest), then the same
//   ease       the 'ease' row from that face: he is stood back as it comes, it goes all the way round
//   run        a run with no boot in it (the handle's rip, and the old haul with the run's rule off): the same; a boot at the run is as it was
//   hand       his hand on it standing still in its swing (Doors.use), and somebody else's hand on it (Doors.pull): he is stood back out of it, the leaf opens
//   corridor   a wall close behind him: he is stepped aside along it past the latch instead, and steering back at the doorway he is in
//   wall       no floor to stand back onto: the leaf meets him, stops on him a hair clear and rests there; walked at, it stops SOLID_TRIES times and then passes
//              him as it did — never a door he cannot open
//   others     a man of the AI standing in the swing of the player's pull is passed and not moved, as ever; the player under a show's strings is passed, as ever
//   checkpoint a leaf's count of stops goes through a save and a load
//   journal    a recording from before the key replays with the rule off; one that carries it keeps its own word
// DOORSOLID_BREAK=1: the rule is left off where the lines want it on — red.
type Vec3 = [number, number, number];
const BREAK = process.env.DOORSOLID_BREAK === '1';

export interface WalkIn { crossed: boolean; deepest: number; angle: number; /** m he ended on the side it opens toward (negative: through the doorway) */ out: number; moved: number; clear: boolean; end: Vec3; carried: number; stopped: number; passed: number; reached: number; held: number;
  /** (keys) seconds until he was half a metre through the doorway (-1: never), the furthest he was moved along the wall off his own line, the leaf at its widest, off its hinges */ through: number; aside: number; wide: number; off: boolean }

async function kit() {
  const { standUp, ROOT } = await import('./headless.ts');
  const { DOORWAY } = await import(`${ROOT}/src/game/doors.ts`);
  const { PLAYER_ID } = await import(`${ROOT}/src/game/consts.ts`);
  const DT = 1 / 60, R = 0.34;
  const quiet = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => {}; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
  const park = (g: any) => g.guards.forEach((o: any, i: number) => { o.hold = true; o.pinned = true; o.dazzledUntil = 1e9; o.heardUpTo = 1e12; o.char.pos = [o.char.pos[0], -50, o.char.pos[2]]; o.char.vel = [0, 0, 0]; o.path = []; o.pathGoal = null; void i; });
  /** the door's own frame: `along` m from the hinge along the shut leaf, `out` m to the side it opens into */
  const frame = (d: any) => { const th = d.def.closedDir, u = [Math.cos(th), Math.sin(th)], S = d.swing, n = [-u[1] * S, u[0] * S], h = d.def.hinge, W = d.def.width as number;
    return { W, S, n, pt: (along: number, out: number): Vec3 => [h[0] + u[0] * along + n[0] * out, 0, h[1] + u[1] * along + n[1] * out] }; };
  /** where he stands to the leaf as it stands now: is he inside its length, on which face, and how deep in it. THROUGH HIM = inside its length on one face, and on
   *  the next frame inside its length on the other (round its free end he is outside its length on the way); DEEPEST is read all along it, its free end too */
  const read = (d: any, p: Vec3) => { const [hx, hz] = d.def.hinge, u = d.dir(), px = p[0] - hx, pz = p[2] - hz, along = px * u[0] + pz * u[1], perp = u[0] * pz - u[1] * px, t = Math.max(0, Math.min(d.def.width, along));
    return { inside: along > 0.14 && along < d.def.width, face: perp >= 0 ? 1 : -1, along, pen: R + d.thick / 2 - Math.hypot(px - u[0] * t, pz - u[1] * t) }; };
  /** the player at the middle of the shut leaf on the face it opens toward, `out` m off it, then `secs` of `speed` m/s straight at it (0: he stands), `first` done once before */
  const walkIn = (W: any, d: any, o: { speed: number; secs: number; out?: number; first?: (p: Vec3) => void }): WalkIn => {
    const g = W.game, F = frame(d), p0 = F.pt(F.W * 0.5, o.out ?? R + d.thick / 2 + 0.12), S0 = { ...g.doors.solids };
    g.teleportPlayer([p0[0], 0, p0[2]]); W.step(DT); o.first?.(g.player.char.pos);
    let crossed = false, deepest = 0, last = read(d, g.player.char.pos);
    for (let i = 0; i < o.secs * 60; i++) { const pos = g.player.char.pos; pos[0] -= F.n[0] * o.speed * DT; pos[2] -= F.n[1] * o.speed * DT; W.step(DT);
      const r = read(d, g.player.char.pos); if (r.inside && last.inside && r.face !== last.face) crossed = true; if (r.along > 0.14) deepest = Math.max(deepest, r.pen); last = r;
      if (process.env.DOORSOLID_TRACE === '1') console.log(`    ${i} angle ${(d.angle * F.S).toFixed(2)} vel ${(d.vel * F.S).toFixed(1)} along ${r.along.toFixed(2)} face ${r.face * F.S} pen ${(r.pen * 100).toFixed(0)} pullT ${d.pullT.toFixed(2)} solidT ${d.solidT.toFixed(1)}`); }
    const e = g.player.char.pos, q: Vec3 = [e[0], 0, e[2]]; g.col.collideCircle(q, 0.3, 0.2, 1.5, 1);
    return { crossed, deepest, angle: d.angle * F.S, out: (e[0] - d.def.hinge[0]) * F.n[0] + (e[2] - d.def.hinge[1]) * F.n[1], moved: Math.hypot(e[0] - p0[0], e[2] - p0[2]), clear: Math.hypot(q[0] - e[0], q[2] - e[2]) < 0.02 && read(d, e).pen <= 0.03, end: [e[0], 0, e[2]],
      carried: g.doors.solids.carried - S0.carried, stopped: g.doors.solids.stopped - S0.stopped, passed: g.doors.solids.passed - S0.passed, reached: g.doors.solids.reached - S0.reached, held: g.doors.solids.held - S0.held, through: -1, aside: 0, wide: d.angle * F.S, off: !!d.off };
  };
  /** KEYS: the player `from` m off the shut leaf at `along` of its width, then the walk key (and the run key) held straight at it for `secs` */
  const keysIn = (W: any, d: any, o: { along?: number; from?: number; secs?: number; sprint?: boolean; crouch?: boolean; /** the walk key is steered at a spot a metre beyond the middle of the doorway, the way a player's own hand corrects his line */ steer?: boolean }): WalkIn => {
    const g = W.game, pl = g.player, c = pl.char, F = frame(d), a0 = F.W * (o.along ?? 0.5), p0 = F.pt(a0, o.from ?? 1.5), S0 = { ...g.doors.solids }, dirIn = [-F.n[0], -F.n[1]];
    pl.doorBashAt = -10; pl.doorRipUntil = -1; pl.doorBashLean = 0; g.teleportPlayer([p0[0], 0, p0[2]]); pl.crouch = !!o.crouch; for (let i = 0; i < 5; i++) W.step(DT);
    const yawFor = (dx: number, dz: number) => { let yaw = 0, best = -2; const n = Math.hypot(dx, dz) || 1; for (let i = 0; i < 360; i++) { W.cam.yaw = i * Math.PI / 180; W.cam.rebuild(); const f = W.cam.planarBasis().fwd, dot = (f[0] * dx + f[2] * dz) / n; if (dot > best) { best = dot; yaw = W.cam.yaw; } } return yaw; };
    let yaw = yawFor(dirIn[0], dirIn[1]); const goal = F.pt(F.W * 0.5, -1);
    const th = d.def.closedDir, ux = Math.cos(th), uz = Math.sin(th), h = d.def.hinge, outOf = () => (c.pos[0] - h[0]) * F.n[0] + (c.pos[2] - h[1]) * F.n[1], alongOf = () => (c.pos[0] - h[0]) * ux + (c.pos[2] - h[1]) * uz;
    W.input.keys.add('KeyW'); if (o.sprint) W.input.keys.add('ShiftLeft');
    let crossed = false, deepest = 0, last = read(d, c.pos), through = -1, aside = 0, wide = 0;
    for (let i = 0; i < (o.secs ?? 4) * 60; i++) { if (o.steer && i % 6 === 0) yaw = yawFor(goal[0] - c.pos[0], goal[2] - c.pos[2]); W.cam.yaw = yaw; W.cam.rebuild(); W.step(DT); const r = read(d, c.pos), out = outOf();
      if (!d.off) { if (r.inside && last.inside && r.face !== last.face) crossed = true; if (r.along > 0.14) deepest = Math.max(deepest, r.pen); } last = r; wide = Math.max(wide, d.angle * F.S);
      if (out > 0.3) aside = Math.max(aside, Math.abs(alongOf() - a0)); if (through < 0 && out < -0.5) through = (i + 1) * DT;
      if (process.env.DOORSOLID_TRACE === '1' && out < 1.3 && i % 2 === 0) console.log(`    ${i} out ${out.toFixed(2)} along ${alongOf().toFixed(2)} angle ${(d.angle * F.S).toFixed(2)} vel ${(d.vel * F.S).toFixed(1)} face ${r.face * F.S} pen ${(r.pen * 100).toFixed(0)} pullT ${d.pullT.toFixed(2)}`); }
    W.input.keys.delete('KeyW'); W.input.keys.delete('ShiftLeft'); for (let i = 0; i < 30; i++) W.step(DT); pl.crouch = false;
    const e = c.pos, q: Vec3 = [e[0], 0, e[2]]; g.col.collideCircle(q, 0.3, 0.2, 1.5, 1); const s = g.doors.solids;
    return { crossed, deepest, angle: d.angle * F.S, out: outOf(), moved: Math.hypot(e[0] - p0[0], e[2] - p0[2]), clear: Math.hypot(q[0] - e[0], q[2] - e[2]) < 0.02 && (d.off || read(d, e).pen <= 0.03), end: [e[0], 0, e[2]],
      carried: s.carried - S0.carried, stopped: s.stopped - S0.stopped, passed: s.passed - S0.passed, reached: s.reached - S0.reached, held: s.held - S0.held, through, aside, wide, off: !!d.off };
  };
  const world = async (on: boolean, level?: any) => { DOORWAY.oneWay = true; const W: any = await quiet(() => standUp(level ? { level } : {})); const g = W.game; DOORWAY.oneWay = true; DOORWAY.solid = on && !BREAK;   // AFTER standUp: the stand-up lines would otherwise write them back (one-way leaves: the frozen stand swings them both ways, where no leaf is ever pulled)
    g.aiEnabled = false; g.playerInvisible = true; g.godMode = true; park(g); for (const d of g.doors.list) d.locked = false; return W; };
  return { ROOT, DOORWAY, PLAYER_ID, DT, R, quiet, frame, read, walkIn, keysIn, world };
}

export async function doorsolidCheck(): Promise<boolean> {
  const K = await kit(), { DOORWAY, PLAYER_ID, DT, frame, read, walkIn, keysIn, world } = K;
  const { SPRINTDOOR } = await import(`${K.ROOT}/src/game/sprintdoor.ts`); const { DOORBLAST } = await import(`${K.ROOT}/src/game/doorblast.ts`);
  const { saveState, loadState } = await import(`${K.ROOT}/src/game/savestate.ts`);
  const { knobsSnapshot, applyKnobs } = await import(`${K.ROOT}/src/game/journal.ts`);
  const f2 = (x: number) => x.toFixed(2); let failed = false; const line = (ok: boolean, s: string) => { if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}`); };
  const was = DOORWAY.solid, wasOneWay = DOORWAY.oneWay, wasRun = { ...SPRINTDOOR }, wasBlast = DOORBLAST.on, wasHolds = DOORWAY.frameHolds;
  const free = (g: any, p: Vec3) => !g.col.nav.isBlocked(p[0], p[2]);
  /** a shut wooden door with open floor all through the side it opens into */
  const pick = (g: any): string | null => { for (const d of g.doors.list) { if (d.def.steel || d.off || Math.abs(d.angle) > 0.02 || Math.abs(d.swing > 0 ? d.maxA : d.minA) < 1.4) continue;
    const F = frame(d); let ok = true; for (let a = -0.2; a <= F.W + 0.9 && ok; a += 0.3) for (let o = 0.75; o <= 2.1 && ok; o += 0.3) ok = free(g, F.pt(a, o)); if (ok) return d.def.name; } return null; };
  const tell = (r: WalkIn) => `the leaf ${f2(r.angle)} rad open, through him ${r.crossed}, deepest in it ${f2(r.deepest * 100)} cm, moved ${f2(r.moved)} m, clear at the end ${r.clear} · ${r.held} frames stood back, ${r.carried} carried, ${r.stopped} stops, ${r.passed} let through`;
  const told = (r: WalkIn) => `in through the doorway ${r.through < 0 ? 'NEVER' : `at ${f2(r.through)} s`}, through him ${r.crossed}, deepest in it ${f2(r.deepest * 100)} cm, ${f2(r.aside * 100)} cm off his line, the leaf ${f2(r.wide)} rad at its widest · hand ${r.reached}, ${r.held} frames stood back, ${r.carried} carried, ${r.stopped} stops, ${r.passed} let through`;
  try {
    const W0 = await world(true), name = pick(W0.game);
    line(!!name && DOORWAY.oneWay, `the office has a shut wooden door with open floor where it swings (${name ? `'${name}', ${f2(W0.game.doors.byName(name).def.width)} m` : 'NONE'}; doors swing ${DOORWAY.oneWay ? 'one way' : 'BOTH WAYS'} on this stand)`);
    if (!name) throw new Error('no door to stage at');
    const door = (g: any) => g.doors.byName(name);

    const run = (on: boolean, kick: boolean, blast = true) => { SPRINTDOOR.on = on; SPRINTDOOR.kick = kick; DOORBLAST.on = blast; DOORWAY.frameHolds = true; };
    let offAt = -1;   // (run(): AFTER world() — the stand-up lines write the stand's own words back)
    { const W = await world(false); run(true, true); DOORWAY.solid = false; const r = keysIn(W, door(W.game), {}); offAt = r.through;
      line(r.crossed && r.deepest > 0.2 && r.through > 0 && r.held + r.carried + r.reached === 0, `the rule off, the walk key held at the face it opens toward: the pulled leaf comes round through him, as it did (${told(r)})`); }

    for (const along of [0.2, 0.5, 0.85]) { const W = await world(true); run(true, true); const r = keysIn(W, door(W.game), { along });
      line(!r.crossed && r.deepest <= 0.08 && r.reached >= 1 && r.through > 0 && r.through < offAt + 1.6 && r.aside < 0.12 && r.stopped === 0 && r.passed === 0 && r.clear,
        `the rule on, the same walk at ${along} of its width: his hand takes it short of his chest, he stands back from its swing on his own line, and with the key still held he is in through the doorway — the leaf never through him (${told(r)}; ${f2(r.through - offAt)} s later than with the rule off)`); }

    { const W = await world(true); run(true, true); const r = keysIn(W, door(W.game), { crouch: true, secs: 7 });
      line(!r.crossed && r.deepest <= 0.08 && r.reached === 0 && r.through > 0 && r.passed === 0 && r.clear, `crouched, the same walk: no hand goes out ahead of him (a man creeping up to a door means to stop at it — it opens on his chest, as ever), and then the same: stood back, never through him, in (${told(r)})`); }

    { const W = await world(true), g = W.game, pl = g.player, d = door(g), F = frame(d); let said = ''; const msg0 = g.msg; g.msg = (t: string) => { if (/go any further/.test(t)) said = t; msg0.call(g, t); };
      const r = walkIn(W, d, { speed: 0, secs: 4, out: 0.5, first: () => { pl.easing = d; pl.easeStallT = 0; pl.easeBest = Math.abs(d.angle); } }); g.msg = msg0;
      line(!r.crossed && r.deepest <= 0.08 && r.angle > 1.2 && !pl.easing && !said && r.clear, `the 'ease' row from the face it opens toward: he is stood back as it comes and it goes all the way round under his hand, never through him${said ? ` — it said '${said}'` : ''} (${tell(r)}; ${f2(F.W)} m leaf)`); }

    for (const [what, on] of [['ripped round by the handle (a run with no boot in it)', true], ['hauled round on the old full bash (the run\'s own rule off)', false]] as const) for (const along of [0.2, 0.85]) {
      const W = await world(true); run(on, false); const r = keysIn(W, door(W.game), { along, from: 3, sprint: true });
      line(!r.crossed && r.deepest <= 0.12 && r.through > 0 && r.wide > 1.2 && r.passed === 0 && r.clear, `at a run, at ${along} of its width, ${what}: never through him, and he is in through the doorway with the keys held (${told(r)})`); }
    { const W = await world(true); run(true, true); const r = keysIn(W, door(W.game), { from: 3, sprint: true });
      line(r.off && r.through > 0 && r.held + r.carried + r.stopped === 0, `a boot at the run is as it was: the leaf off its hinges away from him, nobody stood back or carried (${told(r)})`); }
    { const W = await world(true), g = W.game, d = door(g), r = walkIn(W, d, { speed: 0, secs: 1.5, first: p => g.doors.use(d, p, PLAYER_ID) });
      line(!r.crossed && r.angle > 1.2 && r.held > 0 && r.stopped === 0 && r.clear, `his hand on it, standing in its swing: he is stood back out of it and it opens (${tell(r)})`); }

    { const W = await world(true), g = W.game, d = door(g), r = walkIn(W, d, { speed: 0, secs: 1.5, first: () => g.doors.pull(d, g.guards[0]?.id ?? 2) });
      line(!r.crossed && r.angle > 1.2 && r.held > 0 && r.stopped === 0 && r.clear, `somebody else's hand on it, the player standing in its swing: he is stood back out of it and the leaf comes all the way round — nobody's entry waits on him (${tell(r)})`); }

    { const W = await world(true); run(true, true); const g = W.game, d = door(g), F = frame(d), real = g.doors.settle, h = d.def.hinge, a0 = g.doors.solids.aside;
      g.doors.settle = (p: Vec3, r: number) => { real?.(p, r); const out = (p[0] - h[0]) * F.n[0] + (p[2] - h[1]) * F.n[1]; if (out > 0.85) { p[0] -= F.n[0] * (out - 0.85); p[2] -= F.n[1] * (out - 0.85); } };   // (a wall 0.85 m behind the door's line, to the leaf's rules: a door onto a corridor)
      const r = keysIn(W, d, { from: 0.8, steer: true, secs: 5 }), aside = g.doors.solids.aside - a0;
      line(!r.crossed && r.deepest <= 0.12 && aside > 0 && r.passed === 0 && r.through > 0, `a wall close behind him (a door onto a corridor): he is stepped aside along it past the latch for ${aside} frames, the leaf never through him, and with the walk steered back at the doorway he is in (${told(r)})`); }

    { const W = await world(true), g = W.game, d = door(g); g.puppet = { goal: null, aim: null }; const r = walkIn(W, d, { speed: 0, secs: 1.5, first: p => g.doors.use(d, p, PLAYER_ID) }); g.puppet = null;
      line(r.angle > 1.2 && r.held + r.carried + r.stopped === 0, `under a show's strings: the leaf passes him as it always did — a show keeps the walk it was written with (${tell(r)})`); }

    { const W = await world(true), g = W.game, d = door(g); g.doors.settle = () => { /* nowhere to go */ }; g.doors.standable = () => false;
      const pinned = (W1: any) => { const g1 = W1.game, p = g1.player.char.pos, at: Vec3 = [p[0], p[1], p[2]]; g1.doors.settle = (q: Vec3) => { q[0] = at[0]; q[2] = at[2]; }; };
      pinned(W); const r = walkIn(W, d, { speed: 0, secs: 1.0, first: p => { const at: Vec3 = [p[0], p[1], p[2]]; g.doors.settle = (q: Vec3) => { q[0] = at[0]; q[2] = at[2]; }; g.doors.use(d, p, PLAYER_ID); } });
      const rest = read(d, g.player.char.pos);
      line(!r.crossed && r.stopped === 1 && r.passed === 0 && r.angle > 0.02 && r.angle < 0.9 && rest.pen <= 0.02 && Math.abs(d.vel) < 1e-6, `no floor to move him onto, one pull by hand: it stops on him and rests there, ${f2(r.angle)} rad open, ${f2(rest.pen * 100)} cm into him (${tell(r)})`);
      const W2 = await world(true), g2 = W2.game, d2 = door(g2), F2 = frame(d2); let at2: Vec3 | null = null; g2.doors.settle = (q: Vec3) => { if (at2) { q[0] = at2[0] - F2.n[0] * 0.03; q[2] = at2[2] - F2.n[1] * 0.03; } };   // (a wall at his back: every push ends where he stood, a stride nearer the leaf)
      const r2 = walkIn(W2, d2, { speed: 2, secs: 2.0, first: p => { at2 = [p[0], p[1], p[2]]; } });
      line(r2.stopped >= 3 && r2.passed >= 1 && r2.angle > 1.2, `the same wall, walked at for two seconds: it stops on him ${r2.stopped} times and then passes him as it always did — the door opens (${tell(r2)})`); }

    { const W = await world(true), g = W.game, d = door(g), F = frame(d), o = g.guards[0], at = F.pt(F.W * 0.5, 0.48); o.dazzledUntil = -1; o.char.pos = [at[0], 0, at[2]]; o.char.update(0);
      const side = F.pt(F.W + 0.45, 0.55); g.teleportPlayer([side[0], 0, side[2]]); W.step(DT); const c0 = g.doors.solids.carried; g.doors.use(d, g.player.char.pos, PLAYER_ID);
      for (let i = 0; i < 60; i++) W.step(DT);
      const dm = Math.hypot(o.char.pos[0] - at[0], o.char.pos[2] - at[2]);
      line(d.angle * F.S > 1.2 && dm < 0.02, `a man of the AI standing in the swing of the player's pull: the leaf passes him as ever (${f2(d.angle * F.S)} rad open, he is ${f2(dm * 100)} cm from where he stood; the player, beside the latch, was carried ${g.doors.solids.carried - c0} frames)`); }

    { const W = await world(true), g = W.game, d = door(g); d.solidT = 2; const s = JSON.parse(JSON.stringify(saveState(g)));
      const W2 = await world(true), g2 = W2.game; await K.quiet(() => loadState(g2, s)); DOORWAY.solid = !BREAK;
      line(door(g2).solidT === 2, `a leaf's count of stops, saved and loaded into a fresh game: ${door(g2).solidT} (want 2)`); }

    { const g = W0.game, snap = () => JSON.parse(JSON.stringify(knobsSnapshot(g)));
      DOORWAY.solid = true; const old = snap(); delete old.tables.DOORWAY.solid; applyKnobs(g, old); const before = DOORWAY.solid;
      DOORWAY.solid = false; const own = snap(); own.tables.DOORWAY.solid = true; applyKnobs(g, own); const carried = DOORWAY.solid;
      line(before === false && carried === true, `a recording from before the key replays with the rule off (journal.ts applyKnobs): ${before} · one that carries it keeps its own word: ${carried}`); }
  } catch (err) { line(false, `threw: ${(err as Error)?.stack ?? err}`); }
  finally { DOORWAY.solid = was; DOORWAY.oneWay = wasOneWay; DOORWAY.frameHolds = wasHolds; Object.assign(SPRINTDOOR, wasRun); DOORBLAST.on = wasBlast; }
  console.log(failed ? '=== doorsolid-check: FAIL ===' : '=== doorsolid-check: ALL PASS ===');
  return !failed;
}

/** every shut door of the named levels, the walk key held at the middle of the face it opens toward, the rule on: one line a level */
async function survey(names: string[]) {
  const K = await kit(), { readFileSync } = await import('node:fs');
  const { loadLevel } = await import(`${K.ROOT}/src/scene/levelLoad.ts`); const { parseLevelData } = await import(`${K.ROOT}/src/scene/levelData.ts`);
  for (const name of names) {
    const level = () => loadLevel(parseLevelData(readFileSync(`${K.ROOT}/levels/${name}.json`, 'utf8')));
    const W0 = await K.world(true, level()), doors = W0.game.doors.list.filter((d: any) => !d.off && Math.abs(d.angle) < 0.02).map((d: any) => d.def.name).filter((x: string) => !process.env.DOORSOLID_ONLY || process.env.DOORSOLID_ONLY.split(',').includes(x));
    let ok = 0, late = 0, n = 0, hands = 0; const odd: string[] = [], steered: string[] = [], hand: string[] = [];
    for (const dn of doors) { const W = await K.world(true, level()), g = W.game, d = g.doors.byName(dn), F = K.frame(d);
      const room = (o: number) => { const p = F.pt(F.W * 0.5, o), q: Vec3 = [p[0], 0, p[2]]; g.col.collideCircle(q, 0.3, 0.2, 1.5, 1); return Math.hypot(q[0] - p[0], q[2] - p[2]) <= 0.05; };
      const froms = [1.5, 1.0, 0.6].filter(room); if (!froms.length) { odd.push(`${dn}: no standing room before it`); continue; }
      let r = K.keysIn(W, d, { from: froms[0], secs: 5 }), how = '';
      for (const from of froms.slice(1)) { if (r.wide > 0.02 || r.reached) break; const W2 = await K.world(true, level()); r = K.keysIn(W2, W2.game.doors.byName(dn), { from, secs: 5 }); }   // (something stood between that spot and the leaf: from nearer)
      for (const al of [0.2, 0.5, 0.95]) { const W3 = await K.world(true, level()), g3 = W3.game, d3 = g3.doors.byName(dn), F3 = K.frame(d3), at = F3.pt(F3.W * al, 0.4), q: Vec3 = [at[0], 0, at[2]]; g3.col.collideCircle(q, 0.3, 0.2, 1.5, 1);
        if (Math.hypot(q[0] - at[0], q[2] - at[2]) > 0.05) continue; g3.teleportPlayer([at[0], 0, at[2]]); W3.step(K.DT); g3.doors.use(d3, g3.player.char.pos, K.PLAYER_ID); let deep = 0, flip = false, last = K.read(d3, g3.player.char.pos);
        for (let i = 0; i < 90; i++) { W3.step(K.DT); const r3 = K.read(d3, g3.player.char.pos); if (r3.along > 0.14) deep = Math.max(deep, r3.pen); if (r3.inside && last.inside && r3.face !== last.face) flip = true; last = r3; }
        hands++; if (flip || deep > 0.1) hand.push(`${dn}@${al}: ${flip ? 'THROUGH HIM' : ''} ${(deep * 100).toFixed(0)} cm deep, ${g3.doors.solids.stopped} stops, ${g3.doors.solids.passed} let through`); }
      const inn = (x: WalkIn) => x.through > 0 || x.out < -0.1;   // (in the frame counts: some rooms have a shelf half a metre inside the door)
      if (!r.crossed && r.passed === 0 && !inn(r)) { const W2 = await K.world(true, level()); const r2 = K.keysIn(W2, W2.game.doors.byName(dn), { from: froms[0], secs: 6, steer: true }); if (!r2.crossed && r2.passed === 0 && inn(r2)) { r = r2; how = 'steered'; steered.push(dn); } }
      if (!r.crossed && r.passed === 0 && inn(r)) { ok++; if (r.through > 0 && !how) { late += r.through; n++; } } else odd.push(`${dn}: ${r.crossed ? 'THROUGH HIM' : 'not through him'}, in ${r.through < 0 ? 'NEVER' : r.through.toFixed(2) + ' s'}, ${r.wide.toFixed(2)} rad at its widest, hand ${r.reached}, stood back ${r.held}, carried ${r.carried}, ${r.stopped} stops, ${r.passed} let through, ${(r.aside * 100).toFixed(0)} cm off his line`); }
    console.log(`${name}: ${doors.length} shut doors · ${ok} never through him and he is in through the doorway with the walk key held (${n ? (late / n).toFixed(2) : '—'} s on average${steered.length ? `; ${steered.length} of them only with the walk steered back at the doorway — a wall behind him, he was stepped aside past the latch: ${steered.join(', ')}` : ''})${odd.length ? ` · the rest: ${odd.join(' | ')}` : ''} · his hand on it standing 0.4 m off it at three places along it: ${hands - hand.length} of ${hands} never more than 10 cm into him${hand.length ? ` · the rest: ${hand.join(' | ')}` : ''}`);
  }
}

if (import.meta.main) { const i = process.argv.indexOf('--survey'); if (i > 0) { await survey((process.argv[i + 1] ?? 'office').split(',')); process.exit(0); } process.exit(await doorsolidCheck() ? 0 : 1); }
