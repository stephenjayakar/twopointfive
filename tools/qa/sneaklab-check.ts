// 'sneaklab' — THE SNEAK LAB'S FLOOR (levels/sneak-lab.json from tools/levels/sneak-lab.ts; the page's lab is src/host/sneaklab.ts). The lab is where the close-in
// on a man is played and tuned, so the floor has to do what its header says on the build as it is:
//   file      levels/sneak-lab.json is what its generator gives now (tools/levels/export.ts sneak-lab --check).
//   men       stood up on it: six living men, one a route, Sam's start on free floor; over forty seconds of the real guards (nobody able to notice him) five of
//             the six have walked more than three metres from where they began and the one who stands has stayed within two.
//   creep     with the stalk up (as the page has it), empty hands, Sam put three metres behind the man who stands and the left button held on him with the
//             real guards running: he is in Sam's arm inside six seconds.
//   words     the lab's panel names every number of the stalk's table (a key added to STALK without a slider in the lab fails here).
// SNEAKLAB_BREAK=1 = the stalk left down for `creep`, and the routes emptied for `men`: both must FAIL.   exit 0 = all hold · 1 = one does not
// THE HARNESS HAS NO GPU: nothing here says how the floor is lit or how the lab's panel looks. tools/qa/stalk-page.cjs drives the real page.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { standUp, ROOT } from './headless.ts';

const { STALK, stalkPolish } = await import(`${ROOT}/src/game/stalk.ts`);
const { CLOSE } = await import(`${ROOT}/src/game/close.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { SCENES, SNEAKLAB, stage } = await import(`${ROOT}/src/host/sneaklab.ts`);

const BREAK = process.env.SNEAKLAB_BREAK === '1', DT = 1 / 60;
let allPass = true;
const verdict = (ok: boolean, label: string, detail: string) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
async function quiet<T>(fn: () => Promise<T>): Promise<T> { const log = console.log; console.log = () => {}; try { return await fn(); } finally { console.log = log; } }
const level = () => { const L = loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', 'sneak-lab.json'), 'utf8'))); if (BREAK) L.routes = []; return L; };
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);

export async function sneaklabCheck(): Promise<boolean> {
  allPass = true;
  console.log('\n=== file: the level file is its generator\'s ===');
  { const r = Bun.spawnSync(['bun', 'run', `${ROOT}/tools/levels/export.ts`, 'sneak-lab', '--check'], { cwd: ROOT, stdout: 'pipe', stderr: 'pipe' });
    verdict(r.exitCode === 0, 'levels/sneak-lab.json is what tools/levels/sneak-lab.ts gives now', `export --check exit ${r.exitCode}`); }

  console.log('\n=== men: eleven men on eleven beats, ten of them walking ===');
  { const W: any = await quiet(() => standUp({ level: level(), seed: 7 } as any)), g = W.game; g.godMode = true; g.playerInvisible = true;
    const men = g.guards.filter((x: any) => x.state !== 'dead' && !x.civ), at0 = men.map((x: any) => [...x.char.pos]), far = men.map(() => 0);
    const spawnFree = !g.col.nav.isBlocked(g.player.char.pos[0], g.player.char.pos[2]);
    for (let f = 0; f < 40 * 60; f++) { W.step(DT); men.forEach((x: any, i: number) => { far[i] = Math.max(far[i], flat(x.char.pos, at0[i])); }); }
    const walkers = far.filter((d: number) => d > 3).length, calm = men.every((x: any) => x.state === 'patrol');
    verdict(men.length === 11 && spawnFree && walkers === 10 && far[0] < 2 && calm, 'eleven living men, Sam\'s start on free floor, and over forty seconds ten have walked more than three metres while the first stands within two, all of them calm',
      `men ${men.length} · start free ${spawnFree} · furthest each got from where he began: ${far.map((d: number) => d.toFixed(1)).join(' · ')} m · all calm ${calm}`); }

  console.log('\n=== creep: the held click takes the man who stands, with the real guards running ===');
  { const W: any = await quiet(() => standUp({ level: level(), seed: 7 } as any)), g = W.game; CLOSE.on = true; STALK.on = !BREAK; stalkPolish(true); g.godMode = true; g.playerInvisible = true;   // (the stalk as the page has it: the frozen stand's pin puts its polish down at every stand-up)
    g.player.slot = 'pistol'; g.player.holstered = true; g.player.crouch = true;
    for (let f = 0; f < 120; f++) W.step(DT);   // (he has walked onto his mark and stands)
    const A = g.guards[0], yaw = A.char.bodyYaw; g.teleportPlayer([A.char.pos[0] - Math.sin(yaw) * 2.6, 0, A.char.pos[2] - Math.cos(yaw) * 2.6]); g.player.crouch = true;
    let t = Infinity; W.input.buttons |= 1; W.input.clicked |= 1;
    let keyed = false;   // (stalk.ts `key`: the held click brings him into reach and the row's key is the grab — pressed here the frame the row is offered)
    for (let f = 0; f < 8 * 60; f++) { W.cursorAt([A.char.pos[0], 1.2, A.char.pos[2]]); W.input.buttons |= 1;
      if (STALK.key && !keyed && Math.hypot(g.player.char.vel[0], g.player.char.vel[2]) < 0.02 && g.nearby.some((r: any) => r.kind === 'guard' && r.verb === 'grab' && r.guard === A) && g.selectVerb('guard', 'grab')) { W.input.pressed.add('Space'); keyed = true; }
      W.step(DT); if (g.player.holding?.g === A) { t = (f + 1) * DT; break; } }
    verdict(t < 8 && keyed === STALK.key, 'empty hands, 2.6 m behind the man who stands, the left button held on him (and, with the key the finish, the row\'s key once he has stopped in reach): he is in Sam\'s arm inside eight seconds', isFinite(t) ? `in his arm in ${t.toFixed(2)} s${keyed ? ', by the key' : ''}` : `never grabbed (Sam ${flat(g.player.char.pos, A.char.pos).toFixed(2)} m from him, his state ${A.state})`); }

  console.log('\n=== scenarios: the five he named, each from its own start ===');
  { const open = async (i: number, seen = SCENES[i].seen) => { const W: any = await quiet(() => standUp({ level: level(), seed: 7 } as any)), g = W.game; CLOSE.on = true; STALK.on = STALK.key = STALK.low = !BREAK; stalkPolish(true); g.godMode = true; SNEAKLAB.scene = i; stage(g); g.playerInvisible = !seen; return { W, g, S: SCENES[i] }; };
    const man = (g: any, name: string) => g.guards.find((x: any) => g.level.routes[x.routeI]?.name === name), gap = (g: any, a: any) => flat(g.player.char.pos, a.char.pos);
    { const { W, g } = await open(0), A = man(g, 'stander'); for (let f = 0; f < 150; f++) W.step(DT); const dx = g.player.char.pos[0] - (A?.char.pos[0] ?? 0), dz = g.player.char.pos[2] - (A?.char.pos[2] ?? 0), L = Math.hypot(dx, dz) || 1, back = A ? -(dx * Math.sin(A.char.bodyYaw) + dz * Math.cos(A.char.bodyYaw)) / L : 0;
      verdict(!!A && back > 0.85 && L > 3.2 && L < 5, 'man standing: Sam starts three to five metres behind him, square on his back', `${L.toFixed(1)} m off · ${back.toFixed(2)} of the way square behind him`); }
    { const { W, g } = await open(1), A = man(g, 'beat'); let near = 99; W.input.buttons |= 1; W.input.clicked |= 1; for (let f = 0; f < 30 * 60 && A; f++) { W.cursorAt([A.char.pos[0], 1.2, A.char.pos[2]]); W.input.buttons |= 1; W.step(DT); W.input.clicked &= ~1; near = Math.min(near, gap(g, A)); }
      verdict(near < 1.3, 'man walking: the held click closes on him as he walks, in reach inside thirty seconds', `nearest ${near.toFixed(2)} m`); }
    for (const i of [2, 3]) { const { W, g, S } = await open(i), free = !g.col.nav.isBlocked(S.sam[0], S.sam[2]) && !g.col.nav.isBlocked(S.end![0], S.end![2]), way = g.col.nav.path?.(S.sam, S.end!) ?? g.col.nav.findPath?.(S.sam, S.end!); let calm = true; for (let f = 0; f < 12 * 60; f++) { W.step(DT); calm &&= g.guards.every((x: any) => x.state === 'patrol'); }
      verdict(free && !!way?.length && calm && SNEAKLAB.unseen === false, `${S.name}: a way on free floor from the start to the far end, the men can see him, and waiting twelve seconds at the start nobody does`, `free ${free} · way ${way?.length ?? 0} points · calm ${calm} · unseen ${SNEAKLAB.unseen}`); }
    { const { W, g } = await open(4), A = man(g, 'corner'); let near = 99; for (let f = 0; f < 30 * 60 && A; f++) { W.step(DT); near = Math.min(near, gap(g, A)); }
      verdict(near < 1.6, 'corner: his man comes past inside thirty seconds, in reach of the corner', `nearest ${near.toFixed(2)} m`); }
    SNEAKLAB.scene = 0; }

  console.log('\n=== words: the lab names every number of the stalk ===');
  { const src = readFileSync(resolve(ROOT, 'src/host/sneaklab.ts'), 'utf8'), keys = Object.keys(STALK).filter(k => typeof (STALK as any)[k] === 'number');
    const missing = keys.filter(k => !new RegExp(`key: '${k}'`).test(src));
    verdict(missing.length === 0 && keys.length >= 8, 'every number in the stalk\'s table has its row in the lab\'s panel', `${keys.length} numbers · missing: ${missing.join(', ') || 'none'}`); }

  console.log(`\n=== sneaklab: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}
if (import.meta.main) process.exit((await sneaklabCheck()) ? 0 : 1);
