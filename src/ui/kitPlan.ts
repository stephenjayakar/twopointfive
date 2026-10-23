// A MISSION'S OWN KIT PLAN — the Team & kit step of a tutorial mission walks the player through planning: read the job and the map, then pack for them.
//
// The maintainer, 10-23, of the step's first walkthrough (which came up on every mission): "this tutorial is good but we should attach it to a tutorial
// mission (and make it bespoke and explain how to plan), not for the regular ones". So the walkthrough of ui/kitGuide.ts is now a SCRIPT, and the one
// played unasked is the plan written here for one mission, in that mission's own terms: its rooms, its gun, its locked door, and the kit that answers
// them. Regular missions play none (the step's general walkthrough is kept for comparing: `?kitguide=1`).
//   WHICH MISSION: the squad mission, "A harder fight" (tut-squad). It is the first one the player walks into with the four, it comes after the mission
//   that had him throw each grenade by hand, and its street has what a kit is chosen for: rooms the squad goes into behind a stun grenade, a machine gun
//   behind sandbags that wants a frag, and a locked hall. The radio mission before it is fought from a gate with orders alone and never uses his card.
//   WHAT HE PACKS IS WHAT HE CARRIES: that row is the one lesson not played with the kit as issued (game/kit.ts ISSUE.picked, the row's `packs`), so the
//   cards are on its step and the page stages them. One frag is his whatever he packs (kit.ts kitLessonPage): his tile shows it as the mission's, and
//   the last card says so, when he packed none.
//   THE BEATS (each a card beside its row, done by doing it, or its Next):
//     read   · the map. Open it and put it back. Large, it names the rooms of the street (the marks below) and says what to look for.
//     squad  · the named kits. Put Stun heavy on: the squad throws one into a room first when it has one to spare, the street has three rooms
//              for them, and as issued they carry three: nothing to spare.
//     gun    · your own card. A frag for the machine gun: Stun heavy took yours, so trade a smoke for one.
//     four   · the roster. Look at one of the four.
//     go     · Deploy.
//   The words follow the game's writing rules (CLAUDE.md, docs/agents/writing.md): said the way you would say it aloud, to "you", who presses the key.
//   A count in a card's sentence is written out (`say`).
//   ONCE A BROWSER, under its own key (`twopointsix.kitplan.<mission>`: a browser that went through the general walkthrough has not been through this);
//   the word on the step's head, 'How to plan', plays it again. Skippable at any card (Skip, Esc). Not played unasked in a browser a script drives.
//   THE SWITCHES: `?kitpack=0` = that mission's kit as issued again, no cards on its step and so no plan (the game's rule, journalled) · `?kitguide=0` =
//   no walkthrough on any step, the cards stay · `?kitguide=1` = played on this visit whatever the browser remembers.
// Plain data and words: nothing at module level uses another module's exports (ui/kitGuide.ts reads KIT_PLANS when a step opens).
import type { Beat, GuideScript } from './kitGuide';

/** a word pinned on the large map: where on the floor (x, z), and the level's own room it names (the check holds the spot inside that room) */
export interface MapMark { label: string; at: [number, number]; room: string }
export interface KitPlan { guide: GuideScript; /** what to look for on the map, said under it while it is large */ read: string; marks: readonly MapMark[]; /** the rooms its words say the squad goes into by a door */ rooms: number }

/** a count in a sentence, written out as you would say it (a card's prose: no digit stands in it; the brief's own cells write a digit to five — countWords) */
const SAID = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const say = (n: number): string => SAID[n] ?? 'a lot of';
/** THE SQUAD MISSION'S STREET, as its level and its lesson have it (tools/qa/kitpack-check.ts holds each against the files): the rooms the squad is sent
 *  into by a door (the guard hut, the store, the workshop by its side door — the hall is cleared through its window and kicked in by the player) and the
 *  frag the page hands him if he packs none (the row's `packs.frags`) */
const SQUAD_ROOMS = 3;
const SQUAD_BEATS: readonly Beat[] = [
  { id: 'read', row: 'map', done: (_was, now) => now.mapSeen && !now.mapBig,
    words: () => ({ title: 'Plan it first', text: 'Before every mission, read the job and the map, and then pack for what you see.\nPress [M] to open the map of the post, and press it again to close it.' }) },
  // (asked while the squad carries no more stun grenades than the street has rooms for them, and Stun heavy is on the row to put on)
  { id: 'squad', row: 'squadkit', has: ({ now }) => now.kits.includes('stun') && now.kit !== 'stun' && now.bangs <= SQUAD_ROOMS, done: (_was, now) => now.kit === 'stun',
    words: ({ now }) => ({ title: 'Pack for the rooms', text: `Your squad throws a stun grenade into a room before they go in, if they have one to spare. They'll go into ${say(SQUAD_ROOMS)} rooms on this street, and right now they ${now.bangs >= SQUAD_ROOMS ? `carry ${say(now.bangs)}, so there's nothing to spare` : now.bangs ? `only carry ${say(now.bangs)}` : 'don\'t carry any'}.\nPress [A] or [D] to choose Stun heavy, then press [Enter] to put it on.` }) },
  { id: 'gun', row: 'kit', member: 0, done: (was, now) => now.frags > was.frags,
    words: ({ now }) => ({ title: 'The machine gun', text: `A machine gun is set up behind sandbags at the end of the street. Sandbags stop a rifle, but a frag goes over them.\n${now.frags > 0
      ? `You're carrying ${say(now.frags)}, so keep ${now.frags === 1 ? 'it' : 'them'} whatever else you change.`
      : `${now.kit === 'stun' ? 'Stun heavy took your frag' : 'You aren\'t carrying a frag'}, so ${now.smoke > 0 ? 'trade a smoke canister for a frag grenade' : 'put a frag grenade on your card'}. Point at a tile and click its arrows, or use [W] [A] [S] [D].`}` }) },
  { id: 'four', row: 'members', done: (was, now) => now.member !== was.member && now.member > 0,
    words: ({ now }) => ({ title: 'The four', text: `Your four work as two pairs, Red and Blue, and each of them has a card like yours.\nPress [D] to look at one of them and see what ${now.kit === 'stun' ? 'Stun heavy gave him' : 'he carries'}.` }) },
  { id: 'go', row: 'actions',
    words: ({ now }) => ({ title: 'That\'s a plan', text: `You read the job and the map, and you packed for what you saw. Do that before every mission.${now.frags > 0 ? '' : '\nYou packed no frag, so you\'ll be handed one for the machine gun.'}\nPress [Enter] on Deploy when you're ready.` }) },
];
/** the missions with a plan of their own, by id */
export const KIT_PLANS: Record<string, KitPlan> = {
  'tut-squad': {
    guide: { id: 'plan:tut-squad', ls: 'twopointsix.kitplan.tut-squad', again: 'How to plan', auto: true, beats: SQUAD_BEATS },
    read: 'Look for the three rooms your squad will go into, the machine gun behind its sandbags, and the locked hall at the end of the street.',   // (three = SQUAD_ROOMS, written out: nothing here is worked out as the module loads)
    rooms: SQUAD_ROOMS,
    marks: [
      { label: 'Guard hut', at: [10.5, 8.75], room: 'the guard hut' },
      { label: 'Store', at: [10.5, 19], room: 'the store' },
      { label: 'Workshop', at: [18.75, 8.75], room: 'the workshop' },
      { label: 'Machine gun', at: [32.4, 13.8], room: 'the nest' },
      { label: 'Locked hall', at: [28.95, 19.6], room: 'the hall' },
    ],
  },
};
