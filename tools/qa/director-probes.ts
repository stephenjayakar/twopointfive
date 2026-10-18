// The 'director' family (probes.ts: `bun run tools/qa/probes.ts director` — also in 'all'): the level-scripting DIRECTOR (src/game/director.ts, docs/design/level-scripting.md
// M1, docs/internal/director.md) held to what it claims without a browser:
// (The office's script — the night and day showcases — was removed, and with it director-breach-digest and its two frozen beat logs: no shipped level has a script, so
// every probe here stages its own. What nothing here runs any more: a showcase program end to end, and BreachDrill driven as a Director drill.)
//   director-lint            the define-time manifest lint: the shipped office carries NO script (its Director has no program and refuses a start by name, the
//                            game stepping on), and a script naming a door / plan / group the level lacks is REPORTED by name with the beat that uses it — and
//                            the Director refuses to arm that program (armed false, the game playable).
//   director-showcase-scan   the showcase-verb scan: camera / caption / puppet / press / click / stage / fade / daylight / shift are used only inside programs
//                            declared showcase: true — a synthetic play program calling c.caption(…) is caught statically by name AND
//                            throws at run time without touching the world.
//   director-scheduler       the scheduling core on a bare Game: onStart / after / onEvent triggers fire once, beats resume on the exact tick their condition holds
//                            (wait / until / done / any / all), a throwing beat is failed and logged with its step while the frame goes on and its units are
//                            released to the AI, MAX_RESUMES caps a runaway, two seeded runs log identically, and with NO program running the seeded game digests
//                            exactly as a game whose Director was never ticked (the identity the tactics / needs / civilians cards hold from their side).
import { standUp, ROOT } from './headless.ts';

const DT = 1 / 60;
const argv = process.argv.slice(2);
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}

// ---------------------------------------------------------------- director-lint
export async function directorLint(): Promise<boolean> {
  const F = family("director-lint: the define-time manifest lint — the shipped office has no script; a script naming what the level lacks is reported by name and not armed (director.ts lintManifest)");
  const Dm = await import(`${ROOT}/src/game/director.ts`); const { buildLevel } = await import(`${ROOT}/src/scene/level.ts`);
  const level = buildLevel();
  { // (a) the shipped office: no script on the Level, so the Game's Director has no manifest, no program, and says why a start by name is refused — the game steps on
    const f: string[] = [];
    if (level.script !== undefined) f.push('buildLevel() carries a script (the office has none since the two showcases were removed)');
    Math.random = seeded(5); const W: any = await standUp(); const D = W.game.director;
    if (D.manifest !== null || D.programs.length) f.push(`the Game's Director has programs: ${D.programs.join(' / ')}`); if (D.problems.length) f.push(`problems: ${D.problems.map((p: any) => p.what).join(' | ')}`);
    for (const name of ['breach', 'night']) { const why = D.canStart(name); if (why === null) f.push(`canStart('${name}') says it can`); const said = D.start(name); if (!said) f.push(`start('${name}') was not refused`); }
    if (D.run || D.showing) f.push('a run exists after the refused starts');
    for (let i = 0; i < 5; i++) W.step(DT);
    F.verdict(f.length === 0, "the shipped office: no script on the Level, the Game's Director with no manifest and no program, start('breach') / start('night') refused with a reason, no run, the game steps on", f.join('; ') || `canStart: "${D.canStart('breach')}"; ${D.summary()}`);
  }
  { // (b) a script naming things the office does not have: every miss reported by name; a Director built on it is NOT armed and refuses to start, the game untouched
    const bad = (D: any) => {
      const ghostDoor = D.door('vault'), okDoor = D.door('conference'), vol = D.volume('trig_nowhere'), route = D.route('rooftop'), grp = D.lightGroup('disco'), plan = D.plan('ballroom'), noPos = D.mark('nowhere'), gun = D.loadout('ray', { team: 'operative', weapon: 'raygun' as any }), civ = D.loadout('civ', { team: 'civilian' as any });
      void ghostDoor; void okDoor; void route; void grp; void plan; void noPos; void gun; void civ;
      D.program('main', (P: any) => { P.onStart('one'); P.onEnter(vol, 'two'); P.after(NaN, 'three'); P.beat('one', function* () { /* */ }); P.beat('two', function* () { /* */ }); });
      D.expect.order('ghost', ['a']);
    };
    const M = Dm.manifestOf(bad); const probs = Dm.lintManifest(M, level) as { level: string; what: string }[]; const text = probs.map(p => p.what).join('\n');
    const f: string[] = [];
    for (const needle of ["door 'vault'", "volume 'trig_nowhere'", "route 'rooftop'", "light group 'disco'", "plan 'ballroom'", "mark 'nowhere'", "'raygun'", "team 'civilian'", "beat 'three'", 'after(NaN)', "program 'ghost'"]) if (!text.includes(needle)) f.push(`not reported: ${needle}`);
    if (text.includes("door 'conference'")) f.push("a door that exists ('conference') was reported");
    Math.random = seeded(6); const W: any = await standUp(); const errBefore = console.error; let logged = ''; console.error = (...a: unknown[]) => { logged += a.join(' '); };
    let D2: any; try { D2 = new Dm.Director(W.game, bad); } finally { console.error = errBefore; }
    if (D2.armed) f.push('a Director on the bad script is armed'); const why = D2.start('main'); if (!why) f.push('start(main) was not refused'); if (D2.run) f.push('a run exists after a refused start');
    if (!/NOT armed/.test(logged)) f.push('nothing on the console about the disarmed script');
    for (let i = 0; i < 5; i++) W.step(DT);   // the game goes on
    F.verdict(f.length === 0, 'a script naming a missing door / volume / route / group / plan, a mark with no position, an unknown weapon, an unspawnable side, an undeclared beat, a NaN delay, an undeclared program: each reported by name; the Director on it is not armed, start() refused with a reason, the console told, the game steps on', f.join('; ') || `${probs.length} problems reported; start refused: "${why}"`);
  }
  return F.done();
}

// ---------------------------------------------------------------- director-showcase-scan
export async function directorShowcaseScan(): Promise<boolean> {
  const F = family('director-showcase-scan: captions / camera / puppet / staging only in programs declared showcase (decision 4) — found statically by name AND refused at run time (director.ts scanShowcaseVerbs)');
  const Dm = await import(`${ROOT}/src/game/director.ts`);
  { // a PLAY program using them: every one found by (program, beat, verb); a mention in a comment is not a use; the same verbs inside a showcase program of the same script are fine
    const naughty = (D: any) => {
      D.program('main', (P: any) => {
        P.onStart('talky');
        P.beat('talky', function* (c: any) { c.caption('LOOK AT ME'); yield c.wait(1); c.camera.pin({ look: [1, 0, 1], yaw: 0, pitch: 30, dist: 5, dur: 3 }); });
        P.beat('pushy', function* (c: any) { c.stage('sam', [2, 0, 2]); c.puppet({ goal: [3, 0, 3] }); c.press('KeyE'); c.click(); c.fade(1); c.variant({ kind: 'variant', id: 'daylight' }, true); c.shift(false); c.chapters([]); yield c.frames(1); });
        P.beat('innocent', function* (c: any) { /* c.caption('only in a comment') */ c.control('all quiet');   // c.camera.pin(nothing)
          yield c.wait(1); });
      });
      D.program('show', (P: any) => { P.onStart('s'); P.beat('s', function* (c: any) { c.caption('fine here'); c.camera.pin({ look: [1, 0, 1], yaw: 0, pitch: 30, dist: 5, dur: 3 }); yield c.wait(1); }); }, { showcase: true });
    };
    const hits = Dm.scanShowcaseVerbs(Dm.manifestOf(naughty)) as { program: string; beat: string; verb: string }[];
    const key = (h: { program: string; beat: string; verb: string }) => `${h.program}/${h.beat}/${h.verb}`; const got = new Set(hits.map(key));
    const want = ['main/talky/caption', 'main/talky/camera', 'main/pushy/stage', 'main/pushy/puppet', 'main/pushy/press', 'main/pushy/click', 'main/pushy/fade', 'main/pushy/variant', 'main/pushy/shift', 'main/pushy/chapters'];
    const f: string[] = []; for (const w of want) if (!got.has(w)) f.push(`missed ${w}`); for (const h of hits) if (h.beat === 'innocent' || h.program === 'show') f.push(`false positive ${key(h)}`);
    // run time: the play program's beat throws on its first showcase verb — failed and logged, the world untouched (no caption anywhere, Sam where he was), and the lint had already disarmed it: force-arm to see the runtime refuse
    Math.random = seeded(8); const W: any = await standUp(); const errBefore = console.error; console.error = () => { /* the disarmed-script + failed-beat lines */ };
    let D2: any; try { D2 = new Dm.Director(W.game, naughty); D2.armed = true; D2.strict = false; const p0 = [...W.game.player.char.pos]; D2.start('main'); for (let i = 0; i < 3; i++) W.step(DT);
      const rows = D2.rowsOf() as any[]; const failed = rows.find(r => r.kind === 'error' && r.beat === 'talky'); if (!failed || !/showcase-only/.test(failed.what)) f.push(`talky did not fail on c.caption at run time (${failed?.what ?? 'no error row'})`);
      if (D2.frame) f.push('a frame (caption / veil) exists for a play program'); if (Math.hypot(W.game.player.char.pos[0] - p0[0], W.game.player.char.pos[2] - p0[2]) > 1e-6) f.push('Sam moved');
      D2.stop();
    } finally { console.error = errBefore; }
    F.verdict(f.length === 0, "a play program calling caption / camera.pin / stage / puppet / press / click / fade / variant / shift / chapters: all ten found by (program, beat, verb), none in a comment-only beat or in the sibling showcase program; at run time the beat fails on the first with 'showcase-only', no frame, Sam unmoved", f.join('; ') || `${hits.length} hits: ${[...got].join(' ')}`);
  }
  return F.done();
}

// ---------------------------------------------------------------- director-scheduler (+ identity)
export async function directorScheduler(): Promise<boolean> {
  const F = family('director-scheduler: the scheduling core on the real Game — triggers, generator beats resumed on the exact tick, error isolation, the runaway cap, determinism, save refusal, verbs over squad.ts / spawnUnit / doors / lights, and idle identity (director.ts)');
  const Dm = await import(`${ROOT}/src/game/director.ts`); const { digestGame, hashDigest, diffDigest } = await import(`${ROOT}/src/game/digest.ts`); const { canSave } = await import(`${ROOT}/src/game/savestate.ts`);
  /** a small PLAY program on the office: staff spawned at a mark and walked to another, a door opened, a group switched, a signal chain, an event wait, any/all, frames, a throwing beat, a runaway */
  const testScript = (D: any) => {
    const A = D.mark('lobby_a', [8.5, 0, 17.0]), B = D.mark('lobby_b', [11.0, 0, 17.5]); const conf = D.door('conference'); const ext = D.lightGroup('exterior');
    const STAFF = D.loadout('staff', { team: 'guard', weapon: 'guard9mm', light: false });
    D.expect.order('main', ['hello', 'walked', 'opened']);
    D.program('main', (P: any) => {
      P.onStart('intro'); P.after(1.5, 'late'); P.onSignal('go', 'mover'); P.onEvent('whistle', 'ears', (e: any) => e.level > 0.2); P.when((q: any) => q.t > 1.25, 'clock', { label: 't>1.25' });
      P.beat('intro', function* (c: any): Generator<any, any, any> { c.note('hello'); const r = yield c.any(c.wait(10), c.frames(3)); c.note('any', { index: r.index }); yield c.all(c.wait(0.5), c.frames(2)); c.flag.count = 1; c.signal('go', { n: 1 }); yield c.done('mover'); c.note('after-mover'); c.start('thrower'); c.start('spinner'); yield c.wait(0.25); c.finish(); });
      P.beat('late', function* (c: any) { c.note('late', { t: +c.query.t.toFixed(4) }); });
      P.beat('clock', function* (c: any) { c.note('clock', { t: +c.query.t.toFixed(4) }); });
      P.beat('ears', function* (c: any) { c.note('heard'); });
      P.beat('mover', function* (c: any) {
        const u = c.spawn(STAFF, A, { callsign: 'Extra', yaw: 1.2 }); c.order(u, { goal: B, speed: 2.2, face: 0, upper: 'none' });
        const t0 = c.query.t; yield c.any(c.until((q: any) => q.arrived(u), 'arrived'), c.wait(12)); c.note('walked', { secs: +(c.query.t - t0).toFixed(2), arrived: c.query.arrived(u) });
        c.doors.open(conf); c.lights.group(ext, false); yield c.frames(30); c.note('opened', { open: c.query.door(conf).open, ext: c.query.groupOn(ext) }); c.release(u, 'patrol');
      });
      P.beat('thrower', function* (c: any) { yield c.frames(1); throw new Error('scripted mistake'); });
      P.beat('spinner', function* (c: any) { for (;;) yield c.wait(0); });
    });
  };
  const runOnce = async (seed: number) => {
    Math.random = seeded(seed); const W: any = await standUp(); const { game } = W;
    game.playerInvisible = true; game.godMode = true; for (let i = 0; i < 20; i++) W.step(DT);
    const errBefore = console.error; console.error = () => { /* the failed beats' lines */ };
    const D = new Dm.Director(game, testScript); game.director = D; D.strict = false;
    const notes: string[] = []; let saveWhy = ''; let whistled = false; let maxGuards = 0; const nGuards0 = game.guards.length;
    try {
      const why = D.start('main'); if (why) notes.push('refused: ' + why);
      for (let f = 0; f < 60 * 20 && D.run; f++) {
        if (f === 30) saveWhy = canSave(game, true) ?? '';
        if (f === 90 && !whistled) { whistled = true; game.events.push({ kind: 'whistle', pos: [9, 0, 17], time: game.time, loud: false, level: 0.35, who: 1 }); }
        W.step(DT); maxGuards = Math.max(maxGuards, game.guards.length);
      }
    } finally { console.error = errBefore; }
    const rows = D.rowsOf(D.lastRun?.serial ?? 1) as any[];
    return { W, D, rows, notes, saveWhy, maxGuards, nGuards0, digest: rows.map(r => `${r.kind}:${r.beat}:${r.what}@${Math.round(r.t * 60)}${r.data !== undefined ? JSON.stringify(r.data) : ''}`).join('\n') };
  };
  const R1 = await runOnce(21), R2 = await runOnce(21);
  { const f: string[] = [...R1.notes]; const rows = R1.rows; const find = (kind: string, beat: string, what: string | RegExp) => rows.find((r: any) => r.kind === kind && r.beat === beat && (typeof what === 'string' ? r.what === what : what.test(r.what)));
    const fr = (r: any) => Math.round(r.t * 60);
    /** the program clock is ACCUMULATED dt (start() is tick 0, step k is tick k): the first tick n whose accumulated clock reaches `secs` from tick `from` — what wait / after mean, floating point and all */
    const tickAt = (secs: number, from = 0) => { let t = 0, n = 0; for (; n < from; n++) t += DT; const until = t + secs; while (t < until) { t += DT; n++; } return n; };
    // triggers: onStart at tick 0; after(1.5) on the first tick t ≥ 1.5; when(t > 1.25) the tick after t reaches 1.25; the whistle pushed before frame 90's step is that step's news → 'ears' fires inside it (tick 91)
    const st = find('trigger', 'intro', 'onStart'); if (!st || fr(st) !== 0) f.push(`onStart at f${st && fr(st)}`);
    const late = find('note', 'late', 'late'); if (!late || fr(late) !== tickAt(1.5)) f.push(`after(1.5) fired at f${late && fr(late)} (want ${tickAt(1.5)})`);
    const wantClock = (() => { let t = 0, n = 0; while (!(t > 1.25)) { t += DT; n++; } return n; })();
    const clock = find('note', 'clock', 'clock'); if (!clock || fr(clock) !== wantClock) f.push(`when(t>1.25) fired at f${clock && fr(clock)} (want ${wantClock})`);
    const heard = find('note', 'ears', 'heard'); if (!heard || fr(heard) !== 91) f.push(`onEvent(whistle) fired at f${heard && fr(heard)} (want 91)`);
    // yields: any(wait 10, frames 3) → index 1 at tick 3; all(wait .5, frames 2) → the tick 0.5 s of clock after tick 3 (frames 2 held long since: every branch runs); done(mover) resumes intro the SAME tick mover ends (the scheduler passes again)
    const anyRow = find('note', 'intro', 'any'); if (!anyRow || fr(anyRow) !== 3 || anyRow.data?.index !== 1) f.push(`any → f${anyRow && fr(anyRow)} index ${anyRow?.data?.index} (want f3, 1)`);
    const wantSig = tickAt(0.5, 3);
    const sig = find('note', 'intro', 'signal:go'); if (!sig || fr(sig) !== wantSig) f.push(`all(wait .5, frames 2) → signal at f${sig && fr(sig)} (want ${wantSig})`);
    const moverStart = find('beat', 'mover', 'start'); if (!moverStart || fr(moverStart) !== wantSig + 1) f.push(`onSignal → mover started at f${moverStart && fr(moverStart)} (want ${wantSig + 1}: a signal is next tick's news)`);
    const moverDone = find('beat', 'mover', 'done'), afterMover = find('note', 'intro', 'after-mover'); if (!moverDone || !afterMover || fr(moverDone) !== fr(afterMover)) f.push(`done(mover) resumed intro at f${afterMover && fr(afterMover)} vs mover done f${moverDone && fr(moverDone)}`);
    // verbs: the extra man spawned (a 'guard' unit), walked ~2.5 m to his mark and ARRIVED well inside 12 s, the conference door opened, the exterior group off, then released to the AI on patrol
    const walked = find('note', 'mover', 'walked'); if (!walked || walked.data?.arrived !== true || !(walked.data?.secs > 0.8 && walked.data?.secs < 6)) f.push(`walk: ${JSON.stringify(walked?.data)}`);
    const opened = find('note', 'mover', 'opened'); if (!opened || opened.data?.open !== true || opened.data?.ext !== false) f.push(`door/group: ${JSON.stringify(opened?.data)}`);
    if (R1.maxGuards !== R1.nGuards0 + 1) f.push(`guards peaked at ${R1.maxGuards} (want ${R1.nGuards0 + 1})`);
    const extra = R1.W.game.guards.find((x: any) => x.callsign === 'Extra'); if (!extra) f.push('the unit is gone after a PLAY program ended (should stay, as AI)'); else if (extra.script || extra.state !== 'patrol') f.push(`the released unit: script ${!!extra.script} state ${extra.state}`);
    // error isolation: thrower failed at step 1 with its message, spinner failed as a runaway, intro still finished the program; strict off → no throw reached us
    const thr = find('error', 'thrower', /threw at step 1: scripted mistake/); if (!thr) f.push('thrower not failed / logged with its step and message');
    const spin = find('error', 'spinner', /runaway/); if (!spin) f.push('spinner (yield wait(0) for ever) not caught as a runaway');
    const fin = rows.find((r: any) => r.kind === 'program' && r.what === 'finished'); if (!fin) f.push('the program never finished (intro → c.finish)');
    if (!/program 'main' is running/.test(R1.saveWhy)) f.push(`canSave mid-program: "${R1.saveWhy}" (want a refusal naming the program)`);
    if (canSave(R1.W.game, true) !== null && /program/.test(canSave(R1.W.game, true) ?? '')) f.push('canSave still refused by the Director after the program ended');
    F.verdict(f.length === 0, `onStart tick 0 · after(1.5) tick ${tickAt(1.5)} · onEvent(whistle) inside the step it is pushed (91) · when(t>1.25) tick ${wantClock} · any(wait, frames 3) → tick 3 index 1 · all(wait .5, frames 2) → tick ${wantSig} · onSignal the next tick · done(beat) the same tick · spawn + order + arrived + release over spawnUnit / squad.ts (walked, arrived, kept as AI on patrol) · doors.open / lights.group · a throwing beat failed at its step, a runaway caught, the program still finished · canSave refused mid-program only`, f.join('; ') || `${rows.length} rows; walked ${walked?.data?.secs} s; late@${late && fr(late)} clock@${clock && fr(clock)} heard@${heard && fr(heard)} signal@${sig && fr(sig)}; "${R1.saveWhy}"`);
  }
  { const same = R1.digest === R2.digest; let detail = `${R1.rows.length} rows identical`; if (!same) { const a = R1.digest.split('\n'), b = R2.digest.split('\n'); const i = a.findIndex((x, k) => x !== b[k]); detail = `first difference at row ${i}: "${a[i]}" vs "${b[i]}"`; }
    F.verdict(same, 'two seeded runs of the same program produce the same log row for row (what, beat, frame, data)', detail); }
  { // the expectations in the manifest, checked against the run: order of the named notes/beats
    const M = Dm.manifestOf(testScript); const exp = M.expects.find((e: any) => e.kind === 'order' && e.program === 'main'); const seq = R1.rows.filter((r: any) => r.kind === 'note').map((r: any) => r.what);
    let k = -1, ok = !!exp; const missing: string[] = []; for (const w of exp?.beats ?? []) { const i = seq.indexOf(w); if (i < 0) { missing.push(w); ok = false; continue; } if (i < k) ok = false; k = Math.max(k, i); }
    F.verdict(ok, "the script's own D.expect.order('main', [hello, walked, opened]) holds on the run's log (expectations live beside the beats they describe)", ok ? `notes: ${seq.join(' → ')}` : `missing ${missing.join(', ')} / out of order in ${seq.join(' → ')}`); }
  { // IDLE IDENTITY: the Director the shipped office is built with changes nothing — 40 s of the seeded live game digests exactly as the same game handed a fresh script-less Director (while the office carried a script this held the ARMED idle Director to that; the digest is the one it printed then)
    const digestOf = async (noScript: boolean) => { Math.random = seeded(4242); const W: any = await standUp(); if (noScript) W.game.director = new Dm.Director(W.game, null); Math.random = seeded(99); for (let i = 0; i < 40 / DT; i++) W.step(DT); return digestGame(W.game); };
    const a = await digestOf(false), b = await digestOf(true); const d = diffDigest(a, b);
    F.verdict(d.length === 0, "idle identity: 40 s of the seeded office with the Director it is built with (no program started) ≡ the same run with a script-less Director — the game is the game (the tactics / needs / civilians identity cards hold it against main's frozen digests from their side)", d.length ? d.join('; ') : `digest ${hashDigest(a)} both ways`); }
  return F.done();
}

if (import.meta.main) {   // bun run tools/qa/director-probes.ts [lint|scan|scheduler]
  const pick = argv.find(a => !a.startsWith('--'));
  let ok = true;
  if (!pick || pick === 'lint') ok = (await directorLint()) && ok;
  if (!pick || pick === 'scan') ok = (await directorShowcaseScan()) && ok;
  if (!pick || pick === 'scheduler') ok = (await directorScheduler()) && ok;
  process.exit(ok ? 0 : 1);
}
