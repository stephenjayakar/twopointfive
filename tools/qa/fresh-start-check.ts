// A ROOM CLEAR DEALS A FRESH PLACEMENT EVERY VISIT — the check behind `ROOMCLEAR.fresh` (src/game/roomclear.ts).
// The fault it holds shut: a Missions row or a short-list pick carries no placement seed, so every page load of a room clear stood the same defenders on the
// same marks (seed 0 = the authored placement); only a restart inside the page dealt another. With the switch on, a start that names no seed on a Game that
// owns a die deals the placement of a seed read off that die's seed — the page's die is fresh per load, `?seed=N` pins it.
// SINCE EVERY MISSION STARTS THE SAME WAY ON EVERY TRY (src/game/samestart.ts, on in the page) this is the check of the deal BEHIND that switch — what the page
// plays under `?samestart=0`: every Game here is stood with `SAMESTART.on` false, on either stand. `tools/qa/samestart-check.ts` holds the switch itself.
//   bun run tools/qa/fresh-start-check.ts [--level compound.json]   ·   bun run tools/qa/probes.ts fresh-start (family roomclear)
// What it holds (the game stood up frozen, each Game its own die where a line says so):
//   1. off (the frozen stand's own): a start with no seed deals seed 0, attempt 1 = the authored placement, whatever die the Game owns
//   2. on: two Games on two dice deal two different placements, neither the authored one; the same die again deals the same placement
//   3. on, a Game with no die of its own (every harness tool unless it asks): the authored placement
//   4. on: a start that names its seed gets that seed — 0 included (the authored placement), and a Training row always names one
//   5. on: a restart deals the next placement of the same fresh seed
//   6. on or off, the Game's die stands where it stood (the seed is read, never drawn)
//   7. the knob `ROOMCLEAR.seed` is never written by a fresh start; a seed named while a fresh game is up wins (0 = the authored placement); stop then start
//      deals the fresh placement again; the switch flipped off and the floor restaged deals the authored one
//   8. the page's boot: the switch is on for an empty query and off under ?freshstart=0; FROZEN_HOLDS carries the row
//   9. THE WAY IN (a level with `roomClear.starts`; skipped with a note on one without): off, no die, a named seed, AND a fresh visit with the knob as
//      shipped (0) = the structure's own start — the way in is the player's pick, never dealt unasked; with the knob at −1 (`?way=any`) a fresh visit takes
//      the way of its die's seed (two dice, two ways on a level with two) and Sam stands on that start's mark; `ROOMCLEAR.way` ≥ 1 pins one whatever the seed
//      says and is clamped to the ways the level has; a restart keeps the way in; the page reads ?way=N and ?way=any; every mission row names as many
//      `ways` as its level file gives starts
//   FRESH_BREAK=1  the switch is left off where the lines above want it on: the check must FAIL (exit 1) — the proof that it can
// exit 0 = all hold · 1 = one does not · 2 = bad flags
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

export async function freshStartCheck(levelFile = 'compound.json'): Promise<boolean> {
  const { standUp, ROOT } = await import('./headless.ts');
  const { ROOMCLEAR, placeDefenders, freshSeedOf, freshWayOf } = await import(`${ROOT}/src/game/roomclear.ts`);
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`), { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { knobsCopy, knobsBack } = await import(`${ROOT}/src/game/knobs.ts`);
  const P = await import(`${ROOT}/src/host/profile.ts`);
  const { SAMESTART } = await import(`${ROOT}/src/game/samestart.ts`);
  const brk = process.env.FRESH_BREAK === '1', knobs0 = knobsCopy();
  SAMESTART.on = false;   // (the deal this check holds is the one under the switch: put back with every other table at the end)

  let failed = false, checks = 0;
  const line = (ok: boolean, s: string) => { checks++; if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}`); };
  const quiet = async <T>(f: () => Promise<T>): Promise<T> => { const l = console.log, w = console.warn; console.log = console.warn = () => { }; try { return await f(); } finally { console.log = l; console.warn = w; } };
  const levelOf = (file = levelFile) => loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8')));
  const marks = (pl: { room: string; mark: number }[]) => pl.map(p => `${p.room}:${p.mark}`).join(' ');
  /** a Game on `levelFile`, the room clear started from a knob at 0; what it dealt */
  async function deal(dice: number | null, fresh: boolean, seed?: number, way = 0, file = levelFile) {
    ROOMCLEAR.seed = 0; ROOMCLEAR.fresh = fresh && !brk; ROOMCLEAR.way = way;
    const W: any = await quiet(() => standUp({ uploadEvery: 4, level: levelOf(file), seed: dice }));
    SAMESTART.on = false;   // (after every stand-up: a stand that pins the switch — TPS_SAMESTART=1, the shipped boot — writes it as it stands a Game)
    const g = W.game, rc = g.roomClear, n0 = g.dice ? g.dice.n : -1;
    const why = await quiet(async () => rc.start(seed)); if (why) throw new Error(`the room clear did not start on ${file}: ${why}`);
    await quiet(async () => { for (let i = 0; i < 3; i++) W.step(1 / 60); });
    return { W, g, rc, seed: rc.seed as number, attempt: rc.attempt as number, marks: marks(rc.placement), n: g.dice ? g.dice.n - n0 : -1, knob: ROOMCLEAR.seed as number, structure: rc.structure,
      way: rc.way as number, sam: [g.player.char.pos[0], g.player.char.pos[2]] as [number, number] };
  }
  try {
    const A = await deal(7, false);
    const of = (seed: number, attempt: number) => marks(placeDefenders(seed, attempt, A.structure)), authored = of(0, 1);
    if (!A.structure.rooms.some((r: { marks: unknown[]; garrison: number }) => r.marks.length > r.garrison)) { console.log(`  (${levelFile} has no room with a spare mark: every placement is the same one — nothing to check)`); return false; }
    line(A.seed === 0 && A.attempt === 1 && A.marks === authored, `off: a Game on die 7 deals seed ${A.seed}, attempt ${A.attempt} — the authored placement`);

    const B = await deal(7, true), C = await deal(8, true), B2 = await deal(7, true);
    line(B.seed === freshSeedOf(7) && B.marks === of(B.seed, 1) && B.marks !== authored, `on: die 7 deals seed ${B.seed}'s first placement, not the authored one`);
    line(C.seed === freshSeedOf(8) && C.marks !== B.marks && C.marks !== authored, `on: die 8 deals seed ${C.seed} — another placement than die 7's and than the authored one`);
    line(B2.seed === B.seed && B2.marks === B.marks, 'on: die 7 again deals the same placement (?seed=N reproduces a visit)');
    line(B.knob === 0 && C.knob === 0, `a fresh start leaves the knob ROOMCLEAR.seed where it stood (${B.knob}): nothing a stand's knob table reads moves`);

    const D = await deal(null, true);
    line(D.seed === 0 && D.marks === authored, 'on, a Game with no die of its own: the authored placement (a harness tool that asks for no die is not touched)');

    const E = await deal(7, true, 3), F = await deal(7, true, 0);
    line(E.seed === 3 && E.marks === of(3, 1), 'on: a start that names seed 3 deals seed 3');
    line(F.seed === 0 && F.marks === authored, 'on: a start that names seed 0 deals the authored placement');

    // the same fresh game (B2, die 7) through what a visit can do to it — the knob put back to 0 first (E's start wrote 3)
    ROOMCLEAR.seed = 0; ROOMCLEAR.fresh = !brk;
    { const { g, W, rc } = B2, step = () => quiet(async () => { for (let i = 0; i < 3; i++) W.step(1 / 60); });
      await quiet(async () => g.restartEncounter()); await step();
      line(rc.seed === B.seed && rc.attempt === 2 && marks(rc.placement) === of(B.seed, 2), `on: a restart deals attempt 2 of the same fresh seed (${marks(rc.placement) === B.marks ? 'the same marks, by the dice' : 'other marks'})`);
      await quiet(async () => rc.start(3)); await step();
      line(rc.seed === 3 && marks(rc.placement) === of(3, 1), 'a seed named while the fresh game is up wins: seed 3, its first placement');
      await quiet(async () => rc.start(0)); await step();
      line(rc.seed === 0 && marks(rc.placement) === authored, '… and seed 0 named while it is up deals the authored placement');
      await quiet(async () => { rc.stop(); for (let i = 0; i < 3; i++) W.step(1 / 60); rc.start(); }); await step();
      line(rc.seed === B.seed && rc.attempt === 1 && marks(rc.placement) === B.marks, 'stopped and started again with no seed: the visit\'s fresh placement again');
      ROOMCLEAR.fresh = false; await quiet(async () => rc.restage()); await step();
      line(rc.seed === 0 && marks(rc.placement) === authored, 'the switch flipped off and the floor restaged: the authored placement');
      ROOMCLEAR.fresh = !brk; await quiet(async () => rc.restage()); await step();
      line(rc.seed === B.seed && marks(rc.placement) !== authored, '… flipped on again and restaged: the fresh seed again'); }

    line(A.n >= 0 && A.n === B.n, `the Game's die is read, not drawn: the start took ${A.n} rolls with the switch off and ${B.n} with it on`);

    // the way in
    { const S = A.structure as { team?: { sam: number[] }; starts?: { sam: number[] }[] }, n = S.team ? 1 + (S.starts?.length ?? 0) : 1;
      if (n < 2) console.log(`  (${levelFile} gives the team one way in: the way-in lines are skipped)`);
      else {
        const startOf = (k: number) => (k > 0 ? S.starts![k - 1] : S.team!).sam, on = (r: { sam: [number, number]; way: number }) => Math.hypot(r.sam[0] - startOf(r.way)[0], r.sam[1] - startOf(r.way)[2]) < 0.6;
        const dice: number[] = []; for (let d = 1; dice.length < 2 && d < 60; d++) if (freshWayOf(d, n) === dice.length) dice.push(d);   // a die for the first way and one for the second
        line(A.way === 0 && D.way === 0 && E.way === 0 && on(A) && on(E), `off, no die, a named seed: the structure's own start (Sam at ${A.sam.map(v => v.toFixed(1)).join(', ')})`);
        const K0 = await deal(dice[1], true);
        line(K0.way === 0 && on(K0) && K0.seed !== 0, `on, the knob as shipped (0): die ${dice[1]}, whose dealt way would be the second, still comes in by the structure's own start, on a fresh placement`);
        const G0 = await deal(dice[0], true, undefined, -1), G1 = await deal(dice[1], true, undefined, -1);
        line(G0.way === 0 && G1.way === 1 && on(G0) && on(G1) && Math.hypot(G0.sam[0] - G1.sam[0], G0.sam[1] - G1.sam[1]) > 2, `on, a dealt way asked for (the knob at -1): die ${dice[0]} comes in by way 1 and die ${dice[1]} by way 2 of ${n}; Sam stands on each start's mark (${G1.sam.map(v => v.toFixed(1)).join(', ')} for the second)`);
        const H = await deal(null, false, 3, 2), J = await deal(null, false, 3, 99), I = await deal(dice[1], true, undefined, 1);   // (I last: the last start to write Sam's knobs is one on the structure's OWN start, so the restart below has to move him itself)
        line(H.way === 1 && on(H) && H.marks === of(3, 1), 'ROOMCLEAR.way = 2 pins the second way in under a named seed, the defenders\' marks untouched');
        line(I.way === 0 && on(I), `ROOMCLEAR.way = 1 pins the structure's own start for a die whose fresh way is the second`);
        line(J.way === n - 1, `ROOMCLEAR.way = 99 is clamped to the last of the level's ${n} ways`);
        ROOMCLEAR.way = -1; ROOMCLEAR.seed = 0; ROOMCLEAR.fresh = !brk;   // (G1's visit asked for a dealt way: the knob stands at -1 for as long as its page would)
        const again = async () => quiet(async () => { G1.g.restartEncounter(); for (let i = 0; i < 3; i++) G1.W.step(1 / 60); });
        // where G1's team really stands: Sam AND every teammate against a start's own marks (they are read off two places — Sam's off the night breach's knobs)
        const stood = (k: number) => { const T = (k > 0 ? S.starts![k - 1] : S.team!) as { sam: number[]; ops?: number[][] }, p = G1.g.player.char.pos, ops = G1.g.nightBreach.ops as { char: { pos: number[] } }[];
          return Math.hypot(p[0] - T.sam[0], p[2] - T.sam[2]) < 0.6 && ops.length > 0 && ops.every((o, i) => !T.ops?.[i] || Math.hypot(o.char.pos[0] - T.ops[i][0], o.char.pos[2] - T.ops[i][2]) < 0.6); };
        await again();
        line(G1.rc.way === 1 && G1.rc.attempt === 2 && stood(1), 'a restart keeps the way in and deals the next placement: Sam and every teammate on the second start\'s marks, after another Game\'s start wrote Sam\'s knobs');
        const obj = G1.rc.objective()?.pos as number[] | null, held = (A.structure.rooms as { bounds: { x0: number; x1: number; z0: number; z1: number } }[]).map(r => Math.hypot((r.bounds.x0 + r.bounds.x1) / 2 - startOf(1)[0], (r.bounds.z0 + r.bounds.z1) / 2 - startOf(1)[2]));
        line(!!obj && Math.abs(Math.hypot(obj[0] - startOf(1)[0], obj[2] - startOf(1)[2]) - Math.min(...held)) < 0.01, 'on the second way in the objective marker stands on the held room nearest that start');
        ROOMCLEAR.fresh = false; await again(); const offWay = G1.rc.way, offOk = stood(0) && G1.rc.seed === 0;
        ROOMCLEAR.fresh = !brk; await again();
        line(offWay === 0 && offOk && G1.rc.way === 1 && stood(1), 'the switch thrown off mid-run: the next staging is the structure\'s own start on the authored placement; on again, the visit\'s way is back');
        await quiet(async () => { G1.rc.start(5); for (let i = 0; i < 3; i++) G1.W.step(1 / 60); });
        line(G1.rc.way === 0 && G1.rc.seed === 5 && stood(0), 'a seed named while a fresh run stands on the second way: restaged on the structure\'s own start');
        ROOMCLEAR.way = 0; ROOMCLEAR.seed = 0; ROOMCLEAR.fresh = !brk;
        P.pageSwitches(new URLSearchParams('way=2')); const w2 = ROOMCLEAR.way; P.pageSwitches(new URLSearchParams('way=any')); const wAny = ROOMCLEAR.way; P.pageSwitches(new URLSearchParams('')); const w0 = ROOMCLEAR.way; SAMESTART.on = false;
        line(w2 === 2 && wAny === -1 && w0 === 0, `the page's boot: ?way=2 pins the knob at ${w2}, ?way=any asks for a dealt one (${wAny}), an empty query leaves it ${w0}`);
        // the mission sheet's Way in row names the ways (scene/scenarioList.ts `ways`): as many as the level file gives starts, none where it gives one
        { const { ALL_MISSIONS } = await import(`${ROOT}/src/scene/scenarioList.ts`) as { ALL_MISSIONS: { id: string; kind: string; level?: string; ways?: string[] }[] }; const bad: string[] = [];
          for (const e of ALL_MISSIONS) { if (!e.level) { if (e.ways) bad.push(`${e.id}: names ways on the office`); continue; }
            const sc = JSON.parse(readFileSync(resolve(ROOT, 'levels', e.level), 'utf8')).scenarios?.roomClear as { team?: unknown; starts?: unknown[] } | undefined, has = e.kind === 'roomclear' && sc?.team ? 1 + (sc.starts?.length ?? 0) : 1;
            if ((e.ways?.length ?? 1) !== has || (e.ways && new Set(e.ways).size !== e.ways.length)) bad.push(`${e.id}: names ${e.ways?.length ?? 0} ways, ${e.level} gives ${has}`); }
          line(!bad.length, `every mission row names as many ways in as its level gives starts${bad.length ? ` — NOT: ${bad.join('; ')}` : ''}`); }
        // every OTHER level that gives a second way in: it stages (no gate plays one — a play-through names its seed and has no die)
        for (const f of ['compound.json', 'warehouse.json', 'barracks.json', 'depot.json', 'block.json', 'block-squads.json', 'records.json'].filter(f => f !== levelFile)) {
          const X = await deal(null, false, 3, 2, f), T = (X.structure as { starts?: { sam: number[]; ops?: number[][] }[] }).starts?.[0], ops = X.g.nightBreach.ops as { state: string; char: { pos: number[] } }[];
          await quiet(async () => { for (let i = 0; i < 120; i++) X.W.step(1 / 60); });
          line(!!T && X.way === 1 && Math.hypot(X.sam[0] - T.sam[0], X.sam[1] - T.sam[2]) < 0.6 && ops.length > 0 && ops.every((o, i) => o.state !== 'dead' && (!T.ops?.[i] || Math.hypot(o.char.pos[0] - T.ops[i][0], o.char.pos[2] - T.ops[i][2]) < 1.5)),
            `${f}: its second way in stages — Sam on its mark, ${ops.length} teammates by theirs and up two seconds on`);
        }
        ROOMCLEAR.way = 0; ROOMCLEAR.seed = 0; ROOMCLEAR.fresh = !brk;
      } }

    { P.pageSwitches(new URLSearchParams('')); const on = ROOMCLEAR.fresh; P.pageSwitches(new URLSearchParams('freshstart=0')); const off = ROOMCLEAR.fresh;
      line(on === true && off === false, `the page's boot: on for an empty query (${on}), off under ?freshstart=0 (${off})`);
      line(typeof P.FROZEN_HOLDS['ROOMCLEAR.fresh'] === 'string', 'src/host/profile.ts FROZEN_HOLDS names ROOMCLEAR.fresh'); }
  } finally { knobsBack(knobs0); }   // (pageSwitches wrote the page's whole boot: every table back as this check found it)
  return !failed && checks > 0;
}

if (import.meta.main) {
  const argv = process.argv.slice(2), flag = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  for (const a of argv) if (a.startsWith('--') && a !== '--level') { console.error(`unknown flag ${a} (--level)`); process.exit(2); }
  const ok = await freshStartCheck(flag('--level') ?? 'compound.json');
  console.log(ok ? '=== fresh-start-check: ALL PASS ===' : '=== fresh-start-check: FAILED ==='); process.exit(ok ? 0 : 1);
}
