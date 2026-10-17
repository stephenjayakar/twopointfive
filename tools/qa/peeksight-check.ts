// A PEEK ROUND THE END OF A WALL LIFTS THE FOG OF WAR (src/game/peeksight.ts — PEEKSIGHT.on, off as shipped in the module and on the frozen stand).
//   bun run tools/qa/probes.ts peek-sight          (family: peeksight)        ·  bun run tools/qa/peeksight-check.ts
// On the police post, quiet, under the fog's cones (the floor and the rung the maintainer was on): the player takes the wall beside an open doorway with the real
// keys, sidles to the jamb and keeps pushing — the peek. With the switch up the fog's eye for him is past the end of the wall, a head's place by the frame on his own side of the wall's plane, looking square into the opening: a spot
// and a man down the way through the door are seen, which they are not with the switch down; a spot hard behind the wall he leans on is seen neither way; crouched
// the eye is at the crouch's height; on the rifle stack the step-out is not counted twice and the look is the rifle's; his
// own head stays on the wall and the same run digests the same down and up with the guards live (a peek exposes him no more than it did); let go, the eye is his
// own again; the two stands' row and a recording from before the table. PEEKSIGHT_BREAK=1 leaves the switch down: exit 1.
// Run it on both stands (plain, and TPS_PROFILE=shipped): it raises the switches it needs itself. Nothing here looks at a picture.
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { standUp, ROOT } from './headless.ts';

const { PEEKSIGHT, PEEK_STATS, peekEye } = await import(`${ROOT}/src/game/peeksight.ts`);
const SC = await import(`${ROOT}/src/game/stickycam.ts`);
const { WALLSNAP } = await import(`${ROOT}/src/game/wallsnap.ts`);
const QF = await import(`${ROOT}/src/game/quietfog.ts`);
const { FOG } = await import(`${ROOT}/src/game/fogofwar.ts`);
const { startFromQuery, quitScenario } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);

type Vec3 = [number, number, number];
const hushed = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const DT = 1 / 60, f2 = (x: number) => Math.round(x * 100) / 100, BREAK = process.env.PEEKSIGHT_BREAK === '1';
const FILE = 'police-post.json', RUNG = 'cones', KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];

async function stand(seed: number) {
  Math.random = seeded(0x9ee4 + seed * 7919);
  const level = loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', FILE), 'utf8')));
  return await hushed(() => standUp({ uploadEvery: 1, level })) as any;
}
/** the quiet mission alone under the fog's cones, the AI still, every door held open (a closer would swing a leaf back across its doorway) */
async function floor(seed: number) {
  const W = await stand(seed), g = W.game; SC.STICKY.on = true; QF.QUIETFOG.on = true; QF.QUIETFOG.def = 'off';
  await hushed(() => startFromQuery(g, `?levelFile=${FILE}&quiet=1&quietfog=${RUNG}`));
  g.aiEnabled = false; g.godMode = true;
  const hold = () => { for (const d of g.doors.list as any[]) { d.angle = d.maxA > 0.5 ? Math.min(d.maxA, 1.5) : Math.max(d.minA, -1.5); d.vel = 0; d.latched = false; d.closing = false; d.place(); } };
  const steps = (n: number, each?: () => void) => { for (let i = 0; i < n; i++) { hold(); each?.(); W.step(DT); } };
  steps(30);
  return { W, g, steps };
}
type Spot = { p: Vec3; key: string; door: string };
/** the stations to try: half a metre off either face of the wall, 0.7 m past either end of each doorway */
function stations(g: any): { p: Vec3; door: string }[] {
  const out: { p: Vec3; door: string }[] = [];
  for (const d of g.doors.list as any[]) {
    const D = d.def, c = Math.cos(D.closedDir), s = Math.sin(D.closedDir);
    for (const along of [-0.7, D.width + 0.7]) for (const side of [-0.55, 0.55]) {
      const p: Vec3 = [D.hinge[0] + c * along - s * side, 0, D.hinge[1] + s * along + c * side];
      out.push({ p, door: D.name ?? D.id ?? '?' });
    }
  }
  return out;
}
/** take the wall at `p` with Q and push `key` until the peek is full; false = no hold there, or that key finds no open end */
function peekAt(W: any, steps: (n: number, each?: () => void) => void, p: Vec3, key: string, rifle = false): boolean {
  const g = W.game, pl = g.player; W.input.keys.clear(); W.input.pressed.clear();
  if (pl.wall) { W.input.pressed.add('KeyQ'); steps(20); }
  g.teleportPlayer(v3.copy(p)); pl.crouch = false; if (rifle) { pl.hasRifle = true; pl.slot = 'rifle'; pl.holstered = false; pl.equipT = 0; } steps(rifle ? 20 : 2);
  W.input.pressed.add('KeyQ'); steps(40); if (!pl.wall) return false;
  W.input.keys.add(key); let n = 0; while (n++ < 110 && pl.wall && !(pl.wall.peek >= 0.999)) steps(1);
  return !!pl.wall && pl.wall.peek >= 0.999;   // (the key is left down: the peek is held)
}
/** the spot a peek from here is for: 2.5 m through the opening from where the leaned head would be, clear from there and walled from where he stands */
function through(g: any): { eye: Vec3; far: Vec3; behind: Vec3 } | null {
  const pl = g.player, w = pl.wall, c = pl.char.pos, y = 1.55, d = c[0] * w.n[0] + c[2] * w.n[2] - w.d;
  const toEnd = w.peekDir > 0 ? w.hi - w.u : w.u - w.lo, r = (toEnd + PEEKSIGHT.out) * w.peekDir, q = d - PEEKSIGHT.off;
  const eye: Vec3 = [c[0] + w.along[0] * r - w.n[0] * q, y, c[2] + w.along[2] * r - w.n[2] * q], own: Vec3 = [c[0], y, c[2]];
  const far: Vec3 = [eye[0] - w.n[0] * 2.5, y, eye[2] - w.n[2] * 2.5];
  // hard behind his own wall: 0.7 m past the plane he leans on, 1.5 m back along it from where he stands, away from the end he peeks round
  const behind: Vec3 = [c[0] - w.n[0] * (d + 0.7) - w.along[0] * w.peekDir * 1.5, y, c[2] - w.n[2] * (d + 0.7) - w.along[2] * w.peekDir * 1.5];
  const stands = (p: Vec3) => !g.col.segmentBlocked([p[0], 0.3, p[2]], [p[0], 1.7, p[2]]);   // (open floor, room for a man)
  if (g.col.segmentBlocked(own, eye) || g.col.segmentBlocked(eye, far) || !g.col.segmentBlocked(own, far) || !g.col.segmentBlocked(own, behind)) return null;
  if (!stands(far) || !stands(behind)) return null;
  return { eye, far, behind };
}

export async function peekSight(): Promise<boolean> {
  const title = 'peek-sight: a peek round the end of a wall lifts the fog of war as a head leaned round it would see';
  console.log(`\n=== ${title} ===`); let all = true;
  const verdict = (ok: boolean, label: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  await stand(80);   // (the stand's own values are on the tables from the first game it stands up: read them after one)
  const onWas = PEEKSIGHT.on, stood = PEEKSIGHT.on, stickyWas = SC.STICKY.on, qfWas = QF.QUIETFOG.on, defWas = QF.QUIETFOG.def, coneWas = FOG.cone, ownWas = FOG.own, rnd = Math.random;
  const games: any[] = [];
  try {
    const { W, g, steps } = await floor(81), fog = g.fogOfWar, pl = g.player; games.push(g); PEEKSIGHT.on = !BREAK;
    // a doorway to peek round, found with the real keys
    let spot: Spot | null = null, T: ReturnType<typeof through> = null, tried = 0;
    search: for (const st of stations(g)) for (const key of KEYS) { tried++; if (peekAt(W, steps, st.p, key)) { T = through(g); if (T) { spot = { ...st, key }; break search; } } }
    verdict(fog.active && !!FOG.cone && !!spot, 'the police post, quiet, under the fog\'s cones: back to the wall beside an open doorway, pushed into its end, the peek is full', spot ? `beside door '${spot.door}' at (${f2(spot.p[0])}, ${f2(spot.p[2])}) with ${spot.key} · ${tried} tries` : `fog ${fog.active} · cone ${FOG.cone} · no station found in ${tried} tries`);
    if (spot && T) {
      const w = pl.wall;
      const alongOf = (p: number[]) => (p[0] * w.along[0] + p[2] * w.along[2]) * w.peekDir, endAt = w.peekDir > 0 ? w.hi : -w.lo;
      const read = () => { steps(3); const e = fog.eyes[0]; return { e, past: alongOf(e.at) - endAt, far: fog.spotSeen(T!.far[0], T!.far[2]), behind: fog.spotSeen(T!.behind[0], T!.behind[2]) }; };
      const up = read(); PEEKSIGHT.on = false; const dn = read(); PEEKSIGHT.on = !BREAK; steps(3);
      const offOf = (p: number[]) => p[0] * w.n[0] + p[2] * w.n[2] - w.d, short0 = PEEK_STATS.short;
      verdict(Math.abs(up.past - PEEKSIGHT.out) < 0.02 && Math.abs(offOf(up.e.at) - PEEKSIGHT.off) < 0.02 && dn.past < -0.2 && offOf(dn.e.at) > 0.3 && v3.dist(up.e.at, up.e.pos) < 1e-6 && up.e.id === pl.char.id && Math.abs(up.e.at[1] - dn.e.at[1]) < 1e-6,
        'with the switch up his eye for the fog stands past the end of the wall and by the frame, as the knobs say, on his own side of the wall\'s plane and at his own eye height; down it is over his feet, behind the end', `past the end: up ${f2(up.past)} m (out ${PEEKSIGHT.out}) · down ${f2(dn.past)} m · off the plane: up ${f2(offOf(up.e.at))} m (off ${PEEKSIGHT.off}) · down ${f2(offOf(dn.e.at))} m`);
      const lookIn = -(up.e.look[0] * w.n[0] + up.e.look[2] * w.n[2]), lookOn = (up.e.look[0] * w.along[0] + up.e.look[2] * w.along[2]) * w.peekDir, dnIn = -(dn.e.look[0] * w.n[0] + dn.e.look[2] * w.n[2]);
      verdict(lookIn > 0.95 && Math.abs(lookOn) < 0.3 && dnIn < 0.2, 'up, it looks square through the opening; down, it looks off the wall into the room he stands in', `up: ${f2(lookIn)} through the wall's plane, ${f2(lookOn)} on along it · down: ${f2(dnIn)} through the plane`);
      verdict(up.far && !dn.far && !up.behind && !dn.behind, 'the floor 2.5 m through the doorway is seen with the switch up and not down; open floor hard behind the wall he leans on is seen neither way (no more than a head round the frame)', `through the doorway: up ${up.far}, down ${dn.far} · behind his wall: up ${up.behind}, down ${dn.behind}`);
      // a man standing there
      const gd = (g.guards as any[]).find(x => x.state !== 'dead' && x.team !== 'operative'), was = gd ? v3.copy(gd.char.pos) : null;
      if (gd) { gd.char.pos = [T.far[0], 0, T.far[2]]; steps(20); }
      const manUp = gd ? fog.seen(gd) : false; PEEKSIGHT.on = false; steps(30); const manDn = gd ? fog.seen(gd) : true; PEEKSIGHT.on = !BREAK; steps(3);
      verdict(!!gd && manUp && !manDn, 'a guard standing down the way through the doorway is in the picture while he peeks with the switch up, and is not with it down', gd ? `${gd.callsign}: up ${manUp} · down ${manDn}` : 'no guard on the floor');
      // his own head: on the wall, behind its end — what the guards' eyes go by
      const head = pl.char.bones.head, headPast = head ? alongOf(head) - endAt : NaN, headOff = head ? offOf(head) : NaN;
      verdict(!!head && headPast < 0 && headOff > 0, 'his own head stays where it was: on the room side of the wall, short of its end (the guards\' eyes go by it, not by the fog\'s)', `head ${f2(-headPast)} m short of the end, ${f2(headOff)} m off the face`);
      // crouched: the eye at the crouch's height, the same place by the frame; and nothing stood in the lean's way at this open door
      pl.crouch = true; steps(20); const lowUp = fog.eyes[0], stillOn = !!pl.wall && pl.wall.peek >= 0.999; PEEKSIGHT.on = false; steps(3); const lowDn = fog.eyes[0]; PEEKSIGHT.on = !BREAK; pl.crouch = false; steps(20);
      verdict(stillOn && Math.abs(lowUp.at[1] - lowDn.at[1]) < 0.03 && lowDn.at[1] < up.e.at[1] - 0.3 && Math.abs(alongOf(lowUp.at) - endAt - PEEKSIGHT.out) < 0.02 && PEEK_STATS.short === short0,
        'crouched on the wall the peek\'s eye is at the crouch\'s own height, by the frame all the same; nothing stopped the lean short at this open door', `eye height standing ${f2(up.e.at[1])} · crouched: up ${f2(lowUp.at[1])}, down ${f2(lowDn.at[1])} · past the end ${f2(alongOf(lowUp.at) - endAt)} m · stopped short ${PEEK_STATS.short - short0}`);
      // let go of the key: the peek eases out and the eye is his own again
      W.input.keys.clear(); steps(40); const e2 = fog.eyes[0], home = Math.hypot(e2.at[0] - pl.char.pos[0], e2.at[2] - pl.char.pos[2]);
      verdict(!!pl.wall && pl.wall.peek === 0 && home < 1e-6, 'the key let go: the peek eases out and his eye is over his feet again', `peek ${pl.wall?.peek} · eye ${f2(home)} m from his feet`);
      if (gd && was) gd.char.pos = was;
      // the same run by digest down and up, the guards live and one of them down the way: nobody sees him for it
      const run = async (on: boolean) => {
        const F = await floor(83); games.push(F.g); PEEKSIGHT.on = on; Math.random = seeded(4242);
        const ok = peekAt(F.W, F.steps, spot!.p, spot!.key), TT = ok ? through(F.g) : null, g2 = (F.g.guards as any[]).find(x => x.state !== 'dead' && x.team !== 'operative');
        if (g2 && TT) g2.char.pos = [TT.far[0], 0, TT.far[2]];
        F.g.aiEnabled = true; F.g.godMode = false; const f0 = PEEK_STATS.frames; F.steps(240);
        return { h: hashDigest(digestGame(F.g, true)), ok, peeked: PEEK_STATS.frames - f0 };
      };
      const a = await run(false), b = await run(!BREAK);
      verdict(a.ok && b.ok && a.h === b.h && a.peeked === 0 && b.peeked > 200, 'four seconds of the peek held with the guards live and a man down the way: the same run by digest with the switch down and up', `down ${a.h} (peek frames ${a.peeked}) · up ${b.h} (peek frames ${b.peeked})`);
    }
    // the rifle stack (wallsnap): he really steps out round the end with the rifle up — the head's place is measured from where he stands, the look stays the rifle's
    if (spot) {
      const snapWas = WALLSNAP.on; try {
        const F = await floor(85); games.push(F.g); WALLSNAP.on = true; PEEKSIGHT.on = !BREAK; const p2 = F.g.player, fog2 = F.g.fogOfWar;
        const ok = peekAt(F.W, F.steps, spot.p, spot.key, true), w2 = p2.wall; F.steps(30);
        if (ok && w2) {
          const al = (p: number[]) => (p[0] * w2.along[0] + p[2] * w2.along[2]) * w2.peekDir, end2 = w2.peekDir > 0 ? w2.hi : -w2.lo;
          const eU = fog2.eyes[0], feet = al(p2.char.pos) - end2; PEEKSIGHT.on = false; F.steps(2); const eD = fog2.eyes[0]; PEEKSIGHT.on = !BREAK;
          const past = al(eU.at) - end2, same = eU.look[0] * eD.look[0] + eU.look[2] * eD.look[2];
          // (the step-out itself wants a target under the cursor: ask the rule directly of his own eye moved 0.6 m out along the wall, as the stack's lean moves him)
          const k = 0.6 * w2.peekDir, out6: Vec3 = [eD.at[0] + w2.along[0] * k, eD.at[1], eD.at[2] + w2.along[2] * k], e6 = PEEKSIGHT.on ? peekEye(F.g, { ...eD, at: out6, pos: out6 }) : null, past6 = e6 ? al(e6.at) - end2 : NaN;
          verdict(w2.kind === 'stack' && Math.abs(past - PEEKSIGHT.out) < 0.02 && Math.abs(past6 - PEEKSIGHT.out) < 0.02 && same > 0.999,
            'on the rifle stack, stepped out round the same end: the eye is no further past the end than the knob says (his step-out is not counted twice) and looks where his rifle does', `hold '${w2.kind}' (rifle up ${p2.rifleUp}, slot ${p2.slot}, holstered ${p2.holstered}, takeT ${w2.takeT}) · his feet ${f2(feet)} m past the end, stepped out ${f2(w2.leanOff ?? 0)} m · the eye ${f2(past)} m past it (out ${PEEKSIGHT.out}) · stepped 0.6 m out along the wall: the eye ${f2(past6)} m past it · look against his own ${f2(same)}`);
        } else verdict(false, 'on the rifle stack, stepped out round the same end: the eye is no further past the end than the knob says and looks where his rifle does', `the stack\'s peek did not come in: hold ${w2 ? `'${w2.kind}' peek ${f2(w2.peek)}` : 'none'} · rifle up ${p2.rifleUp}`);
      } finally { WALLSNAP.on = snapWas; }
    }
    // the two stands' row, the word, and a recording from before the table
    const s = (await import(`${ROOT}/src/host/standEnv.ts`)).STAND_ENV as string[], PR = await import(`${ROOT}/src/host/profile.ts`), JR = await import(`${ROOT}/src/game/journal.ts`);
    const shipped = process.env.TPS_PROFILE === 'shipped';
    verdict(stood === (shipped || process.env.TPS_PEEKSIGHT === '1'), 'as the stand stands a game up: the switch up on the shipped stand, down on the frozen one unless its word raises it', `${shipped ? 'shipped' : 'frozen'} stand: on ${stood}`);
    const W2 = await stand(84); PEEKSIGHT.on = true; const snapUp = JSON.parse(JSON.stringify(JR.knobsSnapshot(W2.game))), old = JSON.parse(JSON.stringify(snapUp)); const had = !!snapUp.tables.PEEKSIGHT;
    PEEKSIGHT.on = false; JR.applyKnobs(W2.game, snapUp); const kept = PEEKSIGHT.on; delete old.tables.PEEKSIGHT; PEEKSIGHT.on = true; JR.applyKnobs(W2.game, old); const before = PEEKSIGHT.on;
    verdict(s.includes('TPS_PEEKSIGHT') && PR.FROZEN_HOLDS['PEEKSIGHT.on'] === 'TPS_PEEKSIGHT=1' && had && kept === true && before === false, 'the switch is a row of the two stands\' list with its word, rides a recording\'s tables, and a recording from before the table replays with it down', `STAND_ENV ${s.includes('TPS_PEEKSIGHT')} · FROZEN_HOLDS ${PR.FROZEN_HOLDS['PEEKSIGHT.on']} · in the tables ${had} · an old recording: on ${before} · one recorded with it up: on ${kept}`);
  } catch (e) { verdict(false, 'the check ran', String((e as Error)?.stack ?? e)); }
  finally { for (const g of games) try { await hushed(() => quitScenario(g)); } catch { /* never started */ } PEEKSIGHT.on = onWas; SC.STICKY.on = stickyWas; QF.QUIETFOG.on = qfWas; QF.QUIETFOG.def = defWas; FOG.cone = coneWas; FOG.own = ownWas; Math.random = rnd; }
  console.log(`=== peek-sight: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}
if (import.meta.main) { const ok = await peekSight(); process.exit(ok ? 0 : 1); }
