// SQUADS THAT STAY IN THEIR ROOMS STILL MISS A ROOM THAT GOES SILENT (defenders answer the plan the team chose: the quiet way in on a level whose file
// keeps every squad at home).
//
// WHAT WAS THERE: a squad counts its own men (enemysquads.ts radioCheck), and no squad asks about ANOTHER unless the net's ask is on (SQUADS.netAsk: off in
// the page, `?radiocheck=net`). On a level whose every squad is told to stay in its rooms — a room each, two men a room — the team takes a whole room
// without a sound and the whole of the squad is gone with it: nobody is left to miss anybody, and the garrison stands as it stood for as long as the team
// cares to take. And with the net's ask on there, nobody could be sent: a squad that stays is never asked for men.
//
// THE RULE, on a floor where it holds (`stayAskHere`: two squads or more, every one of them told to stay, and no lesson written on the level):
//   · THE NET'S ASK RUNS THERE, as enemysquads.ts has it and whatever its own switch says: the roll call, the squad asked for by name, every squad wary
//     when nobody answers. Their words, their beats, their dice.
//   · ONE MAN GOES TO LOOK: the squad nearest the silent one that has a man to leave at home sends `men` (one) to its posts — "nothing from Charlie — one
//     moving to their rooms!", his boots filed for the team's ears — where a squad free to leave sends two. He is that squad's looker from there: a body in
//     his eye is his to call, the team in it is his fight, nothing at the posts and he goes back to his door.
//   · A SQUAD'S COUNT OF ITS OWN MEN IS AS IT WAS: a man who misses his mate walks to the post himself (the net ask's last-man rule — he stays and asks the
//     net for men — is its own switch's, not this one's: the post is a stride away in his own room).
// Elsewhere nothing changes: a level with a squad that may leave its rooms keeps the net's ask as its own switch has it.
// IT NEEDS THE RADIO CHECK (SQUADS.radioCheck — on in the page; a frozen stand holds it off, so TPS_STAYASK=1 alone there changes nothing).
// No man is added and nobody's eyes, aim or health change; nobody is told where the team is (the places are their own posts). No dice, no state of its own:
// whether the rule holds is read once when the squads are staged and kept with them (enemysquads.ts State.stayAsk).
import type { SquadData } from '../scene/scenarios';
import type { Game } from './game';

/** the switch and its number: off in the module, raised by the page (host/profile.ts pageSwitches; ?nostayask = squads that stay never miss another's room,
 *  as it was) and by the shipped stand; the harness's frozen stand leaves it off (TPS_STAYASK=1 turns it on). UNTUNED by play. */
export const STAYASK = {
  on: false,
  /** men a squad that stays sends to a silent squad's posts (it keeps a man at home, so a squad of fewer than this and one sends nobody) */
  men: 1,
};

/** enemysquads.ts squadsStage: does the rule hold on this floor — every squad of two or more told to stay in its rooms, no lesson on the level */
export function stayAskHere(g: Game, squads: SquadData[]): boolean {
  return STAYASK.on && squads.length > 1 && squads.every(q => q.mayLeave === false) && !g.level.scenarios?.lesson;
}
