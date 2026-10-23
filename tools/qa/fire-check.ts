// AN OPEN FIRE BURNS (src/game/fire.ts FIRE / updateFire; the flame and the embers are render/shaders/fire.wgsl; the light is the level's own lamp).
//
// The maintainer, 10-23: "we gotta improve our fire! we have barrels with fire on them … great fire with smoke and crackles and dynamic lighting would look sick."
//
//   bun run tools/qa/fire-check.ts [--verbose]      exit 0 = all pass, 1 = a FAIL line
//   FIRE_BREAK=1 …   = the switch never raised and the same lines asked: must fail
//   bun run tools/qa/probes.ts fire
//   Run it on BOTH stands (TPS_PROFILE=shipped in front for the page's): it puts the switch where each line needs it by the stand's own word, TPS_FIRE.
//
// The harness has no GPU, no smoke solver and no speaker: what is proven HERE is what the game hands on (the lamp's strength and place frame by frame, the
// record the renderer is given, the sources it would file with the solver, the mixer's calls) and what the CPU's light estimate reads beside the drum — never
// a flame seen or a crack heard. tools/qa/fire-page.cjs looks at the page.
//   burns     the pass, switch on, twenty seconds: its brazier is found, the lamp's strength swings about the authored one (its mean within a twentieth of
//             it) and its place wanders by no more than the table says, and the renderer is handed one fire at the drum's mouth
//   same      … the swing is a closed form of the game's clock: a second game stood the same way has the same strength every frame, and the lamp is what
//             fireFlicker says for that time
//   sound     one bed voice that follows the fire, and a crack for each pop of the wood, about as often as the table says
//   smoke     with a solver drawing: a source a second over the flames, every one LOOK ONLY, on the coarse lattice, none thicker than the table says; with
//             none drawing: no source at all
//   out       the lamp put out (as a round or the jammer would): the frame after, no fire is handed to the renderer, no source, no crack, and the lamp is
//             back where the level hung it; lit again, it burns again
//   meter     what the CPU's light estimate reads a long stride from the drum and three metres off, switch on against off: the mean within a tenth, and
//             how far it swings (printed: the figure the area file quotes)
//   off       switch off: the lamp steady at the authored strength where the level hung it, nothing handed to the renderer, the solver or the mixer
//   old       a recording from before the key replays with it off (journal.ts applyKnobs)
import { standUp, ROOT } from './headless.ts';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DT = 1 / 60;

export async function fireCheck(o: { verbose?: boolean } = {}): Promise<boolean> {
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { FIRE, fireStats, fireFlicker, fireSeed, isFire } = await import(`${ROOT}/src/game/fire.ts`);
  const { lightEstimateAt } = await import(`${ROOT}/src/game/guards.ts`);
  const J = await import(`${ROOT}/src/game/journal.ts`);
  const BREAK = process.env.FIRE_BREAK === '1';
  const quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { if (o.verbose) return await fn(); const l = console.log, e = console.error, w = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = l; console.error = e; console.warn = w; } };
  let fails = 0, checks = 0;
  const verdict = (ok: boolean, label: string, detail: string) => { checks++; if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  const was = { on: FIRE.on, env: process.env.TPS_FIRE };

  /** the pass stood up, the switch where `on` says (by the stand's own word), its brazier found; `solver` = a smoke solver that says it draws */
  async function rig(on: boolean, solver: boolean) {
    const sw = on && !BREAK;
    process.env.TPS_FIRE = sw ? '1' : '0'; FIRE.on = !sw;   // (the module's switch left the WRONG way round: only the stand's word can put it right)
    const lvl = loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', 'pass.json'), 'utf8')));
    const W: any = await quiet(() => standUp({ level: lvl, seed: 7 }));
    const g = W.game; const stood = FIRE.on; FIRE.on = sw;
    g.aiEnabled = false;   // (nobody's eyes or ears are this file's question: the men stand)
    const t = g.targets.find((x: any) => isFire(x));
    const sources: any[] = [];
    const emit0 = g.smoke.emit?.bind(g.smoke); g.smoke.emit = (e: any) => { sources.push(e); emit0?.(e); };
    if (solver) g.smoke.drawing = () => true;
    W.audioLog = [];
    if (t) g.engine.viewFocus = [t.pos[0], 0, t.pos[2]];   // (the view is on the fire: the harness never draws, so nothing else would say where it looks)
    const step = (n = 1, each?: () => void) => { for (let i = 0; i < n; i++) { FIRE.on = sw; W.step(DT); each?.(); } };
    return { W, g, t, step, stood, sw, sources };
  }
  const mine = (A: any) => A.sources.filter((e: any) => e.kind === 'cloud' && e.look === true && e.tint);

  try {
    // ---- burns, same, sound
    {
      const A = await rig(true, false), t = A.t, K = FIRE;
      if (!t) { verdict(false, 'burns — the pass has a fire', 'no light of the level is named as one'); }
      else {
        const base = t.baseIntensity, l = t.light, seq: number[] = []; let lo = 9, hi = -9, sum = 0, n = 0, far = 0, off = 0;
        A.step(20 * 60, () => { const f = l.intensity / base; seq.push(l.intensity); lo = Math.min(lo, f); hi = Math.max(hi, f); sum += f; n++;
          far = Math.max(far, Math.hypot(l.pos[0] - t.pos[0], l.pos[1] - t.pos[1], l.pos[2] - t.pos[2]));
          off = Math.max(off, Math.abs(l.intensity - base * t.factor * fireFlicker(fireSeed(t), A.g.time))); });
        const fires = A.g.engine.fires ?? [], F = fires[0], box = t.boxes.length ? A.g.engine.world.statics[t.boxes[0]] : null, T = fireStats(A.g);
        const atMouth = !!F && !!box && Math.hypot(F.pos[0] - box.c[0], F.pos[2] - box.c[2]) < 0.01 && Math.abs(F.pos[1] - (box.c[1] + box.h[1])) < 0.01 && F.r > 0.05 && F.r <= Math.min(box.h[0], box.h[2]);
        verdict(A.stood === A.sw && T.lit === 1 && lo < 1 - K.depth * 0.5 && hi > 1 + K.depth * 0.5 && lo > 0.4 && hi < 2 && Math.abs(sum / n - 1) < 0.05 && far > 0.005 && far <= Math.hypot(K.wander, K.wander, K.wanderUp * 4) && fires.length === 1 && atMouth,
          'burns — the pass\'s brazier: the lamp swings about the authored strength and wanders a little, and the renderer is handed one fire at the drum\'s mouth',
          `the stand stood the switch ${A.stood ? 'on' : 'off'} · ${T.lit} of ${T.fires} burning · the lamp ${lo.toFixed(2)} to ${hi.toFixed(2)} of the authored ${base} (mean ${(sum / n).toFixed(3)}), at most ${(far * 100).toFixed(1)} cm from where the level hung it · ${fires.length} handed on${F ? `: at ${F.pos.map((v: number) => v.toFixed(2)).join(', ')}, mouth ${F.r.toFixed(3)} m, flame ${F.h} m, ${F.embers} embers` : ''}`);
        const B = await rig(true, false), seqB: number[] = []; if (B.t) B.step(20 * 60, () => seqB.push(B.t.light.intensity));
        let diff = 0; for (let i = 0; i < seq.length; i++) if (seq[i] !== seqB[i]) diff++;
        verdict(A.sw && seqB.length === seq.length && diff === 0 && off < 1e-9, 'same — the swing is a closed form of the clock: a second game has the same lamp every frame',
          `${seq.length} frames, ${diff} differ · the lamp against fireFlicker at its own time: at most ${off.toExponential(1)} apart`);
        const log = A.W.audioLog as any[], beds = log.filter(c => c.name === 'fireBed'), cracks = log.filter(c => c.name === 'fireCrack'), want = K.popRate * 20;
        verdict(beds.length === 1 && typeof beds[0].opts?.follow === 'function' && !!beds[0].opts.follow() && cracks.length === T.cracks && cracks.length >= want * 0.35 && cracks.length <= want * 2.2 && cracks.every(c => c.gain > 0 && c.gain <= K.crack),
          'sound — one bed voice that follows the fire and a crack for each pop of the wood',
          `${beds.length} bed${beds[0] ? ` (followed: ${typeof beds[0].opts?.follow === 'function'})` : ''}, ${cracks.length} cracks in twenty seconds (the table's rate makes ${want.toFixed(0)}; the fire counted ${T.cracks})${cracks.length ? `, level ${Math.min(...cracks.map(c => c.gain)).toFixed(2)} to ${Math.max(...cracks.map(c => c.gain)).toFixed(2)}` : ''}`);
        // ---- out
        const none0 = mine(A).length;
        t.on = false; t.broken = true; A.step(3); const n0 = (A.W.audioLog as any[]).length;
        A.step(6 * 60); const gone = (A.g.engine.fires ?? []).length, back = Math.hypot(l.pos[0] - t.pos[0], l.pos[1] - t.pos[1], l.pos[2] - t.pos[2]), quietN = (A.W.audioLog as any[]).slice(n0).filter(c => c.name === 'fireCrack').length, bedLet = beds[0]?.opts?.follow?.() ?? null;
        t.on = true; t.broken = false; A.step(4 * 60); const again = (A.g.engine.fires ?? []).length;
        verdict(A.sw && t.factor > 0.5 && gone === 0 && back < 1e-9 && quietN === 0 && bedLet === null && again === 1 && none0 === 0,
          'out — the lamp put out: nothing handed to the renderer, no crack, the bed let go, the lamp back where the level hung it; lit again, it burns again',
          `out for six seconds: ${gone} handed on, ${quietN} cracks, the bed ${bedLet === null ? 'let go' : 'still held'}, the lamp ${back.toFixed(4)} m from its place · lit again: ${again} handed on · (no solver drawing in this game: ${none0} sources)`);
      }
    }
    // ---- smoke through a solver
    {
      const A = await rig(true, true), K = FIRE; A.step(12 * 60);
      const S = mine(A), F = (A.g.engine.fires ?? [])[0], want = 12 / K.smoke.every;
      const ok = !!F && S.length >= want - 2 && S.length <= want + 2 && S.every((e: any) => e.lattice === 'coarse' && e.density <= K.smoke.density + 1e-9 && e.ttl <= K.smoke.every + 1e-9 && Math.hypot(e.pos[0] - F.pos[0], e.pos[2] - F.pos[2]) < 0.01 && e.pos[1] > F.pos[1] + 0.2 && e.pos[1] < F.pos[1] + 1.2);
      verdict(ok, 'smoke — with a solver drawing: a short source a second over the flames, every one look-only, on the coarse lattice, none thicker than the table says',
        `${S.length} sources in twelve seconds (${A.sources.length} filed in all by the game) · coarse lattice: ${S.every((e: any) => e.lattice === 'coarse')} · thickest ${Math.max(0, ...S.map((e: any) => e.density))} against the table's ${K.smoke.density}${S[0] && F ? ` · ${(S[0].pos[1] - F.pos[1]).toFixed(2)} m over the coals` : ''}`);
      const B = await rig(true, false); B.step(6 * 60);
      verdict(B.sw && mine(B).length === 0, 'smoke — … and with no solver drawing, no source at all', `${mine(B).length} sources`);
    }
    // ---- meter
    {
      const read = async (on: boolean) => { const A = await rig(on, false), t = A.t, out: { lo: number; hi: number; mean: number }[] = []; if (!t) return out;
        const spots = [[t.pos[0] - 1.25, 1.0, t.pos[2]], [t.pos[0] - 3, 1.0, t.pos[2]]], acc = spots.map(() => ({ lo: Infinity, hi: -Infinity, sum: 0, n: 0 }));
        A.step(20 * 60, () => spots.forEach((p, i) => { const v = lightEstimateAt(A.g, p as any), a = acc[i]; a.lo = Math.min(a.lo, v); a.hi = Math.max(a.hi, v); a.sum += v; a.n++; }));
        return acc.map(a => ({ lo: a.lo, hi: a.hi, mean: a.sum / a.n })); };
      const on = await read(true), off = await read(false);
      const ok = on.length === 2 && off.length === 2 && on.every((r, i) => off[i].mean > 0 && Math.abs(r.mean / off[i].mean - 1) < 0.1 && r.hi > r.lo * 1.1) && off.every(r => r.hi - r.lo < 1e-6 * Math.max(1, r.hi));
      verdict(ok, 'meter — the CPU\'s light estimate beside the drum: the mean within a tenth of the steady lamp\'s, and it swings',
        on.length === 2 && off.length === 2 ? ['1.25 m', '3 m'].map((d, i) => `${d}: steady ${off[i].mean.toFixed(3)}, burning ${on[i].lo.toFixed(3)} to ${on[i].hi.toFixed(3)} (mean ${on[i].mean.toFixed(3)}, ${((on[i].mean / off[i].mean - 1) * 100).toFixed(1)} %)`).join(' · ') : 'no fire to read');
    }
    // ---- off
    {
      const A = await rig(false, true), t = A.t;
      if (!t) verdict(false, 'off — the pass has a fire', 'none found');
      else { let lo = Infinity, hi = -Infinity, far = 0; A.step(12 * 60, () => { lo = Math.min(lo, t.light.intensity); hi = Math.max(hi, t.light.intensity); far = Math.max(far, Math.hypot(t.light.pos[0] - t.pos[0], t.light.pos[1] - t.pos[1], t.light.pos[2] - t.pos[2])); });
        const log = A.W.audioLog as any[], snd = log.filter(c => c.name === 'fireBed' || c.name === 'fireCrack').length;
        verdict(!A.sw && A.stood === false && lo === hi && hi === t.baseIntensity && far === 0 && (A.g.engine.fires ?? []).length === 0 && mine(A).length === 0 && snd === 0,
          'off — switch off: the lamp steady where the level hung it, nothing handed to the renderer, the solver or the mixer',
          `the stand stood the switch ${A.stood ? 'on' : 'off'} · the lamp ${lo} to ${hi} (authored ${t.baseIntensity}), ${far} m from its place · ${(A.g.engine.fires ?? []).length} fires handed on, ${mine(A).length} sources, ${snd} sounds`); }
    }
    // ---- old
    {
      const A = await rig(true, false);
      FIRE.on = true; const k = (J as any).knobsSnapshot(A.g); (J as any).applyKnobs(A.g, k); const kept = FIRE.on;
      FIRE.on = true; const k2 = (J as any).knobsSnapshot(A.g); delete k2.tables.FIRE; (J as any).applyKnobs(A.g, k2); const none = FIRE.on;
      verdict(kept === true && none === false, 'old — a recording from before the key replays with it off', `its own snapshot put back: ${kept ? 'on' : 'off'} · one without the table: ${none ? 'on' : 'off'}`);
    }
  } finally { FIRE.on = was.on; if (was.env === undefined) delete process.env.TPS_FIRE; else process.env.TPS_FIRE = was.env; }
  console.log(`\nfire-check: ${checks - fails}/${checks} pass${BREAK ? ' (FIRE_BREAK=1: the switch never raised — this run must fail)' : ''}`);
  return fails === 0;
}

if (import.meta.main) { const ok = await fireCheck({ verbose: process.argv.includes('--verbose') }); process.exit(ok ? 0 : 1); }
