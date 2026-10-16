// NO POINT OF AN ENTRY IN ANOTHER DOOR'S FRAME (src/game/doortools.ts DOORTOOLS.podFrames, inFrame) — every door of every level file, both faces, asked what
// an entry by it is dealt: the two / four points of domination before entrypoints.ts looks at them (podsAsWere) and the shallow points of a threshold stage
// (shallowPods). The barracks' gallery entry by n_end had one on the threshold of n4b (rebuild/missions/faults.md B2).
//   bun run tools/qa/podframes-check.ts [name…] [--list]          (TPS_PROFILE=shipped in front: the page's stand; the rule is raised here on either)
//   a  no dealt point stands in the opening of another door (between its jambs, within 0.45 m of its line), and none lies beyond one from the door's mouth
//   b  the rule leaves no deal short: two points wherever there were two (a threshold's third or fourth may go: nothing takes the place of a point that
//      stood in a doorway when the floor within 2.5 m has no more)
//   c  off = the points as they were: the faces the rule changes are counted and named (--list: each, before and after), and the barracks' is one of them
// PODFRAMES_BREAK=1: the rule left off — line a is red (the barracks' n_end, and whatever else the levels hold).
// exit 0 = all lines pass · 1 = a FAIL · 2 = no such level
import { resolve } from 'node:path';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
const ROOT = resolve(import.meta.dir, '../..');
const { standUp } = await import(`${ROOT}/tools/qa/headless.ts`);
const { DOORTOOLS, doorPt } = await import(`${ROOT}/src/game/doortools.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);

const argv = process.argv.slice(2), LIST = argv.includes('--list'), BREAK = process.env.PODFRAMES_BREAK === '1';
const all = readdirSync(resolve(ROOT, 'levels')).filter(f => f.endsWith('.json') && !f.endsWith('.lint.json')).map(f => f.slice(0, -5)).sort();
const names = argv.filter(a => !a.startsWith('--')), todo = names.length ? names : all;
for (const n of todo) if (!existsSync(resolve(ROOT, 'levels', `${n}.json`))) { console.error(`no level file levels/${n}.json`); process.exit(2); }

type Pod = { pos: number[]; face: number };
const at = (P: Pod[]) => P.map(q => `(${q.pos[0].toFixed(2)}, ${q.pos[2].toFixed(2)})`).join(' ') || '—';
const quiet = async <T>(fn: () => Promise<T>): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => {}; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };

const inFrames: string[] = [], lost: string[] = [], changed: string[] = []; let faces = 0, doors = 0, levels = 0;
for (const name of todo) {
  const W: any = await quiet(() => standUp({ uploadEvery: 4, level: loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', `${name}.json`), 'utf8'))) }));
  const g = W.game, list: any[] = g.doors.list; if (!list.length) continue; levels++; doors += list.length;
  // the check's own measure of a frame (not the rule's podFrameM): [metres along the leaf's closed line from its hinge, metres off that line]
  const fr = (o: any, p: number[]) => { const ux = Math.cos(o.def.closedDir), uz = Math.sin(o.def.closedDir), rx = p[0] - o.def.hinge[0], rz = p[2] - o.def.hinge[1]; return [rx * ux + rz * uz, -rx * uz + rz * ux]; };
  const bad = (d: any, side: number, p: number[]): string | null => {
    const M = doorPt(d, d.def.width / 2, 0.9, -side), mx = M[0], mz = M[2];   // (the door's mouth: 0.9 m in from the middle of its frame, the face the entry goes in to)
    for (const o of list) { if (o === d) continue; const [a, b] = fr(o, p), w = o.def.width;
      if (a > 0 && a < w && Math.abs(b) < 0.45) return `in ${o.def.name}'s frame`;
      const m = fr(o, [mx, 0, mz])[1]; if (m * b >= 0) continue;   // (the same side of the other door's wall: no line through it)
      const t = m / (m - b), x = fr(o, [mx + (p[0] - mx) * t, 0, mz + (p[2] - mz) * t])[0]; if (x > 0 && x < w) return `beyond ${o.def.name}`; }
    return null; };
  for (const d of list) for (const side of [1, -1]) for (const [kind, n] of [['entry', 2], ['entry', 4], ['shallow', 2], ['shallow', 4]] as const) {
    const deal = (on: boolean): Pod[] => { DOORTOOLS.podFrames = on; return kind === 'entry' ? g.doorTools.podsAsWere(d, side, n) : g.doorTools.shallowPods(d, side, n); };
    const was = deal(false), now = deal(!BREAK), tag = `${name} ${d.def.name}${side > 0 ? '+' : '-'} ${kind} ${n}`; faces++;
    for (const q of now) { const why = bad(d, side, q.pos); if (why) inFrames.push(`${tag}: (${q.pos[0].toFixed(2)}, ${q.pos[2].toFixed(2)}) ${why}`); }
    if (now.length < Math.min(2, was.length)) lost.push(`${tag}: ${was.length} → ${now.length} · ${at(was)} → ${at(now)}`);
    if (at(was) !== at(now)) changed.push(`${tag}: ${at(was)} → ${at(now)}`);
  }
}
let failed = false; const line = (ok: boolean, text: string) => { console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${text}`); if (!ok) failed = true; };
console.log(`podframes-check · ${levels} levels with doors · ${doors} doors · ${faces} deals asked (each face: an entry's 2 and 4 points, a threshold's 2 and 4)${BREAK ? ' · PODFRAMES_BREAK: the rule left off' : ''}`);
line(!inFrames.length, `a · no dealt point stands in another door's frame or beyond one: ${inFrames.length} do${inFrames.length ? '\n    ' + inFrames.slice(0, LIST ? 999 : 12).join('\n    ') + (inFrames.length > 12 && !LIST ? `\n    … ${inFrames.length - 12} more (--list)` : '') : ''}`);
line(!lost.length, `b · the rule leaves no deal with fewer than two points that had two: ${lost.length} are${lost.length ? '\n    ' + lost.slice(0, LIST ? 999 : 12).join('\n    ') : ''}`);
const barr = changed.some(c => c.startsWith('barracks n_end'));
line(BREAK ? !changed.length : (!todo.includes('barracks') || barr), `c · ${changed.length} of ${faces} deals differ from the points as they were${BREAK ? ' (the rule left off: none may)' : `; the barracks' n_end entry is ${barr ? 'one of them' : 'NOT one of them'}`}${LIST && changed.length ? '\n    ' + changed.join('\n    ') : ''}`);
process.exit(failed ? 1 : 0);
