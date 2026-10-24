// The fragmentation grenade (gear: frags). Three things live here:
//   1. `blast(g, at, spec)` — THE ONE FUNCTION for a fragmenting explosion at a point: who it kills, who it wounds, who a wall saved, the bang the whole floor
//      hears, the flash, the scorch, and the single call into the destruction lane (g.destr.blast where the build has it, else g.destr.bang). The hand grenade is its first caller (detonateFrag, below);
//      anything else that bursts (a 40 mm round) calls the same function with its own radii.
//   2. the ITEM's fuse (fragFuse — combat.ts updateItems hands every live 'frag' item here): it runs from the moment the thing leaves the hand, wherever it is.
//   3. what MEN DO about a live one near them (fragTick / fragFlee): whoever sees or hears it land shouts, and every man the shout reaches who is in its line gets
//      off that line — round a corner if one is close enough to make, else as far as his legs take him before it goes. Both sides: the squad steps off its own.
//
// The lethality model (no hit points anywhere): a man is EXPOSED by the share of four points up his body (shin, hips, chest, head) the burst has a clear line to —
// the solid walk a round takes (collision.ts shotBlocked: every static, a shut or half-open leaf; loose furniture is concealment, not cover) — and GLASS BY ITS
// OWN RULE, not a round's, wherever glass can break (the fracture model live — glassbreak.ts; rebuild/gear-and-glass/bursts.md): a fragment has nothing to give a
// pane (FRAG.paneEnergy 0: glass that STANDS stops it, a hole does not), and the burst reaches the glass before it reaches the men — blast() hands the panes round
// it to the fracture model first (GlassBreak.blast at the burst's own size, FRAG.glassM / glassPower) and then judges every man through what that took: a pane it
// left whole saves the man behind it, a pane it broke saves nobody behind the part that went. Before it goes off, a man reckons the glass the same way (GlassView):
// none of it is cover where the burst would break it. Where glass CANNOT break (that model off, chaos 0, a host without it) a pane is to a burst what it is to a
// round, as it was before any of this: the solid walk, or a pistol round's toll where rounds go through glass.
//   inside lethalM, at least half of him exposed ............ killed
//   inside lethalM, less than half exposed ................... wounded (folded for seconds: rooted, gun down, no round — Guard.staggerUntil)
//   lethalM‥woundM, exposed ................................. killed with a chance falling off with the square of the distance, else wounded
//   nothing of him exposed, or beyond woundM ................. untouched (he hears it like everybody else)
//   already down and breathing (FRAG.downKill) ............... inside lethalM, any line to where he lies kills; lethalM‥woundM, the chance above; else as he was
//   hidden ONLY by what this burst itself broke ............... stunned, never killed: a door it took off (FRAG.doorStun), a wall it holed or cover it broke
//                                                               (FRAG.wallStun) took the fragments as they flew; to the next burst a hole is a hole
// It is IMPARTIAL: the thrower, his own side, the player and anybody unarmed in the room are judged by the same rule. Deterministic — the one dice roll is a
// hash of the burst's serial and the man's id, never Math.random.
//
// (No top-level statement here uses another game module's export: src/game is one import cycle — see CLAUDE.md.)
import { SideMap } from '../math/side';
import { wandDrop } from './wand';
import { Vec3, v3, clamp, lerp } from '../math/vec';
import * as fx from './effects';
import { PLAYER_ID } from './consts';
import { isBreathing, type Game, type Guard, type GuardScript } from './game';   // (isBreathing: asked inside blast only)
import { GRAVITY, bogBounce, bogSlide, bogStick, CAN_ITEM, FRAG_ITEM, type Item } from './throwables';
import { snowBogAt } from './snowBog';
import type { WallOpening } from './wallbreak';
import { chronHit, chronicle } from './chronicle';
import { civiliansShown } from './civilians';
import { killGuard, hitPlayer, flashFuse } from './combat';
import { bangScorch } from './marks';
import { gpuFx, bangFx } from './particleFx';
import { teamOfId, isHostile, type Team } from './teams';
import { teamTallied } from './teamtally';   // (asked inside blast only)
import { fightLive } from './roomfight';
import { loadPace, loadPaceOn } from './kitload';
import { teamBlastPace } from './teampace';   // (read inside fragTick only)
import { PACE, canSee, canSeeChar, crossesDoor, frameOf, witnessKill } from './guards';   // (crossesDoor: asked inside fleeByDoor only)
import type { Door } from './doors';
import { lanePenalty } from './lanes';       // (asked inside fleeByDoor only)
import { tacticsPenalty } from './tactics';
import { THROW_RELEASE } from './character';
import { GUNHAND } from './gunhand';   // (read inside fragThrowTick only)
import { glassBreakLive } from './glassbreak';
import { shotEnergy } from './glasspen';
import { w } from './words';
import { SAMSTUN, foldCancels } from './samstun';
import { DESTRUCTION } from './destructionSwitch';
import { runnerOwns } from './runner';   // (asked inside fragThrowTick only)
import { missionLive } from './mission';   // (asked inside blast only)
import { conditionHurt, conditionPace } from './condition';   // (called inside blast only)
import { moraleBlast } from './morale';   // (called inside blast only: src/game is one import cycle)
import { chaosOf } from './destruction';   // (called inside blast only: src/game is one import cycle)
import { PICTURE, PICTURE_STATS, exposureAsker } from './picture';   // (asked inside fleeSpot only)
import type { Box } from '../scene/boxes';
import { railsDown } from './rails';   // (a spared teammate on his knee is not one of the men a defender counts for his grenade)

/** Every number of the grenade. fuse: seconds from leaving the hand (the player's); orderFuse: a teammate's on an order — cooked a beat, it has less far to go.
 *  lethalM / woundM: the two radii of the model above; woundKill: the chance of a kill at the very edge of lethalM for an exposed man, falling to 0 at woundM;
 *  stagger: seconds folded, [nearest, farthest]. lift: how far over the resting grenade the burst is judged from (a casing on the floor throws its fragments up
 *  and out — a 5 cm door sill is no cover). Reaction: seeM / hearM = how far off a man can notice it (a line of sight to it / its clatter by the sound's own
 *  path); react = seconds before he acts on it [trained, not], + up to reactJit; shoutM = how far his 'grenade!' carries to his own side; fleeM = men in its line
 *  inside this move; runSpeed = a defender's legs (teammates keep their own cap — unless teampace.ts lets a man run from a blast). on = the item exists at all (false: digit 5 says so). */
export const FRAG = {
  on: true, issue: 2, fuse: 3.0, orderFuse: 2.4,
  /** the squad's: how many it carries per run (doortools.ts counts them like its bangs), the key of the door tools' 'frag and clear' row (no digit: the
   *  page's five are taken), how far inside the frame line a teammate throws it */
  squad: 2, orderKey: 'KeyG', orderIn: 3.4,
  lethalM: 4.0, woundM: 8.0, destrM: 2.5, woundKill: 0.6, stagger: [3.2, 1.2] as [number, number], lift: 0.2,
  /** THE PLAYER IS STUNNED BY A BURST THAT DOES NOT PUT HIM DOWN (the maintainer, 10-10: "frags should be able to hurt or stun the player!"): 'wounded' by the
   *  model above — or 'killed' under god mode — he is knocked along the blast, the frame flashes as on a hit, lock work and a held throw end, no round and no
   *  throw leaves his hands for the `stagger` seconds a man at that distance is folded (Player.fireCd), and his aim is thrown as wide as rounds past his head
   *  throw it (Player.sup). Never a hit by itself: Player.hitsLeft is the 'killed' result's. false = a flinch and a line, as it was. */
  samStun: true,
  /** BEHIND A DOOR THE BURST TOOK OFF ITS HINGES. The men are judged on the frame of the burst, with the leaf it has just torn off still standing in its frame —
   *  so a man straight behind that door was 'shielded': not a scratch, not a beat lost, and his first round came a second later through the hole. true: a man
   *  (anybody's, the player too) the burst has no line to ONLY for leaves this same burst took off is 'stunned' — the wound band's own fold (`stagger` by
   *  distance, inside the wound radius), never a kill: the leaf took the fragments, the blast came through the opening. A wall, a jamb, a leaf it left hanging
   *  shield as ever. AND BEFORE THE BURST a door it is about to take is no cover to anybody reckoning his own (exposedTo: a man deciding whether to run from a
   *  grenade, where he runs to, a defender's 'none of mine in it' before he throws, the squad's 'frag and clear' refused for one of ours beyond the room's other
   *  door, the player's step-off cue). false = shielded, and a shut door is cover, as it was; a recording from before the key replays so. Nothing of it runs where
   *  blasts take no doors off (the destruction switch off, chaos 0, DOORBLAST off). */
  doorStun: true,
  /** BEHIND A WALL THE BURST HOLED, OR COVER IT BROKE. The destruction engine opens the wall on the burst's own call, before the men are judged — so the man
   *  behind the drywall was judged through the hole the burst had just made and killed, where a door it tore off only stunned him. true: everybody is judged by
   *  the lines the burst had BEFORE it broke anything (after the glass, which is the burst's by its own rule — FRAG.glassM): what it broke took the fragments on
   *  the frame they flew. A man it had no line to then and has one to now — anybody's, the player too — is 'stunned' like the man behind the torn door (the
   *  wound band's fold by distance, inside the wound radius), never killed; a man who showed a part of himself over cover the burst broke is judged on the part
   *  that showed. To the NEXT burst a hole is a hole — a frame later, or on the same tick (two charges at once: the second is judged through what the first
   *  opened). The glass the burst's OWN pass takes is not this rule's (it goes first, and what it broke saves nobody); a pane only the destruction engine's
   *  arrival takes — after this snapshot, and only with FRAG.glassPower turned well down — reads as cover the burst broke. false = judged through what it has just broken, as it was; a recording from before the key replays so. Nothing of it runs where
   *  a blast breaks nothing (the destruction switch off, chaos 0). NOT here: a man reckoning his cover BEFORE the burst (exposedTo) still counts a wall it
   *  will hole as cover — he does not run from it, and is folded behind it. */
  wallStun: true,
  /** THE BURST AND GLASS (only where the fracture model is live). glassM / glassPower: the size of the blast the panes round it take (GlassBreak.blast's radius and
   *  power — strength at a pane d metres off = glassPower × (1 − d ∕ glassM), against the fracture model's own thresholds GLASSBREAK.blastRunK / blastDiceK /
   *  blastSheetK: at the numbers shipped on 10-08, float glass runs out to 3.5 m, toughened glass dices to 2.8 m, a laminated sheet leaves its frame inside 2.0 m;
   *  a stun charge, 2.6 m at 0.6, does 1.7 m / 0.65 m / never). glassPower 0 = the burst sends glass nothing of its own (the 'bang' every charge makes still stars
   *  it like a stun's). paneEnergy: what a fragment has for a pane on its line, in a round's units (glasspen.ts: 0.5 = a pistol round) — 0 = standing glass stops
   *  it, which is the rule; holes pass whatever it is. */
  glassM: 4.0, glassPower: 1.5, paneEnergy: 0,
  seeM: 9, hearM: 5, react: [0.25, 0.5] as [number, number], reactJit: 0.25, shoutM: 9, fleeM: 9, runSpeed: 3.4,
  /** NOBODY RUNS ONTO IT (fleeWise; the owner's tape 'the depot' 052901: a defender's grenade landed behind the stack at a door, rolled two metres on, and the
   *  flee sent a teammate over it). One rule for whoever gets off a live grenade, either side, at the pace his flee already had: (1) it is judged from where it
   *  will REST — the item step's own bounce and roll replayed on a copy for what is left of its fuse (rollOn) — not from where it is; (2) a leg never passes
   *  nearer that point than he stands when he is dealt it (0.2 m given), nor nearer the floor it still has to roll over, and it ends 0.3 m farther off than he
   *  began (a spot it has no line to: no nearer); (3) the leg he has is kept unless another beats it by `fleeKeep` (in the spot score's metres), so a rolling
   *  grenade does not turn him about — and a man who makes no ground on his leg for a second (a mate stopped in the gap) is dealt another; (4) inside `lethalM`
   *  he never chooses to stay where he is while any such leg exists: getting down saves nobody there. Straight legs still, and nothing here knows of lines of
   *  fire or uncleared rooms. false = the flee as it was (the module's and the frozen stand's; ON in the page, ?nofleewise; TPS_FLEEWISE=1). */
  fleeWise: false, fleeKeep: 1.0,
  /** TWO MENDS TO THE FLEE ABOVE (10-15; claims from the throw order's scratch runs, where a teammate's frag is thrown BECAUSE its mates can get off it).
   *  They act only with fleeWise. `restProps`: the rest guess flies the item as the pool flies it — off loose furniture too (rollOn asked the walls alone:
   *  a grenade a chair stopped was guessed metres on, and the thrower was dealt a corner hidden from the guess and open to the burst), and is judged from the
   *  height it comes to rest at (a table top), not the floor under it; a struck chair is not pushed in the guess. `fleeApart`: no leg would SHOULDER a mate
   *  who is staying — one the grenade has no line to, one down where he was dealt or got to, one who cannot move (folded, blind) or is beyond its reach:
   *  its end within `fleeApartM` of him or its way within `fleeLaneM` (bodies meet at 0.6 m; a man on fall in is walked off his spot by a file mate within 0.85), nearer him than the man stands now, nothing solid between —
   *  and no leg to a spot it has no line to ends within `fleeApartM` of where a mate's own leg off it is going. Two men to one corner leaves one out in it.
   *  Open floor farther off is anybody's; the leg he has is not asked again; a corner goes to whoever is dealt first (not to the nearer man); and inside
   *  `lethalM` the rule gives way if it would leave him no leg at all (a mate shouldered beats a man dead). false = as
   *  it was (the module's and the frozen stand's; ON in the page, ?nofleemates puts both off; TPS_FLEEMATES=1 raises both — they need TPS_FLEEWISE=1). */
  restProps: false, fleeApart: false, fleeApartM: 1.0, fleeLaneM: 0.9,
  /** `fleeOnto` (the same word): a man who has 'arrived' (the script's 0.3 m) but is still coming onto his mark is not dealt again for being in its line there —
   *  he was, a stride short of the corner the burst has no line to, and with no ring of spots nearer than 1.2 m was told to get down where he was: in the open,
   *  0.27 m from cover (the thrower of an ordered frag, wounded at 6.6 m). A man stopped short (a mate in the corner) is dealt again as before. */
  fleeOnto: false,
  /** `fleeSam` (the same word again; 10-17, a kicker killed by his own squad's ordered grenade at a door): SAM IS A MATE WHO IS STAYING. The lists above were
   *  made of the AI's men only, so a leg was dealt onto the floor the player stood on or past his shoulder — and the man stalled against him, still in its
   *  line, until the one-second 'no ground made' deal came or the fuse ran out first (a matter of a twentieth of a second which). With it Sam's place is in
   *  `stay` for a teammate's deal: no spot within `fleeApartM` of him, no leg within `fleeLaneM`. Where Sam will go is his own business: he is read where he is. */
  fleeSam: false,
  /** `fleeLook` (the same word once more; 10-20, the depot's four behind Sam, the squad's own grenade out of the file: the thrower, 5 m from where it would
   *  rest and a mate between him and the nearest cover, was dealt open floor 7.5 m off it and wounded there — with covered floor his legs made on every side
   *  of that mate): A SECOND LOOK BEFORE A MAN SETTLES FOR OPEN FLOOR. The walk below asks 32 turns on rings at 1.2, 2, 3, 4 m …; with a mate staying beside
   *  the cover (`fleeApart` bars every leg within `fleeLaneM` of him) the few spots it asked that the burst has no line to were all his, and the gaps
   *  between the rings and the turns held the rest. When that walk ends on open floor, or on nothing, AND met covered floor that was a mate's, it is
   *  walked once more on the rings between, each turned half a step — the same tests, the same score, no mate shouldered, and only a spot the burst has
   *  no line to (or a wall it will take between), or floor past `woundM`, is taken from it. A man the first walk found cover for is dealt exactly as
   *  before, and so is one with no mate's cover in his reach (the walk is not run for him: its cost is the first walk's again, paid only here). */
  fleeLook: false,
  /** `downKill` (10-22, from play: two men put out with sponge rounds, then a 40 mm burst beside them, and both lay there breathing — the loop over the men
   *  skipped everybody already down): A BURST KILLS A MAN WHO IS DOWN AND BREATHING. A man out cold (struck, choked) or down wounded is judged where he lies
   *  — his hips, his chest, his head and a shin, the same lines and the same wall-and-door rules as a man on his feet — and inside `lethalM` any line to him is
   *  the end of him (the half-hidden man's 'wounded' is a man who flinched behind something; this one did not); past it, the burst's own chance, and a miss
   *  leaves him as he was. The books follow: shot, not breathing; by the player's burst, a kill on the card in place of his own knockout, a 'kill' row on
   *  the timeline and a shooting for whoever watched (a partner's burst on a quiet mission as two is on the card the same way: teamtally.ts); the body is
   *  shoved off the burst (`downShove` m/s at the burst, none at `woundM`). Only a man who is the player's enemy is asked: a teammate or a hostage who is
   *  down, and a civilian (what her death costs is the mission's to say, civilians.ts), are passed over as before — and a defender does not throw where
   *  it would reach a mate of his who is down breathing (`ownClear`). Off = every man already down is passed over, as it was. */
  downKill: false, downShove: 2.4,
  /** A WALL THE BURST WILL OPEN IS NO COVER (10-15; the twin of the door rule in `exposedTo`): a man reckoning his cover from a grenade that has not gone off
   *  asks the destruction engine which walls and cover its burst would open (`Destruction.wallsFor`, the blast's own plan, nothing touched) and reads his line
   *  with those open (`withWallsOpen`). So the flee leaves a partition the burst is about to hole and a man behind one is not counted safe. ON in the page
   *  (`?nowallflee` = off); OFF here and on the frozen stand (`TPS_WALLFLEE=1`); a recording from before the key replays with it off. */
  wallFlee: false,
  /** OUT BY THE OPEN DOOR (10-16; the maintainer's call on a squad caught by a grenade in a bare room: they go out through the already open doorway beside
   *  them, never opening a shut door, never sprinting). The flee deals ONE STRAIGHT LEG; a bare room has no spot the burst has no line to, and its doorway
   *  passes only a leg nearly square to it. With this, a man whose straight leg is nothing, would leave him in the burst's line, or ends in an open doorway's
   *  mouth (`fleeDoorMouth` m of its middle: his mates' way out) is dealt a spot BESIDE AN OPEN DOORWAY, ON ITS FAR SIDE, that the burst has no line to, and
   *  walks there by the floor's own path through that doorway (`fleeByDoor`). Open = the leaf off its hinges, or unlatched, not swinging to, and standing
   *  `fleeDoorOpen` rad or more off its frame: he never opens a shut door, and the path crosses no other. The whole walk is inside `fleeDoorIn` of what his
   *  legs make in the fuse left at the pace the flee already has (a teammate never sprints); no step of it is nearer where the grenade will rest than he
   *  stands by more than `fleeDoorDip` m; none passes within `fleeDoorLeaf` m of a leaf standing open (the floor's path does not know a leaf: walked into
   *  from behind it swings shut in the doorway); never a spot a mate is going to or staying at (fleeApart's lists). A man behind that doorway's own open
   *  leaf is dealt the floor in front of the doorway past the leaf's end first (inside `fleeDoorVia` of his legs' reach) and dealt again within
   *  `fleeDoorViaM` m of it. For the squad, floor it has been on is taken before floor it has not (`fleeDoorNew` off the score — cleared.ts). Acts only
   *  with fleeWise; either side's men. ON in the page (`?nofleedoor` = off); OFF here and on the frozen stand (`TPS_FLEEDOOR=1`); a recording from before
   *  the key replays with it off. */
  fleeDoor: false, fleeDoorOpen: 1.0, fleeDoorIn: 1.0, fleeDoorDip: 0.6, fleeDoorMouth: 0.9, fleeDoorLeaf: 0.3, fleeDoorVia: 0.9, fleeDoorViaM: 0.45, fleeDoorNew: 30, fleeDoorMost: 2, fleeDoorTry: 4, fleeDoorNodes: 1500,
  /** DEFENDERS' OWN FRAGS (fragThrowTick, a room fight only). defenders = the switch (false: nobody on their side carries one and nothing of it runs — the game
   *  as it was); one man in `defShare` carries ONE, at most `defMax` on a floor. A carrier throws at the fix he is fighting from `defNear`‥`defFar` m when the
   *  man he saw inside `defFresh` s has been out of his line of fire for `defBlocked` s (behind cover, round a corner) or he has had two or more of them within
   *  `defBunch` m of each other in view for `defBunchSecs`; he means it for the fix or `defPast` m beyond it on his own line (past the jamb, past the cover), wherever his arm reaches and the grenade would have a line to the man; never with one of his own within `defOwnM` of where it would land and in its line, never with a hostage in its reach,
   *  never twice on a floor inside `defGap` s. He SHOUTS first, then takes `defWind` s to get it out of the pouch and away (shot in that second: no grenade);
   *  it leaves his hand with the whole `defFuse` on it (no cooking) and lands `defScatter` [least, most] m off where he meant it. cueM = how far his shout and
   *  the grenade's bounce reach Sam as a HUD line. */
  defenders: true, defShare: 3, defMax: 3, defFuse: 4.0, defWind: 1.0, defNear: 3.5, defFar: 13, defPast: 2.0, defFresh: 4, defBlocked: 1.2, defBunch: 2.5, defBunchSecs: 0.5,
  defGap: 14, defOwnM: 6, defScatter: [0.6, 2.2] as [number, number], cueM: 12,
};

export interface BlastSpec {
  /** character id whose doing it is (PLAYER_ID, a guard's / unit's id, 0 = nobody's) */
  who: number;
  lethalM?: number; woundM?: number;
  /** a number that differs per burst (an item's serial): the seed of the wound-band dice */
  serial?: number;
  /** what the log calls it ('frag grenade', '40 mm') */
  name?: string;
  /** false = no flash / smoke / scorch / sound of its own (the caller draws its own) — the damage, the bang event and the destruction call still happen */
  fx?: boolean;
  /** passed to the destruction engine's blast() where the build has one (its defaults otherwise): metres it breaks things within, 0‥1+ reach into walls */
  destr?: { radius?: number; power?: number };
}
export type BlastResult = 'killed' | 'wounded' | 'shielded' | 'stunned';
export interface BlastHit { id: number; name: string; team: Team; d: number; exposed: number; result: BlastResult; /** FRAG.downKill: he was already down and breathing when it reached him (always 'killed': a burst that does not kill him leaves no row) */ down?: true; /** 'stunned' only: what stood between him and the burst and went with it — a door it took off, or a wall it holed / cover it broke (FRAG.wallStun) */ behind?: 'door' | 'cover'; }
export interface BlastReport { at: Vec3; who: number; hits: BlastHit[]; killed: number; /** of `killed`: men who were already down and breathing (FRAG.downKill) */ finished: number; wounded: number; shielded: number; /** men (never the player: `player`) behind a door this burst took off (FRAG.doorStun) or a wall it holed / cover it broke (FRAG.wallStun): folded, not hit — a civilian only flinches */ stunned: number; player: BlastResult | null; }

/** QA: every burst's report, newest last (capped), and running counts. */
export const FRAG_LOG: BlastReport[] = [];
export const FRAG_STATS = { thrown: 0, bursts: 0, killed: 0, wounded: 0, shielded: 0, shouts: 0, fled: 0, /** legs dealt out by an open doorway (FRAG.fleeDoor) */ byDoor: 0, /** …and the floor paths asked for them */ doorWalks: 0, own: 0, theirs: 0, cues: 0, /** a defender's wind-up that ended with the grenade still in his hand */ held: 0, /** bursts that stunned the player without putting him down */ samStunned: 0, /** men folded behind a door the burst took off or a wall / cover it broke (the player is the report's `player`) — FRAG.doorStun, FRAG.wallStun */ stunned: 0 };
/** QA: carrier-frames a defender with a frag did NOT throw, by the first reason (calm · stale · near · far · line · gap · hostage · arc · own) */
export const FRAG_WHY: Record<string, number> = {};
export function fragStatsReset() { FRAG_LOG.length = 0; for (const k of Object.keys(FRAG_WHY)) delete FRAG_WHY[k]; const S = FRAG_STATS; S.doorWalks = 0; S.thrown = S.bursts = S.killed = S.wounded = S.shielded = S.shouts = S.fled = S.byDoor = S.own = S.theirs = S.cues = S.held = S.samStunned = S.stunned = 0; }

function hash01(a: number, b: number): number { let x = (Math.imul(a | 0, 0x9E3779B1) ^ Math.imul((b | 0) + 0x7F4A7C15, 0x85EBCA6B)) >>> 0; x ^= x >>> 15; x = Math.imul(x, 0xC2B2AE35) >>> 0; x ^= x >>> 13; return (x >>> 8) / 16777216; }

/** HOW A BURST'S LINE MEETS GLASS (only with the fracture model live — glassbreak.ts; otherwise a pane is whatever the solid walk says and all four are one):
 *    'blown'   the blast's own judgment, made right after it handed the panes to the fracture model: glass that has fallen out or that the blast has just taken
 *              (a piece queued to leave, a toughened pane coming down) is no glass; everything it left standing stops the line
 *    'wary'    a man reckoning his cover from a burst that has not happened yet: no pane the burst would touch enough to break counts for anything (float glass
 *              anywhere in its reach) — he does not get down behind a window that is about to come in on him
 *    'counted' a man counting on the burst to OPEN the glass for him (a thrower): only where it surely would — by the pane's nearest point, inside the reach
 *    'whole'   glass that stands is a wall, whatever a burst would do to it */
export type GlassView = 'blown' | 'wary' | 'counted' | 'whole';
function throughGlass<T>(g: Game, from: Vec3, view: GlassView, fn: () => T): T {
  const gb = g.glassBreak; if (view === 'whole' || !gb || !glassBreakLive(g)) return fn();
  const size = { radius: FRAG.glassM, power: FRAG.glassPower };
  return gb.seeThrough(view === 'blown' ? (bi, X) => gb.goingAt(bi, X) : view === 'wary' ? (bi) => gb.wouldGive(bi, from, size) : (bi, X) => gb.wouldGive(bi, from, size, X), fn);
}
/** is a burst's line from a to b stopped — by anything solid (the walk at the head of this file), and by glass as glass is to a burst */
function burstBlocked(g: Game, a: Vec3, b: Vec3): boolean {
  if (!glassBreakLive(g)) return g.col.shotBlocked(a, b);   // (glass that cannot break: the line of fire as every blast asked it before — the solid walk, or the model's default round where rounds go through glass)
  return FRAG.paneEnergy > 0 ? g.col.shotBlocked(a, b, 0.02, FRAG.paneEnergy) : g.col.solidBlocked(a, b, 0.02);   // (0, the rule: standing glass is a wall to it — the solid walk, holes and what the view opens passed; no round's toll is asked or counted)
}
/** has a burst at `from` a line to `to` (the walk at the head of this file, glass by `view`) */
export function burstLine(g: Game, from: Vec3, to: Vec3, view: GlassView = 'wary'): boolean { return throughGlass(g, from, view, () => !burstBlocked(g, from, to)); }
/** share (0‥1) of a standing / crouching / fallen man the burst point `from` has a clear line to: four points from shin to head */
export function exposure(g: Game, from: Vec3, feet: Vec3, head: Vec3, view: GlassView = 'wary'): number {
  const h = Math.max(0.5, head[1] - feet[1]);
  const pts: Vec3[] = [[feet[0], feet[1] + 0.2 * h, feet[2]], [feet[0], feet[1] + 0.55 * h, feet[2]], [lerp(feet[0], head[0], 0.8), feet[1] + 0.78 * h, lerp(feet[2], head[2], 0.8)], [head[0], head[1], head[2]]];
  return throughGlass(g, from, view, () => { let n = 0; for (const p of pts) if (!burstBlocked(g, from, p)) n++; return n / pts.length; });
}
/** a question asked with these door leaves out of the collision layer's list (nothing else in it moves; put back whatever fn does) */
function withoutLeaves<T>(g: Game, leaves: readonly Box[], fn: () => T): T {
  if (!leaves.length) return fn();
  const col = g.col, dyn = col.dynamicBoxes; col.dynamicBoxes = dyn.filter(b => !leaves.includes(b));
  try { return fn(); } finally { col.dynamicBoxes = dyn; }
}
/** the leaves a hand grenade bursting at `from` would take off its hinges (the destruction engine's own gates and reach; none with FRAG.doorStun off) */
function leavesFor(g: Game, from: Vec3): Box[] {
  if (!FRAG.doorStun) return [];
  const destr = g.destr as unknown as { doorsFor?: (at: Vec3, opts?: { radius?: number; power?: number }) => { box: Box }[] };
  return typeof destr.doorsFor === 'function' ? destr.doorsFor(from, { radius: FRAG.destrM, power: 1 }).map(d => d.box) : [];
}
/** exposure() AS A MAN RECKONS HIS COVER FROM A GRENADE THAT HAS NOT GONE OFF YET: a door the burst would take off its hinges is no cover (FRAG.doorStun — the
 *  burst will fold whoever that leaf alone hides), and neither is a wall or a piece of cover it would open (FRAG.wallFlee: `wallsFor`, below). The same four
 *  points; with nothing between that the burst will take, or the rules off, exposure() exactly. */
export function exposedTo(g: Game, from: Vec3, feet: Vec3, head: Vec3, view: GlassView = 'wary'): number {
  const e = exposure(g, from, feet, head, view); if (e > 0) return e;
  const walls = wallsFor(g, from), leaves = leavesFor(g, from);   // (the walls asked first, with the leaves in: destruction.ts wallsFor)
  if (walls.length) return (g.destr as unknown as { withWallsOpen: <T>(w: readonly WallOpening[], fn: () => T) => T }).withWallsOpen(walls, () => withoutLeaves(g, leaves, () => exposure(g, from, feet, head, view)));
  return leaves.length ? withoutLeaves(g, leaves, () => exposure(g, from, feet, head, view)) : e;
}
/** the walls and cover a hand grenade bursting at `from` would open (the destruction engine's own plan, `Destruction.wallsFor`; none with FRAG.wallFlee off):
 *  a partition the burst is about to hole is no cover — the burst folds whoever it alone hides (FRAG.wallStun), or with that off hits him through the hole.
 *  The plan is asked once a tick for a point (a flee asks it of every spot it weighs, from the one rest guess), and again when a wall has opened since. */
const WALLS_FOR = new SideMap<Game, { time: number; serial: number; at: Map<string, readonly WallOpening[]> }>('frag.WALLS_FOR');
const NO_WALLS: readonly WallOpening[] = [];
function wallsFor(g: Game, from: Vec3): readonly WallOpening[] {
  if (!FRAG.wallFlee) return NO_WALLS;
  const destr = g.destr as unknown as { wallsFor?: (at: Vec3, opts?: { radius?: number; power?: number }) => WallOpening[]; withWallsOpen?: unknown; walls?: { serial: number } };
  if (typeof destr.wallsFor !== 'function' || typeof destr.withWallsOpen !== 'function') return NO_WALLS;
  const serial = destr.walls?.serial ?? 0; let C = WALLS_FOR.get(g); if (!C || C.time !== g.time || C.serial !== serial) WALLS_FOR.set(g, C = { time: g.time, serial, at: new Map() });
  const key = `${from[0]},${from[1]},${from[2]}`; let w = C.at.get(key);
  if (!w) { if (C.at.size >= 64) C.at.clear(); C.at.set(key, w = destr.wallsFor(from, { radius: FRAG.destrM, power: 1 })); }   // (64: a planner asking of many points while the clock stands still does not grow it without end)
  return w;
}
/** the leaves bursts have taken off on this very tick, per Game: they still stand in their frames until the doors are next stepped (two grenades on one door in
 *  one tick: the second is not shielded by the leaf the first took) */
const TORN = new SideMap<Game, { time: number; doors: { off: boolean; box: Box }[] }>('frag.TORN');   // (the doors, not their boxes: a load on the same tick hangs a leaf again, and `off` says so)
const flat = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const sameSide = (a: Team, b: Team) => a === b || (a === 'player' && b === 'operative') || (a === 'operative' && b === 'player');

/** THE BLAST. A fragmenting explosion at `at` (the point it is judged from is FRAG.lift over it): kills and wounds by distance and by what is solid in between
 *  (the model at the head of this file), is heard by the whole floor as a 'bang' event flagged `frag`, flashes, scorches, and hands the destruction lane its
 *  cause — the ONE call into g.destr a frag ever makes. Returns who it touched. Impartial; `spec.who` only decides whose card a kill goes on. */
/** FRAG.downKill: a man a burst can still kill where he lies — down and breathing (out cold, or wounded), the player's enemy, never a civilian */
const downAsked = (gd: Guard): boolean => isBreathing(gd) && !gd.god && !gd.civ && isHostile('player', gd.team);
/** …and the points of him a burst is asked for: hips (the one its range is measured to), chest, head, a shin — each as it lies, never under the floor's skin */
export function lying(gd: Guard): Vec3[] {
  const b = gd.char.bones, up = (p: Vec3): Vec3 => [p[0], Math.max(p[1], 0.12), p[2]], hips = up(b.hips ?? gd.char.pos);
  return [hips, up(b.spine2 ?? hips), up(b.head ?? hips), up(b.shinL ?? hips)];
}
/** how much of those points a burst at `from` has a line to (0‥1), through the glass as `view` reckons it */
export const lyingShows = (g: Game, from: Vec3, pts: Vec3[], view: GlassView): number => throughGlass(g, from, view, () => { let n = 0; for (const p of pts) if (!burstBlocked(g, from, p)) n++; return n / pts.length; });
export function blast(g: Game, at: Vec3, spec: BlastSpec): BlastReport { return g.fogOfWar.doing(spec.who, () => blastRaw(g, at, spec)); }   // (its sparks and dust are its thrower's doing: fogofwar.ts FOG.ours)
function blastRaw(g: Game, at: Vec3, spec: BlastSpec): BlastReport {
  const F = FRAG, lethal = spec.lethalM ?? F.lethalM, wound = Math.max(lethal, spec.woundM ?? F.woundM), serial = spec.serial ?? Math.floor(g.time * 1000);
  const from: Vec3 = [at[0], at[1] + F.lift, at[2]]; const name = spec.name ?? 'frag grenade';
  const rep: BlastReport = { at: v3.copy(at), who: spec.who, hits: [], killed: 0, finished: 0, wounded: 0, shielded: 0, stunned: 0, player: null };
  const side: Team = spec.who ? teamOfId(g, spec.who) : 'guard'; const mine = spec.who === PLAYER_ID;
  if (spec.fx !== false) {
    const gpu = gpuFx(g);
    const L = fx.spawnBurst(g.smoke, g.sparks, from, g.fxSeed++, gpu ? { sparkCount: Math.min(fx.bang.sparkCount, fx.flags.trails ? fx.bang.trailCount : 0) } : undefined);
    if (gpu) bangFx(g, from);
    const light = g.fogOfWar.lightBy(g.engine.lights.flash(L.pos, [1, 0.74, 0.42], L.intensity * 0.7, L.range, L.ttl, 0), spec.who); if (L.radius) light.radius = L.radius;   // (HE: a short orange flash, not the stun charge's white)
    g.audio.play('stunBang', from, 1.0, { rate: 0.62 });   // (no sample of its own yet: the stun charge's, an octave-ish down)
    bangScorch(g, from);
    const eye = g.player.char.bones.head ?? v3.add(g.player.char.pos, [0, 1.6, 0]);
    if (!g.player.down && v3.dist(eye, from) < wound && !g.col.segmentBlocked(from, eye)) g.audio.play('earRing', null, clamp(1.1 - v3.dist(eye, from) / wound, 0.2, 0.7));
  }
  // GLASS, first: the panes round the burst take it BEFORE anything else is asked and before anybody is judged, at the burst's own size — the fracture model's
  // blast entry point, which files the holes and decides what falls (nothing when that model is not live: a pane is then what it was). ONE BLOW however many ways
  // the same burst reaches the glass: GlassBreak.blast takes the arrivals of one charge as one, a pane only ever taking the difference a STRONGER arrival makes.
  // The burst's own is here first; the stun-sized arrival every charge's 'bang' makes (glass.ts updateGlass, later this frame — the same point, lifted as it lifts
  // it) is taken here too, so that whatever the knobs say nothing reaches the glass AFTER the men were judged through it; the destruction engine's blast, where
  // the build has one, feeds the same entry point from the call below, also before the judging.
  if (g.glassBreak) {
    if (F.glassPower > 0) g.glassBreak.blast(from, { radius: F.glassM, power: F.glassPower, who: spec.who });
    g.glassBreak.bang([from[0], Math.max(0.3, from[1]), from[2]], spec.who);
  }
  // DESTRUCTION: the one call site a blast has. The destruction engine's own entry point (g.destr.blast — walls, cover, doors; it runs the old bang()
  // chaos itself) where the build carries it, else the hook the stun charge calls. Either way destruction.ts decides what a blast does to the room.
  const destr = g.destr as unknown as { blast?: (at: Vec3, opts?: { radius?: number; power?: number; who?: number }) => unknown };
  const hung = F.doorStun ? g.doors.list.filter(d => !d.off) : null;
  // WHAT THE BURST HAD A LINE TO BEFORE IT BROKE ANYTHING (FRAG.wallStun): the call below holes walls and breaks cover at once, and the men are judged after
  // it. Asked here — after the glass, before the walls — for everybody in its reach, by character id; null = not asked (the rule off, or a blast that breaks
  // nothing). The same men, by the same tests, as the judging loops below take: a man not asked here is judged on the lines the burst has AFTER the break.
  let before: Map<number, number> | null = null;
  if (F.wallStun && DESTRUCTION.on && typeof destr.blast === 'function' && chaosOf(g) > 0) {
    before = new Map();
    const ask = (feet: Vec3, head: Vec3, id: number) => { if (v3.dist(from, [feet[0], feet[1] + 0.9, feet[2]]) <= wound) before!.set(id, exposure(g, from, feet, head, 'blown')); };
    for (const gd of [...g.guards, ...civiliansShown(g)]) if (gd.state !== 'dead' && !gd.god) ask(gd.char.pos, gd.char.bones.head ?? v3.add(gd.char.pos, [0, 1.65, 0]), gd.char.id);
    if (F.downKill) for (const gd of g.guards) if (downAsked(gd)) { const B = lying(gd); if (v3.dist(from, B[0]) <= wound) before.set(gd.char.id, lyingShows(g, from, B, 'blown')); }   // (a man down and breathing: asked where he lies, as `finish` judges him)
    { const pl = g.player; if (!pl.down) ask(pl.char.pos, pl.char.bones.head ?? v3.add(pl.char.pos, [0, 1.6, 0]), pl.char.id); }
  }
  if (typeof destr.blast === 'function') destr.blast(from, { who: spec.who, ...spec.destr });
  else g.destr.bang(from, spec.who);
  // THE LEAVES THIS BURST TOOK OFF (FRAG.doorStun): still standing in their frames this frame, so still walls to the lines asked below. A man they alone hide
  // from the burst is asked again with them out of the collision layer's list (nothing else in it moves): any line at all = 'stunned'.
  let torn: Box[] = [];
  if (hung) { let T = TORN.get(g); if (!T || T.time !== g.time) TORN.set(g, T = { time: g.time, doors: [] }); for (const d of hung) if (d.off && !T.doors.includes(d)) T.doors.push(d); torn = T.doors.filter(d => d.off).map(d => d.box); }
  g.events.push({ kind: 'bang', pos: v3.copy(from), time: g.time, loud: true, level: 2, who: spec.who, frag: true });   // the loudest thing on the floor: every man hears it (guards.ts hearingCheck)
  // ---- who it touches
  const judgeAt = (id: number, d: number, shows: () => number): { d: number; e: number; r: BlastResult | null; behind?: 'door' | 'cover' } => {
    if (d > wound) return { d, e: 0, r: null };
    const was = before?.get(id), now = was === undefined || was <= 0 ? shows() : was;   // (FRAG.wallStun: the part of him that showed before it broke anything is the part the fragments found)
    const e = was ?? now;
    if (e <= 0) {
      if (now > 0) return { d, e: now, r: 'stunned', behind: 'cover' };   // (hidden until this burst holed the wall or broke the cover in front of him)
      const through = torn.length ? withoutLeaves(g, torn, shows) : 0; return through > 0 ? { d, e: through, r: 'stunned', behind: 'door' } : { d, e, r: 'shielded' };
    }
    if (d <= lethal) return { d, e, r: e >= 0.5 ? 'killed' : 'wounded' };
    const t = (d - lethal) / Math.max(1e-3, wound - lethal); const p = F.woundKill * (1 - t) * (1 - t) * (e >= 0.5 ? 1 : 0.4);
    return { d, e, r: hash01(serial, id) < p ? 'killed' : 'wounded' };
  };
  const judge = (feet: Vec3, head: Vec3, id: number) => judgeAt(id, v3.dist(from, [feet[0], feet[1] + 0.9, feet[2]]), () => exposure(g, from, feet, head, 'blown'));
  const away = (feet: Vec3): Vec3 => { const d: Vec3 = [feet[0] - at[0], 0, feet[2] - at[2]]; const l = Math.hypot(d[0], d[2]); return l > 1e-3 ? v3.normalize([d[0] / l, 0.45, d[2] / l]) : [0, 1, 0]; };
  // A MAN ALREADY DOWN AND BREATHING (FRAG.downKill): judged where he lies; killed outright inside the lethal reach on any line, by the burst's own chance
  // past it, otherwise left exactly as he was (no row in the report). killGuard has already run for him once, so the books are put right here the way
  // wounds.ts does for a round into a wounded man: shot, not breathing, and on the card a kill in place of the knockout that was there.
  const finish = (gd: Guard) => {
    const c = gd.char, B = lying(gd), j = judgeAt(c.id, v3.dist(from, B[0]), () => lyingShows(g, from, B, 'blown'));
    if (j.r !== 'killed' && !(j.r === 'wounded' && j.d <= lethal)) return;
    rep.hits.push({ id: c.id, name: gd.callsign, team: gd.team, d: j.d, exposed: j.e, result: 'killed', down: true }); rep.killed++; rep.finished++;
    if (sameSide(side, gd.team) && spec.who) FRAG_STATS.own++;
    const dir = away(B[0]), line = `${gd.callsign} — the ${name} reached him where he lay`;
    // the card: `had` = his knockout is on it (the player's own, or a partner's that teamtally.ts counted); `fresh` = put down this very step, which that
    // module has not read yet and will, as he is when the step ends — so a partner's burst leaves the kill itself to it
    const st = g.mission.stats, fresh = gd.diedAt === g.time, had = gd.downBy === 'player' || (!fresh && teamTallied(g, gd));
    if (gd.wound) { gd.wound = null; c.anim.wound = null; }
    gd.downKind = 'shot'; gd.downBy = mine ? 'player' : spec.who ? 'guard' : 'world'; if (spec.who) gd.killerId = spec.who;
    const team = !mine && teamTallied(g, gd);
    if (missionLive(g) && (mine || team)) { if (had && st.knockouts > 0) st.knockouts--; if (mine || !fresh) st.kills++; }
    if (mine || (team && !fresh)) chronicle(g, 'kill', { who: gd.callsign, weapon: mine ? name : `a teammate's ${name}` }, B[0]);
    if (mine) witnessKill(g, gd, 'shot', 'player');
    if (!c.ragdoll) c.ragdollize(g.col, dir, true);   // (down wounded: the body is the ragdoll's from the pose he lay in)
    c.ragdoll?.addRigidVelocity(v3.scale(dir, F.downShove * Math.max(0, 1 - j.d / wound)), [0, 0, 0]);   // (the body goes with the burst)
    g.msg(line);
  };
  for (const gd of [...g.guards, ...civiliansShown(g)]) {   // (a civilian who has left the floor is not there to be hit)
    if (gd.state === 'dead' || gd.god) { if (F.downKill && downAsked(gd)) finish(gd); continue; }
    const c = gd.char, head = c.bones.head ?? v3.add(c.pos, [0, 1.65, 0]); const j = judge(c.pos, head, c.id); if (!j.r) continue;
    rep.hits.push({ id: c.id, name: gd.callsign, team: gd.team, d: j.d, exposed: j.e, result: j.r, ...(j.r === 'stunned' && j.behind ? { behind: j.behind } : {}) });
    if (j.r === 'shielded') { rep.shielded++; continue; }
    if (sameSide(side, gd.team) && spec.who) FRAG_STATS.own++;
    if (j.r === 'stunned') rep.stunned++;
    if (j.r === 'killed') {
      rep.killed++;
      killGuard(g, gd, away(c.pos), false, 'shot', mine ? 'player' : spec.who ? 'guard' : 'world', `${gd.callsign} down — the ${name}`);
      if (spec.who) gd.killerId = spec.who;
    } else {
      if (j.r === 'wounded') rep.wounded++;
      if (!gd.civ) {
        const u = clamp(j.d / wound, 0, 1); const secs = lerp(F.stagger[0], F.stagger[1], u);
        gd.staggerUntil = Math.max(gd.staggerUntil, g.time + secs); gd.reactT = Math.max(gd.reactT, secs); gd.weapon.burst = null;
        gd.awareness = Math.max(gd.awareness, 0.92); if (gd.state !== 'alert') gd.lastKnown = v3.copy(at);
        gd.path = []; gd.pathGoal = null; gd.speed = 0;
        if (j.r === 'wounded') conditionHurt(g, gd);   // (condition.ts: it reached him and left him up — hurt from now; a return on its first line with the switch off)
      }
      c.anim.hit();
    }
  }
  { const pl = g.player, c = pl.char;
    if (!pl.down) {
      const head = c.bones.head ?? v3.add(c.pos, [0, 1.6, 0]); const j = judge(c.pos, head, c.id);
      if (j.r) {
        rep.player = j.r; rep.hits.push({ id: c.id, name: 'you', team: 'player', d: j.d, exposed: j.e, result: j.r, ...(j.r === 'stunned' && j.behind ? { behind: j.behind } : {}) });
        const came = j.behind === 'cover' ? 'the blast broke through your cover' : 'the blast came through the door';
        if (j.r === 'killed') { if (g.godMode) rep.player = 'wounded'; else { hitPlayer(g, away(c.pos)); pl.hitFlash = 1; chronHit(g, g.guards.find(x => x.char.id === spec.who)?.callsign ?? (mine ? 'his own grenade' : name)); if (!pl.down) rep.player = 'wounded'; } }
        if (rep.player === 'wounded') conditionHurt(g, pl);   // (condition.ts: the same of the player — never in god mode, never with the switch off)
        if ((rep.player === 'wounded' || rep.player === 'stunned') && F.samStun) {
          const secs = lerp(F.stagger[0], F.stagger[1], clamp(j.d / wound, 0, 1));
          pl.staggerUntil = Math.max(pl.staggerUntil, g.time + secs);   // (samstun.ts: with its switch on he is rooted with his gun down for it, as a man is)
          c.anim.hitFrom(away(c.pos)); pl.hitFlash = 1; pl.fireCd = Math.max(pl.fireCd, secs); pl.sup.v = Math.max(pl.sup.v, 1); pl.sup.kick = Math.max(pl.sup.kick, 1);
          if (SAMSTUN.on) foldCancels(g);   // (samstun.ts: the can in a wind-up goes back on his belt, a keypad / an eased door / a choke stops too; off = the line below alone, as it was)
          if (pl.picking) { pl.picking = null; pl.fHeld = true; } if (pl.wanding) { wandDrop(pl); pl.fHeld = true; } pl.throwHeld = false; pl.pendingThrow = null;
          g.msg(rep.player === 'stunned' ? `the ${name} — ${came}, stunned` : `the ${name} — caught in the blast, stunned`); FRAG_STATS.samStunned++;
        } else if (rep.player === 'wounded') { c.anim.hit(); if (pl.wanding) { wandDrop(pl); pl.fHeld = true; } g.msg(`the ${name} — fragments past you`); }
        else if (rep.player === 'stunned') { c.anim.hit(); if (pl.wanding) { wandDrop(pl); pl.fHeld = true; } g.msg(`the ${name} — ${came}`); }
      }
    } }
  moraleBlast(g, at, spec.who);   // (morale.ts: the men it did not hurt are shaken by it — a return on its first line with the switch off)
  FRAG_STATS.bursts++; FRAG_STATS.killed += rep.killed; FRAG_STATS.wounded += rep.wounded; FRAG_STATS.shielded += rep.shielded; FRAG_STATS.stunned += rep.stunned;
  FRAG_LOG.push(rep); if (FRAG_LOG.length > 64) FRAG_LOG.shift();
  { const eyes: Vec3[] = []; if (!g.player.down) eyes.push(g.player.char.bones.head ?? v3.add(g.player.char.pos, [0, 1.6, 0]));   // the count is for eyes that had a line to it (his own, a teammate's): a room nobody has looked into keeps what it did in there to itself
    for (const o of g.guards) if (o.team === 'operative' && o.state !== 'dead') eyes.push(o.char.bones.head ?? v3.add(o.char.pos, [0, 1.6, 0]));
    const seen = eyes.some(e => v3.dist(e, from) < 30 && !g.col.segmentBlocked(e, from));
    // (the men folded behind a door it took: only those an eye has a line to through the opening it left, and never a civilian, who only flinches — the count says nothing of a room nobody can see into)
    const foldedMen = !seen || !rep.stunned ? [] : withoutLeaves(g, torn, () => g.guards.filter(o => !o.civ && o.state !== 'dead' && rep.hits.some(h => h.id === o.char.id && h.result === 'stunned') && eyes.some(e => !g.col.segmentBlocked(e, o.char.bones.chest ?? v3.add(o.char.pos, [0, 1.2, 0])))));
    const folded = foldedMen.length, behind = foldedMen.some(o => rep.hits.some(h => h.id === o.char.id && h.behind === 'cover')) ? 'what it broke' : 'the door';   // (a wall it holed, cover it broke — or those and a door: FRAG.wallStun)
    g.msg(`${side === 'hostile' ? 'their ' : ''}${name} — ${!seen ? 'out of sight' : `${rep.killed - rep.finished ? `${rep.killed - rep.finished} down` : 'nobody down'}${rep.wounded ? `, ${rep.wounded} hit` : ''}${folded ? `, ${folded} stunned behind ${behind}` : ''}`}`); }
  return rep;
}

/** The hand grenade goes off where it lies (or in the air, if its fuse ran out there): the blast, and the item is gone. */
export function detonateFrag(g: Game, it: Item): BlastReport {
  it.fired = true; it.life = 0;
  return blast(g, it.pos, { who: it.who, serial: it.serial, name: 'frag grenade', destr: { radius: FRAG.destrM, power: 1 } });   // (what it breaks: the destruction engine's radius — 2.5 m takes an ordinary door leaf off from about 1.5 m, by the doors part's number; read only where the build has g.destr.blast)
}
/** combat.ts updateItems, for every live 'frag' item: the fuse runs from the hand, in the air or on the floor */
export function fragFuse(g: Game, it: Item, dt: number) { if (it.fired) return; it.fuse -= dt; if (it.fuse <= 0) detonateFrag(g, it); }

// ---------------------------------------------------------------- men and a live grenade
/** One live grenade's book: who knows of it and from when, who has shouted, where each man in its line is going. */
interface Live { it: Item; side: Team; knows: Map<Guard, number>; shouted: Set<Team>; flee: Map<Guard, GuardScript | null>; /** FRAG.fleeDoor: on the leg round an open leaf's end, the way out still to be dealt */ via?: Set<Guard>; /** where it was (or was coming down) when each man's legs were dealt: it moves a metre on and they are dealt again */ fleeAt: Map<Guard, Vec3>; dealT: Map<Guard, number>; /** counted once in FRAG_STATS.fled */ counted: Set<Guard>; /** Sam has been told of it (a hostile one he can see, or hear land) */ cued: boolean; /** FRAG.fleeWise: where it will rest and the floor it has yet to cross, as last reckoned (restOf) */ rest?: Rest; /** FRAG.fleeWise: where and when each man on a leg last made ground (a man stood behind a mate in a corner is dealt another leg) */ made?: Map<Guard, { at: Vec3; t: number }>; }
/** men who heard the other side shout a grenade out, and until when it keeps them listening for it (fragThrowTick sets it; the notice test below reads it) */
const warned = new SideMap<Guard, number>('frag.warned');
const books = new SideMap<Game, Live[]>('frag.books');
const booksOf = (g: Game) => { let b = books.get(g); if (!b) { b = []; books.set(g, b); } return b; };
/** forget every live grenade's book (a restart, a load): nobody is left running from something that is no longer there */
export function fragReset(g: Game) { defBooks.delete(g); const B = books.get(g); if (!B) return; for (const L of B) for (const gd of L.flee.keys()) { gd.path = []; gd.pathGoal = null; } B.length = 0; }

/** Where a man in a grenade's line goes with `left` seconds on it: the nearest spot he can make that it has no line to, else the farthest he can get from it,
 *  else (nothing better than where he stands) null — he drops where he is. Straight legs only: there is no time to plan a route. */
/** Where a grenade is to be JUDGED from: where it lies once it has bounced, and before that where its arc comes down — walked to the floor or to the first solid
 *  thing in its way. (A man who ran from where it was in the air ran, as often as not, toward where it was going.) */
export function comeDown(g: Game, it: Item): Vec3 {
  if (it.bounces > 0 || it.settled) return it.pos;
  let p: Vec3 = v3.copy(it.pos); const v: Vec3 = v3.copy(it.vel), h = 0.05;
  for (let i = 0; i < 40 && p[1] > 0.08; i++) { const q: Vec3 = [p[0] + v[0] * h, Math.max(0.05, p[1] + v[1] * h), p[2] + v[2] * h]; v[1] -= GRAVITY * h; if (g.col.solidBlocked(p, q)) break; p = q; }
  return [p[0], 0.05, p[2]];
}
/** WHERE IT WILL REST (FRAG.fleeWise), and the floor it crosses from its first touch to there, a point each quarter metre. THE ITEM STEP'S OWN MODEL
 *  (throwables.ts update — KEEP IN STEP: gravity, contact a radius before the centre, friction along what it meets, restitution off it, the same settle test,
 *  the same half-frame step) replayed on a COPY for what is left of its fuse: nothing is moved, bounced or sounded. Statics and door leaves — and, with
 *  FRAG.restProps, the loose furniture the pool's own ray meets (only when some stands within its reach; a struck chair is NOT pushed here, the pool hands it
 *  a little momentum); the reckoning is made again ten times a second, so what a chair did to it is in the next one. What a man who can see it roll can judge; nobody is told anything else by it. */
interface Rest { t: number; still: boolean; at: Vec3; path: Vec3[]; }
function rollOn(g: Game, it: Item, touchFuse?: number, props = FRAG.restProps, high = false): { at: Vec3; path: Vec3[] } {   // (touchFuse / props / high: restOfThrow's, below — left out, every line is what it was)
  let p: Vec3 = v3.copy(it.pos), v: Vec3 = v3.copy(it.vel); const h = 1 / 120, path: Vec3[] = []; let touched = it.bounces > 0, last: Vec3 | null = null;
  let bog = 0;   // (lying snow under its last touch: snowBog.ts — 0 with SNOWBOG off, and every line below is what it was)
  const slow = () => Math.abs(v[1]) < 0.5 && Math.hypot(v[0], v[2]) < 0.35 + (bog > 0 ? bogStick(bog) : 0);
  const span = Math.min(14, Math.hypot(v[0], v[2]) * Math.max(0, it.fuse)) + 1, furn = props && g.props.props.some(P => Math.hypot(P.x - p[0], P.z - p[2]) < span + P.radius);   // (furniture it could reach at all)
  for (let i = Math.min(720, Math.ceil(Math.max(0, it.fuse) / h)); i > 0; i--) {
    v[1] -= GRAVITY * h; let done = false; const air = !touched;
    const move = v3.scale(v, h), len = v3.len(move); if (len < 1e-6) continue;
    const dir = v3.scale(move, 1 / len), tmax = len + it.radius * 3.5; let hit: { t: number; n: Vec3 } | null = g.col.raycast(p, dir, tmax), back = 0;
    if (furn) hit = g.props.raycast(p, dir, hit ? hit.t : tmax) ?? hit;   // (the pool's own ray: throwables.ts — statics and door leaves, then loose furniture nearer than those)
    if (hit) { back = it.radius / Math.max(0.3, -v3.dot(dir, hit.n)); if (hit.t - back > len) hit = null; }
    if (hit) {
      p = v3.mad(p, dir, Math.max(0, hit.t - back)); const n = hit.n, vn = v3.dot(v, n);
      if (vn < 0) { const vN = v3.scale(n, vn), vT = v3.sub(v, vN); v = v3.add(v3.scale(vT, Math.max(0, 1 - it.friction * (0.5 + 0.5 * Math.abs(n[1])))), v3.scale(vN, -it.restitution));
        bog = n[1] > 0.6 && !(hit as { prop?: unknown }).prop ? snowBogAt(g, p[0], p[1] - it.radius, p[2]) : 0;
        if (bog > 0) { const up = v3.dot(v, n), b = bogBounce(bog), s = bogSlide(bog); v = v3.add(v3.scale(v3.sub(v, v3.scale(n, up)), s), v3.scale(n, up * b)); }
        touched = true; if (n[1] > 0.6 && slow()) done = true; }
      p = v3.mad(p, n, 0.002);
    } else p = v3.add(p, move);
    if (p[1] < it.radius) { bog = snowBogAt(g, p[0], 0, p[2]); p[1] = it.radius; if (v[1] < 0) { v[1] *= -it.restitution; v[0] *= 0.7; v[2] *= 0.7; if (bog > 0) { v[1] *= bogBounce(bog); v[0] *= bogSlide(bog); v[2] *= bogSlide(bog); } touched = true; } if (slow()) done = true; }
    if (touched && (!last || flat(last, p) > 0.25)) { last = [p[0], high ? p[1] - it.radius : 0, p[2]]; path.push(last); }
    if (air && touched && touchFuse !== undefined) i = Math.ceil(touchFuse / h) + 1;   // (a fuse that runs from its first touch, and alone decides once it has: a stun canister's — combat.ts updateItems)
    if (done) break;
  }
  return { at: [p[0], props ? Math.max(0.05, p[1]) : restY(p[1]), p[2]], path };
}
/** WHERE A CAN THROWN FROM `from` AT `v0` WILL BE WHEN IT IS DONE MOVING — or when its fuse finds it, if that is sooner (player.ts throwRest: the throw
 *  preview's rest mark): rollOn on a body that was never spawned. A frag: its fuse from the hand. A stun canister: its fuse from its first touch (combat.ts
 *  updateItems), and never more than bang.maxAir in the air. A smoke: until it lies still. Loose furniture is in it as it stands (a chair it strikes is
 *  not pushed here). `path`: what it crosses from its first touch to there, at the height it lies. Nothing of the simulation's is written and nothing
 *  is drawn from the die (the rays fill the caches any ray fills). */
export function restOfThrow(g: Game, kind: 'smoke' | 'flash' | 'frag', from: Vec3, v0: Vec3): { at: Vec3; path: Vec3[] } {
  const B = kind === 'frag' ? FRAG_ITEM : CAN_ITEM, stun = kind === 'flash' ? flashFuse(g) : undefined;
  const it = { pos: from, vel: v0, radius: B.radius, restitution: B.restitution, friction: B.friction, bounces: 0, fuse: kind === 'frag' ? FRAG.fuse : stun !== undefined ? fx.bang.maxAir : 6 } as Item;
  return rollOn(g, it, stun, true, true);
}
/** the height a grenade lying (or caught by its fuse) at y is judged from, less the lift: the floor's 0.05 as it was; with FRAG.restProps what it lies ON */
const restY = (y: number) => FRAG.restProps ? Math.max(0.05, y) : 0.05;
/** where a live grenade is reckoned to come to rest, as the flee reckons it now (for its check: tools/qa/frag-probes.ts) */
export function fragRestGuess(g: Game, it: Item): Vec3 { return it.settled ? [it.pos[0], restY(it.pos[1]), it.pos[2]] : rollOn(g, it).at; }
function restOf(g: Game, L: Live): Rest {
  const it = L.it, R = L.rest; if (R && R.still === it.settled && (it.settled || g.time - R.t < 0.1)) return R;
  return L.rest = it.settled ? { t: g.time, still: true, at: [it.pos[0], restY(it.pos[1]), it.pos[2]], path: [] } : { t: g.time, still: false, ...rollOn(g, it) };
}
/** FRAG.fleeApart: would a straight leg a → b shoulder a mate staying at q — its end within `fleeApartM` of him, or its way within `fleeLaneM`, and either
 *  way nearer him than the man stands now (a man beside him may leave by any leg that does not close on him), with nothing solid between the two there */
function shoulders(g: Game, a: Vec3, b: Vec3, q: Vec3): boolean {
  const dx = b[0] - a[0], dz = b[2] - a[2], L = dx * dx + dz * dz, d0 = Math.hypot(q[0] - a[0], q[2] - a[2]) - 0.05; let x = b[0], z = b[2];
  if (!(Math.hypot(x - q[0], z - q[2]) < Math.min(FRAG.fleeApartM, d0))) {
    const t = L > 1e-6 ? Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[2] - a[2]) * dz) / L)) : 0; x = a[0] + dx * t; z = a[2] + dz * t;
    if (!(Math.hypot(x - q[0], z - q[2]) < Math.min(FRAG.fleeLaneM, d0))) return false;
  }
  return !g.col.solidBlocked([x, 0.45, z], [q[0], 0.45, q[2]]);
}
/** FRAG.fleeDoor: the leaves standing open within `R` m of `p`, each as its hinge and its end on the floor (x, z, x, z). The floor's path and the straight
 *  leg know no leaf, and a man who walks into an open one from behind swings it shut in the doorway on whoever is leaving by it. */
const openLeaves = (g: Game, p: Vec3, R: number): number[][] => g.doors.list.filter(x => !x.off && Math.abs(x.angle) > 0.15 && flat(x.frameCentre, p) < R).map(x => { const u = x.dir(), h = x.def.hinge; return [h[0], h[1], h[0] + u[0] * x.def.width, h[1] + u[1] * x.def.width]; });
const leafDist = (L: number[][], x: number, z: number) => { let m = Infinity; for (const [ax, az, bx, bz] of L) { const ex = bx - ax, ez = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez))); m = Math.min(m, Math.hypot(x - ax - ex * t, z - az - ez * t)); } return m; };
/** a straight leg a → b comes within fleeDoorLeaf of one of them, and nearer it than `ref` (how near he began: a man beside a leaf may still walk off it) */
const legByLeaf = (L: number[][], a: Vec3, b: Vec3, ref: number) => { const r = flat(a, b); for (let t = 0.25; t < r + 0.25; t += 0.25) { const u = r > 1e-3 ? Math.min(1, t / r) : 1, d = leafDist(L, a[0] + (b[0] - a[0]) * u, a[2] + (b[2] - a[2]) * u); if (d < FRAG.fleeDoorLeaf && d < ref - 0.05) return true; } return false; };
/** FRAG.fleeLook: the rings of the second walk — between the first walk's (1.2, 2, 3, 4, 5.5, 7) */
const LOOK_RINGS: readonly number[] = [1.6, 2.5, 3.5, 4.5, 5, 6.25];
/** `wise` (FRAG.fleeWise — `at` is then where it will REST): `path` = the floor it has yet to cross, `keep` = the spot he is already on his way to, `not` = a
 *  spot his legs could not make (a mate in the way): nothing within 0.8 m of it, `apart` = where others of his side are staying and going (FRAG.fleeApart):
 *  no leg that would shoulder a mate who is staying (`shoulders`), and no spot the blast has no line to within it of where a mate is going.
 *  `who` (picture.ts PICTURE.flee): the man whose legs these are. Of the spots the blast has no line to, one that no enemy HE KNOWS OF has a line to either
 *  is worth `PICTURE.fleeCost` of score (small against a hidden spot's 100: it only reorders the hidden ones) — a longer leg his legs still make. Asked as
 *  the blast is asked, of the man down at the spot, and only of a hidden spot that would otherwise beat the best so far. A spot past what his legs make in
 *  the time (the last ring's 0.4 m of grace) pays the whole cost whoever sees it: the rule never sends him to a spot he barely reaches. The leg he is on
 *  (`keep`) pays it only for a FIRM line (half or more: an enemy he saw or heard seconds ago), so an idea ageing a step does not turn him round under a
 *  burning fuse. Never a spot in the blast's line for it; nobody known, the rule off, or no `who` (fragStepOff, the scripted commander walking Sam, passes none):
 *  the spot as it was. Exported for its check (tools/qa/picture-check.ts). */
export function fleeSpot(g: Game, c: { pos: Vec3 }, at: Vec3, speed: number, left: number, accel = Infinity, wise?: { path: Vec3[]; keep: Vec3 | null; not?: Vec3 | null; apart?: { stay: Vec3[]; go: Vec3[] } }, who?: Guard): Vec3 | null {
  const ask = who && PICTURE.on && PICTURE.flee ? exposureAsker(g, who, true) : null, mind = !!ask; let plain: Vec3 | null = null, plainS = 0;   // (plain: what the flee would have dealt with nobody known — counted, never used)
  const it = { pos: at }; const from: Vec3 = [at[0], at[1] + FRAG.lift, at[2]];
  const tt = Math.max(0, left - 0.15), ta = speed / accel;   // (how far his legs really take him: the team picks its pace up at PACE.accel — guards.ts teamLean)
  const reach = Math.max(0.8, tt <= ta ? 0.5 * accel * tt * tt : speed * (tt - ta / 2));
  const d0 = Math.hypot(c.pos[0] - it.pos[0], c.pos[2] - it.pos[2]); const a0 = Math.atan2(c.pos[0] - it.pos[0], c.pos[2] - it.pos[2]);
  let best: Vec3 | null = null, bestS = d0 + 0.7;   // (a spot must beat standing still by a margin)
  let bar: Vec3 | null = null, barS = -Infinity;   // (FRAG.fleeApart: the best of the legs refused for a mate's sake)
  let mates = false;   // (FRAG.fleeLook: the first walk met floor the burst has no line to that was a mate's)
  const seen = (p: Vec3, r: number) => ask ? PICTURE.fleeCost * (r > reach ? 1 : ask(p)) : 0, seenKept = (p: Vec3) => { const e = ask ? ask(p) : 0; return e >= 0.5 ? PICTURE.fleeCost * e : 0; };
  // FRAG.fleeWise. offPath: how near a point is to the floor it has yet to roll over. A leg holds when no step of it is nearer the rest point than he stands now
  // (0.2 m given: a cornered man's one way out is along the wall, which is square to it or a hair past), nor nearer that floor than he stands now (asked only
  // inside lethalM of it; 0.3 m given for a body beside the roll), and its end is farther from the rest point than he is (a spot it has no line to: no nearer).
  // Inside lethalM staying put is no choice at all: any leg that holds beats it.
  const offPath = (x: number, z: number) => { let m = FRAG.lethalM; if (wise) for (const q of wise.path) m = Math.min(m, Math.hypot(x - q[0], z - q[2])); return m; };
  const path0 = wise ? offPath(c.pos[0], c.pos[2]) : 0;
  const holds = (p: Vec3, hidden: boolean): boolean => {
    const dx = p[0] - c.pos[0], dz = p[2] - c.pos[2], r = Math.hypot(dx, dz), dp = Math.hypot(p[0] - it.pos[0], p[2] - it.pos[2]);
    if (hidden ? dp < d0 - 0.05 : dp <= d0 + 0.3) return false;
    for (let s = 0.4; ; s += 0.4) { const u = Math.min(1, s / Math.max(r, 1e-3)), x = c.pos[0] + dx * u, z = c.pos[2] + dz * u;
      if (Math.hypot(x - it.pos[0], z - it.pos[2]) < d0 - 0.2 || offPath(x, z) < path0 - 0.3) return false; if (u >= 1) return true; }
  };
  if (wise && d0 < FRAG.lethalM) bestS = -Infinity;
  plainS = bestS;
  // FRAG.wallFlee with FRAG.wallStun: THREE kinds of floor, not two. Behind a wall (or a leaf) the burst will take he is folded, not hit — worse than a spot
  // it has no line to even then, better than any floor in its plain line. So such a spot is scored between the two (`shade`), and a man who stands behind
  // one now is never dealt open floor for it (below): he gets down where he is. Never a stun traded for a wound.
  const shadeOn = FRAG.wallFlee && FRAG.wallStun, shade = (p: Vec3) => shadeOn && exposure(g, from, p, [p[0], 1.15, p[2]]) <= 0;
  const score = (hidden: boolean, shaded: boolean, r: number, dp: number) => hidden ? 100 - r * 2 + Math.min(dp, 4) * 0.2 : (shaded ? 40 : 0) + Math.min(dp, FRAG.woundM + 1) - 0.15 * r;
  let bestOpen = false;
  if (wise?.keep) { const p = wise.keep, r = Math.hypot(p[0] - c.pos[0], p[2] - c.pos[2]), dp = Math.hypot(p[0] - it.pos[0], p[2] - it.pos[2]);   // the leg he has, scored as a new one is: kept unless one beats it by FRAG.fleeKeep
    const hidden = exposedTo(g, from, p, [p[0], 1.15, p[2]]) <= 0;
    const shaded = !hidden && shade(p);
    if (dp >= d0 - 0.05 && holds(p, true)) { best = plain = p; bestOpen = !hidden && !shaded; plainS = score(hidden, shaded, r, dp) + FRAG.fleeKeep; bestS = plainS - (hidden ? seenKept(p) : 0); } }
  const leaves0 = wise && FRAG.fleeDoor ? openLeaves(g, c.pos, 8) : [], leaves = leaves0.length ? leaves0 : null, leaf0 = leaves ? leafDist(leaves, c.pos[0], c.pos[2]) : 0;
  for (let look = 0; look < 2; look++) {   // (FRAG.fleeLook: the second walk, only for a man the first leaves in the open with cover in reach that was a mate's — the rings between, each turned half a step)
    if (look && !(wise && FRAG.fleeLook && mates && (!best || bestOpen))) break;
    for (const r of look ? LOOK_RINGS : [1.2, 2, 3, 4, 5.5, 7]) {
      if (r > reach + 0.4) break;
      for (let k = 0; k < (wise ? 32 : 16); k++) {   // (wise: the turn walked twice as fine — the long leg along a wall, the gap between a crate and a door frame, found on the first deal)
        const a = a0 + (look ? Math.PI / 32 : 0) + (k % 2 ? -1 : 1) * Math.ceil(k / 2) * (Math.PI / (wise ? 16 : 8)); const p: Vec3 = [c.pos[0] + Math.sin(a) * r, 0, c.pos[2] + Math.cos(a) * r];
        if (g.col.nav.isBlocked(p[0], p[2])) continue;
        if (wise && (!holds(p, true) || (wise.not && Math.hypot(p[0] - wise.not[0], p[2] - wise.not[2]) < 0.8))) continue;   // (the leg itself, before anything dearer is asked of the spot)
        let barred = !!wise?.apart && wise.apart.stay.some(q => shoulders(g, c.pos, p, q));   // (a mate down behind his cover: the corner is his, and so is the floor a leg would shoulder him off on its way by)
        if (g.col.solidBlocked([c.pos[0], 0.45, c.pos[2]], [p[0], 0.45, p[2]])) continue;
        let clear = true; for (let s = 0.4; s < r; s += 0.4) if (g.col.nav.isBlocked(c.pos[0] + Math.sin(a) * s, c.pos[2] + Math.cos(a) * s)) { clear = false; break; }
        if (!clear || (leaves && legByLeaf(leaves, c.pos, p, leaf0))) continue;   // (FRAG.fleeDoor: nor a leg into a leaf standing open)
        const hidden = exposedTo(g, from, p, [p[0], 1.15, p[2]]) <= 0;   // (he gets down behind it when he arrives: judged as the blast will judge him, shin to head)
        const dp = Math.hypot(p[0] - it.pos[0], p[2] - it.pos[2]);
        const shaded = !hidden && shade(p);
        if (wise && !hidden && !shaded && dp <= d0 + 0.3) continue;   // (in its line there: farther off than he began, or it is no spot)
        if (look && !hidden && !shaded && dp <= FRAG.woundM) continue;   // (the second walk is for cover, or floor the burst does not reach: open floor inside it is the first walk's to deal)
        if (!barred && hidden && wise?.apart && wise.apart.go.some(q => Math.hypot(p[0] - q[0], p[2] - q[2]) < FRAG.fleeApartM && !g.col.solidBlocked([p[0], 0.45, p[2]], [q[0], 0.45, q[2]]))) barred = true;   // (a corner a mate is already running for; open floor farther off is anybody's)
        const s0 = score(hidden, shaded, r, dp), s = hidden && s0 > bestS ? s0 - seen(p, r) : s0;
        if (barred) { if (!look) { mates ||= hidden; if (s0 > barS) { barS = s0; bar = p; } } continue; }   // (the second walk hands nobody a leg that shoulders a mate)
        if (mind && s0 > plainS) { plainS = s0; plain = p; }
        if (s > bestS) { bestS = s; best = p; bestOpen = !hidden && !shaded; }
      }
    }
  }
  if (shadeOn && (!best || bestOpen) && shade(c.pos)) return null;   // (behind a wall it will take, and nothing better than open floor to go to: he stays, and gets down)
  if (!best && bar && d0 < FRAG.lethalM) return bar;   // (FRAG.fleeApart: inside what it kills at, a mate shouldered beats a man dead — the rule gives way when it would leave him no leg at all)
  if (mind && best && best !== plain && best !== wise?.keep) PICTURE_STATS.moved++;
  return best;
}

/** FRAG.fleeDoor: a doorway a man can leave by as it stands — the leaf off its hinges, or unlatched and well off its frame */
const openWay = (d: Door) => d.off || (!d.latched && !d.closing && Math.abs(d.angle) >= FRAG.fleeDoorOpen);
/** FRAG.fleeDoor: his spot is in the mouth of an open doorway — the floor his mates' way out runs over */
const inMouth = (g: Game, p: Vec3) => g.doors.list.some(d => openWay(d) && flat(d.frameCentre, p) < FRAG.fleeDoorMouth);
/** FRAG.fleeDoor: the spot beside an open doorway, on its far side, that a grenade resting at `at` has no line to and this man's legs make by the floor's
 *  own path through that doorway in the fuse left — null: none (the straight leg `fleeSpot` dealt stands). No shut door is on that path, no step of it is
 *  nearer the thing than he stands by more than fleeDoorDip, and none runs into a leaf standing open (the floor's path does not know a leaf, and a man who
 *  walks into one from behind swings it shut in the doorway). `via`: he is behind that doorway's own open leaf, and the goal is the floor in front of the
 *  doorway past the leaf's end — he is dealt again there, with the way out then clear. `wise` as fleeSpot's: `keep` = the spot he is already on his way to
 *  (returned itself when it is still the pick, so his path and stride are left as they are). `who`: the man himself — the way is then found as his own
 *  feet will find it (goTo's prices: a lane his side knows is covered, a doorway his tactics hold dear). Exported for its check. */
export function fleeByDoor(g: Game, c: { pos: Vec3 }, at: Vec3, speed: number, left: number, accel: number, wise: { path: Vec3[]; keep: Vec3 | null; not?: Vec3 | null; apart?: { stay: Vec3[]; go: Vec3[] } }, who?: Guard): { goal: Vec3; via: boolean } | null {
  const K = FRAG, nav = g.col.nav, from: Vec3 = [at[0], at[1] + K.lift, at[2]];
  const tt = Math.max(0, left - 0.15), ta = speed / accel, reach = (tt <= ta ? 0.5 * accel * tt * tt : speed * (tt - ta / 2)) * K.fleeDoorIn;
  if (!(reach > 0.5)) return null;   // (no time for any of it — and 0 s at no ramp is not a number)
  const d0 = flat(c.pos, at), offPath = (x: number, z: number) => { let m = K.lethalM; for (const q of wise.path) m = Math.min(m, Math.hypot(x - q[0], z - q[2])); return m; }, path0 = offPath(c.pos[0], c.pos[2]);
  const near = (x: number, z: number) => Math.hypot(x - at[0], z - at[2]) < d0 - K.fleeDoorDip || offPath(x, z) < path0 - 0.3;
  const leaves = openLeaves(g, c.pos, reach + 2);
  /** one straight leg: 0 clear · 1 a step of it is nearer the thing · 2 a leaf stands in it (`ref`: how near a leaf the walk began) */
  const clear = (a: Vec3, b: Vec3, ref: number): 0 | 1 | 2 => { const r = flat(a, b); for (let t = 0.25; t < r + 0.25; t += 0.25) { const u = r > 1e-3 ? Math.min(1, t / r) : 1; if (near(a[0] + (b[0] - a[0]) * u, a[2] + (b[2] - a[2]) * u)) return 1; } return legByLeaf(leaves, a, b, ref) ? 2 : 0; };
  /** the floor's own way from `a` to the spot `p` through doorway `d`: its length — or -1 (no way, a door that is not open on it, a step nearer the thing, not through `d`) · -2 (a leaf stands in it) */
  const walk = (a: Vec3, p: Vec3, d: Door): number => {
    FRAG_STATS.doorWalks++; const way = nav.findPath(a, p, K.fleeDoorNodes, who ? lanePenalty(g, who, tacticsPenalty(g, who, p)) : undefined); if (!way) return -1;   // (goTo's own planner, so the way judged is the way walked — on a shorter leash: a spot inside his reach is found well inside it, and a spot with no way to it costs no more than that)
    let q = a, len = 0, thru = false; const ref = leafDist(leaves, a[0], a[2]);
    for (const b of [...way, p]) {
      for (const x of g.doors.list) if (crossesDoor(q, b, x) || onFrame(b, x)) { if (x === d) thru = true; else if (!openWay(x)) return -1; }
      const cl = clear(q, b, ref); if (cl) return -cl;
      len += flat(q, b); q = b;
    }
    return thru ? len : -1;
  };
  /** a point of the path lies on the door's own frame line, in the opening (a cell's middle on a frame: crossesDoor sees neither leg cross) */
  const onFrame = (b: Vec3, x: Door) => { const f = frameOf(x); if (Math.abs((b[0] - f.hx) * f.nx + (b[2] - f.hz) * f.nz) > 1e-4) return false; const al = (b[0] - f.hx) * f.ux + (b[2] - f.hz) * f.uz; return al >= -0.1 && al <= f.W + 0.1; };
  const ours = !who || who.team === 'operative';   // (cleared.ts is the squad's knowledge of the floor: nobody else's legs are steered by it)
  let best: Vec3 | null = null, bestS = -Infinity, via = false;
  const take = (goal: Vec3, p: Vec3, len: number, v: boolean) => {
    const same = !!wise.keep && flat(goal, wise.keep) < 0.05, sc = 100 - len * 2 + Math.min(flat(p, at), 4) * 0.2 - (!ours || g.cleared.knownAt(p) ? 0 : K.fleeDoorNew) + (same ? K.fleeKeep : 0);
    if (sc > bestS) { bestS = sc; best = same ? wise.keep : goal; via = v; }
  };
  // (the cost of a deal: a floor path a spot. Only the nearest fleeDoorMost doorways standing open inside his reach are asked, their spots the nearest him
  //  first, and a doorway is done with at fleeDoorTry ways found — late in a mission, every door the squad left open, a grenade is still one frame's work)
  const open = g.doors.list.filter(d => openWay(d) && flat(d.frameCentre, c.pos) <= reach).sort((a, b) => flat(a.frameCentre, c.pos) - flat(b.frameCentre, c.pos));
  let asked = 0;
  for (const d of open) {
    const fc = d.frameCentre, W = d.def.width;
    const th = d.def.closedDir, ux = Math.cos(th), uz = Math.sin(th), nx = -uz, nz = ux, side = (c.pos[0] - fc[0]) * nx + (c.pos[2] - fc[2]) * nz >= 0 ? 1 : -1;
    if (((at[0] - fc[0]) * nx + (at[2] - fc[2]) * nz) * side < 0) continue;   // (it lies beyond that doorway: no way out is towards it)
    if (asked++ >= K.fleeDoorMost) break;
    const spots: Vec3[] = [];
    for (const k of [1, -1]) for (const a of [0.4, 0.8, 1.6, 2.4]) for (const o of [0.7, 1.1]) {   // (beside the opening, either hand, room for the men who follow; a body off the wall)
      const s = W / 2 + a, p: Vec3 = [fc[0] + ux * s * k - nx * o * side, 0, fc[2] + uz * s * k - nz * o * side];
      if (nav.isBlocked(p[0], p[2]) || flat(p, at) < d0 - 0.05 || (wise.not && flat(p, wise.not) < 0.8)) continue;
      if (wise.apart && (wise.apart.go.some(q => flat(p, q) < K.fleeApartM) || wise.apart.stay.some(q => flat(p, q) < K.fleeApartM))) continue;
      if (exposedTo(g, from, p, [p[0], 1.15, p[2]]) === 0) spots.push(p);
    }
    spots.sort((a, b) => flat(a, c.pos) - flat(b, c.pos));
    let got = false, leafed = false, ways = 0;
    for (const p of spots) { if (ways >= K.fleeDoorTry || flat(p, c.pos) > reach) break; const len = walk(c.pos, p, d); if (len === -2) leafed = true; if (len < 0 || len > reach) continue; got = true; ways++; take(p, p, len, false); }
    if (got || !leafed || d.off) continue;
    // behind its own open leaf: round the leaf's end first, to the floor in front of the doorway, then out
    const u = d.dir(), h = d.def.hinge, tipN = Math.max(0, ((h[0] + u[0] * W - fc[0]) * nx + (h[1] + u[1] * W - fc[2]) * nz) * side);
    for (const m of [0.65, 1.0]) {   // (past the leaf's end by more than fleeDoorViaM + fleeDoorLeaf: dealt again there, the way on is clear of it)
      const S: Vec3 = [fc[0] + nx * side * (tipN + m), 0, fc[2] + nz * side * (tipN + m)], l0 = flat(c.pos, S);
      if (l0 < K.fleeDoorViaM || nav.isBlocked(S[0], S[2]) || !nav.walkable(c.pos, S) || clear(c.pos, S, leafDist(leaves, c.pos[0], c.pos[2])) || (wise.not && flat(S, wise.not) < 0.3)) continue;
      let any = false;
      let n = 0; for (const p of spots) { if (n >= K.fleeDoorTry) break; const len = walk(S, p, d); if (len < 0 || l0 + len > reach * K.fleeDoorVia) continue; any = true; n++; take(S, p, l0 + len, true); }
      if (any) break;
    }
  }
  return best ? { goal: best, via } : null;
}

/** FRAG.fleeApart: the floor others of his side have a claim to while this grenade burns — where a mate on a leg off it is going, and where a mate is
 *  STAYING: one it has no line to, one down where he was dealt or has got to, one who cannot move (folded, blind) or is beyond its reach. A mate in its line
 *  who has yet to be dealt will be gone from where he stands: that floor is free. Only what this man's longest leg (7 m) could come by. */
function takenBy(g: Game, L: Live | null, gd: Guard, dz: Vec3): { stay: Vec3[]; go: Vec3[] } {
  const stay: Vec3[] = [], go: Vec3[] = [], from: Vec3 = [dz[0], dz[1] + FRAG.lift, dz[2]];
  for (const o of g.guards) {
    if (o === gd || o.state === 'dead' || o.team !== gd.team) continue;
    const s = L?.flee.get(o), p = o.char.pos, onLeg = !!s?.goal && !s.arrived, q = onLeg ? s!.goal! : p;
    if (flat(q, gd.char.pos) > 8.5) continue;
    if (onLeg) go.push(q);
    else if (s || g.time < o.staggerUntil || g.time < o.dazzledUntil || flat(p, dz) > FRAG.fleeM || exposedTo(g, from, p, o.char.bones.head ?? v3.add(p, [0, 1.6, 0])) <= 0) stay.push(p);
  }
  if (FRAG.fleeSam && gd.team === 'operative' && flat(g.player.char.pos, gd.char.pos) <= 8.5) stay.push(g.player.char.pos);   // (Sam: as solid as a mate, and nobody's to deal)
  return { stay, go };
}
/** The list the deal would hand `fleeSpot` for this man off a grenade that came to rest at `dz` and has dealt nobody yet (a forecast's, before the throw:
 *  pass it as `wise.apart`, and the man as `who`, and the forecast is the real first deal). Undefined with FRAG.fleeApart off, as the deal passes none. */
export function fleeMates(g: Game, gd: Guard, dz: Vec3): { stay: Vec3[]; go: Vec3[] } | undefined { return FRAG.fleeApart ? takenBy(g, null, gd, dz) : undefined; }

/** Once a frame, before the men move (game.ts): each live grenade's book — who has noticed it, the shout, and the legs of whoever is in its line. */
export function fragTick(g: Game, _dt: number) {
  const B = booksOf(g);
  for (const it of g.items.items) if (it.kind === 'frag' && !it.fired && !B.some(L => L.it === it)) B.push({ it, side: it.who ? teamOfId(g, it.who) : 'guard', knows: new Map(), shouted: new Set(), flee: new Map(), fleeAt: new Map(), dealT: new Map(), counted: new Set(), cued: false });
  for (let i = B.length - 1; i >= 0; i--) {
    const L = B[i], it = L.it;
    if (it.fired || it.life <= 0 || !g.items.items.includes(it)) { for (const gd of L.flee.keys()) { gd.path = []; gd.pathGoal = null; if (gd.state !== 'dead') gd.char.anim.crouchTarget = 0; } B.splice(i, 1); continue; }
    const F = FRAG, at = it.pos, eyeAt: Vec3 = [at[0], at[1] + 0.12, at[2]], wise = F.fleeWise ? restOf(g, L) : null, dz = wise ? wise.at : comeDown(g, it);   // (seen and heard where it IS; run from where it will BE)
    if (!L.cued && L.side === 'hostile') samCue(g, L, eyeAt);
    if (!g.aiEnabled) continue;
    for (const gd of g.guards) {
      if (gd.state === 'dead' || gd.held || gd.civ) continue;
      const c = gd.char; const d = Math.hypot(c.pos[0] - at[0], c.pos[2] - at[2]);
      if (!L.knows.has(gd)) {
        if (d > Math.max(F.seeM, F.fleeM)) continue;
        let when = -1;
        if (sameSide(L.side, gd.team)) when = g.time + 0.1;   // his own side's: called as it left the hand ('frag out')
        else if (g.time >= gd.dazzledUntil) {
          const head = c.bones.head ?? v3.add(c.pos, [0, 1.6, 0]);
          const to = Math.atan2(at[0] - c.pos[0], at[2] - c.pos[2]); let off = to - c.aimYaw; off = Math.atan2(Math.sin(off), Math.cos(off));
          const told = (warned.get(gd) ?? -1) > g.time, hearM = told ? F.hearM * 2 : F.hearM;   // (he heard them shout it: he is listening for it, and looking)
          const sees = d <= F.seeM && (told || d < 3 || Math.abs(off) < 1.9) && !g.col.segmentBlocked(head, eyeAt);
          let hears = false;
          if (!sees && it.bounces > 0 && d <= hearM) { const pr = g.col.sound.propagate(eyeAt, head); hears = pr.muffle < 0.5 && pr.pathLen <= hearM + 1; }
          if (sees || hears) when = g.time + (gd.trained || gd.team === 'operative' ? F.react[0] : F.react[1]) + hash01(it.serial, c.id) * F.reactJit;
        }
        if (when >= 0) L.knows.set(gd, when);
      }
      const k = L.knows.get(gd); if (k === undefined || g.time < k) continue;
      if (!L.shouted.has(gd.team) && !sameSide(L.side, gd.team) && g.time >= gd.staggerUntil) {   // the first of a side to place it calls it — and the call is what the rest of that side goes on
        L.shouted.add(gd.team); g.say(gd, 'grenade!'); FRAG_STATS.shouts++;
        const mouth = c.bones.head ?? v3.add(c.pos, [0, 1.6, 0]);
        for (const o of g.guards) {
          if (o === gd || o.state === 'dead' || o.team !== gd.team || L.knows.has(o)) continue;
          if (v3.dist(o.char.pos, c.pos) > F.shoutM) continue;
          const pr = g.col.sound.propagate(mouth, o.char.bones.head ?? v3.add(o.char.pos, [0, 1.6, 0])); if (pr.muffle > 0.6 || pr.pathLen > F.shoutM + 2) continue;
          L.knows.set(o, g.time + 0.15 + hash01(it.serial + 7, o.char.id) * 0.15);
        }
      }
      let keep: GuardScript | null = null, not: Vec3 | null = null;   // (FRAG.fleeWise: the leg he was on when he is dealt again · the spot he could not make)
      if (wise) { const cur = L.flee.get(gd), M = L.made ?? (L.made = new Map()), m = M.get(gd);   // on a leg and no ground made for a second (a mate stopped in the gap): another leg, not that spot
        if (!cur?.goal || cur.arrived) M.delete(gd);
        else if (!m || flat(m.at, c.pos) > 0.3) M.set(gd, { at: v3.copy(c.pos), t: g.time });
        else if (g.time - m.t > 1.0 && it.fuse > 0.6) { not = cur.goal; M.delete(gd); L.flee.delete(gd); L.fleeAt.delete(gd); } }
      if (L.via?.has(gd)) { const cur = L.flee.get(gd); if (cur?.goal && g.time - (L.dealT.get(gd) ?? -1) > 0.3 && flat(c.pos, cur.goal) < F.fleeDoorViaM) { L.via.delete(gd); L.flee.delete(gd); L.fleeAt.delete(gd); } }   // (FRAG.fleeDoor: round the leaf's end — the way out is dealt from here, in stride)
      { const cur = L.flee.get(gd), was = L.fleeAt.get(gd);   // dealt again when it has gone on from where he was running from, or when he has got where he was going (or was told to stay down) and it turns out to have a line to him there after all
        if (cur && was && g.time - (L.dealT.get(gd) ?? -1) > 0.3 && (flat(was, dz) > 0.4 || ((!cur.goal || (cur.arrived && !(F.fleeOnto && flat(c.pos, cur.goal) > 0.06 && gd.speed > 0.05))) && it.fuse > 0.6 && exposedTo(g, [dz[0], dz[1] + F.lift, dz[2]], c.pos, c.bones.head ?? v3.add(c.pos, [0, 1.6, 0])) > 0))) { if (wise && cur.goal && !cur.arrived) keep = cur; L.flee.delete(gd); L.fleeAt.delete(gd); } }
      if (L.flee.get(gd)) continue;
      // in its line and close enough to matter: move. (Blind or folded, he cannot.)
      if (flat(c.pos, dz) > F.fleeM || g.time < gd.staggerUntil || g.time < gd.dazzledUntil) continue;
      const head = c.bones.head ?? v3.add(c.pos, [0, 1.6, 0]);
      if (exposedTo(g, [dz[0], dz[1] + F.lift, dz[2]], c.pos, head) <= 0) {   // a wall already between him and it: he stays behind it — down, and going nowhere until it has gone off (a man on somebody's orders is where his orders put him; asked again next frame in case those walk him into its line)
        if (!gd.script && !gd.hold && !gd.pinned && flat(c.pos, dz) <= F.lethalM + 2) /* (a man planted on a post goes nowhere anyway: he fights on from behind it) */ { L.flee.set(gd, { goal: null, upper: 'none', crouch: true }); L.fleeAt.set(gd, v3.copy(dz)); L.dealT.set(gd, g.time); gd.path = []; gd.pathGoal = null; }
        continue;
      }
      const speed = conditionPace(g, gd, teamBlastPace(g, gd, F.runSpeed));   // (the spot is one HIS legs make: a teammate's under his own cap — or, with teampace.ts on, at the flee's run)
      const acc = gd.team === 'operative' && PACE.on && gd.speed < speed * 0.6 ? PACE.accel : Infinity, W = wise ? { path: wise.path, keep: keep?.goal ?? null, not, apart: F.fleeApart ? takenBy(g, L, gd, dz) : undefined } : undefined;
      const legs = loadPace(g, gd, speed), pick = acc * loadPaceOn(g, gd);   // (kitload.ts: the spot is one the legs his CARD leaves him make — the leg itself is asked for at `speed`, and the path scales it)
      let spot = fleeSpot(g, c, dz, legs, it.fuse, pick, W, gd); L.fleeAt.set(gd, v3.copy(dz)); L.dealT.set(gd, g.time); L.via?.delete(gd);
      // (FRAG.fleeDoor: the straight leg leaves him in its line — or there is none: out by an open doorway his legs make, to a spot beside it the burst has no line to)
      if (W && F.fleeDoor && (!spot || exposedTo(g, [dz[0], dz[1] + F.lift, dz[2]], spot, [spot[0], 1.15, spot[2]]) > 0 || inMouth(g, spot))) { const out = fleeByDoor(g, c, dz, legs, it.fuse, pick, W, gd); if (out) { if (out.goal !== keep?.goal) FRAG_STATS.byDoor++; spot = out.goal; if (out.via) (L.via ?? (L.via = new Set())).add(gd); } }
      if (keep && spot === keep.goal) { L.flee.set(gd, keep); continue; }   // (the leg he has: his path and his stride are left as they are)
      L.flee.set(gd, spot ? { goal: spot, speed, upper: 'none', crouch: false } : { goal: null, upper: 'none', crouch: true });
      gd.path = []; gd.pathGoal = null; if (!L.counted.has(gd)) { L.counted.add(gd); FRAG_STATS.fled++; }
    }
  }
}

/** guards.ts updateGuard, before anything else moves him: the script his legs follow while a live grenade he knows of has a line to him (null = none). The caller
 *  runs it through squad.ts runGuardScript for this frame only — his own script, state and fix are left exactly as they were and take over again the frame the
 *  grenade is gone. Once he is there he gets down. */
export function fragFlee(g: Game, gd: Guard): GuardScript | null {
  const B = books.get(g); if (!B || !B.length) return null;
  for (const L of B) { const s = L.flee.get(gd); if (s) { if (g.time < gd.staggerUntil) return null; if (s.goal && s.arrived) s.crouch = true; return s; } }
  return null;
}
/** is he on his legs off a live grenade this frame (silent.ts: a silent squad's walk is not the pace a man leaves a grenade at) */
export function fragRunning(g: Game, gd: Guard): boolean { const B = books.get(g); if (!B || !B.length) return false; for (const L of B) { const s = L.flee.get(gd); if (s && s.goal) return true; } return false; }
/** a grenade's bang that his OWN side threw (guards.ts hearingCheck: called as it left the hand — not a threat to place, not a charge the enemy used on them) */
export function ownBang(g: Game, gd: Guard, e: { frag?: boolean; who?: number }): boolean { return !!e.frag && ownNoise(g, gd, e.who); }
/** a noise filed under the id of a man of his own side (a door his side's blast or boot took) */
export function ownNoise(g: Game, gd: Guard, who?: number): boolean { return who !== undefined && who !== 0 && sameSide(teamOfId(g, who), gd.team); }

// ---------------------------------------------------------------- Sam and a hostile grenade: the cue
/** A defender's live grenade that Sam can see, or hear land, inside FRAG.cueM: one HUD line, once ('GRENADE — get clear'), and from then on the overlay marks
 *  where it lies (fragMarks). Nothing moves him: the fuse is long enough that a player who goes when he reads it lives. */
function samCue(g: Game, L: Live, eyeAt: Vec3) {
  const pc = g.player.char; if (g.player.down) return;
  const d = Math.hypot(pc.pos[0] - eyeAt[0], pc.pos[2] - eyeAt[2]); if (d > FRAG.cueM) return;
  const head = pc.bones.head ?? v3.add(pc.pos, [0, 1.6, 0]);
  let knows = !g.col.segmentBlocked(head, eyeAt);
  if (!knows && L.it.bounces > 0) { const pr = g.col.sound.propagate(eyeAt, head); knows = pr.muffle < 0.6 && pr.pathLen <= FRAG.cueM; }
  if (!knows) return;
  L.cued = true; FRAG_STATS.cues++; g.msg('GRENADE — get clear');
}
/** the overlay's: every hostile grenade Sam has been cued on — where it lies and the seconds left on it */
export function fragMarks(g: Game): { at: Vec3; left: number }[] {
  const B = books.get(g); if (!B || !B.length) return [];
  const out: { at: Vec3; left: number }[] = []; for (const L of B) if (L.cued && !L.it.fired) out.push({ at: L.it.pos, left: L.it.fuse }); return out;
}
/** QA's scripted commander (tools/qa/playthrough.ts) and anything else that walks Sam for him: where a player who has read the cue would go — the spot fleeSpot
 *  gives a man with Sam's legs (`speed`) off the nearest cued grenade that has a line to him, null when there is none or he is as well off where he stands. */
export function fragStepOff(g: Game, speed = 3.2): Vec3 | null {
  const B = books.get(g); if (!B || !B.length) return null; const pc = g.player.char;
  for (const L of B) {
    if (!L.cued || L.it.fired) continue; const wise = FRAG.fleeWise ? restOf(g, L) : null, at = wise ? wise.at : comeDown(g, L.it);   // (the same judgment the men make)
    if (Math.hypot(pc.pos[0] - at[0], pc.pos[2] - at[2]) > FRAG.woundM) continue;
    if (exposedTo(g, [at[0], at[1] + FRAG.lift, at[2]], pc.pos, pc.bones.head ?? v3.add(pc.pos, [0, 1.6, 0])) <= 0) continue;
    const spot = fleeSpot(g, pc, at, speed, L.it.fuse, Infinity, wise ? { path: wise.path, keep: null } : undefined); if (spot) return spot;
  }
  return null;
}

// ---------------------------------------------------------------- defenders' own frags
interface Carrier { gd: Guard; frags: number; blockedT: number; bunchT: number; tryAt: number; wind: { until: number; at: Vec3; swung: boolean; lastT: number; /** another rule asked for the throw (fragThrowAt): the hand it was meant to leave — his arm round the corner he stands behind — and the point that arm goes toward (if he is no longer by that hand at the release, his arm goes round toward it from where he is) */ hand?: Vec3; toward?: Vec3 } | null; /** grenades that have left his hand */ away?: number; /** the open spots by a place another rule last asked him to throw at, kept a second (they do not depend on his hand) */ spots?: { at: Vec3; from: Vec3; t: number; list: Vec3[] } }
interface DefBook { men: Guard[]; carriers: Carrier[]; lastT: number; serial: number; thrown: number; }
const defBooks = new SideMap<Game, DefBook>('frag.defBooks');
const defendersOf = (g: Game) => g.guards.filter(gd => gd.team === 'hostile' && !!gd.unit);
/** deal the floor's frags: one defender in `defShare`, at most `defMax`, picked by a hash of the men's ids (never Math.random) — the same men every run of a seed */
function dealCarriers(g: Game, was?: DefBook): DefBook {
  const men = defendersOf(g), n = Math.min(FRAG.defMax, Math.ceil(men.length / Math.max(1, FRAG.defShare)));
  const pick = [...men].sort((a, b) => hash01(a.char.id, 9173) - hash01(b.char.id, 9173) || a.char.id - b.char.id).slice(0, n);
  const B: DefBook = { men, carriers: pick.map(gd => ({ gd, frags: 1, blockedT: 0, bunchT: 0, tryAt: 0, wind: null })), lastT: -100, serial: 0, thrown: 0 };
  if (was) {   // the roster changed under a run (a man spawned or taken off the floor): the men who had one keep theirs as it was, what was thrown stays thrown, the clock and the scatter's count run on
    B.lastT = was.lastT; B.serial = was.serial; B.thrown = was.thrown; let fresh = Math.max(0, FRAG.defMax - was.thrown - was.carriers.filter(c => c.frags > 0 && men.includes(c.gd)).length);
    B.carriers = B.carriers.map(c => was.carriers.find(o => o.gd === c.gd) ?? (fresh-- > 0 ? c : { ...c, frags: 0 }));
  }
  defBooks.set(g, B); return B;
}
/** QA / the panel: who on the defenders' side still carries a frag */
export function fragCarriers(g: Game): Guard[] { return (defBooks.get(g)?.carriers ?? []).filter(c => c.frags > 0 && c.gd.state !== 'dead').map(c => c.gd); }
const SHOUTS = ['frag out!', 'grenade out!', 'fire in the hole!'];

/** Once a frame, beside fragTick (game.ts): the defenders' frags — FRAG.defenders, and only in a room fight (a scenario; never the night game, a tour or a
 *  showcase). Reads only what the man's own AI already knows (his foe, his fix, when he last saw him): with no throw it moves nothing and asks no sensor. */
export function fragThrowTick(g: Game, dt: number) {
  const F = FRAG; if (!F.on || !F.defenders || !g.aiEnabled || !fightLive(g) || g.director?.theirFragsOff) return;   // (a level's script may put them off for its level: director.ts `systems.theirFrags`)
  let B = defBooks.get(g); const men = defendersOf(g);
  if (!B || B.men.length !== men.length || B.men.some((m, i) => m !== men[i])) { if (!men.length) return; B = dealCarriers(g, B); }
  for (const C of B.carriers) {
    const gd = C.gd, c = gd.char; if (!C.frags) continue;
    if (gd.state === 'dead' || gd.held || runnerOwns(gd)) { C.wind = null; continue; }   // (runner.ts, false with its switch off: a man who has said he is done throws nothing — a wind-up under way ends with the grenade on his belt)
    const out = g.time < gd.staggerUntil || g.time < gd.dazzledUntil;
    const head = c.bones.head ?? v3.add(c.pos, [0, 1.6, 0]);
    if (C.wind) {   // the second it takes him: shot, folded or blinded in it and the grenade stays on his belt
      const Wd = C.wind;
      if (out) { C.wind = null; continue; }
      if (!Wd.swung && g.time >= Wd.until - THROW_RELEASE) { Wd.swung = true; c.anim.throwItem(flat(c.pos, Wd.at)); }
      if (g.time < Wd.until) continue;
      C.wind = null;
      let from: Vec3 = Wd.hand && flat(Wd.hand, c.pos) < 1 && !g.col.solidBlocked([c.pos[0], Wd.hand[1], c.pos[2]], Wd.hand) ? Wd.hand : Wd.toward ? armRound(g, c.pos, Wd.toward) : [c.pos[0] + Math.sin(c.aimYaw) * 0.35, c.pos[1] + 1.5, c.pos[2] + Math.cos(c.aimYaw) * 0.35];
      let sol = g.items.solve(from, Wd.at, 11);
      if (GUNHAND.on && GUNHAND.throwFree && !Wd.toward && c.anim.throwOff) {   // (gunhand.ts: thrown with the free hand, it leaves THAT hand — where the hand has the same arc to the same spot; from where it always did otherwise. The plain throw only: an arm round a corner is that rule's own point)
        const h = c.bones.handL;
        if (h && flat(h, c.pos) < 1 && !g.col.solidBlocked([c.pos[0], h[1], c.pos[2]], h)) { const sh = g.items.solve(h, Wd.at, 11); if (lands(sh, Wd.at, 2)) { from = v3.copy(h); sol = sh; } }
      }
      if (!lands(sol, Wd.at, 2) || !ownClear(g, gd, sol.land, true) || hostageNear(g, sol.land)) {   // (a mate has come into its reach, or he has lost the arc: it stays in his hand, he says so, and the floor's clock is as it was before he shouted)
        B.lastT = Wd.lastT; C.tryAt = g.time + 2; g.say(gd, w('no — holding it!', 'no — hold it!')); FRAG_STATS.held++; continue; }
      const it = g.items.spawn('frag', from, sol.v0, { fuse: F.defFuse, who: c.id, heading: v3.yawOf(sol.v0) });
      it.onBounce = (sp, q, g) => g.audio.play('canisterBounce', q, Math.min(1, sp / 4));
      C.frags--; C.away = (C.away ?? 0) + 1; B.thrown++; FRAG_STATS.theirs++;
      continue;
    }
    const no = (w: string) => { FRAG_WHY[w] = (FRAG_WHY[w] ?? 0) + 1; };
    if (out || fragFlee(g, gd)) { C.blockedT = C.bunchT = 0; continue; }
    if ((gd.state !== 'alert' && gd.state !== 'search') || !gd.lastKnown) { C.blockedT = C.bunchT = 0; no('calm'); continue; }
    if (g.time - Math.max(gd.lastSeenT, gd.fixT) > F.defFresh) { C.blockedT = C.bunchT = 0; no('stale'); continue; }   // (a fix his eyes or his ears gave him inside defFresh: the stack he heard at a door is a fix)
    const fix = gd.lastKnown, d = flat(c.pos, fix);
    if (d < F.defNear || d > F.defFar) { C.blockedT = C.bunchT = 0; no(d < F.defNear ? 'near' : 'far'); continue; }
    // (a) the man he was on has gone where his rifle cannot follow; (b) two or more of them bunched in his view
    const chest: Vec3 = [fix[0], fix[1] + 1.1, fix[2]];
    C.blockedT = g.col.shotBlocked(head, chest, 0.02, shotEnergy(g, c, gd.weapon.def)) ? C.blockedT + dt : 0;   // (HIS line of fire, by his own gun and his side's rule on glass — the question every round of his asks, guards.ts clearShot: a man his rifle reaches through a window is not a man it cannot follow)
    let bunch = 0;
    if (g.time - gd.lastSeenT < 0.5) {
      // (counted by the eye test every sighting of his goes through — cone, range, a line, the smoke between, his own dazzle: guards.ts canSeeChar — and only a man lit enough to be made out, or the one he is already on)
      // … or along his own gun line (within 45° of his aim, a line to the man, his eyes not full of magnesium): the eye test's look sits well off a shouldered gun's bore — the 'eyes on the sights' note in guards.ts
      const sights = (p: Vec3, hd: Vec3 | undefined) => { let off = Math.atan2(p[0] - c.pos[0], p[2] - c.pos[2]) - c.aimYaw; off = Math.atan2(Math.sin(off), Math.cos(off)); return Math.abs(off) < 0.785 && g.time >= gd.dazzledUntil && flat(p, c.pos) < 16 && !g.col.segmentBlocked(head, hd ?? v3.add(p, [0, 1.5, 0])); };
      const pl = g.player; if (!pl.down && !g.playerInvisible && flat(pl.char.pos, fix) <= F.defBunch && (gd.foe === 'player' || pl.visibility > 0.2) && (canSee(g, gd).visible || (gd.smokeTrans >= 0.3 && sights(pl.char.pos, pl.char.bones.head)))) bunch++;
      for (const o of g.guards) if (o.team === 'operative' && o.state !== 'dead' && !railsDown(g, o) && flat(o.char.pos, fix) <= F.defBunch && (gd.foe === o || o.visibility > 0.2) && (canSeeChar(g, gd, o.char, false).visible || sights(o.char.pos, o.char.bones.head))) bunch++;
    }
    C.bunchT = bunch >= 2 ? C.bunchT + dt : 0;
    if (C.blockedT < F.defBlocked && C.bunchT < F.defBunchSecs) { no('line'); continue; }
    if (g.time - B.lastT < F.defGap) { no('gap'); continue; }
    if (g.time < C.tryAt) continue; C.tryAt = g.time + 0.25;   // (the throw is looked for four times a second, not sixty)
    if (hostageNear(g, fix)) { no('hostage'); continue; }   // (not with their own hostages in its reach)
    // WHERE HE MEANS IT: the fix itself, else the nearest spot by it that his arm can reach AND that has a line to the man (a grenade is what goes round the
    // corner his rifle cannot) — then off that by an untrained arm's scatter, which is where it really lands
    const from: Vec3 = [c.pos[0] + Math.sin(c.aimYaw) * 0.35, c.pos[1] + 1.5, c.pos[2] + Math.cos(c.aimYaw) * 0.35];
    // A FIX HIS EARS GAVE HIM (nobody in his sight inside defFresh) is where the noise reached him from — through a doorway, that is the doorway itself, on his own
    // side of it. He throws PAST such a point (the two spots beyond it on his own line: through the opening, with a line back to it) or not at all: at it, or
    // beside it, is his own side of a shut door. Measured: 185 grenades in 288 scripted room clears burst on the thrower's side of a door the team was behind.
    const seen = g.time - gd.lastSeenT <= F.defFresh;
    // GLASS between the spot and the man, by the rule his rifle goes by (glasspen.ts shotEnergy, as above): a man whose rounds go through glass counts on his
    // grenade to open a pane it lands beside — only where it surely would; a man whose rounds do not (his side told not to, ?glassfoes=0; rounds through glass
    // off) takes standing glass for the wall his rifle takes it for, and throws round it or not at all
    const aim = aimSpots(g, gd, from, fix, seen ? 17 : 0)[0];
    const why = aim ? windUp(g, B, C, head, from, aim) : 'arc'; if (why) no(why);
  }
}
/** WHERE HE MEANS IT, for a grenade at the man at `fix`: of `n` spots by the fix (two BEYOND it on the thrower's own line — long beats short: past the jamb,
 *  past his cover — then the fix itself, then two rings round it), those that are open floor with the burst's line to the man's chest by the glass rule his
 *  rifle goes by. `from` given: only the first of them his arm can land it on from that hand (none = empty); null: all of them, whatever his arm reaches */
function aimSpots(g: Game, gd: Guard, from: Vec3 | null, fix: Vec3, n: number): Vec3[] {
  const F = FRAG, c = gd.char, d = flat(c.pos, fix), ux = (fix[0] - c.pos[0]) / (d || 1), uz = (fix[2] - c.pos[2]) / (d || 1), out: Vec3[] = [];
  const chest: Vec3 = [fix[0], fix[1] + 1.1, fix[2]], glass: GlassView = (shotEnergy(g, c, gd.weapon.def) ?? 0) > 0 ? 'counted' : 'whole';
  for (let q = -2; q < n; q++) {
    const rr = q <= 0 ? 0 : q <= 8 ? 1.3 : 2.4, aa = q * (Math.PI / 4), on = q === -2 ? F.defPast : q === -1 ? F.defPast * 0.55 : 0;
    const p: Vec3 = [fix[0] + ux * on + Math.sin(aa) * rr, 0, fix[2] + uz * on + Math.cos(aa) * rr];
    if (g.col.nav.isBlocked(p[0], p[2]) || !burstLine(g, [p[0], F.lift + 0.05, p[2]], chest, glass)) continue;
    if (!from) out.push(p); else if (lands(g.items.solve(from, p, 11), p, 1.0)) return [p];
  }
  return out;
}
/** THE WIND-UP BEGINS, for a grenade meant for `aim` from the hand at `from`: an untrained arm's scatter off it, none of his own in what it would reach, then
 *  the shout, the floor's clock, and the cue in every ear of the other side that the shout reaches. null = he has shouted and is getting it out; else why not
 *  (nothing changed). `toward` (another rule's throw): `from` is his arm round a corner toward that point, and the release is from that same hand while he is still by it */
function windUp(g: Game, B: DefBook, C: Carrier, head: Vec3, from: Vec3, aim: Vec3, toward?: Vec3): 'arc' | 'own' | null {
  const F = FRAG, gd = C.gd, c = gd.char;
  const k = B.serial + 1, r = lerp(F.defScatter[0], F.defScatter[1], hash01(c.id, 31 * k)), a = hash01(c.id + 5, 17 * k) * Math.PI * 2;
  let land: Vec3 = [aim[0] + Math.sin(a) * r, 0, aim[2] + Math.cos(a) * r]; if (g.col.nav.isBlocked(land[0], land[2])) land = aim;
  let sol = g.items.solve(from, land, 11); if (!lands(sol, land, 1.6)) sol = g.items.solve(from, aim, 11);   // (the scatter would put it into a wall on the way: it goes where he meant it)
  if (!sol) return 'arc';
  if (!ownClear(g, gd, sol.land)) return 'own';
  C.wind = { until: g.time + F.defWind, at: sol.land, swung: false, lastT: B.lastT, hand: toward ? from : undefined, toward };
  B.serial = k; B.lastT = g.time; C.blockedT = C.bunchT = 0;
  const shouts = w(SHOUTS.slice(1), SHOUTS);   // ('frag out!' is the team's own drill word: not in a defender's mouth — words.ts)
  g.say(gd, shouts[Math.floor(hash01(c.id, k) * shouts.length) % shouts.length]);
  const pc = g.player.char, pr = g.col.sound.propagate(head, pc.bones.head ?? v3.add(pc.pos, [0, 1.6, 0]));   // the cue, where Sam is in earshot of it
  if (!g.player.down && pr.pathLen <= F.cueM * 1.5 && pr.muffle < 0.75) { g.msg("they're shouting a warning. a grenade is coming"); FRAG_STATS.cues++; }
  for (const o of g.guards) {   // …and the team's, the same shout in the same ears: for the next few seconds they are looking for it
    if (o.state === 'dead' || o.team === gd.team || sameSide(o.team, gd.team)) continue;
    const po = g.col.sound.propagate(head, o.char.bones.head ?? v3.add(o.char.pos, [0, 1.6, 0])); if (po.pathLen <= F.cueM * 1.5 && po.muffle < 0.75) warned.set(o, g.time + F.defWind + F.defFuse + 1);
  }
  return null;
}
/** GUNHAND.throwFree, for the drawer (combat.ts guardKit): the grenade of a throw under way is still in his fist — swung, not yet let go */
export function fragInFist(g: Game, gd: Guard): boolean { return !!defBooks.get(g)?.carriers.find(C => C.gd === gd)?.wind?.swung; }
/** an arm round a corner: the hand half a pace from a man at `p` toward `to`, chest high (no arm goes through a wall: from where he stands, or not at all) */
export function armRound(g: Game, p: Vec3, to: Vec3): Vec3 {
  const dx = to[0] - p[0], dz = to[2] - p[2], d = Math.hypot(dx, dz) || 1, out = Math.min(0.7, d), from: Vec3 = [p[0] + dx / d * out, p[1] + 1.5, p[2] + dz / d * out];
  return g.col.solidBlocked([p[0], p[1] + 1.5, p[2]], from) ? [p[0], p[1] + 1.5, p[2]] : from;
}
/** the book and the carrier of a man who may start a throw this moment, wherever it is meant for: the switches, a grenade on him and none coming out, on his
 *  feet with his wits and his legs his own, the floor's gap between grenades run out */
function free(g: Game, gd: Guard): { B: DefBook; C: Carrier } | null {
  const F = FRAG; if (!F.on || !F.defenders || !g.aiEnabled || !fightLive(g) || g.director?.theirFragsOff) return null;
  const B = defBooks.get(g), C = B?.carriers.find(x => x.gd === gd); if (!B || !C || !C.frags || C.wind) return null;
  if (gd.state === 'dead' || gd.held || runnerOwns(gd) || g.time < gd.staggerUntil || g.time < gd.dazzledUntil || fragFlee(g, gd) || g.time - B.lastT < F.defGap) return null;
  return { B, C };
}
/** may he start a throw at the place `at` this moment — everything `fragThrowAt` asks but the arc and his own side (so nobody is walked anywhere to find an
 *  arc for a grenade the floor's clock, a hostage or his own state would refuse anyway) */
export function fragReady(g: Game, gd: Guard, at: Vec3): boolean { return !!free(g, gd) && !hostageNear(g, at); }
/** A THROW ANOTHER RULE ASKS FOR (lanes.ts LANES.frag: a carrier held short of a covered lane, at the guns that hold it). The same grenade as his own throw
 *  above — the reach, the floor's gap between grenades, no hostage by it, none of his own in it, the scatter, the shout, the second it takes him, the cue,
 *  and at the release the same last look (a mate come into its reach, the arc lost: it stays in his hand). Only WHERE is the caller's: `at`, a place on the
 *  floor the other side's fire came from; `stand`, where his feet will be when it leaves his hand (where he is, or a stride on — he walks it in the second
 *  the grenade takes to come out); `toward`, the point his arm goes round his corner toward. 'thrown' = he has shouted and is getting it out · 'arc' = no
 *  arc from that place (or out of reach) · 'own' = one of his own in what it would reach · 'busy' = not this moment (`fragReady`). Nothing changed unless
 *  'thrown'; nothing calls this with that rule off.
 *  FOR A SECOND CALLER (the frag owner's review, 10-13): (1) `at` must be a place the other side STANDS, as the lane's guns are — all 17 spots round it are
 *  asked, where his own throw gives a heard-only fix just the two beyond it (a heard fix is the doorway on his own side: grenades burst on the thrower's side
 *  of the door before that rule). Never pass a point a sound arrived at. (2) `free` does not keep the 2 s a carrier waits after 'no — holding it!'
 *  (`tryAt`): the caller spaces its own asks, as lanes.ts does (`fragAt`, `fragNo`), or he shouts, holds and shouts again. (3) The two spots beyond `at` in
 *  the 1 s cache lie on the line from where he stood when it was filled, not from `stand` — inside the 1.5 m the cache allows. */
export function fragThrowAt(g: Game, gd: Guard, at: Vec3, stand: Vec3, toward: Vec3): 'thrown' | 'arc' | 'own' | 'busy' {
  const F = FRAG, X = free(g, gd); if (!X || hostageNear(g, at)) return 'busy';
  const c = gd.char, d = flat(stand, at); if (d < F.defNear || d > F.defFar) return 'arc';
  let S = X.C.spots; if (!S || g.time - S.t > 1 || flat(S.at, at) > 0.1 || flat(S.from, c.pos) > 1.5) S = X.C.spots = { at: v3.copy(at), from: v3.copy(c.pos), t: g.time, list: aimSpots(g, gd, null, at, 17) };
  const hand = armRound(g, stand, toward), aim = S.list.find(p => lands(g.items.solve(hand, p, 11), p, 1.0)); if (!aim) return 'arc';
  return windUp(g, X.B, X.C, c.bones.head ?? v3.add(c.pos, [0, 1.6, 0]), hand, aim, toward) ?? 'thrown';
}
/** he has shouted and the grenade is not yet out of his hand */
export function fragWinding(g: Game, gd: Guard): boolean { return FRAG.on && FRAG.defenders && !!defBooks.get(g)?.carriers.some(x => x.gd === gd && x.wind); }
/** how many grenades have left his hand */
export function fragAway(g: Game, gd: Guard): number { return defBooks.get(g)?.carriers.find(x => x.gd === gd)?.away ?? 0; }
/** the arc comes DOWN ON THE FLOOR within `tol` of where he means it. The solver's `land` is the arc's first impact, and a first impact up a wall or on a shut
 *  leaf is not a landing: it comes back at him (a defender used to count the leaf of a shut door, a metre short of the room behind it, as close enough —
 *  and fragged his own side of the door). */
const lands = (sol: { land: Vec3 } | null, p: Vec3, tol: number) => !!sol && sol.land[1] <= FRAG.lift + 0.1 && flat(sol.land, p) <= tol;
const hostageNear = (g: Game, p: Vec3) => !!g.rescue?.hostages.some(h => h.state !== 'dead' && flat(h.char.pos, p) < FRAG.woundM + FRAG.defScatter[1]);
/** nobody of the thrower's own side (himself included) within FRAG.defOwnM of where it would land with a line to it, and he himself not within reach of his own arm's error */
export function ownClear(g: Game, gd: Guard, land: Vec3, release = false): boolean {
  const from: Vec3 = [land[0], land[1] + FRAG.lift, land[2]];
  for (const o of g.guards) {
    if (o.team !== gd.team) continue;
    if (o.state === 'dead') { if (FRAG.downKill && downAsked(o)) { const B = lying(o); if (flat(B[0], land) <= FRAG.defOwnM && lyingShows(g, from, B, 'wary') > 0) return false; } continue; }   // (a mate down and breathing is still one of his: the burst would kill him where he lies)
    const od = flat(o.char.pos, land); if (od > FRAG.defOwnM) continue;
    if (o === gd && release) { if (od < FRAG.defNear - 1.5) return false; continue; }   // (as it leaves his hand: he has shouted it and his legs are his own — only never at his own feet)
    if ((o === gd && od < FRAG.defNear - 0.5) || exposedTo(g, from, o.char.pos, o.char.bones.head ?? v3.add(o.char.pos, [0, 1.6, 0])) > 0) return false;   // (a wall between it and him is enough — round the jamb of his own door — but never at his own feet)
  }
  return true;
}
