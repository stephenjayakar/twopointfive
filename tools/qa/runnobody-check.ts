// A MAN WHO HAS RUN IS NOBODY'S ENEMY ON THE BOOKS (src/game/runner.ts RUNNER.nobody; runnerNobody from the drop, runnerMute from the shout). His own script runs
// and nothing else of his does, but every module that walks the roster from outside still met a calm living man in state 'patrol'. The readers mended under the key:
// fogofwar.ts tellCalls (a teammate's 'contact' on him), doortools.ts ('room clear' held back), morale.ts hasMate (a mate beside him was not alone),
// suppression.ts (his bark under fire, and a mate's 'got us pinned' with him as the other man), cues.ts (his side's voice). NO LINE HERE for two
// of the clauses: darkdoor.ts mateBy (the same clause as hasMate, asked only inside the dark room's own move) and fogofwar.ts's 'heard' call (five seconds of his
// run past a teammate with his back turned put no footfall of his in that teammate's ear in this staging, key on or off).
//   bun run tools/qa/runnobody-check.ts        (or: bun run tools/qa/probes.ts runnobody)        exit 0 = every line PASS, 1 = a FAIL line
// Headless, the block with its room clear staged, every other man parked blind and deaf out of the way; one rifleman is broken through the runner's own seam
// and kept where he stands (his legs run on the spot: the lines are about what the others make of him). The check sets the rules it needs on either stand.
//   contact    a teammate with his eyes on him: 'contact' called on him with the key off, nothing with it on
//   room clear the team sent through the door of the room he is low in: nobody calls it clear with the key off, the lead does with it on
//   company    a mate three metres from him with a line: not alone with the key off (morale.ts hasMate), alone with it on
//   bark       rounds past his head: his bark with the key off, nothing with it on
//   pinned     the same rounds past him and a mate beside him: the mate's 'got us pinned' with the key off (he was the other of the 'us'), not with it on
//   voice      his side's cue asked of him: said with the key off, refused with it on
//   (contact, company and voice each carry a man who has NOT broken, the key on: the old answer)
//   journal    a recording from before the key replays with it off
//   the flag   the page opens with it on, ?runnobody=0 takes it out, the frozen stand's row names TPS_RUNNOBODY=1
// RUNNOBODY_BREAK=1: the key is left off where the lines want it on — red.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
type Vec3 = [number, number, number];
const BREAK = process.env.RUNNOBODY_BREAK === '1';

export async function runnobodyCheck(): Promise<boolean> {
  const { standUp, ROOT } = await import('./headless.ts');
  const { RUNNER, runnerBreak, runnerOf, runnerFled, runnerNobody, runnerMute } = await import(`${ROOT}/src/game/runner.ts`);
  const { MORALE, hasMate } = await import(`${ROOT}/src/game/morale.ts`);
  const { noteRound } = await import(`${ROOT}/src/game/suppression.ts`);
  const { FOG } = await import(`${ROOT}/src/game/fogofwar.ts`);
  const { WORDS } = await import(`${ROOT}/src/game/words.ts`);
  const { knobsCopy, knobsBack } = await import(`${ROOT}/src/game/knobs.ts`);
  const PROFILE = await import(`${ROOT}/src/host/profile.ts`);
  const { PICTURE, pictureTell } = await import(`${ROOT}/src/game/picture.ts`);
  const { knobsSnapshot, applyKnobs } = await import(`${ROOT}/src/game/journal.ts`);
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
  const DT = 1 / 60, K = RUNNER;
  let failed = false; const line = (ok: boolean, s: string) => { if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}`); };
  const quiet = async <R>(fn: () => Promise<R> | R): Promise<R> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => {}; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
  const all0 = knobsCopy(), was = { ...K }, pic0 = { ...PICTURE };   // (all0: the last line writes every table through the page's switches; put back whole)
  const HIS: Vec3 = [32.0, 0, 4.9], MATE: Vec3 = [29.6, 0, 6.2], DOOR: Vec3 = [33.3, 0, 12.0], INSIDE: Vec3 = [29.8, 0, 8.3], FAR: Vec3 = [8.6, 0, 13.9];
  const level = () => loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', 'block.json'), 'utf8')));
  /** the block, the rules as asked; one rifleman (`A`) at his place, a second defender (`B`) and a teammate (`op`) to stand by him, everybody else parked.
   *  `broken`: A is broken now and a second run on (the gun is down, he is the runner's); `kept`: he is held on his spot from then on */
  const world = async (open: boolean, broken = true, kept = true) => {
    const W: any = await quiet(async () => { const X: any = await standUp({ seed: 3, level: level() }); startFromQuery(X.game, 'levelFile=block.json&roomclear&squad=4'); return X; });
    const g = W.game; Object.assign(K, was); Object.assign(PICTURE, pic0); MORALE.on = true; K.on = true; K.anyway = false; K.nobody = open && !BREAK; PICTURE.on = true; PICTURE.run = true; PICTURE.shot = false; PICTURE.tellSecs = 1e9; FOG.calls = true; FOG.cone = false; FOG.own = true; WORDS.on = true;   // AFTER standUp: the stand-up line would otherwise write them back
    g.godMode = true;
    const hs = g.guards.filter((x: any) => x.team === 'hostile' && x.state !== 'dead'), A = hs.find((x: any) => x.weapon.def.drop === 'rifle') ?? hs[0], B = hs.find((x: any) => x !== A), op = g.guards.find((x: any) => x.team === 'operative');
    const park = (o: any, p?: Vec3) => { o.hold = true; o.pinned = true; o.dazzledUntil = 1e9; o.heardUpTo = 1e12; if (p) { o.char.pos = [...p]; o.char.vel = [0, 0, 0]; o.path = []; o.pathGoal = null; } };
    for (const o of g.guards) if (o !== A) park(o, o.team === 'hostile' ? [5 + hs.indexOf(o), 0, 30] : undefined);
    const keeps: (() => void)[] = []; const stand = (o: any, p: Vec3, face?: Vec3) => keeps.push(() => { o.char.pos = [...p]; o.char.vel = [0, 0, 0]; o.path = []; o.pathGoal = null; if (face) o.char.bodyYaw = o.char.aimYaw = Math.atan2(face[0] - p[0], face[2] - p[2]); });
    const step = (n = 1, each?: () => void) => { for (let i = 0; i < n; i++) { g.player.visibility = 0.02; for (const k of keeps) k(); W.step(DT); each?.(); } };
    A.char.pos = [...HIS]; A.char.vel = [0, 0, 0]; A.path = []; A.pathGoal = null; A.script = null; A.dazzledUntil = 1e9; A.heardUpTo = 1e12; g.teleportPlayer(FAR); step(5);
    let broke = true; if (broken) { broke = runnerBreak(g, A); step(60); } if (kept) stand(A, HIS);
    return { W, g, A, B, op, hs, step, stand, park, broke, fled: runnerFled(A) as boolean };
  };
  try {
    // ------------------------------------------------------------ contact
    { const calls = async (open: boolean, broken = true) => { const s = await world(open, broken), { g, A, op } = s; const at = MATE;
        op.dazzledUntil = 0; s.stand(op, at, HIS); g.fogOfWar.callLog.length = 0; s.step(180);
        return { fled: s.fled, n: g.fogOfWar.callLog.filter((c: any) => c.of === A.callsign && c.kind === 'contact').length as number, alive: A.state !== 'dead' }; };
      const a = await calls(false), b = await calls(true), c = await calls(true, false);
      line(a.fled && b.fled && a.n >= 1 && b.n === 0 && c.n >= 1,
        `a teammate three metres off with a line to a man who has dropped his gun, three seconds: with the key off he calls contact on him (${a.n}); with it on he says nothing (${b.n}) · on a man who has NOT broken, the key on: ${c.n} (he lives through it: ${a.alive}, ${b.alive})`); }
    // ------------------------------------------------------------ room clear
    { const entry = async (open: boolean) => { const s = await world(open, false, false), { g, A } = s; const O: any = g.orders, RC: any = g.roomClear, d = g.doors.byName('b_s');
        pictureTell(g, A, 'player', DOOR); pictureTell(g, A, s.op, INSIDE); runnerBreak(g, A); s.step(8 * 60);   // (the recorded man's picture, the older rule: he is low in the room's corner)
        const low = (runnerOf(A) as any)?.phase === 'low', room = RC.roomAt(A.char.pos), team = g.guards.filter((x: any) => x.team === 'operative');
        team.forEach((o: any, k: number) => { o.hold = false; o.pinned = false; o.dazzledUntil = 0; o.heardUpTo = 0; o.char.pos = [31.5 + k * 0.9, 0, 13.9]; o.char.vel = [0, 0, 0]; o.path = []; o.pathGoal = null; }); g.teleportPlayer([30, 0, 13.9]); s.step(30);
        const why = O.give('openClear', O.targetAt(d.frameCentre), 'all'); let text = ''; const heard = new Set<string>();
        s.step(60 * 40, () => { for (const o of team) { const b = o.bubble; if (b) { heard.add(b.text); if (!text && / clear\.$/.test(b.text)) text = b.text; } } });
        return { why: why as string | null, low, room: room as string | null, text, aLives: A.state !== 'dead', inRoom: RC.roomAt(A.char.pos) === room }; };
      const a = await entry(false), b = await entry(true);
      line(!a.why && !b.why && a.low && b.low && a.aLives && b.aLives && a.inRoom && b.inRoom && a.text === '' && / clear\.$/.test(b.text),
        `the team sent through the door of the room he is low in (${b.room}), forty seconds: with the key off nobody calls it clear ("${a.text}"); with it on the lead does ("${b.text}") — and he is alive in it both times`); }
    // ------------------------------------------------------------ company
    { const company = async (open: boolean, broken = true) => { const s = await world(open, broken), { g, A, B } = s; s.stand(B, MATE, HIS); s.step(20);
        return { mate: hasMate(g, B) as boolean, nobody: runnerNobody(A) as boolean }; };
      const a = await company(false), b = await company(true), c = await company(true, false);
      line(a.mate && !a.nobody && !b.mate && b.nobody && c.mate && !c.nobody,
        `a mate three metres from him with a line: not alone with the key off (${a.mate}), alone with it on (${!b.mate}) · beside a man who has NOT broken, the key on, he has his mate (${c.mate})`); }
    // ------------------------------------------------------------ bark
    { const bark = async (open: boolean) => { const s = await world(open), { g, A } = s; const t0 = A.sup.barkT, c = A.char;
        for (let i = 0; i < 12; i++) { const C: Vec3 = c.bones.chest ?? [c.pos[0], c.pos[1] + 1.1, c.pos[2]]; noteRound(g, g.player.char, [C[0] + 0.3, C[1], C[2] + 8], [C[0] + 0.3, C[1], C[2] - 6], null); s.step(6); }
        s.step(120); return { barked: A.sup.barkT !== t0 || !!A.sup.pending, v: A.sup.v as number, mute: runnerMute(A) as boolean }; };
      const a = await bark(false), b = await bark(true);
      line(a.barked && !a.mute && !b.barked && b.mute, `twelve rounds a hand's breadth past his chest: with the key off he barks about the fire (${a.barked}); with it on he says nothing (${!b.barked})`); }
    // ------------------------------------------------------------ pinned (the mate's line, with him as the other man of the 'us')
    { const pinned = async (open: boolean) => { const s = await world(open), { g, A, B } = s; s.stand(B, MATE, HIS); B.hold = false; B.pinned = false; B.script = null; let us = false; const all = new Set<string>();
        const past = (c: any) => { const C: Vec3 = c.bones.chest ?? [c.pos[0], c.pos[1] + 1.1, c.pos[2]]; noteRound(g, g.player.char, [C[0] + 0.3, C[1], C[2] + 8], [C[0] + 0.3, C[1], C[2] - 6], null); };
        for (let i = 0; i < 30 && !us; i++) { past(A.char); past(B.char); s.step(4, () => { const b = B.bubble; if (b) { all.add(b.text); if (/got us pinned/.test(b.text)) us = true; } }); }
        return { us, bPinned: g.time - B.sup.pinnedAt < 60, aPinned: g.time - A.sup.pinnedAt < 60, all: [...all].join(' | ') }; };
      const a = await pinned(false), b = await pinned(true);
      line(a.us && !b.us && a.bPinned && b.bPinned, `rounds past him and past a mate three metres off: with the key off the mate shouts that they've got US pinned (${a.us}); with it on the mate is pinned (${b.bPinned}) and says his own line ("${b.all}")`); }
    // ------------------------------------------------------------ voice
    { const voice = async (open: boolean, broken = true) => { const s = await world(open, broken), { g, A } = s; s.step(120); A.dazzledUntil = 0; const C: any = g.cues;   // (his eyes are his own again: a blinded man is nobody's voice either)
        return { fit: C.fit(A) as boolean, said: C.cue(A, 'help') as boolean }; };
      const a = await voice(false), b = await voice(true), c = await voice(true, false);
      line(a.fit && a.said && !b.fit && !b.said && c.fit && c.said, `his side's cue asked of him (cues.ts): fit to speak ${a.fit} and said ${a.said} with the key off; ${b.fit} and ${b.said} with it on · a man who has NOT broken, the key on: ${c.fit} and ${c.said}`); }
    // ------------------------------------------------------------ the journal
    { const s = await world(true), g = s.g, snap = () => JSON.parse(JSON.stringify(knobsSnapshot(g)));
      K.nobody = true; const old = snap(); delete old.tables.RUNNER.nobody; applyKnobs(g, old); const before = K.nobody;
      K.nobody = false; const own = snap(); own.tables.RUNNER.nobody = true; applyKnobs(g, own); const carried = K.nobody;
      line(before === false && carried === true, `a recording from before the key replays with it off (journal.ts applyKnobs): ${before} · one that carries it keeps its own word: ${carried}`); }
    // ------------------------------------------------------------ the page's flag and the stand's word (last: pageSwitches writes every table)
    { const read = (q: string) => { K.nobody = q !== ''; PROFILE.pageSwitches(new URLSearchParams(q)); return K.nobody as boolean; }, plain = read(''), off = read('runnobody=0'), word = PROFILE.FROZEN_HOLDS['RUNNER.nobody'];
      line(plain === true && off === false && word === 'TPS_RUNNOBODY=1', `the page opens with it on (${plain}) and ?runnobody=0 takes it out (${off}); the frozen stand holds it off and raises it by ${word}`); }
  } catch (err) { line(false, `threw: ${(err as Error)?.stack ?? err}`); }
  finally { knobsBack(all0); }
  console.log(failed ? '=== runnobody-check: FAIL ===' : '=== runnobody-check: ALL PASS ===');
  return !failed;
}
if (import.meta.main) process.exit((await runnobodyCheck()) ? 0 : 1);
