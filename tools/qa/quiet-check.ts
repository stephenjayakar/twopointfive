// QUIET-CHECK: a level file's `scenarios.quiet` block against the floor it is built on (game/quiet.ts checkQuiet), and every one of its deals started once.
//   bun run tools/qa/quiet-check.ts quiet-yard.json [more.json …]      (no name: every file under levels/ that carries the block)
// WHAT IT SAYS, per file:
//   · the file's own validator (scene/levelData.ts: shapes, door and route names, at most six men a patrol set)
//   · the block against the BUILT floor: every start, mate, stand and way out on free floor; a way on foot from every start to every spot and from every spot
//     to every way out; no start in plain view of a man on his route's first waypoint
//   · EVERY DEAL STARTED: each start × spot × patrol set once alone, and each start once with the partner — the mission up, Sam on the start, the dealt men on
//     the list and nobody else, the partner within reach and on his feet
// EXIT: 0 = nothing to fix · 1 = faults (each a line an author can act on) · 2 = no such file / no block.
// Headless: no GPU, nothing here saw a picture.
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { standUp, ROOT } from './headless.ts';

const names = process.argv.slice(2).filter(a => !a.startsWith('--'));
const { parseLevelData, validateLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { checkQuiet } = await import(`${ROOT}/src/game/quiet.ts`);
const { startFromQuery, quitScenario } = await import(`${ROOT}/src/game/scenarioRun.ts`);

const files = names.length ? names.map(n => n.endsWith('.json') ? n : `${n}.json`)
  : readdirSync(resolve(ROOT, 'levels')).filter(f => f.endsWith('.json') && /"quiet"\s*:/.test(readFileSync(resolve(ROOT, 'levels', f), 'utf8')));
if (!files.length) { console.log('quiet-check: no level file under levels/ carries a scenarios.quiet block'); process.exit(2); }

const log = console.log, hush = () => { console.log = console.error = console.warn = () => { }; }, unhush = () => { console.log = log; console.error = log; console.warn = log; };
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
let bad = 0, missing = 0;
for (const file of files) {
  log(`\n=== quiet-check ${file} ===`);
  let text: string; try { text = readFileSync(resolve(ROOT, 'levels', file), 'utf8'); } catch { log(`  no such file: levels/${file}`); missing++; continue; }
  const raw = JSON.parse(text); if (!raw?.scenarios?.quiet) { log('  the file carries no scenarios.quiet block'); missing++; continue; }
  const faults: string[] = validateLevelData(raw).filter((e: string) => /quiet|exfil/.test(e));
  if (faults.length) { for (const f of faults) log(`  FAIL  ${f}`); bad += faults.length; continue; }
  const Q = raw.scenarios.quiet, sets: string[][] = Q.patrols?.length ? Q.patrols : [raw.routes.map((r: any) => r.id)];
  log(`  PASS  the file validates: ${Q.starts.length} start(s), ${Q.spots.length} spot(s), ${Q.exits.length} way(s) out, ${sets.length} patrol set(s) — ${Q.starts.length * Q.spots.length * sets.length} deals`);
  hush(); const W: any = await standUp({ uploadEvery: 4, level: loadLevel(parseLevelData(text)) }); unhush();
  const g = W.game, floor: string[] = checkQuiet(g);
  if (floor.length) { for (const f of floor) log(`  FAIL  ${f}`); bad += floor.length; } else log('  PASS  the block against the built floor: free floor everywhere it stands a man, a way on foot start → spot → out for every pair, no start in a patrol\'s first sight');
  // every deal, started: the pinned deal is drawn off the pin, so pins are walked until every (start, spot, set) has come up (a cap, in case one never does)
  const want = new Set<string>(); for (let a = 0; a < Q.starts.length; a++) for (let b = 0; b < Q.spots.length; b++) for (let c = 0; c < sets.length; c++) want.add(`${a}/${b}/${c}`);
  const seen = new Set<string>(), why: string[] = [];
  for (let pin = 0; pin < 4000 && seen.size < want.size; pin++) {
    hush(); const r = startFromQuery(g, `?quiet=${pin}`); unhush();
    if (r.why) { why.push(`pin ${pin}: refused — ${r.why}`); break; }
    const d = g.quiet.deal, k = `${d.start}/${d.spot}/${Math.max(0, d.patrol)}`;
    if (!seen.has(k)) { seen.add(k);
      const S = Q.starts[d.start], set = sets[Math.max(0, d.patrol)], on = g.guards.filter((x: any) => !x.unit).map((x: any) => g.level.routes[x.routeI]?.name);
      if (flat(g.player.char.pos, S.sam) > 0.3) why.push(`deal ${k}: Sam stands ${flat(g.player.char.pos, S.sam).toFixed(2)} m off the start`);
      if (on.length !== set.length || set.some((n: string) => !on.includes(n))) why.push(`deal ${k}: on the floor [${on.join(', ')}], the set is [${set.join(', ')}]`);
      if (g.guards.some((x: any) => x.unit)) why.push(`deal ${k}: a unit is on the floor of a run alone`);
      { const names = g.guards.filter((x: any) => !x.unit).map((x: any) => x.callsign), twice = names.filter((n: string, i: number) => names.indexOf(n) !== i);
        if (twice.length) why.push(`deal ${k}: two men on the floor answer to '${twice[0]}' (the level has ${g.level.routes.length} routes: more than the game has names for — game.ts CALLSIGNS)`); }
      for (let i = 0; i < 30; i++) W.step(1 / 60);
      if (g.guards.some((x: any) => !x.unit && x.state !== 'patrol')) why.push(`deal ${k}: half a second in, ${g.guards.filter((x: any) => x.state !== 'patrol').map((x: any) => `${x.callsign} is ${x.state}`).join(', ')} — the run begins noticed`); }
    hush(); quitScenario(g); unhush();
  }
  for (const k of want) if (!seen.has(k) && !why.length) why.push(`deal ${k} never came up in 4000 pins`);
  for (let a = 0; a < Q.starts.length && !why.length; a++) {   // each start once with the partner
    let pin = 0; for (; pin < 400; pin++) { hush(); const r = startFromQuery(g, `?quiet=${pin}&squad=1`); unhush(); if (r.why) { why.push(`with the partner, pin ${pin}: refused — ${r.why}`); break; } if (g.quiet.deal.start === a) break; hush(); quitScenario(g); unhush(); }
    if (why.length || !g.quiet.active) break;
    for (let i = 0; i < 30; i++) W.step(1 / 60);
    const m = g.quiet.ops[0], d = m ? flat(m.char.pos, g.player.char.pos) : Infinity;
    if (!m || m.state === 'dead') why.push(`starts[${a}] with the partner: no partner on his feet`); else if (d > 3.5) why.push(`starts[${a}] with the partner: he stands ${d.toFixed(1)} m from Sam`);
    if (g.guards.some((x: any) => !x.unit && x.state !== 'patrol')) why.push(`starts[${a}] with the partner: half a second in, ${g.guards.filter((x: any) => !x.unit && x.state !== 'patrol').map((x: any) => `${x.callsign} is ${x.state}`).join(', ')} — the run begins noticed`);
    hush(); quitScenario(g); unhush();
  }
  if (why.length) { for (const f of why) log(`  FAIL  ${f}`); bad += why.length; } else log(`  PASS  every deal started alone (${seen.size} of ${want.size}) and every start with the partner: Sam on the start, the dealt men on the list, nobody roused in the first half second`);
}
log(`\n=== quiet-check: ${missing && !bad ? 'NOTHING TO CHECK' : bad ? `${bad} FAULT(S)` : 'ALL PASS'} ===`);
process.exit(bad ? 1 : missing ? 2 : 0);
