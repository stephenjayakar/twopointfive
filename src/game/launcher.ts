// The FN2000's ring-airfoil launcher (docs/internal/sc20k-design.md §5, lane R5): a rubber ring out of the tube under the fore-end at 30 m/s along a previewed,
// nearly flat arc — gravity and a little drag on it — that puts a man OUT COLD if it takes him in the head, the neck or high in the chest (combat.ts killGuard's
// quiet path: 'struck', breathing, what he held laid down, a thud the room hears — the takedown at fifteen metres), STAGGERS him anywhere lower (doubled over a
// second and a half, no round from him, a yelp — and then he is alert, and knows which side it came from), and clatters off whatever else it meets as a noise the
// room goes to look at. Never lethal, never suppression (a ring is not a round: nothing here calls suppression.ts), never retrievable: a spent ring is a 'ring'
// item on the floor (throwables.ts) and the count only ever falls. Any Character may fire one (fireRing takes the shooter): Sam today off the rifle in his hands
// (player.ts: the RING attachment selected with the rifle's slot digit, let go on the right button), an operative handed the same rifle later. Rings in flight live on Game.rings; game.ts steps them right after the player and
// draws them with the items.
import { Vec3, v3, quat } from '../math/vec';
import { BoxFlag, makeBox, Box } from '../scene/boxes';
import type { Character } from './character';
import type { Game, Guard } from './game';
import type { ThrowSolution } from './throwables';
import { RING_ITEM } from './throwables';
import { killGuard, bodyHit } from './combat';
import { civilianBodies, toAlarmed } from './civilians';
import { endGuardScript } from './squad';
import { PLAYER_ID } from './consts';
import { chipMark, staticSurface } from './marks';
import { clackFx } from './particleFx';

/** Every number of the ring's flight and of what it does (panel-tunable; the QA probes read them rather than copy them). */
export const RING = {
  /** muzzle speed (m/s), gravity (m/s²), air drag (/s: v ×= e^(−drag·t)), the ring's contact radius (m), seconds of flight before it is spent regardless, substeps a frame */
  speed: 30, gravity: 9.81, drag: 0.4, radius: 0.04, life: 1.5, substeps: 4,
  /** where on a man is 'out cold': the hit point no lower than this far under his neck joint (the throat, the jaw, the skull, the top of the sternum — CT-generous);
   *  anything lower staggers. The body is Character.rayHit's cylinder (0.28 about the hips, soles to crown), the same body a round finds. */
  koBelowNeck: 0.07,
  /** the stagger: seconds doubled over (Guard.staggerUntil — rooted, gun down, no round; guards.ts), his trigger dead at least this long, the awareness it leaves him
   *  with (0.92: alert — somebody just shot him with something), and how far back along the ring's line his fix on 'where from' is put when he has no better one */
  stagger: 1.5, staggerFireCd: 1.5, staggerAware: 0.92, staggerBack: 4,
  /** hearing ('prop' events, the room's business — guards.ts hearingCheck's door / furniture branch: ~9 m of path at 0.45, ~6 at 0.3): the launcher going off AT
   *  THE SHOOTER, the ring clacking off a wall / a desk at the impact (who 0: a noise the room cannot explain — men go and look at IT, which is half of what the thing
   *  is for), a man folding under a head hit (the takedown's 0.3, at him), the thump and yelp of a body hit */
  launchNoise: 0.45, clackNoise: 0.3, koNoise: 0.3, hitNoise: 0.35,
  /** N·s into a chair or a carton it strikes (it hops); how much of its normal speed a ring keeps coming back off a wall and how much of its slide along it (rubber
   *  at thirty metres a second: most of it goes in the slap), and the most it may carry into throwables' hands after — so it drops and skitters by the mark it
   *  made its noise at, where the men who heard it will look, rather than skating off down the corridor */
  propJ: 3, restitution: 0.2, keepTangent: 0.25, spentSpeedMax: 5,
  /** aim: lead the man under the reticle by his ground velocity (one iteration), and solve the launch elevation so the arc passes through the aim point (two) */
  lead: true, solveIters: 2,
};
/** the yelp of a man a ring has just doubled over (placeholder lines — the writing pass is the designer's) */
const STAGGER_LINES = ['agh — what the—', 'AH! son of a—', 'ow! what— who\'s there?!', 'nngh— something hit me!', 'jesus— my ribs—'];

/** One ring in the air: where, how fast, how long, whose (the Character that fired it: never hit by it, blamed for the noise, credited with the knockout), its roll about the line of flight (for the picture) */
export interface Ring { pos: Vec3; vel: Vec3; age: number; shooter: Character; spin: number; }

/** the launch velocity for a ring from `from` to pass through `target`: dead at it, raised by however far a simulated ring falls short over that distance (twice) */
function launchVel(from: Vec3, target: Vec3): Vec3 {
  const R = RING; const d = v3.sub(target, from); const L = v3.len(d); if (L < 1e-3) return [0, 0, R.speed];
  let aim = v3.copy(target);
  let v0: Vec3 = v3.scale(v3.normalize(d), R.speed);
  for (let it = 0; it < R.solveIters; it++) {
    v0 = v3.scale(v3.normalize(v3.sub(aim, from)), R.speed);
    // fly it (no collisions) to the target's horizontal distance and see how far under the target it passes
    const hd = Math.hypot(d[0], d[2]); let p = v3.copy(from), v = v3.copy(v0); const h = 1 / 240; let yAt = NaN;
    for (let i = 0; i < R.life / h; i++) {
      const k = Math.exp(-R.drag * h); v = [v[0] * k, v[1] * k - R.gravity * h, v[2] * k];
      const np: Vec3 = v3.mad(p, v, h);
      const a = Math.hypot(p[0] - from[0], p[2] - from[2]), b = Math.hypot(np[0] - from[0], np[2] - from[2]);
      if (b >= hd) { const u = b > a ? (hd - a) / (b - a) : 1; yAt = p[1] + (np[1] - p[1]) * u; break; }
      p = np;
    }
    if (!Number.isFinite(yAt)) break;
    aim = [aim[0], aim[1] + (target[1] - yAt), aim[2]];   // aim higher by the shortfall (converges in two: the arc is nearly flat)
  }
  return v0;
}

/** Where a ring fired now from `from` at `target` would go: the launch velocity, and the polyline of its flight until it first meets a static, a leaf, a prop or the
 *  floor (or its life runs out) — the shape the canisters' preview draws (ThrowSolution: player.ts hands it to the overlay as throwPreview). Men are not in it: the
 *  line shows the arc, the reticle shows the man. */
export function ringSolve(g: Game, from: Vec3, target: Vec3): ThrowSolution {
  const R = RING; const v0 = launchVel(from, target);
  // stepped exactly as updateRings steps a live ring at 60 Hz (dt / substeps), so the polyline is the flight to the centimetre; a point every substeps-th step
  const points: Vec3[] = []; let p = v3.copy(from), v = v3.copy(v0); let land = v3.copy(target); const h = 1 / 60 / R.substeps; let T = 0;
  for (let i = 0; i * h < R.life; i++) {
    if (i % R.substeps === 0) points.push(v3.copy(p));
    const k = Math.exp(-R.drag * h); v = [v[0] * k, v[1] * k - R.gravity * h, v[2] * k];
    const np = v3.mad(p, v, h); const seg = v3.sub(np, p); const len = v3.len(seg); T = i * h;
    if (len > 1e-6) { const dir = v3.scale(seg, 1 / len); const reach = len + R.radius; const st = g.col.raycast(p, dir, reach); const ph = g.props.raycast(p, dir, st ? st.t : reach); const t = ph ? ph.t : st ? st.t : -1; if (t >= 0) { land = v3.mad(p, dir, Math.max(0, t - R.radius)); points.push(land); break; } }
    if (np[1] < R.radius) { land = [np[0], R.radius, np[2]]; points.push(land); break; }
    p = np; land = v3.copy(np);
  }
  return { v0, T, points, land };
}

/** The point to send a ring at for what the reticle has: the HEAD of the man under it (that is where it does its work), led by his ground velocity over the ring's
 *  time of flight when `lead`; else the fixture / world point the cursor names, as a round would go. */
export function ringAimPoint(g: Game, from: Vec3): Vec3 {
  const gd = g.puppet?.target && g.puppet.target.state !== 'dead' ? g.puppet.target : g.aimGuard;
  if (gd) {
    const head = v3.add(gd.char.bones.head ?? v3.add(gd.char.pos, [0, 1.6, 0]), [0, 0.04, 0]);
    if (!RING.lead) return head;
    const tof = v3.dist(from, head) / (RING.speed * 0.9);   // (a shade slow of the muzzle speed: drag)
    return v3.mad(head, [gd.char.vel[0], 0, gd.char.vel[2]], tof);
  }
  if (g.aimTarget) return v3.copy(g.aimTarget.pos);
  const ap = g.aimPoint; return [ap[0], ap[1] + 0.03, ap[2]];
}

/** Let one ring go from `from` at `target` off `shooter`'s launcher: it is in the air from this frame (Game.rings), the launcher's whoosh-thunk plays at the tube, and
 *  the room inside nine metres or so hears it go (a 'prop' event at the shooter, RING.launchNoise — not gunfire: nobody eighty metres off learns a thing). */
export function fireRing(g: Game, shooter: Character, from: Vec3, target: Vec3): Ring {
  const ring: Ring = { pos: v3.copy(from), vel: launchVel(from, target), age: 0, shooter, spin: Math.random() * Math.PI };
  g.rings.push(ring);
  g.audio.play('launcher', from, 0.8);
  g.events.push({ kind: 'prop', pos: v3.copy(shooter.pos), time: g.time, loud: false, level: RING.launchNoise, who: shooter.id });
  if (shooter === g.player.char) g.player.noise = Math.max(g.player.noise, RING.launchNoise);
  return ring;
}

/** One frame of every ring in the air: drag and gravity in substeps, and along each substep's segment the first thing it meets — a living man other than its shooter
 *  (his body cylinder, the one a round finds: head-high or higher = out cold, lower = the stagger), a static or a door leaf (a clack the room hears, and it comes
 *  back off it into throwables' hands to bounce and lie there), loose furniture (the same, and the chair hops), the floor, or the end of its life. Whatever ends
 *  its flight leaves a 'ring' item where it ended. */
export function updateRings(g: Game, dt: number) {
  const R = RING;
  for (let i = g.rings.length - 1; i >= 0; i--) {
    const r = g.rings[i]; let done = false;
    const h = dt / R.substeps;
    for (let s = 0; s < R.substeps && !done; s++) {
      r.age += h; r.spin += 25 * h;
      const k = Math.exp(-R.drag * h); r.vel = [r.vel[0] * k, r.vel[1] * k - R.gravity * h, r.vel[2] * k];
      const seg = v3.scale(r.vel, h); const len = v3.len(seg); if (len < 1e-6) continue;
      const dir = v3.scale(seg, 1 / len); const reach = len + R.radius;
      // the nearest of: a man (the shift and the units, a CIVILIAN on the floor like anybody — review B7.2: rings sailed through the cleaner), a static / leaf, a prop.
      // bodyHit, not the bare rayHit: a ring let go with the tube already INSIDE a man's body cylinder (pressed to his back, a stacked pair) is a hit where it is
      // (t 0) instead of a miss the entering-only test could never see (review B7.3) — the muzzle's crown allowance trimmed to the ring's own radius, so a ring
      // skimming a hand over a kneeling man's head is still the miss it looks
      let best = Infinity; let hitC: Character | null = null; let hitG: Guard | null = null;
      const inside = (c: Character) => r.pos[1] < (c.bones.headTop?.[1] ?? c.pos[1] + 1.75) + R.radius;
      const tryChar = (c: Character, gd: Guard | null) => { if (c === r.shooter || !c.alive) return; const t = bodyHit(c, r.pos, dir, reach, inside); if (t >= 0 && t < best) { best = t; hitC = c; hitG = gd; } };
      for (const gd of g.guards) if (gd.state !== 'dead') tryChar(gd.char, gd);
      for (const cv of civilianBodies(g)) tryChar(cv.char, cv);
      if (!g.player.down) tryChar(g.player.char, null);
      const st = g.col.raycast(r.pos, dir, reach); const ph = g.props.raycast(r.pos, dir, reach);
      const tS = st ? st.t : Infinity, tP = ph ? ph.t : Infinity;
      if (hitC && best <= tS && best <= tP) { ringHitsCharacter(g, r, hitC, hitG, dir, v3.mad(r.pos, dir, best)); done = true; break; }
      if (ph && tP <= tS) {   // furniture: it hops, the ring clacks off it and drops
        const at = v3.mad(r.pos, dir, Math.max(0, tP - R.radius)); g.props.applyImpulse(ph.prop, at, [dir[0] * R.propJ, 0, dir[2] * R.propJ], r.shooter.id, true);
        clack(g, at); chipMark(g, v3.mad(r.pos, dir, tP), ph.n, { box: ph.box, dynamic: true }); spend(g, r, at, bounceOff(r.vel, ph.n)); done = true; break;   // (decals, E1: a chip out of the finish where it struck, riding the furniture — marks.ts)
      }
      if (st) { const at = v3.mad(r.pos, dir, Math.max(0, tS - R.radius)); clack(g, at); chipMark(g, v3.mad(r.pos, dir, tS), st.n, staticSurface(g, st.index)); spend(g, r, at, bounceOff(r.vel, st.n)); done = true; break; }   // (decals, E1: the chip in the wall / the leaf)
      r.pos = v3.add(r.pos, seg);
      if (r.pos[1] < R.radius) { const at: Vec3 = [r.pos[0], R.radius, r.pos[2]]; clack(g, at, 0.6); spend(g, r, at, bounceOff(r.vel, [0, 1, 0])); done = true; break; }   // skipped in off the floor
    }
    if (!done && r.age > R.life) { spend(g, r, r.pos, v3.scale(r.vel, 0.3)); done = true; }   // spent in the air (a lob out over the lot): it just falls
    if (done) g.rings.splice(i, 1);
  }
}
/** velocity coming back off a surface with normal n: the normal share reversed × restitution, the slide along it × keepTangent (throwables takes it from there) */
function bounceOff(v: Vec3, n: Vec3): Vec3 { const vn = v3.dot(v, n); const vN = v3.scale(n, vn), vT = v3.sub(v, vN); return v3.add(v3.scale(vT, RING.keepTangent), v3.scale(vN, vn < 0 ? -RING.restitution : 1)); }
/** the ring's flight is over at `at`: from here it is a 'ring' item with whatever motion is left in it (capped: a spent rubber ring, not a ricochet), and nobody picks it up */
function spend(g: Game, r: Ring, at: Vec3, vel: Vec3) {
  const sp = v3.len(vel); if (sp > RING.spentSpeedMax) vel = v3.scale(vel, RING.spentSpeedMax / sp);
  const it = g.items.spawn('ring', v3.copy(at), vel, { who: r.shooter.id, heading: v3.yawOf(vel) });
  it.onBounce = (sp, p) => { if (sp > 1.2) g.audio.play('canisterBounce', p, Math.min(0.5, sp / 12), { rate: 1.7 }); };   // the little skitters after the first clack: quiet, and not events (the clack was)
}
/** the ring meeting something hard: a bright little clack (the canister's ping, pitched up) and a noise the room cannot place a man behind — they go and look at IT */
function clack(g: Game, at: Vec3, k = 1) {
  g.audio.play('canisterBounce', at, 0.55 * k, { rate: 1.5 });
  clackFx(g, at);   // a few sparks off it (GPU particles; nothing with them off)
  g.events.push({ kind: 'prop', pos: [at[0], 0, at[2]], time: g.time, loud: false, level: RING.clackNoise * k, who: 0 });
}

/** A ring has found a man at `at` along `dir`. Head-high or higher (RING.koBelowNeck under his neck joint and up): out cold — killGuard's quiet 'struck' path by the
 *  shooter's hand (breathing; what he held laid down; the found-body lines will say so), the dull thump of it, a thud-level noise at him. Lower: the stagger. Sam
 *  on the end of somebody else's ring: the flinch and a word — it does no damage to anybody, ever. Either way the ring drops at his feet, spent. */
function ringHitsCharacter(g: Game, r: Ring, c: Character, gd: Guard | null, dir: Vec3, at: Vec3) {
  const R = RING; const byPlayer = r.shooter.id === PLAYER_ID;
  const neck = c.bones.neck ?? v3.add(c.pos, [0, 1.42, 0]);
  const high = at[1] >= neck[1] - R.koBelowNeck;
  if (!gd) {   // Sam (an operative's ring, one day; his own can never reach him)
    c.anim.hit(); g.audio.play('bodyHit', at, 0.5, { rate: 1.1 }); g.msg(high ? 'a ring airfoil off the side of your head — from a friend, luckily' : 'a ring airfoil in the ribs');
  } else if (gd.civ && !high) {   // a CIVILIAN low in the body: no stagger drill and no guard's yelp — the thump, the flinch, and she is frightened where she stands (civilians.ts toAlarmed 'noise', placed back up the ring's line: something struck her out of the dark), then runs for a guard or a phone like from any fright
    c.anim.hit(); g.audio.play('bodyHit', v3.add(c.pos, [0, 1.1, 0]), 0.55, { rate: 1.05 });
    if (!gd.held) toAlarmed(g, gd, 'noise', [c.pos[0] - dir[0] * R.staggerBack, 0, c.pos[2] - dir[2] * R.staggerBack], false);
    g.events.push({ kind: 'prop', pos: v3.copy(c.pos), time: g.time, loud: false, level: R.hitNoise, who: r.shooter.id });
    if (byPlayer) g.player.noise = Math.max(g.player.noise, R.hitNoise);
  } else if (high) {
    g.audio.play('bodyHit', at, 0.6, { rate: 0.75 });   // rubber on skull: a dull thump (the fall's thud is the ragdoll's own)
    if (gd.held?.by === 'player') { /* the man in Sam's arm, hit from in front by somebody's ring: he goes limp in the arm — updateHold drops the hold off a downed man next frame */ }
    killGuard(g, gd, [dir[0], 0, dir[2]], true, 'struck', byPlayer ? 'player' : 'guard', gd.civ ? `ring to the head — ${gd.civ.name}, the ${gd.civ.label}, is out cold. breathing — but a civilian: that costs, and they may find ${gd.civ.her}` : `ring to the head — ${gd.callsign} is out cold`);   // (a civilian: killGuard's first line hands her to civilians.ts civilianDown — her own row ('ring'), her own price; the line worded for her)
    g.events.push({ kind: 'prop', pos: v3.copy(c.pos), time: g.time, loud: false, level: R.koNoise, who: r.shooter.id });
    if (byPlayer) g.player.noise = Math.max(g.player.noise, R.koNoise);
  } else staggerGuard(g, gd, dir, r.shooter);
  spend(g, r, v3.mad(at, dir, -0.05), [-dir[0] * 1.5 + (Math.random() - 0.5), 1 + Math.random(), -dir[2] * 1.5 + (Math.random() - 0.5)]);   // it drops off him, back the way it came a little
}

/** A ring in the body (below the knockout line): he doubles over — rooted RING.stagger seconds the way the dazzle roots a man (Guard.staggerUntil → reactT; guards.ts
 *  lowers the gun and lets no round go meanwhile) with the flinch on him, any burst or choreography he was in over, a yelp — and it leaves him ALERT (awareness to
 *  gunfire's 0.92: the transition, its CONTACT and the floor's convergence follow next frame as for anything else that puts a man there) with his fix, if he had none
 *  better, RING.staggerBack metres back up the ring's line: the side it came from. The thump and the yelp are a noise at him. A man held in Sam's arm only flinches. */
export function staggerGuard(g: Game, gd: Guard, dir: Vec3, shooter: Character) {
  if (gd.state === 'dead') return;
  const R = RING, c = gd.char;
  c.anim.hit(); g.audio.play('bodyHit', v3.add(c.pos, [0, 1.1, 0]), 0.55, { rate: 1.05 });
  if (gd.held) return;
  if (gd.script) endGuardScript(gd, gd.state === 'patrol' ? 'suspicious' : gd.state === 'search' ? 'search' : gd.state === 'alert' ? 'alert' : 'suspicious');   // (choreography ends where he stands, as a grab ends it)
  gd.staggerUntil = Math.max(gd.staggerUntil, g.time + R.stagger); gd.reactT = Math.max(gd.reactT, R.stagger); gd.fireCd = Math.max(gd.fireCd, R.staggerFireCd);
  gd.weapon.burst = null;
  gd.path = []; gd.pathGoal = null; gd.stallRef = null; gd.speed = 0; c.vel = [0, 0, 0];
  if (gd.state !== 'alert' || !gd.lastKnown) {   // where from: back up the line it flew, on the floor, somewhere a man can stand (else where he is)
    let back: Vec3 = [c.pos[0] - dir[0] * R.staggerBack, 0, c.pos[2] - dir[2] * R.staggerBack];
    if (g.col.nav.isBlocked(back[0], back[2])) back = g.col.nav.nearestFreePoint(back[0], back[2]) ?? v3.copy(c.pos);
    gd.lastKnown = back;
  }
  gd.awareness = Math.max(gd.awareness, R.staggerAware);
  if (g.aiEnabled) gd.witness.heard.small++;   // (his record: something got him — counted with the small things; the alert it tips him into books itself next frame)
  g.say(gd, STAGGER_LINES[Math.floor(Math.random() * STAGGER_LINES.length) % STAGGER_LINES.length]);
  g.events.push({ kind: 'prop', pos: v3.copy(c.pos), time: g.time, loud: false, level: R.hitNoise, who: shooter.id });
  if (shooter.id === PLAYER_ID) g.player.noise = Math.max(g.player.noise, R.hitNoise);
}
/** the stagger lines (the QA soak counts them as their own smell, not a bark repeat) */
export function staggerLines(): string[] { return [...STAGGER_LINES]; }

/** Rings in flight as boxes: three thin slats crossed at 60° in the plane square to its flight, rolling about it — a small pale blur of a ring going away from you.
 *  Raster-only (NoShadow): nothing traces a 6 cm rubber ring. */
export function ringBoxes(g: Game, out: Box[]) {
  const H = RING_ITEM.half, col = RING_ITEM.albedo;
  for (const r of g.rings) {
    const sp = v3.len(r.vel); if (sp < 1e-3) continue; const z = v3.scale(r.vel, 1 / sp);
    const up: Vec3 = Math.abs(z[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0]; const x0 = v3.normalize(v3.cross(up, z)); const y0 = v3.cross(z, x0);
    for (let k = 0; k < 3; k++) {
      const a = r.spin + k * Math.PI / 3; const ca = Math.cos(a), sa = Math.sin(a);
      const x: Vec3 = v3.mad(v3.scale(x0, ca), y0, sa), y: Vec3 = v3.mad(v3.scale(x0, -sa), y0, ca);
      out.push(makeBox({ c: v3.copy(r.pos), h: [H[0], H[2], H[1]], yaw: v3.yawOf(z), rot: quat.fromBasis(x, y, z), albedo: v3.copy(col), flags: BoxFlag.Dynamic | BoxFlag.NoShadow }));   // long along x, its width along y, its thinness along the flight
    }
  }
}

/** Panel / QA: 'rings ▸ 4 left · attachment RING · 1 in the air · 2 on the floor' */
export function ringSummary(g: Game): string {
  const rf = g.player.rifle;
  return `rings ▸ ${g.player.hasRifle ? `${rf.rings} left · attachment ${rf.attachment ? rf.attachment.toUpperCase() : 'none'} (2 again with the rifle up; RMB fires it)` : 'no FN2000 in the kit'} · ${g.rings.length} in the air · ${g.items.items.filter(x => x.kind === 'ring').length} on the floor`;
}
