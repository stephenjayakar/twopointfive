// THE AIR GRID: the share of the weather's dust / fog standing in the air at each spot of the level's plan — one float a cell of AIR_CELL metres over the whole
// world rectangle, row-major (index = ix + iz × AIR_W, cell centre = WORLD.min.xz + (i + ½) × AIR_CELL). 1 = the open air's own density, less = thinner (a shut
// room keeps the weather's `leak`; game/airDust.ts carries it in at open doors and blown walls).
//
// ONE array, two readers: the men's eyes (game/weather.ts airTrans, on the CPU) and the picture (common.wgsl wxIndoor — the grid rides in the tail of the boxMat
// buffer after the glass table and before the cut table, AIR_ROWS vec4 rows, written by scene/boxes.ts setAirGrid; the scene prelude's WXD_* consts are these numbers).
import { WORLD } from './world';

export const AIR_CELL = 0.5;
export const AIR_W = Math.round((WORLD.max[0] - WORLD.min[0]) / AIR_CELL);
export const AIR_H = Math.round((WORLD.max[2] - WORLD.min[2]) / AIR_CELL);
/** vec4 rows the grid takes in boxMat's tail */
export const AIR_ROWS = Math.ceil(AIR_W * AIR_H / 4);
