// The 'same-way' probe: A PAIR GOES ROUND ONE WAY (orders.ts ORDERS.sameWay — sameWays). Run through probes.ts:
//   bun run tools/qa/probes.ts same-way        (family: ordereddoor)
// PASS / FAIL each, headless. The plan lesson's level (levels/tut-plan.json) stood up as its start deals it (the four men; the level's own enemies are at their posts — see rig()): a pair is stood side by side at a
// row of spots along the front of the hall and told to stack on the hall's back door, as a player tells it. The probe reads each man's planned way (the
// corners his order was handed, joined by the game's own path search) and measures how far apart the two ways get, with its own ruler:
//   · with the switch off the flaw is there: at some spot the two ways are a building apart (one man round the hall by each side)
//   · with it on there is no such spot, the man who changed his way walks at most what the rule allows more, and a spot where the two agreed already
//     hands out the very corners it did
//   · walked, from the worst spot: with it on the two are never far from each other and both stand on their marks; off, they part
//   · all four told at once: each pair's two ways keep together
//   · its bounds are real (no walk allowed: nobody changes; not together to begin with: left alone)
//   · off, nothing reads the rule's numbers · the stand's own word · a recording carries the key
// What it cannot say: what the walk looks like (never seen on a GPU, nobody has played it), or what it does to a fight — that is playthrough.ts's tally.
// The probe's own red path: SAMEWAY_BREAK=1 bun run tools/qa/probes.ts same-way must FAIL (the rule does nothing with its switch on).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, standUp } from './headless.ts';
const OM: any = await import(`${ROOT}/src/game/orders.ts`);
const GDM: any = await import(`${ROOT}/src/game/guards.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { LESSON } = await import(`${ROOT}/src/game/lesson.ts`);
const ORDERS = OM.ORDERS;

type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const LEVEL = 'tut-plan', BACK = [30.8, 19.0], OUT = [30.8, 0, 20.6], DT = 1 / 60;
/** the probe's own ruler: how far way `a` gets from way `b`, asked every quarter metre of `a` */
function apart(a: number[][], b: number[][]): number {
  const off = (x: number, z: number) => { let m = Infinity; for (let i = 1; i < b.length; i++) { const p = b[i - 1], q = b[i], ux = q[0] - p[0], uz = q[2] - p[2], L = ux * ux + uz * uz, k = L > 1e-9 ? Math.max(0, Math.min(1, ((x - p[0]) * ux + (z - p[2]) * uz) / L)) : 0; m = Math.min(m, Math.hypot(x - p[0] - ux * k, z - p[2] - uz * k)); } return m; };
  let d = 0; for (let i = 1; i < a.length; i++) { const p = a[i - 1], q = a[i], n = Math.max(1, Math.ceil(flat(p, q) / 0.25)); for (let s = 0; s <= n; s++) d = Math.max(d, off(p[0] + (q[0] - p[0]) * s / n, p[2] + (q[2] - p[2]) * s / n)); }
  return d; }
const lenOf = (w: number[][]) => { let m = 0; for (let i = 1; i < w.length; i++) m += flat(w[i - 1], w[i]); return m; };

interface Spot { x: number; z: number; gap: number; len: number[]; via: string; refused: string | null }
interface Rig { g: any; W: any; men: any[]; door: any; way: (m: any) => number[][] | null; put: (m: any, p: number[]) => void; tell: (who: any) => string | null }
async function rig(): Promise<Rig> {
  const W: any = await quiet(() => standUp({ uploadEvery: 4, level: loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', `${LEVEL}.json`), 'utf8'))), seed: 1 })), g = W.game;
  LESSON.on = false; const started: any = await quiet(() => startFromQuery(g, `?levelFile=${LEVEL}.json&roomclear=1&squad4`)); if (!started.spec || started.why) throw new Error(`the level did not start: ${started.why}`);
  for (const h of [...g.guards]) if (h.team !== 'operative') GDM.despawnUnit(g, h);   // (NOT an empty floor: a man taken off the roster has the start deal the floor afresh on its next frame, so the level's eight are back at their posts when the men below are looked up. Left as it is: every figure of this probe was taken so)
  for (let i = 0; i < 30; i++) W.step(DT);
  const men = g.guards.filter((m: any) => m.team === 'operative' && m.unit && m.state !== 'dead'), door = g.doors.list.find((d: any) => Math.hypot(d.pos[0] - BACK[0], d.pos[2] - BACK[1]) < 0.7);
  if (!door || men.length < 4) throw new Error(`the staging is not there: ${men.length} men, the back door ${door ? 'found' : 'not found'}`);
  const nav = g.col.nav;
  const way = (m: any): number[][] | null => { const A = g.orders.of(m); if (!A?.post) return null; const w: number[][] = [[m.char.pos[0], 0, m.char.pos[2]]]; let q = w[0]; for (const v of [...A.via, A.post]) { const leg = nav.findPath(q, v); if (!leg) return null; w.push(...leg); q = v; } return w; };
  const put = (m: any, p: number[]) => { m.char.pos[0] = p[0]; m.char.pos[2] = p[2]; m.char.vel[0] = m.char.vel[2] = 0; if (m.path) m.path.length = 0; m.pathI = 0; };
  const tell = (who: any) => g.orders.give('stack', { kind: 'door', at: door.frameCentre, door, side: OM.sideOf(door, OUT) }, who);
  return { g, W, men, door, way, put, tell };
}
/** a pair stood side by side at each spot of a row along the hall's front and told to stack on its back door: what each man was handed */
async function row(on: boolean): Promise<Spot[]> {
  const R = await rig(), { g, men } = R; ORDERS.sameWay = on;
  const pair = men[2].unit.pair, two = men.filter((m: any) => m.unit.pair === pair), out: Spot[] = [];
  const rest = men.filter((m: any) => !two.includes(m)); rest.forEach((m: any, i: number) => R.put(m, [16 + i * 1.2, 0, 9]));
  for (let x = 25; x <= 33.001; x += 0.5) for (const z of [8, 10]) { const p = [[x, 0, z], [x + 1.4, 0, z]]; if (p.some(q => g.col.nav.isBlocked(q[0], q[2]))) continue;
    R.put(two[0], p[0]); R.put(two[1], p[1]); const no = await quiet(() => R.tell(pair)), a = R.way(two[0]), b = R.way(two[1]);
    if (no || !a || !b) { out.push({ x, z, gap: -1, len: [0, 0], via: '', refused: no ?? 'no way' }); continue; }
    out.push({ x, z, gap: Math.max(apart(a, b), apart(b, a)), len: [lenOf(a), lenOf(b)], via: JSON.stringify(two.map((m: any) => g.orders.of(m).via)), refused: null }); }
  return out;
}
/** the pair walked from one spot until both stand on their marks (or a minute is up): the furthest they got from each other, and whether they arrived */
async function walk(on: boolean, x: number, z: number, all: boolean): Promise<{ far: number; farB: number; arrived: number; secs: number; of: number }> {
  const R = await rig(), { g, men, W } = R; ORDERS.sameWay = on;
  const pair = men[2].unit.pair, two = men.filter((m: any) => m.unit.pair === pair), rest = men.filter((m: any) => !two.includes(m));
  R.put(two[0], [x, 0, z]); R.put(two[1], [x + 1.4, 0, z]);
  if (all) { R.put(rest[0], [x, 0, z - 1.4]); R.put(rest[1], [x + 1.4, 0, z - 1.4]); } else rest.forEach((m: any, i: number) => R.put(m, [16 + i * 1.2, 0, 9]));
  const no = await quiet(() => R.tell(all ? 'all' : pair)); if (no) throw new Error(`the order was refused: ${no}`);
  const who = all ? men : two; let far = 0, farB = 0, secs = 0;
  for (let f = 0; f < 60 * 60; f++) { await quiet(() => W.step(DT)); secs += DT; far = Math.max(far, flat(two[0].char.pos, two[1].char.pos)); if (all) farB = Math.max(farB, flat(rest[0].char.pos, rest[1].char.pos));
    if (who.every((m: any) => g.orders.of(m)?.arrived)) break; }
  return { far, farB, arrived: who.filter((m: any) => g.orders.of(m)?.arrived).length, secs, of: who.length };
}

export async function sameWay(): Promise<boolean> {
  const F = family('same-way: two men of a pair handed one order on one door from one spot walk round a building by the same side');
  const keep = { ...ORDERS }, lesson = LESSON.on, back = () => { Object.assign(ORDERS, keep); LESSON.on = lesson; };
  try {
    let stoodOn = false; { await rig(); stoodOn = !!ORDERS.sameWay; back(); }
    const A = ORDERS.sameApartM, off = await row(false); back(); const on = await row(true); back();
    const ok = off.filter(r => !r.refused), split = ok.filter(r => r.gap > A), worst = split.slice().sort((a, b) => b.gap - a.gap)[0];
    const at = (r: Spot) => `${r.x},${r.z}`;
    F.verdict(split.length > 0 && off.every(r => !r.refused), 'with the switch off the flaw is there: from in front of the hall the pair\'s two ways part round it', `${off.length} spots along the hall's front, the pair stood 1.4 m apart, told to stack on its back door: at ${split.length} the two ways get over ${A} m apart (the widest ${worst ? worst.gap.toFixed(1) + ' m at ' + at(worst) : '—'}) · refused: ${off.filter(r => r.refused).length}`);
    const still = on.filter(r => !r.refused && r.gap > A), same = on.filter((r, i) => !off[i].refused && off[i].gap <= A), kept = same.filter(r => r.via === off[on.indexOf(r)].via);
    const more = on.map((r, i) => Math.max(r.len[0] - off[i].len[0], r.len[1] - off[i].len[1])), cap = on.every((r, i) => r.refused || [0, 1].every(k => r.len[k] <= off[i].len[k] * ORDERS.sameLong + 2 + 0.01));
    F.verdict(on.length === off.length && still.length === 0 && on.every(r => !r.refused), 'with it on there is no such spot: the second man takes the first man\'s way', `spots where the two ways get over ${A} m apart: ${split.length} → ${still.length} (want 0) · the widest now ${Math.max(...on.map(r => r.gap)).toFixed(1)} m`);
    F.verdict(cap && kept.length === same.length && same.length > 0, '… at a walk the rule allows, and where the two agreed already nothing is handed out anew', `the most a man walks more than his own way: ${Math.max(...more).toFixed(1)} m (the rule: ${ORDERS.sameLong} times his own + 2 m) · spots where they agreed with it off: ${same.length}, the same corners handed out with it on at ${kept.length}`);
    if (worst) { const wx = worst.x, wz = worst.z;
      const wOff = await walk(false, wx, wz, false); back(); const wOn = await walk(true, wx, wz, false); back();
      F.verdict(wOn.arrived === 2 && wOn.far <= A && wOff.far > A && wOff.arrived === 2, 'walked from the worst spot: with it on the two keep together all the way and both stand on their marks; off, they part', `the furthest the two got from each other: off ${wOff.far.toFixed(1)} m (${wOff.arrived} of 2 on their marks in ${wOff.secs.toFixed(0)} s) → on ${wOn.far.toFixed(1)} m (${wOn.arrived} of 2 in ${wOn.secs.toFixed(0)} s; want at most ${A} m)`);
      const fOff = await walk(false, wx, wz, true); back(); const fOn = await walk(true, wx, wz, true); back();
      F.verdict(fOn.arrived === 4 && fOn.far <= A && fOn.farB <= A && fOff.far > A, 'all four told at once: each pair\'s two men keep together (off, this pair parts)', `the furthest apart, this pair / the other: off ${fOff.far.toFixed(1)} / ${fOff.farB.toFixed(1)} m (${fOff.arrived} of 4 on their marks) → on ${fOn.far.toFixed(1)} / ${fOn.farB.toFixed(1)} m (${fOn.arrived} of 4; want at most ${A} m each)`); }
    else F.verdict(false, 'walked from the worst spot', 'no spot parted the pair: nothing to walk');
    { ORDERS.sameLong = 0; const capped = await row(true); back(); ORDERS.sameNearM = 1; const wide = await row(true); back();
      const cs = capped.filter(r => !r.refused && r.gap > A).length, ws = wide.filter((r, i) => r.via === off[i].via).length;
      F.verdict(cs === split.length && ws === off.length, 'its bounds are real: with no walk allowed over his own nobody changes his way, and two men who are not together to begin with are left alone', `sameLong 0: ${cs} of ${split.length} spots still part (want all) · sameNearM 1 (the pair stands 1.4 m apart): the corners as with it off at ${ws} of ${off.length} spots (want all)`); }
    { ORDERS.sameNearM = 50; ORDERS.sameApartM = 1; ORDERS.sameLong = 9; const moved = await row(false); back();
      F.verdict(moved.length === off.length && moved.every((r, i) => r.via === off[i].via), 'off, nothing reads it: the same corners at every spot with its numbers moved', `${moved.filter((r, i) => r.via === off[i].via).length} of ${off.length} spots the same`); }
    { const shipped = process.env.TPS_PROFILE === 'shipped', word = process.env.TPS_SAMEWAY, want = word !== undefined ? word === '1' : shipped;
      F.verdict(stoodOn === want, 'the stand: on as the page opens, off on the frozen stand (TPS_SAMEWAY has the say on either)', `stood up with it ${stoodOn ? 'on' : 'off'} · ${shipped ? 'the page\'s' : 'the frozen'} stand${word !== undefined ? `, TPS_SAMEWAY=${word}` : ''}`);
      const J: any = await import(`${ROOT}/src/game/journal.ts`), R = await rig(), snap = () => JSON.parse(JSON.stringify(J.knobsSnapshot(R.g)));
      ORDERS.sameWay = true; const own = snap(), old = snap(); delete old.tables.ORDERS.sameWay;
      ORDERS.sameWay = false; J.applyKnobs(R.g, own); const carried = ORDERS.sameWay; ORDERS.sameWay = true; J.applyKnobs(R.g, old); const before = ORDERS.sameWay;
      F.verdict(carried === true && before === false, 'a recording carries it: one made with it on replays with it on, one from before the key with it off', `the key in the file, on: ${carried} · no key: ${before}`); }
    return F.done();
  } finally { back(); }
}
