// WHAT TAB DOES: the key was freed when the debugger moved to backtick, and nothing in the game reads it. This is a short list of things it could do
// for the player to try in play — each one something the game ALREADY has, put on Tab — with 'nothing' the module's own value (the build as it was, and
// what anything headless has) and 'brief', the objectives card, what a played page gives it where nobody has chosen (`first`, below). Chosen on Options ▸ Game ('Tab key'), kept per machine with that screen's other rows (ui/options.ts), or for one visit
// by `?tab=brief|run|who|keys|off`. The choices that lose come out again; this file is the one place they live.
// SINCE: Tab is also the back key in the fight (game/backkey.ts, BACKKEY.tab): with a list up, a verb running or the launcher's arc held it backs out of
// that, and a choice here gets the press only when there is nothing to back out of (main.ts asks Game.backable first).
//   run  = Tab pauses on the pause card with 'Run so far' open (the map with his path, the timeline, the score as it stands); Tab again resumes.
//   who  = Tab steps who takes the next order, AS WELL AS T: main.ts turns a Tab press into a press of the orders' own key (`ORDERS.whoKey`) before the tick, so the
//          key the HUD, the controls list and the lessons name still works, and a run's tape (which files the tick's keys, not this choice) reruns the same.
//          Only means anything with a squad.
//   keys = Tab pauses on Options ▸ Controls; Tab again resumes.
//   brief = Tab pauses on a card of the objective in full and the squad: each teammate, what he is doing and what he carries (ui/tabcard.ts); Tab again
//          resumes. The maintainer, 10-23, with the corner panel cut down to what the two keys do (ui/corner.ts): "if you don't have a menu open, tab
//          opens up an objectives modal that also has your squad equipment?". It is the home of what that panel no longer says, and so it is what
//          Tab does on a machine that has never chosen (`TABKEY.first`, set by the page; never on a page a script drives; `?tab=off` = nothing).
// 'WHO' IS NO CHOICE WHILE QUICK ORDERS ARE THE WHOLE SQUAD'S (game/cmdring.ts `wholeSquad`; the maintainer, 10-24: "quick Q mode should always do the whole
// squad. you should only be able to issue commands to parts of the squad in plan mode"): with that rule on, the orders' who key steps nobody outside plan
// mode, so a Tab that presses it would do nothing there (in the mode the digits and a click pick the men). `TABKEY.whoGone` says whether the rule is on (the page hands it in, so this file still imports
// nothing): while it is, Options does not offer 'Order who', and a machine that kept it, or a `?tab=who` visit, gets what Tab does where nobody has
// chosen (`first`). The kept choice itself is not rewritten: under `?wholesquad=0` it is 'who' again. Readers ask tabNow(), never `does`.
// Imports nothing: plain data and two setters.

export type TabDoes = 'off' | 'brief' | 'run' | 'who' | 'keys';
export const TAB_CHOICES: { v: TabDoes; label: string; line: string }[] = [
  { v: 'off', label: 'Nothing', line: 'Tab does nothing.' },
  { v: 'brief', label: 'Objectives', line: 'Press Tab to pause on your objectives and your squad, with what each teammate is doing and carrying. Press Tab again to go back to the game.' },
  { v: 'run', label: 'Run so far', line: 'Press Tab to pause and see the run so far, with the map of your path, what\'s happened and the score as it stands. Press Tab again to go back to the game.' },
  { v: 'who', label: 'Order who', line: 'Press Tab to change who takes your next order (everyone, a pair or one teammate). T still does the same. This only matters with a squad.' },
  { v: 'keys', label: 'Controls', line: 'Press Tab to pause on the list of keys. Press Tab again to go back to the game.' },
];
/** `does` = what Tab does now · `kept` = what this machine has kept (a `?tab=` visit never writes it) · `url` = this visit's flag chose · `picked` = the
 *  player chose on Options (a kept 'off' from before `first` existed was no choice: keep() wrote it on every machine) · `first` = what Tab does where
 *  nobody has chosen ('off' in the module and for anything with no page; the page sets it) */
export const TABKEY: { does: TabDoes; kept: TabDoes; url: boolean; picked: boolean; first: TabDoes;
  /** true while 'who' is no choice (the header's note): nothing in the module, the page's own question */
  whoGone: () => boolean } = { does: 'off', kept: 'off', url: false, picked: false, first: 'off', whoGone: () => false };
const gone = (v: TabDoes) => v === 'who' && TABKEY.whoGone();
/** WHAT TAB DOES NOW: the choice as settled, or `first` while that choice is 'who' and 'who' is no choice */
export function tabNow(): TabDoes { return gone(TABKEY.does) ? TABKEY.first : TABKEY.does; }
/** what Options keeps of the above (ui/options.ts keep): nothing where nobody has chosen, so that such a machine follows `first`; a choice, 'off' too */
export function tabKept(): { tab?: TabDoes; tabPicked?: boolean } { return TABKEY.picked || TABKEY.kept !== 'off' ? { tab: TABKEY.kept, tabPicked: TABKEY.picked } : {}; }
/** … and what was kept, read back (a kept choice other than 'off' from before `picked` existed was a choice) */
export function tabLoad(k: { tab?: unknown; tabPicked?: unknown }) { TABKEY.kept = tabDoes(k.tab) ?? 'off'; TABKEY.picked = k.tabPicked === true; tabSettle(); }
/** what Tab does, settled from the above: this visit's flag, else the player's own choice, else a kept choice that is not 'off', else `first` */
export function tabSettle() { if (!TABKEY.url) setTabKey(TABKEY.picked || TABKEY.kept !== 'off' ? TABKEY.kept : TABKEY.first); }
/** the choices as Options ▸ Game shows them ('Order who' only while it is one: the header's note). While Tab is the back key (game/backkey.ts; the flag is handed in, so this file still imports nothing) 'Nothing'
 *  is not true of the key: the first choice then says what Tab still does, and the others that backing out comes before them. A fresh list each call. */
export const TAB_BACK_LINE = 'In a fight, press Tab to back out of a list, the order menu or an action in progress.';
export function tabChoices(back: boolean): { v: TabDoes; label: string; line: string }[] {
  return TAB_CHOICES.filter(c => !gone(c.v)).map(c => !back ? { ...c } : c.v === 'off' ? { ...c, label: 'Nothing more', line: `${TAB_BACK_LINE} Nothing more.` } : { ...c, line: `${c.line} Backing out comes first.` });
}
export function tabDoes(v: unknown): TabDoes | null { return TAB_CHOICES.some(c => c.v === v) ? v as TabDoes : null; }
export function setTabKey(v: TabDoes) { TABKEY.does = v; }
/** `?tab=<choice>` holds for the visit (a bare or unknown value is no choice) */
export function tabFromQuery(q: URLSearchParams) { const v = tabDoes(q.get('tab')); if (v) { TABKEY.url = true; setTabKey(v); } }
