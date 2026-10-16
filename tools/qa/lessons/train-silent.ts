// The scripted player for Training 7 (levels/train-silent.json; tools/qa/lesson-run.ts runs it): the quiet pair's orders, through the input only —
// the cursor on the floor / on a guard, X (the menu), a digit (the row), F (the mark), Space (the grab). One-frame presses, nothing held.
import type { Bot } from '../lesson-run';

export const query = '?quiet&squad=1';

const flat = (a: ArrayLike<number>, b: ArrayLike<number>) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const mate = (B: Bot) => B.g.guards.find((x: any) => x.unit && x.team === 'operative');
const man = (B: Bot, route: string) => B.g.guards.find((x: any) => !x.unit && B.g.level.routes[x.routeI]?.name === route);
const chest = (h: any): number[] => [h.char.pos[0], 1.2, h.char.pos[2]];
const inRect = (p: ArrayLike<number>, x0: number, x1: number, z0: number, z1: number) => p[0] > x0 && p[0] < x1 && p[2] > z0 && p[2] < z1;
/** X with the cursor on `p` (the menu comes up on what is there), then the row's digit */
function order(B: Bot, p: number[], digit: number, what: string) {
  B.wait(0.4);                       // (stood still: the camera has settled, the cursor's point is the point)
  B.aim(p); B.press('KeyX', 2);
  if (!B.g.orders.menu) B.fail(`${what}: X put no menu up`);
  B.say(`  X on ${B.g.orders.menu.target.kind} · ${digit}: ${what}`);
  B.aim(p); B.press(`Digit${digit}`, 3);
  if (B.g.orders.menu) B.press('Escape', 2);
}
const beside = (B: Bot): number[] => [B.pos()[0] + 1.4, 0, B.pos()[2] + 0.6];

export const steps: Record<string, (B: Bot) => void> = {
  // up the track, the gate, into the garden — and wait for him to come through it too
  follow: B => { B.go([6.4, 0, 14.0], 15); if (!B.openDoor('gate_w')) B.fail('the gate did not open'); B.go([11.6, 0, 14.6], 20);
    if (!B.until(() => inRect(mate(B).char.pos, 8.6, 14.6, 6.6, 21.6), 20)) B.fail('the partner did not follow into the yard'); },
  loud: B => { order(B, beside(B), 5, 'go loud'); },
  silent: B => { order(B, beside(B), 5, 'go silent'); },
  // crouched from here on. Round the end of the garden's wall, him behind
  round: B => { B.crouch(true); B.go([16.6, 0, 20.2], 40); },
  // a spot in the dark behind the man at the pump
  send: B => { order(B, [20.6, 0, 18.4], 1, 'move there · hold in the dark');
    if (!B.until(() => { const m = mate(B).char.pos; return inRect(m, 16.2, 23.0, 15.0, 21.6) && flat(m, B.pos()) > 2.5 && B.g.orders.of(mate(B))?.arrived; }, 25)) B.fail('the partner did not reach the dark spot');
    B.wait(0.6); },
  watch: B => { order(B, chest(man(B, 'post')), 2, 'watch him'); },
  mark: B => { order(B, chest(man(B, 'post')), 1, 'take him · on your mark'); },
  set: B => { const m = mate(B);
    if (!B.until(() => !!B.g.pair.jobOf(m)?.set, 60)) B.fail(`the partner never got set behind the first guard (${B.g.orders.statusOf(m)})`); },
  go: B => { const m = mate(B), h = man(B, 'post');
    B.press('KeyF');
    if (!B.until(() => h.state === 'dead', 15)) B.fail(`the mark was given and the guard is still up (${B.g.orders.statusOf(m)})`); },
  back: B => { order(B, beside(B), 3, 'fall in'); if (!B.until(() => flat(mate(B).char.pos, B.pos()) < 2.6, 30)) B.fail('the partner did not come back'); B.wait(0.4); },
  // on through the dark with him; hold him short of the second wall, and go on alone past its end, where both men of the closer are in view
  hold: B => { B.go([20.4, 0, 20.0], 30); B.until(() => flat(mate(B).char.pos, B.pos()) < 3, 15); order(B, beside(B), 4, 'hold position'); B.go([26.2, 0, 19.8], 30); },
  mark2: B => { order(B, chest(man(B, 'gate')), 1, 'take him · on your mark'); },
  // up the court wall to the dark behind the man at the watch house's door (the near one: he looks at the far one's back), while the partner works round to the other's back
  set2: B => { const m = mate(B);
    B.go([24.1, 0, 17.4], 30); B.go([24.1, 0, 14.9], 20);
    if (!B.until(() => !!B.g.pair.jobOf(m)?.set, 60)) B.fail(`the partner never got set behind the man at the gate (${B.g.orders.statusOf(m)})`); },
  // the grab is the mark: the partner's man drops on the same beat
  hands: B => { const m = mate(B), h2 = man(B, 'door'), h3 = man(B, 'gate');
    { const c = h2.char, f = c.bodyYaw; B.go([c.pos[0] - Math.sin(f) * 0.85, 0, c.pos[2] - Math.cos(f) * 0.85], 15, { near: 0.15 }); }   // (to his back, wherever he stands)
    if (!B.verb('guard', 'grab', chest(h2))) B.fail('no row to grab the guard at the door');
    if (!B.until(() => h3.state === 'dead', 15)) B.fail(`the grab did not send the partner (${B.g.orders.statusOf(m)})`); },
  // the man in his arm put to sleep
  sleep: B => { const h2 = man(B, 'door');
    if (!B.verb('held', 'choke')) B.fail('no row to put the held guard to sleep');
    if (!B.until(() => h2.state === 'dead' && !B.g.player.holding, 12)) B.fail('the held guard did not go to sleep'); },
};
/** the partner called in, the radio codes out of the red trunk, out by the back gate with him behind */
export function finish(B: Bot) {
  order(B, beside(B), 3, 'fall in');
  B.go([26.6, 0, 9.6], 30, { doorVerb: 'ease' }); B.go([27.3, 0, 8.6], 15);
  if (!B.verb('objective', 'drive', [27.55, 1.0, 8.6])) B.fail('no row to take the radio codes');
  if (!B.until(() => B.g.mission.stage === 'exfil', 20)) B.fail('the codes were not taken');
  B.go([26.6, 0, 11.6], 20); B.go([30.9, 0, 12.4], 30); B.go([35.4, 0, 14.0], 30);
}
