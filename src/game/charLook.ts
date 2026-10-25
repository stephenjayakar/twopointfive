// CHARACTER MATERIALS, the game's side (render/charMaterials.ts has the slots, the tables and the packing): which TABLE each man on the floor wears — the squad and
// Sam the operators', the shift / the cell the defenders', the staff side's trained element (the QRF) the responders', everybody else the civilians' — and his
// resolved rows + proxy colours, cached on the man until his tints, his side, his coat or a table change (a steady frame allocates nothing here).
// One call a frame from game.ts's draw block, and only while settings.charMats is up: off, nothing here runs and every man is his two tints as ever.
import { SideMap } from '../math/side';
import type { Game } from './game';
import type { Character } from './character';
import type { Team } from './teams';
import type { Vec3 } from '../math/vec';
import { sneakSuit, castVariantOf } from './cast';   // (called inside charSides only)
export { sneakSuit };   // (who is in the sneaking suit: the console's __charmat.get reads it beside sideOfTeam)
import { CHAR_MAT_FLOATS, CharSide, CharSlotData, charMatsVersion, charSlots, proxyAlbedos, writeCharPalette } from '../render/charMaterials';

export function sideOfTeam(team: Team, trained = false): CharSide {
  return team === 'operative' || team === 'player' ? 'operator' : team === 'civilian' ? 'civilian' : trained ? 'responder' : 'defender';
}

interface Look { ver: number; side: CharSide | null; suit: boolean; t: number[]; pal: Float32Array; prox: Vec3[] | null; proxWet: number; proxWhole: boolean; proxMask: number }
const looks = new SideMap<Character, Look>('charLook.looks');
const sides = new SideMap<Character, CharSide>('charLook.sides');
/** the men drawn in the sneaking suit this frame (game/cast.ts sneakSuit): an operator's second set of rows */
const suits = new SideMap<Character, boolean>('charLook.suits');

export interface CharLookFrame {
  /** the man's CHAR_MAT_FLOATS rows (anim/characters.ts setMaterials) */
  palette(c: Character): Float32Array;
  /** one colour per shadow proxy for scene/boxes.ts addCharacterCapsules; wetK = the coat's darkening, whole = record 0 carries all of him (mesh hits) */
  proxies(c: Character, wetK: number, whole: boolean): Vec3[];
  side(c: Character): CharSide;
}

let sd: CharSlotData; let ver = 0;
function lookOf(c: Character): Look {
  const s = sides.get(c) ?? 'defender', u = suits.get(c) ?? false; let L = looks.get(c);
  if (!L) { L = { ver: -1, side: null, suit: false, t: [NaN, 0, 0, 0, 0, 0], pal: new Float32Array(CHAR_MAT_FLOATS), prox: null, proxWet: 1, proxWhole: false, proxMask: 0 }; looks.set(c, L); }
  const t = L.t, a = c.tint, b = c.tint2;
  if (L.ver !== ver || L.side !== s || L.suit !== u || t[0] !== a[0] || t[1] !== a[1] || t[2] !== a[2] || t[3] !== b[0] || t[4] !== b[1] || t[5] !== b[2]) {
    L.ver = ver; L.side = s; L.suit = u; t[0] = a[0]; t[1] = a[1]; t[2] = a[2]; t[3] = b[0]; t[4] = b[1]; t[5] = b[2]; L.prox = null;
    writeCharPalette(L.pal, 0, s, a, b, c.id, !sd.authored, u);
  }
  return L;
}
const FRAME: CharLookFrame = {
  palette: c => lookOf(c).pal,
  side: c => sides.get(c) ?? 'defender',
  proxies: (c, wetK, whole) => {
    const L = lookOf(c); const mask = (c as Character & { parts?: number }).parts ?? 0;   // (the parts he wears, where the mesh is a cast of part meshes — the models' Character.parts)
    if (!L.prox || L.proxWet !== wetK || L.proxWhole !== whole || L.proxMask !== mask) { L.prox = proxyAlbedos(sd, L.pal, 0, wetK, whole, mask); L.proxWet = wetK; L.proxWhole = whole; L.proxMask = mask; }
    return L.prox;
  },
};

/** Every man's SIDE this frame — whose table he wears, and (render/charMaterials.ts placeholderTints) which way round the cast's placeholder takes his two tints with the
 *  tables off. The getter answers for anybody on the floor when it was called; a body the game holds no record of reads as the staff's, as game/cast.ts dresses him. */
export function charSides(g: Game): (c: Character) => CharSide {
  sides.set(g.player.char, castVariantOf(g, g.player.char)?.side ?? 'operator'); suits.set(g.player.char, sneakSuit(g, g.player.char));   // (his own variant is the first operator's; another side's only when the console or the character lab dressed him in it: cast.ts castWear)
  for (const gd of g.guards) { sides.set(gd.char, sideOfTeam(gd.team, gd.trained)); suits.set(gd.char, sneakSuit(g, gd.char)); }
  for (const gd of g.civilians) sides.set(gd.char, 'civilian');
  return FRAME.side;
}
/** This frame's looks, or null while the switch is off. */
export function charLookFrame(g: Game): CharLookFrame | null {
  if (!g.engine.settings.charMats) return null;
  sd = charSlots(g.ch); ver = charMatsVersion();
  charSides(g);
  return FRAME;
}
