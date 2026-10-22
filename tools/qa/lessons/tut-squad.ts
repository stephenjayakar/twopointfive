// The scripted player for the tutorial's squad mission (levels/tut-squad.json; tools/qa/lesson-run.ts runs it): what each step asks, through the input only —
// walks to the marks the level shows, the cursor on a door or on the ground, one-frame presses of the squad's keys, his own trigger and his own throw. Game
// state is READ to time a press (the men on their marks, a room clear), never the lesson's.
import type { Bot } from '../lesson-run';

export const query = '?roomclear=1&squad4';
/** the nest's gun and the hall's two can drop a man who walks the street as a script does: the run is about the steps, so rounds do not drop him */
export const mode = { god: true };
/** its steps are a tutorial mission's (game/rails.ts): TPS_RAILS=1 on the frozen stand, or the shipped stand */
export const needs = 'rails';

interface Man { char: { pos: number[] }; state: string; callsign: string }
interface Target { kind: string; door?: unknown; man?: unknown }
interface Orders { men(who: string): Man[]; of(m: Man): { arrived?: boolean; order?: string } | undefined; targetUnder(I: unknown, cam: unknown, canvas: unknown): Target; menu: unknown; log: { order: string; target: string }[] }
interface Room { def: { id: string; name: string }; cleared: boolean }
const O = (B: Bot): Orders => B.g.orders, rooms = (B: Bot): Room[] => B.g.roomClear.rooms;
const cleared = (B: Bot, id: string) => !!rooms(B).find(r => r.def.id === id)?.cleared;
const under = (B: Bot) => O(B).targetUnder(B.I, B.cam, B.W.canvas);
const last = (B: Bot) => { const l = O(B).log; return l.length ? l[l.length - 1] : null; };

/** the cursor on bare ground near a point: a spot the cursor's own pick calls floor — no teammate, no door */
function onGround(B: Bot, at: number[] = B.pos()) {
  for (const r of [0, 1.2, 2, 3]) for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4; B.aim([at[0] + r * Math.cos(a), 0.05, at[2] + r * Math.sin(a)]);
    const t = under(B); if (t.kind === 'floor' && !t.man) return;
    if (r === 0) break;
  }
  B.fail(`the cursor finds no bare ground near (${at[0].toFixed(1)}, ${at[2].toFixed(1)})`);
}
/** the cursor on the part of a doorway the cursor's own pick calls that door (as a player points at what he can see of it) */
function onDoor(B: Bot, name: string) {
  const d = B.door(name), c = d.frameCentre;
  for (const y of [1.0, 2.0, 0.1, 1.6]) { B.aim([c[0], y, c[2]]); const t = under(B); if (t.kind === 'door' && t.door === d) return; }
  B.fail(`the cursor finds no way onto the door '${name}' from ${B.pos().map(v => v.toFixed(1)).join(', ')}`);
}
const set = (B: Bot, who = 'all') => O(B).men(who).length > 0 && O(B).men(who).every(m => O(B).of(m)?.arrived);
/** the squad's key on a door: they stack up */
function stack(B: Bot, door: string) {
  onDoor(B, door); B.press('KeyB', 4);
  const l = last(B); if (l?.order !== 'stack' || l.target !== `door:${door}`) B.fail(`B on '${door}' gave ${l ? `${l.order} on ${l.target}` : 'nothing'}`);
}
/** …and on it again once they stand on it: they go in. Where the squad does not pick its own entry (the frozen stand) the second press stacks again, and
 *  the word (F) is what sends a plain stack in */
function goIn(B: Bot, door: string, room: string) {
  if (!B.until(() => set(B) || cleared(B, room), 40)) B.fail(`the squad never stood on '${door}'`);
  if (cleared(B, room)) return;
  B.wait(0.4); const n = O(B).log.length;
  onDoor(B, door); B.press('KeyB', 4);
  const l = last(B);
  if (O(B).log.length === n || l?.order === 'stack') { B.say('  B stacked again (the squad does not pick its own entry here): F'); B.press('KeyF', 4); }
  else B.say(`  B: ${l?.order} on ${l?.target}`);
  if (!B.until(() => cleared(B, room), 60)) B.fail(`${room} was not cleared`);
}

const raised = (B: Bot, name: string): boolean => !!B.g.director.signalled(name);
const man = (B: Bot, callsign: string) => B.g.guards.find((x: { callsign: string }) => x.callsign === callsign) as { state: string; script: unknown } | undefined;

/** the orders menu (X) on a door or on the ground, then its digits */
function menu(B: Bot, on: { door?: string; ground?: number[] }, ...digits: number[]) {
  if (on.door) onDoor(B, on.door); else onGround(B, on.ground);
  B.step(2); B.press('KeyX', 2);
  if (!O(B).menu) B.fail(`X opened no menu ${on.door ? `on the door '${on.door}'` : 'on the ground'}`);
  for (const d of digits) B.press(`Digit${d}`, 2);
}
const gave = (B: Bot, order: string) => last(B)?.order === order;
/** the rifle, at a point, until a thing is true (a burst a press, as a hand does it) */
function shootAt(B: Bot, at: number[], stop: () => boolean, max = 12) {
  for (let k = 0; k < max && !stop(); k++) { reload(B); B.click(1, at); B.wait(0.18); }
}
/** an empty rifle is reloaded (R) before the next press */
function reload(B: Bot) { const r = B.g.player.rifle; if (r && r.mag === 0 && !r.reloading) { B.press('KeyR', 4); B.until(() => !r.reloading && r.mag > 0, 5); } }
/** the rifle at whoever of a room's men still stands, a press at a time, until the room is clear or the seconds are up (he aims at the man: where he is
 *  is read off the room's own list, as eyes would) */
function shootMen(B: Bot, room: string, secs: number) {
  const R = rooms(B).find(r => r.def.id === room) as unknown as { defenders: { state: string; char: { pos: number[] } }[] } | undefined, t0 = B.t();
  while (!cleared(B, room) && B.t() - t0 < secs) { const m = R?.defenders.find(x => x.state !== 'dead'); if (!m) { B.wait(0.3); continue; } reload(B); B.click(1, [m.char.pos[0], 1.25, m.char.pos[2]]); B.wait(0.2); }
}
const STORE_IN = [10.6, 0, 18.8], SHOP_STREET = [17.0, 0, 13.4], ALLEY = [23.6, 0, 8.6], END = [22.5, 0, 17.5], BLOCKS = [26.6, 0, 16.1], NEST = [32.0, 1.0, 13.8];
const HALL_SIDE = [34.3, 0, 19.75], HALL_LEAF = [32.4, 1.0, 19.75], WINDOW = [30.9, 0, 16.2], BAGS = [30.2, 0, 13.8], MOUTH = [25.0, 0, 11.6];

export const steps: Record<string, (B: Bot) => void> = {
  // the two easy rooms: the squad's key on a door, and again
  'stack-hut': B => { B.go([8.6, 0, 13.4], 20); stack(B, 'guardhut'); B.until(() => set(B), 30); },
  'go-hut': B => { goIn(B, 'guardhut', 'guardhut'); },
  'stack-store': B => { B.wait(1); stack(B, 'store'); B.until(() => set(B), 40); },
  'go-store': B => { goIn(B, 'store', 'store'); B.go(STORE_IN, 20); },
  // the workshop: the stack on the street door, the player round to the side door and through it
  'stack-shop': B => { B.go(SHOP_STREET, 30); stack(B, 'workshop'); B.until(() => set(B) || cleared(B, 'workshop'), 40); },
  // (the staged moment itself is held to have happened: his rounds through the leaf, and the man in the script's hand — still on that door — as the player leaves it)
  side: B => {
    if (!cleared(B, 'workshop')) {
      if (!B.until(() => raised(B, 'done:shop') || cleared(B, 'workshop'), 12)) B.fail("the workshop's man never fired through the door (no 'done:shop')");
      const m = man(B, 'Tango 4'); if (m && m.state !== 'dead' && !m.script) B.fail("the workshop's man is not in the script's hand after his bursts: he is not holding on the door");
    }
    B.go(ALLEY, 40, { noDoors: true });
  },
  shop: B => {
    // (through the doorway, as a hand does it: where a leaf swings shut behind a push, a man who only opened it is looking at a door again)
    if (!cleared(B, 'workshop')) B.go([21.0, 0, 8.3], 20, { stop: () => cleared(B, 'workshop') });
    shootMen(B, 'workshop', 20);
    if (!B.until(() => cleared(B, 'workshop'), 20)) { const m = B.g.guards.find((x: any) => x.callsign === 'Tango 4'), d = B.door('workshop_side'), sh = B.g.events.filter((e: any) => e.kind === 'shot' && e.who === 1).slice(-1)[0];
      B.fail(`the workshop was not cleared: Tango 4 ${m?.state} at ${m?.char.pos.map((v: number) => v.toFixed(1))}, side door angle ${d.angle.toFixed(2)}, player at ${B.pos().map(v => v.toFixed(1))}, mag ${B.g.player.rifle.mag}, slot ${B.g.player.slot} up ${B.g.player.rifleUp}, last round ${sh ? JSON.stringify([sh.from, sh.to].map((v: any) => v?.map((x: number) => +x.toFixed(1)))) : 'none'}`); }
  },
  // the nest: the squad called in, the wall's end, rounds at the gun, the blocks, a grenade over the bags
  wall: B => { menu(B, { ground: B.pos() }, 3); if (!gave(B, 'fallIn')) B.fail(`X, 3 gave ${last(B)?.order}`); B.go(END, 60); },
  gun: B => { if (!B.until(() => raised(B, 'done:gun') || cleared(B, 'nest'), 8)) B.fail("the gun's first burst never came (no 'done:gun')"); B.go([24.3, 0, 16.6], 10); shootAt(B, NEST, () => cleared(B, 'nest'), 6); },
  blocks: B => { B.go(BLOCKS, 20, { sprint: true }); },
  frag: B => { if (B.g.player.frags < 1) B.fail('no frag to throw'); B.press('Digit5', 10); B.click(1, NEST); B.wait(3.5); B.press('Digit2', 10); },
  // (a man left behind the bags cannot be hit from the blocks: round the nest's open side, as a player would walk)
  nest: B => { shootMen(B, 'nest', 8); if (!cleared(B, 'nest')) { B.go([33.6, 0, 16.2], 30, { stop: () => cleared(B, 'nest') }); shootMen(B, 'nest', 25); } if (!B.until(() => cleared(B, 'nest'), 30)) B.fail('the nest was not taken'); },
  // the hall: its men shot through a street window, its leaf shot down from one side, and in through the doorway
  window: B => { B.wait(1.5);
    if (!B.go(WINDOW, 60, { stop: () => cleared(B, 'hall') })) B.say(`  did not reach the window: at ${B.pos().map(v => v.toFixed(1))}`); shootMen(B, 'hall', 40); if (!B.until(() => cleared(B, 'hall'), 60)) B.fail('the hall was not cleared'); },
  lock: B => {
    B.go(HALL_SIDE, 60, { noDoors: true }); const d = B.door('hall'), r = B.g.player.rifle; let n = 0, m = r.mag;
    const tries = B.g.tune.chaos > 0 ? 40 : 12;   // (with the destruction knob at nothing no round opens a leaf — 40 were tried —: a dozen here, and the rifle keeps rounds for the picket)
    for (let k = 0; k < tries && d.isClosed(); k++) { reload(B); m = r.mag; B.click(1, HALL_LEAF); B.wait(0.18); n += m - r.mag; }
    B.say(`  the hall door: ${d.isClosed() ? 'still shut' : 'open'} after ${n} rifle rounds (destruction ${B.g.tune.chaos})`);
    // (with the destruction knob at nothing no round opens a leaf: the boot is the other way through a lock)
    if (d.isClosed() && !d.lockBroken) { B.openDoor('hall', 'push'); B.wait(0.6); for (let k = 0; k < 4 && d.isClosed() && !d.lockBroken; k++) { B.openDoor('hall', 'kick'); B.wait(1.5); } }
    if (d.isClosed() && !d.lockBroken) B.fail(`the hall door would not give to rounds or to a boot (locked ${d.locked})`);
  },
  hall: B => {
    B.go([31.0, 0, 19.75], 30); },
  // the picket: behind the bags, the road gate held, the squad turned to the alley
  // (where the page keeps saves of a squad's run — in memory, the shipped stand — the checkpoint this step wrote as it came up is LOADED before anything is
  //  done: the same step must be up, the script's program running again, the picket in its hand in its camp and the road gate shut)
  bags: B => {
    B.step(3); const slot = B.g.saves.slots().find((x: { label: string }) => x.label === 'the bags');
    if (slot) {
      const i = B.g.lesson.i; B.wait(1.0); const why = B.g.saves.load(B.g, slot.key); B.step(4);
      const p = man(B, 'Tango 9'), gate = B.door('gate_e');
      if (why || B.g.lesson.i !== i || B.g.director.running !== 'tutorial' || !p?.script || !gate.locked) B.fail(`the checkpoint 'the bags' did not come back whole: ${why ?? ''} step ${B.g.lesson.i + 1} (was ${i + 1}), program ${B.g.director.running}, the picket in hand ${!!p?.script}, the road gate locked ${gate.locked}`);
      B.say("  loaded the checkpoint 'the bags': the same step, the script running again, the picket held, the road gate shut");
    } else if (process.env.TPS_PROFILE === 'shipped') B.fail(`no checkpoint 'the bags' was written as its step came up (slots: ${B.g.saves.slots().map((x: { label: string }) => x.label).join(' · ') || 'none'})`);
    B.go(BAGS, 60);
  },
  front: B => { checkpoints(B); B.until(() => !!B.g.director.signalled('done:flank') || cleared(B, 'road'), 30); },
  back: B => { menu(B, { ground: MOUTH }, 2); if (!gave(B, 'cover')) B.fail(`X, 2 gave ${last(B)?.order}`); },
  // (from the bags while they come; a man who holds where the bags cannot see him — round the road gate's jamb, up the alley — is walked up on, as a player would)
  hold: B => {
    shootMen(B, 'road', 12);
    for (let k = 0; k < 8 && !cleared(B, 'road'); k++) {
      const me = B.pos(), m = B.g.guards.filter((x: Man & { team: string }) => x.team === 'hostile' && x.state !== 'dead').sort((a: Man, b: Man) => Math.hypot(a.char.pos[0] - me[0], a.char.pos[2] - me[2]) - Math.hypot(b.char.pos[0] - me[0], b.char.pos[2] - me[2]))[0] as Man | undefined;
      if (!m) break;
      { const r = B.g.player.rifle; reload(B); if (r && r.mag === 0 && !r.reloading) B.press('Digit1', 6); }   // (the rifle dry and nothing to fill it with: the pistol)
      B.go([m.char.pos[0], 0, m.char.pos[2]], 20, { stop: () => m.state === 'dead' || Math.hypot(m.char.pos[0] - B.pos()[0], m.char.pos[2] - B.pos()[2]) < 1.8 }); shootMen(B, 'road', 6);   // (right up on him: a man at the alley's mouth is round a corner from three metres off)
    }
  },
};
/** lines inside a live fight: the squad's rifles can end the room while the line is up, or before it comes up (each such test also passes on the room taken) */
export const fightOk = ['go-store', 'side', 'shop', 'gun', 'blocks', 'frag', 'nest', 'window', 'front', 'back', 'hold'];
/** a room clear's own end: every defender down ('structure taken') */
export const ended = (g: { roomClear: { end: string } }) => g.roomClear.end === 'taken';
export function finish(B: Bot) { if (!B.until(() => ended(B.g), 30)) B.fail(`the mission did not end (${B.g.roomClear.end || 'still running'})`); }
/** the four authored checkpoints, each written as its step came up (the page's stand: a squad's run is kept in memory there, and nowhere on the frozen one) */
function checkpoints(B: Bot) {
  const wrote = ['the street', 'the wall', 'the hall', 'the bags'].filter(n => B.g.saves.log.some((l: { what: string }) => l.what.includes(`: ${n} (in memory)`)));
  if (process.env.TPS_PROFILE === 'shipped' && wrote.length !== 4) B.fail(`authored checkpoints written: ${wrote.join(' · ') || 'none'} of four (${B.g.saves.log.slice(-6).map((l: { what: string }) => l.what).join(' | ')})`);
  B.say(`  authored checkpoints written: ${wrote.join(' · ') || "none (this stand keeps no save of a squad's run)"}`);
}
