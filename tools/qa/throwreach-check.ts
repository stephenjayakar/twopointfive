// 'throwreach' — THE THROW PREVIEW SHOWS WHAT THE THING WILL REACH (THROWBACK.reach, src/game/throwreach.ts). The maintainer, off a shot of a grenade's arc
// and its small ring: "we should also have kill radius / stun radius when throwing grenades".
//   bun run tools/qa/throwreach-check.ts        (also `probes.ts throwreach`; run it on BOTH stands: TPS_PROFILE=shipped in front for the second)
//   reach     a frag, a stun canister and a smoke aimed down the corridor: the frag hands the overlay the burst's own two radii (FRAG.lethalM, FRAG.woundM)
//             round the point the can comes to REST; the stun canister its dazzle radius there; the smoke nothing. The frag is then thrown by a click and
//             the men stood round the mark are dealt as the rings said: the one inside the kill ring is killed, the one beyond the outer ring untouched.
//             Asking changes nothing in the game. With the rest mark off the rings still sit where the can will rest.
//   launcher  the rifle's 40 mm on an armed arc: the frag's two radii round where the arc ends; an arc too short to arm, and the ring airfoil: nothing.
//   journal   a recording from before the key replays with the rings off; one that carries the key replays as it says.
//   off       the rings off: nothing is handed, with the same arc up.
//   harness   standUp() on the frozen stand holds them off; the page's stand finds them on, and the page's boot writes them (?noreach).
// THROWREACH_BREAK=1 = nothing handed to the overlay: reach must FAIL.   exit 0 = all hold · 1 = one does not
// THE HARNESS HAS NO GPU and no overlay: the rings are not drawn here (tools/qa/throwreach-page.cjs reads them on the page). What is measured is what the
// overlay is handed, and that a burst really reaches what those radii say.
import { standUp, ROOT } from './headless.ts';
import { world } from './wallsnap-probes.ts';
import type { Vec3 } from '../../src/math/vec.ts';

const { THROWBACK } = await import(`${ROOT}/src/game/throwback.ts`);
const { HANDRING } = await import(`${ROOT}/src/game/handring.ts`);
const { WALLSNAP } = await import(`${ROOT}/src/game/wallsnap.ts`);
const { FRAG } = await import(`${ROOT}/src/game/frag.ts`);
const FX = await import(`${ROOT}/src/game/effects.ts`);
const { throwRest } = await import(`${ROOT}/src/game/player.ts`);
const { throwReach } = await import(`${ROOT}/src/game/throwreach.ts`);
const { harnessProfile } = await import(`${ROOT}/src/host/profile.ts`);

const f2 = (n: number) => n.toFixed(2), flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
let allPass = true, found = false;
const verdict = (ok: boolean, label: string, detail: string) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
async function quiet<T>(fn: () => Promise<T>): Promise<T> { const log = console.log; console.log = () => {}; try { return await fn(); } finally { console.log = log; } }
type Kind = 'smoke' | 'flash' | 'frag';
const KEY: Record<Kind, string> = { smoke: 'Digit3', flash: 'Digit4', frag: 'Digit5' };
const FROM: [number, number] = [24, 11.2], AT: Vec3 = [19, 0, 11.2];   // the corridor, five metres down it (throwrest-check.ts's floor)

async function reach() {
  console.log('\n=== reach: what the overlay is handed for the thing in his hand ===');
  const S = await quiet(() => world(true)), { g, pl } = S as any; WALLSNAP.press = false; HANDRING.on = false; FRAG.on = true; THROWBACK.restMark = true; THROWBACK.on = false; THROWBACK.reach = true;
  const aim = (kind: Kind) => { S.place(FROM[0], FROM[1], 270, 'pistol'); g.clearAftermath(); pl.canisters = 3; pl.flashbangs = 3; pl.frags = 3; pl.pendingThrow = null; pl.fireCd = 0; S.step(20); S.setCursor(AT); S.tap(KEY[kind]); S.step(40); };
  const state = () => JSON.stringify([g.items.items.length, pl.char.pos, pl.canisters, pl.flashbangs, pl.frags, g.events.length, g.time]);
  { aim('frag'); const before = state(); let R: any = null; for (let i = 0; i < 5; i++) R = throwReach(g); const same = state() === before, rest = throwRest(g), sol = pl.throwPreview;
    verdict(!!sol && !!rest && !!R && R.kind === 'frag' && R.kill === FRAG.lethalM && R.hurt === FRAG.woundM && R.stun === 0 && flat(R.at, rest.at) < 0.01 && flat(R.at, sol.land) > 0.3 && same,
      'a frag in his hand: the burst\'s own kill radius and the radius it hurts to, round the point the can comes to rest (not its first touch); asking changes nothing', R ? `kill ${R.kill} m · hurt ${R.hurt} m · ${f2(flat(R.at, rest?.at ?? [0, 0, 0]))} m from the rest mark, ${f2(flat(R.at, sol?.land ?? [0, 0, 0]))} m past the first touch · the game ${same ? 'as it was' : 'CHANGED'}` : `nothing handed (arc ${!!sol}, slot ${pl.slot})`);
    THROWBACK.restMark = false; const T = throwReach(g); THROWBACK.restMark = true;
    verdict(!!T && !!rest && flat(T.at, rest.at) < 0.01, 'with the rest mark off the rings still sit where the can will rest (the small ring is then on the first touch, metres short)', T && rest ? `${f2(flat(T.at, rest.at))} m from the rest point · ${f2(flat(T.at, sol.land))} m past the first touch` : 'nothing handed');
    // the burst deals what the rings said: three men stood round the mark, one inside the kill ring, one in the band, one beyond it
    if (R) { const men = g.guards.filter((gd: any) => gd.alive !== false && !gd.dead).slice(0, 3), mark = R.at as Vec3, D = [R.kill - 1.5, (R.kill + R.hurt) / 2, R.hurt + 1.5];   // (stood by the RINGS, not by the table)
      men.forEach((gd: any, i: number) => { gd.hold = true; gd.pinned = true; gd.char.pos = [mark[0] - D[i], 0, mark[2]]; gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.path = []; gd.pathGoal = null; });
      g.godMode = true; S.click(); S.step(Math.ceil((FRAG.fuse + 3) * 60));
      const fate = men.map((gd: any) => (gd.dead || gd.alive === false || gd.state === 'dead' || gd.down ? 'down' : gd.staggerUntil > g.time - 4 ? 'hurt' : 'untouched'));
      verdict(men.length === 3 && fate[0] === 'down' && fate[1] !== 'untouched' && fate[2] === 'untouched', 'the frag thrown by that click deals what the rings said: the man inside the kill ring is down, the man in the band between is hurt or down, the man past the outer ring untouched', men.map((_: any, i: number) => `${f2(D[i])} m: ${fate[i]}`).join(' · ')); } }
  { aim('flash'); const R: any = throwReach(g), rest = throwRest(g);
    verdict(!!R && R.kind === 'flash' && R.stun === FX.bang.dazzleRadius && R.kill === 0 && R.hurt === 0 && !!rest && flat(R.at, rest.at) < 0.01, 'a stun canister: its stun radius (the canister\'s own dazzle radius) round where it comes to rest, no kill ring', R ? `stun ${R.stun} m · kill ${R.kill} · ${f2(flat(R.at, rest?.at ?? [0, 0, 0]))} m from the rest mark` : `nothing handed (slot ${pl.slot})`); }
  { aim('smoke'); const R = throwReach(g);
    verdict(!!pl.throwPreview && R === null, 'a smoke: an arc, and no ring of reach', `arc ${!!pl.throwPreview} · ${R === null ? 'nothing handed' : 'A RING'}`); }
  { aim('frag'); const on = !!throwReach(g); THROWBACK.reach = false; const off = throwReach(g); THROWBACK.reach = true; S.setCursor(null);
    verdict(!!pl.throwPreview && on && off === null, 'the rings off: nothing is handed to the overlay, with the same arc up', `arc ${!!pl.throwPreview} · on ${on} · off ${off === null ? 'null' : 'rings'}`); }
}
async function launcher() {
  console.log('\n=== launcher: the rifle\'s 40 mm, and what has no burst ===');
  const S = await quiet(() => world(true)), { g, pl } = S as any; WALLSNAP.press = false; HANDRING.on = false; FRAG.on = true; THROWBACK.reach = true;
  const { HE40 } = await import(`${ROOT}/src/game/he40.ts`); const was = { ...HE40 }; HE40.on = true;
  // (the launcher's button pressed and kept down: the arc is up while it is)
  const hold = (att: string, at: Vec3) => { S.place(FROM[0], FROM[1], 270, 'rifle'); g.clearAftermath(); const rf = pl.rifle; if (!rf.attachments.includes(att)) rf.attachments.push(att); rf.attIdx = rf.attachments.indexOf(att); rf.shells = 2; rf.rings = 2; pl.fireCd = 0; S.step(20); S.setCursor(at); for (let f = 0; f < 12; f++) { S.input.buttons |= 4; if (f === 0) S.input.clicked |= 4; S.step(1); } const sol = pl.throwPreview, R: any = throwReach(g); return { sol, R, short: previewTooClose(g) }; };
  const { previewTooClose } = await import(`${ROOT}/src/game/he40.ts`);
  const { launchCancel } = await import(`${ROOT}/src/game/player.ts`), let_go = () => { launchCancel(g); for (let f = 0; f < 6; f++) { S.input.buttons |= 4; S.step(1); } S.input.buttons &= ~4; S.step(30); };   // (Esc with the button down: nothing is sent)
  try {
    const far = hold('he40', [FROM[0] - 12, 0, FROM[1]]);
    verdict(!!far.sol && !far.short && !!far.R && far.R.kind === 'he40' && far.R.kill === FRAG.lethalM && far.R.hurt === FRAG.woundM && far.R.stun === 0 && flat(far.R.at, far.sol.land) < 0.01, 'the 40 mm on an armed arc: the frag\'s kill ring and the ring it hurts to, round where the arc ends', far.R ? `kill ${far.R.kill} m · hurt ${far.R.hurt} m · ${f2(flat(far.R.at, far.sol.land))} m from the arc's end` : `nothing handed (arc ${!!far.sol}, too short ${far.short}, up ${pl.rifleUp}, on ${pl.rifle.attachment} ×${pl.rifle.shells})`);
    let_go();
    const near = hold('he40', [FROM[0] - 2, 0, FROM[1]]);
    verdict(!!near.sol && near.short && near.R === null, 'an arc too short to arm (a dud): no ring', `arc ${!!near.sol} · too short ${near.short} · ${near.R === null ? 'nothing handed' : 'A RING'}`);
    let_go();
    const foil = hold('ring', [FROM[0] - 8, 0, FROM[1]]);
    verdict(foil.R === null, 'the sponge round on the same button: no ring', `arc ${!!foil.sol} · ${foil.R === null ? 'nothing handed' : 'A RING'}`);
  } finally { S.input.buttons &= ~4; S.setCursor(null); Object.assign(HE40, was); }
}
async function journal() {
  console.log('\n=== journal: a recording from before the key ===');
  const J: any = await import(`${ROOT}/src/game/journal.ts`), S = await quiet(() => world(true)), g = (S as any).g, full = JSON.parse(JSON.stringify(J.knobsSnapshot(g)));
  try {
    THROWBACK.reach = true; const old = JSON.parse(JSON.stringify(J.knobsSnapshot(g))); delete old.tables.THROWBACK.reach; J.applyKnobs(g, old); const before = THROWBACK.reach;
    THROWBACK.reach = true; const yes = JSON.parse(JSON.stringify(J.knobsSnapshot(g))); THROWBACK.reach = false; J.applyKnobs(g, yes); const carried = THROWBACK.reach;
    verdict(before === false && carried === true, 'a recording with no such key replays with the rings off; one that carries the key replays as it says', `before the key ${before} · carried on ${carried}`);
  } finally { J.applyKnobs(g, full); }
}
async function harness() {
  console.log('\n=== harness: off on the frozen stand, on in the page ===');
  const frozen = harnessProfile() === 'frozen';
  THROWBACK.reach = true; await quiet(() => standUp());
  if (frozen) verdict(THROWBACK.reach === false && found === false, 'standUp() on the frozen stand puts the rings off (they were set before it); the card found them off', `after standUp ${THROWBACK.reach} · found ${found}`);
  else {
    const Pf: any = await import(`${ROOT}/src/host/profile.ts`), read = (q: string) => { THROWBACK.reach = !THROWBACK.reach; Pf.pageSwitches(new URLSearchParams(q)); return THROWBACK.reach; };
    const plain = read(''), off = read('noreach'); read('');
    verdict(found === true && plain === true && off === false && THROWBACK.reach === true, 'the page\'s stand: the card found the rings on; the page\'s boot writes them on for a plain address and off for ?noreach', `found ${found} · plain ${plain} · ?noreach ${off}`);
  }
}

/** the whole card (probes.ts 'throwreach'): true = every check passed. The knobs are put back as they were found. */
export async function throwReachCheck(): Promise<boolean> {
  const was = { tb: { ...THROWBACK }, ring: HANDRING.on, ws: { ...WALLSNAP }, frag: FRAG.on, rnd: Math.random }; allPass = true; found = THROWBACK.reach;
  try { await reach(); await launcher(); await journal(); await harness(); }
  finally { Object.assign(THROWBACK, was.tb); HANDRING.on = was.ring; Object.assign(WALLSNAP, was.ws); FRAG.on = was.frag; Math.random = was.rnd; }
  console.log(`\n=== throwreach: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`); return allPass;
}
if (import.meta.main) process.exit(await throwReachCheck() ? 0 : 1);
