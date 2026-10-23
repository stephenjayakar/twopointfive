// The scripted player for Training 2 (levels/train-hands.json; tools/qa/lesson-run.ts runs it): what each step asks, through the input only.
// THE STAND: this lesson teaches the page's buttons (Left = the knife, Right = the knockout: the close-in mode, src/game/close.ts). The shipped stand
// (TPS_PROFILE=shipped) has that mode on by itself. The frozen stand pins it off while the game is stood up, and the runner gives a script no call before
// its first step: so the FIRST statement of the first step turns it on (nothing has been pressed yet; the same in both arms, lesson on / off).
import type { Bot } from '../lesson-run';
import { CLOSE } from '../../../src/game/close';

export const query = '?quiet';
// THE MOON ON HIS METER (lesson-run's --moon): the CPU's light estimate leaves the moon out, and this court is lit by little else. Without it every mark in the
// open yard read dark here and 57 % on the page — the wall mark beside the gap did, and the last man saw a player who stood on it (his tape, 10-13).
export const mode = { moon: true };

const man = (B: Bot, route: string) => B.g.guards.find((x: any) => x.route?.name === route) ?? B.g.guards[['north', 'south', 'east'].indexOf(route)];
/** how many times the shift has had eyes on him so far (the chronicle's own rows: a sighting, a man gone to alert) */
const seen = (B: Bot): number => B.g.chronicle.events.filter((e: any) => e.kind === 'spotted' || e.kind === 'contact').length;
/** a person's beat between seeing the last man come through and moving (the tape's player took about a second; TPS_REACT tries others) */
const REACT = Number((globalThis as any).process?.env?.TPS_REACT ?? 0.6);   // (no bare `process`: this file is also bundled for the page, where there is none)
const flat = (a: ArrayLike<number>, b: ArrayLike<number>) => Math.hypot(a[0] - b[0], a[2] - b[2]);
/** the spot `d` metres straight behind a man, as he faces now */
const behind = (gd: any, d: number): number[] => { const p = gd.char.pos, y = gd.char.bodyYaw; return [p[0] - Math.sin(y) * d, 0, p[2] - Math.cos(y) * d]; };
/** crouched up to a standing man's back, the last strides straight at him; true once in reach behind him */
function closeIn(B: Bot, gd: any, via: number[]): boolean {
  B.crouch(true);
  B.go(via, 40);
  B.go(behind(gd, 1.6), 20, { near: 0.25 });
  B.nudge(behind(gd, 0.8), 6, () => flat(B.pos(), gd.char.pos) < 0.92);
  B.step(6);
  return flat(B.pos(), gd.char.pos) < 1.05;
}

export const steps: Record<string, (B: Bot) => void> = {
  draw: B => { CLOSE.on = true; B.press('Digit1', 30); },
  holster: B => { B.press('KeyE', 30); },
  // in by the gate (eased: no noise), crouched to the hatch in the cook's wall
  window: B => {
    B.crouch(true); B.go([6.6, 0, 14.0], 15); if (!B.openDoor('gate_w', 'ease')) B.fail('the gate did not open');
    B.until(() => !B.door('gate_w').isClosed(), 4);
    B.go([9.6, 0, 14.0], 20); B.go([12.6, 0, 13.4], 30); B.go([12.8, 0, 11.0], 10, { near: 0.12 }); B.wait(0.5);
  },
  whistle: B => { B.press('KeyV', 0); },
  // three strides: through the wood store's doorway beside the hatch and behind its wall
  clear: B => { B.go([12.95, 0, 9.2], 10); B.go([11.6, 0, 8.5], 10); },
  // he comes the long way: out of the kitchen, through the gap, up past the gate to the hatch; looks, and gives up there. Nothing is pressed until he has
  wait: B => {
    const A = man(B, 'north');
    const came = B.until(() => A.state !== 'patrol', 6);
    B.say(`  the whistle ${came ? `brought ${A.callsign} off his post` : 'moved nobody (or he has been and gone)'}`);
    if (!B.until(() => A.state === 'patrol', 120)) B.fail(`${A.callsign} did not settle (state ${A.state})`);
    B.say(`  ${A.callsign} gave up at ${A.char.pos[0].toFixed(1)}, ${A.char.pos[2].toFixed(1)}, facing ${A.char.bodyYaw.toFixed(2)}`);
    if (seen(B)) B.fail(`${A.callsign} saw the player in the wood store`);
  },
  // …then out by the store's far end and ROUND to his back: down the west wall, wide of him, and up from the south-west. He stands at the hatch facing the
  // wood store's doorway and looks from the hatch round to the north: straight at him from the west, in the moon, is the edge of what he sees inside 3.5 m
  grab: B => {
    const A = man(B, 'north');
    let at = [...A.char.pos], since = B.t();
    B.until(() => { if (flat(A.char.pos, at) > 0.05) { at = [...A.char.pos]; since = B.t(); } return B.t() - since > 1.5; }, 20);
    if (flat(A.char.pos, [12.6, 0, 11.2]) > 2.5) B.fail(`${A.callsign} did not come to the hatch (he stands at ${A.char.pos[0].toFixed(1)}, ${A.char.pos[2].toFixed(1)})`);
    const n0 = seen(B);
    B.crouch(true); B.go([8.8, 0, 8.6], 20); B.go([8.8, 0, 13.0], 20);
    if (!closeIn(B, A, [10.4, 0, 13.3])) B.fail('could not get behind the first man');
    if (A.state !== 'patrol' || seen(B) > n0) B.fail(`${A.callsign} noticed the player coming round behind him (${A.state})`);
    if (!B.verb('guard', 'grab')) B.fail('no grab row behind the first man');
    if (!B.until(() => B.g.player.holding?.phase === 'held', 4)) B.fail('the grab did not take');
  },
  // asked until the key on his belt is in the player's pocket (the first answer here is the key: nothing else on this floor is news)
  question: B => {
    for (let i = 0; i < 4 && !B.g.player.keys.has('hut'); i++) { if (!B.verb('held', 'question')) B.fail('no question row with a man held'); B.wait(3); }
    if (!B.g.player.keys.has('hut')) B.fail('four questions and no key');
    B.say(`  the key: ${[...B.g.player.keys].join(', ')}`);
  },
  choke: B => { const A = man(B, 'north'); if (CLOSE.heldClicks) B.click(2); else if (!B.verb('held', 'choke')) B.fail('no choke row with a man held');   // (the way the line teaches where the page has it: the right button; the row's way on the frozen stand)
    if (!B.until(() => A.state === 'dead', 15)) B.fail('the choke did not put him out'); B.wait(1.5); },
  drag: B => { if (!B.verb('body', 'drag')) B.fail('no drag row at the body'); if (!B.until(() => !!B.g.player.dragging, 4)) B.fail('the body was not picked up'); },
  hide: B => {
    B.go([12.95, 0, 10.0], 40); B.go([12.95, 0, 8.8], 40); B.go([11.8, 0, 8.0], 40); B.wait(0.6); if (!B.verb('body', 'drop')) B.fail('no row to let go of the body');
    B.until(() => !B.g.player.dragging, 4); B.wait(0.5);
  },
  // out by the store's far end, down past the gate, round the end of the middle wall and along it to the back of the man at the tandoor: the RIGHT button
  knockout: B => {
    const S = man(B, 'south');
    B.go([9.2, 0, 8.4], 30); B.go([9.2, 0, 12.0], 40);
    if (!closeIn(B, S, [11.0, 0, 15.7])) B.fail('could not get behind the second man');
    B.click(2);
    if (!B.until(() => S.state === 'dead', 4)) B.fail('the right button did not put the second man down');
    B.wait(1);
  },
  // out of the oven corner round the end of its east wall and straight across to the dark corner south of the gap (the marker): Q, back to the wing wall,
  // facing the gap's mouth
  wall: B => {
    const E = man(B, 'east'), n0 = seen(B);
    B.crouch(true); B.go([20.6, 0, 17.2], 20); B.go([23.45, 0, 19.4], 15, { near: 0.15 });
    // the page's way first: a move key held into the wall takes it (the walk into the corner may already have, and a press of the hold's key would then
    // step him OFF it: that was this step's red on the page's stand). Where walking in is switched off (the frozen stand) the hold's own key, as it was
    if (!B.g.player.wall) B.nudge([23.45, 0, 19.9], 1.5, () => !!B.g.player.wall);
    if (!B.g.player.wall) { B.aim([23.45, 1.2, 19.9]); B.press('KeyQ', 20); }
    if (!B.g.player.wall) B.fail('no wall taken in the corner beside the gap, by walking into it or by its key');
    B.say(`  on the wall at ${B.pos()[0].toFixed(2)}, ${B.pos()[2].toFixed(2)}, lit ${B.g.player.visibility.toFixed(2)}; ${E.callsign} ${E.state}, aware ${E.awareness.toFixed(2)}`);
    if (E.state !== 'patrol' || seen(B) > n0) B.fail(`${E.callsign} noticed the player on his way to the corner (${E.state})`);
  },
  lure: B => { B.press('KeyV', 0); },
  // nothing pressed until he is through the gap, a stride off; a person's beat to see him; then one step in and the LEFT button. Doing as the lines say, on
  // the lesson's own mark, he is never seen: a sighting before the knife fails the run
  knife: B => {
    const E = man(B, 'east'), n0 = seen(B);
    const came = B.until(() => (E.char.pos[0] < 24.3 && flat(B.pos(), E.char.pos) < 1.9) || E.state === 'alert', 25);
    B.say(`  ${E.callsign} ${came ? 'came' : 'did not come'}: ${flat(B.pos(), E.char.pos).toFixed(2)} m off, ${E.state}, at ${E.char.pos[0].toFixed(1)}, ${E.char.pos[2].toFixed(1)}; lit ${B.g.player.visibility.toFixed(2)}`);
    if (E.state === 'alert') B.fail(`${E.callsign} saw the player beside the gap`);
    if (!came) B.fail(`${E.callsign} did not come through the gap`);
    B.wait(REACT);
    B.nudge([E.char.pos[0], 0, E.char.pos[2]], 3, () => flat(B.pos(), E.char.pos) < 0.88);
    B.click(CLOSE.on && CLOSE.noKnife ? 2 : 1);   // (close.ts CLOSE.noKnife: no knife — the line says the right click's knockout, and that is the blow)
    if (!B.until(() => E.state === 'dead', 4)) B.fail(`the click did not put the last man down (${flat(B.pos(), E.char.pos).toFixed(2)} m off, ${E.state})`);
    if (seen(B) > n0) B.fail(`${E.callsign} saw the player before the knife landed (aware ${E.awareness.toFixed(2)})`);
    B.say(`  the knife landed unseen (his awareness ${E.awareness.toFixed(2)})`);
    B.wait(1);
  },
  // through the gap, up the east side and round the store to its door on the west: locked, and the cook's key turns it
  unlock: B => {
    B.crouch(false);
    if (B.g.player.wall) B.press('KeyQ', 20);
    B.go([23.2, 0, 18.4], 20); B.go([25.6, 0, 18.4], 20); B.go([25.6, 0, 13.4], 40); B.go([22.0, 0, 13.2], 30); B.go([22.0, 0, 9.6], 30); B.go([22.45, 0, 9.6], 10, { near: 0.15 });
    if (!B.verb('door', 'unlock')) B.fail('no unlock row at the store\'s door with his key in the pocket');
    if (!B.until(() => !B.door('hut').isClosed(), 5)) B.fail('the store\'s door did not open to the key');
  },
  take: B => {
    B.go([24.6, 0, 9.6], 30, { doorVerb: 'ease' });
    B.go([26.75, 0, 9.6], 15); if (!B.verb('objective', 'drive', [27.0, 1.0, 9.6])) B.fail('no row to take the ration book'); B.until(() => B.g.mission.stage === 'exfil', 20);
  },
};
/** out by the east gate */
export function finish(B: Bot) { B.go([22.0, 0, 9.6], 20); B.go([22.0, 0, 13.3], 20); B.go([30.6, 0, 14.0], 40); B.go([36.0, 0, 14.0], 30); }
