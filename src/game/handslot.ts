// EMPTY HANDS ARE A SLOT (the maintainer, 10-20: "e: equip/unequip, seems unnecessary, maybe just empty state would be easier"; 10-22: "having backtick
// be the empty state"). One switch — HANDSLOT.on, OFF = the kit keys exactly as they were — over one rule in player.ts:
//
//   the slot's own code (HANDSLOT_KEY, 'Digit0': a code no key gave the game before) puts away whatever is in his hands, and does nothing when they are empty. It is
//   never the way back: a digit draws, as a digit always did. So the key pressed once or five times leaves him with empty hands, which is what a click
//   behind a man needs. On a wall it chooses empty hands for the step off; with a man in his arm it is the arm (the pistol comes off his head), and 1 is
//   the pistol at his head.
//
// The old key's code ('KeyE': put away OR draw, and the swap of a hold) goes on meaning what it meant, for every recording and every check that presses it.
// What changes with the switch is the page's board (host/keymap.ts `slotWhen`): the slot's code is on the backtick key, the debugger's on the backslash
// key, and nothing gives E's code, so E is spare.
// OFF in the module and on the frozen stand; the page turns it on (`?handslot=0` = E as it was). This file is the table only: nothing of the game is imported.

export const HANDSLOT = { on: false };
/** the code the game asks for the slot by (host/keymap.ts names the same code for its row: that file imports nothing) */
export const HANDSLOT_KEY = 'Digit0';
