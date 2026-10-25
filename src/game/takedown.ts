// CLOSE-UP TAKEDOWNS THAT MOVE LIKE THE REFERENCE — the knockout, the knife, the hold's end and the partner's takedown posed against Chaos Theory's own moves (the
// maintainer's three clips, cut into beats: rebuild/takedowns-like-chaos-theory/clips/moves.md), and a man out cold who breathes.
//
//   BLOW     the attacker's own move over the build's strike: every one opens with a RISE out of the crouch and is delivered by the trunk with the arm as the
//            last link, the free arm with a job of its own.
//              chop   (knockout from behind — the clips' elbow to the base of the skull): free hand measuring on his back, the fist cocked high behind the ear,
//                     chopped down onto his neck with the trunk folding after it;
//              palm   (knockout from a side or the front): up from under his chest, the heel of the open hand under his chin, the arm locked out, the free arm
//                     thrown straight back;
//              mouth  (the knife from behind): the free hand clamps over his mouth and hauls his head back onto the shoulder while the knife hand works;
//              slash  (the knife from the front): the fist loaded at the far hip, whipped up and across the throat (character.ts KNIFE_SLASH), the free arm back.
//   VICTIM   the man it is done to: arched back onto the knife man's shoulder; under the PARTNER's hands — whose blow lands a beat before the game counts him
//            out — the head snaps, the shoulders hunch and the knees start to go while he is still on his feet.
//   FALL     how he goes down, by the blow (character.ts FallStyle, read once by ragdollize): FOLD forward, knees then face (hit from behind, the whip);
//            TOPPLE stiff, backward, feet planted (the palm); CUT — stands a beat, then knees, sits, rolls (the throat); SINK — goes down where he stood, on
//            his side (the knife from behind, the choke's end). The quiet takedown used to be one fall: a plank pitched over at 3 rad/s.
//   PARTNER  the partner's takedown is the chop from behind / the palm from the front, on a clock inside the takedown's own 0.6 s, with the victim's reaction.
//   BREATHE  a man out cold breathes: the chest of a sleeping body rises and falls — the PICTURE's joints only (character.ts breathFrame: the skeleton, never
//            the bones the game reads, the capsules or a checkpoint).
//
// One switch, TAKEDOWN.on — the page: on (`?notakedown` = every takedown as it was); the frozen harness stand: off (`TPS_TAKEDOWN=1` on) — and a half for each
// of the five. Nothing here changes a key, a reach, a clock or who goes down when: the blow lands on the frame it always did, the man is out on the frame he
// always was. What DOES differ for the simulation with it on (so the frozen stand holds it off): poses feed the game — the attacker stands taller for the half
// second of the blow, the victim's head and trunk move in the beat before he drops — and a body falls another way, so it LIES somewhere else (where it is
// found, what it blocks). The dice are untouched: a fall draws the two numbers it always drew.
//
// State: none of its own. The animator's clocks are its own (as every layer's: not in a checkpoint — a load mid-blow finds the men as the game has them); a
// fall's guide lives on the falling Character and a save waits for a body still falling, as it always did.
import { SideSet } from '../math/side';
import type { Game, Guard } from './game';
import type { BlowStyle, Character, FallStyle } from './character';
import { HOLD, HOLD_SHOW } from './character';   // (HOLD_SHOW written inside takedownTick only, HOLD read inside takeFall only: the game's one import cycle)
import type { CloseKind } from './close';
import { Vec3, v3 } from '../math/vec';
import { canStand } from './player';   // (is there headroom over a crouched Sam: the rise out of the crouch is not taken under a duct)

export const TAKEDOWN = {
  /** THE switch — the page: on (`?notakedown` off); the frozen stand: off (`TPS_TAKEDOWN=1` on) */
  on: false,
  /** its halves, for A/B on the panel: the attacker's move · the victim's reaction on his feet · the fall by the blow · the partner's takedown · a man out cold breathes */
  blow: true, victim: true, fall: true, partner: true, breathe: true,
  kill: true,            // the KILL FROM THE HOLD is a move of its own (character.ts HOLD.kill): the free hand over his mouth, the blade drawn across his throat and out wide, the man let down forward — off, the hold's 'kill' phase is drawn as the hold and he falls as the knife from behind always dropped him (the pose and the fall only: he is dead when the kill's own clock says)
  chokeBeats: true,      // the choke's BEATS, off the clips (character.ts HOLD.beats): both his hands clamp onto the forearm a quarter second in, come off it and fall BEFORE he is lowered, and his head tips to the side before it comes forward — off, the choke as it was (poses only)
  haul: false,           // the choke HAULS him up and back (character.ts HOLD.haul): as the arm closes Sam leans back and lifts him off his feet onto his chest, the man arched back and kicking, and sets him down before he is lowered — off, the choke as it was. Its own switch: ON in the page (`?nohaul`), off here and on the frozen stand (`TPS_HAUL=1`, with TPS_TAKEDOWN=1)
  lower: true,           // the choke LOWERS him: as he goes limp Sam sinks with him and lays him toward the floor, where he used to hold him standing until he let go (the pose only: he is out when the choke's own clock says)
  /** the partner's blow: s after his hands start that it LANDS (the man is counted out at the takedown's own clock, as ever) · s the move lasts — never past the
   *  takedown's own 0.6 s (PARTNER_SECS): the game hands his arms back to his gun then */
  partnerHit: 0.3, partnerEnd: 0.58,
  /** breathing, out cold: breaths a second · m the chest rises · s it takes to come in once the body has settled */
  breathHz: 0.24, breathRise: 0.02, breathIn: 1.2,
};
/** the partner's takedown, start to man down (pairorders.ts PAIR.secs, spotted.ts takeSecs): his move is over inside it */
const PARTNER_SECS = 0.6;
/** Sam's own blow lands this long after it starts (player.ts updateTakedown's clock: read here, never written) */
const SAM_HIT = 0.28;
/** QA: how often each was asked for (probes read them; nothing else does) */
export const TAKEDOWN_STATS = { blows: 0, falls: 0, partner: 0, breathing: 0 };

type Half = 'blow' | 'victim' | 'fall' | 'partner' | 'breathe' | 'lower' | 'kill' | 'chokeBeats' | 'haul';
const live = (g: Game, half: Half) => TAKEDOWN.on && TAKEDOWN[half] && !g.touring;
export const takedownOn = live;
/** how much of the choke's lowering the hold's two poses show (player.ts holdTail feeds it to both animators): 0 = he is choked standing, as it was */
export const takeLower = (g: Game): number => live(g, 'lower') ? 1 : 0;
/** …and whether they show the kill from the hold as a move · the choke's beats (HoldPose / HeldPose .kill / .beats: this Game's, this frame — a pose without
 *  them falls back on HOLD_SHOW, which takedownTick writes once a frame for whoever ran last) */
export const takeKill = (g: Game): boolean => live(g, 'kill');
export const takeBeats = (g: Game): boolean => live(g, 'chokeBeats');
/** …and the choke's haul (HoldPose / HeldPose .haul) */
export const takeHaul = (g: Game): boolean => live(g, 'haul');

/** which move a blow is: by the side it comes from and the hand that does it (a man in a chair is taken from behind his chair: the rear moves) */
export function blowStyle(kind: CloseKind | undefined, lethal: boolean): BlowStyle {
  const rear = !kind || kind === 'behind' || kind === 'seat';
  return lethal ? (kind === 'front' ? 'slash' : rear ? 'mouth' : 'sweep') : rear ? 'chop' : 'palm';
}
/** …and how the man it lands on goes down */
export function fallStyle(style: BlowStyle): FallStyle {
  return style === 'chop' ? 'fold' : style === 'palm' ? 'topple' : style === 'mouth' ? 'sink' : 'cut';
}

const fwd = (c: Character): Vec3 => [Math.sin(c.bodyYaw), 0, Math.cos(c.bodyYaw)];
/** where on the man each move's hands go: [the blow's own point, the free hand's] — off his bones AS THEY STAND, in the world (asked again every frame until
 *  the blow lands: a man who turns his head or takes a step in the quarter second of the wind-up is hit where he is) */
function marks(by: Character, vic: Character, style: BlowStyle): [Vec3, Vec3 | null] {
  const b = vic.bones, f = fwd(vic), neck = b.neck ?? v3.add(vic.pos, [0, 1.5, 0]), head = b.head ?? v3.add(neck, [0, 0.12, 0]);
  const to = v3.normalize([by.pos[0] - vic.pos[0], 0, by.pos[2] - vic.pos[2] + 1e-6]);   // from him toward the attacker
  const left: Vec3 = [Math.cos(by.bodyYaw), 0, -Math.sin(by.bodyYaw)];                   // the attacker's own left
  if (style === 'chop') return [v3.add(v3.mad(neck, to, 0.07), [0, 0.05, 0]), v3.add(v3.mad(v3.mad(neck, to, 0.11), left, 0.13), [0, -0.2, 0])];   // the base of the skull · his left shoulder blade
  if (style === 'palm') return [v3.add(v3.mad(v3.mad(head, f, 0.07), to, 0.05), [0, -0.06, 0]), null];                                            // under the point of the chin (his own front), from the attacker's side
  if (style === 'mouth') return [v3.copy(neck), v3.add(v3.mad(v3.mad(head, f, 0.11), left, 0.02), [0, 0.0, 0])];                                  // (the knife's own keys) · over his mouth
  return [v3.add(neck, [0, 0.04, 0]), null];                                                                                                      // the throat
}
/** no headroom over him: a crouched Sam does not rise into the blow (everybody else stands) */
const mayRise = (g: Game, by: Character) => !(by === g.player.char && g.player.crouch && !canStand(g));

/** SAM'S BLOW BEGINS (player.ts startTakedown, right after the strike it asked for): his move by the side and the hand, and what the man does before it lands */
export function takeBegin(g: Game, by: Character, gd: Guard, kind: CloseKind | undefined, lethal: boolean) {
  if (!live(g, 'blow')) return;
  const style = blowStyle(kind, lethal), vic = gd.char, [at, at2] = marks(by, vic, style);
  by.anim.blow(style, at, at2, { live: () => marks(by, vic, style), rise: mayRise(g, by), tail: true }); TAKEDOWN_STATS.blows++;
  if (!live(g, 'victim')) return;
  if (style === 'mouth') vic.anim.taken('arch', 0.12);
  else if (style === 'chop') vic.anim.taken('hunch', SAM_HIT - 0.045);   // (the blow's last frames: the chin is on its way to his chest as he is put out — the body that falls starts from it)
  else if (style === 'palm') vic.anim.taken('snap', SAM_HIT - 0.04);
}
/** how far a fall wants clear floor, by its style and which way: [direction, m] */
function fallWay(vic: Character, from: Vec3 | null, style: FallStyle): [Vec3, number] {
  const f = fwd(vic), p = vic.pos;
  const away: Vec3 = from && Math.hypot(p[0] - from[0], p[2] - from[2]) > 0.05 ? v3.normalize([p[0] - from[0], 0, p[2] - from[2]]) : f;
  return style === 'topple' ? [away, 1.5] : style === 'cut' ? [away, 0.9] : [f, 0.7];
}
/** HOLD.layAhead's room (setFall): m from where a laid man's hips are led to past the top of his head, with a hand's width over, and half the width of
 *  floor he is laid on */
export const LAY_REACH = 0.95, LAY_HALF = 0.3;
/** a fall is asked for: its style, where the man who did it stands, and whether the level has room for it — a wall or a desk where the body would be led
 *  (asked at knee and at chest height) keeps the fall to where he stands, and the plank that has no floor behind it is let down instead */
function setFall(g: Game, vic: Character, style: FallStyle, by: Character | null, ahead = 0) {
  const from = by ? v3.copy(by.pos) : null, [d, m] = fallWay(vic, from, style), p = vic.pos;
  const shut = (y: number, len = m) => g.col.solidBlocked([p[0], y, p[2]], [p[0] + d[0] * len, y, p[2] + d[2] * len]);
  const tight = style !== 'slump' && (shut(0.45) || shut(1.1));
  vic.fallAs = tight && style === 'topple' ? 'sink' : style; vic.fallFrom = from; vic.fallTight = tight; TAKEDOWN_STATS.falls++;
  // (HOLD.layAhead: laid down further along his facing, where the level has floor for the whole of him there — a strip as wide as his shoulders, as long
  // as the lay and LAY_REACH past it, with no static in it anywhere from his shins to his head (the volume, not a line or nine: a table's top, a low
  // table and a post a hand off his middle each went between lines, and he was slid into them at 13 m/s) and nothing else solid along its middle (a
  // door's leaf, a chair); half the lay where only that much is clear)
  const touch = new Int32Array(4);
  const fits = (a: number) => {
    const len = a + LAY_REACH; if (shut(0.15, len) || shut(0.45, len) || shut(1.1, len)) return false;
    for (let s = LAY_HALF; ; s += 0.2) { const t = Math.min(s, len - LAY_HALF); if (g.col.circleTouches(p[0] + d[0] * t, p[2] + d[2] * t, LAY_HALF + 0.05, 0.1, 1.2, touch) !== 0) return false; if (t >= len - LAY_HALF) return true; }
  };
  vic.fallAhead = ahead > 0 && style === 'sink' && !tight ? (fits(ahead) ? ahead : fits(ahead / 2) ? ahead / 2 : 0) : 0;
}
/** …AND LANDS (the frame he is put down, before killGuard): how he falls. `how` = a move with no blow of its own: the choke's end, the pistol whip, the kill
 *  from the hold (he is already going forward off his knees: the fold carries on from it; its half off = `how` not given). A man taken in his chair slumps
 *  where he sits. */
export function takeFall(g: Game, gd: Guard, kind: CloseKind | undefined, lethal: boolean, how?: 'choke' | 'whip' | 'kill') {
  if (!live(g, 'fall')) return;
  const led = how === 'kill' && !live(g, 'kill') ? undefined : how;
  setFall(g, gd.char, led === 'choke' ? 'sink' : led === 'whip' || led === 'kill' ? 'fold' : kind === 'seat' ? 'slump' : fallStyle(blowStyle(kind, lethal)), g.player.char, led === 'choke' ? HOLD.layAhead : 0);
}

/** THE PARTNER'S HANDS GO ON (pairorders.ts / spotted.ts, right after his strike): the chop from behind, the palm from the front — landing `partnerHit` in,
 *  the man reacting on his feet from then until the game's own clock puts him out; the move is over when the takedown is */
export function partnerBegin(g: Game, mate: Guard, foe: Guard, front: boolean) {
  if (!live(g, 'partner')) return;
  const style: BlowStyle = front ? 'palm' : 'chop', by = mate.char, vic = foe.char, [at, at2] = marks(by, vic, style);
  by.anim.blow(style, at, at2, { hit: TAKEDOWN.partnerHit, end: Math.min(TAKEDOWN.partnerEnd, PARTNER_SECS), live: () => marks(by, vic, style) }); TAKEDOWN_STATS.partner++;
  if (live(g, 'victim')) vic.anim.taken(front ? 'snap' : 'hunch', TAKEDOWN.partnerHit);
}
/** …are CALLED OFF before the man is out (he stepped out of them, the line shut): the move and what it was doing to him are let go of, eased */
export function partnerCancel(g: Game, mate: Guard, foe: Guard) {
  if (!TAKEDOWN.on) return;
  mate.char.anim.blowCancel(); foe.char.anim.takenCancel();
}
/** …and the man goes down by it (before their killGuard) */
export function partnerFall(g: Game, foe: Guard, front: boolean, mate?: Guard) {
  if (!live(g, 'partner') || !live(g, 'fall')) return;
  setFall(g, foe.char, front ? 'topple' : 'fold', mate ? mate.char : null);
}

/** games with a body that breathes (so that the switch thrown off lets every one of them go, once, and then costs nothing) */
const BREATHING = new SideSet<Game>('takedown.BREATHING');
/** once a frame (game.ts): who breathes — every man and civilian out cold; nobody with the switch off or under a show (a body's breath stops where it is) */
export function takedownTick(g: Game) {
  HOLD_SHOW.kill = live(g, 'kill'); HOLD_SHOW.beats = live(g, 'chokeBeats');   // (the fallback for a pose that does not say: the hold's layers have no Game to ask)
  const on = live(g, 'breathe');
  if (!on && !BREATHING.has(g)) return;
  let n = 0;
  const each = (gd: Guard) => {
    const c = gd.char;
    if (on && c.ragdoll && gd.state === 'dead' && (gd.downKind === 'struck' || gd.downKind === 'choked')) { c.breathe = TAKEDOWN; n++; } else if (c.breathe) c.breathe = null;
  };
  for (const gd of g.guards) each(gd);
  for (const gd of g.civilians) each(gd);
  if (n) BREATHING.add(g); else BREATHING.delete(g);
  TAKEDOWN_STATS.breathing = n;
}
