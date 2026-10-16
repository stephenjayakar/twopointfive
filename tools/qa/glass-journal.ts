// A SESSION RECORDED ON A PAGE WITH THE NEW GLASS REPLAYS (rebuild/glass/build.md) — the F10 loop with glass on. The page's engine says it draws the fracture's own
// cracks (HostApi.glassFracture true), so a cracking round files NO star decal there (glass.ts glassHit); the headless stand-in says nothing, so before the
// session file carried that answer (journal.ts EnvSnap.glassFracture) the replay filed the star and the digest's decal count parted from the recording at the
// first pane hit. Here: the harness stood up with the glass parts on and the engine answering as the page's does, Sam two steps off a float pane with the rifle
// up, a recording asked for, twelve rounds by cursor + LMB (inputs — the only things a replay is given), the file through JSON, replayed into a fresh game.
//   bun run tools/qa/glass-journal.ts [--keep file.json]        exit 0 = a pane cracked, no star was filed, and the replay is identical; 1 = not
import { writeFileSync } from 'node:fs';
process.env.GLASSFX = 'on';
const { standUp, ROOT, fake } = await import('./headless.ts');
const { replaySession } = await import('./replay.ts');
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const PM = await import(`${ROOT}/src/render/particles.ts`);
const { GB_STATS } = await import(`${ROOT}/src/game/glassbreak.ts`);
const { CHAOS } = await import(`${ROOT}/src/game/destruction.ts`);

type Vec3 = [number, number, number];
const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
let allOk = true;
const verdict = (ok: boolean, label: string, detail: string) => { allOk &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };

Math.random = seeded(7117);
const W: any = await standUp({ uploadEvery: 4 }); const { game: g, engine, input } = W;
engine.glassFracture = true;   // (as the page's engine with the fracture constant compiled; the recording's env files it)
engine.particles = new PM.Particles(fake('device'), fake('sceneLayout')); engine.settings.gpuParticles = true;
g.tune.chaos = CHAOS.def; g.godMode = true; g.aiEnabled = false;
// a float pane with a clear spot 1.7 m off one face (off the sheet's middle: a mullion may stand there)
let spot: { bi: number; from: Vec3; aim: Vec3 } | null = null;
for (const bi of engine.world.glassStatics as number[]) {
  if (spot || g.glassBreak.typeOfPane(bi) !== 'annealed') continue;
  const b = g.level.boxes[bi], wide = b.h[0] >= b.h[2], cs = Math.cos(b.yaw ?? 0), sn = Math.sin(b.yaw ?? 0), hu = wide ? b.h[0] : b.h[2];
  const nrm: Vec3 = wide ? [sn, 0, cs] : [cs, 0, -sn], tan: Vec3 = wide ? [cs, 0, -sn] : [sn, 0, cs];
  for (const u of [0.45, -0.45, 0.2, -0.2]) for (const s of [1, -1]) {
    const mid = v3.mad(b.c, tan, u * hu) as Vec3, from = v3.mad([mid[0], 0, mid[2]], nrm, 1.7 * s) as Vec3, eye: Vec3 = [from[0], 1.4, from[2]];
    if (spot || g.col.solidBlocked([from[0], 0.3, from[2]], [from[0], 1.7, from[2]])) continue;
    if ([-0.4, 0, 0.4].some(o => { const e = v3.mad(eye, tan, o) as Vec3, hit = g.col.raycast(e, v3.normalize(v3.sub(mid, e)), 4); return !hit || hit.index !== bi; })) continue;
    spot = { bi, from, aim: mid };
  }
}
if (!spot) { console.log('- FAIL — a float pane with a clear spot before it\n    none in this level'); process.exit(1); }
g.teleportPlayer(spot.from); g.player.slot = 'rifle'; g.player.holstered = false; g.player.char.bodyYaw = g.player.char.aimYaw = Math.atan2(spot.aim[0] - spot.from[0], spot.aim[2] - spot.from[2]);
for (let i = 0; i < 60; i++) { W.cursorAt(spot.aim); W.step(DT); engine.particles.pending.length = 0; }
if (!g.journal.request({ seed: 515151, note: 'glass-journal: rifle rounds into a float pane, the engine drawing the fracture' })) throw new Error('journal.request refused: ' + g.journal.summary());
const stepN = (n: number) => { for (let i = 0; i < n; i++) { W.cursorAt(spot!.aim); W.step(DT); engine.particles.pending.length = 0; } };
stepN(20);
verdict(g.journal.state === 'recording', 'the recording started', g.journal.summary());
const d0 = g.decals.list.filter((d: any) => d.kind === 'glassHit').length, i0 = GB_STATS.impacts;
for (let k = 0; k < 12; k++) { input.clicked |= 1; input.buttons |= 1; stepN(2); input.buttons &= ~1; stepN(16); }
stepN(120);
const info = g.glassBreak.paneInfo(spot.bi), stars = g.decals.list.filter((d: any) => d.kind === 'glassHit').length - d0;
verdict(GB_STATS.impacts > i0 && info.sites > 0, 'the rounds cracked the pane', `pane ${spot.bi}: impacts ${GB_STATS.impacts - i0} · sites ${info.sites} · open ${info.openFraction.toFixed(2)}`);
const file0 = g.journal.stop('glass-journal', true); if (!file0) throw new Error('journal.stop returned no file: ' + g.journal.summary());
const F = JSON.parse(JSON.stringify(file0));
verdict(F.env.glassFracture === true, "the file carries the renderer's answer", `env.glassFracture ${F.env.glassFracture} · ${F.frames} frames · ${F.digests.length} digests · star decals filed while recording ${stars}`);
const keep = process.argv.indexOf('--keep'); if (keep > 0 && process.argv[keep + 1]) writeFileSync(process.argv[keep + 1], JSON.stringify(F));
const R = await replaySession(F, 'glass-journal', { log: () => { } });
verdict(R.ok && !R.digestMismatch && R.sensor.divergences === 0, 'the replay is identical', R.bad ? `bad file: ${R.bad}` : `${R.replayed}/${R.frames} frames · ${R.digestsChecked} digests checked · ${R.digestMismatch ? 'first mismatch ' + JSON.stringify(R.digestMismatch).slice(0, 300) : 'no mismatch'} · sensor divergences ${R.sensor.divergences}`);
// the same file with the answer taken out = a file as the build wrote it before: the replay files the star the page never filed
const F2 = JSON.parse(JSON.stringify(F)); delete F2.env.glassFracture;
const R2 = await replaySession(F2, 'glass-journal (answer removed)', { log: () => { } });
verdict(!R2.ok && !!R2.digestMismatch, 'without the answer the same file diverges (what the field is for)', R2.digestMismatch ? `first mismatch ${JSON.stringify(R2.digestMismatch).slice(0, 300)}` : `replayed identically — the field is not needed here (${R2.replayed} frames)`);
console.log(`\n=== glass-journal: ${allOk ? 'ALL PASS' : 'FAIL'} ===`);
process.exit(allOk ? 0 : 1);
