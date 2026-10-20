// A LOST GPU DEVICE (src/gpu/device.ts GPU_LOST): what the page does when the browser takes its device away — nothing when the page itself is going (a load to
// another address, the Team & kit picture's window dropped: the browser calls that 'destroyed'), one fresh load of the page for a real loss, and the card only
// for a second loss inside a minute or a third in the tab, with the adapter, the reason and the boot's stage on it. The rule is one pure function and one string: no browser needed.
//   bun run tools/qa/gpulost-check.ts              exit 0 = every check passed, 1 = one failed
//   GPULOST_BREAK=1 bun run tools/qa/gpulost-check.ts     the rule is asked as if the switch were off (?gpuretry=0): must FAIL
import { GPU_LOST, gpuStory, lostAct, lostWords } from '../../src/gpu/device';

const on = process.env.GPULOST_BREAK === '1' ? false : true;
let red = 0; const check = (ok: boolean, what: string) => { console.log(`${ok ? '- PASS' : '- FAIL'} — ${what}`); if (!ok) red++; };
const now = 1_000_000, W = GPU_LOST.windowMs;
check(GPU_LOST.on === true, 'the switch ships on');
check(lostAct('destroyed', false, null, now, true, on) === 'quiet', "a device the browser calls 'destroyed' (the page's own end) says nothing");
check(lostAct('unknown', true, null, now, true, on) === 'quiet', 'a loss while the page is leaving says nothing, whatever the reason');
check(lostAct(undefined, true, null, now, true, on) === 'quiet', '… and with no reason given');
check(lostAct('unknown', false, null, now, true, on) === 'reload', 'a real loss with no retry behind it loads the page again');
check(lostAct(undefined, false, null, now, true, on) === 'reload', '… and so does one the browser gives no reason for');
check(lostAct('unknown', false, now - 5_000, now, true, on) === 'card', 'a second loss five seconds after a retry is the card');
check(lostAct('unknown', false, now - W + 1, now, true, on) === 'card', '… and one just inside the window');
check(lostAct('unknown', false, now - W, now, true, on) === 'reload', 'a loss a full window after the last retry is retried again');
check(lostAct('unknown', false, now - 10 * W, now, true, on, GPU_LOST.tries) === 'card', `a tab that has retried ${GPU_LOST.tries} times gets the card, however long ago (a device lost on every load must not load for ever)`);
check(lostAct('unknown', false, now - 10 * W, now, true, on, GPU_LOST.tries - 1) === 'reload', '… and one retry short of that is still retried');
check(lostAct('unknown', false, null, now, false, on) === 'card', 'a page that did not ask for the retry (a tool page) gets the card');
check(lostAct('destroyed', false, null, now, false, on) === 'quiet', '… and still nothing for its own end');
for (const r of ['destroyed', 'unknown', undefined]) check(lostAct(r, r === 'destroyed', now - 1, now, true, false) === 'card', `switch off (?gpuretry=0), reason ${r}: the card at once, as it was`);
gpuStory.adapter = 'acme discrete Some Card'; gpuStory.stage = 'while compiling shaders, 37 of 119';
{ const w = lostWords('The device went away.', 'unknown', true);
  check(w.startsWith('GPU device lost: The device went away.'), "the card opens with the browser's own message");
  check(w.includes('acme discrete Some Card') && w.includes('reason: unknown') && w.includes('37 of 119') && w.includes('loaded again once'), 'the card names the adapter, the reason, the stage and the retry'); }
check(lostWords('x', 'unknown', 2).includes('loaded again 2 times'), 'two retries behind it: the card says two');
gpuStory.stage = '';
{ const w = lostWords('Gone.', undefined, false); check(!w.includes('reason') && !w.includes('loaded again') && !/·\s*$/.test(w), 'no reason, no stage, no retry: none of them is on the card'); }
console.log(red ? `${red} FAILED` : 'all passed');
process.exit(red ? 1 : 0);
