// The 'pair-steady' probe: A PARTNER ON HIS WAY TO A MAN DOES NOT TURN ABOUT (pairorders.ts PAIR.steady — takeTick). Run through probes.ts:
//   bun run tools/qa/probes.ts pair-steady        (family: pair)
// PASS / FAIL each, headless. The pair lesson (levels/tut-pair.json) played through by its scripted player, once with the switch off and once with it on, the
// partner sampled every frame while he is on a man (moving up, waiting on a watched way, set). The probe keeps its own count of what the player saw:
//   · an ABOUT-TURN: his chest swings more than 120° inside a second and a half while his feet are within a pace and a half of where the swing began
//     (not the turn he sets off with: a job's first two seconds)
//   · a FLINCH: he parks on a watched way and his chest swings more than 45° inside the wait's first second
//   · a STEP BACK: the corner he is sent to is behind the way he is walking (over 100° off his heading) and inside two metres
// With the switch off the flaw is there; with it on there is none of the first and third and no flinch, the lesson still plays to its end, and a wait that
// lasts does turn him to his man. Then the stand's own word and the recording.
// What it cannot say: what it looks like (never seen on a GPU, nobody has played it); one level, one seed, a scripted player.
// The probe's own red path: PAIRSTEADY_BREAK=1 bun run tools/qa/probes.ts pair-steady must FAIL (the rule does nothing with its switch on).
import { ROOT } from './headless.ts';
const GM: any = await import(`${ROOT}/src/game/game.ts`);
const PM: any = await import(`${ROOT}/src/game/pairorders.ts`);
const PAIR = PM.PAIR;

type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
interface Tally { code: number; steps: number; secs: number; onMan: number; about: number; flinch: number; back: number; waits: number; longWaits: number; longFaced: number; lateSet: number; lateNull: number; stoodOn: boolean | null; g: any; when: string[] }
/** the lesson played once with the switch as asked (null: as the stand has it), the partner sampled */
async function play(on: boolean | null): Promise<Tally> {
  const { runLesson } = await import('./lesson-run.ts');
  const T: Tally = { code: -1, steps: 0, secs: 0, onMan: 0, about: 0, flinch: 0, back: 0, waits: 0, longWaits: 0, longFaced: 0, lateSet: 0, lateNull: 0, stoodOn: null, g: null, when: [] };
  const hist: { t: number; yaw: number; x: number; z: number; f: boolean }[] = []; let faceT = -9, aboutUntil = -1, began = -1, waitT = -1, waitYaw = 0, flinched = false, faced = false, backUntil = -1;
  const upd = GM.Game.prototype.update;
  GM.Game.prototype.update = function (this: any, ...a: any[]) {
    if (T.stoodOn === null) T.stoodOn = !!PAIR.steady; if (on !== null) PAIR.steady = on;
    const r = upd.apply(this, a); const g = this; T.g = g;
    const m = g.guards.find((x: any) => x.team === 'operative' && x.unit && x.state !== 'dead'), A = m ? g.orders.of(m) : null, go = String(A?.going ?? '');
    const waiting = go.startsWith('waiting'), onMan = waiting || go.startsWith('moving up on') || go.startsWith('on ') || go.startsWith('set on');
    if (!m || !onMan) { hist.length = 0; waitT = -1; began = -1; return r; }
    T.onMan++; const c = m.char, t = g.time, yaw = c.bodyYaw; if (began < 0) began = t; if (A.face != null) faceT = t; hist.push({ t, yaw, x: c.pos[0], z: c.pos[2], f: t - faceT < 0.5 }); while (hist.length && t - hist[0].t > 1.5) hist.shift();
    // an about-turn: the swing since any sample of the last second and a half, his feet near where it began. Not from a sample taken while a wait that
    // lasted had him squared to his man (the order's own `face`, or the half second after it lets go): turning back onto his way from that is the wait
    // ending, not a corner he has passed (the pair lesson's rebuilt level has one such wait, 121 degrees off his way)
    if (t > aboutUntil && t - began > 2) for (const h of hist)   // (not the turn he sets off with: the job's first two seconds)
       if (!h.f && Math.abs(wrap(yaw - h.yaw)) > 120 * Math.PI / 180 && Math.hypot(c.pos[0] - h.x, c.pos[2] - h.z) < 1.5) { T.about++; T.when.push(`${t.toFixed(1)}s ${go.slice(0, 22)} ${(h.yaw * 57.3).toFixed(0)}→${(yaw * 57.3).toFixed(0)}`); aboutUntil = t + 1.5; break; }
    // a flinch: parked on a watched way, his chest swung inside the wait's first second
    if (waiting) { if (waitT < 0) { waitT = t; waitYaw = hist.length > 1 ? hist[hist.length - 2].yaw : yaw; flinched = false; faced = false; T.waits++; }
      const sw = Math.abs(wrap(yaw - waitYaw)); if (!flinched && t - waitT < 1.0 && sw > 45 * Math.PI / 180) { flinched = true; T.flinch++; }
      if (t - waitT > 1.4) { if (A.face != null) T.lateSet++; else T.lateNull++; }   // (past steadyFaceSecs, with a margin: the wait that lasts turns him to his man)
      if (t - waitT > 3 && !faced) { faced = true; T.longWaits++; const foeYaw = A.face; if (foeYaw != null && Math.abs(wrap(yaw - foeYaw)) < 0.35) T.longFaced++; }
    } else waitT = -1;
    // a step back: the corner he is sent to lies behind the way he is walking
    const sp = Math.hypot(c.vel?.[0] ?? 0, c.vel?.[2] ?? 0);
    if (!waiting && A?.goal && t > backUntil && hist.length > 6) { const h = hist[hist.length - 7], mx = c.pos[0] - h.x, mz = c.pos[2] - h.z, ml = Math.hypot(mx, mz), gx = A.goal[0] - c.pos[0], gz = A.goal[2] - c.pos[2], gl = Math.hypot(gx, gz);
      if (ml > 0.06 && sp > 0.5 && gl > 0.3 && gl < 2 && (mx * gx + mz * gz) / (ml * gl) < Math.cos(100 * Math.PI / 180)) { T.back++; backUntil = t + 1; } }
    return r; };
  const railsWas = process.env.TPS_RAILS; if (process.env.TPS_PROFILE !== 'shipped') process.env.TPS_RAILS = '1';   // (a tutorial mission is the page's: on the frozen stand its frame is raised for the run, as lesson-gate does)
  try { const out = await runLesson('tut-pair', { hard: true }); T.code = out.code; T.steps = out.steps.length; T.secs = out.secs; }
  finally { GM.Game.prototype.update = upd; if (railsWas === undefined) delete process.env.TPS_RAILS; else process.env.TPS_RAILS = railsWas; }
  return T;
}

export async function pairSteady(): Promise<boolean> {
  const F = family('pair-steady: a partner on his way to a man does not turn about');
  const keep = { ...PAIR }, back = () => { Object.assign(PAIR, keep); };
  try {
    const off = await play(false); back(); const on = await play(true); back();
    const row = (t: Tally) => `${t.about} about-turn(s), ${t.back} step(s) back, ${t.flinch} flinch(es) in ${t.waits} wait(s) · ${(t.onMan / 60).toFixed(0)} s on a man · the lesson ${t.code === 0 ? 'played to its end' : 'did NOT end (code ' + t.code + ')'} in ${t.secs.toFixed(0)} s${t.when.length ? ' · about-turns at ' + t.when.join(', ') : ''}`;
    F.verdict(off.code === 0 && off.about + off.back > 0 && off.flinch > 0, 'with the switch off the flaw is there: he turns right round for a corner he has passed, and squares to the man on a short wait', row(off));
    F.verdict(on.code === 0 && on.about === 0 && on.back === 0 && on.flinch === 0 && on.steps === off.steps, 'with it on there is none of it, and the lesson still plays to its end', row(on));
    F.verdict(on.secs <= off.secs + 10 && on.onMan <= off.onMan * 1.25 + 120, '… at no cost in time worth the name', `the lesson ${off.secs.toFixed(0)} s → ${on.secs.toFixed(0)} s · on a man ${(off.onMan / 60).toFixed(1)} s → ${(on.onMan / 60).toFixed(1)} s`);
    F.verdict(on.lateNull === 0 && on.lateSet > 0, '… and a wait that lasts still turns him to watch his man', `frames of a wait past 1.4 s with his man to face: ${on.lateSet} · with none: ${on.lateNull}${on.lateSet === 0 ? ' · NO wait in this run lasted that long: not shown' : ''}`);
    { PAIR.steadyFaceSecs = 9; const moved = await play(false); back();
      F.verdict(moved.code === off.code && moved.about === off.about && moved.back === off.back && moved.flinch === off.flinch && moved.onMan === off.onMan, 'off, nothing reads it: the same run with its numbers moved', `${row(moved)}`); }
    { const stood = await play(null); back(); const shipped = process.env.TPS_PROFILE === 'shipped', word = process.env.TPS_PAIRSTEADY, want = word !== undefined ? word === '1' : shipped;
      F.verdict(stood.stoodOn === want, 'the stand: on as the page opens, off on the frozen stand (TPS_PAIRSTEADY has the say on either)', `stood up with it ${stood.stoodOn ? 'on' : 'off'} · ${shipped ? 'the page\'s' : 'the frozen'} stand${word !== undefined ? `, TPS_PAIRSTEADY=${word}` : ''}`);
      const J: any = await import(`${ROOT}/src/game/journal.ts`), g = stood.g, snap = () => JSON.parse(JSON.stringify(J.knobsSnapshot(g)));
      PAIR.steady = true; const own = snap(), old = snap(), older = snap(); delete old.tables.PAIR.steady; delete older.tables.PAIR;
      PAIR.steady = false; J.applyKnobs(g, own); const carried = PAIR.steady; PAIR.steady = true; J.applyKnobs(g, old); const before = PAIR.steady; PAIR.steady = true; J.applyKnobs(g, older); const none = PAIR.steady;
      F.verdict(carried === true && before === false && none === false, 'a recording carries it: one made with it on replays with it on, one from before the key (or before the table was carried) with it off', `the key in the file, on: ${carried} · no key: ${before} · no table: ${none}`); }
    return F.done();
  } finally { back(); }
}
