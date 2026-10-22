// 'leangun' — A RIFLE BESIDE A JAMB FIRES, OR THE RING SAYS IT CANNOT (WALLSNAP.leanGun, player.ts stackLean · GUNWALL.mark, player.ts gunShut). The
// maintainer, off the solo tutorial mission: "shooting the sentry doesn't work since the rifle is on the right hand side and the bullets are hitting the
// doorframe?" Stacked on a wall, the cursor round its end steps him out — 0.6 m, measured for his eyes. The rifle rides a hand's width to his right: round an
// end on that side his head was clear, the reticle had the man, and the rifle lay IN the jamb — every round stopped in the wood at the muzzle (combat.ts
// armThrough). Free beside the same jamb the gun came down (gunwall.ts) and a click did nothing; the words either case filed are in no list the page draws.
//   bun run tools/qa/leangun-check.ts        (also `probes.ts leangun`; run it on BOTH stands: TPS_PROFILE=shipped in front for the second)
//   gun-side   the conference doorway's jamb, the wall on his rifle's side. Knob on: he stands further out than 0.6 m, the rifle is clear, ONE click sends a
//              round into the room; back in, he is on the station he left. Knob 0 is the fault as it was: 0.6 m, the round ends at its own muzzle.
//   off-side   the doorway's other jamb, the wall on his off side: 0.6 m with the knob on or at 0, to the centimetre, and the round goes.
//   ring       the mark: at knob 0 stepped out into the jamb it is up, with the knob on it is not; stacked with the cursor over the wall he is on it is up;
//              free along the doorway's face, the rifle wanted up, it is up exactly where a click sends no round into the room — and never with the mark off.
//              Not on the way out or back in (from his station the point he steps out for is behind his wall). The pistol's line is not run here.
//   harness    standUp() on the frozen stand leaves both off; the page's stand finds them on and the page's boot writes them (?noleangun, ?nogunmark); a
//              session file from before the key replays with the step-out at 0.6 m.
// LEANGUN_BREAK=1 = the knob left at 0 where a line asks for it: gun-side must FAIL.   exit 0 = all hold · 1 = one does not
// THE HARNESS HAS NO GPU: nothing here is a picture. What is measured is where he stands, where the rounds end, and the flag the overlay reads.
import { standUp, ROOT } from './headless.ts';
import { world } from './wallsnap-probes.ts';
import type { Vec3 } from '../../src/math/vec.ts';

const { WALLSNAP, LEAN_GUN_M } = await import(`${ROOT}/src/game/wallsnap.ts`);
const { GUNWALL } = await import(`${ROOT}/src/game/gunwall.ts`);
const { gunShut } = await import(`${ROOT}/src/game/player.ts`);
const { armThrough } = await import(`${ROOT}/src/game/combat.ts`);
const J: any = await import(`${ROOT}/src/game/journal.ts`);
const { harnessProfile } = await import(`${ROOT}/src/host/profile.ts`);

const BREAK = process.env.LEANGUN_BREAK === '1';
const f2 = (n: number) => n.toFixed(2), P = (p?: number[] | null) => p ? `[${f2(p[0])}, ${f2(p[1])}, ${f2(p[2])}]` : 'none';
let allPass = true, found = { lean: 0, mark: false };
const verdict = (ok: boolean, label: string, detail: string) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
async function quiet<T>(fn: () => Promise<T>): Promise<T> { const log = console.log; console.log = () => {}; try { return await fn(); } finally { console.log = log; } }

// the corridor's north wall (its plane z 10.06) and the conference room's doorway in it: the opening is x 9.32 ‥ 10.17 between the frame's posts, the room
// to the south. Facing into the room his right hand is toward +x: the EAST jamb is on his gun side, the west one on his off side.
const WALL_Z = 10.06, EAST = { cx: 10.2, s: 1, key: 'KeyA', yaw: 270, into: [9.7, 1.2, 6.5] as Vec3 }, WEST = { cx: 9.0, s: -1, key: 'KeyD', yaw: 90, into: [9.8, 1.2, 8.0] as Vec3 };
type Out = { ok: boolean; why: string; out: number; more: number; lean: number; stance: string; shut: boolean; thru: boolean; rounds: number; len: number; to: Vec3 | null; backDx: number; kept: boolean; onWall: boolean; flick: number; key: boolean };

/** stack him beside the doorway on `side`, put the cursor on a point in the room, let him step out, click once, and bring him back in */
async function stepOut(side: typeof EAST, lean: number, mark = true): Promise<Out> {
  const S = await quiet(() => world(true)), { g, pl, c } = S;
  WALLSNAP.leanGun = lean; GUNWALL.mark = mark;
  const R: Out = { ok: false, why: '', out: 0, more: 0, lean: 0, stance: '', shut: false, thru: false, rounds: 0, len: 0, to: null, backDx: 0, kept: false, onWall: false, flick: 0, key: false };
  S.place(side.cx + side.s * 0.8, 10.8, side.yaw, 'rifle'); S.setCursor([side.cx - side.s * 3, 1.2, 10.8]); S.step(10); S.tap('KeyQ'); S.step(40);
  S.keys(side.key); S.step(60); S.keys(); S.step(20);
  const w = pl.wall; if (!w || w.kind !== 'stack' || w.atEdge === 0) { R.why = `(staging) no stack parked at the doorway (kind ${w?.kind}, atEdge ${w?.atEdge})`; return R; }
  const x0 = c.pos[0];
  S.setCursor(side.into); S.step(45, () => { if ((w.lean ?? 0) < 1 && gunShut(g)) R.flick++; });
  R.key = 'leanMore' in w; R.out = Math.abs(c.pos[0] - x0); R.more = w.leanMore ?? 0; R.lean = w.lean ?? 0; R.stance = c.anim.longStance ?? ''; R.shut = gunShut(g); R.thru = armThrough(g, c);
  const seen = new Set(g.events); S.click(); S.step(13);
  for (const e of g.events) if (!seen.has(e) && e.kind === 'shot' && e.from && e.to) { R.rounds++; R.len = Math.hypot(e.to[0] - e.from[0], e.to[2] - e.from[2]); R.to = [e.to[0], e.to[1], e.to[2]]; }
  S.setCursor([side.cx + side.s * 4, 1.2, 11.2]); S.step(100);
  R.backDx = Math.abs(c.pos[0] - x0); R.kept = w.leanMore !== undefined; R.onWall = pl.wall === w; R.ok = true; S.setCursor(null);
  return R;
}
const say = (r: Out) => r.ok ? `${f2(r.out)} m past his station (the rifle's share ${f2(r.more)}), ${r.stance}, muzzle past a jamb ${r.thru}, ring barred ${r.shut} (${r.flick} frames on the way out); ${r.rounds} round(s), the last ${f2(r.len)} m long, ending ${P(r.to)}; back in ${f2(r.backDx)} m off his station` : r.why;
const inRoom = (r: Out) => r.rounds === 1 && r.len > 3 && !!r.to && r.to[2] < WALL_Z - 1;

async function gunSide() {
  console.log('\n=== gun-side: stacked at the jamb on his rifle\'s side, the cursor on a point in the room ===');
  const a = await stepOut(EAST, BREAK ? 0 : LEAN_GUN_M), b = await stepOut(EAST, 0);
  verdict(a.ok && a.lean >= 1 && a.out > 0.63 && a.out <= 0.6 + LEAN_GUN_M + 0.01 && a.stance === 'shoulder' && !a.thru && !a.shut && a.flick === 0 && inRoom(a) && a.backDx < 0.01 && !a.kept && a.onWall,
    'knob on: he steps out further than 0.6 m, the rifle is clear of the jamb, one click sends a round into the room; back in he is on his station', say(a));
  if (!BREAK) verdict(b.ok && Math.abs(b.out - 0.6) < 0.01 && b.thru && b.rounds === 1 && b.len < 0.05 && b.backDx < 0.01 && b.more === 0 && !b.key && !b.kept && b.onWall,
    'knob 0 (the fault as it was): 0.6 m, the muzzle the far side of the jamb from its shoulder, the round ends where it starts; the hold carries no share for the rifle', say(b));
}
async function offSide() {
  console.log('\n=== off-side: the other jamb, the wall on his off side ===');
  const a = await stepOut(WEST, LEAN_GUN_M), b = await stepOut(WEST, 0);
  verdict(a.ok && b.ok && Math.abs(a.out - 0.6) < 0.01 && Math.abs(a.out - b.out) < 0.005 && a.more === 0 && inRoom(a) && inRoom(b) && !a.shut && a.flick === 0 && b.flick === 0,
    'the step-out is 0.6 m with the knob on or at 0, and the round goes into the room either way', `knob on: ${say(a)}\n    knob 0: ${say(b)}`);
}
async function ring() {
  console.log('\n=== ring: the mark is up exactly while no round of his can get out ===');
  const a = await stepOut(EAST, 0, true), b = await stepOut(EAST, 0, false), c1 = await stepOut(EAST, LEAN_GUN_M, true);
  verdict(a.ok && b.ok && c1.ok && a.thru && a.shut && a.flick === 0 && b.thru && !b.shut && !c1.shut && c1.flick === 0,
    'stepped out into the jamb (knob 0): up with the mark on once he is out and not on the way, never with it off; stepped out clear of it (knob on): not up', `mark on ${a.shut} (${a.flick} frames on the way) · mark off ${b.shut} · clear ${c1.shut} (${c1.flick} on the way)`);
  { // stacked, the cursor over the wall he stands on: the rifle stays low (stackUp) and the ring says so
    const S = await quiet(() => world(true)), { g, pl } = S; WALLSNAP.leanGun = LEAN_GUN_M; GUNWALL.mark = true;
    S.place(13.5, 10.8, 270, 'rifle'); S.setCursor([9, 1.2, 10.8]); S.step(10); S.tap('KeyQ'); S.step(60);
    const on = pl.wall?.kind === 'stack'; S.setCursor([13.5, 1.2, 7.5]); S.step(30); const over = gunShut(g); S.setCursor([9.5, 1.2, 11.2]); S.step(30); const along = gunShut(g); S.setCursor(null);
    verdict(on && over && !along, 'stacked mid-wall: the cursor over the wall he is on bars the ring, the cursor down the corridor does not', `stacked ${on} · over the wall ${over} · down the corridor ${along}`);
  }
  { // free along the doorway's face, the rifle wanted up on a point in the room straight ahead of him
    const S = await quiet(() => world(true)), { g, c } = S; const wasOn = GUNWALL.on; GUNWALL.on = true; WALLSNAP.leanGun = LEAN_GUN_M;
    try {
      let shutN = 0, openN = 0, wrong = 0, offUp = 0; const rows: string[] = [];
      for (let x = 10.5; x > 9.69; x -= 0.05) {
        GUNWALL.mark = true; S.place(x, 10.62, 180, 'rifle'); S.setCursor([x, 1.2, 6.5]); S.step(45);
        const shut = gunShut(g); GUNWALL.mark = false; if (gunShut(g)) offUp++; GUNWALL.mark = true;
        const seen = new Set(g.events); S.click(); S.step(13);
        let got = false; for (const e of g.events) if (!seen.has(e) && e.kind === 'shot' && e.from && e.to && e.to[2] < WALL_Z - 1) got = true;
        if (shut === got) wrong++; if (shut) shutN++; else openN++;
        rows.push(`${f2(x)}${shut ? '✕' : '○'}${got ? '' : '·'}${c.anim.longStance === 'lowLong' ? 'v' : ''}`);
      }
      verdict(wrong === 0 && shutN > 0 && openN > 0 && offUp === 0, 'free, stood along the doorway: the ring is barred at every place a click sends no round into the room, and plain at every place it does; never barred with the mark off',
        `${shutN} barred, ${openN} plain, ${wrong} wrong, ${offUp} with the mark off  (x, ✕ barred / ○ plain, · no round in the room, v the rifle held down)\n    ${rows.join(' ')}`);
    } finally { GUNWALL.on = wasOn; S.setCursor(null); }
  }
}
async function harness() {
  console.log('\n=== harness: off on the frozen stand, on in the page; a session file from before the key replays with 0.6 m ===');
  const frozen = harnessProfile() === 'frozen';
  WALLSNAP.leanGun = LEAN_GUN_M; GUNWALL.mark = true; const W: any = await quiet(() => standUp());
  if (frozen) verdict(WALLSNAP.leanGun === 0 && GUNWALL.mark === false && found.lean === 0 && found.mark === false, 'standUp() on the frozen stand puts the step-out\'s knob at 0 and the mark off (both were set before it); the card found both off', `after standUp ${WALLSNAP.leanGun}, mark ${GUNWALL.mark} · found ${found.lean}, mark ${found.mark}`);
  else {
    const Pf: any = await import(`${ROOT}/src/host/profile.ts`), read = (q: string) => { WALLSNAP.leanGun = -1; GUNWALL.mark = !GUNWALL.mark; Pf.pageSwitches(new URLSearchParams(q)); return `${WALLSNAP.leanGun}/${GUNWALL.mark}`; };
    const plain = read(''), a = read('noleangun'), b = read('nogunmark'); read('');
    verdict(found.lean === LEAN_GUN_M && found.mark === true && plain === `${LEAN_GUN_M}/true` && a === '0/true' && b === `${LEAN_GUN_M}/false`,
      'the page\'s stand: the card found both on; the page\'s boot writes them for a plain address, 0 for ?noleangun and the mark off for ?nogunmark', `found ${found.lean}/${found.mark} · plain ${plain} · ?noleangun ${a} · ?nogunmark ${b}`);
  }
  const g = W.game, full = J.knobsSnapshot(g);
  try {
    WALLSNAP.leanGun = LEAN_GUN_M; const old = J.knobsSnapshot(g); delete old.tables.WALLSNAP.leanGun; J.applyKnobs(g, old); const a = WALLSNAP.leanGun;
    WALLSNAP.leanGun = LEAN_GUN_M; const yes = J.knobsSnapshot(g); WALLSNAP.leanGun = 0; J.applyKnobs(g, yes); const b = WALLSNAP.leanGun;
    WALLSNAP.leanGun = 0; const no = J.knobsSnapshot(g); WALLSNAP.leanGun = LEAN_GUN_M; J.applyKnobs(g, no); const c = WALLSNAP.leanGun;
    verdict(a === 0 && b === LEAN_GUN_M && c === 0, 'applyKnobs: a file with no such key → 0; a file recorded with it → as recorded; a file recorded at 0 → 0', `no key ${a} · recorded on → ${b} · recorded 0 → ${c}`);
  } finally { J.applyKnobs(g, full); }
}

/** the whole card (probes.ts 'leangun'): true = every check passed. The knobs are put back as they were found. */
export async function leanGun(): Promise<boolean> {
  const was = { ...WALLSNAP }, wasG = { ...GUNWALL }, rnd = Math.random; allPass = true; found = { lean: WALLSNAP.leanGun, mark: GUNWALL.mark };
  try { await gunSide(); await offSide(); await ring(); await harness(); }
  finally { Object.assign(WALLSNAP, was); Object.assign(GUNWALL, wasG); Math.random = rnd; }
  console.log(`\n=== leangun: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`); return allPass;
}
if (import.meta.main) process.exit(await leanGun() ? 0 : 1);
