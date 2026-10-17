// THROWN THINGS BOG DOWN IN LYING SNOW (src/game/snowBog.ts SNOWBOG; the item step: src/game/throwables.ts; the men's forecast of it: src/game/frag.ts rollOn).
// PLAY, not picture: this switch moves where a grenade stops on a snow level.
//
//   bun run tools/qa/snowbog-check.ts [--verbose]      exit 0 = all pass, 1 = a FAIL line
//   SNOWBOG_BREAK=1 …   = the switch never raised and the same lines asked: must fail
//   bun run tools/qa/probes.ts snowbog      (also under `snow` and `weather`)
//   Run it on BOTH stands (TPS_PROFILE=shipped in front for the page's): it puts the switch where each line needs it by the stand's own word, TPS_SNOWBOG.
//
//   stands    held off on the frozen stand, TPS_SNOWBOG=1 raises it, on as the page opens; the FROZEN_HOLDS row; the knob registry and a recording carry the
//             table; a recording with no SNOWBOG table replays with it off
//   bog       a grenade lobbed onto the pass's open snow: with the switch on it stops within a stride of where it first touched; off it bounces and skids on
//   road      on the trodden snow of the road it goes further than in deep snow and less far than on a floor
//   where     under a roof (the tea room's floor) the same throw ends where it did with the switch off, to the bit; and on a level with no snow
//   guess     the men's forecast of where a live grenade will rest (frag.ts fragRestGuess) lands on where it does rest, on snow, with the switch on
//   off       the switch off: the throw is the build's before the hook, to the bit (the pool with no bog asked at all)
import { standUp, ROOT } from './headless.ts';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DT = 1 / 60;

export async function snowBogCheck(o: { verbose?: boolean } = {}): Promise<boolean> {
  const { SNOW } = await import(`${ROOT}/src/game/weatherKinds.ts`);
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { SNOWBOG, snowBogAt } = await import(`${ROOT}/src/game/snowBog.ts`);
  const { fragRestGuess, FRAG } = await import(`${ROOT}/src/game/frag.ts`);
  const { throwFlight } = await import(`${ROOT}/src/game/throwplan.ts`);
  const { squadArcTo } = await import(`${ROOT}/src/game/squadsmoke.ts`);
  const { SQUADTHROW } = await import(`${ROOT}/src/game/squadthrow.ts`);
  const { snowPaintOf } = await import(`${ROOT}/src/render/snowField.ts`);
  const { knobRegistry, JOURNAL_KNOBS } = await import(`${ROOT}/src/game/knobs.ts`);
  const { FROZEN_HOLDS, harnessProfile } = await import(`${ROOT}/src/host/profile.ts`);
  const JOURNAL = await import(`${ROOT}/src/game/journal.ts`);
  const BREAK = process.env.SNOWBOG_BREAK === '1';
  const quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { if (o.verbose) return await fn(); const l = console.log, e = console.error, w = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = l; console.error = e; console.warn = w; } };
  let fails = 0, checks = 0;
  const verdict = (ok: boolean, label: string, detail: string) => { checks++; if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  const was = { snow: SNOW.on, on: SNOWBOG.on, envSnow: process.env.TPS_SNOW, envBog: process.env.TPS_SNOWBOG, rest: FRAG.restProps };

  /** a game stood up on `file`, in snow, the bog's switch where `on` says by the stand's own word (`word` false: no word at all — the stand as it is) */
  async function rig(file: string, on: boolean, word = true) {
    const sw = on && !BREAK;
    process.env.TPS_SNOW = '1';
    if (word) { process.env.TPS_SNOWBOG = sw ? '1' : '0'; SNOWBOG.on = !sw; } else { delete process.env.TPS_SNOWBOG; SNOWBOG.on = harnessProfile() === 'shipped' ? was.on : true; }
    const lvl = loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8')));
    const W: any = await quiet(() => standUp({ level: lvl, seed: 7 }));
    const stood: boolean = SNOWBOG.on; SNOWBOG.on = sw;
    return { W, g: W.game, stood, sw };
  }
  /** a frag lobbed from `from` at 45° along +x at `v` m/s (no fuse to speak of: it is only the body), stepped by the pool alone until it rests: where it first
   *  touched, where it stopped, how many times it bounced, and the men's forecast made the frame after its first touch */
  const lob = (R: Awaited<ReturnType<typeof rig>>, from: [number, number, number], v = 6, raw = false) => {
    const items = R.g.items; const had = items.bog; if (raw) items.bog = null; SNOWBOG.on = R.sw;
    const it = items.spawn('frag', from, [v * 0.72, v * 0.7, 0], { fuse: 60, life: 60 }); it.spin = 0; it.tumbleRate = 0;
    let first: number[] | null = null, guess: number[] | null = null, n = 0;
    for (; n < 600 && !it.settled; n++) { items.update(DT, R.g); if (!first && it.bounces > 0) { first = [...it.pos]; guess = [...fragRestGuess(R.g, it)]; } }
    const at = [...it.pos]; items.items.splice(items.items.indexOf(it), 1); items.bog = had;
    return { first: first ?? at, at, bounces: it.bounces, frames: n, rested: it.settled, guess: guess ?? at, ran: first ? Math.hypot(at[0] - first[0], at[2] - first[2]) : 0, miss: guess ? Math.hypot(at[0] - guess[0], at[2] - guess[2]) : NaN };
  };
  let YARD: [number, number, number] = [13, 1.2, 21], ROAD: [number, number, number] = [18, 1.2, 25];
  /** a lob's start whose whole landing run (3.5 to 6.5 m on along +x) reads `want` */
  const find = (g: any, want: (k: number) => boolean): [number, number, number] | null => { for (let z = 26.5; z >= 14; z -= 0.5) for (let x = 2; x <= 30; x += 0.5) { let ok = true; for (let d = 3.5; d <= 6.5 && ok; d += 0.25) ok = want(snowBogAt(g, x + d, 0, z)) && !g.col.solidBlocked([x, 1.2, z], [x + d, 0.3, z]); if (ok) return [x, 1.2, z]; } return null; };

  try {
    // ---- stands
    { const N = await rig('pass.json', true, false); const shipped = harnessProfile() === 'shipped'; const bare = N.stood;
      const J = await rig('pass.json', false); const U = await rig('pass.json', true); const row = FROZEN_HOLDS['SNOWBOG.on'];
      const inReg = knobRegistry().SNOWBOG === SNOWBOG, inJournal = JOURNAL_KNOBS.includes('SNOWBOG'); const snap = () => JSON.parse(JSON.stringify(JOURNAL.knobsSnapshot(J.g)));
      SNOWBOG.on = true; const carries = snap().tables.SNOWBOG?.on === true; const old = snap(); delete old.tables.SNOWBOG; await quiet(() => JOURNAL.applyKnobs(J.g, old)); const without = SNOWBOG.on;
      SNOWBOG.on = true; const own = snap(); SNOWBOG.on = false; await quiet(() => JOURNAL.applyKnobs(J.g, own)); const withIt = SNOWBOG.on;
      verdict(bare === shipped && J.stood === false && U.stood === true && typeof row === 'string' && /TPS_SNOWBOG=1/.test(row) && inReg && inJournal && carries && without === false && withIt === true,
        'stands — held off on the frozen stand, on as the page opens; the registry and a recording carry it; a recording from before it replays with it off',
        `this stand (${shipped ? 'shipped' : 'frozen'}) with no word: ${bare} · TPS_SNOWBOG=0 → ${J.stood}, =1 → ${U.stood} · FROZEN_HOLDS['SNOWBOG.on'] = ${row ? `'${row.slice(0, 13)}…'` : 'no row'} · in the knob registry: ${inReg}, a recording's names: ${inJournal}, its snapshot: ${carries} · applyKnobs with no SNOWBOG table → ${without}, with it on → ${withIt}`); }

    const On = await rig('pass.json', true), Off = await rig('pass.json', false);
    const f = (p: number[]) => `(${p[0].toFixed(2)}, ${p[2].toFixed(2)})`;
    // ---- bog, road
    { FRAG.restProps = false;   // (the forecast's own roll, not the loose furniture's part in it: before any lob is made)
      SNOWBOG.on = true; const fy = find(On.g, k => k === 1), fr = find(On.g, k => k > 0 && k < 1); if (fy) YARD = fy; if (fr) ROAD = fr;
      const k = snowBogAt(On.g, YARD[0] + 4, 0, YARD[2]), kr = snowBogAt(On.g, ROAD[0] + 4, 0, ROAD[2]); SNOWBOG.on = On.sw;
      const a = lob(On, YARD), b = lob(Off, YARD), r = lob(On, ROAD), rf = lob(Off, ROAD);
      verdict(!!fy && k === 1 && a.rested && b.rested && a.ran < 0.25 && b.ran > 0.8 && b.ran > a.ran * 4 && a.bounces < b.bounces,
        'bog — a grenade lobbed onto open snow stops within a stride of where it lands; with the switch off it bounces and skids on',
        `open snow found from (${YARD[0]}, ${YARD[2]}): the ground reads ${k} · on: first touch ${f(a.first)}, at rest ${f(a.at)}: ${a.ran.toFixed(2)} m on, ${a.bounces} bounces, ${a.frames} frames · off: ${b.ran.toFixed(2)} m on, ${b.bounces} bounces, ${b.frames} frames`);
      verdict(!!fr && kr > 0 && kr < 1 && r.rested && r.ran > a.ran && r.ran < rf.ran, 'road — on trodden snow it goes further than in deep snow, and less far than on a floor',
        `trodden snow found from (${ROAD[0]}, ${ROAD[2]}): the ground reads ${kr} · ${r.ran.toFixed(2)} m on from its landing (deep snow ${a.ran.toFixed(2)} m, the switch off ${rf.ran.toFixed(2)} m)`);
      // ---- guess (frag.ts rollOn — asked on the ROAD, where it still rolls: in deep snow it stops where it lands and any forecast would do)
      SNOWBOG.on = On.sw;
      const floorMiss = Math.hypot(r.at[0] - rf.guess[0], r.at[2] - rf.guess[2]);
      verdict(a.miss < 0.3 && b.miss < 0.3 && r.miss < 0.3 && rf.miss < 0.3 && floorMiss > 0.3, 'guess — the men\'s forecast of where it will rest lands on where it does, in deep snow, on trodden snow and with the switch off',
        `forecast at its first touch against where it stopped: deep snow ${a.miss.toFixed(2)} m off · trodden snow ${r.miss.toFixed(2)} m off (a floor's forecast would be ${floorMiss.toFixed(2)} m off there) · the switch off ${b.miss.toFixed(2)} m and ${rf.miss.toFixed(2)} m`);
      // ---- flight (throwplan.ts throwFlight, the squad's worked-out throw: the third copy of the pool's step)
      const fl = (R: typeof On, from: [number, number, number], real: { at: number[] }) => { SNOWBOG.on = R.sw; const F = throwFlight(R.g, 'frag', from, [6 * 0.72, 6 * 0.7, 0]); return Math.hypot(F.end[0] - real.at[0], F.end[2] - real.at[2]); };
      const fa = fl(On, YARD, a), fr2 = fl(On, ROAD, r), fFloor = fl(Off, ROAD, r); SNOWBOG.on = On.sw;
      verdict(fa < 0.15 && fr2 < 0.15 && fFloor > 0.3, 'flight — the throw a man works out beforehand ends where the thrown thing does, on deep and on trodden snow',
        `the flight's end against the real rest: deep snow ${fa.toFixed(2)} m · trodden snow ${fr2.toFixed(2)} m (flown as over a floor: ${fFloor.toFixed(2)} m off)`);
      // ---- squad (squadsmoke.ts squadArcTo: the solver's arc + its closed-form run-on, a frag's and a can's, ordered 5 and 7 m on)
      const gd: any = { char: { pos: [0, 0, 0], bones: {} } }; let worst = 0, worstFloor = 0, n = 0, none = 0; const said: string[] = [];
      for (const [name, p] of [['deep', YARD], ['trodden', ROAD]] as const) for (const [kind, rollK] of [['frag', SQUADTHROW.fragRollK], ['smoke', undefined]] as const) for (const dist of [5, 6]) {
        const at: [number, number, number] = [p[0] + dist - 1.5, 0, p[2]], stood: [number, number, number] = [p[0] - 1.5, 0, p[2]];
        const real = (R: typeof On, arc: any) => { SNOWBOG.on = R.sw; const it = R.g.items.spawn(kind, [...arc.from], [...arc.sol.v0], { fuse: 60, life: 60 }); it.spin = 0; it.tumbleRate = 0; for (let i = 0; i < 900 && !it.settled; i++) R.g.items.update(DT); const q = [...it.pos]; R.g.items.items.splice(R.g.items.items.indexOf(it), 1); return Math.hypot(q[0] - at[0], q[2] - at[2]); };
        SNOWBOG.on = true; const arc = squadArcTo(On.g, gd, at, rollK, stood); SNOWBOG.on = false; const arcF = squadArcTo(On.g, gd, at, rollK, stood); SNOWBOG.on = On.sw;
        if (!arc || !arcF) { none++; continue; }
        const m = real(On, arc), mf = real(On, arcF); n++; if (m > worst) worst = m; if (mf > worstFloor) worstFloor = mf; said.push(`${name} ${kind} ${dist} m: ${m.toFixed(2)}`);
      }
      SNOWBOG.on = On.sw;
      verdict(n >= 6 && worst < 0.35 && worstFloor > 0.8, 'squad — a teammate\'s ordered throw comes to rest on the spot ordered, on deep and on trodden snow',
        `${n} throws (${none} with no arc): the real rest off the ordered spot — ${said.join(' · ')} · the worst ${worst.toFixed(2)} m; aimed as for a floor, the worst ${worstFloor.toFixed(2)} m short`); }

    // ---- where
    { SNOWBOG.on = On.sw; const chair = [12.9, 10]; const roofed = On.g.weather.underRoof(chair[0], chair[1]); const kin = snowBogAt(On.g, chair[0], 0, chair[1]), khigh = snowBogAt(On.g, YARD[0], 0.9, YARD[2]);
      const a = lob(On, [chair[0] - 1, 1.2, chair[1]], 3), b = lob(Off, [chair[0] - 1, 1.2, chair[1]], 3);
      // a bank of snow that stands higher than a landing on the ground: its own top is snow to land in
      const bank = (On.g.level.boxes as any[]).find(b => snowPaintOf(b) === 'snow' && b.c[1] + b.h[1] > SNOWBOG.top + 0.1);
      // a landing a kerb's height up over open ground, where no snow box tops out near it: not the ground, not snow — nothing bogs
      SNOWBOG.on = On.sw; let kkerb = -1, kerbAt: number[] | null = null;
      for (let z = 26; z >= 14 && !kerbAt; z -= 0.5) for (let x = 3; x <= 30 && !kerbAt; x += 0.5) if (snowBogAt(On.g, x, 0, z) === 1 && !(On.g.level.boxes as any[]).some(b => snowPaintOf(b) === 'snow' && Math.abs(b.c[1] + b.h[1] - 0.25) <= SNOWBOG.bankM + 0.02 && Math.abs(b.c[0] - x) <= b.h[0] + b.h[2] && Math.abs(b.c[2] - z) <= b.h[0] + b.h[2])) kerbAt = [x, z];
      if (kerbAt) kkerb = snowBogAt(On.g, kerbAt[0], 0.25, kerbAt[1]);
      const kbank = bank ? snowBogAt(On.g, bank.c[0], bank.c[1] + bank.h[1], bank.c[2]) : -1, kover = bank ? snowBogAt(On.g, bank.c[0], bank.c[1] + bank.h[1] + 0.6, bank.c[2]) : -1;
      const C = await rig('compound.json', true); SNOWBOG.on = C.sw; const kc = snowBogAt(C.g, 20, 0, 14);
      verdict(roofed && kin === 0 && khigh === 0 && kkerb === 0 && kc === 0 && kbank === 1 && kover === 0 && a.at.every((v, i) => v === b.at[i]) && a.frames === b.frames,
        'where — under a roof, on a desk and on a level with no snow nothing bogs (the throw ends where it did, to the bit); snow that stands or lies higher up does',
        `the tea room at (${chair[0]}, ${chair[1]}) is under a roof: ${roofed}; its floor reads ${kin}, a landing 0.9 m up in the yard ${khigh}, one a kerb's height (0.25 m) up over open snow${kerbAt ? ` at (${kerbAt[0]}, ${kerbAt[1]})` : ' (NO such spot found)'} ${kkerb}, the compound's yard ${kc} · ${bank ? `snow standing or lying ${(bank.c[1] + bank.h[1]).toFixed(2)} m up reads ${kbank} at its top, 0.6 m over it ${kover}` : 'NO snow found off the ground'} · the same lob indoors, on ${f(a.at)} after ${a.frames} frames, off ${f(b.at)} after ${b.frames}`); }

    // ---- off
    { const a = lob(Off, YARD), b = lob(Off, YARD, 6, true), c = lob(Off, ROAD, 7), d = lob(Off, ROAD, 7, true);
      const same = (p: any, q: any) => p.at.every((v: number, i: number) => v === q.at[i]) && p.frames === q.frames && p.bounces === q.bounces;
      verdict(Off.sw === false && same(a, b) && same(c, d), 'off — with the switch off a throw is the pool\'s own, to the bit', `the yard: ${f(a.at)} after ${a.frames} frames, the pool with no bog asked: ${f(b.at)} after ${b.frames} · the road: ${f(c.at)} / ${f(d.at)}`); }
  } finally {
    SNOW.on = was.snow; SNOWBOG.on = was.on; FRAG.restProps = was.rest;
    if (was.envSnow === undefined) delete process.env.TPS_SNOW; else process.env.TPS_SNOW = was.envSnow;
    if (was.envBog === undefined) delete process.env.TPS_SNOWBOG; else process.env.TPS_SNOWBOG = was.envBog;
  }
  console.log(`\nsnowbog: ${checks - fails}/${checks} pass${BREAK ? ' (SNOWBOG_BREAK=1: the switch never raised — must fail)' : ''}`);
  return fails === 0;
}

if (import.meta.main) { const ok = await snowBogCheck({ verbose: process.argv.includes('--verbose') }); process.exit(ok ? 0 : 1); }
