// The 'breach' family, run through probes.ts — what is left of it since the daytime breach SHOWCASE was removed (its breach-run / breach-restore / breach-tour went
// with the show; the daylight variant and the room-clearing doctrine it staged are the game's and stay checked):
//   bun run tools/qa/probes.ts breach | breach-daylight | clear-doctrine
// PASS / FAIL each, all headless:
//   breach-daylight   setDaylight(true) then (false) leaves the light list (name, kind, enabled, intensity, colour, dir) and the frame's sky / haze bit for bit as
//                     they were; while it is day: a 'sun' of kind 2 is in the set and lit, the moon and every street lamp are out, every listed group is on, and
//                     the level's blackout (thrown first) is over
//   clear-doctrine    the guards' own two-man RoomClear (squad.ts) keeps battle drill six: the kicker off the funnel, #2 a beat behind, centre then his corner,
//                     #2 on the next door
import { standUp, ROOT } from './headless.ts';
import type { Vec3 } from './headless.ts';
const { setDaylight, isDaylight } = await import(`${ROOT}/src/game/lighting.ts`);
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);

const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x));
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}

/** the light set as a comparable list (order matters: the GPU slots follow it) — everything but the momentary intensity, which fixtures on the blink and restriking
 *  tubes legitimately change from one frame to the next (the switches behind it are compared separately) */
function lightList(engine: any): string {
  return engine.lights.lights.map((l: any) => `${l.name}:${l.kind}:${l.enabled ? 1 : 0}:${l.peakIntensity.toFixed(3)}:${l.color.map((c: number) => c.toFixed(3)).join(',')}:${/^beacon|^flashlight|pistol_light|_cone$/.test(l.name) ? '-' : l.dir.map((c: number) => c.toFixed(3)).join(',')}:${l.radius.toFixed(3)}`).join('|');   // (the beacons turn, the torches swing and the cameras' haze cones pan whatever the hour: their direction is nobody's switch)
}
/** main.ts uploads the light set inside engine.render, which the harness has none of: do it by hand after a step so activeCount / activeIdx mean this frame */
function upload(W: any) { W.engine.lights.upload(W.game.time); }
const skyOf = (engine: any) => JSON.stringify({ z: engine.settings.skyZenith, h: engine.settings.skyHorizon, haze: engine.settings.hazeDensity });
const switches = (game: any) => game.targets.map((t: any) => `${t.name}:${t.on ? 1 : 0}`).join('|');

// ---------------------------------------------------------------- breach-daylight
export async function breachDaylight() {
  const F = family('breach-daylight: the daytime variant swaps in and back out bit for bit (lighting.ts setDaylight)');
  Math.random = seeded(3);
  const W = await standUp(); const { game, engine, level } = W;
  for (let i = 0; i < 10; i++) W.step(DT);
  game.setBlackout(30, 'debug'); for (let i = 0; i < 5; i++) W.step(DT);   // thrown first: day must bring the mains back
  game.endBlackout(); for (let i = 0; i < 6 / DT; i++) W.step(DT);         // …and the round trip is measured against a floor with the mains ON and every tube done restriking (a blackout is not something day → night should restore)
  upload(W); const L0 = lightList(engine), S0 = skyOf(engine), W0 = switches(game);
  game.setBlackout(30, 'debug'); W.step(DT);
  setDaylight(game, true); for (let i = 0; i < 3; i++) W.step(DT); upload(W);
  const D = level.daylight;
  { const f: string[] = [];
    if (!isDaylight(game)) f.push('isDaylight false');
    const sun = engine.lights.lights.find((l: any) => l.name === 'sun'); if (!sun) f.push('no sun in the set'); else { if (sun.kind !== 2) f.push(`sun kind ${sun.kind}`); if (!sun.enabled) f.push('sun disabled'); if (!(engine.lights.activeIdx as number[]).some((i: number) => engine.lights.lights[i] === sun)) f.push('sun not uploaded'); }
    const moon = engine.lights.lights.find((l: any) => l.name === 'moon'); if (moon?.enabled) f.push('moon still lit');
    for (const t of game.targets) { if (D.groupsOff.includes(t.group) && (t.on || (t.light && t.light.enabled))) f.push(`${t.name} (${t.group}) still on`); if (D.groupsOn.includes(t.group) && !t.on) f.push(`${t.name} (${t.group}) off`); }
    if (game.blackout.active) f.push('blackout still active');
    if (Math.abs(engine.settings.hazeDensity - D.haze) > 1e-9) f.push(`haze ${engine.settings.hazeDensity}`);
    if (JSON.stringify(engine.settings.skyZenith) !== JSON.stringify(D.sky.zenith)) f.push(`sky zenith ${engine.settings.skyZenith}`);
    const Ld = lightList(engine); setDaylight(game, true); if (lightList(engine) !== Ld) f.push('a second setDaylight(true) changed the list');
    F.verdict(f.length === 0, 'day: one lit sun of kind 2 uploaded, moon and street lamps out, every listed group on, mains back, sky / haze the variant\'s, idempotent', f.join('; ') || `sun dir ${sun?.dir.map(f2)} I ${sun?.intensity}; ${engine.lights.activeCount} lights uploaded by day; sky ${JSON.stringify(engine.settings.skyZenith)} haze ${engine.settings.hazeDensity}`); }
  setDaylight(game, false); for (let i = 0; i < 6 / DT; i++) W.step(DT); upload(W);   // (six seconds again: the groups day switched on and night switches back off restrike nothing, but a fixture on the blink is compared like for like)
  { const f: string[] = [];
    if (isDaylight(game)) f.push('isDaylight still true');
    const L1 = lightList(engine), S1 = skyOf(engine), W1 = switches(game);
    if (L1 !== L0) { const a = L0.split('|'), b = L1.split('|'); const i = a.findIndex((x, k) => x !== b[k]); f.push(`light list differs (first at #${i}: '${a[i]}' vs '${b[i]}'; ${a.length} vs ${b.length} lights)`); }
    if (S1 !== S0) f.push(`sky ${S0} → ${S1}`);
    if (W1 !== W0) { const a = W0.split('|'), b = W1.split('|'); f.push(`switches differ: ${a.filter((x: any, k: any) => x !== b[k]).slice(0, 6).join(', ')}`); }
    setDaylight(game, false); if (lightList(engine) !== L1) f.push('a second setDaylight(false) changed the list');
    F.verdict(f.length === 0, 'night again: light list, sky, haze and every switch exactly as before the round trip; idempotent', f.join('; ') || `${L0.split('|').length} lights, ${engine.lights.activeCount} uploaded by night, sky ${S0}`); }
  return F.done();
}

// ---------------------------------------------------------------- clear-doctrine
/** The guards' own two-man RoomClear (squad.ts) keeps the doctrine the breach drill stages: run staged on the tour's conference plan (the kick) and on two of the level's
 *  lockdown plans (the keyed shove; rooms with a second door), measured off the men frame by frame — the kicker is out of the doorway's opening from half a
 *  second after the leaf goes until he starts in; #2 starts in ≥ 0.4 s behind #1; each man's muzzle bears on the room's centre inside 0.7 s of starting in and
 *  on his own corner (the first point of his authored sector) inside 1.15 s; where the room has another door #2 ends the search squared to it (≤ 30°); the
 *  drill still reaches 'resolve' with its lines said (the tour's stop counts on ≥ 10 inside 18 s). */
export async function clearDoctrine() {
  const F = family('clear-doctrine: the live RoomClear keeps battle drill six — kicker off the funnel, #2 a beat behind, centre then his corner, #2 on the next door (squad.ts)');
  const { RoomClear } = await import(`${ROOT}/src/game/squad.ts`);
  const { CONFERENCE_CLEAR } = await import(`${ROOT}/src/game/demo.ts`);
  const bearing = (from: Vec3, to: Vec3) => Math.atan2(to[0] - from[0], to[2] - from[2]);
  const angOff = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) * 180 / Math.PI;
  const cases: { name: string; plan: (level: any) => any; wantNext: string | null }[] = [
    { name: "the tour's conference room (kicked)", plan: () => CONFERENCE_CLEAR, wantNext: null },
    { name: 'server room by its corridor door (keyed shove; side door to the office)', plan: (level: any) => level.clearPlans[1], wantNext: 'server_manager' },
    { name: 'break room by its corridor door (keyed shove; three other doors)', plan: (level: any) => level.clearPlans[4], wantNext: 'breakroom_w' },
  ];
  for (const [ci, C] of cases.entries()) {
    Math.random = seeded(41 + ci);
    const W = await standUp(); const { game, level } = W;
    game.playerInvisible = true; game.godMode = true; game.quietUtility = true; game.teleportPlayer([1.5, 0, 1.5]);
    for (let i = 0; i < 10; i++) W.step(DT);
    const P0 = C.plan(level); const [a, b] = game.guards; for (const o of game.guards.slice(2)) { o.hold = true; o.char.pos = [-40, 0, -40]; }
    // staged from a couple of metres up the stack line (the level's plans have no approach marks of their own)
    const u = v3.normalize([P0.stack[1][0] - P0.stack[0][0], 0, P0.stack[1][2] - P0.stack[0][2]]);
    const P = P0.from ? P0 : { ...P0, from: [v3.mad(P0.stack[0], u, 1.7), v3.mad(P0.stack[1], u, 1.9)] };
    const d = game.doors.byName(P.door); d.reset(); d.angle = 0; d.vel = 0; d.latched = true; d.closing = false;
    const clear = new RoomClear(game, P, a, b); clear.start();
    let says = 0; const origSay = game.say.bind(game); game.say = (gd: any, text: string, radio = false) => { says++; return origSay(gd, text, radio); };
    let t = 0, tOpen = NaN, inFunnel = '', gap = NaN;
    const centreHit = [Infinity, Infinity], cornerHit = [Infinity, Infinity]; const starts = [NaN, NaN];
    const centre: Vec3 = P.bounds ? [(P.bounds.x0 + P.bounds.x1) / 2, 1, (P.bounds.z0 + P.bounds.z1) / 2] : (() => { const pts = [...P.entryAim[0], ...P.entryAim[1]]; let x = 0, z = 0; for (const p of pts) { x += p[0]; z += p[2]; } return [x / pts.length, 1, z / pts.length] as Vec3; })();
    const funnel = (p: Vec3) => { const [hx, hz] = d.def.hinge; const alongX = Math.abs(Math.sin(d.def.closedDir)) < 0.5; const u0 = alongX ? hx : hz, uu = alongX ? p[0] : p[2], w = alongX ? p[2] - hz : p[0] - hx; return uu > u0 - 0.05 && uu < u0 + d.def.width + 0.05 && Math.abs(w) < 0.9; };
    let faceOff = NaN; const phases = new Set<string>();
    for (let f = 0; f < 60 * 18; f++) {
      clear.tick(t, DT); W.step(DT); t += DT; phases.add(clear.phase);
      if (isNaN(tOpen) && !d.latched) tOpen = t;
      if ((P.breach ?? 'kick') === 'kick' && !isNaN(tOpen) && t > tOpen + 0.5 && isNaN(clear.tEnter) && !inFunnel && funnel(a.char.pos)) inFunnel = `#1 in the opening at (${f2(a.char.pos[0])}, ${f2(a.char.pos[2])}) ${f2(t - tOpen)} s after the leaf went`;
      starts[0] = clear.tEnter; starts[1] = clear.tEnter2;
      [a, b].forEach((gd: any, i: number) => {
        const t0 = starts[i]; if (isNaN(t0)) return; const c = gd.char, dtIn = t - t0;
        if (dtIn <= 0.7 && angOff(c.aimYaw, bearing(c.pos, centre)) < 20) centreHit[i] = Math.min(centreHit[i], dtIn);
        if (dtIn <= 1.15 && angOff(c.aimYaw, bearing(c.pos, P.entryAim[i][0])) < 20) cornerHit[i] = Math.min(cornerHit[i], dtIn);
      });
      if (!isNaN(clear.tEnter) && !isNaN(clear.tEnter2)) gap = clear.tEnter2 - clear.tEnter;
      if (clear.phase === 'resolve' && isNaN(faceOff)) { const nd = clear.nextDoor; faceOff = nd ? angOff(b.char.bodyYaw, bearing(b.char.pos, nd.frameCentre)) : 0; }
    }
    const f: string[] = [];
    if (inFunnel) f.push(inFunnel);
    if (!(gap >= 0.4)) f.push(`#2 started in ${f2(gap)} s after #1 (want ≥ 0.4)`);
    for (const i of [0, 1]) { if (!(centreHit[i] <= 0.7)) f.push(`#${i + 1}'s muzzle never bore on the room's centre inside 0.7 s of starting in`); if (!(cornerHit[i] <= 1.15)) f.push(`#${i + 1}'s muzzle never bore on his corner inside 1.15 s of starting in`); }
    const nd = clear.nextDoor?.def.name ?? null;
    if (nd !== C.wantNext) f.push(`next door ${nd} (want ${C.wantNext})`);
    if (C.wantNext && !(faceOff <= 30)) f.push(`#2 ${f2(faceOff)}° off the ${C.wantNext} door at resolve (want ≤ 30)`);
    if (!phases.has('resolve')) f.push(`never reached 'resolve' in 18 s (phases ${[...phases].join('→')})`);
    if (says < 10) f.push(`${says} barks (want ≥ 10)`);
    F.verdict(f.length === 0, C.name, f.join('; ') || `#2 in +${f2(gap)} s; centre at +${f2(centreHit[0])} / +${f2(centreHit[1])} s, own corner at +${f2(cornerHit[0])} / +${f2(cornerHit[1])} s; ${nd ? `#2 ${f2(faceOff)}° off ${nd} at resolve` : 'no second door'}; resolve at ${f2(clear.tResolve)} s, ${says} barks${(P.breach ?? 'kick') === 'kick' ? '; kicker clear of the opening from +0.5 s' : ''}`);
    clear.end('patrol'); game.say = origSay;
  }
  return F.done();
}
