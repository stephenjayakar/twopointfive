// GUNFIRE SPLINTERS A WOODEN DOOR LEAF APART (src/game/doorblast.ts DOORSHOT; the maintainer: 'doors should splinter apart on sustained gunfire (at least
// no slower than drywall)').
//   bun run tools/qa/doorshot-check.ts        (or: bun run tools/qa/probes.ts doorshot)        exit 0 = every line PASS, 1 = a FAIL line
// Headless, on the office, real rounds from Sam's guns (combat.ts fireWeapon); nothing here looks at a picture. The rule and the destruction switch are set
// by the check itself on either stand (the frozen stand holds both off).
//   yardstick   rifle rounds into one stretch of a plasterboard partition until the wall engine opens it: the count a door may not exceed
//   rifle       the same gun into a shut wooden leaf: it hangs to the round before, goes on the round the wall engine's number says, and that is no more
//               than the yardstick; then it is a door off its hinges — no leaf in the frame to a sight line, its sound seal gone, pieces thrown, the lock
//               rail lying flat by the frame with the handles on it, every thrown piece wood to the break table (on the shipped stand: dressed, a
//               snapped outline); rounds into the rail on the floor count nothing
//   pressed     a pistol from 0.42 m: the same count, whether the stand draws the gun back or lets the muzzle through the leaf (combat.ts wallAcrossArm)
//   pistol      a pistol round counts as it does on a wall (WALLS.pistolK)
//   faces       rounds into one face, then the other: one count
//   steel       a steel door hangs through three times the rounds
//   off         the rule off: a wooden leaf hangs through three times the rounds and counts nothing (the build as it was)
//   checkpoint  a leaf two rounds short, saved and loaded into a fresh game, goes on the second round; a leaf in pieces, saved and loaded, lies where it lay
//   journal     a recording from before the table replays with the rule off; one that carries it keeps its own word
// DOORSHOT_BREAK=1: the rule is left off where the lines want it on — red.
type Vec3 = [number, number, number];
const BREAK = process.env.DOORSHOT_BREAK === '1';

export async function doorshotCheck(): Promise<boolean> {
  const { standUp, ROOT } = await import('./headless.ts');
  const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
  const { DOORSHOT, DOORSHOT_STATS, leafTough } = await import(`${ROOT}/src/game/doorblast.ts`);
  const { BoxFlag } = await import(`${ROOT}/src/scene/boxes.ts`);
  const { DESTRUCTION } = await import(`${ROOT}/src/game/destructionSwitch.ts`);
  const { WALLS } = await import(`${ROOT}/src/game/wallbreak.ts`);
  const { thinThing } = await import(`${ROOT}/src/game/wallpen.ts`);
  const { fireWeapon, armThrough } = await import(`${ROOT}/src/game/combat.ts`);
  const { COVERFIRE } = await import(`${ROOT}/src/game/coverfire.ts`);
  const { saveState, loadState } = await import(`${ROOT}/src/game/savestate.ts`);
  const { knobsSnapshot, applyKnobs } = await import(`${ROOT}/src/game/journal.ts`);
  const DT = 1 / 60, CHAOS = 0.5, SHIPPED = process.env.TPS_PROFILE === 'shipped'; const f2 = (x: number) => x.toFixed(2);
  let failed = false; const line = (ok: boolean, s: string) => { if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}`); };
  const quiet = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => {}; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
  const was = DOORSHOT.on, destr0 = DESTRUCTION.on;
  const thinN = (b: any): Vec3 => { const cs = Math.cos(b.yaw), sn = Math.sin(b.yaw); return b.h[0] < b.h[2] ? [cs, 0, -sn] : [sn, 0, cs]; };
  const park = (g: any) => g.guards.forEach((o: any, i: number) => { o.hold = true; o.pinned = true; o.dazzledUntil = 1e9; o.heardUpTo = 1e12; o.char.pos = [37.5, 0, 25 + i * 1.2]; o.char.vel = [0, 0, 0]; o.path = []; o.pathGoal = null; o.flashlight.enabled = false; o.char.update(0); });
  /** a fresh office with walls that break, the rule as asked, everybody parked */
  const world = async (on: boolean) => {
    DESTRUCTION.on = true; const W: any = await quiet(() => standUp()); const g = W.game; DESTRUCTION.on = true; DOORSHOT.on = on && !BREAK;   // AFTER standUp: the stand-up line would otherwise write them back
    g.godMode = true; g.aiEnabled = false; g.playerInvisible = true; g.infiniteAmmo = true; g.tune.chaos = CHAOS; park(g);
    return W;
  };
  const stage = async (W: any, sam: Vec3, slot: 'pistol' | 'rifle', aim: Vec3) => {   // (he faces what he fires at: the cursor on it while he settles)
    const g = W.game; g.teleportPlayer(v3.copy(sam)); const pl = g.player; pl.slot = slot; pl.holstered = false; for (let i = 0; i < 90; i++) { W.cursorAt(aim); W.step(DT); }
    return { pc: pl.char, def: (pl.gunInHand() ?? pl.pistol).def };
  };
  const free = (g: any, p: Vec3) => !g.col.nav.isBlocked(p[0], p[2]);
  /** the first upright thing of `boxes` with floor `off` m out from both its faces at its middle and nothing else on the line across it */
  const across = (g: any, boxes: { b: any; index: number; name?: string }[], off: number) => {
    for (const { b, index, name } of boxes) {
      const n = thinN(b), half = Math.min(b.h[0], b.h[2]); const y = 1.2;
      const A: Vec3 = [b.c[0] + n[0] * (half + off), 0, b.c[2] + n[2] * (half + off)], B: Vec3 = [b.c[0] - n[0] * (half + off), 0, b.c[2] - n[2] * (half + off)];
      if (!free(g, A) || !free(g, B)) continue;
      const from: Vec3 = [A[0], y, A[2]], d: Vec3 = [-n[0], 0, -n[2]]; const h = g.col.raycast(from, d, 2 * (half + off));
      if (!h || h.index !== index || Math.abs(h.t - off) > 0.02) continue;
      const h2 = g.col.raycast([b.c[0] - n[0] * (half + 0.01), y, b.c[2] - n[2] * (half + 0.01)], d, off + 0.4); if (h2) continue;
      if (g.props.raycast(from, d, 2 * (half + off) + 0.4)) continue;
      return { b, index, name, n, half, A, B, at: [B[0], 1.25, B[2]] as Vec3 };
    }
    return null;
  };
  const doorsOf = (g: any) => g.doors.list.map((d: any, i: number) => ({ d, b: d.box, index: 1e6 + g.col.dynamicBoxes.indexOf(d.box), name: d.def.name as string, i }));
  const needOf = (k: number) => Math.ceil(leafTough() / (k * CHAOS * 2) - 1e-9);
  /** rounds from `pc` at `at` until door `d` is off its hinges, at most `cap`: [the count, or −1] */
  const until = (g: any, pc: any, at: Vec3, d: any, cap: number): [number] => { for (let n = 1; n <= cap; n++) { fireWeapon(g, pc, at, true); if (d.off) return [n]; } return [-1]; };

  try {
    // ------------------------------------------------------------ what the level holds
    const W0 = await world(true); const g0 = W0.game;
    const statics = g0.col.boxes.map((b: any, index: number) => ({ b, index }));
    const tall = (b: any) => b.c[1] - b.h[1] <= 0.1 && b.c[1] + b.h[1] >= 2.2;
    const parts = statics.filter(({ b, index }: any) => tall(b) && thinThing(g0, index)?.stuff === 'drywall' && Math.max(b.h[0], b.h[2]) >= 1);
    const shut = (x: any) => !x.d.off && Math.abs(x.d.angle) < 0.02;
    const P = across(g0, parts, 1.6), D = across(g0, doorsOf(g0).filter((x: any) => !x.d.def.steel && shut(x)), 1.4), S = across(g0, doorsOf(g0).filter((x: any) => x.d.def.steel && shut(x)), 1.4);
    line(!!P && !!D, `the office has a plasterboard partition and a shut wooden door with floor both sides to fire across (${P ? 'partition found' : 'NO PARTITION'}, ${D ? `door '${D.name}'` : 'NO DOOR'}${S ? `, steel door '${S.name}'` : ', no steel door with floor both sides'})`);
    if (!P || !D) throw new Error('nothing to fire at');
    const door = (g: any) => g.doors.byName(D.name), need = needOf(1);

    // ------------------------------------------------------------ yardstick: the drywall's own count
    let wall = -1;
    { const st = await stage(W0, P.A, 'rifle', P.at), g = g0, Bk = g.destr.walls.breakableAt(P.index), s0 = g.destr.walls.serial;
      for (let n = 1; n <= 20 && wall < 0; n++) { fireWeapon(g, st.pc, P.at, true); if ((g.destr.walls.since(s0) ?? []).some((r: any) => r.id === Bk?.id && r.kind !== 'reset')) wall = n; }
      line(wall > 0, `the yardstick: a rifle into one stretch of plasterboard opens it on round ${wall} (the wall engine's table says ${Math.ceil(WALLS.tough.drywall / (CHAOS * 2))} at chaos ${CHAOS})`); }

    // ------------------------------------------------------------ rifle
    { const W = await world(true), g = W.game, d = door(g), st = await stage(W, D.A, 'rifle', D.at), c0 = DOORSHOT_STATS.chunks + DOORSHOT_STATS.demoted, deb0 = g.destr.debris.list.length;
      const seal0 = !!(d.box.flags & BoxFlag.SoundSeal), eyeA: Vec3 = [D.A[0], 1.2, D.A[2]], eyeB: Vec3 = [D.B[0], 1.2, D.B[2]], blocked0 = g.col.segmentBlocked(eyeA, eyeB);
      const [n] = until(g, st.pc, D.at, d, 3 * need);
      line(n === need && n <= wall, `a rifle into the shut wooden leaf '${D.name}': it hangs through round ${need - 1} and goes on round ${n} (want ${need}: the wall engine's number for plasterboard or less) — no slower than the drywall's ${wall}`);
      const b = d.box, top = b.c[1] + b.h[1], pieces = DOORSHOT_STATS.chunks + DOORSHOT_STATS.demoted - c0, deb = g.destr.debris.list.length - deb0, hb = d.handleBoxes as any[];
      const ru = [Math.cos(-b.yaw), Math.sin(-b.yaw)];   // (the rail's own axes on the floor: its width along ru, its length across it)
      const onRail = hb.every(h => { const x = h.c[0] - b.c[0], z = h.c[2] - b.c[2]; return Math.abs(x * ru[0] + z * ru[1]) + 0.06 <= b.h[0] + 0.006 && Math.abs(-x * ru[1] + z * ru[0]) <= b.h[2] + 0.005 && h.c[1] < 0.2; });   // (0.06: the lever's half length along the rail's width)
      const mine = (g.destr.debris.list as any[]).slice(deb0), tagged = mine.filter(c => c.mat), wood = tagged.every(c => c.mat.mat === 'wood'), cutN = mine.filter(c => c.box.cut).length;
      const cells = Math.max(1, DOORSHOT.strips) * Math.max(1, DOORSHOT.lengths) - 1;
      line(n > 0 && d.off && !d.latched && !d.locked && Math.abs(Math.abs(d.angle) - Math.PI / 2) < 1e-6 && blocked0 && !g.col.segmentBlocked(eyeA, eyeB) && seal0 && !(b.flags & BoxFlag.SoundSeal),
        `then it is a door off its hinges: off ${d.off}, reads wide open (${f2(d.angle)} rad), unlatched, no lock · the line across the frame at 1.2 m was blocked ${blocked0}, is blocked ${g.col.segmentBlocked(eyeA, eyeB)} · its sound seal was ${seal0}, is ${!!(b.flags & BoxFlag.SoundSeal)}`);
      line(pieces === cells && deb === Math.min(cells, DOORSHOT.chunks) && !!d.slab?.bits && d.slab.rest && top < 0.12 && b.h[0] < d.leafH[0] && b.h[2] < d.height / 2 && onRail,
        `it went in pieces: ${pieces} thrown (${deb} as rigid debris in the pool), and what is left is the lock rail lying flat — ${f2(b.h[0] * 2)} × ${f2(b.h[2] * 2)} m, its top ${f2(top)} m off the floor, ${f2(Math.hypot(b.c[0] - d.frameCentre[0], b.c[2] - d.frameCentre[2]))} m from the frame's middle, both handles whole inside its outline ${onRail}`);
      line(SHIPPED ? tagged.length === deb && wood && cutN === deb : tagged.length === 0 || wood,
        `the thrown pieces are wood to the break table whatever the leaf's paint (${tagged.length} of ${deb} tagged${tagged.length ? `, all wood ${wood}` : ': the cut-box rule is off on this stand'}), ${cutN} of them with a broken outline${SHIPPED ? '' : ' (this stand: nothing to dress, or dressed as wood)'}`);
      for (let i = 0; i < 180; i++) W.step(DT);
      const moving = g.destr.debris.list.filter((c: any) => !c.rest).length, up = g.destr.debris.list.filter((c: any) => c.box.c[1] >= 0.3).length;   // (a plank that came to rest on its end, propped on something: the debris solver lets one stand)
      line(d.off && moving === 0 && up <= 1, `three seconds on: every piece is still (${moving} moving) and down on the floor but ${up} (at most one may have come to rest on its end), the door still off`);
      const rail = [b.h[0], b.h[2], b.c[0], b.c[2]].join(); fireWeapon(g, st.pc, D.at, true);
      for (let i = 0; i < 3 * need; i++) fireWeapon(g, st.pc, [b.c[0], 0.03, b.c[2]], true);
      line(d.off && d.shot === 0 && [b.h[0], b.h[2], b.c[0], b.c[2]].join() === rail, `a round through the empty frame and ${3 * need} into the rail on the floor count nothing: the rail lies as it lay`); }

    // ------------------------------------------------------------ the gun pressed to the leaf
    { const W = await world(true), g = W.game, d = door(g), near: Vec3 = [D.b.c[0] + D.n[0] * (D.half + 0.42), 0, D.b.c[2] + D.n[2] * (D.half + 0.42)], st = await stage(W, near, 'pistol', D.at), want = needOf(WALLS.pistolK);
      const pressed = armThrough(g, st.pc), m = st.pc.muzzle, gap = (m[0] - D.b.c[0]) * D.n[0] + (m[2] - D.b.c[2]) * D.n[2] - D.half; const [n] = until(g, st.pc, D.at, d, 3 * want);
      const how = pressed ? `the muzzle THROUGH the leaf (${f2(-gap)} m past its face: the round is born beyond it and the leaf is charged at the arm, as a wall is)` : `the muzzle ${f2(gap)} m short of the leaf (this stand draws a gun back from a wall)`;
      if (pressed && !COVERFIRE.on) console.log(`  (this stand: ${how}, and a round fired so counts nothing on a wall either — COVERFIRE off; the leaf ${n < 0 ? 'hangs' : `went on round ${n}`})`);
      else line(n === want && (SHIPPED || pressed), `a pistol from 0.42 m, facing the leaf, ${how}: it goes on round ${n} (want ${want}${SHIPPED ? '' : '; this stand must show the muzzle through'})`); }

    // ------------------------------------------------------------ pistol
    { const W = await world(true), g = W.game, d = door(g), st = await stage(W, D.A, 'pistol', D.at), want = needOf(WALLS.pistolK);
      const [n] = until(g, st.pc, D.at, d, 3 * want);
      line(st.def.cls === 'pistol' && n === want, `a pistol (${st.def.cls}): the leaf goes on round ${n} (want ${want}: a pistol round counts ${WALLS.pistolK}, as it does on a wall)`); }

    // ------------------------------------------------------------ both faces, one count
    { const W = await world(true), g = W.game, d = door(g), a = Math.floor(need / 2); let st = await stage(W, D.A, 'rifle', D.at);
      for (let i = 0; i < a; i++) fireWeapon(g, st.pc, D.at, true);
      const mid = !d.off; st = await stage(W, D.B, 'rifle', [D.A[0], 1.25, D.A[2]]); const [n] = until(g, st.pc, [D.A[0], 1.25, D.A[2]], d, 3 * need);
      line(mid && n === need - a, `${a} rounds into one face, then the other: it goes on round ${n} from there (want ${need - a}: one count for the leaf)`); }

    // ------------------------------------------------------------ steel
    if (S) { const W = await world(true), g = W.game, d = g.doors.byName(S.name), st = await stage(W, S.A, 'rifle', S.at); const [n] = until(g, st.pc, S.at, d, 3 * need);
      line(n < 0 && !d.off && d.shot === 0, `the steel door '${S.name}': ${3 * need} rifle rounds and it hangs, nothing counted`); }
    else line(false, 'no steel door on this level with floor both sides to fire across: the steel rule is not shown');

    // ------------------------------------------------------------ the rule off
    { const W = await quiet(() => world(false)), g = W.game; DOORSHOT.on = false; const d = door(g), st = await stage(W, D.A, 'rifle', D.at); const [n] = until(g, st.pc, D.at, d, 3 * need);
      line(n < 0 && !d.off && d.shot === 0 && !d.slab, `the rule off: ${3 * need} rifle rounds into the wooden leaf and it hangs, nothing counted — the build as it was`); }

    // ------------------------------------------------------------ checkpoints
    { const W = await world(true), g = W.game, d = door(g), st = await stage(W, D.A, 'rifle', D.at);
      for (let i = 0; i < need - 2; i++) fireWeapon(g, st.pc, D.at, true);
      const s1 = JSON.parse(JSON.stringify(saveState(g))), took = d.shot;
      const W2 = await world(true), g2 = W2.game; await quiet(() => loadState(g2, s1)); DOORSHOT.on = !BREAK; g2.tune.chaos = CHAOS; const d2 = door(g2);
      const got = d2.shot, carried = took > 0 && got === took, st2 = { pc: g2.player.char }; const [n] = until(g2, st2.pc, D.at, d2, 3 * need);
      line(need > 2 && !d.off && carried && n === 2, `a leaf two rounds short (${took} of ${leafTough()}), saved and loaded into a fresh game: the loaded leaf's count is ${got} and it goes on round ${n} (want 2)`);
      const s2 = JSON.parse(JSON.stringify(saveState(g2))), c = [...d2.box.c], h = [...d2.box.h], k = d2.handleBoxes.map((x: any) => [...x.c]);
      const W3 = await world(true), g3 = W3.game; await quiet(() => loadState(g3, s2)); const d3 = door(g3), dc = Math.hypot(d3.box.c[0] - c[0], d3.box.c[1] - c[1], d3.box.c[2] - c[2]), dh = Math.hypot(d3.box.h[0] - h[0], d3.box.h[1] - h[1], d3.box.h[2] - h[2]), dk = Math.max(...d3.handleBoxes.map((x: any, i: number) => Math.hypot(x.c[0] - k[i][0], x.c[1] - k[i][1], x.c[2] - k[i][2])));
      line(d2.off && d3.off && !!d3.slab?.bits && dc < 1e-3 && dh < 1e-3 && dk < 1e-3 && !g3.col.segmentBlocked([D.A[0], 1.2, D.A[2]], [D.B[0], 1.2, D.B[2]]), `a leaf in pieces, saved and loaded: off ${d3.off}, its lock rail lies where it lay (${f2(dc * 1000)} mm off, the same size ${dh < 1e-3}, its handles ${f2(dk * 1000)} mm off), the frame open to a sight line`); }

    // ------------------------------------------------------------ the journal
    { const g = g0, snap = () => JSON.parse(JSON.stringify(knobsSnapshot(g)));
      DOORSHOT.on = true; const old = snap(); delete old.tables.DOORSHOT; applyKnobs(g, old); const before = DOORSHOT.on;
      DOORSHOT.on = false; const own = snap(); own.tables.DOORSHOT.on = true; applyKnobs(g, own); const carried = DOORSHOT.on;
      line(before === false && carried === true, `a recording from before the table replays with the rule off (journal.ts applyKnobs): ${before} · one that carries it keeps its own word: ${carried}`); }
  } catch (err) { line(false, `threw: ${(err as Error)?.stack ?? err}`); }
  finally { DOORSHOT.on = was; DESTRUCTION.on = destr0; }
  console.log(failed ? '=== doorshot-check: FAIL ===' : '=== doorshot-check: ALL PASS ===');
  return !failed;
}
if (import.meta.main) process.exit((await doorshotCheck()) ? 0 : 1);
