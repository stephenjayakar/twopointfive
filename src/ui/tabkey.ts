// WHAT TAB DOES, ON TRIAL: the key was freed when the debugger moved to backtick, and nothing in the game reads it. This is a short list of things it could do
// for the player to try in play — each one something the game ALREADY has, put on Tab, never a new screen or a new verb — with 'nothing' the default (the build
// as it was) and a fine place to end up. Chosen on Options ▸ Game ('Tab key'), kept per machine with that screen's other rows (ui/options.ts), or for one visit
// by `?tab=run|who|keys|off`. The choices that lose come out again; this file is the one place they live.
// SINCE: Tab is also the back key in the fight (game/backkey.ts, BACKKEY.tab): with a list up, a verb running or the launcher's arc held it backs out of
// that, and a choice here gets the press only when there is nothing to back out of (main.ts asks Game.backable first).
//   run  = Tab pauses on the pause card with 'Run so far' open (the map with his path, the timeline, the score as it stands); Tab again resumes.
//   who  = Tab steps who takes the next order, AS WELL AS T: main.ts turns a Tab press into a press of the orders' own key (`ORDERS.whoKey`) before the tick, so the
//          key the HUD, the controls list and the lessons name still works, and a run's tape (which files the tick's keys, not this choice) reruns the same.
//          Only means anything with a squad.
//   keys = Tab pauses on Options ▸ Controls; Tab again resumes.
// Imports nothing: plain data and two setters.

export type TabDoes = 'off' | 'run' | 'who' | 'keys';
export const TAB_CHOICES: { v: TabDoes; label: string; line: string }[] = [
  { v: 'off', label: 'Nothing', line: 'Tab does nothing.' },
  { v: 'run', label: 'Run so far', line: 'Press Tab to pause and see the run so far, with the map of your path, what\'s happened and the score as it stands. Press Tab again to go back to the game.' },
  { v: 'who', label: 'Order who', line: 'Press Tab to change who takes your next order (everyone, a pair or one teammate). T still does the same. This only matters with a squad.' },
  { v: 'keys', label: 'Controls', line: 'Press Tab to pause on the list of keys. Press Tab again to go back to the game.' },
];
/** `does` = what Tab does now · `kept` = what this machine has kept (a `?tab=` visit never writes it) · `url` = this visit's flag chose */
export const TABKEY: { does: TabDoes; kept: TabDoes; url: boolean } = { does: 'off', kept: 'off', url: false };
/** the choices as Options ▸ Game shows them. While Tab is the back key (game/backkey.ts; the flag is handed in, so this file still imports nothing) 'Nothing'
 *  is not true of the key: the first choice then says what Tab still does, and the others that backing out comes before them. A fresh list each call. */
export const TAB_BACK_LINE = 'In a fight, press Tab to back out of a list, the order menu or an action in progress.';
export function tabChoices(back: boolean): { v: TabDoes; label: string; line: string }[] {
  return TAB_CHOICES.map(c => !back ? { ...c } : c.v === 'off' ? { ...c, label: 'Nothing more', line: `${TAB_BACK_LINE} Nothing more.` } : { ...c, line: `${c.line} Backing out comes first.` });
}
export function tabDoes(v: unknown): TabDoes | null { return TAB_CHOICES.some(c => c.v === v) ? v as TabDoes : null; }
export function setTabKey(v: TabDoes) { TABKEY.does = v; }
/** `?tab=<choice>` holds for the visit (a bare or unknown value is no choice) */
export function tabFromQuery(q: URLSearchParams) { const v = tabDoes(q.get('tab')); if (v) { TABKEY.url = true; setTabKey(v); } }
