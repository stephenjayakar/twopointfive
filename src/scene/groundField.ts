// GROUND THAT RAYS CAN SEE, A TRIAL (THE LOOK PROTOTYPE's page only): the snow hills' height, as the hills' mesh draws it (render/snowField.ts `mound`, one float
// a texel of GH_RES to the metre over the whole world rectangle, row-major from the world's min corner, a texel's height standing at its CENTRE), in the tail of the
// boxMat buffer — after the cut table, GH_ROWS vec4 rows — where every ray program can read it with no new binding. common.wgsl ghHit marches a shadow ray over it
// (occluded, occludedTBoxes) and a closest-hit ray too (traceClosest, traceClosestMesh: the hit is the ground slab's, with the hill's own slope for a normal)
// behind the scene prelude's `const GROUND_RAYS`: a hill casts the shadow of its own round shape, takes one, and bounces light off the slope it has, where
// before only the level's snow BOXES under the hills stood in a ray's way.
//
// The rows: row 0 = (the highest hill + a finger, m; 1 = a field is in; the ground slab's box index — whose a hill's hit is; 0) · then one float a 1 m plan cell (the trace grid's cells: the highest texel in or
// a texel beside the cell, 0 = no hill there, so a ray over bare ground reads one row a step and no more) · then the texels.
//
// OFF: main.ts raises it at BOOT on the look's page (?hills=0 or the panel's button puts it off), and on every other page the prelude's const is false, the reads
// dead code and the buffer no longer. Not a rule of the game: no knob table, no journal key. Known gaps are in docs/agents/render.md (the trial's bullet).
import { WORLD } from './world';

/** `roll`: m of slow swell the open ground's snow is baked with on that page (render/snowField.ts buildSnowField `roll`; 0 = the ground as flat as the level has it) */
export const groundRayConfig = { on: false, roll: 0 };
export const GH_RES = 10;
export const GH_W = Math.round(WORLD.gridW * WORLD.gridCell * GH_RES);
export const GH_H = Math.round(WORLD.gridH * WORLD.gridCell * GH_RES);
/** vec4 rows before the texels: the head row and the plan cells' tops */
export const GH_HEAD_ROWS = 1 + Math.ceil(WORLD.gridW * WORLD.gridH / 4);
export const GH_ROWS = GH_HEAD_ROWS + Math.ceil(GH_W * GH_H / 4);
/** where a texel with nothing standing on it sits: under the ground, as the hills' mesh puts its corners there (shaders/snow.wgsl vsSnow) */
export const GH_UNDER = -0.012;

/** the rows for a field's hills (null = none: a head row that says so) */
export function packGroundField(f: { mound: Float32Array; w: number; h: number; slab: number } | null): Float32Array {
  const out = new Float32Array(GH_ROWS * 4);
  if (!f) return out;
  if (f.w !== GH_W || f.h !== GH_H) throw new Error(`groundField: the snow field is ${f.w} x ${f.h}, the ray table ${GH_W} x ${GH_H}`);
  const per = Math.round(WORLD.gridCell * GH_RES), tex = GH_HEAD_ROWS * 4;
  let top = 0;
  for (let i = 0; i < GH_W * GH_H; i++) { const m = f.mound[i]; out[tex + i] = m > 0 ? m : GH_UNDER; if (m > top) top = m; }
  for (let cz = 0; cz < WORLD.gridH; cz++) for (let cx = 0; cx < WORLD.gridW; cx++) {
    let t = 0;
    for (let z = Math.max(0, cz * per - 1), z1 = Math.min(GH_H - 1, cz * per + per); z <= z1; z++)
      for (let x = Math.max(0, cx * per - 1), x1 = Math.min(GH_W - 1, cx * per + per); x <= x1; x++) t = Math.max(t, f.mound[z * GH_W + x]);
    out[4 + cz * WORLD.gridW + cx] = t;
  }
  out[0] = top > 0 ? top + 0.01 : 0; out[1] = 1; out[2] = f.slab;
  return out;
}
