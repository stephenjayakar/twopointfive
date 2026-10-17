// THE SENSES ON THE CPU (src/game/sense.ts SENSE.cpu; off by default on the page and on both stands): with it on, does the game need nothing of the renderer?
//   bun run tools/qa/sense-check.ts                       every line below; exit 0 = all pass, 1 = one failed (named). Run it on both stands (TPS_PROFILE=shipped).
//   SENSE_BREAK=1 bun run tools/qa/sense-check.ts         the red path: the switch is never raised, so every line that needs it must FAIL
// WHAT IS HELD:
//   off        the switch off: the sensors ask the probe as ever, the game holds the solver itself (no tee), nothing of the game's own smoke exists
//   no probe   on: sixty steps of a fight ask the probe NOTHING and are served nothing of it; off again, the solver is the game's smoke object once more
//   light      on: Sam's own meter — which has no answer at all on a machine with no GPU — reads the lamps: bright under the brightest, dark in the darkest
//   smoke      on: a canister let off on a sight line shuts it (under the 0.3 every eye's formula reads as blind) while it burns, leaves a line that does not
//              cross it alone, is not seen through a wall, and clears after it has burnt out
//   same       on: a taped room clear with the four (the shipped rules) is re-run from its tape with the game answering its OWN senses — the tape's values only
//              held against them — and is the same fight to the last bit (src/game/digest.ts rawBits), every read the page's game made answered the same
// The two-engine line is tools/qa/coop-check.ts under TPS_CPUSENSE=1; the real page's is tools/qa/samefight-page.cjs with SAMEFIGHT_QUERY=cpusense.
import { writeFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { standUp, ROOT } from './headless.ts';
const { SENSE, CpuSmoke } = await import(`${ROOT}/src/game/sense.ts`);
const { lightEstimateAt } = await import(`${ROOT}/src/game/guards.ts`);
const { mulberry32 } = await import(`${ROOT}/src/math/dice.ts`);
const BREAK = process.env.SENSE_BREAK === '1', DT = 1 / 60;
const raise = (on: boolean) => { SENSE.cpu = on && !BREAK; };
const argv = process.argv.slice(2), val = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };

// (the `same` line's child: a room clear with the four, taped with the senses on the CPU, its raw bits chained — written to the file named, then nothing else runs)
if (val('tape-to')) {
  const { ReplayBuffer } = await import(`${ROOT}/src/game/replaybuf.ts`), { levelFingerprint } = await import(`${ROOT}/src/game/savestate.ts`);
  const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`), { chainBits } = await import(`${ROOT}/src/game/digest.ts`);
  Math.random = mulberry32(0xbeef);   // (the switch: this child is started with the stand's own word, TPS_CPUSENSE — the parent's `same` line)
  const W: any = await standUp({ seed: 21 }); const r = startFromQuery(W.game, 'roomclear&squad4'); if (r.why) throw new Error(r.why);
  const buf = new ReplayBuffer(); buf.tape.born(W.game);
  W.game.replayTap = (dt: number, cmd?: unknown) => { if (cmd) buf.top(W.game, dt, cmd); else buf.tick(W.game, dt, W.cam); };
  const C = chainBits(W.game, 30); let blobs = 0, reads0 = W.game.sensors.stats.reads;
  const STEPS = Number(process.env.SENSE_STEPS ?? 24 * 60);
  for (let f = 0; f < STEPS; f++) { const I = W.input, s = f / 60; I.keys.clear(); if (s > 1 && s < 9) I.keys.add('KeyW'); I.mouseX = 800 + 300 * Math.sin(s * 0.7); I.mouseY = 420 + 150 * Math.cos(s * 0.5);
    if (f === 120 || f === 700) I.pressed.add('KeyB'); I.buttons = s > 10 && s < 16 ? 1 : 0; if (f === 600) I.clicked |= 1;
    if (f === 150) I.pressed.add('Digit3'); if (f === 200) I.pressed.add('KeyG'); if (f >= 200 && f < 250) I.keys.add('KeyG');   // (a smoke canister thrown ahead: the fight is then seen through the game's own smoke)
    W.step(f % 3 === 0 ? 1 / 60 : f % 3 === 1 ? 1 / 144 : 1 / 30); blobs = Math.max(blobs, W.game.cpuSmoke.blobs.length); }
  writeFileSync(val('tape-to')!, JSON.stringify({ ...buf.file(W.game, 'probe', { url: '?roomclear&squad4', fp: levelFingerprint(W.game) }), probeWords: C.words, probeSteps: C.steps, probeBlobs: blobs, probeReads: W.game.sensors.stats.reads - reads0, probeOn: SENSE.cpu }));
  process.exit(0);
}

let fails = 0;
const verdict = (ok: boolean, label: string, detail: string) => { if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
console.log(`=== sense-check: the senses on the CPU (src/game/sense.ts) · ${process.env.TPS_PROFILE === 'shipped' ? 'shipped' : 'frozen'} stand${BREAK ? ' · SENSE_BREAK: the switch never raised' : ''} ===`);

/** how often the probe is asked, from now on (the harness's probe stands in for the renderer's: asked, it never answers) */
const watch = (g: any) => { const P = g.probe, C = { asks: 0 }, q = P.query, s = P.querySegment; P.query = function (...a: unknown[]) { C.asks++; return q.apply(this, a); }; P.querySegment = function (...a: unknown[]) { C.asks++; return s.apply(this, a); }; return C; };

// ---- off · no probe
{
  raise(false); Math.random = mulberry32(3);
  const W: any = await standUp({ seed: 5 }), g = W.game, C = watch(g);
  for (let k = 0; k < 30; k++) W.step(DT);
  const emit0 = g.smoke.emit, budget0 = g.smoke.budget, offAsks = C.asks, offSolver = g.smoke === W.smoke, offOwn = g.sensors.own === null && g.cpuSmoke.blobs.length === 0;
  verdict(SENSE.cpu === false && offAsks > 0 && offSolver && offOwn, 'off: the probe is asked as ever and the solver is as it was built',
    `switch ${SENSE.cpu} · ${offAsks} asks in 30 steps · the game's smoke object is the solver ${offSolver} · nothing of the game's own ${offOwn}`);
  raise(true); C.asks = 0; const reads0 = g.sensors.stats.reads; let served = 0;
  const get = g.probe.get; g.probe.get = function (...a: unknown[]) { served++; return get.apply(this, a); };
  for (let k = 0; k < 60; k++) W.step(DT);
  // (the game's own smoke is put on the solver object itself: whoever holds the solver — the game, a panel button, the page's warm-up — feeds both)
  const before = g.cpuSmoke.blobs.length; W.smoke.emit({ pos: [0, 1, 0], dir: [0, 1, 0], speed: 0, radius: 0.3, density: 40, temperature: 1, ttl: 5, age: 0 });
  const tee = g.smoke.emit !== emit0 && g.cpuSmoke.blobs.length === before + 1, room = g.smoke.budget(), onAsks = C.asks, reads = g.sensors.stats.reads - reads0, onServed = served;
  raise(false); W.step(DT);
  const back = g.smoke.emit === emit0 && g.smoke.budget === budget0 && g.cpuSmoke.blobs.length === 0;
  verdict(onAsks === 0 && onServed === 0 && reads > 0 && tee && room === SENSE.smoke.emitters - SENSE.smoke.reserve - 1 && back, 'no probe: on, sixty steps ask the probe nothing and are served nothing of it; off again, the solver is as it was',
    `asks ${onAsks} · answers taken off the probe ${onServed} · reads the game made ${reads} · an emitter handed straight to the solver reached the game's own smoke ${tee} · room for ${room} more by the game's own count · the solver as built when off ${back}`);
}

// ---- light
{
  Math.random = mulberry32(3);
  const W: any = await standUp({ seed: 5 }), g = W.game; g.aiEnabled = false; g.godMode = true; raise(true);   // (after the stand-up: it writes the switch from the stand's own word)
  // the brightest and the darkest of the places a lamp hangs over (the estimate at chest height under each, and two steps to the side of it)
  const spots: { p: [number, number, number]; E: number }[] = [];
  for (const l of g.engine.lights.lights) for (const [ox, oz] of [[0, 0], [1.5, 0], [0, 1.5], [-1.5, 0], [0, -1.5], [6, 6], [-6, 6]]) { const p: [number, number, number] = [l.pos[0] + ox, 0, l.pos[2] + oz]; spots.push({ p, E: Math.max(lightEstimateAt(g, [p[0], 1.2, p[2]]), lightEstimateAt(g, [p[0], 1.6, p[2]])) }); }
  spots.sort((a, b) => b.E - a.E); const lit = spots[0], dark = spots[spots.length - 1];
  const stand = (p: number[]) => { const c = g.player.char; c.pos[0] = p[0]; c.pos[1] = 0; c.pos[2] = p[2]; if (c.vel) c.vel[0] = c.vel[1] = c.vel[2] = 0; for (let k = 0; k < 90; k++) { c.pos[0] = p[0]; c.pos[2] = p[2]; W.step(DT); } return { vis: g.player.visibility as number, E: g.player.irradiance as number }; };
  const a = stand(lit.p), b = stand(dark.p);
  verdict(a.vis > b.vis + 0.3 && a.E > b.E, 'light: Sam\'s own meter reads the lamps with no probe',
    `under the brightest of ${spots.length} places (estimate ${lit.E.toFixed(2)} W/m²): irradiance ${a.E.toFixed(2)}, visibility ${a.vis.toFixed(2)} · in the darkest (${dark.E.toFixed(3)}): ${b.E.toFixed(3)}, ${b.vis.toFixed(2)}${BREAK ? '' : ' (off, on a machine with no GPU, it never moves: both read the same)'}`);
}

// ---- smoke
{
  Math.random = mulberry32(3);
  const W: any = await standUp({ seed: 5 }), g = W.game; g.aiEnabled = false; g.godMode = true; raise(true);
  const pc = g.player.char, a: [number, number, number] = [pc.pos[0], 1.3, pc.pos[2]];
  let b: [number, number, number] | null = null, away: [number, number, number] | null = null, len = 0;
  for (const L of [9, 7, 5]) { for (let k = 0; k < 24 && !b; k++) { const th = k * Math.PI / 12, q: [number, number, number] = [a[0] + L * Math.cos(th), 1.3, a[2] + L * Math.sin(th)], o: [number, number, number] = [a[0] - 2 * Math.cos(th), 1.3, a[2] - 2 * Math.sin(th)];
    if (!g.col.segmentBlocked(a, q)) { b = q; away = o; len = L; } } if (b) break; }
  if (!b || !away) verdict(false, 'smoke: a canister on a sight line', 'no free line of 5 m from where Sam stands on this level');
  else {
    const mid: [number, number, number] = [(a[0] + b[0]) / 2, 0.1, (a[2] + b[2]) / 2], P = { canisterDuration: 32, canisterDensity: 95, canisterRadius: 0.2, canisterTemp: 1.6, canisterSpeed: 1.9, ...(g.smoke.params ?? {}) };
    const before = g.sensors.segment('chkLine', a, b) ?? 1;
    W.step(DT);   // (the game's own smoke is in front of the solver from the first step under the switch)
    g.smoke.emit({ pos: mid, dir: [0, 1, 0], speed: P.canisterSpeed, radius: P.canisterRadius, density: P.canisterDensity, temperature: P.canisterTemp, ttl: P.canisterDuration, age: 0, kind: 'canister' });
    const hold = () => { pc.pos[0] = a[0]; pc.pos[2] = a[2]; };
    for (let k = 0; k < 12 * 60; k++) { hold(); W.step(DT); }
    const shut = g.sensors.segment('chkLine', a, b) ?? 1, side = g.sensors.segment('chkAway', a, away) ?? 1, blobs = g.cpuSmoke.blobs.length;
    const walled = BREAK ? 1 : (() => { const S = new CpuSmoke(); S.blobs.push(...g.cpuSmoke.blobs.map((x: object) => ({ ...x }))); return S.trans(a, b, () => true); })();
    for (let k = 0; k < 75 * 60; k++) { hold(); W.step(DT); }
    const after = g.sensors.segment('chkLine', a, b) ?? 1;
    // full of puffs, a canister still gets its place (the one worth least goes, and a puff is worth less than a canister that has yet to burn)
    const S2 = new CpuSmoke(); for (let k = 0; k < SENSE.smoke.cap + 20; k++) S2.emit({ pos: [k, 0, 0], dir: [0, 1, 0], speed: 0, radius: 0.3, density: 6, temperature: 1, ttl: 1, age: 0 } as never);
    S2.emit({ pos: [-9, 0, 0], dir: [0, 1, 0], speed: 0, radius: P.canisterRadius, density: P.canisterDensity, temperature: 1, ttl: P.canisterDuration, age: 0 } as never);
    S2.emit({ pos: [-8, 0, 0], dir: [0, 1, 0], speed: 0, radius: 0.3, density: 6, temperature: 1, ttl: 1, age: 0 } as never);
    const kept = BREAK || (S2.blobs.length === SENSE.smoke.cap && S2.blobs.some((x: { x: number }) => x.x === -9));
    verdict(before === 1 && shut < 0.3 && side > 0.8 && walled === 1 && after > 0.8 && blobs >= 1 && kept, 'smoke: a canister on a sight line shuts it while it burns, and only it',
      `a ${len} m line, the canister at its middle: clear ${before.toFixed(2)} → after 12 s ${shut.toFixed(3)} (blind under 0.30) · a line the other way ${side.toFixed(2)} · the same smoke behind a wall ${walled.toFixed(2)} · 75 s later ${after.toFixed(2)} · ${blobs} blob(s) held · a canister let out among ${SENSE.smoke.cap + 20} puffs kept its place ${kept}`);
  }
}

// ---- same
{
  const dir = mkdtempSync(join(tmpdir(), 'sense-')), path = join(dir, 'tape.json');
  const env = { ...process.env, TPS_PROFILE: 'shipped', TPS_CPUSENSE: BREAK ? '0' : '1' } as Record<string, string>; delete env.TPS_EXACT;
  const made = spawnSync(process.execPath, ['run', 'tools/qa/sense-check.ts', '--tape-to', path], { cwd: ROOT, env, encoding: 'utf8', maxBuffer: 1 << 26 });
  let F: any = null; try { F = JSON.parse(readFileSync(path, 'utf8')); } catch { /* said below */ }
  if (!F) verdict(false, 'same: a taped fight re-run on its own senses', `the tape was not made (exit ${made.status}): ${(made.stderr || made.stdout || '').trim().split('\n').slice(-3).join(' / ').slice(0, 400)}`);
  else {
    const r = spawnSync(process.execPath, ['run', 'tools/qa/samefight-rerun.ts', path, String(F.probeSteps), '30'], { cwd: ROOT, env: { ...env, TPS_PROFILE: '', TPS_CPUSENSE: '' }, encoding: 'utf8', maxBuffer: 1 << 26 });
    const l = (r.stdout || '').split('\n').find((x: string) => x.startsWith('SAMEFIGHT ')), H = l ? JSON.parse(l.slice(10)) : null;
    if (!H || H.refuse) verdict(false, 'same: a taped fight re-run on its own senses', `the tape was not re-run — ${H ? H.refuse : (r.stderr || r.stdout || '').trim().split('\n').slice(-3).join(' / ').slice(0, 400)}`);
    else {
      const W0: string[] = F.probeWords; let k = 0; while (k < W0.length && k < H.words.length && W0[k] === H.words[k]) k++;
      const same = W0.length > 0 && W0.length === H.words.length && k === W0.length, own = H.ownSenses ?? { on: false, reads: 0, differ: 0 };
      verdict(F.probeOn === true && same && own.on && own.reads > 0 && own.differ === 0 && F.probeBlobs >= 1, 'same: a taped room clear with a smoke canister thrown, re-run from seed and inputs with the game answering its own senses, is the same fight to the bit',
        `${F.probeSteps} steps at 60, 144 and 30 a second · ${same ? `${W0.length} words equal` : `${k} of ${W0.length} words equal (the bits part in the half second ending at step ${(k + 1) * 30})`} · the re-run answered ${own.reads} reads itself, ${own.differ} not what the taped game had read · the taped game held up to ${F.probeBlobs} blob(s) of its own smoke · worst ${Number(H.worst).toFixed(2)} m off the trace`);
    }
  }
}

console.log(fails ? `=== sense-check: ${fails} FAILED ===` : '=== sense-check: ALL PASS ===');
process.exit(fails ? 1 : 0);
