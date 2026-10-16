// Both guns' handling, for the sound replays (tools/qa/sound-tapes.cjs; the page bot runs it): each magazine change by itself with nothing else going on.
// The pistol: drawn, three rounds, a change with rounds left (magazine out, in, no slide), then run dry so the gun changes it itself (out, in, the slide),
// holstered and drawn. The rifle the same, single shots and then a magazine on AUTO to the last round. The rounds go into the lobby's wall. Nobody on the
// floor is awake (the sandbox's no-AI switch, which the run tape carries). Input only.
import type { Bot } from '../lesson-run';

export const query = '?solo&nocivilians', title = 'Reloads, both guns';
export const mode = { god: true, noAi: true };

const WALL = [3.0, 1.2, 15.6];
const gun = (B: Bot): any => B.g.player.firearm;
const ready = (B: Bot) => B.until(() => B.g.player.equipT <= 0 && !!gun(B) && !gun(B).reloading, 6);
/** the trigger on an empty gun, once the last round's own beat is over (inside it the click is not read at all) and before the gun reloads itself */
function click(B: Bot) { B.until(() => B.g.player.fireCd <= 0, 1); B.click(1, WALL); B.wait(0.6); }
function shots(B: Bot, n: number, gap = 0.35) { for (let i = 0; i < n; i++) { B.click(1, WALL); B.wait(gap); } }
/** fire until the gun is empty (at most `max` rounds), then wait out whatever reload it starts by itself, or start one */
function dry(B: Bot, max: number, gap = 0.3) {
  for (let i = 0; i < max && gun(B)?.roundsReady > 0; i++) { B.click(1, WALL); if (gun(B)?.roundsReady > 0) B.wait(gap); }
  click(B);
  if (!gun(B)?.reloading) B.press('KeyR'); B.wait(0.3); ready(B); B.wait(0.8);
}
function auto(B: Bot, secs: number) {
  B.aim(WALL); B.step(); B.I.clicked |= 1;
  try { for (let i = 0; i < secs * 60 && gun(B)?.roundsReady > 0; i++) { B.aim(WALL); B.I.buttons |= 1; B.step(); } } finally { B.I.buttons &= ~1; B.step(); }
}

export function free(B: Bot) {
  const P = B.g.player;
  B.wait(1); B.go([6.4, 0, 15.6], 10); B.aim(WALL); B.wait(0.5);
  // the pistol
  B.press('Digit1', 30); if (!P.pistolUp) B.press('KeyE', 30); ready(B); B.wait(0.6);
  shots(B, 3); B.wait(0.6); B.press('KeyR'); B.wait(0.3); ready(B); B.wait(0.8);
  dry(B, 20);
  B.press('KeyE', 60); B.press('KeyE', 60); ready(B);
  shots(B, 2); B.wait(0.8);
  // the rifle: single shots and a change with rounds left, then AUTO to the last round
  B.press('Digit2', 30); ready(B); B.wait(0.8);
  shots(B, 4, 0.3); B.wait(0.6); B.press('KeyR'); B.wait(0.3); ready(B); B.wait(0.8);
  B.press('KeyZ', 30); auto(B, 6); click(B);
  if (!gun(B)?.reloading) B.press('KeyR'); B.wait(0.3); ready(B); B.wait(0.8);
  B.press('KeyZ', 30); shots(B, 3, 0.3);
  B.press('KeyE', 60); B.press('KeyE', 60); ready(B); B.wait(1);
  B.say(`  pistol ${P.pistol?.roundsReady ?? '?'} ready, rifle ${P.rifle?.roundsReady ?? '?'} ready`);
}
