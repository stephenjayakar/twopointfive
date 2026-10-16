// who faces whom on a squad map at a given second: can every defender be dropped while no living mate has him in his eyes (guards.ts bodySeen's range, cone, line)?
//   bun run tools/qa/quiet-facing.ts <map> <seedFrom> <seedTo> [atSeconds]
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { standUp, ROOT } from './headless.ts';
const [scn, a, b, atS] = process.argv.slice(2); const atT = Number(atS ?? 3);
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const { scenarioQuery } = await import(`${ROOT}/src/scene/scenarios.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const SQ = await import(`${ROOT}/src/game/enemysquads.ts`);
SQ.squadsFromQuery?.(new URLSearchParams('squads=radiocheck'));
const E = SCENARIOS.find((e: any) => e.id === scn); if (!E) throw new Error(`no scenario '${scn}'`);
const log = console.log; const hush = () => { console.log = console.error = console.warn = () => { }; }, unhush = () => { console.log = log; };
for (let seed = Number(a); seed <= Number(b); seed++) {
  Math.random = seeded(0x9137 + seed * 7919);
  hush(); const W: any = await standUp({ uploadEvery: 4, level: loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', E.level), 'utf8'))) });
  const g = W.game; g.godMode = true; g.tune.chaos = 0.5;
  const q = (scenarioQuery(E) as string).replace(/(^|[?&])roomclear(=\d+)?(?=&|$)/, `$1roomclear=${seed}`).replace(/&squad4\b/, '') + `&squad=0`;
  const { why } = startFromQuery(g, new URLSearchParams(q)); if (why) throw new Error(why);
  g.player.invisible = true; for (let i = 0; i < atT * 60; i++) W.step(1 / 60); unhush();
  const H: any[] = g.guards.filter((x: any) => x.team === 'hostile' && x.state !== 'dead');
  const nm = (h: any) => String(h.callsign).replace('Tango ', 'T');
  const sees = (x: any, m: any) => { const eye = x.char.bones.head ?? [x.char.pos[0], x.char.pos[1] + 1.65, x.char.pos[2]], look = x.char.chestDir, body = m.char.bones.hips ?? m.char.pos;
    const to = [body[0] - eye[0], body[1] - eye[1], body[2] - eye[2]], dist = Math.hypot(to[0], to[1], to[2]); if (dist > 12) return false;
    const fl = Math.hypot(to[0], to[2]) || 1, ll = Math.hypot(look[0], look[2]) || 1; if ((look[0] * to[0] + look[2] * to[2]) / (fl * ll) < Math.cos(60 * Math.PI / 180)) return false;
    return !g.col.segmentBlocked(eye, [body[0], body[1] + 0.3, body[2]]); };
  const up = new Set(H), order: string[] = [];
  for (;;) { const free = [...up].find(m => ![...up].some(x => x !== m && sees(x, m))); if (!free) break; up.delete(free); order.push(nm(free)); }
  const core = [...up], edges = core.flatMap(m => core.filter(x => x !== m && sees(x, m)).map(x => `${nm(x)}>${nm(m)}`));
  const squadOf = (h: any) => SQ.squadsReport(g).find((Q: any) => SQ.squadMen(g, Q.name).includes(h))?.name ?? '?';
  log(JSON.stringify({ scn, seed, at: atT, n: H.length, peel: core.length === 0, order: order.join(' '), core: core.map(h => `${nm(h)}(${squadOf(h)})`).join(' '), edges: edges.join(' ') }));
}
process.exit(0);
