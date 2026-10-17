// THE BOTTOM LAYER OF A PILE A BLOWN HOLE TAKES GOES WITH IT — the check behind FURN.mouth.base (src/game/furnblast.ts mouth; on in the page, ?holebase=0;
// off in the module and on the frozen stand, TPS_HOLEBASE=1; acts only with FURN.mouth.on).
//   bun run tools/qa/probes.ts holebase        (family `furnblast`)        HOLEBASE_BREAK=1 = the rule off and the same lines asked: must FAIL
// the maintainer, 10-17, of two wall charges on the pass (levels/pass.json): "one set of guys couldn't pathfind through the wall breach". The store keeps sacks
// in piles against that wall, each layer 0.2 m thick. The blast took the layers above and left the bottom one lying in the hole: the hole rule passes over
// what is no higher than a step (top at or under 0.2 m), and the furniture's own bands never list a thing that low. The feet's side of it is UNDERFOOT
// (collision.ts, its own check `underfoot`); this is the blast's side.
// THE SITE: his own (the store's outer wall by the floor point 31.3, 5.0, set from the yard side), on a fresh stand of the level with the page's destruction
// switches: a charge set as the order sets it and blown as F blows it. Then what is left of the two piles by the hole, read off the level's own boxes.
// THE BARS, on the same site with the piles reshaped by the check before the level stands: the right pile's bottom layer made a MAT (0.06 m thick, under the rule's baseThick, the layers
// above let down onto it) and a thing the hole rule never takes (a block up past its height bar) stood on the left pile's bottom layer. Both bottom layers
// must stay. The low bank at the wall's foot (top 0.17 m, nothing on it) must stay at every site.
import { readFileSync } from 'node:fs';
import { standUp, ROOT } from './headless.ts';
type Vec3 = [number, number, number];
export async function holeBaseCheck(): Promise<boolean> {
  const BRK = process.env.HOLEBASE_BREAK === '1'; let all = true;
  const verdict = (ok: boolean, what: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}\n    ${detail}`); };
  console.log(`\n=== holebase: the bottom layer of a pile a blown hole takes goes with it${BRK ? ' (the rule off: must fail)' : ''} ===`);
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`); const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { FURN } = await import(`${ROOT}/src/game/furnblast.ts`); const { DESTRUCTION, FURNBLAST } = await import(`${ROOT}/src/game/destructionSwitch.ts`);
  const { WALLCHARGE, wallAt } = await import(`${ROOT}/src/game/wallcharge.ts`); const { BoxFlag } = await import(`${ROOT}/src/scene/boxes.ts`) as any;
  const { knobsSnapshot, applyKnobs } = await import(`${ROOT}/src/game/journal.ts`); const { FROZEN_HOLDS } = await import(`${ROOT}/src/host/profile.ts`);
  const was = { d: DESTRUCTION.on, f: FURNBLAST.on, m: FURN.mouth.on, s: FURN.mouth.snow, b: FURN.mouth.base, w: WALLCHARGE.on, o: WALLCHARGE.outer }, log = console.log;
  const data = readFileSync(`${ROOT}/levels/pass.json`, 'utf8'), GONE = BoxFlag.NoPrimary | BoxFlag.NoShadow;
  const raise = (rule: boolean) => { DESTRUCTION.on = true; FURNBLAST.on = true; FURN.mouth.on = true; FURN.mouth.snow = true; FURN.mouth.base = rule && !BRK; WALLCHARGE.on = true; WALLCHARGE.outer = true; };
  const at: Vec3 = [31.3, 0, 5.0], from: Vec3 = [31.3, 0, 3.6];
  /** the two piles by his hole and the bank at the wall's foot, by where the level puts them */
  const near = (b: any) => Math.abs(b.c[0] - 30.8) < 1.3 && b.c[2] > 5.2 && b.c[2] < 6.3 && b.h[0] < 0.5 && b.h[2] < 0.5 && b.c[1] + b.h[1] < 1.0;
  const sack = (b: any) => near(b) && Math.abs(b.h[1] - 0.1) < 0.02, base = (b: any) => near(b) && b.c[1] - b.h[1] < 0.02, right = (b: any) => b.c[0] > 30.9;
  const bank = (b: any) => Math.abs(b.c[0] - 30.6) < 0.2 && Math.abs(b.c[2] - 4.63) < 0.1 && b.h[0] > 2 && b.c[1] + b.h[1] < 0.2;
  const blown = async (rule: boolean, edit?: (L: any) => void) => { raise(rule); console.log = () => { };
    try { const L: any = loadLevel(parseLevelData(data)); edit?.(L); const W: any = await standUp({ level: L, seed: 1 }); raise(rule); const g = W.game; g.godMode = true; g.aiEnabled = false; g.tune.chaos = 0.5; for (let i = 0; i < 4; i++) W.step(1 / 60);
      const boxes: any[] = g.col.boxes, piles = boxes.filter(near), n0 = piles.length, b0 = piles.filter(base), bk = boxes.find(bank);
      const w = wallAt(g, at, from); if (!w || !w.ok) return null;
      g.wallCharge.set.push({ wall: w, t: g.time, by: 'probe', paid: 0 }); const res: any = g.wallCharge.blow(g.wallCharge.set[g.wallCharge.set.length - 1]); for (let i = 0; i < 60; i++) W.step(1 / 60);
      const stays = (b: any) => !(b.flags & GONE);
      return { g, hole: !!res?.hole, n0, bases: b0.length, left: piles.filter(stays).length, baseLeft: b0.filter(stays).length, baseLeftR: b0.filter(b => right(b) && stays(b)).length, baseLeftL: b0.filter(b => !right(b) && stays(b)).length,
        above: piles.filter(b => !base(b)).length, aboveLeft: piles.filter(b => !base(b) && stays(b)).length, aboveLeftR: piles.filter(b => !base(b) && right(b) && stays(b)).length, aboveGoneL: piles.filter(b => !base(b) && !right(b) && !stays(b)).length, bank: !!bk, bankStays: !!bk && stays(bk), tall: boxes.filter(b => near({ ...b, c: [b.c[0], 0.3, b.c[2]], h: [b.h[0], 0.1, b.h[2]] }) && b.c[1] + b.h[1] > 2.3 && stays(b)).length };
    } finally { console.log = log; } };
  try {
    // (1) his breach, the rule on and off
    const on = await blown(true), off = await blown(false);
    if (!on || !off) verdict(false, "the store's outer wall takes a charge where his was set", 'no wall place there: the level changed, and this check needs its site again');
    else {
      verdict(on.hole && on.n0 >= 12 && on.bases === 4 && on.left === 0 && on.bankStays && off.hole && off.baseLeft === 4 && off.aboveLeft === 0 && off.bankStays,
        'his breach: with the rule on nothing of the two sack piles is left by the hole, bottom layer included; with it off the four bottom sacks lie there as they did; the low bank at the wall\'s foot, which carried nothing, stays either way',
        `rule on: a hole ${on.hole} · ${on.n0} sacks in the two piles, ${on.bases} of them the bottom layer → left ${on.left} (bottom layer ${on.baseLeft}) · the bank stays ${on.bankStays} · rule off: a hole ${off.hole} · left ${off.left} (bottom layer ${off.baseLeft}, above it ${off.aboveLeft}) · the bank stays ${off.bankStays}`);
      // (2) the bars: a mat, and a low thing with something on it the rule never takes
      const bars = await blown(true, (L: any) => { const bx: any[] = L.boxes, pile = bx.filter(sack);
        for (const b of pile.filter(right)) { if (base(b)) { b.c[1] = 0.03; b.h[1] = 0.03; } else b.c[1] -= 0.14; }   // the right pile: its bottom layer a mat, the rest let down onto it
        const up = pile.filter(b => !right(b) && Math.abs(b.c[1] - 0.3) < 0.02)[0]; if (up) { up.h[1] = 1.2; up.c[1] = 1.4; } });   // the left pile: a block from 0.2 m up past the rule's height bar on its bottom layer
      if (!bars) verdict(false, 'the bars: the same wall takes the charge with the piles reshaped', 'no wall place there');
      else verdict(bars.hole && bars.baseLeftR === 2 && bars.aboveLeftR === 0 && bars.baseLeftL === 2 && bars.aboveGoneL >= 1 && bars.tall === 1 && bars.bankStays,
        'the bars: a mat that carried a taken thing stays (no body to it), and a low thing stays with what stands on it when that is a thing the hole rule never takes',
        `a hole ${bars.hole} · the right pile's bottom layer made 0.06 m thick, the layers above it left ${bars.aboveLeftR}: of its 2, ${bars.baseLeftR} stay · the left pile's bottom layer under a block up to 2.6 m and ${bars.aboveGoneL} sack(s) the blast took: of its 2, ${bars.baseLeftL} stay, the block stays ${bars.tall === 1} · the bank stays ${bars.bankStays}`);
      // (3) the switch
      { FURN.mouth.base = true; const g = on.g, snap: any = JSON.parse(JSON.stringify(knobsSnapshot(g))), has = typeof snap.tables?.FURN?.mouth?.base === 'boolean'; const old = JSON.parse(JSON.stringify(snap)); delete old.tables.FURN.mouth.base;
        console.log = () => { }; let offOld = false; try { applyKnobs(g, old); offOld = FURN.mouth.base === false; applyKnobs(g, snap); offOld &&= FURN.mouth.base === true; } finally { console.log = log; }
        verdict(has && offOld && typeof FROZEN_HOLDS['FURN.mouth.base'] === 'string' && /TPS_HOLEBASE=1/.test(FROZEN_HOLDS['FURN.mouth.base']), 'a recording carries the switch, one from before the key replays with it off, and the frozen stand holds it off by name',
          `in the file ${has} · off for an old file ${offOld} · FROZEN_HOLDS ${FROZEN_HOLDS['FURN.mouth.base']}`); }
    }
  } finally { DESTRUCTION.on = was.d; FURNBLAST.on = was.f; FURN.mouth.on = was.m; FURN.mouth.snow = was.s; FURN.mouth.base = was.b; WALLCHARGE.on = was.w; WALLCHARGE.outer = was.o; console.log = log; }
  console.log(`=== holebase: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}
