// CLOSE STILLS: the close-in mode's poses on the WORN MESH, both men, with no GPU — Sam coming up behind a standing man, stopped in reach of him (the tell),
// the grab, the hold, walking him back, the choke and the let-down. Each scene is staged in the real game stood up headless (the page's stand unless
// TPS_PROFILE says otherwise) and run through the game's own entry points; at each moment both men's meshes are skinned on the CPU (render/meshbvh.ts
// skinVertices, as pose-mesh.ts does one man) and written as ONE PLY in the frame of the man being taken as he stood when the scene began (his left, up, his
// forward). tools/qa/pose-mesh-raster.py draws a scene's PLYs as a contact sheet where there is no Blender (numpy + Pillow only).
//   bun run tools/qa/close-stills.ts [--out dir] [--scene a,b,…] [--tag name] [--list] [--set '<json>']      → dir/<scene>[-tag]__NN.ply + dir/<scene>[-tag].json
//       --set '{"CLOSE":{"stillFeet":false}}' = a table of close.ts / character.ts / stealthpose.ts written over after the stand-up (a before / after pair)
//   python3 -I tools/qa/pose-mesh-raster.py dir/<scene>.json [--tile 300]                                    → dir/<scene>.png
// What it cannot show: light, cloth, the camera's own framing. It is the mesh the page skins, at the poses the game reaches.
process.env.TPS_PROFILE ??= 'shipped';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const { standUp, ROOT } = await import('./headless.ts');
const { CLOSE } = await import(`${ROOT}/src/game/close.ts`);
const { startGrab } = await import(`${ROOT}/src/game/player.ts`);
const { skinVertices } = await import(`${ROOT}/src/render/meshbvh.ts`);
const CM: any = await import(`${ROOT}/src/render/charMaterials.ts`);

type P3 = number[];
const DT = 1 / 60, EAST = Math.PI / 2, LOBBY: P3 = [10.2, 0, 19.5];
const arg = (k: string) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : null; };
const log = console.log, warn = console.warn, err = console.error; const hush = () => { console.log = console.warn = console.error = () => {}; }, loud = () => { console.log = log; console.warn = warn; console.error = err; };
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const srgb = (l: number) => Math.round(255 * Math.min(1, Math.max(0, l <= 0.0031308 ? 12.92 * l : 1.055 * Math.pow(l, 1 / 2.4) - 0.055)));

const outDir = resolve(arg('--out') || './close-stills-out'), tag = arg('--tag');
async function applySet() {
  const raw = arg('--set'); if (!raw) return;
  const T: Record<string, any> = { ...(await import(`${ROOT}/src/game/close.ts`)), ...(await import(`${ROOT}/src/game/character.ts`)), ...(await import(`${ROOT}/src/game/stealthpose.ts`)), ...(await import(`${ROOT}/src/game/takedown.ts`)) };
  for (const [name, row] of Object.entries(JSON.parse(raw))) { if (!T[name] || typeof T[name] !== 'object') throw new Error(`--set: no table ${name}`); Object.assign(T[name], row); }
}

// ---------------------------------------------------------------- a moment: both men's worn meshes in the taken man's first frame
interface Shot { label: string; file: string; says: string }
function recorder(scene: string, g: any, A: any) {
  const o = [A.char.pos[0], 0, A.char.pos[2]], y = A.char.bodyYaw, f = [Math.sin(y), 0, Math.cos(y)], L = [f[2], 0, -f[0]];
  const rel = (x: number, yy: number, z: number): P3 => { const dx = x - o[0], dz = z - o[2]; return [dx * L[0] + dz * L[2], yy, dx * f[0] + dz * f[2]]; };
  const shots: Shot[] = [], stem = `${scene}${tag ? '-' + tag : ''}`;
  const man = (c: any, side: 'operator' | 'defender', tint: P3, tint2: P3, verts: number[], cols: number[], faces: number[]) => {
    const ch = c.ch, mesh = ch.mesh, I = mesh.indices, part = mesh.part as Uint8Array, mask = c.parts ?? ch.cast?.variants.find((x: any) => x.side === side)?.mask ?? 0xffffffff;
    const P = skinVertices(mesh.positions, mesh.joints, mesh.weights, c.skel.jointData), sd = CM.charSlots(ch), pal = new Float32Array(CM.CHAR_MAT_FLOATS); CM.writeCharPalette(pal, 0, side, tint, tint2, c.id ?? 1, !sd.authored);
    const worn = (v: number) => ((mask >>> part[v]) & 1) === 1, remap = new Int32Array(mesh.vertexCount).fill(-1);
    for (let t = 0; t < I.length; t += 3) { const tri = [I[t], I[t + 1], I[t + 2]]; if (!tri.every(worn)) continue;
      for (const v of tri) { if (remap[v] < 0) { remap[v] = verts.length / 3; verts.push(...rel(P[v * 3], P[v * 3 + 1], P[v * 3 + 2])); const s = Math.min(sd.slot[v], 10), p = 8 + s * 8; cols.push(srgb(pal[p]), srgb(pal[p + 1]), srgb(pal[p + 2]), side === 'operator' ? 0 : 1); } faces.push(remap[v]); } }
  };
  return { shots, stem, snap(label: string) {
    const pl = g.player.char, verts: number[] = [], cols: number[] = [], faces: number[] = [];
    man(pl, 'operator', [0.07, 0.09, 0.1], [0.05, 0.07, 0.06], verts, cols, faces); man(A.char, 'defender', [0.42, 0.36, 0.28], [0.3, 0.3, 0.26], verts, cols, faces);
    const nV = verts.length / 3, nF = faces.length / 3, file = `${stem}__${String(shots.length).padStart(2, '0')}.ply`;
    const head = `ply\nformat binary_little_endian 1.0\ncomment twopointsix close-stills ${stem} ${label}\nelement vertex ${nV}\nproperty float x\nproperty float y\nproperty float z\nproperty uchar red\nproperty uchar green\nproperty uchar blue\nproperty uchar slot\nelement face ${nF}\nproperty list uchar int vertex_indices\nend_header\n`;
    const hb = new TextEncoder().encode(head), buf = new ArrayBuffer(hb.length + nV * 16 + nF * 13), dv = new DataView(buf); new Uint8Array(buf).set(hb, 0); let k = hb.length;
    for (let i = 0; i < nV; i++) { dv.setFloat32(k, verts[i * 3], true); dv.setFloat32(k + 4, verts[i * 3 + 1], true); dv.setFloat32(k + 8, verts[i * 3 + 2], true); dv.setUint8(k + 12, cols[i * 4]); dv.setUint8(k + 13, cols[i * 4 + 1]); dv.setUint8(k + 14, cols[i * 4 + 2]); dv.setUint8(k + 15, cols[i * 4 + 3]); k += 16; }
    for (let i = 0; i < nF; i++) { dv.setUint8(k, 3); dv.setInt32(k + 1, faces[i * 3], true); dv.setInt32(k + 5, faces[i * 3 + 1], true); dv.setInt32(k + 9, faces[i * 3 + 2], true); k += 13; }
    writeFileSync(`${outDir}/${file}`, new Uint8Array(buf));
    const a = pl.anim, n = a.nodes, at = (c: any, node: string) => { const p = c.skel.nodePos(c.anim.nodes[node]), w = c.world, x = w[0] * p[0] + w[4] * p[1] + w[8] * p[2] + w[12], yy = w[1] * p[0] + w[5] * p[1] + w[9] * p[2] + w[13], z = w[2] * p[0] + w[6] * p[1] + w[10] * p[2] + w[14]; return rel(x, yy, z).map(q => +q.toFixed(2)); };
    const raw = (c: any, node: string): number[] => { const p = c.skel.nodePos(c.anim.nodes[node]), w = c.world; return [w[0] * p[0] + w[4] * p[1] + w[8] * p[2] + w[12], w[1] * p[0] + w[5] * p[1] + w[9] * p[2] + w[13], w[2] * p[0] + w[6] * p[1] + w[10] * p[2] + w[14]]; };
    void n; const d = Math.hypot(pl.pos[0] - A.char.pos[0], pl.pos[2] - A.char.pos[2]);
    const says = `gap ${d.toFixed(2)} m · crouch ${(a.crouch ?? 0).toFixed(2)} · creep ${(a.creepShown ?? 0).toFixed(2)} · ready ${a.ready ?? '—'} ${(a.readyShown ?? 0).toFixed(2)} · hands L ${at(pl, 'handL')} R ${at(pl, 'handR')} · knees L ${at(pl, 'shinL')} R ${at(pl, 'shinR')} · feet L ${at(pl, 'footL')} R ${at(pl, 'footR')} · his neck ${at(A.char, 'neck')} · his feet off the floor L ${raw(A.char, 'footL')[1].toFixed(3)} R ${raw(A.char, 'footR')[1].toFixed(3)} · wrist to his neck ${Math.hypot(...raw(pl, 'handL').map((q, i) => q - raw(A.char, 'neck')[i])).toFixed(3)} · his head ${at(A.char, 'head')} · Sam's head ${at(pl, 'head')} neck ${at(pl, 'neck')} · heads his ${raw(A.char, 'head')[1].toFixed(2)} Sam's ${raw(pl, 'head')[1].toFixed(2)}, ${Math.hypot(...raw(pl, 'head').map((q, i) => q - raw(A.char, 'head')[i])).toFixed(3)} apart`;
    shots.push({ label, file, says });
  } };
}

// ---------------------------------------------------------------- the stagings (takedown-strip.ts's lobby: the shift parked, one man stood on the open floor)
function place(gd: any, p: P3, yaw: number) { gd.char.pos = [...p]; gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.char.bodyYaw = gd.char.aimYaw = yaw; gd.char.aimPitch = 0; gd.path = []; gd.pathGoal = null; gd.char.update(0); gd.char.update(DT); }
async function lobby(seed: number) {
  Math.random = seeded(seed); hush(); const W: any = await standUp({ cast: true }); loud(); const g = W.game; CLOSE.on = true; await applySet();
  g.godMode = true; g.aiEnabled = false; g.player.visibility = 0.02; g.player.slot = 'pistol'; g.player.holstered = true;
  for (let i = 0; i < 5; i++) W.step(DT);
  const [A, ...rest] = g.guards; rest.forEach((gd: any, i: number) => { gd.hold = true; gd.pinned = true; place(gd, [37.5, 0, 6 + i * 1.5], EAST); gd.heardUpTo = 1e12; }); place(A, LOBBY, EAST); A.wp = 1; A.hold = true; A.pinned = true;
  W.cam.yaw = 0; W.cam.rebuild?.();
  const look = { ahead: false };   // (the cursor on the man — or, with him in the arm, a point ahead of Sam: the hold turns to the cursor)
  const aim = () => { const c = g.player.char; W.cursorAt(look.ahead ? [c.pos[0] + Math.sin(c.bodyYaw) * 6, 1.0, c.pos[2] + Math.cos(c.bodyYaw) * 6] : [A.char.pos[0], 1.2, A.char.pos[2]]); };
  const step = (n = 1) => { for (let i = 0; i < n; i++) { aim(); W.step(DT); g.player.visibility = 0.02; } };
  const samAt = (d: number, crouch: boolean) => { g.teleportPlayer([A.char.pos[0] - d, 0, A.char.pos[2]]); g.player.crouch = crouch; const pl = g.player.char; pl.bodyYaw = pl.aimYaw = EAST; step(30); };
  const gap = () => A.char.pos[0] - g.player.char.pos[0];
  return { W, g, A, step, samAt, gap, look };
}
/** coming up behind him from 3 m at the crouch (or on his feet), and stopping `stopAt` m short: moments on the way, the stop, and the two seconds after it */
async function approach(scene: string, crouch: boolean, stopAt: number) {
  const S = await lobby(7301), { W, g, A } = S; S.samAt(3.0, crouch); const R = recorder(scene, g, A);
  W.input.keys.add('KeyD'); let n = 0;
  for (const d of [2.4, 1.8, 1.4, 1.1]) { while (S.gap() > d && n++ < 900) S.step(1); if (d > stopAt) R.snap(`coming up · ${S.gap().toFixed(1)} m`); }
  while (S.gap() > stopAt && n++ < 900) S.step(1);
  W.input.keys.delete('KeyD'); R.snap(`stops · ${S.gap().toFixed(2)} m`);
  let f = 0; for (const t of [0.15, 0.4, 1.0, 2.0]) { const k = Math.round(t * 60); S.step(k - f); f = k; R.snap(`stopped ${t.toFixed(2)} s`); }
  return R;
}
/** the same stop taken at four points of his stride (the held gait keeps the legs where they were) */
async function stops(scene: string, crouch: boolean) {
  let R: any = null;
  for (const extra of [0, 7, 14, 21]) {
    const S = await lobby(7302), { W, g, A } = S; S.samAt(2.6, crouch); const r = recorder(scene, g, A); if (R) r.shots.push(...R.shots); R = r;
    W.input.keys.add('KeyD'); let n = 0; while (S.gap() > 1.25 && n++ < 900) S.step(1); S.step(extra); W.input.keys.delete('KeyD'); S.step(60);
    R.snap(`stopped +${extra} frames into the stride · ${S.gap().toFixed(2)} m, a second on`);
  }
  return R;
}
/** the grab from behind, the hold, walking him back, the choke and the let-down */
async function hold(scene: string) {
  const S = await lobby(7303), { W, g, A } = S; S.samAt(0.8, true); S.step(30); const R = recorder(scene, g, A);
  R.snap('behind him'); S.look.ahead = true; startGrab(g, A); let f = 0; const to = (t: number, label: string) => { const n = Math.round(t * 60); if (n > f) { S.step(n - f); f = n; } R.snap(label); };
  to(0.12, 'grab 0.12 s'); to(0.25, 'grab 0.25 s'); to(0.45, 'grab 0.45 s'); to(1.5, 'held');
  W.input.keys.add('KeyA'); to(1.8, 'back 0.3 s'); to(2.1, 'back 0.6 s'); to(2.4, 'back 0.9 s'); W.input.keys.delete('KeyA'); to(3.2, 'stopped');
  if (g.selectVerb('held', 'choke')) { W.input.pressed.add('Space'); const t0 = 3.2; to(t0 + 0.35, 'choke 0.35 s'); to(t0 + 1.2, 'choke 1.2 s'); to(t0 + 2.2, 'choke 2.2 s'); to(t0 + 2.95, 'choke 2.95 s'); to(t0 + 3.4, '+0.45 s'); to(t0 + 5.2, 'at rest'); }
  return R;
}
/** the choke alone, beat by beat: the arm closing, the haul up and back (TAKEDOWN.haul), set down, lowered */
async function choke(scene: string) {
  const S = await lobby(7303), { W, g, A } = S; S.samAt(0.8, true); S.step(30); const R = recorder(scene, g, A);
  S.look.ahead = true; startGrab(g, A); let f = 0; const to = (t: number, label: string) => { const n = Math.round(t * 60); if (n > f) { S.step(n - f); f = n; } R.snap(label); };
  to(1.5, 'held');
  if (g.selectVerb('held', 'choke')) { W.input.pressed.add('Space'); const t0 = 1.5 + 0.35; for (const t of [0.1, 0.2, 0.4, 0.65, 0.9, 1.2, 1.5, 2.3]) to(t0 + t, `choke ${t} s`); }
  return R;
}
const SCENES: Record<string, { title: string; run: (name: string) => Promise<any> }> = {
  'choke': { title: 'the choke from the hold, beat by beat', run: n => choke(n) },
  'approach-crouch': { title: 'coming up behind him at the crouch, stopping in reach', run: n => approach(n, true, 0.85) },
  'approach-stand': { title: 'coming up behind him on his feet, stopping in reach', run: n => approach(n, false, 0.85) },
  'stops-crouch': { title: 'stopped behind him at four points of the stride, crouched', run: n => stops(n, true) },
  'stops-stand': { title: 'stopped behind him at four points of the stride, on his feet', run: n => stops(n, false) },
  'hold': { title: 'the grab, the hold, walking him back, the choke', run: n => hold(n) },
};
if (process.argv.includes('--list')) { for (const [k, v] of Object.entries(SCENES)) console.log(`${k.padEnd(18)} ${v.title}`); process.exit(0); }
mkdirSync(outDir, { recursive: true });
const want = (arg('--scene') ?? Object.keys(SCENES).join(',')).split(',');
for (const name of want) {
  const sc = SCENES[name]; if (!sc) { console.error(`close-stills: no scene '${name}' (--list)`); process.exit(2); }
  const R = await sc.run(name);
  writeFileSync(`${outDir}/${R.stem}.json`, JSON.stringify({ scene: name, title: sc.title, tag: tag ?? '', set: arg('--set') ?? '', shots: R.shots }, null, 1));
  console.log(`${outDir}/${R.stem}.json · ${R.shots.length} moments`); for (const s of R.shots) console.log(`  ${s.label.padEnd(44)} ${s.says}`);
}
process.exit(0);
