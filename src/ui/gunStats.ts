// WHAT A GUN IS GOOD AT, DRAWN (game/kittree.ts KITTREE). The maintainer, on Team & kit (10-19): "have some way of distinguishing different guns (some
// stats?)". Four bars on a gun's tile, each a number from 0 to 1 READ OFF THE GUN'S OWN ROW of weapons.ts — nothing is typed in here, so a gun retuned there
// moves its bars with it, and a suppressor taken off (the row the card then deploys: kit.ts kitSlotDef) moves the last one:
//   reach     how far it holds a man-sized group: the range at which the row's spread (aiSpread: a teammate's hands, and the shape of yours) is half a
//             man wide — a shotgun's, the range at which its whole pattern is still on him
//   volume    the rounds it puts out in ten seconds from full, magazine changes and all (its cadence, its magazine, its reload)
//   handling  how readily it comes round in the hands (weapons.ts handlingOf: the turn weight)
//   quiet     how little of its report the floor hears (the row's report level; a suppressor's share where the round is still heard as gunfire)
// The bars are the card's own (ui/kitCard.ts: the look of the mobility and concealment bars — a notch at the issue gun's, what this gun has over it in
// green, under it in amber); what a gun weighs is already those two bars.
import { handlingOf, type WeaponDef } from '../game/weapons';

export type GunStat = 'reach' | 'volume' | 'handling' | 'quiet';
export const GUN_STATS: { id: GunStat; label: string; tip: string }[] = [
  { id: 'reach', label: 'Reach', tip: 'reach is how far it can keep its shots on an enemy' },
  { id: 'volume', label: 'Volume', tip: 'volume is how many rounds it fires in ten seconds, reloads included' },
  { id: 'handling', label: 'Handling', tip: 'handling is how quickly you can swing it around' },
  { id: 'quiet', label: 'Quiet', tip: 'quiet is how little the floor hears of it' },
];
/** the scales: metres of reach and rounds in the window that fill a bar, the window's seconds, half a man's width, the handling that is an empty bar */
const SCALE = { reachM: 20, rounds: 100, secs: 10, half: 0.25, handling0: 0.4, can: 0.2, quiet: 0.8 };
const unit = (x: number) => Math.min(1, Math.max(0, x));

/** the range (m) at which the row's cone is half a man wide: r · spread(r) / 2 = half, spread opening past `rangeFrom` */
function reachM(def: WeaponDef): number {
  const A = def.aiSpread, flat = 2 * SCALE.half / A.base;
  let r = flat;
  if (flat > A.rangeFrom && A.rangeK > 0) { const b = A.base - A.rangeFrom * A.rangeK; r = (-b + Math.sqrt(b * b + 8 * SCALE.half * A.rangeK)) / (2 * A.rangeK); }   // (rangeK·r² + b·r − 2·half = 0)
  return def.pellets ? Math.min(r, SCALE.half / def.pellets.cone) : r;
}
/** rounds out in `secs` from a full gun: fired at its cadence until the magazine is empty, the reload, and again */
function rounds(def: WeaponDef): number {
  const gap = def.auto?.interval ?? def.cd, mag = def.magCapacity, emptyIn = mag * gap;
  let t = 0, n = 0;
  while (t < SCALE.secs) { const left = SCALE.secs - t; if (left <= emptyIn) { n += Math.floor(left / gap); break; } n += mag; t += emptyIn + def.reload.dur; }
  return n;
}
export function gunStats(def: WeaponDef): Record<GunStat, number> {
  return {
    reach: unit(reachM(def) / SCALE.reachM),
    volume: unit(rounds(def) / SCALE.rounds),
    handling: unit((handlingOf(def) - SCALE.handling0) / (1 - SCALE.handling0)),
    quiet: unit((Math.max(0, 1 - def.report.level) + (def.suppressed ? SCALE.can : 0)) / SCALE.quiet),
  };
}
