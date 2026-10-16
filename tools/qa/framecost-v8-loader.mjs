// framecost under V8 — the module loader (node:module register). The QA harness is written for bun; this lets node (V8, the JavaScript engine the PAGE runs on) load it:
// extensionless imports → .ts, TypeScript transpiled by the typescript package (types dropped, nothing else changed), .wgsl as text, .json as a default export,
// import.meta.main / .path / .dir for the entry. And ONE rewrite, of tools/qa/headless.ts as it loads: W.step bracketed so framecost-v8.mjs can time a frame and Game.update.
// No file on disk is touched; no game code is rewritten.
import { readFileSync, existsSync, statSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as presolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
let ts; for (const p of [process.env.TS_PATH, '/opt/node-tools/node_modules/typescript', join(process.cwd(), 'vendor/typescript'), 'typescript']) { if (!p) continue; try { ts = req(p); break; } catch { } }
if (!ts) throw new Error('framecost-v8: no typescript package found (set TS_PATH)');
const TSOPT = { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, verbatimModuleSyntax: false, isolatedModules: true, useDefineForClassFields: false } };
const CACHE = join(tmpdir(), 'framecost-v8-cache'); mkdirSync(CACHE, { recursive: true });
const ENTRY = process.env.V8_ENTRY ? presolve(process.env.V8_ENTRY) : '';
function bracketStep(src) {
  const a = '      game.update(dt, input, cam, canvas);', e = '      input.endFrame();';
  const i = src.indexOf(a), j = src.indexOf(e, i);
  if (i < 0 || j < 0) { console.error('framecost-v8: W.step not found in headless.ts — no frames will be timed'); return src; }
  return src.slice(0, i) + '      globalThis.__V8FC.b();\n' + a + '\n      globalThis.__V8FC.u();' + src.slice(i + a.length, j) + '      globalThis.__V8FC.e();\n' + src.slice(j);
}
export async function resolve(spec, ctx, next) {
  if ((spec.startsWith('.') || spec.startsWith('/')) && ctx.parentURL?.startsWith('file:')) {
    const base = spec.startsWith('/') ? spec : presolve(dirname(fileURLToPath(ctx.parentURL)), spec);
    for (const c of [base, base + '.ts', base + '/index.ts', base + '.js']) if (existsSync(c) && statSync(c).isFile()) return { url: pathToFileURL(c).href, shortCircuit: true };
  }
  return next(spec, ctx);
}
export async function load(url, ctx, next) {
  if (url.startsWith('file:')) {
    const p = fileURLToPath(url);
    if (p.endsWith('.wgsl')) return { format: 'module', shortCircuit: true, source: 'export default ' + JSON.stringify(readFileSync(p, 'utf8')) + ';' };
    if (p.endsWith('.json')) return { format: 'module', shortCircuit: true, source: 'export default ' + readFileSync(p, 'utf8') + ';' };
    if (p.endsWith('.ts')) {
      let src = readFileSync(p, 'utf8');
      if (/[\\/]tools[\\/]qa[\\/]headless\.ts$/.test(p)) src = bracketStep(src);
      // the light probe's CPU stand-in (headless only — see framecost-hooks.ts X_STANDIN): timed apart so it can be taken out of the frame
      if (!process.env.FC_NOSTANDIN && /[\\/]src[\\/]game[\\/](guards|civilians)\.ts$/.test(p)) src = src.replaceAll(': Math.max(lightEstimateAt(g, pc), lightEstimateAt(g, ph));', ': globalThis.__V8FC.standIn(() => Math.max(lightEstimateAt(g, pc), lightEstimateAt(g, ph)));').replaceAll(': lightEstimateAt(g, at);', ': globalThis.__V8FC.standIn(() => lightEstimateAt(g, at));');
      src = src.replaceAll('import.meta.main', String(p === ENTRY)).replaceAll('import.meta.path', JSON.stringify(p)).replaceAll('import.meta.dirname', JSON.stringify(dirname(p))).replaceAll('import.meta.dir', JSON.stringify(dirname(p)));
      const key = join(CACHE, createHash('sha1').update(p + '\0' + src).digest('hex') + '.js');
      let out;
      if (existsSync(key)) out = readFileSync(key, 'utf8');
      else { out = ts.transpileModule(src, { ...TSOPT, fileName: p }).outputText; const tmp = key + '.' + process.pid; writeFileSync(tmp, out); renameSync(tmp, key); }
      return { format: 'module', shortCircuit: true, source: out };
    }
  }
  return next(url, ctx);
}
