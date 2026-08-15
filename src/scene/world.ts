// World-wide constants shared between CPU and WGSL (injected into shaders as consts).
export const WORLD = {
  // Traceable world bounds (rays leaving this box "miss" into the sky).
  min: [0, -0.25, 0] as [number, number, number],
  max: [40, 8, 28] as [number, number, number],
  // Uniform grid over XZ for ray traversal.
  gridCell: 1.0,
  gridW: 40,
  gridH: 28,
  // Height quantiser shared by the grid's occupancy data (boxes.ts buildGrid) and the traversal's y-cull (common.wgsl): 240 levels of
  // 1.5 cm over [gridY0, gridY1] — everything above gridY1 (street-lamp heads; the interior stops at the 3.0–3.2 m ceiling slab) shares
  // the top level, everything below gridY0 the bottom one. gridYPad widens every box's stored extent so the cull can never be tighter
  // than the tracer's own arithmetic (see the exactness note above traceClosest).
  gridY0: -0.25,
  gridY1: 3.35,
  gridYLevels: 240,
  gridYPad: 0.04,
  // Float part of the registration slack (boxes.ts buildGrid adds the measured f16-yaw part): the traced face of a box sits where f32
  // arithmetic on its centre / half size / the ray origin's offset puts it, up to ~3 half-ulps at 64 m ≈ 1e-5 m from where the f64
  // footprint registered it; ×5 margin.
  gridJitter: 5e-5,
  ceilingY: 3.0,
  // Box capacity of the GPU box lists (boxes.ts BoxWorld / render/gbuffer.ts): the marking table starts after this many mat rows (common.wgsl MARK_BASE).
  maxBoxes: 4096,
  // Radiance-cascade probe volume (interior slab). Probes at cell centers.
  rcMin: [0, 0, 0] as [number, number, number],
  rcSize: [40, 3, 28] as [number, number, number],
};

export function wgslWorldConsts(): string {
  const f = (n: number) => (Number.isInteger(n) ? n.toFixed(1) : String(n));
  return `
const WORLD_MIN = vec3f(${WORLD.min.map(f).join(', ')});
const WORLD_MAX = vec3f(${WORLD.max.map(f).join(', ')});
const GRID_CELL: f32 = ${f(WORLD.gridCell)};
const GRID_W: i32 = ${WORLD.gridW};
const GRID_H: i32 = ${WORLD.gridH};
const GRID_CB: u32 = ${WORLD.gridW * WORLD.gridH + 1}u;
const GRID_YQ0: f32 = ${f(WORLD.gridY0)};
const GRID_YQS: f32 = ${f(WORLD.gridYLevels / (WORLD.gridY1 - WORLD.gridY0))};
const GRID_YQMAX: f32 = ${f(WORLD.gridYLevels - 1)};
const CEIL_Y: f32 = ${f(WORLD.ceilingY)};
const MAX_BOXES: u32 = ${WORLD.maxBoxes}u;   // boxes.ts BoxWorld.maxBoxes: the marking table follows the mat rows of this many boxes (common.wgsl MARK_BASE)
const REACH_ROW_WORDS: u32 = ${Math.ceil((WORLD.gridW * WORLD.gridH) / 16)}u;   // per-light reach mask row (render/reach.ts: 2 bits a cell)
const RC_MIN = vec3f(${WORLD.rcMin.map(f).join(', ')});
const RC_SIZE = vec3f(${WORLD.rcSize.map(f).join(', ')});
`;
}
