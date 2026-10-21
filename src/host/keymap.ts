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
// does; what changed is the board: nothing on it gives that code until the player puts the row on a key here (Q itself, if he likes: it is then a rebind like
// any other, kept, and Reset takes it off again). Q pressed with the row unbound files nothing. OFF IN THE MODULE like the rest; the game page turns it on as
// it boots, `?qfree=0` = Q takes the wall as it did. It does not wait on `on`: `?keybinds=0` is the build's own board, and the build's own board has no wall key.
// A second thing wanting Q asks the game for a code of its own and is given Q here (`FREED`'s neighbour, a row whose build key is not its code's).
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
/** the page's own: never a row's key (Esc the pause, Enter the checkpoint, Tab the way back, the arrows the highlight, the F row the browser's and the
 *  recorders', the modifiers the camera's and the browser's, P [ ] the showcase's and the exposure's, Caps Lock a key some boards only ever press) */
const FIXED = /^(Escape|Enter|NumpadEnter|Tab|Arrow(Up|Down|Left|Right)|F\d{1,2}|(Control|Alt|Meta|OS)(Left|Right)?|KeyP|BracketLeft|BracketRight|CapsLock|ContextMenu|NumLock|ScrollLock|Pause|PrintScreen|Unidentified|)$/;
export const KEYMAP = { /** false = the build's own keys, whatever is kept: the module's own stand (a tool, the editor, the viewer), and the page's under `?keybinds=0` */ on: false,
  /** the wall hold's row has no key in the build (the header's note). false = it is on Q: the module's own stand, and the page's under `?qfree=0` */ qFree: false, /** steps on every change: what a drawn surface keys its cache on */ rev: 0 };
const LS = 'twopointsix.keys';
/** the rows whose keys in the build are not their own codes, while `qFree` is on: row id → its keys ([] = none) */
const FREED: Record<string, string[]> = { KeyQ: [] };
/** a row's keys in the build, now */
const home = (a: KeyAct): string[] => (KEYMAP.qFree ? FREED[a.id] : undefined) ?? a.codes;
const same = (x: string[], y: string[]) => x.length === y.length && x.every((c, i) => c === y[i]);

/** row id → its key now (null = none). Only rows that are NOT as built are in it */
const bound = new Map<string, string | null>();
/** key on the board → the code the game is given ('' = a key whose row moved away). null = nothing rebound: every key is itself */
let map: Map<string, string> | null = null;
/** the switches `map` and the words were built under: a reader that finds them moved builds again */
let builtOn = false, builtFree = false;
type Words = { re: RegExp; to: Map<string, string> } | null;
let text: Words = null, textAll: Words = null;
const byId = new Map<string, KeyAct>(), byCap = new Map<string, KeyAct>();
for (const a of KEY_ACTS) { byId.set(a.id, a); byCap.set(a.cap.toLowerCase(), a); }

/** A code a key on a board can have ('KeyK', 'Numpad1', 'IntlBackslash'): letters and digits, nothing else */
const CODE = /^[A-Za-z][A-Za-z0-9]{1,23}$/;
/** THE GAME PAGE, as it boots (main.ts, before anything is drawn): the player's keys are live here unless `?keybinds=0`, and what this machine kept is read */
export function keysBoot(q: URLSearchParams) {
  KEYMAP.on = q.get('keybinds') !== '0'; KEYMAP.qFree = q.get('qfree') !== '0';
  try { const v = JSON.parse((globalThis as any).localStorage?.getItem(LS) ?? 'null'); if (v && typeof v === 'object') adopt(v); } catch { /* no store */ }
}
/** take a kept table: only what is whole is taken (a row we have, a key that may be one, no key twice); anything else leaves that row as built */
function adopt(v: Record<string, unknown>) {
  bound.clear(); const taken = new Set<string>();
  for (const a of KEY_ACTS) { const k = v[a.id], h = home(a); if (k === null) { if (h.length) bound.set(a.id, null); } else if (typeof k === 'string' && CODE.test(k) && !FIXED.test(k) && !taken.has(k) && !(h.length === 1 && k === h[0])) { bound.set(a.id, k); taken.add(k); } }
  // a row still as built whose key a kept row took is left without that key: with another of its own it keeps that one, else it has none
  for (const a of KEY_ACTS) { if (bound.has(a.id)) continue; const h = home(a), free = h.filter(c => !taken.has(c)); if (free.length < h.length) { bound.set(a.id, free[0] ?? null); if (free[0]) taken.add(free[0]); } }
  tidy(); rebuild();
}
function keep() { try { const o: Record<string, string | null> = {}; for (const [id, k] of bound) o[id] = k; const S = (globalThis as any).localStorage; if (bound.size) S?.setItem(LS, JSON.stringify(o)); else S?.removeItem(LS); } catch { /* no store */ } }
/** the words that make a letter beside them a place's, never a key's ('room B', 'B wing') */
const PLACES = ['room', 'door', 'wing', 'block', 'side', 'team', 'gate', 'stair', 'stairs', 'hall', 'cell', 'lab', 'bay', 'dock', 'zone', 'sector', 'floor', 'level', 'exit', 'post', 'squad', 'element', 'lane', 'route', 'point', 'site', 'building', 'plan', 'company', 'section', 'junction', 'change'];
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** a row is as built again when it sits on one of its own keys and nobody has the others: Shift given back its right key is plain Shift */
function tidy() {
  for (const [id, k] of [...bound]) { const a = byId.get(id)!, h = home(a); if (k === null) { if (!h.length) bound.delete(id); continue; }   // (a row the build gives no key, left with none: as built)
    if (!h.includes(k)) continue;
    const others = h.filter(c => c !== k); if (others.every(c => ![...bound].some(([o, ok]) => o !== id && ok === c))) bound.delete(id); }
}
function rebuild() {
  KEYMAP.rev++; map = null; text = textAll = null; builtOn = KEYMAP.on; builtFree = KEYMAP.qFree;
  // every row that is not on the keys its code names: the player's own (while `on`), and the rows the build itself moved (`FREED`)
  const moved: [string, string | null][] = [];
  for (const a of KEY_ACTS) { const ks = keysNow(a); if (!same(ks, a.codes)) moved.push([a.id, ks[0] ?? null]); }
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
    for (const [id, k] of moved) { const a = byId.get(id)!, now = k ? keyLabel(k) : NONE, c = esc(a.cap), low = a.cap.toLowerCase(); if (now === a.cap) continue;
      const walk = /^Key[WASD]$/.test(id), digit = /^Digit\d$/.test(id);
      if (walk && !all) continue;
      to.set(a.cap, now);
      if (!k) { alts.push(` ?\\(${c}\\)`); to.set(` (${a.cap})`, ''); to.set(`(${a.cap})`, ''); }   // (a key named in brackets as the other way to do a thing, and its row has none: the brackets go with it. First among the row's patterns, so the bare cap inside is never met alone)
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
function keysNow(a: KeyAct): string[] { if (!KEYMAP.on || !bound.has(a.id)) return home(a); const k = bound.get(a.id); return k ? [k] : []; }
function fresh() { if (builtOn !== KEYMAP.on || builtFree !== KEYMAP.qFree) rebuild(); }
/** is a row on the keys the build gives it (what a cap marks as moved when it is not) */
export function keyBuilt(id: string): boolean { const a = byId.get(id); return !a || same(keysNow(a), home(a)); }
/** the keys of a row now: as built, its one key, or none */
export function keysOf(id: string): string[] { const a = byId.get(id); return a ? keysNow(a) : []; }
/** the cap of a row now ('—' with no key) */
export function capNow(id: string): string { const a = byId.get(id); if (!a) return id; const ks = keysNow(a); return same(ks, a.codes) ? a.cap : ks[0] ? keyLabel(ks[0]) : NONE; }
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
export function keysChanged(): boolean { return KEYMAP.on && bound.size > 0; }
/** who has `code` now (never `but`) */
function holder(code: string, but: string): KeyAct | null { for (const a of KEY_ACTS) if (a.id !== but && keysOf(a.id).includes(code)) return a; return null; }
/** may a row be put on this key at all */
export function keyFree(code: string): boolean { return !FIXED.test(code); }
function settle(a: KeyAct, k: string | null) { const h = home(a); if (k === null ? !h.length : h.length === 1 && k === h[0]) bound.delete(a.id); else bound.set(a.id, k); }
/** PUT A ROW ON A KEY. 'fixed' = the page's own key, nothing changed; else the row has it, and `swapped` names the row that had it and took this one's
 *  old key in exchange (none to give: it is left with no key) */
export function bindKey(id: string, code: string): { ok: boolean; why?: 'fixed' | 'off'; swapped?: string } {
  const a = byId.get(id); if (!a || !KEYMAP.on) return { ok: false, why: 'off' };
  if (!keyFree(code)) return { ok: false, why: 'fixed' };
  const mine = keysOf(id); if (mine.length === 1 && mine[0] === code) return { ok: true };
  const other = holder(code, id); let swapped: string | undefined;
  if (other) { const theirs = keysOf(other.id).filter(c => c !== code);   // (a row with two keys in the build that loses one keeps the other: Right Shift taken leaves Shift on the left)
    settle(other, theirs.length ? theirs[0] : mine.find(c => c !== code) ?? null); swapped = other.id; }
  settle(a, code); tidy(); rebuild(); keep(); return { ok: true, swapped };
}
/** leave a row with no key */
export function unbindKey(id: string) { if (!byId.has(id) || !KEYMAP.on) return; bound.set(id, null); tidy(); rebuild(); keep(); }
/** every key as built */
export function resetKeys() { if (!KEYMAP.on || !bound.size) return; bound.clear(); rebuild(); keep(); }
/** the table as kept ({} = as built), and a table put in its place: what a check stages, and the page's `__keys` */
export function keysKept(): Record<string, string | null> { const o: Record<string, string | null> = {}; for (const [id, k] of bound) o[id] = k; return o; }
export function setKeys(v: Record<string, string | null>, write = false) { adopt(v); if (write) keep(); }
