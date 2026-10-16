// UNLIMITED AMMO COVERS WALL CHARGES (src/game/wallcharge.ts take / giveBack; Game.infiniteAmmo, the sandbox row).
//   bun run tools/qa/probes.ts ammowall        (family `wallcharge`)        AMMOWALL_BREAK=1 = the switch left off where the lines turn it on: must FAIL
// the maintainer, 10-14: "unlimited ammo doesn't apply to wall charges". The switch made magazines, cans, ring airfoils and 40 mm shells bottomless; a wall charge
// still came out of the count. Asked of the count's own two paths — the charges a run carries, and the breaching bag when it carries none — with the switch on
// and off, and of a charge that comes off the wall unblown. Headless; no page, nothing drawn.
import { standUp, ROOT } from './headless.ts';
import { readFileSync } from 'node:fs';
export async function ammowallCheck(): Promise<boolean> {
  const { WALLCHARGE } = await import(`${ROOT}/src/game/wallcharge.ts`);
  const BRK = process.env.AMMOWALL_BREAK === '1'; let all = true;
  const verdict = (ok: boolean, what: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}\n    ${detail}`); };
  console.log(`\n=== ammowall: unlimited ammo covers wall charges${BRK ? ' (the switch left OFF: must fail)' : ''} ===`);
  const W: any = await standUp(); const g = W.game, C = g.wallCharge as any, D = g.doorTools as any, was = g.infiniteAmmo, on = !BRK;
  const spot = { index: 0 } as any, rec = (paid: number, free: boolean) => ({ wall: spot, t: g.time, by: 'Sam', paid, ...(free ? { free: true } : {}) });
  { // the run carries its own
    C.setCarried(2); g.infiniteAmmo = on; const p = [C.take(), C.take(), C.take()], free = C.freeSet, left = C.carried;
    C.giveBack(rec(0, free), 'the check takes it off'); const after = C.carried;
    verdict(p.every((x: number) => x === 0) && free && left === 2 && after === 2, 'unlimited ammo on, two wall charges carried: three are set, the count stays at two — and one that comes off the wall unblown adds none',
      `take() ${p.join(', ')} · carried after three ${left} · after one came off ${after}`);
    C.setCarried(0); const none = C.take();
    verdict(none === -1 && C.carried === 0, 'none carried is still none: the switch makes what he has bottomless, it issues nothing', `take() ${none} · carried ${C.carried}`);
    g.infiniteAmmo = false; C.setCarried(2); const q = C.take(), l1 = C.carried, f1 = C.freeSet; C.giveBack(rec(0, f1), 'the check takes it off'); const l2 = C.carried;
    verdict(q === 0 && l1 === 1 && !f1 && l2 === 2, 'the switch off: one set is one spent, and it comes back off the wall — as it was', `take() ${q} · carried ${l1} → back ${l2}`);
  }
  { // none carried: the breaching bag pays
    C.setCarried(null); const price = Math.max(1, Math.floor(WALLCHARGE.cost)); D.charges = price * 2; const n0 = D.charges;
    g.infiniteAmmo = on; const p = C.take(), n1 = D.charges, free = C.freeSet; C.giveBack(rec(p, free), 'the check takes it off'); const n2 = D.charges;
    g.infiniteAmmo = false; const q = C.take(), n3 = D.charges;
    verdict(p === 0 && free && n1 === n0 && n2 === n0 && q === price && n3 === n0 - price, 'out of the bag: with the switch on the bag is untouched (set, and taken off again); off, a wall costs its price',
      `bag ${n0} → set under the switch ${n1} → off the wall ${n2} · switch off: take() ${q}, bag ${n3} (price ${price})`);
  }
  { const sv = readFileSync(`${ROOT}/src/game/savestate.ts`, 'utf8');
    verdict(/for \(const c of W\.set\) if \(c\.free\) continue;/.test(sv), 'a checkpoint does not count a free charge on the wall back into what he carries (savestate.ts ownCharges)', 'the line asks c.free first'); }
  g.infiniteAmmo = was; C.setCarried(WALLCHARGE.carried);
  console.log(`=== ammowall: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}
