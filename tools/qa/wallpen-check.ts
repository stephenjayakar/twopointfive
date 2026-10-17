// `bun run tools/qa/probes.ts wallpen` (or this file directly): ROUNDS THROUGH THIN WALLS AND DOORS (src/game/wallpen.ts) — a round that meets a plasterboard
// partition or a wooden door leaf goes on through it with the energy it has left and finds the man beyond, whoever fired it; concrete, steel and a steel door
// stop it as ever; the switch off is the round stopping in the first built thing it meets. Staged on the office stood up headless: the partition, the door and
// the hard wall are FOUND in the level (the first of each with floor both sides), so the check moves with the level and names what it used.
// The check raises the switch itself, so it says the same on the frozen stand and under TPS_PROFILE=shipped. WALLPEN_BREAK=1 leaves the switch off while the
// same lines are asked: it must fail.
type Vec3 = [number, number, number];
const BREAK = process.env.WALLPEN_BREAK === '1';

export async function wallpenCheck(): Promise<boolean> {
  const { standUp, ROOT } = await import('./headless.ts');
  const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
  const { WALLPEN, WALLPEN_STATS, WALLPEN_HOOKS, wallPenLive, thinPath, thinToll, thinThing } = await import(`${ROOT}/src/game/wallpen.ts`);
  const { GLASSPEN, roundEnergy, roundPath } = await import(`${ROOT}/src/game/glasspen.ts`);
  const { GLASSFX } = await import(`${ROOT}/src/game/glass.ts`);
  const { BoxFlag } = await import(`${ROOT}/src/scene/boxes.ts`);
  const { lineBox } = await import(`${ROOT}/src/scene/collision.ts`);
  const { DESTRUCTION } = await import(`${ROOT}/src/game/destructionSwitch.ts`);
  const { WALLS, WALL_STATS } = await import(`${ROOT}/src/game/wallbreak.ts`);
  const { fireWeapon } = await import(`${ROOT}/src/game/combat.ts`);
  const { WEAPONS } = await import(`${ROOT}/src/game/weapons.ts`);
  const { surfOf } = await import(`${ROOT}/src/game/particleFx.ts`);
  const { digestGame } = await import(`${ROOT}/src/game/digest.ts`);
  const { knobsSnapshot, applyKnobs } = await import(`${ROOT}/src/game/journal.ts`);
  const DT = 1 / 60; const f2 = (x: number) => x.toFixed(2);
  let failed = false; const line = (ok: boolean, s: string) => { if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}`); };
  const quiet = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => {}; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
  const was = WALLPEN.on;
  const thinN = (b: any): Vec3 => { const cs = Math.cos(b.yaw), sn = Math.sin(b.yaw); return b.h[0] < b.h[2] ? [cs, 0, -sn] : [sn, 0, cs]; };
  const chestOf = (c: any): Vec3 => { const tr = c.bones.spine2 ?? c.bones.hips; return [tr ? tr[0] : c.pos[0], c.pos[1] + 1.25, tr ? tr[2] : c.pos[2]]; };
  const park = (g: any, keep: number) => g.guards.slice(keep).forEach((o: any, i: number) => { o.hold = true; o.pinned = true; o.dazzledUntil = 1e9; o.heardUpTo = 1e12; o.char.pos = [37.5, 0, 25 + i * 1.2]; o.char.vel = [0, 0, 0]; o.path = []; o.pathGoal = null; o.flashlight.enabled = false; o.char.update(0); });
  const dummy = (gd: any, p: Vec3, face: Vec3) => {
    gd.char.pos = v3.copy(p); gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.char.bodyYaw = gd.char.aimYaw = Math.atan2(face[0] - p[0], face[2] - p[2]); gd.char.aimPitch = 0;
    gd.state = 'patrol'; gd.awareness = 0; gd.lastKnown = null; gd.task = null; gd.path = []; gd.pathGoal = null; gd.hold = true; gd.pinned = true; gd.dazzledUntil = 1e9; gd.heardUpTo = 1e12; gd.flashlight.enabled = false;
    gd.char.update(0); gd.char.update(DT);
  };
  /** a fresh office: Sam at `sam` with `slot` up, the first guard a dummy at `man`, the rest parked */
  const world = async (on: boolean) => {
    const W: any = await quiet(() => standUp()); const g = W.game; WALLPEN.on = on && !BREAK;   // AFTER standUp: the stand-up line would otherwise write it back
    g.godMode = true; g.aiEnabled = true; g.playerInvisible = true; g.infiniteAmmo = true; g.tune.chaos = 0;
    return W;
  };
  const stage = async (W: any, sam: Vec3, man: Vec3, slot: 'pistol' | 'rifle') => {
    const g = W.game; g.teleportPlayer(v3.copy(sam)); park(g, 1); dummy(g.guards[0], man, sam);
    const pl = g.player; pl.slot = slot; pl.holstered = false; for (let i = 0; i < 45; i++) W.step(DT);
    dummy(g.guards[0], man, sam);
    return { gd: g.guards[0], pc: pl.char, def: (pl.gunInHand() ?? pl.pistol).def };
  };
  const free = (g: any, p: Vec3) => !g.col.nav.isBlocked(p[0], p[2]);
  /** the first upright thing the level has that `pick` takes, with floor `off` m out from both its faces at its middle and nothing else on the line across it */
  const across = (g: any, boxes: { b: any; index: number }[], off: number) => {
    for (const { b, index } of boxes) {
      const n = thinN(b), half = Math.min(b.h[0], b.h[2]); const y = 1.2;
      const A: Vec3 = [b.c[0] + n[0] * (half + off), 0, b.c[2] + n[2] * (half + off)], B: Vec3 = [b.c[0] - n[0] * (half + off), 0, b.c[2] - n[2] * (half + off)];
      if (!free(g, A) || !free(g, B)) continue;
      const from: Vec3 = [A[0], y, A[2]], d: Vec3 = [-n[0], 0, -n[2]]; const h = g.col.raycast(from, d, 2 * (half + off));
      if (!h || h.index !== index || Math.abs(h.t - off) > 0.02) continue;
      const h2 = g.col.raycast([b.c[0] - n[0] * (half + 0.01), y, b.c[2] - n[2] * (half + 0.01)], d, off + 0.4); if (h2) continue;   // (the far side is open to past where the man stands)
      if (g.props.raycast(from, d, 2 * (half + off) + 0.4)) continue;
      return { b, index, n, half, A, B, from, d };
    }
    return null;
  };

  try {
    // ------------------------------------------------------------ what the level holds
    const W0 = await world(true); const g0 = W0.game;
    const statics = g0.col.boxes.map((b: any, index: number) => ({ b, index }));
    const tall = (b: any) => b.c[1] - b.h[1] <= 0.1 && b.c[1] + b.h[1] >= 2.2;
    const parts = statics.filter(({ b, index }: any) => tall(b) && thinThing(g0, index)?.stuff === 'drywall' && Math.max(b.h[0], b.h[2]) >= 1);
    const hard = statics.filter(({ b, index }: any) => tall(b) && !thinThing(g0, index) && !(b.flags & (BoxFlag.NoShadow | BoxFlag.Glass)) && ['concrete', 'metal'].includes(surfOf(b.albedo)) && Math.max(b.h[0], b.h[2]) >= 1 && Math.min(b.h[0], b.h[2]) <= 0.3);
    const count: Record<string, number> = {}; for (const { index } of statics) { const t = thinThing(g0, index); if (t) count[t.stuff] = (count[t.stuff] ?? 0) + 1; }
    const doors = g0.doors.list.map((d: any, i: number) => ({ d, b: d.box, index: 1e6 + i }));
    const wooden = doors.filter(({ d }: any) => !d.def.steel && !d.off && Math.abs(d.angle) < 0.02), steel = doors.filter(({ d }: any) => d.def.steel);
    const P = across(g0, parts, 1.6), D = across(g0, wooden, 1.4), H = hard.length ? across(g0, hard, 1.6) ?? { ...hard[0], n: thinN(hard[0].b), half: Math.min(hard[0].b.h[0], hard[0].b.h[2]) } as any : null;
    line(wallPenLive(g0) && !!P && !!D && parts.length > 0, `the office holds thin things and the switch is live: ${Object.entries(count).map(([k, v]) => `${v} ${k}`).join(', ')} among ${statics.length} statics (${parts.length} full-height partitions), ${wooden.length} wooden leaves shut and ${steel.length} steel; staged on partition ${P?.index} (${f2((P?.half ?? 0) * 200)} cm) and door '${D ? g0.doors.list[D.index - 1e6].def.name : '-'}'`);
    if (!P || !D) throw new Error('no partition / wooden door with floor both sides was found on the office');
    const rifle = roundEnergy(WEAPONS.fn2000), nine = roundEnergy(WEAPONS.guard9mm), pellet = roundEnergy(WEAPONS.m870);

    // ------------------------------------------------------------ the rule, pure
    const atP: Vec3 = v3.mad(P.from, P.d, 1.6), atD: Vec3 = v3.mad(D.from, D.d, 1.4);
    const tP = thinToll(g0, P.index, atP, P.d, rifle), tD = thinToll(g0, D.index, atD, D.d, rifle);
    const wantP = WALLPEN.base.drywall + WALLPEN.perM.drywall * P.half * 2, wantD = WALLPEN.base.wood + WALLPEN.perM.wood * D.half * 2;
    line(!!tP && !!tD && Math.abs(tP.take - wantP) < 1e-3 && Math.abs(tD.take - wantD) < 1e-3 && tP.stuff === 'drywall' && tD.stuff === 'wood',
      `the toll is the stuff's skins + its per-metre × the path inside: partition ${f2(tP?.take ?? -1)} (want ${f2(wantP)}), door leaf ${f2(tD?.take ?? -1)} (want ${f2(wantD)}) — a rifle round leaves each with ${f2(tP?.eOut ?? -1)} / ${f2(tD?.eOut ?? -1)} of 1`);
    const chain = (e: number, index: number, at: Vec3, d: Vec3) => { let n = 0; for (; n < 12; n++) { const t = thinToll(g0, index, at, d, e); if (!t) break; e = t.eOut; } return n; };
    const nR = chain(rifle, P.index, atP, P.d), n9 = chain(nine, P.index, atP, P.d), nS = chain(pellet, P.index, atP, P.d), dR = chain(rifle, D.index, atD, D.d), d9 = chain(nine, D.index, atD, D.d), dS = chain(pellet, D.index, atD, D.d);
    line(nR > n9 && n9 >= 1 && nS >= 1 && dR > d9 && d9 >= 1 && dS === 0,
      `by its energy alone a rifle round has ${nR} such partitions in it, a 9 mm ${n9}, one pellet of buck ${nS}; ${dR} such door leaves a rifle, ${d9} a 9 mm, ${dS} a pellet (the lock rule keeps its pellets)`);
    const slant: Vec3 = v3.normalize([P.d[0] * 0.5 - P.n[2] * 0.866, 0, P.d[2] * 0.5 + P.n[0] * 0.866]), graze: Vec3 = v3.normalize([P.d[0] * 0.1 - P.n[2] * 0.995, 0, P.d[2] * 0.1 + P.n[0] * 0.995]);
    const tS = thinToll(g0, P.index, atP, slant, rifle), tG = thinToll(g0, P.index, atP, graze, rifle);
    line(!!tS && !!tP && tS.take > tP.take + 0.01 && tG === null, `a slant pays more by the longer path (60° off square: ${f2(tS?.take ?? -1)} against ${f2(tP?.take ?? -1)}), and a round laid along the sheet (84° off) is spent in it`);
    if (H) {
      const hb = H.b, hn = H.n, at: Vec3 = [hb.c[0] + hn[0] * H.half, 1.2, hb.c[2] + hn[2] * H.half];
      line(thinToll(g0, H.index, at, [-hn[0], 0, -hn[2]], rifle) === null && thinPath(g0, v3.mad(at, hn, 1), [-hn[0], 0, -hn[2]], 30, rifle) === null, `a hard wall (static ${H.index}, ${surfOf(hb.albedo)}, ${f2(H.half * 200)} cm) stops a rifle round: no toll, no flight beyond`);
    } else line(false, 'no hard full-height wall was found on the office to ask');
    if (steel.length) { const sd = steel[0], n = thinN(sd.b); const at: Vec3 = [sd.b.c[0] + n[0] * Math.min(sd.b.h[0], sd.b.h[2]), 1.2, sd.b.c[2] + n[2] * Math.min(sd.b.h[0], sd.b.h[2])]; line(thinToll(g0, sd.index, at, [-n[0], 0, -n[2]], rifle) === null, `the steel door '${sd.d.def.name}' stops a rifle round`); }
    const fp = thinPath(g0, P.from, P.d, 30, rifle), fp2 = thinPath(g0, P.from, P.d, 30, rifle);
    const turn = fp ? Math.acos(Math.min(1, v3.dot(fp.walls[0].dirIn, fp.walls[0].dirOut))) * 180 / Math.PI : -1;
    line(!!fp && !!fp2 && fp.walls.length >= 1 && fp.walls[0].index === P.index && turn >= 0 && turn <= WALLPEN.deflectDeg * (fp.walls[0].take / fp.walls[0].eIn) + 1e-6 && v3.dist(fp.walls[0].dirOut, fp2.walls[0].dirOut) === 0,
      `the flight: it goes in at ${f2(fp?.walls[0].t ?? -1)} m, comes out turned ${turn.toFixed(3)}° (inside the rule's cone), and the same shot turns the same way to the last bit`);

    // ------------------------------------------------------------ flights swept over the floor
    {
      let a = 0x5eed; const rnd = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      const nav = g0.col.nav; const cells: Vec3[] = []; for (let iz = 1; iz < nav.H - 1; iz++) for (let ix = 1; ix < nav.W - 1; ix++) if (!nav.blocked[nav.idx(ix, iz)]) cells.push([(ix + 0.5) * nav.cell, 0, (iz + 0.5) * nav.cell]);
      const flights = () => { const c = cells[(rnd() * cells.length) | 0], yaw = rnd() * Math.PI * 2, pitch = (rnd() - 0.5) * 0.5; const o: Vec3 = [c[0], 0.3 + rnd() * 1.5, c[2]]; const d: Vec3 = v3.normalize([Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)]); return { o, d }; };
      // (1) nothing else stands inside a span a round was let through: every crossing of every flight, every other box asked by the slab test
      let crossings = 0, inside = 0, eg = '';
      for (let i = 0; i < 6000; i++) { const { o, d } = flights(); const P2 = thinPath(g0, o, d, 30, rifle); if (!P2) continue;
        for (const x of P2.walls) { crossings++;
          const hit = (b: any) => { if (b.flags & BoxFlag.NoShadow) return false; const sl = lineBox(x.at, x.dirIn, b); return !!sl && Math.min(sl.t1, x.thru) - Math.max(sl.t0, 0) > 2e-3; };
          let bad = -1; g0.col.boxes.forEach((b: any, j: number) => { if (bad < 0 && j !== x.index && !(b.flags & BoxFlag.Glass) && hit(b)) bad = j; });
          g0.col.dynamicBoxes.forEach((b: any, j: number) => { if (bad < 0 && 1e6 + j !== x.index && hit(b)) bad = 1e6 + j; });
          if (bad >= 0) { inside++; if (!eg) eg = `${x.index} with ${bad} inside its span`; } } }
      line(crossings > 200 && inside === 0, `6000 rifle flights over the floor crossed ${crossings} thin things, and in ${inside} of those spans another box stood (a post, a planter, a cabinet set in the wall stops the round as it always did)${eg ? ` — e.g. ${eg}` : ''}`);
      // (2) over glass alone this flight is the glass rule's own, to the last number (thin things switched out of it: the two loops must not drift)
      const fx0 = GLASSFX.on, gp0 = GLASSPEN.on, mt0 = WALLPEN.maxThings; let panes = 0, differ = 0, n = 0;
      try { GLASSFX.on = true; GLASSPEN.on = true; WALLPEN.maxThings = 0;
        for (let i = 0; i < 6000; i++) { const { o, d } = flights(); const A = thinPath(g0, o, d, 30, rifle), B = roundPath(g0, o, d, 30, rifle); n++;
          if (A) panes += A.cross.length;
          const strip = (X: any) => X && JSON.stringify({ segs: X.segs, cross: X.cross, st: X.st, len: X.len });
          if (strip(A) !== strip(B)) differ++; }
      } finally { GLASSFX.on = fx0; GLASSPEN.on = gp0; WALLPEN.maxThings = mt0; }
      line(differ === 0 && (panes > 0 || BREAK), `with thin things switched out, ${n} flights (${panes} panes crossed) are the glass rule's own flights to the last number (${differ} differ)`);
      line(WALLPEN.thinMax.drywall === WALLS.wallMaxThick, `a partition is thin to the wall engine's own thickness (${WALLPEN.thinMax.drywall} m against ${WALLS.wallMaxThick})`);
    }
    // ------------------------------------------------------------ the wall engine still counts what crosses it
    {
      const d0 = DESTRUCTION.on; DESTRUCTION.on = true; let W: any; try { W = await world(true); } finally { DESTRUCTION.on = d0; }
      const g = W.game; const wasOn = DESTRUCTION.on; DESTRUCTION.on = true;
      try {
        g.tune.chaos = 0.5; const S = await stage(W, P.A, P.B, 'rifle'); S.gd.char.pos = [37.5, 0, 24]; S.gd.char.update(0);   // (nobody behind it: every round goes on)
        const Bk = g.destr.walls.breakableAt(P.index); const s0 = g.destr.walls.serial, r0 = WALL_STATS.rounds, c0 = WALLPEN_STATS.crossed; const at: Vec3 = [P.B[0], 1.25, P.B[2]]; let n = 0, opened = -1;
        const pb = g.col.boxes[P.index], thinX = pb.h[0] <= pb.h[2], half = thinX ? pb.h[0] : pb.h[2], m0 = g.decals.list.length; let wearMarks = -1, faceMarks = -1;
        const offOf = (d: any) => Math.abs(thinX ? d.pos[0] - pb.c[0] : d.pos[2] - pb.c[2]);
        for (; n < 14 && opened < 0; n++) { fireWeapon(g, S.pc, at, true); const rows = g.destr.walls.since(s0) ?? []; if (rows.some((r: any) => r.id === Bk?.id && r.kind !== 'reset')) opened = n + 1;
          if (n === 0) { const fresh = g.decals.list.slice(m0); wearMarks = fresh.filter((d: any) => d.kind === 'damage' && d.wearHalf > 0 && offOf(d) < 1e-3).length; faceMarks = fresh.filter((d: any) => d.kind === 'bullet' && offOf(d) < half + 0.02).length; } }
        const need = Math.ceil(WALLS.tough.drywall / (g.tune.chaos * 2));
        line(wearMarks === 1 && faceMarks === 1, `…and where it went in, its mark is the wall engine's own wear mark, on the mid-plane (wallwear.ts took it as it takes a stopped round's); where it came out, its own: ${wearMarks} wear mark, ${faceMarks} bullet mark on a face`);
        line(!!Bk && WALL_STATS.rounds - r0 >= Math.min(n, need) && opened > 0 && opened <= need + 2 && WALLPEN_STATS.crossed - c0 >= opened - 1, `with walls breaking, rounds that cross a partition are still the wall engine's: ${WALL_STATS.rounds - r0} counted of ${n} fired, ${WALLPEN_STATS.crossed - c0} went through, and the column opened on round ${opened} (the engine wants ${need})`);
        // the wear look stays a look with rounds going through: the same rounds, look on and off, the game digest after each
        { const runs: string[][] = [];
          for (const look of [true, false]) {
            const W2: any = await world(true); const g2 = W2.game; g2.tune.chaos = 0.5; g2.destr.walls.wear.on = look;
            const S2 = await stage(W2, P.A, P.B, 'rifle'); S2.gd.char.pos = [37.5, 0, 24]; S2.gd.char.update(0);
            const dig: string[] = []; for (let k = 0; k < 4; k++) { fireWeapon(g2, S2.pc, at, true); W2.step(DT); const dg = digestGame(g2, true); delete dg.rollcall; dig.push(JSON.stringify(dg)); }   // (the radio check's idle clock is rolled when a world stands up: not the same in two worlds of one process, look or no look)
            runs.push(dig); }
          const same = runs[0].length === 4 && runs[0].every((d, i) => d === runs[1][i]);
          line(same, `…and the wall engine's wear look is still only a look: four rounds through the partition, the game digest after each the same with the look on and off`); }
      } finally { DESTRUCTION.on = wasOn; }
    }

    // ------------------------------------------------------------ fired rounds, on and off
    for (const [what, X, off] of [['partition', P, 1.6], ['door leaf', D, 1.4]] as const) {
      for (const slot of ['rifle', 'pistol'] as const) {
        const res: Record<string, any> = {};
        for (const on of [true, false]) {
          const W = await world(on); const g = W.game; const S = await stage(W, X.A, X.B, slot);
          const c0 = WALLPEN_STATS.crossed, ev0 = g.events.length, m0 = g.decals.list.length; const target = chestOf(S.gd.char);
          fireWeapon(g, S.pc, target, true);
          const shot = g.events.slice(ev0).filter((e: any) => e.kind === 'shot').pop();
          res[String(on)] = { dead: S.gd.state === 'dead', crossed: WALLPEN_STATS.crossed - c0, to: shot?.to as Vec3, target, marks: g.decals.list.length - m0, def: S.def, far: shot ? v3.dist(shot.from, shot.to) : -1 };
        }
        const a = res.true, b = res.false;
        line(a.dead && a.crossed === 1 && v3.dist(a.to, a.target) < 0.6 && a.marks >= 2, `ON, ${slot} (${a.def.id}) through the ${what}: the round crossed it, left a mark on each face (+${a.marks} marks) and stopped in the man ${f2(off)} m beyond — he is down (stopped ${f2(v3.dist(a.to, a.target))} m from the point aimed at)`);
        line(!b.dead && b.crossed === 0 && b.far < a.far - 0.5, `off, the same shot: it stopped in the ${what} ${f2(b.far)} m out, the man beyond stands, nothing counted`);
      }
    }
    // a man on the near side takes the round and the wall never hears of it; a man pressed to the far face is hit
    {
      const W = await world(true); const g = W.game; const near: Vec3 = [P.A[0] - P.n[0] * 1.0, 0, P.A[2] - P.n[2] * 1.0];
      const sam: Vec3 = [P.A[0] + P.n[0] * 0.9, 0, P.A[2] + P.n[2] * 0.9];
      if (free(g, sam)) { const S = await stage(W, sam, near, 'rifle'); const met: number[] = []; WALLPEN_HOOKS.crossed = (_g: any, x: any) => met.push(x.index); fireWeapon(g, S.pc, chestOf(S.gd.char), true); WALLPEN_HOOKS.crossed = null; line(S.gd.state === 'dead' && !met.includes(P.index), `a man on the NEAR side of the partition takes the round: he is down and the partition never heard of it (crossed on the way to him: ${met.length ? met.join(', ') : 'nothing'})`); }
      else line(true, 'near-side line skipped: no floor a pace further back from the staged partition');
      const W2 = await world(true); const g2 = W2.game; const pressed: Vec3 = [P.b.c[0] - P.n[0] * (P.half + 0.32), 0, P.b.c[2] - P.n[2] * (P.half + 0.32)];
      const S2 = await stage(W2, P.A, pressed, 'rifle'); const met2: number[] = []; WALLPEN_HOOKS.crossed = (_g: any, x: any) => met2.push(x.index); fireWeapon(g2, S2.pc, chestOf(S2.gd.char), true); WALLPEN_HOOKS.crossed = null;
      line(S2.gd.state === 'dead' && met2.includes(P.index), 'a man pressed to the FAR face is hit through it');
    }
    // a showcase running: inert
    { const W = await world(true); const g = W.game; g.touring = true; const live = wallPenLive(g), p = thinPath(g, P.from, P.d, 30, rifle); g.touring = false; line((BREAK || !live) && WALLPEN.on === !BREAK, `a showcase on the stage: the rule is inert (live ${live}) — fireWeapon then never asks the flight (${p ? 'the pure flight still answers when asked' : 'no flight'})`); }
    // recordings: the table rides; a file from before it replays with the rule off
    {
      const W = await world(true); const g = W.game; const snap = knobsSnapshot(g); const has = !!snap.tables.WALLPEN && (snap.tables.WALLPEN as any).on === !BREAK;
      WALLPEN.on = false; applyKnobs(g, snap); const back = WALLPEN.on;
      const old = JSON.parse(JSON.stringify(snap)); delete old.tables.WALLPEN; WALLPEN.on = true; applyKnobs(g, old); const older = WALLPEN.on;
      line(has && back === !BREAK && older === false, `a recording carries the switch (its WALLPEN row ${has ? 'is there' : 'is MISSING'}; put back: ${back}) and one from before the table replays with it off (${older})`);
    }
    void GLASSPEN;
  } catch (err) { line(false, `threw: ${(err as Error)?.stack ?? err}`); }
  finally { WALLPEN.on = was; WALLPEN_HOOKS.crossed = null; }
  console.log(failed ? '=== wallpen-check: FAIL ===' : '=== wallpen-check: ALL PASS ===');
  return !failed;
}
if (import.meta.main) process.exit((await wallpenCheck()) ? 0 : 1);
