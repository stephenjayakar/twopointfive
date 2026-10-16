// THE LAST DEFENDERS' CALL OUT NAMES WHERE THE MAN STANDS — the check behind laststand.ts `LASTSTAND.places` (fault C1 of the missions list).
// The fault it holds shut: on the compound the last man of the sala's squad ends up planted in the FRONT HALL — floor nobody holds, so no room of the
// structure — and his answer to the radio check named the nearest held room through a solid wall ('still here — outside the office'), with no marker on the
// HUD for him: the commander was sent round the wrong room and the tail of the run was a search for a man who had said where he was.
//   bun run tools/qa/callout-place-check.ts [--level compound] [--seed 5] [--play 24,14] [--off]
// What it does, in one process and then in real play:
//   STAGED  stands the room clear up on --level, takes every defender down by hand but one, and stands that one in a place of the level that is no room of
//           the structure (the first of `scenarios.places` that has free floor). Then, reading only what their net said (laststand.ts's own log) and the HUD's
//           objective, against the level's rectangles read straight off its file:
//             · his line names the place he stands in ('in the front hall'), not 'outside' a room
//             · the objective brackets that place and the marker sits inside it
//             · moved into a held room of the structure, he says where he is now within ten seconds, the bracket moves to that room and comes off the place
//   PLAYED  plays --play's seeds as the page ships them with call out on (tools/qa/ships.ts) and holds every line that says where a man is ('in the <place>',
//           'holding the <place>', 'outside the <place>') against where he stood as he said it: 'in' / 'holding' → inside that rectangle (a doorway's width of
//           tolerance); 'outside' → inside NO named rectangle of the level.
//   --off   plays with the rule off (LASTSTAND.places false): the fault as it was — the check is expected to FAIL (exit 1), which is the proof that it can
// exit 0 = every line held (and lines were looked at, staged and played) · 1 = one did not, or NO VERDICT (nothing was said: the check looked at nothing) ·
// 2 = bad flags
import { readFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { standUp, ROOT } from './headless.ts';
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { LASTSTAND, lastStandReport } = await import(`${ROOT}/src/game/laststand.ts`);
const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);

const argv = process.argv.slice(2), flag = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
for (const a of argv) if (a.startsWith('--') && !['--level', '--seed', '--play', '--off'].includes(a)) { console.error(`unknown flag ${a} (--level --seed --play --off)`); process.exit(2); }
const levelName = flag('--level') ?? 'compound', seed = Number(flag('--seed') ?? 5), off = argv.includes('--off');
const play = (flag('--play') ?? '24,14').split(',').filter(Boolean).map(Number);
if (!Number.isFinite(seed) || play.some(s => !Number.isFinite(s))) { console.error('bad --seed / --play'); process.exit(2); }
if (!('places' in LASTSTAND)) { console.log('- FAIL — this build has no LASTSTAND.places: the call out names a man by the nearest held room, wherever he stands'); process.exit(1); }

type Rect = { x0: number; x1: number; z0: number; z1: number };
interface Named { name: string; id: string | null; b: Rect }
const data = parseLevelData(readFileSync(resolve(ROOT, 'levels', `${levelName}.json`), 'utf8'));
const the = (n: string) => /^the |\d$/.test(n) ? n : `the ${n}`;
// the level's names, read off its file (never through the game's own naming): the structure's rooms first, then the places nobody holds
const NAMED: Named[] = [...(data.scenarios?.roomClear?.rooms ?? []).map((r: any) => ({ name: the(r.name), id: r.id as string, b: r.bounds as Rect })), ...(data.scenarios?.places?.areas ?? []).map((a: any) => ({ name: the(a.name), id: null, b: a.bounds as Rect }))];
const EDGE = 0.36;   // (a doorway: the wall's thickness between two rectangles of floor)
const dist = (b: Rect, x: number, z: number) => Math.hypot(Math.max(b.x0 - x, 0, x - b.x1), Math.max(b.z0 - z, 0, z - b.z1));
const inside = (x: number, z: number, pad = 0) => NAMED.filter(n => dist(n.b, x, z) <= pad);
/** does a line that says where a man is hold for where he stood? null = the line names no place */
function holds(text: string, x: number, z: number): { ok: boolean; why: string } | null {
  const t = text.toLowerCase(), out = /outside (the [a-z' ]+?|[a-z' ]+ \d)[.!,— ]/.exec(t + ' ');
  if (out) { const inn = inside(x, z); return { ok: inn.length === 0, why: inn.length ? `says '${out[0].trim()}' standing in ${inn[0].name}` : 'on ground the level has no name for' }; }
  const named = NAMED.filter(n => t.includes(`in ${n.name.toLowerCase()}`) || t.includes(`holding ${n.name.toLowerCase()}`) || t.includes(`still ${n.name.toLowerCase()}`)).sort((a, b) => b.name.length - a.name.length)[0];
  if (!named) return null;
  const ok = NAMED.some(n => n.name === named.name && dist(n.b, x, z) <= EDGE);
  return { ok, why: ok ? `in ${named.name}` : `says ${named.name} standing in ${inside(x, z)[0]?.name ?? 'none of the named floor'}` };
}

let failed = false, looked = 0;
const verdict = (ok: boolean, label: string, detail: string) => { if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
console.log(`callout-place-check · ${levelName} · the rule ${off ? 'OFF (the fault as it was)' : 'as shipped'} · staged seed ${seed} · played seeds ${play.join(',') || 'none'}`);

// ---------------------------------------------------------------- staged
const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
{
  LASTSTAND.regroup = false; LASTSTAND.callOut = true; LASTSTAND.places = !off; Math.random = seeded(seed);
  const log = console.log, err = console.error, warn = console.warn; let W: any;
  try { console.log = console.error = console.warn = () => { };
    W = await standUp({ uploadEvery: 4, level: loadLevel(data) });
    await startFromQuery(W.game, new URLSearchParams(`?levelFile=${levelName}.json&roomclear=${seed}&squad4`));
  } finally { console.log = log; console.error = err; console.warn = warn; }
  const g = W.game, nav = g.col.nav, steps = (secs: number, each?: () => void) => { for (let i = 0; i < Math.round(secs * 60); i++) { g.player.visibility = 0.05; W.step(DT); each?.(); } };
  const said = () => lastStandReport(g).said as { t: number; who: string; kind: string; text: string; at?: [number, number] }[];
  const free = (b: Rect): [number, number, number] | null => { const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2; for (const [dx, dz] of [[0, 0], [0.6, 0], [-0.6, 0], [0, 0.6], [0, -0.6], [0.6, 0.6], [-0.6, -0.6]]) if (!nav.isBlocked(cx + dx, cz + dz)) return [cx + dx, 0, cz + dz]; return null; };
  const place = NAMED.find(n => n.id === null && !inside((n.b.x0 + n.b.x1) / 2, (n.b.z0 + n.b.z1) / 2).some(m => m.id) && free(n.b));
  steps(1);
  const all = g.roomClear.rooms.flatMap((R: any) => R.defenders.map((h: any) => ({ h, R })));
  if (!place || !all.length || !g.roomClear.active) { console.log(`- NO VERDICT — ${!place ? 'the level names no place outside its structure\'s rooms' : 'no room clear stood up'}: the check looked at nothing`); process.exit(1); }
  const { h: man, R: home } = all[0];
  for (const x of all) if (x.h !== man && x.h.state !== 'dead') killGuard(g, x.h, [1, 0, 0], true);
  // stood where the fight had planted him in the runs the fault was read on: on floor that is no room of the structure
  const stand = (p: [number, number, number]) => { const D = g.fight.defs.find((d: any) => d.gd === man); man.char.pos[0] = p[0]; man.char.pos[2] = p[2]; if (D) { D.station = [...p]; D.home = [...p]; D.stallAt = [...p]; } man.path = null; };
  const spot = free(place.b)!; stand(spot);
  let line: { text: string; kind: string } | null = null, obj: { text: string; pos: number[] | null } | null = null, at: number[] = [], n0 = 0;
  steps(LASTSTAND.first[1] + LASTSTAND.listen[1] + 8, () => { stand(spot); if (line) return; const l = said().find(x => /At$/.test(x.kind) && x.who === man.callsign); if (l) { line = l; n0 = said().length; at = [man.char.pos[0], man.char.pos[2]]; } });
  steps(0.5, () => stand(spot)); obj = g.roomClear.objective();
  if (!line) { console.log(`- NO VERDICT — ${man.callsign} said nothing in ${(LASTSTAND.first[1] + LASTSTAND.listen[1] + 8).toFixed(0)} s alone (${said().map(l => l.text).join(' · ') || 'no line at all'}): the check looked at nothing`); process.exit(1); }
  looked++;
  const L = line as { text: string; kind: string }, h = holds(L.text, at[0], at[1]);
  verdict(!!h && h.ok && L.text.toLowerCase().includes(`in ${place.name.toLowerCase()}`), `a man standing in ${place.name} (no room of the structure) says so`, `${man.callsign} at (${at.map(v => v.toFixed(1)).join(', ')}): '${L.text}'${h ? ` — ${h.why}` : ''}`);
  const bare = place.name.replace(/^the /, ''), br = (obj?.text.match(/\[[^\]]+\]/g) ?? []) as string[], p = obj?.pos ?? null;
  verdict(br.includes(`[${bare}]`) && !!p && dist(place.b, p[0], p[2]) === 0, 'the objective brackets the place he named and the marker sits in it', `${obj?.text ?? 'no objective'} · marker ${p ? `(${p[0].toFixed(1)}, ${p[2].toFixed(1)})` : 'none'} · ${place.name} is x ${place.b.x0}‥${place.b.x1}, z ${place.b.z0}‥${place.b.z1}`);
  // … and he moves: into his own room of the structure
  const hb = home.def.bounds as Rect, to = free(hb);
  if (to) {
    const t0 = g.time; let moved: { t: number; text: string } | null = null; stand(to);
    steps(10, () => { stand(to); if (!moved) { const l = said().slice(n0).find(x => x.who === man.callsign && holds(x.text, to[0], to[2])?.ok); if (l) moved = { t: l.t, text: l.text }; } });
    steps(0.5, () => stand(to)); const o2 = g.roomClear.objective(), b2 = (o2?.text.match(/\[[^\]]+\]/g) ?? []) as string[], M = moved as { t: number; text: string } | null;
    verdict(!!M && b2.includes(`[${home.def.name}]`) && !b2.includes(`[${bare}]`), `moved into ${the(home.def.name)}, he says where he is now within ten seconds and the bracket moves with him`,
      `${M ? `${(M.t - t0).toFixed(1)} s after the move: '${M.text}'` : `nothing true of where he stands in 10 s (${said().slice(n0).map(l => `'${l.text}'`).join(' · ') || 'no line'})`} · ${o2?.text ?? ''}`);
  }
}

// ---------------------------------------------------------------- played
if (play.length) {
  const json = resolve(tmpdir(), `callout-place-${process.pid}.json`);
  const pr = Bun.spawn(['bun', 'run', resolve(import.meta.dir, 'ships.ts'), '--partial', '--callout', ...(off ? ['--noplaces'] : []), '--scn', `${levelName}-four`, '--seeds', play.join(','), '--jobs', '2', '--cap', '420', '--json', json], { stdout: 'ignore', stderr: 'ignore', env: { ...process.env, PT_SEARCH: '1', PT_SAY: '1' } });
  await pr.exited;
  let runs: any[] = []; try { runs = JSON.parse(readFileSync(json, 'utf8')).runs ?? []; } catch { /* did not play */ }
  if (runs.length !== play.length) { failed = true; console.log(`- FAIL — ${levelName}-four did not play seeds ${play.join(',')} (${runs.length} runs came back)`); }
  try { unlinkSync(json); } catch { /* nothing written */ }
  let lines = 0, offRoom = 0; const bad: string[] = [];
  for (const r of runs) for (const l of (r.lastStand?.said ?? []) as { t: number; who: string; text: string; at?: [number, number] }[]) {
    if (!l.at) continue; const h = holds(l.text, l.at[0], l.at[1]); if (!h) continue;
    lines++; if (!inside(l.at[0], l.at[1]).some(n => n.id)) offRoom++; if (!h.ok) bad.push(`seed ${r.seed} ${l.t} s ${l.who} at (${l.at[0].toFixed(1)}, ${l.at[1].toFixed(1)}): '${l.text}' — ${h.why}`);
  }
  if (!lines || !offRoom) { failed = true; console.log(`- NO VERDICT — ${lines} lines of their net said where a man was in the played seeds, ${offRoom} of them from a man standing in no room of the structure: the check looked at nothing`); }
  else { looked++; verdict(!bad.length, `played as shipped, seeds ${play.join(',')}: every line that says where a man is holds for where he stood`, `${lines} lines, ${offRoom} said standing in no room of the structure${bad.length ? `, ${bad.length} wrong:\n    ` + bad.slice(0, 6).join('\n    ') : ', none wrong'}`); }
}
if (!looked) { failed = true; console.log('- NO VERDICT — the check looked at nothing'); }
console.log(failed ? '=== callout-place-check: FAILURES above ===' : '=== callout-place-check: ALL PASS ===');
process.exit(failed ? 1 : 0);
