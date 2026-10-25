// The REPLAY BUFFER's probes (src/game/replaybuf.ts → src/replay/format.ts):   bun run tools/qa/replaybuf-probes.ts [--write <file.json>] [--scenario '<query>'] [--level <file.json>] [--secs N]
//   identity   a game stepped with the buffer on digests, second by second, exactly as the same game stepped without it (the buffer only reads)
//   ring       the ring keeps `seconds` of play and no more, its head is always a keyframe, the file passes its own check and decodes
//   content    the trace holds what a bug report needs: every man each sample, a route for a walking man, a round with where it went, a door that moved
//   notes      a note put on the file survives the trip through JSON
//   fight      a room fight's teammate's row names the man his gun is on (the room fight's own record of him, read only)
//   tape       a run taped from its first step is walked again by a fresh game (tools/qa/rerun.ts) to the same places and the same digest; refusals are in words
//   load       a checkpoint loaded between two steps ends the tape as a load and is marked one in the trace whatever its clock says; a restart is a restart; a load
//              made inside a step leaves the tape alive; an F10 recording starting is neither
//   stand      a tape made on the page's rules is walked on them by a process that stands frozen (the tape names its stand and carries every knob table and the kit — the stealth card its run wore with it)
//   crash      the page's own save on an error (ui/replaykey.ts) makes one file a minute and three a page load, in a browser that keeps no shelf (where the file is a download);
//              the error itself is a line in the ring at its moment of PLAY, in every file made while the ring holds it
// --write: the content probe's file is written there (what the viewer page is developed against); --scenario / --level: that file is of a scenario on a level file
// instead of the quiet office (its walk / route / shot lines are then told, not judged: the scripted hands were written for the office). EXIT 0 all pass · 1 a failure.
import { writeFileSync } from 'node:fs';
import { standUp, ROOT } from './headless.ts';
const { ReplayBuffer, REPLAY } = await import(`${ROOT}/src/game/replaybuf.ts`);
const F = await import(`${ROOT}/src/replay/format.ts`);
const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
const { mulberry32 } = await import(`${ROOT}/src/math/dice.ts`);
const { levelFingerprint } = await import(`${ROOT}/src/game/savestate.ts`);

const argv = process.argv.slice(2); const val = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
let fails = 0;

// (the `stand` section's second child: the night alone played with a stealth card changed by hand — kit.ts KITDEAL.stealth: the sponge rounds taken off it — taped
// on whatever stand this process was started on, written to the file named; then nothing else runs)
if (val('stealth-tape-to')) {
  const Kt = await import(`${ROOT}/src/game/kit.ts`);
  Kt.kitMission({ rings: 5, cams: 2, wand: true }); Kt.kitSet(0, 'rings', 0); Kt.kitMission(null);
  Math.random = mulberry32(0xbeef);
  const W: any = await standUp({ seed: 21 }); W.game.godMode = true;
  const buf = new ReplayBuffer(); buf.tape.born(W.game);
  W.game.replayTap = (dt: number, cmd?: unknown) => { if (cmd) buf.top(W.game, dt, cmd); else buf.tick(W.game, dt, W.cam); };
  for (let f = 0; f < 300; f++) { const I = W.input, s = f / 60; I.keys.clear(); if (s > 1) I.keys.add('KeyW'); I.mouseX = 800 + 300 * Math.sin(s * 0.7); I.mouseY = 420; W.step(1 / 60); }
  writeFileSync(val('stealth-tape-to')!, JSON.stringify({ ...buf.file(W.game, 'probe', { url: '', fp: levelFingerprint(W.game) }), probeDigest: hashDigest(digestGame(W.game, true)), probeRule: Kt.kitStealthOn(), probeRings: W.game.player.rifle.rings }));
  process.exit(0);
}
// (the `stand` section's third child: the sneak lab as its page plays it — host/sneaklab.ts sneakLabBoot, less its panel: the game's restart wrapped to stage the
// scenario behind it, Sam stood at a scenario's start before the first step, the lab's two sandbox flags written every frame; then another scenario picked on the
// panel a few seconds in (between two steps), Shift+Enter (a restart the step makes itself), a debug teleport mid-walk and a slider moved with the control's
// event heard — taped on whatever stand this process was started on, written to the file named; then nothing else runs)
if (val('lab-tape-to')) {
  const { levelOf } = await import('./rerun.ts'), LAB = await import(`${ROOT}/src/host/sneaklab.ts`), { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
  const url = '?levelFile=sneak-lab.json&solo&sneaklab&scene=3';
  Math.random = mulberry32(0xbeef);
  const W: any = await standUp({ seed: 21, level: await levelOf('sneak-lab.json') }), g = W.game; startFromQuery(g, url);
  { const back = g.restart.bind(g); g.restart = (said?: string) => { back(said); LAB.stage(g); }; }
  LAB.SNEAKLAB.on = true; LAB.SNEAKLAB.scene = 2; LAB.stage(g);
  const buf = new ReplayBuffer(); buf.tape.born(g); const TWOGEARS = (await import(`${ROOT}/src/game/knobs.ts`)).knobsNamed().TWOGEARS as { crouch: number };
  g.replayTap = (dt: number, cmd?: unknown) => { if (cmd) buf.top(g, dt, cmd); else buf.tick(g, dt, W.cam); };
  for (let f = 0; f < 900; f++) { const I = W.input, s = f / 60; I.keys.clear(); if (s > 1) I.keys.add('KeyW'); I.mouseX = 800 + 300 * Math.sin(s * 0.7); I.mouseY = 420 + 150 * Math.cos(s * 0.5);
    if (f === 300) { LAB.SNEAKLAB.scene = 1; g.restart(); }
    if (f === 450) { I.keys.add('ShiftLeft'); I.pressed.add('Enter'); }
    if (f === 600) g.teleportPlayer([10.7, 0, 12.45]);
    if (f === 700) { TWOGEARS.crouch = 0.9; buf.tape.touched(); }
    LAB.sneakLabFrame(g); W.step(1 / 60); }
  writeFileSync(val('lab-tape-to')!, JSON.stringify({ ...buf.file(g, 'probe', { url, levelFile: 'sneak-lab.json', fp: levelFingerprint(g) }), probeDigest: hashDigest(digestGame(g, true)) }));
  process.exit(0);
}
// (the `stand` section's child: a room clear with the four taped on whatever stand this process was started on, written to the file named — then nothing else runs)
if (val('tape-to')) {
  const K = await import(`${ROOT}/src/game/knobs.ts`), Kt = await import(`${ROOT}/src/game/kit.ts`), { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
  // what a browser keeps per machine: a Team feel row (a table no recording carries — and one that moves this run: the teammates' legs), a kit card
  (K.knobsNamed().PACE as { accel: number }).accel = 0.6; Kt.KIT.members[4].suit = 'navy';   // (how fast a teammate's legs pick a walk up, 2.6 as built: it moves this run on either stand. The row here was PACE.max = 1.4 until the team's walk went under it — teampace.ts, 0.8 of the player's — and the cap stopped moving anything)
  Math.random = mulberry32(0xbeef);
  const W: any = await standUp({ seed: 21 }); const r = startFromQuery(W.game, 'roomclear&squad4'); if (r.why) throw new Error(r.why);
  const buf = new ReplayBuffer(); buf.tape.born(W.game);
  W.game.replayTap = (dt: number, cmd?: unknown) => { if (cmd) buf.top(W.game, dt, cmd); else buf.tick(W.game, dt, W.cam); };
  let digest = '';
  for (let f = 0; f < 20 * 60; f++) { const I = W.input, s = f / 60; I.keys.clear(); if (s > 1 && s < 9) I.keys.add('KeyW'); I.mouseX = 800 + 300 * Math.sin(s * 0.7); I.mouseY = 420 + 150 * Math.cos(s * 0.5);
    if (f === 120 || f === 700) I.pressed.add('KeyB'); W.step(1 / 60); if (f + 1 === 1140) digest = hashDigest(digestGame(W.game, true)); }
  writeFileSync(val('tape-to')!, JSON.stringify({ ...buf.file(W.game, 'probe', { url: '?roomclear&squad4', fp: levelFingerprint(W.game) }), probeDigest: digest }));
  process.exit(0);
}
const check = (ok: boolean, text: string) => { console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${text}`); if (!ok) fails++; };

/** a scripted minute of hands: walk, turn the aim, draw, fire, crouch — the same every call */
function hands(W: any, f: number): void {
  const I = W.input; const s = f / 60;
  I.keys.clear();
  if (s > 0.5 && s < 6) I.keys.add('KeyW'); if (s > 3 && s < 5) I.keys.add('KeyD'); if (s > 9 && s < 12) I.keys.add('KeyS');
  I.mouseX = 800 + 300 * Math.sin(s * 0.7); I.mouseY = 500 + 200 * Math.cos(s * 0.5);
  if (f === 400) I.pressed.add('KeyE');
  if (f === 470 || f === 500 || f === 530) { I.clicked |= 1; I.buttons |= 1; } else I.buttons = 0;
  if (f === 700) I.pressed.add('KeyC');
}
async function run(secs: number, tap: boolean, query: string | null, levelFile: string | null = null): Promise<{ W: any; buf: any; hashes: string[] }> {
  Math.random = mulberry32(0xbeef);
  const W = await standUp({ seed: 7, ...(levelFile ? { level: await (await import('./rerun.ts')).levelOf(levelFile) } : {}) });
  if (query) { const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`); const r = startFromQuery(W.game, query); if (r.why) console.log(`  (scenario '${query}' refused: ${r.why})`); }
  const buf = new ReplayBuffer();
  if (tap) { buf.tape.born(W.game); W.game.replayTap = (dt: number, cmd?: unknown) => { if (cmd) buf.top(W.game, dt, cmd); else buf.tick(W.game, dt, W.cam); }; }
  const hashes: string[] = [];
  for (let f = 0; f < secs * 60; f++) { hands(W, f); W.step(1 / 60); if ((f + 1) % 60 === 0) hashes.push(hashDigest(digestGame(W.game, true))); }
  return { W, buf, hashes };
}

console.log('\n=== replay buffer ===');
// ---- identity
{ const a = await run(20, false, null), b = await run(20, true, null);
  const first = a.hashes.findIndex((h, i) => h !== b.hashes[i]);
  check(first < 0 && a.hashes.length === 20, `identity: 20 s with the buffer on digest as 20 s without it (${a.hashes.length} digests${first >= 0 ? `, FIRST DIFFERENCE at second ${first + 1}` : ''})`);
  check(!b.buf.broke && b.buf.seconds > 19, `identity: the buffer ran the whole stretch (${b.buf.summary()})`); }
// ---- ring
{ const keep = REPLAY.seconds; REPLAY.seconds = 10;
  const { W, buf } = await run(32, true, null); const file = buf.file(W.game, 'probe');
  REPLAY.seconds = keep;
  const bad = F.checkReplay(file);
  check(bad === '', `ring: the file passes its own check${bad ? ` — ${bad}` : ''}`);
  check(file.seconds >= 10 && file.seconds <= 10 + REPLAY.keySecs + 0.1, `ring: asked to keep 10 s, holds ${file.seconds} s (10 ‥ ${10 + REPLAY.keySecs})`);
  check(file.samples[0].k === 1 && file.samples[0].r === 0, `ring: the head is a keyframe at 0 (r ${file.samples[0].r})`);
  const D = F.decode(file); const n0 = D.men[0].filter(Boolean).length, nMen = 1 + W.game.guards.length + W.game.civilians.length;
  check(n0 === nMen, `ring: the first sample places every man there is (${n0} of ${nMen})`);
  check(file.events.every((e: any) => e.r >= 0) && file.lines.every((l: any) => l.r >= 0), 'ring: nothing in the file is from before its head'); }
// ---- content
{ const secs = Number(val('secs') ?? 25), query = val('scenario') ?? null, levelFile = val('level') ?? null, judged = !query && !levelFile;
  const said = (ok: boolean, text: string) => judged ? check(ok, text) : console.log(`  (${ok ? 'yes' : 'no'}: ${text})`);
  const { W, buf } = await run(secs, true, query, levelFile);
  const fp = levelFingerprint(W.game);
  const file = buf.file(W.game, 'probe', { commit: 'probe', url: query ? `?${query}` : '', fp, ...(levelFile ? { levelFile } : {}) });
  const D = F.decode(file); const json = JSON.stringify(file);
  check(F.checkReplay(file) === '', 'content: the file passes its own check');
  const sam = file.cast.findIndex((c: any) => c.kind === 'player'); const s0 = D.men[0][sam], s1 = D.men[D.men.length - 1][sam];
  said(!!s0 && !!s1 && Math.hypot(s1.x - s0.x, s1.z - s0.z) > 1, `content: Sam walked and the trace says so (${s0 ? `(${s0.x}, ${s0.z})` : '?'} → ${s1 ? `(${s1.x}, ${s1.z})` : '?'})`);
  const real = W.game.player.char.pos; check(!!s1 && Math.abs(s1.x - real[0]) < 0.011 && Math.abs(s1.z - real[2]) < 0.011, 'content: the last sample is where Sam stands now, to the centimetre');
  const routed = file.samples.some((q: any) => (q.x ?? []).some(([, d]: [number, any]) => d.path && d.path.length >= 2));
  said(routed, 'content: a walking man carries the route ahead of him');
  const shot = file.events.find((e: any) => e.k === 'shot' && e.to);
  if (shot) check(shot.who === sam, `content: Sam's round is filed with where it went and whose it was (who ${shot.who})`); else console.log(`  (no round fired in this run — events: ${[...new Set(file.events.map((e: any) => e.k))].join(', ') || 'none'})`);
  check(file.map.boxes.length >= 6 * 20 && file.map.doors.length === W.game.doors.list.length, `content: the map holds ${file.map.boxes.length / 6} solids and ${file.map.doors.length} doors`);
  console.log(`  ${file.samples.length} samples · ${file.cast.length} cast · ${file.events.length} events · ${file.lines.length} lines · ${(json.length / 1024).toFixed(0)} KB of JSON for ${file.seconds} s (${(json.length / Math.max(1, file.seconds) / 1024).toFixed(1)} KB/s) · ${(Bun.gzipSync(new TextEncoder().encode(json)).length / 1024).toFixed(0)} KB gzipped`);
  // ---- notes
  file.notes.push({ id: 'n1', r: file.seconds / 2, t: 0, n: 0, pos: [12.5, 14.25], text: 'he walks into the wall here', at: new Date().toISOString() });
  const back = JSON.parse(JSON.stringify(file));
  check(F.checkReplay(back) === '' && back.notes.length === 1 && back.notes[0].text === 'he walks into the wall here' && back.notes[0].pos[1] === 14.25, 'notes: a note survives the trip through JSON');
  const out = val('write'); if (out) { writeFileSync(out, JSON.stringify(back)); console.log(`  wrote ${out}`); } }

// ---- fight: the man a room fight's teammate has his gun on is on his row (the room fight keeps him on its own record, not on the guard AI's)
{ const { W, buf } = await run(4, true, 'roomclear&squad4');
  const g = W.game, mate = g.guards.find((x: any) => x.unit && x.team === 'operative' && x.state !== 'dead'), foe = g.guards.find((x: any) => x.team === 'hostile' && x.state !== 'dead'), O = mate ? g.fight.opOf(mate) : null;
  check(!!O && !!foe && g.fight.live, `fight: a room clear is up with a teammate on the room fight's books (${mate?.callsign ?? '?'})`);
  if (O && foe) { const was = O.tgt; O.tgt = foe; for (let i = 0; i < 6; i++) buf.tick(g, 1 / 60, W.cam); O.tgt = was;   // (set between two steps and put back: the room fight never sees it)
    const D = F.decode(buf.file(g, 'probe', { url: '?roomclear&squad4', fp: levelFingerprint(g) })), ci = D.file.cast.findIndex((c: any) => c.name === mate.callsign), cf = D.file.cast.findIndex((c: any) => c.name === foe.callsign), last = D.men[D.men.length - 1][ci];
    check(ci >= 0 && cf >= 0 && last?.do?.foe === cf, `fight: his row says whom the gun is on (${last?.do ? F.doWords(last.do, D.file.cast) : 'no row'})`); } }

// ---- tape: a run taped from its first step — hands, a camera that turns, a restart and a sandbox switch from outside a step — walked again by a fresh game
{ const { rerun, rerunWords } = await import('./rerun.ts');
  Math.random = mulberry32(0xbeef);
  const W = await standUp({ seed: 11 }); const buf = new ReplayBuffer(); buf.tape.born(W.game);
  // (headless nothing answers the sensors, so a tape made here never held a number. This run's are answered while its steps run: dim values off a die of their
  // own, two in three a 32-bit float as the page's renderer hands back, the rest doubles, and now and then no answer or a minus zero, as a page's tape has —
  // the tape writes every kind and the re-run must be served each one to the bit. WHICH kind is a die's too, never the read's number: with every eleventh read
  // unanswered and a stand that makes eleven reads a step, one sensor went unanswered all run and the tape, which writes changes, held 'no answer' once)
  const given: (number | undefined)[][] = []; let answering = false;
  { const S = W.game.sensors as any, read0 = S.read, die = mulberry32(99), kind = mulberry32(1199);
    S.read = function (this: unknown, key: string) { if (!answering) return read0.call(this, key);
      const v = 0.02 + 0.3 * die(), k = kind(), out = k < 1 / 11 ? undefined : k < 1 / 11 + 1 / 37 ? -0 : k < 0.42 ? v : Math.fround(v); given[given.length - 1].push(out); return out; }; }
  W.game.replayTap = (dt: number, cmd?: unknown) => { if (cmd) buf.top(W.game, dt, cmd); else buf.tick(W.game, dt, W.cam); };
  const N = 30 * 60; let dAt = ''; const { PACE, LIGHTS } = await import(`${ROOT}/src/game/guards.ts`), pace0 = PACE.max, lit0 = { ...LIGHTS }, { RUNTAPE } = await import(`${ROOT}/src/game/runtape.ts`);
  for (let f = 0; f < N; f++) {
    hands(W, f); W.cam.yaw = 0.4 * Math.sin(f / 90); W.cam.rebuild();
    if (f === 700) { LIGHTS.litM += 1; W.game.restartEncounter(); }         // (the down card's button: from outside a step)
    if (f === 900) W.game.godMode = true;              // (the pause card's switch)
    if (f === 1000) { PACE.max += 0.25; LIGHTS.litAt += 0.01; }                 // (a Tab row moved mid-run: the tape looks at a table or two a step, so within tablesEvery steps)
    if (f === 1600) for (let i = 0; i < 70; i++) W.game.events.push({ kind: 'prop', pos: [3 + i * 0.01, 0, 3], time: W.game.time, loud: false, level: 0, who: 0 });   // (seventy things heard on one step)
    given.push([]); answering = true; W.step(f % 7 === 0 ? 1 / 50 : 1 / 60); answering = false;
    if (f + 1 === 1500) dAt = hashDigest(digestGame(W.game, true));
  }
  const file = JSON.parse(JSON.stringify(buf.file(W.game, 'probe', { url: '', fp: levelFingerprint(W.game) })));
  check(!!file.rerun && !file.rerun.dead && file.rerun.ticks === N, `tape: the file carries the run from its first step (${buf.tape.summary()})`);
  check(file.rerun?.x?.some((x: any) => x[1] === 'restart') && file.rerun?.x?.some((x: any) => x[1] === 'flags'), 'tape: the restart and the sandbox switch made from outside a step are on it');
  { const rows = (file.rerun?.x ?? []).filter((x: any) => x[1] === 'table' && x[2]?.[0] === 'PACE');
    check(rows.length === 1 && rows[0][0] >= 1000 && rows[0][0] <= 1000 + RUNTAPE.tablesEvery && rows[0][2][1].max === pace0 + 0.25, `tape: a table moved mid-run is on it once, within ${RUNTAPE.tablesEvery} steps (PACE at step ${rows[0]?.[0]})`);
    const xs = file.rerun?.x ?? [], lit = xs.filter((x: any) => x[1] === 'table' && x[2]?.[0] === 'LIGHTS'), iR = xs.findIndex((x: any) => x[1] === 'restart');
    check(lit.length === 2 && lit[1][0] === rows[0]?.[0], `tape: a second table written with it is on the tape on the same step (LIGHTS at ${lit[1]?.[0]})`);
    check(iR >= 0 && lit[0]?.[0] === xs[iR][0] && xs.indexOf(lit[0]) < iR, `tape: a table moved before a restart is on the tape ahead of the restart, on its step (${lit[0]?.[0]})`);
    const crowd = file.events.filter((e: any) => e.k === 'prop' && Math.abs(e.z - 3) < 1e-6 && e.x >= 3 && e.x < 3.71).length;
    check(crowd === 70, `content: seventy events filed on one step are all in the trace, once each (${crowd})`); }
  const back = (): void => { PACE.max = pace0; Object.assign(LIGHTS, lit0); }; back();
  const tapeBytes = JSON.stringify(file.rerun).length; console.log(`  tape: ${(tapeBytes / 1024).toFixed(0)} KB for ${N} steps (${(tapeBytes / N).toFixed(0)} B a step)`);
  const servedV: (number | undefined)[] = [];
  const R = await rerun(file, { toN: 1500, served: v => servedV.push(v) });
  check(!R.refuse && !!R.report, `tape: a fresh game is walked to step 1500${R.refuse ? ` — REFUSED: ${R.refuse}` : ''}`);
  if (R.report && R.W) {
    for (const ln of rerunWords(R.report, file)) console.log(`  ${ln}`);
    check(R.report.compared > 100 && !R.report.drift && (R.report.worst?.metres ?? 1) < 0.011, `tape: held against ${R.report.compared} trace samples, every man within a centimetre of where the first run had him (worst ${R.report.worst?.metres.toFixed(3)} m)`);
    check(hashDigest(digestGame(R.W.game, true)) === dAt, 'tape: at step 1500 the re-run digests exactly as the first run did there');
    check(R.report.unjournaled === 0, `tape: every sensor read was on the tape (${R.report.unjournaled} not)`);
    { const wd = R.W.engine.world, nS = wd.statics.length, tail = wd.all.slice(nS);   // (the cursor's ray reads `all`: it must hold this step's boxes, not the stand-up's)
      check(tail.length > 0 && tail.length === wd.dynamics.length && tail.every((b: any, i: number) => b === wd.dynamics[i]) && wd.dynamics === R.W.game.dynBoxes, `tape: the re-run's world is packed after its last step (${tail.length} moving boxes for the cursor's ray, the game's ${R.W.game.dynBoxes.length})`); }
  }
  // the sensor values: a 32-bit float is nine digits on the tape and the same float off it; anything else is kept whole
  { const { tapeF32, tapeNum } = await import(`${ROOT}/src/replay/format.ts`), { encodeValue, decodeValue } = await import(`${ROOT}/src/game/sensors.ts`);
    const rnd = mulberry32(77), f32s: number[] = [0, 1, -1, 0.1, 1 / 3, 16777217, 1.401298464324817e-45, 1.1754943508222875e-38, 3.4028234663852886e38, -3.4028234663852886e38, 0.30000001192092896].map(Math.fround);
    { const u = new Uint32Array(1), f = new Float32Array(u.buffer); for (let i = 0; i < 200000; i++) { u[0] = (rnd() * 4294967296) >>> 0; if (Number.isFinite(f[0])) f32s.push(f[0]); } for (let i = 0; i < 50000; i++) f32s.push(Math.fround(rnd() * (i % 5 ? 1 : 4000))); }
    let badF = 0, strF = 0, chars = 0, full = 0; for (const v of f32s) { const e = JSON.parse(JSON.stringify(tapeF32(v))); if (typeof e !== 'number') strF++; if (!Object.is(tapeNum(e, true), v)) badF++; chars += JSON.stringify(e).length; full += JSON.stringify(v).length; }
    check(badF === 0 && strF === 0, `tape: ${f32s.length} 32-bit floats come back off nine digits to the bit, each a plain number (${badF} wrong, ${strF} not a number; ${(chars / f32s.length).toFixed(1)} characters each for ${(full / f32s.length).toFixed(1)})`);
    const odd = [0.1, 1 / 3, Math.PI, 1e-320, 1.7976931348623157e308, 16777217, 0.30000000000000004, -2.5e-9 / 3]; let badD = 0; for (const v of odd) { const e = JSON.parse(JSON.stringify(tapeF32(v))); if (!Array.isArray(e) || !Object.is(tapeNum(e, true), v)) badD++; }
    const words = [NaN, Infinity, -Infinity, -0, undefined].every(v => Object.is(tapeNum(JSON.parse(JSON.stringify(tapeF32(v as number))), true), v));
    check(badD === 0 && words, `tape: a value that is no 32-bit float is kept whole and comes back exact; nan, the infinities, minus zero and 'no answer' too (${badD} wrong)`);
    { let cross = 0; for (const v of [...f32s.slice(0, 60000), ...odd, NaN, Infinity, -Infinity, -0, undefined] as (number | undefined)[]) {   // (one encoding with the session journal's: sensors.ts)
        if (!Object.is(decodeValue(JSON.parse(JSON.stringify(tapeF32(v)))), v) || !Object.is(tapeNum(JSON.parse(JSON.stringify(encodeValue(v))), true), v)) cross++; }
      check(cross === 0, `tape: the session journal's reader reads the tape's values and the tape's reader the journal's, to the bit (${cross} off)`); }
    const vals: unknown[] = []; for (const r of file.rerun.sens.rows) { if (r[1]) vals.push(...r[2]); else for (let i = 1; i < r[2].length; i += 2) vals.push(r[2][i]); }
    const nNum = vals.filter(v => typeof v === 'number').length, nArr = vals.filter(v => Array.isArray(v)).length, nNone = vals.filter(v => v === null).length, nZero = vals.filter(v => v === '-0').length;
    check(file.rerun.sens.f32 === 1 && nNum > 20 && nArr > 20 && nNone > 20 && nZero > 20, `tape: the file says its sensor values are floats at nine digits, and this run wrote every kind (${nNum} floats, ${nArr} whole doubles, ${nNone} with no answer, ${nZero} minus zeros)`);
    { let cur: unknown[] = [], ri = 0, off = 0, steps = 0; const rows = file.rerun.sens.rows;   // (every step's values as a reader gets them, against what the game was handed)
      for (let f = 0; f < N; f++) { for (; ri < rows.length && rows[ri][0] <= f; ri++) { const [, q, v] = rows[ri]; if (q) cur = v.slice(); else for (let i = 0; i < v.length; i += 2) cur[v[i]] = v[i + 1]; }
        const G = given[f]; if (G.length) steps++; if (cur.length !== G.length) off++; else for (let i = 0; i < G.length; i++) if (!Object.is(tapeNum(cur[i] as any, true), G[i])) off++; }
      check(off === 0 && steps > N / 2, `tape: read back with the file's own rule, every sensor value of every step is the one the game was handed, to the bit (${off} off over ${steps} steps that read any)`); }
    { const want = given.slice(0, 1500).flat(); let off = servedV.length === want.length ? 0 : 1; for (let i = 0; i < want.length && i < servedV.length; i++) if (!Object.is(servedV[i], want[i])) off++;
      check(off === 0 && want.length > 1000, `tape: the re-run handed its game the very values the first game was handed, read for read, to the bit (${off} off of ${want.length})`); }
    // (a tape from before the rule: every value the double itself, no word about floats — it must be walked as it always was)
    const old = JSON.parse(JSON.stringify(file)); delete old.rerun.sens.f32;
    const wide = (e: unknown): unknown => { const v = tapeNum(e as any, true); return typeof v === 'number' && Number.isFinite(v) && !Object.is(v, -0) ? v : e; };
    for (const r of old.rerun.sens.rows) { if (r[1]) r[2] = r[2].map(wide); else for (let i = 1; i < r[2].length; i += 2) r[2][i] = wide(r[2][i]); }
    const grew = JSON.stringify(old.rerun.sens).length, now = JSON.stringify(file.rerun.sens).length;
    back(); const RO = await rerun(JSON.parse(JSON.stringify(old)), { toN: 1500 });
    check(!RO.refuse && !!RO.W && hashDigest(digestGame(RO.W.game, true)) === dAt && RO.report?.unjournaled === 0, `tape: the same run on a tape written the old way (every value in full: ${(grew / 1024).toFixed(0)} KB of sensor rows for ${(now / 1024).toFixed(0)} KB) is walked to the same digest`);
  }
  back();   // (the re-run left this process on the tape's tables)
  // a tape that cannot follow says so
  const dead = JSON.parse(JSON.stringify(file)); dead.rerun = { dead: 'a checkpoint was loaded', tick: 12 };
  const R2 = await rerun(dead); check(!!R2.refuse && /checkpoint/.test(R2.refuse), `tape: a tape that ended is refused in words (${R2.refuse.slice(0, 70)}…)`);
  const other = JSON.parse(JSON.stringify(file)); other.level.fp = 'deadbeef'; other.commit = 'abc1234';
  const R3 = await rerun(other, { toN: 10 }); check(!!R3.refuse && /abc1234/.test(R3.refuse), 'tape: another level is refused, naming the commit to check out');
  // a tape older (or newer) than this build's knobs: a key it does not carry is played at this build's value, and the report says which, and the commit to walk it at
  { const notes = (r: Awaited<ReturnType<typeof rerun>>) => (r.report?.warnings ?? []).filter(w => /the tape does not carry|this build does not play/.test(w));
    check(!!R.report && notes(R).length === 0, `tape: a tape of this build is not called older or newer than its knobs (${notes(R).length} such notes)`);
    const old = JSON.parse(JSON.stringify(file)), rc = old.rerun.recipe, obj = (v: unknown) => v !== null && typeof v === 'object' && !Array.isArray(v); old.commit = 'abc1234';
    const big = Object.keys(rc.tables).filter(k => obj(rc.tables[k]) && Object.keys(rc.tables[k]).length >= 3), [t1, t2] = big, [k1, k2] = Object.keys(rc.tables[t1]);
    const num = Object.keys(rc.tables[t1]).find(k => k !== k1 && k !== k2 && typeof rc.tables[t1][k] === 'number') ?? '', jn = Object.keys(rc.knobs.tables)[0], jk = Object.keys(rc.knobs.tables[jn])[0], tk = Object.keys(rc.knobs.tune)[0];
    const outer = typeof rc.knobs.tables.WALLCHARGE?.outer === 'boolean';
    delete rc.tables[t1][k1]; delete rc.tables[t1][k2]; delete rc.tables[t2]; rc.tables[t1].zzGone = 1; if (num) rc.tables[t1][num] = true; delete rc.knobs.tables[jn][jk]; delete rc.knobs.tune[tk]; if (outer) delete rc.knobs.tables.WALLCHARGE.outer;
    const R4 = await rerun(old, { toN: 10 }), N4 = notes(R4), has = (re: RegExp, ...words: string[]) => N4.some(w => re.test(w) && words.every(x => w.includes(x)));
    check(!R4.refuse && has(/the tape does not carry/, `${t1}.${k1}`, `${t1}.${k2}`, `${t2} (the whole table`, "THIS build's value"), `tape: keys added to a table since the tape was saved are named (${t1}.${k1}, ${t1}.${k2}, all of ${t2}): ${N4[0]?.slice(0, 60)}…`);
    check(has(/the tape does not carry/, `${jn}.${jk}`, `tune.${tk}`), `tape: so are a key of a recording's table and one of the game's tune (${jn}.${jk}, tune.${tk})`);
    check(has(/this build does not play/, `${t1}.zzGone`) && (!num || has(/this build does not play/, `${t1}.${num} (a boolean on the tape, a number here)`)), `tape: and a key the tape has that this build lacks, and one of another kind here (${t1}.zzGone, ${t1}.${num || '–'})`);
    check(outer && has(/the tape does not carry/, 'WALLCHARGE.outer') && (process.env.TPS_PROFILE !== 'shipped' || has(/before (it|them) by journal\.ts/, 'WALLCHARGE.outer')), 'tape: a key journal.ts knows the older value of is named too, and said to have been given it where that moved it');
    check(N4.length >= 2 && N4.filter(w => w.includes('abc1234')).length === 1 && N4[N4.length - 1].includes('abc1234'), `tape: the commit to check out is said once, last (${N4.length} notes)`); }
  back(); }

// ---- load: a checkpoint loaded BETWEEN two steps is never read as a restart, whatever its clock says — one of an earlier visit with a LATER clock, one loaded
// with no step since it was saved, one loaded a few steps after; a restart is still a restart; a load made INSIDE a step (the bare Enter once down) is the step's
// own input: the tape lives, the trace marks it once and loses nothing of the next step; an F10 recording starting is neither a restart nor a load
{ const { saveState } = await import(`${ROOT}/src/game/savestate.ts`);
  const stand = async (seed: number, steps: number, god = true, still = false) => { Math.random = mulberry32(seed); const W: any = await standUp({ seed: 11 }); W.game.godMode = god; const buf = new ReplayBuffer(); buf.tape.born(W.game);   // (god mode: the scripted hands get Sam shot inside ten seconds, and a man who is down saves nothing)
    W.game.replayTap = (dt: number, cmd?: unknown) => { if (cmd) buf.top(W.game, dt, cmd); else buf.tick(W.game, dt, W.cam); };
    let f = 0; const go = (n: number, pre?: () => void) => { for (let i = 0; i < n; i++, f++) { if (still) { W.input.keys.clear(); } else hands(W, f); pre?.(); W.step(1 / 60); } }; go(steps); return { W, buf, go }; };
  const read = (W: any, buf: any) => { const file = JSON.parse(JSON.stringify(buf.file(W.game, 'probe', { url: '', fp: levelFingerprint(W.game) }))), text = JSON.stringify(file), n = (re: RegExp) => (text.match(re) ?? []).length;
    return { file, dead: String(buf.tape.dead || ''), loads: n(/a checkpoint loaded/g), restarts: n(/restart \(a fresh run/g), recs: n(/an F10 recording started/g) }; };
  const earlier = await stand(0xa11, 600), old = saveState(earlier.W.game, { label: 'an earlier visit', kind: 'manual', force: true }); earlier.W.game.replayTap = null;
  { const { W, buf, go } = await stand(0xa12, 200), why = W.game.saves.load(W.game, JSON.parse(JSON.stringify(old))); go(120); const r = read(W, buf);
    check(why === null && W.game.time > 9 && /checkpoint/.test(r.dead) && r.loads === 1 && !r.restarts, `load: a checkpoint of an earlier visit, its clock LATER than this page's, ends the tape as a load and is marked one in the trace (tape: ${r.dead || 'alive'}${why ? `; load refused: ${why}` : ''})`);
    W.game.replayTap = null; }
  { const { W, buf, go } = await stand(0xa13, 200), s = saveState(W.game, { label: 'now', kind: 'manual', force: true }), why = W.game.saves.load(W.game, s); go(120); const r = read(W, buf);
    check(why === null && /checkpoint/.test(r.dead) && r.loads === 1 && !r.restarts, `load: one loaded with no step since it was saved, the clock the same to the bit, is a load too (tape: ${r.dead || 'alive'}${why ? `; load refused: ${why}` : ''})`);
    W.game.replayTap = null; }
  { const { W, buf, go } = await stand(0xa14, 200), s = saveState(W.game, { label: 'ten steps ago', kind: 'manual', force: true }); go(10); const why = W.game.saves.load(W.game, s); go(120); const r = read(W, buf);
    check(why === null && /checkpoint/.test(r.dead) && r.loads === 1 && !r.restarts, `load: one loaded ten steps after it was saved is a load in the trace as on the tape (tape: ${r.dead || 'alive'}${why ? `; load refused: ${why}` : ''})`);
    W.game.replayTap = null; }
  { const { W, buf, go } = await stand(0xa15, 200); W.game.restartEncounter(); go(120); const r = read(W, buf);
    check(!r.dead && r.restarts === 1 && !r.loads, `load: a restart is still a restart, the tape alive (tape: ${r.dead || 'alive'})`);
    // the run a file ends in: where the viewer opens a file saved from the end card (format.ts lastRun)
    { const mk = r.file.lines.find((l: any) => l.k === 'mark' && /^restart \(/.test(l.text)), at = F.lastRun(r.file), none = F.lastRun({ lines: r.file.lines.filter((l: any) => l !== mk) });
      W.game.restartEncounter(); go(60); const r2 = read(W, buf), at2 = F.lastRun(r2.file), D2 = F.decode(r2.file), first = D2.r.find((x: number) => x >= at2);
      check(!!mk && at === mk.r && at > 3 && at < r.file.seconds - 1.5 && none === 0 && r2.restarts === 2 && at2 > at + 1.5 && first !== undefined && first - at2 < 0.5,
        `load: lastRun names the last restart's moment, where the run a file ends in began (one restart ${at.toFixed(2)} s of ${r.file.seconds.toFixed(2)}; a second ${at2.toFixed(2)} s of ${r2.file.seconds.toFixed(2)}, a sample ${first === undefined ? 'never' : (first - at2).toFixed(2) + ' s'} after it; no restart ${none})`); }
    W.game.replayTap = null; }
  { const { W, buf, go } = await stand(0xa16, 100, false), wrote = W.game.saves.write(W.game, 'manual', 'probe', true); let n = 0; while (!W.game.player.down && n < 400) { go(1); n++; }
    const byHand = !W.game.player.down; if (byHand) W.game.player.down = true;   // (on a stand whose night watch does not find him in time he is put down by hand: the Enter's road is the same)
    const loads0 = W.game.saves.stats.loads; go(1, () => W.input.pressed.add('Enter')); const inStep = W.game.saves.stats.loads === loads0 + 1 && !W.game.player.down;
    go(1, () => W.game.events.push({ kind: 'prop', pos: [3.33, 0, 3.33], time: W.game.time, loud: false, level: 0, who: 0 })); go(60); const r = read(W, buf);
    const kept = r.file.events.filter((e: any) => e.k === 'prop' && Math.abs(e.x - 3.33) < 1e-6 && Math.abs(e.z - 3.33) < 1e-6).length;
    check(inStep, `load: Sam went down and a bare Enter loaded this run's checkpoint inside a step (down ${byHand ? 'by hand' : `after ${n} steps`}; wrote ${JSON.stringify(wrote)?.slice(0, 60)})`);
    check(!r.dead && r.loads === 1 && !r.restarts && kept === 1, `load: a load made inside a step leaves the tape alive, is marked once, and the step after it loses nothing (tape: ${r.dead || 'alive'}; ${r.loads} marks; the next step's event filed ${kept}×)`);
    W.game.replayTap = null; }
  // …and a save kept IN MEMORY (a team on the floor: savestate.ts loadMem puts the whole game back, the Sensors object with it) loaded inside a step. All of it is
  // on the tape — F5's save, his own frag that puts him down, the bare Enter — so the tape lives and its re-run is the first run again, to the digest.
  { const SS = await import(`${ROOT}/src/game/savestate.ts`), { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`), { rerun } = await import('./rerun.ts'), Q = '?roomclear&squad4&freshstart=0&seed=7', was = SS.SAVETIMELINE.on;
    try {
      Math.random = mulberry32(0xa18); const W: any = await standUp({ seed: 7 }), g = W.game; startFromQuery(g, Q); SS.SAVETIMELINE.on = true; g.godMode = true;
      const buf = new ReplayBuffer(); buf.tape.born(g); g.replayTap = (dt: number, cmd?: unknown) => { if (cmd) buf.top(g, dt, cmd); else buf.tick(g, dt, W.cam); };
      let f = 0, still = false; const go = (n: number, pre?: () => void) => { for (let i = 0; i < n; i++, f++) { const I = W.input; I.keys.clear(); I.buttons = 0; I.mouseX = 800; I.mouseY = 520; if (!still && f % 240 < 150) I.keys.add('KeyW'); pre?.(); W.step(1 / 60); } };
      go(240); go(1, () => W.input.pressed.add('F5')); go(42); const mem = (g.saves.timeline() as any[]).filter(x => x.mem).length;
      g.godMode = false; still = true; go(30); go(1, () => W.input.pressed.add('Digit5')); go(30);   // (the flag is a row of the tape; the frag lands at his own feet)
      for (let k = 0; k < 3 && !g.player.down; k++) { go(1, () => { W.input.clicked |= 1; W.input.buttons |= 1; }); go(62, () => { if (f % 62 < 2) W.input.buttons |= 1; }); }
      let n = 0; while (!g.player.down && n < 900) { go(1); n++; } still = false; go(20);
      const loads0 = g.saves.stats.loads, down = g.player.down; go(1, () => W.input.pressed.add('Enter')); const inStep = down && g.saves.stats.loads === loads0 + 1 && !g.player.down;
      g.godMode = true; go(240); const N = f, dEnd = hashDigest(digestGame(g, true)), file = JSON.parse(JSON.stringify(buf.file(g, 'probe', { url: Q, fp: levelFingerprint(g) }))), marks = (JSON.stringify(file).match(/a checkpoint loaded/g) ?? []).length;
      check(mem === 1 && inStep, `load: with a team on the floor F5 kept a save in memory, and a bare Enter once down loaded it inside a step (saves in memory ${mem}; down ${down}; loads ${loads0} → ${g.saves.stats.loads})`);
      check(!buf.tape.dead && file.rerun?.ticks === N && marks === 1, `load: the tape lives across it, holds every step, and the load is marked once (tape: ${buf.tape.dead || 'alive'}; ${file.rerun?.ticks} of ${N} steps; ${marks} marks)`);
      const R = await rerun(file, { toN: N }), same = !!R.W && hashDigest(digestGame(R.W.game, true)) === dEnd;
      check(!R.refuse && !!R.report && R.report.compared > 50 && !R.report.drift && same, `load: its re-run is the first run again, to the digest at step ${N}${R.refuse ? ` — REFUSED: ${R.refuse}` : ` (${R.report?.compared} trace samples, worst ${R.report?.worst?.metres?.toFixed(3)} m, drift ${R.report?.drift ? 'YES' : 'none'}, digest ${same ? 'equal' : 'DIFFERS'})`}`);
      g.replayTap = null;
    } finally { SS.SAVETIMELINE.on = was; } }
  { const { W, buf, go } = await stand(0xa17, 120, true, true), J = W.game.journal, random = Math.random, until = () => { let n = 0; while (!J.recording && n < 300) { go(1); n++; } return J.recording; };
    try {
      J.request({ seed: 5 }); const on = until(); go(30); const a = read(W, buf);
      check(on && /F10/.test(a.dead) && a.recs === 1 && !a.restarts && !a.loads, `load: an F10 recording starting ends the tape in those words and is marked as that in the trace, not as a restart (tape: ${a.dead || 'alive'}${on ? '' : `; it never started: ${J.why}`})`);
      J.stop('probe', true); J.request({ seed: 6 }); const again = until(); go(30); const b = read(W, buf);
      check(again && b.recs === 2 && !b.restarts && !b.loads, `load: one stopped and started again with no step between is seen too (${b.recs} marks)`);
      // a recorder that ends its file at a change made between two frames and asks for the next (journal.ts): the recording is running on both sides of the
      // gap, and the restart / the load in it is marked too, ahead of the recording's own mark — the run the file ends in begins at that restart
      { J.stop('probe', true); W.game.restartEncounter(); J.request({ seed: 7 }); const on2 = until(); go(30); const c = read(W, buf);
        const marks = c.file.lines.filter((l: any) => l.k === 'mark').map((l: any) => String(l.text)), iR = marks.findIndex((t: string) => /^restart \(/.test(t)), at = F.lastRun(c.file);
        check(on2 && c.recs === 3 && c.restarts === 1 && !c.loads && iR >= 0 && /F10/.test(marks[iR + 1] ?? '') && at > 1 && at < c.file.seconds,
          `load: a restart between a recording's end and the next one's start is marked a restart, ahead of the recording's mark, and is where the file's last run begins (${c.restarts} restart, ${c.recs} recordings; last run from ${at.toFixed(2)} s of ${c.file.seconds.toFixed(2)})`);
        const s = saveState(W.game, { label: 'under a recording', kind: 'manual', force: true }); go(10); J.stop('probe', true); const why = W.game.saves.load(W.game, s); J.request({ seed: 8 }); const on3 = until(); go(30); const d = read(W, buf);
        const m2 = d.file.lines.filter((l: any) => l.k === 'mark').map((l: any) => String(l.text)), iL = m2.findIndex((t: string) => /a checkpoint loaded/.test(t));
        check(why === null && on3 && d.recs === 4 && d.loads === 1 && d.restarts === 1 && iL >= 0 && /F10/.test(m2[iL + 1] ?? ''),
          `load: a checkpoint loaded in such a gap is marked a load, ahead of the recording's mark (${d.loads} load, ${d.recs} recordings${why ? `; load refused: ${why}` : ''})`); }
      const b2 = new ReplayBuffer(); b2.tape.born(W.game); W.game.replayTap = (dt: number, cmd?: unknown) => { if (cmd) b2.top(W.game, dt, cmd); else b2.tick(W.game, dt, W.cam); }; go(2);
      check(/F10/.test(String(b2.tape.dead || '')), `load: a tape handed a game already being recorded ends at its first step (tape: ${b2.tape.dead || 'alive'})`);
    } finally { try { J.stop('probe', true); } catch { /* */ } Math.random = random; W.game.replayTap = null; } } }

// ---- stand: a tape made on the page's rules (the child below stands as the page does) is walked on the page's rules by this process, whatever it stands as itself —
// a thread's `replay-at.ts --rerun` stands frozen; what a browser keeps per machine rides in the tape
{ const { rerun } = await import('./rerun.ts'), K = await import(`${ROOT}/src/game/knobs.ts`), Kt = await import(`${ROOT}/src/game/kit.ts`), J = await import(`${ROOT}/src/game/journal.ts`);
  const { tmpdir } = await import('node:os'), { readFileSync, rmSync } = await import('node:fs');
  const at = `${tmpdir()}/replaybuf-stand-${process.pid}.json`, keptTables = K.knobsCopy(), keptKit = JSON.stringify(Kt.KIT.members), word = process.env.TPS_PROFILE;
  const back = () => { K.knobsBack(keptTables); Kt.kitMission(null); Kt.KIT.members.length = 0; Kt.KIT.members.push(...JSON.parse(keptKit)); Kt.kitStealthSet(null); };
  try {
    const child = Bun.spawnSync([process.execPath, 'run', import.meta.path, '--tape-to', at], { env: { ...process.env, TPS_PROFILE: 'shipped' }, stdout: 'ignore', stderr: 'pipe', timeout: 180000 });
    check(child.exitCode === 0, `stand: a room clear with the four taped on the shipped stand${child.exitCode !== 0 ? ` — the child failed (${child.exitCode}): ${child.stderr.toString().slice(-300)}` : ''}`);
    if (child.exitCode === 0) {
      const file = JSON.parse(readFileSync(at, 'utf8')), rc = file.rerun.recipe, names = Object.keys(rc.tables ?? {});
      { const poses = (file.rerun.x as any[]).filter(x => x[1] === 'pose'); check(poses.length === 1 && poses[0][0] === 0, `stand: a run nobody stages or moves him in tapes where the player stands once, at its first step (${poses.length} such rows over ${file.rerun.ticks} steps)`); }
      check(rc.stand === 'shipped' && rc.tables?.PACE?.accel === 0.6 && !names.some(n => n in J.knobTables()) && names.length + Object.keys(rc.knobs.tables).length === Object.keys(K.knobsNamed()).length && rc.kit?.members?.[4]?.suit === 'navy',
        `stand: the tape says where it stood and carries the kit and every knob table once (${names.length} beside the ${Object.keys(rc.knobs.tables).length} a recording has)`);
      const same = (R: any) => !R.refuse && !!R.report && R.report.compared > 100 && !R.report.drift && hashDigest(digestGame(R.W.game, true)) === file.probeDigest;
      const R = await rerun(file, { toN: 1140 });
      check(same(R), `stand: walked here it is the same run, to the digest (${R.report?.compared} samples, worst ${R.report?.worst?.metres.toFixed(3)} m)`);
      { const odd = (R.report?.warnings ?? []).filter((w: string) => /the tape does not carry|this build does not play/.test(w)); check(odd.length === 0, `stand: a tape of this build made on another stand is not called older or newer than the tables${odd.length ? ` — ${odd[0].slice(0, 160)}` : ''}`); }
      check((K.knobsNamed().PACE as { accel: number }).accel === 0.6 && Kt.KIT.members[4].suit === 'navy' && process.env.TPS_PROFILE === word, 'stand: the re-run stood on the tape\'s own table and kit card, and left this process\'s stand word as it was');
      // the faults the tape's own tables and stand mend, each asserted with that part taken off the tape
      const less = (...keys: string[]) => { const f = JSON.parse(JSON.stringify(file)); for (const k of keys) delete f.rerun.recipe[k]; return f; };
      back(); const R1 = await rerun(less('tables'), { toN: 1140 });
      check(!same(R1), `stand: without its own tables the same tape is another run (${R1.report?.drift ? `parted at step ${R1.report.drift.n}` : 'the digest differs'}: a Team feel row this browser kept)`);
      if (word !== 'shipped') { back(); const R0 = await rerun(less('stand', 'words', 'tables', 'kit'), { toN: 1140 });
        check(!!R0.report?.drift, `stand: read as a tape with no stand named it parts from its trace (at step ${R0.report?.drift?.n}: the frozen stand's rules)`); }
      else console.log('  (this process stands shipped itself: the frozen-stand control is not asked)');
    }
    // the stealth card a run wore (kit.ts KITDEAL.stealth) rides in the tape beside the loud cards: a re-run in a process that never kept one wears the tape's
    { back(); const child2 = Bun.spawnSync([process.execPath, 'run', import.meta.path, '--stealth-tape-to', at], { env: { ...process.env, TPS_PROFILE: 'shipped' }, stdout: 'ignore', stderr: 'pipe', timeout: 180000 });
      check(child2.exitCode === 0, `stand: the night alone with a stealth card changed by hand taped on the shipped stand${child2.exitCode !== 0 ? ` — the child failed (${child2.exitCode}): ${child2.stderr.toString().slice(-300)}` : ''}`);
      if (child2.exitCode === 0) {
        const file = JSON.parse(readFileSync(at, 'utf8')), card = file.rerun?.recipe?.kit?.stealth;
        if (!file.probeRule) console.log('  (the shipped stand has the stealth card rule off: its tape carries no such card, nothing to judge)');
        else {
          check(!!card && card.rings === 0 && file.probeRings === 0, `stand: the tape carries the stealth card its run wore (sponge rounds on the card ${card?.rings}, in his launcher ${file.probeRings})`);
          const wore = (R: any) => R.W?.game.player.rifle.rings, same = (R: any) => !R.refuse && !!R.report && !R.report.drift && hashDigest(digestGame(R.W.game, true)) === file.probeDigest;
          const R = await rerun(file, { toN: 300 });
          check(same(R) && wore(R) === 0, `stand: walked here, where no stealth card was ever kept, it wears the tape's and is the same run to the digest (${wore(R)} sponge rounds; ${R.report?.drift ? `parted at step ${R.report.drift.n}` : `${R.report?.compared} samples`})`);
          back(); const f0 = JSON.parse(JSON.stringify(file)); delete f0.rerun.recipe.kit.stealth; const R0 = await rerun(f0, { toN: 300 });
          check(!same(R0) && wore(R0) > 0, `stand: with the card taken off the tape it wears the mission's kit and is another run (${wore(R0)} sponge rounds; ${R0.report?.drift ? `parted at step ${R0.report.drift.n}` : 'the digest differs'})`);
        }
      } }
    // where the player was PUT from outside a step rides in the tape ('pose' rows, runtape.ts): the sneak lab's page stands him at its scenario's start and again
    // after every restart, and none of that is the game's own (host/sneaklab.ts)
    { back(); const child3 = Bun.spawnSync([process.execPath, 'run', import.meta.path, '--lab-tape-to', at], { env: { ...process.env, TPS_PROFILE: 'shipped' }, stdout: 'ignore', stderr: 'pipe', timeout: 180000 });
      check(child3.exitCode === 0, `stand: the sneak lab as its page stages it (a scenario at the start, another picked on the panel, a teleport) taped on the shipped stand${child3.exitCode !== 0 ? ` — the child failed (${child3.exitCode}): ${child3.stderr.toString().slice(-300)}` : ''}`);
      if (child3.exitCode === 0) {
        const file = JSON.parse(readFileSync(at, 'utf8')), xs = (file.rerun?.x ?? []) as any[], poses = xs.filter(x => x[1] === 'pose'), ins = xs.filter(x => x[1] === 'posein'), iR = xs.findIndex(x => x[1] === 'restart');
        check(poses.length === 3 && poses[0][0] === 0 && poses[1][0] === 300 && poses[2][0] === 600 && iR >= 0 && xs[iR][0] === 300 && xs[iR + 1] === poses[1] && xs.filter(x => x[1] === 'restart').length === 1,
          `stand: the tape has where he was put from outside a step, and nothing else of the kind: at the first step, after the panel's restart (the row behind it) and at the teleport (${poses.length} rows, at steps ${poses.map(p => p[0]).join(', ')})`);
        check(ins.length === 1 && ins[0][0] === 450, `stand: …and where the restart a step made itself (Shift+Enter) left him, behind the lab's staging (${ins.length} row${ins.length === 1 ? '' : 's'}, at step ${ins.map(p => p[0]).join(', ')})`);
        { const tb = xs.filter(x => x[1] === 'table' && x[2]?.[0] === 'TWOGEARS'); check(tb.length === 1 && tb[0][0] === 700 && tb[0][2][1].crouch === 0.9, `stand: a slider moved with its control's event heard is taped at the step it first acts on (TWOGEARS at step ${tb.map(t => t[0]).join(', ') || 'none'})`); }
        const same = (R: any) => !R.refuse && !!R.report && R.report.compared > 100 && !R.report.drift && hashDigest(digestGame(R.W.game, true)) === file.probeDigest, said = (R: any) => R.report?.drift ? `parted at step ${R.report.drift.n}` : R.refuse ? `refused: ${String(R.refuse).slice(0, 120)}` : `${R.report?.compared} samples, worst ${R.report?.worst?.metres.toFixed(3)} m`;
        const R = await rerun(file, { toN: 900 });
        check(same(R), `stand: walked here, where no lab was ever opened, it is the same run to the digest (${said(R)})`);
        // …and with the rows taken off: read as a lab tape from before them it is stood at its address's scenario and holds until the panel's pick, which no such
        // tape has; with the lab's word off the address too, nobody stands him anywhere and it parts at once
        const less = (word: boolean, kinds = ['pose', 'posein']) => { const f = JSON.parse(JSON.stringify(file)); f.rerun.x = f.rerun.x.filter((x: any) => !kinds.includes(x[1])); if (!word) f.rerun.recipe.search = f.rerun.recipe.search.replace('&sneaklab', ''); return f; };
        back(); const R2 = await rerun(less(true, ['posein']), { toN: 900 }), n2 = R2.report?.drift?.n ?? -1;
        check(!same(R2) && n2 > 450 && n2 < 500, `stand: without the row of the restart made inside a step it is the same run up to that Shift+Enter, and another from it (${said(R2)})`);
        back(); const R1 = await rerun(less(true), { toN: 900 }), n1 = R1.report?.drift?.n ?? -1;
        check(!same(R1) && n1 > 300 && n1 < 400 && (R1.report?.warnings ?? []).some((w: string) => /from before the tape carried where the player was put/.test(w)),
          `stand: without the rows it is read as an older lab tape, stood at its address's scenario and said so: the same run up to the scenario picked on the panel, another after it (${said(R1)})`);
        back(); const R0 = await rerun(less(false), { toN: 900 }), n0 = R0.report?.drift?.n ?? -1;
        check(!same(R0) && n0 >= 0 && n0 < 30, `stand: without the rows and the lab's word nobody stands him at the scenario's start, and it parts from the first sample (${said(R0)})`);
      } }
  } finally { back(); { const L = (await import(`${ROOT}/src/host/sneaklab.ts`)).SNEAKLAB; L.scene = 0; L.unseen = true; }   // (an older lab tape's re-run stages with the lab's own table: as it was)
    try { rmSync(at); } catch { /* never written */ } } }

// ---- crash: an error that repeats makes ONE file a minute and three a page load, in a browser that keeps no shelf (bun has no IndexedDB: the shelf's own branch
// stamps through the same line of ReplayKey.put) ----
{ const G: any = globalThis, kept: Record<string, any> = {}, random = Math.random;
  let downloads = 0, W: any = null, one = false; const made: any[] = [];   // (every element the key's file makes: the download's link, and the tag it says things on)
  const stub: Record<string, any> = {
    window: { addEventListener() { /* the key and the error listeners: the probe calls crashed() itself */ } },
    location: { search: '' }, localStorage: { getItem: () => null, setItem() { /* */ }, removeItem() { /* */ } },
    document: { baseURI: 'http://localhost/', body: { appendChild() { /* */ } }, createElement: () => { const el: any = { style: {}, textContent: '', click() { downloads++; }, remove() { /* */ } }; made.push(el); return el; }, querySelector: (q: string) => one && /tps-one-page/.test(q) ? {} : null },
  };
  try {
    W = await standUp(); Math.random = mulberry32(5);   // (the game stands as in every other section; the page's globals are only up round the key's own calls)
    for (const k of Object.keys(stub)) { kept[k] = Object.getOwnPropertyDescriptor(G, k); Object.defineProperty(G, k, { value: stub[k], configurable: true, writable: true }); }
    const { ReplayKey } = await import(`${ROOT}/src/ui/replaykey.ts`);
    const notes: string[] = [];
    const key = new ReplayKey(W.game, W.cam, (s: string) => notes.push(s)), K = key as any;
    const settle = async () => { for (let i = 0; i < 400 && K.crashing; i++) await new Promise(r => setTimeout(r, 5)); await new Promise(r => setTimeout(r, 5)); };
    const minuteOn = () => { K.crashAt = K.crashTry = performance.now() - 61000; };
    for (let i = 0; i < 4; i++) { key.crashed('before any play'); await settle(); }
    check(downloads === 0 && key.last === null && notes.filter(n => /nothing played/.test(n)).length === 1, `crash: an error before any play makes no file and says so once, not every time (${notes.length} line)`);
    for (let f = 0; f < 120; f++) { hands(W, f); W.step(1 / 60); }
    K.crashTry = -Infinity; key.crashed(new Error('boom')); key.crashed(new Error('boom')); await settle();
    check(downloads === 1 && key.last?.id === null && /^error: boom/.test(key.last?.file.why ?? ''), `crash: with no shelf the error's replay is one download (${downloads}) for two errors in one tick, named for the error`);
    check(/hit an error/.test(notes[notes.length - 1] ?? ''), `crash: the message line says an error caused the download ("${(notes[notes.length - 1] ?? '').slice(0, 48)}…")`);
    for (let i = 0; i < 5; i++) { W.step(1 / 60); key.crashed(new Error('boom')); await settle(); }
    check(downloads === 1, `crash: the same error five more times inside the minute downloads nothing more (${downloads} in all)`);
    minuteOn(); key.crashed('later'); await settle();
    check(downloads === 2, `crash: a minute on, the next error saves again (${downloads} in all)`);
    for (let i = 0; i < 4; i++) { minuteOn(); key.crashed('for ever'); await settle(); }
    check(downloads === 3, `crash: an error that never stops makes three files in a page load and no more (${downloads} in all)`);
    const id = await key.save('key'); check(id === null && downloads === 4, 'crash: F7 itself still saves after that');
    one = true; const id2 = await key.save('key'); one = false;
    check(id2 === null && downloads === 5 && /no viewer page/.test(notes[notes.length - 1] ?? ''), `crash: on the one-file build, which ships no viewer page, F7 hands the file over as a download and says why ("${(notes[notes.length - 1] ?? '').slice(-60)}")`);
    K.crashes = 0; minuteOn(); one = true; const n0 = notes.length;
    for (let i = 0; i < 3; i++) { key.crashed(new Error('one page')); await settle(); }
    one = false;
    check(downloads === 5 && notes.length === n0 + 1 && /F7 downloads/.test(notes[n0] ?? '') && /^error: one page/.test(key.last?.file.why ?? ''), `crash: on the one-file build an error downloads nothing by itself and says once that F7 will ("${(notes[n0] ?? '').slice(0, 60)}")`);
    // the error is a LINE in the ring at the play moment it came: every file made while the ring holds that moment carries it, whatever saved the file
    const texts = (f: any) => F.errorMarks(f).map((e: any) => e.text);
    { const f = key.file('probe'), E = F.errorMarks(f);
      check(texts(f).join('|') === 'before any play|boom|later|for ever|one page' && E[0].r === 0 && Math.abs(E[1].r - 2) < 0.1, `crash: each error is one line in the ring at the moment it came, however often it repeated (${texts(f).join(' · ')}; boom at ${E[1]?.r.toFixed(2)} s)`); }
    one = true; const id3 = await key.save('key'), l3 = notes[notes.length - 1] ?? ''; one = false;
    check(id3 === null && downloads === 6 && key.last?.file.why === 'key' && texts(key.last?.file).includes('one page') && /holds the page's error, at 0:0/.test(l3), `crash: on the one-file build the F7 that follows an error hands over a file that holds the error's line, and says so ("${l3.slice(-44)}")`);
    const d0 = downloads, m0 = notes.length; key.crashed(new Error('swallowed')); await settle();
    check(downloads === d0 && notes.length === m0 && texts(key.file('probe')).pop() === 'swallowed', 'crash: an error the budget lets save nothing is still in the next file');
    // the lines' own rule is on the PLAY clock (the buffer's): nothing below waits on, or moves, the wall's
    for (let i = 0; i < 10; i++) { key.crashed(new Error('alt A')); key.crashed(new Error('alt B')); }
    { const t = texts(key.file('probe')); check(t.length === 8 && t.slice(-2).join('|') === 'alt A|alt B', `crash: two errors that take turns are two lines, not twenty (${t.length} lines in all)`); }
    for (let i = 0; i < 20; i++) key.crashed(new Error(`flood ${i}`));
    { const f = key.file('probe'), t = texts(f), R = F.decode(f).r, end = R.length ? R[R.length - 1] : 0;
      check(t.length === 8 && t[0] === 'before any play' && t[7] === 'flood 19', `crash: errors that never repeat a word hold eight lines of a minute's play, the first of them and the NEWEST (${t.length}: … ${t.slice(-2).join(' · ')})`);
      check(f.lines.every((l: any) => l.r >= 0 && l.r <= end), `crash: no line of a file lies before its first sample or past its last (${f.lines.length} lines, the last sample at ${end.toFixed(2)} s)`); }
    await settle();
    const keep = REPLAY.seconds; REPLAY.seconds = 6;
    try { for (let f = 0; f < 1200; f++) { hands(W, f); W.step(1 / 60); } } finally { REPLAY.seconds = keep; }
    const id4 = await key.save('key'), l4 = notes[notes.length - 1] ?? '';
    check(id4 === null && texts(key.last?.file).length === 0 && !/holds the page/.test(l4), `crash: once the ring has rolled past the errors a file holds none of them and F7 does not say it does (${texts(key.last?.file).length} lines in ${key.last?.file.seconds.toFixed(0)} s)`);
    { const buf = key.buf!, play = (secs: number) => { for (let f = 0; f < secs * 60; f++) { hands(W, f); W.step(1 / 60); } }, rs = () => F.errorMarks(key.file('probe')).filter((e: any) => e.text === 'still').map((e: any) => e.r);
      const a = [buf.pageError('still', true), buf.pageError('still', true), buf.pageError('still')];
      check(a.join() === 'true,false,false' && rs().length === 1, 'crash: with the game standing still the same error is one line, asked plainly or by an error about to save a file');
      play(30); const b = [buf.pageError('still'), buf.pageError('still', true), buf.pageError('still', true)], r1 = rs();
      check(b.join() === 'false,true,false' && r1.length === 2 && Math.abs(r1[1] - r1[0] - 30) < 0.2, `crash: half a minute of play on, the same words are a new line only for the error that saves a file, at its own moment (${r1.map((r: number) => r.toFixed(1)).join(' and ')} s)`);
      play(61); const c = buf.pageError('still');
      check(c && rs().length === 3, 'crash: a minute of play after its last line the same error is a line again');
      buf.on = false; const off = buf.pageError('while off'); buf.on = true; const on = buf.pageError('while off');
      (buf as any).broke = 'probe'; const dead = buf.pageError('while stopped'); (buf as any).broke = '';
      check(!off && on && !dead && texts(key.file('probe')).join('|') === 'still|still|still|while off', 'crash: a buffer that is off or has stopped itself files no line and says so, and files the same error once it runs again'); }
    // WHAT F7 DID IS SAID ON THE PAGE ITSELF: the note handed in (the message line, the debug read-out) is drawn nowhere on a page that never asked for the read-out,
    // so the key's file keeps a tag of its own — one element, the last line said, shown — and a save that throws or a shelf that never answers still ends in words
    { const { SHELF } = await import(`${ROOT}/src/replay/shelf.ts`);
      const tags = () => made.filter(e => e.id === 'replaytag'), tagNow = () => String(tags()[0]?.textContent ?? ''), last = () => notes[notes.length - 1] ?? '';
      const hadIdb = Object.getOwnPropertyDescriptor(G, 'indexedDB'), idb = (v: any) => Object.defineProperty(G, 'indexedDB', { value: v, configurable: true, writable: true });
      // a shelf that answers, as far as shelf.ts asks: two stores, requests that succeed a microtask on, a transaction that completes a task on
      const shelf = () => { const rows = new Map<number, any>(), bodies = new Map<number, any>(); let next = 1, opens = 0, closes = 0;
        const rq = (run: () => any) => { const r: any = {}; queueMicrotask(() => { r.result = run(); r.onsuccess?.(); }); return r; };
        const store = (m: Map<number, any>) => ({ add: (v: any) => rq(() => { const id = next++; m.set(id, { ...v, id }); return id; }), put: (v: any, k?: number) => rq(() => { m.set(k ?? v.id, v); return k; }), getAll: () => rq(() => [...m.values()]), get: (k: number) => rq(() => m.get(k)), delete: (k: number) => rq(() => { m.delete(k); }) });
        const db = { objectStoreNames: [], transaction: () => { const tx: any = { objectStore: (n: string) => store(n === 'rows' ? rows : bodies) }; setTimeout(() => tx.oncomplete?.(), 0); return tx; }, close() { closes++; } };
        return { rows, bodies, get opens() { return opens; }, get closes() { return closes; }, open: (late = 0) => { opens++; const r: any = { result: db }; setTimeout(() => r.onsuccess?.(), late); return r; } }; };
      const meta = K.meta, nt = K.note, ms = SHELF.openMs, buf = key.buf as any;
      try {
        const id5 = await key.save('key'), l5 = last(), T = tags();
        check(id5 === null && T.length === 1 && T[0].textContent === l5 && /^Replay of the last/.test(l5) && T[0].style.opacity === '0.9' && /position:fixed/.test(T[0].style.cssText ?? '') && /background:/.test(T[0].style.cssText ?? ''), `say: what F7 did is on a tag of the page's own, one element however many saves ("${tagNow().slice(0, 40)}…")`);
        K.meta = () => { throw new Error('meta broke'); };
        let threw = false, id6: number | null = 0; const d6 = downloads; try { id6 = await key.save('key'); } catch { threw = true; }
        check(!threw && id6 === null && downloads === d6 && /could not be saved: meta broke/.test(tagNow()) && /could not be saved/.test(last()), `say: a save that throws makes no file, rejects nothing and says why ("${tagNow().slice(0, 48)}")`);
        { const before = tagNow(), n6 = notes.length; K.crashes = 0; K.crashing = false; for (let i = 0; i < 3; i++) { K.crashAt = K.crashTry = -Infinity; key.crashed('while the save throws'); await settle(); }
          check(notes.length === n6 + 3 && /could not be saved/.test(last()) && tagNow() === before && K.crashes === 0, 'say: an ERROR whose save makes no file goes to the note alone each time it is asked again: the tag is what a key press did'); }
        K.meta = meta;
        K.note = () => { throw new Error('no message line'); }; const d7 = downloads; await key.save('key'); K.note = nt;
        check(downloads === d7 + 1 && /^Replay of the last/.test(tagNow()), 'say: the tag has the words though the page\'s own note threw');
        buf.broke = 'probe stopped it'; await key.save('key'); const l8 = tagNow(); buf.broke = '';
        check(/^Replay of the last/.test(l8) && /stopped itself earlier \(probe stopped it\)/.test(l8), 'say: a buffer that stopped itself hands over what it held and the ONE line shown says both');
        buf.on = false; await key.save('key'); const l8b = tagNow(); buf.on = true;
        check(/^Replay of the last/.test(l8b) && /switched off/.test(l8b), 'say: a buffer switched off from the console hands over what it held and says it is not running');
        // a shelf that never answers (no event of the open request ever fires): waited on for the shelf's own time, then a download — and one that answers LATE is closed unused
        SHELF.openMs = 60;
        { let opened = 0; idb({ open: () => { opened++; return {}; } }); const t0 = performance.now(), d9 = downloads, id9 = await key.save('key'), waited = performance.now() - t0;
          check(id9 === null && opened === 1 && downloads === d9 + 1 && waited >= 50 && /downloaded \(this browser would not keep it/.test(tagNow()), `say: a shelf that never answers is waited on for the shelf's own time, then the file is a download and the line says so (${waited.toFixed(0)} ms of a 60 ms wait)`); }
        { const S = shelf(); idb({ open: () => S.open(150) }); const d10 = downloads, id10 = await key.save('key'); await new Promise(r => setTimeout(r, 220));
          check(id10 === null && downloads === d10 + 1 && S.rows.size === 0 && S.closes === 1, `say: a shelf that answers after the wait is closed unused: the download is the only copy (${S.rows.size} rows, ${S.closes} close)`); }
        SHELF.openMs = ms;
        // a shelf that answers: the line a dev page shows — saved, no download — and it carries what the download's line carries
        { const S = shelf(); idb({ open: () => S.open() }); const d11 = downloads, id11 = await key.save('key'), l11 = tagNow();
          check(id11 === 1 && downloads === d11 && S.rows.size === 1 && typeof S.bodies.get(1) === 'string' && /^Replay saved: the last .* of play\. Shift\+F7 leaves the game for the viewer\./.test(l11) && l11 === last() && key.last?.id === 1, `say: with a shelf F7 shelves the file, downloads nothing and says where it went ("${l11.slice(0, 44)}…")`);
          buf.broke = 'probe stopped it'; const id12 = await key.save('key'), l12 = tagNow();
          const r13 = await K.put('error: probe'), l13 = tagNow(); buf.broke = '';
          check(id12 === 2 && /^Replay saved/.test(l12) && /stopped itself earlier/.test(l12) && r13.made && r13.id === 3 && /^The page hit an error: replay of the last .* saved\./.test(l13) && /stopped itself earlier/.test(l13) && downloads === d11, 'say: on the shelf too, the key\'s line and an error\'s line both say the buffer had stopped itself'); }
      } finally { K.meta = meta; K.note = nt; SHELF.openMs = ms; buf.broke = ''; buf.on = true; if (hadIdb) Object.defineProperty(G, 'indexedDB', hadIdb); else delete G.indexedDB; }
      // no buffer at all (?noreplay): F7 is not silent either
      { const heard: Array<(e: any) => void> = [], w = G.window, loc = G.location;
        G.window = { addEventListener: (k: string, f: (e: any) => void) => { if (k === 'keydown') heard.push(f); } }; G.location = { search: '?noreplay' };
        try { const said: string[] = [], off = new ReplayKey(W.game, W.cam, (s: string) => said.push(s)), n0 = made.length;
          for (const f of heard) { f({ code: 'F7', target: null }); f({ code: 'F8', target: null }); f({ code: 'F7', repeat: true, target: null }); }
          const t = made.slice(n0).filter(e => e.id === 'replaytag');
          check(off.buf === null && heard.length === 1 && said.length === 1 && /buffer is off/.test(said[0]) && t.length === 1 && t[0].textContent === said[0], `say: with the buffer off F7 says so, once a press, and nothing else is listened for ("${said[0] ?? ''}")`);
        } finally { G.window = w; G.location = loc; } } }
  } finally { Math.random = random; if (W) W.game.replayTap = null; for (const k of Object.keys(stub)) { if (kept[k]) Object.defineProperty(G, k, kept[k]); else delete G[k]; } } }

console.log(`\n=== replay buffer: ${fails ? `${fails} FAIL` : 'ALL PASS'} ===`);
process.exit(fails ? 1 : 0);
