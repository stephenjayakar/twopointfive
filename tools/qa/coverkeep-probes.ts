// The 'cover-keep' probe: A MAN TOLD TO COVER KEEPS HIS ANGLE (roomfight.ts ROOMFIGHT.coverKeep — coverPasses). Run through probes.ts:
//   bun run tools/qa/probes.ts cover-keep        (family: roomfight)
// PASS / FAIL each, headless. The plan lesson's level (levels/tut-plan.json) stood up with its four men and ONE of its enemies, the probe's puppet: he is
// stood where the probe wants him each frame, cannot be killed, sees nothing, and his muzzle points where the probe points it. Blue One is told to cover
// up the lane from the back gate, as a player tells him; Red One stands beside him covering the side the puppet comes up on; the other two see nothing.
// Then the puppet is stood a quarter turn off Blue One's way, and the probe reads where Blue One's gun goes:
//   · with the switch off the flaw is there: his gun leaves the lane for the man Red One is already shooting at
//   · with it on it does not, and Red One is on the man the whole time
//   · … and the man is his again: with his muzzle on Blue One · with no mate on him · inside coverNearM · stood in the angle Blue One was given
//   · off, nothing reads the rule's numbers · the stand's own word · a recording carries the key
// Nobody's round goes in the staging (the probe holds every man's first shot off) so that the man is there to be looked at for the whole run, and the
// floor is hot, as it was when it was played: a sighting is a man.
// What it cannot say: what it looks like (never seen on a GPU, nobody has played it), or what it does to a fight — that is playthrough.ts's tally.
// The probe's own red path: COVERKEEP_BREAK=1 bun run tools/qa/probes.ts cover-keep must FAIL (the rule does nothing with its switch on).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, standUp } from './headless.ts';
const RM: any = await import(`${ROOT}/src/game/roomfight.ts`);
const GDM: any = await import(`${ROOT}/src/game/guards.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { LESSON } = await import(`${ROOT}/src/game/lesson.ts`);
const ROOMFIGHT = RM.ROOMFIGHT;

type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
const wrap = (a: number) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const yawTo = (a: number[], b: number[]) => Math.atan2(b[0] - a[0], b[2] - a[2]);
const LEVEL = 'tut-plan', DT = 1 / 60, DEG = 180 / Math.PI;
/** where the maintainer's man stood, the way he was told to watch, and the man he turned to (his own recording of the lesson, to the metre) */
const BLUE = [22.3, 0, 10.4], WAY = [22.5, 0, -18.9], RED = [23.5, 0, 9.6], SIDE = [33.0, 0, 10.4], LANE = [22.2, 0, 3.6], NEAR = [26.6, 0, 10.4], AWAY = [-60, 0, -60];
/** the yard's two gates (the back gate he covers through, the road gate the side man shows in): stood open, as they were when he played it */
const GATES = [[22.3, 5.0], [35.0, 10.3]];

interface Stage { on: boolean; at: number[]; muzzle: 'off' | 'blue'; red: boolean; secs?: number }
interface Out { state: string; settled: number; maxOff: number; onHim: number; redOn: number; frames: number; seen: number; line: boolean; g: any }
async function stage(S: Stage): Promise<Out> {
  const W: any = await quiet(() => standUp({ uploadEvery: 4, level: loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', `${LEVEL}.json`), 'utf8'))), seed: 1 })), g = W.game;
  LESSON.on = false; const started: any = await quiet(() => startFromQuery(g, `?levelFile=${LEVEL}.json&roomclear=1&squad4`)); if (!started.spec || started.why) throw new Error(`the level did not start: ${started.why}`);
  ROOMFIGHT.coverKeep = S.on;
  for (let i = 0; i < 30; i++) W.step(DT);   // (the start deals its men in its first frames)
  const foes = g.guards.filter((h: any) => h.team !== 'operative' && h.state !== 'dead'), E = foes[0]; if (!E) throw new Error('the level has no enemy to stand up');
  const men = g.guards.filter((m: any) => m.team === 'operative' && m.unit && m.state !== 'dead'), blue = men.find((m: any) => m.callsign === 'Blue One'), red = men.find((m: any) => m.callsign === 'Red One');
  if (!blue || !red) throw new Error(`the staging is not there: ${men.length} men, Blue One ${blue ? 'found' : 'not found'}, Red One ${red ? 'found' : 'not found'}`);
  const rest = men.filter((m: any) => m !== blue && m !== red);
  const put = (m: any, p: number[]) => { m.char.pos[0] = p[0]; m.char.pos[2] = p[2]; m.char.vel[0] = m.char.vel[2] = 0; if (m.path) m.path.length = 0; m.pathI = 0; };
  let eAt = AWAY, eYaw = 0;
  const gates = g.doors.list.filter((d: any) => GATES.some(q => Math.hypot(d.pos[0] - q[0], d.pos[2] - q[1]) < 0.9)); if (gates.length !== 2) throw new Error(`the yard's two gates are not where the probe has them: ${gates.length} found`);
  const puppet = () => { for (const d of gates) d.angle = 1.5; for (const o of g.fight.ops) o.readyAt = g.time + 1; g.fight.hotT = g.time; put(E, eAt);   // (nobody's round ever goes: the man is there to be looked at for the whole of the run · the floor hot, as it was: a sighting is a man)
    E.char.aimYaw = E.char.bodyYaw = eYaw; E.char.health = 1e6; E.dazzledUntil = g.time + 9;   // the probe's man: where it stands him, blind, unkillable
    foes.forEach((h: any, i: number) => { if (h !== E) { put(h, [AWAY[0] - 2 * i, 0, AWAY[2]]); h.dazzledUntil = g.time + 9; } });   // (the rest of the level's men: off the floor and blind — a man taken off the roster has the start deal the floor afresh)
    for (const m of men) m.char.health = 1e6; for (const m of S.red ? rest : [...rest, red]) m.dazzledUntil = g.time + 9; };
  put(blue, BLUE); put(red, RED); rest.forEach((m: any, i: number) => put(m, [16 + i * 1.2, 0, 9]));
  puppet(); for (let i = 0; i < 20; i++) { puppet(); W.step(DT); }
  put(blue, BLUE); put(red, RED);
  const told = g.orders.give('cover', { kind: 'floor', at: WAY }, undefined, { men: [blue] }), toldRed = g.orders.give('cover', { kind: 'floor', at: S.at === LANE ? SIDE : S.at }, undefined, { men: [red] });
  if (told || toldRed) throw new Error(`the order was refused: ${told ?? toldRed}`);
  for (let i = 0; i < 180; i++) { puppet(); W.step(DT); }   // three seconds: both on their angles, nobody about
  const c = blue.char, way = yawTo(c.pos, WAY), settled = Math.abs(wrap(c.aimYaw - way)) * DEG;
  eAt = S.at; eYaw = S.muzzle === 'blue' ? yawTo(S.at, c.pos) : wrap(yawTo(S.at, c.pos) + Math.PI * 0.6);   // (off: turned well away from Blue One — and from Red One beside him)
  const O = g.fight.ops.find((x: any) => x.gd === blue), X = g.fight.ops.find((x: any) => x.gd === red); if (!O || !X) throw new Error(`the room fight has no hands for the two men`);
  const out: Out = { state: '', settled, maxOff: 0, onHim: 0, redOn: 0, frames: 0, seen: 0, line: false, g };
  for (let i = 0, n = Math.round((S.secs ?? 4) * 60); i < n; i++) { puppet(); W.step(DT); out.frames++;
    out.maxOff = Math.max(out.maxOff, Math.abs(wrap(c.aimYaw - way)) * DEG); if (O.tgt === E) out.onHim++; if (X.tgt === E && X.blockT < ROOMFIGHT.noShot) out.redOn++;
    out.seen = Math.max(out.seen, O.meters.get(E)?.m ?? 0); }
  out.state = `${E.state}${E.wound ? '/wounded' : ''}`; out.line = !g.col.segmentBlocked([c.pos[0], 1.5, c.pos[2]], [S.at[0], 1.2, S.at[2]]);
  return out;
}

export async function coverKeep(): Promise<boolean> {
  const F = family('cover-keep: a man told to cover keeps his angle');
  const keep = { ...ROOMFIGHT }, lessonWas = LESSON.on, back = () => { Object.assign(ROOMFIGHT, keep); LESSON.on = lessonWas; };
  const row = (o: Out) => `his gun at most ${o.maxOff.toFixed(0)}° off the way he was given · on the man ${o.onHim} of ${o.frames} frames · Red One on the man with a round at him ${o.redOn} frames · made out ${o.seen.toFixed(2)} · the man at the end: ${o.state}`;
  try {
    const off = await stage({ on: false, at: SIDE, muzzle: 'off', red: true }); back();
    F.verdict(off.settled < 12 && off.line && off.redOn > off.frames * 0.5 && off.onHim > 0 && off.maxOff > 60, 'with the switch off the flaw is there: his gun leaves the lane for a man Red One is already shooting at', `on his angle before the man shows: ${off.settled.toFixed(0)}° off · a line to the man: ${off.line} · ${row(off)}`);
    const on = await stage({ on: true, at: SIDE, muzzle: 'off', red: true }); back();
    F.verdict(on.settled < 12 && on.onHim === 0 && on.maxOff < 15 && on.redOn > on.frames * 0.5 && on.seen > 0, 'with it on he keeps his angle: seen, and left to the man who has him', row(on));
    const aimed = await stage({ on: true, at: SIDE, muzzle: 'blue', red: true }); back();
    F.verdict(aimed.onHim > 0 && aimed.maxOff > 60, '… but a man whose muzzle is on him is his', row(aimed));
    const alone = await stage({ on: true, at: SIDE, muzzle: 'off', red: false }); back();
    F.verdict(alone.redOn === 0 && alone.onHim > 0 && alone.maxOff > 60, '… and so is a man no mate has', row(alone));
    const near = await stage({ on: true, at: NEAR, muzzle: 'off', red: true }); back();
    F.verdict(near.onHim > 0 && near.maxOff > 60, `… and a man inside ${ROOMFIGHT.coverNearM} m`, row(near));
    const laneOff = await stage({ on: false, at: LANE, muzzle: 'off', red: true }), laneOn = await stage({ on: true, at: LANE, muzzle: 'off', red: true }); back();
    F.verdict(laneOn.onHim > 0 && laneOn.onHim === laneOff.onHim && Math.abs(laneOn.maxOff - laneOff.maxOff) < 1e-9, 'a man in the angle he was given is his as he ever was: frame for frame the same (and Red One, covering the side, leaves THIS man to him)', `off: ${row(laneOff)} · on: ${row(laneOn)}`);
    { ROOMFIGHT.coverHalfDeg = 0; ROOMFIGHT.coverNearM = 99; const moved = await stage({ on: false, at: SIDE, muzzle: 'off', red: true }); back();
      F.verdict(moved.onHim === off.onHim && Math.abs(moved.maxOff - off.maxOff) < 1e-9 && moved.redOn === off.redOn, 'off, nothing reads it: the same run with its numbers moved', row(moved)); }
    { const W: any = await quiet(() => standUp({ uploadEvery: 4, seed: 1 })), g = W.game, stood = ROOMFIGHT.coverKeep; const shipped = process.env.TPS_PROFILE === 'shipped', word = process.env.TPS_COVERKEEP, want = word !== undefined ? word === '1' : shipped;
      F.verdict(stood === want, 'the stand: on as the page opens, off on the frozen stand (TPS_COVERKEEP has the say on either)', `stood up with it ${stood ? 'on' : 'off'} · ${shipped ? 'the page\'s' : 'the frozen'} stand${word !== undefined ? `, TPS_COVERKEEP=${word}` : ''}`);
      const J: any = await import(`${ROOT}/src/game/journal.ts`), snap = () => JSON.parse(JSON.stringify(J.knobsSnapshot(g)));
      ROOMFIGHT.coverKeep = true; const own = snap(), old = snap(), older = snap(); delete old.tables.ROOMFIGHT.coverKeep; delete older.tables.ROOMFIGHT;
      ROOMFIGHT.coverKeep = false; J.applyKnobs(g, own); const carried = ROOMFIGHT.coverKeep; ROOMFIGHT.coverKeep = true; J.applyKnobs(g, old); const before = ROOMFIGHT.coverKeep; ROOMFIGHT.coverKeep = true; J.applyKnobs(g, older); const none = ROOMFIGHT.coverKeep;
      F.verdict(carried === true && before === false && none === false, 'a recording carries it: one made with it on replays with it on, one from before the key (or before the table was carried) with it off', `the key in the file, on: ${carried} · no key: ${before} · no table: ${none}`); }
    return F.done();
  } finally { back(); }
}
