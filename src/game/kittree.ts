// THE GEAR SCREEN AS A TREE (KITTREE). The maintainer, on Team & kit (10-19): "have some way of distinguishing different guns (some stats?), attachments
// like silencer should be per gun", "should be symmetric between self and teammates", "sponge should show up, should only be part of stealth builds by
// default", "ideally rifle attachments should be hierarchical under the rifle", "weird that we have both per person defaults (as issued, quiet set, etc.)
// and then squad kits too".
// With the switch on a card (kit.ts, the two gun slots' card) is ONE LIST OF ROWS FOR EVERY MAN, you among them:
//   · each gun is a row with what rides on it UNDER it (KitRow.under): its own suppressor (`suppressed` the primary's, `sideCan` the secondary's), the
//     weapon light, and what the launcher fires — sponge rounds (`rings`, a row for the first time), 40 mm grenades, sticky cameras — only on a gun that
//     has the tube (KitRow.has);
//   · YOUR card has the suppressor, light and goggles rows a teammate's always had, and they are what you deploy with: a suppressor taken off is the same
//     gun with a bare muzzle (bareOf below), no light is a dead L, no goggles a dead N;
//   · sponge rounds are a count like any other: NONE as issued, and a quiet or solo mission hands you `lend` of them over your card, as it hands its
//     cameras (kit.ts kitPlayer) — so a stealth run starts with the five it always had and a loud one with none;
//   · the card's own row of sets is one reset (the squad's row of kits is the one list of named kits: ui/loadout.ts shows it at every team size).
// What a gun is good at is drawn on its tile (ui/gunStats.ts: four bars read off its weapons.ts row).
// Off (the module, the frozen stand, `?nokittree`): the card of the build before, row for row — a teammate's one Suppressor row for both his guns, your
// guns always suppressed, five sponge rounds with every launcher, the two rows of sets. `KITTREE_BREAK=1` (tools/qa/kittree-check.ts): the rows of the
// build before under a raised switch.
// It rides on the two gun slots' card (gunslots.ts GUNSLOTS, kit.ts BIGSLOT): with either off the card is the build before's too.
import { SideMap } from '../math/side';
import { WEAPONS, type WeaponDef } from './weapons';   // (read inside bareOf only — never as this module loads)

export const KITTREE = {
  on: false,
  /** the most sponge rounds a card carries (the launcher's five: weapons.ts LAUNCHER.rings) */
  rings: 5,
  /** … and what a quiet or solo mission hands you over your card (what every launcher carried before the switch) */
  lend: 5,
};
const BREAK = (() => { try { return String((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.KITTREE_BREAK ?? '') === '1'; } catch { return false; } })();
/** the switch as the card asks it (KITTREE_BREAK=1: never) */
export const treeOn = (): boolean => KITTREE.on && !BREAK;

/** (a pure function of the row: one made per row, for every game) */
const bare = new SideMap<WeaponDef, WeaponDef>('kittree.bare'); bare.asMemo();
/** A GUN WITH ITS SUPPRESSOR TAKEN OFF: the same row — its magazine, its hands, its id, its name less the word — with a bare muzzle: the report every floor hears as
 *  gunfire (the unsuppressed gun of its class: the service pistol's, the carbine's) and that gun's flame and light. A row that never wore one is itself. */
export function bareOf(def: WeaponDef): WeaponDef {
  if (!def.suppressed) return def;
  let b = bare.get(def);
  if (!b) { const like = WEAPONS[def.cls === 'pistol' ? 'guard9mm' : 'aks74u'];
    b = Object.create(def, { name: { get: () => def.name.replace(/\s*\(suppressed\)$/i, ''), enumerable: true }, suppressed: { value: false, enumerable: true }, report: { value: { level: like.report.level, loud: like.report.loud, voice: like.report.voice }, enumerable: true }, muzzleFx: { value: like.muzzleFx, enumerable: true } }) as WeaponDef;
    bare.set(def, b); }
  return b;
}
