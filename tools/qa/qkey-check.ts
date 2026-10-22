// THE SQUAD'S COMMAND KEY IS Q — the check behind host/keymap.ts `qCmd` (the page's board; `?bkey` = the command on B for a visit). The game was not
// touched: it goes on asking for the quick order's own code ('KeyB', game/orders.ts ORDERS.quickKey) and the BOARD gives that code off the Q key, the B key
// giving nothing. So a tap of Q is the press B was, by the one read the game has for it.
//   bun run tools/qa/qkey-check.ts            (also `probes.ts qkey`, in families squadorders and player)
//   TPS_PROFILE=shipped bun run tools/qa/qkey-check.ts      — the same lines, the game's on the page's stand
//   QKEY_BREAK=1 = the board as it was (the command on B) while the same lines are asked: must FAIL
// WHAT IT HOLDS:
//   the boot       the page's boot puts the command on Q; `?bkey` leaves it on B; `?qfree=0` (Q the wall's) leaves it on B; `?keybinds=0` leaves it on Q
//   the board      Q gives the quick order's code, B gives nothing, every other key is itself; the row reads Q, as built, nothing to reset; the wall hold
//                  has no key — and with walking in switched off it still has none: Q never means two things (under `?bkey` it is the wall's again there)
//   the words      a line written with the old cap names Q ('B on the blue door', the key card's 'X · B · T · F'); a place's letter is left alone
//                  (the orders key and the who key read as no key in a list of keys where the ring carries every order: KEYMAP.qOnly)
//   his own keys   the command put back on B by hand stays on B, kept and read back, and Reset is Q again; a table kept before, the command on another
//                  key, means what it meant; Q given to another row (the wall hold by hand, Reload in a table kept while Q was spare) leaves the
//                  command on B, and on no key only when B is held too; after 3,000 moves by a die,
//                  the walk-in going off and on, no key has two rows
//   the game       on the stand this run is on, the room clear with its squad of four: the same hand — the floor, a door, the door again once they are
//                  stacked on it, the floor — once with the code written straight in (what B was, and what every tool and recording writes) and once
//                  off the Q key through game/input.ts's own listeners leaves the same order book, row for row and to the millisecond, and the same
//                  game by its run digest; the B key through the listeners files nothing and orders nothing
//   exit 0 = all hold · 1 = one does not
import { standUp, ROOT } from './headless.ts';

const AP: any = await import(`${ROOT}/src/game/autopilot.ts`);
const { NIGHTBREACH } = await import(`${ROOT}/src/game/nightbreach.ts`);
const OR: any = await import(`${ROOT}/src/game/orders.ts`);
const K: any = await import(`${ROOT}/src/host/keymap.ts`);
const { Input } = await import(`${ROOT}/src/game/input.ts`);
const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
const { ORDERS } = OR, { AUTOPILOT } = AP;
const { CMDRING } = await import(`${ROOT}/src/game/cmdring.ts`);

const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const BREAK = process.env.QKEY_BREAK === '1';

async function rig(seed: number) {
  const squad0 = NIGHTBREACH.squad; let W: any, why: any;
  try {
    Object.assign(NIGHTBREACH, { squad: 4 });
    Math.random = seeded(seed);
    W = await standUp();
    AUTOPILOT.on = true;
    W.game.godMode = true;
    why = W.game.roomClear.start(seed);
  } finally { Object.assign(NIGHTBREACH, { squad: squad0 }); }
  const game = W.game, O = game.orders, input = W.input;
  const R = { W, game, O, why, input,
    get team(): any[] { return O.squad(); },
    step(n = 1) { for (let i = 0; i < n; i++) { game.player.visibility = 0.05; W.step(DT); } },
    until(pred: () => boolean, secs: number) { for (let i = 0; i < secs * 60 && !pred(); i++) R.step(); return pred(); },
    aim(p: number[]) { W.cursorAt([p[0], p[1], p[2]]); R.step(2); return O.hover?.() ?? null; },
    tail() { return O.log[O.log.length - 1]; },
    stacked() { return R.team.filter((m: any) => m.state !== 'dead').every((m: any) => O.of(m)?.order === 'stack' && O.of(m)?.arrived); },
  };
  R.step(30);
  for (const m of R.team) m.god = true;
  return R;
}
function aimOf(R: any, d: any): number[] | null {
  const c = d.frameCentre, th = d.def.closedDir, nx = -Math.sin(th), nz = Math.cos(th);
  for (const y of [c[1], 0.05, 1.0, 1.8]) for (const k of [0, 0.35, -0.35]) { const p = [c[0] + nx * k, y, c[2] + nz * k]; const h = R.aim(p); if (h?.kind === 'door' && h.door === d) return p; }
  return null;
}
function floorSpot(R: any): number[] | null {
  const s = R.game.player.char.pos;
  for (const [dx, dz] of [[2.5, 0], [-2.5, 0], [0, 2.5], [0, -2.5], [2, 2], [-2, -2], [2, -2], [-2, 2]]) { const p = [s[0] + dx, 0.04, s[2] + dz]; const h = R.aim(p); if (h?.kind === 'floor' && !h.wall && !h.thing && R.team.every((m: any) => dist(m.char.pos, p) > 1.2)) return p; }
  return null;
}

let fails = 0;
const line = (ok: boolean, name: string, detail: string) => { if (!ok) fails++; console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`); };

export async function qkeyCheck(): Promise<boolean> {
  fails = 0;
  const G: any = globalThis, had = { localStorage: G.localStorage, window: G.window }, keep = { ap: AUTOPILOT.on, rnd: Math.random };
  const stubs: string[] = [];
  const store = new Map<string, string>(); G.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, String(v)); }, removeItem: (k: string) => { store.delete(k); } };
  let walk = true;
  /** the page's boot (main.ts): the walk-in switch handed over, the address read, what the machine kept taken */
  const boot = (q = '') => { K.KEYMAP.freeWhen = () => walk; K.keysBoot(new URLSearchParams(q)); if (BREAK) K.KEYMAP.qCmd = false; };
  const BOARD: string[] = [...K.KEY_ACTS.flatMap((a: any) => a.codes), 'KeyI', 'KeyJ', 'KeyK', 'KeyM', 'KeyO', 'KeyU', 'KeyY', 'Digit6', 'Digit0', 'Minus', 'Quote', 'Slash', 'Numpad1'];
  const cmd = () => BOARD.filter(c => K.gameCode(c) === ORDERS.quickKey).join('+') || 'no key';
  console.log(`qkey-check: the squad's command key is Q${BREAK ? '  (QKEY_BREAK: the board as it was — the lines must fail)' : ''}`);
  try {
    // 1. the boot
    {
      boot('paused'); const on = K.KEYMAP.qCmd === true && K.cmdOnQ() && cmd() === 'KeyQ';
      boot('bkey'); const b = !K.cmdOnQ() && cmd() === 'KeyB' && K.gameCode('KeyQ') === '';
      boot('qfree=0'); const wall = !K.cmdOnQ() && cmd() === 'KeyB' && K.gameCode('KeyQ') === 'KeyQ';
      boot('keybinds=0'); const plain = K.cmdOnQ() && cmd() === 'KeyQ' && K.gameCode('KeyB') === '';
      line(on && b && wall && plain, 'the page\'s boot puts the command on Q; ?bkey and ?qfree=0 leave it on B; ?keybinds=0 leaves it on Q', `the boot: ${on} · ?bkey: ${b} · ?qfree=0 (Q the wall's): ${wall} · ?keybinds=0: ${plain}`);
    }
    // 2. the board
    {
      boot(''); const code = ORDERS.quickKey, q = K.gameCode('KeyQ'), bk = K.gameCode('KeyB'), only = K.KEYMAP.qOnly ? ['KeyX', 'KeyT'] : [], rest = BOARD.filter(c => c !== 'KeyQ' && c !== 'KeyB' && !only.includes(c) && K.gameCode(c) !== c).concat(only.filter(c => K.gameCode(c) !== ''));   // (the squad's only keys, host/keymap.ts qOnly: the orders key and the who key give nothing — qonly-check.ts asks the rest of it)
      const row = K.capNow(code), built = K.keyBuilt(code), changed = K.keysChanged(), wall = K.keysOf('KeyQ').length;
      walk = false; const offQ = K.gameCode('KeyQ'), offWall = K.keysOf('KeyQ').length, offAny = BOARD.filter(c => K.gameCode(c) === 'KeyQ').length; walk = true;
      boot('bkey'); walk = false; const bOff = K.gameCode('KeyQ') === 'KeyQ' && K.gameCode('KeyB') === 'KeyB'; walk = true; boot('');
      line(code === 'KeyB' && q === code && bk === '' && !rest.length && row === 'Q' && built && !changed && wall === 0 && offQ === code && offWall === 0 && offAny === 0 && bOff,
        'Q gives the quick order\'s code and B gives nothing; the row reads Q, as built; the wall hold has no key, walking in switched off or not', `Q gives '${q}', B gives '${bk}', ${rest.length} other keys moved · the row ${row}, as built ${built}, changed ${changed} · wall hold's keys: ${wall} · the walk-in off: Q gives '${offQ}', wall hold's keys ${offWall}, keys that give the wall's code ${offAny} · under ?bkey, the walk-in off: Q the wall's and B the command's ${bOff}`);
    }
    // 3. the words
    {
      boot(''); const a = K.keyText("B on the yellow house's door: the pair stacks up beside it"), b = K.keyText('X · B · T · F', true), c = K.keyText('with a team — X (or middle click) orders · B the usual order · T who it goes to'), d = K.keyText('room B is clear'), e = K.keyText('Vault B'), f = K.keyText('Q / away / Shift lets go'), cap = K.keyCap('B');
      boot('bkey'); const asWas = K.keyText('B on the blue door: BLUE stacks up'); boot('');
      line(a.startsWith('Q on the yellow') && b === (K.KEYMAP.qOnly ? `${K.NONE} · Q · ${K.NONE} · F` : 'X · Q · T · F') && c.includes('· Q the usual order ·') && d === 'room B is clear' && e === 'Vault B' && f === 'Q / away / Shift lets go' && cap === 'Q' && asWas === 'B on the blue door: BLUE stacks up',
        'a line written with the old cap names Q; a place\'s letter is left alone; under ?bkey it reads as it did', `'${a.slice(0, 24)}…' · '${b}' · '${d}' · '${e}' · the cap handed 'B': '${cap}' · ?bkey: '${asWas}'`);
    }
    // 4. his own keys
    {
      boot(''); const code = ORDERS.quickKey;
      const r1 = K.bindKey(code, 'KeyB'), onB = cmd() === 'KeyB' && K.gameCode('KeyQ') === '' && !K.keyBuilt(code) && K.keysChanged(), kept = JSON.stringify(K.keysKept());
      K.setKeys(K.keysKept()); const back = cmd() === 'KeyB'; boot(''); const again = cmd() === 'KeyB';   // (read back, and a page load later)
      K.resetKeys(); const reset = cmd() === 'KeyQ' && !K.keysChanged() && store.get('twopointsix.keys') === undefined;
      K.setKeys({ [code]: 'KeyG' }); const old = cmd() === 'KeyG' && K.gameCode('KeyQ') === '' && K.gameCode('KeyB') === ''; K.setKeys({});
      const r2 = K.bindKey('KeyQ', 'KeyQ'), wallQ = K.gameCode('KeyQ') === 'KeyQ' && cmd() === 'KeyB' && K.capNow(code) === 'B' && !('KeyB' in K.keysKept()); K.resetKeys(); const reset2 = cmd() === 'KeyQ' && K.keysOf('KeyQ').length === 0;
      // Q already his (a table kept while Q was spare): the command is on B, as before the move — and back on Q when that row moves away; on no key only with both held
      K.setKeys({ KeyR: 'KeyQ' }); const rQ = cmd() === 'KeyB' && K.gameCode('KeyQ') === 'KeyR'; K.bindKey('KeyR', 'KeyR'); const rBack = cmd() === 'KeyQ';
      K.setKeys({ KeyQ: 'KeyQ' }); const wQ = cmd() === 'KeyB' && K.gameCode('KeyQ') === 'KeyQ';
      K.setKeys({ KeyR: 'KeyQ', KeyG: 'KeyB' }); const both = cmd() === 'no key' && K.capNow(code) === K.NONE; K.setKeys({});
      // a die on the board, the walk-in going off and on: no key with two rows
      const rnd = seeded(7), ids: string[] = K.KEY_ACTS.map((x: any) => x.id), keys = BOARD; let two = 0, moves = 0;
      for (let i = 0; i < 3000; i++) { const r = rnd(); if (r < 0.04) walk = !walk; else if (r < 0.08) K.resetKeys(); else if (r < 0.14) K.unbindKey(ids[Math.floor(rnd() * ids.length)]); else { K.bindKey(ids[Math.floor(rnd() * ids.length)], keys[Math.floor(rnd() * keys.length)]); moves++; }
        if (i % 25 === 0) for (const k of keys) if (ids.filter(id => K.keysOf(id).includes(k)).length > 1) two++; }
      walk = true; K.setKeys({}); store.clear();
      line(r1.ok && onB && kept === `{"${code}":"KeyB"}` && back && again && reset && old && r2.ok && r2.swapped === code && wallQ && reset2 && rQ && rBack && wQ && both && two === 0,
        'the command put back on B by hand stays on B and Reset is Q again; an old kept table means what it meant; Q given to another row leaves the command on B, never on no key while B is free; a die leaves no key with two rows',
        `on B by hand: ${onB}, kept ${kept}, read back ${back}, a load later ${again} · Reset: ${reset} · a table kept with the command on G: ${old} · the wall hold given Q: swapped with ${r2.swapped ?? 'nobody'}, the command then on B ${wallQ} · Reset: ${reset2} · a table kept with Reload on Q: the command on B ${rQ}, on Q again when Reload moves away ${rBack} · kept with the wall hold on Q: on B ${wQ} · Q and B both held: no key ${both} · ${moves} moves by a die: ${two} keys with two rows`);
    }
    // 5. the game on this stand: the code written straight in (what B was) and the Q key through the keyboard leave the same order book and the same game
    {
      boot('');
      const listeners: Record<string, ((e: any) => void)[]> = {};
      for (const n of ['HTMLInputElement', 'HTMLSelectElement', 'HTMLTextAreaElement', 'HTMLElement']) if (!G[n]) { G[n] = class { }; stubs.push(n); }   // (what the listener asks of a key's target)
      const win: any = { addEventListener: (t: string, f: (e: any) => void) => { (listeners[t] ??= []).push(f); } }; win.top = win.self = win;
      const el = { addEventListener() { }, getBoundingClientRect: () => ({ left: 0, top: 0 }) };
      // (the window is there only while the Input is made: a game stood up afterwards finds no window, as in every other headless run)
      const board = () => { for (const k in listeners) delete listeners[k]; G.window = win; let I: any; try { I = new Input(el as any); } finally { if (had.window === undefined) delete G.window; else G.window = had.window; }
        const key = (t: 'keydown' | 'keyup', code: string) => { const e = { code, key: code.replace(/^Key|^Digit/, '').toLowerCase(), repeat: false, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, target: {}, timeStamp: 0, preventDefault() { }, stopPropagation() { } }; for (const f of listeners[t] ?? []) f(e); };
        return { I, down: (c: string) => key('keydown', c), up: (c: string) => key('keyup', c) }; };
      /** the same hand on the same floor: `via` = null, the quick order's code written straight into the game's input; else that key of the board, pressed */
      const play = async (via: string | null) => {
        const R = await rig(5), g = R.game, O = R.O, B = board(), filed: string[] = [];
        if (R.why) return { log: '', digest: '', rows: [] as string[], filed, lag: -1, why: String(R.why) };
        const feed = () => { R.input.keys.clear(); for (const k of B.I.keys) R.input.keys.add(k); for (const k of B.I.pressed) R.input.pressed.add(k); B.I.endFrame(); };
        const press = () => { if (via === null) { R.input.keys.add(ORDERS.quickKey); R.input.pressed.add(ORDERS.quickKey); R.step(); R.input.keys.delete(ORDERS.quickKey); } else { B.down(via); filed.push([...B.I.pressed].join('+')); feed(); R.step(); B.up(via); feed(); } };
        const stackDef = O.defs.find((d: any) => d.id === 'stack'), all = () => O.men('all');
        let D: any = null;
        for (const d of [...g.doors.list].sort((a: any, b: any) => dist(a.frameCentre, g.player.char.pos) - dist(b.frameCentre, g.player.char.pos))) { const t = O.targetAt(d.frameCentre); if (t.kind !== 'door' || t.door !== d) continue; const far = g.cleared.roomBy(t.door, t.side > 0 ? -1 : 1); if (!far || g.cleared.isKnown(far)) continue; if (!O.whyNot(stackDef, O.forMen(t, all()), all()) && aimOf(R, d)) { D = d; break; } }
        const spot = floorSpot(R);
        if (!D || !spot) return { log: '', digest: '', rows: [] as string[], filed, lag: -1, why: !D ? 'no door to stack on' : 'no open floor round Sam' };
        R.aim(spot); const n0 = O.log.length; press(); let lag = O.log.length - n0; R.step(1); if (CMDRING.on) lag = lag === 0 && O.log.length - n0 === 1 ? 1 : -1; R.step(89);   // (with the orders ring on — the page — a tap is given as the key is seen up, the tick after the press; off, on the press's own tick)
        aimOf(R, D); press(); R.until(() => R.stacked(), 40); R.step(30);
        aimOf(R, D); press(); R.step(240);
        R.aim(spot); press(); R.step(120);
        const rows: string[] = O.log.map((r: any) => `${r.t.toFixed(3)} ${r.order}${r.auto ? '*' : ''} ${r.who.join('+')} ${r.target}`);
        return { log: rows.join('\n'), digest: hashDigest(digestGame(g, true)) as string, rows, filed, lag, why: null as string | null };
      };
      const code = await play(null), q = await play('KeyQ'), b = await play('KeyB');
      const same = !code.why && !q.why && code.log === q.log && code.digest === q.digest, entry = q.rows.find(r => / (bangClear|openClear|chargeClear|charge|fragClear)\*/.test(r)) ?? q.rows[2];
      const dead = !b.why && b.rows.length === 0 && b.filed.every(f => f === '');
      line(same && q.rows.length >= 4 && code.lag === 1 && q.lag === 1 && q.filed.every(f => f === ORDERS.quickKey) && dead,
        `the game (${process.env.TPS_PROFILE === 'shipped' ? 'the page\'s stand' : 'the frozen stand'}): a tap of Q is the press B was — the same order book to the millisecond and the same game after four orders; the B key orders nothing`,
        code.why || q.why || b.why ? `not played: ${code.why ?? q.why ?? b.why}` : `the code straight in: ${code.rows.length} rows, digest ${code.digest} · the Q key: ${q.rows.length} rows, digest ${q.digest}, filed '${q.filed[0]}' · ${same ? 'the same' : `DIFFERENT (first row that differs: ${q.rows.find((r, i) => r !== code.rows[i]) ?? 'none — the game differs'})`} · the orders: ${q.rows.map(r => r.split(' ')[1]).join(', ')} · from the stack: ${entry?.split(' ')[1]} · the order ${CMDRING.on ? 'on the tick the key is seen up (the orders ring is on)' : 'on the frame of the press'}: ${q.lag === 1} · the B key: filed '${b.filed.join('')}', ${b.rows.length} rows`);
    }
  } finally {
    K.setKeys({}); K.KEYMAP.on = false; K.KEYMAP.qFree = false; K.KEYMAP.qCmd = false; K.KEYMAP.freeWhen = null; AUTOPILOT.on = keep.ap; Math.random = keep.rnd;
    for (const n of stubs) delete G[n]; for (const k of ['localStorage', 'window'] as const) { if (had[k] === undefined) delete G[k]; else G[k] = had[k]; }
  }
  console.log(fails ? `qkey-check: ${fails} FAIL` : 'qkey-check: ALL PASS');
  return fails === 0;
}

if (import.meta.main) process.exit((await qkeyCheck()) ? 0 : 1);
