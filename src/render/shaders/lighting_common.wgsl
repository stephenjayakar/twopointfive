// Shared by rc / gather / volumetric shaders. Requires the includer to declare:
//   var diceTex: texture_3d<f32>;   (irradiance dice volume: 7 slabs along Y: +x -x +y -y +z -z mean)

fn c0Spacing() -> vec3f { return RC_SIZE / vec3f(frame.rcC0Dims); }

fn diceCoord(P: vec3f, slab: f32) -> vec3f {
  let dims = vec3f(frame.rcC0Dims);
  var g = (P - RC_MIN) / RC_SIZE;
  g = clamp(g, vec3f(0.5) / dims, vec3f(1.0) - vec3f(0.5) / dims);
  return vec3f(g.x, (slab + g.y) / 7.0, g.z);
}

// Irradiance at P for normal N from the dice volume (ambient-cube weighting by N^2).
fn diceIrradiance(P: vec3f, N: vec3f) -> vec3f {
  let n2 = N * N;
  var E = vec3f(0.0);
  let fx = select(1.0, 0.0, N.x >= 0.0); let fy = select(3.0, 2.0, N.y >= 0.0); let fz = select(5.0, 4.0, N.z >= 0.0);
  if (n2.x > 0.001) { E += n2.x * textureSampleLevel(diceTex, linSamp, diceCoord(P, fx), 0.0).xyz; }
  if (n2.y > 0.001) { E += n2.y * textureSampleLevel(diceTex, linSamp, diceCoord(P, fy), 0.0).xyz; }
  if (n2.z > 0.001) { E += n2.z * textureSampleLevel(diceTex, linSamp, diceCoord(P, fz), 0.0).xyz; }
  return E;
}
fn diceMeanRadiance(P: vec3f) -> vec3f {
  return textureSampleLevel(diceTex, linSamp, diceCoord(P, 6.0), 0.0).xyz;
}

// The cache's irradiance at a gather HIT (Ph, face normal n) reached by a ray that left the surface (P0, N0) — the read the final gather makes for its one bounce. Every dice
// read samples a full probe spacing off the surface along its normal so the trilinear footprint cannot straddle the wall it is ON; but a face that looks BACK at the surface
// the ray came from — the back of a carton or a shelf board a hand's width off the wall being shaded, the underside of a bottom shelf over the floor — has only that much
// air in front of it, and a full spacing along its normal lands beyond that wall: in the room next door. Lit storage read straight through the partition onto the back of
// every carton on the manager's shelves, and the office wall behind the unit glowed in the dark (playtest 08-12, docs/internal/render-defects-0812.md §3). Two rules,
// no rays: (1) the offset never carries the read past the plane of (P0, N0) — that plane IS a wall (or floor) between Ph and everything behind it; (2) the trilinear
// footprint of the point read: any lattice neighbour whose cell centre lies behind that plane collapses onto the read point's own cell centre on that axis, and if that
// centre itself lies behind the plane (a wall off the metre lattice) the read steps to the first cell centre on P0's side. Identical to the plain read wherever the hit
// face does not look back at the origin surface (dot(n, N0) ≥ −0.2) and the footprint stays on its side.
fn diceIrradianceFrom(Ph: vec3f, n: vec3f, P0: vec3f, N0: vec3f) -> vec3f {
  let sp = c0Spacing();
  var off = sp;
  let dn = dot(n, N0);
  if (dn < -0.2) { let sStar = dot(P0 - Ph, N0) / dn; off = min(sp, vec3f(max(sStar - 0.05, 0.02))); }   // the run along n to the origin surface's plane, less a margin
  var Q = Ph + n * off;
  if (dot(Q - P0, N0) < 0.6 * max(sp.x, sp.z)) {   // near enough to the plane for a trilinear footprint to reach across it (skipped for the common far read: no change there)
    let g = (Q - RC_MIN) / sp; var home = (floor(g) + vec3f(0.5)) * sp + RC_MIN;
    for (var ax = 0u; ax < 3u; ax++) {
      var e = vec3f(0.0); e[ax] = 1.0;
      if (dot(home - P0, N0) < -0.02 && abs(N0[ax]) > 0.5) { home += e * (sign(N0[ax]) * sp[ax]); Q[ax] = home[ax]; continue; }   // the read point's own cell centre is behind the wall (off-lattice wall): step to the cell on P0's side
      let side = select(-1.0, 1.0, Q[ax] >= home[ax]);
      let C = home + e * (side * sp[ax]);                    // the neighbour this axis of the footprint pulls from
      if (dot(C - P0, N0) < -0.02) { Q[ax] = home[ax]; }    // behind the wall we came off: no cross-wall blend on this axis
    }
  }
  return diceIrradiance(Q, n);
}

// BOUNCE WALLS (the scene prelude's BOUNCE_WALLS — render/frame.ts bounceWallsConfig, on; ?nobouncewalls at boot = every read as it was). The reads above trust two
// things: the face read for is a wall's, with a probe spacing of air in front of it, and the surface a gather ray LEFT is a wall too, so the far side of its plane is
// another room. Neither holds for a man. His side that faces a wall he stands by has a hand's width of air, and a spacing along its normal is the room behind that
// wall; the plane of his own skin has open ground behind it, so diceIrradianceFrom's "the cell centre is behind the wall: step to the cell on P0's side" stepped a ray
// that left him for the wall THROUGH the wall. Men standing in the snow at the foot of a lit room's outer wall took the room's bounce on the side that faces the
// wall, threw it on the snow between them, and a wet coat's sheen (composite.wgsl wetCoatSpec) drew the room's lamps on their rims (playtest 10-20, the pass).
// The read point for a face (Ph, n) about which nothing is assumed: a spacing along n as ever, stopped a hand's width short of the first BOX on that line (men are not
// asked: he must not hide the air from himself), and then the trilinear footprint is held to what that point can see — a box ray from it to the centre of each
// of its four plan cells, and the read keeps all four, else the one column or row, else the one cell, whose centres it sees (a centre inside a wall is not
// seen: a probe there is dark). Five short box rays; asked only where a man is the face read for or the surface the ray left is no wall (the callers' `hit.idx == CAPSULE_HIT`, bounceLeftNoWall below), which is a few pixels' rays.
fn diceWalledPoint(Ph: vec3f, n: vec3f) -> vec3f {
  let sp = c0Spacing();
  let off = n * sp; let len = max(length(off), 1e-3); let d = off / len;
  let Po = Ph + n * 0.02;
  var Q = Ph + off;
  let t = occludedTBoxes(Po, d, len, 0u, -1.0);
  if (t >= 0.0) { Q = Po + d * max(t - 0.05, 0.0); }
  let home = (floor((Q - RC_MIN) / sp) + vec3f(0.5)) * sp + RC_MIN;
  let nb = home + select(vec3f(-1.0), vec3f(1.0), Q >= home) * sp;
  var seen = 0u;   // bit k = the footprint's plan cell k has a clear line from Q to its centre: 0 its own, 1 the one beside it on x, 2 on z, 3 the diagonal one
  for (var k = 0u; k < 4u; k++) {
    let v = vec3f(select(home.x, nb.x, (k & 1u) != 0u), Q.y, select(home.z, nb.z, (k & 2u) != 0u)) - Q; let l = length(v);
    if (l < 1e-3 || occludedTBoxes(Q, v / l, l, 0u, -1.0) < 0.0) { seen |= 1u << k; }
  }
  var m = 1u;      // the cells the read keeps: all four, else one column, one row, one cell — the first whose cells are all seen (none seen: its own)
  if (seen == 15u) { m = 15u; } else if ((seen & 5u) == 5u) { m = 5u; } else if ((seen & 3u) == 3u) { m = 3u; } else if ((seen & 10u) == 10u) { m = 10u; } else if ((seen & 12u) == 12u) { m = 12u; }
  else if ((seen & 1u) != 0u) { m = 1u; } else if ((seen & 2u) != 0u) { m = 2u; } else if ((seen & 4u) != 0u) { m = 4u; } else if ((seen & 8u) != 0u) { m = 8u; }
  if ((m & 10u) == 0u) { Q.x = home.x; } else if ((m & 5u) == 0u) { Q.x = nb.x; }
  if ((m & 12u) == 0u) { Q.z = home.z; } else if ((m & 3u) == 0u) { Q.z = nb.z; }
  return Q;
}
fn diceIrradianceWalled(Ph: vec3f, n: vec3f) -> vec3f { return diceIrradiance(diceWalledPoint(Ph, n), n); }
/** Is the surface a gather ray LEFT (shading normal N0; owner != 0: a man's or a thing he carries) one whose plane diceIrradianceFrom must NOT take for a wall?
 *  A man's skin always. And, for a hit within 2 m (farther off that read is the plain one), any normal that is not a box face's own: a yawed box, and ground the
 *  snow's surface has tilted — the lip of a boot print a hand's width from a wall leans at the wall, and "behind its plane" was the open snow, so the read
 *  stepped a cell toward the wall and into the room. Such a ray's read is diceWalledPoint's. */
fn bounceLeftNoWall(N0: vec3f, owner: u32, t: f32) -> bool { return owner != 0u || (t < 2.0 && max(abs(N0.x), max(abs(N0.y), abs(N0.z))) < 0.999); }

// The same mean radiance for a point in SMOKE, refusing to interpolate through a wall: the dice cells are ~1 m and a plume 30 cm on the dark side of a 12 cm
// wall would otherwise blend straight into the lit cell beyond it (the corridor smoke glowing an exit sign's green from the store room — playtest 08-09).
// One occlusion ray from P toward the neighbouring cell centre the trilinear footprint pulls from (per axis, the side P sits on within its own cell); blocked
// → sample at P's own cell centre instead (nearest, no cross-wall blend). Exact wherever nothing solid lies between P and that neighbour.
fn diceMeanRadianceWalled(P: vec3f) -> vec3f {
  let sp = c0Spacing();
  let g = (P - RC_MIN) / sp;                       // continuous cell coords
  let home = (floor(g) + vec3f(0.5)) * sp + RC_MIN; // P's own cell centre
  var side = sign(P - home);                       // which neighbour each axis pulls from …
  side.y = 0.0;                                    // … in PLAN only: the vertical neighbour of a low sample is under the floor slab / over the ceiling, and a ray into the slab reads
  let nb = vec3f(home.x, P.y, home.z) + side * sp; // 'blocked' for every smoke voxel near the floor (review 08-10 #10) — walls are what leak, so test toward the plan-diagonal neighbour at P's own height
  let d = nb - P; let dist = length(d);
  if (dist > 1e-3 && occluded(P, d / dist, dist, 0u)) {
    return textureSampleLevel(diceTex, linSamp, diceCoord(home, 6.0), 0.0).xyz;   // (home centre: the trilinear weights collapse onto P's own cell)
  }
  return textureSampleLevel(diceTex, linSamp, diceCoord(P, 6.0), 0.0).xyz;
}

// Outgoing radiance of a diffuse box surface hit at P: emission + albedo/pi * (shadowed direct + last-frame bounce).
fn hitRadiance(hit: Hit, P: vec3f) -> vec3f {
  if (hit.inside) { return vec3f(0.0); }
  var L = vec3f(0.0);
  var albedo: vec3f;
  if (hit.idx == CAPSULE_HIT) { albedo = hit.capAlbedo; }
  else {
    let bi = u32(hit.idx);
    let b = boxGeo[bi];
    if ((b.flags & (BOX_EMISSIVE | BOX_AREALIT)) == BOX_EMISSIVE) { L += boxEmissive(bi); }   // area-lit emitters glow on screen but light the scene through their analytic light
    albedo = boxAlbedoSec(bi);
  }
  var E = vec3f(0.0);
  if ((frame.flags & FLAG_DIRECT) != 0u) { E += directIrradiance(P, hit.n, 0u, frame.secMinE, false); }   // steady lights only (this feeds the cascades / dice); dimmer ones get unshadowed half credit
  if ((frame.flags & FLAG_BOUNCE) != 0u) {
    // sample a full probe spacing off the surface: the trilinear footprint then lies entirely on this side of a thin wall
    if (BOUNCE_WALLS && hit.idx == CAPSULE_HIT) { E += diceIrradianceWalled(P, hit.n); }   // BOUNCE WALLS: a man's side is no wall (above)
    else { E += diceIrradiance(P + hit.n * c0Spacing().x, hit.n); }
  }
  L += albedo * E * (1.0 / 3.14159265);
  return L;
}
