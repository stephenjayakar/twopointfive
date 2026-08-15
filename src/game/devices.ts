// The level-design devices (STATUS G4, docs/level-format.md 'Devices'): wall CAMERAS that see Sam through the guards' own eye test and light meter and call the
// floor's radio, KEYPADS on doors whose code Sam has to learn before the pad takes it, LASER tripwires that call the radio when something breaks them. All three
// are authored in LevelData.devices (scene/levelData.ts DeviceData → Level.devices); everything they show — a camera's body, lens and LED, a pad's plate and
// LED, a beam's emitter, receiver and the beam itself — is drawn HERE from the record as dynamic boxes (nothing of them is in `boxes`), and cameras / emitters
// are light TARGETS (game.ts LightTarget kind 'device') so the pistol's OCP blinds them for its spell, a round kills them for the encounter, and the mains-fed
// ones die in a blackout and come back with the restrike — lighting.ts updateTargets works their `factor` out with everybody else's; this file only reads it.
//
// ONE MODEL. A camera's picture is the guards' eye (guards.ts eyeContact: cone, reach, the line to chest and head through statics and leaves, the smoke marched
// between lens and chest by the same probe segment a guard's eye gets) and its exposure is Sam's light meter (Player.visibility — dark to you is dark to it):
// lensGain below is sightGain's light × distance × crouch × smoke, without the human parts (motion acuity, an alarmed floor's keenness, a hunter's doubling —
// a lens does not startle; the man at the monitor gets the integrator's seconds instead). A code overheard is heard through the propagation the mixer and the
// guards' ears use (col.sound): out of earshot, nothing learned. Guards never trip their own beams and never mind the cameras.
//
// What a device DOES to the floor goes through what the floor already has: control's radio line (g.msg 'radio: CONTROL — …', the HUD's radio strip), the
// nearest calm man sent to look (a GuardTask 'device' — the rack errand's mechanism: it survives the suspicion decay, he walks there, looks round, talks himself
// out of it), the floor going up a step (guards.ts raiseEscalation cause 'device'), the debrief's chronicle. Live play only (g.aiEnabled, not the tour's
// quietUtility, tune.devices): under the tour they pan and glow and report nothing.
import { Vec3, v3, clamp, lerp, quat } from '../math/vec';
import { Box, BoxFlag, makeBox, MKEY } from '../scene/boxes';
import type { DeviceDef } from '../scene/level';
import { DEVICE_DEFAULTS } from '../scene/levelData';
import type { RtLight } from '../render/lights';
import type { Game, Guard, LightTarget } from './game';
import type { Character } from './character';
import type { Door } from './doors';
import { Doors } from './doors';
import { PLAYER_ID } from './consts';
import { eyeContact, raiseEscalation, escalationOf } from './guards';
import type { Eye } from './guards';
import { beamBoxes } from './combat';
import { chronicle, chronicleN, roomOf } from './chronicle';
import { civilianBodies } from './civilians';

type CameraDef = Extract<DeviceDef, { kind: 'camera' }>;
type KeypadDef = Extract<DeviceDef, { kind: 'keypad' }>;
type LaserDef = Extract<DeviceDef, { kind: 'laser' }>;

// ---------------------------------------------------------------- knobs (the four on Game.tune are the panel's; these are the model's own)
/** lit-seconds drain out of a camera's integrator this fast once Sam is out of its picture (a glimpse and gone is forgotten in a couple of seconds; ducking behind the
 *  desk for a beat does not reset a camera that has been watching you walk toward it) */
const CAMERA_DECAY = 0.5;
/** a camera that has reported him goes quiet for this long before it will report again (control does not narrate every second of the picture), and re-arms once
 *  the integrator has drained AND this has passed */
const CAMERA_REARM_SECS = 20;
/** the LED: dim red idle, bright while the integrator holds anything, blinking fast once it has called him in; dark dead / blind / unpowered */
const LED_IDLE: Vec3 = [1.6, 0.08, 0.05], LED_HOT: Vec3 = [14, 0.7, 0.3];
/** the cone thrown into the haze by a live camera (tune.deviceCones): a faint red spot down its axis — a light slot apiece, no more */
const CONE = { intensity: 1.1, color: [1, 0.12, 0.07] as Vec3, rangeK: 0.7, volumetric: 1.0, outerMaxDeg: 24, radius: 0.12, ahead: 0.1 };   // (radius: a sized emitter — clamps 1/d² so the haze shows a beam leaving the lens, not a hot bead in front of it; ahead: the beam starts at the lens face)   // (a tell, not a floodlight: at 3+ it painted the whole end of the corridor orange — 08-09 page check)
/** a tripwire, once broken, cannot be broken again for this long (one crossing is one report, not sixty) */
const LASER_COOLDOWN = 4;
/** how near the beam's line a body's capsule surface / an item must come to break it (the beam is a few millimetres; the margin is the frame's stride at a sprint) */
const BEAM_MARGIN = 0.02;
/** the keypad: seconds to key the code in (four keys, evenly), how close he must stand to the door to be at its pad, the deny beep's worth to the hearing model */
export const CODE_SECS = 1.2;
const PAD_REACH = Doors.USE_REACH, DENY_LEVEL = 0.05;
/** overhearing a code said aloud (dialogue.ts ambient 'pin' pair → overhear): within this many metres of PATH through the air as col.sound propagates it (round the
 *  corner, through the doorway) and at least this much of it carried (a shut door between them eats it) — the whistle's reach, the other way round */
export const OVERHEAR = { pathM: 9, carry: 0.5 };
/** control's man on the errand: how sharp he arrives (the rack's numbers) */
const ERRAND = { awareness: 0.42, reactT: 1.0 };

// ---------------------------------------------------------------- runtime records
export interface CameraRt {
  def: CameraDef; index: number; target: LightTarget; cone: RtLight | null;
  /** the lens's yaw this frame (pans between def.sweep) and the pan's phase 0‥1 */
  yaw: number; phase: number;
  /** the integrator: lit-seconds of Sam in the picture (lensGain × dt in, CAMERA_DECAY out) */
  seen: number;
  /** idle → suspect (control has radioed, a man is on his way) → alarm (the floor went up); back to idle once drained and re-armed */
  state: 'idle' | 'suspect' | 'alarm'; reportedAt: number;
  /** where the picture last had him (the errand's goal, the alarm's fix) */
  lastSeen: Vec3 | null; sawThisFrame: boolean;
  /** the probe's smoke transmittance lens → Sam's chest (1 headless / until the renderer answers), and the key it is asked under */
  smokeTrans: number; smokeKey: string;
  /** a dead camera has been called in (once per death) */
  deadCalled: boolean;
}
export interface LaserRt {
  def: LaserDef; index: number; target: LightTarget;
  dir: Vec3; len: number;
  /** drawn length this frame (a leaf, a body, a chair in the beam cuts the picture of it short) */
  cut: number;
  lastTripAt: number; trips: number; deadCalled: boolean;
  /** something is breaking it right now (the trip fires on the edge: a man standing in a beam is one report, not one every cooldown) */
  held: boolean;
}
export interface KeypadRt { def: KeypadDef; door: Door; /** the pad's outward normal (plate faces it) */ n: Vec3; }
/** what the QA probes and the panel read: every report a device has made this encounter, newest last */
export interface DeviceLogRow { seq: number; t: number; device: string; what: 'suspicion' | 'alarm' | 'trip' | 'dead' | 'code' | 'overheard' | 'deny'; where: string; sent: string | null; }
/** the devices in a checkpoint (Devices.snapshot / restore — game/savestate.ts) */
export interface DevicesSnap { cameras: { yaw: number; phase: number; seen: number; state: 'idle' | 'suspect' | 'alarm'; reportedAt: number; lastSeen: Vec3 | null; deadCalled: boolean }[]; lasers: { lastTripAt: number; trips: number; deadCalled: boolean; held: boolean }[]; log: DeviceLogRow[]; radioCount: number; seq: number; }

export class Devices {
  cameras: CameraRt[] = []; lasers: LaserRt[] = []; keypads: KeypadRt[] = [];
  private padByDoor = new Map<Door, KeypadRt>();
  log: DeviceLogRow[] = [];
  /** reports ever made (monotonic across the log's cap and restarts: the soak reads rows with seq above what it has seen) and radio lines control has put out this encounter */
  seq = 0; radioCount = 0;
  /** append a report to the log (capped) with its sequence number */
  note(g: Game, r: Omit<DeviceLogRow, 'seq' | 't'>) { this.log.push({ seq: ++this.seq, t: g.time, ...r }); if (this.log.length > 48) this.log.splice(0, this.log.length - 48); }
  constructor(g: Game) {
    const defs = g.level.devices ?? [];
    let ci = 0, li = 0;
    for (const d of defs) {
      if (d.kind === 'camera') {
        const target: LightTarget = { name: d.name, group: d.group ?? DEVICE_DEFAULTS.group, kind: 'device', pos: v3.copy(d.pos), boxes: [], baseEmissive: [0, 0, 0], baseIntensity: 0, on: true, broken: false, disabledUntil: -1, fluorescentFlicker: false, factor: 1, mains: d.mains !== false, interactive: true, stagger: 1.4 + 0.3 * ci };
        g.targets.push(target);
        const half = (d.fovDeg ?? DEVICE_DEFAULTS.fovDeg) / 2;
        const cone = g.engine.lights.add({ name: `${d.name}_cone`, group: 'devices', kind: 1, pos: v3.copy(d.pos), dir: [0, -1, 0], color: v3.copy(CONE.color), intensity: CONE.intensity, range: (d.range ?? DEVICE_DEFAULTS.range) * CONE.rangeK, innerDeg: Math.max(1, Math.min(half, CONE.outerMaxDeg) - 6), outerDeg: Math.min(half, CONE.outerMaxDeg), radius: CONE.radius, volumetric: CONE.volumetric, owner: 0, enabled: false, fixtureBox: -1, flicker: 0, ttl: -1, age: 0, peakIntensity: CONE.intensity });
        this.cameras.push({ def: d, index: ++ci, target, cone, yaw: d.yaw, phase: 0, seen: 0, state: 'idle', reportedAt: -100, lastSeen: null, sawThisFrame: false, smokeTrans: 1, smokeKey: `smokeCam${ci}`, deadCalled: false });
      } else if (d.kind === 'laser') {
        const target: LightTarget = { name: d.name, group: d.group ?? DEVICE_DEFAULTS.group, kind: 'device', pos: v3.copy(d.from), boxes: [], baseEmissive: [0, 0, 0], baseIntensity: 0, on: true, broken: false, disabledUntil: -1, fluorescentFlicker: false, factor: 1, mains: d.mains !== false, interactive: true, stagger: 1.1 + 0.3 * li };
        g.targets.push(target);
        const seg = v3.sub(d.to, d.from); const len = v3.len(seg);
        this.lasers.push({ def: d, index: ++li, target, dir: v3.scale(seg, 1 / Math.max(len, 1e-6)), len, cut: len, lastTripAt: -100, trips: 0, deadCalled: false, held: false });
      } else {
        const door = g.doors.byName(d.door);
        if (!door) throw new Error(`keypad '${d.name}': no door '${d.door}'`);   // (the validator has already refused a file where this could happen)
        const K: KeypadRt = { def: d, door, n: [Math.sin(d.yaw), 0, Math.cos(d.yaw)] };
        this.keypads.push(K); this.padByDoor.set(door, K);
      }
    }
  }
  /** the keypad on this door, if it is a keypad door */
  padOf(d: Door): KeypadRt | null { return this.padByDoor.get(d) ?? null; }
  /** dialogue.ts ambient pairs: `speaker` has just said the code of `lockId` aloud (see overhear) — a method so the dialogue reaches it off Game without importing this file */
  overhearSaid(g: Game, speaker: Guard, lockId: string): boolean { return overhear(g, speaker, lockId); }
  /** the keypad whose door stands nearest a floor point (dialogue.ts: the pad two men talking would mean; the one a questioned man gives up) — null on a level with none */
  padNear(p: Vec3): KeypadRt | null { let best: KeypadRt | null = null, bd = Infinity; for (const k of this.keypads) { const dd = v3.distXZ(k.door.frameCentre, p); if (dd < bd) { bd = dd; best = k; } } return best; }
  /** a fresh encounter: integrators, states, trip clocks, the log (the targets themselves are repaired by lighting.ts repairLights with every other fixture) */
  /** for a checkpoint (game/savestate.ts): each camera's pan phase, integrator and report state, each beam's counts and clocks, the log — the light targets they hang
   *  off (alive / OCP'd / shot) travel with the fixtures */
  snapshot(): DevicesSnap {
    return { cameras: this.cameras.map(c => ({ yaw: c.yaw, phase: c.phase, seen: c.seen, state: c.state, reportedAt: c.reportedAt, lastSeen: c.lastSeen ? v3.copy(c.lastSeen) : null, deadCalled: c.deadCalled })),
      lasers: this.lasers.map(l => ({ lastTripAt: l.lastTripAt, trips: l.trips, deadCalled: l.deadCalled, held: l.held })), log: this.log.map(r => ({ ...r })), radioCount: this.radioCount, seq: this.seq };
  }
  restore(g: Game, s: DevicesSnap) {
    this.reset();
    const f = (x: number, d = 0) => Number.isFinite(x) ? x : d;
    s.cameras?.forEach((C, i) => { const c = this.cameras[i]; if (!c || !C) return; c.yaw = f(C.yaw, c.def.yaw); c.phase = f(C.phase); c.seen = Math.max(0, f(C.seen)); c.state = C.state === 'suspect' || C.state === 'alarm' ? C.state : 'idle'; c.reportedAt = f(C.reportedAt, -100); c.lastSeen = C.lastSeen ? v3.copy(C.lastSeen) : null; c.deadCalled = !!C.deadCalled; });
    s.lasers?.forEach((L, i) => { const l = this.lasers[i]; if (!l || !L) return; l.lastTripAt = f(L.lastTripAt, -100); l.trips = L.trips | 0; l.deadCalled = !!L.deadCalled; l.held = !!L.held; });
    this.log = (s.log ?? []).slice(-48).map(r => ({ ...r })); this.radioCount = s.radioCount | 0; this.seq = Math.max(this.seq, s.seq | 0);
    if (g.player.coding) stopCoding(g);
  }
  reset() {
    for (const c of this.cameras) { c.seen = 0; c.state = 'idle'; c.reportedAt = -100; c.lastSeen = null; c.sawThisFrame = false; c.deadCalled = false; c.phase = 0; c.yaw = c.def.yaw; }
    for (const l of this.lasers) { l.lastTripAt = -100; l.trips = 0; l.deadCalled = false; l.held = false; }
    this.log.length = 0; this.radioCount = 0;   // (seq runs on: it is what the soak counts by)
  }
  /** panel / console: one line — every camera's state and integrator, every beam's trips, the codes Sam knows */
  summary(g: Game): string {
    const cams = this.cameras.map(c => `${c.def.name}${alive(c.target) ? '' : ' (dark)'} ${c.state} ${c.seen.toFixed(2)}s${c.sawThisFrame ? ' ◉' : ''}`).join(' · ');
    const las = this.lasers.map(l => `${l.def.name}${alive(l.target) ? '' : ' (dark)'} ×${l.trips}`).join(' · ');
    return `devices ▸ ${g.tune.devices ? '' : 'OFF · '}${cams || 'no cameras'} | ${las || 'no beams'} | codes [${[...g.player.codes].join(' ') || '—'}]`;
  }
}
/** powered, unbroken, not knocked out: the device works this frame (lighting.ts updateTargets has folded on / broken / the OCP / the mains into factor) */
export function alive(t: LightTarget): boolean { return t.factor > 0.05 && !t.broken; }
/** live play: devices SENSE (they are always drawn) — the AI on, not the tour's plumbing, the panel's switch */
function sensing(g: Game): boolean { return g.aiEnabled && !g.quietUtility && !g.touring && g.tune.devices; }   // (touring as well as quietUtility: the tour's hold stop drops quietUtility with Sam lit on the lobby camera's marks — review, qrf.ts live() gates the same way; NOT the puppet — outside the tour a puppet is the QA harness walking him through a beam on purpose)

// ---------------------------------------------------------------- the lens's exposure: sightGain's light × distance × crouch × smoke, nothing human
/** Lit-seconds per second a camera's integrator fills at: the light on Sam through HIS meter (visibility^1.5, sightGain's own curve — dark is dark), the range
 *  falloff rescaled to the lens's reach (0.2 at its edge, full inside 3 m, as a man's), his crouch (a smaller shape on the monitor), the smoke between lens and
 *  chest (the same 0.3‥0.8 ramp). 1.0 = plainly lit, close, clear air. */
export function lensGain(g: Game, dist: number, range: number, smokeTrans: number): number {
  const light = g.player.visibility; const distF = clamp(1 - (dist - 3) / Math.max(1, range - 3), 0.2, 1);
  return Math.pow(light, 1.5) * distF * (g.player.crouch ? 0.75 : 1) * clamp((smokeTrans - 0.3) / 0.5, 0, 1);
}
/** the lens's look direction at yaw / pitch (Character convention: forward = [sin yaw, 0, cos yaw]; pitch < 0 looks down) */
export function lensDir(yaw: number, pitch: number): Vec3 { const cp = Math.cos(pitch); return [Math.sin(yaw) * cp, Math.sin(pitch), Math.cos(yaw) * cp]; }
/** where a panning camera points at phase u (0‥1 round trip): eased there and back between the sweep's two yaws */
export function sweepYaw(d: CameraDef, phase: number): number { if (!d.sweep) return d.yaw; const s = 0.5 - 0.5 * Math.cos(phase * Math.PI * 2); return lerp(d.sweep[0], d.sweep[1], s); }

// ---------------------------------------------------------------- per frame
/** After lighting.ts updateTargets (this frame's factor) and everybody's movement: pan the cameras, run their pictures, run the beams, call in the dead ones, key the
 *  code being entered. The boxes are drawn separately (deviceBoxes, into Game.dynBoxes). */
export function updateDevices(g: Game, dt: number) {
  const D = g.devices; if (!D) return;
  const live = sensing(g);
  for (const c of D.cameras) updateCamera(g, c, dt, live);
  for (const l of D.lasers) updateLaser(g, l, dt, live && g.tune.lasers);
  updateCoding(g, dt);
}

function updateCamera(g: Game, c: CameraRt, dt: number, live: boolean) {
  const d = c.def; const ok = alive(c.target);
  // the pan runs while it has power (a blinded / dead camera stops where it was; the restrike picks the sweep up again)
  if (ok && d.sweep) { c.phase = (c.phase + dt / Math.max(0.5, d.sweepPeriod ?? DEVICE_DEFAULTS.sweepPeriod)) % 1; c.yaw = sweepYaw(d, c.phase); } else if (!d.sweep) c.yaw = d.yaw;
  const pitch = d.pitch ?? DEVICE_DEFAULTS.pitch; const look = lensDir(c.yaw, pitch);
  if (c.cone) { c.cone.enabled = ok && g.tune.deviceCones; c.cone.pos = v3.mad(d.pos, look, CONE.ahead); c.cone.dir = look; }
  // dead: control notices the feed drop once, and somebody is sent to look at it
  if (c.target.broken && !c.deadCalled) { c.deadCalled = true; c.seen = 0; c.state = 'idle'; if (live) deviceDown(g, d.name, `camera ${c.index}`, d.pos); }
  else if (!c.target.broken) c.deadCalled = false;   // (mended — the panel's repair, a restart — it can die and be called in again)
  c.sawThisFrame = false;
  if (!ok || !live) { c.seen = ok ? Math.max(0, c.seen - CAMERA_DECAY * dt) : 0; if (!ok) c.state = 'idle'; return; }   // blind (the OCP) or unpowered: the integrator empties and it forgets it had reported — it comes back fresh
  // the picture: the guards' eye test from the lens, then Sam's meter for how fast it fills
  const pc = g.player.char; const range = d.range ?? DEVICE_DEFAULTS.range; const half = (d.fovDeg ?? DEVICE_DEFAULTS.fovDeg) / 2;
  const E: Eye = { pos: d.pos, look, range, halfDeg: half, nearM: 0, nearDeg: half, vHalfDeg: half };
  const tr = g.sensors.read(c.smokeKey); if (tr !== undefined) c.smokeTrans = tr;   // (sensors.ts — last answer for the lens → chest segment; headless it never answers and stays what it was — 1, or what a probe set)
  const vis = eyeContact(g, E, pc, true, false, c.smokeTrans);
  if (vis.inCone) g.sensors.askSegment(c.smokeKey, d.pos, pc.bones.chest ?? v3.add(pc.pos, [0, 1.1, 0]));   // asked only while the cone has him: the probe's 32 slots a frame are Sam's own meter's too (a level of many cameras must not starve it)
  if (vis.visible) {
    const gain = lensGain(g, vis.dist, range, c.smokeTrans);
    if (gain > 0.02) { c.seen = Math.min(g.tune.cameraAlarmSecs + 1, c.seen + gain * dt); c.lastSeen = v3.copy(pc.pos); c.sawThisFrame = true; }
    else c.seen = Math.max(0, c.seen - CAMERA_DECAY * dt);
  } else c.seen = Math.max(0, c.seen - CAMERA_DECAY * dt);
  // what it does about it
  if (c.state === 'idle' && c.seen >= g.tune.cameraSuspicionSecs && c.lastSeen) cameraSuspect(g, c);
  if (c.state !== 'alarm' && c.seen >= g.tune.cameraAlarmSecs && c.lastSeen && c.sawThisFrame) cameraAlarm(g, c);
  if (c.state !== 'idle' && c.seen <= 0 && g.time - c.reportedAt > CAMERA_REARM_SECS) c.state = 'idle';   // drained and quiet a while: it will call him in afresh
}
function cameraSuspect(g: Game, c: CameraRt) {
  c.state = 'suspect'; c.reportedAt = g.time;
  const where = roomOf(c.lastSeen!); const sent = sendToLook(g, c.lastSeen!, `camera ${c.index}`);
  control(g, `camera ${c.index} has movement in the ${where}${sent ? ` — ${sent.callsign}, go and look` : ''}`);
  chronDevice(g, 'cameraSpotted', { camera: c.def.name, n: c.index, sent: sent?.callsign }, c.lastSeen!);
  g.devices.note(g, { device: c.def.name, what: 'suspicion', where, sent: sent?.callsign ?? null });
}
function cameraAlarm(g: Game, c: CameraRt) {
  c.state = 'alarm'; c.reportedAt = g.time;
  const p = c.lastSeen!; const where = roomOf(p);
  control(g, `camera ${c.index}: that's him — the ${where}. all posts, the ${where}`);
  g.alarm.pos[0] = p[0]; g.alarm.pos[1] = 0; g.alarm.pos[2] = p[2]; g.alarm.placed = true;   // the floor's fix is the picture's (the spokesman nearest it answers, the lockdown posts by it)
  for (const gd of g.guards) if (gd.state !== 'dead' && !gd.held && !gd.unit) { gd.lastKnown = v3.copy(p); gd.awareness = Math.max(gd.awareness, 0.5); if (gd.state === 'patrol') { gd.state = 'suspicious'; gd.reactT = 0.8; gd.searchT = 0; gd.path = []; gd.pathGoal = null; } }   // everybody on the net has the fix and comes up sharp; nobody is 'alert' off a monitor (no eyes of their own on him yet)
  raiseEscalation(g, escalationOf(g) >= 1 ? 2 : 1, null, 'device');
  chronDevice(g, 'cameraAlarm', { camera: c.def.name, n: c.index }, p);
  g.devices.note(g, { device: c.def.name, what: 'alarm', where, sent: null });
}

function updateLaser(g: Game, l: LaserRt, dt: number, live: boolean) {
  const d = l.def; const ok = alive(l.target);
  if (l.target.broken && !l.deadCalled) { l.deadCalled = true; if (sensing(g)) deviceDown(g, d.name, `the ${roomOf(d.from)} beam`, d.from); }
  else if (!l.target.broken) l.deadCalled = false;
  if (!ok) { l.cut = 0; l.held = false; return; }
  // where the beam actually ENDS this frame: the first solid thing in it — a static, a leaf swung through it, a chair shoved into it (none of which are intruders).
  // Beyond that point there is no beam: nothing past it can break it and nothing past it is drawn (one model — the picture and the sensor agree).
  let reach = l.len; const wh = g.engine.world.raycast(v3.mad(d.from, l.dir, 0.03), l.dir, reach, BoxFlag.NoShadow); if (wh) reach = Math.min(reach, wh.t + 0.03);
  const ph = g.props.raycast(d.from, l.dir, reach); if (ph) reach = Math.min(reach, ph.t);
  const end: Vec3 = v3.mad(d.from, l.dir, reach);
  // what breaks it: Sam's body (any capsule — a shin beam meets his shins, a chest beam his chest unless he is under it), the body he is hauling, a canister he has
  // thrown still in the air. Staff walk through their own beams (the system knows the shift); a dying man's gun clattering through it is nobody breaking in.
  const pl = g.player; let who: string | null = null; let at: Vec3 | null = null; let cut = reach;
  if (!pl.down && !g.playerInvisible) { at = bodyBreaks(pl.char, d.from, end); if (at) who = 'player'; }
  if (!who && pl.dragging) { at = bodyBreaks(pl.dragging.char, d.from, end); if (at) who = 'body'; }
  if (!who) { const back = Math.max(dt, 1 / 60); for (const it of g.items.items) { if (it.settled || (it.kind !== 'smoke' && it.kind !== 'flash')) continue; const prev: Vec3 = [it.pos[0] - it.vel[0] * back, it.pos[1] - it.vel[1] * back, it.pos[2] - it.vel[2] * back]; const q = segSegClosest(prev, it.pos, d.from, end); if (q.dist < it.radius + BEAM_MARGIN) { who = it.kind; at = q.onB; break; } } }   // (its flight over this frame, back-projected off its velocity: throwables.ts keeps no previous position; at least a 60 Hz stride so a paused-and-stepped frame still has a segment)
  if (at) cut = Math.min(cut, v3.dist(d.from, at));
  for (const o of g.guards) { if (o.state === 'dead') continue; const t = o.char.rayHit(d.from, l.dir, cut); if (t >= 0) cut = Math.min(cut, t); }   // (a man standing in it cuts the picture of it, without a word)
  for (const o of civilianBodies(g)) { const t = o.char.rayHit(d.from, l.dir, cut); if (t >= 0) cut = Math.min(cut, t); }                             // (…and so does the cleaner crossing it: staff, to the system — no trip, but no beam drawn through her either; review G3.6)
  l.cut = cut;
  // the trip: on the EDGE — something breaks it that was not breaking it last frame — and not again inside the cooldown; a man standing in a beam is one report
  const held = !!who; const edge = held && !l.held; l.held = held;
  if (!live || !edge || g.time - l.lastTripAt < LASER_COOLDOWN) return;
  laserTrip(g, l, who!, at!);
}
/** does any capsule of `c` cross the beam a→b: the point on the beam where it does, else null */
export function bodyBreaks(c: Character, a: Vec3, b: Vec3): Vec3 | null {
  if (!c.bones.hips) return null;
  const h = c.bones.hips; if (v3.distXZ(h, v3.lerp(a, b, clamp(((h[0] - a[0]) * (b[0] - a[0]) + (h[2] - a[2]) * (b[2] - a[2])) / Math.max(1e-6, v3.distXZ(a, b) ** 2), 0, 1))) > 1.6) return null;   // (broad phase: his middle within a stride and a half of the line)
  for (const k of c.capsules().caps) { const q = segSegClosest([k[0], k[1], k[2]], [k[4], k[5], k[6]], a, b); if (q.dist < k[3] + BEAM_MARGIN) return q.onB; }
  return null;
}
function laserTrip(g: Game, l: LaserRt, who: string, at: Vec3) {
  l.lastTripAt = g.time; l.trips++;
  const d = l.def; const where = roomOf(at); const level = d.alarm ?? DEVICE_DEFAULTS.alarm;
  g.audio.play('alarmChirp', d.from, 0.7);
  if (who === 'player') g.player.noise = Math.max(g.player.noise, 0.3);   // (the meter shows him he did something — the chirp at the emitter is small, the radio is the noise that matters)
  let sent: Guard | null = null;
  if (level === 'alarm') {
    control(g, `beam broken in the ${where} — that's an intruder. weapons out`);
    g.alarm.pos[0] = at[0]; g.alarm.pos[1] = 0; g.alarm.pos[2] = at[2]; g.alarm.placed = true;
    sent = sendToLook(g, at, 'the beam');
    raiseEscalation(g, escalationOf(g) >= 1 ? 2 : 1, null, 'device');
  } else {
    sent = sendToLook(g, at, 'the beam');
    control(g, `beam broken in the ${where}${sent ? ` — ${sent.callsign}, check it` : ' — somebody check it'}`);
  }
  chronDevice(g, 'laserTripped', { laser: d.name, by: who, level, sent: sent?.callsign }, at);
  g.devices.note(g, { device: d.name, what: 'trip', where, sent: sent?.callsign ?? null });
}

/** a camera / an emitter shot dead: control loses the feed and sends the nearest calm man to look at IT (the floor under it) — a dead camera is a fact about
 *  where you were a moment ago */
function deviceDown(g: Game, name: string, spoken: string, pos: Vec3) {
  g.sparks.emitBurst(pos, { count: 14, speed: 2.2, spread: 1.0, lift: 0.5, life: 0.5 }, (g.fxSeed++ * 7919) >>> 0);
  const floor = g.col.nav.nearestFreePoint(pos[0], pos[2]) ?? [pos[0], 0, pos[2]];
  const sent = sendToLook(g, floor, spoken);
  control(g, `${spoken} just went dark${sent ? ` — ${sent.callsign}, get eyes on it` : ' — somebody get eyes on it'}`);
  chronDevice(g, 'deviceDown', { device: name, sent: sent?.callsign }, floor);
  g.devices.note(g, { device: name, what: 'dead', where: roomOf(floor), sent: sent?.callsign ?? null });
}
/** The nearest calm, free staff man is sent to `pos` on control's word: the rack errand's mechanism (mission.ts sendRackCheck) — a task that survives the suspicion
 *  decay, so he actually gets there, looks round for a few seconds and, finding nothing, goes back to his route. Null if everybody is busy with something louder. */
export function sendToLook(g: Game, pos: Vec3, what: string): Guard | null {
  void what;
  const goal = g.col.nav.nearestFreePoint(pos[0], pos[2]) ?? v3.copy(pos);
  let best: Guard | null = null, bd = Infinity;
  for (const gd of g.guards) { if (gd.state !== 'patrol' || gd.hold || gd.task || gd.held || gd.script || gd.unit || gd.bodyDuty) continue; const dd = v3.dist(gd.char.pos, goal); if (dd < bd) { bd = dd; best = gd; } }
  if (!best) return null;
  best.task = { kind: 'device', pos: v3.copy(goal) }; best.lastKnown = v3.copy(goal); best.awareness = Math.max(best.awareness, ERRAND.awareness);
  best.state = 'suspicious'; best.reactT = ERRAND.reactT; best.searchT = 0; best.path = []; best.pathGoal = null;
  g.say(best, 'copy, control — on my way', true); g.audio.play('radio', best.char.bones.head ?? best.char.pos, 0.5);
  return best;
}
/** control's voice on the net: the HUD's radio strip keys on the 'radio: ' prefix (qrf.ts control does the same) */
function control(g: Game, text: string) { g.msg('radio: CONTROL — ' + text); g.audio.play('radio', null, 0.55); g.devices.radioCount++; chronicle(g, 'radio', { who: 'CONTROL', text }); }
/** the debrief's rows (chronicle.ts words them): through the mission's own live gate like every hook */
function chronDevice(g: Game, kind: 'cameraSpotted' | 'cameraAlarm' | 'laserTripped' | 'deviceDown' | 'codeLearned' | 'codeEntered', data: Record<string, string | number | boolean | undefined>, pos?: Vec3) {
  return kind === 'cameraSpotted' || kind === 'laserTripped' ? chronicleN(g, kind, 'devices', data, pos) : chronicle(g, kind, data, pos);   // (the score's counter moves with the run live, whether or not the capped timeline still takes the row — chronicle.ts chronicleN, review U9.2)
}

// ---------------------------------------------------------------- keypads: learning a code, keying it in
/** Sam LEARNS the code for lock `lockId` (a keypad's name): off a questioned man (`how` 'told', game.ts interrogate on intel kind 'code') or overheard ('overheard').
 *  Idempotent; says so in the log once; one for the debrief. Returns whether it was news. */
export function learnCode(g: Game, lockId: string, how: 'told' | 'overheard', from?: Guard | null): boolean {
  const pl = g.player; if (pl.codes.has(lockId)) return false;
  const K = g.devices?.keypads.find(k => k.def.name === lockId); if (!K) return false;
  pl.codes.add(lockId);
  g.msg(`${how === 'told' ? `${from?.callsign ?? 'he'} gave up` : 'overheard'} the ${padDoorName(K)} code — ${spell(K.def.code)}`);
  chronDevice(g, 'codeLearned', { door: K.door.def.name, how, from: from?.callsign }, from?.char.pos);
  g.devices.note(g, { device: lockId, what: how === 'told' ? 'code' : 'overheard', where: roomOf(pl.char.pos), sent: from?.callsign ?? null });
  return true;
}
/** dialogue.ts ambient pairs: a man at `mouth` has just said the code of `lockId` out loud — Sam learns it iff it CARRIED to him: the propagation the mixer and the
 *  guards' ears use, from the speaker's mouth to Sam's head, within OVERHEAR.pathM of path and OVERHEAR.carry of it left (a wall or a shut door and he hears a
 *  murmur, not four digits). Returns whether he now knows it. */
export function overhear(g: Game, speaker: Guard, lockId: string): boolean {
  const pl = g.player; if (pl.down || pl.codes.has(lockId)) return pl.codes.has(lockId);
  const mouth = speaker.char.bones.head ?? v3.add(speaker.char.pos, [0, 1.6, 0]); const ear = pl.char.bones.head ?? v3.add(pl.char.pos, [0, pl.crouch ? 1.0 : 1.6, 0]);
  const prop = g.col.sound.propagate(mouth, ear);
  if (prop.pathLen > OVERHEAR.pathM || prop.carry < OVERHEAR.carry) return false;
  return learnCode(g, lockId, 'overheard', speaker) || pl.codes.has(lockId);
}
/** the digits as said / shown ('7-3-9-1') */
export function spell(code: string): string { return code.split('').join('-'); }
/** what a pad's door is called on the HUD ('side door', 'server door') */
export function padDoorName(K: KeypadRt): string { return K.door.def.name === 'server_manager' ? 'side door' : `${K.door.def.name.replace(/_/g, ' ')} door`; }
/** Is `d` a keypad door locked against Sam where he stands (the pad's face, latched, the bolt thrown) — and does he know its code? null = not a keypad matter (no pad,
 *  or the door is not against him from there). player.ts buildInteractables words the rows off it; startCoding checks it again. */
export function padState(g: Game, d: Door, from: Vec3): { pad: KeypadRt; known: boolean } | null {
  const K = g.devices?.padOf(d); if (!K) return null;
  if (!g.doors.lockedOut(d, from)) return null;
  return { pad: K, known: g.player.codes.has(d.lockId) };
}
/** The 'code' row: start keying it in — a sustained verb like the pick (interact.ts runningVerb 'code:<door>'): he stands at the pad, four keys go in over
 *  CODE_SECS (updateCoding), the pad takes it and the leaf comes off its bolt and swings like a keyed door's (Doors.use with the code as his key for that one turn:
 *  the small clack, the creak — nothing the floor minds two rooms off), and springs locked again behind him when the closer latches it. */
export function startCoding(g: Game, d: Door): boolean {
  const pl = g.player; const st = padState(g, d, pl.char.pos);
  if (!st || !st.known || pl.coding || pl.down) return false;
  pl.coding = d; pl.codeT = 0; pl.fHeld = true;
  g.audio.play('padBeep', st.pad.def.pos, 0.5);   // the first key as his hand lands on it
  return true;
}
/** the 'nocode' row: the pad tried without the code — a deny tone at the plate, a hair on the meters, a word */
export function denyPad(g: Game, d: Door) {
  const K = g.devices?.padOf(d); if (!K) return;
  g.audio.play('deny', K.def.pos, 0.45);
  g.events.push({ kind: 'door', pos: [K.def.pos[0], 0, K.def.pos[2]], time: g.time, loud: false, level: DENY_LEVEL, who: PLAYER_ID }); g.player.noise = Math.max(g.player.noise, DENY_LEVEL);
  g.msg(`the ${padDoorName(K)} pad wants a code you don't have — somebody on this floor knows it`);
  g.devices.note(g, { device: K.def.name, what: 'deny', where: roomOf(g.player.char.pos), sent: null });
}
export function stopCoding(g: Game) { const pl = g.player; if (!pl.coding) return; pl.coding = null; pl.codeT = 0; }
/** once a frame: the code going in — a key a quarter of the way each, the accept chirp and the door on the last; broken off if he steps out of reach of the pad's door,
 *  goes down, or the door stopped being against him (a colleague came through it) */
function updateCoding(g: Game, dt: number) {
  const pl = g.player; const d = pl.coding; if (!d) return;
  const K = g.devices.padOf(d); const p = pl.char.pos;
  const inReach = Math.min(v3.distXZ(d.pos, p), v3.distXZ(d.frameCentre, p)) < PAD_REACH + 0.25;
  if (!K || pl.down || !inReach || pl.holding || pl.takedown) { stopCoding(g); return; }
  if (!g.doors.lockedOut(d, p)) { stopCoding(g); return; }   // no longer against him: nothing to key
  const before = pl.codeT; pl.codeT += dt;
  for (let k = 1; k < 4; k++) { const at = CODE_SECS * k / 4; if (before < at && pl.codeT >= at) g.audio.play('padBeep', K.def.pos, 0.5, { rate: 1 + 0.03 * k }); }
  if (pl.codeT < CODE_SECS) return;
  // accepted
  pl.coding = null; pl.codeT = 0;
  g.audio.play('padOpen', K.def.pos, 0.6);
  g.doors.use(d, p, PLAYER_ID, new Set([d.lockId]));   // the code IS his key for this one turn: unlock clack (KEY_LEVEL) + the creak, and it swings away from him
  g.msg(`${spell(K.def.code)} — the ${padDoorName(K)} takes it`);
  chronDevice(g, 'codeEntered', { door: d.def.name }, d.frameCentre);
  g.devices.note(g, { device: K.def.name, what: 'code', where: roomOf(p), sent: null });
}

// ---------------------------------------------------------------- drawing (into Game.dynBoxes, after the doors and props)
const CAM_COL: Vec3 = [0.16, 0.17, 0.19], CAM_DARK: Vec3 = [0.05, 0.05, 0.06], PAD_COL: Vec3 = [0.22, 0.23, 0.25], EMIT_COL: Vec3 = [0.14, 0.14, 0.16];
const GREEN: Vec3 = [0.3, 5, 0.6], RED: Vec3 = [5, 0.3, 0.15], AMBER: Vec3 = [5, 2.4, 0.2];
export function deviceBoxes(g: Game, out: Box[]) {
  const n0 = out.length;
  deviceBoxesRaw(g, out);
  for (let k = n0; k < out.length; k++) out[k].mkey = MKEY.device + (k - n0);   // MOTION IDENTITY by ordinal: a panning camera's body reprojects through its own last pose; a tripwire's beam / dot come and go with what cuts them, re-keying the boxes after them for a frame — the shape check in vsBox turns any such mismatch into 'did not move'
}
function deviceBoxesRaw(g: Game, out: Box[]) {
  const D = g.devices; if (!D) return;
  const dyn = BoxFlag.Dynamic, deco = BoxFlag.Dynamic | BoxFlag.NoShadow;
  for (const c of D.cameras) {
    const d = c.def; const ok = alive(c.target); const pitch = d.pitch ?? DEVICE_DEFAULTS.pitch; const look = lensDir(c.yaw, pitch);
    // bracket to the wall / ceiling behind it (a short arm straight back along the rest yaw, level), the body pitched with the lens, the lens barrel, the LED on top
    const back: Vec3 = [-Math.sin(d.yaw), 0, -Math.cos(d.yaw)];
    out.push(makeBox({ c: v3.mad(d.pos, back, 0.16), h: [0.025, 0.025, 0.09], yaw: d.yaw, albedo: CAM_DARK, flags: dyn }));
    const x = v3.normalize(v3.cross([0, 1, 0], look)); const y = v3.cross(look, x);
    out.push(makeBox({ c: v3.mad(d.pos, look, -0.04), h: [0.055, 0.05, 0.1], yaw: c.yaw, rot: quat.fromBasis(x, y, look), albedo: CAM_COL, flags: dyn }));
    out.push(makeBox({ c: v3.mad(d.pos, look, 0.075), h: [0.03, 0.03, 0.02], yaw: c.yaw, rot: quat.fromBasis(x, y, look), albedo: [0.02, 0.02, 0.025], flags: deco }));   // the lens: dark glass (the LED and the haze cone are the tells; a lit lens read as a pale square — 08-09 page check)
    const hot = c.seen > 0.02; const blink = c.state !== 'idle' ? (Math.sin(g.time * 18) > 0 ? 1 : 0.15) : 1;
    const led: Vec3 = !ok ? [0, 0, 0] : v3.scale(hot ? LED_HOT : LED_IDLE, blink * (hot ? clamp(0.4 + c.seen / Math.max(0.1, g.tune.cameraSuspicionSecs), 0.4, 1.6) : 1));
    out.push(makeBox({ c: v3.add(v3.mad(d.pos, look, 0.02), v3.scale(y, 0.062)), h: [0.012, 0.008, 0.012], yaw: c.yaw, rot: quat.fromBasis(x, y, look), albedo: [0.05, 0, 0], emissive: led, flags: deco }));
  }
  for (const K of D.keypads) {
    const d = K.def; const n = K.n; const yaw = d.yaw;
    out.push(makeBox({ c: v3.mad(d.pos, n, 0.012), h: [0.045, 0.065, 0.012], yaw, albedo: PAD_COL, flags: deco }));   // the plate (a decal's depth: nobody's collision, no ray minds it)
    out.push(makeBox({ c: v3.add(v3.mad(d.pos, n, 0.026), [0, -0.015, 0]), h: [0.03, 0.035, 0.003], yaw, albedo: [0.06, 0.06, 0.07], flags: deco }));   // the key block
    const locked = K.door.locked && K.door.latched; const busy = g.player.coding === K.door;
    const led: Vec3 = busy ? v3.scale(AMBER, Math.sin(g.time * 30) > 0 ? 1 : 0.2) : locked ? RED : GREEN;
    out.push(makeBox({ c: v3.add(v3.mad(d.pos, n, 0.026), [0, 0.045, 0]), h: [0.012, 0.006, 0.003], yaw, albedo: [0.04, 0.04, 0.04], emissive: v3.scale(led, 0.5), flags: deco }));
  }
  for (const l of D.lasers) {
    const d = l.def; const ok = alive(l.target); const yaw = v3.yawOf(l.dir);
    // emitter and receiver: small housings at the two ends, backed off the beam so it leaves / enters their faces; the emitter's tell-tale LED
    out.push(makeBox({ c: v3.mad(d.from, l.dir, -0.03), h: [0.03, 0.035, 0.03], yaw, albedo: EMIT_COL, flags: deco }));
    out.push(makeBox({ c: v3.mad(d.to, l.dir, 0.03), h: [0.03, 0.035, 0.03], yaw, albedo: EMIT_COL, flags: deco }));
    out.push(makeBox({ c: v3.add(v3.mad(d.from, l.dir, -0.03), [0, 0.043, 0]), h: [0.008, 0.005, 0.008], yaw, albedo: [0.05, 0, 0], emissive: ok ? (g.time - l.lastTripAt < 1.5 ? v3.scale(RED, Math.sin(g.time * 40) > 0 ? 2 : 0.2) : [1.5, 0.1, 0.05]) : [0, 0, 0], flags: deco }));
    if (ok && l.cut > 0.05) beamBoxes(g, d.from, l.dir, l.cut, out, l.cut < l.len - 0.05);   // the beam itself: combat.ts's weapon-laser draw (thin emissive line, ≥ a pixel wide, the bead where it is cut short)
  }
}

// ---------------------------------------------------------------- persistence of the panel's knobs (like qrf.ts / whistle.ts: per machine)
const LS_KEY = 'twopointsix.devices';
export const DEVICE_TUNE_DEFAULTS = { devices: true, lasers: true, cameraSuspicionSecs: 0.8, cameraAlarmSecs: 2.0, deviceCones: true };   // (lit-seconds to a report / to the alarm; Tab ▸ Sandbox ▸ Devices carries both — the designer, 08-12: 'keep cameras as they are' — structured hiding places for bodies come later as a system)
export function loadDeviceTune(g: Game) {
  try {
    const raw = localStorage.getItem(LS_KEY); if (!raw) return; const o = JSON.parse(raw); const T = g.tune;
    if (typeof o.devices === 'boolean') T.devices = o.devices; if (typeof o.lasers === 'boolean') T.lasers = o.lasers; if (typeof o.deviceCones === 'boolean') T.deviceCones = o.deviceCones;
    if (Number.isFinite(o.cameraSuspicionSecs) && o.cameraSuspicionSecs > 0) T.cameraSuspicionSecs = o.cameraSuspicionSecs; if (Number.isFinite(o.cameraAlarmSecs) && o.cameraAlarmSecs > 0) T.cameraAlarmSecs = o.cameraAlarmSecs;
  } catch { /* none / unavailable */ }
}
export function saveDeviceTune(g: Game) { const T = g.tune; try { localStorage.setItem(LS_KEY, JSON.stringify({ devices: T.devices, lasers: T.lasers, cameraSuspicionSecs: T.cameraSuspicionSecs, cameraAlarmSecs: T.cameraAlarmSecs, deviceCones: T.deviceCones })); } catch { /* */ } }
export function resetDeviceTune(g: Game) { Object.assign(g.tune, DEVICE_TUNE_DEFAULTS); try { localStorage.removeItem(LS_KEY); } catch { /* */ } }

// ---------------------------------------------------------------- geometry
/** Closest points between segments p (p0→p1) and b (b0→b1): the distance and the point on b. (Ericson, Real-Time Collision Detection §5.1.9.) */
export function segSegClosest(p0: Vec3, p1: Vec3, b0: Vec3, b1: Vec3): { dist: number; onB: Vec3 } {
  const d1 = v3.sub(p1, p0), d2 = v3.sub(b1, b0), r = v3.sub(p0, b0);
  const a = v3.dot(d1, d1), e = v3.dot(d2, d2), f = v3.dot(d2, r);
  let s: number, t: number;
  if (a <= 1e-9 && e <= 1e-9) { s = 0; t = 0; }
  else if (a <= 1e-9) { s = 0; t = clamp(f / e, 0, 1); }
  else {
    const c = v3.dot(d1, r);
    if (e <= 1e-9) { t = 0; s = clamp(-c / a, 0, 1); }
    else {
      const bb = v3.dot(d1, d2), denom = a * e - bb * bb;
      s = denom > 1e-9 ? clamp((bb * f - c * e) / denom, 0, 1) : 0;
      t = (bb * s + f) / e;
      if (t < 0) { t = 0; s = clamp(-c / a, 0, 1); } else if (t > 1) { t = 1; s = clamp((bb - c) / a, 0, 1); }
    }
  }
  const onP = v3.mad(p0, d1, s), onB = v3.mad(b0, d2, t);
  return { dist: v3.dist(onP, onB), onB };
}
