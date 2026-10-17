// SQUADS FROM THE ROOMS (defenders answer the plan the team chose: a loud way in and a quiet one each draw their own move on a level whose file names no squads).
//
// WHAT WAS THERE: a level's defenders are organised only where its file says so (`scenarios.roomClear.squads`: enemysquads.ts). Everywhere else they are one
// pool: a room hit loudly draws, at standard, nobody (or one man with no word said), and a man taken quietly at the back is missed by nobody — the contact
// call, the men who come to a hit room, the pair that goes round, the radio check and the two who walk to a silent post are all the squads' and none of it
// runs without a squads block.
//
// THE RULE: a structure with no squads block is handed one made of ITS OWN ROOMS when its men are dealt, and from there it is enemysquads.ts's floor like any
// squads level: nothing here moves a man or says a line.
//   · THE FILE WINS. A level that names its squads keeps them, word for word (who holds what, who may leave, what they wedge): this is for the levels that
//     say nothing. A level that wants to stay one pool says `squads: []`; a Training lesson is left as its file has it.
//   · HOW MANY: the men as dealt — `one` or fewer are one squad, `two` or fewer two, more three (and never more squads than rooms with a man in them).
//   · WHICH ROOMS: the rooms in a line along the house's longer side, cut where the men as dealt come nearest to even shares, so a squad's rooms are
//     neighbours and each squad has a man. A room nobody was dealt into belongs to the squad of the run it lies in (it is floor that squad holds).
//   · WHAT THEY ARE CALLED: `names` in order along that line (no room's name, no compass word).
//   · Everything else is absent in the block, so it is the squads' own default: they may leave their rooms, they wedge the doors their rooms do not share,
//     their training is the difficulty's mix, nobody arrives late.
// DYNAMIC: the block is made from the placement of THIS staging (a fresh deal cuts the line where its men are), and every way a squad's men then take is
// asked of the walk grid as it stands (enemysquads.ts), so a blown wall changes the way they come.
// No man is added and nobody's eyes, aim or health change. No dice, no clock, no state: a pure function of the structure and the deal, so there is nothing to
// keep in a checkpoint (the squads' own state is enemysquads.ts's).
// WHAT IT COSTS: with squads staged the floor is a squads level to every rule that asks (pressure.ts: the press stands down and hard is the drilled garrison;
// digin.ts: men dig in on their squad's word) — see the area file for what that measured.
import type { StructureData, StructureRoom, SquadData } from '../scene/scenarios';

/** the switch and its numbers: off in the module, raised by the page (host/profile.ts pageSwitches; ?nosquaddeal = a level with no squads block is one pool,
 *  as it was) and by the shipped stand; the harness's frozen stand leaves it off (TPS_SQUADDEAL=1 turns it on). UNTUNED by play. */
export const SQUADDEAL = {
  on: false,
  /** the most men that are ONE squad · the most that are two (more: three) */
  one: 5, two: 8,
  /** what their radio calls them, in order along the house */
  names: ['Alpha', 'Bravo', 'Charlie'],
};

/** roomclear.ts onStaged: the structure as the squads are staged on it — `S` itself when the switch is off, when its file has a squads block (an empty one
 *  too: `squads: []` is a level saying it is one pool), on a lesson, or when fewer than two men were dealt; else a copy of it with a squads block cut from
 *  its rooms (`rooms[i]` = the room id defender i was dealt into). */
export function squadDeal(S: StructureData | null, rooms: string[], lesson = false): StructureData | null {
  if (!SQUADDEAL.on || !S || S.squads || lesson || !S.rooms.length) return S;
  const K = SQUADDEAL, count = new Map<string, number>(); for (const id of rooms) count.set(id, (count.get(id) ?? 0) + 1);
  const n = (r: StructureRoom) => count.get(r.id) ?? 0;
  const men = S.rooms.reduce((a, r) => a + n(r), 0), held = S.rooms.filter(r => n(r) > 0).length;
  if (men < 2) return S;
  const k = Math.min(men <= K.one ? 1 : men <= K.two ? 2 : 3, held, K.names.length);
  const mid = (r: StructureRoom) => [(r.bounds.x0 + r.bounds.x1) / 2, (r.bounds.z0 + r.bounds.z1) / 2];
  const span = (ax: number) => { const v = S.rooms.map(r => mid(r)[ax]); return Math.max(...v) - Math.min(...v); }, ax = span(0) >= span(1) ? 0 : 1;
  const line = [...S.rooms].sort((a, b) => mid(a)[ax] - mid(b)[ax] || mid(a)[1 - ax] - mid(b)[1 - ax] || (a.id < b.id ? -1 : 1));
  // the cuts: after the room where the men counted so far come nearest q/k of them, each run keeping a man and leaving one for every run after it
  const cuts: number[] = []; let from = 0;
  for (let q = 1; q < k; q++) {
    let best = -1, bestD = Infinity, sum = line.slice(0, from).reduce((a, r) => a + n(r), 0), own = 0, after = line.slice(from).filter(r => n(r) > 0).length;
    for (let i = from; i < line.length - 1; i++) {
      sum += n(line[i]); own += n(line[i]); if (n(line[i]) > 0) after--;   // (`after`: the rooms with a man past this one)
      if (own < 1) continue; if (after < k - q) break;
      const d = Math.abs(sum - men * q / k); if (d < bestD) { bestD = d; best = i; }
    }
    if (best < 0) break;
    cuts.push(best + 1); from = best + 1;
  }
  const squads: SquadData[] = []; let i0 = 0;
  for (const end of [...cuts, line.length]) { squads.push({ id: `dealt${squads.length + 1}`, name: K.names[squads.length], rooms: line.slice(i0, end).map(r => r.id) }); i0 = end; }
  return { ...S, squads };
}
