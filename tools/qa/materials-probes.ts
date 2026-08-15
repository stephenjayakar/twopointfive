// Renderer v3 PHASE 4 — materials, ray-traced reflections, the detail layer (docs/internal/p4-materials.md) — the CPU-held / pure parts. The passes need the
// GPU (the Browser pane: boots, toggles, __png identity, the cost tables); what a headless bun can hold is everything AROUND them:
//   materials-finish     the finish (rough / metal) through the level format: the office file carries it per material and per box, loadLevel resolves box over
//                        material, an old file (no finish anywhere) loads to boxes without one, levelToData writes only what the paint does not say, the
//                        validator trips on bad values; and Box → GPU word → back (matWord ⇄ common.wgsl boxFinish, ported)
//   materials-presets    which presets switch the reflections on and with what (ultra ÷2 · 2 rays · ≤ 0.55 · 4, high ÷2 · 1 · ≤ 0.45 · 3, medium ÷3 · 1 · ≤ 0.35 · 3,
//                        low / verylow off), apply() writes exactly that, the ?nortreflect veto holds across apply()
//   materials-frame      the engine writes rtCfg.w = the divisor with the switch on and 0 with it off, holds Gloss DOWN while on whatever settings.gloss says,
//                        matCfg.w = the detail amount — read back off a real Engine's Frame bytes on the fake device; and settings aside, the first 624 bytes of the
//                        Frame uniform are what main (the fork point) writes for the same input, the new tail where common.wgsl reads it
//   materials-vndf       the GGX visible-normal sampler (a TS port of reflect.wgsl sampleGGXVNDF): every sample in the upper hemisphere, the importance-sampling
//                        identity ∫ D (h·n) dh = 1 recovered through its pdf, the mean reflected direction → the mirror direction as roughness → 0, anisotropy
//                        stretches the lobe along the axis it is told to
//   materials-arealight  the analytic stand-in for a panel on a rough finish (centre direction, lobe widened by r / 2d, no renormalisation) against a quadrature
//                        of the true GGX integral over a 1.2 × 0.6 panel: peak within −35 % / +60 % for rough 0.3‥0.45 — the choice reflect.wgsl rtGlints documents
//   materials-wear       the detail layer's traffic map (render/wear.ts) on the office: deterministic, the corridor route worn and a wall's inside not, every
//                        threshold stamped, the wall-proximity channel 1 at a wall's foot and 0 mid-room, the size the shader's mapping assumes
//   bun run tools/qa/probes.ts materials       (each prints PASS / FAIL lines and an '=== name: ALL PASS | N FAIL ===' verdict; probes.ts sets the exit code)
import { ROOT, fake } from './headless.ts';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const { OFFICE_DATA, buildLevel } = await import(`${ROOT}/src/scene/level.ts`);
const { loadLevel, levelToData } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { validateLevelData, canonicalLevelData, structuralDiff } = await import(`${ROOT}/src/scene/levelData.ts`);
const { makeBox, matWord, ROUGH_DEFAULT } = await import(`${ROOT}/src/scene/boxes.ts`);
const { PRESETS, QUALITY_NAMES, rtVeto, Quality } = await import(`${ROOT}/src/ui/quality.ts`);
const { FrameFlags, FRAME_BYTES, writeFrame, noWeather } = await import(`${ROOT}/src/render/frame.ts`);

/** the fork point of the current lane on main (the identity reference for the Frame bytes) */
const MAIN_REF = '6551c66';   // this lane's fork point on main (v3/image-quality): the markings' Frame of 704 B; sharp direct appends sharpCfg + sharpCfgB + sharpCfgC (48 B)
const MAIN_FRAME_BYTES = 704;

let fails = 0, section = 0;
const verdict = (ok: boolean, label: string, detail = '') => { if (!ok) { fails++; section++; } console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}${detail ? `\n    ${detail}` : ''}`); };
const done = (name: string) => { console.log(`\n=== ${name}: ${section ? `${section} FAIL` : 'ALL PASS'} ===`); section = 0; };
export const materialsFailures = () => fails;

/** common.wgsl boxFinish, ported: the one float back to (rough, metal, aniso) */
function decodeFinish(w: number) { const aniso = w >= 4; if (aniso) w -= 4; const metal = w >= 2; if (metal) w -= 2; return { rough: Math.min(1, Math.max(0, w)), metal, aniso }; }

// ------------------------------------------------------------------------------------------------------------------------------------------------ finish
export async function materialsFinish() {
  console.log('\n=== materials-finish: the finish through the level file, the loader both ways, the validator, the GPU word ===');
  const D = OFFICE_DATA; const mats = D.materials;
  const withRough = Object.entries(mats).filter(([, m]: any) => m.rough !== undefined).length;
  verdict(withRough >= 20 && mats.lino?.rough === 0.22 && mats.stone?.rough === 0.15 && mats.metal?.metal === true && mats.metal?.rough === 0.28 && mats.screenOff?.rough === 0.08 && mats.carpet?.rough >= 0.9,
    `office.json: ${withRough}/${Object.keys(mats).length} materials carry a finish (lino ${mats.lino?.rough}, stone ${mats.stone?.rough}, metal ${mats.metal?.rough} metal=${mats.metal?.metal}, screenOff ${mats.screenOff?.rough}, carpet ${mats.carpet?.rough})`);
  const boxRough = D.boxes.filter((b: any) => b.rough !== undefined);
  verdict(boxRough.length >= 9 && boxRough.every((b: any) => b.albedo && !b.material), `${boxRough.length} boxes carry their own finish, all of them inline-albedo one-offs (the racks, the server floor)`, boxRough.slice(0, 3).map((b: any) => `${b.id} ${b.rough}`).join(' · '));
  const L = loadLevel(D);
  const idx = (id: string) => D.boxes.findIndex((b: any) => b.id === id);
  const linoI = D.boxes.findIndex((b: any) => b.material === 'lino'), metalI = D.boxes.findIndex((b: any) => b.material === 'metal'), rackI = idx(boxRough[0]?.id), carpetI = D.boxes.findIndex((b: any) => b.material === 'carpet');
  const inlineNoFinish = D.boxes.findIndex((b: any) => b.albedo && b.rough === undefined && b.metal === undefined);
  verdict(L.boxes[linoI].rough === 0.22 && !L.boxes[linoI].metal && L.boxes[metalI].rough === 0.28 && L.boxes[metalI].metal === true && L.boxes[rackI].rough === boxRough[0].rough && L.boxes[inlineNoFinish].rough === undefined && L.boxes[carpetI].rough >= 0.9,
    'loadLevel: a lino box gets 0.22, a metal box 0.28 + metal, a rack its own 0.3, an inline box with no finish gets none (matte = ROUGH_DEFAULT on the GPU)',
    `lino ${L.boxes[linoI].rough} · metal ${L.boxes[metalI].rough}/${L.boxes[metalI].metal} · rack ${L.boxes[rackI].rough} · inline ${L.boxes[inlineNoFinish].rough}`);
  { const D2 = JSON.parse(JSON.stringify(D)); D2.boxes[carpetI].rough = 0.3; D2.boxes[metalI].metal = false; D2.boxes[metalI].rough = 0.5; const L2 = loadLevel(D2);
    verdict(L2.boxes[carpetI].rough === 0.3 && L2.boxes[metalI].rough === 0.5 && L2.boxes[metalI].metal === undefined, 'a box\'s own rough / metal override its material\'s (metal:false over a metal material = no metal)', `carpet box ${L2.boxes[carpetI].rough} · metal box ${L2.boxes[metalI].rough}/${L2.boxes[metalI].metal}`); }
  { const old = JSON.parse(JSON.stringify(D)); for (const m of Object.values(old.materials) as any[]) { delete m.rough; delete m.metal; } for (const b of old.boxes) { delete b.rough; delete b.metal; }
    const errs = validateLevelData(old); const Lo = loadLevel(old); const any = Lo.boxes.some((b: any) => b.rough !== undefined || b.metal !== undefined);
    const rest: string[] = []; const n = structuralDiff({ ...L, boxes: L.boxes.map((b: any) => { const c = { ...b }; delete c.rough; delete c.metal; return c; }) }, Lo, rest, 3);
    verdict(errs.length === 0 && !any && n === 0, 'a file without any finish (every rough / metal stripped) validates, loads, and gives the same Level minus the finishes', errs.length ? errs[0] : `${n} other diffs ${rest.join(' | ')}`); }
  { const D1 = levelToData(L, { name: D.name, materials: D.materials, boxIds: D.boxes.map((b: any) => b.id), boxGroups: D.boxes.map((b: any) => b.group), floors: D.floors, surfaces: D.surfaces, meta: D.meta, volumes: D.volumes, connectors: D.connectors, devices: D.devices });
    const diffs: string[] = []; const n = structuralDiff(canonicalLevelData(D), canonicalLevelData(D1), diffs, 4);
    verdict(n === 0, 'data → level → data keeps every finish where it was (materials by name, the one-offs per box, nothing duplicated onto 900 boxes)', diffs.join(' | '));
    const Lm = loadLevel(D); Lm.boxes[linoI].rough = undefined; delete Lm.boxes[linoI].rough;
    const Dm = levelToData(Lm, { name: D.name, materials: D.materials, boxIds: D.boxes.map((b: any) => b.id) }); const back = loadLevel(Dm);
    verdict(Dm.boxes[linoI].rough === ROUGH_DEFAULT && back.boxes[linoI].rough === ROUGH_DEFAULT, 'a finished-material box made matte at runtime is written as an explicit rough 1 and loads back matte', `written ${Dm.boxes[linoI].rough}`); }
  { const bad = JSON.parse(JSON.stringify(D)); bad.materials.lino.rough = 1.5; bad.materials.metal.metal = 'yes'; bad.boxes[3].rough = -0.1; bad.boxes[4].metal = 1;
    const errs: string[] = validateLevelData(bad);
    const want = [/materials\.lino: rough must be a number in \[0, 1\]/, /materials\.metal: metal must be a boolean/, /boxes\[3\].*rough must be/, /boxes\[4\].*metal must be/];
    verdict(want.every(re => errs.some(e => re.test(e))), 'the validator reports rough outside [0, 1] and a non-boolean metal, on materials and on boxes', errs.slice(0, 4).join(' | ')); }
  { const cases = [{}, { rough: 0.22 }, { rough: 0.28, metal: true }, { rough: 0.22, aniso: true }, { rough: 0.05, metal: true, aniso: true }, { rough: 1.7 }, { rough: -1 }, { metal: true }];
    const rows: string[] = []; let ok = true;
    for (const c of cases) { const b = makeBox({ c: [0, 0, 0], h: [1, 1, 1], ...c }); const w = matWord(b); const f = decodeFinish(Math.fround(w)); const wantR = Math.min(1, Math.max(0, (c as any).rough ?? ROUGH_DEFAULT));
      const good = Math.abs(f.rough - wantR) < 1e-6 && f.metal === !!(c as any).metal && f.aniso === !!(c as any).aniso; ok &&= good; rows.push(`${JSON.stringify(c)} → ${w.toFixed(3)} → ${f.rough.toFixed(2)}/${f.metal ? 'M' : '-'}/${f.aniso ? 'A' : '-'}${good ? '' : ' ✗'}`); }
    verdict(ok, 'matWord → f32 → boxFinish (ported) gives rough / metal / aniso back for every combination, clamping rough to [0, 1] and defaulting to matte', rows.join(' · ')); }
  done('materials-finish');
}

// ------------------------------------------------------------------------------------------------------------------------------------------------ presets
export async function materialsPresets() {
  console.log('\n=== materials-presets: which presets switch the reflections on, and with what ===');
  const P = PRESETS as Record<string, any>;
  verdict(P.ultra.rt.on && P.ultra.rt.div === 2 && P.ultra.rt.rays === 2 && P.ultra.rt.maxRough === 0.55 && P.ultra.rt.atrous === 4, 'ultra: on, half-res target, 2 rays, finishes ≤ 0.55, 4 à-trous', JSON.stringify(P.ultra.rt));
  verdict(P.high.rt.on && P.high.rt.div === 2 && P.high.rt.rays === 1 && P.high.rt.maxRough === 0.45 && P.high.rt.atrous === 3, 'high: on, half-res target, 1 ray, finishes ≤ 0.45, 3 à-trous', JSON.stringify(P.high.rt));
  verdict(P.medium.rt.on && P.medium.rt.div === 3 && P.medium.rt.rays === 1 && P.medium.rt.maxRough === 0.35, 'medium: on, third-res target, 1 ray, finishes ≤ 0.35 (floors, screens, steel)', JSON.stringify(P.medium.rt));
  verdict(['low', 'verylow'].every(n => !P[n].rt.on), 'low / verylow: off (the finish table and the detail layer stay: they live in the g-buffer)', ['low', 'verylow'].map(n => `${n} ${P[n].rt.on}`).join(' · '));
  verdict(QUALITY_NAMES.every((n: string) => P[n].rt && [1, 2, 3].includes(P[n].rt.div) && P[n].rt.rays >= 0 && P[n].rt.rays <= 4 && P[n].rt.maxRough > 0 && P[n].rt.maxRough < 1 && P[n].rt.atrous >= 1 && P[n].rt.atrous <= 4), 'every preset carries a well-formed rt block');
  { const __hadLS = 'localStorage' in globalThis, __hadDoc = 'document' in globalThis, __hadWin = 'window' in globalThis;   // (installed for Quality's constructor; TORN DOWN below — a body-less fake `document` left on globalThis killed the breach in any later probe of the same process: wave-3 review)
  const __teardownDom = () => { if (!__hadLS) delete (globalThis as any).localStorage; if (!__hadDoc) delete (globalThis as any).document; if (!__hadWin) delete (globalThis as any).window; };
  (globalThis as any).localStorage ??= { getItem: () => null, setItem: () => { /* */ } }; (globalThis as any).document ??= { hidden: false }; (globalThis as any).window ??= globalThis;
    const { defaultSettings } = await import(`${ROOT}/src/engine.ts`);
    const engine: any = { settings: defaultSettings(), rc: { cfg: { nx: 40, ny: 4, nz: 28, cascades: 4, interval0: 1 } }, rebuildRc() { /* */ }, timer: { enabled: false, results: new Map() }, effectiveScale: 1 };
    const smoke: any = { params: { rbIters: 4 } };
    const q = new Quality(engine, smoke);
    q.pin('low'); const offOk = engine.settings.rtReflect === false;
    q.pin('medium'); const md = { on: engine.settings.rtReflect, div: engine.settings.rtReflectDiv, rays: engine.settings.rtRays, maxR: engine.settings.rtMaxRough, at: engine.settings.rtAtrous };
    q.pin('high'); const hi = { on: engine.settings.rtReflect, div: engine.settings.rtReflectDiv, rays: engine.settings.rtRays, maxR: engine.settings.rtMaxRough, at: engine.settings.rtAtrous };
    q.pin('ultra'); const ul = { on: engine.settings.rtReflect, div: engine.settings.rtReflectDiv, rays: engine.settings.rtRays, maxR: engine.settings.rtMaxRough, at: engine.settings.rtAtrous };
    verdict(offOk && md.on && md.div === 3 && md.maxR === 0.35 && hi.on && hi.div === 2 && hi.rays === 1 && hi.maxR === 0.45 && hi.at === 3 && ul.on && ul.rays === 2 && ul.maxR === 0.55 && ul.at === 4, 'Quality.apply: low → off; medium / high / ultra → their blocks land in settings.rtReflect / rtReflectDiv / rtRays / rtMaxRough / rtAtrous', `medium ${JSON.stringify(md)} · high ${JSON.stringify(hi)} · ultra ${JSON.stringify(ul)}`);
    verdict(engine.settings.detail === 0.35, 'settings.detail defaults to 0.35 and no preset touches it', `detail ${engine.settings.detail}`);
    rtVeto.on = true; q.pin('medium'); q.pin('high'); const vetoed = engine.settings.rtReflect === false && engine.settings.rtReflectDiv === 2; rtVeto.on = false; q.pin('high'); const back = engine.settings.rtReflect === true;
    verdict(vetoed && back, '?nortreflect (rtVeto): high applies with the reflections held OFF (its divisor / rays still written); veto lifted → on again');
    // renderer v3 phase 5: the ultra-only extras (Preset.p5) — on in ultra, P5_OFF everywhere else, and a hop off ultra puts them back
    const p5of = () => ({ gi: engine.settings.giResample, rays: engine.settings.giResampleRays, mesh: engine.settings.rtMeshHits, reuse: engine.settings.rtHitReuse });
    q.pin('ultra'); const u5 = p5of(); q.pin('high'); const h5 = p5of(); q.pin('ultra'); q.pin('medium'); const m5 = p5of(); q.pin('low'); const l5 = p5of(); q.pin('verylow'); const v5 = p5of();
    verdict(u5.gi === 'temporal' && u5.rays === 2 && u5.mesh === true && u5.reuse === false, 'phase 5: ultra switches gather resampling (temporal, 2 fresh rays) and mesh hits ON, hit-lighting reuse OFF (measured no gain)', JSON.stringify(u5));
    verdict([h5, m5, l5, v5].every(x => x.gi === 'off' && x.mesh === false && x.reuse === false), 'phase 5: high / medium / low / verylow carry all three OFF (their passes byte for byte as they were), including straight after an ultra visit', [h5, m5, l5, v5].map(x => JSON.stringify(x)).join(' · '));
    verdict(QUALITY_NAMES.every((n: string) => P[n].p5 && ['off', 'temporal', 'full'].includes(P[n].p5.gi) && P[n].p5.giRays >= 1 && P[n].p5.giRays <= 4 && typeof P[n].p5.mesh === 'boolean' && typeof P[n].p5.reuse === 'boolean'), 'every preset carries a well-formed p5 block');   __teardownDom();
  }
  done('materials-presets');
}

// ------------------------------------------------------------------------------------------------------------------------------------------------ engine → Frame bytes
async function fakeEngine() {
  (globalThis as any).window ??= globalThis; (globalThis as any).devicePixelRatio ??= 1;
  const { Engine } = await import(`${ROOT}/src/engine.ts`);
  const { FollowCamera } = await import(`${ROOT}/src/game/camera.ts`);
  const inner = fake('device');
  const dev = new Proxy(inner, { get(t: any, p) { if (p === 'limits') return { maxStorageBuffersPerShaderStage: 10 }; return t[p]; } });   // (the fake coerces to 0: give the Engine's budget check a real number)
  const gpu: any = { device: dev, hasTimestamps: false, format: 'bgra8unorm', linearSampler: fake('sampler'), canvas: { clientWidth: 800, clientHeight: 500, width: 800, height: 500 }, ctx: fake('ctx') };
  const engine = new Engine(gpu); await engine.init();   // (the fake device answers the async pipeline creations with stand-ins that resolve at once)
  const cam = new FollowCamera(); cam.target = [20, 0, 14]; cam.aspect = 1.6; cam.rebuild(); cam.update(1 / 60, [20, 0, 14], null);
  return { engine, cam };
}
export async function materialsFrame() {
  console.log('\n=== materials-frame: what the engine writes into rtCfg / matCfg and the Gloss bit, and main\'s Frame bytes with everything off ===');
  const F = FrameFlags as Record<string, number>;
  verdict(!('RtReflect' in F), 'no frame-flag bit is spent on the reflections (rtCfg.w carries the switch; the last bit went to ReSTIR)');
  let E: any;
  try { E = await fakeEngine(); } catch (e: any) { verdict(false, 'a real Engine stands up on the fake device', String(e?.message ?? e).split('\n')[0]); done('materials-frame'); return; }
  const { engine, cam } = E;
  const after = (set: (s: any) => void) => { set(engine.settings); engine.render(cam, 1, 1 / 60, false); const u = new Uint32Array(engine.frameData), f = new Float32Array(engine.frameData); return { flags: u[62], rt: [f[156], f[157], f[158], f[159]], mat: [f[160], f[161], f[162], f[163]] }; };
  const on = after(s => { s.rtReflect = true; s.gloss = true; s.rtReflectDiv = 2; s.rtRays = 1; s.rtMaxRough = 0.45; s.detail = 0.35; });
  verdict(on.rt[3] === 2 && on.rt[0] === Math.fround(0.45) && on.rt[1] === 1 && (on.flags & F.Gloss) === 0, 'rtReflect on (+ gloss on): rtCfg = (0.45, 1, aniso, ÷2) and Gloss held DOWN — the reflection pass covers the polished floors', `rtCfg ${on.rt.map(v => +v.toFixed(3)).join(',')} flags 0x${on.flags.toString(16)}`);
  verdict(on.mat[3] === Math.fround(0.35) && on.mat[0] === 1 && on.mat[1] === 1 && on.mat[2] === 60, 'matCfg = (highlights 1, strength 1, ray bound 60, detail 0.35)', `matCfg ${on.mat.map(v => +v.toFixed(3)).join(',')}`);
  const d3 = after(s => { s.rtReflectDiv = 3; }); const d1 = after(s => { s.rtReflectDiv = 1; });
  verdict(d3.rt[3] === 3 && d1.rt[3] === 1 && engine.passes.rtDiv === 1, 'the divisor follows the setting (÷3, ÷1) into rtCfg.w and passes.rtDiv', `÷3 → ${d3.rt[3]} · ÷1 → ${d1.rt[3]}`);
  const gl = after(s => { s.rtReflect = false; s.gloss = true; s.rtReflectDiv = 2; });
  verdict(gl.rt[3] === 0 && (gl.flags & F.Gloss) !== 0, 'rtReflect off + gloss on: rtCfg.w = 0 (the pass is off), Gloss raised as before', `rtCfg.w ${gl.rt[3]} flags 0x${gl.flags.toString(16)}`);
  const off = after(s => { s.rtReflect = false; s.gloss = false; s.detail = 0; });
  verdict(off.rt[3] === 0 && (off.flags & F.Gloss) === 0 && off.mat[3] === 0, 'both off, detail 0: rtCfg.w = 0, no Gloss, matCfg.w = 0 (the g-buffer\'s detail layer never runs)', `rtCfg.w ${off.rt[3]} matCfg.w ${off.mat[3]}`);
  // main's writeFrame at the fork point vs ours: the same FrameParams → the same first 656 bytes; the tail where common.wgsl reads it
  let mainWrite: ((dst: ArrayBuffer, p: any) => void) | null = null; let mainBytes = 0; let why = '';
  try {
    const src = execFileSync('git', ['show', `${MAIN_REF}:src/render/frame.ts`], { cwd: ROOT, encoding: 'utf8' });
    const dir = mkdtempSync(join(tmpdir(), 'p4frame-'));
    const patched = src.replace(/from '\.\.\//g, `from '${ROOT}/src/`).replace(/from '\.\/shaders\//g, `from '${ROOT}/src/render/shaders/`).replace(/from '\.\/(\w+)'/g, `from '${ROOT}/src/render/$1'`);
    const file = join(dir, 'frame_main.ts'); writeFileSync(file, patched);
    const m = await import(file); mainWrite = m.writeFrame; mainBytes = m.FRAME_BYTES;
  } catch (e: any) { why = String(e?.message ?? e).split('\n')[0]; }
  if (!mainWrite) { console.log(`  (skipped: main's writeFrame — git show ${MAIN_REF}:src/render/frame.ts — is not reachable from this checkout: ${why || 'no such object'}; the byte comparison needs the private repo's history)`); done('materials-frame'); return; }
  verdict(mainBytes === MAIN_FRAME_BYTES && FRAME_BYTES === MAIN_FRAME_BYTES + 128, `main's Frame is ${mainBytes} B, this branch's ${FRAME_BYTES} B (sharpCfg + sharpCfgB + sharpCfgC, then the SDF rig's rigCfg + rigCfgB, then giCfg, then weatherE + weatherF — appended, nothing moved)`);   // (+ weatherE @800 / weatherF @816: the particle-rain experiment's near-field disc + its v2 phase)
  const ident = (n: number) => { const a = new Float32Array(16); for (let i = 0; i < 16; i++) a[i] = ((i * 7 + n) % 11) / 11 - 0.3; return a; };
  const base: any = {
    viewProj: ident(1), invViewProj: ident(2), prevViewProj: ident(3), camPos: [20, 6, 14], camDir: [0, -0.7, -0.7], time: 12.5, dt: 1 / 60, width: 1777, height: 1000,
    frameIdx: 77, numLights: 33, flags: 0x1234abcd, exposure: 2, skyZenith: [0.01, 0.02, 0.05], skyHorizon: [0.04, 0.05, 0.08], hazeDensity: 0.035,
    rcInterval0: 1, rcC0Dims: [40, 4, 28], rcNumCascades: 4, rcD0: 6, rcFrameParity: 1, numSmoke: 2, debugView: 0, indirectScale: 0.35, emissiveScale: 1, volSteps: 20,
    capColor: [0.01, 0.012, 0.016, 0.3], post: [0, 475, 0, 0.4], rcJitter: [0.3, 0.6], directCfg: [8, 4, 10, 0.5], directAdaptiveMin: 3, numTransient: 1, secMinE: 0.006,
    glassCfg: [1, 1, 1, 0], lossyCfg: [2, 2, 0, 4], cardSlots: [3, 5], weather: { ...noWeather(), rain: 0.5, wet: 1, flash: [0.1, 0.1, 0.2] },
    volCfg: [4, 2, 15, 0], froxelA: [0.5, 56, 2, 0.93], froxelB: [240, 135, 64, 4], froxelC: [0.1, 0.2, 0.3, 0], prevCamPos: [19, 6, 15], froxelPrevNear: 0.5,
    rtCfg: [0.45, 1, 0.7, 2], matCfg: [1, 1, 60, 0.35], p5Cfg: [17, 0x0a031402, 3, 0], jitter: [0.25, -0.125, 0.5, 0.375], markCfg: [0.025, 1, 1.5, 1],
  };
  const A = new ArrayBuffer(mainBytes); mainWrite(A, base);
  const B = new ArrayBuffer(FRAME_BYTES); writeFrame(B, { ...base, markCfg: [0.025, 1, 1.5, 1], sharpCfg: [1368, 770, 1777, 1000], sharpCfgB: [1, 0.3, 2.5, 0.01], sharpCfgC: [0.25, -0.125, 0, 0], rigCfg: [45, 20, 1, 0.006], rigCfgB: [1, 24, 0.0015, 0.012], giCfg: [3, 9376, 4, 0] });
  const a8 = new Uint8Array(A), b8 = new Uint8Array(B); let firstDiff = -1; for (let i = 0; i < mainBytes; i++) if (a8[i] !== b8[i]) { firstDiff = i; break; }
  const same = firstDiff < 0;
  verdict(same, `bytes [0, ${mainBytes}) identical to main's for the same FrameParams`, same ? '' : `first difference at byte ${firstDiff}`);
  const f = new Float32Array(B); const u = new Uint32Array(B);
  verdict(f[156] === Math.fround(0.45) && f[157] === 1 && f[159] === 2 && f[160] === 1 && f[162] === 60 && f[163] === Math.fround(0.35), 'the tail carries rtCfg @624 and matCfg @640 where common.wgsl reads them', `f[156..163] = ${Array.from(f.subarray(156, 164)).map(v => +v.toFixed(3)).join(', ')}`);
  verdict(u[164] === 17 && u[165] === 0x0a031402 && u[166] === 3 && u[167] === 0 && f[168] === 0.25 && f[169] === -0.125 && f[170] === 0.5 && f[171] === 0.375, 'and p5Cfg @656 (u32 ×4) + jitter @672 (renderer v3 phase 5) after them', `u[164..167] = ${Array.from(u.subarray(164, 168)).join(', ')} · f[168..171] = ${Array.from(f.subarray(168, 172)).join(', ')}`);
  verdict(f[172] === Math.fround(0.025) && f[173] === 1 && f[174] === 1.5 && f[175] === 1, 'and markCfg @688 (the markings lane: base texel, contrast, emission ×, reflect)', `f[172..175] = ${Array.from(f.subarray(172, 176)).map(v => +v.toFixed(4)).join(', ')}`);
  verdict(f[176] === 1368 && f[177] === 770 && f[178] === 1777 && f[179] === 1000 && f[180] === 1 && f[181] === Math.fround(0.3) && f[182] === 2.5 && f[183] === Math.fround(0.01), 'and sharpCfg @704 + sharpCfgB @720 (sharp direct: sizes, knobs)', `f[176..183] = ${Array.from(f.subarray(176, 184)).map(v => +v.toFixed(4)).join(', ')}`);
  verdict(f[184] === 0.25 && f[185] === -0.125 && f[186] === 0 && f[187] === 0, 'and sharpCfgC @736 (the decoupled jitter)', `f[184..187] = ${Array.from(f.subarray(184, 188)).join(', ')}`);
  verdict(f[188] === 45 && f[189] === 20 && f[190] === 1 && f[191] === Math.fround(0.006) && f[192] === 1 && f[193] === 24 && f[194] === Math.fround(0.0015) && f[195] === Math.fround(0.012), 'and rigCfg @752 + rigCfgB @768 (the SDF character rig: bits + soft-query numbers, blend / trace numbers)', `f[188..195] = ${Array.from(f.subarray(188, 196)).map(v => +v.toFixed(4)).join(', ')}`);
  verdict(f[196] === 3 && f[197] === 9376 && f[198] === 4 && f[199] === 0, 'and giCfg @784 (GI in motion: young-history rays k, cap, young length)', `f[196..199] = ${Array.from(f.subarray(196, 200)).join(', ')}`);
  verdict(f[200] === 0 && f[201] === 0 && f[202] === 0 && f[203] === 0 && f[204] === 0 && f[205] === 0 && f[206] === 0 && f[207] === 0, 'and weatherE @800 + weatherF @816 (particle rain\'s near-field disc + its v2 phase: zeros from a WeatherFrame that never rains particles) last', `f[200..207] = ${Array.from(f.subarray(200, 208)).join(', ')}`);
  done('materials-frame');
}

// ------------------------------------------------------------------------------------------------------------------------------------------------ VNDF sampler (TS port of reflect.wgsl)
type V3 = [number, number, number];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const nrm = (a: V3): V3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export function sampleGGXVNDF(Ve: V3, ax: number, ay: number, u1: number, u2: number): V3 {
  const Vh = nrm([ax * Ve[0], ay * Ve[1], Ve[2]]);
  const lensq = Vh[0] * Vh[0] + Vh[1] * Vh[1];
  const T1: V3 = lensq > 1e-8 ? [-Vh[1] / Math.sqrt(lensq), Vh[0] / Math.sqrt(lensq), 0] : [1, 0, 0];
  const T2 = cross(Vh, T1);
  const r = Math.sqrt(u1), phi = 2 * Math.PI * u2;
  const t1 = r * Math.cos(phi); let t2 = r * Math.sin(phi);
  const s = 0.5 * (1 + Vh[2]);
  t2 = (1 - s) * Math.sqrt(Math.max(1 - t1 * t1, 0)) + s * t2;
  const nh = Math.sqrt(Math.max(1 - t1 * t1 - t2 * t2, 0));
  const Nh: V3 = [t1 * T1[0] + t2 * T2[0] + nh * Vh[0], t1 * T1[1] + t2 * T2[1] + nh * Vh[1], t1 * T1[2] + t2 * T2[2] + nh * Vh[2]];
  return nrm([ax * Nh[0], ay * Nh[1], Math.max(Nh[2], 0)]);
}
const lam = (s: V3, ax: number, ay: number) => { const a2 = (ax * ax * s[0] * s[0] + ay * ay * s[1] * s[1]) / Math.max(s[2] * s[2], 1e-9); return 0.5 * (Math.sqrt(1 + a2) - 1); };
export async function materialsVndf() {
  console.log('\n=== materials-vndf: the GGX visible-normal sampler, ported from reflect.wgsl ===');
  let seed = 987654321; const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const N = 120000;
  const run = (thetaDeg: number, ax: number, ay: number) => {
    const tv = thetaDeg * Math.PI / 180; const Ve: V3 = [Math.sin(tv), 0, Math.cos(tv)]; const R: V3 = [-Ve[0], -Ve[1], Ve[2]];
    let hzBad = 0, est = 0; const mean: V3 = [0, 0, 0]; let sx = 0, sy = 0, nL = 0;
    const G1v = 1 / (1 + lam(Ve, ax, ay));
    for (let i = 0; i < N; i++) {
      const H = sampleGGXVNDF(Ve, ax, ay, rnd(), rnd());
      if (!(H[2] >= 0) || Math.abs(Math.hypot(...H) - 1) > 1e-5) hzBad++;
      const vh = dot(Ve, H); est += H[2] * Ve[2] / (G1v * Math.max(vh, 1e-9)) / N;
      const L: V3 = [2 * vh * H[0] - Ve[0], 2 * vh * H[1] - Ve[1], 2 * vh * H[2] - Ve[2]];
      if (L[2] <= 0) continue;
      mean[0] += L[0]; mean[1] += L[1]; mean[2] += L[2]; nL++;
      sx += (L[0] - R[0]) ** 2; sy += (L[1] - R[1]) ** 2;
    }
    const m = nrm(mean); const offDeg = Math.acos(Math.min(1, dot(m, R))) * 180 / Math.PI;
    return { hzBad, est, offDeg, sdx: Math.sqrt(sx / nL), sdy: Math.sqrt(sy / nL) };
  };
  const iso = run(45, 0.1, 0.1), mirror = run(45, 0.01, 0.01), rough = run(50, 0.3, 0.3), aniso = run(45, 0.03, 0.24);
  verdict(iso.hzBad === 0 && mirror.hzBad === 0 && rough.hzBad === 0 && aniso.hzBad === 0, 'every sampled half-vector is unit length in the upper hemisphere (h·n ≥ 0)', `bad: ${iso.hzBad} ${mirror.hzBad} ${rough.hzBad} ${aniso.hzBad} of ${N} each`);
  verdict([iso, mirror, rough, aniso].every(r => Math.abs(r.est - 1) < 0.06), 'importance-sampling identity: (v·n) / (G1(v) (v·h)) averaged over the samples recovers ∫ D(h)(h·n) dh = 1 within 6 %', `α 0.1: ${iso.est.toFixed(3)} · α 0.01: ${mirror.est.toFixed(3)} · α 0.3: ${rough.est.toFixed(3)} · aniso: ${aniso.est.toFixed(3)}`);
  verdict(mirror.offDeg < 0.3 && iso.offDeg < 3 && rough.offDeg > iso.offDeg, 'the mean reflected direction tends to the mirror direction as roughness → 0 (α 0.01: within 0.3°), and drifts off it as it grows', `α 0.01: ${mirror.offDeg.toFixed(2)}° · α 0.1: ${iso.offDeg.toFixed(2)}° · α 0.3: ${rough.offDeg.toFixed(2)}°`);
  verdict(aniso.sdy > 3 * aniso.sdx && Math.abs(iso.sdx - iso.sdy) / iso.sdy < 0.25, 'anisotropy (αx 0.03, αy 0.24) stretches the reflected lobe along y and not x (sd_y > 3 sd_x); an isotropic lobe is round', `aniso sd x/y ${aniso.sdx.toFixed(3)}/${aniso.sdy.toFixed(3)} · iso ${iso.sdx.toFixed(3)}/${iso.sdy.toFixed(3)}`);
  done('materials-vndf');
}

// ------------------------------------------------------------------------------------------------------------------------------------------------ the analytic panel on a rough finish
export async function materialsArealight() {
  console.log('\n=== materials-arealight: the analytic stand-in for an area-lit panel on a rough finish vs a quadrature of the true GGX integral ===');
  const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], len = (a: V3) => Math.hypot(...a);
  const lamI = (c: number, a: number) => { const t2 = (1 - c * c) / Math.max(c * c, 1e-9); return 0.5 * (Math.sqrt(1 + a * a * t2) - 1); };
  const fcos = (Nn: V3, V: V3, L: V3, alpha: number) => { const NdotL = dot(Nn, L), NdotV = dot(Nn, V); if (NdotL <= 0 || NdotV <= 0) return 0; const H = nrm(add(V, L)); const NdotH = dot(Nn, H), VdotH = dot(V, H); const a2 = alpha * alpha; const dn = NdotH * NdotH * (a2 - 1) + 1; const D = a2 / (Math.PI * dn * dn); const G2 = 1 / (1 + lamI(NdotV, alpha) + lamI(NdotL, alpha)); const F = 0.04 + 0.96 * (1 - VdotH) ** 5; return D * F * G2 / (4 * NdotV * NdotL) * NdotL; };
  const Nn: V3 = [0, 1, 0]; const pc: V3 = [0, 2.9, 0]; const hx = 0.6, hz = 0.3; const eye: V3 = [0, 6.5, 6]; const r = Math.min(Math.sqrt(4 * hx * hz / Math.PI), Math.min(hx, hz) + 0.02);
  const rows: string[] = []; let ok = true;
  for (const rough of [0.3, 0.35, 0.45]) {
    const alpha = rough * rough; let peakT = 0, peakA = 0;
    for (let z = 0; z <= 3.0001; z += 0.125) {
      const P: V3 = [0, 0, z]; const V = nrm(sub(eye, P));
      let truth = 0; const n = 48;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const q: V3 = [pc[0] - hx + (i + 0.5) / n * 2 * hx, pc[1], pc[2] - hz + (j + 0.5) / n * 2 * hz]; const d = sub(q, P); const dl = len(d); const L: V3 = [d[0] / dl, d[1] / dl, d[2] / dl]; if (L[1] <= 0) continue; const ce = L[1]; const dw = (2 * hx / n) * (2 * hz / n) * ce / (dl * dl); truth += fcos(Nn, V, L, alpha) * dw; }
      const dc = sub(pc, P); const dcl = len(dc); const Lc: V3 = [dc[0] / dcl, dc[1] / dcl, dc[2] / dcl];
      const E = 4 * hx * hz * Lc[1] * Math.max(dot(Nn, Lc), 0) / Math.max(dcl * dcl, r * r);
      const ap = Math.min(1, alpha + r / (2 * dcl)); const H = nrm(add(V, Lc)); const NdotH = dot(Nn, H), VdotH = dot(V, H), NdotV = dot(Nn, V), NdotL = dot(Nn, Lc);
      const a2 = ap * ap; const dn = NdotH * NdotH * (a2 - 1) + 1; const D = a2 / (Math.PI * dn * dn); const G2 = 1 / (1 + lamI(NdotV, ap) + lamI(NdotL, ap)); const F = 0.04 + 0.96 * (1 - VdotH) ** 5;
      const ana = E * D * F * G2 / (4 * NdotV * NdotL);
      peakT = Math.max(peakT, truth); peakA = Math.max(peakA, ana);
    }
    const ratio = peakA / peakT; const good = ratio > 0.65 && ratio < 1.6; ok &&= good;
    rows.push(`rough ${rough}: peak analytic / true = ${ratio.toFixed(2)}${good ? '' : ' ✗'}`);
  }
  verdict(ok, 'along the floor under a 1.2 × 0.6 panel 2.9 m up, the analytic peak is within −35 % / +60 % of the quadrature for rough 0.3 / 0.35 / 0.45 (r/d or Karis\' renormalisation land 3-4× low)', rows.join(' · '));
  done('materials-arealight');
}

// ------------------------------------------------------------------------------------------------------------------------------------------------ the traffic map
export async function materialsWear() {
  console.log('\n=== materials-wear: the detail layer\'s traffic map on the office (render/wear.ts) ===');
  const { buildWearMap, WEAR_RES } = await import(`${ROOT}/src/render/wear.ts`);
  const { StaticCollision } = await import(`${ROOT}/src/scene/collision.ts`);
  const { WORLD } = await import(`${ROOT}/src/scene/world.ts`);
  const level = buildLevel(); const col = new StaticCollision(level.boxes);
  const t0 = performance.now(); const A = buildWearMap(level, col.nav); const ms = performance.now() - t0; const B = buildWearMap(level, col.nav);
  verdict(A.w === WORLD.gridW * WORLD.gridCell * WEAR_RES && A.h === WORLD.gridH * WORLD.gridCell * WEAR_RES && A.data.length === A.w * A.h * 2, `${A.w}×${A.h} texels, 2 bytes each = the world's ${WORLD.gridW}×${WORLD.gridH} m grid at ${WEAR_RES}/m (detail.wgsl maps wp.xz through WORLD_MIN / GRID_W·H / GRID_CELL)`, `${A.data.length} B in ${ms.toFixed(0)} ms`);
  let same = A.data.length === B.data.length; for (let i = 0; same && i < A.data.length; i++) if (A.data[i] !== B.data[i]) same = false;
  verdict(same, 'deterministic: two builds are byte-identical (nothing random — the same level draws the same wear)');
  const at = (x: number, z: number, ch: 0 | 1) => { const tx = Math.floor((x - WORLD.min[0]) * WEAR_RES), tz = Math.floor((z - WORLD.min[2]) * WEAR_RES); return A.data[(tz * A.w + tx) * 2 + ch] / 255; };
  // traffic: the corridor route's own waypoints are worn; the middle of a wall / outside the fence is not; every door's threshold is stamped
  const route = level.routes.find((r: any) => r.name === 'corridor') ?? level.routes[0];
  const onRoute = route.points.map((p: any) => at(p[0], p[2], 0));
  verdict(onRoute.every((v: number) => v > 0.5), `traffic > 0.5 at every waypoint of route '${route.name}' (a man stands and turns there every lap)`, onRoute.map((v: number) => v.toFixed(2)).join(' · '));
  const quiet = [at(0.5, 0.5, 0), at(39.5, 0.6, 0), at(5.0, 4.05, 0)];   // the world's NW corner, its NE corner, inside the north wall
  verdict(quiet.every(v => v < 0.08), 'traffic ≈ 0 where nobody can walk (the world\'s corners, inside a wall)', quiet.map(v => v.toFixed(2)).join(' · '));
  const doors = level.doors.map((d: any) => { const cx = d.hinge[0] + Math.cos(d.closedDir) * d.width * 0.5, cz = d.hinge[1] + Math.sin(d.closedDir) * d.width * 0.5; return { name: d.name, v: at(cx, cz, 0) }; });
  verdict(doors.every((d: any) => d.v > 0.6), `every threshold worn (traffic > 0.6 at all ${doors.length} frame centres)`, doors.map((d: any) => `${d.name} ${d.v.toFixed(2)}`).join(' · '));
  // wall proximity: 1 at the corridor's north wall foot, 0 in the middle of the lobby / the corridor
  const wallFoot = at(17.0, 10.06, 1), midLobby = at(8.0, 20.0, 1), midCorr = at(17.0, 11.1, 1);
  verdict(wallFoot > 0.7 && midLobby < 0.05 && midCorr < 0.05, 'wall proximity: high at the corridor\'s wall foot, ≈ 0 mid-lobby and mid-corridor (GRIME_REACH 16 cm)', `wall foot ${wallFoot.toFixed(2)} · mid-lobby ${midLobby.toFixed(2)} · mid-corridor ${midCorr.toFixed(2)}`);
  let worn = 0, grimy = 0; const n = A.w * A.h; for (let i = 0; i < n; i++) { if (A.data[i * 2] > 128) worn++; if (A.data[i * 2 + 1] > 128) grimy++; }
  verdict(worn / n > 0.01 && worn / n < 0.25 && grimy / n > 0.02 && grimy / n < 0.35, 'coverage is a minority of the floor: worn (> ½) 1–25 %, grime band (> ½) 2–35 %', `worn ${(100 * worn / n).toFixed(1)} % · grime ${(100 * grimy / n).toFixed(1)} %`);
  done('materials-wear');
}
