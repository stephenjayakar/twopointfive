// GPU particles — the simulation (EXPERIMENT, render/particles.ts; prelude = scene + lighting_common + particles_common). Two kernels in one compute pass:
//   emit    one thread per particle born this frame: finds its emit record (the CPU queued them: kind, shape, seed, the ring slots it was dealt), draws
//           its direction / speed / life / size from a hash of (seed, index) — no Math.random anywhere on the path, so a ?paused capture repeats — and
//           writes the slot, pre-integrated a random fraction of dt so a burst is a spray and not a shell;
//   update  one thread per slot of the two live windows: age out, integrate (gravity, drag), collide with the very boxes every ray in the renderer sees
//           (traceClosest through the trace grid: bounce with restitution / tangential loss — a spark keeps skittering as long as it burns — slow things
//           on an up face go to sleep and re-test their support now and then), then SHADE: a spark's emission off its cooling curve; a chip / puff / casing
//           LIT — every light scored unshadowed through the reach masks, the three strongest given a shadow ray, the radiance cache's dice for the ambient —
//           so brass in a torch beam is bright on the lit side of the room and dark in the shadow of the desk. The splat (particles_draw.wgsl) only reads.
struct Pool { hdr: array<atomic<u32>, 16>, parts: array<Particle> };   // hdr[0] alive, [1] asleep (zeroed by the CPU every frame), [2] contacts, [3] born inside geometry, [4] kicked by an impulse, [5] resting leaves the WIND picked up (cumulative) — read back for the panel

@group(1) @binding(0) var<storage, read_write> pool: Pool;
@group(1) @binding(1) var<uniform> em: EmitBlock;
@group(1) @binding(2) var diceTex: texture_3d<f32>;   // the radiance cache's irradiance dice (lighting_common.wgsl diceIrradiance / diceMeanRadiance)

// ---- hash RNG: pcg on (seed, particle index, stream)
fn pcg(v: u32) -> u32 { let s = v * 747796405u + 2891336453u; let w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u; return (w >> 22u) ^ w; }
fn rnd(seed: u32, k: u32) -> f32 { return f32(pcg(seed ^ (k * 0x9E3779B9u)) >> 8u) / 16777216.0; }

fn basisU(dn: vec3f) -> vec3f { let up = select(vec3f(0.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), abs(dn.y) > 0.9); return normalize(cross(up, dn)); }

// ================================================================== emit
@compute @workgroup_size(64) fn emit(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= em.totalNew) { return; }
  var r = 0u;
  for (var k = 0u; k < em.numRecs; k++) { let rc = em.recs[k]; if (i >= rc.first && i < rc.first + rc.count) { r = k; break; } }
  let rec = em.recs[r];
  let j = i - rec.first;                                   // index within the record
  let kind = rec.k.x & 15u; let owner = (rec.k.x >> 8u) & 255u; let ring = (rec.k.x >> 16u) & 3u;
  var w = em.win[ring & 1u]; if (ring == 2u) { w = em.rainWin; }   // (ring 2 = the rain ring in the block's tail — particle rain experiment)
  let slot = w.start + (rec.k.z + j) % w.size;
  let seed = pcg(rec.k.y ^ (j * 0x85EBCA6Bu + 1u));       // this particle's own seed (kept: the shading twinkle / the resting angle draw from it)
  // direction + speed by shape
  var pos = rec.pos; var vel: vec3f;
  var rainDead = false;                                    // (the rain disc found no outdoor point: the slot is written spent)
  let sp = rec.speed * (1.0 - rec.p.w * rnd(seed, 3u));
  if (rec.shape == 0u) {                                   // cone about dir, uniform over the cap (game/sparks.ts emitCone)
    let dn = normalize(rec.dir); let U = basisU(dn); let W = cross(dn, U);
    let cy = 1.0 - rnd(seed, 1u) * (1.0 - cos(rec.p.x)); let sr = sqrt(max(0.0, 1.0 - cy * cy)); let th = rnd(seed, 2u) * 6.2831853;
    vel = (dn * cy + U * (cos(th) * sr) + W * (sin(th) * sr)) * sp;
  } else if (rec.shape == 1u) {                            // ground burst: upper hemisphere narrowed by spread, rotated toward vertical by lift (sparks.ts emitBurst)
    let th = rnd(seed, 1u) * 6.2831853;
    var cy = pow(rnd(seed, 2u), 1.0 + rec.p.x * 3.0) * 0.9 + 0.05; cy = cy + (1.0 - cy) * rec.q.y;
    let sr = sqrt(max(0.0, 1.0 - cy * cy));
    vel = vec3f(cos(th) * sr, cy, sin(th) * sr) * sp;
  } else if (rec.shape == 2u) {                            // ring in XZ of radius posB.x: born on the ring, thrown outward (+ lift up), a little angular jitter
    let th = (f32(j) + rnd(seed, 1u)) / f32(max(1u, rec.count)) * 6.2831853;
    let o = vec3f(cos(th), 0.0, sin(th));
    pos = rec.pos + o * rec.posB.x;
    vel = normalize(o + vec3f(0.0, rec.q.y, 0.0) + (vec3f(rnd(seed, 2u), rnd(seed, 4u), rnd(seed, 5u)) - 0.5) * rec.p.x) * sp;
  } else if (rec.shape == 4u) {                            // RAIN DISC (game/rainFx.ts): born on the rain slab's top face (pos.y, minus up to `lift` m so no two fall in step), uniformly over the OUTDOOR
    // part of the disc of radius posB.x about pos.xz — up to 32 tries for a point outside the interior / annex footprints (frame.weatherC / D: the very rectangles the lattice
    // rain is cut by) inside the world's rim, thinned toward the disc's rim where the lattice takes over again (volumetrics.wgsl rainNearKeep mirrors the taper); no luck =
    // born spent (the lot is a 4 m ring round the building: a disc thrown over it from the follow camera is a sixth outdoors, so a dozen tries lost a tenth of the births).
    // Velocity: along dir at speed (the terminal fall + the wind — a drip off an eave hands in a slow one and the update's drag brings it up to speed)
    var ok = false; var q2 = rec.pos.xz;
    for (var t = 0u; t < 32u && !ok; t++) {
      let rr = sqrt(rnd(seed, 20u + t * 3u)); let th = rnd(seed, 21u + t * 3u) * 6.2831853;
      q2 = rec.pos.xz + vec2f(cos(th), sin(th)) * (rr * rec.posB.x);
      let rim = 1.0 - smoothstep(0.7, 1.0, rr);
      ok = rainOutdoors(q2) && rnd(seed, 22u + t * 3u) < rim;
    }
    if (ok) { ok = rnd(seed, 18u) < rainBand(q2); }              // v2 SHEETS: the births thinned on a value noise carried downwind (game/rainFx.ts files (1 + amp) × as many, so the mean holds) — curtains of denser rain cross the lot
    pos = vec3f(q2.x, rec.pos.y - rec.q.y * rnd(seed, 19u), q2.y);
    vel = normalize(rec.dir) * sp;
    if (numWinds() > 0u) { vel += windAir(pos, kind, -1e9) * em.rainCfgD.w; }   // v2 WIND: born moving with the AIR where it enters the slab (a drop has fallen through this wind for seconds already) — the storm's vector, its gust, its lee off the facade
    rainDead = !ok;
  } else {                                                 // puff: uniform direction, speed skewed slow
    let z = rnd(seed, 1u) * 2.0 - 1.0; let th = rnd(seed, 2u) * 6.2831853; let sr = sqrt(max(0.0, 1.0 - z * z));
    vel = vec3f(cos(th) * sr, z * 0.6 + rec.q.y, sin(th) * sr) * (sp * sqrt(rnd(seed, 4u)));
  }
  vel += rec.vadd;
  if (rec.q.w > 0.0) { pos += (vec3f(rnd(seed, 6u), rnd(seed, 7u), rnd(seed, 8u)) - 0.5) * (2.0 * rec.q.w); }
  var p: Particle;
  let life = rec.p.y * (1.0 - rec.q.x + 2.0 * rec.q.x * rnd(seed, 9u));
  let size = rec.p.z * (1.0 - rec.q.z + 2.0 * rec.q.z * rnd(seed, 10u));
  // born somewhere inside this frame: pre-integrate a random fraction of dt (the update kernel skips its step for PB_NEW), so 400 sparks leave as a spray
  let f = rnd(seed, 11u) * frame.dt;
  let g = em.kp[kind * 2u].x;
  vel.y -= g * f;
  p.pos = pos + vel * f; p.age = f;
  p.vel = vel; p.life = max(life, 0.02);
  p.size = max(size, 0.0005); p.bits = kind | PB_NEW | (owner << 8u); p.seed = seed; p.color = rec.k.w;
  p.shade = vec3f(0.0); p.spin = rnd(seed, 12u) * 6.2831853;
  // the orientation row: every kind carries its aspect (1 = as it always was); a SHEET is born lying within posB.z·90° of flat, any way round, turning at up to posB.x rad/s about an in-plane axis
  var n0 = vec3f(0.0, 1.0, 0.0); var w0 = vec3f(0.0);
  if (kind == P_SHEET) {
    let tilt = rec.posB.z * 1.5707963 * sqrt(rnd(seed, 13u)); let az = rnd(seed, 14u) * 6.2831853;
    n0 = vec3f(sin(tilt) * cos(az), cos(tilt), sin(tilt) * sin(az));
    let U = basisU(n0); let Wv = cross(n0, U); let wa = rnd(seed, 15u) * 6.2831853;
    w0 = (U * cos(wa) + Wv * sin(wa)) * (rec.posB.x * (0.3 + 0.7 * rnd(seed, 16u)));
  }
  p.ori = pOctEncode(n0); let pw = packOmega(w0); p.omg = pw.x; p.omgZ = pw.y;
  p.aux = pack2x16float(vec2f(max(rec.posB.y, 0.05), 0.0));
  if (rainDead) { p.age = p.life; }
  pool.parts[slot] = p;
}

// ================================================================== the sheet (game/sheetModel.ts is the CPU reference of these two — keep them in step)
/** Free flight: gravity, the anisotropic drag (through-slip × airspeed, along-slip barely), the flutter torque off the offset centre of pressure, ω damped and
 *  kept ⊥ n, n turned by ω. k0 = (g, KT, KN_LIN, KN_Q), k1.z = FLUT. `gust` = s of blast wind still carrying it (an impulse set it; 0 for every other leaf):
 *  drag and torque × (1 − GUST_K·g) against the co-moving air, g held at 1 then ramped out over the gust's last GUST_RAMP share — × exactly 1 in still air.
 *  `vAir` = the AIR's own velocity here (the wind field: game/wind.ts): every aerodynamic term is taken against the RELATIVE wind v − vAir and the air's motion
 *  added back — the gust's 'co-moving parcel' made general; vAir = 0 (no wind record names this leaf) = the equations exactly as they were, term for term. */
fn sheetAir(p: ptr<function, Particle>, n: ptr<function, vec3f>, w: ptr<function, vec3f>, gust: ptr<function, f32>, k0: vec4f, flut: f32, dt: f32, vAir: vec3f) {
  var v = (*p).vel; var nn = *n;
  let gs = *gust; let g = select(0.0, min(1.0, gs / (SHEET_GUST_TAU * SHEET_GUST_RAMP)), gs > 0.0); if (gs > 0.0) { *gust = max(0.0, gs - dt); }
  let air = 1.0 - SHEET_GUST_K * g;
  v.y -= k0.x * dt;
  v -= vAir;                                                    // into the air's frame …
  let vn = dot(v, nn);
  let vt = v - nn * vn;
  let kn = exp(-(k0.z + k0.w * length(v)) * air * dt); let kt = exp(-k0.y * air * dt);
  v = vt * kt + nn * (vn * kn);
  var ww = *w + cross(vt, nn) * (flut * (-vn) * air * dt);
  ww *= exp(-SHEET_ANG_DAMP * dt);
  ww -= nn * dot(ww, nn);
  nn = normalize(nn + cross(ww, nn) * dt);
  (*p).vel = v + vAir; *n = nn; *w = ww;                        // … and back out of it
}
/** A kicked sheet's SHAPE response (game/sheetModel.ts sheetImpulse's tail): handed the gust a kick of `kick` m/s earns, set tumbling about an in-plane axis, and — if it
 *  was LYING (`lay`) — tipped off flat toward a hashed side and lifted by its dipped edge (one already in the air keeps its attitude: a second kick must not snap it).
 *  `hseed` = what the three hashes come off (an impulse's seed, a wind wake's window hash), mixed with the slot. Shared by the impulses and the wind's wake. */
fn sheetKickShape(p: ptr<function, Particle>, slot: u32, sn: ptr<function, vec3f>, sw: ptr<function, vec3f>, gust: ptr<function, f32>, aspect: f32, kick: f32, hseed: u32, lay: bool) {
  *gust = max(*gust, SHEET_GUST_TAU * clamp((kick - SHEET_IMP_GUST0) / SHEET_IMP_GUST1, 0.0, 1.0));
  let hs = hseed ^ (slot * 0x9E3779B9u);
  let h0 = rnd(hs, 21u); let h1 = rnd(hs, 22u); let h2 = rnd(hs, 23u);
  let az = h0 * 6.2831853; let tilt = select(0.0, SHEET_IMP_TILT * (0.4 + 0.6 * h1) * min(1.0, kick / 1.5), lay);
  let side = vec3f(cos(az), 0.0, sin(az));
  var nn = *sn; var t = side - nn * dot(side, nn); let tl = length(t);
  if (tl > 1e-3) {
    t /= tl;
    if (lay) {                                             // a leaf that was LYING is tipped off flat toward the hashed side (one in the air keeps its attitude: a second kick must not snap it)
      nn = normalize(nn * cos(tilt) + t * sin(tilt));
      (*p).pos.y += sin(tilt) * (0.5 * (*p).size * max(1.0, aspect));   // (its dipped edge would otherwise start inside what it lay on)
    }
    let axis = normalize(cross(nn, t));
    var ww = *sw + axis * (SHEET_IMP_TUMBLE * min(kick, 4.0) * (0.5 + h2) * select(1.0, -1.0, h0 < 0.5));
    let wl = length(ww); if (wl > SHEET_IMP_WMAX) { ww *= SHEET_IMP_WMAX / wl; }
    ww -= nn * dot(ww, nn);
    *sn = nn; *sw = ww;
  }
}
/** Two-sided light on a sheet at P with (camera-facing) normal N: one pass over the lights scoring the FRONT (toward the eye) and BACK irradiance separately —
 *  evalLight without the cosine, split by the sign of N·L — behind the reach masks like the chips; the three strongest (front + TRANS·back) get a shadow ray, the
 *  rest are credited at UNTRACED_CREDIT. Returns front, back. */
struct SheetLight { front: vec3f, back: vec3f };
fn sheetLight(P: vec3f, N: vec3f, trans: f32, owner: u32) -> SheetLight {
  var sl: SheetLight; sl.front = vec3f(0.0); sl.back = vec3f(0.0);
  var bl = array<f32, 3>(-1.0, -1.0, -1.0); var bi = array<u32, 3>(0u, 0u, 0u);
  var bF = array<vec3f, 3>(vec3f(0.0), vec3f(0.0), vec3f(0.0)); var bB = array<vec3f, 3>(vec3f(0.0), vec3f(0.0), vec3f(0.0));
  var bL = array<vec3f, 3>(vec3f(0.0), vec3f(0.0), vec3f(0.0)); var bd = array<f32, 3>(0.0, 0.0, 0.0);
  var restF = vec3f(0.0); var restB = vec3f(0.0);
  for (var i = 0u; i < frame.numLights; i++) {
    let li = lights[i];
    let lv = lightReachLevel(i, P);
    if (lv == 0u) { continue; }
    var ev = evalLight(li, P, vec3f(0.0));
    if (!ev.ok) { continue; }
    let c = dot(N, ev.L);
    let k = select(1.0, 0.25, lv == 1u);
    let F = ev.E * (max(c, 0.0) * k); let B = ev.E * (max(-c, 0.0) * k);
    let lum = luminance(F + B * trans);
    if (lum < P_MIN_E || lum <= bl[2]) { restF += F; restB += B; continue; }
    if (bl[2] > 0.0) { restF += bF[2]; restB += bB[2]; }
    var s = 2u;
    if (lum > bl[1]) { bl[2] = bl[1]; bi[2] = bi[1]; bF[2] = bF[1]; bB[2] = bB[1]; bL[2] = bL[1]; bd[2] = bd[1]; s = 1u;
      if (lum > bl[0]) { bl[1] = bl[0]; bi[1] = bi[0]; bF[1] = bF[0]; bB[1] = bB[0]; bL[1] = bL[0]; bd[1] = bd[0]; s = 0u; } }
    bl[s] = lum; bi[s] = i; bF[s] = F; bB[s] = B; bL[s] = ev.L; bd[s] = ev.dist.x;
  }
  let traceOn = (em.flags & 1u) != 0u;
  for (var s = 0u; s < P_SHADOW_K; s++) {
    if (bl[s] <= 0.0) { continue; }
    var vis = 1.0;
    if (traceOn) { let Po = P + bL[s] * 0.02; if (occluded(Po, bL[s], bd[s] - 0.05, owner | ((lights[bi[s]].owner & 0xffu) << 8u))) { vis = 0.0; } }   // (origin nudged toward the light: either face may be the lit one)
    sl.front += bF[s] * vis; sl.back += bB[s] * vis;
  }
  let uc = select(1.0, UNTRACED_CREDIT, traceOn);
  sl.front += restF * uc; sl.back += restB * uc;
  return sl;
}

// ================================================================== shading
/** Irradiance-ish light on a small particle at P. N = the normal to shade with (up for something lying on the floor), or (0,0,0) for a tumbling chip / a puff:
 *  no cosine, × `wrap` instead (a randomly oriented convex chip intercepts about a quarter to a half of a beam per unit of its area). Every light is scored
 *  unshadowed behind the reach masks (a fixture walled off from this cell never counts; one that only gets in through a doorway counts a quarter, as the
 *  direct pass ranks it); the THREE strongest get a shadow ray when em.flags has bit 1 — the torch on the brass, the panel over it, the flash of the shot —
 *  and what is left untraced is credited at UNTRACED_CREDIT: indoors most of a cell's minor lights are behind something from a point on the floor, and
 *  crediting them whole lit chips in a dark corridor like lamps (the first captures). Also returns the strongest light's direction + irradiance (after
 *  its ray) for the casing's glint. `credit` = that untraced credit (UNTRACED_CREDIT; 0 = lit by what its rays prove and nothing else). */
const P_SHADOW_K: u32 = 3u;
const UNTRACED_CREDIT: f32 = 0.35;
const P_MIN_E: f32 = 0.003;      // a light dimmer than this at the particle (W/m², after wrap) is not worth a slot or a ray: summed untraced
struct PLight { E: vec3f, L1: vec3f, E1: vec3f };
fn particleLight(P: vec3f, N: vec3f, wrap: f32, owner: u32, credit: f32) -> PLight {
  var pl: PLight; pl.E = vec3f(0.0); pl.L1 = vec3f(0.0, 1.0, 0.0); pl.E1 = vec3f(0.0);
  var bl = array<f32, 3>(-1.0, -1.0, -1.0); var bi = array<u32, 3>(0u, 0u, 0u);
  var bE = array<vec3f, 3>(vec3f(0.0), vec3f(0.0), vec3f(0.0)); var bL = array<vec3f, 3>(vec3f(0.0), vec3f(0.0), vec3f(0.0)); var bd = array<f32, 3>(0.0, 0.0, 0.0);
  var rest = vec3f(0.0);
  let noN = all(N == vec3f(0.0));
  for (var i = 0u; i < frame.numLights; i++) {
    let li = lights[i];
    let lv = lightReachLevel(i, P);
    if (lv == 0u) { continue; }
    var ev = evalLight(li, P, N);
    if (!ev.ok) { continue; }
    ev.E *= select(1.0, wrap, noN) * select(1.0, 0.25, lv == 1u);
    let lum = luminance(ev.E);
    if (lum < P_MIN_E || lum <= bl[2]) { rest += ev.E; continue; }
    // insert into the top three (what falls off the bottom joins the untraced rest)
    if (bl[2] > 0.0) { rest += bE[2]; }
    var k = 2u;
    if (lum > bl[1]) { bl[2] = bl[1]; bi[2] = bi[1]; bE[2] = bE[1]; bL[2] = bL[1]; bd[2] = bd[1]; k = 1u;
      if (lum > bl[0]) { bl[1] = bl[0]; bi[1] = bi[0]; bE[1] = bE[0]; bL[1] = bL[0]; bd[1] = bd[0]; k = 0u; } }
    bl[k] = lum; bi[k] = i; bE[k] = ev.E; bL[k] = ev.L; bd[k] = ev.dist.x;
  }
  let traceOn = (em.flags & 1u) != 0u;
  let Po = P + select(N, vec3f(0.0, 1.0, 0.0), noN) * 0.015;
  for (var k = 0u; k < P_SHADOW_K; k++) {
    if (bl[k] <= 0.0) { continue; }
    var E = bE[k];
    if (traceOn) { if (occluded(Po, bL[k], bd[k] - 0.03, owner | ((lights[bi[k]].owner & 0xffu) << 8u))) { E = vec3f(0.0); } }
    if (k == 0u) { pl.E1 = E; pl.L1 = bL[0]; }
    pl.E += E;
  }
  pl.E += rest * select(1.0, credit, traceOn);
  return pl;
}

// ================================================================== impulses (particles_common.wgsl ImpulseRec; game/sheetModel.ts impulseKick + sheetImpulse = the CPU reference)
fn numImpulses() -> u32 { return (em.flags >> 8u) & 31u; }

// ================================================================== wind (game/wind.ts; the records ride behind the impulses — particles_common.wgsl; wind_field.wgsl is the field)
fn numWinds() -> u32 { return (em.flags >> 16u) & 31u; }
/** the three live wind knobs every wind record carries (read off the first): sheet wake speed (m/s of air over a resting leaf), sheet kick (× that speed = the hop it
 *  gets), debris coupling (the share of the air's velocity a chip's drag pulls toward) — game/wind.ts WIND; the defaults stand in with no record (spare's high half is unused) */
struct WindKnobs { wake: f32, kick: f32, debrisK: f32 };
fn windKnobs() -> WindKnobs {
  if (numWinds() == 0u) { return WindKnobs(0.35, 2.0, 0.15); }
  let r = em.imps[numImpulses()]; let a = unpack2x16float(r.seed); let b = unpack2x16float(r.spare);
  return WindKnobs(a.x, a.y, b.x);
}
/** The AIR's velocity at p this frame (m/s): Σ over the wind records that name `kind`. `surfY` = the height of the surface a RESTING particle lies on — a down-jet
 *  turns to run along it there (the desk under a diffuser deflects it as the floor would) — or ≤ −100 in flight (each jet's own floor then). */
fn windAir(p: vec3f, kind: u32, surfY: f32) -> vec3f {
  let n0 = numImpulses(); let nw = numWinds();
  var v = vec3f(0.0);
  for (var i = n0; i < n0 + nw; i++) {
    let w = em.imps[i];
    if ((w.kinds & (1u << kind)) == 0u) { continue; }
    if (((w.iflags >> 2u) & 3u) == 1u) { v += windStorm(w.bias * w.strength, vec4f(w.pos, w.radius), vec4f(w.eye, w.up), p); }
    else { v += windJet(w.pos, w.bias, w.strength, w.radius, w.eye.x, w.eye.y, w.eye.z, max(w.up, surfY), p); }
  }
  return v;
}
/** the share of the air's velocity a kind's drag pulls it toward: dust and sheets ride the air; chips a little (heavy for their size); brass and sparks not at all */
fn windCoupling(kind: u32, debrisK: f32) -> f32 { return select(select(0.0, debrisK, kind == P_DEBRIS), 1.0, kind == P_DUST || kind == P_SHEET); }
// a resting leaf in moving air (game/wind.ts WIND_FIELD repeats the three): trembles ∝ the air's speed over it, and once a WINDOW a hashed share of the leaves the
// air moves faster than the wake knob over are picked up — the share rising from 0 to PMAX as the speed doubles past the knob
const WIND_TREMBLE: f32 = 0.35;        // rad of in-plane twitch per m/s of air (± that, at 1‥2 Hz per leaf)
const WIND_WAKE_WINDOW: f32 = 0.75;    // s between wake draws
const WIND_WAKE_PMAX: f32 = 0.4;       // the most of the eligible leaves one draw picks up
const WIND_WAKE_UP: f32 = 0.45;        // upward share of the wake's kick direction (the lifted edge catches the air: a hop, not a shove into the desk)
/** Sum this frame's impulses on the particle at `p` of kind `kind` (response row em.ki[kind]) and apply them: Δv per record = strength × gain × (1 − d/r) ×
 *  (radial with its downward part dropped + up·upK·ŷ + bias), skipped under IMP_MIN_KICK and — for a record that asks — when one any-hit ray from its eye to the
 *  particle is blocked or a glass pane stands between; then wake a resting particle if the largest single kick clears the row's wake threshold (else leave it
 *  asleep and untouched), add the Δv, cap |v|; a SHEET is also handed the gust and set tumbling about an in-plane axis, and one that was LYING is tipped off flat
 *  toward a hashed side (lifted by its dipped edge — one already in the air keeps its attitude); a chip / case gets another resting angle. Returns true when
 *  anything was applied (the caller then integrates this frame as a woken particle). */
fn applyImpulses(p: ptr<function, Particle>, kind: u32, slot: u32, sn: ptr<function, vec3f>, sw: ptr<function, vec3f>, gust: ptr<function, f32>, aspect: f32, asleep: ptr<function, bool>) -> bool {
  let G = em.ki[kind];
  if (G.x <= 0.0) { return false; }
  let n = numImpulses();
  var dv = vec3f(0.0); var kick = 0.0; var kseed = 0u;
  for (var i = 0u; i < n; i++) {
    let im = em.imps[i];
    if ((im.kinds & (1u << kind)) == 0u) { continue; }
    let to = (*p).pos - im.pos; let d = length(to);
    if (d >= im.radius) { continue; }
    let s = im.strength * G.x * (1.0 - d / im.radius);
    if (s < IMP_MIN_KICK) { continue; }
    if ((im.iflags & 1u) != 0u && d > 0.5) {                 // the blast's reach: one any-hit ray from its eye, stopped a hand short of the particle (the surface it lies on is not in the way; a partition is), and the panes (in no traced structure: asked on their own)
      let ed = (*p).pos - im.eye; let el = length(ed);
      if (el > 0.12) { let erd = ed / el; if (occluded(im.eye, erd, el * 0.97 - 0.05, 0u) || glassTrace(im.eye, erd, 0.0, el).idx >= 0) { continue; } }
    }
    var radial = vec3f(0.0, 1.0, 0.0);
    if (d >= 0.02) { radial = to / d; radial.y = max(radial.y, 0.0); }   // (a charge on the floor pushes the floor's litter out along the floor, never into it)
    let js = im.seed ^ (slot * 0x9E3779B9u);                 // this particle's raggedness under this record: the kick × (1 − MAG/2 ‥ 1 + MAG/2) and a sideways share along a hashed bearing — a pile does not lift as one clump
    let sj = s * (1.0 - 0.5 * IMP_JITTER_MAG + IMP_JITTER_MAG * rnd(js, 24u)); let ja = rnd(js, 25u) * 6.2831853;
    dv += (radial + vec3f(0.0, im.up * G.y, 0.0) + im.bias) * sj + vec3f(cos(ja), 0.0, sin(ja)) * (IMP_JITTER_SIDE * sj);
    if (sj > kick) { kick = sj; kseed = im.seed; }
  }
  if (kick <= 0.0) { return false; }
  let lay = *asleep;
  if (lay) { if (kick < G.w) { return false; } *asleep = false; (*p).bits &= ~PB_ASLEEP; }
  var v = (*p).vel + dv; let sp = length(v); if (sp > G.z) { v *= G.z / sp; } (*p).vel = v;
  if (kind == P_SHEET) {
    sheetKickShape(p, slot, sn, sw, gust, aspect, kick, kseed, lay);
  } else if (kind == P_DEBRIS || kind == P_CASING) {
    (*p).spin += 2.1 * kick;                                 // it will land at another angle
  }
  return true;
}

// ================================================================== update
@compute @workgroup_size(64) fn update(@builtin(global_invocation_id) gid: vec3u) {
  let slot = slotOf3(em.win[0], em.win[1], em.rainWin, gid.x);   // (the two rings, then the rain ring's window — empty unless it rains particles)
  if (slot == 0xffffffffu) { return; }
  var p = pool.parts[slot];
  if (p.age >= p.life) { return; }                          // dead (or never written since the window last passed here: age ≥ life either way once expired)
  let dt = frame.dt;
  let kind = p.bits & PB_KIND; let owner = (p.bits >> 8u) & 255u;
  let k0 = em.kp[kind * 2u]; let k1 = em.kp[kind * 2u + 1u];
  let isNew = (p.bits & PB_NEW) != 0u;
  if (!isNew) { p.age += dt; }
  if (p.age >= p.life) { pool.parts[slot].age = p.life; return; }
  p.bits &= ~PB_NEW;
  atomicAdd(&pool.hdr[0], 1u);
  if (kind == P_RAIN) { rainStep(p, slot, isNew, dt); return; }   // the rain drop's own step (below): fall with the wind, die where it hits as a splash, lit like a chip
  var asleep = (p.bits & PB_ASLEEP) != 0u;
  let isSheet = kind == P_SHEET;
  var sn = vec3f(0.0, 1.0, 0.0); var sw = vec3f(0.0); var aspect = 1.0; var gust = 0.0;   // the sheet's normal / angular velocity / shape / blast wind (decoded once, written back below)
  if (isSheet) { sn = pOctDecode(p.ori); sw = unpackOmega(p.omg, p.omgZ); let ax = unpack2x16float(p.aux); aspect = ax.x; gust = ax.y; }
  // this frame's impulses (a stun charge, a round beside it, a thump on the floor): kick + wake before the step, so a woken leaf flies this very frame — nothing at all on the
  // frames without any, and never the particles born this frame (the event that queued the impulse is the one that threw them: it does not throw them twice)
  if (numImpulses() > 0u && !isNew && dt > 0.0) { if (applyImpulses(&p, kind, slot, &sn, &sw, &gust, aspect, &asleep)) { atomicAdd(&pool.hdr[4], 1u); } }
  // ---- WIND (game/wind.ts): the AIR's velocity here this frame off the wind records behind the impulses — nothing on frames without any (one shift and a branch). A RESTING
  // leaf reads it as deflected along the surface it lies on, trembles by it, and once a window a hashed share of the leaves it moves fast enough over hop up into it; whatever
  // flies takes its drag against the moving air below
  var vAir = vec3f(0.0); let wk = windKnobs();
  let windy = numWinds() > 0u && !isNew && dt > 0.0;
  if (windy) { vAir = windAir(p.pos, kind, select(-1e9, p.pos.y - 0.012, asleep)) * windCoupling(kind, wk.debrisK); }
  if (windy && isSheet && asleep) {
    let spd = length(vAir);
    if (spd > 0.03) {
      let hs = pcg(p.seed ^ 0xA5117E5u); let om = 6.0 + 8.0 * rnd(hs, 31u); let ph = rnd(hs, 32u) * 6.2831853;   // each leaf its own rate (1‥2 Hz) and phase
      let amp = WIND_TREMBLE * min(spd, 1.0);
      p.spin += amp * om * cos(om * frame.time + ph) * dt;                                                       // twitches about its normal (its yaw takes the whole tremble: whatever an uneven dt leaves of a zero-mean twitch is another resting yaw, never a leaf tilted off what it lies on — the normal is left alone)
      let win = floor(frame.time / WIND_WAKE_WINDOW);
      if (win != floor((frame.time - dt) / WIND_WAKE_WINDOW)) {                                                 // a wake draw this frame (the same frame for every leaf; each leaf its own hash of the window)
        let wh = pcg(p.seed ^ (u32(i32(win)) * 0x9E3779B9u) ^ (slot * 0x85EBCA6Bu));
        let spEff = spd * (0.8 + 0.4 * rnd(wh, 33u));                                                            // (the air over THIS leaf: a pile is not one leaf)
        let pw = clamp((spEff - wk.wake) / max(wk.wake, 0.05), 0.0, 1.0) * WIND_WAKE_PMAX;
        if (spEff > wk.wake && rnd(wh, 34u) < pw) {
          asleep = false; p.bits &= ~PB_ASLEEP;
          let kick = spEff * wk.kick;
          var kd = vec3f(vAir.x, 0.0, vAir.z); let kl = length(kd); kd = select(vec3f(0.0), kd / kl, kl > 1e-4);
          p.vel += normalize(kd + vec3f(0.0, WIND_WAKE_UP, 0.0)) * kick;                                          // along the air over it, edge lifted into it …
          sheetKickShape(&p, slot, &sn, &sw, &gust, aspect, kick, wh, true);                                       // … tipped off flat, set turning (the impulse's own shape response)
          atomicAdd(&pool.hdr[5], 1u);
        }
      }
    }
  }
  if (!asleep && !isNew && dt > 0.0) {
    if (isSheet) {
      sheetAir(&p, &sn, &sw, &gust, k0, k1.z, dt, vAir);
      p.spin += (f32(p.seed & 1023u) / 511.5 - 1.0) * SHEET_SPIN_MAX * min(1.0, length(p.vel - vAir)) * dt;   // turns about its normal while it moves through the air, each its own way; still at rest
    } else {
      p.vel.y -= k0.x * dt;
      p.vel = vAir + (p.vel - vAir) * exp(-k0.y * dt);   // drag against the MOVING air (vAir = 0: × e^−k·dt exactly as it was)
    }
    let mv = p.vel * dt; let len = length(mv);
    if (len > 1e-6) {
      var moved = false;
      if (kind != P_DUST && (em.flags & 2u) != 0u) {
        let rd = mv / len;
        var pad = p.size * 0.5 + 0.002;
        if (isSheet) { let cr = dot(rd, sn); pad = 0.004 + 0.85 * sqrt(max(0.0, 1.0 - cr * cr)) * (0.5 * p.size * max(1.0, aspect)); }   // its edge leads by up to half its length when it slides edge-on; flat-on it is paper-thin
        let hit = traceClosest(p.pos, rd, len + pad, owner);
        if (hit.idx >= 0) {
          if (hit.inside) { pool.parts[slot].age = p.life; atomicAdd(&pool.hdr[3], 1u); return; }   // born inside a wall (a port pressed to the plaster): nothing to show
          atomicAdd(&pool.hdr[2], 1u);
          p.pos += rd * max(0.0, hit.t - pad);
          var n = hit.n;
          let vn = dot(p.vel, n);
          if (isSheet) {   // paper does not bounce: an up face lays it toward flat and rubs the slide (game/sheetModel.ts sheetGround); a wall lets it slide down, half aligned to it
            let sgn = select(-1.0, 1.0, dot(sn, n) >= 0.0);
            if (vn < 0.0) { p.vel -= n * (vn * 1.05); }
            if (n.y > 0.6) { p.vel *= 0.6; sn = normalize(mix(sn, n * sgn, 0.7)); sw *= 0.3; }
            else { p.vel *= 0.85; sn = normalize(mix(sn, n * sgn, 0.35)); sw *= 0.6; }
            if (length(p.vel) < k1.x && n.y > 0.6) { asleep = true; p.bits |= PB_ASLEEP; p.vel = vec3f(0.0); sw = vec3f(0.0); sn = n * sgn; gust = 0.0; p.pos += n * (0.001 + 0.0012 * f32(slot % 5u)); }   // (a hair of stacking order: two sheets settling on one spot do not fight for the same plane)
          } else {
            if (vn < 0.0) { let vt = p.vel - n * vn; p.vel = vt * k0.w - n * (vn * k0.z); }
            p.spin += 1.7;                                                                                    // lands at another angle
            if (length(p.vel) < k1.x && n.y > 0.6) { asleep = true; p.bits |= PB_ASLEEP; p.vel = vec3f(0.0); p.pos += n * 0.001; }
          }
          p.bits |= PB_BOUNCED;
          moved = true;
        }
      }
      if (!moved) { p.pos += mv; }
    }
    if (kind == P_DUST) { p.pos.y = max(p.pos.y, p.size * 0.35); p.vel.y = select(p.vel.y, max(p.vel.y, 0.0), p.pos.y <= p.size * 0.35); }   // a puff spreads over the floor, it does not sink into it
    if (p.pos.y < -0.2 || any(p.pos < WORLD_MIN) || any(p.pos > WORLD_MAX)) { pool.parts[slot].age = p.life; return; }   // out of the world: gone
  } else if (asleep) {
    atomicAdd(&pool.hdr[1], 1u);
    // resting: is what it rests on still there? (a leaf swung away, a chair shoved) — one short ray down every 16th frame, staggered by slot
    if (((frame.frameIdx + slot) & 15u) == 0u && dt > 0.0) {
      if (!occluded(p.pos + vec3f(0.0, 0.02, 0.0), vec3f(0.0, -1.0, 0.0), 0.02 + p.size * 0.5 + 0.03, owner)) { p.bits &= ~PB_ASLEEP; asleep = false; }
    }
  }
  // ---- shade
  let u = p.age / p.life;
  if (kind == P_SPARK) {
    p.shade = sparkRadiance(u, k1.y, k1.w);
  } else if (isSheet) {
    // the face the eye sees: light falling on it, TRANS of what falls on the other face (a leaf against a torch glows), the cache's ambient — facing up at rest,
    // the sphere's mean in the air (both faces)
    let albedo = unpackRgb8(p.color);
    let N = select(-sn, sn, dot(sn, frame.camPos - p.pos) >= 0.0);
    let sl = sheetLight(p.pos, N, k1.w, owner);
    var amb: vec3f;
    if (asleep) { amb = diceIrradiance(p.pos + vec3f(0.0, c0Spacing().x, 0.0), N); }
    else { amb = diceMeanRadiance(p.pos + vec3f(0.0, 0.25, 0.0)) * 3.14159265 * (0.5 + 0.5 * k1.w); }
    amb *= frame.indirectScale;
    p.shade = albedo * (sl.front + sl.back * k1.w + amb) * (1.0 / 3.14159265);
    p.ori = pOctEncode(sn); let pw = packOmega(sw); p.omg = pw.x; p.omgZ = pw.y; p.aux = pack2x16float(vec2f(aspect, gust));
  } else {
    let albedo = unpackRgb8(p.color);
    var N = vec3f(0.0); var wrap = 0.4;
    if (kind == P_DUST) { wrap = k0.z; }                   // a puff scatters whatever crosses it toward the eye from every side (k0.z = params.dust 'wrap', 0.5: half a beam's worth reads right next to the wall it came out of)
    else if (asleep) { N = vec3f(0.0, 1.0, 0.0); }
    let pl = particleLight(p.pos, N, wrap, owner, UNTRACED_CREDIT);
    // ambient off the radiance cache: a resting chip reads the dice like a floor point does (a probe spacing up, facing up); a flying chip half the sphere's mean;
    // a puff the WHOLE sphere's (it is lit from behind as much as from the front) — which is what lets gypsum dust show pale in a dim corridor at all
    var amb: vec3f;
    if (asleep) { amb = diceIrradiance(p.pos + vec3f(0.0, c0Spacing().x, 0.0), vec3f(0.0, 1.0, 0.0)); }
    else { amb = diceMeanRadiance(p.pos + vec3f(0.0, 0.25, 0.0)) * 3.14159265 * select(0.5, 0.9 * k0.w, kind == P_DUST); }   // (k0.w = params.dust 'ambient' ×, 1)
    amb *= frame.indirectScale;                             // the composite scales the bounce on screen by this: sit next to the floor it lies on, not above it
    var L = albedo * (pl.E + amb) * (1.0 / 3.14159265);
    if (kind == P_CASING) {                                 // the glint: Blinn-Phong off the strongest light toward the eye; tumbling in flight the normal spins (it twinkles), at rest it is up
      let V = normalize(frame.camPos - p.pos);
      var Nn = vec3f(0.0, 1.0, 0.0);
      if (!asleep) { let a = p.spin + p.age * 31.0; Nn = normalize(vec3f(cos(a), 0.8, sin(a))); }
      let H = normalize(pl.L1 + V);
      let s = pow(max(dot(Nn, H), 0.0), 40.0);
      L += pl.E1 * albedo * (s * 6.0) + albedo * amb * 0.3;   // metal: the highlight is tinted, and a little more of the room in it
    }
    p.shade = L;
  }
  pool.parts[slot] = p;
}

// ================================================================== the rain drop (EXPERIMENT exp/particle-rain — game/rainFx.ts recycles them; particles_draw.wgsl rainVertex draws them)
// v2 SHEETS: a smooth 2-D value noise the births are thinned by — (1 + A·n) ÷ (1 + A), n ∈ [−1, 1] at (q − offset) ÷ len (em.rainCfgE: amplitude, scale, the offset the CPU carries downwind)
fn rainHash2(i: vec2i, k: u32) -> f32 { return rnd(pcg((bitcast<u32>(i.x) * 0x8DA6B343u) ^ (bitcast<u32>(i.y) * 0xD8163841u) ^ 0x51EE7u), k); }
fn rainBand(q: vec2f) -> f32 {
  let E5 = em.rainCfgE; let A = clamp(E5.x, 0.0, 0.95);
  if (A <= 0.0) { return 1.0; }
  let u = (q - E5.zw) / max(E5.y, 0.5);
  let i = vec2i(floor(u)); let f = fract(u); let t = f * f * (3.0 - 2.0 * f);
  let n = mix(mix(rainHash2(i, 1u), rainHash2(i + vec2i(1, 0), 1u), t.x), mix(rainHash2(i + vec2i(0, 1), 1u), rainHash2(i + vec2i(1, 1), 1u), t.x), t.y) * 2.0 - 1.0;
  return (1.0 + A * clamp(n * 1.6, -1.0, 1.0)) / (1.0 + A);   // (× 1.6, clamped: the noise rarely reaches its ends — this way the sheets have clear cores and clear gaps)
}
// v2 LOOK: a rain drop is WATER smeared over its shutter — it scatters a light toward the eye by a PHASE FUNCTION, not a grey constant: an isotropic floor (rainCfg.x) + a forward lobe
// (refraction through the drop throws most of the light on within a few tens of degrees: rainCfg.y × Henyey-Greenstein(g = rainCfg.z), 4π-normalised so iso + fwd = 1 keeps v1's
// all-angle calibration) + the STRAND GLINT of the water cylinder along the streak's axis T: it mirrors a light where the half vector H stands square to T (a normalised 1-D lobe in
// T·H of width rainCfgB.x + the emitter's angular half-size — Karis' area-light widening, which is also the energy bound: a mirror shows a lamp at the lamp's own radiance — × Schlick
// Fresnel for water), capped per light at rainCfgB.y. mu = cos of the scattering angle: 1 = the eye looks INTO the light through the drop (it flares), −1 = the light is behind the eye (dim).
fn hgPhase(mu: f32, g: f32) -> f32 { let d = max(1.0 + g * g - 2.0 * g * mu, 1e-4); return (1.0 - g * g) / (d * sqrt(d)); }
fn rainPhase(L: vec3f, V: vec3f, T: vec3f, wid: f32, glint: bool) -> f32 {
  let C = em.rainCfg; let B = em.rainCfgB;
  var ph = C.x + C.y * hgPhase(-dot(L, V), clamp(C.z, 0.0, 0.98));
  if (glint && C.w > 0.0) {
    let hw = L + V; let hl = dot(hw, hw);
    if (hl > 1e-6) {
      let H = hw * inverseSqrt(hl);
      let sn = dot(T, H);                                        // sin of H's angle off the plane square to the streak: 0 = the cylinder has a normal that mirrors L into V
      let a = clamp(B.x + wid, 0.02, 1.0);
      let D = exp(-(sn * sn) / (a * a)) / (1.7724539 * a);      // normalised 1-D Gaussian in that sine (∫ D ds = 1: widening never adds energy)
      let f1 = 1.0 - clamp(dot(V, H), 0.0, 1.0); let f2 = f1 * f1;
      let F = 0.02 + 0.98 * f2 * f2 * f1;                       // Schlick, water (F0 0.02): faint head-on, strong at the grazing half-angles a backlit streak makes
      ph += min(C.w * D * F, B.y);
    }
  }
  return ph;
}
/** What a drop / a splash at P sends toward the eye at V (unit, drop → eye), streak axis T: particleLight's loop (reach masks, the three strongest by luminance SHADOW-RAYED — the streaks glow
 *  inside the sodium lamp's cone and the building's shadow cuts them, which the lattice cannot do — the rest at UNTRACED_CREDIT, isotropic) with each kept light weighted by the drop's phase
 *  toward the eye after its ray; plus the storm's lit sky (a stroke: frame.weatherB.rgb, everywhere at once). × RAIN_P_GAIN × the kind's brightness × the look's gain. `glint`: the strand
 *  term on (a falling streak) / off (a crown: no axis to speak of). ONE RULE STRICTER than the chips': a light whose source is UNDER A ROOF (rainRoofed: indoors, below the ceiling —
 *  a corridor panel, an exit sign's area light, a torch or a muzzle flash in a room; the carried and transient ones have no reach mask at all) never takes the untraced credit — rain
 *  is only ever outdoors, so such a light reaches a drop through an opening or not at all, and if it matters it is one of the three and gets its ray; a wall between them can no longer
 *  tint the rain outside it a third of the way. The lot's own lights (lamps, the moon, a stroke, the exterior fixtures) are in the open and count exactly as before. */
fn rainShadeV(P: vec3f, V: vec3f, T: vec3f, k1: vec4f, glint: bool) -> vec3f {
  var bl = array<f32, 3>(-1.0, -1.0, -1.0); var bi = array<u32, 3>(0u, 0u, 0u);
  var bE = array<vec3f, 3>(vec3f(0.0), vec3f(0.0), vec3f(0.0)); var bL = array<vec3f, 3>(vec3f(0.0), vec3f(0.0), vec3f(0.0)); var bd = array<f32, 3>(0.0, 0.0, 0.0); var bw = array<f32, 3>(0.0, 0.0, 0.0);
  var bR = array<vec3f, 3>(vec3f(0.0), vec3f(0.0), vec3f(0.0));   // each kept light's UNTRACED share should a stronger one push it out of the three: its E in the open, nothing from under a roof
  var rest = vec3f(0.0); var restAll = vec3f(0.0);                 // (restAll: every light past the three, whole — only for the rays-off measuring mode, 'all unshadowed and whole' as it says)
  for (var i = 0u; i < frame.numLights; i++) {
    let li = lights[i];
    let lv = lightReachLevel(i, P);
    if (lv == 0u) { continue; }
    var ev = evalLight(li, P, vec3f(0.0));
    if (!ev.ok) { continue; }
    ev.E *= select(1.0, 0.25, lv == 1u);
    let lum = luminance(ev.E);
    let unt = select(ev.E, vec3f(0.0), li.kind != 2u && rainRoofed(li.pos));   // (a directional light has no source point to be indoors with)
    if (lum < P_MIN_E || lum <= bl[2]) { rest += unt; restAll += ev.E; continue; }
    if (bl[2] > 0.0) { rest += bR[2]; restAll += bE[2]; }
    var k = 2u;
    if (lum > bl[1]) { bl[2] = bl[1]; bi[2] = bi[1]; bE[2] = bE[1]; bL[2] = bL[1]; bd[2] = bd[1]; bw[2] = bw[1]; bR[2] = bR[1]; k = 1u;
      if (lum > bl[0]) { bl[1] = bl[0]; bi[1] = bi[0]; bE[1] = bE[0]; bL[1] = bL[0]; bd[1] = bd[0]; bw[1] = bw[0]; bR[1] = bR[0]; k = 0u; } }
    bl[k] = lum; bi[k] = i; bE[k] = ev.E; bL[k] = ev.L; bd[k] = ev.dist.x; bw[k] = li.radius / (2.0 * max(ev.dist.x, 0.05)); bR[k] = unt;   // (bw: the emitter's angular half-size: the glint's widening — 0 for the moon)
  }
  let traceOn = (em.flags & 1u) != 0u;
  let Po = P + vec3f(0.0, 0.015, 0.0);
  var E = vec3f(0.0);
  for (var k = 0u; k < P_SHADOW_K; k++) {
    if (bl[k] <= 0.0) { continue; }
    if (traceOn) { if (occluded(Po, bL[k], bd[k] - 0.03, (lights[bi[k]].owner & 0xffu) << 8u)) { continue; } }
    E += bE[k] * rainPhase(bL[k], V, T, bw[k], glint);
  }
  E += select(restAll, rest * UNTRACED_CREDIT, traceOn);
  return (E + frame.weatherB.xyz) * (RAIN_P_GAIN * k1.w * max(em.rainCfgB.z, 0.0));
}
/** One rain drop's frame. Falling: gravity + drag toward the AIR's velocity — the wind field's air here (game/wind.ts → windAir: the storm outdoors easing in off the facade and gusting,
 *  a draught through an open door; × rainCfgD.w) — terminal = air + 9 m/s down, what the sky drops are born at; a drip off an eave is handed in slow and gets there inside a second,
 *  and every drop answers a gust over 1 ÷ drag ≈ 0.9 s as a real one does — then the swept segment through the trace grid AND the character capsules (traceClosest): a hit on anything
 *  visible ends the fall and the drop BECOMES its splash at the true landing point (roof, bonnet, pallet, Sam's shoulder) — PB_ASLEEP, the surface normal in `ori`, the landing time
 *  in `spin`, its life cut to the splash's — lit there once; a hit on an invisible box (the NoPrimary roof the camera looks through) or a drift into the roof's dry column / out of the
 *  world ends it unseen. Splashing: nothing moves; the splat grows the crown off (age − spin). SHADE (v2): this frame's at the head; LAST frame's — the point a frame's fall up
 *  today's streak, lit exactly as it was then — kept as the TAIL in omg / omgZ (f16 × 3; a rain drop has no angular velocity to keep there) for the splat to run head → tail. */
fn rainStep(pin: Particle, slot: u32, isNew: bool, dt: f32) {
  var p = pin;
  let k0 = em.kp[P_RAIN * 2u]; let k1 = em.kp[P_RAIN * 2u + 1u];
  if ((p.bits & PB_ASLEEP) != 0u) { atomicAdd(&pool.hdr[1], 1u); pool.parts[slot] = p; return; }   // a splash in progress: only its clock runs (the caller advanced it)
  if (!isNew && dt > 0.0) {
    var vAir = vec3f(0.0);
    if (numWinds() > 0u) { vAir = windAir(p.pos, P_RAIN, -1e9) * em.rainCfgD.w; }
    p.vel.y -= k0.x * dt;
    p.vel = vAir + (p.vel - vAir) * exp(-k0.y * dt);
    let mv = p.vel * dt; let len = length(mv);
    if (len > 1e-6) {
      let rd = mv / len;
      if ((em.flags & 2u) != 0u) {
        let hit = traceClosest(p.pos, rd, len + 0.01, 0u);
        if (hit.idx >= 0) {
          if (hit.inside) { pool.parts[slot].age = p.life; atomicAdd(&pool.hdr[3], 1u); return; }
          let X = p.pos + rd * hit.t;
          var seen = true;
          if (hit.idx != CAPSULE_HIT) { seen = (boxGeo[u32(hit.idx)].flags & BOX_NOPRIMARY) == 0u; }
          if (!seen || !rainOutdoors(X.xz) || (hit.idx != CAPSULE_HIT && hit.n.y < 0.35)) { pool.parts[slot].age = p.life; return; }   // the invisible roof / its dry column / a WALL met at a graze on the wind (water sheets down a wall, it does not crown on it): gone without a splash
          atomicAdd(&pool.hdr[2], 1u);
          p.pos = X + hit.n * 0.004; p.vel = vec3f(0.0);
          p.bits |= PB_ASLEEP | PB_BOUNCED;
          p.spin = p.age;                                   // when it landed: the crown's clock is age − spin
          p.life = min(p.life, p.age + max(k1.x, 0.02));    // and it lives the splash's length more — never past the life it was filed with (the CPU retires its slot by that)
          p.ori = pOctEncode(hit.n);
          let Ps = p.pos + hit.n * 0.02;
          p.shade = rainShadeV(Ps, normalize(frame.camPos - Ps), hit.n, k1, false);   // lit where it landed, toward the eye (in the lamp's cone it glitters; in the building's shadow it does not)
          pool.parts[slot] = p; return;
        }
      }
      p.pos += mv;
    }
    if (!rainOutdoors(p.pos.xz) || p.pos.y < -0.2 || any(p.pos < WORLD_MIN) || any(p.pos > WORLD_MAX)) { pool.parts[slot].age = p.life; return; }   // drifted over the roof's dry column / out of the world: gone
  }
  let V = normalize(frame.camPos - p.pos);
  let tl = length(p.vel); let T = select(vec3f(0.0, -1.0, 0.0), p.vel / max(tl, 1e-6), tl > 1e-3);
  let head = rainShadeV(p.pos, V, T, k1, true);
  var tail = select(p.shade, head, isNew);                  // last frame's head = this frame's tail (a new drop has none: head both ends)
  tail = mix(head, tail, clamp(em.rainCfgB.w, 0.0, 1.0));
  p.omg = pack2x16float(tail.xy); p.omgZ = pack2x16float(vec2f(tail.z, 0.0));
  p.shade = head;
  pool.parts[slot] = p;
}
