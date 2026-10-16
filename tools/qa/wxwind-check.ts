// ONE WIND FIELD OUTDOORS, ROOF BY ROOF (src/game/weatherKinds.ts WX_OWN.wind, src/game/wind.ts syncField / stormVelRoofs, src/render/shaders/wind_field.wgsl
// windStormRoofs, the particles' and the smoke solver's storm records, the wisps of blowing snow on the field).
//
// The maintainer, 10-14, of the pass: "ideally the snow particles and wisps all share a wind field too. and that could also integrate with the smoke system too?"
// There was one wind model already — flakes and smoke read it — but its storm record held two rectangles, and a level of three or four roofs handed it their
// bounding box: on the pass that box is the yard, so the yard had no wind (flakes plumb, smoke upright) and the wisps ran on the storm's raw vector instead.
// With the rule on the storm blows wherever none of the level's roofs is overhead, for the CPU's readers, the particles and the smoke alike.
//
//   bun run tools/qa/wxwind-check.ts [--verbose]      exit 0 = all pass, 1 = a FAIL line
//   WXWIND_BREAK=1 …   = the switch never raised and the same lines asked: must fail
//   WXWIND_PRINT=1 …   = also print the stepped digests one per line (to hold a tree's against another's by hand)
//   bun run tools/qa/probes.ts wxwind      (also under `wind` and `weather`)
//   Run it on BOTH stands (TPS_PROFILE=shipped in front for the page's): it puts the switch where each line needs it by the stand's own word, TPS_WXWIND.
//
// The harness has no GPU: nothing here runs a kernel. The GPU's half is held by what the CPU PACKS for it (the particles' record through render/particles.ts on a
// fake device, the solver's block through smoke/smoke.ts on one, the Frame's roofs) and by the shader TEXT that reads those words.
//   field     the field's two texts agree: wind_field.wgsl windStormRoofs is game/wind.ts stormVelRoofs statement for statement (the min over four roofs, an empty
//             footprint no roof, the lee, the height share), and with ONE roof it is windStorm / stormVel to the bit on a lattice
//   yard      the pass, rule on: the CPU's wind at a point of the open yard is the storm's own (its vector × the height share), still under each of the four roofs;
//             rule off: the yard is still, as it was (and open ground outside the roofs' bounding box blows either way)
//   lee       … easing in off a roof: nothing at its edge, half way at half the lee, all of it past the lee — and `stormShare` (what the wisps are weighed by) agrees
//   gpu       what both GPU consumers are handed says the same: the particles' storm record = the first two roofs + the roof-by-roof bit, the other two on the
//             Frame where the rain's own test reads them (the same rectangles to the f32); the solver's block = the first two in the record, the other two in its
//             spare words, spare0 = 1; rule off = the bounding box, no bit, the spare words 0 — and the shader text reads each where it was put
//   same      the office, a two-roof level of its own shape and a one-roof level: the storm record and the wind on a lattice are the same BY VALUE on and off
//   wisps     the wisps run on the field: with the rule on the recycler's target is the open ground weighed by the field's share (less than the open area: the lee
//             carries none), with it off the open area as before; the shader's wispAir / wispGust take wispShare, which is 1 without the record's bit, and a wisp
//             in the lee starts its fade-out
//   digest    300 stepped frames of the pass, of a four-roof level that is not the pass and of the office: one game digest with the rule on and off (the CPU
//             game does not read the storm's field: what the rule changes in PLAY is smoke, which the solver simulates on the GPU — nothing here can show that)
//   old       a recording from before the key replays with it off; one that carries it replays its own (journal.ts applyKnobs)
import { standUp, ROOT, fake } from './headless.ts';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DT = 1 / 60;

export async function wxWindCheck(o: { verbose?: boolean } = {}): Promise<boolean> {
  const WK = await import(`${ROOT}/src/game/weatherKinds.ts`);
  const { WX_OWN, SNOW_LOOK, unpackRect } = WK;
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const WM: any = await import(`${ROOT}/src/game/wind.ts`);
  const { stormVel, stormVelRoofs, WIND_FIELD } = WM;
  const { updateSnowFx, snowStats, wispStats, seedSnow, SNOWWISPS } = await import(`${ROOT}/src/game/snowFx.ts`);
  const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
  const { snowConfig, snowLookConfig } = await import(`${ROOT}/src/render/frame.ts`);
  const J: any = await import(`${ROOT}/src/game/journal.ts`);
  const BREAK = process.env.WXWIND_BREAK === '1', PRINT = process.env.WXWIND_PRINT === '1';
  const quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { if (o.verbose) return await fn(); const l = console.log, e = console.error, w = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = l; console.error = e; console.warn = w; } };
  let fails = 0, checks = 0;
  const verdict = (ok: boolean, label: string, detail: string) => { checks++; if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  const WORDS = ['TPS_SNOW', 'TPS_OWNROOFS', 'TPS_WXWIND', 'TPS_SNOWWISPS'] as const;
  const was = { wind: WX_OWN.wind, roofs: WX_OWN.roofs, wisps: SNOW_LOOK.wisps, cfg: snowConfig.on, look: snowLookConfig.wisps, env: WORDS.map(k => process.env[k]) };
  const f2 = (x: number) => x.toFixed(2), f3 = (x: number) => x.toFixed(3);
  const len = (v: number[]) => Math.hypot(v[0], v[1], v[2]);
  const shader = (f: string) => readFileSync(resolve(ROOT, f), 'utf8');

  /** a game stood up on `file` under ITS OWN roofs (a snow level in snow, any other under its own storm), the rule where `on` says — by the stand's own words, so
   *  the frozen stand's pins and the shipped stand's boot both obey; the module's switch is left the WRONG way round first: only the word can put it right */
  async function rig(file: string, on: boolean) {
    const sw = on && !BREAK;
    process.env.TPS_SNOW = '1'; process.env.TPS_OWNROOFS = '1'; process.env.TPS_SNOWWISPS = '1'; process.env.TPS_WXWIND = sw ? '1' : '0'; WX_OWN.wind = !sw;
    const lvl = loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8')));
    const W: any = await quiet(() => standUp({ level: lvl, seed: 7 }));
    const g = W.game; const stood = WX_OWN.wind; const set = () => { WX_OWN.wind = sw; WX_OWN.roofs = true; SNOW_LOOK.wisps = true; };   // (one table for the process: every step of a rig is made under that rig's own setting)
    const step = (n = 1) => { for (let i = 0; i < n; i++) { set(); W.step(DT); } };
    const at = (p: number[]) => { set(); return g.wind.at(p) as number[]; };
    return { W, g, step, set, at, stood, sw, wx: g.weather as any, storm: () => g.wind.byName('storm') as any };
  }
  type Rig = Awaited<ReturnType<typeof rig>>;
  const lattice = (R: Rig) => { const out: number[] = []; for (let x = 0.75; x < 40; x += 1.5) for (let z = 0.75; z < 28; z += 1.5) for (const y of [0.1, 1.5]) { const v = R.at([x, y, z]); out.push(v[0], v[1], v[2]); } return out; };
  const digest = (R: Rig) => hashDigest(digestGame(R.g));

  try {
    // ---- field: the two texts
    { const wf = shader('src/render/shaders/wind_field.wgsl'); const body = wf.slice(wf.indexOf('fn windStormRoofs('));
      const text = /fn windRoofOut\(p: vec2f, R: vec4f\) -> f32 \{\s*if \(R\.z <= R\.x \|\| R\.w <= R\.y\) \{ return 1e6; \}\s*return max\(max\(R\.x - p\.x, p\.x - R\.z\), max\(R\.y - p\.y, p\.y - R\.w\)\);/.test(wf)
        && /if \(p\.y > WIND_STORM_TOP \|\| p\.y < 0\.0\) \{ return vec3f\(0\.0\); \}\s*let dOut = min\(min\(windRoofOut\(p\.xz, r0\), windRoofOut\(p\.xz, r1\)\), min\(windRoofOut\(p\.xz, r2\), windRoofOut\(p\.xz, r3\)\)\);\s*if \(dOut <= 0\.0\) \{ return vec3f\(0\.0\); \}\s*let lee = smoothstep\(0\.0, WIND_STORM_LEE, dOut\);\s*let hgt = 0\.55 \+ 0\.45 \* clamp\(p\.y \/ 2\.5, 0\.0, 1\.0\);\s*return windV \* \(lee \* hgt\);/.test(body);
      const one = [4, 5, 30, 20], none = [1e6, 1e6, -1e6, -1e6], w = [0.6, 0, -0.5]; let worst = 0, n = 0, inside = 0;
      for (let x = 0.5; x < 40; x += 0.7) for (let z = 0.5; z < 28; z += 0.7) for (const y of [-0.1, 0, 0.4, 2, 5, 9]) {
        const a = stormVel(w, one, none, [x, y, z]), b = stormVelRoofs(w, [one], [x, y, z]), c = stormVelRoofs(w, [one, [0, 0, 0, 0], none], [x, y, z]); n++;
        worst = Math.max(worst, Math.abs(a[0] - b[0]), Math.abs(a[2] - b[2]), Math.abs(a[0] - c[0]), Math.abs(a[2] - c[2])); if (len(b) === 0) inside++; }
      // two roofs side by side: the lee is the NEAREST roof's (the two-rectangle rule eases in off its first alone)
      const two = [[4, 4, 10, 10], [12, 4, 18, 10]]; const mid = stormVelRoofs([1, 0, 0], two, [11, 0, 7])[0], far = stormVelRoofs([1, 0, 0], two, [11, 0, 14])[0], under = stormVelRoofs([1, 0, 0], two, [15, 0, 7])[0];
      const s = (d: number) => { const t = Math.max(0, Math.min(1, d / WIND_FIELD.stormLee)); return t * t * (3 - 2 * t) * 0.55; };
      verdict(text && worst === 0 && inside > 0 && Math.abs(mid - s(1)) < 1e-12 && Math.abs(far - 0.55) < 1e-12 && under === 0,
        'field — the shader\'s roof-by-roof storm is the CPU\'s, and with one roof it is the old rule to the bit', `wind_field.wgsl windRoofOut / windStormRoofs read as stormVelRoofs does (an empty footprint = no roof, the min over four, dOut ≤ 0 = nothing, the lee, the height share): ${text} · one roof, ${n} points (${inside} of them still): worst |old − new| ${worst} · a metre from each of two roofs ${f3(mid)} (the lee's ${f3(s(1))}), 4 m clear of both ${f3(far)}, under the second ${under}`); }

    // ---- yard / lee: the pass
    const A = await rig('pass.json', true); A.step(30);
    const B = await rig('pass.json', false); B.step(30);
    const roofs = A.wx.roofs as number[][]; const box = [Math.min(...roofs.map(r => r[0])), Math.min(...roofs.map(r => r[1])), Math.max(...roofs.map(r => r[2])), Math.max(...roofs.map(r => r[3]))];
    const yard = [20, 1.5, 14.5], outside = [20, 1.5, 24.5];
    { const S = A.storm(), So = B.storm(); const hgt = 0.55 + 0.45 * Math.min(1, yard[1] / 2.5);
      const want = [S.dir[0] * S.speed * hgt, 0, S.dir[2] * S.speed * hgt]; const got = A.at(yard), gotOff = B.at(yard);
      const centres = roofs.map(r => [(r[0] + r[2]) / 2, 1.5, (r[1] + r[3]) / 2]); const under = centres.map(c => len(A.at(c))), underOff = centres.map(c => len(B.at(c)));
      const inBox = yard[0] > box[0] && yard[2] > box[1] && yard[0] < box[2] && yard[2] < box[3]; const open = !A.wx.underRoof(yard[0], yard[2]);
      const out = len(A.at(outside)), outOff = len(B.at(outside));
      verdict(A.stood === true && B.stood === false && roofs.length === 4 && inBox && open && S.speed > 0.3 && Math.abs(S.speed - So.speed) < 1e-12 && Math.abs(got[0] - want[0]) < 1e-12 && Math.abs(got[2] - want[2]) < 1e-12 && under.every(v => v === 0)
        && len(gotOff) === 0 && underOff.every(v => v === 0) && out > 0.2 && outOff > 0.2 && S.roofs?.length === 4 && S.field === true && So.roofs === undefined && !So.field,
        'yard — on the pass the storm blows in the open yard between the four roofs, and under none of them; off, the yard is still as it was', `the stand's word put the switch where the rig asked before the Game was built: on ${A.stood}, off ${B.stood} · ${roofs.length} roofs, their box ${box.map(f2).join(', ')} · storm ${f2(S.speed)} m/s · the yard (${yard.join(', ')}; open ${open}, inside the box ${inBox}): ${f3(len(got))} m/s on (the storm's own × the height share = ${f3(len(want))}), ${f3(len(gotOff))} off · under the four roofs: ${under.map(f3).join(' ')} on, ${underOff.map(f3).join(' ')} off · open ground outside the box (${outside.join(', ')}): ${f3(out)} on, ${f3(outOff)} off`); }
    { const r0 = roofs[0]; const x = 20, z = r0[3]; const S = A.storm(); const full = S.speed * 0.55;   // south off the north house's eave, into the yard, at the ground
      const v = [0, 0.375, 0.75, 1.5, 2.5].map(d => len(A.at([x, 0, z + d])) / full), sh = [0, 0.375, 0.75, 1.5, 2.5].map(d => A.g.wind.stormShare(x, z + d) as number);
      const mono = v.every((a, i) => i === 0 || a >= v[i - 1]);
      verdict(v[0] === 0 && Math.abs(v[2] - 0.5) < 1e-9 && Math.abs(v[3] - 1) < 1e-9 && Math.abs(v[4] - 1) < 1e-9 && mono && v.every((a, i) => Math.abs(a - sh[i]) < 1e-9) && A.g.wind.stormShare(20, 8) === 0,
        'lee — the wind eases in off each roof\'s edge', `off the north house's eave at the ground, share of the open wind at 0 / 0.375 / 0.75 / 1.5 / 2.5 m: ${v.map(f3).join(' ')} (the lee is ${WIND_FIELD.stormLee} m) · stormShare the same: ${sh.map(f3).join(' ')} · under that roof ${A.g.wind.stormShare(20, 8)}`); }

    // ---- gpu: what the two consumers are handed, and the text that reads it
    { const P: any = await import(`${ROOT}/src/render/particles.ts`); const { Particles, IMP_OFFSET, IMP_BYTES } = P;
      const pack = (src: any) => { const sys = new Particles(fake('device'), fake('layout')); const blk = (sys as any).block as ArrayBuffer; const bf = new Float32Array(blk), bu = new Uint32Array(blk);
        sys.emit('sheet', [10, 1, 10], [0, 1, 0], 20, { shape: 'burst', speed: 2, life: 60, size: 0.2 }); sys.prepare(DT, true); sys.setWind([src], [0.35, 2, 0.15]); sys.prepare(DT, true);
        const b = (IMP_OFFSET + ((bu[3] >> 8) & 31) * IMP_BYTES) / 4; return { n: (bu[3] >> 16) & 31, r0: [bf[b], bf[b + 1], bf[b + 2], bf[b + 3]], r1: [bf[b + 8], bf[b + 9], bf[b + 10], bf[b + 11]], iflags: bu[b + 14] }; };
      const S = A.storm(), So = B.storm(); const on = pack(S), off = pack(So);
      const f = (r: number[]) => r.map(Math.fround); const same = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);
      const F = (A.g.engine as any).weather, Fo = (B.g.engine as any).weather;
      const frame = same(f(F.interior), f(roofs[0])) && same(f(F.annex), f(roofs[1])) && same(unpackRect(F.roofC), roofs[2]) && same(unpackRect(F.roofD), roofs[3]) && same(f(Fo.interior), f(F.interior)) && Fo.roofC === F.roofC;
      const partOn = on.n === 1 && on.iflags === (2 | 4 | 16 | 32) && same(on.r0, f(roofs[0])) && same(on.r1, f(roofs[1]));
      const partOff = off.n === 1 && off.iflags === (2 | 4) && same(off.r0, f(box)) && same(off.r1, f([1e6, 1e6, -1e6, -1e6]));
      // the solver's block (smoke.ts writeParams on a fake device: the header's eight spare words + the storm's record)
      let smk = 'not run', smokeOk = false;
      try { const { SmokeSystem } = await import(`${ROOT}/src/smoke/smoke.ts`);
        const blockOf = (R: Rig, src: any) => { const sys: any = new SmokeSystem(Object.assign(Object.create(R.g.engine), { viewFocus: [20, 0, 14.5] })); sys.setWind   // (the harness's engine has no view: the solver packs its focus beside the wind)
         ([src], 3); sys.writeParams(DT); const d = sys.windData as ArrayBuffer; const wf = new Float32Array(d), wu = new Uint32Array(d); const o = 48 / 4;
          return { count: wu[0], spare: Array.from(wf.slice(4, 12)), r0: Array.from(wf.slice(o, o + 4)), r1: Array.from(wf.slice(o + 8, o + 12)), kind: wu[o + 12], flag: wu[o + 13] }; };
        const bOn = blockOf(A, S), bOff = blockOf(B, So);
        smokeOk = bOn.count === 1 && bOn.kind === 1 && bOn.flag === 1 && same(bOn.r0, f(roofs[0])) && same(bOn.r1, f(roofs[1])) && same(bOn.spare, f([...roofs[2], ...roofs[3]]))
          && bOff.count === 1 && bOff.kind === 1 && bOff.flag === 0 && same(bOff.r0, f(box)) && bOff.spare.every(v => v === 0);
        smk = `on: record ${bOn.r0.map(f2).join(', ')} / ${bOn.r1.map(f2).join(', ')}, spare0 ${bOn.flag}, spare words ${bOn.spare.map(f2).join(', ')} · off: record ${bOff.r0.map(f2).join(', ')}, spare0 ${bOff.flag}, spare words all 0: ${bOff.spare.every(v => v === 0)}`;
      } catch (e) { smk = `the solver could not be built on the fake device (${String(e).slice(0, 120)})`; }
      const pw = shader('src/render/shaders/particles.wgsl'), wfc = shader('src/smoke/wind_force.wgsl');
      const tP = /fn windStormOf\(w: ImpulseRec, p: vec3f\) -> vec3f \{\s*if \(\(w\.iflags & 32u\) != 0u\) \{ return windStormRoofs\(w\.bias \* w\.strength, vec4f\(w\.pos, w\.radius\), vec4f\(w\.eye, w\.up\), wxRect\(frame\.cardCfg\.y\), wxRect\(frame\.cardCfg\.z\), p\); \}\s*return windStorm\(w\.bias \* w\.strength, vec4f\(w\.pos, w\.radius\), vec4f\(w\.eye, w\.up\), p\);/.test(pw)
        && /if \(\(\(w\.iflags >> 2u\) & 3u\) == 1u\) \{ v \+= windStormOf\(w, p\); \}/.test(pw) && !/windStorm\(w\.bias[^\n]*\n/.test(pw.slice(pw.indexOf('fn windAir(')));
      const tS = /if \(s\.kind == 1u\) \{\s*if \(s\.spare0 == 1u\) \{ return windStormRoofs\(s\.dir \* s\.speed, vec4f\(s\.pos, s\.reach\), s\.aux, bitcast<vec4f>\(wind\.spare\[0\]\), bitcast<vec4f>\(wind\.spare\[1\]\), P\); \}\s*return windStorm\(s\.dir \* s\.speed, vec4f\(s\.pos, s\.reach\), s\.aux, P\);/.test(wfc) && /spare: array<vec4u, 2>,/.test(wfc);
      verdict(frame && partOn && partOff && smokeOk && tP && tS,
        'gpu — the particles and the smoke solver are handed the same four roofs the CPU reads, and their shaders read them where they were put', `the Frame carries the wind's own roofs (the first two plain, the other two packed; the same with the rule off — they are the rain's): ${frame} · particles, on: rects ${on.r0.map(f2).join(', ')} / ${on.r1.map(f2).join(', ')}, iflags ${on.iflags} (2 | storm 4 | field 16 | roof by roof 32): ${partOn}; off: the box ${off.r0.map(f2).join(', ')}, iflags ${off.iflags}: ${partOff} · solver — ${smk}: ${smokeOk} · particles.wgsl windAir → windStormOf (bit 5 → windStormRoofs with the Frame's packed two): ${tP} · wind_force.wgsl windSrcVel (spare0 → windStormRoofs with the block's spare words): ${tS}`); }

    // ---- same: one or two roofs — the rectangles they had, by value
    { const lines: string[] = []; let ok = true;
      for (const file of ['office.json', 'records.json', 'hall.json']) {
        const on = await rig(file, true), off = await rig(file, false); on.step(30); off.step(30);
        const S = on.storm(), So = off.storm(); const a = lattice(on), b = lattice(off); let diff = 0, blow = 0; for (let i = 0; i < a.length; i++) { if (a[i] !== b[i]) diff++; if (a[i] !== 0) blow++; }
        const rec = JSON.stringify([S.interior, S.annex, S.speed, S.dir]) === JSON.stringify([So.interior, So.annex, So.speed, So.dir]) && S.roofs === undefined && So.roofs === undefined;
        const h1 = digest(on), h0 = digest(off);
        if (!(rec && diff === 0 && h1 === h0 && on.stood === true && S.field === true)) ok = false;
        lines.push(`${file} (${(on.wx.roofs as number[][]).length} roof(s), own ${on.wx.levelRoofs}): record the same and no roof list: ${rec} · ${a.length / 3} lattice points, ${blow > 0 ? 'the storm blowing' : 'still air'}: ${diff} values differ · digest ${h1} / ${h0}`);
      }
      verdict(ok, 'same — a level of one or two roofs is not touched: the same storm record and the same wind, by value, on and off', lines.join(' · ')); }

    // ---- wisps: on the field
    { const mk = () => { const recs: any[] = []; let queue: any[] = []; const P: any = { params: { rain: { gravity: 9.8, drag: 9.8 / 9, restitution: 6, keep: 0.06, sleepV: 0.2, holdOrFade: 0.09, shutterOrGrowth: 1 / 30, brightOrOpacity: 1 } }, rainLook: { refractReachM: -1, refractClamp: -1, refractDepth: -1 }, rainStats: { live: 0, emitted: 0 },
          emit(kind: string, pos: number[], _dir: number[], count: number, opts: any) { if (queue.length >= 12) return 0; const r = { kind, pos: [...pos], count, opts: { ...opts } }; queue.push(r); recs.push(r); return count; },
          draw() { let room = 640; for (const r of queue) { const n = Math.min(r.count, room); room -= n; P.rainStats.emitted += n; P.rainStats.live += n; } queue = []; }, clearRain() { queue = []; P.rainStats.live = 0; } }; return { P, recs }; };
      const DENS = 0.5; const fly = (R: Rig, frames: number, target: number[]) => { const { P, recs } = mk(); const e = R.g.engine as any; const had = { p: e.particles, gp: e.settings.gpuParticles, pr: e.settings.particleRain };
        seedSnow(R.g, 1); snowConfig.on = true; snowLookConfig.wisps = true; const storm = R.storm();
        const dens = e.settings.particleRainDensity; e.settings.particleRainDensity = DENS;   // (thinned: at the page's density the pass's whole yard is over the wisps' cap, and a capped target says nothing of the ground under it)
        for (let i = 0; i < frames; i++) { storm.speed = storm.base; storm.gust = 1; e.particles = P; e.settings.gpuParticles = true; e.settings.particleRain = true; R.set(); P.draw(); updateSnowFx(R.g, DT, { distance: 21, target } as any); e.particles = had.p; e.settings.gpuParticles = had.gp; e.settings.particleRain = had.pr; }
        e.settings.particleRainDensity = dens;
        return { wisps: recs.filter(r => (r.opts.aspect ?? 1) > 1.5), flakes: recs.filter(r => (r.opts.aspect ?? 1) <= 1.5), S: { ...snowStats(R.g) }, Ws: { ...wispStats(R.g) } }; };
      const at = [20, 0, 14.5]; const on = fly(A, 120, at), off = fly(B, 120, at);
      const K = SNOWWISPS; const blown = on.Ws.target / (K.perM2 * on.Ws.blow * DENS), flat = off.Ws.target / (K.perM2 * off.Ws.blow * DENS); const capped = on.Ws.target >= K.max || off.Ws.target >= K.max;
      // the open ground weighed by the field's share, summed again here off the wind's own answer at each cell (the recycler's cells: 1 m, by their centres, under the rim's taper)
      let want = 0; { const R = on.S.radius, cx = at[0], cz = at[2]; const { WORLD } = await import(`${ROOT}/src/scene/world.ts`); const S = A.storm(); const taper = (r: number) => { const t = Math.max(0, Math.min(1, (r - 0.7) / 0.3)); return 1 - t * t * (3 - 2 * t); };
        for (let z = Math.floor(cz - R); z < Math.ceil(cz + R); z++) for (let x = Math.floor(cx - R); x < Math.ceil(cx + R); x++) { const px = x + 0.5, pz = z + 0.5, r = Math.hypot(px - cx, pz - cz) / R;
          if (r >= 1 || A.wx.underRoof(px, pz) || !(px > WORLD.min[0] + 0.25 && pz > WORLD.min[2] + 0.25 && px < WORLD.max[0] - 0.25 && pz < WORLD.max[2] - 0.25)) continue;
          want += taper(r) * len(A.at([px, 0, pz])) / (S.speed * 0.55); } }
      const pw = shader('src/render/shaders/particles.wgsl');
      const tShare = /fn wispShare\(q: vec2f\) -> f32 \{[\s\S]*?if \(\(w\.iflags & 16u\) == 0u\) \{ return 1\.0; \}\s*return clamp\(length\(windStormOf\(w, vec3f\(q\.x, 0\.0, q\.y\)\)\) \/ max\(w\.strength \* WISP_GROUND_AIR, 1e-4\), 0\.0, 1\.0\);\s*\}\s*return 1\.0;\s*\}/.test(pw);
      const tAir = /let a = wispWind\(\) \* \(em\.rainCfgD\.w \* \(1\.0 \+ 0\.5 \* clamp\(pos\.y \/ 0\.5, 0\.0, 1\.0\)\)\) \* wispShare\(pos\.xz\);/.test(pw) && /return smoothstep\(0\.40, 0\.66, n\) \* wispShare\(q\);/.test(pw);
      const tDie = /if \(wispShare\(p\.pos\.xz\) < WISP_LEE_DIE\) \{ p\.life = min\(p\.life, p\.age \+ WISP_FADE_OUT\); \}/.test(pw.slice(pw.indexOf('fn wispStep(')));
      const flakes = on.flakes.length === off.flakes.length && on.S.target === off.S.target && on.S.areaOut === off.S.areaOut;
      verdict(on.wisps.length > 50 && off.wisps.length > 50 && !capped && Math.abs(flat - off.S.areaOut) < 1e-6 && Math.abs(blown - want) < 1e-6 * want && blown < 0.97 * flat && blown > 0.4 * flat && flakes && tShare && tAir && tDie,
        'wisps — they file and step on the field: weighed by its share over the open ground, slowed and faded in a roof\'s lee', `the view over the yard, 120 frames at a steady blow: on, ${on.wisps.length} records toward ${on.Ws.target.toFixed(0)} wisps = ${f2(blown)} m² blown (the field's share summed over the open cells here: ${f2(want)}) of ${f2(on.S.areaOut)} m² open; off, ${off.wisps.length} records toward ${off.Ws.target.toFixed(0)} = the open ${f2(flat)} m² · the flakes the same on and off (records ${on.flakes.length} / ${off.flakes.length}, target ${on.S.target.toFixed(0)} / ${off.S.target.toFixed(0)}): ${flakes} · the shader: wispShare is the field's share at the wisp, 1 without the record's bit: ${tShare} · wispAir and wispGust take it: ${tAir} · under ${'WISP_LEE_DIE'} of the open wind a wisp's fade-out starts: ${tDie} (no kernel is run here: no GPU)`); }

    // ---- digest: the CPU game, on and off — the pass, a four-roof level that is not the pass, the office
    { const lines: string[] = []; let ok = true;
      for (const file of ['pass.json', 'compound.json', 'office.json']) {
        const on = await rig(file, true), off = await rig(file, false); on.step(300); off.step(300);
        const h1 = digest(on), h0 = digest(off); const n = (on.wx.roofs as number[][]).length; const S = on.storm(); const byRoof = Array.isArray(S.roofs), want = n > 2;
        if (PRINT) console.log(`WXWIND_DIGEST ${process.env.TPS_PROFILE ?? 'frozen'} ${file} off ${h0} on ${h1}`);
        if (!(h1 === h0 && byRoof === want && S.speed > 0)) ok = false;
        lines.push(`${file} (${n} roofs, roof by roof ${byRoof}, storm ${f2(S.speed)} m/s): ${h1} on, ${h0} off`);
      }
      verdict(ok, 'digest — 300 stepped frames: one game digest with the rule on and off', lines.join(' · ') + ' (the CPU game reads no storm field: the rule\'s effect on play is smoke on the GPU, which nothing here runs)'); }

    // ---- old: a recording from before the key
    { A.set(); WX_OWN.wind = true; WX_OWN.roofs = true;
      const k = J.knobsSnapshot(A.g); const row = k.tables?.WX_OWN as Record<string, unknown> | undefined; const rides = !!row && row.wind === true && row.roofs === true;
      J.applyKnobs(A.g, JSON.parse(JSON.stringify(k))); const kept = WX_OWN.wind === true && WX_OWN.roofs === true;
      const k1 = JSON.parse(JSON.stringify(k)); delete k1.tables.WX_OWN.wind; WX_OWN.wind = true; J.applyKnobs(A.g, k1); const before = WX_OWN.wind === false && WX_OWN.roofs === true;
      const k2 = JSON.parse(JSON.stringify(k)); delete k2.tables.WX_OWN; WX_OWN.wind = true; WX_OWN.roofs = true; J.applyKnobs(A.g, k2); const older = WX_OWN.wind === false && WX_OWN.roofs === false;
      const k3 = JSON.parse(JSON.stringify(k)); k3.tables.WX_OWN.wind = false; WX_OWN.wind = true; J.applyKnobs(A.g, k3); const own = WX_OWN.wind === false;
      WX_OWN.wind = !BREAK; WX_OWN.roofs = true; A.step(2); const live = Array.isArray(A.storm().roofs);
      verdict(rides && kept && before && older && own && live, 'old — a recording from before the key replays with it off', `the key rides in a recording's WX_OWN row: ${rides} · a recording that has it on replays on: ${kept}, off: ${own} · a row with no such key: off, the roofs' own key kept: ${before} · no row at all: both off: ${older} · the switch is live (raised again, two frames on: roof by roof ${live})`); }
  } finally {
    WX_OWN.wind = was.wind; WX_OWN.roofs = was.roofs; SNOW_LOOK.wisps = was.wisps; snowConfig.on = was.cfg; snowLookConfig.wisps = was.look;
    WORDS.forEach((k, i) => { if (was.env[i] === undefined) delete process.env[k]; else process.env[k] = was.env[i]; });
  }
  console.log(`\nwxwind-check: ${checks - fails}/${checks} pass${BREAK ? ' (WXWIND_BREAK=1: the switch never raised — this run must fail)' : ''}`);
  return fails === 0;
}

if (import.meta.main) { const ok = await wxWindCheck({ verbose: process.argv.includes('--verbose') }); process.exit(ok ? 0 : 1); }
