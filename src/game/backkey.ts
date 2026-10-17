// THE BACK KEY: Esc is the pause, and only the pause; what Esc used to back out of in the fight — the squad's order menu (a page of it: back to the first), the
// open Space list, a running sustained verb (the leaf being eased, the pick, the choke, the drive), the launcher's held arc — backs out on Tab. The maintainer,
// 10-17: "esc is overloaded -- exiting out of menus as well as going to pause. maybe we make tab exit out of menus and esc is always pause?"
//   `BACKKEY.tab` — ON in the page (`?tabback=0` = Esc backs out first and pauses only with nothing to back out of, as it did), OFF here and on the frozen
//   stand (`TPS_TABBACK=1`). A recording from before the key replays with it off (journal.ts): a Tab in its ticks did nothing.
// WHO READS WHAT. In the tick the back key is a press like any other: orders.ts takes it out of the frame with the menu up, interact.ts and player.ts read it
// after. An Escape that reaches the tick still backs out with the rule on (the harness's presses, an older tape's): on the PAGE none reaches it — the page's
// handler (main.ts) takes the press out of the frame's keys before it toggles the pause, so no tick and no recording holds it.
// 'Paused': a key let go under the pause card would act on the tick play comes back (the Space list does its row, the launcher sends its round). With the rule
// on the loop (host/loop.ts) hands the first tick after a frozen frame the one-tick code 'Paused', as Input hands it 'Blur': interact.ts shuts a held list
// with its press spent, player.ts lets go of a held arc unsent. It is a press in the tick's keys, so a recording carries it and a replay does the same; nothing
// of the game is changed between ticks for it. The order menu and a running verb are still there after the pause.
// Tab's trial choices (ui/tabkey.ts) keep the key whenever there is nothing to back out of (Game.backable). Imports nothing.
export const BACKKEY = { tab: false };
interface Keys { hit(code: string): boolean; pressed: Set<string> }
/** the back key went down this tick (read, not taken) */
export function backHit(input: Keys): boolean { return input.hit('Escape') || (BACKKEY.tab && input.hit('Tab')); }
/** …taken out of the frame: whoever answers to it, nobody after does */
export function backTake(input: Keys): boolean { const esc = input.pressed.delete('Escape'), tab = BACKKEY.tab && input.pressed.delete('Tab'); return esc || tab; }
/** the name a hint row shows */
export function backName(): string { return BACKKEY.tab ? 'Tab' : 'Esc'; }
