// PLAN MODE'S REACH IS THE SAME AT ANY ZOOM (src/game/planmode.ts pan, CMDRING.planNearFlat). The maintainer, 10-25: "max distance for plan mode
// seems to be based on the zoom level? should be zoom invaraitn".
//   bun run tools/qa/plannearflat-check.ts            (also `probes.ts plannearflat`, in family squadorders)
//   TPS_PROFILE=shipped bun run tools/qa/plannearflat-check.ts      — the same lines on the page's stand
// PASS / FAIL each, headless, on planmode-check's rig with the view held near him (planNear) and this switch raised here, so both stands ask the same
// lines (the room clear on the office, its squad of four; ONE deal, seed 3: the rule has no die in it). The reach is how far the view's point goes
// from him with a walk key held, in the camera's own basis.
//   1. to the side, up the screen and down it, the view goes as far with the camera at 8, 12 and 21 as it does at 40: the box's own metres.
//   2. zoomed in, the corner is the same corner, and he has not moved.
//   3. CONTROL — the switch off: with the camera at 12 of its 21 the reach is that much shorter, as the box was built.
//   4. CONTROL (plumbing) — a recording from before the key replays with it off; the frozen stand holds it off, the page's has it on, FROZEN_HOLDS has its row.
// PLANNEARFLAT_BREAK=1 = the switch left off and the same lines asked: 1 and 2 must fail.
//   exit 0 = all hold · 1 = one does not
import { ROOT, standUp } from './headless.ts';
import { rig } from './planmode-check.ts';

const { CMDRING } = await import(`${ROOT}/src/game/cmdring.ts`);
const { knobsCopy, knobsBack } = await import(`${ROOT}/src/game/knobs.ts`);
const { applyKnobs, knobsSnapshot } = await import(`${ROOT}/src/game/journal.ts`);
const { FROZEN_HOLDS } = await import(`${ROOT}/src/host/profile.ts`);
const BREAK = process.env.PLANNEARFLAT_BREAK === '1';
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);

export async function plannearflatCheck(): Promise<boolean> {
  let fails = 0;
  const line = (ok: boolean, what: string, got: string) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what} — ${got}`); if (!ok) fails++; };
  const knobs0 = knobsCopy(), rnd0 = Math.random, K = CMDRING;
  console.log(`plan mode's reach at any zoom (src/game/planmode.ts pan, CMDRING.planNearFlat)${BREAK ? ' — PLANNEARFLAT_BREAK=1: the switch left off, lines 1 and 2 must fail' : ''}`);
  try {
    await standUp(); const stood = !!K.planNearFlat;   // (the stand's own word, before the rig holds anything)
    const R: any = await rig(3, true, true), g = R.game, O = R.O, P = O.plan, pl = g.player, I = R.input, cam = R.W.cam;
    const hold = (keys: string[], frames: number) => { for (const k of keys) I.keys.add(k); R.step(frames); for (const k of keys) I.keys.delete(k); R.step(); };
    const zoom = (d: number) => { cam.distance = cam.desiredDistance = d; };
    const home = () => { zoom(21); R.home(true); if (P.look) { P.look[0] = pl.char.pos[0]; P.look[2] = pl.char.pos[2]; } R.step(40); };
    /** the view's point from him, in the camera's basis: [across the screen, up it] */
    const rf = (): [number, number] => { const B = cam.planarBasis(), L = P.look ?? pl.char.pos, dx = L[0] - pl.char.pos[0], dz = L[2] - pl.char.pos[2]; return [dx * B.right[0] + dz * B.right[2], dx * B.fwd[0] + dz * B.fwd[2]]; };
    const near = (a: number, b: number) => Math.abs(a - b) < 0.02;
    /** the reach one way with the camera at `d`: the key held, the camera kept there, the view's point read */
    const reach = (keys: string[], d: number): [number, number] => { home(); zoom(d); R.step(30); for (let i = 0; i < 6; i++) { hold(keys, 50); zoom(d); } R.step(30); return rf(); };
    const S = K.planNearSideM, A = K.planNearAwayM, Bk = K.planNearBackM, ZOOMS = [8, 12, 21, 40];

    // 1
    K.planNearFlat = !BREAK;
    { const rows: string[] = []; let ok = P.up !== undefined;
      for (const d of ZOOMS) { const side = reach(['KeyD'], d)[0], up = reach(['KeyW'], d)[1], down = reach(['KeyS'], d)[1];
        ok &&= near(side, S) && near(up, A) && near(down, -Bk); rows.push(`at ${d}: ${side.toFixed(2)} across, ${up.toFixed(2)} up, ${(-down).toFixed(2)} down`); }
      line(ok, `1. the view goes ${S} m across, ${A} m up the screen and ${Bk} m down it from him with the camera at ${ZOOMS.join(', ')}`, rows.join(' · ')); }
    // 2
    { const p0 = [...pl.char.pos], c = reach(['KeyW', 'KeyD'], 8), moved = dist(pl.char.pos, p0);
      line(near(c[0], S) && near(c[1], A) && moved < 0.05, '2. zoomed in, the corner is the same corner, and he has not moved', `the camera at 8: ${c[0].toFixed(2)} across, ${c[1].toFixed(2)} up · he moved ${moved.toFixed(2)} m`); }
    // 3
    K.planNearFlat = false;
    { const side = reach(['KeyD'], 12)[0], full = reach(['KeyD'], 21)[0], want = S * 12 / 21;
      line(near(side, want) && near(full, S), '3. CONTROL — the switch off: with the camera at 12 of its 21 the reach is that much shorter', `at 12: ${side.toFixed(2)} across (the box as built: ${want.toFixed(2)}) · at 21: ${full.toFixed(2)}`); }
    R.home(false);
    // 4
    { K.planNearFlat = true; const snap = JSON.parse(JSON.stringify(knobsSnapshot(g))), old = JSON.parse(JSON.stringify(snap)); delete old.tables.CMDRING.planNearFlat;
      applyKnobs(g, old); const before = K.planNearFlat; applyKnobs(g, snap); const on = K.planNearFlat;
      const shipped = String(process.env.TPS_PROFILE ?? '') === 'shipped', row = FROZEN_HOLDS['CMDRING.planNearFlat'];
      line(before === false && on === true && stood === shipped && /TPS_PLANNEARFLAT=1/.test(row ?? ''), '4. CONTROL (plumbing) — a recording from before the key replays with it off; the stands and the FROZEN_HOLDS row',
        `a file without the key: ${before} · one with it on: ${on} · this stand (${shipped ? 'the page\'s' : 'frozen'}) stood it ${stood} · the row: ${row ?? 'none'}`); }
  } finally { knobsBack(knobs0); Math.random = rnd0; }

  console.log(fails ? `=== plannearflat-check: ${fails} FAIL ===` : '=== plannearflat-check: ALL PASS ===');
  return !fails;
}

if (import.meta.main) process.exit((await plannearflatCheck()) ? 0 : 1);
