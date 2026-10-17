// THE GAME'S OWN MATHS (src/math/exact.ts): do sin, cos, atan2 and the rest come out the same to the bit on every JavaScript engine, and near enough to true?
//   bun run tools/qa/exact-check.ts                 every check below; exit 0 = all pass, 1 = one failed (named)
//   EXACT_BREAK=1 bun run tools/qa/exact-check.ts   the red path: the node child folds the ENGINE's sine where the game's own belongs — 'engines' must then FAIL
// Whole fights across two engines are tools/qa/coop-check.ts (minutes); this is the functions themselves (seconds).
// WHAT IS HELD:
//   engines    one fixed stream of inputs through all fourteen functions, every answer's raw bits folded into one word — under bun (JavaScriptCore) and under
//              node (V8, the engine Chrome runs the page on) the word is the same. No node on the machine = that is said, and the line does not pass.
//   close      each function against this engine's own over the ranges the game uses: never further than a few units in the last place (the bound per function
//              is in BOUND below, with the measured worst printed)
//   corners    zeros of both signs, the infinities, NaN, the ends of each domain: the same kind of answer as the engine's (NaN where it gives NaN, the same
//              infinity, the same zero), and the language's own rules for pow's corners
//   switch     EXACT.on = true puts the fourteen in Math's place and the lengths of math/hyp.ts on the Kahan sum; false puts back the very functions that were
//              there; a constant made at load (onExact) is remade both ways
//   load       no module of the game works one of the fourteen out as it loads, except inside onExact — such a constant would be the engine's whatever the switch says
//   uncovered  nothing under src/ calls a rounded Math function this file does not replace (cbrt, expm1, log1p, sinh, cosh, asinh, acosh, atanh) or uses `**`
//   stand      the frozen stand leaves the switch off (TPS_EXACT=1 raises it), the shipped stand has it on (TPS_EXACT=0 takes it out)
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const ROOT = resolve(import.meta.dir ?? new URL('.', import.meta.url).pathname, '../..');
const args = process.argv.slice(2);
const NAMES = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2', 'exp', 'log', 'log2', 'log10', 'pow', 'tanh', 'hypot'] as const;

// ---- 'load' runs alone in a child (Math has to be wrapped before any module of the game is loaded)
if (args[0] === '--load') {
  const sites = new Map<string, number>(); let watching = true;
  for (const n of NAMES) {
    const f = (Math as any)[n];
    (Math as any)[n] = function (...a: number[]) {
      if (watching) { const st = new Error().stack ?? ''; if (!/onExact/.test(st)) { const at = st.split('\n').map(l => l.trim()).find(l => /\/src\//.test(l))?.replace(/^at /, '').replace(/^.*\/src\//, 'src/') ?? '?'; sites.set(`Math.${n} at ${at}`, (sites.get(`Math.${n} at ${at}`) ?? 0) + 1); } }
      return f.apply(Math, a);
    };
  }
  process.env.TPS_NOHYP = '1';   // (math/hyp.ts holds its candidates against Math.hypot as it loads: that trial is not a constant of the game)
  await import(`${ROOT}/tools/qa/headless.ts`); await import(`${ROOT}/src/game/game.ts`); await import(`${ROOT}/src/host/standup.ts`);
  watching = false;
  console.log('EXACT-LOAD ' + JSON.stringify([...sites].map(([k, v]) => `${k} ×${v}`)));
  process.exit(0);
}

const X: any = await import(`${ROOT}/src/math/exact.ts`);
const SYS: Record<string, (...a: number[]) => number> = X.SYS;

// ---- a stream of inputs made from + − × ÷ alone (and decimal literals), so both engines are handed the same numbers
const F = new Float64Array(1), U = new Uint32Array(F.buffer), B = new BigInt64Array(F.buffer);
function stream() {
  let s = 0x9e3779b9 >>> 0;
  const r = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const r53 = () => (Math.floor(r() * 67108864) * 134217728 + Math.floor(r() * 134217728)) / 9007199254740992;
  const ten = (lo: number, hi: number) => Number('1e' + Math.floor(lo + r() * (hi - lo)));
  return { r, r53, ten };
}
const SPEC = [0, -0, 1, -1, 0.5, -0.5, 2, -2, 3, 0.7, 0.66, 0.625, Infinity, -Infinity, NaN, 1e-320, 5e-324, 1.7976931348623157e308, 1e300, -1e300, 1e-300, Math.PI, Math.PI / 2, Math.PI / 4, 709.78, 710, -745.2, -746, 536870912, 1e15, 4503599627370497, 9007199254740993, 1e22];
type Dom = (S: ReturnType<typeof stream>) => number;
const DOM: Record<string, Dom[]> = {
  angle: [S => (S.r53() - 0.5) * 2 * Math.PI, S => (S.r53() - 0.5) * 200, S => (S.r53() - 0.5) * 2e6, S => (S.r53() - 0.5) * 1e-3],
  unit: [S => S.r53() * 2 - 1, S => (S.r53() - 0.5) * 1e-4, S => 1 - S.r53() * 1e-6],
  any: [S => (S.r53() - 0.5) * 20, S => (S.r53() - 0.5) * 2e3, S => (S.r53() - 0.5) * 1e-2, S => (S.r53() - 0.5) * S.ten(-20, 20)],
  pos: [S => S.r53() * 10, S => S.r53() * 1e6, S => S.r53() * 1e-6, S => S.r53() * S.ten(-300, 300), S => 1 + (S.r53() - 0.5) * 1e-3],
  expo: [S => (S.r53() - 0.5) * 40, S => (S.r53() - 0.5) * 1400, S => (S.r53() - 0.5) * 1e-3],
};
const ONE: [string, string][] = [['sin', 'angle'], ['cos', 'angle'], ['tan', 'angle'], ['asin', 'unit'], ['acos', 'unit'], ['atan', 'any'], ['exp', 'expo'], ['log', 'pos'], ['log2', 'pos'], ['log10', 'pos'], ['tanh', 'any']];
const POW_Y = [2, 3, 4, 1.5, 2.2, 0.25, -1, -2, 1 / 3, 0.45, 2.4, 0.5, 5, 8, 0.8];

/** every function over the fixed stream: the word of all the answers' bits (`fns` = whose functions; the break path hands in the engine's sine) */
function fold(fns: Record<string, (...a: number[]) => number>, n: number): string {
  const S = stream(); let h = 0x811c9dc5;
  const put = (x: number) => { F[0] = x; h = Math.imul(h ^ U[0], 0x01000193) >>> 0; h = Math.imul(h ^ U[1], 0x01000193) >>> 0; };
  for (const [fn, dom] of ONE) { for (const x of SPEC) put(fns[fn](x)); for (const d of DOM[dom]) for (let i = 0; i < n; i++) put(fns[fn](d(S))); }
  for (const x of SPEC) for (const y of SPEC) { put(fns.atan2(x, y)); put(fns.pow(x, y)); put(fns.hypot(x, y)); }
  for (const d of DOM.any) for (const e of DOM.any) for (let i = 0; i < n / 4; i++) put(fns.atan2(d(S), e(S)));
  for (const d of DOM.pos) for (const e of DOM.expo) for (let i = 0; i < n / 4; i++) put(fns.pow(d(S), e(S)));
  for (const y of POW_Y) for (let i = 0; i < n / 8; i++) put(fns.pow(S.r53() * 4, y));
  for (let i = 0; i < n; i++) { const a = (S.r53() - 0.5) * 60, b = (S.r53() - 0.5) * 60, c = (S.r53() - 0.5) * 6; put(fns.hypot(a, b)); put(fns.hypot(a, b, c)); put(fns.hypot(a, b, c, a * b)); put(fns.hypot(a)); put(fns.hypot(a, b, c, 1, 2)); }
  for (let i = 0; i < 20000; i++) { const x = (S.r53() + 0.01) * 536870912 * (1 << Math.floor(S.r() * 20)); put(fns.sin(x)); put(fns.cos(x)); put(fns.tan(x)); }   // (the reduction on the bits: 2^29 and up)
  return (h >>> 0).toString(16);
}
const N = 200000;
const own: Record<string, (...a: number[]) => number> = {}; for (const n of NAMES) own[n] = X[n];
const engine = (globalThis as any).Bun ? `bun ${(globalThis as any).Bun.version} (JavaScriptCore)` : `node ${process.version} (V8 ${process.versions.v8})`;

if (args[0] === '--hash') {   // the child: this engine's word
  const fns = process.env.EXACT_BREAK === '1' ? { ...own, sin: SYS.sin } : own;
  console.log('EXACT-HASH ' + JSON.stringify({ engine, word: fold(fns, N) }));
  process.exit(0);
}

let fails = 0;
const verdict = (ok: boolean, label: string, detail: string) => { if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
const child = (cmd: string[], env: Record<string, string> = {}): { out: string; err: string; status: number | null; missing: boolean } => {
  const r = spawnSync(cmd[0], cmd.slice(1), { cwd: ROOT, env: { ...process.env, ...env }, encoding: 'utf8', maxBuffer: 1 << 26 });
  return { out: r.stdout ?? '', err: r.stderr ?? '', status: r.status, missing: !!r.error && (r.error as { code?: string }).code === 'ENOENT' };
};
const marked = (out: string, mark: string): any => { const l = out.split('\n').find(x => x.startsWith(mark)); return l ? JSON.parse(l.slice(mark.length)) : null; };

// ---- engines
{
  const here = fold(own, N);
  const node = child(['node', '--no-warnings', '--import', './tools/qa/framecost-v8.mjs', 'tools/qa/exact-check.ts', '--hash']);
  const there = marked(node.out, 'EXACT-HASH ');
  if (node.missing) verdict(false, 'engines: bun and node fold the same stream to the same word', `no node on this machine: ${engine} folds ${here}, and nothing was compared`);
  else if (!there) verdict(false, 'engines: bun and node fold the same stream to the same word', `the node child did not answer (exit ${node.status}): ${node.err.trim().split('\n').slice(-2).join(' / ')}`);
  else verdict(there.word === here, 'engines: bun and node fold the same stream to the same word', `${engine}: ${here} · ${there.engine}: ${there.word} — fourteen functions, about ${(N * 48 / 1e6).toFixed(0)} million answers, raw bits`);
}

// ---- close, corners
const ulps = (a: number, b: number): number => {
  if (a === b) return (a !== 0 || 1 / a === 1 / b) ? 0 : 1; if (a !== a && b !== b) return 0; if (a !== a || b !== b || !isFinite(a) || !isFinite(b)) return Infinity;
  if ((a < 0) !== (b < 0)) { F[0] = Math.abs(a); const p = B[0]; F[0] = Math.abs(b); return Number(p + B[0]); }
  F[0] = a; const p = B[0]; F[0] = b; const d = p - B[0]; return Number(d < 0n ? -d : d);
};
{
  // the most a function may stand off this engine's own answer, in units in the last place (the engines themselves stand a unit apart from each other and from true)
  const BOUND: Record<string, number> = { sin: 2, cos: 2, tan: 3, asin: 4, acos: 3, atan: 2, exp: 2, log: 2, log2: 3, log10: 3, tanh: 3, atan2: 3, pow: 8 };
  const S = stream(), worst: string[] = []; let ok = true;
  for (const [fn, dom] of ONE) {
    let max = 0, at = 0;
    for (const d of DOM[dom]) for (let i = 0; i < 100000; i++) { const x = d(S), u = ulps(own[fn](x), SYS[fn](x)); if (u > max) { max = u; at = x; } }
    if (max > BOUND[fn]) ok = false; worst.push(`${fn} ${max}${max > BOUND[fn] ? ` (> ${BOUND[fn]} at ${at})` : ''}`);
  }
  { let max = 0; for (const d of DOM.any) for (const e of DOM.any) for (let i = 0; i < 50000; i++) { const y = d(S), x = e(S), u = ulps(own.atan2(y, x), SYS.atan2(y, x)); if (u > max) max = u; } if (max > BOUND.atan2) ok = false; worst.push(`atan2 ${max}`); }
  { let max = 0; for (const y of POW_Y) for (let i = 0; i < 40000; i++) { const x = S.r53() * 4, u = ulps(own.pow(x, y), SYS.pow(x, y)); if (u > max) max = u; } if (max > BOUND.pow) ok = false; worst.push(`pow (bases to 4, the exponents game code writes) ${max}`); }
  verdict(ok, "close: each function within a few units in the last place of this engine's own", `worst, in units in the last place — ${worst.join(' · ')}`);
}
{
  const kind = (x: number) => x !== x ? 'NaN' : x === Infinity ? '+inf' : x === -Infinity ? '-inf' : x === 0 ? (1 / x > 0 ? '+0' : '-0') : x > 0 ? '+' : '-';
  const bad: string[] = []; let n = 0;
  for (const [fn] of ONE) for (const x of SPEC) { if ((fn === 'sin' || fn === 'cos' || fn === 'tan') && Math.abs(x) >= 1e15 && isFinite(x)) continue; n++; const a = own[fn](x), b = SYS[fn](x); if (kind(a) !== kind(b) || (isFinite(a) && ulps(a, b) > 64)) bad.push(`${fn}(${x}) = ${a}, the engine's ${b}`); }
  for (const [y, x] of [[-1e-300, -1e300], [1e-300, -1e300], [-1e-200, -1e200], [-5e-324, -1], [5e-324, -1]]) { n++; const a = own.atan2(y, x), b = SYS.atan2(y, x); if (a !== b) bad.push(`atan2(${y}, ${x}) = ${a}, the engine's ${b} (a quotient that underflows keeps y's side of the cut)`); }
  for (const k of [-300, -20, -5, -1, 0, 1, 2, 3, 15, 22, 23, 100, 300]) { n++; const a = own.log10(Number(`1e${k}`)); if (a !== k) bad.push(`log10(1e${k}) = ${a}, not ${k}`); }   // (a decade found by floor(log10 x) is the right one)
  for (const x of SPEC) for (const y of SPEC) {
    n += 3;
    { const a = own.atan2(x, y), b = SYS.atan2(x, y); if (kind(a) !== kind(b) || ulps(a, b) > 4) bad.push(`atan2(${x}, ${y}) = ${a}, the engine's ${b}`); }
    { const a = own.pow(x, y), b = SYS.pow(x, y); if (kind(a) !== kind(b)) bad.push(`pow(${x}, ${y}) = ${a}, the engine's ${b}`); }
    { const a = own.hypot(x, y), b = SYS.hypot(x, y); if (kind(a) !== kind(b)) bad.push(`hypot(${x}, ${y}) = ${a}, the engine's ${b}`); }
  }
  verdict(bad.length === 0, "corners: zeros, infinities, NaN and the ends of each domain give the engine's kind of answer", bad.length ? `${bad.length} of ${n}: ${bad.slice(0, 6).join(' · ')}` : `${n} corner cases, none apart`);
}

// ---- switch
{
  const H: any = await import(`${ROOT}/src/math/hyp.ts`);
  const before = NAMES.map(n => (Math as any)[n]), was = X.EXACT.on; let made = 0, value = 0;
  X.EXACT.on = false; X.onExact(() => { made++; value = Math.cos(1.25); });
  const offValue = value, offIsSys = NAMES.every(n => (Math as any)[n] === SYS[n]);
  X.EXACT.on = true;
  const onIsOwn = NAMES.every(n => (Math as any)[n] === X[n]), onValue = value, lengths = H.hyp3(3, 4, 12) === X.hypot(3, 4, 12) && H.hyp2(1e-3, 7) === X.hypot(1e-3, 7);
  X.EXACT.on = false;
  const back = NAMES.every(n => (Math as any)[n] === SYS[n]), backValue = value;
  X.EXACT.on = was;
  const restored = was ? true : NAMES.every((n, i) => (Math as any)[n] === before[i]);
  verdict(offIsSys && onIsOwn && back && restored && lengths && made === 3 && onValue === X.cos(1.25) && offValue === SYS.cos(1.25) && backValue === offValue,
    'switch: writing EXACT.on puts the fourteen in or takes them out, and remakes the constants made at load',
    `off: Math's are the engine's ${offIsSys} · on: Math's are the game's ${onIsOwn}, lengths on the one sum ${lengths} · off again: the very functions back ${back && restored} · a load-time constant made ${made}× (engine's, game's, engine's: ${offValue === SYS.cos(1.25)} ${onValue === X.cos(1.25)} ${backValue === offValue})`);
}

// ---- load
{
  const c = child([process.execPath, 'run', 'tools/qa/exact-check.ts', '--load'], { TPS_PROFILE: '', TPS_EXACT: '' });   // (the frozen stand whatever the shell says: a stand that turns the switch on as it boots puts the game's functions over the watch)
  const sites: string[] | null = marked(c.out, 'EXACT-LOAD ');
  verdict(!!sites && sites.length === 0, 'load: no module of the game works a rounded function out as it loads, outside onExact',
    sites ? (sites.length ? `${sites.length} site(s): ${sites.slice(0, 8).join(' · ')} — make each inside onExact(() => …) (math/exact.ts)` : 'none (the harness, game.ts and the stand-up loaded under a watched Math)') : `the child did not answer (exit ${c.status}): ${c.err.trim().split('\n').slice(-2).join(' / ')}`);
}

// ---- uncovered
{
  // `**` IS Math.pow, but it cannot be put in Math's place: a cube by it is the engine's (V8's differs from x·x·x about one time in four, JavaScriptCore's never).
  // x ** 2 alone is x·x on both, so that spelling stays; anything else in the folders the simulation is made of is written Math.pow(x, y).
  const SIM = ['game', 'math', 'scene', 'anim', 'host', 'smoke'], SIM_FILES = ['src/render/reach.ts', 'src/render/lights.ts'];   // (the two render files the game's own step runs: the reach masks and the light set)
  const ALLOW: Record<string, string> = { 'src/math/hyp.ts': "the inputs of its trial against the engine's own Math.hypot, at load", 'src/smoke/smoke.ts': 'the GPU solver: its grid levels, 2 to a whole power (exact on every engine), and nothing the game reads back' };
  const hits: string[] = [], re = new RegExp(`Math\\.(${(X.EXACT_UNCOVERED as string[]).join('|')})\\s*\\(`), pw = /[\w)\]]\s*\*\*=?\s*(?!2\b(?!\.))[\w(.+-]/;
  const walk = (dir: string, sim: boolean) => { for (const f of readdirSync(dir)) { const p = `${dir}/${f}`, rel = p.slice(ROOT.length + 1); if (statSync(p).isDirectory()) walk(p, sim); else if (p.endsWith('.ts')) readFileSync(p, 'utf8').split('\n').forEach((line, i) => { const code = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '').replace(/^\s*\*.*$/, '').replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g, "''"); if (re.test(code) || ((sim || SIM_FILES.includes(rel)) && !ALLOW[rel] && pw.test(code))) hits.push(`${rel}:${i + 1}`); }); } };
  for (const d of readdirSync(`${ROOT}/src`)) { const p = `${ROOT}/src/${d}`; if (statSync(p).isDirectory()) walk(p, SIM.includes(d)); }
  verdict(hits.length === 0, 'uncovered: no rounded Math function the game has none of its own for under src/, and no power operator but a square in the simulation',
    hits.length ? `${hits.length}: ${hits.slice(0, 10).join(' · ')} — write it with the fourteen (x ** 3 is Math.pow(x, 3)), or add the function to math/exact.ts` : `none (${(X.EXACT_UNCOVERED as string[]).join(', ')} anywhere; ** other than ** 2 under src/${SIM.join(', src/')}, ${SIM_FILES.join(', ')})`);
}

// ---- stand
{
  const ask = (env: Record<string, string>): string => { const c = child([process.execPath, '-e', `const { standUp } = await import('${ROOT}/tools/qa/headless.ts'); await standUp(); const { EXACT } = await import('${ROOT}/src/math/exact.ts'); console.log('EXACT-STAND ' + JSON.stringify(EXACT.on)); process.exit(0);`], env); const v = marked(c.out, 'EXACT-STAND '); return v === null ? `? (exit ${c.status})` : String(v); };
  const clear = { TPS_PROFILE: '', TPS_EXACT: '' };
  const env = (o: Record<string, string>) => { const e: Record<string, string> = {}; for (const [k, v] of Object.entries({ ...clear, ...o })) if (v !== '') e[k] = v; return e; };
  const saved = { p: process.env.TPS_PROFILE, x: process.env.TPS_EXACT }; delete process.env.TPS_PROFILE; delete process.env.TPS_EXACT;
  const frozen = ask(env({})), raised = ask(env({ TPS_EXACT: '1' })), shipped = ask(env({ TPS_PROFILE: 'shipped' })), held = ask(env({ TPS_PROFILE: 'shipped', TPS_EXACT: '0' }));
  if (saved.p !== undefined) process.env.TPS_PROFILE = saved.p; if (saved.x !== undefined) process.env.TPS_EXACT = saved.x;
  verdict(frozen === 'false' && raised === 'true' && shipped === 'true' && held === 'false', 'stand: off on the frozen stand, on as shipped, each with its word', `frozen ${frozen} · frozen TPS_EXACT=1 ${raised} · shipped ${shipped} · shipped TPS_EXACT=0 ${held}`);
}

console.log(fails ? `=== exact-check: ${fails} FAIL ===` : '=== exact-check: ALL PASS ===');
process.exit(fails ? 1 : 0);
