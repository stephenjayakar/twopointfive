// A SHADER MODULE'S TEXT, CUT TO WHAT IT USES. Every module that touches the scene is compiled behind the whole scene prelude (render/frame.ts scenePrelude:
// the world's constants, common.wgsl's tracing, every smoke read, the character rig) — some 180 KB of WGSL in front of a kernel that may read a twentieth of it.
// Sixty-odd modules a boot made 12 MB of text for the browser's WGSL front end to read, check and carry into each pipeline's compile — on the GPU process's own
// thread, the one that also draws the browser (a play test, 10-19: hitches while the shaders compile, a freeze of most of a second on a fast machine) — and
// made every module's text change whenever ANY switch at the head of the prelude did, so a level in another weather was sixty new texts to the browser's
// compiled-shader cache though most kernels never read the weather.
//
// trimWgsl keeps, in their order and character for character (comments aside), the module-scope declarations an entry point can reach — by name: a declaration
// is kept when a kept one mentions its name anywhere in its text — and drops the rest. What is always kept: every entry point (@compute / @vertex / @fragment),
// every `override` (a pipeline may be handed a constant for one its entry point never reads), every directive and const_assert, and anything this file does not
// recognise. WGSL's module scope has no order and no side effects, and an implementation compiles one entry point's reachable declarations: the program a
// pipeline runs is the same program. Mentions are matched as bare words, so a local that shares a global's name only ever keeps MORE.
//
// `?shadertrim=0` = every module as it was, whole. tools/qa/shadertrim-check.ts holds the rule to the shipped shaders; the page's own boot (every pipeline
// made, no GPU error) is what says the compiler agrees.
export const SHADER_TRIM = { on: true };
try { if (new URLSearchParams(location.search).get('shadertrim') === '0') SHADER_TRIM.on = false; } catch { /* no page (the harness) */ }

interface Decl { text: string; name: string | null; root: boolean; entry: boolean; ids: string[] }
/** by declaration text: the prelude's few hundred declarations are read once, whatever number of modules carry them. Its keys are slices of the modules' own
 *  texts and hold those alive, so it is emptied once the boot's modules are made (trimForget) and whenever it has grown past a boot's worth */
const seen = new Map<string, Decl>();
export function trimForget(): void { seen.clear(); }
const WORD = /[A-Za-z_][A-Za-z0-9_]*/g;
const NAMED = new Set(['fn', 'struct', 'alias', 'const', 'override', 'var', 'let']);
const STAGE = new Set(['compute', 'vertex', 'fragment']);

function read(text: string): Decl {
  let d = seen.get(text); if (d) return d;
  if (seen.size > 8192) seen.clear();
  // attributes first: @name or @name(…), any number
  let i = 0; const n = text.length; let entry = false;
  const ws = () => { while (i < n && text.charCodeAt(i) <= 32) i++; };
  const word = () => { const a = i; while (i < n) { const c = text.charCodeAt(i); if ((c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95) i++; else break; } return text.slice(a, i); };
  for (ws(); text[i] === '@'; ws()) { i++; ws(); if (STAGE.has(word())) entry = true; ws(); if (text[i] === '(') { let depth = 0; do { if (text[i] === '(') depth++; else if (text[i] === ')') depth--; i++; } while (i < n && depth > 0); } }
  const kw = word(); let name: string | null = null;
  if (NAMED.has(kw)) { ws(); if (kw === 'var' && text[i] === '<') { let depth = 0; do { if (text[i] === '<') depth++; else if (text[i] === '>') depth--; i++; } while (i < n && depth > 0); ws(); } name = word() || null; }
  const ids = [...new Set(text.match(WORD) ?? [])];
  d = { text, name, root: name === null || kw === 'override' || (kw === 'fn' && entry), entry: kw === 'fn' && entry, ids };
  seen.set(text, d); return d;
}

/** the module-scope declarations of `code` in order, comments removed: each ends at a `;` outside braces or at the `}` that closes its body */
export function wgslDecls(code: string): string[] {
  const out: string[] = []; const n = code.length; let parts: string[] = [], from = 0, depth = 0, any = false;
  const flush = (to: number) => { if (to > from) parts.push(code.slice(from, to)); };
  const end = (to: number) => { flush(to); from = to; const t = parts.join('').trim(); parts = []; any = false; if (t) out.push(t); };
  for (let i = 0; i < n; i++) {
    const c = code.charCodeAt(i);
    if (c === 47 /* / */) { const c2 = code.charCodeAt(i + 1);
      if (c2 === 47) { flush(i); while (i < n && code.charCodeAt(i) !== 10) i++; from = i; i--; continue; }   // a line comment: up to (not with) its newline
      if (c2 === 42 /* * */) { flush(i); let k = 1; i += 2; while (i < n && k > 0) { const a = code.charCodeAt(i), b = code.charCodeAt(i + 1); if (a === 47 && b === 42) { k++; i += 2; } else if (a === 42 && b === 47) { k--; i += 2; } else i++; } parts.push(' '); from = i; i--; continue; }   // a block comment (they nest): one space in its place
    }
    if (c === 59 /* ; */ && depth === 0) { if (any) end(i + 1); else { flush(i); from = i + 1; } continue; }   // (a `;` with nothing before it — the optional one after a struct's `}` — is dropped)
    if (c > 32) any = true;
    if (c === 123 /* { */) depth++;
    else if (c === 125 /* } */) { depth--; if (depth === 0) end(i + 1); }
  }
  end(n);
  return out;
}

/** `code` with every module-scope declaration no entry point can reach removed (the head of this file has the rule). Text with no entry point in it — a
 *  fragment of a module, not a module — comes back whole. */
export function trimWgsl(code: string): string {
  const decls = wgslDecls(code).map(read);
  if (!decls.some(d => d.entry)) return code;
  const at = new Map<string, number[]>(); decls.forEach((d, i) => { if (d.name) { const l = at.get(d.name); if (l) l.push(i); else at.set(d.name, [i]); } });
  const keep = new Uint8Array(decls.length), todo: number[] = [];
  decls.forEach((d, i) => { if (d.root) { keep[i] = 1; todo.push(i); } });
  while (todo.length) { const d = decls[todo.pop()!]; for (const id of d.ids) { const l = at.get(id); if (l) for (const j of l) if (!keep[j]) { keep[j] = 1; todo.push(j); } } }
  const out: string[] = []; decls.forEach((d, i) => { if (keep[i]) out.push(d.text); });
  return out.join('\n') + '\n';
}

/** how much the page's modules were cut, summed since the page opened (window.__boot.shaderText reads it): characters handed in, characters compiled, ms spent cutting */
export const trimTotals = { modules: 0, before: 0, after: 0, ms: 0 };
/** makeShader's step (gpu/device.ts): the text to compile for `code` */
export function shaderText(code: string): string {
  const t = typeof performance !== 'undefined' ? performance.now() : 0;
  const out = SHADER_TRIM.on ? trimWgsl(code) : code;
  trimTotals.modules++; trimTotals.before += code.length; trimTotals.after += out.length; if (typeof performance !== 'undefined') trimTotals.ms += performance.now() - t;
  return out;
}
