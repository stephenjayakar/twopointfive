// THE CAST (public/assets/chars/cast.gltf, tools/chars/README.md; src/anim/gltf.ts loadGltfCast · src/game/cast.ts · the part mask in CharInst) — headless:
//   cast-loader   the loader against a SYNTHETIC cast cut out of the mannequin (parts by region, the joint list shuffled, the slots dealt round): every vertex and triangle
//                 arrives, joints are re-mapped by NAME (the skinned rest pose is the mannequin's to the bit), matSel = slot + 16 × part, variants → masks; and files off
//                 contract are REFUSED (an unknown slot, a joint not on the skeleton, a variant wearing a part that is not there, 33 parts)
//   cast-file     the SHIPPED file: loads; operators, defenders and a civilian exist; every variant under the triangle budget and the union under its own; every part worn by
//                 somebody; feet on the floor, inside the mannequin's reach; every slot name legal (by loading); the mesh-shadow tree builds — its size printed
//   cast-fit      the round-cone proxy fit per VARIANT (render/sdfrig.ts fitRig(ch, mask)): finite, 1–30 cm, deterministic; an operator's trunk is not a defender's
//   cast-game     the Game stood on the cast: every man drawn wears a variant of HIS side (Sam the first operator), the mask is in his instance block and a fit under his id;
//                 the SIMULATION is the mannequin's — a seeded 20 s digests identically on either mesh (looks only); and on the mannequin every mask is 0
//   cast-look     THE LOOK (src/scene/look.ts LOOK.on → the second file cast-gwot.gltf, the second colour tables): cast-file's and cast-fit's
//                 checks hold on the second file too (both run on BOTH files); the two files deal the same variant names to the same sides in the same order; OFF = the
//                 masks cast.gltf has always had (frozen below); under the look every man wears a variant of HIS side and every defender the local suit;
//                 the colour tables switch and switch back (what is in the hands and on the heads — rifles, pistols, goggles — is not this probe's) — and THE
//                 SIMULATION DOES NOT KNOW: a seeded 20 s digests identically with the look on, with it off, and on the mannequin
//                 + THE SNEAKING SUIT (LOOK.suit; game/cast.ts sneakSuit): on the plain night and on a quiet mission as two, Sam (and the partner) drawn without helmet,
//                 back kit and mesh goggles, in black rows; on a room clear the issue dress; nothing with the suit's switch or the look off
//   bun run tools/qa/probes.ts cast
import { ROOT, standUp, loadCastOf } from './headless.ts';
import { spawnUnit, despawnUnit } from '../../src/game/guards.ts';
import { writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { loadGltfCharacter, loadGltfCast, SLOT_NAMES, CAST_PART_STEP, CAST_MAX_PARTS, castSide, castFile: castFileName, CAST_FILE, CAST_FILE_LOOK } = await import(`${ROOT}/src/anim/gltf.ts`);
const { fitRig, fitRigCast, rigTable, RIG_SLOTS, RIG_PAD_MAX } = await import(`${ROOT}/src/render/sdfrig.ts`);
const { meshBvhFor } = await import(`${ROOT}/src/render/meshShadows.ts`);
const { MESH_MAX_CHARS } = await import(`${ROOT}/src/render/meshbvh.ts`);
const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
const { castVariantOf, castParts, sneakSuit, officeDress } = await import(`${ROOT}/src/game/cast.ts`);

let fails = 0;
const verdict = (ok: boolean, label: string, detail = '') => { if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}${detail ? `\n    ${detail}` : ''}`); return ok; };
export const castFailures = () => fails;
const MANNEQUIN = 'file://' + ROOT + '/public/assets/ual/AnimationLibrary_Godot_Standard.gltf';
const { LOOK, setLookPlace, setSuitAs, suitAs, lookDress, lookOffice, placeOfQuery } = await import(`${ROOT}/src/scene/look.ts`);
const CAST_PATH = ROOT + '/public/assets/chars/' + castFileName();   // (the file this run stands on: cast-gwot.gltf under TPS_LOOK=1)
const pathOf = (look: boolean) => ROOT + '/public/assets/chars/' + (look ? CAST_FILE_LOOK : CAST_FILE);
/** the masks of cast.gltf's variants as they have always been (the look OFF must draw exactly these) */
const PLAIN_MASKS: Record<string, number> = { civilian_1: 805308416, civilian_2: 306186261, defender_1: 168298537, defender_2: 353372306, defender_3: 169871629, defender_4: 210241553, defender_5: 310904906, operator_1: 30217, operator_2: 46601, operator_3: 79370, operator_4: 144909, operator_5: 275978, responder_1: 3393196042, responder_2: 1245712393 };
/** the budgets tools/chars builds to (README there): one man, and everything in the file */
const MAX_VARIANT_TRIS = 14000, MAX_UNION_TRIS = 45000;

// ---- a synthetic cast cut out of the mannequin: parts by the height of a triangle's centre, slots dealt round, the joint list reversed (so only a by-name mapping skins it right)
function synthCast(ch: any, opts: { slot?: string; joint?: string; wears?: string; parts?: number } = {}): string {
  const m = ch.mesh; const T = m.indices.length / 3;
  const names = opts.parts ? Array.from({ length: opts.parts }, (_, i) => `p${i}`) : ['legs', 'trunk', 'arms_head'];
  const partOf = (t: number) => { const y = (m.positions[m.indices[t * 3] * 3 + 1] + m.positions[m.indices[t * 3 + 1] * 3 + 1] + m.positions[m.indices[t * 3 + 2] * 3 + 1]) / 3; return opts.parts ? t % opts.parts : y < 0.95 ? 0 : y < 1.35 ? 1 : 2; };
  const J = ch.skin.joints.length; const order = Array.from({ length: J }, (_, k) => J - 1 - k);   // file joint f = base joint order[f]
  const inv = new Array(J); order.forEach((b, f) => { inv[b] = f; });
  const chunks: Uint8Array[] = []; let off = 0; const views: any[] = [], accessors: any[] = [];
  const push = (a: ArrayBufferView, comp: number, type: string, count: number) => { const u8 = new Uint8Array(a.buffer, a.byteOffset, a.byteLength); const pad = (4 - (u8.length % 4)) % 4; chunks.push(u8); if (pad) chunks.push(new Uint8Array(pad)); views.push({ buffer: 0, byteOffset: off, byteLength: u8.length }); accessors.push({ bufferView: views.length - 1, componentType: comp, type, count }); off += u8.length + pad; return accessors.length - 1; };
  const nodes: any[] = order.map(b => ({ name: opts.joint && b === 3 ? opts.joint : ch.nodes[ch.skin.joints[b]].name }));
  const meshes: any[] = [];
  names.forEach((pn, pi) => {
    // one primitive per part: its triangles, vertices re-indexed
    const map = new Map<number, number>(); const idx: number[] = [];
    for (let t = 0; t < T; t++) { if (partOf(t) !== pi) continue; for (let c = 0; c < 3; c++) { const v = m.indices[t * 3 + c]; let n = map.get(v); if (n === undefined) { n = map.size; map.set(v, n); } idx.push(n); } }
    const vs = [...map.keys()]; const n = vs.length;
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3), W = new Float32Array(n * 4), Jn = new Uint8Array(n * 4);
    vs.forEach((v, k) => { for (let c = 0; c < 3; c++) { P[k * 3 + c] = m.positions[v * 3 + c]; N[k * 3 + c] = m.normals[v * 3 + c]; } for (let c = 0; c < 4; c++) { W[k * 4 + c] = m.weights[v * 4 + c]; Jn[k * 4 + c] = inv[m.joints[v * 4 + c]]; } });
    const prim = { attributes: { POSITION: push(P, 5126, 'VEC3', n), NORMAL: push(N, 5126, 'VEC3', n), JOINTS_0: push(Jn, 5121, 'VEC4', n), WEIGHTS_0: push(W, 5126, 'VEC4', n) }, indices: push(new Uint32Array(idx), 5125, 'SCALAR', idx.length), material: pi % SLOT_NAMES.length };
    meshes.push({ primitives: [prim] }); nodes.push({ name: pn, mesh: meshes.length - 1, skin: 0 });
  });
  const total = chunks.reduce((a, c) => a + c.length, 0); const bin = new Uint8Array(total); { let o = 0; for (const c of chunks) { bin.set(c, o); o += c.length; } }
  const materials = SLOT_NAMES.map((s: string, i: number) => ({ name: opts.slot && i === 1 ? opts.slot : s }));
  const variants: any = opts.parts ? { all: { side: 'operator', parts: names } } : { operator_1: { side: 'operator', parts: ['legs', 'trunk', 'arms_head'] }, defender_1: { side: 'defender', parts: ['legs', opts.wears ?? 'arms_head'] } };
  const g = { asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: nodes.map((_, i) => i) }], nodes, meshes, materials, accessors, bufferViews: views, skins: [{ joints: order.map((_, f) => f) }],
    buffers: [{ byteLength: total, uri: 'data:application/octet-stream;base64,' + Buffer.from(bin).toString('base64') }], extras: { cast: { version: 1, variants } } };
  const dir = mkdtempSync(join(tmpdir(), 'cast-probe-')); const p = join(dir, 'cast.gltf'); writeFileSync(p, JSON.stringify(g)); return 'file://' + p;
}

export async function castLoader() {
  console.log('\n=== cast-loader: the cast loader against a synthetic file cut out of the mannequin ===');
  const base = await loadGltfCharacter(MANNEQUIN);
  const ch = await loadGltfCast(synthCast(base), base);
  const m = ch.mesh, bm = base.mesh;
  verdict(m.indices.length === bm.indices.length && ch.cast.parts.join() === 'legs,trunk,arms_head', `three parts, every triangle arrives (${m.indices.length / 3} of ${bm.indices.length / 3})`, `parts ${ch.cast.parts.join(' ')} · tris ${ch.cast.partTris.join(' ')}`);
  verdict(ch.nodes === base.nodes && ch.skin === base.skin && ch.clips === base.clips, 'skeleton, skin and clips are the mannequin\'s own objects');
  // by-name joint mapping: every cast vertex has the position / joints / weights of the mannequin vertex it was cut from (matched by position; the file's joint list was reversed)
  { const key = (P: Float32Array, v: number) => `${P[v * 3]},${P[v * 3 + 1]},${P[v * 3 + 2]}`; const at = new Map<string, number>(); for (let v = 0; v < bm.vertexCount; v++) at.set(key(bm.positions, v), v);
    let bad = 0; for (let v = 0; v < m.vertexCount; v++) { const b = at.get(key(m.positions, v)); if (b === undefined) { bad++; continue; } for (let c = 0; c < 4; c++) { if (m.weights[v * 4 + c] > 0 && (m.joints[v * 4 + c] !== bm.joints[b * 4 + c] || Math.abs(m.weights[v * 4 + c] - bm.weights[b * 4 + c]) > 1e-6)) { bad++; break; } } }
    verdict(bad === 0, 'joints re-mapped by name: every vertex carries its source vertex\'s joints and weights', `${bad} differ`); }
  { let ok = true; for (let v = 0; v < m.vertexCount; v++) { const ms = m.matSel[v]; const part = Math.floor(ms / CAST_PART_STEP), slot = ms % CAST_PART_STEP; if (part !== m.part[v] || slot !== part % SLOT_NAMES.length || slot >= SLOT_NAMES.length) ok = false; }
    verdict(ok, `matSel = slot + ${CAST_PART_STEP} × part on every vertex, part mirrored in mesh.part`); }
  { const op = ch.cast.variants.find((v: any) => v.name === 'operator_1'), df = ch.cast.variants.find((v: any) => v.name === 'defender_1');
    verdict(op?.mask === 0b111 && df?.mask === 0b101 && op.side === 'operator' && df.side === 'defender' && df.tris === ch.cast.partTris[0] + ch.cast.partTris[2], 'variants → part masks and triangle counts', `operator_1 ${op?.mask} · defender_1 ${df?.mask} (${df?.tris} tris)`);
    verdict(castSide(ch.cast, 'civilian').length === 2, 'a side with no variant of its own falls back to all of them'); }
  const refused = async (label: string, o: any, want: RegExp) => { let msg = ''; try { await loadGltfCast(synthCast(base, o), base); } catch (e: any) { msg = String(e?.message ?? e); } verdict(want.test(msg), `refused: ${label}`, msg || 'it loaded'); };
  await refused('a material that is not a slot', { slot: 'leather' }, /not a slot/);
  await refused('a joint that is not on the skeleton', { joint: 'DEF-tail' }, /not on the mannequin/);
  await refused('a variant wearing a part that is not there', { wears: 'cape' }, /not a part/);
  await refused(`${CAST_MAX_PARTS + 1} parts`, { parts: CAST_MAX_PARTS + 1 }, /at most/);
  { const full = await loadGltfCast(synthCast(base, { parts: CAST_MAX_PARTS }), base); verdict(full.cast.variants[0].mask === 0xffffffff, `${CAST_MAX_PARTS} parts load, the mask is all 32 bits`); }
}

export async function castFile() { await castFileOf(false); await castFileOf(true); }
async function castFileOf(look: boolean) {
  console.log(`\n=== cast-file: the shipped public/assets/chars/${look ? CAST_FILE_LOOK : CAST_FILE}${look ? ' (the look)' : ''} ===`);
  if (!verdict(existsSync(pathOf(look)), 'the file exists')) return;
  const ch = await loadCastOf(look); const cast = ch.cast, m = ch.mesh;
  const union = m.indices.length / 3;
  console.log(`  ${cast.parts.length} parts, ${m.vertexCount} vertices, ${union} triangles in all`);
  console.log('  ' + cast.parts.map((p: string, i: number) => `${p} ${cast.partTris[i]}`).join(' · '));
  for (const v of cast.variants) console.log(`  ${v.name.padEnd(14)} ${v.side.padEnd(9)} ${String(v.tris).padStart(6)} tris  ${v.parts.join(' ')}`);
  const n = (s: string) => cast.variants.filter((v: any) => v.side === s).length;
  verdict(n('operator') >= 5 && n('defender') >= 4 && n('civilian') >= 1, `five operators, four defenders and a civilian at least (${n('operator')} / ${n('defender')} / ${n('civilian')})`);
  { const rs = cast.variants.filter((v: any) => v.side === 'responder'); const alien = /^(op_|kit_|nvg_|helmet$|hat_|bandana|tank_top|jacket_open|shirt_loose|local_suit|waistcoat|patu|scarf|pakol|turban|kufi|sandals)/;
    verdict(rs.length >= 1 && rs.every((v: any) => !v.parts.some((p: string) => alien.test(p))) && new Set(rs.map((v: any) => v.parts.filter((p: string) => p !== 'moustache' && p !== 'rsp_radio' && !p.startsWith('hair_') && !p.startsWith('head')).join())).size === 1,
      `the response element has an outfit of its own: one set of clothes for all ${rs.length} (a face, hair and the radio one of them carries aside), none of the operators' kit, none of the irregulars' hats or loose shirts`, rs.map((v: any) => `${v.name}: ${v.parts.join(' ')}`).join(' · ')); }
  const over = cast.variants.filter((v: any) => v.tris > MAX_VARIANT_TRIS);
  verdict(over.length === 0, `every variant at or under ${MAX_VARIANT_TRIS} triangles (the mannequin is 13,743)`, over.map((v: any) => `${v.name} ${v.tris}`).join(' · '));
  verdict(union <= MAX_UNION_TRIS && m.vertexCount < 1 << 16, `the union at or under ${MAX_UNION_TRIS} triangles (${union}), under 65,536 vertices (${m.vertexCount})`);
  { let all = 0; for (const v of cast.variants) all |= v.mask; const idle = cast.parts.filter((_: string, i: number) => !((all >>> i) & 1)); verdict(idle.length === 0, 'every part is worn by some variant', idle.join(' ')); }
  { const masks = new Set(cast.variants.map((v: any) => v.mask)); verdict(masks.size === cast.variants.length, 'no two variants wear the same parts'); }
  verdict(m.bboxMin[1] > -0.02 && m.bboxMax[1] < 1.98 && m.bboxMin[0] > -1.02 && m.bboxMax[0] < 1.02 && m.bboxMin[2] > -0.5 && m.bboxMax[2] < 0.5, 'feet on the floor, inside the mannequin\'s reach', `x ${m.bboxMin[0].toFixed(3)}‥${m.bboxMax[0].toFixed(3)} · y ${m.bboxMin[1].toFixed(3)}‥${m.bboxMax[1].toFixed(3)} · z ${m.bboxMin[2].toFixed(3)}‥${m.bboxMax[2].toFixed(3)}`);
  { // every variant stands on the floor and has a head: its own vertices span the height
    const bad: string[] = []; for (const v of cast.variants) { let lo = 1e9, hi = -1e9; for (let i = 0; i < m.vertexCount; i++) if ((v.mask >>> m.part[i]) & 1) { const y = m.positions[i * 3 + 1]; lo = Math.min(lo, y); hi = Math.max(hi, y); } if (!(lo < 0.03 && hi > 1.7)) bad.push(`${v.name} ${lo.toFixed(2)}‥${hi.toFixed(2)}`); }
    verdict(bad.length === 0, 'every variant reaches from the floor to over 1.7 m', bad.join(' · ')); }
  { const used = new Set<number>(); for (let i = 0; i < m.vertexCount; i++) used.add(m.matSel[i] % CAST_PART_STEP); console.log('  slots in use: ' + [...used].sort().map(s => SLOT_NAMES[s]).join(' '));
    const need = ['skin', 'cloth_uniform', 'cloth_plain', 'webbing', 'boot', 'helmet'].filter(s => !used.has(SLOT_NAMES.indexOf(s))); verdict(need.length === 0, 'skin, both cloths, webbing, boot and helmet are all in use', need.join(' ')); }
  { // degenerate triangles and normals
    let degen = 0, badN = 0; const P = m.positions, I = m.indices;
    for (let t = 0; t < union; t++) { const a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3; const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2]; if (Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) < 1e-10) degen++; }
    for (let v = 0; v < m.vertexCount; v++) { const l = Math.hypot(m.normals[v * 3], m.normals[v * 3 + 1], m.normals[v * 3 + 2]); if (!(l > 0.9 && l < 1.1)) badN++; }
    verdict(degen <= union * 0.002 && badN === 0, `unit normals everywhere, zero-area triangles under 0.2 % (${degen})`, `${badN} bad normals`); }
  { const t0 = performance.now(); const bvh = meshBvhFor(m); const ms = performance.now() - t0; const mb = ((4 + MESH_MAX_CHARS * bvh.numNodes * 2 + MESH_MAX_CHARS * bvh.numTris * 3) * 16) / 1048576;
    verdict(bvh.numTris === union && bvh.maxDepth + 2 <= 64, `the mesh-shadow tree builds: ${bvh.numNodes} nodes over ${bvh.numTris} triangles, ${bvh.maxDepth + 1} levels, ${ms.toFixed(0)} ms — ${mb.toFixed(1)} MB for ${MESH_MAX_CHARS} men (the mannequin's is 7.4)`); }
}

export async function castFit() { await castFitOf(false); await castFitOf(true); }
async function castFitOf(look: boolean) {
  console.log(`\n=== cast-fit: each variant's round-cone proxy fit — ${look ? CAST_FILE_LOOK : CAST_FILE} ===`);
  if (!verdict(existsSync(pathOf(look)), 'the file exists')) return;
  const ch = await loadCastOf(look); const cast = ch.cast;
  const base = await loadGltfCharacter(MANNEQUIN); const mf = fitRig(base);
  const row = (name: string, f: any) => `  ${name.padEnd(14)} ` + f.slots.map((s: any) => `${s.name.replace(/upper|fore/, (m: any) => m[0])} ${(s.r0 * 100).toFixed(0)}/${(s.r1 * 100).toFixed(0)}`).join(' ');
  console.log(row('mannequin', mf));
  const fits = new Map<string, any>(); const bad: string[] = [], few: string[] = [];
  for (const v of cast.variants) { const f = fitRig(ch, v.mask); fits.set(v.name, f); console.log(row(v.name, f));
    for (const s of f.slots) { if (!(Number.isFinite(s.r0) && Number.isFinite(s.r1) && s.r0 >= 0.01 && s.r0 <= 0.3 && s.r1 >= 0.01 && s.r1 <= 0.3)) bad.push(`${v.name}.${s.name} ${s.r0.toFixed(3)}/${s.r1.toFixed(3)}`); if (s.n < 8) few.push(`${v.name}.${s.name} ${s.n}`); } }
  verdict(bad.length === 0, 'every radius finite and within 1–30 cm', bad.join(' · '));
  verdict(few.length === 0, 'every slot of every variant found vertices to fit (none fell back to the hand radius)', few.join(' · '));
  { const pads = cast.variants.map((v: any) => `${v.name} ${((fits.get(v.name).pad ?? -1) * 100).toFixed(0)}`); const off = cast.variants.filter((v: any) => { const p = fits.get(v.name).pad; return !(p >= 0 && p <= RIG_PAD_MAX); });
    verdict(off.length === 0 && mf.pad === undefined, `the cull sphere's pad per outfit is measured and capped (cm outside the cones: ${pads.join(' · ')}); none on the mannequin`, off.map((v: any) => v.name).join(' ')); }
  { const v = cast.variants[0]; const again = fitRig({ ...ch, mesh: { ...ch.mesh } }, v.mask); const f = fits.get(v.name); let same = true; for (let i = 0; i < RIG_SLOTS; i++) if (f.r0[i] !== again.r0[i] || f.r1[i] !== again.r1[i]) same = false; verdict(same, 'two solves of one variant agree bit for bit'); }
  { const op = castSide(cast, 'operator')[0], df = castSide(cast, 'defender')[0]; const a = fits.get(op.name), b = fits.get(df.name); let d = 0; for (let i = 0; i < RIG_SLOTS; i++) d = Math.max(d, Math.abs(a.r0[i] - b.r0[i]), Math.abs(a.r1[i] - b.r1[i]));
    verdict(op.mask === df.mask || d > 0.003, `an operator's proxies are not a defender's (largest radius difference ${(d * 1000).toFixed(0)} mm)`);
    console.log(rigTable(a).split('\n').map((l: string) => '  ' + l).join('\n')); }
  { const all = fitRig(ch); verdict(all.verts === ch.mesh.vertexCount, 'mask 0 on the cast = the union of every part (the shared fall-back fit)'); }
}

const seeded = (s: number) => () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

export async function castGame() {
  console.log('\n=== cast-game: the Game stood on the cast ===');
  if (!verdict(existsSync(CAST_PATH), 'the file exists')) return;
  const sysRandom = Math.random;
  const runOn = async (cast: boolean) => {
    Math.random = seeded(20261008); const W: any = await standUp({ cast, ch: cast ? undefined : await loadGltfCharacter(MANNEQUIN) }); const hashes: string[] = [];
    for (let f = 0; f < 1200; f++) { W.input.keys.clear?.(); if (f > 60 && f < 600) W.input.keys.add('KeyW'); if (f > 300 && f < 700) W.input.keys.add('KeyD'); W.step(1 / 60); if (f % 120 === 119) hashes.push(hashDigest(digestGame(W.game, true))); }
    return { W, hashes };
  };
  try {
    const A = await runOn(true), B = await runOn(false);
    const g = A.W.game, cast = g.ch.cast;
    const men: any[] = [g.player.char, ...g.guards.map((x: any) => x.char), ...g.civilians.map((x: any) => x.char)];
    const drawn = men.filter(c => c.parts !== 0);
    verdict(!!cast && drawn.length >= 1 + g.guards.length, `every man drawn wears parts (${drawn.length} of ${men.length}; civilians off the floor are never drawn)`);
    { const sideOf = (c: any) => castVariantOf(g, c)?.side; const wrong: string[] = [];
      if (castVariantOf(g, g.player.char) !== castSide(cast, 'operator')[0]) wrong.push('Sam');
      for (const c of drawn) if (c.parts !== castParts(g, c) || (c.parts & ~castVariantOf(g, c).mask)) wrong.push(`id ${c.id} draws parts outside his variant`);
      for (const gd of g.guards) { const want = gd.team === 'operative' ? 'operator' : gd.team === 'civilian' ? 'civilian' : 'defender'; if (sideOf(gd.char) !== want) wrong.push(`${gd.callsign} (${gd.team}) wears ${sideOf(gd.char)}`); }
      const hasCiv = cast.variants.some((v: any) => v.side === 'civilian');
      for (const gd of g.civilians) if (hasCiv && gd.char.parts !== 0 && sideOf(gd.char) !== 'civilian') wrong.push(`${gd.callsign} wears ${sideOf(gd.char)}`);
      verdict(wrong.length === 0, 'Sam is the first operator; staff and hostiles wear defender variants, civilians civilian ones', wrong.join(' · '));
      const kinds = new Set(g.guards.map((x: any) => x.char.parts)); console.log(`  the shift: ${g.guards.map((x: any) => `${x.callsign} ${castVariantOf(g, x.char)?.name}`).join(' · ')}`);
      verdict(kinds.size >= Math.min(g.guards.length, castSide(cast, 'defender').length), `the shift's ${g.guards.length} men wear ${kinds.size} different variants`); }
    { const at = g.guards[0].char.pos; const mk = (name: string, dx: number) => spawnUnit(g, { team: 'guard', pos: [at[0] + dx, 0, at[2]], yaw: 0, weapon: 'aks74u', name });
      const hasR = cast.variants.some((v: any) => v.side === 'responder'); const q = mk('QRF-T1', 0.9); q.trained = true; const u = mk('UNIT-T2', -0.9);
      const vq = castVariantOf(g, q.char), vu = castVariantOf(g, u.char);
      verdict(vq?.side === (hasR ? 'responder' : 'defender') && vu?.side === 'defender', `a trained staff unit (the response team) wears the responder outfit, an untrained staff unit a defender's (${vq?.name} · ${vu?.name})`);
      despawnUnit(g, q); despawnUnit(g, u); }
    { const u: Uint32Array = g.chars.instU32; const list = [g.player.char, ...g.guards.map((x: any) => x.char)]; let ok = true; for (let i = 0; i < list.length; i++) if (u[i * 24 + 22] !== list[i].parts) ok = false;
      verdict(ok, 'each man\'s mask is in his instance block (CharInst.parts)'); }
    { const missing = drawn.filter(c => !g.rigFits?.has(c.id & 0xff)); verdict(!!g.rigFits && missing.length === 0, `a proxy fit under every drawn man's id (${g.rigFits?.size})`);
      const sam = g.rigFits.get(g.player.char.id & 0xff), want = fitRig(g.ch, g.player.char.parts); verdict(sam === want, 'Sam\'s is the fit of the parts he wears'); }
    { // the four-man squad (the loud demo's team): Sam + four operatives = five different operator variants; their defenders wear defender variants
      const { NIGHTBREACH } = await import(`${ROOT}/src/game/nightbreach.ts`); const was = NIGHTBREACH.squad;
      Math.random = seeded(7); const W: any = await standUp({ cast: true }); const g4 = W.game;
      try { NIGHTBREACH.squad = 4; const why = g4.nightBreach.start(); for (let f = 0; f < 30; f++) W.step(1 / 60);
        const ops = g4.guards.filter((x: any) => x.team === 'operative'), others = g4.guards.filter((x: any) => x.team !== 'operative');
        const names = [castVariantOf(g4, g4.player.char)?.name, ...ops.map((x: any) => castVariantOf(g4, x.char)?.name)];
        console.log(`  the four: Sam ${names[0]} · ${ops.map((x: any, i: number) => `${x.callsign} ${names[i + 1]}`).join(' · ')}   against ${others.map((x: any) => castVariantOf(g4, x.char)?.name.replace('defender_', 'd')).join(' ')}`);
        const nOps = castSide(g4.ch.cast, 'operator').length;
        verdict(!why && ops.length === 4 && names.every(n => n?.startsWith('operator')) && new Set(names).size === Math.min(5, nOps), `the squad of four + Sam wear ${Math.min(5, nOps)} different operator variants`, why ?? names.join(' '));
        verdict(others.length > 0 && others.every((x: any) => castVariantOf(g4, x.char)?.side === 'defender'), `their ${others.length} defenders all wear defender variants (${new Set(others.map((x: any) => x.char.parts)).size} different)`);
      } finally { NIGHTBREACH.squad = was; try { g4.nightBreach.stop(); } catch { /* the probe is over */ } } }
    { // the goggles are the game's: Sam (always in the rig's box goggles) draws neither mesh pair; a teammate the game gives no goggles keeps the mesh pair UP, whichever his variant lists
      const bit = (n: string) => { const i = cast.parts.indexOf(n); return i < 0 ? 0 : (1 << i) >>> 0; }; const up = bit('nvg_up'), down = bit('nvg_down');
      const sam = g.player.char.parts; const ops = castSide(cast, 'operator');
      verdict((up | down) !== 0 && (sam & (up | down)) === 0, 'Sam draws no mesh goggles (the rig\'s lit box goggles are his)');
      const fake: any = { ch: g.ch, id: 250 }; const res = ops.map((v: any) => { const c = { ...fake, id: 250 + ops.indexOf(v) }; return { v, c }; });
      const { castWear } = await import(`${ROOT}/src/game/cast.ts`); let ok = true;
      for (const { v, c } of res) { castWear(c, v.name); const m = castParts(g, c); if (!(m & up) || (m & down) || ((m & ~(up | down)) >>> 0) !== ((v.mask & ~(up | down)) >>> 0)) ok = false; }
      verdict(ok, `an operator the game gives no goggles wears the mesh pair flipped up, never down (all ${ops.length} variants)`); }
    verdict(A.hashes.length === 10 && A.hashes.every((h, i) => h === B.hashes[i]), 'the simulation is the mannequin\'s: a seeded 20 s digests identically on either mesh, every 2 s', A.hashes.map((h, i) => h === B.hashes[i] ? '=' : `≠@${(i + 1) * 2}s`).join(''));
    { const gm = B.W.game; const anyParts = [gm.player.char, ...gm.guards.map((x: any) => x.char)].some((c: any) => c.parts !== 0); const u: Uint32Array = gm.chars.instU32; let z = true; for (let i = 0; i < 16; i++) if (u[i * 24 + 22] !== 0) z = false;
      verdict(!gm.ch.cast && !anyParts && z && gm.rigFits === null, 'on the mannequin nobody has a mask, the instance word stays 0 and there are no per-man fits (the build as it was)'); }
  } finally { Math.random = sysRandom; }
}

/** THE LOOK: the second file and everything LOOK.on switches — and the simulation knowing none of it (see the head). */
export async function castLook() {
  console.log('\n=== cast-look: the look switch (scene/look.ts LOOK.on) — a second file, second colours, the same simulation ===');
  if (!verdict(existsSync(pathOf(false)) && existsSync(pathOf(true)), 'both files exist')) return;
  const was = LOOK.on, sysRandom = Math.random;
  try {
    verdict(castFileName(false) === CAST_FILE && castFileName(true) === CAST_FILE_LOOK && CAST_FILE !== CAST_FILE_LOOK, `the switch names the file: off ${castFileName(false)}, on ${castFileName(true)}`);
    const P = await loadCastOf(false), L = await loadCastOf(true);
    { const off = P.cast.variants.filter((v: any) => (PLAIN_MASKS[v.name] >>> 0) !== (v.mask >>> 0)).map((v: any) => v.name);
      verdict(P.cast.variants.length === Object.keys(PLAIN_MASKS).length && off.length === 0, `OFF = today's masks: all ${P.cast.variants.length} variants of ${CAST_FILE} wear the parts they always did`, off.join(' ')); }
    { const a = P.cast.variants.map((v: any) => `${v.name}:${v.side}`).join(' '), b = L.cast.variants.map((v: any) => `${v.name}:${v.side}`).join(' ');
      verdict(a === b, 'both files list the same variants on the same sides in the same order (a man is dealt the same NAME under either look)', a === b ? '' : `${a}\n    ${b}`); }
    { const same: string[] = [], diff: string[] = []; for (const v of L.cast.variants) { const o = P.cast.variants.find((x: any) => x.name === v.name); (o && o.parts.join() === v.parts.join() ? same : diff).push(v.name); }
      console.log(`  re-dressed by the look: ${diff.join(' ')}`); for (const n of diff) console.log(`    ${n.padEnd(12)} ${L.cast.variants.find((v: any) => v.name === n).parts.join(' ')}`);
      verdict(diff.length > 0 && diff.every(n => n.startsWith('defender')) && same.length + diff.length === L.cast.variants.length, `the look re-dresses the defenders only by part list (${diff.length}); operators, responders and civilians keep their part names (${same.length})`);
      const ds = castSide(L.cast, 'defender'); const bare = ds.filter((v: any) => !v.parts.includes('local_suit')).map((v: any) => v.name);
      verdict(bare.length === 0, `under the look every defender variant wears the long shirt and loose trousers (local_suit) — ${ds.length} of them`, bare.join(' '));
      const heads = ds.map((v: any) => v.parts.find((p: string) => /^(pakol|turban|kufi|scarf)$/.test(p)) ?? '-'); const rigs = ds.filter((v: any) => v.parts.includes('chest_rig')).length;
      verdict(new Set(heads).size >= 3 && rigs >= 1 && rigs < ds.length, `their heads differ (${heads.join(' ')}) and a chest rig is on some, not all (${rigs} of ${ds.length})`); }
    { // the goggle contract the game keys on survives (anim/gltf.ts castGoggles reads these two names)
      verdict(L.cast.parts.includes('nvg_up') === P.cast.parts.includes('nvg_up') && L.cast.parts.includes('nvg_down') === P.cast.parts.includes('nvg_down') && L.cast.parts.length <= CAST_MAX_PARTS, `the look's file carries the same goggle parts by name as today's and fits the mask (${L.cast.parts.length} parts of ${CAST_MAX_PARTS})`); }
    { // THE GOGGLE MOUNT (tools/chars/README.md stage 6): the brow plate on the operators' helmet, its outer face clear — where two-tube goggles are to hang
      const MOUNT = [0, 1.775, 0.1419], N = [0, 0.4695, 0.8829]; const res = (ch: any) => { const m = ch.mesh, hp = ch.cast.parts.indexOf('helmet'); let on = 0, proud = 0;
        for (let v = 0; v < m.vertexCount; v++) { if (m.part[v] !== hp) continue; const d = [m.positions[v * 3] - MOUNT[0], m.positions[v * 3 + 1] - MOUNT[1], m.positions[v * 3 + 2] - MOUNT[2]]; const along = d[0] * N[0] + d[1] * N[1] + d[2] * N[2]; const lat = Math.hypot(d[0] - N[0] * along, d[1] - N[1] * along, d[2] - N[2] * along); if (lat < 0.036 && Math.abs(along) < 0.002) on++; if (lat < 0.03 && along > 0.002) proud++; }
        return { on, proud }; };
      const a = res(L), b = res(P);
      verdict(a.on >= 4 && a.proud === 0 && b.on >= 4 && b.proud === 0, `the helmet's brow plate is where the README says (its outer face 0.206 up, 0.137 ahead of the head joint, facing 28° above straight ahead) with nothing of the helmet in front of it, in both files (${a.on} face vertices, ${a.proud} proud)`); }
    { // the colour tables
      const CM: any = await import(`${ROOT}/src/render/charMaterials.ts`);
      LOOK.on = false; const v0 = CM.charMatsVersion(), dOff = CM.charMatsOf('defender'), oOff = CM.charMatsOf('operator'), rOff = CM.charMatsOf('responder');
      LOOK.on = true; const v1 = CM.charMatsVersion(), dOn = CM.charMatsOf('defender'), oOn = CM.charMatsOf('operator'), rOn = CM.charMatsOf('responder');
      LOOK.on = false; const dBack = CM.charMatsOf('defender');
      verdict(dOff === CM.CHAR_MATS.defender && oOff === CM.CHAR_MATS.operator && dBack === dOff, 'look off: the colour tables are today\'s own objects (CHAR_MATS), and they come back when it is switched off again');
      verdict(dOn !== dOff && oOn !== oOff && rOn === rOff && v0 !== v1, 'look on: operators and defenders read a second table (CHAR_MATS_LOOK), responders the one they had; the tables\' version moves so the cached palettes re-pack');
      const lost: string[] = []; for (const side of ['operator', 'defender'] as const) for (const slot of SLOT_NAMES as string[]) if (!(slot in CM.CHAR_MATS_LOOK[side]) && (slot in CM.CHAR_MATS[side])) lost.push(`${side}.${slot}`);
      verdict(lost.length === 0, 'the second tables carry a row for every slot the first ones do', lost.join(' ')); }
    // the game under the look, the look off, the mannequin: one seeded script, three digests
    const runOn = async (which: 'look' | 'plain' | 'mannequin') => {
      LOOK.on = which === 'look'; Math.random = (() => { let s = 20261010; return () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
      const W: any = await standUp({ ch: which === 'mannequin' ? await loadGltfCharacter(MANNEQUIN) : await loadCastOf(which === 'look') }); const hashes: string[] = [];
      for (let f = 0; f < 1200; f++) { W.input.keys.clear?.(); if (f > 60 && f < 600) W.input.keys.add('KeyW'); if (f > 300 && f < 700) W.input.keys.add('KeyD'); if (f === 720 || f === 760 || f === 800) W.input.clicked?.add?.(0); W.step(1 / 60); if (f % 120 === 119) hashes.push(hashDigest(digestGame(W.game, true))); }
      return { W, hashes };
    };
    const A = await runOn('look'), B = await runOn('plain'), C = await runOn('mannequin');
    console.log(`  look on   ${A.hashes.join(' ')}`); console.log(`  look off  ${B.hashes.join(' ')}`); console.log(`  mannequin ${C.hashes.join(' ')}`);
    verdict(A.hashes.length === 10 && A.hashes.every((h, i) => h === B.hashes[i] && h === C.hashes[i]), 'THE SIMULATION DOES NOT KNOW WHICH LOOK IS DRAWN: a seeded 20 s (walking, then three rounds) digests identically with the look on, with it off and on the mannequin, every 2 s', A.hashes.map((h, i) => h === B.hashes[i] && h === C.hashes[i] ? '=' : `≠@${(i + 1) * 2}s`).join(''));
    { LOOK.on = true; const g = A.W.game, cast = g.ch.cast; const wrong: string[] = [];
      const men: any[] = [g.player.char, ...g.guards.map((x: any) => x.char), ...g.civilians.map((x: any) => x.char)].filter((c: any) => c.parts !== 0);
      if (castVariantOf(g, g.player.char) !== castSide(cast, 'operator')[0]) wrong.push('Sam');
      for (const c of men) if (c.parts !== castParts(g, c) || (c.parts & ~castVariantOf(g, c).mask)) wrong.push(`id ${c.id} draws parts outside his variant`);
      const suit = 1 << cast.parts.indexOf('local_suit');
      for (const gd of g.guards) { const want = gd.team === 'operative' ? 'operator' : gd.team === 'civilian' ? 'civilian' : 'defender'; const v = castVariantOf(g, gd.char); if (v?.side !== want) wrong.push(`${gd.callsign} (${gd.team}) wears ${v?.side}`); else if (want === 'defender' && !(gd.char.parts & suit)) wrong.push(`${gd.callsign} has no local suit`); }
      console.log(`  under the look: Sam ${castVariantOf(g, g.player.char)?.name} · ${g.guards.map((x: any) => `${x.callsign} ${castVariantOf(g, x.char)?.name}`).join(' · ')}`);
      verdict(cast.parts.includes('local_suit') && men.length >= 1 + g.guards.length && wrong.length === 0, `under the look every man drawn wears a variant of his side out of ${CAST_FILE_LOOK} (${men.length} men; the shift in the local suit)`, wrong.join(' · '));
      const gp = B.W.game; const offWrong = [gp.player.char, ...gp.guards.map((x: any) => x.char)].filter((c: any) => (PLAIN_MASKS[castVariantOf(gp, c)?.name] === undefined) || (c.parts & ~PLAIN_MASKS[castVariantOf(gp, c).name]) !== 0);
      const names = (w: any) => [w.game.player.char, ...w.game.guards.map((x: any) => x.char)].map((c: any) => castVariantOf(w.game, c)?.name).join(' ');
      verdict(offWrong.length === 0 && !gp.ch.cast.parts.includes('local_suit') && names(A.W) === names(B.W), 'with the look off the same men wear today\'s masks, and each is dealt the same variant NAME under either look', `${names(A.W)}\n    ${names(B.W)}`); }
    { // THE OFFICE IS NOT ONE OF THE LOOK'S PLACES (scene/look.ts setLookPlace / lookDress / lookOffice; game/cast.ts officeDress): the look on, the page booted on
      // the office family → the first cast file and its tables, its defenders dressed for a building, Sam's sneaking suit as on any level
      const Q = (q: string) => placeOfQuery(new URLSearchParams(q));
      verdict(!Q('') && !Q('level=relief') && !Q('levelFile=office.json&roomclear') && !Q('levelFile=office-t20.json') && Q('levelFile=compound.json&roomclear') && Q('levelFile=bazaar.json&quiet') && Q('levelFile=train-move.json') && Q('levelFile=officers-mess.json') && !Q('levelFile=compound') && !Q('levelFile=../compound.json'),
        'the place by the page\'s query: no levelFile, ?level=relief and office / office-* files are the office; every other level file is one of the look\'s places; a name the boot will not fetch is the office it falls back to');
      const CM: any = await import(`${ROOT}/src/render/charMaterials.ts`), wasSuit = LOOK.suit;
      try {
        LOOK.on = true; LOOK.suit = true; const vLook = CM.charMatsVersion(); setLookPlace(false);
        verdict(!lookDress() && lookOffice() && castFileName() === CAST_FILE && CM.charMatsOf('defender') === CM.CHAR_MATS.defender && CM.charMatsOf('operator') === CM.CHAR_MATS.operator && CM.charMatsOf('operator', true) === CM.SNEAK_SUIT && CM.charMatsVersion() !== vLook,
          `on the office under the look: the file is ${CAST_FILE}, the tables are the first ones, the suit's rows are still the suit's, and the tables' version moves`);
        const P2 = await loadCastOf(false), defs = castSide(P2.cast, 'defender'), kept = officeDress(P2.cast.parts, defs), FIELD = ['hat_straw', 'hat_boonie', 'bandana', 'bandolier', 'tank_top'];
        const partsOf = (v: any) => P2.cast.parts.filter((_: string, i: number) => v.mask & (1 << i));
        verdict(kept.length >= 2 && kept.length < defs.length && kept.every((v: any) => !partsOf(v).some((n: string) => FIELD.includes(n))) && officeDress(L.cast.parts, castSide(L.cast, 'defender')).length === castSide(L.cast, 'defender').length,
          `dressed for a building: of ${defs.length} defenders ${kept.map((v: any) => v.name).join(', ')} are dealt (no straw hat, boonie, bandana, bandolier or vest top); a cast without those parts loses nobody`);
        Math.random = (() => { let s = 7; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();
        const W: any = await standUp({ ch: P2 }); W.step(1 / 60); const g = W.game, bad: string[] = [];
        for (const gd of g.guards) { const v = castVariantOf(g, gd.char); if (!v || v.side !== 'defender' || !kept.includes(v)) bad.push(`${gd.callsign} ${v?.name}`); }
        console.log(`  on the office under the look: Sam ${castVariantOf(g, g.player.char)?.name}${sneakSuit(g, g.player.char) ? ' (the suit)' : ''} · ${g.guards.map((x: any) => `${x.callsign} ${castVariantOf(g, x.char)?.name}`).join(' · ')}`);
        verdict(g.guards.length >= 3 && bad.length === 0 && sneakSuit(g, g.player.char), 'the office\'s shift is dealt only those variants, and Sam on the plain night is in the sneaking suit there too', bad.join(' · '));
        setLookPlace(true);
        verdict(lookDress() && !lookOffice() && castFileName() === CAST_FILE_LOOK && CM.charMatsOf('defender') !== CM.CHAR_MATS.defender, 'a place of the look\'s again: the second file and tables');
        LOOK.on = false; setLookPlace(false);
        verdict(!lookDress() && !lookOffice() && castFileName() === CAST_FILE, 'with the look off the place changes nothing: no office rule, the first file');
      } finally { setLookPlace(true); LOOK.on = true; LOOK.suit = wasSuit; }
    }
    { // THE SNEAKING SUIT (scene/look.ts LOOK.suit; game/cast.ts sneakSuit; render/charMaterials.ts SNEAK_SUIT): black, no helmet, no back kit — on a mission that is
      // not a squad's loud one, for Sam and a quiet mission's partner; nothing with either switch off; and it is looks (the digests above ran with it on)
      const CM: any = await import(`${ROOT}/src/render/charMaterials.ts`); const { charLookFrame } = await import(`${ROOT}/src/game/charLook.ts`);
      const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`); const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`); const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
      const { readFileSync } = await import('node:fs'); const { castGoggles } = await import(`${ROOT}/src/anim/gltf.ts`);
      const U = (CM.CHAR_SLOTS as string[]).indexOf('cloth_uniform'), WB = (CM.CHAR_SLOTS as string[]).indexOf('webbing'), BT = (CM.CHAR_SLOTS as string[]).indexOf('boot');
      const lumAt = (pal: Float32Array, slot: number) => 0.2126 * pal[8 + slot * 8] + 0.7152 * pal[9 + slot * 8] + 0.0722 * pal[10 + slot * 8];
      const worn = (g: any, c: any) => { const cast = g.ch.cast, m = castParts(g, c) >>> 0; return (cast.parts as string[]).filter((_: string, i: number) => (m & ((1 << i) >>> 0)) !== 0); };
      const hard = (ps: string[]) => ps.filter(n => n === 'helmet' || n.startsWith('kit_') || n.startsWith('nvg_'));
      const cloth = (g: any, c: any) => { g.engine.settings.charMats = true; const F = charLookFrame(g); const pal = F.palette(c); return { u: lumAt(pal, U), w: lumAt(pal, WB), b: lumAt(pal, BT) }; };
      const wasSuit = LOOK.suit; try {
        LOOK.on = true; LOOK.suit = true; const g = A.W.game, sam = g.player.char, v = castVariantOf(g, sam);
        const on = worn(g, sam), con = cloth(g, sam);
        console.log(`  the plain night under the look: Sam wears ${on.join(' ')} · cloth ${con.u.toFixed(3)} rig ${con.w.toFixed(3)} boots ${con.b.toFixed(3)} (luminance)`);
        verdict(sneakSuit(g, sam) && hard(on).length === 0 && on.includes('op_suit') && on.includes('hands_glove') && on.some(n => n.startsWith('head')) && on.includes('hair_short'), 'the plain night under the look: Sam is in the suit — no helmet, no back kit, no mesh goggles; his head, hair, gloves and suit part drawn', hard(on).join(' '));
        verdict((castParts(g, sam) & ~v.mask) === 0, 'the suit draws nothing his variant does not wear (a subset of its mask)');
        verdict(con.u < 0.05 && con.w < 0.05 && con.b < 0.05 && Math.max(con.u, con.w, con.b) / Math.min(con.u, con.w, con.b) < 2, `its cloth, rig and boots are all black and within a stop of each other (${con.u.toFixed(3)} / ${con.w.toFixed(3)} / ${con.b.toFixed(3)})`);
        // THE SUIT'S RIFLE (rigProps.ts RigOpts.rifleBlack ← combat.ts handProps): the 2010s carbine's dark earth furniture is drawn black on a man in the suit, tan on a loud mission
        const { handProps } = await import(`${ROOT}/src/game/combat.ts`); const { SC20K_TAG, M4_BOXES } = await import(`${ROOT}/src/game/rigProps.ts`); const { GEAR } = await import(`${ROOT}/src/game/gear.ts`);
        const rifleOf = (game: any, c: any) => { const was = GEAR.on; GEAR.on = true; try { const out: any[] = []; handProps(game, out); const r = out.filter((b: any) => b.name === SC20K_TAG && b.owner === (c.id & 0xff)); return { n: r.length, dark: r.filter((b: any) => Math.max(b.albedo[0], b.albedo[1], b.albedo[2]) < 0.08).length, tan: r.filter((b: any) => Math.abs(b.albedo[0] - 0.2) < 1e-6 && Math.abs(b.albedo[1] - 0.155) < 1e-6 && Math.abs(b.albedo[2] - 0.1) < 1e-6).length, geo: r.map((b: any) => [...b.c, ...b.h].map((x: number) => x.toFixed(4)).join(',')).join('|') }; } finally { GEAR.on = was; } };
        { const rb = rifleOf(g, sam); LOOK.suit = false; const rt = rifleOf(g, sam); LOOK.suit = true;
          verdict(rb.n === M4_BOXES && rb.tan === 0 && rb.dark === rt.dark + 5 && rt.n === M4_BOXES && rt.tan === 5 && rb.geo === rt.geo, `in the suit his carbine is drawn with no dark earth part (${rb.tan} of ${rb.n} boxes tan), the suit switched off puts the tan back (${rt.tan}), and not a box moves`); }
        { const f = fitRig(g.ch, castParts(g, sam)); let ok = !!f; for (let i = 0; ok && i < RIG_SLOTS; i++) ok = Number.isFinite(f.r0[i]) && Number.isFinite(f.r1[i]) && f.r0[i] > 0.005 && f.r0[i] < 0.3;
          const { castSuit } = await import(`${ROOT}/src/anim/gltf.ts`); const fresh = { ...g.ch, mesh: { ...g.ch.mesh } }; fitRigCast(fresh); const t0 = performance.now(); let hot = true; for (const v of castSide(g.ch.cast, 'operator')) { const a = fitRig(fresh, castSuit(g.ch.cast, v.mask)); hot = hot && !!a; } const ms = performance.now() - t0;
          verdict(ok && hot && ms < 5 && (castSuit(g.ch.cast, v.mask) >>> 0) === (castParts(g, sam) >>> 0), `the proxy fit of the suit's part mask solves (finite, 0.5–30 cm) and every operator's suit mask is solved AHEAD of play with the cast's others (sdfrig.ts fitRigCast: asked after it, all ${castSide(g.ch.cast, 'operator').length} answer from the cache in ${ms.toFixed(1)} ms)`); }
        LOOK.suit = false; const off = worn(g, sam), coff = cloth(g, sam);
        verdict(!sneakSuit(g, sam) && (castParts(g, sam) >>> 0) === (castGoggles(g.ch.cast, v.mask, true) >>> 0) && off.includes('helmet') && off.some(n => n.startsWith('kit_')) && coff.u > 0.12, `the suit switched off (?suit=0): Sam is the operators' issue again — his variant less the mesh goggles, helmet and kit on, the cloth the look's (${coff.u.toFixed(3)}); the cached rows re-pack on the switch`, off.join(' '));
        LOOK.suit = true; LOOK.on = false; verdict(!sneakSuit(g, sam) && !sneakSuit(B.W.game, B.W.game.player.char) && (castParts(B.W.game, B.W.game.player.char) >>> 0) === (castGoggles(B.W.game.ch.cast, castVariantOf(B.W.game, B.W.game.player.char).mask, true) >>> 0), 'the look off: no suit whatever its own switch says (the plain cast as it always was)');
        LOOK.on = true;
        { // a loud mission: the issue dress, for Sam and his men
          const W: any = await standUp({ ch: await loadCastOf(true) }); const gr = W.game; try { const r = startFromQuery(gr, '?roomclear'); for (let f = 0; f < 6; f++) W.step(1 / 60);
          const sm = gr.player.char, ps = worn(gr, sm), cl = cloth(gr, sm), ops = gr.guards.filter((x: any) => x.team === 'operative');
          verdict(!r.why && !!gr.roomClear?.active && !sneakSuit(gr, sm) && ps.includes('helmet') && ps.some(n => n.startsWith('kit_')) && cl.u > 0.12 && ops.length >= 2 && ops.every((x: any) => !sneakSuit(gr, x.char) && worn(gr, x.char).includes('helmet')), `a room clear (loud): Sam and his ${ops.length} men wear the issue dress — helmet, kit, the look's cloth (${cl.u.toFixed(3)})`, r.why ?? ps.join(' '));
          { const rl = rifleOf(gr, sm); verdict(rl.n === M4_BOXES && rl.tan === 5, `a loud mission: his carbine keeps its dark earth furniture (${rl.tan} of ${rl.n} boxes tan)`); }
          { // A PICTURE'S HOST SAYS THE DRESS (scene/look.ts setSuitAs): the same staged room clear, dressed as the quiet mission its card is — and back
            const mask = (c: any) => castParts(gr, c) >>> 0, was = [sm, ...ops.map((x: any) => x.char)].map(mask), staff = gr.guards.filter((x: any) => x.team !== 'operative'), sw = staff.map((x: any) => mask(x.char));
            try {
              setSuitAs('quiet'); const all = [sm, ...ops.map((x: any) => x.char)], rq = rifleOf(gr, sm);
              verdict(all.every((c: any) => sneakSuit(gr, c) && hard(worn(gr, c)).length === 0 && worn(gr, c).includes('op_suit')) && staff.every((x: any, i: number) => !sneakSuit(gr, x.char) && mask(x.char) === sw[i]) && rq.tan === 0,
                `asked to dress as a quiet mission, the staged room clear's Sam and ${ops.length} men stand in the suit (no helmet, no back kit, the rifle black) and the ${staff.length} defenders in their own`, all.map((c: any) => hard(worn(gr, c)).join('+') || '-').join(' '));
              setSuitAs(null); verdict(sneakSuit(gr, sm) && ops.every((x: any) => !sneakSuit(gr, x.char)), 'asked to dress as no mission: Sam alone in the suit, as on the plain night');
            } finally { setSuitAs(undefined); }
            verdict(suitAs() === undefined && !sneakSuit(gr, sm) && [sm, ...ops.map((x: any) => x.char)].every((c: any, i: number) => mask(c) === was[i]), 'nothing asked (as in play): the scenario decides again — every mask as it was before the ask'); }
          } finally { gr.nightBreach?.stop?.(); } }
        { // a quiet mission as two: Sam and the partner in the suit, the staff in their own
          const W: any = await standUp({ ch: await loadCastOf(true), level: loadLevel(parseLevelData(readFileSync(`${ROOT}/levels/quiet-yard.json`, 'utf8'))) }); const gq = W.game; try { const r = startFromQuery(gq, '?quiet=1&squad=1'); for (let f = 0; f < 6; f++) W.step(1 / 60);
          const sm = gq.player.char, mates: any[] = gq.quiet?.ops ?? [], staff = gq.guards.filter((x: any) => x.team !== 'operative');
          const pm = mates[0]?.char, pw = pm ? worn(gq, pm) : [], pc = pm ? cloth(gq, pm) : { u: 1, w: 1, b: 1 };
          verdict(!r.why && !!gq.quiet?.active && mates.length === 1 && !!pm && sneakSuit(gq, sm) && hard(worn(gq, sm)).length === 0 && sneakSuit(gq, pm) && hard(pw).length === 0 && pw.includes('op_suit') && pc.u < 0.05, `a quiet mission as two: Sam and ${mates[0]?.callsign ?? 'the partner'} are both in the suit (his cloth ${pc.u.toFixed(3)})`, r.why ?? pw.join(' '));
          verdict(staff.length > 0 && staff.every((x: any) => !sneakSuit(gq, x.char) && (castParts(gq, x.char) >>> 0) === (castVariantOf(gq, x.char).mask >>> 0)), `…and the ${staff.length} staff wear their own variants whole`);
          verdict(!!pm && sm.parts === castParts(gq, sm) && pm.parts === castParts(gq, pm) && gq.rigFits?.has(sm.id & 0xff) && gq.rigFits?.has(pm.id & 0xff), 'the drawn frame carries the suit\'s mask for both and a proxy fit under each id');
          } finally { gq.quiet?.stop?.(); } }
      } finally { LOOK.suit = wasSuit; }
    }
  } finally { LOOK.on = was; Math.random = sysRandom; }
}
