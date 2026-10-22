// 'throwrest' — THE THROW PREVIEW'S RING IS WHERE THE CAN COMES TO REST (THROWBACK.restMark, player.ts throwRest, frag.ts restOfThrow). The maintainer, off
// the solo tutorial mission: "hard to toss the smoke to precisely hit the gap … maybe we just need to update the UI to show roughly where it'll end up".
// The preview's arc and its ring ended at the can's FIRST TOUCH (throwables.ts solve); the can then bounces and rolls on. The ring now goes to where the
// item's own model, replayed on a body that was never spawned, leaves it — when it lies still, or when its fuse finds it.
//   bun run tools/qa/throwrest-check.ts        (also `probes.ts throwrest`; run it on BOTH stands: TPS_PROFILE=shipped in front for the second)
//   rest      smoke, stun and frag, each thrown down the corridor at three ranges, at the corridor's wall and through the conference room's doorway: the
//             mark is read on the frame of the click, the can is thrown by that click, and where it really lies still (a smoke) or goes off (a stun, a
//             frag) is within REST_OK of the mark. The first touch — the ring as it was — is printed beside it, and on the open-floor throws it is the
//             better part of a metre or more short of where the can ends.
//   off       the mark off: throwRest is null, with an arc up. The launcher's arc has none either (read from the code; not run here).
//   harness   standUp() on the frozen stand holds the mark off; the page's stand finds it on, and the page's boot writes it (?norestmark).
// THROWREST_BREAK=1 = the first touch handed in as the mark: rest must FAIL.   exit 0 = all hold · 1 = one does not
// THE HARNESS HAS NO GPU and no overlay: the ring, the tick and the dots are not drawn here. What is measured is the point the overlay is handed.
import { standUp, ROOT } from './headless.ts';
import { world } from './wallsnap-probes.ts';
import type { Vec3 } from '../../src/math/vec.ts';

const { THROWBACK } = await import(`${ROOT}/src/game/throwback.ts`);
const { HANDRING } = await import(`${ROOT}/src/game/handring.ts`);
const { WALLSNAP } = await import(`${ROOT}/src/game/wallsnap.ts`);
const { FRAG } = await import(`${ROOT}/src/game/frag.ts`);
const { throwRest } = await import(`${ROOT}/src/game/player.ts`);
const { harnessProfile } = await import(`${ROOT}/src/host/profile.ts`);

const BREAK = process.env.THROWREST_BREAK === '1', REST_OK = 0.3;
const f2 = (n: number) => n.toFixed(2), flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
let allPass = true, found = false;
const verdict = (ok: boolean, label: string, detail: string) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
async function quiet<T>(fn: () => Promise<T>): Promise<T> { const log = console.log; console.log = () => {}; try { return await fn(); } finally { console.log = log; } }

type Kind = 'smoke' | 'flash' | 'frag';
const KEY: Record<Kind, string> = { smoke: 'Digit3', flash: 'Digit4', frag: 'Digit5' };
// the corridor (its north wall's plane z 10.06, the floor open along x) and the conference room's doorway in that wall (x 9.32 ‥ 10.17)
const THROWS: { name: string; from: [number, number]; yaw: number; at: Vec3; open: boolean }[] = [
  { name: '4 m down the corridor', from: [24, 11.2], yaw: 270, at: [20, 0, 11.2], open: true },
  { name: '7 m down the corridor', from: [24, 11.2], yaw: 270, at: [17, 0, 11.2], open: true },
  { name: '10 m down the corridor', from: [24, 11.2], yaw: 270, at: [14, 0, 11.2], open: true },
  { name: 'at the corridor\'s wall', from: [22, 11.6], yaw: 225, at: [20.5, 1.0, 10.1], open: false },
  { name: 'through the doorway', from: [9.75, 11.8], yaw: 180, at: [9.75, 0, 7.6], open: false },
];

async function rest() {
  console.log('\n=== rest: the mark, read on the frame of the click, against where that can really ends ===');
  const S = await quiet(() => world(true)), { g, pl } = S as any; WALLSNAP.press = false; HANDRING.on = false; FRAG.on = true; THROWBACK.restMark = true; THROWBACK.on = false;
  for (const kind of ['smoke', 'flash', 'frag'] as Kind[]) {
    const rows: string[] = []; let bad = 0, shortN = 0, openN = 0;
    for (const T of THROWS) {
      S.place(T.from[0], T.from[1], T.yaw, 'pistol'); g.clearAftermath(); pl.canisters = 3; pl.flashbangs = 3; pl.frags = 3; pl.pendingThrow = null; pl.fireCd = 0; S.step(20);
      S.setCursor(T.at); S.tap(KEY[kind]); S.step(40);
      const before = JSON.stringify([g.items.items.length, pl.char.pos, pl.canisters, pl.flashbangs, pl.frags, g.events.length, g.time]); for (let i = 0; i < 5; i++) throwRest(g); if (JSON.stringify([g.items.items.length, pl.char.pos, pl.canisters, pl.flashbangs, pl.frags, g.events.length, g.time]) !== before) { bad++; rows.push(`${T.name}: asking for the mark changed the game`); }
      const sol = pl.throwPreview, R = throwRest(g); if (!sol || !R) { bad++; rows.push(`${T.name}: (staging) no arc up (slot ${pl.slot}, arc ${!!sol}, mark ${!!R})`); continue; }
      const mark: Vec3 = BREAK ? [sol.land[0], sol.land[1], sol.land[2]] : [R.at[0], R.at[1], R.at[2]], touch: Vec3 = [sol.land[0], sol.land[1], sol.land[2]];
      S.click(); let it: any = null, end: Vec3 | null = null, how = '';
      S.step(600, () => {
        if (end) return; it ??= g.items.items.find((x: any) => x.kind === kind); if (!it) return;
        if (kind === 'smoke' ? it.settled : it.fired || !g.items.items.includes(it)) { end = [it.pos[0], it.pos[1], it.pos[2]]; how = kind === 'smoke' ? 'lay still' : 'went off'; }
      });
      S.setCursor(null);
      if (!end) { bad++; rows.push(`${T.name}: the can never ${kind === 'smoke' ? 'lay still' : 'went off'} (thrown ${!!it})`); continue; }
      const off = flat(mark, end), was = flat(touch, end); if (!(off <= REST_OK) || !(Math.abs(mark[1] - Math.max(0.05, end[1])) < 0.1)) bad++;
      if (T.open) { openN++; if (was > 0.6) shortN++; }
      rows.push(`${T.name}: ${how} ${f2(off)} m from the mark; its first touch was ${f2(was)} m short of there (${R.path.length} points of floor between)`);
    }
    verdict(bad === 0 && (BREAK || shortN === openN), `${kind}: every throw ends within ${REST_OK} m of the mark; on the open floor the first touch, where the ring used to be, is over 0.6 m from where the can ends`, rows.join('\n    '));
  }
  // off: no mark with an arc up
  { S.place(24, 11.2, 270, 'pistol'); g.clearAftermath(); pl.canisters = 3; S.step(20); S.setCursor([20, 0, 11.2]); S.tap('Digit3'); S.step(40);
    const on = !!throwRest(g); THROWBACK.restMark = false; const off = throwRest(g); THROWBACK.restMark = true; S.setCursor(null);
    verdict(!!pl.throwPreview && on && off === null, 'the mark off: nothing is handed to the overlay, with the same arc up', `arc ${!!pl.throwPreview} · on ${on} · off ${off === null ? 'null' : 'a point'}`); }
}
async function harness() {
  console.log('\n=== harness: off on the frozen stand, on in the page ===');
  const frozen = harnessProfile() === 'frozen';
  THROWBACK.restMark = true; await quiet(() => standUp());
  if (frozen) verdict(THROWBACK.restMark === false && found === false, 'standUp() on the frozen stand puts the mark off (it was set before it); the card found it off', `after standUp ${THROWBACK.restMark} · found ${found}`);
  else {
    const Pf: any = await import(`${ROOT}/src/host/profile.ts`), read = (q: string) => { THROWBACK.restMark = !THROWBACK.restMark; Pf.pageSwitches(new URLSearchParams(q)); return THROWBACK.restMark; };
    const plain = read(''), off = read('norestmark'); read('');
    verdict(found === true && plain === true && off === false && THROWBACK.restMark === true, 'the page\'s stand: the card found the mark on; the page\'s boot writes it on for a plain address and off for ?norestmark', `found ${found} · plain ${plain} · ?norestmark ${off}`);
  }
}

/** the whole card (probes.ts 'throwrest'): true = every check passed. The knobs are put back as they were found. */
export async function throwRestCheck(): Promise<boolean> {
  const was = { tb: { ...THROWBACK }, ring: HANDRING.on, ws: { ...WALLSNAP }, frag: FRAG.on, rnd: Math.random }; allPass = true; found = THROWBACK.restMark;
  try { await rest(); await harness(); }
  finally { Object.assign(THROWBACK, was.tb); HANDRING.on = was.ring; Object.assign(WALLSNAP, was.ws); FRAG.on = was.frag; Math.random = was.rnd; }
  console.log(`\n=== throwrest: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`); return allPass;
}
if (import.meta.main) process.exit(await throwRestCheck() ? 0 : 1);
