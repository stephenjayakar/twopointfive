// SHADER TUNE — runtime overrides of a WGSL text's module-scope float constants (the one off scene tweak panel, ui/sceneTweak.ts). Pure string work: no shader file changes,
// and with the map empty every program is built from the bundled text itself (tuned(src) === src), so the checks that compare program text see nothing.

/** runtime overrides of WGSL `const NAME: <type> = <value>;` lines, by constant name. Empty (the default, and always outside the one off scene tweak panel) = every program's text is the bundled text, byte for byte. */
export const SHADER_TUNE = new Map<string, number[]>();
export interface ShaderConst { name: string; type: 'f32' | 'vec2f' | 'vec3f' | 'vec4f'; value: number[]; note: string }

const NUM = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?f?$/;   // a decimal float / int literal (no hex, no expression)
/** 1 = `const NAME: type = ` · 2 = NAME · 3 = type · 4 = the value's text · 5 = the rest of the line after the `;` */
const lineRe = () => /^(const[ \t]+([A-Za-z_]\w*)[ \t]*:[ \t]*(f32|vec[234]f)[ \t]*=[ \t]*)([^;\n]*);([^\n]*)$/gm;
const width = (type: string): number => type === 'f32' ? 1 : +type[3];

/** the numbers of a value's text, or null when it is not the plain literal form for `type` */
function parseValue(type: string, text: string): number[] | null {
  const t = text.trim();
  if (type === 'f32') return NUM.test(t) ? [parseFloat(t)] : null;
  if (!t.startsWith(type + '(') || !t.endsWith(')')) return null;
  const parts = t.slice(type.length + 1, -1).split(',').map(s => s.trim());
  if (parts.length !== width(type) || !parts.every(p => NUM.test(p))) return null;
  return parts.map(parseFloat);
}
/** a number as a WGSL float literal: always a decimal point or an exponent (2 → `2.0`) */
function lit(v: number): string { const s = String(v); return /[.e]/.test(s) ? s : s + '.0'; }
function valueText(type: string, v: number[]): string { return type === 'f32' ? lit(v[0]) : `${type}(${v.map(lit).join(', ')})`; }

/** the float constants a WGSL text declares at module scope whose name matches `pick` (each `const NAME: f32 = 1.5;` / `const NAME: vec3f = vec3f(a, b, c);` line, with its trailing // comment as `note`) */
export function shaderConsts(src: string, pick: RegExp): ShaderConst[] {
  const out: ShaderConst[] = [];
  for (const m of src.matchAll(lineRe())) {
    pick.lastIndex = 0; if (!pick.test(m[2])) continue;   // (lastIndex: a /g or /y pattern must not carry its place from one name to the next)
    const value = parseValue(m[3], m[4]); if (!value) continue;
    out.push({ name: m[2], type: m[3] as ShaderConst['type'], value, note: m[5].trim().replace(/^\/\/\s*/, '') });
  }
  pick.lastIndex = 0;
  return out;
}

/** `src` with every constant named in SHADER_TUNE given its override value (the rest of the line, comment included, kept); `src` ITSELF (same string) when nothing in the map is declared in it */
export function tuned(src: string): string {
  if (SHADER_TUNE.size === 0) return src;
  let hit = false;
  const out = src.replace(lineRe(), (line: string, head: string, name: string, type: string, text: string, rest: string) => {
    const v = SHADER_TUNE.get(name);
    if (!v || v.length !== width(type) || !v.every(Number.isFinite) || !parseValue(type, text)) return line;   // (an override of the wrong width, or of a line that is not the plain literal form: left alone)
    hit = true; return head + valueText(type, v) + ';' + rest;
  });
  return hit ? out : src;
}
