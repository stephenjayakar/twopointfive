// Furniture, for the sound replays (tools/qa/sound-tapes.cjs; the page bot runs it): the office's loose things pushed about and nothing else going on, so
// the scrape, the roll and the knock of each kind is heard by itself. In the conference room: one chair leaned into at a walk and left to roll out, then
// again; one sent into the wall at a run; a row of four walked through so they knock each other along, and the other row taken at a run. Then the lobby's
// bin at a walk and at a run, and the two cartons by the cubicles pushed into each other. Nobody on the floor is awake to hear it
// (the sandbox's no-AI switch, which the run tape carries; the night staff still walk their beats, so a door of theirs creaks now and then) and the storm is the level's own. Input only.
import type { Bot } from '../lesson-run';

export const query = '?solo&nocivilians', title = 'Chairs, bins and boxes';
export const mode = { god: true, noAi: true };

/** the loose thing of a kind nearest a floor point */
const thing = (B: Bot, kind: string, x: number, z: number): any =>
  B.g.props.props.filter((p: any) => p.def.kind === kind).sort((a: any, b: any) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0];

/** stand a pace short of a thing on the side the push comes from, go through it along (dx, dz) for `secs`, then stand `rest` while it settles */
function shove(B: Bot, p: any, dx: number, dz: number, secs: number, rest: number, o: { sprint?: boolean; crouch?: boolean; back?: number } = {}) {
  const x0 = p.x, z0 = p.z, back = o.back ?? 0.95;
  B.go([p.x - dx * back, 0, p.z - dz * back], 14, { near: 0.2 }); B.wait(0.3);
  if (o.crouch) B.crouch(true);
  const to = [p.x + dx * 3, 0, p.z + dz * 3];
  if (o.sprint) B.go(to, secs, { sprint: true, near: 0.3 }); else B.nudge(to, secs);
  if (o.crouch) B.crouch(false);
  B.wait(rest);
  B.say(`  ${p.def.kind} at (${x0.toFixed(1)}, ${z0.toFixed(1)}) went ${Math.hypot(p.x - x0, p.z - z0).toFixed(2)} m`);
  if (Math.hypot(p.x - x0, p.z - z0) < 0.05) B.fail(`the ${p.def.kind} at (${x0.toFixed(1)}, ${z0.toFixed(1)}) was not moved`);
}

export function free(B: Bot) {
  B.say(`  from (${B.pos()[0].toFixed(1)}, ${B.pos()[2].toFixed(1)})`); B.wait(1);
  // the conference room, in by its open door
  B.go([9.75, 0, 10.8], 15); B.go([11.9, 0, 8.9], 6);
  const end = thing(B, 'chair', 11.8, 7.0);
  shove(B, end, 0, -1, 0.75, 2.4); shove(B, end, 0, -1, 0.75, 2.4);                 // the chair at the table's end: a lean, and it rolls out; again
  shove(B, thing(B, 'chair', 6.2, 7.0), 0, 1, 0.9, 2.0, { sprint: true });          // the other end's, at a run, into the wall
  B.go([12.2, 0, 8.3], 8);
  B.nudge([6.0, 0, 8.3], 4.2); B.wait(2.0); B.say('  the near row walked through');                                        // the near row walked through: four chairs knocking each other along
  B.go([5.3, 0, 5.7], 8);
  B.go([12.4, 0, 5.7], 3.2, { sprint: true }); B.wait(2.2); B.say('  the far row at a run');         // the far row at a run
  // the lobby: the bin by the desk at a walk, then at a run
  B.go([9.75, 0, 10.8], 12);
  const bin = thing(B, 'bin', 9.6, 13.9);
  shove(B, bin, 1, 0, 0.8, 1.8); shove(B, bin, -1, 0, 0.9, 1.8, { sprint: true });
  // the cubicles' corner: one carton pushed into the other, down the wall
  shove(B, thing(B, 'cardboard', 12.5, 13.5), 0, 1, 1.6, 1.8);
  B.wait(1);
}
