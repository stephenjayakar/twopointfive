// CLOSE STILLS: the close-in mode's poses on the WORN MESH, both men, with no GPU — Sam coming up behind a standing man, stopped in reach of him (the tell),
// the grab, the hold, walking him back, the choke and the let-down. Each scene is staged in the real game stood up headless (the page's stand unless
// TPS_PROFILE says otherwise) and run through the game's own entry points; at each moment both men's meshes are skinned on the CPU (render/meshbvh.ts
// skinVertices, as pose-mesh.ts does one man) and written as ONE PLY in the frame of the man being taken as he stood when the scene began (his left, up, his
// forward). tools/qa/pose-mesh-raster.py draws a scene's PLYs as a contact sheet where there is no Blender (numpy + Pillow only).
//   bun run tools/qa/close-stills.ts [--out dir] [--scene a,b,…] [--tag name] [--list] [--set '<json>']      → dir/<scene>[-tag]__NN.ply + dir/<scene>[-tag].json
//       --set '{"CLOSE":{"stillFeet":false}}' = a table of close.ts / character.ts / stealthpose.ts written over after the stand-up (a before / after pair)
//   python3 -I tools/qa/pose-mesh-raster.py dir/<scene>.json [--tile 300]                                    → dir/<scene>.png
//   python3 -I tools/qa/pose-clip.py dir/stalk-clip.json --out clip.mp4                                      → the scene as it moves
// What it cannot show: light, cloth, the camera's own framing. It is the mesh the page skins, at the poses the game reaches.
process.env.TPS_PROFILE ??= 'shipped';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const { standUp, ROOT } = await import('./headless.ts');
const { CLOSE } = await import(`${ROOT}/src/game/close.ts`);
const { STALK } = await import(`${ROOT}/src/game/stalk.ts`);
const { TAPSTEP } = await import(`${ROOT}/src/game/tapstep.ts`);
const { startGrab } = await import(`${ROOT}/src/game/player.ts`);
const { HOLD } = await import(`${ROOT}/src/game/character.ts`);
const { handProps } = await import(`${ROOT}/src/game/combat.ts`);
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
  const T: Record<string, any> = { ...(await import(`${ROOT}/src/game/close.ts`)), ...(await import(`${ROOT}/src/game/character.ts`)), ...(await import(`${ROOT}/src/game/stealthpose.ts`)), ...(await import(`${ROOT}/src/game/takedown.ts`)), ...(await import(`${ROOT}/src/game/stalk.ts`)) };
  for (const [name, row] of Object.entries(JSON.parse(raw))) { if (!T[name] || typeof T[name] !== 'object') throw new Error(`--set: no table ${name}`); Object.assign(T[name], row); }
}

// ---------------------------------------------------------------- a moment: both men's worn meshes in the taken man's first frame
interface Shot { label: string; file: string; says: string }
function recorder(scene: string, g: any, A: any, props = false) {
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
    if (props) {   // (what is in their hands and on the floor by them — the game's own boxes, so a gun's way from hand to hand to floor can be followed)
      const out: any[] = []; handProps(g, out); const nHand = out.length; g.items.boxes(out); const hand = A.char.bones.handR ?? A.char.pos;
      out.forEach((b, k) => { if (Math.hypot(b.c[0] - A.char.pos[0], b.c[2] - A.char.pos[2]) > 1.6) return;
        const his = k >= nHand || ((b.owner & 0xff) === (A.char.id & 0xff) && Math.hypot(b.c[0] - hand[0], b.c[1] - hand[1], b.c[2] - hand[2]) < (A.carbine ? 0.55 : 0.2)), rgb = his ? [235, 120, 20] : [52, 52, 58];   // (his gun, in his hand or out of it, is the bright one; the rest of both men's kit is dark)
        const [qx, qy, qz, qw]: number[] = b.rot ?? [0, Math.sin(b.yaw / 2), 0, Math.cos(b.yaw / 2)], base = verts.length / 3;
        const rot = (v: P3): P3 => { const tx = 2 * (qy * v[2] - qz * v[1]), ty = 2 * (qz * v[0] - qx * v[2]), tz = 2 * (qx * v[1] - qy * v[0]); return [v[0] + qw * tx + qy * tz - qz * ty, v[1] + qw * ty + qz * tx - qx * tz, v[2] + qw * tz + qx * ty - qy * tx]; };
        for (let k = 0; k < 8; k++) { const w = rot([(k & 1 ? 1 : -1) * b.h[0], (k & 2 ? 1 : -1) * b.h[1], (k & 4 ? 1 : -1) * b.h[2]]); verts.push(...rel(b.c[0] + w[0], b.c[1] + w[1], b.c[2] + w[2])); cols.push(rgb[0], rgb[1], rgb[2], 15); }
        for (const f of [[0, 2, 3, 1], [4, 5, 7, 6], [0, 1, 5, 4], [2, 6, 7, 3], [0, 4, 6, 2], [1, 3, 7, 5]]) faces.push(base + f[0], base + f[1], base + f[2], base + f[0], base + f[2], base + f[3]); }); }
    const nV = verts.length / 3, nF = faces.length / 3, file = `${stem}__${String(shots.length).padStart(3, '0')}.ply`;
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
  const look = { ahead: false, still: false };   // (the cursor on the man — or, with him in the arm, a point ahead of Sam: the hold turns to the cursor)
  const aim = () => { const c = g.player.char; W.cursorAt(look.ahead && look.still ? [c.pos[0], 0.45, c.pos[2]] : look.ahead ? [c.pos[0] + Math.sin(c.bodyYaw) * 6, 1.0, c.pos[2] + Math.cos(c.bodyYaw) * 6] : [A.char.pos[0], 1.2, A.char.pos[2]]); };
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
/** the grab that disarms him (character.ts HOLD.disarm; game/disarm.ts), beat by beat, with the gun drawn: a man with his pistol out or a carbine in both hands,
 *  taken with Sam's hands empty (`gun`: with Sam's own pistol drawn — it raps the gun out of his hand) */
async function disarm(scene: string, who: 'pistol' | 'rifle', gun: boolean) {
  const S = await lobby(7304), { W, g, A } = S; g.tune.carbineGuards = who === 'rifle' ? 'all' : 'none'; g.player.holstered = !gun;
  S.samAt(0.8, true); S.step(30); const R = recorder(scene, g, A, true);
  if (who === 'pistol') { A.state = 'suspicious'; A.awareness = 0.5; S.step(1); A.state = 'suspicious'; }   // (a man with a reason to have it out: the sidearm, not the torch, is in his hand)
  R.snap('behind him'); S.look.ahead = true; startGrab(g, A); console.log(`  [${scene}] the move ${g.player.holding?.strip ? 'runs' : 'DOES NOT RUN (nothing in his hand to take)'}`);
  let f = 0; const to = (t: number, label: string) => { const n = Math.round(t * 60); if (n > f) { S.step(n - f); f = n; } R.snap(label); };
  const K = HOLD.strip;
  to(0.07, '0.07 s'); to(0.13, '0.13 s'); to(K.take + 0.02, `${(K.take + 0.02).toFixed(2)} s · he has it`); to((K.take + K.out) / 2 + 0.02, 'tearing it out'); to(K.out + 0.02, `${(K.out + 0.02).toFixed(2)} s · out`);
  to((K.out + K.drop) / 2, 'down to his side'); to(K.drop + 0.02, `${(K.drop + 0.02).toFixed(2)} s · lets it go`); to(K.drop + 0.14, 'falling'); to(K.knife + 0.04, 'hand coming back'); to(K.home + 0.05, `${(K.home + 0.05).toFixed(2)} s · held`);
  return R;
}
/** THE STALK (game/stalk.ts): the left button held on him from 2.9 m at the crouch — moments on the way in by the gap, then the grab it becomes, beat by beat
 *  (`who` 'rifle': a carbine in his hands, so the grab is the disarm's). `pause`: let go at 1.4 m, the pose a moment later and a second later, then pressed again. */
async function stalk(scene: string, who: 'calm' | 'rifle', pause: boolean, hit = false) {
  const S = await lobby(7305), { W, g, A } = S; g.tune.carbineGuards = who === 'rifle' ? 'all' : 'none';
  S.samAt(2.9, true); S.step(30); const R = recorder(scene, g, A, who === 'rifle');
  const press = () => { W.input.buttons |= 1; W.input.clicked |= 1; S.step(1); }, lift = () => { W.input.buttons &= ~1; };
  R.snap(`crouched · ${S.gap().toFixed(2)} m`); press(); let n = 0;
  const marks = pause ? [2.4, 1.9, 1.4] : hit ? [1.0] : [2.5, 2.1, 1.8, 1.5, 1.3, 1.12, 1.0];
  for (const d of marks) { while (S.gap() > d && !g.player.holding && n++ < 1200) S.step(1); if (!g.player.holding) R.snap(`creeping · ${S.gap().toFixed(2)} m`); }
  if (pause) { lift(); for (const t of [0.15, 0.5, 1.2]) { S.step(Math.round(t * 60) - (t === 0.15 ? 0 : t === 0.5 ? 9 : 30)); R.snap(`let go ${t.toFixed(2)} s · ${S.gap().toFixed(2)} m`); } press(); for (const d of [1.2, 1.0]) { while (S.gap() > d && !g.player.holding && n++ < 2400) S.step(1); if (!g.player.holding) R.snap(`pressed again · ${S.gap().toFixed(2)} m`); } }
  if (STALK.key) {   // (the key finishes it: he eases to a stop in reach and waits; the row's key is the grab)
    const pc = g.player.char; let still = 0; while (still < 12 && n++ < 2400) { S.step(1); still = Math.hypot(pc.vel[0], pc.vel[2]) < 0.02 ? still + 1 : 0; }
    if (!hit) R.snap(`in reach, waiting · ${S.gap().toFixed(2)} m`);
    if (g.selectVerb('guard', 'grab')) W.input.pressed.add('Space');
  }
  while (!g.player.holding && n++ < 2400) S.step(1);
  if (!g.player.holding) { console.log(`  [${scene}] THE GRAB NEVER CAME (gap ${S.gap().toFixed(2)} m)`); return R; }
  // (still: the cursor at his own feet, inside the hold's 0.6 m — a point six metres ahead is picked a little off his line through this harness's camera, and the pair came round to it a few degrees a frame: a quarter turn by the last still that no player's mouse asked for)
  lift(); S.look.ahead = S.look.still = true; R.snap('the grab · frame 0'); let f = 0; const to = (t: number, label: string) => { const k = Math.round(t * 60); if (k > f) { S.step(k - f); f = k; } R.snap(label); };
  for (const t of hit ? [0.2, 0.27, 0.3, 0.33, 0.37, 0.42, 0.48, 0.56, 0.7] : [0.07, 0.14, 0.22, 0.34, 0.5, 0.7, 0.95, 1.5]) to(t, `grab ${t.toFixed(2)} s`);   // (hit: the frames either side of the step's landing)
  return R;
}
/** THE CREEP AS IT MOVES, every second frame for tools/qa/pose-clip.py: the held click from 3.6 m, let go at 2.2 m and held a beat (the stop), pressed again, into reach and the wait */
async function stalkClip(scene: string) {
  const S = await lobby(7305), { W, g, A } = S; g.tune.carbineGuards = 'none';
  S.samAt(3.6, true); S.step(30); const R = recorder(scene, g, A);
  let f = 0; const go = (n: number) => { for (let i = 0; i < n; i++) { S.step(1); if (f++ % 2 === 0) R.snap(`${S.gap().toFixed(2)} m`); } };
  const press = () => { W.input.buttons |= 1; W.input.clicked |= 1; }, lift = () => { W.input.buttons &= ~1; };
  go(20); press(); let n = 0; while (S.gap() > 2.2 && n++ < 900) go(1);
  lift(); go(54); press(); n = 0; const pc = g.player.char; let still = 0; while (still < 80 && n++ < 900) { go(1); still = Math.hypot(pc.vel[0], pc.vel[2]) < 0.02 ? still + 1 : 0; }
  return R;
}
/** TAP TO STEP (tapstep.ts): the key held for two steps, then taps with stops between, then the step that lands behind him */
async function stepClip(scene: string) {
  const S = await lobby(7305), { W, g, A } = S; g.tune.carbineGuards = 'none'; TAPSTEP.on = true;
  S.samAt(5.4, true); W.cursorAt([A.char.pos[0], 1.2, A.char.pos[2]]); S.step(30); const R = recorder(scene, g, A), { right } = W.cam.planarBasis();
  const key = right[0] > 0 ? 'KeyD' : 'KeyA';
  let f = 0; const go = (n: number) => { for (let i = 0; i < n; i++) { W.cursorAt([A.char.pos[0], 1.2, A.char.pos[2]]); S.step(1); if (f++ % 2 === 0) R.snap(`${S.gap().toFixed(2)} m`); } };
  go(20); W.input.keys.add(key); go(100); W.input.keys.delete(key); go(50);
  for (let i = 0; i < 3; i++) { W.input.keys.add(key); go(5); W.input.keys.delete(key); go(44); }
  W.input.keys.add(key); go(5); W.input.keys.delete(key); go(70);
  return R;
}
/** THE STALK BROKEN OFF (stalk.ts end): the creep from 2.9 m, and at 1.6 m the man turns round to face him — the frames after, as the reach and the rise let go */
async function stalkTurn(scene: string) {
  const S = await lobby(7307), { W, g, A } = S; g.tune.carbineGuards = 'none';
  S.samAt(2.9, true); S.step(30); const R = recorder(scene, g, A);
  W.input.buttons |= 1; W.input.clicked |= 1; S.step(1); let n = 0;
  for (const d of [2.2, 1.6]) { while (S.gap() > d && !g.player.holding && n++ < 1200) S.step(1); R.snap(`creeping · ${S.gap().toFixed(2)} m`); }
  const yaw0 = A.char.bodyYaw; let f = 0; const to = (t: number, label: string) => { const k = Math.round(t * 60); while (f < k) { const u = Math.min(1, (f + 1) / 36); A.char.bodyYaw = A.char.aimYaw = yaw0 + Math.PI * u * u * (3 - 2 * u); S.step(1); f++; } R.snap(label); };
  for (const t of [0.15, 0.3, 0.45, 0.6, 0.8, 1.1, 1.6]) to(t, `he turns · ${t.toFixed(2)} s`);
  W.input.buttons &= ~1; S.step(30); R.snap('button up, half a second on');
  return R;
}
/** THE WAIT AT A CORNER (stalk.ts STALK.corner): Sam's back on the lobby's nearest wall, hands empty, the left button held — a man walks past along the wall a
 *  pace out: moments as he comes, then the grab off the wall, beat by beat */
async function cornerWait(scene: string) {
  const S = await lobby(7306), { W, g, A } = S, pl = g.player, SAM = [6.2, 0, 19.5]; let hit: { t: number; d: number[] } | null = null;
  for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8, d = [Math.sin(a), 0, Math.cos(a)], h = g.col.raycast([SAM[0], 1.0, SAM[2]], d, 14); if (h && (!hit || h.t < hit.t)) hit = { t: h.t, d }; }
  if (!hit) { console.log(`  [${scene}] no wall`); return recorder(scene, g, A); }
  const foot = [SAM[0] + hit.d[0] * (hit.t - 0.6), 0, SAM[2] + hit.d[2] * (hit.t - 0.6)]; g.teleportPlayer(foot); pl.crouch = false;
  const step = (n: number) => { for (let i = 0; i < n; i++) { W.cursorAt([foot[0] + hit!.d[0] * 2, 1.2, foot[2] + hit!.d[2] * 2]); W.step(DT); pl.visibility = 0.02; } };
  step(10); W.input.pressed.add('KeyQ'); step(51); const R = recorder(scene, g, A);
  if (!pl.wall) { console.log(`  [${scene}] no wall took him`); return R; }
  const n = pl.wall.n, t0 = [n[2], 0, -n[0]], p = pl.char.pos, back = 2.6;
  const run = (sg: number) => g.col.raycast([p[0] + n[0] * 0.75 - t0[0] * back * sg, 0.5, p[2] + n[2] * 0.75 - t0[2] * back * sg], [t0[0] * sg, 0, t0[2] * sg], back + 1.6)?.t ?? 99;
  const sg = run(1) >= run(-1) ? 1 : -1, t = [t0[0] * sg, 0, t0[2] * sg];
  place(A, [p[0] + n[0] * 0.75 - t[0] * back, 0, p[2] + n[2] * 0.75 - t[2] * back], Math.atan2(t[0], t[2]));
  const along = () => (A.char.pos[0] - p[0]) * t[0] + (A.char.pos[2] - p[2]) * t[2];
  const walk = () => { A.char.pos[0] += t[0] * 1.15 * DT; A.char.pos[2] += t[2] * 1.15 * DT; A.char.vel = [t[0] * 1.15, 0, t[2] * 1.15]; W.input.buttons |= 1; step(1); };
  let k = 0; for (const m of [-2.0, -1.2, -0.7, -0.4]) { while (along() < m && !pl.holding && k++ < 600) walk(); if (!pl.holding) R.snap(`waiting, the button held · he is ${(-along()).toFixed(2)} m short of him`); }
  while (!pl.holding && k++ < 600) walk();
  if (!pl.holding) { console.log(`  [${scene}] THE GRAB NEVER CAME`); return R; }
  W.input.buttons &= ~1; A.char.vel = [0, 0, 0]; R.snap('the grab · frame 0'); let f = 0; const to = (s: number, label: string) => { const q = Math.round(s * 60); if (q > f) { S.look.ahead = true; S.step(q - f); f = q; } R.snap(label); };
  for (const s of [0.07, 0.14, 0.22, 0.34, 0.5, 0.95]) to(s, `grab ${s.toFixed(2)} s`);
  return R;
}
/** PASSING A MAN (samlook.ts): Sam at the crouch walks east down a lane `side` m off the man — who faces `facing` (EAST + that many degrees) — from 3.4 m short
 *  of him to 2.4 m past: his head on the man, the lean away, the sink and the low arm as he comes level, and the head following as he goes by */
async function pass(scene: string, facingDeg: number, side: number) {
  const S = await lobby(7310), { W, g, A } = S; place(A, LOBBY, EAST + facingDeg * Math.PI / 180); const R = recorder(scene, g, A), c = g.player.char;
  g.teleportPlayer([LOBBY[0] - 3.4, 0, LOBBY[2] + side]); g.player.crouch = true; c.bodyYaw = c.aimYaw = EAST;
  const step = (n = 1) => { for (let i = 0; i < n; i++) { W.cursorAt([c.pos[0] + 6, 1.0, c.pos[2]]); W.step(DT); g.player.visibility = 0.02; } };
  step(40); R.snap('3.4 m short, at rest'); W.input.keys.add('KeyD'); let n = 0;
  for (const x of [-2.4, -1.6, -0.9, -0.3, 0.3, 0.9, 1.6, 2.4]) { while (c.pos[0] - LOBBY[0] < x && n++ < 1500) step(1); R.snap(`${x < 0 ? (-x).toFixed(1) + ' m short of him' : x.toFixed(1) + ' m past him'}`); }
  W.input.keys.delete('KeyD');
  return R;
}
/** SHIFT IN A CROUCH (player.ts CROUCHRUN): the fast crouch walk, six moments of one stride */
async function dash(scene: string) {
  const S = await lobby(7311), { W, g, A } = S; const R = recorder(scene, g, A), c = g.player.char;
  g.teleportPlayer([LOBBY[0] - 4, 0, LOBBY[2] + 2.2]); g.player.crouch = true; c.bodyYaw = c.aimYaw = EAST;
  const step = (n = 1) => { for (let i = 0; i < n; i++) { W.cursorAt([c.pos[0] + 6, 1.0, c.pos[2]]); W.step(DT); g.player.visibility = 0.02; } };
  step(30); W.input.keys.add('KeyD'); step(50); R.snap(`the crouch walk · ${Math.hypot(c.vel[0], c.vel[2]).toFixed(2)} m/s`);
  W.input.keys.add('ShiftLeft'); step(45); for (let k = 0; k < 6; k++) { R.snap(`Shift held · ${Math.hypot(c.vel[0], c.vel[2]).toFixed(2)} m/s · crouched ${g.player.crouch}`); step(7); }
  W.input.keys.delete('ShiftLeft'); W.input.keys.delete('KeyD');
  return R;
}
const SCENES: Record<string, { title: string; run: (name: string) => Promise<any> }> = {
  'pass': { title: 'passing a man who faces him, a metre off his side: the head, the lean away, the low arm', run: n => pass(n, 180, 1.15) },
  'pass-back': { title: 'passing behind a man\'s back, a metre off', run: n => pass(n, -90, 1.15) },
  'dash': { title: 'Shift in a crouch: the fast crouch walk', run: n => dash(n) },
  'disarm': { title: 'the grab disarms him: a drawn pistol stripped out of his hand and let down', run: n => disarm(n, 'pistol', false) },
  'disarm-rifle': { title: 'the grab disarms him: a carbine torn out of his hands', run: n => disarm(n, 'rifle', false) },
  'disarm-gun': { title: 'the grab with Sam\'s pistol drawn: the gun rapped out of his hand', run: n => disarm(n, 'pistol', true) },
  'stalk': { title: 'the stalk: the held click from 2.9 m, the arm and the rise by distance, into the grab', run: n => stalk(n, 'calm', false) },
  'stalk-hit': { title: 'the stalk\'s grab as the body lands: the frames either side of the step\'s landing', run: n => stalk(n, 'calm', false, true) },
  'stalk-rifle': { title: 'the stalk into a rifleman: the creep, then the grab that takes his carbine', run: n => stalk(n, 'rifle', false) },
  'step-clip': { title: 'tap to step as it moves: a held key, then taps, then the step that lands behind him (tools/qa/pose-clip.py)', run: n => stepClip(n) },
  'stalk-clip': { title: 'the creep as it moves: every second frame from 3.6 m, a stop on the way, into the wait (tools/qa/pose-clip.py)', run: n => stalkClip(n) },
  'stalk-corner': { title: 'the wait at a corner: back on a wall, the button held, a man walks past and is taken', run: n => cornerWait(n) },
  'stalk-turn': { title: 'the stalk broken off: at 1.6 m he turns round, the button still down', run: n => stalkTurn(n) },
  'stalk-pause': { title: 'the stalk let go at 1.4 m (the pose held), then pressed again', run: n => stalk(n, 'calm', true) },
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
