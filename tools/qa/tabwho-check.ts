// 'ORDER WHO' IS NO CHOICE WHILE QUICK ORDERS ARE THE WHOLE SQUAD'S (src/ui/tabkey.ts `TABKEY.whoGone`; game/cmdring.ts `wholeSquad`, `?wholesquad=0`).
// The maintainer, 10-24: "quick Q mode should always do the whole squad. you should only be able to issue commands to parts of the squad in plan mode".
// With that rule on, the orders' who key steps nobody outside plan mode, so Options must not offer a Tab that presses it. Reads the module only: no stand.
//   bun run tools/qa/tabwho-check.ts      (also `probes.ts tabwho`, family ui)
//   as built   with the rule off the five choices are offered and Tab does what was chosen, 'who' too
//   offered    with it on, 'Order who' is not among the choices, with Tab as the back key or not, and no choice's line speaks of who takes an order
//   kept       a machine that kept 'who', and a `?tab=who` visit, get what Tab does where nobody has chosen; the kept choice is not rewritten, and with
//              the rule off again it is 'who' again
//   others     every other choice is what it was under the rule
//   wired      read as text: src/main.ts hands the rule in before the menu is made, and nothing under src reads `TABKEY.does` but tabkey.ts
// TABWHO_BREAK=1 leaves the rule's question unasked (as before this file): 'offered' and 'kept' must FAIL.
// The page's half (Options ▸ Game and ▸ Controls as drawn): tools/qa/tabwho-page.cjs.
const ROOT = new URL('../..', import.meta.url).pathname.replace(/\/$/, '');

export async function tabWhoCheck(): Promise<boolean> {
  const BREAK = process.env.TABWHO_BREAK === '1';
  console.log(`\n=== tabwho: 'Order who' is no choice while quick orders are the whole squad's${BREAK ? ' — TABWHO_BREAK: the rule is not asked' : ''} ===`);
  let all = true; const line = (ok: boolean, label: string, detail = '') => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}${detail ? `\n    ${detail}` : ''}`); };
  const T = await import(`${ROOT}/src/ui/tabkey.ts`), K = T.TABKEY, was = { ...K };
  const set = (kept: string, picked: boolean, first: string) => { K.url = false; K.first = first; T.tabLoad({ tab: kept, tabPicked: picked }); };
  try {
    let rule = false; K.whoGone = () => rule && !BREAK;
    // ---- as built
    set('who', true, 'brief'); const built = T.tabChoices(false).map((c: { v: string }) => c.v);
    line(built.join() === 'off,brief,run,who,keys' && T.tabNow() === 'who', 'as built: with the rule off the five choices are offered and a kept "who" is what Tab does', `${built.join(' ')} · Tab does ${T.tabNow()}`);
    // ---- offered
    rule = true; const a = T.tabChoices(false), b = T.tabChoices(true), said = [...a, ...b].filter((c: { line: string }) => /who takes|order who/i.test(c.line)).map((c: { v: string }) => c.v);
    line(a.map((c: { v: string }) => c.v).join() === 'off,brief,run,keys' && b.map((c: { v: string }) => c.v).join() === 'off,brief,run,keys' && said.length === 0, "offered: with the rule on, 'Order who' is not a choice and no line speaks of it",
      `${a.map((c: { label: string }) => c.label).join(' · ')} | as the back key: ${b.map((c: { label: string }) => c.label).join(' · ')}`);
    // ---- kept
    set('who', true, 'brief'); const k1 = T.tabNow(), stored = JSON.stringify(T.tabKept());
    set('who', true, 'off'); const k2 = T.tabNow();
    K.url = false; T.tabFromQuery(new URLSearchParams('tab=who')); const k3 = T.tabNow(); K.url = false;
    rule = false; set('who', true, 'brief'); const k4 = T.tabNow(); rule = true;
    line(k1 === 'brief' && k2 === 'off' && k3 === 'off' && stored === '{"tab":"who","tabPicked":true}' && k4 === 'who', "kept: a kept 'who' and a ?tab=who visit get what Tab does where nobody has chosen; the kept choice stands, and is 'who' again with the rule off",
      `kept who, first brief: ${k1} · first off: ${k2} · ?tab=who, first off: ${k3} · what is stored: ${stored} · rule off again: ${k4}`);
    // ---- others
    const bad: string[] = []; for (const v of ['off', 'brief', 'run', 'keys']) { set(v, true, 'brief'); if (T.tabNow() !== v) bad.push(`${v} → ${T.tabNow()}`); }
    set('off', false, 'brief'); if (T.tabNow() !== 'brief') bad.push(`nobody chose → ${T.tabNow()}`);
    line(bad.length === 0, 'others: every other choice is what it was under the rule', bad.join(' · ') || 'off, brief, run, keys, and the first choice where nobody chose');
    // ---- wired (the page's half, read as text: this check hands its own whoGone in, so the page's wire is asked for here)
    const { readFileSync, readdirSync } = await import('node:fs'), main = readFileSync(`${ROOT}/src/main.ts`, 'utf8'), at = main.indexOf('TABKEY.whoGone = () => CMDRING.wholeSquad;'), raw: string[] = [];
    const walk = (d: string) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = `${d}/${e.name}`; if (e.isDirectory()) walk(p); else if (e.name.endsWith('.ts') && !p.endsWith('/ui/tabkey.ts')) readFileSync(p, 'utf8').split('\n').forEach((l, i) => { if (/TABKEY\.does\b/.test(l.replace(/\/\/.*$/, ''))) raw.push(`${p.slice(ROOT.length + 1)}:${i + 1}`); }); } };
    walk(`${ROOT}/src`);
    line(at >= 0 && at < main.indexOf('const menu = new Menu(') && raw.length === 0, "wired: the page hands the rule in before the menu is made, and nothing under src reads the raw choice but tabkey.ts", `the wire ${at >= 0 ? 'found' : 'MISSING'} · raw readers: ${raw.join(' ') || 'none'}`);
  } finally { Object.assign(K, was); }
  console.log(`=== tabwho: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}

if (import.meta.main) process.exit((await tabWhoCheck()) ? 0 : 1);
