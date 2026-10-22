// The scripted player for Training 4 (levels/train-kit.json; tools/qa/lesson-run.ts runs it): what each step asks, through the input only.
import type { Bot } from '../lesson-run';
import { FIRE, LAMP, PIT, TARGET, FAR, DOOR } from '../../levels/train-kit';
import { SLOTSETUP } from '../../../src/game/slotsetup';
/** the rule as THIS run has it: the page's own table when the bot is driving a page (its bundle holds a copy of the module that nothing switches) */
const setup = (): boolean => (globalThis as { __knobs?: { registry?: () => Record<string, { on?: boolean }> } }).__knobs?.registry?.().SLOTSETUP?.on ?? SLOTSETUP.on;

export const query = '?quiet';

/** the right mouse button for one frame (Input's bits: 1 left · 2 middle · 4 right) with the cursor on a world point */
const rightClick = (B: Bot, p: number[]) => { B.aim(p); B.step(); B.aim(p); B.I.clicked |= 4; B.step(2); };
/** the left button HELD for `secs` with the cursor kept on a point (a moving man: `at` is asked every frame) */
const trigger = (B: Bot, at: () => number[], secs: number, stop?: () => boolean) => {
  B.aim(at()); B.step(); B.I.clicked |= 1;
  try { for (let i = 0; i < secs * 60; i++) { B.aim(at()); B.I.buttons |= 1; B.step(); if (stop && stop()) break; } } finally { B.I.buttons &= ~1; B.step(); }
};
const chest = (x: any): number[] => x.char.bones?.chest ?? [x.char.pos[0], 1.25, x.char.pos[2]];
const up = (x: any) => x.state !== 'dead';
/** a clear line for a round from his gun to a man's chest */
const line = (B: Bot, x: any) => { const P = B.g.player.char, a = P.bones?.head ?? [P.pos[0], 1.5, P.pos[2]]; return !B.g.col.shotBlocked(a, chest(x)); };

export const steps: Record<string, (B: Bot) => void> = {
  // to the firing point behind the sandbags
  point: B => { B.go(FIRE, 20); },
  draw: B => { B.press('Digit1', 20); },
  // one round into the lamp's head (a second if the first went by)
  fire: B => { B.click(1, LAMP); B.wait(0.3); if (B.g.targets.find((t: any) => t.name === 'lamp_range')?.broken !== true) B.click(1, LAMP); },
  reload: B => { B.press('KeyR'); B.until(() => !B.g.player.pistol.reloading, 5); },
  // the light: L, or with the gun's setup on (slotsetup.ts) the pistol's key again and the light's row
  light: B => { if (setup()) { B.press('Digit1', 2); B.press('Digit3'); } else B.press('KeyL'); },
  dark: B => { if (setup()) { B.press('Digit1', 2); B.press('Digit3'); } else B.press('KeyL'); },
  holster: B => { B.press('KeyE'); },
  // the can in the fist, the cursor on the pit's floor over its wall, a click
  smoke: B => { B.press('Digit3', 10); B.click(1, PIT); B.wait(1.2); },
  // the two loud cans: into the fist, and kept
  stun: B => { B.press('Digit4', 10); },
  frag: B => { B.press('Digit5', 10); },
  rifle: B => { B.press('Digit2', 5); B.until(() => B.g.player.equipT <= 0, 3); },
  // the ring launcher is on the right button from the draw
  ring: B => { rightClick(B, TARGET); B.wait(1.0); },
  // 2 again with the rifle up: flips ring → the grenade, kept in the tube
  grenade: B => { B.press('Digit2', 5); if (setup()) B.press('Digit2', 5); },
  auto: B => { B.go(FIRE, 20); if (setup()) { B.press('Digit2', 2); B.press('Digit1', 3); } else B.press('KeyZ', 3); },
  // the loud ones: the grenade over the pit onto the far wall (11 m: armed), then the burst and the fight as one step
  he40: B => { rightClick(B, FAR); B.wait(1); },
  // a burst at the lit door calls them; then the two come by that one door in the dividing wall, one after the other: the cursor on whichever is up with a line
  // to him, the trigger held until he drops
  men: B => {
    const g = B.g, P = g.player;
    B.wait(1); trigger(B, () => DOOR, 0.6);
    const t0 = B.t();
    while (g.guards.some(up) && B.t() - t0 < 60 && !P.down) {
      if (P.rifle.roundsReady === 0 && !P.rifle.reloading) { B.press('KeyR'); continue; }
      const x = g.guards.filter((y: any) => up(y) && line(B, y)).sort((a: any, b: any) => Math.hypot(a.char.pos[0] - B.pos()[0], a.char.pos[2] - B.pos()[2]) - Math.hypot(b.char.pos[0] - B.pos()[0], b.char.pos[2] - B.pos()[2]))[0];
      if (!x) { B.step(); continue; }
      trigger(B, () => chest(x), 1.5, () => !up(x) || !line(B, x));
    }
    if (g.guards.some(up)) B.fail('the men did not both come into his sights and drop');
  },
  // nobody left to hear: back behind the sandbags, each loud can chosen and thrown into the pit, and its fuse waited out
  'stun-throw': B => { B.go(FIRE, 20); if (B.g.player.flashbangs < 1) B.fail('no stun can left to throw'); B.press('Digit4', 10); B.click(1, PIT); B.wait(2.5); },
  'frag-throw': B => { if (B.g.player.frags < 1) B.fail('no frag left to throw'); B.press('Digit5', 10); B.click(1, PIT);
    // where it lies when it goes off, against where he stands: past the frag's reach (8 m), or the line's 'into the pit' from the firing point is not safe
    let at: number[] | null = null;
    for (let i = 0; i < 270; i++) { const it = B.g.items.items.find((x: any) => x.kind === 'frag' && !x.fired); if (it) at = [...it.pos]; B.step(); }
    const d = at ? Math.hypot(at[0] - B.pos()[0], at[2] - B.pos()[2]) : 0;
    if (B.g.player.down || d < 8.2) B.fail(`his own frag went off ${d.toFixed(1)} m from him`);
  },
};
/** the mission's own end: through the door in the dividing wall to the hut, the papers out of the trunk, out by the east gate */
export function finish(B: Bot) {
  B.go([20.6, 0, 10.0], 40); B.go([23.4, 0, 10.0], 40); B.go([28.0, 0, 14.2], 30); B.go([28.0, 0, 17.4], 30); B.go([29.2, 0, 19.0], 30);
  if (!B.verb('objective', 'drive', [29.6, 1.0, 19.0])) B.fail('no row to take the papers');
  B.until(() => B.g.mission.stage === 'exfil', 20);
  B.go([28.0, 0, 17.4], 30); B.go([28.0, 0, 14.2], 30); B.go([31.0, 0, 14.0], 30); B.go([34.6, 0, 14.0], 30);
}
