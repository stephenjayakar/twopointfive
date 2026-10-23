// THE PLAYER'S OWN KEYS — the check behind host/keymap.ts (Options ▸ Controls rebinds a key; kept per machine; `?keybinds=0` = the build's own for a visit).
//   bun run tools/qa/probes.ts keybinds                        (family `player`; run it on BOTH stands: TPS_PROFILE=shipped in front for the page's)
//   KEYBINDS_BREAK=1 = a stray kept table (W moved to I) is on the machine while the 'nothing rebound' lines are asked: must FAIL
//   QFREE_BREAK=1 = the board as it was (the wall hold on Q) while the 'no wall key' lines are asked: must FAIL
// WHAT IT HOLDS:
//   the table      off in the module (a tool, the editor, the viewer: the build's keys whatever is kept); the page's boot turns it on · nothing rebound = every key is itself and every line of words comes back the same string · a row put on a key: that key gives the row's
//                  own code, the key it left gives nothing, the names follow · a key another row has is a swap, and after 4,000 moves by a die no key has
//                  two rows and no row a key that is not its own · the page's own keys are refused · no key · Reset · a kept table is cleaned as it is read ·
//                  it is written to the machine's store and read back the same · `?keybinds=0` plays the build's keys and leaves the kept ones kept
//   the keyboard   game/input.ts's own listeners, on a window that is a list of them: a script of keys down and up files, with nothing rebound, exactly the
//                  codes it filed before this file existed (each press's code, once; let go when let go); with rows moved it files the SAME codes off the
//                  new keys; a key rebound while it is down still lets go of what its press put down
//   the game       on the stand this run is on: one script of hands (walk, turn, crouch, the rifle, a reload, the wall, Space) played three ways into a fresh
//                  game each — the codes written straight in as every tool writes them · the same keys through the listener with nothing rebound · the keys
//                  of a rebound board through the listener — ends in ONE digest. That is 'the build as it was' and 'a recording plays the same whatever is
//                  rebound': the game, its journal and a tape see the codes, never the board.
//   no wall key    (`KEYMAP.qFree`, the page's board) the boot turns it on, `?qfree=0` off, and `?keybinds=0` leaves it on · Q files nothing and every other key is
//                  itself; the row reads —, as built, nothing to reset; no line of words is rewritten for it · with the walk-in switched off the row is on
//                  Q again there and then · the row put on Q is a rebind like any other (kept, read back, Reset takes it off) and is kept through a spell
//                  on the board as it was; on another key, that key · Q given to another row is that row's, and the wall's row asking for it back is a
//                  swap · a table kept on the board as it was is read as it was meant · 4,000 moves by a die with the walk-in going off and on leave no
//                  key with two rows, and the kept table read back plays the same · the game on this stand: Q through the keyboard beside a wall takes
//                  nothing, the code written straight in (a recording, a probe) takes it as it did, and so does the key the row was put on · and both
//                  lessons' wall steps are done by a held move key, as their lines now say
// NOT HERE: the screen itself (the caps, the wait, the shake) and the HUD's words on a page — tools/qa/keybinds-page.cjs drives those in a browser.
import { standUp, ROOT } from './headless.ts';
const DT = 1 / 60;
export async function keybindsCheck(): Promise<boolean> {
  const BRK = process.env.KEYBINDS_BREAK === '1'; let all = true;
  const verdict = (ok: boolean, what: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}\n    ${detail}`); };
  console.log(`\n=== keybinds: the player's own keys${BRK ? ' (a stray kept table: must fail)' : ''} ===`);
  const G: any = globalThis, had = { localStorage: G.localStorage, window: G.window, document: G.document };
  const stubs: string[] = [];
  const store = new Map<string, string>(); G.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, String(v)); }, removeItem: (k: string) => { store.delete(k); } };
  const K = await import(`${ROOT}/src/host/keymap.ts`); const { Input } = await import(`${ROOT}/src/game/input.ts`);
  const { digestGame, hashDigest, diffDigest } = await import(`${ROOT}/src/game/digest.ts`);
  const log = console.log, err = console.error, warn = console.warn;
  const quiet = async <T>(f: () => T | Promise<T>): Promise<T> => { console.log = console.error = console.warn = () => { }; try { return await f(); } finally { console.log = log; console.error = err; console.warn = warn; } };
  const asBuilt = () => K.setKeys(BRK ? { KeyW: 'KeyI' } : {});
  const BOARD = [...K.KEY_ACTS.flatMap((a: any) => a.codes), 'KeyI', 'KeyJ', 'KeyK', 'KeyM', 'KeyO', 'KeyU', 'KeyY', 'KeyP', 'Digit6', 'Digit0', 'Minus', 'Backslash', 'Quote', 'Slash', 'Backspace', 'Numpad1', 'Escape', 'Enter', 'Tab', 'ArrowUp', 'ArrowDown', 'F5', 'F7', 'ControlLeft', 'AltLeft', 'MetaLeft', 'BracketLeft', 'BracketRight', 'CapsLock'];
  const WORDS = ['you\'re empty. press R to reload', 'click — empty (R to reload)', 'stacked and set. press F to send them in', 'setting the charge… — Space or a step breaks it off', 'slung · E', 'L LIGHT', 'N NIGHT VISION', 'the wall is in the way, so step out past its end or come off it', 'press Q or Shift, or step away, to let go',
    'breach called off, and the squad takes your orders now (X). press Shift+Enter to restart', 'failed — spotted · press shift+enter to restart', 'on the east door · WATCHED by Red One · press F to go anyway', 'W A S D', '1 2 3 4 5', 'X · B · T · F', 'Z · R', 'L · N · V', 'Esc · `',
    'The game saves a checkpoint by itself', 'room B is clear', '3 of 4 left · X on a spot of floor, G, then 3', 'hostage rescue. you and Red. nobody knows you\'re here yet. Press F to stack up and F again to go, or X for orders', 'KEY · VAULT', 'DOWN — ENTER'];
  try {
    // ---- the table
    { K.setKeys({ KeyW: 'KeyI', KeyR: 'KeyK' });   // the module as a tool, the editor and the viewer load it: off, whatever the machine has kept
      const off = K.KEYMAP.on === false && BOARD.every(c => K.gameCode(c) === c) && WORDS.every(s => K.keyText(s, true) === s) && K.capNow('KeyR') === 'R' && !K.bindKey('KeyC', 'KeyK').ok;
      K.resetKeys(); const keptStill = Object.keys(K.keysKept()).length === 2;
      const q = (s: string) => { K.keysBoot(new URLSearchParams(s)); return K.KEYMAP.on; }; store.set('twopointsix.keys', '{"KeyC":"KeyK"}');
      const zero = q('keybinds=0') === false && K.gameCode('KeyK') === 'KeyK', page = q('paused&quality=low') === true && K.gameCode('KeyK') === 'KeyC'; store.clear();
      K.KEYMAP.qFree = false; K.KEYMAP.setFree = false; K.KEYMAP.qOnly = false;   // (the selector's row and the light's on Z and L likewise: the rows the gun's setup frees are slotsetup-check.ts's · the squad's own two rows on their keys too: `probes.ts qonly` has the page's)
      // (the boot turned the page's board on: every line down to 'no wall key' is asked on the board as it was, the wall hold on Q)
      verdict(off && keptStill && zero && page, 'off in the module: with a table kept, every key is itself, nothing can be moved or reset; the page\'s boot turns it on and reads the kept table, and ?keybinds=0 leaves it off',
        `module: on ${!off ? 'or moved' : 'false, as built'} · Reset while off left the table ${keptStill} · ?keybinds=0: off ${zero} · the page: on, K is crouch ${page}`); K.KEYMAP.on = true; }
    { asBuilt();
      const moved = BOARD.filter(c => K.gameCode(c) !== c), said = WORDS.filter(s => K.keyText(s) !== s || K.keyText(s, true) !== s), caps = K.KEY_ACTS.filter((a: any) => K.keyCap(a.cap) !== a.cap || K.capNow(a.id) !== a.cap || K.keysOf(a.id).join() !== a.codes.join());
      verdict(!moved.length && !said.length && !caps.length && !K.keysChanged(), 'nothing rebound: every key is itself, every line of words comes back the same string, every cap is the build\'s',
        `${BOARD.length} keys, ${moved.length} not themselves${moved.length ? ` (${moved.join(' ')})` : ''} · ${WORDS.length} lines, ${said.length} changed${said.length ? ` ('${said[0]}')` : ''} · ${K.KEY_ACTS.length} rows, ${caps.length} not as built · anything to reset: ${K.keysChanged()}`); }
    { K.setKeys({}); const r = K.bindKey('KeyR', 'KeyK');
      const a = K.gameCode('KeyK'), b = K.gameCode('KeyR'), rest = BOARD.filter(c => c !== 'KeyK' && c !== 'KeyR' && K.gameCode(c) !== c);
      const t1 = K.keyText('you\'re empty. press R to reload'), t2 = K.keyText('click — empty (R to reload)'), t3 = K.keyText('Z · R', true), t4 = K.keyText('room R is clear · Reload · RING'), c1 = K.keyCap('R'), c2 = K.keyCap('r'), c3 = K.keyCap('LMB');
      K.bindKey('KeyB', 'KeyY'); K.bindKey('KeyT', 'KeyU'); K.bindKey('ShiftLeft', 'KeyO'); K.bindKey('KeyX', 'KeyJ'); K.bindKey('Space', 'KeyM'); K.bindKey('Digit3', 'Quote'); K.bindKey('Backquote', 'Backslash');
      const SAID: [string, string, boolean?][] = [['A to B door', 'A to B door'], ['T-junction · Vault B · B wing · Block B', 'T-junction · Vault B · B wing · Block B'], ['Shift change at the gate', 'Shift change at the gate'], ['B: the usual order · T who', 'Y: the usual order · U who'],
        ['Hold Shift · Shift+Enter restarts · press Shift+Enter to restart · press shift+enter to restart', 'Hold O · O+Enter restarts · press O+Enter to restart · press o+enter to restart'], ['Press F to stack up, or X for orders · X for your orders', 'Press F to stack up, or J for orders · J for your orders'], ['picking the lock. take a step or press Space to stop', 'picking the lock. take a step or press M to stop'], ['tab / right click: back · x closes', 'tab / right click: back · j closes'], ['digit, or wheel + space / middle click · x / tab / right click closes', 'digit, or wheel + m / middle click · j / tab / right click closes'],
        ['X on the ground, then 3: he falls in behind you', 'J on the ground, then \': he falls in behind you'], ['3 of 4 left · 3 men', '3 of 4 left · 3 men'], ['Esc pauses · ` opens the debugger (every knob)', 'Esc pauses · \\ opens the debugger (every knob)'], ['1 2 3 4 5', '1 2 \' 4 5', true], ['Space or a step breaks off', 'M or a step breaks off']];
      const wrong = SAID.filter(([s, want, all]) => K.keyText(s, !!all) !== want).map(([s, , all]) => `'${s}' → '${K.keyText(s, !!all)}'`);
      verdict(r.ok && !r.swapped && !wrong.length && a === 'KeyR' && b === '' && !rest.length && t1 === 'you\'re empty. press K to reload' && t2 === 'click — empty (K to reload)' && t3 === 'Z · K' && t4 === 'room R is clear · Reload · RING' && c1 === 'K' && c2 === 'K' && c3 === 'LMB' && K.capNow('KeyR') === 'K',
        'Reload put on K: K gives the game its R, the R key gives nothing, every other key is itself; the words and the caps say K, and an R that is no key (a room\'s letter, a word) is left',
        `K → '${a}', R → '${b}', others moved ${rest.length} · '${t1}' · '${t2}' · '${t3}' · '${t4}' · caps ${c1} ${c2} ${c3} · ${SAID.length} lines with B T Shift X Space 3 and the backtick moved: ${wrong.length ? wrong.join(' · ') : 'each as it should read (a place\'s letter left, the menu\'s lowercase and a digit said as a key followed)'}`); }
    { K.setKeys({}); K.bindKey('KeyR', 'KeyK'); const r = K.bindKey('KeyC', 'KeyK');   // crouch takes K, which Reload has: Reload takes C
      const ok1 = r.swapped === 'KeyR' && K.gameCode('KeyK') === 'KeyC' && K.gameCode('KeyC') === 'KeyR' && K.gameCode('KeyR') === '';
      const r2 = K.bindKey('KeyL', 'ShiftRight');   // a row with two keys in the build loses one and keeps the other
      const ok2 = r2.swapped === 'ShiftLeft' && K.gameCode('ShiftRight') === 'KeyL' && K.gameCode('ShiftLeft') === 'ShiftLeft' && K.gameCode('KeyL') === '' && K.capNow('ShiftLeft') === 'Shift';
      const r3 = K.bindKey('KeyC', 'KeyC'), r4 = K.bindKey('KeyR', 'KeyR'), r5 = K.bindKey('KeyL', 'KeyL');   // each put back by hand: the swap undoes itself, and Shift given its right key back is both keys again
      const ok3 = r5.ok && K.gameCode('KeyC') === 'KeyC' && K.gameCode('KeyR') === 'KeyR' && K.gameCode('KeyK') === 'KeyK' && K.gameCode('ShiftRight') === 'ShiftRight' && !K.keysChanged();
      // a die moves rows about: after every move no key has two rows, every row's key gives that row, and a key no row has gives nothing or itself
      let seed = 12345, bad = ''; const rnd = (n: number) => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return (seed >>> 8) % n; };
      const keys = BOARD.filter(c => K.keyFree(c)); K.setKeys({});
      for (let i = 0; i < 4000 && !bad; i++) { const a = K.KEY_ACTS[rnd(K.KEY_ACTS.length)], roll = rnd(20); if (roll === 0) K.unbindKey(a.id); else if (roll === 1 && rnd(8) === 0) K.resetKeys(); else K.bindKey(a.id, keys[rnd(keys.length)]);
        const owner = new Map<string, string>();
        for (const b of K.KEY_ACTS) for (const k of K.keysOf(b.id)) { if (owner.has(k)) bad = `move ${i}: ${k} is ${owner.get(k)}'s and ${b.id}'s`; owner.set(k, b.id); if (K.gameCode(k) !== (b.codes.includes(k) && K.keysOf(b.id).join() === b.codes.join() ? k : b.id)) bad ||= `move ${i}: ${k} is ${b.id}'s and gives '${K.gameCode(k)}'`; }
        for (const k of BOARD) if (!owner.has(k)) { const g = K.gameCode(k), row = K.KEY_ACTS.some((b: any) => b.codes.includes(k)); if (g !== (row ? '' : k)) bad ||= `move ${i}: ${k} is nobody's and gives '${g}'`; } }
      verdict(ok1 && ok2 && r3.ok && r4.ok && ok3 && !bad, 'a key another row has is a swap (the other takes the key this one had; a row with two keys keeps its other one); put back by hand the table is the build\'s again; 4,000 moves by a die leave no key with two rows',
        `crouch onto Reload's K: swapped ${r.swapped}, K C R → '${K.gameCode('KeyK')}' … · light onto Right Shift: sprint keeps the left (${ok2}) · back by hand: as built ${ok3} · the die: ${bad || 'clean'}`); }
    { K.setKeys({}); const fixed = ['Escape', 'Enter', 'NumpadEnter', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F5', 'F7', 'F10', 'ControlLeft', 'AltRight', 'MetaLeft', 'KeyP', 'BracketLeft', 'BracketRight', 'CapsLock', ''];
      const took = fixed.filter(k => K.bindKey('KeyC', k).ok), still = !K.keysChanged();
      K.bindKey('KeyQ', 'KeyJ'); K.unbindKey('KeyE'); const none = K.gameCode('KeyE') === '' && K.capNow('KeyE') === K.NONE && K.keysOf('KeyE').length === 0 && K.keyText('slung · E') === `slung · ${K.NONE}`;
      const r = K.bindKey('KeyE', 'KeyJ'), gave = r.swapped === 'KeyQ' && K.keysOf('KeyQ').length === 0 && K.gameCode('KeyJ') === 'KeyE';   // (a row with no key takes one a row has: that row is left with none, and is named)
      K.resetKeys(); const back = !K.keysChanged() && BOARD.every(c => K.gameCode(c) === c) && store.get('twopointsix.keys') === undefined;
      verdict(!took.length && still && none && gave && back, 'the page\'s own keys are refused and change nothing; a row can be left with no key; a row with no key that takes another\'s leaves that one with none; Reset is the build\'s keys, and nothing kept',
        `${fixed.length} of the page's keys, ${took.length} taken · no key: ${none} · took Q's J from no key: Q has ${K.keysOf('KeyQ').length} · after Reset: as built ${back}`); }
    { K.setKeys({}); K.bindKey('KeyL', 'KeyE'); K.bindKey('KeyN', 'KeyG'); K.unbindKey('KeyZ'); const tableNow = () => JSON.stringify(Object.entries(K.keysKept()).sort()); const kept = store.get('twopointsix.keys') ?? '', table = tableNow();
      const codes = BOARD.map(c => K.gameCode(c)).join();
      K.setKeys({}); K.setKeys(JSON.parse(kept || '{}')); const again = BOARD.map(c => K.gameCode(c)).join() === codes && tableNow() === table;   // (a page load: the store read back)
      K.KEYMAP.on = false; const off = BOARD.every(c => K.gameCode(c) === c) && WORDS.every(s => K.keyText(s, true) === s) && K.capNow('KeyL') === 'L' && !K.bindKey('KeyC', 'KeyK').ok && tableNow() === table; K.KEYMAP.on = true;
      K.setKeys({ KeyC: 'KeyK', KeyR: 'KeyK', KeyQ: 'Tab', Nope: 'KeyM', KeyV: 7, KeyX: 'KeyB', KeyZ: '<img src=x>' } as any);   // a kept table gone wrong: one key twice, a page's key, a row we have not, a number, a key a row still has, words that are no key
      const clean = K.gameCode('KeyK') === 'KeyC' && K.gameCode('KeyR') === 'KeyR' && K.gameCode('KeyQ') === 'KeyQ' && K.gameCode('KeyM') === 'KeyM' && K.gameCode('KeyV') === 'KeyV' && K.gameCode('KeyB') === 'KeyX' && K.keysOf('KeyB').length === 0 && K.capNow('KeyZ') === 'Z';
      verdict(kept.length > 2 && again && off && clean, 'a moved key is written to the machine and read back the same on the next load; with ?keybinds=0 the board is the build\'s and the kept table is left alone; a kept table gone wrong is cleaned row by row',
        `kept: ${kept} · read back the same: ${again} · off: the build's keys, the table kept ${off} · a bad table: one row per key, the page's keys and strangers dropped ${clean}`); }

    // ---- the keyboard: game/input.ts's own listeners, on a window that is a list of them
    const listeners: Record<string, ((e: any) => void)[]> = {};
    for (const n of ['HTMLInputElement', 'HTMLSelectElement', 'HTMLTextAreaElement', 'HTMLElement']) if (!G[n]) { G[n] = class { }; stubs.push(n); }   // (what the listener asks of a key's target)
    const win: any = { addEventListener: (t: string, f: (e: any) => void) => { (listeners[t] ??= []).push(f); } }; win.top = win.self = win;
    const el = { addEventListener() { }, getBoundingClientRect: () => ({ left: 0, top: 0 }) };
    // (the window is there only while the Input is made: a game stood up afterwards finds no window, as in every other headless run)
    const board = () => { for (const k in listeners) delete listeners[k]; G.window = win; let I: any; try { I = new Input(el as any); } finally { if (had.window === undefined) delete G.window; else G.window = had.window; } const mods = new Set<string>(), mod = (k: string) => [...mods].some(c => c.startsWith(k));   // (the modifiers an event carries are the ones that ARE down, as a browser's are: the listener lets go of a Shift the event says is up — input.ts modsUp — and an event that said `shiftKey: false` with Shift held was a keyboard no browser has)
      const key = (t: 'keydown' | 'keyup', code: string) => { if (/^(Shift|Control|Alt|Meta)/.test(code)) { if (t === 'keydown') mods.add(code); else mods.delete(code); }
        const e = { code, key: /^Shift/.test(code) ? 'Shift' : code.replace(/^Key|^Digit/, '').toLowerCase(), repeat: false, metaKey: mod('Meta'), ctrlKey: mod('Control'), shiftKey: mod('Shift'), altKey: mod('Alt'), target: {}, timeStamp: 0, preventDefault() { }, stopPropagation() { } }; for (const f of listeners[t] ?? []) f(e); };
      return { I, down: (c: string) => key('keydown', c), up: (c: string) => key('keyup', c) }; };
    { asBuilt(); const B = board(), seen: string[] = [];
      const script: [string, string][] = [['d', 'KeyW'], ['d', 'ShiftLeft'], ['d', 'KeyD'], ['u', 'KeyW'], ['d', 'Space'], ['u', 'Space'], ['d', 'Digit2'], ['d', 'KeyR'], ['u', 'KeyR'], ['d', 'KeyI'], ['u', 'KeyI'], ['d', 'Backquote'], ['u', 'Backquote'], ['d', 'F5'], ['u', 'F5'], ['d', 'KeyP'], ['u', 'ShiftLeft'], ['u', 'KeyD'], ['u', 'Digit2'], ['u', 'KeyP']];
      const want: string[] = [], held = new Set<string>();
      for (const [t, c] of script) { if (t === 'd') { B.down(c); held.add(c); } else { B.up(c); held.delete(c); } const p = t === 'd' ? c : ''; want.push(`${[...held].sort().join('+')}|${p}`); seen.push(`${[...B.I.keys].sort().join('+')}|${[...B.I.pressed].join('+')}`); B.I.endFrame(); }
      const first = seen.findIndex((s, i) => s !== want[i]);
      verdict(first < 0 && B.I.keys.size === 0, 'the keyboard, nothing rebound: every key that goes down is filed under its own code, once, and let go when it is let go — what the listener filed before the table existed',
        `${script.length} keys down and up, ${first < 0 ? 'every frame as built' : `frame ${first}: filed '${seen[first]}', the build files '${want[first]}'`} · left held at the end: ${B.I.keys.size}`); }
    { K.setKeys({}); K.bindKey('KeyR', 'KeyK'); K.bindKey('KeyW', 'KeyI'); K.unbindKey('KeyE'); const B = board();
      B.down('KeyI'); B.down('KeyK'); const a = `${[...B.I.keys].sort().join('+')}|${[...B.I.pressed].sort().join('+')}`; B.I.endFrame();
      B.down('KeyW'); B.down('KeyR'); B.down('KeyE'); B.up('KeyW'); B.up('KeyR'); const dead = B.I.keys.size === 2 && B.I.keys.has('KeyW') && B.I.keys.has('KeyR') && B.I.pressed.size === 0;   // (the keys the rows left, and the row with no key: nothing down, and nothing let go by them either while I and K are held)
      K.bindKey('KeyR', 'KeyJ'); B.up('KeyK'); const let1 = !B.I.keys.has('KeyR') && B.I.keys.has('KeyW');   // (Reload moved again while K was down: K let go still lets go of the R it put down)
      K.resetKeys(); B.up('KeyI'); const let2 = B.I.keys.size === 0;
      verdict(a === 'KeyR+KeyW|KeyR+KeyW' && dead && let1 && let2, 'the keyboard, rows moved: the new keys file the game\'s own codes, the keys the rows left file nothing and let go of nothing, and a key rebound (or reset) while it is down lets go of what its press put down',
        `I and K down: '${a}' · W, R, E down and W, R up after: nothing more, nothing let go ${dead} · K let go after Reload moved on: R up ${let1} · I let go after Reset: nothing held ${let2}`); }

    // ---- the page's board gives the wall hold no key (KEYMAP.qFree): Q files nothing until the player puts the row on a key
    { const FB = process.env.QFREE_BREAK === '1'; const boot = (q: string) => { K.keysBoot(new URLSearchParams(q ? `${q}&bkey&slotsetup=0&qonly=0` : 'bkey&slotsetup=0&qonly=0')); if (FB) K.KEYMAP.qFree = false; };   // (these lines ask the wall hold's rule by itself, the squad's command left on B — `?bkey`; with the command on Q, as the page has it: qkey-check.ts)
      store.clear(); K.setKeys({}); let walk = true; K.KEYMAP.freeWhen = () => walk;
      K.keysBoot(new URLSearchParams('paused&bkey&slotsetup=0&qonly=0')); const bootOn = K.KEYMAP.qFree === true; K.keysBoot(new URLSearchParams('qfree=0&slotsetup=0&qonly=0')); const bootOff = K.KEYMAP.qFree === false && K.gameCode('KeyQ') === 'KeyQ' && K.capNow('KeyQ') === 'Q';
      boot('keybinds=0'); const plain = K.KEYMAP.on === false && K.gameCode('KeyQ') === '' && K.capNow('KeyQ') === K.NONE && K.keyCap('Q') === K.NONE;   // (the rebinding off for a visit: the build's own board, and that has no wall key)
      boot('');
      const rest = BOARD.filter(c => c !== 'KeyQ' && K.gameCode(c) !== c), said = WORDS.filter(s => K.keyText(s, true) !== s);
      const asb = K.gameCode('KeyQ') === '' && !K.keysOf('KeyQ').length && K.capNow('KeyQ') === K.NONE && K.keyBuilt('KeyQ') && K.keyFreed('KeyQ') && !K.keysChanged() && !Object.keys(K.keysKept()).length && !rest.length;
      walk = false; const offQ = K.gameCode('KeyQ') === 'KeyQ' && K.capNow('KeyQ') === 'Q' && !K.keyFreed('KeyQ') && !K.keysChanged(); walk = true; K.bindKey('KeyR', 'KeyQ'); walk = false; const offNone = K.gameCode('KeyQ') === 'KeyR' && !K.keysOf('KeyQ').length && K.capNow('KeyQ') === K.NONE; K.resetKeys(); walk = true;   // (the walk-in switched off: Q is the wall's again there and then, unless he gave Q to another row meanwhile)
      verdict(bootOn && bootOff && plain && asb && !said.length && offQ && offNone, 'no wall key: the page\'s boot gives the wall hold\'s row none (?qfree=0 puts it on Q; ?keybinds=0 does not); Q files nothing, every other key is itself, the row reads —, as built with nothing to reset, and no line of words is rewritten; with the walk-in switched off Q is the wall\'s again at once',
        `boot ${bootOn}, ?qfree=0 ${bootOff}, ?keybinds=0 ${plain} · Q gives '${K.gameCode('KeyQ')}', the row ${K.capNow('KeyQ')}, as built ${K.keyBuilt('KeyQ')}, changed ${K.keysChanged()}, ${rest.length} other keys moved · words changed: ${said.length} · walk-in off: Q the wall's ${offQ}, none where Reload has Q ${offNone}`);
      const r1 = K.bindKey('KeyQ', 'KeyQ'), onQ = r1.ok && !r1.swapped && K.gameCode('KeyQ') === 'KeyQ' && K.capNow('KeyQ') === 'Q' && K.keysChanged() && !K.keyBuilt('KeyQ') && WORDS.every(s => K.keyText(s, true) === s);
      const kept = store.get('twopointsix.keys') ?? ''; K.setKeys({}); boot(''); const back = K.gameCode('KeyQ') === 'KeyQ' && kept === '{"KeyQ":"KeyQ"}';
      walk = false; K.bindKey('KeyC', 'KeyK'); K.bindKey('KeyC', 'KeyC'); walk = true; const stays = K.gameCode('KeyQ') === 'KeyQ' && (store.get('twopointsix.keys') ?? '') === kept;   // (a spell with the walk-in off, a key moved and put back there: his Q is still his)
      K.keysBoot(new URLSearchParams('qfree=0&slotsetup=0&qonly=0')); K.bindKey('KeyC', 'KeyK'); K.bindKey('KeyC', 'KeyC'); boot(''); const visit = K.gameCode('KeyQ') === 'KeyQ';   // (…and a visit on the board as it was)
      K.resetKeys(); const reset = K.gameCode('KeyQ') === '' && !store.has('twopointsix.keys');
      K.bindKey('KeyQ', 'KeyK'); const onK = K.gameCode('KeyK') === 'KeyQ' && K.gameCode('KeyQ') === '' && K.keyCap('Q') === 'K' && K.keyText('press Q or Shift, or step away, to let go') === 'press K or Shift, or step away, to let go'; K.unbindKey('KeyQ'); const none = !K.keysChanged() && K.gameCode('KeyK') === 'KeyK' && K.gameCode('KeyQ') === ''; K.resetKeys();
      const r2 = K.bindKey('KeyR', 'KeyQ'), took = r2.ok && !r2.swapped && K.gameCode('KeyQ') === 'KeyR' && K.gameCode('KeyR') === '' && !K.keysOf('KeyQ').length && K.keyText('you\'re empty. press R to reload') === 'you\'re empty. press Q to reload';
      const r3 = K.bindKey('KeyQ', 'KeyQ'), left = K.keysOf('KeyR').length, swap = r3.swapped === 'KeyR' && !left && K.gameCode('KeyQ') === 'KeyQ'; K.resetKeys();
      K.setKeys({ KeyR: 'KeyQ', KeyQ: 'KeyR' }); const old1 = K.gameCode('KeyQ') === 'KeyR' && K.gameCode('KeyR') === 'KeyQ';   // kept on the board as it was: Reload and the wall swapped
      K.setKeys({ KeyQ: null }); const old2 = !K.keysChanged() && K.gameCode('KeyQ') === '';                                      // …the wall's row left with no key there: the build's own now
      K.setKeys({ KeyC: 'KeyQ' }); const old3 = K.gameCode('KeyQ') === 'KeyC' && !K.keysOf('KeyQ').length; K.setKeys({});          // …a table that cannot have been kept then (Q given away, the wall not named): Q is that row's
      // the die again, on this board, the walk-in going off and on under it; and every so often the kept table read back must play the same
      let seed = 777, bad = ''; const rnd = (n: number) => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return (seed >>> 8) % n; }; const keys = BOARD.filter(c => K.keyFree(c)); let flips = 0;
      for (let i = 0; i < 4000 && !bad; i++) { const a = K.KEY_ACTS[rnd(K.KEY_ACTS.length)], roll = rnd(20); if (roll === 0) K.unbindKey(a.id); else if (roll === 1 && rnd(8) === 0) K.resetKeys(); else K.bindKey(a.id, keys[rnd(keys.length)]);
        if (rnd(30) === 0) { walk = !walk; flips++; }
        const owner = new Map<string, string>();
        for (const b of K.KEY_ACTS) for (const k of K.keysOf(b.id)) { if (owner.has(k)) bad = `move ${i}: ${k} is ${owner.get(k)}'s and ${b.id}'s`; owner.set(k, b.id); if (K.gameCode(k) !== (b.codes.includes(k) && K.keysOf(b.id).join() === b.codes.join() ? k : b.id)) bad ||= `move ${i}: ${k} is ${b.id}'s and gives '${K.gameCode(k)}'`; }
        for (const k of BOARD) if (!owner.has(k)) { const g = K.gameCode(k), row = K.KEY_ACTS.some((b: any) => b.codes.includes(k)); if (g !== (row ? '' : k)) bad ||= `move ${i}: ${k} is nobody's and gives '${g}'`; }
        if (i % 53 === 0) { const was = BOARD.map(k => K.gameCode(k)).join(); K.setKeys(K.keysKept()); const now = BOARD.map(k => K.gameCode(k)).join(); if (was !== now) bad ||= `move ${i}: the kept table read back plays another board`; walk = !walk; const w1 = BOARD.map(k => K.gameCode(k)).join(); walk = !walk; if (BOARD.map(k => K.gameCode(k)).join() !== now) bad ||= `move ${i}: the walk-in off and on again left another board (${w1 === now ? 'same either way' : 'they differ, as they may'})`; } }
      walk = true; K.setKeys({}); store.clear();
      verdict(onQ && back && stays && visit && reset && onK && none && took && swap && old1 && old2 && old3 && !bad, 'no wall key: the row put on Q is a rebind like any other (written, read back on the next load, kept through a spell with the walk-in off and a visit on the board as it was, Reset takes it off); on another key, that key, and with none again it is as built; Q given to another row is that row\'s, and the wall\'s row asking for it back is a swap; a table kept on the board as it was reads as it was meant; 4,000 moves by a die with the walk-in going off and on leave no key with two rows',
        `on Q ${onQ} · kept '${kept}', read back ${back}, through the walk-in off ${stays}, through ?qfree=0 ${visit} · Reset ${reset} · on K ${onK}, none again ${none} · Reload takes Q ${took} · the wall takes it back: Reload is left with ${left ? 'a key' : 'none'} ${swap} · old tables ${old1} ${old2} ${old3} · the die: ${bad || `clean, the walk-in flipped ${flips} times`}`);
      // the keyboard, and the game on this stand
      const g3 = await quiet(async () => { const B = board(), W: any = await standUp({ seed: 95 }), g = W.game, pl = g.player; g.godMode = true;
        const feed = () => { W.input.keys.clear(); for (const k of B.I.keys) W.input.keys.add(k); for (const k of B.I.pressed) W.input.pressed.add(k); B.I.endFrame(); };
        const stage = () => { if (pl.wall) { W.input.pressed.add('KeyQ'); W.step(DT); } for (let i = 0; i < 40; i++) W.step(DT); g.teleportPlayer([20, 0, 10.7]); pl.char.bodyYaw = pl.char.aimYaw = Math.PI; for (let i = 0; i < 10; i++) W.step(DT); };
        const tap = (key: string) => { B.down(key); const filed = [...B.I.pressed].join('+'); feed(); W.step(DT); B.up(key); feed(); for (let i = 0; i < 50; i++) W.step(DT); return filed; };
        stage(); const f1 = tap('KeyQ'), w1 = !!pl.wall;
        stage(); W.input.pressed.add('KeyQ'); for (let i = 0; i < 50; i++) W.step(DT); const w2 = !!pl.wall;
        stage(); K.bindKey('KeyQ', 'KeyK'); const f3 = tap('KeyK'), w3 = !!pl.wall; K.setKeys({});
        return { f1, w1, w2, f3, w3 }; });
      verdict(g3.f1 === '' && !g3.w1 && g3.w2 && g3.f3 === 'KeyQ' && g3.w3, `no wall key, the game (${process.env.TPS_PROFILE === 'shipped' ? 'the page\'s stand' : 'the frozen stand'}): Q through the keyboard beside a wall files nothing and takes nothing; the code written straight in (a recording, a probe) takes the wall as it did; the key the row was put on takes it through the keyboard`,
        `Q on the board: filed '${g3.f1}', on a wall ${g3.w1} · 'KeyQ' written in: on a wall ${g3.w2} · the row on K, K on the board: filed '${g3.f3}', on a wall ${g3.w3}`);
      // the two lessons whose lines named Q: the step is done by a held move key, the walk-in on as the page has it (on this stand too: the line is the page's)
      { const { readFileSync } = await import('node:fs'); const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`), { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`), { WALLSNAP } = await import(`${ROOT}/src/game/wallsnap.ts`);
        const LES: [string, string, number[], string, (p: number[]) => boolean][] = [['train-move.json', 'Walk into the container and keep walking to put your back to it', [18.3, 0, 20.75], 'KeyW', p => p[0] >= 13.2 && p[0] <= 19.7 && p[2] >= 20.2 && p[2] <= 21],
          ['train-hands.json', 'The last guard is watching the gap. Put your back to the wall in the dark corner beside it', [23.45, 0, 19.4], 'KeyS', p => Math.hypot(p[0] - 23.45, p[2] - 19.4) <= 1]];
        const rows: string[] = []; let ok = true;
        for (const [file, line, at, key, inside] of LES) { const text = readFileSync(`${ROOT}/levels/${file}`, 'utf8'), has = text.includes(`"line": "${line}"`) && !/"line": "[^"]*\bQ\b/.test(text);
          const r = await quiet(async () => { const W: any = await standUp({ level: loadLevel(parseLevelData(text)), seed: 1 }), g = W.game, pl = g.player; const was = { on: WALLSNAP.on, press: WALLSNAP.press }; WALLSNAP.on = true; WALLSNAP.press = !FB;
            try { g.godMode = true; g.teleportPlayer([...at]); for (let i = 0; i < 20; i++) W.step(DT); W.input.keys.add(key); let took = -1; for (let i = 0; i < 120 && took < 0; i++) { W.step(DT); if (pl.wall) took = i; } W.input.keys.delete(key); return { took, in: inside(pl.char.pos as number[]) }; } finally { WALLSNAP.on = was.on; WALLSNAP.press = was.press; } });
          ok &&= has && r.took >= 0 && r.in; rows.push(`${file}: the line ${has ? 'names no key' : 'IS NOT AS WRITTEN HERE'}, ${key} held ${r.took < 0 ? 'took no wall' : `had the wall in ${r.took + 1} frames`}${r.in ? ', where the step asks' : ', NOT where the step asks'}`); }
        verdict(ok, 'no wall key, the lessons: the two Training lines that named Q name no key, and each step is done as its line says, by a move key held into the wall where the step asks', rows.join(' · ')); }
      K.KEYMAP.freeWhen = null; K.KEYMAP.qFree = false; K.KEYMAP.qCmd = false; K.KEYMAP.setFree = false; K.KEYMAP.qOnly = false; K.KEYMAP.on = true; K.setKeys({}); }

    // ---- the game, on this stand: one script of hands, three ways in
    const HANDS: [number, 'd' | 'u', string][] = [[2, 'd', 'KeyW'], [40, 'd', 'KeyD'], [70, 'u', 'KeyW'], [80, 'd', 'KeyC'], [81, 'u', 'KeyC'], [100, 'u', 'KeyD'], [104, 'd', 'Digit2'], [105, 'u', 'Digit2'], [130, 'd', 'KeyS'], [150, 'd', 'ShiftLeft'], [175, 'u', 'ShiftLeft'], [176, 'u', 'KeyS'],
      [180, 'd', 'KeyR'], [181, 'u', 'KeyR'], [200, 'd', 'KeyA'], [230, 'd', 'KeyQ'], [231, 'u', 'KeyQ'], [260, 'u', 'KeyA'], [262, 'd', 'KeyE'], [263, 'u', 'KeyE'], [270, 'd', 'Space'], [272, 'u', 'Space'], [280, 'd', 'KeyC'], [281, 'u', 'KeyC'], [282, 'd', 'KeyW'], [320, 'u', 'KeyW']];
    const MOVED: Record<string, string> = { KeyW: 'KeyI', KeyA: 'KeyJ', KeyS: 'KeyK', KeyD: 'KeyL', KeyL: 'KeyD', KeyC: 'ShiftRight', ShiftLeft: 'KeyC', KeyR: 'Backspace', KeyQ: 'KeyE', KeyE: 'KeyQ', Digit2: 'Quote', Space: 'KeyM' };
    const play = async (how: 'codes' | 'listener' | 'moved') => quiet(async () => {
      if (how === 'moved') { K.setKeys({}); for (const [id, k] of Object.entries(MOVED)) K.bindKey(id, k); } else if (how === 'listener') asBuilt(); else K.setKeys({});
      const B = how === 'codes' ? null : board(); const W: any = await standUp({ seed: 41 }); const g = W.game; g.godMode = true; let at = 0;
      const start = [...g.player.char.pos];
      for (let f = 0; f < 330; f++) {
        while (at < HANDS.length && HANDS[at][0] === f) { const [, t, c] = HANDS[at++];
          if (!B) { if (t === 'd') { if (!W.input.keys.has(c)) W.input.pressed.add(c); W.input.keys.add(c); } else W.input.keys.delete(c); }
          else { const k = how === 'moved' ? K.keysOf(c)[0] : c; if (t === 'd') B.down(k); else B.up(k); } }
        if (B) { W.input.keys.clear(); for (const k of B.I.keys) W.input.keys.add(k); for (const k of B.I.pressed) W.input.pressed.add(k); B.I.endFrame(); }
        W.step(DT); }
      const p = g.player.char.pos; return { d: digestGame(g), went: Math.hypot(p[0] - start[0], p[2] - start[2]), table: Object.keys(K.keysKept()).length }; });
    { const a = await play('codes'), b = await play('listener'), c = await play('moved'); K.setKeys({});
      const ha = hashDigest(a.d), hb = hashDigest(b.d), hc = hashDigest(c.d);
      verdict(ha === hb && ha === hc && a.went > 1 && c.table >= 10, `the game (${process.env.TPS_PROFILE === 'shipped' ? 'the page\'s stand' : 'the frozen stand'}): the codes written straight in, the same keys through the keyboard with nothing rebound, and a rebound board's keys through the keyboard end in one digest`,
        `330 ticks, he went ${a.went.toFixed(2)} m · straight in ${ha} · the keyboard, as built ${hb}${ha === hb ? '' : ` (${diffDigest(a.d, b.d, 3).join('; ')})`} · ${c.table} rows moved ${hc}${ha === hc ? '' : ` (${diffDigest(a.d, c.d, 3).join('; ')})`}`); }
  } finally { K.setKeys({}); K.KEYMAP.on = false; K.KEYMAP.qFree = false; K.KEYMAP.qCmd = false; K.KEYMAP.setFree = false; K.KEYMAP.qOnly = false; K.KEYMAP.freeWhen = null; for (const n of stubs) delete G[n]; for (const k of ['localStorage', 'window', 'document'] as const) { if (had[k] === undefined) delete G[k]; else G[k] = had[k]; } }
  console.log(`=== keybinds: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}
