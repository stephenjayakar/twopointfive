// The scripted commander for Training 6 (levels/train-pairs.json; tools/qa/lesson-run.ts runs it): what each step asks, through the input only — two walks
// to the marks the level shows, the cursor on a door or on bare ground, and one-frame presses of T / X / a digit / B / F. He never fires. Game state is READ
// to time a press (the men on their marks, a room clear), never the lesson's. The order is the level's: the grain store with all four, then a pair on each
// door of the white house and the one word.
import type { Bot } from '../lesson-run';

export const query = '?roomclear=1&squad4';

/** the level's two marks: short of the grain store (step `up`), and off the white house's corner behind the barrier (step `post`) */
const UP = [23.0, 0, 16.0], POST = [14.2, 0, 16.5];

interface Man { char: { pos: number[] } }
interface Target { kind: string; door?: unknown; man?: unknown }
interface Orders { men(who: string): Man[]; of(m: Man): { arrived?: boolean } | undefined; targetUnder(I: unknown, cam: unknown, canvas: unknown): Target; menu: unknown }
interface Room { def: { id: string; name: string }; cleared: boolean }
const O = (B: Bot): Orders => B.g.orders, rooms = (B: Bot): Room[] => B.g.roomClear.rooms;
const cleared = (B: Bot, id: string) => !!rooms(B).find(r => r.def.id === id)?.cleared;
const under = (B: Bot) => O(B).targetUnder(B.I, B.cam, B.W.canvas);

/** the cursor on bare ground near him, as the lines say: a spot the cursor's own pick calls floor — no teammate, no door (T on a teammate addresses that one
 *  man; a menu opened on one is his alone) */
function onGround(B: Bot) {
  const p = B.pos();
  for (const r of [2, 3, 1.2, 4]) for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4; B.aim([p[0] + r * Math.cos(a), 0.05, p[2] + r * Math.sin(a)]);
    const t = under(B); if (t.kind === 'floor' && !t.man) return;
  }
  B.fail('the cursor finds no bare ground within 4 m of the commander');
}
/** the cursor on the part of a doorway the cursor's own pick calls that door (as a player points at what he can see of it) */
function onDoor(B: Bot, name: string) {
  const d = B.door(name), c = d.frameCentre;
  for (const y of [1.0, 2.0, 0.1, 1.6]) { B.aim([c[0], y, c[2]]); const t = under(B); if (t.kind === 'door' && t.door === d) return; }
  B.fail(`the cursor finds no way onto the door '${name}' from ${B.pos().map(v => v.toFixed(1)).join(', ')}`);
}
const pressT = (B: Bot) => { onGround(B); B.press('KeyT', 4); };
const set = (B: Bot, who: string) => O(B).men(who).every(m => O(B).of(m)?.arrived);
const near = (B: Bot, r: number) => O(B).men('all').every(m => Math.hypot(m.char.pos[0] - B.pos()[0], m.char.pos[2] - B.pos()[2]) < r);
const fallIn = (B: Bot) => { onGround(B); B.press('KeyX', 4); B.press('Digit3', 4); };

export const steps: Record<string, (B: Bot) => void> = {
  // the store first, all four on its one door: up to the mark, B on the door, F once they are on it
  up: B => { B.go(UP, 30); },
  'stack-all': B => { onDoor(B, 'store_n'); B.press('KeyB', 4); },
  'word-all': B => { B.until(() => set(B, 'all'), 40); B.wait(0.5); B.press('KeyF', 4); },
  post: B => { B.go(POST, 30); },
  'fall-in': B => { B.until(() => cleared(B, 'store'), 90); B.wait(1); fallIn(B); },
  // then a pair a door, from the mark
  red: B => { pressT(B); },
  'stack-red': B => { onDoor(B, 'hut_w'); B.press('KeyX', 4); if (!O(B).menu) B.fail('X put no menu up on the marked door'); B.press('Digit1', 4); },
  blue: B => { pressT(B); },
  'stack-blue': B => { onDoor(B, 'hut_s'); B.press('KeyB', 4); },
  gold: B => { pressT(B); },
  // the word once both pairs stand on their marks
  word: B => { B.until(() => set(B, 'red') && set(B, 'blue'), 40); B.wait(0.5); B.press('KeyF', 4); },
};
/** a room clear's own end: every defender down ('structure taken') */
export const ended = (g: { roomClear: { end: string } }) => g.roomClear.end === 'taken';
/** what is left: wait the entry out; a room still held after it is taken again the plain way (fall in, B on its door, the word) */
export function finish(B: Bot) {
  for (let k = 0; k < 4 && !ended(B.g); k++) {
    if (B.until(() => ended(B.g), 45)) return;
    const R = rooms(B).find(r => !r.cleared); if (!R || !O(B).men('all').length) return;
    B.say(`  ${R.def.name} still held: again`);
    fallIn(B); B.go(R.def.id === 'hut' ? POST : UP, 40); B.until(() => near(B, 6), 15);
    onDoor(B, R.def.id === 'hut' ? 'hut_s' : 'store_n'); B.press('KeyB', 4);
    B.until(() => set(B, 'all'), 30); B.wait(0.5); B.press('KeyF', 4);
  }
}
