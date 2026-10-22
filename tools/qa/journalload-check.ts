// AN F10 RECORDING RUNS ON ACROSS A CHECKPOINT LOADED INSIDE AN UPDATE, AND ITS FILE REPLAYS (src/game/sensors.ts SensorStream, src/game/journal.ts slotRead /
// slotWrote / cut(…, lost), src/game/savestate.ts tapeBegin / tapeSeed).
//   bun run tools/qa/probes.ts recordload        (families: checkpoints · all; both stands)        JOURNALLOAD_BREAK=1 → must FAIL
// The bare Enter once down is the frame's own input: the load it asks for is ON the tape, and the recording goes on over it (journalcut-check.ts holds the
// other half: a load BETWEEN frames ends the recording). What had to be true of it and was not:
//   (a) a save kept IN MEMORY (a unit on the floor) made while the tape ran, put back inside an update: the rollback snapshot took the sensors' stream back to
//       the save's frame with the game. The stream is the host's now; the recording runs on to its own stop, frame for frame, and replays to its end with
//       every value the game took off the (answering) GPU served again — the replay makes the same save and puts it back on the same frame
//   (b) a save in memory from BEFORE the recording, put back inside an update: no replay has it. The recording ends with that frame, the file says so
//       (meta.lost, a reason, version 2) and replays to the frame before; a new recording is asked for (by play this cannot come up: a recording does not
//       begin with a unit on the floor, and a unit never leaves it — the check takes the unit off by hand)
//   (c) a FILE slot from before the recording — an IMPORTED one, whose row and text disagree on when it was saved — loaded inside an update: the file carries
//       the store's rows from its frame 0 and that slot's text at the frame of the load, and replays to its end, through a save by hand after the load and a
//       second Enter, which goes back to THAT one in both
//   (d) a save written BETWEEN two frames under a recording (off the panel) is on no tape: the recording ends whole before it and replays; the one asked for
//       in its place has the new slot among its rows, and an Enter that loads it replays
// What the check does by hand between two frames (a unit spawned, Sam put down) is off the tape and is done again at the same frame of the replay
// (replay.ts `between`). The GPU stand-in answers every ask a frame later (journal-probes.ts answeringProbe): nothing of it exists in a replay.
// The break word puts things as they were: (a) the stream is taken back to the save's frame, (b) the recording is not ended, (c) the slot's text is not
// filed, (d) the save does not end the recording — all four must fail.
import { standUp, ROOT } from './headless.ts';
import { replaySession } from './replay.ts';
import { answeringProbe } from './journal-probes.ts';
const SS = await import(`${ROOT}/src/game/savestate.ts`);
const { spawnUnit } = await import(`${ROOT}/src/game/guards.ts`);
const { mulberry32 } = await import(`${ROOT}/src/math/dice.ts`);
const DT = 1 / 60;

export async function journalLoadCheck(): Promise<boolean> {
  const BRK = process.env.JOURNALLOAD_BREAK === '1'; let all = true;
  const verdict = (ok: boolean, what: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}\n    ${detail}`); };
  console.log(`\n=== recordload: a recording runs on across a checkpoint loaded inside an update${BRK ? ' (as it was: must fail)' : ''} ===`);
  const log = console.log; const quiet = async <T>(f: () => Promise<T>): Promise<T> => { console.log = () => { }; try { return await f(); } finally { console.log = log; } };
  const was = SS.SAVETIMELINE.on;
  type Hand = (game: any) => void;
  /** a game stood up over a GPU that answers, the timeline on and saves by hand read; `before` runs ahead of the recording; then the recording is asked for and
   *  begun. `at(f, hand)` books a hand of the check's own before frame f of the recording under way, `press(f, key)` a key pressed on frame f; `go(n)` steps n
   *  frames with him walking; `rebase()` after a recording has ended: the next step is frame 0 of the next */
  const scene = async (seed: number, before: (W: any) => void) => {
    Math.random = mulberry32(seed); const W: any = await quiet(() => standUp()); const { game, input } = W;
    const gpu = answeringProbe(seed ^ 0x9e3779b9); game.probe = gpu.probe;
    SS.SAVETIMELINE.on = true; game.saves.enabled = true;   // (after the stand-up, which sets the stand's own; the recording's knobs carry both to the replay)
    game.godMode = true; game.playerInvisible = true; for (let i = 0; i < 30; i++) { gpu.tick(); W.step(DT); }
    before(W);
    const got: { f: any; why: string }[] = []; game.journal.onStop = (f: any, why: string) => { got.push({ f, why }); };
    if (!game.journal.request({ seed: 616161, note: 'journal-load' })) throw new Error('journal.request refused: ' + game.journal.summary());
    const hands = new Map<number, Hand[]>(), keys = new Map<number, string[]>(); let n = 0;
    const at = (f: number, h: Hand) => { hands.set(f, [...(hands.get(f) ?? []), h]); }, press = (f: number, k: string) => { keys.set(f, [...(keys.get(f) ?? []), k]); };
    const go = (k: number) => { for (let i = 0; i < k; i++) { for (const h of hands.get(n) ?? []) h(game); for (const key of keys.get(n) ?? []) input.pressed.add(key); input.keys.add('KeyD'); gpu.tick(); W.step(DT); n++; } input.keys.delete('KeyD'); };
    const rebase = () => { n = 0; hands.clear(); keys.clear(); };
    go(1); if (!game.journal.recording) throw new Error('the recording did not begin: ' + game.journal.summary());
    return { W, game, got, at, press, go, rebase, hands };
  };
  /** the file replayed with the check's hands made again at their frames; the replay's own game comes back with the report */
  const replay = async (F: any, name: string, hands: Map<number, Hand[]>) => {
    let RG: any = null; const mine = new Map(hands), reads: string[] = [];
    const R: any = await quiet(() => replaySession(JSON.parse(JSON.stringify(F)), name, { quiet: true, between: (f: number, g: any) => { if (!RG) { RG = g; tap(g, reads); } for (const h of mine.get(f) ?? []) h(g); } }));
    return { R, RG, reads };
  };
  /** every value the game takes off its sensors, by frame and key, as it takes it: the recording's against the replay's */
  const tap = (g: any, into: string[]) => { const S = g.sensors, real = S.read.bind(S); S.read = (k: string) => { const v = real(k); into.push(`${S.frame} ${k} ${v}`); return v; }; };
  const said = (R: any) => `${R.replayed}/${R.frames} frames, ${R.digestsChecked} digests${R.digestMismatch ? `, FIRST MISMATCH after frame ${R.digestMismatch.f}` : ', all agree'}, ${R.sensor?.reads ?? 0} sensor reads${R.sensor?.first ? ` PARTED on frame ${R.sensor.first.f}` : ''}${R.bad ? ` (${R.bad})` : ''}`;
  const unit: Hand = g => { spawnUnit(g, { team: 'guard', pos: [6, 0, 11], yaw: 0, weapon: 'guard9mm', name: 'Probe' }); };
  const down: Hand = g => { g.player.down = true; };
  const memRows = (g: any) => (g.saves.timeline() as any[]).filter(x => x.mem).length;
  const answered = (F: any) => (F?.sensors?.recs ?? []).reduce((s: number, r: any[]) => s + (r[0] === 'K' ? 0 : (r.length - 1) / 2), 0);   // (values the tape holds: a headless GPU that never answers files none)
  try {
    // ---- (a) a save in memory made while the tape ran, put back inside an update
    { const S = await scene(7201, () => { }); const { game, got, at, press, go } = S; const stream = (game.sensors as any).s; const took: string[] = []; tap(game, took); took.length = 0;
      at(20, unit); press(40, 'F5'); at(160, down); press(170, 'Enter');
      go(60); const mem = memRows(game), keep = BRK ? { frame: stream.frame, recs: stream.recs.slice(), keys: stream.keys.slice(), prevSeq: stream.prevSeq.slice(), prevVals: stream.prevVals.slice() } : null;   // (the break: what the snapshot held of the stream, about the save's frame)
      go(109); const tBefore = game.time, loadsBefore = game.saves.stats.loads;
      if (keep) { const real = game.saves.tick.bind(game.saves); game.saves.tick = (...a: any[]) => { const r = real(...a); if (game.saves.stats.loads > loadsBefore) { Object.assign(stream, keep); stream.keyIdx = new Map(keep.keys.map((k: string, i: number) => [k, i])); game.saves.tick = real; } return r; }; }
      go(1); const loaded = game.saves.stats.loads - loadsBefore, back = game.time < tBefore - 1, up = !game.player.down, still = game.journal.recording && got.length === 0, f1 = game.sensors.frame;
      go(149); const F = game.journal.recording ? game.journal.stop('the check\'s own stop', true) : got[0]?.f; const { R, RG, reads } = F ? await replay(F, 'memory, inside', S.hands) : { R: null, RG: null, reads: [] as string[] };
      const vals = answered(F), from1 = (L: string[]) => L.filter(x => +x.split(' ')[0] >= 1), mine = from1(took), theirs = from1(reads), same = mine.length > 3000 && mine.length === theirs.length && mine.every((x, i) => x === theirs[i]);   // (the tap went on after frame 0)
      const ok = mem === 1 && loaded === 1 && back && up && still && f1 === 170 && F?.frames === 320 && F.sensors.frames === 320 && F.v === 1 && vals > 300 && same && !!R?.ok && R.replayed === 320 && R.sensor.reads > 300 && RG?.saves.stats.loads === 1 && memRows(RG) === 1;
      verdict(ok, '(a) a save in memory made while the tape ran, put back inside an update: the recording runs on with its stream whole, and the file replays to its end with every value served again',
        `a unit at frame 20, F5 on 40 (${mem} save in memory), down at 160, Enter on 170: ${loaded} load, the clock back ${back}, on his feet ${up} · still recording ${still}, the sensors on frame ${f1} · the file: ${F?.frames} frames, sensor stream ${F?.sensors.frames} with ${vals} values in it · every value the game took, the replay took too ${same} (${mine.length}) · replay: ${R ? `${said(R)}, ${RG?.saves.stats.loads} load in it` : 'no file'}`); }
    // ---- (b) a save in memory from before the recording
    { let key = '';
      const S = await scene(7202, W => { const g = W.game; unit(g); for (let i = 0; i < 20; i++) W.step(DT); const wr = g.saves.write(g, 'manual', 'before the tape'); key = wr.ok && wr.info?.mem ? wr.info.key : '';
        const men = g.guards.filter((x: any) => x.unit); for (const m of men) g.engine.lights.remove(m.flashlight); g.guards = g.guards.filter((x: any) => !x.unit); });   // (off the floor by hand, so that a recording may begin: nothing in the game does this)
      const { game, got, at, press, go } = S;
      if (BRK) { const real = game.journal.cut.bind(game.journal); game.journal.cut = (why: string, lost?: boolean) => { if (!lost) real(why); }; }
      at(180, down); press(190, 'Enter'); go(189); const tBefore = game.time; go(1);
      const back = game.time < tBefore - 0.5, units = game.guards.filter((x: any) => x.unit).length, state: string = game.journal.state, mode: string = game.sensors.mode, G = got[0], handed = got.length;
      const { R } = G?.f ? await replay(G.f, 'memory, before', S.hands) : { R: null };
      go(30); if (game.journal.state !== 'idle') game.journal.stop('the check\'s own stop', true);
      const ok = !!key && back && units === 1 && handed === 1 && G?.why === 'a save in memory from before the recording was loaded' && G.f?.frames === 191 && G.f.meta.lost === true && G.f.v === 2 && G.f.digests.every((d: any[]) => d[0] < 190)
        && state === 'pending' && mode === 'live' && !!R?.ok && R.replayed === 190 && R.digestsChecked >= 1;
      verdict(ok, '(b) a save in memory from before the recording, put back inside an update: the recording ends with that frame, the file says so and replays to the frame before, and a new one is asked for',
        `a save in memory ${key ? 'made' : 'NOT made'}, the unit taken off by hand, the recording, down at 180, Enter on 190: the clock back ${back}, ${units} unit on the floor again · ${handed} file handed over${G ? `, stopped '${G.why}', ${G.f?.frames} frames, meta.lost ${G.f?.meta?.lost ?? 'absent'}, version ${G.f?.v}` : ''} · recorder ${state} · sensors ${mode} · replay: ${R ? said(R) : 'no file'}`); }
    // ---- (c) an imported file slot from before the recording, loaded inside an update; then a save by hand and a second Enter
    { let key = '', apart = false;
      const S = await scene(7203, W => { const g = W.game, wr = g.saves.write(g, 'manual', 'before the tape'), text = wr.ok && !wr.info?.mem ? g.saves.store.get(wr.info.key) : null;
        const T = text ? JSON.parse(text) : null; if (T) { T.savedAt -= 60000; T.label = 'brought in'; }   // (a file from a minute ago: the row says it was saved at the import)
        const inf = T ? g.saves.importText(g, JSON.stringify(T)) : 'no file to import'; if (typeof inf !== 'string') { key = inf.key; apart = inf.savedAt !== T.savedAt; } });
      const { game, got, at, press, go } = S;
      if (BRK) game.journal.slotRead = () => { };
      at(60, down); press(70, 'Enter'); press(200, 'F5'); at(320, down); press(330, 'Enter');
      go(69); const t1 = game.time; go(1); const back1 = game.time < t1 - 0.5; go(130); const rows = (game.saves.slots() as any[]).filter(x => !x.mem).length;
      go(129); const t2 = game.time; go(1); const back2 = game.time < t2 - 0.5 && game.time > t2 - 4, still = game.journal.recording && got.length === 0;
      go(119); const F = game.journal.recording ? game.journal.stop('the check\'s own stop', true) : got[0]?.f; const { R, RG } = F ? await replay(F, 'file, before', S.hands) : { R: null, RG: null };
      const filed = F?.slots?.loads ?? [];
      const ok = !!key && apart && back1 && rows === 3 && back2 && still && F?.frames === 450 && !!F.slots?.index && filed.length === 1 && filed[0][0] === 70 && filed[0][1] === key && F.v === 2 && !!R?.ok && R.replayed === 450 && RG?.saves.stats.loads === 2;
      verdict(ok, '(c) an imported file slot from before the recording, loaded inside an update: its rows and its text are on the tape and the file replays to its end, through a save by hand and a second Enter back to that one',
        `a slot stored and one imported (row and text apart on the time ${apart}), the recording, down at 60, Enter on 70: the clock back ${back1} · F5 on 200 (${rows} slots stored), down at 320, Enter on 330: back to the newer one ${back2} · still recording ${still} · the file: ${F?.frames} frames, version ${F?.v}, the store's rows ${F?.slots?.index ? 'in it' : 'ABSENT'}, ${filed.length} slot text filed${filed[0] ? ` at frame ${filed[0][0]}` : ''} · replay: ${R ? `${said(R)}, ${RG?.saves.stats.loads} loads in it` : 'no file'}`); }
    // ---- (d) a save written between two frames under a recording
    { const S = await scene(7204, () => { }); const { game, got, at, press, go, rebase } = S;
      if (BRK) { const real = game.journal.cut.bind(game.journal); game.journal.cut = (why: string, lost?: boolean) => { if (why !== 'a checkpoint was saved between frames') real(why, lost); }; }
      go(99); const wr = game.saves.write(game, 'manual', 'off the panel'); const state: string = game.journal.state, G = got[0], handed = got.length;
      const first = G?.f ? (await replay(G.f, 'before the save', new Map())).R : null;
      if (handed) rebase(); at(handed ? 60 : 160, down); press(handed ? 70 : 170, 'Enter'); go(200);
      const F = game.journal.recording ? game.journal.stop('the check\'s own stop', true) : null; const { R, RG } = F ? await replay(F, 'after the save', S.hands) : { R: null, RG: null };
      const filed = F?.slots?.loads ?? [];
      const ok = wr.ok && handed === 1 && G?.why === 'a checkpoint was saved between frames' && G.f?.frames === 100 && !!first?.ok && state === 'pending' && F?.frames === 200 && filed.length === 1 && filed[0][0] === 70 && filed[0][1] === wr.info?.key && !!R?.ok && RG?.saves.stats.loads === 1;
      verdict(ok, '(d) a save written between two frames under a recording ends it whole before the save; the recording asked for in its place has the slot among its rows, and an Enter that loads it replays',
        `100 frames, then a save off the panel (${wr.ok ? 'stored' : wr.why}): ${handed} file handed over${G ? `, stopped '${G.why}', ${G.f?.frames} frames, replay ${first ? said(first) : 'none'}` : ''} · recorder ${state} · the next recording, down at 60, Enter on 70: ${F ? `${F.frames} frames, ${filed.length} slot text filed${filed[0] ? ` at frame ${filed[0][0]}` : ''}, replay ${R ? `${said(R)}, ${RG?.saves.stats.loads} load in it` : 'none'}` : 'no file'}`); }
  } finally { SS.SAVETIMELINE.on = was; }
  console.log(`=== recordload: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}
