// THE MEN'S BREATH STEAMS ON A SNOW LEVEL, AND IS THE PICTURE'S ALONE (src/game/weatherKinds.ts SNOW_LOOK.breath, src/game/snowBreath.ts SNOWBREATH /
// updateSnowBreath; the particle system's dust puff with one byte of its colour word spent: render/particles.ts EmitOpts.steam, the shaders' steamIs / steamOf).
//
// The maintainer, 10-14: "we should have steam from breaths in the cold levels too" — and of the snow as a whole, "it does need to feel more organic".
//
//   bun run tools/qa/snowbreath-check.ts [--verbose] [--fast]      exit 0 = all pass, 1 = a FAIL line   (--fast: without the played runs)
//   SNOWBREATH_BREAK=1 …   = the switch never raised and the same lines asked: must fail
//   bun run tools/qa/probes.ts snowbreath      (also under `snow` and `weather`)
//   Run it on BOTH stands (TPS_PROFILE=shipped in front for the page's): it puts the switch where each line needs it by the stand's own word, TPS_SNOWBREATH.
//
// The harness has no GPU: a puff is thrown, moved, lit and drawn on the GPU, so what is proven HERE is what the CPU files and what the shader text says of it —
// never a breath seen.
//   runs      the pass's room clear, a squad of four, switch on: every living man on his feet under the open sky breathes — dust records, a cone from his own
//             mouth, his id as their owner, a steam share under 1, seeds of their own — two to four breaths each in ten seconds
//   rhythm    … and not together: the men's first breaths start on different frames
//   effort    a man made to run breathes more often, and bigger, than the same man standing
//   who       none off a dead man, none off a man lying down, none off a man the fog of war hides, none off the men under a roof
//   same      the same seed twice: the same records, one for one
//   off       switch off: not one record
//   others    another level, switch on: nothing filed
//   digest    the game does not know: 300 stepped frames of the pass with the emitter filing into a pool every frame, on and off — one game digest
//   played    … and two PLAYED runs of the pass's room clear (playthrough.ts, a process each), the switch on and off — one run digest each seed. A played run has no
//             particle pool: the emitter walks its men and their rhythm there (every read it makes of the game) and files nothing
//   old       a recording from before the key replays with it off (journal.ts applyKnobs)
//   inert     by the shader and packer text: only a dust record filed with `steam` carries a top byte under 255, and only such a puff is touched
import { standUp, ROOT } from './headless.ts';
import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

const DT = 1 / 60;

export async function snowBreathCheck(o: { verbose?: boolean; fast?: boolean } = {}): Promise<boolean> {
  const WK = await import(`${ROOT}/src/game/weatherKinds.ts`);
  const { SNOW, SNOW_LOOK } = WK;
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { updateSnowBreath, breathStats, seedBreath, SNOWBREATH } = await import(`${ROOT}/src/game/snowBreath.ts`);
  const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
  const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
  const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
  const J = await import(`${ROOT}/src/game/journal.ts`);
  const BREAK = process.env.SNOWBREATH_BREAK === '1';
  const quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { if (o.verbose) return await fn(); const l = console.log, e = console.error, w = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = l; console.error = e; console.warn = w; } };
  let fails = 0, checks = 0;
  const verdict = (ok: boolean, label: string, detail: string) => { checks++; if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  const was = { snow: SNOW.on, breath: SNOW_LOOK.breath, envSnow: process.env.TPS_SNOW, envBreath: process.env.TPS_SNOWBREATH };

  /** a game stood up on `file` in snow, the breath's switch where `on` says (by the stand's own word, so the frozen stand's pin and the shipped stand's boot both
   *  obey); on the pass, its room clear begun with a squad of four */
  async function rig(file: string, on: boolean) {
    const sw = on && !BREAK;
    process.env.TPS_SNOW = '1'; process.env.TPS_SNOWBREATH = sw ? '1' : '0'; SNOW_LOOK.breath = !sw;   // (the module's switch left the WRONG way round: only the stand's word can put it right)
    const lvl = loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8')));
    const W: any = await quiet(() => standUp({ level: lvl, seed: 7 }));
    const g = W.game; const stood = SNOW_LOOK.breath; SNOW_LOOK.breath = sw;
    const why = file === 'pass.json' ? await quiet(() => startFromQuery(g, '?levelFile=pass.json&roomclear=0&squad4').why) : null;
    const step = (n = 1) => { for (let i = 0; i < n; i++) { SNOW_LOOK.breath = sw; W.step(DT); } };
    return { W, g, step, stood, sw, why };
  }
  /** a recording stand-in for the particle pool (the harness's engine has none: no GPU) */
  const mk = () => { const recs: any[] = []; let frame = 0; const P: any = { emit(kind: string, pos: number[], dir: number[], count: number, opts: any) { recs.push({ kind, pos: [...pos], dir: [...dir], count, opts: { ...opts }, frame }); return count; }, tick() { frame++; } }; return { P, recs }; };
  /** the emitter run `frames` frames against a fresh pool, reseeded — the pool on the engine only for the emitter's own call (the rest of the game has no pool to
   *  file into on this harness, as ever). `play`: the GAME is stepped a frame before each (its own poolless pass over the emitter runs the rhythm on a frame too:
   *  the men breathe twice as fast in that line, and nothing else of it changes); else the game stands still. `pre` = what the line holds the men to, each frame */
  const fly = (R: any, frames: number, f: { play?: boolean; pre?: () => void } = {}) => {
    const { P, recs } = mk(); const e = R.g.engine as any; const had = { p: e.particles, gp: e.settings.gpuParticles };
    seedBreath(R.g, 1);
    for (let i = 0; i < frames; i++) {
      if (f.play) R.step(1);
      f.pre?.();
      e.particles = P; e.settings.gpuParticles = true; SNOW_LOOK.breath = R.sw;
      updateSnowBreath(R.g, DT); P.tick();
      e.particles = had.p; e.settings.gpuParticles = had.gp;
    }
    const S = breathStats(R.g); const by = (id: number) => recs.filter(r => r.opts.owner === id);
    return { recs, by, S: { ...S, by: { ...S.by } } };
  };
  const key = (r: any) => `${r.frame}:${r.opts.owner}:${r.opts.seed}:${r.count}:${r.pos.map((v: number) => v.toFixed(4)).join(',')}:${r.opts.steam}:${r.opts.size}:${r.opts.speed.toFixed(4)}`;
  /** breaths = runs of a man's records (a breath's records come `out` ÷ `puffs` apart; breaths seconds apart) */
  const breathsOf = (rs: any[]) => { let n = 0, last = -1e9; for (const r of rs) { if (r.frame - last > 30) n++; last = r.frame; } return n; };

  try {
    const A = await rig('pass.json', true); A.step(120);
    const g = A.g; const K = SNOWBREATH;
    const ops: any[] = g.guards.filter((gd: any) => gd.team === 'operative'), foes: any[] = g.guards.filter((gd: any) => gd.team !== 'operative');
    const open = (c: any) => !!c.bones.head && !g.weather.underRoof(c.bones.head[0], c.bones.head[2]);
    const out: any[] = [g.player.char, ...ops.map(gd => gd.char)].filter(open);   // (the men this check expects to steam: Sam and his four, at the gate under the sky)
    const outIds = new Set(out.map(c => c.id));
    // ---- runs
    const on = fly(A, 600);
    { const per = out.map(c => ({ id: c.id, recs: on.by(c.id), n: breathsOf(on.by(c.id)) }));
      const shape = on.recs.every(r => r.kind === 'dust' && r.opts.shape === 'cone' && r.count === K.count && r.opts.steam > 0 && r.opts.steam < 1 && outIds.has(r.opts.owner) && r.opts.life === K.life && r.dir[1] < 0.3 && Math.abs(Math.hypot(r.dir[0], r.dir[1], r.dir[2]) - 1) < 1e-6);
      const mouth = on.recs.every(r => { const h = out.find(c => c.id === r.opts.owner)?.bones.head; return !!h && Math.hypot(r.pos[0] - h[0], r.pos[1] - h[1], r.pos[2] - h[2]) < 0.2 && r.pos[1] < h[1]; });
      const own = new Set(on.recs.map(r => r.opts.seed)).size === on.recs.length;
      const each = per.every(p => p.n >= 2 && p.n <= 4 && p.recs.length >= p.n * K.puffs - (K.puffs - 1) && p.recs.length <= p.n * K.puffs);
      verdict(A.stood === true && !A.why && out.length >= 5 && on.S.active && on.S.shown === out.length && on.recs.length > 0 && shape && mouth && own && each && on.S.records === on.recs.length,
        'runs — on the pass every living man under the open sky breathes steam', `the stand's word raised the switch before the Game was built: ${A.stood} · ${on.S.why}: ${on.S.shown} of ${on.S.men} men show (${out.length} stand under the sky: Sam and ${ops.filter(gd => open(gd.char)).length} of his) · ${on.recs.length} records in 600 frames, ${on.S.births} puffs · breaths each in ten seconds: ${per.map(p => `#${p.id} ${p.n} (${p.recs.length} records)`).join(', ')} — two to four, ${K.puffs} records a breath: ${each} · every one a dust cone of ${K.count}, a steam share ${on.recs[0]?.opts.steam ?? '—'}, its owner one of them: ${shape} · filed inside 0.2 m of his head bone and under it: ${mouth} · seeds their own: ${own}`); }
    // ---- rhythm
    { const first = out.map(c => on.by(c.id)[0]?.frame ?? -1); const distinct = new Set(first).size; const gap = Math.max(...first) - Math.min(...first);
      verdict(distinct >= out.length - 1 && gap > 30 && first.every(f => f >= 0), 'rhythm — no two start together', `the frame each man's first breath starts on: ${first.join(', ')} (${distinct} different, ${(gap * DT).toFixed(1)} s between the first and the last)`); }
    // ---- effort
    { const m = ops[0].char; const v0 = [...m.vel];
      const run = fly(A, 600, { pre: () => { m.vel[0] = 4.5; m.vel[2] = 0; } }); m.vel[0] = v0[0]; m.vel[1] = v0[1]; m.vel[2] = v0[2];
      const rest = on.by(m.id), hard = run.by(m.id); const nr = breathsOf(rest), nh = breathsOf(hard); const late = hard[hard.length - 1]; const r0 = rest[0]?.opts ?? { steam: 0, size: 0 };
      const others = out.filter(c => c !== m).every(c => run.by(c.id).map(key).join('|') === on.by(c.id).map(key).join('|'));
      verdict(nh >= nr + 2 && !!late && nr > 0 && late.opts.steam > r0.steam * 1.2 && late.opts.size > r0.size * 1.2 && late.opts.steam <= 1 && others,
        'effort — a man who runs breathes faster and bigger', `#${m.id} held at 4.5 m/s for ten seconds: ${nh} breaths against ${nr} standing · his last record's steam share ${late?.opts.steam.toFixed(2)} against ${r0.steam.toFixed(2)}, its size ${late?.opts.size.toFixed(3)} m against ${r0.size.toFixed(3)} · the others' records untouched by it: ${others}`); }
    // ---- same
    { const again = fly(A, 600); const a = on.recs.map(key), b = again.recs.map(key); let firstDiff = -1; for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) { firstDiff = i; break; }
      verdict(a.length > 0 && firstDiff < 0, 'same — the same seed, the same breaths', `${a.length} records, then ${b.length}: ${firstDiff < 0 ? 'the same, one for one (frame, man, seed, place, steam, size, speed)' : `they part at record ${firstDiff} (${a[firstDiff]} against ${b[firstDiff]})`}`); }
    // ---- who (last on this game: it kills a man)
    { const dead = ops[1], lying = ops[2], fogged = ops[3]; const fog = g.fogOfWar as any;
      const keep = { state: dead.state, alive: dead.char.alive, y: lying.char.bones.head[1] };
      dead.state = 'dead'; dead.char.alive = false; lying.char.bones.head[1] = lying.char.pos[1] + 0.25;
      fog.hidden = (gd: any) => gd === fogged;   // (every other man bared: the defenders indoors are then kept out by their roof alone)
      const w = fly(A, 600);
      delete fog.hidden; dead.state = keep.state; dead.char.alive = keep.alive; lying.char.bones.head[1] = keep.y;
      const roofed = foes.filter(gd => gd.state !== 'dead' && !open(gd.char)); const n = (gd: any) => w.by(gd.char.id).length;
      const rest = w.by(g.player.char.id).length + n(ops[0]);
      verdict(n(dead) === 0 && n(lying) === 0 && n(fogged) === 0 && roofed.length > 0 && roofed.every(gd => n(gd) === 0) && rest >= 8 && w.S.shown === out.length - 3,
        'who — not the dead, not a man lying down, not a man in the fog, not a man under a roof', `records in 600 frames: the dead man #${dead.char.id} ${n(dead)} · the man with his head at the ground #${lying.char.id} ${n(lying)} · the man the fog of war hides #${fogged.char.id} ${n(fogged)} · ${roofed.length} living defenders under a roof, the fog bared: ${roofed.reduce((s, gd) => s + n(gd), 0)} · Sam and #${ops[0].char.id} beside them: ${rest} · ${w.S.shown} men showing`); }
    // ---- off
    const B = await rig('pass.json', false); B.step(120);
    { const off = fly(B, 600);
      verdict(B.stood === false && off.recs.length === 0 && off.S.active === false && off.S.records === 0, 'off — with the switch off not one breath is filed', `the switch as the stand left it: ${B.stood} · ${off.recs.length} records in 600 frames (${off.S.why})`); }
    // ---- others
    { const C = await rig('compound.json', true); C.step(30); const c = fly(C, 300);
      verdict(c.recs.length === 0 && c.S.active === false, 'others — another level is not touched by the switch', `compound.json, the switch on: ${c.recs.length} records (${c.S.why})`); }
    // ---- digest: two fresh games, the same frames, the emitter filing into a pool every frame — on, off
    { const D1 = await rig('pass.json', true), D0 = await rig('pass.json', false);
      const d1 = fly(D1, 300, { play: true }), d0 = fly(D0, 300, { play: true });
      const h1 = hashDigest(digestGame(D1.g)), h0 = hashDigest(digestGame(D0.g));
      verdict(h1 === h0 && d1.recs.length > 10 && d0.recs.length === 0, 'digest — the game does not know: one digest with breath filed and without', `300 frames of the pass's room clear: ${h1} with ${d1.recs.length} records filed, ${h0} with ${d0.recs.length}`); }
    // ---- played
    if (!o.fast) {
      const E = (SCENARIOS as any[]).find(s => s.level === 'pass.json');
      if (!E) verdict(false, 'played — the pass has a row to play', 'no scenario with level pass.json in scene/scenarioList.ts SCENARIOS');
      else {
        const dir = mkdtempSync(resolve(tmpdir(), 'snowbreath-check-'));
        const run = async (name: string, seed: number, breath: boolean) => {
          const outF = resolve(dir, `${name}-${seed}.json`);
          const p = Bun.spawn(['bun', 'run', resolve(ROOT, 'tools/qa/playthrough.ts'), '--one', `${E.id}:${seed}`, '--out', outF, '--cap', '150'],
            { stdout: 'ignore', stderr: 'pipe', env: { ...process.env, TPS_SNOW: '1', TPS_SNOWBREATH: breath && !BREAK ? '1' : '0', PT_DIGEST: '1', SNOWBREATH_BREAK: '' } });
          const code = await p.exited; if (code !== 0 || !existsSync(outF)) return { digest: `no run (exit ${code}: ${(await new Response(p.stderr).text()).trim().split('\n').pop()?.slice(0, 200)})`, secs: 0, how: '' };
          const r = JSON.parse(readFileSync(outF, 'utf8')); return { digest: String(r.digest ?? 'no digest in the run'), secs: +(r.secs ?? r.t ?? 0), how: String(r.outcome ?? r.end ?? r.result ?? '') };
        };
        const SEEDS = [1, 2];
        const [pOn, pOff] = await Promise.all([Promise.all(SEEDS.map(s => run('on', s, true))), Promise.all(SEEDS.map(s => run('off', s, false)))]);
        rmSync(dir, { recursive: true, force: true });
        const hex = (d: string) => /^[0-9a-f]+$/.test(d);
        verdict(pOn.every((r, i) => hex(r.digest) && r.digest === pOff[i].digest) && pOn.some(r => r.secs >= 40) && pOn[0].digest !== pOn[1].digest,
          'played — a room clear on the pass plays the same with the breath on and off', `played runs, their digest every half second — ${SEEDS.map((s, i) => `seed ${s}: ${pOn[i].digest} on (${pOn[i].secs.toFixed(0)} s ${pOn[i].how}), ${pOff[i].digest} off (${pOff[i].secs.toFixed(0)} s ${pOff[i].how})`).join(' · ')} (no particle pool in a played run: the rhythm runs, nothing is filed)`);
      }
    }
    // ---- old
    { let ok = false, how = '';
      try {
        SNOW_LOOK.breath = true; const k = (J as any).knobsSnapshot(A.g); const t = k.tables?.SNOW_LOOK; const had = !!t && 'breath' in t && t.breath === true;
        (J as any).applyKnobs(A.g, k); const kept = SNOW_LOOK.breath;
        const k2 = (J as any).knobsSnapshot(A.g); delete k2.tables.SNOW_LOOK.breath; (J as any).applyKnobs(A.g, k2); const dropped = SNOW_LOOK.breath;
        SNOW_LOOK.breath = true; const k3 = (J as any).knobsSnapshot(A.g); delete k3.tables.SNOW_LOOK; (J as any).applyKnobs(A.g, k3); const none = SNOW_LOOK.breath;
        ok = had && kept === true && dropped === false && none === false && !BREAK;
        how = `the key rides in a recording: ${had} · replayed with it: ${kept} · a recording without the key: ${dropped} · one without the table: ${none}${BREAK ? ' (the break word: this line is made to fail with the rest)' : ''}`;
      } catch (e) { how = `threw: ${(e as Error).message}`; }
      verdict(ok, 'old — a recording from before the key replays with no breath', how); }
    // ---- inert: by the text — the byte, who writes it, who reads it
    { const rd = (f: string) => readFileSync(resolve(ROOT, f), 'utf8');
      const ts = rd('src/render/particles.ts'), common = rd('src/render/shaders/particles_common.wgsl'), sim = rd('src/render/shaders/particles.wgsl'), draw = rd('src/render/shaders/particles_draw.wgsl');
      const packs = /const rgba8 = [^\n]*\| \(255 << 24\)\) >>> 0;/.test(ts);
      const writes = ts.split('\n').filter(l => /o\.steam/.test(l)).length === 1 && /if \(e\.kind === 'dust' && o\.steam !== undefined\) u\[b \+ 27\] = \(\(u\[b \+ 27\] & 0xffffff\) \| \(Math\.round\(Math\.min\(1, Math\.max\(0, o\.steam\)\) \* 254\) << 24\)\) >>> 0;/.test(ts);
      const gate = /fn steamIs\(color: u32\) -> bool \{ return \(color >> 24u\) != 255u; \}/.test(common) && /fn steamOf\(color: u32\) -> f32 \{ return select\(1\.0, [^\n]*, steamIs\(color\)\); \}/.test(common);
      const uses = (s: string) => s.split('\n').filter(l => /steam(Is|Of)\(/.test(l.replace(/\/\/.*$/, '')));
      const su = uses(sim), du = uses(draw);
      const simOk = su.length === 1 && /^\s*if \(kind == P_DUST && steamIs\(p\.color\)\) \{ p\.vel\.y \+= 2\.0 \* k0\.x \* dt; \}/.test(su[0]);
      const drawOk = du.length === 1 && /^\s*opacity \*= steamOf\(p\.color\);/.test(du[0]) && /else if \(kind == P_DUST\) \{[^}]*opacity \*= steamOf\(p\.color\);/s.test(draw);
      verdict(packs && writes && gate && simOk && drawOk, 'inert — only a breath carries the byte, and only a breath is touched by it', `every record's colour word is packed with 255 on top: ${packs} · one statement writes under it, for a dust record filed with steam: ${writes} · the shaders tell steam by that byte alone, 1 for 255: ${gate} · the step's one use, a dust puff's rise: ${simOk} · the draw's one use, inside the dust branch: ${drawOk} (never compiled or run here: no GPU)`); }
  } finally { SNOW.on = was.snow; SNOW_LOOK.breath = was.breath; if (was.envSnow === undefined) delete process.env.TPS_SNOW; else process.env.TPS_SNOW = was.envSnow; if (was.envBreath === undefined) delete process.env.TPS_SNOWBREATH; else process.env.TPS_SNOWBREATH = was.envBreath; }
  console.log(`\nsnowbreath-check: ${checks - fails}/${checks} pass${BREAK ? ' (SNOWBREATH_BREAK=1: the switch never raised — this run must fail)' : ''}`);
  return fails === 0;
}

if (import.meta.main) { const ok = await snowBreathCheck({ verbose: process.argv.includes('--verbose'), fast: process.argv.includes('--fast') }); process.exit(ok ? 0 : 1); }
