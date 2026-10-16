// THE SQUAD'S OWN ORDERED GRENADE IS NOT THROWN AT A DOOR — the check behind doortools.ts `DOORTOOLS.fragWay` (frag and clear: the thrower looks at the leaf).
// The fault it holds shut: the thrower let go a fixed 0.15 s after the shove (0.05 s after a boot) whatever the leaf had done. A defender standing behind the
// leaf stops it inside a tenth of a second; the grenade met the leaf at the frame, came back and lay a metre and a half outside the door among the stack
// (the warehouse's `off` door, frag-first: 10 teammates killed and 3 wounded in 4 runs of 144 on the build before the rule, one squad wiped on the spot).
//   bun run tools/qa/frag-own-check.ts [--off] [--verbose] [--trace]
// What it does, STAGED (no seed's luck: a played seed stops showing the fault whenever any other rule moves the run): the office's room clear with the pair,
// 'frag and clear' given on a door, and a defender stood rooted right behind the leaf from before the shove. Twice: the door shoved, and the door locked
// against the team and booted (a booted leaf keeps its speed on paper for 0.6 s while it rests against the man: the rule reads the leaf's angle and its REAL turn, not its speed on paper).
// As shipped: in both, the thrower waits on the leaf and the grenade goes back on his belt (the squad's count is back where it was), nothing bursts on the
// team's side of the door, and no man of the team is killed or folded by it. Two more stagings have NOBODY behind the leaf, shoved and booted: the grenade is thrown (shoved: on the frame
// it always was; booted: a frame or two later, once the leaf is well round) and goes off DEEP in the room, 2 m or more inside — the rule must not hold a
// throw at a door that opens, nor let it go so that it drops in the doorway.
// Then THE SWEEP: the same two stagings with the man stood 0.48 to 1.40 m behind the frame (a leaf stopped anywhere from 0.2 rad to most of the way round, the
// stop falling before, on and after the throw's frame). Thrown or held, whichever the leaf allows: nothing may burst on the team's side and nobody of the team
// may be hit (the first cut of the rule read the leaf's speed and passed the 0.42 m staging while throwing at a leaf stopped at 0.5 to 0.62 m).
//   --off   stages the same with the rule off (`DOORTOOLS.fragWay = false`): the fault as it was — expected to FAIL (exit 1): the grenade is thrown at the
//           stopped leaf and bursts on the team's side. If the fault does not show with the rule off the check proves nothing: exit 2
// exit 0 = all of the above held · 1 = it did not (or, under --off, the fault showed: the expected answer) · 2 = bad flags, or --off without the fault
import { standUp, ROOT } from './headless.ts';
const { FRAG, FRAG_LOG, FRAG_STATS, fragStatsReset } = await import(`${ROOT}/src/game/frag.ts`);
const { DOORTOOLS } = await import(`${ROOT}/src/game/doortools.ts`);

const argv = process.argv.slice(2);
for (const a of argv) if (!['--off', '--verbose', '--trace'].includes(a)) { console.error(`unknown flag ${a} (--off --verbose --trace)`); process.exit(2); }
const off = argv.includes('--off'), verbose = argv.includes('--verbose'), trace = argv.includes('--trace');
const DT = 1 / 60, f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x));
const seeded = (s: number) => () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const quiet = async <T>(fn: () => Promise<T>): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; if (!verbose) console.log = console.error = console.warn = () => {}; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };

interface Out { name: string; beats: string; thrown: boolean; waited: boolean; held: boolean; outside: number; inside: number; own: number; frags0: number; frags1: number; leaf: number; ended: boolean; why: string; trace: string[] }
/** one staging: the room clear under `seed`, Sam beside `door`, the order given; `block` = metres behind the frame's line a defender is rooted at (false = nobody) · `lock` = locked against the team (the boot) */
async function stage(name: string, door: string, sam: number[], block: number | false, lock: boolean): Promise<Out> {
  fragStatsReset(); Math.random = seeded(7);
  const W: any = await standUp(); const g = W.game; g.godMode = true;
  const out: Out = { name, beats: '', thrown: false, waited: false, held: false, outside: 0, inside: 0, own: 0, frags0: 0, frags1: 0, leaf: 0, ended: false, why: '', trace: [] };
  const why = g.roomClear.start(7); if (why) { out.why = `staging: ${why}`; return out; }
  DOORTOOLS.fragWay = !off;
  const step = (n = 1) => { for (let i = 0; i < n; i++) { g.player.visibility = 0.05; hold(); W.step(DT); } };
  const d = g.doors.list.find((x: any) => x.def.name === door), O = g.orders, D = g.doorTools, ops: any[] = g.nightBreach.ops, foes: any[] = g.nightBreach.hostiles;
  // the far face's normal: off the leaf's line, away from where Sam (and so the stack) stands
  const [hx, hz] = d.def.hinge, fc = d.frameCentre, ux = fc[0] - hx, uz = fc[2] - hz, ul = Math.hypot(ux, uz); let nx = -uz / ul, nz = ux / ul;
  if (nx * (sam[0] - fc[0]) + nz * (sam[2] - fc[2]) > 0) { nx = -nx; nz = -nz; }
  const back = block || 0.42, spot = [fc[0] + nx * back, 0, fc[2] + nz * back], man = block ? foes.filter(h => h.state !== 'dead').sort((a, b) => Math.hypot(a.char.pos[0] - spot[0], a.char.pos[2] - spot[2]) - Math.hypot(b.char.pos[0] - spot[0], b.char.pos[2] - spot[2]))[0] : null;
  // (rooted, gun down, no round — the stagger's own state — and put back on his spot every frame: a man who has walked up behind the door and stands there)
  function hold() { if (!man || man.state === 'dead') return; man.char.pos[0] = spot[0]; man.char.pos[2] = spot[2]; man.staggerUntil = g.time + 1; }
  if (block && !man) { out.why = 'staging: no defender to stand behind the door'; return out; }
  step(30); g.teleportPlayer(sam); step(5);
  if (lock) { d.locked = true; d.latched = true; d.angle = 0; d.vel = 0; }
  out.frags0 = D.frags;
  const w = O.give('fragClear', O.targetAt(fc)); if (w) { out.why = `the order was refused: ${w}`; return out; }
  const op = D.ops[0]; if (!op) { out.why = 'no op'; return out; }
  const stag0 = new Map(ops.map(m => [m, m.staggerUntil])), dead0 = new Set(ops.filter(m => m.state === 'dead'));
  let tossA = NaN;
  for (let i = 0; i < 40 * 60 && D.ops.includes(op); i++) { step(); if (trace && op.phase === 'toss') out.trace.push(`${f2(g.time - op.t0)} a ${d.angle.toFixed(3)} v ${d.vel.toFixed(2)} sb ${d.sinceBash.toFixed(2)}`); if (isNaN(tossA) && op.beats.some((b: any) => /^toss:|waits:/.test(b.what))) tossA = d.angle; }
  out.ended = !D.ops.includes(op); step(5 * 60);   // (a grenade in the air when the order ended still has its fuse to run)
  const t0 = op.t0; out.beats = op.beats.map((b: any) => `${f2(b.t - t0)} ${b.what}`).join(' | '); out.leaf = tossA;
  out.thrown = op.beats.some((b: any) => /^toss:/.test(b.what)); out.waited = op.beats.some((b: any) => /^frag waits/.test(b.what)); out.held = op.beats.some((b: any) => /^frag held/.test(b.what));
  for (const rep of FRAG_LOG as any[]) { const p = rep.pos ?? rep.at; if (!p) continue; const side = (p[0] - fc[0]) * nx + (p[2] - fc[2]) * nz; if (side < 0) out.outside++; else out.inside++; }
  if (!FRAG_LOG.length) for (const b of op.beats) { if (/^frag · OUTSIDE/.test(b.what)) out.outside++; else if (/^frag · inside/.test(b.what)) out.inside++; }
  out.own = FRAG_STATS.own + ops.filter(m => m.state === 'dead' && !dead0.has(m) && (FRAG_LOG as any[]).some(r => r.hits?.some((h: any) => h.name === m.callsign && h.result !== 'shielded'))).length;
  for (const m of ops) if (m.state !== 'dead' && m.staggerUntil > (stag0.get(m) ?? -1) + 1 && (FRAG_LOG as any[]).some(r => r.hits?.some((h: any) => h.name === m.callsign && h.result !== 'shielded'))) out.own++;
  out.frags1 = D.frags;
  return out;
}

const KEPT = JSON.parse(JSON.stringify(DOORTOOLS)), FRAG_KEPT = JSON.parse(JSON.stringify(FRAG));
const run = (name: string, door: string, sam: number[], block: number | false, lock: boolean) => quiet(async () => { try { return await stage(name, door, sam, block, lock); } finally { Object.assign(DOORTOOLS, JSON.parse(JSON.stringify(KEPT))); Object.assign(FRAG, JSON.parse(JSON.stringify(FRAG_KEPT))); } });
const SAM = [25.0, 0, 18.9], DOOR = 'breakroom_w';
const shove = await run('shoved, a man behind the leaf', DOOR, SAM, 0.42, false);
const boot = await run('booted, a man behind the leaf', DOOR, SAM, 0.42, true);
const free = off ? null : await run('shoved, nobody behind it', DOOR, SAM, false, false);
const freeBoot = off ? null : await run('booted, nobody behind it', DOOR, SAM, false, true);
const SWEEP = [0.48, 0.52, 0.55, 0.58, 0.62, 0.66, 0.70, 0.80, 0.90, 1.00, 1.10, 1.20, 1.40], sweep: Out[] = [];
const deep = (o: Out) => Math.max(0, ...[...o.beats.matchAll(/frag · inside ([\d.]+) m/g)].map(m => +m[1]));   // (how far inside the frame's line it went off)
if (!off) for (const m of SWEEP) for (const lock of [false, true]) sweep.push(await run(`${lock ? 'booted' : 'shoved'}, a man ${m.toFixed(2)} m behind`, DOOR, SAM, m, lock));

console.log(`frag-own-check · the office's ${DOOR} · frag and clear, staged · the rule ${off ? 'OFF (the fault as it was)' : 'as shipped'}`);
let fail = 0, fault = 0, broke = 0;
const say = (ok: boolean, label: string, o: Out) => { if (!ok) fail++; if (trace) console.log(o.trace.join('\n')); console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    leaf ${f2(o.leaf)} rad at the throw's frame · squad frags ${o.frags0} → ${o.frags1} · bursts ${o.inside} inside, ${o.outside} on the team's side · own hit ${o.own}\n    ${o.beats}`); };
for (const o of [shove, boot]) {
  if (o.why) { broke++; console.log(`- FAIL — ${o.name}: ${o.why}`); continue; }
  if (Math.abs(o.leaf) > 0.5 || isNaN(o.leaf)) { broke++; console.log(`- NO VERDICT — ${o.name}: the leaf was not stopped (${f2(o.leaf)} rad at the throw's frame): the staging looked at nothing\n    ${o.beats}`); continue; }
  if (off) { const showed = o.thrown && o.outside > 0; if (showed) fault++; console.log(`- ${showed ? 'FAIL' : 'NO VERDICT'} — ${o.name}: ${showed ? `the grenade was thrown at the stopped leaf and burst on the team's side (own hit ${o.own})` : 'the fault did not show'}\n    leaf ${f2(o.leaf)} rad · ${o.beats}`); continue; }
  say(o.ended && o.waited && o.held && !o.thrown && o.outside === 0 && o.own === 0 && o.frags1 === o.frags0, `${o.name}: he waits on the leaf, the grenade goes back on his belt, nothing bursts on the team's side, nobody of the team is hit`, o);
}
for (const o of [free, freeBoot]) if (o) { if (o.why) { broke++; console.log(`- FAIL — ${o.name}: ${o.why}`); } else say(o.ended && o.thrown && deep(o) >= 2 && o.outside === 0 && o.own === 0 && o.frags1 === o.frags0 - 1, `${o.name}: thrown, it goes off ${deep(o).toFixed(1)} m inside the room (2 m or more), one frag spent`, o); }
for (const o of sweep) { if (o.why) { broke++; console.log(`- FAIL — ${o.name}: ${o.why}`); continue; }
  say(o.ended && o.outside === 0 && o.own === 0 && o.frags1 === o.frags0 - (o.thrown ? 1 : 0) && (o.thrown ? o.inside > 0 : o.held), `${o.name}: ${o.thrown ? 'thrown, it goes off inside the room' : 'held, back on his belt'}, nothing bursts on the team's side, nobody of the team is hit`, o); }
if (off) { if (broke || fault < 2) { console.log(`- NO VERDICT (--off) — the fault showed in ${fault} of 2 stagings: this run proves nothing`); process.exit(2); } console.log('  (--off: the fault shows in both stagings — the check can fail)'); process.exit(1); }
if (!fail && !broke) console.log('- ALL PASS');
process.exit(fail || broke ? 1 : 0);
