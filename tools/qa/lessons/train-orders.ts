// The scripted player for Training 5 (levels/train-orders.json; tools/qa/lesson-run.ts runs it): a pair commanded through the input only — the cursor on the
// target, X, then the row's digit (5 turns a door's menu to its tools); B for the usual order; F for the word — on a held threshold, and the one that blows a
// set charge.
import type { Bot } from '../lesson-run';

export const query = '?roomclear=1';
/** a room clear ends when every room is taken (game/roomclear.ts): the mission's own stages stand still under it */
export const ended = (g: any) => g.roomClear?.end === 'taken';

/** the ground by the sandbags at the street's west end, a point down the street, open ground beside the commander */
const BAGS = [11.6, 0.02, 11.7], STREET = [17.0, 0.02, 14.0], GROUND = [13.0, 0.02, 14.8];
const BARRIER = [18.7, 0, 15.4];
const DOOR_A = [16.6, 1.0, 11.6], DOOR_B = [25.2, 1.0, 11.6], DOOR_C = [23.0, 1.0, 16.4], DOOR_D = [16.0, 1.0, 16.4];
const cleared = (B: Bot, id: string) => !!B.g.roomClear.rooms.find((r: any) => r.def.id === id)?.cleared;
const last = (B: Bot) => { const l = B.g.orders.log; return l.length ? l[l.length - 1] : null; };

/** the cursor on `p`, X, the menu must be up on the kind of thing meant */
function menu(B: Bot, p: number[], kind: 'floor' | 'door') {
  const O = B.g.orders;
  B.aim(p); B.step(2); B.aim(p); B.press('KeyX', 2);
  if (!O.menu) B.fail(`X opened no menu at (${p[0]}, ${p[2]})`);
  if (O.menu.target.kind !== kind) B.fail(`X at (${p[0]}, ${p[2]}) opened the menu on '${O.menu.target.kind}', not a ${kind}`);
}
/** …and the digits, one press each */
function order(B: Bot, p: number[], kind: 'floor' | 'door', digits: number[], id: string) {
  const n = B.g.orders.log.length;
  menu(B, p, kind);
  for (const d of digits) B.press(`Digit${d}`, 2);
  const l = last(B);
  if (B.g.orders.log.length === n || l.order !== id) B.fail(`${digits.join(', ')} gave no '${id}' (the last order: ${l ? `${l.order} on ${l.target}` : 'none'})`);
  B.say(`  X ${digits.join(' ')}: ${l.order} · ${l.who.join(', ')} · ${l.target}`);
}

export const steps: Record<string, (B: Bot) => void> = {
  menu: B => { menu(B, BAGS, 'floor'); },
  // the menu of the step before is still up on the ground by the sandbags: the digit alone (were it gone, the line says X on the ground again)
  move: B => {
    if (!B.g.orders.menu) { B.say('  the menu is gone: X on the ground again'); menu(B, BAGS, 'floor'); }
    B.press('Digit1', 2); const l = last(B);
    if (l?.order !== 'move') B.fail(`1 gave no move order (the last order: ${l ? `${l.order} on ${l.target}` : 'none'})`);
    B.say(`  1: ${l.order} · ${l.who.join(', ')} · ${l.target}`); B.wait(3);
  },
  cover: B => { order(B, STREET, 'floor', [2], 'cover'); B.wait(1.5); },
  hold: B => { order(B, GROUND, 'floor', [4], 'hold'); B.wait(1); },
  fallin: B => { order(B, GROUND, 'floor', [3], 'fallIn'); },
  // up the street to a place west of the yellow house's door, out of its line; the door's own order at once
  stack: B => {
    B.go([13.2, 0, 13.4], 20); B.wait(1.5);
    B.aim(DOOR_A); B.step(2); B.aim(DOOR_A); B.press('KeyB', 2);
    const l = last(B); if (l?.order !== 'stack' || l.target !== 'door:hut_a') B.fail(`B on the yellow house's door gave ${l ? `${l.order} on ${l.target}` : 'nothing'}`);
    B.until(() => B.g.orders.squad().every((m: any) => m.state === 'dead' || B.g.orders.of(m)?.arrived), 15);
  },
  open: B => { order(B, DOOR_A, 'door', [5, 1], 'openClear'); },
  in1: B => { if (!B.until(() => cleared(B, 'a'), 45)) B.fail('the yellow house was not cleared'); B.wait(1); B.go([16.5, 0, 9.6], 20); },
  bang: B => { B.go([21.4, 0, 13.3], 25); order(B, DOOR_B, 'door', [5, 2], 'bangClear'); },
  in2: B => { if (!B.until(() => cleared(B, 'b'), 60)) B.fail('the green house was not cleared'); B.wait(1); B.go([25.2, 0, 9.6], 20); },
  // the kitchen held from outside: X, 5 (the tools), 4 — the one order as the page ships it; where that switch is off (the frozen stand) 4 opens the
  // threshold's page and 1 on it is 'hold until I say'
  thr: B => {
    B.go([20.2, 0, 13.6], 25);
    const n = B.g.orders.log.length; menu(B, DOOR_D, 'door'); B.press('Digit5', 2); B.press('Digit4', 2);
    const paged = !!B.g.orders.menu; if (paged) B.press('Digit1', 2);
    const l = last(B); if (B.g.orders.log.length === n || l.order !== 'thresholdHold') B.fail(`5, 4${paged ? ', 1' : ''} gave no 'thresholdHold' (the last order: ${l ? `${l.order} on ${l.target}` : 'none'})`);
    B.say(`  X 5 4${paged ? ' 1' : ''}: ${l.order} · ${l.who.join(', ')} · ${l.target}`);
  },
  // … and once the pair is on the open door, the word: nothing but F here
  word: B => {
    const op = () => B.g.doorTools.ops.find((o: any) => o.door.def.name === 'hut_d' && o.kind === 'threshold');
    if (!B.until(() => op()?.phase === 'thr', 40)) B.fail(`the pair never held the kitchen's door (its order: ${op() ? op().phase : 'gone'})`);
    B.wait(1.5); if (B.g.orders.menu) B.fail('a menu is up before the word');
    B.press('KeyF', 2);
    const o = op(), cans = B.g.doorTools.bangs;
    if (!o?.beats.some((b: any) => b.what === 'the word')) B.fail('F was not taken as the word');
    if (!B.until(() => cleared(B, 'd'), 60)) B.fail('the kitchen was not cleared after the word');
    B.say(`  F: ${o.beats.map((b: any) => b.what).join(' → ')} · cans thrown ${cans - B.g.doorTools.bangs}`);
  },
  // they call it clear (the word step waited for that): in through the kitchen's door
  in3: B => { if (!B.until(() => cleared(B, 'd'), 30)) B.fail('the kitchen was not cleared'); B.wait(1); B.go([16.0, 0, 18.6], 25); },
  // (the armoury's door must be locked against the yard's face, the one the team works it from)
  charge: B => {
    B.go([19.4, 0, 13.6], 25);
    if (!B.g.doors.lockedOut(B.door('hut_c'), B.g.player.char.pos)) B.fail('the armoury is not locked from the street');
    order(B, DOOR_C, 'door', [5, 3], 'charge');
  },
  // the charge is set and the pair stands off it (the order's 'armed' stage: the menu's row now reads 'blow the charge'): the word, and the door must go
  blow: B => {
    const op = () => B.g.doorTools.ops.find((o: any) => o.door.def.name === 'hut_c' && o.kind === 'charge');
    B.go(BARRIER, 20);   // (to the marker: behind the barrier, west of the door and out of its line)
    if (!B.until(() => B.g.doorTools.set.length > 0 && op()?.phase === 'armed', 60)) B.fail(`the pair never stood off a set charge (charges set ${B.g.doorTools.set.length}, its order: ${op() ? op().phase : 'gone'})`);
    B.say(`  the pair stands off at ${B.g.orders.squad().map((m: any) => `(${m.char.pos[0].toFixed(1)}, ${m.char.pos[2].toFixed(1)})`).join(' ')}`);
    B.press('KeyF', 2);
    if (!B.until(() => !!B.door('hut_c').lockBroken, 3)) B.fail('F did not blow the charge on the locked door');
  },
  // they call it clear (the room clear ends on that frame): in through the blown door
  in4: B => { if (!B.until(() => cleared(B, 'c'), 40)) B.fail('the armoury was not cleared behind its charge'); B.wait(1); B.go([23.0, 0, 18.6], 25); },
};
/** anything still held is given 'open and clear' (nothing is, after the last step: the run has ended) */
export function finish(B: Bot) {
  if (B.until(() => ended(B.g), 30)) return;
  for (const [id, door] of [['a', DOOR_A], ['b', DOOR_B], ['d', DOOR_D], ['c', DOOR_C]] as const) {
    if (cleared(B, id)) continue;
    order(B, door as unknown as number[], 'door', [5, 1], 'openClear'); B.until(() => cleared(B, id) || ended(B.g), 40);
  }
}
