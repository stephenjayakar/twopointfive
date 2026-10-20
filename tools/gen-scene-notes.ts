// THE SCENE PANEL'S TOOLTIPS (src/ui/sceneNotes.ts): each slider's note is the code's own comment on the number it moves, copied out of the table by this tool.
//   bun run tools/gen-scene-notes.ts            writes src/ui/sceneNotes.ts
//   bun run tools/gen-scene-notes.ts --check    exit 0 = the file on disk is what would be written, 1 = it is stale or missing (one line says so)
// WHAT IS READ (source text only: nothing of src/ is imported, so the tool cannot trip the game's import cycle):
//   an object-literal table `export const NAME = { … };` — per NUMERIC key (a number, a small sum like 1 / 120, an array of numbers):
//     key: 12,   // note                        the trailing comment
//     a: 1, b: 2,   // note                     one trailing comment → every key on the line
//     // note   (or /** note */, any length)    a comment directly above a line → every key on it that has no trailing comment
//                        // more of the note    a line that holds only a comment, indented past the keys → joined on to the note before it
//     next: 0.6,   //   more of the note        a trailing comment that opens with two or more spaces carries the note of the line above on: both lines' keys get the whole
//   a key with no comment gets no entry; a key that is not a number (on: false) is left out without a word; `// ---- heading` lines are nobody's note
//   `export interface RenderSettings`: the fields named in SETTINGS whose `// comment` is on the field's own line, keyed S.<field>
// A table or a named settings field that is not found THROWS: a rename must not quietly empty the panel's notes.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');
const OUT = 'src/ui/sceneNotes.ts';
const TABLES: [name: string, file: string][] = [
  ['SNOWFX', 'src/game/snowFx.ts'], ['SNOWWISPS', 'src/game/snowFx.ts'], ['SNOWGRAINS', 'src/game/snowFx.ts'],
  ['SNOWTRACKS', 'src/game/snowTracks.ts'],
  ['SNOWBLAST', 'src/game/snowBlast.ts'],
  ['SNOWMARKS', 'src/game/snowMarks.ts'],
  ['SNOWBREATH', 'src/game/snowBreath.ts'],
  ['BREATHSTEAM', 'src/game/snowBreath.ts'],
  ['SNOW_SURF', 'src/render/snowField.ts'],
  ['AIR_SIM', 'src/game/airSim.ts'],
  ['AIR', 'src/render/airField.ts'],
  ['FOG', 'src/game/fogofwar.ts'],
];
const SETTINGS_FILE = 'src/settings.ts';
const SETTINGS = ['exposure', 'hazeDensity', 'indirectScale', 'emissiveScale', 'airEvery', 'flashlightRadius'];   // (the rows ui/sceneLayers.ts makes with `setting()`)
const CAP = 240;

/** a note as the panel shows it: one line, no leading '… ' / '… and ', at most CAP characters (cut at a word, '…' added) */
function tidy(raw: string): string {
  let s = raw.replace(/\s+/g, ' ').trim().replace(/^…\s*(and\s+)?/, '');
  if (s.length > CAP) {
    s = s.slice(0, CAP - 1);
    const sp = s.lastIndexOf(' ');
    s = (sp > 0 ? s.slice(0, sp) : s).trimEnd() + '…';
  }
  return s;
}

/** the lines between `<opener> {` and the first line that starts with `}` */
function bodyOf(text: string, opener: RegExp, what: string, file: string): string[] {
  const lines = text.split('\n');
  const at = lines.findIndex((l) => opener.test(l));
  if (at < 0) throw new Error(`gen-scene-notes: ${what} not found in ${file} (renamed? update tools/gen-scene-notes.ts)`);
  const end = lines.findIndex((l, i) => i > at && l.startsWith('}'));
  if (end < 0) throw new Error(`gen-scene-notes: ${what} in ${file} has no closing brace at the line's start`);
  return lines.slice(at + 1, end);
}

/** where a line's `//` or `/*` comment starts (not one inside a string), or -1 */
function commentAt(line: string): number {
  let q = '';
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '\\') i++; else if (c === q) q = ''; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '/' && (line[i + 1] === '/' || line[i + 1] === '*')) return i;
  }
  return -1;
}

const NUM = String.raw`[-+]?(?:\d[\d_]*\.?\d*|\.\d+)(?:e[-+]?\d+)?`;
const NUM_EXPR = new RegExp(String.raw`^${NUM}(?:\s*[-+*/]\s*${NUM})*$`, 'i');
function isNumeric(value: string): boolean {
  const v = value.replace(/\s+as\s+.*$/, '').trim();
  if (v.startsWith('[') && v.endsWith(']')) {
    const items = v.slice(1, -1).split(',').map((s) => s.trim()).filter((s) => s !== '');
    return items.length > 0 && items.every((s) => NUM_EXPR.test(s));
  }
  return NUM_EXPR.test(v);
}

/** `a: 1, b: [2, 3] as T,` → its keys with whether each value is a number; null if the code is not a run of `key: value,` */
function keysOf(code: string): { key: string; numeric: boolean }[] | null {
  const out: { key: string; numeric: boolean }[] = [];
  let i = 0;
  while (i < code.length) {
    const m = /^\s*([A-Za-z_$][\w$]*)\s*:/.exec(code.slice(i));
    if (!m) return code.slice(i).trim() === '' && out.length ? out : null;
    i += m[0].length;
    let depth = 0, q = '', j = i;
    for (; j < code.length; j++) {
      const c = code[j];
      if (q) { if (c === '\\') j++; else if (c === q) q = ''; continue; }
      if (c === '"' || c === "'" || c === '`') q = c;
      else if (c === '[' || c === '(' || c === '{') depth++;
      else if (c === ']' || c === ')' || c === '}') depth--;
      else if (c === ',' && depth === 0) break;
    }
    out.push({ key: m[1], numeric: isNumeric(code.slice(i, j)) });
    i = j + 1;
  }
  return out;
}

/** one table's notes, in source order */
function tableNotes(name: string, file: string): [string, string][] {
  const body = bodyOf(readFileSync(resolve(ROOT, file), 'utf8'), new RegExp(String.raw`^export const ${name}\b[^=]*=\s*\{\s*(?://.*)?$`), `export const ${name}`, file);
  type Group = { keys: string[]; parts: string[] };   // keys that share one note, and the note's pieces
  const groups: Group[] = [];
  let above: string[] = [];        // a comment directly above the next key line
  let open: Group | null = null;   // the note a following comment-only line (or a hanging trailing comment) continues
  let keyIndent = -1;
  for (let n = 0; n < body.length; n++) {
    let line = body[n];
    if (line.trim() === '') { above = []; open = null; continue; }
    const indent = line.length - line.trimStart().length;
    const t = line.trim();
    if (t.startsWith('/*')) {   // a block comment, of any length: a note for the line under it
      const from = n;
      while (!body[n].includes('*/') && n + 1 < body.length) n++;
      const rest = body[n].slice(body[n].indexOf('*/') + 2);
      const text = body.slice(from, n + 1).join('\n').replace(/^\s*\/\*+/, '').replace(/\*\/[^]*$/, '').split('\n').map((l) => l.replace(/^\s*\*\s?/, '')).join(' ');
      above = [text]; open = null;
      if (rest.trim() === '') continue;
      line = ' '.repeat(indent) + rest.trimStart();   // (`/** note */ key: 1,` on one line)
    } else if (t.startsWith('//')) {
      const text = t.slice(2);
      if (open && keyIndent >= 0 && indent > keyIndent) open.parts.push(text);        // the note above, carried on
      else if (/^\s*-{3,}/.test(text)) { above = []; open = null; }                     // a heading
      else { above.push(text); open = null; }
      continue;
    }
    const c = commentAt(line);
    const entries = keysOf(c < 0 ? line : line.slice(0, c));
    if (!entries) { above = []; open = null; continue; }   // not a `key: value,` line
    if (keyIndent < 0) keyIndent = indent;
    const keys = entries.filter((e) => e.numeric).map((e) => e.key);
    let trailing: string | null = null;
    if (c >= 0) trailing = line.startsWith('//', c) ? line.slice(c + 2) : line.slice(c).replace(/^\/\*+/, '').replace(/\*\/\s*$/, '');
    if (trailing !== null && trailing.trim() !== '') {
      if (open && /^\s{2,}\S/.test(trailing) && line.startsWith('//', c)) { open.keys.push(...keys); open.parts.push(trailing); }   // the line above's note runs on through this one
      else { open = { keys, parts: [trailing] }; groups.push(open); }
    } else if (above.length) { open = null; groups.push({ keys, parts: above }); }
    else open = null;
    above = [];
  }
  const notes = new Map<string, string>();
  for (const g of groups) { const note = tidy(g.parts.join(' ')); if (note) for (const k of g.keys) notes.set(k, note); }
  // source order = the order the keys stand in the table (a group can hold keys of two lines)
  const order: string[] = [];
  for (const g of groups) for (const k of g.keys) if (notes.has(k) && !order.includes(k)) order.push(k);
  return order.map((k) => [`${name}.${k}`, notes.get(k)!]);
}

/** the named RenderSettings fields that carry a `// comment` on their own line, in source order */
function settingsNotes(): [string, string][] {
  const body = bodyOf(readFileSync(resolve(ROOT, SETTINGS_FILE), 'utf8'), /^export interface RenderSettings\b.*\{\s*(?:\/\/.*)?$/, 'export interface RenderSettings', SETTINGS_FILE);
  const out: [string, string][] = [];
  const found = new Set<string>();
  for (const line of body) {
    const m = /^\s*([A-Za-z_$][\w$]*)\??\s*:/.exec(line);
    if (!m || !SETTINGS.includes(m[1])) continue;
    found.add(m[1]);
    const c = commentAt(line);
    if (c < 0 || !line.startsWith('//', c)) continue;
    const note = tidy(line.slice(c + 2));
    if (note) out.push([`S.${m[1]}`, note]);
  }
  const lost = SETTINGS.filter((f) => !found.has(f));
  if (lost.length) throw new Error(`gen-scene-notes: RenderSettings has no field ${lost.join(', ')} in ${SETTINGS_FILE} (renamed? update tools/gen-scene-notes.ts)`);
  return out;
}

const quote = (s: string): string => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

const perTable: [string, [string, string][]][] = TABLES.map(([name, file]) => [name, tableNotes(name, file)]);
perTable.push(['S', settingsNotes()]);
const text =
  '// GENERATED by tools/gen-scene-notes.ts from the tables\' own comments — do not edit; `bun run tools/gen-scene-notes.ts` after changing a table\'s comments (`--check` is red when stale).\n' +
  'export const SCENE_NOTES: Record<string, string> = {\n' +
  perTable.flatMap(([, rows]) => rows.map(([k, v]) => `  ${quote(k)}: ${quote(v)},\n`)).join('') +
  '};\n';

const outPath = resolve(ROOT, OUT);
if (process.argv.includes('--check')) {
  const onDisk = existsSync(outPath) ? readFileSync(outPath, 'utf8') : null;
  if (onDisk !== text) {
    console.log(`gen-scene-notes: ${OUT} is ${onDisk === null ? 'missing' : 'stale'} — run \`bun run tools/gen-scene-notes.ts\``);
    process.exit(1);
  }
  process.exit(0);
}
writeFileSync(outPath, text);
console.log(`${OUT}: ${perTable.map(([name, rows]) => `${name} ${rows.length}`).join(' · ')} (${perTable.reduce((a, [, r]) => a + r.length, 0)} notes)`);
