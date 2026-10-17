// `bun run tools/qa/probes.ts wallmen` (family `wallpen`; or this file directly): THE MEN ACT ON ROUNDS GOING THROUGH THIN THINGS (src/game/wallpen.ts
// WALLPEN.men — coverfire.ts ask, suppression.ts coverFrom). Staged on the office stood up headless; the partition, the wooden door and the hard wall are FOUND
// in the level (the first of each with a shooter's lane on one side and a man's place on the other), so the check moves with the level and names what it used.
//   the line   thinLine — the question a man asks before he fires through — says yes exactly where the round then fired down that line arrives, by gun
//              (a rifle through a partition and a door; a pellet through a partition, not a door; nothing through concrete);
//   fires      a shooter who was handed the record a real sighting leaves (coverfireSaw) of a man now a stride behind a partition puts a short burst through
//              it — a defender on the fight AI, a teammate on the fight AI, a teammate under an order — and the same through a wooden door leaf (which the
//              cover-fire rule alone refuses); never more than the burst; a man behind it whom he has NOT seen gets no round; a man behind concrete none;
//   cover      a man picking cover from a gun (coverFrom) takes a place a rifle round does not reach before one hidden only by things it goes through: over
//              a seeded sweep of the floor, places that were soft with the row off come out hard with it on, and never the other way.
// The check raises the switch itself, so it says the same on the frozen stand and under TPS_PROFILE=shipped. It must fail under WALLPEN_BREAK=1 (the whole rule
// left off) and under WALLMEN_BREAK=1 (rounds go through, the men's row left off).
type Vec3 = [number, number, number];
const BREAK = process.env.WALLPEN_BREAK === '1', MEN_BREAK = process.env.WALLMEN_BREAK === '1';
type Kind = 'def' | 'op' | 'order';

export async function wallmenCheck(): Promise<boolean> {
  const { standUp, ROOT } = await import('./headless.ts');
  const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
  const { WALLPEN, WALLPEN_STATS, WALLPEN_HOOKS, wallMenLive, thinLine, flightLen, thinThing } = await import(`${ROOT}/src/game/wallpen.ts`);
  const { roundEnergy } = await import(`${ROOT}/src/game/glasspen.ts`);
  const { WEAPONS } = await import(`${ROOT}/src/game/weapons.ts`);
  const { surfOf } = await import(`${ROOT}/src/game/particleFx.ts`);
  const { spawnUnit, shotOrigin } = await import(`${ROOT}/src/game/guards.ts`);
  const { order } = await import(`${ROOT}/src/game/squad.ts`);
  const { COVERFIRE, coverfireSaw, coverfireOn } = await import(`${ROOT}/src/game/coverfire.ts`);
  const { coverFrom, SUPPRESSION_DEBUG } = await import(`${ROOT}/src/game/suppression.ts`);
  const { HOLDFIRE } = await import(`${ROOT}/src/game/holdfire.ts`);
  const { FRAG } = await import(`${ROOT}/src/game/frag.ts`);
  const { fireWeapon } = await import(`${ROOT}/src/game/combat.ts`);
  const { BoxFlag } = await import(`${ROOT}/src/scene/boxes.ts`);
  const DT = 1 / 60; const f1 = (x: number) => x.toFixed(1), f2 = (x: number) => x.toFixed(2);
  let failed = false; const line = (ok: boolean, s: string) => { if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}`); };
  const quiet = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => {}; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
  const was = { on: WALLPEN.on, men: WALLPEN.men, hold: HOLDFIRE.on, frags: FRAG.defenders, cf: COVERFIRE.on };
  const flat = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
  const thinN = (b: any): Vec3 => { const cs = Math.cos(b.yaw), sn = Math.sin(b.yaw); return b.h[0] < b.h[2] ? [cs, 0, -sn] : [sn, 0, cs]; };
  const free = (g: any, p: Vec3) => !g.col.nav.isBlocked(p[0], p[2]);
  const sideOf = (k: Kind) => k === 'def' ? 'hostile' : 'operative';
  const wordOf = (k: Kind) => k === 'def' ? 'a defender (fight AI)' : k === 'op' ? 'a teammate (fight AI)' : 'a teammate under an order (room fight)';

  /** a fresh office with nobody in it but who the line spawns: Sam parked dark at the far end, every fixture on, the squad's first-round hold and the
   *  defenders' frags out of the staging (each answers a man behind a wall before a round can, and each has a check of its own) */
  const world = async (men = true) => {
    const W: any = await quiet(() => standUp()); const g = W.game;
    WALLPEN.on = !BREAK; WALLPEN.men = men && !BREAK && !MEN_BREAK; COVERFIRE.on = true; HOLDFIRE.on = false; FRAG.defenders = false;   // AFTER standUp: the stand-up lines would write them back
    for (const gd of g.guards) { gd.flashlight.enabled = false; g.engine.lights.remove(gd.flashlight); }
    g.guards = []; g.tune.civilians = false; g.tune.qrf = false; g.tune.devices = false; g.godMode = true; g.aiEnabled = true;
    for (const grp of new Set<string>(g.targets.map((t: any) => t.group).filter(Boolean))) g.setGroup(grp, true);
    return W;
  };
  const parkSam = (g: any, from: Vec3) => {
    const nav = g.col.nav; let best: Vec3 | null = null, bd = -1;
    for (let iz = 1; iz < nav.H - 1; iz += 2) for (let ix = 1; ix < nav.W - 1; ix += 2) { if (nav.blocked[nav.idx(ix, iz)]) continue; const p: Vec3 = [(ix + 0.5) * nav.cell, 0, (iz + 0.5) * nav.cell]; const d = flat(p, from); if (d > bd) { bd = d; best = p; } }
    if (best) g.teleportPlayer(best);
  };
  /** the first upright thing of `boxes` with a shooter's place `back` m off one face and a man's place `behind` m off the other, the gun's line meeting IT
   *  first, nothing else between it and the man, no loose furniture in the line */
  const laneAt = (g: any, boxes: { b: any; index: number }[], back: number, behind: number) => {
    for (const { b, index } of boxes) for (const s of [1, -1]) {
      const n0 = thinN(b), n: Vec3 = [n0[0] * s, 0, n0[2] * s], half = Math.min(b.h[0], b.h[2]);
      const sp: Vec3 = [b.c[0] + n[0] * (half + back), 0, b.c[2] + n[2] * (half + back)], tp: Vec3 = [b.c[0] - n[0] * (half + behind), 0, b.c[2] - n[2] * (half + behind)];
      if (!free(g, sp) || !free(g, tp) || !free(g, [b.c[0] + n[0] * (half + 0.7), 0, b.c[2] + n[2] * (half + 0.7)])) continue;
      const gun: Vec3 = [sp[0], 1.35, sp[2]], at: Vec3 = [tp[0], 1.25, tp[2]], d = v3.normalize(v3.sub(at, gun)), L = v3.dist(gun, at);
      const h = g.col.raycast(gun, d, L); if (!h || h.index !== index) continue;
      const out = v3.mad(gun, d, h.t + 2 * half + 0.06) as Vec3; if (g.col.raycast(out, d, Math.max(0.05, L - h.t - 2 * half - 0.1))) continue;
      if (g.props.raycast(gun, d, L)) continue;
      return { b, index, n, half, sp, tp };
    }
    return null;
  };
  type Lane = NonNullable<ReturnType<typeof laneAt>>;
  const things = (g: any) => {
    const statics = g.col.boxes.map((b: any, index: number) => ({ b, index }));
    const tall = (b: any) => b.c[1] - b.h[1] <= 0.1 && b.c[1] + b.h[1] >= 2.2;
    const parts = statics.filter(({ b, index }: any) => tall(b) && thinThing(g, index)?.stuff === 'drywall' && Math.max(b.h[0], b.h[2]) >= 1.4);
    const hard = statics.filter(({ b, index }: any) => tall(b) && !thinThing(g, index) && !(b.flags & (BoxFlag.NoShadow | BoxFlag.Glass)) && ['concrete', 'metal'].includes(surfOf(b.albedo)) && Math.max(b.h[0], b.h[2]) >= 1.4 && Math.min(b.h[0], b.h[2]) <= 0.3);
    const wooden = g.doors.list.map((d: any, i: number) => ({ d, b: d.box, index: 1e6 + i })).filter(({ d }: any) => !d.def.steel && !d.off && Math.abs(d.angle) < 0.02);
    return { parts, hard, wooden };
  };
  /** a shooter of this kind at the lane's near end who has the man at its far end for his enemy, the man quiet and still; `saw` = the sighting handed over
   *  and kept fresh for `know` seconds. Returns what he fired and what his rounds went through. */
  const run = async (kind: Kind, pick: (g: any) => Lane | null, saw: boolean, secs = 5, men = true) => {
    const W = await world(men), g = W.game; const X = pick(g); if (!X) return null;
    parkSam(g, X.tp);
    const spawn = (team: string, pos: Vec3, facing: Vec3, name: string) => spawnUnit(g, { team, pos: [pos[0], 0, pos[2]], yaw: v3.yawTo([pos[0], 0, pos[2]], [facing[0], 0, facing[2]]), light: false, name });
    const T = spawn(kind === 'def' ? 'operative' : 'hostile', X.tp, X.sp, 'Target'), S = spawn(sideOf(kind), X.sp, X.tp, 'Shooter');
    order(T, { goal: null });
    const shots: { from: Vec3; to: Vec3 }[] = [], met: number[] = []; let onKind = '';
    WALLPEN_HOOKS.crossed = (_g: any, x: any, who: number) => { if (who === S.char.id) met.push(x.index); };
    const step = (n: number) => { for (let i = 0; i < n; i++) {
      g.player.visibility = 0.02; T.weapon.chamber = 0; T.weapon.mag = 0; T.fireCd = 9;
      W.step(DT);
      for (const e of g.events) if (e.kind === 'guardShot' && e.time === g.time && e.to && e.who === S.char.id) shots.push({ from: [...e.from] as Vec3, to: [...e.to] as Vec3 });
    } };
    step(20);
    if (kind === 'order') order(S, { goal: null, upper: 'aim', aimAt: [T.char.pos[0], 1.25, T.char.pos[2]] });
    else { S.hold = false; S.pinned = true; S.state = 'alert'; S.awareness = 1; S.foe = T; S.reactT = 0.2; S.fireCd = 0.4; S.reloadT = -1; S.lastKnown = v3.copy(T.char.pos); S.aim?.clear?.(); S.witness.alertedBy = 'radio'; S.witness.alertT = g.time; }
    step(30); const before = shots.length; const t0 = g.time;
    for (let i = 0; i < secs * 60; i++) { if (saw && g.time - t0 < 3 && T.state !== 'dead') coverfireSaw(g, S, T); onKind = coverfireOn(g, S)?.kind ?? onKind; step(1); }
    WALLPEN_HOOKS.crossed = null;
    return { X, before, fired: shots.length - before, through: met.filter(i => i === X.index).length, down: T.state === 'dead' || !T.char.alive, onKind, live: wallMenLive(g) };
  };

  try {
    // ------------------------------------------------------------ the line of fire is the round's own flight
    {
      const W = await world(), g = W.game; const { parts, hard, wooden } = things(g);
      const P = laneAt(g, parts, 4, 1.2), D = laneAt(g, wooden, 3.5, 1.2), H = laneAt(g, hard, 4, 1.2);
      line(wallMenLive(g) && !!P && !!D && !!H, `the office has a lane through each: partition ${P?.index} (${f1((P?.half ?? 0) * 200)} cm), wooden door '${D ? g.doors.list[D.index - 1e6].def.name : '—'}', hard wall ${H?.index}; the men's row is live`);
      if (!P || !D || !H) throw new Error('no partition / wooden door / hard wall with a lane across it was found on the office');
      const rifle = WEAPONS.fn2000, pellet = WEAPONS.m870, nine = WEAPONS.guard9mm;
      const rows: string[] = []; let agree = true, want = true;
      for (const [name, X, exp] of [['partition', P, { rifle: true, nine: true, pellet: true }], ['wooden door', D, { rifle: true, nine: true, pellet: false }], ['hard wall', H, { rifle: false, nine: false, pellet: false }]] as const) {
        const gun: Vec3 = [X.sp[0], 1.35, X.sp[2]], at: Vec3 = [X.tp[0], 1.25, X.tp[2]], d = v3.normalize(v3.sub(at, gun)), L = v3.dist(gun, at);
        for (const [gn, def] of [['rifle', rifle], ['nine', nine], ['pellet', pellet]] as const) {
          const e = roundEnergy(def), T = thinLine(g, gun, at, e, 0), yes = !!T && T !== 'clear';
          const flew = flightLen(g, gun, d, L, e) >= L - 1e-6;                    // the same round, flown: does it get the whole way
          if (yes !== flew) agree = false; if (yes !== (exp as any)[gn]) want = false;
          rows.push(`${name} ${gn} ${yes ? `yes (${f2((T as any).e)} left)` : 'no'}`);
        }
      }
      line(agree && want, `a line is fired through exactly where the round arrives, by gun — ${rows.join(' · ')}`);
      // …and a round really fired down the rifle's line through the partition arrives where the line said (the muzzle's own flight, marks and all)
      { const spawn = (team: string, pos: Vec3, facing: Vec3, name: string) => spawnUnit(g, { team, pos: [pos[0], 0, pos[2]], yaw: v3.yawTo([pos[0], 0, pos[2]], [facing[0], 0, facing[2]]), light: false, name });
        parkSam(g, P.tp); const T = spawn('operative', P.tp, P.sp, 'Target'), S = spawn('hostile', P.sp, P.tp, 'Shooter'); order(T, { goal: null });
        for (const o of [S, T]) { o.hold = true; o.pinned = true; o.dazzledUntil = 1e9; }
        for (let i = 0; i < 30; i++) W.step(DT);
        const chest: Vec3 = [T.char.pos[0], T.char.pos[1] + 1.25, T.char.pos[2]]; const TL = thinLine(g, shotOrigin(S.char), chest, roundEnergy(S.weapon.def));
        const met: number[] = []; WALLPEN_HOOKS.crossed = (_g: any, x: any) => met.push(x.index); fireWeapon(g, S.char, chest, false, { steady: true, spread: 0 }); WALLPEN_HOOKS.crossed = null;
        line(!!TL && TL !== 'clear' && TL.walls[0].index === P.index && met.includes(P.index) && (T.state === 'dead' || !T.char.alive), `a defender's round fired down a line that said yes goes through partition ${P.index} into the man behind it (line ${TL && TL !== 'clear' ? `through ${TL.walls.length}` : String(TL)}, crossed ${met.join(', ') || 'nothing'}, the man ${T.state})`); }
    }

    // ------------------------------------------------------------ a man who knows somebody is behind it fires through
    const part = (g: any) => laneAt(g, things(g).parts, 4, 1.2), door = (g: any) => laneAt(g, things(g).wooden, 3.5, 1.2), wall = (g: any) => laneAt(g, things(g).hard, 4, 1.2);
    for (const kind of ['def', 'op', 'order'] as Kind[]) {
      const A = await run(kind, part, true);
      line(!!A && A.before === 0 && A.fired >= 1 && A.fired <= WALLPEN.thruRounds && A.through >= 1 && A.onKind === 'thru', `${kind}: ${wordOf(kind)} who saw the man go behind the partition fires a burst through it (${A?.fired} fired, ${WALLPEN.thruRounds} at most; ${A?.through} through partition ${A?.X.index}; on '${A?.onKind}'; the man ${A?.down ? 'down' : 'up'}; ${A?.before} before he knew)`);
    }
    { const A = await run('def', door, true);
      line(!!A && A.fired >= 1 && A.fired <= WALLPEN.thruRounds && A.through >= 1, `def: the same through a wooden door leaf (${A?.fired} fired, ${A?.through} through the leaf; the man ${A?.down ? 'down' : 'up'})`);
      const B = await run('op', door, true);
      line(!!B && B.fired >= 1 && B.fired <= WALLPEN.thruRounds && B.through >= 1, `op: the same through a wooden door leaf (${B?.fired} fired, ${B?.through} through the leaf; the man ${B?.down ? 'down' : 'up'})`); }
    // the burst is a burst: one sighting, the man gone from the place — exactly the rule's rounds, then nothing; seen again: another
    {
      const W = await world(), g = W.game; const X = part(g)!; parkSam(g, X.tp);
      const spawn = (team: string, pos: Vec3, facing: Vec3, name: string) => spawnUnit(g, { team, pos: [pos[0], 0, pos[2]], yaw: v3.yawTo([pos[0], 0, pos[2]], [facing[0], 0, facing[2]]), light: false, name });
      const T = spawn('operative', X.tp, X.sp, 'Target'), S = spawn('hostile', X.sp, X.tp, 'Shooter'); order(T, { goal: null }); let fired = 0;
      const step = (n: number) => { for (let i = 0; i < n; i++) { g.player.visibility = 0.02; T.weapon.chamber = 0; T.weapon.mag = 0; T.fireCd = 9; W.step(DT); for (const e of g.events) if (e.kind === 'guardShot' && e.time === g.time && e.who === S.char.id) fired++; } };
      step(20); S.hold = false; S.pinned = true; S.state = 'alert'; S.awareness = 1; S.foe = T; S.reactT = 0.2; S.fireCd = 0.4; S.reloadT = -1; S.lastKnown = v3.copy(T.char.pos); S.aim?.clear?.(); S.witness.alertedBy = 'radio'; S.witness.alertT = g.time; step(30);
      const along: Vec3 = [-X.n[2], 0, X.n[0]]; let side: Vec3 | null = null; for (const k of [2.2, -2.2, 1.8, -1.8, 1.4, -1.4]) { const q: Vec3 = [X.tp[0] + along[0] * k, 0, X.tp[2] + along[2] * k]; const TL = thinLine(g, [X.sp[0], 1.35, X.sp[2]], [q[0], 1.25, q[2]], roundEnergy(S.weapon.def)); if (free(g, q) && TL && TL !== 'clear' && TL.walls[0].index === X.index) { side = q; break; } }   // (a place along the same partition his round also reaches)
      coverfireSaw(g, S, T); if (side) { T.char.pos = v3.copy(side); T.char.vel = [0, 0, 0]; T.char.update(0); }   // he was SEEN there — and is no longer there
      step(4 * 60); const first = fired; step(90); const rested = fired - first;
      if (T.state !== 'dead') coverfireSaw(g, S, T); step(3 * 60); const again = fired - first - rested;
      line(!!side && first === WALLPEN.thruRounds && rested === 0 && again >= 1 && again <= WALLPEN.thruRounds, `def: on ONE sighting of a man who has since moved off, exactly the burst goes through (${first} of ${WALLPEN.thruRounds}), then nothing while that is all he knows (${rested}); seen again, another (${again})`);
    }
    if (!BREAK && !MEN_BREAK) {
      const N = await run('def', part, false, 3);
      line(!!N && N.fired === 0, `def: a man behind the partition whom he has never seen gets no round (${N?.fired})`);
      const H = await run('def', wall, true, 3);
      line(!!H && H.fired === 0, `def: a man he saw go behind a hard wall gets no round (${H?.fired} fired at wall ${H?.X.index})`);
      const O = await run('def', door, true, 3, false);
      line(!!O && !O.live && O.fired === 0, `def: with the men's row off a door leaf is nobody's to fire through, as it was (${O?.fired} fired)`);
    }

    // ------------------------------------------------------------ cover from a gun: what stops a round before what hides
    {
      const W = await world(), g = W.game; parkSam(g, [0, 0, 0]);
      const gd = spawnUnit(g, { team: 'hostile', pos: [g.player.char.pos[0], 0, g.player.char.pos[2]], yaw: 0, light: false, name: 'Mover' }); gd.hold = true; gd.pinned = true;
      for (let i = 0; i < 5; i++) W.step(DT);
      const nav = g.col.nav; const cells: Vec3[] = [];
      for (let iz = 1; iz < nav.H - 1; iz += 2) for (let ix = 1; ix < nav.W - 1; ix += 2) if (!nav.blocked[nav.idx(ix, iz)]) cells.push([(ix + 0.5) * nav.cell, 0, (iz + 0.5) * nav.cell]);
      const soft = (T: Vec3, p: Vec3) => { const was = WALLPEN.men; WALLPEN.men = !BREAK; const r = thinLine(g, T, [p[0], 0.9, p[2]], 1, 0); WALLPEN.men = was; return !!r && r !== 'clear'; };
      // (what the rule did is read off its own trace: the only thing the row adds to a pick is the 'a round goes through what hides it' verdict — a pick
      //  with no such line must be the row-off pick to the centimetre; the places themselves are then asked the round's own question)
      let asked = 0, passed = 0, nowHard = 0, stillSoft = 0, lost = 0, moved = 0, same = 0; const h0 = WALLPEN_STATS.harder; let eg = '';
      for (let i = 0; i < 3 * cells.length && asked < 120; i++) {
        const p = cells[i % cells.length]; const t = cells[(i * [7, 13, 29][(i / cells.length) | 0] + 3) % cells.length]; const d = flat(p, t); if (d < 4 || d > 12) continue;
        if (g.col.segmentBlocked([t[0], 1.15, t[2]], [p[0], 1.2, p[2]])) continue;   // (he is in the gun's sight where he stands: a man with a reason to move)
        gd.char.pos = v3.copy(p); gd.char.vel = [0, 0, 0]; gd.char.update(0); asked++;
        const T: Vec3 = [t[0], 1.15, t[2]]; const trace: string[] = [];
        WALLPEN.men = false; const a = coverFrom(g, gd, t) as Vec3 | null;
        WALLPEN.men = !BREAK && !MEN_BREAK; let b: Vec3 | null = null; SUPPRESSION_DEBUG.log = (m: string) => trace.push(m); try { b = coverFrom(g, gd, t) as Vec3 | null; } finally { SUPPRESSION_DEBUG.log = null; }
        if (a && !b) { lost++; continue; }
        const thin = trace.some(m => m.includes('a round goes through what hides it'));
        if (!thin) { if (!!a !== !!b || (a && b && flat(a, b) > 0.05)) moved++; else same++; continue; }
        passed++;
        if (b && trace.some(m => m.includes('TAKEN'))) { nowHard++; if (!soft(T, b) && a && !eg) eg = `from (${f1(p[0])}, ${f1(p[2])}) under a gun at (${f1(t[0])}, ${f1(t[2])}): (${f1(a[0])}, ${f1(a[2])}) behind a thin thing → (${f1(b[0])}, ${f1(b[2])}) behind what stops a round`; }
        else stillSoft++;
      }
      line(asked >= 40 && nowHard >= 1 && !!eg && lost === 0 && moved === 0 && WALLPEN_STATS.harder - h0 === nowHard, `cover from a gun: of ${asked} places a man stood in a gun's sight, ${passed} times a place only HIDDEN from it came up — ${nowHard} times he took a place a rifle round does not reach instead, ${stillSoft} times there was none (the hidden place is still his); ${same} other picks unmoved to the centimetre, ${moved} moved, ${lost} lost; e.g. ${eg || '—'}`);
    }
  } catch (e) { line(false, `the check threw: ${(e as Error).message}`); }
  finally { WALLPEN.on = was.on; WALLPEN.men = was.men; HOLDFIRE.on = was.hold; FRAG.defenders = was.frags; COVERFIRE.on = was.cf; WALLPEN_HOOKS.crossed = null; }
  console.log(failed ? '=== wallmen-check: FAILED ===' : '=== wallmen-check: ALL PASS ===');
  return !failed;
}
if (import.meta.main) process.exit((await wallmenCheck()) ? 0 : 1);
