// CHARACTER MATERIALS: a man is shaded per MATERIAL SLOT instead of as one flat figure in two tints (notes: rebuild/characters-loud/materials/notes.md).
//
// THE CONTRACT WITH THE MESHES is the slot NAMES: a glTF primitive whose material is named after a slot (`skin`, `cloth_uniform`, `cloth_plain`, `webbing`,
// `boot`, `helmet`, `metal_dark`, `rubber`, `lens`, the optional tenth `accent` = each side's ONE odd-coloured thing: the operators' pair marking on the helmet band and brassards, the irregulars' pale naturals (the straw hat, the tee under an open jacket), the tucked shirt's tie, and the eleventh `eye` = the whites of the eyes, the same off-white on every side) puts its faces
// in that slot — case and a `M_` / `mat_` prefix or a Blender `.001` suffix do not matter (slotOfMaterialName). A mesh with NO slot-named material (the UAL
// mannequin the game ships) is split by JOINT + bind-pose position instead (standInSlots) so the path can be seen before a real model lands.
//
// A CAST of part meshes (the models' loader: MeshData.part + the slot index in matSel's low four bits, the same eleven names in the same order) is read as it is —
// charSlots takes the slot from matSel there, and the proxy mixes are weighed over the parts each man WEARS (CharSlotData.weights(mask)).
//
// What rides to the GPU, and nothing else:
//   · per VERTEX, a second vertex buffer of two floats (slot index, cavity) — `cavity` is baked here from the mesh's own curvature (+ in a crease, − on a ridge):
//     the art rule is variation from geometry, never a painted texture, so creases darken and ridges wear because the MESH has them;
//   · per INSTANCE, CHAR_MAT_ROWS vec4 rows in the `charMats` storage buffer (anim/characters.ts): two header rows + (albedo.rgb, rough) · (gain, soak, grime,
//     wear) per slot. Header row 0 `.x` is the SWITCH: 0 = gbuffer.wgsl shades him from CharInst's two tints exactly as it always did.
// The finish is the lobe the wet coat already has (gbuffer.wgsl packWet → composite.wgsl wetCoatSpec: one GGX lobe per reaching light dimmed by the direct
// pass's own shadowing + the ambient sheen, no rays, every tier) — a dry slotted pixel packs its slot's (rough, gain) there, a wet one the larger of the two.
// Secondary hits (bounce, cascades, the light meter, reflections of him) read ONE albedo per shadow proxy: capWeights says how much of each slot each of the
// fifteen proxies carries, so his head reflects as helmet + skin and his legs as trousers (scene/boxes.ts addCharacterCapsules takes the fifteen colours).
import type { GltfCharacter, MeshData } from '../anim/gltf';
import type { Vec3 } from '../math/vec';
import { lookDress } from '../scene/look';

export const CHAR_SLOTS = ['skin', 'cloth_uniform', 'cloth_plain', 'webbing', 'boot', 'helmet', 'metal_dark', 'rubber', 'lens', 'accent', 'eye'] as const;
export type CharSlot = typeof CHAR_SLOTS[number];
export const CHAR_SLOT_COUNT = CHAR_SLOTS.length;
/** vec4 rows per instance in `charMats` (gbuffer.wgsl CHAR_MAT_ROWS): H0, H1, then (A, B) per slot: 2 + 2 × 11 slots exactly, none spare */
export const CHAR_MAT_ROWS = 24;
export const CHAR_MAT_FLOATS = CHAR_MAT_ROWS * 4;
const SLOT_ID: Record<string, number> = Object.fromEntries(CHAR_SLOTS.map((s, i) => [s, i]));
/** = sdfrig.ts RIG_SLOTS / BoxWorld.CAPS_PER_CHAR, in Character.capsules()'s order */
const PROXIES = 15;
/** MeshData.matIndex of a vertex whose primitive names no material (anim/gltf.ts) */
export const NO_MATERIAL = 255;

/** the slot a glTF material name asks for, or −1 (`M_Skin`, `skin.001`, `Cloth_Uniform`, `mat-webbing` all match; `M_Main` does not) */
export function slotOfMaterialName(name: string | undefined): number {
  if (!name) return -1;
  const n = name.toLowerCase().replace(/\.\d+$/, '').replace(/^(m|mat|material)[_\-. ]/, '').replace(/[\- .]/g, '_');
  if (n in SLOT_ID) return SLOT_ID[n];
  for (const s of [...CHAR_SLOTS].sort((a, b) => b.length - a.length)) if (n.startsWith(s + '_') || n.endsWith('_' + s)) return SLOT_ID[s];   // `skin_face`, `op_helmet`
  return -1;
}

export interface CharSlotData {
  /** slot index per vertex */
  slot: Uint8Array;
  /** per vertex −1‥1: + = the surface folds IN round it (a crease, under a strap), − = it turns OUT (a ridge, a rim, a knuckle) */
  cavity: Float32Array;
  /** true = the mesh carries slot-named materials (the contract); false = the stand-in split by joint */
  authored: boolean;
  /** PROXIES × CHAR_SLOT_COUNT, each row summing to 1: the share of proxy p's surface area in slot s */
  capWeights: Float32Array;
  /** surface area (m², bind pose) per slot — the notes' table and the probes */
  area: Float32Array;
  /** material names the mesh has that matched no slot (an authored mesh only: those faces fall to cloth_plain) */
  unmatched: string[];
  /** area + capWeights over the parts a man WEARS (a cast of part meshes: `mask` over MeshData.part; cached per mask) — the two above for any other mesh / mask 0 */
  weights(mask?: number): SlotWeights;
}
export interface SlotWeights { area: Float32Array; capWeights: Float32Array }

/** which shadow proxy (Character.capsules() order) a joint's surface belongs to; −1 = none of them */
function proxyOfJoint(name: string): number {
  const side = name.endsWith('.R') ? 1 : 0;
  if (/^DEF-(hips|spine\.001)$/.test(name)) return 0;
  if (/^DEF-spine\.00[23]$/.test(name)) return 1;
  if (/^DEF-shoulder\./.test(name)) return 2;
  if (/^DEF-(neck|head)$/.test(name)) return 4;
  if (/^DEF-upper_arm\./.test(name)) return 5 + side * 2;
  if (/^DEF-(forearm|hand|f_|thumb)/.test(name)) return 6 + side * 2;
  if (/^DEF-thigh\./.test(name)) return 9 + side * 3;
  if (/^DEF-shin\./.test(name)) return 10 + side * 3;
  if (/^DEF-(foot|toe)\./.test(name)) return 11 + side * 3;
  return -1;
}

/** THE STAND-IN: the mannequin's surface dealt to slots by its dominant joint and where the vertex sits in the bind pose (T-pose, facing +z, soles on y = 0).
 *  It dresses the mannequin as: a helmet over the brow and an eye-pro band, a carrier on the chest, a belt, shirt sleeves, trousers, boots with rubber soles, a
 *  marking band round each upper arm. A side with no helmet / eye-pro / marking says so in its TABLE (`as`), not here. */
function standInSlots(ch: GltfCharacter, dom: Int32Array, jointName: string[]): Uint8Array {
  const m = ch.mesh; const out = new Uint8Array(m.vertexCount);
  const top = m.bboxMax[1]; const S = SLOT_ID;
  for (let v = 0; v < m.vertexCount; v++) {
    const x = m.positions[v * 3], y = m.positions[v * 3 + 1], z = m.positions[v * 3 + 2]; const j = jointName[dom[v]] ?? '';
    let s = S.cloth_plain;
    if (j === 'DEF-head') s = y > top - 0.135 ? S.helmet : (z > 0.04 && y > top - 0.2 ? S.lens : S.skin);
    else if (j === 'DEF-neck') s = S.skin;
    else if (/^DEF-spine\.00[23]$/.test(j)) s = S.webbing;                                             // the carrier: chest and back
    else if (/^DEF-shoulder\./.test(j)) s = Math.abs(x) < 0.1 ? S.webbing : S.cloth_plain;             // its shoulder straps, then the shirt's shoulders
    else if (j === 'DEF-spine.001') s = S.cloth_plain;
    else if (j === 'DEF-hips') s = y > 1.0 ? (z > 0.085 && Math.abs(x) < 0.035 ? S.metal_dark : S.webbing) : S.cloth_uniform;   // the belt and its buckle
    else if (/^DEF-upper_arm\./.test(j)) s = Math.abs(x) > 0.2 && Math.abs(x) < 0.275 ? S.accent : S.cloth_plain;   // the marking band
    else if (/^DEF-forearm\./.test(j)) s = S.cloth_plain;
    else if (/^DEF-(hand|f_|thumb)/.test(j)) s = S.skin;
    else if (/^DEF-thigh\./.test(j)) s = S.cloth_uniform;
    else if (/^DEF-shin\./.test(j)) s = y < 0.27 ? S.boot : S.cloth_uniform;
    else if (/^DEF-(foot|toe)\./.test(j)) s = y < 0.028 ? S.rubber : S.boot;
    out[v] = s;
  }
  return out;
}

/** Per-vertex cavity from the mesh alone: vertices welded by position (a glTF splits them at every material / hard edge), each one's neighbours' mean offset
 *  along its normal — neighbours standing ABOVE the tangent plane mean a crease (+), below it a ridge (−) — scaled by the local edge length so the number is a
 *  turn per edge, not metres, then relaxed twice over the same neighbours so a single skewed triangle does not speckle.
 *  On a CAST of part meshes the weld is PER PART (`perPart`, the default): two parts built off the same loft share positions to the bit — the operators' boots and the low boots,
 *  the loose shirt and the tucked one, the two pairs of hands — and no man wears both, so a weld across them ran one outfit's creases into another's cuffs and boot tops. A
 *  part is its own surface: its creases are its own, and its open rim (a hem, a cuff) reads as the edge it is. (The SCALE stays one number for the whole mesh — the percentile
 *  below — so every man's creases read on one scale, and a part that is smooth stays smooth instead of having its noise stretched to fill the range.) */
export function bakeCavity(m: MeshData, perPart = true): Float32Array {
  const V = m.vertexCount; const weld = new Int32Array(V); const key = new Map<string, number>(); let W = 0;
  const part = perPart ? castPart(m) : null;
  for (let v = 0; v < V; v++) {
    const k = `${part ? part[v] : 0},${Math.round(m.positions[v * 3] * 2e4)},${Math.round(m.positions[v * 3 + 1] * 2e4)},${Math.round(m.positions[v * 3 + 2] * 2e4)}`;
    let w = key.get(k); if (w === undefined) { w = W++; key.set(k, w); } weld[v] = w;
  }
  const P = new Float32Array(W * 3), N = new Float32Array(W * 3);
  for (let v = 0; v < V; v++) { const w = weld[v] * 3; for (let c = 0; c < 3; c++) { P[w + c] = m.positions[v * 3 + c]; N[w + c] += m.normals[v * 3 + c]; } }
  for (let w = 0; w < W; w++) { const l = Math.hypot(N[w * 3], N[w * 3 + 1], N[w * 3 + 2]) || 1; N[w * 3] /= l; N[w * 3 + 1] /= l; N[w * 3 + 2] /= l; }
  const nb: Set<number>[] = Array.from({ length: W }, () => new Set<number>());
  for (let t = 0; t + 2 < m.indices.length; t += 3) {
    const a = weld[m.indices[t]], b = weld[m.indices[t + 1]], c = weld[m.indices[t + 2]];
    if (a !== b) { nb[a].add(b); nb[b].add(a); } if (b !== c) { nb[b].add(c); nb[c].add(b); } if (a !== c) { nb[a].add(c); nb[c].add(a); }
  }
  let cur: Float32Array = new Float32Array(W);
  for (let w = 0; w < W; w++) {
    if (!nb[w].size) continue; let s = 0;
    for (const o of nb[w]) { const dx = P[o * 3] - P[w * 3], dy = P[o * 3 + 1] - P[w * 3 + 1], dz = P[o * 3 + 2] - P[w * 3 + 2]; const l = Math.hypot(dx, dy, dz) || 1e-6; s += (dx * N[w * 3] + dy * N[w * 3 + 1] + dz * N[w * 3 + 2]) / l; }
    cur[w] = s / nb[w].size;
  }
  const relax = (x: Float32Array, n: number): Float32Array => { for (let it = 0; it < n; it++) { const nx = new Float32Array(W); for (let w = 0; w < W; w++) { let s = x[w] * 2, k = 2; for (const o of nb[w]) { s += x[o]; k++; } nx[w] = s / k; } x = nx; } return x; };
  // A limb is a tube: convex everywhere, so the raw bend reads 'ridge' over the whole man. What a crease or an edge IS is the bend standing out from the bend
  // of the surface round it — so take the local bend (lightly relaxed) minus the broad one (relaxed CAVITY_BROAD rings out), and scale it by the mesh's own
  // spread (its CAVITY_PCT-th percentile of |x| reads CAVITY_AT), so a denser or a coarser mesh lands in the same range without a constant to retune.
  cur = relax(cur, 1); const broad = relax(cur, CAVITY_BROAD);
  const mags = new Float32Array(W); for (let w = 0; w < W; w++) { cur[w] -= broad[w]; mags[w] = Math.abs(cur[w]); }
  mags.sort(); const ref = mags[Math.min(W - 1, Math.floor(W * CAVITY_PCT))] || 1; const k = CAVITY_AT / ref;
  const out = new Float32Array(V);
  for (let v = 0; v < V; v++) out[v] = Math.max(-1, Math.min(1, cur[weld[v]] * k));
  return out;
}
/** the cavity's band-pass and range: how many neighbour rings the 'broad' bend is relaxed over, and which percentile of |local − broad| reads how much */
const CAVITY_BROAD = 6, CAVITY_PCT = 0.9, CAVITY_AT = 0.6;

/** A CAST of part meshes (the models' loader: `MeshData.part` = the part each vertex belongs to, and the slot index — this file's CHAR_SLOTS order —
 *  in the low four bits of `matSel`): its per-vertex part array, else null. Read structurally so this file needs nothing of that loader. */
function castPart(m: MeshData): Uint8Array | null { const p = (m as MeshData & { part?: Uint8Array }).part; return p && p.length === m.vertexCount ? p : null; }
/** Does this mesh keep the contract — is a material one of its OWN primitives use named after a slot? (Names elsewhere in the file — a prop's — do not count.)
 *  Cheap (one pass over the vertices): what a boot asks to decide the switch, without baking anything. */
export function meshAuthored(m: MeshData): boolean {
  if (castPart(m)) return true;
  if (!m.matIndex || !m.materialNames) return false; const seen = new Set<number>();
  for (let v = 0; v < m.vertexCount; v++) seen.add(m.matIndex[v]);
  for (const i of seen) if (i < m.materialNames.length && slotOfMaterialName(m.materialNames[i]) >= 0) return true;
  return false;
}

const cache = new WeakMap<MeshData, CharSlotData>();
/** The slot data of a loaded character: solved once per mesh, on first use (tens of ms for the mannequin's 8.5k vertices — the cavity bake; nothing asks for it
 *  while the switch is off: anim/characters.ts uploads it on the first frame a man has rows). */
export function charSlots(ch: GltfCharacter): CharSlotData {
  const hit = cache.get(ch.mesh); if (hit) return hit;
  const m = ch.mesh; const V = m.vertexCount;
  const jointName = ch.skin.joints.map(n => ch.nodes[n].name);
  const dom = new Int32Array(V);
  for (let v = 0; v < V; v++) { let best = 0, bw = -1; for (let c = 0; c < 4; c++) { const w = m.weights[v * 4 + c]; if (w > bw) { bw = w; best = m.joints[v * 4 + c]; } } dom[v] = best; }
  const names = m.materialNames ?? []; const bySlot = names.map(slotOfMaterialName);
  const authored = meshAuthored(m);
  let slot: Uint8Array; const unmatched: string[] = []; const cp = castPart(m);
  if (cp) {
    slot = new Uint8Array(V);
    for (let v = 0; v < V; v++) slot[v] = Math.min(CHAR_SLOT_COUNT - 1, (m.matSel[v] | 0) & 15);
  } else if (authored) {
    slot = new Uint8Array(V);
    for (let v = 0; v < V; v++) { const s = bySlot[m.matIndex![v]] ?? -1; slot[v] = s >= 0 ? s : SLOT_ID.cloth_plain; }
    names.forEach((n, i) => { if (bySlot[i] < 0 && m.matIndex!.includes(i)) unmatched.push(n || `#${i}`); });
    if (m.matIndex!.includes(NO_MATERIAL)) unmatched.push('(a primitive with no material)');
  } else slot = standInSlots(ch, dom, jointName);
  // the surface each slot and each proxy carries (a triangle is its FIRST vertex's: the provoking vertex of the flat varyings in the raster) — over the whole
  // mesh, or over the PARTS a man wears where the mesh is a cast of parts (`mask` over MeshData.part; 0 = everything)
  const prox = jointName.map(proxyOfJoint); const part = castPart(m);
  const weigh = (mask: number): SlotWeights => {
    const area = new Float32Array(CHAR_SLOT_COUNT); const capW = new Float32Array(PROXIES * CHAR_SLOT_COUNT); const P = m.positions;
    for (let t = 0; t + 2 < m.indices.length; t += 3) {
      const i0 = m.indices[t]; if (part && mask && !((mask >>> part[i0]) & 1)) continue;
      const a = i0 * 3, b = m.indices[t + 1] * 3, c = m.indices[t + 2] * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      const ar = 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx); const sl = slot[i0];
      area[sl] += ar; const p = prox[dom[i0]]; if (p >= 0) capW[p * CHAR_SLOT_COUNT + sl] += ar;
    }
    let pelvis = 0; for (let k = 0; k < CHAR_SLOT_COUNT; k++) pelvis += capW[3 * CHAR_SLOT_COUNT + k];
    if (pelvis <= 0) for (let k = 0; k < CHAR_SLOT_COUNT; k++) capW[3 * CHAR_SLOT_COUNT + k] = capW[k];   // the pelvis line (no joint of its own on the mannequin's map) is the lower torso's cloth
    const total = area.reduce((n, x) => n + x, 0) || 1;
    for (let p = 0; p < PROXIES; p++) {
      let sum = 0; for (let k = 0; k < CHAR_SLOT_COUNT; k++) sum += capW[p * CHAR_SLOT_COUNT + k];
      for (let k = 0; k < CHAR_SLOT_COUNT; k++) capW[p * CHAR_SLOT_COUNT + k] = sum > 0 ? capW[p * CHAR_SLOT_COUNT + k] / sum : area[k] / total;   // (a proxy no surface maps to takes the whole man's mix)
    }
    return { area, capWeights: capW };
  };
  const base = weigh(0); const byMask = new Map<number, SlotWeights>();
  const weights = (mask = 0): SlotWeights => { if (!part || !mask) return base; let w = byMask.get(mask); if (!w) { w = weigh(mask); byMask.set(mask, w); } return w; };
  const out: CharSlotData = { slot, cavity: bakeCavity(m), authored, capWeights: base.capWeights, area: base.area, unmatched, weights };
  if (unmatched.length) console.warn(`character materials: no slot for material(s) ${unmatched.join(', ')} — their faces shade as cloth_plain (slots: ${CHAR_SLOTS.join(' ')})`);
  cache.set(m, out); return out;
}

// ---------------------------------------------------------------- the tables ----------------------------------------------------------------

export type CharSide = 'operator' | 'defender' | 'responder' | 'civilian';
/** One slot's material. COLOUR: `albedo` as written, or taken from the character — `src` 'tint' / 'tint2' (Character.tint / tint2: the level's, the loadout
 *  screen's suit and trim) × `k`, then pulled `mix` of the way toward `albedo`; `pick` = one of these per man by his id (the irregulars' motley), pulled
 *  `mix` toward… the source when both are given. A row that is only `{ as: slot }` (SlotAlias) = this side has no such thing: the faces shade as that other
 *  slot, colour and finish both (a bare head's `lens` as skin).
 *  FINISH: `rough` = the highlight's GGX roughness (0.03 mirror ‥ 0.65 the widest the lobe goes), `spec` = its strength (1 = a dielectric's 4 %; cloth ~0.2),
 *  `metal` raises it the little the lobe allows (the notes say what a true metal would need). `soak` = how much rain darkens it (cloth 1, a helmet shell 0),
 *  `grime` = how much of the ground's dust it takes near the sole, `wear` = how much its ridges lighten and its creases darken. */
export interface SlotMat { albedo?: Vec3; src?: 'tint' | 'tint2'; k?: number; mix?: number; pick?: Vec3[]; rough: number; spec: number; metal?: number; soak: number; grime: number; wear: number }
export interface SlotAlias { as: CharSlot }
export interface SideTable {
  slots: Record<CharSlot, SlotMat | SlotAlias>;
  /** the ground's dust on him: colour, how high above the sole it is at full strength (m, bind pose), the band it fades out over, its overall strength */
  grime: { color: Vec3; height: number; band: number; k: number };
  /** how dark a full crease goes (× albedo) and how much a full ridge lightens (the slot's `wear` scales both) */
  cavity: number; ridge: number;
  /** ONLY on the stand-in (the mannequin split by joint, which deals everybody's shirt to cloth_plain and an armband to accent): this side's slot → the row it
   *  shades as there. The operators' shirt is their uniform, so their stand-in shirt takes the uniform's row and the armband the marking's. */
  standIn?: Partial<Record<CharSlot, CharSlot>>;
}

/** the operators' one dark issue: every suit tint is pulled toward it (Sam's own suit) */
const SUIT: Vec3 = [0.05, 0.06, 0.07];
const SKIN_A: Vec3[] = [[0.42, 0.27, 0.19], [0.33, 0.2, 0.135], [0.25, 0.15, 0.1], [0.47, 0.32, 0.24]];
/** the irregulars' shirts and hats. Chosen AWAY from skin (a warm mid-value shirt on a smooth figure reads as a bare torso from above) and from each other;
 *  eleven shirts, six hats, five trousers — coprime lengths, so the man-by-man walk through them (pickIndex) pairs them differently for 330 men running
 *  (the four NATURALS below ride the same walk: every one of them is kept clearly lighter than every shirt, so no jacket meets a tee of its own colour — which is
 *  why no shirt's red goes over 0.385).
 *  NO SATURATED RED, BLUE OR GREEN in either list: the squad's pairs are told apart by a red and a blue marking and Sam's is green, and from the game's camera a
 *  defender in a red jacket was the largest red thing on the floor. Earth and wash only: washed grey, mauve-grey, umber, sage, tobacco, faded teal-grey, dirty white,
 *  rust-brown, khaki, olive, charcoal. NO YELLOW either: the cleaner's tunic is the one yellow top on the floor, and a mustard shirt beside her was a
 *  shoot / no-shoot clash from above. ELEVEN, a prime: with seven, the shift's first man (id 10) and the cell's fifth (id 24) wore one shirt. */
const SHIRTS: Vec3[] = [[0.3, 0.3, 0.29], [0.27, 0.22, 0.25], [0.13, 0.09, 0.06], [0.3, 0.33, 0.25], [0.31, 0.24, 0.14], [0.2, 0.26, 0.25], [0.37, 0.355, 0.3], [0.21, 0.125, 0.07], [0.34, 0.31, 0.21], [0.2, 0.22, 0.1], [0.15, 0.14, 0.13]];
const HATS: Vec3[] = [[0.25, 0.28, 0.2], [0.09, 0.06, 0.04], [0.17, 0.18, 0.1], [0.28, 0.15, 0.09], [0.42, 0.38, 0.27], [0.15, 0.19, 0.19]];
/** hair, by the man (the models' hair, brows and moustache are `rubber` faces on the sides that wear no gloves): black, dark brown, brown, iron grey */
const HAIR: Vec3[] = [[0.022, 0.02, 0.019], [0.042, 0.028, 0.02], [0.075, 0.047, 0.03], [0.085, 0.083, 0.08]];
/** the irregulars' pale NATURALS — straw, undyed and washed-out cotton: the straw hat and the tee under an open jacket (the models' `accent` faces on
 *  their side), well lighter than any skin and than the trouser list */
const NATURALS: Vec3[] = [[0.6, 0.54, 0.38], [0.63, 0.59, 0.48], [0.6, 0.57, 0.49], [0.6, 0.49, 0.3]];   // (off-white at the palest: a bandana at 0.68 0.66 0.6 was a white helmet under a lamp)
/** the whites of the eyes (the models' `eye` faces), the same on every side: an off-white well under paper, so a lit face shows eyes and not two lamps */
const EYE_WHITE: SlotMat = { albedo: [0.46, 0.445, 0.42], rough: 0.25, spec: 1.0, soak: 0, grime: 0, wear: 0 };
const SKIN_B: Vec3[] = [[0.31, 0.19, 0.125], [0.36, 0.225, 0.15], [0.26, 0.155, 0.1], [0.4, 0.26, 0.18]];

/** THE MATERIAL TABLES. Operators: one dark issue, hard kit that takes a highlight, the marking (helmet band, brassards: the models' `accent` faces, shaded as the `cloth_plain` row) in the pair's colour. Defenders: irregulars — each man's
 *  shirt, trousers and head his own out of a short list, mid-value and warm, soft worn finishes, the ground on his boots and cuffs. Civilians: the level's two
 *  colours as shirt and trousers. Edit a row and it is live next frame (`__charmat.bump()` if edited from the console). */
export const CHAR_MATS: Record<CharSide, SideTable> = {
  operator: {
    slots: {
      skin:          { pick: SKIN_A, rough: 0.48, spec: 0.7, soak: 0.12, grime: 0, wear: 0.5 },
      cloth_uniform: { src: 'tint', k: 1.0, albedo: SUIT, mix: 0.5, rough: 0.65, spec: 0.22, soak: 1, grime: 0.5, wear: 1 },   // ONE issue: each man's suit tint pulled half way to the same dark neutral (a maroon suit read as a defender's red jacket from above); mix 0 = his tint as it is
      cloth_plain:   { src: 'tint2', k: 1.0, rough: 0.6, spec: 0.3, soak: 0.8, grime: 0, wear: 0.6 },   // the MARKING's row: the models put the helmet band and the arm brassards on `accent`, which reads this row (`as`); tint2 is the pair's colour
      webbing:       { src: 'tint', k: 0.9, albedo: [0.115, 0.1, 0.07], mix: 0.8, rough: 0.56, spec: 0.4, soak: 0.7, grime: 0.2, wear: 0.9 },
      boot:          { albedo: [0.032, 0.028, 0.025], rough: 0.4, spec: 0.9, soak: 0.3, grime: 0.8, wear: 0.7 },
      helmet:        { src: 'tint', k: 1.1, albedo: [0.07, 0.075, 0.055], mix: 0.75, rough: 0.46, spec: 0.8, soak: 0.05, grime: 0, wear: 0.8 },
      metal_dark:    { albedo: [0.024, 0.024, 0.027], rough: 0.3, spec: 1.3, metal: 1, soak: 0, grime: 0.2, wear: 1 },
      rubber:        { albedo: [0.018, 0.018, 0.018], rough: 0.6, spec: 0.5, soak: 0.05, grime: 0.9, wear: 0.4 },
      lens:          { albedo: [0.008, 0.011, 0.014], rough: 0.1, spec: 2, soak: 0, grime: 0, wear: 0 },
      accent:        { as: 'cloth_plain' },
      eye:           { ...EYE_WHITE },
    },
    grime: { color: [0.16, 0.14, 0.11], height: 0.06, band: 0.16, k: 0.45 }, cavity: 0.4, ridge: 0.3,
    standIn: { cloth_plain: 'cloth_uniform', accent: 'cloth_plain' },
  },
  defender: {
    slots: {
      skin:          { pick: SKIN_B, rough: 0.5, spec: 0.7, soak: 0.12, grime: 0.1, wear: 0.5 },
      cloth_uniform: { pick: [[0.13, 0.14, 0.08], [0.14, 0.16, 0.19], [0.3, 0.26, 0.18], [0.1, 0.075, 0.055], [0.2, 0.21, 0.17]], rough: 0.65, spec: 0.16, soak: 1, grime: 1, wear: 1 },   // (the denim is washed toward grey: blue is the squad's)
      cloth_plain:   { src: 'tint', k: 1.0, pick: SHIRTS, mix: 0.85, rough: 0.65, spec: 0.16, soak: 1, grime: 0.5, wear: 1 },
      webbing:       { albedo: [0.12, 0.13, 0.08], rough: 0.64, spec: 0.2, soak: 0.9, grime: 0.4, wear: 1 },   // (olive canvas: a tan rig over a bare-armed man read as a bare chest)
      boot:          { albedo: [0.085, 0.06, 0.042], rough: 0.58, spec: 0.35, soak: 0.5, grime: 1, wear: 1 },
      helmet:        { pick: HATS, rough: 0.6, spec: 0.45, soak: 0.6, grime: 0, wear: 0.6 },
      metal_dark:    { albedo: [0.03, 0.028, 0.027], rough: 0.36, spec: 1.1, metal: 1, soak: 0, grime: 0.3, wear: 1 },
      rubber:        { pick: HAIR, rough: 0.65, spec: 0.12, soak: 0.05, grime: 1, wear: 0.5 },   // hair first (and a hat's band): matte, and not every head black. (Soles are on metal_dark: on this row a grey-haired man had grey soles.)
      lens:          { as: 'skin' },
      accent:        { pick: NATURALS, rough: 0.65, spec: 0.16, soak: 1, grime: 0.2, wear: 1 },   // the straw hat, the tee under an open jacket (dealt off the hats' list a straw hat came out blue; on the trousers' slot the tee made a one-piece)
      eye:           { ...EYE_WHITE },
    },
    grime: { color: [0.3, 0.245, 0.17], height: 0.08, band: 0.24, k: 0.6 }, cavity: 0.45, ridge: 0.4,   // boots and cuffs (from 0.2 m with a 0.4 m band the ramp began at the knee: every man's shins one tan)
    standIn: { accent: 'cloth_plain' },
  },
  // the staff side's TRAINED element (the QRF, the perimeter: Guard.trained) — one issue for all of them in TWO tones off the suit the level gives them (shirt its
  // tint, trousers its darker tint2), black rig and boots, a cap a shade under the shirt, no eye-pro and no pair marking: uniform and drilled, and still not the squad
  responder: {
    slots: {
      skin:          { pick: SKIN_B, rough: 0.5, spec: 0.7, soak: 0.12, grime: 0.05, wear: 0.5 },
      cloth_uniform: { src: 'tint2', k: 1.0, rough: 0.65, spec: 0.2, soak: 1, grime: 0.35, wear: 1 },                      // trousers: the suit's dark half
      cloth_plain:   { src: 'tint', k: 1.0, rough: 0.65, spec: 0.18, soak: 1, grime: 0.2, wear: 1 },                            // the duty shirt: the suit itself (shirt, trousers, rig and cap all off one tint read as a man cast in one grey)
      webbing:       { albedo: [0.022, 0.022, 0.024], rough: 0.55, spec: 0.45, soak: 0.7, grime: 0.3, wear: 1 },                   // black nylon over the lighter shirt
      boot:          { albedo: [0.022, 0.02, 0.019], rough: 0.45, spec: 0.7, soak: 0.4, grime: 0.25, wear: 0.9 },                    // kept boots: at 0.6 of the floor's dust black leather went brown
      helmet:        { src: 'tint', k: 0.75, rough: 0.55, spec: 0.5, soak: 0.3, grime: 0, wear: 0.7 },                              // the issue cap: the shirt's colour a shade down (a BLACK cap was one mass with the hair under it)
      metal_dark:    { albedo: [0.028, 0.027, 0.028], rough: 0.34, spec: 1.2, metal: 1, soak: 0, grime: 0.2, wear: 1 },
      rubber:        { albedo: [0.02, 0.019, 0.019], rough: 0.65, spec: 0.2, soak: 0.05, grime: 1, wear: 0.5 },
      lens:          { as: 'skin' },
      accent:        { albedo: [0.62, 0.63, 0.6], rough: 0.55, spec: 0.3, soak: 0.2, grime: 0, wear: 0.3 },   // the element's WHITE MARK: a disc on the helmet's crown, a bar across the back of the vest (black vest, grey helmet, dark shirt were one mass from above). The duty shirt's tie is on this slot too and is wholly under the vest
      eye:           { ...EYE_WHITE },
    },
    grime: { color: [0.2, 0.175, 0.135], height: 0.08, band: 0.2, k: 0.55 }, cavity: 0.42, ridge: 0.32,
    standIn: { accent: 'cloth_plain' },
  },
  civilian: {
    slots: {
      skin:          { pick: SKIN_B, rough: 0.5, spec: 0.7, soak: 0.12, grime: 0, wear: 0.5 },
      cloth_uniform: { src: 'tint2', k: 1.0, rough: 0.65, spec: 0.16, soak: 1, grime: 0.4, wear: 1 },
      cloth_plain:   { src: 'tint', k: 1.0, rough: 0.65, spec: 0.16, soak: 1, grime: 0.1, wear: 1 },
      webbing:       { as: 'cloth_plain' },
      boot:          { albedo: [0.04, 0.032, 0.028], rough: 0.5, spec: 0.6, soak: 0.4, grime: 0.6, wear: 0.8 },
      helmet:        { pick: [[0.02, 0.018, 0.016], [0.05, 0.034, 0.024], [0.11, 0.08, 0.05], [0.2, 0.19, 0.18]], rough: 0.6, spec: 0.45, soak: 0.6, grime: 0, wear: 0.6 },
      metal_dark:    { albedo: [0.03, 0.028, 0.027], rough: 0.36, spec: 1.1, metal: 1, soak: 0, grime: 0.2, wear: 1 },
      rubber:        { pick: HAIR, rough: 0.65, spec: 0.12, soak: 0.05, grime: 0.8, wear: 0.5 },
      lens:          { as: 'skin' },
      accent:        { pick: [[0.64, 0.61, 0.5], [0.06, 0.06, 0.075]], rough: 0.5, spec: 0.3, soak: 1, grime: 0, wear: 0.6 },   // TWO things, dealt by the same id parity the cast deals its two civilians by (cast.ts castVariantOf: list[id % 2]; pickIndex's start for this slot and a list of two is 0): an even id is the cleaner, whose APRON is pale cotton (her kerchief is on cloth_plain = the tunic's own colour: pale, it read as the response team's white crown mark from above); an odd id the office worker, whose TIE is dark. A third civilian variant wants this row rethought
      eye:           { ...EYE_WHITE },
    },
    grime: { color: [0.2, 0.17, 0.13], height: 0.04, band: 0.12, k: 0.15 }, cavity: 0.4, ridge: 0.3,
    standIn: { accent: 'cloth_plain' },
  },
};
/** THE LOOK'S TABLES (scene/look.ts LOOK, 2010s GWOT; the meshes are cast-gwot.gltf, tools/chars/README.md 'The look'): a SECOND set of rows for the two sides the look
 *  re-dresses, read in place of CHAR_MATS' while the switch is on (charMatsOf). The responders' and the civilians' rows are CHAR_MATS' own under either look.
 *  Flat colours, as ever: a camouflage pattern is its AVERAGE (a khaki-olive tan), never a texture.
 *  OPERATORS: one tan-and-olive issue (each man's suit tint keeps a fifth of the cloth, so the loadout's uniform and the pairs' warm / cool suits still tell), a
 *  ranger-green carrier, pouches, belt and packs and a ranger-green helmet on it, coyote boots, tan-brown gloves and pads; the MARKING is the pair's colour dusted with
 *  a fifth of the suit's cloth (a panel on the crown, a short band behind it, a patch on each deltoid).
 *  DEFENDERS, in local dress: the long shirt and its trousers are ONE cloth (the models put both on `cloth_plain`) out of eleven: pale off-whites and dark browns, a
 *  few greys, dusty blues and olives — NO warm cloth within 0.6 of a stop of the look's ground (mud brick, about [0.45, 0.36, 0.24], luminance 0.37: a warm suit is
 *  over 0.55 or under 0.24, charmats-probes.ts holds it), and nothing on a head or a shoulder with green or blue its top channel or saturated (the pairs' markings); the waistcoat (`cloth_uniform`) a dark cloth of its own; a wool cap (`helmet`) in wool's naturals; wound and sewn head cloth, turban and skull cap
 *  (`accent`), pale or grey; a scarf or a shawl (`lens`: a slot the defenders never wore glass on) in checked cotton's grey and wool's browns; khaki canvas for the
 *  chest rig. NO saturated red, blue or green here either (the pairs' and Sam's), and no black head cloth. */
const MULTICAM: Vec3 = [0.25, 0.225, 0.15];
const SUITS: Vec3[] = [[0.6, 0.57, 0.5], [0.25, 0.2, 0.14], [0.58, 0.56, 0.51], [0.3, 0.36, 0.42], [0.62, 0.58, 0.49], [0.22, 0.17, 0.12], [0.3, 0.3, 0.22], [0.27, 0.21, 0.155], [0.24, 0.27, 0.31], [0.64, 0.59, 0.49], [0.27, 0.28, 0.22]];
const WAISTCOATS: Vec3[] = [[0.085, 0.07, 0.055], [0.065, 0.07, 0.075], [0.115, 0.12, 0.085], [0.15, 0.11, 0.07], [0.075, 0.06, 0.05]];
const WOOL_CAPS: Vec3[] = [[0.2, 0.15, 0.1], [0.15, 0.115, 0.08], [0.235, 0.23, 0.215], [0.13, 0.11, 0.09], [0.105, 0.095, 0.085]];
const HEAD_CLOTH: Vec3[] = [[0.7, 0.68, 0.62], [0.14, 0.125, 0.11], [0.21, 0.21, 0.21], [0.72, 0.7, 0.67], [0.38, 0.36, 0.32]];
const WRAPS: Vec3[] = [[0.17, 0.135, 0.1], [0.33, 0.31, 0.28], [0.2, 0.18, 0.12], [0.62, 0.59, 0.52], [0.3, 0.24, 0.17], [0.22, 0.16, 0.1]];
export const CHAR_MATS_LOOK: Partial<Record<CharSide, SideTable>> = {
  operator: {
    slots: {
      skin:          { pick: SKIN_A, rough: 0.48, spec: 0.7, soak: 0.12, grime: 0, wear: 0.5 },
      cloth_uniform: { src: 'tint', k: 1.0, albedo: MULTICAM, mix: 0.8, rough: 0.65, spec: 0.2, soak: 1, grime: 0.6, wear: 1 },
      cloth_plain:   { src: 'tint2', k: 0.8, albedo: MULTICAM, mix: 0.2, rough: 0.6, spec: 0.3, soak: 0.8, grime: 0, wear: 0.6 },   // the MARKING's row: the pair's colour as a dusty tape (a fifth of the suit's cloth in it)
      webbing:       { albedo: [0.085, 0.092, 0.06], rough: 0.58, spec: 0.35, soak: 0.7, grime: 0.3, wear: 0.9 },   // ranger green: the carrier, its pouches, the belt, the packs (it was coyote: with the suit and the boots, one brown lump)
      boot:          { albedo: [0.165, 0.112, 0.068], rough: 0.6, spec: 0.3, soak: 0.5, grime: 0.9, wear: 0.9 },   // rough-out desert boots
      helmet:        { albedo: [0.076, 0.085, 0.053], rough: 0.5, spec: 0.7, soak: 0.05, grime: 0, wear: 0.8 },   // ranger green: the one green-grey block on a tan man, and no cap or cloth of the other side's
      metal_dark:    { albedo: [0.026, 0.026, 0.028], rough: 0.32, spec: 1.3, metal: 1, soak: 0, grime: 0.3, wear: 1 },
      rubber:        { albedo: [0.075, 0.065, 0.045], rough: 0.6, spec: 0.45, soak: 0.05, grime: 0.9, wear: 0.4 },   // gloves and knee pads in tan-brown, not black — and with them, on this slot: the ear cups and the boom, his hair and moustache, the lead's handset, the slick kit's drinking tube (soles are metal_dark's)
      lens:          { albedo: [0.008, 0.011, 0.014], rough: 0.1, spec: 2, soak: 0, grime: 0, wear: 0 },
      accent:        { as: 'cloth_plain' },
      eye:           { ...EYE_WHITE },
    },
    grime: { color: [0.3, 0.25, 0.18], height: 0.08, band: 0.22, k: 0.5 }, cavity: 0.42, ridge: 0.3,
    standIn: { cloth_plain: 'cloth_uniform', accent: 'cloth_plain' },
  },
  defender: {
    slots: {
      skin:          { pick: SKIN_B, rough: 0.5, spec: 0.7, soak: 0.12, grime: 0.15, wear: 0.5 },
      cloth_uniform: { pick: WAISTCOATS, rough: 0.65, spec: 0.16, soak: 1, grime: 0.3, wear: 1 },                     // the waistcoat
      cloth_plain:   { src: 'tint', k: 1.0, pick: SUITS, mix: 0.88, rough: 0.65, spec: 0.14, soak: 1, grime: 0.8, wear: 1 },   // the long shirt and its trousers: one cloth
      webbing:       { albedo: [0.13, 0.12, 0.07], rough: 0.64, spec: 0.2, soak: 0.9, grime: 0.4, wear: 1 },   // olive-drab canvas: the chest rig
      boot:          { albedo: [0.07, 0.05, 0.035], rough: 0.58, spec: 0.35, soak: 0.5, grime: 1, wear: 1 },
      helmet:        { pick: WOOL_CAPS, rough: 0.65, spec: 0.12, soak: 0.8, grime: 0, wear: 0.7 },                     // the rolled wool cap
      metal_dark:    { albedo: [0.03, 0.028, 0.027], rough: 0.36, spec: 1.1, metal: 1, soak: 0, grime: 0.3, wear: 1 },
      rubber:        { pick: HAIR, rough: 0.65, spec: 0.12, soak: 0.05, grime: 1, wear: 0.5 },                         // hair and beard, one colour to a man
      lens:          { pick: WRAPS, rough: 0.65, spec: 0.14, soak: 1, grime: 0.1, wear: 1 },                           // a scarf round the neck, a shawl over the shoulder
      accent:        { pick: HEAD_CLOTH, rough: 0.65, spec: 0.14, soak: 1, grime: 0, wear: 0.9 },                      // a turban, a skull cap
      eye:           { ...EYE_WHITE },
    },
    grime: { color: [0.33, 0.275, 0.195], height: 0.1, band: 0.3, k: 0.6 }, cavity: 0.45, ridge: 0.4,
    standIn: { accent: 'cloth_plain', lens: 'skin' },
  },
};
/** THE SNEAKING SUIT (scene/look.ts LOOK.suit; who wears it and when: game/cast.ts sneakSuit — Sam, and a quiet mission's partner, on a mission that is not a squad's
 *  loud one): an operator's THIRD set of rows. The cast has no part of its own for it (32 of 32 are dealt), so it is the operator's own suit part — uniform, vest and
 *  boots — drawn without the helmet and the back kit (cast.ts castParts) and shaded here as one matt black: cloth, rig, boots and gloves within a third of a stop of
 *  each other, the rig told from the cloth by its finish alone (harder, a little glossier), so under a lamp he reads as a man in a suit with a harness and in the
 *  dark as a shape. The marking keeps a sixth of the pair's colour (a partner is told from Sam by a dim patch on each shoulder); the kit card's suit colour keeps a
 *  fourteenth of the cloth (a cast to the black, never a colour). Little of the ground's dust: the look's tan dust on black boots read as tan boots. */
const SNEAK: Vec3 = [0.032, 0.034, 0.04];
export const SNEAK_SUIT: SideTable = {
  slots: {
    skin:          { pick: SKIN_A, rough: 0.48, spec: 0.7, soak: 0.12, grime: 0, wear: 0.5 },
    cloth_uniform: { src: 'tint', k: 1.0, albedo: SNEAK, mix: 0.93, rough: 0.62, spec: 0.3, soak: 1, grime: 0.3, wear: 0.6 },   // (0.93: a kit card's desert-tan suit at 0.85 was a warm grey-brown a stop and a half over its own harness)
    cloth_plain:   { src: 'tint2', k: 0.3, albedo: SNEAK, mix: 0.5, rough: 0.6, spec: 0.3, soak: 0.8, grime: 0, wear: 0.5 },   // the marking, dimmed: a sixth of the pair's colour over the black (at a third it was the brightest thing on him)
    webbing:       { albedo: [0.024, 0.025, 0.028], rough: 0.5, spec: 0.5, soak: 0.7, grime: 0.15, wear: 0.9 },
    boot:          { albedo: [0.02, 0.02, 0.021], rough: 0.45, spec: 0.65, soak: 0.4, grime: 0.3, wear: 0.9 },
    helmet:        { as: 'webbing' },   // (not worn; the mannequin's stand-in reads it)
    metal_dark:    { albedo: [0.026, 0.026, 0.028], rough: 0.32, spec: 1.3, metal: 1, soak: 0, grime: 0.2, wear: 1 },
    rubber:        { albedo: [0.02, 0.019, 0.019], rough: 0.62, spec: 0.25, soak: 0.05, grime: 0.4, wear: 0.4 },   // black gloves and pads — and his hair, which this slot also carries
    lens:          { albedo: [0.008, 0.011, 0.014], rough: 0.1, spec: 2, soak: 0, grime: 0, wear: 0 },
    accent:        { as: 'cloth_plain' },
    eye:           { ...EYE_WHITE },
  },
  grime: { color: [0.2, 0.175, 0.135], height: 0.06, band: 0.16, k: 0.3 }, cavity: 0.42, ridge: 0.3,
  standIn: { cloth_plain: 'cloth_uniform', accent: 'cloth_plain' },
};
/** the table a side is drawn from NOW: the look's while its switch is on and it has one for the side, else CHAR_MATS' — and for an operator in the sneaking suit
 *  (`suit`: the caller's word, game/cast.ts sneakSuit) the suit's */
export function charMatsOf(side: CharSide, suit = false): SideTable { return suit && side === 'operator' ? SNEAK_SUIT : (lookDress() && CHAR_MATS_LOOK[side]) || CHAR_MATS[side]; }
/** the tables as shipped (the panel's reset; `resetCharMats`) */
const SHIPPED = JSON.stringify(CHAR_MATS), SHIPPED_LOOK = JSON.stringify(CHAR_MATS_LOOK), SHIPPED_SUIT = JSON.stringify(SNEAK_SUIT);
/** one slot's material on a side, `as` rows followed (≤ 3 hops; a loop or a chain past that lands on the last row reached, shaded as plain cloth numbers) */
function resolveSlot(T: SideTable, slot: CharSlot, standIn = false): { name: CharSlot; m: SlotMat } {
  let name = (standIn && T.standIn?.[slot]) || slot; let row = T.slots[name];
  for (let hop = 0; 'as' in row && hop < 3; hop++) { name = row.as; row = T.slots[name]; }
  return { name, m: 'as' in row ? { albedo: [0.2, 0.2, 0.2], rough: 0.65, spec: 0.16, soak: 1, grime: 0.3, wear: 1 } : row };
}
/** THE PLACEHOLDER'S TWO COLOURS for a man of the cast (gbuffer.wgsl slotAlbedo, what `?nocharmats` draws: cloth_uniform takes the instance's FIRST colour — the webbing and
 *  the headgear mix some of it in — and cloth_plain and accent take its SECOND). cloth_uniform and cloth_plain are each handed the tint this side's TABLE reads for that slot
 *  (`src`), so a man's shirt and trousers keep the level's colours whether the tables are on or off. What the placeholder does NOT follow: `accent` always takes the second
 *  colour whatever its row reads (off, a tie is the shirt's colour and a straw hat or a tee the top's), and a row's `mix` (off, an operator's suit is his raw tint, not the
 *  tint pulled toward SUIT). An operator's uniform takes his tint and his marking his tint2, as they stand; a civilian's or an irregular's
 *  top his tint and his trousers his tint2 — the other way round (their tints mean top then trousers: scene/level.ts CivilianDef, guards.ts spawnUnit). A slot whose row reads
 *  neither tint (a pick, a fixed colour) takes the tint the other slot does not.
 *  → bits: 1 = the first colour is tint2 (else tint), 2 = the second is tint2 (else tint). TINTS_AS_IS (tint, then tint2) is the mannequin's and every operator's. */
export const TINTS_AS_IS = 2;
const orderOf = new Map<CharSide, { ver: number; bits: number }>();
export function placeholderTints(side: CharSide): number {
  const ver = charMatsVersion(); const hit = orderOf.get(side); if (hit && hit.ver === ver) return hit.bits;
  const u = resolveSlot(charMatsOf(side), 'cloth_uniform').m.src, p = resolveSlot(charMatsOf(side), 'cloth_plain').m.src;
  const first = u ?? (p === 'tint' ? 'tint2' : 'tint'), second = p ?? (u === 'tint2' ? 'tint' : 'tint2');
  const bits = (first === 'tint2' ? 1 : 0) | (second === 'tint2' ? 2 : 0); orderOf.set(side, { ver, bits }); return bits;
}
/** which of a slot's `pick` colours a man wears (−1: the slot has no list on his side) — the probes' handle on the motley */
export function slotPick(side: CharSide, slot: CharSlot, id: number, standIn = false): number {
  const { name, m } = resolveSlot(charMatsOf(side), slot, standIn); return m.pick?.length ? pickIndex(id, SLOT_ID[name], m.pick.length) : -1;
}
export function resetCharMats() { const s = JSON.parse(SHIPPED) as typeof CHAR_MATS; for (const k of Object.keys(s) as CharSide[]) CHAR_MATS[k] = s[k]; const l = JSON.parse(SHIPPED_LOOK) as typeof CHAR_MATS_LOOK; for (const k of Object.keys(l) as CharSide[]) CHAR_MATS_LOOK[k] = l[k]; Object.assign(SNEAK_SUIT, JSON.parse(SHIPPED_SUIT) as SideTable); matsVersion++; }
/** bumped whenever a table is edited by a tool, so cached palettes are rebuilt (bumpCharMats) */
let matsVersion = 1;
export function bumpCharMats() { matsVersion++; }
export function charMatsVersion() { return matsVersion * 2 + (lookDress() ? 1 : 0); }   // (the look switch is part of the version: a palette cached under one look is rebuilt under the other)

/** a stable per-man die for slot `salt` (never Math.random: the same man wears the same shirt every boot, in the harness and in the page) */
function die(id: number, salt: number): number { let h = (Math.imul(id | 0, 0x9E3779B1) ^ Math.imul(salt + 1, 0x85EBCA6B)) >>> 0; h ^= h >>> 15; h = Math.imul(h, 0x2C1B3C6D); h ^= h >>> 12; h = Math.imul(h, 0x297A2D39); h ^= h >>> 15; return (h >>> 0) / 4294967296; }

/** which of a list of `n` a man takes: a WALK through the list by id from a per-slot start, so men with neighbouring ids (a squad, a shift) never wear the same
 *  one while the list lasts — a hash per man gave two of three guards the same shirt */
const pickIndex = (id: number, salt: number, n: number) => (((id | 0) + Math.floor(die(0x51ED, salt) * n)) % n + n) % n;
const lobeRough = (r: number) => Math.max(0.03, Math.min(0.65, r));
/** the lobe's gain for a slot: composite's coat is a 2 % (water) Fresnel × gain, so a dielectric's 4 % is gain 2 × spec ½ … `spec` 1 → 2.0 is its ceiling;
 *  written so the table reads in dielectric units (spec 1 = 4 %) and `metal` buys the last of the headroom */
const lobeGain = (m: SlotMat) => Math.max(0, Math.min(2, m.spec * (1 + 0.5 * (m.metal ?? 0))));

/** A man's resolved slot colour (before grime / cavity, which the shader does per pixel). */
export function slotAlbedo(side: CharSide, slot: CharSlot, tint: Vec3, tint2: Vec3, id: number, standIn = false, suit = false): Vec3 {
  const { name, m } = resolveSlot(charMatsOf(side, suit), slot, standIn);
  const salt = SLOT_ID[name];
  let c: Vec3 | null = m.src ? (m.src === 'tint' ? tint : tint2).map(x => x * (m.k ?? 1)) as Vec3 : null;
  const fixed: Vec3 | null = m.pick?.length ? m.pick[pickIndex(id, salt, m.pick.length)] : m.albedo ?? null;
  if (c && fixed) { const k = m.mix ?? 0.5; c = [c[0] + (fixed[0] - c[0]) * k, c[1] + (fixed[1] - c[1]) * k, c[2] + (fixed[2] - c[2]) * k]; }
  else if (!c) c = fixed ? [fixed[0], fixed[1], fixed[2]] : [0.2, 0.2, 0.2];
  if (m.pick?.length) { const j = 0.88 + 0.24 * die(id, salt + 16); c = [c[0] * j, c[1] * j, c[2] * j]; }   // and no two men's the same value
  return [Math.min(1, Math.max(0, c[0])), Math.min(1, Math.max(0, c[1])), Math.min(1, Math.max(0, c[2]))];
}

/** Write a man's CHAR_MAT_ROWS rows at float offset `o` of `out` (anim/characters.ts setMaterials): H0 = (1 = on, grime height, grime band, crease
 *  darkening) · H1 = (grime rgb × its strength folded into the slots' own, ridge lightening) · per slot A = (albedo, lobe roughness), B = (lobe gain, soak,
 *  grime, wear). `standIn` = the mesh is the mannequin split by joint (CharSlotData.authored false): the side's `standIn` remap applies. `suit` = an operator in
 *  the sneaking suit (charMatsOf). */
export function writeCharPalette(out: Float32Array, o: number, side: CharSide, tint: Vec3, tint2: Vec3, id: number, standIn = false, suit = false) {
  const T = charMatsOf(side, suit);
  out[o] = 1; out[o + 1] = T.grime.height; out[o + 2] = Math.max(T.grime.band, 0.01); out[o + 3] = T.cavity;
  out[o + 4] = T.grime.color[0]; out[o + 5] = T.grime.color[1]; out[o + 6] = T.grime.color[2]; out[o + 7] = T.ridge;
  for (let s = 0; s < CHAR_SLOT_COUNT; s++) {
    const name = CHAR_SLOTS[s]; const { m } = resolveSlot(T, name, standIn);
    const c = slotAlbedo(side, name, tint, tint2, id, standIn, suit); const p = o + 8 + s * 8;
    out[p] = c[0]; out[p + 1] = c[1]; out[p + 2] = c[2]; out[p + 3] = lobeRough(m.rough);
    out[p + 4] = lobeGain(m); out[p + 5] = m.soak; out[p + 6] = m.grime * T.grime.k; out[p + 7] = m.wear;
  }
  out.fill(0, o + 8 + CHAR_SLOT_COUNT * 8, o + CHAR_MAT_FLOATS);
}

/** What secondary hits see of him: one colour per shadow proxy (Character.capsules() order) = the area-weighted mix of the slots that proxy carries, with the
 *  ground's dust on the shins and shoes; `wetK` = the coat's darkening (game.ts: 1 − 0.35 × wet), applied by each slot's `soak`; `whole` = record 0 carries
 *  the whole man's mix instead of his lower trunk's (see below); `mask` = the parts he wears, on a cast of part meshes. */
export function proxyAlbedos(sd: CharSlotData, pal: Float32Array, o: number, wetK = 1, whole = false, mask = 0): Vec3[] {
  const W = sd.weights(mask);
  const out: Vec3[] = []; const gr = [pal[o + 4], pal[o + 5], pal[o + 6]]; const tot = W.area.reduce((n, a) => n + a, 0) || 1;
  for (let p = 0; p < PROXIES; p++) {
    let r = 0, g = 0, b = 0; const low = p === 11 || p === 14 ? 1 : p === 10 || p === 13 ? 0.35 : 0;   // the shoes stand in the dust, the shins' lower third
    const all = whole && p === 0;   // record 0 is the ONE colour mesh hits and the smooth union read for the whole man (common.wgsl) — while either is live it carries all of him
    for (let s = 0; s < CHAR_SLOT_COUNT; s++) {
      const w = all ? W.area[s] / tot : W.capWeights[p * CHAR_SLOT_COUNT + s]; if (w <= 0) continue; const q = o + 8 + s * 8;
      const k = 1 - (1 - wetK) * pal[q + 5]; const gk = Math.min(1, pal[q + 6] * low) * 0.6;
      r += w * (pal[q] + (gr[0] - pal[q]) * gk) * k; g += w * (pal[q + 1] + (gr[1] - pal[q + 1]) * gk) * k; b += w * (pal[q + 2] + (gr[2] - pal[q + 2]) * gk) * k;
    }
    out.push([r, g, b]);
  }
  return out;
}

/** a man's rows as numbers a person can read (`__charmat.get`, the probes) */
export function describePalette(side: CharSide, tint: Vec3, tint2: Vec3, id: number, standIn = false, suit = false) {
  const f = new Float32Array(CHAR_MAT_FLOATS); writeCharPalette(f, 0, side, tint, tint2, id, standIn, suit); const r = (x: number) => Math.round(x * 1000) / 1000;
  const slot: Record<string, { albedo: number[]; rough: number; gain: number; soak: number; grime: number; wear: number }> = {};
  CHAR_SLOTS.forEach((n, s) => { const p = 8 + s * 8; slot[n] = { albedo: [r(f[p]), r(f[p + 1]), r(f[p + 2])], rough: r(f[p + 3]), gain: r(f[p + 4]), soak: r(f[p + 5]), grime: r(f[p + 6]), wear: r(f[p + 7]) }; });
  return { side, grime: { color: [r(f[4]), r(f[5]), r(f[6])], height: r(f[1]), band: r(f[2]) }, cavity: r(f[3]), ridge: r(f[7]), slot };
}
/** one line for the panel and the hooks */
export function charMatsSummary(ch: GltfCharacter, on: boolean): string {
  const d = cache.get(ch.mesh);   // (never solves it: the panel asks every time it draws, and the bake is only owed once somebody wears a table)
  if (!d) return `${on ? 'ON' : 'off (two tints)'} · ${meshAuthored(ch.mesh) ? 'slots from the mesh\'s materials' : 'STAND-IN: the mannequin split by joint'} · slot shares once it has been on`;
  const tot = d.area.reduce((n, a) => n + a, 0) || 1;
  const parts = CHAR_SLOTS.map((n, s) => d.area[s] > 0 ? `${n} ${Math.round(100 * d.area[s] / tot)}%` : '').filter(Boolean).join(' · ');
  return `${on ? 'ON' : 'off (two tints)'} · ${d.authored ? 'slots from the mesh\'s materials' : 'STAND-IN: the mannequin split by joint'} · ${parts}${d.unmatched.length ? ` · no slot for: ${d.unmatched.join(', ')}` : ''}`;
}
