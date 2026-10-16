// NOT IN THERE ALONE — the check behind src/game/darkdoor.ts (DARKDOOR.on: on in the page, ?nodarkdoor; off on the frozen stand, TPS_DARKDOOR=1 — and it acts
// only under MORALE.on). Standalone and through probes.ts:
//   bun run tools/qa/darkdoor-check.ts          bun run tools/qa/probes.ts darkdoor
// THE OFFICE at night, the player out of everybody's sight. The break room's lamps are out on the night shift (calmtorch-check's dark room); its west door
// stands open onto the lit cubicles. A man is stood six metres up the cubicles from that door, made suspicious of a spot three metres inside the break room
// (or put on an alert chase of a fix there), and walked at it by the floor's own rules; the other two of the shift are stood across the floor — held where
// they stand ('nobody free') or left free. THE COMPOUND's room clear for the squads. Headless, PASS / FAIL each, on sim state, every number the default:
//   (1) a green man, alone, nobody to call: he stops a stride short of the frame, off the middle of the doorway, not in the opening; the line — to himself,
//       spoken — is said as he stops; he never crosses the frame while he waits; his aim goes across the opening and back, more than once
//   (2) a mate in earshot: the line is the call, spoken; the mate answers, spoken, walks to him, says his line at his shoulder, and both cross the frame
//       within seconds of it, the mate's fix the first man's goal
//   (3) a mate across the floor: the call and the answer go on the net; he comes the same
//   (4) a steady man in the same place walks straight in: no line — and who is green does not move when the roster does
//   (5) the same room with its lamps burning: the green man walks straight in
//   (6) nobody to come: after `waitSecs` he says so once, is let go with his fix where he stands, and is back on his route inside half a minute
//   (7) …and sent at the same room again: he does not get a silent pass — he says he is going in, stands the beat, and goes in slower than he walked up
//   (8) a calm shift, every man green, four minutes of its routes at night: doors into dark rooms are walked through and nobody is stopped
//   (9) a checkpoint: the room's lamps put on two frames before a save taken while he waits — ten seconds continued and ten seconds after a load are the
//       same balk frame for frame and the same game
//   (10) every line of the file fits a bubble, names nothing off the blocklist, no compass word, none twice
//   (11) the switch off, and the switch on with morale off: none of it — he walks in, no man is stopped, no room is read, and both runs digest as one in
//       which nobody is green. A SANITY LINE ONLY: 'off = the build as it was' is proven by the frozen digests of the gate's families.
//   (12) an alert chase of a fix inside: he balks the same, waits the wait out, gives it up to a search where he stands — and if that search takes him
//       through the door after all it is the slow entry, said first, never a walk straight in
//   (13) HE FIRES FROM THE FRAME: the player three metres inside, square to the opening, while he sweeps — he sees him, fires, and does not go in; the
//       chase is not dropped under a sighting. THE METER IS THE SCRIPT'S HERE: headless, nothing answers for Sam's light meter, so this line feeds it the CPU
//       estimate of every light at his chest and head, the man's own torch among them (guards.ts lightEstimateAt, nothing skipped) — the sweep's torch on a
//       man in the dark is proven on that stand-in, not on the renderer's meter
//   (14) a shut door: nothing until he has opened it; then the line, and he steps back off it and stays out
//   (15) no lit side, no balk: in a blackout he walks in; standing in the dark break room he walks out of its far door into the dark lot
//   (16) a mate who cannot get to him is dropped and the next man called; that man taken by an order, nobody is left: he says so at the wait's end
//   (17) squads (the compound's room clear as the level file deals it: Yard five, Gate one, West two, Keep three): the first man of each squad is steady,
//       the rest green — a squad of one is its steady man; a green man of the Yard alone balks at the pantry's open door (dark, off the lit kitchen), the
//       Yard's steady man in the same place walks in
// It raises what it needs itself (both switches, who is green), so it passes on the frozen stand and under TPS_PROFILE=shipped.
// DARKDOOR_BREAK=1 = no room is ever dark to the rule (the rule broken, the switch left alone — and left ON for the off line): every line with a balk in it
// must fail — (1) (2) (3) (6) (7) (9) (11) (12) (13) (14) (16) (17).   exit 0 = all hold · 1 = one does not
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const ROOT = resolve(import.meta.dir, '../..');
const DT = 1 / 60, f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x));
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** the compound's level file as it ships */
const compoundText = (): string => readFileSync(resolve(ROOT, 'levels', 'compound.json'), 'utf8');
const quiet = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => {}; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };

export async function darkdoorCheck(): Promise<boolean> {
  const { standUp } = (await import('./headless.ts')) as any;
  const DD = await import(`${ROOT}/src/game/darkdoor.ts`);
  const { DARKDOOR, DARKDOOR_STATS, darkDoorOf, darkDoorLines, darkDoorGreen, darkDoorSummary, darkRoom } = DD;
  const { MORALE } = await import(`${ROOT}/src/game/morale.ts`);
  const { HOUR } = await import(`${ROOT}/src/game/hours.ts`);
  const { doorPt } = await import(`${ROOT}/src/game/doortools.ts`);
  const { frameOf, crossesDoor, resetChase, lightEstimateAt } = await import(`${ROOT}/src/game/guards.ts`);
  const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
  const { squadsReport, squadMen, SQUADS } = await import(`${ROOT}/src/game/enemysquads.ts`);
  const D = await import(`${ROOT}/src/game/dialogue.ts`);
  const BREAK = process.env.DARKDOOR_BREAK === '1'; let all = true;
  const was = { dd: JSON.parse(JSON.stringify(DARKDOOR)), morale: MORALE.on, squads: SQUADS.on, rnd: Math.random };
  const { RUNNER } = await import(`${ROOT}/src/game/runner.ts`); const train0 = MORALE.training, nerve0 = MORALE.nerve, runner0 = RUNNER.on;
  /** WHO IS GREEN is morale.ts's (trainingOf). These cases were staged on a leader and green men: 'mixed' = the first man of a squad steady and the rest green; the night staff by temperament, an unnamed man green on the roster's odd places — whatever the difficulty the stand is on. The run rule held off (runner-check.ts is its own). After every stand-up, which re-reads the stand's words */
  const { NETQUIET: NQ_ } = await import(`${ROOT}/src/game/netquiet.ts`); const nq0_ = NQ_.on;   // (the net goes quiet, a later rule: held off here, after every stand-up — netquiet-check.ts holds it with the rest)
  const mixed = () => { MORALE.training = 'mixed'; MORALE.nerve = 'normal'; RUNNER.on = false; NQ_.on = false; };
  const line = (ok: boolean, label: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  console.log(`\n=== darkdoor: a green man alone does not walk into a dark room${BREAK ? ' (DARKDOOR_BREAK: no room is dark to the rule)' : ''} ===`);
  const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
  const put = (gd: any, p: number[], face?: number[]) => { gd.char.pos = [p[0], 0, p[2]]; gd.char.vel = [0, 0, 0]; gd.path = []; gd.pathGoal = null; gd.speed = 0; gd.lastPos = [p[0], 0, p[2]]; gd.stallRef = null;
    if (face) gd.char.bodyYaw = gd.char.aimYaw = Math.atan2(face[0] - p[0], face[2] - p[2]); };
  const openUp = (d: any, a = 1.4) => { d.reset(); d.angle = a; d.vel = 0; d.latched = false; d.closing = false; d.place(); };
  const shut = (d: any) => { d.reset(); d.angle = 0; d.vel = 0; d.latched = true; d.closing = false; d.place(); };
  /** a door's frame as the check measures it: `out` = the face the man starts on. perp: metres off the frame line on that face (− = through); along: where
   *  along the frame (0 ‥ W = the opening's span); aimAlong: where the line of a man's aim cuts the frame; through: his stride since the last call cut the
   *  frame inside the opening, from that face */
  const frame = (d: any, out: 1 | -1) => { const F = frameOf(d), prev = new Map<any, number[]>();
    const perp = (p: number[]) => ((p[0] - F.hx) * F.nx + (p[2] - F.hz) * F.nz) * out, along = (p: number[]) => (p[0] - F.hx) * F.ux + (p[2] - F.hz) * F.uz;
    const aimAlong = (gd: any) => { const p = gd.char.pos, a = gd.char.aimYaw, far: number[] = [p[0] + Math.sin(a) * 12, 0, p[2] + Math.cos(a) * 12];
      const da = (p[0] - F.hx) * F.nx + (p[2] - F.hz) * F.nz, db = (far[0] - F.hx) * F.nx + (far[2] - F.hz) * F.nz; if (da * db >= 0) return NaN; const t = da / (da - db);
      return along([p[0] + (far[0] - p[0]) * t, 0, p[2] + (far[2] - p[2]) * t]); };
    const through = (gd: any) => { const p0 = prev.get(gd) ?? [...gd.char.pos], p = [...gd.char.pos]; prev.set(gd, p); const c = flat(p0, p) > 1e-5 && flat(p0, p) < 1 ? crossesDoor(p0, p, d) : null; return !!c && c.side === out; };
    return { F, perp, along, aimAlong, through }; };
  /** suspicious of a spot, as a noise there leaves a man: the floor's own walk to a fix */
  const sendTo = (T: any, goal: number[]) => { T.state = 'suspicious'; T.awareness = 0.5; T.reactT = 0; T.searchT = 0; T.lastKnown = [goal[0], 0, goal[2]]; T.path = []; T.pathGoal = null; T.stallRef = null; };

  /** the office at night; `man` = the roster index of the man walked at the break room; `others`: 'held' = the other two stand where they are put, on a
   *  scripted hold (nobody free to come) · 'near' = one of them free, seven metres behind him · 'far' = one free across the floor · 'both' = both free;
   *  `lit` = the break room's lamps put on; `shut` = the door shut and latched; `on` / `morale` = the switches */
  const stage = async (seed: number, o: { man?: number; others?: 'held' | 'near' | 'far' | 'both'; lit?: boolean; shut?: boolean; on?: boolean; morale?: boolean; who?: string; walk?: boolean } = {}) => {
    Math.random = seeded(seed); HOUR.id = 'night'; HOUR.sun = 1; Object.assign(DARKDOOR, was.dd); DARKDOOR.on = false; MORALE.on = false;
    const W: any = await quiet(() => standUp()); const g = W.game; g.playerInvisible = true; g.godMode = true;
    MORALE.on = o.morale ?? true; mixed(); DARKDOOR.on = o.on ?? true; DARKDOOR.who = o.who ?? 'rest'; if (BREAK) DARKDOOR.darkShare = 2;
    const step = (n = 1) => { for (let i = 0; i < n; i++) W.step(DT); };
    step(10);
    const d = g.doors.list.find((x: any) => x.def.name === 'breakroom_w'), mid = doorPt(d, d.def.width / 2, 0, 1, 0);
    const out: 1 | -1 = g.cleared.roomBy(d, 1) === g.cleared.roomAt([28, 0, 21]) ? -1 : 1, room = g.cleared.roomBy(d, -out);   // (`out` = the cubicles' face of the frame: the break room is on the other)
    const lamps = () => { for (const t of g.targets) if (!t.on && g.cleared.roomAt(t.pos) === room) g.toggleTarget(t); };
    if (o.lit) { lamps(); step(30); }
    if (o.shut) shut(d);
    const T = g.guards[o.man ?? 1], rest = g.guards.filter((x: any) => x !== T);
    const start = doorPt(d, d.def.width / 2, 6, out, 0), goal = doorPt(d, d.def.width / 2, 3, -out as 1 | -1, 0);
    const far = [[7, 0, 11.2], [12, 0, 11.2]];   // (the corridor's west end: two rooms and a wall from the break room's west door)
    rest.forEach((x: any, i: number) => { put(x, far[i]); x.hold = true; });
    const mate = rest[1], third = rest[0];
    if (o.others === 'near' || o.others === 'both') { mate.hold = false; put(mate, doorPt(d, d.def.width / 2, 13, out, 0)); }
    if (o.others === 'far') mate.hold = false;
    if (o.others === 'both') third.hold = false;
    const send = () => sendTo(T, goal);
    /** an alert chase of the fix inside, his last sighting six seconds old */
    const chase = () => { T.state = 'alert'; T.awareness = 1; T.reactT = 0; T.fireCd = 0.3; T.drawn = true; T.lastKnown = [goal[0], 0, goal[2]]; T.lastSeenT = g.time - 6; T.searchPlan = null; T.path = []; T.pathGoal = null; resetChase(T); };
    put(T, start, mid); if (o.walk !== false) send();
    return { W, g, d, T, rest, mate, third, room, out, start, goal, step, send, chase, lamps, ...frame(d, out) };
  };
  type Rig = Awaited<ReturnType<typeof stage>>;
  type Said = { who: any; text: string; radio: boolean; t: number };
  /** step `secs`, noting every new bubble of `who`; `each` true = stop */
  const listen = (R: { step: (n?: number) => void }, who: any[], secs: number, each?: (t: number) => boolean | void) => {
    const said: Said[] = [], last = new Map<any, any>(who.map(h => [h, h.bubble]));
    for (let i = 1; i <= Math.round(secs * 60); i++) { R.step(); for (const h of who) { const b = h.bubble; if (b && last.get(h) !== b) { last.set(h, b); said.push({ who: h, text: b.text, radio: !!b.radio, t: i * DT }); } } if (each?.(i * DT)) break; }
    return said;
  };
  const of = <S extends { text: string }>(said: S[], kind: string): S[] => said.filter(s => darkDoorLines(kind).includes(s.text));
  const mine = <S extends { text: string }>(said: S[]): S[] => said.filter(s => darkDoorLines().includes(s.text));
  const kinds = (said: { text: string }[]) => mine(said).map(s => (['call', 'self', 'copy', 'with', 'nobody', 'alone'] as const).find(k => darkDoorLines(k).includes(s.text)) ?? '?').join(' ');

  try {
    // (1) green, alone, nobody to call
    { const R = await stage(21, { others: 'held' }), T = R.T, K = DARKDOOR; let crossed = false, atLine: number[] | null = null, stopAt = -1, passes = 0, lastEnd = 0, minP = Infinity, n = 0;
      const dark = darkRoom(R.g, R.room), green = darkDoorGreen(R.g, T);
      const said = listen(R, [T], 14, t => { const p = T.char.pos, pp = R.perp(p); if (R.through(T)) crossed = true; minP = Math.min(minP, pp);
        const S = darkDoorOf(T); if (S?.act === 'balk' && !atLine) { atLine = [...p]; stopAt = t; }
        if (S?.act === 'balk' && S.at) { n++; const aa = R.aimAlong(T), end = aa < R.F.W * 0.25 ? -1 : aa > R.F.W * 0.75 ? 1 : 0; if (end && end !== lastEnd) { if (lastEnd) passes++; lastEnd = end; } } });
      const self = of(said, 'self')[0], S = darkDoorOf(T), p = T.char.pos, off = Math.abs(R.along(p) - R.F.W / 2);
      line(green && dark.dark && !!self && !self.radio && mine(said).length === 1 && Math.abs(self.t - stopAt) < 0.05 && !!atLine && R.perp(atLine) <= K.stopM + 0.3 && !crossed && S?.act === 'balk' && n > 300 && minP >= 0.9 && R.perp(p) >= 0.9 && R.perp(p) <= K.stopM && off > 0.15 && passes >= 3,
        '(1) a green man alone, nobody to call: stopped a stride short of the frame and off its middle, a word to himself as he stops, never through, his aim across the opening and back',
        `green ${green} · the room ${f2(dark.share)} dark (${dark.dark ? 'DARK' : 'lit'}) · '${self?.text ?? 'no line'}'${self ? ` ${self.radio ? 'on the net' : 'spoken'} at ${f2(self.t)} s, ${f2(atLine ? R.perp(atLine) : NaN)} m short of the frame` : ''} · after 14 s: ${S?.act ?? 'not met'}, ${f2(R.perp(p))} m off the frame, ${f2(off)} m off its middle · nearest he came ${f2(minP)} m · passes of his aim across it ${passes} · ${darkDoorSummary(R.g)}`); }
    // (2) a mate in earshot · (3) a mate across the floor
    for (const [n, where, seed] of [[2, 'near', 22], [3, 'far', 30]] as const) {
      const R = await stage(seed, { others: where }), T = R.T, m = R.mate; let tT = -1, tM = -1, goalSame = false, withAt = -1, d0 = NaN;
      const said = listen(R, [T, m], 60, t => { if (withAt < 0 && darkDoorOf(m)?.act === 'with') withAt = t; if (Number.isNaN(d0) && darkDoorOf(T)?.called) d0 = flat(m.char.pos, T.char.pos);   // (how far off his man is as he calls)
        if (withAt >= 0 && !goalSame && m.lastKnown && flat(m.lastKnown, R.goal) < 0.6) goalSame = true;
        if (R.through(T) && tT < 0) tT = t; if (R.through(m) && tM < 0) tM = t; return tT >= 0 && tM >= 0; });
      const call = of(said, 'call')[0], copy = of(said, 'copy')[0], w = of(said, 'with')[0], netted = d0 > DARKDOOR.earM;
      line(kinds(said) === 'call copy with' && call.who === T && call.radio === netted && (n === 2 ? !netted : netted) && copy.who === m && copy.radio === netted && copy.t > call.t && w.who === m && !w.radio && tT > w.t && tM > w.t && tT - w.t < 8 && tM - w.t < 10 && goalSame,
        n === 2 ? '(2) a mate in earshot: the call spoken, the answer spoken, he walks to him, says his line at his shoulder, and both go through within seconds — bound for the first man\'s goal'
          : '(3) a mate across the floor: the call and the answer on the net, and he comes the same',
        `lines: ${kinds(said) || 'none'} · '${call?.text ?? '—'}' ${call?.radio ? 'on the net' : 'spoken'} at ${f2(call?.t ?? NaN)} s, ${m.callsign} ${f2(d0)} m off · '${copy?.text ?? '—'}' ${copy?.radio ? 'on the net' : 'spoken'} at ${f2(copy?.t ?? NaN)} s · '${w?.text ?? '—'}' at ${f2(w?.t ?? NaN)} s · through the frame: ${T.callsign} ${f2(tT)} s, ${m.callsign} ${f2(tM)} s · the mate's fix on the first man's goal ${goalSame}`); }
    // (4) a steady man, and the deal is kept · (5) the room lit
    { const R = await stage(23, { man: 0, others: 'held' }), T = R.T, g = R.g, b0 = DARKDOOR_STATS.balks; let tT = -1; const dark = darkRoom(g, R.room);
      const deal = () => g.guards.map((x: any) => darkDoorGreen(g, x) ? 'g' : 's').join(''), d0 = deal();
      const said = listen(R, [T], 12, t => { if (tT < 0 && R.through(T)) tT = t; return tT >= 0; });
      const gone = g.guards.shift(), d1 = deal(); g.guards.unshift(gone);   // (the roster a man short: the two left are who they were)
      line(d0 === 'sgs' && d1 === 'gs' && (dark.dark || BREAK) && tT >= 0 && tT < 8 && !mine(said).length && DARKDOOR_STATS.balks === b0,
        '(4) a steady man in the same place walks straight in, no line — and who is green is dealt once: the roster a man short, the others are who they were',
        `${T.callsign}: dealt ${d0} (s steady, g green), with the first man off the roster ${d1} · the room ${f2(dark.share)} dark · through the frame at ${f2(tT)} s · lines of this file ${mine(said).length} · balks ${DARKDOOR_STATS.balks - b0}`); }
    { const R = await stage(24, { others: 'held', lit: true }), T = R.T, b0 = DARKDOOR_STATS.balks; let tT = -1; const dark = darkRoom(R.g, R.room), green = darkDoorGreen(R.g, T);
      const said = listen(R, [T], 12, t => { if (tT < 0 && R.through(T)) tT = t; return tT >= 0; });
      line(green && !dark.dark && tT >= 0 && tT < 8 && !mine(said).length && DARKDOOR_STATS.balks === b0, '(5) the same room with its lamps burning: the green man walks straight in',
        `${T.callsign}: green ${green} · the room ${f2(dark.share)} dark (${dark.dark ? 'DARK' : 'lit'}) · through the frame at ${f2(tT)} s · lines of this file ${mine(said).length}`); }
    // (6) nobody to come · (7) sent at the room again
    { const R = await stage(25, { others: 'held' }), T = R.T, K = DARKDOOR; let crossed = false, freeAt = -1, calmAt = -1, fixAt = NaN, met = false;
      const said = listen(R, [T], K.waitSecs + 34, t => { if (R.through(T)) crossed = true;
        if (darkDoorOf(T)?.act === 'balk') met = true; if (met && freeAt < 0 && darkDoorOf(T)?.act === 'none') { freeAt = t; } if (freeAt >= 0 && t - freeAt <= 2 * DT + 1e-9 && T.lastKnown) fixAt = flat(T.lastKnown, T.char.pos);
        if (freeAt >= 0 && calmAt < 0 && T.state === 'patrol') calmAt = t; return calmAt >= 0; });
      const nb = of(said, 'nobody'), self = of(said, 'self')[0];
      line(kinds(said) === 'self nobody' && Math.abs(nb[0].t - self.t - K.waitSecs) < 0.6 && !crossed && Math.abs(freeAt - nb[0].t) < 0.1 && fixAt < 0.6 && calmAt >= 0 && calmAt - freeAt < 30,
        '(6) nobody to come: he waits the wait out on his own face of the frame, says so once, is let go with his fix where he stands, and is back on his route inside half a minute',
        `lines: ${kinds(said) || 'none'} · '${nb[0]?.text ?? 'no line'}' at ${f2(nb[0]?.t ?? NaN)} s (stopped at ${f2(self?.t ?? NaN)} s; the wait is ${K.waitSecs} s) · through the frame ${crossed} · let go at ${f2(freeAt)} s, his fix ${f2(fixAt)} m from his feet · on patrol again at ${f2(calmAt)} s`);
      put(T, R.start, R.d.frameCentre); R.send(); let tT = -1, vIn = 0, vUp = 0, soloAt = -1, movedAt = -1; const p0: number[] = [];
      const again = listen(R, [T], 16, t => { const v = Math.hypot(T.char.vel[0], T.char.vel[2]), pp = R.perp(T.char.pos), S = darkDoorOf(T); if (pp > 3.5) vUp = Math.max(vUp, v);
        if (S?.act === 'solo') { if (soloAt < 0) { soloAt = t; p0.push(...T.char.pos); } else if (movedAt < 0 && flat(T.char.pos, p0) > 0.3) movedAt = t; if (pp < 0.8) vIn = Math.max(vIn, v); }
        if (R.through(T)) { tT = t; return true; } });
      const al = of(again, 'alone')[0];
      line(kinds(again) === 'alone' && !al.radio && Math.abs(al.t - soloAt) < 0.05 && movedAt - soloAt >= K.nerveSecs - 0.3 && tT > al.t && vIn > 0.2 && vIn < vUp * (K.slowK + 0.15),
        `(7) sent at the same room again inside ${K.fedUpSecs} s (the default numbers): no silent pass — he says it, stands the beat, and goes in alone slower than he walked up`,
        `lines: ${kinds(again) || 'none'} · '${al?.text ?? 'no line'}' at ${f2(al?.t ?? NaN)} s · on the move again ${f2(movedAt - soloAt)} s later (the beat is ${K.nerveSecs} s) · through the frame at ${f2(tT)} s · fastest in the doorway ${f2(vIn)} m/s against ${f2(vUp)} m/s walking up (the bar is ${f2(K.slowK)} of it) · ${DARKDOOR_STATS.quits} given up, ${DARKDOOR_STATS.solos} nerved`); }
    // (8) a calm shift
    { const R = await stage(27, { who: 'all', walk: false }), g = R.g, b0 = DARKDOOR_STATS.balks; for (const x of g.guards) { x.hold = false; } let into = 0, met = 0; const prev = new Map<any, number[]>(g.guards.map((x: any) => [x, [...x.char.pos]]));
      for (let i = 0; i < 240 * 60; i++) { R.step(); for (const x of g.guards) { const p0 = prev.get(x)!, p = x.char.pos; if (x.state === 'patrol' && flat(p0, p) > 1e-4) for (const d of g.doors.list) { const c = crossesDoor(p0, p, d); if (c && darkRoom(g, g.cleared.roomBy(d, -c.side)).dark) into++; } prev.set(x, [...p]); if (darkDoorOf(x) && darkDoorOf(x).act !== 'none') met++; } }
      line((into >= 2 || BREAK) && met === 0 && DARKDOOR_STATS.balks === b0 && g.guards.every((x: any) => x.state === 'patrol'),
        '(8) a calm shift, every man green, four minutes of its routes: doors into dark rooms are walked through and nobody is stopped', `walked into a dark room ${into}× · man-frames in an act of this file ${met} · balks ${DARKDOOR_STATS.balks - b0} · states ${g.guards.map((x: any) => x.state).join(' ')}`); }
    // (9) a checkpoint: continue ≡ load, through a change of the room's light the cached reading has not seen yet
    { const R = await stage(28, { others: 'far' }), g = R.g, iT = g.guards.indexOf(R.T), iM = g.guards.indexOf(R.mate); R.step(60 * 3); R.lamps(); R.step(2);
      const key = () => [iT, iM].map(i => { const S = darkDoorOf(g.guards[i]); return `${S?.act}/${S?.door}/${f2(S?.t ?? NaN)}/${S?.at ? 1 : 0}/${S?.other?.callsign ?? '-'}`; }).join(' ');
      const at0 = key(), snap = R.W.snapshot('darkdoor', true), carried = !!snap.darkdoor && snap.darkdoor.men.some((x: any) => x) && snap.darkdoor.reads.length > 0;
      const run = () => { Math.random = seeded(99); let s = '', ended = -1; for (let i = 0; i < 600; i++) { R.step(); s += key() + (i % 20 === 19 ? ' #' + hashDigest(digestGame(g, true)) : '') + '\n'; if (ended < 0 && darkDoorOf(g.guards[iT])?.act !== 'balk') ended = i; } return { s, ended }; };
      const iH = g.guards.indexOf(R.third); const a = run(); R.W.restore(snap); g.guards[iH].hold = true;   // (the check's own order to the third man to stand: no checkpoint carries it)
      const at1 = key(), b = run(), la = a.s.split('\n'), lb = b.s.split('\n'), diff = la.findIndex((l, i) => l !== lb[i]);
      line(carried && at0.startsWith('balk') && at0 === at1 && a.s === b.s && a.ended > 0,
        '(9) a checkpoint taken while he waits, the room\'s lamps put on two frames before: ten seconds continued and ten seconds after a load are the same balk, frame for frame, and the same game',
        `slice and the room\'s reading in the file ${carried} · at the save: ${at0} · at the load: ${at1} · the balk ends (the room reads lit) on frame ${a.ended} continued, ${b.ended} loaded · timelines equal ${a.s === b.s}${diff >= 0 ? ` (first difference on frame ${diff}: '${la[diff]}' against '${lb[diff]}')` : ''}`); }
    // (10) the words
    { const lines: string[] = darkDoorLines(), long = lines.filter(t => t.length > D.AIM_CHARS), blocked = lines.filter(t => D.blockedPhrase(t)), compass = lines.filter(t => /\b(north|south|east|west)/i.test(t)), twice = lines.filter((t, i) => lines.indexOf(t) !== i), tight = lines.filter(t => /\S—\s|\s—\S/.test(t));
      line(lines.length >= 18 && !long.length && !blocked.length && !compass.length && !twice.length && !tight.length && (['call', 'self', 'copy', 'with', 'nobody', 'alone'] as const).every(k => darkDoorLines(k).length >= 3),
        `(10) every line fits a bubble (≤ ${D.AIM_CHARS}), none on the originality blocklist, no compass word, none twice`, `${lines.length} lines · too long: ${long.join(' | ') || 'none'} · blocked: ${blocked.join(' | ') || 'none'} · twice: ${twice.join(' | ') || 'none'}`); }
    // (11) off: a sanity line (the proof is the gate's frozen digests)
    { const run = async (o: { on: boolean; morale: boolean; who?: string }) => { const R = await stage(29, { others: 'held', ...o }), T = R.T, st: Record<string, number> = { ...DARKDOOR_STATS }; let s = '', tT = -1;
        const said = listen(R, [T], 12, t => { if (tT < 0 && R.through(T)) tT = t; if (Math.round(t * 60) % 20 === 0) s += hashDigest(digestGame(R.g, true)) + ' '; });
        return { s, tT, lines: mine(said).length, acts: R.g.guards.filter((x: any) => darkDoorOf(x) && darkDoorOf(x).act !== 'none').length, met: R.g.guards.filter((x: any) => darkDoorOf(x)).length, filed: Object.keys(st).reduce((a: number, k: string) => a + ((DARKDOOR_STATS as any)[k] - st[k]), 0), sum: darkDoorSummary(R.g) }; };
      const base = await run({ on: true, morale: true, who: 'none' }), off = await run({ on: BREAK, morale: true }), half = await run({ on: true, morale: false });
      const ok = (r: typeof off) => r.tT >= 0 && r.tT < 8 && r.lines === 0 && r.met === 0 && r.filed === 0 && r.sum === '';
      line(ok(off) && ok(half) && off.s === base.s && half.s === base.s && base.tT >= 0 && base.acts === 0,
        '(11) the switch off, and on with morale off: he walks in, no man met, no room read, the summary empty — and both runs digest as one in which nobody is green',
        `off: through at ${f2(off.tT)} s · lines ${off.lines} · met ${off.met} · counted ${off.filed} · summary '${off.sum}' | morale off: through at ${f2(half.tT)} s · met ${half.met} · counted ${half.filed} | thirty-six digests equal the nobody-green run's: off ${off.s === base.s} · morale off ${half.s === base.s}`); }
    // (12) an alert chase: the balk, the give-up, and what the search does next
    { const R = await stage(31, { others: 'held' }), T = R.T, K = DARKDOOR; R.chase(); let crossedWaiting = false, quitAt = -1, stateAt = '', fixAt = NaN, tT = -1, soloBefore = false, vIn = 0;
      const said = listen(R, [T], K.waitSecs + 50, t => { const S = darkDoorOf(T), thr = R.through(T);
        if (quitAt < 0) { if (thr) crossedWaiting = true; if (DARKDOOR_STATS.quits > 0 && S?.act === 'none' && of([{ text: T.bubble?.text ?? '' }], 'nobody').length) { quitAt = t; stateAt = T.state; fixAt = T.lastKnown ? flat(T.lastKnown, T.char.pos) : NaN; } }
        else { if (S?.act === 'solo') { soloBefore = true; if (R.perp(T.char.pos) < 0.8) vIn = Math.max(vIn, Math.hypot(T.char.vel[0], T.char.vel[2])); } if (thr && tT < 0) { tT = t; return true; } } });
      const first = mine(said)[0], nb = of(said, 'nobody')[0], al = of(said, 'alone')[0], after = tT < 0 ? 'he did not go through that door again' : `through at ${f2(tT)} s, nerved first ${soloBefore}, '${al?.text ?? 'no line'}', ${f2(vIn)} m/s in the doorway`;
      line(!!first && (first === of(said, 'self')[0]) && !!nb && !crossedWaiting && stateAt === 'search' && fixAt < 0.6 && (tT < 0 || (soloBefore && !!al && al.t < tT && vIn < 2)),
        '(12) an alert chase of a fix inside: he balks the same, waits it out, and the chase is given up to a search where he stands — which goes through that door slowly and said first, or not at all',
        `lines: ${kinds(said) || 'none'} · stopped at ${f2(first?.t ?? NaN)} s · '${nb?.text ?? 'no line'}' at ${f2(nb?.t ?? NaN)} s · through the frame before it ${crossedWaiting} · then '${stateAt}', his fix ${f2(fixAt)} m from his feet · after: ${after}`); }
    // (13) he fires from the frame — Sam's meter fed the CPU estimate, the man's torch in it (see the head)
    { const R = await stage(32, { others: 'held' }), T = R.T, g = R.g; R.step(60 * 4); const balked = darkDoorOf(T)?.act === 'balk', n0 = T.weapon.shotsFired, torch = !!T.flashlight?.enabled;
      g.playerInvisible = false; g.teleportPlayer([R.goal[0], 0, R.goal[2]]); let seen = 0, crossed = false, minP = Infinity, peak = 0, dropped = false, alert = false;
      const meter = () => { const p = g.player.char.pos; g.player.visibility = g.visibilityOf(Math.max(lightEstimateAt(g, [p[0], 1.2, p[2]]), lightEstimateAt(g, [p[0], 1.6, p[2]]))); peak = Math.max(peak, g.player.visibility); };
      const said = listen({ step: () => { meter(); R.step(); } }, [T], 20, () => { if (g.time - T.lastSeenT < 0.05) seen++; if (R.through(T)) crossed = true; minP = Math.min(minP, R.perp(T.char.pos)); if (T.state === 'alert') alert = true; else if (alert && g.time - T.lastSeenT < DARKDOOR.seenSecs) dropped = true; });
      const shots = T.weapon.shotsFired - n0;
      line(balked && torch && seen > 30 && shots >= 1 && !crossed && minP > 0.3 && !dropped && !of(said, 'nobody').length,
        '(13) the player three metres inside, square to the opening, while he sweeps: he sees him, fires from where he stands, and does not go in — no chase dropped under a sighting',
        `stopped ${balked}, his torch burning ${torch} · Sam's meter (the CPU estimate, the torch in it) peaks ${f2(peak)} · frames with him in sight ${seen} · rounds ${shots} · through the frame ${crossed}, nearest ${f2(minP)} m · went alert ${alert} · dropped with a sighting ${dropped} · lines of this file after: ${kinds(said) || 'none'}`); }
    // (14) a shut door
    { const R = await stage(33, { others: 'held', shut: true }), T = R.T; let openAt = -1, crossed = false, early = 0;
      const said = listen(R, [T], 16, t => { const isOpen = !R.d.latched && Math.abs(R.d.angle) >= DARKDOOR.openRad; if (isOpen && openAt < 0) openAt = t; if (!isOpen && openAt < 0 && darkDoorOf(T) && darkDoorOf(T).act !== 'none') early++; if (R.through(T)) crossed = true; });
      const self = of(said, 'self')[0], S = darkDoorOf(T);
      line(openAt > 0 && early === 0 && !!self && self.t >= openAt - 1e-6 && self.t - openAt < 0.5 && !crossed && S?.act === 'balk' && R.perp(T.char.pos) >= 0.9,
        '(14) a shut door: nothing while it is shut; he opens it as he always did — then the line, and he steps back off it and stays out',
        `the leaf open at ${f2(openAt)} s · frames in an act before that ${early} · '${self?.text ?? 'no line'}' at ${f2(self?.t ?? NaN)} s · through the frame ${crossed} · after 16 s: ${S?.act ?? 'not met'}, ${f2(R.perp(T.char.pos))} m back from the frame`); }
    // (15) no lit side: a blackout, and a man already in the dark
    { const R = await stage(34, { others: 'held', walk: false }), T = R.T, g = R.g, b0 = DARKDOOR_STATS.balks; g.setBlackout(120, 'debug'); R.step(90); put(T, R.start, R.d.frameCentre); T.task = null; R.send(); let tA = -1;
      const saidA = listen(R, [T], 12, t => { if (tA < 0 && R.through(T)) tA = t; return tA >= 0; }), errand = !!T.task;
      const R2 = await stage(35, { others: 'held', walk: false }), g2 = R2.g, d2 = g2.doors.list.find((x: any) => x.def.name === 'breakroom_ext'); openUp(d2);
      const inside: 1 | -1 = g2.cleared.roomBy(d2, 1) === R2.room ? 1 : -1, F2 = frame(d2, inside), lot = g2.cleared.roomBy(d2, -inside), darkLot = darkRoom(g2, lot);
      put(R2.T, doorPt(d2, d2.def.width / 2, 3, inside, 0), d2.frameCentre); sendTo(R2.T, doorPt(d2, d2.def.width / 2, 3, -inside as 1 | -1, 0)); let tB = -1;
      const saidB = listen(R2, [R2.T], 12, t => { if (tB < 0 && F2.through(R2.T)) tB = t; return tB >= 0; });
      line((tA >= 0 || errand) && !mine(saidA).length && tB >= 0 && !mine(saidB).length && (darkLot.dark || BREAK) && DARKDOOR_STATS.balks === b0,
        '(15) no lit side, no balk: in a blackout the green man walks into the dark room; standing in the dark break room he walks out of its far door into the dark lot',
        `blackout: through at ${f2(tA)} s${errand ? ' (sent on an errand instead)' : ''}, lines ${mine(saidA).length} · from the dark room into the lot (${f2(darkLot.share)} dark): through at ${f2(tB)} s, lines ${mine(saidB).length} · balks ${DARKDOOR_STATS.balks - b0}`); }
    // (16) a mate who cannot get to him, then a mate taken by an order
    { const R = await stage(36, { others: 'both' }), T = R.T, A = R.mate, B = R.third, K = DARKDOOR, pin = [...A.char.pos]; let firstCalled = '', droppedAt = -1, second = '', againA = false, crossed = false, held = false;
      const said = listen({ step: () => { A.char.pos = [pin[0], 0, pin[2]]; A.char.vel = [0, 0, 0]; R.step(); } }, [T, A, B], K.waitSecs + 6, t => { const S = darkDoorOf(T), o = S?.other;
        if (!firstCalled && o) firstCalled = o.callsign; if (firstCalled && droppedAt < 0 && o !== A) droppedAt = t; if (droppedAt >= 0 && o === A) againA = true;
        if (droppedAt >= 0 && !second && o && o !== A) second = o.callsign; if (second && !held && t > droppedAt + 3) { B.hold = true; held = true; } if (R.through(T)) crossed = true; });
      const nb = of(said, 'nobody')[0], calls = of(said, 'call'), copies = of(said, 'copy');
      line(firstCalled === A.callsign && droppedAt > K.lagSecs - 1 && second === B.callsign && !againA && calls.length === 1 && copies.length === 2 && !!nb && !crossed && DARKDOOR_STATS.drops >= 2,
        '(16) a mate who covers no ground is dropped and the next man called (the call is not said twice); that one taken by an order, nobody is left — and he says so at the wait\'s end',
        `called ${firstCalled || 'nobody'}, dropped at ${f2(droppedAt)} s (covering no ground for ${K.lagSecs} s) · then ${second || 'nobody'} · the first called again ${againA} · lines: ${kinds(said) || 'none'} · '${nb?.text ?? 'no line'}' at ${f2(nb?.t ?? NaN)} s · through the frame ${crossed} · ${DARKDOOR_STATS.drops} dropped`); }
    // (17) squads
    { Math.random = seeded(37); Object.assign(DARKDOOR, was.dd); DARKDOOR.on = false; MORALE.on = false;
      const run = async (pick: 'green' | 'steady') => {
        const W: any = await quiet(() => standUp({ level: loadLevel(parseLevelData(compoundText())) })); const g = W.game; SQUADS.on = true;
        startFromQuery(g, 'levelFile=compound.json&roomclear&squad4'); g.godMode = true; g.playerInvisible = true; MORALE.on = true; mixed(); DARKDOOR.on = true; DARKDOOR.who = 'rest'; if (BREAK) DARKDOOR.darkShare = 2;
        const step = (n = 1) => { for (let i = 0; i < n; i++) { g.player.visibility = 0; W.step(DT); } }; step(20);
        const squads: any[][] = squadsReport(g).map((r: any) => squadMen(g, r.name) as any[]), deal = squads.map((men: any[]) => men.map((m: any) => darkDoorGreen(g, m) ? 'g' : 's').join('')).join(' ');
        const d = g.doors.list.find((x: any) => x.def.name === 'k_p'); openUp(d);
        const out: 1 | -1 = darkRoom(g, g.cleared.roomBy(d, 1)).share > darkRoom(g, g.cleared.roomBy(d, -1)).share ? -1 : 1, F = frame(d, out), room = g.cleared.roomBy(d, -out), dark = darkRoom(g, room);
        const men = squads.find((m: any[]) => m.length >= 3)!, T = pick === 'green' ? men[1] : men[0];
        g.guards.filter((x: any) => x.team === 'hostile' && x !== T).forEach((x: any, i: number) => { put(x, [5 + (i % 4) * 0.9, 0, 21 + Math.floor(i / 4) * 0.9]); x.hold = true; });   // (the rest of the garrison: stood in the yard's far corner)
        T.hold = false; T.pinned = false;   // (a defender off his post: the room clear stands its men where they are dealt)
        put(T, doorPt(d, d.def.width / 2, 2.8, out, 0), d.frameCentre); sendTo(T, doorPt(d, d.def.width / 2, 2.5, -out as 1 | -1, 0)); let tT = -1, held = 0;
        const said = listen({ step }, [T], 10, t => { if (tT < 0 && F.through(T)) tT = t; if (darkDoorOf(T)?.act === 'balk') held++; });
        return { deal, dark, T, tT, held, said, squads: squads.length, script: !!T.script, state: T.state };
      };
      const G = await run('green'), S = await run('steady');
      line(G.squads >= 2 && G.deal.split(' ').every((s: string) => /^sg*$/.test(s)) && G.deal.split(' ').filter((s: string) => /^sgg+$/.test(s)).length >= 2 && (G.dark.dark || BREAK) && G.tT < 0 && G.held > 240 && mine(G.said).length >= 1 && S.tT >= 0 && S.held === 0 && !mine(S.said).length,
        '(17) squads, the compound\'s room clear: each squad\'s first man steady and the rest green (a squad of one is its steady man); a green squad man alone balks at a dark room\'s open door, the steady man in his place walks in',
        `dealt ${G.deal} · the room ${f2(G.dark.share)} dark · ${G.T.callsign} (green): lines ${kinds(G.said) || 'none'}, frames stopped ${G.held}, through the frame ${G.tT >= 0}${G.script ? ' (on a script)' : ''} · ${S.T.callsign} (steady): through at ${f2(S.tT)} s, lines ${mine(S.said).length}${S.script ? ' (on a script)' : ''}, ${S.state}`); }
  } catch (e) { all = false; console.log(`- FAIL — the check threw\n    ${e instanceof Error ? e.stack : String(e)}`); }
  finally { Object.assign(DARKDOOR, was.dd); MORALE.on = was.morale; MORALE.training = train0; MORALE.nerve = nerve0; RUNNER.on = runner0; NQ_.on = nq0_; SQUADS.on = was.squads; Math.random = was.rnd; HOUR.id = 'night'; }
  console.log(`=== darkdoor: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}

if (import.meta.main) process.exit((await darkdoorCheck()) ? 0 : 1);
