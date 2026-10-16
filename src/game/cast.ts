// WHO WEARS WHAT — the cast (anim/gltf.ts loadGltfCast: the character mesh as PARTS, a VARIANT = the parts one man wears). The meshes say which variants exist and which side each is
// for; this says which man gets which, and it is the only place that does:
//   Sam                         the first operator variant
//   his side's AI (operative)   the other operator variants, by id (a four are four different men while the cast has four to give)
//   the staff and the hostiles  the defender variants, by id
//   the response element        the responder variants, by id (Guard.trained: the QRF and its perimeter tier — staff, but a drilled element in ONE outfit, neither the
//                               operators' kit nor the irregulars' hats; a cast with none: the defenders')
//   civilians and hostages      the civilian variants, by id (a cast with none: the defenders' — never an operator's kit)
// + THE GOGGLES: an operator variant lists `nvg_up` (a cast may also carry `nvg_down`; this one does not: it was never drawn), but whether a man has goggles, and whether they are down, is the GAME's to say (Sam's N key, nvg.ts for a
//   teammate) and the game already draws them: rigProps' goggle boxes (the issue kit's two dark tubes, or the old kit's three lit lenses: gear.ts). So castParts() takes both mesh goggles off a man the game draws goggles on (nothing
//   doubles), and leaves a man the game gives none the mesh pair flipped UP on his helmet mount — kit he carries, never down and dark over his eyes.
// Looks only: nothing in the simulation reads a variant (the CPU's hit capsules, the wet model and the ragdoll are the skeleton's), no dice are drawn, and with no cast loaded
// (the mannequin: `?mannequin`, the QA harness, the native host under `--mannequin` / `TPS_MANNEQUIN=1` or with a dylib that does not draw the cast) every man's mask is 0 and he is drawn exactly as he always was. The choice is taken once per Character, the
// first time the game knows his side.
import type { Game } from './game';
import type { Character } from './character';
import { castSide, castGoggles, castSuit, type CastVariant, type CastInfo } from '../anim/gltf';
import { LOOK, lookOffice, suitAs } from '../scene/look';   // (a leaf: no imports)
import { nvgWorn } from './nvg';
import { activeScenario, teamOf } from './scenarioRun';   // (called inside sneakSuit only)

const worn = new WeakMap<Character, CastVariant>();

/** DRESSED FOR A BUILDING (scene/look.ts lookOffice: the look on, on the office family — the maintainer: "middle eastern enemies also don't make sense for the
 *  office level"): of the first cast's defenders, the ones a night shift or the men holding an office floor could be — a cap, a shirt, a chest rig — and not the
 *  field's straw hat, boonie, bandana, bandolier or vest top. By part NAME, so a cast without those parts loses nobody; a cast left with nobody keeps them all. */
const FIELD_PARTS = ['hat_straw', 'hat_boonie', 'bandana', 'bandolier', 'tank_top'];
const fieldBits = new WeakMap<string[], number>();
export function officeDress(parts: string[], list: CastVariant[]): CastVariant[] {
  let bits = fieldBits.get(parts);
  if (bits === undefined) { bits = 0; parts.forEach((n, i) => { if (FIELD_PARTS.includes(n)) bits = (bits! | (1 << i)) >>> 0; }); fieldBits.set(parts, bits); }
  const keep = list.filter(v => (v.mask & bits!) === 0); return keep.length ? keep : list;
}

/** THE TEAMMATE AT A PLACE OF THE ROSTER (0 = the first teammate; Sam is the first operator and never dealt here): the one rule the game and the kit screen's
 *  figure (ui/kitFigure.ts) both ask, so the man on the Team & kit step is the man the mission stands up. */
export function operatorAt(cast: CastInfo, place: number): CastVariant | null {
  const ops = castSide(cast, 'operator'); if (!ops.length) return null;
  return ops.length > 1 ? ops[1 + place % (ops.length - 1)] : ops[0];
}

/** the variant this man wears (null with no cast loaded) */
export function castVariantOf(g: Game, c: Character): CastVariant | null {
  const cast = c.ch.cast; if (!cast) return null;
  const had = worn.get(c); if (had) return had;
  const ops = castSide(cast, 'operator');
  if (c === g.player.char) { worn.set(c, ops[0]); return ops[0]; }
  const rec = g.guards.find(x => x.char === c) ?? g.civilians.find(x => x.char === c);
  const pick = (list: CastVariant[], skip = 0) => list.length > skip ? list[skip + c.id % (list.length - skip)] : list[c.id % list.length];
  const defenders = () => { const d = castSide(cast, 'defender'); return lookOffice() ? officeDress(cast.parts, d) : d; };
  if (!rec) return pick(defenders());   // (a body the game holds no record of this frame: dressed as the staff, and asked again next frame)
  const trained = rec.trained && rec.team === 'guard';
  // a teammate by his PLACE among the team as staged, not by his id: a rescue stands its captors up first, which moved every teammate's id — and so his face —
  // by their count (three on the office and the registry, six on the consulate). A show's cast keeps the deal by id its beats were looked at with.
  const place = rec.team === 'operative' && rec.unit && !g.touring ? g.guards.filter(x => x.unit && x.team === 'operative').indexOf(rec) : -1;
  const v = place >= 0 ? operatorAt(cast, place)! : rec.team === 'operative' ? pick(ops, 1) : rec.team === 'civilian' ? pick(cast.variants.some(x => x.side === 'civilian') ? castSide(cast, 'civilian') : defenders())
    : pick(trained ? castSide(cast, 'responder') : defenders());
  if (!rec.unit || trained || rec.team !== 'guard') worn.set(c, v);   // (a staff-side unit is asked again until he is `trained`: qrf.ts sets that a statement after it spawns him)
  return v;
}
const hasNvg = new WeakMap<CastVariant, boolean>();
/** THE SNEAKING SUIT (scene/look.ts LOOK.suit; the maintainer, 10-10: "sam should also be in a black sneaking suit in stealth missions (probs not loud ones)"): who is
 *  drawn in it THIS frame — under the default look, on a mission that is not a squad's loud one (a quiet mission; the plain night, its showcase with it), Sam, and on a
 *  quiet mission as two his partner (a pair in two dresses read as two sides from above). Asked every frame, so a mission started or quit on a running page re-dresses
 *  him. What it is: his own variant less the helmet and the back kit (castParts below), in the suit's own material rows (charLook.ts → render/charMaterials.ts SNEAK_SUIT).
 *  A host staging a PICTURE may say which mission the men are dressed for instead (scene/look.ts setSuitAs: the Team & kit picture of a quiet mission, staged as a
 *  room clear); nothing in play says it. Looks only, like everything in this file. */
export function sneakSuit(g: Game, c: Character): boolean {
  if (!LOOK.on || !LOOK.suit) return false;
  const asked = suitAs(), k = asked !== undefined ? asked : activeScenario(g); if (k && k !== 'quiet') return false;   // (a squad's loud mission — and any kind added later, until it says otherwise: the issue dress, helmet and plates)
  return c === g.player.char || (k === 'quiet' && teamOf(g).some(gd => gd.char === c));
}
/** the part mask to DRAW this man with this frame (0 with no cast loaded): his variant's, with the goggles as the game has them (the head comment; anim/gltf.ts castGoggles)
 *  — and, in the sneaking suit, without the helmet, the back kit and the mesh goggles (anim/gltf.ts castSuit) */
export function castParts(g: Game, c: Character): number {
  const v = castVariantOf(g, c); if (!v) return 0;
  const cast = c.ch.cast!;
  if (sneakSuit(g, c)) return castSuit(cast, v.mask);
  let has = hasNvg.get(v);
  if (has === undefined) hasNvg.set(v, has = castGoggles(cast, v.mask, true) !== v.mask);
  if (!has) return v.mask;                              // (a variant without goggles: a defender, a civilian)
  let boxes = c === g.player.char;                      // combat.ts handProps: Sam always wears the box goggles; a teammate when nvg.ts says he wears a pair
  if (!boxes) { const gd = g.guards.find(x => x.char === c); boxes = !!gd && nvgWorn(g, gd); }
  return castGoggles(cast, v.mask, boxes);
}
/** put a variant on a man by name (the viewer, the console: __cast.wear) — false when the cast has none by that name */
export function castWear(c: Character, name: string): boolean {
  const v = c.ch.cast?.variants.find(x => x.name === name); if (!v) return false;
  worn.set(c, v); c.parts = v.mask; return true;
}
