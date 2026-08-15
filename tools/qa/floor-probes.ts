// The 'floors' probe (run through probes.ts: `bun run tools/qa/probes.ts floors [--verbose]`): the floor you walk on matters, and matters ALIKE to everything that
// listens — one material map (src/game/floor.ts) behind the mixer's sample choice, the guards' scoring of a 'step' event and the SOUND meter. PASS / FAIL each:
//   (1) the map itself: floorAt at named spots round the level against what level.ts lays there (corridor lino, cubicle carpet, lobby stone, the server room's
//       raised floor, break-room lino, asphalt on the lot, grass on the lawn strips …);
//   (2) hearing A/B: one calm man held on his mark with his back to Sam, Sam WALKING to and fro 2.3‥3.0 m behind him for a fixed window — staged once in a
//       CARPETED room (the cubicle farm's west aisle) and once in the CORRIDOR (lino, the reference), each with tune.floorMaterials on and off. Why to and fro and not
//       one pass: a walking step is 0.26 and a calm man sheds 0.1 awareness a second, so no single 3 s pass ending outside the 1.8 m at which he would simply see
//       Sam on turning round adds up to 'huh?' (0.3) even on lino — it takes ~3½ s of continuous treading inside three metres of him. The window is that plus a
//       second: on lino he JUST trips inside it; as carpet (0.6 ×: 0.156 a step, under the 0.12 hearing gate beyond two metres) not one step must count and he
//       must stay calm — strictly less heard, strictly lower peak — while with the materials off (every floor lino) the very same aisle trips him like the corridor;
//       and the corridor must come out identical to the last digit either way;
//   (3) crouch-walking straight up the same aisle to 2 m behind him: never suspicious, nothing heard (0.125 × 0.6 = 0.075 a step: under the gate at any range);
//   (4) the SOUND meter (player.noise) peaks lower for the carpet walk than the lino one, and what the mixer was handed agrees: every footstep of the carpet walk
//       tagged 'carpet' at 0.6 × the walk's level, every one in the corridor 'lino' at 1 ×, one per step event; plus a sprint across the lobby's stone against one
//       down the corridor (meter 1.1 vs 1.0, footsteps tagged 'stone').
import { standUp, ROOT } from './headless.ts';
import type { AudioCall } from './headless.ts';
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const { floorAt, FLOOR, FINISHES, BUILDING, GRASS_EDGE } = await import(`${ROOT}/src/game/floor.ts`);

type Vec3 = [number, number, number];
const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f2 = (x: number) => x.toFixed(2), f3 = (x: number) => x.toFixed(3);

/** Every guard but [0] out of it: parked on the lot east of the building, held, deaf-and-blind. Returns [0]. */
function parkOthers(game: any): any {
  for (const o of game.guards.slice(1)) { o.hold = true; o.pinned = true; o.dazzledUntil = 1e9; o.heardUpTo = 1e12; o.char.pos = [37.5, 0, 6 + game.guards.indexOf(o)]; o.char.update(0); }
  return game.guards[0];
}
function placeGuard(gd: any, p: Vec3, yaw: number) { gd.char.pos = v3.copy(p); gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.char.bodyYaw = gd.char.aimYaw = yaw; gd.char.aimPitch = 0; gd.path = []; gd.pathGoal = null; gd.char.update(0); gd.char.update(DT); }

/** the stagings of (2)–(4): a man planted at `at` facing `yaw` (Character convention: forward = [sin, 0, cos]) with a clear straight lane of open floor behind him */
const VENUES = {
  carpet: { label: 'cubicle farm, west aisle (carpet)', at: [13.25, 0, 13.0] as Vec3, yaw: Math.PI, want: 'carpet' },          // facing the corridor partition a stride off it; the aisle runs south behind him between the printer and the red cluster's end panel to the lobby opening (x 13.25: the nav grid's free column there)
  lino:   { label: 'corridor, west half (lino — the reference)', at: [8.0, 0, 11.1] as Vec3, yaw: -Math.PI / 2, want: 'lino' },  // facing the west end wall; fourteen metres of empty corridor behind him
  stone:  { label: 'lobby, down the middle (stone)', at: [8.75, 0, 16.4] as Vec3, yaw: Math.PI, want: 'stone' },               // (the sprint of (4) only) facing the reception counter; open stone behind him between the couch and the plant pot to the south glazing
};
/** (2): Sam treads to and fro between these distances behind the man for PACE_SECS — NEAR outside both the 1.8 m at which a guard clocks anyone in his cone
 *  regardless of light (he turns round on a 'huh?') and the two metres inside which even a carpet step passes the gate; the window = lino's ~3½ s to trip + margin */
const PACE_NEAR = 2.3, PACE_FAR = 3.3, PACE_SECS = 5;
/** the player's pace eases in at damp rate 6 (player.ts speedSm): ground covered in `secs` from a standing start at top speed `v` */
const covered = (v: number, secs: number) => v * (secs - (1 - Math.exp(-6 * secs)) / 6);

type Pattern = { kind: 'approach'; endD: number; secs: number } | { kind: 'pace'; nearD: number; farD: number; secs: number };
interface WalkResult { ok: boolean; why: string; steps: number; heardSmall: number; peakAw: number; suspiciousAt: number; peakNoise: number; minD: number; maxD: number; footsteps: AudioCall[]; levels: number[]; trace: string[]; }
/** Stand the game up, plant guard [0] at the venue (calm, held on his mark, the others parked deaf on the lot), put Sam straight behind him in the dark and either
 *  walk / crouch-walk / sprint him straight at the man's back to `endD` ('approach': from endD + what the gait covers in `secs` from a standing start), or walk him
 *  to and fro between nearD and farD behind the man for `secs` ('pace', starting at farD). Sam aims square across the lane throughout, so neither leg is a
 *  back-pedal (the cycle would run backwards on every other leg and its half-cycle crossings — the steps — bunch and thin out). Records what the man made of it
 *  (his 'small noise' count = the steps that passed the hearing gate, peak awareness, when he left 'patrol'), the SOUND meter's peak, what the mixer was handed
 *  for Sam's feet (headless.ts audioLog: level + material per footstep) — and checks the staging is what the probe thinks: Sam on his marks, the lane straight (he
 *  never strays off the line: nothing shoved him aside), no door or furniture noise of his making in the window, the venue's material under the whole lane, and
 *  the man never SAW him before he went suspicious. */
async function walkBehind(o: { seed: number; venue: keyof typeof VENUES; materials: boolean; gait: 'walk' | 'crouch' | 'sprint'; pattern: Pattern }): Promise<WalkResult> {
  Math.random = seeded(o.seed);
  const W = await standUp(); const { game, input } = W; const V = VENUES[o.venue]; const P = o.pattern;
  game.godMode = true; game.aiEnabled = true; game.tune.floorMaterials = o.materials;
  for (let i = 0; i < 10; i++) W.step(DT);
  const gd = parkOthers(game);
  gd.hold = true; placeGuard(gd, V.at, V.yaw); gd.state = 'patrol'; gd.awareness = 0; gd.reactT = 0; gd.lastKnown = null;
  const speed = o.gait === 'crouch' ? game.tune.playerCrouch : o.gait === 'sprint' ? game.tune.playerSprint : game.tune.playerWalk;
  const back: Vec3 = [-Math.sin(V.yaw), 0, -Math.cos(V.yaw)]; const behind = (d: number): Vec3 => v3.mad(V.at, back, d);
  const startD = P.kind === 'approach' ? P.endD + covered(speed, P.secs) : P.farD;   // (he reaches endD as the window ends — the puppet halts him a hand short of it)
  const laneNear = P.kind === 'approach' ? P.endD : P.nearD; const start = behind(startD), near = behind(laneNear);
  const aimPt: Vec3 = v3.add(v3.mad(behind((startD + laneNear) / 2), [back[2], 0, -back[0]], 8), [0, 1.2, 0]);   // square off the lane, chest height
  game.teleportPlayer(v3.copy(start)); game.player.crouch = o.gait === 'crouch'; game.player.holstered = true; game.player.pistol.lightOn = false; game.player.visibility = 0;
  W.step(DT); game.player.visibility = 0;
  const fails: string[] = [];
  const p0 = v3.copy(game.player.char.pos); if (v3.distXZ(p0, start) > 0.12) fails.push(`teleport landed ${f2(v3.distXZ(p0, start))} m off the start mark (something stands there / no nav cell)`);
  if (game.col.segmentBlocked([start[0], 1.0, start[2]], [V.at[0], 1.5, V.at[2]])) fails.push('no straight line of sound from the far mark to his ear');
  for (let k = 0; k <= 10; k++) { const q = v3.lerp(start, near, k / 10); const m = floorAt(q); if (m !== V.want) { fails.push(`lane is ${m} at (${f2(q[0])}, ${f2(q[2])}), not ${V.want}`); break; } }
  if (floorAt(V.at) !== V.want) fails.push(`the man stands on ${floorAt(V.at)}, not ${V.want}`);
  gd.heardUpTo = 1e12; W.step(DT); gd.heardUpTo = game.eventSeq; gd.awareness = 0; gd.witness.peakAwareness = 0; gd.witness.heard.small = 0;   // deaf to the staging (the teleport's settle), ears open from here
  let goal = v3.copy(near); game.puppet = { goal, aim: aimPt, crouch: o.gait === 'crouch' };
  if (o.gait === 'sprint') input.keys.add('ShiftLeft');
  const log: AudioCall[] = []; W.audioLog = log;
  let steps = 0, peakAw = 0, suspiciousAt = -1, seenBefore = false, peakNoise = 0, minD = 99, maxD = 0, stray = 0, otherNoise = ''; const levels: number[] = []; const trace: string[] = []; let lastHeard = 0;
  for (let f = 0; f < Math.round(P.secs / DT); f++) {
    if (P.kind === 'pace' && v3.distXZ(game.player.char.pos, goal) < 0.12) { goal = v3.distXZ(goal, near) < 0.01 ? behind(P.farD) : v3.copy(near); game.puppet.goal = goal; }   // (the puppet stops him 10 cm short of a goal: turn him about just before, so he never stops treading)
    W.step(DT);
    game.player.visibility = 0;   // dark throughout (the headless meter never answers; belt and braces)
    for (const e of game.events) { if ((e as any).__seen) continue; (e as any).__seen = true; if (e.kind === 'step') { steps++; levels.push(e.level ?? -1); } else if ((e.who ?? -1) < 10) otherNoise ||= `${e.kind} (level ${f2(e.level ?? 0)}) at ${f2(game.time)} s`; }
    peakAw = Math.max(peakAw, gd.awareness); peakNoise = Math.max(peakNoise, game.player.noise);
    const pp = game.player.char.pos; const d = v3.distXZ(pp, gd.char.pos); minD = Math.min(minD, d); maxD = Math.max(maxD, d);
    stray = Math.max(stray, distToLine(pp, start, near));
    if (suspiciousAt < 0 && gd.sawPlayerThisFrame) seenBefore = true;
    if (suspiciousAt < 0 && gd.state !== 'patrol') suspiciousAt = game.time;
    if (f % 30 === 29 || gd.witness.heard.small !== lastHeard) { lastHeard = gd.witness.heard.small; trace.push(`      ${((f + 1) * DT).toFixed(2)}s  d ${f2(d)} m  steps ${steps}  heard ${gd.witness.heard.small}  aw ${f3(gd.awareness)}  ${gd.state}  meter ${f3(game.player.noise)}`); }
  }
  game.puppet = null; input.keys.delete('ShiftLeft'); W.audioLog = null;
  const footsteps = log.filter(c => c.name === 'footstep' && c.opts?.isPlayer);
  if (seenBefore) fails.push('he SAW Sam while still calm (the staging leaked into his eyes: hearing A/B void)');
  if (stray > 0.2) fails.push(`Sam strayed ${f2(stray)} m off the lane (something shoved him aside)`);
  if (otherNoise) fails.push(`a noise of Sam's that was not a step: ${otherNoise}`);
  if (P.kind === 'approach' && Math.abs(minD - P.endD) > 0.25) fails.push(`Sam got to ${f2(minD)} m, not ${P.endD}`);
  if (P.kind === 'pace' && (minD < P.nearD - 0.2 || minD > P.nearD + 0.25)) fails.push(`Sam's nearest was ${f2(minD)} m, not ${P.nearD}`);
  if (steps < 3) fails.push(`only ${steps} step events in ${P.secs} s (Sam never got going?)`);
  return { ok: fails.length === 0, why: fails.join('; '), steps, heardSmall: gd.witness.heard.small, peakAw, suspiciousAt, peakNoise, minD, maxD, footsteps, levels, trace };
}
function distToLine(p: Vec3, a: Vec3, b: Vec3): number {   // to the infinite line through a and b (XZ)
  const dx = b[0] - a[0], dz = b[2] - a[2]; const L = Math.hypot(dx, dz); if (L < 1e-9) return v3.distXZ(p, a);
  return Math.abs((p[0] - a[0]) * dz - (p[2] - a[2]) * dx) / L;
}
const line = (r: WalkResult) => `steps ${r.steps}, heard ${r.heardSmall}, peak awareness ${f3(r.peakAw)}, ${r.suspiciousAt >= 0 ? `SUSPICIOUS at ${f2(r.suspiciousAt)} s` : 'stayed on patrol'}, meter peak ${f3(r.peakNoise)}, ${f2(r.minD)}‥${f2(r.maxD)} m off him${r.ok ? '' : `  ✗ STAGING: ${r.why}`}`;

export async function floors(verbose = process.argv.includes('--verbose')) {
  console.log('\n=== floors: one material map for the mixer, the guards\' ears and the SOUND meter (src/game/floor.ts) ===');
  let allPass = true; const verdict = (ok: boolean, label: string, detail: string) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };

  // ---- (1) the map
  {
    console.log(`  map: outside the walls (x ${BUILDING.x0}‥${BUILDING.x1}, z ${BUILDING.z0}‥${BUILDING.z1}) grass where x or z < ${GRASS_EDGE}, else asphalt; inside, carpet unless:`);
    for (const f of FINISHES) console.log(`       ${f.mat.padEnd(6)} x ${String(f.x0).padStart(2)}‥${f.x1}  z ${String(f.z0).padStart(4)}‥${f.z1}   ${f.room}`);
    console.log('  materials: ' + Object.entries(FLOOR).map(([k, v]: [string, any]) => `${k} ×${v.loud} ${v.hard ? 'hard' : 'soft'} rate ×${v.rate}`).join(' · '));
    const spots: { p: Vec3; want: string; where: string }[] = [
      { p: [20.0, 0, 11.1], want: 'lino', where: 'corridor centre, on the runner' }, { p: [5.2, 0, 11.2], want: 'lino', where: 'corridor west end (the lockdown post)' }, { p: [34.5, 0, 10.4], want: 'lino', where: 'corridor by the storage door' },
      { p: [16.5, 0, 14.4], want: 'carpet', where: 'a cubicle cell (red cluster, north-west desk)' }, { p: [17.0, 0, 15.5], want: 'carpet', where: 'the blue rug in the cubicle farm' }, { p: [19.9, 0, 18.0], want: 'carpet', where: 'cubicle middle aisle, on its runner' },
      { p: [5.1, 0, 15.2], want: 'carpet', where: 'the spawn: reception end of the lobby' }, { p: [6.5, 0, 20.0], want: 'stone', where: 'lobby by the couch' }, { p: [10.5, 0, 22.5], want: 'stone', where: 'lobby south-east' },
      { p: [9.0, 0, 9.3], want: 'carpet', where: 'conference room, south lane' }, { p: [26.0, 0, 8.6], want: 'carpet', where: "manager's office" }, { p: [33.0, 0, 7.5], want: 'carpet', where: 'storage aisle (no finish over the base: carpet)' },
      { p: [18.0, 0, 8.5], want: 'tile', where: 'server room front aisle (raised floor)' }, { p: [31.5, 0, 16.5], want: 'lino', where: 'break room, north of the table (level.ts lays lino here, not tile)' }, { p: [34.5, 0, 21.0], want: 'lino', where: 'break room by the outside door' },
      { p: [20.0, 0, 26.0], want: 'asphalt', where: 'the car park' }, { p: [37.5, 0, 12.0], want: 'asphalt', where: 'east yard by the dumpster' }, { p: [3.6, 0, 20.0], want: 'asphalt', where: 'walkway outside the lobby glazing' }, { p: [36.6, 0, 20.6], want: 'asphalt', where: 'just outside the fire exit (the exfil strip)' },
      { p: [20.0, 0, 2.0], want: 'grass', where: 'north lawn' }, { p: [1.5, 0, 15.0], want: 'grass', where: 'west lawn by the fence' },
    ];
    const wrong = spots.filter(s => floorAt(s.p) !== s.want);
    verdict(wrong.length === 0, `(1) the map at ${spots.length} named spots`, wrong.length ? wrong.map(s => `${s.where} (${s.p[0]}, ${s.p[2]}): ${floorAt(s.p)}, want ${s.want}`).join('; ') : spots.map(s => `${s.where} → ${floorAt(s.p)}`).join(' · '));
  }

  // ---- (2) hearing A/B: the same to-and-fro walk close behind a calm man, carpet vs corridor, materials on vs off
  const R: Record<string, WalkResult> = {};
  console.log(`  (2) Sam walks to and fro ${PACE_NEAR}‥${PACE_FAR} m behind a calm man for ${PACE_SECS} s:`);
  for (const venue of ['carpet', 'lino'] as const) for (const materials of [true, false]) {
    const r = await walkBehind({ seed: 611, venue, materials, gait: 'walk', pattern: { kind: 'pace', nearD: PACE_NEAR, farD: PACE_FAR, secs: PACE_SECS } }); R[`${venue}-${materials ? 'on' : 'off'}`] = r;
    console.log(`    ${VENUES[venue].label}, materials ${materials ? 'ON ' : 'OFF'}: ${line(r)}`);
    if (verbose) console.log(r.trace.join('\n'));
  }
  {
    const cOn = R['carpet-on'], cOff = R['carpet-off'], lOn = R['lino-on'], lOff = R['lino-off'];
    const staged = cOn.ok && cOff.ok && lOn.ok && lOff.ok;
    verdict(staged && cOff.suspiciousAt >= 0 && cOn.suspiciousAt < 0 && cOn.heardSmall < cOff.heardSmall && cOn.peakAw < cOff.peakAw - 1e-6,
      '(2a) carpet: the walk that trips him as lino leaves him calm as carpet',
      `materials OFF (the aisle as lino): heard ${cOff.heardSmall} of ${cOff.steps} steps, peak awareness ${f3(cOff.peakAw)}, ${cOff.suspiciousAt >= 0 ? `'huh?' at ${f2(cOff.suspiciousAt)} s` : 'NEVER suspicious (retune PACE_*: lino must just trip)'}; ON (carpet, ×${FLOOR.carpet.loud} → ${f3(0.26 * FLOOR.carpet.loud)} a step): heard ${cOn.heardSmall} of ${cOn.steps}, peak ${f3(cOn.peakAw)}, ${cOn.suspiciousAt >= 0 ? `SUSPICIOUS at ${f2(cOn.suspiciousAt)} s` : 'stayed calm'} — want strictly fewer heard, lower peak, no 'huh?'${staged ? '' : ' — STAGING FAILED (above)'}`);
    const same = lOn.heardSmall === lOff.heardSmall && Math.abs(lOn.peakAw - lOff.peakAw) < 1e-6 && Math.abs(lOn.suspiciousAt - lOff.suspiciousAt) < 1e-6 && lOn.steps === lOff.steps && Math.abs(lOn.peakNoise - lOff.peakNoise) < 1e-9;
    verdict(staged && same && lOn.suspiciousAt >= 0, '(2b) corridor: lino is the reference — identical on and off, and it does trip him',
      `ON: heard ${lOn.heardSmall}/${lOn.steps}, peak ${f3(lOn.peakAw)}, 'huh?' at ${lOn.suspiciousAt >= 0 ? f2(lOn.suspiciousAt) + ' s' : 'never'}; OFF: heard ${lOff.heardSmall}/${lOff.steps}, peak ${f3(lOff.peakAw)}, 'huh?' at ${lOff.suspiciousAt >= 0 ? f2(lOff.suspiciousAt) + ' s' : 'never'} — want the same to the last digit, and the 'huh?' inside the ${PACE_SECS} s`);
  }

  // ---- (3) crouched on carpet, straight up the aisle to 2 m behind him: nothing
  {
    const r = await walkBehind({ seed: 612, venue: 'carpet', materials: true, gait: 'crouch', pattern: { kind: 'approach', endD: 2.0, secs: 3 } });
    const rOff = await walkBehind({ seed: 612, venue: 'carpet', materials: false, gait: 'crouch', pattern: { kind: 'approach', endD: 2.0, secs: 3 } });
    if (verbose) console.log(r.trace.join('\n'));
    verdict(r.ok && r.suspiciousAt < 0 && r.heardSmall === 0 && r.peakAw < 0.05, '(3) crouch-walking 3 s up to 2 m behind him on carpet: never suspicious',
      `${line(r)}; per-step level ${r.levels.length ? f3(Math.max(...r.levels)) : '—'} (0.125 × ${FLOOR.carpet.loud}; the gate is 0.12 before the distance falloff — under it at any range) · for the record the same crouch with the aisle as lino: heard ${rOff.heardSmall}, peak ${f3(rOff.peakAw)}, ${rOff.suspiciousAt >= 0 ? 'suspicious' : "calm too (a crouched step on lino only carries a hand's width)"}`);
  }

  // ---- (4) the meter and the mixer
  {
    const cOn = R['carpet-on'], lOn = R['lino-on'];
    const matsC = new Set(cOn.footsteps.map(c => String(c.opts?.mat))), matsL = new Set(lOn.footsteps.map(c => String(c.opts?.mat)));
    const gainC = cOn.footsteps.length ? Math.max(...cOn.footsteps.map(c => c.gain)) : -1, gainL = lOn.footsteps.length ? Math.max(...lOn.footsteps.map(c => c.gain)) : -1;
    const meterOk = cOn.peakNoise < lOn.peakNoise - 0.05 && Math.abs(cOn.peakNoise - 0.26 * FLOOR.carpet.loud) < 0.01 && Math.abs(lOn.peakNoise - 0.26) < 0.01;
    const mixerOk = matsC.size === 1 && matsC.has('carpet') && matsL.size === 1 && matsL.has('lino') && Math.abs(gainC - 0.26 * FLOOR.carpet.loud) < 1e-6 && Math.abs(gainL - 0.26) < 1e-6 && cOn.footsteps.length === cOn.steps && lOn.footsteps.length === lOn.steps;
    verdict(cOn.ok && lOn.ok && meterOk && mixerOk, '(4a) the SOUND meter and the mixer follow the same number as the ears',
      `meter peak: carpet ${f3(cOn.peakNoise)} (want ${f3(0.26 * FLOOR.carpet.loud)}) < corridor ${f3(lOn.peakNoise)} (want 0.260); mixer: the carpet walk's ${cOn.footsteps.length} footsteps tagged {${[...matsC].join(',')}} at ≤ ${f3(gainC)}, the corridor's ${lOn.footsteps.length} tagged {${[...matsL].join(',')}} at ≤ ${f3(gainL)} (one per step event: ${cOn.steps} / ${lOn.steps})`);
    const sS = await walkBehind({ seed: 613, venue: 'stone', materials: true, gait: 'sprint', pattern: { kind: 'approach', endD: 2.4, secs: 1.0 } });
    const sL = await walkBehind({ seed: 613, venue: 'lino', materials: true, gait: 'sprint', pattern: { kind: 'approach', endD: 2.4, secs: 1.0 } });
    if (verbose) console.log(sS.trace.join('\n') + '\n      —\n' + sL.trace.join('\n'));
    const matsS = new Set(sS.footsteps.map(c => String(c.opts?.mat)));
    const stagedS = sS.ok && sL.ok;
    verdict(stagedS && Math.abs(sS.peakNoise - FLOOR.stone.loud) < 0.01 && Math.abs(sL.peakNoise - 1.0) < 0.01 && sS.peakNoise > sL.peakNoise && matsS.size === 1 && matsS.has('stone') && sS.peakAw >= sL.peakAw,
      '(4b) a sprint across the lobby stone is louder than one down the corridor',
      `stone: meter peak ${f3(sS.peakNoise)} (want ${FLOOR.stone.loud}), footsteps tagged {${[...matsS].join(',')}}, the man ${sS.suspiciousAt >= 0 ? `startled at ${f2(sS.suspiciousAt)} s` : 'calm'} (peak awareness ${f3(sS.peakAw)}); corridor: peak ${f3(sL.peakNoise)} (want 1.000), ${sL.suspiciousAt >= 0 ? `startled at ${f2(sL.suspiciousAt)} s` : 'calm'} (peak ${f3(sL.peakAw)})${stagedS ? '' : `  ✗ STAGING: ${[sS.why, sL.why].filter(Boolean).join(' / ')}`}`);
  }
  console.log(`=== floors: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}
