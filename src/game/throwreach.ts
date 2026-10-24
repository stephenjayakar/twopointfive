// THE REACH OF WHAT HE IS ABOUT TO THROW (THROWBACK.reach; the overlay's: nothing in the game reads it). The maintainer, off a GPU shot of a grenade's arc
// with its small ring on the floor: "we should also have kill radius / stun radius when throwing grenades". The arc said where the can would go, never what
// it would do there — a frag takes four metres round it and hurts to eight, and that is his own team's as much as the room's.
//
// WHAT IS HANDED TO THE OVERLAY, read from the numbers the burst itself is judged by (never a copy):
//   a frag in the hand      `kill` FRAG.lethalM · `hurt` the edge frag.ts blast hurts to (FRAG.woundM, never inside the kill ring), round the point it
//                           comes to REST (frag.ts restOfThrow: where its fuse finds it), whatever the small ring's own switch says
//   a stun canister         `stun` the canister's dazzle radius (effects.ts bang.dazzleRadius: the edge every part of combat.ts FLASH falls off to)
//   the launcher's grenade  `kill` and `hurt` as the frag's (he40.ts bursts through frag.ts blast), round where the arc ends — none while the arc is too
//                           short to arm (he40.ts previewTooClose: it would be a dud)
//   smoke, a sponge round, a sticky camera: nothing.
// The rings are RADII, drawn flat on the floor under the point (overlay.ts drawReach: a round that ends up a wall has its rings on the floor below it): a
// wall, a shut door or a desk between is the burst's own business (frag.ts asks what of a man is exposed) and is not drawn. Read only.
//
// OFF in the module and on the frozen stand; ON in the page (`?noreach`). A recording from before the key replays with them off (journal.ts applyKnobs).
import type { Vec3 } from '../math/vec';
import type { Game } from './game';
import * as fx from './effects';
import { FRAG, restOfThrow } from './frag';
import { previewTooClose } from './he40';
import { THROWBACK } from './throwback';

export interface ThrowReach { at: Vec3; kind: 'frag' | 'flash' | 'he40'; kill: number; hurt: number; stun: number }
const BREAK = ((): boolean => { try { return String((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.THROWREACH_BREAK ?? '') === '1'; } catch { return false; } })();
const burst = (at: Vec3, kind: 'frag' | 'he40'): ThrowReach => ({ at, kind, kill: FRAG.lethalM, hurt: Math.max(FRAG.lethalM, FRAG.woundM), stun: 0 });

/** what the thing he is aiming would reach, and round where (null: the rings off, no arc up, or a thing with no burst). `rest` = the rest point the caller
 *  already holds for this arc (player.ts throwRest), so it is not reckoned twice; without one it is reckoned here. Some tenths of a millisecond then: the
 *  overlay asks when the arc has changed, not every frame */
export function throwReach(g: Game, rest?: { at: Vec3 } | null): ThrowReach | null {
  const pl = g.player, sol = pl.throwPreview; if (!THROWBACK.reach || BREAK || !sol || !sol.points.length) return null;
  if (pl.throwHeld || (!pl.holstered && pl.canisterSel)) {   // a can in the fist (the rule player.ts throwRest asks by)
    const kind = pl.heldKind; if (kind !== 'flash' && !(kind === 'frag' && FRAG.on)) return null;
    const at = (rest ?? restOfThrow(g, kind, sol.points[0], sol.v0)).at;
    return kind === 'frag' ? burst(at, 'frag') : { at, kind, kill: 0, hurt: 0, stun: fx.bang.dazzleRadius };
  }
  if (pl.rifleUp && pl.rifle.attachment === 'he40' && pl.rifle.shells > 0 && !previewTooClose(g)) return burst(sol.land, 'he40');
  return null;
}
