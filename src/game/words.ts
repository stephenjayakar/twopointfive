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

export const WORDS = { on: false };

/** the page's one rule for the switch: on unless the address says `?oldwords` */
export function wordsFromQuery(q: URLSearchParams) { WORDS.on = !q.has('oldwords'); }

/** a line (or a pool, or any value a line is picked by) as the pass has it — `was` with the switch off */
export function w<T>(now: T, was: T): T { return WORDS.on ? now : was; }
