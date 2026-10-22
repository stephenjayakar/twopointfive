// THE PLAYER'S OWN KEYS: which key on the board gives each key the game asks for. Options ▸ Controls rebinds one (ui/keybinds.ts), this machine keeps it
// (localStorage `twopointsix.keys`), and Reset there puts every one back. `?keybinds=0` = the build's own keys for the visit, the kept ones left as kept.
// OFF IN THE MODULE: the game page turns it on as it boots (`keysBoot`, main.ts's first line). A headless tool, the level editor, the viewer and the workbench
// never do, so their keys are the build's whatever this machine has kept.
// WHERE IT SITS: at the keyboard, and nowhere else. game/input.ts asks `gameCode()` what a key that went down IS before it files it, so the game goes on asking
// for the codes it always did (`input.hit('KeyR')`), and everything downstream of the Input is as it was: the tick's PlayerCmd, the session journal, a run's
// tape, a replay. A recording made with R on another key holds 'KeyR' and plays the same on any machine. Nothing here is read by src/game but that one call:
// it is no rule of the game, so it is no knob table and the harness's two stands (whose Input has no keyboard) never meet it.
// WHAT CAN MOVE: the keys of KEY_ACTS, one row each. A key that does two things in the build (E puts away and swaps a hold; V whistles and is a row of the order
// menu; the digits are the kit and the menu's rows) moves as one: it is the KEY that is rebound, not the verb. The mouse, the wheel and the camera's Ctrl stay.
// WHAT CANNOT BE TAKEN: the page's own keys (FIXED below). Everything else on the board can.
// NO TWO ROWS ON ONE KEY: a key given to a row that another row has is a SWAP (the other takes the key this one had; with none to give it is left with no key,
// and says so). A key whose row moved away does nothing.
// THE NAMES FOLLOW: `keyLabel` is the cap, `keyCap` turns a cap the HUD was handed ('F', 'Space', '2') into the one bound now, `keyText` does the same for the
// keys named in a line of words. With nothing rebound all three hand back what they were given, untouched.
// `keyText` READS FINISHED WORDS, and that is a guess: a cap standing alone is taken for the key unless the words round it say it is a place's letter ('room B',
// 'Vault B', 'B wing', 'T-junction'); a digit only where the words say key ('then 3', '2 again'); the walk keys only in a list of keys. A line that hands the
// HUD a code instead of a letter would need none of it: the lines are written all over the game, and that is a pass of its own.
// A ROW THE BUILD GIVES NO KEY (`KEYMAP.qFree`, `FREED`): the wall hold's. Walking into a wall takes it and walking off it lets go (game/wallsnap.ts `press`),
// so its key is spare and Q is left for something else. The game goes on asking for 'KeyQ' and MEANS the wall hold by it, as every recording made before
// does; what changed is the board: nothing on it gives that code until the player puts the row on a key here (Q itself, if he likes: a rebind like any
// other, kept, and Reset takes it off again). Q pressed with the row unbound files nothing. OFF IN THE MODULE like the rest; the game page turns it on as
// it boots, `?qfree=0` = Q takes the wall as it did. It does not wait on `on`: `?keybinds=0` is the build's own board, and the build's own board has no wall key.
// ONLY WHILE WALKING IN WORKS (`KEYMAP.freeWhen`, the page's: the walk-in switch as it stands this frame): with that switched off (Options ▸ Game,
// `?wallpress=0`) the row is on Q again, there and then, so there is never a board with no way onto a wall but the one the player made himself.
// KEPT AS HE SET IT: a freed row's entry in the kept table is never folded into 'as built' (what is built moves with the two switches): the wall put on Q by
// hand stays on Q through a visit under `?qfree=0` or a spell with the walk-in off.
// THE LETTER IS NOT THE ROW'S while it is freed and unbound: no line of words is rewritten for it ('Q' in a line is then some other thing's, or nobody's);
// the two lists that show the row write its words themselves (ui/options.ts wallWay). A second thing wanting Q asks the game for a code of its own and
// is given Q here, and takes the cap 'Q' with it: the wall hold's row wants another name for its cap that day.
// THE SQUAD'S COMMAND KEY IS Q (`KEYMAP.qCmd`, `MOVED`): that second thing. It needed no code of its own: the quick order's row (code 'KeyB', which the
// game goes on asking for and every recording holds) has Q for its key in the build, and the B key gives nothing. So a tap of Q IS the press B was, by the
// one read the game has for it, and the row keeps its id: a table kept before, with the command put on some other key, means what it meant. The row's
// cap in the build's words stays 'B' (a line that says 'B on the door' is rewritten to the key it is on: 'Q' untouched, the player's own if he moved it),
// so no two rows share a cap and the wall hold's is still 'Q'. ONLY WITH `qFree`: under `?qfree=0` Q is the wall's and the command is on B, as it was.
// And while it has Q the wall hold never falls back to Q: with walking in switched off the hold has no key until the player gives it one. Kept as he
// set it, like a freed row: the command put back on B by hand stays on B. `?bkey` = the command on B for the visit (Q then as the lines above say).
// Q ALREADY HIS: a table kept with another row on Q (Reload put there while Q was spare, the wall hold given Q back by hand) leaves the command on B,
// its own code's key, as it was before the move; it is on no key only when both are held. Nothing is kept for that: the row he put on Q moved away,
// the command is on Q again.
// EMPTY HANDS ARE A SLOT ON BACKTICK (`KEYMAP.slotWhen`, `SLOT`; the rule is game/handslot.ts): while the page says the slot is on, its code ('Digit0') has
// the backtick key in the build, the debugger's code ('Backquote', which the page goes on asking for) has the backslash key, and E's row (put away or
// draw, the swap of a hold) has no key: E is spare. Nothing kept is rewritten; a row he moved stays where he put it. IN WORDS the letter E is still the
// way a line names putting it away ('E puts it away', written all over the game and its lessons): while the slot is on that letter is read as the
// slot's key (`ALIAS`), so those lines follow without being rewritten, and follow a rebind of the slot. OFF IN THE MODULE (`slotWhen` null).
// Only while E's row has no key: put on a key by hand it is that key again, in caps and in words, and its row is back on the Controls list. The slot's
// row with the slot OFF is no row: it is on no list and holds no key against another row. Backtick already given to another row by hand: the slot is
// on the 0 key, its own code's; backslash given away: the debugger has no key until he gives it one.
// Imports nothing.

export interface KeyAct { /** the code the game asks for (the first of `codes`) */ id: string; /** every code of the row in the build: Shift is both of its keys */ codes: string[]; /** its cap in the build */ cap: string }
const act = (cap: string, ...codes: string[]): KeyAct => ({ id: codes[0], codes, cap });
export const KEY_ACTS: KeyAct[] = [
  act('W', 'KeyW'), act('A', 'KeyA'), act('S', 'KeyS'), act('D', 'KeyD'), act('Shift', 'ShiftLeft', 'ShiftRight'), act('C', 'KeyC'), act('Q', 'KeyQ'),
  act('Space', 'Space'), act('V', 'KeyV'), act('N', 'KeyN'),
  act('R', 'KeyR'), act('Z', 'KeyZ'), act('L', 'KeyL'), act('E', 'KeyE'),
  act('1', 'Digit1'), act('2', 'Digit2'), act('3', 'Digit3'), act('4', 'Digit4'), act('5', 'Digit5'),
  act('X', 'KeyX'), act('B', 'KeyB'), act('T', 'KeyT'), act('F', 'KeyF'), act('G', 'KeyG'), act('H', 'KeyH'),
  act('`', 'Backquote'),
];
/** the empty hands' slot (game/handslot.ts): a row only while the slot is on (the header's note). Off, it is on no list and the 0 key is anybody's */
const SLOT_ACT = act('0', 'Digit0'), WITH_SLOT = [...KEY_ACTS, SLOT_ACT];
/** the page's own: never a row's key (Esc the pause, Enter the checkpoint, Tab the way back, the arrows the highlight, the F row the browser's and the
 *  recorders', the modifiers the camera's and the browser's, P [ ] the showcase's and the exposure's, Caps Lock a key some boards only ever press) */
const FIXED = /^(Escape|Enter|NumpadEnter|Tab|Arrow(Up|Down|Left|Right)|F\d{1,2}|(Control|Alt|Meta|OS)(Left|Right)?|KeyP|BracketLeft|BracketRight|CapsLock|ContextMenu|NumLock|ScrollLock|Pause|PrintScreen|Unidentified|)$/;
export const KEYMAP = { /** false = the build's own keys, whatever is kept: the module's own stand (a tool, the editor, the viewer), and the page's under `?keybinds=0` */ on: false,
  /** the wall hold's row has no key in the build (the header's note). false = it is on Q: the module's own stand, and the page's under `?qfree=0` */ qFree: false,
  /** the squad's command (the quick order's row, code 'KeyB') has Q for its key in the build and B gives nothing: only with `qFree`. false = it is on B: the module's own stand, and the page's under `?bkey` */ qCmd: false,
  /** …only while this says so (the page hands it the walk-in switch; null = always) */ freeWhen: null as (() => boolean) | null,
  /** empty hands are a slot on backtick while this says so (the page hands it game/handslot.ts's switch; null = never: the module's own stand) */ slotWhen: null as (() => boolean) | null, /** steps on every change: what a drawn surface keys its cache on */ rev: 0 };
const LS = 'twopointsix.keys';
/** the rows whose keys in the build are not their own codes, while `qFree` is on: row id → its keys ([] = none) */
const FREED: Record<string, string[]> = { KeyQ: [] };
/** the row the build has on another key than its code names, while `qCmd` is on (and `qFree`: Q is the wall's without it): row id → its keys */
const MOVED: Record<string, string[]> = { KeyB: ['KeyQ'] };
/** the rows the build has elsewhere while empty hands are a slot (the header's note): row id → its keys ([] = none) */
const SLOT: Record<string, string[]> = { KeyE: [], Digit0: ['Backquote'], Backquote: ['Backslash'] };
/** …and the row a line of words means by another row's letter then */
const ALIAS: Record<string, string> = { KeyE: 'Digit0' };
const SLOT_ID = SLOT_ACT.id;
const dormant = (id: string) => id === SLOT_ID && !slotNow();
/** the rows there are right now */
export const keyRows = (): KeyAct[] => slotNow() ? WITH_SLOT : KEY_ACTS;
/** are empty hands a slot in the build right now */
export const slotNow = () => !!KEYMAP.slotWhen && KEYMAP.slotWhen();
/** is Q the squad's command key in the build right now */
export const cmdOnQ = () => KEYMAP.qCmd && KEYMAP.qFree;
/** a row whose keys in the build move with the switches: its kept entry is never folded into 'as built' */
const special = (id: string) => !!FREED[id] || !!MOVED[id] || !!SLOT[id];
/** a row's keys in the build, now (the wall hold never falls back to Q while Q is the command's) */
const freeNow = () => KEYMAP.qFree && (KEYMAP.qCmd || (KEYMAP.freeWhen ? KEYMAP.freeWhen() : true));
const home = (a: KeyAct): string[] => (cmdOnQ() ? MOVED[a.id] : undefined) ?? (slotNow() ? SLOT[a.id] : undefined) ?? (freeNow() ? FREED[a.id] : undefined) ?? a.codes;
const same = (x: string[], y: string[]) => x.length === y.length && x.every((c, i) => c === y[i]);

/** row id → its key now (null = none). Only rows that are NOT as built are in it */
const bound = new Map<string, string | null>();
/** key on the board → the code the game is given ('' = a key whose row moved away). null = nothing rebound: every key is itself */
let map: Map<string, string> | null = null;
/** the switches `map` and the words were built under: a reader that finds them moved builds again */
let builtOn = false, builtFree = false, builtCmd = false, builtSlot = false;
type Words = { re: RegExp; to: Map<string, string> } | null;
let text: Words = null, textAll: Words = null;
const byId = new Map<string, KeyAct>(), byCap = new Map<string, KeyAct>();
for (const a of WITH_SLOT) { byId.set(a.id, a); byCap.set(a.cap.toLowerCase(), a); }

/** A code a key on a board can have ('KeyK', 'Numpad1', 'IntlBackslash'): letters and digits, nothing else */
const CODE = /^[A-Za-z][A-Za-z0-9]{1,23}$/;
/** THE GAME PAGE, as it boots (main.ts, before anything is drawn): the player's keys are live here unless `?keybinds=0`, and what this machine kept is read */
export function keysBoot(q: URLSearchParams) {
  KEYMAP.on = q.get('keybinds') !== '0'; KEYMAP.qFree = q.get('qfree') !== '0'; KEYMAP.qCmd = !q.has('bkey');
  try { const v = JSON.parse((globalThis as any).localStorage?.getItem(LS) ?? 'null'); if (v && typeof v === 'object') adopt(v); } catch { /* no store */ }
}
/** take a kept table: only what is whole is taken (a row we have, a key that may be one, no key twice); anything else leaves that row as built */
function adopt(v: Record<string, unknown>) {
  bound.clear(); const taken = new Set<string>();
  for (const a of WITH_SLOT) { const k = v[a.id]; if (k === null) bound.set(a.id, null); else if (typeof k === 'string' && CODE.test(k) && !FIXED.test(k) && !taken.has(k) && (special(a.id) || !(a.codes.length === 1 && k === a.id))) { bound.set(a.id, k); taken.add(k); } }   // (a freed or moved row's own key is kept as he set it: the header's note)
  // a row still as built whose key a kept row took is left without that key: with another of its own it keeps that one, else it has none
  for (const a of keyRows()) { if (bound.has(a.id) || special(a.id)) continue; const h = home(a), free = h.filter(c => !taken.has(c)); if (free.length < h.length) { bound.set(a.id, free[0] ?? null); if (free[0]) taken.add(free[0]); } }   // (a freed row is given no entry it was not kept with: keysNow leaves it without a key another row holds)
  tidy(); rebuild();
}
function keep() { try { const o: Record<string, string | null> = {}; for (const [id, k] of bound) o[id] = k; const S = (globalThis as any).localStorage; if (bound.size) S?.setItem(LS, JSON.stringify(o)); else S?.removeItem(LS); } catch { /* no store */ } }
/** the words that make a letter beside them a place's, never a key's ('room B', 'B wing') */
const PLACES = ['room', 'door', 'wing', 'block', 'side', 'team', 'gate', 'stair', 'stairs', 'hall', 'cell', 'lab', 'bay', 'dock', 'zone', 'sector', 'floor', 'level', 'exit', 'post', 'squad', 'element', 'lane', 'route', 'point', 'site', 'building', 'plan', 'company', 'section', 'junction', 'change'];
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** a row is as built again when it sits on one of its own keys and nobody has the others: Shift given back its right key is plain Shift */
function tidy() {
  for (const [id, k] of [...bound]) { const a = byId.get(id)!; if (k === null || special(id) || !a.codes.includes(k)) continue;   // (a freed or moved row is kept as he set it)
    const others = a.codes.filter(c => c !== k); if (others.every(c => ![...bound].some(([o, ok]) => o !== id && ok === c))) bound.delete(id); }
}
function rebuild() {
  KEYMAP.rev++; map = null; text = textAll = null; builtOn = KEYMAP.on; builtFree = freeNow(); builtCmd = cmdOnQ(); builtSlot = slotNow();
  // every row that is not on the keys its code names: the player's own (while `on`), and the rows the build itself moved (`FREED`)
  const moved: [string, string | null][] = [];
  for (const a of keyRows()) { const ks = keysNow(a); if (!same(ks, a.codes)) moved.push([a.id, ks[0] ?? null]); }   // (the slot's row with the slot off is no row: the 0 key is itself, or the row's it was given to)
  if (!moved.length) return;
  map = new Map();
  for (const [id, k] of moved) if (k) map.set(k, id);
  for (const [id] of moved) for (const c of byId.get(id)!.codes) if (!map.has(c)) map.set(c, '');
  // THE NAMES IN WORDS (the header's note): a moved row's cap standing alone, the place guards round it; its lowercase where the order menu writes one
  // ('x closes', 'wheel + space', 'shift+enter'); a digit where the words say key; the walk keys and every digit where the line is a list of keys (`all`)
  const place = PLACES.flatMap(w => [w, w[0].toUpperCase() + w.slice(1), w.toUpperCase()]).join('|');
  const L = `(?<![A-Za-z0-9\\-])(?<!\\b(?:${place}) )(?<!\\b(?!(?:Press|Hold|Tap|Hit|Then|Or|And|With|On|Use)\\b)[A-Z][a-z]+ )`, R = `(?![A-Za-z0-9'’\\-])(?! (?:${place})\\b)`;
  const mk = (all: boolean): Words => {
    const to = new Map<string, string>(), alts: string[] = [];
    for (const [id, k] of moved) { if (!k && FREED[id] && freeNow()) continue;   // (freed and unbound: the letter is not the row's — the header's note)
      if (id === SLOT_ID && !all) continue;   // (the slot's cap in the build, '0', is a count in a line of words, never a key: only a list of keys names it)
      const as = slotNow() && !k ? ALIAS[id] : undefined;   // (…or it is another row's while empty hands are a slot and E's row has no key of its own: that row's key now)
      const a = byId.get(id)!, now = as ? capNow(as) : k ? keyLabel(k) : NONE, c = esc(a.cap), low = a.cap.toLowerCase(); if (now === a.cap) continue;
      const walk = /^Key[WASD]$/.test(id), digit = /^Digit\d$/.test(id);
      if (walk && !all) continue;
      to.set(a.cap, now);
      if (digit && !all) { alts.push(`(?<=\\b(?:then|press|tap|key) )${c}(?![A-Za-z0-9])`, `(?<![A-Za-z0-9])${c}(?= again\\b)`); continue; }
      alts.push(`${L}${c}${R}`);
      if (low === a.cap) continue;
      to.set(low, now.toLowerCase());
      if (a.cap.length > 1) alts.push(`(?<=\\+ ?)${esc(low)}(?![A-Za-z0-9])`, `(?<![A-Za-z0-9])${esc(low)}(?= ?\\+)`);
      else alts.push(`(?<![A-Za-z0-9])${low}(?= closes\\b| / )`); }
    return alts.length ? { re: new RegExp(alts.join('|'), 'g'), to } : null;
  };
  text = mk(false); textAll = mk(true);
}

/** a row with no key: its cap */
export const NONE = '—';
const NAMES: Record<string, string> = { Space: 'Space', ShiftLeft: 'Shift', ShiftRight: 'R Shift', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';', Quote: '\'', Comma: ',', Period: '.', Slash: '/',
  Backspace: 'Bksp', Delete: 'Del', Insert: 'Ins', PageUp: 'PgUp', PageDown: 'PgDn', Home: 'Home', End: 'End', IntlBackslash: '\\', IntlRo: 'Ro', IntlYen: '¥',
  NumpadAdd: 'Num +', NumpadSubtract: 'Num -', NumpadMultiply: 'Num *', NumpadDivide: 'Num /', NumpadDecimal: 'Num .', NumpadEqual: 'Num =', NumpadComma: 'Num ,' };
/** the cap of a key on the board, by where it is (the code): 'KeyR' → 'R' */
export function keyLabel(code: string): string {
  const n = NAMES[code]; if (n) return n;
  let m = /^Key([A-Z])$/.exec(code); if (m) return m[1];
  m = /^Digit(\d)$/.exec(code); if (m) return m[1];
  m = /^Numpad(\d)$/.exec(code); if (m) return `Num ${m[1]}`;
  return code;
}
/** the key a press on the board gives the game: itself while nothing is rebound; the row's own code where a row was put on it; '' where its row moved away */
export function gameCode(code: string): string { fresh(); if (!map) return code; const to = map.get(code); return to === undefined ? code : to; }
/** a row's keys now: the player's while his table is live and holds the row, else the build's */
function keysNow(a: KeyAct): string[] { if (!KEYMAP.on) return home(a); if (bound.has(a.id)) { const k = bound.get(a.id); return k ? [k] : []; }
  if (!(special(a.id) && bound.size)) return home(a);
  const held = [...bound.values()], h0 = home(a), h = h0.filter(c => !held.includes(c));
  if (h.length || !h0.length || !(MOVED[a.id] || (slotNow() && SLOT[a.id]))) return h;   // (a row the build gives no key has none to lose)
  return a.codes.filter(c => !held.includes(c) && !keyRows().some(o => o !== a && home(o).includes(c))); }   // (…and a row the slot moved, its key in the build given to another row by hand: its own code's key, while that is no other row's in the build — the slot on 0; the debugger then has none, backtick being the slot's)   // (the command's Q held by a row he put there: it is on its own code's key, B, if that is free — never on no key while one of the two is)   // (a freed row back on its old key because walking in was switched off, and that key given to another row meanwhile: it has none)
function fresh() { if (builtOn !== KEYMAP.on || builtFree !== freeNow() || builtCmd !== cmdOnQ() || builtSlot !== slotNow()) rebuild(); }
/** is a row on the keys the build gives it (what a cap marks as moved when it is not) */
export function keyBuilt(id: string): boolean { const a = byId.get(id); return !a || same(keysNow(a), home(a)); }
/** the keys of a row now: as built, its one key, or none */
export function keysOf(id: string): string[] { const a = byId.get(id); return a && !dormant(id) ? keysNow(a) : []; }
/** is a row one the build gives no key right now (the wall hold's, while walking in works) */
export function keyFreed(id: string): boolean { return freeNow() && !!FREED[id]; }
/** the cap of a row now ('—' with no key) */
export function capNow(id: string): string { const a = byId.get(id); if (!a) return id; const as = slotNow() ? ALIAS[id] : undefined; if (as && !keysNow(a).length) return capNow(as); const ks = keysNow(a); return same(ks, a.codes) ? a.cap : ks[0] ? keyLabel(ks[0]) : NONE; }
/** the row a cap of the build names ('f', 'Space', '2'), if it names one */
export function actOfCap(cap: string): KeyAct | null { return byCap.get(cap.toLowerCase()) ?? null; }
/** a cap the HUD was handed, as it is bound now. Anything that is no row's cap ('LMB', '×') is handed back */
export function keyCap(cap: string): string { fresh(); if (!map) return cap; const a = byCap.get(cap.toLowerCase()); if (!a || same(keysNow(a), a.codes)) return cap; const now = capNow(a.id); return cap === cap.toUpperCase() && cap !== cap.toLowerCase() ? now.toUpperCase() : now; }
/** a line of words with the keys it names as they are bound now. `all` = the line is a list of keys (the Controls list's key column): the walk keys and the
 *  digits are keys there too. Handed back untouched, the same string, while nothing is rebound */
export function keyText(s: string, all = false): string {
  fresh(); if (!map || !s) return s;
  const T = all ? textAll : text; if (!T) return s;
  T.re.lastIndex = 0; return s.replace(T.re, m => T.to.get(m) ?? m);
}
/** is anything not as built (what Reset has to undo) */
export function keysChanged(): boolean { return KEYMAP.on && bound.size > 0 && keyRows().some(a => !same(keysNow(a), home(a))); }
/** who has `code` now (never `but`) */
function holder(code: string, but: string): KeyAct | null { for (const a of keyRows()) if (a.id !== but && keysOf(a.id).includes(code)) return a; return null; }
/** may a row be put on this key at all */
export function keyFree(code: string): boolean { return !FIXED.test(code); }
function settle(a: KeyAct, k: string | null) { if (!(KEYMAP.qFree && FREED[a.id]) && !(cmdOnQ() && MOVED[a.id]) && !(slotNow() && SLOT[a.id]) && k !== null && a.codes.length === 1 && k === a.id) bound.delete(a.id); else bound.set(a.id, k); }   // (as built again: no entry. A freed or moved row is kept as he set it)
/** PUT A ROW ON A KEY. 'fixed' = the page's own key, nothing changed; else the row has it, and `swapped` names the row that had it and took this one's
 *  old key in exchange (none to give: it is left with no key) */
export function bindKey(id: string, code: string): { ok: boolean; why?: 'fixed' | 'off'; swapped?: string } {
  const a = byId.get(id); if (!a || !KEYMAP.on || dormant(id)) return { ok: false, why: 'off' };
  if (!keyFree(code)) return { ok: false, why: 'fixed' };
  const mine = keysOf(id); if (mine.length === 1 && mine[0] === code) return { ok: true };
  const other = holder(code, id); let swapped: string | undefined;
  if (other) { const theirs = keysOf(other.id).filter(c => c !== code);   // (a row with two keys in the build that loses one keeps the other: Right Shift taken leaves Shift on the left)
    const give = theirs.length ? theirs[0] : mine.find(c => c !== code) ?? null;
    if (give === null && MOVED[other.id]) bound.delete(other.id); else settle(other, give); swapped = other.id; }   // (the command with nothing handed back keeps no entry: keysNow puts it on B while B is free)
  settle(a, code); tidy(); rebuild(); keep(); return { ok: true, swapped };
}
/** leave a row with no key */
export function unbindKey(id: string) { if (!byId.has(id) || !KEYMAP.on || dormant(id)) return; bound.set(id, null); tidy(); rebuild(); keep(); }
/** every key as built */
export function resetKeys() { if (!KEYMAP.on || !bound.size) return; bound.clear(); rebuild(); keep(); }
/** the table as kept ({} = as built), and a table put in its place: what a check stages, and the page's `__keys` */
export function keysKept(): Record<string, string | null> { const o: Record<string, string | null> = {}; for (const [id, k] of bound) o[id] = k; return o; }
export function setKeys(v: Record<string, string | null>, write = false) { adopt(v); if (write) keep(); }
