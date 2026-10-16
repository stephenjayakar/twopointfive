// TRAINING — the check behind the second slice of src/game/morale.ts: who is green and who is steady (trainingOf / leaderOf, MORALE.training, a squad's own
// `training` key, the difficulty's mix), how each of them copes, the leader's order, the leader's death, MORALE.nerve — and the two fixes to the first slice
// (a calm man's standing terms count for nothing; the scrabble's fan). Standalone and through probes.ts (the `morale` family runs morale-check.ts and this):
//   bun run tools/qa/training-check.ts          bun run tools/qa/probes.ts morale
// morale-check's staging: the compound's room clear AS THE LEVEL FILE DEALS IT (four squads: Yard five, Gate one, West two, Keep three), the hut by the gate
// behind its door, the 40 mm on the door's outside face. The hut's own man is a squad of one — his own leader — so the LONE man of a case is the nearest man
// who is not his squad's first, stood in the hut with the hut's man sent across the yard with the rest; a leader and his green men are the Yard's (the squad
// with men to spare for the far side of a wall). Headless, PASS / FAIL each, on sim state:
//   (A1) a calm man of the night staff alone in a blacked-out office reads STEADY, dread 0; off his calm round, or with a shock on him, the standing terms count
//   (A2) a man with the hut's wall half a metre behind him still gets a metre and more of scrabble, facing the hole, by the fan — and with the fan shut
//        (fanStep 0: straight back only, as the first slice had it and as an old recording replays) he has nowhere to go
//   (T1) the mix by difficulty, on the compound's own squads — five, three, TWO and ONE: on standard every squad has one steady man, its first, and the rest
//        are green; on hard every man is steady but the last of a squad of three or more; the night staff go by temperament; a `trained` man is always steady
//   (T2) every MORALE.training choice, a squad's own `training` key under 'difficulty', and the level lint's three words for it
//   (T3) alone with the lamps BURNING, the 40 mm on his door: a GREEN man is broken — folded, a call that does not say he cannot see, rounds into the dust —
//        a STEADY man ducks, and for a second, not a green man's two and a half
//   (T4) a STEADY man alone in the dark is broken as before and copes trained: never folded, a metre and more back facing the hole, the flat call on the net,
//        NOT A ROUND into the dust; a thing thrown through the hole draws `baitShort` rounds, twice, and a third nothing — no change, no shout that he is out
//   (T5) the leader and a green man of his two metres apart on one blast: the leader never crouches, his gun comes onto the hole, he gives the order, spoken;
//        the green man is down until `orderSecs` after it — well short of his duck's whole time — and answers as he gets up. With every man trained the
//        leader still stands and the steady man beside him is up before a green one would be
//   (T6) the leader killed in green men's view: the standing term, the shock, sawLeaderFall counting from 0, the FLINCH, and ONE man — the nearest — saying
//        so on that frame; a green man of his with a wall between: the term only; with the switch off the seam does nothing
//   (F2) after it, one blast on the two green men standing together breaks ONE of them — the one who said it — and the other ducks
//   (F3) no break is for ever: a green man alone in the dark is let go `holdMax` seconds in, and is not broken once his shock has run down
//   (F6) no squads staged: the men of a room are a band — one steady man a room, his death is his room's alone
//   (T7) nerve brittle / steady scale a shock by `nerveK`, through moraleShock and through a blast; steady nerve keeps a lone lit green man under his line
//   (T8) no aim, skill, reaction or health table is touched: every registered knob table but MORALE, and roomfight.ts FIGHT_SKILL, deep-equal before and after
//        every training × nerve choice has been read for every man and ticked; morale.ts names none of them, and assigns no man's health, skill or trained flag;
//        a recording carries the two choices, one from before them replays as the first slice
//   (V)  the visit: no store = the page's own; the address speaks; only the row touched is kept
//   (R)  the debugger's roster row: one short line, 'men ▸ S g · S g g · S g g g g · S'
//   (S)  the debugger's switch put off in a man's hold and on again: every man's state went with it
//   (T9) the new lines fit a bubble, none on the blocklist, none twice
//   (T10) the slice's checkpoint record (moraleSnapshot / moraleRestore — a whole checkpoint is refused with the squad's spawned units on the floor), taken in
//        the leader's stand and laid on a fresh staging: who waits on whom, and the order and the answer still given
// It raises what it needs itself, so it passes on the frozen stand and under TPS_PROFILE=shipped.
// TRAINING_BREAK=1 = the rule's own tables spoiled, the switch left alone — MORALE_AT's two rows swapped, a green man's line out of reach, the leader's death
// worth nothing, his order reaching nobody: (T1), (T2), (T3) green, (T5), (T10), (T6)'s first line, (F2), (F3) and (F6) must fail (how a steady man
// copes, the flinch and its line, the roster row, the nerve and the visit are not spoiled by it and pass).   exit 0 / 1
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const ROOT = resolve(import.meta.dir, '../..');
type V3 = [number, number, number];
const DT = 1 / 60, f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x));
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** the compound's level file as it ships (parsed JSON, a fresh object each call) */
const compoundRaw = (): any => JSON.parse(readFileSync(resolve(ROOT, 'levels', 'compound.json'), 'utf8'));
const quiet = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => {}; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };

export async function trainingCheck(): Promise<boolean> {
  const { standUp } = (await import('./headless.ts')) as any;
  const M = await import(`${ROOT}/src/game/morale.ts`);
  const { MORALE, MORALE_AT, TRAININGS, NERVES, moraleOf, rungOf, dreadOf, moraleLines, inTheDark, trainingOf, leaderOf, sawLeaderFall, moraleShock, moraleTick, moraleRoster, moraleSnapshot, moraleRestore, moraleManDown, moraleOwns, moraleFromQuery, moraleKeep, moraleReset, moraleSummary, MORALE_STATS } = M;
  const { DOORBLAST } = await import(`${ROOT}/src/game/doorblast.ts`);
  const { RUNNER } = await import(`${ROOT}/src/game/runner.ts`);
  const { DARKDOOR } = await import(`${ROOT}/src/game/darkdoor.ts`);
  /** the two later rules held off for this file's cases (runner-check.ts / darkdoor-check.ts hold them with training) — again after every stand-up, which re-reads the stand's words */
  const { NETQUIET: NQ_ } = await import(`${ROOT}/src/game/netquiet.ts`); const nq0_ = NQ_.on;   // (the net goes quiet, a later rule: held off here, after every stand-up — netquiet-check.ts holds it with the rest)
  const later = { runner: RUNNER.on, door: DARKDOOR.on }, held = () => { RUNNER.on = false; DARKDOOR.on = false; NQ_.on = false; };
  const { FRAG, blast } = await import(`${ROOT}/src/game/frag.ts`);
  const { DESTRUCTION } = await import(`${ROOT}/src/game/destructionSwitch.ts`);
  const { HE40 } = await import(`${ROOT}/src/game/he40.ts`);
  const { doorPt } = await import(`${ROOT}/src/game/doortools.ts`);
  const { PLAYER_ID } = await import(`${ROOT}/src/game/consts.ts`);
  const { parseLevelData, validateLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
  const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);
  const { squadOf, SQUADS } = await import(`${ROOT}/src/game/enemysquads.ts`);
  const { setDifficulty, difficultyNow } = await import(`${ROOT}/src/game/difficulty.ts`);
  const { PRESSURE } = await import(`${ROOT}/src/game/pressure.ts`);
  const { DIGIN } = await import(`${ROOT}/src/game/digin.ts`);
  const { FOG } = await import(`${ROOT}/src/game/fogofwar.ts`);
  const { knobRegistry } = await import(`${ROOT}/src/game/knobs.ts`);
  const { knobsSnapshot, applyKnobs } = await import(`${ROOT}/src/game/journal.ts`);
  const { FIGHT_SKILL } = await import(`${ROOT}/src/game/roomfight.ts`);
  const D = await import(`${ROOT}/src/game/dialogue.ts`);
  const BREAK = process.env.TRAINING_BREAK === '1'; let all = true;
  const copy = (o: unknown) => JSON.parse(JSON.stringify(o));
  const was = { morale: copy(MORALE), frag: copy(FRAG), door: DOORBLAST.on, sw: DESTRUCTION.on, rnd: Math.random, squads: SQUADS.on, P: copy(PRESSURE), Dg: copy(DIGIN), cone: FOG.cone };
  const line = (ok: boolean, label: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  console.log(`\n=== training: green men and steady men${BREAK ? ' (TRAINING_BREAK: training counts for nothing)' : ''} ===`);
  const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]), wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
  const train = (v: string) => { MORALE.training = v; };
  /** TRAINING_BREAK: the rule's own tables spoiled (see the head) — laid on after every staging has put the knobs where it wants them */
  const atWas = { ...MORALE_AT }, spoil = () => { if (BREAK) { MORALE_AT.standard = 'hard'; MORALE_AT.hard = 'mixed'; MORALE.greenBroken = 2; MORALE.leaderDown = 0; MORALE.leaderShock = 0; MORALE.orderM = 0; } };
  const put = (gd: any, p: number[]) => { gd.char.pos = [p[0], 0, p[2]]; gd.char.vel = [0, 0, 0]; gd.path = []; gd.pathGoal = null; gd.speed = 0; gd.lastPos = [p[0], 0, p[2]]; };
  const fired = (gd: any) => gd.weapon.shotsFired;
  const facing = (gd: any, at: number[]) => Math.abs(wrap(Math.atan2(at[0] - gd.char.pos[0], at[2] - gd.char.pos[2]) - gd.char.bodyYaw));

  /** the hut and its door. `training` = the knob; `dark` = the hut's lamps put out; `pair` = a leader and a green man of his stood in the hut (else one man
   *  alone in it — the nearest who is not his squad's first — the rest across the yard); `deep` = the lone man walked back off the door until the wall is at
   *  his back */
  const stage = async (seed: number, o: { training: string; dark?: boolean; pair?: boolean; trio?: boolean; deep?: boolean; nerve?: string; squads?: boolean }) => {
    Math.random = seeded(seed); MORALE.on = false;
    const W: any = await quiet(() => standUp({ level: loadLevel(parseLevelData(JSON.stringify(compoundRaw()))) }));
    const g = W.game; DOORBLAST.on = true; DESTRUCTION.on = true; FRAG.doorStun = true; SQUADS.on = o.squads !== false; g.tune.chaos = 0.5; MORALE.on = true; held(); MORALE.nerve = o.nerve ?? 'normal'; train(o.pair ? 'mixed' : o.training);
    startFromQuery(g, 'levelFile=compound.json&roomclear&squad4'); g.godMode = true;
    const step = (n = 1) => { for (let i = 0; i < n; i++) { g.player.visibility = 0.05; W.step(DT); } };
    step(10);
    const d = g.doors.list.find((x: any) => x.def.name === 'hut_w'); d.reset(); d.angle = 0; d.vel = 0; d.latched = true; d.closing = false; d.place();
    const mid = doorPt(d, d.def.width / 2, 0, 1, 0);
    const men = g.guards.filter((x: any) => x.team === 'hostile' && x.state !== 'dead').sort((a: any, b: any) => flat(a.char.pos, mid) - flat(b.char.pos, mid));
    const first = (x: any) => squadOf(g, x)?.men[0] === x, size = (x: any): number => squadOf(g, x)?.men.length ?? 0;
    let T = men.find((x: any) => !first(x)) ?? men[0], T2 = men.find((x: any) => x !== T), T3: any = null;   // (alone: a man who is nobody's leader, whatever the knob says)
    if (o.pair) { const G = men.filter((x: any) => trainingOf(g, x) === 'green' && leaderOf(g, x)).sort((a: any, b: any) => size(b) - size(a))[0] ?? men[1]; T2 = G; T = leaderOf(g, G) ?? men.find((x: any) => x !== G);   // (T the leader, T2 a green man of his, of the largest squad — picked under 'leader and green', whatever the case then sets)
      if (o.trio) T3 = men.find((x: any) => x !== T && x !== T2 && leaderOf(g, x) === T) ?? men.find((x: any) => x !== T && x !== T2); train(o.training); }
    spoil();
    const inside: 1 | -1 = g.doors.side(d, men[0].char.pos), side = -inside as 1 | -1;
    { const s = doorPt(d, d.def.width / 2 + 9, 6, side, 0); g.teleportPlayer([s[0], 0, s[2]]); }
    let p = doorPt(d, d.def.width / 2 + (o.deep ? 1.2 : 0), 2.4, inside, 0);   // (deep: to one side of the door's line, so the room's width lies open on his other hand)
    const hole = doorPt(d, d.def.width / 2, HE40.standoff + 0.03, side, 1.0) as V3;
    let k = 0; men.forEach((x: any) => { if (x !== T && !(o.pair && x === T2) && x !== T3) { put(x, [4.8 + (k % 4) * 0.9, 0, 5.8 + Math.floor(k / 4) * 0.9]); k++; } });
    if (o.deep) {   // back off the hole until the wall is half a metre behind him: where the first slice's straight line gave him that and no more
      const from = doorPt(d, d.def.width / 2, 0.6, inside, 0), ux = (p[0] - from[0]) / flat(p, from), uz = (p[2] - from[2]) / flat(p, from), r = T.char.radius;
      const free = (q: number[], s: number) => !g.col.nav.isBlocked(q[0] + ux * s, q[2] + uz * s) && !g.col.solidBlocked([q[0], 0.45, q[2]], [q[0] + ux * (s + r), 0.45, q[2] + uz * (s + r)]) && !g.col.solidBlocked([q[0], 1.0, q[2]], [q[0] + ux * (s + r), 1.0, q[2] + uz * (s + r)]) && !(g.props.raycast([q[0], 0.45, q[2]], [ux, 0, uz], s + r));
      for (let i = 0; i < 40 && free(p, 0.75); i++) p = [p[0] + ux * 0.25, 0, p[2] + uz * 0.25];
    }
    put(T, p); if (o.pair) put(T2, doorPt(d, d.def.width / 2 + 1.6, 3.4, inside, 0)); if (T3) put(T3, doorPt(d, d.def.width / 2 + 1.2, 2.2, inside, 0));
    if (o.dark) for (const t of g.targets) if (t.on && flat(t.pos, p) < 6) g.toggleTarget(t);
    step(40);
    const shell = () => blast(g, [hole[0], hole[1] - FRAG.lift, hole[2]], { who: PLAYER_ID, name: '40 mm grenade' });
    const toss = () => { const a = doorPt(d, d.def.width / 2, 1.2, side, 1.3), b = doorPt(d, d.def.width / 2, 0, side, 1.3), q = 4 / Math.max(1e-3, flat(a, b)); return g.items.spawn('mag', a, [(b[0] - a[0]) * q, 1.2, (b[2] - a[2]) * q], { who: PLAYER_ID, fill: 1 }); };
    /** a burst too small to hurt anybody, a stride inside the door (frag.ts blast with its radii drawn in): the hole for a man deep in the room */
    const mouth = doorPt(d, d.def.width / 2, 0.6, inside, 0) as V3, pop = () => blast(g, [mouth[0], 0.3, mouth[2]], { who: PLAYER_ID, name: 'frag grenade', lethalM: 0.05, woundM: 0.1, fx: false });
    return { W, g, d, T, T2, T3, men, p, hole, mouth, inside, step, shell, pop, toss };
  };
  type Rig = Awaited<ReturnType<typeof stage>>;
  const listen = (R: Rig, who: any[], secs: number, each?: (t: number) => void) => {
    const said: { who: any; text: string; radio: boolean; t: number }[] = [], last = new Map<any, any>(who.map(h => [h, h.bubble]));
    for (let i = 1; i <= Math.round(secs * 60); i++) { R.step(); for (const h of who) { const b = h.bubble; if (b && last.get(h) !== b) { last.set(h, b); said.push({ who: h, text: b.text, radio: !!b.radio, t: i * DT }); } } each?.(i * DT); }
    return said;
  };
  const words = (said: { text: string }[]) => said.map(s => `"${s.text}"`).join(' ') || 'nothing';
  /** every living defender's training, by squad: 'yard: S g g g' (the squad's own order) */
  const mixOf = (g: any) => { const by = new Map<any, any[]>(); for (const x of g.guards) { if (x.team !== 'hostile' || x.civ) continue; const Q = squadOf(g, x); if (Q && !by.has(Q.men)) by.set(Q.men, [Q.def.id, Q.men]); }
    return [...by.values()].map(([id, men]) => ({ id: id as string, t: (men as any[]).map(x => trainingOf(g, x) as string), lead: leaderOf(g, men[0]) })); };
  const spell = (mix: { id: string; t: string[] }[]) => mix.map(q => `${q.id}: ${q.t.map(t => t === 'steady' ? 'S' : 'g').join(' ')}`).join(' · ');

  try {
    // (A1) + the night staff's training, on the office
    { Math.random = seeded(61); MORALE.on = false; const W: any = await quiet(() => standUp()), g = W.game; MORALE.on = true; held(); train('difficulty'); MORALE.nerve = 'normal'; spoil();
      g.playerInvisible = true; g.godMode = true; const step = (n = 1) => { for (let i = 0; i < n; i++) W.step(DT); }; step(10);
      const staff = g.guards.filter((x: any) => !x.unit && x.team === 'guard'), T = staff[0];
      for (const x of staff) if (x !== T) { x.hold = true; x.pinned = true; }
      for (const t of g.targets) if (t.on && t.kind !== 'breaker') g.toggleTarget(t);
      step(90); const S = moraleOf(T), calm = { state: T.state, alone: !!S?.alone, dark: !!S?.dark, dread: dreadOf(T), rung: rungOf(T) };
      const st = T.state; T.state = 'suspicious'; const up = dreadOf(T); T.state = st;
      moraleShock(g, T, 0.05); const shocked = dreadOf(T);
      line(calm.state === 'patrol' && calm.alone && calm.dark && inTheDark(g, T) && calm.dread === 0 && calm.rung === 0 && Math.abs(up - (MORALE.alone + MORALE.dark)) < 1e-9 && Math.abs(shocked - (0.05 + MORALE.alone + MORALE.dark)) < 1e-9,
        '(A1) a calm man alone in the dark reads steady, dread 0 — off his calm round, or with a shock on him, where he stands counts',
        `${T.callsign} · ${calm.state}, alone ${calm.alone}, dark ${calm.dark}: dread ${f2(calm.dread)} rung ${calm.rung} · the same man suspicious: ${f2(up)} · calm again with a 0.05 shock: ${f2(shocked)}`);
      const by = staff.map((x: any) => `${x.callsign} ${trainingOf(g, x)}`), want: Record<string, string> = { Kowalski: 'steady', Novak: 'green', Reyes: 'steady', Okafor: 'steady', Lindqvist: 'green', Brandt: 'steady', Marsh: 'steady' };
      const N = staff.find((x: any) => trainingOf(g, x) === 'green'); let qrf = 'no green man', qrfOk = false; if (N) { N.trained = true; train('green'); qrf = `${N.callsign} trained under 'all green': ${trainingOf(g, N)}`; qrfOk = trainingOf(g, N) === 'steady' && staff.filter((x: any) => x !== N).every((x: any) => trainingOf(g, x) === 'green'); N.trained = false; train('difficulty'); }
      line(staff.length >= 3 && staff.every((x: any) => trainingOf(g, x) === want[x.callsign]) && staff.every((x: any) => leaderOf(g, x) === null) && !!N && qrfOk,
        '(T1) the night staff go by temperament — the nervy ones are green — with no leader; a trained man is steady whatever the knob says', `${by.join(' · ')} · ${qrf}`); }

    // (A2) the wall at his back
    { const run = async (fan: boolean) => { MORALE.fanStep = fan ? was.morale.fanStep : 0; const R = await stage(62, { training: 'none', dark: true, deep: true }), T = R.T, p0 = [...T.char.pos];
        MORALE.training = 'none'; R.pop(); R.step(1); const stagger = Math.max(0, T.staggerUntil - R.g.time); R.step(Math.round((stagger + 3.5) * 60));
        const moved = flat(T.char.pos, p0), gain = flat(T.char.pos, R.mouth) - flat(p0, R.mouth); MORALE.fanStep = was.morale.fanStep;
        return { moved, gain, face: facing(T, R.mouth), rung: rungOf(T), from: flat(p0, R.mouth), state: T.state, S: `alone ${moraleOf(T)?.alone} dark ${moraleOf(T)?.dark} shock ${f2(moraleOf(T)?.shock ?? NaN)}` }; };
      const A = await run(true), B = await run(false);
      line(A.rung === 2 && A.moved >= 1 && A.face < 0.5 && A.gain > 0 && B.rung === 2 && B.moved < 0.3,
        '(A2) the wall close behind him: the fan finds him a metre and more of scrabble, still facing the hole — straight back alone (the fan shut, fanStep 0) finds him nowhere to go',
        `${f2(A.from)} m from the hole, his back to the wall · with the fan: moved ${f2(A.moved)} m, ${f2(A.gain)} m further off, ${f2(A.face)} rad off the hole, rung ${A.rung} (${A.state}; ${A.S}) · fan shut: moved ${f2(B.moved)} m, rung ${B.rung}`); }

    // (T3) alone in the LIGHT: green breaks, steady ducks — and (T1) (T2) the mixes, read off the green man's floor before the shell
    { const R = await stage(63, { training: 'green' }), g = R.g, T = R.T, n0 = fired(T), p0 = [...T.char.pos], dark0 = inTheDark(g, T);
      // (T1) by difficulty
      setDifficulty('standard', false); train('difficulty'); const std = mixOf(g), lvStd = difficultyNow();
      setDifficulty('hard', false); const hard = mixOf(g), lvHard = difficultyNow();
      const sizes = std.map(q => q.t.length).sort().join(' ');
      line(sizes === '1 2 3 5' && lvStd === 'standard' && std.every(q => q.t[0] === 'steady' && q.t.slice(1).every(t => t === 'green') && q.lead),
        '(T1) standard, the compound\'s squads of five, three, two and one: every squad has one steady man, its first — its leader — and the rest are green; a squad of one is its own steady man', `${spell(std)} (${lvStd})`);
      line(sizes === '1 2 3 5' && lvHard === 'hard' && hard.every(q => q.t.filter(t => t === 'green').length === (q.t.length >= 3 ? 1 : 0) && (q.t.length < 3 || q.t[q.t.length - 1] === 'green')),
        '(T1) hard: every man steady but the last of a squad of three or more — none green in the squads of two and of one', `${spell(hard)} (${lvHard}) · squads under three: ${hard.filter(q => q.t.length < 3).length}`);
      // (T2) the knob over the difficulty, and the level's own key under it
      const per: string[] = []; let ok2 = true;
      for (const v of ['green', 'trained', 'mixed', 'none']) { train(v); const m = mixOf(g); per.push(`${v} → ${spell(m)}`);
        ok2 &&= m.every(q => v === 'green' ? q.t.every(t => t === 'green') : v === 'mixed' ? q.t[0] === 'steady' && q.t.slice(1).every(t => t === 'green') : q.t.every(t => t === 'steady')); }
      train('difficulty'); const Q0 = squadOf(g, g.guards.find((x: any) => squadOf(g, x)));
      Q0.def.training = 'green'; const own = mixOf(g).find(q => q.id === Q0.def.id)!; Q0.def.training = 'trained'; const own2 = mixOf(g).find(q => q.id === Q0.def.id)!; delete Q0.def.training;
      // …and with rows under the AI lever moved by hand (it stands on no rung) the mix is the one the press being on implies
      const sw0 = PRESSURE.second; PRESSURE.second = !PRESSURE.second; R.step(1); const tuned = mixOf(g); PRESSURE.second = sw0;
      ok2 &&= PRESSURE.on && tuned.every(q => q.t.filter(t => t === 'green').length === (q.t.length >= 3 ? 1 : 0));
      ok2 &&= own.t.every(t => t === 'green') && own2.t.every(t => t === 'steady');
      const roster: string = moraleRoster(g), rosterWant = 'men ▸ ' + mixOf(g).map(q => q.t.map(t => t === 'steady' ? 'S' : 'g').join(' ')).join(' · ');
      setDifficulty('standard', false);
      // …and the level's lint takes the key, and only its three words
      const raw = compoundRaw(), sq = raw.scenarios.roomClear.squads[0];
      sq.training = 'mixed'; const lintOk = validateLevelData(raw).length; sq.training = 'veteran'; const lintBad = validateLevelData(raw).filter((e: string) => /training/.test(e)).length;
      ok2 &&= lintOk === 0 && lintBad === 1;
      line(roster === rosterWant && roster.length <= 48, '(R) the debugger\'s roster row is one short line: steady and green, a squad at a time, as this check prints them', `'${roster}' (${roster.length} characters)`);
      line(ok2, '(T2) every training choice speaks over the difficulty (hard here), and a squad\'s own key in the level speaks under the knob', `${per.join(' | ')} | ${Q0.def.id} authored green → ${spell([own])}, trained → ${spell([own2])} · hard with a row hand-tuned → ${spell(tuned)} · the lint: 'mixed' ${lintOk} problems, 'veteran' ${lintBad}`);
      // (T3)
      train('green'); spoil(); R.step(20); const tr = trainingOf(g, T); R.shell(); const stagger = Math.max(0, T.staggerUntil - g.time); let clutch = 0;
      const said = listen(R, [T], stagger + 3.5, t => { if (t > stagger + 0.1) clutch = Math.max(clutch, T.char.anim.clutch ?? 0); }), call = said.find(s => s.radio && moraleLines('call').includes(s.text));
      const green = { tr, rung: rungOf(T), back: flat(T.char.pos, R.hole) - flat(p0, R.hole), rounds: fired(T) - n0, clutch, act: moraleOf(T)?.act, alone: !!moraleOf(T)?.alone };
      const R2 = await stage(63, { training: 'trained' }), T2 = R2.T, m0 = fired(T2), q0 = [...T2.char.pos], dark2 = inTheDark(R2.g, T2); const tr2 = trainingOf(R2.g, T2); R2.shell(); const stag2 = Math.max(0, T2.staggerUntil - R2.g.time); R2.step(60); const r1 = rungOf(T2), a1 = moraleOf(T2)?.act, mv1 = flat(T2.char.pos, q0), low1 = T2.char.anim.crouch;
      let upAt2 = NaN; for (let i = 61; i <= 360; i++) { R2.step(); if (Number.isNaN(upAt2) && moraleOf(T2)?.act !== 'duck') upAt2 = i * DT; } const duck2 = upAt2 - stag2;
      line(!dark0 && green.tr === 'green' && green.alone && green.rung === 2 && green.back >= 1 && green.rounds >= 3 && !!call && !/can't see/.test(call.text) && green.clutch > 0.5,
        '(T3) a GREEN man alone with the lamps burning, the 40 mm on his door: broken — folded, the call nobody answers (and not the one that says he cannot see), a metre and more back, rounds into the dust',
        `${T.callsign} ${green.tr} · dark ${dark0} alone ${green.alone} · rung ${green.rung} ${green.act} · ${f2(green.back)} m further off · ${green.rounds} rounds · folded after the stagger ${f2(green.clutch)} · ${call ? `"${call.text}" (radio)` : `no call: ${words(said)}`}`);
      line(!dark2 && tr2 === 'steady' && r1 === 1 && a1 === 'duck' && rungOf(T2) < 2 && fired(T2) === m0 && mv1 < 0.3 && low1 > 0.7 && Math.abs(duck2 - MORALE.steadyDuck) <= 0.1 && MORALE.steadyDuck < MORALE.duckSecs - 1,
        '(T3) a STEADY man in the same lit hut: jumpy — he ducks, for a second past his stagger and not a green man\'s two and a half — and is not broken', `duck over ${f2(duck2)} s after the stagger (a green man's: ${MORALE.duckSecs}) · ${T2.callsign} ${tr2} · dark ${dark2} · rung ${r1} ${a1} → ${rungOf(T2)} · at 1 s: moved ${f2(mv1)} m, crouch ${f2(low1)} · rounds ${fired(T2) - m0}`); }

    // (T4) the steady man broken: alone in the dark
    { const R = await stage(64, { training: 'trained', dark: true }), g = R.g, T = R.T, n0 = fired(T), p0 = [...T.char.pos], tr = trainingOf(g, T);
      R.shell(); const stagger = Math.max(0, T.staggerUntil - g.time); let clutch = 0, low = 0, n = 0;
      const said = listen(R, [T], stagger + 3.5, t => { if (t > stagger + 0.1) clutch = Math.max(clutch, T.char.anim.clutch ?? 0); if (t > stagger + 1) { n++; if (T.char.anim.crouch > 0.7) low++; } });
      const call = said.find(s => moraleLines('clear').includes(s.text)), panic = said.filter(s => [...moraleLines('call'), ...moraleLines('again'), ...moraleLines('out')].includes(s.text));
      const back = flat(T.char.pos, R.hole) - flat(p0, R.hole), dust = fired(T) - n0, rung = rungOf(T), act0 = (R.step(150), moraleOf(T)?.act);
      line(tr === 'steady' && rung === 2 && clutch < 0.5 && low >= n - 30 && back >= 1 && facing(T, R.hole) < 0.5 && !!call && call.radio && !panic.length && dust === 0 && fired(T) === n0 && act0 === 'hold',
        '(T4) a STEADY man alone in the dark: broken, and copes trained — down, never folded; a metre and more back facing the hole; the flat call on the net; not a round into the dust; then the hold',
        `${T.callsign} ${tr} · rung ${rung} → ${act0} · folded after the stagger ${f2(clutch)} · low ${low} of ${n} frames · ${f2(back)} m further off, ${f2(facing(T, R.hole))} rad off the hole · ${call ? `"${call.text}"${call.radio ? ' (radio)' : ' (SPOKEN)'}` : `no flat call: ${words(said)}`} · rounds ${fired(T) - n0}`);
      const mag0 = T.weapon.roundsReady; let changed = 0, least = mag0; const each = () => { if (T.reloadT >= 0) changed++; least = Math.min(least, T.weapon.roundsReady); };
      const a = fired(T); R.toss(); const s1 = listen(R, [T], 3, each); const b1 = fired(T) - a; const b = fired(T); R.toss(); const s2 = listen(R, [T], 3, each); const b2 = fired(T) - b; const c3 = fired(T); R.toss(); const s3 = listen(R, [T], 3, each); const b3 = fired(T) - c3;
      const out = [...s1, ...s2, ...s3].filter(s => [...moraleLines('out'), ...moraleLines('spent')].includes(s.text));
      line(b1 === MORALE.baitShort && b2 === MORALE.baitShort && b3 === 0 && least > 0 && changed === 0 && !out.length && moraleOf(T)?.act === 'hold' && T.state !== 'dead',
        '(T4) the bait on a steady man: a thing through the hole draws the short burst, a second the same, a third nothing — never the magazine: never dry, no change, no shout that he is out',
        `${mag0} in the gun · first throw ${b1}, second ${b2} (of ${MORALE.baitShort}), third ${b3} · least in the gun ${least} · frames changing ${changed} · out / spent lines ${out.length} · act ${moraleOf(T)?.act}`);
      // (S) the debugger's switch put off in the hold (ui/bindings.ts: MORALE.on = false; moraleReset(game, true)) and on again
      const sum0: string = moraleSummary(g); MORALE.on = false; moraleReset(g, true); const met = g.guards.filter((x: any) => moraleOf(x)).length; R.step(30); MORALE.on = true; R.step(30); const S2 = moraleOf(T), sum1: string = moraleSummary(g);
      line(/BROKEN/.test(sum0) && met === 0 && !!S2 && S2.act === 'none' && S2.shock === 0 && S2.rung < 2 && S2.baits === 0 && !moraleOwns(T) && !/BROKEN/.test(sum1),
        '(S) the switch put off in the middle of his hold and on again: every man\'s state went with it — he starts clean, nobody reads broken',
        `before: '${sum0}' · men met with it off ${met} · back on: act ${S2?.act}, shock ${f2(S2?.shock ?? NaN)}, rung ${S2?.rung} · '${sum1}'`); }

    // (T5) the leader and his green man on one blast, and (T10) a checkpoint in it
    { const R = await stage(65, { training: 'mixed', pair: true }), g = R.g, L = R.T, G = R.T2, roles = `${L.callsign} ${trainingOf(g, L)}${leaderOf(g, G) === L ? ' (his leader)' : ''} · ${G.callsign} ${trainingOf(g, G)}`, apart = flat(L.char.pos, G.char.pos);
      const l0 = [...L.char.pos]; R.shell(); const stagL = Math.max(0, L.staggerUntil - g.time);
      let stepL = 0, crouchL = 0, upAt = NaN, lowBefore = 0, nBefore = 0, orderAt = NaN, faceAtOrder = NaN, stoodAt = NaN, snap: any = null, saved: any = null;
      const said = listen(R, [L, G], stagL + 4.5, t => { crouchL = Math.max(crouchL, L.char.anim.crouch);
        if (moraleOf(L)?.act === 'stand') stepL = flat(L.char.pos, l0);
        if (Number.isNaN(orderAt) && L.bubble && moraleLines('order').includes(L.bubble.text)) { orderAt = t; faceAtOrder = facing(L, R.hole); }
        if (Number.isNaN(orderAt) && t > 0.6) { nBefore++; if (G.char.anim.crouch > 0.7) lowBefore++; }
        if (Number.isNaN(stoodAt) && moraleOf(L)?.act === 'stand') { stoodAt = t; }
        if (!snap && moraleOf(L)?.act === 'stand' && moraleOf(G)?.by === L && t > 0.2) { snap = copy(moraleSnapshot(g)); const SL = moraleOf(L), SG = moraleOf(G); saved = { actL: SL.act, actG: SG.act, tL: SL.t, by: g.guards.indexOf(SG.by), green: SG.green }; }
        if (Number.isNaN(upAt) && !Number.isNaN(orderAt) && moraleOf(G)?.act !== 'duck') upAt = t; });
      const order = said.find(s => moraleLines('order').includes(s.text)), okay = said.find(s => moraleLines('okay').includes(s.text)), duckShout = said.filter(s => s.who === G && moraleLines('duck').includes(s.text));
      line(trainingOf(g, L) === 'steady' && trainingOf(g, G) === 'green' && leaderOf(g, G) === L && apart <= MORALE.orderM && stoodAt <= 0.1 && crouchL < 0.5 && !!order && order.who === L && !order.radio && faceAtOrder < 0.5 && stepL < 1 && order.t >= stagL + MORALE.orderBeat - 0.1 && order.t <= stagL + MORALE.orderBeat + 0.2,
        '(T5) a leader and a green man of his, two metres apart, one blast: the leader never crouches — he stands, his gun on the hole, and after his stagger gives the order, spoken',
        `${roles} · ${f2(apart)} m apart · leader's stand from ${f2(stoodAt)} s, most crouched ${f2(crouchL)}, stagger ${f2(stagL)} s, side step ${f2(stepL)} m · ${order ? `"${order.text}"${order.radio ? ' (RADIO)' : ''} at ${f2(order.t)} s, ${f2(faceAtOrder)} rad off the hole` : `no order: ${words(said)}`}`);
      line(!!order && lowBefore >= nBefore - 6 && nBefore > 20 && Math.abs(upAt - (orderAt + MORALE.orderSecs)) <= 0.15 && MORALE.orderBeat + MORALE.orderSecs < MORALE.duckSecs - 0.5 && !!okay && okay.who === G && !okay.radio && Math.abs(okay.t - upAt) <= 0.1 && duckShout.length === 1 && !duckShout[0].radio && duckShout[0].t < orderAt - 0.5 && L.state !== 'dead' && G.state !== 'dead',
        '(T5) the green man shouts his duck as he goes down, spoken — its own tell — is on the floor until a second after the order, well short of his duck\'s whole time, and answers as he gets up',
        `${duckShout.length ? `"${duckShout[0].text}"${duckShout[0].radio ? ' (RADIO)' : ''} at ${f2(duckShout[0].t)} s` : 'NO DUCK LINE'} · down ${lowBefore} of the ${nBefore} frames before the order · order at ${f2(orderAt)} s, up at ${f2(upAt)} s (${f2(upAt - orderAt)} s after; the whole duck would be ${f2(MORALE.duckSecs)} s past his stagger) · ${okay ? `"${okay.text}" at ${f2(okay.t)} s` : `no answer: ${words(said)}`}`);
      // (T10)
      let same = false, detail = 'no checkpoint taken (the leader never stood)';
      if (snap && saved) { const R3 = await stage(65, { training: 'mixed', pair: true }), g = R3.g, L2 = R3.T, G2 = R3.T2; moraleRestore(g, snap); const SL = moraleOf(L2), SG = moraleOf(G2), R = R3;
        const loaded = `${SL?.act} / ${SG?.act}, waiting on ${SG?.by?.callsign ?? 'nobody'}`;
        same = !!SL && !!SG && SL.act === saved.actL && SG.act === saved.actG && Math.abs(SL.t - saved.tL) < 1e-9 && SG.by === L2 && SG.green === saved.green;
        let o2 = false, k2 = false; const last = new Map<any, any>([[L2, L2.bubble], [G2, G2.bubble]]);
        for (let i = 0; i < 420; i++) { R.step(); for (const h of [L2, G2]) { const b = h.bubble; if (b && last.get(h) !== b) { last.set(h, b); if (h === L2 && moraleLines('order').includes(b.text)) o2 = true; if (h === G2 && moraleLines('okay').includes(b.text)) k2 = true; } } }
        same &&= o2 && k2; detail = `saved ${saved.actL} / ${saved.actG} waiting on roster man ${saved.by} · loaded ${loaded} · after the load: order ${o2}, answer ${k2}`; }
      line(same, '(T10) the slice\'s checkpoint record taken in the leader\'s stand, laid on a fresh staging of the same floor: both men are in it — and the order and the answer are still given', detail); }

    // (T6) the leader killed in his green men's view, and (F2) the blast after it
    { const R = await stage(66, { training: 'mixed', pair: true, trio: true }), g = R.g, L = R.T, G = R.T2, H = R.T3; R.step(30);
      const look = (x: any) => Math.atan2(L.char.pos[0] - x.char.pos[0], L.char.pos[2] - x.char.pos[2]);
      for (let i = 0; i < 20; i++) { G.char.bodyYaw = look(G); H.char.bodyYaw = look(H); R.step(); G.char.bodyYaw = look(G); H.char.bodyYaw = look(H); }
      const near = flat(G.char.pos, L.char.pos) <= flat(H.char.pos, L.char.pos) ? G : H, far = near === G ? H : G;
      const his = g.guards.filter((x: any) => x !== L && x !== G && x !== H && x.state !== 'dead' && trainingOf(g, x) === 'green' && leaderOf(g, x) === L);
      const blind = his.filter((x: any) => g.col.segmentBlocked(x.char.bones.head ?? [x.char.pos[0], 1.6, x.char.pos[2]], L.char.bones.chest ?? [L.char.pos[0], 1.2, L.char.pos[2]]));
      const others = g.guards.filter((x: any) => x.team === 'hostile' && x.state !== 'dead' && x !== L && leaderOf(g, x) !== L);
      const before = { down: !!moraleOf(near)?.leaderDown, fall: sawLeaderFall(near), shock: moraleOf(near)?.shock ?? 0 };
      // the switch off: the seam does nothing
      MORALE.on = false; const f0 = MORALE_STATS.falls, b0 = [near.bubble, far.bubble]; moraleManDown(g, L); const offOk = MORALE_STATS.falls === f0 && !moraleOf(near)?.leaderDown && moraleOf(near)?.act === 'none' && near.bubble === b0[0] && far.bubble === b0[1] && sawLeaderFall(near) === Infinity; MORALE.on = true;
      const last = new Map<any, any>([[near, near.bubble], [far, far.bubble]]);
      killGuard(g, L, [0, 0, 1], false, 'shot', 'world');
      const S = moraleOf(near), at0 = { down: !!S?.leaderDown, fall: sawLeaderFall(near), shock: S?.shock ?? 0, dread: dreadOf(near), want: (S?.shock ?? 0) + MORALE.leaderDown + (S?.alone ? MORALE.alone : 0) + (S?.dark ? MORALE.dark : 0), act: S?.act, lost: !!S?.lost };
      const farAt0 = { act: moraleOf(far)?.act, lost: !!moraleOf(far)?.lost, fall: sawLeaderFall(far) };
      const said0 = [near, far].filter(x => x.bubble && x.bubble !== last.get(x) && moraleLines('lost').includes(x.bubble.text)).map(x => ({ who: x, text: x.bubble.text as string, radio: !!x.bubble.radio }));
      const blindNow = blind.map((x: any) => ({ who: x.callsign, down: !!moraleOf(x)?.leaderDown, fall: sawLeaderFall(x), shock: moraleOf(x)?.shock ?? 0, act: moraleOf(x)?.act }));
      let low = 0, upAt = NaN; const said = listen(R, [near, far], 1.5, t => { low = Math.max(low, near.char.anim.crouch); if (Number.isNaN(upAt) && moraleOf(near)?.act !== 'flinch') upAt = t; });
      const lostLines = said0.length + said.filter(x => moraleLines('lost').includes(x.text)).length, fall1 = sawLeaderFall(near), still = !!moraleOf(near)?.leaderDown, otherDown = others.filter((x: any) => moraleOf(x)?.leaderDown).length;
      line(L.state === 'dead' && MORALE.leaderShock > 0 && MORALE.leaderDown > 0 && !before.down && before.fall === Infinity && at0.down && at0.fall === 0 && Math.abs(at0.shock - before.shock - MORALE.leaderShock) < 1e-9 && Math.abs(at0.dread - at0.want) < 1e-9 && Math.abs(fall1 - 1.5) < 0.03 && still && otherDown === 0,
        '(T6) his leader shot in his view: the standing term from then on, the shock of seeing it, and sawLeaderFall counting from that frame — nobody of another squad carries it',
        `${near.callsign} (${trainingOf(g, near)}) and ${far.callsign} watching ${L.callsign} · before: leaderDown ${before.down}, shock ${f2(before.shock)}, saw ${before.fall} · on the frame: leaderDown ${at0.down}, shock ${f2(at0.shock)}, dread ${f2(at0.dread)}, saw ${f2(at0.fall)} s ago · 1.5 s on: ${f2(fall1)} s · men of other squads with the term ${otherDown} of ${others.length}`);
      line(said0.length === 1 && said0[0].who === near && !said0[0].radio && lostLines === 1 && at0.lost && !farAt0.lost && at0.act === 'flinch' && farAt0.act === 'flinch' && farAt0.fall === 0 && low > 0.7 && Math.abs(upAt - MORALE.flinchSecs) <= 0.1,
        '(T6) it SHOWS: the nearest man who saw it says so on that frame, spoken — one line for the squad — and both men who saw it flinch: down for the beat, then up',
        `${said0.length ? `${said0[0].who.callsign}: "${said0[0].text}"${said0[0].radio ? ' (RADIO)' : ''} on the frame` : 'NOTHING SAID on the frame'} · lines of that kind in 1.5 s: ${lostLines} · acts on the frame ${at0.act} / ${farAt0.act} · most crouched ${f2(low)} · up at ${f2(upAt)} s (flinch ${MORALE.flinchSecs} s)`);
      line(blindNow.length >= 1 && blindNow.every((b: any) => b.down && b.fall === Infinity && b.shock === 0 && b.act === 'none') && offOk,
        '(T6) a green man of his with a wall between them: the standing term, and neither the shock, the sight nor the flinch — and with the switch off the seam does nothing at all', `${blindNow.map((b: any) => `${b.who}: leaderDown ${b.down}, shock ${f2(b.shock)}, saw ${b.fall}, ${b.act}`).join(' · ') || `no green man of his behind a wall (${his.length} others of his)`} · switch off: nothing ${offOk}`);
      // (F2) one blast on the two of them, together
      const n0 = [fired(near), fired(far)], together = !moraleOf(near)?.alone && !moraleOf(far)?.alone; R.shell(); const stag = Math.max(0, near.staggerUntil - g.time, far.staggerUntil - g.time);
      R.step(Math.round((stag + 0.4) * 60)); const acts = [moraleOf(near)?.act, moraleOf(far)?.act], rungs = [rungOf(near), rungOf(far)];
      const more = listen(R, [near, far], 3), lost2 = more.filter(x => moraleLines('lost').includes(x.text)).length, dust = [fired(near) - n0[0], fired(far) - n0[1]];
      line(near.state !== 'dead' && far.state !== 'dead' && together && rungs[0] === 2 && acts[0] === 'down' && rungs[1] === 1 && acts[1] === 'duck' && dust[1] === 0 && lost2 === 0,
        '(F2) then one blast on the two green men standing together: it breaks ONE of them — the man who said it — and the other ducks and stays in the fight',
        `together ${together} · ${near.callsign}: rung ${rungs[0]} ${acts[0]}, ${dust[0]} rounds into the dust · ${far.callsign}: rung ${rungs[1]} ${acts[1]}, ${dust[1]} rounds · 'lost' lines after the blast ${lost2}`); }

    // (F3) no break is for ever
    { const R = await stage(68, { training: 'green', dark: true, nerve: 'brittle' }), g = R.g, T = R.T; MORALE.halfLife = 1e6;   // (his shock held up: only the cap can let him go)
      const s0 = moraleOf(T)?.shock ?? 0; R.shell(); R.step(2); const fedBy = (moraleOf(T)?.shock ?? 0) - s0, stagger = Math.max(0, T.staggerUntil - g.time);
      let holdAt = NaN, freeAt = NaN, again = 0; const N = Math.round((stagger + MORALE.holdMax + 8) * 60);
      for (let i = 1; i <= N; i++) { R.step(); const a = moraleOf(T)?.act, t = i * DT - stagger; if (Number.isNaN(holdAt) && a === 'hold') holdAt = t; if (!Number.isNaN(holdAt) && Number.isNaN(freeAt) && a === 'none') freeAt = t; else if (!Number.isNaN(freeAt) && (a !== 'none' || moraleOwns(T))) again++; }
      const rungHeld = rungOf(T), alone = !!moraleOf(T)?.alone, dark = !!moraleOf(T)?.dark;
      MORALE.halfLife = was.morale.halfLife; R.step(Math.round(MORALE.halfLife * 4 * 60)); const rungLate = rungOf(T), shockLate = moraleOf(T)?.shock ?? NaN, stand = (moraleOf(T)?.alone ? MORALE.alone : 0) + (moraleOf(T)?.dark ? MORALE.dark : 0);
      line(holdAt < 6 && Math.abs(freeAt - MORALE.holdMax) <= 1.5 && again === 0 && rungLate < 2 && shockLate <= MORALE.holdShock && Math.abs(fedBy - MORALE.blast * MORALE.nerveK.brittle) < 0.01,
        '(F3) a green man broken alone in the dark is let go `holdMax` seconds in, shock or no shock, and is not taken up again — and with his shock run down he is no longer broken, alone in the dark as he still is',
        `${T.callsign} · in the hold from ${f2(holdAt)} s · let go at ${f2(freeAt)} s (holdMax ${MORALE.holdMax}), frames owned after ${again} · rung then ${rungHeld} (shock held up; alone ${alone}, dark ${dark}) · ${MORALE.halfLife * 4} s on: shock ${f2(shockLate)}, standing ${f2(stand)}, rung ${rungLate} · the blast on brittle nerve: ${fedBy.toFixed(3)} (${MORALE.blast} × 1.4)`); }

    // (F6) no squads staged: the men of a room are a band
    { const R = await stage(69, { training: 'difficulty', squads: false }), g = R.g; setDifficulty('standard', false); R.step(1);
      const rooms: { def: any; defenders: any[] }[] = g.roomClear.rooms.filter((r: any) => r.defenders.length), noSquads = g.guards.every((x: any) => !squadOf(g, x));
      const read = rooms.map(r => ({ id: r.def.id as string, t: r.defenders.map(x => trainingOf(g, x) as string), led: r.defenders.every(x => leaderOf(g, x) === r.defenders[0]) }));
      const okMix = read.every(q => q.t[0] === 'steady' && q.t.slice(1).every(t => t === 'green') && q.led), steady = read.reduce((n, q) => n + q.t.filter(t => t === 'steady').length, 0), menN = read.reduce((n, q) => n + q.t.length, 0);
      const big = rooms.find(r => r.defenders.length >= 3) ?? rooms.find(r => r.defenders.length >= 2)!, L = big.defenders[0]; killGuard(g, L, [0, 0, 1], false, 'shot', 'world');
      const down = g.guards.filter((x: any) => x !== L && x.state !== 'dead' && moraleOf(x)?.leaderDown), mine = big.defenders.slice(1);
      line(noSquads && rooms.length >= 3 && okMix && steady === rooms.length && menN > rooms.length && down.length === mine.length && mine.length >= 1 && mine.every(x => down.includes(x)),
        '(F6) with no squads staged the men of a ROOM are a band: one steady man a room (a lone keeper is his own), the rest green — and a leader\'s death is on his room\'s men and nobody else\'s',
        `squads staged: ${!noSquads} · ${spell(read)} · ${steady} steady of ${menN} · ${L.callsign} of ${big.def.id} killed: leaderDown on ${down.map((x: any) => x.callsign).join(', ') || 'nobody'} (his room's: ${mine.map((x: any) => x.callsign).join(', ')})`); }

    // (T5) with every man trained, and (T7) nerve
    { const R = await stage(67, { training: 'trained', pair: true }), g = R.g, T = R.T, G = R.T2;
      R.shell(); const stagL = Math.max(0, T.staggerUntil - g.time), stagG = Math.max(0, G.staggerUntil - g.time); let crouchL = 0, stood = false, upG = NaN;
      listen(R, [T, G], Math.max(stagL, stagG) + 3, t => { crouchL = Math.max(crouchL, T.char.anim.crouch); if (moraleOf(T)?.act === 'stand') stood = true; if (Number.isNaN(upG) && t > 0.5 && moraleOf(G)?.act !== 'duck') upG = t; });
      line(trainingOf(g, T) === 'steady' && trainingOf(g, G) === 'steady' && leaderOf(g, G) === T && stood && crouchL < 0.5 && upG - stagG <= MORALE.steadyDuck + 0.1 && upG - stagG < MORALE.orderBeat + MORALE.orderSecs,
        '(T5) every man trained: the leader still stands — a leader never ducks, whatever the mix — and the steady man beside him is up before a green man under orders would be',
        `${T.callsign} (leader) stood ${stood}, most crouched ${f2(crouchL)} · ${G.callsign} (${trainingOf(g, G)}) up ${f2(upG - stagG)} s after his stagger (a green man on the order: ${f2(MORALE.orderBeat + MORALE.orderSecs)} s)`);
      const got: number[] = []; for (const nv of ['brittle', 'normal', 'steady']) { MORALE.nerve = nv; const s0 = moraleOf(T)?.shock ?? 0; moraleShock(g, T, 0.02); got.push((moraleOf(T)?.shock ?? 0) - s0); }
      const lit = MORALE.blast * MORALE.nerveK.steady + MORALE.alone, litN = MORALE.blast + MORALE.alone;
      line(Math.abs(got[0] - 0.028) < 1e-9 && Math.abs(got[1] - 0.02) < 1e-9 && Math.abs(got[2] - 0.014) < 1e-9 && (BREAK || (lit < MORALE.greenBroken && litN >= MORALE.greenBroken)),
        '(T7) nerve scales every shock: 0.02 lands as 0.028 brittle, 0.020 normal, 0.014 steady (a blast: F3) — and ON PURPOSE steady nerve keeps a lone green man in a lit room under his line to one blast, where normal nerve breaks him',
        `moraleShock(0.02): ${got.map(x => x.toFixed(3)).join(' / ')} · a lone lit green man to one near blast: ${f2(litN)} on normal nerve, ${lit.toFixed(3)} on steady (his line ${MORALE.greenBroken})`);
      // (T8) on the same floor: nothing the fight reads moves
      const tables = () => { const Rg: Record<string, object> = knobRegistry(), o: Record<string, unknown> = {}; for (const k of Object.keys(Rg)) if (Rg[k] !== MORALE) o[k] = copy(Rg[k]); o.FIGHT_SKILL = copy(FIGHT_SKILL); o.tune = copy(g.tune);
        o.men = g.guards.map((x: any) => [x.trained, x.carbine, x.weapon.def.name, x.reactT, x.char.health ?? null, x.health ?? null, x.hp ?? null, x.skill ?? null]); return JSON.stringify(o); };
      const t0 = tables(); let read = 0;
      for (const tr of [...TRAININGS, 'none']) for (const nv of NERVES) { MORALE.training = tr; MORALE.nerve = nv; for (const x of g.guards) { trainingOf(g, x); leaderOf(g, x); read++; } moraleRoster(g); moraleTick(g, 0); }
      const t1 = tables(), names = Object.keys(knobRegistry());
      const src = readFileSync(resolve(ROOT, 'src/game/morale.ts'), 'utf8'), code = src.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*\*)/.test(l)).join('\n');
      const named = ['AIM', 'TRAINED', 'FIGHT_SKILL', 'AI_TUNE', 'squadSkill', 'DRILL_AT', 'reactCap', 'settleK'].filter(n => new RegExp(`\\b${n}\\b`).test(code)), writes = code.match(/\.(health|hp|skill|trained|nerve|aimSkill|reactBase)\s*[-+*/]?=[^=]/g) ?? [];
      const ownWrites = writes.filter(x => !/^\.nerve\s*=/.test(x));   // (MORALE.nerve is this file's own choice — moraleFromQuery — and no man's number)
      line(t0 === t1 && names.includes('AIM') && names.includes('TRAINED') && !named.length && !ownWrites.length,
        '(T8) every training × nerve choice read for every man and ticked: every registered knob table but MORALE, FIGHT_SKILL, the tune and each man\'s own kit and beat are deep-equal — and morale.ts names no aim / skill table and assigns no man\'s health, skill or trained flag',
        `${names.length - 1} tables + FIGHT_SKILL + tune + ${g.guards.length} men, ${t0.length} characters, equal ${t0 === t1} · ${read} readings · names in morale.ts: ${named.join(', ') || 'none'} · assignments: ${ownWrites.join(' ') || 'none'}`);
      // …and the journal carries the two choices as it carries a number
      MORALE.training = 'green'; MORALE.nerve = 'brittle'; const K = knobsSnapshot(g); MORALE.training = 'difficulty'; MORALE.nerve = 'normal'; applyKnobs(g, K); const carried = `${MORALE.training} / ${MORALE.nerve}`;
      const old = copy(K); for (const k of ['training', 'nerve', 'fanStep', 'fanDeg', 'straightM']) delete old.tables.MORALE[k]; MORALE.training = 'green'; MORALE.nerve = 'brittle'; const onWas = MORALE.on, fanWas = MORALE.fanStep; applyKnobs(g, old); const before = `${MORALE.training} / ${MORALE.nerve} / fan ${MORALE.fanStep}`, noLead = g.guards.every((x: any) => leaderOf(g, x) === null); MORALE.on = onWas; MORALE.fanStep = fanWas;
      line(carried === 'green / brittle' && before === 'none / normal / fan 0' && noLead, '(T8) a recording carries both choices (string rows), and one from before them replays as the first slice: no training, nobody a leader, normal nerve, the fan shut', `carried: ${carried} · a file without the keys: ${before}, leaders ${noLead ? 'none' : 'SOME'}`);
      // (V) the visit
      const G0: any = globalThis, had = G0.sessionStorage, Q = (q: string) => { moraleFromQuery(new URLSearchParams(q)); return `${MORALE.on ? 'on' : 'off'} ${MORALE.training} ${MORALE.nerve}`; };
      delete G0.sessionStorage; MORALE.on = false; MORALE.training = 'green'; MORALE.nerve = 'brittle'; moraleKeep('training'); const bare = Q(''), flags = Q('nomorale&training=mixed&nerve=brittle'), junk = Q('training=none&nerve=iron');
      const store = new Map<string, string>(); G0.sessionStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } };
      MORALE.on = true; MORALE.training = 'green'; MORALE.nerve = 'brittle'; moraleKeep('training'); const keptOne = Q(''), over = Q('training=trained'); MORALE.on = false; moraleKeep('on'); const keptOff = Q('');
      if (had === undefined) delete G0.sessionStorage; else G0.sessionStorage = had; MORALE.on = onWas;
      line(bare === 'on difficulty normal' && flags === 'off mixed brittle' && junk === 'on difficulty normal' && keptOne === 'on green normal' && over === 'on trained normal' && keptOff === 'off green normal',
        '(V) the visit: with no store the page opens on its own (on, by difficulty, normal); the address speaks, and over what is kept; ONLY the row touched is kept — a nerve the address or a recording set is not made the visit\'s',
        `no store: '${bare}' · ?nomorale&training=mixed&nerve=brittle: '${flags}' · bad words: '${junk}' · training touched (nerve brittle at the time): '${keptOne}' · ?training=trained over it: '${over}' · the switch touched off: '${keptOff}'`); }

    // (T9) the words
    { const kinds = ['clear', 'lost', 'order', 'okay'], lines: string[] = kinds.flatMap(k => moraleLines(k)), every: string[] = moraleLines();
      const long = lines.filter(t => t.length > D.AIM_CHARS), blocked = lines.filter(t => D.blockedPhrase(t)), compass = lines.filter(t => /\b(north|south|east|west)/i.test(t)), twice = every.filter((t, i) => every.indexOf(t) !== i), tight = lines.filter(t => /\S—\s|\s—\S/.test(t));
      line(kinds.every(k => moraleLines(k).length >= 3) && !long.length && !blocked.length && !compass.length && !twice.length && !tight.length,
        `(T9) the new lines fit a bubble (≤ ${D.AIM_CHARS}), none on the originality blocklist, no compass word, none twice in the file`, `${lines.length} lines · too long: ${long.join(' | ') || 'none'} · blocked: ${blocked.join(' | ') || 'none'} · twice: ${twice.join(' | ') || 'none'}`); }
  } catch (e) { all = false; console.log(`- FAIL — the check threw\n    ${e instanceof Error ? e.stack : String(e)}`); }
  finally { RUNNER.on = later.runner; DARKDOOR.on = later.door; NQ_.on = nq0_; Object.assign(MORALE, was.morale); Object.assign(MORALE_AT, atWas); Object.assign(FRAG, was.frag); Object.assign(PRESSURE, was.P); Object.assign(DIGIN, was.Dg); FOG.cone = was.cone; DOORBLAST.on = was.door; DESTRUCTION.on = was.sw; SQUADS.on = was.squads; Math.random = was.rnd; }
  console.log(`=== training: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}

if (import.meta.main) process.exit((await trainingCheck()) ? 0 : 1);
