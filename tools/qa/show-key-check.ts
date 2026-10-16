// P CANNOT COST A RUN — the check behind src/game/showkey.ts (the missions goal's fault S3: P started the night showcase over a live run, no question asked,
// and no card named the key since the showcase buttons came off the start card).
//   bun run tools/qa/show-key-check.ts
// What it does: (1) the rule's whole table — over a running show P stops it; with no show up it starts one only when the card offers the showcases AND the
// floor is fresh; (2) the page's own key handler (src/main.ts) decides through that rule and has no other road from the P key to a showcase's start.
// The page itself: `PORT=<dev server> node tools/qa/ways-in-look.cjs <outDir> solo=solo` plays twenty seconds of a solo night on the real page (software adapter),
// presses P and reads what is running: its `afterP.show` must be null.
// exit 0 = both hold · 1 = one does not (on a build from before the rule: the module is not there, the handler starts the show itself)
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

let failed = false; const line = (ok: boolean, s: string) => { if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}`); };
const ROOT = resolve(import.meta.dir, '../..');
let showKey: ((s: { showing: boolean; buttons: boolean; fresh: boolean }) => string | null) | null = null;
try { showKey = (await import(`${ROOT}/src/game/showkey.ts`)).showKey; } catch { /* a build from before the rule */ }
if (!showKey) line(false, 'src/game/showkey.ts is not on this build: nothing stands between the P key and a showcase');
else {
  const rows: [boolean, boolean, boolean, string | null, string][] = [
    [true, false, false, 'stop', 'a show running: P stops it'], [true, true, true, 'stop', 'a show running, the card offering shows: P stops it'],
    [false, false, false, null, 'a run under way, no showcase buttons: P does nothing'], [false, false, true, null, 'a fresh floor, no showcase buttons: P does nothing'],
    [false, true, false, null, 'a run under way, the card offers shows: P does nothing'], [false, true, true, 'start', 'a fresh floor, the card offers shows: P starts one'] ];
  for (const [showing, buttons, fresh, want, words] of rows) { const got = showKey({ showing, buttons, fresh }); line(got === want, `${words} (rule says ${got === null ? 'nothing' : got})`); }
}
{ const src = readFileSync(resolve(ROOT, 'src/main.ts'), 'utf8'), at = src.split('\n').filter(l => /input\.hit\('KeyP'\)/.test(l));
  line(at.length === 1, `src/main.ts reads the P key in ${at.length} place${at.length === 1 ? '' : 's'}`);
  const h = (at[0] ?? '').split('//')[0];
  line(/showKey\(/.test(h) && !/else\s+startNight\(\)/.test(h) && /=== 'start'\)\s*startNight\(\)/.test(h), 'the handler starts the night showcase only on the rule\'s own "start"');
  line(/buttons:\s*SHOWCASE_BUTTONS/.test(h) && /chronicle\.events\.length === 0/.test(h), 'the handler hands the rule the card\'s showcase switch and the run\'s own freshness'); }
console.log(failed ? '=== show-key-check: FAILED ===' : '=== show-key-check: ALL PASS ===');
process.exit(failed ? 1 : 0);
