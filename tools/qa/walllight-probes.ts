// The 'light-wall' probe: A TEAMMATE'S LIGHT IS DARK INTO THE WALL AT HIS MUZZLE (guards.ts LIGHTS.wallOff — wallDark / wallDarkSeen). Run through probes.ts:
//   bun run tools/qa/probes.ts light-wall        (family: litman)
// PASS / FAIL each, headless (bang-tally.ts stage()). The squad is given the orders a player gives — fall in, stack on the nearest door, open and clear — with
// the light discipline rule held off and the team bare-eyed, so every weapon light burns as its unit's switch has it; every frame the probe casts ITS OWN rays
// (the lens to five points across the beam, the rule's geometry at a margin either side of its two distances) and keeps its own clock:
//   · with the switch off the flaw is there: frames of a burning light whose whole beam has ended at arm's length for longer than the rule would allow
//   · with it on there is no such frame, and the rule did hold lights dark
//   · it burns again at once: no frame where the rule has him dark and any ray runs clear past the far distance
//   · nobody but the team is asked: no hostile man's reading is ever dark
//   · off, nothing reads the rule's numbers: the same game frame for frame with them moved
//   · the stand's own word, and a recording carries the key
// What it cannot say: what any of it looks like (never seen on a GPU), or whether it helps a fight — that is playthrough.ts's tally.
// The probe's own red path: WALLLIGHT_BREAK=1 bun run tools/qa/probes.ts light-wall must FAIL (the rule answers "not dark" with its switch on).
import { ROOT } from './headless.ts';
import { stage } from './bang-tally.ts';
const GDM: any = await import(`${ROOT}/src/game/guards.ts`);
const NVM: any = await import(`${ROOT}/src/game/nvg.ts`).catch(() => null);
const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const { digestGame } = await import(`${ROOT}/src/game/digest.ts`);
const LIGHTS = GDM.LIGHTS;
const IDS: string[] = (SCENARIOS as any[]).map(e => e.id);

type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const doorsOf = (S: any): any[] => { const sam = S.g.player.char.pos; const c: { ent: any; dist: number }[] = []; for (const d of S.defs) for (const e of d.room.entries) if (!c.some(q => q.ent === e)) c.push({ ent: e, dist: flat(sam, e.at) }); c.sort((a, b) => a.dist - b.dist); return c.map(q => q.ent); };
function fnv() { let h = 0x811c9dc5 >>> 0; return { eat: (s: string) => { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } }, hex: () => (h >>> 0).toString(16).padStart(8, '0') }; }
const FAN = [0, -0.17, 0.17, -0.33, 0.33], MARGIN = 0.15;
/** the probe's own reading of a man's beam: does every ray from the lens to a point `m` along it end on something solid (or the lens itself stand past a wall from his gun shoulder) */
const ends = (g: any, x: any, m: number): boolean => { const held = x.char.bones.upperArmR, p = x.flashlight.pos, d = x.flashlight.dir; if (!held) return false;
  return g.col.segmentBlocked(held, p) || FAN.every(a => { const c = Math.cos(a), k = Math.sin(a); return g.col.segmentBlocked(p, [p[0] + (d[0] * c + d[2] * k) * m, p[1] + d[1] * m, p[2] + (d[2] * c - d[0] * k) * m]); }); };

interface Tally { litNear: number; lit: number; dark: number; darkClear: number; foeDark: number; foeNear: number; hash: string; frames: number }
/** one scripted stretch: fall in, stack on the nearest door, open and clear — the team bare-eyed and the discipline rule off, so the lights burn */
async function play(id: string, on: boolean): Promise<Tally> {
  const S: any = await quiet(() => stage(id, 1)); const { g, step } = S, O = g.orders; LIGHTS.wallOff = on; LIGHTS.on = false; if (NVM?.NVG) NVM.NVG.on = false; g.player.nv = false;
  const T: Tally = { litNear: 0, lit: 0, dark: 0, darkClear: 0, foeDark: 0, foeNear: 0, hash: '', frames: 0 }, H = fnv(), near = new Map<any, number>();
  const frame = () => { step(); T.frames++; H.eat(JSON.stringify(digestGame(g, true)));
    for (const x of g.guards) { if (x.state === 'dead' || !x.flashlight) continue; const mate = x.team === 'operative' && !!x.unit; H.eat(`${x.flashlight.enabled ? 1 : 0}`);
      if (!mate) { if (GDM.wallDarkSeen(g, x)) T.foeDark++; if (x.flashlight.enabled && ends(g, x, LIGHTS.wallM - MARGIN)) T.foeNear++; continue; }
      const n = ends(g, x, LIGHTS.wallM - MARGIN) ? (near.get(x) ?? 0) + 1 : 0; near.set(x, n);
      if (x.flashlight.enabled) { T.lit++; if (n > (LIGHTS.wallSecs + 0.2) * 60) T.litNear++; }
      if (GDM.wallDarkSeen(g, x)) { T.dark++; if (!ends(g, x, LIGHTS.wallBackM + MARGIN)) T.darkClear++; } } };
  const sam = g.player.char.pos; await quiet(() => O.give('fallIn', O.targetAt([sam[0], 0, sam[2]]), 'all')); for (let f = 0; f < 120; f++) frame();
  let fc: any = null; for (const e of doorsOf(S)) { fc = e.door.frameCentre; if (!(await quiet(() => O.give('stack', O.targetAt(fc), 'all')))) break; } for (let f = 0; f < 60 * 8; f++) frame();
  if (fc) await quiet(() => O.give('openClear', O.targetAt(fc), 'all')); for (let f = 0; f < 60 * 15; f++) frame();
  T.hash = H.hex(); return T;
}

export async function lightWall(): Promise<boolean> {
  const F = family('light-wall: a teammate\'s weapon light is dark while its whole beam ends on something solid at arm\'s length, and burns again the frame it does not');
  const keep = { ...LIGHTS }, keepNv = NVM?.NVG ? NVM.NVG.on : undefined, back = () => { Object.assign(LIGHTS, keep); if (NVM?.NVG) NVM.NVG.on = keepNv; };
  try {
    let stood = 0, stoodOn = 0; const ids = IDS.filter(id => ['night-breach', 'rescue-registry', IDS[0]].includes(id)).slice(0, 3);
    const off: Tally[] = [], on: Tally[] = [];
    for (const id of ids) { stood++; await quiet(() => stage(id, 1)); if (LIGHTS.wallOff) stoodOn++; back(); off.push(await play(id, false)); back(); on.push(await play(id, true)); back(); }
    const sum = (A: Tally[], k: keyof Tally) => A.reduce((n, t) => n + (t[k] as number), 0), per = (k: keyof Tally) => ids.map((id, i) => `${id} ${off[i][k]}→${on[i][k]}`).join(' · ');
    F.verdict(sum(off, 'litNear') > 0, 'with the switch off the flaw is there: a light burns on with its whole beam ended at arm\'s length', `man-frames lit, the beam ended inside ${(LIGHTS.wallM - MARGIN).toFixed(2)} m for over ${(LIGHTS.wallSecs + 0.2).toFixed(1)} s: ${sum(off, 'litNear')} of ${sum(off, 'lit')} lit, over ${ids.length} scenarios (${per('litNear')})`);
    F.verdict(sum(on, 'litNear') === 0 && sum(on, 'dark') > 0, 'with it on there is no such frame, and the rule held lights dark', `man-frames lit into the wall ${sum(off, 'litNear')} → ${sum(on, 'litNear')} (want 0) · man-frames the rule had dark: ${sum(on, 'dark')} (${per('dark')})`);
    F.verdict(sum(on, 'darkClear') === 0, 'it burns again at once: never dark with a ray running clear past the far distance', `man-frames the rule had dark with a ray clear to ${(LIGHTS.wallBackM + MARGIN).toFixed(2)} m: ${sum(on, 'darkClear')} (want 0)`);
    F.verdict(sum(on, 'foeDark') === 0 && sum(off, 'foeDark') === 0, 'nobody but the team is asked: no other man\'s reading is ever dark', `readings dark on a man who is not Sam's: ${sum(on, 'foeDark')} · their own lights burning into something at arm's length, left as they are: ${sum(on, 'foeNear')} man-frames`);
    { LIGHTS.wallM = 5; LIGHTS.wallBackM = 6; LIGHTS.wallSecs = 0; const moved = await play(ids[0], false); back();
      F.verdict(moved.hash === off[0].hash && moved.frames === off[0].frames, 'off, nothing reads it: the same game frame for frame with its numbers moved', `${ids[0]}: ${off[0].hash} · numbers moved ${moved.hash} (${moved.frames} frames)`); }
    { const shipped = process.env.TPS_PROFILE === 'shipped', word = process.env.TPS_WALLLIGHT, want = word !== undefined ? word === '1' : shipped;
      F.verdict(stoodOn === (want ? stood : 0), 'the stand: on as the page opens, off on the frozen stand (TPS_WALLLIGHT has the say on either)', `${stoodOn} of ${stood} stagings stood up with it on · ${shipped ? 'the page\'s' : 'the frozen'} stand${word !== undefined ? `, TPS_WALLLIGHT=${word}` : ''}`);
      const J: any = await import(`${ROOT}/src/game/journal.ts`), S: any = await quiet(() => stage(ids[0], 1)), snap = () => JSON.parse(JSON.stringify(J.knobsSnapshot(S.g)));
      LIGHTS.wallOff = true; const own = snap(), old = snap(), none = snap(); delete old.tables.LIGHTS.wallOff; delete none.tables.LIGHTS;
      LIGHTS.wallOff = false; J.applyKnobs(S.g, own); const carried = LIGHTS.wallOff; LIGHTS.wallOff = true; J.applyKnobs(S.g, old); const before = LIGHTS.wallOff; LIGHTS.wallOff = true; J.applyKnobs(S.g, none); const bare = LIGHTS.wallOff;
      F.verdict(carried === true && before === false && bare === false, 'a recording carries it: one made with it on replays with it on, one from before the key (or before the table was carried) with it off', `the key in the file, on: ${carried} · no key: ${before} · no LIGHTS table: ${bare}`); }
    return F.done();
  } catch (e) { console.log(`- FAIL — the probe threw\n    ${e instanceof Error ? e.stack : String(e)}`); return false; }
  finally { back(); }
}
