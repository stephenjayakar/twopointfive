// Combat and kit: shots and hits, kills and what leaves dying hands, hand props / holsters / lasers, live throwables (canisters, stun) and their effects.
// (Split out of game.ts mechanically: plain functions taking the Game as their first argument; Game keeps one-line delegators for
//  anything other files call.)
import { railsSpare } from './rails';   // (asked inside killGuard only)
import { rollbackVar } from '../math/side';
import { Vec3, v3, clamp, lerp, quat } from '../math/vec';
import { wandDrop } from './wand';
import { DOORBLAST } from './doorblast';
import { Character, THROW_BY, THROW_RELEASE } from './character';
import { CanisterParams } from '../smoke/types';
import { Box, BoxFlag, makeBox, rayBox, MKEY } from '../scene/boxes';
import { Item } from './throwables';
import * as fx from './effects';
import { rigBoxes, holsterBoxes, gogglesBoxes, wristTieBoxes, bigBoxes, bigClearOf, hungBoxes, longHold, torchHold, freeCanBoxes, packSideBind, RIG } from './rigProps';
import { sideLocal } from './packside';   // (a leaf)
import { sideHung } from './gunslots';   // (called inside handProps only)
import { voiceOf, flameOf } from './gunlook';   // (called inside fireWeapon only)
import { stowHang, stowFired } from './workstow';   // (called inside guardProps / fireWeapon only)
import { bigCarried, bigFired } from './bigkit';   // (called inside handProps only: the big slot's tool a man carries — null with its switch off)
import { tally } from './mission';
import { chronShot, chronLightShot, chronDown, chronHit } from './chronicle';
import { plainShort } from './gear';   // (a leaf: a weapon's name as a chronicle row writes it — the same on and off the 2010s kit)
import { witnessKill, hostageHitBark, inHand, rigOf } from './guards';
import { runnerFled, runnerBare } from './runner';
import { handworkOn, swapHeld, beltTorch, workProps } from './handwork';
import { tacticsManDown } from './tactics';
import { moraleManDown } from './morale';
import { netQuietFall } from './netquiet';
import { CLOSE, closeBare } from './close';
import { KITANIM, kitShow, kitGunUp, kitSlingFront, kitSlingRest } from './kitanim';
import { Firearm, WEAPONS, WeaponDef, DropKind } from './weapons';
import { noteRound } from './suppression';
import { AIM_DEBUG } from './aim';
import { AIMCOST, AIMCOST_STATS, lampStruck, legsNear, type RoundLeg } from './aimcost';   // a lamp needs a real hit (a leaf)
import { glassHit } from './glass';
import { glassPenLive, roundEnergy, roundPath, commitCrossings, armThroughGlass, spentInPane, segAt, pathAt, type RoundPath } from './glasspen';
import { wallPenLive, thinPath, commitWalls, spentInWall, type WallCross } from './wallpen';
import { WINBARS, barsLive, barAt, barMeet, barsSettle, barsUnmeet, type BarMet } from './winbars';
import { DESTRUCTION } from './destructionSwitch';
import { chaosOf } from './destruction';
import { COVERFIRE } from './coverfire';
import type { Game, Guard, ThrowKind, DownKind, DownBy, LightTarget } from './game';
import { isHostile, foeChar, teamOfId, type Team } from './teams';
import { w } from './words';   // (a leaf: the dialogue pass's one switch)
import { fightLive, drilledK } from './roomfight';
import { nvgWorn, nvgDown } from './nvg';
import { kitPistol, kitIndex, kitYouNvg } from './kit';
import { INHAND, IN_PISTOL } from './inhand';
import { sideOfTeam } from './charLook';
import { laserBand, laserOn, irViewer, irNote, irViewAs, paintsOwn, samLaserBoxes, IR_TINT } from './irlaser';
import { thinNote, thinAir } from './thinline';
import { drawnBeam } from './stature';
import { bulletMark, bangScorch, staticSurface } from './marks';
import { gpuFx, impactFx, muzzleSparksFx, casingFx, bangFx, fixtureShatterFx, lensShatterFx, breakerSparkFx } from './particleFx';
import { fireHolds, fireStir, fireStruck } from './fire';   // a round does not put a fire out (FIRE.hardy)
import { lampGlass, deadLamp, CARLAMPS_STATS } from './carlamps';   // a vehicle's lamp is glass a round breaks, lit or not (a leaf)
import { civilianDown, civilianBodies, civiliansShown } from './civilians';
import { roundDoes, woundDown } from './wounds';
import { fireShell, pelletDrops, pelletEnd, type Shell } from './shotgun';
import { fragFuse, fragInFist, FRAG } from './frag';
import { GUNHAND } from './gunhand';
import { SAMSTUN, staggerPlayer, dazzlePlayer } from './samstun';
import { recapRound } from './deathrecap';
import { wallReport } from './blastFeel';
import { simRandom } from '../math/dice';   // the simulation's die (math/dice.ts): the Game's own when it has one, Math.random otherwise
import { ffLive, ffBody, ffSide, ffUnpressed, ffNote, ffPast } from './friendlyfire';   // (called inside fireWeapon only)
import { disarmHand } from './disarm';   // (called inside handProps only)
import { holdFireShot } from './holdfire';   // (called inside fireWeapon only)
import { sneakSuit } from './cast';   // (called inside handProps only: the sneaking suit's rifle is drawn black)

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
  /** fired with no target (a dazzled man emptying a burst down the door he was covering — nightbreach.ts): the round's report says so, and a colleague who hears
   *  it takes where the rounds are GOING as the place to look, never where the shooter's enemy stands (guards.ts colleagueFirePos) */
  blind?: boolean;
  /** one pellet of a shotgun's shell (shotgun.ts fireShell, the only caller that sets it): the first carries the shell's flash, report and hearing event; what a
   *  pellet in a man does is the pattern's to say (pelletDrops), and where each stopped is booked for the lock (pelletEnd) */
  pellet?: Shell;
}
/** The Firearm this character carries: the gun in Sam's hand (the Five-seveN drawn, or the FN2000 off the sling — else his pistol, which is what every scripted
 *  round of his has always been), or the weapon of the guard whose body it is. (A Character that is neither — nothing in the game, a stray in a harness — fires
 *  the 9 mm service pistol, which is all `isPlayer false` ever meant.) */
export function firearmOf(g: Game, shooter: Character, isPlayer: boolean): Firearm {
  if (isPlayer) return g.player.gunInHand() ?? g.player.pistol;
  return g.guards.find(x => x.char === shooter)?.weapon ?? (strayGun ??= new Firearm(WEAPONS.guard9mm));
}
let strayGun: Firearm | null = null;
rollbackVar('combat.strayGun', () => strayGun, v => { strayGun = v; });   // (a gun like any other once it is made: its rounds and its clock are fired off)

/** would the OLD near-is-a-hit rule have broken this fixture on these legs? (a count for the panel and the check: rounds the real-hit rule let pass) */
function nearLamp(t: LightTarget, legs: readonly RoundLeg[], slack: number): boolean {
  const rad = t.kind === 'emissive' ? 0.45 : t.kind === 'breaker' ? 0.4 : 0.3;
  for (const s of legs) { const toT = v3.sub(t.pos, s.o); const depth = v3.dot(toT, s.d); if (depth > s.end + slack) continue; if (v3.len(v3.sub(toT, v3.scale(s.d, clamp(depth, 0, s.end)))) < rad) return true; }
  return false;
}
/** One round from `shooter`'s muzzle at `target`, of the weapon he carries (or `o.weapon`): its row supplies the flash card, the light's gain, the report's voice and
 *  how the floor hears it, the kick it hands furniture, and — in a guard's hands — the spread. The player's own shot goes exactly where it is sent unless `o.spread`
 *  says otherwise (fired one-handed past a man in his arm: player.ts updateHold). The man Sam is holding is never in the way of Sam's round (the muzzle sits beside
 *  his jaw, inside his own body cylinder's reach: bodyHit's contact rule would put it in him). SIDES (teams.ts): a round can find any character of a side HOSTILE
 *  to the shooter's — Sam and the man in his arm for the staff, exactly as it was; hostile units for an operative and the other way about — and passes through
 *  everybody else as it always passed through a colleague (discipline keeps those rounds in, not luck; Sam's own rounds pass through an operative the same way). */
function aiWide(g: Game, sg: Guard | null, shooter: Character, def: WeaponDef): number {
  const tc = (sg ? foeChar(g, sg) : null) ?? g.player.char;   // (off the man he is firing at: Sam for the staff — the expression it always was — his hostile man for a unit)
  const tv = Math.hypot(tc.vel[0], tc.vel[2]); const range = v3.dist(shooter.pos, tc.pos); const S = def.aiSpread;
  return S.base + Math.min(S.moveCap, tv * S.moveK) + Math.max(0, range - S.rangeFrom) * S.rangeK;
}
/** (the round's sparks, chips and dust are its shooter's doing — fogofwar.ts FOG.ours: a teammate's are drawn under the fog) */
export function fireWeapon(g: Game, shooter: Character, target: Vec3, isPlayer: boolean, o: FireOpts = {}) { const was = g.fogOfWar.begin(shooter.id); try { return fireWeaponRaw(g, shooter, target, isPlayer, o); } finally { barsUnmeet(g); g.fogOfWar.done(was); } }   // (fogofwar.ts FOG.ours: what a round throws up is its shooter's doing)
function fireWeaponRaw(g: Game, shooter: Character, target: Vec3, isPlayer: boolean, o: FireOpts) {
  const sg = isPlayer ? null : g.guards.find(x => x.char === shooter) ?? null;   // the guard whose round this is (null: Sam, or a stray in a harness)
  if (sg?.workStow) stowFired(sg);   // (workstow.ts: a round out of a gun let go of for a two-handed job — it is in his hands at once; the fire site's own gate keeps this from happening)
  if (!isPlayer && shooter.anim.bigTool) bigFired(g, shooter);   // (bigkit.ts, BIGSLOT.moves: a teammate with the hammer out who fires — it is on his back at once)
  const sgTeam: Team = isPlayer ? 'player' : sg?.team ?? 'guard';
  const def = o.weapon ?? firearmOf(g, shooter, isPlayer).def; let spread = o.spread ?? 0;
  const pel = o.pellet ?? null;
  // FRIENDLY FIRE (friendlyfire.ts, behind FRIENDLYFIRE.on — off = `ffOn` false and every statement it guards is the one it was): a round of Sam's side finds
  // the men of Sam's side, and a teammate does not press with a friend anywhere this round could go
  const ffOn = ffLive(g), ffOurs = ffOn && (isPlayer || ffSide(sg));
  if (ffOurs && !isPlayer && !pel && ffUnpressed(g, sg, shooter.muzzle, target, spread + (o.steady ? 0 : aiWide(g, sg, shooter, def)) + (def.pellets ? def.pellets.cone * 2 : 0), def)) return;
  if (def.pellets && !pel) { fireShell(g, shooter, target, isPlayer, o, def); return; }   // a shotgun (shotgun.ts): one pull is a shell — every pellet comes back through here
  const lead = !pel || pel.i === 0, third = !pel || pel.i % 3 === 0;   // (a pellet that is not the shell's first: no second flash, report or event — and every third is the round that rattles a man and heats the room)
  if (lead) shooter.anim.fire();
  if (isPlayer && lead) { tally(g, 'shots'); holdFireShot(g, shooter); }   // (holdfire.ts: a player's own round starts the fight for his squad — a return on its first line with the switch off)
  const muzzle = v3.copy(shooter.muzzle);
  let dir = v3.normalize(v3.sub(target, muzzle));
  if (!isPlayer && !o.steady) spread += aiWide(g, sg, shooter, def);   // guards are imperfect shots: wider when the target is moving fast or far away (their first rounds tend to go wide, then they settle) — the row's numbers, his hands
  if (spread > 0) dir = v3.normalize([dir[0] + (simRandom() - 0.5) * spread, dir[1] + (simRandom() - 0.5) * spread, dir[2] + (simRandom() - 0.5) * spread]);
  if (pel && lead) pel.dir = dir;
  // 1-frame emissive flash card (visible flame), boxes only — the row's flame (effects.ts muzzleFx)
  const M = fx.muzzleFx[flameOf(def)];   // (gunlook.ts: a row with a flame of its own, while that switch is on — else the row's muzzleFx, as ever)
  if (lead) g.fx.push({ box: makeBox({ c: v3.mad(muzzle, dir, M.cardAhead), h: v3.copy(M.cardHalf), yaw: v3.yawOf(dir), albedo: v3.copy(fx.muzzleCard.albedo), emissive: v3.copy(M.cardEmissive), flags: BoxFlag.Dynamic | BoxFlag.NoShadow }), ttl: fx.muzzleCard.ttl });   // (copies: makeBox keeps the arrays it is given, and the row's numbers are nobody's to bend)
  // --- gas + light + powder: the graded shot from effects.ts — bore jet thrown down the barrel, two side-port puffs, the warm wisp that curls off
  // the barrel for seconds (tracks the muzzle, plus the small ejection-port curl), a narrow cone of spark streaks and the brief ~2000 K flash.
  // A suppressed weapon only dims the light; the gas is the same gas. (The ejection port 6 cm ahead of the wrist is a pistol fact still spelled out here: the long
  // guns eject well ahead of the hand — doc §12.4, their lanes' to place per row.)
  const track = () => ({ pos: shooter.muzzle, dir: shooter.gunDir });
  const port = () => ({ pos: v3.add(v3.mad(shooter.bones.handR ?? shooter.muzzle, shooter.gunDir, 0.06), [0, 0.06, 0]), dir: [0, 1, 0] as Vec3 });
  const gpu = gpuFx(g);   // GPU particles on: the powder sparks go to the GPU (muzzleSparksFx below, the same effects.ts numbers) instead of the box pool; the gas and the light are the same either way
  if (lead) for (const L of fx.spawnShot(g.smoke, gpu ? null : g.sparks, muzzle, dir, { seed: g.fxSeed++, lightGain: M.lightGain * (def.suppressed ? fx.shot.suppressedGain : 1), lightRange: M.lightRange, track, eject: port, gas: !g.fogOfWar.airHides(shooter) }))
    g.engine.lights.flash(L.pos, L.color, L.intensity, L.range, L.ttl, shooter.id);
  if (gpu && lead) { muzzleSparksFx(g, muzzle, dir, shooter); casingFx(g, shooter, def); }   // + the spent case out of the port (heard landing half a second on: particleFx.ts)
  if (lead) g.audio.play(voiceOf(def), muzzle, 1);   // (gunlook.ts: … and a voice of its own)
  // --- hit scan
  let tHit = 60; let hitGuard: Guard | null = null; let playerHit = false;
  let st0 = g.col.raycast(muzzle, dir, tHit); if (st0) tHit = st0.t;   // statics + door leaves
  let st = st0;                                                       // (the static the round STOPS in: the first one it meets — unless it goes through glass, below)
  // GLASS PENETRATION (glasspen.ts, behind GLASSPEN.on — off, or no sheet of glass first in the round's way, = `pen` null and every statement below is the one it
  // was): the round's flight as LEGS — through each pane it has the energy for, turned a little at each — ending in the static it finally stops in. Distances
  // (tHit, st.t, ph.t) are then metres of that path, and every 'along dir' below reads the leg it happened on.
  const penLive = glassPenLive(g), wallLive = wallPenLive(g); const e0 = penLive || wallLive ? roundEnergy(def) : 1; let eK = 1;   // (eK: the share of its energy the round still has where it meets furniture)
  let through = armThrough(g, shooter);                               // the pistol itself out through a panel (below): the round goes into that, at the muzzle
  // WINDOW BARS (winbars.ts, behind WINBARS.on — off = `barLive` false, `bars` null and every statement below is the one it was): a round that would stop in a
  // window's bar takes the bar and flies on. The bar is out of this round's way from here (barMeet: hidden, nothing more) and the flight is asked again; once the
  // round's end is known every bar it reached is broken and every one it did not stands as it stood (barsSettle, below).
  const barLive = barsLive(g); let bars: BarMet[] | null = null;
  if (through && barLive) { const a = acrossArm(g, shooter); if (a && barAt(g, a.index)) { bars = [barMeet(g, a.index, 0, a.at, dir)]; through = armThrough(g, shooter); st0 = g.col.raycast(muzzle, dir, 60); tHit = st0 ? st0.t : 60; st = st0; } }   // (the muzzle pushed past a bar: the bar is the round's, at the arm)
  let eMuzzle = e0;
  let armPanes = 0;
  if (through && penLive) { const arm = armThroughGlass(g, shooter, dir, e0, pel ?? undefined); if (arm) { through = false; eMuzzle = arm.e; armPanes = arm.panes; } }   // …unless that panel is a sheet of glass the round goes through: the muzzle is already past it, the pane is filed at the arm, and the round flies on from the muzzle with what the glass left it
  if (through) tHit = 0;
  // THIN WALLS AND DOORS (wallpen.ts, behind WALLPEN.on — off = `wallLive` false and this line is the one it was): the same flight, over panes and thin things alike
  const fly = (): (RoundPath & { walls?: WallCross[] }) | null => wallLive ? thinPath(g, muzzle, dir, 60, eMuzzle, st0, armPanes) : penLive ? roundPath(g, muzzle, dir, 60, eMuzzle, st0, armPanes) : null;
  let pen = through ? null : fly();
  if (barLive && !through) {   // (window bars: while the round's flight ends in a standing bar — on its straight line or on a leg past a pane — that bar is out of its way and the flight is asked again)
    for (let n = bars ? bars.length : 0; n < WINBARS.perRound; n++) {
      const stop = pen ? pen.st : st0; if (!stop || !barAt(g, stop.index)) break;
      (bars ??= []).push(barMeet(g, stop.index, stop.t, pen ? pathAt(pen, stop.t) : v3.mad(muzzle, dir, stop.t), pen ? segAt(pen, stop.t).d : dir));
      st0 = g.col.raycast(muzzle, dir, 60); pen = fly();
    }
    if (bars) { st = st0; tHit = st0 ? st0.t : 60; }
  }
  if (pen) { tHit = pen.len; st = pen.st; }
  const armAt = through && pel ? acrossArm(g, shooter) : null;   // (a shell with the muzzle through a panel: which, and where the arm crosses it — the glass below, the lock rule's leaf further down)
  if (armAt && penLive) { if (armAt.index < 1e6) spentInPane(g, armAt.index, armAt.at, dir, e0, shooter.id, pel!); }   // (rounds through glass live: its pellets are spent in that pane at the arm point by the shell rule — one mark for the nine)
  else if (through && lead) glassAcrossArm(g, shooter, dir);                       // …and if that panel is an intact glass pane it goes (pressed to the glazing the muzzle is already past the sheet: the hit scan below starts beyond it and would never find it)
  if (through && third && DESTRUCTION.on && COVERFIRE.on) wallAcrossArm(g, shooter, def);            // …and under the destruction's switch a partition or a stack the wall engine can break is given the round too: pressed to it the hit scan never meets the piece, and the engine had counted nothing (off: this line is not reached — the base by digest)
  // loose furniture in the line of fire gets knocked (below); it stops the round only if nobody is standing behind it — a chair back or a carton is
  // concealment, not cover, which keeps hits consistent with guard sight (props never block line of sight)
  let ph = through || pen ? null : g.props.raycast(muzzle, dir, tHit);
  if (pen) for (const s of pen.segs) { const h = g.props.raycast(s.o, s.d, s.len); if (h) { ph = { ...h, t: s.t0 + h.t }; break; } }   // (the first piece of furniture on any leg, at its distance along the path)
  const contact = (c: Character) => { const h = c.bones.hips ?? c.pos; return (!st0 || st0.t > Math.hypot(h[0] - muzzle[0], h[2] - muzzle[2])) && (armPanes > 0 || contactClear(g, shooter, c)); };   // (armPanes: the panel between the two chests is the glass his muzzle is already through — glasspen.ts)
  /** where the round enters this man, in metres of its path, or −1 — one straight test as ever, or leg by leg through the glass */
  const scan = (c: Character, own = false): number => {   // (own, friendlyfire.ts: a man of the shooter's own side — the entering hit only, a muzzle past his shoulder is past him)
    if (!pen) return bodyHit(c, muzzle, dir, tHit, own ? false : contact);
    for (let k = 0; k < pen.segs.length; k++) { const s = pen.segs[k]; if (s.t0 >= tHit) break; const t = bodyHit(c, s.o, s.d, Math.min(s.len, tHit - s.t0), k === 0 ? (own ? false : contact) : () => s.o[1] <= (c.bones.headTop?.[1] ?? c.pos[1] + 1.8)); if (t >= 0) return s.t0 + t; }   // (a later leg born INSIDE a man — he stands against the far face of the pane — is in him there; not one born over his crown: bodyHit's contact column is padded for a muzzle pressed DOWN onto a crouched man, which a round off the glass is not)
    return -1;
  };   // a contact shot (the muzzle already inside him, bodyHit) counts only with nothing solid nearer along the bore than his middle and no panel between the two chests
  // The man in Sam's arm (player.ts Hold — the human shield): a colleague's round meets whichever of the two bodies it reaches first (from in front of the pair that
  // is him: he dies by his own side's hand and Sam is untouched; from behind, Sam); Sam's own rounds never test him (the muzzle rides beside his ear, inside his
  // cylinder — bodyHit's contact rule would put every one of them in him; he cannot shoot his own shield). Every other colleague stays transparent to their fire:
  // muzzle discipline is what keeps those rounds in, not luck.
  const held = g.player.holding?.g ?? null; let hostageHit = false;
  if (through) { /* into the panel at the muzzle: nobody beyond it */ }
  else if (isPlayer) { for (const gd of g.guards) { const own = !isHostile('player', gd.team); if (gd === held || (own && !(ffOn && ffBody(gd)))) continue; const t = scan(gd.char, own); if (t >= 0 && t < tHit) { tHit = t; hitGuard = gd; } }   // (teams: a man of Sam's own side is as transparent to his round as a colleague is to a guard's)
    for (const cv of civilianBodies(g)) { const t = scan(cv.char); if (t >= 0 && t < tHit) { tHit = t; hitGuard = cv; } } }   // …and a CIVILIAN standing in the way of it is flesh like anybody (civilians.ts: the men's own rounds pass her as they pass a colleague — discipline, not luck, keeps those in)
  else {
    const tH = held && held.state !== 'dead' && held.char !== shooter ? scan(held.char) : -1;
    const t = isHostile(sgTeam, 'player') ? scan(g.player.char) : -1;   // (teams: an operative's round never tests Sam)
    if (tH >= 0 && (t < 0 || tH < t)) { tHit = tH; hitGuard = held; hostageHit = true; }
    else if (t >= 0) { tHit = t; playerHit = true; }
    for (const od of g.guards) {   // teams: every living man of a side hostile to the shooter's is a body this round can find — none for the staff (no AI side is their enemy: the loop finds nobody and their colleagues stay transparent, as ever)
      if (od === held || od.state === 'dead' || !od.char.alive || od.char === shooter || !isHostile(sgTeam, od.team) || od.god) continue;   // (god: a showcase cast's net — game.ts Guard.god — the round passes him as it passes a colleague)
      const to = scan(od.char); if (to >= 0 && to < tHit) { tHit = to; hitGuard = od; hostageHit = false; playerHit = false; }
    }
    if (ffOurs) {   // (friendlyfire.ts: a teammate's round is a round to Sam and to the other teammates too — his care, above, is what keeps it out of them)
      if (!g.player.down) { const tS = scan(g.player.char, true); if (tS >= 0 && tS < tHit) { tHit = tS; playerHit = true; hitGuard = null; hostageHit = false; } }
      for (const od of g.guards) { if (od === held || od.char === shooter || !ffBody(od)) continue; const to = scan(od.char, true); if (to >= 0 && to < tHit) { tHit = to; hitGuard = od; hostageHit = false; playerHit = false; } }
    }
  }
  if (ph && !hitGuard && !playerHit) tHit = ph.t;
  const hitP = pen ? pathAt(pen, tHit) : v3.mad(muzzle, dir, tHit);
  const flown = dir;                                              // (the bore's line, kept for the log)
  if (bars) barsSettle(g, bars, tHit, shooter.id, lead);   // (window bars: the ones this round reached go in pieces, the others stand again — before the panes and walls it crossed are filed: they see the level as the round left it)
  if (pen) { dir = segAt(pen, tHit).d; commitCrossings(g, pen.cross, tHit, shooter.id, pel ?? undefined); if (pen.walls) commitWalls(g, pen.walls, tHit, shooter, def, lead, third, pel); }   // from here `dir` is the round's direction WHERE IT STOPPED; every pane it got through before that has its star, its crack and its hole (a man or a chair on the near side: the glass never heard of it)
  if (wallLive && st && !hitGuard && !playerHit && !through && Math.abs(tHit - st.t) < 1e-6) spentInWall(g, st.index);   // (counted: a round that stopped in a thing a stronger or squarer one goes through)
  if (st && st.index < 1e6 && !hitGuard && !playerHit && !through && (penLive || third) && Math.abs(tHit - st.t) < 1e-6) { if (penLive) spentInPane(g, st.index, hitP, dir, pen ? segAt(pen, tHit).e : eMuzzle, shooter.id, pel ?? undefined); else glassHit(g, st.index, hitP, dir, shooter.id); }   // (a pellet, rounds through glass live: EVERY pellet that stops in a pane marks it, by the shell rule a pellet that goes through is held to — glasspen.ts; with that switch off a pane is the starred wall it was and every third pellet stars it, as before)   // the round stopped in a static: if that is a glass pane it stars it (glass.ts — a hole and cracks ON the pane, the crack heard; the pane holds: the next round stops in it too)
  if (pel) { const ah = armAt;   // (the muzzle pushed through a leaf — pressed to the lock: the shell is in THAT leaf, where the arm crosses it)
    pelletEnd(pel, ah ? ah.index : st && !hitGuard && !playerHit && !through && Math.abs(tHit - st.t) < 1e-6 ? st.index : -1, tHit, ah ? ah.at : hitP); }
  if (third) noteRound(g, shooter, muzzle, hitP, hitGuard?.char ?? (playerHit ? g.player.char : null));   // suppression: everybody ELSE this segment passed close to, or stopped close to, has felt it go by (suppression.ts — the man it went into is shot, not suppressed)
  if (pen && ph) eK = segAt(pen, ph.t).e / e0; else if (penLive) eK = eMuzzle / e0;
  if (ph && ph.t <= tHit + 1e-3 && third) { const J = def.propImpulse * eK; const pd = pen ? segAt(pen, ph.t).d : dir; g.props.applyImpulse(ph.prop, pen ? pathAt(pen, ph.t) : v3.mad(muzzle, dir, ph.t), [pd[0] * J, 0, pd[2] * J], shooter.id, true); }   // (not a prop standing behind the body the round stopped in) the row's few N·s, exaggerated over the real round so it reads: cartons hop, chairs twitch and roll — and it is heard at the prop
  // bullet wake through smoke volumes
  if (third) for (let d = 0.3; d < Math.min(tHit, 25); d += 0.28) { const p = pen ? pathAt(pen, d) : v3.mad(muzzle, dir, d); if (g.smoke.inSmokeDomain(p)) g.smoke.push({ pos: p, dir: pen ? segAt(pen, d).d : dir, speed: 5.5, radius: 0.07 }); }
  // impact flash + sound
  const blind = !!hitGuard && g.fogOfWar.hidden(hitGuard); if (blind) g.fogOfWar.hush();   // (FOG.ours: a round that stopped in a man nobody on the team sees — no flash and no spray off him says where he stands)
  if (lead) { const fl = g.engine.lights.flash(v3.mad(hitP, dir, -0.05), [1, 0.8, 0.5], 1.5, 2.5, 0.05, 0); if (!blind) g.fogOfWar.lightBy(fl, shooter.id); }   // (FOG.ours: a teammate's round strikes where the picture shows it)
  const inGlass = !!(st && st.index < 1e6 && !through && Math.abs(tHit - st.t) < 1e-6 && (g.level.boxes[st.index]?.flags ?? 0) & BoxFlag.Glass);   // the round stopped in a pane / the solid bottle: glassHit above played its crack (or nothing for solid glass) — no wall thud, and no bullet decal on a box that is never rasterised (review 08-12)
  if (!hitGuard && !playerHit && !inGlass && lead) g.audio.play('bulletImpact', hitP, 0.8);
  if (!hitGuard && !playerHit && !through && !inGlass) bulletMark(g, hitP, ph && ph.t <= tHit + 1e-3 ? ph.n : st ? st.n : [0, 1, 0], ph && ph.t <= tHit + 1e-3 ? { box: ph.box, dynamic: true } : st && st.t <= tHit + 1e-3 ? staticSurface(g, st.index) : null, def);   // decals (E1, marks.ts): the hole where the round stopped — in the furniture it knocked, else the static / the leaf it met; nothing in flesh, in the sky, or through the panel at the muzzle
  // …and what the round knocks out of what it stopped in (GPU particles; nothing with them off): sparks off the racks, chips and a puff of gypsum off a partition, splinters
  // off a leaf, by the material of the very box / prop / leaf the scan found — not for a round in a man, into the night, or into the panel at a muzzle pressed to it
  if (!hitGuard && !playerHit && !through) { if (ph && ph.t <= tHit + 1e-3) impactFx(g, hitP, dir, { n: ph.n, prop: ph.prop }, def); else if (st) impactFx(g, hitP, dir, { n: st.n, index: st.index }, def); }
  if (!hitGuard && !playerHit && !through && third) g.destr.round(shooter, hitP, dir, ph && ph.t <= tHit + 1e-3 ? { n: ph.n, prop: ph.prop, box: ph.box } : st ? { n: st.n, index: st.index } : { n: [0, 1, 0] }, def);   // DESTRUCTION (destruction.ts, behind tune.chaos — a return at 0): the beaten zone's heat and what this round does on top of the hole and the puff — paper up, dust into the smoke, a dent / shred / crack, things off the desk, a tile off the ceiling
  if (def.tracer && g.tune.tracers) g.tracers.round(firearmOf(g, shooter, isPlayer), def, muzzle, pen ? v3.normalize(v3.sub(hitP, muzzle)) : dir, pen ? v3.dist(muzzle, hitP) : tHit, hitGuard || playerHit ? 'flesh' : st || ph || through ? 'solid' : 'none', shooter.id);   // tracers (R6, tracers.ts): the row lights every third round and the last three of the box, counted off the gun that fired it — a streak travelling this same segment over the next few frames with a small light on its head, an ember where it stopped in geometry. A pistol row never asks (tracer null: not one instruction more than before); the flag off, nobody does
  if (ffOurs && (playerHit || (hitGuard && !hitGuard.civ && !isHostile('player', hitGuard.team)))) ffNote(sg, isPlayer, playerHit);
  if (ffOn && isPlayer && lead) ffPast(g, muzzle, hitP, hitGuard?.char ?? null);
  recapRound(g, playerHit ? g.player.char : hitGuard?.char, playerHit ? g.player.down : hitGuard?.state === 'dead', shooter, muzzle, hitP, def, o.blind);   // deathrecap.ts: the round about to land on a man, for the end card (reads only)
  const manDown = !hitGuard ? null : () => {   // (by 'guard': the held man, above — the only colleague a guard's round ever tests — or, teams, an enemy AI man)
    const wasUp = hitGuard.state !== 'dead';
    if (wasUp && hitGuard.civ) g.snatch?.roundOn(hitGuard, sg);   // (snatch.ts: whose round found the man the team came for — the tally's, nothing else reads it)
    const foeLine = sg && isHostile(sg.team, hitGuard.team) ? `${hitGuard.callsign} down — ${sg.callsign}'s round` : undefined;   // (teams: not 'hit by his own side' — he was the other side's to hit)
    const ownHit = ffOurs && !hitGuard.civ && !isHostile('player', hitGuard.team);   // (friendlyfire.ts: a man of Sam's side by a round of Sam's side — the log says whose)
    const does = roundDoes(g, hitGuard, v3.dist(v3.mad(muzzle, dir, tHit), hitP) < 1e-6 ? muzzle : v3.mad(hitP, dir, -tHit), dir, tHit, hostageHit, isPlayer);   // WOUNDS (wounds.ts): where it landed decides — 'shot' is the only answer with the switch off. (Its line is the muzzle's for a straight round, as ever; for a round that has changed direction on its way — through glass, in a build where one can: `dir` and `tHit` are then its last leg's and its whole path's — it is taken BACK from where the round stopped, so the stretch of the man that is measured is the one it went into)
    if (does !== 'none') killGuard(g, hitGuard, dir, false, does === 'shot' ? 'shot' : 'wounded', isPlayer ? 'player' : 'guard', does !== 'shot' ? (foeLine ? `${hitGuard.callsign} hit, down and breathing — ${sg!.callsign}'s round` : ownHit ? `${hitGuard.callsign} hit, down and breathing — ${isPlayer ? 'your' : `${sg!.callsign}'s`} round` : `${hitGuard.callsign} down — wounded, out of the fight`) : foeLine ?? (ownHit && !isPlayer ? `${hitGuard.callsign} down — ${sg!.callsign}'s round` : undefined), does === 'shot' ? undefined : does);
    g.audio.play('bodyHit', hitP, 0.8);
    if (wasUp) hitGuard.killerId = shooter.id;   // (whose round it was, for the engagement's record — guards.ts tickEngagement)
    if (hostageHit) { const sh = sg; if (sh && sh.state !== 'dead') hostageHitBark(g, sh, hitGuard); }   // '…christ — I hit him': whoever fired it says so (the shot itself has everybody's ears; the hold drops from under Sam next frame — updateHold — and the men watching find the body there and then)
  };
  // (a pellet, shotgun.ts: booked on the shell — which settles him once all nine have flown, so he stops the rest of his own pattern standing: a man put down
  //  by the first would be air to the other eight, and they would go on into whoever stands behind him)
  if (manDown && !pel) manDown(); else if (manDown && pelletDrops(pel!, hitGuard, tHit, dir)) pel!.late.push(manDown);
  if (AIM_DEBUG.log && !isPlayer) { const pcD = g.player.char; const hp = pcD.bones.hips ?? pcD.pos; AIM_DEBUG.log(`round g${shooter.id}: muzzle (${muzzle.map(v => v.toFixed(2))}) → target (${target.map(v => v.toFixed(2))}) dir (${flown.map(v => v.toFixed(2))}) static ${st ? st.t.toFixed(2) : '-'} prop ${ph ? ph.t.toFixed(2) : '-'} through ${through} tHit ${tHit.toFixed(2)} playerHit ${playerHit} — the player hips (${hp.map(v => v.toFixed(2))}) headTop ${(pcD.bones.headTop?.[1] ?? -1).toFixed(2)} pos (${pcD.pos.map(v => v.toFixed(2))})`); }   // (soak --trace)
  const samHit = !playerHit ? null : () => { g.player.char.anim.hitFrom(dir); g.player.hitFlash = 1; if (g.player.picking) { g.player.picking = null; g.player.fHeld = true; } if (g.player.wanding) { wandDrop(g.player); g.player.fHeld = true; } g.audio.play('bodyHit', hitP, 0.9); if (!g.godMode) { hitPlayer(g, dir); chronHit(g, sg?.callsign); } };   // (a round in the vest ends any lock work, god mode or not — and that F press is spent; the debrief keeps whose round it was)
  if (samHit && !pel) samHit(); else if (samHit && pelletDrops(pel!, null, tHit, dir)) pel!.late.push(samHit);
  // lights: a shot passing close to a fixture breaks it
  if (isPlayer) {
    // (aimcost.ts, `AIMCOST.lamp`: the round has to MEET the thing — its own boxes, or the bulb's point — where the rule below took anything within a
    //  hand's breadth to half a metre of its line. `legs` null = the rule off, or a show on the stage = the old loop below as it stood.)
    const legs: RoundLeg[] | null = !AIMCOST.lamp || g.touring ? null : !pen ? [{ o: muzzle, d: flown, end: tHit }] : pen.segs.filter(s => s.t0 <= tHit).map(s => ({ o: s.o, d: s.d, end: Math.min(s.len, tHit - s.t0) }));
    const shootOut = (t: LightTarget) => {
      if (t.kind === 'breaker') { g.engine.lights.flash(t.pos, [0.6, 0.7, 1], 10, 5, 0.2, 0); g.audio.play('lightBreak', t.pos, 1); g.setBlackout(Infinity, 'shot'); t.broken = true; breakerSparkFx(g, t.pos, muzzle); return; }   // (+ the panel arcing over: GPU particles, nothing with them off)
      if (lampGlass(t)) CARLAMPS_STATS.shot++;
      if (deadLamp(t)) { t.broken = true; g.msg(`shot out ${t.name}`); g.audio.play('lightBreak', t.pos, 0.8); lensShatterFx(g, t, muzzle); return; }   // (carlamps.ts: a lens that was dark already — the glass and the sound, no arc and no light gone out)
      t.broken = true; g.msg(`shot out ${t.name}`); g.lightEvent(t); chronLightShot(g, t); g.engine.lights.flash(t.pos, [0.7, 0.8, 1], 6, 4, 0.12, 0); g.audio.play('lightBreak', t.pos, 1); if (lampGlass(t)) lensShatterFx(g, t, muzzle); else if (t.kind !== 'device') fixtureShatterFx(g, t, muzzle);   // (+ the tube's glass and phosphor showering down: GPU particles; a camera / an emitter dies with its own sparks in devices.ts)
    };
    if (legs) {
      const stIx = st && Math.abs(tHit - st.t) < 1e-6 ? st.index : -1;
      const live = (t: LightTarget) => !(t.broken || !t.interactive || t.factor <= 0 && !t.on && !lampGlass(t) || fireHolds(t));   // (a vehicle's lamp is glass whether it burns or not)
      const own = (t: LightTarget) => t.kind === 'breaker' ? g.level.breaker.boxes : t.boxes;   // (the breaker's target lists its LED alone: a round into the panel is a round into the breaker)
      if (stIx >= 0) { const fire = g.targets.find(t => fireHolds(t) && fireStruck(g, t, hitP, stIx)); if (fire) fireStir(g, fire); }   // (fire.ts FIRE.hardy: a round into a burning drum stirs it — a crack and a throw of embers — and puts nothing out; a fire is no lamp to this search, so a lamp behind one can still be shot)
      let got = stIx >= 0 ? g.targets.find(t => live(t) && own(t).includes(stIx)) : undefined;   // the thing the round STOPPED in first, whatever else its line passed
      if (!got) for (const t of g.targets) {
        if (!live(t) || legsNear(t.pos, legs) > 3) continue;
        const slack = t.kind === 'breaker' ? 0.08 : 0.3;
        if (lampStruck(t.pos, own(t).map(i => g.engine.world.statics[i]), false, legs, t.kind === 'device' ? AIMCOST.bareDevice : AIMCOST.bare, Math.min(slack, AIMCOST.slack))) { got = t; break; }
        if (nearLamp(t, legs, slack)) AIMCOST_STATS.lampNear++;
      }
      if (got) { AIMCOST_STATS.lampHits++; shootOut(got); }
    } else for (const t of g.targets) {
      if (t.broken || !t.interactive || t.factor <= 0 && !t.on && !lampGlass(t)) continue;   // scenery (rack LEDs / glow strips) cannot be shot out
      if (fireHolds(t)) { if (st && Math.abs(tHit - st.t) < 1e-6 && fireStruck(g, t, hitP, st.index)) fireStir(g, t); continue; }   // (fire.ts FIRE.hardy: nor a fire — a round that stopped in its drum stirs it, the rule of the search above, and this one goes on to a lamp behind it)
      const slack = t.kind === 'breaker' ? 0.08 : 0.3; let dist = -1;
      if (!pen) {
        const toT = v3.sub(t.pos, muzzle); const depth = v3.dot(toT, flown);
        if (depth > tHit + slack) continue;                                                // fixture is beyond what the round hit (wall-mounted breaker: no through-the-wall kills)
        const along = clamp(depth, 0, tHit); dist = v3.len(v3.sub(toT, v3.scale(flown, along)));
      } else {   // (through glass: the same test on each leg the round flew)
        for (const s of pen.segs) { if (s.t0 > tHit) break; const end = Math.min(s.len, tHit - s.t0); const toT = v3.sub(t.pos, s.o); const depth = v3.dot(toT, s.d); if (depth > end + slack) continue; const d = v3.len(v3.sub(toT, v3.scale(s.d, clamp(depth, 0, end)))); if (dist < 0 || d < dist) dist = d; }
        if (dist < 0) continue;
      }
      const rad = lampGlass(t) ? 0.2 : t.kind === 'emissive' ? 0.45 : t.kind === 'breaker' ? 0.4 : 0.3;   // (a vehicle's lamp is a hand's breadth of glass on a body: a round into the bodywork is not one into it)
      if (dist < rad) { shootOut(t); break; }
    }
  } else if (DESTRUCTION.on && !through) {
    const ix = st && Math.abs(tHit - st.t) < 1e-6 ? st.index : undefined;
    if (!pen) g.destr.fixtureRound(muzzle, dir, tHit, ix);
    else for (let k = pen.segs.length - 1; k >= 0; k--) { const s = pen.segs[k]; if (s.t0 > tHit) continue; g.destr.fixtureRound(s.o, s.d, Math.min(s.len, tHit - s.t0), s.t0 + s.len >= tHit - 1e-6 ? ix : undefined); }   // (through glass: the same rule on each leg the round flew, the leg it stopped on first — `dir` and `tHit` are the last leg's and the whole path's by now)
  }   // the loud levels (destructionSwitch.ts): anybody's round that is IN a fixture puts it out — a tight rule beside the player's aim-assisted one (destruction.ts fixtureRound)
  if (lead) g.events.push({ kind: isPlayer ? 'shot' : 'guardShot', pos: v3.copy(shooter.pos), time: g.time, loud: def.report.loud, level: def.report.level, weapon: def.id, from: v3.copy(muzzle), to: v3.copy(hitP), who: shooter.id, ...(o.blind ? { blind: true } : null) });   // gunfire — suppressed or not, every row is level 1 — carries through the whole floor on a dead-quiet night (hearingCheck: everyone goes to high alert); which row fired it, WHO did (teams: whose side's report it is) and the segment the round actually flew (muzzle → where it stopped) ride along for whoever reads rounds rather than reports (the QA soak's muzzle-discipline checks; suppression, R3)
  if (isPlayer && lead) { g.player.noise = Math.max(g.player.noise, def.report.level); chronShot(g, plainShort(def), hitGuard, hitP); }   // (max: a pane his round just smacked is louder than the suppressed report — glass.ts glassHit raised it first)   // the meter shows what the floor got: suppressed, not silent (hearingCheck) — and the debrief a row per burst (what it went into, whether a man stood near it)
}

/** fireWeapon, `through`: the panel between the gun shoulder and the muzzle is a glass pane → the round stars it point-blank (glass.ts glassHit; the round is
 *  spent in it either way). One raycast shoulder → muzzle over statics + leaves; a leaf (index ≥ 1e6) or an ordinary partition is left to armThrough's rule. */
/** …and, for a shell (shotgun.ts): what the arm is through and where — a leaf's index (≥ 1e6) is what the lock rule wants of a muzzle pressed to the keep */
function acrossArm(g: Game, c: Character): { index: number; at: Vec3 } | null {
  const from = c.bones.upperArmR ?? v3.add(c.pos, [0, 1.4, 0]); const d = v3.sub(c.muzzle, from); const L = v3.len(d); if (L < 1e-3) return null;
  const rd = v3.scale(d, 1 / L); const h = g.col.raycast(from, rd, L); return h ? { index: h.index, at: v3.mad(from, rd, h.t) } : null;
}
function glassAcrossArm(g: Game, c: Character, dir: Vec3) {
  const from = c.bones.upperArmR ?? v3.add(c.pos, [0, 1.4, 0]); const d = v3.sub(c.muzzle, from); const L = v3.len(d); if (L < 1e-3) return;
  const rd = v3.scale(d, 1 / L); const h = g.col.raycast(from, rd, L);
  if (h && h.index < 1e6) glassHit(g, h.index, v3.mad(from, rd, h.t), dir, c.id);
}
/** fireWeapon, `through`, under the destruction's switch AND the aimed-fire piece's (COVERFIRE.on — with it off a round fired pressed to a partition counts
 *  nothing, as on the engine's own build): the static between the gun shoulder and the muzzle takes the round as the wall engine counts one
 *  (wallbreak.ts WallBreak.round — a breakable it has indexed, at the cell the arm crosses; a wooden leaf as the doors count one, doorblast.ts DOORSHOT; concrete, steel, a pane: nothing, as ever). The same
 *  raycast as the pane's above; no mark, no dust — the round is still nobody's beyond the panel. */
function wallAcrossArm(g: Game, c: Character, def: WeaponDef) {
  const chaos = chaosOf(g); if (chaos <= 0) return;
  const from = c.bones.upperArmR ?? v3.add(c.pos, [0, 1.4, 0]); const d = v3.sub(c.muzzle, from); const L = v3.len(d); if (L < 1e-3) return;
  const rd = v3.scale(d, 1 / L); const h = g.col.raycast(from, rd, L);
  if (h) g.destr.walls.round(c.id, v3.mad(from, rd, h.t), rd, h.index, def, chaos);
}
/** The pistol itself poked out through a panel — the gun shoulder and the muzzle on opposite sides of a static or of a leaf standing (as good as) shut: a man
 *  pressed to a door has the reach to put his muzzle out of its far face, and a bore that starts beyond the wood sees nothing of it. fireWeapon puts that round
 *  into the panel at the muzzle; the guard AI (guards.ts) will not fire it, and steps clear if it lasts. An open leaf's free edge does not count (solidBetween). */
export function armThrough(g: Game, c: Character): boolean { return solidBetween(g, c.bones.upperArmR ?? v3.add(c.pos, [0, 1.4, 0]), c.muzzle); }

/** A panel between `from` and `to` — the things that keep two pressed men apart: a static (partition, jamb), or a leaf standing shut or as good as (within 0.3 rad
 *  of its frame: the SoundSeal bit Door.place keeps — latched or not, a leaf pulled to and resting on somebody is a full panel). A leaf standing open does not
 *  count: at its free edge the two are as good as touching, and it yields to them. (Short segments only: an arm, or two chests within a metre or so.) */
export function solidBetween(g: Game, from: Vec3, to: Vec3): boolean {
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
 *  cannot be finished off by a round either (a burst can: frag.ts FRAG.downKill). */
export function killGuard(g: Game, gd: Guard, dir: Vec3, quiet = false, how: DownKind = quiet ? 'struck' : 'shot', by: DownBy = 'player', line?: string, zone?: 'side' | 'leg') {
  // (below: state checks come first everywhere, but a corpse should not carry choreography around)
  if (gd.civ) { civilianDown(g, gd, dir, quiet, how, by, line); return; }   // a CIVILIAN (the cleaner, the late worker — every path that puts a 'Guard' down comes through here: the round, the cross, the choke, the whip, the ring): her own record, her own price on the card, nothing in her hands to fall (civilians.ts)
  if (gd.bubble && g.time - gd.bubble.t < 0.8 && !w(g.messages.some(m => m.t === gd.bubble!.t && m.text.endsWith(gd.bubble!.text)), false)) g.msg(w(gd.unit ? `${gd.callsign}: ` : 'guard: ', 'guard: ') + gd.bubble.text);   // he did not get to finish saying it on screen (a unit's cut-off line goes under his own name, as guards.ts say files it: a teammate's 'man down.' is not a guard's) — and a line say already put in the log (out of sight, or over the net: its row carries the bubble's own stamp) is not put there a second time
  if (gd.state === 'dead') return;
  if (railsSpare(g, gd)) return;   // (rails.ts: on a tutorial mission that says so a teammate is on a knee for a few seconds instead, and up again — a return with no rails record)
  gd.script = null;   // (his lockdown role — leader / post — deliberately stays on the corpse: the others only re-deal once they KNOW, see superviseLockdown)
  const held = inHand(gd);   // what is in the hand as he goes (guards.ts): the torch on a calm patrol, his drawn weapon otherwise (alarmed floor, or any other state) — nothing if the torch already went at the grab
  if (by === 'player') { if (!(ffLive(g) && !isHostile('player', gd.team))) tally(g, how === 'shot' ? 'kills' : 'knockouts'); chronDown(g, gd, how, line); }   // (a man dropped by his own side's round or by the world is on nobody's card — nor on the debrief's timeline)
  witnessKill(g, gd, how, by);   // whoever has it in view remembers seeing it done, and to whom (before his state flips: the observers are the OTHER living men)
  moraleManDown(g, gd);   // (shaken, morale.ts — a return on its first line with the switch off: a squad's leader down is a standing dread on its green men, and a shock to the ones who see him go)
  netQuietFall(g, gd);   // (the net goes quiet, netquiet.ts — a return on its first line with the switch off: a mate seen to fall shakes the men who saw it, more with no enemy in their view)
  if (gd.torchLostAt < 0 && gd.gunLostAt < 0) gd.lightLitAtLoss = gd.flashlight.enabled;   // (before anything below turns it off: what the sputter-on-the-floor may show — a light that was dark stays dark)
  gd.state = 'dead'; gd.speed = 0; gd.diedAt = g.time; gd.downKind = how; gd.downBy = by;
  tacticsManDown(g, gd);   // (pursuit tactics: down within a couple of metres of a doorway under a colleague's eyes — that doorway is a kill zone for his side, tactics.ts)
  const W = gd.weapon.def;
  if (held) gd.dropped = dropFromHand(g, gd.char, held === 'torch' ? 'torch' : W.drop, held === 'torch' ? gd.beamDir : gd.char.gunDir, quiet ? [0, 0, 0] : dir, held === 'weapon' && W.suppressed, quiet);   // it leaves the hand — the row says as what (the holstered one stays on the thigh); a takedown lays it down quietly; an empty hand has nothing more to let go of
  // hand him to the ragdoll: thrown along the round (falls away from the shooter) or, for a takedown, folding forward where he stood; it collides with the
  // walls / furniture / door leaves itself, and the thud plays when the trunk actually lands (updateGuard → bodyThud)
  if (how === 'wounded') woundDown(g, gd, dir, zone);   // (wounds.ts: no ragdoll — he sinks to a knee or onto his back, holding it)
  else gd.char.ragdollize(g.col, dir, quiet);
  g.msg(line ?? (how === 'choked' ? 'choked out — he\'ll keep, breathing' : how === 'struck' ? 'takedown — out cold, breathing (a knockout, not a kill)' : by === 'guard' ? w(gd.unit ? `${gd.callsign} down — hit by his own side` : 'guard down — hit by his own side', 'guard down — hit by his own side') : w(gd.unit && gd.team === 'hostile' ? `${gd.callsign} down` : gd.unit && gd.team === 'operative' ? `${gd.callsign} down${by === 'player' ? ' — your round' : ''}` : 'guard down — dead', 'guard down — dead')));   // (a TEAMMATE is never 'guard': by the player's own round he is '<callsign> down — your round', as a mate's kill reads '— Red One's round'; hit by his own side he keeps his name too) (a squad mission's defender dropped by the PLAYER reads as one a teammate dropped does — 'Tango 3 down'; 'guard' is the night watch's word)
}

/** What a dying hand lets go of: an item at the hand, carrying the body's motion plus a nudge along the round, spinning as it goes. It clatters (audible to the room)
 *  on its first hard bounces. kind 'torch' or a weapon row's drop kind ('pistol'; 'rifle' — a rifleman's whole carbine, throwables RIFLE_ITEM: heavier, so it
 *  tumbles slower and clatters lower, and lies there for as long as a sidearm does, lit by whatever lights it, its own weapon light sputtering out on it like a
 *  dropped torch — guards.ts attachFlashlight rides gd.dropped whatever it is); `suppressed` = drawn with its can (fill 1: Sam's Five-seveN). Once down it is set
 *  dressing: nothing on the floor is picked up — a guard's magazines do not fit the Five-seveN, so a dead man's gun is no ammunition (player.ts buildInteractables
 *  offers no row for it). */
export function dropFromHand(g: Game, c: Character, kind: 'torch' | DropKind, along: Vec3, dir: Vec3, suppressed = false, quiet = false, from?: Vec3): Item {
  const h = from ?? c.bones.handR ?? v3.add(c.pos, [0, 1.0, 0]);   // (`from`: a thing that was not in his hand — runner.ts, the sidearm off his thigh)
  const v: Vec3 = [c.vel[0] * 0.6 + dir[0] * 1.1 + (simRandom() - 0.5) * 0.6, 0.9 + simRandom() * 0.6, c.vel[2] * 0.6 + dir[2] * 1.1 + (simRandom() - 0.5) * 0.6];
  const it = g.items.spawn(kind, [h[0], Math.max(0.25, h[1]), h[2]], v, { who: c.id, fill: suppressed ? 1 : 0, heading: v3.yawOf(along), yaw: v3.yawOf(along), life: kind === 'torch' ? 90 : GUN_ITEM_LIFE });
  if (kind === 'rifle') { it.tumbleRate *= 0.55; it.spin *= 0.5; }   // 0.7 m and 2.7 kg of it: it turns over on the way down, it does not flick round like a pistol
  it.onBounce = (sp, p, g, it) => { if (sp < 0.7) return; g.audio.play('magDrop', p, Math.min(1, sp / 3) * (quiet ? 0.5 : 1), { rate: kind === 'pistol' ? 0.72 : kind === 'rifle' ? 0.6 : 0.85 }); if (!quiet && (it.clatters = (it.clatters ?? 0) + 1) <= 2) g.events.push({ kind: 'prop', pos: v3.copy(p), time: g.time, loud: false, level: Math.min(0.5, 0.2 + sp * 0.08), who: 0 }); };   // who 0: nobody living made it — a clatter the room cannot explain (a guard-attributed noise would be shrugged off)
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
    if (pl.wall) { pl.wall = null; pl.char.anim.stance = 'none'; pl.char.anim.lookYawExtra = 0; pl.char.anim.wallTake = -1; pl.char.anim.wallHit = 0; pl.char.anim.stackPress = 0; pl.char.anim.stanceIn = 0; }   // off the wall the moment he drops (updatePlayer's down branch would only let go next frame)
    pl.pistol.cancelReload(); pl.rifle.cancelReload(); pl.char.anim.cancelReload(); pl.throwHeld = false; pl.pendingThrow = null;
    if (inHand) { dropFromHand(g, pl.char, inHand.def.drop, pl.char.gunDir, fromDir, inHand.def.suppressed); if (inHand === pl.rifle) pl.rifleGone = true; }   // what was in the hand leaves it — the Five-seveN can and all, or the whole FN2000 (its own item body: 'rifle' fill 1); a holstered pistol stays on the thigh, a slung rifle on his back
    pl.char.ragdollize(g.col, fromDir, false);            // thrown along the round, like the guards; the thud plays when the trunk lands (updatePlayer)
    { const ck = g.saves?.newest(true, g.mission.stats.elapsed); g.msg(ck && g.saves.isThisRun(ck) ? "you're down. press Enter to go back to the last checkpoint, or Shift+Enter to restart the mission" : "you're down. press Enter to restart the mission"); }   // (game/savestate.ts: the down card's default is that checkpoint too)
  } else g.msg(pl.hitsLeft === 1 ? 'hit — one more and you are down' : 'you were hit');
}

/** Held / worn props as small oriented boxes (traced; lit lenses raster-only): the Five-seveN (+ can + rail light) in the player's hand and the trifocal goggles on
 *  their head, pistol or torch with a glowing lens for guards. All placement numbers live in rigProps.RIG (tune them in viewer.html). */
export function handProps(g: Game, out: Box[]) {
  const n0 = out.length;
  handPropsRaw(g, out);
  // MOTION IDENTITY (scene/boxes.ts MKEY.rig): every rig box carries its man's id in `owner`; key = owner + the box's ordinal among HIS boxes this frame — stable for as long as his kit state
  // holds (a holster / draw reshuffles his parts for one frame, which the old index rule got wrong for everybody after him in the list every such frame)
  rigKeys(out, n0);   // (owner 0 = the weapon lasers' beam + dot, shared by every hunting man and re-cut every frame: left on the index rule)
}
const handOrd = new Uint16Array(256);
function rigKeys(out: Box[], n0: number) {
  const ord = handOrd; ord.fill(0);
  for (let k = n0; k < out.length; k++) { const b = out[k]; const o = b.owner & 0xff; if (o === 0) continue; b.mkey = MKEY.rig + (o << 8) + Math.min(255, ord[o]++); }
}
function handPropsRaw(g: Game, out: Box[]) {
  const pl = g.player, mine0 = out.length;
  const busy = pl.char.anim.hideHeldItem;   // hands on the lock tools (anim.lockpick) or both round a held man (the arm variant): empty hand, the Five-seveN on the thigh, no can, no lit lens — whatever the kit says. Holding a man with the pistol drawn (the gun variant) it stays in the hand — up beside his head, laid along the hold layer's gun hand like any carry — and its rail light with it if L had it on (updateHold poses the light off the same hand); drawn mid-hold (E) it comes into the fist as the animator's hand-over passes half way (holdGunSide), the fist then behind the man's shoulder; holstered mid-hold it is on the thigh from the key's frame like any E
  // the can in the hand: during a throw it is the one being thrown until the release frame and nothing for the rest of the swing (whatever the
  // count says — the count drops at release, which used to pop the next can into the follow-through and empty the hand while winding up the last one)
  // Which can, if any: the ONE rule is Player.canisterSel — a canister slot SELECTED (and, below, drawn: not holstered / busy / down …). It used to read 'any slot but
  // the pistol's', which was every canister slot in the three-slot kit and became 'the rifle too' the day the kit grew a fourth: the smoke can rode in the fist
  // beside the FN2000 (playtest 08-08). player.ts throws by the same accessor, so what the fist shows is what a click would throw.
  const kindSel = pl.canisterSel; const an = pl.char.anim; const pistolUpNow = pl.pistolUp && !busy;   // (close.ts: the knife of the close-in tell is in the right fist only when no pistol is)
  const heldNow: ThrowKind | null = pl.down || busy || !kindSel || pl.holstered || pl.dragging || pl.sprinting ? null
    : an.inThrow ? (an.throwing ? (pl.pendingThrow ? pl.pendingThrow.kind : THROW_BY.on && an.throwTime >= THROW_RELEASE ? null : kindSel) : null)   // (THROW_BY: the can is out of the fist the frame it is in the air — `throwing` runs three frames past the release, and the fist used to show the next can under the one just thrown; a wind-up called off before that keeps its can, as ever)
    : g.throwCount(kindSel) > 0 ? kindSel : null;
  an.noKnife = closeBare(g);   // (close.ts CLOSE.noKnife: nothing of his reaches for a blade)
  const knifeNow = !an.noKnife && ((!!pl.holding && pl.holding.variant === 'arm' && !pl.down && !an.holdGunSide && !disarmHand(pl.holding)) || (an.knifeShown && !pl.down && !pl.holding && !pistolUpNow));   // a man held with the hands empty: the knife is out, in the fist at his throat (character.ts holdLayer poses it) — for exactly as long as the hold lasts, sheathed again the frame it ends however it ends; swapped mid-hold (E) the old tool leaves the fist on the key's frame (the variant / Player.holstered change there) and the other arrives half way through the animator's hand-over, the fist then back behind the man's shoulder (holdGunSide) — never the two in one fist
  // the FN2000: in both hands (selected and off the sling, hands not busy on a lock or a man, not hauling a body — the animator's long gun then, player.ts), else slung across
  // his back for as long as the kit has it; gone from a downed man's hands if that is where the round found it (hitPlayer dropped the item), still on his back if it was there.
  // One place a frame.
  const rifleNow: 'hand' | 'slung' | null = !pl.hasRifle ? null : pl.down ? (pl.rifleGone ? null : 'slung') : pl.rifleUp && !busy ? 'hand' : 'slung';
  const pistolNow = pl.pistolUp && !pl.down && !busy;   // (rigProps' `slot`: 1 = the Five-seveN in the right hand, anything else = not — it never was the kit's slot number, only ever compared with 1)
  // KIT ANIMATIONS (kitanim.ts): while his hand is carrying a thing to where it lives or bringing one out, what the fist shows is the HAND's word, not the slot's
  const show = { pistolInHand: pistolNow, rifle: rifleNow, held: heldNow, knife: knifeNow }, kit = KITANIM.on ? kitShow(g, show) : undefined;
  const { pistolInHand, rifle, held, knife } = show, lensUp = !KITANIM.on || kitGunUp(g);   // (kitanim.ts: a gun on its way to or from where it lives shows no lit lens — its light is off: player.ts poseGunLight)
  const fit = KITANIM.on && KITANIM.grips && !g.touring; an.gripCan = fit && held !== null;   // (kitanim.ts: held things drawn IN the hand — rigProps GRIPFIT)
  const bigS = bigCarried(g, pl.char);   // (bigkit.ts: the hammer or the breaching shotgun in his big slot — on his back, or in his hands for its beat (the animator's bigK; his own gun is then away through `busy` above); null with the switch off: nothing below is added)
  const bigOver = rifle === 'slung' && !(KITANIM.on && kitSlingFront(g));   // (his rifle lies ACROSS HIS BACK under it this frame — not in his hands, not on its sling in front: only then does the tool ride clear of anything)
  an.bigSide = bigS === 'hammer' ? hammerSide(pl.char) : null;   // (packside.ts: he wears a pack — the hammer stands at its side, and the DRAWN hand is carried there: Character.packSidePass)
  an.bigClear = bigS === 'hammer' && bigOver ? bigClearOf(pl.char, 'hammer') : 0;   // (the hand that goes for the handle reaches where the drawer has it — character.ts bigLayer)
  const inHand = INHAND.on && !pl.down;   // (inhand.ts: his pistol is laid out in the hand's own frame, and the figure is told what its right hand holds — a frame behind, as gripCan is: its look-only pass turns that hand onto the aim line; a rifle drawn without kit handling's fit has the hand moved onto its grip instead)
  pl.char.inHand = !inHand ? null : pistolInHand ? IN_PISTOL : rifle === 'hand' && !fit && INHAND.long ? longHold('sc20k') : null;
  an.grip[1] = held !== null;   // the fist round a can stays a fist (character.ts HAND: the hand pass would otherwise let an 'empty' right hand hang open through the can) — fingers only, read by nothing; by what the fist SHOWS
  rigBoxes(pl.char, { goggles: kitYouNvg(pl) /* (kittree.ts: a card that left them at home — nothing is worn) */, nv: pl.nv, slot: pistolInHand ? 1 : 0, lightOn: pl.pistol.lightOn && pistolInHand && !pl.sprinting && lensUp, isGuard: false, holster: !(pl.down && pl.pistolUp), held, knife, rifle, rifleBlack: sneakSuit(g, pl.char), rifleLight: rifle === 'hand' && pl.rifle.lightOn && !pl.sprinting && lensUp, ...(CLOSE.on && !CLOSE.noKnife ? { sheath: true } : null), ...(kit ? { kit } : null), ...(fit ? { fit } : null), ...(inHand ? { inHand } : null), ...(KITANIM.on && rifle === 'slung' && kitSlingFront(g) ? { slingFront: true, slingRest: kitSlingRest(g) } : null), ...(pl.char.anim.nvShown !== undefined ? { nvK: pl.char.anim.nvShown } : null), ...(bigS ? { big: bigS, bigK: pl.down ? 0 : an.bigK, bigClear: bigOver } : null) }, out);   // (close.ts: the knife he reaches for is drawn in its sheath on his chest only with the close-in switch on)   // holstered (E): empty hands, the pistol drawn on the thigh   // canister up (or the rifle in the hands): gun on the thigh, can in the fist only if a can is what is selected; down: whatever was in the hand has left it (dropFromHand) — a holstered gun stays holstered, the goggles stay on   // (the light itself is forced off while down / sprinting: no blazing lens then)   // (a downed player's light is forced off in updatePlayer: no lit lens on the body either)
  workProps(pl.char, out);   // (handwork.ts: the objective in his hands as it comes out of its rack)
  samLaserBoxes(g, out);   // (irlaser.ts: the IR laser on the gun in his hands, his goggles down, a scenario's team on the floor — nothing otherwise)
  if (g.rails?.skyOn) out.length = mine0;   // (rails.ts, the seat with nobody on the floor: the parked player is not drawn — game.ts drawMen — and neither is his kit)
  for (const gd of g.guards) {
    if (g.fogOfWar.hidden(gd)) { gd.char.inHand = null; continue; }   // fog of war (fogofwar.ts): a man nobody on the team sees is not drawn — nor what he carries (never true while it is off)
    guardProps(g, gd, out);
  }
  for (const cv of civiliansShown(g)) { const an = cv.char.anim; if (an.bound === 1 && an.mv2Shown.bound > 0.6 && cv.state !== 'dead' && !g.fogOfWar.hidden(cv)) wristTieBoxes(cv.char, out); }   // a hostage's wrists are tied (rigProps.ts): the strap, while the pose shows them crossed behind her
}
/** PACK SIDE (packside.ts): where the hammer's grip point and handle are at the side of the pack this man wears, in his chest joint's own space — the drawer's
 *  place (rigProps.ts packSideBind) said to the hand that is DRAWN going for it (Character.packSidePass). null: no pack, or the switch off */
export function hammerSide(c: Game['player']['char']): { o: Vec3; z: Vec3 } | null {
  const p = packSideBind(c, 'hammer'); if (!p) return null;
  const l = sideLocal(c.ch, p); return l ? { o: l.o, z: l.z } : null;
}
/** what ONE guard / unit carries and wears, as boxes (handPropsRaw's row for him — it only reads him) */
function guardProps(g: Game, gd: Guard, out: Box[]) {
  const big = bigCarried(g, gd.char);   // (bigkit.ts: a teammate's big slot — null for everybody else and with the switch off: his row as it always was)
  const stow = stowHang(g, gd);   // (workstow.ts: his gun is out of his hands for a two-handed job — hung as for the hammer; false with the switch off)
  if (!big) { guardKit(g, gd, out, stow); hungSide(g, gd, out); return; }
  const an = gd.char.anim, alive = gd.state !== 'dead';
  an.bigSide = big === 'hammer' ? hammerSide(gd.char) : null;
  guardKit(g, gd, out, stow || (alive && an.bigTool !== null && an.hideHeldItem));   // (the hammer in his hands: his own gun hangs down his front — the animator's own word for when his hands are off it)
  // … then the tool itself, LAST of his boxes (the motion keys of the parts above are their ordinals). The shotgun OUT (bigkit.ts gunUp) is already the gun in his
  // hands, drawn above as his weapon: the gun he put down for it hangs down his front, and no second shotgun rides his back
  if (big === 'shotgun' && alive && gd.slung?.out) { const own = gd.slung.own.def.rig; if (own === 'carbine' || own === 'sc20k') hungBoxes(gd.char, own, out, RIG, sneakSuit(g, gd.char)); else hungSide(g, gd, out); return; }
  hungSide(g, gd, out);
  bigBoxes(gd.char, big, alive ? an.bigK : 0, out);
}
/** GUNHAND.throwFree (gunhand.ts): a man throwing with his free hand, the long gun still in the other — the grenade is drawn in the LEFT fist until it leaves him */
function freeCan(g: Game, gd: Guard, out: Box[]) { if (GUNHAND.on && GUNHAND.throwFree && gd.char.anim.throwOff && fragInFist(g, gd)) freeCanBoxes(gd.char, 'frag', out); }
/** gunslots.ts: a teammate with his sidearm out — the long gun he let go of hangs down his front on its sling */
function hungSide(g: Game, gd: Guard, out: Box[]) { const own = sideHung(gd); if (own) hungBoxes(gd.char, own, out, RIG, sneakSuit(g, gd.char)); }
/** … his row without the big slot's tool. `hang` (the tool in his hands, or a two-handed job — workstow.ts): his own gun is out of his hands for it — a long gun on its sling down his front, a sidearm on his thigh, no lit lens, no laser */
function guardKit(g: Game, gd: Guard, out: Box[], hang: boolean) {
  gd.char.inHand = null;   // (inhand.ts: said below on the rows that put a pistol, a torch or a long gun in his hands)
  const HO = INHAND.on && sideOfTeam(gd.team, gd.trained) === 'defender' ? INHAND.holsterOut : 0, HR = HO ? { ...RIG.holster, out: RIG.holster.out + HO } : undefined;   // (inhand.ts: a defender's holster clear of his long shirt)
  const rk = rigOf(gd); const carbine = rk === 'carbine';   // rifles (guards.ts rigOf): the carbine is in both hands in every living state, its light on the handguard, the sidearm on the thigh throughout; dying, the whole rifle leaves his hands (killGuard → the row's 'rifle' drop) and the sidearm he never drew stays on the body
  if (gd.state === 'dead') { if (nvgWorn(g, gd)) gogglesBoxes(gd.char, false, out, RIG.goggles);   // (nvg.ts: a teammate's goggles stay on his head, dark, as Sam's do)
    if ((gd.dropped?.kind === 'torch' || gd.dropped?.kind === 'rifle') && !runnerBare(gd)) holsterBoxes(gd.char, out, rk === 'sc20k' ? { slide: RIG.pistol.slide, grip: RIG.pistol.grip, suppressor: RIG.pistol.suppressor } : { slide: RIG.guardPistol.slide, grip: RIG.guardPistol.grip }, undefined, rk === 'sc20k' ? undefined : HR); return; }   // what he held is on the floor; a man who died on patrol — or a rifleman, whose sidearm never left the thigh — still wears his sidearm (an operative's, the suppressed one he wore alive)
  const fl = gd.flashlight;   // torch carried in the hand on a calm patrol (the spot light sits at its lens), drawn pistol with a weapon light otherwise (an alarmed floor patrols drawn: Guard.drawn) — guards.ts handCarry / inHand
  const rule = inHand(gd), held = swapHeld(gd, rule);   // (handwork.ts: for the frames of a torch ↔ sidearm swap the hand shows what it really has — the rule's own answer otherwise)
  if (handworkOn('swap') && rule !== null && held !== 'torch' && rk === 'pistol' && !kitPistol(gd) && gd.torchLostAt < 0) beltTorch(gd.char, out);
  if (!held && gd.gunLostAt >= 0 && rk === 'pistol' && !kitPistol(gd) && gd.torchLostAt < 0 && handworkOn('swap')) beltTorch(gd.char, out);   // (HOLD.dropGun: the pistol went to the floor at the grab; the torch he was not carrying is still on his belt)   // …and the torch hangs on his belt whenever it is not in his hand (nor on the floor)
  if (!held && ((runnerFled(gd) && (!carbine || runnerBare(gd))) || (rk === 'pistol' && gd.gunLostAt >= 0))) return;   // (runner.ts, false with its switch off: the sidearm he dropped is on the floor — empty hands and an empty holster; a rifleman who ran keeps the sidearm he never drew, below — unless it went to the floor too: runnerBare, RUNNER.anyway)
  if (!held) { holsterBoxes(gd.char, out, { slide: RIG.guardPistol.slide, grip: RIG.guardPistol.grip }, undefined, HR); return; }   // his torch is on the floor (knocked out at the grab) and the pistol stays holstered: empty hands
  if (hang) {   // (bigkit.ts: his hands are on the hammer — the three rows below with the gun let go of)
    if (rk === 'sc20k') rigBoxes(gd.char, { goggles: nvgWorn(g, gd), nv: nvgDown(g, gd), slot: 0, lightOn: false, isGuard: false, holster: true, rifle: 'slung', slingFront: true, rifleBlack: sneakSuit(g, gd.char) }, out);
    else if (kitPistol(gd) && gd.weapon.def.rig === 'pistol') rigBoxes(gd.char, { goggles: nvgWorn(g, gd), nv: nvgDown(g, gd), slot: 0, lightOn: false, isGuard: false, holster: true }, out);
    else { rigBoxes(gd.char, { goggles: false, nv: false, slot: 1, lightOn: false, isGuard: true, weapon: carbine ? 'carbine' : 'pistol', hang: true, ...(HO ? { holsterOut: HO } : null) }, out); if (kitIndex(gd) && nvgWorn(g, gd)) gogglesBoxes(gd.char, nvgDown(g, gd), out, RIG.goggles); }
    return; }
  if (rk === 'sc20k') { if (INHAND.on && INHAND.long) gd.char.inHand = longHold('sc20k');
    rigBoxes(gd.char, { goggles: nvgWorn(g, gd), nv: nvgDown(g, gd), slot: 0, lightOn: false, isGuard: false, holster: true, rifle: 'hand', rifleBlack: sneakSuit(g, gd.char), rifleLight: fl.enabled }, out); if (laserOn(g, gd)) laserBoxes(g, gd, out); freeCan(g, gd, out); return; }   // (teams: a man handed Sam's bullpup — the showcase's operative — is drawn through Sam's own kit path: the FN2000 in both hands, a sidearm on the thigh, no goggles — a teammate in a scenario wears Sam's: nvg.ts)
  if (kitPistol(gd) && gd.weapon.def.rig === 'pistol') { if (INHAND.on) gd.char.inHand = IN_PISTOL; rigBoxes(gd.char, { goggles: nvgWorn(g, gd), nv: nvgDown(g, gd), slot: 1, lightOn: fl.enabled, isGuard: false, ...(INHAND.on ? { inHand: true, ...(INHAND.fit ? { fit: true } : null) } : null) }, out); if (laserOn(g, gd)) laserBoxes(g, gd, out); return; }   // (kit.ts: a teammate whose card hands him Sam's Five-seveN is drawn with Sam's — the can on it, the rail light under it)
  const ih = INHAND.on && !carbine && held !== 'torch';   // (inhand.ts: his pistol is drawn in the hand; a torch and a carbine are drawn where they were and the hand goes to them)
  if (INHAND.on) gd.char.inHand = carbine ? (INHAND.long ? longHold('carbine') : null) : held === 'torch' ? (INHAND.torch ? torchHold(gd.beamDir) : null) : IN_PISTOL;
  rigBoxes(gd.char, { goggles: false, nv: false, slot: 1, lightOn: fl.enabled, isGuard: true, torch: held === 'torch', beamDir: gd.beamDir, lensColor: fl.color, weapon: carbine ? 'carbine' : 'pistol', ...(ih ? { inHand: true } : null), ...(HO ? { holsterOut: HO } : null) }, out);
  if (kitIndex(gd) && nvgWorn(g, gd)) gogglesBoxes(gd.char, nvgDown(g, gd), out, RIG.goggles);   // (kit.ts: a teammate whose card hands him the carbine or the 9 mm wears his goggles like the rest)
  if (laserOn(g, gd)) laserBoxes(g, gd, out);   // drawn and hunting (irlaser.ts laserOn — for a man without goggles exactly: alert / search, muzzle not lowered, not held): the sidearm's laser is on — thumb off the switch while the gun is down for a colleague in the line (guards.ts muzzleCheck): nobody paints the back of the man ahead of him; pinned in Sam's arm the hand is off it altogether
  if (carbine) freeCan(g, gd, out);   // (last: nothing of his before it changes its place in the list for the frames it is drawn)
}
/** …and what the men the fog of war leaves OUT carry — for a viewer's picture without the fog (Game.fogLift: a replay played in the engine). Never part of a
 *  step: the frame's own list (handProps) is what every ray and rule reads. */
export function hiddenProps(g: Game, out: Box[]) {
  const n0 = out.length, fog = g.fogOfWar;
  for (const gd of g.guards) if (fog.hidden(gd)) guardProps(g, gd, out);
  for (const cv of civiliansShown(g)) { const an = cv.char.anim; if (an.bound === 1 && an.mv2Shown.bound > 0.6 && cv.state !== 'dead' && fog.hidden(cv)) wristTieBoxes(cv.char, out); }
  rigKeys(out, n0);
}
/** …and the INFRARED lines the run's men really have on (a teammate's laser with his goggles down, Sam's with his), for a viewer's picture through a tube the
 *  run's own picture did not have (Game.fogLift, the engine replay's 'NV' switch): the very rule a step draws them by — guardProps' own gates, laserBoxes,
 *  samLaserBoxes — asked as if the picture were the tube's. Never part of a step, and it reads only. */
export function irBeams(g: Game, out: Box[]) {
  irViewAs(true, () => {
    for (const gd of g.guards) { if (gd.state === 'dead' || g.fogOfWar.hidden(gd) || laserBand(g, gd) !== 'ir' || !swapHeld(gd, inHand(gd)) || !laserOn(g, gd)) continue; laserBoxes(g, gd, out); }
    samLaserBoxes(g, out);
  });
}

/** WHETHER AN ENEMY CARRIES A VISIBLE WEAPON LASER (Tab ▸ Sandbox ▸ Team feel ▸ 'enemies carry visible lasers', kept per machine by teamfeel.ts; ?enemylasers
 *  for a visit; the maintainer after playing: 'the enemies having super visible lasers is a bit much', then 'we should probably just remove them for realism,
 *  not just tone them down'). false, the default: a man hostile to Sam has no laser — no line and no dot, in any state, in every game and both showcases.
 *  true = the game as it was: every hunting man's red line from muzzle to dot. Nothing else changes with it either way: the laser was only ever a picture
 *  (NoShadow geometry no ray, eye or AI reads — laserBoxes below is its one site), so no man aims, sees or decides differently without it. Not touched: the
 *  team's own lasers (operatives) and the tripwires' beams (devices.ts). */
export const LASER = { enemy: false };

/** A hunting man's weapon laser: a hair-thin emissive line from the muzzle to whatever it meets (wall, prop, Sam) and a brighter dot there. Purely
 *  emissive geometry flagged NoShadow, so no ray (light, sight, bullet, cursor) ever sees it; in the haze it reads exactly like a laser in smoke, and it
 *  tells you precisely where he is looking. An ENEMY's (a man hostile to Sam) is drawn only under LASER.enemy. A TEAMMATE's is infrared while his goggles are
 *  down (irlaser.ts laserBand): the same line, drawn only while the picture is the tube's. */
export function laserBoxes(g: Game, gd: Guard, out: Box[]) {
  if (!LASER.enemy && isHostile(gd.team, 'player')) return;
  const ir = laserBand(g, gd) === 'ir'; if (ir && !irViewer(g)) return;   // (beamBoxes holds the rule; asked here first to spare the ray)   // (irlaser.ts: 'visible' for everybody with IR.on off, and always for a man with no goggles)
  const R = laserReach(g, gd.char, gd, ir); if (!R) return; const { from, dir, L, dot } = R;
  if (ir && R.on && paintsOwn(g, gd, R.on)) return;   // (irlaser.ts: a goggled man's thumb is off the switch while his bore lies on Sam or a teammate)
  const B = drawnBeam(gd.char, from, dir, L);   // (stature.ts: the beam as DRAWN leaves his drawn muzzle and ends on the same point — the very ray, k 1, for a man drawn as the skeleton has him)
  const fog = g.fogOfWar;
  if (fog.active && fog.knobs.lasers && !fog.onTeam(gd)) {   // fog of war: an enemy's beam is drawn only where somebody on the team has a line to it, and not for a man who is only lingering in the picture
    if (!fog.seen(gd)) return;
    for (const [t0, t1] of fog.beamRuns(from, dir, L)) if (t1 - t0 > 0.02) beamBoxes(g, v3.mad(B.from, B.dir, t0 * B.k), B.dir, (t1 - t0) * B.k, out, dot && t1 >= L - 1e-6, ir);
    return;
  }
  beamBoxes(g, B.from, B.dir, L * B.k, out, dot, ir, true);
}
/** WHERE A WEAPON LASER GOES: from `c`'s muzzle along his bore to the first thing it meets inside 30 m — a static, a prop, a live Sam, a living man the picture
 *  shows — whether it ends ON something (the dot), and the man it ends on (`on`; null: a wall, a prop, nothing). `self` = the guard carrying it (null: Sam's own, irlaser.ts). `civ`: a standing civilian — a hostage —
 *  stops it too (the infrared lasers ask: they lie along every shouldered gun in the rescues; the red one never did and is left as it was). null = no beam
 *  (no bore, or the muzzle is against what it meets). */
export function laserReach(g: Game, c: Character, self: Guard | null, civ = false): { from: Vec3; dir: Vec3; L: number; dot: boolean; on: Character | null } | null {
  const from = v3.mad(c.muzzle, c.gunDir, 0.02); const dir = c.gunDir;
  if (!isFinite(dir[0]) || v3.len(dir) < 0.5) return null;
  let L = 30, on: Character | null = null; const wh = g.engine.world.raycast(from, dir, L, BoxFlag.NoShadow | BoxFlag.Glass, c.id & 0xff); if (wh) L = wh.t;   // (glass: the dot lands on the man behind the pane, as the light does) · ceilings (NoPrimary) DO stop it — a flailing dazzled man must not paint a 30 m line through the roof
  const ph = g.props.raycast(from, dir, L); if (ph) L = Math.min(L, ph.t);
  if (c !== g.player.char) { const tp = g.player.char.rayHit(from, dir, L); if (tp >= 0 && tp <= L) { L = tp; on = g.player.char; } }   // (a live Sam stops it; bodies on the floor do not — rayHit ignores the dead; a muzzle inside a body — the man stacked ahead — draws through, not blank)
  for (const o of g.guards) { if (o === self || o.state === 'dead' || g.fogOfWar.hidden(o)) continue; const t = o.char.rayHit(from, dir, L); if (t >= 0 && t <= L) { L = t; on = o.char; } }
  if (civ) for (const cv of civilianBodies(g)) { const t = cv.char.rayHit(from, dir, L); if (t >= 0 && t <= L) { L = t; on = cv.char; } }
  if (L < 0.05) return null;
  return { from, dir, L, dot: !!(wh || ph || L < 30), on };
}
/** A red laser line from `from` along unit `dir` for `L` metres, and (dot) the bright bead where it lands: hair-thin emissive geometry flagged NoShadow — no ray
 *  (light, sight, bullet, cursor) ever sees it, in the haze it reads as a laser in smoke. The hunting guard's weapon laser above, and the tripwires' beams
 *  (devices.ts) — one draw for both. `ir`: the same line in the infrared (irlaser.ts IR_TINT: no hue, the red one's luminance — what the tube makes of it is
 *  what it makes of the red one) — and THE ONE PLACE an infrared box is made: none unless the picture is the tube's (irViewer), whoever asks. */
export function beamBoxes(g: Game, from: Vec3, dir: Vec3, L: number, out: Box[], dot: boolean, ir = false, air = false) {
  if (ir && !irViewer(g)) return;
  const red: Vec3 = ir ? IR_TINT : [1, 0.06, 0.03];
  const hw = Math.max(0.0022, 0.45 * g.mPerPx); const gain = 0.0022 / hw;   // never thinner than ~a pixel (a 4 mm beam at 15 m is a crawling dashed line otherwise); widened → dimmed by the same factor so the line carries the same light
  const up: Vec3 = Math.abs(dir[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0]; const x = v3.normalize(v3.cross(up, dir)); const y = v3.cross(dir, x);
  const line = makeBox({ c: v3.mad(from, dir, L / 2), h: [hw, hw, L / 2], yaw: v3.yawOf(dir), rot: quat.fromBasis(x, y, dir), albedo: ir ? [0, 0, 0] : [0.02, 0, 0], emissive: v3.scale(red, 9 * gain), flags: BoxFlag.NoShadow | BoxFlag.Dynamic });
  thinNote(line, 0.0022, 0.45, red[0] * 9, red[1] * 9, red[2] * 9);   // (thinline.ts: a picture drawn from another view than this step's — the engine replay's — re-sizes it for its own pixel)
  out.push(ir ? irNote(line) : line);
  if (dot) { const end = v3.mad(from, dir, L - 0.006), bead = makeBox({ c: end, h: [0.011, 0.011, 0.011], yaw: 0, albedo: ir ? [0, 0, 0] : [0.05, 0, 0], emissive: v3.scale(red, 40), flags: BoxFlag.NoShadow | BoxFlag.Dynamic }); out.push(ir ? irNote(bead) : bead); if (air) thinAir(line, bead); }
  else if (air) thinAir(line, null);   // (air: a WEAPON laser — the renderer may draw the pair as light in the air, settings.beamAir; the boxes are the same either way)   // the dot: a small bright bead where the beam lands
}

export function updateItems(g: Game, dt: number) {
  g.items.update(dt, g);
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
    } else if (it.kind === 'frag') fragFuse(g, it, dt);   // the fragmentation grenade (frag.ts): its fuse runs from the hand, in the air or on the floor
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

/** THE FLASHBANG IN A ROOM FIGHT (a scenario: units on the floor, roomfight.ts fightLive — the night game's stun canister keeps effects.ts bang's numbers, as ever).
 *  What it does to a man is three things, each falling off from the can to the edge of bang.dazzleRadius:
 *    BLIND   `secs` seconds (Guard.dazzledUntil: sees nobody, fires at nobody he can name) — to anybody the fireball has a line to: from the can itself, or from
 *            `lift` metres over it when the can can see that point (a can on the floor behind a desk still fills the room over the desk);
 *    STUNNED `stagger` seconds of it doubled over (Guard.staggerUntil: rooted, gun down, NO round — so the blind burst a defender owes the door he was watching
 *            (nightbreach.ts BLIND) is mostly or wholly lost: its turns come due while he is folded) — it was a dazzle only, and the room answered every bang with
 *            twelve rounds a man back through the doorway;
 *    THE BANG WITHOUT THE FLASH: a man the fireball has no line to (round the end of a cabinet, behind a partition) but who shares its air — within `concussM` by
 *            the sound's own path (collision.ts SoundPaths: over furniture, round corners, never through a wall or a shut leaf) — takes `concussK` of both.
 *  ITS OWN SIDE knows it is coming ('bang out': heads turned, eyes shut): the thrower's team is touched only inside `ownM`, for `ownSecs`, and never folded —
 *  Sam's own can no longer blinds the stack he threw it past. And his can is a COOKED one: it goes off `fuse` seconds after it lands (the night game's sits
 *  bang.fuse 1.5 s on the floor of a room whose door is already open). `on` false = the dazzle, and the fuse, as the night game has them. */
export const FLASH = { on: true, secs: [7, 4] as [number, number], stagger: [2.5, 1.0] as [number, number], lift: 1.2, concussM: 6, concussK: 0.5, ownM: 2.5, ownSecs: 1.5, fuse: 0.7 };
/** seconds one of Sam's stun canisters sits after it lands: FLASH.fuse in a room fight, else the night game's (effects.ts bang.fuse) */
export function flashFuse(g: Game): number { return FLASH.on && fightLive(g) ? FLASH.fuse : fx.bang.fuse; }

/** The stun canister goes off: graded burst (jets, wisp, sparks + trails) on the coarse smoke lattice, the white flash, the bang every guard on the
 *  floor hears, and the gameplay effect — guards with line of sight within bang.dazzleRadius are dazzled (Guard.dazzledUntil: canSee() fails, they
 *  cannot fire, and reactT roots them to the spot), then go and look at where it went off like any other loud noise. */
export function detonateStun(g: Game, it: Item, borrowed = false, sam?: { side?: Team; spare?: boolean }) { return g.fogOfWar.doing(it.who, () => detonateStunRaw(g, it, borrowed, sam)); }   // (its sparks and dust are its thrower's doing: fogofwar.ts FOG.ours)
function detonateStunRaw(g: Game, it: Item, borrowed: boolean, sam?: { side?: Team; spare?: boolean }) {   // (`borrowed`: a door or wall charge using the canister's report and flash — to destruction.ts it stays a blast, not a stun)
  const B = fx.bang; const at: Vec3 = [it.pos[0], it.pos[1] + B.height, it.pos[2]];
  g.doors.blast(at, DOORBLAST.tearM.stun, it.who ?? 0);   // the doors' side of a blast (doorblast.ts): a stun charge's reach on a leaf is 0 — it takes none off
  const gpu = gpuFx(g);   // GPU particles on: the CPU pool only flies the dozen fragments that carry smoke trails (their emitters ride CPU positions); the four hundred you see and the dust ring are bangFx's
  const L = fx.spawnBurst(g.smoke, g.sparks, at, g.fxSeed++, gpu ? { sparkCount: Math.min(B.sparkCount, fx.flags.trails ? B.trailCount : 0) } : undefined);
  if (gpu) bangFx(g, at);
  const light = g.fogOfWar.lightBy(g.engine.lights.flash(L.pos, L.color, L.intensity, L.range, L.ttl, 0), it.who); if (L.radius) light.radius = L.radius;   // (FOG.ours: the team's own can or charge lights the fog's picture too)
  if (!wallReport(g, at)) g.audio.play('stunBang', at, 1.0);   // (blastFeel.ts, under the destruction switch: a WALL charge has its own report — crack, thump and falling debris — and the rest of its feel starts there; false = the can's, as ever)
  bangScorch(g, at);   // decals (E1, marks.ts): the scorch on what it lay on and the splashes up whatever stands within a metre
  g.destr.bang(at, it.who, 1, !borrowed);    // DESTRUCTION (destruction.ts, behind tune.chaos): the desk over it cleared, papers up in a ring, the tile above down, dust off the ceiling, the litter about it up again — what it knocks about is heard as the THROWER's doing
  if (borrowed) g.destr.furnBlast(at, 'door', it.who);   // a CHARGE's borrowed bang (the door charge) reaches the furniture round it — a stun grenade's own never does (game/furnblast.ts)
  const eye = g.player.char.bones.head ?? v3.add(g.player.char.pos, [0, 1.6, 0]);
  if (!g.player.down && v3.dist(eye, at) < B.dazzleRadius && !g.col.segmentBlocked(v3.add(at, [0, 0.3, 0]), eye)) g.audio.play('earRing', null, clamp(1.2 - v3.dist(eye, at) / B.dazzleRadius, 0.25, 0.8));
  g.events.push(borrowed ? { kind: 'bang', pos: v3.copy(at), time: g.time, loud: true, charge: true } : { kind: 'bang', pos: v3.copy(at), time: g.time, loud: true });
  let n = 0;
  const F = FLASH, entry = F.on && fightLive(g);   // (a room fight's flashbang — FLASH above; else the night game's dazzle, as it was)
  const side: Team = it.side ?? (it.who ? teamOfId(g, it.who) : 'player'); const from = v3.add(at, [0, 0.3, 0]), over = v3.add(at, [0, F.lift, 0]), lifted = entry && !g.col.segmentBlocked(from, over);
  if (fx.flags.dazzle) for (const gd of g.guards) {
    if (gd.state === 'dead') continue;
    const head = gd.char.bones.head ?? v3.add(gd.char.pos, [0, 1.65, 0]); const d = v3.dist(head, at);
    if (d > B.dazzleRadius) continue;
    let secs: number;
    if (!entry) {
      if (g.col.segmentBlocked(from, head)) continue;   // behind a wall or a closed door: only hears it
      secs = lerp(B.dazzleSeconds, B.dazzleMin, clamp(d / B.dazzleRadius, 0, 1));
    } else {
      const seen = !g.col.segmentBlocked(from, head) || (lifted && !g.col.segmentBlocked(over, head)); let k = 1;
      if (!seen) { const pr = g.col.sound.propagate(at, head); if (pr.muffle > 0.6 || pr.pathLen > F.concussM) continue; k = F.concussK; }   // no line to the fireball: the bang alone, if he shares its air
      const u = clamp(d / B.dazzleRadius, 0, 1);
      if (gd.team === side || (side === 'player' && gd.team === 'operative') || (side === 'operative' && gd.team === 'player')) {   // its own side: only a man on top of it
        if (d > F.ownM) continue; secs = F.ownSecs * k;
      } else {
        secs = lerp(F.secs[0], F.secs[1], u) * k;
        gd.staggerUntil = Math.max(gd.staggerUntil, g.time + lerp(F.stagger[0], F.stagger[1], u) * k * drilledK(g, gd)); gd.weapon.burst = null;   // (drilledK: 1 but for hard's night-breach defenders — roomfight.ts DRILLED)
      }
    }
    gd.dazzledUntil = Math.max(gd.dazzledUntil, g.time + secs); gd.reactT = Math.max(gd.reactT, secs);   // reactT > 0 is the AI's existing "stand and stare" — reused as the stagger
    gd.awareness = Math.max(gd.awareness, 0.6); if (gd.state !== 'alert') gd.lastKnown = v3.copy(at);
    if (g.aiEnabled) gd.witness.dazzled++;   // (his memory of it; the bang itself reaches his ears through hearingCheck like everyone's — nothing is remembered with the AI off)
    gd.path = []; gd.pathGoal = null; gd.speed = 0; gd.dazzledAt = v3.copy(at); gd.char.anim.hitFrom(v3.sub(gd.char.pos, at)); n++;
  }
  // …and the PLAYER by the same rule (samstun.ts): the night game's line-of-sight dazzle, or the room fight's — a line to the fireball = the full count with the
  // stagger whoever threw it (SAMSTUN.ownSeen), its air shared with no line = a defender's concussion, or his own side's can only on top of him
  // (`sam.side`: a caller that swaps the thrower out of g.guards for the call — the door tools' bang, the breach drill — says whose can it is: teamOfId would
  // answer 'guard' for a man who is not on the list; `sam.spare`: he stands where that caller spares its own men — this side of the door, 'bang out' heard: with no line to it, nothing)
  let samSecs = 0; const samSide: Team = sam?.side ?? side;
  if (SAMSTUN.on && !borrowed && fx.flags.dazzle && !g.player.down && !g.puppet && !g.touring) { const d = v3.dist(eye, at);   // (a door or wall charge borrowing this report has its own rule for who it catches: doortools.ts blow, wallcharge.ts)
    if (d <= B.dazzleRadius) { const u = clamp(d / B.dazzleRadius, 0, 1); let stag = 0;
      if (!entry) { if (!(sam?.spare && !SAMSTUN.ownSeen) && !g.col.segmentBlocked(from, eye)) samSecs = lerp(B.dazzleSeconds, B.dazzleMin, u); }   // (the night rule; where the caller spares its own men he is spared too once ownSeen is off — as before that rule)
      else { const seen = !g.col.segmentBlocked(from, eye) || (lifted && !g.col.segmentBlocked(over, eye)); let k = 1, reach = true;
        const own = samSide === 'player' || samSide === 'operative';
        // A BAD ENTRY FLASHES YOU (SAMSTUN.ownSeen; the maintainer: "it should totally be possible to flash yourself with a bad entry"): a can he has a LINE to
        // does to him what it does to a defender there, whoever threw it — his teammates are spared their own side's can because the drill turns their heads,
        // and nobody turns his. With no line his own side's can is the own-side rule (only on top of him), and nothing at all where the caller spares its men.
        const full = !own || (seen && SAMSTUN.ownSeen);
        if (!seen) { if (own && sam?.spare) reach = false; else { const pr = g.col.sound.propagate(at, eye); if (pr.muffle > 0.6 || pr.pathLen > F.concussM) reach = false; k = F.concussK; } }
        else if (own && sam?.spare && !SAMSTUN.ownSeen) reach = false;
        if (reach) { if (!full) { if (d <= F.ownM) samSecs = F.ownSecs * k; } else { samSecs = lerp(F.secs[0], F.secs[1], u) * k; stag = lerp(F.stagger[0], F.stagger[1], u) * k; } } }
      if (samSecs > 0) { dazzlePlayer(g, samSecs, at); if (stag > 0) staggerPlayer(g, stag, v3.sub(g.player.char.pos, at)); } } }
  g.msg(side === 'hostile' ? (n ? `their stun charge — ${n} dazzled` : 'their stun charge went off') : n ? `flashbang — ${n} guard${n > 1 ? 's' : ''} dazzled` : 'flashbang went off');   // (a defender's: pressure.ts PRESSURE.stuns)
  if (samSecs > 0) g.msg(`${samSide === 'player' || samSide === 'operative' ? 'a flashbang' : 'their stun charge'} blinded you`);
}

/** Sandbox / panel: drop an armed canister at `p` as if it had just landed there, thrown from where the player stands (short fuse, no inventory cost). */
export function dropThrowable(g: Game, kind: ThrowKind, p: Vec3) {
  const from = g.player.char.pos; const heading = v3.yawTo(from, p);
  const it = g.items.spawn(kind, [p[0], Math.max(p[1], 0) + 0.25, p[2]], [Math.sin(heading) * 0.5, 0, Math.cos(heading) * 0.5], { fuse: kind === 'frag' ? FRAG.fuse : 0.35, heading });   // (a frag dropped from the panel keeps its whole fuse: time to get clear, and for the room to react)
  it.onBounce = (sp, q, g) => g.audio.play('canisterBounce', q, Math.min(1, sp / 4));
}
