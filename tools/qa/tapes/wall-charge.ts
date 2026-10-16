// A wall charge, start to finish, for the sound replays (tools/qa/sound-tapes.cjs; the page bot runs it): Mousehole from the dark yard, the four told to
// breach the ward's outside wall, the charge blown on F, the entry left to run. Input only: the cursor on the wall, X, the row's own
// digits (read off the menu that came up), F.
import type { Bot } from '../lesson-run';

export const query = '?levelFile=mousehole.json&roomclear&squad4&freshstart=0', title = 'A wall charge';
export const mode = { god: true };

/** the ward's outside wall runs along z = 7, a quarter metre thick; these are places ON its yard face at chest height (the menu takes a wall only with the
 *  cursor on the wall itself), nearest the team's start first */
const FOOT = [12.0, 11.0, 13.2, 10.2, 14.0].map(x => [x, 1.2, 6.89]);
const ROW = 'wallCharge', PAGE = 'walltools';

/** X on `p` and the keys to the wall's row; false = that place has no such row, or it is greyed (the menu is put away) */
function charge(B: Bot, p: number[]): boolean {
  const O = B.g.orders, n = O.log.length;
  B.aim(p); B.step(2); B.aim(p); B.press('KeyX', 20);
  const key = (id: string, by: 'id' | 'opens') => { const M = O.menu; if (!M) return 0; const i = M.rows.findIndex((r: any) => r[by] === id); return i >= 0 && !M.why[i] ? Number(M.rows[i].key) || 0 : 0; };
  let k = key(ROW, 'id');
  if (!k) { const o = key(PAGE, 'opens'); if (o) { B.press(`Digit${o}`, 6); k = key(ROW, 'id'); } }
  if (k) B.press(`Digit${k}`, 6);
  if (O.log.length > n && O.log[O.log.length - 1].order === ROW) return true;
  B.say(`  no charge row at (${p[0]}, ${p[2]}): ${O.menu ? O.menu.rows.map((r: any, i: number) => `${r.key ?? '-'} ${r.id}${O.menu.why[i] ? ' (' + O.menu.why[i] + ')' : ''}`).join(' · ') : 'no menu came up'}`);
  for (let i = 0; i < 3 && O.menu; i++) B.press('Escape', 2);
  return false;
}

export function free(B: Bot) {
  const g = B.g, C = g.wallCharge;
  B.wait(2);
  const at = FOOT.find(p => charge(B, p));
  if (!at) B.fail('no place on the ward\'s outside wall took the charge order');
  B.say(`  the four are told to breach the wall at (${at![0]}, ${at![2]})`);
  if (!B.until(() => C.set.length > 0, 40)) B.fail('no charge was set in 40 s');
  B.say(`  charge set at ${B.t().toFixed(1)} s`);
  // the men stand off, then it is the player's call: he gives them five seconds and says the word
  B.wait(5); B.press('KeyF', 2);
  if (!B.until(() => C.stats.blown > 0, 6)) { B.press('KeyF', 2); if (!B.until(() => C.stats.blown > 0, 6)) B.fail('F blew nothing'); }
  B.say(`  blown at ${B.t().toFixed(1)} s`);
  // the entry through the hole, and the room fight it starts
  B.wait(25);
}
