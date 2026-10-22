// ENEMIES STARTLE WHEN THEY FIRST SEE YOU (src/game/startle.ts STARTLE; the maintainer: 'we should also have startle animations when unaware enemies see you
// for the first time. a quick beat and then they pull out their gun or run').
//   bun run tools/qa/startle-check.ts        (or: bun run tools/qa/probes.ts startle)        exit 0 = every line PASS, 1 = a FAIL line
// Headless; nothing here looks at a picture (the jolt itself is asked of the animator as a number, where the motion pass is on). The rule is set by the check
// itself on either stand (the frozen stand holds it off), so the lines hold on both.
//   fault      the rule off: a calm man of the night staff, Sam stepped into plain view four metres in front of him — the frame he knows it is a man his gun
//              is in his hand and coming up, and nothing of this file's is written
//   sight      the rule on, the same step: the torch is still in his hand and nothing is raised from the first glimpse on; the frame he knows, he starts —
//              for STARTLE.beat his feet are still, the torch stays the torch, no round leaves him; then the gun comes up, and that is later than with the
//              rule off by about the beat; he drew (counted), and it happens once: seen again later from calm, he goes for his gun at once
//   aware      a man who was already looking (suspicious for longer than STARTLE.fresh — a noise put him there) and then sees Sam: no start
//   roused     a man taken to alert by a shot he heard, who then sees Sam: no start
//   blind      a man blinded by a stun charge when his eyes find Sam: no start
//   side       one of the player's own men who sees an enemy: no start
//   given      startleMan, the start alone, with the rule OFF: the jolt and the beat, nothing chosen after it, and not a second one inside the first
//   runs       a squad map (the compound's room clear), every defender green: the one caught alone with Sam close starts, then RUNS — off his spot, no round
//              from him meanwhile; the same man trained: he starts, and draws where he stands; the same green man with a mate beside him: he draws
//   checkpoint a man saved inside his beat and loaded into a fresh game is still held to the same clock, and draws after it
//   journal    a recording from before the table replays with the rule off; one that carries it keeps its own word
// STARTLE_BREAK=1: the rule is left off where the lines want it on — red.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
type Vec3 = [number, number, number];
const BREAK = process.env.STARTLE_BREAK === '1';

export async function startleCheck(): Promise<boolean> {
  const { standUp, ROOT } = await import('./headless.ts');
  const { STARTLE, STARTLE_STATS, startled, startleMan, startleHolds, startleSight, startleRunning } = await import(`${ROOT}/src/game/startle.ts`);
  const { handCarry } = await import(`${ROOT}/src/game/guards.ts`);
  const { MOVES } = await import(`${ROOT}/src/game/character.ts`);
  const { MORALE } = await import(`${ROOT}/src/game/morale.ts`);
  const { saveState, loadState } = await import(`${ROOT}/src/game/savestate.ts`);
  const { knobsSnapshot, applyKnobs } = await import(`${ROOT}/src/game/journal.ts`);
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
  const DT = 1 / 60, T = STARTLE; const f2 = (x: number) => Number.isFinite(x) ? x.toFixed(2) : '—';
  let failed = false; const line = (ok: boolean, s: string) => { if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}`); };
  const quiet = async <R>(fn: () => Promise<R> | R): Promise<R> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => {}; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
  const was = { ...T }, train0 = MORALE.training, nerve0 = MORALE.on;
  const zero = () => { for (const k of Object.keys(STARTLE_STATS)) (STARTLE_STATS as any)[k] = 0; };
  const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
  const FAR: Vec3 = [1, 0, 1];
  /** a fresh office night, the rule as asked, every man but the first parked blind and deaf; the first holds where he stands, calm */
  const world = async (on: boolean) => {
    const W: any = await quiet(() => standUp({ seed: 7 })); const g = W.game; T.on = on && !BREAK;   // AFTER standUp: the stand-up line would otherwise write it back
    g.godMode = true; g.guards.forEach((o: any, i: number) => { if (i) { o.hold = true; o.pinned = true; o.dazzledUntil = 1e9; o.heardUpTo = 1e12; } });
    const A = g.guards[0]; A.hold = true; zero();
    let vis = 0.02; const step = (n = 1, each?: () => void) => { for (let i = 0; i < n; i++) { g.player.visibility = vis; W.step(DT); each?.(); } };
    g.teleportPlayer(FAR); step(30);
    /** a free spot `m` metres in front of him with nothing between */
    const ahead = (m: number): Vec3 => { const c = A.char, f = c.forward(); return [c.pos[0] + f[0] * m, 0, c.pos[2] + f[2] * m]; };
    const light = () => { vis = 0.9; }, show = (m = 4) => { g.teleportPlayer(ahead(m)); light(); }, hide = () => { g.teleportPlayer(FAR); vis = 0.02; };
    return { W, g, A, step, show, light, hide, ahead };
  };
  type Run = { alertAt: number; upAt: number; roundAt: number; startAt: number; held: number; torchHeld: boolean; raisedEarly: boolean; movedInBeat: number; shown: number; saidIn: boolean; saidAt: number };
  /** Sam shown in front of him for `secs`: when he went to alert, when the gun was first up after that, his first round, and what the start held */
  const watch = (s: Awaited<ReturnType<typeof world>>, secs: number): Run => {
    const { g, A } = s, c = A.char, t0 = g.time, n0 = A.weapon.shotsFired, p0: Vec3 = [c.pos[0], 0, c.pos[2]];
    const r: Run = { alertAt: NaN, upAt: NaN, roundAt: NaN, startAt: NaN, held: 0, torchHeld: true, raisedEarly: false, movedInBeat: 0, shown: 0, saidIn: false, saidAt: NaN };
    s.step(Math.round(secs * 60), () => {
      const t = g.time - t0, st = startled(g, A);
      if (isNaN(r.alertAt) && A.state === 'alert') r.alertAt = t;
      if (isNaN(r.alertAt) && c.anim.upper === 'aim') r.raisedEarly = true;
      if (st) { if (isNaN(r.startAt)) r.startAt = t; r.held += DT; if (handCarry(A) !== 'torch' || c.anim.upper !== 'none' || !startleHolds(g, A)) r.torchHeld = false; r.movedInBeat = Math.max(r.movedInBeat, flat(c.pos, p0)); r.shown = Math.max(r.shown, c.anim.startleShown); }
      const call = A.bubble?.text === 'CONTACT!'; if (call && st) r.saidIn = true; if (call && isNaN(r.saidAt)) r.saidAt = t;
      if (isNaN(r.upAt) && !isNaN(r.alertAt) && c.anim.upper === 'aim') r.upAt = t;
      if (isNaN(r.roundAt) && A.weapon.shotsFired > n0) r.roundAt = t;
    });
    return r;
  };
  const calm = (s: Awaited<ReturnType<typeof world>>, secs = 40) => { s.hide(); const { g, A } = s; for (let i = 0; i < secs * 60 && A.state !== 'patrol'; i++) { A.awareness = Math.min(A.awareness, 0.05); if (A.state === 'alert' || A.state === 'search') A.state = 'suspicious'; s.step(); } return A.state === 'patrol'; };

  try {
    // ------------------------------------------------------------ the fault, and the first sight with the rule on
    let offUp = NaN;
    { const s = await world(false), { A } = s; const torch0 = handCarry(A) === 'torch'; s.show(); const r = watch(s, 3); offUp = r.upAt;
      line(torch0 && !isNaN(r.alertAt) && isNaN(r.startAt) && r.upAt - r.alertAt < 0.05 && Math.abs(r.saidAt - r.alertAt) < 0.03 && STARTLE_STATS.seen + STARTLE_STATS.given === 0,
        `the rule off — a calm man with his torch, Sam in plain view four metres off: he knows at ${f2(r.alertAt)} s, shouts it at ${f2(r.saidAt)} and his gun is coming up ${f2(r.upAt - r.alertAt)} s after that; no start (${STARTLE_STATS.seen} seen, ${STARTLE_STATS.given} given)`); }
    { const s = await world(true), { A } = s; s.show(); const r = watch(s, 3.5);
      const late = r.upAt - offUp, moves = MOVES.on > 0.5;
      line(!isNaN(r.startAt) && Math.abs(r.startAt - r.alertAt) < 0.03 && !r.raisedEarly && Math.abs(r.held - T.beat) < 0.04 && r.torchHeld && r.movedInBeat < 0.05,
        `the rule on, the same step: nothing raised before he knows (${!r.raisedEarly}); he starts the frame he knows (${f2(r.startAt)} s, alert at ${f2(r.alertAt)}), held ${f2(r.held)} s (the beat's ${f2(T.beat)}) with the torch still in his hand and nothing raised (${r.torchHeld}), feet still (${f2(r.movedInBeat)} m)`);
      line(r.upAt >= r.startAt + T.beat - 0.03 && late > T.beat - 0.15 && late < T.beat + 0.15 && (isNaN(r.roundAt) || r.roundAt >= r.startAt + T.beat - 1e-6) && handCarry(A) === 'weapon' && !r.saidIn && r.saidAt >= r.startAt + T.beat - 0.03 && r.saidAt < r.startAt + T.beat + 0.1,
        `…then the gun comes up, at ${f2(r.upAt)} s: ${f2(late)} s later than with the rule off, and only then does he shout it (${f2(r.saidAt)} s; nothing over his head inside the beat: ${!r.saidIn}); ${isNaN(r.roundAt) ? 'no round inside the watch' : `his first round at ${f2(r.roundAt)} s, after the beat`}`);
      line(STARTLE_STATS.seen === 1 && STARTLE_STATS.drew === 1 && STARTLE_STATS.ran === 0 && (moves ? r.shown > 0.5 : r.shown === 0),
        `counted: ${STARTLE_STATS.seen} startled by what he saw, ${STARTLE_STATS.drew} drew, ${STARTLE_STATS.ran} ran; the animator's jolt ${moves ? `showed (${f2(r.shown)} of it at most)` : 'is the old twitch with the motion pass off, as on this stand'}`);
      const back = calm(s); s.step(60); zero(); s.show(); const again = watch(s, 3);
      line(back && isNaN(again.startAt) && !isNaN(again.alertAt) && STARTLE_STATS.seen === 0, `once a man: calm again and seen again, he knows at ${f2(again.alertAt)} s and does not start (${STARTLE_STATS.seen})`); }

    // ------------------------------------------------------------ who is not surprised
    { const s = await world(true), { g, A } = s; const at = s.ahead(4);
      g.events.push({ kind: 'prop', pos: at, time: g.time, loud: true, level: 0.6 }); s.step(Math.round((T.fresh + 1.2) * 60)); const st = A.state; s.show(); const r = watch(s, 3);
      line(st === 'suspicious' && !isNaN(r.alertAt) && isNaN(r.startAt) && STARTLE_STATS.seen === 0, `a man already looking (a noise had him ${st} for ${f2(T.fresh + 1.2)} s) who then sees Sam: alert at ${f2(r.alertAt)} s, no start`); }
    { const s = await world(true), { g, A } = s; A.awareness = 0.95; s.step(90); const st = A.state; s.show(); const r = watch(s, 2);
      line(st === 'alert' && isNaN(r.startAt) && STARTLE_STATS.seen === 0, `a man roused before he saw anybody (${st}) who then sees Sam: no start`); }
    { const s = await world(true), { g, A } = s; const at = s.ahead(4); A.awareness = 0.95; A.lastKnown = at; s.step(20); const st = A.state; g.teleportPlayer(at); s.light(); const r = watch(s, 2);
      line(st === 'alert' && !isNaN(r.startAt) && STARTLE_STATS.seen === 1, `…but a man roused a third of a second before the man shows (a shot through the door, then the door): he was calm a moment ago, and starts (${f2(r.startAt)} s after he shows)`); }
    { const s = await world(true), { g, A } = s; A.staggerUntil = g.time + 1.5; s.show(); const r = watch(s, 3.5);
      line(!isNaN(r.alertAt) && r.alertAt < 1.5 && isNaN(r.startAt) && STARTLE_STATS.seen === 0, `a man folded over a ring in the body who sees Sam meanwhile (alert at ${f2(r.alertAt)} s, inside its second and a half): no start, then or after`); }
    { const s = await world(true), { g, A } = s; const B = g.guards[1]; B.team = 'operative'; B.foe = null; B.dazzledUntil = -1; B.state = 'patrol'; B.awareness = 0;
      // the seam itself, the same two calls for each: calm on one frame, alert off his own eyes on the next (the enemy is the control: the line is red if he does not start)
      const first = (M: any) => { M.state = 'patrol'; startleSight(g, M, 'patrol', false); M.state = 'alert'; M.sightPos = s.ahead(3); M.sightT = g.time; startleSight(g, M, 'patrol', true); return startled(g, M); };
      const own = first(B), foe = first(A);
      line(!own && foe && STARTLE_STATS.given === 1, `the same first sight handed to one of the player's own men and to an enemy: the enemy starts (${foe}), the player's man does not (${!own})`); }

    // ------------------------------------------------------------ the start alone, for another rule to give
    { const s = await world(false), { g, A } = s, c = A.char; T.on = false; const at = s.ahead(2); const took = BREAK ? false : startleMan(g, A, at, 1.0), twice = startleMan(g, A, at, 1.0);
      let held = 0, down = true; s.step(90, () => { if (startled(g, A)) { held += DT; if (c.anim.upper === 'aim') down = false; } });
      line(took && !twice && Math.abs(held - 1.0) < 0.04 && down && STARTLE_STATS.given === 1 && STARTLE_STATS.drew + STARTLE_STATS.ran + STARTLE_STATS.seen === 0 && A.state === 'patrol',
        `startleMan with the rule off: given ${took}, not a second inside it (${!twice}); held ${f2(held)} s of the 1.00 asked, nothing raised (${down}); nothing chosen after it (drew ${STARTLE_STATS.drew}, ran ${STARTLE_STATS.ran}) and he is still ${A.state}`); }

    // ------------------------------------------------------------ draws, or runs: a squad map
    { const stage = async (training: string, mate: boolean) => {
        MORALE.training = training as any; MORALE.on = true;
        const W: any = await quiet(async () => { const X: any = await standUp({ seed: 3, level: loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', 'compound.json'), 'utf8'))) }); startFromQuery(X.game, 'levelFile=compound.json&roomclear'); return X; });
        const g = W.game; T.on = !BREAK; MORALE.training = training as any; MORALE.on = true; g.godMode = true; zero();
        for (const o of g.guards) if (o.team === 'operative') o.dazzledUntil = 1e9;
        let vis = 0.02; const step = (n = 1, each?: () => void) => { for (let i = 0; i < n; i++) { g.player.visibility = vis; W.step(DT); each?.(); } };
        g.teleportPlayer(FAR); step(20);
        const men = g.guards.filter((x: any) => x.team === 'hostile' && x.state !== 'dead'), M = men[0], c = M.char, f = c.forward(), p0: Vec3 = [c.pos[0], 0, c.pos[2]];
        const line2 = (q: number[]) => !g.col.segmentBlocked([c.pos[0], 1.6, c.pos[2]], [q[0], 1.2, q[2]]);
        const lone = !men.some((o: any) => o !== M && flat(o.char.pos, c.pos) < MORALE.aloneM && line2(o.char.pos));
        if (mate) { const o = men[men.length - 1], q = ([[-f[2], f[0]], [f[2], -f[0]]] as const).map(([x, z]): Vec3 => [c.pos[0] + x * 1.3, 0, c.pos[2] + z * 1.3]).find(line2)!; o.char.pos = q; o.char.vel = [0, 0, 0]; o.path = []; o.pathGoal = null; o.char.update(0); step(5); }
        g.teleportPlayer([c.pos[0] + f[0] * 3.5, 0, c.pos[2] + f[2] * 3.5]); vis = 1; const n0 = M.weapon.shotsFired; let started = false, far = 0;
        step(240, () => { if (startled(g, M)) started = true; far = Math.max(far, flat(c.pos, p0)); });
        return { lone, started, far, rounds: M.weapon.shotsFired - n0, ran: STARTLE_STATS.ran, drew: STARTLE_STATS.drew, seen: STARTLE_STATS.seen };
      };
      const G = await stage('green', false), S = await stage('trained', false), B = await stage('green', true);
      line(G.lone && G.started && G.ran === 1 && G.drew === 0 && G.far > 1.2 && G.rounds === 0, `the compound, every defender green — the first man, alone (${G.lone}), Sam 3.5 m in front of him: he starts (${G.started}), then runs (${G.ran}): ${f2(G.far)} m off his spot inside four seconds, ${G.rounds} rounds from him meanwhile`);
      line(S.started && S.ran === 0 && S.drew === 1 && S.far < 0.3, `the same man trained: he starts (${S.started}) and draws where he stands (drew ${S.drew}, ran ${S.ran}, ${f2(S.far)} m)`);
      line(B.started && B.ran === 0 && B.drew >= 1 && B.far < 0.3, `the same green man with a mate at his shoulder: he starts (${B.started}) and draws (drew ${B.drew}, ran ${B.ran}, ${f2(B.far)} m)`);
      MORALE.training = train0; MORALE.on = nerve0; }
    // …and a man on no post (the night staff): he turns and runs for cover with his hands down, and fights from there
    { MORALE.training = 'green'; MORALE.on = true; const s = await world(true), { g, A } = s, c = A.char; MORALE.training = 'green'; MORALE.on = true; A.hold = false;
      const p0: Vec3 = [c.pos[0], 0, c.pos[2]], n0 = A.weapon.shotsFired; s.show(); let far = 0, runFor = 0, up = false, rounds = 0, ranAt = NaN;
      s.step(360, () => { if (STARTLE_STATS.ran && isNaN(ranAt)) ranAt = g.time; if (startleRunning(A)) { runFor += DT; if (c.anim.upper === 'aim') up = true; rounds = A.weapon.shotsFired - n0; } far = Math.max(far, flat(c.pos, p0)); });
      const off = MORALE.on; MORALE.on = false; const t = await world(true); MORALE.training = 'green'; t.A.hold = false; zero(); t.show(); t.step(240); const steady = STARTLE_STATS.ran === 0 && STARTLE_STATS.drew === 1;
      line(STARTLE_STATS.seen === 1 && !isNaN(ranAt) && far > 1.2 && runFor > 0.3 && !up && rounds === 0 && off && steady,
        `a green night guard caught alone at four metres: he starts, then runs ${f2(far)} m for cover (${f2(runFor)} s of it) with nothing raised (${!up}) and no round on the way (${rounds}); with the nerve rule off the same man draws (${steady})`);
      MORALE.training = train0; MORALE.on = nerve0; }

    // ------------------------------------------------------------ the checkpoint
    { const s = await world(true), { g, A } = s; s.show(); let snap: any = null, until = NaN, t = NaN;
      for (let i = 0; i < 240 && !snap; i++) { s.step(); if (startled(g, A)) { s.step(6); snap = JSON.parse(JSON.stringify(saveState(g))); t = g.time; let n = 0; while (startled(g, A) && n++ < 120) s.step(); until = g.time - t; } }
      const s2 = await world(true), g2 = s2.g; await quiet(() => loadState(g2, snap)); const A2 = g2.guards[0]; zero(); s2.show(); let held = 0, raised = false; const t2 = g2.time;
      s2.step(120, () => { if (startled(g2, A2)) { held += DT; if (A2.char.anim.upper === 'aim') raised = true; } });
      line(!!snap && Math.abs(Math.abs(g2.time - 2 - t2) < 1e-6 ? held - until : NaN) < 0.04 && !raised && STARTLE_STATS.drew === 1,
        `a man saved inside his beat and loaded into a fresh game is held for the ${f2(until)} s that were left of it (${f2(held)}), nothing raised meanwhile (${!raised}), and draws after it (${STARTLE_STATS.drew})`); }

    // ------------------------------------------------------------ the journal
    { const s = await world(true), g = s.g, snap = () => JSON.parse(JSON.stringify(knobsSnapshot(g)));
      T.on = true; const old = snap(); delete old.tables.STARTLE; applyKnobs(g, old); const before = T.on;
      T.on = false; const own = snap(); own.tables.STARTLE.on = true; applyKnobs(g, own); const carried = T.on;
      line(before === false && carried === true, `a recording from before the table replays with the rule off (journal.ts applyKnobs): ${before} · one that carries it keeps its own word: ${carried}`); }
  } catch (err) { line(false, `threw: ${(err as Error)?.stack ?? err}`); }
  finally { Object.assign(T, was); MORALE.training = train0; }
  console.log(failed ? '=== startle-check: FAIL ===' : '=== startle-check: ALL PASS ===');
  return !failed;
}
if (import.meta.main) process.exit((await startleCheck()) ? 0 : 1);
