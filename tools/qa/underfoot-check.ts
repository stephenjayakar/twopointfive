// WHAT THE WALK GRID CALLS FLOOR, FEET CROSS — the check behind UNDERFOOT.on (src/scene/collision.ts; on in the page, ?underfoot=0; off in the module and on
// the frozen stand, TPS_UNDERFOOT=1).
//   bun run tools/qa/probes.ts underfoot        (family `furnblast`)        UNDERFOOT_BREAK=1 = the rule off and the same lines asked: must FAIL
// the maintainer, 10-17, of two wall charges on the pass (levels/pass.json): "one set of guys couldn't pathfind through the wall breach". His tape: the pair at
// the store's wall were sent through their hole and walked on the spot at the wall's line until the tape ended. The store keeps sacks to the beams against that
// wall; the blast took the pile's upper layers and left the bottom one (two sacks, top 0.2 m) lying in the hole. The walk grid's bake asks from 0.25 m up, so
// the route went straight across them; a walking body was asked from 0.2 m up, and a top AT 0.2 is in that band.
// THE SITE: his own (the store's outer wall by the floor point 31.3, 5.0, set from the yard side), on a fresh stand of the level with the page's destruction
// switches: a charge set as the order sets it and blown as F blows it. Then: the grid's own way through the hole, and a body as wide as a man walked along it
// with the walkers' own collision call (guards.ts: radius 0.3, 0.2 to 1.5 m). And the level at rest: floor cells where that call is pushed by nothing but a
// thing lower than the bake's band (on the pass: the low step of a snow bank).
import { readFileSync } from 'node:fs';
import { standUp, ROOT } from './headless.ts';
type Vec3 = [number, number, number];
export async function underfootCheck(): Promise<boolean> {
  const BRK = process.env.UNDERFOOT_BREAK === '1'; let all = true;
  const verdict = (ok: boolean, what: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}\n    ${detail}`); };
  console.log(`\n=== underfoot: what the walk grid calls floor, feet cross${BRK ? ' (the rule off: must fail)' : ''} ===`);
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`); const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { UNDERFOOT } = await import(`${ROOT}/src/scene/collision.ts`);
  const { FURN } = await import(`${ROOT}/src/game/furnblast.ts`); const { DESTRUCTION, FURNBLAST } = await import(`${ROOT}/src/game/destructionSwitch.ts`);
  const { WALLCHARGE, wallAt } = await import(`${ROOT}/src/game/wallcharge.ts`); const JOURNAL = await import(`${ROOT}/src/game/journal.ts`) as any; const { pageSwitches } = await import(`${ROOT}/src/host/profile.ts`) as any; const { knobsCopy, knobsBack } = await import(`${ROOT}/src/game/knobs.ts`) as any; const knobs0 = knobsCopy();
  const was = { u: UNDERFOOT.on, d: DESTRUCTION.on, f: FURNBLAST.on, m: FURN.mouth.on, s: FURN.mouth.snow, w: WALLCHARGE.on, o: WALLCHARGE.outer }, log = console.log;
  const data = readFileSync(`${ROOT}/levels/pass.json`, 'utf8'), R = 0.3, Y0 = 0.2, Y1 = 1.5;
  const raise = (rule: boolean) => { UNDERFOOT.on = rule && !BRK; DESTRUCTION.on = true; FURNBLAST.on = true; FURN.mouth.on = true; FURN.mouth.snow = true; WALLCHARGE.on = true; WALLCHARGE.outer = true; };
  const stand = async (rule: boolean) => { raise(rule); console.log = () => { }; try { const W: any = await standUp({ level: loadLevel(parseLevelData(data)), seed: 1 }); raise(rule); const g = W.game; g.godMode = true; g.aiEnabled = false; g.tune.chaos = 0.5; for (let i = 0; i < 4; i++) W.step(1 / 60); return W; } finally { console.log = log; } };
  const top = (b: any) => b.c[1] + b.h[1], out = new Int32Array(64);
  /** floor cells of the grid where a walker's own call is pushed, and everything it touches there ends under the bake's band */
  const lowCells = (g: any): number => { const col = g.col, nav = col.nav, cs = nav.cell; let n = 0;
    for (let z = 0; z < nav.H; z++) for (let x = 0; x < nav.W; x++) { if (nav.blocked[nav.idx(x, z)]) continue; const px = (x + 0.5) * cs, pz = (z + 0.5) * cs, q: Vec3 = [px, 0, pz];
      if (!col.collideCircle(q, R, Y0, Y1, 1) || Math.hypot(q[0] - px, q[2] - pz) <= 0.005) continue;
      const was = UNDERFOOT.on; UNDERFOOT.on = false; const k = col.circleTouches(px, pz, R, Y0, Y1, out); UNDERFOOT.on = was;   // (what stands there, asked the old way so that the low things are listed)
      let low = k > 0; for (let j = 0; j < k; j++) if (top(col.boxes[out[j]]) >= UNDERFOOT.y) low = false; if (low) n++; }
    return n; };
  /** a body walked along the grid's way from A to B with the walkers' own call: how near B it ends, and how long the way was */
  const walk = (g: any, A: Vec3, B: Vec3) => { const col = g.col, path: Vec3[] | null = col.nav.findPath(A, B); if (!path) return { len: -1, end: Infinity, at: A };
    let len = Math.hypot(path[0][0] - A[0], path[0][2] - A[2]); for (let i = 1; i < path.length; i++) len += Math.hypot(path[i][0] - path[i - 1][0], path[i][2] - path[i - 1][2]);
    const p: Vec3 = [A[0], 0, A[2]]; let i = 0;
    for (let s = 0; s < 3000 && i < path.length; s++) { const w = path[i], dx = w[0] - p[0], dz = w[2] - p[2], d = Math.hypot(dx, dz); if (d < 0.15) { i++; continue; } p[0] += dx / d * 0.02; p[2] += dz / d * 0.02; col.collideCircle(p, R, Y0, Y1); }
    return { len, end: Math.hypot(p[0] - B[0], p[2] - B[2]), at: p }; };
  try {
    // (1) his breach: the store's outer wall, set from the yard
    const at: Vec3 = [31.3, 0, 5.0], from: Vec3 = [31.3, 0, 3.6], A: Vec3 = [31.25, 0, 3.75], B: Vec3 = [31.25, 0, 6.75];
    const blown = async (rule: boolean) => { const W = await stand(rule), g = W.game, col = g.col, w = wallAt(g, at, from); if (!w || !w.ok) return null;
      console.log = () => { }; let res: any; try { g.wallCharge.set.push({ wall: w, t: g.time, by: 'probe', paid: 0 }); res = g.wallCharge.blow(g.wallCharge.set[g.wallCharge.set.length - 1]); for (let i = 0; i < 60; i++) W.step(1 / 60); } finally { console.log = log; }
      const was = UNDERFOOT.on; UNDERFOOT.on = false; const k = col.circleTouches(at[0], at[2] + 0.5, 0.6, Y0, Y1, out); UNDERFOOT.on = was;
      const left = [...out.slice(0, Math.max(0, k))].filter(i => top(col.boxes[i]) < UNDERFOOT.y).map(i => top(col.boxes[i]).toFixed(2));
      return { W, g, hole: !!res?.hole, left, ...walk(g, A, B) }; };
    const on = await blown(true);
    if (!on) verdict(false, "the store's outer wall takes a charge where his was set", 'no wall place there: the level changed, and this check needs its site again');
    else {
      verdict(on.hole && on.len > 0 && on.len < 5, "his breach is a hole, and the walk grid goes straight through it", `the charge ${on.hole ? 'opened a hole' : 'did NOT open a hole'}; the grid's way from the yard to the store's floor is ${on.len < 0 ? 'NONE' : on.len.toFixed(1) + ' m'} (3 m apart in a line)`);
      verdict(on.end < 0.35, 'a man walked along that way gets through the hole', `ends ${on.end.toFixed(2)} m from the far point, at (${on.at[0].toFixed(2)}, ${on.at[2].toFixed(2)}) — the wall's line is z 5.0, the far point z 6.75. Lying in the hole under the bake's band: ${on.left.length ? on.left.length + ' thing(s), top ' + on.left.join(', ') + ' m' : 'nothing (the blast took it all: this line asks less than it did)'}`);
      // (2) the level at rest
      const rest = await stand(true), n = lowCells(rest.game);
      verdict(n === 0, 'on the pass at rest no floor cell stops a walker with a thing lower than the grid counts', `${n} cell(s) of the walk grid's floor where a man's own collision call is pushed by nothing over ${UNDERFOOT.y} m`);
      // (3) off is the build as it was; an old recording replays with it off
      const off = await blown(false);
      verdict(BRK || (!!off && (off.left.length ? off.end > 1 : off.end < 0.35)), 'with the rule off the same man is held at the wall where the blast left a thing in the hole, as on his tape (the page\'s stand leaves the pile\'s bottom layer; the frozen stand\'s blast takes the pile whole, and there he is through either way)', off ? `${off.left.length} thing(s) left under the band; ends ${off.end.toFixed(2)} m from the far point, at (${off.at[0].toFixed(2)}, ${off.at[2].toFixed(2)})` : 'no wall place');
      { const g = off?.g ?? on.g, snap = () => JSON.parse(JSON.stringify(JOURNAL.knobsSnapshot(g)));
        UNDERFOOT.on = true; const old = snap(); delete old.tables.UNDERFOOT; JOURNAL.applyKnobs(g, old); const without = UNDERFOOT.on;
        UNDERFOOT.on = true; const own = snap(); UNDERFOOT.on = false; JOURNAL.applyKnobs(g, own); const withIt = UNDERFOOT.on;
        let a: unknown = 'no pageSwitches', b: unknown = a; if (typeof pageSwitches === 'function') { pageSwitches(new URLSearchParams('')); a = UNDERFOOT.on; pageSwitches(new URLSearchParams('underfoot=0')); b = UNDERFOOT.on; }
        verdict(without === false && withIt === true && a === true && b === false, 'a recording from before the key replays with the rule off (journal.ts applyKnobs), one that carries it keeps it; the page opens with it on and ?underfoot=0 puts it off', `applyKnobs with no table → ${without} · with it → ${withIt} · the page → ${a} · ?underfoot=0 → ${b}`); }
    }
  } finally { console.log = log; knobsBack(knobs0); UNDERFOOT.on = was.u; DESTRUCTION.on = was.d; FURNBLAST.on = was.f; FURN.mouth.on = was.m; FURN.mouth.snow = was.s; WALLCHARGE.on = was.w; WALLCHARGE.outer = was.o; }
  return all;
}
