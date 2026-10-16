// The scripted player for Training 1 (levels/train-move.json; tools/qa/lesson-run.ts runs it): what each step asks, through the input only.
import type { Bot } from '../lesson-run';
import { canSee } from '../../../src/game/guards';

export const query = '?quiet';
// the moon on his meter (lesson-run's --moon): the CPU's light estimate leaves it out, and the page reads 57 % in open moonlight. The dark lane and the hide
// behind the hut must be dark WITH it
export const mode = { moon: true };

const guard = (B: Bot) => B.g.guards[0];
export const steps: Record<string, (B: Bot) => void> = {
  walk: B => { B.go([7.2, 0, 14.0], 10); },
  gate: B => { if (!B.openDoor('gate_w')) B.fail('the gate did not open'); },
  // through the gate and a sprint to the lamp: loud, and lit
  sprint: B => { B.go([11.4, 0, 14.6], 8, { sprint: true }); },
  crouch: B => { B.crouch(true); },
  pace: B => { B.wheel(1); },
  // out of the pool and round the container's west end into the lane behind it (the pace back up, as the line says: a long creep proves nothing more)
  dark: B => { B.wheel(-1); B.go([12.2, 0, 20.9], 30); B.go([17.8, 0, 21.1], 30); },
  wall: B => { B.go([18.3, 0, 20.75], 10); B.aim([18.3, 1.2, 19.0]); B.press('KeyQ', 20); },
  // sidle east to the container's end and keep pushing: the lean comes in at an open end
  peek: B => { B.nudge([19.6, 0, 20.6], 6, () => (B.g.player.wall?.peek ?? 0) > 0.5); },
  nv: B => { B.press('KeyN'); },
  // off the wall, north behind the dividing wall; wait at its end until he is over at the gate, then across to the hut's west door
  reach: B => {
    if (B.g.player.wall) B.press('KeyQ', 20);
    B.go([21.5, 0, 16.2], 40);
    B.until(() => guard(B).char.pos[0] > 28.5, 40);
    B.go([22.0, 0, 9.6], 30); B.go([24.6, 0, 9.6], 30, { doorVerb: 'ease' });
  },
  take: B => { B.go([26.75, 0, 9.6], 15); if (!B.verb('objective', 'drive', [27.0, 1.0, 9.6])) B.fail('no row to take the papers'); B.until(() => B.g.mission.stage === 'exfil', 20); },
  // out by the back door a stride from the trunk, and south along the hut's east wall to the mark
  wait: B => { B.go([27.6, 0, 8.5], 15); if (!B.openDoor('hut_back')) B.fail('the back door did not open'); B.go([28.7, 0, 8.5], 15); B.go([28.7, 0, 10.0], 15); },
  // he comes past the truck's tail and in by the west door to look at the trunk: once he is inside the hut (or, missing that, once he has looked at the gate and
  // walked off west), down the east wall and across the light at a walk. The hide is only a hide if he never has a line to it: a frame of one fails the run
  go: B => {
    const g = B.g, gd = guard(B); let seen = 0;
    const watch = (f: () => boolean, secs: number) => B.until(() => { if (canSee(g, gd).visible) seen++; return f(); }, secs);
    const inHut = () => { const p = gd.char.pos; return p[0] > 23.2 && p[0] < 27.8 && p[2] > 7.4 && p[2] < 11.8; };
    if (!watch(inHut, 30)) { watch(() => gd.char.pos[2] < 16.6 && gd.char.pos[0] > 30, 40); watch(() => gd.char.pos[0] < 27.4, 40); }
    if (seen) B.fail(`the man who came to look had a line to the hide behind the hut on ${seen} frames`);
    B.go([30.3, 0, 12.4], 15); B.go([31.2, 0, 14.0], 15);
    if (!B.openDoor('gate_e')) B.fail('the east gate did not open');
  },
};
/** out by the east gate */
export function finish(B: Bot) { B.go([34.0, 0, 14.0], 20); }
