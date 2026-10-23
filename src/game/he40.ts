// The FN2000's 40 mm high-explosive round (gear: the launcher's second attachment, beside the ring airfoil — launcher.ts). Out of the same tube under the
// fore-end, on the same right button, down a previewed arc — but at a low-velocity grenade's 76 m/s, and with a nose fuze:
//   - it ARMS only once it has flown HE40.armM metres of its own path (the fuze counts the round's turns, which is to say its distance). The default is the
//     blast's own outer radius, so an armed round can wound the man who fired it only if he walked toward it;
//   - armed, it goes off on the first thing it meets — a wall, a door, a desk, the floor, a man — with THE SAME BLAST the hand grenade has: frag.ts blast(),
//     its radii, its cover rule, its bang, its one call into the destruction lane. Nothing here judges anybody, calls g.destr or touches a door;
//   - short of that it is a DUD: a quarter-kilo slug that slaps into whatever it met, clatters down and lies there inert (a 'shell' item — throwables.ts), a
//     noise the room goes to look at. Into a man it is the ring's body hit: he folds for a moment, then he is alert and knows the side it came from.
// Impartial like the blast: his own side, the unarmed and Sam himself are judged by where they stand when it bursts. Never hit points; no dice of its own (the
// blast's one hashed roll aside). Sam's, and a teammate's on order (squad40.ts: the same round by `fireShell`). Rounds in flight live on Game.shells; game.ts steps them beside the rings.
//
// (No top-level statement here uses another game module's export: src/game is one import cycle — see CLAUDE.md.)
import { Vec3, v3, quat } from '../math/vec';
import { BoxFlag, makeBox, Box } from '../scene/boxes';
import type { Character } from './character';
import type { Game, Guard } from './game';
import { SHELL_ITEM, type ThrowSolution } from './throwables';
import { bodyHit } from './combat';
import { civilianBodies, toAlarmed } from './civilians';
import { PLAYER_ID } from './consts';
import { chipMark, staticSurface } from './marks';
import { clackFx } from './particleFx';
import { arcSolve, launchVel, staggerGuard } from './launcher';
import { blast, FRAG, type BlastReport } from './frag';

/** Every number of the round's flight and of what a dud does (the blast's numbers are frag.ts FRAG's: one blast). */
export const HE40 = {
  /** muzzle speed (m/s: the 40×46 mm low-velocity round), gravity, air drag (/s), contact radius (m), seconds of flight before it is simply gone (a round sent
   *  up and out over the lot), substeps a frame, and the passes of the elevation solve (launcher.ts launchVel) */
  speed: 76, gravity: 9.81, drag: 0.12, radius: 0.03, life: 2.5, substeps: 4, solveIters: 2,
  /** metres of its own path before the fuze is armed: anything it meets sooner gets a dud */
  armM: 8,
  /** how far off the surface it struck the burst is judged from (m): the blast's point must sit in the room, not in the plaster */
  standoff: 0.15,
  /** hearing ('prop' events, as the ring's): the tube's thump AT THE SHOOTER (not gunfire: a hollow pop, but a bigger one than the ring's), a dud slapping
   *  into a wall (who 0: a noise nobody can put a man behind), a dud into a civilian or Sam (into a guard the one noise is his fold's: launcher.ts staggerGuard) */
  launchNoise: 0.7, dudNoise: 0.45, dudHitNoise: 0.45,
  /** a dud: N·s into the chair it strikes, the share of its normal / sliding speed it keeps coming off a surface, and the most it carries on as an item */
  propJ: 9, restitution: 0.15, keepTangent: 0.3, spentSpeedMax: 6,
};
/** Every round's end, newest last (QA; capped): where, how far it had flown, armed or not, what it met, and the blast's report when there was one */
export interface ShellEnd { at: Vec3; flown: number; armed: boolean; met: 'static' | 'prop' | 'floor' | 'man' | 'air'; report: BlastReport | null; }
export const HE40_LOG: ShellEnd[] = [];
export const HE40_STATS = { fired: 0, bursts: 0, duds: 0, gone: 0 };
export function he40StatsReset() { HE40_LOG.length = 0; const S = HE40_STATS; S.fired = S.bursts = S.duds = S.gone = 0; }

/** One round in the air: where, how fast, how long, how many metres of its own path it has flown (the fuze), whose, its roll (for the picture) */
export interface Shell { pos: Vec3; vel: Vec3; age: number; flown: number; shooter: Character; spin: number; }

/** the length of a previewed arc (m), and whether a round that flew it would be armed where it lands */
export function arcLength(sol: ThrowSolution): number { let L = 0; for (let i = 1; i < sol.points.length; i++) L += v3.dist(sol.points[i - 1], sol.points[i]); return L; }
export function arcArmed(sol: ThrowSolution): boolean { return arcLength(sol) >= HE40.armM; }
/** the crown test both the flight and the preview hand combat.ts bodyHit: a round that starts inside a man's column, below his crown, has met him */
const insideAt = (pos: Vec3) => (c: Character) => pos[1] < (c.bones.headTop?.[1] ?? c.pos[1] + 1.75) + HE40.radius;
/** The living man under the reticle that a round can MEET: the puppet's target or the snapped man — never one of Sam's own side, whom a round in flight
 *  passes as his bullets do (updateShells): with a teammate under the reticle the round is aimed at, and previewed to, whatever is beyond him. */
export function shellMan(g: Game): Guard | null {
  const gd = g.puppet?.target && g.puppet.target.state !== 'dead' ? g.puppet.target : g.aimGuard;
  return gd && gd.state !== 'dead' && gd.team !== 'operative' ? gd : null;
}
/** The living bodies a round in flight stops on, as far as Sam can SEE them: the flight's own list (updateShells: everybody but his own side) less the men the
 *  fog of war hides — an arc that stopped short on an unseen man would give him away. */
export function shellBodies(g: Game): Character[] {
  const out: Character[] = [];
  for (const gd of g.guards) if (gd.state !== 'dead' && gd.team !== 'operative' && gd.char.alive && !g.fogOfWar.hidden(gd)) out.push(gd.char);
  for (const cv of civilianBodies(g)) if (cv.char.alive && !g.fogOfWar.hidden(cv)) out.push(cv.char);
  return out;
}
/** Where a round fired now from `from` at `target` would go (launcher.ts arcSolve by this round's table: the polyline the overlay draws, to the first static,
 *  leaf, prop or floor — the round's centre where it stops, which is where the flight counts its path to). Men are not in that solve, as they are not in the
 *  ring's — so the line is then cut where it first enters one of `bodies` (shellBodies: the men he can see), by the flight's own test: the round stops there,
 *  and whether it would be ARMED there (arcArmed: the reticle's word, the arc's colour) is the path to that man, not to the wall behind him. A man who moves
 *  in the tenth of a second it flies is met where he then is: the word is exact for one standing. */
export function shellSolve(g: Game, from: Vec3, target: Vec3, bodies: Character[] = []): ThrowSolution {
  const sol = arcSolve(g, from, target, HE40); if (!bodies.length) return sol;
  const P = sol.points;
  for (let i = 1; i < P.length; i++) {
    const seg = v3.sub(P[i], P[i - 1]), len = v3.len(seg); if (len < 1e-6) continue;
    const dir = v3.scale(seg, 1 / len), inside = insideAt(P[i - 1]); let best = Infinity;
    for (const c of bodies) { const t = bodyHit(c, P[i - 1], dir, len, inside); if (t >= 0 && t < best) best = t; }
    if (best < Infinity) { const land = v3.mad(P[i - 1], dir, best); return { v0: sol.v0, T: sol.T, points: [...P.slice(0, i), land], land }; }
  }
  return sol;
}
/** the 40 mm is up, its arc is drawn, and the arc is too short to arm: the one test behind the reticle's word, the arc's colour and the log's line */
export function previewTooClose(g: Game): boolean { const pl = g.player; return !!pl.throwPreview && pl.rifleUp && pl.rifle.attachment === 'he40' && !arcArmed(pl.throwPreview); }

/** The point to send a round at for what the reticle has: the CHEST of the man under it (led by his ground velocity over the flight), else the fixture, else
 *  the cursor's own point on the world — the floor by a doorway, the foot of a wall: a grenade is put on a spot. */
export function shellAimPoint(g: Game, from: Vec3): Vec3 {
  const gd = shellMan(g);
  if (gd) {
    const chest = v3.add(gd.char.bones.chest ?? v3.add(gd.char.pos, [0, 1.2, 0]), [0, 0, 0]);
    const tof = v3.dist(from, chest) / (HE40.speed * 0.97);
    return v3.mad(chest, [gd.char.vel[0], 0, gd.char.vel[2]], tof);
  }
  if (g.aimTarget) return v3.copy(g.aimTarget.pos);
  const ap = g.aimPoint; return [ap[0], ap[1] + 0.03, ap[2]];
}

/** Let one round go from `from` at `target` off `shooter`'s launcher: in the air from this frame (Game.shells), the tube's thump, and the room hears it go. */
export function fireShell(g: Game, shooter: Character, from: Vec3, target: Vec3): Shell {
  const sh: Shell = { pos: v3.copy(from), vel: launchVel(from, target, HE40), age: 0, flown: 0, shooter, spin: 0 };
  g.shells.push(sh); HE40_STATS.fired++;
  g.audio.play('launcher', from, 1.0, { rate: 0.6 });   // (no sample of its own yet: the ring launcher's, pitched down to a thump)
  g.events.push({ kind: 'prop', pos: v3.copy(shooter.pos), time: g.time, loud: false, level: HE40.launchNoise, who: shooter.id });
  if (shooter === g.player.char) g.player.noise = Math.max(g.player.noise, HE40.launchNoise);
  return sh;
}

function logEnd(e: ShellEnd) { HE40_LOG.push(e); if (HE40_LOG.length > 32) HE40_LOG.shift(); }
/** ARMED and stopped: the burst, judged from `pt` (a point in the room, HE40.standoff off whatever it struck) — frag.ts's blast and nothing else. */
function burst(g: Game, sh: Shell, pt: Vec3, met: ShellEnd['met']) {
  const report = blast(g, [pt[0], pt[1] - FRAG.lift, pt[2]], { who: sh.shooter.id, name: '40 mm grenade' });   // (blast() judges from FRAG.lift over the point it is given: handed the point that much lower, it judges from `pt`)
  HE40_STATS.bursts++; logEnd({ at: v3.copy(pt), flown: sh.flown, armed: true, met, report });
}
/** velocity coming back off a surface with normal n (a dud): most of it gone into the slap */
function bounceOff(v: Vec3, n: Vec3): Vec3 { const vn = v3.dot(v, n); const vN = v3.scale(n, vn), vT = v3.sub(v, vN); return v3.add(v3.scale(vT, HE40.keepTangent), v3.scale(vN, vn < 0 ? -HE40.restitution : 1)); }
/** NOT armed and stopped: from here it is a 'shell' item with whatever motion is left in it — inert for good — and the slap is a noise the room hears */
function dud(g: Game, sh: Shell, at: Vec3, vel: Vec3, met: ShellEnd['met'], noise = HE40.dudNoise, who = 0) {
  const sp = v3.len(vel); if (sp > HE40.spentSpeedMax) vel = v3.scale(vel, HE40.spentSpeedMax / sp);
  const it = g.items.spawn('shell', v3.copy(at), vel, { who: sh.shooter.id, heading: v3.yawOf(vel) });
  it.onBounce = (s, p, g) => { if (s > 1.0) g.audio.play('canisterBounce', p, Math.min(0.7, s / 8), { rate: 0.8 }); };   // its skitters after the slap: sound only (the slap was the event)
  g.audio.play('canisterBounce', at, 0.8, { rate: 0.7 }); clackFx(g, at);
  if (noise > 0) g.events.push({ kind: 'prop', pos: [at[0], 0, at[2]], time: g.time, loud: false, level: noise, who });
  if (sh.shooter.id === PLAYER_ID) g.msg(`the 40 mm was a dud because it hit something ${sh.flown.toFixed(1)} m out, short of the ${HE40.armM} m it needs to arm`);
  HE40_STATS.duds++; logEnd({ at: v3.copy(at), flown: sh.flown, armed: false, met, report: null });
}

/** One frame of every round in the air: drag and gravity in substeps, and along each substep's segment the first thing it meets — a living man other than its
 *  shooter and his own side (a round passes a teammate as his bullets do: combat.ts — the BLAST does not), a static or a door leaf, loose furniture, the floor.
 *  Armed (HE40.armM of path flown at the point of meeting): the burst there. Not: a dud. */
export function updateShells(g: Game, dt: number) {
  const R = HE40;
  for (let i = g.shells.length - 1; i >= 0; i--) {
    const r = g.shells[i]; let done = false;
    const h = dt / R.substeps;
    for (let s = 0; s < R.substeps && !done; s++) {
      r.age += h; r.spin += 40 * h;
      const k = Math.exp(-R.drag * h); r.vel = [r.vel[0] * k, r.vel[1] * k - R.gravity * h, r.vel[2] * k];
      const seg = v3.scale(r.vel, h); const len = v3.len(seg); if (len < 1e-6) continue;
      const dir = v3.scale(seg, 1 / len); const reach = len + R.radius;
      let best = Infinity; let hitC: Character | null = null; let hitG: Guard | null = null;
      const inside = insideAt(r.pos);
      const tryChar = (c: Character, gd: Guard | null) => { if (c === r.shooter || !c.alive) return; const t = bodyHit(c, r.pos, dir, reach, inside); if (t >= 0 && t < best) { best = t; hitC = c; hitG = gd; } };
      for (const gd of g.guards) if (gd.state !== 'dead' && gd.team !== 'operative') tryChar(gd.char, gd);
      for (const cv of civilianBodies(g)) tryChar(cv.char, cv);
      if (!g.player.down) tryChar(g.player.char, null);
      const st = g.col.raycast(r.pos, dir, reach); const ph = g.props.raycast(r.pos, dir, reach);
      const tS = st ? st.t : Infinity, tP = ph ? ph.t : Infinity;
      const armedAt = (t: number) => r.flown + Math.max(0, t) >= R.armM;
      if (hitC && best <= tS && best <= tP) {   // a man
        const at = v3.mad(r.pos, dir, best);
        if (armedAt(best)) { r.flown += best; burst(g, r, v3.mad(at, dir, -R.standoff), 'man'); }
        else { r.flown += best; dudHitsCharacter(g, r, hitC, hitG, dir, at); }
        done = true; break;
      }
      if (ph && tP <= tS) {   // furniture
        r.flown += Math.max(0, tP - R.radius); const hitP = v3.mad(r.pos, dir, tP);   // (its path is counted to where its CENTRE stops, as the preview's is)
        if (armedAt(0)) burst(g, r, v3.mad(hitP, ph.n, R.standoff), 'prop');
        else { g.props.applyImpulse(ph.prop, hitP, [dir[0] * R.propJ, 0, dir[2] * R.propJ], r.shooter.id, true); chipMark(g, hitP, ph.n, { box: ph.box, dynamic: true }); dud(g, r, v3.mad(r.pos, dir, Math.max(0, tP - R.radius)), bounceOff(r.vel, ph.n), 'prop'); }
        done = true; break;
      }
      if (st) {   // a wall, a slab, a leaf, a pane
        r.flown += Math.max(0, tS - R.radius); const hitP = v3.mad(r.pos, dir, tS);
        if (armedAt(0)) burst(g, r, v3.mad(hitP, st.n, R.standoff), 'static');
        else { chipMark(g, hitP, st.n, staticSurface(g, st.index)); dud(g, r, v3.mad(r.pos, dir, Math.max(0, tS - R.radius)), bounceOff(r.vel, st.n), 'static'); }
        done = true; break;
      }
      r.pos = v3.add(r.pos, seg); r.flown += len;
      if (r.pos[1] < R.radius) {   // the ground where no slab is under it
        const at: Vec3 = [r.pos[0], R.radius, r.pos[2]];
        if (armedAt(0)) burst(g, r, [at[0], R.standoff, at[2]], 'floor'); else dud(g, r, at, bounceOff(r.vel, [0, 1, 0]), 'floor');
        done = true; break;
      }
    }
    if (!done && r.age > R.life) { HE40_STATS.gone++; logEnd({ at: v3.copy(r.pos), flown: r.flown, armed: r.flown >= R.armM, met: 'air', report: null }); done = true; }   // up and out over the lot: gone
    if (done) g.shells.splice(i, 1);
  }
}

/** A round that had not armed has found a man: a quarter kilo at seventy metres a second, and no bang. A guard folds the way a ring in the body folds him
 *  (launcher.ts staggerGuard: rooted a moment, gun down, then alert toward where it came from); a civilian is frightened where she stands; Sam (somebody
 *  else's round, one day) flinches. It never does damage — and it drops at his feet, a dud. */
function dudHitsCharacter(g: Game, r: Shell, c: Character, gd: Guard | null, dir: Vec3, at: Vec3) {
  const R = HE40;
  if (!gd) { c.anim.hit(); g.audio.play('bodyHit', at, 0.6, { rate: 0.9 }); g.msg('a 40 mm round in the ribs — unarmed, luckily'); }
  else if (gd.civ) {
    c.anim.hit(); g.audio.play('bodyHit', v3.add(c.pos, [0, 1.1, 0]), 0.6, { rate: 0.9 });
    if (!gd.held) toAlarmed(g, gd, 'noise', [c.pos[0] - dir[0] * 4, 0, c.pos[2] - dir[2] * 4], false);
  } else staggerGuard(g, gd, dir, r.shooter);
  dud(g, r, v3.mad(at, dir, -0.06), [-dir[0] * 1.2, 0.8, -dir[2] * 1.2], 'man', gd && !gd.civ ? 0 : R.dudHitNoise, r.shooter.id);   // (a guard's fold is already the one noise of it: staggerGuard's, as a ring's)
}

/** Rounds in flight as boxes: the stubby body and its gold nose along the line of flight. Raster-only (NoShadow): nothing traces a 4 cm slug at 76 m/s. */
export function shellBoxes(g: Game, out: Box[]) {
  for (const r of g.shells) {
    const sp = v3.len(r.vel); if (sp < 1e-3) continue; const z = v3.scale(r.vel, 1 / sp);
    const up: Vec3 = Math.abs(z[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0]; const x0 = v3.normalize(v3.cross(up, z)); const y0 = v3.cross(z, x0);
    const ca = Math.cos(r.spin), sa = Math.sin(r.spin);
    const x: Vec3 = v3.mad(v3.scale(x0, ca), y0, sa), y: Vec3 = v3.mad(v3.scale(x0, -sa), y0, ca); const rot = quat.fromBasis(x, y, z);
    out.push(makeBox({ c: v3.copy(r.pos), h: v3.copy(SHELL_ITEM.half), yaw: v3.yawOf(z), rot, albedo: v3.copy(SHELL_ITEM.body), flags: BoxFlag.Dynamic | BoxFlag.NoShadow }));
    out.push(makeBox({ c: v3.mad(r.pos, z, 0.031), h: [0.021, 0.021, 0.02], yaw: v3.yawOf(z), rot, albedo: v3.copy(SHELL_ITEM.nose), flags: BoxFlag.Dynamic | BoxFlag.NoShadow }));
  }
}
