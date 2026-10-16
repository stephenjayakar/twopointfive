// THE GWOT PALETTE — the default look's colours and finishes by name (scene/gwotKit.ts builds with them; scene/look.ts is the switch), and WHAT EACH ONE IS TO
// A ROUND AND A BLAST. The simulation knows what a static is made of by its paint (game/particleFx.ts paletteName / surfOf: an exact office-palette albedo
// names the stuff — which walls a charge cuts, what a desk does in a blast, what a round knocks out — and an unnamed paint is classed by how bright it is), so
// a paint from this palette says its stuff here: `GWOT_SIM[name]` = the OFFICE material it stands for ('wall' = a plaster partition a charge cuts, 'concrete'
// = structure, 'wood', 'metal', 'chair' = cloth …) or '~surf' = no office name, that surface. `gwotAs(name, sim)` is the same paint to the eye (≤ 0.0024 off
// a channel) standing for something else — a mud PARTITION ('wall') beside a mud SHELL ('concrete'), or, in a level that changed its clothes, exactly the
// office paint the box wore before, so nothing a round or a charge does there differs.
// No imports but a type: game/ reads this without pulling the kit in.
import type { Vec3 } from '../math/vec';

/** THE PALETTE (linear albedo), by name — a generator that exports `MATERIALS = GWOT_MATERIALS` has these written into its level file's `materials` */
export const GWOT_PALETTE = {
  // walls
  mud: [0.42, 0.32, 0.21] as Vec3, mudDark: [0.29, 0.22, 0.15] as Vec3, mudLight: [0.56, 0.46, 0.33] as Vec3,
  render: [0.57, 0.53, 0.45] as Vec3, whitewash: [0.72, 0.69, 0.61] as Vec3, block: [0.4, 0.39, 0.37] as Vec3, tWall: [0.46, 0.45, 0.43] as Vec3,
  // paint (doors, gates, dados, trunks)
  paintBlue: [0.06, 0.19, 0.32] as Vec3, paintGreen: [0.08, 0.24, 0.16] as Vec3, paintRust: [0.3, 0.075, 0.04] as Vec3, paintCream: [0.66, 0.6, 0.44] as Vec3,
  // ground — DARKER THAN ANY WALL, on purpose: under the midday sun the renderer's exposure lifts every earth tone into one pale band, and ground at a wall's
  // value loses the plan (and a man in pale cloth) — so the ground sits two stops under the mud walls, just over the asphalt the levels were lit for (0.09);
  // a patch is darker than its ground, never paler, and a stain never under a third of it (oil at 0.05 read as a hole in the floor)
  dust: [0.205, 0.145, 0.085] as Vec3, dirt: [0.135, 0.09, 0.05] as Vec3, gravel: [0.15, 0.135, 0.115] as Vec3, mudFloor: [0.17, 0.115, 0.07] as Vec3,
  slab: [0.3, 0.285, 0.26] as Vec3, damp: [0.075, 0.052, 0.034] as Vec3, oil: [0.11, 0.095, 0.08] as Vec3,
  // cloth
  rugRed: [0.3, 0.052, 0.04] as Vec3, rugNavy: [0.04, 0.06, 0.15] as Vec3, rugCream: [0.6, 0.52, 0.38] as Vec3, rugOchre: [0.5, 0.33, 0.1] as Vec3,
  rugGreen: [0.09, 0.22, 0.13] as Vec3, canvas: [0.33, 0.31, 0.2] as Vec3, blanketGrey: [0.3, 0.3, 0.31] as Vec3, blanketBrown: [0.27, 0.18, 0.12] as Vec3,
  tarpBlue: [0.05, 0.17, 0.48] as Vec3, sack: [0.62, 0.58, 0.48] as Vec3, sandbag: [0.45, 0.39, 0.27] as Vec3, hesco: [0.47, 0.44, 0.36] as Vec3,
  // gear
  olive: [0.15, 0.17, 0.09] as Vec3, coyote: [0.4, 0.31, 0.2] as Vec3, stencil: [0.62, 0.5, 0.1] as Vec3,
  // metal, plastic, rubber
  rust: [0.28, 0.12, 0.06] as Vec3, iron: [0.098, 0.1, 0.112] as Vec3, galv: [0.5, 0.52, 0.53] as Vec3, tin: [0.56, 0.55, 0.52] as Vec3,
  drumBlue: [0.06, 0.15, 0.33] as Vec3, drumRed: [0.4, 0.07, 0.05] as Vec3, genYellow: [0.6, 0.42, 0.04] as Vec3,
  plasticWhite: [0.7, 0.7, 0.66] as Vec3, plasticGreen: [0.08, 0.28, 0.14] as Vec3, plasticBlue: [0.03, 0.12, 0.36] as Vec3, plasticBlack: [0.045, 0.045, 0.05] as Vec3,
  jerryYellow: [0.62, 0.46, 0.05] as Vec3, rubber: [0.03, 0.03, 0.033] as Vec3,
  // wood
  poplar: [0.47, 0.36, 0.22] as Vec3, woodGrey: [0.33, 0.29, 0.23] as Vec3, ply: [0.55, 0.43, 0.27] as Vec3,
  // vehicles
  truckWhite: [0.68, 0.68, 0.65] as Vec3, truckTan: [0.5, 0.42, 0.29] as Vec3, truckRed: [0.42, 0.06, 0.05] as Vec3, glassDark: [0.05, 0.06, 0.08] as Vec3,
  // produce, washing, the odd accent
  prodOrange: [0.7, 0.3, 0.04] as Vec3, prodGreen: [0.22, 0.4, 0.1] as Vec3, prodRed: [0.5, 0.07, 0.05] as Vec3, prodYellow: [0.7, 0.55, 0.1] as Vec3,
  straw: [0.51, 0.43, 0.22] as Vec3, scrub: [0.24, 0.26, 0.13] as Vec3,
  // (added later — a palette's ORDER is in nothing, its names are in the level files)
  rugMadder: [0.1, 0.03, 0.035] as Vec3,
};
export type GwotMat = keyof typeof GWOT_PALETTE;
/** THE FINISHES (GGX roughness, bare metal), by the palette's names; absent = matte cloth / earth (0.95). Nothing here is polished: this look has no mirror. */
export const GWOT_FINISH: Readonly<Partial<Record<GwotMat, { rough: number; metal?: boolean }>>> = {
  mud: { rough: 0.97 }, mudDark: { rough: 0.97 }, mudLight: { rough: 0.95 }, render: { rough: 0.9 }, whitewash: { rough: 0.88 }, block: { rough: 0.92 }, tWall: { rough: 0.9 },
  paintBlue: { rough: 0.6 }, paintGreen: { rough: 0.6 }, paintRust: { rough: 0.65 }, paintCream: { rough: 0.7 },
  dust: { rough: 1 }, dirt: { rough: 1 }, gravel: { rough: 1 }, mudFloor: { rough: 0.97 }, slab: { rough: 0.9 }, damp: { rough: 0.7 }, oil: { rough: 0.35 },
  olive: { rough: 0.75 }, coyote: { rough: 0.85 }, stencil: { rough: 0.7 },
  rust: { rough: 0.85 }, iron: { rough: 0.5, metal: true }, galv: { rough: 0.38, metal: true }, tin: { rough: 0.42, metal: true },
  drumBlue: { rough: 0.5 }, drumRed: { rough: 0.5 }, genYellow: { rough: 0.5 },
  plasticWhite: { rough: 0.45 }, plasticGreen: { rough: 0.45 }, plasticBlue: { rough: 0.45 }, plasticBlack: { rough: 0.5 }, jerryYellow: { rough: 0.45 }, rubber: { rough: 0.85 },
  poplar: { rough: 0.8 }, woodGrey: { rough: 0.85 }, ply: { rough: 0.75 },
  truckWhite: { rough: 0.35 }, truckTan: { rough: 0.4 }, truckRed: { rough: 0.35 }, glassDark: { rough: 0.1 },
};
export const ROUGH_CLOTH = 0.95;
/** THE SNOW PAINTS — lying snow as paint, for a level built in winter (tools/levels/pass.ts): `snow` fresh, a blue-tinted near-white (never a neutral white:
 *  a plain white or grey box is a steel cabinet to a blast); `snowPacked` trodden / driven snow, darker and greyer; `snowOld` slush and old snow, the dirty
 *  ring round a cleared patch and the foot of a wall where the sun never comes. Each step down is over a third of the one it lies on (STYLE.md: a patch is
 *  darker than its ground, never under a third of it), and earth (`dust`) on `snowOld` holds the same rule.
 *  A TABLE OF ITS OWN, not rows of GWOT_PALETTE: that table is written whole into the `materials` of every level built on the kit (GWOT_MATERIALS), and a new
 *  row there makes every one of those files stale. A snow level's generator exports `MATERIALS = { ...GWOT_MATERIALS, ...SNOW_MATERIALS }`.
 *  TO A ROUND AND A BLAST snow is the ground (SNOW_SIM: 'asphalt', as dust, dirt and gravel are): a round knocks a puff of its own colour out of it, a charge
 *  cuts nothing of it, and it is never steel, glass or wood. gwotSimOf() below knows these colours; no stand-ins (gwotAs) are made of them. */
export const SNOW_PALETTE = {
  snow: [0.66, 0.71, 0.78] as Vec3, snowPacked: [0.43, 0.47, 0.53] as Vec3, snowOld: [0.27, 0.3, 0.34] as Vec3,
};
export type SnowMat = keyof typeof SNOW_PALETTE;
export const SNOW_FINISH: Readonly<Record<SnowMat, { rough: number }>> = { snow: { rough: 1 }, snowPacked: { rough: 0.9 }, snowOld: { rough: 0.95 } };
export const SNOW_MATERIALS: Readonly<Record<string, { albedo: Vec3; rough: number }>> = Object.fromEntries(
  (Object.keys(SNOW_PALETTE) as SnowMat[]).map(n => [n, { albedo: SNOW_PALETTE[n], rough: SNOW_FINISH[n].rough }]));
/** what each snow paint is to a round and a blast (an office paint name, as GWOT_SIM) */
export const SNOW_SIM: Readonly<Record<SnowMat, GwotSim>> = { snow: 'asphalt', snowPacked: 'asphalt', snowOld: 'asphalt' };
/** the palette + finishes as the exporter's `materials` rows (tools/levels/export.ts: a generator's `MATERIALS` export) */
export const GWOT_MATERIALS: Readonly<Record<string, { albedo: Vec3; rough: number; metal?: boolean }>> = Object.fromEntries(
  (Object.keys(GWOT_PALETTE) as GwotMat[]).map(n => [n, { albedo: GWOT_PALETTE[n], rough: GWOT_FINISH[n]?.rough ?? ROUGH_CLOTH, ...(GWOT_FINISH[n]?.metal ? { metal: true } : {}) }]));
/** WHICH FOOTSTEP SURFACE a ground material is (the six the game has — a level's `surfaces` block is separate data; scene/levelData.ts SurfacesData) */
export const GWOT_SURFACE: Readonly<Partial<Record<GwotMat, 'carpet' | 'lino' | 'stone' | 'tile' | 'asphalt' | 'grass'>>> = {
  dust: 'asphalt', dirt: 'asphalt', gravel: 'asphalt', mudFloor: 'stone', slab: 'stone', rugRed: 'carpet', rugNavy: 'carpet', rugCream: 'carpet', rugMadder: 'carpet',
};

/** what a paint can stand for: an office palette name (levels/office.json materials — game/particleFx.ts MAT_SURF says what each is), or '~surf' = unnamed,
 *  that surface ('~steel' / '~steelPale' = an unnamed grey steel cabinet — a blast takes it apart as a sheet and a carcass —, mid grey / pale). APPEND ONLY: a name's place in this list is in the colour of every level file that used it. */
export const GWOT_SIM_NAMES = ['carpet', 'carpetBlue', 'carpetRed', 'lino', 'stone', 'asphalt', 'grass', 'wall', 'wallDark', 'concrete', 'ceiling', 'partRed', 'partBlue', 'partTan',
  'wood', 'woodDark', 'metal', 'black', 'chair', 'cardboard', 'white', 'plant', 'glassFrame', 'screenOff', 'red',
  '~metal', '~plastic', '~glass', '~wood', '~cardboard', '~drywall', '~concrete', '~carpet', '~fabric', '~foliage', '~steel', '~steelPale'] as const;
export type GwotSim = typeof GWOT_SIM_NAMES[number];
/** WHAT EACH PAINT IS, as the kit lays it: shells and yard walls are structure, plaster is a partition, cloth is cloth */
export const GWOT_SIM: Readonly<Record<GwotMat, GwotSim>> = {
  mud: 'concrete', mudDark: 'concrete', mudLight: 'wall', render: 'concrete', whitewash: 'wall', block: 'concrete', tWall: 'concrete',
  paintBlue: 'metal', paintGreen: 'metal', paintRust: 'metal', paintCream: 'wall',
  dust: 'asphalt', dirt: 'asphalt', gravel: 'asphalt', mudFloor: 'stone', slab: 'concrete', damp: 'asphalt', oil: 'asphalt',
  rugRed: 'carpetRed', rugNavy: 'carpetBlue', rugCream: 'carpet', rugOchre: 'carpet', rugGreen: 'carpet', canvas: 'chair', blanketGrey: 'chair', blanketBrown: 'chair',
  tarpBlue: 'chair', sack: 'chair', sandbag: 'concrete', hesco: 'concrete',
  olive: 'woodDark', coyote: 'chair', stencil: 'metal',
  rust: 'metal', iron: 'metal', galv: 'metal', tin: 'metal', drumBlue: 'metal', drumRed: 'metal', genYellow: 'metal',
  plasticWhite: '~plastic', plasticGreen: '~plastic', plasticBlue: '~plastic', plasticBlack: '~plastic', jerryYellow: '~plastic', rubber: '~plastic',
  poplar: 'wood', woodGrey: 'wood', ply: 'wood',
  truckWhite: 'metal', truckTan: 'metal', truckRed: 'metal', glassDark: '~glass',
  prodOrange: 'plant', prodGreen: 'plant', prodRed: 'plant', prodYellow: 'plant', straw: 'plant', scrub: 'plant',
  rugMadder: 'carpetRed',
};
const STEP = 0.0008;
const shifted = (a: Vec3, code: number): Vec3 => [0, 1, 2].map(c => Math.round((a[c] + ((code >> (2 * c)) & 3) * STEP) * 1e4) / 1e4) as Vec3;
/** the paint `m` STANDING FOR `sim`: the palette colour itself where that is what it is anyway, else the same colour a hair off (see the head) */
export function gwotAs(m: GwotMat, sim: GwotSim): Vec3 { return sim === GWOT_SIM[m] ? GWOT_PALETTE[m] : shifted(GWOT_PALETTE[m], 1 + GWOT_SIM_NAMES.indexOf(sim)); }
/** the lot's slab as the storm wets it (game/weather.ts setWet soak — the same arithmetic, so the same doubles) */
export const gwotWet = (a: Vec3): Vec3 => [a[0] * 0.5, a[1] * 0.5, a[2] * 0.5 * 1.04];
let simByAlbedo: Map<string, GwotSim> | null = null;
/** what a colour of this palette (or one of its stand-ins) is — undefined for any other colour. Built on first ask. */
export function gwotSimOf(albedo: Vec3, key: string = albedo.join(',')): GwotSim | undefined {
  if (!simByAlbedo) { simByAlbedo = new Map();
    for (const m of Object.keys(GWOT_PALETTE) as GwotMat[]) { GWOT_SIM_NAMES.forEach((s, i) => simByAlbedo!.set(shifted(GWOT_PALETTE[m], 1 + i).join(','), s)); }
    for (const m of Object.keys(GWOT_PALETTE) as GwotMat[]) simByAlbedo.set(GWOT_PALETTE[m].join(','), GWOT_SIM[m]);
    // THE WET LOT: the storm darkens the lot's slab IN PLACE (game/weather.ts setWet: albedo × 0.5, blue × 1.04), and a paint at half its tone is no palette
    // colour any more. The office's wet asphalt has no name and reads as metal by its tone (as measured — weather.ts says so and keeps it); a paint of this
    // palette standing for asphalt, wetted the same way, says the same.
    for (const m of Object.keys(GWOT_PALETTE) as GwotMat[]) { const a = gwotAs(m, 'asphalt'), k = gwotWet(a).join(','); if (!simByAlbedo.has(k)) simByAlbedo.set(k, '~metal'); }
    // THE SNOW PAINTS, last and only where the key is free: nothing above reads differently because they are here
    for (const m of Object.keys(SNOW_PALETTE) as SnowMat[]) { const k = SNOW_PALETTE[m].join(','); if (!simByAlbedo.has(k)) simByAlbedo.set(k, SNOW_SIM[m]); }
    // … and soaked (the switch off: a snow level stands under the storm any level has, and weather.ts setWet darkens its ground slab in place) they say what every wet lot says
    for (const m of Object.keys(SNOW_PALETTE) as SnowMat[]) { const k = gwotWet(SNOW_PALETTE[m]).join(','); if (!simByAlbedo.has(k)) simByAlbedo.set(k, '~metal'); } }
  return simByAlbedo.get(key);
}
