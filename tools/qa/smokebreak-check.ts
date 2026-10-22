// A MAN A LEVEL'S SCRIPT TOLD TO HAVE A SMOKE LIGHTS ONE (src/game/smokebreak.ts SMOKEBREAK / updateSmokeBreak; the arm is character.ts smokeLayer; the
// order is director.ts OrderPatch.smoke → GuardScript.smoke; the first such man is the ledger's night man, levels/tut-quiet.script.ts).
//
// The maintainer, 10-22: "maybe we should make him stop a bit further away and then turn around for a cigarette break", "cigarette break animation (with
// real smoke!) would be sick".
//
//   bun run tools/qa/smokebreak-check.ts [--verbose]      exit 0 = all pass, 1 = a FAIL line
//   SMOKEBREAK_BREAK=1 …   = the switch never raised and the same lines asked: must fail
//   bun run tools/qa/probes.ts smokebreak
//   Run it on BOTH stands (TPS_PROFILE=shipped in front for the page's): it puts the switch where each line needs it by the stand's own word, TPS_SMOKEBREAK.
//
// The harness has no GPU and no smoke solver: what is proven HERE is what the game files (the lights, the sources it would hand the solver, the puffs) and
// where the animator puts the hand — never a smoke seen.
//   lights    the ledger's court man told to smoke where he stands, switch on, twenty seconds: he lights it once (one flame, at his mouth), the end glows
//             from then on and brighter at a draw, he draws and breathes out
//   hand      … and his LEFT hand goes up to his mouth and comes down again; his right, the torch's, stays where it was carried
//   smoke     with a solver drawing: a thread off the end that rides his hand and what he breathes out, off his mouth — every source LOOK ONLY (the game's own
//             smoke, the one sight lines are cut by, is never told), on the fine lattice, none thicker than the table says
//   puffs     with none: what he breathes out is filed as dust puffs with a steam share, and no thread
//   who       not before he has got where he was sent; not once his script lets him go (the hand is given back at once); not a dead man
//   off       switch off, the same order: no light, no source, no puff, the hand never asked — and the game's digest is the one of a man never told to smoke
//   old       a recording from before the key replays with it off (journal.ts applyKnobs)
import { standUp, ROOT } from './headless.ts';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DT = 1 / 60;

export async function smokeBreakCheck(o: { verbose?: boolean } = {}): Promise<boolean> {
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { SMOKEBREAK, smokeBreakStats, smoking, updateSmokeBreak } = await import(`${ROOT}/src/game/smokebreak.ts`);
  const { order, endGuardScript } = await import(`${ROOT}/src/game/squad.ts`);
  const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
  const J = await import(`${ROOT}/src/game/journal.ts`);
  const BREAK = process.env.SMOKEBREAK_BREAK === '1';
  const quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { if (o.verbose) return await fn(); const l = console.log, e = console.error, w = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = l; console.error = e; console.warn = w; } };
  let fails = 0, checks = 0;
  const verdict = (ok: boolean, label: string, detail: string) => { checks++; if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  const was = { on: SMOKEBREAK.on, env: process.env.TPS_SMOKEBREAK };
  const flat = (a: ArrayLike<number>, b: ArrayLike<number>) => Math.hypot(a[0] - b[0], a[2] - b[2]);

  /** the ledger stood up, the switch where `on` says (by the stand's own word), the court's man found; `solver` = a smoke solver that says it draws, its
   *  sources kept; the particle pool's records kept either way */
  async function rig(on: boolean, solver: boolean) {
    const sw = on && !BREAK;
    process.env.TPS_SMOKEBREAK = sw ? '1' : '0'; SMOKEBREAK.on = !sw;   // (the module's switch left the WRONG way round: only the stand's word can put it right)
    const lvl = loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', 'tut-quiet.json'), 'utf8')));
    const W: any = await quiet(() => standUp({ level: lvl, seed: 7 }));
    const g = W.game; const stood = SMOKEBREAK.on; SMOKEBREAK.on = sw;
    g.aiEnabled = false;   // (nobody's eyes or ears are this file's question: the men stand)
    const gd = g.guards.find((x: any) => x.route?.name === 'court') ?? g.guards[1];
    const sources: any[] = [], puffs: any[] = [];
    const emit0 = g.smoke.emit?.bind(g.smoke); g.smoke.emit = (e: any) => { sources.push(e); emit0?.(e); };
    if (solver) g.smoke.drawing = () => true;
    const fx = { emit: (kind: string, pos: number[], dir: number[], n: number, opts: any) => { puffs.push({ kind, pos: [...pos], n, opts }); return n; } };
    const step = (n = 1, each?: () => void) => { for (let i = 0; i < n; i++) { SMOKEBREAK.on = sw; W.step(DT); each?.(); } };
    const flashes = () => g.engine.lights.lights.filter((l: any) => l.group === 'transient' && l.owner === gd.char.id);
    return { W, g, gd, step, stood, sw, sources, puffs, flashes, fx };
  }

  try {
    // ---- lights, hand
    {
      const A = await rig(true, false), c = A.gd.char;
      order(A.gd, { goal: null, upper: 'torch', light: true }); A.step(90);   // (the torch carried as the script will have it carried, before he is told)
      const rest = { l: c.bones.handL ? [...c.bones.handL] : null, r: c.bones.handR ? [...c.bones.handR] : null };
      order(A.gd, { smoke: true });
      let up = 9, down = 0, rMove = 0, flameAt: number[] | null = null, mouth: number[] | null = null, maxK = 0, minK = 9, asked = new Set<number>(), lit = 0;
      A.step(20 * 60, () => { const h = c.bones.handL, hd = c.bones.head; if (!h || !hd) return;
        const d = Math.hypot(h[0] - hd[0], h[1] - hd[1], h[2] - hd[2]); up = Math.min(up, d); down = Math.max(down, d);
        if (rest.r && c.bones.handR) rMove = Math.max(rMove, Math.hypot(c.bones.handR[0] - rest.r[0], c.bones.handR[1] - rest.r[1], c.bones.handR[2] - rest.r[2]));
        if (c.anim.smoke !== null) asked.add(c.anim.smoke);
        for (const l of A.flashes()) { if (l.range > 2 && !flameAt) { flameAt = [...l.pos]; mouth = [...hd]; } if (l.range <= 2) { maxK = Math.max(maxK, l.peakIntensity); minK = Math.min(minK, l.peakIntensity); lit++; } } });
      const T = smokeBreakStats(A.g);
      verdict(A.stood === A.sw && T.lit === 1 && T.flames === 1 && T.draws >= 1 && T.breaths >= 2 && T.embers > 20 && !!flameAt && !!mouth && Math.hypot(flameAt![0] - mouth![0], flameAt![1] - mouth![1], flameAt![2] - mouth![2]) < 0.3 && maxK > minK,
        'lights — told to smoke, he lights it once at his mouth, the end glows and is brighter at a draw, he draws and breathes out',
        `the stand stood the switch ${A.stood ? 'on' : 'off'} · ${T.lit} lit, ${T.flames} flame${flameAt && mouth ? ` ${Math.hypot(flameAt[0] - mouth[0], flameAt[1] - mouth[1], flameAt[2] - mouth[2]).toFixed(2)} m from his head joint` : ' (none seen)'}, ${T.embers} glows of the end (${minK === 9 ? '-' : minK} to ${maxK}), ${T.draws} draws, ${T.breaths} breathed out in twenty seconds`);
      verdict(up < 0.26 && down > 0.5 && rMove < 0.12 && asked.has(1) && asked.has(0),
        'hand — his left hand goes up to his mouth and comes down again, and the torch\'s hand stays where it was',
        `the left wrist from ${down.toFixed(2)} m off his head joint to ${up.toFixed(2)} m · the right moved ${rMove.toFixed(2)} m · the animator was asked ${[...asked].sort().join(' and ')}`);
      // who: let go
      endGuardScript(A.gd, 'patrol'); A.step(1); const asked1 = c.anim.smoke, on1 = smoking(A.gd); const n1 = T.embers; A.step(90);
      const hd = c.bones.head, h = c.bones.handL, back = h && hd ? Math.hypot(h[0] - hd[0], h[1] - hd[1], h[2] - hd[2]) : 0;
      // who: on his way
      const B = await rig(true, false); B.step(10); const p = B.gd.char.pos; order(B.gd, { goal: [p[0] + 2.5, 0, p[2] - 0.4], upper: 'torch', smoke: true });
      let early = 0; B.step(45, () => { if (B.gd.char.anim.smoke !== null) early++; }); const far = flat(B.gd.char.pos, B.gd.script.goal);
      const litWalking = smokeBreakStats(B.g).lit; B.step(9 * 60); const litThere = smokeBreakStats(B.g).lit, there = !!B.gd.script.arrived;
      // who: dead
      B.gd.state = 'dead'; B.gd.char.alive = false; B.step(2); const deadAsk = B.gd.char.anim.smoke;
      verdict(asked1 === null && !on1 && T.embers === n1 && back > 0.45 && early === 0 && litWalking === 0 && (!there || litThere === 1) && deadAsk === null,
        'who — not on his way there, not once his script lets him go, not a dead man',
        `let go: the hand asked ${asked1 === null ? 'nothing' : asked1} the frame after, no glow filed since, the wrist back ${back.toFixed(2)} m off his head in a second and a half · walking (${far.toFixed(1)} m to go after 45 frames): asked ${early} frames, ${litWalking} lit; ${there ? `there, ${litThere} lit` : 'he never got there (not judged)'} · dead: asked ${deadAsk === null ? 'nothing' : deadAsk}`);
    }
    // ---- smoke through a solver
    {
      const A = await rig(true, true); A.step(10); order(A.gd, { goal: null, upper: 'torch', smoke: true }); A.step(20 * 60);
      const K = SMOKEBREAK, S = A.sources.filter(e => e.kind === 'breath' && e.tint);
      const threads = S.filter(e => e.ttl > 60), outs = S.filter(e => e.ttl <= 60);
      const c = A.gd.char, t0 = threads[0]?.track?.(), hand = c.bones.handL, o0 = outs[outs.length - 1], head = c.bones.head;
      const ok = threads.length === 1 && outs.length >= 2 && S.every(e => e.look === true && e.lattice === 'fine' && e.confined === true) && threads.every(e => e.density <= K.thread.density) && outs.every(e => e.density <= K.breath.density)
        && !!t0 && !!hand && Math.hypot(t0.pos[0] - hand[0], t0.pos[1] - hand[1], t0.pos[2] - hand[2]) < 0.2 && !!o0 && !!head && Math.hypot(o0.pos[0] - head[0], o0.pos[1] - head[1], o0.pos[2] - head[2]) < 0.25 && A.puffs.length === 0;
      verdict(ok, 'smoke — with a solver drawing: one thread that rides his hand and a breath of smoke after each draw, every source look-only',
        `${threads.length} thread${t0 && hand ? ` (${Math.hypot(t0.pos[0] - hand[0], t0.pos[1] - hand[1], t0.pos[2] - hand[2]).toFixed(2)} m off his left wrist now)` : ''}, ${outs.length} breathed out${o0 && head ? ` (the last ${Math.hypot(o0.pos[0] - head[0], o0.pos[1] - head[1], o0.pos[2] - head[2]).toFixed(2)} m off his head joint)` : ''} · look-only, fine lattice, confined: ${S.every(e => e.look === true && e.lattice === 'fine' && e.confined === true)} · thickest ${Math.max(0, ...S.map(e => e.density))} · ${A.puffs.length} puff records`);
      endGuardScript(A.gd, 'patrol'); A.step(2);
      verdict(threads.length === 1 && threads[0].track() === null, 'smoke — … and the thread is dropped the frame his script lets him go', `its track says ${threads.length === 1 && threads[0].track() === null ? 'gone' : 'still there'}`);
    }
    // ---- puffs with none
    {
      // (the harness's engine has no particle pool: one that keeps what is filed is put on it for this file's own call alone, a second turn of his clock a frame)
      const A = await rig(true, false), e = A.g.engine as any; A.step(10); order(A.gd, { goal: null, upper: 'torch', smoke: true });
      A.step(12 * 60, () => { const had = { p: e.particles, gp: e.settings.gpuParticles }; e.particles = A.fx; e.settings.gpuParticles = true; try { updateSmokeBreak(A.g, DT); } finally { e.particles = had.p; e.settings.gpuParticles = had.gp; } });
      const mine = A.puffs.filter(r => r.kind === 'dust' && r.opts?.steam !== undefined), S = A.sources.filter(e => e.tint);
      const pool = true;
      verdict(S.length === 0 && (!pool || mine.length >= 2), 'puffs — with no solver drawing: what he breathes out is dust puffs with a steam share, and no thread',
        `${S.length} sources handed to a solver · ${pool ? `${mine.length} puff records (steam ${mine[0]?.opts?.steam ?? '-'}, owner ${mine[0]?.opts?.owner ?? '-'})` : `no particle pool on this stand: ${smokeBreakStats(A.g).breaths} breaths counted, nothing to file into`}`);
    }
    // ---- off
    {
      const A = await rig(false, true); A.step(10); order(A.gd, { goal: null, upper: 'torch', smoke: true });
      let asked = 0, fl = 0; A.step(12 * 60, () => { if (A.gd.char.anim.smoke !== null) asked++; fl += A.flashes().length; });
      const B = await rig(false, true); B.step(10); order(B.gd, { goal: null, upper: 'torch' }); B.step(12 * 60);
      const hA = hashDigest(digestGame(A.g)), hB = hashDigest(digestGame(B.g));
      verdict(!A.sw && A.stood === false && asked === 0 && fl === 0 && A.sources.filter(e => e.tint).length === 0 && hA === hB,
        'off — the same order with the switch off: no light, no source, the hand never asked, and the digest of a man never told to smoke',
        `the stand stood the switch ${A.stood ? 'on' : 'off'} · asked ${asked} frames, ${fl} lights, ${A.sources.filter(e => e.tint).length} sources · digest ${hA} against ${hB}`);
    }
    // ---- old
    {
      const A = await rig(true, false);
      SMOKEBREAK.on = true; const k = (J as any).knobsSnapshot(A.g); (J as any).applyKnobs(A.g, k); const kept = SMOKEBREAK.on;
      SMOKEBREAK.on = true; const k2 = (J as any).knobsSnapshot(A.g); delete k2.tables.SMOKEBREAK; (J as any).applyKnobs(A.g, k2); const none = SMOKEBREAK.on;
      verdict(kept === true && none === false, 'old — a recording from before the key replays with it off', `its own snapshot put back: ${kept ? 'on' : 'off'} · one without the table: ${none ? 'on' : 'off'}`);
    }
  } finally { SMOKEBREAK.on = was.on; if (was.env === undefined) delete process.env.TPS_SMOKEBREAK; else process.env.TPS_SMOKEBREAK = was.env; }
  console.log(`\nsmokebreak-check: ${checks - fails}/${checks} pass${BREAK ? ' (SMOKEBREAK_BREAK=1: the switch never raised — this run must fail)' : ''}`);
  return fails === 0;
}

if (import.meta.main) { const ok = await smokeBreakCheck({ verbose: process.argv.includes('--verbose') }); process.exit(ok ? 0 : 1); }
