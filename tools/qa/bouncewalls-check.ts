// THE BOUNCE IS NEVER READ THROUGH A WALL OFF A MAN — the check behind the scene prelude's BOUNCE_WALLS (src/render/frame.ts bounceWallsConfig; on,
// ?nobouncewalls at boot = as it was; no game table, nothing for a recording to carry).
//   bun run tools/qa/probes.ts bouncewalls        (family `render`)        BOUNCEWALLS_BREAK=1 = the rule off and the same lines asked: must FAIL
// the maintainer, 10-20, the pass at night, the squad in the snow against a lit room's outer wall: "i think there's some leak on direct and specular and indirect
// with the wall here". The radiance cache (a 1 m lattice) is read a probe spacing along a face's normal — sound for a wall, and for a man standing by a wall the
// room behind it: his side that faces the wall took the room's bounce, threw it on the snow, and a wet coat's sheen mirrored the room's lamps on his rims. And a
// gather ray that LEFT him for that wall was bounded by the plane of his own skin as if it were a wall, which stepped the read through the real one.
// The rule now asked where a man is the face read for or the surface a ray left (lighting_common.wgsl diceWalledPoint): the read point stops short of the first
// box along the normal, and its footprint is held to the cells it can see.
// WHAT THIS CAN AND CANNOT SAY. No shader runs here. The rule is written again below (`walled`) and the shader's own function is held to it BY ITS TEXT, with
// every place that asks it; the copy is then asked for men stood by every ceiling-high wall of every level, and what it reads is weighed: the share of the
// read's plan footprint (the four lattice cells it blends) whose cell centre lies BEYOND a ceiling-high wall from the man's skin. The old read is weighed the same
// way, so the flaw is a number here too. What the picture looks like is the page's to show.
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from './headless.ts';
export async function bounceWallsCheck(): Promise<boolean> {
  const BRK = process.env.BOUNCEWALLS_BREAK === '1'; let all = true;
  const verdict = (ok: boolean, what: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}\n    ${detail}`); };
  console.log(`\n=== bouncewalls: the bounce is never read through a wall off a man${BRK ? ' (the rule off: must fail)' : ''} ===`);
  const read = (f: string) => readFileSync(resolve(ROOT, 'src/render/shaders', f), 'utf8'), flat = (s: string) => s.replace(/\s+/g, ' ').trim();
  const lc = read('lighting_common.wgsl'), fg = read('fgather.wgsl'), rf = read('reflect.wgsl'), r5 = read('reflect_p5.wgsl'), comp = read('composite.wgsl');
  const { WORLD } = await import(`${ROOT}/src/scene/world.ts`), { defaultRcConfig } = await import(`${ROOT}/src/render/rc.ts`), { BoxFlag } = await import(`${ROOT}/src/scene/boxes.ts`);
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`), { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const CY: number = WORLD.ceilingY, RC0: number[] = WORLD.rcMin, SP = [WORLD.rcSize[0] / defaultRcConfig.nx, WORLD.rcSize[1] / defaultRcConfig.ny, WORLD.rcSize[2] / defaultRcConfig.nz];

  // (1) the text
  { const body = flat((/fn diceWalledPoint\(Ph: vec3f, n: vec3f, skip: u32\) -> vec4f \{\n([\s\S]*?)\n\}/.exec(lc)?.[1] ?? '').replace(/\/\/.*$/gm, ''));
    const WANT = flat(`let sp = c0Spacing();
      let off = n * sp; let len = max(length(off), 1e-3); let d = off / len;
      let Po = Ph + n * 0.02;
      var Q = Ph + off; var home = Q; var nb = Q;
      var t = -1.0; var again = true;
      var seen = 0u;
      for (var i = 0u; i < 8u; i++) {
        var ro = Po; var rd = d; var l = len;
        if (i >= 1u && i < 4u) { if (!again || t <= 1e-3) { continue; } l = t - 1e-3; }
        if (i == 4u) {
          if (t >= 0.0) { Q = Po + d * max(t - 0.05, 0.0); }
          home = (floor((Q - RC_MIN) / sp) + vec3f(0.5)) * sp + RC_MIN;
          nb = home + select(vec3f(-1.0), vec3f(1.0), Q >= home) * sp;
        }
        if (i >= 4u) {
          let k = i - 4u;
          let v = vec3f(select(home.x, nb.x, (k & 1u) != 0u), Q.y, select(home.z, nb.z, (k & 2u) != 0u)) - Q; l = length(v);
          if (l < 1e-3) { seen |= 1u << k; continue; }
          ro = Q; rd = v / l;
        }
        let u = occludedTBoxes(ro, rd, l, skip, -1.0);
        if (i == 0u) { t = u; } else if (i < 4u) { if (u < 0.0) { again = false; } else { t = u; } } else if (u < 0.0) { seen |= 1u << (i - 4u); }
      }
      if (seen == 0u) { return vec4f(Q, 0.0); }
      var m = 8u;
      if (seen == 15u) { m = 15u; } else if ((seen & 5u) == 5u) { m = 5u; } else if ((seen & 3u) == 3u) { m = 3u; } else if ((seen & 10u) == 10u) { m = 10u; } else if ((seen & 12u) == 12u) { m = 12u; }
      else if ((seen & 1u) != 0u) { m = 1u; } else if ((seen & 2u) != 0u) { m = 2u; } else if ((seen & 4u) != 0u) { m = 4u; }
      if ((m & 10u) == 0u) { Q.x = home.x; } else if ((m & 5u) == 0u) { Q.x = nb.x; }
      if ((m & 12u) == 0u) { Q.z = home.z; } else if ((m & 3u) == 0u) { Q.z = nb.z; }
      return vec4f(Q, 1.0);`);
    const n = (s: string, re: RegExp) => (s.match(re) ?? []).length;
    const man = /if \(BOUNCE_WALLS && bounceHitMan\(hit\)\) \{ (?:h\.)?E[h]? \+= diceIrradianceWalled\((?:Ph|P), hit\.n, bounceHitOwner\(hit\)\); \}/g;
    const left = /if \(BOUNCE_WALLS && \(bounceHitMan\(hit\) \|\| bounceLeftNoWall\(N0?, owner, hit\.t\)\)\) \{ E[hb] \+?= diceIrradianceWalled\(Ph, hit\.n, bounceHitOwner\(hit\) \| \(owner << 8u\)\); \}/g;
    const isMan = /fn bounceHitMan\(hit: Hit\) -> bool \{ if \(hit\.idx == CAPSULE_HIT\) \{ return true; \} return hit\.idx >= 0 && boxOwner\(boxGeo\[u32\(hit\.idx\)\]\) != 0u; \}/.test(lc) && /fn diceIrradianceWalled\(Ph: vec3f, n: vec3f, skip: u32\) -> vec3f \{ let q = diceWalledPoint\(Ph, n, skip\); if \(q\.w == 0\.0\) \{ return vec3f\(0\.0\); \} return diceIrradiance\(q\.xyz, n\); \}/.test(lc);
    const noWall = /fn bounceLeftNoWall\(N0: vec3f, owner: u32, t: f32\) -> bool \{ return owner != 0u \|\| \(t < 2\.0 && max\(abs\(N0\.x\), max\(abs\(N0\.y\), abs\(N0\.z\)\)\) < 0\.98\); \}/.test(lc);
    const sites = { cache: n(lc, man), gloss: n(fg, man), gather: n(fg, left), refl: n(rf, man), refl5: n(r5, man), coat: n(comp, /if \(BOUNCE_WALLS\) \{ let q = diceWalledPoint\(P, N, \(id >> 20u\) & 0xffu\); if \(q\.w > 0\.0\) \{ env = diceIrradiance\(q\.xyz, R\); \} \}/g) };
    const bare = n(fg, /diceIrradianceFrom\(/g) + n(fg + rf + r5, /\{ (?:h\.)?Eh \+= diceIrradiance\(Ph \+ hit\.n \* c0Spacing\(\), hit\.n\); \}/g);   // every one of the old reads must now sit in the else of a site above
    const pre = /const BOUNCE_WALLS: bool = \$\{bounceWallsConfig\.on \? 'true' : 'false'\};/.test(readFileSync(resolve(ROOT, 'src/render/frame.ts'), 'utf8'));
    const flag = /if \(q\.has\('nobouncewalls'\)\) bounceWallsConfig\.on = false;/.test(readFileSync(resolve(ROOT, 'src/main.ts'), 'utf8'));
    verdict(body === WANT && sites.cache === 1 && sites.gloss === 2 && sites.gather === 3 && sites.refl === 1 && sites.refl5 === 2 && sites.coat === 1 && bare === 8 && noWall && isMan && pre && flag,
      'the shader\'s rule is the one weighed below, every read off a man asks it, and the prelude and the page\'s flag carry the switch',
      `diceWalledPoint ${body === WANT ? 'matches' : 'DIFFERS'} · asked by: the cache's probes ${sites.cache}/1, the gloss and pane rays ${sites.gloss}/2, the gather's rays ${sites.gather}/3, the reflections ${sites.refl}/1 + ${sites.refl5}/2, a wet coat's sheen ${sites.coat}/1 · old reads left, each in a site's else ${bare}/8 · bounceLeftNoWall ${noWall ? 'as weighed' : 'DIFFERS'} · a carried box is the man, and no cell seen is no read: ${isMan} · prelude const ${pre} · ?nobouncewalls ${flag}`); }

  // ---- the copy ----
  type V = number[]; type Bx = { c: V; h: V; flags: number; yaw?: number; rot?: unknown };
  const add = (a: V, b: V, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k], dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len = (a: V) => Math.hypot(a[0], a[1], a[2]);
  /** first box on the segment ro + d·[0, tmax] (0 = ro is inside one), or −1: common.wgsl occludedTBoxes over the boxes near the man */
  const rayT = (B: Bx[], ro: V, d: V, tmax: number) => { let best = -1;
    for (const b of B) { let tN = -1e30, tF = 1e30;
      for (let a = 0; a < 3; a++) { const lo = b.c[a] - b.h[a] - ro[a], hi = b.c[a] + b.h[a] - ro[a];
        if (Math.abs(d[a]) < 1e-12) { if (lo > 0 || hi < 0) { tN = 1e30; break; } continue; }
        const t0 = lo / d[a], t1 = hi / d[a]; tN = Math.max(tN, Math.min(t0, t1)); tF = Math.min(tF, Math.max(t0, t1)); }
      if (tN > tF || tF < 0 || tN > tmax) continue; const t = Math.max(tN, 0); if (best < 0 || t < best) best = t; }
    return best; };
  const homeOf = (Q: V) => Q.map((q, a) => (Math.floor((q - RC0[a]) / SP[a]) + 0.5) * SP[a] + RC0[a]);
  /** the old read point off a face: a spacing along its normal */
  const plain = (Ph: V, n: V) => [Ph[0] + n[0] * SP[0], Ph[1] + n[1] * SP[1], Ph[2] + n[2] * SP[2]];
  /** lighting_common.wgsl diceWalledPoint (rayT answers the NEAREST box, as the shader's ask-again loop does; null = it sees no cell: no read) */
  const walled = (B: Bx[], Ph: V, n: V): V | null => { const off = [n[0] * SP[0], n[1] * SP[1], n[2] * SP[2]], L = Math.max(len(off), 1e-3), d = off.map(v => v / L), Po = add(Ph, n, 0.02);
    let Q = add(Ph, off); const t = rayT(B, Po, d, L); if (t >= 0) Q = add(Po, d, Math.max(t - 0.05, 0));
    const home = homeOf(Q), nb = home.map((h, a) => h + (Q[a] >= h ? 1 : -1) * SP[a]); let seen = 0;
    for (let k = 0; k < 4; k++) { const v = [(k & 1 ? nb[0] : home[0]) - Q[0], 0, (k & 2 ? nb[2] : home[2]) - Q[2]], l = len(v); if (l < 1e-3 || rayT(B, Q, v.map(x => x / l), l) < 0) seen |= 1 << k; }
    if (!seen) return null;                                                   // (.w = 0: no read)
    const m = [15, 5, 3, 10, 12].find(q => (seen & q) === q) ?? [1, 2, 4].find(q => seen & q) ?? 8;
    if (!(m & 10)) Q[0] = home[0]; else if (!(m & 5)) Q[0] = nb[0];
    if (!(m & 12)) Q[2] = home[2]; else if (!(m & 3)) Q[2] = nb[2];
    return Q; };
  /** lighting_common.wgsl diceIrradianceFrom's read point (the old read for a gather ray: bounded by the plane of the surface it left) */
  const from = (Ph: V, n: V, P0: V, N0: V) => { let off = SP.slice(); const dn = dot(n, N0);
    if (dn < -0.2) { const s = Math.max(dot(add(P0, Ph, -1), N0) / dn - 0.05, 0.02); off = SP.map(v => Math.min(v, s)); }
    const Q = [Ph[0] + n[0] * off[0], Ph[1] + n[1] * off[1], Ph[2] + n[2] * off[2]];
    if (dot(add(Q, P0, -1), N0) < 0.6 * Math.max(SP[0], SP[2])) { const home = homeOf(Q);
      for (let a = 0; a < 3; a++) {
        if (dot(add(home, P0, -1), N0) < -0.02 && Math.abs(N0[a]) > 0.5) { home[a] += Math.sign(N0[a]) * SP[a]; Q[a] = home[a]; continue; }
        const C = home.slice(); C[a] += (Q[a] >= home[a] ? 1 : -1) * SP[a]; if (dot(add(C, P0, -1), N0) < -0.02) Q[a] = home[a]; } }
    return Q; };
  /** of the read at Q, the share of its plan footprint (four cells, bilinear) that lies BEYOND a ceiling-high wall: all of it when the wall stands between the
   *  man's skin (`eye`) and Q, else the cells whose centre Q cannot see (round a wall's end is not through it; a probe inside a wall is dark, not a leak) */
  const leak = (W: Bx[], eye: V, Q: V | null) => { let w = 0; if (!Q) return 0;
    const W2 = W.map(b => ({ ...b, c: [b.c[0], 0, b.c[2]], h: b.h[0] < b.h[2] ? [b.h[0], 1, b.h[2] - 0.1] : [b.h[0] - 0.1, 1, b.h[2]] }));   // (a hand's width off each end: a sight line that grazes a wall's end goes round it)
    const hid = (a: V, x: number, z: number) => { const v = [x - a[0], 0, z - a[2]], l = len(v); return l > 1e-6 && rayT(W2, [a[0], 0, a[2]], v.map(q => q / l), l) >= 0; };
    if (hid(eye, Q[0], Q[2])) return 1;
    const gx = (Q[0] - RC0[0]) / SP[0] - 0.5, gz = (Q[2] - RC0[2]) / SP[2] - 0.5, ix = Math.floor(gx), iz = Math.floor(gz), fx = gx - ix, fz = gz - iz;
    for (const [dx, dz, k] of [[0, 0, (1 - fx) * (1 - fz)], [1, 0, fx * (1 - fz)], [0, 1, (1 - fx) * fz], [1, 1, fx * fz]]) { if (k < 1e-4) continue;
      const cx = (ix + dx + 0.5) * SP[0] + RC0[0], cz = (iz + dz + 0.5) * SP[2] + RC0[2];
      if (W.some(b => Math.abs(cx - b.c[0]) <= b.h[0] && Math.abs(cz - b.c[2]) <= b.h[2])) continue;
      if (hid(Q, cx, cz)) w += k; }
    return w; };
  const levelOf = (file: string) => { const all: Bx[] = loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8'))).boxes;
    const solid = all.filter(b => !(b.flags & (BoxFlag.NoShadow | BoxFlag.Glass)) && !b.rot && Math.abs(Math.sin(b.yaw ?? 0)) < 1e-6);
    const walls = solid.filter(b => !(b.flags & BoxFlag.Dynamic) && b.c[1] - b.h[1] <= 0.45 && b.c[1] + b.h[1] >= CY - 0.1 && Math.max(b.h[0], b.h[2]) > 0.3 && Math.min(b.h[0], b.h[2]) < 0.2);
    return { solid, walls }; };
  const RULE = !BRK, R = 0.28, NORM = 12, DIST = [0.33, 0.45, 0.6, 0.9];
  /** men stood by a level's walls: for each, his skin's points (three heights × NORM normals) and what the read off each leaks, old and new; and for the points that
   *  face the wall, the gather ray that leaves him for it */
  const weigh = (L: { solid: Bx[]; walls: Bx[] }, only?: (b: Bx) => boolean) => { const o = { men: 0, pts: 0, oldSum: 0, newSum: 0, oldBad: 0, newBad: 0, rays: 0, rOld: 0, rNew: 0, rOldBad: 0, rNewBad: 0, worst: 0 };
    for (const b of L.walls) { if (only && !only(b)) continue; const ax = b.h[0] < b.h[2] ? 0 : 2, al = 2 - ax;
      for (const s of [-1, 1]) for (const D of DIST) for (let u = -b.h[al] + 0.25; u <= b.h[al] - 0.25; u += 0.5) {
        const c = [0, 0, 0]; c[ax] = b.c[ax] + s * (b.h[ax] + D); c[al] = b.c[al] + u;
        if (c[0] < 1 || c[2] < 1 || c[0] > WORLD.max[0] - 1 || c[2] > WORLD.max[2] - 1) continue;
        const near = L.solid.filter(q => Math.abs(q.c[0] - c[0]) <= q.h[0] + 2.6 && Math.abs(q.c[2] - c[2]) <= q.h[2] + 2.6);
        if (near.some(q => q.c[1] + q.h[1] > 0.4 && Math.abs(q.c[0] - c[0]) < q.h[0] + R + 0.02 && Math.abs(q.c[2] - c[2]) < q.h[2] + R + 0.02)) continue;   // no room for a man here
        const W = L.walls.filter(q => Math.abs(q.c[0] - c[0]) <= q.h[0] + 2.6 && Math.abs(q.c[2] - c[2]) <= q.h[2] + 2.6); o.men++;
        for (const [y, ty] of [[0.6, 0], [1.3, 0], [0.25, -0.6]]) for (let k = 0; k < NORM; k++) { const a = (k + 0.5) / NORM * Math.PI * 2, hz = Math.sqrt(1 - ty * ty), n = [Math.cos(a) * hz, ty, Math.sin(a) * hz], Ph = [c[0] + Math.cos(a) * R, y, c[2] + Math.sin(a) * R];   // (the third: a shin, its skin turned down at the ground — the floor under the room is nearer the read point than the wall is not)
          const lo = leak(W, Ph, plain(Ph, n)), ln = leak(W, Ph, RULE ? walled(near, Ph, n) : plain(Ph, n));
          o.pts++; o.oldSum += lo; o.newSum += ln; if (lo > 0.05) o.oldBad++; if (ln > 0.05) o.newBad++; o.worst = Math.max(o.worst, ln);
          if (ty) continue; const Po = add(Ph, n, 0.02), t = rayT(near, Po, n, 1.5); if (t <= 0) continue;   // the ray that leaves this point straight out: what it hits within arm's reach, and the read there
          const Pw = add(Po, n, t), hit = near.find(q => [0, 1, 2].every(i => Math.abs(Pw[i] - q.c[i]) <= q.h[i] + 1e-4)); if (!hit) continue;
          let fa = 0, fd = 1e9; for (const i of [0, 2]) { const dd = Math.abs(Math.abs(Pw[i] - hit.c[i]) - hit.h[i]); if (dd < fd) { fd = dd; fa = i; } }
          const hn = [0, 0, 0]; hn[fa] = Math.sign(Pw[fa] - hit.c[fa]);
          const ro = leak(W, Ph, from(Pw, hn, Po, n)), rn = leak(W, Ph, RULE ? walled(near, Pw, hn) : from(Pw, hn, Po, n));
          o.rays++; o.rOld += ro; o.rNew += rn; if (ro > 0.05) o.rOldBad++; if (rn > 0.05) o.rNewBad++; o.worst = Math.max(o.worst, rn); } } }
    return o; };
  const pc = (a: number, b: number) => b ? (100 * a / b).toFixed(1) + ' %' : 'none';

  // (2) the pass, where he stood: the tea room's outer walls (west, x = 12; north, z = 5)
  { const L = levelOf('pass.json'), o = weigh(L, b => (Math.abs(b.c[0] - 12) < 0.01 && b.c[2] > 5 && b.c[2] < 11) || (Math.abs(b.c[2] - 5) < 0.01 && b.c[0] > 12 && b.c[0] < 22));
    verdict(o.men >= 20 && o.oldBad > 0.1 * o.pts && o.newBad === 0 && o.rOldBad > 0.1 * o.rays && o.rNewBad === 0,
      'the pass, the tea room\'s west and north walls: no read off a man stood by them, and none off the wall for a ray that left him, takes a cell beyond the wall',
      `${o.men} men stood 0.33 to 0.9 m off the faces, ${o.pts} points of skin: the read off his skin blends a cell beyond the wall at ${o.newBad} (as it was: ${o.oldBad}, ${pc(o.oldBad, o.pts)}; mean share ${(o.oldSum / o.pts).toFixed(3)} → ${(o.newSum / o.pts).toFixed(3)}) · ${o.rays} rays from his skin to the wall: ${o.rNewBad} (as it was: ${o.rOldBad}, ${pc(o.rOldBad, o.rays)}; mean share ${(o.rOld / Math.max(o.rays, 1)).toFixed(3)} → ${(o.rNew / Math.max(o.rays, 1)).toFixed(3)})`); }

  // (2b) the lip of a boot print at the wall's foot: ground whose shading normal leans at the wall, and the ray that leaves it for the wall
  { const L = levelOf('pass.json'); let n = 0, oldBad = 0, newBad = 0, asked = 0;
    const noWall = (N0: V, t: number) => t < 2.0 && Math.max(Math.abs(N0[0]), Math.abs(N0[1]), Math.abs(N0[2])) < 0.98;   // (bounceLeftNoWall, owner 0)
    for (const z of [5.6, 6.3, 7.1, 8.4, 9.7]) for (const d of [0.06, 0.12, 0.2, 0.3, 0.45]) for (const a of [0.15, 0.3, 0.45, 0.6, 0.9]) for (const h of [0.03, 0.1, 0.3, 0.6]) {
      const N0 = [a, Math.sqrt(1 - a * a), 0], P0 = [11.88 - d, 0, z], Po = add(P0, N0, 0.02), Pw = [11.88, h, z], hn = [-1, 0, 0], t = len(add(Pw, Po, -1));
      const near = L.solid.filter(q => Math.abs(q.c[0] - P0[0]) <= q.h[0] + 2.6 && Math.abs(q.c[2] - z) <= q.h[2] + 2.6), W = L.walls.filter(q => near.includes(q));
      const use = RULE && noWall(N0, t); if (use) asked++;
      n++; if (leak(W, Po, from(Pw, hn, Po, N0)) > 0.05) oldBad++; if (leak(W, Po, use ? walled(near, Pw, hn) : from(Pw, hn, Po, N0)) > 0.05) newBad++; }
    verdict(n === 500 && oldBad > 40 && newBad === 0 && (!RULE || (asked === 400)),
      'the pass, trodden snow at the foot of the tea room\'s west wall: a ray from a print\'s lip to the wall reads no cell beyond it',
      `${n} rays (5 places, 0.06 to 0.45 m off the wall, the normal leaning 0.15 to 0.9 at it, the wall met 3 to 60 cm up): a cell beyond the wall at ${newBad} (as it was: ${oldBad}); the walled read asked for ${asked} — not for the 100 that lean 0.15, whose old read is clean`); }

  // (3) every level
  { const T = { men: 0, pts: 0, oldSum: 0, newSum: 0, oldBad: 0, newBad: 0, rays: 0, rOld: 0, rNew: 0, rOldBad: 0, rNewBad: 0 }; let levels = 0; const bad: string[] = [];
    for (const file of readdirSync(resolve(ROOT, 'levels')).filter(f => f.endsWith('.json') && !f.endsWith('.lint.json')).sort()) {
      let L; try { L = levelOf(file); } catch { continue; } if (!L.walls.length) continue; levels++;
      const o = weigh(L); for (const k of Object.keys(T) as (keyof typeof T)[]) T[k] += o[k];
      if (o.newBad + o.rNewBad > 0) bad.push(`${file.replace('.json', '')} ${o.newBad}+${o.rNewBad} (worst share ${o.worst.toFixed(2)})`); }
    const newShare = (T.newBad + T.rNewBad) / Math.max(T.pts + T.rays, 1), oldShare = (T.oldBad + T.rOldBad) / Math.max(T.pts + T.rays, 1);
    verdict(levels >= 30 && T.men > 2000 && oldShare > 0.05 && newShare < 0.004 && newShare < oldShare / 20,
      'every level: a man stood by any ceiling-high wall — the reads that blend a cell beyond a wall are all but gone',
      `${levels} levels, ${T.men} men, ${T.pts} points of skin and ${T.rays} rays to a wall: reads with a cell beyond a wall ${T.newBad} + ${T.rNewBad} = ${pc(T.newBad + T.rNewBad, T.pts + T.rays)} (as it was: ${T.oldBad} + ${T.rOldBad} = ${pc(T.oldBad + T.rOldBad, T.pts + T.rays)}) · mean share off his skin ${(T.oldSum / T.pts).toFixed(4)} → ${(T.newSum / T.pts).toFixed(4)}${bad.length ? ' · left: ' + bad.slice(0, 8).join(', ') + (bad.length > 8 ? ` and ${bad.length - 8} more` : '') : ''}`); }

  // (4) in the open nothing moved: a man in the pass's yard, no box but the ground within reach, reads where he always did
  { const L = levelOf('pass.json'), reach = (P: V) => L.solid.filter(q => Math.abs(q.c[0] - P[0]) <= q.h[0] + 2.6 && Math.abs(q.c[2] - P[2]) <= q.h[2] + 2.6), high = (B: Bx[]) => B.filter(q => q.c[1] + q.h[1] > 0.3).length;
    let Ph: V = [20.37, 1.3, 16.21]; look: for (let x = 2.37; x < 38; x += 1.37) for (let z = 2.21; z < 26; z += 1.37) if (reach([x, 1.3, z]).length && !high(reach([x, 1.3, z]))) { Ph = [x, 1.3, z]; break look; }
    const near = reach(Ph), tall = high(near); let same = 0, n = 0;
    for (let k = 0; k < 24; k++) { const a = (k + 0.5) / 24 * Math.PI * 2, nn = [Math.cos(a) * 0.9, Math.sqrt(1 - 0.81) * (k % 2 ? 1 : -1), Math.sin(a) * 0.9]; n++;
      const p = plain(Ph, nn), w = walled(near, Ph, nn); if (w && p.every((v, i) => Math.abs(v - w[i]) < 1e-9)) same++; }
    verdict(same === n && tall === 0 && near.length > 0, 'in the open (the pass\'s yard, only the ground within reach) the read point is the old one, a spacing along the normal', `${same} of ${n} normals at (${Ph[0].toFixed(2)}, ${Ph[2].toFixed(2)}) · ${near.length} boxes within reach, ${tall} of them above the ground`); }
  return all;
}
if (import.meta.main) process.exit((await bounceWallsCheck()) ? 0 : 1);
