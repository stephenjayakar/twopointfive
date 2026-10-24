// 'stalkdrag' — THE STICK (STALK.drag, src/game/stalk.ts `dragged`; fed by player.ts). The maintainer: "you click on the guy and then you can drag towards him
// to move in that direction. like a joystick centered on the guy. that would make things feel more controlled than right now which feels automatic."
//   bun run tools/qa/stalkdrag-check.ts        (also `probes.ts stalkdrag`; run it on BOTH stands: TPS_PROFILE=shipped in front for the second)
//   still     the press made on a man three metres ahead and the mouse left there: two seconds on Sam has not moved, and the stalk is still on.
//   toward    the mouse dragged the whole way toward the man on the screen: Sam closes on him at the creep's top speed; half the way, about half of it.
//   side      dragged across the screen: he goes across, not in, and keeps facing the man.
//   stops     dragged toward him for six seconds: he comes up to `keyM` behind him and stops there, never nearer, the stalk still on; the key then takes him.
//   outside   (game/input.ts's window listener, on a window of lists) the press held and the mouse taken off the view: followed while the stick is up
//             (Game.update says so to the host's input every frame), let go of when the event says the button is up; with the stick down, nothing.
//   off       the key down: the same press with the mouse left on him walks him in to reach, as it did.
//   harness   down on the frozen stand and in the plain page, up in the lab (?sneaklab) and with ?stalkdrag=1, down in the lab with ?stalkdrag=0; rides a
//             recording's tables, and a recording from before the key replays with it down.
// STALKDRAG_BREAK=1 = the key left down where still, toward, side and outside ask for it up: each must FAIL.   exit 0 = all hold · 1 = one does not
// THE HARNESS HAS NO GPU and no hand on a mouse: the drag is written into the input as numbers. Nobody has felt it.
import { standUp, ROOT } from './headless.ts';

const { HOLD } = await import(`${ROOT}/src/game/character.ts`);
const { CLOSE } = await import(`${ROOT}/src/game/close.ts`);
const { STALK, stalkPolish, stalkOn } = await import(`${ROOT}/src/game/stalk.ts`);
const PR = await import(`${ROOT}/src/host/profile.ts`);
const JR = await import(`${ROOT}/src/game/journal.ts`);
const { STAND_ENV } = await import(`${ROOT}/src/host/standEnv.ts`);

const BREAK = process.env.STALKDRAG_BREAK === '1', DT = 1 / 60, EAST = Math.PI / 2, AT = [10.2, 0, 19.5];   // (the lobby's open floor)
let allPass = true, found = false;
const verdict = (ok: boolean, label: string, detail: string) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
async function quiet<T>(fn: () => Promise<T>): Promise<T> { const log = console.log; console.log = () => {}; try { return await fn(); } finally { console.log = log; } }
const up = () => !BREAK, f2 = (x: number) => x.toFixed(2);
/** the lobby's floor, the rifleman facing east with Sam `gap` m behind him, crouched with empty hands, the rest parked; the press made on the man's chest */
async function world(drag: boolean, gap = 3) {
  const W: any = await quiet(() => standUp({ seed: 11 } as any)), g = W.game;
  HOLD.dropGun = true; HOLD.disarm = true; CLOSE.on = true; CLOSE.noKnife = true; STALK.on = STALK.key = STALK.low = true; STALK.drag = drag; STALK.orbit = false; stalkPolish(true);   // (STALK.orbit down: this card is of the stick's own way; stalkorbit-check takes the stick round him)
    // (the frozen stand's pins write them at every stand-up)
  g.godMode = true; g.aiEnabled = false; g.playerInvisible = true; g.player.slot = 'pistol'; g.player.holstered = true;
  g.tune.carbineGuards = 'reyes'; for (let i = 0; i < 5; i++) W.step(DT);
  const A = g.guards.find((x: any) => x.callsign === 'Reyes'), rest = g.guards.filter((x: any) => x !== A);
  for (const [i, gd] of rest.entries()) { gd.char.pos = [37.5, 0, 4.5 + i * 1.5]; gd.path = []; gd.pathGoal = null; gd.hold = true; gd.heardUpTo = 1e12; }
  A.char.pos = [...AT]; A.char.bodyYaw = A.char.aimYaw = EAST; A.char.vel = [0, 0, 0]; A.path = []; A.pathGoal = null; A.hold = true; A.pinned = true; A.awareness = 0; A.heardUpTo = 1e12;
  W.cam.yaw = 0; W.cam.rebuild?.(); g.teleportPlayer([AT[0] - gap, 0, AT[2]]); g.player.crouch = true;
  const c = g.player.char, chest = () => [A.char.pos[0], 1.2, A.char.pos[2]];
  const step = (n = 1) => { for (let i = 0; i < n; i++) { STALK.drag = drag; STALK.orbit = false; A.char.vel = [0, 0, 0]; W.step(DT); g.player.visibility = 0.02; } };
  step(40); W.cursorAt(chest()); W.input.buttons |= 1; W.input.clicked |= 1; step(1);
  const mid = [W.input.mouseX, W.input.mouseY];
  /** the screen's way from Sam to the man, a unit vector in px */
  const toward = () => { W.cursorAt([c.pos[0], 0.6, c.pos[2]]); const s = [W.input.mouseX, W.input.mouseY]; W.cursorAt([A.char.pos[0], 0.6, A.char.pos[2]]); const a = [W.input.mouseX, W.input.mouseY]; const L = Math.hypot(a[0] - s[0], a[1] - s[1]) || 1; return [(a[0] - s[0]) / L, (a[1] - s[1]) / L]; };
  const dir = toward(); W.input.mouseX = mid[0]; W.input.mouseY = mid[1];
  const hold = (dx: number, dy: number) => { W.input.mouseX = mid[0] + dx; W.input.mouseY = mid[1] + dy; };
  const gapNow = () => Math.hypot(c.pos[0] - A.char.pos[0], c.pos[2] - A.char.pos[2]), speed = () => Math.hypot(c.vel[0], c.vel[2]);
  return { W, g, A, c, step, hold, dir, gapNow, speed, on: () => stalkOn(g) === A };
}
async function still() {
  console.log('\n=== still: the mouse left where it was pressed ===');
  const C = await world(up()), p0 = [...C.c.pos]; C.step(120); const moved = Math.hypot(C.c.pos[0] - p0[0], C.c.pos[2] - p0[2]);
  verdict(moved < 0.1 && C.on(), 'the press made on a man three metres ahead and the mouse left there: two seconds on Sam has moved less than 10 cm, and the stalk is still on',
    `moved ${f2(moved)} m · the stalk on ${C.on()}`);
}
async function toward() {
  console.log('\n=== toward: dragged toward him, the whole way and half of it ===');
  const go = async (share: number) => { const C = await world(up()), full = STALK.dragDead + (STALK.dragFull - STALK.dragDead) * share; C.hold(C.dir[0] * full, C.dir[1] * full); const g0 = C.gapNow(); C.step(45); return { v: C.speed(), closed: g0 - C.gapNow(), on: C.on() }; };
  const a = await go(1), b = await go(0.5);
  verdict(a.on && a.v > STALK.pace * 0.85 && a.v <= STALK.pace + 0.02 && a.closed > 0.5 && b.v > a.v * 0.35 && b.v < a.v * 0.65,
    'the mouse dragged the whole way toward the man on the screen: three quarters of a second on Sam is closing at the creep\'s top speed; dragged half the way, at about half of it',
    `the whole way: ${f2(a.v)} m/s (top speed ${STALK.pace}), closed ${f2(a.closed)} m, the stalk on ${a.on} · half the way: ${f2(b.v)} m/s`);
}
async function side() {
  console.log('\n=== side: dragged across ===');
  const C = await world(up(), 2.2), n = [-C.dir[1], C.dir[0]]; C.hold(n[0] * STALK.dragFull, n[1] * STALK.dragFull); const g0 = C.gapNow(); C.step(20);   // (a third of a second: a straight line across opens the gap a little as it goes, and his turn follows the man a beat behind)
  const v = C.c.vel, ux = C.A.char.pos[0] - C.c.pos[0], uz = C.A.char.pos[2] - C.c.pos[2], L = Math.hypot(ux, uz), into = (v[0] * ux + v[2] * uz) / (L * (Math.hypot(v[0], v[2]) || 1));
  const face = Math.abs(Math.atan2(Math.sin(C.c.aimYaw - Math.atan2(ux, uz)), Math.cos(C.c.aimYaw - Math.atan2(ux, uz)))) * 180 / Math.PI, body = Math.abs(Math.atan2(Math.sin(C.c.bodyYaw - Math.atan2(ux, uz)), Math.cos(C.c.bodyYaw - Math.atan2(ux, uz)))) * 180 / Math.PI;
  verdict(C.on() && C.speed() > 0.3 && Math.abs(into) < 0.4 && Math.abs(C.gapNow() - g0) < 0.25 && face < 40,
    'dragged across the screen: he goes across, not in or out (the way he moves is within a quarter turn either side of square to the man), and he keeps facing the man, within 40°',
    `${f2(C.speed())} m/s, its share into the man ${f2(into)} · the gap ${f2(g0)} m to ${f2(C.gapNow())} m · he faces ${face.toFixed(0)}° off the man (his hips ${body.toFixed(0)}°) · the stalk on ${C.on()}`);
}
async function stops() {
  console.log('\n=== stops: dragged into him, he stops behind him; the key takes him ===');
  const C = await world(true), { g, W } = C; C.hold(C.dir[0] * STALK.dragFull, C.dir[1] * STALK.dragFull); let least = 9;
  for (let i = 0; i < 360; i++) { C.step(); least = Math.min(least, C.gapNow()); }
  const at = C.gapNow(), on = C.on(), v = C.speed(); const sel = g.selectVerb('guard', 'grab'); W.input.pressed.add('Space'); let held = false;
  for (let i = 0; i < 60 && !held; i++) { C.step(); held = g.player.holding?.g === C.A; }
  verdict(on && least > STALK.keyM - 0.06 && Math.abs(at - STALK.keyM) < 0.12 && v < 0.05 && held,
    'dragged toward him for six seconds: he comes up to the waiting distance behind him and stops there, never more than 6 cm nearer, the stalk still on; the key then takes him',
    `stopped ${f2(at)} m behind him (waits at ${STALK.keyM}), the nearest ${f2(least)} m, ${f2(v)} m/s, the stalk on ${on} · the grab offered ${!!sel}, in his arm ${held}`);
}
async function off() {
  console.log('\n=== off: the key down, the hold walks him in ===');
  const C = await world(false); let n = 0; for (; n < 600; n++) { C.step(); if (n > 30 && C.speed() < 0.02 && C.gapNow() < 0.95) break; }
  verdict(C.gapNow() < 0.95 && n < 600, 'the key down: the same press with the mouse left on him walks him in to reach by itself, as it did', `in reach (${f2(C.gapNow())} m) after ${(n * DT).toFixed(1)} s`);
}
async function outside() {
  console.log('\n=== outside: the press held and the mouse taken off the view ===');
  const C = await world(up()); C.step(2); const wired = C.W.input.dragOff === true;   // (Game.update writes the host's input.dragOff from STALK.drag every frame)
  const { Input } = await import(`${ROOT}/src/game/input.ts`), G: any = globalThis, had = G.window;
  const L: Record<string, ((e: any) => void)[]> = {}, V: Record<string, ((e: any) => void)[]> = {};   // (the window's listeners and the view's, apart)
  const win: any = { addEventListener: (t: string, f: any) => { (L[t] ??= []).push(f); } }; win.top = win.self = win;
  const el: any = { addEventListener: (t: string, f: any) => { (V[t] ??= []).push(f); }, getBoundingClientRect: () => ({ left: 0, top: 0 }) };
  const make = () => { G.window = win; try { return new Input(el) as any; } finally { if (had === undefined) delete G.window; else G.window = had; } }, I = make();
  const ev = (e: any) => ({ repeat: false, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, target: {}, movementX: 0, movementY: 0, clientX: 0, clientY: 0, buttons: 0, button: 0, code: '', key: '', preventDefault() { }, stopPropagation() { }, ...e });
  const win$ = (t: string, e: any) => { for (const f of L[t] ?? []) f(ev(e)); }, view$ = (t: string, e: any) => { for (const f of V[t] ?? []) f(ev(e)); };
  const at = () => `${I.mouseX},${I.mouseY}`;
  I.dragOff = C.W.input.dragOff; view$('mousemove', { target: el, clientX: 100, clientY: 100 }); I.buttons |= 1;   // (the press made on the view: its mousedown asks the document for the focus, which the harness has not)
  win$('mousemove', { clientX: 300, clientY: 200, buttons: 1 }); const off = at();   // (over the panel, the button held)
  I.lockExcept = new Set<string>(); win$('mousemove', { clientX: 320, clientY: 210, buttons: 1 }); const locked = at(); I.lockExcept = null;
  I.keys.add('ShiftLeft'); I.heldAs.set('ShiftLeft', 'ShiftLeft');   // (Shift held, as its keydown files it)
   win$('mousemove', { clientX: 330, clientY: 220, buttons: 1, shiftKey: false }); const shiftUp = !I.down('ShiftLeft');
  win$('mousemove', { clientX: 400, clientY: 300, buttons: 0 }); const letGo = at(), latch = (I.buttons & 1) === 0;   // (let go outside the window: no mouseup ever comes)
  win$('mousemove', { clientX: 500, clientY: 300, buttons: 1 }); const panel = at();   // (a press begun on the panel, a slider: not the view's)
  for (const k in L) L[k] = []; const down = make(); down.dragOff = false; down.buttons = 1; const before = `${down.mouseX},${down.mouseY}`; for (const f of L.mousemove ?? []) f(ev({ clientX: 300, clientY: 200, buttons: 1 })); const downAt = `${down.mouseX},${down.mouseY}`;
  verdict(wired && off === '300,200' && locked === '320,210' && shiftUp && letGo === '330,220' && latch && panel === '330,220' && downAt === before,
    'the press made on the view and the mouse taken off it with the button down: the cursor is followed there (through a lock too) and a modifier the event says is up is let go; let go outside the window, it stops and the button is up; a press begun off the view is not followed; with the stick down, nothing of it',
    `the game says the stick is up: ${wired} · followed over the panel ${off} · under a lock ${locked} · Shift let go ${shiftUp} · let go outside ${letGo}, the button up ${latch} · a press off the view ${panel} · the stick down: ${before} → ${downAt}`);
}
async function harness() {
  console.log('\n=== harness: the lab and ?stalkdrag=1 have it, the page and the frozen stand do not ===');
  const shipped = process.env.TPS_PROFILE === 'shipped'; STALK.drag = shipped ? found : true;   // (the frozen stand's pin writes it down at every stand-up; the page's stand has it from the page's boot)
  const W: any = await quiet(() => standUp()), stood = STALK.drag;
  const snap = JSON.parse(JSON.stringify(JR.knobsSnapshot(W.game))), had = typeof snap.tables.STALK?.drag === 'boolean';
  STALK.drag = true; const snapUp = JSON.parse(JSON.stringify(JR.knobsSnapshot(W.game))); STALK.drag = false; JR.applyKnobs(W.game, snapUp); const kept = STALK.drag;
  delete snap.tables.STALK.drag; STALK.drag = true; JR.applyKnobs(W.game, snap); const old = STALK.drag;
  const read = (q: string) => { STALK.drag = !STALK.drag; PR.pageSwitches(new URLSearchParams(q)); return STALK.drag; };
  const plainQ = read(''), lab = read('sneaklab'), labOff = read('sneaklab&stalkdrag=0'), asked = read('stalkdrag=1');
  verdict(stood === false && !found && (STAND_ENV as string[]).includes('TPS_STALKDRAG') && had && kept === true && old === false && !plainQ && lab && !labOff && asked && !(PR.FROZEN_HOLDS as Record<string, string>)['STALK.drag'],
    'down as the harness stands up and in the plain page (so no row of the two stands\' list), up in the lab and with ?stalkdrag=1, down in the lab with ?stalkdrag=0; it rides a recording\'s tables, and a recording from before it replays with it down',
    `found ${found}, stood up ${stood} · in the tables ${had} · recorded up ${kept} · an old recording ${old} · plain ${plainQ} · ?sneaklab ${lab} · ?sneaklab&stalkdrag=0 ${labOff} · ?stalkdrag=1 ${asked}`);
}

/** the whole card (probes.ts 'stalkdrag'): true = every check passed. The switches are put back as they were found. */
export async function stalkdragCheck(): Promise<boolean> {
  const hold = JSON.parse(JSON.stringify(HOLD)), close = JSON.parse(JSON.stringify(CLOSE)), stalk = { ...STALK }; allPass = true; found = STALK.drag;
  try { await still(); await toward(); await side(); await stops(); await outside(); await off(); Object.assign(STALK, stalk); await harness(); }
  finally { Object.assign(HOLD, hold); Object.assign(CLOSE, close); Object.assign(STALK, stalk); }
  console.log(`\n=== stalkdrag: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`); return allPass;
}
if (import.meta.main) process.exit((await stalkdragCheck()) ? 0 : 1);
