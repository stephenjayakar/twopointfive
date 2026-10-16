// The 'charmats' family (render/charMaterials.ts + game/charLook.ts — a man shaded per material slot), run through probes.ts. The shading itself needs a GPU; what
// a headless bun can hold is everything the shader is HANDED and the promise that off is off:
//   charmats-slots    the loaded mesh's slot data: the mannequin (no slot-named material) takes the stand-in — every vertex a slot, the ten it deals all with surface,
//                     cavity finite in −1‥1 with both signs present, every proxy's weights summing to 1 — the material-name matcher, and a mesh whose materials ARE
//                     named after slots dealt by name with the unmatched one reported
//   charmats-tables   every side × slot resolves to a colour in 0‥1 and a finish the lobe can carry; the same man the same rows twice (no dice but his id); the
//                     operators one issue (cloth identical man to man) and the defenders not (≥ 3 shirts over eleven men); the two sides apart from above
//   charmats-off      a Game: switch off (the default) → the material rows are zeros and every proxy carries the one legacy colour; on → a header + eleven slots per man
//                     on screen and per-proxy colours; off again → zeros and the legacy colour the next frame; and the SIMULATION never notices (10 s digest equal)
//   charmats-shader   the WGSL and the TS agree on the row count / slot count, and the off path's statements are still there verbatim
//   charmats-cast     the CAST's meshes and the tables agree: the crease bake of what a man WEARS does not depend on parts he does not (welded per part — the old weld
//                     across the cast fails the same test), and a civilian's / a defender's shirt and trousers take the same two level colours with the switch off
//                     (the placeholder: gbuffer.wgsl slotAlbedo × the instance's two colours, charMaterials.ts placeholderTints) as the tables read them with it on
//   bun run tools/qa/probes.ts charmats
import { standUp, ROOT } from './headless.ts';
import { readFileSync } from 'node:fs';
const CM = await import(`${ROOT}/src/render/charMaterials.ts`);
const { LOOK } = await import(`${ROOT}/src/scene/look.ts`);   // (TPS_LOOK=1: the tables' checks run on the look's second tables, with the two rules that are the plain file's own stood down)
const { sideOfTeam } = await import(`${ROOT}/src/game/charLook.ts`);
const { sneakSuit } = await import(`${ROOT}/src/game/cast.ts`);
const { loadGltfCharacter } = await import(`${ROOT}/src/anim/gltf.ts`);
const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);

const DT = 1 / 60;
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const seeded = (s0: number) => () => { s0 |= 0; s0 = (s0 + 0x6D2B79F5) | 0; let t = Math.imul(s0 ^ (s0 >>> 15), 1 | s0); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const mannequin = () => loadGltfCharacter(`file://${ROOT}/public/assets/ual/AnimationLibrary_Godot_Standard.gltf`);
const lum = (c: number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const f3 = (x: number) => x.toFixed(3);

// ---------------------------------------------------------------- charmats-slots
export async function charmatsSlots() {
  const F = family('charmats-slots: what the mesh gives the shader — a slot and a cavity per vertex, a slot mix per shadow proxy (charMaterials.ts charSlots)');
  const ch = await mannequin(); const d = CM.charSlots(ch); const V = ch.mesh.vertexCount; const N = CM.CHAR_SLOT_COUNT;
  { const f: string[] = [];
    if (d.authored) f.push('the mannequin read as authored (its materials are M_Main / M_Joints)');
    if (d.slot.length !== V || d.cavity.length !== V) f.push(`lengths ${d.slot.length}/${d.cavity.length} vs ${V} vertices`);
    let bad = 0, pos = 0, neg = 0; for (let v = 0; v < V; v++) { if (!(d.slot[v] < N)) bad++; const c = d.cavity[v]; if (!(c >= -1 && c <= 1)) bad++; if (c > 0.15) pos++; if (c < -0.15) neg++; }
    if (bad) f.push(`${bad} vertices with a slot ≥ ${N} or a cavity outside −1‥1`);
    if (!(pos > 50 && neg > 50)) f.push(`cavity one-sided: ${pos} creases, ${neg} ridges past ±0.15`);
    const tot = d.area.reduce((n: number, a: number) => n + a, 0);
    const want = ['skin', 'cloth_uniform', 'cloth_plain', 'webbing', 'boot', 'helmet', 'metal_dark', 'rubber', 'lens', 'accent'];
    for (const n of want) if (!(d.area[CM.CHAR_SLOTS.indexOf(n)] > 0)) f.push(`the stand-in deals no surface to ${n}`);
    if (!(tot > 1.2 && tot < 3)) f.push(`surface ${tot.toFixed(2)} m² (a man is ~1.6‥2.2)`);
    F.verdict(f.length === 0, 'the mannequin: stand-in slots for every vertex, the ten it deals all with surface (it has no `eye`), cavity in range and two-sided', f.join('; ') || `${V} vertices · ${tot.toFixed(2)} m² · ` + CM.CHAR_SLOTS.map((n: string, s: number) => `${n} ${(100 * d.area[s] / tot).toFixed(1)}%`).join(' · ') + ` · cavity ${pos} creases / ${neg} ridges`); }
  { const f: string[] = []; const rows: string[] = [];
    for (let p = 0; p < 15; p++) { let s = 0, top = 0; for (let k = 0; k < N; k++) { const w = d.capWeights[p * N + k]; s += w; if (w > d.capWeights[p * N + top]) top = k; } if (Math.abs(s - 1) > 1e-4) f.push(`proxy ${p} sums to ${s}`); rows.push(`${p}:${CM.CHAR_SLOTS[top]}`); }
    const topOf = (p: number) => { let top = 0; for (let k = 0; k < N; k++) if (d.capWeights[p * N + k] > d.capWeights[p * N + top]) top = k; return CM.CHAR_SLOTS[top]; };
    if (topOf(1) !== 'webbing') f.push(`the chest's main slot is ${topOf(1)} (want the carrier: webbing)`);
    if (topOf(9) !== 'cloth_uniform' || topOf(12) !== 'cloth_uniform') f.push(`the thighs' main slot ${topOf(9)} / ${topOf(12)} (want cloth_uniform)`);
    if (!['boot', 'rubber'].includes(topOf(11))) f.push(`the left shoe's main slot is ${topOf(11)}`);
    if (!(d.capWeights[4 * N + CM.CHAR_SLOTS.indexOf('helmet')] > 0.2 && d.capWeights[4 * N + CM.CHAR_SLOTS.indexOf('skin')] > 0.2)) f.push('the head proxy is not a mix of helmet and skin');
    F.verdict(f.length === 0, 'every shadow proxy carries a slot mix summing to 1, and the right one leads (chest = carrier, thighs = trousers, shoes = boot, head = helmet + skin)', f.join('; ') || rows.join(' ')); }
  { const f: string[] = [];
    const cases: [string, string | null][] = [['skin', 'skin'], ['M_Skin', 'skin'], ['cloth_uniform.001', 'cloth_uniform'], ['Cloth-Plain', 'cloth_plain'], ['mat_webbing', 'webbing'], ['op_helmet', 'helmet'], ['skin_face', 'skin'], ['metal_dark', 'metal_dark'], ['Lens', 'lens'], ['accent', 'accent'], ['M_Main', null], ['M_Joints', null], ['', null], ['clothing', null]];
    for (const [name, want] of cases) { const s = CM.slotOfMaterialName(name); const got = s < 0 ? null : CM.CHAR_SLOTS[s]; if (got !== want) f.push(`'${name}' → ${got} (want ${want})`); }
    // a mesh that keeps the contract: the mannequin's two primitives renamed
    const m2 = { ...ch.mesh, materialNames: ['cloth_uniform', 'Trim_Stuff'] }; const d2 = CM.charSlots({ ...ch, mesh: m2 });
    if (!d2.authored) f.push('a mesh with a slot-named material did not read as authored');
    let wrong = 0; for (let v = 0; v < V; v++) if (d2.slot[v] !== (ch.mesh.matIndex[v] === 0 ? CM.CHAR_SLOTS.indexOf('cloth_uniform') : CM.CHAR_SLOTS.indexOf('cloth_plain'))) wrong++;
    if (wrong) f.push(`${wrong} vertices not in their material's slot (unmatched → cloth_plain)`);
    if (d2.unmatched.join() !== 'Trim_Stuff') f.push(`unmatched reported as [${d2.unmatched}]`);
    { // a CAST of part meshes as the models' loader makes them: part per vertex, slot in matSel's low four bits — two 'parts': everything (trousers), and the head again as a helmet
      const part = new Uint8Array(V), ms = new Float32Array(V); const top = ch.mesh.bboxMax[1];
      for (let v = 0; v < V; v++) { const head = ch.mesh.positions[v * 3 + 1] > top - 0.2; part[v] = head ? 1 : 0; ms[v] = (head ? 5 : 1) + 16 * part[v]; }
      const mc = { ...ch.mesh, part, matSel: ms }; const dc = CM.charSlots({ ...ch, mesh: mc });
      if (!CM.meshAuthored(mc) || !dc.authored) f.push('a cast of parts did not read as authored');
      let bad = 0; for (let v = 0; v < V; v++) if (dc.slot[v] !== (part[v] ? 5 : 1)) bad++; if (bad) f.push(`${bad} cast vertices not in matSel's slot`);
      const all = dc.weights(0), body = dc.weights(1), both = dc.weights(3); const H = CM.CHAR_SLOTS.indexOf('helmet');
      if (!(all.area[H] > 0) || body.area[H] !== 0 || both.area[H] !== all.area[H]) f.push(`weights per part mask: helmet area all ${all.area[H]} / body only ${body.area[H]} / both ${both.area[H]}`);
      if (dc.weights(1) !== body) f.push('weights(mask) not cached'); }
    const m3 = { ...ch.mesh, materialNames: ['Body', 'Joints', 'metal_dark'] }; if (CM.meshAuthored(m3)) f.push('a slot name on a material the mesh never uses made it authored');
    const mi = ch.mesh.matIndex.slice(); mi.fill(255, 0, 300); const m4 = { ...ch.mesh, materialNames: ['skin', 'helmet'], matIndex: mi }; const d4 = CM.charSlots({ ...ch, mesh: m4 });
    if (d4.slot[0] !== CM.CHAR_SLOTS.indexOf('cloth_plain') || !d4.unmatched.some((u: string) => u.includes('no material'))) f.push('a primitive with no material was not dealt plain cloth and reported');
    F.verdict(f.length === 0, 'material names → slots (prefixes, suffixes, case); a mesh that names them is dealt BY NAME with strays reported; names the mesh does not use do not count', f.join('; ') || `${cases.length} names · authored mesh: ${d2.unmatched.length} unmatched material reported`); }
  return F.done();
}

// ---------------------------------------------------------------- charmats-tables
export async function charmatsTables() {
  const F = family('charmats-tables: the material tables per side resolve, repeat, and tell the sides apart (charMaterials.ts CHAR_MATS / writeCharPalette)');
  CM.resetCharMats();
  const OP: [number[], number[]] = [[0.07, 0.09, 0.1], [0.07, 0.2, 0.6]], DEF: [number[], number[]] = [[0.36, 0.33, 0.24], [0.09, 0.08, 0.05]];
  { const f: string[] = []; let rows = 0;
    for (const side of ['operator', 'defender', 'responder', 'civilian']) for (let id = 1; id <= 40; id += 3) {
      const pal = new Float32Array(CM.CHAR_MAT_FLOATS); CM.writeCharPalette(pal, 0, side, side === 'operator' ? OP[0] : DEF[0], side === 'operator' ? OP[1] : DEF[1], id); rows++;
      if (pal[0] !== 1) f.push(`${side} ${id}: header ${pal[0]}`);
      for (let s = 0; s < CM.CHAR_SLOT_COUNT; s++) { const p = 8 + s * 8; const a = [pal[p], pal[p + 1], pal[p + 2]];
        if (!a.every(x => x >= 0 && x <= 1 && Number.isFinite(x))) f.push(`${side} ${id} ${CM.CHAR_SLOTS[s]} albedo ${a}`);
        if (!(pal[p + 3] >= 0.03 && pal[p + 3] <= 0.65)) f.push(`${side} ${CM.CHAR_SLOTS[s]} rough ${pal[p + 3]} outside the lobe's 0.03‥0.65`);
        if (!(pal[p + 4] >= 0 && pal[p + 4] <= 2)) f.push(`${side} ${CM.CHAR_SLOTS[s]} gain ${pal[p + 4]} outside 0‥2`);
        if (!(pal[p + 5] >= 0 && pal[p + 5] <= 1 && pal[p + 6] >= 0 && pal[p + 6] <= 1 && pal[p + 7] >= 0 && pal[p + 7] <= 1)) f.push(`${side} ${CM.CHAR_SLOTS[s]} soak/grime/wear out of 0‥1`); }
      for (let k = 8 + CM.CHAR_SLOT_COUNT * 8; k < CM.CHAR_MAT_FLOATS; k++) if (pal[k] !== 0) f.push(`${side} ${id}: spare float ${k} = ${pal[k]}`);
    }
    F.verdict(f.length === 0, 'every side × slot × man: a colour in 0‥1, a roughness and a gain the lobe can carry, the spare rows zero', [...new Set(f)].slice(0, 6).join('; ') || `${rows} palettes`); }
  { const f: string[] = [];
    const pal = (side: string, t: number[][], id: number, standIn = false) => { const p = new Float32Array(CM.CHAR_MAT_FLOATS); CM.writeCharPalette(p, 0, side, t[0], t[1], id, standIn); return p; };
    const slot = (p: Float32Array, n: string) => { const o = 8 + CM.CHAR_SLOTS.indexOf(n) * 8; return [p[o], p[o + 1], p[o + 2]]; };
    for (let id = 1; id <= 12; id++) { const a = pal('defender', DEF, id), b = pal('defender', DEF, id); if (a.join() !== b.join()) f.push(`defender ${id} differs call to call`); }
    const opCloth = new Set<string>(), defShirt = new Set<string>(), defHead = new Set<string>();
    let opTop = 0, defTop = 0; const N = 11;
    for (let id = 10; id < 10 + N; id++) {
      const o = pal('operator', OP, id), d = pal('defender', DEF, id);
      opCloth.add(slot(o, 'cloth_uniform').map(f3).join()); defShirt.add(String(CM.slotPick('defender', 'cloth_plain', id))); defHead.add(String(CM.slotPick('defender', 'helmet', id)));
      // what the game camera sees most of from above: head, shoulders (shirt), chest (carrier)
      opTop += (lum(slot(o, 'helmet')) + lum(slot(o, 'cloth_uniform')) + lum(slot(o, 'webbing'))) / 3; defTop += (lum(slot(d, 'cloth_plain')) + lum(slot(d, 'webbing'))) / 2;
    }
    if (opCloth.size !== 1) f.push(`operators' uniform cloth differs man to man (${opCloth.size} colours)`);
    if (defShirt.size < 3 || defShirt.has('-1')) f.push(`only ${defShirt.size} shirts dealt over ${N} defenders [${[...defShirt]}]`);
    if (defHead.size < 3) f.push(`only ${defHead.size} heads over ${N} defenders`);
    // (under the look 1.8×: the defenders' cloth is dealt either side of the mud-brick ground, pale or dark, and their rig is olive drab; the operators' suit a shade paler than it was)
    if (!(defTop / N > (LOOK.on ? 1.8 : 2) * (opTop / N))) f.push(`from above the sides are too close: operators ${f3(opTop / N)} vs defenders ${f3(defTop / N)} mean luminance`);
    // (under the look the marking is the trim DUSTED: four fifths of it at 0.8 and a fifth of the suit's cloth — the same top channel, at least half the trim's own there)
    const isTrim = (c: number[]) => LOOK.on ? c.indexOf(Math.max(...c)) === OP[1].indexOf(Math.max(...OP[1])) && Math.max(...c) > 0.5 * Math.max(...OP[1]) && Math.max(...c) > 2 * Math.min(...c) : c.map(f3).join() === OP[1].map(f3).join();
    const mk = slot(pal('operator', OP, 3), 'cloth_plain'); if (!isTrim(mk)) f.push(`an operator's marking (cloth_plain on the models: band, brassards) ${mk.map(f3)} is not his trim ${OP[1]}`);
    { const si = pal('operator', OP, 3, true); if (slot(si, 'cloth_plain').join() !== slot(si, 'cloth_uniform').join() || !isTrim(slot(si, 'accent'))) f.push('on the stand-in an operator\'s shirt is not his uniform, or his armband not his trim'); }
    const dl = slot(pal('defender', DEF, 3), 'lens'), ds = slot(pal('defender', DEF, 3), 'skin'); if (!LOOK.on && dl.join() !== ds.join()) f.push('a defender\'s lens faces are not his skin (he has no eye-pro)');   // (under the look the slot is his scarf / shawl: its own check below)
    // the look's defender palettes: nothing reads as a pair's marking (no cloth saturated unless it is a brown — red over green over blue with green at 0.72 of red or more —,
    // and on a head or a shoulder never green or blue the top channel), and no warm suit within 0.6 of a stop of the look's ground (mud brick, luminance 0.37)
    if (LOOK.on) {
      const D = CM.CHAR_MATS_LOOK.defender!.slots as Record<string, { pick?: number[][] }>;
      for (const n of ['cloth_plain', 'cloth_uniform', 'helmet', 'accent', 'lens']) for (const c of D[n].pick ?? []) {
        const mx = Math.max(...c), sat = (mx - Math.min(...c)) / mx, brown = c[0] >= c[1] && c[1] >= c[2] && c[1] >= 0.72 * c[0];
        if (sat > (brown ? 0.56 : 0.45)) f.push(`the look's defender ${n} ${c} is a saturated colour (${f3(sat)}): it reads as a marking`);
        if (n !== 'cloth_plain' && n !== 'cloth_uniform' && (c[1] > c[0] + 0.005 || c[2] > c[0] + 0.005)) f.push(`the look's defender ${n} ${c} (head / shoulders) has green or blue its top channel`);
        if (n === 'cloth_plain' && c[0] > c[1] + 0.01 && lum(c) > 0.24 && lum(c) < 0.55) f.push(`the look's defender suit ${c} is a warm cloth at luminance ${f3(lum(c))}: inside 0.24‥0.55 it vanishes on mud brick`);
      }
      if (!(D.cloth_plain.pick ?? []).length) f.push('the look\'s defender suits are not a pick table');
    }
    // the suits of two pairs sit nearer each other than their raw tints do (the pull toward one issue colour), and the pair still shows on the marking
    { const RED: number[][] = [[0.13, 0.06, 0.06], [0.6, 0.07, 0.05]], BLUE: number[][] = [[0.06, 0.075, 0.13], [0.07, 0.2, 0.6]];
      const dist = (x: number[], y: number[]) => Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
      const r = pal('operator', RED, 20), b = pal('operator', BLUE, 22), raw = dist(RED[0], BLUE[0]), worn = dist(slot(r, 'cloth_uniform'), slot(b, 'cloth_uniform'));
      if (!(worn < 0.75 * raw)) f.push(`two pairs' suits are as far apart as their raw tints (${f3(worn)} vs ${f3(raw)}): the pull toward the issue colour is gone`);
      if (!(dist(slot(r, 'accent'), slot(b, 'accent')) > 0.4)) f.push('the two pairs\' markings (accent: band, brassards) are not clearly apart'); }
    // each other side's ACCENT: on the cast its own row (the irregulars' pale naturals, never the colour of the top it is worn with; a tie darker than its shirt),
    // on the stand-in the shirt's row (the mannequin's accent is an armband region)
    { const dist = (x: number[], y: number[]) => Math.max(Math.abs(x[0] - y[0]), Math.abs(x[1] - y[1]), Math.abs(x[2] - y[2]));
      let near = 0; for (let id = 1; id <= 140; id++) { const d = pal('defender', DEF, id); if (dist(slot(d, 'accent'), slot(d, 'cloth_plain')) < (LOOK.on ? 0.05 : 0.1) || (!LOOK.on && lum(slot(d, 'accent')) < lum(slot(d, 'cloth_plain')))) near++; }   // (the look: the accent is a turban / skull cap — off-white, cream, grey or near black, never the shirt's own colour; a dark one is allowed, and a dark one on a dark shirt is 0.05 off it at the least)
      if (near) f.push(`${near} of 140 defenders wear a tee / straw hat the colour of their top (or darker than it)`);
      const QRF: number[][] = [[0.1, 0.11, 0.13], [0.05, 0.055, 0.06]], CIV: number[][] = [[0.78, 0.62, 0.08], [0.1, 0.12, 0.2]];
      { const c = pal('civilian', CIV, 7);   // (an odd id: the cast's office worker — the even ones are the cleaner, whose accent is her pale apron and kerchief)
        if (!(lum(slot(c, 'accent')) < 0.9 * lum(slot(c, 'cloth_plain')))) f.push(`a civilian's tie (accent) is not darker than his shirt`);
        const k = pal('civilian', CIV, 8); if (!(lum(slot(k, 'accent')) > 4 * lum(slot(k, 'cloth_uniform')))) f.push('the cleaner\'s kerchief and apron (accent, an even id) are not pale against her trousers'); }
      // the response team's accent is its white mark (helmet crown, vest back; the tie on that slot is under the vest): well clear of the helmet and the rig it sits on
      { const c = pal('responder', QRF, 7);
        if (!(lum(slot(c, 'accent')) > 3 * lum(slot(c, 'helmet')) && lum(slot(c, 'accent')) > 3 * lum(slot(c, 'webbing')))) f.push('the response team\'s mark (accent) does not stand out from its helmet and vest'); }
      // the response team's cap is not the black of the hair under it (hair is the `rubber` row), and is no lighter than their shirt
      { const r = pal('responder', QRF, 7);
        if (!(lum(slot(r, 'helmet')) > 2 * lum(slot(r, 'rubber')) && lum(slot(r, 'helmet')) <= lum(slot(r, 'cloth_plain')))) f.push('the response team\'s cap is hair-black, or lighter than their shirt'); }
      for (const [side, T] of [['defender', DEF], ['responder', QRF], ['civilian', CIV]] as [string, number[][]][]) { const s = pal(side, T, 7, true);
        if (slot(s, 'accent').join() !== slot(s, 'cloth_plain').join()) f.push(`on the stand-in a ${side}'s accent (the mannequin's armband) is not his shirt`); } }
    F.verdict(f.length === 0, 'no dice but the man\'s id; operators one issue with their trim as the marking, two pairs\' suits pulled together; defenders motley (shirts, heads) with bare eyes and a pale accent; a civilian\'s tie darker than his shirt, the cleaner\'s kerchief pale, the response team\'s mark clear of its helmet and vest; the response team\'s cap off hair-black; the stand-in\'s accent the shirt; the sides > 2× apart in value from above', f.join('; ') || `operators' cloth 1 colour · ${defShirt.size} shirts / ${defHead.size} heads over ${N} defenders · seen from above ${f3(opTop / N)} vs ${f3(defTop / N)}`); }
  { const f: string[] = []; const t: [string, string][] = [['operative', 'operator'], ['player', 'operator'], ['guard', 'defender'], ['hostile', 'defender'], ['civilian', 'civilian']];
    for (const [team, want] of t) if (sideOfTeam(team) !== want) f.push(`${team} → ${sideOfTeam(team)}`);
    if (sideOfTeam('guard', true) !== 'responder' || sideOfTeam('operative', true) !== 'operator') f.push('a trained staff unit is not a responder (or a trained operative stopped being an operator)');
    { const P = (id: number) => { const p = new Float32Array(CM.CHAR_MAT_FLOATS); CM.writeCharPalette(p, 0, 'responder', [0.1, 0.11, 0.13], [0.05, 0.05, 0.05], id); const at = (sl: string) => { const o = 8 + CM.CHAR_SLOTS.indexOf(sl) * 8; return [p[o], p[o + 1], p[o + 2]].map(f3).join(); }; return at('cloth_plain') + ' / ' + at('cloth_uniform'); };
      // one issue, two tones: the duty shirt is the suit's colour and the trousers its dark half, the same on every man
      if (P(30) !== P(31) || P(30) !== [0.1, 0.11, 0.13].map(f3).join() + ' / ' + [0.05, 0.05, 0.05].map(f3).join()) f.push(`the responders' cloth is not their issue's two colours man for man (${P(30)} vs ${P(31)})`); }
    F.verdict(f.length === 0, 'teams → tables: the squad and Sam operators, the shift and the cell defenders, the trained element (QRF) responders in one two-tone issue, civilians their own', f.join('; ') || t.map(x => x.join('→')).join(' · ')); }
  return F.done();
}

// ---------------------------------------------------------------- charmats-off
export async function charmatsOff() {
  const F = family('charmats-off: off hands the renderer nothing new, on hands it a table per man on screen, and the simulation never notices (game.ts × charLook.ts)');
  // (the SNEAKING SUIT held off for this probe — scene/look.ts LOOK.suit; the probe runner puts the table back after: under TPS_LOOK=1 Sam on the plain night would be all in black,
  //  and this probe asks about a man's rows and proxies in his SIDE's table — four colours and more across his proxies. cast-probes.ts cast-look holds the suit's own rows.)
  LOOK.suit = false;
  CM.resetCharMats();
  Math.random = seeded(7); const W: any = await standUp(); const { game } = W; const S = game.engine.settings;
  const mats = (): Float32Array => (game.chars as any).matData; const world = game.engine.world;
  const capColours = (c: number) => { const out = new Set<number>(); for (let i = 0; i < 15; i++) { const o = (c * 15 + i) * 8; if (world.capsuleData[o + 3] > 0) out.add((world.capsuleU32[o + 7] >>> 8) & 0xFFFF); } return out; };
  const legacy565 = (t: number[]) => { const a = t.map(x => x + (0.5 - x) * 0.3); return ((Math.round(a[0] * 31) & 31) << 11) | ((Math.round(a[1] * 63) & 63) << 5) | (Math.round(a[2] * 31) & 31); };
  const f: string[] = [];
  if (S.charMats !== false) f.push(`settings.charMats defaults to ${S.charMats}`);
  W.step(DT); const n = (game.chars as any).instanceCount as number;
  if (!mats().every(x => x === 0)) f.push('switch off: material rows not all zero');
  { const c0 = capColours(0); if (!(c0.size === 1 && c0.has(legacy565(game.player.char.tint)))) f.push(`switch off: Sam's proxies carry ${[...c0]} (want the one legacy colour ${legacy565(game.player.char.tint)})`); }
  S.charMats = true; W.step(DT);
  { const M = mats(); let headers = 0; for (let i = 0; i < n; i++) if (M[i * CM.CHAR_MAT_FLOATS] === 1) headers++; if (headers !== n) f.push(`switch on: ${headers} of ${n} men have a table`);
    for (let i = n; i < 16; i++) if (M[i * CM.CHAR_MAT_FLOATS] !== 0) f.push(`instance ${i} (nobody) has a table`);
    const c0 = capColours(0); if (c0.size < 4) f.push(`switch on: Sam's proxies carry only ${c0.size} colours`);
    { const pal = new Float32Array(CM.CHAR_MAT_FLOATS); CM.writeCharPalette(pal, 0, 'operator', [0.07, 0.09, 0.1], [0.07, 0.2, 0.6], 3); const sdd = CM.charSlots(game.ch); const a = CM.proxyAlbedos(sdd, pal, 0, 1, false), b = CM.proxyAlbedos(sdd, pal, 0, 1, true);
      if (a[0].join() === b[0].join() || a.slice(1).join() !== b.slice(1).join()) f.push('the whole-man mix (mesh hits) does not change record 0 alone'); }
    const sam = CM.describePalette('operator', game.player.char.tint, game.player.char.tint2, game.player.char.id, true, sneakSuit(game, game.player.char)); const o = 8 + CM.CHAR_SLOTS.indexOf('cloth_uniform') * 8;
    if (Math.abs(M[o] - sam.slot.cloth_uniform.albedo[0]) > 1e-3) f.push('Sam\'s rows are not the operator table\'s'); }
  const onRows = Array.from(mats().subarray(0, CM.CHAR_MAT_FLOATS)).join();
  W.step(DT); if (Array.from(mats().subarray(0, CM.CHAR_MAT_FLOATS)).join() !== onRows) f.push('his rows change frame to frame with nothing changed');
  game.player.char.tint = [0.3, 0.26, 0.17]; W.step(DT); if (Array.from(mats().subarray(0, CM.CHAR_MAT_FLOATS)).join() === onRows) f.push('a new suit colour did not reach his rows');
  S.charMats = false; W.step(DT);
  if (!mats().every(x => x === 0)) f.push('switch off again: rows not zero the next frame');
  { const c0 = capColours(0); if (!(c0.size === 1 && c0.has(legacy565(game.player.char.tint)))) f.push('switch off again: proxies not back to the one legacy colour'); }
  F.verdict(f.length === 0, 'off (the default): zero rows, one legacy colour per man; on: a table per man on screen and a colour per proxy, steady frame to frame, following his tints; off again: back the next frame', f.join('; ') || `${n} men on screen`);
  // the simulation: 10 s with the switch on ≡ 10 s with it off
  const run = async (on: boolean) => { Math.random = seeded(4242); const X: any = await standUp(); X.game.engine.settings.charMats = on; for (let i = 0; i < 600; i++) X.step(DT); return hashDigest(digestGame(X.game, true)); };
  const a = await run(false), b = await run(true);
  F.verdict(a === b, 'the game digests the same after 10 s with the switch on as with it off (a renderer switch: nothing reads it back)', `off ${a} · on ${b}`);
  return F.done();
}

// ---------------------------------------------------------------- charmats-shader
export async function charmatsShader() {
  const F = family('charmats-shader: the WGSL and the TS agree, and the off path is still the statements it was (gbuffer.wgsl × charMaterials.ts)');
  const src = readFileSync(`${ROOT}/src/render/shaders/gbuffer.wgsl`, 'utf8'); const f: string[] = [];
  const rows = /const CHAR_MAT_ROWS: u32 = (\d+)u;/.exec(src)?.[1]; if (Number(rows) !== CM.CHAR_MAT_ROWS) f.push(`CHAR_MAT_ROWS ${rows} in WGSL vs ${CM.CHAR_MAT_ROWS}`);
  if (!src.includes(`min(u32(slotGeo.x + 0.5), ${CM.CHAR_SLOT_COUNT - 1}u)`)) f.push(`vsSkin does not clamp the slot to ${CM.CHAR_SLOT_COUNT - 1}`);
  if (CM.CHAR_MAT_ROWS < 2 + 2 * CM.CHAR_SLOT_COUNT) f.push('the rows do not hold the slots');
  for (const keep of ['o.albedo = select(ch.tint, ch.tint2, matSel > 0.5);', 'o.id = 0xFFFFFu | (ch.owner << 20u) | (1u << 28u);', 'o.mat = vec2f(1.0, 0.0);', 'if (H0.x > 0.5) {', 'let slotted = v.fin.w > 0.5;'])
    if (!src.includes(keep)) f.push(`missing: ${keep}`);
  const comp = readFileSync(`${ROOT}/src/render/shaders/composite.wgsl`, 'utf8');
  if (!comp.includes('if ((id & 0x50000000u) == 0x50000000u) { let ws = wetCoatSpec(')) f.push('composite no longer lights a bit-28 + bit-30 pixel with wetCoatSpec — the slots\' highlight rides that');
  F.verdict(f.length === 0, 'row and slot counts agree; the two-tint statements, the dry id and the matte material word are still there; composite still lights the coat bits', f.join('; ') || `${rows} rows · ${CM.CHAR_SLOT_COUNT} slots`);
  return F.done();
}

// ---------------------------------------------------------------- charmats-cast
export async function charmatsCast() {
  const F = family('charmats-cast: the cast\'s meshes and the material tables agree (charMaterials.ts bakeCavity × game/cast.ts × gbuffer.wgsl slotAlbedo)');
  const { loadCastCharacter } = await import('./headless.ts');
  const ch: any = await loadCastCharacter(); const m = ch.mesh; const cast = ch.cast; const V = m.vertexCount;
  // (1) THE CREASE BAKE IS PER OUTFIT. Bake the whole cast; then bake a mesh that holds ONLY one variant's triangles. What that man wears must come out the same up to the
  //     one scale the bake normalises by (its percentile is taken over the mesh it is handed) — so the ratio sub ÷ union is ONE number over his vertices.
  { const spread = (perPart: boolean) => {
      const U = CM.bakeCavity(m, perPart); let worst = 0, who = '';
      for (const v of cast.variants) {
        const keep: number[] = []; for (let t = 0; t + 2 < m.indices.length; t += 3) if ((v.mask >>> m.part[m.indices[t]]) & 1) keep.push(m.indices[t], m.indices[t + 1], m.indices[t + 2]);
        const S = CM.bakeCavity({ ...m, indices: new Uint32Array(keep) }, perPart); const r: number[] = [];
        for (let i = 0; i < V; i++) if ((v.mask >>> m.part[i]) & 1) { const a = Math.abs(U[i]), b = Math.abs(S[i]); if (a > 0.05 && a < 0.9 && b < 0.9) r.push(S[i] / U[i]); }
        r.sort((a, b) => a - b); const med = r[r.length >> 1]; const dev = Math.max(Math.abs(r[0] - med), Math.abs(r[r.length - 1] - med)) / Math.abs(med);
        if (dev > worst) { worst = dev; who = `${v.name} (${r.length} vertices)`; }
      }
      return { worst, who };
    };
    const now = spread(true), old = spread(false);
    F.verdict(now.worst < 1e-3, 'what a variant wears bakes the same creases, up to the bake\'s one mesh-wide scale, whether or not the parts it never wears are in the mesh (welded per part)', `per part: worst spread of that scale over a man ${now.worst.toExponential(1)} on ${now.who} · for comparison the old weld across the whole cast: ${old.worst.toFixed(2)} on ${old.who}`); }
  // (2) NO PAIR OF PARTS WORN TOGETHER shares a position to the bit (so welding per part cuts nothing a man actually wears in two)
  { const key = (v: number) => `${Math.round(m.positions[v * 3] * 2e4)},${Math.round(m.positions[v * 3 + 1] * 2e4)},${Math.round(m.positions[v * 3 + 2] * 2e4)}`;
    const at = new Map<string, number>(); for (let v = 0; v < V; v++) at.set(key(v), (at.get(key(v)) ?? 0) | (1 << m.part[v]));
    let shared = 0; const bad = new Set<string>();
    for (const mask of at.values()) { if ((mask & (mask - 1)) === 0) continue; shared++; for (const v of cast.variants) { const w = mask & v.mask; if (w & (w - 1)) bad.add(v.name); } }
    F.verdict(bad.size === 0, 'the positions two parts share belong to parts no variant wears together (alternative boots, shirts, trousers, hands)', bad.size ? `worn together and coincident: ${[...bad].join(', ')}` : `${shared} of ${at.size} welded positions are shared across parts, none inside one outfit`); }
  // (3) SHIRT AND TROUSERS KEEP THEIR LEVEL COLOURS WHEN THE SWITCH FLIPS. The placeholder (switch off) draws cloth_uniform in the instance's FIRST colour and cloth_plain
  //     in its SECOND; the tables (switch on) read a civilian's tint as the shirt (cloth_plain) and tint2 as the trousers (cloth_uniform). The game hands the two over so they agree.
  { const f: string[] = []; const src = readFileSync(`${ROOT}/src/render/shaders/gbuffer.wgsl`, 'utf8');
    if (!/case 1u: \{ return tint; \}/.test(src) || !/case 2u: \{ return tint2; \}/.test(src)) f.push('gbuffer.wgsl slotAlbedo no longer draws cloth_uniform in tint and cloth_plain in tint2 — castSwapsTints assumes it');
    const tint = [0.5, 0.56, 0.7], tint2 = [0.11, 0.11, 0.13];
    const shirt = CM.slotAlbedo('civilian', 'cloth_plain', tint, tint2, 41), trousers = CM.slotAlbedo('civilian', 'cloth_uniform', tint, tint2, 41);
    if (shirt.join() !== tint.join() || trousers.join() !== tint2.join()) f.push(`the civilian table: shirt ${shirt.map(f3)} trousers ${trousers.map(f3)} — want the level's tint and tint2`);
    // the order follows the TABLES: each of the two cloth slots is handed the tint its row reads, on every side (1 = first colour is tint2, 2 = second is tint2)
    for (const side of ['operator', 'defender', 'responder', 'civilian'] as const) {
      const bits = CM.placeholderTints(side); const rowSrc = (slot: string) => { const T = CM.charMatsOf(side); let r: any = T.slots[slot]; while (r.as) r = T.slots[r.as]; return r.src as string | undefined; };
      const u = rowSrc('cloth_uniform'), p = rowSrc('cloth_plain'); const first = bits & 1 ? 'tint2' : 'tint', second = bits & 2 ? 'tint2' : 'tint';
      if ((u && u !== first) || (p && p !== second)) f.push(`${side}: the placeholder is handed ${first} / ${second}, the table reads ${u ?? '(its own)'} / ${p ?? '(its own)'}`);
    }
    if (CM.placeholderTints('operator') !== CM.TINTS_AS_IS) f.push('an operator\'s two no longer go over as they stand');
    if (CM.placeholderTints('civilian') !== 1) f.push('a civilian\'s two no longer go over trousers-first');
    const sideOf = (G: any, c: any) => c === G.player.char ? 'operator' : G.civilians.some((x: any) => x.char === c) ? 'civilian' : (() => { const gd = G.guards.find((x: any) => x.char === c); return sideOfTeam(gd.team, gd.trained); })();
    Math.random = seeded(11); const W: any = await standUp({ cast: true }); const g = W.game; W.step(DT);
    const near = (x: number, y: number) => Math.abs(x - y) < 1e-6; let civs = 0, others = 0;
    // every instance, found by the owner id in its record: (first colour, second colour) against the man's own two
    const each = (G: any, fn: (c: any, a: number[], b: number[], i: number) => void) => {
      const inst: Float32Array = (G.chars as any).instData, u = new Uint32Array(inst.buffer), n = (G.chars as any).instanceCount as number;
      const men = [G.player.char, ...G.guards.map((x: any) => x.char), ...G.civilians.map((x: any) => x.char)] as any[];
      for (let i = 0; i < n; i++) { const o = i * 24; const c = men.find(x => (x.id >>> 0) === u[o + 7]); if (!c) { f.push(`instance ${i}: nobody has id ${u[o + 7]}`); continue; } fn(c, [inst[o], inst[o + 1], inst[o + 2]], [inst[o + 4], inst[o + 5], inst[o + 6]], i); }
    };
    const same = (a: number[], b: number[]) => [0, 1, 2].every(k => near(a[k], b[k]));
    each(g, (c, a, b, i) => {
      const civ = g.civilians.some((x: any) => x.char === c), sam = c === g.player.char;
      const bits = CM.placeholderTints(sideOf(g, c));
      if (!(same(a, bits & 1 ? c.tint2 : c.tint) && same(b, bits & 2 ? c.tint2 : c.tint)) || (civ && !(same(a, c.tint2) && same(b, c.tint))) || (sam && !(same(a, c.tint) && same(b, c.tint2)))) f.push(`instance ${i} (${sam ? 'Sam' : civ ? 'a civilian' : 'staff'}): colours ${a.map(f3)} / ${b.map(f3)} for tints ${c.tint.map(f3)} / ${c.tint2.map(f3)}`);
      if (civ) civs++; else if (!sam) others++;
    });
    if (!civs) f.push('no civilian on screen to check');
    Math.random = seeded(11); const M: any = await standUp({ ch: await mannequin() }); M.step(DT);   // (the mannequin whatever TPS_CAST says)
    each(M.game, (c, a, b, i) => { if (!(same(a, c.tint) && same(b, c.tint2))) f.push(`the mannequin: instance ${i} is not handed his tint then his tint2`); });
    F.verdict(f.length === 0, 'switch off, each cloth slot of a cast man is drawn in the tint his side\'s table reads for it with the switch on (a civilian: shirt his tint, trousers his tint2); Sam\'s two and everybody\'s on the mannequin go over as they always did', f.join('; ') || `${civs} civilians, ${others} staff and Sam on the cast; every man on the mannequin`); }
  return F.done();
}
