// Lights as game objects: switchable fixtures and their groups, the OCP, the mains breaker (blackout / restrike / beacons / a guard sent to reset it), light events into the hearing model.
// (Split out of game.ts mechanically: plain functions taking the Game as their first argument; Game keeps one-line delegators for
//  anything other files call.)
import { SideMap } from '../math/side';
import { Vec3, v3 } from '../math/vec';
import { leverHands } from './handwork';
import { missionLive } from './mission';
import { chronBlackout, chronOcp, fixtureName } from './chronicle';
import type { Game, Guard, LightTarget } from './game';
import { lightFromDef } from '../render/lights';
import type { RtLight } from '../render/lights';
import { hourOf, applyHour, sunStrength, sunGiven, setSunStrength, type HourId } from './hours';
import { isHostile } from './teams';
import { WORDS, w } from './words';   // (a leaf: the dialogue pass's one switch)
import { breakerErrand, workNotHis, workStaysPut } from './workthings';   // (a teammate neither takes the breaker errand nor re-arms it on his own, with that module's switch on)
import { powerOut, powerOutMan } from './powerout';   // (the room fight's defenders answer a blackout by that module's rule: its switch off, both are a return on their first line)
import { carLampPaint, deadLamp } from './carlamps';   // a broken vehicle lamp's paint; a dark lens breaking is no light going out (a leaf)
import { simRandom } from '../math/dice';   // the simulation's die (math/dice.ts): the Game's own when it has one, Math.random otherwise

/** A WEAPON LIGHT STOPS AT A WALL. A man's light is a light AT ITS LENS — on the carbine's handguard, under the pistol's rail, at the hand torch's glass — and a man
 *  pressed to a wall (stacked on a door, crossing its frame, backed into a corner) has the reach to carry that lens into the wall or out through its far face: a
 *  shadow ray stops a few centimetres short of the emitter it is cast at, so a light that close to the far face lit the room beyond, and to the CPU's light
 *  estimate the men in it. Rounds have their own rule for the pressed muzzle (combat.ts armThrough); this is the light's, and it asks more: any leaf and an
 *  intact pane stop the LENS too (the light then shines through the pane from this side, as light does).
 *  `gap` = how far short of the surface the EDGE of the emitter (lens + its radius) is kept, metres. Off = the light at its lens wherever that is, as it was —
 *  the table's own value, so a host that never says otherwise is unchanged. The page turns it on (src/host/profile.ts pageSwitches; ?nolightwall = off) and so
 *  does the harness's shipped stand; its frozen stand holds it off (src/host/standup.ts; TPS_LIGHTWALL=1 turns it on there). */
export const LIGHTWALL = { on: false, gap: 0.03 };
/** QA: how many wall tests the rule made, how many pulled a light back, and the furthest one was pulled (m) — tools/qa/lightwall-watch.ts reads it; nothing in the game does */
export const LENS_STATS = { asked: 0, pulled: 0, maxBack: 0 };
const LENS_FROM = new SideMap<RtLight, Vec3>('lighting.LENS_FROM');   // a carried light → what its lens hung off when it was last placed (lensRecheck asks again from there)
const LENS_SLANT = 0.3;   // the least |cos| between the line and the surface's normal the pull-back divides by (a grazing line is not chased back to the shoulder)
/** Where a carried light is, given where its lens is drawn: `lens` itself unless a wall or a door leaf stands between `from` (the gun shoulder; a dropped
 *  torch's own body) and the emitter — then pulled back along that line until the whole emitter (`radius`) is `gap` short of the surface, never behind `from`.
 *  One collision ray over the statics and the leaves (collision.ts raycast; loose furniture is not asked, as for rounds), cast far enough past the lens that
 *  the pull-back begins at nothing and grows as he closes on a slanted wall — it never jumps. The beam's direction is the caller's and is left alone.
 *  `light`: remembered with its `from` for lensRecheck. */
export function lensClear(g: Game, from: Vec3, lens: Vec3, radius: number, light?: RtLight): Vec3 {
  if (!LIGHTWALL.on) return lens;
  if (light) LENS_FROM.set(light, from);
  const d = v3.sub(lens, from); const L = v3.len(d); if (L < 1e-3) return lens;
  const rd = v3.scale(d, 1 / L), keep = Math.max(0, radius) + LIGHTWALL.gap;
  LENS_STATS.asked++;
  const h = g.col.raycast(from, rd, L + keep / LENS_SLANT); if (!h) return lens;
  const t = h.t - keep / Math.max(LENS_SLANT, Math.abs(v3.dot(rd, h.n)));   // (the emitter's edge `gap` off the surface along its normal)
  if (t >= L - 1e-6) return lens;
  LENS_STATS.pulled++; LENS_STATS.maxBack = Math.max(LENS_STATS.maxBack, L - Math.max(0, t));
  return v3.mad(from, rd, Math.max(0, t));
}
/** …and once more after the doors have moved (game.ts, right after updateDoors): the men were placed against last frame's leaves, and a leaf that swung onto
 *  the line this frame would have the light beyond it for that frame. Only burning carried lights, from where each was placed; nothing with the rule off. */
export function lensRecheck(g: Game): void {
  if (!LIGHTWALL.on) return;
  const one = (L: RtLight) => { const from = LENS_FROM.get(L); if (from && L.enabled) L.pos = lensClear(g, from, L.pos, L.radius); };
  for (const gd of g.guards) one(gd.flashlight);
  one(g.player.light);
}

/** words.ts: the mains are the business of the side whose building it is — one of Sam's own teammates neither walks off to the breaker Sam threw nor puts it back in and
 *  says so on the net (the switch off: any living man, as it was) */
const theirMains = (gd: Guard) => !WORDS.on || isHostile(gd.team, 'player');
/** THE re-arm's gate for one man: the mains out by a trip he can undo, a few seconds old, and he — alive, not in Sam's arm (a man walked past the panel in
 *  it resets nothing — review finding) — within its reach of the panel's front. Read by the reset below and by handwork.ts (his step up to the lever). */
export function breakerResetNear(g: Game, gd: Guard): boolean {
  const bo = g.blackout, bp = g.level.breaker.pos;
  if (!(bo.active && !bo.permanent && g.time - bo.since > 3 && gd.state !== 'dead' && !gd.held)) return false;
  const E = breakerErrand(g), p = gd.char.pos;   // (workthings.ts: the reach in front of the panel's own face, and nothing solid between him and it — the fixed offset below reached through the wall a panel hangs on wherever it does not face the way the office's does)
  // (within a stride of the errand's own spot counts too: a walk ends on a nav cell's centre, which can be a step short of it)
  if (E) return (Math.hypot(p[0] - E.mid[0], p[2] - E.mid[2]) < 1.3 || Math.hypot(p[0] - E.goal[0], p[2] - E.goal[2]) < 0.7) && !g.col.solidBlocked([p[0], 1.0, p[2]], E.at);
  return Math.hypot(gd.char.pos[0] - bp[0], gd.char.pos[2] - (bp[2] - 0.6)) < 1.3;
}

export function updateTargets(g: Game, dt: number) {
  const time = g.time;
  const bo = g.blackout;
  if (bo.active && !bo.permanent && time >= bo.until) g.endBlackout();   // (the OCP's timed trip running out; a hand-thrown breaker is given a day — below — so in practice only a guard's reset or Sam's own re-arm ends it)
  // a guard who reaches the (intact) panel resets it after fumbling for a moment
  if (bo.active && !bo.permanent && time - bo.since > 3) {
    let near: Guard | null = null;
    for (const gd of g.guards) if (breakerResetNear(g, gd) && theirMains(gd) && !workNotHis(gd)) near = gd;   // (words.ts: the mains are their side's business; workthings.ts: not a teammate sent to the breaker — both gates at the loop, not inside breakerResetNear, which handwork.ts reads too)
    g.breakerFixT = near ? g.breakerFixT + dt : 0;
    const fumble = g.level.breaker.fumble ?? 2.2;   // (the level's own number where it gives one: a panel a man is long at)
    if (near) leverHands(g, near.char, g.breakerFixT, fumble);   // (handwork.ts: his hand on the lever while he fumbles with it)
    if (g.breakerFixT > fumble && near) { g.say(near, w("breaker's back on", "breaker's back in"), true); g.endBlackout(); }
  }
  // emergency beacons: spin up ~0.8 s after the trip, keep turning for a second after power returns; each is slaved to its dome fixture
  const beaconsOn = bo.active ? time - bo.since > 0.8 : time - bo.restoredAt < 1.2;
  for (const b of g.beacons) {
    b.target.on = beaconsOn;
    b.light.enabled = beaconsOn && b.target.factor > 0;              // shot-out / OCP'd dome → no beam either (factor is last frame's)
    const a = time * 3.3 + b.phase;                                   // ceiling-hung: full rotation about the vertical, tilted down
    b.light.dir = v3.normalize([Math.cos(a), -0.5, Math.sin(a)]);
    b.light.intensity = b.light.peakIntensity;
  }
  for (const t of g.targets) {
    let f = t.on && !t.broken ? 1 : 0;
    if (f > 0 && t.disabledUntil > 0) { f *= supply(time, t.disabledUntil); if (time > t.disabledUntil + 1.2) t.disabledUntil = -1; }   // OCP knock-out + restrike
    if (f > 0 && t.mains) f *= bo.active ? 0 : supply(time, bo.restoredAt + t.stagger);                                             // building supply
    if (f > 0 && t.fluorescentFlicker) {
      const s = Math.sin(time * 3.1) + Math.sin(time * 7.3 + 2) * 0.6; // occasional dropout bursts
      if (s > 1.15) f *= (Math.sin(time * 90) > 0 ? 0.15 : 1);
    }
    t.factor = f;
    if (t.lens) carLampPaint(g, t);   // (carlamps.ts: a broken vehicle lamp's box painted dark, a whole one as the level has it)
    if (t.kind === 'breaker') { const e: Vec3 = t.broken ? [0, 0, 0] : bo.active ? [5, 0.3, 0.1] : [0.3, 4, 0.6]; for (const bi of t.boxes) g.engine.world.statics[bi].emissive = e; continue; }
    if (t.kind === 'analytic' && t.light) { t.light.enabled = f > 0.001; t.light.intensity = t.baseIntensity * f; }
    if (t.areaLights) { const es = g.engine.settings.emissiveScale; for (const al of t.areaLights) { al.light.enabled = f > 0.001; al.light.intensity = al.light.peakIntensity = al.base * f * es; } }
    for (const bi of t.boxes) { const b = g.engine.world.statics[bi]; b.emissive = [t.baseEmissive[0] * f, t.baseEmissive[1] * f, t.baseEmissive[2] * f]; b.markGain = f; }   // (markGain: the box's emissive MARKINGS follow the same supply — the vending window in a blackout, a monitor's UI bars under the OCP)
  }
}

/** Trip the mains: everything fed from the breaker goes dark, emergency beacons spin up. Restrike is staggered per contactor group. */
export function setBlackout(g: Game, seconds: number, cause: 'ocp' | 'shot' | 'debug' | 'hand') {
  const bo = g.blackout; const permanent = !isFinite(seconds);
  if (bo.active && bo.permanent) return;
  const fresh = !bo.active;
  if (!bo.active) bo.since = g.time;
  bo.active = true; bo.permanent = permanent; bo.until = permanent ? Infinity : Math.max(bo.until, g.time + seconds);
  g.audio.play('powerDown', g.level.breaker.pos, 1.0); g.audio.play('powerDown', null, 0.35);
  g.msg(cause === 'shot' ? 'breaker destroyed — power gone for good' : cause === 'hand' ? 'breaker thrown — emergency lighting until someone resets it' : 'power is out — emergency lighting');
  if (cause !== 'debug' && missionLive(g)) { g.mission.stats.blackout = true; chronBlackout(g, cause); }   // the player's own doing (OCP / round / his hand on it), not the panel button or the tour — and a row + pin for the debrief
  // guards: everyone gets edgy; the nearest one goes to check the breaker
  let best: Guard | null = null, bd = 1e9;
  for (const gd of g.guards) {
    if (gd.state === 'dead') continue;
    if (gd.state === 'patrol') { gd.awareness = Math.max(gd.awareness, 0.34); gd.reactT = 1.0 + simRandom(); }
    const d = v3.dist(gd.char.pos, g.level.breaker.pos); if (d < bd && gd.state !== 'alert' && !gd.held && theirMains(gd) && !workNotHis(gd) && !workStaysPut(g, gd) && !powerOutMan(g, gd)) { bd = d; best = gd; }   // (nor is the errand handed to the man Sam is holding, nor — workthings.ts — to one who cannot leave his post: he would say he was going and stand there)
  }
  if (best && !best.task) {
    const E = breakerErrand(g), goal: Vec3 = E ? v3.copy(E.goal) : [g.level.breaker.pos[0] - 0.4, 0, g.level.breaker.pos[2] - 0.9];   // (workthings.ts: floor at the panel's own face where the fixed spot is in a wall or behind one)
    best.task = { kind: 'breaker', pos: goal }; best.lastKnown = v3.copy(goal); best.awareness = Math.max(best.awareness, 0.42);
    if (best.state === 'patrol') { best.state = 'suspicious'; best.reactT = 1.2; best.searchT = 0; }
    g.say(best, "power's out — checking the breaker", true); g.audio.play('radio', best.char.pos, 0.6);
  }
  if (fresh) powerOut(g);   // (powerout.ts: a mission's defenders see the lights die, say what they do about it and then do it)
}

export function endBlackout(g: Game) {
  const bo = g.blackout; if (!bo.active) return;
  bo.active = false; bo.permanent = false; bo.until = -1; bo.restoredAt = g.time; g.breakerFixT = 0;
  g.audio.play('powerUp', g.level.breaker.pos, 1.0); g.audio.play('powerUp', null, 0.3); g.msg('power is back on');
  for (const gd of g.guards) if (gd.task?.kind === 'breaker') gd.task = null;
}

export function lightEvent(g: Game, t: LightTarget, cause: 'ocp' | 'shot' = 'shot', swAt?: Vec3) {
  if (deadLamp(t)) return;   // (carlamps.ts: a vehicle's lens that was dark already — nothing went out for anybody to see)
  g.events.push({ kind: 'lightOut', pos: [t.pos[0], 0, t.pos[2]], time: g.time, loud: false, from: v3.copy(t.pos), cause, ...(swAt ? { swAt: v3.copy(swAt) } : null) });   // (from: the fixture itself, up where it hangs — what a man's eye needs a line to before a light going out is a thing he SAW: guards.ts lightOutSeen)
}

/** Is there something under the reticle the OCP would act on right now? The snapped fixture / breaker (Game.aimTarget — even one that is off: pressing then says
 *  so), or the man the ring sits on IF a light of his is burning (his torch on patrol, his weapon light drawn: electronics like any fixture). A man with no light
 *  on is nothing to the OCP: no affordance on the ring (overlay.ts), and the right button does nothing there (player.ts) — not a click, not a line, not a charge. */
export function ocpable(g: Game): boolean {
  if (g.aimTarget) return !deadLamp(g.aimTarget);   // (carlamps.ts: a vehicle's lens that burns nothing is glass, not electronics)
  const gd = g.aimGuard;
  return !!gd && gd.state !== 'dead' && gd.flashlight.enabled && g.time >= gd.lightDeadUntil;
}

export function ocp(g: Game, t: LightTarget | null) {
  const o = g.player.ocp;
  if (!o.ready()) { g.msg('OCP recharging'); g.audio.play('deny', null, 0.5); return; }
  if (!t) {
    const gd = g.aimGuard;
    if (gd && gd.state !== 'dead') {
      if (!ocpable(g)) return;   // no light of his is burning: nothing to knock out (the caller already keeps the button dead there; this keeps the rule in one place for the hold's path and the harness)
      o.use(); g.audio.play('ocp', g.player.char.muzzle, 1);
      gd.lightDeadUntil = g.time + g.tune.ocpDuration * 0.7; g.msg("OCP → guard's flashlight fried"); chronOcp(g, `${gd.callsign}'s torch`, gd.char.pos);
      if (gd.state === 'patrol') { gd.awareness = Math.max(gd.awareness, 0.32); gd.lastKnown = v3.add(gd.char.pos, v3.scale(gd.char.forward(), 2)); }
      g.audio.play('lightOff', gd.char.pos, 0.6);
      return;
    }
    g.audio.play('deny', null, 0.5); return;   // nothing under the cursor: just the click
  }
  if (t.kind === 'breaker') {
    const eye = g.player.char.bones.head ?? v3.add(g.player.char.pos, [0, 1.6, 0]);
    if (g.col.segmentBlocked(eye, v3.add(t.pos, [0, 0, -0.18]))) { g.msg("the OCP can't see the breaker from here"); g.audio.play('deny', null, 0.5); return; }
    if (g.blackout.active) { g.msg('power is already off'); g.audio.play('deny', null, 0.5); return; }
    o.use(); g.audio.play('ocp', g.player.char.muzzle, 1); g.setBlackout(g.tune.ocpDuration * 2.5, 'ocp'); return;
  }
  if (t.factor <= 0) { g.msg(`OCP: ${t.name} already off`); return; }
  o.use();
  g.audio.play('ocp', g.player.char.muzzle, 1);
  t.disabledUntil = g.time + g.tune.ocpDuration; g.msg(`OCP → ${t.name} disabled`); if (t.kind !== 'device') g.lightEvent(t, 'ocp'); chronOcp(g, fixtureName(t), t.pos);   // (a camera's or a laser's LED winking out is nothing a man across the floor sees: no event for a device)
  g.audio.play('lightOff', t.pos, 0.7);
}

// ------------------------------------------------------------ lights
export function setGroup(g: Game, group: string, on: boolean) { for (const t of g.targets) if (t.group === group) t.on = on; }

// ------------------------------------------------------------ daylight (the breach showcase's variant: level.ts DaylightDef)
/** What setDaylight(true) found and must put back: every target's switch, the level lights it disabled, the sky, the haze, a PERMANENT blackout it lifted for the
 *  show (the breaker SHOT is mains gone for good, not until ten in the morning: review A6.8 — a timed trip it lifted stays lifted) — and the sun it added. */
interface DayState { hour: HourId; hourSunK: number; hourSunGiven: boolean; targets: Map<LightTarget, boolean>; lightsOff: RtLight[]; sky: { zenith: Vec3; horizon: Vec3 }; haze: number; exposure: number; sun: RtLight; blackout: { active: boolean; permanent: boolean; until: number; since: number } | null; }
const dayStates = new SideMap<Game, DayState>('lighting.dayStates');
/** Is the daytime variant in (setDaylight)? */
export function isDaylight(g: Game): boolean { return dayStates.has(g); }
/** Swap the level's daytime variant in (on) or back out (off): level.daylight — a directional sun added to the light set, the sky lifted, the listed fixture groups
 *  lit and the street lighting / moon out, the haze raised, the exposure opened up; the mains restored first if they were down (a blackout at ten in the morning
 *  is another show). Off restores exactly what On recorded — every switch as it stood (not as authored: a fixture the player shot stays shot, one he switched off
 *  comes back off), the disabled lights, sky, haze, exposure — and takes the sun out of the set again, so a true → false round trip leaves the light list and the
 *  frame's sky bit for bit as they were (tools/qa probes 'breach-daylight'). Idempotent both ways; a level without a daylight block ignores it. */
export function setDaylight(g: Game, on: boolean) {
  const D = g.level.daylight, S = g.engine.settings, L = g.engine.lights;
  const cur = dayStates.get(g);
  if (on) {
    if (cur || !D) return;
    const hour = hourOf(g), hourSunK = sunStrength(g), hourSunGiven = sunGiven(g); if (hour !== 'night') applyHour(g, 'night');   // a level started at another hour (hours.ts): the show's day is laid over the level's own night, and that hour comes back with it below
    const bo = g.blackout; const blackout = bo.active && bo.permanent ? { active: true, permanent: true, until: bo.until, since: bo.since } : null;   // (recorded BEFORE it is lifted, and only the PERMANENT one — the breaker shot to scrap: nothing the show does can mend that, so Off puts it back; a timed trip lifted here is simply over, as if the man sent to the panel had got there — tools/qa breach-daylight holds that half)
    if (bo.active) { g.endBlackout(); bo.restoredAt = -100; for (const t of g.targets) t.disabledUntil = -1; }   // (an INSTANT restore for the show: no staggered restrike, no beacons sweeping the 'every fluorescent on' establishing shot — review 08-10 #8)
    const st: DayState = { targets: new Map(), lightsOff: [], sky: { zenith: v3.copy(S.skyZenith), horizon: v3.copy(S.skyHorizon) }, haze: S.hazeDensity, exposure: S.exposure, sun: L.add(lightFromDef(D.sun)), blackout, hour, hourSunK, hourSunGiven };
    g.buildDirReach(st.sun);   // the sun's directional reach mask (which indoor cells see the sky its way): the ReSTIR estimator's candidate domain
    for (const t of g.targets) st.targets.set(t, t.on);
    for (const grp of D.groupsOn) setGroup(g, grp, true);
    for (const grp of D.groupsOff) setGroup(g, grp, false);
    for (const l of L.lights) if (D.lightsOff.includes(l.name) && l.enabled) { l.enabled = false; st.lightsOff.push(l); }
    S.skyZenith = v3.copy(D.sky.zenith); S.skyHorizon = v3.copy(D.sky.horizon); S.hazeDensity = D.haze; S.exposure = D.exposure;
    dayStates.set(g, st);
    g.engine.invalidateWorldCache?.();   // the light rig swapped wholesale: the radiance cache (live AND parked grids) re-primes and snaps to the day instead of blending night → day over seven frames — and a parked grid cannot bring the night back on a later ladder hop (review R10.1; the stub engines of tools/qa have none)
  } else {
    if (!cur) return;
    for (const [t, was] of cur.targets) t.on = was;
    for (const l of cur.lightsOff) l.enabled = true;
    S.skyZenith = v3.copy(cur.sky.zenith); S.skyHorizon = v3.copy(cur.sky.horizon); S.hazeDensity = cur.haze; S.exposure = cur.exposure;
    L.remove(cur.sun);
    const B = cur.blackout;
    if (B && !g.blackout.active) { const bo = g.blackout; bo.active = true; bo.permanent = true; bo.until = B.until; bo.since = B.since; g.breakerFixT = 0; }   // a destroyed breaker is still destroyed: the blackout back quietly (no second power-down thump, no man sent again — the round that did that already happened); a restart straight after (the breach's restore, a checkpoint load) mends it as a restart always did
    dayStates.delete(g);
    if (cur.hour !== 'night') { applyHour(g, cur.hour); setSunStrength(g, cur.hourSunK, cur.hourSunGiven); }
    g.engine.invalidateWorldCache?.();   // (as above, the other way: no grid — live or parked — carries the day's field into the night)
  }
}

export function toggleTarget(g: Game, t: LightTarget) { t.on = !t.on; t.broken = false; }

/** All fixtures repaired, OCP timers cleared, mains back (panel 'repair' + encounter restart). */
export function repairLights(g: Game) { for (const t of g.targets) { t.broken = false; t.disabledUntil = -1; } if (g.blackout.active) g.endBlackout(); }

/** A RESTART'S LIGHTS (cleanrestart.ts): the level's lights as a level just opened has them, from this tick — every fixture whole, no OCP timer running, the mains
 *  in with no restrike left to play and no beacon left turning (`restoredAt` and `since` as a new Game has them), nothing said and nothing sounded. The switches
 *  themselves are resetLevelState's and lightswitch.ts's, as before. Returns whether anything was out. */
export function freshLights(g: Game): boolean {
  const bo = g.blackout; let was = bo.active || g.time - bo.restoredAt < 4;   // (4 s: past the last contactor group's restrike)
  for (const t of g.targets) { if (t.broken || t.disabledUntil > 0) was = true; t.broken = false; t.disabledUntil = -1; }
  bo.active = false; bo.permanent = false; bo.until = -1; bo.since = -1; bo.restoredAt = -100; g.breakerFixT = 0;   // (no man is on his way to the breaker: the restart has just made fresh ones)
  return was;
}

/** 0 while a fixture has no supply, then the fluorescent restrike flicker for 1.2 s after `since`, then 1. */
export function supply(time: number, darkUntil: number): number {
  if (time < darkUntil) return 0;
  if (time < darkUntil + 1.2) { const x = (time - darkUntil) / 1.2; const s = Math.sin(time * 45) * Math.sin(time * 13.7 + 1.3); return s > 0.65 - x * 0.9 ? 1 : 0.05; }
  return 1;
}
