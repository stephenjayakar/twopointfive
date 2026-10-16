// Doors, for the sound replays (tools/qa/sound-tapes.cjs; the page bot runs it): every way a door is worked on the office floor, one at a time and with
// nothing else going on. The steel stair door booted (it holds), the conference door pushed shut and eased open, the server room's lock tried from a
// crouch and then picked, the keypad door tried with no code from the manager's side, the storage room's lock kicked in, the fire exit opened and shut by
// hand and then taken at a run. Nobody on the floor is awake (the sandbox's no-AI switch, which the run tape carries; the night staff still walk their
// beats, so a door of theirs creaks now and then). Input only.
import type { Bot } from '../lesson-run';

export const query = '?solo&nocivilians', title = 'Doors: hands, picks and boots';
export const mode = { god: true, noAi: true };

const rows = (B: Bot) => B.g.nearby.map((r: any) => `${r.kind}:${r.verb}`).join(' ') || 'none';
/** the first of the verbs the door's rows offer, performed; false (and the rows said) when none is there */
function work(B: Bot, verbs: string[], aim: number[]): boolean {
  B.aim(aim); B.step(6);
  for (const v of verbs) if (B.g.nearby.some((r: any) => r.kind === 'door' && r.verb === v)) { if (!B.verb('door', v, aim)) B.fail(`'${v}' did nothing at (${aim[0]}, ${aim[2]}) (rows: ${rows(B)})`); return true; }
  return B.fail(`none of ${verbs.join(' / ')} at (${aim[0]}, ${aim[2]}) (rows: ${rows(B)})`);
}

/** the hand's own move over (walked open / shut, or eased), then the leaf's last sound out */
function settle(B: Bot, tail = 1.2) { const P = B.g.player; B.step(4); B.until(() => !P.doorMove && !P.easing, 5); B.wait(tail); }
export function free(B: Bot) {
  const g = B.g, D = (n: string) => g.doors.byName(n);
  B.wait(1);
  // the stair door: steel, locked — the boot rings on it and it holds
  B.go([5.0, 0, 11.0], 12); if (work(B, ['kick'], [4.0, 1.0, 11.3])) B.wait(2.2);
  // the conference door stands open: pull it to, ease it open, push it wide, shut it again
  B.go([9.75, 0, 10.8], 15); const conf = [9.75, 1.0, 10.0];
  work(B, ['pull', 'push'], conf); settle(B);
  work(B, ['ease'], conf); settle(B);
  work(B, ['push', 'pull'], conf); settle(B);
  work(B, ['pull', 'push'], conf); settle(B);
  // the server room: the handle tried from a crouch, then the lock picked, then in
  B.go([17.9, 0, 10.95], 20); const srv = [17.9, 1.0, 10.0];
  B.crouch(true); if (work(B, ['rattle'], srv)) B.wait(1.4); B.crouch(false); B.wait(0.4);
  if (work(B, ['pick'], srv)) { B.until(() => !D('server').locked || !D('server').isClosed(), 8); B.wait(0.8); }
  if (D('server').isClosed()) { work(B, ['push', 'unlock', 'ease'], srv); settle(B); }
  // out again and round by the manager's office (its door stands open) to the keypad door's own face: tried with no code
  B.go([17.9, 0, 11.1], 12); B.go([25.75, 0, 11.1], 12); B.go([25.75, 0, 8.9], 6);
  B.go([23.0, 0, 8.75], 8); const pad = [22.0, 1.0, 8.73];
  B.aim(pad); B.step(10); B.say(`  at the keypad door: ${rows(B)}`);
  if (work(B, ['nocode', 'code'], pad)) B.wait(1.6);
  // back to the corridor; the storage room: locked, kicked in
  B.go([25.75, 0, 8.9], 8); B.go([25.75, 0, 11.1], 6); B.go([32.75, 0, 10.9], 12); const sto = [32.75, 1.0, 10.0];
  if (work(B, ['kick'], sto)) B.wait(2.4);
  // into the break room (the night staff walk through its corridor door: it may stand open) and the fire exit by hand: open, and shut again
  B.go([30.73, 0, 11.1], 8); B.go([30.73, 0, 13.6], 8); B.go([35.2, 0, 20.75], 25); const exit = [36.0, 1.0, 20.75];
  work(B, ['push', 'pull'], exit); settle(B);
  work(B, ['pull', 'push'], exit); settle(B, 1.4);
  // …and then the same door taken at a run, out into the rain
  B.go([32.7, 0, 20.75], 8); B.wait(0.4); const shut = D('fire_exit').isClosed();
  B.go([37.6, 0, 20.75], 4, { sprint: true, noDoors: true }); B.wait(2.0); B.say(`  the fire exit ${shut ? 'was shut' : 'stood open'}; run through, now ${D('fire_exit').isClosed() ? 'shut' : 'open'}`);
  B.say(`  server ${D('server').isClosed() ? 'shut' : 'open'}, storage lock ${D('storage').lockBroken ? 'broken' : 'whole'}`);
  B.wait(1);
}
