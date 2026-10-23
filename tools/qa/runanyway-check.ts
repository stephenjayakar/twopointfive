// A MAN WHO HAS DROPPED HIS GUN RUNS FOR IT NO MATTER WHAT (src/game/runner.ts RUNNER.anyway; from a recorded game on the block: a man who dropped it in the
// east room took the corner for good with the fire exit two shut doors away — a sound he had placed in the only doorway and a mate's word about a man
// since shot walled the room off like men in his eyes. The maintainer: 'i think in this case he could have pathed to the exit?' — 'if a guy gives up he
// should drop his gun (including pistol) and just run for it no matter what').
//   bun run tools/qa/runanyway-check.ts        (or: bun run tools/qa/probes.ts runanyway)        exit 0 = every line PASS, 1 = a FAIL line
// Headless, the block with its room clear staged, every other man parked blind and deaf out of the way. The one man (a rifleman where the floor has one)
// is put where the recorded man stood (32.0, 4.9) and his picture is given what the recorded man's held: an enemy believed IN the room's only doorway
// (33.3, 12.0) and one believed inside the room (29.8, 8.3), neither true; nobody tells anybody anything else (PICTURE.tellSecs, PICTURE.shot: a parked
// man's blind burst is no word to him). The check sets the rules it needs (the nerve rule, the runner, the pictures and the run by picture) on either stand.
//   off        the key off: he goes to the corner and stays low there, as it was
//   on         the key on: he runs for the outside — by the room's door and the fire exit — and is gone
//   in the way two enemies TRULY there (the run planned on the true places): one in the room's only doorway, one inside the room — the corner with the key
//              off, the run past them with it on
//   free       an idea that is NOT on his way out: the same run with the key on as off, never the second look
//   truth      with the run planned on the true places (PICTURE.run off) and nobody truly in the way, the key changes nothing
//   settles    gone low with every try spent and the way open: he stays for good with the key off, is up and gone with it on
//   both guns  a rifleman: his rifle AND the pistol off his thigh lie on the floor with the key on and his thigh is drawn empty; the rifle alone with it off
//   checkpoint a run for it rides the runner's checkpoint slice onto a fresh roster as one
//   journal    a recording from before the key replays with it off
//   the flag   the page opens with it on, ?runanyway=0 takes it out, the frozen stand's row names TPS_RUNANYWAY=1
// RUNANYWAY_BREAK=1: the key is left off where the lines want it on — red.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
type Vec3 = [number, number, number];
const BREAK = process.env.RUNANYWAY_BREAK === '1';

export async function runanywayCheck(): Promise<boolean> {
  const { standUp, ROOT } = await import('./headless.ts');
  const { RUNNER, RUNNER_STATS, runnerBreak, runnerOf, runnerBare, runnerSnapshot, runnerRestore } = await import(`${ROOT}/src/game/runner.ts`);
  const { MORALE } = await import(`${ROOT}/src/game/morale.ts`);
  const { handProps, hiddenProps, killGuard } = await import(`${ROOT}/src/game/combat.ts`);
  const PROFILE = await import(`${ROOT}/src/host/profile.ts`);
  const { PICTURE, pictureTell, ideasOf } = await import(`${ROOT}/src/game/picture.ts`);
  const { knobsSnapshot, applyKnobs } = await import(`${ROOT}/src/game/journal.ts`);
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
  const DT = 1 / 60, K = RUNNER, f1 = (x: number) => Number.isFinite(x) ? x.toFixed(1) : '—', at = (p: number[] | null | undefined) => p ? `(${f1(p[0])}, ${f1(p[2])})` : '—';
  let failed = false; const line = (ok: boolean, s: string) => { if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}`); };
  const quiet = async <R>(fn: () => Promise<R> | R): Promise<R> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => {}; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
  const was = { ...K }, pic0 = { ...PICTURE }, nerve0 = MORALE.on, stats0 = { ...RUNNER_STATS };
  const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
  const HIS: Vec3 = [32.0, 0, 4.9], DOOR: Vec3 = [33.3, 0, 12.0], INSIDE: Vec3 = [29.8, 0, 8.3], FAR: Vec3 = [8.6, 0, 13.9];
  const level = () => loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', 'block.json'), 'utf8')));
  /** the block, the rules as asked, the one man where the recorded man stood with nothing in his head; everybody else parked */
  const world = async (open: boolean, byPicture = true) => {
    const W: any = await quiet(async () => { const X: any = await standUp({ seed: 3, level: level() }); startFromQuery(X.game, 'levelFile=block.json&roomclear&squad=4'); return X; });
    const g = W.game; Object.assign(K, was); Object.assign(PICTURE, pic0); MORALE.on = true; K.on = true; PICTURE.on = true; PICTURE.run = byPicture; PICTURE.tellSecs = 1e9; PICTURE.shot = false; K.anyway = open && !BREAK;   // AFTER standUp: the stand-up line would otherwise write them back
    for (const k of Object.keys(RUNNER_STATS)) (RUNNER_STATS as any)[k] = 0;
    g.godMode = true; const vis = 0.02;
    const hs = g.guards.filter((x: any) => x.team === 'hostile' && x.state !== 'dead'), A = hs.find((x: any) => x.weapon.def.drop === 'rifle') ?? hs[0], op = g.guards.find((x: any) => x.team === 'operative');
    for (const o of g.guards) { if (o === A) continue; o.hold = true; o.pinned = true; o.dazzledUntil = 1e9; o.heardUpTo = 1e12; if (o.team === 'hostile') { o.char.pos = [5 + hs.indexOf(o), 0, 30]; o.char.vel = [0, 0, 0]; o.path = []; o.pathGoal = null; } }
    let keep: (() => void) | null = null; const step = (n = 1, each?: () => void) => { for (let i = 0; i < n; i++) { g.player.visibility = vis; keep?.(); W.step(DT); each?.(); } };
    A.char.pos = [...HIS]; A.char.vel = [0, 0, 0]; A.path = []; A.pathGoal = null; A.script = null; A.dazzledUntil = 1e9; A.heardUpTo = 1e12; g.teleportPlayer(FAR); step(5);
    /** he breaks now; `secs` on: what the runner made of him */
    const run = (secs = 25) => {
      const rifle = A.weapon.def.drop === 'rifle', broke = runnerBreak(g, A); let bold = false, first: Vec3 | null = null, low = false, goneAt = NaN, lowAt: Vec3 | null = null; const t0 = g.time;
      step(secs * 60, () => { const R: any = runnerOf(A); if (!R) return; if (R.bold) bold = true; if (!first && R.fled && R.goal) first = [...R.goal] as Vec3;
        if (R.phase === 'low') { low = true; lowAt = R.goal ? [...R.goal] as Vec3 : null; } if (isNaN(goneAt) && (R.phase === 'gone' || !g.guards.includes(A))) goneAt = g.time - t0; });
      const mine = (kind: string) => g.items.items.filter((it: any) => it.kind === kind && it.who === A.char.id).length;
      return { broke, bold, rifle, rifles: mine('rifle'), pistols: mine('pistol'), bare: runnerBare(A) as boolean, first: first as Vec3 | null, low, lowAt: lowAt as Vec3 | null, goneAt, end: [...A.char.pos] as Vec3, here: g.guards.includes(A) as boolean, phase: (runnerOf(A) as any)?.phase as string | undefined, stats: { ...RUNNER_STATS } };
    };
    /** an enemy teammate stood at `p` and kept there (the page's stand walks a teammate after the player) */
    const stand = (p: Vec3) => { keep = () => { op.char.pos = [...p]; op.char.vel = [0, 0, 0]; op.path = []; op.pathGoal = null; }; };
    return { W, g, A, op, step, run, stand };
  };
  /** the recorded man's picture: an enemy believed in the doorway, one believed in the room */
  const guesses = (s: any) => { pictureTell(s.g, s.A, 'player', DOOR); pictureTell(s.g, s.A, s.op, INSIDE); };
  const how = (s: any) => ideasOf(s.g, s.A).map((I: any) => `${I.how} ${at(I.at)}`).join(', ');

  try {
    // ------------------------------------------------------------ the recorded case, off and on
    { const s = await world(false); guesses(s); const had = how(s), R = s.run();
      line(R.broke && R.low && !R.bold && R.stats.out === 0 && R.here && flat(R.end, HIS) < 6 && isNaN(R.goneAt),
        `the key off, his picture [${had}]: he drops it and goes to the corner ${at(R.lowAt)}, low there 25 s on at ${at(R.end)} — out ${R.stats.out}, the second look ${R.stats.bold}, as it was`); }
    { const s = await world(true); guesses(s); const R = s.run();
      line(R.broke && R.bold && R.stats.bold >= 1 && !R.low && !!R.first && flat(R.first, [38.3, 0, 14.3]) < 2.5 && R.goneAt < 20 && !R.here,
        `the key on, the same picture: he runs for the outside at ${at(R.first)} — by the room's door and the fire exit — and is gone ${f1(R.goneAt)} s on (the second look ${R.stats.bold}, the corner ${R.stats.low})`); }
    // ------------------------------------------------------------ no matter what: an enemy truly in the way
    { const P = DOOR; const there = async (open: boolean) => { const s = await world(open, false); s.g.teleportPlayer(P); s.stand(INSIDE); s.step(5); const R = s.run(); return { ...R, alive: s.A.state !== 'dead', opAt: [...s.op.char.pos] as Vec3 }; };
      const a = await there(false), b = await there(true);
      line(a.alive && b.alive && a.low && a.here && !a.bold && a.stats.out === 0 && b.bold && !b.low && !b.here && b.goneAt < 20,
        `the run planned on the true places (PICTURE.run off), an enemy truly standing at ${at(P)} and another inside the room at ${at(b.opAt)} (he lives: ${a.alive && b.alive}): the corner with the key off (${at(a.lowAt)}, out ${a.stats.out}); with it on he runs for it past him and is gone ${f1(b.goneAt)} s on (the second look ${b.stats.bold})`); }
    // ------------------------------------------------------------ a way the whole picture allows: nothing changes
    { const free = async (open: boolean) => { const s = await world(open); pictureTell(s.g, s.A, s.op, INSIDE); return s.run(); };
      const a = await free(false), b = await free(true);
      line(!a.bold && !b.bold && b.stats.bold === 0 && !!a.first && !!b.first && flat(a.first, b.first) < 0.5 && Math.abs(a.goneAt - b.goneAt) < 0.5 &&   // (not to the frame: the second gun's fall takes its own draws of the die)
         !a.here && !b.here,
        `an idea that is not on his way out: out at ${at(b.first)} and gone ${f1(b.goneAt)} s on with the key on, ${at(a.first)} and ${f1(a.goneAt)} s with it off — the same run, never the second look (${b.stats.bold})`); }
    // ------------------------------------------------------------ the true places
    { const s = await world(true, false); guesses(s); const R = s.run();
      line(R.broke && !R.bold && R.stats.bold === 0 && !R.here, `the run planned on the true places (PICTURE.run off) with nobody truly in the way, the key on: out at ${at(R.first)}, gone ${f1(R.goneAt)} s on, never the second look (${R.stats.bold})`); }
    // ------------------------------------------------------------ he never settles
    { const spent = async (open: boolean) => { const s = await world(open, false), { g, A } = s; runnerBreak(g, A); s.step(60);   // (a second on: the gun is down and he is running)
        const R: any = runnerOf(A); R.phase = 'low'; R.tries = 99; R.t = 0; R.goal = [...A.char.pos]; R.script.arrived = true; R.face = A.char.bodyYaw; A.path = []; A.pathGoal = null;   // (…put low where he is, every try at the way out written off as spent)
        let goneAt = NaN; const t0 = g.time; s.step(20 * 60, () => { if (isNaN(goneAt) && ((runnerOf(A) as any)?.phase === 'gone' || !g.guards.includes(A))) goneAt = g.time - t0; });
        return { goneAt, phase: (runnerOf(A) as any)?.phase as string | undefined, here: g.guards.includes(A) as boolean }; };
      const a = await spent(false), b = await spent(true);
      line(a.here && a.phase === 'low' && isNaN(a.goneAt) && !b.here && b.goneAt < 20,
        `a man gone low with every try at the way out spent, and the way open: with the key off he stays for good (${a.phase}, twenty seconds on); with it on he never settles — up at the next look and gone ${f1(b.goneAt)} s on`); }
    // ------------------------------------------------------------ both guns
    { const drawn = (s: any) => { const out: any[] = []; handProps(s.g, out); hiddenProps(s.g, out); return out.length; };   // (every man's kit as combat.ts deals it this frame, the men in the fog too: the two floors differ in his thigh alone)
      const a = await world(false); guesses(a); const Ra = a.run(3), da = drawn(a); const b = await world(true); guesses(b); const Rb = b.run(3), db = drawn(b);
      const dead = (s: any) => { killGuard(s.g, s.A, [0, 0, 1]); s.step(30); return drawn(s); }, ka = dead(a), kb = dead(b);   // (…and shot as he runs: the body's thigh)
      line(Rb.rifle && Ra.rifles === 1 && Ra.pistols === 0 && !Ra.bare && Rb.rifles === 1 && Rb.pistols === 1 && Rb.bare && db < da && kb < ka,
        `a rifleman (${Rb.rifle}) three seconds after he gives up: with the key off his rifle is on the floor (${Ra.rifles}) and the pistol stays on his thigh (on the floor: ${Ra.pistols}); with it on both are down (${Rb.rifles} and ${Rb.pistols}) and his thigh is drawn empty (${Rb.bare}; kit boxes on the floor's men ${da} with the key off, ${db} with it on; shot as he runs, the body's ${ka} and ${kb})`); }
    // ------------------------------------------------------------ the checkpoint
    { const s = await world(true); guesses(s); runnerBreak(s.g, s.A); s.step(120); const R0: any = runnerOf(s.A), snap = JSON.parse(JSON.stringify(runnerSnapshot(s.g) ?? null));   // (the runner's own slice: the block's staged units keep a whole checkpoint off this floor)
      const s2 = await world(true); runnerRestore(s2.g, snap); const R1: any = runnerOf(s2.g.guards[s.g.guards.indexOf(s.A)]);
      line(!!R0?.bold && R0.phase === 'out' && !!R1?.bold && R1.phase === 'out' && !!R0?.bare === !!R1?.bare && (s.A.weapon.def.drop !== 'rifle' || !!R1?.bare), `two seconds into a run for it (${R0?.phase}, no matter what: ${!!R0?.bold}, both guns down: ${!!R0?.bare}), the runner's checkpoint slice written and read onto a fresh roster: ${R1?.phase}, ${!!R1?.bold}, ${!!R1?.bare}`); }
    // ------------------------------------------------------------ the journal
    { const s = await world(true), g = s.g, snap = () => JSON.parse(JSON.stringify(knobsSnapshot(g)));
      K.anyway = true; const old = snap(); delete old.tables.RUNNER.anyway; applyKnobs(g, old); const before = K.anyway;
      K.anyway = false; const own = snap(); own.tables.RUNNER.anyway = true; applyKnobs(g, own); const carried = K.anyway;
      line(before === false && carried === true, `a recording from before the key replays with it off (journal.ts applyKnobs): ${before} · one that carries it keeps its own word: ${carried}`); }
    // ------------------------------------------------------------ the page's flag and the stand's word (last: pageSwitches writes every table)
    { const read = (q: string) => { K.anyway = q !== ''; PROFILE.pageSwitches(new URLSearchParams(q)); return K.anyway as boolean; }, plain = read(''), off = read('runanyway=0'), word = PROFILE.FROZEN_HOLDS['RUNNER.anyway'];
      line(plain === true && off === false && word === 'TPS_RUNANYWAY=1', `the page opens with it on (${plain}) and ?runanyway=0 takes it out (${off}); the frozen stand holds it off and raises it by ${word}`); }
  } catch (err) { line(false, `threw: ${(err as Error)?.stack ?? err}`); }
  finally { Object.assign(K, was); Object.assign(PICTURE, pic0); MORALE.on = nerve0; Object.assign(RUNNER_STATS, stats0); }
  console.log(failed ? '=== runanyway-check: FAIL ===' : '=== runanyway-check: ALL PASS ===');
  return !failed;
}
if (import.meta.main) process.exit((await runanywayCheck()) ? 0 : 1);
