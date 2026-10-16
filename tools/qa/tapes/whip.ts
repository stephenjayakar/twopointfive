// A man held at gunpoint and put out with the pistol, for the sound replays (tools/qa/sound-tapes.cjs; the page bot runs it): Training 2's own walk up to
// its first man (tools/qa/lessons/train-hands.ts: the gate eased, the whistle at the hatch, the wait in the wood store, round to his back) with the pistol kept in the hand, so the
// grab is the gun at his head and the row that ends it is the whip. Input only.
import type { Bot } from '../lesson-run';
import { steps as H } from '../lessons/train-hands';

export const query = '?levelFile=train-hands.json&quiet&nolesson', title = 'A man held at gunpoint';

export function free(B: Bot) {
  const P = B.g.player;
  H.draw(B); B.until(() => P.equipT <= 0, 3);
  H.window(B); H.whistle(B); H.clear(B); H.wait(B); H.grab(B);
  const A = P.holding?.g;
  if (!A) B.fail('nobody in his arm');
  B.wait(1.5);
  if (!B.verb('held', 'whip')) B.fail('no whip row with a man held at gunpoint');
  if (!B.until(() => A.state === 'dead', 15)) B.fail('the whip did not put him out');
  B.wait(3);
}
