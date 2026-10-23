// AN OPEN FIRE BURNS (src/game/fire.ts FIRE / updateFire; the flame and the embers are render/shaders/fire.wgsl; the light is the level's own lamp).
//
// The maintainer, 10-23: "we gotta improve our fire! we have barrels with fire on them … great fire with smoke and crackles and dynamic lighting would look sick."
//
//   bun run tools/qa/fire-check.ts [--verbose]      exit 0 = all pass, 1 = a FAIL line
//   FIRE_BREAK=1 …   = the switch never raised and the same lines asked: must fail
//   FIREBOOK_BREAK=1 … = the host's put-back run with its line for the fire's book undone: the second load line must fail
//   bun run tools/qa/probes.ts fire
//   Run it on BOTH stands (TPS_PROFILE=shipped in front for the page's): it puts the switch where each line needs it by the stand's own word, TPS_FIRE.
//
// The harness has no GPU, no smoke solver and no speaker: what is proven HERE is what the game hands on (the lamp's strength and place frame by frame, the
// record the renderer is given, the sources it would file with the solver, the mixer's calls) and what the CPU's light estimate reads beside the drum — never
// a flame seen or a crack heard. tools/qa/fire-page.cjs looks at the page.
//   burns     the pass, switch on, twenty seconds: its brazier is found, the lamp's strength swings about the authored one (its mean within a twentieth of
//             it) and its place is the table's lift over where the level hung it and wanders by no more than the table says, and the renderer is handed one fire at the drum's mouth
//   same      … the swing is a closed form of the game's clock: a second game stood the same way has the same strength every frame, and the lamp is what
//             fireFlicker says for that time
//   sound     one bed voice held at a time (handed on every FIRE.bedSecs), and a crack for each pop of the wood, about as often as the table says
//   smoke     with a solver drawing: a source a second, as wide as the drum, its foot over the flames and over a standing man's head, every one LOOK ONLY, on the
//             coarse lattice, none thicker than the table says; with
//             none drawing, or with the smoke alone put off (?firesmoke=0): no source at all
//   out       the lamp put out (as a round or the jammer would): the frame after, no fire is handed to the renderer, no source, no crack, and the lamp is
//             back where the level hung it; lit again, it burns again
//   load      a checkpoint put back: the lamp, its place and the coals are that moment's on the frame it loads
//   steady    a rule that asks for the PLACE's steady light (lightEstimateAt, steadyOnly) reads the authored lamp where the level hung it: with the fire
//             burning, the same number every frame as with the switch off
//   meter     what the CPU's light estimate reads a long stride from the drum, three metres and five metres off, switch on against off: the mean within a tenth, and
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
  const { FIRE, fireStats, fireShown, fireFlicker, fireSeed, isFire } = await import(`${ROOT}/src/game/fire.ts`);
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
  const mine = (A: any) => A.sources.filter((e: any) => e.kind === 'cloud' && e.look === true && e.lattice === 'coarse');

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
        const atMouth = !!F && !!box && Math.hypot(F.pos[0] - box.c[0], F.pos[2] - box.c[2]) < 0.01 && Math.abs(F.pos[1] - (box.c[1] + box.h[1])) < 0.01 && Math.abs(F.r - Math.min(box.h[0], box.h[2]) * K.mouth) < 1e-9 && Math.abs((F.bed ?? 0) - Math.min(box.h[0], box.h[2]) * K.bedR) < 1e-9;
        verdict(A.stood === A.sw && T.lit === 1 && lo < 1 - K.depth * 0.5 && hi > 1 + K.depth * 0.5 && lo > 0.4 && hi < 2 && Math.abs(sum / n - 1) < 0.05 && far > 0.005 && far >= K.lift - K.wanderUp * 4 && far <= Math.hypot(K.wander, K.wander, K.lift + K.wanderUp * 4) && fires.length === 1 && atMouth,
          'burns — the pass\'s brazier: the lamp swings about the authored strength and wanders a little, and the renderer is handed one fire at the drum\'s mouth',
          `the stand stood the switch ${A.stood ? 'on' : 'off'} · ${T.lit} of ${T.fires} burning · the lamp ${lo.toFixed(2)} to ${hi.toFixed(2)} of the authored ${base} (mean ${(sum / n).toFixed(3)}), at most ${(far * 100).toFixed(1)} cm from where the level hung it (the table lifts it ${K.lift * 100} cm into the flame) · ${fires.length} handed on${F ? `: at ${F.pos.map((v: number) => v.toFixed(2)).join(', ')}, mouth ${F.r.toFixed(3)} m, bed of coals ${(F.bed ?? 0).toFixed(3)} m, flame ${F.h} m, ${F.embers} embers` : ''}`);
        const B = await rig(true, false), seqB: number[] = []; if (B.t) B.step(20 * 60, () => seqB.push(B.t.light.intensity));
        let diff = 0; for (let i = 0; i < seq.length; i++) if (seq[i] !== seqB[i]) diff++;
        verdict(A.sw && seqB.length === seq.length && diff === 0 && off < 1e-9, 'same — the swing is a closed form of the clock: a second game has the same lamp every frame',
          `${seq.length} frames, ${diff} differ · the lamp against fireFlicker at its own time: at most ${off.toExponential(1)} apart`);
        const log = A.W.audioLog as any[], beds = log.filter(c => c.name === 'fireBed'), cracks = log.filter(c => c.name === 'fireCrack'), want = K.popRate * 20;
        const wantBeds = 1 + Math.floor(20 / K.bedSecs), heldNow = beds.filter(c => !!c.opts?.follow?.()).length;
        verdict(beds.length === wantBeds && heldNow === 1 && !!beds[beds.length - 1]?.opts?.follow?.() && cracks.length === T.cracks && cracks.length >= want * 0.35 && cracks.length <= want * 2.2 && cracks.every(c => c.gain > 0 && c.gain <= K.crack),
          'sound — one bed voice held at a time, handed on as the table says, and a crack for each pop of the wood',
          `${beds.length} bed voices asked for in twenty seconds (one at the start and one every ${K.bedSecs} s makes ${wantBeds}), ${heldNow} held now, ${cracks.length} cracks in twenty seconds (the table's rate makes ${want.toFixed(0)}; the fire counted ${T.cracks})${cracks.length ? `, level ${Math.min(...cracks.map(c => c.gain)).toFixed(2)} to ${Math.max(...cracks.map(c => c.gain)).toFixed(2)}` : ''}`);
        // ---- out
        const none0 = mine(A).length;
        t.on = false; t.broken = true; A.step(3); const n0 = (A.W.audioLog as any[]).length;
        A.step(6 * 60); const gone = (A.g.engine.fires ?? []).length, back = Math.hypot(l.pos[0] - t.pos[0], l.pos[1] - t.pos[1], l.pos[2] - t.pos[2]), quietN = (A.W.audioLog as any[]).slice(n0).filter(c => c.name === 'fireCrack').length, bedLet = beds[0]?.opts?.follow?.() ?? null;
        const n1 = (A.W.audioLog as any[]).length; t.on = true; t.broken = false; A.step(90); const again = (A.g.engine.fires ?? []).length;
        const bed2 = (A.W.audioLog as any[]).slice(n1).filter(c => c.name === 'fireBed'), held2 = bed2.some(c => !!c.opts?.follow?.());
        verdict(A.sw && t.factor > 0.5 && gone === 0 && back < 1e-9 && quietN === 0 && bedLet === null && again === 1 && none0 === 0 && bed2.length >= 1 && held2,
          'out — the lamp put out: nothing handed to the renderer, no crack, the bed let go, the lamp back where the level hung it; lit again, it burns again and its bed is asked for again',
          `out for six seconds: ${gone} handed on, ${quietN} cracks, the bed ${bedLet === null ? 'let go' : 'still held'}, the lamp ${back.toFixed(4)} m from its place · lit again: ${again} handed on, ${bed2.length} bed asked for in the next second and a half (${held2 ? 'held' : 'not held'}) · (no solver drawing in this game: ${none0} sources)`);
        // ---- load
        A.step(137); const at = { I: l.intensity, p: [...l.pos], e: box ? [...box.emissive] : [], time: A.g.time }; const save = A.W.snapshot('fire', true);
        A.step(91); A.W.restore(save);
        const dI = Math.abs(l.intensity - at.I), dp = Math.hypot(l.pos[0] - at.p[0], l.pos[1] - at.p[1], l.pos[2] - at.p[2]), de = box ? Math.max(...at.e.map((v, i) => Math.abs(v - box.emissive[i]))) : 0;
        verdict(A.sw && dI < 1e-9 && dp < 1e-9 && de < 1e-9 && Math.abs(A.g.time - at.time) < 1e-9 && at.I !== base,
          'load — a checkpoint put back: the lamp, its place and the coals are that moment\'s the frame it loads, not the steady lamp',
          `saved with the lamp at ${at.I.toFixed(3)} (authored ${base}); 91 frames later, loaded: the lamp ${l.intensity.toFixed(3)} (${dI.toExponential(1)} off), its place ${dp.toExponential(1)} m off, the coals ${de.toExponential(1)} off`);
        // ---- … and the host's side of a load: the book of what was asked of the mixer is dropped (host/putback.ts's line for a save in memory; a file's load and a
        //      restart drop it in their own paint, dt 0), so the bed is asked for again on the next frame and the voice of the abandoned moment lets go
        { const log = A.W.audioLog as any[], asked = (from: number) => log.slice(from).filter(c => c.name === 'fireBed').length, held = () => log.filter(c => c.name === 'fireBed' && !!c.opts?.follow?.()).length;
          const hLoad = held(); let n = log.length; A.step(1); const b1 = asked(n), h1 = held();   // (the checkpoint just put back above painted the fire with dt 0)
          n = log.length; A.step(3); const idle = asked(n);
          // (the host's REAL put-back, host/putback.ts, as the page's `saves.onPutBack` calls it. The harness's engine has no GPU books to forget: the calls it lacks are
          //  stood in as no-ops for this one call, and FIREBOOK_BREAK=1 runs it with the fire's line undone, which must fail this line)
          const { hostAfterPutBack } = await import(`${ROOT}/src/host/putback.ts`);
          const lacking: string[] = [], E: any = A.g.engine, G: any = A.g, noop = () => { };
          for (const [o, k] of [[E.world, 'forgetSent'], [E.lights, 'forgetSent'], [G.chars, 'forgetSent'], [G.decals, 'touch'], [G, 'rehand'], [E, 'resetTaa'], [E, 'invalidateWorldCache']] as [any, string][]) if (o && typeof o[k] !== 'function') { o[k] = noop; lacking.push(k); }
          n = log.length; const book = E.fireShown; hostAfterPutBack(A.g); if (process.env.FIREBOOK_BREAK === '1') E.fireShown = book;
          const hDrop = held(); A.step(1); const b2 = asked(n), h2 = held();
          verdict(A.sw && hLoad === 0 && b1 === 1 && h1 === 1 && idle === 0 && hDrop === 0 && b2 === 1 && h2 === 1,
            'load — … and the host\'s book of the bed is dropped with it: the voice of the abandoned moment lets go and one bed is asked for on the next frame (a checkpoint\'s or a restart\'s own paint; a save in memory put back by the host)',
            `the checkpoint put back: ${hLoad} held, ${b1} asked for on the next frame (${h1} held), ${idle} more in the three frames after · the host's own put-back (host/putback.ts hostAfterPutBack${lacking.length ? `; ${lacking.length} GPU books the harness lacks stood in` : ''}): ${hDrop} held the moment after, ${b2} asked for on the next frame (${h2} held)`); }
      }
    }
    // ---- smoke through a solver
    {
      const A = await rig(true, true), K = FIRE; A.step(12 * 60);
      const S = mine(A), F = (A.g.engine.fires ?? [])[0], want = 12 / K.smoke.every;
      const ok = !!F && S.length >= want - 2 && S.length <= want + 2 && S.every((e: any) => e.lattice === 'coarse' && e.density <= K.smoke.density + 1e-9 && e.ttl <= K.smoke.every + 1e-9 && Math.hypot(e.pos[0] - F.pos[0], e.pos[2] - F.pos[2]) < 0.01 && e.pos[1] - e.radius > F.pos[1] + K.height && e.pos[1] - e.radius > 1.9 && e.pos[1] < F.pos[1] + 2.5 && e.radius >= 0.2);
      verdict(ok, 'smoke — with a solver drawing: a short source a second, as wide as the drum, its foot over the flames and over a standing man\'s head (1.9 m), every one look-only, on the coarse lattice, none thicker than the table says',
        `${S.length} sources in twelve seconds (${A.sources.length} filed in all by the game) · coarse lattice: ${S.every((e: any) => e.lattice === 'coarse')} · thickest ${Math.max(0, ...S.map((e: any) => e.density))} against the table's ${K.smoke.density}${S[0] && F ? ` · ${(S[0].pos[1] - F.pos[1]).toFixed(2)} m over the coals, its foot ${(S[0].pos[1] - S[0].radius).toFixed(2)} m over the floor, ${S[0].radius} m in radius` : ''}`);
      const B = await rig(true, false); B.step(6 * 60);
      verdict(B.sw && mine(B).length === 0, 'smoke — … and with no solver drawing, no source at all', `${mine(B).length} sources`);
      // … and the book of the smoke is the host's (fire.ts FireShown, on the engine): the game that smoked for twelve seconds and the one nothing drew are the same game
      { const RB = await import(`${ROOT}/src/game/rollback.ts`); B.step(6 * 60);
        const all: string[] = RB.stateDiff(A.g, B.g, 64), own = all.filter(d => d.startsWith('fire.')), cut = all.some(d => d.startsWith('(the shapes part')) || all.length >= 64, P = fireShown(A.g), Q = fireShown(B.g);
        // (what the fire writes outside its own table, asked by name: the lamp, its place, what the steady readers are told, the coals. Another module's own word for the solver is its own: named, not judged)
        const la = A.t.light, lb = B.t.light, ba = A.t.boxes.length ? A.g.engine.world.statics[A.t.boxes[0]] : null, bb = B.t.boxes.length ? B.g.engine.world.statics[B.t.boxes[0]] : null;
        const lamp = la.intensity === lb.intensity && la.pos.every((v: number, i: number) => v === lb.pos[i]) && la.steady?.intensity === lb.steady?.intensity && (!ba || !bb || ba.emissive.every((v: number, i: number) => v === bb.emissive[i]));
        verdict(A.sw && B.sw && own.length === 0 && !cut && lamp && P?.smokes === S.length && Q?.smokes === 0, 'smoke — … and what remembers the smoke is the host\'s, not the game\'s: after twelve seconds the game whose fire smoked and the one nothing drew differ in nothing of the fire\'s',
          `${P?.smokes} sources counted with a solver drawing, ${Q?.smokes} with none · the two games' states differ in ${own.length} of the fire's rows${own.length ? `: ${own.slice(0, 4).join(' | ')}` : ''} and ${all.length - own.length} of other modules'${all.length > own.length ? ` (${all.filter(d => !d.startsWith('fire.')).slice(0, 3).map(d => d.split(':')[0]).join(', ')})` : ''}${cut ? ' · THE WALK WAS CUT SHORT: not all of it was compared' : ''} · the lamp, its place and the coals ${lamp ? 'the same to the bit' : 'DIFFER'}`); }
      // … and by the graphics preset on (ui/quality.ts FIRE SMOKE SHED): the REAL Quality over this game's own settings, a preset put on by hand as the menu does
      { const { Quality } = await import(`${ROOT}/src/ui/quality.ts`); const D = await rig(true, true), S = D.g.engine.settings;
        S.fireSmokeShed = process.env.FIRESHED_BREAK !== '1';   // (FIRESHED_BREAK=1: the rule's switch off, and this line must FAIL)
        const E = { settings: S, rc: { cfg: { ...(D.g.engine.rc?.cfg ?? {}) } }, rebuildRc(c: any) { E.rc.cfg = c; }, gpu: { canvas: { clientHeight: 900, clientWidth: 1600 } }, capScale: 1, effectiveScale: 1, timer: { enabled: false, results: new Map<string, number>(), total: () => 0, unionMs: () => 0 } };
        const q: any = new Quality(E as never, { params: { rbIters: 4 } } as never);
        q.pin('verylow'); D.step(4 * 60); const none = mine(D).length, drawn = (D.g.engine.fires ?? []).length;
        q.pin('low'); D.step(1); const atOnce = mine(D).length - none; D.step(3 * 60); const after = mine(D).length - none;
        verdict(D.sw && none === 0 && drawn === 1 && atOnce === 1 && after >= 3, 'smoke — … and on the graphics preset that sheds it (verylow put on: settings.fireSmoke), the fire burns and files no source; low put on, it smokes the same frame',
          `verylow: ${none} sources in four seconds, ${drawn} fire handed to the renderer · low: ${atOnce} source the frame it was put on, ${after} three seconds on`); }
      K.smoke.on = false;
      try { const C = await rig(true, true); C.step(4 * 60); const drawn = (C.g.engine.fires ?? []).length;
        verdict(C.sw && mine(C).length === 0 && drawn === 1, 'smoke — … and with the smoke alone put off (the page\'s ?firesmoke=0), the fire burns and files no source', `${mine(C).length} sources · ${drawn} fire handed to the renderer`); }
      finally { K.smoke.on = true; }
    }
    // ---- meter
    {
      const read = async (on: boolean) => { const A = await rig(on, false), t = A.t, out: { lo: number; hi: number; mean: number; slo: number; shi: number }[] = []; if (!t) return out;
        const spots = [[t.pos[0] - 1.25, 1.0, t.pos[2]], [t.pos[0] - 3, 1.0, t.pos[2]], [t.pos[0] - 5, 1.0, t.pos[2]]], acc = spots.map(() => ({ lo: Infinity, hi: -Infinity, sum: 0, n: 0, slo: Infinity, shi: -Infinity }));
        A.step(20 * 60, () => spots.forEach((p, i) => { const v = lightEstimateAt(A.g, p as any), sv = lightEstimateAt(A.g, p as any, undefined, true), a = acc[i]; a.lo = Math.min(a.lo, v); a.hi = Math.max(a.hi, v); a.sum += v; a.n++; a.slo = Math.min(a.slo, sv); a.shi = Math.max(a.shi, sv); }));
        return acc.map(a => ({ lo: a.lo, hi: a.hi, mean: a.sum / a.n, slo: a.slo, shi: a.shi })); };
      const on = await read(true), off = await read(false);
      verdict(on.length === 3 && off.length === 3 && on.every((r, i) => r.slo === r.shi && r.slo === off[i].slo && off[i].slo === off[i].shi && r.hi > r.lo),
        'steady — who asks for the place\'s steady light reads the authored lamp: the same number every frame as with the switch off, while the lamp swings',
        on.length === 3 && off.length === 3 ? ['1.25 m', '3 m', '5 m'].map((d, i) => `${d}: steady reader ${on[i].slo.toFixed(4)} to ${on[i].shi.toFixed(4)} burning, ${off[i].slo.toFixed(4)} off`).join(' · ') : 'no fire to read');
      const ok = on.length === 3 && off.length === 3 && on.every((r, i) => off[i].mean > 0 && Math.abs(r.mean / off[i].mean - 1) < 0.1 && (i === 2 || r.hi > r.lo * 1.1)) && off.every(r => r.hi - r.lo < 1e-6 * Math.max(1, r.hi));   // (five metres off is another lamp's ground on the pass: read, not judged for a swing)
      verdict(ok, 'meter — the CPU\'s light estimate beside the drum: the mean within a tenth of the steady lamp\'s, and it swings',
        on.length === 3 && off.length === 3 ? ['1.25 m', '3 m', '5 m'].map((d, i) => `${d}: steady ${off[i].mean.toFixed(3)}, burning ${on[i].lo.toFixed(3)} to ${on[i].hi.toFixed(3)} (mean ${on[i].mean.toFixed(3)}, ${((on[i].mean / off[i].mean - 1) * 100).toFixed(1)} %)`).join(' · ') : 'no fire to read');
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
