// 'door-grenade' (game/doortools.ts DOORTOOLS.fragHold), run through probes.ts:
//   bun run tools/qa/probes.ts door-grenade        (also under `doortools` and `all`)
// A GRENADE SCATTERS THE MEN OF A DOOR ORDER: the order waits for them before its door is opened. A start-card scenario staged as the page stages it, the
// commander stood off the door, one order given by its id, and a real defender's grenade put down at the lead's feet at a named moment of the order; the men
// get off it by their own rule (frag.ts fragFlee) and are kept from its burst (the lines are about where they are when the door goes, not about who the
// burst takes). Each line is the same run with the rule off beside it. Headless: nothing here looks at a picture or hears a line.
//   the fault, rule off     a stack on Sam's word, the grenade a second before the word: the door is opened with a man of the order still off his mark
//   the door waits          the same with the rule: 'the door waits', nothing opened until 'the men are back', then the door goes with every man on his mark
//   the word again          … and Sam's word given a second time while it waits: the door goes at once, without them
//   a locked door           an order sent on its own clock at a locked door, the grenade as the lead steps off to boot it: a boot not yet begun waits
//   one signal for two      two orders made on one signal (the scenarios' own way in), the grenade at one before the signal: neither door until its men are back
//   bang and clear          … and with a can: the can leaves a hand at the door, after the men are back
//   the charge              the grenade as the charge is being set: its man is not given up on, and 'armed' is said with every man on his mark
//   one signal, two doors   two doors on one word, the grenade at one: neither makes a sound until that door's men are back
//   no longer than the cap  `fragHoldCap` cut short: 'on without … · the order's wait is spent', and the order still ends 'in'
//   no grenade              the rule changes no beat
//   the journal             a recording from before the key replays with it off
// FRAGHOLD_BREAK=1: the rule left off where the lines want it on — red.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { standUp, ROOT } from './headless.ts';
const { DOORTOOLS } = await import(`${ROOT}/src/game/doortools.ts`);
const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const { scenarioQuery } = await import(`${ROOT}/src/scene/scenarios.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { withOfficeScript, isOfficeFamily } = await import(`${ROOT}/src/scene/level.ts`);
const { feelTables } = await import(`${ROOT}/src/game/teamfeel.ts`);
const FR: any = await import(`${ROOT}/src/game/frag.ts`);

const DT = 1 / 60, FUSE = 2.4;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : String(x));
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
/** the probe leaves the feel tables (teamfeel.ts: DOORTOOLS among them) and the grenade's own switch as it found them, pass, fail or throw */
const guarded = (fn: () => Promise<boolean>) => async () => { const T = feelTables(), keep = JSON.parse(JSON.stringify(T)), frag = FR.FRAG.on; try { return await fn(); } finally { FR.FRAG.on = frag; for (const n of Object.keys(keep)) Object.assign(T[n], keep[n]); } };
async function quiet<T>(fn: () => T | Promise<T>): Promise<T> { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } }
const levelOfFile = (file: string): any => { const data = parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8')); return isOfficeFamily(data) ? withOfficeScript(loadLevel(data)) : loadLevel(data); };
const offOf = (d: any, p: number[], side: number) => { const th = d.def.closedDir; return (Math.cos(th) * (p[2] - d.def.hinge[1]) - Math.sin(th) * (p[0] - d.def.hinge[0])) * side; };

/** the rule and its cap as the runs staged from here have them — written after each stand-up (a stand that names the rule's word writes it again every time) */
interface Knobs { rule: boolean; cap?: number; /** false = the team's slower walk and its runs (teampace.ts) held off for this run */ pace?: boolean }
async function stage(scn: string, seed: number, K: Knobs) {
  const E = SCENARIOS.find((e: any) => e.id === scn); if (!E) throw new Error(`no scenario '${scn}'`);
  Math.random = seeded(0x51c3 + seed * 7919);
  const W: any = await quiet(() => standUp({ uploadEvery: 4, ...(E.level ? { level: levelOfFile(E.level) } : {}) })); const g = W.game;
  DOORTOOLS.fragHold = K.rule; if (K.cap !== undefined) DOORTOOLS.fragHoldCap = K.cap; FR.FRAG.on = true;
  if (K.pace === false) (await import(`${ROOT}/src/game/teampace.ts`)).TEAMPACE.on = false;
  g.godMode = true; g.tune.chaos = 0.5;
  let q = scenarioQuery(E) as string; if (E.kind === 'roomclear') q = q.replace(/roomclear(=\d+)?/, `roomclear=${seed}`);
  const { why } = await quiet(() => startFromQuery(g, new URLSearchParams(q))); if (why) throw new Error(`${scn}: start refused — ${why}`);
  const R = { W, g, O: g.orders, D: g.doorTools, post: null as null | (() => void),
    step(n = 1) { for (let i = 0; i < n; i++) { g.player.visibility = 0.05; W.step(DT); R.post?.(); } },
    get team(): any[] { return R.O.squad(); }, get hostiles(): any[] { return g.guards.filter((x: any) => x.team === 'hostile'); } };
  await quiet(() => R.step(20));
  return R;
}
type Rig = Awaited<ReturnType<typeof stage>>;

/** when the grenade is put down: `word` — the order is given on Sam's word, the stack is made, the grenade lands and the word comes a second later (`word2`:
 *  and the word AGAIN a second after that) · `open` — the order goes on its own clock, the grenade lands with the men a few strides short of their marks ·
 *  `kick` — an order made as a scenario makes one (never halted at a door found shut), the grenade on the first frame the lead is off to the leaf · `gate` —
 *  two such orders on one signal, the grenade once both stacks are made, the signal a second later · `set` — a charge, the grenade a moment into its going on
 *  the door · `word-none` — no grenade, the word a second after the stack is made */
type When = 'word' | 'word2' | 'open' | 'kick' | 'gate' | 'set' | 'word-none';
interface Run {
  scn: string; door: string; kind: string; when: When; why: string | null; n: number; alive: number; ended: string; beats: { t: number; what: string }[];
  /** the grenade: when it was put down, who ran from it */
  fragT: number; ran: string[];
  /** the frame the ORDER opened its door (or its charge was called 'armed'): who of the order's living men was further than OFF m from his own mark of the order, and how far the worst was */
  goT: number; offAtGo: string[]; worst: number;
  /** … and who of them was running from the grenade on that frame */
  runAtGo: string[];
  /** each can as it left: how far from the frame its thrower stood */
  toss: number[];
  /** the leaf moved, as the grenade burst, well before the order opened it (or the order never did): the burst took it (a staging fault of the run, said as its `why`) */
  burst?: boolean;
  /** … moved at another moment before the order opened it: a man running from the grenade pushed it ajar on his way (when; printed, not judged) */
  ajar?: number;
  /** the order's lead as the grenade landed was one of those who ran */
  leadRan: boolean;
  /** a charge: when its setter was last back on the lock after the grenade (the order's own clock for the charge started anew — NaN: it never stopped) */
  lockT: number;
  /** a second door on the same word (`pairDoor`): its beats, and when ITS leaf first moved */
  other?: { door: string; beats: { t: number; what: string }[]; goT: number; ended: string };
}
const OFF = 1.5, LEAD = 1, AGAIN = 1, NEAR = 2.5, BEGUN = 0.6;
const tOf = (b: { t: number; what: string }[], re: RegExp) => b.find(x => re.test(x.what))?.t ?? NaN;
const has = (r: Run, re: RegExp) => r.beats.some(b => re.test(b.what));

export async function doorRun(scn: string, door: string, kind: string, when: When, K: Knobs, pairDoor: string | null = null, cap = 75): Promise<Run> {
  const R = await stage(scn, 1, K), g = R.g, D = R.D, O = R.O;
  const out: Run = { scn, door, kind, when, why: null, n: 0, alive: 0, ended: '', beats: [], fragT: NaN, ran: [], goT: NaN, offAtGo: [], worst: 0, runAtGo: [], toss: [], leadRan: false, lockT: NaN };
  const d = g.doors.list.find((x: any) => x.def.name === door), d2 = pairDoor ? g.doors.list.find((x: any) => x.def.name === pairDoor) : null;
  if (!d || (pairDoor && !d2)) { out.why = `no door '${!d ? door : pairDoor}'`; return out; }
  // the commander: put on open floor a few metres off the door, on the face the team is nearer (a ghost — he is put there, he does not walk)
  const mid = R.team[0]?.char.pos ?? g.player.char.pos, side = offOf(d, mid, 1) >= 0 ? 1 : -1, th = d.def.closedDir, nx = -Math.sin(th) * side, nz = Math.cos(th) * side, fc = d.frameCentre, nav = g.col.nav;
  let sam: number[] | null = null;
  for (const [back, lat] of [[3.4, 1.6], [3.4, -1.6], [4.4, 1.2], [4.4, -1.2], [2.8, 2.2], [2.8, -2.2], [5.5, 0], [2.6, 0]]) { const p = [fc[0] + nx * back + Math.cos(th) * lat, 0, fc[2] + nz * back + Math.sin(th) * lat]; if (!nav.isBlocked(p[0], p[2]) && !g.col.solidBlocked([p[0], 1.1, p[2]], [fc[0] + nx * 0.7, 1.1, fc[2] + nz * 0.7])) { sam = p; break; } }
  if (!sam) { out.why = 'no floor for the commander by that door'; return out; }
  g.teleportPlayer(sam);
  const onWord = when === 'word' || when === 'word2' || when === 'word-none', opts = onWord ? { onWord: true } : undefined;
  let op: any = null, op2: any = null, G: any = null;
  if (when === 'gate') {   // two orders on one signal, made as a scenario makes them: the team's halves, one door each, the signal not yet raised
    if (!d2) { out.why = 'a signal for two doors wants two'; return out; }
    G = D.together(false); const s2 = offOf(d2, mid, 1) >= 0 ? 1 : -1;
    const a = D.order(kind, O.men('red'), d, side, G); if (typeof a === 'string') { out.why = `${door}: ${a}`; return out; } op = a;
    const b = D.order(kind, O.men('blue'), d2, s2, G); if (typeof b === 'string') { out.why = `${pairDoor}: ${b}`; return out; } op2 = b;
  } else if (when === 'kick') { const a = D.order(kind, [...R.team], d, side); if (typeof a === 'string') { out.why = `${door}: ${a}`; return out; } op = a;
  } else if (d2) {   // two doors on one word: the team's halves, one door each
    const r1 = O.give(kind, O.targetAt(fc), 'red', opts), n1 = D.ops.length; if (r1) { out.why = `${door}: ${r1}`; return out; } op = D.ops[n1 - 1];
    const r2 = O.give(kind, O.targetAt(d2.frameCentre), 'blue', opts); if (r2) { out.why = `${pairDoor}: ${r2}`; return out; } op2 = D.ops[D.ops.length - 1];
    if (op2 === op || op2.door !== d2) { out.why = `${pairDoor}: the order made no second door`; return out; }
  } else { const r = O.give(kind, O.targetAt(fc), 'all', opts); if (r) { out.why = `${door}: ${r}`; return out; } op = D.ops[D.ops.length - 1]; }
  if (!op || op.door !== d) { out.why = `${door}: the order made no door order`; return out; }
  const sent: any[] = [...op.men], mark = new Map<any, number[]>(), god = new Map<any, boolean>(); out.n = sent.length;
  let a0 = d.angle, readyT = NaN, leafT = NaN, said = false, said2 = false, kept = 0;
  const marks = () => { for (const m of sent) { const P = op.post.get(m); if (P) mark.set(m, [P.pos[0], 0, P.pos[2]]); } };
  const all = (o: any) => o.men.every((m: any) => { const P = o.post.get(m); return !P || flat(m.char.pos, P.pos) < 0.5; });
  // the grenade: at the feet of the order's man who stands furthest from the frame — among the men, and (FAR m and more off the frame) outside the reach in
  // which its burst would take the leaf out of the frame itself (doorblast.ts DOORBLAST.tearM), which would be the grenade opening the door and not the order.
  // Nobody that far off: the floor FAR m from the frame on the line to him
  const FAR = 2.3;
  let lead0: any = null, offLock = false;
  const drop = () => { out.fragT = g.time; a0 = d.angle; lead0 = op.lead; for (const o of [op, op2]) if (o) for (const m of o.men) if (m.state !== 'dead') { god.set(m, !!m.god); m.god = true; }
    const rear = [...op.men].sort((a: any, b: any) => flat(b.char.pos, fc) - flat(a.char.pos, fc))[0].char.pos, far = flat(rear, fc), k = far >= FAR ? 1 : FAR / Math.max(far, 0.3);
    let at = [fc[0] + (rear[0] - fc[0]) * k, 0.6, fc[2] + (rear[2] - fc[2]) * k]; if (nav.isBlocked(at[0], at[2])) at = [fc[0] + nx * FAR, 0.6, fc[2] + nz * FAR];
    g.items.spawn('frag', at, [0, 0, 0], { fuse: FUSE, who: R.hostiles[0].char.id }); };
  R.post = () => { const t = g.time;
    if (isNaN(out.fragT)) {
      if (onWord) { if (isNaN(readyT) && op.phase === 'ready' && all(op) && (!op2 || (op2.phase === 'ready' && all(op2)))) { readyT = t; marks(); if (when !== 'word-none') drop(); } }
      else if (when === 'gate') { if (!isNaN(op.readyT) && !isNaN(op2.readyT) && all(op) && all(op2)) { readyT = t; marks(); drop(); } }
      else if (when === 'kick') { if (op.phase === 'kick') { marks(); drop(); } }
      else if (when === 'open') { if (op.phase === 'stack' && ++kept > 30 && op.men.every((m: any) => { const P = op.post.get(m); return !!P && flat(m.char.pos, P.pos) < NEAR; })) { marks(); drop(); } }   // (the men a few strides short of their marks: they run before the stack is called)
      else if (when === 'set') { if (op.phase === 'place' && !isNaN(op.setT) && t - op.setT > 0.3) { marks(); drop(); } }
      if (!mark.size && (op.phase !== 'stack' && op.phase !== 'place')) marks(); }
    // (the word as Sam's key gives it for the squad of four: the 'go' order, from where he stands — doortools.ts input())
    const word = () => { const p = g.player.char.pos; return O.give('go', { kind: 'none', at: [p[0], 0, p[2]] }, 'all'); };
    if (onWord && !said && !isNaN(readyT) && t - readyT >= LEAD) { said = true; const w = word(); if (w) out.why = `the word: ${w}`; }
    if (when === 'word2' && said && !said2 && t - readyT >= LEAD + AGAIN) { said2 = true; const w = word(); if (w) out.why = `the word again: ${w}`; }
    if (G && !G.go && !isNaN(readyT) && t - readyT >= LEAD) G.go = true;
    if (kind === 'charge' && !isNaN(out.fragT) && op.phase === 'place') { const on = !isNaN(op.setT); if (on && offLock) out.lockT = t; offLock = !on; }
    if (!isNaN(out.fragT)) { for (const o of [op, op2]) if (o) for (const m of o.men) if (m.state !== 'dead' && FR.fragRunning(g, m) && !out.ran.includes(m.callsign)) out.ran.push(m.callsign);
      if (god.size && t - out.fragT > FUSE + 0.5) { for (const [m, was] of god) m.god = was; god.clear(); } }
    const went = !isNaN(op.openT) || (kind === 'charge' && (op.phase === 'armed' || op.phase === 'wait' || op.phase === 'enter'));
    if (isNaN(leafT) && !isNaN(out.fragT) && Math.abs(d.angle - a0) > 0.02) leafT = t;
    if (isNaN(out.goT) && went) { out.goT = t; if (!mark.size) marks();
      for (const m of sent) { if (m.state === 'dead' || !op.men.includes(m)) continue; const q = mark.get(m); if (!q) continue; const far = flat(m.char.pos, q); out.worst = Math.max(out.worst, far); if (far > OFF) out.offAtGo.push(`${m.callsign} ${far.toFixed(1)} m`); if (FR.fragRunning(g, m)) out.runAtGo.push(m.callsign); } }
    if (op2 && out.other && isNaN(out.other.goT) && !isNaN(op2.openT)) out.other.goT = t;
    const b = op.beats, last = b[b.length - 1]; if (last && /^toss:/.test(last.what) && out.toss.length < b.filter((x: any) => /^toss:/.test(x.what)).length) { const who = sent.find((m: any) => m.callsign === last.what.slice(5)); out.toss.push(who ? flat(who.char.pos, fc) : NaN); }
  };
  if (op2) out.other = { door: pairDoor!, beats: op2.beats, goT: NaN, ended: '' };
  const done = () => !D.ops.includes(op) && (!op2 || !D.ops.includes(op2)), stop = () => kind === 'charge' ? !D.ops.includes(op) || op.phase === 'armed' : done();
  await quiet(() => { for (let i = 0; i < cap * 60 && !stop(); i++) R.step(); if (kind === 'charge') R.step(30); });
  R.post = null; for (const [m, was] of god) m.god = was;
  out.beats = op.beats.map((b: any) => ({ t: b.t, what: b.what })); out.ended = op.ended ?? `still '${op.phase}'`; out.alive = sent.filter((m: any) => m.state !== 'dead').length;
  if (out.other) { out.other.beats = op2.beats.map((b: any) => ({ t: b.t, what: b.what })); out.other.ended = op2.ended ?? `still '${op2.phase}'`; }
  const early = kind !== 'charge' && !isNaN(leafT) && !isNaN(out.fragT) && (isNaN(out.goT) || out.goT - leafT > 0.5), boom = out.fragT + FUSE;
  out.burst = early && leafT > boom - 0.1 && leafT < boom + 0.4; if (early && !out.burst) out.ajar = leafT;
  out.leadRan = !!lead0 && out.ran.includes(lead0.callsign);
  if (out.burst) out.why = "the grenade's own burst opened the door before the order did (the run's staging, not the rule)";
  return out;
}

const BACK2 = /^the men are back|^nobody left to wait for|^on without/, RAN = /^grenade on the stack · /, WAIT = /^the door waits: /, BACK = /^the men are back/, SPENT = /^on without .* · the order's wait is spent$/;
const story = (r: Run) => r.beats.filter(b => /^(stacked|ready|the word|grenade|the door waits|the men are back|nobody left|on without|kick|boot|toss:|bang|go$|set$|armed|end: )/.test(b.what)).map(b => `${f1(b.t - (isNaN(r.fragT) ? r.beats[0]?.t ?? 0 : r.fragT))} ${b.what}`).join(' | ');
const tell = (r: Run) => `${r.scn} ${r.door} ${r.kind}: ${r.why ?? `ran ${r.ran.join(', ') || 'nobody'} · as the door went ${r.runAtGo.join(', ') || 'nobody'} still running from it, ${r.offAtGo.join(', ') || 'nobody'} off his mark (worst ${f1(r.worst)} m)${r.toss.length ? ` · can from ${r.toss.map(f1).join(', ')} m` : ''}${r.ajar !== undefined ? ` · the leaf pushed ajar by a running man at ${f1(r.ajar - r.fragT)} s` : ''} · ${r.alive} of ${r.n} up · ended '${r.ended}' · ${story(r)}`}`;
const same = (a: Run, b: Run) => !a.why && !b.why && a.beats.length === b.beats.length && a.beats.every((x, k) => x.what === b.beats[k].what && Math.abs(x.t - b.beats[k].t) < 1e-6);

export const doorGrenade = guarded(async () => {
  const { verdict, done } = family('door-grenade: a grenade scatters the men of a door order — the order waits for them before its door is opened (DOORTOOLS.fragHold)');
  const BRK = process.env.FRAGHOLD_BREAK === '1', on: Knobs = { rule: !BRK }, off: Knobs = { rule: false }, K = DOORTOOLS, cap0 = K.fragHoldCap;
  const DOORS: [string, string][] = process.env.DOORG_DOORS ? JSON.parse(process.env.DOORG_DOORS) : [['depot-four', 'c_w'], ['room-clear-four', 'breakroom_w']];
  const CHARGE: [string, string][] = process.env.DOORG_CHARGE ? JSON.parse(process.env.DOORG_CHARGE) : [['room-clear-four', 'breakroom_w'], ['room-clear-pair', 'breakroom_w']];
  const PAIR: [string, string, string] = process.env.DOORG_PAIR ? JSON.parse(process.env.DOORG_PAIR) : ['room-clear-four', 'breakroom_w', 'breakroom_n'];
  const LOCKED: [string, string] = process.env.DOORG_LOCKED ? JSON.parse(process.env.DOORG_LOCKED) : ['room-clear-four', 'server'];
  const waited = (r: Run) => !r.why && r.ran.length >= 1 && has(r, RAN) && has(r, WAIT) && has(r, BACK) && !has(r, SPENT) && r.goT >= tOf(r.beats, BACK) && r.offAtGo.length === 0 && r.runAtGo.length === 0;

  // ---- a stack on the word
  const wOff: Run[] = [], wOn: Run[] = [], nOff: Run[] = [], nOn: Run[] = [], late: Run[] = [], again: Run[] = [];
  for (const [scn, door] of DOORS) {
    // (THE FAULT is staged at the pace it was found at: with teampace.ts on a man is off a grenade sooner and the lead is not back at the leaf when the word
    //  comes, so the door is not opened on running men at every one of these doors — the lines under it run at the page's pace)
    wOff.push(await doorRun(scn, door, 'openClear', 'word', { ...off, pace: false })); wOn.push(await doorRun(scn, door, 'openClear', 'word', on));
    nOff.push(await doorRun(scn, door, 'openClear', 'word-none', off)); nOn.push(await doorRun(scn, door, 'openClear', 'word-none', on));
    again.push(await doorRun(scn, door, 'openClear', 'word2', on));
    late.push(await doorRun(scn, door, 'openClear', 'word', { rule: !BRK, cap: 0.3 })); K.fragHoldCap = cap0; }
  verdict(wOff.every(r => !r.why && r.ran.length >= 1 && !has(r, WAIT) && !has(r, RAN) && r.runAtGo.length + r.offAtGo.length >= 1),
    `THE FAULT, with the rule off: the stack is made on Sam's word, a grenade lands on it, the word comes a second later — and on every one of these doors the leaf is opened and 'go' said with men of the order still running from the grenade, or further than ${OFF} m from their marks`, wOff.map(tell).join('\n    '));
  verdict(wOn.every(r => waited(r) && r.ended === 'in'),
    `WITH THE RULE THE DOOR WAITS FOR ITS MEN: 'the door waits' is said, the word makes no sound until 'the men are back', the leaf then moves with nobody running and every living man within ${OFF} m of his mark, and the order ends 'in'`, wOn.map(tell).join('\n    '));
  verdict(late.every(r => !r.why && has(r, RAN) && has(r, WAIT) && has(r, SPENT) && !(tOf(r.beats, BACK) < tOf(r.beats, SPENT)) && tOf(r.beats, SPENT) - tOf(r.beats, WAIT) < 0.3 + 0.3 && tOf(r.beats, SPENT) - tOf(r.beats, WAIT) >= 0.3 - 0.05 && r.ended === 'in'),
    "… AND NO LONGER THAN THE ORDER'S ONE WAIT, NOR SHORTER (fragHoldCap, cut to 0.3 s for this line; the wait begins when the word comes): men not back by then do not hang it — 'on without … · the order's wait is spent', and the order still ends 'in'", late.map(r => `waited ${(tOf(r.beats, SPENT) - tOf(r.beats, WAIT)).toFixed(2)} s · ${tell(r)}`).join('\n    '));
  verdict(again.every((r, k) => !r.why && has(r, WAIT) && has(r, /^the word again$/) && has(r, /^on without .* · not waited for$/) && !has(r, SPENT) && tOf(r.beats, /^on without/) - tOf(r.beats, /^the word again$/) < 0.05 && r.goT - r.fragT <= wOn[k].goT - wOn[k].fragT + 0.2),
    "… AND SAM'S WORD GIVEN AGAIN WHILE IT WAITS LETS THE ORDER GO: 'the word again', 'on without … · not waited for' on the same frame, the door opened as soon as the man who opens it is at it (at once where he did not run; never later than by waiting — the wait's own time beside it) — how an entry sent on without its men then ends is the room fight's, and printed", again.map((r, k) => `opened ${f1(r.goT - (r.fragT + LEAD + AGAIN))} s after the second word, ${f1(r.goT - r.fragT)} s after the grenade (waited for: ${f1(wOn[k].goT - wOn[k].fragT)}) · ${tell(r)}`).join('\n    '));
  verdict(nOn.every((r, k) => same(r, nOff[k]) && !has(r, RAN)),
    'NO GRENADE, the rule changes nothing: the same door on the same word plays beat for beat, to the frame, as with the rule off', nOn.map((r, k) => `${r.scn} ${r.door}: ${r.beats.length} beats with the rule, ${nOff[k].beats.length} without · ended '${r.ended}'`).join('\n    '));

  // ---- bang and clear on the word
  { const bOff: Run[] = [], bOn: Run[] = [];
    for (const [scn, door] of DOORS) { bOff.push(await doorRun(scn, door, 'bangClear', 'word', off)); bOn.push(await doorRun(scn, door, 'bangClear', 'word', on)); }
    verdict(bOn.every(r => waited(r) && r.toss.length >= 1 && r.toss.every(x => x < K.throwReach + 0.05) && tOf(r.beats, /^toss:/) >= tOf(r.beats, BACK) && r.ended === 'in'),
      `BANG AND CLEAR THE SAME: nothing is opened and no can goes until 'the men are back'; the can then leaves a hand within ${K.throwReach} m of the frame, and the order ends 'in' (the rule off beside it: printed)`, [...bOff.map(r => `off · ${tell(r)}`), ...bOn.map(r => `on  · ${tell(r)}`)].join('\n    ')); }

  // ---- an order on its own clock: the grenade as the lead goes to open it
  { const oOff: Run[] = [], oOn: Run[] = [];
    for (const [scn, door] of DOORS) { oOff.push(await doorRun(scn, door, 'openClear', 'open', off)); oOn.push(await doorRun(scn, door, 'openClear', 'open', on)); }
    verdict(oOn.every(r => !r.why && r.ran.length >= 1 && has(r, RAN) && r.offAtGo.length === 0 && r.runAtGo.length === 0 && r.ended === 'in'),
      "AN ORDER ON ITS OWN CLOCK, the grenade put down with the men a few strides short of their marks: with the rule the stack is not called and the leaf not moved until nobody is running and every living man is on his mark, and the order ends 'in' (the rule off beside it, printed: a stack already waits for a man it can see still walking — the rule says so, and keeps the stack's own cap from running out under it)", [...oOff.map(r => `off · ${tell(r)}`), ...oOn.map(r => `on  · ${tell(r)}`)].join('\n    ')); }

  // ---- a locked door: the grenade as the lead steps off the stack to it
  { const [scn, door] = LOCKED, kOff = await doorRun(scn, door, 'openClear', 'kick', off), kOn = await doorRun(scn, door, 'openClear', 'kick', on);
    const begun = !kOn.why && kOn.goT - kOn.fragT < BEGUN && !has(kOn, WAIT), held = !kOn.why && has(kOn, WAIT) && kOn.goT >= tOf(kOn.beats, BACK2) && kOn.runAtGo.length === 0;
    verdict(!kOn.why && kOn.ran.length >= 1 && has(kOn, RAN) && (begun || held) && kOn.ended === 'in',
      `A LOCKED DOOR, the order on its own clock, the grenade on the frame the lead steps off the stack to it: with the rule EITHER the boot was already begun before a man had moved (the leaf struck inside ${BEGUN} s: a blow begun is not stopped, and nothing is said to wait) OR nothing is done to the leaf until the men are back (or the wait is spent) and it is opened with nobody running from the grenade — and the order ends 'in' (which of the two this stand plays is printed; the rule off beside it)`, `${begun ? 'THE BOOT HAD BEGUN' : held ? 'THE DOOR WAITED' : 'neither'}\n    off · ${tell(kOff)}\n    on  · ${tell(kOn)}`); }

  // ---- the charge
  { const cOff: Run[] = [], cOn: Run[] = [];
    for (const [scn, door] of CHARGE) { cOff.push(await doorRun(scn, door, 'charge', 'set', off)); cOn.push(await doorRun(scn, door, 'charge', 'set', on)); }
    verdict(cOn.every(r => !r.why && r.ran.length >= 1 && has(r, RAN) && has(r, /^set$/) && (r.leadRan ? tOf(r.beats, /^set$/) - r.lockT >= DOORTOOLS.setSecs - 0.05 : has(r, WAIT)) && has(r, /^armed/) && tOf(r.beats, /^armed/) >= tOf(r.beats, BACK2) && r.offAtGo.length === 0 && r.runAtGo.length === 0 && !/^end: never made the door/.test(r.beats[r.beats.length - 1]?.what ?? '')),
      "THE CHARGE, the grenade as it is going on the door: where the man setting it runs he is not given up on, and it goes on only once he is back at the lock for its full time; where he does not (the grenade behind him) he sets it, and the others who ran are waited for before anybody stands off — either way 'armed' is said with nobody running and every living man on his mark (who ran is printed; the rule off beside it)", [...cOff.map(r => `off · ${tell(r)}`), ...cOn.map(r => `on  · ${r.leadRan ? `the man setting it ran, and was back on the lock ${f1(tOf(r.beats, /^set$/) - r.lockT)} s before it was set` : 'the man setting it stayed'} · ${tell(r)}`)].join('\n    ')); }   // (the full time is counted from the setter's own return to the lock: where all four ran, 'the men are back' is said when the LAST of them is, with the charge already going on)

  // ---- one word, two doors
  { const [scn, a, b] = PAIR, pOff = await doorRun(scn, a, 'openClear', 'word', off, b), pOn = await doorRun(scn, a, 'openClear', 'word', on, b);
    const tw = (r: Run) => `${tell(r)}\n      ${r.other ? `${r.other.door}: opened ${f1(r.other.goT - r.fragT)} s after the grenade (this door ${f1(r.goT - r.fragT)}) · ended '${r.other.ended}'` : 'no second door'}`;
    verdict(waited(pOn) && !!pOn.other && pOn.other.goT >= tOf(pOn.beats, BACK) - 1e-6 && pOn.ended === 'in',
      "ONE WORD, TWO DOORS, the grenade at one of them: with the rule NEITHER door moves before that door's men are back — the word holds its first sound for both (the rule off beside it: printed)", `off · ${tw(pOff)}\n    on  · ${tw(pOn)}`); }

  // ---- one signal for two orders (a scenario's own way in: doortools.ts together())
  { const [scn, a, b] = PAIR, gOff = await doorRun(scn, a, 'openClear', 'gate', off, b), gOn = await doorRun(scn, a, 'openClear', 'gate', on, b);
    const tw = (r: Run) => `${tell(r)}\n      ${r.other ? `${r.other.door}: opened ${f1(r.other.goT - r.fragT)} s after the grenade (this door ${f1(r.goT - r.fragT)}) · ended '${r.other.ended}'` : 'no second door'}`;
    verdict(waited(gOn) && !!gOn.other && gOn.other.goT >= tOf(gOn.beats, BACK) - 1e-6 && gOn.ended === 'in',
      "ONE SIGNAL FOR TWO ORDERS, the grenade at one stack a second before the signal is raised: with the rule 'the door waits' is said when the signal comes, and NEITHER door is opened before that door's men are back (the rule off beside it: printed)", `off · ${tw(gOff)}\n    on  · ${tw(gOn)}`); }

  // ---- the journal
  { const J = await import(`${ROOT}/src/game/journal.ts`), R = await stage('records-pair', 1, off), snap = () => JSON.parse(JSON.stringify(J.knobsSnapshot(R.g)));
    DOORTOOLS.fragHold = true; const old = snap(); delete old.tables.DOORTOOLS.fragHold; J.applyKnobs(R.g, old); const before = DOORTOOLS.fragHold;
    DOORTOOLS.fragHold = false; const own = snap(); own.tables.DOORTOOLS.fragHold = true; J.applyKnobs(R.g, own); const carried = DOORTOOLS.fragHold;
    verdict(before === false && carried === true, 'A RECORDING FROM BEFORE THE KEY replays with the rule off (journal.ts applyKnobs) — and a file that carries it keeps its own word', `no key in the file: ${before} · the key in the file, on: ${carried}`); }
  return done();
});
