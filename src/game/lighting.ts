// Lights as game objects: switchable fixtures and their groups, the OCP, the mains breaker (blackout / restrike / beacons / a guard sent to reset it), light events into the hearing model.
// (Split out of game.ts mechanically: plain functions taking the Game as their first argument; Game keeps one-line delegators for
//  anything other files call.)
import { Vec3, v3 } from '../math/vec';
import { missionLive } from './mission';
import { chronBlackout, chronOcp, fixtureName } from './chronicle';
import type { Game, Guard, LightTarget } from './game';
import { lightFromDef } from '../render/lights';
import type { RtLight } from '../render/lights';

export function updateTargets(g: Game, dt: number) {
  const time = g.time;
  const bo = g.blackout;
  if (bo.active && !bo.permanent && time >= bo.until) g.endBlackout();   // (the OCP's timed trip running out; a hand-thrown breaker is given a day — below — so in practice only a guard's reset or Sam's own re-arm ends it)
  // a guard who reaches the (intact) panel resets it after fumbling for a moment
  if (bo.active && !bo.permanent && time - bo.since > 3) {
    const bp = g.level.breaker.pos; let near: Guard | null = null;
    for (const gd of g.guards) if (gd.state !== 'dead' && !gd.held && Math.hypot(gd.char.pos[0] - bp[0], gd.char.pos[2] - (bp[2] - 0.6)) < 1.3) near = gd;   // (a man in Sam's arm walked past the panel resets nothing — review finding)
    g.breakerFixT = near ? g.breakerFixT + dt : 0;
    if (g.breakerFixT > 2.2 && near) { g.say(near, "breaker's back in", true); g.endBlackout(); }
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
  if (!bo.active) bo.since = g.time;
  bo.active = true; bo.permanent = permanent; bo.until = permanent ? Infinity : Math.max(bo.until, g.time + seconds);
  g.audio.play('powerDown', g.level.breaker.pos, 1.0); g.audio.play('powerDown', null, 0.35);
  g.msg(cause === 'shot' ? 'breaker destroyed — mains gone for good' : cause === 'hand' ? 'breaker thrown — emergency lighting until someone resets it' : 'mains tripped — emergency lighting');
  if (cause !== 'debug' && missionLive(g)) { g.mission.stats.blackout = true; chronBlackout(g, cause); }   // the player's own doing (OCP / round / his hand on it), not the panel button or the tour — and a row + pin for the debrief
  // guards: everyone gets edgy; the nearest one goes to check the breaker
  let best: Guard | null = null, bd = 1e9;
  for (const gd of g.guards) {
    if (gd.state === 'dead') continue;
    if (gd.state === 'patrol') { gd.awareness = Math.max(gd.awareness, 0.34); gd.reactT = 1.0 + Math.random(); }
    const d = v3.dist(gd.char.pos, g.level.breaker.pos); if (d < bd && gd.state !== 'alert' && !gd.held) { bd = d; best = gd; }   // (nor is the errand handed to the man Sam is holding)
  }
  if (best && !best.task) {
    const goal: Vec3 = [g.level.breaker.pos[0] - 0.4, 0, g.level.breaker.pos[2] - 0.9];
    best.task = { kind: 'breaker', pos: goal }; best.lastKnown = v3.copy(goal); best.awareness = Math.max(best.awareness, 0.42);
    if (best.state === 'patrol') { best.state = 'suspicious'; best.reactT = 1.2; best.searchT = 0; }
    g.say(best, "power's out — checking the breaker", true); g.audio.play('radio', best.char.pos, 0.6);
  }
}

export function endBlackout(g: Game) {
  const bo = g.blackout; if (!bo.active) return;
  bo.active = false; bo.permanent = false; bo.until = -1; bo.restoredAt = g.time; g.breakerFixT = 0;
  g.audio.play('powerUp', g.level.breaker.pos, 1.0); g.audio.play('powerUp', null, 0.3); g.msg('mains restored');
  for (const gd of g.guards) if (gd.task?.kind === 'breaker') gd.task = null;
}

export function lightEvent(g: Game, t: LightTarget, cause: 'ocp' | 'shot' = 'shot') {
  g.events.push({ kind: 'lightOut', pos: [t.pos[0], 0, t.pos[2]], time: g.time, loud: false, from: v3.copy(t.pos), cause });   // (from: the fixture itself, up where it hangs — what a man's eye needs a line to before a light going out is a thing he SAW: guards.ts lightOutSeen)
}

/** Is there something under the reticle the OCP would act on right now? The snapped fixture / breaker (Game.aimTarget — even one that is off: pressing then says
 *  so), or the man the ring sits on IF a light of his is burning (his torch on patrol, his weapon light drawn: electronics like any fixture). A man with no light
 *  on is nothing to the OCP: no affordance on the ring (overlay.ts), and the right button does nothing there (player.ts) — not a click, not a line, not a charge. */
export function ocpable(g: Game): boolean {
  if (g.aimTarget) return true;
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
    if (g.col.segmentBlocked(eye, v3.add(t.pos, [0, 0, -0.18]))) { g.msg('OCP: no line of sight to the breaker'); g.audio.play('deny', null, 0.5); return; }
    if (g.blackout.active) { g.msg('mains already down'); g.audio.play('deny', null, 0.5); return; }
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
interface DayState { targets: Map<LightTarget, boolean>; lightsOff: RtLight[]; sky: { zenith: Vec3; horizon: Vec3 }; haze: number; exposure: number; sun: RtLight; blackout: { active: boolean; permanent: boolean; until: number; since: number } | null; }
const dayStates = new WeakMap<Game, DayState>();
/** Is the daytime variant in (setDaylight)? */
export function isDaylight(g: Game): boolean { return dayStates.has(g); }
export function sunOf(g: Game): RtLight | null { return dayStates.get(g)?.sun ?? null; }   // (the wind lane's moths ask which lamp heads are lit at night; the tools lane had removed it as unused the same night)
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
    const bo = g.blackout; const blackout = bo.active && bo.permanent ? { active: true, permanent: true, until: bo.until, since: bo.since } : null;   // (recorded BEFORE it is lifted, and only the PERMANENT one — the breaker shot to scrap: nothing the show does can mend that, so Off puts it back; a timed trip lifted here is simply over, as if the man sent to the panel had got there — tools/qa breach-daylight holds that half)
    if (bo.active) { g.endBlackout(); bo.restoredAt = -100; for (const t of g.targets) t.disabledUntil = -1; }   // (an INSTANT restore for the show: no staggered restrike, no beacons sweeping the 'every fluorescent on' establishing shot — review 08-10 #8)
    const st: DayState = { targets: new Map(), lightsOff: [], sky: { zenith: v3.copy(S.skyZenith), horizon: v3.copy(S.skyHorizon) }, haze: S.hazeDensity, exposure: S.exposure, sun: L.add(lightFromDef(D.sun)), blackout };
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
    g.engine.invalidateWorldCache?.();   // (as above, the other way: no grid — live or parked — carries the day's field into the night)
  }
}

export function toggleTarget(g: Game, t: LightTarget) { t.on = !t.on; t.broken = false; }

/** All fixtures repaired, OCP timers cleared, mains back (panel 'repair' + encounter restart). */
export function repairLights(g: Game) { for (const t of g.targets) { t.broken = false; t.disabledUntil = -1; } if (g.blackout.active) g.endBlackout(); }

/** 0 while a fixture has no supply, then the fluorescent restrike flicker for 1.2 s after `since`, then 1. */
export function supply(time: number, darkUntil: number): number {
  if (time < darkUntil) return 0;
  if (time < darkUntil + 1.2) { const x = (time - darkUntil) / 1.2; const s = Math.sin(time * 45) * Math.sin(time * 13.7 + 1.3); return s > 0.65 - x * 0.9 ? 1 : 0.05; }
  return 1;
}
