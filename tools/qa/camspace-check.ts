// THE CAMERA'S KEY IS THE SPACE BAR (src/host/keymap.ts KEYMAP.camSpace, camKey; game/input.ts; host/findme.ts watchCtrlTaps). The page has it on
// (`?camspace=0` = Ctrl, as it was); the module's own stand has it off, so both of the harness's stands start with Ctrl and this check raises it itself.
//   bun run tools/qa/probes.ts camspace        (family `player`)        CAMSPACE_BREAK=1 = the switch left off and the same lines asked: must FAIL (all but `off`)
//
//   the board     Space is the camera's only while it is no row's: his actions a ring on E and empty hands a slot; with either off, with the switch off,
//                 or with a row put on Space by hand, the camera is on Ctrl
//   held          Space down, the mouse moved: the view's turn has its travel, and the wheel is the zoom's, not his pace; the Space key files nothing
//                 for the game; let go, the mouse turns nothing and the wheel is his pace again; lost focus lets go of it
//   Ctrl          while Space is the camera's, Ctrl and the mouse turn nothing; a pinch (a wheel that says Ctrl) still zooms
//   twice         the double tap is of the camera's key: Space twice says so and Ctrl twice does not; a tap with the mouse dragged is no tap
//   off           the switch off: all of it on Ctrl, as it was, and Space held is nothing to the camera
import { ROOT } from './headless.ts';

export async function camSpaceCheck(): Promise<boolean> {
  const BRK = process.env.CAMSPACE_BREAK === '1'; let all = true;
  const verdict = (ok: boolean, what: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}\n    ${detail}`); };
  console.log(`\n=== camspace: the camera's key is the Space bar${BRK ? ' (the switch off: must fail)' : ''} ===`);
  const K = await import(`${ROOT}/src/host/keymap.ts`); const { Input } = await import(`${ROOT}/src/game/input.ts`); const { watchCtrlTaps, TAPTWICE } = await import(`${ROOT}/src/host/findme.ts`);
  const M = K.KEYMAP, was = { on: M.on, qFree: M.qFree, qCmd: M.qCmd, setFree: M.setFree, camSpace: M.camSpace, slotWhen: M.slotWhen, handWhen: M.handWhen };
  const G: any = globalThis, had = { window: G.window, ls: G.localStorage }, stubs: string[] = []; const store = new Map<string, string>();
  G.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, String(v)); }, removeItem: (k: string) => { store.delete(k); } };
  for (const n of ['HTMLInputElement', 'HTMLSelectElement', 'HTMLTextAreaElement', 'HTMLElement']) if (!G[n]) { G[n] = class { }; stubs.push(n); }   // (what the listener asks of a key's target)
  try {
    // the page's own board: the player's keys live, empty hands a slot, his actions a ring, and the camera's switch as asked
    const page = (cam: boolean, ring = true, slot = true) => { M.on = true; M.qFree = true; M.qCmd = true; M.setFree = true; M.slotWhen = () => slot; M.handWhen = () => ring; M.camSpace = cam && !BRK; K.resetKeys(); };
    // game/input.ts's own listeners and the double tap's, on a window and a canvas that are lists of them
    const board = () => { const L: Record<string, ((e: any) => void)[]> = {}; const add = (t: string, f: (e: any) => void) => { (L[t] ??= []).push(f); };
      const win: any = { addEventListener: add }; win.top = win.self = win; const el = { addEventListener: add, getBoundingClientRect: () => ({ left: 0, top: 0 }) };
      G.window = win; let I: any; try { I = new Input(el as any); } finally { if (had.window === undefined) delete G.window; else G.window = had.window; }
      const twice = watchCtrlTaps(win, () => false, K.camKey); let now = 1000;
      const fire = (t: string, e: any) => { for (const f of L[t] ?? []) f({ repeat: false, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, target: {}, timeStamp: now, movementX: 0, movementY: 0, clientX: 0, clientY: 0, deltaY: 0, button: 0, preventDefault() { }, stopPropagation() { }, ...e }); };
      const key = (t: 'keydown' | 'keyup', code: string) => fire(t, { code, key: /^Control/.test(code) ? 'Control' : code === 'Space' ? ' ' : code, ctrlKey: /^Control/.test(code) && t === 'keydown' });
      const tap = (code: string, ms = 60, drag = 0) => { key('keydown', code); if (drag) fire('mousemove', { movementX: drag, ctrlKey: /^Control/.test(code) }); now += ms; key('keyup', code); now += 80; };
      return { I, key, tap, twice, move: (dx: number, ctrl = false) => fire('mousemove', { movementX: dx, ctrlKey: ctrl }), wheel: (dy: number, ctrl = false) => fire('wheel', { deltaY: dy, ctrlKey: ctrl }), blur: () => fire('blur', {}), menu: () => fire('contextmenu', {}), wait: (ms: number) => { now += ms; } }; };
    const read = (I: any) => { const r = { orbit: I.orbitDX, zoom: I.wheelCtrl, pace: I.wheel, filed: [...I.pressed].join('+'), keys: [...I.keys].join('+') }; I.endFrame(); return r; };
    // ---- the board
    { page(true); const on = K.camKey(), cap = K.camCap(); page(true, false); const noRing = K.camKey(); page(true, true, false); const noSlot = K.camKey();
      page(true); K.bindKey('KeyN', 'Space'); const taken = K.camKey(), takenCap = K.camCap(); K.resetKeys(); const back = K.camKey(); page(false); const off = K.camKey();
      verdict(on === 'Space' && cap === 'Space' && noRing === null && noSlot === null && taken === null && takenCap === 'Ctrl' && back === 'Space' && off === null,
        'Space is the camera\'s only while it is no row\'s: with the ring or the slot off, a row put on it by hand, or the switch off, the camera is on Ctrl',
        `the page's board: ${on} (cap ${cap}) · the ring off: ${noRing} · the slot off: ${noSlot} · night vision put on Space: ${taken} (cap ${takenCap}), Reset: ${back} · the switch off: ${off}`); }
    // ---- held
    { page(true); const B = board(); B.move(15); const before = read(B.I); B.key('keydown', 'Space'); const filed = read(B.I); B.move(15); B.move(-4); B.wheel(120); const held = read(B.I);
      B.key('keyup', 'Space'); B.move(15); B.wheel(120); const after = read(B.I); B.key('keydown', 'Space'); B.blur(); B.I.endFrame(); B.move(15); const lost = read(B.I); B.key('keydown', 'Space'); B.menu(); B.move(15); const menu = read(B.I); B.key('keyup', 'Space');
      verdict(before.orbit === 0 && filed.filed === '' && filed.keys === '' && held.orbit === 11 && held.zoom === 120 && held.pace === 0 && after.orbit === 0 && after.zoom === 0 && after.pace === 120 && lost.orbit === 0 && menu.orbit === 0,
        'Space held: the mouse turns the view and the wheel zooms; the key files nothing for the game; let go, or the page out of focus, and it is the mouse and his pace again',
        `before: turn ${before.orbit} · Space down files [${filed.filed}] holds [${filed.keys}] · held: turn ${held.orbit} of 15 − 4, zoom ${held.zoom}, pace ${held.pace} · let go: turn ${after.orbit}, zoom ${after.zoom}, pace ${after.pace} · focus lost with it down: turn ${lost.orbit} · a browser menu opened with it down: turn ${menu.orbit}`); }
    // ---- Ctrl
    { page(true); const B = board(); B.key('keydown', 'ControlLeft'); B.move(15, true); const ctrl = read(B.I); B.key('keyup', 'ControlLeft'); B.wheel(-40, true); const pinch = read(B.I);
      verdict(ctrl.orbit === 0 && pinch.zoom === -40 && pinch.pace === 0, 'while Space is the camera\'s, Ctrl and the mouse turn nothing; a pinch still zooms',
        `Ctrl held, the mouse moved 15: turn ${ctrl.orbit} · a wheel that says Ctrl (a pinch): zoom ${pinch.zoom}, pace ${pinch.pace}`); }
    // ---- twice
    { page(true); const B = board(); B.tap('Space'); const one = B.twice(); B.tap('Space'); const two = B.twice(), once = B.twice(); B.wait(2000);
      B.tap('ControlLeft'); B.tap('ControlLeft'); const ctrl = B.twice(); B.wait(2000); B.tap('Space', 60, TAPTWICE.driftPx + 8); B.tap('Space'); const dragged = B.twice(); B.wait(2000);
      B.tap('Space'); B.wait(TAPTWICE.gapMs + 200); B.tap('Space'); const slow = B.twice(); B.wait(2000);
      B.key('keydown', 'Space'); M.camSpace = false; B.wait(60); B.key('keyup', 'Space'); B.wait(2000); B.tap('ControlLeft'); B.tap('ControlLeft'); const handed = B.twice(); M.camSpace = !BRK;   // (the camera's key changing hands with a tap under way: the tap is let go as what it was, and the next double tap is whole)
      verdict(!one && two && !once && !ctrl && !dragged && !slow && handed, 'the double tap is of the camera\'s key: Space twice, never Ctrl twice; a tap with the view dragged, or two too far apart, is none',
        `Space once ${one}, twice ${two} (asked again ${once}) · Ctrl twice ${ctrl} · a dragged tap then a tap ${dragged} · two a long gap apart ${slow} · the key moved to Ctrl under a held Space, then Ctrl twice ${handed}`); }
    // ---- off
    { page(false); const B = board(); B.key('keydown', 'Space'); B.move(15); B.wheel(120); const sp = read(B.I); B.key('keyup', 'Space'); B.I.endFrame();
      B.key('keydown', 'ControlLeft'); B.move(15, true); B.wheel(120, true); const ct = read(B.I); B.key('keyup', 'ControlLeft'); B.wait(2000);
      B.tap('ControlLeft'); B.tap('ControlLeft'); const t2 = B.twice(); B.wait(2000); B.tap('Space'); B.tap('Space'); const s2 = B.twice();
      const ok = sp.orbit === 0 && sp.zoom === 0 && sp.pace === 120 && ct.orbit === 15 && ct.zoom === 120 && t2 && !s2 && K.camCap() === 'Ctrl';
      verdict(ok, 'the switch off: the camera is on Ctrl as it was, and Space held is nothing to it',
        `Space held: turn ${sp.orbit}, zoom ${sp.zoom}, pace ${sp.pace} · Ctrl held: turn ${ct.orbit}, zoom ${ct.zoom} · Ctrl twice ${t2}, Space twice ${s2} · cap ${K.camCap()}`); }
  } finally {
    Object.assign(M, was); K.resetKeys(); for (const n of stubs) delete G[n];
    if (had.ls === undefined) delete G.localStorage; else G.localStorage = had.ls;
  }
  console.log(`=== camspace: ${all ? 'ALL PASS' : 'FAIL'} ===`);
  return all;
}
