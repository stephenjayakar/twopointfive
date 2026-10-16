// dump_look.ts: the cast's LOOK as the game resolves it, for the Blender look sheets (render_look.py).
//
//   REPO=<tree> OUT=<dir> bun run dump_look.ts        → <OUT>/look.json + <OUT>/look.bin
//
// For each cast variant ONE representative man {who, team, side, tint, tint2, id}: his resolved per-slot rows (charMaterials.ts describePalette) and, for every
// vertex of the cast's union mesh (anim/gltf.ts loadGltfCast order), the FINAL linear albedo a DRY man's pixel stores, computed with gbuffer.wgsl fsSkin's
// statements (slot albedo → crease / ridge from the baked cavity × the slot's wear × the side's strengths → the ground's dust by bind-pose height), plus the
// dry lobe's roughness and gain (before the specular anti-aliasing term, which is per pixel).
// look.bin = Float32: positions[V*3] (bind pose, the check that the Blender side's vertex order is the game's), then per variant V*5 (r, g, b, rough, gain).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const REPO = resolve(process.env.REPO ?? `${import.meta.dir}/../../..`);
const OUT = resolve(process.env.OUT ?? './look-out');
mkdirSync(OUT, { recursive: true });
type V3 = [number, number, number];

const H = await import(`${REPO}/tools/qa/headless.ts`);
const CM = await import(`${REPO}/src/render/charMaterials.ts`);
const { sideOfTeam } = await import(`${REPO}/src/game/charLook.ts`);
const { castSide } = await import(`${REPO}/src/anim/gltf.ts`);
const { PLAYER_ID } = await import(`${REPO}/src/game/consts.ts`);
const src = (p: string) => readFileSync(`${REPO}/${p}`, 'utf8');
const notes: string[] = [];

// ---- the sources of each man's tints / id (read from the tree, so a changed tree gives its own)
const vecs = (s: string): V3[] => [...s.matchAll(/\[\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\]/g)].map(m => [+m[1], +m[2], +m[3]] as V3);
function teamTable(name: string): Record<string, V3> {
  const m = src('src/game/guards.ts').match(new RegExp(`const ${name}:[^=]*=\\s*\\{([^}]*)\\}`)); if (!m) throw new Error(`guards.ts: no ${name}`);
  const out: Record<string, V3> = {}; for (const e of m[1].matchAll(/(\w+):\s*\[\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\]/g)) out[e[1]] = [+e[2], +e[3], +e[4]];
  return out;
}
const TEAM_TINT = teamTable('TEAM_TINT'), TEAM_TINT2 = teamTable('TEAM_TINT2');
let SQUAD4: { name: string; tint: V3; tint2: V3 }[];
try { SQUAD4 = (await import(`${REPO}/src/game/nightbreach.ts`)).SQUAD4; } catch { SQUAD4 = []; }
if (!SQUAD4?.length) { notes.push('SQUAD4 not importable: operative team tints used for operator_2..5'); SQUAD4 = [0, 1, 2, 3].map(i => ({ name: `operative ${i + 1}`, tint: TEAM_TINT.operative, tint2: TEAM_TINT2.operative })); }
const qrfLine = src('src/game/qrf.ts').split('\n').find(l => l.includes('spawnUnit(') && l.includes('QRF-') && l.includes('tint:'));
const qrfT = qrfLine ? vecs(qrfLine.slice(qrfLine.indexOf('tint:'))) : [];
const C: any = await import(`${REPO}/src/game/consts.ts`);   // a tree that names the suit (QRF_TINT / QRF_TINT2) instead of writing it on the spawn line
const QRF = { tint: qrfT[0] ?? (C.QRF_TINT ? [...C.QRF_TINT] as V3 : TEAM_TINT.guard), tint2: qrfT[1] ?? (C.QRF_TINT2 ? [...C.QRF_TINT2] as V3 : TEAM_TINT2.guard) };
if (!qrfLine) notes.push('qrf.ts: no QRF spawn line with tints found; the guard team tints used for the responders');
const shiftLine = src('src/game/game.ts').split('\n').find(l => /const tints: Vec3\[\] = /.test(l));
const SHIFT = shiftLine ? vecs(shiftLine) : [TEAM_TINT.guard];
const office = JSON.parse(src('levels/office.json'));
const civDefs: { name: string; kind: string; tint: V3; tint2?: V3 }[] = office.civilians ?? [];
const idOf = (file: string, name: string, was: number) => { const m = src(file).match(new RegExp(`const ${name} = (\\d+)`)); if (!m) notes.push(`${file}: no \`const ${name} = N\` found, ${was} assumed`); return +(m?.[1] ?? was); };
const CIV_ID0 = idOf('src/game/civilians.ts', 'CIV_ID0', 40);
const UNIT_ID0 = idOf('src/game/guards.ts', 'UNIT_ID0', 20);

// ---- the cast, as the game loads it
const ch = await H.loadCastCharacter();
const cast = ch.cast; const m = ch.mesh; const V: number = m.vertexCount;
const sd = CM.charSlots(ch);
if (!sd.authored) notes.push('charSlots: the mesh did NOT read as authored (stand-in split)');
const SLOTS: string[] = [...CM.CHAR_SLOTS];

// cast.ts castVariantOf's by-id `pick`, restated: list[skip + id % (n - skip)] (a teammate in play is dealt by his place among the team: `operatorAt`)
const pick = (list: any[], id: number, skip = 0) => list.length > skip ? list[skip + id % (list.length - skip)] : list[id % list.length];
const variantFor = (team: string, trained: boolean, id: number, isSam = false) => {
  const ops = castSide(cast, 'operator'); if (isSam) return ops[0];
  return team === 'operative' ? pick(ops, id, 1) : team === 'civilian' ? pick(cast.variants.some((x: any) => x.side === 'civilian') ? castSide(cast, 'civilian') : castSide(cast, 'defender'), id)
    : pick(castSide(cast, trained ? 'responder' : 'defender'), id);
};

interface Man { who: string; team: string; trained: boolean; tint: V3; tint2: V3; id: number; sam?: boolean; from: string }
const men: Man[] = [];
men.push({ who: 'Sam', team: 'player', trained: false, tint: TEAM_TINT.player, tint2: TEAM_TINT2.player, id: PLAYER_ID, sam: true, from: 'guards.ts TEAM_TINT/TEAM_TINT2.player, consts.ts PLAYER_ID' });
SQUAD4.forEach((s, i) => men.push({ who: s.name, team: 'operative', trained: false, tint: s.tint, tint2: s.tint2, id: UNIT_ID0 + i, from: `nightbreach.ts SQUAD4[${i}], id = spawnUnit's first free from UNIT_ID0 (the four are spawned first, in roster order)` }));
// the office shift: game.ts gives route i the id 10 + i and tints[i % 3]; tint2 = the guard team's
for (let i = 0; i < 3; i++) men.push({ who: `shift guard ${i} (route ${i})`, team: 'guard', trained: false, tint: SHIFT[i % SHIFT.length], tint2: TEAM_TINT2.guard, id: 10 + i, from: 'game.ts guards: id 10 + route index, tints[i % 3]; tint2 = TEAM_TINT2.guard' });
// hostile units (the room clear's defenders): spawned after the four, so ids UNIT_ID0 + 4 …; team colours
for (let i = 0; i < 5; i++) men.push({ who: `Tango ${i + 1}`, team: 'hostile', trained: false, tint: TEAM_TINT.hostile, tint2: TEAM_TINT2.hostile, id: UNIT_ID0 + 4 + i, from: 'spawnUnit team hostile after the four-man squad: TEAM_TINT/TEAM_TINT2.hostile' });
for (let i = 0; i < 2; i++) men.push({ who: `QRF-${i + 1}`, team: 'guard', trained: true, tint: QRF.tint, tint2: QRF.tint2, id: UNIT_ID0 + i, from: 'qrf.ts spawnUnit tints; id = first free from UNIT_ID0 with only the shift on the floor' });
civDefs.forEach((c, i) => men.push({ who: `${c.name} (${c.kind})`, team: 'civilian', trained: false, tint: c.tint, tint2: c.tint2 ?? [0.06, 0.06, 0.08], id: CIV_ID0 + i, from: 'levels/office.json civilians[], civilians.ts CIV_ID0 + i' }));

// one man per variant: the FIRST in the list above that the game would deal that variant (so: Sam, the four, the shift before the Tangos, QRF-1/2, Marta/Owen)
const smooth = (e0: number, e1: number, x: number) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const variants: any[] = []; const blocks: Float32Array[] = [];
for (const v of cast.variants as any[]) {
  let man = men.find(x => variantFor(x.team, x.trained, x.id, x.sam).name === v.name);
  if (!man) {   // nobody on the list is dealt it: a plain man of the variant's side with an id that lands on it
    const side = v.side as string; const list = castSide(cast, side); const k = list.findIndex((x: any) => x.name === v.name);
    const team = side === 'operator' ? 'operative' : side === 'civilian' ? 'civilian' : 'guard'; const trained = side === 'responder';
    let id = team === 'operative' ? UNIT_ID0 : team === 'civilian' ? CIV_ID0 : 10; while (variantFor(team, trained, id).name !== v.name && id < 300) id++;
    if (variantFor(team, trained, id).name !== v.name) throw new Error(`${v.name}: no ${team} id under 300 is dealt this variant: the dealing rule restated here no longer covers the cast`);
    man = { who: `(made up) ${side} #${k}`, team, trained, tint: TEAM_TINT[team], tint2: TEAM_TINT2[team], id, from: 'NOT a man the game stands up: team tints, the first id that lands on this variant' };
    notes.push(`${v.name}: no listed man is dealt it; a made-up ${team} id ${id} used`);
  }
  const side: string = man.sam ? 'operator' : sideOfTeam(man.team, man.trained);
  const pal = new Float32Array(CM.CHAR_MAT_FLOATS); CM.writeCharPalette(pal, 0, side, man.tint, man.tint2, man.id, !sd.authored);
  const H0 = pal.subarray(0, 4), H1 = pal.subarray(4, 8);
  const out = new Float32Array(V * 5);
  for (let i = 0; i < V; i++) {
    const s = Math.min(sd.slot[i], CM.CHAR_SLOT_COUNT - 1); const p = 8 + s * 8;
    // vsSkin: A = (albedo, rough), B = (gain, soak, grime, wear) → fin = (A.w, B.x, B.y, 1), mvar = (B.z, B.w, H0.w, H1.w), grime = (H1.xyz, H0.y), geo = (cavity, H0.z)
    let r = pal[p], g = pal[p + 1], b = pal[p + 2]; const finX = pal[p + 3], finY = pal[p + 4];
    const mvx = pal[p + 6], mvy = pal[p + 7], mvz = H0[3], mvw = H1[3]; const geoX = sd.cavity[i], geoY = H0[2]; const mpy = m.positions[i * 3 + 1];
    // fsSkin, the `slotted` block, statement for statement
    const crease = Math.max(geoX, 0) * mvy, ridge = Math.max(-geoX, 0) * mvy;
    r *= 1 - mvz * crease; g *= 1 - mvz * crease; b *= 1 - mvz * crease;
    const kr = mvw * ridge; r += (r * 1.5 + 0.012 - r) * kr; g += (g * 1.5 + 0.012 - g) * kr; b += (b * 1.5 + 0.012 - b) * kr;
    const dust = mvx * (1 - smooth(H0[1], H0[1] + geoY, mpy)) * (0.75 + 0.25 * crease);
    const kd = clamp01(dust) * 0.6; r += (H1[0] - r) * kd; g += (H1[1] - g) * kd; b += (H1[2] - b) * kd;
    const kk = clamp01(dust + 0.5 * crease - 0.25 * ridge); const dRough = finX + (0.65 - finX) * kk;
    const dGain = finY * (1 - 0.7 * clamp01(dust)) * (1 - 0.5 * crease);
    out.set([r, g, b, dRough, dGain], i * 5);
  }
  blocks.push(out);
  // which slots this variant's worn parts actually carry (area share), and what each resolves to
  const W = sd.weights(v.mask); const tot = W.area.reduce((n: number, a: number) => n + a, 0) || 1;
  const desc = CM.describePalette(side, man.tint, man.tint2, man.id, !sd.authored);
  const share: Record<string, number> = {}; SLOTS.forEach((n, s) => { if (W.area[s] > 0) share[n] = Math.round(1000 * W.area[s] / tot) / 1000; });
  const picks: Record<string, number> = {}; SLOTS.forEach(n => { const k = CM.slotPick(side, n, man!.id, !sd.authored); if (k >= 0) picks[n] = k; });
  variants.push({ name: v.name, castSide: v.side, parts: v.parts, mask: v.mask, who: man.who, team: man.team, trained: man.trained, side, tint: man.tint, tint2: man.tint2, id: man.id, from: man.from,
    palette: desc, slotShare: share, picks, aliases: Object.fromEntries(SLOTS.map(n => [n, ((CM.charMatsOf ? CM.charMatsOf(side) : CM.CHAR_MATS[side]).slots[n] as any).as ?? null]).filter(e => e[1])) });
}

// ---- a live cross-check where it is cheap: the stood-up game's own Sam / shift / civilians, and four operatives through spawnUnit
const live: any[] = [];
try {
  const W = await H.standUp({ cast: true }); const g = W.game;
  const { castVariantOf } = await import(`${REPO}/src/game/cast.ts`);
  const row = (who: string, c: any, team: string, trained: boolean) => live.push({ who, id: c.id, tint: [...c.tint], tint2: [...c.tint2], variant: castVariantOf(g, c)?.name ?? null, side: team === 'player' ? 'operator' : sideOfTeam(team, trained) });
  row('Sam', g.player.char, 'player', false);
  for (const gd of g.guards) row(gd.name ?? `guard ${gd.char.id}`, gd.char, gd.team, !!gd.trained);
  for (const gd of g.civilians) row(gd.name ?? `civ ${gd.char.id}`, gd.char, gd.team, false);
  try {
    const { spawnUnit } = await import(`${REPO}/src/game/guards.ts`); const p = g.player.char.pos;
    SQUAD4.forEach((s, i) => { const gd = spawnUnit(g, { team: 'operative', pos: [p[0] + 0.8 * (i + 1), 0, p[2]], name: s.name, tint: s.tint, tint2: s.tint2, budget: 10, light: false }); row(s.name, gd.char, 'operative', false); });
  } catch (e) { notes.push(`live spawnUnit of the four refused: ${String(e).slice(0, 160)}`); }
  for (const L of live) {
    const mine = variants.find(x => x.who.startsWith(L.who) || (L.who === 'Sam' && x.who === 'Sam') || x.id === L.id && x.side === L.side);
    if (mine && (mine.name !== L.variant || mine.id !== L.id || mine.tint.some((x: number, k: number) => Math.abs(x - L.tint[k]) > 1e-6) || mine.tint2.some((x: number, k: number) => Math.abs(x - L.tint2[k]) > 1e-6)))
      notes.push(`LIVE MISMATCH ${L.who}: live id ${L.id} ${L.variant} tint ${L.tint} tint2 ${L.tint2} vs dumped ${mine.name} id ${mine.id} tint ${mine.tint} tint2 ${mine.tint2}`);
  }
} catch (e) { notes.push(`live cross-check not run: ${String(e).slice(0, 200)}`); }

let commit = ''; try { commit = execSync(`git -C "${REPO}" rev-parse --short HEAD`).toString().trim(); } catch { /* not a checkout */ }
const bin = new Float32Array(V * 3 + blocks.length * V * 5); bin.set(m.positions, 0); blocks.forEach((b, k) => bin.set(b, V * 3 + k * V * 5));
writeFileSync(`${OUT}/look.bin`, new Uint8Array(bin.buffer));
writeFileSync(`${OUT}/look.json`, JSON.stringify({ repo: REPO, commit, vertexCount: V, slots: SLOTS, parts: cast.parts, authored: sd.authored,
  bin: { file: 'look.bin', positions: [0, V * 3], perVariant: V * 5, layout: 'r g b rough gain (linear albedo; dry lobe roughness and gain before the per-pixel AA term)' },
  variants, live, notes }, null, 1));
console.log(`look: ${variants.length} variants x ${V} vertices from ${REPO} @ ${commit} -> ${OUT}/look.json (+ look.bin ${(bin.byteLength / 1e6).toFixed(1)} MB)`);
for (const v of variants) console.log(`  ${v.name.padEnd(12)} ${v.side.padEnd(9)} id ${String(v.id).padStart(3)}  tint ${JSON.stringify(v.tint)} tint2 ${JSON.stringify(v.tint2)}  ${v.who}`);
for (const n of notes) console.log('  NOTE ' + n);
