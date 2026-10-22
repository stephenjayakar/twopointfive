// The 'by-eye' probe: LIT TO WHOM (sneak.ts SNEAK.byEye — litSeen). Run through probes.ts:
//   bun run tools/qa/probes.ts by-eye        (family: sneak)
// PASS / FAIL each, headless. The pair-up rig's open strip at night (pairup-probes.ts rig): one defender stood looking down it, the partner at its far
// end, and the partner's OWN METER planted the way a GPU page reads an open night shadow (the software renderer and the CPU's estimate read it near 0; the
// maintainer's HUD showed 14 to 27 of 100). The probe asks the sneak's own map (sneakWalk: what the partner's way to a man is planned over) which steps
// down the strip are WATCHED and what a walk across it costs, then gives the order and watches his feet:
//   · with the switch off the flaw is there: a dim meter makes every step with a line watched, out to the end of the eye's reach
//   · with it on only the steps near enough for THAT eye to gain on a crouched man are — no further than the guards' own arithmetic allows for the
//     meter planted (the probe's own sum), and never a step that was not watched before; the brighter the meter the further out
//   · a bright meter is watched all the way out either way · a meter under the lit number is watched nowhere either way
//   · a walk across the far end costs nothing with it on and something with it off; a walk across the near end costs the same either way
//   · THE FOLLOWER, on the pair lesson itself (tut-pair, its scripted player, hard), Sam's meter never under 0.2 as the lesson runner's --floor has it:
//     with the switch off the partner waits on the light and the lesson does not end; with it on it plays to its end
//   · off, nothing reads its number · the stand's own word · a recording carries the key
// What it cannot say: what a GPU reads (the meter here is the probe's hand; nothing was seen on a GPU, nobody has played it). The lesson arm stands on the
// pair lesson's level as it is: if that level is rebuilt so that no way of the partner's has a line, the two arms come out alike and the verdict says so.
// The probe's own red path: BYEYE_BREAK=1 bun run tools/qa/probes.ts by-eye must FAIL (the switch reads on and the flat number decides).
import { ROOT } from './headless.ts';
import { rig } from './pairup-probes.ts';
const SN: any = await import(`${ROOT}/src/game/sneak.ts`);
const GM: any = await import(`${ROOT}/src/game/game.ts`);
const SNEAK = SN.SNEAK;

type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const WEST = -Math.PI / 2, EAST = Math.PI / 2, Z = 1.5, DX = 10.5, STEP = 0.5, FAR = 15.5;
/** the guards' own arithmetic for a crouched man (guards.ts sightGainOn, as sneak.ts eyeRate has it), by the probe's own hand: the furthest a man this lit is gained on */
function reach(g: any, lit: number, floor: number): number {
  let far = 0; for (let d = 1.8; d <= 16; d += 0.05) if (g.tune.detectRate * Math.pow(lit, 1.5) * Math.max(0.2, Math.min(1, 1 - (d - 3) / 13)) * 0.75 > floor) far = d; return far; }

interface Stage { R: any; g: any; m: any; F: any; D: any; H: { v: number | null } }
/** the watcher D looking east down the strip from DX; the other man F stood behind him, looking away; the partner at the strip's far end */
async function stage(): Promise<Stage> { const fx = 4.5, mx = 26.6;
  const R: any = await rig({ up: true }), g = R.game, m = R.mate, F = R.tango(1), D = R.tango(2); R.only(F, D);
  R.pin(F, { at: [fx, 0, Z], yaw: WEST, state: 'patrol', aw: 0 }); R.pin(D, { at: [DX, 0, Z], yaw: EAST, state: 'patrol', aw: 0 }); g.teleportPlayer([mx + 3, 0, Z]); R.put(m, [mx, 0, Z], WEST);
  const id = m.char.id, la = g.lightAt, H = { v: null as number | null }, E = (v: number) => g.tune.visFloor * Math.exp(v / g.tune.visSlope);
  g.lightAt = (k: string) => H.v !== null && (k === `unitC${id}` || k === `unitH${id}`) ? E(H.v) : la(k);   // (the partner's meter, planted: what the renderer would answer for him)
  SNEAK.stalkAmbient = true; R.step(60 * 4); return { R, g, m, F, D, H };
}

export async function byEye(): Promise<boolean> {
  const F = family('by-eye: a lit step is seen only where the eye that has the line would gain on a man there');
  const keep = { ...SNEAK }, back = () => { Object.assign(SNEAK, keep); };
  try {
    const S = await stage(), stood = !!SNEAK.byEye, { g, m } = S, EV = (v: number) => g.tune.visFloor * Math.exp(v / g.tune.visSlope);
    const strip = (on: boolean, v: number) => { SNEAK.stalkAmbient = true; SNEAK.byEye = on; m.visibility = v; m.irradiance = EV(v); const W = SN.sneakWalk(g, m, true); const row: boolean[] = [];
      for (let d = 2; d <= FAR + 1e-6; d += STEP) row.push(!!W.watched(DX + d, Z));
      const walk = (d: number) => W.cost([[DX + d, 0, Z - 0.3], [DX + d, 0, Z + 0.9]], 1.0) as number;
      let far = 0; row.forEach((w, i) => { if (w) far = 2 + i * STEP; }); return { row, far, n: row.filter(Boolean).length, near: walk(6), end: walk(14) }; };
    const txt = (r: { row: boolean[] }) => r.row.map(w => w ? 'W' : '.').join('');
    const dark = [strip(false, 0.05), strip(true, 0.05)], dim = [strip(false, 0.27), strip(true, 0.27)], mid = [strip(false, 0.4), strip(true, 0.4)], bright = [strip(false, 0.7), strip(true, 0.7)];
    const all = dim[0].row.length, cap = reach(g, 0.27, SNEAK.seenRate), capMid = reach(g, 0.4, SNEAK.seenRate);
    F.verdict(dim[0].n === all && dim[0].far >= FAR - 1e-6, 'with the switch off the flaw is there: a dim meter (0.27) makes every step with a line watched, out to the end of the eye\'s reach', `2 to ${FAR} m in front of the watcher, a step every ${STEP} m: ${txt(dim[0])} (${dim[0].n} of ${all} watched)`);
    F.verdict(dim[1].far >= 5 && dim[1].far < dim[0].far - 2 && dim[1].far <= cap + STEP && dim[1].row.every((w, i) => !w || dim[0].row[i]) && dim[1].row.every((w, i) => w === (2 + i * STEP <= dim[1].far)), 'with it on only the near steps are: no further than the guards\' own arithmetic gains on a crouched man this lit, and none that was not watched before',
      `${txt(dim[1])} · watched out to ${dim[1].far} m (the probe's own sum for a meter of 0.27 over a rate of ${SNEAK.seenRate}: ${cap.toFixed(1)} m; the map's light for a step is the meter less what the rule holds back)`);
    F.verdict(mid[1].far >= dim[1].far && mid[1].far <= capMid + STEP && mid[1].row.every((w, i) => !w || mid[0].row[i]), '… the brighter the meter the further out (0.4)', `${txt(mid[1])} · out to ${mid[1].far} m (the probe's sum: ${capMid.toFixed(1)} m) · off: ${txt(mid[0])}`);
    F.verdict(bright[0].n === all && bright[1].n === all && dark[0].n === dark[1].n && dark[1].far < 3, 'a bright meter (0.7) is watched all the way out either way; a meter under the lit number (0.05) nowhere past his elbow either way', `0.7: off ${bright[0].n}, on ${bright[1].n} of ${all} · 0.05: off ${txt(dark[0])}, on ${txt(dark[1])}`);
    F.verdict(dim[0].end > 0 && dim[1].end === 0 && dim[1].near > 0 && Math.abs(dim[1].near - dim[0].near) < 1e-9, 'a walk across the far end of his view (14 m) costs nothing with it on and something off; across the near end (6 m) the same either way', `at 14 m: off ${dim[0].end.toFixed(3)}, on ${dim[1].end.toFixed(3)} · at 6 m: off ${dim[0].near.toFixed(3)}, on ${dim[1].near.toFixed(3)}`);
    back();
    // … THE FOLLOWER: the pair lesson played by its script with Sam's meter never under 0.2 (what a GPU reads in an open night shadow), the switch held each frame
    const lesson = async (on: boolean) => { const { runLesson } = await import('./lesson-run.ts'); let wait = 0, sneak = 0; const upd = GM.Game.prototype.update;
      GM.Game.prototype.update = function (this: any, ...a: any[]) { SNEAK.byEye = on; const r = upd.apply(this, a); const g2 = this, m2 = g2.guards.find((x: any) => x.team === 'operative' && x.unit && x.state !== 'dead');
        if (m2 && SN.sneaking(g2, m2)) { sneak++; if (SN.sneakWord(g2, m2) === 'waiting on the light') wait++; } return r; };
      const railsWas = process.env.TPS_RAILS; if (process.env.TPS_PROFILE !== 'shipped') process.env.TPS_RAILS = '1';   // (a tutorial mission is the page's: on the frozen stand its frame is raised for the run)
      const log = console.log; console.log = () => { };
      try { const out = await runLesson('tut-pair', { hard: true, floor: 0.2 }); return { code: out.code as number, steps: out.steps.length as number, secs: out.secs as number, wait: wait / 60, sneak: sneak / 60 }; }
      finally { console.log = log; GM.Game.prototype.update = upd; if (railsWas === undefined) delete process.env.TPS_RAILS; else process.env.TPS_RAILS = railsWas; back(); } };
    const lOff = await lesson(false), lOn = await lesson(true);
    const tell = (o: { code: number; steps: number; secs: number; wait: number }) => `${o.code === 0 ? 'played to its end' : 'did NOT end'} (${o.steps} steps, ${o.secs.toFixed(0)} s; the partner 'waiting on the light' ${o.wait.toFixed(0)} s)`;
    F.verdict(lOn.code === 0 && (lOff.code !== 0 || lOff.secs >= lOn.secs - 5), 'the follower, on the pair lesson with Sam\'s meter never under 0.2: with it on the lesson plays to its end; off, the partner waits on the light and it does not (or it is no quicker)',
      `off: ${tell(lOff)} · on: ${tell(lOn)}${lOff.code === 0 ? ' · THE TWO ARMS END ALIKE: the level has no line on his way any more, and this line shows nothing' : ''}`);
    { SNEAK.seenRate = 0.9; const moved = strip(false, 0.27); back();
      F.verdict(moved.n === dim[0].n && Math.abs(moved.end - dim[0].end) < 1e-9, 'off, nothing reads it: the same strip with its number moved', `${txt(moved)} · a walk at 14 m ${moved.end.toFixed(3)}`); }
    { const J: any = await import(`${ROOT}/src/game/journal.ts`), PR: any = await import(`${ROOT}/src/host/profile.ts`), SE: any = await import(`${ROOT}/src/host/standEnv.ts`);
      const shipped = process.env.TPS_PROFILE === 'shipped', word = process.env.TPS_BYEYE, want = word !== undefined ? word === '1' : shipped;
      F.verdict(stood === want && PR.FROZEN_HOLDS['SNEAK.byEye'] === 'TPS_BYEYE=1' && SE.STAND_ENV.includes('TPS_BYEYE'), 'the stand: on as the page opens, off on the frozen stand (TPS_BYEYE has the say on either); the stands\' list has the row', `stood up with it ${stood ? 'on' : 'off'} · ${shipped ? 'the page\'s' : 'the frozen'} stand${word !== undefined ? `, TPS_BYEYE=${word}` : ''} · FROZEN_HOLDS ${PR.FROZEN_HOLDS['SNEAK.byEye'] ?? 'no row'}`);
      const snap = () => JSON.parse(JSON.stringify(J.knobsSnapshot(g)));
      SNEAK.byEye = true; const own = snap(), old = snap(); delete old.tables.SNEAK.byEye;
      SNEAK.byEye = false; J.applyKnobs(g, own); const carried = SNEAK.byEye; SNEAK.byEye = true; J.applyKnobs(g, old); const before = SNEAK.byEye; back();
      F.verdict(carried === true && before === false, 'a recording carries it: one made with it on replays with it on, one from before the key with it off', `the key in the file, on: ${carried} · no key: ${before}`); }
    return F.done();
  } finally { back(); }
}
