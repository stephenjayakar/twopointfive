// Static check of the renderer's shared tables — the things four merged lanes each appended to and nothing but the GPU would complain about:
//   1. struct Frame in common.wgsl laid out by WGSL's uniform rules (align / size per member) → every member's byte offset; the struct's size must be
//      frame.ts FRAME_BYTES, and every vec4-ish member frame.ts writeFrame writes must land on the offset the shader reads (f[]/u[] index × 4).
//   2. FrameFlags (frame.ts) ⇄ the FLAG_* consts (common.wgsl): each a distinct power of two, no two features on one bit, the same value under the same
//      name on both sides, and every WGSL flag known to the host.
//   3. BoxFlag (boxes.ts) ⇄ BOX_* (common.wgsl): distinct bits; the GPU's names carry the CPU's values.
//   bun run tools/qa/frame-layout.ts        (exit 1 on any FAIL; also `probes.ts frame-layout`)
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '../..');
const { FRAME_BYTES, FrameFlags } = await import(`${ROOT}/src/render/frame.ts`);
const { BoxFlag } = await import(`${ROOT}/src/scene/boxes.ts`);
const common = readFileSync(`${ROOT}/src/render/shaders/common.wgsl`, 'utf8');
const frameTs = readFileSync(`${ROOT}/src/render/frame.ts`, 'utf8');

let fails = 0;
const verdict = (ok: boolean, label: string, detail = '') => { if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}${detail ? `\n    ${detail}` : ''}`); };

// ---------------------------------------------------------------- 1. struct Frame
type Ty = { align: number; size: number };
function typeOf(t: string): Ty {
  t = t.trim();
  const scalar = /^(f32|u32|i32)$/; const m4 = /^mat4x4f$/;
  let m: RegExpMatchArray | null;
  if (scalar.test(t)) return { align: 4, size: 4 };
  if (m4.test(t)) return { align: 16, size: 64 };
  if ((m = t.match(/^vec([234])[fui]$/))) { const n = +m[1]; return n === 2 ? { align: 8, size: 8 } : n === 3 ? { align: 16, size: 12 } : { align: 16, size: 16 }; }
  if ((m = t.match(/^array<\s*([^,>]+)\s*,\s*(\d+)\s*>$/))) { const el = typeOf(m[1]); const stride = Math.ceil(el.size / 16) * 16; return { align: 16, size: stride * +m[2] }; }   // uniform address space: array stride rounded up to 16
  throw new Error(`frame-layout: unknown WGSL type '${t}' in struct Frame`);
}
const body = common.match(/struct Frame \{([\s\S]*?)\n\};/);
if (!body) throw new Error('frame-layout: struct Frame not found in common.wgsl');
const members: { name: string; type: string; offset: number; size: number }[] = [];
{ let off = 0, maxAlign = 1;
  const src = body[1].split('\n').map(l => l.replace(/\/\/.*$/, '')).join(' ');   // strip line comments, then split on commas at depth 0 (array<…, N> has its own comma)
  const parts: string[] = []; let depth = 0, cur = '';
  for (const ch of src) { if (ch === '<') depth++; if (ch === '>') depth--; if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; } else cur += ch; }
  parts.push(cur);
  for (const p of parts) {
    const mm = p.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.+)$/); if (!mm) continue;
    const ty = typeOf(mm[2]); off = Math.ceil(off / ty.align) * ty.align; members.push({ name: mm[1], type: mm[2].trim(), offset: off, size: ty.size }); off += ty.size; maxAlign = Math.max(maxAlign, ty.align);
  }
  const size = Math.ceil(off / maxAlign) * maxAlign;
  console.log('\n=== frame-layout: struct Frame (common.wgsl) vs frame.ts ===');
  console.log('  ' + members.filter(m => m.offset >= 384).map(m => `${m.offset} ${m.name}: ${m.type}`).join(' · '));
  verdict(size === FRAME_BYTES, `struct Frame is ${size} bytes = FRAME_BYTES (${FRAME_BYTES})`, size !== FRAME_BYTES ? `last member ${members[members.length - 1].name} ends at ${off}` : '');
  verdict(size % 16 === 0 && members.every(m => !/^vec4|^array|^mat/.test(m.type) || m.offset % 16 === 0), 'every vec4 / array / matrix member sits on a 16-byte boundary; the block is a multiple of 16', '');
}
// what writeFrame writes where: the first word of each vec4-ish member (regexes on frame.ts — a member renamed on one side only shows up here as 'not found')
const writers: [string, RegExp][] = [
  ['viewProj', /f\.set\(p\.viewProj, (\d+)\)/], ['invViewProj', /f\.set\(p\.invViewProj, (\d+)\)/], ['prevViewProj', /f\.set\(p\.prevViewProj, (\d+)\)/],
  ['camPos', /f\.set\(p\.camPos, (\d+)\)/], ['camDir', /f\.set\(p\.camDir, (\d+)\)/], ['screen', /f\[(\d+)\] = p\.width;/], ['frameIdx', /u\[(\d+)\] = p\.frameIdx;/],
  ['skyZenith', /f\.set\(p\.skyZenith, (\d+)\)/], ['skyHorizon', /f\.set\(p\.skyHorizon, (\d+)\)/], ['rcC0Dims', /u\[(\d+)\] = p\.rcC0Dims\[0\]/], ['rcD0', /u\[(\d+)\] = p\.rcD0;/],
  ['indirectScale', /f\[(\d+)\] = p\.indirectScale;/], ['capColor', /f\[(\d+)\] = p\.capColor\[0\]/], ['post', /f\[(\d+)\] = p\.post\[0\]/], ['rcJitter', /f\[(\d+)\] = p\.rcJitter\[0\]/],
  ['directCfg', /f\[(\d+)\] = p\.directCfg\[0\]/], ['lossyCfg', /f\[(\d+)\] = p\.lossyCfg\[0\]/], ['cardCfg', /u\[(\d+)\] = nc;/], ['cardSlots', /u\[(\d+) \+ k\] = k < nc/],
  ['weatherA', /f\[(\d+)\] = w\.rain;/], ['weatherB', /f\[(\d+)\] = w\.flash\[0\];/], ['weatherC', /f\[(\d+)\] = w\.interior\[0\];/], ['glassCfg', /f\[(\d+)\] = p\.glassCfg\[0\];/],
  ['weatherD', /f\[(\d+)\] = w\.annex\[0\];/], ['volCfg', /u\[(\d+)\] = p\.volCfg\[0\] >>> 0;/],
  ['froxelA', /f\[(\d+)\] = p\.froxelA\[0\];/], ['froxelB', /u\[(\d+)\] = p\.froxelB\[0\] >>> 0;/], ['froxelC', /f\[(\d+)\] = p\.froxelC\[0\];/], ['prevCam', /f\[(\d+)\] = p\.prevCamPos\[0\];/],
  ['rtCfg', /f\[(\d+)\] = p\.rtCfg\[0\];/], ['matCfg', /f\[(\d+)\] = p\.matCfg\[0\];/],
  ['p5Cfg', /u\[(\d+)\] = p\.p5Cfg\[0\] >>> 0;/], ['jitter', /f\[(\d+)\] = p\.jitter\[0\];/], ['markCfg', /f\[(\d+)\] = p\.markCfg\[0\];/], ['sharpCfg', /f\[(\d+)\] = p\.sharpCfg\[0\];/], ['sharpCfgB', /f\[(\d+)\] = p\.sharpCfgB\[0\];/], ['sharpCfgC', /f\[(\d+)\] = p\.sharpCfgC\[0\];/],
  ['rigCfg', /f\[(\d+)\] = p\.rigCfg\[0\];/], ['rigCfgB', /f\[(\d+)\] = p\.rigCfgB\[0\];/],
  ['giCfg', /f\[(\d+)\] = gc\[0\];/],   // (written through `gc = p.giCfg ?? ZERO4`)
  ['weatherE', /f\[(\d+)\] = nf\[0\];/],   // (written through `nf = w.nearFade ?? ZERO4` — the particle-rain experiment's disc)
  ['weatherF', /f\[(\d+)\] = pf\[0\];/],   // (written through `pf = w.phase ?? ZERO4` — its v2 phase for the lattice)
];
{ const rows: string[] = []; let bad = 0, missing = 0;
  for (const [name, re] of writers) {
    const mem = members.find(m => m.name === name); const w = frameTs.match(re);
    if (!mem || !w) { missing++; rows.push(`${name}: ${!mem ? 'not in the struct' : 'writer not found in frame.ts'}`); continue; }
    const at = +w[1] * 4; if (at !== mem.offset) { bad++; rows.push(`${name}: written at byte ${at}, read at ${mem.offset}`); }
  }
  verdict(bad === 0 && missing === 0, `writeFrame puts all ${writers.length} checked members where the shader reads them`, rows.join(' · '));
  const unchecked = members.filter(m => !writers.some(([n]) => n === m.name) && /^vec4|^array/.test(m.type)).map(m => m.name);
  verdict(unchecked.length === 0, 'every vec4 / array member of the struct has a checked writer (add a row to tools/qa/frame-layout.ts when you add a member)', unchecked.join(', '));
}

// ---------------------------------------------------------------- 2. frame flags
console.log('\n=== frame-layout: FrameFlags (frame.ts) vs FLAG_* (common.wgsl) ===');
const isPow2 = (v: number) => v > 0 && (v & (v - 1)) === 0 && v <= 0x80000000;
const norm = (s: string) => s.toLowerCase().replace(/_/g, '');
const ALIAS: Record<string, string> = {};   // a pair whose two names differ goes here, WGSL's → the host's, both as norm() spells them (none today)
/** A WGSL u32 literal as the shader tables spell it — decimal `64u`, hex `0x40u`, or a shift `(1u << 6u)`; NaN for anything else (reported as a FAIL by the callers, never skipped). */
const lit = (t: string): number => { t = t.trim().replace(/u\b/g, ''); let m: RegExpMatchArray | null; if (/^\d+$/.test(t)) return +t; if (/^0x[0-9a-fA-F]+$/.test(t)) return parseInt(t, 16); if ((m = t.match(/^\(?\s*(\d+)\s*<<\s*(\d+)\s*\)?$/))) return (+m[1] * 2 ** +m[2]) >>> 0; return NaN; };
{ const host = Object.entries(FrameFlags as Record<string, number>);
  const dupH = host.filter(([, v], i) => host.findIndex(([, w]) => w === v) !== i);
  verdict(host.every(([, v]) => isPow2(v)) && dupH.length === 0, `FrameFlags: ${host.length} names, each a distinct single bit`, dupH.map(([n, v]) => `${n} = ${v} shares its bit with ${host.find(([m, w]) => w === v && m !== n)?.[0]}`).join(' · '));
  // every `const FLAG_…: u32 = …;` line, whatever the literal's spelling (decimal, hex, `1u << 30u`) — a line this cannot evaluate is a FAIL, never silently uncounted
  const declared = [...common.matchAll(/^const (FLAG_[A-Z0-9_]+)\s*:\s*u32\s*=\s*([^;]+);/gm)];
  const wg = declared.map(m => [m[1], lit(m[2])] as [string, number]);
  const unread = wg.filter(([, v]) => !Number.isFinite(v));
  const dupW = wg.filter(([, v], i) => wg.findIndex(([, w]) => w === v) !== i);
  verdict(unread.length === 0 && wg.every(([, v]) => isPow2(v)) && dupW.length === 0, `common.wgsl: ${wg.length} FLAG_ consts, each a readable, distinct single bit`, [...unread.map(([n]) => `${n}: literal '${declared.find(m => m[1] === n)?.[2].trim()}' not understood (decimal / 0x… / 1u << n expected)`), ...dupW.map(([n, v]) => `${n} = ${v} shares its bit with ${wg.find(([m, w]) => w === v && m !== n)?.[0]}`)].join(' · '));
  verdict(wg.length >= 24 && wg.length <= host.length, `the FLAG_ table was actually read: ${wg.length} consts found (≥ 24, ≤ FrameFlags' ${host.length})`, wg.length < 24 ? 'the regex matched too few lines — did the declaration style change?' : '');   // (the count guard: a regex that quietly matches nothing would make every check below vacuous)
  const byName = new Map(host.map(([n, v]) => [norm(n), v]));
  const rows: string[] = [];
  for (const [n, v] of wg) { const key = norm(n.replace(/^FLAG_/, '')); const hv = byName.get(ALIAS[key] ?? key); if (hv === undefined) rows.push(`${n} (${v}) has no FrameFlags entry`); else if (hv !== v) rows.push(`${n} = ${v} but FrameFlags.${ALIAS[key] ?? key} = ${hv}`); }
  verdict(rows.length === 0, 'every FLAG_ const names a FrameFlags entry of the same value', rows.join(' · '));
  const table = host.sort((a, b) => a[1] - b[1]).map(([n, v]) => `${v} ${n}`).join(' · ');
  console.log(`  bits in use: ${table}`);
  const free: number[] = []; for (let e = 0; e <= 30; e++) { const b = 2 ** e; if (!host.some(([, v]) => v === b)) free.push(b); }
  console.log(`  free bits: ${free.join(', ')}`);
}

// ---------------------------------------------------------------- 3. box flags
console.log('\n=== frame-layout: BoxFlag (boxes.ts) vs BOX_* (common.wgsl) ===');
{ const host = Object.entries(BoxFlag as Record<string, number>).filter(([, v]) => typeof v === 'number');
  const dup = host.filter(([, v], i) => host.findIndex(([, w]) => w === v) !== i);
  verdict(host.every(([, v]) => isPow2(v)) && dup.length === 0, `BoxFlag: ${host.length} names, each a distinct single bit`, dup.map(([n]) => n).join(', '));
  const wg = [...common.matchAll(/^const (BOX_[A-Z0-9_]+)\s*:\s*u32\s*=\s*([^;]+);/gm)].map(m => [m[1], lit(m[2])] as [string, number]);
  const byName = new Map(host.map(([n, v]) => [norm(n), v]));
  const rows: string[] = [];
  for (const [n, v] of wg) { const hv = byName.get(norm(n.replace(/^BOX_/, ''))); if (!Number.isFinite(v)) rows.push(`${n}: literal not understood`); else if (hv === undefined) rows.push(`${n} (${v}) has no BoxFlag entry`); else if (hv !== v) rows.push(`${n} = ${v} but BoxFlag = ${hv}`); }
  verdict(rows.length === 0 && wg.length >= 6, `every BOX_ const (${wg.length} ≥ 6 read) names a BoxFlag of the same value`, rows.join(' · '));
}

console.log(`\n=== frame-layout: ${fails ? `${fails} FAIL` : 'ALL PASS'} ===`);
export const frameLayoutFailures = () => fails;
if (import.meta.main && fails) process.exit(1);
