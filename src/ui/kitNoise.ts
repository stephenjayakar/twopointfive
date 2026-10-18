// HOW LOUD A THING ON A KIT CARD IS WHEN IT IS USED, IN THE GAME'S OWN WORDS — for the Team & kit step of a quiet mission (ui/startpage.ts: each tile that
// makes a noise wears a small sound mark of one, two or three arcs; nothing is written). No number is made up here: a step is what the floor's own sound
// event says of the thing (game.ts GameEvent `loud` / `level`, which is what a guard hears):
//   0  no event of its own (the wand, what he wears)
//   1  an event with `loud: false` — heard nearby, a look and no alarm (the suppressed pistol's report, weapons.ts; a smoke can's pop, combat.ts; a
//      sticky camera leaving the launcher and striking, stickycam.ts)
//   2  an event with `loud: true` — the floor hears it (every other gun's report; a stun can and a charge, combat.ts 'bang'; a boot or a hammer on a door)
//   3  the blast, `level: 2` — frag.ts blast(): a frag grenade, and a 40 mm grenade (he40.ts goes off with the same blast)
// A gun's step is read off its row of WEAPONS when asked, so a gun retuned there moves its mark with it.
import { WEAPONS, type WeaponId } from '../game/weapons';
import { bigOf, kitGun, kitSecond, type MemberKit } from '../game/kit';

export type KitNoise = 0 | 1 | 2 | 3;
const gun = (id: WeaponId): KitNoise => (WEAPONS[id]?.report.loud ? 2 : 1);
/** Sam's guns as his card names them (kit.ts YOU_GUNS: the long gun and the suppressed pistol; the mark is the louder of what the pick puts in his hands). */
const SAM: Record<string, WeaponId> = { rifle: 'fn2000', pistol: 'fiveseven', shotgun: 'm870' };
const FIXED: Record<string, KitNoise> = { smoke: 1, cams: 1, bangs: 2, charges: 2, walls: 2, frags: 3, shells: 3 };

/** The step for the card's row `field` as member `i`'s card `m` stands (a count of none still has its step: it is what the thing WOULD do). */
export function kitNoise(field: string, m: MemberKit, i: number): KitNoise {
  if (field === 'weapon') return gun(i === 0 ? SAM[m.weapon] ?? 'fiveseven' : kitGun(m));
  if (field === 'primary') return m.weapon === 'pistol' ? 0 : gun(kitGun(m));   // (game/gunslots.ts: the two slots' rows — each by its own row's report)
  if (field === 'secondary') { const w = kitSecond(m); return w ? gun(w) : 0; }
  if (field === 'big') { const b = bigOf(m); return b === 'shotgun' ? gun('m870') : b === 'hammer' || b === 'wall' ? 2 : 0; }
  return FIXED[field] ?? 0;
}

/** Whether the mission's gear screen takes the quiet look: a quiet mission or the solo night, unless the address says `kitloud` (the screen as it was). */
export const quietGear = (kind: string, search = ''): boolean => (kind === 'quiet' || kind === 'solo') && !new URLSearchParams(search.replace(/^[^?]*\?/, '')).has('kitloud');
