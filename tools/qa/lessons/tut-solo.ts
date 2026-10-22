// The scripted player for the tutorial's solo loud mission (levels/tut-solo.json; tools/qa/lesson-run.ts runs it): what each line asks, through the input only,
// in the order a new player would do it. He is mortal: the fights are the level's script's (levels/tut-solo.script.ts) and none of them is aimed at a man who
// does what the line says.
import type { Bot } from '../lesson-run';
import { AXIS, VAN, WALL, SENTRY, JAMB, BAGS_END, GAP, BARRIER, BACK, NEST, SHOP_DOOR, STORE_DOORWAY, TRUNK, ARCH_MOUTH, LAST_MEN, EXIT } from '../../levels/tut-solo';

export const query = '?quiet';
/** the level's fights are its script's, which the tutorial frame starts: on a stand without the frame this lesson cannot be played */
export const needs = 'rails';
/** THE LESSONS CAN BE FAILED THE WAY THEIR LINES SAY (each of these runs must end with the player down; tools/qa/tut-solo-check.ts asks it):
 *  TUT_SOLO_ARM=stand walks the sandbags standing, TUT_SOLO_ARM=nosmoke crosses the gap with no smoke up. Two more words are mistakes that must cost
 *  nothing: `piers` stands at each pier of the arch under the last two's fire, `dud` fires the first grenade from too close */
const brk = (): string => (typeof process !== 'undefined' ? process.env.TUT_SOLO_ARM : (globalThis as { __TUT_SOLO_ARM?: string }).__TUT_SOLO_ARM) ?? '';   // (read as the step runs: tools/qa/tut-solo-check.ts plays all three in one process)
/** THE DOOR'S LINE TEACHES HIS OWN CHARGE, and it is the one row the level lets that door offer (`rails.rows`: no pick, no boot). A stand that holds his own
 *  charges off (the frozen one) has no row there at all and the lesson cannot be done on it: a run there raises them, as it raises the frame. Said here,
 *  before the game stands up (TPS_OWNCHARGE=0 in front shows the door with nothing to offer) */
if (typeof process !== 'undefined' && process.env.TPS_PROFILE !== 'shipped') process.env.TPS_OWNCHARGE ??= '1';
/** the last men may already be down when 'Shoot the rest' comes up (the grenade took both) */
export const idleOk = ['last'];

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
  move: B => { once.clear(); B.go(VAN, 20); },
  // round the van's tail and across to the yard wall, running
  sprint: B => { B.go([3.2, 0, 17.4], 10); B.go(WALL, 12, { sprint: true, near: 0.6 }); },
  ready: B => { take(B, 'Digit2'); },
  // walk into the wall as the page takes one; the hold's own key where walking in is switched off (the frozen stand)
  wall: B => {
    if (B.g.player.wall) B.fail('he is on a wall before the line that teaches it');   // (the frame gives a wall to a walk only once `wall` is allowed: nothing before this line may lean on one)
    B.nudge([9.2, 0, WALL[2]], 1.5, () => !!B.g.player.wall);
    if (!B.g.player.wall) { B.aim([9.0, 1.2, WALL[2]]); B.press('KeyQ', 20); }
    if (!B.g.player.wall) B.fail('no wall taken beside the gate, by walking into it or by its key');
  },
  // slide to the gate's jamb, lean out, and shoot the man in the gate's line
  fire: B => {
    const g = B.g, s = g.guards[0];
    B.nudge([8.6, 0, AXIS + 0.4], 4, () => (g.player.wall?.peek ?? 0) >= 1 || line(B, s));
    // the page's way: at the wall's end with the rifle, the cursor on him steps the player out with it in the shoulder
    for (let i = 0; i < 90 && !line(B, s); i++) { B.aim(chest(s)); B.step(); }
    // the old hold (the frozen stand: hands down on the wall): off it and a step into the gate
    if (!line(B, s)) { if (g.player.wall) B.press('KeyQ', 10); B.go([8.3, 0, AXIS + 0.15], 6); }
    if (!fight(B, 1, 20)) B.fail(`the sentry did not drop (line ${line(B, s)}, he is ${s.state})`);
  },
  reload: B => { B.press('KeyR'); B.until(() => !gun(B).reloading, 5); },
  // in by the gate, round the barrier's far end, crouched at the arch's near jamb
  crouch: B => { if (B.g.player.wall) B.press('KeyQ', 10); B.go([10.6, 0, 11.2], 20); B.go(JAMB, 20); B.crouch(true); },
  // crouched through the arch and along behind the sandbags
  low: B => {
    if (brk() === 'again' && !once.has('low')) { once.add('low'); downAndBack(B, () => { B.crouch(false); B.go([16.9, 0, 13.3], 12, { stop: () => B.g.player.down }); B.go(BAGS_END, 15, { stop: () => B.g.player.down }); }, 'reload'); replay(B, ['reload', 'crouch']); B.until(() => stepIs(B, 'low'), 4); }
    if (brk() === 'stand') B.crouch(false); B.go([16.9, 0, 13.3], 12); B.go(BAGS_END, 15); if (brk() === 'stand') { B.wait(2.5); B.fail('BREAK stand: he walked the sandbags standing and was not hit'); }
  },
  smoke: B => {
    if (brk() === 'again' && !once.has('smoke')) { once.add('smoke'); downAndBack(B, () => { B.go(BARRIER, 10, { near: 0.5, stop: () => B.g.player.down }); }, 'reload'); replay(B, ['reload', 'crouch', 'low']); B.until(() => stepIs(B, 'smoke'), 4); B.step(30); }
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
  // the door's rows by the held key (a list on the page, a ring where that is switched on): its charge where his card carries one, the boot where it does not
  charge: B => {
    if (brk() === 'again' && !once.has('charge')) { once.add('charge'); handBack(B, 'pistol'); replay(B, ['pistol']); B.until(() => stepIs(B, 'charge'), 4); B.step(30); }
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
  back: B => { B.go(BACK, 10, { near: 0.5 }); },
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
  rifle: B => { take(B, 'Digit2'); },
  // 2 with the rifle up steps what is on the right button: the ring, then the grenade
  // the rifle's key again steps the launcher's load; where that key opens the gun's setup instead, the load is its row 2
  load: B => { B.press('Digit2', 20); if (B.g.lesson.step?.id === 'load') B.press('Digit2', 10); },
  // back out through the shop and the gun court to the arch's mouth
  leave: B => { B.go([ARCH_MOUTH[0], 0, AXIS], 40); },
  // the two in the shop's doorway behind him: the grenade into it, once both stand there (8.5 m and more: armed)
  launch: B => {
    const men = () => B.g.guards.slice(5);
    B.until(() => men().length >= 2 && men().every((x: any, k: number) => !up(x) || Math.hypot(x.char.pos[0] - LAST_MEN[k][0], x.char.pos[2] - LAST_MEN[k][2]) < 0.8), 12);
    if (brk() === 'again' && !once.has('launch')) { once.add('launch');
      handBack(B, 'take'); if (men().length) B.fail(`again: ${men().length} of the last men are on the floor before their line (the checkpoint is from before they came)`);
      replay(B, ['take', 'rifle', 'load', 'leave']); B.until(() => stepIs(B, 'launch'), 4); B.step(30);
      B.until(() => men().length >= 2 && men().every((x: any, k: number) => !up(x) || Math.hypot(x.char.pos[0] - LAST_MEN[k][0], x.char.pos[2] - LAST_MEN[k][2]) < 0.8), 12);
      if (men().length !== 2) B.fail(`again: ${men().length} last men after the checkpoint (two come, once)`); }
    const x = men().find(up); if (!x) B.fail('nobody came out through the shop');
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
