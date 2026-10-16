// What a door is CALLED when its id is its author's shorthand (the dialogue pass, words.ts). A level file's door ids are handles — 'w_n', 'b_s', 'n4a',
// 'hd_n' — and said as their words they came out 'west north door', 'k south door': compass words the HUD has none of, and letters that name nothing. Where
// the level's room clear STRUCTURE lists such a door (scene/scenarios.ts StructureRoom.doors: the room it lets into and what is on its other side), the door
// is named by the rooms it joins instead:
//   · between two rooms of the structure            'mess to comms room door'
//   · the only door of its room                     'ward door'
//   · one of several, by what it is taken from      'hall-side mess door' · 'outer galley door' · 'bunks 2 door from bunks 1'
//   · two that still read the same                  'first hall to dock door' · 'second hall to dock door' (the file's order)
// A place it is taken from whose own name is a bearing ('north corridor', 'east side') is left out — the HUD has no compass — and the file's order tells such
// doors apart. A whole compass word in an id ('records_west', 'staff_east') is shorthand like a compass letter: the door is named by its rooms.
// An id of two places with 'to' between them ('kitchen_to_hall') reads as words too: 'to' is two letters and a word all the same.
// An id that already reads as words ('radio_room', 'fire_exit', 'bunks', 'back_1') keeps them, as does every door the structure does not list,
// the office (its ids have their own table: orders.ts DOOR_SAID, dialogue.ts DOOR_NAMES), a Training lesson's level (its lines name its doors themselves) and
// every door while the pass is off. ONE name a door: the squad's rows (orders.ts doorWords)
// and a defender's call on the net (tactics.ts gateCall) both read it, so a door has one name on one HUD. Words only: nothing here is read by a rule.
// A leaf of the import graph but for types; the names hang on the Door OBJECTS (a Game's own), so two Games in a process each have theirs.
import type { Level } from '../scene/level';

const SAID = new WeakMap<object, string>();
const COMPASS = new Set(['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw', 'north', 'south', 'east', 'west']);
/** two letters and a word all the same: the joining word of an id that names the two places a door is between ('kitchen_to_hall', said 'kitchen to hall door'
 *  on the squad's row; counted shorthand, a defender's call left that name for the nearest room's — two names for one door) */
const JOIN = new Set(['to']);
/** id words that name no door when said ('the off door', 'the his door') */
const ODD = new Set(['off', 'his']);
/** a token of an id that is no word: a compass letter, one or two letters, letters with a number ('n4a', 's34'), or no vowel at all ('mgr', 'hd'); a bare
 *  number is a word ('back_1' is said 'back 1') */
const shorthand = (t: string) => COMPASS.has(t) || ODD.has(t) || (!/^\d+$/.test(t) && !JOIN.has(t) && (t.length <= 2 || /\d/.test(t) || !/[aeiouy]/.test(t)));
/** true = this door id is its author's shorthand, not words to say (the one test: the names below and a defender's call, tactics.ts gateCall) */
export const shorthandId = (id: string) => id.split('_').some(shorthand);
const BEARING = /\b(?:north|south|east|west)(?:ern)?\b/;
const bare = (s: string) => s.replace(/^the\s+/i, '');
const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth'];

/** the said name of every shorthand door the level's structure lists, by door id (a pure function of the level's data; exported for the checks) */
export function doorNamesOf(level: Level, ids: readonly string[]): Map<string, string> {
  const out = new Map<string, string>(), rooms = level.scenarios?.roomClear?.rooms ?? [];
  if (!rooms.length || level.scenarios?.lesson) return out;
  const made: { id: string; name: string }[] = [];
  for (const id of ids) {
    if (!shorthandId(id)) continue;
    const of = rooms.filter(r => r.doors.some(d => d.id === id)); if (!of.length) continue;
    const R = of[0], A = bare(R.name);
    if (of.length > 1) { made.push({ id, name: `${A} to ${bare(of[1].name)} door` }); continue; }
    const from = bare(R.doors.find(d => d.id === id)!.from);
    const plain = R.doors.length === 1 || R.doors.every(d => bare(d.from) === from) || BEARING.test(from);   // (its only door, every door of the room taken from the same place, or a place named by a bearing: the place says nothing)
    made.push({ id, name: plain ? `${A} door` : from === 'outside' ? `outer ${A} door` : / side$/.test(from) ? `${from} ${A} door` : /[\s\d]/.test(from) ? `${A} door from ${from}` : `${from}-side ${A} door` });
  }
  // two doors that still read the same are told apart in the file's order; a name another door's own id already reads as is told apart the same way
  const taken = new Set(ids.filter(id => !made.some(m => m.id === id)).map(id => `${id.replace(/_/g, ' ')} door`));
  for (const m of made) {
    const same = made.filter(o => o.name === m.name);
    out.set(m.id, same.length > 1 || taken.has(m.name) ? `${ORDINALS[Math.min(same.indexOf(m) + (taken.has(m.name) ? 1 : 0), ORDINALS.length - 1)]} ${m.name}` : m.name);
  }
  return out;
}

/** Game construction: hang each listed door's said name on its Door (nothing for the office, or a level with no structure) */
export function nameDoors(level: Level, office: boolean, doors: readonly { def: { name: string } }[]) {
  if (office) return;
  const names = doorNamesOf(level, doors.map(d => d.def.name));
  for (const d of doors) { const n = names.get(d.def.name); if (n) SAID.set(d, n); }
}
/** the name nameDoors gave this door (undefined: its id's own words stand) */
export function doorSaidName(d: object): string | undefined { return SAID.get(d); }
