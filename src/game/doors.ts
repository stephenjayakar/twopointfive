// Hinged doors: double-acting leaves that characters push open by walking into them, with inertia, limit stops,
// a slow hydraulic closer and a latch. Rendered/traced as thin dynamic boxes, so light spills through the gap as
// they swing (radiance cascades pick the change up over a couple of frames). Also used as occluders for guard
// vision, hearing and audio propagation.
import { Vec3, clamp } from '../math/vec';
import { Box, BoxFlag, makeBox, MKEY } from '../scene/boxes';
import { doorLeafMarks } from '../scene/markingDefaults';

export interface DoorDef {
  name: string;
  hinge: [number, number];        // x, z of the hinge axis
  closedDir: number;               // world angle of the closed leaf (0 → +X, π/2 → +Z)
  width: number;                   // leaf length from the hinge
  height?: number; thickness?: number;
  minAngle?: number; maxAngle?: number;   // swing limits relative to closed (radians)
  angle?: number;                  // initial angle
  albedo?: Vec3;
  closer?: boolean;                // hydraulic closer (default true); false = stays where it was left
  exterior?: boolean;              // opens onto the lot (level.ts): guards tidying doors in a lockdown leave it alone
  /** A keyed lever set: while the leaf is latched it will not open from the `keySide` (the corridor) to anyone without a key — guards carry keys, the player picks
   *  it (Doors.pick) or kicks it in (Doors.kickIn), or takes a key off a man he questions (player.ts takeKey) and it opens to him as it does to them. The room
   *  side is a thumb-turn: it always opens from there, so you can shut yourself in but never lock yourself in. The lock only bites once the latch has caught:
   *  a leaf still swinging to can be caught and pushed like any other. */
  locked?: boolean;
  /** which face carries the cylinder: +1 = the CCW side of the closed leaf (+perp in Doors' side convention — the corridor for every door on the z=10 wall), −1 the other */
  keySide?: 1 | -1;
  /** which key turns it (Door.lockId): absent = FLOOR_KEY, the one key every man on nights carries and every keyed door on this floor takes. A second cylinder
   *  would name its own ('server', say) and want a holder (level.ts PatrolRoute.keys). */
  lock?: string;
  /** a steel fire door in a steel frame (the west stair door — game/qrf.ts): a boot does nothing to it but make a noise (kickIn: no broken keep, no swing, a clang
   *  the men nearby come to look at), and its corridor face has no keyway to pick (player.ts offers no 'pick' row). It opens like any door to a key that fits,
   *  and always from its far side. */
  steel?: boolean;
}
/** the lock every keyed door takes unless its def says otherwise, and the key every guard carries unless his route says otherwise (game.ts Guard.keys) */
export const FLOOR_KEY = 'floor';

/** weak: a limp thing (a corpse's particle) — it never unlatches or bashes a leaf, and a leaf that someone stronger is pushing this frame, or a latched one,
 *  pushes IT (pos is corrected) instead of yielding; otherwise the leaf rests against it like against anyone (the closer cannot shut a door on a body).
 *  key: staff (guards) — every locked leaf unlatches for them like an unlocked one, and they handle leaves the way staff do (pull one to behind them, take the
 *  blame for what it does, are let through one a colleague is pulling shut). keys: the keys a keyless body carries all the same (the player, off a man he
 *  questioned — Player.keys): a locked leaf whose lock one of them fits (Door.lockId) is no wall to him; nothing else about how leaves treat him changes.
 *  blockedBy (out): the locked leaf that stopped this contact this frame. */
export interface DoorContact { pos: Vec3; radius: number; bash: boolean; who: number; quiet: boolean; weak?: boolean; key?: boolean; keys?: ReadonlySet<string>; blockedBy?: Door | null; }
/** does this contact's key ring get it through d's lock: staff always, anyone else by a key that fits */
const opens = (c: DoorContact, d: Door) => !!c.key || (!!c.keys && c.keys.has(d.lockId));
/** rattle: the lever tried against a thrown bolt · pick: one click of the pick working · unlock: the cylinder going over and the bolt drawing · kick: a boot through the lock */
export type DoorSound = 'creak' | 'bang' | 'latch' | 'bash' | 'rattle' | 'pick' | 'unlock' | 'kick' | 'clang';   // clang: a boot on a steel door that does not give (DoorDef.steel)
export interface DoorEvent { door: Door; sound: DoorSound; pos: Vec3; who: number; level: number; }

export class Door {
  angle: number; vel = 0; quietT = 10; latched: boolean; lastWho = -1; sinceBash = 10; closing = false;
  /** lock state (see DoorDef.locked): `locked` clears when picked or kicked; `lockBroken` = kicked in (behaves as unlocked for the rest of the encounter, and a calm
   *  guard passing close will notice it once: `noticed`); `pick` = how far the cylinder has been worked 0‥1 (kept a couple of seconds after letting go, then it
   *  drifts back: Doors.update); `rattleT` > 0 just after the handle was tried (marker flash + a hair of leaf shake). All restored by reset(). */
  locked: boolean; lockBroken = false; noticed = false; noticedT = -1000; pick = 0; picking = false; pickIdle = 0; pickClock = 0; pickN = 0; rattleT = 0;   // (noticedT: game time of that notice — evidence ages: guards.ts planClears)
  /** game time a guard last pulled this leaf to / threw its bolt in a lockdown (guards.ts lockdownDoors: one man deals with a door, not all three every pass) */
  guardT = -100;
  /** the keyed men (a bit per contact id, ids < 32) this leaf is passing through right now — each pulled it shut past himself, or walked into it while somebody pulled
   *  it to (Doors.update): until they are apart again the leaf neither feels him nor moves him, and it will not latch inside him. 0 = nobody. */
  passers = 0;
  readonly keySide: 1 | -1;
  /** the key that turns this lock (DoorDef.lock, FLOOR_KEY by default) — what a keyless contact's `keys` and the player's own ring are asked for */
  readonly lockId: string;
  readonly height: number; readonly thick: number; readonly minA: number; readonly maxA: number;
  readonly box: Box; readonly handleBoxes: Box[];
  creakArmed = true;
  constructor(readonly def: DoorDef) {
    this.height = def.height ?? 2.16; this.thick = def.thickness ?? 0.05;
    this.minA = def.minAngle ?? -1.92; this.maxA = def.maxAngle ?? 1.92;
    this.locked = !!def.locked; this.keySide = def.keySide ?? 1; this.lockId = def.lock ?? FLOOR_KEY;
    this.angle = clamp(def.angle ?? 0, this.minA, this.maxA); this.latched = Math.abs(this.angle) < 1e-3;
    const leafH: Vec3 = [def.width / 2 - 0.01, this.height / 2, this.thick / 2];
    this.box = makeBox({ c: [0, 0, 0], h: leafH, albedo: def.albedo ?? [0.42, 0.3, 0.19], flags: BoxFlag.Dynamic, name: 'door_' + def.name, ...(def.steel ? { rough: 0.3, metal: true } : { rough: 0.55, marks: doorLeafMarks(leafH) }) });   // finish for the reflection pass (Box.rough): a painted steel fire door has a satin sheen, the veneered leaves only just (ultra); MARKINGS: kick plates both faces + a push plate by the latch (the markings lane — a steel door is its own plate)
    // push plate + lever handle (raster only)
    this.handleBoxes = [0, 1].map(() => makeBox({ c: [0, 0, 0], h: [0.06, 0.012, 0.012], albedo: [0.55, 0.55, 0.52], flags: BoxFlag.Dynamic | BoxFlag.NoShadow, rough: 0.25, metal: true }));
    this.frameCentre = [def.hinge[0] + Math.cos(def.closedDir) * def.width * 0.5, 1.0, def.hinge[1] + Math.sin(def.closedDir) * def.width * 0.5];
    this.place();
  }
  /** Leaf centre (1 m up) at the current angle. Read in per-frame loops (interactables, body contacts, every emitted DoorEvent), so it is only recomputed
   *  when the angle has moved — as a fresh array each time, so a caller holding an earlier result keeps the snapshot it always got. */
  get pos(): Vec3 {
    if (this.angle !== this.posAngle) { this.posAngle = this.angle; const u = this.dir(); this.posAt = [this.def.hinge[0] + u[0] * this.def.width * 0.5, 1.0, this.def.hinge[1] + u[1] * this.def.width * 0.5]; }
    return this.posAt;
  }
  private posAngle = NaN; private posAt: Vec3 = [0, 1, 0];
  /** Static doorway centre (where the closed leaf's middle sits). */
  readonly frameCentre: Vec3;
  /** 'Closed enough' that using it means opening it (shared by use() and the HUD prompt). */
  isClosed() { return Math.abs(this.angle) < 0.25; }
  dir(): [number, number] { const a = this.def.closedDir + this.angle; return [Math.cos(a), Math.sin(a)]; }
  /** Back to the level as authored: angle, latch, lock, and everything the encounter did to it (pick progress, a kicked lock, a guard having noticed it). */
  reset() {
    this.angle = clamp(this.def.angle ?? 0, this.minA, this.maxA); this.vel = 0; this.latched = Math.abs(this.angle) < 1e-3; this.closing = false; this.quietT = 10; this.sinceBash = 10; this.creakArmed = true; this.lastWho = -1;   // (lastWho too: the fresh encounter's first bang / latch is nobody's yet — it used to keep the last man of the encounter before, review B7.12)
    this.locked = !!this.def.locked; this.lockBroken = false; this.noticed = false; this.noticedT = -1000; this.pick = 0; this.picking = false; this.pickIdle = 0; this.pickClock = 0; this.rattleT = 0; this.guardT = -100; this.passers = 0;
    this.place();
  }
  place() {
    const w = this.def.width; const [hx, hz] = this.def.hinge;
    const jig = this.rattleT > 0.35 ? Math.sin(this.rattleT * 90) * 0.005 : 0;   // the handle being tried: the leaf works a hair in its frame (drawn only — dir(), which the contacts read, stays put)
    const a = this.def.closedDir + this.angle + jig; const u: [number, number] = [Math.cos(a), Math.sin(a)];
    const yaw = -a;                                             // box local +X maps to world (cos yaw, -sin yaw)
    this.box.c = [hx + u[0] * (w * 0.5 + 0.01), this.height / 2 + 0.01, hz + u[1] * (w * 0.5 + 0.01)]; this.box.yaw = yaw;
    this.box.flags = Math.abs(this.angle) < 0.3 ? this.box.flags | BoxFlag.SoundSeal : this.box.flags & ~BoxFlag.SoundSeal;   // an open leaf standing in the room does not seal the doorway acoustically
    const n: [number, number] = [-u[1], u[0]];
    for (let s = 0; s < 2; s++) {
      const hb = this.handleBoxes[s]; const side = s === 0 ? 1 : -1; const off = this.thick / 2 + 0.03;
      hb.c = [hx + u[0] * (w - 0.14) + n[0] * off * side, 1.0, hz + u[1] * (w - 0.14) + n[1] * off * side]; hb.yaw = yaw;
    }
  }
}

/** m/s at which a leaf may correct a living contact — at its stop, at its hinge post, held against him by somebody on the far face: 12 cm a frame at 60 Hz, more
 *  than anyone walks or runs into it, so ordinary contact is exact, but a leaf swept INTO a man (driven to its stop by a shove near the hinge, kicked through him,
 *  walked open onto him) presses him out over a few frames instead of teleporting him a foot — the 'popped' guard of the QA soak, and the player flung 40 cm a
 *  frame at 20 fps. Bodies (weak contacts) are shoved outright; a leaf LOCKED against the player is exact (see shove). */
const SHOVE_RATE = 7.2;
/** rad/s a push may turn a leaf (a quarter radian a frame at 60 Hz — faster than any kick; the rest of a deep push waits a frame) */
const TURN_RATE = 15;
/** rad a KICKED leaf may turn in one go before the living contacts are asked (Doors.update): 9 rad/s is 0.45 rad in a 20 fps frame — the tip further than a man
 *  is thick — and integrated in one step the leaf's line came out beyond the centre of anybody standing just past it, whereupon the contact pass, reading him on
 *  its other face, helped it on through him (review B7.1). A frame's turn longer than this is walked in steps no longer, stopping short of the first that would
 *  press a standing man, so the leaf comes to rest against him at 20 fps as it does at 60; a turn within it (every kick at 55 fps and up: 9 rad/s ÷ 60 = 0.15) is
 *  the single step it always was — the contact pass has always caught that much (a body is 0.68 across), and every seeded QA night stays the night it was. */
const KICK_SUBSTEP = 0.16;
/** the correction a leaf applies to a living contact this frame: capped (SHOVE_RATE), except `exact` — the locked leaf the player himself is pressing on, which
 *  must stay a wall to him however hard a guard walking into his back presses him onto it (there the penetration is his own stride, never a sweep) */
const shove = (pen: number, dt: number, exact = false) => exact ? pen + 0.001 : Math.min(pen + 0.001, SHOVE_RATE * dt);

export class Doors {
  list: Door[];
  constructor(defs: DoorDef[], private emit: (e: DoorEvent) => void) { this.list = defs.map(d => new Door(d)); this.list.forEach((d, i) => { d.box.mkey = MKEY.door + i * 4; d.handleBoxes[0].mkey = MKEY.door + i * 4 + 1; d.handleBoxes[1].mkey = MKEY.door + i * 4 + 2; }); }   // motion identity for the leaf and its handles (scene/boxes.ts MKEY)

  byName(n: string) { return this.list.find(d => d.def.name === n); }

  /** Which face of d the point is on: +1 = the CCW side of the leaf (perp > 0 in update()'s convention), −1 the other. */
  side(d: Door, from: Vec3): 1 | -1 { const u = d.dir(); const px = from[0] - d.def.hinge[0], pz = from[2] - d.def.hinge[1]; return u[0] * pz - u[1] * px >= 0 ? 1 : -1; }
  /** The lock is against you: latched, still locked, you are on the keyed side (see DoorDef.locked) — and nothing on your ring fits it (`keys`: Player.keys;
   *  absent = no keys at all). What use / crack / a keyless push run into. */
  lockedOut(d: Door, from: Vec3, keys?: ReadonlySet<string>): boolean { return d.locked && d.latched && this.side(d, from) === d.keySide && !(keys && keys.has(d.lockId)); }
  /** The lock is against you BUT for the key you carry: thrown, latched, its cylinder facing you, and one of `keys` fits — the case the marker words as 'unlock'
   *  and use() puts the key's clack in front of the creak. */
  keyOpens(d: Door, from: Vec3, keys?: ReadonlySet<string>): boolean { return !!keys && keys.has(d.lockId) && this.lockedOut(d, from); }

  /** Resolve contacts (mutates contact positions when a door can't yield), integrate swing, closer, latch. */
  update(dt: number, contacts: DoorContact[]) {
    for (const c of contacts) c.blockedBy = null;
    for (const d of this.list) {
      const [hx, hz] = d.def.hinge; const W = d.def.width; const ht = d.thick / 2;
      const kicked = d.sinceBash < 0.6;
      if (kicked && !d.latched) {   // a kicked leaf flies ahead of the runner instead of staying glued to them — a long frame's turn walked in steps of ≤ KICK_SUBSTEP, stopping short of the first that would press a standing man (see the constant): it comes to rest against him instead of out of his far side at 20 fps
        const total = clamp(d.angle + d.vel * dt, d.minA, d.maxA) - d.angle; const n = Math.ceil(Math.abs(total) / KICK_SUBSTEP);
        if (n <= 1) d.angle = clamp(d.angle + d.vel * dt, d.minA, d.maxA);
        else for (let s = 0; s < n; s++) { const a0 = d.angle; d.angle = a0 + total / n; if (this.leafPresses(d, contacts)) { d.angle = a0; break; } }
      }
      let touched = false, yank = false, pushed = false, bodyBlock = false;   // bodyBlock: a corpse rests against the leaf · pushed: a living contact moved the leaf this frame — resolved first (pass 0), so the weak ones (pass 1) know
      let pushDir = 0, keyTouched = false;   // pushDir: the way a keyed man has already turned the leaf this frame — the player pressing it the other way from the far face meets a held leaf (he is moved, it does not turn back: else the two clamp it between them and he is fed through it a few centimetres a frame); keyTouched: a guard's hands are on it (he takes the blame for what it does, not the player brushing the other face)
      let here = 0;      // the passers (Door.passers) still overlapping the leaf this frame
      for (let pass = 0; pass < 3; pass++) for (const c of contacts) {   // keyed men first (they hold leaves against the player, above), then the player, then the limp things
        if ((c.weak ? 2 : c.key ? 0 : 1) !== pass) continue;
        // quick reject: outside the swing circle
        const vx = c.pos[0] - hx, vz = c.pos[2] - hz; if (vx * vx + vz * vz > (W + c.radius + 0.1) ** 2) continue;
        if (c.weak && c.pos[1] - c.radius > d.height) continue;   // (a body flung over a leaf — not in this office, but cheap)
        for (let it = 0; it < 3; it++) {
          const u = d.dir(); const px = c.pos[0] - hx, pz = c.pos[2] - hz;
          const along = px * u[0] + pz * u[1]; const perp = u[0] * pz - u[1] * px;   // >0: contact on the CCW side of the leaf
          const t = clamp(along, 0, W); const qx = px - u[0] * t, qz = pz - u[1] * t; const dist = Math.hypot(qx, qz);
          const pen = c.radius + ht - dist; if (pen <= (c.weak ? 0.002 : 0)) break;   // (weak: a settled body resting exactly at the leaf must not be re-shoved a hair every frame — that would keep its ragdoll awake)
          const bit = !c.weak && c.who >= 0 && c.who < 32 ? 1 << c.who : 0;
          if (bit & d.passers) { here |= bit; break; }   // he is stepping through this leaf (see `pulling` below): whichever side of it his centre has got to, it neither feels him nor moves him until they are clear of each other
          if (c.weak && (d.latched || pushed || kicked)) { const k = pen / Math.max(dist, 1e-4); c.pos[0] += qx * k; c.pos[2] += qz * k; break; }   // the leaf wins: shove the body
          if (c.weak) bodyBlock = true; else { touched = true; if (c.key || !keyTouched) d.lastWho = c.who; if (c.key) keyTouched = true; }   // a corpse against the leaf blocks the closer but is nobody: it neither re-arms the closer's quiet timer (that made the leaf twitch into the body every 2 s and kept its ragdoll awake) nor takes the blame; between a guard and the player on one leaf, the guard's doing
          if (!c.weak && !opens(c, d) && d.locked && d.latched && (perp >= 0 ? 1 : -1) === d.keySide && along > 0.14 && along < W + c.radius) {
            // locked against a body with no key to it: the leaf is a wall. Push them back out, tell the caller which door stopped them (a sprinting player turns that into
            // a kick, game.ts), and let the bolt clack in its keep once per shove — a small noise, but a noise (re-armed with the creak after a moment untouched)
            const k = shove(pen, dt, true) / Math.max(dist, 1e-4); c.pos[0] += qx * k; c.pos[2] += qz * k; c.blockedBy = d;
            if (d.creakArmed && pen > 0.015) { d.creakArmed = false; this.rattle(d, c.who, c.quiet ? 0.08 : 0.12); }
            break;
          }
          // a keyed man and a leaf being pulled shut fast (yank, below — his own pull, usually; a colleague tidying it, sometimes) whose contact would only open it
          // wider: he becomes its `passer` — from here until they are apart the leaf ignores him entirely (above), closing on its spring while he walks through
          // its edge. (Without this the leaf he pulls to swung into him, his own contact pushed it back to its stop, and the two see-sawed a hand apart with him
          // going nowhere — the wedge the QA soak kept finding by the break-room door; and a half-way version, let in but felt again once his centre crossed
          // the leaf line, whipped the leaf through the frame into the far stop with a bang.)
          const pulling = c.key && !c.bash && d.closing && Math.abs(d.angle) > 0.35;
          if (along > 0.14 && along < W + c.radius) {
            // leaf yields: rotate away from the contact about the hinge
            const sgn = perp >= 0 ? -1 : 1; const lever = Math.max(0.18, t);
            const maxTurn = TURN_RATE * dt; const raw = sgn * (pen / lever) * 1.05, capped = Math.abs(raw) > maxTurn;   // a body pressed on the leaf right by its hinge whipped the tip through half a radian in one frame — and flung whoever stood in that arc a foot: a quarter radian a frame is already faster than any kick, the rest of the push waits a frame
            const want = d.angle + (capped ? Math.sign(raw) * maxTurn : raw);
            if (pulling && Math.abs(want) > Math.abs(d.angle)) { if (bit) { d.passers |= bit; here |= bit; } yank = true; break; }   // (see above: he keeps pulling, it passes him)
            if (!c.weak && !c.key && pushDir && sgn !== pushDir) { const k = shove(pen, dt) / Math.max(dist, 1e-4); c.pos[0] += qx * k; c.pos[2] += qz * k; break; }   // a guard on the far face is already pushing it his way this frame: to the player it is a held leaf — it moves him, it does not turn back (guards among themselves work it to and fro as ever); at SHOVE_RATE, so a leaf walked open onto him presses him aside over a few frames, and past a man it cannot move (his back to the wall) it swings on through
            const na = clamp(want, d.minA, d.maxA); const moved = na - d.angle;
            if (Math.abs(moved) > 1e-5) {
              if (!c.weak) { pushed = true; if (c.key) pushDir = sgn; }
              if (d.latched) { d.latched = false; if (d.creakArmed && !c.bash) { this.emit({ door: d, sound: 'creak', pos: d.pos, who: c.who, level: c.quiet ? 0.12 : 0.3 }); d.creakArmed = false; } }
              if (c.bash && d.sinceBash > 0.9 && Math.abs(d.angle) < 1.2) { d.vel = sgn * 7.5; d.sinceBash = 0; this.emit({ door: d, sound: 'bash', pos: d.pos, who: c.who, level: 1.0 }); }
              else if (!kicked) d.vel = c.weak ? d.vel * 0.5 : d.vel * 0.5 + (moved / Math.max(dt, 1e-3)) * 0.5;   // a body soaks up a coasting leaf; it never sets one going
              d.angle = na;
            }
            if (Math.abs(want - na) > 1e-5) { // at the stop: door is solid, push the character out
              const k = shove(pen, dt) / Math.max(dist, 1e-4); c.pos[0] += qx * k; c.pos[2] += qz * k;
              if (c.key && !c.bash) yank = true;   // …but a man with a key does what anyone would: takes the leaf with him the other way (it swings shut, out of the alley he is trying to use) — else
            }                                      // nav, which cannot see leaves, marches him into it for as long as anyone keeps making noise beyond it (the QA soak's commonest wedge)
            if (capped) break;   // (the capped remainder is next frame's business, not two more goes at it now)
          } else {
            // hinge region (or beyond the tip): behaves like a post — except that a keyed man snagged on the free EDGE of a leaf standing open takes it with him
            // toward shut (same yank as at the stop, below); at the hinge there is nothing to take, that is the frame — and one it is already passing (above) does not fling him
            if (pulling) { if (bit) { d.passers |= bit; here |= bit; } yank = true; break; }
            const k = shove(pen, dt) / Math.max(dist, 1e-4); c.pos[0] += qx * k; c.pos[2] += qz * k;
            if (c.key && !c.bash && along >= W && !d.latched && Math.abs(d.angle) > 0.5) yank = true;
            break;
          }
        }
      }
      d.sinceBash += dt;
      d.passers &= here;   // whoever is clear of it (or never came) is felt again
      if (yank) { d.closing = true; if (Math.sign(d.angle) * d.vel > -3) d.vel = -Math.sign(d.angle) * 3; d.quietT = 0; }   // pinned at the stop by a keyed man: he pulls it to (see above)
      else if (touched) { d.quietT = 0; d.closing = false; } else if (!bodyBlock) { d.quietT += dt; }
      // free swing with friction, limit stops (a kicked door was already integrated above)
      if ((!touched || kicked || yank) && !d.latched) {
        if (!kicked) d.angle += d.vel * dt;
        d.vel *= Math.exp(-2.2 * dt);
        if (d.angle >= d.maxA || d.angle <= d.minA) {
          const lim = d.angle >= d.maxA ? d.maxA : d.minA; d.angle = lim;
          if (Math.abs(d.vel) > 2.5) this.emit({ door: d, sound: 'bang', pos: d.pos, who: d.lastWho, level: Math.min(1, Math.abs(d.vel) / 8) });
          d.vel = Math.sign(lim) * d.vel > 0 ? -d.vel * 0.25 : d.vel;   // bounce only if still moving into the stop
        }
        // hydraulic closer engages after a moment of no contact
        if (((d.def.closer !== false && d.quietT > 2.0) || d.closing) && !bodyBlock) { const k = d.closing ? 5.0 : 3.0; const acc = -d.angle * k - d.vel * (d.closing ? 4.2 : 3.2); d.vel += acc * dt; }
        if (bodyBlock) d.vel *= Math.exp(-12 * dt);   // resting on a body: the closer gives up pushing and the leaf settles where it is
        if (Math.abs(d.angle) < 0.012 && Math.abs(d.vel) < 0.35 && d.quietT > 0.3 && !d.passers) {   // (never inside a man it is passing: it rests to, unlatched, until he steps clear — latched, his next contact would creak it open and whip it through)
          d.angle = 0; d.vel = 0; d.latched = true; d.creakArmed = true; d.closing = false;
          this.emit({ door: d, sound: 'latch', pos: d.pos, who: d.lastWho, level: 0.16 });
        }
      }
      if (d.quietT > 1.2) d.creakArmed = true;
      // the lock: a cylinder nobody is working holds for a couple of seconds, then the pins settle back (a full pick's worth drains in ~4 s); the tried-handle flash runs down
      if (d.picking) { d.picking = false; d.pickIdle = 0; } else if (d.pick > 0) { d.pickIdle += dt; if (d.pickIdle > 2.0) d.pick = Math.max(0, d.pick - dt / 4); }
      if (d.rattleT > 0) d.rattleT = Math.max(0, d.rattleT - dt);
      d.place();
    }
  }

  /** Does d's leaf, at the angle it stands, press into any LIVING contact along its face (the same overlap and along-the-leaf window update()'s yield branch uses;
   *  the limp things and the men it is passing through do not count — a kicked leaf shoves a body outright, and a passer is not felt)? The kicked swing's stop test. */
  private leafPresses(d: Door, contacts: DoorContact[]): boolean {
    const [hx, hz] = d.def.hinge; const W = d.def.width; const ht = d.thick / 2; const u = d.dir();
    for (const c of contacts) {
      if (c.weak) continue;
      const px = c.pos[0] - hx, pz = c.pos[2] - hz; if (px * px + pz * pz > (W + c.radius + 0.1) ** 2) continue;
      const bit = c.who >= 0 && c.who < 32 ? 1 << c.who : 0; if (bit & d.passers) continue;
      const along = px * u[0] + pz * u[1]; if (along <= 0.14 || along >= W + c.radius) continue;
      const t = clamp(along, 0, W); const dist = Math.hypot(px - u[0] * t, pz - u[1] * t);
      if (c.radius + ht - dist > 0) return true;
    }
    return false;
  }

  /** Hold-to-crack: ease a (near-)closed leaf open away from `from`, silently, up to `maxAngle`; the closer stays off while it is being held.
   *  The wedge of light through the gap widens as you inch it — and nobody hears a thing unless you let it swing. (A lock against you: nothing gives —
   *  unless one of `keys` fits it, and then the key goes round with the handle as softly as the rest.) */
  crack(d: Door, from: Vec3, who: number, dt: number, keys?: ReadonlySet<string>, rate = 0.55, maxAngle = 0.6) {
    if (this.lockedOut(d, from, keys)) return;
    const [hx, hz] = d.def.hinge; const u = d.dir(); const px = from[0] - hx, pz = from[2] - hz; const perp = u[0] * pz - u[1] * px;
    const sgn = Math.abs(d.angle) > 0.02 ? Math.sign(d.angle) : (perp >= 0 ? -1 : 1);
    d.latched = false; d.closing = false; d.vel = 0; d.quietT = -1.5; d.lastWho = who;
    if (Math.abs(d.angle) < maxAngle) d.angle = clamp(d.angle + sgn * rate * dt, d.minA, d.maxA);
  }

  /** Player 'use' (a tap on F): closed → swing open away from the user; open → pull/push it shut (closer takes it the last bit fast); locked against you → just
   *  the rattle — or, with a key that fits on your ring (`keys`), the key's clack (KEY_LEVEL) and it swings open like any other: the bolt springs back behind
   *  you when the closer latches it, as it does behind the staff. */
  use(d: Door, from: Vec3, who: number, keys?: ReadonlySet<string>) {
    if (this.lockedOut(d, from, keys)) { this.rattle(d, who); return; }
    if (this.keyOpens(d, from, keys)) this.emit({ door: d, sound: 'unlock', pos: d.pos, who, level: Doors.KEY_LEVEL });
    const [hx, hz] = d.def.hinge; const u = d.dir(); const px = from[0] - hx, pz = from[2] - hz; const perp = u[0] * pz - u[1] * px;
    if (d.isClosed()) { const sgn = perp >= 0 ? -1 : 1; d.latched = false; d.closing = false; d.vel = sgn * 3.2; d.quietT = -1.0; this.emit({ door: d, sound: 'creak', pos: d.pos, who, level: 0.2 }); }
    else this.pullTo(d, who);
    d.lastWho = who;
  }
  /** Pull a leaf to from wherever it stands, even a hand's breadth ajar (use() would push that one open): a stiff sprung close that the latch catches — works for
   *  hold-open doors too. What a guard tidying up in a lockdown does (guards.ts lockdownDoors). */
  pullTo(d: Door, who: number) { if (d.latched) return; d.closing = true; d.vel = -Math.sign(d.angle) * 1.2; d.lastWho = who; }

  // ---------------------------------------------------------------- locks
  /** seconds of actual cylinder work to pick a lock (the plant / hands-up beat before it comes on top: ~4.5 s door to door) */
  static readonly PICK_SECS = 4.2;
  /** hearing levels (GameEvent 'door', see guards.ts hearingCheck: a = level·(1−d/12)·carry must beat 0.08 to register at all, 0.3 awareness = 'huh?'):
   *  a pick click every ~0.7 s at 0.16 walks a patrolling man within ~3 m up to 'huh?' over one full pick and shows as ticks on his marker to ~5 m; the
   *  cylinder going over (0.3, a door creak's worth) tips one at ~4 m; the tried handle (0.12) is a tick at arm's length and nothing across the room, and
   *  a key turning it (KEY_LEVEL, use() with a key that fits) is the same small clack — eased round on a held handle (crack) it is nothing at all. */
  static readonly PICK_LEVEL = 0.16; static readonly UNLOCK_LEVEL = 0.3; static readonly KEY_LEVEL = 0.12;

  /** Try the lever against the bolt: a clack, the leaf working in its frame, the marker flashing 'won't budge' (Door.rattleT). Rate-limited by the flash itself. */
  rattle(d: Door, who: number, level = 0.12) {
    if (d.rattleT > 0) return;
    d.rattleT = 0.6; d.lastWho = who; this.emit({ door: d, sound: 'rattle', pos: d.pos, who, level });
  }

  /** Where to work d's lock from `from`'s side: the root half a metre square off the leaf in front of the keyway (under the lever, 14 cm in from the latch edge —
   *  CharacterAnimator.lockpickAt reaches 0.45 m dead ahead), facing the leaf. `stand` = the stand-off (the kick uses the same spot further out). */
  workSpot(d: Door, from: Vec3, stand = 0.5, along = d.def.width - 0.14): { pos: Vec3; yaw: number } {
    const [hx, hz] = d.def.hinge; const u = d.dir(); const s = this.side(d, from); const nx = -u[1] * s, nz = u[0] * s;   // unit normal out of the leaf on `from`'s side
    return { pos: [hx + u[0] * along + nx * stand, 0, hz + u[1] * along + nz * stand], yaw: Math.atan2(-nx, -nz) };        // (Character.forward = [sin yaw, 0, cos yaw]: face back into the leaf)
  }
  /** Where a kick is thrown from: square to the leaf 0.76 m off it (the sole arrives ~0.75 m ahead of the root at KICK_IMPACT), at the runner's own station
   *  along the leaf but kept on its outer half — by the lock, where a kick belongs and the lever arm is longest. */
  kickSpot(d: Door, from: Vec3): { pos: Vec3; yaw: number } {
    const u = d.dir(); const along = (from[0] - d.def.hinge[0]) * u[0] + (from[2] - d.def.hinge[1]) * u[1];
    return this.workSpot(d, from, 0.76, clamp(along, d.def.width * 0.5, d.def.width - 0.18));
  }

  /** One frame of working the lock (the caller keeps the picker planted at workSpot and decides when he has to break off). Advances Door.pick; the pick clicks
   *  in an uneven ~0.7 s rhythm the room can hear (PICK_LEVEL), and when the cylinder goes over the bolt draws with a louder snap (UNLOCK_LEVEL) and the door
   *  is simply unlocked from then on. Progress survives a pause (see update()). Returns true on the frame it opens. */
  pick(d: Door, who: number, dt: number): boolean {
    if (!d.locked) return true;
    if (d.def.steel) return false;   // (no keyway on the keyed face of a steel fire door: nothing here advances — player.ts never plants a man at one)
    if (d.pick === 0) d.pickClock = 0.3; else if (d.pickIdle > 0.15) d.pickClock = Math.min(d.pickClock, 0.3);   // fresh start, or picked up again after a pause: the first click comes soon
    d.picking = true; d.lastWho = who; d.quietT = 0;                                                              // (hands on the door: the creak / rattle stay disarmed, the closer has nothing to do anyway)
    d.pick = Math.min(1, d.pick + dt / Doors.PICK_SECS);
    d.pickClock -= dt;
    if (d.pickClock <= 0) { d.pickClock = 0.55 + 0.3 * ((++d.pickN * 0.618034) % 1); this.emit({ door: d, sound: 'pick', pos: d.pos, who, level: Doors.PICK_LEVEL }); }
    if (d.pick < 1) return false;
    d.locked = false; d.pick = 0; d.picking = false; d.noticed = false;   // (picked again after they had found it and locked it back up: fresh evidence, worth a fresh remark — guards.ts / squad.ts readDoors)
    this.emit({ door: d, sound: 'unlock', pos: d.pos, who, level: Doors.UNLOCK_LEVEL });
    return true;
  }

  /** A boot beside the lock: the keep tears out of the jamb (lockBroken — it is an unlocked door for the rest of the encounter), the leaf is flung to its stop
   *  harder than any shoulder bash, and the crack of it carries through the whole floor (DoorEvent 'kick' → GameEvent 'kick', heard like a shot). Works on any
   *  leaf the kicker can reach, locked or not; one already standing wide open just gets the noise. */
  kickIn(d: Door, from: Vec3, who: number) {
    if (d.def.steel) { d.rattleT = 0.6; d.lastWho = who; this.emit({ door: d, sound: 'clang', pos: d.pos, who, level: 1.0 }); return; }   // steel in a steel frame: the boot rings off it, the leaf shivers in its frame ('won't budge'), the bolt holds — a loud noise and nothing else
    if (!d.lockBroken) d.noticed = false;    // a picked lock they had already remarked on, now kicked through: the splintered jamb is news again (a second kick at a broken keep is not)
    d.locked = false; d.lockBroken = true;   // (only a leaf locked against the kicker ever gets kicked: game.ts)
    d.pick = 0; d.latched = false; d.closing = false; d.quietT = -0.5; d.lastWho = who; d.creakArmed = false;
    if (Math.abs(d.angle) < 1.4) { d.vel = -this.side(d, from) * 9; d.sinceBash = 0; }   // away from the boot (side +1 pushes the leaf CW = negative angle), on the fast 'kicked' path in update()
    this.emit({ door: d, sound: 'kick', pos: d.pos, who, level: 1.0 });
  }

  /** Insert approach/exit points where a path crosses a doorway so characters take doors head-on and clear the
   *  swung leaf before turning (the leaf can stand perpendicular to the wall at its stop). */
  threadPath(path: Vec3[], start: Vec3, isFree: (x: number, z: number) => boolean = () => true): Vec3[] {
    if (!path.length) return path;
    const out: Vec3[] = []; let prev = start;
    for (const p of path) {
      const ins: { t: number; pts: Vec3[] }[] = [];
      for (const d of this.list) {
        const [hx, hz] = d.def.hinge; const u: [number, number] = [Math.cos(d.def.closedDir), Math.sin(d.def.closedDir)]; const n: [number, number] = [-u[1], u[0]];
        // intersect segment prev→p with the closed-door line (hinge .. hinge+u*W) in 2D
        const ax = prev[0] - hx, az = prev[2] - hz, bx = p[0] - hx, bz = p[2] - hz;
        const da = ax * n[0] + az * n[1], db = bx * n[0] + bz * n[1];
        if (da * db >= 0 || Math.abs(da - db) < 1e-6) continue;
        const t = da / (da - db); const ix = ax + (bx - ax) * t, iz = az + (bz - az) * t; const along = ix * u[0] + iz * u[1];
        if (along < -0.1 || along > d.def.width + 0.1) continue;
        const mid = d.def.width * 0.55; const sgn = da < 0 ? 1 : -1;      // travelling toward +n if da<0
        const cx = hx + u[0] * mid, cz = hz + u[1] * mid;
        const pick = (dists: number[], side: number): Vec3 | null => { for (const dd of dists) { const q: Vec3 = [cx + n[0] * dd * side, 0, cz + n[1] * dd * side]; if (isFree(q[0], q[2])) return q; } return null; };
        // only add points the existing waypoints don't already cover, otherwise the guard overshoots and doubles back in the doorway
        const before = -da * sgn, beyond = db * sgn;                         // how far prev / p sit from the door line along the travel direction (both ≥ 0)
        const pts: Vec3[] = [];
        if (before > 0.75 + 0.5) { const a = pick([0.75, 0.55], -sgn); if (a) pts.push(a); }            // approach square-on
        if (beyond > 1.35 + 0.5) { const b = pick([1.35, 1.1, 0.85, 0.6], sgn); if (b) pts.push(b); }   // clear the leaf before turning
        if (pts.length) ins.push({ t, pts });
      }
      ins.sort((p0, p1) => p0.t - p1.t); for (const i of ins) out.push(...i.pts);                        // in travel order if one leg crosses two doorways
      out.push(p); prev = p;
    }
    return out;
  }

  /** How close (planar, to the leaf centre or the doorway centre) a character must be to use a door (player.ts buildInteractables). */
  static readonly USE_REACH = 1.35;

  boxes(out: Box[]) { for (const d of this.list) { out.push(d.box, d.handleBoxes[0], d.handleBoxes[1]); } }

  /** Leaf boxes, for registering as dynamic occluders with the collision layer. */
  leafBoxes(): Box[] { return this.list.map(d => d.box); }
}
