// A LEVEL IS NAMED BY ITS OWN ROOMS, NEVER THE OFFICE'S — the check behind dialogue.ts roomName / placeName and chronicle.ts roomOf (fault G1 of the
// missions list).
// The fault it holds shut: every table of room names in the game was the office's (the level the game was written on). A level that named no rooms of its
// own — the registry — had its captor 'holding the server room' (the mission's reach area, on a floor with no server room), men 'in the back offices' and
// 'coming from the car park'; and the debrief's map and timeline called every level's floor 'cubicles', 'lobby', 'server room' by the office's rectangles.
//   bun run tools/qa/level-names-check.ts [--levels registry,compound,…] [--play rescue-registry] [--seeds 1-6] [--no-play]
// What it does:
//   NAMES   for every level (default: every levels/*.json that is not the office and has a scenario), over the whole floor on a half-metre lattice:
//             · the level names floor of its own (its structure's rooms, `scenarios.places` and/or the rooms its quiet mission's spots are in) — a level that names nothing is listed, and must then
//               say none of the office's words either
//             · what a line would call the spot (roomName, placeName) and what the debrief would (chronicle.ts roomOf, roomsOf) is one of the level's own
//               names, 'outside' one of them (placeName only: the other two are nouns), or the one place-free word — never a room of the office's tables
//               that the level does not have itself, and never anything else (an empty string, 'undefined', a throw)
//             · at the middle of every named rectangle, the name said is that rectangle's own
//   PLAYED  plays --play (default rescue-registry: the level the fault was read on) over --seeds at Standard and at Hard as the page ships it
//           (tools/qa/ships.ts, PT_SAY=1) and reads every line said, cued or logged: none may say a room of the office's that the level does not have.
// exit 0 = every level's names are its own and the played lines say none of the office's · 1 = one did not, or NO VERDICT (no level, no line: the check
// looked at nothing) · 2 = bad flags
import { readFileSync, readdirSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { ROOT } from './headless.ts';
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const DLG = await import(`${ROOT}/src/game/dialogue.ts`);
const CHR = await import(`${ROOT}/src/game/chronicle.ts`);
const { CUES } = await import(`${ROOT}/src/game/cues.ts`);

const argv = process.argv.slice(2), flag = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
for (const a of argv) if (a.startsWith('--') && !['--levels', '--play', '--seeds', '--no-play'].includes(a)) { console.error(`unknown flag ${a} (--levels --play --seeds --no-play)`); process.exit(2); }
const noPlay = argv.includes('--no-play'), playScn = flag('--play') ?? 'rescue-registry', seeds = flag('--seeds') ?? '1-6';
if (!/^\d+(-\d+)?(,\d+(-\d+)?)*$/.test(seeds)) { console.error('bad --seeds'); process.exit(2); }

/** THE OFFICE'S WORDS: every room its tables name (dialogue.ts OFFICE_AREAS + its clear plans + the mission's server room; chronicle.ts ROOMS) and the two
 *  it falls through to. A level may have a lobby or a corridor of its own: a word is wrong only on a level that names no such place itself */
const OFFICE_WORDS = ['server room', 'back offices', 'car park', 'cubicles', 'break room', 'lobby', 'corridor', "manager's office", 'conference room', 'storage room', 'storage', 'south lot', 'east side', 'north side', 'west side'];
type Rect = { x0: number; x1: number; z0: number; z1: number };
const isOffice = (d: any) => ['corridor', 'cubicles', 'lobby_break'].every(n => (d.routes ?? []).some((r: any) => (r.id ?? r.name) === n));
const files = flag('--levels') ? flag('--levels')!.split(',').map(n => `${n.replace(/\.json$/, '')}.json`) : readdirSync(resolve(ROOT, 'levels')).filter(f => f.endsWith('.json')).sort();

let failed = false, looked = 0;
const verdict = (ok: boolean, label: string, detail: string) => { if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
console.log(`level-names-check · ${files.length} level files${noPlay ? '' : ` · played: ${playScn} seeds ${seeds}, Standard and Hard`}`);

const ownWords = new Map<string, string[]>();   // level file → the names it has itself (lower case, no article)
for (const f of files) {
  let data: any; const text = readFileSync(resolve(ROOT, 'levels', f), 'utf8');
  try { data = parseLevelData(text); } catch (e) { let lvl = true; try { lvl = Array.isArray(JSON.parse(text).boxes); } catch { /* not JSON: a broken file */ } if (lvl || flag('--levels')) verdict(false, `${f} loads`, String(e).slice(0, 160)); continue; }   // (levels/ also holds files that are no level — a lint report: skipped; a LEVEL that does not load is a failure)
  if (isOffice(data) || !data.scenarios) continue;   // (the office itself, and levels nobody plays a scenario on: test floors)
  const level = loadLevel(data), bare = (n: string) => n.replace(/^the /, '').toLowerCase();
  const named: { name: string; b: Rect }[] = [...(data.scenarios.roomClear?.rooms ?? []), ...(data.scenarios.places?.areas ?? []), ...(data.scenarios.quiet?.spots ?? []).map((s: any) => ({ name: s.place, bounds: s.area }))].map((r: any) => ({ name: bare(r.name), b: r.bounds }));
  const own = [...new Set(named.map(n => n.name))]; ownWords.set(f, own);
  const foreign = OFFICE_WORDS.filter(w => !own.some(o => o === w || o.endsWith(` ${w}`)));
  // the floor: the bounding box of every static, on a half-metre lattice
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (const b of data.boxes) { x0 = Math.min(x0, b.c[0] - b.h[0]); x1 = Math.max(x1, b.c[0] + b.h[0]); z0 = Math.min(z0, b.c[2] - b.h[2]); z1 = Math.max(z1, b.c[2] + b.h[2]); }
  x0 = Math.max(x0, -20); z0 = Math.max(z0, -20); x1 = Math.min(x1, 80); z1 = Math.min(z1, 80);
  const said = new Map<string, number>(), wrong = new Map<string, string>(); let pts = 0;
  const roomOf = (p: number[]): string => { try { return String(CHR.roomOf(p, level)); } catch { return '(roomOf threw)'; } };
  const legal = (how: string, text: string) => { const t = text.replace(/^the /, '').toLowerCase(); return own.length ? own.includes(t) || (how === 'placeName' && own.some(o => text.toLowerCase() === `outside the ${o}` || text.toLowerCase() === `outside ${o}`)) : /^(the )?building$/.test(text); };
  const hear = (how: string, text: string, p: number[]) => { said.set(text, (said.get(text) ?? 0) + 1); const t = text.toLowerCase(), w = foreign.find(x => new RegExp(`(^|[^a-z])${x}($|[^a-z])`).test(t)); if ((w || (how !== 'debrief label' && !legal(how, text))) && !wrong.has(`${how}: '${text}'`)) wrong.set(`${how}: '${text}'`, `(${p[0].toFixed(1)}, ${p[2].toFixed(1)})`); };
  CUES.on = true;   // (as the page ships. The cues off = every line as it was before them, the office's fall-through included: that switch is the old words' pin for the frozen digests, and nothing this check holds)
  try { for (let z = z0 + 0.25; z < z1; z += 0.5) for (let x = x0 + 0.25; x < x1; x += 0.5) { const p = [x, 0, z]; pts++; hear('roomName', DLG.roomName(level, p), p); hear('placeName', DLG.placeName(level, p), p); hear('debrief roomOf', roomOf(p), p); } }
    finally { /* (left on for the rectangles' middles below) */ }
  const labels: string[] = typeof CHR.roomsOf === 'function' ? CHR.roomsOf(level).map((r: any) => String(r.name)) : (CHR.ROOMS ?? []).map((r: any) => String(r.name));   // (the debrief map's labels: a build without roomsOf draws the office's table on every level)
  for (const l of labels) hear('debrief label', l, [0, 0, 0]);
  looked++;
  verdict(wrong.size === 0, `${f}: no spot of its floor is called by a room of the office's`, wrong.size ? `${wrong.size} wrong, e.g. ${[...wrong].slice(0, 5).map(([k, at]) => `${k} at ${at}`).join(' · ')}` : `${pts} points · it says: ${[...said.keys()].filter(k => !/^outside /.test(k)).slice(0, 14).join(', ')}${own.length ? '' : ' (the level names no floor of its own)'}`);
  if (named.length) {
    const off: string[] = []; for (const n of named) { const c = [(n.b.x0 + n.b.x1) / 2, 0, (n.b.z0 + n.b.z1) / 2];
      const first = named.find(m => c[0] >= m.b.x0 && c[0] <= m.b.x1 && c[2] >= m.b.z0 && c[2] <= m.b.z1)!;   // (two rectangles over one spot: the first listed is the name)
      const got = bare(String(DLG.roomName(level, c))), deb = bare(roomOf(c)); if (got !== first.name) off.push(`${n.name}: said '${got}'`); else if (deb !== first.name) off.push(`${n.name}: the debrief says '${deb}'`); }
    verdict(off.length === 0, `${f}: the middle of each of its ${named.length} named rectangles is called by its own name`, off.length ? off.slice(0, 6).join(' · ') : own.join(', '));
  }
  if (f === 'registry.json') verdict((data.scenarios.places?.areas ?? []).length >= 6, 'registry.json names its rooms in its file (scenarios.places)', `${(data.scenarios.places?.areas ?? []).length} named: ${(data.scenarios.places?.areas ?? []).map((a: any) => a.name).join(', ') || 'none'}`);
}
if (!looked) { failed = true; console.log('- NO VERDICT — no level with a scenario was read: the check looked at nothing'); }

if (!noPlay) {
  const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
  const entry = SCENARIOS.find((e: any) => e.id === playScn), lf: string = entry?.levelFile ?? entry?.level ?? '';
  const own = ownWords.get(lf) ?? ownWords.get(`${lf}.json`) ?? [...ownWords.entries()].find(([k]) => playScn.includes(k.replace(/\.json$/, '')))?.[1] ?? [];
  const foreign = OFFICE_WORDS.filter(w => !own.some(o => o === w || o.endsWith(` ${w}`)));
  for (const hard of [false, true]) {
    const json = resolve(tmpdir(), `level-names-${process.pid}-${hard ? 'hard' : 'std'}.json`);
    const pr = Bun.spawn(['bun', 'run', resolve(import.meta.dir, 'ships.ts'), '--partial', ...(hard ? ['--hard'] : []), '--callout', '--scn', playScn, '--seeds', seeds, '--jobs', '3', '--cap', '420', '--json', json], { stdout: 'ignore', stderr: 'ignore', env: { ...process.env, PT_SAY: '1' } });
    const code = await pr.exited;
    let runs: any[] = []; try { runs = JSON.parse(readFileSync(json, 'utf8')).runs ?? []; } catch { /* did not play */ }
    try { unlinkSync(json); } catch { /* nothing written */ }
    if (code !== 0 && code !== 1) { failed = true; console.log(`- FAIL — ${playScn} at ${hard ? 'Hard' : 'Standard'}: ships.ts exit ${code}`); }   // (1 = a run stalled or smelt: still played)
    let lines = 0; const bad = new Map<string, string>(), placed = new Set<string>();
    for (const r of runs) for (const k of ['lines', 'cues', 'msgs']) for (const l of (r.said?.[k] ?? []) as { t: number; who?: string; text: string }[]) {
      lines++; const t = String(l.text).toLowerCase(), w = foreign.find(x => new RegExp(`(^|[^a-z])${x}($|[^a-z])`).test(t));
      if (w) { if (!bad.has(l.text)) bad.set(l.text, `seed ${r.seed} ${l.t} s ${l.who ?? ''}`); } else { const o = own.find(x => t.includes(x)); if (o) placed.add(o); }
    }
    if (!runs.length || !lines) { failed = true; console.log(`- NO VERDICT — ${playScn} at ${hard ? 'Hard' : 'Standard'}: ${runs.length} runs, ${lines} lines read: the check looked at nothing`); continue; }
    looked++;
    verdict(bad.size === 0, `${playScn} played at ${hard ? 'Hard' : 'Standard'}, seeds ${seeds}: no line says a room of the office's`, bad.size ? `${bad.size} of ${lines} lines, e.g. ${[...bad].slice(0, 5).map(([t, at]) => `'${t}' (${at})`).join(' · ')}` : `${runs.length} runs, ${lines} lines · places of its own said: ${[...placed].join(', ') || 'none'}`);
  }
}
console.log(failed ? '=== level-names-check: FAILURES above ===' : '=== level-names-check: ALL PASS ===');
process.exit(failed ? 1 : 0);
