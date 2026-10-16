// The 'lineoffire' family: A FRIEND IN A TEAMMATE'S LINE OF FIRE (game/clearline.ts — CLEARLINE.on, off as shipped). Run through probes.ts:
//   bun run tools/qa/probes.ts lineoffire | lineoffire-planted | lineoffire-walk | lineoffire-mate | lineoffire-corridor | lineoffire-edge | lineoffire-entry | lineoffire-behind | lineoffire-off
// PASS / FAIL each, headless. A floor of our own (the night office, the shift benched, nobody on it but whoever the probe spawns — roomfight-probes.ts's rig):
// one defender roused and looking down a line at a teammate under one of Sam's ORDERS (orders.ts poses him every frame: the case the room fight's own side
// step never survives), and a friend stood in that line. The teammate cannot be hurt (Guard.god): what is asked is what he DOES, not who wins.
//   lineoffire-planted   Sam stands still in a planted teammate's line: he says so, steps to a clear line and drops the man; two teammates masked at once take
//                        two different spots; the man down, each is back on his mark
//   lineoffire-walk      the same while he WALKS on an order to a mark beyond Sam: the step is taken out of the walk, and the walk goes on to its mark
//   lineoffire-mate      a MATE (flash-blind, going nowhere) in the line: the same step — the base never even asks for one (the gun is down before the gate)
//   lineoffire-corridor  a corridor too narrow to step square with Sam in the middle of it: he gets off the line to cover, or (no cover allowed) onto a knee,
//                        and says which; Sam nearer one wall: he moves up level with him and shoots; walking down it to a door's stack mark: the same answers
//   lineoffire-edge      CLEARLINE.afterEdge (0 as shipped = no such case): Sam in the line ONLY by the wider lane a walking player is owed (stood still where
//                        he is, the round would pass him). With afterEdge 1: he walks past and stops, or taps his walk key — no move, the line opens by itself
//                        and the teammate shoots from his mark; he keeps walking beside it — the move comes after a second, not 0.3 s. Sam's body in the
//                        standing lane (stood dead on the line, stood at the lane's rim, walking along the line) or a blind mate in it behind him: afterEdge
//                        changes nothing, to the frame. (Sam walks on his own keys here: the same WASD-from-the-camera lines as playthrough.ts's driver.)
//   lineoffire-entry     CLEARLINE.inEntry (true as shipped = the rule everywhere): a pair on 'bang and clear', the can gone off, a man comes up the
//                        corridor behind them with Sam between. As shipped both leave the door for cover and the entry is seconds late; with inEntry
//                        off they hold their way in — no step, no cover, no word between the shove and their points — and the room is taken on the
//                        entry's own clock. Outside that window the knob changes nothing, to the frame: on the walk up to the same order's stack,
//                        and for a man planted on a hold order.
//   lineoffire-behind    CLEARLINE.holdBehind (seconds; 0 as shipped = the rule as it was): Sam ahead of him in the corridor and WALKING AT the man. As shipped he
//                        leaves for cover inside a second and a half and is out of the fight; with holdBehind 2 he takes no cover and no knee, says Sam
//                        is in his line and holds on his mark with the man in view — and drops him a third of a second after Sam is out of the line
//                        (as shipped: four to five seconds). Sam stopped in the corridor: nothing for a second and a half (a halt is not a park), cover within three and a half. Sam standing from the
//                        start, or walking at the man in a room with floor to step to: the knob changes nothing, to the frame.
//   lineoffire-still     CLEARLINE.still (seconds; 0 as shipped = the rule as it was): the PLAYER on the move in his line, any direction. As shipped he steps (a
//                        room) or leaves for cover (the corridor) inside a second and a half; with still 2 he does neither while Sam walks nor for two
//                        seconds after, says Sam is in his line, and is on his mark to drop the man the moment Sam is out of it. Sam standing from the
//                        start: the knob changes nothing, to the frame.
//   lineoffire-far       CLEARLINE.stillFar (metres; 0 as shipped = `still` at any range): with still 2 and stillFar 8 a man whose target is nearer than 8 m steps
//                        for a walking player exactly as the rule as first built; at 11.6 m down a corridor he holds exactly as still 2 alone; a standing player is answered at any range
//   lineoffire-holdstep  CLEARLINE.holdStep (true as shipped, with holdBehind 2; every other probe stages the rule as first built, both off): behind a lead walking AT the man no step is taken either; the lead stopped, or standing: as it was
//   lineoffire-off       switch off: none of it — no round, no step, no word, nothing counted (the build as it was; the run-for-run identity against the base
//                        commit is playthrough.ts's PT_DIGEST, not this)
// Every ON case also asks: no teammate's round within a friend's lane (0.45 m of Sam, 0.3 of a mate, in plan, at the flight's height), and nobody faster than
// the team's walking pace (guards.ts PACE.max).
// The family's own red path: LINEOFFIRE_BREAK=1 bun run tools/qa/probes.ts lineoffire must FAIL every on-case (the switch left off under them = the base).
import { standUp, ROOT } from './headless.ts';
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const { spawnUnit, PACE } = await import(`${ROOT}/src/game/guards.ts`);
const { ROOMFIGHT } = await import(`${ROOT}/src/game/roomfight.ts`);
const CLM: any = await import(`${ROOT}/src/game/clearline.ts`);
const CLEARLINE = CLM.CLEARLINE;
const BREAK = !!process.env.LINEOFFIRE_BREAK;
const DT = 1 / 60;

type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x)), at = (p: number[]) => `(${p[0].toFixed(1)}, ${p[2].toFixed(1)})`;
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const KEEP = { ...CLEARLINE }, KEEP_RF = { ...ROOMFIGHT };
const restore = () => { Object.assign(CLEARLINE, KEEP); Object.assign(ROOMFIGHT, KEEP_RF); };
/** THE RULE AS FIRST BUILT: what every staging below starts from unless it says `shipped` (the switch's on form has since taken holdBehind 2 + holdStep) */
const FIRST = { holdBehind: 0, holdStep: false };
const guarded = (fn: () => Promise<boolean>) => async () => { try { return await fn(); } finally { restore(); } };

interface Man { gd: any; rounds: number; first: number; maxV: number; idle: number; walked: number; last: number[] }
interface Setup { /** stage the knobs AS SHIPPED, not as first built */ shipped?: boolean; seed?: number; on: boolean; T: number[][]; sam: number[]; foe: number[]; mate?: number[]; move?: number[]; stack?: string; knobs?: Record<string, unknown>; secs?: number; /** Sam WALKS (his own keys, his own pace) to this point from the first frame of the meeting, and lets go of the keys `samStop` s in */ samWalk?: number[]; samStop?: number; /** … or holds the keys only inside these [from, to] windows of seconds */ samTaps?: number[][]; /** the man cannot be dropped (every masked teammate has to find his own line) */ foeGod?: boolean; /** the mate is not blind: on a hold order of his own, on the man */ mateSees?: boolean }
/** one staged meeting, played `secs` seconds: what each teammate did, every word said, every team round's nearest pass to a friend */
async function meet(o: Setup) {
  restore(); Object.assign(CLEARLINE, o.shipped ? {} : FIRST, o.knobs ?? {}); CLEARLINE.on = o.on && !BREAK;
  for (const k of Object.keys(CLM.CLEARLINE_STATS)) CLM.CLEARLINE_STATS[k] = 0; CLM.CLEARLINE_LOG.length = 0;
  Math.random = seeded(0x10f + (o.seed ?? 1) * 7919);
  const W: any = await quiet(() => standUp()); const g = W.game;
  for (const gd of g.guards) { gd.flashlight.enabled = false; g.engine.lights.remove(gd.flashlight); }
  g.guards = []; g.tune.civilians = false; g.tune.qrf = false; g.tune.devices = false; g.tune.chaos = 0;
  await quiet(() => g.restartEncounter());
  g.godMode = true; g.playerInvisible = true;
  for (const grp of ['breakroom', 'corridor']) g.setGroup(grp, true);
  const spawn = (team: string, pos: number[], facing: number[], name: string) => spawnUnit(g, { team, pos: [pos[0], 0, pos[2]], yaw: v3.yawTo([pos[0], 0, pos[2]], [facing[0], 0, facing[2]]), light: false, name });
  const foe = spawn('hostile', o.foe, o.T[0], 'Tango 1');
  const men: Man[] = o.T.map((p, i) => ({ gd: spawn('operative', p, o.foe, i ? 'Blue Two' : 'Blue One'), rounds: 0, first: -1, maxV: 0, idle: 0, walked: 0, last: [...p] }));
  const mate = o.mate ? spawn('operative', o.mate, o.mateSees ? o.foe : [o.mate[0] * 2 - o.foe[0], 0, o.mate[2] * 2 - o.foe[2]], 'Blue Three') : null;   // (his back to the man: he is no help, and no target of the probe)
  for (const m of men) m.gd.god = true; if (mate) mate.god = true; if (o.foeGod) foe.god = true;
  g.teleportPlayer([o.sam[0], 0, o.sam[2]]);
  const said: { t: number; who: string; text: string }[] = []; const say0 = g.say.bind(g);
  g.say = (gd: any, text: string, ...r: any[]) => { said.push({ t: g.time, who: gd?.callsign ?? '-', text }); return say0(gd, text, ...r); };
  let pass = Infinity, passWho = '', foeDown = -1, t0 = 0; const seen = new Set<any>();
  const scan = () => {
    for (const e of g.events) {
      if (seen.has(e)) continue; seen.add(e); if (e.kind !== 'guardShot' || !e.from || !e.to) continue;
      const m = men.find(x => x.gd.char.id === e.who); if (!m) continue;
      m.rounds++; if (m.first < 0) m.first = g.time - t0;
      const friends: [string, any, number][] = [['Sam', g.player.char, 0.45], ...g.guards.filter((x: any) => x.team === 'operative' && x !== m.gd && x.state !== 'dead').map((x: any) => [x.callsign, x.char, 0.3] as [string, any, number])];
      for (const [name, ch, lane] of friends) {
        const h = ch.bones.hips ?? ch.pos, dx = e.to[0] - e.from[0], dz = e.to[2] - e.from[2], L2 = dx * dx + dz * dz; if (L2 < 1e-6) continue;
        const t = Math.max(0, Math.min(1, ((h[0] - e.from[0]) * dx + (h[2] - e.from[2]) * dz) / L2)); if (t <= 0) continue;   // (level with or behind the muzzle: not in front of the gun)
        const y = e.from[1] + (e.to[1] - e.from[1]) * t; if (y < ch.pos[1] - 0.05 || y > ch.pos[1] + 1.9) continue;
        const d = Math.hypot(e.from[0] + dx * t - h[0], e.from[2] + dz * t - h[2]) - lane;   // (metres to spare past his lane: under 0 is a round inside it)
        if (d < pass) { pass = d; passWho = `${m.gd.callsign} past ${name}, ${f2(d + lane)} m off him`; }
      }
    }
  };
  let samOff: [number, number] = [Infinity, 0], samV = 0; const samAt = () => g.player.char.pos, lane = { edge: 0, body: 0 };   // (frames Sam was in the first man's line only by his walking lane / bodily, before the rule's first move)
  const step = (n = 1) => { for (let i = 0; i < n; i++) {
    g.player.visibility = 0.05; if (mate && !o.mateSees) mate.dazzledUntil = g.time + 1;
    if (o.samWalk) { const I = W.input, P = samAt(); for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) I.keys.delete(k);
      const dx = o.samWalk[0] - P[0], dz = o.samWalk[2] - P[2], d = Math.hypot(dx, dz);
      const tt = g.time - t0; if (t0 > 0 && (o.samTaps ? o.samTaps.some(w => tt >= w[0] && tt < w[1]) : tt < (o.samStop ?? Infinity)) && d > 0.2) { const { fwd, right } = W.cam.planarBasis(), a = (dx * fwd[0] + dz * fwd[2]) / d, b = (dx * right[0] + dz * right[2]) / d, T = 0.3827;
        if (a > T) I.keys.add('KeyW'); if (a < -T) I.keys.add('KeyS'); if (b > T) I.keys.add('KeyD'); if (b < -T) I.keys.add('KeyA'); W.cursorAt([P[0] + dx / d * 4, 1.1, P[2] + dz / d * 4]); } }
    const sam0 = [samAt()[0], 0, samAt()[2]];
    W.step(DT); scan();
    if (t0 > 0 && foe.state !== 'dead' && !CLM.CLEARLINE_LOG.length) {   // up to the rule's first move: where Sam is against the first man's gun line, by the FIRE GATE's own test (roomfight.ts friendInLine) — as he is, and as if he stood still
      samV = Math.max(samV, flat(samAt(), sam0) / DT);
      const c = men[0].gd.char, h = g.player.char.bones.hips ?? samAt(), to = [foe.char.pos[0], 1.2, foe.char.pos[2]], sh = c.bones.upperArmR ?? [c.pos[0], 1.4, c.pos[2]];
      const tx = to[0] - sh[0], tz = to[2] - sh[2], L = Math.hypot(tx, tz) || 1, off = Math.abs(tx * (h[2] - sh[2]) - tz * (h[0] - sh[0])) / L;
      const inNow = [c.muzzle, sh].some(f => g.fight.friendInLine(f, to, men[0].gd) === 'player'), inStill = [c.muzzle, sh].some(f => g.fight.friendInLine(f, to, men[0].gd, true) === 'player');
      if (inNow) { samOff = [Math.min(samOff[0], off), Math.max(samOff[1], off)]; if (inStill) lane.body++; else lane.edge++; } }
    if (foe.state === 'dead' && foeDown < 0) foeDown = g.time - t0;
    for (const m of men) { const c = m.gd.char, v = Math.hypot(c.vel[0], c.vel[2]); m.maxV = Math.max(m.maxV, v); m.walked += flat(c.pos, m.last); m.last = [c.pos[0], 0, c.pos[2]];
      // stood upright and still with his gun down in the living man's plain sight, a friend masking him: the thing the rule is there to end
      if (foe.state !== 'dead' && g.time - t0 > 1 && v < 0.3 && m.gd.muzzleDown && !(c.anim.crouchTarget > 0.5) && !g.col.segmentBlocked(foe.char.bones.head ?? [foe.char.pos[0], 1.6, foe.char.pos[2]], [c.pos[0], 1.1, c.pos[2]])) m.idle += DT; }
  } };
  step(2);
  const O = g.orders; let why: string | null = null;
  if (mate && o.mateSees) why = O.give('hold', O.targetAt(o.mate!), 'all');
  if (o.stack) { const d = g.doors.byName(o.stack); why ??= O.give('stack', O.targetAt([d.frameCentre[0], 0, d.frameCentre[2]]), men[0].gd); }
  else if (o.move) why ??= O.give('move', O.targetAt(o.move), men[0].gd);
  else for (const p of o.T) why ??= O.give('hold', O.targetAt(p), 'all');   // (a point under a teammate is an order to that man: each holds where he stands)
  foe.state = 'alert'; foe.awareness = 1; foe.lastKnown = [o.T[0][0], 0, o.T[0][2]]; g.fight.hotT = g.time; t0 = g.time;
  for (const m of men) if (!O.of(m.gd)) why ??= `${m.gd.callsign} took no order`;
  const marks = men.map(m => { const A = O.of(m.gd); return A?.post ? [...A.post] : [...m.gd.char.pos]; });
  for (let i = 0; i < (o.secs ?? 10) * 60; i++) step();
  const cues = said.filter(s => /^blocked|^no shot — (getting|you|Blue)/.test(s.text));
  return { g, O, foe, men, mate, said, cues, pass, passWho, foeDown, why, marks, samOff: () => samOff, samV: () => samV, lane, samEnd: () => [...samAt()], stats: { ...CLM.CLEARLINE_STATS }, log: [...CLM.CLEARLINE_LOG], t0,
    hidden: (m: Man) => g.col.segmentBlocked(foe.char.bones.head ?? [foe.char.pos[0], 1.6, foe.char.pos[2]], [m.gd.char.pos[0], 0.9, m.gd.char.pos[2]]),
    step, cueAt: () => cues.length ? cues[0].t - t0 : -1 };
}
/** the two things every on-case owes: no round inside a friend's lane, nobody over the team's pace */
function safe(verdict: Verdict, runs: Awaited<ReturnType<typeof meet>>[]) {
  let pass = Infinity, who = '', v = 0, rounds = 0; for (const R of runs) { if (R.pass < pass) { pass = R.pass; who = R.passWho; } for (const m of R.men) { v = Math.max(v, m.maxV); rounds += m.rounds; } }
  verdict(pass > 0 && v <= PACE.max + 0.05, `no teammate's round inside a friend's lane, and nobody faster than the team's walking pace (${PACE.max} m/s)`,
    `${rounds} team rounds over ${runs.length} runs · nearest to a lane: ${Number.isFinite(pass) ? `${f2(pass)} m to spare (${who})` : 'no friend in front of any round'} · fastest ${f2(v)} m/s`);
}
// the floor: the break room's open east half (a 6 m line across it), and the corridor (standing room about 1.1 m wide between its walls)
const ROOM = { T: [29.0, 0, 15.5], sam: [31.0, 0, 15.5], foe: [34.4, 0, 15.5] };
const SEEDS = [1, 2, 3];

export const lineoffirePlanted = guarded(async () => {
  const F = family('lineoffire-planted: Sam stood still in a planted teammate\'s line to a man aiming at them — he says so, steps clear, and shoots');
  try {
    const runs = [];
    for (const seed of SEEDS) for (const sam of [ROOM.sam, [30.2, 0, 15.6], [32.4, 0, 15.4]]) runs.push(await meet({ seed, on: true, T: [ROOM.T], sam, foe: ROOM.foe }));
    const first = runs.map(R => R.men[0].first), cue = runs.map(R => R.cueAt()), down = runs.map(R => R.foeDown), idle = runs.map(R => R.men[0].idle);
    F.verdict(cue.every(t => t >= 0 && t < 1.5) && runs.every(R => /stepping|moving up/.test(R.cues[0]?.text ?? '')), 'he says what he is doing inside a second and a half of being masked', `${runs.length} runs (3 seeds × Sam at 3 places in the line) · said at ${cue.map(f2).join(' ')} s · '${[...new Set(runs.map(R => R.cues[0]?.text))].join("' / '")}'`);
    F.verdict(first.every(t => t >= 0 && t < 4) && down.every(t => t >= 0 && t < 6), 'a round at the man inside four seconds, the man down inside six', `first round at ${first.map(f2).join(' ')} s · man down at ${down.map(f2).join(' ')} s · steps taken ${runs.map(R => R.stats.steps).join(' ')}`);
    F.verdict(idle.every(t => t < 1.5) && runs.every(R => R.men[0].walked > 0.4), 'he does not stand in the man\'s sight with his gun down', `s stood upright, still, gun down, in the man's sight: ${idle.map(f2).join(' ')} · walked ${runs.map(R => f2(R.men[0].walked)).join(' ')} m`);
    for (const R of runs) R.step(240);
    F.verdict(runs.every(R => flat(R.men[0].gd.char.pos, R.marks[0]) < 0.45 && !CLM.clearLineOf(R.g, R.men[0].gd)), 'the man down, he is back on the mark his order gave him', `metres off his mark four seconds on: ${runs.map(R => f2(flat(R.men[0].gd.char.pos, R.marks[0]))).join(' ')}`);
    // two teammates masked at once, and a man who will not drop (Guard.god): each has to find a line of his own, clear of Sam AND of the other
    const P = await meet({ seed: 1, on: true, T: [[29.0, 0, 15.2], [29.0, 0, 16.0]], sam: ROOM.sam, foe: ROOM.foe, foeGod: true, secs: 8 });
    const ends = P.men.map(m => m.gd.char.pos);
    F.verdict(!P.why && P.men.every(m => m.rounds > 0 && m.first < 5) && flat(ends[0], ends[1]) >= 0.8, 'two teammates masked at once (the man cannot be dropped): both find a line and fire, a body\'s width apart or more', `first rounds at ${P.men.map(m => f2(m.first)).join(' / ')} s · rounds ${P.men.map(m => m.rounds).join(' + ')} · they end ${f2(flat(ends[0], ends[1]))} m apart at ${ends.map(at).join(' and ')} · steps ${P.stats.steps}`);
    safe(F.verdict, [...runs, P]);
  } catch (err) { F.verdict(false, 'the probe ran', err instanceof Error ? (err.stack ?? err.message) : String(err)); }
  return F.done();
});

export const lineoffireWalk = guarded(async () => {
  const F = family('lineoffire-walk: Sam in his line while he WALKS on an order to a mark beyond him — the step is taken out of the walk, then the walk goes on');
  try {
    const goal = [32.6, 0, 15.6], runs = [];
    for (const seed of SEEDS) for (const sam of [[30.6, 0, 15.5], [31.4, 0, 15.6]]) runs.push(await meet({ seed, on: true, T: [ROOM.T], sam, foe: ROOM.foe, move: goal, secs: 12 }));
    const first = runs.map(R => R.men[0].first), cue = runs.map(R => R.cueAt()), down = runs.map(R => R.foeDown);
    F.verdict(runs.every(R => !R.why) && cue.every(t => t >= 0 && t < 1.5), 'he says what he is doing inside a second and a half', `said at ${cue.map(f2).join(' ')} s · '${[...new Set(runs.map(R => R.cues[0]?.text))].join("' / '")}'`);
    F.verdict(first.every(t => t >= 0 && t < 4) && down.every(t => t >= 0 && t < 4.5), 'a round at the man inside four seconds (the base walks on with his gun down, or holds short, and fires after five and a half)', `first round at ${first.map(f2).join(' ')} s · man down at ${down.map(f2).join(' ')} s`);
    F.verdict(runs.every(R => flat(R.men[0].gd.char.pos, goal) < 0.45 && R.O.of(R.men[0].gd)?.arrived), 'and the walk is finished: he is on the mark he was sent to', `metres off the mark at twelve seconds: ${runs.map(R => f2(flat(R.men[0].gd.char.pos, goal))).join(' ')}`);
    safe(F.verdict, runs);
  } catch (err) { F.verdict(false, 'the probe ran', err instanceof Error ? (err.stack ?? err.message) : String(err)); }
  return F.done();
});

export const lineoffireMate = guarded(async () => {
  const F = family('lineoffire-mate: a mate (flash-blind, going nowhere) in his line — he steps clear of him and shoots');
  try {
    const runs = [];
    for (const seed of SEEDS) for (const mate of [[31.0, 0, 15.5], [30.4, 0, 15.6]]) runs.push(await meet({ seed, on: true, T: [ROOM.T], sam: [29.5, 0, 21.5], foe: ROOM.foe, mate }));
    const first = runs.map(R => R.men[0].first), cue = runs.map(R => R.cueAt()), down = runs.map(R => R.foeDown);
    F.verdict(cue.every(t => t >= 0 && t < 1.5), 'he says what he is doing inside a second and a half', `said at ${cue.map(f2).join(' ')} s · '${[...new Set(runs.map(R => R.cues[0]?.text))].join("' / '")}'`);
    F.verdict(first.every(t => t >= 0 && t < 4) && down.every(t => t >= 0 && t < 6), 'a round at the man inside four seconds, the man down inside six', `first round at ${first.map(f2).join(' ')} s · man down at ${down.map(f2).join(' ')} s`);
    // a mate who HAS the man (not blind, on him — the man cannot be dropped): the man behind, walking on an order, is a file's second man, not a masked gun
    const G = []; for (const seed of SEEDS) G.push(await meet({ seed, on: true, T: [[28.6, 0, 15.5]], sam: [29.5, 0, 21.5], foe: ROOM.foe, mate: [31.2, 0, 15.5], mateSees: true, foeGod: true, move: [30.0, 0, 15.5], secs: 8 }));
    F.verdict(G.every(R => !R.why && R.stats.covers + R.stats.kneels + R.stats.steps === 0 && R.O.of(R.men[0].gd)?.arrived && flat(R.men[0].gd.char.pos, [30.0, 0, 15.5]) < 0.45), 'a mate who has the man himself: the one sent up behind him is a file\'s second man, not a masked gun — no step, no cover, no knee, and he is on his mark',
      `cover ${G.map(R => R.stats.covers).join(' ')} · knee ${G.map(R => R.stats.kneels).join(' ')} · steps ${G.map(R => R.stats.steps).join(' ')} · m off his mark ${G.map(R => f2(flat(R.men[0].gd.char.pos, [30.0, 0, 15.5]))).join(' ')} · ${G.map(R => R.O.statusOf(R.men[0].gd)).join(' / ')}${G[0].why ? ` · order refused: ${G[0].why}` : ''}`);
    safe(F.verdict, [...runs, ...G]);
  } catch (err) { F.verdict(false, 'the probe ran', err instanceof Error ? (err.stack ?? err.message) : String(err)); }
  return F.done();
});

export const lineoffireCorridor = guarded(async () => {
  const F = family('lineoffire-corridor: nowhere to step square to the line — off the line to cover, or a knee; room beside Sam — up level with him; and on the walk to a stack');
  try {
    const T = [24.0, 0, 11.25], foe = [29.8, 0, 11.25], mid = [25.2, 0, 11.25];
    // (a) Sam in the middle of the corridor: no spot beside him clears his lane
    const A = []; for (const seed of SEEDS) A.push(await meet({ seed, on: true, T: [T], sam: mid, foe }));
    F.verdict(A.every(R => R.stats.covers + R.stats.kneels + R.stats.steps > 0 && R.cueAt() >= 0 && R.cueAt() < 1.5), 'Sam mid-corridor: he does something about it and says what, inside a second and a half',
      `${A.map(R => `${R.log.filter((n: any) => n.what !== 'end').map((n: any) => n.what).join('→') || 'nothing'} ('${R.cues[0]?.text ?? ''}' at ${f2(R.cueAt())} s)`).join(' · ')}`);
    F.verdict(A.every(R => R.men[0].idle < 2), 'and he does not stand in the man\'s sight with his gun down (under two seconds of ten)', `s stood upright, still, gun down, in the man's sight: ${A.map(R => f2(R.men[0].idle)).join(' ')} · rounds ${A.map(R => R.men[0].rounds).join(' ')} · man down at ${A.map(R => f2(R.foeDown)).join(' ')}`);
    // (b) the same with no cover allowed: the knee, and the word for Sam
    const B = await meet({ seed: 1, on: true, T: [T], sam: mid, foe, knobs: { cover: false }, secs: 6 });
    F.verdict(B.stats.kneels > 0 && B.men[0].gd.char.anim.crouchTarget > 0.5 && B.cues.some(c => /in my line/.test(c.text)) && B.men[0].walked < 1.2, 'no cover to be had (the knob off): he goes down on a knee where he is and tells Sam he is in his line', `kneels ${B.stats.kneels} · crouched ${B.men[0].gd.char.anim.crouchTarget > 0.5} · '${B.cues.map(c => c.text).join("' / '")}' · walked ${f2(B.men[0].walked)} m`);
    // (c) Sam against the south wall: room to come up level with him on the north side
    const C = []; for (const seed of SEEDS) C.push(await meet({ seed, on: true, T: [T], sam: [25.2, 0, 11.75], foe }));
    F.verdict(C.every(R => R.stats.steps > 0 && R.men[0].first >= 0 && R.men[0].first < 5 && R.foeDown >= 0 && R.foeDown < 7), 'Sam nearer one wall: he steps to the open side (up level with him where it takes that) and drops the man',
      `first round at ${C.map(R => f2(R.men[0].first)).join(' ')} s · man down at ${C.map(R => f2(R.foeDown)).join(' ')} s · ${C.map(R => `'${R.cues[0]?.text ?? ''}'`).join(' ')} · up level ${C.map(R => R.stats.up).join(' ')}`);
    // (d) walking down the corridor to a door's stack mark, Sam ahead of him in the middle (the glass tuning part's case)
    const D = []; for (const seed of SEEDS) D.push(await meet({ seed, on: true, T: [[22.0, 0, 11.25]], sam: [24.4, 0, 11.25], foe: [33.6, 0, 11.25], stack: 'breakroom_n', secs: 10 }));
    F.verdict(D.every(R => !R.why && R.cueAt() >= 0 && R.men[0].idle < 2), 'on the walk to a stack mark with Sam ahead in the corridor: he says it and does not stand masked in the man\'s sight',
      `${D.map(R => `${R.log.filter((n: any) => n.what !== 'end').map((n: any) => n.what).join('→') || 'nothing'} ('${R.cues[0]?.text ?? ''}' at ${f2(R.cueAt())} s, idle ${f2(R.men[0].idle)} s, rounds ${R.men[0].rounds}, man down ${f2(R.foeDown)})`).join(' · ')}${D[0].why ? ` · order refused: ${D[0].why}` : ''}`);
    // … and the order ENDS: cover has a time limit (CLEARLINE.holdMax), after which his order's legs are his again — Sam stood there all day does not park him
    for (const R of D) R.step(18 * 60);
    F.verdict(D.every(R => R.O.of(R.men[0].gd)?.arrived && !CLM.clearLineOf(R.g, R.men[0].gd)), 'and the order still ends: twenty-eight seconds on he is on the stack mark he was sent to, Sam still in the corridor', `arrived ${D.map(R => !!R.O.of(R.men[0].gd)?.arrived).join(' ')} · at ${D.map(R => at(R.men[0].gd.char.pos)).join(' ')} · covers ${D.map(R => R.stats.covers).join(' ')}`);
    safe(F.verdict, [...A, B, ...C, ...D]);
  } catch (err) { F.verdict(false, 'the probe ran', err instanceof Error ? (err.stack ?? err.message) : String(err)); }
  return F.done();
});

export const lineoffireEdge = guarded(async () => {
  const F = family('lineoffire-edge: Sam in the line ONLY by the wider lane a walking player is owed — with CLEARLINE.afterEdge the teammate gives it a second before moving');
  try {
    const moves = (R: any) => R.log.filter((n: any) => n.what !== 'end').length, off = (R: any) => `${f2(R.samOff()[0])}–${f2(R.samOff()[1])}`, fr = (R: any) => `${R.lane.edge}e/${R.lane.body}b`;
    const both = async (o: Omit<Setup, 'on'>) => { const R1 = [], R0 = []; for (const seed of SEEDS) { R1.push(await meet({ ...o, seed, on: true, knobs: { ...o.knobs, afterEdge: 1 } })); R0.push(await meet({ ...o, seed, on: true, knobs: { ...o.knobs, afterEdge: 0 } })); } return [R1, R0]; };
    const same = (R1: any[], R0: any[]) => R1.every((R, i) => R.cueAt() >= 0 && Math.abs(R.cueAt() - R0[i].cueAt()) < 1e-6 && Math.abs(R.foeDown - R0[i].foeDown) < 1e-6 && moves(R) === moves(R0[i]));
    // Sam walks ALONGSIDE the gun line, his hips about 0.65 m off it: standing there he is outside the 0.45 m lane, walking he is inside the wider one
    const side = { T: [ROOM.T], sam: [30.2, 0, 14.98], foe: ROOM.foe, samWalk: [33.4, 0, 14.98] };
    // (1) he walks 0.8 s and stops: the line opens by itself
    const [A1, A0] = await both({ ...side, samStop: 0.8 });
    F.verdict(A1.every(R => !R.why && R.lane.edge >= 10 && R.lane.body === 0 && R.samV() > 1.2), 'the staging: Sam walks beside the line at his own pace, in it by the fire gate\'s own test and out of it by the same test asked as if he stood still', `frames in the line before any move (edge only / bodily): ${A1.map(fr).join(' ')} · his hips ${A1.map(off).join(' ')} m off it · pace ${A1.map(R => f2(R.samV())).join(' ')} m/s · stops at ${A1.map(R => at(R.samEnd())).join(' ')}`);
    F.verdict(A1.every(R => moves(R) === 0 && R.cues.length === 0 && R.men[0].rounds > 0 && R.foeDown >= 0 && R.foeDown < 4), 'afterEdge 1, Sam walks past for 0.8 s and stops: no move, no word — the line opens by itself and he shoots from where he stands', `moves ${A1.map(moves).join(' ')} · words ${A1.map(R => R.cues.length).join(' ')} · man down at ${A1.map(R => f2(R.foeDown)).join(' ')} s · walked ${A1.map(R => f2(R.men[0].walked)).join(' ')} m`);
    F.verdict(A0.every(R => moves(R) >= 1 && R.cueAt() >= 0 && R.cueAt() < 0.9), '… and the same walk with afterEdge 0 (the rule as it was): he moves for it, inside 0.9 s — the move the knob is there to spare', `moves ${A0.map(moves).join(' ')} · said at ${A0.map(R => f2(R.cueAt())).join(' ')} s ('${[...new Set(A0.map(R => R.cues[0]?.text))].join("' / '")}')`);
    // (1b) he TAPS his walk key three times: the line shuts and opens by itself three times — masked for a fraction of a second each, never a second on end
    const taps = [[0.3, 0.5], [0.85, 1.0], [1.35, 1.6]], T1 = [];
    for (const seed of SEEDS) T1.push(await meet({ ...side, seed, on: true, foeGod: true, secs: 4, samTaps: taps, knobs: { afterEdge: 1 } }));
    F.verdict(T1.every(R => moves(R) === 0 && R.lane.edge >= 6 && R.lane.body === 0 && R.men[0].rounds > 0), 'afterEdge 1, Sam taps his walk key three times in a second and a half: the wait is seconds masked WITHOUT A BREAK — no move, and he fires in the gaps', `moves ${T1.map(moves).join(' ')} · frames in the line ${T1.map(fr).join(' ')} · rounds ${T1.map(R => R.men[0].rounds).join(' ')} (the man cannot be dropped)`);
    // (2) he keeps walking beside it: still masked after the longer breath, so the teammate moves — at afterEdge, not at `after`
    const [B1, B0] = await both({ ...side, foeGod: true, secs: 4 });
    F.verdict(B1.every((R, i) => R.cueAt() >= 1.0 && R.cueAt() < 1.8 && B0[i].cueAt() >= 0 && R.cueAt() - B0[i].cueAt() >= 0.5 && R.lane.body === 0), 'afterEdge 1, Sam keeps walking beside the line: he moves once it has been masked a second, not before', `said at ${B1.map(R => f2(R.cueAt())).join(' ')} s with afterEdge 1 · at ${B0.map(R => f2(R.cueAt())).join(' ')} s with afterEdge 0 · frames ${B1.map(fr).join(' ')}`);
    // (3) Sam's BODY in the standing lane: afterEdge changes nothing, to the frame —
    //     stood dead on the line · stood at the lane's rim (his feet 0.5 m off the shoulder line, his hips inside 0.45) · walking along the line itself
    const [C1, C0] = await both({ T: [ROOM.T], sam: ROOM.sam, foe: ROOM.foe }), [E1, E0] = await both({ T: [ROOM.T], sam: [31.0, 0, 15.15], foe: ROOM.foe });
    F.verdict(same(C1, C0) && C1.every(R => R.cueAt() < 0.9 && R.lane.edge === 0), 'Sam stood dead ON the line: the same word, the same moves, the man down at the same moment whatever afterEdge is', `said at ${C1.map(R => f2(R.cueAt())).join(' ')} / ${C0.map(R => f2(R.cueAt())).join(' ')} s (afterEdge 1 / 0) · man down ${C1.map(R => f2(R.foeDown)).join(' ')} / ${C0.map(R => f2(R.foeDown)).join(' ')} s`);
    F.verdict(same(E1, E0) && E1.every(R => R.cueAt() < 0.9 && R.lane.edge === 0 && R.lane.body > 0), 'Sam stood still at the RIM of the standing lane (in it by the gate\'s test): the same, to the frame — standing is never the edge case', `said at ${E1.map(R => f2(R.cueAt())).join(' ')} / ${E0.map(R => f2(R.cueAt())).join(' ')} s · his hips ${E1.map(off).join(' ')} m off the line · frames ${E1.map(fr).join(' ')}`);
    const [D1, D0] = await both({ T: [ROOM.T], sam: [30.2, 0, 15.5], foe: ROOM.foe, samWalk: [33.4, 0, 15.5], foeGod: true, secs: 4 });
    F.verdict(same(D1, D0) && D1.every(R => R.samV() > 1.2 && R.lane.body > 0 && R.lane.edge === 0 && R.cueAt() < 0.9), 'Sam WALKING along the line itself (in it standing or walking): the same, to the frame — he moves at 0.3 s as before', `said at ${D1.map(R => f2(R.cueAt())).join(' ')} / ${D0.map(R => f2(R.cueAt())).join(' ')} s · Sam's pace ${D1.map(R => f2(R.samV())).join(' ')} m/s · frames ${D1.map(fr).join(' ')}`);
    // (4) a flash-blind MATE planted in the line with Sam walking past at its edge: the gate names Sam first, but the line would not open if he stopped
    const [M1, M0] = await both({ T: [ROOM.T], sam: [29.6, 0, 14.9], foe: ROOM.foe, samWalk: [33.4, 0, 14.9], mate: [31.6, 0, 15.5], foeGod: true, secs: 4 });
    F.verdict(same(M1, M0) && M1.every(R => R.cueAt() < 1.0), 'a blind mate planted IN the line while Sam walks past at its edge: no longer breath — Sam stopping would not open it', `said at ${M1.map(R => f2(R.cueAt())).join(' ')} / ${M0.map(R => f2(R.cueAt())).join(' ')} s (afterEdge 1 / 0) · '${[...new Set(M1.map(R => R.cues[0]?.text))].join("' / '")}' · frames Sam was in it ${M1.map(fr).join(' ')}`);
    safe(F.verdict, [...A1, ...A0, ...T1, ...B1, ...B0, ...C1, ...C0, ...E1, ...E0, ...D1, ...D0, ...M1, ...M0]);
  } catch (err) { F.verdict(false, 'the probe ran', err instanceof Error ? (err.stack ?? err.message) : String(err)); }
  return F.done();
});

/** one staged ENTRY, played `secs` seconds: two teammates in the corridor ordered to bang and clear the break room's north door, Sam stood in the corridor,
 *  and a man who cannot be dropped spawned beyond Sam the frame the order's phase first reads `foeAt` — what the rule did, and when each man crossed */
async function entry(o: { seed?: number; knobs?: Record<string, unknown>; sam: number[]; foe: number[]; foeAt: string; secs?: number }) {
  restore(); Object.assign(CLEARLINE, FIRST, o.knobs ?? {}); CLEARLINE.on = !BREAK;
  for (const k of Object.keys(CLM.CLEARLINE_STATS)) CLM.CLEARLINE_STATS[k] = 0; CLM.CLEARLINE_LOG.length = 0;
  Math.random = seeded(0x10f + (o.seed ?? 1) * 7919);
  const W: any = await quiet(() => standUp()); const g = W.game;
  for (const gd of g.guards) { gd.flashlight.enabled = false; g.engine.lights.remove(gd.flashlight); }
  g.guards = []; g.tune.civilians = false; g.tune.qrf = false; g.tune.devices = false; g.tune.chaos = 0;
  await quiet(() => g.restartEncounter());
  g.godMode = true; g.playerInvisible = true;
  for (const grp of ['breakroom', 'corridor']) g.setGroup(grp, true);
  const d = g.doors.byName('breakroom_n');
  const spawn = (team: string, pos: number[], facing: number[], name: string) => spawnUnit(g, { team, pos: [pos[0], 0, pos[2]], yaw: v3.yawTo([pos[0], 0, pos[2]], [facing[0], 0, facing[2]]), light: false, name });
  const men: any[] = [[26.0, 0, 11.25], [25.2, 0, 11.25]].map((p, i) => spawn('operative', p, d.frameCentre, i ? 'Blue Two' : 'Blue One')); for (const m of men) m.god = true;
  g.teleportPlayer([o.sam[0], 0, o.sam[2]]);
  const said: { t: number; who: string; text: string }[] = []; const say0 = g.say.bind(g);
  g.say = (gd: any, text: string, ...r: any[]) => { said.push({ t: g.time, who: gd?.callsign ?? '-', text }); return say0(gd, text, ...r); };
  for (let i = 0; i < 2; i++) W.step(DT);
  const why: string | null = g.orders.give('bangClear', g.orders.targetAt([d.frameCentre[0], 0, d.frameCentre[2]]), 'all') ?? null, t0 = g.time;
  let foe: any = null, op: any = null, maxV = 0; const at: Record<string, number> = {}, crossed = new Map<any, number>(), point = new Map<any, number>(), A0 = new Map<any, any>();
  for (let i = 0; i < (o.secs ?? 20) * 60; i++) {
    g.player.visibility = 0.05; W.step(DT); op ??= g.doorTools.ops[0] ?? null; const live = !!op && g.doorTools.ops.includes(op), t = g.time - t0;
    if (live && !(op.phase in at)) at[op.phase] = t;
    if (op && !live && !('end' in at)) at.end = t;
    if (live && !foe && op.phase === o.foeAt) { foe = spawn('hostile', o.foe, men[0].char.pos, 'Tango 1'); foe.god = true; foe.state = 'alert'; foe.awareness = 1; foe.lastKnown = [men[0].char.pos[0], 0, men[0].char.pos[2]]; g.fight.hotT = g.time; at.foe = t; }
    for (const m of men) { maxV = Math.max(maxV, Math.hypot(m.char.vel[0], m.char.vel[2]));
      if (!live) continue;
      if (op.crossed.has(m) && !crossed.has(m)) crossed.set(m, t);
      // on his point: the door tools say so — or (set and taken back inside one tick: sent straight on) his entry assignment has been replaced
      if (op.phase === 'enter' && op.pod.has(m) && !op.queue.some((q: any) => q.gd === m)) { const A = g.orders.of(m); if (!A0.has(m)) A0.set(m, A); if (!point.has(m) && (op.onPod.has(m) || A0.get(m) !== A)) point.set(m, t); } }
  }
  const log = CLM.CLEARLINE_LOG.map((n: any) => ({ ...n, t: n.t - t0 })), acts = log.filter((n: any) => n.what !== 'end');
  /** the rule's acts on a man between the shove (the can thrown) and his point */
  const inWindow = acts.filter((n: any) => { const m = men.find(x => x.callsign === n.who); return 'toss' in at && n.t >= at.toss && n.t <= (point.get(m) ?? at.end ?? Infinity); });
  const cues = said.filter(x => /^blocked|^no shot — (getting|you|Blue)/.test(x.text)).map(x => ({ ...x, t: x.t - t0 }));
  return { g, why, men, at, crossed: men.map(m => crossed.get(m) ?? -1), point: men.map(m => point.get(m) ?? -1), log, acts, inWindow, cues, maxV, ended: op ? (op.beats.filter((b: any) => !/^other door · /.test(b.what)).at(-1)?.what ?? '') : 'no order',   // (the order's last beat of its own: a man put on the room's other door after the room is theirs — DOORTOOLS.otherDoorM — is a beat too, and comes later)
    stats: { ...CLM.CLEARLINE_STATS },
    inRoom: men.map(m => m.char.pos[2] > d.frameCentre[2] + 0.3) };
}

export const lineoffireEntry = guarded(async () => {
  const F = family('lineoffire-entry: CLEARLINE.inEntry off — between the shove and his point on a door order the rule stands down; everywhere else it is the rule as it was');
  try {
    // Sam in the corridor west of the stack, a man who cannot be dropped beyond him: every teammate on the door's east jamb has Sam in his line to that man
    const behind = { sam: [23.6, 0, 11.25], foe: [22.0, 0, 11.25], foeAt: 'wait' };
    const ON = [], OFF = []; for (const seed of SEEDS) { ON.push(await entry({ ...behind, seed })); OFF.push(await entry({ ...behind, seed, knobs: { inEntry: false } })); }
    const sec = (R: any) => `go ${f2(R.at.enter ?? -1)} · crossed ${R.crossed.map(f2).join(' / ')} · end ${f2(R.at.end ?? -1)} ('${R.ended}')`, go = (R: any) => R.at.enter ?? Infinity;
    F.verdict(ON.every(R => !R.why && 'wait' in R.at && R.inWindow.length >= 1 && !(R.crossed[0] >= 0 && R.crossed[0] - go(R) < 5)), 'the staging, inEntry as shipped: the can gone off, a man comes up behind with Sam between — the rule takes the pair off their door, and nobody is through it inside five seconds of the go',
      `${ON.map(R => `${R.inWindow.map((n: any) => `${n.who} ${n.what} at ${f2(n.t)}`).join(', ') || 'no act'} · ${sec(R)}`).join(' ‖ ')}${ON[0].why ? ` · order refused: ${ON[0].why}` : ''}`);
    F.verdict(OFF.every(R => !R.why && R.inWindow.length === 0 && R.cues.every((c: any) => c.t < (R.at.toss ?? 0) || c.t > Math.max(...R.point, R.at.end ?? 0))), 'inEntry off: no step, no cover, no knee and no word of the rule\'s for either man between the shove and his point', `acts in the window ${OFF.map(R => R.inWindow.length).join(' ')} · all acts ${OFF.map(R => R.acts.length).join(' ')} · on their points at ${OFF.map(R => R.point.map(f2).join(' / ')).join(' ‖ ')} s`);
    F.verdict(OFF.every(R => R.crossed[0] >= 0 && R.crossed.every((t: number) => t >= 0 && t - go(R) < 4) && R.inRoom.every(Boolean) && /in$/.test(R.ended)), '… and they hold their way in: both through the door inside four seconds of the go, the room theirs, the order ended in it', OFF.map(sec).join(' ‖ '));
    // the walk up to the SAME order's stack is before the shove: the man is there from the start, Sam mid-corridor ahead of the walkers
    const ahead = { sam: [28.6, 0, 11.25], foe: [35.5, 0, 11.25], foeAt: 'stack', secs: 8 };
    const S1 = [], S0: any[] = []; for (const seed of SEEDS) { S1.push(await entry({ ...ahead, seed })); S0.push(await entry({ ...ahead, seed, knobs: { inEntry: false } })); }
    const sig = (R: any) => R.acts.map((n: any) => `${n.who} ${n.what} ${f2(n.t)}`).join(', ');
    F.verdict(S1.every((R, i) => !R.why && R.acts.length >= 1 && !('toss' in R.at && R.acts[0].t >= R.at.toss) && sig(R) === sig(S0[i]) && R.cues.length === S0[i].cues.length), 'on the walk up to that order\'s stack (before any shove) the knob changes nothing: the same acts at the same moments either way', `shipped: ${S1.map(sig).join(' ‖ ')} · inEntry off: ${S0.map(sig).join(' ‖ ')}`);
    // … and a man planted on a hold order: the planted case of this family, to the frame
    const P1 = [], P0: any[] = []; for (const seed of SEEDS) { P1.push(await meet({ seed, on: true, T: [ROOM.T], sam: ROOM.sam, foe: ROOM.foe })); P0.push(await meet({ seed, on: true, T: [ROOM.T], sam: ROOM.sam, foe: ROOM.foe, knobs: { inEntry: false } })); }
    F.verdict(P1.every((R, i) => R.cueAt() >= 0 && Math.abs(R.cueAt() - P0[i].cueAt()) < 1e-6 && Math.abs(R.foeDown - P0[i].foeDown) < 1e-6 && R.stats.steps === P0[i].stats.steps), 'a man planted on a hold order with Sam in his line: the same word, the same step, the man down at the same moment either way', `said at ${P1.map(R => f2(R.cueAt())).join(' ')} / ${P0.map(R => f2(R.cueAt())).join(' ')} s (shipped / inEntry off) · man down ${P1.map(R => f2(R.foeDown)).join(' ')} / ${P0.map(R => f2(R.foeDown)).join(' ')} s`);
    const v = Math.max(...[...ON, ...OFF, ...S1, ...S0].map(R => R.maxV));
    F.verdict(v <= PACE.max + 0.05, `nobody faster than the team's walking pace (${PACE.max} m/s) in any of it`, `fastest ${f2(v)} m/s over ${ON.length + OFF.length + S1.length + S0.length} staged entries`);
    safe(F.verdict, [...P1, ...P0]);
  } catch (err) { F.verdict(false, 'the probe ran', err instanceof Error ? (err.stack ?? err.message) : String(err)); }
  return F.done();
});

export const lineoffireBehind = guarded(async () => {
  const F = family('lineoffire-behind: CLEARLINE.holdBehind — Sam ahead of him and walking AT the man: no cover and no knee, he holds behind him; Sam stopped, standing or crossing: the rule as it was');
  try {
    const acts = (R: any) => R.log.filter((n: any) => n.what !== 'end').map((n: any) => `${n.what} ${f2(n.t - R.t0)}`), sig = (R: any) => acts(R).join(', ') || 'nothing';
    const first = (R: any, re: RegExp) => { const n = R.log.find((x: any) => re.test(x.what)); return n ? n.t - R.t0 : -1; };
    const both = async (o: Omit<Setup, 'on'>) => { const R1 = [], R0 = []; for (const seed of SEEDS) { R1.push(await meet({ ...o, seed, on: true, knobs: { ...o.knobs, holdBehind: 2 } })); R0.push(await meet({ ...o, seed, on: true, knobs: { ...o.knobs, holdBehind: 0 } })); } return [R1, R0]; };
    // the corridor (no spot to step to beside a friend in its middle): he holds at its west end, the man 11.6 m down it, Sam 1.6 m ahead of him walking at the man
    const hall = { T: [[22.0, 0, 11.25]], sam: [23.6, 0, 11.25], foe: [33.6, 0, 11.25], foeGod: true };
    // (1) Sam walks at the man for 3 s and then stands in the corridor
    const STOP = 3, [A1, A0] = await both({ ...hall, samWalk: [31.0, 0, 11.25], samStop: STOP, secs: 8 });
    F.verdict(A0.every(R => !R.why && first(R, /cover|kneel/) >= 0 && first(R, /cover|kneel/) < 1.5), 'the staging, holdBehind 0 (as shipped): Sam walking at the man down the corridor ahead of him — he leaves for cover inside a second and a half', `${A0.map(sig).join(' ‖ ')} · walked ${A0.map(R => f2(R.men[0].walked)).join(' ')} m`);
    F.verdict(A1.every(R => !R.why && R.stats.behind > 0 && !(first(R, /cover|kneel/) >= 0 && first(R, /cover|kneel/) < STOP + 0.4) && R.cueAt() >= 0 && R.cueAt() < 1.5 && /in my line/.test(R.cues[0].text)), 'holdBehind 2: while Sam walks at the man he takes no cover and no knee — he says Sam is in his line and holds behind him', `${A1.map(R => `${sig(R)} ('${R.cues[0]?.text ?? ''}' at ${f2(R.cueAt())} s, held ${R.stats.behind}×)`).join(' ‖ ')}`);
    F.verdict(A1.every(R => first(R, /cover|kneel/) >= STOP + 1.5 && first(R, /cover|kneel/) < STOP + 3.6), '… a halt is given its two seconds (no cover in the first second and a half after Sam stops), and then a friend parked in his line has the ladder again: cover inside three and a half seconds of the stop', `cover or knee at ${A1.map(R => f2(first(R, /cover|kneel/))).join(' ')} s · Sam let go of his keys at ${STOP} s`);
    // (2) Sam STANDING in the corridor from the start, and Sam walking dead on the line in a room with floor to step to: the knob changes nothing
    const [B1, B0] = await both({ T: [[24.0, 0, 11.25]], sam: [25.2, 0, 11.25], foe: [29.8, 0, 11.25] });
    const [C1, C0] = await both({ T: [ROOM.T], sam: [30.2, 0, 15.5], foe: ROOM.foe, samWalk: [33.4, 0, 15.5], foeGod: true, secs: 4 });
    F.verdict(B1.every((R, i) => acts(R).length >= 1 && sig(R) === sig(B0[i]) && R.stats.behind === 0), 'Sam STANDING mid-corridor: the same acts at the same moments with the knob on or off (a parked friend is not leading)', `on: ${B1.map(sig).join(' ‖ ')} · off: ${B0.map(sig).join(' ‖ ')}`);
    F.verdict(C1.every((R, i) => R.stats.steps >= 1 && sig(R) === sig(C0[i]) && R.stats.behind === 0), 'Sam walking at the man in a ROOM with floor beside the line: the step is taken as before, the same step at the same moment either way', `on: ${C1.map(sig).join(' ‖ ')} · off: ${C0.map(sig).join(' ‖ ')}`);
    // (3) the fight kept: the man CAN be dropped. Sam walks at him down the corridor for two and a half seconds and is then gone from it (out of every line)
    const GONE = 2.5, [D1, D0] = await both({ T: [[22.0, 0, 11.25]], sam: [23.6, 0, 11.25], foe: [33.6, 0, 11.25], samWalk: [31.0, 0, 11.25], samStop: GONE, secs: GONE });
    const then = (R: any) => { const m = R.men[0], was = { off: flat(m.gd.char.pos, R.marks[0]), hidden: R.hidden(m), cover: first(R, /cover|kneel/) }; R.g.teleportPlayer([29.5, 0, 21.5]); let n = 0; while (R.foe.state !== 'dead' && n < 8 * 60) { R.step(); n++; } return { ...was, down: R.foe.state === 'dead' ? n / 60 : -1, rounds: m.rounds }; };
    const d1 = D1.map(then), d0 = D0.map(then);
    F.verdict(d1.every(x => x.cover < 0 && x.off < 0.5 && !x.hidden), 'holdBehind 2, Sam walking at the man: two and a half seconds in he is on his mark with the man in plain view — still in the fight', `off his mark ${d1.map(x => f2(x.off)).join(' ')} m · hidden from the man ${d1.map(x => x.hidden).join(' ')} · (holdBehind 0: ${d0.map(x => `${f2(x.off)} m off it, hidden ${x.hidden}`).join(' · ')})`);
    F.verdict(d1.every((x, i) => x.down >= 0 && x.down < 2 && x.rounds > 0 && (d0[i].down < 0 || x.down <= d0[i].down)), '… and the moment Sam is out of the line the man goes down: inside two seconds, and no later than with the knob off', `man down ${d1.map(x => f2(x.down)).join(' ')} s after Sam left the line · holdBehind 0: ${d0.map(x => f2(x.down)).join(' ')} s`);
    safe(F.verdict, [...A1, ...A0, ...B1, ...B0, ...C1, ...C0, ...D1, ...D0]);
  } catch (err) { F.verdict(false, 'the probe ran', err instanceof Error ? (err.stack ?? err.message) : String(err)); }
  return F.done();
});

export const lineoffireStill = guarded(async () => {
  const F = family('lineoffire-still: CLEARLINE.still — the player ON THE MOVE in his line: no step, no cover, no knee, he holds and says so; the player stood still: the rule as it was');
  try {
    const acts = (R: any) => R.log.filter((n: any) => n.what !== 'end').map((n: any) => `${n.what} ${f2(n.t - R.t0)}`), sig = (R: any) => acts(R).join(', ') || 'nothing';
    const first = (R: any, re: RegExp) => { const n = R.log.find((x: any) => re.test(x.what)); return n ? n.t - R.t0 : -1; };
    const both = async (o: Omit<Setup, 'on'>) => { const R1 = [], R0 = []; for (const seed of SEEDS) { R1.push(await meet({ ...o, seed, on: true, knobs: { ...o.knobs, still: 2 } })); R0.push(await meet({ ...o, seed, on: true, knobs: { ...o.knobs, still: 0 } })); } return [R1, R0]; };
    // (1) a room with floor beside the line: Sam walks dead on the line at the man for 1.2 s and then stands in it, 2.4 m short of the man
    const STOP = 1.2, room = { T: [ROOM.T], sam: [30.2, 0, 15.5], foe: ROOM.foe, samWalk: [33.4, 0, 15.5], samStop: STOP, foeGod: true, secs: 6 };
    const [A1, A0] = await both(room);
    F.verdict(A0.every(R => !R.why && first(R, /step/) >= 0 && first(R, /step/) < 1.5), 'the staging, still 0 (as shipped): Sam walking in his line in a room with floor beside it — he steps inside a second and a half', A0.map(sig).join(' ‖ '));
    F.verdict(A1.every(R => !R.why && R.stats.moving > 0 && !(first(R, /step|cover|kneel/) >= 0 && first(R, /step|cover|kneel/) < STOP + 0.4) && R.cueAt() >= 0 && R.cueAt() < 1.5 && /in my line/.test(R.cues[0].text)), 'still 2: while Sam walks he takes no step, no cover and no knee — he says Sam is in his line and holds', `${A1.map(R => `${sig(R)} ('${R.cues[0]?.text ?? ''}' at ${f2(R.cueAt())} s, held ${R.stats.moving}×)`).join(' ‖ ')}`);
    F.verdict(A1.every(R => first(R, /step|cover|kneel/) >= STOP + 1.5 && first(R, /step|cover|kneel/) < STOP + 3.6), '… a halt is given its two seconds, and then a player parked in his line is answered: the step inside three and a half seconds of the stop', `first act at ${A1.map(R => f2(first(R, /step|cover|kneel/))).join(' ')} s · Sam let go of his keys at ${STOP} s`);
    // (2) the corridor, Sam walking at the man for 3 s (the hold-behind staging) with holdBehind at 0: still alone keeps him out of cover while Sam walks
    const [H1, H0] = await both({ T: [[22.0, 0, 11.25]], sam: [23.6, 0, 11.25], foe: [33.6, 0, 11.25], foeGod: true, samWalk: [31.0, 0, 11.25], samStop: 3, secs: 8 });
    F.verdict(H0.every(R => first(R, /cover|kneel/) >= 0 && first(R, /cover|kneel/) < 1.5) && H1.every(R => R.stats.moving > 0 && R.stats.behind === 0 && first(R, /step|cover|kneel/) >= 3 + 1.5 && first(R, /step|cover|kneel/) < 3 + 3.6), 'the corridor, Sam walking at the man: no cover while he walks nor for a second and a half after (shipped: cover inside a second and a half), cover inside three and a half seconds of his stop', `still 2: ${H1.map(sig).join(' ‖ ')} · still 0: ${H0.map(sig).join(' ‖ ')}`);
    // (3) Sam STANDING from the start, room and corridor: the knob changes nothing
    const [B1, B0] = await both({ T: [ROOM.T], sam: ROOM.sam, foe: ROOM.foe }), [C1, C0] = await both({ T: [[24.0, 0, 11.25]], sam: [25.2, 0, 11.25], foe: [29.8, 0, 11.25] });
    F.verdict([...B1, ...C1].every((R, i) => acts(R).length >= 1 && sig(R) === sig([...B0, ...C0][i]) && R.stats.moving === 0 && Math.abs(R.foeDown - [...B0, ...C0][i].foeDown) < 1e-6), 'Sam STANDING in his line, in a room and mid-corridor: the same acts at the same moments and the man down at the same moment with the knob on or off', `room: ${B1.map(sig).join(' ‖ ')} / ${B0.map(sig).join(' ‖ ')} · corridor: ${C1.map(sig).join(' ‖ ')} / ${C0.map(sig).join(' ‖ ')} (still 2 / still 0)`);
    // (4) the fight kept: Sam walks in the line for 1.2 s and is then gone from it
    const [D1, D0] = await both({ ...room, foeGod: false, secs: STOP });
    const then = (R: any) => { const m = R.men[0], was = { off: flat(m.gd.char.pos, R.marks[0]), act: first(R, /step|cover|kneel/) }; R.g.teleportPlayer([29.5, 0, 21.5]); let n = 0; while (R.foe.state !== 'dead' && n < 8 * 60) { R.step(); n++; } return { ...was, down: R.foe.state === 'dead' ? n / 60 : -1, rounds: m.rounds }; };
    const d1 = D1.map(then), d0 = D0.map(then);
    F.verdict(d1.every(x => x.act < 0 && x.off < 0.5 && x.down >= 0 && x.down < 2 && x.rounds > 0), 'still 2: he is on his mark when Sam leaves the line, and the man goes down inside two seconds of it', `off his mark ${d1.map(x => f2(x.off)).join(' ')} m · man down ${d1.map(x => f2(x.down)).join(' ')} s after Sam left the line · still 0: ${d0.map(x => `${f2(x.off)} m off, down ${f2(x.down)} s`).join(' · ')}`);
    safe(F.verdict, [...A1, ...A0, ...H1, ...H0, ...B1, ...B0, ...C1, ...C0, ...D1, ...D0]);
  } catch (err) { F.verdict(false, 'the probe ran', err instanceof Error ? (err.stack ?? err.message) : String(err)); }
  return F.done();
});

export const lineoffireFar = guarded(async () => {
  const F = family('lineoffire-far: CLEARLINE.stillFar — `still` only while his man is farther off than this: close in he gets off the line at once whatever the player is doing, down a corridor he waits for a player on the move');
  try {
    const acts = (R: any) => R.log.filter((n: any) => n.what !== 'end').map((n: any) => `${n.what} ${f2(n.t - R.t0)}`), sig = (R: any) => acts(R).join(', ') || 'nothing';
    const first = (R: any, re: RegExp) => { const n = R.log.find((x: any) => re.test(x.what)); return n ? n.t - R.t0 : -1; };
    const three = async (o: Omit<Setup, 'on'>) => { const F8 = [], S2 = [], S0 = []; for (const seed of SEEDS) { F8.push(await meet({ ...o, seed, on: true, knobs: { still: 2, stillFar: 8 } })); S2.push(await meet({ ...o, seed, on: true, knobs: { still: 2 } })); S0.push(await meet({ ...o, seed, on: true })); } return [F8, S2, S0]; };
    // (1) close in: the room of lineoffire-still, the man 5.4 m from him, Sam walking dead on the line for 1.2 s
    const [A8, A2, A0] = await three({ T: [ROOM.T], sam: [30.2, 0, 15.5], foe: ROOM.foe, samWalk: [33.4, 0, 15.5], samStop: 1.2, foeGod: true, secs: 6 });
    const dA = flat(ROOM.T as any, ROOM.foe as any);
    F.verdict(dA < 8 && A8.every((R, i) => !R.why && first(R, /step/) >= 0 && first(R, /step/) < 1.5 && sig(R) === sig(A0[i]) && R.stats.moving === 0) && A2.every(R => !(first(R, /step|cover|kneel/) >= 0 && first(R, /step|cover|kneel/) < 1.2 + 0.4)), `his man ${f2(dA)} m off, Sam walking in his line: with stillFar 8 he steps inside a second and a half, the same step at the same moment as the rule as first built (still 2 alone holds him until Sam has stood)`, `stillFar 8: ${A8.map(sig).join(' ‖ ')} · as first built: ${A0.map(sig).join(' ‖ ')} · still 2 alone: ${A2.map(sig).join(' ‖ ')}`);
    // (2) at range: the corridor of lineoffire-behind, the man 11.6 m down it, Sam walking at him for 3 s
    const hall = { T: [[22.0, 0, 11.25]], sam: [23.6, 0, 11.25], foe: [33.6, 0, 11.25], foeGod: true, samWalk: [31.0, 0, 11.25], samStop: 3, secs: 8 };
    const [B8, B2, B0] = await three(hall);
    F.verdict(B8.every((R, i) => !R.why && R.stats.moving > 0 && sig(R) === sig(B2[i]) && first(R, /step|cover|kneel/) >= 3 + 1.5 && R.cueAt() >= 0 && /in my line/.test(R.cues[0].text)) && B0.every(R => first(R, /cover|kneel/) >= 0 && first(R, /cover|kneel/) < 1.5), 'his man 11.6 m down a corridor, Sam walking at him: with stillFar 8 he holds and says so while Sam walks and a second and a half after, exactly as still 2 alone (as first built: cover inside a second and a half)', `stillFar 8: ${B8.map(sig).join(' ‖ ')} · still 2 alone: ${B2.map(sig).join(' ‖ ')} · as first built: ${B0.map(sig).join(' ‖ ')}`);
    // (3) Sam STANDING in the corridor line at range: the knob changes nothing
    const [C8, , C0] = await three({ T: [[22.0, 0, 11.25]], sam: [23.6, 0, 11.25], foe: [33.6, 0, 11.25], foeGod: true, secs: 5 });
    F.verdict(C8.every((R, i) => acts(R).length >= 1 && sig(R) === sig(C0[i]) && R.stats.moving === 0), 'Sam STANDING in his line at that range: the same acts at the same moments as the rule as first built (a parked player is answered at any range)', `stillFar 8: ${C8.map(sig).join(' ‖ ')} · as first built: ${C0.map(sig).join(' ‖ ')}`);
    safe(F.verdict, [...A8, ...A2, ...A0, ...B8, ...B2, ...B0, ...C8, ...C0]);
  } catch (err) { F.verdict(false, 'the probe ran', err instanceof Error ? (err.stack ?? err.message) : String(err)); }
  return F.done();
});

export const lineoffireHoldStep = guarded(async () => {
  const F = family('lineoffire-holdstep: CLEARLINE.holdStep — behind a lead who is walking AT the man the hold stops the step too; a player crossing the line or standing in it: the rule as it was');
  try {
    const acts = (R: any) => R.log.filter((n: any) => n.what !== 'end').map((n: any) => `${n.what} ${f2(n.t - R.t0)}`), sig = (R: any) => acts(R).join(', ') || 'nothing';
    const first = (R: any, re: RegExp) => { const n = R.log.find((x: any) => re.test(x.what)); return n ? n.t - R.t0 : -1; };
    const both = async (o: Omit<Setup, 'on'>) => { const R1 = [], R0 = []; for (const seed of SEEDS) { R1.push(await meet({ ...o, seed, on: true, knobs: { holdBehind: 2, holdStep: true } })); R0.push(await meet({ ...o, seed, on: true, knobs: { holdBehind: 2 } })); } return [R1, R0]; };
    // (1) a room with floor beside the line, Sam ahead of him walking at the man for 1.2 s, then standing
    const STOP = 1.2, [A1, A0] = await both({ T: [ROOM.T], sam: [30.2, 0, 15.5], foe: ROOM.foe, samWalk: [33.4, 0, 15.5], samStop: STOP, foeGod: true, secs: 6 });
    F.verdict(A0.every(R => !R.why && first(R, /step/) >= 0 && first(R, /step/) < 1.5), 'the staging, holdBehind 2 alone: Sam walking at the man in a room with floor beside the line — the step is taken inside a second and a half', A0.map(sig).join(' ‖ '));
    F.verdict(A1.every(R => !R.why && R.stats.behind > 0 && !(first(R, /step|cover|kneel/) >= 0 && first(R, /step|cover|kneel/) < STOP + 0.4) && R.cueAt() >= 0 && R.cueAt() < 1.5 && /in my line/.test(R.cues[0].text)), 'holdStep: while Sam walks at the man he takes no step either — he says Sam is in his line and keeps his place', `${A1.map(R => `${sig(R)} ('${R.cues[0]?.text ?? ''}' at ${f2(R.cueAt())} s, held ${R.stats.behind}×)`).join(' ‖ ')}`);
    F.verdict(A1.every(R => first(R, /step|cover|kneel/) >= STOP + 1.5 && first(R, /step|cover|kneel/) < STOP + 3.6), '… and a lead who has stopped in his line is answered: the step inside three and a half seconds of the stop', `first act at ${A1.map(R => f2(first(R, /step|cover|kneel/))).join(' ')} s · Sam let go of his keys at ${STOP} s`);
    // (2) Sam STANDING in the line: nothing changes
    const [B1, B0] = await both({ T: [ROOM.T], sam: ROOM.sam, foe: ROOM.foe });
    F.verdict(B1.every((R, i) => acts(R).length >= 1 && sig(R) === sig(B0[i]) && R.stats.behind === 0 && Math.abs(R.foeDown - B0[i].foeDown) < 1e-6), 'Sam STANDING in his line: the same acts at the same moments and the man down at the same moment either way', `holdStep: ${B1.map(sig).join(' ‖ ')} · without: ${B0.map(sig).join(' ‖ ')}`);
    // (3) the switch on with nothing else set IS this form
    const D = CLM.CLEARLINE_DEFAULTS, S1 = []; for (const seed of SEEDS) S1.push(await meet({ T: [ROOM.T], sam: [30.2, 0, 15.5], foe: ROOM.foe, samWalk: [33.4, 0, 15.5], samStop: STOP, foeGod: true, secs: 6, seed, on: true, shipped: true }));
    F.verdict(D.holdBehind === 2 && D.holdStep === true && S1.every((R, i) => sig(R) === sig(A1[i]) && R.stats.behind === A1[i].stats.behind), 'the switch as shipped is this form: holdBehind 2 and holdStep are the defaults, and the walking staging with nothing set plays the same acts at the same moments', `defaults holdBehind ${D.holdBehind} holdStep ${D.holdStep} · as shipped: ${S1.map(sig).join(' ‖ ')}`);
    safe(F.verdict, [...A1, ...A0, ...B1, ...B0, ...S1]);
  } catch (err) { F.verdict(false, 'the probe ran', err instanceof Error ? (err.stack ?? err.message) : String(err)); }
  return F.done();
});

export const lineoffireOff = guarded(async () => {
  const F = family('lineoffire-off: switch off — the build as it was: gun down, no step that lasts, no word, nothing counted');
  try {
    const A = await meet({ on: false, T: [ROOM.T], sam: ROOM.sam, foe: ROOM.foe }), B = await meet({ on: false, T: [ROOM.T], sam: [29.5, 0, 21.5], foe: ROOM.foe, mate: [31.0, 0, 15.5] });
    const C = await meet({ on: false, T: [[24.0, 0, 11.25]], sam: [25.2, 0, 11.25], foe: [29.8, 0, 11.25] });
    const zero = (R: any) => Object.values(R.stats).every(v => v === 0) && R.log.length === 0 && R.cues.length === 0;
    F.verdict(zero(A) && zero(B) && zero(C), 'nothing of the rule runs: no step, no cover, no knee, no word, no count', `stats ${JSON.stringify(A.stats)} · words ${A.cues.length + B.cues.length + C.cues.length}`);
    F.verdict([A, B, C].every(R => R.men[0].rounds === 0 && R.men[0].walked < 0.3 && R.foeDown < 0 && R.men[0].idle > 8), 'and the teammate does what the base does — ten seconds in the man\'s sight with his gun down, no round, no step (what the on-cases are there to end)',
      `Sam in the line: ${A.men[0].rounds} rounds, walked ${f2(A.men[0].walked)} m, ${f2(A.men[0].idle)} s stood masked (the room fight's own side step asked ${A.g.fight.stats.stepped}×, each taken back by his order the frame after) · a mate in the line: ${B.men[0].rounds} rounds, walked ${f2(B.men[0].walked)} m, ${f2(B.men[0].idle)} s · the corridor: ${C.men[0].rounds} rounds, ${f2(C.men[0].idle)} s`);
  } catch (err) { F.verdict(false, 'the probe ran', err instanceof Error ? (err.stack ?? err.message) : String(err)); }
  return F.done();
});

if (import.meta.main) {   // (a trace for the curious: bun run tools/qa/lineoffire-probes.ts — every case's log and words)
  for (const [name, o] of Object.entries({ planted: { T: [ROOM.T], sam: ROOM.sam, foe: ROOM.foe }, corridor: { T: [[24.0, 0, 11.25]], sam: [25.2, 0, 11.25], foe: [29.8, 0, 11.25] }, 'corridor, no cover allowed': { T: [[24.0, 0, 11.25]], sam: [25.2, 0, 11.25], foe: [29.8, 0, 11.25], knobs: { cover: false } } } as Record<string, Omit<Setup, 'on'>>)) for (const on of [false, true]) {
    const R = await meet({ ...o, on }); console.log(`\n${name} · switch ${on ? 'ON' : 'off'}: rounds ${R.men[0].rounds} (first ${f2(R.men[0].first)} s) · man down ${f2(R.foeDown)} s · walked ${f2(R.men[0].walked)} m · idle ${f2(R.men[0].idle)} s · ends at ${at(R.men[0].gd.char.pos)}`);
    for (const n of R.log) console.log(`  ${f2(n.t - R.t0)} ${n.who}: ${n.what}${n.at ? ` to (${n.at[0].toFixed(1)}, ${n.at[1].toFixed(1)}), ${f2(n.walk)} m` : ''}${n.by ? ` — ${n.by} in his line` : ''}`);
    for (const s of R.said) console.log(`  ${f2(s.t - R.t0)} ${s.who}: "${s.text}"`);
  }
  process.exit(0);
}
