// Attract mode: the start card, left alone for a few seconds, stops sitting over a still picture. The camera CUTS (under the same black veil the tour uses)
// round a short loop of the tour's own framings — the lobby by moonlight, the corridor man and his torch, the lot under the sodium lamp, the cubicle floor,
// the conference glass, the server room's glow, the break room and its fire exit — holding each for a few seconds with a breath of yaw drift and a slow
// push-in, while the guards walk their beats through the shots: that is the show. The world runs for it (main.ts unfreezes the start card while `active`)
// under the tour's flag — quietUtility: the mission clock, the alarm's memory, the radio check and the log all stay out of it — with Sam parked out of every
// shot and out of the AI's senses. The first key, click, wheel tick or real mouse movement puts everything back at once (no fade): a fresh encounter exactly as
// the Start button has always found it (restartEncounter: the men on their marks, doors, props and switches as authored, Sam at the insertion point), the
// camera back on him at its own yaw and height, the flags as they were — and the idle clock starts again. main.ts decides WHEN it may run at all (its canRun:
// the start card only, no tour, auto quality done calibrating, never under ?paused / automation / a hidden tab); this file is the programme itself.
// Two stages once it starts: the OPENING (`active`, not yet `live`) only raises the veil over the card's own still view — the world stays frozen and untouched
// under it (main.ts keys its freeze on `live`) — and only once the veil has been fully black for a presented frame does it go LIVE: the flags up, Sam away, the
// world let go and the first cut, all unseen. A poke during the opening therefore has nothing to put back but the veil.
import { Vec3, v3, DEG, smoothstep } from '../math/vec';
import type { Game } from './game';
import type { FollowCamera } from './camera';

/** One framing: the floor point looked at (or a live getter — a man to follow), the yaw it is cut to (degrees, the tour's convention: 0 looks north, −90
 *  east; or a getter answered at the cut), the distance it opens at, and how long it holds. */
export interface Vantage { title: string; pos: Vec3 | (() => Vec3); yaw: number | (() => number); dist: number; dur?: number; }

/** where Sam waits it out: the grass off the north-west corner of the lot — outside the fence line, in no vantage, on no route, twenty metres from anyone's ears */
const PARK: Vec3 = [1.5, 0, 1.5];

export class Attract {
  /** seconds of no input on the start card before it starts; each vantage's hold; the yaw drift across a hold (degrees, alternating direction shot to shot);
   *  how far the slow push-in takes the distance (fraction of the opening distance); how long the opening veil takes to come up over the still view */
  static readonly IDLE_SECS = 6; static readonly HOLD_SECS = 7; static readonly DRIFT_DEG = 5; static readonly PUSH_IN = 0.08; static readonly VEIL_UP_SECS = 0.3;
  /** the programme has begun (the veil is coming up, or it is live): main.ts hides the player HUD and thins the card's vignette on this, and any poke stops it */
  active = false;
  /** the world has been let go behind the veil (flags up, Sam parked, the camera on the vantages): main.ts un-freezes the start card on THIS, not on `active` —
   *  through the opening beat the picture under the rising veil is still the card's own frozen view with everybody on his mark */
  live = false;
  /** 0‥1 for the page's black veil (main.ts): up for a beat around every cut, as the tour's */
  fade = 0;
  idle = 0; shotI = -1; shotT = 0;
  /** complete passes through the list this session (main.ts hands over to the showcase tour after the first) */
  loops = 0;
  readonly shots: Vantage[];
  private black = false;    // the opening beat: the veil has been at 1 for one presented frame (only then does anything behind it move)
  private yaw0 = 0;         // degrees, the current shot's yaw as answered at its cut
  private saved: { yaw: number; pitch: number; dist: number; quiet: boolean; invisible: boolean; touring: boolean } | null = null;

  /** canRun: may it run right now (polled every frame — falling false mid-programme stops it); onLoop: called after each full pass (may stop it); onStop: called at
   *  the very end of a stop() that had gone live, after the fresh encounter and the camera are back — main.ts refreshes the frozen picture there (the still card
   *  uploads nothing by itself, and the temporal history is still the last vantage's) */
  constructor(private game: Game, private cam: FollowCamera, private canRun: () => boolean, private onLoop?: (loops: number) => void, private onStop?: () => void) { this.shots = this.build(); }

  private build(): Vantage[] {
    const g = this.game, H = Attract.HOLD_SECS;
    const man = () => g.guards[0];   // the corridor route: a torch walking a long straight hallway, into the server room and back
    return [
      { title: 'lobby', pos: [7.6, 0, 17.6], yaw: -22, dist: 19, dur: H },                 // the tour's opening framing, as the level is authored: panels off, the logo strip, the moon through both runs of glazing — and Sam's way in
      { title: 'corridor', dur: H, dist: 12,                                                // the tour's 'Torches' framing: on the corridor man from behind, looking the way he is going (his heading at the cut; his facing if he is standing)
        pos: () => { const gd = man(); return gd ? v3.copy(gd.char.pos) : [20, 0, 11.1]; },
        yaw: () => { const gd = man(); if (!gd) return -60; const v = gd.char.vel, f = gd.char.forward(); const moving = Math.hypot(v[0], v[2]) > 0.3; return Math.atan2(-(moving ? v[0] : f[0]), -(moving ? v[2] : f[2])) / DEG; } },
      { title: 'lot', pos: [15.5, 0, 25.6], yaw: -30, dist: 18, dur: H },                  // the tour's soft-shadow framing: the south lot under its sodium lamp, the cars, the bike, the bollards' long penumbrae, the lobby glazing lit from inside
      { title: 'cubicles', pos: [23.0, 0, 19.4], yaw: -24, dist: 18, dur: H },             // the firefight's framing without the fight: partitions, rugs, the two live panels (one on the blink), the cubicle patrol's loop
      { title: 'conference', pos: [9.9, 0, 7.7], yaw: -30, dist: 13.5, dur: H },           // the room-clear's wide framing: the dark conference room, moon through its west window, the corridor man's beam raking through the glass wall as he passes
      { title: 'server room', pos: [18.5, 0, 8.4], yaw: -52, dist: 11, dur: H },           // the drive stop's framing: cold panel, the racks' green LEDs and their wash on the raised floor; the corridor route steps in here every lap
      { title: 'fire exit', pos: [34.4, 0, 20.3], yaw: -32, dist: 15, dur: H },            // the tour's 'Doors' framing: the break room's dark east end, moonlight through the south window on the lino, the sodium-lit lot beyond the wall
    ];
  }

  /** Any real input (main.ts's window listeners): the clock goes back to zero, and a running programme ends on the spot. */
  poke() { this.idle = 0; if (this.active) this.stop(); }

  /** Once per rendered frame with the wall-clock dt (main.ts frame(), before its step, never under __pauseLoop): counts the idle seconds while it may run, starts it
   *  when they are up, carries the opening beat (the veil rising over the frozen view, then the hand-over to live), and stops it the moment it may not run (the
   *  card closed, the tour started, the tab hid). */
  tick(dt: number) {
    if (!this.canRun()) { this.idle = 0; if (this.active) this.stop(); return; }
    dt = Math.min(dt, 0.25);   // (a tab coming back from the background arrives with one enormous frame: that is not six seconds of hesitation, nor the whole opening beat)
    if (this.active) { if (!this.live) this.opening(dt); return; }
    this.idle += dt;
    if (this.idle >= Attract.IDLE_SECS) this.start();
  }

  /** Begin the programme now (tick() does this when the idle seconds are up; by hand from the console it skips the wait — but only where it may run at all,
   *  so a stray call in play cannot end in stop()'s fresh encounter). Nothing behind the card is touched yet: the veil comes up over the still view first. */
  start() {
    if (this.active || !this.canRun()) return;
    this.active = true; this.live = false; this.black = false; this.shotI = -1; this.shotT = 0; this.loops = 0; this.fade = 0;
  }

  /** The opening beat, on the wall clock (the world is frozen, so nothing else is counting): raise the veil; once it has been fully black for one presented frame —
   *  main.ts paints the veil at the end of the frame this runs in, so the frame that first reaches 1 is let out still frozen — go live under it. */
  private opening(dt: number) {
    this.fade = Math.min(1, this.fade + dt / Attract.VEIL_UP_SECS);
    if (this.fade < 1) return;
    if (!this.black) { this.black = true; return; }
    const g = this.game, cam = this.cam;
    this.saved = { yaw: cam.yaw, pitch: cam.pitch, dist: cam.desiredDistance, quiet: g.quietUtility, invisible: g.playerInvisible, touring: g.touring };
    g.quietUtility = true; g.touring = true; g.playerInvisible = true;   // the tour's terms: nothing it does is the mission, the log or the alarm's business, and nobody senses Sam
    g.clearAftermath(); g.teleportPlayer(PARK);                          // Sam away before the world's first step (main.ts un-freezes on `live` from this frame on)
    this.live = true;
    this.next();                                                          // the first cut, under black (fade stays up; update() clears it into the hold)
  }

  /** Everything back, at once: a fresh encounter (as Start has always found it), the flags, the camera on Sam at its own angle. Idempotent. A programme still in
   *  its opening beat had moved nothing and touched nothing behind the veil: dropping the veil is all there is to it. */
  stop() {
    if (!this.active) return;
    const g = this.game, cam = this.cam, sv = this.saved, wasLive = this.live;
    this.active = false; this.live = false; this.black = false; this.fade = 0; this.idle = 0; this.shotI = -1; this.saved = null;
    if (!wasLive) return;
    g.restartEncounter();   // still under the flag: its note stays out of the log — the men back on their marks, doors / props / switches as authored, Sam at the insertion point
    if (sv) { g.quietUtility = sv.quiet; g.playerInvisible = sv.invisible; g.touring = sv.touring; cam.yaw = sv.yaw; cam.pitch = sv.pitch; cam.distance = cam.desiredDistance = sv.dist; }
    const p = g.followPos(); cam.target = v3.copy(p); cam.desired = v3.copy(p);   // snapped, not flown: the card's own view is simply back
    this.onStop?.();        // (main.ts: the fresh encounter onto the GPU and the temporal history re-seeded from this view before the next picture — a frozen card does neither by itself)
  }

  private next() {
    this.shotI++; this.shotT = 0; this.fade = Math.max(this.fade, 0.999);   // the cut itself is under black; update() clears it
    if (this.shotI >= this.shots.length) { this.shotI = 0; this.loops++; this.onLoop?.(this.loops); if (!this.active) return; }
    const s = this.shots[this.shotI], cam = this.cam;
    this.yaw0 = typeof s.yaw === 'function' ? s.yaw() : s.yaw;
    cam.yaw = this.yaw0 * DEG; cam.distance = cam.desiredDistance = s.dist;
    const p = typeof s.pos === 'function' ? s.pos() : s.pos; cam.target = v3.copy(p); cam.desired = v3.copy(p);   // a cut: yaw, distance AND look-at land together
  }

  /** The camera programme, once live. Returns this frame's look-at (main.ts feeds it to the camera as it does the tour's), else null — through the opening beat too:
   *  the frozen card holds its own view. */
  update(dt: number): Vec3 | null {
    if (!this.live) return null;
    this.shotT += dt;
    const s = this.shots[this.shotI]; const dur = s.dur ?? Attract.HOLD_SECS; const u = Math.min(1, this.shotT / dur);
    this.cam.yaw = (this.yaw0 + (this.shotI % 2 ? -1 : 1) * Attract.DRIFT_DEG * u) * DEG;              // a slow pan across the hold, never more than a few degrees: nothing sits dead still
    this.cam.desiredDistance = s.dist * (1 - Attract.PUSH_IN * smoothstep(0, 1, u));                   // and a gentle push-in (the camera's own damping carries the distance there)
    const toEnd = dur - this.shotT; const wantBlack = toEnd < 0.35 || this.shotT < 0.1;                 // black over the last third of a second and the first tenth of the next: the cut sits in between
    this.fade = wantBlack ? Math.min(1, this.fade + dt / 0.3) : Math.max(0, this.fade - dt / 0.45);
    if (this.shotT >= dur) { this.next(); if (!this.active) return null; }
    const cur = this.shots[this.shotI];
    return typeof cur.pos === 'function' ? cur.pos() : v3.copy(cur.pos);
  }
}
