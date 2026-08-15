// SDF CHARACTER RIG (docs/internal/sdf-characters.md) — the CPU-held parts, headless:
//   sdfrig-fit      the round-cone fit off the shipped mannequin: deterministic (two solves agree bit for bit), every radius sane (1–20 cm), left / right slots mirror,
//                   per-slot rms under 30 mm and the whole under 25 mm, no overrides unaccounted for; prints the table
//   sdfrig-pack     BoxWorld.upload on the fake device turns a frame's proxy list into the rig exactly: r0 over the hand radius, r1's millimetres in misc's top byte,
//                   owner + albedo bits untouched, padding records left alone, the cull sphere fitted and holding every cone, idempotent, and rig = null (no fit attached) leaves the
//                   list as written
//   sdfrig-presets  the rig has no tier and no switch since the capsule cleanup (2026-08-11): the two extras (sdfRigSmooth / charSoftShadow) default off and Quality.apply
//                   leaves them alone at every preset (rows, like gpuParticles)
//   bun run tools/qa/probes.ts sdfrig
import { ROOT, fake } from './headless.ts';

const { loadGltfCharacter } = await import(`${ROOT}/src/anim/gltf.ts`);
const { fitRig, rigTable, RIG_SLOTS, RIG_SLOT_NAMES, RB_QUANT, RIG_KPAD, RIG_OVERRIDES } = await import(`${ROOT}/src/render/sdfrig.ts`);
const { BoxWorld } = await import(`${ROOT}/src/scene/boxes.ts`);
const { PRESETS, QUALITY_NAMES, Quality } = await import(`${ROOT}/src/ui/quality.ts`);

let fails = 0;
const verdict = (ok: boolean, label: string, detail = '') => { if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}${detail ? `\n    ${detail}` : ''}`); };
export const sdfrigFailures = () => fails;
const GLTF = 'file://' + ROOT + '/public/assets/ual/AnimationLibrary_Godot_Standard.gltf';

export async function sdfrigFit() {
  console.log('\n=== sdfrig-fit: the round-cone radius fit off the mannequin mesh ===');
  const ch = await loadGltfCharacter(GLTF);
  const a = fitRig(ch);
  const b = fitRig({ ...ch, mesh: { ...ch.mesh } });   // a second solve on a shallow copy (the cache is keyed on the mesh object)
  console.log(rigTable(a).split('\n').map((l: string) => '  ' + l).join('\n'));
  verdict(a.slots.length === RIG_SLOTS && RIG_SLOT_NAMES.length === RIG_SLOTS, `${RIG_SLOTS} slots fitted, named`);
  let same = true; for (let i = 0; i < RIG_SLOTS; i++) if (a.r0[i] !== b.r0[i] || a.r1[i] !== b.r1[i]) same = false;
  verdict(same, 'two solves agree bit for bit (deterministic)');
  const bad = a.slots.filter((s: any) => !(s.r0 >= 0.01 && s.r0 <= 0.2 && s.r1 >= 0.01 && s.r1 <= 0.2));
  verdict(bad.length === 0, 'every fitted radius within 1–20 cm', bad.map((s: any) => `${s.name} ${s.r0.toFixed(3)}/${s.r1.toFixed(3)}`).join(' · '));
  const pairs: [string, string][] = [['upperArmL', 'upperArmR'], ['forearmL', 'forearmR'], ['thighL', 'thighR'], ['shinL', 'shinR'], ['soleL', 'soleR']];
  const asym = pairs.filter(([l, r]) => { const L = a.slots.find((s: any) => s.name === l), R = a.slots.find((s: any) => s.name === r); return Math.abs(L.r0 - R.r0) > 0.002 || Math.abs(L.r1 - R.r1) > 0.002; });
  verdict(asym.length === 0, 'left / right limb slots mirror within 2 mm', asym.map(p => p.join('/')).join(' '));
  const worst = a.slots.reduce((m: any, s: any) => s.rms > m.rms ? s : m, a.slots[0]);
  const allN = a.slots.reduce((n: number, s: any) => n + s.n, 0), se = a.slots.reduce((n: number, s: any) => n + s.rms * s.rms * s.n, 0); const rmsAll = Math.sqrt(se / Math.max(1, allN));
  verdict(worst.rms < 0.03 && rmsAll < 0.025, `per-slot rms under 30 mm (worst ${worst.name} ${(worst.rms * 1000).toFixed(1)}), overall ${(rmsAll * 1000).toFixed(1)} mm under 25`);
  verdict(a.slots.every((s: any) => s.n >= 50), 'every slot fitted to ≥ 50 vertices', a.slots.filter((s: any) => s.n < 50).map((s: any) => `${s.name} ${s.n}`).join(' '));
  const ov = Object.keys(RIG_OVERRIDES); verdict(a.slots.filter((s: any) => s.overridden).length === ov.length, `${ov.length} hand override(s) applied and flagged`, ov.join(' '));
}

export async function sdfrigPack() {
  console.log('\n=== sdfrig-pack: BoxWorld.upload packs the fit into the capsule list ===');
  const ch = await loadGltfCharacter(GLTF); const fit = fitRig(ch);
  const dev = fake();
  const world = new BoxWorld(dev);
  // two characters' worth of synthetic proxies: a standing-ish set of 15 segments (a, r, b) round (10, 0, 12) and (14, 0, 12)
  const mk = (ox: number) => { const caps: number[][] = []; for (let i = 0; i < 15; i++) { const y0 = 0.1 + i * 0.1; caps.push([ox + (i % 3) * 0.1, y0, 12 + (i % 2) * 0.15, 0.05 + (i % 4) * 0.03, ox + ((i + 1) % 3) * 0.1, y0 + 0.25, 12 - (i % 2) * 0.1]); } return caps; };
  const c0 = mk(10), c1 = mk(14);
  world.resetCapsules(); world.addCharacterCapsules(7, [0.5, 0.25, 0.75], c0, [10, 0.9, 12, 1.5]); world.addCharacterCapsules(11, [0.2, 0.6, 0.4], c1, [14, 0.9, 12, 1.5]);
  const before = new Float32Array(world.capsuleData); const beforeU = new Uint32Array(world.capsuleU32);
  world.rig = null; world.upload();
  let untouched = true; for (let i = 0; i < 30 * 8; i++) if (world.capsuleU32[i] !== beforeU[i]) untouched = false;
  verdict(untouched && world.infoF32[27] === 1.5 && world.infoF32[31] === 1.5, 'rig = null (no fit attached): the list and the 1.5 m cull spheres exactly as addCharacterCapsules wrote them — no r1 byte, so the GPU reads r again (an untapered cone)');
  world.rig = { r0: fit.r0, r1: fit.r1, kPad: RIG_KPAD }; world.upload();
  let okR = true, okB = true, okKeep = true; const D = world.capsuleData, U = world.capsuleU32;
  for (let c = 0; c < 2; c++) for (let i = 0; i < 15; i++) { const o = (c * 15 + i) * 8; if (D[o + 3] !== fit.r0[i]) okR = false; const q = U[o + 7] >>> 24; if (q !== Math.max(1, Math.min(255, Math.round(fit.r1[i] / RB_QUANT)))) okB = false; if ((U[o + 7] & 0xffffff) !== (beforeU[o + 7] & 0xffffff)) okKeep = false; for (const k of [0, 1, 2, 4, 5, 6]) if (D[o + k] !== before[o + k]) okKeep = false; }
  verdict(okR, 'every real record\'s radius is the fitted r0 of its slot');
  verdict(okB, `misc's top byte = round(r1 ∕ ${RB_QUANT} m), 1‥255`);
  verdict(okKeep, 'end points, owner byte and rgb565 albedo untouched');
  let inside = true; let radii = '';
  for (let c = 0; c < 2; c++) { const bo = 24 + c * 4; const cx = world.infoF32[bo], cy = world.infoF32[bo + 1], cz = world.infoF32[bo + 2], rr = world.infoF32[bo + 3]; radii += ` ${rr.toFixed(3)}`;
    for (let i = 0; i < 15; i++) { const o = (c * 15 + i) * 8; const dA = Math.hypot(D[o] - cx, D[o + 1] - cy, D[o + 2] - cz) + D[o + 3], dB = Math.hypot(D[o + 4] - cx, D[o + 5] - cy, D[o + 6] - cz) + fit.r1[i]; if (dA > rr - RIG_KPAD + 1e-6 || dB > rr - RIG_KPAD + 1e-6) inside = false; } }
  verdict(inside && world.infoF32[27] < 1.5, `the fitted cull spheres (r${radii}) hold every cone end + radius with the smooth union's pad to spare, and are tighter than 1.5 m here`);
  const snap = new Uint32Array(world.capsuleU32); const info = new Float32Array(world.infoF32.subarray(24, 32)); world.upload();
  let idem = true; for (let i = 0; i < 30 * 8; i++) if (world.capsuleU32[i] !== snap[i]) idem = false; for (let i = 0; i < 8; i++) if (world.infoF32[24 + i] !== info[i]) idem = false;
  verdict(idem, 'a second upload with no game step re-applies to the same bytes (idempotent)');
  // (retired with the capsule cleanup, 2026-08-11: 'rig → null with no game step restores the game's words', 'tightBounds off keeps the 1.5 m sphere', 'tight again = the first application' —
  //  the rig has no off switch and no bounds option any more; a fresh list from the game is the only way the words change, below)
  world.resetCapsules(); world.addCharacterCapsules(7, [0.5, 0.25, 0.75], c0, [10, 0.9, 12, 1.5]); world.addCharacterCapsules(11, [0.2, 0.6, 0.4], c1, [14, 0.9, 12, 1.5]); world.upload();
  let same2 = true; for (let i = 0; i < 30 * 8; i++) if (world.capsuleU32[i] !== snap[i]) same2 = false; for (let i = 0; i < 8; i++) if (world.infoF32[24 + i] !== info[i]) same2 = false;
  verdict(same2, 'the same list written afresh by the game and uploaded = the first application byte for byte');
  // a padding record (radius 0) is left alone
  world.resetCapsules(); world.addCharacterCapsules(7, [0.5, 0.5, 0.5], c0.slice(0, 12), [10, 0.9, 12, 1.5]); world.upload();
  const oPad = 13 * 8; verdict(world.capsuleData[oPad + 3] === 0 && (world.capsuleU32[oPad + 7] >>> 24) === 0, 'a padding record (radius 0, y −100) keeps radius 0 and no r1 byte');
  verdict(world.capsuleData[3] === fit.r0[0] && (world.capsuleU32[7] >>> 24) > 0 && world.infoF32[27] < 1.5, 'and the real records of that shorter list are fitted, its sphere too');
}

export async function sdfrigPresets() {
  console.log('\n=== sdfrig-presets: no tier, no switch — apply() leaves the rig\'s two extras alone at every preset ===');
  const __hadLS = 'localStorage' in globalThis, __hadDoc = 'document' in globalThis, __hadWin = 'window' in globalThis;   // (installed for Quality's constructor; TORN DOWN below — a body-less fake `document` left on globalThis killed the breach in any later probe of the same process: wave-3 review)
  const __teardownDom = () => { if (!__hadLS) delete (globalThis as any).localStorage; if (!__hadDoc) delete (globalThis as any).document; if (!__hadWin) delete (globalThis as any).window; };
  (globalThis as any).localStorage ??= { getItem: () => null, setItem: () => { /* */ } }; (globalThis as any).document ??= { hidden: false }; (globalThis as any).window ??= globalThis;
  const { defaultSettings } = await import(`${ROOT}/src/engine.ts`);
  const eng: any = { settings: defaultSettings(), rc: { cfg: { nx: 40, ny: 4, nz: 28, cascades: 4, interval0: 1 } }, rebuildRc() { /* */ }, prewarmRc() { /* */ }, timer: { enabled: false, results: new Map() }, effectiveScale: 1 };
  const smoke: any = { params: { rbIters: 4 } };
  const q = new Quality(eng, smoke); const S = eng.settings;
  verdict(S.sdfRigSmooth === false && S.charSoftShadow === false && S.charSoftAnalytic === true, 'the two extras default OFF (smooth union in reflections, the drawn character shadows), the soft form analytic');
  console.log(`  presets: ${QUALITY_NAMES.map((n: string) => `${n} ${'rig' in PRESETS[n] ? 'HAS a rig field' : 'no rig field'}`).join(' · ')}`);
  let untouched = true;
  for (const name of QUALITY_NAMES) { S.sdfRigSmooth = true; S.charSoftShadow = true; S.charSoftAnalytic = false; q.apply(name); if (S.sdfRigSmooth !== true || S.charSoftShadow !== true || S.charSoftAnalytic !== false) untouched = false; }
  verdict(untouched, 'apply() at every preset leaves sdfRigSmooth / charSoftShadow / charSoftAnalytic as set by hand (rows, like gpuParticles — ?sdfsmooth / ?charsoft hold for the visit)');
  S.sdfRigSmooth = false; S.charSoftShadow = false; S.charSoftAnalytic = true; q.apply('high');
  __teardownDom();
}
