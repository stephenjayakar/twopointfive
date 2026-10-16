// STEALTH POSES, the game's half (stealthpose.ts has what they are): what the GAME knows of Sam's hands, told to his animator once a frame.
import type { Game } from './game';
import { kitInHand } from './kitanim';
import { samWork } from './handwork';
import { STEALTHPOSE } from './stealthpose';

/** One frame's word to Sam's animator (player.ts updatePlayer, before any state poses him). Off, under a show or a puppet, or down: nothing fed. */
export function stealthFeed(g: Game) {
  const pl = g.player, an = pl.char.anim;
  if (!STEALTHPOSE.on || g.touring || g.puppet || pl.down) { an.stealth = null; return; }
  const cable = !!pl.wanding && STEALTHPOSE.cable;
  const taken = !!(pl.holding || pl.takedown || pl.dragging || pl.haul || pl.kick || pl.picking || pl.coding || pl.wall || pl.easing || pl.doorMove || pl.breakerMove || pl.charging || pl.sprinting || samWork(g));
  const f = an.stealth ?? (an.stealth = { free: false, cable: false });
  f.cable = cable; f.free = (!taken && !pl.wanding && kitInHand(g) === null && pl.throwPreview === null && !pl.throwHeld);
}
