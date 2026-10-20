// A MODULE'S TEXT CUT TO WHAT IT USES (src/gpu/wgslTrim.ts SHADER_TRIM): the rule held to the shaders the engine boots with. The Engine is built on a stand-in
// device that records every module's text, once whole (?shadertrim=0) and once cut, and for each module:
//   · every declaration left is one of the whole text's, comments aside, in the same order
//   · every entry point, override, directive and const_assert of the whole text is left
//   · nothing left mentions a declaration that was dropped (the cut is closed under 'mentions')
//   · cutting the cut text changes nothing
// then the two numbers the cut is for: how much text a boot hands the browser, and how many modules' texts change when a level's weather switch flips (each one
// is a text the browser's compiled-shader cache has never seen).
// No browser and no compiler: that the cut text COMPILES is the page's boot to say (tools/qa/shader-count-page.cjs — every pipeline made, no GPU error).
//   bun run tools/qa/shadertrim-check.ts             exit 0 = every check passed, 1 = one failed
//   SHADERTRIM_BREAK=1 bun run tools/qa/shadertrim-check.ts     a declaration something still mentions is taken out of one cut text: must FAIL
export {};
const { ROOT, fake } = await import('./headless.ts');
const { Engine } = await import(`${ROOT}/src/engine.ts`);
const { SHADER_TRIM, trimWgsl, wgslDecls, trimTotals } = await import(`${ROOT}/src/gpu/wgslTrim.ts`) as typeof import('../../src/gpu/wgslTrim');
const { weatherKindConfig } = await import(`${ROOT}/src/render/frame.ts`);

const BREAK = process.env.SHADERTRIM_BREAK === '1';
let red = 0; const check = (ok: boolean, what: string) => { console.log(`${ok ? '- PASS' : '- FAIL'} — ${what}`); if (!ok) red++; };

/** the texts one boot of the Engine hands createShaderModule, by label in the order made */
async function boot(): Promise<{ label: string; code: string }[]> {
  const mods: { label: string; code: string }[] = [];
  const pipe = () => new Proxy({}, { get: (_t, k) => k === 'then' ? undefined : fake(String(k)) });
  const base = fake('device');
  const device = new Proxy(base, { get(t, k) {
    if (k === 'createShaderModule') return (d: { code: string; label?: string }) => { mods.push({ label: d.label ?? '', code: d.code }); return { getCompilationInfo: async () => ({ messages: [] }) }; };
    if (k === 'createComputePipelineAsync' || k === 'createRenderPipelineAsync') return async () => pipe();
    if (k === 'limits') return new Proxy({}, { get: () => 1 << 20 });
    if (k === 'then') return undefined;
    return t[k]; } });
  const e = new Engine({ device, adapterInfo: 'stand-in', canvas: fake('canvas'), ctx: fake('ctx'), format: 'bgra8unorm', hasTimestamps: false, linearSampler: fake('sampler') } as never);
  await Promise.race([e.init({ sharp: true, gbaa: true }), new Promise(r => setTimeout(r, 2000))]);
  return mods;
}
const WORD = /[A-Za-z_][A-Za-z0-9_]*/g;
const nameOf = (d: string): string | null => { const m = /^(?:\s*@[A-Za-z_]\w*(?:\s*\((?:[^()]|\([^()]*\))*\))?)*\s*(fn|struct|alias|const|override|var)\b\s*(?:<[^>]*>)?\s*([A-Za-z_]\w*)/.exec(d); return m ? m[2] : null; };
const isRoot = (d: string) => nameOf(d) === null || /^(?:\s*@[A-Za-z_]\w*(?:\s*\((?:[^()]|\([^()]*\))*\))?)*\s*override\b/.test(d) || /@(compute|vertex|fragment)\b/.test(d.slice(0, d.indexOf('fn ') < 0 ? 0 : d.indexOf('fn ')));

SHADER_TRIM.on = false; const whole = await boot();
SHADER_TRIM.on = true; trimTotals.modules = trimTotals.before = trimTotals.after = trimTotals.ms = 0; const cut = await boot(); const totals = { ...trimTotals };
check(whole.length >= 30 && whole.length === cut.length && whole.every((m, i) => m.label === cut[i].label), `the same ${whole.length} modules either way (${cut.length} cut)`);
let entries = 0; const bad = { order: [] as string[], roots: [] as string[], open: [] as string[], twice: [] as string[] };
cut.forEach((m, i) => {
  const W = wgslDecls(whole[i].code); let C = wgslDecls(m.code);
  if (BREAK && i === 3) { const names = new Set(C.map(nameOf)); const k = C.findIndex(d => { const n = nameOf(d); return n !== null && !isRoot(d) && C.some(o => o !== d && ((o.match(WORD) ?? []) as string[]).includes(n)) && names.has(n); }); C = C.filter((_, j) => j !== k); }
  // in the whole text's order, each one of its declarations
  let at = 0; const inOrder = C.every(d => { const k = W.indexOf(d, at); if (k < 0) return false; at = k + 1; return true; }); if (!inOrder) bad.order.push(m.label);
  const kept = new Set(C); const roots = W.filter(isRoot); entries += roots.filter(d => /@(compute|vertex|fragment)\b/.test(d)).length;
  if (!roots.every(d => kept.has(d))) bad.roots.push(m.label);
  const have = new Set(C.map(nameOf)); const all = new Set(W.map(nameOf)); all.delete(null);
  if (C.some(d => (d.match(WORD) ?? []).some(w => all.has(w) && !have.has(w)))) bad.open.push(m.label);
  if (trimWgsl(m.code) !== m.code) bad.twice.push(m.label);
});
check(bad.order.length === 0, `every declaration left is the whole text's own, in its order${bad.order.length ? ` — not so: ${bad.order.slice(0, 5).join(', ')}` : ''}`);
check(bad.roots.length === 0 && entries >= 60, `every entry point, override, directive and const_assert is left (${entries} entry points)${bad.roots.length ? ` — not so: ${bad.roots.slice(0, 5).join(', ')}` : ''}`);
check(bad.open.length === 0, `nothing left mentions a declaration that was dropped${bad.open.length ? ` — not so: ${bad.open.slice(0, 5).join(', ')}` : ''}`);
check(bad.twice.length === 0, `cutting a cut text changes nothing${bad.twice.length ? ` — not so: ${bad.twice.slice(0, 5).join(', ')}` : ''}`);
const kb = (n: number) => Math.round(n / 1024);
check(totals.after < totals.before * 0.4, `a boot of the Engine hands the browser ${kb(totals.after)} KB of shader text where it handed ${kb(totals.before)} KB (${Math.round(100 - 100 * totals.after / totals.before)} % less; ${totals.ms.toFixed(0)} ms spent cutting ${totals.modules} modules here)`);
// a level in another weather: how many module texts are new
const flip = async (on: boolean) => { SHADER_TRIM.on = on; const was = weatherKindConfig.on; weatherKindConfig.on = false; const a = await boot(); weatherKindConfig.on = true; const b = await boot(); weatherKindConfig.on = was; return a.filter((m, i) => m.code !== b[i].code).length; };
const newWhole = await flip(false), newCut = await flip(true);
check(newWhole === whole.filter(m => /\bWX_KINDS\b/.test(m.code)).length && newCut < newWhole / 2, `a level whose weather switch differs: ${newCut} of ${cut.length} module texts are new to the browser where ${newWhole} were`);
console.log(red ? `${red} FAILED` : 'all passed');
process.exit(red ? 1 : 0);
