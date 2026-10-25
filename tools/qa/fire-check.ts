// AN OPEN FIRE BURNS (src/game/fire.ts FIRE / updateFire; the flame is render/shaders/fire.wgsl, the embers are GPU particles; the light is the level's own lamp).
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
//   burns     the pass, switch on, twenty seconds: its brazier is found, the lamp's strength swings about the authored one (its mean within a tenth of
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
//   size      while it burns the lamp is as big as the flame (FIRE.size × the mouth) and the steady readers still take it for the size the level gave it, a hand
//             from the lamp where the two sizes differ most; the level's size back the frame the switch goes off; `size` 0 (the page's ?firesize=0) = the level's
//             size burning; a recording from before the key replays with it 0
//   fog       under the fog of war a fire is drawn as the team last saw it: its record says wherever it stands while it burns and is known to; only where the
//             team sees when the fog has its lamp as one lit unseen (RtLight.fog 1, said by hand); with the fog itself raised and the squad at its start,
//             the frame the fire is put out its record is one at full heat for where the team does not see (the lamp's ghost up, the lamp itself as the
//             level hung it); with FIRE.fog off (?firefog=0) only where the team sees and no ghost; a recording from before the key replays with it off
//   look      the flame's numbers (FIRE.look) reach the renderer as they stand (engine.fireLook, sixteen numbers); the embers are GPU particles: sparks flagged
//             embers, filed over the coals with a seed made by hand from the host's own book, about as many as the table says; with no pool none are filed
//             and the two games differ in nothing; FIRE.embers 0 = none; a recording from before the key replays with no shimmer, no drawn smoke, no embers
//   gas       FIRE.gas on with a solver drawing: a look-only source on the FINE lattice at the coals every `every` s, as wide and as dense as the table says, and
//             the fire's record tells the picture to draw the flame from it (eased to 1); with no solver drawing or put off: none, and the flame of noise;
//             a recording from before the key replays with it off
//   off       switch off: the lamp steady at the authored strength where the level hung it, nothing handed to the renderer, the solver or the mixer
//   old       a recording from before the key replays with it off (journal.ts applyKnobs)
import { standUp, ROOT, fake } from './headless.ts';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DT = 1 / 60;

export async function fireCheck(o: { verbose?: boolean } = {}): Promise<boolean> {
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { FIRE, FIRE_LEAN_WAS, FIRE_LIFT_WAS, FIRE_WANDER_WAS, FIRE_WANDER_UP_WAS, fireHolds, fireStir, updateFire, fireStats, fireShown, fireFlicker, fireSeed, isFire, fireDraws } = await import(`${ROOT}/src/game/fire.ts`);
  const { FOG } = await import(`${ROOT}/src/game/fogofwar.ts`);
  const { lightEstimateAt } = await import(`${ROOT}/src/game/guards.ts`);
  const J = await import(`${ROOT}/src/game/journal.ts`);
  const BREAK = process.env.FIRE_BREAK === '1';
  const quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { if (o.verbose) return await fn(); const l = console.log, e = console.error, w = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = l; console.error = e; console.warn = w; } };
  let fails = 0, checks = 0;
  const verdict = (ok: boolean, label: string, detail: string) => { checks++; if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  const was = { on: FIRE.on, env: process.env.TPS_FIRE };
  // (the lamp's newer numbers are held at the level's own for the lines written before them — `lamp` below raises them — and the whole table is put back at the end:
  //  the journal lines of this file put an old recording's defaults into it)
  const table0: any = JSON.parse(JSON.stringify(FIRE));
  const putBack = () => { for (const k of Object.keys(table0)) { const v = table0[k], cur = (FIRE as any)[k]; if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(cur, v); else (FIRE as any)[k] = Array.isArray(v) ? [...v] : v; } };
  const levels = () => { FIRE.bright = 1; FIRE.reach = 1; FIRE.warm = [1, 1, 1]; FIRE.lift = FIRE_LIFT_WAS; FIRE.wander = FIRE_WANDER_WAS; FIRE.wanderUp = FIRE_WANDER_UP_WAS; };   // (the page's ?firebright=0&firesway=0)
  levels();

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
        verdict(A.stood === A.sw && T.lit === 1 && lo < 1 - K.depth * 0.5 && hi > 1 + K.depth * 0.5 && lo > 0.4 && hi < 2 && Math.abs(sum / n - 1) < 0.1 && far > 0.005 && far >= K.lift - K.wanderUp * 4 && far <= Math.hypot(K.wander, K.wander, K.lift + K.wanderUp * 4) && fires.length === 1 && atMouth,
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
        // ---- … and the host's side of a load: who abandons the moment drops the book of what was asked of the mixer (game.ts restartEncounter, which a
        //      checkpoint's load goes through; host/putback.ts for a save in memory), so the bed is asked for again on the next frame that moves the clock
        //      and the voice of the abandoned moment lets go
        { const log = A.W.audioLog as any[], asked = (from: number) => log.slice(from).filter(c => c.name === 'fireBed').length, held = () => log.filter(c => c.name === 'fireBed' && !!c.opts?.follow?.()).length;
          const hLoad = held(); let n = log.length; A.step(1); const b1 = asked(n), h1 = held();   // (the checkpoint just put back above dropped the book: the abandoned moment's voice has let go already)
          n = log.length; A.step(3); const idle = asked(n);
          // (the host's REAL put-back, host/putback.ts, as the page's `saves.onPutBack` calls it. The harness's engine has no GPU books to forget: the calls it lacks are
          //  stood in as no-ops for this one call, and FIREBOOK_BREAK=1 runs it with the fire's line undone, which must fail this line)
          const { hostAfterPutBack } = await import(`${ROOT}/src/host/putback.ts`);
          const lacking: string[] = [], E: any = A.g.engine, G: any = A.g, noop = () => { };
          for (const [o, k] of [[E.world, 'forgetSent'], [E.lights, 'forgetSent'], [G.chars, 'forgetSent'], [G.decals, 'touch'], [G, 'rehand'], [E, 'resetTaa'], [E, 'invalidateWorldCache']] as [any, string][]) if (o && typeof o[k] !== 'function') { o[k] = noop; lacking.push(k); }
          n = log.length; const books = E.hostBooks; hostAfterPutBack(A.g); if (process.env.FIREBOOK_BREAK === '1') E.hostBooks = books;
          const hDrop = held(); A.step(1); const b2 = asked(n), h2 = held();
          verdict(A.sw && hLoad === 0 && b1 === 1 && h1 === 1 && idle === 0 && hDrop === 0 && b2 === 1 && h2 === 1,
            'load — … and the host\'s book of the bed is dropped with it: the voice of the abandoned moment lets go and one bed is asked for on the next frame (a checkpoint put back; a save in memory put back by the host)',
            `the checkpoint put back: ${hLoad} held before a frame has run, ${b1} asked for on the next frame (${h1} held), ${idle} more in the three frames after · the host's own put-back (host/putback.ts hostAfterPutBack${lacking.length ? `; ${lacking.length} GPU books the harness lacks stood in` : ''}): ${hDrop} held the moment after, ${b2} asked for on the next frame (${h2} held)`);
          // ---- … and a frame that moves no clock is not a load: the page updates with dt 0 for the kit page's still, a card's frozen still and a pause
          n = log.length; for (let i = 0; i < 3; i++) { FIRE.on = A.sw; A.W.step(0); } const hStill = held(); A.step(2); const b3 = asked(n), h3 = held();
          verdict(A.sw && hStill === 1 && b3 === 0 && h3 === 1, 'still — three frames that move no clock (the kit page\'s still paint, a card\'s frozen still): the bed\'s voice is kept and none is asked for when the clock moves again',
            `${hStill} held through the stills, ${b3} asked for in the two frames after (${h3} held)`); }
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
        const all: string[] = RB.stateDiff(A.g, B.g, 64, false, true), own = all.filter(d => d.startsWith('fire.')), cut = all.some(d => d.startsWith('(the shapes part')) || all.length >= 64, P = fireShown(A.g), Q = fireShown(B.g);
        // (the two games stand in ONE process: compared by their OWN state, stateDiff's fifth word, without the modules' variables both share. The compare walks on
        //  past a value that differs and past a shape that holds nothing new; where the two walks fall out of step it says so in a '(the shapes part here …' line and
        //  nothing after is compared — read here as NOT PROVEN, and so is a list cut at its 64 rows)
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
        for (let i = 0; i < 3; i++) { FIRE.on = D.sw; D.W.step(0); } D.step(2); const still = mine(D).length - none - after;   // (… and frames that move no clock file nothing, then or when it moves again)
        verdict(D.sw && none === 0 && drawn === 1 && atOnce === 1 && after >= 3 && still === 0, 'smoke — … and on the graphics preset that sheds it (verylow put on: settings.fireSmoke), the fire burns and files no source; low put on, it smokes the same frame',
          `verylow: ${none} sources in four seconds, ${drawn} fire handed to the renderer · low: ${atOnce} source the frame it was put on, ${after} three seconds on · ${still} more through three frames that move no clock and the two after`);
        // … and a restart (the clock does not move with it; the solver is emptied) drops the book: a source and a bed on the next frame, the old voice let go
        { const log = D.W.audioLog as any[], beds = () => log.filter(c => c.name === 'fireBed').length, held = () => log.filter(c => c.name === 'fireBed' && !!c.opts?.follow?.()).length;
          D.step(20); const s0 = mine(D).length, b0 = beds(), h0 = held(), t0 = D.g.time; FIRE.on = D.sw; D.g.restart(); const tR = D.g.time, hR = held(); D.step(1);
          const s1 = mine(D).length - s0, b1 = beds() - b0, h1 = held(); D.step(5); const s2 = mine(D).length - s0, b2 = beds() - b0;
          verdict(D.sw && h0 === 1 && hR === 0 && s1 === 1 && b1 === 1 && h1 === 1 && s2 === 1 && b2 === 1, 'restart — the encounter restarted mid-second: the fire files its smoke and asks for its bed on the next frame, once, and the old voice lets go',
            `the clock ${t0.toFixed(3)} before, ${tR.toFixed(3)} after · held ${h0} before, ${hR} the moment after · the next frame: ${s1} source, ${b1} bed asked for (${h1} held) · five frames on: ${s2} and ${b2}`); } }
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
    // ---- size
    {
      const size0 = FIRE.size;
      try {
        const B = await rig(false, false), authored = B.t ? B.t.light.radius : NaN, near = B.t ? [B.t.pos[0] + 0.15, B.t.pos[1], B.t.pos[2]] : [0, 0, 0];
        let offNear = NaN; if (B.t) B.step(30, () => { offNear = lightEstimateAt(B.g, near as any, undefined, true); });
        const A = await rig(true, false), t = A.t;
        if (!t) verdict(false, 'size — the pass has a fire', 'none found');
        else {
          let big = -Infinity, small = Infinity, told = NaN, nearLo = Infinity, nearHi = -Infinity;
          A.step(60, () => { big = Math.max(big, t.light.radius); small = Math.min(small, t.light.radius); told = t.light.steady ? t.light.steady.radius : NaN; const v = lightEstimateAt(A.g, near as any, undefined, true); nearLo = Math.min(nearLo, v); nearHi = Math.max(nearHi, v); });
          FIRE.size = 0; let pin = NaN; A.step(2, () => { pin = t.light.radius; }); FIRE.size = size0;
          let back = NaN; A.step(2, () => { back = t.light.radius; });
          FIRE.on = false; A.W.step(DT); A.W.step(DT); const off = t.light.radius, kept = t.light.steady !== undefined; FIRE.on = A.sw;   // (the rig's own step raises the switch each frame)
          const k = (J as any).knobsSnapshot(A.g); FIRE.size = 0.5; (J as any).applyKnobs(A.g, k); const own = FIRE.size;
          const k2 = (J as any).knobsSnapshot(A.g); delete k2.tables.FIRE.size; FIRE.size = 0.5; (J as any).applyKnobs(A.g, k2); const old = FIRE.size;
          verdict(authored > 0 && big === small && big > authored * 2 && told === authored && nearLo === nearHi && nearLo === offNear && pin === authored && back === big && off === authored && !kept && own === size0 && old === 0,
            'size — burning, the lamp is as big as the flame and the steady readers take it for the level\'s size; the level\'s size back with the switch off, with `size` 0, and in a recording from before the key',
            `the level made it ${authored} m · burning ${small.toFixed(3)} to ${big.toFixed(3)} m, the steady readers told ${told} · a hand from the lamp the steady reader reads ${nearLo.toFixed(3)} to ${nearHi.toFixed(3)} burning, ${offNear.toFixed(3)} off · size 0: ${pin} m, put back: ${back.toFixed(3)} · switch off: ${off} m, the steady record ${kept ? 'kept' : 'dropped'} · its own snapshot put back: size ${own} · one without the key: ${old}`);
        }
      } finally { FIRE.size = size0; }
    }
    // ---- fog
    {
      const fog0 = FIRE.fog, full0 = FOG.full;
      try {
        const A = await rig(true, false), t = A.t, E = A.g.engine, FW = A.g.fogOfWar, fw0 = FW.on, rec = () => (E.fires ?? []).map((f: any) => `${f.fog ?? 0}@${f.heat.toFixed(2)}`).join(',') || 'none';
        if (!t) verdict(false, 'fog — the pass has a fire', 'none found');
        else {
          const l = t.light; FIRE.fog = true; A.step(30); const plainly = rec();
          l.fog = 1; fireDraws(A.g); const relit = rec(); l.fog = 0;   // (the fog's word for a lamp lit where nobody saw, said by hand: the squad cannot be walked to look here)
          FIRE.fog = false; fireDraws(A.g); const offLit = rec(); FIRE.fog = true;
          // the fog itself raised, the squad where the mission starts it: nobody sees the yard
          FW.on = true; FOG.full = true; A.step(2); const known = rec();
          const c0 = [...(l.steady?.color ?? l.color)], r0 = (l.steady?.range ?? l.range) as number, W = [1, 0.72, 0.51]; FIRE.bright = 2; FIRE.reach = 1.4; FIRE.warm = [...W]; A.step(2);   // (a fire's lamp, to see what the fog remembers of it once it is out)
          t.on = false; t.broken = true; A.step(1); const ghost = rec(), lamp = l.fogGhost ?? 0, far = Math.hypot(l.pos[0] - t.pos[0], l.pos[1] - t.pos[1], l.pos[2] - t.pos[2]), told = l.steady !== undefined;
          A.step(60); const ghost2 = rec();
          const heldAs = { I: l.fogGhost ?? 0, tint: l.color.every((v: number, i: number) => Math.abs(v - c0[i] * W[i]) < 1e-9), reach: Math.abs(l.range - r0 * 1.4) < 1e-9, at: Math.hypot(l.pos[0] - t.pos[0], l.pos[1] - t.pos[1], l.pos[2] - t.pos[2]) };
          FIRE.fog = false; fireDraws(A.g); const offGhost = rec(); FIRE.fog = true;
          FW.on = fw0; FOG.full = full0; A.step(2); const out = rec(), let0 = l.color.every((v: number, i: number) => v === c0[i]) && l.range === r0 && l.steady === undefined; t.on = true; t.broken = false; levels();
          const k = (J as any).knobsSnapshot(A.g); FIRE.fog = false; (J as any).applyKnobs(A.g, k); const own = FIRE.fog;
          const k2 = (J as any).knobsSnapshot(A.g); delete k2.tables.FIRE.fog; FIRE.fog = true; (J as any).applyKnobs(A.g, k2); const old = FIRE.fog;
          verdict(/^0@/.test(plainly) && /^1@/.test(relit) && /^1@/.test(offLit) && /^0@/.test(known) && ghost === '2@1.00' && ghost2 === '2@1.00' && Math.abs(lamp - t.baseIntensity * 2) < 1e-9 && Math.abs(far - FIRE.lift) < 1e-9 && told && Math.abs(heldAs.I - t.baseIntensity * 2) < 1e-9 && heldAs.tint && heldAs.reach && Math.abs(heldAs.at - FIRE.lift) < 1e-9 && let0 && offGhost === 'none' && out === 'none' && own === true && old === false,
            'fog — under the fog of war a fire is drawn as the team last saw it: wherever it stands while known to burn, only where seen when lit unseen, still burning where nobody sees from the frame it is put out unseen; off, never over unseen ground',
            `burning (mode@heat): ${plainly} · the fog has its lamp as lit unseen: ${relit} · FIRE.fog off: ${offLit} · the fog raised, nobody sees the yard: ${known} · put out, that frame: ${ghost} (the lamp's ghost ${lamp}, the lamp ${far} m from its place, steady record ${told ? 'kept' : 'none'}), a second on: ${ghost2}, remembered at ${heldAs.I} (the level's ${t.baseIntensity} × the table's 2), a fire's tint ${heldAs.tint ? 'yes' : 'NO'}, a fire's reach ${heldAs.reach ? 'yes' : 'NO'}, ${heldAs.at} m from its place · the same with FIRE.fog off: ${offGhost} · the fog put off again: ${out}, the lamp ${let0 ? 'the level\'s again' : 'NOT put back'} · its own snapshot put back: ${own ? 'on' : 'off'} · one without the key: ${old ? 'on' : 'off'}`);
        }
      } finally { FIRE.fog = fog0; FOG.full = full0; levels(); }
    }

    {
      const look0 = { ...FIRE.look }, n0 = FIRE.embers;
      try {
        const A = await rig(true, false), B = await rig(true, false), E: any = A.g.engine, t = A.t;
        if (!t) verdict(false, 'look — the pass has a fire', 'none found');
        else {
          // the page's own pool over the harness's stand-in device (particleFx.ts gpuFx hands it on), its emits listened to
          const filed: any[] = [], set0 = E.settings, pool0 = E.particles;
          const { Particles } = await import(`${ROOT}/src/render/particles.ts`);
          const pool: any = new Particles(fake('device'), fake('sceneLayout')), emit0 = pool.emit.bind(pool);
          pool.emit = (kind: string, pos: number[], dir: number[], n: number, opts: any) => { if (opts?.ember !== undefined) filed.push({ kind, n, opts, up: pos[1] - t.pos[1], out: Math.hypot(pos[0] - t.pos[0], pos[2] - t.pos[2]) }); return emit0(kind, pos, dir, n, opts); };
          E.particles = pool;
          E.settings = { ...(set0 ?? {}), gpuParticles: true };
          FIRE.look.gain = 1.5; FIRE.look.shimmer = 0.02; FIRE.look.react = 0.6; FIRE.look.lean = 0.2; FIRE.look.steps = 24;
          A.step(600); B.step(600);
          const row: number[] = E.fireLook ?? [], PA = fireShown(A.g), PB = fireShown(B.g), sum = filed.reduce((a, f) => a + f.n, 0), cracks = fireStats(A.g).cracks;
          const sparks = filed.length > 0 && filed.every(f => f.kind === 'spark' && f.opts.ember > 0 && f.opts.ember < 1 && typeof f.opts.seed === 'number' && f.up > 0 && f.out < 0.01), seeds = new Set(filed.map(f => f.opts.seed)).size;
          const RB = await import(`${ROOT}/src/game/rollback.ts`);
          const all: string[] = RB.stateDiff(A.g, B.g, 64, false, true), cut = all.some(d => d.startsWith('(the shapes part')) || all.length >= 64;
          const steady = FIRE.embers / FIRE.emberLife * 10, thrown = filed.filter(f => f.n > 1), throwsOk = cracks > 0 && thrown.length === cracks && thrown.every(f => f.n >= Math.round(FIRE.emberCrack * 0.4) && f.n <= FIRE.emberCrack && f.opts.speed > FIRE.emberSpeed);
          FIRE.embers = 0; const before = filed.length; A.step(60); const none = filed.length - before; FIRE.embers = n0;
          E.settings = set0; E.particles = pool0;
          const k = (J as any).knobsSnapshot(A.g); FIRE.look.shimmer = 0; (J as any).applyKnobs(A.g, k); const own = FIRE.look.shimmer;
          const k2 = (J as any).knobsSnapshot(A.g); delete k2.tables.FIRE.look; FIRE.look.shimmer = 0.02; FIRE.look.plume = 1; FIRE.embers = 24; (J as any).applyKnobs(A.g, k2); const old = [FIRE.look.shimmer, FIRE.look.plume, FIRE.embers]; const oldRL = FIRE.look.react === 0 && FIRE.look.lean === FIRE_LEAN_WAS;
          verdict(row.length === 16 && row[0] === 1.5 && row[7] === 0.02 && row[12] === 0.6 && row[13] === 0.2 && row[14] === 24 && row[15] === 0 && oldRL && sparks && seeds === filed.length && PA?.embers === sum && sum >= steady * 0.5 && sum <= steady * 1.2 + cracks * FIRE.emberCrack + 1 && throwsOk && (PB?.embers ?? 0) === 0 && all.length === 0 && !cut && none === 0 && own === 0.02 && old.every(v => v === 0),
            'look — the flame\'s numbers reach the renderer as they stand, and its embers are particles filed by the host\'s own book: with a pool or with none the two games are the same game',
            `the row handed on: ${row.length} numbers, gain ${row[0]}, shimmer ${row[7]}, ${row[14]} samples · ${sum} embers in ${filed.length} emits over ten seconds (about ${steady.toFixed(0)} steady, and ${thrown.length} throws of ${thrown.map(f => f.n).join(', ') || 'none'} for ${cracks} cracks, each harder than a steady one: ${throwsOk ? 'yes' : 'NO'}), every one a spark flagged an ember over the coals with a seed of its own: ${sparks && seeds === filed.length ? 'yes' : 'NO'} · the book says ${PA?.embers} · with no pool: ${PB?.embers ?? 0} · the two games differ in ${all.length} rows${cut ? ' (NOT PROVEN: the compare was cut)' : ''}${all.length ? ': ' + all.slice(0, 3).join(' | ') : ''} · FIRE.embers 0: ${none} more · its own snapshot put back: shimmer ${own} · one without the key: shimmer ${old[0]}, plume ${old[1]}, embers ${old[2]}`);
        }
      } finally { Object.assign(FIRE.look, look0); FIRE.embers = n0; }
    }

    {
      const gas0 = { ...FIRE.gas };
      try {
        FIRE.gas.on = true;
        const A = await rig(true, true), B = await rig(true, false), t = A.t, G = FIRE.gas, told: number[] = [];
        A.g.smoke.keepHot = (h: number) => { told.push(h); };
        if (!t) verdict(false, 'gas — the pass has a fire', 'none found');
        else {
          const fine = (X: any) => X.sources.filter((e: any) => e.kind === 'cloud' && e.look === true && e.lattice === 'fine'), share = (X: any) => (X.g.engine.fires?.[0]?.gas ?? 0) as number;
          A.step(120); B.step(120);
          const S = fine(A), up = S.map((e: any) => e.pos[1] - (A.g.engine.fires[0].pos[1] as number)), row: number[] = A.g.engine.fireLook ?? [];
          const booked = fireShown(A.g)?.gases;
          const shaped = S.length > 0 && S.every((e: any, i: number) => Math.hypot(e.pos[0] - t.pos[0], e.pos[2] - t.pos[2]) < 0.01 && Math.abs(up[i] - FIRE.height * G.up) < 1e-6 && e.radius === G.radius && e.minVoxels === G.cells && e.density > 0 && e.density <= G.density && e.temperature > 0 && e.temperature <= G.temp && e.ttl === G.every && e.dir[1] === 1);
          const on = share(A), none = fine(B).length, off = share(B);
          const toldOn = told.join(','); FIRE.gas.on = false; const n1 = S.length; A.step(90); const after = fine(A).length - n1, back = share(A), toldOff = told.join(','); FIRE.gas.on = true;
          A.step(2); const n2 = told.length; { const all = A.g.targets; A.g.targets = all.filter((x: any) => !isFire(x)); updateFire(A.g, DT); A.g.targets = all; } const toldNone = told.slice(n2 - 1).join(',');   // (lit as gas again, then a floor with no fire: the solver is told to let hot gas go)
          const k = (J as any).knobsSnapshot(A.g); FIRE.gas.on = false; (J as any).applyKnobs(A.g, k); const own = FIRE.gas.on;
          const k2 = (J as any).knobsSnapshot(A.g); delete k2.tables.FIRE.gas; FIRE.gas.on = true; (J as any).applyKnobs(A.g, k2); const old = FIRE.gas.on;
          verdict(shaped && S.length >= 2 / G.every && S.length <= 2 / G.every + 1 && on === 1 && row[10] === G.ref && row[11] === G.lo && booked === S.length && none === 0 && off === 0 && after === 0 && back === 0 && toldOn === String(G.keep) && toldNone === `${G.keep},0` && toldOff === `${G.keep},0` && own === true && old === false,
            'gas — with a solver drawing, a fire\'s flame is gas on the fine lattice: a look-only source of heat at the coals every half second, the solver told to keep hot gas while it burns, and its record says the picture is to draw the flame from it; with no solver, or put off, none and the flame of noise',
            `${S.length} fine look sources in two seconds (every ${G.every} s), each at the drum's axis ${up[0]?.toFixed(3)} m over the coals, ${G.radius} m wide, smoke ${S[0]?.density} and heat ${S[0]?.temperature} a second, ttl ${S[0]?.ttl}: ${shaped ? 'yes' : 'NO'} · the record's share of gas ${on} · the look row's last two ${row[10]}, ${row[11]} · the book says ${booked} · no solver drawing: ${none} sources, share ${off} · the solver told to keep hot gas: ${toldOn} · put off: ${after} more in a second and a half, share back to ${back}, the solver told ${toldOff} · on again and then a floor with no fire: told ${toldNone} · its own snapshot put back: ${own ? 'on' : 'off'} · one without the key: ${old ? 'on' : 'off'}`);
        }
      } finally { Object.assign(FIRE.gas, gas0); }
    }
    // ---- lamp: a fire's lamp is a fire's (FIRE.bright, .reach, .warm), and the level's own again the moment it is out
    {
      const A = await rig(true, false), t = A.t;
      if (!t) verdict(false, 'lamp — the pass has a fire', 'none found');
      else {
        const l = t.light, c0 = [...l.color], r0 = l.range as number, base = t.baseIntensity, W = [1, 0.72, 0.51];
        const spot = [t.pos[0] - 3, 1.0, t.pos[2]]; let m0 = 0, m1 = 0;
        A.step(10 * 60, () => { m0 += lightEstimateAt(A.g, spot as any) / 600; });
        FIRE.bright = 2; FIRE.reach = 1.4; FIRE.warm = [...W]; FIRE.lift = table0.lift; FIRE.wander = table0.wander; FIRE.wanderUp = table0.wanderUp;
        let sum = 0, n = 0, told = true, tint = true, far = true;
        A.step(20 * 60, () => { m1 += lightEstimateAt(A.g, spot as any) / 1200; sum += l.intensity / base; n++; told &&= Math.abs((l.steady?.intensity ?? 0) - base * t.factor * 2) < 1e-9; tint &&= l.color.every((v: number, i: number) => Math.abs(v - c0[i] * W[i]) < 1e-9); far &&= Math.abs(l.range - r0 * 1.4) < 1e-9; });
        t.on = false; t.broken = true; A.step(30); const back = l.color.every((v: number, i: number) => v === c0[i]) && l.range === r0 && l.steady === undefined;
        t.on = true; t.broken = false; A.step(3);
        const k = (J as any).knobsSnapshot(A.g); FIRE.bright = 1; (J as any).applyKnobs(A.g, k); const own = FIRE.bright;
        const k2 = (J as any).knobsSnapshot(A.g); delete k2.tables.FIRE.bright; delete k2.tables.FIRE.reach; delete k2.tables.FIRE.hardy; FIRE.hardy = true; (J as any).applyKnobs(A.g, k2); const old = [FIRE.bright, FIRE.reach, ...FIRE.warm, FIRE.hardy ? 1 : 0];
        verdict(A.sw && Math.abs(sum / n - 2) < 0.2 && m1 > m0 * 1.5 && told && tint && far && back && own === 2 && old.join() === '1,1,1,1,1,0',
          'lamp — while it burns the lamp is the table\'s times the level\'s, carries that much further and is tinted, and the steady readers are told so; out, it is the level\'s lamp again; a recording from before the keys replays with the level\'s lamp',
          `mean ${(sum / n).toFixed(3)} of the authored ${base} (the table says 2) · the light meter three metres off reads ${m0.toFixed(3)} by the level's lamp and ${m1.toFixed(3)} by the fire's · the steady reader told twice the level's: ${told ? 'yes' : 'NO'} · colour × ${W.join(', ')}: ${tint ? 'yes' : 'NO'} · reach ${r0} × 1.4: ${far ? 'yes' : 'NO'} · put out: ${back ? 'the level\'s colour and reach, nothing told' : 'NOT put back'} · its own snapshot put back: bright ${own} · one from before the keys: bright, reach, tint, hardy = ${old.join(', ')}`);
        levels(); FIRE.hardy = table0.hardy;
      }
    }
    // ---- hardy: to a round's and a blast's fixture rules a burning fire is no fixture (they stir it); its own box blown away still takes it; rule off, it goes like a bulb
    {
      const A = await rig(true, false), B = await rig(true, false), t = A.t, D: any = A.g.destr, hardy0 = FIRE.hardy;
      if (!t || !D || !B.t) verdict(false, 'hardy — the pass has a fire', 'none found');
      else try {
        FIRE.hardy = true; A.step(30); B.step(30);
        const log = A.W.audioLog as any[], n0 = log.length, fx0 = D.fixtureCount, by = [t.pos[0] + 1, 0.4, t.pos[2]];
        const fixture = D.fixtureLive(t), holds = fireHolds(t); D.bang(by, undefined, 1, false);
        fireStir(A.g, t); fireStir(A.g, t); fireStir(A.g, t); const queued = fireShown(A.g)?.stir?.length ?? 0, lit = !t.broken;
        const twin = { ...t, pos: [t.pos[0] + 3, t.pos[1], t.pos[2]] }; A.g.targets.push(twin); fireStir(A.g, twin); const both = fireShown(A.g)?.stir?.join() ?? ''; A.g.targets.pop(); { const st = fireShown(A.g)?.stir; if (st) st.length = queued; }   // (a second fire, stood in for the one call: each fire has its own gap)
        A.step(60);
        const burning = (A.g.engine.fires ?? []).length, stirred = log.slice(n0).filter(c => c.name === 'fireCrack' && c.opts?.rate === 0.7).length, counted = D.fixtureCount - fx0, left = fireShown(A.g)?.stir?.length ?? 0;
        // (a real round into the drum, by the newer lamp search and by the older one: each stirs it and neither puts it out)
        const shots = await (async () => {
          const { fireWeapon } = await import('../../src/game/combat.ts'); const { AIMCOST } = await import('../../src/game/aimcost.ts'); const g = A.g, c = g.player.char, lamp0 = AIMCOST.lamp;
          const bx = g.engine.world.statics[t.boxes[0]], at: [number, number, number] = [bx.c[0], bx.c[1] * 0.5, bx.c[2]]; let spot: number[] | null = null;   // (the middle of the drum, under the lid)
          for (let k = 0; k < 48 && !spot; k++) { const a = k / 48 * Math.PI * 2, q = [at[0] + Math.sin(a) * 3, 0, at[2] + Math.cos(a) * 3], e = [q[0], 1.35, q[2]], d = [at[0] - e[0], at[1] - e[1], at[2] - e[2]], n = Math.hypot(d[0], d[1], d[2]);
            const h = g.col.raycast(e, [d[0] / n, d[1] / n, d[2] / n], 60); if (!h || h.t < n - 0.45) continue;   // (clear to the drum: the fire's own box is its lid, the drum is the level's)
            g.teleportPlayer(q); A.step(4); g.player.aim?.clear?.(); if (Math.hypot(c.pos[0] - q[0], c.pos[2] - q[2]) < 0.1) spot = q; }
          if (!spot) return { spot: false, on: 0, off: 0, lit: !t.broken };
          const one = (rule: boolean) => { AIMCOST.lamp = rule; const m0 = log.length; for (let i = 0; i < 3; i++) { A.W.cursorAt(at); A.step(1); } fireWeapon(g, c, at, true, { spread: 0 }); A.step(30); return log.slice(m0).filter(x => x.name === 'fireCrack' && x.opts?.rate === 0.7).length; };
          try { const on = one(true), off = one(false); return { spot: true, on, off, lit: !t.broken && (g.engine.fires ?? []).length === 1 }; } finally { AIMCOST.lamp = lamp0; }
        })();
        B.g.destr.breakFixtureBox(B.t.boxes[0]); B.step(30); const boxGone = B.t.broken && (B.g.engine.fires ?? []).length === 0;
        FIRE.hardy = false; const fixture2 = D.fixtureLive(t), went2 = D.killFixture(t, by, 'blast', true); A.step(30); const out = t.broken && (A.g.engine.fires ?? []).length === 0;
        verdict(A.sw && fixture === false && holds && lit && burning === 1 && stirred === 2 && queued === 1 && both === '0,1' && left === 0 && counted === 0 && shots.spot && shots.on === 1 && shots.off === 1 && shots.lit && boxGone && fixture2 === true && went2 === true && out,
          'hardy — a burning fire is no fixture to a round or a blast: a bang beside it leaves it burning, three hits in a frame stir it once; its own box blown away takes it; with the rule off it goes out like a bulb',
          `the rule on: a fixture to the blast rule ${fixture ? 'YES' : 'no'}, ${lit ? 'burning' : 'OUT'} after a bang a metre off, ${burning} fire handed on a second later, ${stirred - 1} stirring crack for three hits (${queued} throw of embers queued, ${left} left a second later), a second fire hit in the same frame stirred too (queued for fires ${both}), ${counted} counted against the encounter's fixtures · a round into the drum from three metres${shots.spot ? '' : ' (NO clear spot)'}: ${shots.on} stir by the newer lamp search, ${shots.off} by the older, ${shots.lit ? 'still burning' : 'OUT'} · its own box broken: ${boxGone ? 'out' : 'STILL burning'} · the rule off: a fixture ${fixture2 ? 'yes' : 'NO'}, ${went2 ? 'put out' : 'LEFT'}, ${out ? 'nothing handed on' : 'STILL burning'}`);
      } finally { FIRE.hardy = hardy0; }
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
  } finally { putBack(); FIRE.on = was.on; if (was.env === undefined) delete process.env.TPS_FIRE; else process.env.TPS_FIRE = was.env; }
  console.log(`\nfire-check: ${checks - fails}/${checks} pass${BREAK ? ' (FIRE_BREAK=1: the switch never raised — this run must fail)' : ''}`);
  return fails === 0;
}

if (import.meta.main) { const ok = await fireCheck({ verbose: process.argv.includes('--verbose') }); process.exit(ok ? 0 : 1); }
