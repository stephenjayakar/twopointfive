// THROWN THINGS BOG DOWN IN LYING SNOW (the maintainer, 10-15, from his play of the pass: "grenades shouldn't roll around as much in the snow"). THIS ONE IS
// PLAY, not picture: where a grenade, a can, a dropped magazine or a rifle let go comes down on lying snow it keeps little of its bounce and little of its
// slide, and stops where a thing on a hard floor would still be skidding. So it is the game's own switch (SNOWBOG.on: ON in the page, `?snowbog=0` off; OFF
// in the module and on the frozen stand, TPS_SNOWBOG=1 — every frozen digest of a throw on a snow level was recorded on the bounce as it was), a recording
// carries it, and nothing here reads the picture (render/snowField.ts is the PICTURE's bake and may be off): where snow lies is asked of the level's own data.
//
// WHERE SNOW LIES, for the game: on a snow level (weatherKinds.ts snowLevel), under the open sky (weather.ts underRoof — the level's roofs), at the ground (a
// landing on a desk or a roof is as it was), and not where the level's floor says otherwise: a thin lay of trodden snow (the road) bogs by `packed`, of old
// snow by `old`, and any other thin lay (swept earth, a doormat) is bare ground — the same reading the picture's bake makes of the same boxes.
import type { Game } from './game';
import type { Box } from '../scene/boxes';
import { BoxFlag } from '../scene/boxes';
import { snowLevel } from './weatherKinds';
import { levelNameOf } from '../scene/levelLoad';
import { snowLayBare, snowPaintOf, snowThinLay } from '../render/snowField';

export const SNOWBOG = {
  on: false,
  dead: 0.85,         // of its bounce a thing loses in deep snow (0 = the bounce as on a floor, 1 = none at all)
  grip: 0.8,          // of the slide it would have kept, lost (on top of the item's own friction)
  stick: 1.1,         // m/s: it stops dead where it lands moving slower than its floor speed + this (a floor's: 0.35)
  packed: 0.4,        // × all three on trodden snow (the road)
  old: 0.7,           // … on old snow
  top: 0.06,          // m: a landing higher than this is not on the GROUND (the ground's collision is flat at 0 under the drawn hills; a thin lay tops out at 3 cm): a kerb,
                      //    a pallet, a desk, a sill — and bogs only if snow stands or lies that high under it: a bank, the cap on a roof (was 0.45: a low kerb bogged as deep snow)
  bankM: 0.15,        // m: … snow whose top is within this of the landing is what it landed in
  run: 2,             // the squad's forecast of a throw (squadsmoke.ts squadArcTo): the run-on past the landing is a floor's × (1 − bog) to this power
};

/** the run-on a thing keeps past its landing where the ground bogs by `bog`, of a hard floor's (squadsmoke.ts: the solver's closed-form rest) */
export const bogRun = (bog: number) => bog > 0 ? Math.pow(Math.max(0, 1 - bog), SNOWBOG.run) : 1;

interface Lay { b: Box; k: number; }
interface Ground { lays: Lay[]; banks: Box[]; }
const groundOf = new WeakMap<object, Ground>();
function ground(g: Game): Ground {
  const lvl = g.level as unknown as { boxes: Box[] }; let G = groundOf.get(lvl);
  if (!G) {
    G = { lays: [], banks: [] };
    for (const b of lvl.boxes) {
      const p = snowPaintOf(b);
      // (the thin lays: the picture's own rule, render/snowField.ts snowThinLay — trodden, old, or ground somebody cleared; a lit thing lying on the snow is neither)
      if (snowThinLay(b)) { if (p === 'snowPacked' || p === 'snowOld' || snowLayBare(b)) G.lays.push({ b, k: p === 'snowPacked' ? -1 : p === 'snowOld' ? -2 : 0 }); }
      // (the banks: snow that STANDS — a drift, a ploughed heap, a tier of the deep snow — is snow to land in at its own top)
      // — and so is the cap of snow the level lays on a roof, a crate, a truck's bed (a thin box nothing collides with: the thing lands on what is under it)
      else if (p === 'snow' && !(b.flags & BoxFlag.Glass) && b.c[1] + b.h[1] > 0.03) G.banks.push(b);
    }
    groundOf.set(lvl, G);
  }
  return G;
}
const over = (b: Box, x: number, z: number) => { const cs = Math.cos(b.yaw ?? 0), sn = Math.sin(b.yaw ?? 0), px = x - b.c[0], pz = z - b.c[2]; return Math.abs(cs * px - sn * pz) <= b.h[0] && Math.abs(sn * px + cs * pz) <= b.h[2]; };
/** how boggy the ground is where a thing touched down at (x, y, z), 0‥1 (0 = a floor: the bounce as it was). 0 with the switch off. */
export function snowBogAt(g: Game, x: number, y: number, z: number): number {
  const K = SNOWBOG; if (!K.on || !snowLevel(levelNameOf(g.level))) return 0;
  const G = ground(g);
  if (!(y < K.top)) { for (const b of G.banks) if (Math.abs(b.c[1] + b.h[1] - y) <= K.bankM && over(b, x, z)) return 1; return 0; }   // (up on something: only standing or capping snow bogs)
  if (g.weather.underRoof(x, z)) return 0;
  let k = 1;
  for (const { b, k: kind } of G.lays) {
    if (!over(b, x, z)) continue;
    const v = kind === -1 ? K.packed : kind === -2 ? K.old : 0; if (v < k) k = v;
  }
  return Math.max(0, Math.min(1, k));
}
