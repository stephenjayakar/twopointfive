// The 'destruction' probe family (STATUS stage 3b — src/game/destruction.ts + debris.ts + sheetModel.ts, the 'sheet' particle kind), run through probes.ts:
//   bun run tools/qa/probes.ts destruction | destruction-sheet | destruction-caps | destruction-dust | destruction-screen | destruction-hearing |
//                               destruction-reset | destruction-identity | destruction-determinism | destruction-bounds | destruction-impulses [--verbose]
// Headless = the Proxy device: no kernel runs and the smoke solver is a null object, so what is asserted is every CPU-side promise —
//   (sheet)        the falling-sheet reference model (game/sheetModel.ts — the equations particles.wgsl mirrors): 200 seeded leaves let go tilted / kicked all
//                  come to rest within a few seconds, none NaN, terminal ≈ 1 m/s face-down, and they FLUTTER (the along-slip reverses); the kind's numbers in
//                  particles.ts KIND_DEFAULTS.sheet ARE the model's; particles_common.wgsl carries the same two constants; a sheet emit packs aspect / tumble /
//                  normal-jitter where the kernel reads them;
//   (caps)         every path is bounded whatever is thrown at it: paper conversions ≤ papersPerSec, dust puffs ≤ puffsPerSec and ≤ puffsPerFrame, knock-offs ≤
//                  knocksPerSec, ceiling tiles ≥ tileGapSecs apart / ≤ tilesPerEncounter / one per square, the debris pool ≤ settings.debrisCap with eviction of
//                  a RESTING chunk and refusal + demotion (a chip burst) when every chunk is still moving;
//   (dust)         a sustained burst into plaster injects 'puff' emitters into the smoke solver — real density, coarse lattice, short ttl, anchored off the wall
//                  — i.e. the SAME field the guards' sight lines march (one model; the transmittance itself needs the GPU probe: tools/qa/destr-scenes.js
//                  __ds.sight() records it in the browser); nothing at chaos 0; the first round alone raises none (escalation);
//   (screen)       a lit monitor whose screen takes a round dies through its light target (factor 0 next frame, still 0 ten seconds on, a crack decal on it),
//                  an unlit one just cracks; restartEncounter lights it again and un-hides everything;
//   (hearing)      debris landing files 'prop' hearing events at the documented levels (tile 0.4, housing 0.5, clutter / binder 0.25, blamed on who caused it —
//                  NOBODY_ID by hand) and a calm man in earshot goes to look; sheets and puffs file nothing;
//   (reset)        after a wrecked minute restartEncounter puts every static's flags back bit for bit, empties the pools, zeroes the heat;
//   (identity)     chaos 0 = the game as it was: the decals family's seeded 15 s corridor fight with the hooks live at chaos 0 vs the hooks stubbed out →
//                  identical rounds / events / audio / prop poses / decal list, and the module's counters never move;
//   (determinism)  chaos 1, the same seeded burst + bang twice → identical destruction log, debris rest poses, particle emit stream, decal list, events;
//   (bounds)       90 s of continuous full-auto at chaos 1 on a 32-chunk pool: debris ≤ cap throughout, decals ≤ their ring, the particle queue ≤ MAX_QUEUE,
//                  the log capped, hidden ≤ the index, puffs/s ≤ cap, no NaN anywhere in the debris;
//   (impulses)     later events kick the litter: the bang / impact / thud records destruction.ts queues flown on the sheetModel reference (wake ≥ 90 % within
//                  2 m, nothing past the radius, re-settle ≤ ~2 s, |v| ≤ vMax), the 16-a-frame cap with merge / drop under 48 charges, the idle frame's
//                  single upload, the debris pool woken / nudged, the chaos-0 and switch gates, the WGSL constants = the reference's, the three thud sites.
import { standUp, ROOT, fake } from './headless.ts';
import { readFileSync } from 'node:fs';
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const { fireWeapon, detonateStun } = await import(`${ROOT}/src/game/combat.ts`);
const { WEAPONS } = await import(`${ROOT}/src/game/weapons.ts`);
const { Particles, KIND_DEFAULTS, MAX_QUEUE, MAX_IMPULSES, BLOCK_HDR_BYTES, REC_BYTES, IMP_OFFSET, IMP_BYTES, KI_FLOAT, P_KINDS } = await import(`${ROOT}/src/render/particles.ts`);
const D = await import(`${ROOT}/src/game/destruction.ts`);
const SM = await import(`${ROOT}/src/game/sheetModel.ts`);
const { SHEET, flySheet } = SM;
const { DEBRIS_IMP } = await import(`${ROOT}/src/game/debris.ts`);
const { DECAL_CAP } = await import(`${ROOT}/src/render/decals.ts`);
const { BoxFlag } = await import(`${ROOT}/src/scene/boxes.ts`);
const { resetChase } = await import(`${ROOT}/src/game/guards.ts`);
const { PLAYER_ID, NOBODY_ID } = await import(`${ROOT}/src/game/consts.ts`);

type Vec3 = [number, number, number];
const DT = 1 / 60;
const VERBOSE = process.argv.includes('--verbose');
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f2 = (x: number) => x.toFixed(2);
const p2 = (p: Vec3) => `(${f2(p[0])}, ${f2(p[1])}, ${f2(p[2])})`;
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { const ok = all; console.log(`=== ${title.split(':')[0]}: ${ok ? 'ALL PASS' : 'FAILURES above'} ===`); if (!ok) process.exitCode = 1; return ok; } };
}
function place(gd: any, p: Vec3, yaw: number) { gd.char.pos = v3.copy(p); gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.char.bodyYaw = gd.char.aimYaw = yaw; gd.char.aimPitch = 0; gd.path = []; gd.pathGoal = null; gd.char.update(0); gd.char.update(DT); }
function park(gd: any, i: number) { gd.hold = true; gd.pinned = true; place(gd, [37.5, 0, 6 + i * 1.5], Math.PI / 2); gd.heardUpTo = 1e12; gd.dazzledUntil = 1e9; gd.flashlight.enabled = false; }
const resetStats = () => { for (const k of Object.keys(D.DESTR_STATS)) (D.DESTR_STATS as any)[k] = 0; D.DESTR_LOG.length = 0; };

/** The harness Game at chaos `chaos` with a Particles attached, a smoke stand-in that RECORDS emits, everyone parked deaf and blind on the lot, god mode, Sam at `at`. */
async function stage(seed: number, chaos: number, at: Vec3 = [17.9, 0, 18.1], yaw = 0) {
  Math.random = seeded(seed);
  const W = await standUp(); const { game, engine } = W;
  engine.particles = new Particles(fake('device'), fake('sceneLayout')); engine.settings.gpuParticles = true;
  const smokeLog: any[] = []; W.smoke.emit = (e: any) => { smokeLog.push({ kind: e.kind, pos: e.pos && [...e.pos], density: e.density, ttl: e.ttl, lattice: e.lattice, radius: e.radius, t: game.time }); };
  game.godMode = true; game.player.visibility = 0.02; game.tune.chaos = chaos; resetStats();
  for (let i = 0; i < 5; i++) W.step(DT);
  game.guards.forEach((gd: any, i: number) => park(gd, i));
  game.teleportPlayer(at); game.player.char.bodyYaw = game.player.char.aimYaw = yaw; game.player.slot = 'rifle'; game.player.holstered = false; game.player.crouch = false;
  W.step(DT); W.step(DT);
  const P = engine.particles;
  const flush = () => { const q = P.pending.map((e: any) => `${e.kind}:${e.count}:${e.pos.map((x: number) => x.toFixed(2)).join(',')}:${e.seed}`); for (const r of P.pendingImpulses) q.push(`imp:${r.radius}:${r.strength.toFixed(3)}:${r.pos.map((x: number) => x.toFixed(2)).join(',')}:${r.seed}:${r.flags}`); P.prepare(DT, true); return q; };   // (the frame's emits AND its impulses: both are the module's output to the GPU)
  return { W, game, engine, P, smokeLog, flush };
}
/** the tan cluster's south desk from the south: binders (18.22‥18.36, 0.92, 20.22), the monitor (17.7, 1.08, 20.25), the spine partition behind (z 20.6) */
const DESK_PTS: Vec3[] = [[18.3, 0.95, 20.2], [17.9, 1.0, 20.3], [18.1, 0.8, 20.05], [17.6, 1.1, 20.25], [18.5, 0.85, 20.4], [17.75, 0.9, 20.1]];
const WALL: Vec3 = [21.5, 1.2, 10.0];
/** the tan cluster's north desk from the north: papers (17.6, 0.78, 21.3), the lit monitor7 (17.7, 1.08, 20.97), the spine behind at z 20.6 */
const NORTH_PTS: Vec3[] = [[17.7, 1.1, 20.99], [17.55, 0.82, 21.3], [17.75, 0.8, 21.25], [17.9, 0.95, 21.0], [17.45, 0.9, 21.05], [18.0, 0.8, 21.3], [17.3, 0.85, 21.2], [18.25, 1.0, 20.66]];
function newEvents(game: any, seen: WeakSet<any>): any[] { const out: any[] = []; for (const e of game.events) { if (seen.has(e)) continue; seen.add(e); out.push(e); } return out; }

// ================================================================ sheet
export async function destructionSheet() {
  const F = family('destruction-sheet: the falling-sheet reference model settles, flutters and never NaNs; the particle kind carries the same numbers');
  { const rnd = seeded(21); let settled = 0, nan = 0, maxT = 0, sumRev = 0, peak = 0; const N = 200;
    for (let i = 0; i < N; i++) {
      const tilt = rnd() * 0.7, az = rnd() * 6.283; const nrm: Vec3 = [Math.sin(tilt) * Math.cos(az), Math.cos(tilt), Math.sin(tilt) * Math.sin(az)];
      const sp = 0.5 + rnd() * 3.5, a2 = rnd() * 6.283;
      const s = { p: [0, 0.78 + rnd() * 0.8, 0] as Vec3, v: [Math.cos(a2) * sp, 0.3 + rnd() * 2.5, Math.sin(a2) * sp] as Vec3, n: nrm, w: [(rnd() - 0.5) * 8, 0, (rnd() - 0.5) * 8] as Vec3, asleep: false, age: 0 };
      const r = flySheet(s, DT, 20);
      if (r.nan) nan++; if (r.asleep) { settled++; maxT = Math.max(maxT, r.t); } sumRev += r.reversals; peak = Math.max(peak, r.peakV);
    }
    const flat = flySheet({ p: [0, 2.5, 0], v: [0.1, 0, 0], n: [0.02, 0.9998, 0], w: [0, 0, 0], asleep: false, age: 0 }, DT, 20);
    const term = 2.5 / flat.t;   // mean descent speed of a flat drop from 2.5 m
    const fails: string[] = [];
    if (settled !== N) fails.push(`${N - settled} of ${N} still flying at 20 s`); if (nan) fails.push(`${nan} NaN`); if (!(maxT < 6)) fails.push(`slowest settle ${f2(maxT)} s (want < 6)`);
    if (!(sumRev / N >= 1)) fails.push(`mean along-slip reversals ${(sumRev / N).toFixed(2)} (want ≥ 1: they flutter)`); if (!(term > 0.7 && term < 1.6)) fails.push(`flat drop mean descent ${f2(term)} m/s (want 0.7‥1.6 ≈ terminal 1)`); if (!(peak < 8)) fails.push(`peak speed ${f2(peak)} (a kicked leaf never outruns its kick by much)`);
    F.verdict(!fails.length, `${N} kicked leaves: all asleep by ${f2(maxT)} s, ${(sumRev / N).toFixed(1)} slip reversals each on average, peak ${f2(peak)} m/s; a flat drop from 2.5 m descends at ${f2(term)} m/s`, fails.join('; ') || 'ok'); }
  { const K = KIND_DEFAULTS.sheet; const fails: string[] = [];
    const want = { gravity: SHEET.gravity, drag: SHEET.KT, restitution: SHEET.KN_LIN, keep: SHEET.KN_Q, sleepV: SHEET.sleepV, holdOrFade: SHEET.fade, shutterOrGrowth: SHEET.FLUT, brightOrOpacity: SHEET.TRANS };
    for (const [k, v] of Object.entries(want)) if ((K as any)[k] !== v) fails.push(`KIND_DEFAULTS.sheet.${k} = ${(K as any)[k]} ≠ SHEET ${v}`);
    const wg = readFileSync(`${ROOT}/src/render/shaders/particles_common.wgsl`, 'utf8');
    const ad = /const SHEET_ANG_DAMP: f32 = ([0-9.]+);/.exec(wg), sm = /const SHEET_SPIN_MAX: f32 = ([0-9.]+);/.exec(wg);
    if (!ad || Number(ad[1]) !== SHEET.ANG_DAMP) fails.push(`particles_common.wgsl SHEET_ANG_DAMP ${ad?.[1]} ≠ ${SHEET.ANG_DAMP}`); if (!sm || Number(sm[1]) !== SHEET.SPIN_MAX) fails.push(`SHEET_SPIN_MAX ${sm?.[1]} ≠ ${SHEET.SPIN_MAX}`);
    if (!/const P_SHEET: u32 = 4u;/.test(wg)) fails.push('P_SHEET is not 4 in particles_common.wgsl (particles.ts KIND_ID.sheet = 4)');
    // an emit packs the sheet's numbers where the kernel reads them: posB.x tumble, .y aspect, .z nrmJit; kind 4 in ring 1
    const P = new Particles(fake('device'), fake('sceneLayout')); const bu: Uint32Array = (P as any).bu, bf: Float32Array = (P as any).bf;
    P.emit('sheet', [1, 2, 3], [0, 1, 0], 5, { speed: 2, life: 60, size: 0.21, aspect: 1.41, tumble: 7, nrmJit: 0.5 }); P.emit('debris', [0, 0, 0], [0, 1, 0], 2, { speed: 1, life: 10, size: 0.01 }); P.prepare(DT, true);
    const H = BLOCK_HDR_BYTES / 4, RW = REC_BYTES / 4;   // (the block's header words, an emit record's words)
    const k0 = bu[H + 24]; if ((k0 & 15) !== 4 || ((k0 >> 16) & 1) !== 1) fails.push(`sheet record kind/ring ${k0 & 15}/${(k0 >> 16) & 1} (want 4 / ring 1)`);
    if (bf[H + 8] !== 7 || Math.abs(bf[H + 9] - 1.41) > 1e-6 || bf[H + 10] !== 0.5) fails.push(`sheet posB = ${bf[H + 8]}, ${bf[H + 9]}, ${bf[H + 10]} (want tumble 7, aspect 1.41, nrmJit 0.5)`);
    if (bf[H + RW + 9] !== 1) fails.push(`a plain debris emit's aspect ${bf[H + RW + 9]} (want 1: every old emit exactly as it was)`);
    F.verdict(!fails.length, 'KIND_DEFAULTS.sheet = sheetModel SHEET slot for slot; the WGSL constants match; P_SHEET = 4; a sheet emit packs tumble / aspect / normal jitter into posB and rides ring 1; old kinds pack aspect 1', fails.join('; ') || `SHEET ${JSON.stringify(want)}`); }
  return F.done();
}

// ================================================================ caps
export async function destructionCaps() {
  const F = family('destruction-caps: conversions, puffs, knock-offs, tiles and the debris pool stay inside their caps whatever is fired at them');
  const C = D.CHAOS;
  { // papers + puffs + knocks per second under 20 rounds/s for 4 s at chaos 1 (a torture rate no gun has)
    const { W, game, smokeLog } = await stage(3101, 1, [17.75, 0, 23.0], Math.PI);   // from the north: the north desk (papers, the lit monitor) in front, the spine and the south desk's binders through it
    const perSec: Record<number, { papers: number; puffs: number; knocks: number }> = {};
    let lastP = 0, lastK = 0;
    for (let f = 0; f < 240; f++) {
      if (f % 3 === 0) { const p = NORTH_PTS[(f / 3) % NORTH_PTS.length]; fireWeapon(game, game.player.char, [p[0] + ((f * 0.37) % 1) * 0.4 - 0.2, p[1], p[2]], true, { weapon: WEAPONS.fn2000 }); }
      if (f % 3 === 1) { const p = NORTH_PTS[(f * 7) % NORTH_PTS.length]; fireWeapon(game, game.player.char, [p[0], p[1] + 0.1, p[2] - 0.3], true, { weapon: WEAPONS.fn2000 }); }
      if (f === 120) for (const d of [...(game.destr as any).items.values()].filter((d: any) => d.kind === 'paper').slice(0, 12)) (game.destr as any).convertPaper(d, [0, 1, 0], 2, 1);   // + a dozen conversions asked for in ONE frame mid-burst (a bang's ring): the cap decides
      W.step(DT);
      const s = Math.floor(f / 60); perSec[s] ??= { papers: 0, puffs: 0, knocks: 0 };
      perSec[s].papers += D.DESTR_STATS.papers - lastP; lastP = D.DESTR_STATS.papers; perSec[s].knocks += D.DESTR_STATS.knocks - lastK; lastK = D.DESTR_STATS.knocks;
    }
    const puffTimes = smokeLog.filter(e => e.kind === 'puff').map(e => e.t);
    let maxPuffPerSec = 0, maxPuffPerFrame = 0; for (const t of puffTimes) { maxPuffPerSec = Math.max(maxPuffPerSec, puffTimes.filter(u => u > t - 1 + 1e-6 && u <= t + 1e-6).length); maxPuffPerFrame = Math.max(maxPuffPerFrame, puffTimes.filter(u => Math.abs(u - t) < 1e-6).length); }
    const maxPapers = Math.max(...Object.values(perSec).map(x => x.papers)), maxKnocks = Math.max(...Object.values(perSec).map(x => x.knocks));
    const fails: string[] = [];
    if (maxPapers > C.papersPerSec + 1) fails.push(`papers ${maxPapers}/s (cap ${C.papersPerSec})`);   // (+1: the bucket starts full and refills across the second's edge)
    if (maxPuffPerSec > C.puffsPerSec + 1) fails.push(`puffs ${maxPuffPerSec} in a sliding second (cap ${C.puffsPerSec})`); if (maxPuffPerFrame > C.puffsPerFrame) fails.push(`puffs ${maxPuffPerFrame} in one frame (cap ${C.puffsPerFrame})`);
    if (maxKnocks > C.knocksPerSec + 4) fails.push(`knock-offs ${maxKnocks}/s (cap ${C.knocksPerSec} + a group's riders)`);
    if (D.DESTR_STATS.papers < 3 || D.DESTR_STATS.puffs < 4 || D.DESTR_STATS.knocks < 1) fails.push(`staging: papers ${D.DESTR_STATS.papers} puffs ${D.DESTR_STATS.puffs} knocks ${D.DESTR_STATS.knocks} (the torture burst + the dozen asked-for conversions should have made some of each)`);
    F.verdict(!fails.length, `160 rounds in 4 s at chaos 1: papers ≤ ${maxPapers}/s, puffs ≤ ${maxPuffPerSec}/s and ≤ ${maxPuffPerFrame}/frame (refused ${D.DESTR_STATS.puffsRefused}), knock-offs ≤ ${maxKnocks}/s — inside papersPerSec ${C.papersPerSec} / puffsPerSec ${C.puffsPerSec} / puffsPerFrame ${C.puffsPerFrame} / knocksPerSec ${C.knocksPerSec}`, fails.join('; ') || `totals ${JSON.stringify(D.DESTR_STATS)}`); }
  { // tiles: gap, per-square, per-encounter; forced drops (bangs) still honour the encounter cap and the square rule
    const { W, game } = await stage(3102, 1);
    const destr = game.destr; const times: number[] = []; const keys = new Set<string>();
    const origLog = D.DESTR_LOG.length;
    for (let f = 0; f < 60 * 30; f++) { if (f % 2 === 0) { const p = DESK_PTS[(f / 2) % DESK_PTS.length]; fireWeapon(game, game.player.char, p, true, { weapon: WEAPONS.fn2000 }); } W.step(DT); }
    for (const line of D.DESTR_LOG.slice(origLog)) { const m = /^([0-9.]+) tile (\S+) dropped/.exec(line); if (m) { times.push(Number(m[1])); keys.add(m[2]); } }
    let minGap = Infinity; for (let i = 1; i < times.length; i++) minGap = Math.min(minGap, times[i] - times[i - 1]);
    const fails: string[] = [];
    if (times.length > C.tilesPerEncounter) fails.push(`${times.length} tiles (cap ${C.tilesPerEncounter})`); if (times.length >= 2 && minGap < C.tileGapSecs - 1e-6) fails.push(`two tiles ${f2(minGap)} s apart (gap ${C.tileGapSecs})`);
    if (keys.size !== times.length) fails.push(`a square dropped twice (${times.length} drops, ${keys.size} squares)`); if (times.length < 3) fails.push(`staging: only ${times.length} tiles from 30 s of fire`);
    // bangs: forced, but the encounter cap and the square rule hold
    const before = D.DESTR_STATS.tiles; for (let k = 0; k < 12; k++) { destr.bang([16 + k * 0.9, 0.1, 17.5]); W.step(DT); }
    const total = times.length + (D.DESTR_STATS.tiles - before);
    if (total > C.tilesPerEncounter) fails.push(`${total} tiles after 12 bangs on top (cap ${C.tilesPerEncounter})`);
    F.verdict(!fails.length, `30 s of 30 rounds/s at chaos 1: ${times.length} tiles, ≥ ${f2(minGap)} s apart, ${keys.size} distinct squares; + 12 stun charges → ${total} in all (cap ${C.tilesPerEncounter}, refused ${D.DESTR_STATS.tilesRefused})`, fails.join('; ') || `drops at ${times.map(f2).join(', ')} s`); }
  { // the debris pool: cap 4, knock eight things in one frame → ≤ 4 chunks, the rest demoted; then once they rest, new ones evict resting chunks
    const { W, game, engine } = await stage(3103, 1); engine.settings.debrisCap = 4;   // (the pool never goes under 4)
    const destr = game.destr; const deb = destr.debris;
    const items = [...(destr as any).items.values()].filter((d: any) => (d.kind === 'clutter' || d.kind === 'binder') && !d.group);   // (group-less: a grouped thing takes its riders with it, which is another test's business)
    const kps0 = D.CHAOS.knocksPerSec; D.CHAOS.knocksPerSec = 99;   // the per-second cap out of the way: this block is about the POOL
    if (items.length < 10) throw new Error(`staging: only ${items.length} group-less small items indexed`);
    let ok0 = 0; for (let i = 0; i < 8; i++) { if ((destr as any).knockOff(items[i], [1, 0, 0], 1, 'clutter')) ok0++; }
    const nAfterBurst = deb.list.length, refused = deb.stats.refused, demoted = D.DESTR_STATS.knocksDemoted, moving0 = deb.moving;
    for (let f = 0; f < 60 * 6; f++) W.step(DT);
    const resting = deb.list.filter((c: any) => c.rest).length;
    const evict0 = deb.stats.evicted; (destr as any).knockOff(items[8], [0, 0, 1], 1, 'clutter'); (destr as any).knockOff(items[9], [0, 0, 1], 1, 'clutter'); D.CHAOS.knocksPerSec = kps0;
    const fails: string[] = [];
    if (nAfterBurst > 4) fails.push(`${nAfterBurst} chunks live (cap 4)`); if (ok0 !== 8) fails.push(`only ${ok0}/8 knock-offs accepted (a refused chunk must still hide the thing and burst)`);
    if (refused !== 4 || demoted !== refused) fails.push(`refused ${refused} / demoted ${demoted} (want 4 refused, all demoted to chip bursts)`);
    if (moving0 !== nAfterBurst) fails.push(`moving ${moving0} ≠ live ${nAfterBurst} right after the burst`);
    if (resting < nAfterBurst - 1) fails.push(`only ${resting}/${nAfterBurst} at rest after 6 s`);
    if (deb.stats.evicted - evict0 !== 2 || deb.list.length > 4) fails.push(`eviction: ${deb.stats.evicted - evict0} evicted, ${deb.list.length} live (want 2, ≤ 4)`);
    for (const c of deb.list) if (!c.box.c.every(Number.isFinite) || (c.box.rot && !c.box.rot.every(Number.isFinite))) { fails.push(`a chunk with a non-finite pose ${JSON.stringify(c.box.c)}`); break; }
    F.verdict(!fails.length, `pool cap 4: 8 knock-offs in one frame → ${nAfterBurst} chunks + ${demoted} demoted bursts; ${resting}/${nAfterBurst} at rest 6 s on (peak moving ${deb.stats.peakMoving}); two more then evict ${deb.stats.evicted - evict0} resting chunks, ${deb.list.length} live`, fails.join('; ') || deb.summary()); }
  return F.done();
}

// ================================================================ dust
export async function destructionDust() {
  const F = family('destruction-dust: sustained fire into plaster injects short cold dust puffs into the smoke solver — the field the guards\' eyes march — and nothing at chaos 0 or on a lone round');
  { const { W, game, smokeLog } = await stage(3201, 1, [21.5, 0, 11.4], Math.PI);
    fireWeapon(game, game.player.char, WALL, true, { weapon: WEAPONS.fn2000 }); W.step(DT);
    const afterOne = smokeLog.filter(e => e.kind === 'puff').length;   // E after one round at chaos 1 = 2 → over tPuff 1.5? (1 round: heat 1 → E 2 ≥ 1.5 — a puff IS due at chaos 1; at 0.5 it is not: checked below)
    for (let r = 0; r < 20; r++) { fireWeapon(game, game.player.char, [WALL[0] + (r % 5) * 0.2 - 0.4, WALL[1] + (r % 3) * 0.15, WALL[2]], true, { weapon: WEAPONS.fn2000 }); for (let f = 0; f < 6; f++) W.step(DT); }
    const puffs = smokeLog.filter(e => e.kind === 'puff');
    const fails: string[] = [];
    if (puffs.length < 6) fails.push(`only ${puffs.length} puffs from 21 rifle rounds into plaster at chaos 1`);
    for (const p of puffs) {
      if (!(p.density > 0 && p.density <= D.CHAOS.puff.density * 2.01)) { fails.push(`puff density ${p.density} (want (0, ${D.CHAOS.puff.density * 2}])`); break; }
      if (p.lattice !== 'coarse' || !(p.ttl > 0.1 && p.ttl < 1) || !(p.radius >= D.CHAOS.puff.radius * 0.9)) { fails.push(`puff lattice/ttl/radius ${p.lattice}/${p.ttl}/${p.radius}`); break; }
      if (Math.hypot(p.pos[0] - WALL[0], p.pos[2] - WALL[2]) > 1.2 || p.pos[2] < WALL[2]) { fails.push(`a puff at ${p2(p.pos)} — not just off the wall face at z ${WALL[2]}`); break; }
    }
    F.verdict(!fails.length, `21 rounds into the corridor plaster at chaos 1: ${puffs.length} 'puff' emitters (the first round alone: ${afterOne}), density ${puffs[0]?.density?.toFixed(1)} on the coarse lattice, ttl ${puffs[0]?.ttl}, all within a metre of the holes on the room side of the wall`, fails.join('; ') || `refused by the caps: ${D.DESTR_STATS.puffsRefused}`); }
  { const { W, game, smokeLog } = await stage(3202, 0.5, [21.5, 0, 11.4], Math.PI);
    fireWeapon(game, game.player.char, WALL, true, { weapon: WEAPONS.fn2000 }); for (let f = 0; f < 30; f++) W.step(DT);
    const lone = smokeLog.filter(e => e.kind === 'puff').length;
    for (let f = 0; f < 60 * 5; f++) W.step(DT);   // let the heat go
    fireWeapon(game, game.player.char, WALL, true, { weapon: WEAPONS.fn2000 }); W.step(DT); const lone2 = smokeLog.filter(e => e.kind === 'puff').length;
    F.verdict(lone === 0 && lone2 === 0, 'chaos 0.5: a single deliberate round (and another five seconds later) raises no dust cloud — escalation needs a second round inside the heat\'s memory', `puffs after round 1: ${lone}, after the spaced second: ${lone2}, heat then ${f2(game.destr.heatAt(WALL))}`); }
  { const { W, game, smokeLog } = await stage(3203, 0, [21.5, 0, 11.4], Math.PI);
    for (let r = 0; r < 30; r++) { fireWeapon(game, game.player.char, WALL, true, { weapon: WEAPONS.fn2000 }); for (let f = 0; f < 6; f++) W.step(DT); }
    const kinds = new Set(smokeLog.map(e => e.kind));
    F.verdict(!kinds.has('puff') && D.DESTR_STATS.rounds === 0, 'chaos 0: thirty rounds into the same wall inject no puff and the module counts nothing (the shots\' own gas is all the solver gets)', `smoke kinds ${[...kinds].join(',')}; DESTR rounds ${D.DESTR_STATS.rounds}`); }
  return F.done();
}

// ================================================================ screen
export async function destructionScreen() {
  const F = family('destruction-screen: a lit monitor that takes a round dies through its light target and stays dead until the level resets; an unlit one cracks');
  const { W, game } = await stage(3301, 0.5, [17.75, 0, 23.0], Math.PI);
  { const ch = game.props.props.find((p: any) => p.def.kind === 'chair' && Math.hypot(p.x - 17.67, p.z - 21.93) < 0.5); if (ch) { ch.x = 19.6; ch.z = 23.2; ch.place(); } W.step(DT); }   // (the worker's chair out of the line: a chair back is concealment, and takes the round)
  const t = game.targets.find((x: any) => x.name === 'monitor7'); const scr = game.col.boxes[t.boxes[0]];
  const litBefore = t.factor; const item = game.destr.itemOf(t.boxes[0]);
  fireWeapon(game, game.player.char, [scr.c[0], scr.c[1], scr.c[2] + 0.01], true, { weapon: WEAPONS.fiveseven }); W.step(DT);
  const f1 = t.factor, broken = t.broken; const cracks = game.decals.list.filter((d: any) => d.kind === 'damage' && Math.floor(d.param) === 2).length;
  for (let f = 0; f < 600; f++) W.step(DT); const f10 = t.factor;
  const seen = new WeakSet<any>(); newEvents(game, seen);
  // an unlit screen: cracks, no target to break
  const unlit = [...(game.destr as any).items.values()].find((d: any) => d.kind === 'screen' && !d.target && Math.abs(d.box.c[2] - 20.23) < 0.02 && Math.abs(d.box.c[0] - 17.7) < 0.02);
  game.teleportPlayer([17.7, 0, 18.2]); game.player.char.bodyYaw = game.player.char.aimYaw = 0; W.step(DT); W.step(DT);
  const c0 = game.decals.list.filter((d: any) => d.kind === 'damage' && Math.floor(d.param) === 2).length;
  if (unlit) fireWeapon(game, game.player.char, [unlit.box.c[0], unlit.box.c[1], unlit.box.c[2] - 0.01], true, { weapon: WEAPONS.fiveseven }); W.step(DT);
  const c1 = game.decals.list.filter((d: any) => d.kind === 'damage' && Math.floor(d.param) === 2).length;
  game.restartEncounter(); W.step(DT); W.step(DT);
  const tAfter = game.targets.find((x: any) => x.name === 'monitor7');
  const fails: string[] = [];
  if (!(litBefore > 0.99)) fails.push(`staging: monitor7 factor ${litBefore} before the round`); if (!item || (item.kind !== 'screen')) fails.push(`monitor7's screen box is not indexed as a screen (${item?.kind})`);
  if (!broken || f1 !== 0) fails.push(`after the round: broken ${broken}, factor ${f1} (want true / 0)`); if (f10 !== 0) fails.push(`ten seconds on factor ${f10} (want still 0)`);
  if (cracks < 1) fails.push('no crack decal on the lit screen'); if (!unlit) fails.push('staging: the unlit south screen was not found in the index'); else if (c1 - c0 !== 1) fails.push(`unlit screen: ${c1 - c0} crack decals from one round (want 1)`);
  if (!tAfter || tAfter.broken || !(tAfter.factor > 0 || tAfter.on)) fails.push(`after restartEncounter: broken ${tAfter?.broken} factor ${tAfter?.factor}`); if (game.destr.inventory().hidden !== 0) fails.push(`hidden ${game.destr.inventory().hidden} after restart`);
  F.verdict(!fails.length, `monitor7 lit (factor ${litBefore}) → one Five-seveN round in the glass: broken, factor ${f1} next frame and ${f10} ten seconds later, ${cracks} crack decal(s); the unlit screen across the spine takes ${c1 - c0} crack and has no light to lose; a restart lights it again and un-hides all`, fails.join('; ') || `screens ${D.DESTR_STATS.screens}`);
  return F.done();
}

// ================================================================ hearing
export async function destructionHearing() {
  const F = family('destruction-hearing: debris landings are heard at the documented levels and a calm man goes to look; paper and dust are silent');
  { const { W, game } = await stage(3401, 0.5, [30, 0, 22], 0);
    const destr = game.destr as any; const seen = new WeakSet<any>(); newEvents(game, seen);
    const levels: Record<string, number[]> = { tile: [], housing: [], clutter: [], binder: [] };
    // one of each, dropped by hand through the module's own paths, well apart in time
    const dropped = destr.tileDrop([20.5, 0.1, 15.9], 0.5, true);   // (a square clear of the light panels whichever way the jitter walks it)
    for (let f = 0; f < 150; f++) { W.step(DT); for (const e of newEvents(game, seen)) if (e.kind === 'prop') levels.tile.push(e.level); }
    const hous = [...destr.items.values()].find((d: any) => d.kind === 'housing'); destr.knockOff(hous, [0, 0, 1], 0.5, 'housing');
    for (let f = 0; f < 150; f++) { W.step(DT); for (const e of newEvents(game, seen)) if (e.kind === 'prop') levels.housing.push(e.level); }
    const clut = [...destr.items.values()].filter((d: any) => d.kind === 'clutter' && !d.group && !destr.hidden.has(d.i)).sort((a: any, b: any) => Math.hypot(a.box.c[0] - 35.35, a.box.c[2] - 16.15) - Math.hypot(b.box.c[0] - 35.35, b.box.c[2] - 16.15))[0]; destr.knockOff(clut, [-1, 0, 0], 1, 'clutter');   // (the mug on the break-room table, shoved hard enough — chaos 1 — to leave the table: a fall to the floor is a knock, a hop on the table top is rightly next to silent)
    for (let f = 0; f < 150; f++) { W.step(DT); for (const e of newEvents(game, seen)) if (e.kind === 'prop') levels.clutter.push(e.level); }
    const bind = [...destr.items.values()].find((d: any) => d.kind === 'binder' && !d.group && !destr.hidden.has(d.i)); destr.knockOff(bind, [1, 0, 0], 0.5, 'binder');
    for (let f = 0; f < 150; f++) { W.step(DT); for (const e of newEvents(game, seen)) if (e.kind === 'prop') levels.binder.push(e.level); }
    const fails: string[] = [];
    if (!dropped) fails.push('staging: the tile drop was refused'); if (levels.tile[0] !== 0.4) fails.push(`tile landing level ${levels.tile[0]} (want 0.4)`); if (levels.housing[0] !== 0.5) fails.push(`housing ${levels.housing[0]} (want 0.5)`);
    if (levels.clutter[0] !== 0.25) fails.push(`clutter ${levels.clutter[0]} (want 0.25)`); if (!bind || levels.binder[0] !== 0.25) fails.push(`binder ${levels.binder[0]} (want 0.25)`);
    for (const k of Object.keys(levels)) if (levels[k].length > 1 + (k === 'clutter' ? 2 : 0)) fails.push(`${k}: ${levels[k].length} prop events from one drop (each chunk sounds once)`);
    F.verdict(!fails.length, `one tile / housing / mug / binder dropped in turn: 'prop' events at ${levels.tile[0]} / ${levels.housing[0]} / ${levels.clutter[0]} / ${levels.binder[0]} (nobody's), one per chunk`, fails.join('; ') || JSON.stringify(levels)); }
  { // a calm man 5 m from a tile drop, AI on, goes suspicious over it; the same man 5 m from a scattered paper stack + puffs hears nothing
    const { W, game, engine } = await stage(3402, 0.5, [30, 0, 22], 0);
    game.aiEnabled = true; const gd = game.guards[1]; gd.hold = false; gd.pinned = true; gd.dazzledUntil = -1; place(gd, [21.6, 0, 17.2], Math.PI); gd.state = 'patrol'; gd.awareness = 0; gd.heardUpTo = game.eventSeq; resetChase(gd);
    for (let f = 0; f < 30; f++) W.step(DT);
    const destr = game.destr as any;
    // silent things first: a paper stack converted 3 m from him and three dust puffs
    const paper = [...destr.items.values()].find((d: any) => d.kind === 'paper' && Math.hypot(d.box.c[0] - 21.6, d.box.c[2] - 17.2) < 6); destr.convertPaper(paper, [0, 1, 0], 2, 0.5);
    for (let k = 0; k < 3; k++) destr.dustPuff([21.6, 1.2, 15.5], [0, 0, 1], 1, 'drywall');
    for (let f = 0; f < 120; f++) W.step(DT);
    const awSilent = gd.awareness, stSilent = gd.state;
    destr.tileDrop([20.2, 0.1, 15.4], 0.5, true);
    let heard = false; for (let f = 0; f < 240; f++) { W.step(DT); if (gd.state !== 'patrol' || gd.awareness > 0.2) heard = true; }
    const fails: string[] = [];
    if (!paper) fails.push('staging: no paper stack near him'); if (awSilent > 0.05 || stSilent !== 'patrol') fails.push(`paper + puffs moved him: awareness ${f2(awSilent)} state ${stSilent}`);
    if (!heard) fails.push(`a tile landing 2 m off left him at ${gd.state} / ${f2(gd.awareness)}`);
    F.verdict(!fails.length, `Novak calm at (21.6, 17.2): a stack scattered and dust raised nearby leave him at patrol / ${f2(awSilent)}; a ceiling tile landing a couple of metres off → ${gd.state} / awareness ${f2(gd.awareness)}`, fails.join('; ') || 'ok'); void engine; }
  return F.done();
}

// ================================================================ reset
export async function destructionReset() {
  const F = family('destruction-reset: restartEncounter puts every static back bit for bit and empties the pools');
  const { W, game } = await stage(3501, 1);
  const flags0 = game.col.boxes.map((b: any) => b.flags).join(',');
  for (let f = 0; f < 60 * 12; f++) { if (f % 4 === 0) { const p = DESK_PTS[(f / 4) % DESK_PTS.length]; fireWeapon(game, game.player.char, [p[0], p[1], p[2] + ((f % 3) - 1) * 0.4], true, { weapon: WEAPONS.fn2000 }); } if (f === 300) game.destr.bang([17.8, 0.1, 19.4]); W.step(DT); }
  const inv = game.destr.inventory(); const wrecked = { hidden: inv.hidden, debris: game.destr.debris.list.length, tiles: D.DESTR_STATS.tiles, heat: game.destr.heatAt(DESK_PTS[0]) };
  const hiddenFlagsOk = game.col.boxes.every((b: any, i: number) => !(game.destr as any).hidden.has(i) || ((b.flags & (BoxFlag.NoPrimary | BoxFlag.NoShadow)) === (BoxFlag.NoPrimary | BoxFlag.NoShadow)));
  game.restartEncounter(); W.step(DT);
  const flags1 = game.col.boxes.map((b: any) => b.flags).join(',');
  const after = { hidden: game.destr.inventory().hidden, debris: game.destr.debris.list.length, heat: game.destr.heatAt(DESK_PTS[0]), decals: game.decals.count };
  const fails: string[] = [];
  if (wrecked.hidden < 3 || wrecked.debris < 2) fails.push(`staging: only ${wrecked.hidden} hidden / ${wrecked.debris} chunks after the wrecking`); if (!hiddenFlagsOk) fails.push('a hidden static without NoPrimary|NoShadow raised');
  if (flags1 !== flags0) { let i = 0; const a = flags0.split(','), b = flags1.split(','); while (i < a.length && a[i] === b[i]) i++; fails.push(`static #${i} flags ${b[i]} after restart (authored ${a[i]})`); }
  if (after.hidden || after.debris || after.heat !== 0 || after.decals) fails.push(`after restart: ${JSON.stringify(after)}`);
  F.verdict(!fails.length, `12 s of fire + a bang at chaos 1 hid ${wrecked.hidden} statics, left ${wrecked.debris} chunks and ${wrecked.tiles} tiles, heat ${f2(wrecked.heat)}; restartEncounter → every static's flags as authored, ${after.hidden} hidden, ${after.debris} chunks, heat ${after.heat}, ${after.decals} decals`, fails.join('; ') || 'ok');
  return F.done();
}

// ================================================================ identity (chaos 0)
async function recordFight(seed: number, hooks: boolean) {
  Math.random = seeded(seed);
  const W = await standUp(); const { game, engine } = W; const pl = game.player;
  engine.particles = new Particles(fake('device'), fake('sceneLayout')); engine.settings.gpuParticles = true;
  game.tune.chaos = 0; resetStats();
  if (!hooks) { game.destr.round = () => { }; game.destr.bang = () => { }; }   // the module cut out of the two sites entirely
  game.godMode = true; game.aiEnabled = true; game.tune.carbineGuards = 'reyes';
  for (let i = 0; i < 5; i++) W.step(DT);
  const reyes = game.guards.find((g: any) => g.callsign === 'Reyes'); const others = game.guards.filter((g: any) => g !== reyes);
  others.forEach((gd: any, i: number) => park(gd, i));
  game.teleportPlayer([23.5, 0, 11.4]); pl.slot = 'pistol'; pl.holstered = false; pl.crouch = false; pl.pistol.lightOn = false;
  place(reyes, [17.5, 0, 11.3], Math.PI / 2); W.step(DT); pl.visibility = 0.9;
  reyes.hold = false; reyes.pinned = true; reyes.dazzledUntil = -1; reyes.heardUpTo = 1e12; reyes.state = 'alert'; reyes.awareness = 1; reyes.reactT = 0; reyes.fireCd = 0.3; reyes.reloadT = -1; reyes.lastKnown = v3.copy(pl.char.pos); reyes.lastSeenT = game.time; resetChase(reyes);
  const audio: any[] = []; W.audioLog = audio;
  const rounds: string[] = []; const events: string[] = []; const emits: string[] = [];
  const seen = new WeakSet<any>();
  for (let f = 0; f < 15 * 60; f++) {
    pl.visibility = 0.9;
    if (f % 90 === 45) fireWeapon(game, pl.char, [17.4, 1.0 + (f % 3) * 0.1, 10.0], true, { weapon: WEAPONS.fn2000 });
    if (f % 12 === 0 && f > 300 && f < 480) fireWeapon(game, pl.char, [17.6, 0.9 + (f % 5) * 0.05, 10.0], true, { weapon: WEAPONS.fn2000 });   // a sustained string mid-fight (what would escalate at chaos > 0)
    if (f === 600) { const it = game.items.spawn('flash', [20, 0.25, 11.2], [0, 0, 0], { fuse: 9, heading: 0 }); detonateStun(game, it); }
    W.step(DT);
    for (const e of game.events) { if (seen.has(e)) continue; seen.add(e); events.push(`${e.kind}@${f}:${e.level ?? ''}:${e.who ?? ''}`); if (e.from && e.to) rounds.push(`${f}:${p2(e.from)}→${p2(e.to)}`); }
    for (const e of engine.particles.pending) emits.push(`${f}:${e.kind}:${e.count}:${e.seed}`); engine.particles.prepare(DT, true);
  }
  const props = game.props.props.map((p: any) => `${f2(p.x)},${f2(p.z)},${f2(p.yaw)}`).join('|');
  const decals = game.decals.list.map((d: any) => `${d.kind}:${p2(d.pos)}`).join('|');
  return { rounds, events, audio: audio.map(a => `${a.name}@${a.t.toFixed(3)}`), emits, props, decals, flags: game.col.boxes.map((b: any) => b.flags).join(','), stats: { ...D.DESTR_STATS }, reyes: reyes.state };
}
export async function destructionIdentity() {
  const F = family('destruction-identity: at chaos 0 the seeded corridor fight is byte for byte the fight with the module cut out of its two sites');
  const live = await recordFight(8501, true), cut = await recordFight(8501, false);
  const fails: string[] = [];
  for (const k of ['rounds', 'events', 'audio', 'emits'] as const) { const a = live[k], b = cut[k]; if (JSON.stringify(a) !== JSON.stringify(b)) { let i = 0; while (i < Math.min(a.length, b.length) && a[i] === b[i]) i++; fails.push(`${k} differ (${a.length} / ${b.length}) from #${i}: ${a[i] ?? '∅'} | ${b[i] ?? '∅'}`); } }
  for (const k of ['props', 'decals', 'flags'] as const) if (live[k] !== cut[k]) fails.push(`${k} differ`);
  if (Object.values(live.stats).some(v => v !== 0)) fails.push(`the module counted something at chaos 0: ${JSON.stringify(live.stats)}`);
  if (live.rounds.length < 25) fails.push(`staging: only ${live.rounds.length} rounds flew`);
  F.verdict(!fails.length, `${live.rounds.length} rounds, ${live.events.length} events, ${live.audio.length} audio calls, ${live.emits.length} particle records, the furniture, ${live.decals.split('|').length} marks and every static's flags identical; counters all zero; Reyes ${live.reyes} | ${cut.reyes}`, fails.join('; ') || 'identical');
  return F.done();
}

// ================================================================ determinism (chaos 1)
async function recordChaos(seed: number) {
  const { W, game, engine, smokeLog, flush } = await stage(seed, 1);
  const emits: string[] = []; const events: string[] = []; const seen = new WeakSet<any>();
  for (let f = 0; f < 60 * 8; f++) {
    if (f < 300 && f % 6 === 0) { const p = DESK_PTS[(f / 6) % DESK_PTS.length]; fireWeapon(game, game.player.char, p, true, { weapon: WEAPONS.fn2000 }); }
    if (f === 320) game.destr.bang([17.9, 0.1, 19.3]);
    W.step(DT);
    emits.push(...flush().map((s: string) => `${f}:${s}`));
    for (const e of newEvents(game, seen)) events.push(`${e.kind}@${f}:${e.level ?? ''}`);
  }
  const debris = game.destr.debris.list.map((c: any) => `${c.kind}:${p2(c.box.c)}:${c.rest}`).join('|');
  const decals = game.decals.list.map((d: any) => `${d.kind}:${p2(d.pos)}:${d.param.toFixed(3)}`).join('|');
  return { log: D.DESTR_LOG.map(s => s), emits, events, debris, decals, smoke: smokeLog.map(e => `${e.kind}@${e.t.toFixed(3)}`), stats: { ...D.DESTR_STATS } };
}
export async function destructionDeterminism() {
  const F = family('destruction-determinism: the same seeded burst + bang at chaos 1 twice → identical destruction log, debris rest poses, particle emits, decals, smoke emits, events');
  const a = await recordChaos(3701), b = await recordChaos(3701);
  const fails: string[] = [];
  for (const k of ['log', 'emits', 'events', 'smoke'] as const) { const x = a[k], y = b[k]; if (JSON.stringify(x) !== JSON.stringify(y)) { let i = 0; while (i < Math.min(x.length, y.length) && x[i] === y[i]) i++; fails.push(`${k} differ (${x.length} / ${y.length}) from #${i}: ${x[i] ?? '∅'} | ${y[i] ?? '∅'}`); } }
  for (const k of ['debris', 'decals'] as const) if (a[k] !== b[k]) fails.push(`${k} differ`);
  if (a.log.length < 6 || !a.debris) fails.push(`staging: log ${a.log.length} lines, debris '${a.debris.slice(0, 40)}'`);
  F.verdict(!fails.length, `${a.log.length} log lines, ${a.emits.length} particle records, ${a.events.length} events, ${a.smoke.length} smoke emits, ${a.debris.split('|').length} chunks, ${a.decals.split('|').length} marks — identical both runs`, fails.join('; ') || `stats ${JSON.stringify(a.stats)}`);
  return F.done();
}

// ================================================================ bounds (a short loud soak)
export async function destructionBounds() {
  const F = family('destruction-bounds: 90 s of continuous full auto at chaos 1 on a 32-chunk pool never outgrows a cap and never NaNs');
  const { W, game, engine, P, smokeLog } = await stage(3801, 1); engine.settings.debrisCap = 32;
  const deb = game.destr.debris; let maxDeb = 0, maxDec = 0, maxQueue = 0, maxLog = 0, nan = 0, maxHidden = 0;
  const spots: Vec3[] = [...DESK_PTS, [17.6, 0.85, 21.3], [15.4, 0.9, 20.2], [21.7, 0.95, 20.3], [16.5, 1.2, 20.62], [19.5, 1.0, 20.62]];
  for (let f = 0; f < 60 * 90; f++) {
    if (f % 6 === 0) { const p = spots[Math.floor(f / 36) % spots.length]; fireWeapon(game, game.player.char, [p[0] + ((f * 0.011) % 1) * 0.6 - 0.3, p[1], p[2]], true, { weapon: WEAPONS.fn2000 }); }
    if (f % 900 === 450) game.destr.bang([16 + (f / 900) * 1.3, 0.1, 19.4]);
    if (f % 1500 === 0 && f) game.teleportPlayer([15.5 + (f / 1500) * 2, 0, 18.1]);
    W.step(DT); P.prepare(DT, true, 384);
    maxDeb = Math.max(maxDeb, deb.list.length); maxDec = Math.max(maxDec, game.decals.count); maxQueue = Math.max(maxQueue, P.pending.length); maxLog = Math.max(maxLog, D.DESTR_LOG.length); maxHidden = Math.max(maxHidden, game.destr.inventory().hidden);
    if (f % 30 === 0) for (const c of deb.list) if (!c.box.c.every(Number.isFinite) || !c.v.every(Number.isFinite) || (c.box.rot && !c.box.rot.every(Number.isFinite))) nan++;
  }
  const puffT = smokeLog.filter(e => e.kind === 'puff').map(e => e.t); let maxPuffSec = 0; for (let s = 0; s < 90; s++) maxPuffSec = Math.max(maxPuffSec, puffT.filter(t => t >= s && t < s + 1).length);
  const idx = game.destr.inventory(); const indexed = (idx.paper ?? 0) + (idx.screen ?? 0) + (idx.housing ?? 0) + (idx.clutter ?? 0) + (idx.binder ?? 0) + (idx.tv ?? 0);
  const fails: string[] = [];
  if (maxDeb > 32) fails.push(`debris peaked at ${maxDeb} (cap 32)`); if (maxDec > DECAL_CAP) fails.push(`decals ${maxDec} (cap ${DECAL_CAP})`); if (maxQueue > MAX_QUEUE) fails.push(`particle queue ${maxQueue} (cap ${MAX_QUEUE})`);
  if (maxLog > 200) fails.push(`log ${maxLog} lines (cap 200)`); if (nan) fails.push(`${nan} non-finite chunk samples`); if (maxHidden > indexed) fails.push(`hidden ${maxHidden} > indexed ${indexed}`);
  if (maxPuffSec > D.CHAOS.puffsPerSec + 1) fails.push(`puffs ${maxPuffSec} in one second (cap ${D.CHAOS.puffsPerSec})`); if (D.DESTR_STATS.tiles > D.CHAOS.tilesPerEncounter) fails.push(`tiles ${D.DESTR_STATS.tiles} (cap ${D.CHAOS.tilesPerEncounter})`);
  F.verdict(!fails.length, `900 rounds + 6 bangs: debris ≤ ${maxDeb}/32 (spawned ${deb.stats.spawned}, refused ${deb.stats.refused}, evicted ${deb.stats.evicted}), decals ≤ ${maxDec}/${DECAL_CAP}, particle queue ≤ ${maxQueue}/${MAX_QUEUE}, log ≤ ${maxLog}, hidden ≤ ${maxHidden}/${indexed}, puffs ≤ ${maxPuffSec}/s, tiles ${D.DESTR_STATS.tiles}, NaN ${nan}`, fails.join('; ') || `stats ${JSON.stringify(D.DESTR_STATS)}`);
  return F.done();
}

// ================================================================ impulses (later events kick the litter: destruction.ts bangImpulse / impactImpulse / thud → particles.ts impulse + debris.ts impulse)
// Headless there is no kernel, so the GPU half is asserted on the CPU REFERENCE (game/sheetModel.ts impulseKick + sheetImpulse — the equations particles.wgsl
// applyImpulses mirrors, its constants scraped out of the WGSL below) fed the very record destruction.ts queued; the queue, the block, the caps, the gates, the
// debris pool and the three thud sites are the real code.
/** settled reference leaves on the floor round `c` at hashed bearings, distances lo‥hi m */
function leavesAround(rnd: () => number, c: Vec3, n: number, lo: number, hi: number) { const out: { s: any; d: number; p0: Vec3 }[] = []; for (let i = 0; i < n; i++) { const d = lo + (hi - lo) * (i + rnd()) / n, a = rnd() * 6.283; const p: Vec3 = [c[0] + Math.cos(a) * d, 0.004, c[2] + Math.sin(a) * d]; out.push({ s: { p, v: [0, 0, 0], n: [0, 1, 0], w: [0, 0, 0], asleep: true, age: 0 }, d, p0: [...p] as Vec3 }); } return out; }
export async function destructionImpulses() {
  const F = family('destruction-impulses: a charge / a round / a thump push what already lies about — the record destruction.ts queues, flown on the reference; the queue\'s cap, the idle frame, the debris pool, the gates, the WGSL mirror');
  const rec = (r: any) => ({ pos: [...r.pos] as Vec3, radius: r.radius, strength: r.strength, up: r.up, bias: [...r.bias] as Vec3, eye: [...r.eye] as Vec3, kinds: r.kinds, flags: r.flags });
  { // (1) the BANG's record on the reference: ≥ 90 % of the leaves within 2 m wake and fly, none beyond the radius stirs, all re-settle within ~2 s, |v| ≤ vMax, the near ones rise 0.5‥2.5 m
    const { W, game, P } = await stage(3901, 0.5, [30, 0, 22], 0);
    const at: Vec3 = [17.9, 0.13, 18.6]; game.destr.testImpulse(at, 'bang');
    const q = P.pendingImpulses; const r = q.length ? rec(q[0]) : null; P.prepare(DT, true);
    const fails: string[] = [];
    if (!r) fails.push('destr.testImpulse(bang) queued no particle impulse at chaos 0.5');
    else {
      if (r.radius !== D.CHAOS.imp.bang.radius || Math.abs(r.strength - D.CHAOS.imp.bang.strength * D.impK(0.5)) > 1e-9 || r.up !== D.CHAOS.imp.bang.up || !(r.flags & 1) || Math.abs(r.eye[1] - 0.95) > 1e-6 || (r.kinds & 31) !== 30 || (r.kinds & 1)) fails.push(`record ${JSON.stringify(r)} (want radius ${D.CHAOS.imp.bang.radius} strength ${D.CHAOS.imp.bang.strength} up ${D.CHAOS.imp.bang.up} occlude eye y 0.95 kinds 30 of the first five — debris|dust|casing|sheet, never sparks)`);
      const rnd = seeded(77); const leaves = leavesAround(rnd, at, 320, 0.15, 4.6);
      let in2 = 0, woke2 = 0, beyond = 0, wokeBeyond = 0, unsettled = 0, vmax = 0, nan = 0; const riseNear: number[] = []; let maxSettle = 0;
      for (const L of leaves) {
        const k = SM.impulseKick(r, L.s.p, SM.IMP_RESPONSE.sheet, [rnd(), rnd()]);
        const horiz = Math.hypot(L.s.p[0] - at[0], L.s.p[2] - at[2]);
        if (horiz > r.radius) { beyond++; if (k && SM.sheetImpulse(L.s, k.dv, k.s, [rnd(), rnd(), rnd()])) wokeBeyond++; continue; }
        const woke = !!k && SM.sheetImpulse(L.s, k.dv, k.s, [rnd(), rnd(), rnd()]);
        if (L.d < 2) { in2++; if (woke) woke2++; }
        if (!woke) continue;
        const fl = flySheet(L.s, DT, 6, 0);
        if (!fl.asleep) unsettled++; if (fl.nan) nan++; vmax = Math.max(vmax, fl.peakV); maxSettle = Math.max(maxSettle, fl.t);
        if (L.d < 1) riseNear.push(fl.peakY);
      }
      const meanRise = riseNear.reduce((a, b) => a + b, 0) / Math.max(1, riseNear.length);
      if (woke2 < 0.9 * in2) fails.push(`only ${woke2}/${in2} leaves within 2 m woke`); if (wokeBeyond) fails.push(`${wokeBeyond}/${beyond} leaves beyond the ${r.radius} m radius stirred`);
      if (unsettled) fails.push(`${unsettled} kicked leaves still flying 6 s on`); if (!(maxSettle < 2.6)) fails.push(`slowest re-settle ${f2(maxSettle)} s (want < 2.6)`);
      if (vmax > SM.IMP_RESPONSE.sheet.vMax + 1e-6) fails.push(`peak |v| ${f2(vmax)} > vMax ${SM.IMP_RESPONSE.sheet.vMax}`); if (nan) fails.push(`${nan} NaN`);
      if (!(meanRise > 0.5 && meanRise < 2.5)) fails.push(`leaves within 1 m rose ${f2(meanRise)} m on average (want 0.5‥2.5)`);
      { // the `lay` rule: a LYING leaf is tipped off flat and lifted by its edge; one already in the air keeps its attitude and place (a second kick must not snap it)
        const flat = { p: [1, 0.004, 0] as Vec3, v: [0, 0, 0] as Vec3, n: [0, 1, 0] as Vec3, w: [0, 0, 0] as Vec3, asleep: true, age: 0 }; SM.sheetImpulse(flat, [0, 2, 0], 2, [0.3, 0.9, 0.5]);
        const air = { p: [1, 0.8, 0] as Vec3, v: [0, 1, 0] as Vec3, n: [0.6, 0.8, 0] as Vec3, w: [0, 0, 0] as Vec3, asleep: false, age: 0 }; SM.sheetImpulse(air, [0, 2, 0], 2, [0.3, 0.9, 0.5]);
        if (!(flat.n[1] < 0.95) || !(flat.p[1] > 0.02)) fails.push(`a lying leaf kicked at 2 m/s kept n.y ${f2(flat.n[1])} / y ${f2(flat.p[1])} (want tipped and lifted)`);
        if (Math.abs(air.n[0] - 0.6) > 1e-9 || Math.abs(air.n[1] - 0.8) > 1e-9 || air.p[1] !== 0.8 || !(v3.len(air.w) > 0)) fails.push(`an airborne leaf kicked: n ${p2(air.n)} y ${air.p[1]} |w| ${f2(v3.len(air.w))} (want its normal and place untouched, a tumble added)`); }
      F.verdict(!fails.length, `the bang's record {r ${r.radius}, s ${f2(r.strength)}, up ${r.up}, occlude} on 320 settled reference leaves: ${woke2}/${in2} within 2 m fly, ${wokeBeyond}/${beyond} beyond ${r.radius} m stir; the near ones rise ${f2(meanRise)} m, all down again by ${f2(maxSettle)} s, peak |v| ${f2(vmax)} ≤ ${SM.IMP_RESPONSE.sheet.vMax}`, fails.join('; ') || 'ok');
    }
    void W; }
  { // (2) the IMPACT's record: a round into the aisle floor → radius 0.6, biased along its travel; leaves within half a metre scoot, nothing at 0.6+ moves; a THUD's record: radius 1, floored centre
    const { game, P } = await stage(3902, 0.5, [16.4, 0, 18.6], Math.PI / 2);
    const hit: Vec3 = [17.9, 0.0, 18.6]; fireWeapon(game, game.player.char, hit, true, { weapon: WEAPONS.fn2000 });
    const q = P.pendingImpulses.map(rec); P.prepare(DT, true);
    const r = q.find((x: any) => Math.abs(x.radius - D.CHAOS.imp.impact.radius) < 1e-9);
    const fails: string[] = [];
    if (!r) fails.push(`no impact impulse queued by a rifle round into the floor (queued: ${JSON.stringify(q)})`);
    else {
      const rnd = seeded(78); const leaves = leavesAround(rnd, [r.pos[0], 0, r.pos[2]], 200, 0.03, 1.0);
      let inHalf = 0, wokeHalf = 0, wokeFar = 0, far = 0, maxDrift = 0, alongBias = 0, nW = 0;
      const bl = Math.hypot(r.bias[0], r.bias[2]);
      for (const L of leaves) {
        const k = SM.impulseKick(r, L.s.p, SM.IMP_RESPONSE.sheet, [rnd(), rnd()]); const woke = !!k && SM.sheetImpulse(L.s, k.dv, k.s, [rnd(), rnd(), rnd()]);
        const dd = Math.hypot(L.s.p[0] - r.pos[0], L.s.p[2] - r.pos[2]);
        if (dd < 0.5) { inHalf++; if (woke) wokeHalf++; } else if (dd >= r.radius) { far++; if (woke) wokeFar++; }
        if (!woke) continue;
        const fl = flySheet(L.s, DT, 4, 0); maxDrift = Math.max(maxDrift, fl.drift);
        if (bl > 1e-6) { alongBias += ((L.s.p[0] - L.p0[0]) * r.bias[0] + (L.s.p[2] - L.p0[2]) * r.bias[2]) / bl; nW++; }
      }
      if (wokeHalf < 0.8 * inHalf) fails.push(`only ${wokeHalf}/${inHalf} leaves within 0.5 m scooted`); if (wokeFar) fails.push(`${wokeFar}/${far} leaves at ≥ ${r.radius} m moved`);
      if (!(maxDrift < 0.8)) fails.push(`a leaf scooted ${f2(maxDrift)} m (a round beside it is a span, not a throw)`);
      if (!(bl > 0.05) || !(alongBias / Math.max(1, nW) > 0)) fails.push(`bias |${f2(bl)}| / mean travel along it ${f2(alongBias / Math.max(1, nW))} (a slanting round should carry the leaves on along its travel)`);
      F.verdict(!fails.length, `a rifle round into the aisle floor queues {r ${r.radius}, s ${f2(r.strength)}, up ${r.up}, bias ${f2(bl)} along its travel}: ${wokeHalf}/${inHalf} leaves within half a metre hop-and-scoot (≤ ${f2(maxDrift)} m, on along the round by ${f2(alongBias / Math.max(1, nW))} m), ${wokeFar}/${far} at ${r.radius} m+ move`, fails.join('; ') || 'ok');
    }
    // the thud: centre floored whatever reported it
    game.destr.thud([20, 1.0, 18], 1); const t = P.pendingImpulses.map(rec).find((x: any) => Math.abs(x.radius - D.CHAOS.imp.thud.radius) < 1e-9); P.prepare(DT, true);
    F.verdict(!!t && t.pos[1] < 0.4 && !(t.flags & 1), 'a thud reported a metre up (a kicked leaf\'s centre) is queued at the floor under it, radius 1, unoccluded — the litter is on the floor', `thud record ${JSON.stringify(t)}`); }
  { // (3) the CAP: forty charges in one frame → ≤ MAX_IMPULSES records, the rest merged into neighbours or dropped weakest-first, no merged strength past 2× a single; the block carries the count in flags bits 8‥12 and the records at IMP_OFFSET
    const { game, P } = await stage(3903, 1);
    // something live to push (a frame with impulses but nothing alive uploads nothing — checked in (4))
    P.emit('sheet', [18, 0.3, 18], [0, 1, 0], 40, { speed: 1, life: 60, size: 0.2 }); P.prepare(DT, true);
    const s0 = { ...P.stats }; const single = D.CHAOS.imp.bang.strength * D.impK(1);
    for (let k = 0; k < 40; k++) game.destr.testImpulse([10 + (k % 8) * 2.2, 0.13, 8 + Math.floor(k / 8) * 2.6], 'bang');   // 2.2 / 2.6 m apart: past the sixteenth, each newcomer is > IMPULSE_MERGE_M from all but perhaps one
    for (let k = 0; k < 8; k++) game.destr.testImpulse([10.3 + k * 2.2, 0.13, 8.2], 'bang');   // eight more right beside the first row: these MERGE
    const nq = P.pendingImpulseCount; const recs = P.pendingImpulses.map(rec); const maxS = Math.max(...recs.map((r: any) => r.strength));
    const bu: Uint32Array = (P as any).bu, bf: Float32Array = (P as any).bf;
    P.prepare(DT, true);
    const flagsCount = (bu[3] >> 8) & 31; const IW = IMP_OFFSET / 4, RS = IMP_BYTES / 4;
    const rec0 = { x: bf[IW], y: bf[IW + 1], z: bf[IW + 2], radius: bf[IW + 3], strength: bf[IW + 7], up: bf[IW + 11], kinds: bu[IW + 12], flags: bu[IW + 14] };
    const fails: string[] = [];
    if (nq > MAX_IMPULSES) fails.push(`${nq} records queued (cap ${MAX_IMPULSES})`); if (P.stats.impQueued - s0.impQueued !== 48) fails.push(`queued counter ${P.stats.impQueued - s0.impQueued} ≠ 48`);
    if ((P.stats.impMerged - s0.impMerged) + (P.stats.impDropped - s0.impDropped) !== 48 - MAX_IMPULSES) fails.push(`merged ${P.stats.impMerged - s0.impMerged} + dropped ${P.stats.impDropped - s0.impDropped} ≠ ${48 - MAX_IMPULSES}`);
    if (P.stats.impMerged - s0.impMerged < 4) fails.push(`only ${P.stats.impMerged - s0.impMerged} merges (eight charges landed within a metre of queued ones)`);
    if (maxS > single * 2 + 1e-9) fails.push(`a merged record's strength ${f2(maxS)} > 2 × ${f2(single)}`);
    if (flagsCount !== nq || P.stats.impulses !== nq) fails.push(`the block's count ${flagsCount} / stats.impulses ${P.stats.impulses} ≠ ${nq}`);
    if (rec0.radius !== recs[0].radius || Math.abs(rec0.strength - recs[0].strength) > 1e-5 || rec0.x !== Math.fround(recs[0].pos[0]) || rec0.kinds !== recs[0].kinds || rec0.flags !== 1 || rec0.up !== recs[0].up) fails.push(`record 0 in the block ${JSON.stringify(rec0)} vs queued ${JSON.stringify(recs[0])}`);
    if (bf[IW + RS + 3] !== recs[1].radius) fails.push(`record 1 radius in the block ${bf[IW + RS + 3]} (stride ${IMP_BYTES} B)`);
    F.verdict(!fails.length, `48 charges in one frame → ${nq}/${MAX_IMPULSES} records (${P.stats.impMerged - s0.impMerged} merged, ${P.stats.impDropped - s0.impDropped} dropped), strongest ${f2(maxS)} ≤ 2 × ${f2(single)}; the block: count ${flagsCount} in flags bits 8‥12, record 0 at byte ${IMP_OFFSET} = {r ${rec0.radius}, s ${f2(rec0.strength)}, kinds ${rec0.kinds}, occlude ${rec0.flags}}, stride ${IMP_BYTES}`, fails.join('; ') || 'ok'); }
  { // (4) the IDLE frame costs nothing: no impulses → one header upload (+ the pool's counter zero), count 0; impulses with nothing live → not uploaded, counted idle; impulses + live → exactly one extra upload of n × IMP_BYTES at IMP_OFFSET
    const writes: { off: number; size: number }[] = [];
    const dev = new Proxy(fake('device'), { get(t: any, p: PropertyKey) { if (p === 'queue') return { writeBuffer: (_b: any, off: number, _d: any, _doff: number, size: number) => { writes.push({ off, size }); }, onSubmittedWorkDone: () => Promise.resolve() }; return t[p]; } });
    const P = new Particles(dev, fake('sceneLayout')); const bu: Uint32Array = (P as any).bu;
    writes.length = 0; P.prepare(DT, true); const idleEmpty = writes.map(w => `${w.off}+${w.size}`);
    P.impulse([1, 0, 1], 2, 3, {}); writes.length = 0; P.prepare(DT, true); const impNoLive = writes.map(w => `${w.off}+${w.size}`); const idleStat = P.stats.impIdle; const cnt0 = (bu[3] >> 8) & 31;
    P.emit('debris', [1, 0.2, 1], [0, 1, 0], 10, { speed: 1, life: 10, size: 0.01 }); P.prepare(DT, true);   // now something is live
    writes.length = 0; P.prepare(DT, true); const idleLive = writes.map(w => `${w.off}+${w.size}`); const cnt1 = (bu[3] >> 8) & 31;
    P.impulse([1, 0, 1], 2, 3, {}); P.impulse([5, 0, 5], 1, 1, { occlude: true }); writes.length = 0; P.prepare(DT, true); const withImp = writes.map(w => `${w.off}+${w.size}`); const cnt2 = (bu[3] >> 8) & 31;
    writes.length = 0; P.prepare(DT, true); const after = writes.map(w => `${w.off}+${w.size}`); const cnt3 = (bu[3] >> 8) & 31;
    const fails: string[] = [];
    if (idleEmpty.length !== 1 || idleEmpty[0] !== `0+${BLOCK_HDR_BYTES}`) fails.push(`empty idle frame writes ${idleEmpty.join(' ')} (want one header of ${BLOCK_HDR_BYTES})`);
    if (impNoLive.some(w => w.startsWith(`${IMP_OFFSET}+`)) || idleStat !== 1 || cnt0 !== 0) fails.push(`impulse with nothing live: writes ${impNoLive.join(' ')}, impIdle ${idleStat}, count ${cnt0} (want no tail upload, idle 1, count 0)`);
    if (idleLive.some(w => w.startsWith(`${IMP_OFFSET}+`)) || cnt1 !== 0) fails.push(`live idle frame writes ${idleLive.join(' ')} count ${cnt1}`);
    if (withImp.filter(w => w === `${IMP_OFFSET}+${2 * IMP_BYTES}`).length !== 1 || cnt2 !== 2) fails.push(`frame with 2 impulses writes ${withImp.join(' ')} count ${cnt2} (want one ${IMP_OFFSET}+${2 * IMP_BYTES} upload, count 2)`);
    if (after.some(w => w.startsWith(`${IMP_OFFSET}+`)) || cnt3 !== 0 || P.pendingImpulseCount !== 0) fails.push(`the frame after: writes ${after.join(' ')} count ${cnt3} pending ${P.pendingImpulseCount} (the queue empties every frame)`);
    F.verdict(!fails.length, `no impulses → the header alone (${idleEmpty.join(' ')}), count 0; an impulse with nothing live → no tail upload, counted idle; two impulses over live particles → one ${2 * IMP_BYTES} B upload at ${IMP_OFFSET}, count 2 in flags; the next frame back to nothing`, fails.join('; ') || `writes: ${idleLive.join(' ')} | ${withImp.join(' ')}`); }
  { // (5) the DEBRIS pool gets the same events: resting chunks near a charge wake and hop (none beyond its radius, none behind the spine), a round half a metre off nudges one, a metre off does not
    const { W, game, engine } = await stage(3905, 0.5); engine.settings.debrisCap = 64;
    const destr = game.destr as any; const deb = destr.debris; const kps0 = D.CHAOS.knocksPerSec; D.CHAOS.knocksPerSec = 99;
    const items = [...destr.items.values()].filter((d: any) => (d.kind === 'clutter' || d.kind === 'binder') && !d.group).slice(0, 8);
    for (const it of items) destr.knockOff(it, [1, 0, 0], 0.5, it.kind === 'binder' ? 'binder' : 'clutter');
    for (let f = 0; f < 60 * 6; f++) W.step(DT);
    D.CHAOS.knocksPerSec = kps0;
    const resting = deb.list.filter((c: any) => c.rest); const fails: string[] = [];
    const onFloor = resting.filter((c: any) => c.box.c[1] < 0.2 && !game.col.solidBlocked([c.box.c[0] + 0.7, 0.95, c.box.c[2]], [c.box.c[0], c.box.c[1] + 0.05, c.box.c[2]]));   // (one lying on the open floor, in plain reach of a charge beside it — not the mug that stayed on its shelf)
    if (resting.length < 4 || !onFloor.length) fails.push(`staging: only ${resting.length}/${deb.list.length} chunks at rest after 6 s, ${onFloor.length} on the open floor`);
    else {
      const c0 = onFloor[0]; const at: Vec3 = [c0.box.c[0] + 0.7, 0.13, c0.box.c[2]];
      const before = deb.list.map((c: any) => ({ c, rest: c.rest, d: Math.hypot(c.box.c[0] - at[0], c.box.c[1] - at[1], c.box.c[2] - at[2]), blocked: game.col.solidBlocked([at[0], 0.95, at[2]], [c.box.c[0], c.box.c[1] + 0.05, c.box.c[2]]) }));
      const k0 = deb.stats.kicked; game.destr.testImpulse(at, 'bang');
      const R = D.CHAOS.imp.bang.radius; let nearFree = 0, nearWoke = 0, farMoved = 0, blockedMoved = 0;
      for (const b of before) { if (!b.rest) continue; const movedNow = !b.c.rest && v3.len(b.c.v) > 0; if (b.d < R * 0.6 && !b.blocked) { nearFree++; if (movedNow) nearWoke++; } if (b.d >= R && movedNow) farMoved++; if (b.blocked && b.d > 0.5 && movedNow) blockedMoved++; }
      if (nearFree < 1) fails.push('staging: no resting unblocked chunk within reach of the charge'); if (nearWoke !== nearFree) fails.push(`only ${nearWoke}/${nearFree} resting chunks in reach woke`);
      if (farMoved) fails.push(`${farMoved} chunks beyond ${R} m moved`); if (blockedMoved) fails.push(`${blockedMoved} chunks behind a partition moved`);
      for (const c of deb.list) if (v3.len(c.v) > DEBRIS_IMP.vMax + 1e-6) fails.push(`a chunk at ${f2(v3.len(c.v))} m/s > vMax ${DEBRIS_IMP.vMax}`);
      const kicked = deb.stats.kicked - k0;
      // let them rest again, then a round: 0.3 m from one → nudged; every other resting chunk further than debrisM stays
      for (let f = 0; f < 60 * 5; f++) W.step(DT);
      const r1 = deb.list.find((c: any) => c.rest && c.box.c[1] < 0.2); let nudged = false, othersStill = true;
      if (r1) { const p1: Vec3 = [r1.box.c[0] + 0.3, r1.box.c[1], r1.box.c[2]]; const others = deb.list.filter((c: any) => c !== r1 && c.rest && Math.hypot(c.box.c[0] - p1[0], c.box.c[1] - p1[1], c.box.c[2] - p1[2]) > D.CHAOS.imp.impact.debrisM + 0.05);
        game.destr.testImpulse(p1, 'impact', [0, -0.7, 0.7]); nudged = !r1.rest && v3.len(r1.v) > 0; othersStill = others.every((c: any) => c.rest); }
      if (!r1) fails.push('staging: nothing came to rest again for the round'); else { if (!nudged) fails.push('a round 0.3 m from a resting chunk left it asleep'); if (!othersStill) fails.push('a round woke a chunk further than debrisM off'); }
      F.verdict(!fails.length, `${resting.length} chunks at rest; a charge 0.7 m from one → ${nearWoke}/${nearFree} unblocked chunks in reach wake and hop (${kicked} kicked, |v| ≤ ${DEBRIS_IMP.vMax}), none beyond ${R} m or behind the spine; at rest again, a round 0.3 m off nudges one (${nudged}) and leaves the rest (${othersStill})`, fails.join('; ') || deb.summary());
    }
    if (fails.length && (resting.length < 4 || !onFloor.length)) F.verdict(false, 'debris pool impulses', fails.join('; ')); }
  { // (6) the GATES: chaos 0 → the three sites queue nothing and count nothing; chaos 1 with tune.debrisImpulses off → nothing queued while the rest of the destruction runs
    const { W, game, P } = await stage(3906, 0, [17.75, 0, 23.0], Math.PI);
    for (let f = 0; f < 90; f++) { if (f % 3 === 0) { const p = NORTH_PTS[(f / 3) % NORTH_PTS.length]; fireWeapon(game, game.player.char, p, true, { weapon: WEAPONS.fn2000 }); } W.step(DT); }
    game.destr.bang([17.8, 0.13, 21.9]); game.destr.thud([17.8, 0, 21.9], 1); game.destr.testImpulse([17.8, 0.13, 21.9], 'bang');
    const q0 = P.pendingImpulseCount; const st0 = { b: D.DESTR_STATS.impBang, i: D.DESTR_STATS.impImpact, t: D.DESTR_STATS.impThud, q: P.stats.impQueued };
    const { W: W2, game: g2, P: P2 } = await stage(3907, 1, [17.75, 0, 23.0], Math.PI); g2.tune.debrisImpulses = false;
    for (let f = 0; f < 90; f++) { if (f % 3 === 0) { const p = NORTH_PTS[(f / 3) % NORTH_PTS.length]; fireWeapon(g2, g2.player.char, p, true, { weapon: WEAPONS.fn2000 }); } W2.step(DT); P2.prepare(DT, true); }
    g2.destr.bang([17.8, 0.13, 21.9]); g2.destr.thud([17.8, 0, 21.9], 1);
    const q1 = P2.pendingImpulseCount; const papers = D.DESTR_STATS.papers; const st1 = { b: D.DESTR_STATS.impBang, i: D.DESTR_STATS.impImpact, t: D.DESTR_STATS.impThud };
    g2.tune.debrisImpulses = true; g2.destr.thud([17.8, 0, 21.9], 1); const q2 = P2.pendingImpulseCount;
    const fails: string[] = [];
    if (q0 || st0.b || st0.i || st0.t || st0.q) fails.push(`chaos 0: ${q0} queued, counters ${JSON.stringify(st0)}`);
    if (q1 || st1.b || st1.i || st1.t) fails.push(`impulses off at chaos 1: ${q1} queued, counters ${JSON.stringify(st1)}`); if (papers < 1) fails.push('impulses off switched the destruction off too (no paper converted at chaos 1)');
    if (q2 !== 1) fails.push(`switched back on: ${q2} queued by one thud (want 1)`);
    F.verdict(!fails.length, `chaos 0: thirty rounds, a charge, a thud, a test kick → ${q0} impulses queued, counters zero; chaos 1 with tune.debrisImpulses off → ${q1} queued while ${papers} stacks still convert; back on → the next thud queues ${q2}`, fails.join('; ') || 'ok'); }
  { // (7) the WGSL mirror: particles_common.wgsl carries sheetModel's impulse constants, MAX_IMPS = MAX_IMPULSES; the block's ki rows = IMP_RESPONSE per kind
    const wg = readFileSync(`${ROOT}/src/render/shaders/particles_common.wgsl`, 'utf8'); const fails: string[] = [];
    const want: Record<string, number> = { SHEET_IMP_TILT: SM.SHEET_IMP.TILT, SHEET_IMP_TUMBLE: SM.SHEET_IMP.TUMBLE, SHEET_IMP_WMAX: SM.SHEET_IMP.WMAX, SHEET_IMP_GUST0: SM.SHEET_IMP.GUST0, SHEET_IMP_GUST1: SM.SHEET_IMP.GUST1, SHEET_GUST_TAU: SM.SHEET_GUST.TAU, SHEET_GUST_K: SM.SHEET_GUST.K, SHEET_GUST_RAMP: SM.SHEET_GUST.RAMP, IMP_MIN_KICK: SM.IMP_MIN_KICK, IMP_JITTER_MAG: SM.IMP_JITTER.MAG, IMP_JITTER_SIDE: SM.IMP_JITTER.SIDE };
    for (const [k, v] of Object.entries(want)) { const m = new RegExp(`const ${k}: f32 = ([0-9.]+);`).exec(wg); if (!m || Number(m[1]) !== v) fails.push(`${k} ${m?.[1] ?? 'missing'} ≠ ${v}`); }
    const mi = /const MAX_IMPS: u32 = (\d+)u;/.exec(wg); if (!mi || Number(mi[1]) !== MAX_IMPULSES) fails.push(`MAX_IMPS ${mi?.[1]} ≠ MAX_IMPULSES ${MAX_IMPULSES}`);
    // imps sit straight after recs at IMP_OFFSET (the tail upload assumes it); the struct then either ends, or ends with the particle rain's own tail — its ring's Window + the six rainCfg rows
    // (render/particles.ts BLOCK_TAIL_AT / BLOCK_TAIL_BYTES = 16 + 6·16, its own small upload) — nothing may ride between imps and that tail
    if (!/recs: array<EmitRec, MAX_EMITS>,\s*\n\s*imps: array<ImpulseRec, MAX_IMPS>,\s*\n(\};|\s*rainWin: Window,[^\n]*\n(\s*\/\/[^\n]*\n)*(\s*rainCfg[B-F]?: vec4f,[^\n]*\n){6}\};)/.test(wg)) fails.push('EmitBlock: imps do not follow recs, or something other than the rain tail (rainWin + rainCfg‥rainCfgF) follows imps (the tail uploads at IMP_OFFSET / BLOCK_TAIL_AT assume it)');
    { const PT = await import(`${ROOT}/src/render/particles.ts`) as { BLOCK_TAIL_AT?: number; BLOCK_TAIL_BYTES?: number; BLOCK_BYTES: number };
      if (PT.BLOCK_TAIL_AT !== undefined && (PT.BLOCK_TAIL_AT !== IMP_OFFSET + MAX_IMPULSES * IMP_BYTES || PT.BLOCK_TAIL_BYTES !== 16 + 6 * 16 || PT.BLOCK_BYTES !== PT.BLOCK_TAIL_AT + PT.BLOCK_TAIL_BYTES)) fails.push(`the rain tail is not at IMP_OFFSET + MAX_IMPULSES·IMP_BYTES (${PT.BLOCK_TAIL_AT} vs ${IMP_OFFSET + MAX_IMPULSES * IMP_BYTES}) or not 112 B (${PT.BLOCK_TAIL_BYTES}) or the block does not end with it (${PT.BLOCK_BYTES})`); }
    if (!new RegExp(`kp: array<vec4f, ${2 * P_KINDS.length}>,[^\\n]*\\n\\s*ki: array<vec4f, ${P_KINDS.length}>,\\s*\\/\\/[^\\n]*\\n\\s*recs: array<EmitRec, MAX_EMITS>,`).test(wg)) fails.push(`EmitBlock: kp / ki are not the ${2 * P_KINDS.length} + ${P_KINDS.length} vec4 rows right before recs (BLOCK_HDR_BYTES ${BLOCK_HDR_BYTES} = 48 + 48·kinds assumes it)`);
    const src = readFileSync(`${ROOT}/src/render/shaders/particles.wgsl`, 'utf8');
    if (!/if \(numImpulses\(\) > 0u && !isNew && dt > 0\.0\)/.test(src)) fails.push('the update kernel no longer gates applyImpulses on numImpulses() > 0 && !isNew (the idle frame / the born-this-frame rule)');
    if (!/\(1\.0 - d \/ im\.radius\)/.test(src)) fails.push('applyImpulses falloff is not (1 − d/r) like impulseFalloff');
    const P = new Particles(fake('device'), fake('sceneLayout')); const bf: Float32Array = (P as any).bf; P.prepare(DT, true);
    ['spark', 'debris', 'dust', 'casing', 'sheet'].forEach((k, i) => { const G = (SM.IMP_RESPONSE as any)[k]; const o = KI_FLOAT + i * 4; if (bf[o] !== Math.fround(G.gain) || bf[o + 1] !== Math.fround(G.upK) || bf[o + 2] !== Math.fround(G.vMax) || bf[o + 3] !== Math.fround(G.wake)) fails.push(`ki row ${k} = ${[bf[o], bf[o + 1], bf[o + 2], bf[o + 3]].join(',')} ≠ IMP_RESPONSE ${JSON.stringify(G)}`); });
    if (SM.IMP_RESPONSE.spark.gain !== 0) fails.push('sparks respond to impulses (gain must stay 0)'); if (SM.IMP_RESPONSE.sheet.vMax > 6) fails.push(`sheet vMax ${SM.IMP_RESPONSE.sheet.vMax} > 6 m/s`);
    F.verdict(!fails.length, `particles_common.wgsl carries TILT / TUMBLE / WMAX / GUST0 / GUST1 / GUST_TAU / GUST_K / GUST_RAMP / IMP_MIN_KICK / JITTER = sheetModel's, MAX_IMPS = ${MAX_IMPULSES}, imps at the block's tail, ki before recs; the kernel gates on numImpulses() and !isNew with the linear falloff; the block's ki rows = IMP_RESPONSE (sparks 0, sheets ≤ 6 m/s)`, fails.join('; ') || 'ok'); }
  { // (9) WHO knocked it down is who is heard doing it (debris.ts Chunk.who): a mug sent off the break-room table by a GUARD's round lands as his side's own clumsiness — the calm
    //     man beside it does not stir and Sam's debrief gets no 'heard' row; by SAM's round it is heard, looked at and chronicled as his; by NOBODY (a tile on its own) it is looked at
    //     but nobody's in the debrief
    const out: Record<string, { who: number; heardRows: number; awareness: number; state: string; evWho: number | undefined }> = {}; let guardId = -1;
    for (const label of ['guard', 'sam', 'nobody'] as const) {
      const { W, game } = await stage(3909, 0.5, [30, 0, 22], 0);
      guardId = game.guards[2].char.id; const who = label === 'guard' ? guardId : label === 'sam' ? PLAYER_ID : NOBODY_ID;   // (Reyes's id off the roster, not a literal: 10 + index today)
      game.aiEnabled = true; const gd = game.guards[1]; gd.hold = false; gd.pinned = true; gd.dazzledUntil = -1; place(gd, [33.6, 0, 17.4], Math.PI / 2); gd.state = 'patrol'; gd.awareness = 0; gd.heardUpTo = game.eventSeq; resetChase(gd);
      for (let f = 0; f < 30; f++) W.step(DT);
      const destr = game.destr as any; const kps0 = D.CHAOS.knocksPerSec; D.CHAOS.knocksPerSec = 99;
      const mug = [...destr.items.values()].filter((d: any) => d.kind === 'clutter' && !d.group && !destr.hidden.has(d.i)).sort((a: any, b: any) => Math.hypot(a.box.c[0] - 35.35, a.box.c[2] - 16.15) - Math.hypot(b.box.c[0] - 35.35, b.box.c[2] - 16.15))[0];
      const h0 = game.chronicle.counts.heard; const seen = new WeakSet<any>(); newEvents(game, seen);
      if (!mug) { D.CHAOS.knocksPerSec = kps0; F.verdict(false, 'who knocked it down', 'staging: no free mug indexed by the break-room table'); return F.done(); }
      destr.knockOff(mug, [-1, 0, 0], 1, 'clutter', who); D.CHAOS.knocksPerSec = kps0;
      let evWho: number | undefined; let peak = 0; for (let f = 0; f < 180; f++) { W.step(DT); peak = Math.max(peak, gd.awareness); for (const e of newEvents(game, seen)) if (e.kind === 'prop' && evWho === undefined) evWho = e.who; }
      out[label] = { who, heardRows: game.chronicle.counts.heard - h0, awareness: peak, state: gd.state, evWho };   // (awareness: its PEAK — a mug's knock two metres off pricks his ears (≈ 0.2) and fades, it does not turn him round like a tile)
    }
    const fails: string[] = [];
    if (out.guard.evWho !== guardId || guardId < 10 || out.guard.heardRows !== 0 || out.guard.awareness > 0.05) fails.push(`by a guard: ${JSON.stringify(out.guard)} (want who ${guardId} ≥ 10, no row, the man unmoved)`);
    if (out.sam.evWho !== PLAYER_ID || out.sam.heardRows < 1 || out.sam.awareness < 0.1) fails.push(`by Sam: ${JSON.stringify(out.sam)} (want who ${PLAYER_ID}, a 'heard' row, his ears pricked)`);
    if (out.nobody.evWho !== NOBODY_ID || out.nobody.heardRows !== 0 || out.nobody.awareness < 0.1) fails.push(`by nobody: ${JSON.stringify(out.nobody)} (want who ${NOBODY_ID}, no row, his ears pricked)`);
    F.verdict(!fails.length, `the break-room mug knocked off beside calm Novak — by Reyes's round: lands who ${out.guard?.evWho}, ${out.guard?.heardRows} debrief rows, Novak ${out.guard?.state} ${f2(out.guard?.awareness ?? 0)}; by Sam's: who ${out.sam?.evWho}, ${out.sam?.heardRows} row, Novak ${out.sam?.state} ${f2(out.sam?.awareness ?? 0)}; by nobody: who ${out.nobody?.evWho}, ${out.nobody?.heardRows} rows, Novak ${out.nobody?.state} ${f2(out.nobody?.awareness ?? 0)}`, fails.join('; ') || 'ok'); }
  { // (8) the three THUD sites: a man dropping (game.ts bodyThud), a kicked door (onDoorEvent 'kick'), a shoved bin hitting the wall (onPropEvent 'thud') each queue a thud
    const { W, game, P } = await stage(3908, 0.5, [30, 0, 22], 0);
    const t0 = D.DESTR_STATS.impThud;
    const gd = game.guards[1]; gd.hold = false; gd.pinned = true; place(gd, [17.9, 0, 18.5], 1); W.step(DT);
    (await import(`${ROOT}/src/game/combat.ts`)).killGuard(game, gd, [1, 0, 0], true, 'struck');
    let bodyT = -1; for (let f = 0; f < 180; f++) { W.step(DT); P.prepare(DT, true); if (bodyT < 0 && D.DESTR_STATS.impThud > t0) bodyT = f; }
    const t1 = D.DESTR_STATS.impThud;
    const door = game.doors.list.find((d: any) => !d.def.steel && d.def.locked) ?? game.doors.list[0]; game.doors.kickIn(door, game.player.char.pos, 1); W.step(DT); P.prepare(DT, true);
    const t2 = D.DESTR_STATS.impThud;
    const bin = game.props.props.find((p: any) => p.def.kind === 'bin') ?? game.props.props[0]; game.props.applyImpulse(bin, [bin.x, 0.3, bin.z], [40, 0, 0], 1, true); for (let f = 0; f < 30; f++) { W.step(DT); P.prepare(DT, true); }
    const t3 = D.DESTR_STATS.impThud;
    const fails: string[] = [];
    if (t1 - t0 < 1) fails.push('a struck man hitting the floor queued no thud'); if (t2 - t1 !== 1) fails.push(`a kicked door queued ${t2 - t1} thuds (want 1)`); if (t3 - t2 < 1) fails.push('a bin smacked into motion / the wall queued no thud');
    F.verdict(!fails.length, `Novak struck → his trunk meets the floor at frame ${bodyT}: ${t1 - t0} thud(s); the ${door?.def?.name} door kicked in: ${t2 - t1}; the bin shoved: ${t3 - t2} (dropped over the per-frame cap: ${D.DESTR_STATS.impThudDropped})`, fails.join('; ') || 'ok'); }
  return F.done();
}

export async function destructionFamily(): Promise<boolean> { let ok = true; for (const f of [destructionSheet, destructionCaps, destructionDust, destructionScreen, destructionHearing, destructionReset, destructionIdentity, destructionDeterminism, destructionBounds, destructionImpulses]) ok = (await f()) && ok; return ok; }
if (import.meta.main) { const which = process.argv[2] ?? 'all'; const map: Record<string, () => Promise<boolean>> = { sheet: destructionSheet, caps: destructionCaps, dust: destructionDust, screen: destructionScreen, hearing: destructionHearing, reset: destructionReset, identity: destructionIdentity, determinism: destructionDeterminism, bounds: destructionBounds, impulses: destructionImpulses }; if (which === 'all') await destructionFamily(); else await map[which]?.(); }
