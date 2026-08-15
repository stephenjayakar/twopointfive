// Attract mode (src/game/attract.ts) without a page: the real Attract on the headless Game + the real FollowCamera, ticked and stepped in main.ts's order
// (attract.tick → frozen unless attract is LIVE → attract.update → game.update → camera with the programme's look-at), asserting what the lead otherwise checks by
// leaving the start card alone: nothing happens for IDLE_SECS of 'no input' and nothing at all while canRun says no; then it starts with its OPENING beat — the
// veil rising over a world that stays frozen and untouched (nobody steps off his mark, Sam stays put, no flag moves) until the veil has been fully black for a
// presented frame — and only then goes live: raises the tour's flags, parks Sam out of the level and out of the AI's senses, cuts through EVERY vantage in order
// (each held its authored seconds, the fade up around each cut and clear mid-hold, yaw within the drift of the shot's own yaw, distance inside [dist·(1−PUSH_IN),
// dist]) and loops; the guards really patrol meanwhile (metres walked); nothing goes NaN; the mission clock and the alarm stay put; a poke() puts back the flags,
// the camera (yaw / pitch / distance as saved, target on Sam), a fresh calm encounter with Sam at the insertion point and the level as authored, and calls its
// onStop hook exactly once (main.ts refreshes the frozen picture there) — while a poke during the opening beat only drops the veil and calls nothing; after another
// IDLE_SECS it starts again; canRun going false mid-programme stops it the same way.
//   bun run tools/qa/attract.ts [--quiet]      exit 1 on any failure
import { standUp, ROOT } from './headless.ts';
import type { Vec3 } from './headless.ts';

const { Attract } = await import(`${ROOT}/src/game/attract.ts`);
const { v3, DEG, wrapAngle } = await import(`${ROOT}/src/math/vec.ts`);

const QUIET = process.argv.includes('--quiet');
const DT = 1 / 60;
const failures: string[] = []; const notes: string[] = [];
const fail = (m: string) => { failures.push(m); console.log(`!! FAIL: ${m}`); };
const info = (m: string) => { notes.push(m); if (!QUIET) console.log(`   ${m}`); };
const fin = (...xs: number[]) => xs.every(Number.isFinite);
const f2 = (x: number) => Number(x.toFixed(2));

const W = await standUp();
const { game, cam, level } = W;
game.restartEncounter();   // the page at boot: a fresh encounter, Sam at the insertion point
const spawn: Vec3 = v3.copy(level.playerSpawn);
let allowed = true;        // main.ts's canRun (start card up, no tour, not calibrating, not automated, tab visible)
let stops = 0;             // main.ts's onStop (the frozen picture's refresh): once per stop that had gone live, never otherwise
const attract = new Attract(game, cam, () => allowed, undefined, () => { stops++; });
const IDLE = Attract.IDLE_SECS, HOLD = Attract.HOLD_SECS, DRIFT = Attract.DRIFT_DEG, PUSH = Attract.PUSH_IN, VEIL_UP = Attract.VEIL_UP_SECS;
const shots: any[] = attract.shots;
if (shots.length < 5 || shots.length > 7) fail(`${shots.length} vantages (want 5‥7)`);

// reference: the level as a fresh restart leaves it (what a stop must hand back)
const refDoors = new Map<string, number>(); for (const d of game.doors.list) refDoors.set(d.def.name, d.angle);
const refLights = new Map<any, boolean>(); for (const t of game.targets) refLights.set(t, t.on);
const cam0 = { yaw: cam.yaw, pitch: cam.pitch, dist: cam.desiredDistance };
const flags0 = { quiet: game.quietUtility, invisible: game.playerInvisible, touring: game.touring, god: game.godMode, ai: game.aiEnabled };
const missionElapsed0 = game.mission.stats.elapsed;

let t = 0, frame = 0;
let prevFade = 0;          // the veil as painted at the end of the previous frame (main.ts sets its opacity after the step)
/** one frame as main.ts runs it with the start card up: tick (wall dt) → frozen unless attract is LIVE → attract.update → game step with its look-at */
function step(dt = DT) {
  prevFade = attract.fade;
  attract.tick(dt);
  const live = attract.live;
  const pos = live ? attract.update(dt) : null;
  if (live) W.step(dt, pos); else W.input.endFrame();   // (frozen behind the card: nothing advances — through the opening beat too)
  t += dt; frame++;
  if (!fin(cam.yaw, cam.pitch, cam.distance, cam.desiredDistance, cam.target[0], cam.target[2], cam.pos[0], cam.pos[1], cam.pos[2], attract.fade)) fail(`f${frame}: NaN in camera / fade — yaw ${cam.yaw} dist ${cam.distance}/${cam.desiredDistance} target ${cam.target} fade ${attract.fade}`);
  const pc = game.player.char; if (!fin(pc.pos[0], pc.pos[2])) fail(`f${frame}: player pos ${pc.pos}`);
  for (const gd of game.guards) if (!fin(gd.char.pos[0], gd.char.pos[2], gd.awareness)) fail(`f${frame}: guard ${gd.callsign} pos ${gd.char.pos} aw ${gd.awareness}`);
}
const run = (secs: number, each?: () => void) => { for (const end = t + secs; t < end - 1e-9;) { step(); each?.(); } };
/** step until the programme starts (at most `secs`): true if it did — the veil is still at 0 on that frame (tick starts it after the idle count; the opening runs from the next) */
const untilActive = (secs: number) => { for (const end = t + secs; t < end - 1e-9 && !attract.active;) step(); return attract.active; };
const flagsNow = () => ({ quiet: game.quietUtility, invisible: game.playerInvisible, touring: game.touring, god: game.godMode, ai: game.aiEnabled });
const sameFlags = (a: any, b: any) => a.quiet === b.quiet && a.invisible === b.invisible && a.touring === b.touring && a.god === b.god && a.ai === b.ai;
const camUntouched = () => Math.abs(wrapAngle(cam.yaw - cam0.yaw)) < 1e-9 && Math.abs(cam.pitch - cam0.pitch) < 1e-9 && Math.abs(cam.desiredDistance - cam0.dist) < 1e-9 && Math.abs(cam.distance - cam0.dist) < 1e-9;

/** Step through an opening beat that has just begun (attract.active, not live), asserting the world is frozen and untouched under the rising veil, and that the
 *  frame it goes live on follows a frame that ended fully black. Returns the sim seconds the opening took, or −1 if it never went live within 2 s. */
function watchOpening(tag: string): number {
  const t0 = t; const gAt = game.guards.map((g: any) => v3.copy(g.char.pos)); let lastFade = attract.fade;
  while (attract.active && !attract.live && t - t0 < 2) {
    step();
    if (!attract.live) {   // still opening: nothing behind the veil may have moved or changed
      if (game.guards.some((g: any, k: number) => v3.distXZ(g.char.pos, gAt[k]) > 1e-6)) fail(`${tag}: a guard moved during the opening beat (veil at ${f2(attract.fade)})`);
      if (v3.distXZ(game.player.char.pos, spawn) > 0.05) fail(`${tag}: Sam left the insertion point during the opening beat (veil at ${f2(attract.fade)})`);
      if (!sameFlags(flagsNow(), flags0)) fail(`${tag}: flags moved during the opening beat: ${JSON.stringify(flagsNow())}`);
      if (!camUntouched()) fail(`${tag}: the camera moved during the opening beat (yaw ${f2(cam.yaw / DEG)}° dist ${f2(cam.distance)})`);
      if (attract.fade < lastFade - 1e-9) fail(`${tag}: the veil dipped during the opening beat (${f2(lastFade)} → ${f2(attract.fade)})`);
      lastFade = attract.fade;
    } else {               // this frame the world took its first step: the frame before it must have been painted fully black, and this one is under black too
      if (prevFade < 1) fail(`${tag}: went live after a frame painted at veil ${f2(prevFade)} (want a fully black frame first)`);
      if (attract.fade < 0.999) fail(`${tag}: the first live frame is at veil ${f2(attract.fade)} (want ≥ 0.999)`);
    }
  }
  return attract.live ? t - t0 : -1;
}

// ---- 1. nothing while it may not run; nothing before IDLE_SECS
allowed = false; run(IDLE + 2); if (attract.active || attract.idle > 0) fail(`counted / started while canRun was false (active ${attract.active}, idle ${attract.idle})`);
allowed = true; run(IDLE - 0.5); if (attract.active) fail(`started after only ${f2(attract.idle)} s idle (want ${IDLE})`);
attract.poke(); run(IDLE - 0.5); if (attract.active) fail('a poke did not restart the idle clock');
if (stops !== 0) fail(`onStop called ${stops}× by pokes that stopped nothing`);
if (!untilActive(0.6)) fail(`not started after ${IDLE} s idle`); else info(`started at t=${f2(t)} s after ${IDLE} s idle`);
if (attract.live || attract.fade !== 0) fail(`live / veiled the moment it started (live ${attract.live}, veil ${attract.fade}) — the opening beat must raise the veil over the frozen view first`);

// ---- 2. the opening beat: veil up over the frozen, untouched view; live only after a fully black frame; then flags up and Sam away
{ const took = watchOpening('opening');
  if (took < 0) fail('never went live after the opening beat');
  else { if (took < VEIL_UP - DT || took > VEIL_UP + 0.25) fail(`the opening beat took ${f2(took)} s (veil rise is ${VEIL_UP} s + a black frame)`); info(`went live ${f2(took)} s after starting (veil ${VEIL_UP} s + a held black frame); frame before was painted at ${f2(prevFade)}`); } }
if (!game.quietUtility || !game.playerInvisible || !game.touring) fail(`flags once live: quietUtility ${game.quietUtility} playerInvisible ${game.playerInvisible} touring ${game.touring} (want all up)`);

// ---- 3. the programme: every vantage in order with its hold, fades, yaw drift, push-in, patrols walking, mission / alarm untouched
const seen: number[] = []; let lastI = -2; const enterT: number[] = []; let minFadeMid = 1, maxFadeCut = 0; let walked = 0;
const gPrev = game.guards.map((g: any) => v3.copy(g.char.pos));
const total = shots.reduce((a: number, s: any) => a + (s.dur ?? HOLD), 0);
let firstT = -1;   // sim time shot 0 was first seen (it cut in on the go-live frame)
run(total + HOLD + 1.5, () => {
  const i = attract.shotI; if (i < 0) { fail(`shot index ${i} while live`); return; }
  if (firstT < 0) { firstT = t; if (v3.distXZ(game.player.char.pos, spawn) < 10) fail(`Sam not parked away at the first cut: at (${f2(game.player.char.pos[0])}, ${f2(game.player.char.pos[2])})`); else info(`first cut at t=${f2(t)}; Sam parked at (${f2(game.player.char.pos[0])}, ${f2(game.player.char.pos[2])})`); }
  const s = shots[i], st = attract.shotT, dur = s.dur ?? HOLD;
  if (i !== lastI) { seen.push(i); enterT.push(t); lastI = i; }
  if (v3.distXZ(game.player.char.pos, spawn) < 10) fail(`shot ${i}: Sam is back near the insertion point mid-programme (${f2(game.player.char.pos[0])}, ${f2(game.player.char.pos[2])})`);
  if (st > 0.6 && st < dur - 0.4) { minFadeMid = Math.min(minFadeMid, 1 - attract.fade); if (attract.fade > 0.02) fail(`shot ${i} (${s.title}) +${f2(st)} s: veil at ${f2(attract.fade)} mid-hold`); }
  if (st < 0.05 && st > 0) maxFadeCut = Math.max(maxFadeCut, attract.fade);
  const yaw0 = typeof s.yaw === 'function' ? null : s.yaw;   // (a live yaw is answered at the cut; checked for finiteness above)
  if (yaw0 !== null) { const off = Math.abs(wrapAngle(cam.yaw - yaw0 * DEG)) / DEG; if (off > DRIFT + 0.01) fail(`shot ${i} (${s.title}) +${f2(st)} s: yaw ${f2(cam.yaw / DEG)}° is ${f2(off)}° off its authored ${yaw0}° (drift cap ${DRIFT}°)`); }
  if (st > 0.02 && (cam.desiredDistance > s.dist + 1e-6 || cam.desiredDistance < s.dist * (1 - PUSH) - 1e-6)) fail(`shot ${i} (${s.title}) +${f2(st)} s: desiredDistance ${f2(cam.desiredDistance)} outside [${f2(s.dist * (1 - PUSH))}, ${s.dist}]`);
  if (typeof s.pos !== 'function' && st > 1.5 && v3.distXZ(cam.target, s.pos) > 0.05) fail(`shot ${i} (${s.title}) +${f2(st)} s: camera target (${f2(cam.target[0])}, ${f2(cam.target[2])}) is off the vantage (${s.pos[0]}, ${s.pos[2]})`);
  game.guards.forEach((g: any, k: number) => { walked += v3.distXZ(g.char.pos, gPrev[k]); gPrev[k] = v3.copy(g.char.pos); });
  if (game.escalation !== 0) fail(`alarm level ${game.escalation} during attract`);
  if (game.guards.some((g: any) => g.state !== 'patrol')) fail(`a guard left patrol during attract: ${game.guards.map((g: any) => `${g.callsign}:${g.state}`).join(' ')}`);
});
const order = seen.join(','), want = [...shots.keys(), 0, 1].slice(0, seen.length).join(',');
if (!order.startsWith([...shots.keys()].join(','))) fail(`vantages visited [${order}], want every one in order [${[...shots.keys()].join(',')}] then the loop`);
if (attract.loops < 1) fail(`never looped (loops ${attract.loops} after ${f2(total + HOLD + 1)} s)`);
for (let k = 1; k < enterT.length && k < shots.length; k++) { const held = enterT[k] - enterT[k - 1], dur = shots[seen[k - 1]].dur ?? HOLD; if (Math.abs(held - dur) > DT + 1e-6) fail(`shot ${seen[k - 1]} (${shots[seen[k - 1]].title}) held ${f2(held)} s, authored ${dur}`); }
if (maxFadeCut < 0.95) fail(`the veil only reached ${f2(maxFadeCut)} at a cut (cuts must be under black)`);
if (walked < 20) fail(`the guards walked ${f2(walked)} m in ${f2(total)} s — the patrols are not running behind the card`);
if (game.mission.stats.elapsed !== missionElapsed0) fail(`the mission clock moved during attract: ${missionElapsed0} → ${game.mission.stats.elapsed}`);
if (game.mission.stats.sandbox) fail('the mission got the sandbox flag during attract (playerInvisible leaked into a live mission)');
info(`visited [${order}] (want prefix [${want}]), loops ${attract.loops}; guards walked ${f2(walked)} m; veil at cuts ≥ ${f2(maxFadeCut)}, clear mid-hold ≥ ${f2(minFadeMid)}`);

// ---- 4. a poke while live: everything back at once, and the refresh hook called exactly once
const shotBefore = attract.shotI; const stopsBefore = stops;
attract.poke();
if (attract.active || attract.live || attract.fade !== 0) fail(`poke: still active ${attract.active} / live ${attract.live} / fade ${attract.fade}`);
if (stops !== stopsBefore + 1) fail(`poke while live: onStop called ${stops - stopsBefore}× (want exactly once — main.ts re-seeds the passes' history and uploads the fresh encounter there)`);
if (!sameFlags(flagsNow(), flags0)) fail(`poke: flags not restored — ${JSON.stringify(flagsNow())} (before ${JSON.stringify(flags0)})`);
if (!camUntouched()) fail(`poke: camera not restored — yaw ${f2(cam.yaw / DEG)}° (was ${f2(cam0.yaw / DEG)}°) pitch ${f2(cam.pitch / DEG)}° dist ${f2(cam.distance)}/${f2(cam.desiredDistance)} (was ${cam0.dist})`);
if (v3.distXZ(game.player.char.pos, spawn) > 0.05) fail(`poke: Sam at (${f2(game.player.char.pos[0])}, ${f2(game.player.char.pos[2])}), not the insertion point (${spawn[0]}, ${spawn[2]})`);
if (v3.distXZ(cam.target, game.player.char.pos) > 0.05) fail(`poke: camera target (${f2(cam.target[0])}, ${f2(cam.target[2])}) not on Sam`);
const badG = game.guards.filter((g: any) => g.state !== 'patrol' || g.hold || g.pinned || g.script || g.awareness > 0.01 || v3.distXZ(g.char.pos, level.routes[g.routeI].points[0]) > 0.05);
if (badG.length) fail(`poke: guards not fresh on their marks: ${badG.map((g: any) => `${g.callsign}:${g.state}@(${f2(g.char.pos[0])},${f2(g.char.pos[2])})`).join(' ')}`);
for (const d of game.doors.list) if (Math.abs(d.angle - refDoors.get(d.def.name)!) > 1e-3 || d.lockBroken || d.pick) fail(`poke: door ${d.def.name} at ${f2(d.angle)} (authored ${f2(refDoors.get(d.def.name)!)}) broken ${d.lockBroken}`);
for (const [tg, on] of refLights) if (tg.on !== on) { fail(`poke: switch ${tg.name} on=${tg.on} (authored ${on})`); break; }
if (game.mission.stage !== 'infiltrate' || game.mission.stats.elapsed !== 0 || game.mission.stats.sandbox) fail(`poke: mission not fresh — stage ${game.mission.stage} elapsed ${game.mission.stats.elapsed} sandbox ${game.mission.stats.sandbox}`);
if (game.items.items.length || game.events.length) fail(`poke: ${game.items.items.length} items / ${game.events.length} sound events survive`);
{ const gAt = game.guards.map((g: any) => v3.copy(g.char.pos)); run(1.5);   // and the card is frozen again straight away: nothing steps on behind it
  if (game.guards.some((g: any, k: number) => v3.distXZ(g.char.pos, gAt[k]) > 1e-6)) fail('the world kept running behind the card after the poke'); }
info(`poked in shot ${shotBefore}: restored (camera yaw ${f2(cam.yaw / DEG)}°, dist ${f2(cam.distance)}, Sam at (${f2(game.player.char.pos[0])}, ${f2(game.player.char.pos[2])}), guards ${game.guards.map((g: any) => g.state).join('/')}), onStop ×${stops - stopsBefore}`);

// ---- 5. it comes back after another IDLE_SECS — and a poke DURING the opening beat only drops the veil: nothing to put back, no refresh hook
run(IDLE - 1.5 - 0.5); if (attract.active) fail('restarted early after the poke');
if (!untilActive(0.6)) fail('did not restart after another idle stretch'); else info(`restarted at t=${f2(t)} s`);
{ run(VEIL_UP * 0.5);   // half-way up the veil
  if (!attract.active || attract.live) fail(`expected the opening beat half-way (active ${attract.active}, live ${attract.live}, veil ${f2(attract.fade)})`);
  const veilAt = attract.fade, stopsMid = stops, gAt = game.guards.map((g: any) => v3.copy(g.char.pos));
  attract.poke();
  if (attract.active || attract.fade !== 0) fail(`poke in the opening beat: still active ${attract.active} / veil ${attract.fade}`);
  if (stops !== stopsMid) fail(`poke in the opening beat called onStop ${stops - stopsMid}× (nothing had gone live: want 0)`);
  if (!sameFlags(flagsNow(), flags0) || !camUntouched() || v3.distXZ(game.player.char.pos, spawn) > 0.05) fail(`poke in the opening beat left something changed: flags ${JSON.stringify(flagsNow())}, cam yaw ${f2(cam.yaw / DEG)}° dist ${f2(cam.distance)}, Sam at (${f2(game.player.char.pos[0])}, ${f2(game.player.char.pos[2])})`);
  if (game.guards.some((g: any, k: number) => v3.distXZ(g.char.pos, gAt[k]) > 1e-6)) fail('poke in the opening beat: a guard had moved');
  info(`poked in the opening beat at veil ${f2(veilAt)}: veil dropped, nothing else to undo, onStop ×${stops - stopsMid}`); }

// ---- 6. once more from idle, through the opening into the programme; canRun → false mid-programme stops it just the same (hook once); the frozen card afterwards stays frozen
run(IDLE - 0.5); if (attract.active) fail('restarted early after the opening-beat poke');
if (!untilActive(0.6)) fail('did not restart a third time');
{ const took = watchOpening('reopening'); if (took < 0) fail('never went live on the third start'); else if (Math.abs(took - (VEIL_UP + 2 * DT)) > DT + 1e-6) fail(`the third opening took ${f2(took)} s (want ${f2(VEIL_UP + 2 * DT)}: the rise, the frame that reaches black, the held black frame)`); }
run(3);
if (!attract.live) fail('not live 3 s into the third programme');
{ const stopsLive = stops;
  allowed = false; step();
  if (attract.active || attract.live) fail('canRun → false did not stop it');
  if (stops !== stopsLive + 1) fail(`canRun stop while live: onStop called ${stops - stopsLive}× (want exactly once)`);
  if (v3.distXZ(game.player.char.pos, spawn) > 0.05 || !sameFlags(flagsNow(), flags0)) fail(`canRun stop: Sam at (${f2(game.player.char.pos[0])}, ${f2(game.player.char.pos[2])}), flags ${JSON.stringify(flagsNow())}`);
  const gAt = game.guards.map((g: any) => v3.copy(g.char.pos)); run(2);
  if (game.guards.some((g: any, k: number) => v3.distXZ(g.char.pos, gAt[k]) > 1e-6)) fail('the world kept running behind the card after attract stopped');
  allowed = true; attract.poke(); }

console.log(`\n=== attract: ${failures.length ? `FAIL (${failures.length})` : 'PASS'} · ${shots.length} vantages: ${shots.map((s: any) => s.title).join(' → ')} · onStop ×${stops} · ${frame} frames (${f2(t)} s sim) ===`);
for (const f of failures) console.log(`  FAIL ${f}`);
process.exit(failures.length ? 1 : 0);
