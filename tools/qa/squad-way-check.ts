// 'COMING TO YOU' SAYS BY WHICH WAY — the check behind enemysquads.ts `SQUADS.way` (the barracks' fault: a man of the hit squad answers from another of its
// rooms, walks the gallery and comes through the fire door behind the team; his line on the net said he was coming and not from where).
//   bun run tools/qa/squad-way-check.ts [--level barracks] [--room day] [--seed 5] [--off]
// What it does, in one process: stands the room clear up on --level with its squads, lets a shot be heard inside --room (a room of a squad that holds
// another room too), and reads what their net says. Against the level's rectangles read straight off its file (never through the game's own naming):
//   · every 'coming to you' line names a way: 'through <place>' or 'from <place>', a room or a place of THIS level
//   · a way he goes 'through' is the LAST named floor before the room he is called to: its rectangle touches that room's (a wall's thickness apart)
//   · the man who said it then stands in that place (looked at for 25 s, or until he is in the room he was called to). The fight may turn him before
//     he gets there: this holds that he sets off the way he said, not that he arrives
//   · with the Defender cues off the line is the old one, word for word
//   --off   the rule off (SQUADS.way false): the line as it was — the check is expected to FAIL (exit 1), which is the proof that it can
// exit 0 = every line held · 1 = one did not, or NO VERDICT (nobody answered: the check looked at nothing) · 2 = bad flags
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { standUp, ROOT } from './headless.ts';
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { SQUADS } = await import(`${ROOT}/src/game/enemysquads.ts`);
const { CUES } = await import(`${ROOT}/src/game/cues.ts`);

const argv = process.argv.slice(2), flag = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
for (const a of argv) if (a.startsWith('--') && !['--level', '--room', '--seed', '--off'].includes(a)) { console.error(`unknown flag ${a} (--level --room --seed --off)`); process.exit(2); }
const levelName = flag('--level') ?? 'barracks', roomId = flag('--room') ?? 'day', seed = Number(flag('--seed') ?? 5), off = argv.includes('--off');
if (!Number.isFinite(seed)) { console.error('bad --seed'); process.exit(2); }
console.log(`squad-way-check · ${levelName} · a shot heard in '${roomId}' · the rule ${off ? 'OFF (the line as it was)' : 'as shipped'} · seed ${seed}`);
if (!('way' in SQUADS)) { console.log('- FAIL — this build has no SQUADS.way: \'coming to you\' never says by which way'); process.exit(1); }

type Rect = { x0: number; x1: number; z0: number; z1: number };
const data = parseLevelData(readFileSync(resolve(ROOT, 'levels', `${levelName}.json`), 'utf8'));
const the = (n: string) => /^the |\d$/.test(n) ? n : `the ${n}`;
const NAMED: { name: string; b: Rect }[] = [...(data.scenarios?.roomClear?.rooms ?? []).map((r: any) => ({ name: the(r.name), b: r.bounds as Rect })), ...(data.scenarios?.places?.areas ?? []).map((a: any) => ({ name: the(a.name), b: a.bounds as Rect }))];
const room = (data.scenarios?.roomClear?.rooms ?? []).find((r: any) => r.id === roomId);
if (!room) { console.error(`no room '${roomId}' in ${levelName}'s structure`); process.exit(2); }
const EDGE = 0.36, dist = (b: Rect, x: number, z: number) => Math.hypot(Math.max(b.x0 - x, 0, x - b.x1), Math.max(b.z0 - z, 0, z - b.z1));
const WALL = 0.6, rectGap = (a: Rect, b: Rect) => Math.hypot(Math.max(a.x0 - b.x1, 0, b.x0 - a.x1), Math.max(a.z0 - b.z1, 0, b.z0 - a.z1));
const inName = (x: number, z: number) => NAMED.filter(n => dist(n.b, x, z) <= EDGE).map(n => n.name);

let failed = false;
const verdict = (ok: boolean, label: string, detail: string) => { if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

interface Row { t: number; gd: any; text: string; at: [number, number]; stood: string[] }
/** stand the level up, let the shot be heard, and hand back every 'coming to you' line with the named floor its man stood on afterwards */
async function stage(way: boolean, cues: boolean): Promise<Row[]> {
  SQUADS.way = way; Math.random = seeded(seed);
  const log = console.log, err = console.error, warn = console.warn; let W: any;
  try { console.log = console.error = console.warn = () => { };
    W = await standUp({ uploadEvery: 4, level: loadLevel(data) });
    await startFromQuery(W.game, new URLSearchParams(`?levelFile=${levelName}.json&roomclear=${seed}&squad4`));
  } finally { console.log = log; console.error = err; console.warn = warn; }
  const g = W.game, rows: Row[] = []; CUES.on = cues;
  const say0 = g.say.bind(g);
  g.say = (gd: any, text: string, ...rest: any[]) => { if (/coming to you/i.test(text) && /^[A-Z]\w+: /.test(text)) rows.push({ t: g.time, gd, text, at: [gd.char.pos[0], gd.char.pos[2]], stood: [] }); return say0(gd, text, ...rest); };
  const steps = (secs: number) => { for (let i = 0; i < Math.round(secs * 60); i++) { g.player.visibility = 0.05; W.step(1 / 60);
    for (const r of rows) { if (g.time - r.t > 25 || r.stood.includes(the(room.name))) continue; for (const n of inName(r.gd.char.pos[0], r.gd.char.pos[2])) if (!r.stood.includes(n)) r.stood.push(n); } } };   // (each named floor once, in the order he first stood on it)
  steps(2);
  const b = room.bounds as Rect; g.events.push({ kind: 'shot', pos: [(b.x0 + b.x1) / 2, 1, (b.z0 + b.z1) / 2], time: g.time, loud: true, level: 1, who: g.player.char.id });
  steps(30);
  return rows;
}

const rows = await stage(!off, true);
if (!rows.length) { console.log(`- NO VERDICT — nobody answered 'coming to you' on ${levelName}: the check looked at nothing`); process.exit(1); }
for (const r of rows) {
  const m = / coming to you (through|from) (.+?) — hold on!$/.exec(r.text), who = `${r.gd.callsign} at (${r.at[0].toFixed(1)}, ${r.at[1].toFixed(1)})`;
  if (!m) { verdict(false, 'the line says by which way he comes', `${who}: '${r.text}' names no way`); continue; }
  const own = NAMED.some(n => n.name === m[2]);
  verdict(own, 'the way named is a room or a place of this level', `${who}: '${r.text}'${own ? '' : ` — the level's file has no '${m[2]}'`}`);
  if (m[1] === 'through') {
    const gap = Math.min(...NAMED.filter(n => n.name === m[2]).map(n => rectGap(n.b, room.bounds as Rect)));
    verdict(gap <= WALL, 'the way named is the last floor before the room he is called to', `${m[2]} is ${gap.toFixed(2)} m from ${the(room.name)} (a wall is ${WALL} m at most)`);
  }
  const walked = m[1] === 'from' ? inName(r.at[0], r.at[1]).includes(m[2]) : r.stood.includes(m[2]);
  verdict(walked, m[1] === 'from' ? 'he stands where he says he comes from' : 'he then sets off the way he named', `${r.gd.callsign} stood in: ${r.stood.join(' → ') || 'no named floor'}`);
}
if (!off) {
  const old = await stage(true, false);
  const same = old.length > 0 && old.every(r => / coming to you — hold on!$/.test(r.text));
  verdict(same, 'the Defender cues off: the line as it was', old.length ? old.map(r => `'${r.text}'`).join(' · ') : 'nobody answered with the cues off');
}
console.log(failed ? `=== squad-way-check: FAILED ===` : `=== squad-way-check: ALL PASS ===`);
process.exit(failed ? 1 : 0);
