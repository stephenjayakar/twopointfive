// The scripted player for the tutorial's solo loud mission (levels/tut-solo.json; tools/qa/lesson-run.ts runs it): what each line asks, through the input only,
// in the order a new player would do it. He is mortal: the fights are the level's script's (levels/tut-solo.script.ts) and none of them is aimed at a man who
// does what the line says.
import type { Bot } from '../lesson-run';
import { AXIS, VAN, WALL, CORNER, JAMB, BAGS_END, GAP, BARRIER, BACK, NEST, LAMP, SHOP_DOOR, STORE_DOORWAY, TRUNK, ARCH_MOUTH, LAST_MEN, EXIT } from '../../levels/tut-solo';
import { SLOTSETUP } from '../../../src/game/slotsetup';

/** is the gun's setup switched on IN THE GAME THIS RUN PLAYS: on a page the script is its own bundle, with its own copy of the table (the page's is `__knobs`) */
const setupOn = (): boolean => (globalThis as { __knobs?: { registry?: () => Record<string, { on?: boolean }> } }).__knobs?.registry?.().SLOTSETUP?.on ?? SLOTSETUP.on;

export const query = '?quiet';
/** the level's fights are its script's, which the tutorial frame starts: on a stand without the frame this lesson cannot be played */
export const needs = 'rails';
/** THE LESSONS CAN BE FAILED THE WAY THEIR LINES SAY (each of these runs must end with the player down; tools/qa/tut-solo-check.ts asks it):
 *  TUT_SOLO_ARM=stand walks the sandbags standing, TUT_SOLO_ARM=nosmoke crosses the gap with no smoke up. Three more words are mistakes that must cost
 *  nothing: `east` stands on the road east of the van in the sentry's line, `piers` stands at each pier of the arch under the last two's fire, `dud` fires the
 *  first grenade from too close */
const brk = (): string => (typeof process !== 'undefined' ? process.env.TUT_SOLO_ARM : (globalThis as { __TUT_SOLO_ARM?: string }).__TUT_SOLO_ARM) ?? '';   // (read as the step runs: tools/qa/tut-solo-check.ts plays all three in one process)
/** THE DOOR'S LINE TEACHES HIS OWN CHARGE, and it is the one row the level lets that door offer (`rails.rows`: no pick, no boot). A stand that holds his own
 *  charges off (the frozen one) has no row there at all and the lesson cannot be done on it: the runner raises them for this run alone, as a run there
 *  raises the frame (TPS_OWNCHARGE=0 in front shows the door with nothing to offer) */
export const raises = { TPS_OWNCHARGE: '1' };
/** the last men may already be down when 'Shoot the rest' comes up (the grenade took both) */
/** …and where the gun has no setup (the switch off: the frozen stand) the two lines that open and shut it have nothing to ask and go by */
export const idleOk = ['last', 'setup', 'tab', 'load'];   // ('load': a kit that comes with the grenade on the launcher has nothing to load — the arm `loaded`)

/** the right button pressed, held on a world point for `secs` (the arc is up) and let go: Input's bits are 1 left · 2 middle · 4 right */
const rightHold = (B: Bot, p: number[], secs = 0.5) => { B.aim(p); B.step(); B.I.clicked |= 4; for (let i = 0; i < secs * 60; i++) { B.aim(p); B.I.buttons |= 4; B.step(); } B.I.buttons &= ~4; B.aim(p); B.step(3); };
const trigger = (B: Bot, at: () => number[], secs: number, stop?: () => boolean) => {
  B.aim(at()); B.step(); B.I.clicked |= 1;
  try { for (let i = 0; i < secs * 60; i++) { B.aim(at()); B.I.buttons |= 1; if (i % 14 === 13) B.I.clicked |= 1; B.step(); if (stop && stop()) break; } } finally { B.I.buttons &= ~1; B.step(); }   // (a fresh press every quarter second: the pistol fires a round a press)
};
const chest = (x: any): number[] => x.char.bones?.chest ?? [x.char.pos[0], 1.25, x.char.pos[2]];
const up = (x: any) => x.state !== 'dead';
const line = (B: Bot, x: any) => { const P = B.g.player.char, a = P.bones?.head ?? [P.pos[0], 1.5, P.pos[2]]; return !B.g.col.shotBlocked(a, chest(x)); };
const gun = (B: Bot) => B.g.player.slot === 'rifle' ? B.g.player.rifle : B.g.player.pistol;
const downed = (B: Bot) => B.g.guards.filter((x: any) => !up(x)).length;
/** shoot every man he has a line to until `n` are down (reloading as the gun runs dry), for `secs` at most */
const fight = (B: Bot, n: number, secs: number, move?: () => void, who?: any[]) => {
  const g = B.g, P = g.player, t0 = B.t();
  while (downed(B) < n && B.t() - t0 < secs && !P.down) {
    const w = gun(B); if (w.roundsReady === 0 && !w.reloading) { B.press('KeyR'); continue; }
    const x = (who ?? g.guards).filter((y: any) => up(y) && line(B, y)).sort((a: any, b: any) => Math.hypot(a.char.pos[0] - B.pos()[0], a.char.pos[2] - B.pos()[2]) - Math.hypot(b.char.pos[0] - B.pos()[0], b.char.pos[2] - B.pos()[2]))[0];
    if (!x) { if (move) move(); else B.step(); continue; }
    if (P.slot === 'pistol') { for (let i = 0; i < 16 && up(x); i++) { B.aim(chest(x)); B.step(); } B.click(1, chest(x)); B.step(6); }   // (a round a press, once the gun has come round to the cursor: the page's aim has weight)
    else trigger(B, () => chest(x), 1.2, () => !up(x) || !line(B, x));
  }
  return downed(B) >= n;
};
/** a slot's key, and the half second the thing takes to come into the hand (a click before that is not a throw) */
const take = (B: Bot, code: string) => { B.press(code, 5); B.until(() => B.g.player.equipT <= 0, 3); B.step(3); };
/** the can in the air, until it has gone off (or `secs`) */
const landed = (B: Bot, kind: string, secs: number) => { let seen = false; for (let i = 0; i < secs * 60; i++) { const it = B.g.items.items.some((x: any) => x.kind === kind && !x.fired); if (seen && !it) break; seen = seen || it; B.step(); } B.step(20); };

/** THE CHECKPOINTS (TUT_SOLO_ARM=again): a down costs the beat and no more. He goes down twice the way the lines warn of (the sandbags standing, the gap with
 *  no smoke) and takes the game's own way back each time (Enter: the last checkpoint, 'the gate'); the other three checkpoints are put back by the harness's
 *  hand a step after each was kept (nothing in this mission kills a man who does as he is told, so nothing else brings them back). After each he plays the
 *  beat again from its first line: every fight has to start clean from its cue. */
const once = new Set<string>();
const stepIs = (B: Bot, id: string) => B.g.lesson.step?.id === id;
/** play these lines again, each when it is the one that is up */
const SETUP = () => setupOn() ? ['setup', 'tab'] : [];
const replay = (B: Bot, ids: string[]) => { for (const id of ids) { if (!B.until(() => stepIs(B, id), 4)) B.fail(`again: '${id}' did not come up after the checkpoint (the lesson is on '${B.g.lesson.step?.id}')`); B.step(30); steps[id](B); B.step(30); } };
/** down as the line warns, then Enter */
const downAndBack = (B: Bot, how: () => void, to: string) => {
  how(); if (!B.until(() => B.g.player.down, 4)) B.fail(`again: he was not hit (${to})`);
  B.step(20); B.press('Enter', 20);
  if (B.g.player.down || !stepIs(B, to)) B.fail(`again: Enter did not put him back at '${to}' (down ${B.g.player.down}, the lesson is on '${B.g.lesson.step?.id}')`);
  B.say(`  down, and back at '${to}' by Enter`);
};
/** the newest checkpoint of this run, put back by the harness */
const handBack = (B: Bot, to: string) => {
  const g = B.g, ck = g.saves.newest(true, g.mission.stats.elapsed), why = ck ? g.saves.loadInStep(g, ck.key) : 'no checkpoint on the shelf'; B.step(20);
  if (why || !stepIs(B, to)) B.fail(`again: the checkpoint was not put back at '${to}' (${why ?? `the lesson is on '${g.lesson.step?.id}'`})`);
  B.say(`  the checkpoint put back: '${to}'`);
};

export const steps: Record<string, (B: Bot) => void> = {
  // THE ROAD: off the start mark and behind the van the sentry is shooting at
  // (TUT_SOLO_ARM=east first walks the wrong side of the van and stands in the sentry's line: he holds his fire for a man there, and nobody is hit)
  move: B => {
    once.clear();
    if (brk() === 'east') { B.go([6.3, 0, 17.0], 10); B.go([6.0, 0, 14.0], 10); B.wait(6); if (B.g.player.down) B.fail('BREAK east: he stood in the sentry\'s line east of the van and was hit'); B.go([6.3, 0, 17.6], 10); B.go([3.0, 0, 18.2], 10); }
    B.go(VAN, 20);
  },
  ready: B => { take(B, 'Digit2'); },
  // round the van's nose and along the forecourt's edge to the yard wall, running: never in the gate's line
  sprint: B => { B.go([3.3, 0, 12.0], 10); B.go(WALL, 12, { sprint: true, near: 0.6 }); },
  // walk into the wall as the page takes one; the hold's own key where walking in is switched off (the frozen stand)
  wall: B => {
    if (B.g.player.wall) B.fail('he is on a wall before the line that teaches it');   // (the frame gives a wall to a walk only once `wall` is allowed: nothing before this line may lean on one)
    B.nudge([9.2, 0, WALL[2]], 1.5, () => !!B.g.player.wall);
    if (!B.g.player.wall) { B.aim([9.0, 1.2, WALL[2]]); B.press('KeyQ', 20); }
    if (!B.g.player.wall) B.fail('no wall taken beside the gate, by walking into it or by its key');
  },
  // along the wall to the gate's corner, and the cursor on the man past it: the page steps him out with the rifle in the shoulder (the old hold leans his back out)
  peek: B => {
    const g = B.g, s = g.guards[0];
    const w = () => g.player.wall, stack = () => w()?.kind === 'stack';
    B.nudge([8.6, 0, CORNER[2] + 0.5], 4, () => !w() || line(B, s) || (stack() ? !!w()!.atEdge : (w()!.peek ?? 0) > 0.5));   // (the old hold leans his back out as he presses on past the end; with the rifle in the shoulder the slide stops at the end and the cursor does the rest)
    if (stack() && !stepIs(B, 'peek')) B.fail('the lean\'s line went by on the slide alone, before the cursor was past the corner');
    for (let i = 0; i < 150 && stepIs(B, 'peek'); i++) { B.aim(chest(s)); B.step(); }
    B.say(`  at the corner: lean ${(g.player.wall?.lean ?? 0).toFixed(2)} · peek ${(g.player.wall?.peek ?? 0).toFixed(2)} · a line to the sentry ${line(B, s)} · body z ${B.pos()[2].toFixed(2)}`);
    if (stepIs(B, 'peek')) B.fail('at the gate\'s corner with the cursor on the sentry he did not lean out');
  },
  // …and shoot the man in the gate's line from there
  fire: B => {
    const g = B.g, s = g.guards[0];
    for (let i = 0; i < 90 && !line(B, s); i++) { B.aim(chest(s)); B.step(); }
    // the old hold (the frozen stand: his back to the wall, hands down): off it and a step into the gate, on the side his rifle clears
    if (!line(B, s) && g.player.wall?.kind !== 'stack') { if (g.player.wall) B.press('KeyQ', 10); B.go([8.3, 0, AXIS], 6, { near: 0.12 }); }
    if (!line(B, s)) B.fail('leaning round the gate\'s corner he has no line to the sentry');
    const r0 = gun(B).roundsReady;
    if (!fight(B, 1, 20)) B.fail(`the sentry did not drop (line ${line(B, s)}, he is ${s.state}, ${r0 - gun(B).roundsReady} rounds left the gun)`);
    B.say(`  the sentry is down from the corner: ${r0 - gun(B).roundsReady} round(s)`);
  },
  reload: B => { B.press('KeyR'); B.until(() => !gun(B).reloading, 5); },
  // the rifle's selector: its own key on the stand from before the gun's setup, the setup's first row where that is up (the rifle's digit, then 1: a digit
  // that is the pistol's slot anywhere else, and the pistol has no line yet). The run as the lines say stays on full auto, as a player is left; the arms that are each about one mistake go back to single
  // shots, which their fights were measured on
  // the rifle's setup, opened and shut with nothing picked: its rows are locked on these two lines (a row's digit must do nothing), and Tab is the way out.
  // Where the gun has no setup (the switch off) both lines go by with nothing asked
  setup: B => { once.add('setup'); if (!setupOn()) return; B.press('Digit2', 12); if (!B.g.player.setup) B.fail('the rifle\'s key pressed again did not open its setup'); },
  tab: B => { once.add('tab'); if (!setupOn()) return;
    const rf = B.g.player.rifle, was = `${rf.mode} ${rf.attachment}`; B.press('Digit1', 8); B.press('Digit2', 8);
    if (!B.g.player.setup || `${rf.mode} ${rf.attachment}` !== was) B.fail(`a row's digit was taken on the line that only opens the setup (${was} → ${rf.mode} ${rf.attachment}, the setup ${B.g.player.setup ? 'up' : 'shut'})`);
    B.press('Tab', 12); if (B.g.player.setup) B.fail('Tab did not close the rifle\'s setup'); },
  auto: B => {
    if (setupOn() && !(once.has('setup') && once.has('tab'))) B.fail('the setup\'s two lines went by with nothing done');
    const flip = () => { if (setupOn()) { B.press('Digit2', 12); B.press('Digit1', 12); } else B.press('KeyZ', 12); };
    flip(); if (stepIs(B, 'auto')) B.fail(`the selector did not move (the rifle is on ${B.g.player.rifle.mode}, the hands hold ${B.g.player.slot}, its setup is ${B.g.player.setup ? 'up' : 'shut'}, reloading ${gun(B).reloading})`);
    if (B.g.player.slot !== 'rifle') B.fail(`the selector's digit took the ${B.g.player.slot} into his hands`);
    if (brk() === '') return;
    B.step(100); flip(); B.step(100);   // (past the setup's own clock, so the next press of the rifle's digit opens it afresh)
    if (B.g.player.rifle.mode !== 'semi') B.fail(`the selector did not come back to single shots (${B.g.player.rifle.mode})`);
  },
  // in by the gate, round the barrier's far end, up beside the blue gate; then down, as the gun starts along the sandbags
  arch: B => { if (B.g.player.wall) B.press('KeyQ', 10); B.go([10.6, 0, 11.2], 20); B.go(JAMB, 20); },
  crouch: B => { B.wait(1.2); B.crouch(true); },
  // crouched through the arch and along behind the sandbags
  low: B => {
    if (brk() === 'again' && !once.has('low')) { once.add('low'); downAndBack(B, () => { B.crouch(false); B.go([16.9, 0, 13.3], 12, { stop: () => B.g.player.down }); B.go(BAGS_END, 15, { stop: () => B.g.player.down }); }, 'reload'); replay(B, ['reload', ...SETUP(), 'auto', 'arch', 'crouch']); B.until(() => stepIs(B, 'low'), 4); }
    if (brk() === 'stand') B.crouch(false); B.go([16.9, 0, 13.3], 12); B.go(BAGS_END, 15); if (brk() === 'stand') { B.wait(2.5); B.fail('BREAK stand: he walked the sandbags standing and was not hit'); }
  },
  smoke: B => {
    if (brk() === 'again' && !once.has('smoke')) { once.add('smoke'); downAndBack(B, () => { B.go(BARRIER, 10, { near: 0.5, stop: () => B.g.player.down }); }, 'reload'); replay(B, ['reload', ...SETUP(), 'auto', 'arch', 'crouch', 'low']); B.until(() => stepIs(B, 'smoke'), 4); B.step(30); }
    if (brk() === 'nosmoke') { B.go(BARRIER, 10, { near: 0.5 }); B.wait(2.5); B.fail('BREAK nosmoke: he crossed the gap with no smoke up and was not hit'); } take(B, 'Digit3'); B.click(1, GAP); landed(B, 'smoke', 4); B.wait(2.8);
  },
  // when the plume is up: across the gap, behind the barrier
  cross: B => { B.go(BARRIER, 10, { near: 0.5 }); },
  // over the barrier and into the nest; a second one if the first fell short
  frag: B => {
    B.crouch(false);
    for (let i = 0; i < 2 && downed(B) < 2; i++) { take(B, 'Digit5'); B.click(1, NEST); landed(B, 'frag', 4.5); }
    if (downed(B) < 2) { take(B, 'Digit2'); B.go([24.9, 0, 11.6], 10, { stop: () => line(B, B.g.guards[1]) }); fight(B, 2, 20); }
  },
  pistol: B => { take(B, 'Digit1'); },
  // the lamp on its pole by the shop's front, from behind the barrier: a round a press until it is dark
  lamp: B => {
    const T = B.g.targets.find((t: any) => t.name === 'lamp_shop'); if (!T) B.fail('no lamp_shop among the light targets');
    for (let i = 0; i < 10 && stepIs(B, 'lamp'); i++) { for (let k = 0; k < 20; k++) { B.aim(LAMP); B.step(); } B.click(1, LAMP); B.step(12); if (gun(B).roundsReady === 0) { B.press('KeyR'); B.until(() => !gun(B).reloading, 5); } }
    if (stepIs(B, 'lamp')) B.fail('ten pistol rounds at the lamp and it is still lit');
    B.say(`  the lamp is out: the light on him ${Math.round((B.g.player.visibility ?? 0) * 100)}`);
  },
  // the door's rows by the held key (a list on the page, a ring where that is switched on): its charge where his card carries one, the boot where it does not
  charge: B => {
    if (brk() === 'again' && !once.has('charge')) { once.add('charge'); handBack(B, 'pistol'); replay(B, ['pistol', 'lamp']); B.until(() => stepIs(B, 'charge'), 4); B.step(30); }
    const g = B.g, c = [SHOP_DOOR[0], 1.0, SHOP_DOOR[2]];
    B.go([24.2, 0, AXIS + 0.2], 10);
    for (let i = 0; i < 30; i++) { B.aim(c); B.step(); }
    const rows = g.nearby.filter((r: any) => r.kind === 'door').map((r: any) => r.verb);
    B.say(`  the door's rows: ${rows.join(' ')}`);
    // (the level names the rows its lines teach: at this door that is the charge and nothing else, the lock's pick and the boot have no line)
    if (rows.join(' ') !== 'charge') B.fail(`the shop's door offers '${rows.join(' ')}', not the charge alone`);
    if (!B.verb('door', 'charge', c)) B.fail(`no 'charge' row on the shop's door`);
    B.until(() => !g.player.charging && !g.player.kick, 12); B.step(20);
  },
  // beside the door, on the ground the shop's lamp lit until he shot it out: dark now (asked of the harness's meter, which has no moon; said of the page's)
  back: B => {
    B.go(BACK, 10, { near: 0.5 }); B.step(20);
    const lit = Math.round((B.g.player.visibility ?? 0) * 100); B.say(`  beside the door with the lamp out: the light on him ${lit}`);
    if (B.W && lit > 25) B.fail(`the lamp is out and he is still lit beside the door (${lit}): 'the dark is cover too' is not true here`);
  },
  blow: B => { B.press('KeyF', 30); },
  // out from beside the door, square to the doorway (from its edge the rounds go into the jamb), and the pistol
  shop: B => {
    const s = B.g.guards[2];
    B.go([23.5, 0, AXIS + 0.05], 6);
    if (!fight(B, 3, 25, () => { B.step(6); }, [s])) B.fail('the man in the shop did not drop');
  },
  // from the shop's floor, the can through the doorway to the store
  stun: B => { B.go([26.8, 0, AXIS], 10); take(B, 'Digit4'); B.click(1, [33.4, 0.1, AXIS]); landed(B, 'flash', 3.4); },
  // the pistol, and INTO the room (a gun in a doorway has no room to come up across the jamb)
  store: B => {
    if (brk() === 'again' && !once.has('store')) { once.add('store'); handBack(B, 'stun'); replay(B, ['stun']); B.until(() => stepIs(B, 'store'), 4); B.step(30); }
    take(B, 'Digit1'); B.go([STORE_DOORWAY[0], 0, AXIS], 6);
    if (!fight(B, 5, 30, () => { B.nudge(STORE_DOORWAY, 0.3); })) B.fail('the two in the store did not drop');
  },
  // (the line asks for a TAP, and a tap does the top row: a body in arm's reach outranks the trunk there, so no man of the store may lie by it)
  take: B => { B.go([TRUNK[0] - 0.95, 0, TRUNK[2]], 15); B.step(2);
    const top = B.g.nearby.find((r: any) => !!r.verb); if (top && top.verb !== 'drive') B.fail(`a tap at the trunk gives '${top.kind} ▸ ${top.verb}', not the code book`);
    if (!B.verb('objective', 'drive', [TRUNK[0] - 0.4, 0.5, TRUNK[2]])) B.fail('no row to take the code book'); B.until(() => B.g.mission.stage === 'exfil', 20); },
  rifle: B => { take(B, 'Digit2');
    // (the arm `loaded`: the launcher as a kit with no other load deals it, the grenade already on the right button, put there by hand before its line)
    if (brk() === 'loaded') { const rf = B.g.player.rifle; for (let k = 0; k < 4 && rf.attachment !== 'he40'; k++) rf.cycleAttachment(); if (rf.attachment !== 'he40') B.fail('loaded: the launcher has no grenade to put up'); } },
  // 2 with the rifle up steps what is on the right button: the ring, then the grenade
  // the rifle's key again steps the launcher's load; where that key opens the gun's setup instead, the load is its row 2
  load: B => { if (B.g.player.rifle.attachment === 'he40') return; B.press('Digit2', 20); if (B.g.lesson.step?.id === 'load') B.press('Digit2', 10); },
  // back out through the shop and the gun court to the arch's mouth
  leave: B => { const d = B.g.doors.byName('store')!; if (!d.locked || Math.abs(d.angle) > 0.05) B.fail('the store\'s back door is open or unlocked before the last two come by it'); B.go([ARCH_MOUTH[0], 0, AXIS], 40); },
  // the two in the shop's doorway behind him: the grenade into it, once both stand there (8.5 m and more: armed)
  launch: B => {
    const men = () => B.g.guards.slice(5);
    B.until(() => men().length >= 2 && men().every((x: any, k: number) => !up(x) || Math.hypot(x.char.pos[0] - LAST_MEN[k][0], x.char.pos[2] - LAST_MEN[k][2]) < 0.8), 12);
    if (brk() === 'again' && !once.has('launch')) { once.add('launch');
      handBack(B, 'take'); if (men().length) B.fail(`again: ${men().length} of the last men are on the floor before their line (the checkpoint is from before they came)`);
      replay(B, ['take', 'rifle', 'leave', 'load']); B.until(() => stepIs(B, 'launch'), 4); B.step(30);
      B.until(() => men().length >= 2 && men().every((x: any, k: number) => !up(x) || Math.hypot(x.char.pos[0] - LAST_MEN[k][0], x.char.pos[2] - LAST_MEN[k][2]) < 0.8), 12);
      if (men().length !== 2) B.fail(`again: ${men().length} last men after the checkpoint (two come, once)`); }
    const x = men().find(up); if (!x) B.fail('nobody came out through the shop');
    // (they come by the store's back door, from the lane outside: it was shut and locked on him until now)
    if (!(Math.abs(B.g.doors.byName('store')!.angle) > 1)) B.fail('the last two are in the doorway and the store\'s back door is not open: they did not come by it');
    // (two ways a new player gets this wrong, each of which must cost him nothing: tools/qa/tut-solo-check.ts)
    if (brk() === 'piers') for (const z of [AXIS - 1.25, AXIS + 1.3]) { B.go([ARCH_MOUTH[0] + 0.1, 0, z], 6, { near: 0.25 }); B.wait(4); if (B.g.player.wall) B.press('KeyQ', 10); B.go([ARCH_MOUTH[0], 0, AXIS], 6); }   // (the page takes the pier as a wall: off it, and back to the mouth, before the launcher)
    if (brk() === 'dud') { B.go([20.4, 0, AXIS], 8); rightHold(B, chest(x)); B.wait(3);
      if (men().some((y: any) => !up(y) || y.script === undefined || y.script === null)) B.fail('dud: a grenade from 5 m put a man down or let one go');
      B.go([ARCH_MOUTH[0], 0, AXIS], 8); }
    B.wait(0.5); rightHold(B, chest(x)); B.wait(1.5);
  },
  // whoever the grenade left: the rifle, from the arch, and after him if he will not come
  last: B => {
    const g = B.g;
    fight(B, 7, 60, () => { const x = g.guards.find(up); if (!x) return; const p = x.char.pos; if (Math.hypot(p[0] - B.pos()[0], p[2] - B.pos()[2]) > 14) B.go([p[0], 0, p[2]], 1.5, { stop: () => line(B, x) }); else B.step(10); });
  },
  out: B => { B.go([10.6, 0, 11.6], 40, { sprint: true }); B.go([EXIT.x - 1.6, 0, EXIT.z], 20, { sprint: true }); },
};
