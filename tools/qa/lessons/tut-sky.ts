// The scripted player for the first tutorial mission (levels/tut-sky.json; tools/qa/lesson-run.ts runs it as the page opens it: a tutorial mission is
// always stood up on the shipped stand). Nobody on the floor is his: he has the view (the host's Ctrl + mouse and Ctrl + wheel, done here as the host does them,
// and only when the frame has unlocked them), the walk keys that shift it, the squad's command key on a point under the cursor, and the word.
import type { Bot } from '../lesson-run';

export const query = '?roomclear=1&squad4';
export const ended = (g: any) => g.lesson.finished;
/** the roadblock can be down before the squad is all in the yard: then its step is done as it comes up */
export const idleOk = ['gate', 'torches'];

const YARD = [11.4, 0.02, 16.4], TEA_DOOR = [9.0, 1.0, 11.7], KITCHEN_DOOR = [13.8, 1.0, 6.25], WALL = [21.95, 1.1, 9.6], BREAKER = [19.3, 1.35, 11.82], BUNK_DOOR = [28.8, 1.0, 16.25], TRUCKS = [6.1, 0.02, 23.6];
const BLOCK = /^Tango (8|9|10)$/;
const squad = (B: Bot) => B.g.guards.filter((x: any) => x.unit && x.team === 'operative' && x.state !== 'dead');
const taken = (B: Bot, id: string) => { const r = B.g.roomClear.rooms.find((x: any) => x.def.id === id); if (r?.cleared) return true; const b = r.def.bounds; return squad(B).filter((m: any) => m.char.pos[0] > b.x0 && m.char.pos[0] < b.x1 && m.char.pos[2] > b.z0 && m.char.pos[2] < b.z1).length >= 3; };
const near = (B: Bot, p: number[], r: number) => squad(B).every((m: any) => Math.hypot(m.char.pos[0] - p[0], m.char.pos[2] - p[2]) < r);
/** every man of the squad stands on his mark of a stack */
const stacked = (B: Bot) => squad(B).every((m: any) => { const o = B.g.orders.of(m); return o?.order === 'stack' && o.arrived; });
/** the command key on a point */
function command(B: Bot, p: number[]) { B.aim(p); B.step(2); B.aim(p); B.press('KeyB', 2); }
/** stack on a door, then the word once they stand at it; again if the room is not theirs after a while */
function breach(B: Bot, door: number[], room: string) {
  for (let k = 0; k < 4 && (k === 0 || !taken(B, room)); k++) {
    command(B, door);
    B.until(() => stacked(B) || near(B, door, 3.2), 25); B.wait(1.5);
    B.press('KeyF', 2);
    B.until(() => taken(B, room), 30); B.wait(2);
  }
}

export const steps: Record<string, (B: Bot) => void> = {
  turn: B => { for (let i = 0; i < 40; i++) { if (!B.g.rails.locks('camera')) B.cam.rotate(0.025); B.step(); } },
  zoom: B => { for (let i = 0; i < 20; i++) { if (!B.g.rails.locks('zoom')) B.cam.zoom(60); B.step(); } B.wait(1); },
  pan: B => { B.nudge([40, 0, 28], 2.5); },
  move: B => { command(B, YARD); if (!B.until(() => squad(B).every((m: any) => m.char.pos[2] < 19.7 && m.char.pos[0] > 4.4), 45)) { command(B, YARD); B.until(() => squad(B).every((m: any) => m.char.pos[2] < 19.7), 30); } B.wait(1); },
  gate: B => { B.until(() => !B.g.guards.some((x: any) => BLOCK.test(x.callsign) && x.state !== 'dead'), 70); B.wait(0.3);
    const left = B.g.guards.filter((x: any) => BLOCK.test(x.callsign) && x.state !== 'dead'); if (left.length) B.say('  still up: ' + left.map((x: any) => `${x.callsign}[${x.state}${x.script ? '/script' : ''}${x.hold ? '/hold' : ''}${x.pinned ? '/pinned' : ''}] (${x.char.pos[0].toFixed(1)},${x.char.pos[2].toFixed(1)}) goal ${JSON.stringify(x.script?.goal ?? null)}`).join(' · ') + ' | ' + B.g.director.rowsOf().filter((r: any) => r.beat === 'push').slice(-6).map((r: any) => `${r.t.toFixed(0)} ${r.kind} ${r.what}`).join(' ; ')); },
  stack: B => { for (let k = 0; k < 3; k++) { command(B, TEA_DOOR); if (B.until(() => stacked(B) || near(B, TEA_DOOR, 3.2), 30)) break;   // (the file along the wall under the windows is not all within three metres of the door)
      B.say('  not at the door: ' + B.g.guards.filter((x: any) => x.unit && x.team === 'operative').map((m: any) => `${m.callsign}[${m.state}] (${m.char.pos[0].toFixed(1)},${m.char.pos[2].toFixed(1)}) ${B.g.orders.of(m)?.order ?? '-'} ${B.g.orders.of(m)?.arrived ? 'arrived' : ''} ${B.g.rails.isSpared(m) ? 'SPARED' : ''}`).join(' · ')); }
    B.until(() => B.g.lesson.step?.id !== 'stack', 30); B.wait(0.5); },   // (set = every man on his mark: the last of four can be a while squaring up)
  go: B => { B.press('KeyF', 2); if (!B.until(() => taken(B, 'tea'), 30)) breach(B, TEA_DOOR, 'tea'); B.wait(2); },
  kitchen: B => { breach(B, KITCHEN_DOOR, 'kitchen'); },
  // the orders' menu on the wall: its fifth row is the wall's page, the third row there the charge. Then the word, once a man has set it
  // (the squad's menu is a ring on the command key held; a charge already on the wall is left to the word, never asked for again — that row would blow it)
  charge: B => { const set = () => (B.g.wallCharge?.set.length ?? 0) > 0, clear = () => set() && !B.g.wallCharge.tooClose(B.g.wallCharge.set[0]).length;
    for (let k = 0; k < 3 && !set() && !taken(B, 'store'); k++) { B.aim(WALL); B.step(2); B.aim(WALL); B.I.pressed.add('KeyB'); B.hold(['KeyB'], 0.45); B.step(2); B.press('Digit5', 3); B.press('Digit3', 3);  B.until(set, 20); }
    B.until(clear, 20); B.wait(0.6); },
  blow: B => { B.wait(1); B.press('KeyF', 2); if (!B.until(() => taken(B, 'store'), 40)) breach(B, [22.2, 1.0, 7.25], 'store'); B.wait(2); },
  breaker: B => { for (let k = 0; k < 3 && !B.g.blackout.active; k++) { command(B, BREAKER); B.until(() => B.g.blackout.active, 60); }
    B.wait(0.5); },
  nv: B => { B.press('KeyN', 3); },
  // nothing to press: the two with torches are the squad's to deal with (the step is done by the script's own word, with them down or after a while)
  torches: B => { B.until(() => B.g.lesson.step?.id !== 'torches', 40); B.wait(0.5); },
  bunk: B => { breach(B, BUNK_DOOR, 'bunk'); },
  out: B => { const back = () => squad(B).every((m: any) => m.char.pos[0] < 11.5 && m.char.pos[2] > 20.6); for (let k = 0; k < 3 && !back(); k++) { command(B, TRUCKS); B.until(back, 60); } B.wait(1.2); },
};
