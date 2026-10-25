// Guard AI: hearing (the same propagation the mixer uses), vision (the player's light-meter irradiance, marched through smoke), patrol / suspicious / alert / search state machine, path following, torch handling, and their barks.
// (Split out of game.ts mechanically: plain functions taking the Game as their first argument; Game keeps one-line delegators for
//  anything other files call.)
import { SideMap, SideSet, rollbackVar, rollbackRoot } from '../math/side';
import { openingStart } from './opening';
import { Vec3, v3, clamp, wrapAngle, approachAngle, damp, lerp, smoothstep, DEG } from '../math/vec';
import { PatrolRoute, Chokepoint, RoomClearPlan } from '../scene/level';
import { Character, HOLD } from './character';
import type { UpperMode } from './character';
import { BoxFlag, rayBox } from '../scene/boxes';
import { FOG, fogThrough } from './fogofwar';
import { Door } from './doors';
import { rigLightPose, rigTorchPos, torchCarryDir, torchCarryWant, torchLightDef, RIG, sc20kLightPose } from './rigProps';
import { PLAYER_ID } from './consts';
import { leverStand, radioHand, swapHeld } from './handwork';
import { tread } from './floor';
import { tally } from './mission';
import { chronHeard, chronContact, chronLost, chronCalm, chronAlarm, chronRadio, chronBodyFound } from './chronicle';
import { fireWeapon, armThrough } from './combat';
import { lensClear } from './lighting';
import { gunWallCheck, gunWallPose } from './gunwall';
import type { Game, GameEvent, DownKind, DownBy, Temperament, Foe, PairId } from './game';
import { Guard, isBreathing, TEMPERAMENT } from './game';
import { runGuardScript, Clearing, inBounds, endGuardScript } from './squad';
import { fragFlee, ownBang, ownNoise } from './frag';
import { moraleScript } from './morale';
import { conditionPace, conditionCalm } from './condition';
import { runnerScript, runnerFled } from './runner';
import { DARKDOOR, darkDoorGate, darkDoorLook } from './darkdoor';
import { netQuietAsked, netQuietBody, netQuietPose } from './netquiet';
import { pairSmoke, fightLive, lampGlare, closeLane, ROOMFIGHT } from './roomfight';
import { roomName, updateAmbient, isOffice, temperamentOf } from './dialogue';
import { WORDS, w, wg } from './words';
import { CUES } from './cues';
import { SQUADNET } from './squadnet';
import { SUPPRESSION, headDown, endDisplace, holdingCover, guardFireMods, flinching } from './suppression';
import { trackGuard, aimReady, feetSettled, guardRound, handsCone, aimBrake, noteBore, boreFouled, AIM_DEBUG } from './aim';
import { isHostile, teamOfId, hostileTo, foeChar, foeDown, foeCrouched, HOSTILE, spokenName, defenderWords } from './teams';
import type { Team } from './teams';
import type { WeaponId } from './weapons';
import { nvgSight, nvgDark } from './nvg';
import { silentPace, silentStep, silentDark, silentHush } from './silent';
import { pairGripped, pairGripBody } from './pairorders';
import { PICTURE, PICTURE_STATS, ideaOf, pictureTell } from './picture';   // (asked inside colleagueFirePos only: src/game is one import cycle)
import { MAX_LIGHTS } from '../render/lights';
import { closeNearK } from './close';
import { calmTorchDark, TORCH } from './calmtorch';
import { darkFoeLit } from './darkfoe';
import { powerOutLit } from './powerout';
import { hearWhistle, whistleSoft, whistlePatrolTick, glanceToward, WHISTLE, WHISTLE_SOFT_UPPER } from './whistle';
import { hearPath, airTrans, loudLen, strokeLight } from './weather';
import { ATTENTION, attentionHeard, attentionTick, attentionSideK, attentionAside, attentionEarK, attentionNoiseK, attentionStep, attentionWalk, attentionDwell, attentionTold, attentionAgain } from './attention';
/** what a calm man mutters when a light before him dims out under the OCP and he puts it down to the wiring (guards.ts hearingCheck; the writing pass is the maintainer's) */
const OCP_MUTTER = ["light's on the blink again", 'hm — bulb\'s going', 'power dip?', 'these fittings…', 'that light again'];
import { tacticsAlert, doorGate, tacticsPenalty, tacticsLook, tacticsBodyFound, bodyDutyBlocked } from './tactics';
import { LANES, lanePenalty, laneGate } from './lanes';
import { DOORMANNERS, doorwayGate, offThreshold } from './doorway';
import { needsPatrol } from './needs';
import { dozePatrol, dozeDeaf, dozeDark, dozeAsleep, dozeEar } from './doze';
import { coverSeen, coverBlind } from './coverfire';
import { startleSight, startleHolds, startleTorch, startleLeft, startleScript } from './startle';
import { doorForce, doorForceHear, doorForceOwnBoot } from './doorforce';
import { GLASS } from './glass';
import { shotEnergy } from './glasspen';
import { kitPistol } from './kit';
import { feedBegin, feedDeal, feedDrop, feedStarts, feedTick } from './gunreload';   // (called inside the reload beat only)
import { sideOutAlert, sideLocked, quietHeard } from './gunslots';   // (called inside startReloadBeat only)
import { hourLight } from './hours';
import { handleGate } from './handleside';
import { gunHoldSee, gunHoldFeet, gunHoldFree, gunHoldKeeps, gunHoldRuns, gunHoldPhase } from './gunhold';
import { teamCap, teamRunLegs, teamAccel, teamTread } from './teampace';   // (teampace.ts: a teammate's walk is a share of the player's, and he runs only for a reason — all read inside functions)
import { loadPace, loadPaceOn, loadSprintOn, loadGait, loadSeen, loadHeard } from './kitload';   // what a man's card weighs: his pace, the notice he builds, his footfall (1 each with its switch off)
import { TAPSTEP, tapHears } from './tapstep';
import { simRandom } from '../math/dice';   // the simulation's die (math/dice.ts): the Game's own when it has one, Math.random otherwise
import { railsDown } from './rails';   // (a tutorial mission's spared teammate is a man down to the enemy's eye: asked inside acquireFoe only)

/** A/B switches for the AI passes (the QA probes flip them to print before / after off the same build; play never touches them): motion acuity in the sight
 *  gain, the search that deals hide spots and reads the renderer's light (off: the old sweep-and-wander), threshold discipline at doorways (off: straight through). */
export const AI_TUNE = { motionAcuity: true, darkSearch: true, pieing: true };

// ------------------------------------------------------------ guards
/** HOW A 'glass' EVENT REACHES AN EAR (hearingCheck below, civilians.ts): the usual propagation from the event's own point — and, where the event carries the
 *  pane's two faces (glass.ts glassEvent under GLASS.bothFaces), from each of those too, the one that arrives best standing (the glass rule's own weight: reach × carry inside GLASS.hearM; the event's own
 *  point wins a tie, so nobody hears a pane worse for the rule). No `ears` = hearPath of the point, exactly as before. */
export function glassHeard(g: Game, e: GameEvent, ear: Vec3): ReturnType<typeof hearPath> {
  let best = hearPath(g, [e.pos[0], e.pos[1] + 1, e.pos[2]], ear);
  if (!e.ears || best.direct) return best;   // (a clear run from the point itself: a face a hand's width nearer adds nothing, and the search is not paid for)
  const score = (p: typeof best): number => p.pathLen < GLASS.hearM ? Math.min(1, Math.max(0.15, 1 - p.pathLen / GLASS.hearM)) * p.carry : 0;
  let s = score(best);
  for (const q of e.ears) { const p = hearPath(g, [q[0], q[1] + 1, q[2]], ear); const k = score(p); if (k > s) { s = k; best = p; } }
  return best;
}
export function hearingCheck(g: Game, gd: Guard, ear = 1, eyes = true, foot = ear) {   // (doze.ts — `ear`: a man asleep in his chair, or at his screen with headphones on, hears the small noises at a share of this, and a footfall at `foot`; `eyes` false: asleep, he sees no light go out)
  const keen = escalationOf(g) >= 1 ? KEEN : 1, dull = keen * ear;   // an alarmed floor listens harder: the small noises (a creak, a scrape, a footfall) count for a quarter more
  const H = gd.witness.heard;   // what reached him and counted goes in his memory too (Witness): the same gates as the awareness it raises, nothing more
  let cur: GameEvent | null = null;   // (the event being weighed: attention.ts is told which small thing it was)
  const small = (where: Vec3) => { H.small++; H.smallWhere = v3.copy(where); H.lastT = g.time; if (cur) attentionHeard(g, gd, cur, where); };   // (attention.ts — a return on its first line with its switch off: a small thing that makes a calm man look takes his attention to where he puts it)
  for (const e of g.events) {
    cur = e;
    if (e.id === undefined) e.id = ++g.eventSeq;          // sequence ids: events raised by guards later in the update order are still heard next frame
    if (e.id <= gd.heardUpTo) continue;
    gd.heardUpTo = Math.max(gd.heardUpTo, e.id);
    const dStraight = v3.dist(e.pos, gd.char.pos);
    if (e.kind === 'lightOut') {
      if (eyes && dStraight < 10 && gd.awareness < 0.4 && lightOutSeen(g, gd, e)) {
        if (e.cause === 'ocp' && gd.awareness < 0.3 && g.tune.ocpNotice === 'glance') {
          // THE OCP'S SPELL (the maintainer, 08-12: 'it should be possible to turn off lights … without alerting everyone'): the light dims out and will be back — a calm man who
          // has it (or its pool) before his eyes shrugs at the wiring: his head cranes to it, a mutter, a little more awake, and that is all. Nobody walks over, nobody radios.
          // With his back to it he misses it unless it was the light he stands in (< 3 m). A man ALREADY suspicious, or a fixture SHOT dark (the pop, for good), takes it as below.
          const src: Vec3 = e.from ?? [e.pos[0], 2.4, e.pos[2]];
          const eye = gd.char.bones.head ?? v3.add(gd.char.pos, [0, 1.65, 0]); const to = v3.sub(src, eye); const L = v3.len(to);
          const shortOf: Vec3 = L > 0.6 ? v3.mad(eye, to, (L - 0.4) / L) : src;   // (a hand short of the fixture, as lightOutSeen stops: its own housing / the panel's slab would otherwise hide the very point tested — wave-4 review measured 12 of 20 fixtures failing the bare test)
          if (dStraight < 8 && (dStraight < 3 || pointInView(g, gd, shortOf, 10, 75) || pointInView(g, gd, [e.pos[0], 0.15, e.pos[2]], 10, 75))) {
            gd.awareness = Math.min(0.28, gd.awareness + 0.18); glanceToward(g, gd, e.pos, 1.8); small(e.pos); chronHeard(g, gd, e);
            if (!e.announced && gd.state === 'patrol') { e.announced = true; g.say(gd, OCP_MUTTER[(gd.char.id + Math.floor(g.time)) % OCP_MUTTER.length], false); }
          }
        } else { gd.awareness = 0.4; gd.lastKnown = v3.copy(e.swAt ?? e.pos); gd.reactT = 0.8; small(e.swAt ?? e.pos); chronHeard(g, gd, e); }   // shot dark, or he was already on edge: over he comes to the patch that went out (put out at a wall switch — lightswitch.ts: to the switch)
      }
      continue;
    }   // SEEN, not heard: a light dying near him whose fixture (or the patch of floor under it) his eye has a line to — not one going out in the next office through the wall (review A6.3) — remembered with the small things
    if (e.kind === 'whistle') { if (dStraight <= WHISTLE.horizon) hearWhistle(g, gd, e, keen, small); continue; }   // Sam's low whistle (whistle.ts): its own short horizon, the same propagation inside it, and only the nearest calm man who hears it goes to look
    const gunfire = (e.kind === 'shot' || e.kind === 'guardShot') && (e.level ?? 0) >= 1;
    const kick = e.kind === 'kick';                                         // a door kicked in: one crack as loud as anything short of a shot — the floor, not the car park
    if (dStraight > (e.kind === 'bang' || gunfire ? 80 : kick ? 40 : e.kind === 'glass' ? GLASS.hearM : 22)) continue;   // gunfire and stun charges: the whole floor (and the lot); everything else has a horizon (a pane going: GLASS.hearM)
    // sound reaches the guard the way it reaches the player's ears: straight through air, or around corners along the
    // walkable space (longer, a bit muffled — a lot if a closed door is across the doorway), or barely through the mass
    const prop = e.kind === 'glass' ? glassHeard(g, e, v3.add(gd.char.pos, [0, 1.5, 0])) : hearPath(g, v3.add(e.pos, [0, 1, 0]), v3.add(gd.char.pos, [0, 1.5, 0]));   // (a pane's crash: from whichever face of it reaches him best — glass.ts glassHeard, hearPath itself for an event without the faces) (weather.ts: propagate(), the path stretched by a picked weather's noise at his ears — rain, a thunderclap; no kind picked = propagate() itself)
    const d = prop.pathLen, carry = prop.carry;                                  // routed & open ≈ 0.72, through a closed door ≈ 0.32, sealed 0.25
    doorForceHear(g, gd, e, prop);   // (doorforce.ts — a return on its first line with its switch off: an alerted man keeps what he hears of an enemy at the far face of a shut door)
    const heardAt: Vec3 = [prop.via[0], 0, prop.via[2]];                       // where to go and look: the source if heard directly, else the doorway / corner it came through
    // a report below the gunshot line (level < 1: the suppressed pistol — playtest 08-09 — or a canister's pop / skitter): an odd noise worth a look, heard
    // out to ~7 m of open air per unit level along the same propagation (through a shut door far less), suspicion toward it, no radio, no 'shots fired'
    const odd = e.kind === 'shot' || (e.kind === 'guardShot' && quietHeard() && dStraight >= 0.1 && shotRelation(g, gd, e) === 'threat');   // (gunslots.ts: a quiet round from the other side's gun is the odd noise Sam's is — it used to reach nobody)
    if (odd && !gunfire && d < 7 * carry * Math.max(0.3, (e.level ?? 0.6) / 0.6) * ear + 0.5) {
      gd.awareness = Math.max(gd.awareness, 0.5);
      const at = prop.direct ? v3.copy(e.pos) : heardAt;   // where he places it: the source through open air, the doorway / corner it came round otherwise — as every other noise below is placed (review A6.7: the routed pop used to hand him the shooter's exact feet through the wall)
      if (gd.state !== 'alert' || !gd.lastKnown || g.time - gd.lastSeenT > 1.0) gd.lastKnown = at;   // (a man fighting trusts his own eyes over an echo, as the gunfire branch below)
      if (gd.state === 'patrol') gd.reactT = Math.max(gd.reactT, 0.6);   // startled ONCE, like a door / prop noise: a man already looking into it, searching or fighting is not re-rooted by every
      small(at); chronHeard(g, gd, e);                                  // click (review 08-10 #1: the pistol's 0.22 s cadence held an alert man within 7 m at reactT > 0 forever — no round back)
    }
    if (gunfire || e.kind === 'bang' || kick) {
      // a gunshot — the suppressor buys ambiguity about WHERE, not WHETHER — or a stun charge going off, or a door being kicked in, puts every guard on the floor
      // on high alert: weapons out, converging on where it came from (the source if the path is open, else the doorway / corner it spilled through), the
      // furthest ones a beat later. A guard's own shots tell the others where the intruder IS.
      if (e.kind === 'guardShot' && dStraight < 0.1) continue;                 // his own shot
      // SIDES (teams.ts): whose report was it — a man of his own side (a colleague fired: it says where the man he is firing at IS), an enemy's (a threat, placed by
      // ear as ever), or a side his has nothing to do with (a neutral's fight is not his: the staff do not answer the showcase's gunfire, three walls off or not).
      // For the staff every 'guardShot' is a colleague's and every 'shot' is Sam's — the game as it was; the stun charge and the door are anybody's.
      const rel = gunfire ? shotRelation(g, gd, e) : 'threat';
      if (rel === 'none' || ownBang(g, gd, e) || doorForceOwnBoot(g, gd, e)) continue;   // (… and a grenade his own side threw was called as it left the hand: frag.ts; a door his own side booted in is not an intruder's — doorforce.ts, false with its switch off)
      const dLoud = loudLen(g, d, v3.add(gd.char.pos, [0, 1.5, 0]));   // (weather.ts: rain drowns small sounds — a shot is placed off the path as it is in the air; = d with no weather picked)
      if (gunfire) { H.shots++; H.lastShotT = g.time; } else if (kick) H.kick++; else H.bang++;   // (a colleague's rounds are gunfire heard too: 'shots' is what reached his ears, whoever fired)
      H.lastT = g.time;
      const wasCalm = gd.state === 'patrol' || gd.state === 'suspicious';
      gd.awareness = Math.max(gd.awareness, 0.92); chronHeard(g, gd, e);   // (the debrief's row for it, if it was Sam's noise: one per noise, everybody's name on it)
      // where to converge: a colleague's shots always say where the intruder IS (even to men already moving on an older fix); your shot: exact if
      // the path was open, otherwise the right area — placed more loosely the further and more walled-off it was — and an alert guard only
      // re-targets on it if he has not had eyes on you for a second (he trusts his own sighting over an echo)
      if (rel === 'own') { const at = colleagueFirePos(g, gd, e); if (at) gd.lastKnown = v3.copy(at); }   // (null: PICTURE.shot, and his own word on the man is the newer)
      else if (gd.state !== 'alert' || !gd.lastKnown || prop.direct || g.time - gd.lastSeenT > 1.0) {
        const err = prop.direct ? 0 : Math.min(4, 0.6 + dLoud * 0.08) * (1.3 - 0.3 * carry); const a = simRandom() * Math.PI * 2; const cand: Vec3 = [e.pos[0] + Math.cos(a) * err, 0, e.pos[2] + Math.sin(a) * err];
        const reachable = !g.col.nav.isBlocked(cand[0], cand[2]) && !!g.col.nav.findPath(gd.char.pos, cand);   // a free-but-unreachable pocket would have him grind a wall forever
        gd.lastKnown = reachable ? cand : v3.copy(e.pos);
      }
      if (wasCalm) gd.reactT = Math.max(gd.reactT, 0.25 + Math.min(1.2, dLoud / 25) + simRandom() * 0.4);   // the far end of the floor takes a moment to place it (once: a colleague's continuing fire must not keep re-rooting men already on the move)
      if (wasCalm && !e.announced && !(WORDS.on && kick && ownNoise(g, gd, e.who))) { e.announced = true; g.say(gd, e.kind === 'bang' ? (e.frag ? 'grenade! that was a grenade!' : WORDS.on && e.charge ? (defenderWords(gd) ? 'that was a charge — they\'re breaching!' : 'that was a charge!') : WORDS.on && (gd.hold || gd.pinned) ? 'flashbang!' : 'flashbang! go, go!') : kick ? 'that was a door going in — someone\'s inside!' : rel === 'own' ? 'shots fired! on me!' : defenderWords(gd) ? 'that was a shot — find them!' : 'that was a shot — find him!', e.kind !== 'bang'); }   // (words.ts: a man posted on a mark goes nowhere; a defender is after a team; a door or wall CHARGE is no flashbang — GameEvent.charge; and a door his OWN side's blast or boot took — doorblast.ts files the frame letting go as a 'kick' under the thrower's id — is nobody 'inside': no line)
    }
    if ((e.kind === 'door' || e.kind === 'prop') && d < 12 && e.who !== gd.char.id) {
      // doors / furniture: a creak, latch or scraping chair nearby that no guard caused is worth a look; a slam, kicked door or a chair sent flying alerts the floor
      const byGuard = (e.who ?? -1) >= 10 && !(fightLive(g) && stepIsThreat(g, gd, e));   // (the room fight: an ENEMY unit at a door is a noise like Sam at it — a man holding a room hears his door tried)
      const a = (e.level ?? 0.2) * clamp(1 - d / 12, 0, 1) * (byGuard ? 0.0 : 1.0) * carry * dull * attentionNoiseK(g, gd);   // (attention.ts: 1 — but for a man whose attention another file holds with his ears covered)
      if (a > 0.08) { gd.awareness = Math.min(1, Math.max(gd.awareness, Math.min(e.loud ? 0.75 : 0.45, gd.awareness + a))); if (!gd.lastKnown || gd.state !== 'alert') gd.lastKnown = heardAt; if (gd.state === 'patrol') gd.reactT = 0.6; small(heardAt); chronHeard(g, gd, e); }
    }
    if (e.kind === 'glass' && d < GLASS.hearM) {
      // a pane of glass going (glass.ts): a crash nobody takes for the building settling — whoever it reaches (the usual propagation: round through the door if the
      // pane was the wall between, far less through a shut leaf) goes well into suspicion toward where it came from and turns to look; calm men say so, once.
      // Whoever broke it: a colleague's round through a window is still a window gone.
      const a = (e.level ?? GLASS.hearLevel) * clamp(1 - d / GLASS.hearM, 0.15, 1) * carry * dull;
      if (a > 0.06) {
        const wasCalm = gd.state === 'patrol' || gd.state === 'suspicious';
        gd.awareness = Math.min(1, Math.max(gd.awareness, Math.min(0.85, 0.4 + a)));
        if (!gd.lastKnown || gd.state !== 'alert') gd.lastKnown = heardAt;
        if (wasCalm) gd.reactT = Math.max(gd.reactT, 0.5);
        small(heardAt); chronHeard(g, gd, e);
        if (wasCalm && !e.announced) { e.announced = true; g.say(gd, d < 10 ? 'glass! — that was right here' : w('that was glass going — somebody\'s out there', 'that was a window going — someone\'s breaking in'), false); }
      }
    }
    if (e.kind === 'step' && d < 9 && !(g.playerInvisible && (e.who ?? PLAYER_ID) === PLAYER_ID) && stepIsThreat(g, gd, e)) {   // (teams: an ENEMY's footfall — Sam's to the staff, as ever; a hostile unit's to an operative; his own side's and a neutral's are nothing)
      const a = (e.level ?? 0.3) * clamp(1 - d / 9, 0, 1) * carry * keen * foot * attentionEarK(g, gd);   // (attention.ts: 1 — a man whose attention is on a thing has half an ear for a footfall)
      if (a > 0.12) { gd.awareness = Math.min(1, Math.max(gd.awareness, Math.min(0.6, gd.awareness + a * 0.5))); if (!gd.lastKnown || gd.state === 'patrol') gd.lastKnown = heardAt; small(heardAt); chronHeard(g, gd, e); attentionStep(g, gd, heardAt); }   // (… and one that does reach him is a man, not a thing: the hold breaks and he turns to it)
    }
  }
}
// ------------------------------------------------------------ sides (teams.ts) in the hearing model
/** gunfire filed and not through this man's ears yet that hearingCheck will count as heard (Witness.heard.lastShotT) when it next runs for him — its gates,
 *  nothing more. enemysquads.ts asks on the frame a man drops: the player's round is filed before the squads' tick in a frame, the men's hearing runs after it.
 *  `bangs`: a stun charge or a door blown counts as well (hearingCheck's own gate for one: the floor, 80 m) */
export function gunfireDue(g: Game, gd: Guard, bangs = false): boolean {
  for (const e of g.events) {
    if (e.id !== undefined && e.id <= gd.heardUpTo) continue;
    if (bangs && e.kind === 'bang') { if (v3.dist(e.pos, gd.char.pos) <= 80) return true; continue; }
    if (!((e.kind === 'shot' || e.kind === 'guardShot') && (e.level ?? 0) >= 1)) continue;
    const d = v3.dist(e.pos, gd.char.pos); if (d > 80 || (e.kind === 'guardShot' && d < 0.1)) continue;
    if (shotRelation(g, gd, e) !== 'none') return true;
  }
  return false;
}
/** Whose gunfire this is to `gd`: 'own' = a man of his side fired it (kind 'guardShot' whose `who` is on his side — every staff man's, to the staff, which is all
 *  the game ever had; a legacy event without `who` counts as staff), 'threat' = an enemy's (Sam's 'shot' to anybody hostile to Sam; a hostile unit's report to
 *  an operative and the other way about), 'none' = a side his neither fights nor serves with (neutral), or a friend who is not AI-led firing at he knows not
 *  what (Sam's rounds, to an operative: he neither hunts Sam for them nor knows Sam's mark). */
function shotRelation(g: Game, gd: Guard, e: { kind: string; who?: number }): 'own' | 'threat' | 'none' {
  const shooter: Team = e.kind === 'shot' ? 'player' : teamOfId(g, e.who ?? -1);
  if (shooter === gd.team) return 'own';
  return isHostile(gd.team, shooter) ? 'threat' : 'none';
}
/** Where a colleague's shots say the enemy IS: the position of the man that colleague is firing at — Sam's, for the staff (the expression it always was); the
 *  shooter's foe's for a unit; failing that (a report without a shooter the game knows) where the round stopped, else where it was fired from. */
function colleagueFirePos(g: Game, gd: Guard, e: { who?: number; pos: Vec3; to?: Vec3; blind?: boolean }): Vec3 | null {
  if (e.blind) { const p = e.to ?? e.pos; return [p[0], 0, p[2]]; }   // a round fired blind (FireOpts.blind) tells nobody where anybody is: the place to look is where it went (on the floor, as every fix is)
  const sh = e.who === undefined ? null : g.guards.find(x => x.char.id === e.who) ?? null;
  // (picture.ts PICTURE.shot: what a colleague's fire tells is where HE believes his man to be and how old that word is — his own idea of him, a fifth of a
  //  second old while he has eyes on him, older when he is firing at where the man was — never the man's true place through a wall. The hearer takes it as a
  //  call (the idea at its own age, the fix stamped with it: no stale word comes out fresh), and keeps what he has when his own word is the newer or the
  //  shooter has seen the place empty. No picture kept (a show), or a shooter with no idea of his man: as it was.)
  if (sh && PICTURE.on && PICTURE.shot && !g.touring) {
    const who = sh.foe ?? (sh.team === 'guard' ? 'player' : null), I = who ? ideaOf(g, sh, who) : null;
    if (who && I) { const tr = who === 'player' ? g.player.char.pos : who.char.pos, mine = ideaOf(g, gd, who);
      PICTURE_STATS.shotPlaced++; if (Math.hypot(I.at[0] - tr[0], I.at[2] - tr[2]) >= 1) PICTURE_STATS.shotOff++;
      const own = !!mine && mine.t >= I.t;
      if (gd.lastKnown && (I.lost || own || gd.fixT >= I.t)) { PICTURE_STATS.shotKept++; return null; }
      // (no fix to work from: his own newer word of the man is the place — it is not written over by an older one; a word the shooter has since seen
      //  empty is a place to go and nothing for his picture)
      const W = own ? mine! : I; if (own) PICTURE_STATS.shotKept++; else if (!I.lost) pictureTell(g, gd, who, I.at, g.time - I.t);
      gd.fixRef = [W.at[0], 0, W.at[2]]; gd.fixT = W.t;
      return [W.at[0], 0, W.at[2]]; }
  }
  if (!sh || sh.team === 'guard') return g.player.char.pos;
  return foeChar(g, sh)?.pos ?? e.to ?? e.pos;
}
/** Is this footfall an enemy's: Sam's steps carry no `who` (PLAYER_ID); a unit's carry his id (updateGuard's tread pushes them for the sides somebody can be hostile to). */
function stepIsThreat(g: Game, gd: Guard, e: { who?: number }): boolean {
  const who = e.who ?? PLAYER_ID;
  return who === PLAYER_ID ? isHostile(gd.team, 'player') : isHostile(gd.team, teamOfId(g, who));
}

// ------------------------------------------------------------ motion acuity: the eye catches movement long before it resolves a still shape in the dark
/** what a dead-still man is worth against one walking across the view (× the sight gain) IN THE DARK, and the apparent speed (m/s) by which the full rate is
 *  reached; the still-man discount fades as the light on him comes up (by MOTION_LIT_HI he is as plain standing as moving: a lit shape needs no movement to be
 *  read — it is the half-seen one in the shadows that the eye only catches when it moves) */
const MOTION_STILL = 0.35, MOTION_LO = 0.05, MOTION_HI = 1.2, MOTION_LIT_LO = 0.3, MOTION_LIT_HI = 0.75;
/** how much of the motion straight toward / away from the eye counts beside the motion across it (looming reads far weaker than something crossing) */
const MOTION_RADIAL = 0.4;
/** a sprinting man (over SPRINT_MS by the ground he covers) is that much more again; the floors: at arm's length a still man is still plain, and a man already
 *  hunting is LOOKING for a shape, not waiting for it to move */
const MOTION_SPRINT = 1.6, MOTION_SPRINT_MS = 3.5, MOTION_NEAR_M = 2.5, MOTION_NEAR_FLOOR = 0.8, MOTION_HUNT_FLOOR = 0.7;

/** Sam's velocity over the ground this frame, as anybody watching sees it: the displacement of his root since the frame before (not the pace he is asking of his
 *  legs — held against a desk or a leaf he 'sprints' on the spot; a teleport reads as one capped spike). Worked out once a frame, whoever asks first. */
const groundTrack = new SideMap<Game, { pos: Vec3; t: number; vel: Vec3 }>('guards.groundTrack');
/** a restart (cleanrestart.ts): the fresh man has not moved yet — his start is not a step from where the last one fell */
export function groundFresh(g: Game): void { groundTrack.delete(g); }
export function playerGroundVel(g: Game): Vec3 {
  const p = g.player.char.pos; let P = groundTrack.get(g);
  if (!P) { P = { pos: v3.copy(p), t: g.time, vel: [0, 0, 0] }; groundTrack.set(g, P); return P.vel; }
  if (g.time !== P.t) {
    const since = g.time - P.t;
    if (since > 1e-4 && since < 0.25) { const vx = (p[0] - P.pos[0]) / since, vz = (p[2] - P.pos[2]) / since; const sp = Math.hypot(vx, vz); const k = sp > 6 ? 6 / sp : 1; P.vel = [vx * k, 0, vz * k]; } else P.vel = [0, 0, 0];
    P.pos = v3.copy(p); P.t = g.time;
  }
  return P.vel;
}
/** × the sight gain for how Sam is moving as THIS man sees it: the ground he covers split into the part across the man's line of sight (what the eye jumps to) and
 *  the part along it (counted at MOTION_RADIAL), eased from the still-man's worth (MOTION_STILL in the dark, rising to 1 as the light on him does) up to 1 at a
 *  walk across the view, × MOTION_SPRINT at a sprint; floored near to and for a man already hunting. */
export function motionFactor(g: Game, gd: Guard, dist: number): number {
  return motionCore(gd, g.player.char.pos, playerGroundVel(g), g.player.visibility, dist);
}
/** motionFactor's arithmetic for any watched man at `pp` moving at `v` over the ground, lit `lit` (0‥1), `dist` off: Sam's numbers come from playerGroundVel and
 *  his meter (above, unchanged to the last bit); an AI target's from his own velocity — a walking AI man's vel IS his ground velocity — and his meter (teams). */
function motionCore(gd: Guard, pp: Vec3, v: Vec3, lit: number, dist: number): number {
  const gp = gd.char.pos;
  let rx = gp[0] - pp[0], rz = gp[2] - pp[2]; const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;   // unit, Sam → the eye (flat)
  const vr = Math.abs(v[0] * rx + v[2] * rz), vt = Math.abs(v[0] * rz - v[2] * rx); const sp = Math.hypot(v[0], v[2]);
  const still = lerp(MOTION_STILL, 1, smoothstep(MOTION_LIT_LO, MOTION_LIT_HI, lit));
  let m = lerp(still, 1, smoothstep(MOTION_LO, MOTION_HI, vt + MOTION_RADIAL * vr)); if (sp > MOTION_SPRINT_MS) m *= MOTION_SPRINT;
  if (dist < MOTION_NEAR_M) m = Math.max(m, MOTION_NEAR_FLOOR);
  if (gd.state === 'alert' || gd.state === 'search') m = Math.max(m, MOTION_HUNT_FLOOR);
  return m;
}

/** Awareness per second a VISIBLE player builds in this man at `dist` (canSee said yes): the light on the player, distance, crouch, how he is MOVING across this
 *  man's view (motionFactor: a still shape in the half-dark fills the meter at a third of the rate of one walking across it, a sprint faster again), the smoke
 *  between them, the alarmed floor's keenness — point-blank is certain — and a man already hunting is twice as quick on the uptake. One formula for updateGuard
 *  and for the scripted men's senses (squad.ts perceive). Above 0.05 it moves his fix; above 0.25 it is a real sighting (the licence to shoot). */
export function sightGain(g: Game, gd: Guard, dist: number): number {
  const T = g.tune; const light = g.player.visibility; const distF = distTerm(dist);
  const moving = AI_TUNE.motionAcuity ? motionFactor(g, gd, dist) : (Math.hypot(g.player.char.vel[0], g.player.char.vel[2]) > 2 ? 1.5 : 1);   // (the switch is the QA table's before / after; play runs the acuity)
  let rate = T.detectRate * Math.pow(light, 1.5) * distF * (g.player.crouch ? 0.75 : 1) * moving * clamp((gd.smokeTrans - 0.3) / 0.5, 0, 1) * (escalationOf(g) >= 1 ? KEEN : 1);   // (an alarmed floor is actually looking: a quarter quicker on the uptake)
  rate *= attentionSideK(g, gd, g.player.char.pos) * loadSeen(g, 'player');   // (attention.ts: 1 — but for a man whose attention is on a thing, of somebody outside what he is looking at; kitload.ts: what his card makes of his shape — 1 with its switch off or no card on him; the point-blank floor below stands whole)
  if (dist < 1.8) rate = Math.max(rate, 3.5 * closeNearK(g, gd, dist));   // (close.ts: 1 unless its switch is on — then a shape at his elbow in the DARK is not seen for being near)
  if (gd.state === 'alert' || gd.state === 'search') rate *= 2.2;
  return rate;
}
/** sightGain for an AI target `o` (teams: an operative's eye on a hostile, a hostile's on an operative — canSeeChar said yes): the SAME formula off HIS light meter
 *  (Guard.visibility: the renderer's irradiance at him when it answers, the CPU estimate of the same direct light otherwise — unitLightMeter), his crouch, his
 *  motion across this man's view, the alarmed floor's keenness and the hunting man's ×2.2. Two things it cannot have: the smoke between two AI men is not marched
 *  (the probe's per-guard segment runs to Sam's chest only — the daytime showcase has no smoke; a v1 limit, named), and Sam's sandbox invisibility is his alone. */
export function sightGainOn(g: Game, gd: Guard, o: Guard, dist: number): number {
  const T = g.tune; const light = Math.max(o.visibility, lampGlare(g, gd.char, o), nvgSight(g, gd, o)); const distF = distTerm(dist);   // (the light ON him — or, in a room fight, his own lit weapon light pointed at this eye: roomfight.ts lampGlare, 0 elsewhere — or what this eye's goggles make of it: nvg.ts, 0 with none down)
  const v = o.char.vel;
  const moving = AI_TUNE.motionAcuity ? motionCore(gd, o.char.pos, v, light, dist) : (Math.hypot(v[0], v[2]) > 2 ? 1.5 : 1);
  const smoke = pairSmoke(g, gd.char, o.char);   // the smoke between them thins the sight of him as it does of Sam, in the same place in the formula (roomfight.ts marches the pair; 1 = clear / not marched)
  let rate = T.detectRate * Math.pow(light, 1.5) * distF * (o.char.anim.crouch > 0.5 ? 0.75 : 1) * moving * (smoke < 1 ? clamp((smoke - 0.3) / 0.5, 0, 1) : 1) * (escalationOf(g) >= 1 ? KEEN : 1);
  rate *= attentionSideK(g, gd, o.char.pos) * loadSeen(g, o);   // (attention.ts, as for Sam: the partner beside him in a quiet two is seen by the same held eye; kitload.ts, as for Sam: a teammate's card — 1 for a man no staging put a card on)
  if (dist < 1.8) rate = Math.max(rate, 3.5);
  if (gd.state === 'alert' || gd.state === 'search') rate *= 2.2;
  return rate;
}

/** A dead colleague lying in this man's view: within 12 m, inside 60° of where his chest points, nothing solid between his eyes and the body — and (tune.bodyLight,
 *  the default) light enough on the body to make it out, no plume between thick enough to hide it (bodyLit below). (updateGuard raises the alarm on it; the
 *  scripted men's senses in squad.ts / qrf.ts only need to know to break off toward it — updateGuard does the rest the frame after.) */
export function bodyInView(g: Game, gd: Guard): Guard | null {
  for (const o of g.guards) {
    if (o === gd || o.state !== 'dead' || o.found || o.team !== gd.team) continue;   // (a body somebody has already called in is known: it startles nobody a second time; a body of another SIDE startles nobody on this one — teams: the operative shot him)
    if (bodySeen(g, gd, o)) return o;
  }
  return null;
}
/** bodyInView's test of ONE body, whoever asks (enemysquads.ts asks it of a squad's men for a man of theirs who went quiet): within 12 m of his eyes, inside
 *  60° of where his chest points, nothing solid between, and light enough on it to make out. `around`: a man who has walked to the spot to look
 *  and looks about him — no cone; a number = also how far round his FEET (m, flat) a body is at his feet in any light, as the
 *  2 m rule below has it for a man who walks onto one (enemysquads.ts's lookers stop short of the post, and a body thrown by a round lies a metre off it) */
export function bodySeen(g: Game, gd: Guard, o: Guard, around: boolean | number = false): boolean {
  if (pairGripBody(g, gd) || dozeAsleep(gd)) return false;   // (pairorders.ts PAIR.gripBody: a man with a teammate's hands on him finds no body — here, so every finder's road takes it; doze.ts: nor does a man asleep)
  const eye = gd.char.bones.head ?? v3.add(gd.char.pos, [0, 1.65, 0]); const look = gd.char.chestDir;
  const body = o.char.bones.hips ?? o.char.pos;
  const to = v3.sub(body, eye); const dist = v3.len(to); if (dist > 12) return false;
  if (!around && v3.dot([look[0], 0, look[2]], v3.normalize([to[0], 0, to[2]])) < Math.cos(60 * DEG)) return false;
  if (g.col.segmentBlocked(eye, v3.add(body, [0, 0.3, 0]))) return false;
  const atFeet = typeof around === 'number' && Math.hypot(body[0] - gd.char.pos[0], body[2] - gd.char.pos[2]) <= around;
  if (g.tune.bodyLight && !bodyLit(g, gd, o, eye, atFeet ? Math.min(dist, BODY_LIGHT.nearM) : dist)) return false;   // in his open view but not yet SEEN: a shape on the floor of a dark room six metres off is nothing until a light finds it (review A6.2)
  return true;
}

// ------------------------------------------------------------ bodies are found by the light on them (tune.bodyLight — review A6.2, Chaos Theory's rule)
// A body in the dark is HIDDEN; one under a lamp, in a lit doorway or in the pool of a torch — the finder's own included — is found. What bodyInView asks on top of
// its range / cone / line: the light where the body lies, read the way every eye in the game reads a man — the renderer's irradiance at the body's trunk (a probe
// query keyed by the body, answered a frame or two later) and until it answers (the browser's first frames; headless, always) the CPU estimate of the same direct
// light (lightEstimateAt: fixtures, lamps, the torches and weapon lights in the set — his own beam on it is simply one of those lights) — through the meter's own
// curve (Game.visibilityOf), eased like everybody's meter; and the smoke between his eye and it (the probe's segment transmittance, as canSee marches it to Sam).
// Off (Tab ▸ Sandbox) = range, cone and line alone: found in the pitch dark at twelve metres, as before.
/** the meter reading (0‥1) at the body at or above which it is plain from FAR_M and beyond (0.22 ≈ the fringe of a corridor panel's pool as the meter reads it; a
 *  torch beam squarely on it reads 0.7+, open floor between two panels at night ~0.35, a dark office 0); inside NEAR_M he all but trips on it — found in any light
 *  — and from NEAR to FAR the bar eases up from LIT_NEAR to LIT; SMOKE: eye → body transmittance under which the plume hides it (canSee's own line for a standing man) */
export const BODY_LIGHT = { lit: 0.22, litNear: 0.04, nearM: 2.0, farM: 5.0, smoke: 0.3 };
export const BODY_LIGHT_DEFAULTS = { ...BODY_LIGHT };
/** the body's light meter, per body (the light ON it is whoever's-looking-independent): eased reading + when; and the last irradiance behind it for the panel */
const bodyMeters = new SideMap<Guard, { vis: number; E: number; t: number }>('guards.bodyMeters');
/** probe queries these tests may spend a frame between them (light points + smoke segments): they run inside the guards' update, AHEAD of Sam's own two meter
 *  queries in the probe's 32-slot frame, and a floor of bodies under three pairs of eyes must never crowd those out — past it a body keeps its eased reading /
 *  the CPU estimate and a pair its last transmittance for the frame */
const BODY_PROBE_BUDGET = 6;
const bodyProbeN = new SideMap<Game, { t: number; n: number }>('guards.bodyProbeN');
function bodyProbeSlot(g: Game): boolean { let b = bodyProbeN.get(g); if (!b || b.t !== g.time) { b = { t: g.time, n: 0 }; bodyProbeN.set(g, b); } return b.n++ < BODY_PROBE_BUDGET; }
/** What the meter reads at this body now (0‥1): probe query `bodyL<id>` at its trunk (its own capsules skipped), the CPU estimate until answered, eased at the meter's rate. */
export function bodyVisibility(g: Game, o: Guard): number {
  let m = bodyMeters.get(o); const now = g.time;
  if (m && m.t === now) return m.vis;
  const c = o.char, id = c.id; const hp = c.bones.hips ?? c.pos;
  const at: Vec3 = [hp[0], Math.max(hp[1], 0.12) + 0.22, hp[2]];   // the trunk of a man lying down: a hand's height over the pelvis (a query flush with the floor reads the floor's own shadow terminator)
  const key = `bodyL${id}`; if (bodyProbeSlot(g)) g.lightQuery(key, at, id);
  const r = g.lightAt(key);
  const E = r !== undefined && Number.isFinite(r) ? r : lightEstimateAt(g, at);
  const dt = m ? Math.min(0.1, Math.max(0, now - m.t)) : 0;
  const target = g.visibilityOf(E); const vis = m && dt > 0 ? damp(m.vis, target, 6, dt) : target;   // (first look: the reading as it stands — a torch swung onto it a frame ago has already lit it)
  m = { vis, E, t: now }; bodyMeters.set(o, m); return vis;
}
/** Is body `o`, `dist` off `gd`'s eye at `eye`, lit enough for him to make out — and not behind smoke? (bodyInView's last test; see the block comment) */
function bodyLit(g: Game, gd: Guard, o: Guard, eye: Vec3, dist: number): boolean {
  const B = BODY_LIGHT;
  // the plume between them: one probe segment per finder ↔ body pair while it is a candidate (rare — it has passed range, cone and line), read as clear until answered
  const sk = `bodyS${gd.char.id}_${o.char.id}`; const hp = o.char.bones.hips ?? o.char.pos;
  const at: Vec3 = [hp[0], hp[1] + 0.25, hp[2]];
  const trans = (g.sensors.segment(sk, eye, at, bodyProbeSlot(g)) ?? 1) * airTrans(g, eye, at);   // (sensors.ts: asked only inside the frame's body budget, read either way; × the weather's fog along the same line — weather.ts, exactly 1 with no kind picked)
  if (trans < B.smoke) return false;
  const vis = bodyVisibility(g, o) * clamp((trans - B.smoke) / 0.5 + 0.4, 0.4, 1);   // (a thinner veil dims what he makes of it, as it dims Sam to him — never below the near rule's reach)
  const bar = dist <= B.nearM ? -1 : lerp(B.litNear, B.lit, clamp((dist - B.nearM) / Math.max(0.1, B.farM - B.nearM), 0, 1));   // (−1: at his feet it is found in no light at all)
  return vis >= bar;
}
/** the switch + its numbers kept per machine (Tab ▸ Sandbox ▸ 'bodies found by light'), like the tactics' clocks */
const BODY_LIGHT_LS = 'twopointsix.bodyLight';
export function loadBodyLight(tune: { bodyLight: boolean }) {
  try {
    const j = JSON.parse(localStorage.getItem(BODY_LIGHT_LS) ?? 'null'); if (!j || typeof j !== 'object') return;
    if (typeof j.on === 'boolean') tune.bodyLight = j.on;
    for (const k of ['lit', 'litNear', 'nearM', 'farM'] as const) { const v = j[k]; if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 20) BODY_LIGHT[k] = v; }
  } catch { /* no storage (the harness, a locked-down page): the shipped values stand */ }
}
export function saveBodyLight(tune: { bodyLight: boolean }) { try { localStorage.setItem(BODY_LIGHT_LS, JSON.stringify({ on: tune.bodyLight, lit: BODY_LIGHT.lit, litNear: BODY_LIGHT.litNear, nearM: BODY_LIGHT.nearM, farM: BODY_LIGHT.farM })); } catch { /* nothing to keep it in */ } }
export function resetBodyLight(tune: { bodyLight: boolean }) { tune.bodyLight = true; Object.assign(BODY_LIGHT, BODY_LIGHT_DEFAULTS); try { localStorage.removeItem(BODY_LIGHT_LS); } catch { /* none */ } }
/** Panel / QA: what each unfound body on the floor reads right now — 'bodies ▸ Reyes 0.61 (E 0.412) · Novak 0.02 (E 0.001)' */
export function bodyLightSummary(g: Game): string {
  const parts: string[] = [];
  for (const o of g.guards) { if (o.state !== 'dead' || o.found) continue; const v = bodyVisibility(g, o); const m = bodyMeters.get(o); parts.push(`${o.callsign} ${v.toFixed(2)} (E ${m ? m.E.toFixed(3) : '?'})`); }
  return `bodies by light ▸ ${g.tune.bodyLight ? 'on' : 'OFF'} · bar ${BODY_LIGHT.lit} from ${BODY_LIGHT.farM} m (any light inside ${BODY_LIGHT.nearM} m) · ${parts.join(' · ') || 'nobody down unfound'}`;
}

/** A world point in this man's open view: within `range` of his eyes, inside `halfDeg` of where his chest points (flat), nothing solid between — bodyInView's test
 *  against any point. Lighting is deliberately not asked (the things it is used for carry their own light: a colleague with a torch going down). */
export function pointInView(g: Game, gd: Guard, p: Vec3, range = 12, halfDeg = 60): boolean {
  if (dozeAsleep(gd)) return false;   // (doze.ts: eyes shut — every reader of a man's view takes it here)
  const eye = gd.char.bones.head ?? v3.add(gd.char.pos, [0, 1.65, 0]); const look = gd.char.chestDir;
  const to = v3.sub(p, eye); const L = v3.len(to); if (L > range) return false; if (Math.hypot(to[0], to[2]) < 0.3) return true;   // (on top of it: his)
  if (v3.dot([look[0], 0, look[2]], v3.normalize([to[0], 0, to[2]])) < Math.cos(halfDeg * DEG)) return false;
  return !g.col.segmentBlocked(eye, p);
}

/** A light going out (a 'lightOut' event: lighting.ts lightEvent — a fixture OCP'd or shot dark) that this man's eye has a line to: nothing solid between his head
 *  and either the fixture itself (the segment stopped a hand short of it, so its own housing does not hide it) or the floor straight under it (the pool that just
 *  vanished). No cone: a room going dark about him is noticed with his back to the lamp; one going dark beyond the wall is not (review A6.3 — it used to be
 *  distance alone). `e.from` carries the fixture's true position; an event without it (older callers) is read at ceiling height over its floor point. */
function lightOutSeen(g: Game, gd: Guard, e: { pos: Vec3; from?: Vec3 }): boolean {
  const eye = gd.char.bones.head ?? v3.add(gd.char.pos, [0, 1.65, 0]);
  const src: Vec3 = e.from ?? [e.pos[0], 2.4, e.pos[2]];
  const to = v3.sub(src, eye); const L = v3.len(to);
  if (L < 0.6 || !g.col.segmentBlocked(eye, v3.mad(eye, to, (L - 0.4) / L))) return true;
  return !g.col.segmentBlocked(eye, [e.pos[0], 0.15, e.pos[2]]);
}

// ------------------------------------------------------------ witness: what each man has personally perceived (game.ts Witness) — written here, read by the dialogue to come
/** A man is going down at Sam's hand (combat.ts killGuard, before the victim's state flips): every OTHER living, undazzled man who has the victim in his open view
 *  as he drops — or his eyes on Sam himself this instant (the light-gated sighting the AI already made) — remembers seeing it done, and to whom. A colleague's
 *  round or the world dropping a man is nobody's 'I saw you do it'; a Sam the sandbox has made invisible did nothing anyone can name; with the AI off nobody is home. */
export function witnessKill(g: Game, victim: Guard, how: DownKind, by: DownBy) {
  if (!g.aiEnabled || by !== 'player') return;
  const at = victim.char.bones.chest ?? v3.add(victim.char.pos, [0, 1.1, 0]);
  for (const o of g.guards) {
    if (o === victim || o.state === 'dead' || g.time < o.dazzledUntil || dozeAsleep(o)) continue;   // (doze.ts: a man asleep saw nothing)
    if ((!g.playerInvisible && pointInView(g, o, at)) || o.sawPlayerThisFrame) o.witness.sawAct = { kind: how === 'wounded' ? 'shot' : how, victim: victim.callsign, t: g.time };   // (a man shot down WOUNDED was seen shot: the questions asked of the witness are the shooting's)
  }
}
/** What took a man over the alert line just now (updateGuard's transition): eyes on Sam (a real sighting this frame or a beat ago, or glimpses that added up
 *  within the second), a sound that placed him this very frame (only gunfire, a stun charge or a door going in jump that high), a body he is standing over,
 *  else word over the net (a colleague's contact breaking him off a drill, an order). */
function alertCause(g: Game, gd: Guard, seen: boolean): 'sight' | 'sound' | 'radio' | 'body' {
  if (seen || g.time - gd.lastSeenT < 0.5) return 'sight';
  if (gd.witness.heard.lastT >= g.time - 1e-6) return 'sound';
  if (g.time - gd.sightT < 1.0) return 'sight';
  if (gd.bodyDuty || g.time - gd.sawBodyT < 2) return 'body';
  return 'radio';
}
/** One compact line of a man's witness record for the panel / the QA probes ('' = nothing yet): peak awareness, what made him alert, what he heard, what he saw. */
export function witnessSummary(g: Game, gd: Guard): string {
  const W = gd.witness, H = W.heard; const parts: string[] = []; const ago = (t: number) => `${Math.max(0, Math.round(g.time - t))} s ago`;
  if (W.peakAwareness >= 0.05) parts.push(`peak ${W.peakAwareness.toFixed(2)}`);
  if (W.alertedBy) parts.push(`alert by ${W.alertedBy} ${ago(W.alertT)}`);
  const heard = [H.shots ? `${H.shots} shot${H.shots > 1 ? 's' : ''}` : '', H.kick ? `${H.kick} kick${H.kick > 1 ? 's' : ''}` : '', H.bang ? `${H.bang} bang${H.bang > 1 ? 's' : ''}` : '', H.small ? `${H.small} small${H.smallWhere ? ` (last @${H.smallWhere[0].toFixed(0)},${H.smallWhere[2].toFixed(0)})` : ''}` : ''].filter(Boolean);
  if (heard.length) parts.push(`heard ${heard.join(', ')}`);
  if (W.sawAct) parts.push(`SAW the player ${W.sawAct.kind === 'shot' ? 'shoot' : W.sawAct.kind === 'struck' ? 'drop' : W.sawAct.kind === 'choked' ? 'choke out' : 'grab'} ${W.sawAct.victim} ${ago(W.sawAct.t)}`);
  if (W.sawBody) parts.push(`found ${W.sawBody.victim} ${W.sawBody.breathing ? 'out cold' : 'dead'} ${ago(W.sawBody.t)}`);
  if (W.calledToBody) parts.push(`heard ${W.calledToBody.victim} called in ${W.calledToBody.breathing ? 'out cold' : 'dead'}`);
  if (W.sawHeld) parts.push(`saw ${W.sawHeld.who} held`);
  if (W.wasHeld) parts.push(`held ×${W.wasHeld}`);
  if (W.dazzled) parts.push(`dazzled ×${W.dazzled}`);
  return parts.join(' · ');
}

/** floor point under a body: its pelvis once the ragdoll has it (Character.pos rides it anyway), i.e. where the men walk up to and look */
export function bodyPos(o: Guard): Vec3 { const h = o.char.bones.hips ?? o.char.pos; return [h[0], 0, h[2]]; }
/** A found (called-in) body lying within `r` metres of `p`, if any — the men know it is there, so nothing near it is 'nothing'. */
export function nearKnownBody(g: Game, p: Vec3, r = 4): Guard | null {
  for (const o of g.guards) if (o.state === 'dead' && o.found && v3.distXZ(bodyPos(o), p) < r) return o;
  return null;
}
/** What a keyed door gives away about the intruder: its keep kicked out of the jamb ('forced' — plain to anyone passing), or standing unlocked when staff always throw
 *  it ('picked' — or so they read it; found by a hand on the lever). Plain doors say nothing. */
export function doorTamper(d: Door): 'forced' | 'picked' | null { return !d.def.locked ? null : d.lockBroken ? 'forced' : !d.locked ? 'picked' : null; }

// ------------------------------------------------------------ a found body: the floor's short script (finder covers, second man's one line, everyone widens out)
/** seconds the body script may hold a man before he lets it go like any other suspicion (a called man who cannot get there, say) */
const BODY_DUTY_CAP = 45;
/** Where a man stops by a body: `stand` metres short of it on his own side of it (working round toward either flank when that is in a wall or taken by a colleague),
 *  on a free cell he can walk to with the body in plain view from there. Falls back to the reachable cell nearest the body. */
function coverSpot(g: Game, gd: Guard, bp: Vec3, stand: number): Vec3 {
  const nav = g.col.nav, from = gd.char.pos;
  const reach = nav.findPath(from, bp); const foot: Vec3 = reach?.length ? reach[reach.length - 1] : v3.copy(from);   // the free cell nearest him a path actually gets to (the pelvis itself may lie under a desk edge / against a wall)
  const base = Math.atan2(from[0] - bp[0], from[2] - bp[2]);   // bearing from the body back toward him
  for (const da of [0, 0.5, -0.5, 1.0, -1.0, 1.6, -1.6, 2.3, -2.3, Math.PI]) for (const r of [stand, stand + 0.5, Math.max(1.0, stand - 0.4)]) {
    const a = base + da; const p: Vec3 = [bp[0] + Math.sin(a) * r, 0, bp[2] + Math.cos(a) * r];
    if (nav.isBlocked(p[0], p[2]) || !nav.walkable(foot, p) || g.col.segmentBlocked([p[0], 1.0, p[2]], [bp[0], 0.4, bp[2]])) continue;
    let taken = false; for (const o of g.guards) if (o !== gd && o.state !== 'dead' && o.bodyDuty?.spot && v3.distXZ(o.bodyDuty.spot, p) < 0.9) { taken = true; break; }
    if (!taken) return p;
  }
  return v3.copy(foot);
}
/** Where a man widens out to from a body: five to eight metres off along his own arm of a fan dealt round it (the first away goes back out the way he came up, the
 *  next two take the thirds either side, then the gaps), on a free cell he can reach without a detour through half the floor, at least four metres from the body and
 *  not beside a colleague's point. null if the place offers nothing (a cupboard): he lets it go where he stands. */
function fanSpot(g: Game, gd: Guard, B: Guard, bp: Vec3): Vec3 | null {
  const nav = g.col.nav, from = gd.char.pos; const k = B.bodyFan++;
  const base = Math.atan2(from[0] - bp[0], from[2] - bp[2]) + [0, 2.1, -2.1, 1.05, -1.05, Math.PI][k % 6];
  let paths = 0;   // (A* is the dear part: a dozen tries, then he lets it go where he stands)
  for (const da of [0, 0.35, -0.35, 0.7, -0.7, 1.1, -1.1, 1.6, -1.6]) for (const r of [6, 7.5, 5, 4.5]) {
    const a = base + da; const p: Vec3 = [bp[0] + Math.sin(a) * r, 0, bp[2] + Math.cos(a) * r];
    if (nav.isBlocked(p[0], p[2])) continue;
    let taken = false; for (const o of g.guards) if (o !== gd && o.state !== 'dead' && o.bodyDuty?.stage === 'fan' && o.bodyDuty.spot && v3.distXZ(o.bodyDuty.spot, p) < 2.5) { taken = true; break; }
    if (taken) continue;
    if (++paths > 12) return null;
    const path = nav.findPath(from, p); if (!path?.length || v3.distXZ(path[path.length - 1], bp) < 4) continue;
    let L = 0, q: Vec3 = from; for (const w of path) { L += v3.distXZ(q, w); q = w; }
    if (L < 16) return p;   // ('six metres off' by way of two rooms and back is not widening out, it is leaving)
  }
  return null;
}
/** Movement watchdog for a man who is supposed to be walking somewhere: true once he has covered less than half a metre in `secs` seconds (a leaf somebody holds
 *  against him, a colleague planted in his way, a mark he cannot quite reach) — measured on the ground he covers, not on his distance to the goal, so the long way
 *  round a partition is not a stall. Callers drop the leg when it fires and reset it (stallRef = null) whenever the leg changes; a man standing on purpose must not call it. */
export function notGettingAnywhere(gd: Guard, dt: number, secs: number): boolean {
  const p = gd.char.pos;
  if (!gd.stallRef || v3.distXZ(p, gd.stallRef) > 0.5) { gd.stallRef = v3.copy(p); gd.stallT = 0; return false; }
  return (gd.stallT += dt) > secs;
}
/** The alert chase is over without him: down to 'search' from where he stands — awareness under the alert threshold (re-alerting takes a fresh sighting or sound,
 *  or alert ↔ search flapped every reactT), every chase clock zeroed for the next one, and the line if there is one. */
export function dropToSearch(g: Game, gd: Guard, bark: string | null) {
  gd.state = 'search'; gd.searchT = 0; gd.awareness = Math.min(gd.awareness, 0.8); gd.searchPlan = null;
  resetChase(gd); gd.path = []; gd.pathGoal = null;   // (the chase's path is not the search's: he sweeps from where he stands, then deals himself the hiding places round the fix — searchPlanFor)
  if (bark) g.say(gd, bark);
  chronLost(g, gd);   // the debrief's row: he lost you
}
/** Every clock the alert chase keeps, back to a fresh chase: how near he has got to the fix and how long without getting nearer (and which fix that was), how long
 *  without covering ground, how long without eyes on him, how long his line of fire has been blocked, and the side-step's memory of which way went nowhere.
 *  Called entering 'alert', on every fresh sight of Sam, leaving for 'search' — and by the QA probes staging an alert man (tools/qa/probes.ts armAlert). */
export function resetChase(gd: Guard) { gd.alertBest = 1e9; gd.alertStallT = 0; gd.alertRef = null; gd.chaseT = 0; gd.shotBlockedT = 0; gd.lineInT = 0; gd.stallRef = null; gd.stallT = 0; gd.lineSide = 0; gd.lineGain = -1; gd.lineStuckT = 0; gd.lineFail = null; }
/** One frame of a man's part in the found-body script (his state is 'suspicious' throughout; returns his move speed and aim point for updateGuard, or null when the
 *  script no longer applies and ordinary suspicion should take over — an errand, a scripted hold, the cap, or a fresh noise that put his fix somewhere else):
 *  'to'    — a beat to take it in (reactT), then briskly to his own spot short of the body (coverSpot), muzzle coming down onto it once he can see it;
 *            there: the finder covers; the second man to reach it says the one line; later ones just look;
 *  'cover' — planted, muzzle low on the body: the finder until somebody has joined him (or long enough alone), the others for a moment;
 *  'fan'   — off to his search point away from the body (fanSpot), sweeping as he goes, a few seconds' look round there, then he lets it go — and the closing line,
 *            said once for everybody, replaces 'clear here' (updateGuard). The lockdown pair are collected from this stage by their room clear (squad.ts muster). */
function bodyAftermath(g: Game, gd: Guard, dt: number): { move: number; aim: Vec3 | null } | null {
  const D = gd.bodyDuty!, B = D.body, c = gd.char, T = g.tune;
  const errand = !!gd.task && !(D.role === 'finder' && D.stage !== 'fan');   // an errand handed to him since (the breaker) takes him off it — except the finder walking up to / standing over the body: he finishes that first and goes when he would have widened out
  if (gd.hold || errand || !g.aiEnabled || B.state !== 'dead' || !g.guards.includes(B) || g.time - D.t0 > BODY_DUTY_CAP) { gd.bodyDuty = null; return null; }   // (AI off: everybody talks himself calm at once, as ever)
  if (T.tactics && bodyDutyBlocked(g, gd, B)) { gd.bodyDuty = null; return null; }   // he lies in a doorway that is a kill zone for this man's side right now (tactics.ts): nobody walks up to kneel by him in that funnel — the man still comes, and the gate takes him at the jamb
  const bp = bodyPos(B);
  if (!gd.task && gd.lastKnown && v3.distXZ(gd.lastKnown, D.spot ?? bp) > 2.5 && v3.distXZ(gd.lastKnown, bp) > 2.5) { gd.bodyDuty = null; return null; }   // hearingCheck has moved his fix onto a noise somewhere else: that is what he looks into now (an errand's fix on a covering finder is not that: it waits)
  const eye = c.bones.head ?? v3.add(c.pos, [0, 1.65, 0]); const dB = v3.distXZ(c.pos, bp);
  const seeBody = dB < 8 && !g.col.segmentBlocked(eye, [bp[0], 0.4, bp[2]]); const onBody: Vec3 = [bp[0], 0.35, bp[2]];
  gd.awareness = Math.max(gd.awareness, D.stage === 'fan' ? 0.16 : 0.3);   // the script's own clocks end it, not the suspicion decay
  let move = 0, aim: Vec3 | null = null;
  switch (D.stage) {
    case 'to': {
      if (!D.spot) { D.spot = coverSpot(g, gd, bp, D.role === 'finder' ? 1.5 : 2.1); gd.lastKnown = v3.copy(D.spot); gd.path = []; gd.pathGoal = null; gd.stallRef = null; }
      if (gd.reactT > 0) { gd.reactT -= dt; gd.speed = damp(gd.speed, 0, 8, dt); c.vel = [0, 0, 0]; aim = seeBody ? onBody : [bp[0], 1.0, bp[2]]; break; }
      goTo(g, gd, D.spot); const arrived = followPath(g, gd, dt, T.guardInvestigate) || notGettingAnywhere(gd, dt, 3); move = gd.speed;   // (a leg that is going nowhere ends where he stands)
      aim = seeBody ? onBody : null;
      if (arrived || (dB < 2.6 && seeBody && v3.distXZ(c.pos, D.spot) < 1.5)) {
        D.t = 0; gd.path = []; gd.pathGoal = null;
        if ((arrived && dB < 3.5) || seeBody) {   // actually at him (not merely at the end of a path that could not reach him)
          B.bodyVisits++; B.bodyVisitT = g.time; D.stage = 'cover';
          if (D.role !== 'finder' && !B.bodyRemarked && !(gd.bubble?.radio && g.time - gd.bubble.t < 5)) { B.bodyRemarked = true; g.say(gd, B.wound ? "…he's shot. still breathing. — stay sharp" : isBreathing(B) ? "…he's out cold. someone did this by hand. — stay sharp" : '…christ. — stay sharp'); }   // (not on top of his own radio call — with two men left, the one beside the finder is also the one who gave the order)
        } else { D.stage = 'fan'; D.spot = fanSpot(g, gd, B, bp); gd.stallRef = null; gd.searchT = 0; if (D.spot) gd.lastKnown = v3.copy(D.spot); }
      }
      break;
    }
    case 'cover': {
      gd.speed = damp(gd.speed, 0, 8, dt); c.vel = [0, 0, 0]; aim = onBody; D.t += dt;
      const done = D.role === 'finder' ? D.t > 6 || (D.t > 3 && B.bodyVisits >= 2 && g.time - B.bodyVisitT > 1.5) : D.t > 1.8;   // the finder holds it until somebody has joined him and had his look (or long enough alone); the others look and go
      if (done) { D.stage = 'fan'; D.t = 0; D.spot = fanSpot(g, gd, B, bp); gd.stallRef = null; gd.searchT = 0; gd.path = []; gd.pathGoal = null; if (D.spot) gd.lastKnown = v3.copy(D.spot); }
      break;
    }
    case 'fan': {
      if (!D.spot) { gd.awareness = Math.min(gd.awareness, 0.1); break; }
      let arrived = gd.searchT > 0;   // (once the look round has begun he stays put: a shove off the cell must not restart the walk)
      if (!arrived) { goTo(g, gd, D.spot); arrived = followPath(g, gd, dt, T.guardWalk * 1.3) || notGettingAnywhere(gd, dt, 3); move = gd.speed; }
      if (!arrived) { gd.sweep = damp(gd.sweep, Math.sin(gd.lookPhase * 0.9) * 0.7, 2, dt); c.aimYaw = c.bodyYaw + gd.sweep; }
      else { gd.speed = damp(gd.speed, 0, 8, dt); c.vel = [0, 0, 0]; gd.searchT += dt; gd.sweep = Math.sin(gd.lookPhase * 1.1) * 1.1; c.anim.lookYawExtra = Math.sin(gd.lookPhase * 1.9) * 0.4; c.aimYaw = c.bodyYaw + gd.sweep; if (gd.searchT > 4) gd.awareness = Math.min(gd.awareness, 0.1); }
      break;
    }
  }
  return { move, aim };
}

/** The fix a man is LEFT with the frame Sam goes out of his sight: where he last had him (`from`), led along the way he was moving then (`vel`) — 0.9 s of it,
 *  and only as far as the floor is open that way (a slim body marched through the statics: walls and jambs stop it; a LATCHED leaf stops it too — one Sam is
 *  only pushing at, or one locked against him that he will never be through — but a leaf he has off the latch and on the swing does not: that one he is going
 *  through). Standing still when he vanished, that is the spot itself; moving, it runs ahead with his pace — a stride at a creep, four at a sprint. So when Sam
 *  runs out of a man's sight through a doorway (the leaf swinging to behind him) or round a corner, the fix lies inside where he went, and the chase carries
 *  through the door — he has a key — and searches that room, instead of ending on the threshold with 'where did he go?' and a sweep of the corridor he is
 *  standing in while Sam stands lit in the middle of the room beyond. (The alarm's fix follows it in too: the pair sent to clear rooms starts with that one.)
 *  While Sam is IN view nothing is led — eyes, muzzle, torch and feet go to the man himself (updateGuard keeps his true position as the fix and only remembers
 *  the velocity for this). The point handed back always sits in a free nav cell on the near side of whatever stopped the march, so the path to it can never
 *  be snapped to the far side of a partition. */
export function leadFix(g: Game, from: Vec3, vel: Vec3): Vec3 {
  const p: Vec3 = [from[0], 0, from[2]]; const vx = vel[0], vz = vel[2]; const sp = Math.hypot(vx, vz);
  if (sp < 0.5) return p;   // (below a creep: standing, turning on the spot, the last of a stop's slide)
  const nav = g.col.nav; const shut = g.doors.list.filter(d => d.latched).map(d => d.box); const rd: Vec3 = [vx / sp, 0, vz / sp];
  let fix = p; const q: Vec3 = [0, 0, 0]; let prev: Vec3 = [p[0], 1.0, p[2]];
  for (let s = 0.05; s < 0.93; s += 0.05) {   // ≤ 0.24 m a sample at a sprint: overlapping 0.15 m circles cannot step over a 12 cm partition
    q[0] = p[0] + vx * s; q[1] = 0; q[2] = p[2] + vz * s;
    const at: Vec3 = [q[0], 1.0, q[2]];
    if (g.col.collideCircle(q, 0.15, 0.25, 1.5, 1) || g.col.clampToWorld(q, 0.15) || shut.some(b => rayBox(prev, rd, b, sp * 0.05))) break;   // (the first two nudge q — it is scratch, `at` holds the sample)
    prev = at;
    if (!nav.isBlocked(at[0], at[2])) fix = [at[0], 0, at[2]];   // (a sample in a cell the bake calls blocked — the last hand's breadth before a wall, the skirt of a jamb — is marched through but never handed back)
  }
  return fix;
}

/** Nothing a round would stop in — wall, jamb, mullion, desk, a door leaf, a GLASS PANE — between this man's gun shoulder and `to` (less the body's breadth
 *  at the far end), so a pistol hand round the jamb reads the same whichever way the muzzle happens to point this frame. Loose furniture is concealment, not
 *  cover (fireWeapon lets the round through to whoever stands behind it), so it is not asked. This is the line of FIRE (col.shotBlocked); canSee is the line
 *  of SIGHT, from the eye (col.segmentBlocked, which passes glass) — at a doorway the two differ by exactly the hand's breadth that had him shooting the frame,
 *  and across the conference glazing they differ outright: he sees Sam through the pane and has no shot from there (the round stars the glass and stops in
 *  it), so the alert branch reads `blocked` and takes him round through the door instead of planting him on the corridor emptying magazines into the pane. */
/** Where a man's line of fire is judged FROM (clearShot; the carbine probes measure the muzzle against the same point): the gun shoulder — fixed to the body,
 *  so the answer does not swing with a muzzle still coming round — shifted, for a shouldered long gun, by the carriage's own inboard hold. */
export function shotOrigin(c: Character): Vec3 {
  // The pistol at arm's length: the gun shoulder — fixed to the body, so the answer does not swing with a muzzle still coming round (once it is on,
  // shoulder → target is the round's line give or take the arm). A shouldered LONG gun: the trigger-hand wrist itself, which IS on the bore wherever the
  // maintainer's carriage puts it (anchor between chest and shoulder, held inboard) — re-deriving that geometry from outside drifted 9–11 cm off the real
  // bore; and the swing concern is the aim model's now (aim.ts gates the round on a settled track), not this line's.
  if (c.anim.longGun && c.bones.handR) return v3.copy(c.bones.handR);
  return c.bones.upperArmR ?? v3.add(c.pos, [0, 1.4, 0]);
}
export function clearShot(g: Game, c: Character, to: Vec3): boolean {
  const from = shotOrigin(c);   // (see shotOrigin: the gun shoulder for the pistol, the trigger-hand wrist on the bore for a long gun)
  const d = v3.sub(to, from); const L = v3.len(d); if (L < 0.35) return true;   // (pressed against him: nothing can be in between)
  return !g.col.shotBlocked(from, v3.mad(from, d, (L - 0.3) / L), 0.02, shotEnergy(g, c));   // (GLASS PENETRATION, glasspen.ts: with rounds going through glass the panes across the line are judged by what HIS gun's round has for them — off: undefined, the solid walk)   // 0.3: the body's own breadth round the aim point — anything nearer than that is him, not cover   // (shotBlocked, not segmentBlocked: a pane between them is no shot — see above)
}
/** A PINNED man is never asked clearShot (the alert branch: he fires from where he was put, cover or no cover) — bar this one line: his side's rounds have
 *  nothing for a standing pane (?glassfoes=0 with rounds through glass live: shotEnergy 0) and STANDING GLASS is the first thing between his gun and `to`
 *  (a round's own walk, col.raycast: a hole is passed, a leaf or a desk nearer than the pane is not glass). That round he is asked about like any other man,
 *  and holds: the row says his side does not shoot through glass, and fireWeapon would put it through. False at every other time (the default, his side
 *  shooting through glass, included): a pinned man is then exactly the man he was. */
function paneFirst(g: Game, c: Character, to: Vec3): boolean {
  if (shotEnergy(g, c) !== 0) return false;
  const from = shotOrigin(c); const d = v3.sub(to, from); const L = v3.len(d); if (L < 0.35) return false;
  const h = g.col.raycast(from, v3.scale(d, 1 / L), L - 0.3);
  return !!h && h.index < 1e6 && ((g.level.boxes[h.index]?.flags ?? 0) & BoxFlag.Glass) !== 0;
}

// ------------------------------------------------------------ muzzle discipline: nobody points a pistol at a colleague — it goes to the low ready until the line is clear
/** metres off a living colleague's body axis inside which a line of aim counts as ON him (widened for a man on the move by MUZZLE_LEAD_SECS of his pace, capped:
 *  the gun comes down for a man about to walk into the line, not as he meets it); how far past the aim point the line still counts (a man standing just beyond
 *  the spot being covered is being pointed at too); the reach of 'straight ahead' when there is no point to aim at; and the beat a cleared line stays down before
 *  the gun comes back up (so a man crossing does not flick it down-up-down) */
const MUZZLE_CLEAR_M = 0.35, MUZZLE_LEAD_SECS = 0.3, MUZZLE_LEAD_MAX_M = 0.4, MUZZLE_PAST_M = 1.0, MUZZLE_REACH_M = 8, MUZZLE_UP_SECS = 0.2;
/** in a fight: the margin a side-step opens the line by beyond the bare clearance, the furthest he will step for it, inside which distance of Sam he will not
 *  push past a colleague to get his line, and the least often anyone says anything about it */
const LINE_STEP_MARGIN_M = 0.12, LINE_STEP_MAX_M = 2.2, LINE_PUSH_MIN_M = 2.5, LINE_BARK_SECS = 10;
/** a side-step is going nowhere once STUCK_SECS of it have been handed straight back by whatever stands on the spot the nav bake cannot see (a chair wedged
 *  against the table's edge, a leaf, a colleague planted there: he steps his centimetre and is put back where he was); a side that went nowhere is not offered
 *  again from within FAIL_M of where it did for FAIL_SECS — the scrum will have shifted by then, and until it has, the answer from there is the other side or none */
const LINE_STUCK_SECS = 0.4, LINE_FAIL_SECS = 5, LINE_FAIL_M = 0.75;
/** a side-step whose walk would pass nearer than this to a living colleague's centre is no step (the men keep 0.6 m between centres: at half a metre they brush
 *  and give a hand's breadth; through him is a shoving match that goes nowhere) — round a man hard by, the far-side step always would: push past or wait instead */
const LINE_WALK_CLEAR_M = 0.5;
/** QA hook: set `log` and the alert branch's footwork round a colleague in the line (lineStep: the geometry, each candidate step and what became of it; the
 *  branch the fight took this frame; what the statics and the colleagues pushed back) says what it did, per man per frame (tools/qa: soak --trace, the scrum probe) */
export const LINE_DEBUG: { log: ((gd: Guard, s: string) => void) | null } = { log: null };

/** where a colleague stands against the aim segment `from` → `to`: t = how far along it his axis projects (0 at the shoulder, 1 at the point), e = his signed
 *  offset from it (metres, along the flat unit square off the line (−dz, dx)/L — the same side basis lineStep steps along), d = his distance from it in 3D (the
 *  axis runs soles to crown about his pelvis, so a line over a kneeling man or under one on a desk measures clear), clear = the clearance he is owed
 *  (MUZZLE_CLEAR_M, more for a man on the move) */
function lineGeom(from: Vec3, to: Vec3, o: Guard): { t: number; e: number; d: number; clear: number } | null {
  const dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2]; const L2 = dx * dx + dz * dz; if (L2 < 1e-4) return null;
  const h = o.char.bones.hips ?? o.char.pos; const ax = h[0], az = h[2];
  const t = ((ax - from[0]) * dx + (az - from[2]) * dz) / L2;
  const px = from[0] + dx * t, pz = from[2] + dz * t, py = from[1] + dy * t;
  const L = Math.sqrt(L2); const e = ((ax - from[0]) * -dz + (az - from[2]) * dx) / L;
  const y0 = o.char.pos[1] + 0.05, y1 = o.char.bones.headTop?.[1] ?? o.char.pos[1] + 1.75; const ddy = py < y0 ? y0 - py : py > y1 ? py - y1 : 0;
  const clear = MUZZLE_CLEAR_M + Math.min(MUZZLE_LEAD_MAX_M, MUZZLE_LEAD_SECS * Math.hypot(o.char.vel[0], o.char.vel[2]));
  return { t, e, d: Math.hypot(px - ax, pz - az, ddy), clear };
}
/** A living colleague standing in this man's line of aim: the segment from his gun shoulder to `to` (and MUZZLE_PAST_M beyond it) passing within the man's
 *  clearance of his body axis. The nearest such man along the line, or null. The INTENDED line (shoulder → the point he means to cover), not this frame's
 *  muzzle: a gun still swinging round onto its mark, or already lowered, answers the same. `except`: one man the caller has already answered for by better
 *  geometry than this — the colleague in Sam's arm, when the shooter stands behind the pair and the round stops in Sam a body's breadth short of him (the
 *  standoff's flankShot): the 'just beyond the point' rule assumes nothing solid AT the point, and there Sam is. */
export function colleagueInLine(g: Game, gd: Guard, to: Vec3, except: Guard | null = null): Guard | null {
  const c = gd.char; const from = c.bones.upperArmR ?? v3.add(c.pos, [0, 1.4, 0]);
  const L = Math.hypot(to[0] - from[0], to[2] - from[2]); if (L < 0.01) return null; const tMax = 1 + MUZZLE_PAST_M / L;
  let best: Guard | null = null, bt = Infinity; const near = gd.team === 'operative' && !!gd.unit && fightLive(g);   // (the team in a room fight: roomfight.ts ROOMFIGHT.closeLane)
  for (const o of g.guards) {
    if (o === gd || o === except || o.state === 'dead' || !o.char.alive || isHostile(gd.team, o.team)) continue;   // (teams: an ENEMY in the line is no reason to lower the gun — he is what it is up for; his own side and neutrals are colleagues)
    const G = lineGeom(from, to, o); if (!G || G.t < 0 || G.t > tMax || G.t >= bt || G.d > (near ? closeLane(G.clear, G.t, L) : G.clear)) continue;   // behind his shoulder, further off than the point (and its margin), or simply clear of it
    bt = G.t; best = o;
  }
  return best;
}
/** The last look before the round goes: a living colleague within a body's breadth of the segment the ROUND will fly — this frame's muzzle to the aim point. The
 *  shoulder line above decides the carry (and must, or a lowered gun would clear its own line and come straight back up); but pressed in a scrum a metre off
 *  Sam the bore sits a hand to the side of the shoulder line, and a man just clear of the one can be grazed by the other. This only ever holds a round for a
 *  frame (fireCd stays spent: it goes the moment he is clear) — it never moves the gun. `conePerM`: how much wider than the bore's line this round may fly, per
 *  metre of travel (half the cone it is drawn from — the later rounds of a burst, guards.ts burstTrigger): a man that far again off the line at his depth is
 *  still in the way of it. Nought for a first, aimed round: the rule every sidearm round has always had. */
export function roundPastColleague(g: Game, gd: Guard, to: Vec3, except: Guard | null = null, conePerM = 0): boolean {
  const from = gd.char.muzzle; const dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2]; const L2 = dx * dx + dz * dz; if (L2 < 0.0025) return false;
  const L = Math.sqrt(L2); const tMax = 1 + 0.3 / L;
  for (const o of g.guards) {
    if (o === gd || o === except || o.state === 'dead' || !o.char.alive || isHostile(gd.team, o.team)) continue;   // (teams: a round is held for his own side and for neutrals — never for an enemy standing in front of the one he is aimed at: he shoots him)
    const h = o.char.bones.hips ?? o.char.pos;
    const t = clamp(((h[0] - from[0]) * dx + (h[2] - from[2]) * dz) / L2, 0, tMax);   // (clamped at the muzzle end: a man whose shoulder the gun is practically resting on is too close to it, whichever side of the muzzle his spine falls)
    const px = from[0] + dx * t, py = from[1] + dy * t, pz = from[2] + dz * t;
    const y0 = o.char.pos[1] + 0.05, y1 = o.char.bones.headTop?.[1] ?? o.char.pos[1] + 1.75; const ddy = py < y0 ? y0 - py : py > y1 ? py - y1 : 0;
    const clear = Math.max(0.32, MUZZLE_CLEAR_M + Math.min(MUZZLE_LEAD_MAX_M, MUZZLE_LEAD_SECS * Math.hypot(o.char.vel[0], o.char.vel[2]))) + conePerM * t * L;
    if (Math.hypot(px - h[0], pz - h[2], ddy) < clear) return true;
  }
  return false;
}
/** the point MUZZLE_REACH_M out along where his gun is being held (aim yaw / pitch) from the gun shoulder — or where that line meets the floor, if it does first (a
 *  low carry pools a few metres out: the line ends there, it does not run on under the men beyond): what 'ahead' means for a man covering nothing in particular */
export function aimAhead(c: Character): Vec3 {
  const from = c.bones.upperArmR ?? v3.add(c.pos, [0, 1.4, 0]); const cp = Math.cos(c.aimPitch), sy = Math.sin(c.aimPitch);
  let reach = MUZZLE_REACH_M; if (sy < -1e-3) reach = Math.min(reach, (from[1] - 0.02) / -sy);
  return [from[0] + Math.sin(c.aimYaw) * cp * reach, from[1] + sy * reach, from[2] + Math.cos(c.aimYaw) * cp * reach];
}
/** This frame's muzzle discipline for a man whose pistol is up (`to` = the point he means to cover, null = the pistol is not up at all): a colleague in the line
 *  puts it straight down (Guard.muzzleDown), a line clear again for MUZZLE_UP_SECS lets it back up. Returns the man in the line (null when clear or lowered on
 *  the hysteresis alone). Whoever poses him reads muzzleDown: upper 'none' + stance 'lowReady' instead of the aim (updateGuard, squad.ts runGuardScript).
 *  `except` as colleagueInLine has it (the standoff's shot past the pair, from behind). */
export function muzzleCheck(g: Game, gd: Guard, to: Vec3 | null, dt: number, except: Guard | null = null): Guard | null {
  gd.muzzleEvalT = g.time;
  const o = to ? colleagueInLine(g, gd, to, except) : null;
  if (o) { gd.muzzleDown = true; gd.muzzleClearT = 0; }
  else if (gd.muzzleDown && (!to || (gd.muzzleClearT += dt) > MUZZLE_UP_SECS)) { gd.muzzleDown = false; gd.muzzleClearT = 0; }
  return o;
}
/** In a fight, a colleague `o` in his line to `aimAt` and nothing else keeping the round in: the step to the side that opens the line — worked out, not groped
 *  for: moving himself sideways by s moves the line at the man by s·(1 − t), so the two offsets that put the man his clearance (and a margin) off it are known;
 *  the shorter first (bent off a wall whose skirt takes the end of it, if the line still opens from where he fits), the other if that one is in a wall or off the
 *  walkable floor, would walk him through a colleague, or went nowhere from about here a moment ago (a step the props or a leaf hand straight back is dropped
 *  inside half a second and that SIDE remembered, Guard.lineFail — the bake cannot see a chair wedged on the table's edge, and re-planning the same quarter-
 *  metre into it every second was the seed-6 scrum) — taken as a side-step that keeps his chest and gun toward Sam. Returns 'step' while he is taking one (this moves him), 'none' when no step from here opens it (a corridor too narrow for the angle, the
 *  man hard by the target, both sides fouled or spent: the caller pushes past him instead, or waits), 'clear' when there is nobody to step round (lowered on the
 *  hysteresis alone — the gun is already on its way up). One of the two says so, at most every LINE_BARK_SECS for either. */
function lineStep(g: Game, gd: Guard, aimAt: Vec3, o: Guard | null, dt: number): 'step' | 'none' | 'clear' {
  const c = gd.char; const nav = g.col.nav;
  if (o && g.time - gd.lineBarkT > LINE_BARK_SECS && g.time - o.lineBarkT > LINE_BARK_SECS) {
    gd.lineBarkT = o.lineBarkT = g.time;
    if (Math.hypot(o.char.vel[0], o.char.vel[2]) > 0.4) g.say(o, 'crossing!'); else g.say(gd, "move — you're in my line");
  }
  const dbg = LINE_DEBUG.log; const f3 = (x: number) => x.toFixed(3);
  const F = gd.lineFail; const failLive = !!F && g.time - F.t < LINE_FAIL_SECS && v3.distXZ(c.pos, F.pos) < LINE_FAIL_M;   // the sides that went nowhere from about here lately still stand
  // a step already under way (a one-point path of his own — lineSide says it is his, not a bee-line goTo left him): ease onto the spot exactly, feet cycling,
  // facing kept — unless it is going nowhere: most of last frame's step handed straight back by something standing on the way the bake cannot see
  // (LINE_STUCK_SECS of that), or half a metre not made in 1.2 s
  if (gd.lineSide !== 0 && gd.path.length === 1 && gd.pathI === 0 && gd.pathGoal && v3.distXZ(gd.pathGoal, gd.path[0]) < 1e-3) {
    const wp = gd.path[0]; const dx = wp[0] - c.pos[0], dz = wp[2] - c.pos[2]; const d = Math.hypot(dx, dz);
    const back = gd.lineGain >= 0 ? d - gd.lineGain : 0;   // metres of last frame's step the doors / props / colleagues put back (0 = it all told; ≈ the step = he stands where he stood)
    if (gd.lineStepM > 1e-4 && back > 0.5 * gd.lineStepM) gd.lineStuckT += dt; else gd.lineStuckT = Math.max(0, gd.lineStuckT - 2 * dt);
    if (d < 0.05) { gd.path = []; gd.pathGoal = null; gd.stallRef = null; gd.lineSide = 0; gd.lineGain = -1; gd.lineStuckT = 0; dbg?.(gd, `step DONE at ${f3(c.pos[0])},${f3(c.pos[2])} (goal ${f3(wp[0])},${f3(wp[2])})`); }
    else if (gd.lineStuckT > LINE_STUCK_SECS || notGettingAnywhere(gd, dt, 1.2)) {
      const bit = gd.lineSide < 0 ? 1 : gd.lineSide > 0 ? 2 : 0;   // that side is off the list from about here for a while (both bits can end up set: then it is 'none' from here)
      gd.lineFail = failLive ? { pos: F!.pos, sides: F!.sides | bit, t: g.time } : { pos: v3.copy(c.pos), sides: bit, t: g.time };
      gd.path = []; gd.pathGoal = null; gd.stallRef = null; gd.stuckN++; gd.lineSide = 0; gd.lineGain = -1; gd.lineStuckT = 0;
      dbg?.(gd, `step STALLED ${f3(d)} m short of ${f3(wp[0])},${f3(wp[2])} (handed back ${f3(back)} of ${f3(gd.lineStepM)}) → stuckN ${gd.stuckN}, sides off from here: ${gd.lineFail.sides}`);
    }
    else { gd.speed = damp(gd.speed, g.tune.guardInvestigate * clamp(d / 0.45, 0.35, 1), 6, dt); const step = Math.min(d, gd.speed * dt); c.pos[0] += dx / d * step; c.pos[2] += dz / d * step; c.vel = [dx / d * gd.speed, 0, dz / d * gd.speed]; gd.lineGain = d - step; gd.lineStepM = step; dbg?.(gd, `stepping ${f3(step)} m toward ${f3(wp[0])},${f3(wp[2])} (${f3(d)} m off, handed back ${f3(back)}, stuckT ${f3(gd.lineStuckT)}, speed ${f3(gd.speed)})`); return 'step'; }
  }
  if (!o) { dbg?.(gd, 'clear (nobody in the line — hysteresis)'); return 'clear'; }
  const from = c.bones.upperArmR ?? v3.add(c.pos, [0, 1.4, 0]); const G = lineGeom(from, aimAt, o); if (!G || G.t > 0.97) { dbg?.(gd, `none: ${g.level.routes[o.routeI]?.name} AT the target (t ${G ? f3(G.t) : '-'})`); return 'none'; }   // (the man is AT the target: no angle opens that)
  const dx = aimAt[0] - c.pos[0], dz = aimAt[2] - c.pos[2]; const L = Math.hypot(dx, dz); if (L < 0.3) { dbg?.(gd, 'none: target on top of him'); return 'none'; }
  const lx = -dz / L, lz = dx / L;   // unit, square off the line (the side lineGeom's `e` is signed by)
  const need = G.clear + LINE_STEP_MARGIN_M; const k = 1 / Math.max(0.03, 1 - G.t);
  const cands = [(G.e - need) * k, (G.e + need) * k].filter(s => Math.abs(s) <= LINE_STEP_MAX_M && Math.abs(s) > 0.02).sort((a, b) => Math.abs(a) - Math.abs(b));
  if (gd.stuckN & 1) cands.reverse();   // (a step that went nowhere last time: try the other way first)
  const failed = gd.lineFail && g.time - gd.lineFail.t < LINE_FAIL_SECS && v3.distXZ(c.pos, gd.lineFail.pos) < LINE_FAIL_M ? gd.lineFail.sides : 0;   // (re-read: a stall just above may have written it)
  dbg?.(gd, `plan round ${g.level.routes[o.routeI]?.name} (t ${f3(G.t)} e ${f3(G.e)} d ${f3(G.d)} clear ${f3(G.clear)}; L ${f3(L)}; side (${f3(lx)},${f3(lz)}); stuckN ${gd.stuckN}; failed sides ${failed}) cands [${cands.map(f3).join(', ')}] from ${f3(c.pos[0])},${f3(c.pos[2])}`);
  for (const s of cands) {
    let cand: Vec3 = [c.pos[0] + lx * s, 0, c.pos[2] + lz * s]; let ox = lx * s, oz = lz * s;   // the spot, and the step's offset to it (bent below if a wall's skirt takes the end of it)
    if (failed & (s < 0 ? 1 : 2)) { dbg?.(gd, `  cand ${f3(s)} → ${f3(cand[0])},${f3(cand[2])} REJECTED: that side went nowhere from here a moment ago`); continue; }
    if (nav.isBlocked(cand[0], cand[2]) || !nav.walkable(c.pos, cand) || g.col.solidBlocked([c.pos[0], 0.5, c.pos[2]], [cand[0], 0.5, cand[2]])) { dbg?.(gd, `  cand ${f3(s)} → ${f3(cand[0])},${f3(cand[2])} REJECTED: ${nav.isBlocked(cand[0], cand[2]) ? 'cell blocked' : !nav.walkable(c.pos, cand) ? 'not walkable' : 'segment blocked'}`); continue; }
    // room for his body AT the spot: a free cell still stands him a hand inside a wall's clearance off its centre (pushed back out every frame: a stall against
    // the corridor wall); stand where the statics let him instead, if the line from there is still open — else that side is no step
    const fit: Vec3 = [cand[0], 0, cand[2]]; g.col.collideCircle(fit, c.radius, 0.2, 1.5);
    if (Math.hypot(fit[0] - cand[0], fit[2] - cand[2]) > 0.02) {
      ox = fit[0] - c.pos[0]; oz = fit[2] - c.pos[2]; const GF = lineGeom([from[0] + ox, from[1], from[2] + oz], aimAt, o);
      if (!GF || GF.d < GF.clear + 0.04 || nav.isBlocked(fit[0], fit[2]) || Math.hypot(ox, oz) < 0.05) { dbg?.(gd, `  cand ${f3(s)} → ${f3(cand[0])},${f3(cand[2])} REJECTED: no room to stand there clear of the wall and keep the line (fits at ${f3(fit[0])},${f3(fit[2])}, d ${GF ? f3(GF.d) : '-'})`); continue; }
      dbg?.(gd, `  cand ${f3(s)} → ${f3(cand[0])},${f3(cand[2])} bent off the wall to ${f3(fit[0])},${f3(fit[2])} (d ${f3(GF.d)} from there)`); cand = [fit[0], 0, fit[2]];
    }
    let other = false; const o2 = ox * ox + oz * oz;   // the walk there clear of every colleague's body (the man himself too: round one standing hard by, the far-side step goes through him)…
    for (const p of g.guards) { if (p === gd || p.state === 'dead' || !p.char.alive || isHostile(gd.team, p.team)) continue; const q = p.char.pos; const u = clamp(((q[0] - c.pos[0]) * ox + (q[2] - c.pos[2]) * oz) / o2, 0, 1); const wd = Math.hypot(c.pos[0] + ox * u - q[0], c.pos[2] + oz * u - q[2]); if (wd < LINE_WALK_CLEAR_M) { other = true; dbg?.(gd, `  cand ${f3(s)} → ${f3(cand[0])},${f3(cand[2])} REJECTED: the walk passes ${f3(wd)} m from ${g.level.routes[p.routeI]?.name}`); break; } }
    if (other) continue;
    const from2: Vec3 = [from[0] + ox, from[1], from[2] + oz];   // …and the line from THERE clear of everybody else — with two colleagues either side of it, the step round one is a step in front of the other, and he see-sawed between the two spots for as long as the scrum held (the QA soak's man on the lot): then it is 'none', and he waits or pushes past
    for (const p of g.guards) { if (p === gd || p === o || p.state === 'dead' || !p.char.alive || isHostile(gd.team, p.team)) continue; const G2 = lineGeom(from2, aimAt, p); if (G2 && G2.t >= 0 && G2.t <= 1 + MUZZLE_PAST_M / L && G2.d <= G2.clear + LINE_STEP_MARGIN_M) { other = true; dbg?.(gd, `  cand ${f3(s)} → ${f3(cand[0])},${f3(cand[2])} REJECTED: ${g.level.routes[p.routeI]?.name} in the line from there (t ${f3(G2.t)} d ${f3(G2.d)})`); break; } }
    if (other) continue;
    gd.path = [cand]; gd.pathI = 0; gd.pathGoal = v3.copy(cand); gd.stallRef = null; gd.lineSide = s < 0 ? -1 : 1; gd.lineGain = -1; gd.lineStuckT = 0;
    dbg?.(gd, `  cand ${f3(s)} → ${f3(cand[0])},${f3(cand[2])} TAKEN`);
    return 'step';
  }
  dbg?.(gd, '  none: no candidate survives');
  return 'none';
}

// ------------------------------------------------------------ the human shield: a colleague held in Sam's arm, in view — the standoff (docs/internal/grab-interrogate-design.md §2.2)
// A man who can see the pair — the colleague with a forearm across his throat, or Sam behind him: they stand as one, and the man's own torch is waving over the
// ceiling, so lighting is not asked (bodyInView's precedent) — goes alert on Sam like any sighting, but the alert branch hands him to standoffAlert instead of the
// chase and the shot: keep off them (the ring, MIN‥MAX), pistol up but lowered for the man in the line as muzzle discipline already has it, work round the ring
// toward Sam's BACK — the one place a round stops in Sam a body's breadth short of the colleague (flankShot) — two men going round opposite ways so whichever
// way Sam turns the shield one of them gains it, and there the pistol comes UP on him and stays: with muzzle discipline (tune.muzzleDiscipline, the default)
// nobody fires while the man is in the arm, line or no line (SHIELD_RELEASE_BEAT_*; off, single aimed rounds go down it at a slow cadence as they used to) —
// and the talking. The first to see it calls it in: the floor locks down on the call and everybody else comes to WHERE at the double (they know the place from
// the net, not that they can see it — arriving, their own eyes put them in the standoff). It ends the moment the hold does (choked out in front of them: found
// there and then, and the rounds follow after a beat; let go: the plain fight, the freed man in everybody's line for a second; Sam down: the aftermath), or four
// seconds after he last had them in view (back to the plain chase on where they were). Nothing of it under the tour, for the tour's held / pinned men, or for
// a Sam the sandbox has made invisible.
/** metres: nearer than MIN he backs off to the ring, further than MAX he closes at the investigate jog (inside it, a walk); the ring he circles on; how near dead
 *  astern of the pair counts as round (he comes in or out to the ring on his own bearing from there); the furthest he fires from (the guards' spread at rest keeps
 *  every round inside Sam's body cylinder up to about this — a hand further and a round wide of Sam is a round in the man beyond him) */
const STANDOFF_MIN_M = 3.5, STANDOFF_MAX_M = 7, STANDOFF_ORBIT_M = 4.5, STANDOFF_SETTLE_DEG = 22, STANDOFF_FIRE_MAX_M = 5.0;
/** the fire rule (flankShot): he stands inside REAR_DEG of the pair's rear, AND the segment his round flies — gun shoulder to where it stops in Sam's near side —
 *  passes at least CLEAR_M from the held man's body axis (at 70° off their rear that clearance is 0.45 m to the centimetre with the man 0.27 ahead of Sam: the two
 *  say the same thing, one by angle, one by the bones), AND nothing solid is in the way; then single rounds at least SHOT_SECS apart, aimed AIM_Y up Sam's own axis
 *  (the base of his neck: head and chest both, and the middle of the cylinder a round has to find) */
const STANDOFF_REAR_DEG = 70, STANDOFF_CLEAR_M = 0.45, STANDOFF_SHOT_SECS = 1.2, STANDOFF_AIM_Y = 1.42;
/** Sam's hit cylinder about his pelvis (Character.rayHit): where a true round stops short of his axis */
const SAM_R = 0.28;
/** in view: range and half-angle of the flat cone off where chest and head point between them (canSee's, and its wide near field inside 3.5 m); seconds out of
 *  his view before he gives the standoff up for the plain chase; seconds between orbit re-plans (the pair turns under him); seconds of no headway on a leg before
 *  he drops it (a colleague on the spot, a leaf held against him) and stands a moment */
const STANDOFF_VIEW_M = 16, STANDOFF_VIEW_DEG = 60, STANDOFF_LOSE_SECS = 4, STANDOFF_REPLAN_SECS = 1.0, STANDOFF_STALL_SECS = 2.5, STANDOFF_REST_SECS = 1.5;
/** the talking: at least BARK_SECS between one man's lines, FLOOR_SECS between anybody's */
const STANDOFF_BARK_SECS = 6, STANDOFF_BARK_FLOOR_SECS = 3;
/** muzzle discipline round the shield (Game.tune.muzzleDiscipline, on by default — the Chaos Theory rule): while Sam has a living man up in front of him NOBODY
 *  who can see it fires, however clean the flank line stands and however long it lasts — the pistol stays up on him (lowered for the friend in the line, as
 *  everywhere), they circle, talk and radio, and that is all; Sam firing past the man changes nothing (they do not shoot through a colleague to answer it). The
 *  round is the shield's to give back: the moment the man is out of the arm — folded at Sam's feet, whipped, shot, wrenched free — the plain fight has it, after
 *  a human beat of at least BEAT_MIN (+ up to JITTER for the men who watched him drop: a start, not a frame-perfect execution, and not all on one frame). Off =
 *  the rule before it: single aimed rounds down the flank line the moment flankShot holds. */
const SHIELD_RELEASE_BEAT_MIN = 0.35, SHIELD_RELEASE_BEAT_JITTER = 0.3;

/** Per observer, while it lasts (Guard.standoff). pair: the held colleague; side: which way round the ring he works (+1 = anticlockwise seen from above, his
 *  bearing from the pair increasing) — the second man takes the other; orbitGoal: the ring point he is walking to now (null = planted: he has his line, or is
 *  cornered, or resting a beat after a leg that went nowhere); replanT / restT: clocks for those; seenT: when he last had the pair in view; lastBarkT: his last
 *  line; lineOpen: the flank line stood open last frame (the 'I have him' is said on the edge); shots / orbitM: rounds fired and metres walked in this standoff
 *  (the QA soak reads both); way: the way round he is actually going now (0 = not yet; kept between re-plans so a walled arc's edge cannot see-saw him);
 *  cornered: no ring point either way round last time he looked; backing: inside the ring's edge last frame, backing off. */
export interface Standoff { pair: Guard; since: number; side: -1 | 1; way: -1 | 0 | 1; orbitGoal: Vec3 | null; replanT: number; restT: number; seenT: number; lastBarkT: number; lineOpen: boolean; shots: number; orbitM: number; stalls: number; cornered: boolean; backing: boolean; }
/** QA hook: set `log` and orbitGoalFor says what became of every ring point it looked at (the probes print it for a second or two round a re-plan they are chasing) */
export const STANDOFF_DEBUG: { log: ((s: string) => void) | null } = { log: null };
/** the pair as the observers reason about it this frame: the held man, Sam's hit axis and his, the point between (the ring's centre), the pair's facing (Sam's:
 *  the man is locked on it), the aim point on Sam's axis, the pair's velocity; null when nobody is held */
export interface Pair { key: object; held: Guard; sam: Vec3; heldAxis: Vec3; centre: Vec3; facing: number; aim: Vec3; vel: Vec3; }
/** Is the shield up — a living man of theirs in Sam's arm, Sam on his feet — in ANY phase of the hold (the reach, held, walked about, questioned, the elbow
 *  closing, the pistol coming off his head): pairOf's own test less the geometry. False the frame he folds, is whipped, dies in the arm or comes free. */
export function shieldUp(g: Game): boolean {
  const H = g.player.holding; if (!H || g.player.down) return false;
  const held = H.g; return held.state !== 'dead' && held.char.alive && held.held?.by === 'player' && g.onFloor(held);   // (a civilian in the arm is every bit the shield a colleague is — more: nobody puts a round past the cleaner)
}
export function pairOf(g: Game): Pair | null {
  const H = g.player.holding; if (!H || !shieldUp(g)) return null;
  const held = H.g;
  const pc = g.player.char, hc = held.char; const sh = pc.bones.hips ?? pc.pos, hh = hc.bones.hips ?? hc.pos;
  const sam: Vec3 = [sh[0], 0, sh[2]], heldAxis: Vec3 = [hh[0], 0, hh[2]];
  return { key: H, held, sam, heldAxis, centre: v3.lerp(sam, heldAxis, 0.5), facing: pc.bodyYaw, aim: [sam[0], pc.pos[1] + STANDOFF_AIM_Y, sam[2]], vel: v3.copy(pc.vel) };
}
/** holds already called in on the net (one call per hold, whoever sees it first), keyed by the hold itself; the floor's last standoff line (anybody's); each man's last line */
const holdsCalled = new SideSet<object>('guards.holdsCalled'); const floorBarkT = new SideMap<Game, number>('guards.floorBarkT'); const lastBark = new SideMap<Guard, string>('guards.lastBark');
/** a checkpoint loaded (game/savestate.ts) puts Game.time BACK: the floor's standoff-bark clock must not sit in the future muting the lines */
export function forgetGuardClocks(g: Game) { floorBarkT.delete(g); }
/** The pair in this man's open view: either body's chest or head (they stand as one) inside canSee's cone and range with nothing solid between — no light asked
 *  (the colleague is plain, and lit by his own torch), but smoke thick enough to hide Sam hides them both, magnesium in the eyes hides everything, and a Sam the
 *  sandbox has made invisible is holding nobody anyone can name. */
function pairInView(g: Game, gd: Guard, P: Pair): boolean {
  if (g.playerInvisible || g.time < gd.dazzledUntil || gd.smokeTrans < 0.3 || pairGripped(g, gd) || dozeAsleep(gd)) return false;
  const c = gd.char; const eye = c.bones.head ?? v3.add(c.pos, [0, 1.65, 0]);
  const look = v3.lerp(c.chestDir, c.headDir(), 0.5); const ll = Math.hypot(look[0], look[2]) || 1; const lx = look[0] / ll, lz = look[2] / ll;
  const pc = g.player.char, hc = P.held.char;
  const viewM = GUARD_EYE.far ? Math.max(STANDOFF_VIEW_M, eyeReach(g, Math.max(g.player.visibility, heldVisibility(g, P)))) : STANDOFF_VIEW_M;   // (the pair standing in light is seen as far as a lit man is: GUARD_EYE.far)
  for (const p of [hc.bones.chest ?? v3.add(hc.pos, [0, 1.1, 0]), hc.bones.head ?? v3.add(hc.pos, [0, 1.6, 0]), pc.bones.chest ?? v3.add(pc.pos, [0, 1.1, 0]), pc.bones.head ?? v3.add(pc.pos, [0, 1.6, 0])]) {
    const tx = p[0] - eye[0], ty = p[1] - eye[1], tz = p[2] - eye[2]; if (Math.hypot(tx, ty, tz) > viewM) continue;
    const fl = Math.hypot(tx, tz); if (fl > 0.3 && (tx * lx + tz * lz) / fl < Math.cos((fl < 3.5 ? 100 : STANDOFF_VIEW_DEG) * DEG)) continue;
    if (!g.col.segmentBlocked(eye, p)) return true;
  }
  return false;
}
/** Perception's share (updateGuard, AI on): is a held colleague in his view this frame? If so he is IN the standoff (entered now if he was not: the record, his
 *  memory of it, the call or his first line) and everything the AI reads as 'eyes on Sam right now' is refreshed off the pair — awareness full, the fix and the
 *  sighting on Sam, nothing to lead. Returns whether the pair was in view (updateGuard counts it as seeing Sam). */
/** what a watching man's eye gets off the PAIR: the better-lit of the two bodies (Sam's own meter; the held man's, sampled while he is held — heldLightMeter), through
 *  the same arithmetic his eye uses on Sam alone (sightGain: light^1.5 × distance × smoke × the alarmed floor's keenness × the hunting man's 2.2; the pair barely
 *  moves and cannot crouch). One model: a hostage taken in the dark is a hostage nobody has seen yet — a torch on them, a lit doorway, a metre and a half, and they have. */
/** how much more legible the pair is than Sam alone at the same light and distance (lit 0.6 at 5 m ≈ 0.8 s to take in; dim 0.25 ≈ 3 s; dark: never beyond arm's reach) */
export const PAIR_LEGIBLE = 3;
function pairSightRate(g: Game, gd: Guard, P: Pair, dist: number): number {
  const light = Math.max(g.player.visibility, heldVisibility(g, P));
  const distF = distTerm(dist);
  let rate = g.tune.detectRate * Math.pow(light, 1.5) * distF * clamp((gd.smokeTrans - 0.3) / 0.5, 0, 1) * (escalationOf(g) >= 1 ? KEEN : 1) * PAIR_LEGIBLE * loadSeen(g, 'player');   // (two men struggling upright, one of them in uniform, are a far easier read than one dark figure keeping still)
  if (dist < 1.8) rate = Math.max(rate, 3.5);
  if (gd.state === 'alert' || gd.state === 'search') rate *= 2.2;
  return rate;
}
/** the held man's own light meter while he is held (staff carry none otherwise): two probe queries at his chest and head like a unit's, the CPU estimate of the same
 *  direct light until the GPU answers; damped like everyone's. Kept per HOLD (the hold object is the key), and STARTED OVER — the probe's last answer under his keys
 *  forgotten, the damp begun again from the reading as it stands — for a new hold and for a pair nobody has metered for `HELD_METER.gapSecs` that has moved
 *  `HELD_METER.movedM` since: the probe keeps a key's last answer for ever and ids are dealt again, so the last hold's light (or this hold's, a room ago) was read
 *  as this one's until the probe answered afresh, and the damp then carried it on for a third of a second. A pair re-met where it stood keeps its answer. */
export const HELD_METER = { gapSecs: 0.5, movedM: 1 };
const heldMeters = new SideMap<object, { vis: number; t: number; at: Vec3 }>('guards.heldMeters');
function forgetHeldMeter(g: Game, gd: Guard) { const id = gd.char.id; g.lightForget(`heldC${id}`); g.lightForget(`heldH${id}`); }
function heldVisibility(g: Game, P: Pair): number {
  const hd = P.held; let m = heldMeters.get(P.key); const now = g.time; if (!m || (now - m.t > HELD_METER.gapSecs && Math.hypot(m.at[0] - hd.char.pos[0], m.at[2] - hd.char.pos[2]) > HELD_METER.movedM)) { m = undefined; forgetHeldMeter(g, hd); }
  if (m && m.t === now) return m.vis;
  const E = meterOf(g, hd.char, 'held');
  const dt = m ? Math.min(0.1, Math.max(0, now - m.t)) : 0.1; const vis = damp(m ? m.vis : g.visibilityOf(E), g.visibilityOf(E), 6, dt);
  m = { vis, t: now, at: v3.copy(hd.char.pos) }; heldMeters.set(P.key, m); hd.visibility = vis; return vis;
}
export function standoffPerceive(g: Game, gd: Guard, dt = 1 / 60): boolean {
  if (g.quietUtility || gd.hold || gd.pinned) return false;   // (the tour's men stay on their marks; upkeep drops a record made before the flag went up)
  const P = pairOf(g); if (!P || P.held === gd) return false;
  if ((P.held.team !== gd.team && P.held.team !== 'civilian') || !hostileTo(gd, 'player')) return false;   // (teams: the shield is a man of HIS side — or a CIVILIAN, the cleaner with a forearm across her throat is every bit the hostage a colleague is (review A6.1: she stopped every round as a shield but nobody ever called it, ringed him or said a word: the men stood mute and Sam walked her past them) — held by an enemy of his; an operative watching Sam hold a guard is in no standoff)
  if (!pairInView(g, gd, P)) return false;   // range, his cone, nothing solid between his eye and one of the four points — necessary, no longer sufficient:
  const now = g.time, pp = g.player.char.pos;
  const eye = gd.char.bones.head ?? v3.add(gd.char.pos, [0, 1.65, 0]); const dist = v3.dist(eye, P.centre);
  const rate = pairSightRate(g, gd, P, dist);   // ← what his eye actually gets off them where they stand (08-11: 'I got seen holding a man completely in the dark' — the old line read 'whatever the meter says')
  let S = gd.standoff; const inIt = !!S && S.pair === P.held;
  if (!inIt) {
    // not yet in the standoff: acquire the pair the way he acquires Sam alone — a faint glimpse tells him where to look, awareness fills at the sight rate, and he is
    // IN it (the record, the call, the floor answering) once it is as good as full; nothing at all in the dark beyond arm's reach
    if (rate <= 0.05) return false;
    const was = gd.awareness; gd.awareness = clamp(gd.awareness + rate * dt, 0, 1); if (!farFaint(gd, dist, was)) gd.lastKnown = v3.copy(pp);
    if (gd.awareness < 0.8) return rate > 0.25;   // (a sighting building, counted as eyes-on like sightGain's own 'seen' line — updateGuard raises him through suspicious → alert off the awareness as ever)
  } else if (rate <= 0.05) return false;          // in it already but they have gone dark on him: he keeps the record and his last fix (standoff's own clocks run on), he does not have eyes on them
  if (!S || S.pair !== P.held) {
    S = gd.standoff = { pair: P.held, since: now, side: pickSide(g, gd, P), way: 0, orbitGoal: null, replanT: 0, restT: 0, seenT: now, lastBarkT: -100, lineOpen: false, shots: 0, orbitM: 0, stalls: 0, cornered: false, backing: false };
    gd.witness.sawHeld = { who: P.held.callsign, t: now };   // he saw a colleague held, and whom (the dialogue's 'sawHurt': he watched Sam do it)
    gd.fireCd = Math.max(gd.fireCd, 0.8); gd.path = []; gd.pathGoal = null; gd.stallRef = null; gd.pieing = null; gd.searchPlan = null;   // (whatever walk he was on ends here; the first round waits for the gun to come round properly)
    if (!holdsCalled.has(P.key)) { holdsCalled.add(P.key); hostageCall(g, gd, P); } else standoffBark(g, gd, 'enter', true);
  }
  S!.seenT = now; gunHoldSee(g, gd, P);   // (gunhold.ts: what his side knows of the hold — where, which way, the pistol in it)
  gd.awareness = 1; gd.lastKnown = v3.copy(pp); gd.lastSeenT = now; gd.sightPos = v3.copy(pp); gd.sightVel = v3.copy(P.vel); gd.sightT = now; gd.ledT = now;   // (ledT: nothing to lead — he is looking straight at them)
  gd.alertBest = 1e9; gd.alertStallT = 0; gd.alertRef = null; gd.chaseT = 0;
  return true;
}
/** The first man to see it calls it in — who, and where — and the floor answers: everybody else living and free comes to the place at the double, weapons up (as
 *  they would to gunfire: the far end a beat later), and the alarm goes straight to lockdown round the pair (raiseEscalation 'hostage': somebody else gives the
 *  order so the caller's own line stays up; no rooms are dealt for clearing — they know exactly where he is). Once per hold, floor-wide. */
function hostageCall(g: Game, gd: Guard, P: Pair) {
  const c = gd.char; const where = roomName(g.level, P.sam);
  const civ = P.held.civ;   // (a civilian in the arm — civilians.ts Civ: 'the cleaner', 'the late worker' — is called in as what she is, not by a callsign the net does not have)
  g.say(gd, civ ? `he's got ${civ.name}, the ${civ.label} — ${where}! hold your fire — civilian in his arm, nobody push him` : `he's got ${spokenName(P.held) ?? 'one of ours'} — ${where}! hold your fire, nobody push him`, true); g.audio.play('radio', c.bones.head ?? c.pos, 0.9);
  if (g.time - g.lastStingT > 8) { g.audio.play('alertSting', null, 0.75); g.lastStingT = g.time; }
  for (const o of g.guards) {
    if (o === gd || o === P.held || o.state === 'dead' || o.held || o.team !== gd.team) continue;   // (teams: his own side answers the call — all of them staff, in the game as it was)
    const wasCalm = o.state === 'patrol' || o.state === 'suspicious';
    o.awareness = Math.max(o.awareness, 0.92); o.lastKnown = v3.copy(P.sam);
    if (wasCalm) o.reactT = Math.max(o.reactT, 0.25 + Math.min(1.2, v3.dist(o.char.pos, P.sam) / 25) + simRandom() * 0.4);   // (the far end of the floor takes a moment to place it, as for a shot)
  }
  if (gd.team !== 'guard') return;   // (the building's alarm and its lockdown are the STAFF's: a unit's call reaches his own side and no further)
  g.alarm.pos[0] = P.sam[0]; g.alarm.pos[1] = 0; g.alarm.pos[2] = P.sam[2]; g.alarm.placed = true;
  raiseEscalation(g, 2, gd, 'hostage');
}
/** Which way round the ring this man works: the other way from a colleague already in the standoff on this pair; else the short way to their rear if the ring is
 *  open that way all the way round to it, else whichever way has more open ring (walkable floor with the pair still in sight from it, sampled every 20°). */
function pickSide(g: Game, gd: Guard, P: Pair): -1 | 1 {
  for (const o of g.guards) if (o !== gd && o.state !== 'dead' && o.standoff && o.standoff.pair === P.held) return (o.standoff.side > 0 ? -1 : 1);
  const nav = g.col.nav, C = P.centre, c = gd.char;
  const brg = Math.atan2(c.pos[0] - C[0], c.pos[2] - C[2]); const toRear = wrapAngle(P.facing + Math.PI - brg); const short: -1 | 1 = toRear < 0 ? -1 : 1;
  const room = (d: number) => { const span = d === short ? Math.abs(toRear) : 2 * Math.PI - Math.abs(toRear); let n = 0, full = true; for (let a = 20 * DEG; a <= span + 1e-6; a += 20 * DEG) { const b = brg + d * a; const p: Vec3 = [C[0] + Math.sin(b) * STANDOFF_ORBIT_M, 0, C[2] + Math.cos(b) * STANDOFF_ORBIT_M]; if (nav.isBlocked(p[0], p[2]) || g.col.segmentBlocked([p[0], 1.2, p[2]], [C[0], 1.2, C[2]])) { full = false; break; } n++; } return { n, full }; };
  const rs = room(short), rl = room(-short);
  return rs.full || rs.n >= rl.n ? short : (short > 0 ? -1 : 1);
}
/** metres between colleague `o`'s body axis (soles to crown about his pelvis) and the SEGMENT `from` → `to`: lineGeom's measure, but a man beyond either end is as
 *  far off it as he is from that end (the flat foot of the perpendicular clamped onto the segment; these segments are near enough level for that) */
function axisToSegment(from: Vec3, to: Vec3, o: Guard): number {
  const dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2]; const L2 = dx * dx + dz * dz;
  const h = o.char.bones.hips ?? o.char.pos; const ax = h[0], az = h[2];
  const t = L2 > 1e-6 ? clamp(((ax - from[0]) * dx + (az - from[2]) * dz) / L2, 0, 1) : 0;
  const px = from[0] + dx * t, py = from[1] + dy * t, pz = from[2] + dz * t;
  const y0 = o.char.pos[1] + 0.05, y1 = o.char.bones.headTop?.[1] ?? o.char.pos[1] + 1.75; const ddy = py < y0 ? y0 - py : py > y1 ? py - y1 : 0;
  return Math.hypot(px - ax, pz - az, ddy);
}
/** The fire rule (see the constants): may this man's round go, at Sam, past the colleague in his arm? ok, plus the three measures for whoever prints them: how far
 *  off the pair's rear he stands (rad), the held man's clearance off the round's segment (m), his distance from the pair (m). */
export function flankShot(g: Game, gd: Guard, P: Pair): { ok: boolean; rear: number; clear: number; dist: number } {
  const c = gd.char; const from = c.bones.upperArmR ?? v3.add(c.pos, [0, 1.4, 0]);
  const dist = v3.distXZ(c.pos, P.centre);
  const brg = Math.atan2(c.pos[0] - P.sam[0], c.pos[2] - P.sam[2]); const rear = Math.abs(wrapAngle(brg - (P.facing + Math.PI)));
  const to = P.aim; const d = v3.sub(to, from); const L = v3.len(d); const impact = L > SAM_R + 0.05 ? v3.mad(from, d, (L - SAM_R) / L) : to;   // where a true round stops: Sam's near side
  const clear = axisToSegment(from, impact, P.held);
  const ok = rear < STANDOFF_REAR_DEG * DEG && clear >= STANDOFF_CLEAR_M && dist <= STANDOFF_FIRE_MAX_M && dist >= STANDOFF_MIN_M - 0.6 && clearShot(g, c, to);
  return { ok, rear, clear, dist };
}
/** Placeholder lines (a proper writing pass comes later), by moment and temperament ('*' for anybody); {held} = the man in the arm, {him} / {he} = the same man where a line
 *  does not name him (a woman in the arm is 'her': standoffBark fills them — 'him' written out is Sam). */
type StandoffMoment = 'enter' | 'noShot' | 'line' | 'cornered' | 'dropped' | 'freed' | 'lost' | 'hitHim';
const STANDOFF_LINES: Record<StandoffMoment, Partial<Record<Temperament | '*', string[]>>> = {
  enter: { steady: ['{held}, hold still — we\'ve got you', 'easy. easy. nobody has to get hurt here'], nervy: ['{held}! —jesus— okay, okay, nobody shoot!', 'oh god— he\'s got {held}—'], hard: ['let {him} go. now.', 'you. hands off {him}.'] },
  noShot: { '*': ['let {him} go!', 'drop {him} — NOW', '{held}, don\'t move', 'I don\'t have a shot', 'no shot — {held}\'s square in front of him'], steady: ['let {him} go and we talk about it', '{held}, stay loose — I\'m coming round'], nervy: ['{held}! —I can\'t— I haven\'t got a line—', 'don\'t you hurt {him}— don\'t—'], hard: ['you\'ve got nowhere to take {him}', 'the second {he} slips, you\'re done'] },
  line: { '*': ['I have him.', 'got a line —'], nervy: ['I— I think I have him—'], hard: ['there you are.'] },
  cornered: { '*': ['can\'t get round him — hold what you\'ve got', 'no way round. {held}, hang on', 'nowhere for either of us to go — let {him} walk and this ends quiet'], nervy: ['just— just let {him} go, please—'], hard: ['one way out of this for you. through us.'] },
  dropped: { '*': ['he\'s dropped {held} — TAKE HIM', '{held}\'s down — light him up!'], nervy: ['{held}! —he\'s— shoot, SHOOT—'] },
  freed: { '*': ['{held}, DOWN — get clear!', 'he\'s loose — {held}, out of the way!'] },
  lost: { '*': ['lost them — where\'d he take {him}?', 'I\'ve lost sight — moving up'], nervy: ['where— where did they go—'] },
  hitHim: { '*': ['…christ— I hit {him}. I hit {held}—'], nervy: ['no— no no no— {held}—'], hard: ['…{held}\'s hit. that\'s on him. keep on him—'] },
};
/** (WORDS) a standoff line as it is said now, by the line it stands for (read in standoffBark, where the pool is built) */
const STANDOFF_NOW: Record<string, string> = {
  '{held}, stay loose — I\'m coming round': '{held}, stay loose — I\'m coming around', '{held}! —I can\'t— I haven\'t got a line—': '{held}! —I can\'t— I don\'t have a shot—',
  'I have him.': 'I\'ve got him.', 'I— I think I have him—': 'I— I think I\'ve got him—',
  'can\'t get round him — hold what you\'ve got': 'can\'t get around him — hold what you\'ve got', 'no way round. {held}, hang on': 'no way around. {held}, hang on',
};
/** … and the moments whose every line names him, for a man in the arm whose own side has no name to say (teams.ts spokenName: a scenario's defender) */
const STANDOFF_NAMELESS: Partial<Record<StandoffMoment, string>> = { dropped: 'he\'s dropped {him} — TAKE HIM', freed: 'he\'s loose — get clear!', hitHim: '…christ— I hit {him}—' };
/** One standoff line from this man if the clocks allow (his own BARK_SECS, the floor's FLOOR_SECS, and never over his own radio call) — `force` skips the two
 *  clocks (the edges: entering, the line opening, the man dropping), 'always' the radio courtesy too (his own round in the man: that gets said); never the line
 *  he said last. */
function standoffBark(g: Game, gd: Guard, moment: StandoffMoment, force: boolean | 'always' = false, held: Guard | null = gd.standoff?.pair ?? null) {
  const S = gd.standoff, now = g.time;
  if (!force && ((S && now - S.lastBarkT < STANDOFF_BARK_SECS) || now - (floorBarkT.get(g) ?? -100) < STANDOFF_BARK_FLOOR_SECS)) return;
  if (force !== 'always' && gd.bubble?.radio && now - gd.bubble.t < 3) return;
  const M = STANDOFF_LINES[moment]; let pool = [...(M[temperamentOf(gd)] ?? []), ...(M['*'] ?? [])];   // (temperamentOf: a staff man's own, a unit's the hard man's under the dialogue pass — the same voice the hold gives him)
  if (held && spokenName(held) === null) { pool = pool.filter(l => !l.includes('{held}')); const l = STANDOFF_NAMELESS[moment]; if (!pool.length && l) pool = [l]; }   // (never with the words switch off)
  pool = wg(pool.map(l => STANDOFF_NOW[l] ?? l), pool);
  if (!pool.length) return;
  let i = Math.floor(simRandom() * pool.length) % pool.length; if (pool.length > 1 && pool[i] === lastBark.get(gd)) i = (i + 1) % pool.length;
  const text = pool[i].replace(/\{held\}/g, held?.callsign ?? 'him').replace(/\{him\}/g, w(held?.civ?.her, undefined) ?? 'him').replace(/\{he\}/g, w(held?.civ?.she, undefined) ?? 'he');
  lastBark.set(gd, pool[i]); if (S) S.lastBarkT = now; floorBarkT.set(g, now);
  g.say(gd, text);
}
/** Side-step / back-pedal along the current nav path (followPath's tolerances and easing, but the body is not turned to it — the standoff keeps his chest to the
 *  pair — and no stuck side-step of its own: notGettingAnywhere watches the leg). True once the path is consumed. */
export function stepAlongPath(g: Game, gd: Guard, dt: number, speed: number): boolean {
  const c = gd.char; speed = teamLegs(g, gd, conditionPace(g, gd, speed));   // (condition.ts: a hurt man's legs, whoever asks for them; kitload.ts: × a teammate's card, inside that cap)
  if (unstickFirst(g, gd, dt)) return false;   // (a side-step off a stranded cell first, as followPath: un-stick)
  while (gd.pathI < gd.path.length) {
    const wp = gd.path[gd.pathI]; const dx = wp[0] - c.pos[0], dz = wp[2] - c.pos[2]; const d = Math.hypot(dx, dz);
    if (d < (gd.pathI === gd.path.length - 1 ? 0.25 : 0.45)) { gd.pathI++; continue; }
    gd.speed = damp(gd.speed, speed * clamp((d + (gd.path.length - 1 - gd.pathI)) / 0.8, 0.35, 1), 4, dt);
    c.vel = [dx / d * gd.speed, 0, dz / d * gd.speed]; c.pos = v3.mad(c.pos, c.vel, dt);
    return false;
  }
  gd.speed = damp(gd.speed, 0, 10, dt); c.vel = [0, 0, 0];
  return true;
}
/** The next point on the ring for this man: from his bearing off the pair, an arc's step (≤ 50°–70°) round toward dead astern of them — the short way once he is
 *  past their flank, his dealt side while he is still in front (two men split there) — at the ring's radius or near it, on walkable floor he can reach without
 *  touring the building or cutting through the pair, with the pair still in sight from it, and not onto a colleague's spot; the other way round if his way is
 *  walled off. Round already (inside SETTLE of astern): in or out to the ring on his own bearing, or null if he is standing on it. null with nothing either way =
 *  cornered: he holds where he is and keeps talking. */
function orbitGoalFor(g: Game, gd: Guard, S: Standoff, P: Pair): Vec3 | null {
  const nav = g.col.nav, c = gd.char, C = P.centre; const dbg = STANDOFF_DEBUG.log;
  const dist = v3.distXZ(c.pos, C); const brg = Math.atan2(c.pos[0] - C[0], c.pos[2] - C[2]);
  const toRear = wrapAngle(P.facing + Math.PI - brg); const short = toRear < 0 ? -1 : 1;
  const round = Math.abs(toRear) < STANDOFF_SETTLE_DEG * DEG;
  if (round && Math.abs(dist - STANDOFF_ORBIT_M) < 0.6) { S.cornered = false; dbg?.(`${gd.callsign}: round (toRear ${Math.round(toRear / DEG)}°, ${dist.toFixed(1)} m) — plant`); return null; }   // there: on the ring behind them
  // which way round: the way he is already going (a man who re-decides every second at the edge of a walled arc see-saws on it), unless he has plainly ended up on
  // the wrong side of them (Sam turned the pair: the short way is now the other, and by a lot); not yet going: the short way — or, square in front where both
  // are as long, his dealt side (two men split there)
  if (S.way && Math.abs(toRear) < 120 * DEG && short !== S.way) S.way = short;
  const dir = round ? short : S.way || (Math.abs(toRear) < 150 * DEG ? short : S.side);
  if (dist > STANDOFF_MAX_M) { const ap = approachPoint(g, gd, C); if (ap) { S.cornered = false; dbg?.(`${gd.callsign}: from ${dist.toFixed(1)} m — straight over, to (${ap[0].toFixed(1)}, ${ap[2].toFixed(1)})`); return ap; } }   // from across the floor he comes over first, up his own path to them as far as the ring; the flanking starts there
  const others = g.guards.filter(o => o !== gd && o.state !== 'dead' && o.standoff && o.standoff.pair === P.held);
  let plans = 0;
  for (const way of (S.way ? [dir] : [dir, -dir]) as (-1 | 1)[]) {   // (once he is going one way, a wall across it corners him THERE — he does not walk back round the front to try the other flank while Sam watches; not yet going, either way is a way)
    for (const stepDeg of round ? [0] : [50, 30, 70]) {   // (no shorter: a step that gains no real angle on them is a shuffle — where the walls allow no more than that he is cornered, and stands)
      const span = way === short ? Math.abs(toRear) : 2 * Math.PI - Math.abs(toRear);   // (never on past dead astern: that is where he is going)
      const b = brg + way * Math.min(stepDeg * DEG, span);
      for (const r of [STANDOFF_ORBIT_M, 4.0, 5.2, 3.9, 3.6, 5.8]) {
        const p: Vec3 = [C[0] + Math.sin(b) * r, 0, C[2] + Math.cos(b) * r]; const tag = dbg ? `${gd.callsign}: way ${way > 0 ? '+' : '−'} ${stepDeg}° r${r} → (${p[0].toFixed(1)}, ${p[2].toFixed(1)})` : '';
        if (nav.isBlocked(p[0], p[2]) || v3.distXZ(p, c.pos) < 0.5) { dbg?.(`${tag}: ${nav.isBlocked(p[0], p[2]) ? 'blocked cell' : 'where he stands'}`); continue; }
        if (g.col.segmentBlocked([p[0], 1.2, p[2]], [C[0], 1.2, C[2]])) { dbg?.(`${tag}: no sight of them`); continue; }                      // he must still have them from there
        if (g.col.segmentBlocked([(p[0] + c.pos[0]) / 2, 1.2, (p[2] + c.pos[2]) / 2], [C[0], 1.2, C[2]])) { dbg?.(`${tag}: out of their sight on the way`); continue; }   // …and, near enough, on the way there (a ring point seen through a doorway from the next room is not a flank: he would walk out of sight of them to reach it)
        if (others.some(o => v3.distXZ(o.standoff!.orbitGoal ?? o.char.pos, p) < 1.5)) { dbg?.(`${tag}: a colleague's spot`); continue; }   // not onto (or on the way onto) a colleague's spot
        if (++plans > 12) { S.cornered = false; dbg?.(`${tag}: out of plans`); return dist > STANDOFF_MAX_M ? approachPoint(g, gd, C, false) : null; }   // (A* is the dear part: a dozen, then he stands this second out — or just comes over, from afar)
        const path = nav.findPath(c.pos, p); if (!path || !path.length) { dbg?.(`${tag}: no path`); continue; }
        let L = 0, q: Vec3 = c.pos, cuts = false; for (const w of path) { L += v3.distXZ(q, w); q = w; if (v3.distXZ(w, C) < STANDOFF_MIN_M - 0.7) cuts = true; }
        if (cuts || L > 2.5 * v3.distXZ(c.pos, p) + 2.5) { dbg?.(`${tag}: ${cuts ? 'path cuts through them' : `path too long (${L.toFixed(1)} m)`}`); continue; }   // round the ring — not through them, not round the building
        S.cornered = false; if (!round) S.way = way; dbg?.(`${tag}: TAKEN (toRear ${Math.round(toRear / DEG)}°, from ${dist.toFixed(1)} m at brg ${Math.round(brg / DEG)}°)`); return p;
      }
    }
    if (round) break;
  }
  dbg?.(`${gd.callsign}: nothing either way (toRear ${Math.round(toRear / DEG)}°, ${dist.toFixed(1)} m) — ${dist > STANDOFF_MAX_M ? 'approach' : 'cornered'}`);
  // no ring to speak of (a corridor: the walls take both flanks): from across the floor he still comes over — up his path to them, stopping the ring's radius
  // short; already there, he is cornered with them: he holds where he stands and keeps talking
  if (dist > STANDOFF_MAX_M) { S.cornered = false; return approachPoint(g, gd, C, false); }   // (no sight of them from where his path meets the ring — a partition: he comes up to it all the same and looks again from there)
  if (dist > STANDOFF_ORBIT_M + 1.0) { const ap = approachPoint(g, gd, C, false); if (ap && v3.distXZ(ap, c.pos) > 0.6) { S.cornered = true; dbg?.(`${gd.callsign}: no ring here — up to it, to (${ap[0].toFixed(1)}, ${ap[2].toFixed(1)})`); return ap; } }   // no flank to be had (a corridor), but he is not yet AT the ring: up to it, square on, and there he holds
  S.cornered = true; return null;
}
/** the point on this man's own nav path to `C` where it first comes within the ring's radius of it (found along the leg that crosses the ring, not just at a corner
 *  of the path — the last leg up a corridor is one long stride), if they are in sight from there; null = no path, or no sight of them from that point (a
 *  partition between: the ring search proper deals with that) */
function approachPoint(g: Game, gd: Guard, C: Vec3, needSight = true): Vec3 | null {
  const path = g.col.nav.findPath(gd.char.pos, C); if (!path?.length) return null;
  const R = STANDOFF_ORBIT_M; let a: Vec3 = gd.char.pos;
  for (const b of path) {
    if (v3.distXZ(b, C) <= R) {   // this leg crosses the ring: bisect for the crossing (distance to C falls monotonically enough along one leg for that)
      let lo = 0, hi = 1; for (let i = 0; i < 16; i++) { const m = (lo + hi) / 2; const q: Vec3 = [a[0] + (b[0] - a[0]) * m, 0, a[2] + (b[2] - a[2]) * m]; if (v3.distXZ(q, C) > R) lo = m; else hi = m; }
      const p: Vec3 = [a[0] + (b[0] - a[0]) * hi, 0, a[2] + (b[2] - a[2]) * hi];
      const free = !g.col.nav.isBlocked(p[0], p[2]) ? p : g.col.nav.nearestFreePoint(p[0], p[2]);
      if (!free || v3.distXZ(free, C) < STANDOFF_MIN_M) return null;
      return needSight && g.col.segmentBlocked([free[0], 1.2, free[2]], [C[0], 1.2, C[2]]) ? null : [free[0], 0, free[2]];
    }
    a = b;
  }
  return null;   // (the path never comes within the ring of them: cannot happen for a path TO them, bar a nav pocket — the ring search has it)
}
/** Where a man too close to the pair backs off to: the ring's inner edge on his own bearing from them for choice, else round to either side of that as far as
 *  square off it (along the corridor when the wall is at his back), straight over open floor from where he stands; failing the ring, any spot a stride or two
 *  off that puts a metre more between them. null = boxed in: he stands his ground there. */
function retreatGoal(g: Game, gd: Guard, P: Pair): Vec3 | null {
  const nav = g.col.nav, c = gd.char, C = P.centre; const brg = Math.atan2(c.pos[0] - C[0], c.pos[2] - C[2]);
  const open = (p: Vec3) => !nav.isBlocked(p[0], p[2]) && nav.walkable(c.pos, p) && !g.col.solidBlocked([c.pos[0], 0.5, c.pos[2]], [p[0], 0.5, p[2]]);
  for (const da of [0, 0.5, -0.5, 1.0, -1.0, 1.5, -1.5]) for (const r of [STANDOFF_MIN_M + 0.7, STANDOFF_MIN_M + 0.2, STANDOFF_MIN_M + 1.4]) {
    const a = brg + da; const p: Vec3 = [C[0] + Math.sin(a) * r, 0, C[2] + Math.cos(a) * r];
    if (open(p)) return p;
  }
  const d0 = v3.distXZ(c.pos, C); let best: Vec3 | null = null, bd = d0 + 0.8;   // no way onto the ring from here: whatever gains the most ground off them within a couple of strides
  for (let i = 0; i < 16; i++) for (const s of [2.0, 1.2]) {
    const a = i * Math.PI / 8; const p: Vec3 = [c.pos[0] + Math.sin(a) * s, 0, c.pos[2] + Math.cos(a) * s];
    const d = v3.distXZ(p, C); if (d > bd && open(p)) { bd = d; best = p; }
  }
  return best;
}
/** The alert branch for a man in the standoff (updateGuard: after his CONTACT beat, in place of the chase and the shot; upkeep has just confirmed the hold is on
 *  and it is this pair). Feet: back off inside MIN; plant once flankShot says the line is his; otherwise the next ring point toward their rear (re-planned every
 *  second as the pair turns, at a walk inside MAX and the investigate jog beyond it), side-stepping with his chest kept to them — except on the jog over from
 *  beyond MAX, where the legs have the body and he looks up his path whenever it turns its back on them; a leg that goes nowhere is dropped and he rests a beat.
 *  Gun: aimed at the base of Sam's neck; muzzle discipline exactly as everywhere (the held man lowers it) except that with the flank line open the held man no
 *  longer counts — then it is up on Sam and, under tune.muzzleDiscipline (the default), silent for as long as the man is in the arm; with that off, single
 *  rounds, SHOT_SECS apart, squarely aimed. Mouth: the line for the moment. Returns his move speed and the point he looks / aims at. */
function standoffAlert(g: Game, gd: Guard, dt: number, P: Pair): { move: number; aim: Vec3; crouch: number } {
  const S = gd.standoff!, c = gd.char, T = g.tune;
  const aim = P.aim; const dist = v3.distXZ(c.pos, P.centre);
  const fs = flankShot(g, gd, P);
  muzzleCheck(g, gd, aim, dt, fs.ok || gunHoldPhase(g, gd) === 'line' ? P.held : null);   // (gunhold.ts: a man PLANTED on the line keeps his gun up through a blink of it — the round itself still waits on fs.ok)
  if (fs.ok && !S.lineOpen) standoffBark(g, gd, 'line', g.time - S.lastBarkT > 2.5);   // (the edge is worth saying — not every other second while Sam swings the man to and fro)
  S.lineOpen = fs.ok;
  // --- feet ---
  let move = 0; const far = dist > STANDOFF_MAX_M; const before0 = c.pos[0], before2 = c.pos[2];
  S.replanT -= dt; S.restT = Math.max(0, S.restT - dt);
  const setGoal = (p: Vec3 | null) => { if (!p) { if (S.orbitGoal) { gd.path = []; gd.pathGoal = null; } S.orbitGoal = null; return; } if (!S.orbitGoal || v3.distXZ(S.orbitGoal, p) > 0.3) gd.stallRef = null; S.orbitGoal = p; };
  // The pistol known in the hold (gunhold.ts): no ring in his line of fire — cover, the way round out of his line, the line at his back. null = the ring below.
  const GH = gunHoldFeet(g, gd, dt, P, S, fs);
  const backing = !GH && dist < STANDOFF_MIN_M - 0.3;   // (a hand inside the ring's edge is standing on it, not inside it: no see-saw between backing off and coming in)
  const pace = (far || backing ? T.guardInvestigate : T.guardWalk) * (flinching(g, gd) ? SUPPRESSION.standoffPaceK : 1);   // the jog over from across the floor, and off a man walking his hostage at him (Sam hauls the pair at a slow walk: a walk backwards would never open the gap); the ring itself he walks — all of it at half pace with Sam's rounds going past his head (suppression.ts: rattled; pinned, he is not in here at all but head down, updateGuard)
  if (GH) { /* his feet are gunhold.ts's */ }
  else if (backing) { if (S.replanT <= 0 || !S.orbitGoal || !S.backing) { S.replanT = 0.5; setGoal(retreatGoal(g, gd, P)); } }   // too close: back off to the ring (or as far as the walls let him), facing them — looked at again twice a second while it lasts
  else if (fs.ok && (!S.orbitGoal || fs.rear < (STANDOFF_REAR_DEG - 15) * DEG)) setGoal(null);            // his line: plant and use it (the leg he is on he finishes first, unless he is already well inside — a line found on the sector's very edge goes again with a sway of Sam's)
  else if (S.restT > 0) setGoal(null);                                                                      // a leg just went nowhere: stand a beat
  else if (S.replanT <= 0 || !S.orbitGoal) { S.replanT = STANDOFF_REPLAN_SECS; setGoal(unstickBegin(g, gd) === 'leg' ? v3.copy(unstickLegs.get(gd)!.to) : orbitGoalFor(g, gd, S, P)); }   // (stood on a stranded cell every ring point would come back 'no path' and he would hold there, cornered, for the length of the hold: the side-step off it first — un-stick)
  S.backing = backing;
  let jogging = false; let lookAt = aim;   // on the jog over from across the floor: the legs have the body, and where his eyes and gun go (the pair if the run keeps them anywhere ahead of him, else up his path)
  if (GH) { move = GH.move; jogging = GH.run; if (GH.look) lookAt = GH.look; }
  else if (S.orbitGoal) {
    if (backing) { if (gd.pathGoal !== S.orbitGoal) { gd.path = [S.orbitGoal]; gd.pathI = 0; gd.pathGoal = S.orbitGoal; } }   // (the back-off is a straight step over floor retreatGoal has checked, not a planned walk)
    else goTo(g, gd, S.orbitGoal);
    const done = far ? followPath(g, gd, dt, pace) : stepAlongPath(g, gd, dt, pace); move = gd.speed;   // from across the floor he simply comes over; inside the ring's reach he side-steps with his chest to them
    if (done) { setGoal(null); S.replanT = Math.min(S.replanT, 0.25); }
    else if (notGettingAnywhere(gd, dt, STANDOFF_STALL_SECS)) { setGoal(null); gd.stallRef = null; S.restT = STANDOFF_REST_SECS; if (++S.stalls % 2 === 0) { S.side = S.side > 0 ? -1 : 1; S.way = S.way > 0 ? -1 : S.way < 0 ? 1 : 0; } }   // (twice running: try the other way round)
    else if (far && gd.pathI < gd.path.length) {
      // The jog over: followPath turns him up the leg he is on and will not carry a man faced more than ~84° off it above a creep (0.15 of the pace) until he
      // has come round — so nothing here may turn him back to face the pair meanwhile. It used to ('chest to them' whenever he was under 0.3 m/s, and the
      // generic stand-and-face-your-aim in updateGuard on top): with the way to them leading off through the door behind him the two turns beat followPath's,
      // and he hung at exactly that creep, 0.26 m/s sideways along his facing into the wall, for as long as the hold lasted (the soak's 'standoff-far'). His
      // eyes and gun stay on the pair while the run keeps them anywhere ahead of him; a leg that turns its back on them he runs looking where he is going
      // (four seconds out of his view and it is the plain chase on where they were, as from anywhere — he cannot watch them through the doorway behind him).
      jogging = true;
      const wp = gd.path[gd.pathI]; const yawPath = Math.atan2(wp[0] - c.pos[0], wp[2] - c.pos[2]);
      if (Math.abs(wrapAngle(Math.atan2(aim[0] - c.pos[0], aim[2] - c.pos[2]) - yawPath)) > 75 * DEG) lookAt = [c.pos[0] + Math.sin(yawPath) * 4, aim[1], c.pos[2] + Math.cos(yawPath) * 4];
    }
  } else { gd.speed = damp(gd.speed, 0, 6, dt); c.vel = [0, 0, 0]; gd.stallRef = null; }
  S.orbitM += Math.hypot(c.pos[0] - before0, c.pos[2] - before2);
  if (!jogging) c.bodyYaw = approachAngle(c.bodyYaw, Math.atan2(lookAt[0] - c.pos[0], lookAt[2] - c.pos[2]), 4 * dt);   // chest to them, always: the legs side-step and back-pedal under it — bar the jog over from across the floor (above)
  // --- the round: with muzzle discipline (the default) there is none while the shield stands — the flank line found, he plants on it with the pistol up on the
  //     back of Sam's neck and it stays silent; and a beat is kept in hand for when the shield goes (fireCd floored every frame of the standoff, so whichever way
  //     the hold ends, and whether or not he happened to be looking that instant, nothing leaves inside BEAT_MIN of his last frame in it). Discipline off = the
  //     rule before: single aimed shots, slow, at Sam only, only down the flank line ---
  gd.fireCd -= dt;
  const facingErr = Math.abs(wrapAngle(Math.atan2(aim[0] - c.pos[0], aim[2] - c.pos[2]) - c.gunYaw));   // (gunYaw: aimYaw — or, turning under weight (character.ts TURN), where the gun has got to)
  gd.weapon.burst = null;   // (rifles: a deliberate round past a colleague's head is never a burst — a rifleman here fires single rounds on the standoff's cadence like anybody, and one begun before he walked in on the hold is over)
  const held = T.muzzleDiscipline && !(GH && gunHoldPhase(g, gd) === 'line' && gunHoldFree(g, P));   // (gunhold.ts: Sam has fired from behind the man — the line at his back, found, is used)
  if (gd.reloadT >= 0) tickReloadBeat(g, gd, dt);
  else if (!held && fs.ok && !backing && gd.fireCd <= 0 && facingErr < 0.12 && !gd.muzzleDown && !armThrough(g, c) && !roundPastColleague(g, gd, aim, P.held) && aimReady(g, gd) && feetSettled(g, gd) && gd.weapon.fire()) {   // (feetSettled, aimcost.ts: under the moving rule the round past his own man waits for his feet to be still; not on the jog backwards off them: an aimed round is a planted or side-stepping man's; aimReady: lined up on Sam — aim.ts, always true with the model off; weapon.fire last: the round is only cycled out of the gun once everything else has said yes)
    const M = guardFireMods(g, gd); gd.fireCd = (STANDOFF_SHOT_SECS + simRandom() * 0.6) * M.gap; fireWeapon(g, c, aim, false, guardRound(g, gd, M.spread)); S.shots++;   // (the standoff's own slow cadence, not the weapon's — slower again and wider with rounds going past his own head, suppression.ts guardFireMods: ×1 / +0 at rest; the cone through the aim model, aim.ts guardRound: { spread: M.spread } exactly with it off)
    if (gd.weapon.roundsReady === 0) startReloadBeat(g, gd);
  }
  if (held) gd.fireCd = Math.max(gd.fireCd, SHIELD_RELEASE_BEAT_MIN + dt);   // (+dt: the hold ends in updatePlayer, ahead of the guards, on some LATER frame — this floor is from his last shielded frame, and the beat is measured from the frame the man leaves the arm)
  // --- the talking (the line held open and unused is still worth a word now and then, on the slow clocks: 'I have him' is the pressure) ---
  if (GH?.quiet) { /* on his way round, or running: nothing to say to Sam */ }
  else if (!fs.ok) standoffBark(g, gd, S.cornered && !S.orbitGoal ? 'cornered' : 'noShot');
  else if (held) standoffBark(g, gd, 'line');
  return { move, aim: lookAt, crouch: GH ? GH.crouch : 0 };
}
/** Every frame for a man carrying a standoff record (updateGuard, after the transitions, AI on or off): is it still one? Dropped when the tour flag / a scripted
 *  hold has come up or the AI has been switched off (nobody home to play it: taken up afresh when it comes back on), when he is somehow no longer alert, when the hold has ended — the man dead in or from the arm (with this one watching: found there and then,
 *  and his next round comes as fast as the gun comes round), or let go (the plain fight; the freed man is in everyone's line for a second and muzzle discipline
 *  holds it) — or when he has not had the pair in view for LOSE_SECS (the plain chase on where they were, then the search). Returns the pair when the standoff
 *  stands, for the alert branch. */
function standoffUpkeep(g: Game, gd: Guard): Pair | null {
  const S = gd.standoff; if (!S) return null;
  const P = pairOf(g);
  const why = g.quietUtility || gd.hold || gd.pinned || !g.aiEnabled ? 'off' : gd.state !== 'alert' ? 'state' : !P || P.held !== S.pair ? (S.pair.state === 'dead' ? 'dead' : g.player.down ? 'samDown' : 'free') : g.time - S.seenT > STANDOFF_LOSE_SECS && !gunHoldKeeps(g, gd) ? 'lost' : null;   // (samDown: the hold ended because Sam went down with the man in his arm — nothing to shout to a colleague already stumbling clear of a body; the alert branch covers the rest)
  if (!why) return P;
  gd.standoff = null; gd.path = []; gd.pathGoal = null; gd.stallRef = null; resetChase(gd);
  const watched = g.time - S.seenT < 0.6;
  if (why === 'dead' && watched) {
    const B = S.pair;
    if (B.state === 'dead') {
      if (g.guards.includes(B)) {   // (a CIVILIAN dropped out of the arm in front of him is found through the civilians' own notice — civilians.ts guardsNotice — not the shift's tally here)
        if (!B.found) { B.found = true; tally(g, 'bodies'); chronBodyFound(g, B, gd); }   // he watched him go down: nobody needs to walk onto this one to know
        gd.witness.sawBody = { victim: B.callsign, t: g.time, breathing: isBreathing(B) };
      }
      if (B.downBy !== 'guard') standoffBark(g, gd, 'dropped', true, B);   // (their own round: the man who fired it has said so)
    }
    gd.fireCd = g.tune.muzzleDiscipline ? SHIELD_RELEASE_BEAT_MIN + simRandom() * SHIELD_RELEASE_BEAT_JITTER   // the shield is gone: a start at the man dropping, then the rounds (not two men on one frame) —
      : Math.min(gd.fireCd, 0.15 + simRandom() * 0.3);                                                          // or, without the discipline, as fast as the gun comes round
  } else if (why === 'free' && watched) { standoffBark(g, gd, 'freed', true, S.pair); gd.fireCd = Math.max(gd.fireCd, 0.4); }
  else if (why === 'lost') { standoffBark(g, gd, 'lost', true, S.pair); gd.lastSeenT = Math.min(gd.lastSeenT, S.seenT); }
  return null;
}
/** The friendly-fire line (combat.ts fireWeapon: a colleague's round found the man in Sam's arm): the shooter says so, whatever the clocks. */
export function hostageHitBark(g: Game, shooter: Guard, victim: Guard) { standoffBark(g, shooter, 'hitHim', 'always', victim); }
/** Panel / QA: one line per man in a standoff — distance, degrees off the pair's rear, the held man's clearance off his line, side, what his feet are doing, rounds. */
export function standoffSummary(g: Game): string {
  const P = pairOf(g); const parts: string[] = [];
  for (const gd of g.guards) {
    const S = gd.standoff; if (!S || gd.state === 'dead') continue;
    const fs = P && P.held === S.pair ? flankShot(g, gd, P) : null;
    parts.push(`${gd.callsign}: ${fs ? `${fs.dist.toFixed(1)} m, ${Math.round(fs.rear / DEG)}° off their rear, clear ${fs.clear.toFixed(2)}${fs.ok ? ' LINE' : ''}` : 'pair gone'} · side ${S.side > 0 ? '+' : '−'} · ${S.orbitGoal ? `to (${S.orbitGoal[0].toFixed(1)}, ${S.orbitGoal[2].toFixed(1)})` : S.cornered ? 'cornered' : S.restT > 0 ? 'resting' : 'planted'} · ${S.shots} shot${S.shots === 1 ? '' : 's'}, ${S.orbitM.toFixed(1)} m walked, seen ${(g.time - S.seenT).toFixed(1)} s ago`);
  }
  return parts.join(' | ');
}

export function canSee(g: Game, gd: Guard): { visible: boolean; dist: number; inCone: boolean } { return canSeeChar(g, gd, g.player.char, true); }
/** canSee against any man `pc` — Sam (`isPlayer`: his sandbox invisibility, his down flag, the smoke marched between this man's eye and HIS chest) or an AI man of a
 *  side hostile to this one (teams: alive; the same cone, near field, range and line of sight off the same bones; no smoke term — the probe's segment is to Sam
 *  only — and the magnesium in his eyes hides everybody). One test, so an operative sees a hostile exactly as a guard sees Sam — but for one thing, in a room
 *  fight only: a man with his long gun in the shoulder ALSO sees an AI man through the same eye laid along his aim, its cone ROOMFIGHT.sightsDeg (roomfight.ts
 *  ROOMFIGHT.sights for the teammates, on; sightsFoe for every other side, off). Sam is never read through it. */
export function canSeeChar(g: Game, gd: Guard, pc: Character, isPlayer: boolean): { visible: boolean; dist: number; inCone: boolean } {
  const eye = gd.char.bones.head ?? v3.add(gd.char.pos, [0, 1.65, 0]);
  const look = v3.normalize(v3.lerp(gd.char.chestDir, gd.char.headDir(), 0.5)), E: Eye = { pos: eye, look, range: reachFor(g, gd, pc, isPlayer, eye), halfDeg: GUARD_EYE.halfDeg, nearM: GUARD_EYE.nearM, nearDeg: GUARD_EYE.nearDeg };   // (reachFor: a man standing in light is seen from past `range`; `range` itself otherwise)
  const through = eyeThrough(gd);   // (FOG.mates: a teammate's eye passes the thin things the fog's lines pass)
  let r = eyeContact(g, E, pc, isPlayer, g.time < gd.dazzledUntil || pairGripped(g, gd) || dozeAsleep(gd), gd.smokeTrans, through);   // dazzled: eyes full of magnesium (pairorders.ts: or a teammate's hands on him; doze.ts: or asleep in his chair)
  if (!r.inCone && r.dist < E.range && !isPlayer && (gd.team === 'operative' ? ROOMFIGHT.sights : ROOMFIGHT.sightsFoe) && fightLive(g)) {   // (roomfight.ts ROOMFIGHT.sights: a long gun in the shoulder and level along his aim — he ALSO sees what is along his sights, the same eye laid on the aim)
    const c = gd.char, ax = Math.sin(c.gunYaw), az = Math.cos(c.gunYaw);   // (gunYaw: aimYaw — or, turning under weight, where the gun has got to)
    let lv = c.gunDir[0] * ax + c.gunDir[2] * az;   // how level along his aim the bore lies, in plan
    const lift = c.anim.sightsLift; if (lift > 0) { const gh = Math.hypot(c.gunDir[0], c.gunDir[2]); if (gh > 1e-6) lv *= Math.cos(lift) - c.gunDir[1] / gh * Math.sin(lift); }   // (character.ts MOVES.entryEyes: the entry dip's own pitch put back — the question asked of his gun line as if it were not down past a friend; 0 unless that switch is on and he is dipped)
    if (c.anim.longShown === 'shoulder' && !c.anim.atWell && lv > SIGHTS_COS) { E.look = [ax, 0, az]; E.halfDeg = Math.min(E.halfDeg, ROOMFIGHT.sightsDeg); r = eyeContact(g, E, pc, false, g.time < gd.dazzledUntil || pairGripped(g, gd) || dozeAsleep(gd), gd.smokeTrans, through); }
  }
  if (!isPlayer && r.visible && pairSmoke(g, gd.char, pc) < 0.3) r.visible = false;   // an AI man lost in a plume, by the same line as Sam (roomfight.ts marches the pair's segment; 1 = clear wherever it does not)
  return r;
}
/** a man's eye: 16 m of reach, 58° either side of where chest and head point between them, and inside 3.5 m a near field of 100° (a shape at his elbow is seen) */
export const GUARD_EYE = { range: 16, halfDeg: 58, nearM: 3.5, nearDeg: 100,
  /** A LIT MAN IS SEEN FROM FURTHER (eyeReach below): on in the page (?nofarsight), off here and on the frozen harness stand (TPS_FARSIGHT=1) = every eye stops
   *  at `range` whatever the light, as it was. One rule for every man's eye on every man: a guard's on Sam, a defender's on a teammate, a teammate's on a defender */
  far: false,
  /** A FAR GLIMPSE IS NOT YET A PLACE TO WALK TO (farFaint below; nothing without `far`): on in the page (?nofarcalm), off here and on the frozen harness stand
   *  (TPS_FARCALM=1) = every glimpse past `range` writes his fix the frame it lands, as `far` first shipped */
  farCalm: false,
  /** …the awareness from which a WARY man's glimpse from past `range` is his fix (under it he has not watched long enough to know where) */
  farFixAt: 0.5,
  /** …how far the eye reaches for a man in full light (m); the light on him (his meter, 0‥1) under which the reach is `range` and nothing changes, and from which it is whole */
  farRange: 26, farLo: 0.4, farHi: 0.8,
  /** …and how slowly the notice builds out there: sightGain's distance term runs on from its 0.2 at `range` down to this at `farRange` */
  farK: 0.1 };
/** How far a man's eye reaches for a man with `lit` (his light meter, 0‥1) on him: `range` in the dark — under `farLo` nothing is easier to see than it was — easing
 *  out to `farRange` for a man standing in light (`farHi` and over). `range` with the switch off and under a show. */
export function eyeReach(g: Game, lit: number): number {
  if (!GUARD_EYE.far || g.touring) return GUARD_EYE.range;
  return GUARD_EYE.range + Math.max(0, GUARD_EYE.farRange - GUARD_EYE.range) * smoothstep(GUARD_EYE.farLo, GUARD_EYE.farHi, lit);
}
/** …for the man `pc` in this man's view: Sam by his meter; an AI man by his own (Guard.visibility) or by his lit weapon light pointed at this eye (roomfight.ts
 *  lampGlare) — the light sightGainOn reads, less the goggles' (a tube makes a dark man out, it does not carry further). Nobody is looked up inside the old reach. */
function reachFor(g: Game, gd: Guard, pc: Character, isPlayer: boolean, eye: Vec3): number {
  if (!GUARD_EYE.far || g.touring) return GUARD_EYE.range;
  if (isPlayer) return eyeReach(g, g.player.visibility);
  const t = pc.bones.chest ?? pc.pos; if (Math.hypot(t[0] - eye[0], t[2] - eye[2]) < GUARD_EYE.range - 1) return GUARD_EYE.range;
  const o = g.guards.find(x => x.char === pc); return o ? eyeReach(g, Math.max(o.visibility, lampGlare(g, gd.char, o))) : GUARD_EYE.range;
}
/** A FAR GLIMPSE IS NOT YET A PLACE TO WALK TO (GUARD_EYE.farCalm; false at once with it or `far` off, and for every glimpse inside `range`): true = this
 *  glimpse feeds his awareness and writes NO fix. The fault it shuts: a lit man glimpsed from 20 m, far too faintly to turn a head, still left `lastKnown` on a
 *  calm man — and the first thing to make him wary for a reason of its OWN (the mains going: lighting.ts setBlackout) walked him off his post to it, in the dark
 *  the far reach was never to change. So past `range` a CALM man gets his fix on the frame the sight itself tips him (`was` under the 'huh?' line, now on it);
 *  a WARY man once he has watched the man long enough to be `farFixAt` aware (the mains going leave him at 0.34: half a second of a man in full light at 20 m
 *  from there — he turns to him and goes, he does not stand till CONTACT), every glimpse from then on; a man hunting (alert, search) takes every glimpse, as ever. */
function farFaint(gd: Guard, dist: number, was: number): boolean {
  if (!GUARD_EYE.farCalm || !GUARD_EYE.far || dist <= GUARD_EYE.range) return false;
  if (gd.state === 'patrol') return !(was < 0.3 && gd.awareness >= 0.3);
  if (gd.state === 'suspicious') return gd.awareness < GUARD_EYE.farFixAt;
  return false;
}
/** the distance term of a sighting's rate: 1 inside 3 m down to 0.2 from 13.4 m — and (GUARD_EYE.far) past the old reach on down to `farK` at `farRange`: a man
 *  is seen out there only standing in light, and the further out, the slower the notice builds. Inside `range` the term is what it always was. */
function distTerm(dist: number): number {
  if (dist > GUARD_EYE.range && GUARD_EYE.far) return lerp(0.2, GUARD_EYE.farK, clamp((dist - GUARD_EYE.range) / Math.max(1e-3, GUARD_EYE.farRange - GUARD_EYE.range), 0, 1));
  return clamp(1 - (dist - 3) / 13, 0.2, 1);
}
/** WHAT THE TEAM'S OWN EYES PASS (col.segmentBlocked's `through`): under FOG.mates, what the fog's lines pass (fogofwar.ts fogThrough: glass, and with
 *  FOG.thin the statics marked thin and free) — what the picture shows through a window's bar, the teammate standing there sees; with the row off,
 *  glass alone, as it was. `teamThrough` = the team's (the player's own line for the squad's net: picture.ts lookSam); `eyeThrough` = a man's, which is
 *  the team's for an operative and glass alone for every other side: no other eye is ever handed the marks. */
export function teamThrough(): number { return FOG.mates ? fogThrough() : BoxFlag.Glass; }
export function eyeThrough(gd: Guard): number { return gd.team === 'operative' ? teamThrough() : BoxFlag.Glass; }
/** …and that man's own line to a point, asked bare (roomfight.ts: which teammate has a line to the man who fired, to a mate's target; the lost-behind-
 *  something line below): is anything his eye stops at between `a` and `b`. With the row off this is col.segmentBlocked(a, b), as each caller had it. */
export function eyeBlocked(g: Game, gd: Guard, a: Vec3, b: Vec3): boolean { return g.col.segmentBlocked(a, b, 0.02, eyeThrough(gd)); }
/** cos 30°: how level along his aim (in plan, the bore's own pitch counted) a shouldered long gun must lie for its owner's eyes to be on its sights */
const SIGHTS_COS = 0.866;
/** An eye — a man's (canSeeChar fills it off his bones) or a device's (devices.ts: a camera's lens): where it is, the unit direction it looks along, how far it
 *  reaches, its half-angle in plan (and the wider near-field one inside `nearM`), and — a lens only — the half-angle in ELEVATION about the look direction's
 *  own pitch (`vHalfDeg`; a man's cone is a flat wedge, floor to ceiling, and leaves it undefined). */
export interface Eye { pos: Vec3; look: Vec3; range: number; halfDeg: number; nearM: number; nearDeg: number; vHalfDeg?: number; }
/** THE line-of-sight test, whoever's eye it is: the target's chest inside the eye's cone and reach (in plan; plus the elevation window when the eye has one), then
 *  nothing solid — statics or a leaf — between the eye and his chest AND his head, and (Sam only) the smoke marched between them not yet opaque (`smokeTrans`, the
 *  probe's transmittance along eye → chest: under 0.3 he is a shape lost in the plume). `blind` = the eye itself is out (magnesium in it; a device says false and
 *  gates on its power instead). Sam's sandbox invisibility and his lying downed hide him from every eye; an AI target only has to be alive. Returns the distance and
 *  whether he was in the cone at all, seen or not, as canSee always did. (fogofwar.ts lineToMan repeats this function's two lines for the team's eyes — his chest,
 *  then his head behind a blocked chest: change the two together.) `through` = the box flags the line passes: glass, and for a teammate's own eye what
 *  `eyeThrough` adds. */
export function eyeContact(g: Game, E: Eye, pc: Character, isPlayer: boolean, blind: boolean, smokeTrans: number, through: number = BoxFlag.Glass): { visible: boolean; dist: number; inCone: boolean } {
  const eye = E.pos;
  const tgt = pc.bones.chest ?? v3.add(pc.pos, [0, 1.1, 0]); const tgt2 = pc.bones.head ?? v3.add(pc.pos, [0, 1.6, 0]);
  const to = v3.sub(tgt, eye); const dist = v3.len(to); const dirTo = v3.scale(to, 1 / Math.max(dist, 1e-4));
  const look = E.look;
  const cosA = v3.dot([look[0], 0, look[2]], v3.normalize([dirTo[0], 0, dirTo[2]]));
  const fov = dist < E.nearM ? Math.cos(E.nearDeg * DEG) : Math.cos(E.halfDeg * DEG);
  let inCone = cosA > fov && dist < E.range;
  if (inCone && E.vHalfDeg !== undefined) inCone = Math.abs(Math.asin(clamp(dirTo[1], -1, 1)) - Math.asin(clamp(look[1], -1, 1))) < E.vHalfDeg * DEG;   // (a lens: the elevation to his chest within the cone's own about its pitch — straight under a wall camera is under its picture)
  if (!inCone || (isPlayer ? g.playerInvisible || g.player.down : !pc.alive) || blind) return { visible: false, dist, inCone };
  const blocked = (g.col.segmentBlocked(eye, tgt, 0.02, through) && g.col.segmentBlocked(eye, tgt2, 0.02, through)) || (isPlayer && smokeTrans < 0.3);
  return { visible: !blocked, dist, inCone };
}

// ------------------------------------------------------------ un-stick: a living man standing where the nav grid has no way out
// A man can end up standing where his capsule fits but the bake calls the floor blocked with nothing free BESIDE it either — the hand's breadth between a desk's
// end and a partition that a hold walked him into and then ended in (Sam teleported off him, Sam shot), a shove off a leaf into a corner. A* cannot leave a cell
// whose four neighbours are shut (a diagonal needs both its orthogonals), so every plan from there came back empty: goTo handed followPath nothing, which reads
// as 'arrived' — the patrol ticked through its waypoints on the spot, the search 'looked into' a dozen spots from it, the post man bee-lined the wall — and he
// never walked again (the review lane's heavy grab soak: seed 6, the cubicles man at (22.66, 21.88) from 202 s to the end). So: when a plan is asked for and
// the cell under him is one of those, he first side-steps to the nearest free cell within reach that his body can be walked straight to — on his own feet,
// through the ordinary movement and push-out, at a walk — and plans again from there; genuinely wedged (nothing walkable within reach, or a second on the leg
// without getting nearer) he is stood on the nearest free cell in the room outright, once, with a line to the QA log and not a word. Only a failed plan or
// the frame a hold ends ever asks: a man on a free cell never comes near any of it.
/** REACH: the side-step looks this far for a free cell — the nook that started this is 0.55 m off one, but a sweep of every stranded-yet-standable spot on the
 *  floor (107: corners behind an office chair, the planter by the north wall, the strip between a parked car and the fence…) found the nearest walkable one up
 *  to ~1.9 m off, and two strides walked beat a snap (at 2.4 the sweep walks off 105, snaps 2: the manager's corner boxed in by his chair, and behind the van
 *  out on the lot); STALL: this long stepping without getting nearer and he is snapped; DONE: this near the centre is there (a free cell's centre stands a
 *  0.34 m circle clear, so a 0.3 m man always fits ON it — short of it he may still be over the line in the blocked cell he came from); SNAP_REACH: how far
 *  the snap looks for somewhere to put him; BODY_R: the circle the leg is swept with — half his own: anything nearer the line than that he would walk INTO
 *  (a desk top end-on, a cabinet), anything further off it the push-out slides him round (at his full 0.3 the same sweep snapped 14 that walk fine). */
const UNSTICK_REACH_M = 2.4, UNSTICK_STALL_SECS = 1.0, UNSTICK_DONE_M = 0.08, UNSTICK_SNAP_REACH_M = 3.5, UNSTICK_BODY_R = 0.15;
/** to: the free cell's centre; best: the nearest he has yet been to it; stallT: seconds OF STEPPING since that last improved (the leg may be dealt on the frame a
 *  hold ends and only walked once his stagger and his CONTACT beat are over — standing is not failing to get there) */
interface UnstickLeg { to: Vec3; best: number; stallT: number; }
const unstickLegs = new SideMap<Guard, UnstickLeg>('guards.unstickLegs');
/** not before this game time does a man with nowhere at all to be put get looked at again (never met on this floor; the guard against a per-frame scan) */
const unstickRetryAt = new SideMap<Guard, number>('guards.unstickRetryAt');
/** men in Sam's arm as of their last update: the first frame back on their own feet gets the stranded check (the hand-back itself lives in player.ts) */
const heldLastFrame = new SideSet<Guard>('guards.heldLastFrame');
/** QA counters (tools/qa: the unstick probe, the soak's smell line): side-steps begun, snaps made, and when / whom the last snap moved (the soak's one-frame
 *  displacement net lets that man through that frame, as it does its own teleports) */
export const UNSTICK = { legs: 0, snaps: 0, lastSnapT: -1, lastSnapWho: null as Guard | null };
rollbackRoot('guards.UNSTICK', UNSTICK);   // (the last snap's man and time are read by the same frame's sweep)
/** Is the nav cell under (x, z) one no plan can leave: blocked itself and all four orthogonal neighbours blocked (the world's edge counting as blocked)? Five
 *  byte reads. A blocked cell with a free neighbour is NOT stranded — A* steps straight into the neighbour and the path's first point is its centre. */
export function strandedAt(g: Game, x: number, z: number): boolean {
  const nav = g.col.nav, cs = nav.cell;
  return nav.isBlocked(x, z) && nav.isBlocked(x + cs, z) && nav.isBlocked(x - cs, z) && nav.isBlocked(x, z + cs) && nav.isBlocked(x, z - cs);
}
/** Can his body be walked straight from `from` to `to`: no leaf across the line, and a circle (UNSTICK_BODY_R) swept along it every 15 cm meets no static in the
 *  movement band (the same knee-to-shoulder band the push-out and the bake use)? A thin ray would thread the slot between two desk backs, or pass under a desk
 *  top between its end panels, and walk him into the wood for a second before the snap; the swept circle answers for what is squarely in his way and leaves
 *  what he merely brushes to the push-out. His own first 15 cm are not asked (he stands where he stands; the frame's push-out has that). */
function legClear(g: Game, from: Vec3, to: Vec3): boolean {
  const col = g.col; const dx = to[0] - from[0], dz = to[2] - from[2]; const L = Math.hypot(dx, dz); if (L < 1e-3) return true;
  if (col.segmentBlockedDynamic([from[0], 0.45, from[2]], [to[0], 0.45, to[2]]) || col.segmentBlockedDynamic([from[0], 1.2, from[2]], [to[0], 1.2, to[2]])) return false;
  const n = Math.ceil(L / 0.15); const q: Vec3 = [0, 0, 0];
  for (let i = 1; i <= n; i++) { const t = i / n; q[0] = from[0] + dx * t; q[1] = 0; q[2] = from[2] + dz * t; if (col.collideCircle(q, UNSTICK_BODY_R, 0.2, 1.5, 1)) return false; }
  return true;
}
/** The free cell centre nearest (as the crow flies) to `from` within `reach` that passes `test`: for the leg ('walk'), one his body can be walked straight to
 *  (legClear — the far side of a partition is near, and no side-step); for the snap ('room'), one in the same room (nothing static across the line at 2 m, over
 *  the furniture and the partitions and under the ceiling: put down past the chair that boxed him in, not through the wall into the next office) — and failing
 *  any in the room, the nearest at all. null: no free cell within reach (or, 'walk', none that walks). */
function freeCellNear(g: Game, from: Vec3, reach: number, test: 'walk' | 'room'): Vec3 | null {
  const nav = g.col.nav, cs = nav.cell; const R = Math.ceil(reach / cs);
  const cx = Math.floor(from[0] / cs), cz = Math.floor(from[2] / cs);
  const cands: { q: Vec3; d: number }[] = [];
  for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
    const x = cx + dx, z = cz + dz; if (x < 0 || z < 0 || x >= nav.W || z >= nav.H || nav.blocked[nav.idx(x, z)]) continue;
    const q: Vec3 = [(x + 0.5) * cs, 0, (z + 0.5) * cs]; const d = v3.distXZ(from, q); if (d <= reach) cands.push({ q, d });
  }
  cands.sort((a, b) => a.d - b.d);   // nearest first: the first that passes is the one (a handful of tests, once, at the start of a leg)
  if (test === 'walk') { for (const c of cands) if (legClear(g, from, c.q)) return c.q; return null; }
  for (const c of cands) if (!g.col.solidBlocked([from[0], 2.0, from[2]], [c.q[0], 2.0, c.q[2]])) return c.q;   // (solid: a cell across an intact glass pane is another room)
  return cands.length ? cands[0].q : null;
}
/** Put him ON the free cell centre `to` (or the nearest free one in the room / at all, failing that) here and now — the last resort, counted and logged, never spoken. */
function unstickSnap(g: Game, gd: Guard, to: Vec3 | null, why: string) {
  const c = gd.char; const p = to ?? freeCellNear(g, c.pos, UNSTICK_SNAP_REACH_M, 'room') ?? g.col.nav.nearestFreePoint(c.pos[0], c.pos[2]);
  if (!p) return;   // (nothing free within rings of him: not a floor this level has)
  LINE_DEBUG.log?.(gd, `UNSTICK snap ${v3.distXZ(c.pos, p).toFixed(2)} m (${c.pos[0].toFixed(2)},${c.pos[2].toFixed(2)}) → (${p[0].toFixed(2)},${p[2].toFixed(2)}): ${why}`);
  c.pos[0] = p[0]; c.pos[2] = p[2]; c.vel = [0, 0, 0]; gd.speed = 0; gd.lastPos = v3.copy(c.pos); gd.stallRef = null; gd.stuckT = 0;
  UNSTICK.snaps++; UNSTICK.lastSnapT = g.time; UNSTICK.lastSnapWho = gd;
}
/** The side-step he has going, if it still means anything: dropped here (null) once he stands on free floor outside its target cell — carried or shoved there,
 *  or walked off by the fight's own footwork — since a plan from where he is will do and there is nothing at the old spot to walk back for. */
function liveLeg(g: Game, gd: Guard): UnstickLeg | null {
  const U = unstickLegs.get(gd); if (!U) return null;
  if (v3.distXZ(gd.char.pos, U.to) > 0.36 && !g.col.nav.isBlocked(gd.char.pos[0], gd.char.pos[2])) { unstickLegs.delete(gd); return null; }
  return U;
}
/** If he stands stranded (strandedAt) and has no side-step going, begin one: the leg to the nearest reachable free cell — or, nothing free within reach, the snap.
 *  Returns 'leg' (one is under way, new or old: followPath / stepAlongPath walk it before anything else), 'snapped' (he has just been moved: plan afresh from
 *  where he now stands) or 'no' (a free cell under him, or one beside it: nothing to do — the common case, five byte reads). */
function unstickBegin(g: Game, gd: Guard): 'leg' | 'snapped' | 'no' {
  const c = gd.char;
  if (liveLeg(g, gd)) return 'leg';
  if (gd.state === 'dead' || gd.held || !strandedAt(g, c.pos[0], c.pos[2]) || g.time < (unstickRetryAt.get(gd) ?? -1)) return 'no';
  const to = freeCellNear(g, c.pos, UNSTICK_REACH_M, 'walk');
  if (!to) {
    unstickSnap(g, gd, null, 'stranded, no free cell within reach he can walk to');
    if (strandedAt(g, c.pos[0], c.pos[2])) { unstickRetryAt.set(gd, g.time + 2); return 'no'; }   // (nowhere within rings of him to put him either — no floor this level has, but a plan failing every frame must not scan for one every frame)
    return 'snapped';
  }
  unstickLegs.set(gd, { to, best: v3.distXZ(c.pos, to), stallT: 0 }); UNSTICK.legs++;
  LINE_DEBUG.log?.(gd, `UNSTICK leg from (${c.pos[0].toFixed(2)},${c.pos[2].toFixed(2)}) to the free cell at (${to[0].toFixed(2)},${to[2].toFixed(2)}), ${v3.distXZ(c.pos, to).toFixed(2)} m`);
  return 'leg';
}
/** One frame of the side-step: straight at the free cell's centre at a walk (his facing left to whoever owns it this frame — a shuffle, not a turn), through the
 *  frame's ordinary push-out below. 'walking' while it lasts; 'done' once he is on it (or has just been snapped onto it after a second of getting no nearer), or
 *  is standing on some OTHER free cell already (the fight's own side-step took him off across free floor once the leg had him over the line: nothing to walk
 *  back for); 'stale' if he has been carried out of reach of it since (a shove, the arm again) — either way the caller drops the leg and plans afresh. */
function unstickStep(g: Game, gd: Guard, U: UnstickLeg, dt: number): 'walking' | 'done' | 'stale' {
  const c = gd.char; const dx = U.to[0] - c.pos[0], dz = U.to[2] - c.pos[2]; const d = Math.hypot(dx, dz);
  gd.lastPos = v3.copy(c.pos);   // (followPath's wedge watchdog measures from here when the plan proper takes over)
  if (d < UNSTICK_DONE_M || (d > 0.36 && !g.col.nav.isBlocked(c.pos[0], c.pos[2]))) return 'done';   // (0.36: outside the target cell altogether — inside it he finishes onto the centre, where he is sure to fit and to plan from)
  if (d > UNSTICK_REACH_M + 0.6) return 'stale';
  if (d < U.best - 0.02) { U.best = d; U.stallT = 0; }
  else if ((U.stallT += dt) > UNSTICK_STALL_SECS) {   // a second of stepping and no nearer: over the line onto free floor already (a colleague standing on the very spot keeps him off its centre) that will do — plan from here; still on blocked floor, the snap
    if (g.col.nav.isBlocked(c.pos[0], c.pos[2])) unstickSnap(g, gd, U.to, `no nearer than ${U.best.toFixed(2)} m in ${UNSTICK_STALL_SECS} s of stepping`);
    return 'done';
  }
  gd.speed = damp(gd.speed, g.tune.guardWalk * clamp(d / 0.3, 0.4, 1), 6, dt);
  const step = Math.min(d, gd.speed * dt); c.pos[0] += dx / d * step; c.pos[2] += dz / d * step; c.vel = [dx / d * gd.speed, 0, dz / d * gd.speed];
  return 'walking';
}
/** The leg ahead of any path-following this frame (followPath, stepAlongPath): walk it if there is one; when it ends, plan the remembered goal afresh from the free
 *  cell (goTo, forced) so the caller carries straight on along a real path. True = the leg had this frame (the caller returns 'not arrived'). */
function unstickFirst(g: Game, gd: Guard, dt: number): boolean {
  const U = unstickLegs.get(gd); if (!U) return false;
  const r = unstickStep(g, gd, U, dt);
  if (r === 'walking') return true;
  unstickLegs.delete(gd);
  const goal = gd.pathGoal; gd.path = []; gd.pathGoal = null;
  if (goal) goTo(g, gd, goal, true);   // (from a free cell now — or, 'stale', from wherever he was carried: goTo looks again and may begin another leg)
  return unstickLegs.has(gd);
}

export function goTo(g: Game, gd: Guard, goal: Vec3, force = false) {
  if (!force && gd.pathGoal && v3.dist(gd.pathGoal, goal) < 0.75 && gd.path.length) return;
  const U0 = liveLeg(g, gd);
  if (U0) { gd.path = [v3.copy(U0.to)]; gd.pathI = 0; gd.pathGoal = v3.copy(goal); gd.repathT = 0; gd.lineSide = 0; return; }   // a side-step off a stranded cell under way: it is finished first (a couple of seconds at most), the goal kept for the plan that follows it (unstickFirst)
  // no route (the fix is inside a wall / a sealed pocket): only fall back to a bee-line when the straight line is actually WALKABLE for a man his width — not merely
  // clear to a thin ray: a ray threads the hand-wide slot between the server racks that his shoulders (just) squeeze through and the nav bake rightly calls shut,
  // and a man bee-lined through it after a noise was marooned in the strip behind the racks for the rest of the night, no route back to anything — otherwise
  // an empty path, which followPath reports as 'arrived' so the state machine moves on (search here) instead of grinding a partition for the rest of the encounter
  const pen = lanePenalty(g, gd, tacticsPenalty(g, gd, goal));   // (pursuit tactics, tactics.ts: kill-zone doorways on his side and a flanker's dear corridor priced into the search — undefined, i.e. plain A*, for nearly everybody and always with tune.tactics off)
  const plan = (): Vec3[] | null => { const from = gd.char.pos; const p = g.col.nav.findPath(from, goal, 6000, pen); if (p) return p; return g.col.nav.walkable(from, goal) && !g.col.solidBlocked([from[0], 0.5, from[2]], [goal[0], 0.5, goal[2]]) ? [v3.copy(goal)] : null; };
  let p = plan();
  if (!p) {   // …unless there is no route because no plan can leave the cell he stands on (un-stick, above): side-step off it first — or, snapped clear of it just now, plan from there
    const u = unstickBegin(g, gd);
    if (u === 'leg') { gd.path = [v3.copy(unstickLegs.get(gd)!.to)]; gd.pathI = 0; gd.pathGoal = v3.copy(goal); gd.repathT = 0; gd.lineSide = 0; return; }
    if (u === 'snapped') p = plan();
  }
  gd.path = g.doors.threadPath(p ?? [], gd.char.pos, (x, z) => !g.col.nav.isBlocked(x, z)); gd.pathI = 0; gd.pathGoal = v3.copy(goal); gd.repathT = 0;
  gd.lineSide = 0;   // (whatever this path is, it is not the fight's side-step round a colleague — lineStep knows its own by that)
}

/** HOW THE TEAM CARRIES ITSELF. A teammate (an operative unit, while the room fight is live — a scenario, never a showcase's cast) is a man with a rifle and a
 *  plate carrier: `max` is the most his legs are ever asked for, whoever asks (an order's leg, a drill's flow, the fight AI's chase, a step off a doorway) — a
 *  purposeful walk with some jog in it, none of the sprint clip (character.ts BLEND: the walk carries to 1.6 m/s, the sprint starts past 2.7) — and he LEANS INTO a
 *  move: his speed rises by no more than `accel` m/s² (he stops as crisply as ever: a man arriving on a mark is on it). And his GUN TRAVELS: the runner
 *  (squad.ts) put a scripted man's muzzle on its aim point the frame the point changed — an order given, a corner checked, the fight's own read taking over
 *  from behind his shoulder: a rifle, a head and a weapon light's cone through 60‥150° in one frame, a few times a minute per man (tools/qa/playthrough.ts
 *  counted them) — now it comes round to a point an ORDER (or the unasked cover) gives it at `turn` rad/s at most (0 = on the point at once, as it was): 8 is
 *  the operatives' own body turn (roomfight.ts FIGHT_SKILL.operative.turn) — a quarter turn in a fifth of a second. A point his own EYES have given him
 *  (GuardScript.over: the room fight's read, which eases itself — roomfight.ts point()) is not slowed: throttled too, the pair lost three more rooms in six.
 *  What that point may not do is TELEPORT: when it passes behind his back the waist's twist clamp flips from one shoulder to the other, 150° and more in a
 *  frame — that crossing is swung through his front at `swing` rad/s (0 = the flip, as it was; 30 is a half turn in a tenth of a second).
 *  `on` false = everybody as they were. */
export const PACE = { on: true, max: 2.2, accel: 2.6, turn: 8, swing: 30 };
/** LIGHT DISCIPLINE (the maintainer, 10-05, off the merged build: "friendlies also need to have flashlight discipline"): a teammate under one of Sam's orders in
 *  a live room fight burns his weapon light only while it helps — while he SEARCHES (the order sent him into a room or has him slicing one from outside, and
 *  he has not yet stood on his mark with nothing new to look at for `afterSecs`), while his own eyes have his gun (roomfight's read: a man seen, a look at a
 *  shot or a call), while the fight AI has him, and for `hotSecs` after a shot, a charge or a boot last reached his ears (never that last while he is posted
 *  on a door he has not gone through: light under a door is the knock), for `stepSecs` after an ENEMY's footfall reached them along open air (roomfight's
 *  Op.stepT — a man holding a room in the dark, or stacked with his back to a corridor, hears the man coming and lights him), and while he WALKS SOMEWHERE ON HIS OWN — to a mark an order gave him, more than
 *  `onM` from it yet, or back to Sam from more than `aloneM` away: a man's eyes are what his light is on (sightGainOn), and a pair sent down a dark corridor
 *  to a door with their lights off walked up to the man standing in it and were shot at the stack (rescue-probes, seed 14). In file behind Sam, on his mark,
 *  stacked on a door, holding a corridor: dark (it was: on from the first entry and never off again — on the next door's stack, in every file after).
 *  `tail` keeps it from flickering. Off (`on` false): the light as the order's flag and the unit's switch have it, as it was. Men a drill or the rescue's flow
 *  moves (no order of Sam's on them) are not ruled: their lights are the drill's. */
export const LIGHTS = { on: true, afterSecs: 2.5, hotSecs: 5, stepSecs: 4, tail: 0.6, onM: 0.8, aloneM: 7,
  /** a man on his mark with his gun up who stands LIT himself (his own meter ≥ lookLit) and looks into the DARK (the floor along his gun, out to lookM or the
   *  first wall, under lookDark with the team's own lights left out) burns his light: the dark hides only the other side. Off = dark on every hold, as it was —
   *  four men holding a lit room were shot from a dark doorway eight metres off by a man none of them could see. SHIPS OFF, a row to try: it keeps a man
   *  holding a taken room lit for as long as he holds (the hold is meant to be dark, and a lit man is seen), it reads the floor by the CPU's direct-light
   *  estimate (no bounce, no moon) where everything else a man does by light goes by the meter, and two lit mates can keep each other's lights on */
  lookDark: false, lookLit: 0.25, lookBelow: 0.12, lookM: 10,
  /** THE PLACE DECIDES (the footage: lights off in lit halls and rooms whatever the men are doing, on in the dark): a man who stands on lit floor with lit
   *  floor all along his gun — every metre out to `litM` (his light's reach) or the first wall, and every third metre down both edges of its cone — whose man,
   *  if his eyes have one, stands lit, and whose mark, if he is within `litMarkM` of one he is walking to, is lit: every sample at `litAt` or brighter on the
   *  meter's scale, nothing anybody carries counted. He keeps his light off for every reason above: it shows him nothing the room's lights do not, and pointed
   *  at an enemy's eyes it shows the enemy him (roomfight.ts lampGlare). One dark sample — a doorway onto a dark room, the corner a metre inside it, the pod an
   *  entry is sending him to — and the rule above has it again. `litAt` 0.5 is where a standing man is a sighting to cold eyes at nine metres by the room's
   *  light alone (sightGainOn); under it the weapon light is what shows him. Read off the CPU's direct-light estimate (no bounce: it errs dark, so toward
   *  the light on). false = lit or dark, the same rule, as it was */
  litOff: true, litAt: 0.5, litM: 15, litMarkM: 6,
  /** DARK ON A LIT MAN (one switch, two halves — each measured to cost men without the other, so there is no row for either alone): while his eyes have a
   *  man who stands lit by the place itself (`litAt` or brighter; nothing anybody carries and no flash, tracer, lightning or turning beacon counted) and he himself stands in the dark (under
   *  `litAt` the same way), (1) his weapon light stays off: the man is plain to see without it, and from the dark the lens is the one thing that would show
   *  the man where he is (roomfight.ts lampGlare); and (2) if he is WALKING on an order with Sam in his line to that man — his gun down for it — his feet wait
   *  where he is, in the dark, until the line is clear (roomfight.ts holdShort, ROOMFIGHT.holdShortSecs at most a hold; only a walk that CLOSES on the man —
   *  an order that takes him away from him is walked) instead of carrying him, gun lowered, up into the man's light. The rule above (`litOff`) wants his own floor lit too; this is the other side of it: a man in a dark room with an enemy under a
   *  lamp outside the door shoots from the dark. Asked four times a second per man with a man in his eyes (or, for the light alone, out of them for under a
   *  second and a half: the blink roomfight.ts keeps his aim through — the walk is held only with the man in his eyes); the light is the other
   *  rules' again the frame he has no such man, the walk within a quarter of a second. The estimate is the CPU's direct light with no bounce and no moon: it errs toward calling HIM dark. No range limit, by measurement: held to the nine metres `litAt` is a sighting at, his light came up from the dark on the far man and the lens gave him away (624 against 653 of 864 teammates up over 432 night breaches). false = as it was: sent on
   *  past Sam at a man under a lamp, his light came up with the word and he walked at him with his gun down (the night breach's last hunt) */
  litMan: true,
  /** NOT INTO THE WALL AT HIS MUZZLE (wallDark, below, has the rule): `wallOff` the switch — off here, on in the page (host/profile.ts; ?walllight=0 puts it
   *  off) · `wallM` how near the whole beam must end for the light to go dark, `wallBackM` how far any ray must run clear for it to burn again, `wallSecs`
   *  how long the beam must have ended that near before it goes dark */
  wallOff: false, wallM: 1.5, wallBackM: 1.9, wallSecs: 0.3 };
const litSeen = new SideMap<Guard, { t: number; lit: boolean; A: unknown; tgt: unknown }>('guards.litSeen');
/** is where he stands, what his gun is on, the man he has and the mark he is nearly at lit by the place itself (LIGHTS.litOff; asked twice a second per man,
 *  and again at once on a new order or a new man) */
function litPlace(g: Game, gd: Guard, A: ReturnType<Game['orders']['of']>, tgt: Guard | null, pt: Vec3 | null): boolean {
  if (!LIGHTS.litOff) return false;
  const key = tgt ?? (pt ? 'pt' : null), was = litSeen.get(gd); if (was && was.A === A && was.tgt === key && g.time - was.t >= 0 && g.time - was.t < 0.5) return was.lit;
  const c = gd.char, eye: Vec3 = [c.pos[0], 1.5, c.pos[2]];
  const carried = () => true;   // (the place's own lights only: nothing anybody carries)
  const dark = (x: number, z: number) => g.visibilityOf(lightEstimateAt(g, [x, 1.2, z], carried)) < LIGHTS.litAt;
  let lit = !dark(c.pos[0], c.pos[2]);
  if (lit && tgt) lit = !dark(tgt.char.pos[0], tgt.char.pos[2]);
  if (lit && pt) lit = !dark(pt[0], pt[2]);
  if (lit && A?.post && !A.arrived && v3.distXZ(c.pos, A.post) < LIGHTS.litMarkM) lit = !dark(A.post[0], A.post[2]);
  for (const [off, step] of [[0, 1], [-0.2, 3], [0.2, 3]]) { if (!lit) break; const fx = Math.sin(c.aimYaw + off), fz = Math.cos(c.aimYaw + off);
    for (let r = step; r <= LIGHTS.litM + 1e-6; r += step) { const P: Vec3 = [eye[0] + fx * r, 1.2, eye[2] + fz * r]; if (g.col.segmentBlocked(eye, P)) break;
      if (dark(P[0], P[2])) { lit = false; break; } } }
  litSeen.set(gd, { t: g.time, lit, A, tgt: key }); return lit;
}
const darkSeen = new SideMap<Guard, { t: number; dark: boolean }>('guards.darkSeen');
/** is what his gun is on dark, him lit (LIGHTS.lookDark; asked twice a second per man) */
function looksIntoDark(g: Game, gd: Guard, A: ReturnType<Game['orders']['of']>): boolean {
  if (!LIGHTS.lookDark || !A || !A.arrived || !A.post || gd.muzzleDown || A.low || gd.visibility < LIGHTS.lookLit) return false;
  if (!(A.search || A.order === 'hold' || A.order === 'cover') || gd.script?.upper === 'none') return false;   // (men an entry left in a room, men Sam posted: never a stack, never the file)
  const was = darkSeen.get(gd); if (was && g.time - was.t >= 0 && g.time - was.t < 0.5) return was.dark;
  const c = gd.char, eye: Vec3 = [c.pos[0], 1.5, c.pos[2]], fx = Math.sin(c.aimYaw), fz = Math.cos(c.aimYaw); let dark = false;
  const ours = (owner: number) => g.guards.some(x => x.char.id === owner && x.team === 'operative') || owner === g.player.char.id;
  for (let r = 4; r <= LIGHTS.lookM + 1e-6; r += 3) { const P: Vec3 = [eye[0] + fx * r, 1.2, eye[2] + fz * r]; if (g.col.segmentBlocked(eye, P)) break;
    if (g.visibilityOf(lightEstimateAt(g, P, ours)) < LIGHTS.lookBelow) { dark = true; break; } }
  darkSeen.set(gd, { t: g.time, dark }); return dark;
}
/** what the rule itself last made of his place, while that reading is fresh (QA: the probes judge a dark light by it) */
export function placeLitSeen(g: Game, gd: Guard): boolean { const s = litSeen.get(gd); return LIGHTS.litOff && !!s && g.time - s.t >= 0 && g.time - s.t < 0.5 + 1e-6 && s.lit; }
const litUntil = new SideMap<Guard, number>('guards.litUntil');
const WALL_BREAK = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.WALLLIGHT_BREAK === '1';   // (QA: the rule's own check must fail with this set)
const wallSeen = new SideMap<Guard, { t: number; since: number; dark: boolean }>('guards.wallSeen');
/** seven directions across a beam about `d` (game.ts tune.flashOuter is 19 degrees): its axis, four turned about the vertical, one tipped up and one down */
function beamFan(d: Vec3): Vec3[] {
  const out: Vec3[] = []; for (const a of [0, -0.17, 0.17, -0.33, 0.33]) { const c = Math.cos(a), k = Math.sin(a); out.push([d[0] * c + d[2] * k, d[1], d[2] * c - d[0] * k]); }
  for (const e of [-0.3, 0.3]) out.push(v3.normalize([d[0], d[1] + e, d[2]])); return out;
}
/** LIGHTS.wallOff (the maintainer, 10-22, off the first tutorial mission: "weird that they are shining the flashlight on the wall immediately in front of
 *  them"): a teammate's weapon light is dark while its WHOLE beam ends on something solid within `wallM` of the lens — the wall he walks up to a stack along,
 *  the truck he kneels behind, the dirt at his knee. Such a light shows him nothing and is the brightest thing in the picture. Asked of the beam as posed
 *  this frame (the lens — where it will burn: this side of a wall it is pressed through — and where the gun points): the axis and six
 *  rays across the cone must ALL end inside `wallM` — a jamb met edge-on with the room open beyond it to part of the cone is not a wall, and that light
 *  burns. It goes dark once that has held `wallSecs` (a muzzle swept past a corner does not blink) and burns again the frame any ray runs clear to
 *  `wallBackM` (the door opens: the room is lit at once). The other rules still decide whether he wants a light at all; this one only says it would be
 *  wasted — and with anybody who is not of his side standing in the beam this side of the wall it is not: that light burns. Whoever is not one of Sam's
 *  team is never asked. Off: the light as those rules have it, as it was. */
function wallDark(g: Game, gd: Guard, held: Vec3 | undefined): boolean {
  if (!LIGHTS.wallOff || WALL_BREAK || gd.team !== 'operative' || !gd.unit || gd.state === 'dead' || !held) return false;
  const p = gd.flashlight.pos, d = gd.flashlight.dir, t = g.time;
  const o = g.col.segmentBlocked(held, p) ? lensClear(g, held, p, g.engine.settings.flashlightRadius) : p, fan = beamFan(d);   // (a lens carried through the wall he stands at lights from this side of it — attachFlashlight, lighting.ts: asked from where it will burn)
  const hl = Math.hypot(d[0], d[2]) || 1, manIn = (m: number) => g.guards.some(x => { if (x === gd || x.state === 'dead' || x.team === 'operative') return false;   // (somebody not of his side in the beam, this side of what it ends on: a light with a man in it is not wasted — the walls are asked of the statics only)
    const vx = x.char.pos[0] - o[0], vz = x.char.pos[2] - o[2], l = Math.hypot(vx, vz); return l < m + 0.5 && (l < 0.3 || (vx * d[0] + vz * d[2]) / (l * hl) > 0.9); });
  const ends = (m: number) => fan.every(r => g.col.segmentBlocked(o, [o[0] + r[0] * m, o[1] + r[1] * m, o[2] + r[2] * m])) && !manIn(m);
  const was = wallSeen.get(gd), s = was && t >= was.t && t - was.t <= 0.25 ? was : { t, since: t - LIGHTS.wallSecs, dark: false };   // (no reading a moment ago — a fresh man, a clock put back: this frame's reading stands at once)
  const near = ends(s.dark ? LIGHTS.wallBackM : LIGHTS.wallM), since = near ? s.since : t, dark = near && (s.dark || t - since >= LIGHTS.wallSecs - 1e-9);
  wallSeen.set(gd, { t, since, dark }); return dark;
}
const TORCH_WALL_BREAK = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.TORCHWALL_BREAK === '1';   // (QA: the rule's own check must fail with this set)
const torchLowSeen = new SideMap<Guard, { t: number; low: boolean }>('guards.torchLowSeen');
/** TORCH.wallLow (calmtorch.ts; the maintainer, 10-22, off the stealth tutorial: "another example of character shining flashlight at a small point in front
 *  of them. feels a bit weird but i'm not sure what the natural thing is here"): a man carrying a HAND torch — a patrol, a man gone to look — whose beam, as
 *  the relaxed carry would point it (his heading and chest, his aim's pitch), would end whole on something solid within `wallM` of his hand has nothing in
 *  front of him to light: he lets the torch hang, its beam on the floor at his feet, until the carry runs clear to `wallBackM` again (he has turned, or
 *  walked on). Asked of the carry's own direction, never of the tipped beam (which always ends on the floor), so the answer does not chase itself. A weapon
 *  light is not a hand torch and is never asked: it points where the gun points. Off: the carry as it was. */
function torchLow(g: Game, gd: Guard): boolean {
  if (!(TORCH.wallLow || TORCH.wallDark) || TORCH_WALL_BREAK) return false;
  const c = gd.char, hand = c.bones.handR, t = g.time; if (!hand) return false;
  const d = torchCarryWant(c), was = torchLowSeen.get(gd), low0 = !!was && t >= was.t && t - was.t <= 0.25 && was.low, m = low0 ? TORCH.wallBackM : TORCH.wallM;
  const low = beamFan(d).every(r => g.col.segmentBlocked(hand, [hand[0] + r[0] * m, hand[1] + r[1] * m, hand[2] + r[2] * m]));
  torchLowSeen.set(gd, { t, low }); return low;
}
/** what TORCH.wallLow last made of his carry, while that reading is fresh (QA) */
export function torchLowSeenOf(g: Game, gd: Guard): boolean { const s = torchLowSeen.get(gd); return !!s && g.time - s.t >= 0 && g.time - s.t <= 0.25 && s.low; }
/** what LIGHTS.wallOff last made of his beam, while that reading is fresh (QA: the probe judges the rule by it) */
export function wallDarkSeen(g: Game, gd: Guard): boolean { const s = wallSeen.get(gd); return LIGHTS.wallOff && !!s && g.time - s.t >= 0 && g.time - s.t <= 0.25 && s.dark; }
/** is this man's weapon light this rule's to decide */
export function lightRuled(g: Game, gd: Guard): boolean { return LIGHTS.on && gd.team === 'operative' && !!gd.unit && fightLive(g) && !!g.orders.of(gd); }
const litManSeen = new SideMap<Guard, { t: number; tgt: Guard; v: boolean }>('guards.litManSeen');
/** LIGHTS.litMan: the man his eyes have stands lit by the place, he himself in the dark */
function darkOnLitMan(g: Game, gd: Guard, tgt: Guard): boolean {
  const was = litManSeen.get(gd); if (was && was.tgt === tgt && g.time - was.t >= 0 && g.time - was.t < 0.25) return was.v;
  const carried = () => true, lit = (p: Vec3) => g.visibilityOf(lightEstimateAt(g, [p[0], 1.2, p[2]], carried, true)) >= LIGHTS.litAt;   // (steady lights only: the flash of a round landing by him — nobody's light, a twentieth of a second — lit him 'by the place', and the team's lights went dark on a man standing in the dark)
  const v = lit(tgt.char.pos) && !lit(gd.char.pos);
  litManSeen.set(gd, { t: g.time, tgt, v }); return v;
}
/** LIGHTS.litMan, asked of a teammate the light rule has: is he, this frame, in the dark on a man who stands lit (the man he is on, or was until a blink ago:
 *  roomfight.ts keeps his aim through that — a jamb passed, a leaf swung — and his light does not come back in it, unless something else has turned him) */
export function onLitMan(g: Game, gd: Guard): boolean {
  if (!LIGHTS.litMan || !lightRuled(g, gd)) return false;
  const O = g.fight.opOf(gd), t = g.time; if (!O) return false;
  const man = O.tgt ?? (!O.turn && gd.script && O.kept && O.kept.h.state !== 'dead' && t - O.kept.t >= 0 && t - O.kept.t < 1.5 ? O.kept.h : null);   // (not while a cue has him turning to somebody else, nor once the fight is the alert AI's: the light is the other rules' then)
  return !!man && darkOnLitMan(g, gd, man);
}
/** does it burn this frame (asked only of a man the rule has: lightRuled) */
export function teamLit(g: Game, gd: Guard): boolean {
  if (onLitMan(g, gd)) return false;
  const t = g.time, A = g.orders.of(gd), O = g.fight.opOf(gd);
  const want = (!gd.script && (gd.state === 'alert' || gd.state === 'search')) || !!gd.script?.over || (!!O && (!!O.tgt || !!O.turn || (t - O.hotT < LIGHTS.hotSecs && !(A && A.door && !A.search))))
    || (!!A && !!A.search && !(A.arrived && t - Math.max(A.arrT, A.searchT ?? -Infinity) > LIGHTS.afterSecs))
    || (!!O && t - O.stepT < LIGHTS.stepSecs)
    || (!!A && (A.post ? v3.distXZ(gd.char.pos, A.post) > LIGHTS.onM : v3.distXZ(gd.char.pos, g.player.char.pos) > LIGHTS.aloneM))
    || looksIntoDark(g, gd, A);
  if (want && !litPlace(g, gd, A, O?.tgt ?? null, O?.turn?.pt ?? null)) litUntil.set(gd, t + LIGHTS.tail);
  const u = litUntil.get(gd); return u !== undefined && t < u && u - t <= LIGHTS.tail + 1e-6;   // (a stamp from a clock since put back is no reason)
}
/** is this man one of the team whose pace PACE governs right now */
export function teamPaced(g: Game, gd: Guard): boolean { return PACE.on && gd.team === 'operative' && !!gd.unit && fightLive(g); }
/** the speed his legs may be asked for (PACE.max for the team; anybody else: as asked) */
export function teamPace(g: Game, gd: Guard, speed: number): number { return conditionPace(g, gd, silentPace(g, gd, teamPaced(g, gd) ? Math.min(speed, teamCap(g, gd)) : speed)); }   // (… and a SILENT squad's walk under that: silent.ts)
/** the speed his legs GET for a leg asked at `speed` (already teamPace's): × what his card weighs (kitload.ts) — on top of the caps, which so scale with the
 *  man (a light man is the quieter one too). teamPace is a cap and may be asked twice; this is a factor — ONE call a leg, where the leg is walked
 *  (followPath, stepAlongPath, a scripted man's strafe and settle). As asked for a man with nothing weighed on him */
export function teamLegs(g: Game, gd: Guard, speed: number): number { return teamRunLegs(g, gd, speed) ?? loadPace(g, gd, speed); }   // (teampace.ts: at a run a card weighs as it does on the player's sprint — null with its switch off)
/** where his muzzle is this frame, wanting yaw `to`: the team's comes round at PACE.turn, and round his FRONT (eased against the body's own yaw, inside the
 *  runner's twist limit: the short way to a point behind him lies across his back, where the limit would hold the gun on the wrong shoulder); anybody else's is on it */
export function teamTurn(g: Game, gd: Guard, to: number, dt: number): number {
  const c = gd.char; if (!(PACE.turn > 0) || !teamPaced(g, gd)) return to;
  const rel = wrapAngle(c.aimYaw - c.bodyYaw), want = clamp(wrapAngle(to - c.bodyYaw), -1.5, 1.5), step = PACE.turn * loadPaceOn(g, gd) * dt;   // (kitload.ts: a heavy man's muzzle comes round the slower)
  return c.bodyYaw + (Math.abs(want - rel) <= step ? want : rel + Math.sign(want - rel) * step);
}
/** his speed this frame, having been `was` last frame: the team picks pace up at PACE.accel at most */
export function teamLean(g: Game, gd: Guard, was: number, dt: number) { if (gd.speed > was && teamPaced(g, gd)) gd.speed = Math.min(gd.speed, was + teamAccel(g, gd) * loadPaceOn(g, gd) * dt); }   // (kitload.ts: … and by what he carries)

export function followPath(g: Game, gd: Guard, dt: number, speed: number): boolean { // returns true when arrived
  const c = gd.char; speed = teamLegs(g, gd, teamPace(g, gd, speed));   // (… × his card: kitload.ts, here and nowhere above — a caller hands in the pace it asks for)
  if (unstickFirst(g, gd, dt)) return false;   // a side-step off a stranded cell comes first (un-stick, above); the frame it ends the goal is planned afresh and walked from here on
  if (g.tune.tactics && !runnerFled(gd) && doorGate(g, gd, dt, speed)) return false;   // pursuit tactics (tactics.ts): a kill-zone doorway ahead on this path — he stacks on the jamb, calls it, waits for a second man and they take it as a drill; the gate has his feet meanwhile (false at once for everybody else)
  if (LANES.on && !runnerFled(gd) && laneGate(g, gd)) return false;   // a lane that cost them (lanes.ts): his way lies down floor his side knows a gun covers — re-planned at the lane's price, and with no way round he is stopped short of it (false at once for everybody but a room fight's defenders with a lane known)
  if (handleGate(g, gd, dt, speed)) return false;   // the handle side (handleside.ts): a leaf in his way that opens toward him — he goes to its latch jamb, clear of its swing, and pulls it from there; the gate has his feet meanwhile (false at once with HANDLE.on off, and with the one-way doors off)
  if (DOORMANNERS.on && !runnerFled(gd)) { const sp = doorwayGate(g, gd, dt, speed); if (sp === null) return false; speed = sp; }   // doorway manners (doorway.ts): one of his side in the frame ahead, or just in front of him by a door — he follows at a gap, or waits off a jamb; null = the wait has his feet
  if (DARKDOOR.on && !runnerFled(gd)) { const sp = darkDoorGate(g, gd, dt, speed); if (sp === null) return false; speed = sp; }   // not in there alone (darkdoor.ts): a green man, alarmed and alone, at the doorway of a dark room — he stops beside the frame and waits for a mate; null = the wait has his feet (his pace back at once for everybody else, and with morale off)
  // progress watchdog: if we wanted to move but barely did (wedged on a prop corner / door edge), sidestep, then repath
  const moved = Math.hypot(c.pos[0] - gd.lastPos[0], c.pos[2] - gd.lastPos[2]); gd.lastPos = v3.copy(c.pos);
  if (gd.speed > 0.3 && moved < gd.speed * dt * 0.25) gd.stuckT += dt; else gd.stuckT = Math.max(0, gd.stuckT - dt * 2);
  if (gd.stuckT > 0.7 && gd.pathI < gd.path.length) {
    const wp = gd.path[gd.pathI]; const dx = wp[0] - c.pos[0], dz = wp[2] - c.pos[2]; const d = Math.hypot(dx, dz) || 1;
    const side = (gd.stuckN++ & 1) ? 1 : -1; const px = -dz / d * side, pz = dx / d * side;
    const cand: Vec3 = [c.pos[0] + px * 0.7 + dx / d * 0.2, 0, c.pos[2] + pz * 0.7 + dz / d * 0.2];
    if (!g.col.nav.isBlocked(cand[0], cand[2])) gd.path.splice(gd.pathI, 0, cand);
    else if (gd.pathGoal) { const goal = gd.pathGoal; gd.pathGoal = null; goTo(g, gd, goal, true); }
    gd.stuckT = 0;
  }
  while (gd.pathI < gd.path.length) {
    const wp = gd.path[gd.pathI]; const d = Math.hypot(wp[0] - c.pos[0], wp[2] - c.pos[2]);
    if (d < (gd.pathI === gd.path.length - 1 ? 0.25 : 0.45)) { gd.pathI++; continue; }
    const dir: Vec3 = [(wp[0] - c.pos[0]) / d, 0, (wp[2] - c.pos[2]) / d];
    // slow down when facing away from the movement direction and near the goal
    const yawTo = Math.atan2(dir[0], dir[2]); const facing = Math.cos(wrapAngle(yawTo - c.bodyYaw));
    const remaining = d + (gd.path.length - 1 - gd.pathI) * 1.0;
    const tgtSpeed = speed * clamp(facing * 1.5, 0.15, 1) * clamp(remaining / 0.8, 0.35, 1);
    const was = gd.speed; gd.speed = damp(gd.speed, tgtSpeed, 4, dt); teamLean(g, gd, was, dt);
    c.bodyYaw = approachAngle(c.bodyYaw, yawTo, 5.5 * dt);
    c.vel = [Math.sin(c.bodyYaw) * gd.speed, 0, Math.cos(c.bodyYaw) * gd.speed];
    c.pos = v3.mad(c.pos, c.vel, dt);
    return false;
  }
  gd.speed = damp(gd.speed, 0, 10, dt); c.vel = [0, 0, 0];
  return true;
}

// ------------------------------------------------------------ the search that reasons about darkness
// A man dropping to 'search' round a fix used to sweep from where he stood and then wander to a couple of random points three metres off it. Now he deals himself
// the places round the fix a man would actually hide in — floor hard against walls and in corners (nav cells with statics about them), the wells behind desks
// and chairs and cartons (cells beside props), the pocket behind a leaf standing open, the far side of a partition from the fix, and a few spots of open floor
// as controls — and visits them best-first by DARK × COVER × PLAUSIBLE, sweeping his light INTO each as he comes up to it: dark as the RENDERER has it (the
// same GPU irradiance queries the light meter is made of, mapped through the meter's own curve — a spot dark for the meter is dark for him), cover from what
// stands about the cell, plausible = Sam could have got there from the fix at a sprint in the time since it was placed (not through a leaf locked against him,
// and through one standing latched again only once there has been time to ease it, slip through and let it swing to). Two men searching split the spots
// between them over the net (nobody takes a spot a colleague is on or has looked into). Headless (the QA harness) no reading ever arrives: every spot stays
// at 'no idea' (0.5) and the order falls to cover and plausibility — the old behaviour, better aimed.
/** hide spots are dealt within this many metres' walk of the fix; cover spots + open-floor controls (≤ 16); no two nearer each other than SPACING */
const SEARCH_RADIUS_M = 9, SEARCH_SPOTS = 12, SEARCH_CONTROLS = 3, SEARCH_SPACING_M = 1.5;
/** the first look round from where he stands (also the light readings' head start); the torch held into a spot on arrival; how near, with the spot in plain
 *  sight of his eyes, counts as 'at' it (he looks into a corner from the mouth of it, not standing on it) */
const SEARCH_SWEEP0_SECS = 1.2, SEARCH_LOOK_SECS = 1.5, SEARCH_LOOK_DIST_M = 1.9;
/** the search never ends before MIN (the old fixed length) and never runs past CAP; between the two it ends when the plan is done (spots all looked into or none
 *  left worth the walk); plausibility (the flood) is re-worked every REFLOOD seconds — leaves open and shut, and time passes */
const SEARCH_MIN_SECS = 12, SEARCH_CAP_SECS = 26, SEARCH_REFLOOD_SECS = 2;
/** light queries per frame across ALL searchers (the meter itself spends 2 + a smoke segment per living guard of the probe's 32), read half a metre off the
 *  floor (a crouched man's chest; the shade under a desk top); a reading lives WINDOW seconds and the darkest live one counts — a torch sweeping past lights a
 *  spot for a moment, three seconds of torch on it is a man looking into it */
const PROBE_BUDGET = 8, PROBE_HEIGHT = 0.5, DARK_WINDOW_SECS = 3;
/** what slipping through a leaf that stands LATCHED again now would have cost Sam: ease it off the latch, through, and the closer's swing back till it catches
 *  (doors.ts: ~1 s to crack, 2 s untouched before the closer, ~2 s of swing) — inside that of the loss, nobody is behind that door */
const LATCH_SECS = 5.5;
/** a spot Sam could not QUITE have reached yet is not nothing (the fix itself is a guess): full weight up to SLACK past what a sprint allows, fading over RAMP */
const PLAUS_SLACK_SECS = 1.2, PLAUS_RAMP_SECS = 2.5;

export interface SearchSpot {
  pos: Vec3; cell: number; key: string;
  /** what makes it a hiding place: three statics about it / one or two / a chair, carton, plant or bin beside it / an open leaf to stand behind / plain floor (control) */
  kind: 'corner' | 'wall' | 'prop' | 'leaf' | 'open';
  /** out of sight of the fix (a partition, a desk, a jamb between): where a man who ducked away from THERE would be */
  hidden: boolean;
  cover: number;   // 0‥1 from the above
  dark: number;    // 0‥1: 1 − the meter's visibility for the irradiance read there (0.5 while nothing has been read)
  /** the irradiance behind `dark` (W/m², darkest reading inside the window) — undefined = no reading (headless, or not asked yet) */
  E: number | undefined;
  need: number;    // seconds Sam needs to get here from the fix at a sprint, doors included (Infinity: not from there he didn't)
  plaus: number; score: number;
  visited: boolean; by: number;   // by: char id of the man who looked into it (or whose look covered it), −1
  unreachable: boolean;           // he could not get to it (three seconds of no headway): counts as done
  samples: { t: number; E: number }[];
}
export interface SearchPlan {
  fix: Vec3; t0: number;          // the fix it was dealt round and when that fix was placed (Guard.fixT: how long Sam has had)
  serial: number; builtAt: number; floodAt: number;
  spots: SearchSpot[]; current: number;   // index of the spot he is walking to / looking into, −1
  phase: 'sweep' | 'walk' | 'look' | 'done'; phaseT: number;
  visits: number; rr: number; said: boolean;
}

/** the doorway cells of every door: nav cell index → the door whose closed frame line runs through it (worked out once per level; doors do not move) */
const doorCellsOf = new SideMap<Game, Map<number, Door>>('guards.doorCellsOf');
export function doorCells(g: Game): Map<number, Door> {
  let M = doorCellsOf.get(g); if (M) return M;
  M = new Map(); const nav = g.col.nav;
  for (const d of g.doors.list) {
    const [hx, hz] = d.def.hinge, ux = Math.cos(d.def.closedDir), uz = Math.sin(d.def.closedDir);
    for (let a = 0.1; a < d.def.width - 0.05; a += 0.2) for (const off of [0, 0.18, -0.18]) {   // (a hair either side of the line too: a frame line lying exactly on a cell edge must still own a cell)
      const x = hx + ux * a - uz * off, z = hz + uz * a + ux * off; if (nav.isBlocked(x, z)) continue;
      M.set(nav.idx(Math.floor(x / nav.cell), Math.floor(z / nav.cell)), d);
    }
  }
  doorCellsOf.set(g, M); return M;
}
/** Dijkstra over the nav grid outward from `from`, in SECONDS of Sam's sprint: a step costs its metres over the sprint speed; stepping INTO a doorway cell whose
 *  leaf stands latched costs LATCH_SECS on top — or everything, if that leaf is locked against the side he would come at it from (no key; a pick is four loud
 *  seconds, a kick a gunshot's worth of noise: neither is vanishing). `keyed` (a guard's own walk): doors cost nothing and stop nobody. Not expanded past `maxM`
 *  metres of path. secs / metres per cell, Infinity = not reached. */
function floodFrom(g: Game, from: Vec3, maxM: number, keyed = false): { secs: Float32Array; metres: Float32Array } {
  const nav = g.col.nav, W = nav.W, H = nav.H, N = W * H, cs = nav.cell; const sprint = Math.max(1, g.tune.playerSprint * loadSprintOn(g));   // (kitload.ts: as fast as his card lets him run)
  const secs = new Float32Array(N).fill(Infinity), metres = new Float32Array(N).fill(Infinity); const closed = new Uint8Array(N);
  const DC = doorCells(g);
  let sx = Math.floor(from[0] / cs), sz = Math.floor(from[2] / cs);
  if (sx < 0 || sz < 0 || sx >= W || sz >= H) return { secs, metres };
  if (nav.blocked[nav.idx(sx, sz)]) { const p = nav.nearestFreePoint(from[0], from[2]); if (!p) return { secs, metres }; sx = Math.floor(p[0] / cs); sz = Math.floor(p[2] / cs); }
  const start = nav.idx(sx, sz); secs[start] = 0; metres[start] = 0;
  const open: number[] = [start];
  while (open.length) {
    let mi = 0; for (let i = 1; i < open.length; i++) if (secs[open[i]] < secs[open[mi]]) mi = i;   // (linear pop-min, as findPath: a few hundred live entries at most)
    const cur = open[mi]; open[mi] = open[open.length - 1]; open.pop();
    if (closed[cur]) continue; closed[cur] = 1;
    if (metres[cur] > maxM) continue;
    const cx = cur % W, cz = (cur / W) | 0; const curDoor = DC.get(cur);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue; const nx = cx + dx, nz = cz + dz;
      if (nx < 0 || nz < 0 || nx >= W || nz >= H) continue;
      const ni = nav.idx(nx, nz); if (nav.blocked[ni] || closed[ni]) continue;
      if (dx && dz && (nav.blocked[nav.idx(cx + dx, cz)] || nav.blocked[nav.idx(cx, cz + dz)])) continue;   // no corner cutting (as findPath)
      const step = (dx && dz ? Math.SQRT2 : 1) * cs; let extra = 0;
      const d = keyed ? undefined : DC.get(ni);
      if (d && d !== curDoor && d.latched) {   // onto a doorway whose leaf is shut: from which face?
        if (d.locked && !d.lockBroken && g.doors.side(d, [(cx + 0.5) * cs, 0, (cz + 0.5) * cs]) === d.keySide) continue;   // locked against him from there: not this way
        extra = LATCH_SECS;
      }
      const ns = secs[cur] + step / sprint + extra;
      if (ns < secs[ni]) { secs[ni] = ns; metres[ni] = metres[cur] + step; open.push(ni); }
    }
  }
  return { secs, metres };
}

/** Deal the plan's spots round P.fix (see the block comment): flood for reach and time, count what stands about every reached cell (blocked neighbours = statics,
 *  props within reach, an open leaf beside it), keep the best-covered forty a spacing apart, ask the sight line from the fix for those (hidden = the far side of
 *  something), take the top SEARCH_SPOTS by cover and up to SEARCH_CONTROLS well-spread cells of open floor. Keys srch:<guard>:<i>, stale answers dropped. */
function dealSpots(g: Game, gd: Guard, P: SearchPlan) {
  const nav = g.col.nav, W = nav.W, Hn = nav.H, cs = nav.cell, N = W * Hn; const gi = Math.max(0, g.guards.indexOf(gd));
  const { secs, metres } = floodFrom(g, P.fix, SEARCH_RADIUS_M);
  // props: every cell within reach of a chair / carton / plant / bin counts it (a man folds himself in beside and behind such things)
  const propN = new Uint8Array(N);
  for (const p of g.props.props) {
    const r = p.radius + 0.7; const x0 = Math.max(0, Math.floor((p.x - r) / cs)), x1 = Math.min(W - 1, Math.floor((p.x + r) / cs)), z0 = Math.max(0, Math.floor((p.z - r) / cs)), z1 = Math.min(Hn - 1, Math.floor((p.z + r) / cs));
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) if (Math.hypot((x + 0.5) * cs - p.x, (z + 0.5) * cs - p.z) < r) propN[z * W + x] = Math.min(255, propN[z * W + x] + 1);
  }
  // open leaves: the cells close along a leaf standing well open, off the doorway itself — behind the door
  const leafN = new Uint8Array(N);
  for (const d of g.doors.list) {
    if (Math.abs(d.angle) < 0.7 || d.off) continue;   // (off its hinges: there is no 'behind the door')
    const [hx, hz] = d.def.hinge, u = d.dir(), fc = d.frameCentre;
    for (let a = 0.2; a <= d.def.width; a += 0.25) for (const s of [-0.55, 0.55]) {
      const x = hx + u[0] * a - u[1] * s, z = hz + u[1] * a + u[0] * s;
      if (Math.hypot(x - fc[0], z - fc[2]) < 0.7 || nav.isBlocked(x, z)) continue;
      leafN[nav.idx(Math.floor(x / cs), Math.floor(z / cs))] = 1;
    }
  }
  // every reached cell a stride or more off the fix: what stands about it
  type Cand = { cell: number; pos: Vec3; kind: SearchSpot['kind']; cheap: number; m: number; hidden: boolean; cover: number };
  const cands: Cand[] = [], opens: Cand[] = [];
  for (let i = 0; i < N; i++) {
    if (!Number.isFinite(secs[i]) || metres[i] > SEARCH_RADIUS_M || metres[i] < 1.5) continue;
    const cx = i % W, cz = (i / W) | 0; let nWall = 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dz) continue; const nx = cx + dx, nz = cz + dz; if (nx < 0 || nz < 0 || nx >= W || nz >= Hn || nav.blocked[nav.idx(nx, nz)]) nWall++; }
    const nProp = propN[i], nLeaf = leafN[i];
    const cheap = 0.12 * Math.min(nWall, 5) + 0.2 * Math.min(nProp, 2) + 0.45 * nLeaf;   // (+0.3 hidden from the fix, below — on the half-metre grid a cell hard against a straight run has the three cells behind it blocked, an inside corner five: a wall 0.36 / 0.66 hidden, a corner 0.6 / 0.9 hidden, more with a chair in it; a lone chair in the aisle 0.2; behind a leaf 0.8+; open floor 0.1)
    const kind: SearchSpot['kind'] = nLeaf ? 'leaf' : nWall >= 5 ? 'corner' : nProp ? 'prop' : nWall ? 'wall' : 'open';
    const c: Cand = { cell: i, pos: [(cx + 0.5) * cs, 0, (cz + 0.5) * cs], kind, cheap, m: metres[i], hidden: false, cover: 0 };
    (cheap > 0 ? cands : opens).push(c);
  }
  cands.sort((a, b) => (b.cheap - a.cheap) || (a.m - b.m));
  const kept: Cand[] = []; const farFrom = (p: Vec3, list: Cand[], r: number) => list.every(k => v3.distXZ(k.pos, p) >= r);
  for (const c of cands) { if (kept.length >= 40) break; if (farFrom(c.pos, kept, SEARCH_SPACING_M)) kept.push(c); }
  const eyeFix: Vec3 = [P.fix[0], 1.0, P.fix[2]];
  for (const c of kept) { c.hidden = g.col.segmentBlocked(eyeFix, [c.pos[0], 0.6, c.pos[2]]); c.cover = clamp(c.cheap + (c.hidden ? 0.3 : 0), 0.05, 1); }
  kept.sort((a, b) => (b.cover - a.cover) || (a.m - b.m));
  const chosen = kept.slice(0, SEARCH_SPOTS);
  opens.sort((a, b) => b.m - a.m);   // controls: open floor, as far out and as far apart as the place allows
  let controls = 0;
  for (const c of opens) { if (controls >= SEARCH_CONTROLS) break; if (farFrom(c.pos, chosen, 2.5)) { c.hidden = g.col.segmentBlocked(eyeFix, [c.pos[0], 0.6, c.pos[2]]); c.cover = c.hidden ? 0.3 : 0.1; chosen.push(c); controls++; } }
  P.spots = chosen.map((c, i): SearchSpot => {
    const key = `srch:${gi}:${i}`; g.lightForget(key);   // (the last plan's answer under this key was for another spot)
    return { pos: c.pos, cell: c.cell, key, kind: c.kind, hidden: c.hidden, cover: c.cover, dark: 0.5, E: undefined, need: secs[c.cell], plaus: 1, score: 0, visited: false, by: -1, unreachable: false, samples: [] };
  });
  P.floodAt = g.time; P.current = -1; P.rr = 0;
}

/** The plan for this man's search, built on its first frame round his fix (his own feet if he has none) and rebuilt if the fix has since moved a couple of
 *  metres (a creak placed somewhere else while he searched); plausibility re-flooded every SEARCH_REFLOOD_SECS. */
export function searchPlanFor(g: Game, gd: Guard): SearchPlan {
  const fix: Vec3 = gd.lastKnown ? [gd.lastKnown[0], 0, gd.lastKnown[2]] : [gd.char.pos[0], 0, gd.char.pos[2]];
  let P = gd.searchPlan;
  if (P && v3.distXZ(P.fix, fix) > 2.0) P = null;   // a new place to search: deal again round it
  if (!P) {
    P = { fix, t0: gd.lastKnown ? gd.fixT : g.time, serial: (gd.searchPlan?.serial ?? 0) + 1, builtAt: g.time, floodAt: g.time, spots: [], current: -1, phase: 'sweep', phaseT: 0, visits: 0, rr: 0, said: false };
    dealSpots(g, gd, P); gd.searchPlan = P;
  } else if (g.time - P.floodAt > SEARCH_REFLOOD_SECS) {   // time has passed, leaves have moved: how long Sam would need to each spot NOW
    const { secs } = floodFrom(g, P.fix, SEARCH_RADIUS_M); for (const s of P.spots) s.need = secs[s.cell]; P.floodAt = g.time;
  }
  return P;
}

/** This frame's light readings for a plan: his share of the frame's PROBE_BUDGET queued round-robin over the spots still worth asking about (all of them once
 *  those are done), and whatever answers have arrived folded in — each kept DARK_WINDOW_SECS, the darkest live one mapped through the meter's own curve. */
export function searchProbes(g: Game, gd: Guard, P: SearchPlan) {
  const n = P.spots.length; if (!n) return;
  let searchers = 0; for (const o of g.guards) if (o.state === 'search' && !o.script && o.searchPlan) searchers++;
  const share = Math.max(1, Math.floor(PROBE_BUDGET / Math.max(1, searchers)));
  const live = P.spots.some(s => !s.visited && !s.unreachable);
  for (let k = 0, tries = 0; k < share && g.searchProbeN < PROBE_BUDGET && tries < n; tries++) {
    const s = P.spots[P.rr % n]; P.rr++;
    if (live && (s.visited || s.unreachable)) continue;   // (the budget goes on the spots still in play while any are)
    g.lightQuery(s.key, [s.pos[0], PROBE_HEIGHT, s.pos[2]]); g.searchProbeN++; k++;
  }
  for (const s of P.spots) {
    const E = g.lightAt(s.key);
    if (E !== undefined && Number.isFinite(E)) { s.samples.push({ t: g.time, E }); g.lightForget(s.key); }
    while (s.samples.length && g.time - s.samples[0].t > DARK_WINDOW_SECS) s.samples.shift();
    if (s.samples.length > 200) s.samples.splice(0, s.samples.length - 200);
    if (s.samples.length) { let m = Infinity; for (const x of s.samples) if (x.E < m) m = x.E; s.E = m; s.dark = 1 - g.visibilityOf(m); }
    else { s.E = undefined; s.dark = 0.5; }
  }
}

/** Score every spot for THIS man now — dark × cover × plausible, eased toward the ones the shorter walk from him (`walk`: metres of his own path to each cell,
 *  from a keyed flood at pick time; straight-line otherwise — equal spots resolve near-first, a much darker one across the room still wins) — folding in what the
 *  other searchers know: a spot a colleague has looked into (or one within a metre of it) is done for everybody. */
export function scoreSpots(g: Game, gd: Guard, P: SearchPlan, walk: Float32Array | null = null) {
  const elapsed = g.time - P.t0; const others = g.guards.filter(o => o !== gd && o.state === 'search' && !o.script && o.searchPlan && o.team === gd.team);   // (teams: spots are split over HIS side's net)
  for (const s of P.spots) {
    if (!s.visited) for (const o of others) { const v = o.searchPlan!.spots.find(q => q.visited && !q.unreachable && v3.distXZ(q.pos, s.pos) < 1.0); if (v) { s.visited = true; s.by = v.by; break; } }
    s.plaus = Number.isFinite(s.need) ? clamp(1 - (s.need - elapsed - PLAUS_SLACK_SECS) / PLAUS_RAMP_SECS, 0, 1) : 0;
    const m = walk ? walk[s.cell] : v3.distXZ(gd.char.pos, s.pos);
    s.score = Number.isFinite(m) ? Math.max(s.dark, 0.05) * s.cover * s.plaus / (1 + 0.08 * m) : 0;   // (no way there for him from here: nothing)
  }
}
/** a spot some other searcher is walking to or looking into right now (within a spot's spacing of it): his, not ours */
function spotTaken(g: Game, gd: Guard, s: SearchSpot): boolean {
  for (const o of g.guards) {
    if (o === gd || o.state !== 'search' || o.script || !o.searchPlan || o.team !== gd.team) continue;
    const Q = o.searchPlan; if (Q.current < 0 || (Q.phase !== 'walk' && Q.phase !== 'look')) continue;
    const q = Q.spots[Q.current]; if (q && v3.distXZ(q.pos, s.pos) < SEARCH_SPACING_M) return true;
  }
  return false;
}
/** On to the best spot still worth it (scored this frame), or the plan is done. */
function pickNextSpot(g: Game, gd: Guard, P: SearchPlan) {
  scoreSpots(g, gd, P, floodFrom(g, gd.char.pos, SEARCH_RADIUS_M * 2 + 4, true).metres);   // (his own walk to each, doors and all: round the partitions, not through them)
  let best = -1, bs = 0.004;   // (below that — lit open floor at the edge of plausibility — is not worth the walk)
  P.spots.forEach((s, i) => { if (s.visited || s.unreachable || s.plaus < 0.02 || s.score <= bs || spotTaken(g, gd, s)) return; bs = s.score; best = i; });
  P.current = best; P.phase = best >= 0 ? 'walk' : 'done'; P.phaseT = 0;
  gd.path = []; gd.pathGoal = null; gd.stallRef = null;
  if (best >= 0 && !P.said && !(gd.bubble && g.time - gd.bubble.t < 2.5) && !g.guards.some(o => o !== gd && o.state === 'search' && o.searchPlan?.said && g.time - o.searchPlan.builtAt < 30)) {   // (one man says it for a search, not each of them a second apart)
    P.said = true; g.say(gd, P.spots[best].dark > 0.6 ? (defenderWords(gd) ? wg("they must've gone somewhere dark — check the corners", "they'll have gone somewhere dark — check the corners") : wg("he must've gone somewhere dark — check the corners", "he'll have gone somewhere dark — check the corners")) : P.spots.some(s => s.kind === 'prop') ? (WORDS.on && !isOffice(g.level) ? `check the corners — low, behind anything ${defenderWords(gd) ? 'they' : 'he'} could get behind` : 'check the corners — under the desks, behind the chairs') : 'check the corners');
  }
}
/** One line for the panel / debugging: phase, the spot he is on, how many looked into, the top few by score with their readings. */
export function searchSummary(g: Game, gd: Guard): string {
  const P = gd.searchPlan; if (!P) return '';
  const cur = P.current >= 0 ? P.spots[P.current] : null;
  const top = [...P.spots].filter(s => !s.visited && !s.unreachable).sort((a, b) => b.score - a.score).slice(0, 3).map(s => `${s.kind}@${s.pos[0].toFixed(1)},${s.pos[2].toFixed(1)} d${s.dark.toFixed(2)}${s.E === undefined ? '?' : ''} c${s.cover.toFixed(2)} p${s.plaus.toFixed(2)} =${s.score.toFixed(3)}`).join(' · ');
  return `search ${P.phase}${cur ? ` → ${cur.kind}@${cur.pos[0].toFixed(1)},${cur.pos[2].toFixed(1)}` : ''} · ${P.visits}/${P.spots.length} looked into · ${Math.round(g.time - P.t0)} s since the fix · next: ${top || '—'}`;
}

// ------------------------------------------------------------ threshold discipline: pieing a doorway on the way through
// A hunting man (alert on a fix, or searching) whose path runs through a doorway does not jog through it square: two metres short he comes down to a walk and
// over toward the hinge side of the opening, his eyes and light slicing across the opening from what shows past the latch jamb round to the hinge side as he
// closes (the pie), and as he steps through he snaps seventy degrees to the corner behind the hinge jamb — the one place the slice could not see — then picks
// his pace back up. Not with eyes on Sam (no time for drills), not at the door he has just come through, not under the tour, not for a man pinned to his mark.
// No pathfinding of its own: it caps followPath's speed, bends the approach marks already on the path, and hands back a look point.
/** metres of path ahead within which a doorway is picked up; metres short of the crossing point at which the brake goes on (he is at a walk a stride later) and at
 *  which the slice starts; the slice's length; the corner check's; the same door is not pied again inside AGAIN seconds of going through it; a pie that has not
 *  completed in CAP seconds (wedged, shoved off his line) is dropped */
const PIE_DETECT_M = 3.2, PIE_SLOW_M = 1.5, PIE_SLICE_M = 1.7, PIE_SLICE_SECS = 1.0, PIE_CORNER_SECS = 0.4, PIE_AGAIN_SECS = 6, PIE_CAP_SECS = 7;
/** with a sighting fresher than this he is chasing, not clearing */
export const PIE_EYES_SECS = 1.0;
export interface Pieing {
  door: Door; phase: 'approach' | 'slice' | 'cross';
  side: 1 | -1;        // the face he comes at it from (+1 = the CCW side of the closed frame line, Doors.side's convention)
  at: Vec3;            // where his path cuts the frame line (distances are taken to this, not to the line: a man walking the corridor a metre off the wall is not a metre from the door)
  near: 0 | 1;         // the jamb on his side of the approach — 0 the hinge, 1 the latch — settled as the slice begins: the slice runs from it across to the far corner, the blind corner behind it gets the check
  t: number; t0: number; pathRef: Vec3[]; bent: boolean;
}
/** the closed frame of a door: hinge, unit along the frame hinge → latch, unit normal (+ = CCW side), width */
export function frameOf(d: Door) { const ux = Math.cos(d.def.closedDir), uz = Math.sin(d.def.closedDir); return { hx: d.def.hinge[0], hz: d.def.hinge[1], ux, uz, nx: -uz, nz: ux, W: d.def.width }; }
/** where segment a→b crosses d's frame line within the opening: t along the segment, the side a is on, the crossing point — or null */
export function crossesDoor(a: Vec3, b: Vec3, d: Door): { t: number; side: 1 | -1; at: Vec3 } | null {
  const F = frameOf(d);
  const da = (a[0] - F.hx) * F.nx + (a[2] - F.hz) * F.nz, db = (b[0] - F.hx) * F.nx + (b[2] - F.hz) * F.nz;
  if (da * db >= 0 || Math.abs(da - db) < 1e-6) return null;
  const t = da / (da - db); const ix = a[0] + (b[0] - a[0]) * t, iz = a[2] + (b[2] - a[2]) * t; const along = (ix - F.hx) * F.ux + (iz - F.hz) * F.uz;
  if (along < -0.1 || along > F.W + 0.1) return null;
  return { t, side: da > 0 ? 1 : -1, at: [ix, 0, iz] };
}
/** Doorways a hunting man goes through, pied or not: his stride since the last frame looked at cutting a frame line (the one behind him is then not pied again
 *  for PIE_AGAIN_SECS; a pie in progress on that door is on its corner check from here). Once a frame at most (updateGuard's alert branch and pieDoorway both ask). */
export function noteDoorCrossings(g: Game, gd: Guard) {
  const pos = gd.char.pos; if (gd.piePrevT === g.time) return;
  if (gd.piePrev && g.time - gd.piePrevT < 0.5 && v3.distXZ(gd.piePrev, pos) > 1e-4) for (const d of g.doors.list) if (crossesDoor(gd.piePrev, pos, d)) { gd.pieLast = d; gd.pieLastT = g.time; if (gd.pieing?.door === d && gd.pieing.phase !== 'cross') { gd.pieing.phase = 'cross'; gd.pieing.t = 0; } }
  gd.piePrev = v3.copy(pos); gd.piePrevT = g.time;
}
/** This frame's threshold discipline for a man followPath is about to move at `speed` (see the block comment): keeps Guard.pieing, notes the doorways he goes
 *  through. `eyesOn`: Sam in (or a second out of) his sight — no drill, he is chasing. Returns the speed to walk at and a look point (null = the caller's own). */
export function pieDoorway(g: Game, gd: Guard, dt: number, speed: number, eyesOn: boolean): { speed: number; look: Vec3 | null } {
  const pos = gd.char.pos;
  noteDoorCrossings(g, gd);
  if (!AI_TUNE.pieing || g.quietUtility || gd.pinned || eyesOn) { gd.pieing = null; return { speed, look: null }; }
  let P = gd.pieing;
  if (P && (g.time - P.t0 > PIE_CAP_SECS || (P.phase !== 'cross' && gd.path !== P.pathRef && !pathCrosses(gd, P.door)))) P = gd.pieing = null;   // stale, or re-planned some other way
  if (!P) {   // a doorway on the path within PIE_DETECT_M?
    let acc = 0, prev: Vec3 = pos;
    for (let i = gd.pathI; i < gd.path.length && acc < PIE_DETECT_M; i++) {
      const wp = gd.path[i]; const L = v3.distXZ(prev, wp);
      let hit: { d: Door; t: number; side: 1 | -1; at: Vec3 } | null = null;
      for (const d of g.doors.list) { if (d === gd.pieLast && g.time - gd.pieLastT < PIE_AGAIN_SECS) continue; const x = crossesDoor(prev, wp, d); if (x && (!hit || x.t < hit.t)) hit = { d, ...x }; }
      if (hit && acc + L * hit.t <= PIE_DETECT_M) { P = gd.pieing = { door: hit.d, phase: 'approach', side: hit.side, at: hit.at, near: 0, t: 0, t0: g.time, pathRef: gd.path, bent: false }; break; }
      acc += L; prev = wp;
    }
    if (!P) return { speed, look: null };
  }
  const d = P.door, F = frameOf(d), sg = P.side; const tx = -sg * F.nx, tz = -sg * F.nz;   // unit, the way through
  const perp = ((pos[0] - F.hx) * F.nx + (pos[2] - F.hz) * F.nz) * sg;                      // metres off the frame line on his side (− = through)
  const before = perp > 0 ? Math.max(perp, v3.distXZ(pos, P.at)) : perp;                     // metres still to walk to the sill — or, through, how far past the line
  if (!P.bent) { P.bent = true; bendApproach(g, gd, d, sg); P.pathRef = gd.path; refreshCrossing(gd, P); }
  P.t += dt;
  if (P.phase === 'approach' && before < PIE_SLICE_M) { P.phase = 'slice'; P.t = 0; const a = (pos[0] - F.hx) * F.ux + (pos[2] - F.hz) * F.uz; P.near = a > 0.6 * F.W ? 1 : 0; }   // (coming at it along the wall from the latch side, that jamb is the near one; head-on or from the hinge side — where the approach was bent to — the hinge is)
  if (P.phase === 'slice' && before < 0.15) { P.phase = 'cross'; P.t = 0; }
  if ((P.phase === 'cross' && P.t > PIE_CORNER_SECS) || before < -1.5 || before > PIE_DETECT_M + 1.5) { gd.pieLast = d; gd.pieLastT = g.time; gd.pieing = null; return { speed, look: null }; }
  let out = speed;
  if (before < PIE_SLOW_M + 0.3 && before > -0.1) { out = Math.min(speed, g.tune.guardWalk); if (gd.speed > out) gd.speed = damp(gd.speed, out, 14, dt); }   // the brake: a stride and he is at a walk (followPath's own easing would carry the jog to the sill); through, his feet pick up again under the corner check
  // the look pivots about the near jamb's edge: from just his side of straight-through (the jamb itself) round past the far jamb into the room as he closes (the
  // slice), then, stepping through, hard back round to the blind corner behind the near jamb — as bearings off the way through, so it sweeps whatever his line
  const jn = P.near ? F.W : 0, far = P.near ? -1 : 1;   // the near jamb's place along the frame; which way along it the far jamb lies
  const ex = F.hx + F.ux * jn, ez = F.hz + F.uz * jn;    // the pivot: the near jamb's edge
  const bearing = (deg: number, reach: number, y: number): Vec3 => { const a = deg * DEG, ca = Math.cos(a), sa = Math.sin(a) * far; return [ex + (tx * ca + F.ux * sa) * reach, y, ez + (tz * ca + F.uz * sa) * reach]; };   // deg: + toward the far side, − the near
  let look: Vec3 | null = null;
  if (P.phase === 'slice') look = bearing(lerp(-25, 80, smoothstep(0, 1, clamp(P.t / PIE_SLICE_SECS, 0, 1))), 2.5, 0.95);   // (held past the far jamb till he is on the sill)
  else if (P.phase === 'cross') look = bearing(-70, 1.6, 0.8);
  return { speed: out, look };
}
/** does the man's remaining path still run through this door */
function pathCrosses(gd: Guard, d: Door): boolean { let prev = gd.char.pos; for (let i = gd.pathI; i < gd.path.length; i++) { if (crossesDoor(prev, gd.path[i], d)) return true; prev = gd.path[i]; } return false; }
/** the crossing point again, off the path as it now runs (the approach marks have just been bent) */
function refreshCrossing(gd: Guard, P: Pieing) { let prev = gd.char.pos; for (let i = gd.pathI; i < gd.path.length; i++) { const x = crossesDoor(prev, gd.path[i], P.door); if (x) { P.at = x.at; return; } prev = gd.path[i]; } }
/** Bend the approach already on his path toward the hinge side: the last mark short of the line (the nav path's own square-on point through a two-cell doorway, or
 *  threadPath's) slides to 0.42 of the width from the hinge, and — unless he is coming along the wall from the latch side (no crossing in front of the opening
 *  to get there) and if the sill is still a couple of metres off — a mark 1.5 m out and a quarter-width from the hinge jamb goes in ahead of it, so he comes at
 *  the opening on the diagonal that shows him the latch side of the room first. Only onto free cells he can walk between. */
function bendApproach(g: Game, gd: Guard, d: Door, sg: 1 | -1) {
  const nav = g.col.nav, F = frameOf(d); const pos = gd.char.pos;
  const bef = (p: Vec3) => ((p[0] - F.hx) * F.nx + (p[2] - F.hz) * F.nz) * sg, alg = (p: Vec3) => (p[0] - F.hx) * F.ux + (p[2] - F.hz) * F.uz;
  const at = (a: number, b: number): Vec3 => [F.hx + F.ux * a + F.nx * sg * b, 0, F.hz + F.uz * a + F.nz * sg * b];
  let crossI = -1, X: Vec3 | null = null; { let prev = pos; for (let i = gd.pathI; i < gd.path.length; i++) { const x = crossesDoor(prev, gd.path[i], d); if (x) { crossI = i; X = x.at; break; } prev = gd.path[i]; } }
  if (crossI < 0 || !X) return;
  let nearI = -1;   // the near mark: the waypoint just short of the line, if it sits in front of the opening
  if (crossI - 1 >= gd.pathI) { const w = gd.path[crossI - 1]; const b = bef(w), a = alg(w); if (b > 0.3 && b < 1.4 && a > 0.15 * F.W && a < 0.9 * F.W) nearI = crossI - 1; }
  if (nearI >= 0) {
    const w = gd.path[nearI]; const q = at(0.42 * F.W, clamp(bef(w), 0.55, 0.8)); const from = nearI > gd.pathI ? gd.path[nearI - 1] : pos;
    if (!nav.isBlocked(q[0], q[2]) && nav.walkable(from, q)) gd.path[nearI] = q;
  }
  if (v3.distXZ(pos, X) > 2.1 && alg(pos) < 0.6 * F.W + 0.5) {   // the far mark (not for a man coming along the wall from the latch side: he pies from the line he is on)
    const q = at(0.25 * F.W, 1.5); const ins = nearI >= 0 ? nearI : crossI;
    const from = ins > gd.pathI ? gd.path[ins - 1] : pos, to = gd.path[ins];
    if (!nav.isBlocked(q[0], q[2]) && v3.distXZ(from, q) > 0.5 && nav.walkable(from, q) && (bef(to) < 0 || nav.walkable(q, to))) gd.path.splice(ins, 0, q);
  }
}

/** The alert chase on a fix with no eyes on him — the lines that always stood in updateGuard's alert branch, moved out whole so the pursuit tactics can hand
 *  back to them (and run them at a walk for a lone man going on carefully): path to the fix at `pace`, pie the doorways on the way (not with Sam a second out
 *  of his sight: then he is chasing), and the three no-progress exits into the search. Returns his move speed, aim point and that a pie may stand. */
export function chaseFix(g: Game, gd: Guard, dt: number, pace: number): { move: number; aim: Vec3 | null; pied: boolean; crouch: number } {
  const c = gd.char; const fix = gd.lastKnown!;
  goTo(g, gd, fix);
  const pie = pieDoorway(g, gd, dt, pace, g.time - gd.lastSeenT < PIE_EYES_SECS);   // a doorway on the way to the fix: down to a walk, slice it, check the corner as he goes through (not with Sam a second out of his sight: then he is chasing)
  let arrived = followPath(g, gd, dt, pie.speed); const move = gd.speed;
  const aim = arrived ? null : pie.look ?? v3.add(fix, [0, 1.1, 0]);
  // no way of getting nearer (a leaf across an alley, a carton shoved over the spot, a fix inside a wall): after a few seconds of no progress he searches
  // from where he is rather than staying 'alert' for ever — which also kept the whole floor's alarm episode (and its step-down) from ever ending.
  // Progress is measured against THIS fix: a new one (a colleague's shots placing Sam across the floor, a glimpse of him two rooms on) starts the count
  // again — measured against the old one, the run to it read as 'five seconds without getting nearer than he once was' and he gave up half way down the
  // corridor — and four seconds of covering no ground at all (wedged on a leaf somebody holds shut, a colleague planted in the doorway) ends it too, whatever
  // the distance to the fix is doing; and no chase runs past 25 s without a sight of him or a new fix, however long the path (a fix that can be walked to
  // is walked to well inside that; one that keeps a man marching for half a minute is not worth the floor's alarm staying up for).
  if (!gd.alertRef || v3.distXZ(gd.alertRef, fix) > 0.05) { gd.alertRef = v3.copy(fix); gd.alertBest = 1e9; gd.alertStallT = 0; gd.chaseT = 0; }   // (the ground watchdog's own reference is left alone: a fix that keeps moving must not keep a wedged man from ever timing out)
  const dFix = v3.distXZ(fix, c.pos);
  if (dFix < gd.alertBest - 0.5) { gd.alertBest = dFix; gd.alertStallT = 0; } else if ((gd.alertStallT += dt) > 5) arrived = true;
  if (!arrived && notGettingAnywhere(gd, dt, 4)) arrived = true;
  if (!arrived && (gd.chaseT += dt) > 25) arrived = true;
  if (arrived) dropToSearch(g, gd, defenderWords(gd) ? 'where did they go?' : 'where did he go?');
  return { move, aim, pied: true, crouch: 0 };
}

export function updateGuard(g: Game, gd: Guard, dt: number) {
  const c = gd.char; const T = g.tune; const route = gd.route;   // (his level route, or a spawned unit's one-point stand: game.ts Guard.route)
  c.turnBegin();   // (turn weight, character.ts TURN: his yaws read back as this update left them last frame — nothing with it off)
  playerGroundVel(g);   // (sampled once a frame whoever sees him or not, so the frame somebody does the difference is one frame's worth)
  if (gd.state === 'dead') {
    gd.muzzleDown = false; gd.pieing = null; gd.searchPlan = null; gd.held = null; gd.standoff = null; gd.speed = 0; c.vel = [0, 0, 0]; c.anim.speed = 0; gd.aim.clear(); c.update(dt); g.bodyThud(c); attachFlashlight(g, gd, dt); return;   // (update = the ragdoll; free once it sleeps; aim: a corpse lines nobody up)
  }
  if (gd.held) {   // in Sam's arm (player.ts updateHold has already placed, turned and posed him this frame, and set his speed / vel to the pair's): no senses, no
                   // decisions, no feet of his own — the animator, attachFlashlight (a patrolling man's torch was knocked out at the grab and lies dark on the floor:
                   // player.ts startGrab; a drawn man's weapon light rides the gun in his raised hand) and his shuffling steps only. His state, awareness and fix
                   // stand exactly as they were: what he knew he still knows if he comes out of it on his feet (player.ts handBack: Sam shot, the hands taken).
    gd.pieing = null; gd.searchPlan = null; gd.bodyDuty = null; gd.standoff = null; gd.muzzleDown = false; gd.sawPlayerThisFrame = false; gd.path = []; gd.pathGoal = null; gd.stallRef = null; gd.aim.clear();   // (aim.clear: let go, he lines Sam up again from nothing — aim.ts)
    c.update(dt); attachFlashlight(g, gd, dt);
    const prevPhase = gd.stepPhase; gd.stepPhase = c.anim.phase;
    if (gd.speed > 0.4 && ((prevPhase < 0.5) !== (gd.stepPhase < 0.5))) tread(g, c.pos, 0.22, false);   // (presentation only, like every guard's tread — on the floor it lands on, floor.ts: the pair's noise is Sam's own step events)
    gd.lastPos = v3.copy(c.pos); heldLastFrame.add(gd);
    return;
  }
  if (gd.gunLostAt >= 0) gunBack(g, gd);   // (HOLD.dropGun: on his own feet with his hands still empty — no hold handed him back; he has it again before anything below asks what is in his hand)
  if (heldLastFrame.delete(gd)) { unstickLegs.delete(gd); unstickBegin(g, gd); }   // the first frame back on his own feet out of Sam's arm: a side-step from before it is stale (the pair walked him about since), and if the hold ended with him stood on a stranded cell — the pair's capsules fit where no plan can start — the step off it is dealt now and walked the moment anything moves him (un-stick, at goTo)
  const staff = gd.team === 'guard';   // SIDES (teams.ts): a man of the level's night staff — the game as it was — or a spawned unit of the showcase's (operative / hostile)
  if (!staff) unitLightMeter(g, gd, dt);   // a man some AI side can be hostile to carries his own light meter (what their eyes read for him where they read Sam's for Sam) — fed choreographed or free, so a scripted operative on the door is as visible to the room as a free one
  { const fs = fragFlee(g, gd); if (fs) { const own = gd.script; gd.script = fs; gd.pieing = null; gd.aim.clear(); runGuardScript(g, gd, dt); gd.script = own; return; } }   // a live fragmentation grenade he knows of has a line to him (frag.ts): this frame his legs get him off it — his own orders, state and fix stand exactly as they were and take over again the frame it is gone
  { const rs = runnerScript(g, gd); if (rs) { const own = gd.script; gd.script = rs; gd.pieing = null; gd.aim.clear(); runGuardScript(g, gd, dt); gd.script = own; return; } }   // drops it and runs (runner.ts; null on its first line with the switch off): from his shout on his body is that file's — he senses nothing and fights nobody
  { const ms = moraleScript(g, gd); if (ms) { const own = gd.script; gd.script = ms; gd.pieing = null; gd.aim.clear(); runGuardScript(g, gd, dt); gd.script = own; return; } }   // shaken (morale.ts; null on its first line with the switch off): a blast has him ducked, or broken and scrabbling off the hole — this frame his body is that file's, his own orders, state and fix exactly as they were
  { const ss = startleScript(g, gd); if (ss) { const own = gd.script; gd.script = ss; gd.pieing = null; gd.aim.clear(); runGuardScript(g, gd, dt); gd.script = own; return; } }   // caught alone at first sight (startle.ts; null on its first line for every man not on such a run): a green man runs for cover with his hands down — this frame his body is that run's
  if (gd.script) { gd.pieing = null; gd.searchPlan = null; gd.standoff = null; gd.aim.clear(); gd.drawn = !!gd.script.over || (gd.script.upper ?? 'aim') === 'aim'; runGuardScript(g, gd, dt); return; }   // choreographed (tour beat / squad drill): squad.ts owns him this frame — and what is in his hand follows the ordered pose ('aim' = the pistol), not the AI state; the drill has its own threshold work and its own search; handed back to the AI he lines Sam up from nothing (aim.ts)
  const lvl = escalationOf(g);   // the floor's alarm level (0 calm · 1 heightened · 2 lockdown; always 0 under the tour): how he carries himself while calm
  gd.drawn = lvl >= 1 || !staff; // heightened: the sidearm is out even on patrol — weapon light instead of the hand torch (handProps / attachFlashlight / killGuard); a unit is a combatant: his weapon is out whatever the staff's alarm says
  // --- perception ---
  let seen = false; let dist = 99;
  if (g.aiEnabled && !dozeDeaf(g, gd)) {   // (doze.ts: a man asleep in his chair has his eyes shut and his ears dull: his hearing is run for him there — false on its first line with its switch off)
    const ear = dozeEar(gd); hearingCheck(g, gd, ear[0], true, ear[1]);
    if (staff && HOSTILE.guard.operative) { acquireFoe(g, gd); if (!gd.foe) gd.foe = 'player'; }   // A QUIET MISSION WITH A PARTNER (quiet.ts → teams.ts staffVsOperatives; false on every other run: the line below, as it was): the staff see the operative beside Sam with the eye they see Sam with — whichever of the two shows best is the man they are on; with neither in sight they are on Sam, as ever
    else if (!staff) acquireFoe(g, gd);   // teams: which hostile man in his sight (or Sam, for a side hostile to Sam) his senses and gun are on this frame — the staff's is Sam, always, and this never runs for them
    const F = gd.foe; const fc = foeChar(g, gd);
    const vis = F === 'player' ? canSee(g, gd) : F && fc ? canSeeChar(g, gd, fc, false) : NO_SIGHT; dist = vis.dist;
    if (vis.visible && fc) {
      const rate = F === 'player' ? sightGain(g, gd, dist) : sightGainOn(g, gd, F as Guard, dist);
      if (rate > 0.05) {   // a faint glimpse updates where to look — and which way he is actually going: displacement over the last sighting, not the pace he is asking of his legs (held by a leaf or a desk he 'sprints' on the spot) — only a real sighting refreshes the licence to shoot
        const pp = fc.pos; const since = g.time - gd.sightT;
        gd.sightVel = since > 1e-4 && since < 0.1 ? [(pp[0] - gd.sightPos[0]) / since, 0, (pp[2] - gd.sightPos[2]) / since] : [0, 0, 0];
        const was = gd.awareness; gd.awareness = clamp(gd.awareness + rate * dt, 0, 1); if (!farFaint(gd, dist, was) && !attentionAside(g, gd, pp, gd.awareness - was)) gd.lastKnown = v3.copy(pp); gd.sightPos = v3.copy(pp); gd.sightT = g.time; seen = rate > 0.25; if (seen) gd.lastSeenT = g.time;   // (farFaint: a glimpse from past the old reach is no place to walk to until it is what has him looking)
        gd.alertBest = 1e9; gd.alertStallT = 0; gd.alertRef = null; gd.chaseT = 0;   // (eyes on him: whatever chase follows starts its no-progress clocks from here, not from a stale count)
      }
    }
    // a colleague held in Sam's arm, in his view (standoffPerceive): he is in the standoff from this frame — and looking straight at Sam, whatever the meter says
    if (standoffPerceive(g, gd, dt)) seen = true;
    gd.sawPlayerThisFrame = seen && F === 'player';   // (what the mission's 'spotted' count and the witnesses read: eyes on SAM — a unit's eyes on his hostile man are nobody's sighting of Sam)
    gd.sawFoeThisFrame = seen;
    // The frame he goes out of sight (had him a moment ago, not now) BEHIND something — the eye's line to where Sam now is has a wall or a leaf across it: through a
    // doorway, round a corner; not his own head sweeping off him, the range running out, a dazzle or the light dropping — lead the fix he leaves behind along the way
    // Sam was going (leadFix). Once per sighting, only a fresh one, and only if it still IS the sight fix (a noise placed since is its own place, not a point to march from).
    if (gd.sightT < g.time && gd.sightT > gd.ledT) {
      if (g.time - gd.sightT < 0.25 && gd.lastKnown && v3.distXZ(gd.lastKnown, gd.sightPos) < 0.01 && fc) {
        const eye = c.bones.head ?? v3.add(c.pos, [0, 1.65, 0]); const pc = fc;
        if (eyeBlocked(g, gd, eye, pc.bones.chest ?? v3.add(pc.pos, [0, 1.1, 0])) && eyeBlocked(g, gd, eye, pc.bones.head ?? v3.add(pc.pos, [0, 1.6, 0]))) gd.lastKnown = leadFix(g, gd.sightPos, gd.sightVel);
      }
      gd.ledT = gd.sightT;
    }
    // a downed colleague in view → cover him and radio it in, the alarm goes up a step around where he lies, and the floor's short script for a found body begins
    // (bodyAftermath): the finder walks up short of him and covers, the others come over — the second man there gets the one line — and every one of them then
    // widens out to a search point away from the body instead of milling on it and talking himself calm over the corpse. (A short refractory per finder: two men
    // lying together are one 'man down', not two calls in two frames; a body already called in startles nobody — bodyInView skips it.) The STAFF's script: a unit
    // steps over his dead without a radio to call them in on (teams — the showcase's fight is over in seconds; v1 leaves its aftermath unplayed).
    if (staff && gd.state !== 'alert' && !gd.bodyDuty && g.time - gd.sawBodyT > 20) {
      const o = bodyInView(g, gd);
      if (o) {
        const body = bodyPos(o); const eye = gd.char.bones.head ?? v3.add(gd.char.pos, [0, 1.65, 0]);
        gd.sawBodyT = g.time; gd.awareness = Math.max(gd.awareness, 0.7); gd.lastKnown = v3.copy(body); gd.reactT = 1.2;
        gd.witness.sawBody = { victim: o.callsign, t: g.time, breathing: isBreathing(o) };   // he found him, and found him breathing or not
        netQuietBody(g, gd, g.guards);   // (netquiet.ts — a return on its first line with its switch off: a body found shakes the finder, and less the men of his side he tells)
        const before = g.guards.filter(x => x.state === 'dead' && x.found).length;   // (bodies already called in earlier: the order's wording, raiseEscalation)
        let n = 0, cold = 0, hurt = 0; for (const x of g.guards) if (x.state === 'dead' && !x.found && (x === o || (v3.distXZ(bodyPos(x), body) < 3 && !g.col.segmentBlocked(eye, v3.add(bodyPos(x), [0, 0.3, 0]))))) { x.found = true; tally(g, 'bodies'); chronBodyFound(g, x, gd); tacticsBodyFound(g, gd, x); n++; if (isBreathing(x)) cold++; if (x.wound) hurt++; }   // (tacticsBodyFound: one lying in a doorway makes it a kill zone for his side, tactics.ts)   // a body counts once, however many find it — and men lying together in his sight are found together (one call, one script, not a second 'man down' the moment the first one's ends; one hidden through the wall stays hidden)
        if (gd.state === 'patrol' || gd.state === 'search') { gd.state = 'suspicious'; gd.searchT = 0; gd.path = []; gd.pathGoal = null; }   // (a searcher too: he has something concrete to stand over now)
        // what he calls in says what he found: a man shot dead, or one put out cold and left breathing (isBreathing: the takedown) — the floor treats both alike, the words do not
        const inHere = WORDS.on && !isOffice(g.level) ? wg("someone's here", "someone's about") : "someone's in here", who = spokenName(o) ?? 'one of ours';   // (words.ts: a yard, a street, a crossing is no 'in here')
        g.say(gd, hurt ? (n > 1 ? `${n} men down — ${hurt === n ? 'shot, still breathing' : 'one\'s shot and breathing'}. ${inHere} — radioing it in` : `it's ${who} — he's shot, still breathing. ${inHere} — radioing it in`)
          : n > 1 ? (cold === n ? `${n} men down — out cold, ${n > 2 ? 'all' : 'both'} breathing. ${inHere} — radioing it in` : `${n} men down! — radioing it in`)
          : cold ? `it's ${who} — he's down, out cold but breathing. someone dropped him — radioing it in` : 'man down! — radioing it in', true); g.audio.play('radio', eye, 0.9);
        if (!g.quietUtility) {   // (the tour's staged bodies get the call and nothing more: its guards stay on their marks)
          g.alarm.pos[0] = body[0]; g.alarm.pos[1] = 0; g.alarm.pos[2] = body[2]; g.alarm.placed = true;
          raiseEscalation(g, lvl >= 1 || g.alarm.episode ? 2 : 1, gd, 'body', before > 0);   // a body is as real as an alarm gets: a calm floor goes to heightened on it, an alarmed one (or one still hunting somebody) to lockdown, held around where he lies, its pair sent round the rooms nearest him (somebody else gives the order so the finder's own line stays up) — first, so a pair it pulls off a clear hears the call below as fresh men
          gd.task = null; gd.bodyDuty = { body: o, role: 'finder', stage: 'to', t: 0, t0: g.time, spot: null };   // (a colleague on the floor outranks the breaker / the rack he was walking to)
        }
        for (const other of g.guards) if (other !== gd && other.state !== 'dead') {
          other.awareness = Math.max(other.awareness, 0.45);
          other.witness.calledToBody = { victim: o.callsign, t: g.time, breathing: isBreathing(o) };   // everybody on the net heard the call, and heard what was found (errand or not, sent over or not)
          if (other.task) continue;   // on an errand (the breaker, the rack): he hears it on the net, sharpens up, and keeps going — his fix stays the errand's
          other.lastKnown = v3.copy(body);
          if (!g.quietUtility && !other.hold && !other.held && !other.bodyDuty && (other.state === 'patrol' || other.state === 'suspicious' || !!other.script)) other.bodyDuty = { body: o, role: 'called', stage: 'to', t: 0, t0: g.time, spot: null };   // (a scripted man — the clearing pair — breaks off on the news and comes over like the rest; an alert or searching one keeps hunting, he only learns where; the man in Sam's arm goes nowhere)
        }
      }
    }
    // lockdown pair: the man he is trailing stops dead and brings his weapon up at something ('huh?') — he takes it exactly as seriously, a step to that man's
    // side of the spot, without a 'huh?' of his own (only while the leader's start is fresh, reactT > 0: one look per noise, not a loop of re-inheriting it)
    if (lvl >= 2 && gd.leader && gd.state === 'patrol' && !gd.hold && gd.leader.state === 'suspicious' && gd.leader.reactT > 0 && gd.leader.lastKnown && !gd.leader.task) {   // (not an errand's start: a man setting off for the breaker or round a silent colleague's route was not startled by anything — his no. 2 just trails him there)
      const L = gd.leader, lk = L.lastKnown!, f = L.char.forward();
      const side: Vec3 = [lk[0] + f[2] * 1.1, 0, lk[2] - f[0] * 1.1];   // a metre to the left of it as the leader sees it (his left = [f.z, 0, −f.x] in this handedness)
      gd.state = 'suspicious'; gd.awareness = Math.max(gd.awareness, Math.min(L.awareness, 0.6), 0.34); gd.reactT = L.reactT + 0.3; gd.searchT = 0;
      gd.lastKnown = g.col.nav.walkable(lk, side) ? side : v3.copy(lk); gd.path = []; gd.pathGoal = null;   // (walkable from the spot itself: 'a metre to the left' must not mean the next room)
    }
    // a kicked-in lock, seen up close on a calm pass (within a couple of metres, his side of the doorway in his field of view): worth one look per door per
    // encounter — he draws, walks up to it, looks about, and talks himself out of it like any other unexplained thing (a broken lock cannot be relocked, lockdown or not)
    if (staff && gd.state === 'patrol' && !gd.hold && !g.quietUtility) for (const d of g.doors.list) {   // (not under the tour: its guards stay on their marks; the staff's doors are the staff's business)
      if (!d.lockBroken || d.noticed) continue;
      const f = d.frameCentre; const dx = f[0] - c.pos[0], dz = f[2] - c.pos[2]; const dd = Math.hypot(dx, dz); if (dd > 2.2 || dd < 1e-3) continue;
      const look = c.chestDir; if ((look[0] * dx + look[2] * dz) / dd < Math.cos(75 * DEG)) continue;
      const spot: Vec3 = d.off ? [f[0] - dx / dd * 0.45, 0, f[2] - dz / dd * 0.45] : g.doors.workSpot(d, c.pos, 0.45, d.def.width * 0.5).pos;   // just his side of the doorway's middle (short of the leaf, so the leaf itself never hides 'the door')
      const eye = c.bones.head ?? v3.add(c.pos, [0, 1.65, 0]); if (g.col.segmentBlocked(eye, [spot[0], 1.0, spot[2]])) continue;
      d.noticed = true; d.noticedT = g.time; gd.state = 'suspicious'; gd.awareness = Math.max(gd.awareness, 0.45); gd.reactT = 1.1; gd.searchT = 0; gd.lastKnown = spot; gd.path = []; gd.pathGoal = null;
      g.say(gd, d.off ? 'this door\'s off its hinges…' : 'this lock\'s been kicked in…'); g.audio.play('radio', eye, 0.4, { rate: 1.1 });
      break;
    }
    if (!seen) gd.awareness = Math.max(0, gd.awareness - dt * (gd.state === 'alert' ? 0.03 : gd.state === 'patrol' ? 0.1 : 0.06));
  } else { gd.awareness = Math.max(0, gd.awareness - dt * 0.5); }

  // --- state transitions ---
  const prev = gd.state;
  if (gd.awareness >= 0.85 && gd.state !== 'alert') {
    resetChase(gd); gd.state = 'alert'; gd.reactT = Math.max(gd.reactT, 0.35); gd.fireCd = 0.6 + simRandom() * 0.4; if (!gd.standoff && !(gd.bubble?.radio && g.time - gd.bubble.t < 1.0)) g.say(gd, 'CONTACT!', false, false, !w(g.messages.some(m => g.time >= m.t && g.time - m.t < 1 && m.text.endsWith(': CONTACT!')), false)); g.audio.play('radio', c.bones.head ?? c.pos, 0.8); if (g.time - g.lastStingT > 8) { g.audio.play('alertSting', null, 0.75); g.lastStingT = g.time; }   // (a man walking in on the hold has said what he saw — the call, or his first line to Sam — not 'contact'; nor does the man giving the order this second shout it over his own radio line; every man shouts it — his bubble, the bark clocks — but the LOG takes one row a second of it: five men roused by one shot filled all five rows with the same word)
    if (g.aiEnabled) { gd.witness.alertedBy = alertCause(g, gd, seen); gd.witness.alertT = g.time; }   // and he remembers what it was that did it (nothing is remembered with the AI off: a sandbox poke is nobody's perception)
    chronContact(g, gd);   // the debrief's row: who went to alert, and off what
  }
  if (g.aiEnabled && gd.awareness > gd.witness.peakAwareness) gd.witness.peakAwareness = gd.awareness;   // (his own record of how close he came — stands ALONE: it was chained in front of the branch below and ate the 'huh?' on every frame that set a new peak, so a man with steady sight of Sam went patrol → CONTACT with no suspicion in between)
  if (gd.awareness >= 0.3 && gd.state === 'patrol') {   // (the alert branch above has already moved him off 'patrol' when it fired this frame)
    gd.state = 'suspicious'; gd.searchT = 0;
    if (gd.bodyDuty) gd.reactT = 0.5 + simRandom() * 0.5;   // called to a body over the net: no 'huh?' — a beat to take it in, then over to him (bodyAftermath)
    else { gd.reactT = 0.9; if ((!WORDS.on || gd.team !== 'operative') && !attentionAgain(g, gd)) g.say(gd, 'huh?'); g.audio.play('radio', c.bones.head ?? c.pos, 0.45, { rate: 1.15 }); }
  }
  startleSight(g, gd, prev, seen);   // (startle.ts — nothing with its switch off: a calm man whose own eyes have just told him it is a man starts at it, and draws or runs only after that beat)
  if (prev !== gd.state) { gd.path = []; gd.pathGoal = null; gd.stallRef = null; if (gd.state !== 'suspicious') gd.bodyDuty = null; }   // (the body script lives inside 'suspicious': contact or calm ends it)
  attentionTick(g, gd);   // (attention.ts — a return on its first line with its switch off: a small thing that made him look takes his attention; one that no longer stands is let go)
  if (gd.state !== 'search') gd.searchPlan = null;   // (the plan lives inside 'search': whatever ends the search — contact, a body, calm, a script — drops it, and the next search deals afresh)
  const pair = standoffUpkeep(g, gd);   // the standoff he is in, if it still is one (the hold on, this pair, seen lately, he alert and free): the alert branch plays it out; else the record went just now
  gd.trackFix(g.time);   // when the fix he works from was placed (the search asks how far Sam can have got since)
  const dazzled = g.time < gd.dazzledUntil;
  if (dazzled) gd.reactT = Math.max(gd.reactT, gd.dazzledUntil - g.time);   // the transitions above reset reactT; a dazzled guard stays rooted (suspicious / alert both hold still while reactT > 0)
  const staggered = g.time < gd.staggerUntil;                                // a ring airfoil in the body (launcher.ts staggerGuard): rooted the same way for its second and a half and no round from him — but his eyes work
  if (staggered) gd.reactT = Math.max(gd.reactT, gd.staggerUntil - g.time);
  { const st = startleLeft(g, gd); if (st > 0) gd.reactT = Math.max(gd.reactT, st); }   // a start (startle.ts; 0 with nobody startled): rooted the same way for its beat, whatever else caps the clock meanwhile
  trackGuard(g, gd, dt);   // the aim-settle model (aim.ts): his track on Sam this frame — off this frame's sight, state and reaction beat, last frame's aim yaw (the same the fire gate reads) — before any branch below asks aimReady / guardRound
  const p0x = c.pos[0], p0z = c.pos[2];   // where this frame's feet start: the collision sweep at the bottom walks him from here (collideGuard)
  // (alarm episodes are counted in updateMission: someone going to alert while nobody was)       // mission stats: every time a man goes to alert (from patrol, suspicion or a lapsed search alike)

  // --- behaviour ---
  c.anim.lookYawExtra = 0; gd.lookPhase += dt;
  let moveSpeed = 0; let upper: UpperMode = 'none'; let aimAt: Vec3 | null = null;   // ('torch' only for a man answering a whistle with the torch still in his hand — the suspicious branch)
  let crouch = 0, duck = false;   // suppression (the alert branch): how far down he is (the animator's crouchTarget — threaded through the one pose write at the bottom, which used to say 0 for every guard) and whether the gun is lowered for it (upper 'none' + the low ready, as for a colleague in the line)
  let forced: { aim: Vec3; move: number } | null = null;   // (doorforce.ts: the alert branch's answer for a man on a shut door)
  let pied = false;   // a branch that walks a hunting path through doorways runs pieDoorway itself; every other leaves no pie standing (below the switch)
  switch (gd.state) {
    case 'patrol': {
      // heightened (lvl ≥ 1): the pistol is out at a low ready instead of the torch, the route is walked ~15 % brisker with shorter pauses and a wider sweep of the
      // muzzle into the corners; lockdown (2): a paired follower trails his leader instead of walking his own route, the spare man holds his junction (updateEscalation
      // hands those out), and anyone passing an open or unlocked door deals with it
      const target = route.points[gd.wp];
      if (gd.drawn) upper = 'aim';
      if (gd.bodyDuty && gd.awareness < 0.3) gd.bodyDuty = null;   // the call never took (the AI was off, he was reset under it): it must not steer some later, unrelated suspicion to an old body
      if (gd.task?.kind === 'checkOn') gd.task = null;              // (likewise a route walk he was talked out of under AI-off: a man back on his own route is not on that errand — the next radio check sends somebody afresh)
      const walk = T.guardWalk * (lvl >= 1 ? 1.15 : 1);
      if (gd.hold) { gd.sweep = damp(gd.sweep, Math.sin(gd.lookPhase * 0.5) * 0.2, 2, dt); c.vel = [0, 0, 0]; gd.speed = damp(gd.speed, 0, 8, dt); }   // (held on patrol — the tour's marks, two men stopped to talk (dialogue.ts ambient pairs): feet still AND no pace ordered, so his legs idle instead of walking on the spot; the suspicious hold below always did this)
      else if (lvl >= 2 && gd.leader) { partnerWatch(g, gd); if (followLeader(g, gd, dt, walk)) moveSpeed = gd.speed; }   // (a leader taken down quietly is still 'his leader' until somebody knows — superviseLockdown — so he closes up to his station behind the body, and finds him; one who has simply vanished from his sight for good gets called, and reported: partnerWatch)
      else if (lvl >= 2 && gd.post) { if (holdPost(g, gd, dt, walk)) moveSpeed = gd.speed; }
      else if (T.needs && needsPatrol(g, gd, dt, walk)) moveSpeed = gd.speed;   // needs (needs.ts): a man telegraphing / walking off on / taking / coming back from his coffee, smoke, water or stretch has his feet run there — his wait clock standing still, so the route resumes where it was; false at once for everybody else, and always with tune.needs off
      else if (dozePatrol(g, gd, dt, walk)) moveSpeed = gd.speed;   // dozing (doze.ts): a man come to a long wait in a dark place walks to the chair there — his wait clock running, so the timetable stands; false at once for everybody else, and always with its switch off
      else if (gd.wait > 0) {
        gd.wait -= dt; gd.sweep = Math.sin(gd.lookPhase * 0.9) * 0.7; c.anim.lookYawExtra = Math.sin(gd.lookPhase * 1.3) * 0.5;
        if (gd.wait <= 0) { gd.wp = (gd.wp + 1) % route.points.length; }
      } else {
        goTo(g, gd, target);
        let pace = walk;
        if (lvl >= 2) for (const o of g.guards) if (o.leader === gd && o.state === 'patrol' && v3.dist(o.char.pos, c.pos) > 4) pace = walk * 0.55;   // leading a pair: don't walk off from the man who is supposed to be on your shoulder (a turnabout leaves him ahead of you for a moment)
        if (followPath(g, gd, dt, pace)) { gd.wait = (route.wait[gd.wp] ?? 0) * (lvl >= 1 ? 0.6 : 1); if (gd.wait <= 0) gd.wp = (gd.wp + 1) % route.points.length; }
        gd.sweep = damp(gd.sweep, Math.sin(gd.lookPhase * 0.7) * (gd.drawn ? 0.4 : 0.25), 2, dt);
        moveSpeed = gd.speed;
      }
      c.aimYaw = c.bodyYaw + gd.sweep; c.aimPitch = damp(c.aimPitch, gd.drawn ? -0.26 : -0.35, 3, dt);   // drawn: muzzle (and its light) at a low ready, pooling on the floor five metres out
      if ((lvl >= 2 || g.doors.stay) && !gd.hold && staff) lockdownDoors(g, gd, lvl < 2);   // (DOORSTAY: no closer does it for him any more — below a lockdown he pulls his keyed doors and the doors to the outside to behind him, and only those)
      whistlePatrolTick(g, gd);   // (whistle.ts: a head still turned toward a whistle somebody nearer answered; a whistle's suspicion is over once he is back on his route)
      break;
    }
    case 'suspicious': {
      let lever: ReturnType<typeof leverStand> = null;
      upper = handCarry(gd) === 'torch' ? WHISTLE_SOFT_UPPER : 'aim';   // (the torch only ever stays in a suspicious hand for a whistle he is answering — whistle.ts whistleSoft; everything else has the gun up as it always did)
      if (gd.task?.kind === 'checkOn') checkOnTick(g, gd);   // walking a silent colleague's route: on to his next waypoint after a look round each — or over (found since, reset, walked it all: 'not at his post')
      if (gd.task) { // errand (e.g. go and look at the breaker): don't talk yourself out of it halfway down the corridor
        if (!gd.lastKnown || v3.dist(gd.lastKnown, gd.task.pos) > 0.5) { if (gd.awareness < 0.45) gd.lastKnown = v3.copy(gd.task.pos); }
        gd.awareness = Math.max(gd.awareness, 0.2);
        if (gd.task.kind !== 'checkOn' && gd.searchT > 4) gd.task = null;   // (the route walk ends on its own count of waypoints, not on one look round)
      }
      const duty = gd.bodyDuty ? bodyAftermath(g, gd, dt) : null;   // a found body has its own short script (drops itself, → null, the moment it no longer applies)
      if (duty) { moveSpeed = duty.move; aimAt = duty.aim; }
      else if (gd.reactT > 0) { gd.reactT -= dt; gd.speed = damp(gd.speed, 0, 8, dt); if (gd.lastKnown) aimAt = v3.add(gd.lastKnown, [0, 1.0, 0]); }
      else if (gd.lastKnown && gd.hold) { gd.speed = damp(gd.speed, 0, 8, dt); c.vel = [0, 0, 0]; aimAt = v3.add(gd.lastKnown, [0, 1.0, 0]); gd.searchT += dt; if (gd.searchT > 6) gd.awareness = Math.min(gd.awareness, 0.1); }   // scripted hold: watch it from where you stand, then let it go
      else if (gd.task?.kind === 'breaker' && (lever = leverStand(g, gd, dt))) { upper = 'none'; moveSpeed = gd.speed = lever.speed; c.vel = [0, 0, 0]; aimAt = null; c.aimYaw = lever.yaw; c.anim.lookYawExtra = 0; gd.stallRef = null; }   // at the panel (handwork.ts): the step up to it, squared to it, his hand on the lever — nothing with the switch off
      else if (gd.lastKnown) {
        goTo(g, gd, gd.lastKnown);
        const arrived = followPath(g, gd, dt, T.guardInvestigate); moveSpeed = gd.speed;
        aimAt = v3.add(gd.lastKnown, [0, 0.9, 0]);
        if (arrived && attentionDwell(g, gd)) { gd.stallRef = null; gd.sweep = Math.sin(gd.lookPhase * 1.1) * ATTENTION.dwellSweep; aimAt = null; c.aimYaw = c.bodyYaw + gd.sweep; }   // (attention.ts: his attention is ON the thing — he looks at it, not round the room, for the time the floor shows; false for every man with the switch off)
        else if (arrived) { gd.stallRef = null; gd.searchT += dt; gd.sweep = Math.sin(gd.lookPhase * 1.1) * 1.1; c.anim.lookYawExtra = Math.sin(gd.lookPhase * 1.9) * 0.4; aimAt = null; c.aimYaw = c.bodyYaw + gd.sweep; if (gd.searchT > 5) { gd.awareness = Math.min(gd.awareness, 0.2); } }
        else {
          gd.searchT = 0;   // still on the way (possibly to a NEW noise): the look-around clock starts on arrival, a stale one must not cut the search short
          if (whistleSoft(gd)) gd.awareness = Math.max(gd.awareness, WHISTLE.walkFloor);
          attentionWalk(g, gd);   // (attention.ts: the same floor under any thing that has his attention)   // a whistle he chose to answer does not drain away under him two strides short of the spot: it holds while he walks, and the look round on arrival wears it off (whistle.ts)
          // …but four seconds of getting nowhere (a leaf somebody is holding against him, a colleague planted on the spot, a fix just inside a wall): he looks about from
          // where he stands instead of grinding at it until the suspicion wears off — his fix becomes the spot he is on (the alert state has its own such escape)
          if ((!gd.task || gd.task.kind === 'checkOn') && notGettingAnywhere(gd, dt, 4)) {   // (the breaker / rack errands are worth grinding toward, and their block above puts the fix straight back)
            if (gd.task) advanceCheckOn(g, gd);   // a waypoint of the missing man's he cannot get to counts as looked at: the next
            else { gd.lastKnown = v3.copy(c.pos); gd.stallRef = null; gd.path = []; gd.pathGoal = null; }
          }
        }
      }
      if (gd.awareness < 0.12) {   // talked himself calm. The line depends on what it was: over a found body one man closes it for everybody, and nobody within a few metres of a
        const D = gd.bodyDuty;     // body the floor knows about ever calls it 'nothing' / 'clear' (that read as the men cycling platitudes over a dead colleague); once alarmed, nothing is 'nothing'
        gd.state = 'patrol'; gd.path = []; gd.pathGoal = null; gd.bodyDuty = null;
        if (gd.foe === 'player' && g.player.down) { if (!g.stoodDown) { g.stoodDown = true; g.say(gd, gd.unit && CUES.on ? "he's down — hold where you are" : 'back to your posts', true); } }   // (a scenario's defenders go back nowhere: they hold where the fight left them — cues.ts)
        else if (D) { if (!D.body.bodyClosed && D.body.bodyVisits > 0 && v3.distXZ(c.pos, bodyPos(D.body)) < 12) { D.body.bodyClosed = true; g.say(gd, isBreathing(D.body) ? `no sign of him. ${D.body.callsign} is breathing, he'll ${wg('be okay', 'keep')} — whoever dropped him is still close` : "no sign of him — eyes open, he's close"); } }   // (once, by a man thereabouts, and only if anybody got to the body at all — a called man giving up two rooms off says nothing; over a man out cold it says so)
        else if (!staff) { /* a unit calms without the staff's platitudes (his 'clear.' was said when the fight ended, teams) */ }
        else if (!nearKnownBody(g, c.pos, 4) && !(gd.bubble?.radio && g.time - gd.bubble.t < 4) && !attentionTold(g, gd)) g.say(gd, lvl >= 1 ? 'clear here — staying on it' : 'must have been nothing');   // (and not on top of his own radio line of a moment ago — 'not at his post', 'checking the breaker': that said it)
      }
      c.aimPitch = damp(c.aimPitch, -0.12, 3, dt);
      break;
    }
    case 'alert': {
      upper = 'aim';
      noteDoorCrossings(g, gd);   // (a doorway run through with eyes on Sam is still the one he has just come through, should he lose him beyond it and turn back)
      const pc = foeChar(g, gd); const down = foeDown(g, gd);   // teams: the man his gun is on — Sam for the staff (g.player.char, as it always read), a hostile AI man for a unit, null for a unit with nobody yet (no round, no closing: he works his fix like a man who has only heard you)
      const canShoot = !!pc && !down && !dazzled && !staggered && (g.time - gd.lastSeenT < 0.5);   // half a second of grace after a real sighting; a dazzled guard cannot shoot at all, nor a man doubled over a ring
      if (gd.reactT > 0 || !canShoot) { gd.shotBlockedT = 0; gd.lineInT = 0; }   // (the blocked-line clocks belong to one engagement: a fresh sighting at another doorway starts by holding the round again, not on the last one's count)
      if (gd.reactT > 0 || down || gd.pinned) { gd.stallRef = null; gd.chaseT = 0; }   // (seconds spent covering, reacting or holding a post are not seconds of getting nowhere; eyes on him resets the clocks in the perception above — unless his line is blocked and there is nowhere to step, below, when they must run)
      const supNow = T.suppression && !gunHoldRuns(g, gd) ? headDown(g, gd, dt) : 'none';   // suppression (suppression.ts, docs/internal/sc20k-design.md §4.2): rounds close enough, often enough, and his head is down — or he is shifting to cover — ahead of everything else the fight does (the flinch below that is the plain fight's: wider, later, no sprint into it)
      if (supNow !== 'none') {
        // Head down: crouched behind whatever he stands at, the gun lowered, feet still, not a round (fireCd floored: the first one after coming up is a beat late,
        // not on the frame) — turned toward where it is coming from (the muzzle the last close round left, else his fix). His eye drops with him (canSee reads the
        // head bone): behind a partition or a desk he LOSES Sam for the duration and has to find him again coming up — Sam's window is real, and visible (the laser
        // leaves him with the lowered gun). Or the shift (displaceAfter seconds of it): a bent-low jog to the cover spot headDown chose, the plain fight again from
        // there after a beat (endDisplace / holdingCover). The CONTACT beat, a dazzle and a magazine change all run on under it; the fight's line clocks start afresh.
        const S = gd.sup; duck = true; gd.shotBlockedT = 0; gd.lineInT = 0; gd.chaseT = 0; gd.fireCd = Math.max(gd.fireCd, SUPPRESSION.headDownDelay);
        if (gd.reactT > 0) gd.reactT -= dt;
        if (gd.reloadT >= 0) tickReloadBeat(g, gd, dt);
        const threat = S.src && g.time - S.srcT < SUPPRESSION.srcMemorySecs ? S.src : gd.lastKnown ?? pc?.pos ?? aimAhead(c);
        aimAt = [threat[0], 1.1, threat[2]];
        if (supNow === 'down') { crouch = 1; gd.speed = damp(gd.speed, 0, 8, dt); c.vel = [0, 0, 0]; gd.stallRef = null; }
        else {
          crouch = SUPPRESSION.displaceCrouch; goTo(g, gd, S.cover!);
          const arrived = followPath(g, gd, dt, T.guardInvestigate * SUPPRESSION.displacePace); moveSpeed = gd.speed;
          if (arrived) endDisplace(g, gd, 'there'); else if (notGettingAnywhere(gd, dt, 1.5)) endDisplace(g, gd, 'going nowhere'); else if (g.time - S.displacedAt > SUPPRESSION.displaceCapSecs) endDisplace(g, gd, 'out of time');
        }
      }
      else if (gd.reactT > 0) { gd.reactT -= dt; aimAt = (dazzled || g.time - gd.lastSeenT > 0.5) && gd.lastKnown ? v3.add(gd.lastKnown, [0, 1.1, 0]) : pc ? v3.add(pc.pos, [0, 1.2, 0]) : null; gd.speed = damp(gd.speed, 0, 8, dt); }   // heard, not seen: he covers where he thinks it came from, not your true position through three walls   // a dazzled guard covers where he last knew you were, not where you are   // (nobody and nothing to go on: the gun stays where it is)
      else if (gd.standoff && pair) { const r = standoffAlert(g, gd, dt, pair); moveSpeed = r.move; aimAt = r.aim; crouch = r.crouch; gd.shotBlockedT = 0; gd.lineInT = 0; }   // a colleague in Sam's arm, in his view: the ring, the flank, the slow aimed round, the talking — never the push (standoffAlert)
      else if (canShoot && pc) {
        // Where the rounds go: the chest (lower when crouched) — or, when something a round stops in stands between his GUN and it that his eye clears (canSee said
        // yes: the jamb on his gun-hand side, a leaf standing between them, a mullion, the desk or partition Sam is hull-down behind, a glass pane — sight passes the
        // glazing, a round stars it and stops: clearShot asks col.shotBlocked), the head if that can be reached; and when neither can from where he stands, he closes
        // along the path — through the doorway, round the desk — until one can, instead of planting on his line of SIGHT and emptying magazines into the door frame
        // or the pane (the 'aim stuck in the door' of the playtest: eye line a hand inside the jamb, muzzle line on it, a man rooted at the doorway firing at wood
        // for as long as Sam stood there; and its twin on the corridor outside the conference room, round after round into the glass at a man in plain view). He
        // never fires a line he knows is blocked. A pinned man (the tour's firefight) fires from where he was put at what he was always given, cover or no cover —
        // that beat is built on rounds meeting the end caps.
        // aim at where his trunk IS, not his root column: pressed to a wall (or leaning into a peek) the pose carries hips and chest ~30 cm off the root, and a
        // line down the root met neither a capsule nor bodyHit's hips-centred cylinder — a wall-hugging Sam was bullet-proof at 1.6 m (hold-draw lane's soak find)
        const crouched = foeCrouched(g, gd);   // (Sam's crouch; a hostile AI man's head-down / a drill's knee — teams)
        { const trunk = pc.bones.spine2 ?? pc.bones.hips; aimAt = [trunk ? trunk[0] : pc.pos[0], pc.pos[1] + (crouched ? 0.8 : 1.25), trunk ? trunk[2] : pc.pos[2]]; }
        let blocked = false;
        if ((!gd.pinned || paneFirst(g, c, aimAt)) && !clearShot(g, c, aimAt)) {   // (paneFirst: the one line a pinned man is asked about — ?glassfoes=0 and standing glass first in it)
          const head = pc.bones.head ?? v3.add(pc.pos, [0, crouched ? 1.05 : 1.6, 0]);
          if (clearShot(g, c, head)) aimAt = head; else blocked = true;
        }
        if (!blocked && !gd.pinned && boreFouled(g, gd)) blocked = true;   // two of his rounds running went into the frame from this spot — a hand off the muzzle, or anything on his own half of the line (aim.ts noteBore): the shoulder's line clears the jamb, the bore does not — no line from here, he closes / steps for a real one (model off: never)
        if (blocked && coverSeen(g, gd, gd.foe, aimAt)) blocked = false;   // (coverfire.ts: what stands in the line is breakable and he knows the man is behind it — the rounds go into it, by every gate below)
        const facingErr = Math.abs(wrapAngle(Math.atan2(aimAt[0] - c.pos[0], aimAt[2] - c.pos[2]) - c.gunYaw));   // (gunYaw: aimYaw — or, turning under weight (character.ts TURN), where the gun has got to)
        const walled = !gd.pinned && gunWallCheck(g, gd, 'aim', aimAt, dt, true);   // (gunwall.ts: a wall, a jamb or a leaf inside the raised gun's reach on this line — it is at the low ready, and that is no line from here either)
        const poked = !gd.pinned && (armThrough(g, c) || walled);   // his pistol out through the far face of the leaf he is pressed to, or into the jamb (fireWeapon puts that round into the wood): never fired, and once his aim has settled it counts as no line from here — he steps clear
        if (poked && facingErr < 0.3) blocked = true;
        gd.shotBlockedT = blocked ? gd.shotBlockedT + dt : 0;
        const inLine = muzzleCheck(g, gd, aimAt, dt);   // a colleague between his gun and Sam (or just beyond him): the pistol goes to the low ready and stays there while he is in the line — worked out here, before the round, on the line he means to fire
        const crossingMan = !!inLine && Math.hypot(inLine.char.vel[0], inLine.char.vel[2]) > 0.4;
        gd.lineInT = inLine ? gd.lineInT + dt : 0;
        // keep some distance, otherwise hold position and fire (a pinned guard fires from where he was put) — unless nothing fired from here can reach him: then he
        // closes in along the path (to Sam himself: it threads the doorway square-on and clears the leaf) and plants again the moment a line opens. Blocked with
        // no way of closing at all (in plain sight somewhere no route reaches — a slot no man fits): he holds the round and the chase clocks run, and after a few
        // seconds of it he lets the shot go and searches from where he is rather than stand at '!' on a line he cannot use. A colleague in the line and nothing
        // else keeping the round in: a man walking across it is waited out for a beat (he will be through), one standing in it — or still in it after the beat —
        // is stepped round to the side that opens the line (lineStep), and where no step can open it he pushes up the path past the man: a fight never stalls on manners.
        let closing = false, stepping = false;
        const dbg = LINE_DEBUG.log;
        if (!gd.pinned && (dist > 9 || blocked) && !holdingCover(g, gd)) {   // (suppression.ts: a cover spot just reached under fire is held a few seconds, line or no line, before he closes again — and rattled, he advances at the jog, not the sprint into it)
          const brake = aimBrake(g, gd, dist, blocked);   // the aim-settle model (aim.ts): a line, Sam inside the shoot band, the gun about ready — he brakes to a standstill for the shot (nothing aimed leaves a running man) and picks the run up again on the weapon's beat; false with the model off
          if (brake && gd.speed < 0.3) { gd.speed = damp(gd.speed, 0, 6, dt); c.vel = [0, 0, 0]; closing = true; }   // planted for it: feet still, the chest comes round onto Sam (the aim block below), the round goes when the track is there
          else { goTo(g, gd, pc.pos); closing = !followPath(g, gd, dt, brake ? 0 : flinching(g, gd) ? T.guardInvestigate : T.guardChase); if (brake) gd.speed = damp(gd.speed, 0, 6, dt); }
          moveSpeed = gd.speed;
          dbg?.(gd, `ALERT closing (dist ${dist.toFixed(2)} blocked ${blocked}${brake ? ' BRAKING' : ''}) path ${gd.pathI}/${gd.path.length} speed ${gd.speed.toFixed(2)} muzzleDown ${gd.muzzleDown} inLine ${inLine ? g.level.routes[inLine.routeI]?.name : '-'}`);
        }
        else if (!gd.pinned && gd.muzzleDown && !(crossingMan && gd.lineInT < 0.45)) {
          const st = lineStep(g, gd, aimAt, inLine, dt);
          if (st === 'step') { stepping = true; moveSpeed = gd.speed; }
          else if (st === 'none' && dist > LINE_PUSH_MIN_M) { goTo(g, gd, pc.pos); followPath(g, gd, dt, T.guardInvestigate); moveSpeed = gd.speed; }   // nowhere to step that opens it (the corridor too narrow for the angle): up the path past the man until it does
          else { gd.speed = damp(gd.speed, 0, 6, dt); c.vel = [0, 0, 0]; }
          dbg?.(gd, `ALERT line (dist ${dist.toFixed(2)} inLine ${inLine ? g.level.routes[inLine.routeI]?.name : '-'} crossing ${crossingMan} lineInT ${gd.lineInT.toFixed(2)}) → ${st}${st === 'none' ? (dist > LINE_PUSH_MIN_M ? ' → push up the path ' + gd.pathI + '/' + gd.path.length : ' → wait') : ''} pos ${c.pos[0].toFixed(3)},${c.pos[2].toFixed(3)}`);
        }
        else if (DOORMANNERS.on && offThreshold(g, gd, aimAt, dt, true)) moveSpeed = gd.speed;   // planted in an open doorway (doorway.ts): through it and off the opening, to a spot with the shot
        else { gd.speed = damp(gd.speed, 0, 6, dt); c.vel = [0, 0, 0]; dbg?.(gd, `ALERT hold+fire (dist ${dist.toFixed(2)} muzzleDown ${gd.muzzleDown} inLine ${inLine ? g.level.routes[inLine.routeI]?.name : '-'} crossing ${crossingMan} lineInT ${gd.lineInT.toFixed(2)} fireCd ${gd.fireCd.toFixed(2)}) pos ${c.pos[0].toFixed(3)},${c.pos[2].toFixed(3)}`); }
        if (!(blocked && !closing)) { if (!stepping) gd.stallRef = null; gd.chaseT = 0; }   // (the side-step keeps its own no-headway watch on stallRef)
        else if (gd.shotBlockedT > 4 && !gd.pinned) { dropToSearch(g, gd, 'no shot — lost him'); gd.awareness = Math.min(gd.awareness, 0.5); break; }
        gd.fireCd -= dt;
        const twisted = moveSpeed > 0.3 && Math.abs(wrapAngle(c.bodyYaw - c.aimYaw)) > 0.9;   // legs following a path that has turned away from Sam (back through a doorway to come at him): he keeps moving and holds the round rather than fire across his own back
        // The shield, for a man with eyes on Sam (canShoot) but no standoff record this frame — the frame the record comes or goes, or a sight of Sam that somehow is
        // not a sight of the pair: with muzzle discipline on, a living colleague in Sam's arm holds EVERY round aimed at Sam, not only the standoff's (the held man
        // is who a round from in front finds first, combat.ts fireWeapon), and the same beat is kept in hand for when he is out of it.
        const shield = T.muzzleDiscipline && shieldUp(g);
        if (shield) gd.fireCd = Math.max(gd.fireCd, SHIELD_RELEASE_BEAT_MIN + dt);   // (+dt as in standoffAlert: measured from the frame the man leaves the arm, not this one)
        if (sideLocked(g, gd)) { /* (gunslots.ts: his hands are between his two guns, or off his gun for a charge — no round, no magazine) */ }
        else if (gd.reloadT >= 0) tickReloadBeat(g, gd, dt);
        else if (gd.weapon.def.burst) burstTrigger(g, gd, dt, aimAt, !shield && facingErr < 0.25 && !blocked && !twisted && !poked && !gd.muzzleDown && aimReady(g, gd), !shield && !twisted && !poked && !gd.muzzleDown);   // the carbine: short bursts through the same gates — all of them to begin one (aimReady among them: a burst is gated on the track at its START, not round by round — aim.ts), the per-round ones (the shield, a colleague in the line, poked, twisted) to let each round of it go (rifles, burstTrigger)
        else if (!shield && gd.fireCd <= 0 && facingErr < 0.25 && !blocked && !twisted && !poked && !gd.muzzleDown && !roundPastColleague(g, gd, aimAt) && aimReady(g, gd) && gd.weapon.fire()) {   // (muzzleDown: the pistol is not even up — a colleague is, or a beat ago was, in the line; roundPastColleague: the bore's own line this frame, the last look in a scrum; aimReady: lined up on him — the aim model's first-shot gate, aim.ts, always true with it off; weapon.fire last: the round is only cycled out of the gun once everything else has said yes)
          const W = gd.weapon.def, M = guardFireMods(g, gd); gd.fireCd = (W.cd + simRandom() * W.cdJitter) * M.gap; fireWeapon(g, c, aimAt, false, guardRound(g, gd, M.spread)); noteBore(g, gd, aimAt);   // the weapon's cadence: its floor plus the drawn jitter (the 9 mm's 0.55–1.05 s) — stretched, and the round wider, by the rounds going past his own head (suppression.ts guardFireMods: ×1 / +0 at rest, so a quiet fight is the fight it was); the cone through the aim model (aim.ts guardRound: settle × his row + Sam crossing + his own feet — { spread: M.spread } exactly with it off; noteBore: a round into the frame a hand off the muzzle is remembered against this spot)
          if (gd.weapon.roundsReady === 0) startReloadBeat(g, gd);
        }
      } else if (down && pc) {
        // the target is down: close to a couple of metres, cover the body, one of them calls it in — nobody 'searches' for a man lying in front of them
        const body = pc.pos; const dB = Math.hypot(body[0] - c.pos[0], body[2] - c.pos[2]);
        if (dB > 2.2) { goTo(g, gd, body); followPath(g, gd, dt, T.guardInvestigate); moveSpeed = gd.speed; } else { gd.speed = damp(gd.speed, 0, 6, dt); c.vel = [0, 0, 0]; }
        aimAt = v3.add(body, [0, 0.3, 0]); gd.searchT += dt;
        if (gd.searchT > 4 && !g.calledIn && staff) { g.calledIn = true; g.say(gd, WORDS.on && !isOffice(g.level) ? 'target is down. send someone over.' : 'target is down. send someone up.', true); g.audio.play('radio', c.bones.head ?? c.pos, 0.5, { rate: 0.95 }); }   // (the staff's net: a unit covers his man and says nothing up any chain)
        if (gd.searchT > 14) { gd.state = 'suspicious'; gd.awareness = 0.3; gd.searchT = 0; gd.reactT = 0; gd.lastKnown = v3.copy(body); }   // eventually they lower their weapons and mill about the body
      } else if ((aimAt = coverBlind(g, gd, dt))) { gd.speed = damp(gd.speed, 0, 6, dt); c.vel = [0, 0, 0];   // (coverfire.ts: the man went behind something breakable a moment ago — stood still, his aimed rounds go into it; null = nothing of the kind, the branches below as ever)
      } else if ((forced = doorForce(g, gd, dt))) { aimAt = forced.aim; moveSpeed = forced.move;   // (doorforce.ts: he is sure an enemy is at the far face of a shut door — his rounds go through a wooden leaf, and a free man ends by booting it in; null = nothing of the kind, and always with its switch off)
      } else if (gd.lastKnown && gd.pinned) {   // scripted: hold the position, cover where he was last seen
        aimAt = v3.add(gd.lastKnown, [0, 1.1, 0]);
        if (DOORMANNERS.on && offThreshold(g, gd, aimAt, dt, false)) moveSpeed = gd.speed;   // (doorway.ts: pinned where he stopped, and that is an open doorway — a step off it first)
        else { gd.speed = damp(gd.speed, 0, 6, dt); c.vel = [0, 0, 0]; }
      } else if (gd.lastKnown) {
        // a fix, no eyes on him: the pursuit tactics first (tactics.ts — a role in a flanking approach, or the lone man's angle on an armed intruder; null =
        // none of it applies, and always null with tune.tactics off), else the chase it always was (chaseFix, the very lines that stood here)
        const r = (T.tactics ? tacticsAlert(g, gd, dt) : null) ?? chaseFix(g, gd, dt, T.guardChase);
        moveSpeed = r.move; aimAt = r.aim; pied = r.pied; crouch = r.crouch;
      } else if (!gd.pinned && !gd.hold && g.time - gd.lastSeenT > 2) dropToSearch(g, gd, null);   // alert with nothing to go on and nobody's orders to hold: everything that takes awareness this high leaves a fix, so this should not happen — but a free man must never be able to stand at '!' for good (a pinned / held one is standing where the beat put him)
      break;
    }
    case 'search': {
      upper = 'aim';
      if (foeDown(g, gd)) { gd.state = 'alert'; gd.reactT = 0; gd.searchT = 0; gd.searchPlan = null; break; }   // a body on the floor is not a search: go and cover it (alert branch above)
      gd.searchT += dt; gd.sweep = Math.sin(gd.lookPhase * 1.2) * 1.3; c.anim.lookYawExtra = Math.sin(gd.lookPhase * 2.1) * 0.45;
      let sweepK = 1;   // the wide sweep of eyes and muzzle while he stands (half as wide on the move) — put on his aim below unless something this frame gives him a point to hold (a spot, a doorway's slice)
      const P = AI_TUNE.darkSearch ? searchPlanFor(g, gd) : null;   // the hide spots round the fix, dark × cover × plausible (see searchPlanFor); null = the old sweep-and-wander (QA before / after)
      let over = false;
      if (!P || P.phase !== 'walk' || dazzled) gd.speed = damp(gd.speed, 0, 6, dt);   // (the old wander ambles against this brake, as it always did; the walk to a spot is a purposeful one at the investigate pace)
      if (!P) {
        // wander to a couple of nearby points (not while dazzled: a blind man does not go for a walk)
        if (!dazzled && gd.searchT > 3 && gd.lastKnown && (!gd.path.length || gd.pathI >= gd.path.length)) {
          const a = simRandom() * Math.PI * 2; const cand: Vec3 = [gd.lastKnown[0] + Math.cos(a) * 3, 0, gd.lastKnown[2] + Math.sin(a) * 3];
          if (!g.col.nav.isBlocked(cand[0], cand[2])) { goTo(g, gd, cand, true); gd.stallRef = null; }
        }
        if (!dazzled && gd.path.length && gd.pathI < gd.path.length) {
          const pie = pieDoorway(g, gd, dt, T.guardInvestigate, false); pied = true;
          followPath(g, gd, dt, pie.speed); moveSpeed = gd.speed; sweepK = 0.5; if (pie.look) { aimAt = pie.look; c.anim.lookYawExtra = 0; }
          // a wander point he cannot actually get to (behind a leaf standing at its stop, say): three seconds of no headway and he drops it and sweeps from where he is
          if (notGettingAnywhere(gd, dt, 3)) { gd.path = []; gd.pathGoal = null; gd.stallRef = null; }
        }
        over = gd.searchT > SEARCH_MIN_SECS;
      } else {
        searchProbes(g, gd, P);   // his share of this frame's light readings: asked of the renderer, and the answers that have come back folded in
        if (dazzled) { /* rooted and sweeping (above): a blind man does not go for a walk */ }
        else if (P.phase === 'sweep') { if (gd.searchT > SEARCH_SWEEP0_SECS) pickNextSpot(g, gd, P); }   // the first look round from where he lost him — and a second's readings in hand before choosing
        else if (P.phase === 'walk') {
          const s = P.spots[P.current];
          goTo(g, gd, s.pos);
          const pie = pieDoorway(g, gd, dt, T.guardInvestigate, false); pied = true;   // a doorway between him and the spot gets sliced on the way
          const arrived = followPath(g, gd, dt, pie.speed); moveSpeed = gd.speed; sweepK = 0.5;
          const dS = v3.distXZ(c.pos, s.pos); const eye = c.bones.head ?? v3.add(c.pos, [0, 1.65, 0]);
          const inSight = dS < 4.5 && !g.col.segmentBlocked(eye, [s.pos[0], 0.4, s.pos[2]]);
          if (pie.look) { aimAt = pie.look; c.anim.lookYawExtra = 0; }
          else if (inSight) { aimAt = [s.pos[0], 0.35, s.pos[2]]; c.anim.lookYawExtra = 0; }   // coming up on it: the light goes down INTO the well / the corner ahead of his feet
          if ((inSight && dS < SEARCH_LOOK_DIST_M) || arrived) { P.phase = 'look'; P.phaseT = 0; gd.path = []; gd.pathGoal = null; gd.stallRef = null; }   // at the mouth of it (or as near as the floor lets him)
          else if (notGettingAnywhere(gd, dt, 3)) { s.unreachable = true; s.by = c.id; pickNextSpot(g, gd, P); }   // three seconds of no headway (a leaf held against him, a colleague planted in the gap): that one is as looked-at as it will get
        }
        else if (P.phase === 'look') {   // planted, torch held into the spot low, a slow inch across it; then it is done — for everybody searching — and on to the next
          const s = P.spots[P.current]; P.phaseT += dt;
          gd.speed = damp(gd.speed, 0, 8, dt); c.vel = [0, 0, 0]; c.anim.lookYawExtra = 0;
          const w = Math.sin(P.phaseT * 4.0) * 0.35; const to = v3.sub(s.pos, c.pos); const L = Math.hypot(to[0], to[2]) || 1;
          aimAt = [s.pos[0] - to[2] / L * w, 0.3, s.pos[2] + to[0] / L * w];
          if (P.phaseT > SEARCH_LOOK_SECS) { s.visited = true; s.by = c.id; P.visits++; pickNextSpot(g, gd, P); }
        }
        // 'done': nothing left worth the walk — he sweeps from where he stands (above) until the search's clock lets him go
        over = gd.searchT > SEARCH_MIN_SECS && (P.phase === 'done' || gd.searchT > SEARCH_CAP_SECS);
        if (over) gd.lastKnown = v3.copy(c.pos);   // the look round that follows ('suspicious' for a couple of seconds) happens where the search ended, not back at a fix he has just combed round
      }
      if (over) { gd.state = 'suspicious'; gd.awareness = 0.25; gd.searchT = 0; gd.reactT = 0; gd.searchPlan = null; g.say(gd, staff ? 'returning to patrol' : defenderWords(gd) ? 'lost them.' : 'lost him.'); chronCalm(g, gd); }
      if (!aimAt) { c.aimYaw = c.bodyYaw + gd.sweep * sweepK; c.aimPitch = damp(c.aimPitch, -0.1, 3, dt); }   // (a point to hold goes through the aim easing below instead — the sweep written over it every frame would have the torch waving past the spot he means to look into)
      break;
    }
  }
  if (!pied || (gd.state !== 'alert' && gd.state !== 'search')) gd.pieing = null;   // (only a hunting walk pies a doorway; anything else this frame — contact, a body, calm, orders, the search ending under it — leaves none half done)
  const eyesOnFoe = gd.state === 'alert' && !!aimAt && g.time - gd.lastSeenT < 0.5;   // (a man who SEES the man he is fighting keeps his muzzle on him: the drill's stations are for a doorway nobody is standing in — soak seed 2, 08-12: two QRF men at their own danger-marked door aimed at the opening and put every round into the frame beside Sam 0.7 m off)
  if (T.tactics && !eyesOnFoe) { const tl = tacticsLook(g, gd); if (tl) { aimAt = tl.aim; crouch = Math.max(crouch, tl.crouch); } }   // a man on a kill-zone doorway's drill (tactics.ts doorGate): his eyes and muzzle on the opening / the slice's stations / the floor while the charge goes, and how low he is
  if (DARKDOOR.on && !eyesOnFoe) { const dl = darkDoorLook(g, gd); if (dl) aimAt = dl; }   // stopped at a dark doorway (darkdoor.ts): his aim, and his light with it, sweeps the opening from the frame (null for everybody else)
  { const nq = netQuietPose(g, gd, dt, eyesOnFoe); if (nq) { if (nq.aim) aimAt = nq.aim; crouch = Math.max(crouch, nq.crouch); } }   // netquiet.ts (null on its first line with its switch off): the last man low on his spot, a jumpy man's gun and lamp onto the noise he has just heard
  if (aimAt) {
    const yawTo = Math.atan2(aimAt[0] - c.pos[0], aimAt[2] - c.pos[2]);
    if (AIM_DEBUG.log && gd.state === 'alert') AIM_DEBUG.log(`g${c.id} aim block: yawTo ${yawTo.toFixed(2)} aimYaw ${c.aimYaw.toFixed(2)} → aimAt (${aimAt[0].toFixed(2)}, ${aimAt[1].toFixed(2)}, ${aimAt[2].toFixed(2)}) bodyYaw ${c.bodyYaw.toFixed(2)} speed ${moveSpeed.toFixed(2)}`);   // (soak --trace: chasing a chest that settles off its man)
    c.aimYaw = approachAngle(c.aimYaw, yawTo, 6 * dt);
    const gunY = c.pos[1] + 1.4; const hd = Math.hypot(aimAt[0] - c.pos[0], aimAt[2] - c.pos[2]);
    c.aimPitch = damp(c.aimPitch, Math.atan2(aimAt[1] - gunY, Math.max(hd, 0.5)), 5, dt);
    // turn body if aim exceeds twist range or when standing
    const off = wrapAngle(c.aimYaw - c.bodyYaw);
    if (moveSpeed < 0.3 && Math.abs(off) > 0.5) c.bodyYaw = approachAngle(c.bodyYaw, c.aimYaw, 5 * dt);
  }
  // clamp aim into twist range
  const off = wrapAngle(c.aimYaw - c.bodyYaw); if (Math.abs(off) > 1.5) c.aimYaw = c.bodyYaw + Math.sign(off) * 1.5;
  // collisions
  collideGuard(g, gd, p0x, p0z);
  // muzzle discipline: with the pistol up (every armed state — the heightened patrol's low carry, a fix being covered, the search's sweep), a living colleague in
  // the line he means it along puts it to the low ready until he is out of it (the alert branch has already asked, on the line of the shot itself)
  if (startleHolds(g, gd)) { upper = 'none'; duck ||= handCarry(gd) !== 'torch'; }   // (startle.ts: in his start the gun is not up — a weapon at the low ready, the torch still the torch; false for every man with no start on him)
  if (gd.muzzleEvalT !== g.time) muzzleCheck(g, gd, upper === 'aim' ? (aimAt ?? aimAhead(c)) : null, dt);
  if (!gd.pinned) gunWallCheck(g, gd, upper === 'aim' ? 'aim' : null, aimAt, dt, gd.state === 'alert');   // …and a wall inside the raised gun's reach does the same (gunwall.ts; nothing with its switch off)
  if (g.time < gd.doorDownUntil) crouch = 1;   // (doorthrow.ts: he stood right at a door that was booted in — on a knee for the fold; the stamp is never written with its switch off)
  const lowered = gd.muzzleDown || duck || staggered;   // the gun down: for a colleague in the line, with his own head down under fire (suppression), or doubled over a ring airfoil — the same low ready ('lowLong' on the carbine, the animator's mapping)
  c.anim.speed = moveSpeed; c.anim.upper = lowered ? 'none' : upper; c.anim.crouchTarget = crouch; c.anim.lean = 0; c.anim.stance = lowered ? 'lowReady' : 'none';   // (the tactical stances the AI holds by itself: muzzle down for a colleague, head down under fire — otherwise none and standing, and a script that just ended must not leave one on him)
  gunWallPose(g, c);
  c.anim.reverse = moveSpeed > 0.2 && c.vel[0] * Math.sin(c.bodyYaw) + c.vel[2] * Math.cos(c.bodyYaw) < -0.3 * moveSpeed;   // moving against his facing (the standoff's back-off and side-step round the ring keep his chest to the pair): the cycle plays backwards, as the player's back-pedal does — and worked out afresh every frame, so nothing (a hold that ended mid-haul) leaves it stuck on him
  c.update(dt);
  attachFlashlight(g, gd, dt);
  const prevPhase = gd.stepPhase; gd.stepPhase = c.anim.phase;
  if (moveSpeed > 0.4 && ((prevPhase < 0.5) !== (gd.stepPhase < 0.5))) {
    if (TAPSTEP.on) tapHears(g, c.pos);   // (tapstep.ts: Sam can step under it)
    const loud = tread(g, c.pos, teamTread(g, gd, moveSpeed, 0.33), false);   // (kitload.ts: a teammate's card — the gait he was asked for, × what he rattles)   // (walking steps carry the walk clip's retime — 1.06 m/s natural, ~1.4x the steps per metre — at the old per-second loudness: 0.45 x 0.73; the run's cadence is unchanged; × the floor he is on, floor.ts — presentation only, nobody hears a guard)
    if (!staff) g.events.push({ kind: 'step', pos: v3.copy(c.pos), time: g.time, loud: false, level: loud, who: c.id });   // …but a UNIT's footfall is a sound in the world for the side that hunts him (teams: hearingCheck stepIsThreat) — the staff's stay presentation, as ever
  }
}

// ------------------------------------------------------------ the guards' collision at the bottom of the frame: the statics, the colleagues, and the statics again — swept
/** Longest stride the static sweep takes in one go: from a spot clear of every face a stride this short cannot carry his centre past the middle of the thinnest thing
 *  in the level (10 cm cubicle panels, 12 mm panes: 0.3 + a hair), so every push-out sends him back the way he came — never out of the far side (the player's
 *  SWEEP_STEP is the same idea for his wider circle). At 60 Hz nobody's own feet cover it in a frame; the shove of two men leaning on him, or the clock sped up
 *  three times, do. */
const GUARD_SWEEP_STEP = 0.2;
/** the most the colleagues' shove may carry a man in one frame: under a body's clearance, so even summed over a stack it cannot by itself put his centre through a face he stood clear of */
const SEP_MAX_M = 0.25;
/** a shove shorter than this is not settled against the statics again this frame (step 3) but by next frame's pass, as every shove used to be: two men easing a
 *  body apart move millimetres a frame and can be left at that (a hair inside a skirting for one frame draws nowhere and tunnels nothing); the shove of a stack
 *  pressing on him is centimetres a frame and is settled at once. (Also what keeps every seeded QA night byte for byte the night it was: tools/qa *-identity.) */
const SEP_SETTLE_MIN = 0.02;
/** The bottom of updateGuard. In order: (1) the statics — his 0.3 m circle pushed out of the boxes between shin and shoulder, three passes, exactly as ever — but
 *  reached by a SWEEP from where this frame's feet started (`p0x`, `p0z`; or from where a snap has just stood him — un-stick) in strides of ≤ GUARD_SWEEP_STEP with a
 *  push-out after each whenever the frame's displacement is longer than one stride (never, at 60 Hz and the men's own paces; a chase at __timeScale 3 is 0.4 m a
 *  frame, and used to resolve to whichever side of a 10 cm panel the raw position landed nearer); (2) the colleagues — every living man within 0.6 m pushes him half
 *  their overlap apart, each in turn, as ever — the whole of it now capped at SEP_MAX_M; (3) the statics AGAIN for whatever the shove did: swept from where (1) left
 *  him to where (2) put him, so a man shoved by the two leaning on him in a stack beside a cubicle panel or the conference glass slides along it instead of ending the
 *  frame inside it — or, past the middle of a thin one, out of its far side next frame (review W8.5: 8 in 10 at 0.40 m). A man nobody is touching, moving at his own
 *  pace, makes exactly the calls he always made; (3) is a no-op for a shove along open floor. */
function collideGuard(g: Game, gd: Guard, p0x: number, p0z: number) {
  const c = gd.char; const dbg = LINE_DEBUG.log;
  // (1) statics, swept from the frame's start (or the snap's spot)
  const snapped = UNSTICK.lastSnapWho === gd && UNSTICK.lastSnapT === g.time;
  sweepStatics(g, c, snapped ? gd.lastPos[0] : p0x, snapped ? gd.lastPos[2] : p0z, dbg ? (m: string) => dbg(gd, m) : null);
  const bx = c.pos[0], bz = c.pos[2];
  g.col.collideCircle(c.pos, c.radius, 0.2, 1.5);   // same height band as the nav grid bake
  if (dbg && Math.hypot(c.pos[0] - bx, c.pos[2] - bz) > 1e-4) dbg(gd, `PUSH statics ${(c.pos[0] - bx).toFixed(4)},${(c.pos[2] - bz).toFixed(4)}`);
  // (2) colleagues (each in turn off where the last left him — the arithmetic it always was — then the whole of it capped)
  const ax = c.pos[0], az = c.pos[2];
  for (const o of g.guards) {
    if (o === gd || o.state === 'dead') continue;
    const d = v3.sub(c.pos, o.char.pos); d[1] = 0; const l = v3.len(d);
    if (l < 0.6 && l > 1e-4) { c.pos = v3.mad(c.pos, d, (0.6 - l) / l * 0.5); dbg?.(gd, `PUSH colleague ${g.level.routes[o.routeI]?.name} at ${l.toFixed(3)} m by ${((0.6 - l) * 0.5).toFixed(4)} dir ${(d[0] / l).toFixed(2)},${(d[2] / l).toFixed(2)}`); }
  }
  const sl = Math.hypot(c.pos[0] - ax, c.pos[2] - az);
  if (sl <= SEP_SETTLE_MIN) return;   // nobody touching him — or the millimetres of two men settling a body apart, left to next frame's pass (1) as they always were: done
  if (sl > SEP_MAX_M) { c.pos[0] = ax + (c.pos[0] - ax) * (SEP_MAX_M / sl); c.pos[2] = az + (c.pos[2] - az) * (SEP_MAX_M / sl); dbg?.(gd, `PUSH colleagues capped ${sl.toFixed(3)} → ${SEP_MAX_M}`); }
  // (3) the statics again for the shove: swept from where (1) left him, settled where he stops (a no-op along open floor)
  sweepStatics(g, c, ax, az, dbg ? (m: string) => dbg(gd, m) : null);
  const cx = c.pos[0], cz = c.pos[2];
  g.col.collideCircle(c.pos, c.radius, 0.2, 1.5);
  if (dbg && Math.hypot(c.pos[0] - cx, c.pos[2] - cz) > 1e-4) dbg(gd, `PUSH statics after the shove ${(c.pos[0] - cx).toFixed(4)},${(c.pos[2] - cz).toFixed(4)}`);
}
/** Walk `c` from (fx, fz) to where c.pos now says, in strides of ≤ GUARD_SWEEP_STEP with a two-pass push-out after each — only when that is more than one stride
 *  (else nothing: the caller's own push-out follows). Leaves c.pos at the raw target after the last stride, for the caller to settle. */
function sweepStatics(g: Game, c: Character, fx: number, fz: number, dbg: ((m: string) => void) | null) {
  const tx = c.pos[0], tz = c.pos[2]; const D = Math.hypot(tx - fx, tz - fz); const n = Math.min(16, Math.ceil(D / GUARD_SWEEP_STEP));
  if (n <= 1) return;
  c.pos[0] = fx; c.pos[2] = fz;
  for (let i = 1; i < n; i++) { c.pos[0] += (tx - fx) / n; c.pos[2] += (tz - fz) / n; g.col.collideCircle(c.pos, c.radius, 0.2, 1.5, 2); }
  c.pos[0] += (tx - fx) / n; c.pos[2] += (tz - fz) / n;
  dbg?.(`SWEEP ${D.toFixed(3)} m in ${n} strides`);
}

// ------------------------------------------------------------ sides (teams.ts): the AI target's light meter, and which enemy a unit's senses are on
/** no foe, nothing seen: the perception block's stand-in for canSee when a unit has nobody yet */
const NO_SIGHT = { visible: false, dist: 99, inCone: false };
/** the six axis normals the renderer's meter takes its best face over (probe.wgsl) */
const METER_NORMALS: Vec3[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
/** the shader's range window (common.wgsl lightWindow): (1 − (d/range)⁴)², clamped */
function lightWindow(d: number, range: number): number { const x = d / range; const w = clamp(1 - x * x * x * x, 0, 1); return w * w; }
/** The CPU's estimate of the renderer's light meter at world point P (probe.wgsl: the best, over the six axis normals, of the luminance of the SHADOWED DIRECT
 *  irradiance) — every enabled analytic light the engine holds this frame (fixtures' area lights, lamps, torches and weapon lights, the beacons, muzzle flashes)
 *  through the shader's own terms (evalLight: 1/max(d², r²), the range window, the spot cone's smoothstep, the panel's emitter cosine, the receiving cosine),
 *  shadowed by one segment test against the statics and the door leaves (collision.ts — the CPU's stand-in for occluded()). What it has not got, named: no
 *  bounce (the probe adds the radiance cache's; a room lit only round a corner reads darker here than on screen), no moon (kind 2: indoors it only comes through
 *  the glazing, and unshadowed it would light everybody), no bodies' shadows (capsules are GPU-side), no smoke, no fixture flicker. Used for one thing: how lit
 *  an AI TARGET is to an AI eye (unitLightMeter) when the renderer has not answered — headless always, the browser's first frame or two. Sam's meter reads it
 *  only with the senses on the CPU (sense.ts SENSE.cpu, game.ts lightMeter). ~one segment test per light in range: a few dozen per target per frame. */
export function lightEstimateAt(g: Game, P: Vec3, skipOwner?: (owner: number) => boolean, steadyOnly = false): number {
  const acc = [0, 0, 0, 0, 0, 0];
  const lights = g.engine.lights.lights;
  for (let i = 0; i < lights.length; i++) {
    const l = lights[i];
    if (!l.enabled || l.intensity <= 0 || l.kind === 2 || (skipOwner && l.owner && skipOwner(l.owner))) continue;
    if (steadyOnly && (l.ttl >= 0 || l.transient || g.beacons.some(b => b.light === l))) continue;   // (LIGHTS.litMan asks what the PLACE lights: a round's impact flash, a tracer's lamp, a stun charge, a stroke of lightning, a blackout beacon sweeping past are nobody's lamp)
    const sp = steadyOnly ? l.steady : undefined, lp = sp ? sp.pos : l.pos;   // (a fixture somebody flickers — an open fire, fire.ts — is its authored self, where the level hung it, to who asks what the PLACE lights)
    const dx = lp[0] - P[0], dy = lp[1] - P[1], dz = lp[2] - P[2]; const dist2 = dx * dx + dy * dy + dz * dz; const dist = Math.sqrt(dist2);
    if (dist > l.range || dist < 1e-3) continue;
    const Lx = dx / dist, Ly = dy / dist, Lz = dz / dist;
    const lr = sp ? sp.radius : l.radius;   // (… and the size the level gave it)
    let att = lightWindow(dist, l.range) / Math.max(dist2, lr * lr);
    if (l.kind === 1) {
      const cd = -(Lx * l.dir[0] + Ly * l.dir[1] + Lz * l.dir[2]); const cosOuter = Math.cos(l.outerDeg * DEG), cosInner = Math.cos(Math.min(l.innerDeg, l.outerDeg - 0.5) * DEG);
      if (cd < cosOuter) continue;
      att *= smoothstep(cosOuter, cosInner, cd);
    } else if (l.kind === 3) {
      const ce = -(Lx * l.dir[0] + Ly * l.dir[1] + Lz * l.dir[2]);
      if (ce <= 0) continue;
      att *= ce;
    }
    if (att <= 0) continue;
    const c = l.color, I = sp ? sp.intensity : l.intensity;
    if (Math.max(c[0], c[1], c[2]) * I * att < 0.002) continue;                                    // (the probe's own floor for a light worth a shadow ray)
    const lum = (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) * I * att;
    const tmax = dist - lr - 0.02;
    if (tmax > 0.05 && g.col.segmentBlocked(P, [P[0] + Lx * tmax, P[1] + Ly * tmax, P[2] + Lz * tmax])) continue;   // a wall, a partition, a desk, a shut leaf between him and it: dark from that one
    for (let k = 0; k < 6; k++) { const N = METER_NORMALS[k]; const cs = N[0] * Lx + N[1] * Ly + N[2] * Lz; if (cs > 0) acc[k] += lum * cs; }
  }
  hourLight(g, P, acc);   // the level started at another hour (hours.ts): its sun and its sky on the same six faces — nothing at night
  if (!steadyOnly) strokeLight(g, P, acc);   // a stroke of lightning under a picked weather (weather.ts): the renderer's meter reads it, so its stand-in does — nothing with no weather picked
  return Math.max(acc[0], acc[1], acc[2], acc[3], acc[4], acc[5]);
}
/** The chest + head light-meter pair of one character (a held man's 'held', a unit's 'unit', a civilian's 'civ'): two probe queries under `${prefix}C${id}` /
 *  `${prefix}H${id}` with his own proxies skipped, asked chest then head through g.lightQuery and read back through g.lightAt (the hooks the harness swaps); the
 *  larger of the two when both have finite answers, else the CPU estimate of the same direct light at the same two points. Returns the irradiance, unmapped. */
export function meterOf(g: Game, c: Character, prefix: string): number {
  const id = c.id; const pc = c.bones.chest ?? v3.add(c.pos, [0, 1.2, 0]), ph = c.bones.head ?? v3.add(c.pos, [0, 1.6, 0]);
  const kc = `${prefix}C${id}`, kh = `${prefix}H${id}`; g.lightQuery(kc, pc, id); g.lightQuery(kh, ph, id);
  const r1 = g.lightAt(kc), r2 = g.lightAt(kh);
  return r1 !== undefined && r2 !== undefined && Number.isFinite(r1) && Number.isFinite(r2) ? Math.max(r1, r2) : Math.max(lightEstimateAt(g, pc), lightEstimateAt(g, ph));
}
/** The light meter of a man some AI side can be hostile to (a unit — never the staff: no AI side is hostile to them, and the game as it was asks nothing new of the
 *  probe): the renderer's irradiance at his chest and head, asked of the probe every frame under his own keys with his own capsules skipped — exactly as Sam's
 *  'playerChest' / 'playerHead' are — and, until an answer exists (headless: never; the browser: a frame or two), the CPU estimate of the same light
 *  (lightEstimateAt). Mapped through the meter's curve and eased at Sam's rate, into Guard.visibility / irradiance: what sightGainOn reads for him. */
function unitLightMeter(g: Game, gd: Guard, dt: number) {
  const E = meterOf(g, gd.char, 'unit');
  gd.irradiance = E; gd.visibility = damp(gd.visibility, g.visibilityOf(E), 6, dt);
}
/** A unit's foe this frame (never the staff's — theirs is Sam from birth): drop a man who is dead or gone (and the fix that was on him, unless a noise has since
 *  put it elsewhere); then, of every enemy character he can SEE right now — Sam if his side is hostile to Sam and Sam is up and not the sandbox's ghost, and
 *  every living man of a side hostile to his — through the very cone / range / line-of-sight test and sight-gain formula the staff use on Sam, keep the one he
 *  is on while he still has him (a fight is not a metronome of re-targeting), else take the most salient (the highest sight gain: nearest, best lit, moving
 *  across him). Nobody in sight: he keeps a living man he had (his fix and memory are of that man) or stays on nobody, working fixes by ear until one shows —
 *  and a man whose foe has just DIED with no other enemy in sight comes off the alert (below): the fight his eyes know of is over. The killer says so. */
function acquireFoe(g: Game, gd: Guard) {
  const cur = gd.foe; let lostMan = false, mine = false; const knee = !!cur && cur !== 'player' && railsDown(g, cur);   // (rails.ts: his man is on his knee, spared, on a tutorial mission — false on its first word with RAILS.spareDown off)
  if (cur && cur !== 'player' && (cur.state === 'dead' || !g.guards.includes(cur) || runnerFled(cur) || knee)) {   // his man is down (or on his knee, spared: to him the same) (or despawned under him): off him — Sam down is handled where it always was (the alert branch covers the body)
    if (gd.lastKnown && v3.distXZ(gd.lastKnown, cur.char.pos) < 1.5) gd.lastKnown = null;   // (a fix that IS the dead man is no place to run to; one a noise put somewhere else stands)
    mine = cur.state === 'dead' && cur.killerId === gd.char.id && gd.state === 'alert';   // (his round did it: he is the one who says so, below; the others saw it and say nothing)
    gd.foe = null; gd.aim.clear(); lostMan = true; if (knee) gd.weapon.burst = null;   // (no round of a burst in hand goes into a man who is down to him)
  }
  let best: Foe = null, bestRate = 0.05, curVisible = false;
  const consider = (f: 'player' | Guard, ch: Character) => {
    const vis = f === 'player' ? canSee(g, gd) : canSeeChar(g, gd, ch, false); if (!vis.visible) return;
    const rate = f === 'player' ? sightGain(g, gd, vis.dist) : sightGainOn(g, gd, f, vis.dist);
    if (f === gd.foe && rate > 0.05) curVisible = true;
    if (rate > bestRate) { bestRate = rate; best = f; }
  };
  if (isHostile(gd.team, 'player') && !g.player.down && !g.playerInvisible) consider('player', g.player.char);
  for (const o of g.guards) if (o !== gd && o.state !== 'dead' && o.char.alive && isHostile(gd.team, o.team) && !runnerFled(o) && !railsDown(g, o)) consider(o, o.char);
  const op = gd.team === 'operative';
  if (curVisible) return;
  if (best && best !== gd.foe) { gd.foe = best; gd.aim.clear(); if (mine) g.say(gd, op ? 'he\'s down — next.' : 'got him!'); return; }   // a new man: he lines him up from nothing (aim.ts keys the track by foe too)
  if (lostMan && !best && !gd.unit && gd.team === 'guard' && !g.player.down) {
    // A STAFF MAN (here only on a quiet mission with a partner: the call site): the man he dropped is one of TWO intruders, and the other is still on his floor.
    // He is on Sam again and his state stands — alert with no fix left drops to a search where he stands (the alert branch's own rule), a search goes on —
    // and nobody says 'that's all of them' over a floor Sam is still on.
    // The sighting his licence to shoot rests on was of the MAN WHO FELL: it is no sighting of Sam (lastSeenT put past the half second the fire gate reads, a
    // burst in hand ended) — he aims at and runs to nothing he has not seen.
    gd.foe = 'player'; gd.lastSeenT = Math.min(gd.lastSeenT, g.time - 0.5); gd.weapon.burst = null; if (mine) g.say(gd, 'got him!');
  } else if (lostMan && !best && (gd.state === 'alert' || gd.state === 'search')) {
    // the man he was fighting is down and no other enemy is in his sight: the fight, as far as his own eyes have it, is over — not a man lost sight of. He comes
    // off the alert to a wary look round (toward whatever fix a noise has left him, else where he stands), one man a side says so, and in his own time he goes
    // back to his mark; no chase of a dead man's fix, no search dealt round a room he has just won. An enemy he has NOT seen puts him straight back up the way
    // any enemy does — a report, a footfall, a shape in his cone (his senses run on in every state).
    gd.state = 'suspicious'; gd.awareness = 0.45; gd.reactT = 1.2; gd.searchT = 0; gd.path = []; gd.pathGoal = null; gd.searchPlan = null; gd.pieing = null;
    const left = WORDS.on && (g.guards.some(o => o.state !== 'dead' && isHostile(gd.team, o.team)) || (isHostile(gd.team, 'player') && !g.player.down));   // (words.ts: nobody calls a floor clear with an enemy still up on it — his own man is down, and that is all he says)
    const said = left || g.guards.some(o => o !== gd && o.team === gd.team && o.bubble && g.time - o.bubble.t < 3 && /clear\.|all of them/.test(o.bubble.text));
    if (mine) g.say(gd, op ? (said ? 'he\'s down.' : 'he\'s down — clear.') : (said ? 'got him!' : 'got him — that\'s all of them.'));
    else if (!said && !knee) g.say(gd, op ? 'clear.' : 'that\'s all of them.');   // (a spared man on his knee is nobody's kill to call: nothing is said)
  } else if (mine) g.say(gd, op ? 'he\'s down.' : 'got him!');
}

// ------------------------------------------------------------ the right hand: what his state puts in it, what is actually there, and the reload beat
/** Rifles (docs/internal/sc20k-design.md §3, lane R1): which RIG is in his hands — the carbine when the sandbox knob has dealt him one over his sidearm row
 *  (Game.tune.carbineGuards → Guard.carbine, game.ts each frame: rig + poses only, he still fires his 9 mm row) or when the row he carries is itself a long gun
 *  (weapons.ts WeaponDef.rig 'carbine': R2 hands Reyes the aks74u). A rifleman has it in both hands in every living state and no hand torch — its weapon light
 *  is his light — so handCarry below never says 'torch' for him; handProps draws it, attachFlashlight puts the light at its lens, game.ts arms the animator. */
export function rigOf(gd: Guard): 'pistol' | 'carbine' | 'sc20k' { return gd.carbine || gd.weapon.def.rig === 'carbine' ? 'carbine' : gd.weapon.def.rig === 'sc20k' ? 'sc20k' : 'pistol'; }   // ('sc20k': a man handed Sam's bullpup row — the showcase's operatives — carries it in both hands like the carbine, drawn with RIG.sc20k, its light on the fore-end)
/** WHICH long gun that is, for the sites that draw or measure it (handProps, attachFlashlight, game.ts arming the animator, breach.ts): the guards' carbine, or Sam's
 *  FN2000 in the hands of a man handed that row; null = the sidearm. (Two lanes named the same idea two ways; both spellings kept, one definition each.) */
export function longRigOf(gd: Guard): 'carbine' | 'sc20k' | null { const r = rigOf(gd); return r === 'pistol' ? null : r; }
/** What this man's state has him CARRY in the gun hand: the torch on a calm patrol (state 'patrol' with the sidearm holstered — not `drawn`), his weapon in every
 *  other state (an alarmed floor patrols drawn; suspicious / alert / search have it up; a dead man reads 'weapon' too, as the old expression did — his hand is
 *  inHand's business) — and always his weapon if that is the carbine (rigOf: no torch for a rifleman). The one exception: a man walking over to a WHISTLE he is
 *  answering (whistle.ts whistleSoft: suspicious, on a calm floor, and nothing but the whistle has reached him since) keeps the torch — a whistle is not worth
 *  the pistol until a footfall, a glimpse or a second whistle makes it so. The one rule handProps, attachFlashlight, killGuard, the grab and the hold used to
 *  spell out each for itself. */
export function handCarry(gd: Guard): 'torch' | 'weapon' { return startleTorch(gd) || ((gd.state === 'patrol' || (gd.state === 'suspicious' && whistleSoft(gd))) && !gd.drawn && rigOf(gd) === 'pistol' && !kitPistol(gd)) ? 'torch' : 'weapon'; }   // (kit.ts: a teammate whose card hands him a pistol carries no hand torch)
/** What is physically in the hand: what he carries — unless it has left it: he is down (it lies on the floor as gd.dropped), or the torch was knocked out of it at
 *  the grab (dropped while he still carries 'torch': his hands are empty until the floor has him draw). */
/** (HOLD.dropGun) A living man on his own feet has the gun that was knocked out of his hand at the grab again: it is off the floor and in his fist. Called where
 *  a hold hands him back (player.ts handBack) and, for any other road out of an arm with his hands empty (a checkpoint saved in a hold loads him free: the hold
 *  itself is not filed), on his first update of his own. */
export function gunBack(g: Game, gd: Guard) {
  const i = gd.dropped && gd.dropped.kind !== 'torch' ? g.items.items.indexOf(gd.dropped) : -1; if (i >= 0) { g.items.items.splice(i, 1); gd.dropped = null; }
  gd.gunLostAt = -1;
}
export function inHand(gd: Guard): 'torch' | 'weapon' | null {
  if (runnerFled(gd)) return null;   // (runner.ts, false with its switch off: he dropped it and ran — his hands are empty for good, and nothing more falls from them)
  if (gd.gunLostAt >= 0) return null;   // (HOLD.dropGun, player.ts startGrab: his gun was knocked out of his hand as the arm went round — empty hands until he is loose and has it again)
  if (gd.state === 'dead' || gd.civ) return null;   // (a civilian's hands are empty: nothing to knock out of them at a grab, nothing to fall from them — civilians.ts)
  const k = handCarry(gd);
  return k === 'torch' && (gd.dropped || (HOLD.dropGun && gd.torchLostAt >= 0)) ? null : k;   // (…|| torchLostAt, HOLD.dropGun: the floor gun of a later grab took `dropped`'s place and went back to his hand — the torch still lies where the first grab left it)
}
/** The magazine is empty: he stands there changing it for the row's reload.dur (the beat the fire sites count down — no round leaves meanwhile), says so, and the
 *  slide-back clack plays at him. */
export function startReloadBeat(g: Game, gd: Guard) { if (gd.second && sideOutAlert(g, gd)) return;   // (gunslots.ts: a teammate dry on a man close in front of him goes to his sidearm — no magazine change yet)
  const c = gd.char; gd.reloadT = feedBegin(gd.weapon).dur; gd.weapon.burst = null; c.anim.reload();   // (gunreload.ts feedBegin: the row's length, as ever — or, a tube gun under the shells key, the time the shells that go in take)
  feedDeal(c.anim, c.anim.longGun ? gd.weapon : null, true);
  if (!feedStarts(gd.weapon.def)) g.audio.play('magOut', c.pos, 0.5);   // (gunreload.ts: a belt gun's or a tube gun's first sound is its own, on its beat — tickReloadBeat. The clack as ever with gunlook.ts off)
  g.say(gd, 'reloading!'); }
/** …counted down each frame he could otherwise fire; the frame it runs out the gun is simply full again (his spares are bottomless) and the NEXT frame may fire.
 *  A row that stages its reload (reload.out — the long guns; the sidearm's beat is one undivided 1.7 s and drops nothing) lets the empty go the frame the beat
 *  crosses `out`: a rifleman's thirty-round box clatters down out of the receiver (a 'mag' item with fill 2: throwables draws the long bakelite box) — physical,
 *  heard at arm's length like any magazine hitting the floor, and no more ammunition to anybody than the rest of what lies about. */
export function tickReloadBeat(g: Game, gd: Guard, dt: number) {
  const w = gd.weapon, R = w.reloadRow; const before = R.dur - gd.reloadT;   // (the row his beat began on: the gun's own unless feedBegin planned a tube gun's by the shell)
  gd.reloadT -= dt;
  // EACH GUN FED ITS OWN WAY (gunreload.ts; nothing with gunlook.ts off or a row with no model): the sounds of his gun's own feeding as his beat passes them, the
  // hand's stations dealt to his animator, and what falls drawn as what it is — nothing at all out of a tube gun (`drop` null; undefined = the box that always fell)
  const drop = feedDrop(w.def); feedDeal(gd.char.anim, gd.char.anim.longGun ? w : null, true); feedTick(g, gd.char, w.def, before, R.dur - gd.reloadT, undefined, w);
  if (R.out !== undefined && drop !== null && before < R.out && R.dur - gd.reloadT >= R.out) {
    const c = gd.char; const h = c.bones.handR ?? v3.add(c.pos, [0, 1.1, 0]); const d = c.gunDir;
    const it = g.items.spawn('mag', [h[0] + d[0] * 0.12, Math.max(0.3, h[1] - 0.1), h[2] + d[2] * 0.12], [c.vel[0] * 0.5 + d[0] * 0.3, -0.4, c.vel[2] * 0.5 + d[2] * 0.3], { fill: drop ?? 2, who: c.id, heading: c.aimYaw, yaw: c.aimYaw });
    it.onBounce = (sp, p, g) => g.audio.play('magDrop', p, Math.min(1, sp / 3), { rate: drop === 5 ? 0.6 : 0.8 });
  }
  if (gd.reloadT < 0) w.rearm();
}

// ------------------------------------------------------------ rifles: the burst trigger (docs/internal/sc20k-design.md §3.3 / §3.4)
/** seconds a broken-off burst costs before the next may start (a colleague stepped into the line, the shield came up, his own gun was poked through a leaf);
 *  the opening burst's rules: from how far off Sam it is laid wide rather than on him, how far beside him (min + up to `jitter` more, drawn per burst), how much
 *  higher than the chest, how far each round of it walks up the wall after the first, how far either side of Sam a static is looked for to pick the COVER side
 *  (the partition edge, the jamb: where the splinters fly and where a round stopping short reads as 'that was for me'), and the quiet seconds after which a
 *  man's next burst counts as an opening one again (he lost Sam and found him afresh) */
const BURST_BROKEN_CD = 0.4, SUPPRESS_FIRST_MIN_M = 10, SUPPRESS_FIRST_OFF_M = 0.6, SUPPRESS_FIRST_JITTER_M = 0.4, SUPPRESS_FIRST_UP_M = 0.3, SUPPRESS_FIRST_WALK_M = 0.07, SUPPRESS_FIRST_COVER_M = 2.5, SUPPRESS_FIRST_LAPSE = 8;
/** The trigger of a row with a BurstSpec (the guards' carbine), asked once a frame at the alert branch's fire site in place of the sidearm's single round. No burst
 *  in hand: once `startOk` (every gate the single round has always had — the beat, the facing, a clear line, not twisted, not poked, the gun up, no shield) and no
 *  colleague on the bore's own line, one BEGINS: n = min‥max rounds drawn off the game's dice, the first out this same frame; and if it is his OPENING burst at a
 *  Sam SUPPRESS_FIRST_MIN_M or more off (tune.suppressFirst), the whole burst is laid beside Sam instead of on him — toward the nearer static within reach either
 *  side of him (else a side off the dice), 0.6–1.0 m out and a hand higher, dead steady (no hands in it: a tight group where he meant it), each round a few
 *  centimetres up the wall from the last. Burst in hand: the per-ROUND gates (`roundOk`: shield, gun lowered for a colleague, poked, twisted — and the last look
 *  down the bore) end it on the spot with nothing more out of it and BURST_BROKEN_CD in hand; otherwise a round every `interval` (600 rpm = every 6th frame at 60 Hz;
 *  never two in a frame however long the frame), the k-th of an aimed burst opening the cone by spreadPerRound·k (capped) over his hands' own spread and tight
 *  again next burst; the last round (or the box running dry) ends it, draws the gap to the next (gapMin‥gapMax) and, dry, starts the reload beat. The facing and
 *  the clear line are asked at the START only: a burst commits to the line it began on and follows the aim point as it tracks Sam — a Sam who steps behind the
 *  mullion mid-burst has the rest of it hit the mullion, which is what bursts do. A burst the trigger did not service LAST frame (he lost the licence, went to the
 *  standoff, reacted, was grabbed) is dropped before anything else: no round of it arrives late. `except` as roundPastColleague has it. */
export function burstTrigger(g: Game, gd: Guard, dt: number, aimAt: Vec3, startOk: boolean, roundOk: boolean, except: Guard | null = null) {
  const w = gd.weapon, B = w.def.burst; if (!B) return;
  const c = gd.char;
  const end = (cd: number) => { const b = w.burst; w.burst = null; if (b && b.idx > 0) { w.bursts++; w.lastBurstT = b.t; } gd.fireCd = Math.max(gd.fireCd, cd - (b ? g.time - b.t : 0)); };   // (the beat runs from the burst's last serviced frame — this one, unless it went stale; a burst that never got a round off was no burst: the opening one is still to come)
  if (w.burst && g.time - w.burst.t > dt * 1.5 + 1e-6) end(BURST_BROKEN_CD);   // stale: nobody pulled this trigger last frame (he lost the licence a moment, reacted, was scripted) — that burst ended when he stopped, whatever was left of it, and the next waits the broken-burst beat out from then: no fresh burst on the heels of the old one's last round
  if (!w.burst) {
    if (!startOk || gd.fireCd > 0 || roundPastColleague(g, gd, aimAt, except)) return;
    const n = clamp(B.min + Math.floor(simRandom() * (B.max - B.min + 1)), B.min, B.max);
    let off: Vec3 | null = null;
    const opening = w.bursts === 0 || g.time - w.lastBurstT > SUPPRESS_FIRST_LAPSE;
    if (g.tune.suppressFirst && opening && v3.distXZ(c.pos, (foeChar(g, gd) ?? g.player.char).pos) >= SUPPRESS_FIRST_MIN_M) {   // (teams: off the man he is firing at — Sam, for the staff)
      const dx = aimAt[0] - c.pos[0], dz = aimAt[2] - c.pos[2]; const L = Math.hypot(dx, dz) || 1;
      const px = -dz / L, pz = dx / L;   // unit, square off the line (his left as he looks at Sam)
      const chestP: Vec3 = [aimAt[0], aimAt[1], aimAt[2]];
      const l = g.col.raycast(chestP, [px, 0, pz], SUPPRESS_FIRST_COVER_M), r = g.col.raycast(chestP, [-px, 0, -pz], SUPPRESS_FIRST_COVER_M);
      const side = l && r ? (l.t <= r.t ? 1 : -1) : l ? 1 : r ? -1 : (simRandom() < 0.5 ? 1 : -1);   // toward the cover he is using; in the open, either
      const m = SUPPRESS_FIRST_OFF_M + simRandom() * SUPPRESS_FIRST_JITTER_M;
      off = [px * side * m, SUPPRESS_FIRST_UP_M, pz * side * m];
    }
    w.burst = { left: n, n, nextT: 0, idx: 0, t: g.time, off };
  }
  const b = w.burst; b.t = g.time;
  if (!roundOk) { end(BURST_BROKEN_CD); return; }
  b.nextT -= dt; if (b.nextT > 1e-4) return;
  const aim: Vec3 = b.off ? [aimAt[0] + b.off[0], aimAt[1] + b.off[1] + SUPPRESS_FIRST_WALK_M * b.idx, aimAt[2] + b.off[2]] : aimAt;
  const grow = Math.min(B.spreadCap, B.spreadPerRound * b.idx);   // how much wider than his hands this round is drawn (the k-th of the burst)
  let cone = 0;   // …and so how much more room past a colleague it needs than the first, aimed one (half the whole cone per metre — his hands' share worked as fireWeapon works it, or as the aim model composes it: aim.ts handsCone): a burst walking open beside a man's shoulder ends rather than graze him
  if (!b.off && b.idx > 0) cone = handsCone(g, gd, grow) / 2;
  if (roundPastColleague(g, gd, aim, except, cone)) { end(BURST_BROKEN_CD); return; }   // the last look down the bore, on the line this round will fly and as wide as it may fly: a man there ends the burst, he does not eat the rest of it
  if (!w.fire()) { w.burst = null; if (w.roundsReady === 0 && gd.reloadT < 0) startReloadBeat(g, gd); return; }   // (dry with a burst in hand cannot really happen — the round that emptied the box ended its burst — but a dry trigger starts the beat, never a click-loop)
  const M = guardFireMods(g, gd);   // suppression (R3): a rattled man's rounds go wider still, and (below) his bursts come further apart
  fireWeapon(g, c, aim, false, b.off ? { spread: 0, steady: true } : guardRound(g, gd, grow + M.spread, b.idx === 0)); if (!b.off) noteBore(g, gd, aim);   // (an aimed round's cone through the aim model — aim.ts guardRound, { spread: grow + M.spread } exactly with it off; the wide opening burst is laid where he means it, model or none — and, laid into the wall on purpose, is never a fouled bore)
  b.idx++; b.left--; b.nextT = B.interval;
  if (b.left <= 0 || w.roundsReady === 0) {
    end((B.gapMin + simRandom() * (B.gapMax - B.gapMin)) * M.gap);   // (× the suppression's cadence stretch: a man taking rounds waits longer between bursts)
    if (w.roundsReady === 0) startReloadBeat(g, gd);
  }
}
/** Panel / QA: one line per living rifleman — rounds ready, the burst in hand (k of n, opening or aimed), bursts let go, the beat. */
export function burstSummary(g: Game): string {
  const parts: string[] = [];
  for (const gd of g.guards) {
    if (gd.state === 'dead' || !gd.weapon.def.burst) continue;
    const w = gd.weapon, b = w.burst;
    parts.push(`${gd.callsign}: ${w.roundsReady}/${w.def.magCapacity}${gd.reloadT >= 0 ? ` reloading ${gd.reloadT.toFixed(1)} s` : ''} · ${b ? `burst ${b.idx}/${b.n}${b.off ? ' (opening, wide)' : ''}` : `cd ${Math.max(0, gd.fireCd).toFixed(2)}`} · ${w.bursts} bursts`);
  }
  return parts.length ? 'rifles ▸ ' + parts.join(' | ') : `rifles ▸ nobody carries one (${g.tune.carbineGuards})`;
}

export function attachFlashlight(g: Game, gd: Guard, dt = 1 / 60) {   // (dt: the relaxed carry's easing is per second — rigProps.ts torchCarryDir; callers outside the frame loop, savestate / squad, take the sixtieth)
  const held = poseFlashlight(g, gd, dt), fl = gd.flashlight;
  if (held && fl.enabled) fl.pos = lensClear(g, held, fl.pos, g.engine.settings.flashlightRadius, fl);   // a burning lens carried through the wall he is pressed to lights from this side of it (lighting.ts LIGHTWALL; a dark light asks nothing)
}
/** the light at its lens, its beam and whether it burns; returns what the lens hangs off — his gun shoulder, or the dropped torch's own body (nothing before he has a pose) */
function poseFlashlight(g: Game, gd: Guard, dt: number): Vec3 | undefined {
  const c = gd.char; const fl = gd.flashlight; const T = g.tune;
  if (!c.bones.handR) return;   // no pose yet
  let dir = c.gunDir;
  const rk = rigOf(gd); const carbine = rk === 'carbine';
  const torch = handCarry(gd) === 'torch';   // the hand torch on a calm patrol; the weapon light whenever the pistol is out (drawn on an alarmed floor, or any other state) — or on the carbine, always (handCarry never says torch for a rifleman)
  const hangs = torch && c.alive && torchLow(g, gd);   // (TORCH.wallLow / wallDark: the wall is at his hand — false for everybody with both off)
  if (torch && c.alive) { gd.beamDir = torchCarryDir(c, gd.beamDir, dt, hangs && TORCH.wallLow ? { tan: TORCH.lowTan, rate: TORCH.lowRate } : undefined); dir = gd.beamDir; }   // relaxed carry: beam follows the chest/aim heading, smoothed so the arm swing only bobs the origin
  else { gd.beamDir = v3.copy(dir); }
  fl.pos = rk === 'sc20k' ? sc20kLightPose(c).pos : kitPistol(gd) && gd.weapon.def.rig === 'pistol' ? rigLightPose(c).pos : rigTorchPos(c, dir, torch ? swapHeld(gd, 'torch') === 'torch' : swapHeld(gd, 'weapon') === 'torch', RIG, carbine ? 'carbine' : 'pistol'); fl.dir = dir;   // at the torch lens on patrol, at the weapon-light slot when drawn, at the lens on the carbine's handguard (or the bullpup's fore-end): the light is where the muzzle points
  if (runnerFled(gd)) { fl.enabled = false; return c.bones.upperArmR; }   // (runner.ts, false with its switch off: his light went with the gun he dropped — dark in Sam's arm, off a grenade, and on the floor after him)
  let held: Vec3 | undefined = c.bones.upperArmR;   // (what the lens hangs off, for the wall rule below: his gun shoulder — or the dropped torch's own body)
  const lostLive = torch && gd.torchLostAt >= 0 ? gd.torchLostAt : gd.gunLostAt;   // when what carried his light left a LIVING hand (the torch at a grab on patrol · the gun at any grab, HOLD.dropGun), −1 if it has not
  if ((gd.state === 'dead' || lostLive >= 0) && gd.dropped) { const it = gd.dropped; const hd: Vec3 = [Math.sin(it.yaw) * Math.cos(it.tumble), -Math.sin(it.tumble), Math.cos(it.yaw) * Math.cos(it.tumble)]; fl.pos = v3.mad(it.pos, hd, 0.1); fl.dir = hd; held = it.pos; }   // the beam spins with the tumbling torch / pistol until it dies
  if (gd.state !== 'dead' && lostLive >= 0) {   // knocked out of a living hand (the grab): the same sputter-and-die on the floor; drawn later (alert), the weapon light is his light again
    if (!gd.lightLitAtLoss) { fl.enabled = false; return held; }   // (it was dark when it fell: it stays dark)
    const t = g.time - lostLive; fl.enabled = t < 0.9 && (t < 0.35 || Math.sin(t * 60) > 0.3); fl.intensity = fl.peakIntensity * clamp(1 - t / 0.9, 0, 1); return held;
  }
  if (gd.state === 'dead' && g.time >= gd.lightDeadUntil) {   // a dropped torch dies with its owner: a couple of sputters as it hits the floor, then dark (a light lying IN smoke at floor level is also the worst case for the volumetric estimate)
    // …unless it already died: a man grabbed on patrol lost his torch to the floor at torchLostAt and it went dark there; when he goes down later (choked, whipped,
    // shot in the arm) nothing leaves his hand and gd.dropped is still THAT torch — keying the sputter to diedAt flashed it back on at full power wherever it lay
    // (review finding, reproduced: 70/70 for 0.9 s, 5 m from the body). The sputter runs from whichever loss came first.
    if (!gd.lightLitAtLoss) { fl.enabled = false; return held; }   // (a light that was never burning — a breach hostile's, a unit spawned light:false — does not switch ON to sputter as the gun tumbles; review 08-10 #7)
    const lostAt = Math.min(gd.torchLostAt >= 0 ? gd.torchLostAt : Infinity, gd.gunLostAt >= 0 ? gd.gunLostAt : Infinity, gd.diedAt);
    const t = g.time - lostAt; fl.enabled = t < 0.9 && (t < 0.35 || Math.sin(t * 60) > 0.3); fl.intensity = fl.peakIntensity * clamp(1 - t / 0.9, 0, 1); return held;
  }
  if (g.time < gd.lightDeadUntil) { fl.enabled = false; }
  else if (gd.lightDeadUntil > 0 && g.time < gd.lightDeadUntil + 1.0) { fl.enabled = Math.sin(g.time * 50) > 0.2; }   // sputters back
  else fl.enabled = (!gd.unit || ((gd.unit.light || darkFoeLit(g, gd) || powerOutLit(g, gd)) && (!lightRuled(g, gd) || teamLit(g, gd)) && !nvgDark(g, gd) && !silentDark(g, gd))) && !(torch && calmTorchDark(g, gd, dt));   // (a unit spawned with its weapon light off — a daylight room — keeps it off: teams, spawnUnit; a teammate under Sam's orders burns his only while it helps: LIGHTS above — and not at all while the team is dark on its goggles: nvg.ts · a calm staff man's hand torch burns only where his place is dark: calmtorch.ts, nothing with its switch off · an enemy unit dealt a dark light burns it once he knows and is blind: darkfoe.ts, false with its switch off)
  if (hangs && TORCH.wallDark && !TORCH.wallLow) fl.enabled = false;   // (the other answer to the same reading, only where asked for: put out instead of tipped)
  if (wallDark(g, gd, held) && fl.enabled) fl.enabled = false;   // (LIGHTS.wallOff: a teammate's beam that would end on the wall or the truck at his muzzle — asked every frame so its clock runs whether or not the light burns; false for everybody with the switch off)
  if (fl.enabled && dozeDark(gd)) fl.enabled = false;   // (doze.ts: a man sat down to doze has put his torch out — false with its switch off)
  fl.peakIntensity = T.flashIntensity; fl.intensity = T.flashIntensity; fl.innerDeg = T.flashInner; fl.outerDeg = T.flashOuter; fl.radius = g.engine.settings.flashlightRadius;
  return held;
}

export function onScreen(g: Game, p: Vec3): boolean {
  const vp = g.viewProj; if (!vp) return false;
  const w = vp[3] * p[0] + vp[7] * p[1] + vp[11] * p[2] + vp[15]; if (w <= 0) return false;
  const x = (vp[0] * p[0] + vp[4] * p[1] + vp[8] * p[2] + vp[12]) / w, y = (vp[1] * p[0] + vp[5] * p[1] + vp[9] * p[2] + vp[13]) / w;
  return x > -0.92 && x < 0.92 && y > -0.9 && y < 0.9;
}

/** how long a line stands over a man's head, by its length */
export const bubbleSecs = (text: string) => Math.min(4, Math.max(2, 1.5 + text.length * 0.055));
/** A guard says something: a bubble over his head if he is on screen, otherwise (or if it went out over the radio) a line in the log. A man held in Sam's arm has
 *  no voice of his own — whatever the floor's logic would have him bark or radio is dropped (the callers that matter pick somebody else: spokesman, radioCaller,
 *  pickChecker skip him) — except his answers to Sam, which come `force`d (Game.interrogate) and go to the log under his name. */
/** his head, or where it would be (what a line is on or off the screen by: say() below and ui/bubbles.ts ask the same point) */
export const headOf = (gd: Guard): Vec3 => gd.char.bones.head ?? v3.add(gd.char.pos, [0, 1.7, 0]);

export function say(g: Game, gd: Guard, text: string, radio = false, force = false, row = true) {   // (`row` false = the bubble alone: no log row even out of sight)
  if (gd.held && !force) return;
  const net = radio || silentHush(g, gd);   // (a SILENT teammate calls nothing out: his line goes over the net — silent.ts)
  gd.bubble = { text, t: g.time, dur: bubbleSecs(text), radio: net };
  if (net) radioHand(gd, gd.bubble.dur);   // (handwork.ts: a line on the net lifts his hand to the handset — picture only)
  if (!net && row) g.cues?.overheard(gd, text);   // a shout from a man the fog hides, where an ear of the team's really gets it: a row of its own on the strip, his words alone (cues.ts, behind CUES.overheard — off: nothing asked)
  if (radio && gd.unit) g.cues.heard(gd, text);   // a room fight's defenders' net reaches the strip (cues.ts: ranked, rate-limited; nothing here reads it back)
  if (radio) chronRadio(g, gd, text);   // the debrief's row: what went over their net (the routine radio check is dropped there)
  if (row && (radio || g.fogOfWar.hidden(gd) || !onScreen(g, headOf(gd)))) g.msg((net ? (gd.unit ? `${gd.callsign} (radio): ` : 'radio: ') : force || gd.unit ? `${gd.callsign}: ` : 'guard: ') + text);   // (a unit's line goes to the log under his own name: he is not 'guard' — teams)
  if (SQUADNET.on && g.orders?.sams && g.orders.mine(gd) && !onScreen(g, headOf(gd))) g.squadNet?.line();   // (squadnet.ts: a teammate's line said off your screen clicks in your ear, and the page draws it near you; nothing asked with its switch off. `sams`: the response team's men are 'mine' to their own cast of orders, and are not the squad)
}

/** Fresh guards at the start of their routes (keeps their flashlight lights and tints). Spawned units (teams: the showcase's operatives and hostiles) are not the
 *  level's to stand up again: they are despawned — their weapon lights taken back, their meter keys forgotten, an engagement running on them ended 'reset'. */
export function resetGuards(g: Game) {
  if (g.player) { g.player.dragging = null; g.player.takedown = null; g.player.holding = null; g.player.char.anim.holdPose = null; }   // the old bodies / targets are gone — the man in his arm with them
  for (const gd of g.guards) if (gd.unit) releaseUnit(g, gd);
  endEngagement(g, 'reset');
  g.guards = g.guards.filter(gd => !gd.unit).map(gd => new Guard(g.ch, gd.char.id, gd.route, gd.routeI, gd.flashlight, gd.char.tint));
  for (const gd of g.guards) gd.char.update(0);          // fresh characters get a pose (bones) immediately — reset can happen mid-frame
  openingStart(g);   // the night's opening (opening.ts): nobody of the fresh shift starts on top of the way in — nothing under a show's flag or with OPENING.on off
  g.breakerFixT = 0; g.aimGuard = null;
  g.escalation = 0; g.escalationT = -1; g.alarm.episode = false; g.alarm.placed = false; g.alarm.apartT = 0;   // fresh men have no memory of an alarm: calm floor, torches out (the pairing / posts lived on the old Guard objects)
  g.clearing = null; g.clearedAt.clear();   // (so did the scripts of a pair that was clearing rooms, and their ledger of rooms done)
  const R = rollcallState(g); R.stage = 'idle'; R.nextAt = -1; R.caller = null; R.missing = null;   // and the net's radio check starts its clock again with them
  g.note('guards reset');
}

// ------------------------------------------------------------ alarm escalation
// The floor remembers having been alarmed. An alarm EPISODE starts when anybody goes to 'alert' and runs until nobody is alert or searching any more; when it ends
// with nobody found (everyone who was hunting has given up or is dead, and the player is not lying at their feet) the level goes up: calm → heightened (pistols out
// on patrol, brisker routes, keener eyes and ears), and an episode that ends while already heightened → lockdown (pairs, a man on the junction nearest the last
// fix, doors pulled to and relocked). A body found is worth one step on its own (calm → heightened, heightened → lockdown). Each level holds for its clock and
// then steps down one at a time, but only while nobody is alert or searching. One radio line per change.
/** seconds each level holds before it may step down: heightened after an alarm that found nobody (or a body found on a calm floor), lockdown after a second inside
 *  that window (or a body found while heightened), and the shorter heightened spell a lapsed lockdown relaxes through on its way back to calm */
const HEIGHTENED_SECS = 75, LOCKDOWN_SECS = 120, STEPDOWN_SECS = 45;
/** how much harder an alarmed floor looks and listens: × the visual detection rate and the small-noise awareness gains (so 'huh?' comes that much sooner) */
export const KEEN = 1.25;

/** The alarm level the guards act on: the game's, except under the showcase tour (quietUtility) whose staged firefights are nobody's memory (it is 0 there anyway —
 *  resetGuards zeroes it as the tour starts — this just makes the picture independent of that ordering). */
export function escalationOf(g: Game): 0 | 1 | 2 { return g.quietUtility ? 0 : g.escalation; }
export function escalationName(l: number): string { return l >= 2 ? 'lockdown' : l >= 1 ? 'heightened' : 'calm'; }

/** One line for the Tab panel / debugging: level, seconds left on its clock, whether an episode is running, and the lockdown duties. */
export function escalationSummary(g: Game): string {
  const lvl = g.escalation; const name = (gd: Guard) => g.level.routes[gd.routeI]?.name ?? `guard ${gd.char.id - 10}`;
  let s = `alarm level: ${escalationName(lvl)}${g.quietUtility && lvl ? ' (tour: ignored)' : ''}`;
  if (lvl > 0) s += ` · ${Math.max(0, Math.ceil(g.escalationT - g.time))} s`;
  if (g.alarm.episode) s += ' · episode running';
  for (const gd of g.guards) { if (gd.state === 'dead') continue; if (gd.leader) s += ` · pair ${name(gd.leader)} ▸ ${name(gd)}`; if (gd.post) s += ` · ${name(gd)} holds the ${gd.post.name}`; }
  const R = rollcallState(g);   // the net's radio check: what it is doing, or when the next is due
  if (R.stage !== 'idle') s += ` · radio check: ${R.stage === 'called' ? 'counting in' : `asking after ${R.missing?.callsign ?? '?'}`}`; else if (R.nextAt >= 0 && !g.quietUtility) s += ` · radio check in ${Math.max(0, Math.ceil(R.nextAt - g.time))} s`;
  for (const gd of g.guards) if (gd.state !== 'dead' && gd.task?.kind === 'checkOn') s += ` · ${name(gd)} walks ${gd.task.who.callsign}'s route (${gd.task.left} to go)`;
  return s;
}
/** The second panel line: what the pair is clearing right now (squad.ts Clearing.summary), or nothing. */
export function clearingSummary(g: Game): string { return g.clearing?.summary() ?? ''; }

/** the living man best placed to radio something about `pos` (or about nothing in particular): the nearest who is not mid-fight, else the nearest at all — never `except`
 *  (somebody whose own line should stay on screen: a finder left alone on the floor radios his 'man down' and nobody answers with orders to himself) */
function spokesman(g: Game, pos: Vec3 | null, except: Guard | null = null): Guard | null {
  let best: Guard | null = null, bd = Infinity;
  for (let pass = 0; pass < 2 && !best; pass++) for (const gd of g.guards) {
    if (offNet(gd) || gd === except || (pass === 0 && (gd.state === 'alert' || dozeAsleep(gd))) || gd.team !== 'guard' || gd.unit) continue;   // (a man with a forearm across his throat radios nothing; a unit is not on the staff's net — teams — and a staff-side unit, the response team of qrf.ts, gives the shift no orders: it has its own voice)
    const d = pos ? v3.dist(gd.char.pos, pos) : 0; if (d < bd) { bd = d; best = gd; }
  }
  return best;
}

/** Raise the floor to at least `to` and (re)arm that level's clock. One radio line per actual change (a lockdown re-armed by yet another alarm just says so), from the
 *  calm man nearest the last fix — `except` the one whose own line should stay up; `cause` picks the wording for a first raise (a search that found nobody, a
 *  body, a man who neither answers the net nor is anywhere on his route, or a colleague seen held in Sam's arm — the standoff's call). A lockdown deals the duties
 *  out at once so the post man's own line follows the order; for a hostage no rooms are dealt for clearing (they know exactly where he is — the pair is what
 *  everybody converges on; the alarm coming to nothing later plans the sweep as ever). */
export function raiseEscalation(g: Game, to: 1 | 2, except: Guard | null = null, cause: 'search' | 'body' | 'missing' | 'hostage' | 'device' | 'civilian' = 'search', another = false) {   // (another: bodies had been called in before this one — the order says so; 'device': security's cameras / tripwires had him long enough to call it — devices.ts, control's own line goes out first; 'civilian': a cleaner / a late worker told a man what she saw or rang it in, or was found down — civilians.ts, the telling line goes out first)
  const prev = g.escalation; const lvl: 0 | 1 | 2 = to > prev ? to : prev;
  g.escalation = lvl; g.escalationT = g.time + (lvl >= 2 ? LOCKDOWN_SECS : HEIGHTENED_SECS);
  if (lvl > prev) chronAlarm(g, lvl, true, cause);   // the debrief's row + pin: the floor went up (a re-arm at the same level is not news)
  const again = g.time - g.alarm.raisedAt < 1.5; g.alarm.raisedAt = g.time;
  if (again && lvl <= prev && cause !== 'body') return;   // just raised (a searcher finding a body ends his hunt, and with it the episode, in the very frame the body raised the floor): the clock is re-armed, nothing else is new — no 'still nothing' on top of 'man down', no re-deal (a body always re-plans: the rooms round HIM)
  const sp = spokesman(g, g.alarm.placed ? g.alarm.pos : null, except);
  const line = lvl <= prev ? (cause === 'body' ? `${another ? 'another man down' : 'man down confirmed'} — stay locked down, clear everything ${wg('around', 'round')} him` : cause === 'missing' ? "and a man we can't raise — it stays locked down, find him" : cause === 'hostage' ? wg("copy — he's got one of ours. stay locked down. box him in. no shot unless it's clean", 'copy — he has one of ours. it stays locked down: get round him, nobody fires till he has him clean') : cause === 'device' ? 'copy, control — it stays locked down, get to it' : cause === 'civilian' ? w('copy — another one saw him. stay on it, get over there', 'copy — another one saw him. stay on it, get to where she says') : 'still nothing — it stays locked down')
    : lvl >= 2 ? (cause === 'hostage' ? wg("he's got one of ours — lock it down. weapons out, everyone box him in and hold your fire", 'he has one of ours — lock it down: weapons out, everyone to him, box him in and hold your fire') : `${cause === 'body' ? (another ? 'another man down — ' : 'man down — ') : cause === 'missing' ? "a man missing on top of it — " : cause === 'device' ? 'copy, control — ' : cause === 'civilian' ? "copy — that's a witness. " : ''}lock it down: pairs, weapons out, nobody wanders`)
    : cause === 'body' ? 'we have a man down — weapons out, everyone sharp' : cause === 'missing' ? wg("we've got a man off the net and off his route — weapons out, treat it as real", "a man off the net and not on his route — weapons out, eyes open for him, treat it as real") : cause === 'device' ? 'copy, control — weapons out, everyone sharp, somebody get eyes on it' : cause === 'civilian' ? (WORDS.on && !isOffice(g.level) ? "copy — somebody's here who shouldn't be. weapons out, treat it as real" : "copy — somebody's on the floor who shouldn't be. weapons out, treat it as real") : 'nothing here — stay sharp, check your corners';
  if (sp) { g.say(sp, line, true); g.audio.play('radio', sp.char.bones.head ?? sp.char.pos, 0.7); }
  if (lvl >= 2) { assignLockdown(g, prev >= 2, except); if (cause !== 'hostage') planClears(g, false, cause === 'device' || cause === 'civilian' ? 'search' : cause); }   // (re-dealt on a re-arm too: they have just converged on a new fix, so pair whoever is together now and post the spare man by IT) — and the pair clears the rooms nearest that fix (more of them, and whatever they were on dropped, for a body)
}

/** Panel / debug: the floor calm again at once — level 0, clock off, pair and post dissolved, a clear in progress called off — without touching the men themselves (whoever is suspicious stays so). */
export function standDownEscalation(g: Game) { g.escalation = 0; g.escalationT = -1; g.alarm.episode = false; g.alarm.placed = false; g.clearing?.cancel(); g.clearing = null; g.clearedAt.clear(); clearLockdown(g); }

// ------------------------------------------------------------ the net's radio check: a man who does not answer becomes a stimulus in himself
// Nobody reacts to a death nobody has discovered — this is how an undiscovered one becomes known, late: every so often (sooner on an alarmed floor) somebody calls
// a radio check and the living count in; a name that does not come back is asked for, then somebody free is sent round the silent man's route ('checkOn', an
// errand like the breaker's). Coming on the body on the way is the ordinary discovery ('man down!', the aftermath); walking the whole route without him is its
// own alarm: 'not at his post' raises the floor a step, once per missing man. A lockdown follower who loses the man he trails for good reports him the same way
// at once (partnerWatch). None of it under the tour (quietUtility) or with the AI off.
/** seconds between radio checks on a calm floor / an alarmed one (heightened or locked down), each jittered ± ROLLCALL_JITTER of itself */
const ROLLCALL_CALM_SECS = 90, ROLLCALL_ALARMED_SECS = 45, ROLLCALL_JITTER = 0.1;
/** after the call: the living have counted in by ANSWER; a silent name is asked for at ASK (and from then on the others count him missing); at SEND somebody goes */
const ROLLCALL_ANSWER_SECS = 2.2, ROLLCALL_ASK_SECS = 4, ROLLCALL_SEND_SECS = 8;
/** a check due while a fight, a hunt or a room clear is on, or hard on the heels of an alarm (QUIET_AFTER an escalation raise), waits this long and asks again;
 *  and how long the net keeps trying to find a free man to send before leaving it to the next check */
const ROLLCALL_BUSY_RETRY_SECS = 15, ROLLCALL_QUIET_AFTER_SECS = 30, ROLLCALL_SEND_GIVEUP_SECS = 40;
/** the errand: seconds' look round at each of the man's waypoints (one he cannot reach is given up by the suspicious branch's 4 s no-headway rule) and the cap on the whole walk */
const CHECK_LOOK_SECS = 1.2, CHECK_CAP_SECS = 150;
/** partner awareness (lockdown pair): the man he trails out of his sight this long once he stands within SPOT_M of where he last saw him (or twice this long anywhere) → called, and reported missing */
const PARTNER_UNSEEN_SECS = 20, PARTNER_SPOT_M = 2.5;

export interface Rollcall { nextAt: number; stage: 'idle' | 'called' | 'asked'; t0: number; caller: Guard | null; missing: Guard | null; answered: boolean; checks: number; }
const rollcalls = new SideMap<Game, Rollcall>('guards.rollcalls');
/** A man who cannot answer the net: down (dead or out cold), or held with Sam's arm across his throat (Guard.held). Every radio-check predicate asks this, not
 *  'dead' — so a held man fails the sound-off exactly like a corpse: asked for by name while you hold him, somebody sent round his route toward you — and one
 *  let go answers again from the next frame (checkOnTick / the 'asked' stage drop him as they would a man walked onto alive). */
export function offNet(x: Guard): boolean { return x.state === 'dead' || !!x.held; }
/** The net's radio-check state for this game (made on first touch; the panel / probes read it: when the next check is due, what stage a running one is at). */
export function rollcallState(g: Game): Rollcall {
  let R = rollcalls.get(g); if (!R) { R = { nextAt: -1, stage: 'idle', t0: 0, caller: null, missing: null, answered: false, checks: 0 }; rollcalls.set(g, R); }
  return R;
}
function rollcallInterval(g: Game): number { return (escalationOf(g) >= 1 ? ROLLCALL_ALARMED_SECS : ROLLCALL_CALM_SECS) * (1 + (simRandom() * 2 - 1) * ROLLCALL_JITTER); }
/** who calls the check / asks after the silent man: a living man with his hands free for the radio — not mid-fight, not choreographed (the pair on a door), not
 *  walking up to or standing over a body — one on his route for choice, else whoever is left; null = nobody can just now */
function radioCaller(g: Game): Guard | null {
  let best: Guard | null = null, br = -1;
  for (const x of g.guards) {
    if (offNet(x) || x.state === 'alert' || x.script || (x.bodyDuty && x.bodyDuty.stage !== 'fan') || x.team !== 'guard' || dozeAsleep(x)) continue;   // (teams: the radio check is the staff's; doze.ts: a man asleep calls nobody — he does count in, eyes shut)
    const r = x.state === 'patrol' ? 2 : 1; if (r > br) { br = r; best = x; }
  }
  return best;
}
/** somebody already out walking this man's route */
function checkerFor(g: Game, M: Guard): Guard | null { return g.guards.find(x => x.state !== 'dead' && x.task?.kind === 'checkOn' && x.task.who === M) ?? null; }
/** A silent man is being looked for right now — somebody walks his route, or the net has asked for him and is about to send somebody: the floor's alarm level
 *  holds meanwhile (updateEscalation does not step down under it; the QA soak's clock invariant knows the same rule). */
export function stillLooking(g: Game): boolean { return rollcallState(g).stage === 'asked' || g.guards.some(x => x.state !== 'dead' && x.task?.kind === 'checkOn'); }
/** the living man best placed to go round M's route: calm (patrolling), free of orders, errands and bodies — and of Sam's arm — nearest any point of it; `prefer` first if he qualifies */
function pickChecker(g: Game, M: Guard, prefer: Guard | null = null): Guard | null {
  const pts = g.level.routes[M.routeI]?.points ?? [M.char.pos];
  const free = (x: Guard) => x !== M && x.state === 'patrol' && !x.hold && !x.script && !x.task && !x.bodyDuty && !x.held && x.team === 'guard';
  if (prefer && free(prefer)) return prefer;
  let best: Guard | null = null, bd = Infinity;
  for (const x of g.guards) { if (!free(x)) continue; let d = Infinity; for (const p of pts) d = Math.min(d, v3.distXZ(p, x.char.pos)); if (d < bd) { bd = d; best = x; } }
  return best;
}
/** Send `gd` round M's route: the checkOn errand from the waypoint of M's nearest him, all the way round (the suspicious branch walks it: checkOnTick / advanceCheckOn). */
function sendCheckOn(g: Game, gd: Guard, M: Guard, line: string) {
  const pts = g.level.routes[M.routeI]?.points ?? [];
  let i0 = 0, bd = Infinity; pts.forEach((p, i) => { const d = v3.distXZ(p, gd.char.pos); if (d < bd) { bd = d; i0 = i; } });
  const pos: Vec3 = pts.length ? v3.copy(pts[i0]) : v3.copy(g.level.routes[M.routeI]?.points[0] ?? M.char.pos);
  gd.task = { kind: 'checkOn', pos, who: M, wp: i0, left: Math.max(1, pts.length), t0: g.time };
  gd.lastKnown = v3.copy(pos); gd.awareness = Math.max(gd.awareness, 0.42);
  if (gd.state === 'patrol') { gd.state = 'suspicious'; gd.reactT = 0.8; }   // (straight there, no 'huh?': he knows exactly what he is about)
  gd.searchT = 0; gd.path = []; gd.pathGoal = null; gd.bodyDuty = null; gd.stallRef = null;
  g.say(gd, line, true); g.audio.play('radio', gd.char.bones.head ?? gd.char.pos, 0.5, { rate: 1.05 });
}
/** One frame of the errand's bookkeeping (before the suspicious branch moves him): over if the man has been found since (or never was missing — a reset), capped,
 *  or on to the next waypoint once he has had his look round this one (searchT counts from arrival). */
function checkOnTick(g: Game, gd: Guard) {
  const K = gd.task; if (!K || K.kind !== 'checkOn') return; const M = K.who;
  if (M.found || !offNet(M) || !g.guards.includes(M)) {   // known now — somebody walked onto him — so the walk is over: he goes over to the man like anybody else called to a body (the discovery skipped him, being on an errand); or he never was missing (a reset) / is back on the net (let go from a hold): it just decays
    gd.task = null;
    if (M.found && M.state === 'dead' && g.guards.includes(M) && !gd.bodyDuty && !g.quietUtility) { gd.bodyDuty = { body: M, role: 'called', stage: 'to', t: 0, t0: g.time, spot: null }; gd.lastKnown = bodyPos(M); gd.awareness = Math.max(gd.awareness, 0.45); gd.reactT = 0.5; gd.searchT = 0; gd.path = []; gd.pathGoal = null; }
    return;
  }
  if (g.time - K.t0 > CHECK_CAP_SECS) { checkOnDone(g, gd, M, true); return; }
  if (gd.reactT <= 0 && gd.lastKnown && v3.distXZ(gd.lastKnown, K.pos) < 0.6 && gd.searchT > CHECK_LOOK_SECS) advanceCheckOn(g, gd);
}
/** the next of the missing man's waypoints, or — the last one looked at — he is not on his route */
function advanceCheckOn(g: Game, gd: Guard) {
  const K = gd.task; if (!K || K.kind !== 'checkOn') return; const pts = g.level.routes[K.who.routeI]?.points ?? [];
  K.left--;
  if (K.left <= 0 || !pts.length) { checkOnDone(g, gd, K.who, false); return; }
  K.wp = (K.wp + 1) % pts.length; K.pos = v3.copy(pts[K.wp]); gd.lastKnown = v3.copy(K.pos); gd.searchT = 0; gd.path = []; gd.pathGoal = null; gd.stallRef = null;
  if (K.left === Math.floor(pts.length / 2)) { g.say(gd, `halfway ${wg('around', 'round')} — nothing yet. ${K.who.callsign}, if you can hear this, sound off`, true); g.audio.play('radio', gd.char.bones.head ?? gd.char.pos, 0.4, { rate: 1.05 }); }
}
/** The walk is over without him: the line, and — once per missing man — the floor goes up a step on it (raiseEscalation 'missing'; the alarm's place is his post). */
function checkOnDone(g: Game, gd: Guard, M: Guard, capped: boolean) {
  gd.task = null; gd.searchT = 0; gd.awareness = clamp(gd.awareness, 0.2, 0.3);   // (he lets it go from here like any suspicion: 'clear here — staying on it' once the floor is up)
  g.say(gd, capped ? `${wg('walked', 'been round')} most of it — no sign of ${M.callsign}. he's not at his post` : `walked his whole route — ${M.callsign} is not at his post, no sign of him anywhere`, true);
  g.audio.play('radio', gd.char.bones.head ?? gd.char.pos, 0.7);
  if (!M.missingRaised) {
    M.missingRaised = true;
    const post = g.level.routes[M.routeI]?.points[0] ?? M.char.pos; g.alarm.pos[0] = post[0]; g.alarm.pos[1] = 0; g.alarm.pos[2] = post[2]; g.alarm.placed = true;
    raiseEscalation(g, escalationOf(g) >= 1 ? 2 : 1, gd, 'missing');
  }
}
/** Once a frame (updateEscalation): the radio check's clock and its short exchange. Idle and unarmed under the tour or with the AI off (re-armed from scratch after). */
export function updateRollcall(g: Game, dt: number) {
  const R = rollcallState(g);
  if (g.quietUtility || !g.aiEnabled) { R.stage = 'idle'; R.nextAt = -1; return; }   // (the tour's minutes are nobody's silence; resetGuards zeroes it too)
  if (g.level.scenarios?.quiet?.radioCheck === false) { R.stage = 'idle'; R.nextAt = -1; return; }   // (a level whose shift keeps no check — scenarios.ts QuietData.radioCheck; absent on every level but the two lessons that say so)
  if (R.nextAt < 0) R.nextAt = g.time + rollcallInterval(g);
  const staff = g.guards.filter(x => x.team === 'guard');   // (teams: the net is the STAFF's — a unit neither calls, answers, nor is asked after; with none spawned this is the roster it always was)
  const living = staff.filter(x => x.state !== 'dead');
  const callerOk = (x: Guard | null) => !!x && !offNet(x) && x.state !== 'alert' && !x.script && g.guards.includes(x);
  switch (R.stage) {
    case 'idle': {
      if (escalationOf(g) >= 1) R.nextAt = Math.min(R.nextAt, g.time + ROLLCALL_ALARMED_SECS * (1 + ROLLCALL_JITTER));   // the floor went up since it was scheduled: the alarmed interval applies from now
      if (g.time < R.nextAt) return;
      if (!living.length || g.player.down) { R.nextAt = g.time + rollcallInterval(g); return; }
      if (g.alarm.episode || living.some(x => x.state === 'alert') || (g.clearing && g.clearing.stage !== 'done') || g.time - g.alarm.raisedAt < ROLLCALL_QUIET_AFTER_SECS) { R.nextAt = g.time + ROLLCALL_BUSY_RETRY_SECS; return; }   // nobody runs a radio check over a fight, a live hunt or a pair on a door, nor straight after the floor has just been told something real
      const caller = radioCaller(g); if (!caller) { R.nextAt = g.time + ROLLCALL_BUSY_RETRY_SECS; return; }
      if (!staff.some(x => x !== caller && (!offNet(x) || (!x.found && !x.missingRaised && !checkerFor(g, x))))) { R.nextAt = g.time + rollcallInterval(g); return; }   // nobody left who would answer, and no silence that would be news: a man alone with what he already knows does not keep calling into the dark
      R.stage = 'called'; R.t0 = g.time; R.caller = caller; R.missing = null; R.answered = false; R.checks++;
      g.say(caller, 'radio check — sound off', true); g.audio.play('radio', caller.char.bones.head ?? caller.char.pos, 0.5);
      return;
    }
    case 'called': {
      const el = g.time - R.t0;
      if (!R.answered && el >= ROLLCALL_ANSWER_SECS) {   // the living count in, in roster order (one log line, not a bubble each); the dead nobody has found simply do not — a found man is known, nobody waits on him
        R.answered = true;
        const answers = staff.filter(x => x !== R.caller && !offNet(x)).map(x => `…${x.callsign}.`);   // (a held man does not: Sam's arm is across his throat)
        if (answers.length) g.msg('radio: ' + answers.join(' '));
        const silent = (x: Guard) => offNet(x) && !x.found && !checkerFor(g, x);
        R.missing = staff.find(x => silent(x) && !x.missingRaised) ?? staff.find(silent) ?? null;   // one name at a time: the first on the roster nobody is already out looking for — a fresh silence before one already reported
        if (!R.missing) { R.stage = 'idle'; R.nextAt = g.time + rollcallInterval(g); }
        return;
      }
      if (R.missing && el >= ROLLCALL_ASK_SECS) {
        const M = R.missing; if (!callerOk(R.caller)) R.caller = radioCaller(g);
        if (M.found || !offNet(M) || !g.guards.includes(M)) { R.stage = 'idle'; R.nextAt = g.time + rollcallInterval(g); return; }   // (walked onto in the two seconds since — or let go and back on the net: that answers it)
        if (M.missingRaised) {   // already reported missing and his route walked: the check notes it, nobody is sent round the same empty route again
          if (R.caller) { g.say(R.caller, `and still nothing from ${M.callsign} — keep looking for him`, true); g.audio.play('radio', R.caller.char.bones.head ?? R.caller.char.pos, 0.5); }
          R.stage = 'idle'; R.nextAt = g.time + rollcallInterval(g); return;
        }
        if (R.caller) { g.say(R.caller, `${M.callsign}? … ${M.callsign}, sound off`, true); g.audio.play('radio', R.caller.char.bones.head ?? R.caller.char.pos, 0.55); }
        netQuietAsked(g, R.caller, M, staff);   // (netquiet.ts — a return on its first line with its switch off: a man who does not answer the roll call shakes the one who asked and the men on the net)
        if (M.missedAt < 0) M.missedAt = g.time;   // from here on the others count him missing (superviseLockdown stops dealing his corpse a role)
        R.stage = 'asked';
      }
      return;
    }
    case 'asked': {
      const M = R.missing; const el = g.time - R.t0;
      if (!M || !offNet(M) || M.found || !g.guards.includes(M) || checkerFor(g, M)) { R.stage = 'idle'; R.nextAt = g.time + rollcallInterval(g); return; }   // (found meanwhile — the answer to where he is — or reset, let go, or somebody is already going)
      if (el < ROLLCALL_SEND_SECS) return;
      if (!callerOk(R.caller)) R.caller = radioCaller(g);
      const checker = pickChecker(g, M, null);
      if (!checker) {   // everybody busy with something louder: keep trying for a while, then leave it to the next check (which asks for him again)
        if (el > ROLLCALL_SEND_GIVEUP_SECS) { R.stage = 'idle'; R.nextAt = g.time + ROLLCALL_BUSY_RETRY_SECS; }
        return;
      }
      if (R.caller && R.caller !== checker) { g.say(R.caller, `nothing from ${M.callsign}. ${checker.callsign}, ${wg('go walk his route and', 'go round his route —')} check on him`, true); g.audio.play('radio', R.caller.char.bones.head ?? R.caller.char.pos, 0.55); }
      sendCheckOn(g, checker, M, R.caller === checker ? `nothing from ${M.callsign} — ${wg('going to walk his route and', 'going round his route to')} check on him` : `copy — going to check on ${M.callsign}`);
      R.stage = 'idle'; R.nextAt = g.time + rollcallInterval(g);
      return;
    }
  }
}
/** Lockdown follower, each frame on patrol: keep track of when he last had his leader in plain sight (no wall between, inside 16 m — no cone: the man on whose
 *  shoulder he walks is kept by ear and the corner of the eye; this is about walls and distance). PARTNER_UNSEEN_SECS without him once he has closed up to where
 *  he last saw him (followLeader walks him to that spot) and looked — or twice that wherever he has got to, if the spot cannot be reached: he calls him — a living
 *  leader answers and that is that; a dead one cannot, and the follower reports him missing there and then (the radio check's 'asked' stage: SEND − ASK seconds of
 *  silence, then whoever is nearest the route — he, walking it behind the man — is sent round it). What he KNOWS decides it: where he last saw the man and what his
 *  own eyes find there — never where the man (or his body, hauled off into a cupboard) truly is now (review A6.6: the old rule asked the leader's real distance
 *  from the spot, so a body dragged nine metres off was 'known' gone through two walls and one lying eight metres round the corner was never called at all). */
function partnerWatch(g: Game, gd: Guard) {
  const L = gd.leader; if (!L) return;
  const c = gd.char; const eye = c.bones.head ?? v3.add(c.pos, [0, 1.65, 0]);
  const at = L.state !== 'dead' ? (L.char.bones.chest ?? v3.add(L.char.pos, [0, 1.1, 0])) : v3.add(bodyPos(L), [0, 0.4, 0]);   // (a body: the line to where it lies, not to a chest bone under a desk)
  const seen = v3.dist(eye, at) < 16 && !g.col.segmentBlocked(eye, at);
  if (seen || gd.leaderSeenT < 0) { gd.leaderSeenT = g.time; gd.leaderSeenPos = v3.copy(L.char.pos); return; }
  const unseen = g.time - gd.leaderSeenT; const atSpot = v3.distXZ(c.pos, gd.leaderSeenPos) < PARTNER_SPOT_M;   // he has closed up to where he last had him and the man is not there to be seen
  if (!g.aiEnabled || unseen < PARTNER_UNSEEN_SECS || (!atSpot && unseen < 2 * PARTNER_UNSEEN_SECS)) return;   // (AI off: he keeps track, he just does nothing about it)
  gd.leaderSeenT = g.time;   // (whatever comes of it, not again for another spell)
  if (!offNet(L)) {   // alive and free to answer, just long out of his sight and well away: he asks, the man answers, they close up (superviseLockdown re-deals a split pair anyway)
    g.say(gd, `${L.callsign}, ${wg("where'd you go?", "where've you got to?")}`, true); g.say(L, `${gd.callsign} — on me, close up`, true); g.audio.play('radio', eye, 0.5);
    return;
  }
  // dead — or held in Sam's arm somewhere out of his sight: either way nothing comes back, and he reports him
  const R = rollcallState(g);
  if (R.stage !== 'idle' || L.found || checkerFor(g, L)) return;   // the net is mid-check (it will get to him), or he is no longer a question
  g.say(gd, `${L.callsign}? …I've lost ${L.callsign} — he was just ahead of me. ${L.callsign}, sound off`, true); g.audio.play('radio', eye, 0.6);
  if (L.missedAt < 0) L.missedAt = g.time;
  R.stage = 'asked'; R.t0 = g.time - ROLLCALL_ASK_SECS; R.caller = gd; R.missing = L; R.answered = true; R.checks++;
}

// ------------------------------------------------------------ room clearing (squad.ts Clearing / RoomClear, plans in level.ts)
/** seconds within which a room the pair has called clear is not sent round again in the same lockdown — unless the new fix is inside it */
const RECLEAR_SECS = 60;
/** seconds a picked lock they have found (and maybe locked back up) keeps putting its room at the front of a sweep */
const TAMPER_MEMORY_SECS = 120;
/** Locked down, and the alarm has just come to nothing or a body has been found (raiseEscalation, `cause`) — or the panel asks (`force`): hand the pair the rooms whose
 *  doors are nearest the last fix (the alarm's / the body; the point man's own spot if there never was one) to clear one after another — a body is worth the three
 *  nearest, an alarm two (`clearRooms` > 0 overrides both). Rooms whose door gives the intruder away (doorTamper: kicked in — the whole floor heard which one went —
 *  or a lock they have already found picked) jump the queue whatever their distance; a room called clear inside the last minute of this lockdown is left out unless
 *  the fix is in it. The pair as dealt: leader = point man, follower = his cover; a man left alone on the floor clears by himself. Never under the tour, with the AI
 *  off, or below lockdown; a clear already running is left be unless forced — or a body was found: that drops whatever they were on. */
export function planClears(g: Game, force = false, cause: 'search' | 'body' | 'panel' | 'missing' = 'search'): boolean {
  if (g.quietUtility || !g.aiEnabled || escalationOf(g) < 2) return false;
  if (g.clearing) { if (!force && cause !== 'body') return false; g.clearing.cancel(); g.clearing = null; }
  let a: Guard | null = null, b: Guard | null = null;
  for (const gd of g.guards) if (gd.state !== 'dead' && !gd.held && gd.leader && gd.leader.state !== 'dead' && !gd.leader.held) { a = gd.leader; b = gd; }   // (a pair with a man in Sam's arm in it is no pair to send round the rooms — nor can he take the order)
  if (!a) { const alive = g.guards.filter(x => x.state !== 'dead' && !x.held && x.team === 'guard' && !x.unit); if (alive.length !== 1) return false; a = alive[0]; }   // (teams: the staff's rooms are cleared by the staff — not by a staff-side unit: the response team clears its own way, qrf.ts)
  // rooms ranked tampered-first, then by how near any of their doors is to the fix; a room's plans (one per door it can be taken from) travel together — Clearing picks the variant on the day
  const ref = g.alarm.placed ? g.alarm.pos : a.char.pos;
  const byRoom = new Map<string, { plans: RoomClearPlan[]; d: number; tampered: boolean; inside: boolean }>();
  for (const p of g.level.clearPlans ?? []) {
    const d = g.doors.byName(p.door); if (!d) continue;
    const k = p.room ?? p.door, r = byRoom.get(k) ?? { plans: [], d: Infinity, tampered: false, inside: false };
    r.plans.push(p); r.d = Math.min(r.d, v3.dist(d.frameCentre, ref));
    if (doorTamper(d) === 'forced' || (d.def.locked && d.noticed && g.time - d.noticedT < TAMPER_MEMORY_SECS)) r.tampered = true;   // kicked in (plain, and it stays plain), or a lock of theirs read as picked lately — by the pair's hand on it or by whoever locked it back up
    if (p.bounds && inBounds(ref, p.bounds)) r.inside = true;
    byRoom.set(k, r);
  }
  const n = g.clearRooms > 0 ? g.clearRooms : cause === 'body' ? 3 : 2;
  const recent = (k: string) => { const t = g.clearedAt.get(k); return t !== undefined && g.time - t < RECLEAR_SECS; };
  const ranked = [...byRoom.entries()].filter(([k, r]) => !recent(k) || r.inside).sort(([, x], [, y]) => (+y.tampered - +x.tampered) || x.d - y.d);
  const rooms = ranked.slice(0, n).map(([, r]) => r.plans);
  if (!rooms.length) { g.note('nothing near to clear — those rooms were done a minute ago'); return false; }
  g.clearing = new Clearing(g, rooms, a, b);
  return true;
}
/** Panel: the rooms still ahead of the pair (current first) and the ones called clear lately in this lockdown, with how long ago. */
export function clearQueueSummary(g: Game): string {
  const C = g.clearing; const parts: string[] = [];
  if (C && C.stage !== 'done') parts.push('clear queue: ' + C.rooms.slice(C.roomI).map(v => v[0].room ?? v[0].door).join(' ▸ '));
  const done = [...g.clearedAt.entries()].sort((x, y) => y[1] - x[1]).map(([k, t]) => `${k} (${Math.round(g.time - t)} s ago${g.time - t < RECLEAR_SECS ? ', holds' : ''})`);
  if (done.length) parts.push('cleared this lockdown: ' + done.join(', '));   // 'holds' = inside the minute planClears will not send them round it again
  return parts.join(' · ');
}
/** Panel: 'clear nearest room now' — the fix put where the player stands, the floor locked down if it was not (which deals the pair and plans off that fix), else re-planned. */
export function forceClear(g: Game) {
  if (g.quietUtility) { g.msg('no clear under the tour'); return; }   // (nor a lockdown raised behind its back for later)
  const p = g.player.char.pos; g.alarm.pos[0] = p[0]; g.alarm.pos[1] = 0; g.alarm.pos[2] = p[2]; g.alarm.placed = true;
  if (g.escalation < 2) raiseEscalation(g, 2); else planClears(g, true, 'panel');
  if (!g.clearing) g.note(!g.aiEnabled ? 'no clear: guard AI is off' : 'no clear: nobody to send / no plans');
  else g.note(`clear ordered: ${g.clearing.rooms.map(r => r[0].room ?? r[0].door).join(', ')}`);
}

/** One level down (its clock has run out and the floor is quiet): lockdown → a shorter heightened spell → calm, torches back out. */
function stepDownEscalation(g: Game) {
  const lvl: 0 | 1 | 2 = g.escalation >= 2 ? 1 : 0;
  g.escalation = lvl; g.escalationT = lvl >= 1 ? g.time + STEPDOWN_SECS : -1; chronAlarm(g, lvl, false, 'time');   // (the debrief's row: the floor eased off a level)
  if (lvl < 2) { clearLockdown(g); g.clearedAt.clear(); }   // (the next lockdown starts its own ledger of cleared rooms)
  if (lvl === 0) g.alarm.placed = false;   // whatever comes next is a fresh alarm somewhere else
  const sp = spokesman(g, g.alarm.placed ? g.alarm.pos : null);
  if (sp) { g.say(sp, lvl >= 1 ? 'ease off — singles, back on your routes; weapons stay out' : 'stand down, back to normal', true); g.audio.play('radio', sp.char.bones.head ?? sp.char.pos, 0.6, { rate: 0.95 }); }
}

/** Once a frame, after the guards: track the alarm episode off this frame's states, settle the level when it ends, step down when the clock allows, and keep the
 *  lockdown duties sane. Nothing moves under the tour, with the AI off, or for a player lying dead at their feet (that is the restart flow's business). */
export function updateEscalation(g: Game, dt: number) {
  updateRollcall(g, dt);   // (idles itself under the tour / AI off)
  updateAmbient(g, dt);    // (dialogue.ts: the handler's two lines at the mission's beats, and two calm men within a few metres stopping to talk — idles itself under the tour, a floor that is up, a man in Sam's arm)
  tickEngagement(g);       // (teams: the showcase's fight, if one is on — its record kept, its promise resolved when the room is won, lost or out of time; nothing when none is)
  if (g.quietUtility) return;
  const A = g.alarm;
  let anyAlert = false, hunting = false, living = 0;
  for (const gd of g.guards) {
    if (gd.state === 'dead' || gd.team !== 'guard') continue; living++;   // (teams: the building's alarm is the STAFF's memory — a unit's fight three walls off is no episode of theirs)
    if (gd.state === 'alert') { anyAlert = hunting = true; if (gd.lastKnown) { A.pos[0] = gd.lastKnown[0]; A.pos[1] = 0; A.pos[2] = gd.lastKnown[2]; A.placed = true; } }   // the latest fix anybody alert is working from
    else if (gd.state === 'search') hunting = true;
  }
  if (anyAlert) { if (g.aiEnabled) A.episode = true; }
  else if (A.episode && !hunting) {   // over: everybody who went to 'alert' has given up the search too (or is dead), and nobody has had eyes on him since
    A.episode = false;
    if (living > 0 && !g.player.down && g.aiEnabled) raiseEscalation(g, g.escalation >= 1 ? 2 : 1);
  }
  if (g.escalation > 0 && !A.episode && !hunting && !stillLooking(g) && g.time >= g.escalationT) stepDownEscalation(g);   // (nor while a man is out walking a silent colleague's route or the net is still asking after one: nobody stands the floor down in the middle of that)
  if (g.escalation >= 2) superviseLockdown(g, dt, living);
  if (g.clearing && !g.clearing.tick(dt)) g.clearing = null;   // the pair clearing rooms: their approach, drill and senses this frame (it dissolves itself when done, broken off, or the floor changed under it)
}

/** Keep the lockdown duties dealt: (again) when there is no pair but two men live, when the leader died, when the pair has been > 8 m apart for 5 s while both were
 *  calm (stuck, or split by a chase), when a third man lives but nobody holds a post, or when only one man is left (he just patrols, drawn). */
function superviseLockdown(g: Game, dt: number, living: number) {
  // Roles react to what the men KNOW, not to ground truth: a man taken down quietly keeps 'his' role (his corpse holds it) until the body is found, he has failed to
  // answer the net (missedAt), or the floor is in an alarm episode anyway — otherwise a silent takedown had the man on the junction radio 'you're with me' and walk
  // off it seconds before anyone knew.
  const A = g.alarm; const knownDead = (x: Guard) => x.state === 'dead' && (x.found || A.episode || x.missedAt >= 0);
  let follower: Guard | null = null, postman: Guard | null = null, standing = 0;
  for (const gd of g.guards) {
    if (gd.team !== 'guard' || gd.unit) continue;   // (teams: units hold no lockdown role and count for none — a staff-side unit, the response team, included: qrf.ts moves it as its own element)
    if (gd.held) { if (gd.leader || gd.post) { gd.leader = null; gd.post = null; } continue; }   // a man in Sam's arm holds no role and is dealt none (assignLockdown): whatever he held goes the moment the arm is on — else, with only his leader left standing, nothing below ever re-deals and he keeps that man through the hold, dead and found included (the soak's 'bad-leader'; probes held-leader), and comes off it trailing a corpse's spot. Let go, he is a man standing again and the count re-deals him.
    if (knownDead(gd)) continue; standing++; if (gd.leader) follower = gd; if (gd.post) postman = gd;   // (nor is a held man one standing for this count: three alive with one held would re-deal for the missing post man every frame)
  }
  const posts = (g.level.chokepoints?.length ?? 0) > 0;   // (a level without chokepoints never has a post man — that must not read as 'deal again' every frame)
  let redo = standing >= 2 ? (!follower || knownDead(follower.leader!) || (standing >= 3 && living >= 3 && posts && !postman)) : !!(follower || postman);   // (living ≥ 3 too: a corpse nobody knows about keeps the post it held, but once a re-deal has taken it off him there is no third living man to hand it to — asking again every frame for one dealt nothing, and reset the follower's plan and the pair's apart-clock sixty times a second)
  if (follower && !redo && follower.state !== 'dead') {
    const L = follower.leader!; const calm = follower.state === 'patrol' && L.state === 'patrol';
    A.apartT = calm && v3.dist(follower.char.pos, L.char.pos) > 8 ? A.apartT + dt : 0;
    if (A.apartT > 5) redo = true;
  }
  if (redo && living >= 1) assignLockdown(g, true);
}

/** Deal the lockdown duties: the two living men nearest each other pair up — the one with more route to cover leads (lobby / break-room loop > corridor > cubicle
 *  farm), the other trails him — and a third holds the corridor junction nearest the last alarm fix (nearest himself if there never was one). `redeal`: after a
 *  death or a separation the (new) leader tells his man to close up — only if the pairing actually changed, so a pair that keeps getting split cannot chatter. */
function assignLockdown(g: Game, redeal: boolean, except: Guard | null = null) {   // (except: a man whose own line must stay up — the finder of a body — takes his role without announcing it)
  let oldLead: Guard | null = null, oldFollow: Guard | null = null, oldPost: Chokepoint | null = null, oldPostMan: Guard | null = null;
  for (const gd of g.guards) { if (gd.state === 'dead') continue; if (gd.leader) { oldFollow = gd; oldLead = gd.leader; } if (gd.post) { oldPost = gd.post; oldPostMan = gd; } }
  clearLockdown(g); g.alarm.apartT = 0;
  const alive = g.guards.filter(x => x.state !== 'dead' && !x.held && x.team === 'guard' && !x.unit); if (alive.length < 2) return;   // (a man held in Sam's arm is dealt nothing: he can neither trail, lead nor hold a junction, and everybody the call has reached knows why; a unit is not staff — teams — nor is the response team paired or posted by the shift: qrf.ts)
  let a = alive[0], b = alive[1], bd = Infinity;
  const C = g.clearing;   // a pair in the middle of clearing a room stays the pair (a re-deal around them only moves the post)
  if (C && C.b && alive.includes(C.a) && alive.includes(C.b)) { a = C.a; b = C.b; }
  else for (let i = 0; i < alive.length; i++) for (let j = i + 1; j < alive.length; j++) { const d = v3.dist(alive[i].char.pos, alive[j].char.pos); if (d < bd) { bd = d; a = alive[i]; b = alive[j]; } }
  const lead = C && a === C.a ? a : routeLength(g, a) >= routeLength(g, b) ? a : b, follow = lead === a ? b : a;
  follow.leader = lead; follow.followT = 0; follow.leaderStillT = 0; follow.path = []; follow.pathGoal = null; follow.leaderSeenT = g.time; follow.leaderSeenPos = v3.copy(lead.char.pos);   // (dealt over the net: he knows where the man is as of now)
  if (redeal && (lead !== oldLead || follow !== oldFollow) && lead !== except && lead.state !== 'alert' && !(lead.bubble && g.time - lead.bubble.t < 0.5)) g.say(lead, 'you\'re with me — close up');   // (not over his own order of a moment ago — with two men left the spokesman IS the new lead; his man closes up regardless — and not from a man mid-fight: the pairing stands, the chatter waits)
  const third = alive.find(x => x !== a && x !== b); const cps = g.level.chokepoints ?? [];
  if (third && cps.length) {
    const ref = g.alarm.placed ? g.alarm.pos : third.char.pos; let best = cps[0], cd = Infinity;
    for (const cp of cps) { const d = v3.dist(cp.pos, ref); if (d < cd) { cd = d; best = cp; } }
    third.post = best; third.followT = 0; third.path = []; third.pathGoal = null;
    if ((best !== oldPost || third !== oldPostMan) && third !== except && third.state !== 'alert') g.say(third, `holding the ${best.name}`, true);   // over the radio, so it reaches the log: where the spare man will be standing (a man mid-fight takes it up when the fight is over: holdPost is the calm patrol's)
  }
}
function clearLockdown(g: Game) { for (const gd of g.guards) { if (gd.leader || gd.post) { gd.path = []; gd.pathGoal = null; } gd.leader = null; gd.post = null; } }
function routeLength(g: Game, gd: Guard): number { const pts = g.level.routes[gd.routeI]?.points ?? []; let s = 0; for (let i = 0; i < pts.length; i++) s += v3.dist(pts[i], pts[(i + 1) % pts.length]); return s; }

/** seconds a follower who has lost sight of his leader still knows where the man is going (heard him, saw him turn in at the door) and trails his true position;
 *  past it he holds what he last saw — the spot — rather than follow a man (or a body being hauled off) through walls he cannot see through */
const PARTNER_TRUST_SECS = 3;
/** Lockdown follower on patrol: keep station ~1.4 m behind-left of the leader — as he KNOWS him: where the man is while he has him in sight (partnerWatch keeps
 *  that) and for a few seconds after, else where he last saw him — re-planned at most twice a second and only when the station has actually moved; close up
 *  briskly when left behind, and when the leader stops (or the spot is all he has), plant at his shoulder facing the way he faced and sweep the rear-left quarter.
 *  True while walking. */
function followLeader(g: Game, gd: Guard, dt: number, walk: number): boolean {
  const L = gd.leader!, c = gd.char, goal = gd.followGoal, nav = g.col.nav;
  const fresh = gd.leaderSeenT < 0 || g.time - gd.leaderSeenT < PARTNER_TRUST_SECS; const lp = fresh ? L.char.pos : gd.leaderSeenPos;
  gd.followT -= dt; gd.leaderStillT = !fresh || Math.hypot(L.char.vel[0], L.char.vel[2]) < 0.15 ? gd.leaderStillT + dt : 0;   // (a spot does not move: planted by it long enough he turns and looks at it, as at a leader who never moves again)
  if (gd.followT <= 0) {
    gd.followT = 0.5;
    const f = L.char.forward(), lv: Vec3 = fresh ? L.char.vel : [0, 0, 0];
    goal[0] = lp[0] - f[0] * 1.3 + f[2] * 0.45; goal[1] = 0; goal[2] = lp[2] - f[2] * 1.3 - f[0] * 0.45;                              // behind-left, ~1.4 m off (his left = [f.z, 0, −f.x] in this handedness; only half a step wide, or he clips the leaves standing ajar off the corridor's north wall)
    if (nav.isBlocked(goal[0], goal[2]) || !nav.walkable(lp, goal)) { goal[0] = lp[0] - f[0] * 1.2; goal[2] = lp[2] - f[2] * 1.2; }   // a partition there: straight behind him
    if (nav.isBlocked(goal[0], goal[2]) || !nav.walkable(lp, goal)) { goal[0] = lp[0]; goal[2] = lp[2]; }                            // his back to a wall: on him (the separation push keeps them a body apart)
    else if (!nav.isBlocked(goal[0] + lv[0] * 0.6, goal[2] + lv[2] * 0.6)) { goal[0] += lv[0] * 0.6; goal[2] += lv[2] * 0.6; }        // led by the leader's stride: aim at where the station will be when this plan is walked, or he settles a metre adrift, forever arriving
    const off = Math.hypot(goal[0] - c.pos[0], goal[2] - c.pos[2]);
    const stale = !gd.pathGoal || Math.hypot(gd.pathGoal[0] - goal[0], gd.pathGoal[2] - goal[2]) > 0.5 || (gd.pathI >= gd.path.length && off > 0.7);
    if (stale && off > 0.35) goTo(g, gd, goal, true);
  }
  const gap = Math.hypot(lp[0] - c.pos[0], lp[2] - c.pos[2]);
  const arrived = followPath(g, gd, dt, gap > 4.5 ? Math.max(walk, g.tune.guardInvestigate * 1.1) : gap > 2.0 ? walk * 1.3 : walk);
  if (arrived) {   // planted at his shoulder facing the way he faces, sweeping the rear-left quarter — unless the man has not moved for a while and is right there: then he turns and looks at him (which is how a leader taken down quietly under his nose gets found: bodyInView wants the body in his cone)
    const lookAt = gd.leaderStillT > 6 && gap < 2.2;
    c.bodyYaw = approachAngle(c.bodyYaw, lookAt ? Math.atan2(lp[0] - c.pos[0], lp[2] - c.pos[2]) : L.char.bodyYaw + 0.45, 3 * dt);
    gd.sweep = damp(gd.sweep, Math.sin(gd.lookPhase * 0.6) * (lookAt ? 0.25 : 0.6), 2, dt); c.anim.lookYawExtra = Math.sin(gd.lookPhase * 1.1) * (lookAt ? 0.15 : 0.4);
  }
  else gd.sweep = damp(gd.sweep, Math.sin(gd.lookPhase * 0.7) * 0.3, 2, dt);
  return !arrived;
}

/** Lockdown post on patrol: walk to the junction (one plan, to the exact spot; re-planned only if he gets shoved half a metre off it, at most twice a second), then stand on it
 *  squared along the corridor, muzzle and eyes sweeping it slowly. True while walking. */
function holdPost(g: Game, gd: Guard, dt: number, walk: number): boolean {
  const P = gd.post!, c = gd.char;
  gd.followT -= dt;
  if (gd.followT <= 0 && Math.hypot(P.pos[0] - c.pos[0], P.pos[2] - c.pos[2]) > 0.45 && (!gd.pathGoal || gd.pathI >= gd.path.length || Math.hypot(gd.pathGoal[0] - P.pos[0], gd.pathGoal[2] - P.pos[2]) > 0.5)) {
    gd.followT = 0.5; goTo(g, gd, P.pos, true);
    const last = gd.path[gd.path.length - 1]; if (!last || Math.hypot(last[0] - P.pos[0], last[2] - P.pos[2]) > 0.02) gd.path.push(v3.copy(P.pos));   // the spot itself, not its nav cell's centre
  }
  const arrived = followPath(g, gd, dt, walk);
  if (arrived) { c.bodyYaw = approachAngle(c.bodyYaw, P.yaw, 2.5 * dt); gd.sweep = damp(gd.sweep, Math.sin(gd.lookPhase * 0.45) * 0.75, 2, dt); c.anim.lookYawExtra = Math.sin(gd.lookPhase * 0.9) * 0.45; }
  else gd.sweep = damp(gd.sweep, Math.sin(gd.lookPhase * 0.7) * 0.3, 2, dt);
  return !arrived;
}

/** Lockdown housekeeping on a calm pass, one door a frame: a leaf standing open (or left a hand ajar, unlatched) within a couple of metres gets pulled to — only one
 *  beside or behind him (never the one he is about to walk through), not one anybody is handling right now, only from where the closing leaf cannot sweep him,
 *  and not while a colleague is at the doorway (last man through shuts it) — and a keyed door somebody left unlocked gets its bolt thrown again as he passes (a
 *  kicked-in keep cannot be relocked: that he remarks on instead, the notice in updateGuard). Exterior doors are left alone — their closers shut them — unless
 *  DOORSTAY has taken the closers away: then the ones the level gave a closer are his to shut too; any one door at most every 12 s.
 *  `calm` (a floor below lockdown, under DOORSTAY — no closer does it for him any more): only his keyed doors and the doors to the outside, and only those the level
 *  gave a closer (one authored to stand open stays), pulled to behind him — the lock bites again as the latch catches; nothing relocked, nothing said. */
function lockdownDoors(g: Game, gd: Guard, calm = false) {
  const c = gd.char, f = c.forward();
  for (const d of g.doors.list) {
    if (d.off || (calm ? !(d.def.locked || d.def.exterior) || d.def.closer === false : d.def.exterior && !(g.doors.stay && d.def.closer !== false)) || g.time - d.guardT < 12 || d.quietT < 0.6) continue;   // (quietT: somebody's hands or shoulder are on that leaf right now — his own included, pushing through it)
    const open = !d.latched && (calm || Math.abs(d.angle) > 0.03), relock = !calm && !!d.def.locked && !d.locked && !d.lockBroken;   // (calm: a keyed leaf resting a hair off its latch is a lock that does not bite — to as well)
    if (!open && !relock) continue;
    const fc = d.frameCentre; const dx = fc[0] - c.pos[0], dz = fc[2] - c.pos[2]; const dd = Math.hypot(dx, dz);
    if (dd > 2.0 || dd < 0.9 || (dx * f[0] + dz * f[2]) / dd > 0.55) continue;   // out of reach, standing in the doorway (that is a man passing through, not tidying), or ahead of him
    if (open) {   // the closing leaf sweeps the sector between its angle and the frame (angles about the hinge from the closed direction, CCW +): not from in there
      const px = c.pos[0] - d.def.hinge[0], pz = c.pos[2] - d.def.hinge[1]; const cd = d.def.closedDir;
      const th = Math.atan2(-Math.sin(cd) * px + Math.cos(cd) * pz, Math.cos(cd) * px + Math.sin(cd) * pz);
      if (th * d.angle > 0 && Math.abs(th) < Math.abs(d.angle) + 0.4 && Math.hypot(px, pz) < d.def.width + 0.45) continue;
    }
    let busy = false; for (const o of g.guards) if (o !== gd && o.state !== 'dead' && Math.hypot(o.char.pos[0] - fc[0], o.char.pos[2] - fc[2]) < 2.0) { busy = true; break; }
    if (busy) continue;
    d.guardT = g.time;
    if (open) g.doors.pullTo(d, c.id);   // a stiff sprung close the latch catches (hold-open doors too, and one left a crack open) — the corridor's light pinches off the room's floor as it goes
    if (relock) { g.say(gd, d.noticed ? 'locking this back up' : open ? 'shutting this — and it stays locked' : 'someone left this unlocked — locking it'); d.locked = true; d.noticed = true; d.noticedT = g.time; g.audio.play('lockOpen', d.pos, 0.6, { rate: 0.85 }); }   // (noticed already: the pair read that lock as picked and said so — squad.ts readDoors; either way it now counts as read, and planClears ranks its room first for a while)
    break;
  }
}

/** 0..1 tension for the score: patrol 0, suspicious ~0.5, search ~0.65, alert 1 — and an alarmed floor never quite settles (heightened 0.12, lockdown 0.22); a pair
 *  methodically clearing rooms (scripted, nominally 'search') sits at 0.3: purposeful, not alarmed. `theirs` (the page's score passes MUSIC.theirs, audio/pieces.ts; absent = every
 *  man counts, as it was): in live play a teammate counts only while he is in a fight of his own ('alert') — the wariness a blast, a noise or a tripped breaker left
 *  on him, and the 'search' his order takes him back in (orders.ts), never drain while he is under a script (updateGuard returns into it before the decay) and would
 *  hold the score up with every defender down. While a SHOW runs its men's scripted states are the score's cue (the day showcase's pair hunting) and read as ever. */
export function tension(g: Game, theirs = false): number {
  let x = Math.max(g.blackout.active ? 0.18 : 0, escalationOf(g) >= 2 ? 0.22 : escalationOf(g) >= 1 ? 0.12 : 0);
  const live = theirs && !(g.touring || g.director.showing);
  for (const gd of g.guards) {
    if (gd.state === 'dead' || (live && gd.team === 'operative' && gd.state !== 'alert')) continue;
    const s = gd.script && g.clearing && (gd === g.clearing.a || gd === g.clearing.b) ? 0.3 : gd.state === 'alert' ? 1 : gd.state === 'search' ? 0.68 : gd.state === 'suspicious' ? 0.45 + gd.awareness * 0.2 : conditionCalm(gd) ? 0 : gd.awareness * 0.35;   // (condition.ts: one of the player's own at rest is not a wary guard — under an order nothing drains his number)
    x = Math.max(x, s);
  }
  return x;
}

// ================================================================ SIDES: spawned units, and the engagement seam (teams.ts has the table of sides; the functions are here)
// THE CONTRACT (for whoever stages men and calls this and nothing deeper — spawnUnit / despawnUnit: director.ts, qrf.ts, nightbreach.ts, rescue.ts, quiet.ts, stress.ts;
// engage(): the Director's drill.exchange alone in the game, and the probes under tools/qa directly):
//   spawnUnit(g, { team, pos, yaw?, weapon?, tint?, tint2?, carbineRig?, name?, light? }) → Guard
//       Stands an AI man of side `team` ('operative' | 'hostile' — or 'guard': extra staff off no route) at `pos` facing `yaw`, carrying `weapon` (default: an
//       operative Sam's FN2000 row, a hostile the AKS-74U carbine, staff the 9 mm; `carbineRig: true` = the AKS-74U whatever `weapon` says — in this codebase the
//       carbine in the hands IS the carbine row), jacket `tint` / trousers `tint2`, answering to `name` (default '<team>-<n>'), his weapon light on unless `light:
//       false`. He is a Guard in g.guards like any other — perceived, perceiving, shot and shooting through the same code, drawn, ragdolled, pushed by doors —
//       on a one-point route of his own (Guard.route, routeI −1), HELD on it (Guard.hold: he stands and looks about) until a script or engage() takes him,
//       state 'patrol', deaf to everything that happened before he existed. Throws, clearly, when a budget is spent: 8 characters' shadow capsules all told
//       (Sam + 7), 64 steady lights (his weapon light is one), the owner byte's ids — or when Game.tune.teams is off (the kill switch). Costs Math.random draws
//       (his idle clocks): a world with a unit in it is not the seeded world without.
//   despawnUnit(g, gd) → boolean · despawnUnits(g)
//       Takes a spawned man back out — his light, his meter keys, every reference the others hold to him (a foe, a standoff pair, the camera's spectate index,
//       Sam's arm or grip) — true if he was one. Level staff are never despawned (park them). resetGuards / restartEncounter despawn every unit themselves.
//   engage(g, operatives, hostiles, { timeout = 45, pin = false, surprise = 0 }) → Engagement { done, result, promise, ... }
//       Puts both groups in the fight NOW: any script on a man is ended, hold / pinned come off (pinned stays on with `pin`: they fire from where they stand),
//       state 'alert' at full awareness with a short staggered reaction beat (the hostiles' `surprise` seconds longer: the room caught flat by the door going
//       in — at 0 an open aisle is a coin flip on who fires first, and whoever does mostly wins), each man's foe = the enemy he can best see, else the nearest
//       living one, his fix on that man (licensed to shoot at once if he has him in sight). From there the ordinary AI runs it: acquisition by salience, the
//       aim model, bursts, muzzle discipline within a side, the side-step, suppression, reload beats, one-shot kills, the search when a man is lost; when the
//       last enemy of a side is down the survivors come off the alert ('clear.') and drift back to their marks. `promise` resolves (and `done` / `result` are
//       set — poll them from a tick if you prefer) with an EngageResult when every hostile is down ('cleared'), every operative is ('wiped'), `timeout`
//       seconds pass ('timeout'), the guards are reset under it ('reset'), or another engage() supersedes it ('superseded'). One engagement at a time per
//       Game. Nothing here touches the staff's alarm, radio net or lockdown: those are gated to team 'guard' throughout guards.ts.
//   BREACH_HOOKS bundles the same functions for a caller that wants one import.
/** What spawnUnit takes (see the contract above). */
export interface UnitOpts { team: Team; pos: Vec3; yaw?: number; weapon?: WeaponId; tint?: Vec3; tint2?: Vec3; carbineRig?: boolean; name?: string; light?: boolean;
  /** the pair a teammate is dealt into (UnitInfo.pair) */
  pair?: PairId;
  /** a caller that has decided to stand more men than cast shadows (the four-man squad, nightbreach.ts): the character count this spawn may reach, up to the
   *  skinning's MAX_SKINNED — the men past the eighth DRAWN are skinned, lit and shot at like anybody but have no shadow / reflection / bounce proxies
   *  (BoxWorld.addCharacterCapsules stops at eight; game.ts draws the living first once there are more). Absent = the eight, as ever. */
  budget?: number; }
/** the character budget: BoxWorld uploads shadow capsules for at most 8 characters (scene/boxes.ts addCharacterCapsules), Sam included */
const MAX_CHARACTERS = 8;
/** … and the skinning holds this many (anim/characters.ts MAX_CHARS): the most a caller's own `budget` can ask for */
export const MAX_SKINNED = 16;
/** ids handed to units: clear of Sam's 1 and the staff's 10‥15, inside the owner byte */
const UNIT_ID0 = 20, UNIT_ID1 = 250;
let unitSerial = 0;
rollbackVar('guards.unitSerial', () => unitSerial, v => { unitSerial = v; });
const TEAM_TINT: Record<Team, Vec3> = { guard: [0.42, 0.36, 0.25], operative: [0.07, 0.09, 0.1], hostile: [0.36, 0.33, 0.24], player: [0.05, 0.06, 0.07], civilian: [0.75, 0.62, 0.08] };
const TEAM_TINT2: Record<Team, Vec3> = { guard: [0.02, 0.02, 0.025], operative: [0.05, 0.07, 0.06], hostile: [0.09, 0.08, 0.05], player: [0.1, 0.32, 0.18], civilian: [0.05, 0.06, 0.1] };
export function spawnUnit(g: Game, o: UnitOpts): Guard {
  if (!g.tune.teams) throw new Error('spawnUnit: sides are switched off (Game.tune.teams) — no unit may be spawned');
  if (o.team === 'player') throw new Error("spawnUnit: the 'player' side is the player alone — spawn an 'operative' for a man on his side");
  if (o.team === 'civilian') throw new Error("spawnUnit: civilians are not units — civilians.ts stands them up from the level's civilians block (Game.civilians)");
  const chars = 1 + g.guards.length;
  const cap = Math.max(MAX_CHARACTERS, Math.min(o.budget ?? 0, MAX_SKINNED));
  if (chars + 1 > cap) throw new Error(cap > MAX_CHARACTERS ? `spawnUnit: ${chars} characters already stand (the player + ${g.guards.length} guards/units) and this caller's budget is ${cap} — despawn a unit or reset the guards first`
    : `spawnUnit: ${chars} characters already stand (the player + ${g.guards.length} guards/units) and the shadow-capsule budget is ${MAX_CHARACTERS} (scene/boxes.ts BoxWorld.addCharacterCapsules) — despawn a unit or reset the guards first`);
  const steady = g.engine.lights.lights.filter(l => l.ttl < 0).length;
  if (steady + 1 > MAX_LIGHTS) throw new Error(`spawnUnit: ${steady} steady lights already exist and the light buffer holds ${MAX_LIGHTS} (render/lights.ts) — his weapon light would never upload; despawn a unit first`);
  const used = new Set<number>([g.player.char.id, ...g.guards.map(x => x.char.id)]);
  let id = UNIT_ID0; while (used.has(id) && id <= UNIT_ID1) id++;
  if (id > UNIT_ID1) throw new Error(`spawnUnit: no character id left in ${UNIT_ID0}‥${UNIT_ID1} (the owner byte) — despawn units first`);
  const n = ++unitSerial; const name = o.name ?? `${o.team}-${n}`;
  const weapon: WeaponId = o.carbineRig ? 'aks74u' : o.weapon ?? (o.team === 'operative' ? 'fn2000' : o.team === 'hostile' ? 'aks74u' : 'guard9mm');
  const route: PatrolRoute = { name, points: [[o.pos[0], 0, o.pos[2]]], wait: [0], weapon, keys: [] };   // his one-point stand: nothing to walk, nothing on his belt
  const T = g.tune; const fl = g.engine.lights.add(torchLightDef(`unitlight${id}`, id, T.flashIntensity, T.flashInner, T.flashOuter));
  const gd = new Guard(g.ch, id, route, -1, fl, o.tint ?? TEAM_TINT[o.team], { tint2: o.tint2 ?? TEAM_TINT2[o.team], yaw: o.yaw ?? 0, name, team: o.team });
  gd.unit = { name, spawnedAt: g.time, light: o.light !== false }; if (o.pair) gd.unit.pair = o.pair; gd.hold = true;
  gd.heardUpTo = g.eventSeq;   // (deaf to what was in the air before he existed; the ids run on from here)
  gd.char.update(0);           // a pose — bones — before anybody's sight test or the frame's capsule upload reads him
  g.guards.push(gd);
  return gd;
}
/** everything of a unit that lives outside the Guard object, taken back (despawnUnit / resetGuards): his weapon light out of the engine's list, his meter keys forgotten */
function releaseUnit(g: Game, gd: Guard) {
  g.engine.lights.remove(gd.flashlight);
  g.lightForget(`unitC${gd.char.id}`); g.lightForget(`unitH${gd.char.id}`);
}
export function despawnUnit(g: Game, gd: Guard): boolean {
  if (!gd.unit) return false;
  const i = g.guards.indexOf(gd); if (i < 0) return false;
  if (g.player.holding?.g === gd) g.freeHeld('cancel');           // out of Sam's arm first (player.ts hands him back on his feet; then he goes)
  if (g.player.dragging === gd) g.toggleDrag();
  if (g.player.takedown?.g === gd) g.player.takedown = null;
  releaseUnit(g, gd);
  g.guards.splice(i, 1);
  if (g.spectate === i) g.spectate = -1; else if (g.spectate > i) g.spectate--;   // (the camera follows by index)
  if (g.aimGuard === gd) g.aimGuard = null;
  for (const o of g.guards) {   // nobody keeps a hand on a man who is no longer there
    if (o.foe === gd) { o.foe = null; o.aim.clear(); }
    if (o.standoff?.pair === gd) o.standoff = null;
    if (o.bodyDuty?.body === gd) o.bodyDuty = null;
    if (o.leader === gd) o.leader = null;
    if (o.task?.kind === 'checkOn' && o.task.who === gd) o.task = null;
  }
  return true;
}
export function despawnUnits(g: Game) { for (const gd of [...g.guards]) if (gd.unit) despawnUnit(g, gd); }
/** every spawned unit standing (or lying) in the game right now */
export function units(g: Game): Guard[] { return g.guards.filter(x => !!x.unit); }

/** How an engagement ended, and what happened in it: seconds it ran, who went down (victim, his side, whose round, when — seconds in), rounds fired per side (the
 *  shot events, by who fired them), and who is left standing either side. */
export interface EngageResult { outcome: 'cleared' | 'wiped' | 'timeout' | 'reset' | 'superseded'; secs: number; kills: { victim: string; team: Team; by: string; t: number }[]; rounds: Partial<Record<Team, number>>; operativesLeft: number; hostilesLeft: number; }
export interface Engagement { operatives: Guard[]; hostiles: Guard[]; t0: number; timeout: number; done: boolean; result: EngageResult | null; promise: Promise<EngageResult>;
  /** bookkeeping: the kills so far, rounds so far, who was alive last frame */
  kills: EngageResult['kills']; rounds: Partial<Record<Team, number>>; alive: Set<Guard>; resolve: (r: EngageResult) => void; }
const engagements = new SideMap<Game, Engagement>('guards.engagements');
/** the engagement running on this game, if any (done or not — the last one stays readable until the next) */
export function engagementOf(g: Game): Engagement | null { return engagements.get(g) ?? null; }
/** Arm one man for the fight against `foes` (see engage): off any script and off his marks, alert, a staggered beat (+ `delay`: the caught side's surprise), his enemy chosen and fixed. */
function armForFight(g: Game, gd: Guard, foes: Guard[], pin: boolean, delay = 0) {
  if (gd.state === 'dead') return;
  if (gd.script) endGuardScript(gd, 'alert');
  gd.hold = false; gd.pinned = pin; gd.state = 'alert'; gd.awareness = 1; gd.searchT = 0; gd.bodyDuty = null; gd.searchPlan = null; gd.standoff = null;
  gd.reactT = 0.15 + simRandom() * 0.35 + delay; gd.fireCd = 0.4 + simRandom() * 0.4; gd.reloadT = -1; resetChase(gd);
  gd.witness.alertedBy = 'radio'; gd.witness.alertT = g.time;   // (an order put him there)
  // his man: the enemy he sees best from where he stands, else the nearest living one — fixed, and licensed at once if actually in sight
  let best: Guard | null = null, bestRate = -1, seen = false;
  for (const f of foes) {
    if (f.state === 'dead' || !f.char.alive) continue;
    const vis = canSeeChar(g, gd, f.char, false);
    const rate = vis.visible ? 1 + sightGainOn(g, gd, f, vis.dist) : 1 / (1 + v3.distXZ(gd.char.pos, f.char.pos));   // (anything seen outranks anything not; among the unseen, the nearer)
    if (rate > bestRate) { bestRate = rate; best = f; seen = vis.visible; }
  }
  gd.foe = best; gd.aim.clear();
  if (best) { gd.lastKnown = v3.copy(best.char.pos); if (seen) { gd.lastSeenT = g.time; gd.sightPos = v3.copy(best.char.pos); gd.sightT = g.time; gd.ledT = g.time; } }
}
export function engage(g: Game, operatives: Guard[], hostiles: Guard[], opts: { timeout?: number; pin?: boolean; surprise?: number } = {}): Engagement {
  endEngagement(g, 'superseded');
  const pin = !!opts.pin;
  for (const gd of operatives) armForFight(g, gd, hostiles, pin);
  for (const gd of hostiles) armForFight(g, gd, operatives, pin, Math.max(0, opts.surprise ?? 0));   // (surprise: seconds the room is caught flat by the men coming through the door — 0 = a fair fight, and an open aisle at nine metres is a coin flip on who fires first)
  let resolve!: (r: EngageResult) => void; const promise = new Promise<EngageResult>(res => { resolve = res; });
  const E: Engagement = { operatives: [...operatives], hostiles: [...hostiles], t0: g.time, timeout: opts.timeout ?? 45, done: false, result: null, promise, kills: [], rounds: {}, alive: new Set([...operatives, ...hostiles].filter(x => x.state !== 'dead')), resolve };
  engagements.set(g, E);
  return E;
}
/** name of the character with this id, for the record: Sam, a man's callsign, or the bare id */
function nameOfId(g: Game, id: number): string { if (id === g.player.char.id) return 'Player'; return g.guards.find(x => x.char.id === id)?.callsign ?? (id < 0 ? '—' : `#${id}`); }
/** Close the running engagement with `outcome` (no-op when none is running or it is already done). */
function endEngagement(g: Game, outcome: EngageResult['outcome']) {
  const E = engagements.get(g); if (!E || E.done) return;
  const living = (xs: Guard[]) => xs.filter(x => x.state !== 'dead' && g.guards.includes(x) && !runnerFled(x)).length;   // (runner.ts: a man who dropped it and ran is nobody's living hostile)
  E.done = true; E.result = { outcome, secs: g.time - E.t0, kills: E.kills.slice(), rounds: { ...E.rounds }, operativesLeft: living(E.operatives), hostilesLeft: living(E.hostiles) };
  E.resolve(E.result);
}
/** Once a frame (updateEscalation): book this frame's rounds and deaths into the running engagement and end it when it is decided. */
function tickEngagement(g: Game) {
  const E = engagements.get(g); if (!E || E.done) return;
  for (const e of g.events) if (e.time === g.time && (e.kind === 'shot' || e.kind === 'guardShot') && (e.level ?? 0) >= 1) { const t = e.kind === 'shot' ? 'player' : teamOfId(g, e.who ?? -1); E.rounds[t] = (E.rounds[t] ?? 0) + 1; }   // (this frame's reports: the men fired in updateGuard just now, Sam in updatePlayer before them)
  let gone = false;
  for (const x of E.alive) {
    if (!g.guards.includes(x)) { gone = true; E.alive.delete(x); continue; }
    if (x.state === 'dead') { E.alive.delete(x); E.kills.push({ victim: x.callsign, team: x.team, by: x.killerId >= 0 ? nameOfId(g, x.killerId) : x.downBy ?? '—', t: g.time - E.t0 }); }
  }
  const living = (xs: Guard[]) => xs.some(x => x.state !== 'dead' && g.guards.includes(x) && !runnerFled(x));   // (runner.ts: a man who dropped it and ran is nobody's living hostile)
  if (gone) endEngagement(g, 'reset');
  else if (!living(E.hostiles)) endEngagement(g, 'cleared');
  else if (!living(E.operatives)) endEngagement(g, 'wiped');
  else if (g.time - E.t0 > E.timeout) endEngagement(g, 'timeout');
}
/** One import for the stage lane (see the contract above). */
export const BREACH_HOOKS = { spawnUnit, despawnUnit, despawnUnits, units, engage, engagementOf, lightEstimateAt };
