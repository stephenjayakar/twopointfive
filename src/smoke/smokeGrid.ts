// The smoke's geometry: pure numbers + the WGSL consts made from them, shared by the solver (smoke.ts / smoke.wgsl) and the readers (render/frame.ts scenePrelude →
// shaders/smoke_read.wgsl). No GPU objects here, so frame.ts can import it without pulling the solver in.
import { WORLD } from '../scene/world';

/** read when the Engine builds its first pipeline: anything that moves a number here (main.ts ?smokepool=N) does it at BOOT, before that */
export const smokeGridConfig = {
  /** pool size in bricks of 8³ cells (4096 = 2.1 M cells) */
  cap: 4096,
  /** voxel size per level: 0 the coarse lattice (canisters, dust), 1 the fine one (gun gas) */
  voxel: [0.055, 0.022] as [number, number],
  /** how high each lattice reaches (m) */
  height: [WORLD.max[1], 4.2] as [number, number],
  /** bricks per edge of a bounding tile (smoke.wgsl boxes) */
  tile: [8, 10] as [number, number],
};

export interface SmokeLevel { voxel: number; dims: [number, number, number]; pageBase: number; texY: number; tile: number; tileBase: number }
export interface SmokeGrid {
  cap: number; levels: [SmokeLevel, SmokeLevel];
  /** page entries of level 0 / of both levels; bounding tiles of both levels */
  n0: number; nPage: number; nTiles: number;
  /** the readers' page texture (r32uint 3D): fine rows first, the coarse lattice's from levels[0].texY, then from macroY one texel per MACRO cell of 4 × 2 × 4 coarse bricks */
  pageTex: [number, number, number]; macroY: number; macroDims: [number, number, number];
  /** the render atlas: blocks of 10³ texels, atlasBlocks per axis */
  atlasBlocks: [number, number, number]; atlasTex: [number, number, number];
}

export function smokeGrid(): SmokeGrid {
  const C = smokeGridConfig;
  if (WORLD.min[0] !== 0 || WORLD.min[2] !== 0) throw new Error('smoke: the lattice assumes the world starts at x = z = 0');
  const dimsOf = (l: number): [number, number, number] => { const bs = 8 * C.voxel[l]; return [Math.ceil(WORLD.max[0] / bs), Math.ceil(C.height[l] / bs), Math.ceil(WORLD.max[2] / bs)]; };
  const d0 = dimsOf(0), d1 = dimsOf(1);
  for (const d of [d0, d1]) if (d[0] > 1023 || d[1] > 127 || d[2] > 1023) throw new Error('smoke: a lattice outgrew the packed brick coordinate (10 / 7 / 10 bits)');
  const n0 = d0[0] * d0[1] * d0[2], n1 = d1[0] * d1[1] * d1[2];
  const tiles = (d: number[], t: number) => Math.ceil(d[0] / t) * Math.ceil(d[2] / t);
  const t0 = tiles(d0, C.tile[0]), t1 = tiles(d1, C.tile[1]);
  const ax = 16, ay = 16, az = Math.ceil(C.cap / (ax * ay));
  const md: [number, number, number] = [Math.ceil(d0[0] / 4), Math.ceil(d0[1] / 2), Math.ceil(d0[2] / 4)];
  return {
    cap: C.cap,
    levels: [
      { voxel: C.voxel[0], dims: d0, pageBase: 0, texY: d1[1], tile: C.tile[0], tileBase: 0 },
      { voxel: C.voxel[1], dims: d1, pageBase: n0, texY: 0, tile: C.tile[1], tileBase: t0 },
    ],
    n0, nPage: n0 + n1, nTiles: t0 + t1,
    pageTex: [Math.max(d0[0], d1[0]), d0[1] + d1[1] + md[1], Math.max(d0[2], d1[2])], macroY: d0[1] + d1[1], macroDims: md,
    atlasBlocks: [ax, ay, az], atlasTex: [ax * 10, ay * 10, az * 10],
  };
}

/** consts ahead of smoke.wgsl */
export function smokeSolverConsts(g: SmokeGrid): string {
  return `const CAP: u32 = ${g.cap}u; const N0: u32 = ${g.n0}u; const NPAGE: u32 = ${g.nPage}u; const NTILES: u32 = ${g.nTiles}u; const ATLAS_X: u32 = ${g.atlasBlocks[0]}u; const ATLAS_Y: u32 = ${g.atlasBlocks[1]}u; const MACRO_Y: i32 = ${g.macroY};\n`;
}
/** consts ahead of shaders/smoke_read.wgsl */
export function smokeReadConsts(g: SmokeGrid): string {
  const [L0, L1] = g.levels; const v = (d: number[]) => `vec3i(${d[0]}, ${d[1]}, ${d[2]})`;
  return `const SPG_B0: f32 = ${8 * L0.voxel}; const SPG_B1: f32 = ${8 * L1.voxel}; const SPG_N0: vec3i = ${v(L0.dims)}; const SPG_N1: vec3i = ${v(L1.dims)}; const SPG_TEXY0: i32 = ${L0.texY}; const SPG_TEXYM: i32 = ${g.macroY};\n`
    + `const SPG_AX: u32 = ${g.atlasBlocks[0]}u; const SPG_AY: u32 = ${g.atlasBlocks[1]}u; const SPG_INV_ATLAS: vec3f = vec3f(${1 / g.atlasTex[0]}, ${1 / g.atlasTex[1]}, ${1 / g.atlasTex[2]});\n`;
}
