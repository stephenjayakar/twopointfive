// 'wallbreak-looks' (the looks merged on the destruction build — wallwear.ts, edgeLook.ts, dustLook.ts), run through probes.ts in the 'wallbreak' family:
//   bun run tools/qa/probes.ts wallbreak-looks [--level block-squads]
// Headless = nothing is drawn; what is asserted is what a CHECKPOINT does with the marks laid only for the picture (lookDecals.ts):
//   (tagged)     a wall charge lays tagged soot marks; the digest's decal count leaves them out;
//   (carried)    a save carries each as `look: 1` and a load puts it back TAGGED — so the digest's count is the same carrying on, loaded into the same
//                game and loaded into a fresh one (before, a load brought the soot back untagged: +4 a blast against carrying on);
//   (old files)  a file without the field loads as it always did.
//   (full ring)  in a ring of 512 a mark laid only for the picture goes before any mark play laid and never pushes one out: the digest's count is
//                min(512, the marks play laid) with the soot and without it;
//   (dust twin)  the volumetric pass's dust twin still builds from volumetrics.wgsl's text (tools/qa/dust-look-check.ts's check, here so the gate runs it).
import { standUp, ROOT, fake } from './headless.ts';
import { readFileSync } from 'node:fs';
const { Particles } = await import(`${ROOT}/src/render/particles.ts`);
const { WALLS } = await import(`${ROOT}/src/game/wallbreak.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { digestGame } = await import(`${ROOT}/src/game/digest.ts`);
const { DESTRUCTION } = await import(`${ROOT}/src/game/destructionSwitch.ts`);
const { LOOK_DECALS } = await import(`${ROOT}/src/game/lookDecals.ts`);
const { PLAYER_ID } = await import(`${ROOT}/src/game/consts.ts`);
const { DECAL_CAP } = await import(`${ROOT}/src/render/decals.ts`);
const { dustLookVol } = await import(`${ROOT}/src/render/dustLookVol.ts`);

const DT = 1 / 60;
const LEVEL = (() => { const i = process.argv.indexOf('--level'); return i >= 0 ? process.argv[i + 1] : 'block-squads'; })();
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const DEFAULTS = JSON.parse(JSON.stringify(WALLS));

/** as wallbreak-probes.ts stage(): the harness Game on the loud level at chaos 0.5 with THE ONE SWITCH up, a Particles attached, everyone deaf and blind */
async function stage(seed: number) {
  Math.random = seeded(seed); for (const k of Object.keys(DEFAULTS)) (WALLS as any)[k] = JSON.parse(JSON.stringify(DEFAULTS[k])); DESTRUCTION.on = true;
  const W = await standUp({ level: loadLevel(parseLevelData(readFileSync(`${ROOT}/levels/${LEVEL}.json`, 'utf8'))) }); const { game, engine } = W;
  engine.particles = new Particles(fake('device'), fake('sceneLayout')); engine.settings.gpuParticles = true;
  game.godMode = true; game.aiEnabled = false; game.player.visibility = 0.02; game.tune.chaos = 0.5;
  for (let i = 0; i < 3; i++) W.step(DT);
  for (const gd of game.guards) { gd.hold = true; gd.pinned = true; gd.heardUpTo = 1e12; gd.flashlight.enabled = false; }
  return { W, game };
}
/** the middle of the longest partition, and the side to stand a charge on */
function pickWall(game: any): { mid: [number, number, number]; n: [number, number, number] } | null {
  let best: any = null, len = 0;
  for (const w of game.destr.walls.all()) { if (w.kind !== 'wall') continue; const b = w.box; const L = Math.max(b.h[0], b.h[2]); if (L > len) { len = L; best = b; } }
  if (!best) return null; const alongX = best.h[0] >= best.h[2];
  return { mid: [best.c[0], 0, best.c[2]], n: alongX ? [0, 0, 1] : [1, 0, 0] };
}
const counts = (g: any) => { const all = g.decals.list.length, look = g.decals.list.filter((d: any) => LOOK_DECALS.has(d)).length; return { all, look, digest: (digestGame(g, true) as any).decals as number }; };

export async function wallbreakLooks(): Promise<boolean> {
  console.log(`\n=== wallbreak-looks: marks laid only for the picture, through a checkpoint (${LEVEL}) ===`);
  let fails = 0; const verdict = (ok: boolean, what: string, detail: string) => { console.log(`  - ${ok ? 'PASS' : 'FAIL'} — ${what}: ${detail}`); if (!ok) fails++; };
  const { W, game } = await stage(31); const P = pickWall(game);
  if (!P) { verdict(false, 'a partition to blow', `none on ${LEVEL}`); return false; }
  const c0 = counts(game);
  game.destr.blast([P.mid[0] + P.n[0] * 0.3, 0.3, P.mid[2] + P.n[2] * 0.3], { who: PLAYER_ID });
  for (let f = 0; f < 60; f++) W.step(DT);
  const c1 = counts(game);
  verdict(c1.look > 0 && c1.digest === c1.all - c1.look, 'a wall charge lays tagged soot and the digest leaves it out', `ring ${c0.all} → ${c1.all}, ${c1.look} tagged, the digest counts ${c1.digest}`);
  const save = W.snapshot('looks', true); const json = JSON.stringify(save);
  const carried = (save.decals ?? []).filter((d: any) => d.look === 1).length;
  verdict(carried === c1.look, 'the save carries each tagged mark as look: 1', `${carried} of ${c1.look} in a ${json.length} B file`);
  Math.random = seeded(77); for (let f = 0; f < 120; f++) W.step(DT); const cA = counts(game);                                   // carrying on
  Math.random = seeded(55); W.restore(JSON.parse(json)); Math.random = seeded(77); for (let f = 0; f < 120; f++) W.step(DT); const cB = counts(game);   // loaded into the same game
  const S = await stage(32); Math.random = seeded(55); S.W.restore(JSON.parse(json)); Math.random = seeded(77); for (let f = 0; f < 120; f++) S.W.step(DT); const cC = counts(S.game);   // into a fresh one
  verdict(cB.look === c1.look && cC.look === c1.look, 'a load puts the soot back tagged', `tagged: carrying on ${cA.look}, same game ${cB.look}, fresh game ${cC.look}`);
  verdict(cA.digest === cB.digest && cA.digest === cC.digest, "the digest's decal count is the same carrying on and loaded", `carrying on ${cA.digest}, same game ${cB.digest}, fresh game ${cC.digest}`);
  const old = JSON.parse(json); for (const d of old.decals ?? []) delete d.look; S.W.restore(old); const cD = counts(S.game);
  verdict(cD.look === 0 && cD.all === (old.decals ?? []).length, 'a file without the field loads as it always did', `${cD.all} marks, ${cD.look} tagged`);
  // a full ring: play's marks are the last DECAL_CAP play laid, whatever the looks laid between them
  { const R = await stage(33); const g = R.game; const Q = pickWall(g)!; let laid = 0; const steps: string[] = []; let ok = true;
    const play = (n: number) => { for (let i = 0; i < n; i++) { g.decals.add('bullet', [Q.mid[0] + 2 + (laid % 40) * 0.05, 0, Q.mid[2] + 2 + Math.floor(laid / 40) * 0.05], [0, 1, 0]); laid++; } };
    const check = (what: string) => { const c = counts(g), want = Math.min(DECAL_CAP, laid); steps.push(`${what}: ${c.digest} of ${want} (${c.look} soot)`); if (c.digest !== want || c.all > DECAL_CAP) ok = false; return c; };
    play(DECAL_CAP - 2); check('ring two short of full');
    g.destr.blast([Q.mid[0] + Q.n[0] * 0.3, 0.3, Q.mid[2] + Q.n[2] * 0.3], { who: PLAYER_ID }); for (let f = 0; f < 30; f++) R.W.step(DT);
    const cb = check('after a wall charge'); play(1); check('one more round'); play(3); const cf = check('three more'); play(600); check('600 more');
    verdict(ok && cb.look > 0 && cf.look === 0, "a full ring: the soot never pushes out a mark play laid, and goes before one", steps.join(' · ')); }
  { const vol = readFileSync(`${ROOT}/src/render/shaders/volumetrics.wgsl`, 'utf8'); const twin = dustLookVol(vol);
    const ok = !!twin && twin.includes('dustDensity(X, onMask, true)') && twin.includes('smokeSelfShadowLook(') && !twin.includes('let dens = fogSmoke(smokeDensityIn(X, onMask), X);');
    verdict(ok, "the dust twin builds from volumetrics.wgsl's text", ok ? `${twin!.length} chars against ${vol.length} in the plain march` : 'the march has moved: re-point dustLookVol.ts SWAPS (dust is drawn as plain smoke until then)'); }
  console.log(fails ? `=== wallbreak-looks: ${fails} FAILED ===` : '=== wallbreak-looks: ALL PASS ===');
  return fails === 0;
}
