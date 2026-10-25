// THE CHARACTER LAB — a place to look at one man up close while his look is worked on (the maintainer, 10-25: "men up close look pretty good, but not perfect.
// IMO we should just iterate on the characters in a character lab or the workbench"). Opened from the look prototype's panel (ui/lookpanel.ts) on a running page:
//   the camera comes down to a man's height and stays on YOU, at an angle, a height and a distance the panel sets (or turning slowly round you). Where a
//   wall stands between it and you it comes in to your side of the wall, and where that leaves it too near to see you it looks from the nearest clear side ·
//   you wear any outfit of the cast (game/cast.ts castWear: an operator's, a defender's, a responder's, a civilian's), one after another ·
//   you walk him into the light you want to judge him in (the sun, a shed's shade, a lamp, the fire), and nobody notices or hurts you while it is open.
// The mannequin is the player's own man, so nothing is staged and it works on every level and at every hour. Leaving puts his own outfit and the free camera
// back, and puts down the two sandbox flags it raised. He is painted as the SIDE of the outfit he wears (game/charLook.ts charSides), except where the mission
// has him in the sneaking suit (a quiet mission, the plain night): there every outfit is the suit. Looks only: a variant is nothing the simulation reads.
// Nothing here is made or run until the lab is opened.
import type { Game } from '../game/game';
import type { FollowCamera } from '../game/camera';
import { castVariantOf, castWear } from '../game/cast';

/** the lab as the panel has it: angles in degrees (yaw 0 looks toward −z), dist and height in metres */
export const CHARLAB = { on: false, yaw: 150, pitch: 12, dist: 3.8, height: 0.95, turn: false };   // (the camera's lens is a long one, 28°: a man is whole in the picture from about 3.6 m)
const TURN = 24;   // degrees a second, turning slowly
const KEEP = 0.75;   // of the distance asked: where a wall brings the eye nearer than this, another side is looked for (close in, a long lens shows a belt, not a man)
const ROOM = 0.25;   // metres the eye keeps off the wall it was brought in from (the near plane's corners reach that far to the sides)
const was = { outfit: '', unseen: false, safe: false, quiet: false, t: 0, d: 0 };   // (d: the distance the eye stood at last frame, 0 = none yet)   // (unseen / safe: the lab raised that flag itself, and so puts it down on Leave)
const DEG = Math.PI / 180;

/** the outfits the cast has, by name (none with no cast loaded: the mannequin page) */
export const charLabOutfits = (game: Game): string[] => game.player.char.ch.cast?.variants.map(v => v.name) ?? [];
/** the outfit you wear now */
export const charLabWorn = (game: Game): string => castVariantOf(game, game.player.char)?.name ?? '';

export function charLabOpen(game: Game): void {
  if (CHARLAB.on) return;
  was.outfit = charLabWorn(game); was.t = performance.now(); was.d = 0;
  // a flag somebody else already holds up (god mode from the sandbox row, a show's hidden player) is theirs: the lab raises only what was down, once, and puts
  // down only what it raised. Never written per frame: a mission started or a show ended under the open lab keeps its own say
  was.unseen = !game.playerInvisible; was.safe = !game.godMode; game.playerInvisible = true; game.godMode = true;
  // … and the run is nobody's while it is open (quietUtility, as a show has it): no checkpoint is written with the lab's flags in it (savestate.ts runNo),
  // so a file loaded later cannot bring back a player nobody sees
  was.quiet = !game.quietUtility; game.quietUtility = true;
  CHARLAB.on = true;
}
export function charLabLeave(game: Game, cam: FollowCamera): void {
  if (!CHARLAB.on) return;
  CHARLAB.on = false; CHARLAB.turn = false;
  if (was.outfit) castWear(game.player.char, was.outfit);
  if (was.unseen) game.playerInvisible = false;
  if (was.safe) game.godMode = false;
  if (was.quiet) game.quietUtility = false;
  cam.setPin(null);
}
/** wear an outfit by name, or the one `step` places on from the one worn (±1: the panel's two arrows). Returns the name worn after it */
export function charLabWear(game: Game, pick: string | number): string {
  const names = charLabOutfits(game); if (!CHARLAB.on || !names.length) return charLabWorn(game);
  const name = typeof pick === 'string' ? pick : names[(names.indexOf(charLabWorn(game)) + pick + names.length) % names.length];
  castWear(game.player.char, name);
  return charLabWorn(game);
}
/** ONCE A PAGE FRAME, before the game's update: the camera on you (a return on its first line with the lab shut) */
export function charLabFrame(game: Game, cam: FollowCamera): void {
  if (!CHARLAB.on) return;
  const now = performance.now(), dt = Math.min(0.1, Math.max(0, (now - was.t) / 1000)); was.t = now;   // (the page's own clock: the camera's turn is no part of the game)
  if (CHARLAB.turn) CHARLAB.yaw = (CHARLAB.yaw + TURN * dt) % 360;
  const p = game.player.char.pos, look: [number, number, number] = [p[0], p[1] + CHARLAB.height, p[2]], yaw = CHARLAB.yaw * DEG, pitch = CHARLAB.pitch * DEG;
  // THE EYE STAYS ON YOUR SIDE OF A WALL: a camera at a man's height has no roof to look down through, and three metres behind you is often the next room
  // (camera.ts rebuild: the eye is `dist` back from the look point along the view). `clear(a)` = how far back the eye can stand looking from angle a, up to
  // the distance asked. Too near on the angle asked → the roomiest of the twelve angles a twelfth of a turn apart, a nearer one preferred.
  // Coming in is at once (a frame behind a wall is a frame of wall); going back out is eased, so a post passed in a slow turn does not make the picture jump.
  const cp = Math.cos(pitch), sp = Math.sin(pitch), want = CHARLAB.dist, enough = KEEP * want;
  const eye = (a: number, d: number): [number, number, number] => [look[0] + Math.sin(a) * cp * d, look[1] + sp * d, look[2] + Math.cos(a) * cp * d];
  // (three rays: to the eye and to a point ROOM to either side of it, so a wall the view runs along is kept off the picture's edge as well)
  const blocked = (a: number, d: number): boolean => { const e = eye(a, d), sx = Math.cos(a) * ROOM, sz = -Math.sin(a) * ROOM; return game.col.segmentBlocked(look, e) || game.col.segmentBlocked(look, [e[0] + sx, e[1], e[2] + sz]) || game.col.segmentBlocked(look, [e[0] - sx, e[1], e[2] - sz]); };
  const clear = (a: number): number => {
    if (!blocked(a, want)) return want;
    let lo = 0, hi = want; for (let i = 0; i < 7; i++) { const m = (lo + hi) / 2; if (blocked(a, m)) hi = m; else lo = m; }
    return Math.max(0, lo - ROOM);
  };
  let at = yaw, dist = clear(yaw);
  if (dist < enough) { let best = dist; for (let k = 1; k <= 6; k++) for (const side of [1, -1]) { const a = yaw + side * k * (Math.PI / 6), d = clear(a), score = d - 0.1 * k; if (score > best) { best = score; at = a; dist = d; } } }   // (the roomiest side, a nearer angle preferred by 10 cm a step: the first angle with room would stop a metre off in a shed)
  dist = Math.max(0.3, dist);   // (a cupboard: nearer than the near plane shows nothing at all)
  if (was.d > 0 && dist > was.d) dist = was.d + (dist - was.d) * Math.min(1, dt * 5);
  was.d = dist;
  cam.setPin({ look, yaw: at, pitch, dist });
}
