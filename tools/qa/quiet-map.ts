// A SQUAD MAP ON THE TERMINAL — where the defenders stand, which way they look, what is lit, where the doors and the breaker are, for one seed of a room-clear
// scenario, stood up exactly as tools/qa/pair-sneak.ts stands it. A reading tool for picking a quiet route by hand: nothing of the game is edited.
//   bun run tools/qa/quiet-map.ts compound-four:433 [--at 1] [--light] [--arm solo]
// One character = one nav cell (0.5 m). '#' wall · '.' floor · ':' floor under a roof-less sky · a digit / letter = Tango N (1‥9, a = 10, b = 11) with his
// facing drawn one cell ahead (^ v < >) · S = Sam · + = a shut door, / an open one · B = the breaker. --light draws how lit a standing man's chest is there
// instead of the floor (' ' dark < 0.04 · '░' < 0.22 · '▒' < 0.5 · '▓' lit), by the harness's own estimate (lamps only: no bounce, no moon).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { standUp, ROOT } from './headless.ts';
const argv = process.argv.slice(2); const flag = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; }; const has = (n: string) => argv.includes(n);
const [scn, seedS] = (argv[0] ?? 'compound-four:433').split(':'), seed = Number(seedS ?? 433), arm = flag('--arm') ?? 'solo', atT = Number(flag('--at') ?? 1);
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const { scenarioQuery } = await import(`${ROOT}/src/scene/scenarios.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { lightEstimateAt } = await import(`${ROOT}/src/game/guards.ts`);
const SQ = await import(`${ROOT}/src/game/enemysquads.ts`);
const E = SCENARIOS.find((e: any) => e.id === scn); if (!E) throw new Error(`no scenario '${scn}'`);
const log = console.log; const hush = () => { console.log = console.error = console.warn = () => { }; }, unhush = () => { console.log = log; };
Math.random = seeded(0x9137 + seed * 7919);
hush(); const W: any = await standUp({ uploadEvery: 4, level: loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', E.level), 'utf8'))) });
const g = W.game; g.godMode = true; g.tune.chaos = 0.5;
let q = (scenarioQuery(E) as string).replace(/(^|[?&])roomclear(=\d+)?(?=&|$)/, `$1roomclear=${seed}`).replace(/&squad4\b/, '') + `&squad=${arm === 'solo' ? 0 : 1}`;
const { why } = startFromQuery(g, new URLSearchParams(q)); if (why) throw new Error(why);
g.player.invisible = true; for (let i = 0; i < atT * 60; i++) W.step(1 / 60); unhush();
const nav = g.col.nav, pl = g.player, H: any[] = g.guards.filter((x: any) => x.team === 'hostile');
const grid: string[][] = []; const light = has('--light');
const sky = (x: number, z: number) => !g.col.solidBlocked([x, 1.8, z], [x, 14, z]);
for (let iz = 0; iz < nav.H; iz++) { const row: string[] = []; for (let ix = 0; ix < nav.W; ix++) { const x = (ix + 0.5) * nav.cell, z = (iz + 0.5) * nav.cell;
  if (nav.blocked[nav.idx(ix, iz)]) row.push('#'); else if (light) { const v = g.visibilityOf(lightEstimateAt(g, [x, 1.2, z], () => true)); row.push(v < 0.04 ? ' ' : v < 0.22 ? '░' : v < 0.5 ? '▒' : '▓'); } else row.push(sky(x, z) ? ':' : '.'); } grid.push(row); }
const put = (p: number[], ch: string) => { const ix = Math.floor(p[0] / nav.cell), iz = Math.floor(p[2] / nav.cell); if (grid[iz]?.[ix] !== undefined) grid[iz][ix] = ch; };
for (const d of g.doors.list) put(d.frameCentre, d.isClosed() ? '+' : '/');
put(g.level.breaker.pos, 'B');
const name = (h: any) => { const n = Number(String(h.callsign).replace(/\D/g, '')); return n < 10 ? String(n) : String.fromCharCode(87 + n); };
for (const h of H) { if (h.state === 'dead') continue; const f = h.char.forward(), p = h.char.pos; put([p[0] + f[0] * 0.6, 0, p[2] + f[2] * 0.6], Math.abs(f[0]) > Math.abs(f[2]) ? (f[0] > 0 ? '>' : '<') : (f[2] > 0 ? 'v' : '^')); }
for (const h of H) if (h.state !== 'dead') put(h.char.pos, name(h));
put(pl.char.pos, 'S');
log(`${scn}:${seed} ${arm} at ${atT} s · ${nav.W}×${nav.H} cells of ${nav.cell} m · x → right, z ↓ down`);
log('     ' + Array.from({ length: nav.W }, (_, i) => i % 10 === 0 ? String((i * nav.cell) / 10 | 0) : ' ').join(''));
log('     ' + Array.from({ length: nav.W }, (_, i) => i % 2 === 0 ? String(((i * nav.cell) | 0) % 10) : ' ').join(''));
grid.forEach((r, iz) => log(String((iz * nav.cell).toFixed(1)).padStart(4) + ' ' + r.join('')));
const SR = g.level.scenarios?.roomClear;
log('\nrooms: ' + SR.rooms.map((r: any) => `${r.id} x ${r.bounds.x0}‥${r.bounds.x1} z ${r.bounds.z0}‥${r.bounds.z1}`).join(' · '));
log('doors: ' + g.doors.list.map((d: any) => `${d.def.name} (${d.frameCentre[0].toFixed(1)}, ${d.frameCentre[2].toFixed(1)})${d.locked ? ' locked' : ''}${d.def.steel ? ' steel' : ''}`).join(' · '));
log(`breaker (${g.level.breaker.pos[0]}, ${g.level.breaker.pos[2]}) · Sam (${pl.char.pos[0].toFixed(1)}, ${pl.char.pos[2].toFixed(1)})`);
for (const Q of SQ.squadsReport(g)) { const men: any[] = SQ.squadMen(g, Q.name);
  log(`${Q.name} (${Q.state}): ` + men.map((h: any) => { const D = g.fight?.defs?.find((y: any) => y.gd === h), p = h.char.pos, f = h.char.forward(); return `${h.callsign} (${p[0].toFixed(1)}, ${p[2].toFixed(1)}) faces ${(Math.atan2(f[0], f[2]) * 180 / Math.PI).toFixed(0)}° ${h.state}${h.hold ? ' hold' : ''}${h.pinned ? ' pinned' : ''}${D ? ` ${D.mode} room ${D.room?.id ?? D.room} watch ${D.watch?.def?.name ?? D.watch ?? '-'}` : ''} lit ${g.visibilityOf(lightEstimateAt(g, [p[0], 1.2, p[2]], () => true)).toFixed(2)}${h.flashlight?.enabled ? ' torch' : ''}`; }).join(' · ')); }
log('fixtures: ' + g.targets.filter((t: any) => t.kind !== 'device' && t.kind !== 'breaker').map((t: any) => `${t.name ?? t.kind}(${t.pos[0].toFixed(0)},${t.pos[2].toFixed(0)})${t.group ? ':' + t.group : ''}`).join(' '));
process.exit(0);
