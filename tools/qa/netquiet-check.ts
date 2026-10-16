// THE NET GOES QUIET — the check behind src/game/netquiet.ts (NETQUIET.on / ?nonetquiet / TPS_NETQUIET=1; it needs MORALE on). Headless, on the compound's
// room clear (Sam alone: `levelFile=compound.json&roomclear`), the level's own squads and rooms AS THE LEVEL FILE DEALS THEM — no man is named by callsign:
// the squad's cases are the Yard's (its leader alone in the garage, four green men together in the shed), the jumpy man holding a room is the kitchen's, the
// room with doors on three walls is the sala; the last man of (Q6) / (Q7) is the garage's, stood on that room's SECOND mark (level data: from there he has a
// spot to back off to — where he is dealt, its first mark, his spot is where he stands, and that is (Q6d)'s man who stays put):
//   (Q0) off = nothing: with the switch off every seam is called and leaves no man met, no shock, no line, the watched point and the pose alone
//   (Q1) a mate who does not answer shakes the one who asked (`unanswered`) and the men who heard the check (`heardIt`), a steady man by `steadyK` of it, each
//        man once
//   (Q2) the calls get worse: the name again (as the squad's own ask names him) · "why's nobody answering?" — still that, not the last line, while men of
//        OTHER squads are up on the net · "somebody talk to me!" only with nobody left on the whole net
//   (Q3) a body found: `body` to the finder, `bodyTold` to the men he tells, his line `bodyBeat` after; a finder with a shot in his ears asks nobody
//   (Q3b) one dead man is one shock: the fall he saw, the check nobody answered and the body found pay the largest of the three, not their sum
//   (Q4) a mate seen to fall: `fallUnseen` with no enemy in the watcher's view, `fallSeen` with one, nothing to a man looking away — and a green man whose
//        LEADER falls takes morale.ts's leaderShock once, not that and this
//   (Q5) the whip: a jumpy man holding a room has the NOISE as what he watches inside `whipShift` and his gun on it in well under a second; with the switch
//        off (same seed, same noise) he comes round to a doorway, later. A steady man does not whip. His reaction beat is the same number either way.
//   (Q5b) the whip is his EARS', not the world's: a noise through a wall is whipped to where his ears put it (the doorway), and his fix is never nearer the
//        truth than that; a mate's shot with a step of Sam's far out of earshot whips him nowhere; footfalls every 0.35 s do not flick his eyes back and forth
//   (Q6) THE DONE-TEST, the owner's replay shape — the last defender up, in a room with two entries, Sam WALKING IN through the door he fears least, first
//        seen about the threshold, on SEEDS seeds. Rule on: nothing before he has had silence on the net (he asks it himself, `calmSecs` after he is roused,
//        if nobody has), then his line, the beat, he backs off, is crouched with that door inside his arc, and fires inside FIRE_S of the sighting. Rule off,
//        the same man made ALERT (as any planted defender is) and watching the door the noise came from: upright, turned away, and later — or never.
//        (Q6c) the medians · (Q6d) squads live and gunfire; a man whose spot is where he stands; doors on three walls · (Q6e) the same man `alertSecs` of
//        quiet later: no longer alert, still low on the spot, still in his arc
//   (Q7) a checkpoint: the act loaded mid-way ends where the straight run ended (same spot, low), his squad's hold is back before the first frame runs, and
//        a file without the key meets every man afresh
//   (Q8) the journal: the table rides knobsSnapshot, and a recording from before the key replays with the switch off
//   (Q9) no aim, skill, reaction or health table is touched (every registered knob table but MORALE / NETQUIET, FIGHT_SKILL, the tune); netquiet.ts names
//        none of them and writes a man's state and awareness in two functions only (rouse, ease); the lines fit a bubble, pass the blocklist, none twice
//   (Q10) the last of his SQUAD who saw his mates fall — nobody ever asked for them — knows: his line, the beat, low · (Q11) and a living mate beside him
//        for `calmSecs` has him up again, his squad's to send again; a man walking past does not
//   (Q12) the seams in a REAL run, on the SHIPPED stand whichever stand this runs on (a child process: the squads' radio check and the last defenders' own
//        are held off on the frozen one): ten men dropped quietly → a check goes unanswered through laststand.ts / enemysquads.ts, the line, low; two of
//        the Yard struck down 100 s apart then the rest → the squad's radio check and its 'found' reach the rule (enemysquads.ts :569 / :910), and the
//        calls come in order: the name, why's nobody answering, somebody talk to me — that last one never while anybody else is up; the night staff's roll
//        call (guards.ts updateRollcall) on the office floor → the asker's line
// NETQUIET_BREAK=1 = the rule's seams cut (NETQUIET_QA.broken: every feed returns on its first line, the last man's spot is never looked for, the room
// fight's watch seam hands back nothing; the switch left alone): (Q1)–(Q6), (Q10) and (Q12) must fail.   exit 0 = all hold · 1 = one does not
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const ROOT = resolve(import.meta.dir, '../..');
const DT = 1 / 60, f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x)), DEG = Math.PI / 180;
const SEEDS = [71, 72, 73, 74, 75, 76], FIRE_S = 1.5;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** the compound's level file as it ships */
const compoundText = (): string => readFileSync(resolve(ROOT, 'levels', 'compound.json'), 'utf8');
const quiet = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => {}; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
const median = (a: number[]) => [...a].sort((x, y) => (Number.isNaN(x) ? 1e9 : x) - (Number.isNaN(y) ? 1e9 : y))[a.length >> 1];

// ---------------------------------------------------------------- (Q12)'s child: real runs on the stand this process was started on (the parent asks for SHIPPED)
async function realRuns(): Promise<Record<string, unknown>> {
  const { standUp } = (await import('./headless.ts')) as any;
  const { MORALE } = await import(`${ROOT}/src/game/morale.ts`);
  const { NETQUIET, NETQUIET_STATS, NETQUIET_LOG, NETQUIET_QA, netQuietOf } = await import(`${ROOT}/src/game/netquiet.ts`);
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
  const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);
  const { SQUADS, squadsReport } = await import(`${ROOT}/src/game/enemysquads.ts`);
  const { rollcallState } = await import(`${ROOT}/src/game/guards.ts`);
  NETQUIET_QA.broken = process.env.NETQUIET_BREAK === '1';
  const zero = () => { for (const k of Object.keys(NETQUIET_STATS)) (NETQUIET_STATS as any)[k] = 0; NETQUIET_LOG.length = 0; };
  const compound = async (seed: number) => {
    Math.random = seeded(seed);
    const W: any = await quiet(() => standUp({ level: loadLevel(parseLevelData(compoundText())) }));
    const g = W.game; startFromQuery(g, 'levelFile=compound.json&roomclear'); g.godMode = true; zero();
    const step = (n = 1) => { for (let i = 0; i < n; i++) { g.player.visibility = 0.02; W.step(DT); } };
    /** the `i`th defender the room clear deals a room (no man is named by his callsign) */
    const of = (room: string, i = 0): any => g.roomClear.rooms.find((r: any) => r.def.id === room)?.defenders[i];
    step(60); return { g, step, of, H: g.guards.filter((x: any) => x.team === 'hostile') as any[], t0: g.time as number };
  };
  const kinds = () => NETQUIET_LOG.map((l: any) => ({ kind: l.kind as string, t: l.t as number, id: l.id as number }));
  const out: Record<string, unknown> = { on: NETQUIET.on && MORALE.on, squads: SQUADS.on, radioCheck: SQUADS.radioCheck };
  // A: ten men dropped quietly in one second; the eleventh is left
  { const { g, step, of, H, t0 } = await compound(5), T = of('garage');
    for (const x of H) if (x !== T) killGuard(g, x, [0, 0, 1], true, 'shot', 'player');
    let lowAt = NaN, lineAt = NaN, quietAt = NaN;
    for (let i = 1; i <= 40 * 60 && Number.isNaN(lowAt); i++) { step(); const N = netQuietOf(T);
      if (Number.isNaN(quietAt) && (N?.quiet ?? 0) > 0) quietAt = g.time - t0;
      if (Number.isNaN(lineAt) && NETQUIET_LOG.some((l: any) => l.kind === 'last' && l.id === T.char.id)) lineAt = g.time - t0;
      if (N?.last === 3) lowAt = g.time - t0; }
    step(30);
    out.A = { quietAt, lineAt, lowAt, crouch: T.char.anim.crouch ?? 0, stats: { ...NETQUIET_STATS } }; }
  // B: the Yard (five: its leader alone in the garage, four in the shed). The leader struck down at 1 s; a man of the shed (`vi`) at 100 s — the squad has
  // asked for the leader, found him and stood to since —; at END everybody else but the shed's `ti`th man. Several casts and seeds: where the second man
  // drops out of his mates' sight the squad asks for him too (two checks unanswered: the name, then why); where a mate SEES him down the squad knows
  // without asking (a body, no check — enemysquads.ts radioCheck (a)) and there is no second rung to say
  { const Bs: any[] = [];
    for (const [seed, ti, vi] of [[5, 2, 0], [5, 1, 0], [5, 3, 0], [7, 2, 0]] as [number, number, number][]) {
      const { g, step, of, H, t0 } = await compound(seed), T = of('shed', ti), V1 = of('garage'), V2 = of('shed', vi), GAP = 100, END = 135, plan: [number, any[]][] = [[1, [V1]], [GAP, [V2]], [END, H.filter(x => x !== T && x !== V1 && x !== V2)]];
      let lowAt = NaN, lastDeadAt = NaN, v2At = NaN;
      for (let i = 1; i <= (END + 60) * 60 && Number.isNaN(lowAt); i++) {
        for (const [at, who] of plan) if (i === at * 60) { for (const x of who) killGuard(g, x, [0, 0, 1], true, 'struck', 'player'); if (at === END) lastDeadAt = g.time; if (at === GAP) v2At = g.time; }
        step(); if (netQuietOf(T)?.last === 3) lowAt = g.time - t0; }
      step(30);
      const ev = (squadsReport(g) as any[]).flatMap(r => r.events), seenDown = ev.some(e => e.what === 'found' && e.t - v2At < 2 && e.t >= v2At - 0.2 && String(e.why).includes(`${V2.callsign} in sight`));
      Bs.push({ seed, ti, vi, seenDown, lines: kinds().map((l: any) => ({ kind: l.kind, t: l.t - t0, who: H.find(x => x.char.id === l.id)?.callsign ?? '?', early: l.t < lastDeadAt })), lowAt, crouch: T.char.anim.crouch ?? 0, stats: { ...NETQUIET_STATS } }); }
    out.B = Bs; }
  // C: the office floor's night staff — one man struck down, the roll call asks for him
  { Math.random = seeded(7);
    const W: any = await quiet(() => standUp()); const g = W.game; g.godMode = true; zero();
    const step = (n = 1) => { for (let i = 0; i < n; i++) { g.player.visibility = 0.02; W.step(DT); } };
    step(120); const staff = g.guards.filter((x: any) => x.team === 'guard' && !x.civ && x.state !== 'dead'), V = staff[2] ?? staff[0], t0 = g.time;
    if (V) killGuard(g, V, [0, 0, 1], true);
    const R = rollcallState(g); R.nextAt = Math.min(R.nextAt, g.time + 2);
    let askAt = NaN, lineAt = NaN;
    for (let i = 1; i <= 240 * 60 && Number.isNaN(lineAt); i++) { step();
      if (Number.isNaN(askAt) && NETQUIET_STATS.staffAsks > 0) askAt = g.time - t0;
      if (NETQUIET_LOG.some((l: any) => l.kind === 'name' || l.kind === 'body')) lineAt = g.time - t0;
      if (!Number.isNaN(askAt) && g.time - t0 > askAt + 4) break; }
    out.C = { staff: staff.length, victim: V?.callsign ?? null, askAt, lineAt, line: NETQUIET_LOG[0]?.text ?? null, kind: NETQUIET_LOG[0]?.kind ?? null, stats: { ...NETQUIET_STATS } }; }
  return out;
}

export async function netquietCheck(): Promise<boolean> {
  const { standUp } = (await import('./headless.ts')) as any;
  const M = await import(`${ROOT}/src/game/morale.ts`);
  const { MORALE, moraleOf, rungOf, trainingOf, leaderOf, moraleShock } = M;
  const NQ = await import(`${ROOT}/src/game/netquiet.ts`);
  const { NETQUIET, NETQUIET_STATS, NETQUIET_LOG, NETQUIET_QA, netQuietAsked, netQuietClosed, netQuietBody, netQuietFall, netQuietLook, netQuietPose, netQuietTick, netQuietOf, netQuietLines, netQuietSnapshot, netQuietRestore, netQuietSummary, netQuietHolds } = NQ;
  const { NETFEED, netFeedAsked, netFeedTake, netFeedHolds } = await import(`${ROOT}/src/game/netquietfeed.ts`);
  const { PLAYER_ID } = await import(`${ROOT}/src/game/consts.ts`);
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
  const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);
  const { squadOf, SQUADS, mate } = await import(`${ROOT}/src/game/enemysquads.ts`);
  const { knobRegistry } = await import(`${ROOT}/src/game/knobs.ts`);
  const { knobsSnapshot, applyKnobs } = await import(`${ROOT}/src/game/journal.ts`);
  const { FIGHT_SKILL } = await import(`${ROOT}/src/game/roomfight.ts`);
  const { LASTSTAND } = await import(`${ROOT}/src/game/laststand.ts`);
  const D = await import(`${ROOT}/src/game/dialogue.ts`);
  const { RUNNER, runnerBreak, runnerFled, runnerOwns } = await import(`${ROOT}/src/game/runner.ts`);
  const { DARKDOOR } = await import(`${ROOT}/src/game/darkdoor.ts`);
  const BREAK = process.env.NETQUIET_BREAK === '1'; let all = true;
  const later = { runner: RUNNER.on, door: DARKDOOR.on };
  const copy = (o: unknown) => JSON.parse(JSON.stringify(o));
  const was = { morale: copy(MORALE), nq: copy(NETQUIET), rnd: Math.random, squads: SQUADS.on, callOut: LASTSTAND.callOut };
  const line = (ok: boolean, label: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  console.log(`\n=== netquiet: the net goes quiet${BREAK ? ' (NETQUIET_BREAK: the rule\'s seams cut)' : ''} ===`);
  const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]), wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
  const yawTo = (a: number[], b: number[]) => Math.atan2(b[0] - a[0], b[2] - a[2]);
  const shockOf = (gd: any): number => moraleOf(gd)?.shock ?? 0;
  const fired = (gd: any): number => gd.weapon.shotsFired;
  const near = (a: number, b: number, e = 1e-6) => Math.abs(a - b) <= e;
  const LOWC = NETQUIET.crouch - 0.1;   // (down as far as the rule takes him)
  const P = (p: number[] | null | undefined) => p ? `${f2(p[0])},${f2(p[2])}` : 'none';

  /** the compound's room clear, Sam alone and out of everybody's sight; `on` = the switch; `training` = morale.ts's knob */
  const stage = async (seed: number, o: { on: boolean; training?: string; squads?: boolean; runner?: boolean }) => {
    Math.random = seeded(seed); MORALE.on = false; NETQUIET.on = false; NETQUIET_QA.broken = false; SQUADS.on = o.squads ?? was.squads;
    const W: any = await quiet(() => standUp({ level: loadLevel(parseLevelData(compoundText())) }));
    const g = W.game; MORALE.on = true; MORALE.nerve = 'normal'; MORALE.training = o.training ?? 'mixed'; NETQUIET.on = o.on; NETQUIET_QA.broken = BREAK && o.on;
    RUNNER.on = !!o.runner; DARKDOOR.on = false;   // (the run and the doorway rules held off but where a case asks for the first — after the stand-up, which re-reads the stand's words)
    startFromQuery(g, 'levelFile=compound.json&roomclear'); g.godMode = true;
    let lit = 0.05; const step = (n = 1) => { for (let i = 0; i < n; i++) { g.player.visibility = lit; W.step(DT); } };
    step(10);
    /** WHO IS WHO, by the level's own rooms (no man is named by his callsign): the `i`th defender the room clear deals a room, and a room's middle */
    const of = (room: string, i = 0): any => g.roomClear.rooms.find((r: any) => r.def.id === room)?.defenders[i], def = (gd: any) => g.fight.defs.find((x: any) => x.gd === gd);
    /** a room's `i`th mark, as the level file has it (a room has more marks than it is dealt men: where a second or third man of it would stand) */
    const mark = (room: string, i: number): number[] => g.roomClear.rooms.find((r: any) => r.def.id === room).def.marks[i].pos;
    const mid = (room: string): number[] => { const b = g.roomClear.rooms.find((r: any) => r.def.id === room).def.bounds; return [(b.x0 + b.x1) / 2, 0, (b.z0 + b.z1) / 2]; };
    const face = (gd: any, at: number[]) => { const y = yawTo(gd.char.pos, at); gd.char.bodyYaw = y; gd.char.aimYaw = y; gd.char.update(0); };
    const put = (gd: any, p: number[]) => { gd.char.pos = [p[0], 0, p[2]]; gd.char.vel = [0, 0, 0]; gd.path = []; gd.pathGoal = null; gd.speed = 0; gd.lastPos = [p[0], 0, p[2]]; const d = def(gd); if (d) d.station = [p[0], 0, p[2]]; gd.char.update(0); };
    /** a free spot `m` metres from `a` toward `b`, with a line from a man's eyes at `a` to it */
    const beside = (a: number[], b: number[], m: number): number[] => { const L = Math.max(1e-3, Math.hypot(b[0] - a[0], b[2] - a[2])); for (const k of [m, m + 0.4, m - 0.4, m + 0.8]) { const q = [a[0] + (b[0] - a[0]) / L * k, 0, a[2] + (b[2] - a[2]) / L * k]; if (!g.col.nav.isBlocked(q[0], q[2]) && !g.col.segmentBlocked([a[0], 1.5, a[2]], [q[0], 1.2, q[2]])) return q; } return a; };
    const openDoors = (E: any[]) => { for (const e of E) { const d = e.door, S = g.doors.swingOf(d); d.angle = S.swing * S.open; d.vel = 0; d.latched = false; d.closing = false; d.place(); } };
    return { W, g, step, of, mark, mid, def, face, put, beside, openDoors, light: (v: number) => { lit = v; } };
  };
  type Rig = Awaited<ReturnType<typeof stage>>;
  const listen = (R: Rig, who: any[], secs: number, each?: (t: number) => void) => {
    const said: { who: any; text: string; radio: boolean; t: number }[] = [], last = new Map<any, any>(who.map(h => [h, h.bubble]));
    for (let i = 1; i <= Math.round(secs * 60); i++) { R.step(); for (const h of who) { const b = h.bubble; if (b && last.get(h) !== b) { last.set(h, b); said.push({ who: h, text: b.text, radio: !!b.radio, t: i * DT }); } } each?.(i * DT); }
    return said;
  };
  const words = (said: { text: string }[]) => said.map(s => `"${s.text}"`).join(' ') || 'nothing';
  const inPool = (kind: string, text: string, name = '') => netQuietLines(kind).some((l: string) => l.replace(/\{name\}/g, name) === text);
  const kOf = (g: any, gd: any) => trainingOf(g, gd) === 'steady' ? NETQUIET.steadyK : 1;
  const hostiles = (g: any) => g.guards.filter((x: any) => x.team === 'hostile' && x.state !== 'dead');
  /** Sam WALKS in through entry `e`: from 2.5 m outside it, straight through, to 2.5 m inside, at 1.4 m/s, lit, and stops where he is first seen — till the
   *  man fires or `secs` are up (moved by hand a frame at a time: he makes no footfall) */
  const walkIn = (R: Rig, T: any, e: any, secs = 6) => {
    const g = R.g, at = (s: number) => [e.at[0] - e.out[0] * s, 0, e.at[2] - e.out[1] * s];
    let s0 = 0; for (const s of [-2.5, -2, -1.5, -1, -0.5]) { const p = at(s); if (!g.col.nav.isBlocked(p[0], p[2])) { s0 = s; break; } }
    g.teleportPlayer(at(s0) as any); R.light(1);
    const n0 = fired(T), seen0 = T.lastSeenT; let seenAt = NaN, fireAt = NaN, depth = NaN, lowSeen = NaN, stateSeen = '';
    for (let i = 1, s = s0; i <= secs * 60 && Number.isNaN(fireAt); i++) {
      if (Number.isNaN(seenAt)) s = Math.min(2.5, s0 + i * DT * 1.4);   // (seen, he stops where he is)
      g.teleportPlayer(at(s) as any); R.step(); const t = i * DT;
      if (Number.isNaN(seenAt) && T.lastSeenT > seen0) { seenAt = t; depth = s; lowSeen = T.char.anim.crouch ?? 0; stateSeen = T.state; }
      if (fired(T) > n0) fireAt = t; }
    R.light(0.05);
    return { seenAt, fireAt, beat: fireAt - seenAt, depth, lowSeen, stateSeen };
  };

  try {
    // ---------------------------------------------------------------- (Q0) off = nothing
    { const R = await stage(60, { on: false }), g = R.g, A = R.of('shed', 0), B = R.of('shed', 1), C = R.of('shed', 2), men = squadOf(g, A).men;
      R.step(30); const s0 = [A, B, C].map(shockOf), lines0 = NETQUIET_STATS.lines, pt = [1, 2, 3];
      netQuietAsked(g, A, C, men); netQuietClosed(g, A, [C], [B]); netQuietBody(g, B, men); netQuietFall(g, C); netFeedAsked(g, A, C, men); netQuietLook(A, pt as any); const pose = netQuietPose(g, A, DT, false); netQuietTick(g, DT);
      R.step(240);
      const met = g.guards.filter((x: any) => netQuietOf(x)).length, s1 = [A, B, C].map(shockOf), filed = netFeedTake(g).length;
      line(met === 0 && s0.every((s, i) => s === s1[i]) && NETQUIET_STATS.lines === lines0 && pose === null && pt.join() === '1,2,3' && !NETFEED.live && filed === 0 && netQuietSnapshot(g) === undefined && netQuietSummary(g) === '' && !netQuietHolds(A) && !netFeedHolds(A),
        '(Q0) switch off: every seam called (asked, closed, body, fall, the squads\' feed, look, pose, holds, tick) and four seconds run — no man met, no shock, no line, nothing filed, no checkpoint key',
        `men met ${met} · shock ${s0.map(f2).join('/')} → ${s1.map(f2).join('/')} · lines ${NETQUIET_STATS.lines - lines0} · pose ${pose} · pt ${pt.join()} · feed on ${NETFEED.live}, filed ${filed}`); }

    // ---------------------------------------------------------------- (Q1) (Q2) the feeds and the lines
    { const R = await stage(61, { on: true, training: 'mixed' }), g = R.g, A = R.of('garage'), B = R.of('shed', 0), C = R.of('shed', 1), E = R.of('shed', 3), men = squadOf(g, A).men;   // (the Yard: its leader in the garage, three of its four in the shed)
      R.step(30);
      const tr = [A, B, C].map(x => trainingOf(g, x)), s0 = [A, B, C, E].map(shockOf);
      netQuietAsked(g, A, E, men); const s1 = [A, B, C, E].map(shockOf);
      netQuietAsked(g, A, E, men); const s2 = [A, B, C, E].map(shockOf);
      const K = NETQUIET, wantA = K.unanswered * kOf(g, A), wantB = K.heardIt * kOf(g, B), wantC = K.heardIt * kOf(g, C);
      line(near(s1[0] - s0[0], wantA) && near(s1[1] - s0[1], wantB) && near(s1[2] - s0[2], wantC) && s1[3] === s0[3] && s2.every((s, i) => s === s1[i]) && tr.includes('steady') && tr.includes('green') && netQuietOf(A)?.quiet === 1 && netQuietOf(B)?.quiet === 1,
        '(Q1) a man of the Yard does not answer its leader: the asker takes `unanswered`, the two who heard the check `heardIt`, a steady man steadyK of it, the silent man nothing — and asked again, nothing more',
        `${A.callsign} asks for ${E.callsign}, ${B.callsign} and ${C.callsign} hear it (${men.length} in the squad) · training ${tr.join('/')} · asker +${f2(s1[0] - s0[0])} (want ${f2(wantA)}) · hearers +${(s1[1] - s0[1]).toFixed(3)} / +${(s1[2] - s0[2]).toFixed(3)} (want ${wantB.toFixed(3)} / ${wantC.toFixed(3)}) · the silent man +${f2(s1[3] - s0[3])} · asked twice: +${f2(s2[0] - s1[0])} · quiet count ${netQuietOf(A)?.quiet}/${netQuietOf(B)?.quiet}`);
      // (Q2) the rungs: the third is 'why' again while other squads are on the net, the last line only with nobody left on it
      const gap = () => R.step(Math.round((K.barkSecs + 0.2) * 60));
      const said1 = listen(R, [A], K.askBeat + 0.6), l1 = said1[0];
      gap(); netQuietAsked(g, A, C, men); const said2 = listen(R, [A], K.askBeat + 0.6), l2 = said2[0];
      gap(); netQuietAsked(g, A, B, [A, B]); const said3 = listen(R, [A], K.askBeat + 0.6), l3 = said3[0], others = hostiles(g).filter((x: any) => !men.includes(x)).length;
      gap(); for (const x of hostiles(g)) if (x !== A) killGuard(g, x, [0, 0, 1], true, 'struck', 'player');
      const said4 = listen(R, [A], 8), l4 = said4.find(s => inPool('last', s.text));
      line(!!l1 && inPool('name', l1.text, mate(E)) && l1.radio && Math.abs(l1.t - K.askBeat) < 0.1 && !!l2 && inPool('why', l2.text) && l2.radio && !!l3 && inPool('why', l3.text) && others > 0 && !!l4 && l4.radio,
        '(Q2) the calls get worse, each a beat after its check, on the net: the name again (the squad\'s own name for him) · why is nobody answering · that again — NOT the last line — with his own squad silent but other squads\' men up · somebody talk to me, with nobody left on the whole net',
        `first: ${l1 ? `"${l1.text}" at ${f2(l1.t)} s` : words(said1)} · second: ${l2 ? `"${l2.text}"` : words(said2)} · his squad all quiet, ${others} others on the net: ${l3 ? `"${l3.text}"` : words(said3)} · nobody left: ${l4 ? `"${l4.text}"` : words(said4)} · quiet count ${netQuietOf(A)?.quiet}`); }

    // ---------------------------------------------------------------- (Q3) a body · (Q3b) one dead man, one shock
    { const R = await stage(61, { on: true, training: 'mixed' }), g = R.g, A = R.of('garage'), B = R.of('shed', 0), C = R.of('shed', 1), men = squadOf(g, A).men, K = NETQUIET;
      R.step(30);
      const b0 = [A, B, C].map(shockOf); netQuietBody(g, B, men); const b1 = [A, B, C].map(shockOf);
      const saidB = listen(R, [B], K.bodyBeat + 0.6), lb = saidB[0];
      C.witness.heard.lastShotT = g.time; netQuietBody(g, C, men); const owed = netQuietOf(C)?.say;
      line(near(b1[1] - b0[1], Math.min(K.body * kOf(g, B), MORALE.shockCap - b0[1])) && b1[0] - b0[0] > 0 && b1[0] - b0[0] <= K.bodyTold + 1e-9 && !!lb && inPool('body', lb.text) && Math.abs(lb.t - K.bodyBeat) < 0.1 && owed === -1,
        '(Q3) a body found: `body` to the finder, less to the men he tells, his line a beat after — and a finder with a shot in his ears asks nobody who heard a thing',
        `finder +${f2(b1[1] - b0[1])} (body ${K.body} × ${kOf(g, B)}, cap ${MORALE.shockCap}) · told +${(b1[0] - b0[0]).toFixed(3)} / +${(b1[2] - b0[2]).toFixed(3)} (bodyTold ${K.bodyTold}) · ${lb ? `"${lb.text}" at ${f2(lb.t)} s` : words(saidB)} · the man who heard the shot owes ${owed === -1 ? 'no line' : `line ${owed}`}`);
      // (Q3b) green men: A watches C fall with no enemy in view, B looks away; then C is asked for, then C is found — all in one frame (no decay between)
      const R2 = await stage(62, { on: true, training: 'green' }), g2 = R2.g, A2 = R2.of('shed', 0), B2 = R2.of('shed', 1), C2 = R2.of('shed', 2), men2 = squadOf(g2, A2).men;   // (three men of one room)
      R2.step(30); R2.put(B2, R2.beside(A2.char.pos, C2.char.pos, 1.5)); R2.step(2);
      for (const t of g2.targets) if (!t.on) g2.toggleTarget(t);
      R2.face(A2, C2.char.pos); { const p = B2.char.pos, q = C2.char.pos; R2.face(B2, [2 * p[0] - q[0], 0, 2 * p[2] - q[2]]); }
      const c0 = [A2, B2].map(shockOf); killGuard(g2, C2, [0, 0, 1], true, 'shot', 'player'); const c1 = [A2, B2].map(shockOf);
      netQuietAsked(g2, A2, C2, men2); const c2 = [A2, B2].map(shockOf);
      netQuietBody(g2, A2, men2); const c3 = [A2, B2].map(shockOf), knows = !!netQuietOf(A2)?.known.has(C2.char.id) && !!netQuietOf(B2)?.known.has(C2.char.id);
      line(near(c1[0] - c0[0], K.fallUnseen) && near(c3[0] - c0[0], K.fallUnseen) && near(c2[1] - c0[1], K.heardIt) && near(c3[1] - c0[1], K.bodyTold) && knows,
        '(Q3b) one dead man is one shock, the largest of the three: the man who saw him fall takes `fallUnseen` and nothing more for the check nobody answered or for finding him; the man who looked away takes `heardIt` for the check, and only the rest of `bodyTold` when told of the body',
        `watcher: fall +${f2(c1[0] - c0[0])}, then the check +${f2(c2[0] - c1[0])}, then the body +${f2(c3[0] - c2[0])} = ${f2(c3[0] - c0[0])} (the old sum: ${f2(K.fallUnseen + K.unanswered + K.body)}) · the other man: fall +${f2(c1[1] - c0[1])}, check +${f2(c2[1] - c1[1])}, told +${f2(c3[1] - c2[1])} = ${f2(c3[1] - c0[1])} (old sum ${f2(K.heardIt + K.bodyTold)}) · both know he is gone: ${knows}`); }

    // ---------------------------------------------------------------- (Q4) a mate seen to fall
    { const R = await stage(62, { on: true, training: 'green' }), g = R.g, A = R.of('shed', 0), B = R.of('shed', 1), C = R.of('shed', 2), K = NETQUIET;
      R.step(30); R.put(B, R.beside(A.char.pos, C.char.pos, 1.5)); R.step(2);
      const away = (gd: any, from: any) => { const p = gd.char.pos, q = from.char.pos; R.face(gd, [2 * p[0] - q[0], 0, 2 * p[2] - q[2]]); };
      // unseen shooter: A watches C fall, B looks away
      for (const t of g.targets) if (!t.on) g.toggleTarget(t);
      R.face(A, C.char.pos); away(B, C); const u0 = [A, B].map(shockOf), f0 = NETQUIET_STATS.unseen;
      killGuard(g, C, [0, 0, 1], true, 'shot', 'player'); const u1 = [A, B].map(shockOf);
      // a seen shooter: B has had an enemy in his eyes this second, and watches A fall
      R.step(2); R.face(B, A.char.pos); B.lastSeenT = g.time; const v0 = shockOf(B); killGuard(g, A, [0, 0, 1], true, 'shot', 'player'); const v1 = shockOf(B);
      // the leader's fall, on a mixed squad: the green man takes leaderShock, once
      const R2 = await stage(63, { on: true, training: 'mixed' }), g2 = R2.g, G = [R2.of('shed', 0)].find((x: any) => x && trainingOf(g2, x) === 'green' && leaderOf(g2, x)), L = G ? leaderOf(g2, G) : null;   // (a green man of the Yard, stood in the garage at his leader's side)
      R2.step(30); let led = NaN, ledWant = NaN;
      if (G && L) { R2.put(G, R2.beside(L.char.pos, R2.mid('garage'), 1.5)); R2.step(2); for (const t of g2.targets) if (!t.on) g2.toggleTarget(t); R2.face(G, L.char.pos); const l0 = shockOf(G); killGuard(g2, L, [0, 0, 1], true, 'shot', 'player'); led = shockOf(G) - l0; ledWant = Math.max(MORALE.leaderShock, K.fallUnseen); }
      line(near(u1[0] - u0[0], K.fallUnseen) && u1[1] === u0[1] && NETQUIET_STATS.unseen >= f0 + 1 && near(v1 - v0, K.fallSeen) && near(led, ledWant),
        '(Q4) a mate seen to fall: `fallUnseen` with no enemy in the watcher\'s view, nothing to the man looking away, `fallSeen` with an enemy in view — and a leader\'s fall is morale.ts\'s leaderShock once, not both',
        `no shooter seen: watcher +${f2(u1[0] - u0[0])} (fallUnseen ${K.fallUnseen}), the man looking away +${f2(u1[1] - u0[1])} · shooter in view: +${f2(v1 - v0)} (fallSeen ${K.fallSeen}) · the leader ${L?.callsign ?? '—'} falls in ${G?.callsign ?? '—'}'s eyes: +${f2(led)} (want ${f2(ledWant)}: leaderShock ${MORALE.leaderShock})`); }

    // ---------------------------------------------------------------- (Q5) the whip
    { const jumpyMan = async (on: boolean, jumpy = true) => { const R = await stage(64, { on, training: 'green' }), g = R.g, T = R.of('kitchen'), Df = R.def(T); R.step(30); if (jumpy) moraleShock(g, T, 0.4); R.step(20); return { R, g, T, Df, E: Df.room.entries as any[], p: T.char.pos as number[] }; };
      const run = async (on: boolean, jumpy: boolean) => {
        const { R, g, T, Df, E, p } = await jumpyMan(on, jumpy);
        // a footfall of Sam's inside his room, 2.4 m off, in the direction furthest from every doorway and well off his gun
        let best: number[] | null = null, bs = -1;
        for (let a = 0; a < 16; a++) { const y = a * Math.PI / 8, q = [p[0] + Math.sin(y) * 2.4, 0, p[2] + Math.cos(y) * 2.4];
          if (g.col.nav.isBlocked(q[0], q[2]) || g.col.segmentBlocked([p[0], 1.4, p[2]], [q[0], 1, q[2]])) continue;
          const offDoors = Math.min(...E.map((e: any) => Math.abs(wrap(yawTo(p, e.at) - y)))), offGun = Math.abs(wrap(T.char.aimYaw - y)); const s = Math.min(offDoors, offGun);
          if (s > bs) { bs = s; best = q; } }
        const noise = best!, w0 = NETQUIET_STATS.whips, react: number[] = [];
        g.events.push({ kind: 'step', pos: [noise[0], 0, noise[2]], time: g.time, loud: false, level: 1, who: PLAYER_ID });
        let ptAt = NaN, gunAt = NaN, doorAt = NaN;
        for (let i = 1; i <= 90; i++) { R.step(); const t = i * DT; react.push(T.reactT);
          if (Number.isNaN(ptAt) && flat(Df.pt, noise) < 0.3) ptAt = t;
          if (Number.isNaN(gunAt) && Math.abs(wrap(yawTo(T.char.pos, noise) - T.char.aimYaw)) < 0.25 && Math.abs(wrap(yawTo(T.char.pos, noise) - T.char.bodyYaw)) < 0.6) gunAt = t;
          if (Number.isNaN(doorAt) && E.some((e: any) => flat(Df.pt, e.at) < 0.3)) doorAt = t; }
        return { rung: rungOf(T), ptAt, gunAt, doorAt, whips: NETQUIET_STATS.whips - w0, off: bs, react: react.map(x => x.toFixed(3)).join(), heard: T.witness.heard.small };
      };
      const on = await run(true, true), off = await run(false, true), calm = await run(true, false), K = NETQUIET;
      line(on.rung >= 1 && on.whips === 1 && on.ptAt <= K.whipShift + 0.1 && on.gunAt <= 0.6 && !(off.gunAt <= 0.6) && Number.isNaN(off.ptAt) && calm.whips === 0 && Number.isNaN(calm.ptAt) && on.react === off.react && on.off > 0.6,
        '(Q5) a jumpy man holding a room whips to a footfall inside it: the NOISE is what he watches inside whipShift and his gun and body are on it inside 0.6 s; switch off, the same noise: never the noise, a doorway, later; a steady man does not whip; his reaction beat is frame for frame the same',
        `noise ${f2(on.off / DEG)}° off every door and his gun · on (rung ${on.rung}, ${on.whips} whip): watches the noise at ${f2(on.ptAt)} s, gun on it at ${f2(on.gunAt)} s · off: watches the noise ${Number.isNaN(off.ptAt) ? 'never' : `at ${f2(off.ptAt)} s`}, a doorway at ${f2(off.doorAt)} s, gun on the noise ${Number.isNaN(off.gunAt) ? 'never in 1.5 s' : `at ${f2(off.gunAt)} s`} · steady man (rung ${calm.rung}): ${calm.whips} whips · reactT on = off: ${on.react === off.react} · he heard it: ${on.heard}/${off.heard}`);
      // (Q5b) his ears', not the world's
      // 1: a loud scrape outside his room, behind a wall
      const w1 = await jumpyMan(true); let wall: number[] | null = null;
      for (let r = 3; r <= 9 && !wall; r += 0.5) for (let a = 0; a < 24; a++) { const y = a * Math.PI / 12, q = [w1.p[0] + Math.sin(y) * r, 0, w1.p[2] + Math.cos(y) * r], nav = w1.g.col.nav;
        if (nav.isBlocked(q[0], q[2]) || !w1.g.col.segmentBlocked([w1.p[0], 1.5, w1.p[2]], [q[0], 1, q[2]]) || w1.Df.room.cells.has(((q[2] / nav.cell) | 0) * nav.W + ((q[0] / nav.cell) | 0))) continue; wall = q; break; }
      w1.g.events.push({ kind: 'prop', pos: wall, time: w1.g.time, loud: true, level: 1, who: PLAYER_ID });
      let truest = Infinity, whipAt: number[] | null = null, ears: number[] | null = null;
      for (let i = 0; i < 60; i++) { w1.R.step(); const N = netQuietOf(w1.T); if (N?.whipAt && !whipAt) { whipAt = [...N.whipAt]; ears = w1.T.witness.heard.smallWhere ? [...w1.T.witness.heard.smallWhere] : null; } if (w1.T.lastKnown) truest = Math.min(truest, flat(w1.T.lastKnown, wall!)); }
      const earsOff = ears ? flat(ears, wall!) : NaN, wallOk = !!whipAt && !!ears && flat(whipAt, ears) < 0.05 && earsOff > 0.5 && truest >= earsOff - 0.05;
      // 2: a mate's shot he hears, and a faint step of Sam's far out of earshot in the same frame
      const w2 = await jumpyMan(true), mateMan = w2.R.of('shed'); let far: number[] = [2, 0, 2]; for (const c of [[2, 0, 2], [40, 0, 40], [2, 0, 40], [40, 0, 2]]) if (flat(c, w2.p) > flat(far, w2.p)) far = c;
      const wh0 = NETQUIET_STATS.whips, sm0 = w2.T.witness.heard.small, sh0 = w2.T.witness.heard.shots;
      w2.g.events.push({ kind: 'guardShot', pos: [...mateMan.char.pos], time: w2.g.time, loud: true, level: 1, who: mateMan.char.id });
      w2.g.events.push({ kind: 'step', pos: far, time: w2.g.time, loud: false, level: 0.1, who: PLAYER_ID });
      let nearFar = Infinity, whipped = false; for (let i = 0; i < 40; i++) { w2.R.step(); if (netQuietOf(w2.T)?.whipAt) whipped = true; nearFar = Math.min(nearFar, flat(w2.Df.pt, far), w2.T.lastKnown ? flat(w2.T.lastKnown, far) : Infinity); }
      const mateOk = !whipped && NETQUIET_STATS.whips === wh0 && w2.T.witness.heard.shots > sh0 && w2.T.witness.heard.small === sm0 && nearFar > 5;
      // 3: footfalls every 0.35 s at one spot in his room, behind his gun
      const w3 = await jumpyMan(true); let q3: number[] | null = null;
      for (let a = 0; a < 16 && !q3; a++) { const y = w3.T.char.aimYaw + Math.PI + a * Math.PI / 8, c = [w3.p[0] + Math.sin(y) * 2.4, 0, w3.p[2] + Math.cos(y) * 2.4]; if (!w3.g.col.nav.isBlocked(c[0], c[2]) && !w3.g.col.segmentBlocked([w3.p[0], 1.4, w3.p[2]], [c[0], 1, c[2]])) q3 = c; }
      let flips = 0, wasOn = false, onF = 0;
      for (let i = 0; i < 180; i++) { if (i % 21 === 0) w3.g.events.push({ kind: 'step', pos: [...q3!], time: w3.g.time, loud: false, level: 1, who: PLAYER_ID }); w3.R.step(); const o = flat(w3.Df.pt, q3!) < 0.3; if (o !== wasOn) flips++; wasOn = o; if (o) onF++; }
      // …and two noises 0.3 s apart at two places: the first is held `whipHold` (the second does not take his eyes inside it)
      const w4 = await jumpyMan(true), spots: number[][] = [];
      for (let a = 0; a < 16 && spots.length < 2; a++) { const y = w4.T.char.aimYaw + Math.PI / 2 + a * Math.PI / 8, c = [w4.p[0] + Math.sin(y) * 2.2, 0, w4.p[2] + Math.cos(y) * 2.2]; if (!w4.g.col.nav.isBlocked(c[0], c[2]) && !w4.g.col.segmentBlocked([w4.p[0], 1.4, w4.p[2]], [c[0], 1, c[2]]) && (!spots.length || flat(c, spots[0]) > 1.5)) spots.push(c); }
      let heldFirst = 0, tookSecond = NaN;
      if (spots.length === 2) for (let i = 0; i < 150; i++) { if (i === 0) w4.g.events.push({ kind: 'step', pos: [...spots[0]], time: w4.g.time, loud: false, level: 1, who: PLAYER_ID }); if (i === 18 || i === 80) w4.g.events.push({ kind: 'step', pos: [...spots[1]], time: w4.g.time, loud: false, level: 1, who: PLAYER_ID }); w4.R.step(); if (flat(w4.Df.pt, spots[0]) < 0.3) heldFirst++; if (Number.isNaN(tookSecond) && flat(w4.Df.pt, spots[1]) < 0.3) tookSecond = i * DT; }
      line(wallOk && mateOk && flips <= 2 && onF >= 150 && spots.length === 2 && heldFirst >= (K.whipHold - 0.05) * 60 && tookSecond > 1.3,
        '(Q5b) the whip is his ears\': a scrape through a wall is whipped to where HIS EARS put it (the doorway it came round), and his fix is never nearer the truth than that; a mate\'s shot, with a step of Sam\'s out of earshot in the same frame, whips him nowhere; footfalls every 0.35 s at one spot keep his eyes there (no flicking back to the door); a second noise 0.3 s after the first does not take his eyes inside whipHold',
        `wall: true source ${P(wall)}, his ears ${P(ears)} (${f2(earsOff)} m off it), whipped to ${P(whipAt)}; his fix never nearer the source than ${f2(truest)} m · mate's shot heard (+${w2.T.witness.heard.shots - sh0} shot, +${w2.T.witness.heard.small - sm0} small), Sam's step ${f2(flat(far, w2.p))} m off: whipped ${whipped}, nothing of his nearer it than ${f2(nearFar)} m · steps at 0.35 s: ${flips} flips in 3 s, on the noise ${onF}/180 frames · two places: the first held ${f2(heldFirst * DT)} s, the second taken at ${f2(tookSecond)} s (it was made at 0.30 s and again at 1.33 s)`); }

    // ---------------------------------------------------------------- (Q6) the done-test: the last man
    { const run = async (seed: number, mode: 'on' | 'off' | 'eased' | 'silent', who = 'garage@1', squads = false, loud = false, callOut = was.callOut) => {
        LASTSTAND.callOut = callOut;
        const on = mode !== 'off', R = await stage(seed, { on, training: 'trained', squads }), g = R.g, [room, mk] = who.split('@'), T = R.of(room), Df0 = R.def(T), E: any[] = Df0.room.entries, K = NETQUIET;
        if (mk) { R.put(T, R.mark(room, +mk)); R.step(2); }   // ('room@i': the room's man stood on its `i`th mark — else where he is dealt)
        const p0 = [...T.char.pos];
        R.openDoors(E);   // (every door of his room stands open: what he sees through them is the staging's only variable)
        R.step(20);
        for (const x of g.guards) if (x !== T && x.team === 'hostile' && x.state !== 'dead') killGuard(g, x, [0, 0, 1], true, 'shot', 'player');   // (his mates go down out of his sight, quietly: he knows nothing yet)
        const calm = listen(R, [T], 5), actCalm = netQuietOf(T)?.last ?? 0;   // (five seconds: nothing has roused him, nobody has asked anything — nothing happens)
        // a door tried, hard, outside the entry nearest him: he is roused, and it is that door he fears (`loud` = gunfire there instead: the rally rule's ground)
        const iA = E.indexOf([...E].sort((a: any, b: any) => flat(a.at, T.char.pos) - flat(b.at, T.char.pos))[0]), eA = E[iA], at = [eA.at[0] + eA.out[0] * 0.6, 1, eA.at[2] + eA.out[1] * 0.6];
        if (loud) g.events.push({ kind: 'shot', pos: at, time: g.time, loud: true, level: 1, who: PLAYER_ID });
        else for (let k = 0; k < 3; k++) { g.events.push({ kind: 'door', pos: [...at], time: g.time, loud: true, level: 0.9, who: PLAYER_ID }); R.step(12); }   // (rattled three times: once does not take a calm man off his calm)
        // rule off: the ordinary defender made ALERT as roomfight.ts plant() leaves any man, his eyes kept on the door the noise came from
        const keep = () => { const d = R.def(T); if (!d) return; d.ev[iA] = 3; d.watch = d.want = iA; d.glanceUntil = -1; d.glanceNext = g.time + 100; };
        let backAt = NaN, lowAt = NaN, quietAt = NaN;
        const said = listen(R, [T], 12, t => { if (!on) { if (t > 0.5) { T.state = 'alert'; T.awareness = Math.max(T.awareness, 0.92); keep(); } return; }
          const N = netQuietOf(T); if (!N) return; if (Number.isNaN(quietAt) && N.quiet > 0) quietAt = t; if (Number.isNaN(backAt) && N.last === 2) backAt = t; if (Number.isNaN(lowAt) && N.last === 3) lowAt = t; });
        const askAt = said.find(s => inPool('ask', s.text))?.t ?? NaN, lastLine = said.find(s => inPool('last', s.text))?.t ?? NaN;
        let easedState = '', easedCrouch = NaN;
        if (mode === 'eased' || mode === 'silent') { R.step(Math.round((K.alertSecs + 8) * 60)); easedState = T.state; easedCrouch = T.char.anim.crouch ?? 0; }
        const Df = R.def(T), N = netQuietOf(T), moved = flat(T.char.pos, p0);
        // Sam walks in by the OTHER door: of the room's entries, the one furthest round from the door the noise came from
        const eB = [...E].sort((a: any, b: any) => Math.abs(wrap(yawTo(T.char.pos, b.at) - yawTo(T.char.pos, eA.at))) - Math.abs(wrap(yawTo(T.char.pos, a.at) - yawTo(T.char.pos, eA.at))))[0];
        const offGun = Math.abs(wrap(yawTo(T.char.pos, eB.at) - T.char.aimYaw)), offWatch = Df ? Math.abs(wrap(yawTo(T.char.pos, eB.at) - yawTo(T.char.pos, Df.pt))) : NaN, crouch = T.char.anim.crouch ?? 0, state0 = T.state as string;
        const inArc = !!N && N.last === 3 ? Math.abs(wrap(yawTo(T.char.pos, eB.at) - N.yaw)) <= Math.max(N.arc / 2, K.arcDeg * DEG / 2) + 10 * DEG : false;
        if (mode === 'eased') { g.events.push({ kind: 'door', pos: [eB.at[0] + eB.out[0] * 0.6, 1, eB.at[2] + eB.out[1] * 0.6], time: g.time, loud: true, level: 0.9, who: PLAYER_ID }); R.step(20); }   // (the door he is about to come through, tried)
        const state1 = T.state as string, w = walkIn(R, T, eB); LASTSTAND.callOut = was.callOut;
        return { seed, easedState, easedCrouch, state1, calmLines: calm.length, actCalm, askAt, quietAt, lastLine, backAt, lowAt, moved, arc: N ? N.arc / DEG : NaN, entries: E.length, door: eB.door.def.name, nearDoor: Math.min(...E.map((e: any) => flat([e.at[0] - e.out[0] * 0.5, 0, e.at[2] - e.out[1] * 0.5], T.char.pos))), offGun: offGun / DEG, offWatch: offWatch / DEG, crouch, state0, inArc, ...w, alive: T.state !== 'dead', state: N?.last ?? -1, quiet: N?.quiet ?? 0, selfAsks: NETQUIET_STATS.selfAsks };
      };
      const ons: any[] = [], offs: any[] = []; for (const s of SEEDS) { ons.push(await run(s, 'on')); offs.push(await run(s, 'off')); }
      const K = NETQUIET, sector = FIGHT_SKILL.hostile.sectorDeg;
      const cause = (r: any) => r.calmLines === 0 && r.actCalm === 0 && r.quiet > 0 && r.quietAt <= r.lastLine && r.lastLine >= K.askBeat - 0.05 && (Number.isNaN(r.askAt) || (r.askAt >= K.calmSecs - 0.7 && near(r.lastLine - r.askAt, K.askBeat, 0.1)));
      const okOn = (r: any, fireS = FIRE_S) => r.state === 3 && cause(r) && (Number.isNaN(r.backAt) || r.backAt >= r.lastLine + K.lastBeat - 0.1) && r.lowAt >= r.lastLine + K.lastBeat - 0.1 && r.crouch > LOWC && r.lowSeen > LOWC && r.inArc && r.beat <= fireS;
      const oldOff = (r: any, o: any) => r.crouch < 0.3 && r.state0 === 'alert' && r.offWatch > sector && !(r.fireAt <= o.fireAt);
      const nOn = ons.filter(r => okOn(r)).length, nOff = offs.filter((r, i) => oldOff(r, ons[i])).length;
      const row = (r: any) => `${r.seed}: ${r.door}, ${f2(r.offWatch)}° off his watch, ${r.state0}, crouch ${f2(r.crouch)} · ${Number.isNaN(r.seenAt) ? 'Sam never seen in 6 s (he walked to 2.5 m inside and stood)' : `seen ${f2(r.depth)} m past the threshold → round ${f2(r.beat)} s later (${f2(r.fireAt)} s after Sam's first step)`}`;
      line(nOn === SEEDS.length && ons[0].entries >= 2,
        `(Q6a) THE DONE-TEST, rule on, ${SEEDS.length} seeds, Sam walking in: five seconds of nothing while nothing has roused him; roused, he asks the net himself after calmSecs (nobody else has), the silence has his line out of him askBeat later, he backs off after its beat, is crouched with Sam's door inside his arc, and fires inside ${FIRE_S} s of the sighting`,
        `${nOn} of ${SEEDS.length} · room of ${ons[0].entries} entries · after the noise: asks at ${ons.map(r => f2(r.askAt)).join('/')} s, his line at ${ons.map(r => f2(r.lastLine)).join('/')} s, backing from ${ons.map(r => f2(r.backAt)).join('/')} s, low at ${ons.map(r => f2(r.lowAt)).join('/')} s · walked ${ons.map(r => f2(r.moved)).join('/')} m · arc ${ons.map(r => f2(r.arc)).join('/')}°\n    ${ons.map(row).join('\n    ')}`);
      line(nOff === SEEDS.length && offs.every(r => r.state <= 0),
        '(Q6b) the same staging, rule off, the man made ALERT and watching the door the noise came from (the owner\'s case): upright, Sam\'s door outside his sector — and his first round, counted from Sam\'s first step, later than the low man\'s on the same seed, or never (Sam never in his eyes)',
        `${nOff} of ${SEEDS.length} · never saw Sam: ${offs.filter(r => Number.isNaN(r.seenAt)).length} · saw him and fired later: ${offs.filter((r, i) => r.fireAt > ons[i].fireAt).length}\n    ${offs.map(row).join('\n    ')}`);
      const mOn = median(ons.map(r => r.beat)), mOff = median(offs.map(r => r.beat)), tOn = median(ons.map(r => r.fireAt)), tOff = median(offs.map(r => r.fireAt));
      line(mOn <= FIRE_S && !(tOff <= tOn), '(Q6c) medians, both men alert: sighting → first round with the rule on is the floor\'s own alert beat (no reaction number is changed), and from Sam\'s first step to the first round the upright man is later or never fires',
        `on: sighting → round ${f2(mOn)} s, Sam's first step → round ${f2(tOn)} s · off: sighting → round ${f2(mOff)} s, first step → round ${f2(tOff)} s (NaN = most seeds never saw him)`);
      // (Q6d) the same man with his squad's rules live and GUNFIRE at the door (the rally's and the squad's ground); a man whose spot is where he stands; a room with doors on three walls
      { const S3 = SEEDS.slice(0, 3), sq: any[] = [], sqOff: any[] = [], stay: any[] = [], wide: any[] = [];
        for (const s of S3) { sq.push(await run(s, 'on', 'garage@1', true, true)); sqOff.push(await run(s, 'off', 'garage@1', true, true)); stay.push(await run(s, 'on', 'garage')); wide.push(await run(s, 'on', 'sala')); }
        const held = (r: any) => r.state === 3 && r.crouch > LOWC && r.inArc && r.beat <= 3.5, wideOk = (r: any) => r.state === 3 && r.lowSeen > LOWC && r.beat <= 3.5 && r.arc <= 125 && r.nearDoor >= K.doorM - 0.3;   // (the sala's man is dealt inside doorM of a door: the narrowest arc CLEAR of every doorway is 123° — the 116° spot it had was in a doorway's mouth)
        line(sq.every(held) && sqOff.every(r => !(r.beat <= 3.5)) && stay.every(r => okOn(r) && r.moved < 0.5) && wide.every(wideOk),
          `(Q6d) rule on, ${S3.length} seeds each: with his squad's rules live and gunfire at his door he still holds, low, and fires inside 3.5 s of the sighting (rule off, alert and watching the other door: no round); a man whose spot is where he stands goes low there and does the same; in a room with doors on three walls there is no 40° spot — he takes the narrowest arc clear of every doorway, its middle in his eyes, and fires inside 3.5 s`,
          `squads live + gunfire: ${sq.map(r => `seen ${f2(r.depth)} m in, round ${f2(r.beat)} s later`).join(' / ')} (walked ${sq.map(r => f2(r.moved)).join('/')} m) · rule off: ${sqOff.map(r => `${f2(r.beat)} s, walked ${f2(r.moved)} m`).join(' / ')}\n    stays put (the garage's man where he is dealt, arc ${f2(stay[0].arc)}°): ${stay.map(r => `${f2(r.beat)} s`).join('/')}\n    three doors (the sala's man, arc ${f2(wide[0].arc)}°, nearest entry ${f2(wide[0].nearDoor)} m): Sam ${wide.map(r => `${f2(r.offWatch)}° off his watch, ${Number.isNaN(r.seenAt) ? 'never seen' : `seen ${f2(r.depth)} m past the threshold, round ${f2(r.beat)} s later`}`).join(' / ')}`); }
      // (Q6g) the kitchen's man as dealt: he stands inside doorM of one door (1.94 m) — that is his reason to move, and never to a spot inside doorM of the other
      { const S3 = SEEDS.slice(0, 3), kt: any[] = []; for (const s of S3) kt.push(await run(s, 'on', 'kitchen'));
        line(kt.every(r => okOn(r, 3.5) && r.entries >= 2 && r.moved > 1 && r.nearDoor >= K.doorM - 0.3),
          `(Q6g) rule on, ${S3.length} seeds, the kitchen's man where he is dealt (inside doorM of one of his doors): he backs out of that doorway's mouth to a spot at least doorM (${K.doorM} m, less 0.3 for where a walk ends) from EVERY entry, low, the door Sam walks in by inside his watched arc, and he fires inside 3.5 s of the sighting`,
          kt.map(r => `${r.seed}: walked ${f2(r.moved)} m, nearest entry ${f2(r.nearDoor)} m, arc ${f2(r.arc)}°, ${r.door} ${r.inArc ? 'in' : 'OUT OF'} his arc, crouch ${f2(r.lowSeen)} · ${Number.isNaN(r.seenAt) ? 'Sam never seen' : `seen ${f2(r.depth)} m past the threshold, round ${f2(r.beat)} s later`}`).join('\n    ')); }
      // (Q6f) nobody asks anything (the last defenders' own check held off): he asks the net himself
      { const S2 = SEEDS.slice(0, 2), fs: any[] = []; for (const s of S2) fs.push(await run(s, 'on', 'garage@1', false, false, false));
        line(fs.every(r => okOn(r) && r.askAt >= K.calmSecs - 0.7 && r.selfAsks >= 1),
          '(Q6f) the same, with the last defenders\' own check held off — nobody asks the net anything: roused, he asks it himself after calmSecs, the silence has his line out of him askBeat later, then the beat, then low; the same done-test',
          fs.map(r => `${r.seed}: asks at ${f2(r.askAt)} s, his line at ${f2(r.lastLine)} s, low at ${f2(r.lowAt)} s, round ${f2(r.beat)} s after the sighting`).join(' · ')); }
      // (Q6e) alertSecs of quiet later
      { const S2 = SEEDS.slice(0, 2), es: any[] = [], qs: any[] = []; for (const s of S2) { es.push(await run(s, 'eased')); qs.push(await run(s, 'silent')); }
        line(qs.every(r => r.state === 3 && r.state1 === 'suspicious' && r.beat <= 3.5) && es.every(r => r.state === 3 && r.easedState === 'suspicious' && r.easedCrouch > LOWC && r.inArc && r.moved > 0.5 && r.state1 === 'alert' && r.beat <= FIRE_S),
          `(Q6e) ${K.alertSecs + 8} s of nothing later he is no longer 'alert' (as a man his squad calms is not, for ever) — wary, still low, on the spot, Sam's door in his arc; the door tried has him on his gun again, and the done-test holds; with no sound at all before Sam is in the doorway he pays the floor's own beat for going alert, and still fires`,
          es.map(r => `${r.seed}: after the quiet '${r.easedState}', crouch ${f2(r.easedCrouch)}; after the door is tried '${r.state1}'; seen ${f2(r.depth)} m past the threshold → round ${f2(r.beat)} s later`).join(' · ') + ` · no sound at all: ${qs.map(r => `'${r.state1}', seen ${f2(r.depth)} m past the threshold → round ${f2(r.beat)} s later`).join(' / ')}`); } }

    // ---------------------------------------------------------------- (Q7) a checkpoint: straight run against loaded run
    { // (the room clear's spawned units refuse a whole checkpoint — savestate.ts canSave — so the slice is taken and put back the way that file does it:
      //  netQuietSnapshot through JSON, every man forgotten, netQuietRestore; the same staging is run twice, once straight and once through that)
      const go = async (load: boolean) => {
        const R = await stage(SEEDS[0], { on: true, training: 'trained', squads: false }), g = R.g, T = R.of('garage'), E: any[] = R.def(T).room.entries;
        R.put(T, R.mark('garage', 1)); R.step(2); R.openDoors(E); R.step(20);   // ((Q6)'s man, on the same mark)
        for (const x of g.guards) if (x !== T && x.team === 'hostile' && x.state !== 'dead') killGuard(g, x, [0, 0, 1], true, 'shot', 'player');
        R.step(300);
        const eA = [...E].sort((a: any, b: any) => flat(a.at, T.char.pos) - flat(b.at, T.char.pos))[0];
        g.events.push({ kind: 'door', pos: [eA.at[0] + eA.out[0] * 0.6, 1, eA.at[2] + eA.out[1] * 0.6], time: g.time, loud: true, level: 0.9, who: PLAYER_ID });
        for (let i = 0; i < 900 && (netQuietOf(T)?.last ?? 0) < 1; i++) R.step();   // (to the frame his line is out: the act saved mid-way)
        const at = netQuietOf(T)?.last ?? -1; let hold = false, feed = false, act = -1, keyed = false, wiped = false;
        if (load) { const snap = copy(netQuietSnapshot(g) ?? null); keyed = !!snap; netQuietRestore(g, undefined); wiped = g.guards.every((x: any) => !netQuietOf(x)) && !netFeedHolds(T); NETFEED.live = false;
          netQuietRestore(g, snap); hold = netFeedHolds(T); feed = NETFEED.live; act = netQuietOf(T)?.last ?? -1; }
        let lowAt = NaN; for (let i = 1; i <= 480; i++) { R.step(); if (Number.isNaN(lowAt) && netQuietOf(T)?.last === 3) lowAt = i * DT; }
        const N = netQuietOf(T); return { at, lowAt, last: N?.last ?? -1, spot: N?.spot ? [...N.spot] : null, crouch: T.char.anim.crouch ?? 0, quiet: N?.quiet ?? -1, hold, feed, act, keyed, wiped };
      };
      const straight = await go(false), loaded = await go(true);
      const same = loaded.last === straight.last && !!loaded.spot && !!straight.spot && flat(loaded.spot, straight.spot) < 0.05 && loaded.crouch > LOWC && loaded.quiet === straight.quiet && Math.abs(loaded.lowAt - straight.lowAt) < 0.05;
      line(BREAK ? loaded.wiped : straight.at === 1 && loaded.at === 1 && loaded.keyed && straight.last === 3 && same && loaded.hold && loaded.feed && loaded.act === 1 && loaded.wiped,
        '(Q7) a checkpoint\'s slice taken as his line goes out, every man forgotten, the slice put back, and the run played on — against the same run played straight: both end low on the same spot at the same frame; at the load, before any frame runs, the act is back and with it his squad\'s hold and the squads\' book (they tick before this file does); no key: every man unmet',
        `saved at act ${loaded.at} · straight: act ${straight.last}, low ${f2(straight.lowAt)} s later, spot ${P(straight.spot)}, quiet ${straight.quiet} · loaded: act ${loaded.last}, low ${f2(loaded.lowAt)} s later, spot ${P(loaded.spot)}, crouch ${f2(loaded.crouch)}, quiet ${loaded.quiet} · at the load: act ${loaded.act}, hold ${loaded.hold}, feed live ${loaded.feed} · no key: every man unmet ${loaded.wiped}`); }

    // ---------------------------------------------------------------- (Q10) the last of his squad, his mates seen to fall · (Q11) a mate beside him again
    { const R = await stage(67, { on: true, training: 'trained', squads: true }), g = R.g, T = R.of('shed', 2), men: any[] = squadOf(g, T).men.filter((m: any) => m !== T), K = NETQUIET;   // (the Yard's man in the middle of the shed)
      R.step(30); for (const t of g.targets) if (!t.on) g.toggleTarget(t);
      const p0 = [...T.char.pos], a0 = NETQUIET_STATS.asks;
      const spots: number[][] = []; for (let a = 0; a < 12 && spots.length < men.length; a++) { const y = a * Math.PI / 6, q = [T.char.pos[0] + Math.sin(y) * 1.7, 0, T.char.pos[2] + Math.cos(y) * 1.7]; if (!g.col.nav.isBlocked(q[0], q[2]) && !g.col.segmentBlocked([T.char.pos[0], 1.5, T.char.pos[2]], [q[0], 1.2, q[2]]) && spots.every(o => flat(o, q) > 0.8)) spots.push(q); }
      men.forEach((m, i) => { R.put(m, spots[i] ?? T.char.pos); R.face(T, m.char.pos); R.step(1); R.put(m, spots[i] ?? T.char.pos); R.face(T, m.char.pos); killGuard(g, m, [0, 0, 1], true, 'shot', 'player'); });
      const knows = men.filter(m => netQuietOf(T)?.known.has(m.char.id)).length, up = hostiles(g).length - 1;
      let lowAt = NaN; const said = listen(R, [T], 14, t => { if (Number.isNaN(lowAt) && netQuietOf(T)?.last === 3) lowAt = t; });
      const l = said.find(s => inPool('alone', s.text)), lastLines = said.filter(s => inPool('last', s.text)).length, N = netQuietOf(T), crouch = T.char.anim.crouch ?? 0;
      line(knows === men.length && up > 0 && NETQUIET_STATS.asks === a0 && !!l && l.radio && lastLines === 0 && N?.last === 3 && lowAt >= l.t + K.lastBeat - 0.1 && crouch > LOWC && netFeedHolds(T),
        '(Q10) the last of his squad, every mate seen to fall and nobody ever asked for (other squads still up): he knows — his line (his own squad\'s, not "somebody talk to me"), the beat, low; his squad sends him nowhere meanwhile',
        `mates known gone ${knows} of ${men.length}, checks asked ${NETQUIET_STATS.asks - a0}, ${up} of other squads up · ${l ? `"${l.text}" at ${f2(l.t)} s` : words(said)} · low at ${f2(lowAt)} s (act ${N?.last}), crouch ${f2(crouch)}, walked ${f2(flat(T.char.pos, p0))} m · held from his squad: ${netFeedHolds(T)}`);
      // (Q11) a man of another squad walks past (a second inside mateM), then one comes and stays
      const O = hostiles(g).find((x: any) => x !== T), home = [...O.char.pos], by = R.beside(T.char.pos, [T.char.pos[0] + 2, 0, T.char.pos[2] + 2], 2), rel0 = NETQUIET_STATS.released;
      R.put(O, by); R.step(60); R.put(O, home); R.step(90); const past = { act: netQuietOf(T)?.last, crouch: T.char.anim.crouch ?? 0 };
      let upAt = NaN; for (let i = 1; i <= 360; i++) { R.put(O, by); R.step();   // (he STAYS: stood there every frame — left to himself a man of another squad is off home through the door inside four seconds)
        if (Number.isNaN(upAt) && netQuietOf(T)?.last === 0) upAt = i * DT; }
      const after = { act: netQuietOf(T)?.last, crouch: T.char.anim.crouch ?? 0, holds: netFeedHolds(T) || netQuietHolds(T) };
      line(past.act === 3 && past.crouch > LOWC && near(upAt, K.calmSecs, 0.15) && after.act === 0 && after.crouch < 0.3 && !after.holds && NETQUIET_STATS.released === rel0 + 1,
        '(Q11) a living man of his side walking past (one second inside mateM) leaves him low; one who comes and stays has him up after calmSecs, the act dropped, his squad\'s to send again',
        `walked past: act ${past.act}, crouch ${f2(past.crouch)} · stayed: up at ${f2(upAt)} s (calmSecs ${K.calmSecs}), act ${after.act}, crouch ${f2(after.crouch)}, still held ${after.holds} · released ${NETQUIET_STATS.released - rel0}`); }

    // (Q13) A MAN WHO HAS RUN (runner.ts) is silent on the net and never the last man; to the man he left he is one more gone. (Q10)'s staging, one mate left
    // alive: `run` = that mate is taken by the run rule (runnerBreak), else he stands where he stood (the control: a living mate, and no last man)
    { const left = async (run: boolean) => {
        const R = await stage(67, { on: true, training: 'trained', squads: true, runner: true }), g = R.g, T = R.of('shed', 2), squad: any[] = squadOf(g, T).men, others: any[] = squad.filter((m: any) => m !== T), M = others[others.length - 1], dead = others.filter(m => m !== M), K = NETQUIET;
        R.step(30); for (const t of g.targets) if (!t.on) g.toggleTarget(t);
        const spots: number[][] = []; for (let a = 0; a < 12 && spots.length < dead.length; a++) { const y = a * Math.PI / 6, q = [T.char.pos[0] + Math.sin(y) * 1.7, 0, T.char.pos[2] + Math.cos(y) * 1.7]; if (!g.col.nav.isBlocked(q[0], q[2]) && !g.col.segmentBlocked([T.char.pos[0], 1.5, T.char.pos[2]], [q[0], 1.2, q[2]]) && spots.every(o => flat(o, q) > 0.8)) spots.push(q); }
        const took = run && runnerBreak(g, M); R.step(60);   // (the shout, the beat, the drop: he has run before the others fall)
        const fled = runnerFled(M), mShock0 = shockOf(M), mLines0 = NETQUIET_LOG.filter((l: any) => l.id === M.char.id).length;
        dead.forEach((m, i) => { R.put(m, spots[i] ?? T.char.pos); R.face(T, m.char.pos); R.step(1); R.put(m, spots[i] ?? T.char.pos); R.face(T, m.char.pos); killGuard(g, m, [0, 0, 1], true, 'shot', 'player'); });
        // the squad's check, as enemysquads.ts files it: T asks for a dead mate by name on the squad's net (does the man who ran hear it?), then for M himself
        netQuietAsked(g, T, dead[0], squad); const heard = !!netQuietOf(M)?.asked.has(dead[0].char.id), mShock1 = shockOf(M);
        const q0 = netQuietOf(T)?.quiet ?? 0, s0 = shockOf(T); netQuietAsked(g, T, M, squad); const silent = !!netQuietOf(T)?.asked.has(M.char.id), dq = (netQuietOf(T)?.quiet ?? 0) - q0, ds = shockOf(T) - s0;
        let lowAt = NaN, mineM = 0, actM = 0; const said = listen(R, [T], 14, t => { if (Number.isNaN(lowAt) && netQuietOf(T)?.last === 3) lowAt = t; if (netQuietHolds(M) || netFeedHolds(M)) mineM++; actM = Math.max(actM, netQuietOf(M)?.last ?? 0); });
        return { T, M, took, fled, owned: runnerOwns(M), onFloor: g.guards.includes(M), alive: M.state !== 'dead', heard, mShock: mShock1 - mShock0, silent, dq, ds, want: K.unanswered * kOf(g, T), lowAt, act: netQuietOf(T)?.last, crouch: T.char.anim.crouch ?? 0, mineM, actM, mLines: NETQUIET_LOG.filter((l: any) => l.id === M.char.id).length - mLines0, alone: said.find(s => inPool('alone', s.text) || inPool('last', s.text)) };
      };
      const A = await left(true), C = await left(false);
      line(A.took && A.fled && A.alive && !A.heard && near(A.mShock, 0) && A.silent && A.dq === 1 && near(A.ds, A.want, 1e-6) && A.mineM === 0 && A.actM === 0 && A.mLines === 0 && !!A.alone && A.act === 3 && A.crouch > LOWC,
        '(Q13) a mate who dropped it and ran: he hears no check and is shaken by none, asked for by name he is a silence like any other, he is never the last man and says no line of this rule\'s — and the man he left, his other mates down, IS the last man: his line, low',
        `${A.M.callsign} taken by the run rule ${A.took}, fled ${A.fled}, alive ${A.alive}, on the floor at the end ${A.onFloor} · heard the check for a dead mate ${A.heard}, shock from it ${f2(A.mShock)} · asked for by ${A.T.callsign}: silent ${A.silent}, unanswered +${A.dq}, shock +${f2(A.ds)} (want ${f2(A.want)}) · frames he was the last man ${A.mineM}, his act ${A.actM}, lines of his ${A.mLines} · ${A.T.callsign}: ${A.alone ? `"${A.alone.text}"` : 'NO LINE'}, low at ${f2(A.lowAt)} s (act ${A.act}), crouch ${f2(A.crouch)}`);
      line(!C.took && !C.fled && C.heard && C.act === 0 && Number.isNaN(C.lowAt) && C.crouch < 0.3,
        '(Q13) the control: the same mate alive and not run hears the check, and the man beside him is nobody\'s last man',
        `${C.M.callsign} fled ${C.fled} · heard the check ${C.heard} · ${C.T.callsign}: act ${C.act}, low at ${f2(C.lowAt)} s, crouch ${f2(C.crouch)}`); }

    // ---------------------------------------------------------------- (Q8) the journal · (Q9) the tables and the words
    { const R = await stage(66, { on: true }), g = R.g; R.step(5);
      const Ksnap = knobsSnapshot(g), carried = !!Ksnap.tables.NETQUIET && Ksnap.tables.NETQUIET.on === true;
      NETQUIET.on = false; applyKnobs(g, Ksnap); const back = NETQUIET.on;
      const old = copy(Ksnap); delete old.tables.NETQUIET; NETQUIET.on = true; applyKnobs(g, old); const before = NETQUIET.on; NETQUIET.on = true; MORALE.on = true;
      line(carried && back === true && before === false, '(Q8) the journal: the table rides the knob snapshot and comes back on; a recording from before the key replays with the switch off', `carried ${carried} · applied: on ${back} · a file without the table: on ${before}`);
      const tables = () => { const Rg: Record<string, object> = knobRegistry(), o: Record<string, unknown> = {}; for (const k of Object.keys(Rg)) if (Rg[k] !== MORALE && Rg[k] !== NETQUIET) o[k] = copy(Rg[k]); o.FIGHT_SKILL = copy(FIGHT_SKILL); o.tune = copy(g.tune);
        o.men = g.guards.map((x: any) => [x.callsign, x.health ?? null, x.char.health ?? null, x.trained ?? null]); return JSON.stringify(o); };
      const t0 = tables(), men = g.guards.filter((x: any) => x.team === 'hostile');
      for (const x of men) { moraleShock(g, x, 0.4); netQuietAsked(g, men[0], x, men); netQuietBody(g, x, men); netQuietPose(g, x, DT, false); } R.step(240);
      const raw = readFileSync(resolve(ROOT, 'src/game/netquiet.ts'), 'utf8'), src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      const names = ['FIGHT_SKILL', 'AIM', 'GUARD_EYE', 'AI_TUNE', 'TRAINED'].filter(n => new RegExp(`\\b${n}\\b`).test(src)), writes = src.match(/\.(health|hp|skill|trained|reactT|fireCd|track|spread|sightT|lastSeenT)\s*[-+*]?=[^=]/g) ?? [];
      // a man's state and awareness ARE written — in rouse(), ease() and wary() and nowhere else: the floor's own 'alert' line, as roomfight.ts plant() writes it, and off it again
      const mindWrites = src.split('\n').filter(l => /\.(state|awareness)\s*[-+*]?=[^=]/.test(l)), outside = mindWrites.filter(l => !/^function (rouse|ease|wary)\(/.test(l.trim()));
      const eyeIs = (await import(`${ROOT}/src/game/guards.ts`)).GUARD_EYE.halfDeg;
      line(NETQUIET.eyeDeg === eyeIs && tables() === t0 && !names.length && !writes.length && mindWrites.length === 3 && !outside.length && !/Math\.random|Date\.now|performance\.now/.test(src),
        '(Q9a) every man shocked, asked for, found and posed, four seconds run: every registered knob table but MORALE / NETQUIET, FIGHT_SKILL, the tune and each man\'s health are deep-equal — netquiet.ts names no aim / skill table, assigns no health, skill, reaction beat, fire delay, sighting clock or aim track, draws no Math.random or wall clock; it DOES write a man\'s state and awareness, in rouse(), ease() and wary() only (the last man on his spot: alert as a planted defender is, no longer alert after alertSecs of nothing, and not under the floor\'s own wary line while he is there); its eyeDeg is the floor\'s own GUARD_EYE.halfDeg',
        `tables equal ${tables() === t0} · named: ${names.join(', ') || 'none'} · writes: ${writes.join(' ') || 'none'} · state / awareness written on ${mindWrites.length} lines (rouse, ease, wary), elsewhere: ${outside.length}`);
      const kinds = ['name', 'why', 'last', 'body', 'alone', 'ask'], lines: string[] = netQuietLines().map((l: string) => l.replace(/\{name\}/g, 'Lindqvist'));
      const long = lines.filter(t => t.length > D.AIM_CHARS), blocked = lines.filter(t => D.blockedPhrase(t)), compass = lines.filter(t => /\b(north|south|east|west)/i.test(t)), twice = lines.filter((t, i) => lines.indexOf(t) !== i), tight = lines.filter(t => /\S—\s|\s—\S/.test(t)), digit = lines.filter(t => /[6-9]/.test(t));
      const label = 'a quiet net frightens them';
      line(kinds.every(k => netQuietLines(k).length >= 3) && !long.length && !blocked.length && !compass.length && !twice.length && !tight.length && !digit.length && label.length < 37 && readFileSync(resolve(ROOT, 'src/ui/bindings.ts'), 'utf8').includes(`label: '${label}'`),
        `(Q9b) the lines (six kinds) fit a bubble (≤ ${D.AIM_CHARS}), none on the originality blocklist, no compass word, none twice; the panel's row is under 37 characters`, `${lines.length} lines · too long: ${long.join(' | ') || 'none'} · blocked: ${blocked.join(' | ') || 'none'} · twice: ${twice.join(' | ') || 'none'} · row "${label}" (${label.length})`); }

    // ---------------------------------------------------------------- (Q12) the seams in real runs, on the shipped stand (a child process)
    { const env: Record<string, string | undefined> = { ...process.env, TPS_PROFILE: 'shipped', NETQUIET_REAL: '1' }; delete env.TPS_MORALE; delete env.TPS_NETQUIET;
      const p = Bun.spawnSync({ cmd: [process.execPath, 'run', import.meta.path], cwd: ROOT, env, stdout: 'pipe', stderr: 'pipe' });
      const txt = p.stdout.toString(), m = txt.split('\n').find(l => l.startsWith('REAL ')); let J: any = null; try { J = m ? JSON.parse(m.slice(5)) : null; } catch { /* below */ }
      if (!J) line(false, '(Q12) the real runs on the shipped stand', `the child printed no result (exit ${p.exitCode}): ${(txt + p.stderr.toString()).slice(-600)}`);
      else {
        const A = J.A, B = J.B, C = J.C, K = NETQUIET;
        line(J.on === true && A.stats.standChecks + A.stats.squadAsks >= 1 && A.quietAt > 0 && A.lineAt >= A.quietAt + K.askBeat - 0.1 && A.lowAt >= A.lineAt + K.lastBeat - 0.1 && A.crouch > LOWC,
          '(Q12a) shipped stand, a real run: ten men dropped quietly, nothing staged after — a check of the defenders\' own goes unanswered (laststand.ts / enemysquads.ts, through the seam), the last man\'s line a beat after it, and he is low',
          `silence at ${f2(A.quietAt)} s (the last defenders' check closed ${A.stats.standChecks}×, the squad's ask ${A.stats.squadAsks}×, quiet ${A.stats.quiet}) · "somebody talk to me" at ${f2(A.lineAt)} s · low at ${f2(A.lowAt)} s, crouch ${f2(A.crouch)}`);
        const Bs: any[] = Array.isArray(B) ? B : [], first = (b: any, k: string) => (b.lines as any[]).find(l => l.kind === k), early = (b: any) => (b.lines as any[]).filter(l => l.kind === 'last' && l.early).length;
        const ends = (b: any) => { const ls = first(b, 'last'), nm = first(b, 'name'); return !!nm && !!ls && nm.t < ls.t && early(b) === 0 && b.lowAt > ls.t && b.crouch > LOWC; };
        const two = Bs.filter(b => b.stats.squadAsks >= 2), one = Bs.filter(b => b.stats.squadAsks < 2);
        const rungs = (b: any) => { const nm = first(b, 'name'), wy = first(b, 'why'), ls = first(b, 'last'); return ends(b) && !!wy && nm.t < wy.t && wy.t < ls.t && b.stats.squadBodies >= 1; };
        line(two.length >= 3 && two.every(rungs) && one.length >= 1 && one.every(b => ends(b) && !first(b, 'why') && b.seenDown && b.stats.squadAsks === 1),
          `(Q12b) shipped stand, real runs, ${Bs.length} casts of the Yard: its leader struck down in the garage, a man of the shed a hundred seconds later, then everybody but one more of the shed's. Wherever the squad's check goes unanswered twice (the second man dropped out of his mates' sight) the calls come in order — the name · why's nobody answering · somebody talk to me, that one never while anybody else was up — and he ends low. Where a mate SEES the second man down the squad knows without asking (a body found, no check): one check unanswered, so the name, no "why", then the last line`,
          Bs.map(b => `seed ${b.seed}, shed man ${b.vi} struck, man ${b.ti} left: squad asks ${b.stats.squadAsks}, bodies ${b.stats.squadBodies}${b.seenDown ? ', the second man seen down' : ''} · ${(b.lines as any[]).map(l => `${f2(l.t)} ${l.who} ${l.kind}`).join(' · ')} · low at ${f2(b.lowAt)} s`).join('\n    '));
        line(C.stats.staffAsks >= 1 && C.kind === 'name' && typeof C.line === 'string' && C.line.includes(C.victim),
          '(Q12c) shipped stand, the office floor: one of the night staff struck down — the roll call asks for him by name (guards.ts updateRollcall, through the seam) and the asker says the name again',
          `${C.staff} staff, ${C.victim} down · roll call asked at ${f2(C.askAt)} s · "${C.line}" (${C.kind}) at ${f2(C.lineAt)} s · staff bodies found ${C.stats.staffBodies}`); } }
    void NETQUIET_LOG;
  } catch (e) { all = false; console.log(`- FAIL — the check threw\n    ${e instanceof Error ? e.stack : String(e)}`); }
  finally { RUNNER.on = later.runner; DARKDOOR.on = later.door; SQUADS.on = was.squads; LASTSTAND.callOut = was.callOut; Object.assign(MORALE, was.morale); Object.assign(NETQUIET, was.nq); NETQUIET_QA.broken = false; NETFEED.live = false; Math.random = was.rnd; }
  console.log(`=== netquiet: ${all ? 'ALL PASS' : 'FAIL'} ===`);
  return all;
}

if (import.meta.main) {
  if (process.env.NETQUIET_REAL === '1') { console.log(`REAL ${JSON.stringify(await realRuns())}`); process.exit(0); }
  process.exit((await netquietCheck()) ? 0 : 1);
}
