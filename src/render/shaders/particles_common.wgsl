// ---- GPU particles (EXPERIMENT, render/particles.ts): declarations shared by the simulation kernels (particles.wgsl) and the splat (particles_draw.wgsl).
// One storage buffer holds a 64-byte header (per-frame counters the update kernel accumulates, read back for the panel) followed by CAP particles of 80 B.
// Slots are dealt by the CPU in ring order — two rings, SHORT (sparks, dust) and LONG (debris chips, casings), so a storm of sparks can never evict brass
// that is meant to lie on the lino for a minute — and only the live WINDOW of each ring (tail .. head, the CPU expires the tail by the emits' lifetimes)
// is simulated and drawn: nothing alive = no thread, no vertex.

const P_SPARK: u32 = 0u;    // incandescent: emissive, gravity, bounces low and skitters along the floor for as long as it burns, cools white-yellow → orange → red over 0.3–0.8 s
const P_DEBRIS: u32 = 1u;   // chips knocked out of drywall / wood / concrete: LIT (albedo of what was hit), gravity, bounce, come to rest and stay ~20 s
const P_DUST: u32 = 2u;     // a puff: LIT soft blob, drag-dominated, grows and fades over ~1.5 s (bullet impacts, the stun charge's ring, a kicked door)
const P_CASING: u32 = 3u;   // spent brass: LIT + a glint off the strongest light, ejected per shot, bounces, lies on the floor
const P_SHEET: u32 = 4u;    // a leaf of office paper (destruction.ts: a burst raking a desk turns its paper stacks into these): a LIT two-sided oriented quad,
                            // gravity + anisotropic drag + flutter torque (game/sheetModel.ts is the CPU reference of the same equations), slides / settles
                            // flat on what it lands on and sleeps like a chip; casts no shadow (a splat, not a box)
const P_RAIN: u32 = 5u;     // a rain drop (game/rainFx.ts): born on top of the weather's rain slab over the outdoor ground near the view, falls at terminal speed with the wind
                            // field's air, LIT like a chip (the strongest lights shadow-rayed) + refracting / glinting in the splat, dies where it hits and becomes its own
                            // splash crown there (PB_ASLEEP = splashed); its own ring past the two gameplay rings (EmitBlock.rainWin)
const P_SHARD: u32 = 6u;    // a fragment of a broken glass pane (game/shards.ts files them where the fracture model lets a piece go; game/shardModel.ts is the CPU reference of its
// the shard branches of the three particle modules exist only in a build compiled with glass breaking (the scene prelude's GLASS_BREAK, raised at boot — render/frame.ts):
// with it false every `SHARDS_ON && …` test folds away and the kernels are the ones the other kinds always ran (a kind-6 record would then fly and draw as a chip).
const SHARDS_ON: bool = GLASS_BREAK;
                            // flight): a two-sided oriented sliver like the sheet, but DENSE — it tumbles, bounces, skitters and comes to rest tilted a little off flat — and it is
                            // GLASS: almost nothing of it shows but what it mirrors (a GGX lobe per light off its own normal × Fresnel, the room's mean radiance at grazing angles) and
                            // the light its cut edges scatter, so litter under a torch sparkles piece by piece as the torch or the eye moves; LONG ring; casts no shadow
const P_KINDS: u32 = 7u;

// Particle.bits
const PB_KIND: u32 = 15u;         // low 4 bits: kind
const PB_ASLEEP: u32 = 16u;       // resting on an up-facing surface: no integration, support re-tested now and then
const PB_NEW: u32 = 32u;          // born this frame (the emit kernel pre-integrated it a random fraction of dt): the update kernel skips its step once
const PB_BOUNCED: u32 = 64u;      // has met geometry at least once
const PB_OURS: u32 = 128u;        // the team's own doing (the record's bit 18 — particles.ts Particles.ours): drawn over floor the fog of war hides too, until it has lain and is woken (the kernel takes the bit off)
const PB_KEPT: u32 = 65536u;      // at rest, and the team has seen it lying there (FOG.kept: the update kernel puts it on over seen floor, a wake takes it off): drawn over floor the fog hides too while the row is on. Bit 16: the owner has bits 8‥15
// bits 8..15: owner — the character id whose capsules / boxes this particle's rays ignore (a casing leaves the port INSIDE the shooter's arm capsules)

struct Particle {
  pos: vec3f, age: f32,
  vel: vec3f, life: f32,
  size: f32, bits: u32, seed: u32, color: u32,   // size: metres (a spark's streak thickness, a chip's width, a puff's radius at birth, a sheet's WIDTH); color: rgba8 albedo / tint
  shade: vec3f, spin: f32,                       // shade: what the splat shows THIS frame — outgoing radiance of a lit particle, emitted radiance of a spark (bloom does the glow); spin: an angle (resting orientation, the casing's twinkle phase, the sheet's turn about its normal)
  ori: u32, omg: u32, omgZ: u32, aux: u32,       // SHEET: unit normal (octahedral, 2 × snorm16), angular velocity rad/s (x, y as f16 × 2 | z as f16, high half spare); aux = pack2x16float(aspect = length ÷ width, SHEET: gust s — the blast wind still carrying it, 0 in still air) — every kind carries aspect (a splinter is a chip with aspect 3; 1 = the chip as it was)
};

// the shard's constants the kind block has no slot for (game/shardModel.ts SHARD.<NAME> — tools/qa/shards-probes.ts compares them by name)
const SHARD_REF_SIZE: f32 = 0.01;
const SHARD_DRAG_MAX: f32 = 6.0;
const SHARD_ANG_DAMP: f32 = 0.3;
const SHARD_E_JIT: f32 = 0.8;
const SHARD_SKITTER: f32 = 0.45;
const SHARD_SPIN_K: f32 = 28.0;
const SHARD_SPIN_MAX: f32 = 60.0;
const SHARD_WALL_E: f32 = 0.3;
const SHARD_WALL_KEEP: f32 = 0.8;
const SHARD_REST_TILT: f32 = 0.35;
const SHARD_GLINT_CAP: f32 = 14.0;
const SHARD_F0: f32 = 0.04;
// … and its LOOK in the splat (particles_draw.wgsl shardVertex / shardFragment; taste constants, argued on rebuild/glass/shards.md)
const SHARD_MIN_PX: f32 = 1.6;        // a fragment narrower than this on screen is drawn this wide: its body thinned by the area ratio, its glint by the square root of it (a sub-pixel sliver still flashes)
const SHARD_BODY_A: f32 = 0.10;       // how much of what is behind it a face takes away (two Fresnel losses + the tint) …
const SHARD_RIM_A: f32 = 0.45;        // … and its cut edge (the light runs along the glass and leaves by the edge: darker against a bright floor, brighter against a dark one)
const SHARD_RIM_GAIN: f32 = 1.6;      // × the shade at the rim on top of the face's
const SHARD_REACT_REST: f32 = 0.15;   // TAAU reactivity of a resting fragment's pixels (they hold still: history may stand)
// … and AT REST (tuning round five: a pane's worth of glass came to rest and nothing of it could be seen — a clear face lying flat adds a tenth of the floor's own light). One
// resting particle stands for the handful of grains that fell with it, and broken glass in a drift is a FROST: the light goes round between the fracture faces and comes out
// every way. The small ones take all of it and lie as soft heaps (dice, fines); a finger-wide sliver of float glass takes most of it and keeps its own cut outline and bright edge. Only under em.flags bit 8
// (render/particles.ts shardRestFrost ← game/shards.ts SHARDS.restFrost): off, a resting shard is lit and drawn exactly as it flies.
const SHARD_REST_SCATTER_LO: f32 = 0.15;  // the diffuse share a resting grain sends on, from … (flying: the kind block's SCATTER, 0.1)
const SHARD_REST_SCATTER_HI: f32 = 1.15;  // … to this, by the grain's own dice: a drift of broken glass is a mottle of facets that throw the light back and gaps that do not,
                                          // and it is the mottle that shows on ANY floor (one even value came out the lobby stone's own brightness: nothing to see)
const SHARD_REST_SCATTER_BIG: f32 = 0.22; // … and a resting sliver SHARD_REST_BIG across or more
const SHARD_REST_BODY_A: f32 = 0.6;       // how much of the floor under it a resting grain's little drift hides (a sliver: SHARD_BODY_A, as in the air)
const SHARD_REST_EDGE: f32 = 0.35;        // × its light at the drift's edge (the cubes shade the floor between them: a darker rim gives a heap its shape) …
const SHARD_REST_MID: f32 = 1.25;         // … and in its middle
const SHARD_REST_SPREAD: f32 = 1.8;       // × a resting fine's width on the floor (the handful it stands for; a sliver lies as it is) …
const SHARD_REST_SPREAD_DICE: f32 = 3.0;  // … and a resting dice grain's: one particle stands for some fifteen cubes of a diced sheet (3 m² of toughened glass is 30 000)
const SHARD_REST_DICE0: f32 = 0.005;      // m: the spread goes from the fine's to the dice's between these two sizes
const SHARD_REST_DICE1: f32 = 0.008;
const SHARD_REST_ONE0: f32 = 0.014;       // m: from here … a resting piece is ONE piece, not a heap: it keeps its cut outline and bright edge, lies
const SHARD_REST_ONE1: f32 = 0.02;        // … to here      SHARD_REST_SPREAD_ONE wide
const SHARD_REST_SPREAD_ONE: f32 = 1.25;
const SHARD_REST_MIN_PX: f32 = 2.0;       // a resting grain is drawn no narrower than this (SHARD_MIN_PX in the air)
const SHARD_REST_SMALL: f32 = 0.008;      // m: this size and under is all frost …
const SHARD_REST_BIG: f32 = 0.05;         // … this size and over is a clear sliver (a 2 cm shard of float glass at rest is still four fifths frost: it lay there unseen)
/** how much of a FROST a resting fragment `size` metres across is (1 = a drift of grains, 0 = one clear sliver) */
fn shardFrost(size: f32) -> f32 { return 1.0 - smoothstep(SHARD_REST_SMALL, SHARD_REST_BIG, size); }
/** how much of a HEAP it is at rest (1 = a soft drift of grains, 0 = one piece with its own outline) */
fn shardRestHeap(size: f32) -> f32 { return 1.0 - smoothstep(SHARD_REST_ONE0, SHARD_REST_ONE1, size); }
fn shardRestSpread(size: f32) -> f32 {
  return mix(SHARD_REST_SPREAD_ONE, mix(SHARD_REST_SPREAD, SHARD_REST_SPREAD_DICE, smoothstep(SHARD_REST_DICE0, SHARD_REST_DICE1, size)), shardRestHeap(size));
}
fn shardRestScatter(size: f32, seed: u32) -> f32 {   // (seed bits 20‥27: the outline has the low 16, the facet's roughness 12‥19)
  return mix(SHARD_REST_SCATTER_BIG, mix(SHARD_REST_SCATTER_LO, SHARD_REST_SCATTER_HI, f32((seed >> 20u) & 255u) / 255.0), shardFrost(size));
}
// the sheet's two constants the kind block has no slot for (game/sheetModel.ts SHEET.ANG_DAMP / SPIN_MAX)
const SHEET_ANG_DAMP: f32 = 1.8;
const SHEET_SPIN_MAX: f32 = 3.0;
// the sheet's IMPULSE response (game/sheetModel.ts SHEET_IMP / SHEET_GUST — the probes compare them): a kicked leaf is tipped off flat by up to TILT rad toward a hashed
// side, set tumbling at TUMBLE rad/s per m/s of kick (|ω| ≤ WMAX), and carried by the blast's wind for GUST_TAU × clamp((kick − GUST0) / GUST1) s, during which drag
// and flutter torque are taken against the co-moving air: × (1 − GUST_K·g), g = 1 until the last GUST_RAMP share of TAU, then falling to 0
const SHEET_IMP_TILT: f32 = 0.9;
const SHEET_IMP_TUMBLE: f32 = 3.0;
const SHEET_IMP_WMAX: f32 = 12.0;
const SHEET_IMP_GUST0: f32 = 0.5;
const SHEET_IMP_GUST1: f32 = 1.5;
const SHEET_GUST_TAU: f32 = 0.4;
const SHEET_GUST_K: f32 = 0.98;
const SHEET_GUST_RAMP: f32 = 0.35;
/** below this scalar kick (m/s) an impulse leaves a particle alone (game/sheetModel.ts IMP_MIN_KICK) */
const IMP_MIN_KICK: f32 = 0.03;
/** per-particle raggedness of a push (game/sheetModel.ts IMP_JITTER): the kick × (1 − MAG/2 ‥ 1 + MAG/2), plus SIDE × the kick along a hashed bearing — a pile does not lift as one clump */
const IMP_JITTER_MAG: f32 = 0.6;
const IMP_JITTER_SIDE: f32 = 0.35;
/** octahedral unit-vector codec (2 × snorm16 in a u32) for the sheet's normal */
fn pOctEncode(nIn: vec3f) -> u32 {
  let n = nIn / (abs(nIn.x) + abs(nIn.y) + abs(nIn.z) + 1e-9);
  var e = n.xz;
  if (n.y < 0.0) { e = (1.0 - abs(e.yx)) * select(vec2f(-1.0), vec2f(1.0), e >= vec2f(0.0)); }
  return pack2x16snorm(e);
}
fn pOctDecode(u: u32) -> vec3f {
  let e = unpack2x16snorm(u);
  var n = vec3f(e.x, 1.0 - abs(e.x) - abs(e.y), e.y);
  if (n.y < 0.0) { let t = (1.0 - abs(n.zx)) * select(vec2f(-1.0), vec2f(1.0), n.xz >= vec2f(0.0)); n = vec3f(t.x, n.y, t.y); }
  return normalize(n);
}
fn packOmega(w: vec3f) -> vec2u { return vec2u(pack2x16float(w.xy), pack2x16float(vec2f(w.z, 0.0))); }
fn unpackOmega(a: u32, b: u32) -> vec3f { return vec3f(unpack2x16float(a), unpack2x16float(b).x); }
/** the sheet's in-plane frame: t across its width, b along its length, from the normal and the spin angle (the splat's quad and nothing else reads it) */
fn sheetFrame(n: vec3f, spin: f32) -> mat2x3f {
  let rf = normalize(mix(vec3f(1.0, 0.0, 0.0), vec3f(0.0, 0.0, 1.0), smoothstep(0.6, 0.95, abs(n.x))));   // a HORIZONTAL reference BLENDED from x toward z as the leaf turns to face ±x: continuous everywhere but two isolated directions — never in the near-flat band a fluttering leaf rocks through (an up reference flipped the quad's frame twice a swing; a hard switch snapped it four times a tumble)
  let t0 = normalize(cross(rf, n)); let b0 = cross(n, t0);
  let c = cos(spin); let s = sin(spin);
  return mat2x3f(t0 * c + b0 * s, b0 * c - t0 * s);
}

// Per-kind numbers, live from the panel (render/particles.ts KIND_DEFAULTS): two vec4 per kind
//   k0 = (gravity m/s², drag 1/s, restitution, tangential keep on a bounce)
//   k1 = (sleep speed m/s — below it after a bounce on an up face the particle rests; SPARK: hold fraction · others: fade-out seconds at the end of life;
//         SPARK/DEBRIS/CASING: streak shutter s · DUST: growth factor over life; SPARK: brightness × · DUST: peak opacity · others: 1)
//   SHEET reads the same slots as (gravity, KT along-slip drag, KN_LIN, KN_Q) and (sleepV, fade s, FLUT torque gain, TRANS translucency) — game/sheetModel.ts SHEET
//   SHARD reads them as (gravity, drag 1/s at SHARD_REF_SIZE, restitution, slide keep) and (sleepV, fade s, ROUGH = the glint lobe's α, SCATTER = diffuse share) — game/shardModel.ts SHARD
struct Window { start: u32, size: u32, tail: u32, live: u32 };   // ring `start .. start+size`, live slots begin at offset `tail` (mod size), `live` of them

// The frame's uniform block (render/particles.ts writes it): the emit queue + the live windows + the per-kind numbers. The simulation reads all of it, the
// splat only the windows and the kind numbers.
struct EmitRec {
  pos: vec3f, count: u32,
  dir: vec3f, speed: f32,
  posB: vec3f, first: u32,        // posB: x = ring radius (SHEET: initial tumble rate cap rad/s), y = aspect (length ÷ width; 1 for everything but sheets and splinters), z = SHEET normal jitter 0‥1 (0 = born flat, 1 = any way up); first: index of this record's first particle among the frame's births
  vadd: vec3f, shape: u32,        // velocity inherited from the emitter (the shooter's stride); 0 cone about dir · 1 ground burst (spread / lift) · 2 ring in XZ · 3 puff (sphere)
  p: vec4f,                       // x spread (cone half-angle rad | burst spread), y life s, z size m, w speed jitter 0..1 (speed × (1 − w·r))
  q: vec4f,                       // x life jitter (life × (1 − x + 2x·r)), y lift (burst / ring: vertical share), z size jitter, w position jitter radius m
  k: vec4u,                       // x kind | owner << 8 | ring << 16 | the team's own doing << 18 (PB_OURS), y seed, z slot offset within the ring of particle 0, w colour rgba8
};
const MAX_EMITS: u32 = 128u;
// IMPULSES (render/particles.ts Particles.impulse; game/destruction.ts is where they come from — a stun charge, a round landing beside settled litter, a body /
// boot / shoved desk thumping the floor; game/sheetModel.ts impulseKick + sheetImpulse are the CPU reference of what particles.wgsl applyImpulses does with one):
// up to MAX_IMPS a frame, applied in the update kernel to every LIVE particle of the kinds each names within its radius — Δv = strength × gain(kind) ×
// (1 − d/radius) × (radial with its downward part dropped + up × upK(kind) × ŷ + bias), |v| capped per kind — and WAKING the resting ones it kicks
// harder than wake(kind), so paper already on the floor goes up again. numImps rides in EmitBlock.flags bits 8‥12: 0 = the kernel never touches the array
// (frames without impulses cost one shift and a branch), and the CPU uploads the array only on frames that carry any.
const MAX_IMPS: u32 = 16u;
struct ImpulseRec {
  pos: vec3f, radius: f32,       // centre of the push, its reach (m)
  bias: vec3f, strength: f32,    // a direction folded into the push, |bias| = its weight (the round's travel along the surface it struck; zero for a blast); peak Δv (m/s) a SHEET gets at the centre — the other kinds scale it by their gain
  eye: vec3f, up: f32,           // where the occlusion ray starts when iflags has bit 0 (a blast's reach judged from just over desk height, as destruction.ts judges the stacks); the upward share added to the radial direction
  kinds: u32, seed: u32, iflags: u32, spare: u32,   // bit k set = kind k responds; the seed each kicked sheet hashes its tilt / tumble from with its slot; 1 = one any-hit ray + the glass panes eye → particle gate it (a partition or a pane between a charge and the litter behind it stops the push)
};
// WIND records (game/wind.ts → render/particles.ts setWind): the frame's ≤ 8 wind sources ride in the SAME array right BEHIND the impulses — imps[numImps ‥ numImps +
// numWinds) — as ImpulseRec read another way (render/shaders/wind_field.wgsl is the field; particles.wgsl windAir sums it): a JET (iflags bits 2‥3 = 0): pos = the
// diffuser's face centre, radius = reach (where it has halved), bias = unit axis, strength = m/s at the face this frame, eye = (tanSpread, r0, dMax), up = the
// floor a down-jet turns along (≤ −100 = none); the STORM (bits 2‥3 = 1): pos.xyz + radius = the interior footprint x0 z0 x1 z1 it does not blow inside, eye + up
// = the annex's, bias × strength = the wind; iflags bit 4 = the wisps read the field, bit 5 = ROOF BY ROOF: the two rectangles are the level's first two roofs and
// its third / fourth are the Frame's (frame.cardCfg.y / .z — particles.wgsl windStormOf; game/wind.ts WX_OWN.wind). kinds = which kinds answer to it. Every wind record also carries the four live wind knobs (the same on each; read off
// the first): seed = pack2x16float(sheet wake speed m/s, sheet kick ×), spare = pack2x16float(debris coupling 0‥1, spare). No wind record ever wakes,
// gates or kicks by itself: the update kernel takes the summed AIR VELOCITY as what drag is measured against (dust follows it, chips a share of it, a sheet's
// aerodynamics take the relative wind — the impulse gust's 'co-moving air' generalised to 'the air moves at v_air'), trembles a resting leaf and now and then wakes one.
struct EmitBlock {
  numRecs: u32, totalNew: u32, frameSeed: u32, flags: u32,   // flags (+ bit 24 = sparks come back off surfaces and their birth stretch is swept — particles.wgsl sparkBounce): 1 = shadow rays for the three strongest lights (else all unshadowed and whole), 2 = collide at all, 4 = fog the splats by the volumetric transmittance, 8 = glass at rest shows as frost (SHARD_REST_*); bits 8‥12 = numImps this frame; bits 16‥20 = numWinds (behind them)
  win: array<Window, 2>,
  kp: array<vec4f, 14>,           // per kind k: kp[2k] = k0, kp[2k+1] = k1 (above) — 2 × P_KINDS rows
  ki: array<vec4f, 7>,            // per kind k, its IMPULSE response (game/sheetModel.ts IMP_RESPONSE, live from the panel): x gain on the record's strength (0 = the kind ignores impulses: sparks), y × its upward share, z |v| cap after the kick (m/s), w the least kick (m/s) that wakes a resting one — P_KINDS rows
  recs: array<EmitRec, MAX_EMITS>,
  imps: array<ImpulseRec, MAX_IMPS>,
  rainWin: Window,                // the RAIN ring's window (experiment; render/particles.ts RAIN_RING) — in the tail so everything above sits where it always sat; live 0 unless it rains particles
  // PARTICLE RAIN v2 — the rain kind's LOOK (render/particles.ts RainLook ← game/rainFx.ts PRAIN, live), written with the window above while the ring holds anything:
  rainCfg: vec4f,                 // the drop's PHASE + glint: x = isotropic floor, y = forward-lobe weight, z = its Henyey-Greenstein g, w = the strand glint's weight (particles.wgsl rainPhase)
  rainCfgB: vec4f,                // x = the glint lobe's own roughness (+ each emitter's angular half-size), y = its cap per light (× E × gain), z = × everything the drop scatters (gain), w = the TAIL's share of last frame's shade
  rainCfgC: vec4f,                // REFRACTION in the splat (particles_draw.wgsl rainFragment, through refract_common.wgsl): x = on 0‥1 (× the streak's coverage as an 'over') + 2 × round(100 × how much of the PICTURE a read taken beside the streak keeps, 0‥1: 1 = the fetch as it is; 0 = its light only — no colour of its own, its luminance half way to the pixel's own, its offset's length scattered per pixel and frame: rainRefractTap), y = the refracted ray's reach behind the drop (m: the scene depth behind the pixel less the drop's own, capped here), z = each fetch's display-luminance clamp, w = depth guard (a fetch this much nearer the eye than the drop is not behind it)
  rainCfgD: vec4f,                // x = streak LENGTH jitter 0‥1 per drop, y = BRIGHTNESS jitter 0‥1, z = half-width floor px + 16 × taps (2‥4), w = × the wind field's air on a drop (0 = falls plumb)
  rainCfgE: vec4f,                // the drifting SHEETS births are thinned into (particles.wgsl emit): x = amplitude 0‥1, y = scale m, zw = the noise's running offset (∫ air dt, m: carried downwind)
  rainCfgF: vec4f,                // the streak's WIDTH on screen (particles_draw.wgsl rainVertex): x = half-width CEILING px (a drop two metres off is a thin bright line, not a bar: what is wider is drawn this wide and brightened by as much …), y = … up to this ×, z = the near fade's reach (m: a drop closer to the lens than 0.35 × this shows nothing, fully itself from here), w = BEAD amplitude 0‥1: a big drop oscillates as it falls (~100+ Hz), so its streak is brightness-modulated along its length — 3‥6 beats per streak, phase and count per drop, mean 1
};

/** slot of live-window element t over the two rings, or 0xffffffff past the end */
fn windowSlot(w0: Window, w1: Window, t: u32) -> u32 {
  if (t < w0.live) { return w0.start + (w0.tail + t) % w0.size; }
  let t1 = t - w0.live;
  if (t1 < w1.live) { return w1.start + (w1.tail + t1) % w1.size; }
  return 0xffffffffu;
}
/** … then the rain ring's window after those two (t counted over all three): the update kernel's / the splat's slot for thread / instance t */
fn slotOf3(w0: Window, w1: Window, wr: Window, t: u32) -> u32 {
  let s = windowSlot(w0, w1, t);
  if (s != 0xffffffffu) { return s; }
  let t2 = t - w0.live - w1.live;
  if (t2 < wr.live) { return wr.start + (wr.tail + t2) % wr.size; }
  return 0xffffffffu;
}

/** PARTICLE RAIN: is ground point p (xz) rained on — outside the interior footprint and the stair tower's (frame.weatherC / D, the rectangles volumetrics.wgsl outdoorsXZ cuts the
 *  lattice rain by) and inside the world's rim. The recycler's disc is thrown over everything; births and drifting drops are kept to this. */
fn rainOutdoors(p: vec2f) -> bool {
  let I = frame.weatherC; let A = frame.weatherD;
  if (WX_KINDS) { if (frame.cardCfg.y != 0u && wxRoofed(p)) { return false; } }   // (weather kinds: the level's third / fourth roof)
  return (p.x < I.x || p.y < I.y || p.x > I.z || p.y > I.w) && (p.x < A.x || p.y < A.y || p.x > A.z || p.y > A.w)
      && p.x > WORLD_MIN.x + 0.25 && p.y > WORLD_MIN.z + 0.25 && p.x < WORLD_MAX.x - 0.25 && p.y < WORLD_MAX.z - 0.25;
}
/** RAIN OVER A WALL'S FACE (the prelude's RAIN_WALLS): is surface point P one the rain shows in front of though its ground point is inside a roof's rectangle — not
 *  UNDER the roof (common.wgsl wxUnderRoof), and inside the world's rim as rainOutdoors asks. */
fn rainOverWall(P: vec3f) -> bool {
  let p = P.xz;
  return !wxUnderRoof(p) && p.x > WORLD_MIN.x + 0.25 && p.y > WORLD_MIN.z + 0.25 && p.x < WORLD_MAX.x - 0.25 && p.y < WORLD_MAX.z - 0.25;
}
/** SNOW PAST THE LEVEL'S RIM (game/weatherKinds.ts SNOW_LOOK.past; the maintainer, of a view by the pass's edge: "snowfall missing from bottom left of image"). A flake
 *  high in the air is drawn well off its own ground, toward the camera's foot: with the rim on the camera's side, the flakes that would show over the near part of
 *  the picture are in the air PAST the rim, and none was ever there (births, the step and the splat all kept to the world's rectangle). snowPast() = how many metres
 *  past the rim the snow goes on falling: game/snowFx.ts hands it over as frame.weatherE.w NEGATIVE (that slot is the lattice rain's share, asked `> 0.0` by its
 *  readers; a snow level has no lattice rain, and game/rainFx.ts stands down on one before it reads the slot). 0 = no flake past the rim: the build as it was. */
fn snowPast() -> f32 { return max(-frame.weatherE.w, 0.0); }
/** … may a FLAKE be in the air over ground point p: inside the world's rim grown by snowPast() and under no roof — rainOutdoors' own answer for p, or for the rim
 *  beside it when p is past it (one roof rule: a roof's dry column runs straight out from the rim). With 0 it is rainOutdoors to the letter. Nothing LIES past the
 *  rim (a wisp, a grain, a kick, a blast's throw are born by rainOutdoors): only the sky's falling snow. game/snowFx.ts flakeOpen is this on the CPU. */
fn flakeOpen(p: vec2f) -> bool {
  let m = snowPast();
  if (m <= 0.0) { return rainOutdoors(p); }
  return all(p > WORLD_MIN.xz - vec2f(m)) && all(p < WORLD_MAX.xz + vec2f(m)) && rainOutdoors(clamp(p, WORLD_MIN.xz + vec2f(0.26), WORLD_MAX.xz - vec2f(0.26)));
}
/** … and is p past the world's rectangle (no box, no air field out there) */
const PAST_RIM_IN = 0.5; const PAST_RIM_OUT = 0.8;   // shares of the view's disc between which the fall past the rim thins to nothing (game/snowFx.ts PAST_TAPER holds the same two)
fn pastWorld(p: vec3f) -> bool { return p.x < WORLD_MIN.x || p.z < WORLD_MIN.z || p.x > WORLD_MAX.x || p.z > WORLD_MAX.z; }
/** … and is SURFACE point P under one of the two roofs — inside the interior / annex footprint AND below the ceiling slab (a wall's top or a unit standing on the roof is in the open).
 *  Rain only exists outdoors, so nothing under a roof can ever be seen THROUGH a drop: the top-down raster looks straight through the NoPrimary roof and lays the lit rooms a few
 *  pixels beside the outdoor drops ON SCREEN with three metres of wall and slab between them in the world — a screen-space read landing there is refused (particles_draw.wgsl
 *  rainRefractTap keeps the pixel's own read), or the exit sign's green corridor floor shows up in the drops falling past the wall outside it. */
fn rainRoofed(P: vec3f) -> bool {
  let I = frame.weatherC; let A = frame.weatherD; let q = P.xz;
  let inI = q.x >= I.x && q.y >= I.y && q.x <= I.z && q.y <= I.w;
  let inA = q.x >= A.x && q.y >= A.y && q.x <= A.z && q.y <= A.w;
  var inX = false; if (WX_KINDS) { if (frame.cardCfg.y != 0u) { inX = wxRoofed(q); } }
  return (inI || inA || inX) && P.y < CEIL_Y + 0.05;
}
/** SNOW OVER A WALL'S FACE (the maintainer, playing the pass on his GPU, 10-15: "the snow renders on top of the character but not on top of the wall"). The rain's
 *  readability rule hides a drop from every pixel whose SURFACE is not outdoors — and a roof's rectangle is its building's outer walls grown by a few centimetres
 *  (weather.ts ownRoofs; the packed third / fourth to 0.2 m), so the walls' OUTER FACES, the doors in them and the walls' tops all counted as indoors: snow fell in
 *  front of a man at the wall's foot and stopped dead at the wall behind him. For snow the rule asks what it means — is this surface UNDER the roof: inside a roof's
 *  rectangle drawn in by FLAKE_WALL_IN (past the outer face and the door in the wall, short of the inner face) AND below the ceiling (a wall's top is in the open).
 *  The rooms stay dry to the eye as before; the world's rim as before. game/snowFx.ts flakeHidden is this function on the CPU (tools/qa/snow-check.ts walls). */
const FLAKE_WALL_IN: f32 = 0.2;   // m (snowFx.ts FLAKE_WALL_IN: the same number)
fn flakeRectIn(R: vec4f, p: vec2f) -> bool { return p.x >= R.x + FLAKE_WALL_IN && p.y >= R.y + FLAKE_WALL_IN && p.x <= R.z - FLAKE_WALL_IN && p.y <= R.w - FLAKE_WALL_IN; }
/** UNDER THE ROOFS, WHICHEVER SLAB (the prelude's SNOW_UNDER, game/weatherKinds.ts SNOW_LOOK.under). flakeRectIn draws each roof's rectangle in by itself, so on the
 *  line where two slabs of one building meet neither's holds and a strip two insets wide was open to snow: the floor along that wall's foot, the floor of a doorway in
 *  it; and flakeHidden opened EVERY top
 *  at the ceiling, the partitions' deep inside a building as the outer walls'. Is ground point p under the roofs by d: roofed, and the four corners of a square 2 d
 *  wide about it all roofed (common.wgsl wxRoofed: any of the level's roofs) — for a rectangle alone that is flakeRectIn to the letter. A top takes the snow only
 *  within FLAKE_TOP_IN of the roofs' edge: an outer wall's (a quarter metre thick under a roof that overhangs it by centimetres, so the wall's own inset would dry
 *  its inner half). What stands ABOVE the ceiling's plane (nothing does today) is in the open, as it was. FIVE POINTS, not the whole square: a gap in the roofs
 *  narrower than 2 d that falls between the corners is not seen (none on a level today). game/snowFx.ts flakeUnder / flakeHiddenUnder are these on the CPU
 *  (tools/qa/snowunder-check.ts asks them against the whole square). */
const FLAKE_TOP_IN: f32 = 0.5;   // m (snowFx.ts FLAKE_TOP_IN: the same number)
fn flakeUnder(p: vec2f, d: f32) -> bool { return wxRoofed(p) && wxRoofed(p + vec2f(d, d)) && wxRoofed(p + vec2f(-d, d)) && wxRoofed(p + vec2f(d, -d)) && wxRoofed(p - vec2f(d, d)); }
fn flakeHidden(P: vec3f) -> bool {
  let q = P.xz;
  if (snowPast() <= 0.0 && !(q.x > WORLD_MIN.x + 0.25 && q.y > WORLD_MIN.z + 0.25 && q.x < WORLD_MAX.x - 0.25 && q.y < WORLD_MAX.z - 0.25)) { return true; }   // (with the snow falling past the rim, the ground's last quarter metre shows it as the rest does)
  if (SNOW_UNDER) { if (P.y > CEIL_Y + 0.05 || !flakeUnder(q, FLAKE_WALL_IN)) { return false; } return P.y <= CEIL_Y - 0.05 || flakeUnder(q, FLAKE_TOP_IN); }
  if (P.y > CEIL_Y - 0.05) { return false; }
  var r = flakeRectIn(frame.weatherC, q) || flakeRectIn(frame.weatherD, q);
  if (WX_KINDS) { if (frame.cardCfg.y != 0u) { r = r || flakeRectIn(wxRect(frame.cardCfg.y), q) || flakeRectIn(wxRect(frame.cardCfg.z), q); } }
  return r;
}
// the rain kind's constants shared by the step (particles.wgsl rainStep) and the splat (particles_draw.wgsl rainVertex / rainFragment)
/** is this frame a snow level's — the rain kind's particles are FLAKES (game/snowFx.ts)? The page was opened on a level built for snow (the prelude's WX_SNOW: every
 *  flake statement is dead code on any other page) AND no rain is falling: a snow level's weather hands rain 0, and the office standing in for a level file that failed
 *  to load rains as it always did, drop for drop. */
fn snowNow() -> bool { return WX_SNOW && frame.weatherA.x <= 0.0; }
/** … and is this rain-kind particle a WISP of blowing snow (game/snowFx.ts SNOWWISPS — the prelude's SNOW_WISPS: dead code on every other page)? It is filed with
 *  aspect 2 (every drop and flake: 1). A wisp's numbers: em.rainCfgC.yzw = × the air's speed, the streak's weight, × the light (the refraction's slots — a snow level's
 *  refraction is off, nothing else reads them there); its colour word = stretch s ÷ 2, meander m/s ÷ 4, gust patch m ÷ 32. */
fn wispIs(aux: u32) -> bool { return SNOW_WISPS && snowNow() && unpack2x16float(aux).x > 1.5 && unpack2x16float(aux).x < 2.5; }
/** … or a GRAIN of blown snow near the view (game/snowFx.ts SNOWGRAINS — the prelude's SNOW_GRAINS: dead code on every other page)? Filed with aspect 3. A grain
 *  is not born and spent like a flake: its slot lives as long as a flake's, and in that time the grain is picked up off the ground, flies a second or two on the
 *  air field (render/airField.ts) and lies again, over and over (particles.wgsl grainStep). What it keeps between frames, in the rows a flake does not use:
 *  spin = the age its flight began (under 0: on the ground, nothing drawn), omg = the age it ends (f32 bits), ori = how many tries it has had (its dice),
 *  omgZ = what the splat shows of its light this frame, 0‥1 (f32 bits: its weight × its fade in and out × the radius' rim). */
fn grainIs(aux: u32) -> bool { return SNOW_GRAINS && snowNow() && unpack2x16float(aux).x > 2.5; }
// (how long a dash a grain is drawn as is live: game/snowFx.ts SNOWGRAINS shutter / dash / tail → grain.e → packed into the grain by its step — particles_draw.wgsl grainVertex)
const GRAIN_MIN_PX: f32 = 0.6;       // half-width floor on screen (thinner than this it is drawn this wide and dimmed by as much) …
const GRAIN_MAX_PX: f32 = 1.6;       // … and ceiling: fine snow is never a blob, however near the lens
const GRAIN_SHADE_MAX: f32 = 48.0;   // the most light a grain carries, a channel (scene units, before its weight and the exposure): a grain a hand from a lamp — past that it is clamped, never infinite
const GRAIN_FADE_IN: f32 = 0.12;     // s: lifted off the ground it comes up …
const GRAIN_FADE_OUT: f32 = 0.3;     // … and settling it goes: nothing pops
const WISP_FADE_IN: f32 = 0.5;       // s: a wisp comes up …
const WISP_FADE_OUT: f32 = 0.9;      // … and goes (the last of its life), it does not pop
const WISP_SOFT_M: f32 = 0.2;        // m: it fades into what it meets over this much depth (it hugs the ground: no hard line where it crosses a drift)
const WISP_COVER: f32 = 0.3;         // how much of what is behind it a wisp hides per unit of its weight (the rest is light added: thin blown snow, not a card)
const WISP_MOTE_M: f32 = 0.012;      // m: a mote of a puff is this far across (particles_draw.wgsl wispMotes) …
const WISP_MOTE_CELL: f32 = 0.09;    // m: … one to a cell this wide on the finest of its three sheets (the others 1.6 and 2.2 × as coarse)
const WISP_MOTE_DRIFT: f32 = 0.12;   // m/s: how fast the sheets slide past one another along the puff's motion (the shimmer: the motes are never a fixed pattern)
const WISP_MOTE_SHEAR: f32 = 0.3;    // m/s: the spread of the ROWS' own speeds within a sheet (grains stream past their neighbours: ± half this)
const WISP_MOTE_DIM: f32 = 0.3;      // a mote thinner than the picture can draw is dimmed by its true area, never below this (far off it is still a grain, not nothing)
const WISP_MOTE_GAIN: f32 = 5.0;     // × the puff's weight = a mote's own
const WISP_GLINT: f32 = 3.0;         // × a mote's light at the top of a glint, asked for in full
const WISP_HAZE: f32 = 0.16;         // the puff's own soft body under its motes, of the old streak's weight (so a far puff, its motes under a pixel, is still there)
const WISP_HAZE_FAR: f32 = 0.5;      // + this × the haze where the motes are too fine for the picture to hold (a far puff: its sheets fade into its body, the puff keeps its weight)
const RAIN_P_GAIN: f32 = 0.045;      // fraction of the irradiance at a drop scattered toward the eye, per unit of kp brightness — calibrated on the lattice: its streak carries E × 0.11 × ⅔ × 6 mm
                                     // × 0.65 per metre of length; an 8 mm-wide splat streak of radiance E × g carries E × g × 8 mm, and the splat's head-to-tail ramp averages 0.8 → g ≈ 0.045
const RAIN_SPLASH_DROPLETS: u32 = 4u; // secondary droplets a landing throws out with its ring (drawn procedurally in the ONE quad the drop becomes: no allocation, the true landing point)

fn unpackRgb8(c: u32) -> vec3f { return vec3f(f32(c & 255u), f32((c >> 8u) & 255u), f32((c >> 16u) & 255u)) / 255.0; }

// the spark's colour ramp (game/sparks.ts boxes(): white-hot → orange → red as it cools; e is meant to clip — the bloom is the glow)
const SPARK_EMISSIVE: f32 = 25.0;   // effects.ts sparks.emissive: HDR radiance at f = 1 before brightness
fn sparkRadiance(u: f32, hold: f32, brightness: f32) -> vec3f {
  let f = select(max(0.0, 1.0 - (u - hold) / max(1e-3, 1.0 - hold)), 1.0, u < hold);
  let e = f * f * brightness * SPARK_EMISSIVE;
  return vec3f(e, e * (0.35 + 0.5 * f), e * (0.08 + 0.25 * f * f));
}

// STEAM (game/snowBreath.ts; render/particles.ts EmitOpts.steam): a DUST puff whose colour word's top byte is under 255 is warm breath — that byte ÷ 254 is × its
// peak opacity, and it rises where a puff of dust settles. Every other record carries 255 there: 1 from this, and nothing of theirs is changed.
fn steamIs(color: u32) -> bool { return (color >> 24u) != 255u; }
fn steamOf(color: u32) -> f32 { return select(1.0, f32(color >> 24u) * (1.0 / 254.0), steamIs(color)); }
// EMBER (game/fire.ts; render/particles.ts EmitOpts.ember): a SPARK whose colour word's top byte is under 255 is an ember off an open fire — that byte ÷ 254 is ×
// its light. It rides the fire's hot air up (EMBER_LIFT over its own weight, against the kind's drag: about two metres a second at most), wanders as it goes
// (EMBER_SWIRL) and goes with the wind, where a spark flies and falls; and it cools slowly, yellow off the fire, then orange, then a red that dies. Every other
// spark carries 255 there and is as it was.
const EMBER_LIFT: f32 = 3.2;     // m/s²
const EMBER_SWIRL: f32 = 1.4;    // m/s² across, turning
fn emberIs(kind: u32, color: u32) -> bool { return kind == P_SPARK && (color >> 24u) != 255u; }
fn emberRadiance(u: f32, color: u32, brightness: f32, seed: u32, age: f32) -> vec3f {
  let ph = f32(seed & 1023u) * 0.00614;
  let tw = 0.65 + 0.35 * sin(age * 31.0 + ph * 3.0);                                   // (no two alike, and none steady)
  let e = brightness * SPARK_EMISSIVE * (f32(color >> 24u) * (1.0 / 254.0)) * pow(max(1.0 - u, 0.0), 1.6) * tw;
  return e * mix(mix(vec3f(1.0, 0.5, 0.09), vec3f(1.0, 0.24, 0.02), smoothstep(0.0, 0.35, u)), vec3f(0.8, 0.07, 0.004), smoothstep(0.3, 0.9, u));
}
