// A BLAST DOES TO THE PLAYER WHAT IT DOES TO ANYBODY (the maintainer, 10-10: "frags should be able to hurt or stun the player!" · "can you check that it
// effects the player the same way it affects everyone else? including stun").
//
// What a man of either side gets from a blast that leaves him up is two states on his Guard record: STAGGERED (Guard.staggerUntil — a frag's fragments, a ring
// in the body, a charge's knock: rooted, gun down, no round) and DAZZLED (Guard.dazzledUntil — a stun canister with a line to the fireball: no sight, no round,
// rooted). The player had neither: a frag that did not drop him was a flinch, and a stun canister rang his ears and nothing else. Now he has the same two
// stamps on his Player record, set by the SAME rules at the same sites (frag.ts blast, combat.ts detonateStun), and read here:
//   · staggered = feet rooted, the gun at the low ready, no round and no throw, the support hand on his ribs, for the seconds a man there is folded;
//   · dazzled   = the picture goes white (ui/overlay.ts #blind) for the seconds a man there is blind, the reticle takes nobody, his aim is thrown wide. His feet
//     and his trigger stay his: a blinded AI man stands still because he cannot see to walk — the player simply cannot see (SAMSTUN.blindRoots = rooted too).
// In a room fight a stun canister he has a LINE to does to him what it does to a defender standing there, whoever threw it (SAMSTUN.ownSeen: "it should
// totally be possible to flash yourself with a bad entry" — a teammate is spared his own side's can because the drill turns his head; nobody turns the
// player's); with no line his own side's can is the own-side rule (only inside FLASH.ownM, FLASH.ownSecs, no stagger) and a defender's the concussion's half.
// In the night game anybody's can with a line to his eyes inside the dazzle radius blinds him as it does a guard.
// God mode changes none of it (a stun is not a hit). Never under a show or with the puppet's strings on him.
//
// `on`: ON in the page (src/host/profile.ts pageSwitches; ?nosamstun = the player as he was), OFF in the module and on the harness's frozen stand
// (TPS_SAMSTUN=1): with it off the stamps are still written by a frag (FRAG.samStun) and read by nothing. The two stamps ride a checkpoint (savestate.ts).
import type { Game } from './game';
import { Vec3, v3, clamp } from '../math/vec';
import { cancelSustained } from './interact';

export const SAMSTUN = { on: false,
  /** a dazzled player is also rooted for it, as a blinded AI man is */
  blindRoots: false,
  /** seconds the white takes to clear at the end of a dazzle */
  fade: 0.6,
  /** in a room fight, a stun canister of HIS OWN SIDE that he has a line to (his own throw, a teammate's bang watched through the doorway) blinds and folds him
   *  by the full count, as it does a defender standing there; false = the own-side rule his teammates get (only inside FLASH.ownM, FLASH.ownSecs, no fold) */
  ownSeen: true,
};
/** QA: staggers and dazzles given to the player since the last reset */
export const SAMSTUN_STATS = { staggered: 0, dazzled: 0 };

const live = (g: Game) => SAMSTUN.on && !g.player.down && !g.puppet && !g.touring;

/** Fold the player for `secs` (the stamp is written whatever the switch says; what a stagger DOES to him is read below). `dir` = the way the blow came from → him. */
export function staggerPlayer(g: Game, secs: number, dir: Vec3): void {
  const pl = g.player; if (!(secs > 0) || pl.down) return;
  pl.staggerUntil = Math.max(pl.staggerUntil, g.time + secs);
  pl.char.anim.hitFrom(dir); pl.hitFlash = 1; pl.fireCd = Math.max(pl.fireCd, secs); pl.sup.v = Math.max(pl.sup.v, 1); pl.sup.kick = Math.max(pl.sup.kick, 1);
  foldCancels(g);
  SAMSTUN_STATS.staggered++;
}
/** what a fold takes out of his hands (also frag.ts, before its own stamp, while the switch is on): a can being wound up goes back on the belt — it never left
 *  his hand —, a quick throw being lined up is dropped, and every sustained verb (a lock, a keypad, an eased door, a choke, the rack, a charge being set) stops */
export function foldCancels(g: Game): void {
  const pl = g.player;
  if (pl.pendingThrow) { const k = pl.pendingThrow.kind; if (k === 'frag') pl.frags++; else if (k === 'flash') pl.flashbangs++; else pl.canisters++; pl.pendingThrow = null; }
  pl.throwHeld = false; if (pl.picking || pl.wanding) pl.fHeld = true;
  for (let i = 0; i < 6 && cancelSustained(g); i++) { /* one verb a call */ }
}
/** Blind the player for `secs` by a flash at `at`. */
export function dazzlePlayer(g: Game, secs: number, at: Vec3): void {
  const pl = g.player; if (!(secs > 0) || pl.down) return;
  pl.dazzledUntil = Math.max(pl.dazzledUntil, g.time + secs); pl.dazzledAt = v3.copy(at);
  pl.char.anim.hitFrom(v3.sub(pl.char.pos, at)); pl.sup.v = Math.max(pl.sup.v, 1);
  SAMSTUN_STATS.dazzled++;
}

/** is he folded right now (rooted, gun down, no round)? */
export function samStaggered(g: Game): boolean { return live(g) && g.time < g.player.staggerUntil; }
/** how blind he is right now: 1 for the body of a dazzle, easing to 0 over its last `fade` seconds */
export function samBlind(g: Game): number { if (!live(g)) return 0; const left = g.player.dazzledUntil - g.time; return left <= 0 ? 0 : clamp(left / Math.max(0.05, SAMSTUN.fade), 0, 1); }
/** may his feet move? (player.ts asks before it reads the walk keys) */
export function samRooted(g: Game): boolean { return samStaggered(g) || (SAMSTUN.blindRoots && samBlind(g) > 0.5); }

/** player.ts, once a frame right after the down test, whatever state he is in (free, a man in his arm, a kick, a lock): what the two states show on him and keep true while they run */
export function samStunPose(g: Game): void {
  const pl = g.player, an = pl.char.anim;
  if (!SAMSTUN.on) { if (pl.stunPosed) { an.clutch = 0; an.dazzle = null; pl.stunPosed = false; } return; }   // (thrown off mid-stun: what it put on him comes off; never on = nothing touched)
  const blind = samBlind(g), stag = samStaggered(g); pl.stunPosed = stag || blind > 0;
  an.clutch = stag && blind <= 0 ? 1 : 0;
  if (blind > 0) { const dz = an.dazzle ?? (an.dazzle = { from: pl.char.pos, k: 0 }); dz.from = pl.dazzledAt ?? pl.char.pos; dz.k = Math.min(1, (pl.dazzledUntil - g.time) / 0.5); pl.sup.v = Math.max(pl.sup.v, blind); }
  else if (an.dazzle) an.dazzle = null;
  if (stag) pl.fireCd = Math.max(pl.fireCd, pl.staggerUntil - g.time);
}
