// THE REPLAY'S CTRL TURN FOLLOWS THE VIEWER'S 'TURN DIRECTION' ROW (Options > Game; host/findme.ts FINDME.turn). In play the row is the sign on host/loop.ts's
// orbit; the engine replay (src/replay/engineplay.ts) turns its own picture under Ctrl — the mouse moved, or dragged — and says it turns "as Ctrl does in
// play", so it asks the same row. This holds:
//   · ctrlTurn(dx) is 0.006 rad a pixel the way it always was with the row as it starts, and the other way with the row flipped,
//   · both Ctrl roads in the player's mouse code go through it (the mouse moved under Ctrl, and a drag begun under Ctrl, with Shift or without), and a right
//     or Shift drag with no Ctrl — the viewer's own turn-and-tilt, which play has no like of — does not. (Read off the source: the handlers pressed for real,
//     with the row flipped, are the page tool's `turn` section.)
// REPLAYTURN_BREAK=1 makes the replay's turn not ask the row: 'the other way with the row flipped' must fail.
//   bun run tools/qa/replayturn-check.ts          exit 0 = all pass · 1 = a line failed
// On the page: engine-replay-page.cjs `turn` (the row flipped) and `fog` (the row as it starts). The row's own page check: findme-page.cjs.
import { ROOT } from './headless.ts';
import { readFileSync } from 'node:fs';
const { ctrlTurn } = await import(`${ROOT}/src/replay/engineplay.ts`) as { ctrlTurn: (dx: number) => number };
const { FINDME, FINDME_START } = await import(`${ROOT}/src/host/findme.ts`) as { FINDME: { turn: 1 | -1 }; FINDME_START: { turn: 1 | -1 } };
let bad = 0; const line = (ok: boolean, label: string, detail = '') => { if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`); };
const near = (a: number, b: number) => Math.abs(a - b) < 1e-12, was = FINDME.turn;
try {
  FINDME.turn = FINDME_START.turn; const as = [ctrlTurn(30), ctrlTurn(-10), ctrlTurn(0)];
  line(FINDME_START.turn === 1 && near(as[0], 0.18) && near(as[1], -0.06) && as[2] === 0, 'with the row as it starts the replay turns as it always did, 0.006 rad a pixel', `30 px ${as[0].toFixed(3)} · −10 px ${as[1].toFixed(3)}`);
  FINDME.turn = -1; const other = [ctrlTurn(30), ctrlTurn(-10)];
  line(near(other[0], -0.18) && near(other[1], 0.06), 'with the row flipped the replay turns the other way', `30 px ${other[0].toFixed(3)} · −10 px ${other[1].toFixed(3)}`);
} finally { FINDME.turn = was; }
const play = readFileSync(`${ROOT}/src/replay/engineplay.ts`, 'utf8');
const moved = /e\.ctrlKey && !e\.buttons && e\.movementX[^\n]*\.yaw \+= ctrlTurn\(e\.movementX\)/.test(play), dragged = /F\.yaw = D\.from\.yaw \+ \(D\.ctrl \? ctrlTurn\(dx\) : dx \* 0\.006\)/.test(play) && /ctrl: e\.ctrlKey,/.test(play), bare = (play.match(/movementX \* 0\.006/g) ?? []).length;
line(moved && dragged && bare === 0, 'the mouse moved under Ctrl and a drag begun under Ctrl both ask it; a right or Shift drag with no Ctrl keeps its own way', `moved ${moved} · dragged ${dragged} · a bare 0.006 on the moved mouse: ${bare}`);
console.log(bad ? `\n${bad} line(s) FAILED` : '\nall pass');
process.exit(bad ? 1 : 0);
