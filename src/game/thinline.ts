// Thin lines in the picture: a laser's beam, a tracer's streak. Each is made no thinner than about a pixel of the view the STEP ran under (Game.mPerPx) and dimmed by what
// it was widened. A picture drawn from another view than the step's — the engine replay's own camera and window over a tape recorded at another zoom or window size — needs the
// same rule asked of ITS pixel, or a beam sized for a 150-row recording is drawn as a fat pale bar on a 1000-row picture. So the makers NOTE what they made (`thinNote`: the
// line's true half-width, pixels it must cover, its light before any widening) and whoever draws from another view asks `thinFit` for a list with those boxes re-made for it.
// A weapon laser's line also carries an AIR mark (`thinAir`: its bead, or null): the renderer may then draw it as light in the air instead of as a box (settings.beamAir,
// render/passes.ts setBeams → composite.wgsl beamAir) — the box itself is never written.
// PICTURE ONLY: the note is a WeakMap beside the box, `thinFit` never writes a noted box nor the list it is handed, and nothing in a step reads either. A leaf: types only.
import type { Box } from '../scene/boxes';

interface Thin { hw0: number; k: number; e: [number, number, number] }
const THIN = new WeakMap<Box, Thin>();
/** A WEAPON LASER's line → the bead at its landing point (null = none): the lines the renderer may draw as light in the air instead of as a box (render/passes.ts setBeams) */
const AIR = new WeakMap<Box, Box | null>();

/** `b` is a thin line along its local z: `hw0` = its true half-width (m), `k` = the pixels its half-width must cover, (r, g, bl) = what it emits at that true width. Returns `b`. */
export function thinNote(b: Box, hw0: number, k: number, r: number, g: number, bl: number): Box {
  const T = THIN.get(b);
  if (T) { T.hw0 = hw0; T.k = k; T.e[0] = r; T.e[1] = g; T.e[2] = bl; } else THIN.set(b, { hw0, k, e: [r, g, bl] });
  return b;
}
/** the half-width the rule gives a noted line where a pixel is `px` metres */
export const thinHalf = (hw0: number, k: number, px: number) => Math.max(hw0, k * px);
/** `list` as a picture whose pixel is `px` metres should draw it: a NEW array with a copy of every noted line whose width is not that view's (over 2 % out), widened or
 *  thinned to it and its light scaled the other way — or null when every line already fits (the view is the step's own). */
export function thinFit(list: Box[], px: number): Box[] | null {
  if (!(px > 0) || !Number.isFinite(px)) return null;
  let out: Box[] | null = null;
  for (let i = 0; i < list.length; i++) {
    const b = list[i], T = THIN.get(b); if (!T) continue;
    const hw = thinHalf(T.hw0, T.k, px); if (Math.abs(hw - b.h[0]) <= 0.02 * hw) continue;
    const gain = T.hw0 / hw;
    const c: Box = { ...b, h: [hw, hw, b.h[2]], dh: b.dh ? [hw, hw, b.dh[2]] : b.dh, emissive: [T.e[0] * gain, T.e[1] * gain, T.e[2] * gain] };
    THIN.set(c, T); if (AIR.has(b)) AIR.set(c, AIR.get(b)!);   // (the copy is the same line to whoever asks `thinIs` / `thinAirOf`: its mirror image and its look in the air follow it)
    (out ??= list.slice())[i] = c;
  }
  return out;
}
/** The half-width a noted box wants in a picture whose pixel is `px` metres; null for a box nobody noted (the checks' question). */
export const thinWant = (b: Box, px: number): number | null => { const T = THIN.get(b); return T ? thinHalf(T.hw0, T.k, px) : null; };
/** is `b` a noted thin line (a laser's beam, a tracer's streak)? — the reflection pass's question (render/passes.ts setBeams): picture only, like everything here */
export const thinIs = (b: Box): boolean => THIN.has(b);
/** `line` (already noted) is a weapon laser's beam and `bead` the dot where it lands: the renderer may draw the pair as light scattered in the air (settings.beamAir). Returns `line`. */
export function thinAir(line: Box, bead: Box | null): Box { AIR.set(line, bead); return line; }
/** a weapon laser's line → its bead or null; undefined = `b` is no such line (a tracer, a tripwire, anything else) */
export const thinAirOf = (b: Box): Box | null | undefined => AIR.get(b);
