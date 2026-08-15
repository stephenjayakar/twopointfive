// Combat and kit: shots and hits, kills and what leaves dying hands, hand props / holsters / lasers, live throwables (canisters, stun) and their effects.
// (Split out of game.ts mechanically: plain functions taking the Game as their first argument; Game keeps one-line delegators for
//  anything other files call.)
import { Vec3, v3, clamp, lerp, quat } from '../math/vec';
import { Character } from './character';
import { CanisterParams } from '../smoke/types';
import { Box, BoxFlag, makeBox, rayBox, MKEY } from '../scene/boxes';
import { Item } from './throwables';
import * as fx from './effects';
import { rigBoxes, holsterBoxes, RIG } from './rigProps';
import { tally } from './mission';
import { chronShot, chronLightShot, chronDown, chronHit } from './chronicle';
import { witnessKill, hostageHitBark, inHand, rigOf, longRigOf } from './guards';
import { tacticsManDown } from './tactics';
import { Firearm, WEAPONS, WeaponDef, DropKind } from './weapons';
import { noteRound } from './suppression';
import { AIM_DEBUG } from './aim';
import { glassHit } from './glass';
import type { Game, Guard, ThrowKind, DownKind, DownBy } from './game';
import { isHostile, foeChar, type Team } from './teams';
import { bulletMark, bangScorch, staticSurface } from './marks';
import { gpuFx, impactFx, muzzleSparksFx, casingFx, bangFx, fixtureShatterFx, breakerSparkFx } from './particleFx';
import { civilianDown, civilianBodies } from './civilians';

// ------------------------------------------------------------ shooting
/** Per-round extras for fireWeapon. Everything a round IS comes from the weapon's row (weapons.ts); these are the shooter's circumstances. */
export interface FireOpts {
  /** extra cone: ± half of it per axis on the unit direction (the one-handed shot past a held man, player.ts HOLD_SPREAD; a burst opening round by round, guards.ts
   *  burstTrigger) — a guard's own hands (the row's aiSpread) are added on top of it inside; Sam's round otherwise goes exactly where it is sent */
  spread?: number;
  /** the row the round comes from — default: whatever the shooter carries (firearmOf: Sam's pistol, that guard's weapon) */
  weapon?: WeaponDef;
  /** a guard's DELIBERATELY laid round: his hands (aiSpread) are left out and only `spread` counts — the opening burst of a rifleman put into the wall beside Sam on
   *  purpose (guards.ts burstTrigger, tune.suppressFirst): a tight group where he meant it, never a lottery ticket that finds Sam after all */
  steady?: boolean;
}
/** The Firearm this character carries: the gun in Sam's hand (the Five-seveN drawn, or the FN2000 off the sling — else his pistol, which is what every scripted
 *  round of his has always been), or the weapon of the guard whose body it is. (A Character that is neither — nothing in the game, a stray in a harness — fires
 *  the 9 mm service pistol, which is all `isPlayer false` ever meant.) */
export function firearmOf(g: Game, shooter: Character, isPlayer: boolean): Firearm {
  if (isPlayer) return g.player.gunInHand() ?? g.player.pistol;
  return g.guards.find(x => x.char === shooter)?.weapon ?? (strayGun ??= new Firearm(WEAPONS.guard9mm));
}
let strayGun: Firearm | null = null;

/** One round from `shooter`'s muzzle at `target`, of the weapon he carries (or `o.weapon`): its row supplies the flash card, the light's gain, the report's voice and
 *  how the floor hears it, the kick it hands furniture, and — in a guard's hands — the spread. The player's own shot goes exactly where it is sent unless `o.spread`
 *  says otherwise (fired one-handed past a man in his arm: player.ts updateHold). The man Sam is holding is never in the way of Sam's round (the muzzle sits beside
 *  his jaw, inside his own body cylinder's reach: bodyHit's contact rule would put it in him). SIDES (teams.ts): a round can find any character of a side HOSTILE
 *  to the shooter's — Sam and the man in his arm for the staff, exactly as it was; hostile units for an operative and the other way about — and passes through
 *  everybody else as it always passed through a colleague (discipline keeps those rounds in, not luck; Sam's own rounds pass through an operative the same way). */
export function fireWeapon(g: Game, shooter: Character, target: Vec3, isPlayer: boolean, o: FireOpts = {}) {
  const sg = isPlayer ? null : g.guards.find(x => x.char === shooter) ?? null;   // the guard whose round this is (null: Sam, or a stray in a harness)
  const sgTeam: Team = isPlayer ? 'player' : sg?.team ?? 'guard';
  const def = o.weapon ?? firearmOf(g, shooter, isPlayer).def; let spread = o.spread ?? 0;
  shooter.anim.fire();
  if (isPlayer) tally(g, 'shots');
  const muzzle = v3.copy(shooter.muzzle);
  let dir = v3.normalize(v3.sub(target, muzzle));
  if (!isPlayer && !o.steady) { // guards are imperfect shots: wider when the target is moving fast or far away (their first rounds tend to go wide, then they settle) — the row's numbers, his hands
    const tc = (sg ? foeChar(g, sg) : null) ?? g.player.char;   // (off the man he is firing at: Sam for the staff — the expression it always was — his hostile man for a unit)
    const tv = Math.hypot(tc.vel[0], tc.vel[2]); const range = v3.dist(shooter.pos, tc.pos); const S = def.aiSpread;
    spread += S.base + Math.min(S.moveCap, tv * S.moveK) + Math.max(0, range - S.rangeFrom) * S.rangeK;
  }
  if (spread > 0) dir = v3.normalize([dir[0] + (Math.random() - 0.5) * spread, dir[1] + (Math.random() - 0.5) * spread, dir[2] + (Math.random() - 0.5) * spread]);
  // 1-frame emissive flash card (visible flame), boxes only — the row's flame (effects.ts muzzleFx)
  const M = fx.muzzleFx[def.muzzleFx];
  g.fx.push({ box: makeBox({ c: v3.mad(muzzle, dir, M.cardAhead), h: v3.copy(M.cardHalf), yaw: v3.yawOf(dir), albedo: v3.copy(fx.muzzleCard.albedo), emissive: v3.copy(M.cardEmissive), flags: BoxFlag.Dynamic | BoxFlag.NoShadow }), ttl: fx.muzzleCard.ttl });   // (copies: makeBox keeps the arrays it is given, and the row's numbers are nobody's to bend)
  // --- gas + light + powder: the graded shot from effects.ts — bore jet thrown down the barrel, two side-port puffs, the warm wisp that curls off
  // the barrel for seconds (tracks the muzzle, plus the small ejection-port curl), a narrow cone of spark streaks and the brief ~2000 K flash.
  // A suppressed weapon only dims the light; the gas is the same gas. (The ejection port 6 cm ahead of the wrist is a pistol fact still spelled out here: the long
  // guns eject well ahead of the hand — doc §12.4, their lanes' to place per row.)
  const track = () => ({ pos: shooter.muzzle, dir: shooter.gunDir });
  const port = () => ({ pos: v3.add(v3.mad(shooter.bones.handR ?? shooter.muzzle, shooter.gunDir, 0.06), [0, 0.06, 0]), dir: [0, 1, 0] as Vec3 });
  const gpu = gpuFx(g);   // GPU particles on: the powder sparks go to the GPU (muzzleSparksFx below, the same effects.ts numbers) instead of the box pool; the gas and the light are the same either way
  for (const L of fx.spawnShot(g.smoke, gpu ? null : g.sparks, muzzle, dir, { seed: g.fxSeed++, lightGain: M.lightGain * (def.suppressed ? fx.shot.suppressedGain : 1), lightRange: M.lightRange, track, eject: port }))
    g.engine.lights.flash(L.pos, L.color, L.intensity, L.range, L.ttl, shooter.id);
  if (gpu) { muzzleSparksFx(g, muzzle, dir, shooter); casingFx(g, shooter, def); }   // + the spent case out of the port (heard landing half a second on: particleFx.ts)
  g.audio.play(def.report.voice, muzzle, 1);
  // --- hit scan
  let tHit = 60; let hitGuard: Guard | null = null; let playerHit = false;
  const st = g.col.raycast(muzzle, dir, tHit); if (st) tHit = st.t;   // statics + door leaves
  const through = armThrough(g, shooter); if (through) tHit = 0;      // the pistol itself out through a panel (below): the round goes into that, at the muzzle
  if (through) glassAcrossArm(g, shooter, dir);                       // …and if that panel is an intact glass pane it goes (pressed to the glazing the muzzle is already past the sheet: the hit scan below starts beyond it and would never find it)
  // loose furniture in the line of fire gets knocked (below); it stops the round only if nobody is standing behind it — a chair back or a carton is
  // concealment, not cover, which keeps hits consistent with guard sight (props never block line of sight)
  const ph = through ? null : g.props.raycast(muzzle, dir, tHit);
  const contact = (c: Character) => { const h = c.bones.hips ?? c.pos; return (!st || st.t > Math.hypot(h[0] - muzzle[0], h[2] - muzzle[2])) && contactClear(g, shooter, c); };   // a contact shot (the muzzle already inside him, bodyHit) counts only with nothing solid nearer along the bore than his middle and no panel between the two chests
  // The man in Sam's arm (player.ts Hold — the human shield): a colleague's round meets whichever of the two bodies it reaches first (from in front of the pair that
  // is him: he dies by his own side's hand and Sam is untouched; from behind, Sam); Sam's own rounds never test him (the muzzle rides beside his ear, inside his
  // cylinder — bodyHit's contact rule would put every one of them in him; he cannot shoot his own shield). Every other colleague stays transparent to their fire:
  // muzzle discipline is what keeps those rounds in, not luck.
  const held = g.player.holding?.g ?? null; let hostageHit = false;
  if (through) { /* into the panel at the muzzle: nobody beyond it */ }
  else if (isPlayer) { for (const gd of g.guards) { if (gd === held || !isHostile('player', gd.team)) continue; const t = bodyHit(gd.char, muzzle, dir, tHit, contact); if (t >= 0 && t < tHit) { tHit = t; hitGuard = gd; } }   // (teams: a man of Sam's own side is as transparent to his round as a colleague is to a guard's)
    for (const cv of civilianBodies(g)) { const t = bodyHit(cv.char, muzzle, dir, tHit, contact); if (t >= 0 && t < tHit) { tHit = t; hitGuard = cv; } } }   // …and a CIVILIAN standing in the way of it is flesh like anybody (civilians.ts: the men's own rounds pass her as they pass a colleague — discipline, not luck, keeps those in)
  else {
    const tH = held && held.state !== 'dead' && held.char !== shooter ? bodyHit(held.char, muzzle, dir, tHit, contact) : -1;
    const t = isHostile(sgTeam, 'player') ? bodyHit(g.player.char, muzzle, dir, tHit, contact) : -1;   // (teams: an operative's round never tests Sam)
    if (tH >= 0 && (t < 0 || tH < t)) { tHit = tH; hitGuard = held; hostageHit = true; }
    else if (t >= 0) { tHit = t; playerHit = true; }
    for (const od of g.guards) {   // teams: every living man of a side hostile to the shooter's is a body this round can find — none for the staff (no AI side is their enemy: the loop finds nobody and their colleagues stay transparent, as ever)
      if (od === held || od.state === 'dead' || !od.char.alive || od.char === shooter || !isHostile(sgTeam, od.team) || od.god) continue;   // (god: a showcase cast's net — game.ts Guard.god — the round passes him as it passes a colleague)
      const to = bodyHit(od.char, muzzle, dir, tHit, contact); if (to >= 0 && to < tHit) { tHit = to; hitGuard = od; hostageHit = false; playerHit = false; }
    }
  }
  if (ph && !hitGuard && !playerHit) tHit = ph.t;
  const hitP = v3.mad(muzzle, dir, tHit);
  if (st && st.index < 1e6 && !hitGuard && !playerHit && !through && Math.abs(tHit - st.t) < 1e-6) glassHit(g, st.index, hitP, dir, shooter.id);   // the round stopped in a static: if that is a glass pane it stars it (glass.ts — a hole and cracks ON the pane, the crack heard; the pane holds: the next round stops in it too)
  noteRound(g, shooter, muzzle, hitP, hitGuard?.char ?? (playerHit ? g.player.char : null));   // suppression: everybody ELSE this segment passed close to, or stopped close to, has felt it go by (suppression.ts — the man it went into is shot, not suppressed)
  if (ph && ph.t <= tHit + 1e-3) { const J = def.propImpulse; g.props.applyImpulse(ph.prop, v3.mad(muzzle, dir, ph.t), [dir[0] * J, 0, dir[2] * J], shooter.id, true); }   // (not a prop standing behind the body the round stopped in) the row's few N·s, exaggerated over the real round so it reads: cartons hop, chairs twitch and roll — and it is heard at the prop
  // bullet wake through smoke volumes
  for (let d = 0.3; d < Math.min(tHit, 25); d += 0.28) { const p = v3.mad(muzzle, dir, d); if (g.smoke.inSmokeDomain(p)) g.smoke.push({ pos: p, dir, speed: 5.5, radius: 0.07 }); }
  // impact flash + sound
  g.engine.lights.flash(v3.mad(hitP, dir, -0.05), [1, 0.8, 0.5], 1.5, 2.5, 0.05, 0);
  const inGlass = !!(st && st.index < 1e6 && !through && Math.abs(tHit - st.t) < 1e-6 && (g.level.boxes[st.index]?.flags ?? 0) & BoxFlag.Glass);   // the round stopped in a pane / the solid bottle: glassHit above played its crack (or nothing for solid glass) — no wall thud, and no bullet decal on a box that is never rasterised (review 08-12)
  if (!hitGuard && !playerHit && !inGlass) g.audio.play('bulletImpact', hitP, 0.8);
  if (!hitGuard && !playerHit && !through && !inGlass) bulletMark(g, hitP, ph && ph.t <= tHit + 1e-3 ? ph.n : st ? st.n : [0, 1, 0], ph && ph.t <= tHit + 1e-3 ? { box: ph.box, dynamic: true } : st && st.t <= tHit + 1e-3 ? staticSurface(g, st.index) : null, def);   // decals (E1, marks.ts): the hole where the round stopped — in the furniture it knocked, else the static / the leaf it met; nothing in flesh, in the sky, or through the panel at the muzzle
  // …and what the round knocks out of what it stopped in (GPU particles; nothing with them off): sparks off the racks, chips and a puff of gypsum off a partition, splinters
  // off a leaf, by the material of the very box / prop / leaf the scan found — not for a round in a man, into the night, or into the panel at a muzzle pressed to it
  if (!hitGuard && !playerHit && !through) { if (ph && ph.t <= tHit + 1e-3) impactFx(g, hitP, dir, { n: ph.n, prop: ph.prop }, def); else if (st) impactFx(g, hitP, dir, { n: st.n, index: st.index }, def); }
  if (!hitGuard && !playerHit && !through) g.destr.round(shooter, hitP, dir, ph && ph.t <= tHit + 1e-3 ? { n: ph.n, prop: ph.prop, box: ph.box } : st ? { n: st.n, index: st.index } : { n: [0, 1, 0] }, def);   // DESTRUCTION (destruction.ts, behind tune.chaos — a return at 0): the beaten zone's heat and what this round does on top of the hole and the puff — paper up, dust into the smoke, a dent / shred / crack, things off the desk, a tile off the ceiling
  if (def.tracer && g.tune.tracers) g.tracers.round(firearmOf(g, shooter, isPlayer), def, muzzle, dir, tHit, hitGuard || playerHit ? 'flesh' : st || ph || through ? 'solid' : 'none', shooter.id);   // tracers (R6, tracers.ts): the row lights every third round and the last three of the box, counted off the gun that fired it — a streak travelling this same segment over the next few frames with a small light on its head, an ember where it stopped in geometry. A pistol row never asks (tracer null: not one instruction more than before); the flag off, nobody does
  if (hitGuard) {   // (by 'guard': the held man, above — the only colleague a guard's round ever tests — or, teams, an enemy AI man)
    const wasUp = hitGuard.state !== 'dead';
    const foeLine = sg && isHostile(sg.team, hitGuard.team) ? `${hitGuard.callsign} down — ${sg.callsign}'s round` : undefined;   // (teams: not 'hit by his own side' — he was the other side's to hit)
    killGuard(g, hitGuard, dir, false, 'shot', isPlayer ? 'player' : 'guard', foeLine); g.audio.play('bodyHit', hitP, 0.8);
    if (wasUp) hitGuard.killerId = shooter.id;   // (whose round it was, for the engagement's record — guards.ts tickEngagement)
    if (hostageHit) { const sh = sg; if (sh && sh.state !== 'dead') hostageHitBark(g, sh, hitGuard); }   // '…christ — I hit him': whoever fired it says so (the shot itself has everybody's ears; the hold drops from under Sam next frame — updateHold — and the men watching find the body there and then)
  }
  if (AIM_DEBUG.log && !isPlayer) { const pcD = g.player.char; const hp = pcD.bones.hips ?? pcD.pos; AIM_DEBUG.log(`round g${shooter.id}: muzzle (${muzzle.map(v => v.toFixed(2))}) → target (${target.map(v => v.toFixed(2))}) dir (${dir.map(v => v.toFixed(2))}) static ${st ? st.t.toFixed(2) : '-'} prop ${ph ? ph.t.toFixed(2) : '-'} through ${through} tHit ${tHit.toFixed(2)} playerHit ${playerHit} — Sam hips (${hp.map(v => v.toFixed(2))}) headTop ${(pcD.bones.headTop?.[1] ?? -1).toFixed(2)} pos (${pcD.pos.map(v => v.toFixed(2))})`); }   // (soak --trace)
  if (playerHit) { g.player.char.anim.hit(); g.player.hitFlash = 1; if (g.player.picking) { g.player.picking = null; g.player.fHeld = true; } g.audio.play('bodyHit', hitP, 0.9); if (!g.godMode) { hitPlayer(g, dir); chronHit(g, sg?.callsign); } }   // (a round in the vest ends any lock work, god mode or not — and that F press is spent; the debrief keeps whose round it was)
  // lights: a shot passing close to a fixture breaks it
  if (isPlayer) {
    for (const t of g.targets) {
      if (t.broken || !t.interactive || t.factor <= 0 && !t.on) continue;   // scenery (rack LEDs / glow strips) cannot be shot out
      const toT = v3.sub(t.pos, muzzle); const depth = v3.dot(toT, dir);
      if (depth > tHit + (t.kind === 'breaker' ? 0.08 : 0.3)) continue;                     // fixture is beyond what the round hit (wall-mounted breaker: no through-the-wall kills)
      const along = clamp(depth, 0, tHit); const dist = v3.len(v3.sub(toT, v3.scale(dir, along)));
      const rad = t.kind === 'emissive' ? 0.45 : t.kind === 'breaker' ? 0.4 : 0.3;
      if (dist < rad) {
        if (t.kind === 'breaker') { g.engine.lights.flash(t.pos, [0.6, 0.7, 1], 10, 5, 0.2, 0); g.audio.play('lightBreak', t.pos, 1); g.setBlackout(Infinity, 'shot'); t.broken = true; breakerSparkFx(g, t.pos, muzzle); break; }   // (+ the panel arcing over: GPU particles, nothing with them off)
        t.broken = true; g.msg(`shot out ${t.name}`); g.lightEvent(t); chronLightShot(g, t); g.engine.lights.flash(t.pos, [0.7, 0.8, 1], 6, 4, 0.12, 0); g.audio.play('lightBreak', t.pos, 1); if (t.kind !== 'device') fixtureShatterFx(g, t, muzzle); break;   // (+ the tube's glass and phosphor showering down: GPU particles; a camera / an emitter dies with its own sparks in devices.ts)
      }
    }
  }
  g.events.push({ kind: isPlayer ? 'shot' : 'guardShot', pos: v3.copy(shooter.pos), time: g.time, loud: def.report.loud, level: def.report.level, weapon: def.id, from: v3.copy(muzzle), to: v3.copy(hitP), who: shooter.id });   // gunfire — suppressed or not, every row is level 1 — carries through the whole floor on a dead-quiet night (hearingCheck: everyone goes to high alert); which row fired it, WHO did (teams: whose side's report it is) and the segment the round actually flew (muzzle → where it stopped) ride along for whoever reads rounds rather than reports (the QA soak's muzzle-discipline checks; suppression, R3)
  if (isPlayer) { g.player.noise = Math.max(g.player.noise, def.report.level); chronShot(g, def.short, hitGuard, hitP); }   // (max: a pane his round just smacked is louder than the suppressed report — glass.ts glassHit raised it first)   // the meter shows what the floor got: suppressed, not silent (hearingCheck) — and the debrief a row per burst (what it went into, whether a man stood near it)
}

/** fireWeapon, `through`: the panel between the gun shoulder and the muzzle is a glass pane → the round stars it point-blank (glass.ts glassHit; the round is
 *  spent in it either way). One raycast shoulder → muzzle over statics + leaves; a leaf (index ≥ 1e6) or an ordinary partition is left to armThrough's rule. */
function glassAcrossArm(g: Game, c: Character, dir: Vec3) {
  const from = c.bones.upperArmR ?? v3.add(c.pos, [0, 1.4, 0]); const d = v3.sub(c.muzzle, from); const L = v3.len(d); if (L < 1e-3) return;
  const rd = v3.scale(d, 1 / L); const h = g.col.raycast(from, rd, L);
  if (h && h.index < 1e6) glassHit(g, h.index, v3.mad(from, rd, h.t), dir, c.id);
}
/** The pistol itself poked out through a panel — the gun shoulder and the muzzle on opposite sides of a static or of a leaf standing (as good as) shut: a man
 *  pressed to a door has the reach to put his muzzle out of its far face, and a bore that starts beyond the wood sees nothing of it. fireWeapon puts that round
 *  into the panel at the muzzle; the guard AI (guards.ts) will not fire it, and steps clear if it lasts. An open leaf's free edge does not count (solidBetween). */
export function armThrough(g: Game, c: Character): boolean { return solidBetween(g, c.bones.upperArmR ?? v3.add(c.pos, [0, 1.4, 0]), c.muzzle); }

/** A panel between `from` and `to` — the things that keep two pressed men apart: a static (partition, jamb), or a leaf standing shut or as good as (within 0.3 rad
 *  of its frame: the SoundSeal bit Door.place keeps — latched or not, a leaf pulled to and resting on somebody is a full panel). A leaf standing open does not
 *  count: at its free edge the two are as good as touching, and it yields to them. (Short segments only: an arm, or two chests within a metre or so.) */
function solidBetween(g: Game, from: Vec3, to: Vec3): boolean {
  if (g.col.segmentBlockedDynamic(from, to, BoxFlag.SoundSeal)) return true;
  const d = v3.sub(to, from); const L = v3.len(d); if (L < 1e-3) return false; const rd = v3.scale(d, 1 / L);
  const n = g.col.gather(Math.min(from[0], to[0]) - 0.1, Math.min(from[2], to[2]) - 0.1, Math.max(from[0], to[0]) + 0.1, Math.max(from[2], to[2]) + 0.1, Math.min(from[1], to[1]) - 0.1, Math.max(from[1], to[1]) + 0.1, solidScratch);
  for (let i = 0; i < n; i++) if (rayBox(from, rd, g.col.boxes[solidScratch[i]], L)) return true;
  return false;
}
const solidScratch = new Int32Array(64);
/** May a contact shot from `a` count on `b` (bodyHit): no panel between their chests — each shoved to his own face of a shut door, the pistol's reach still puts
 *  the muzzle inside the other's cylinder, and that must not fire into a chest through the wood. Only asked when they are close enough to be in contact. */
function contactClear(g: Game, a: Character, b: Character): boolean {
  if (v3.distXZ(a.pos, b.pos) > 1.2) return true;   // (not in contact anyway: bodyHit's inside test cannot pass, whatever this says)
  const from = v3.add(a.pos, [0, 1.1, 0]); const h = b.bones.hips ?? b.pos; const to: Vec3 = [h[0], 1.1, h[2]];
  return !solidBetween(g, from, to);
}

/** Character.rayHit — where a round from `ro` along `rd` enters the man — plus the contact shot: a muzzle already INSIDE his body cylinder (pressed into his chest
 *  at arm's length, the way a guard who has pushed through a leaf onto Sam ends up) is a hit where it is. rayHit only reports rounds entering the cylinder from
 *  outside, so point-blank was a blind spot: a man planted on top of Sam firing round after round clean through him. `contact` — false, or a test paid for only
 *  once the muzzle is found inside him (fireWeapon: no panel between the two, nothing solid nearer along the bore) — gates that case; the lasers ask for the
 *  entering hit only (a stacked pair's beams pass through each other's backs as they always did rather than blank). */
export function bodyHit(c: Character, ro: Vec3, rd: Vec3, tmax: number, contact: boolean | ((c: Character) => boolean) = true): number {
  const t = c.rayHit(ro, rd, tmax); if (t >= 0 || !c.alive || !contact) return t;
  if (!c.insideBody(ro, 0.25)) return -1;   // (the same two columns rayHit enters — 0.28 about the hips soles to crown, the chest's when the trunk leans off them; +0.25 over the crown: a standing man's muzzle pressed down onto a crouched one sits about there)
  return contact === true || contact(c) ? 0 : -1;   // (the panel test is only paid for once the muzzle IS inside him)
}

/** A man goes down: `how` he went (shot = dead; struck — the takedown's cross — or choked = out cold, breathing: Guard.downKind, isBreathing) and `by` whose hand
 *  (only the player's own doing goes on the debrief card: a kill for a shot, a knockout otherwise). His state is 'dead' whichever it was — the floor treats a man
 *  out cold exactly as a corpse (he fails the radio check, his body raises the alarm, his role is re-dealt once they know) — only what the men SAY over him, the
 *  card, and the witnesses' memory of it differ. `quiet` is the physical side: no clatter, the item laid down, the body folding where it stood. The defaults keep
 *  the two old call shapes meaning what they meant: (dir) = shot by the player, (dir, true) = the takedown.
 *  `line`: the log line if the default for `how` does not say it (the pistol-whip is 'struck' like the takedown, but not a takedown).
 *  TODO (docs/internal/grab-interrogate-design.md §6, item 9b): a breathing man could come round after a few minutes — there is no way back from a ragdoll today
 *  (Character.ragdollize is one-way, no get-up clip), so nobody wakes; and a body on the floor cannot be shot (Character.rayHit skips the fallen), so a knockout
 *  cannot be finished off either. */
export function killGuard(g: Game, gd: Guard, dir: Vec3, quiet = false, how: DownKind = quiet ? 'struck' : 'shot', by: DownBy = 'player', line?: string) {
  // (below: state checks come first everywhere, but a corpse should not carry choreography around)
  if (gd.civ) { civilianDown(g, gd, dir, quiet, how, by, line); return; }   // a CIVILIAN (the cleaner, the late worker — every path that puts a 'Guard' down comes through here: the round, the cross, the choke, the whip, the ring): her own record, her own price on the card, nothing in her hands to fall (civilians.ts)
  if (gd.bubble && g.time - gd.bubble.t < 0.8) g.msg('guard: ' + gd.bubble.text);   // he did not get to finish saying it on screen
  if (gd.state === 'dead') return;
  gd.script = null;   // (his lockdown role — leader / post — deliberately stays on the corpse: the others only re-deal once they KNOW, see superviseLockdown)
  const held = inHand(gd);   // what is in the hand as he goes (guards.ts): the torch on a calm patrol, his drawn weapon otherwise (alarmed floor, or any other state) — nothing if the torch already went at the grab
  if (by === 'player') { tally(g, how === 'shot' ? 'kills' : 'knockouts'); chronDown(g, gd, how, line); }   // (a man dropped by his own side's round or by the world is on nobody's card — nor on the debrief's timeline)
  witnessKill(g, gd, how, by);   // whoever has it in view remembers seeing it done, and to whom (before his state flips: the observers are the OTHER living men)
  if (gd.torchLostAt < 0) gd.lightLitAtLoss = gd.flashlight.enabled;   // (before anything below turns it off: what the sputter-on-the-floor may show — a light that was dark stays dark)
  gd.state = 'dead'; gd.speed = 0; gd.diedAt = g.time; gd.downKind = how; gd.downBy = by;
  tacticsManDown(g, gd);   // (pursuit tactics: down within a couple of metres of a doorway under a colleague's eyes — that doorway is a kill zone for his side, tactics.ts)
  const W = gd.weapon.def;
  if (held) gd.dropped = dropFromHand(g, gd.char, held === 'torch' ? 'torch' : W.drop, held === 'torch' ? gd.beamDir : gd.char.gunDir, quiet ? [0, 0, 0] : dir, held === 'weapon' && W.suppressed, quiet);   // it leaves the hand — the row says as what (the holstered one stays on the thigh); a takedown lays it down quietly; an empty hand has nothing more to let go of
  // hand him to the ragdoll: thrown along the round (falls away from the shooter) or, for a takedown, folding forward where he stood; it collides with the
  // walls / furniture / door leaves itself, and the thud plays when the trunk actually lands (updateGuard → bodyThud)
  gd.char.ragdollize(g.col, dir, quiet);
  g.msg(line ?? (how === 'choked' ? 'choked out — he\'ll keep, breathing' : how === 'struck' ? 'takedown — out cold, breathing (a knockout, not a kill)' : by === 'guard' ? 'guard down — hit by his own side' : 'guard down — dead'));
}

/** What a dying hand lets go of: an item at the hand, carrying the body's motion plus a nudge along the round, spinning as it goes. It clatters (audible to the room)
 *  on its first hard bounces. kind 'torch' or a weapon row's drop kind ('pistol'; 'rifle' — a rifleman's whole carbine, throwables RIFLE_ITEM: heavier, so it
 *  tumbles slower and clatters lower, and lies there for as long as a sidearm does, lit by whatever lights it, its own weapon light sputtering out on it like a
 *  dropped torch — guards.ts attachFlashlight rides gd.dropped whatever it is); `suppressed` = drawn with its can (fill 1: Sam's Five-seveN). Once down it is set
 *  dressing: nothing on the floor is picked up — a guard's magazines do not fit the Five-seveN, so a dead man's gun is no ammunition (player.ts buildInteractables
 *  offers no row for it). */
export function dropFromHand(g: Game, c: Character, kind: 'torch' | DropKind, along: Vec3, dir: Vec3, suppressed = false, quiet = false): Item {
  const h = c.bones.handR ?? v3.add(c.pos, [0, 1.0, 0]);
  const v: Vec3 = [c.vel[0] * 0.6 + dir[0] * 1.1 + (Math.random() - 0.5) * 0.6, 0.9 + Math.random() * 0.6, c.vel[2] * 0.6 + dir[2] * 1.1 + (Math.random() - 0.5) * 0.6];
  const it = g.items.spawn(kind, [h[0], Math.max(0.25, h[1]), h[2]], v, { who: c.id, fill: suppressed ? 1 : 0, heading: v3.yawOf(along), yaw: v3.yawOf(along), life: kind === 'torch' ? 90 : GUN_ITEM_LIFE });
  if (kind === 'rifle') { it.tumbleRate *= 0.55; it.spin *= 0.5; }   // 0.7 m and 2.7 kg of it: it turns over on the way down, it does not flick round like a pistol
  let clatters = 0;
  it.onBounce = (sp, p) => { if (sp < 0.7) return; g.audio.play('magDrop', p, Math.min(1, sp / 3) * (quiet ? 0.5 : 1), { rate: kind === 'pistol' ? 0.72 : kind === 'rifle' ? 0.6 : 0.85 }); if (!quiet && clatters++ < 2) g.events.push({ kind: 'prop', pos: v3.copy(p), time: g.time, loud: false, level: Math.min(0.5, 0.2 + sp * 0.08), who: 0 }); };   // who 0: nobody living made it — a clatter the room cannot explain (a guard-attributed noise would be shrugged off)
  return it;
}
/** seconds a dropped gun lies there, sidearm or rifle (a torch goes sooner: 90) */
const GUN_ITEM_LIFE = 240;

export function hitPlayer(g: Game, fromDir: Vec3) {
  const pl = g.player; if (pl.down) return;
  pl.hitsLeft = Math.max(0, pl.hitsLeft - 1);
  if (pl.hitsLeft === 0) {
    const inHand = pl.gunInHand();                       // (read while the hands are still as the round found them: hauling a body slings the rifle, and letting go below would put it back 'in the hand')
    if (pl.dragging) g.toggleDrag();                     // lets go of the ankles (unpins them)
    if (pl.holding) g.freeHeld('shot');                  // the man in his arm staggers free — and turns on him knowing everything (player.ts handBack)
    pl.down = true; pl.sprinting = false; pl.crouch = false; pl.char.vel = [0, 0, 0];
    if (pl.wall) { pl.wall = null; pl.char.anim.stance = 'none'; pl.char.anim.lookYawExtra = 0; }   // off the wall the moment he drops (updatePlayer's down branch would only let go next frame)
    pl.pistol.cancelReload(); pl.rifle.cancelReload(); pl.char.anim.cancelReload(); pl.throwHeld = false; pl.pendingThrow = null;
    if (inHand) { dropFromHand(g, pl.char, inHand.def.drop, pl.char.gunDir, fromDir, inHand.def.suppressed); if (inHand === pl.rifle) pl.rifleGone = true; }   // what was in the hand leaves it — the Five-seveN can and all, or the whole FN2000 (its own item body: 'rifle' fill 1); a holstered pistol stays on the thigh, a slung rifle on his back
    pl.char.ragdollize(g.col, fromDir, false);            // thrown along the round, like the guards; the thud plays when the trunk lands (updatePlayer)
    { const ck = g.saves?.newest(true, g.mission.stats.elapsed); g.msg(ck && g.saves.isThisRun(ck) ? "you're down — Enter goes back to the last checkpoint (Shift+Enter restarts the encounter)" : "you're down — Enter to restart the encounter"); }   // (game/savestate.ts: the down card's default is that checkpoint too)
  } else g.msg(pl.hitsLeft === 1 ? 'hit — one more and you are down' : 'you were hit');
}

/** Held / worn props as small oriented boxes (traced; lit lenses raster-only): the Five-seveN (+ can + rail light) in the player's hand and the trifocal goggles on
 *  their head, pistol or torch with a glowing lens for guards. All placement numbers live in rigProps.RIG (tune them in viewer.html). */
export function handProps(g: Game, out: Box[]) {
  const n0 = out.length;
  handPropsRaw(g, out);
  // MOTION IDENTITY (scene/boxes.ts MKEY.rig): every rig box carries its man's id in `owner`; key = owner + the box's ordinal among HIS boxes this frame — stable for as long as his kit state
  // holds (a holster / draw reshuffles his parts for one frame, which the old index rule got wrong for everybody after him in the list every such frame)
  const ord = handOrd; ord.fill(0);
  for (let k = n0; k < out.length; k++) { const b = out[k]; const o = b.owner & 0xff; if (o === 0) continue; b.mkey = MKEY.rig + (o << 8) + Math.min(255, ord[o]++); }   // (owner 0 = the weapon lasers' beam + dot, shared by every hunting man and re-cut every frame: left on the index rule)
}
const handOrd = new Uint16Array(256);
function handPropsRaw(g: Game, out: Box[]) {
  const pl = g.player;
  const busy = pl.char.anim.hideHeldItem;   // hands on the lock tools (anim.lockpick) or both round a held man (the arm variant): empty hand, the Five-seveN on the thigh, no can, no lit lens — whatever the kit says. Holding a man with the pistol drawn (the gun variant) it stays in the hand — up beside his head, laid along the hold layer's gun hand like any carry — and its rail light with it if L had it on (updateHold poses the light off the same hand); drawn mid-hold (E) it comes into the fist as the animator's hand-over passes half way (holdGunSide), the fist then behind the man's shoulder; holstered mid-hold it is on the thigh from the key's frame like any E
  // the can in the hand: during a throw it is the one being thrown until the release frame and nothing for the rest of the swing (whatever the
  // count says — the count drops at release, which used to pop the next can into the follow-through and empty the hand while winding up the last one)
  // Which can, if any: the ONE rule is Player.canisterSel — a canister slot SELECTED (and, below, drawn: not holstered / busy / down …). It used to read 'any slot but
  // the pistol's', which was every canister slot in the three-slot kit and became 'the rifle too' the day the kit grew a fourth: the smoke can rode in the fist
  // beside the FN2000 (playtest 08-08). player.ts throws by the same accessor, so what the fist shows is what a click would throw.
  const kindSel = pl.canisterSel; const an = pl.char.anim;
  const held: 'smoke' | 'flash' | null = pl.down || busy || !kindSel || pl.holstered || pl.dragging || pl.sprinting ? null
    : an.inThrow ? (an.throwing ? (pl.pendingThrow?.kind === 'flash' ? 'flash' : pl.pendingThrow ? 'smoke' : kindSel) : null)
    : g.throwCount(kindSel) > 0 ? kindSel : null;
  const knife = !!pl.holding && pl.holding.variant === 'arm' && !pl.down && !an.holdGunSide;   // a man held with the hands empty: the knife is out, in the fist at his throat (character.ts holdLayer poses it) — for exactly as long as the hold lasts, sheathed again the frame it ends however it ends; swapped mid-hold (E) the old tool leaves the fist on the key's frame (the variant / Player.holstered change there) and the other arrives half way through the animator's hand-over, the fist then back behind the man's shoulder (holdGunSide) — never the two in one fist
  // the FN2000: in both hands (selected and off the sling, hands not busy on a lock or a man, not hauling a body — the animator's long gun then, player.ts), else slung across
  // his back for as long as the kit has it; gone from a downed man's hands if that is where the round found it (hitPlayer dropped the item), still on his back if it was there.
  // One place a frame.
  const rifle: 'hand' | 'slung' | null = !pl.hasRifle ? null : pl.down ? (pl.rifleGone ? null : 'slung') : pl.rifleUp && !busy ? 'hand' : 'slung';
  const pistolInHand = pl.pistolUp && !pl.down && !busy;   // (rigProps' `slot`: 1 = the Five-seveN in the right hand, anything else = not — it never was the kit's slot number, only ever compared with 1)
  rigBoxes(pl.char, { goggles: true, nv: pl.nv, slot: pistolInHand ? 1 : 0, lightOn: pl.pistol.lightOn && pistolInHand && !pl.sprinting, isGuard: false, holster: !(pl.down && pl.pistolUp), held, knife, rifle, rifleLight: rifle === 'hand' && pl.rifle.lightOn && !pl.sprinting }, out);   // holstered (E): empty hands, the pistol drawn on the thigh   // canister up (or the rifle in the hands): gun on the thigh, can in the fist only if a can is what is selected; down: whatever was in the hand has left it (dropFromHand) — a holstered gun stays holstered, the goggles stay on   // (the light itself is forced off while down / sprinting: no blazing lens then)   // (a downed player's light is forced off in updatePlayer: no lit lens on the body either)
  for (const gd of g.guards) {
    const rk = rigOf(gd); const carbine = rk === 'carbine';   // rifles (guards.ts rigOf): the carbine is in both hands in every living state, its light on the handguard, the sidearm on the thigh throughout; dying, the whole rifle leaves his hands (killGuard → the row's 'rifle' drop) and the sidearm he never drew stays on the body
    if (gd.state === 'dead') { if (gd.dropped?.kind === 'torch' || gd.dropped?.kind === 'rifle') holsterBoxes(gd.char, out, rk === 'sc20k' ? { slide: RIG.pistol.slide, grip: RIG.pistol.grip, suppressor: RIG.pistol.suppressor } : { slide: RIG.guardPistol.slide, grip: RIG.guardPistol.grip }); continue; }   // what he held is on the floor; a man who died on patrol — or a rifleman, whose sidearm never left the thigh — still wears his sidearm (an operative's, the suppressed one he wore alive)
    const fl = gd.flashlight;   // torch carried in the hand on a calm patrol (the spot light sits at its lens), drawn pistol with a weapon light otherwise (an alarmed floor patrols drawn: Guard.drawn) — guards.ts handCarry / inHand
    const held = inHand(gd);
    if (!held) { holsterBoxes(gd.char, out, { slide: RIG.guardPistol.slide, grip: RIG.guardPistol.grip }); continue; }   // his torch is on the floor (knocked out at the grab) and the pistol stays holstered: empty hands
    if (rk === 'sc20k') { rigBoxes(gd.char, { goggles: false, nv: false, slot: 0, lightOn: false, isGuard: false, holster: true, rifle: 'hand', rifleLight: fl.enabled }, out); if ((gd.state === 'alert' || gd.state === 'search') && !gd.muzzleDown && !gd.held) laserBoxes(g, gd, out); continue; }   // (teams: a man handed Sam's bullpup — the showcase's operative — is drawn through Sam's own kit path: the FN2000 in both hands, a sidearm on the thigh, no goggles)
    rigBoxes(gd.char, { goggles: false, nv: false, slot: 1, lightOn: fl.enabled, isGuard: true, torch: held === 'torch', beamDir: gd.beamDir, lensColor: fl.color, weapon: carbine ? 'carbine' : 'pistol' }, out);
    if ((gd.state === 'alert' || gd.state === 'search') && !gd.muzzleDown && !gd.held) laserBoxes(g, gd, out);   // drawn and hunting: the sidearm's laser is on — thumb off the switch while the gun is down for a colleague in the line (guards.ts muzzleCheck): nobody paints the back of the man ahead of him; pinned in Sam's arm the hand is off it altogether
  }
}

/** A hunting guard's weapon laser: a hair-thin emissive line from the muzzle to whatever it meets (wall, prop, Sam) and a brighter dot there. Purely
 *  emissive geometry flagged NoShadow, so no ray (light, sight, bullet, cursor) ever sees it; in the haze it reads exactly like a laser in smoke, and it
 *  tells you precisely where he is looking. */
export function laserBoxes(g: Game, gd: Guard, out: Box[]) {
  const c = gd.char; const from = v3.mad(c.muzzle, c.gunDir, 0.02); const dir = c.gunDir;
  if (!isFinite(dir[0]) || v3.len(dir) < 0.5) return;
  let L = 30; const wh = g.engine.world.raycast(from, dir, L, BoxFlag.NoShadow | BoxFlag.Glass, c.id & 0xff); if (wh) L = wh.t;   // (glass: the dot lands on the man behind the pane, as the light does) · ceilings (NoPrimary) DO stop it — a flailing dazzled man must not paint a 30 m line through the roof
  const ph = g.props.raycast(from, dir, L); if (ph) L = Math.min(L, ph.t);
  { const tp = g.player.char.rayHit(from, dir, L); if (tp >= 0) L = Math.min(L, tp); }   // (a live Sam stops it; bodies on the floor do not — rayHit ignores the dead; a muzzle inside a body — the man stacked ahead — draws through, not blank)
  for (const o of g.guards) { if (o === gd || o.state === 'dead') continue; const t = o.char.rayHit(from, dir, L); if (t >= 0) L = Math.min(L, t); }
  if (L < 0.05) return;
  beamBoxes(g, from, dir, L, out, !!(wh || ph || L < 30));
}
/** A red laser line from `from` along unit `dir` for `L` metres, and (dot) the bright bead where it lands: hair-thin emissive geometry flagged NoShadow — no ray
 *  (light, sight, bullet, cursor) ever sees it, in the haze it reads as a laser in smoke. The hunting guard's weapon laser above, and the tripwires' beams
 *  (devices.ts) — one draw for both. */
export function beamBoxes(g: Game, from: Vec3, dir: Vec3, L: number, out: Box[], dot: boolean) {
  const red: Vec3 = [1, 0.06, 0.03];
  const hw = Math.max(0.0022, 0.45 * g.mPerPx); const gain = 0.0022 / hw;   // never thinner than ~a pixel (a 4 mm beam at 15 m is a crawling dashed line otherwise); widened → dimmed by the same factor so the line carries the same light
  const up: Vec3 = Math.abs(dir[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0]; const x = v3.normalize(v3.cross(up, dir)); const y = v3.cross(dir, x);
  out.push(makeBox({ c: v3.mad(from, dir, L / 2), h: [hw, hw, L / 2], yaw: v3.yawOf(dir), rot: quat.fromBasis(x, y, dir), albedo: [0.02, 0, 0], emissive: v3.scale(red, 9 * gain), flags: BoxFlag.NoShadow | BoxFlag.Dynamic }));
  if (dot) { const end = v3.mad(from, dir, L - 0.006); out.push(makeBox({ c: end, h: [0.011, 0.011, 0.011], yaw: 0, albedo: [0.05, 0, 0], emissive: v3.scale(red, 40), flags: BoxFlag.NoShadow | BoxFlag.Dynamic })); }   // the dot: a small bright bead where the beam lands
}

export function updateItems(g: Game, dt: number) {
  g.items.update(dt);
  for (const it of g.items.items) {
    if (it.kind === 'smoke') {
      if (!it.fired) { it.fuse -= dt; if (it.fuse <= 0) { it.fired = true; startCanister(g, it); } }
      else if (it.emitT > 0) { it.emitT -= dt; }
    } else if (it.kind === 'flash' && !it.fired) {
      // stun canister: the fuse runs from first contact (it goes off where it lands, ON a surface — the whole shape depends on that). maxAir is a
      // cap on FLIGHT only — once it has landed the fuse alone decides, or a long throw would eat into it and `bang.fuse` would stop meaning anything
      const landed = it.bounces > 0 || it.settled;
      if (landed) it.fuse -= dt;
      if (it.fuse <= 0 || (!landed && it.age > fx.bang.maxAir)) { it.fired = true; detonateStun(g, it); }
    }
  }
}

/** the attached solver's canister tuning (SmokeSystem.params), or null behind a stand-in without any */
export function smokeParams(g: Game): CanisterParams | null { return g.smoke.params ?? null; }

export function startCanister(g: Game, it: Item) {
  let seconds: number;
  if (fx.flags.ventCanister) {
    // the graded can: a cold dense jet along the throw direction that hugs the floor and piles up (effects.ts `vent`); the mouth follows the can while it still rolls
    const yaw = it.heading;
    seconds = fx.spawnVent(g.smoke, fx.ventMouth(it.pos, yaw), yaw, { track: () => ({ pos: fx.ventMouth(it.pos, yaw), dir: [Math.sin(yaw), 0, Math.cos(yaw)] }) });
  } else {
    const P = smokeParams(g) ?? { canisterDuration: 32, canisterDensity: 95, canisterRadius: 0.2, canisterTemp: 1.6, canisterSpeed: 1.9 }; seconds = P.canisterDuration;
    g.smoke.emit({ pos: v3.add(it.pos, [0, 0.1, 0]), dir: [0, 1, 0], speed: P.canisterSpeed, radius: P.canisterRadius, density: P.canisterDensity, temperature: P.canisterTemp, ttl: P.canisterDuration, age: 0, kind: 'canister',
      track: () => ({ pos: v3.add(it.pos, [0, 0.12, 0]), dir: [0, 1, 0] }) });
  }
  it.emitT = seconds;
  g.audio.play('smokeHiss', it.pos, 1, { duration: seconds });
  g.msg('smoke deployed');
  g.events.push({ kind: 'shot', pos: v3.copy(it.pos), time: g.time, loud: false });   // the pop draws attention nearby
}

/** The stun canister goes off: graded burst (jets, wisp, sparks + trails) on the coarse smoke lattice, the white flash, the bang every guard on the
 *  floor hears, and the gameplay effect — guards with line of sight within bang.dazzleRadius are dazzled (Guard.dazzledUntil: canSee() fails, they
 *  cannot fire, and reactT roots them to the spot), then go and look at where it went off like any other loud noise. */
export function detonateStun(g: Game, it: Item) {
  const B = fx.bang; const at: Vec3 = [it.pos[0], it.pos[1] + B.height, it.pos[2]];
  const gpu = gpuFx(g);   // GPU particles on: the CPU pool only flies the dozen fragments that carry smoke trails (their emitters ride CPU positions); the four hundred you see and the dust ring are bangFx's
  const L = fx.spawnBurst(g.smoke, g.sparks, at, g.fxSeed++, gpu ? { sparkCount: Math.min(B.sparkCount, fx.flags.trails ? B.trailCount : 0) } : undefined);
  if (gpu) bangFx(g, at);
  const light = g.engine.lights.flash(L.pos, L.color, L.intensity, L.range, L.ttl, 0); if (L.radius) light.radius = L.radius;
  g.audio.play('stunBang', at, 1.0);
  bangScorch(g, at);   // decals (E1, marks.ts): the scorch on what it lay on and the splashes up whatever stands within a metre
  g.destr.bang(at, it.who);    // DESTRUCTION (destruction.ts, behind tune.chaos): the desk over it cleared, papers up in a ring, the tile above down, dust off the ceiling, the litter about it up again — what it knocks about is heard as the THROWER's doing
  const eye = g.player.char.bones.head ?? v3.add(g.player.char.pos, [0, 1.6, 0]);
  if (!g.player.down && v3.dist(eye, at) < B.dazzleRadius && !g.col.segmentBlocked(v3.add(at, [0, 0.3, 0]), eye)) g.audio.play('earRing', null, clamp(1.2 - v3.dist(eye, at) / B.dazzleRadius, 0.25, 0.8));
  g.events.push({ kind: 'bang', pos: v3.copy(at), time: g.time, loud: true });
  let n = 0;
  if (fx.flags.dazzle) for (const gd of g.guards) {
    if (gd.state === 'dead') continue;
    const head = gd.char.bones.head ?? v3.add(gd.char.pos, [0, 1.65, 0]); const d = v3.dist(head, at);
    if (d > B.dazzleRadius || g.col.segmentBlocked(v3.add(at, [0, 0.3, 0]), head)) continue;   // behind a wall or a closed door: only hears it
    const secs = lerp(B.dazzleSeconds, B.dazzleMin, clamp(d / B.dazzleRadius, 0, 1));
    gd.dazzledUntil = Math.max(gd.dazzledUntil, g.time + secs); gd.reactT = Math.max(gd.reactT, secs);   // reactT > 0 is the AI's existing "stand and stare" — reused as the stagger
    gd.awareness = Math.max(gd.awareness, 0.6); if (gd.state !== 'alert') gd.lastKnown = v3.copy(at);
    if (g.aiEnabled) gd.witness.dazzled++;   // (his memory of it; the bang itself reaches his ears through hearingCheck like everyone's — nothing is remembered with the AI off)
    gd.path = []; gd.pathGoal = null; gd.speed = 0; gd.char.anim.hit(); n++;
  }
  g.msg(n ? `stun canister — ${n} guard${n > 1 ? 's' : ''} dazzled` : 'stun canister went off');
}

/** Sandbox / panel: drop an armed canister at `p` as if it had just landed there, thrown from where the player stands (short fuse, no inventory cost). */
export function dropThrowable(g: Game, kind: ThrowKind, p: Vec3) {
  const from = g.player.char.pos; const heading = v3.yawTo(from, p);
  const it = g.items.spawn(kind === 'flash' ? 'flash' : 'smoke', [p[0], Math.max(p[1], 0) + 0.25, p[2]], [Math.sin(heading) * 0.5, 0, Math.cos(heading) * 0.5], { fuse: 0.35, heading });
  it.onBounce = (sp, q) => g.audio.play('canisterBounce', q, Math.min(1, sp / 4));
}
