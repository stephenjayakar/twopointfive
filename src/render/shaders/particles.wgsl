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
@group(1) @binding(3) var airTex: texture_2d<f32>;    // SNOW GRAINS: the air over the level's floor (render/airField.ts: rg = its velocity m/s along x / z, b = lift m/s, a = 1 in open air) — a 1×1 stand-in on a page with none; read only under SNOW_GRAINS
struct GrainCfg { a: vec4f, b: vec4f, c: vec4f, d: vec4f, e: vec4f, f: vec4f, g: vec4f };               // render/particles.ts grainCfg: a = the wind's speed with no gust, the radius they live in, a grain's weight, × the light; b = the small eddies' share, × the lift, × the field's velocity (the blown snow's speed), 1 = there is a field; c = A BLAST throwing the loose snow this frame (game/snowBlast.ts): its place x, z, the radius it throws from (m), the share of the lying grains it takes a second (0 = none); d = how fast they leave it, outward and up (m/s); e = how a grain is DRAWN (game/snowFx.ts SNOWGRAINS shutter / dash / tail: s of its motion drawn, the longest dash in grain widths, how far its tail fades) — the step packs it into the grain for the draw; e.w = how far the WISPS stand back from the view's middle while the grains run (SNOWGRAINS.wispsBack: 1 = thinned to nothing inside the grains' radius, 0 = everywhere)
@group(1) @binding(4) var<uniform> grain: GrainCfg;

// ---- hash RNG: pcg on (seed, particle index, stream)
fn pcg(v: u32) -> u32 { let s = v * 747796405u + 2891336453u; let w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u; return (w >> 22u) ^ w; }
fn rnd(seed: u32, k: u32) -> f32 { return f32(pcg(seed ^ (k * 0x9E3779B9u)) >> 8u) / 16777216.0; }

fn basisU(dn: vec3f) -> vec3f { let up = select(vec3f(0.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), abs(dn.y) > 0.9); return normalize(cross(up, dn)); }

// ================================================================== sparks off surfaces (em.flags bit 24 — render/particles.ts sparkBounce; off = a spark's touch as it was)
// A burning fragment that meets a wall, the floor, the ceiling or a desk comes back off it: a hashed share of its closing speed returned (the kind's restitution × SPARK_E_GAIN
// × 1 ∓ half SPARK_E_JIT, so no two leave a wall alike), the slide rubbed by what the touch pressed it with (Coulomb, μ = (1 − the kind's keep) × SPARK_MU_K: a burning grain
// skids, it does not grip — a hard hit scrubs some of it, a fragment skittering along the floor under gravity alone runs on), the way out thrown off the mirror line by the
// surface's grain in proportion to how square it struck (a graze keeps its line), and the rest of that step spent along the way out (the update kernel). And its FIRST stretch —
// the part of the birth frame the emit kernel pre-integrates — is swept like every later one: a spark born a hand from a partition meets it instead of starting behind it.
const SPARK_BOUNCE_BIT: u32 = 0x1000000u;
const SPARK_E_GAIN: f32 = 2.4;       // × the kind's restitution (0.25 → 0.6 of the closing speed back)
const SPARK_E_JIT: f32 = 0.7;
const SPARK_E_MAX: f32 = 0.95;       // whatever the panel's slider says, a touch never adds speed
const SPARK_MU_K: f32 = 0.4;         // × (1 − the kind's keep) (0.7 → μ 0.12)
const SPARK_SCATTER: f32 = 0.3;      // half-width of the jitter added to the unit way out, at a square hit
const SPARK_MIN_OUT: f32 = 0.08;     // a square hit's way out keeps at least this much of the normal: never back into what it struck
fn sparkBounceOn() -> bool { return (em.flags & SPARK_BOUNCE_BIT) != 0u; }
fn sparkBounce(vel: vec3f, n: vec3f, seed: u32, salt: u32) -> vec3f {
  let vn = dot(vel, n); if (vn >= 0.0) { return vel; }
  let k = em.kp[P_SPARK * 2u];
  let hs = seed ^ (salt * 0x85EBCA6Bu);
  let e = min(SPARK_E_MAX, k.z * SPARK_E_GAIN * (1.0 - 0.5 * SPARK_E_JIT + SPARK_E_JIT * rnd(hs, 51u)));
  var vt = vel - n * vn; let vtl = length(vt);
  if (vtl > 1e-5) { vt *= max(0.0, 1.0 - (1.0 - k.w) * SPARK_MU_K * (1.0 + e) * (-vn) / vtl); }
  let out = vt - n * (vn * e); let sp = length(out);
  if (sp < 1e-4) { return out; }
  let inc = clamp(-vn / max(length(vel), 1e-5), 0.0, 1.0);
  var d = normalize(out / sp + (vec3f(rnd(hs, 52u), rnd(hs, 53u), rnd(hs, 54u)) - 0.5) * (2.0 * SPARK_SCATTER * inc));
  let lo = SPARK_MIN_OUT * inc; let dn = dot(d, n); if (dn < lo) { d = normalize(d + n * (lo - dn)); }
  return d * sp;
}

// ================================================================== emit
@compute @workgroup_size(64) fn emit(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= em.totalNew) { return; }
  var r = 0u;
  for (var k = 0u; k < em.numRecs; k++) { let rc = em.recs[k]; if (i >= rc.first && i < rc.first + rc.count) { r = k; break; } }
  let rec = em.recs[r];
  let j = i - rec.first;                                   // index within the record
  let kind = rec.k.x & 15u; let owner = (rec.k.x >> 8u) & 255u; let ring = (rec.k.x >> 16u) & 3u; let ours = (rec.k.x >> 18u) & 1u;
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
    let grainRec = SNOW_GRAINS && snowNow() && rec.posB.y > 2.5;   // (a GRAIN's record, game/snowFx.ts: aspect 3 — it is placed by its own step each time it is picked up, so no point is thrown for it here and nothing thins it)
    var ok = grainRec; var q2 = rec.pos.xz;
    let wispRec = SNOW_WISPS && snowNow() && rec.posB.y > 1.5 && rec.posB.y < 2.5;   // (a WISP's record, game/snowFx.ts: aspect 2 — each try must also land in a gust patch, and the flakes' curtains do not thin it)
    let puffRec = SNOW_WISPS && wispRec && ((rec.k.w >> 16u) & 255u) == 0u;   // (… and a BLAST's puff of powder, game/snowBlast.ts: a wisp record with no gust length — thrown where the blast was, whatever the gusts and the view's middle are doing, and born running out from it)
    let skyRec = snowNow() && !wispRec && !grainRec && abs(rec.posB.x - frame.weatherE.z) < 0.5 && distance(rec.pos.xz, frame.weatherE.xy) < 2.0;   // (the falling snow's own record: its disc IS the view's — a kick's, a blast's throw's is a small one of its own, and what they throw up is lifted off snow that lies)
    for (var t = 0u; t < 32u && !ok; t++) {
      let rr = sqrt(rnd(seed, 20u + t * 3u)); let th = rnd(seed, 21u + t * 3u) * 6.2831853;
      q2 = rec.pos.xz + vec2f(cos(th), sin(th)) * (rr * rec.posB.x);
      let rim = 1.0 - smoothstep(0.7, 1.0, rr);
      var open = false; var keep = rim;
      if (skyRec) { open = flakeOpen(q2); if (snowPast() > 0.0 && pastWorld(vec3f(q2.x, 0.0, q2.y))) { keep = min(rim, 1.0 - smoothstep(PAST_RIM_IN, PAST_RIM_OUT, rr)); } }   // (the SKY's flake may be born in the air past the level's rim — SNOW_LOOK.past, particles_common.wgsl snowPast — where the fall thins sooner toward the disc's edge: those flakes show only over the picture's near part, and every one out there is one fewer in the level)
      else { open = rainOutdoors(q2); }
      ok = open && rnd(seed, 22u + t * 3u) < keep;
      if (SNOW_WISPS) { if (wispRec && ok && !puffRec && !snowOneAir()) { ok = rnd(seed, 200u + t) < wispGust(q2, f32((rec.k.w >> 16u) & 255u) * (32.0 / 255.0)); } }
      if (SNOW_WISPS) { if (SNOW_GRAINS) { if (wispRec && ok && !puffRec && grain.b.w > 0.5 && !snowOneAir()) { ok = rnd(seed, 300u + t) < mix(1.0, smoothstep(0.55, 1.0, distance(q2, frame.weatherE.xy) / max(grain.a.y, 1.0)), clamp(grain.e.w, 0.0, 1.0)) && length(airAt(q2).xy) >= WISP_LEE_DIE * grain.a.x; } } }   // (with the grains running the wisps stand back from the view's middle: the veil is the far look — and none is thrown into air the field holds dead, where its step would fade it at once)
    }
    if (SNOW_WISPS) { if (SNOW_GRAINS) { if (wispRec && ok && !puffRec && snowOneAir()) { let Aq = airAt(q2); ok = Aq.w > 0.5 && rnd(seed, 400u) < smoothstep(grain.f.y, max(grain.f.z, grain.f.y + 1e-3), length(Aq.xy)); } } }   // ONE AIR: a wisp is snow LIFTED off the ground, and only where the air over that ground runs fast enough to lift it — asked once, of the point the record threw: as many are born over a square metre as its air is fast, none in a lull or a lee
    if (ok && !wispRec && !grainRec) { ok = rnd(seed, 18u) < rainBand(q2); }           // v2 SHEETS: the births thinned on a value noise carried downwind (game/rainFx.ts files (1 + amp) × as many, so the mean holds) — curtains of denser rain cross the lot
    pos = vec3f(q2.x, rec.pos.y - rec.q.y * rnd(seed, 19u), q2.y);
    vel = normalize(rec.dir) * sp;
    if (numWinds() > 0u) { vel += windAir(pos, kind, -1e9) * em.rainCfgD.w; }   // v2 WIND: born moving with the AIR where it enters the slab (a drop has fallen through this wind for seconds already) — the storm's vector, its gust, its lee off the facade
    if (SNOW_WISPS) { if (wispRec) { vel = wispAir(pos, seed, rec.k.w); } }   // a wisp is born running with the wind
    if (SNOW_WISPS) { if (puffRec) { let o2 = q2 - rec.pos.xz; let ol = length(o2); vel += vec3f(o2.x, 0.0, o2.y) * (sp / max(ol, 0.05)) * (0.3 + 0.7 * rnd(seed, 17u)); } }   // … a blast's puff also out from the blast, at the record's speed
    rainDead = !ok;
  } else {                                                 // puff: uniform direction, speed skewed slow
    let z = rnd(seed, 1u) * 2.0 - 1.0; let th = rnd(seed, 2u) * 6.2831853; let sr = sqrt(max(0.0, 1.0 - z * z));
    vel = vec3f(cos(th) * sr, z * 0.6 + rec.q.y, sin(th) * sr) * (sp * sqrt(rnd(seed, 4u)));
  }
  vel += rec.vadd;
  if (rec.q.w > 0.0) {
    var jit = (vec3f(rnd(seed, 6u), rnd(seed, 7u), rnd(seed, 8u)) - 0.5) * (2.0 * rec.q.w);
    if ((SHARDS_ON && kind == P_SHARD)) { let dj = normalize(rec.dir); jit -= dj * (dot(jit, dj) * 0.9); }   // a SHARD's scatter lies in the pane it leaves (dir = the pane's normal): born across the fragment's face, not in a ball round its centre
    pos += jit;
  }
  var p: Particle;
  let life = rec.p.y * (1.0 - rec.q.x + 2.0 * rec.q.x * rnd(seed, 9u));
  let size = rec.p.z * (1.0 - rec.q.z + 2.0 * rec.q.z * rnd(seed, 10u));
  // born somewhere inside this frame: pre-integrate a random fraction of dt (the update kernel skips its step for PB_NEW), so 400 sparks leave as a spray
  let f = rnd(seed, 11u) * frame.dt;
  let g = em.kp[kind * 2u].x;
  vel.y -= g * f;
  p.pos = pos + vel * f; p.age = f;
  p.vel = vel; p.life = max(life, 0.02);
  p.size = max(size, 0.0005); p.bits = kind | PB_NEW | (owner << 8u) | (ours * PB_OURS); p.seed = seed; p.color = rec.k.w;
  if (kind == P_SPARK && sparkBounceOn() && (em.flags & 2u) != 0u) {   // sparks off surfaces: the birth frame's stretch swept (see sparkBounce)
    let mv0 = vel * f; let len0 = length(mv0);
    if (len0 > 1e-6) {
      let rd0 = mv0 / len0; let pad0 = p.size * 0.5 + 0.002;
      let hit0 = traceClosest(pos, rd0, len0 + pad0, owner);
      if (hit0.idx >= 0 && !hit0.inside) { p.pos = pos + rd0 * hit0.t + hit0.n * pad0; p.vel = sparkBounce(vel, hit0.n, seed, 1u); p.bits |= PB_BOUNCED; atomicAdd(&pool.hdr[2], 1u); }
    }
  }
  p.shade = vec3f(0.0); p.spin = rnd(seed, 12u) * 6.2831853;
  // the orientation row: every kind carries its aspect (1 = as it always was); a SHEET is born lying within posB.z·90° of flat, any way round, turning at up to posB.x rad/s about an in-plane axis
  var n0 = vec3f(0.0, 1.0, 0.0); var w0 = vec3f(0.0);
  if (kind == P_SHEET || (SHARDS_ON && kind == P_SHARD)) {
    let tilt = rec.posB.z * 1.5707963 * sqrt(rnd(seed, 13u)); let az = rnd(seed, 14u) * 6.2831853;
    n0 = vec3f(sin(tilt) * cos(az), cos(tilt), sin(tilt) * sin(az));
    if ((SHARDS_ON && kind == P_SHARD)) {                                   // a SHARD starts in the plane of its pane — its normal within posB.z·90° of dir — and tumbles from there
      let dn0 = normalize(rec.dir); let Us = basisU(dn0); let Ws = cross(dn0, Us);
      n0 = normalize(dn0 * cos(tilt) + (Us * cos(az) + Ws * sin(az)) * sin(tilt));
    }
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
// (the walk: pLight mode 1, below)

// ================================================================== the glass shard (game/shardModel.ts is the CPU reference of the flight and the touch — keep them in step)
/** Free flight: gravity, drag by size (k0.y is the rate at SHARD_REF_SIZE: area ÷ mass ∝ 1 ÷ size — the fines are stopped by the air, a palm-sized piece is not), a tumble
 *  the air barely damps; n turned by ω, the part of ω along n turns the outline. */
fn shardAir(p: ptr<function, Particle>, n: ptr<function, vec3f>, w: ptr<function, vec3f>, k0: vec4f, dt: f32) {
  var v = (*p).vel;
  v.y -= k0.x * dt;
  v *= exp(-min(SHARD_DRAG_MAX, k0.y * SHARD_REF_SIZE / max((*p).size, 0.0015)) * dt);
  let ww = *w * exp(-SHARD_ANG_DAMP * dt);
  let nn = normalize(*n + cross(ww, *n) * dt);
  (*p).spin += dot(ww, nn) * dt;
  (*p).vel = v; *n = nn; *w = ww;
}
/** What a fragment at P with (eye-facing) normal N shows of the lights: `spec` = each light MIRRORED toward the eye V off its face — GGX D of width alpha0 + the emitter's
 *  angular half-size (Karis' widening: a mirror shows a lamp at the lamp's own radiance, no brighter) × Schlick Fresnel for glass ÷ 4 N·V, capped at SHARD_GLINT_CAP per light,
 *  only from lights on the eye's side of it — and `scatter` = the irradiance its body and cut edges send on diffusely (both faces: a quarter whatever the angle + the cosine's
 *  share). One pass over the lights behind the reach masks like the chips; the `rays` strongest of the two kept (by what they would put on screen) get a shadow ray, everything
 *  else is credited at UNTRACED_CREDIT. A fragment costs at most two rays where a chip costs three. */
// (the walk: pLight mode 2, below)

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
// (the walk: pLight mode 0, below)

/** The three light walks of a particle (the sheet's, the fragment's and the small particle's, described above, as they were statement for statement) as ONE body, so update() asks for the light at ONE call
 *  (the compile: DXC — Chrome's compiler on Windows — inlines each call it meets, and the three walks were three copies of the light loop and the shadow ray). mode 0 =
 *  the small particle's walk (the comment above P_SHADOW_K; wrap, credit); 1 = the sheet's (trans = wrap); 2 = the fragment's (V, alpha0, rays, wS). Returns a = E / front / scatter,
 *  b = (0) / back / spec, and for mode 0 the strongest light's direction and irradiance after its ray (L1, E1). */
struct PLit { a: vec3f, b: vec3f, L1: vec3f, E1: vec3f };
fn pLight(mode: u32, P: vec3f, N: vec3f, wrap: f32, owner: u32, credit: f32, V: vec3f, alpha0: f32, rays: u32, wS: f32) -> PLit {
  var pl: PLit; pl.a = vec3f(0.0); pl.b = vec3f(0.0); pl.L1 = vec3f(0.0, 1.0, 0.0); pl.E1 = vec3f(0.0);
  let K = select(P_SHADOW_K, 2u, mode == 2u);
  var bl = array<f32, 3>(-1.0, -1.0, -1.0); var bi = array<u32, 3>(0u, 0u, 0u);
  var bA = array<vec3f, 3>(vec3f(0.0), vec3f(0.0), vec3f(0.0)); var bB = array<vec3f, 3>(vec3f(0.0), vec3f(0.0), vec3f(0.0));
  var bL = array<vec3f, 3>(vec3f(0.0), vec3f(0.0), vec3f(0.0)); var bd = array<f32, 3>(0.0, 0.0, 0.0);
  var restA = vec3f(0.0); var restB = vec3f(0.0);
  let noN = all(N == vec3f(0.0));
  let nv = max(dot(N, V), 0.1);
  for (var i = 0u; i < frame.numLights; i++) {
    let li = lights[i];
    let lv = lightReachLevel(i, P);
    if (lv == 0u) { continue; }
    var ev = evalLight(li, P, select(vec3f(0.0), N, mode == 0u));   // (the sheet and the shard score without the cosine: they take the sign of N·L themselves)
    if (!ev.ok) { continue; }
    var A = vec3f(0.0); var B = vec3f(0.0); var lum = 0.0; var floorE = P_MIN_E;
    if (mode == 0u) {
      ev.E *= select(1.0, wrap, noN) * select(1.0, 0.25, lv == 1u);
      A = ev.E; lum = luminance(ev.E);
    } else if (mode == 1u) {
      let c = dot(N, ev.L);
      let k = select(1.0, 0.25, lv == 1u);
      A = ev.E * (max(c, 0.0) * k); B = ev.E * (max(-c, 0.0) * k);
      lum = luminance(A + B * wrap);
    } else {
      let k = select(1.0, 0.25, lv == 1u);
      let c = dot(N, ev.L);
      A = ev.E * ((0.25 + 0.75 * abs(c)) * k);
      if (c > 0.0) {
        let H = normalize(ev.L + V);
        let nh = max(dot(N, H), 0.0);
        let a = clamp(alpha0 + li.radius / (2.0 * max(ev.dist.x, 0.05)), 0.03, 1.0); let a2 = a * a;
        let dd = nh * nh * (a2 - 1.0) + 1.0;
        let f1 = 1.0 - clamp(dot(V, H), 0.0, 1.0); let f2 = f1 * f1;
        B = ev.E * (min(a2 / (3.14159265 * dd * dd) * (SHARD_F0 + (1.0 - SHARD_F0) * f2 * f2 * f1) / (4.0 * nv), SHARD_GLINT_CAP) * k);
      }
      lum = luminance(A) * wS + luminance(B);                         // what it would show of this light: wS = its diffuse share × the 0.3 the eye is sent of it (0.03 in the air)
      floorE = P_MIN_E * 0.03;
    }
    // insert into the top K (what falls off the bottom joins the untraced rest)
    let last = K - 1u;
    if (lum < floorE || lum <= bl[last]) { restA += A; restB += B; continue; }
    if (bl[last] > 0.0) { restA += bA[last]; restB += bB[last]; }
    var s = last;
    if (K == 3u) {
      if (lum > bl[1]) { bl[2] = bl[1]; bi[2] = bi[1]; bA[2] = bA[1]; bB[2] = bB[1]; bL[2] = bL[1]; bd[2] = bd[1]; s = 1u;
        if (lum > bl[0]) { bl[1] = bl[0]; bi[1] = bi[0]; bA[1] = bA[0]; bB[1] = bB[0]; bL[1] = bL[0]; bd[1] = bd[0]; s = 0u; } }
    } else if (lum > bl[0]) { bl[1] = bl[0]; bi[1] = bi[0]; bA[1] = bA[0]; bB[1] = bB[0]; bL[1] = bL[0]; bd[1] = bd[0]; s = 0u; }
    bl[s] = lum; bi[s] = i; bA[s] = A; bB[s] = B; bL[s] = ev.L; bd[s] = ev.dist.x;
  }
  let traceOn = (em.flags & 1u) != 0u;
  let Pp = P + select(N, vec3f(0.0, 1.0, 0.0), noN) * 0.015;
  for (var s = 0u; s < K; s++) {
    if (bl[s] <= 0.0) { continue; }
    // the shadow ray (ONE call for the three walks): a small particle's from just off it along N (up when it has none), a sheet's and a fragment's from a hair toward the
    // light (either face may be the lit one); a fragment past its `rays` strongest is credited at UNTRACED_CREDIT instead
    let ray = traceOn && (mode != 2u || s < rays);
    var occ = false;
    if (ray) { occ = occluded(select(P + bL[s] * 0.02, Pp, mode == 0u), bL[s], select(bd[s] - 0.05, bd[s] - 0.03, mode == 0u), owner | ((lights[bi[s]].owner & 0xffu) << 8u)); }
    if (mode == 0u) {
      var E = bA[s];
      if (occ) { E = vec3f(0.0); }
      if (s == 0u) { pl.E1 = E; pl.L1 = bL[0]; }
      pl.a += E;
    } else {
      var vis = 1.0;
      if (traceOn) { if (ray) { if (occ) { vis = 0.0; } } else { vis = UNTRACED_CREDIT; } }
      pl.a += bA[s] * vis; pl.b += bB[s] * vis;
    }
  }
  if (mode == 0u) { pl.a += restA * select(1.0, credit, traceOn); }
  else { let uc = select(1.0, UNTRACED_CREDIT, traceOn); pl.a += restA * uc; pl.b += restB * uc; }
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
/** the STORM record's air at p: the two rectangles it carries — or, ROOF BY ROOF (iflags bit 5; game/wind.ts WX_OWN.wind on a level of three or four roofs), those
 *  two as the level's first two roofs + the Frame's packed third and fourth, the very footprints rainOutdoors cuts the rain by (wxRect of 0 or 1 has no width: no roof) */
fn windStormOf(w: ImpulseRec, p: vec3f) -> vec3f {
  if ((w.iflags & 32u) != 0u) { return windStormRoofs(w.bias * w.strength, vec4f(w.pos, w.radius), vec4f(w.eye, w.up), wxRect(frame.cardCfg.y), wxRect(frame.cardCfg.z), p); }
  return windStorm(w.bias * w.strength, vec4f(w.pos, w.radius), vec4f(w.eye, w.up), p);
}
/** The AIR's velocity at p this frame (m/s): Σ over the wind records that name `kind`. `surfY` = the height of the surface a RESTING particle lies on — a down-jet
 *  turns to run along it there (the desk under a diffuser deflects it as the floor would) — or ≤ −100 in flight (each jet's own floor then). */
fn windAir(p: vec3f, kind: u32, surfY: f32) -> vec3f {
  let n0 = numImpulses(); let nw = numWinds();
  var v = vec3f(0.0);
  for (var i = n0; i < n0 + nw; i++) {
    let w = em.imps[i];
    if ((w.kinds & (1u << kind)) == 0u) { continue; }
    if (((w.iflags >> 2u) & 3u) == 1u) { v += windStormOf(w, p); }
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
  if (lay) { if (kick < G.w) { return false; } *asleep = false; (*p).bits &= ~(PB_ASLEEP | PB_OURS | PB_KEPT); }   // (woken where it lay: whoever kicked it, it is no longer the team's own doing — the fog cuts it again where nobody sees)
  var v = (*p).vel + dv; let sp = length(v); if (sp > G.z) { v *= G.z / sp; } (*p).vel = v;
  if (kind == P_SHEET) {
    sheetKickShape(p, slot, sn, sw, gust, aspect, kick, kseed, lay);
  } else if (kind == P_DEBRIS || kind == P_CASING) {
    (*p).spin += 2.1 * kick;                                 // it will land at another angle
  } else if ((SHARDS_ON && kind == P_SHARD)) {                              // glass litter kicked up: set tumbling again about a hashed in-plane axis (it will glint on the way and land at another tilt)
    let hs = kseed ^ (slot * 0x9E3779B9u); let az = rnd(hs, 26u) * 6.2831853;
    let U = basisU(*sn); let Wv = cross(*sn, U);
    *sw = (U * cos(az) + Wv * sin(az)) * min(SHARD_SPIN_MAX, SHARD_SPIN_K * kick);
    if (lay) { (*p).pos.y += 0.004; }
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
  let slept0 = asleep;                                  // (as the frame found it: with the resting look on, a shard is re-lit on the frame it comes to rest)
  let isSheet = kind == P_SHEET; let isShard = (SHARDS_ON && kind == P_SHARD);
  var sn = vec3f(0.0, 1.0, 0.0); var sw = vec3f(0.0); var aspect = 1.0; var gust = 0.0;   // the sheet's normal / angular velocity / shape / blast wind (decoded once, written back below)
  if (isSheet || isShard) { sn = pOctDecode(p.ori); sw = unpackOmega(p.omg, p.omgZ); let ax = unpack2x16float(p.aux); aspect = ax.x; gust = ax.y; }   // (a SHARD carries the same row: normal, tumble, aspect — its gust half stays 0)
  // this frame's impulses (a stun charge, a round beside it, a thump on the floor): kick + wake before the step, so a woken leaf flies this very frame — nothing at all on the
  // frames without any, and never the particles born this frame (the event that queued the impulse is the one that threw them: it does not throw them twice)
  if (numImpulses() > 0u && !isNew && dt > 0.0) { if (applyImpulses(&p, kind, slot, &sn, &sw, &gust, aspect, &asleep)) { atomicAdd(&pool.hdr[4], 1u); } }
  // ---- WIND (game/wind.ts): the AIR's velocity here this frame off the wind records behind the impulses — nothing on frames without any (one shift and a branch). A RESTING
  // leaf reads it as deflected along the surface it lies on, trembles by it, and once a window a hashed share of the leaves it moves fast enough over hop up into it; whatever
  // flies takes its drag against the moving air below
  var vAir = vec3f(0.0); let wk = windKnobs();
  let windy = numWinds() > 0u && !isNew && dt > 0.0;
  let ember = emberIs(kind, p.color);   // (an ember off a fire goes with the air as a puff of dust does — the wind's records name the kinds they move, and no record names a spark — where a spark does not: particles_common.wgsl EMBER)
  if (windy) { vAir = windAir(p.pos, select(kind, P_DUST, ember), select(-1e9, p.pos.y - 0.012, asleep)) * select(windCoupling(kind, wk.debrisK), 1.0, ember); }
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
          asleep = false; p.bits &= ~(PB_ASLEEP | PB_OURS | PB_KEPT);
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
    } else if (isShard) {
      shardAir(&p, &sn, &sw, k0, dt);
    } else {
      p.vel.y -= k0.x * dt;
      if (emberIs(kind, p.color)) { let ph = f32(p.seed & 1023u) * 0.00614; p.vel += vec3f(EMBER_SWIRL * sin(p.age * 5.1 + ph), k0.x + EMBER_LIFT, EMBER_SWIRL * cos(p.age * 4.3 + ph * 1.7)) * dt; }   // EMBER (game/fire.ts): lighter than the hot air it left the fire in — it climbs, wandering, until it burns out
      if (kind == P_DUST && steamIs(p.color)) { p.vel.y += 2.0 * k0.x * dt; }   // STEAM (snowBreath.ts): warm breath is lighter than the air — the puff's own slow settling, the other way up
      p.vel = vAir + (p.vel - vAir) * exp(-k0.y * dt);   // drag against the MOVING air (vAir = 0: × e^−k·dt exactly as it was)
    }
    let mv = p.vel * dt; let len = length(mv);
    if (len > 1e-6) {
      var moved = false;
      if (kind != P_DUST && (em.flags & 2u) != 0u) {
        let rd = mv / len;
        var pad = p.size * 0.5 + 0.002;
        if (isSheet) { let cr = dot(rd, sn); pad = 0.004 + 0.85 * sqrt(max(0.0, 1.0 - cr * cr)) * (0.5 * p.size * max(1.0, aspect)); }   // its edge leads by up to half its length when it slides edge-on; flat-on it is paper-thin
        if (isShard) { let cr = dot(rd, sn); pad = 0.003 + 0.5 * sqrt(max(0.0, 1.0 - cr * cr)) * (0.5 * p.size * max(1.0, aspect)); }    // (likewise, a corner leads)
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
          } else if (isShard) {   // glass: a lively hop of its own height each touch, the slide thrown to a hashed side by the corner it struck (the skitter), a fresh tumble; slow enough on an up face and it lies down a little off flat (game/shardModel.ts shardTouch)
            let hs = p.seed ^ (bitcast<u32>(p.age) * 0x85EBCA6Bu);
            let h0 = rnd(hs, 41u); let h1 = rnd(hs, 42u); let h2 = rnd(hs, 43u); let h3 = rnd(hs, 44u);
            let onFloor = n.y > 0.6;
            if (vn < 0.0) {
              var vt = p.vel - n * vn;
              if (onFloor) {
                let e = k0.z * (1.0 - 0.5 * SHARD_E_JIT + SHARD_E_JIT * h0);
                let a = (h1 * 2.0 - 1.0) * SHARD_SKITTER;
                vt = vt * cos(a) + cross(n, vt) * sin(a);
                p.vel = vt * k0.w - n * (vn * e);
              } else { p.vel = vt * SHARD_WALL_KEEP - n * (vn * SHARD_WALL_E); }
            }
            let spd = length(p.vel);
            if (onFloor && spd < k1.x) {
              let tilt = SHARD_REST_TILT * h2 * h2; let az = h3 * 6.2831853;
              let U = basisU(n); let Wv = cross(n, U);
              sn = normalize(n * cos(tilt) + (U * cos(az) + Wv * sin(az)) * sin(tilt));
              asleep = true; p.bits |= PB_ASLEEP; p.vel = vec3f(0.0); sw = vec3f(0.0);
              p.pos += n * (0.0015 + 0.5 * p.size * sin(tilt));                                                // (its propped edge off the floor, its low one on it)
            } else if (onFloor) {
              let az = h2 * 6.2831853; let U = basisU(sn); let Wv = cross(sn, U);
              sw = (U * cos(az) + Wv * sin(az)) * (min(SHARD_SPIN_MAX, SHARD_SPIN_K * spd) * (0.4 + 0.6 * h3));
            } else { sw *= 0.5; }
          } else {
            if (vn < 0.0) {
              if (kind == P_SPARK && sparkBounceOn()) {
                p.pos += rd * (hit.t - max(0.0, hit.t - pad)) + n * pad;   // off the face along its NORMAL (the shared line above stands off along the ray: a graze ends a hair from the face, and the way out below would start inside it)
                p.vel = sparkBounce(p.vel, n, p.seed, bitcast<u32>(p.age));
                // the rest of this step along the way out (swept once more: a corner) — a fragment sliding on the floor travels, it is not held at each frame's touch
                let mv2 = p.vel * (dt * (1.0 - clamp((hit.t - pad) / len, 0.0, 1.0))); let len2 = length(mv2);
                if (len2 > 1e-5) {
                  let rd2 = mv2 / len2; let hit2 = traceClosest(p.pos, rd2, len2 + pad, owner);
                  if (hit2.idx < 0) { p.pos += mv2; }
                  else if (!hit2.inside) { p.pos += rd2 * hit2.t + hit2.n * pad; p.vel = sparkBounce(p.vel, hit2.n, p.seed, bitcast<u32>(p.age) ^ 0x5BD1E995u); }
                }
              }
              else { let vt = p.vel - n * vn; p.vel = vt * k0.w - n * (vn * k0.z); }
            }
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
      if (!occluded(p.pos + vec3f(0.0, 0.02, 0.0), vec3f(0.0, -1.0, 0.0), 0.02 + p.size * 0.5 + 0.03, owner)) { p.bits &= ~(PB_ASLEEP | PB_OURS | PB_KEPT); asleep = false; }
      else if (fogKeptOn() && (p.bits & PB_KEPT) == 0u && fogSeenBins(p.pos) >= 0.5) { p.bits |= PB_KEPT; }   // (FOG.kept: at rest where the team sees it — it stays in the picture when they look away, until it is woken; the draw asks the row too, so with the row off a marked one is cut as ever)
    }
  }
  // ---- shade
  let u = p.age / p.life;
  if (kind == P_SPARK) {
    if (emberIs(kind, p.color)) { p.shade = emberRadiance(u, p.color, k1.w, p.seed, p.age); } else { p.shade = sparkRadiance(u, k1.y, k1.w); }
  } else {   // the sheet, the glass fragment and the rest: their three light walks are ONE pLight call (above) — set up per kind, then the kind's own shading
    let lightDue = !isShard || !asleep || isNew || (!slept0 && (em.flags & 8u) != 0u) || ((frame.frameIdx + slot) & 3u) == 0u;   // (a fragment at rest is re-lit every 4th frame — below)
    var mode = 0u; let albedo = unpackRgb8(p.color); var N = vec3f(0.0); var wrap = 0.4; var V = vec3f(0.0); var rough = 0.0; var kS = k1.w; var wS = 0.03; var rays = 0u;
    if (isSheet) {
      // the face the eye sees: light falling on it, TRANS of what falls on the other face (a leaf against a torch glows), the cache's ambient — facing up at rest,
      // the sphere's mean in the air (both faces)
      mode = 1u; wrap = k1.w;
      N = select(-sn, sn, dot(sn, frame.camPos - p.pos) >= 0.0);
    } else if (isShard) {
      // GLASS: what it mirrors toward the eye off its own face (the lights' lobes, the room's mean radiance by Fresnel) + the little its body and cut edges scatter, tinted.
      // In the air it turns every frame, so it flashes as its face sweeps a light past the eye; at rest it is re-lit every 4th frame (staggered by slot: litter holds
      // still, and a torch crossing it is three frames late at worst) with ONE shadow ray, flying with two.
      mode = 2u;
      if (lightDue) {
        V = normalize(frame.camPos - p.pos);
        N = select(-sn, sn, dot(sn, V) >= 0.0);
        rough = k1.z * (0.6 + 0.8 * f32((p.seed >> 12u) & 255u) / 255.0);                                    // no two fracture faces are equally clean
        // (round five) at rest it is a little drift of broken glass — a frost, not a clear face: more of what falls on it goes on diffusely, so the lights are ranked by
        // that share too and the two strongest are both shadow-rayed (a drift under a desk must not glow by the panels' untraced credit)
        let frosted = asleep && (em.flags & 8u) != 0u;
        rays = select(2u, 1u, asleep);
        if (frosted) { kS = max(kS, shardRestScatter(p.size, p.seed)); wS = kS * 0.3; rays = 2u; }
      }
    } else {
      if (kind == P_DUST) { wrap = k0.z; }                   // a puff scatters whatever crosses it toward the eye from every side (k0.z = params.dust 'wrap', 0.5: half a beam's worth reads right next to the wall it came out of)
      else if (asleep) { N = vec3f(0.0, 1.0, 0.0); }
    }
    var pl: PLit;
    if (lightDue) { pl = pLight(mode, p.pos, N, wrap, owner, UNTRACED_CREDIT, V, rough, rays, wS); }
    if (isSheet) {
      var amb: vec3f;
      if (asleep) { amb = diceIrradiance(p.pos + vec3f(0.0, c0Spacing().x, 0.0), N); }
      else { amb = diceMeanRadiance(p.pos + vec3f(0.0, 0.25, 0.0)) * 3.14159265 * (0.5 + 0.5 * k1.w); }
      amb *= frame.indirectScale;
      p.shade = albedo * (pl.a + pl.b * k1.w + amb) * (1.0 / 3.14159265);
      p.ori = pOctEncode(sn); let pw = packOmega(sw); p.omg = pw.x; p.omgZ = pw.y; p.aux = pack2x16float(vec2f(aspect, gust));
    } else if (isShard) {
      if (lightDue) {
        let f1 = 1.0 - clamp(dot(N, V), 0.0, 1.0); let f2 = f1 * f1;
        let Fv = SHARD_F0 + (1.0 - SHARD_F0) * f2 * f2 * f1;
        let env = diceMeanRadiance(p.pos + vec3f(0.0, 0.25, 0.0));
        var amb: vec3f;
        if (asleep) { amb = diceIrradiance(p.pos + vec3f(0.0, c0Spacing().x, 0.0), vec3f(0.0, 1.0, 0.0)); } else { amb = env * 3.14159265; }
        p.shade = pl.b + env * (Fv * frame.indirectScale) + albedo * (pl.a + amb * frame.indirectScale) * (kS / 3.14159265);
      }
      p.ori = pOctEncode(sn); let pw = packOmega(sw); p.omg = pw.x; p.omgZ = pw.y; p.aux = pack2x16float(vec2f(aspect, 0.0));
    } else {
      // ambient off the radiance cache: a resting chip reads the dice like a floor point does (a probe spacing up, facing up); a flying chip half the sphere's mean;
      // a puff the WHOLE sphere's (it is lit from behind as much as from the front) — which is what lets gypsum dust show pale in a dim corridor at all
      var amb: vec3f;
      if (asleep) { amb = diceIrradiance(p.pos + vec3f(0.0, c0Spacing().x, 0.0), vec3f(0.0, 1.0, 0.0)); }
      else { amb = diceMeanRadiance(p.pos + vec3f(0.0, 0.25, 0.0)) * 3.14159265 * select(0.5, 0.9 * k0.w, kind == P_DUST); }   // (k0.w = params.dust 'ambient' ×, 1)
      amb *= frame.indirectScale;                             // the composite scales the bounce on screen by this: sit next to the floor it lies on, not above it
      var L = albedo * (pl.a + amb) * (1.0 / 3.14159265);
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
  if (snowNow()) { E += (frame.skyHorizon + frame.skyZenith) * (0.5 * 3.14159265 * em.rainCfg.x * em.rainCfg.w); }   // a FLAKE is a white diffuse scatterer under the whole sky (a drop of water is not: it shows only what lights it): the dome's irradiance, by its isotropic share × rainCfg.w (the glint's weight slot — a flake has no glint: game/snowFx.ts SNOWFX.skyK) — so snow falling through a dark yard is still seen against it
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
  if (SNOW_GRAINS) { if (grainIs(pin.aux)) { grainStep(pin, slot, isNew, dt); return; } }   // a grain of blown snow near the view (below): its own step
  if (SNOW_WISPS) { if (wispIs(pin.aux)) { wispStep(pin, slot, isNew, dt); return; } }   // a wisp of blowing snow (below): its own step
  var p = pin;
  var landed = false; var sP = vec3f(0.0); var sV = vec3f(0.0); var sT = vec3f(0.0);   // a drop that lands this step: where its crown is lit, toward the eye, its normal (ONE rainShadeV call below for the crown and the head — DXC inlines each call it meets)
  let k0 = em.kp[P_RAIN * 2u]; let k1 = em.kp[P_RAIN * 2u + 1u];
  if ((p.bits & PB_ASLEEP) != 0u) { atomicAdd(&pool.hdr[1], 1u); pool.parts[slot] = p; return; }   // a splash in progress: only its clock runs (the caller advanced it)
  if (!isNew && dt > 0.0) {
    var vAir = vec3f(0.0);
    if (numWinds() > 0u) { vAir = windAir(p.pos, P_RAIN, -1e9) * em.rainCfgD.w; }
    if (SNOW_GRAINS) { if (snowNow() && snowOneAir()) { vAir = snowAir(p.pos, vAir); } }   // ONE AIR: among the walls a flake falls through the simulated field (slack in a lee, fast through a gap), over them through the open wind
    var grav = k0.x;
    if (snowNow()) {   // A FLAKE (a level built for snow, game/snowFx.ts): it rides the air almost whole (the drag is the CPU's: gravity ÷ a metre and a bit a second), so its own
      // slow FLUTTER is added to the air it is dragged toward — a sway of rainCfgB.x m/s at rainCfgB.y rad/s (the glint's two slots: a flake has none), each flake its own phase
      // and rate off its seed — and no two fall alike (gravity × 0.8‥1.2 off the seed). Its fall is integrated EXACTLY (toward the
      // terminal velocity, air − gravity ∕ drag): the rain's step-then-drag loses a fifth of a slow fall at 20 fps, and a flake filed with the life of a 1.25 m/s fall must come down in it
      let h1 = f32(p.seed & 1023u) * (1.0 / 1023.0); let h2 = f32((p.seed >> 10u) & 1023u) * (1.0 / 1023.0);
      let wr = em.rainCfgB.y * (0.6 + h2); let ph = h1 * 6.2831853;
      vAir += vec3f(sin(frame.time * wr + ph), 0.0, cos(frame.time * wr * 0.81 + ph * 1.7)) * em.rainCfgB.x;
      grav *= 0.8 + 0.4 * h2;
    }
    if (snowNow()) { let vT = vAir - vec3f(0.0, grav / max(k0.y, 1e-3), 0.0); p.vel = vT + (p.vel - vT) * exp(-k0.y * dt); }
    else { p.vel.y -= grav * dt; p.vel = vAir + (p.vel - vAir) * exp(-k0.y * dt); }
    let mv = p.vel * dt; let len = length(mv);
    if (len > 1e-6) {
      let rd = mv / len;
      if ((em.flags & 2u) != 0u && !(snowNow() && snowPast() > 0.0 && pastWorld(p.pos) && pastWorld(p.pos + mv))) {   // (a flake whose whole step is past the level's rim has nothing to meet: no ray is cast for it. One that comes in over the rim is traced from where it is — the trace starts at the world's face)
        let hit = traceClosest(p.pos, rd, len + 0.01, 0u);
        if (hit.idx >= 0) {
          if (hit.inside) { pool.parts[slot].age = p.life; atomicAdd(&pool.hdr[3], 1u); return; }
          if (snowNow()) {
            var skips = false;
            if (SNOW_GRAINS) { if (snowOneAir() && hit.idx != CAPSULE_HIT && hit.n.y > 0.5 && grain.f.w > 0.0) {   // ONE AIR: where the air at the ground is fast enough to lift snow, a flake that comes down into it is not let lie — it skips on along the ground with that air (the fine snow a gust runs over a yard is the snow that is falling in it)
              let Xs = p.pos + rd * hit.t; let As = airAt(Xs.xz); let ss = length(As.xy); let kk = u32(p.age * 240.0);
              if (As.w > 0.5 && rnd(p.seed, 500u + kk) < grain.f.w * smoothstep(grain.f.y, max(grain.f.z, grain.f.y + 1e-3), ss)) {
                skips = true;
                p.pos = Xs + hit.n * 0.012;
                p.vel = vec3f(As.x, 0.0, As.y) * em.rainCfgD.w + vec3f(0.0, (0.5 + 1.2 * rnd(p.seed, 501u + kk)) * min(ss / max(grain.f.y, 1e-3), 1.6), 0.0);
              }
            } }
            if (!skips) { pool.parts[slot].age = p.life; return; }   // a flake lands and is one with the snow it lands on: no crown, nothing drawn after
          }
          if (snowNow()) { pool.parts[slot] = p; return; }   // (… the skipping flake: put back on the ground's air, lit as it was — the rest below is a drop's)
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
          landed = true; sP = p.pos + hit.n * 0.02; sV = normalize(frame.camPos - sP); sT = hit.n;   // lit where it landed, toward the eye (in the lamp's cone it glitters; in the building's shadow it does not) — below
        }
      }
      if (!landed) {
      p.pos += mv;
      if (snowNow()) {   // THE WRAP: a flake is in the air for seconds, so one that leaves the square round the view's disc (frame.weatherE: centre xz, radius — game/snowFx.ts) is
        // carried to the far side of it at its own height: the view moves, or cuts, and the air it comes to is already snowing
        let E = frame.weatherE;
        if (E.z > 0.0) { let d = p.pos.xz - E.xy; if (abs(d.x) > E.z || abs(d.y) > E.z) { let w = (fract((d + E.z) / (2.0 * E.z)) * 2.0 - 1.0) * E.z; p.pos = vec3f(E.x + w.x, p.pos.y, E.y + w.y); } }
      }
      }
    }
    if (!landed) {
    var gone = p.pos.y < -0.2;
    if (snowNow() && snowPast() > 0.0) { gone = gone || !flakeOpen(p.pos.xz) || p.pos.y > WORLD_MAX.y; }   // (SNOW_LOOK.past: a flake's air goes on past the level's rim, to where the view's disc wraps it)
    else { gone = gone || !rainOutdoors(p.pos.xz) || any(p.pos < WORLD_MIN) || any(p.pos > WORLD_MAX); }
    if (gone) { pool.parts[slot].age = p.life; return; }   // drifted over the roof's dry column / out of the world: gone
    }
  }
  var glint = false;
  if (!landed) {
    sP = p.pos; sV = normalize(frame.camPos - p.pos);
    let tl = length(p.vel); sT = select(vec3f(0.0, -1.0, 0.0), p.vel / max(tl, 1e-6), tl > 1e-3);
    glint = !snowNow();   // (a flake has no strand to glint along)
  }
  let sh = rainShadeV(sP, sV, sT, k1, glint);
  if (landed) { p.shade = sh; pool.parts[slot] = p; return; }   // (the crown)
  let head = sh;
  var tail = select(p.shade, head, isNew);                  // last frame's head = this frame's tail (a new drop has none: head both ends)
  tail = mix(head, tail, clamp(em.rainCfgB.w, 0.0, 1.0));
  p.omg = pack2x16float(tail.xy); p.omgZ = pack2x16float(vec2f(tail.z, 0.0));
  p.shade = head;
  pool.parts[slot] = p;
}

// ================================================================== a wisp of blowing snow (game/snowFx.ts SNOWWISPS; particles_draw.wgsl wispVertex draws it)
// Spindrift: fine snow the wind runs low over open ground. A rain-kind particle filed with aspect 2 (particles_common.wgsl wispIs), on a snow level's page with the
// switch on (the prelude's SNOW_WISPS — every statement here is dead code otherwise). PICTURE ONLY: nothing reads a wisp.
const WISP_DRAG: f32 = 5.0;          // 1/s: how fast a wisp takes the air's velocity (it IS the air's load: a fifth of a second)
const WISP_TOP: f32 = 0.8;           // m: a wisp lifted over this is gone (they are the ground's)
const WISP_MEANDER_LEN: f32 = 3.5;   // m: the scale of the crosswind sway they snake on
const WISP_GROUND_AIR: f32 = 0.55;   // the wind field's height share at the ground (wind_field.wgsl windStorm) — the gust patches run downwind at the wisps' own speed
/** the wind the wisps run on, at the ground, in the open: the STORM record's own vector (game/wind.ts) × the wind field's ground share. By itself this is NOT the
 *  field: with the roof-by-roof rule off the field keeps the storm out of the bounding box of a level's roofs, and on the pass that box holds the open yard between
 *  the houses, where spindrift belongs — a wisp then keeps to open ground by its own rule (rainOutdoors: born and alive only where no roof is over it; walls stop it
 *  by the trace). With the rule on (WX_OWN.wind) the field reaches the yard and every reader below takes this × wispShare: the field's own air where the wisp is. */
fn wispWind() -> vec3f {
  let n0 = numImpulses(); let nw = numWinds();
  for (var i = n0; i < n0 + nw; i++) { let w = em.imps[i]; if (((w.iflags >> 2u) & 3u) == 1u && (w.kinds & (1u << P_RAIN)) != 0u) { return w.bias * (w.strength * WISP_GROUND_AIR); } }
  return vec3f(0.0);
}
/** ONE SNOW IN ONE AIR (game/snowFx.ts SNOW_LOOK.oneAir → grain.f.x; the field must be there: grain.b.w). The maintainer, 10-15: the blown grains "look like the
 *  flakes but seem to behave differently. we should probably just unify those systems … makes the air not feel physical as a fluid". With it on there is no grain
 *  kind: every snow particle — a falling flake, a wisp lifted off the ground — is carried by snowAir below, and what the wind lifts it lifts by one rule (grain.f.yz). */
fn snowOneAir() -> bool { if (SNOW_GRAINS) { return grain.f.x > 0.5 && grain.b.w > 0.5; } return false; }
/** past the level's rim there is no air field: a flake out there (SNOW_LOOK.past) is in the open wind — 0 inside the world, 1 from a metre and a half out */
fn pastRimAir(p: vec3f) -> f32 { return smoothstep(0.0, 1.5, max(max(WORLD_MIN.x - p.x, p.x - WORLD_MAX.x), max(WORLD_MIN.z - p.z, p.z - WORLD_MAX.z))); }
/** the air a snow particle at `p` is carried by. AMONG THE WALLS (under grain.g.x m) it is the simulated field's (airAt: the ground's air over the level's plan —
 *  round a wall's end, slack in its lee, fast through a gap) raised by the storm's own height profile (wind_field.wgsl windStorm: 0.55 at the ground → 1 at 2.5 m,
 *  so in the open, far from any wall, this IS `free`), with the field's lift; OVER THEM (above grain.g.y) it is `free`, the open wind the caller read (windAir × its
 *  own factor); between, the two blended. The field is 2D: one layer over the floor, the height is this profile's. */
fn snowAir(p: vec3f, free: vec3f) -> vec3f {
  if (SNOW_GRAINS) {
    let A = airAt(p.xz);
    let h = (0.55 + 0.45 * clamp(p.y / 2.5, 0.0, 1.0)) / 0.55;
    let b = max(smoothstep(grain.g.x, max(grain.g.y, grain.g.x + 0.01), p.y), pastRimAir(p));
    let low = vec3f(A.x * h, A.z * grain.g.z, A.y * h) * em.rainCfgD.w;
    return mix(low, free, b);
  }
  return free;
}
const WISP_LEE_DIE: f32 = 0.25;      // the field's share of the open wind under which a wisp's fade-out starts (WX_OWN.wind: it dies in a roof's lee)
/** ONE WIND FIELD (game/wind.ts WX_OWN.wind — the storm record's iflags bit 4): the share 0‥1 of wispWind the FIELD has at ground point q — nothing under a roof,
 *  easing in off its lee (wind_field.wgsl, asked at the ground, where its height share IS WISP_GROUND_AIR: in the open the field's air is wispWind to the bit).
 *  1 everywhere with the rule off: the wisps on the raw vector, as they were. */
fn wispShare(q: vec2f) -> f32 {
  let n0 = numImpulses(); let nw = numWinds();
  for (var i = n0; i < n0 + nw; i++) {
    let w = em.imps[i];
    if (((w.iflags >> 2u) & 3u) != 1u || (w.kinds & (1u << P_RAIN)) == 0u) { continue; }
    if ((w.iflags & 16u) == 0u) { return 1.0; }
    return clamp(length(windStormOf(w, vec3f(q.x, 0.0, q.y))) / max(w.strength * WISP_GROUND_AIR, 1e-4), 0.0, 1.0);
  }
  return 1.0;
}
/** a smooth value noise 0‥1 (the sheets' hash, its own salt) */
fn wispNoise(u: vec2f, k: u32) -> f32 {
  let i = vec2i(floor(u)); let f = fract(u); let t = f * f * (3.0 - 2.0 * f);
  return mix(mix(rainHash2(i, k), rainHash2(i + vec2i(1, 0), k), t.x), mix(rainHash2(i + vec2i(0, 1), k), rainHash2(i + vec2i(1, 1), k), t.x), t.y);
}
/** GUST PATCHES: the chance 0‥1 that a wisp is born at ground point q — streamers `len` m across and three times as long down the wind, carried downwind at the
 *  wisps' speed (the flakes' sheet offset = ∫ air dt, × the wisps' share), with clear gaps between; nothing in still air, and (WX_OWN.wind) as much fewer in a
 *  roof's lee as the field has less air there */
fn wispGust(q: vec2f, len: f32) -> f32 {
  let a = wispWind().xz; let s = length(a);
  if (s < 1e-3) { return 0.0; }
  let d = a / s; let c = vec2f(-d.y, d.x);
  let o = q - em.rainCfgE.zw * (WISP_GROUND_AIR * em.rainCfgC.y);
  let L = max(len, 0.5);
  let u = vec2f(dot(o, d) / (3.0 * L), dot(o, c) / L);
  let n = 0.65 * wispNoise(u, 7u) + 0.35 * wispNoise(u * 2.7 + vec2f(11.3, 4.1), 9u);
  return smoothstep(0.40, 0.66, n) * wispShare(q);
}
/** the velocity a wisp at `pos` is carried toward: the storm's air at the ground (WX_OWN.wind: the wind FIELD's, where the wisp is) × the wisps' speed (× 0.7‥1.3 per wisp), a crosswind MEANDER on a slow noise that
 *  drifts with the bulk air (the wisps run through it three times as fast: neighbours snake together), and a weak pull to its own cruising height a hand or two
 *  over the ground with a little lift and sink on the same noise */
fn wispAir(pos: vec3f, seed: u32, color: u32) -> vec3f {
  let a = wispWind() * (em.rainCfgD.w * (1.0 + 0.5 * clamp(pos.y / 0.5, 0.0, 1.0))) * wispShare(pos.xz);   // (a little faster a hand higher: the veil shears)
  var av = a;
  var one = false;
  if (SNOW_GRAINS) { if (snowOneAir()) { one = true; av = snowAir(pos, a) * vec3f(1.0, 0.0, 1.0) / max(em.rainCfgD.w, 1e-3); } }   // ONE AIR: the wisp is in the very air the flakes fall through (÷ the flakes' own ×, put back by the CPU as the wisps' speed: one number for all snow)
  if (SNOW_GRAINS) { if (grain.b.w > 0.5 && !one) { let A = airAt(pos.xz); av = vec3f(A.x, 0.0, A.y) * (0.7 + 0.35 * clamp(pos.y / 0.5, 0.0, 1.0)); } }   // (SNOW GRAINS: the wisps ride the simulated air too — round a wall's end, slack in its lee; the field is the game's own air at the ground, × the wisps' speedK below like the formula it stands in for)
  let s = length(av.xz);
  if (s < 1e-3) { return vec3f(0.0); }
  let d = av.xz / s; let c = vec2f(-d.y, d.x);
  let h1 = f32(seed & 1023u) * (1.0 / 1023.0); let h2 = f32((seed >> 10u) & 1023u) * (1.0 / 1023.0);
  let sp = s * em.rainCfgC.y * (0.7 + 0.6 * h1);
  var mA = f32((color >> 8u) & 255u) * (4.0 / 255.0);
  if (one) { mA *= clamp(sp / 2.5, 0.0, 1.0); }   // (the sway was drawn for wisps run at several metres a second: at the air's own speed it is as much less)
  let o = pos.xz - em.rainCfgE.zw;
  let u = vec2f(dot(o, d), dot(o, c)) / WISP_MEANDER_LEN;
  let n1 = wispNoise(u, 3u) * 2.0 - 1.0; let n2 = wispNoise(u * 1.9 + vec2f(5.1, 2.7), 5u) * 2.0 - 1.0;
  let h0 = 0.05 + 0.3 * h2 * h2;
  let v2 = d * sp + c * (n1 * mA);
  return vec3f(v2.x, n2 * mA * 0.25 + (h0 - pos.y) * 1.5, v2.y);
}
/** One wisp's frame: dragged to wispAir; its stretch swept through the trace grid — what faces up it slides over (the ground, a drift's back: it runs on and
 *  leaves the crest), what stands in its way stops it and it is gone inside a third of a second (a wall cuts the veil), born inside a solid = never there; under
 *  a roof, over WISP_TOP or out of the world = gone; (WX_OWN.wind) in a roof's lee it slows with the field and fades. Lit as a flake is (rainShadeV: the three strongest lights shadow-tested, the sky's dome) × its gain, eased
 *  over a few frames so a shadow's edge crossing it does not flick. */
fn wispStep(pin: Particle, slot: u32, isNew: bool, dt: f32) {
  var p = pin;
  let k1 = em.kp[P_RAIN * 2u + 1u];
  if (!isNew && dt > 0.0) {
    let vT = wispAir(p.pos, p.seed, p.color);
    p.vel = vT + (p.vel - vT) * exp(-WISP_DRAG * dt);
    let mv = p.vel * dt; let len = length(mv);
    if (len > 1e-6) {
      let rd = mv / len; var free = true;
      if ((em.flags & 2u) != 0u) {
        let hit = traceClosest(p.pos, rd, len + 0.03, 0u);
        if (hit.idx >= 0) {
          if (hit.inside) { pool.parts[slot].age = p.life; return; }
          free = false;
          p.pos += rd * max(hit.t - 0.03, 0.0);
          if (hit.n.y > 0.5) { p.vel -= hit.n * min(dot(p.vel, hit.n), 0.0); p.pos += hit.n * 0.01; }
          else { p.vel *= 0.15; p.life = min(p.life, p.age + WISP_FADE_OUT); }   // against a wall it settles: its fade-out starts here (the draw's envelope is 1 until the last WISP_FADE_OUT of a life, so nothing jumps)
        }
      }
      if (free) { p.pos += mv; }
    }
    if (!rainOutdoors(p.pos.xz) || p.pos.y < -0.2 || p.pos.y > WISP_TOP || any(p.pos < WORLD_MIN) || any(p.pos > WORLD_MAX)) { pool.parts[slot].age = p.life; return; }
    if (wispShare(p.pos.xz) < WISP_LEE_DIE) { p.life = min(p.life, p.age + WISP_FADE_OUT); }   // (WX_OWN.wind) run into a roof's lee: the air that carried it is gone — it slows with the field and its fade-out starts, as against a wall
    if (SNOW_GRAINS) { if (grain.b.w > 0.5 && !snowOneAir() && length(airAt(p.pos.xz).xy) < WISP_LEE_DIE * grain.a.x) { p.life = min(p.life, p.age + WISP_FADE_OUT); } }
    if (SNOW_GRAINS) { if (snowOneAir() && ((p.color >> 16u) & 255u) != 0u && length(airAt(p.pos.xz).xy) < grain.g.w * grain.f.y) { p.life = min(p.life, p.age + WISP_FADE_OUT); p.vel.y -= 0.6 * dt; } }   // ONE AIR: where the air that lifted it slows under what holds snow up, it sinks back and is gone   // (SNOW GRAINS: on the simulated air the same rule by that air — dead air behind a wall carries nothing)
  }
  let Ps = p.pos + vec3f(0.0, 0.03, 0.0);
  let V = normalize(frame.camPos - Ps);
  let tl = length(p.vel); let T = select(vec3f(1.0, 0.0, 0.0), p.vel / max(tl, 1e-6), tl > 1e-3);
  let lit = rainShadeV(Ps, V, T, k1, false) * max(em.rainCfgC.w, 0.0);
  p.shade = select(mix(p.shade, lit, 0.35), lit, isNew);
  pool.parts[slot] = p;
}

// ================================================================== a grain of blown snow near the view (game/snowFx.ts SNOWGRAINS; particles_draw.wgsl grainVertex draws it)
// The maintainer on the wisps, 10-14: "it should really feel like snow blowing around, which I think is much smaller/high frequency … the way the snow dances around
// with stuff that feels like chaotic fluid dynamics, not just a single static pattern that lines up with the wind"; "neat interactions where the wind hits a wall …
// like vortices past the edge of the door"; "overall this should be subtle". Thousands of fine grains inside a radius of the view's middle, each lying on the ground
// until the air over it runs fast enough to pick it up, then carried a second or two by the AIR FIELD (render/airField.ts: a small fluid simulation of the wind over
// the level's floor, the walls and door leaves its obstacles) with small eddies of its own on top, skipping where it comes down while the air is fast, lying again
// where it is not. A rain-kind particle filed with aspect 3 (particles_common.wgsl grainIs) — every statement dead code without the prelude's SNOW_GRAINS.
// PICTURE ONLY: nothing reads a grain, and nothing reads the air it rides.
const AIR_CELLS_PER_M: f32 = 5.0;    // the air field's cells a metre (render/airField.ts AIR_RES — tools/qa/snowgrains-check.ts holds the two together)
const GRAIN_PICK_RATE: f32 = 5.0;    // 1/s: tries at being picked up, per lying grain
const GRAIN_PICK_LO: f32 = 0.7;      // × the wind's ungusted speed: air slower than this lifts nothing (a lull, a lee) …
const GRAIN_PICK_HI: f32 = 1.3;      // … at this it lifts every grain that tries (a gust, the jet through a gap)
const GRAIN_DROP: f32 = 0.3;         // × that speed: air this slow under a flying grain lets it down
const GRAIN_FLIGHT: f32 = 1.4;       // s a flight lasts (× 0.5‥1.5 per flight)
const GRAIN_TOP: f32 = 1.5;          // m: lifted over this it thins out of sight
const GRAIN_SETTLE: f32 = 0.35;      // m/s: how fast fine snow sinks through still air
const GRAIN_EDDY1: f32 = 0.6;        // m: the size of the small eddies added to the field's air (what the field's cells are too coarse to carry) …
const GRAIN_EDDY2: f32 = 0.21;       // … and of the smallest
const GRAIN_EDDY_HZ: f32 = 0.9;      // how fast those eddies change where they stand (they are not a pattern sliding down the wind)
/** the air at ground point q: the field's four nearest cells, blended (its texel i, j is the cell whose middle is (i + ½, j + ½) ÷ AIR_CELLS_PER_M) */
fn airAt(q: vec2f) -> vec4f {
  let m = vec2i(textureDimensions(airTex)) - vec2i(1); let u = q * AIR_CELLS_PER_M - 0.5; let fl = floor(u); let i = vec2i(fl); let f = u - fl;
  let a = textureLoad(airTex, clamp(i, vec2i(0), m), 0); let b = textureLoad(airTex, clamp(i + vec2i(1, 0), vec2i(0), m), 0);
  let c = textureLoad(airTex, clamp(i + vec2i(0, 1), vec2i(0), m), 0); let e = textureLoad(airTex, clamp(i + vec2i(1, 1), vec2i(0), m), 0);
  return mix(mix(a, b, f.x), mix(c, e, f.x), f.y);
}
fn grainHash3(i: vec3i, k: u32) -> vec3f {
  let h = pcg((bitcast<u32>(i.x) * 0x8DA6B343u) ^ (bitcast<u32>(i.y) * 0xD8163841u) ^ (bitcast<u32>(i.z) * 0xCB1AB31Fu) ^ k);
  return vec3f(f32(h & 1023u), f32((h >> 10u) & 1023u), f32((h >> 20u) & 1023u)) * (2.0 / 1023.0) - 1.0;
}
/** a smooth vector noise, each part −1‥1 (three dimensions: the floor's two and one that is time and height together) */
fn grainNoise3(u: vec3f, k: u32) -> vec3f {
  let i = vec3i(floor(u)); let f = fract(u); let t = f * f * (3.0 - 2.0 * f);
  let x00 = mix(grainHash3(i, k), grainHash3(i + vec3i(1, 0, 0), k), t.x); let x10 = mix(grainHash3(i + vec3i(0, 1, 0), k), grainHash3(i + vec3i(1, 1, 0), k), t.x);
  let x01 = mix(grainHash3(i + vec3i(0, 0, 1), k), grainHash3(i + vec3i(1, 0, 1), k), t.x); let x11 = mix(grainHash3(i + vec3i(0, 1, 1), k), grainHash3(i + vec3i(1, 1, 1), k), t.x);
  return mix(mix(x00, x10, t.y), mix(x01, x11, t.y), t.z);
}
/** One grain's frame. LYING (spin < 0): a few tries a second at a point of the radius' disc — under the open sky, in open air running fast enough — and it is
 *  put on the ground there (one trace down: a drift's back, a box's top) and thrown up into that air. FLYING: dragged toward the field's air where it is (slower
 *  at the ground than a hand up), plus the small eddies, plus the field's lift, less its own sinking; its step swept through the trace grid — what faces up it
 *  skips off while the air is fast and lies on when it is not, a wall turns it and may take it; out of the radius, under a roof or out of the world it lies at
 *  once; over GRAIN_TOP, in dead air or at its flight's end it fades and lies. Lit as a flake is (rainShadeV) × its gain, on about every other frame, eased. */
fn grainStep(pin: Particle, slot: u32, isNew: bool, dt: f32) {
  var p = pin;
  let k1 = em.kp[P_RAIN * 2u + 1u];
  if (isNew) { p.spin = -1.0; p.ori = 0u; p.omg = 0u; p.omgZ = 0u; p.shade = vec3f(0.0); p.vel = vec3f(0.0); }
  if (!(dt > 0.0)) { pool.parts[slot] = p; return; }
  let E = frame.weatherE; let Rn = max(grain.a.y, 1.0); let U0 = max(grain.a.x, 1e-3);
  var end = bitcast<f32>(p.omg);
  if (grain.b.w < 0.5 || E.z <= 0.0 || (p.spin >= 0.0 && p.age >= end)) { p.spin = -1.0; }
  p.ori += 1u; let c = p.ori * 16u;
  if (p.spin < 0.0) {
    p.omgZ = 0u; p.shade = vec3f(0.0);
    // A BLAST (grain.c / .d): for as long as it throws, a share of every lying grain is its — put down inside its disc and thrown out from its middle and up,
    // whatever the wind is doing (the loose snow a burst lifts); from there it is a flying grain like any other, on the air the same blast has shoved outward
    if (grain.c.w > 0.0 && grain.b.w > 0.5 && E.z > 0.0 && p.life - p.age > GRAIN_FADE_OUT + 0.4 && rnd(p.seed, c + 13u) < 1.0 - exp(-grain.c.w * dt)) {
      let rr = sqrt(rnd(p.seed, c + 2u)); let th = rnd(p.seed, c + 3u) * 6.2831853;
      let dir = vec2f(cos(th), sin(th)); let q = grain.c.xy + dir * (rr * max(grain.c.z, 0.05));
      if (rainOutdoors(q) && distance(q, E.xy) < Rn && airAt(q).w > 0.5) {   // (… off open ground only, as the wind's own pick-up: not off a crate's top or a brazier's — the air's map has those solid)
        var y = 0.0; var ok = true;
        if ((em.flags & 2u) != 0u) { let hit = traceClosest(vec3f(q.x, 1.3, q.y), vec3f(0.0, -1.0, 0.0), 1.6, 0u); if (hit.idx >= 0) { ok = !hit.inside && hit.n.y > 0.5; y = 1.3 - hit.t; } }
        if (ok && y < 0.35) {   // (… and off the ground itself: what stands a box high in the disc keeps its snow)
          let h = rnd(p.seed, c + 5u); let far = rnd(p.seed, c + 6u);
          p.pos = vec3f(q.x, y + 0.03 + 0.2 * h, q.y);
          p.vel = vec3f(dir.x, 0.0, dir.y) * (grain.d.x * (0.2 + 0.8 * far) * (0.35 + 0.65 * rr)) + vec3f(0.0, grain.d.y * (0.25 + 0.75 * h), 0.0);
          p.spin = p.age; end = min(p.age + GRAIN_FLIGHT * (0.5 + rnd(p.seed, c + 7u)), p.life - GRAIN_FADE_OUT); p.omg = bitcast<u32>(end);
          pool.parts[slot] = p; return;
        }
      }
    }
    if (grain.b.w > 0.5 && E.z > 0.0 && p.life - p.age > GRAIN_FADE_OUT + 0.4 && rnd(p.seed, c + 1u) < 1.0 - exp(-GRAIN_PICK_RATE * dt)) {   // (… and not in its slot's last moments: a flight ends faded, before the ring takes the slot back)
      let rr = sqrt(rnd(p.seed, c + 2u)); let th = rnd(p.seed, c + 3u) * 6.2831853;
      let q = E.xy + vec2f(cos(th), sin(th)) * (rr * Rn);
      if (rainOutdoors(q)) {
        let A = airAt(q); let s = length(A.xy);
        if (A.w > 0.5 && rnd(p.seed, c + 4u) < smoothstep(GRAIN_PICK_LO * U0, GRAIN_PICK_HI * U0, s)) {
          var y = 0.0; var ok = true;
          if ((em.flags & 2u) != 0u) { let hit = traceClosest(vec3f(q.x, 1.3, q.y), vec3f(0.0, -1.0, 0.0), 1.6, 0u); if (hit.idx >= 0) { ok = !hit.inside && hit.n.y > 0.5; y = 1.3 - hit.t; } }
          if (ok) {
            let h = rnd(p.seed, c + 5u);
            p.pos = vec3f(q.x, y + 0.015 + 0.12 * h * h, q.y);
            p.vel = vec3f(A.x, 0.0, A.y) * ((0.45 + 0.4 * h) * max(grain.b.z, 0.0)) + vec3f(0.0, (0.25 + 0.9 * rnd(p.seed, c + 6u)) * min(s / U0, 1.6), 0.0);
            p.spin = p.age; end = min(p.age + GRAIN_FLIGHT * (0.5 + rnd(p.seed, c + 7u)), p.life - GRAIN_FADE_OUT); p.omg = bitcast<u32>(end);
          }
        }
      }
    }
    pool.parts[slot] = p; return;
  }
  let h1 = f32(p.seed & 1023u) * (1.0 / 1023.0); let h2 = f32((p.seed >> 10u) & 1023u) * (1.0 / 1023.0);
  let A = airAt(p.pos.xz); let s = length(A.xy);
  let up = clamp(p.pos.y / 0.5, 0.0, 1.0);
  let tz = frame.time * GRAIN_EDDY_HZ;
  let n1 = grainNoise3(vec3f(p.pos.xz / GRAIN_EDDY1, tz + p.pos.y / GRAIN_EDDY1), 11u);
  let n2 = grainNoise3(vec3f(p.pos.xz / GRAIN_EDDY2, tz * 2.3 + p.pos.y / GRAIN_EDDY2), 23u);
  let ed = (n1 + n2 * 0.6) * (max(grain.b.x, 0.0) * s);
  let gk = max(grain.b.z, 0.0);   // × the field's air = the blown snow's speed (snowFx.ts SNOWGRAINS.speedK: the field itself is the game's air as it is, for every reader)
  var vT = (vec3f(A.x, 0.0, A.y) * ((0.55 + 0.45 * up) * (0.8 + 0.4 * h1)) + vec3f(ed.x, ed.z * 0.6, ed.y)) * gk;
  vT.y += A.z * grain.b.y * gk - GRAIN_SETTLE;
  p.vel = vT + (p.vel - vT) * exp(-mix(4.0, 9.0, h2) * dt);
  let mv = p.vel * dt; let len = length(mv);
  if (len > 1e-6) {
    let rd = mv / len; var free = true;
    if ((em.flags & 2u) != 0u) {
      let hit = traceClosest(p.pos, rd, len + 0.02, 0u);
      if (hit.idx >= 0) {
        if (hit.inside) { p.spin = -1.0; p.omgZ = 0u; pool.parts[slot] = p; return; }
        free = false;
        p.pos += rd * max(hit.t - 0.02, 0.0) + hit.n * 0.01;
        let vn = min(dot(p.vel, hit.n), 0.0);
        if (hit.n.y > 0.5) {   // the ground, a drift's back: it SKIPS on while the air there is fast (a grain hops along the ground far more than it flies), lies when it is not
          if (s > GRAIN_PICK_LO * U0 && rnd(p.seed, c + 8u) < 0.75) { p.vel -= hit.n * (vn * (1.25 + 0.5 * rnd(p.seed, c + 9u))); }
          else { p.vel = (p.vel - hit.n * vn) * 0.3; end = min(end, p.age + GRAIN_FADE_OUT); }
        } else {               // a wall: turned along it and tossed up its face — and a third of them it takes (snow banks at a wall's foot)
          p.vel -= hit.n * (vn * 1.2); p.vel.y += 0.5 * s * rnd(p.seed, c + 10u);
          if (rnd(p.seed, c + 11u) < 0.35) { end = min(end, p.age + GRAIN_FADE_OUT); }
        }
      }
    }
    if (free) { p.pos += mv; }
  }
  let dC = distance(p.pos.xz, E.xy);
  if (!rainOutdoors(p.pos.xz) || p.pos.y < -0.2 || any(p.pos < WORLD_MIN) || any(p.pos > WORLD_MAX) || dC > Rn * 1.1) { p.spin = -1.0; p.omgZ = 0u; pool.parts[slot] = p; return; }
  if (p.pos.y > GRAIN_TOP || s < GRAIN_DROP * U0) { end = min(end, p.age + GRAIN_FADE_OUT); }
  p.omg = bitcast<u32>(end);
  let env = smoothstep(0.0, GRAIN_FADE_IN, p.age - p.spin) * smoothstep(0.0, GRAIN_FADE_OUT, end - p.age) * (1.0 - smoothstep(0.7, 1.0, dC / Rn));
  p.omgZ = bitcast<u32>(clamp(grain.a.z, 0.0, 4.0) * (0.5 + h2) * env);
  p.color = u32(clamp(grain.e.x, 0.0, 0.999) * 4096.0) | (u32(clamp(grain.e.y, 0.0, 15.9) * 16.0) << 12u) | (u32(clamp(grain.e.z, 0.0, 1.0) * 255.0) << 20u);   // (how the draw shows it: grain.e, packed — the draw has no numbers of the grains' own)
  if (p.age - p.spin < 2.0 * dt || rnd(p.seed, c + 12u) < 0.5) {
    let Ps = p.pos + vec3f(0.0, 0.02, 0.0);
    let V = normalize(frame.camPos - Ps);
    let tl = length(p.vel); let T = select(vec3f(1.0, 0.0, 0.0), p.vel / max(tl, 1e-6), tl > 1e-3);
    let lit = rainShadeV(Ps, V, T, k1, false) * max(grain.a.w, 0.0);
    // (a grain that flies through a lamp's own point is lit from no distance: on the software adapter one such pixel overflowed the frame's half floats and took the
    // whole picture black through the bloom and the history. No grain is brighter than GRAIN_SHADE_MAX)
    p.shade = min(select(mix(p.shade, lit, 0.5), lit, p.age - p.spin < 2.0 * dt), vec3f(GRAIN_SHADE_MAX));
  }
  pool.parts[slot] = p;
}
