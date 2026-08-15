// The 'tracers' probe family (rifles, docs/internal/sc20k-design.md §3.3 / §11.5 — lane R6), run through probes.ts:
//   bun run tools/qa/probes.ts tracers | tracer-rule | tracer-kinematics | tracer-lights | tracer-flag | tracer-pool [--verbose]
// Headless = no GPU: nothing here can see a streak. What is asserted is the game-side machinery the picture is made from (src/game/tracers.ts): which rounds
// trace, where the head is each frame, the box that is pushed for it, the light that rides it, what the flag and the pool guarantee. PASS / FAIL each:
//   (rule)       a thirty-round AKS-74U box, round by round off the gun's own counters: tracers on exactly 3 6 9 12 15 18 21 24 27 28 29 30 and nowhere else, a
//                fresh box starts the count again; the same twelve-a-box off the REAL alert branch (Reyes bursting at a lit god-mode Sam for 40 s, every round
//                matched to the frame's tracer spawn); Sam's Five-seveN and a guard's 9 mm, twenty rounds each: none;
//   (kinematics) a streak's head advances speed·dt a frame along muzzle → impact, never past the impact, is drawn AT it once and is gone the frame after; the
//                streak is min(speed·shutter, distance flown) long and lies on the segment behind the head; a 3 m shot is slowed to show ≥ 2 frames; a round
//                shorter than minPath shows nothing; the ember (sparks + a 60 ms glow) fires on arrival iff the round stopped in geometry — not in a man, not on a
//                miss; a real carbine round's streak spans exactly the segment its guardShot event reports;
//   (lights)     while a streak lives exactly one transient ('tracer') light per streak sits 5 cm behind its head in the row's colour at tracerFx intensity, none
//                after it; the muzzle flash of the round is in the set the frame it fires (not evicted); three riflemen dumping boxes together never push the
//                LightSet past its 64 or drop an enabled light at upload, and never more than tracerFx.maxLights heads are lit;
//   (flag)       tune.tracers off: zero streaks, zero tracer lights, and 20 s of the same seeded fight produces the identical rounds (frames, segments), hearing
//                events, audio calls, flash cards and flashes as with it on — the tracer objects and their ember glows being the whole difference;
//   (pool)       200 forced streaks in 50 frames: never more than maxLive alive nor maxLights lit, the pool never grows, and once they are flown the LightSet,
//                game.fx and the spark pool are back where they started.
import { standUp, ROOT } from './headless.ts';
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const { fireWeapon } = await import(`${ROOT}/src/game/combat.ts`);
const { resetChase } = await import(`${ROOT}/src/game/guards.ts`);
const { WEAPONS } = await import(`${ROOT}/src/game/weapons.ts`);
const { isTracerRound } = await import(`${ROOT}/src/game/tracers.ts`);
const { tracerFx } = await import(`${ROOT}/src/game/effects.ts`);
const { MAX_LIGHTS } = await import(`${ROOT}/src/render/lights.ts`);
const { BoxFlag } = await import(`${ROOT}/src/scene/boxes.ts`);

type Vec3 = [number, number, number];
const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f2 = (x: number) => x.toFixed(2), f3 = (x: number) => x.toFixed(3);
/** A guard planted at `p` facing yaw, still, no path, posed twice (bones where the muzzle reads them). */
function place(gd: any, p: Vec3, yaw: number) { gd.char.pos = v3.copy(p); gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.char.bodyYaw = gd.char.aimYaw = yaw; gd.char.aimPitch = 0; gd.path = []; gd.pathGoal = null; gd.char.update(0); gd.char.update(DT); }
/** parked out on the lot east of the building, held and pinned, facing east, deaf and blind */
function park(gd: any, i: number) { gd.hold = true; gd.pinned = true; place(gd, [37.5, 0, 6 + i * 1.5], Math.PI / 2); gd.heardUpTo = 1e12; gd.dazzledUntil = 1e9; }
/** alert, licensed (a sighting this frame), planted where he is, the gun coming round in `fireCd` */
function armAlert(gd: any, game: any, fireCd = 0.3) { gd.hold = false; gd.pinned = true; gd.dazzledUntil = -1; gd.heardUpTo = 1e12; gd.state = 'alert'; gd.awareness = 1; gd.reactT = 0; gd.fireCd = fireCd; gd.reloadT = -1; gd.lastKnown = v3.copy(game.player.char.pos); gd.lastSeenT = game.time; resetChase(gd); }
const REYES_AT: Vec3 = [17.5, 0, 11.3];   // in the corridor by the server-room door, facing east down its length (the carbine-fire family's spot)
const RULE_30 = [3, 6, 9, 12, 15, 18, 21, 24, 27, 28, 29, 30];   // the documented tracer ordinals of a thirty-round { every 3, lastN 3 } box

/** Reyes dealt the carbine, planted in the corridor facing east and HELD (the AI leaves him be), the other two parked; Sam out of the way in god mode. Rounds are
 *  driven by hand: reyes.weapon.fire() then fireWeapon — exactly the order every fire site uses. */
async function stageHeld(seed: number, flag = true) {
  Math.random = seeded(seed);
  const W = await standUp(); const { game } = W;
  game.godMode = true; game.aiEnabled = true; game.tune.carbineGuards = 'reyes'; game.tune.tracers = flag;
  for (let i = 0; i < 5; i++) W.step(DT);
  const reyes = game.guards.find((g: any) => g.callsign === 'Reyes'); const others = game.guards.filter((g: any) => g !== reyes);
  others.forEach((gd: any, i: number) => park(gd, i));
  game.teleportPlayer([30, 0, 20]); game.player.visibility = 0;
  reyes.hold = true; reyes.pinned = true; reyes.heardUpTo = 1e12; reyes.dazzledUntil = 1e9; place(reyes, REYES_AT, Math.PI / 2);
  W.step(DT); W.step(DT);
  return { W, game, engine: W.engine, reyes, others };
}
/** Reyes with the carbine ALERT on a lit god-mode Sam standing `range` m east of him (the carbine-fire family's staging): the real burst loop fires. */
async function stageAlert(seed: number, range: number, flag = true) {
  Math.random = seeded(seed);
  const W = await standUp(); const { game } = W; const pl = game.player;
  game.godMode = true; game.aiEnabled = true; game.tune.carbineGuards = 'reyes'; game.tune.tracers = flag;
  for (let i = 0; i < 5; i++) W.step(DT);
  const reyes = game.guards.find((g: any) => g.callsign === 'Reyes'); const others = game.guards.filter((g: any) => g !== reyes);
  others.forEach((gd: any, i: number) => park(gd, i));
  game.teleportPlayer([REYES_AT[0] + range, 0, 11.4]); pl.slot = 'pistol'; pl.holstered = false; pl.crouch = false; pl.pistol.lightOn = false;
  place(reyes, REYES_AT, Math.PI / 2); W.step(DT); pl.visibility = 0.9;
  armAlert(reyes, game, 0.3);
  return { W, game, engine: W.engine, reyes, others };
}
const tracerLights = (engine: any) => engine.lights.lights.filter((l: any) => l.group === 'tracer');
const liveList = (game: any) => [...game.tracers.each()];

export async function tracerRule(verbose = process.argv.includes('--verbose')) {
  console.log('\n=== tracer-rule: which rounds trace — the AKS-74U\'s every third and the last three of its thirty, off the gun\'s own counters and off the real burst loop; the pistols never ===');
  let allPass = true; const verdict = (ok: boolean, label: string, detail: string) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  // ---- a box by hand, round by round; then a fresh box
  {
    const { W, game, reyes } = await stageHeld(6101); const w = reyes.weapon; const fails: string[] = [];
    if (w.def.id !== 'aks74u' || w.roundsReady !== 30) fails.push(`staging: Reyes carries ${w.def.id} with ${w.roundsReady} ready`);
    const target = (): Vec3 => v3.add(reyes.char.muzzle, [8, 0, 0]);
    const got: number[] = [], ruleSaid: number[] = [];
    for (let r = 1; r <= 30; r++) {
      if (!w.fire()) { fails.push(`the box went dry at round ${r}`); break; }
      if (isTracerRound(w)) ruleSaid.push(r);
      const was = game.tracers.spawned; fireWeapon(game, reyes.char, target(), false, { spread: 0, steady: true });
      if (game.tracers.spawned > was) got.push(r);
      for (let f = 0; f < 6; f++) W.step(DT);   // 600 rpm: a round every 6th frame
    }
    if (JSON.stringify(got) !== JSON.stringify(RULE_30)) fails.push(`tracers went on rounds [${got.join(',')}], want [${RULE_30.join(',')}]`);
    if (JSON.stringify(ruleSaid) !== JSON.stringify(got)) fails.push(`isTracerRound said [${ruleSaid.join(',')}] but streaks went on [${got.join(',')}]`);
    if (w.fire()) fails.push('a 31st round came out of a thirty-round box');
    // a fresh box (the reload beat's rearm): the count starts again — 1, 2 plain, 3 lit
    w.rearm(); const fresh: number[] = [];
    for (let r = 1; r <= 4; r++) { w.fire(); const was = game.tracers.spawned; fireWeapon(game, reyes.char, target(), false, { spread: 0, steady: true }); if (game.tracers.spawned > was) fresh.push(r); for (let f = 0; f < 6; f++) W.step(DT); }
    if (JSON.stringify(fresh) !== JSON.stringify([3])) fails.push(`after a fresh box the first four rounds traced on [${fresh.join(',')}], want [3]`);
    verdict(fails.length === 0, '(a1) a thirty-round box by hand (fire() then fireWeapon, as every fire site does): streaks on exactly rounds 3 6 9 12 15 18 21 24 27 28 29 30 — twelve, the rule and the spawns agreeing round by round — no 31st, and a fresh box counts from one again (3rd lit)',
      (fails.length ? fails.join('; ') + ' · ' : '') + `traced [${got.join(' ')}] · fresh box [${fresh.join(' ')}] · ${game.tracers.spawned} streaks all told`);
  }
  // ---- the real alert branch: 40 s of bursts at 8 m, every round matched to the frame's spawn
  {
    const S = await stageAlert(6102, 8); const { W, game, reyes } = S; const fails: string[] = [];
    const seen = new Set<any>(); let k = 0, boxes = 0; const litK: number[] = [], allK: number[] = []; let mismatches = 0; const perBox = new Map<number, number[]>();
    let wasRel = false; let twoInFrame = 0;
    for (let f = 0; f < 60 * 40; f++) {
      game.player.visibility = 0.9; game.player.hitFlash = 0;
      const was = game.tracers.spawned;
      W.step(DT);
      const rounds = game.events.filter((e: any) => !seen.has(e) && e.kind === 'guardShot' && e.time === game.time); for (const e of game.events) seen.add(e);
      const spawned = game.tracers.spawned - was;
      if (rounds.length > 1) twoInFrame++;
      for (const _ of rounds) {
        k++; allK.push(k);
        const want = RULE_30.includes(k); const gotT = spawned >= 1;   // (one shooter, ≤ 1 round a frame: the frame's spawn is this round's)
        if (gotT) { litK.push(k); const arr = perBox.get(boxes) ?? []; arr.push(k); perBox.set(boxes, arr); }
        if (want !== gotT) { mismatches++; if (mismatches <= 6) fails.push(`box ${boxes + 1} round ${k} at f${f + 1}: tracer ${gotT}, rule says ${want}`); }
      }
      if (!rounds.length && spawned) fails.push(`a streak spawned at f${f + 1} with no round fired`);
      const rel = reyes.reloadT >= 0; if (rel && !wasRel) { boxes++; k = 0; } wasRel = rel;   // the beat starts the frame the box empties (after that round is counted): the next round is round 1 of a fresh box
    }
    if (allK.length < 40) fails.push(`only ${allK.length} rounds in 40 s (staging)`);
    if (twoInFrame) fails.push(`${twoInFrame} frames with two rounds (the per-frame matching assumes one)`);
    const fullBoxes = [...perBox.entries()].filter(([b]) => b < boxes);   // boxes that ran to the reload
    for (const [b, ks] of fullBoxes) if (JSON.stringify(ks) !== JSON.stringify(RULE_30)) fails.push(`box ${b + 1} traced on [${ks.join(',')}]`);
    verdict(fails.length === 0, '(a2) the real burst loop (Reyes alert at 8 m, 40 s): every round\'s tracer-or-not matches the rule for its ordinal in the box, and every box that ran dry traced exactly the documented twelve',
      (fails.length ? fails.join('; ') + ' · ' : '') + `${allK.length} rounds, ${boxes} reload(s), ${litK.length} tracers; per box: ${[...perBox.entries()].map(([b, ks]) => `#${b + 1} [${ks.join(' ')}]`).join(' · ')}`);
  }
  // ---- pistols: Sam's Five-seveN and a guard's 9 mm, twenty rounds each
  {
    const { W, game, reyes, others } = await stageHeld(6103); const fails: string[] = [];
    game.tune.carbineGuards = 'none'; W.step(DT); W.step(DT);   // Reyes back on the sidearm row
    if (reyes.weapon.def.id !== 'guard9mm') fails.push(`Reyes carries ${reyes.weapon.def.id} under 'none'`);
    const pl = game.player; game.teleportPlayer([21.5, 0, 11.5]); pl.slot = 'pistol'; pl.holstered = false; for (let f = 0; f < 40; f++) W.step(DT);
    const was = game.tracers.spawned;
    for (let r = 0; r < 20; r++) { if (!pl.pistol.fire()) pl.pistol.rearm(); fireWeapon(game, pl.char, [21.5, 1.2, 10.0], true); W.step(DT); }
    const samSpawned = game.tracers.spawned - was;
    for (let r = 0; r < 20; r++) { if (!reyes.weapon.fire()) reyes.weapon.rearm(); fireWeapon(game, reyes.char, v3.add(reyes.char.muzzle, [8, 0, 0]), false, { spread: 0, steady: true }); W.step(DT); }
    const guardSpawned = game.tracers.spawned - was - samSpawned;
    // and a row handed in that the shooter does not carry (a harness poking fireWeapon with o.weapon): no counters, no tracer — never a throw
    let threw = ''; try { fireWeapon(game, others[0].char, v3.add(others[0].char.pos, [5, 1, 0]), false, { weapon: WEAPONS.aks74u, spread: 0, steady: true }); W.step(DT); } catch (e: any) { threw = String(e?.message ?? e); }
    const strangerSpawned = game.tracers.spawned - was - samSpawned - guardSpawned;
    if (samSpawned) fails.push(`Sam's Five-seveN traced ${samSpawned} of 20`);
    if (guardSpawned) fails.push(`the 9 mm traced ${guardSpawned} of 20`);
    if (threw) fails.push(`a carbine row fired off a pistol man threw: ${threw}`);
    if (strangerSpawned) fails.push(`a carbine row fired off a man who carries a pistol traced (${strangerSpawned})`);
    if (tracerLights(W.engine).length) fails.push(`${tracerLights(W.engine).length} tracer lights in the set after pistol rounds only`);
    verdict(fails.length === 0, '(a3) pistols never trace: twenty rounds of Sam\'s Five-seveN and twenty of a guard\'s 9 mm → zero streaks, zero tracer lights; a carbine row poked through fireWeapon off a man who does not carry it → nothing, and no throw',
      (fails.length ? fails.join('; ') + ' · ' : '') + `Sam ${samSpawned}, 9 mm ${guardSpawned}, stranger ${strangerSpawned}`);
  }
  if (verbose) console.log(`  aks74u.tracer ${JSON.stringify(WEAPONS.aks74u.tracer)} · fiveseven ${JSON.stringify(WEAPONS.fiveseven.tracer)} · guard9mm ${JSON.stringify(WEAPONS.guard9mm.tracer)}`);
  console.log(`=== tracer-rule: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}

/** per-frame record of one forced streak of length L flown to the end: head, streak length, box centre offset from the segment, light, sparks / flashes on arrival */
async function fly(S: Awaited<ReturnType<typeof stageHeld>>, L: number, impact: 'solid' | 'flesh' | 'none') {
  const { W, game, engine, reyes } = S; const T = game.tracers;
  const from: Vec3 = [18.0, 1.3, 11.3], dir: Vec3 = [1, 0, 0];
  game.sparks.clear(); for (let f = 0; f < 8; f++) W.step(DT);   // nothing else in flight
  const flashes0 = engine.lights.lights.filter((l: any) => l.name === 'flash').length; const sparks0 = game.sparks.live;
  const went = T.round(reyes.weapon, reyes.weapon.def, from, dir, L, impact, reyes.char.id, true);
  const t = liveList(game).find((x: any) => Math.abs(x.L - L) < 1e-9) ?? null;
  const v = t?.v ?? 0;
  const rec: { s: number; len: number; off: number; onSeg: boolean; arrived: boolean; light: Vec3 | null; lightColor: Vec3 | null; lightI: number; boxPushed: boolean; flags: number; owner: number }[] = [];
  let emberSparks = 0, emberFlash = 0, frames = 0;
  while (t && t.alive && frames < 200) {
    const sp0 = game.sparks.live, fl0 = engine.lights.lights.filter((l: any) => l.name === 'flash').length;
    W.step(DT); frames++;
    if (!t.alive) break;
    const b = t.box; const pushed = game.dynBoxes.includes(b);
    const head: Vec3 = [from[0] + dir[0] * t.s, from[1] + dir[1] * t.s, from[2] + dir[2] * t.s];
    const len = b.h[2] * 2; const centreWant: Vec3 = [head[0] - dir[0] * len / 2, head[1] - dir[1] * len / 2, head[2] - dir[2] * len / 2];
    const off = v3.dist(b.c, centreWant);
    rec.push({ s: t.s, len, off, onSeg: off < 1e-6, arrived: t.arrived, light: t.light ? v3.copy(t.light.pos) : null, lightColor: t.light ? v3.copy(t.light.color) : null, lightI: t.light ? t.light.intensity : 0, boxPushed: pushed, flags: b.flags, owner: b.owner });
    if (t.arrived) { emberSparks = game.sparks.live - sp0; emberFlash = engine.lights.lights.filter((l: any) => l.name === 'flash').length - fl0; }
  }
  const after = { live: T.live, tracerLights: tracerLights(engine).length, alive: !!t?.alive };
  W.step(DT);   // one more: the retired streak's slot must not draw
  const drawnAfter = t ? game.dynBoxes.includes(t.box) : false;
  void flashes0; void sparks0;
  return { went, t, v, rec, frames: rec.length, emberSparks, emberFlash, after, drawnAfter };
}

export async function tracerKinematics(verbose = process.argv.includes('--verbose')) {
  console.log('\n=== tracer-kinematics: the head\'s travel, the streak behind it, arrival, expiry, the ember — and a real round\'s streak on its event\'s segment ===');
  let allPass = true; const verdict = (ok: boolean, label: string, detail: string) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  const P = tracerFx;
  const S = await stageHeld(6201);
  // ---- lengths 20 / 8 / 3 / 0.6, solid: travel, streak, arrival, expiry, frames alive
  {
    const fails: string[] = []; const notes: string[] = [];
    for (const L of [20, 8, 3, 0.6]) {
      const R = await fly(S, L, 'solid');
      if (!R.went || !R.t) { fails.push(`L ${L}: no streak went`); continue; }
      const vWant = Math.min(P.speed, L / P.minLife); if (Math.abs(R.v - vWant) > 1e-6) fails.push(`L ${L}: head speed ${f2(R.v)}, want ${f2(vWant)}`);
      const framesWant = Math.ceil(L / (vWant * DT) - 1e-9);
      if (R.frames !== framesWant) fails.push(`L ${L}: drawn ${R.frames} frames, want ${framesWant}`);
      if (L >= 3 && R.frames < 2) fails.push(`L ${L}: only ${R.frames} frame(s) alive — a ${L} m shot must show ≥ 2`);
      let prev = 0;
      R.rec.forEach((r, i) => {
        const sWant = Math.min(L, (i + 1) * vWant * DT); if (Math.abs(r.s - sWant) > 1e-6) fails.push(`L ${L} f${i + 1}: head at ${f3(r.s)}, want ${f3(sWant)}`);
        if (r.s > L + 1e-9) fails.push(`L ${L} f${i + 1}: head ${f3(r.s)} past the impact ${L}`);
        if (r.s < prev - 1e-9) fails.push(`L ${L} f${i + 1}: head went backwards`); prev = r.s;
        const lenWant = Math.max(0.05, Math.min(vWant * P.shutter, r.s)); if (Math.abs(r.len - lenWant) > 1e-6) fails.push(`L ${L} f${i + 1}: streak ${f3(r.len)} m, want ${f3(lenWant)}`);
        if (!r.onSeg) fails.push(`L ${L} f${i + 1}: box centre ${f3(r.off)} m off the segment behind the head`);
        if (!r.boxPushed) fails.push(`L ${L} f${i + 1}: the streak's box was not among the frame's dynamic boxes`);
        if ((r.flags & (BoxFlag.NoShadow | BoxFlag.Dynamic)) !== (BoxFlag.NoShadow | BoxFlag.Dynamic)) fails.push(`L ${L}: box flags ${r.flags} (want NoShadow|Dynamic)`);
        if (r.owner !== (S.reyes.char.id & 0xff)) fails.push(`L ${L}: box owner ${r.owner}, want ${S.reyes.char.id & 0xff}`);
        const last = i === R.rec.length - 1; if (r.arrived !== last) fails.push(`L ${L} f${i + 1}: arrived ${r.arrived} (want it on the last drawn frame only)`);
      });
      if (R.after.alive || R.after.live !== 0) fails.push(`L ${L}: still alive after its last frame (live ${R.after.live})`);
      if (R.drawnAfter) fails.push(`L ${L}: the retired slot's box was drawn the frame after`);
      notes.push(`L ${L} m: v ${f2(R.v)} m/s, ${R.frames} f drawn, head ${R.rec.map(r => f2(r.s)).join('→')}, streak ${R.rec.map(r => f2(r.len)).join('/')} m`);
    }
    // under minPath: refused
    const short = S.game.tracers.round(S.reyes.weapon, S.reyes.weapon.def, [18, 1.3, 11.3], [1, 0, 0], P.minPath * 0.6, 'solid', S.reyes.char.id, true);
    if (short) fails.push(`a ${f2(P.minPath * 0.6)} m round (under minPath ${P.minPath}) still made a streak`);
    verdict(fails.length === 0, `(b1) forced streaks of 20 / 8 / 3 / 0.6 m: the head advances speed·dt a frame (speed ${P.speed}, or L/minLife for a short one), never passes the impact, is drawn there once and gone the frame after; the streak is min(speed·shutter, flown) long on the segment behind the head, NoShadow|Dynamic, owner = the shooter; ≥ 2 frames for the 3 m shot; under minPath nothing`,
      (fails.length ? fails.join('; ') + ' · ' : '') + notes.join(' · ') + ` · ${f2(P.minPath * 0.6)} m → ${short ? 'STREAK' : 'nothing'}`);
  }
  // ---- the ember: solid vs flesh vs none
  {
    const fails: string[] = []; const notes: string[] = [];
    for (const imp of ['solid', 'flesh', 'none'] as const) {
      const R = await fly(S, 8, imp);
      const wantSp = imp === 'solid' ? P.emberSparks : 0, wantFl = imp === 'solid' && P.emberIntensity > 0 ? 1 : 0;
      if (R.emberSparks !== wantSp) fails.push(`${imp}: ${R.emberSparks} sparks on arrival, want ${wantSp}`);
      if (R.emberFlash !== wantFl) fails.push(`${imp}: ${R.emberFlash} glow flash on arrival, want ${wantFl}`);
      notes.push(`${imp}: +${R.emberSparks} sparks, +${R.emberFlash} flash on the arrival frame`);
    }
    // the glow's numbers: colour = the row's, ttl 0.06, at the impact less 3 cm
    const R = await fly(S, 8, 'solid');
    const glow = S.engine.lights.lights.filter((l: any) => l.name === 'flash').at(-1);
    if (!glow) fails.push('no glow flash to inspect');
    else {
      const c = WEAPONS.aks74u.tracer!.color;
      if (Math.abs(glow.ttl - P.emberTtl) > 1e-9 || Math.abs(glow.peakIntensity - P.emberIntensity) > 1e-9 || Math.abs(glow.range - P.emberRange) > 1e-9) fails.push(`glow ttl ${glow.ttl} peak ${glow.peakIntensity} range ${glow.range}`);
      if (v3.dist(glow.color, c) > 1e-9) fails.push(`glow colour ${JSON.stringify(glow.color)}, want the row's ${JSON.stringify(c)}`);
      if (v3.dist(glow.pos, [18 + 8 - 0.03, 1.3, 11.3]) > 1e-6) fails.push(`glow at ${glow.pos.map(f3).join(',')}, want 3 cm short of the impact`);
      notes.push(`glow: I ${glow.peakIntensity} over ${glow.range} m for ${glow.ttl} s in [${glow.color.join(', ')}] at ${glow.pos.map(f2).join(', ')}`);
    }
    void R;
    verdict(fails.length === 0, '(b2) the ember fires on the arrival frame iff the round stopped in geometry: solid → tracerFx.emberSparks sparks + one glow flash (the row\'s colour, emberIntensity / emberRange / emberTtl, 3 cm off the surface); in a man or on a miss → nothing',
      (fails.length ? fails.join('; ') + ' · ' : '') + notes.join(' · '));
  }
  // ---- a REAL carbine round: the streak spans the event's segment; into Sam → flesh, no ember
  {
    const fails: string[] = []; const notes: string[] = [];
    const { W, game, reyes } = S; const w = reyes.weapon;
    w.rearm(); w.fire(); w.fire(); if (!w.fire()) fails.push('staging: third round would not cycle');   // round 3: a tracer
    const seen = new Set<any>(game.events);
    fireWeapon(game, reyes.char, v3.add(reyes.char.muzzle, [10, -0.2, 0.4]), false, { spread: 0, steady: true });
    const ev = game.events.find((e: any) => !seen.has(e) && e.kind === 'guardShot');
    const t = liveList(game).at(-1);
    if (!ev || !t) fails.push(`no event (${!!ev}) or no streak (${!!t}) for round 3`);
    else {
      const segL = v3.dist(ev.from, ev.to); const end: Vec3 = [t.from[0] + t.dir[0] * t.L, t.from[1] + t.dir[1] * t.L, t.from[2] + t.dir[2] * t.L];
      if (v3.dist(t.from, ev.from) > 1e-6) fails.push(`streak starts ${f3(v3.dist(t.from, ev.from))} m off the event's muzzle`);
      if (v3.dist(end, ev.to) > 1e-4) fails.push(`streak ends ${f3(v3.dist(end, ev.to))} m off the event's impact`);
      if (t.impact !== 'solid') fails.push(`impact '${t.impact}' for a round into the corridor (want solid)`);
      notes.push(`round 3: event segment ${f2(segL)} m, streak L ${f2(t.L)} m, impact ${t.impact}, v ${f2(t.v)}`);
      while (t.alive) W.step(DT);
    }
    // into Sam (god mode): flesh, and no ember on arrival
    game.teleportPlayer([23.5, 0, 11.3]); for (let f = 0; f < 30; f++) W.step(DT);
    w.rearm(); w.fire(); w.fire(); w.fire();
    const chest = game.player.char.bones.chest ?? v3.add(game.player.char.pos, [0, 1.2, 0]);
    game.player.hitFlash = 0; game.sparks.clear();
    fireWeapon(game, reyes.char, v3.copy(chest), false, { spread: 0, steady: true });
    const hit = game.player.hitFlash > 0.9; const t2 = liveList(game).at(-1);
    if (!hit) fails.push('staging: the round at Sam\'s chest did not find him');
    if (!t2) fails.push('no streak for the round into Sam');
    else {
      if (t2.impact !== 'flesh') fails.push(`impact '${t2.impact}' for a round that found Sam (want flesh)`);
      let sparksOnArrival = -1; while (t2.alive) { const s0 = game.sparks.live; W.step(DT); if (t2.arrived && sparksOnArrival < 0) sparksOnArrival = game.sparks.live - s0; }
      if (sparksOnArrival > 0) fails.push(`${sparksOnArrival} ember sparks in Sam`);
      notes.push(`into Sam: impact ${t2.impact}, L ${f2(t2.L)} m, ember sparks ${Math.max(0, sparksOnArrival)}`);
    }
    verdict(fails.length === 0, '(b3) a real carbine round (the third of a box): its streak starts at the guardShot event\'s muzzle and ends at its impact, solid; one into Sam ends in him as flesh with no ember',
      (fails.length ? fails.join('; ') + ' · ' : '') + notes.join(' · '));
  }
  if (verbose) console.log(`  tracerFx ${JSON.stringify(P)}`);
  console.log(`=== tracer-kinematics: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}

export async function tracerLightsProbe(verbose = process.argv.includes('--verbose')) {
  console.log('\n=== tracer-lights: one transient light per streak riding 5 cm behind the head, none after; the muzzle flash never evicted; three riflemen dumping boxes stay inside the LightSet ===');
  let allPass = true; const verdict = (ok: boolean, label: string, detail: string) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  const P = tracerFx; const C = WEAPONS.aks74u.tracer!.color;
  // ---- one streak: the light frame by frame
  {
    const S = await stageHeld(6301); const fails: string[] = []; const notes: string[] = [];
    const R = await fly(S, 20, 'solid');
    R.rec.forEach((r, i) => {
      if (!r.light) { fails.push(`f${i + 1}: no light on the streak`); return; }
      const want: Vec3 = [18 + (r.s - 0.05), 1.3, 11.3]; if (v3.dist(r.light, want) > 1e-6) fails.push(`f${i + 1}: light at ${r.light.map(f3).join(',')}, want ${want.map(f3).join(',')} (5 cm behind the head)`);
      if (!r.lightColor || v3.dist(r.lightColor, C) > 1e-9) fails.push(`f${i + 1}: light colour ${JSON.stringify(r.lightColor)}, want ${JSON.stringify(C)}`);
      if (Math.abs(r.lightI - P.lightIntensity) > P.lightIntensity * 0.01) fails.push(`f${i + 1}: light intensity ${f3(r.lightI)}, want ≈ ${P.lightIntensity}`);
    });
    // during the flight: exactly one 'tracer' light in the set per live lit streak, flagged transient (ttl ≥ 0), owner = shooter
    { const S2 = await stageHeld(6302); const { W, game, engine, reyes } = S2;
      game.tracers.round(reyes.weapon, reyes.weapon.def, [18, 1.3, 11.3], [1, 0, 0], 20, 'solid', reyes.char.id, true);
      let f = 0; const counts: string[] = [];
      while (game.tracers.live > 0 && f < 30) { W.step(DT); f++; const TL = tracerLights(engine); const lit = liveList(game).filter((t: any) => t.light).length; counts.push(`${TL.length}/${game.tracers.live}`);
        if (game.tracers.live && TL.length !== lit) fails.push(`f${f}: ${TL.length} tracer lights in the set for ${lit} lit streaks`);
        for (const l of TL) { if (!(l.ttl >= 0)) fails.push(`f${f}: a tracer light with ttl ${l.ttl} (not transient)`); if (l.owner !== (reyes.char.id & 0xff)) fails.push(`f${f}: light owner ${l.owner}`); if (!l.enabled) fails.push(`f${f}: light disabled mid-flight`); if (Math.abs(l.radius - P.lightRadius) > 1e-9 || Math.abs(l.range - P.lightRange) > 1e-9) fails.push(`f${f}: radius ${l.radius} range ${l.range}`); } }
      if (tracerLights(engine).length) fails.push(`${tracerLights(engine).length} tracer light(s) left in the set after the streak expired`);
      notes.push(`lights-in-set/live per frame: ${counts.join(' ')} → ${tracerLights(engine).length} after`); }
    if (R.after.tracerLights) fails.push(`${R.after.tracerLights} tracer lights after expiry`);
    verdict(fails.length === 0, `(c1) a 20 m streak: every drawn frame exactly one 'tracer' light 5 cm behind the head, colour [${C.join(', ')}], intensity ≈ ${P.lightIntensity} after LightSet.update, transient (ttl ≥ 0), owner the shooter, radius ${P.lightRadius} / range ${P.lightRange}; zero tracer lights once it is gone`,
      (fails.length ? fails.join('; ') + ' · ' : '') + `light x per frame: ${R.rec.map(r => r.light ? f2(r.light[0]) : '—').join(' → ')} · ` + notes.join(' · '));
  }
  // ---- the muzzle flash of a tracer round is in the set the frame it fires, alongside the tracer's light
  {
    const { W, game, engine, reyes } = await stageHeld(6303); const fails: string[] = []; const w = reyes.weapon;
    w.rearm(); w.fire(); w.fire(); w.fire();   // round 3
    fireWeapon(game, reyes.char, v3.add(reyes.char.muzzle, [10, 0, 0]), false, { spread: 0, steady: true });
    W.step(DT);
    const flashes = engine.lights.lights.filter((l: any) => l.name === 'flash' && l.owner === reyes.char.id);
    const muzzle = flashes.find((l: any) => Math.abs(l.peakIntensity - 90 * 1.7) < 1e-6);
    const TL = tracerLights(engine);
    if (!muzzle) fails.push(`no muzzle flash (peak ${90 * 1.7}) owned by Reyes in the set the frame after the round (flashes: ${flashes.map((l: any) => l.peakIntensity).join('/')})`);
    else if (!(muzzle.intensity > 0) || !muzzle.enabled) fails.push(`the muzzle flash is in the set but dark (intensity ${muzzle.intensity})`);
    if (TL.length !== 1) fails.push(`${TL.length} tracer lights the frame after a tracer round (want 1)`);
    engine.lights.upload(game.time); const dropped = engine.lights.lights.filter((l: any) => l.enabled && l.intensity > 0).length - engine.lights.activeCount;
    if (dropped > 0) fails.push(`upload dropped ${dropped} enabled light(s)`);
    verdict(fails.length === 0, '(c2) the frame a tracer round fires: Reyes\' muzzle flash (peak 153) is in the set and lit, the tracer\'s head light beside it, and upload() takes every enabled light',
      (fails.length ? fails.join('; ') + ' · ' : '') + `flash ${muzzle ? f2(muzzle.intensity) : '—'}, tracer lights ${TL.length}, active ${engine.lights.activeCount}/${MAX_LIGHTS}`);
  }
  // ---- three riflemen dumping boxes together: the set never overflows, nothing enabled is dropped, lit ≤ maxLights
  {
    Math.random = seeded(6304);
    const W = await standUp(); const { game, engine } = W; const fails: string[] = [];
    game.godMode = true; game.tune.carbineGuards = 'all'; for (let i = 0; i < 5; i++) W.step(DT);
    game.teleportPlayer([30, 0, 20]); game.player.visibility = 0;
    game.guards.forEach((gd: any, i: number) => { gd.hold = true; gd.pinned = true; gd.heardUpTo = 1e12; gd.dazzledUntil = 1e9; place(gd, [REYES_AT[0] + i * 1.2, 0, 11.1 + i * 0.2], Math.PI / 2); });   // in a file down the corridor, all facing east (colleagues are transparent to a guard's rounds: only Sam and a held man are ever tested)
    W.step(DT); W.step(DT);
    if (game.guards.some((g: any) => g.weapon.def.id !== 'aks74u')) fails.push('staging: not everybody carries the carbine');
    let maxEnabled = 0, maxActive = 0, maxLit = 0, maxLive = 0, maxTL = 0, drops = 0, rounds = 0, tracerRounds = 0; const baseline = engine.lights.lights.length;
    for (let f = 0; f < 60 * 4; f++) {
      if (f % 6 === 0) for (const gd of game.guards) { const w = gd.weapon; if (!w.fire()) { w.rearm(); w.fire(); } const was = game.tracers.spawned; fireWeapon(game, gd.char, v3.add(gd.char.muzzle, [20, 0, 0]), false, { spread: 0.02, steady: true }); rounds++; if (game.tracers.spawned > was) tracerRounds++; }
      W.step(DT);
      engine.lights.upload(game.time);
      const enabled = engine.lights.lights.filter((l: any) => l.enabled && l.intensity > 0).length;
      maxEnabled = Math.max(maxEnabled, enabled); maxActive = Math.max(maxActive, engine.lights.activeCount);
      if (engine.lights.activeCount < enabled) drops++;
      maxLit = Math.max(maxLit, game.tracers.lit); maxLive = Math.max(maxLive, game.tracers.live); maxTL = Math.max(maxTL, tracerLights(engine).length);
      if (game.tracers.lit > P.maxLights) fails.push(`f${f}: ${game.tracers.lit} lit heads (max ${P.maxLights})`);
      if (tracerLights(engine).length !== game.tracers.lit) fails.push(`f${f}: ${tracerLights(engine).length} tracer lights in the set vs lit ${game.tracers.lit}`);
    }
    for (let f = 0; f < 30; f++) W.step(DT);
    if (drops) fails.push(`upload dropped enabled lights on ${drops} frame(s) (max enabled ${maxEnabled} vs MAX_LIGHTS ${MAX_LIGHTS})`);
    if (maxEnabled > MAX_LIGHTS) fails.push(`${maxEnabled} enabled lights at once (> ${MAX_LIGHTS})`);
    if (tracerLights(engine).length) fails.push(`${tracerLights(engine).length} tracer lights left after`);
    const leaked = engine.lights.lights.length - baseline; if (leaked > 0) fails.push(`${leaked} light(s) more in the set than before the dump, half a second after the last round`);
    verdict(fails.length === 0, `(c3) three riflemen firing full boxes at 600 rpm together for 4 s (${rounds} rounds, ${tracerRounds} tracers): enabled lights peak ${maxEnabled} ≤ ${MAX_LIGHTS} and upload() never drops one, lit heads peak ${maxLit} ≤ maxLights ${P.maxLights} (streaks alive peak ${maxLive}), tracer lights in the set always = lit, none left behind`,
      (fails.length ? fails.join('; ') + ' · ' : '') + `level rows ${baseline}, active peak ${maxActive}, tracer lights peak ${maxTL}`);
  }
  if (verbose) console.log(`  MAX_LIGHTS ${MAX_LIGHTS}, tracerFx.maxLights ${P.maxLights}, maxLive ${P.maxLive}`);
  console.log(`=== tracer-lights: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}

/** 20 s of the seeded fight recorded: rounds (frame, row, segment), hearing events, audio calls, flash cards, flashes — and the tracer side separately */
async function recordFight(seed: number, flag: boolean) {
  const S = await stageAlert(seed, 8, flag); const { W, game, engine } = S;
  const cards: string[] = []; const fxArr = game.fx; fxArr.push = function (...items: any[]) { for (const f of items) cards.push(`${game.time.toFixed(4)}:${f.box.h.map((x: number) => x.toFixed(3)).join('x')}:${f.box.emissive.map((x: number) => x.toFixed(1)).join('/')}`); return Array.prototype.push.apply(this, items); };
  const flashes: string[] = [], emberFlashes: string[] = []; const lights = engine.lights; const orig = lights.flash.bind(lights);
  lights.flash = (pos: Vec3, color: Vec3, intensity: number, range: number, ttl: number, owner: number) => { const s = `${game.time.toFixed(4)}:${intensity.toFixed(2)}/${range}/${ttl}/o${owner}`; if (Math.abs(ttl - tracerFx.emberTtl) < 1e-9 && Math.abs(intensity - tracerFx.emberIntensity) < 1e-9) emberFlashes.push(s); else flashes.push(s); return orig(pos, color, intensity, range, ttl, owner); };
  const audio: any[] = []; W.audioLog = audio;
  const seen = new Set<any>(); const events: string[] = [], rounds: string[] = [];
  let maxLive = 0, tracerLightFrames = 0;
  for (let f = 0; f < 60 * 20; f++) {
    game.player.visibility = 0.9; game.player.hitFlash = 0;
    W.step(DT);
    for (const e of game.events) { if (seen.has(e)) continue; seen.add(e); events.push(`${e.time.toFixed(4)}:${e.kind}:${e.level ?? ''}:${e.loud}`); if (e.kind === 'guardShot' || e.kind === 'shot') rounds.push(`f${f + 1}:${e.weapon}:${(e.from ?? []).map((x: number) => x.toFixed(4)).join(',')}>${(e.to ?? []).map((x: number) => x.toFixed(4)).join(',')}`); }
    maxLive = Math.max(maxLive, game.tracers.live); if (tracerLights(engine).length) tracerLightFrames++;
  }
  W.audioLog = null;
  const audioStr = audio.filter(a => a.name !== 'footstep').map(a => `${a.t.toFixed(4)}:${a.name}@${a.gain.toFixed(3)}`);
  return { rounds, events, audio: audioStr, cards, flashes, emberFlashes, spawned: game.tracers.spawned, maxLive, tracerLightFrames, guardStates: S.game.guards.map((g: any) => g.state).join('/') };
}

export async function tracerFlag(verbose = process.argv.includes('--verbose')) {
  console.log('\n=== tracer-flag: tune.tracers off = zero streaks and zero tracer lights, and the fight is otherwise identical to flag-on (rounds, events, audio, cards, flashes) ===');
  let allPass = true; const verdict = (ok: boolean, label: string, detail: string) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  const on = await recordFight(6401, true), off = await recordFight(6401, false);
  const fails: string[] = [];
  const cmp = (k: 'rounds' | 'events' | 'audio' | 'cards' | 'flashes') => { const a = on[k], b = off[k]; if (JSON.stringify(a) !== JSON.stringify(b)) { let i = 0; while (i < Math.min(a.length, b.length) && a[i] === b[i]) i++; fails.push(`${k} differ (on ${a.length} / off ${b.length}) from #${i}: on ${a[i] ?? '∅'} | off ${b[i] ?? '∅'}`); } };
  cmp('rounds'); cmp('events'); cmp('audio'); cmp('cards'); cmp('flashes');
  if (off.spawned || off.maxLive || off.tracerLightFrames || off.emberFlashes.length) fails.push(`flag off still made ${off.spawned} streaks / ${off.maxLive} alive / tracer lights on ${off.tracerLightFrames} frames / ${off.emberFlashes.length} ember glows`);
  if (!on.spawned) fails.push('flag on made no streaks in 20 s (staging)');
  if (on.rounds.length < 20) fails.push(`only ${on.rounds.length} rounds in 20 s (staging)`);
  verdict(fails.length === 0, '(d) the same seeded 20 s fight with the flag on and off: identical rounds (frame, row, muzzle → impact), hearing events, audio calls, flash cards and flashes — the dice never touched — while off makes no streak, no tracer light, no ember glow and on makes its twelve a box',
    (fails.length ? fails.join('; ') + ' · ' : '') + `${on.rounds.length} rounds, ${on.events.length} events, ${on.audio.length} audio calls, ${on.cards.length} cards, ${on.flashes.length} flashes either way · on: ${on.spawned} streaks (≤ ${on.maxLive} alive), ${on.emberFlashes.length} ember glows, tracer lights on ${on.tracerLightFrames} frames · off: ${off.spawned} / ${off.tracerLightFrames} · guards ${on.guardStates} | ${off.guardStates}`);
  if (verbose) console.log(`  first rounds on: ${on.rounds.slice(0, 3).join(' ')}\n  first rounds off: ${off.rounds.slice(0, 3).join(' ')}`);
  console.log(`=== tracer-flag: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}

export async function tracerPool(verbose = process.argv.includes('--verbose')) {
  console.log('\n=== tracer-pool: 200 forced streaks in 50 frames — live ≤ maxLive, lit ≤ maxLights, the pool never grows, nothing retained afterwards ===');
  let allPass = true; const verdict = (ok: boolean, label: string, detail: string) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  const P = tracerFx;
  const { W, game, engine, reyes } = await stageHeld(6501); const fails: string[] = [];
  for (let f = 0; f < 10; f++) W.step(DT);
  const T = game.tracers; const pool0 = (T as any).pool.length; const lights0 = engine.lights.lights.length; const fx0 = game.fx.length;
  let maxLive = 0, maxLit = 0, maxTL = 0, maxDyn = 0, went = 0, evictions = 0;
  for (let f = 0; f < 50; f++) {
    for (let k = 0; k < 4; k++) {
      const L = 6 + ((f * 4 + k) * 7.3) % 54;   // 6‥60 m: long flights so plenty overlap
      const dir: Vec3 = v3.normalize([1, 0.02 * ((k % 3) - 1), 0.05 * (k - 1.5)]);
      const liveBefore = T.live; if (T.round(reyes.weapon, reyes.weapon.def, [2 + k * 0.3, 1.3, 11.3 + k * 0.1], dir, L, 'solid', reyes.char.id, true)) { went++; if (liveBefore >= P.maxLive) evictions++; }
    }
    W.step(DT);
    maxLive = Math.max(maxLive, T.live); maxLit = Math.max(maxLit, T.lit); maxTL = Math.max(maxTL, tracerLights(engine).length); maxDyn = Math.max(maxDyn, game.dynBoxes.length);
    const listed = liveList(game).length; if (listed !== T.live) fails.push(`f${f}: each() lists ${listed} but live says ${T.live}`);
    if (T.live > P.maxLive) fails.push(`f${f}: ${T.live} alive (maxLive ${P.maxLive})`);
    if (T.lit > P.maxLights || tracerLights(engine).length > P.maxLights) fails.push(`f${f}: lit ${T.lit} / tracer lights ${tracerLights(engine).length} (maxLights ${P.maxLights})`);
    if ((T as any).pool.length !== pool0) fails.push(`f${f}: the pool grew to ${(T as any).pool.length}`);
    for (const t of liveList(game)) if (!(t.s >= 0 && t.s <= t.L + 1e-9) || ![...t.from, ...t.dir, t.s, t.L, t.v].every(Number.isFinite)) fails.push(`f${f}: a streak with s ${t.s} L ${t.L}`);
  }
  for (let f = 0; f < 90; f++) W.step(DT);   // let the last of them (60 m at 280 m/s ≈ 13 frames) and their embers / glows go
  if (went !== 200) fails.push(`${went} of 200 forced rounds made a streak`);
  if (T.live !== 0) fails.push(`${T.live} still alive 1.5 s after the last`);
  if (tracerLights(engine).length) fails.push(`${tracerLights(engine).length} tracer lights left in the set`);
  if (engine.lights.lights.length !== lights0) fails.push(`the LightSet holds ${engine.lights.lights.length} lights, ${lights0} before (something retained)`);
  if (game.fx.length !== fx0) fails.push(`game.fx holds ${game.fx.length} entries (was ${fx0})`);
  if ((T as any).pool.length !== pool0 || pool0 !== P.maxLive) fails.push(`pool ${(T as any).pool.length} (made ${pool0}, maxLive ${P.maxLive})`);
  if (game.sparks.live > 96) fails.push(`sparks live ${game.sparks.live}`);
  if (maxLive < P.maxLive) fails.push(`the pool was never full (peak ${maxLive}) — the probe did not exercise eviction`);
  verdict(fails.length === 0, `(e) 200 forced streaks, 4 a frame for 50 frames: alive peaks at maxLive ${P.maxLive} with the oldest evicted (${evictions} evictions), lit never over maxLights ${P.maxLights}, the pool stays ${pool0} slots, and 1.5 s later nothing is alive, no tracer light or any other light is left in the set, game.fx is empty again`,
    (fails.length ? fails.join('; ') + ' · ' : '') + `peaks: live ${maxLive}, lit ${maxLit}, tracer lights ${maxTL}, dyn boxes ${maxDyn} · after: live ${T.live}, lights ${engine.lights.lights.length}/${lights0}, fx ${game.fx.length}, sparks ${game.sparks.live}`);
  if (verbose) console.log(`  spawned ${T.spawned}`);
  console.log(`=== tracer-pool: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}
