// sweep-check.ts — GO AND LOOK (hard's row `HARD.sweep`, difficulty.ts → `PRESSURE.sweep`): pressure.ts goLook on a level with no enemy squads,
// enemysquads.ts lookOut (`SQUADS.drillLook`) on one with them. The verdict.
//
//   bun run tools/qa/sweep-check.ts [--trace] [--only room|squads]          (the frozen stand)
//   TPS_PROFILE=shipped bun run tools/qa/sweep-check.ts                     (the page's stand — it holds on both)
//
// THE SWITCH IS THE CHECK'S OWN, so that it asks the same thing on both stands: the frozen stand holds HARD.sweep off (TPS_SWEEP=1 raises it), the page
// raises it. Each arm writes HARD.sweep itself — before the difficulty is set, and again once the game stands (standUp puts the stand's own word over it)
// — and puts it back after.
// One staging per level, played three times (hard with the row on · hard with the row off · standard with the row on), same seed: the scenario is
// started as its row starts it, the team is never given an order and stands where the mission put it, ONE loud report is filed where Sam stands (the
// word: a loud thing in a man's ears), and then nothing — the game is stepped with Sam unlit and nobody of the team moving. Lines:
//   room-clear-four (no squads, goLook)
//     hard            a look is called on the net, never before the word is `sweepSecs` old; `sweepMen` are let go `sweepBeat` after the call; both leave
//                     where they stood and close on the report. (WHEN it comes: on hard that report is stood to — PRESSURE.warned — and no look is
//                     called while a report stands, so it is `reportSecs + standSecs` after the report here, not `sweepSecs`. The line does not pin that.)
//     hard, row off   no look called, no man let go
//     standard        the same nothing
//   mousehole-four (squads, all `mayLeave: false` — `sweepStayers` lets one send its look; lookOut)
//     hard            one squad says so once on its net, not before the word is `sweepSecs` old, files one 'sweep' event `SQUADS.sweepBeat` after the
//                     line, and two of its men are let go then and leave where they stood
//     hard, row off   no line, no 'sweep' event, no man let go, no squad with men out
//     standard        the same nothing
// The team stands where the report was, so a look that gets there finds it: what happens to the pair after it is let go is printed, not judged.
// SWEEP_BREAK=1 = the 'hard' arm played with HARD.sweep left off: the hard lines must FAIL (exit 1).
// FLANKCALL_BREAK=1 = the dialogue pass taken off under each arm: where the stand has it on (shipped, or TPS_WORDS=1) the flanker's-call line must FAIL.
// Exit 0 = all pass, 1 = a FAIL or an error. About a minute. Headless only: what a look reads like on the page (the line on the net, two men walking a
// corridor) has never been seen on a GPU by this check.
export { };
const { standUp, ROOT } = await import('./headless.ts');
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const { scenarioQuery } = await import(`${ROOT}/src/scene/scenarios.ts`);
const { HARD, setDifficulty, difficultyNow } = await import(`${ROOT}/src/game/difficulty.ts`);
const { PRESSURE, pressureStats } = await import(`${ROOT}/src/game/pressure.ts`);
const { DIGIN } = await import(`${ROOT}/src/game/digin.ts`);
const { WORDS } = await import(`${ROOT}/src/game/words.ts`);
const { SQUADS, squadsReport, squadsLive, squadDrill, squadMen } = await import(`${ROOT}/src/game/enemysquads.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { PLAYER_ID } = await import(`${ROOT}/src/game/consts.ts`);
const { readFileSync } = await import('node:fs');
const { resolve } = await import('node:path');

const argv = process.argv.slice(2), flag = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const TRACE = argv.includes('--trace'), ONLY = flag('--only') ?? '', BREAK = process.env.SWEEP_BREAK === '1', CALL_BREAK = process.env.FLANKCALL_BREAK === '1';
const STAND = process.env.TPS_PROFILE === 'shipped' ? 'shipped' : 'frozen';
const DT = 1 / 60, SETTLE = 1, OFF_POST = 2.5;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const at = (p: number[]) => `(${p[0].toFixed(1)}, ${p[2].toFixed(1)})`;
const f1 = (n: number) => Number.isFinite(n) ? n.toFixed(1) : '—';

type Arm = 'hard' | 'hard, row off' | 'standard';
/** a man let go: how far he ended from where he was let go, and how much nearer the report he ever got than he was then · a man never let go: how far he ended from
 *  where he stood when the report was filed (digging in moves men about their own rooms on hard, look or no look) */
interface Man { who: string; squad: string; free: boolean; /** let go later than the look's own frame: by a rule that is not the look (the press, once the look has met the team) */ late: boolean; off: number; toward: number }
interface Run {
  scn: string; arm: Arm; error?: string; sweepRow: boolean; level: string; squads: boolean; drilled: boolean; defenders: number; up: number; team: number; teamUp: number;
  /** the word: when the report was filed and where */
  /** the stand's word for the dialogue pass (WORDS.on) when the arm stood */ words?: boolean; wordT: number; wordAt: number[];
  /** seconds after the word: the look's line on the net · the first man let go (mode 'free') · the squad event */
  callT: number; goT: number; eventT: number;
  lookCalled: number; lookMen: number; lookOff: number;
  /** every man who was ever 'free' after the word, or ended more than OFF_POST from where he stood when it was filed · how many were let go on the look's own frame */
  moved: Man[]; freed: number; lines: string[]; sweeps: { squad: string; t: number; text: string }[]; out: number;
  /** rounds fired by anybody after the word and before the first man was let go (the staging is quiet until a look finds the team: the whole window where
   *  none goes) · rounds after that · defenders and team up on the frame the first man was let go (the end of the window where none goes) */
  shots: number; shotsAfter: number; upAtGo: number; teamAtGo: number;
}

async function play(scn: string, seed: number, arm: Arm, secs: number): Promise<Run> {
  const E = (SCENARIOS as any[]).find(e => e.id === scn);
  const R: Run = { scn, arm, sweepRow: false, level: '', squads: false, drilled: false, defenders: 0, up: 0, team: 0, teamUp: 0, wordT: NaN, wordAt: [0, 0, 0], callT: NaN, goT: NaN, eventT: NaN,
    lookCalled: 0, lookMen: 0, lookOff: 0, moved: [], freed: 0, lines: [], sweeps: [], out: 0, shots: 0, shotsAfter: 0, upAtGo: 0, teamAtGo: 0 };
  const log = console.log, err = console.error, warn = console.warn, rnd = Math.random, level = arm === 'standard' ? 'standard' : 'hard';
  const row = !(arm === 'hard, row off' || (arm === 'hard' && BREAK)), was = HARD.sweep;
  const say = (x: string) => { if (TRACE) log(x); };
  try {
    if (!E) throw new Error(`no scenario row '${scn}'`);
    HARD.sweep = row; setDifficulty(level, false);
    Math.random = seeded(0x53e9 + seed * 7919);
    console.log = console.error = console.warn = () => { };
    const W: any = await standUp({ uploadEvery: 4, ...(E.level ? { level: loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', E.level), 'utf8'))) } : {}) });
    const g = W.game; g.godMode = true;
    R.words = WORDS.on; if (CALL_BREAK) WORDS.on = false;   // (the stand's own word for the dialogue pass: the flanker's call below is asked only where it is on; FLANKCALL_BREAK takes the pass off under it)
    HARD.sweep = row; setDifficulty(level, false);   // (standUp has put the stand's own HARD.sweep back — off on the frozen stand, on on the page's: the arm's is written again, and the tables from it)
    const q = (scenarioQuery(E) as string).replace(/(^|[?&])roomclear(=\d+)?(?=&|$)/, `$1roomclear=${seed}`);
    const { why } = await startFromQuery(g, new URLSearchParams(q)); if (why) throw new Error(`start refused — ${why}`);
    R.level = String(difficultyNow()); R.sweepRow = !!PRESSURE.sweep;   // (as the difficulty wrote it once the level's own hard rows were in — difficulty.ts difficultyHere)
    const fight = g.fight, foes = () => (g.guards as any[]).filter(x => x.team === 'hostile'), team = () => (g.guards as any[]).filter(x => x.unit && x.team === 'operative');
    const alive = (xs: any[]) => xs.filter(x => x.state !== 'dead').length;
    const step = (n: number) => { for (let i = 0; i < n; i++) { g.player.visibility = 0.05; W.step(DT); } };
    step(Math.round(SETTLE * 60));
    R.squads = !!squadsLive(g); R.drilled = !!squadDrill(g); R.defenders = foes().length; R.team = team().length;
    const squadOf = new Map<any, string>();
    if (R.squads) for (const Q of squadsReport(g) as any[]) for (const h of squadMen(g, Q.name) as any[]) squadOf.set(h, Q.name);
    const home = new Map<any, number[]>(); for (const h of foes()) home.set(h, [h.char.pos[0], 0, h.char.pos[2]]);
    // every line a defender says, and the room fight's own notes when they are kept (--trace)
    { const say0 = g.say.bind(g); g.say = (gd: any, text: string, ...rest: any[]) => { if (gd?.team === 'hostile') { const t = g.time - R.wordT; R.lines.push(text); if (/gone quiet/.test(text) && Number.isNaN(R.callT)) R.callT = t; say(`    ${f1(t).padStart(6)}  “${text}” — ${gd.callsign} ${at(gd.char.pos)}`); } return say0(gd, text, ...rest); }; }
    if (TRACE && fight?.log) { const push0 = fight.log.push.bind(fight.log); fight.log.push = (...rows: any[]) => { for (const r of rows) say(`    ${f1(Number(r.t) - R.wordT).padStart(6)}  · ${r.who}: ${r.what}`); return push0(...rows); }; }
    // THE WORD: one loud report where Sam stands (outside every held room: the mission's own start), and nothing after it
    const sam = g.player.char.pos; R.wordAt = [sam[0], 0, sam[2]]; R.wordT = g.time;
    g.events.push({ kind: 'shot', pos: [sam[0], 0, sam[2]], time: g.time, loud: true, level: 1, who: PLAYER_ID });
    const seen = new Set<any>(g.events), everFree = new Map<any, { from: number[]; near: number; t: number }>();
    for (let f = 0; f < secs * 60; f++) {
      step(1);
      for (const e of g.events) if (!seen.has(e)) { seen.add(e); if (e.kind === 'shot' || e.kind === 'guardShot') { if (everFree.size) R.shotsAfter++; else R.shots++; } }
      for (const D of (fight.defs ?? []) as any[]) if (D.mode === 'free' && D.gd.state !== 'dead' && !everFree.has(D.gd)) { everFree.set(D.gd, { from: [D.gd.char.pos[0], 0, D.gd.char.pos[2]], near: Infinity, t: g.time - R.wordT }); if (Number.isNaN(R.goT)) { R.goT = g.time - R.wordT; R.upAtGo = alive(foes()); R.teamAtGo = alive(team()); } say(`    ${f1(g.time - R.wordT).padStart(6)}  → ${D.gd.callsign} is let go from ${at(D.gd.char.pos)}, ${f1(flat(D.gd.char.pos, R.wordAt))} m from the report`); }
      for (const [h, m] of everFree) m.near = Math.min(m.near, flat(h.char.pos, R.wordAt));
    }
    const st = pressureStats(g); R.lookCalled = st.lookCalled; R.lookMen = st.lookMen; R.lookOff = st.lookOff;
    R.up = alive(foes()); R.teamUp = alive(team()); R.freed = [...everFree.values()].filter(m => m.t <= R.goT + 0.25).length; if (!everFree.size) { R.upAtGo = R.up; R.teamAtGo = R.teamUp; }
    for (const h of foes()) { const m = everFree.get(h), p0 = m?.from ?? home.get(h)!, d = flat(h.char.pos, p0); if (m || d > OFF_POST) R.moved.push({ who: h.callsign, squad: squadOf.get(h) ?? '', free: !!m, late: !!m && m.t > R.goT + 0.25, off: d, toward: flat(p0, R.wordAt) - (m ? m.near : flat(h.char.pos, R.wordAt)) }); }
    for (const Q of squadsReport(g) as any[]) { R.out += Q.out; for (const e of Q.events) { say(`    squad ${Q.name}: ${e.what} @${f1(e.t - R.wordT)} ${e.text ?? e.why ?? ''}`); if (e.what === 'sweep') { R.sweeps.push({ squad: Q.name, t: e.t - R.wordT, text: String(e.text ?? e.why ?? '') }); if (Number.isNaN(R.eventT)) R.eventT = e.t - R.wordT; } } }
  } catch (e) { R.error = String((e as Error)?.stack ?? e); }
  finally { console.log = log; console.error = err; console.warn = warn; Math.random = rnd; HARD.sweep = was; if (CALL_BREAK && R.words !== undefined) WORDS.on = R.words; setDifficulty('standard', false); }
  return R;
}

let fails = 0;
const verdict = (ok: boolean, label: string, detail: string) => { if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
const men = (R: Run) => R.moved.length ? R.moved.map(m => `${m.who}${m.squad ? ` [${m.squad}]` : ''} ${m.late ? `let go later by another rule, ends ${f1(m.off)} m on` : m.free ? `LET GO, ends ${f1(m.off)} m from where he was let go, got ${f1(m.toward)} m nearer the report` : `never let go, ${f1(m.off)} m from where the report found him`}`).join(' · ') : 'nobody let go, nobody moved';
const head = (R: Run) => `${R.scn} · ${R.arm}: stands at ${R.level}, PRESSURE.sweep ${R.sweepRow ? 'on' : 'off'} as the difficulty wrote it · ${R.defenders} defenders (${R.up} up at the end), team ${R.teamUp} of ${R.team} up · report at ${at(R.wordAt)}, t ${f1(R.wordT)} · rounds fired after it and before a man was let go ${R.shots}, after one was ${R.shotsAfter}`;
const errs = (rs: Run[]) => { const bad = rs.filter(r => r.error); for (const r of bad) console.log(`  ERROR ${r.scn} · ${r.arm}: ${r.error}`); return bad.length === 0; };

console.log(`sweep-check · ${STAND} stand${BREAK ? ' · SWEEP_BREAK: HARD.sweep left off under the hard arm' : ''}`);
const SECS = PRESSURE.sweepSecs, BEAT = PRESSURE.sweepBeat, MEN = PRESSURE.sweepMen, SQ_SECS = SQUADS.sweepSecs, SQ_BEAT = SQUADS.sweepBeat;
// HOW LONG EACH STAGING IS PLAYED. Squads: the word is the net's last call (each squad's own 'holding' a few seconds after the report), the look `sweepSecs`
// after that, and the pair is given time to walk. No squads: on hard a report heard OUTSIDE every held room is stood to (PRESSURE.warned: no look while that
// report stands — `standSecs` after it is called), and a man still getting to his cover or wedging a door (DIGIN) is nobody's to send; the window is cut
// from the three tables so that it outlasts all of that, and the line asks only that the look is never EARLIER than `sweepSecs` and comes inside it.
const ROOM_SECS = Math.ceil(Math.max(SECS, PRESSURE.reportSecs + PRESSURE.standSecs, DIGIN.holdSecs) + BEAT + 14), SQUAD_SECS = SQ_SECS + 25;
const quietLine = (l: string) => /gone quiet/.test(l);

if (ONLY !== 'squads') {
  console.log(`\n=== sweep-check, no squads: room-clear-four, seed 1, ${ROOM_SECS} s after one loud report ===`);
  const on = await play('room-clear-four', 1, 'hard', ROOM_SECS), no = await play('room-clear-four', 1, 'hard, row off', ROOM_SECS), std = await play('room-clear-four', 1, 'standard', ROOM_SECS);
  for (const R of [on, no, std]) console.log(`  ${head(R)}\n    looks called ${R.lookCalled}, men let go ${R.lookMen}, called off ${R.lookOff} · called ${f1(R.callT)} s after the report, first man let go ${f1(R.goT)} s after it · ${men(R)}`);
  const went = on.moved.filter(m => m.free && !m.late);
  verdict(errs([on, no, std]), 'every arm played to its end', `${[on, no, std].filter(r => !r.error).length} of 3`);
  verdict(!on.squads && !no.squads && !std.squads && on.level === 'hard' && no.level === 'hard' && on.sweepRow && !no.sweepRow && std.level === 'standard' && !std.sweepRow, 'the level has no squads; hard writes PRESSURE.sweep from HARD.sweep, standard leaves it off whatever that says', `squads ${on.squads} · hard: ${on.level}, row ${on.sweepRow} · hard, HARD.sweep off: ${no.level}, row ${no.sweepRow} · standard: ${std.level}, row ${std.sweepRow}`);
  verdict([on, no, std].every(R => R.shots === 0 && R.teamAtGo === R.team && R.upAtGo === R.defenders), 'the staging is quiet in every arm: no round after the report and nobody down until a man is let go (to the end where none is)', `rounds ${on.shots} / ${no.shots} / ${std.shots} · defenders up then ${on.upAtGo} / ${no.upAtGo} / ${std.upAtGo} of ${on.defenders} · hard, once the look is out: ${on.shotsAfter} rounds, ${on.up} defenders and ${on.teamUp} of the team up at the end`);
  verdict(on.lookCalled >= 1 && on.lookCalled <= 2 && on.callT >= SECS, `hard: a look is called on the net for the word, not before it is ${SECS} s old (and not over and over)`, `lookCalled ${on.lookCalled} · the line ${f1(on.callT)} s after the report · “${on.lines.find(quietLine) ?? '—'}” · said ${on.lines.filter(quietLine).length} time(s)`);
  verdict(on.lookMen === MEN && on.freed === MEN && on.goT >= on.callT + BEAT - 0.1 && on.goT <= on.callT + BEAT + 0.5, `hard: ${MEN} men are let go, ${BEAT} s after the call`, `lookMen ${on.lookMen} · men let go together ${on.freed} · first let go ${f1(on.goT)} s after the report (${f1(on.goT - on.callT)} s after the call) · called off ${on.lookOff}`);
  verdict(went.length === MEN && went.every(m => m.off > OFF_POST && m.toward > OFF_POST), `hard: both leave where they stood (more than ${OFF_POST} m) and close on the report`, men(on));
  verdict(no.lookCalled === 0 && no.lookMen === 0 && no.freed === 0 && !no.lines.some(quietLine), 'hard with the row off: no look called, no man let go', `lookCalled ${no.lookCalled}, lookMen ${no.lookMen}, men let go ${no.freed} · ${men(no)}`);
  verdict(std.lookCalled === 0 && std.lookMen === 0 && std.freed === 0 && !std.lines.some(quietLine), 'standard: the same nothing', `lookCalled ${std.lookCalled}, lookMen ${std.lookMen}, men let go ${std.freed} · ${men(std)}`);
  verdict(!on.words || !on.lines.some((l: string) => /coming at (him|them)/.test(l)), 'hard: a man out on the look, with nobody of his side having seen the team, never says he is coming AT anybody (tactics.ts flankCall: "coming in from"; asked where the dialogue pass is on — FLANKCALL_BREAK=1 must fail there)', `${on.words ? '' : 'the pass is off on this stand, the line as it was: '}${on.lines.filter((l: string) => /moving round/.test(l)).join(' | ') || 'no flanker called in this run'}`);
}

if (ONLY !== 'room') {
  console.log(`\n=== sweep-check, squads: mousehole-four, seed 1, ${SQUAD_SECS} s after one loud report ===`);
  const on = await play('mousehole-four', 1, 'hard', SQUAD_SECS), no = await play('mousehole-four', 1, 'hard, row off', SQUAD_SECS), std = await play('mousehole-four', 1, 'standard', SQUAD_SECS);
  for (const R of [on, no, std]) console.log(`  ${head(R)}\n    squads ${R.squads ? (R.drilled ? 'drilled' : 'standard') : 'none'} · 'sweep' events ${R.sweeps.length}${R.sweeps.map(s => ` — ${s.squad} @${f1(s.t)} s: ${s.text}`).join('')} · first man let go ${f1(R.goT)} s after the report · men out at the end ${R.out} · ${men(R)}`);
  const went = on.moved.filter(m => m.free && !m.late), of = on.sweeps[0]?.squad ?? '—';
  verdict(errs([on, no, std]), 'every arm played to its end', `${[on, no, std].filter(r => !r.error).length} of 3`);
  verdict(on.squads && no.squads && std.squads && on.drilled && no.drilled && !std.drilled && on.sweepRow && !no.sweepRow && !std.sweepRow, 'the level stages squads: drilled on hard, PRESSURE.sweep written from HARD.sweep; standard squads without it', `squads ${on.squads} · hard: drilled ${on.drilled}, row ${on.sweepRow} · hard, HARD.sweep off: drilled ${no.drilled}, row ${no.sweepRow} · standard: drilled ${std.drilled}, row ${std.sweepRow}`);
  verdict([on, no, std].every(R => R.shots === 0 && R.teamAtGo === R.team && R.upAtGo === R.defenders), 'the staging is quiet in every arm: no round after the report and nobody down until a man is let go (to the end where none is)', `rounds ${on.shots} / ${no.shots} / ${std.shots} · defenders up then ${on.upAtGo} / ${no.upAtGo} / ${std.upAtGo} of ${on.defenders} · hard, once the look is out: ${on.shotsAfter} rounds, ${on.up} defenders and ${on.teamUp} of the team up at the end`);
  verdict(on.lines.filter(quietLine).length === 1 && on.lines.some(l => l === `${of}: gone quiet — two of us go and look!`) && on.callT >= SQ_SECS, `hard: one squad says it once on its net, not before the word is ${SQ_SECS} s old`, `“${on.lines.find(quietLine) ?? '—'}” ${f1(on.callT)} s after the report · said ${on.lines.filter(quietLine).length} time(s)`);
  verdict(on.sweeps.length === 1 && Math.abs(on.eventT - on.callT - SQ_BEAT) <= 0.2 && Math.abs(on.goT - on.callT - SQ_BEAT) <= 0.2, `hard: it files one 'sweep' event and lets its men go ${SQ_BEAT} s after the line`, `${on.sweeps.length} event(s)${on.sweeps.map(s => ` — ${s.squad} @${f1(s.t)} s after the report: ${s.text}`).join('')} · first man let go ${f1(on.goT)} s after it (${f1(on.goT - on.callT)} s after the line)`);
  verdict(on.freed === 2 && went.length === 2 && went.every(m => m.squad === of && m.off > OFF_POST), `hard: two men of that squad are let go and leave where they stood (more than ${OFF_POST} m)`, men(on));
  verdict(no.sweeps.length === 0 && no.freed === 0 && no.out === 0 && !no.lines.some(quietLine), 'hard with the row off: no line, no \'sweep\' event, no man let go, no squad with men out', `${no.sweeps.length} events · men let go ${no.freed} · out ${no.out} · ${men(no)}`);
  verdict(std.sweeps.length === 0 && std.freed === 0 && std.out === 0 && !std.lines.some(quietLine), 'standard: the same nothing', `${std.sweeps.length} events · men let go ${std.freed} · out ${std.out} · ${men(std)}`);
  verdict(!on.words || !on.lines.some((l: string) => /coming at (him|them)/.test(l)), 'hard: a man out on the look, with nobody of his side having seen the team, never says he is coming AT anybody (tactics.ts flankCall: "coming in from"; asked where the dialogue pass is on — FLANKCALL_BREAK=1 must fail there)', `${on.words ? '' : 'the pass is off on this stand, the line as it was: '}${on.lines.filter((l: string) => /moving round/.test(l)).join(' | ') || 'no flanker called in this run'}`);
}

// ---- a recording from before the key replays with nobody going to look: journal.ts applyKnobs reads the key off the recording's HARD row (the switch — PRESSURE
// is hard's copy of it, and no recording carries that table), puts both off for a file without it, and leaves a file's own word alone
if (!ONLY) { const J = await import(`${ROOT}/src/game/journal.ts`), W: any = await standUp({ uploadEvery: 4 }), g = W.game, was = [HARD.sweep, PRESSURE.sweep] as const;
  const snap = () => JSON.parse(JSON.stringify(J.knobsSnapshot(g)));
  console.log('\nreplays');
  HARD.sweep = true; PRESSURE.sweep = true; const old = snap(); delete old.tables.HARD; delete old.tables.PRESSURE; J.applyKnobs(g, old);
  verdict(HARD.sweep === false && PRESSURE.sweep === false, 'a recording with no HARD row replays with the switch off, and hard\'s copy of it', `HARD.sweep ${HARD.sweep}, PRESSURE.sweep ${PRESSURE.sweep}`);
  HARD.sweep = true; PRESSURE.sweep = true; const pre = snap(); pre.tables.HARD = { drilled: true }; delete pre.tables.PRESSURE; J.applyKnobs(g, pre);
  verdict(HARD.sweep === false && PRESSURE.sweep === false, 'a recording whose HARD row has no such key: the same', `HARD.sweep ${HARD.sweep}, PRESSURE.sweep ${PRESSURE.sweep}`);
  HARD.sweep = true; PRESSURE.sweep = true; const off = snap(); off.tables.HARD = { sweep: false }; delete off.tables.PRESSURE; J.applyKnobs(g, off);
  verdict(PRESSURE.sweep === false, 'a recording made with the switch off replays with nobody going to look, whatever the page it is played on has', `PRESSURE.sweep ${PRESSURE.sweep}`);
  HARD.sweep = true; PRESSURE.sweep = true; const own = snap(); own.tables.HARD = { sweep: true }; delete own.tables.PRESSURE; J.applyKnobs(g, own);
  verdict(HARD.sweep === true && PRESSURE.sweep === true, 'a recording made with it on is left its own word', `HARD.sweep ${HARD.sweep}, PRESSURE.sweep ${PRESSURE.sweep}`);
  HARD.sweep = was[0]; PRESSURE.sweep = was[1]; }

console.log(fails ? `\n=== sweep-check: ${fails} FAIL ===` : '\n=== sweep-check: ALL PASS ===');
process.exit(fails ? 1 : 0);
