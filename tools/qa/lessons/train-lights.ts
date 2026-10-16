// The scripted player for Training 3, the generator yard (levels/train-lights.json; tools/qa/lesson-run.ts runs it): what each step asks, through the input only.
import type { Bot } from '../lesson-run';

export const query = '?quiet';

const LAMP = [11.8, 3.4, 15.4], CAM = [20.34, 2.7, 14.1], EMITTER = [24.0, 0.35, 16.74], TRUNK = [30.0, 1.0, 19.2], BREAKER = [23.4, 1.35, 16.3];
const target = (B: Bot, name: string) => B.g.targets.find((t: any) => t.name === name);
const dark = (B: Bot, name: string) => { const t = target(B, name); return !!t && (t.broken || t.factor <= 0.05); };
/** the OCP on what is at `p`: wait for its charge (the reticle says when), the cursor on the thing, the right button */
function ocp(B: Bot, p: number[], name: string) {
  B.until(() => B.g.player.ocp.ready(), 6);
  for (let i = 0; i < 3 && !dark(B, name); i++) { B.aim(p); B.step(); B.aim(p); B.I.clicked |= 4; B.step(8); }   // (the right button is bit 4 of Input.clicked)
  if (!dark(B, name)) B.fail(`the OCP did not put ${name} out`);
}
export const steps: Record<string, (B: Bot) => void> = {
  draw: B => { B.press('Digit1', 20); },
  // in by the gate, then rounds at the lamp's head until it is out
  shoot: B => {
    if (!B.openDoor('gate_w')) B.fail('the gate did not open');
    B.go([9.6, 0, 14.0], 15);
    for (let i = 0; i < 6 && !dark(B, 'lamp_gate'); i++) { B.click(1, LAMP); B.step(20); }
    if (!dark(B, 'lamp_gate')) B.fail('the lamp is still lit');
  },
  // the locked door in the lane wall: the pick, then still until the lock gives
  pick: B => {
    B.go([14.0, 0, 11.9], 15);
    if (!B.verb('door', 'pick', [14.0, 1.0, 11.0])) B.fail('no row to pick the lane door');
    B.until(() => !B.door('lane').locked, 10);
  },
  empty: B => { B.press('KeyE', 20); },   // hands empty: a grab needs them
  grab: B => {
    const gd = B.g.guards[0], P = B.g.player;
    const gap = () => Math.hypot(gd.char.pos[0] - P.char.pos[0], gd.char.pos[2] - P.char.pos[2]);
    // wait behind the shut door until he has turned and walks away east, then in and up behind him while he stands at the far end
    if (!B.until(() => gd.char.vel[0] > 0.3 && gd.char.pos[0] < 23.5, 40)) B.fail('the guard never walked away east');
    if (!B.openDoor('lane')) B.fail('the lane door did not open');
    B.go([14.0, 0, 8.6], 8);
    B.go([26.4, 0, 8.4], 25, { stop: () => gap() < 6 });
    B.crouch(true);   // the last stretch on quiet feet
    B.go([gd.char.pos[0] - 0.5, 0, gd.char.pos[2]], 25, { stop: () => gap() < 0.9, near: 0.1 });
    if (!B.verb('guard', 'grab', [gd.char.pos[0], 1.35, gd.char.pos[2]])) B.fail('no row to grab the guard');
    if (!B.until(() => P.holding?.phase === 'held', 4)) B.fail('the grab did not take');
  },
  // nobody gives at the first exchange: keep asking until he says the digits
  ask: B => {
    const P = B.g.player;
    for (let i = 0; i < 8 && !P.codes.has('pad_hut'); i++) { if (!B.verb('held', 'question')) B.fail('no row to question him'); B.until(() => P.codes.has('pad_hut'), 4); }
    if (!P.codes.has('pad_hut')) B.fail('he did not give the code');
  },
  choke: B => {
    const P = B.g.player;
    if (!B.verb('held', 'choke')) B.fail('no row to choke him out');
    if (!B.until(() => !P.holding, 12)) B.fail('he would not go under');
    B.crouch(false);
  },
  return: B => { B.go([14.0, 0, 11.9], 30); },
  ocp: B => { B.go([14.9, 0, 12.0], 20); B.press('Digit1', 20); ocp(B, CAM, 'cam_court'); },
  // (a reader who took his time finds its lamp red again: the line says jam it again, then cross)
  camera: B => { if (!dark(B, 'cam_court')) ocp(B, CAM, 'cam_court'); B.go([21.4, 0, 12.2], 15); },
  // into the alley and up to the beam (a stride short of it), the box on the wall put out
  beam: B => { B.go([21.6, 0, 17.8], 20); B.go([23.0, 0, 18.4], 8); ocp(B, EMITTER, 'beam_alley'); },
  cross: B => { if (!dark(B, 'beam_alley')) ocp(B, EMITTER, 'beam_alley'); B.go([25.2, 0, 19.2], 8); },
  code: B => { if (!B.verb('door', 'code', [26.0, 1.0, 19.2])) B.fail('no row to type the code'); if (!B.until(() => !B.door('hut').isClosed(), 10)) B.fail('the door did not open to the code'); },
  take: B => { B.go([29.6, 0, 19.2], 20); if (!B.verb('objective', 'drive', TRUNK)) B.fail('no row to take the papers'); B.until(() => B.g.mission.stage === 'exfil', 20); },
  // back out over the beam (the OCP on it again, unless it is still out)
  'beam-back': B => { B.go([25.2, 0, 19.2], 20); if (!dark(B, 'beam_alley')) ocp(B, EMITTER, 'beam_alley'); B.go([21.6, 0, 17.8], 8); },
  // out of the alley's mouth, round the wall's end into the nook: the box on the wall
  breaker: B => {
    B.go([23.2, 0, 15.6], 20);
    if (!B.verb('breaker', 'breakerOff', BREAKER)) B.fail('no row to throw the breaker');
  },
  // goggles on, down the middle of the court that was the brightest floor in the yard
  walk: B => { B.press('KeyN', 10); B.go([25.0, 0, 14.0], 10); B.go([30.2, 0, 14.0], 15); },
  kick: B => { B.go([31.1, 0, 14.0], 10); if (!B.verb('door', 'kick', [32.0, 1.0, 14.0])) B.fail('no row to kick the gate'); B.until(() => B.door('gate_e').lockBroken, 5); },
};
/** out through the gate he has just kicked in */
export function finish(B: Bot) { if (!B.until(() => !B.door('gate_e').isClosed(), 6)) B.fail('the kicked gate did not come open'); B.go([35.5, 0, 14.0], 20); }
