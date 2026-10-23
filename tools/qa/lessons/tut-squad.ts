// The scripted player for the tutorial's squad mission (levels/tut-squad.json; tools/qa/lesson-run.ts runs it): what each step asks, through the input only —
// walks to the marks the level shows, the cursor on a door or on the ground, one-frame presses of the squad's keys, his own trigger and his own throw. Game
// state is READ to time a press (the men on their marks, a room clear), never the lesson's.
import type { Bot } from '../lesson-run';
import { CMDRING } from '../../../src/game/cmdring';
import { installSkyMeter } from '../hour-lib.ts';

export const query = '?roomclear=1&squad4';
/** the nest's gun and the hall's two can drop a man who walks the street as a script does: the run is about the steps, so rounds do not drop him.
 *  `moon`: the post is played at night under a clear sky (its row's own), and the street is open to it: the page's meter reads about 55 of 100 on a man
 *  standing in it, the headless estimate of the same man 0. So the player's meter has the moon on every run here, --plain too */
export const mode = { god: true, moon: true };
/** …AND SO HAS EVERYBODY ELSE'S (tools/qa/hour-lib.ts installSkyMeter: the game's own light hooks answered as the page's meter would for direct light).
 *  Headless, the light on a man an AI eye looks at leaves the moon out too, so every fight in the open was measured in the dark: the squad never saw the
 *  nest's gunner come up, the men at the gates were dropped late, and none of what a first play on the page met was in a run (the gunner shot before the
 *  frag, the last two men walking round by the west gate). TUT_SQUAD_SKY=0 = the estimate as every other tool has it */
const SKY = process.env.TUT_SQUAD_SKY !== '0';
function sky(B: Bot) { const g = B.g as { __sky?: { reads: number } }; if (SKY && !g.__sky) g.__sky = installSkyMeter(B.g); }
const skyReads = (B: Bot) => (B.g as { __sky?: { reads: number } }).__sky?.reads ?? 0;
/** THE HALL'S STREET WINDOW IS GLASS, and the frozen stand stands the glass's parts at off (a pane is a wall to a round there: host/standup.ts): the
 *  window's step cannot be done on it. The runner raises the parts for this run alone; the page's stand has them. (GLASSPARTS and not GLASSFX: that
 *  word is read by game/glass.ts as the module loads, which is before any runner can raise it) */
export const raises = { GLASSPARTS: 'on', TPS_TABBACK: '1', TPS_PLANNEAR: '1' };   // (and the back key that closes plan mode and the mode's near view, which the page has and the frozen run's plan words leave out)
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

/** plan mode (game/planmode.ts): its state · the door a man is on a stack up on · how far the mode's view is from the player */
const plan = (B: Bot) => (B.g.orders as unknown as { plan: { up: boolean; look: number[] | null } }).plan;
const stackedOn = (B: Bot, m: Man): string | null => { const A = O(B).of(m) as { order?: string; door?: { def: { name: string } } } | undefined; return A?.order === 'stack' && A.door ? A.door.def.name : null; };
const viewOff = (B: Bot) => { const L = plan(B).look, s = B.pos(); return L ? Math.hypot(L[0] - s[0], L[2] - s[2]) : 0; };
/** the mode up (Shift held over a tap of the command key), if it is not. `walk`: with a walk key held, as a hand that never stopped walking presses it */
function modeUp(B: Bot, walk?: string) {
  if (plan(B).up) return;
  const k = walk ? [walk] : [];
  B.hold(['ShiftLeft', ...k], 2 / 60); B.I.pressed.add('KeyB'); B.hold(['ShiftLeft', 'KeyB', ...k], 2 / 60); B.hold(['ShiftLeft', ...k], 2 / 60); B.step(2);
  if (!plan(B).up) B.fail(`Shift + the command key${walk ? ' with a walk key held' : ''} did not put plan mode up`);
}
/** the mode's right button on a door (the button down as well as its edge: the mode reads both) */
function rclick(B: Bot, door: string) { onDoor(B, door); B.step(3); B.I.clicked |= 4; B.I.buttons |= 4; B.step(); B.I.buttons &= ~4; B.step(3); }
/** TUT_SQUAD_INSIDE=1: the room is taken from INSIDE plan mode (a second right click on the stacked door is the entry), which the walk's step must not
 *  pass on with the mode still up: its line is the key that puts the mode away, and it holds until that key */
const INSIDE = process.env.TUT_SQUAD_INSIDE === '1';

const raised = (B: Bot, name: string): boolean => !!B.g.director.signalled(name);
const man = (B: Bot, callsign: string) => B.g.guards.find((x: { callsign: string }) => x.callsign === callsign) as { state: string; script: unknown; char: { pos: number[] } } | undefined;

/** the orders menu on a door or on the ground, then its digits. Where the squad's key kept down is a ring that stays (game/cmdring.ts: the page's way — the
 *  line's [X] is drawn "Hold" and that key there) it is opened that way; where there is no such ring, by the menu's own key (X) */
function menu(B: Bot, on: { door?: string; ground?: number[] }, ...digits: number[]) {
  if (on.door) onDoor(B, on.door); else onGround(B, on.ground);
  B.step(2);
  const ring = CMDRING.on && CMDRING.stay;   // (a ring that goes with its key gives a wedge as the key comes up: the digits would be late)
  if (ring) { B.I.pressed.add(CMDRING.key); B.hold([CMDRING.key], 1.5, () => !!O(B).menu); B.step(2); } else B.press('KeyX', 2);
  B.say(`  the menu by ${ring ? "the squad's key kept down (the ring)" : 'its own key (X)'}`);
  if (!O(B).menu) B.fail(`${ring ? 'B kept down' : 'X'} opened no menu ${on.door ? `on the door '${on.door}'` : 'on the ground'}`);
  for (const d of digits) B.press(`Digit${d}`, 2);
}
const gave = (B: Bot, order: string) => last(B)?.order === order;
/** the rifle, at a point, until a thing is true (a burst a press, as a hand does it) */
function shootAt(B: Bot, at: number[], stop: () => boolean, max = 12) {
  for (let k = 0; k < max && !stop(); k++) { reload(B); B.click(1, at); B.wait(0.18); }
}
/** an empty rifle is reloaded (R) before the next press */
function reload(B: Bot) { const r = B.g.player.rifle; if (r && r.mag === 0 && !r.reloading) { B.press('KeyR', 4); B.until(() => !r.reloading && r.mag > 0, 5); } }
/** where on a man the cursor goes: his chest, wherever his pose has put it (a man a frag has left hurt and on a knee behind his bags has his head
 *  under a standing man's chest: a cursor a chest high went over him) */
const chest = (ch: { pos: number[]; bones?: { chest?: number[] } }): number[] => ch.bones?.chest ?? [ch.pos[0], 1.25, ch.pos[2]];
/** the rifle at whoever of a room's men still stands, a press at a time, until the room is clear or the seconds are up (he aims at the man: where he is
 *  is read off the room's own list, as eyes would) */
function shootMen(B: Bot, room: string, secs: number) {
  const R = rooms(B).find(r => r.def.id === room) as unknown as { defenders: { state: string; char: { pos: number[]; bones?: { chest?: number[] } } }[] } | undefined, t0 = B.t();
  // (the nearest of them: a hand shoots the man in front of it, not the first on the roster, who may be two walls off)
  const near = () => { const me = B.pos(); return R?.defenders.filter(x => x.state !== 'dead').sort((a, b) => Math.hypot(a.char.pos[0] - me[0], a.char.pos[2] - me[2]) - Math.hypot(b.char.pos[0] - me[0], b.char.pos[2] - me[2]))[0]; };
  while (!cleared(B, room) && B.t() - t0 < secs) { const m = near(); if (!m) { B.wait(0.3); continue; } reload(B); B.click(1, chest(m.char)); B.wait(0.2); }
}
/** how many of the nest's two are down by a round that was not the player's own (character id 1: consts.ts PLAYER_ID) */
const nestTaken = (B: Bot) => (rooms(B).find(r => r.def.id === 'nest') as unknown as { defenders: { state: string; killerId: number }[] } | undefined)?.defenders.filter(x => x.state === 'dead' && x.killerId !== 1).length ?? 0;
/** WHOSE ROUNDS TOOK THE HALL'S TWO, said once a run, and a failure when a teammate took one from north of the nest's back wall. The window's step is
 *  the player's: the wall of bags behind the nest hides the window from the street and from inside the nest, and a teammate can have a line through
 *  it only from the strip in front of the glass (he may: a man who walks past a window with two rifles behind it shoots). TUT_SQUAD_HALL=any: not held */
function hallBy(B: Bot) {
  const G = B.g as unknown as { __hallBy?: boolean; guards: { char: { id: number; pos: number[] }; callsign: string }[] }; if (G.__hallBy || !cleared(B, 'hall')) return; G.__hallBy = true;
  const men = (rooms(B).find(r => r.def.id === 'hall') as unknown as { defenders: { state: string; killerId: number; callsign: string }[] } | undefined)?.defenders.filter(x => x.state === 'dead') ?? [];
  const who = men.map(m => { const k = m.killerId === 1 ? null : G.guards.find(x => x.char.id === m.killerId); return { m: m.callsign, mine: m.killerId === 1, k: k?.callsign ?? '?', z: k?.char.pos[2] ?? NaN, x: k?.char.pos[0] ?? NaN }; });
  B.say(`  the hall's men: ${who.map(w => `${w.m} to ${w.mine ? 'the player' : `${w.k} at (${w.x.toFixed(1)}, ${w.z.toFixed(1)})`}`).join(' · ') || 'nobody down'}`);
  const far = who.filter(w => !w.mine && w.z < STRIP_Z);
  if (far.length && process.env.TUT_SQUAD_HALL !== 'any') B.fail(`${far.map(w => w.m).join(' and ')} of the hall shot by a teammate from north of the nest's back wall (${far.map(w => `${w.k} at z ${w.z.toFixed(1)}`).join(', ')}): the window is seen from there`);
}
/** the north edge of the strip between the nest's back wall and the hall (the bags' south face) */
const STRIP_Z = 15.4;
const STORE_IN = [10.6, 0, 18.8], ALLEY = [23.6, 0, 8.6], END = [22.5, 0, 17.5], BLOCKS = [26.6, 0, 16.1], NEST = [32.0, 1.0, 13.8], NEST_SPOTS: [number[], number][] = [[[33.6, 0, 16.2], 6], [[33.7, 0, 14.1], 20]];
const SHOP_VIEW = [18.3, 0, 12.3], HALL_SIDE = [34.3, 0, 19.75], WINDOW = [31.775, 0, 16.05], BAGS = [30.2, 0, 13.8], MOUTH = [25.0, 0, 11.6];

/** seconds the player stands at the blocks before he throws (TUT_SQUAD_FRAG_WAIT: a hand that reads the card, finds the key and aims; 0 = at once) */
const FRAG_WAIT = Number(process.env.TUT_SQUAD_FRAG_WAIT ?? 0) || 0;

const RAW: Record<string, (B: Bot) => void> = {
  // the two easy rooms: the squad's key on a door, and again
  'stack-hut': B => { B.go([8.6, 0, 13.4], 20); stack(B, 'guardhut'); B.until(() => set(B), 30); },
  'go-hut': B => { goIn(B, 'guardhut', 'guardhut'); },
  'stack-store': B => { B.wait(1); stack(B, 'store'); B.until(() => set(B), 40); },
  'go-store': B => { goIn(B, 'store', 'store'); },
  'in-store': B => { B.go(STORE_IN, 20); },
  // the workshop: its man on his open lane doorway, in the picture and firing out of it; out to the street in front of the workshop to look; the squad
  // sent to the side door from there (the cursor on the step's ring), the walk round after them, and in at his back
  // (the staged moment itself is held to have happened: a round of his out of the doorway, the man in the script's hand, standing in the line the level
  //  keeps the team's feet out of and, where the fog of war runs, drawn)
  out: B => { B.go(SHOP_VIEW, 30); },
  // PLAN MODE, opened and closed (the mission's own lesson of it): the pair from the street, the mode's right button on the side door, the back key, the walk
  mode: B => {
    if (!cleared(B, 'workshop')) {
      if (!B.until(() => raised(B, 'done:shop') || cleared(B, 'workshop'), 14)) B.fail("the workshop's man never fired out of his doorway (no 'done:shop')");
      const m = man(B, 'Tango 4'), F = B.g.fogOfWar;
      if (m && m.state !== 'dead' && !m.script) B.fail("the workshop's man is not in the script's hand after his first round: he is not holding his doorway");
      if (m && m.state !== 'dead' && F.active && !F.drawn(m)) B.fail("the workshop's man is not in the picture under the fog of war while he holds his doorway");
      const V = (B.g.level.volumes ?? []).find((v: any) => v.name === 'shop_line');
      if (!V) B.fail("the level has no 'shop_line' volume: nothing keeps his rounds off the team");
      else if (m && m.state !== 'dead') {
        const px = m.char.pos[0] - V.c[0], pz = m.char.pos[2] - V.c[2], cs = Math.cos(V.yaw ?? 0), sn = Math.sin(V.yaw ?? 0);
        if (Math.abs(cs * px - sn * pz) > V.h[0] + 0.5 || Math.abs(sn * px + cs * pz) > V.h[2]) B.fail(`the workshop's man fires from ${m.char.pos.map((v: number) => v.toFixed(2))}, off the line the level's 'shop_line' volume watches`);
      }
      const d = B.door('workshop'); if (d.isClosed()) B.fail("the workshop's lane door is shut: nobody can see him or his rounds");
      // (a tap of the squad's key first, as a hand that learnt the two rooms before this would: the step teaches the pair, and the tap gives nothing.
      //  Then the pair with a walk key still down: his sprint is locked for the step, so that is the mode too and never a sprinting tap)
      { const n = O(B).log.length; onDoor(B, 'workshop_side'); B.press('KeyB', 4); if (O(B).log.length !== n) B.fail(`a tap of the squad's key on the side door gave ${last(B)?.order} while the step asks for plan mode`); }
      modeUp(B, 'KeyD');
    }
  },
  side: B => {
    if (cleared(B, 'workshop')) return;
    modeUp(B);   // (the mode put away by hand: the line then asks for it again)
    const d = B.door('workshop_side'), c = d.frameCentre as number[], w = B.W.canvas.clientWidth, h = B.W.canvas.clientHeight, [x, y] = B.W.cam.project([c[0], 1, c[2]], w, h);
    if (x < 40 || x > w - 40 || y < 40 || y > h - 40) B.fail(`from the street the side door is not on the picture in plan mode (${x.toFixed(0)}, ${y.toFixed(0)} of ${w} x ${h}): the line asks for a click he cannot make`);
    rclick(B, 'workshop_side');
    if (!O(B).men('all').some(m => stackedOn(B, m) === 'workshop_side')) B.fail(`plan mode's right button on the side door put nobody on it (the last order: ${last(B) ? `${last(B)!.order} on ${last(B)!.target}` : 'none'})`);
    B.say(`  plan mode: the right button on the side door, from (${B.pos()[0].toFixed(1)}, ${B.pos()[2].toFixed(1)}); the view's point ${viewOff(B).toFixed(1)} m from him`);
  },
  round: B => {
    if (INSIDE && plan(B).up && !cleared(B, 'workshop')) {
      if (!B.until(() => set(B) || cleared(B, 'workshop'), 40)) B.fail("the squad never stood on 'workshop_side'");
      rclick(B, 'workshop_side');
      if (!B.until(() => cleared(B, 'workshop'), 60)) B.fail('a second right click on the stacked side door, in plan mode, did not take the workshop');
      const P = B.g.rails.prompt() as { line: string; n: number } | null;
      if (!plan(B).up) B.fail('plan mode went down by itself while the room was taken from inside it');
      if (!P || !/close plan mode/.test(P.line)) B.fail(`the workshop taken from inside plan mode, the mode still up, and the line is '${P?.line}' (step ${P?.n}): nothing tells him to put the mode away`);
      B.say(`  the workshop taken from inside plan mode: the line is still '${P?.line}'`);
    }
    if (plan(B).up) { B.press('Tab', 3); if (plan(B).up) B.fail('the back key did not put plan mode away'); B.say('  the back key put plan mode away'); }
    if (!cleared(B, 'workshop')) B.go(ALLEY, 60, { noDoors: true });
  },
  shop: B => { goIn(B, 'workshop_side', 'workshop'); },
  // the nest: the squad called in, the wall's end, rounds at the gun, the blocks, a grenade over the bags
  follow: B => { menu(B, { ground: B.pos() }, 3); if (!gave(B, 'fallIn')) B.fail(`the menu's 3 gave ${last(B)?.order}`); },
  wall: B => { B.go(END, 60); },
  gun: B => { if (!B.until(() => raised(B, 'done:gun') || cleared(B, 'nest'), 8)) B.fail("the gun's first burst never came (no 'done:gun')"); B.go([24.3, 0, 16.6], 10); shootAt(B, NEST, () => cleared(B, 'nest'), 6); },
  blocks: B => { B.go(BLOCKS, 20, { sprint: true }); },
  frag: B => {
    if (B.g.player.frags < 1) B.fail('no frag to throw'); if (FRAG_WAIT > 0) B.wait(FRAG_WAIT);
    // (the lesson is HIS throw: a nest the squad has already shot a man out of is the lesson gone by, whatever the step's test says)
    { const n = nestTaken(B); if (n) B.fail(`the squad shot ${n} of the nest's two before the frag was thrown (${FRAG_WAIT} s at the blocks)`); }
    B.press('Digit5', 10); B.click(1, NEST); B.wait(3.5); B.press('Digit2', 10);
  },
  // (a man left behind the bags cannot be hit from the blocks: round the nest's open side, as a player would walk)
  // (from where he stands; then from the far end of the strip behind the nest; then from its open side, in between the arms of the bags: the frag can
  //  leave its last man hurt and on a knee, under the bags from everywhere outside them. Nobody's rifle found him there for seventy seconds on one die)
  nest: B => { shootMen(B, 'nest', 8);
    for (const [at, secs] of NEST_SPOTS) { if (cleared(B, 'nest')) break; B.go(at, 30, { stop: () => cleared(B, 'nest') }); shootMen(B, 'nest', secs); }
    if (!B.until(() => cleared(B, 'nest'), 30)) B.fail('the nest was not taken'); },
  // the hall: its men shot through a street window from outside
  window: B => {
    if (SKY) B.say(`  the sky on every meter: ${skyReads(B)} readings so far`); B.wait(1.5);
    if (!B.go(WINDOW, 60, { stop: () => cleared(B, 'hall') })) B.say(`  did not reach the window: at ${B.pos().map(v => v.toFixed(1))}`); shootMen(B, 'hall', 40); if (!B.until(() => cleared(B, 'hall'), 60)) B.fail('the hall was not cleared'); hallBy(B); },
  // the hall's door: round to the passage, square on to the leaf, and the boot (a frame that held it is kicked again)
  door: B => { hallBy(B); B.go(HALL_SIDE, 60, { noDoors: true }); },
  lock: B => {
    const d = B.door('hall'); let n = 0;
    for (; n < 4 && d.isClosed() && !d.lockBroken; n++) { B.openDoor('hall', 'kick'); B.wait(1.5); }
    B.say(`  the hall door: ${d.isClosed() && !d.lockBroken ? 'still shut' : 'in'} after ${n} kick${n === 1 ? '' : 's'}`);
    if (d.isClosed() && !d.lockBroken) B.fail(`the hall door would not give to a boot (locked ${d.locked})`);
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
  // (THE TWO WHO WENT ROUND WAIT FOR THIS ORDER, outside the wall: one of them inside the back gate before it is given is a reader shot in the back)
  back: B => {
    menu(B, { ground: MOUTH }, 2); if (!gave(B, 'cover')) B.fail(`the menu's 2 gave ${last(B)?.order}`);
    for (const x of B.g.guards as (Man & { callsign: string; state: string })[]) if ((x.callsign === 'Tango 10' || x.callsign === 'Tango 11') && x.state !== 'dead' && x.char.pos[2] > 5.6) B.fail(`${x.callsign} was inside the back gate (z ${x.char.pos[2].toFixed(1)}) before the cover order was given`);
  },
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
export const steps: Record<string, (B: Bot) => void> = Object.fromEntries(Object.entries(RAW).map(([id, f]) => [id, (B: Bot) => { sky(B); f(B); }]));
/** lines inside a live fight: the squad's rifles can end the room while the line is up, or before it comes up (each such test also passes on the room taken).
 *  'door' and 'lock' are among them for ONE reason: the hall's last man, his mate shot through the window, can drop his rifle and run by the game's own
 *  rule (runner.ts), and he opens his own locked door on the way out, so the door's lines go by with nobody kicking it (seen on one die of twelve).
 *  'frag' IS NOT ONE OF THEM: the gun is the script's until the frag is thrown, so a nest that falls before that step's throw is the squad taking the
 *  lesson out of the player's hand (the first play on the page), and the run fails on it */
export const fightOk = ['go-store', 'out', 'mode', 'side', 'round', 'shop', 'gun', 'blocks', 'nest', 'window', 'door', 'lock', 'front', 'back', 'hold'];
/** a room clear's own end: every defender down ('structure taken') */
export const ended = (g: { roomClear: { end: string } }) => g.roomClear.end === 'taken';
export function finish(B: Bot) {
  if (!B.until(() => ended(B.g), 30)) B.fail(`the mission did not end (${B.g.roomClear.end || 'still running'})`);
}
/** the four authored checkpoints, each written as its step came up (the page's stand: a squad's run is kept in memory there, and nowhere on the frozen one) */
function checkpoints(B: Bot) {
  const wrote = ['the street', 'the wall', 'the hall', 'the bags'].filter(n => B.g.saves.log.some((l: { what: string }) => l.what.includes(`: ${n} (in memory)`)));
  if (process.env.TPS_PROFILE === 'shipped' && wrote.length !== 4) B.fail(`authored checkpoints written: ${wrote.join(' · ') || 'none'} of four (${B.g.saves.log.slice(-6).map((l: { what: string }) => l.what).join(' | ')})`);
  B.say(`  authored checkpoints written: ${wrote.join(' · ') || "none (this stand keeps no save of a squad's run)"}`);
}
