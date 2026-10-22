// AN F10 RECORDING ENDS WHOLE BEFORE A LOAD OR A RESTART MADE BETWEEN FRAMES, AND A NEW ONE IS ASKED FOR (src/game/journal.ts SessionRecorder.cut).
//   bun run tools/qa/probes.ts recordcut        (families: checkpoints · all; both stands)        JOURNALCUT_BREAK=1 → must FAIL
// A checkpoint loaded off a card or the panel (Checkpoints.load / loadMem) and an encounter staged again between two frames (Game.restartEncounter: a card's
// restart) change the whole game, and a recording files only what a frame was given: a tape that ran on across one replayed as a break of the game's own.
//   (a) a file's load between frames stops the recording there — handed over through onStop with its reason, as many frames as were stepped — and that file
//       replays identically to its end; a new recording is asked for, begins on the loaded game, and ITS file replays too
//   (b) a restart between frames: the same
//   (c) a page-like recording (the HUD's bubble expiry after every update) cut on the very frame a bubble ran out: the closing digest was taken AFTER the HUD's
//       write, the file says so (meta.between) and replays; the same file with that word struck does NOT (the scene is the one the word exists for). An
//       immediate stop between frames says the word too
//   (d) inside an update nothing is cut (what changes the game there is the frame's own input), and with nothing changed a recording runs to its own stop
//   (e) a save kept IN MEMORY (a unit on the floor), written while the tape ran, loaded between frames: the recording is cut there, and the sensors the
//       snapshot put back in their recording state are live again (no recorder is behind them)
// The break word makes cut() do nothing: the tape runs on across the change, and (a) (b) (c) (e) must fail.
import { standUp, ROOT } from './headless.ts';
import { replaySession } from './replay.ts';
const J = await import(`${ROOT}/src/game/journal.ts`);
const SS = await import(`${ROOT}/src/game/savestate.ts`);
const { spawnUnit } = await import(`${ROOT}/src/game/guards.ts`);
const { mulberry32 } = await import(`${ROOT}/src/math/dice.ts`);
const DT = 1 / 60;

export async function journalCutCheck(): Promise<boolean> {
  const BRK = process.env.JOURNALCUT_BREAK === '1'; let all = true;
  const verdict = (ok: boolean, what: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}\n    ${detail}`); };
  console.log(`\n=== recordcut: a recording ends whole before a load or a restart made between frames${BRK ? ' (cut() does nothing: must fail)' : ''} ===`);
  const log = console.log; const quiet = async <T>(f: () => Promise<T>): Promise<T> => { console.log = () => { }; try { return await f(); } finally { console.log = log; } };
  /** a game stood up, a file save made BEFORE the recording, the recording asked for and under way, `frames` stepped with him walking */
  const scene = async (seed: number, page: boolean, frames: number, until?: (W: any) => boolean) => {
    Math.random = mulberry32(seed); const W: any = await quiet(() => standUp()); const { game, input } = W;
    game.godMode = true; game.playerInvisible = true; for (let i = 0; i < 30; i++) W.step(DT);
    const saved = game.saves.write(game, 'manual', 'before the tape'); if (!saved.ok) throw new Error(`no save: ${saved.why}`);
    const key: string = game.saves.slots().find((x: any) => x.slot === 'manual').key;
    if (page) game.guards[0].bubble = { text: 'journal-cut', t: game.time, dur: 1.7, radio: false };   // (in the recording's own checkpoint; it runs out some hundred frames in)
    const got: { f: any; why: string }[] = []; game.journal.onStop = (f: any, why: string) => { got.push({ f, why }); };
    if (BRK) game.journal.cut = () => { };
    if (!game.journal.request({ seed: 515151, note: 'journal-cut', hud: page })) throw new Error('journal.request refused: ' + game.journal.summary());
    let n = 0; const step = (k: number, key2 = 'KeyD') => { for (let i = 0; i < k; i++) { input.keys.add(key2); W.step(DT); n++; if (until?.(W)) { if (page) J.hudExpireBubbles(game); input.keys.delete(key2); return true; } if (page) J.hudExpireBubbles(game); } input.keys.delete(key2); return false; };
    const hit = step(frames); return { W, game, key, got, step, hit, n: () => n };
  };
  const replay = async (F: any, name: string) => { const R = await quiet(() => replaySession(JSON.parse(JSON.stringify(F)), name, { quiet: true })); return R; };
  const said = (R: any) => `${R.replayed}/${R.frames} frames, ${R.digestsChecked} digests${R.digestMismatch ? `, FIRST MISMATCH after frame ${R.digestMismatch.f}` : ', all agree'}${R.bad ? ` (${R.bad})` : ''}`;
  /** the change made between frames, 250 frames more (off the digest's beat), whatever is recording then stopped: the file the change left, how the recorder stood straight after
   *  it, and the file of the recording that was asked for in its place */
  const across = async (S: Awaited<ReturnType<typeof scene>>, change: () => string | null | void) => {
    const { game, got, step } = S; const at = S.n();
    const why = change() ?? null; const stateAfter: string = game.journal.state, handed = got.length;
    step(250, 'KeyW'); const late = game.journal.recording ? game.journal.stop('the check\'s own stop', true) : null;
    const F = handed ? got[0].f : late, F2 = handed ? (got[1]?.f ?? null) : null; return { at, why, stateAfter, handed, F, F2, reason: handed ? got[0].why : '' };
  };
  // ---- (a) a load between frames
  { const S = await scene(7101, false, 300); const A = await across(S, () => S.game.saves.load(S.game, S.key)); const R = A.F ? await replay(A.F, 'load') : null, R2 = A.F2 ? await replay(A.F2, 'after the load') : null;
    const ok = !A.why && A.stateAfter === 'pending' && A.handed === 1 && A.reason === 'a checkpoint was loaded' && A.F?.frames === A.at && !!R?.ok && R.replayed === A.at && R.digestsChecked >= 2 && !!R2?.ok && A.F2.frames >= 200;
    verdict(ok, '(a) a checkpoint loaded between frames stops the recording there, the file is handed over with its reason and replays identically to its end; the recording asked for in its place replays too',
      `${A.at} frames, then the load (${A.why ?? 'done'}): recorder ${A.stateAfter}, ${A.handed} file handed over, stopped '${A.reason}', ${A.F?.frames} frames in it · replay: ${R ? said(R) : 'no file'} · the next recording: ${A.F2 ? `${A.F2.frames} frames, replay ${said(R2)}` : 'none'}`); }
  // ---- (b) a restart between frames
  { const S = await scene(7102, false, 300); const A = await across(S, () => { S.game.restart(); }); const R = A.F ? await replay(A.F, 'restart') : null, R2 = A.F2 ? await replay(A.F2, 'after the restart') : null;
    const ok = A.stateAfter === 'pending' && A.handed === 1 && A.reason === 'the encounter was staged again' && A.F?.frames === A.at && !!R?.ok && R.replayed === A.at && R.digestsChecked >= 2 && !!R2?.ok && A.F2.frames >= 200;
    verdict(ok, '(b) a restart between frames: the same',
      `${A.at} frames, then the restart: recorder ${A.stateAfter}, ${A.handed} file handed over, stopped '${A.reason}', ${A.F?.frames} frames in it · replay: ${R ? said(R) : 'no file'} · the next recording: ${A.F2 ? `${A.F2.frames} frames, replay ${said(R2)}` : 'none'}`); }
  // ---- (c) page-like, cut on the frame a bubble ran out
  { const ran = (W: any) => { const b = W.game.guards[0].bubble; return !!b && b.text === 'journal-cut' && W.game.time - b.t > b.dur; };   // (straight after the update: still on him, past its time — the HUD nulls it next)
    const S = await scene(7103, true, 400, ran); const last = S.n() - 1, gone = S.hit && S.game.guards[0].bubble === null, offBeat = S.n() % J.JOURNAL_DIGEST_EVERY !== 0;
    const A = await across(S, () => S.game.saves.load(S.game, S.key)); const R = A.F ? await replay(A.F, 'page cut') : null;
    let struck: any = null; if (A.F?.meta?.between) { const G = JSON.parse(JSON.stringify(A.F)); delete G.meta.between; struck = await replay(G, 'word struck'); }
    const now = A.F2?.meta?.stopped === 'the check\'s own stop' ? A.F2.meta.between === true : null;   // (the second recording was stopped at once, between frames: the same word)
    const ok = gone && offBeat && A.F?.meta?.between === true && !!R?.ok && R.replayed === A.at && !!struck && !struck.ok && now === true;
    verdict(ok, '(c) a page-like recording cut on the frame a bubble ran out: the file says its closing digest is after the HUD\'s write, and replays; with the word struck it does not',
      `the bubble ran out on frame ${last} (nulled by the HUD ${gone}, off the digest beat ${offBeat}) · meta.between ${A.F?.meta?.between ?? 'absent'} · replay: ${R ? said(R) : 'no file'} · an immediate stop between frames says it ${now} · the word struck: ${struck ? (struck.ok ? 'still identical (the scene did not need the word)' : said(struck)) : 'not run'}`); }
  // ---- (d) inside an update nothing is cut; nothing changed, nothing cut
  { const S = await scene(7104, false, 200); const { game, got, step } = S; const real = game.saves.tick.bind(game.saves); let asked = 0;
    game.saves.tick = (...a: any[]) => { asked++; game.journal.cut('asked inside an update'); return real(...a); }; step(60); game.saves.tick = real;
    const inside = game.journal.recording && got.length === 0; step(60); const F = game.journal.stop('the check\'s own stop', true); const R = F ? await replay(F, 'control') : null;
    const ok = (BRK || (asked >= 60 && inside)) && F?.frames === 320 && !!R?.ok;
    verdict(ok, '(d) asked inside an update, the cut does nothing; with nothing changed the recording runs to its own stop and replays',
      `cut asked ${asked} times inside updates: still recording ${inside}, files handed over ${got.length - (F ? 1 : 0)} · its own stop: ${F?.frames} frames · replay: ${R ? said(R) : 'no file'}`); }
  // ---- (e) a save kept in memory, written while the tape ran, loaded between frames
  { const was = SS.SAVETIMELINE.on;
    try {
      const S = await scene(7105, false, 100); const { game, got, step } = S; SS.SAVETIMELINE.on = true;   // (a save in memory is the timeline's: on for this part on the stand that holds it off — after the stand-up, which sets the stand's own)
      spawnUnit(game, { team: 'guard', pos: [6, 0, 11], yaw: 0, weapon: 'guard9mm', name: 'Probe' });   // (between frames, off the tape: this part replays nothing)
      step(20); const wr = game.saves.write(game, 'manual', 'by hand'); const mem = (game.saves.timeline() as any[]).find(x => x.mem); step(40); const at = S.n();   // (written between two frames: the snapshot holds the sensors recording)
      const why = mem ? game.saves.load(game, mem.key) : `no save in memory was written (${wr.ok ? `a file was: ${wr.info?.key}` : wr.why} · units ${game.guards.filter((x: any) => x.unit).length})`; const state: string = game.journal.state, mode: string = game.sensors.mode;
      const ok = !why && got.length === 1 && got[0].why === 'a checkpoint was loaded' && got[0].f?.frames === at && state === 'pending' && mode === 'live';
      verdict(ok, '(e) a save in memory written while the tape ran, loaded between frames: the recording is cut there and the sensors are live again',
        `${at} frames, a unit on the floor, the load (${why ?? 'done'}): ${got.length} file handed over${got[0] ? `, stopped '${got[0].why}', ${got[0].f?.frames} frames` : ''} · recorder ${state} · sensors ${mode}`);
      if (game.journal.state !== 'idle') game.journal.stop('the check\'s own stop', true);
    } finally { SS.SAVETIMELINE.on = was; }
  }
  console.log(`=== recordcut: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}
