// PLAN MODE'S CIRCLES ARE FAINTER, AND A SLIDER SETS THEM (src/ui/planlook.ts; ui/cmdring.ts updatePlan; index.html `.planmode .pm` / `.pself`;
// ui/options.ts Game > "Plan mode circles"). The maintainer, 10-24: "plan mode circles should be fainter -- can you add a slider in the settings".
//   bun run tools/qa/planlook-check.ts            (also `probes.ts planlook`, in family ui)
// PASS / FAIL each, headless. A PICTURE ONLY: no game is stood up, so both stands ask the same lines of the same files. What it cannot see is the
// picture: `PORT=<port> node tools/qa/planlook-page.cjs` reads the drawn circles' own opacity on the real page.
//   1. a page nobody has chosen on draws the circles fainter than they were built, and a picked man's circle fainter than an unpicked one was.
//   2. what this machine kept is what a page opens with; a visit's `?planrings=` holds over it; a word that is no number is nobody's choice; a value
//      is held inside 0 to 1.
//   3. the look reads it: each circle's rule in index.html (a man's, a picked man's, the player's own) is its built strength times `--pm-k`, and
//      ui/cmdring.ts writes `--pm-k` from planRings on plan mode's layer.
//   4. the settings page has the row, it sets and keeps the value, and Reset to defaults puts the page's back.
//   5. CONTROL — `?planrings=1` is the look as it was built.
// PLANLOOK_BREAK=1 = the same lines asked of a visit with `?planrings=1` (the look as it was): 1 and 2 must fail.
//   exit 0 = all hold · 1 = one does not
import { readFileSync } from 'node:fs';
import { ROOT } from './headless.ts';

const BREAK = process.env.PLANLOOK_BREAK === '1';

export async function planlookCheck(): Promise<boolean> {
  let fails = 0;
  const line = (ok: boolean, what: string, got: string) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what} — ${got}`); if (!ok) fails++; };
  const L: any = await import(`${ROOT}/src/ui/planlook.ts`);
  const visit = BREAK ? '?planrings=1' : '';
  const from = (search: string, kept: string | null) => L.planRingsFrom(BREAK && !/planrings/.test(search) ? `${search}${search ? '&' : '?'}planrings=1` : search, kept);
  const html = readFileSync(`${ROOT}/index.html`, 'utf8'), layer = readFileSync(`${ROOT}/src/ui/cmdring.ts`, 'utf8'), opts = readFileSync(`${ROOT}/src/ui/options.ts`, 'utf8');
  /** a rule's built strength, where the rule is that strength times the look's own factor (null: it is not) */
  const built = (sel: string): number | null => { const i = html.indexOf(sel + ' {'); if (i < 0) return null; const m = /opacity: calc\(([0-9.]+) \* var\(--pm-k, 1\)\)/.exec(html.slice(i, html.indexOf('}', i))); return m ? Number(m[1]) : null; };
  const man = built('.planmode .pm'), picked = built('.planmode .pm.picked'), self = built('.planmode .pself');

  // 1
  { const P = L.planRingsFrom(visit, null), k = P.rings;
    line(k > 0 && k < 1 && man !== null && picked !== null && picked * k < man, '1. a page nobody has chosen on draws the circles fainter than built, a picked man\'s fainter than an unpicked one was',
      `strength ${k} of 1 · a man's ${man} → ${man === null ? '?' : (man * k).toFixed(3)} · a picked man's ${picked} → ${picked === null ? '?' : (picked * k).toFixed(3)}`); }
  // 2
  { const kept = from('', '{"rings":0.3}'), url = L.planRingsFrom('?planrings=0.8', '{"rings":0.3}'), junk = from('?planrings=abc', 'not json'), big = L.planRingsFrom('?planrings=7', null), neg = from('', '{"rings":-2}');
    line(kept.rings === 0.3 && !kept.url && url.rings === 0.8 && url.url && junk.rings === L.PLANLOOK_PAGE && !junk.url && big.rings === 1 && neg.rings === 0,
      '2. the machine\'s kept value opens the page, a visit\'s word holds over it, a word that is no number chooses nothing, a value stays inside 0 to 1',
      `kept 0.3 → ${kept.rings} · ?planrings=0.8 over it → ${url.rings} (the visit's: ${url.url}) · 'abc' and a broken store → ${junk.rings} · 7 → ${big.rings} · kept -2 → ${neg.rings}`); }
  // 3
  { const writes = /const k = planRings\(\)\.toFixed\(2\)/.test(layer) && /this\.plan\.style\.setProperty\('--pm-k', k\)/.test(layer);
    line(man === 0.6 && picked === 0.95 && self === 0.95 && writes, '3. each circle\'s rule is its built strength times --pm-k, and plan mode\'s layer writes --pm-k from planRings',
      `a man's ${man} · a picked man's ${picked} · the player's own ${self} · the layer writes it: ${writes}`); }
  // 4
  { const row = /range\(body, 'Plan mode circles', 0, 100, 5, \(\) => Math\.round\(planRings\(\) \* 100\), v => setPlanRings\(v \/ 100\)/.test(opts), reset = /findReset\(\); resetPlanRings\(\);/.test(opts);
    const store = new Map<string, string>(), had = (globalThis as any).localStorage;
    (globalThis as any).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); }, removeItem: (k: string) => { store.delete(k); } };
    let set = -1, keptJson = '', back = -1, left = 0;
    try { L.setPlanRings(0.25); set = L.planRings(); keptJson = [...store.values()][0] ?? ''; L.resetPlanRings(); back = L.planRings(); left = store.size; }
    finally { if (had === undefined) delete (globalThis as any).localStorage; else (globalThis as any).localStorage = had; }
    line(row && reset && set === 0.25 && L.planRingsFrom('', keptJson).rings === 0.25 && back === L.PLANLOOK_PAGE && left === 0, '4. the settings page has the row, it sets and keeps the value, and Reset to defaults puts the page\'s back',
      `the row: ${row} · Reset calls it: ${reset} · set 0.25 → ${set}, kept ${keptJson || 'nothing'} · after Reset ${back}, ${left} kept`); }
  // 5
  { const P = L.planRingsFrom('?planrings=1', '{"rings":0.3}');
    line(P.rings === 1 && P.url && L.PLANLOOK.rings !== undefined, '5. CONTROL — ?planrings=1 is the look as it was built', `strength ${P.rings}, the visit's own: ${P.url}`); }

  console.log(fails ? `=== planlook-check: ${fails} FAIL ===` : '=== planlook-check: ALL PASS ===');
  return !fails;
}

if (import.meta.main) process.exit((await planlookCheck()) ? 0 : 1);
