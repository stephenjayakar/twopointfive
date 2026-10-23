// THE DIALOGUE PASS (the maintainer, 10-10, while playing a rescue: "the hostage dialogue uses the same stuff from the office civilians which doesn't make sense.
// do a pass on all the dialogue?"). Every spoken line was written on the office's night floor — building security, a cleaner, a late worker, a net with CONTROL
// on it — and the same mouths now stand on a bazaar, a border crossing, a compound, a consulate with hostages in it. This pass makes each line fit WHO says it
// and WHERE. ONE switch, `WORDS.on` — ON in the page (`?oldwords` = every line as it was), OFF in the module and on the frozen harness stand (`TPS_WORDS=1`;
// src/host/profile.ts pageSwitches + FROZEN_HOLDS, src/host/standup.ts) — because a bubble's time on screen is its length, and who is 'still talking' gates the
// calm floor's small talk: a reworded line can move a run, so every frozen digest, tally and session fixture keeps the words it was recorded with.
//   · HOSTAGES have a voice of their own (dialogue.ts HOSTAGE_LINES, civilians.ts hostageSay, rescue.ts voices): no cleaner's whimper, no 'the cleaner is down'.
//   · A line that names an office thing — the corridor, the lift, the fourth floor, the cleaning staff, CONTROL — is said only where the level has it; elsewhere
//     the same moment gets words that name nothing the place lacks (dialogue.ts `isOffice(level)` where the line is read, or the level's own room names).
//   · A line is said by the side it was written for: the night staff's worry is not a hostile defender's, and neither is an operator's. A defender speaks of
//     the team as 'them', never calls his own mate by the team's label for him ('Tango 2'), and is not a watchman when Sam has him by the throat.
//   · ONE ERRAND rides the switch with its line (lighting.ts theirMains): the breaker is walked to, and reset, only by men whose mains they are — a side hostile
//     to Sam. A teammate sent off to put the lights back on that Sam cut was the line's premise, not a line; with the switch off he goes as before.
// How a change is written: `w(now, was)` where the line is READ (never in a table built as a module loads: the switch is the page's, set after the modules load).
// Off = the build as it was, word for word. A LEAF: nothing of the game is imported here (src/game is one import cycle).

/** `doors`: a door's said name may be the level's own (scenarios.doorNames, read by doornames.ts) — a key of its own, because a door's name is said in
 *  bubbles and a bubble's text is in the run digest: a recording from before the key replays with it off (journal.ts). Read only while `on`. */
/** `radioHome`: the handler's radio asides (dialogue.ts handlerBeat: her dry lines and his answers about the drive, the rack, the floor's lights) belong to the
 *  office night they were written for, and are said nowhere else: not on a tutorial mission, not on another level's quiet night. ON in the page
 *  (`?handlerall` = everywhere a solo night runs, as before), OFF here and on the frozen stand (`TPS_RADIOHOME=1` raises it). */
/** `guide`: the spoken and radio lines as the writing guide has them (docs/agents/writing.md rule 7: 'around' for 'round', contractions, 'somebody' for 'a man' of
 *  his own side, a line clipped until it was unclear). A key of its own under `on`, because a bubble's time on screen is its length and its text is in the run
 *  digest: a recording made on the page before the key replays with it off, every line as that page said it. Read through `wg(now, was)`, which wants `on` AND
 *  `guide`: on with the guide off = the dialogue pass's words as they were. ON in the page (`?noguide` puts it off), OFF here and on the frozen stand
 *  (`TPS_GUIDEWORDS=1` raises it; it says nothing new without `TPS_WORDS=1`). */
export const WORDS = { on: false, doors: false, radioHome: false, guide: false };

/** the page's one rule for the switch: on unless the address says `?oldwords` */
export function wordsFromQuery(q: URLSearchParams) { WORDS.on = !q.has('oldwords'); WORDS.doors = q.get('doornames') !== '0'; WORDS.radioHome = !q.has('handlerall'); WORDS.guide = !q.has('noguide'); }

/** a line (or a pool, or any value a line is picked by) as the pass has it — `was` with the switch off */
export function w<T>(now: T, was: T): T { return WORDS.on ? now : was; }
/** a line as the writing guide has it — `was` (the line as the dialogue pass left it, or as it always was) unless the pass AND the guide's key are both on */
export function wg<T>(now: T, was: T): T { return WORDS.on && WORDS.guide ? now : was; }
