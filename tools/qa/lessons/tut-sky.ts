// The scripted player for the first tutorial mission (levels/tut-sky.json; tools/qa/lesson-run.ts runs it, with the frame on: TPS_RAILS=1 on the frozen
// stand, or the shipped stand). Nobody on the floor is his: he has the view (the host's Ctrl + mouse and Ctrl + wheel, done here as the host does them,
// and only when the frame has unlocked them), the walk keys that shift it, the squad's command key on a point under the cursor, and the word.
import type { Bot } from '../lesson-run';

export const query = '?roomclear=1&squad4';
export const ended = (g: any) => g.lesson.finished;
/** the view tests need the frame's sky seat: on a stand without it this lesson cannot be played */
export const needs = 'rails';
/** the roadblock can be down before the squad is all in the yard: then its step is done as it comes up */
export const idleOk = ['gate'];

const YARD = [17.6, 0.02, 20.4], TEA_DOOR = [17.0, 1.0, 11.2], KITCHEN_DOOR = [25.0, 1.0, 11.2];
const squad = (B: Bot) => B.g.guards.filter((x: any) => x.unit && x.team === 'operative' && x.state !== 'dead');
const taken = (B: Bot, id: string) => { const r = B.g.roomClear.rooms.find((x: any) => x.def.id === id); if (r?.cleared) return true; const b = r.def.bounds; return squad(B).filter((m: any) => m.char.pos[0] > b.x0 && m.char.pos[0] < b.x1 && m.char.pos[2] > b.z0 && m.char.pos[2] < b.z1).length >= 3; };
const near = (B: Bot, p: number[], r: number) => squad(B).every((m: any) => Math.hypot(m.char.pos[0] - p[0], m.char.pos[2] - p[2]) < r);
/** the command key on a point */
function command(B: Bot, p: number[]) { B.aim(p); B.step(2); B.aim(p); B.press('KeyB', 2); }
/** stack on a door, then the word once they stand at it; again if the room is not theirs after a while */
function breach(B: Bot, door: number[], room: string) {
  for (let k = 0; k < 4 && (k === 0 || !taken(B, room)); k++) {
    command(B, door);
    B.until(() => near(B, door, 3.2), 25); B.wait(1.5);
    B.press('KeyF', 2);
    B.until(() => taken(B, room), 30); B.wait(2);
  }
}

export const steps: Record<string, (B: Bot) => void> = {
  turn: B => { for (let i = 0; i < 40; i++) { if (!B.g.rails.locks('camera')) B.cam.rotate(0.025); B.step(); } },
  zoom: B => { for (let i = 0; i < 20; i++) { if (!B.g.rails.locks('zoom')) B.cam.zoom(60); B.step(); } B.wait(1); },
  pan: B => { B.nudge([40, 0, 28], 2.5); },
  move: B => { command(B, YARD); if (!B.until(() => squad(B).every((m: any) => m.char.pos[2] < 21.9 && m.char.pos[0] > 12.3), 45)) { command(B, YARD); B.until(() => squad(B).every((m: any) => m.char.pos[2] < 21.9), 30); } B.wait(1); },
  gate: B => { B.until(() => !B.g.guards.some((x: any) => /^Tango [678]$/.test(x.callsign) && x.state !== 'dead'), 70); B.wait(0.3);
    const left = B.g.guards.filter((x: any) => /^Tango [678]$/.test(x.callsign) && x.state !== 'dead'); if (left.length) B.say('  still up: ' + left.map((x: any) => `${x.callsign}[${x.state}${x.script ? '/script' : ''}${x.hold ? '/hold' : ''}${x.pinned ? '/pinned' : ''}] (${x.char.pos[0].toFixed(1)},${x.char.pos[2].toFixed(1)}) goal ${JSON.stringify(x.script?.goal ?? null)}`).join(' · ') + ' | ' + B.g.director.rowsOf().filter((r: any) => r.beat === 'push').slice(-6).map((r: any) => `${r.t.toFixed(0)} ${r.kind} ${r.what}`).join(' ; ')); },
  stack: B => { for (let k = 0; k < 3; k++) { command(B, TEA_DOOR); if (B.until(() => near(B, TEA_DOOR, 3.2), 20)) break;
      B.say('  not at the door: ' + B.g.guards.filter((x: any) => x.unit && x.team === 'operative').map((m: any) => `${m.callsign}[${m.state}] (${m.char.pos[0].toFixed(1)},${m.char.pos[2].toFixed(1)}) ${B.g.orders.of(m)?.order ?? '-'} ${B.g.orders.of(m)?.arrived ? 'arrived' : ''} ${B.g.rails.isSpared(m) ? 'SPARED' : ''}`).join(' · ')); }
    B.until(() => B.g.lesson.step?.id !== 'stack', 30); B.wait(0.5); },   // (set = every man on his mark: the last of four can be a while squaring up)
  go: B => { B.press('KeyF', 2); if (!B.until(() => taken(B, 'tea'), 30)) breach(B, TEA_DOOR, 'tea'); B.wait(2); },
  kitchen: B => { breach(B, KITCHEN_DOOR, 'kitchen'); },
};
