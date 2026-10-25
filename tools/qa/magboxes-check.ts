// 'magboxes' — THE BOX COUNTS THE ROUNDS IN THE GUN OVER WHAT ITS MAGAZINE HOLDS, WITH A BOX FOR EACH SPARE MAGAZINE BESIDE IT (SLOTSETUP.mags,
// src/game/slotsetup.ts; drawn by src/ui/handbox.ts). The maintainer, of the box that read 31 / 60 at a mission's start: "we should say 31/30 and then two
// spare magazines on the side".
//   bun run tools/qa/magboxes-check.ts        (also `probes.ts magboxes`; run it on BOTH stands: TPS_PROFILE=shipped in front for the second)
//   box       the rifle up at a mission's start: the count is the rounds in the gun over the magazine's size and a box stands for each spare, full. Rounds
//             fired come off the first number alone. After a reload the fullest spare is in the gun, the magazine that came out is a box as full as it was,
//             and the boxes are still one a magazine. The pistol's box reads the same way.
//   off       the key off: the rounds in the gun over the rounds in all the spares, and no box — the box as it was.
//   journal   a recording from before the key replays with it off; one that carries it replays as it says.
//   harness   standUp() on the frozen stand holds it off; the page's stand finds it on, and the page's boot writes it (?magboxes=0).
// MAGBOXES_BREAK=1 = the box draws the old count: box must FAIL.   exit 0 = all hold · 1 = one does not
// THE HARNESS HAS NO PAGE: the box is drawn by the real overlay code on the probes' stand-in elements (fn2000-probes.ts hudText) and read as text. How it
// looks is not seen here.
import { standUp, ROOT } from './headless.ts';

const { SLOTSETUP } = await import(`${ROOT}/src/game/slotsetup.ts`);
const { harnessProfile } = await import(`${ROOT}/src/host/profile.ts`);
const { stage, hudText } = await import('./fn2000-probes.ts');
const DT = 1 / 60, AHEAD: [number, number, number] = [15, 1.2, 11.5];
let allPass = true, found = false;
const verdict = (ok: boolean, label: string, detail: string) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
async function quiet<T>(fn: () => T | Promise<T>): Promise<T> { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => {}; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } }
const wait = (W: any, secs: number) => { for (let i = 0; i < Math.round(secs * 60); i++) { W.cursorAt(AHEAD); W.step(DT); } };
const key = (W: any, code: string, n = 1) => { W.input.pressed.add(code); for (let i = 0; i < n; i++) { W.cursorAt(AHEAD); W.step(DT); } };
/** what the box says of the gun in his hands: the two numbers and how full each spare's box is (a hundred = a full magazine) */
const read = (g: any) => { const t = hudText(g), m = /span\.hb-n(?:\.dry)?\(b\{(\d+)\} i(\.of)?\{\/ ?(\d+)\}\)/.exec(t);
  return m ? { inGun: +m[1], of: m[2] === '.of', over: +m[3], boxes: /span\.mags/.test(t) ? (t.match(/span\.mag(?!s)/g) ?? []).length : -1 } : null; };
const fills = (g: any) => g.player.rifle.spareSorted().map((r: number) => Math.round((r / g.player.rifle.def.magCapacity) * 100));
const up = async () => quiet(async () => { const W: any = await stage(4120); SLOTSETUP.on = SLOTSETUP.pop = SLOTSETUP.draw = true; const g = W.game, pl = g.player; g.aiEnabled = false; g.infiniteAmmo = false;
  for (let i = 0; i < 90 && (pl.equipT > 0 || !pl.rifleUp); i++) wait(W, DT); wait(W, 0.5); return { W, g, pl, rf: pl.rifle }; });

async function box() {
  console.log('\n=== box: the gun\'s rounds over its magazine\'s size, a box a spare ===');
  const { W, g, pl, rf } = await up(); SLOTSETUP.mags = true; const cap = rf.def.magCapacity, n0 = rf.spare.length;
  { const R = read(g);
    verdict(!!R && R.of && R.inGun === rf.roundsReady && R.over === cap && R.boxes === n0 && n0 > 0 && rf.spare.every((r: number) => r === cap), 'the rifle at the start: rounds in the gun over what the magazine holds, and a box for each spare magazine', R ? `${R.inGun}/${R.over} · ${R.boxes} boxes (he carries ${n0} spare, each ${cap})` : `no count read: ${hudText(g).slice(0, 200)}`); }
  { await quiet(() => { for (let i = 0; i < 6; i++) { W.cursorAt(AHEAD); W.input.clicked |= 1; W.input.buttons |= 1; W.step(DT); W.input.buttons &= ~1; wait(W, 0.3); } }); const R = read(g), gone = cap + 1 - rf.roundsReady;
    verdict(!!R && gone > 0 && R.inGun === rf.roundsReady && R.over === cap && R.boxes === n0, 'rounds fired come off the first number alone: the magazine\'s size and the boxes stand', R ? `${gone} fired: ${R.inGun}/${R.over} · ${R.boxes} boxes` : 'no count read'); }
  { const was = rf.mag; await quiet(() => { key(W, 'KeyR'); let n = 0; while ((rf.reloading || n < 5) && n++ < 400) wait(W, DT); wait(W, 0.2); }); const R = read(g), F = fills(g);
    verdict(!!R && R.inGun === cap + 1 && R.over === cap && R.boxes === n0 && F.length === n0 && F[0] === 100 && F[F.length - 1] === Math.round((was / cap) * 100) && F[F.length - 1] < 100, 'after a reload the full magazine is in the gun and the one that came out is still a box, as full as it was', R ? `${R.inGun}/${R.over} · ${R.boxes} boxes, as full as ${F.join(' and ')} in a hundred (the one that came out held ${was})` : `no count read (reloading ${rf.reloading})`); }
  { await quiet(() => { key(W, 'Digit1', 90); wait(W, 0.4); }); const R = read(g), p = pl.pistol;
    verdict(pl.slot === 'pistol' && !!R && R.of && R.inGun === p.roundsReady && R.over === p.def.magCapacity && R.boxes === p.spare.length, 'the pistol\'s box reads the same way', R ? `${R.inGun}/${R.over} · ${R.boxes} boxes (he carries ${p.spare.length})` : `no count read (slot ${pl.slot})`); }
  { await quiet(() => { key(W, 'Digit2', 90); wait(W, 0.4); }); SLOTSETUP.mags = false; const R = read(g), sum = rf.spare.reduce((a: number, b: number) => a + b, 0); SLOTSETUP.mags = true;
    verdict(!!R && !R.of && R.inGun === rf.roundsReady && R.over === sum && R.boxes === -1, 'the key off: the rounds in the gun over the rounds in all the spares, and no box — the box as it was', R ? `${R.inGun} / ${R.over} · boxes ${R.boxes === -1 ? 'none' : R.boxes}` : 'no count read'); }
  // ---- the journal
  { const J: any = await import(`${ROOT}/src/game/journal.ts`), full = JSON.parse(JSON.stringify(J.knobsSnapshot(g)));
    try {
      SLOTSETUP.mags = true; const old = JSON.parse(JSON.stringify(J.knobsSnapshot(g))); delete old.tables.SLOTSETUP.mags; J.applyKnobs(g, old); const before = SLOTSETUP.mags;
      SLOTSETUP.mags = true; const yes = JSON.parse(JSON.stringify(J.knobsSnapshot(g))); SLOTSETUP.mags = false; J.applyKnobs(g, yes); const carried = SLOTSETUP.mags;
      verdict(before === false && carried === true, 'a recording with no such key replays with the old count; one that carries the key replays as it says', `before the key ${before} · carried on ${carried}`);
    } finally { J.applyKnobs(g, full); } }
}
async function harness() {
  console.log('\n=== harness: off on the frozen stand, on in the page ===');
  const frozen = harnessProfile() === 'frozen';
  SLOTSETUP.mags = true; await quiet(() => standUp());
  if (frozen) verdict(SLOTSETUP.mags === false && found === false, 'standUp() on the frozen stand puts the new count off (it was set before it); the card found it off', `after standUp ${SLOTSETUP.mags} · found ${found}`);
  else {
    const Pf: any = await import(`${ROOT}/src/host/profile.ts`), at = (q: string) => { SLOTSETUP.mags = !SLOTSETUP.mags; Pf.pageSwitches(new URLSearchParams(q)); return SLOTSETUP.mags; };
    const plain = at(''), off = at('magboxes=0'); at('');
    verdict(found === true && plain === true && off === false && SLOTSETUP.mags === true, 'the page\'s stand: the card found the new count on; the page\'s boot writes it on for a plain address and off for ?magboxes=0', `found ${found} · plain ${plain} · ?magboxes=0 ${off}`);
  }
}

/** the whole card (probes.ts 'magboxes'): true = every check passed. The knobs are put back as they were found. */
export async function magBoxesCheck(): Promise<boolean> {
  const { knobsCopy, knobsBack } = await import(`${ROOT}/src/game/knobs.ts`); const was = knobsCopy(), rnd = Math.random; allPass = true; found = SLOTSETUP.mags;
  try { await box(); await harness(); }
  finally { knobsBack(was); Math.random = rnd; }
  console.log(`\n=== magboxes: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`); return allPass;
}
if (import.meta.main) process.exit(await magBoxesCheck() ? 0 : 1);
