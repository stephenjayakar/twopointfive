// ReSTIR DI direct lighting (renderer v3 Phase 2a) — settings.restir ON (the default); direct.wgsl is the OFF path, untouched.
// Same inputs, same four outputs (per emitter class c ∈ {0 sharp, 1 broad}: S = shadowed estimate + signed penumbra hint, U = exact unshadowed
// total), so dtemporal / softblur / composite consume it unchanged. What differs is how S is estimated:
//
//   Every light the tile can see is still scored unshadowed per pixel (evalLight, exact — that is U, and it is the candidate pdf). Per class the
//   integrand is Σ_i E_i·V_i over the class's lights; the only unknown is visibility V. Instead of K leaders × stratified rays + a tail ray, each
//   pixel keeps ONE reservoir per class — a sample y = (light, point on its emitter) with an unbiased contribution weight W — and spends a fixed,
//   light-count-independent ray budget per frame (ru.cfg.x, 2‥6 rays a pixel):
//     FRESH      one candidate drawn ∝ its exact unshadowed luminance (weighted reservoir sampling inside the scoring loop; RIS with p ∝ p̂, so a
//                single draw IS a draw from the target), shadow-rayed → V, blocker distance (the penumbra hint);
//     TEMPORAL   last frame's reservoir at the reprojected pixel (its own depth signature validates the surface), its light re-mapped by identity
//                (ru.fwd: last frame's slot → this frame's; gone = dropped), RE-TRACED from here (torches, doors and men move every frame; a sample
//                that was visible and now is not is let go), its confidence M scaled by how much its own target changed (p̂ now vs p̂ then, either
//                way: a swept-away cone, a switched-off panel, a restrike's stroke lets go at once) and by a per-tile temporal GRADIENT (the tile's
//                fresh 1-spp estimates vs its temporal ones: a shadow arriving or leaving, a door letting light in, resets the tile's history in a
//                frame instead of converging at the M-cap's EMA rate). A pixel whose samples all came back dark keeps a ZERO-WEIGHT reservoir with
//                its M — 'looked, was dark' is information; keeping only lit outcomes biased every soft shadow bright;
//     DOMAIN     the reservoir belongs to the surface point at the UNJITTERED pixel centre (ru.jitter): every ray leaves it and the reprojection
//                starts from it, so TAAU's jitter never hands a pixel its neighbour's reservoir (whose visibility is not its own: −4‥10 % in soft
//                shadow when it did). U stays exact at the jittered point; only the shadow term sits ≤ ½ px off, under the ratio-space blur anyway;
//     COMBINE    generalized balance-heuristic MIS between the two using LAST frame's light list for the fresh candidate's 'target then'
//                (ru.prevLights / ru.inv) — a light that did not exist last frame (muzzle flash, lightning, a restrike) enters at full weight, so
//                transients light instantly and, holding no history once gone, leave nothing behind; M capped at ru.cfg.z;
//     SPATIAL    k taps (ru.cfg.y) on neighbours' temporal reservoirs (last frame's, at the neighbour's own reprojection — no intra-frame
//                dependency, one dispatch), plane / normal rejection, pairwise MIS against the canonical sample; a neighbour's stored visibility
//                stands in for ours unless the budget affords the final ray (cfg.x ≥ 5) — so below that the spatial pass only runs where the pixel's
//                own history is young (M < cfg2.z: disocclusions, resets), where its bias is transient;
//     SHADE      luminance Σw over every sample traced this frame (temporal, fresh, accepted neighbours) = the unbiased estimate of the class's visible
//                light, capped at its live unshadowed total; its COLOUR is hue(Σ_i E_i·β_i) — every live light's exact unshadowed irradiance at this
//                pixel weighted by a visibility BELIEF β_i ∈ {0, 1} (BELIEFS below) — × the glass tint of the reservoir's own light. (The first cut
//                shaded Σ_j hue(light_j)·w_j, each sample in its own light's colour: unbiased per channel, but ONE sample's hue is not the class's —
//                under the break room's red and blue vending fronts every pixel wore the colour of whichever panel its reservoir held and the lino
//                came out a red / blue mosaic crawling at the reservoir's rate; that form survives as the fallback and as an A/B bit, ru.cfg.w & 8.)
//     BELIEFS    per 8×8 tile, a DARK and a LIT bit a light slot, in one record per tile behind the reservoirs in the same buffer, remapped by
//                identity like them: DARK = rays were spent on the light from this tile and every one came back blocked; LIT = some ray of the tile
//                saw it. A light is 'tile-dark' HERE when it is DARK here and LIT in none of the 5×5 tiles round this one (a street lamp behind the
//                outer wall, the corridor's panel behind the shut door: in U, reach level > 0, visible nowhere near — 45 % of the fresh rays under
//                those vending fronts) — so a shadow EDGE (lit a tile or two away) sweeping into a tile is sampled per pixel as it always was, not
//                discovered a tile at a time (the door test drew 8×8 stair-steps along the leaf's retreating shadow without the neighbourhood). β 1
//                otherwise; a DARK bit not re-earned on the tile's next audit frame clears, a LIT bit stands until contradicted (stale, it only puts a
//                light back into the unbiased draw — and back into the hue and the hint gate near by, which darkSlot covers per pixel), and the host zeroes
//                every record on a camera cut, where a screen tile's verdicts describe some other piece of the world. Plus one 6-bit
//                `darkSlot` per pixel in the texel's spare bits: the light this pixel's own fresh ray last found dark where the tile has it lit —
//                the inside of a coloured shadow keeps the other light's hue. β colours S and gates the blur hint (a blocked ray toward a tile-dark
//                light measures no penumbra); and a tile-DARK light leaves the FRESH DRAW: it is known dark exactly as a reach-masked light is —
//                in U, no ray, its true 0 without the one-sample all-or-nothing noise (a street lamp behind the wall holding 45‥80 % of the lino's
//                unshadowed total made the estimate an EMA of coin flips: ±15‥30 % per pixel, crawling — the 'dark speckle'). On ru.cfg2.w (¼) of
//                its frames, staggered across tiles, every lane of a tile spends one extra AUDIT ray on the dark set, drawn ∝ unshadowed weight,
//                whose outcome only votes (whole tiles at once: a SIMD group half-filled with audit rays paid for all of them): a verdict the scene
//                overturns (the door opening on the corridor's panel) falls within an audit period of the light arriving, tile by tile. The price, in expectation: a light visible from a sliver of a tile that no reservoir in the tile holds lit reads dark by
//                its share on that sliver until an auditor there draws it (ru.cfg.w & 16 = the unbiased first-cut draw, for A/B).
//     TRANSIENT  lights (the kind word's 256 bit: muzzle flashes, tracer heads, the lightning — one to thirty frames each) are a STRATUM OF THEIR OWN: never a
//                candidate, never in a reservoir, one dedicated shadow ray per pixel per class each frame they reach it (one transient importance-picked ∝ its
//                unshadowed weight if several do), their E × V added to S exactly and their hue with it — what the leader path gave a flash, and what the cascades /
//                gather / froxels already do with transients (history-free). Through the reservoirs a stroke of lightning lost a tenth of its floor on the frame it
//                struck (the pixels whose one fresh draw fell on the moon or a lamp instead) and its second return stroke came through MIS at half height a frame
//                late (a 13× jump against twenty frames of confidence in its own decayed record): docs/internal/tjank.md §B. U counts them (exact, as ever); the
//                denoiser's jump yardstick (U.a) counts them too, so their arrival and departure are light-jumps there; the believed-visible hue Uv does not.
//     HELD       (the HYBRID estimator, lane v3/direct-quality; ru.cfg.x bits 8‥11 = K, 0 = off: the transient stratum above exactly as it was) — every light with an
//                OWNER (a character carries it: the guards' torches, Sam's rail / gun light, muzzle flashes and tracer heads — a handful at once) bypasses the reservoirs at
//                every pixel it reaches and gets the OLD LEADER TREATMENT every frame: the two strongest such lights at the pixel take K STRATIFIED emitter samples each
//                (shadowSample's golden-ratio disk sequence) and are shaded exactly, E × mean visibility, in their own colour through their own panes; any further ones
//                are an importance-picked tail per class with one ray (W_tail × V, the old tail ray). Never a candidate, a belief or a reservoir; U counts them (exact as
//                ever), the denoiser's jump yardstick U.a counts them (a torch sweeping onto the pixel IS a light change there), the believed-visible hue does not. Why: a
//                carried light MOVES every frame — its target at a pixel changes as the cone sweeps and the man walks, the confidence cut lets the history go, the shadow
//                client's light-motion cue drops its ratio history, and the pool was shaded from one or two fresh rays a pixel: noisy pools, ragged cone edges, rims where
//                the cone crossed thin geometry ("the flashlight direct lighting seems like a huge regression now. very noisy and lots of rims" — the maintainer, at high;
//                ?norestir "looks great"). Static lights (owner 0: panels, lamps, vending fronts, the moon) keep ReSTIR unchanged. Bounded by construction: only the pixels
//                a held light reaches, ≤ 2K + 2 rays there.
//     MOTION     (lane fix/direct-motion, docs/internal/direct-motion.md; compiled in only under the prepended `const RESTIR_MOTION = true` — passes.ts builds the module twice and takes
//                this program while settings.restirMotion ≠ 0, so 0 = the program above byte for byte). Under CAMERA motion the temporal reuse above flows: a pan of v px a frame
//                reprojects every pixel to the NEAREST texel ⌊x − v + ½⌋, so at v = 2.44 the whole raster inherits from x − 2 while the picture moved 2.44 — the reservoir pattern
//                slides 0.44 px a frame across the floor the resolve holds still, and after M frames a lineage was drawn and validated for points up to M × 0.44 px behind the
//                pixel: 2–7-px blotches crawling under a panning floor and busier penumbra edges (docs/internal/gi-motion.md measured it: ReSTIR calmer than the leader path ×2‥40 at
//                rest, ×1.5‥2 noisier under a pan). Three switchable parts, each on ru.mot / cfg.w: (a, 256) STOCHASTIC-BILINEAR reprojection — the texel inherited is one of
//                the four round the reprojected point, drawn with its bilinear weight from a per-pixel-per-frame hash (a neighbour's spatial tap at pixel q re-derives q's own
//                pick), each candidate validated by its depth signature exactly as the nearest one was and a rejected one handing its probability to the rest (none valid = no
//                history, as before): the EXPECTED source is the exact reprojected point, so a lineage follows the surface and diffuses ±½ px instead of sliding as a sheet, and
//                neighbouring pixels stop sharing one verdict; at rest the fractional offset is 0 and the pick is today's texel with probability 1 (a ±0.02 dead zone makes that
//                exact in floating point); (b, 512) MOTION-SCALED CONFIDENCE — the M cap at the pixel whole under mot.x px a frame of its own motion (camera + gVel, measured off the raster's
//                point) and × mot.y past MOTION_RAMP × that, a smoothstep between: a panning pixel leans on fresh candidates, whose error is white frame to frame and the ratio filter + the resolve DO average, instead of on
//                a history validated somewhere else; full memory the moment it rests; (c, 1024) spatial reuse at every pixel whose motion exceeds ru.mot.z px, with at least cfg.y >> 8 taps
//                there (spatialAll — and wider — where the history is being handed about anyway, nothing extra at rest). U, the beliefs, the hint, the held / transient strata are untouched by all three.
//   The reservoir written for next frame is the TEMPORAL stage's (spatial output feeds shading only: no M inflation loop).
// Kept from direct.wgsl: the tile light list (FLAG_TILECULL, verbatim), reach masks (a walled-off light is in U, never a candidate, dark in S), glass
// transmit on the shaded sample, the owner byte, mesh shadows (inside occludedT), the sun / moon as an ordinary candidate (kind 2). Ignored here:
// FLAG_CHECKER_DIRECT, dimRays, the leader ray budgets (directCfg.xy) — the ray budget is ru.cfg.x, per pixel, whatever the light count.
const Z_RELEASE: f32 = 2.0;   // (see 'trailing edge' in phase 2)
const MOTION_RAMP: f32 = 1.6;  // MOTION (b): the confidence cut ramps from none at ru.mot.x px a frame to its floor at MOTION_RAMP × that
/** the light bypasses the reservoirs this frame: a transient always; under the HYBRID (header HELD) every light a character carries (owner byte ≠ 0) */
fn stratumLight(li: Light, hybrid: bool) -> bool { return lightTransient(li) || (hybrid && (li.owner & 0xffu) != 0u); }
@group(1) @binding(0) var gDepth: texture_depth_2d;
@group(1) @binding(1) var gNormal: texture_2d<f32>;
@group(1) @binding(2) var gId: texture_2d<u32>;
@group(1) @binding(3) var outSharpS: texture_storage_2d<rgba16float, write>;   // rgb = S (sharp class), a = blur radius hint 0..1 (x MAX_BLUR_PX), negative = own
@group(1) @binding(4) var outSharpU: texture_storage_2d<rgba16float, write>;   // rgb = U (sharp class, unshadowed), a = luminance of the believed-visible part of it (the denoiser's light cues)
@group(1) @binding(5) var outBroadS: texture_storage_2d<rgba16float, write>;
@group(1) @binding(6) var outBroadU: texture_storage_2d<rgba16float, write>;
@group(1) @binding(7) var gVel: texture_2d<f32>;   // the g-buffer's per-pixel OBJECT motion (TAAU's, gbuffer.wgsl GOut.vel): ndc of where this surface point WAS last frame minus where it IS, both through prevViewProj; 0 for rigid geometry

struct RestirU {
  cfg: vec4u,                     // x = shadow rays per pixel per frame (2‥6), y = spatial taps k (0 = off), z = M cap (1‥30), w = flags: 1 = tile gradient confidence, 2 = spatial everywhere (not only young pixels), 4 = tile-coherent fresh draws, 8 = A/B: shade each sample in its own light's hue (the first cut) instead of the belief-weighted class hue, 16 = A/B: tile-dark lights stay in the fresh draw (the unbiased first cut; no audits), 32 = A/B: the temporal confidence cut by the RAW target ratio (intensity changes drop history — the 08-11 rule) instead of the power-normalised one, 64 = D4 permutation, 128 = hue split; MOTION (the RESTIR_MOTION program only): 256 = stochastic-bilinear reservoir reprojection, 512 = motion-scaled confidence, 1024 = spatial reuse wherever the pixel moves
  cfg2: vec4f,                   // x = spatial radius (px at this resolution), y = gradient threshold (the tile's z statistic under which history keeps full confidence; 0 past 1.6×), z = 'young' M threshold for spatial reuse below cfg.x 5, w = audit fraction: the share of lanes that spend one extra ray a frame testing a tile-dark light (votes only; 0‥1)
  jitter: vec4f,  // xy = this frame's TAAU jitter in internal px, zw = the previous render's (the reservoir domain is the UNJITTERED pixel centre: traced from there, reprojected from there)
  mot: vec4f,     // MOTION (header; read only by the RESTIR_MOTION program, cfg.w bits 256 / 512 / 1024 switch its three parts): x = the screen motion (px a frame at THIS resolution — the host scales its per-1000-rows knob) under which the history keeps its full confidence · y = the floor of the cut past MOTION_RAMP × x (fraction of the M cap) · z = the motion (px) past which spatial reuse runs at the pixel · w = spare
  fwd: array<vec4u, 4>,           // last frame's light slot p → this frame's slot (byte p; 255 = that light is not uploaded this frame)
  inv: array<vec4u, 4>,           // this frame's slot → last frame's (255 = the light is new this frame)
  prevLights: array<Light, 64>,   // last frame's uploaded light records (positions, cones, intensities as they were): the fresh candidate's 'target then'
};
@group(2) @binding(0) var<storage, read> resIn: array<vec4u>;          // last frame's reservoirs (temporal stage), 8×8-tiled: x,y = class 0, z,w = class 1 (layout: pack / unpack below); then one belief record per tile (tileRecIndex)
@group(2) @binding(1) var<storage, read_write> resOut: array<vec4u>;   // this frame's
@group(2) @binding(2) var<uniform> ru: RestirU;

var<workgroup> wgLights: array<Light, 64>;
// per-tile light culling — the same statements as direct.wgsl (its exactness argument holds word for word: a culled light scores !ok at every live pixel)
var<workgroup> wgP: array<vec4f, 64>;
var<workgroup> wgRowMin: array<vec4f, 8>;
var<workgroup> wgRowMax: array<vec4f, 8>;
var<workgroup> wgKeep: array<u32, 64>;
var<workgroup> wgList: array<u32, 64>;
var<workgroup> wgCount: u32;
var<workgroup> wgGlass: array<u32, 64>;
var<workgroup> wgGrad: vec4f;                 // the tile's temporal-gradient confidence per class (x = class 0, y = class 1) after the reduction
// the tile's light beliefs (header): last frame's record in, remapped to this frame's slots for every lane to read, this frame's votes, the record out
var<workgroup> wgTileIn: vec4u;                       // last frame's record of THIS tile, by last frame's slots: .xy bit s = DARK (tried from this tile, blocked every time), .zw bit s = LIT (some ray of this tile saw it)
var<workgroup> wgNbLit: array<vec2u, 25>;            // the LIT words of the 5×5 tiles round this one (itself included), last frame's: a light lit ANYWHERE that near is never left out of the draw here —
                                                      // a shadow edge sweeping into this tile (an opening door's, a walking man's) is sampled per pixel as it always was, not discovered a tile at a time
var<workgroup> wgBelief: array<atomic<u32>, 2>;      // the EFFECTIVE dark set by this frame's slots — dark here and lit nowhere near (a lane snapshots it into registers once built)
var<workgroup> wgOwn: array<atomic<u32>, 4>;         // this tile's own DARK (0‥1) / LIT (2‥3) bits by this frame's slots: what the record out carries for the lights nobody tries this frame
var<workgroup> wgSeen: array<atomic<u32>, 4>;        // this frame's traced outcomes as two 64-bit masks over the slots: words 0‥1 = some ray of the tile found it LIT, 2‥3 = some ray found it BLOCKED
var<workgroup> wgTileOut: array<atomic<u32>, 4>;     // the record next frame inherits (dark 0‥1, lit 2‥3)
var<workgroup> wgStash: array<vec4f, 64>;            // (with wgP) parks Uv / Wf across the trace loop: live registers through the inlined tracer are what this pass pays for
var<workgroup> wgHeld: array<vec4f, 128>;            // HELD: the two leaders' exact irradiance at the pixel (E, slot in .w) parked across the trace loop like Uv / Wf (lidx, lidx + 64)
fn tileRecIndex(t: vec2u, dims: vec2u) -> u32 { let tilesX = (dims.x + 7u) >> 3u; let tilesY = (dims.y + 7u) >> 3u; return ((tilesX * tilesY) << 6u) + t.y * tilesX + t.x; }   // (passes.ts allocRestir sizes the buffer: whole tiles × 64 texels, then one 16-B record a tile: dark mask .xy, lit mask .zw — the neighbourhood load above inlines the same sum)
fn tileDark(bel: vec2u, s: u32) -> bool { return ((bel[s >> 5u] >> (s & 31u)) & 1u) != 0u; }
// A second rng stream shared by the whole 8×8 tile (seeded off the workgroup, advanced in lockstep: every lane walks the same light list) for the FRESH pick and its
// emitter point when ru.cfg.w bit 4 is set: the 64 lanes then draw the same light and trace near-parallel rays — a SIMD group walking one sort of ray instead of
// three (−0.6 ms of 4 at high on the M4). Each pixel's own draw is still exactly ∝ its own weights (unbiased per pixel); what changes is that the one-sample noise
// is correlated across the tile for that frame (the history decorrelates it over frames). Off = an independent draw per pixel.
var<private> rngTile: u32;
fn rndTile() -> f32 { rngTile = rngTile * 747796405u + 2891336453u; var w = ((rngTile >> ((rngTile >> 28u) + 4u)) ^ rngTile) * 277803737u; w = (w >> 22u) ^ w; return f32(w) * (1.0 / 4294967296.0); }
fn rndPick(coh: bool) -> f32 { if (coh) { return rndTile(); } return rnd(); }

fn fwdSlot(p: u32) -> u32 { return (ru.fwd[p >> 4u][(p >> 2u) & 3u] >> ((p & 3u) * 8u)) & 255u; }
fn invSlot(s: u32) -> u32 { return (ru.inv[s >> 4u][(s >> 2u) & 3u] >> ((s & 3u) * 8u)) & 255u; }

// ---- reservoir texel: 64 bits per class + a 12-bit view-depth signature split over the two ----
//   word A: slot 6 | M 5 | Vq 3 | iu 4 | iv 4 | hint 4 | depth6 6      word B: W f16 | p̂ log-12 | 3 darkSlot (low 3 in class 0's word, high 3 in class 1's) | valid 1 (bit 31)
// (iu, iv) name one of 256 fixed points on the emitter disk (the fresh candidate is drawn ON that lattice, so 'the sample' is exactly representable and
// the temporal re-trace hits the very point that was found visible); Vq = visibility incl. smoke in eighths; hint = last measured own penumbra (px, log
// scale, 0 = none) kept one extra frame; p̂ = the sample's target (unshadowed luminance) where and when it was selected — what MIS calls p̂_i(x_i).
// Kept as the two raw words everywhere (registers: this pass traces up to six rays a lane, and every live value taxes all of them) and read by field:
fn rValid(b: u32) -> bool { return (b & 0x80000000u) != 0u; }
fn rSlot(a: u32) -> u32 { return a & 63u; }
fn rM(a: u32) -> f32 { return f32((a >> 6u) & 31u); }
fn rV(a: u32) -> f32 { return f32((a >> 11u) & 7u) / 7.0; }
fn rIu(a: u32) -> u32 { return (a >> 14u) & 15u; }
fn rIv(a: u32) -> u32 { return (a >> 18u) & 15u; }
fn rHint(a: u32) -> f32 { let c = (a >> 22u) & 15u; if (c == 0u) { return 0.0; } return 0.75 * exp2(f32(c - 1u) / 14.0 * 5.415); }   // 0.75 ‥ 32 px
fn rW(b: u32) -> f32 { return unpack2x16float(b & 0xffffu).x; }
fn rPh(b: u32) -> f32 { let c = (b >> 16u) & 4095u; if (c == 0u) { return 0.0; } return exp2(f32(c) / 127.96875 - 20.0); }   // 2^-20 ‥ 2^12, 0.54 % steps
fn hintEncode(px: f32) -> u32 { if (px <= 0.0) { return 0u; } return u32(clamp(round(log2(px / 0.75) / 5.415 * 14.0), 0.0, 14.0)) + 1u; }
fn phEncode(p: f32) -> u32 { if (p <= 0.0) { return 0u; } return u32(clamp(round((log2(p) + 20.0) * 127.96875), 1.0, 4095.0)); }
fn depthEncode(w: f32) -> u32 { return u32(clamp(round(log2(max(w, 0.25) / 0.25) * 455.0), 0.0, 4095.0)); }   // 0.25 ‥ 128 m, 0.15 % steps
fn texelDepth(t: vec4u) -> f32 { return 0.25 * exp2(f32(((t.x >> 26u) << 6u) | (t.z >> 26u)) / 455.0); }
/** words for (slot, M, V, iu, iv, hint px, W, p̂) — M ROUNDED (× a target ratio a hair under 1 a truncated M would never climb past 1) */
fn packRes(slot: u32, M: f32, V: f32, iu: u32, iv: u32, hint: f32, W: f32, ph: f32, d6: u32) -> vec2u {
  let a = (slot & 63u) | (u32(clamp(round(M), 0.0, 31.0)) << 6u) | (u32(clamp(round(V * 7.0), 0.0, 7.0)) << 11u) | ((iu & 15u) << 14u) | ((iv & 15u) << 18u) | (hintEncode(hint) << 22u) | (d6 << 26u);
  let b = (pack2x16float(vec2f(min(W, 60000.0), 0.0)) & 0xffffu) | (phEncode(ph) << 16u) | 0x80000000u;
  return vec2u(a, b);
}
fn resIndex(p: vec2u, dims: vec2u) -> u32 { let tilesX = (dims.x + 7u) >> 3u; return (((p.y >> 3u) * tilesX + (p.x >> 3u)) << 6u) | ((p.y & 7u) << 3u) | (p.x & 7u); }
/** the emitter point a lattice cell names, as shadowSample's (ur, ua) */
fn latticeUV(iu: u32, iv: u32) -> vec2f { return vec2f((f32(iu) + 0.5) / 16.0, (f32(iv) + 0.5) / 16.0); }

// MOTION (header): the screen motion, in px of this raster, that the LAST prevTexelAt call measured for its pixel (the reprojected point vs the pixel's own unjittered centre —
// 0 for a still surface under a still camera whatever TAAU's jitter does); main() reads it straight after its own call, before any spatial tap's call overwrites it
var<private> mvPx: f32 = 0.0;
/** a per-pixel-per-frame uniform variate in [0, 1) off a hash of (pixel, frame, k) — NOT the lane's stream: a spatial tap reading pixel q's history must land on the texel q itself drew */
fn motHash(px: vec2u, k: u32) -> f32 {
  var h = (px.x * 0x9E3779B1u) ^ (px.y * 0x85EBCA77u) ^ (frame.frameIdx * 0xC2B2AE3Du) ^ (k * 0x27D4EB2Fu);
  h ^= h >> 15u; h *= 0x2C1B3C6Du; h ^= h >> 12u; h *= 0x297A2D39u; h ^= h >> 15u;
  return f32(h >> 8u) * (1.0 / 16777216.0);
}
/** last frame's temporal-stage reservoir texel for the surface point Pw now at pixel `px` (reprojected with prevViewProj + the g-buffer's object motion at px — a walking man's
 *  own pixels follow him — validated against the texel's own depth signature, dtemporal's test); all zero (both classes invalid) when the surface was not there */
fn prevTexelAt(Pw: vec3f, Px: vec3f, px: vec2u, dims: vec2u, canonical: bool) -> vec4u {
  let pclip = frame.prevViewProj * vec4f(Pw, 1.0);
  if (pclip.w <= 0.0) { return vec4u(0u); }
  let vel = textureLoad(gVel, px, 0).xy;
  let uv = (pclip.xy / pclip.w + vel) * vec2f(0.5, -0.5) + 0.5;
  var qf = uv * vec2f(dims) - ru.jitter.zw;                 // Pw is an unjittered-centre point; in last frame's JITTERED raster it sat at (its unjittered position + that frame's jitter) — undo it
  if (RESTIR_MOTION && (canonical || (ru.cfg.w & 256u) != 0u)) {   // (a spatial tap's call needs the flow only to re-derive the neighbour's stochastic pick (a); its mvPx is never read — three taps × two mat-vecs a pixel measured +0.2 ms at rest otherwise)
    // The MOTION is measured off the raster's OWN point Px (the g-buffer's exact surface point at this jittered pixel), not off Pw: Pw is rebuilt from this pixel's depth at the
    // unjittered centre and pushed back onto the tangent plane, which on a floor seen obliquely leaves it a few tenths of a pixel beside the true unjittered-centre point,
    // by an amount that changes with the jitter phase — harmless for a nearest-texel pick (always under ½ px at rest), but a bilinear pick would hand a STILL pixel its
    // neighbour's history three frames in ten. Px reprojects exactly: unjittered position last frame (uv·dims − that jitter) minus unjittered position now (px + ½ − this
    // jitter) is 0 to float precision at rest and the true flow under motion; the domain point went where Px went (the same surface, half a pixel apart).
    let pc = frame.prevViewProj * vec4f(Px, 1.0);
    if (pc.w > 0.0) {
      let d = ((pc.xy / pc.w + vel) * vec2f(0.5, -0.5) + 0.5) * vec2f(dims) - ru.jitter.zw - (vec2f(px) + 0.5 - ru.jitter.xy);
      mvPx = length(d);
      if ((ru.cfg.w & 256u) != 0u) { qf = vec2f(px) + 0.5 + d; }   // (a) reprojects the domain point by that flow; (b) / (c) alone keep today's qf and only read mvPx
    } else { mvPx = 1e6; }
  }
  if (any(qf < vec2f(0.0)) || any(qf >= vec2f(dims))) { return vec4u(0u); }
  if (RESTIR_MOTION && (ru.cfg.w & 256u) != 0u && ru.mot.w > 0.5) {
    // (a′) GLOBAL DITHER: the whole raster rounds qf with ONE sub-pixel offset this frame (an R2 low-discrepancy sequence off the frame index) — where the flow is smooth that is a
    // bijective shift, so no lineage is duplicated or dropped (the per-pixel draw below lets two neighbours adopt one parent: lineages coalesce into patches that grow ~√M px),
    // and over frames the shifts ⌊v + u⌋ average to the true flow v: the pattern stays registered on the surface to ± ½ px instead of sliding off it at fract(v) px a frame.
    // A rejected texel falls back to today's nearest, then to none. At rest (flow under 0.02 px) the pixel keeps its own texel whatever u says.
    let u2 = fract(vec2f(0.75487767, 0.56984029) * f32(frame.frameIdx & 4095u) + 0.5);
    let own = vec2f(px) + 0.5;
    var h1 = vec2i(floor(qf - 0.5 + u2)); if (all(abs(qf - own) < vec2f(0.02))) { h1 = vec2i(px); }
    let tol = 0.02 + 0.006 * pclip.w;
    if (all(h1 >= vec2i(0)) && all(h1 < vec2i(dims))) { let t = resIn[resIndex(vec2u(h1), dims)]; if (abs(texelDepth(t) - pclip.w) < tol) { return t; } }
    let h2 = vec2i(floor(qf));   // (qf is on the raster: checked above)
    if (any(h2 != h1)) { let t = resIn[resIndex(vec2u(h2), dims)]; if (abs(texelDepth(t) - pclip.w) < tol) { return t; } }
    return vec4u(0u);
  }
  if (RESTIR_MOTION && (ru.cfg.w & 256u) != 0u) {
    // (a) STOCHASTIC-BILINEAR: one of the four texels round qf, drawn with its bilinear weight, validated by depth like the nearest one; a rejected candidate's probability goes to the rest.
    // Texel centres sit at integer + ½: the four round qf are ⌊qf − ½⌋ + {0,1}²; a fraction inside ±0.02 of a texel centre snaps to it (at rest qf IS the pixel's own centre but for
    // float error, and the pick must then be today's texel with certainty — the still picture stays ReSTIR's still picture).
    let b = qf - 0.5; let base = floor(b); var f = b - base;
    f = select(f, vec2f(0.0), f < vec2f(0.02)); f = select(f, vec2f(1.0), f > vec2f(0.98));
    var w = vec4f((1.0 - f.x) * (1.0 - f.y), f.x * (1.0 - f.y), (1.0 - f.x) * f.y, f.x * f.y);   // (0,0) (1,0) (0,1) (1,1)
    let bi = vec2i(base); let tol = 0.02 + 0.006 * pclip.w;
    // off the raster = weight 0 (qf itself is on it, so at least one candidate carries weight)
    if (bi.x < 0) { w.x = 0.0; w.z = 0.0; } if (bi.x + 1 >= i32(dims.x)) { w.y = 0.0; w.w = 0.0; }
    if (bi.y < 0) { w.x = 0.0; w.y = 0.0; } if (bi.y + 1 >= i32(dims.y)) { w.z = 0.0; w.w = 0.0; }
    for (var k = 0u; k < 4u; k++) {
      let ws = w.x + w.y + w.z + w.w; if (ws <= 0.0) { break; }
      var r = motHash(px, k) * ws; var i = 0u;
      if (r >= w.x) { r -= w.x; i = 1u; if (r >= w.y) { r -= w.y; i = 2u; if (r >= w.z) { i = 3u; } } }
      if (w[i] <= 0.0) { i = select(select(select(0u, 1u, w.y > 0.0), 2u, w.z > 0.0), 3u, w.w > 0.0); }   // (float slop at the top of the CDF: never land on a zero-weight candidate)
      let cand = vec2u(bi + vec2i(i32(i & 1u), i32(i >> 1u)));
      let t = resIn[resIndex(cand, dims)];
      if (abs(texelDepth(t) - pclip.w) < tol) { return t; }
      w[i] = 0.0;   // not this surface: the rest share its probability
    }
    return vec4u(0u);
  }
  var hp = vec2u(qf);
  if ((ru.cfg.w & 64u) != 0u) {   // D4 PERMUTATION SAMPLING: the texel swapped within its 2×2-ish block by a per-frame XOR pattern (offset off the frame index) — a neighbour's history, whiter noise over frames; the depth test below still guards edges
    let h = frame.frameIdx * 2654435761u; let off = vec2i(i32(h >> 30u), i32((h >> 28u) & 3u));
    let q2 = ((vec2i(hp) + off) ^ vec2i(3)) - off;
    hp = vec2u(clamp(q2, vec2i(0), vec2i(dims) - 1));
  }
  let t = resIn[resIndex(hp, dims)];
  if (abs(texelDepth(t) - pclip.w) >= 0.02 + 0.006 * pclip.w) { return vec4u(0u); }
  return t;
}

/** one shadow ray to lattice point (iu, iv) of light slot `s`: (visibility incl. smoke, penumbra width at the receiver in metres or −1 if clear) — shadowSample with n = 1 */
fn traceSample(s: u32, Po: vec3f, N: vec3f, owner: u32, iu: u32, iv: u32) -> vec2f { return shadowSample(wgLights[s], Po, N, owner, 0u, 1u, latticeUV(iu, iv)); }
/** unshadowed target of light slot `s` at (P, N) — 0 when it does not reach (or the reach mask walls it off, `masked`) */
fn targetAt(s: u32, P: vec3f, N: vec3f, masked: bool) -> f32 { if (masked && lightReachLevel(s, P) == 0u) { return 0.0; } let e = evalLight(wgLights[s], P, N); return select(0.0, luminance(e.E), e.ok); }
/** the hue (colour ÷ its luminance) of light slot `s`: evalLight scales the light's colour by a scalar, so this is the hue of its irradiance anywhere it reaches */
fn hueOf(s: u32) -> vec3f { let cl = wgLights[s].color; return cl / max(luminance(cl), 1e-6); }
/** penumbra hint (px) from a blocked ray's width `pw` (m) for a light carrying `share` of the class's luminance — direct.wgsl's rule */
fn hintPx(pw: f32, pxPerMetre: f32, share: f32) -> f32 { return max(0.75, pw * pxPerMetre * min(1.0, share * 2.0)); }

@compute @workgroup_size(8, 8)
fn main(@builtin(workgroup_id) wid: vec3u, @builtin(local_invocation_index) lidx: u32) {
  let nL = min(frame.numLights, 64u);
  for (var i = lidx; i < nL; i += 64u) { wgLights[i] = lights[i]; }
  let gxy = wid.xy * 8u + vec2u(lidx & 7u, lidx >> 3u);
  let dims = textureDimensions(gDepth);
  let onScreen = gxy.x < dims.x && gxy.y < dims.y;
  var depth = 1.0;
  if (onScreen) { depth = textureLoad(gDepth, gxy, 0); }
  let live = onScreen && depth < 1.0 && (frame.flags & FLAG_DIRECT) != 0u;
  let P = worldFromDepth(vec2f(gxy) + 0.5, depth);

  // ---- the tile's light beliefs: last frame's record in, remapped by identity — lane s carries last frame's slot s to wherever that light sits now (gone: dropped) ----
  if (lidx < 25u) {   // lanes 0‥24: one record each of the 5×5 tile neighbourhood (off the grid = nothing known)
    let tilesX = (dims.x + 7u) >> 3u; let tilesY = (dims.y + 7u) >> 3u;
    let t = vec2i(wid.xy) + vec2i(i32(lidx % 5u) - 2, i32(lidx / 5u) - 2);
    var rec = vec4u(0u);
    if (all(t >= vec2i(0)) && t.x < i32(tilesX) && t.y < i32(tilesY)) { rec = resIn[((tilesX * tilesY) << 6u) + u32(t.y) * tilesX + u32(t.x)]; }
    wgNbLit[lidx] = rec.zw;
    if (lidx == 12u) { wgTileIn = rec; }
  }
  if (lidx < 2u) { atomicStore(&wgBelief[lidx], 0u); }
  if (lidx < 4u) { atomicStore(&wgSeen[lidx], 0u); atomicStore(&wgOwn[lidx], 0u); atomicStore(&wgTileOut[lidx], 0u); }
  workgroupBarrier();
  { // lane s carries last frame's slot s to wherever that light sits now (gone: dropped): its own dark / lit bits, and the effective dark bit = dark here, lit nowhere in the 5×5
    let ns = fwdSlot(lidx);
    if (ns != 255u) {
      let w = lidx >> 5u; let bit = 1u << (lidx & 31u); let nb = 1u << (ns & 31u);
      let dk = (wgTileIn[w] & bit) != 0u; let lt = (wgTileIn[w + 2u] & bit) != 0u;
      var litNear = false; for (var k = 0u; k < 25u; k++) { litNear = litNear || (wgNbLit[k][w] & bit) != 0u; }
      if (dk) { atomicOr(&wgOwn[ns >> 5u], nb); if (!litNear) { atomicOr(&wgBelief[ns >> 5u], nb); } }
      if (lt) { atomicOr(&wgOwn[(ns >> 5u) + 2u], nb); }
    }
  }
  // (the barriers of the light-list block below order these writes before any lane reads wgBelief)

  // ---- per-tile light list (FLAG_TILECULL) — as direct.wgsl ----
  let tileCull = (frame.flags & FLAG_TILECULL) != 0u;
  var nIter = nL;
  if (tileCull) {
    wgP[lidx] = vec4f(P, select(0.0, 1.0, live));
    workgroupBarrier();
    if (lidx < 8u) {
      var mn = vec3f(1e30); var mx = vec3f(-1e30); var anyLive = 0.0;
      for (var k = 0u; k < 8u; k++) { let q = wgP[lidx * 8u + k]; if (q.w > 0.0) { mn = min(mn, q.xyz); mx = max(mx, q.xyz); anyLive = 1.0; } }
      wgRowMin[lidx] = vec4f(mn, anyLive); wgRowMax[lidx] = vec4f(mx, anyLive);
    }
    workgroupBarrier();
    if (lidx < nL) {
      var mn = vec3f(1e30); var mx = vec3f(-1e30); var anyLive = false;
      for (var r = 0u; r < 8u; r++) { let a = wgRowMin[r]; if (a.w > 0.0) { mn = min(mn, a.xyz); mx = max(mx, wgRowMax[r].xyz); anyLive = true; } }
      let keep = anyLive && lightReachesBox(wgLights[lidx], mn, mx);
      wgKeep[lidx] = select(0u, 1u, keep);
      var gm = 0u;
      if (keep && (frame.flags & FLAG_GLASS) != 0u) { gm = glassPairMask(wgLights[lidx], mn, mx); }
      wgGlass[lidx] = gm;
    }
    workgroupBarrier();
    if (lidx == 0u) { var n = 0u; for (var i = 0u; i < nL; i++) { if (wgKeep[i] != 0u) { wgList[n] = i; n++; } } wgCount = n; }
    workgroupBarrier();
    nIter = wgCount;
  } else {
    if (lidx < nL) { wgGlass[lidx] = lightGlassMask(wgLights[lidx]); }
    workgroupBarrier();
  }

  let raysCfg = ru.cfg.x & 255u; let kSpatial = ru.cfg.y & select(0xffffffffu, 255u, RESTIR_MOTION); let mCap = f32(max(ru.cfg.z & 255u, 1u));   // (the MOTION program keeps a tap count for moving pixels in cfg.y bits 8‥11 — lever c; the host packs it only for that program)
  let heldK = (ru.cfg.x >> 8u) & 15u; let hybrid = heldK > 0u;   // HELD (header): K stratified rays for each of the two carried leaders at the pixel; 0 = the hybrid off — main's transient stratum, statement for statement
  // TRADES (the lighting-cost rows; compiled in only under the prepended `const RESTIR_TRADE = true` — passes.ts builds that twin on FIRST USE, and packs ru.cfg.x bits 12‥23 only while a row is on:
  // all rows off = the estimator's program and uniform exactly as they were). Each gives up a little accuracy for shadow rays:
  //   bit 12 HELD ADAPTIVE — a carried leader's first two strata that AGREE (both lit, both blocked, the same transmittance) stand for all K: the cone's interior and the far side of a wall
  //          stop at 2 rays, where they differ the K are traced as ever. BIASED where the light's penumbra is wide: stopping on agreement pulls a pixel toward lit / dark (true
  //          visibility 0.9 reads ≈ 0.94; the worst case is ±0.05 of that light), so a carried light's penumbra hardens a little and grains more;
  //   bit 13 STABLE RE-TRACE — a history sample that is fully lit, at ¾ of its memory or more, with no penumbra remembered at the pixel, is re-traced on its class's frame only (every other
  //          frame; the frame between reads last frame's visibility, as the 2-ray tier does) — the fresh candidates still look every frame. The hint is last frame's own
  //          measurement, so the lit side of an ARRIVING shadow qualifies: its leading edge can show a frame late at part weight;
  //   bits 16‥23 DIM CLASS (percent) — a class holding less than this share of the pixel's live unshadowed light takes ONE ray a frame (re-trace / fresh on alternate frames) and no second fresh ray.
  let heldAdapt = RESTIR_TRADE && (ru.cfg.x & 4096u) != 0u && heldK > 2u; let stableRe = RESTIR_TRADE && (ru.cfg.x & 8192u) != 0u; let dimShare = f32((ru.cfg.x >> 16u) & 255u) * 0.01;
  // D (image-quality program, the dim multi-light penumbra grain): ru.cfg.z bits 8‥15 = an M cap that applies INSIDE PENUMBRAE only (a pixel whose inherited texel carries a blocker-distance hint in
  // either class: a ray from here was blocked toward a lit-tile light within the last two frames) — shorter memory there = the reservoir's random walk turned into noise the ratio filter and the
  // TAA can average (0 = off); bit 16 = a SECOND fresh candidate + ray in those pixels whatever the tier's ray count (the rays-6 path, per pixel: an auditing tile's penumbra lanes give up their audit slot)
  let penCapU = (ru.cfg.z >> 8u) & 255u; let penRays = ((ru.cfg.z >> 16u) & 1u) != 0u;
  var mCapPix = mCap; var fresh2Pix = raysCfg >= 6u;
  let alt = frame.frameIdx & 1u;   // below 4 rays the classes trade the odd ray frame by frame (NOT on a checkerboard: lanes tracing different kinds of ray side by side measured dearer than the rays saved)
  let finalRay = raysCfg >= 5u; let cohPick = (ru.cfg.w & 4u) != 0u;   // (the second fresh candidate — rays 6, or D1's penumbra pixels — is fresh2Pix above)
  let auditTile = ((frame.frameIdx * 37u + wid.x * 7u + wid.y * 13u) & 63u) < u32(ru.cfg2.w * 64.0 + 0.5);   // this tile audits its dark set this frame: ru.cfg2.w of every 64 frames, SPREAD through them (the odd multiplier permutes the residues: gaps of 2‥7 frames at ¼, not 16 on / 48 off) and staggered across tiles — BELIEFS
  let bel = vec2u(atomicLoad(&wgBelief[0]), atomicLoad(&wgBelief[1]));   // the tile's DARK set by this frame's slots, in registers

  var N = vec3f(0.0, 1.0, 0.0); var owner = 0u; var Po = P; var PoT = P; var PoJ = P; var Pu = P; var pxPerMetre = 0.0; var viewW = 1.0;
  var motionPx = 0.0;                    // MOTION: |screen motion| of this pixel's surface point in px (camera + object), 0 unless the RESTIR_MOTION program measured it
  var darkSlot = 0u;                    // this pixel's own dark memory: 0 = none, else slot + 1 (this frame's numbering) of the light its fresh ray last found dark where the tile believes it lit
  let knownDark = (ru.cfg.w & 16u) == 0u;   // tile-DARK lights leave the fresh draw (known dark exactly as a reach-masked light is: in U, no ray, their true 0 without the one-sample all-or-nothing noise — a lamp
                                         // behind the wall holding 45‥80 % of the unshadowed total made the lino an EMA of coin flips, ±15‥30 % per pixel, crawling); an AUDITING share of the lanes
                                         // (ru.cfg2.w) spends one extra ray a frame on the dark set — drawn ∝ unshadowed weight, so the light whose wrongful exclusion would matter most is tested most —
                                         // whose outcome only VOTES: a verdict the scene overturns (the door opening on the corridor's panel) falls within a frame or two of the light arriving, tile by
                                         // tile. cfg.w & 16 = A/B: every light stays in the draw (the unbiased first cut; beliefs then only colour S and gate hints)
  var Uv = array<vec3f, 2>(vec3f(0.0), vec3f(0.0));   // the live unshadowed irradiance per class this pixel BELIEVES visible (β_i = 0 for tile-dark lights and darkSlot, 1 otherwise): the hue S is shaded in
  var W = array<f32, 2>(0.0, 0.0);      // class luminance, all lights (= luminance(U))
  var Wl = array<f32, 2>(0.0, 0.0);     // … live lights only (reach level > 0)
  var Wf = array<f32, 2>(0.0, 0.0);     // … the ones the fresh draw ranges over (live minus tile-dark under knownDark, else = Wl): p̂(x)·W(x) of the fresh sample
  var Wd = array<f32, 2>(0.0, 0.0);     // … the tile-dark ones (the audit draw's range)
  var pickF = array<u32, 2>(255u, 255u); var pF = array<f32, 2>(0.0, 0.0);   // fresh candidate (slot, its target here) — luminances are all the estimator needs
  var pickG = array<u32, 2>(255u, 255u); var pG = array<f32, 2>(0.0, 0.0);   // second fresh candidate (rays 6)
  var pickD = array<u32, 2>(255u, 255u);                                     // the audit ray's light (a tile-dark one), if this lane audits
  var pickT = array<u32, 2>(255u, 255u); var Wt = array<f32, 2>(0.0, 0.0); var Ut = array<vec3f, 2>(vec3f(0.0), vec3f(0.0)); var VTr = array<f32, 2>(-1.0, -1.0);   // the TRANSIENT stratum per class: the picked transient (∝ w among the transients reaching here), their unshadowed luminance / irradiance sums, the ray's visibility — under the hybrid: pickT / Wt / VTr are the held TAIL per class (the carried lights past the two leaders), Ut every carried light's irradiance
  var hS = vec2u(255u, 255u); var hW = vec2f(0.0); var hV = vec2f(0.0);       // HELD: the two strongest carried lights at this pixel (slot, unshadowed luminance, Σ visibility over their K strata)
  var hE0 = vec3f(0.0); var hE1 = vec3f(0.0);                                // … and their exact irradiance here (parked in wgHeld across the trace loop)
  var hN = vec2f(f32(heldK)); var hFirst = vec2f(0.0); var hStop = vec2u(0u);   // TRADE (held adaptive): the strata each leader's Σ visibility is over, its first stratum's answer, 'stop after two'
  var curT = array<u32, 2>(255u, 255u); var pT = array<f32, 2>(0.0, 0.0);     // temporal sample's light: this frame's slot (255 = none / gone), its target here now
  var tw = vec4u(0u);                    // last frame's texel (x,y class 0 · z,w class 1); a class's word B is zeroed when it is let go
  var nRays = 0u; var nTaps = 0u; var nNb = 0u;   // diagnostic counters (debug view 12)

  if (live) {
    rngInit(gxy, frame.frameIdx);
    rngTile = ((wid.x * 1973u + wid.y * 9277u + frame.frameIdx * 26699u) | 1u) * 0x2c1b3c6du; rngTile ^= rngTile >> 12u;
    N = normalize(textureLoad(gNormal, gxy, 0).xyz * 2.0 - 1.0);
    owner = (textureLoad(gId, gxy, 0).x >> 20u) & 0xffu;
    // The reservoir's DOMAIN is the surface point an UNJITTERED raster would show at this pixel (content at unjittered s lands at s + jitter — engine.ts; same plane, ≤ ½ px from P):
    // every shadow ray of this pass leaves it and the reprojection starts from it, so under a still camera a pixel inherits ITS OWN reservoir every frame whatever TAAU's jitter does.
    // Inheriting the neighbouring texel's instead (what reprojecting the jittered P does every other frame) reuses samples drawn for a point whose visibility is not this one's: the
    // history under-covers what only this point sees and MIS starves the fresh candidate there — soft shadows came out 4–10 % DARK on the cubicle floor (§3.4). U (unshadowed, exact)
    // stays at the jittered P; only the shadow term is evaluated ½ px off, which the ratio-space filter behind this pass blurs over anyway.
    Pu = worldFromDepth(vec2f(gxy) + 0.5 + ru.jitter.xy, depth);
    Pu -= N * dot(Pu - P, N);   // same DEPTH on the neighbouring ray is not the same PLANE on a face oblique to the view: put it back on the receiver's tangent plane through P, or at a
                                 // distant / low-res pixel (½ px > the 15 mm offset) the origin lands inside the receiver's own box on alternate jitter phases and every ray reads dark
    PoT = Pu + N * 0.015; Po = PoT; PoJ = P + N * 0.015;   // (PoJ: the raster's own point, for the HELD stratum's rays)
    let zView = distance(P, frame.camPos);
    viewW = (frame.viewProj * vec4f(P, 1.0)).w;
    pxPerMetre = frame.screen.y / (2.0 * zView * frame.post.w + 1e-4);
    // ---- temporal: last frame's reservoirs for this surface point, their lights re-mapped by identity ----
    tw = prevTexelAt(Pu, P, gxy, dims, true);   // (P: the raster's own point — the RESTIR_MOTION program measures the motion off it; unused otherwise)
    if (RESTIR_MOTION) { motionPx = mvPx; }   // (MOTION: this pixel's own screen motion, px — read before any spatial tap's reprojection reuses mvPx)
    { let pen = rHint(tw.x) > 0.0 || rHint(tw.z) > 0.0; if (pen && penCapU > 0u) { mCapPix = min(mCap, f32(penCapU)); } if (pen && penRays) { fresh2Pix = true; } }   // (D: this pixel sat in a penumbra last frame — see penCapU / penRays above)
    if (RESTIR_MOTION && (ru.cfg.w & 512u) != 0u) { mCapPix = max(1.0, mCapPix * (1.0 - (1.0 - ru.mot.y) * smoothstep(ru.mot.x, ru.mot.x * MOTION_RAMP, motionPx))); }   // (b) MOTION-SCALED CONFIDENCE: the memory this pixel keeps (and stores) is whole under mot.x px a frame of its own motion and × mot.y past MOTION_RAMP × that — measured, not modelled: at 0.8 px a frame (770 rows) the nearest-texel history is still worth its 20 candidates and any cut costs 10–25 % MORE flow; at 1.4–2 px it is worth about two (docs/internal/direct-motion.md §2)
    darkSlot = ((tw.y >> 28u) & 7u) | (((tw.w >> 28u) & 7u) << 3u);   // (the two B words' spare bits 28‥30; read before a gone light zeroes its word below)
    if (darkSlot != 0u) { let ns = fwdSlot(darkSlot - 1u); darkSlot = select(ns + 1u, 0u, ns >= 63u); }   // by identity; gone (255) or slot 63 (unrepresentable in 6 bits + none) = none
    if (rValid(tw.y)) { curT[0] = fwdSlot(rSlot(tw.x)); if (curT[0] == 255u || stratumLight(wgLights[min(curT[0], 63u)], hybrid)) { curT[0] = 255u; tw.y = 0u; } }   // (a transient — or, under the hybrid, a carried light — is never adopted below; one held from before that rule counts as gone)
    if (rValid(tw.w)) { curT[1] = fwdSlot(rSlot(tw.z)); if (curT[1] == 255u || stratumLight(wgLights[min(curT[1], 63u)], hybrid)) { curT[1] = 255u; tw.w = 0u; } }
    // ---- score every listed light unshadowed: U (exact, stored right here), the candidate stream, the temporal samples' targets now ----
    var U0 = vec3f(0.0); var U1 = vec3f(0.0);
    for (var s = 0u; s < nIter; s++) {
      var i = s; if (tileCull) { i = wgList[s]; }
      let uP = rndPick(cohPick);                                   // the pick's draw for this light — taken for EVERY listed light, before any per-lane early-out, so the tile-shared stream stays in lockstep
      let li = wgLights[i];
      let ev = evalLight(li, P, N);
      if (!ev.ok) { continue; }
      let w = luminance(ev.E);
      if (w < 1e-4) { continue; }
      let c = select(0u, 1u, lightBroad(li));
      if (c == 0u) { U0 += ev.E; } else { U1 += ev.E; }
      W[c] += w;
      if (lightReachLevel(i, P) == 0u) { continue; }               // walled off from this cell: in U, known dark, never a candidate
      if (stratumLight(li, hybrid)) {   // the TRANSIENT stratum (header): counted in U, its own ray below, never a candidate / belief / reservoir — under the hybrid every CARRIED light too (HELD)
        Ut[c] += ev.E;
        if (!hybrid) { Wt[c] += w; if (rnd() * Wt[c] < w) { pickT[c] = i; } continue; }   // (main's statement)
        // HELD: the two leaders by unshadowed weight; whoever that displaces (or the newcomer, ranking third) joins its own class's tail — a weighted reservoir pick, one ray
        var oI = i; var oW = w; var oE = ev.E;
        if (w > hW.x) { oI = hS.y; oW = hW.y; oE = hE1; hS.y = hS.x; hW.y = hW.x; hE1 = hE0; hS.x = i; hW.x = w; hE0 = ev.E; }
        else if (w > hW.y) { oI = hS.y; oW = hW.y; oE = hE1; hS.y = i; hW.y = w; hE1 = ev.E; }
        if (oI != 255u) { let oc = select(0u, 1u, lightBroad(wgLights[oI])); Wt[oc] += oW; if (rnd() * Wt[oc] < oW) { pickT[oc] = oI; } }
        continue;
      }
      Wl[c] += w;
      if (i == curT[c]) { pT[c] = w; }
      let dk = tileDark(bel, i);
      if (!dk && i + 1u != darkSlot) { Uv[c] += ev.E; }            // believed visible: lends its colour to S
      if (dk && knownDark) { Wd[c] += w; if (rnd() * Wd[c] < w) { pickD[c] = i; } continue; }   // known dark to this tile: in U and Wl, out of the fresh draw (its true 0 without a ray) — but in the audit draw (∝ w; the lane's own stream even under tile-coherent draws, so an auditing tile spreads its 64 rays over the dark set)
      Wf[c] += w;
      if (uP * Wf[c] < w) { pickF[c] = i; pF[c] = w; }             // weighted reservoir sampling: P(pick = i) = w_i / Wf exactly (uP serves whichever of the two disjoint draws its light is in)
      if (fresh2Pix) { if (rnd() * Wf[c] < w) { pickG[c] = i; pG[c] = w; } }
    }
    // U.a = the luminance of the light this pixel BELIEVES visible (Uv: live, not tile-dark, not its darkSlot) — the v3 shadow denoiser keys its light-motion / light-jump
    // cues on it (denoise.wgsl shTemporal): a fluorescent's stroke is an 85 % change of what actually reaches the desk under it but only ~20 % of U, which on this
    // floor is three-quarters street lamp behind the outer wall (in U by its reach through the windows, dark by every ray) — keyed on U the jump never registered.
    // Nothing else reads U.a (softblur / composite / fgather take .rgb; direct.wgsl writes 1.0 there and the denoiser then falls back to U itself).
    textureStore(outSharpU, gxy, vec4f(U0, luminance(Uv[0] + Ut[0])));   // (+ the transient stratum: a flash arriving or gone IS a light-jump for the cue; the hue Uv keeps to the persistent lights)
    textureStore(outBroadU, gxy, vec4f(U1, luminance(Uv[1] + Ut[1])));
  } else if (onScreen) {
    textureStore(outSharpU, gxy, vec4f(0.0)); textureStore(outBroadU, gxy, vec4f(0.0));
  }

  // ---- phase 1 per class: temporal confidence, the rays (fresh candidates, temporal re-trace), the gradient vote ----
  var Mt = array<f32, 2>(0.0, 0.0);     // temporal confidence after cap × target ratio (0 = no usable history)
  var pPT = array<f32, 2>(0.0, 0.0);    // the temporal sample's target at THIS point under LAST frame's light record (prevLights): what MIS calls p̂_prev(y_t), and the 'did the light change' reference
  var VT = array<f32, 2>(0.0, 0.0); var VF = array<f32, 2>(-1.0, -1.0); var VG = array<f32, 2>(-1.0, -1.0);   // visibilities (−1 = not traced)
  var uvF = array<u32, 2>(0u, 0u); var uvG = array<u32, 2>(0u, 0u);   // fresh lattice cells iu | iv << 4
  var blurPx = array<f32, 2>(0.0, 0.0);
  var gradIn = vec4f(0.0, -1.0, 0.0, -1.0);   // (f0, t0, f1, t1): fresh vs temporal luminance estimates; t < 0 = no vote
  // The rays of both classes are QUEUED (≤ 6: fresh, second fresh, re-trace per class) and traced from ONE call site in one loop: the tracer (occludedT's grid
  // walk) inlined at four sites cost this pass a millisecond of instruction cache and registers on the M4 for the same rays; and lanes walk their queues in the
  // same kind order, so a SIMD group is mostly tracing the same sort of ray at the same time.
  // Fixed queue positions — 3c + kind (kind 0 fresh, 1 second fresh, 2 re-trace), 255 = empty — so that iteration q of the trace loop is the same KIND of ray on every
  // lane of the SIMD group (a lane with nothing at q idles through it) rather than whatever each lane happened to queue next.
  var rqSlot = array<u32, 8>(255u, 255u, 255u, 255u, 255u, 255u, 255u, 255u); var rqUv = array<u32, 8>();   // + slots 6, 7 = the transient stratum's ray per class (kind 3)
  var validT = array<bool, 2>(false, false);
  var softC = array<bool, 2>(false, false);   // SDF rig (iii): a ray of the class came back clear of boxes but darkened by the drawn character term (shadowSample .y = SOFT_CLEAR_Y)
  if (live) {
    // the audit ray (knownDark): a lane tests ONE tile-dark light — drawn ∝ unshadowed weight within a class drawn ∝ its dark weight — in the second-fresh queue slot
    // (kind 1; rays 6, which no preset runs, keeps that slot for its second candidate). Its outcome votes and nothing else: it never enters the estimate.
    // Audits go by TILE-FRAME, not by lane: on ru.cfg2.w of its frames (staggered across tiles) every lane of the tile that has a dark set traces one, otherwise none —
    // a quarter of the lanes auditing every frame measured +0.4 ms at high (a SIMD group idles through a queue slot only some of its lanes fill: the same lesson as
    // the checkerboard); whole tiles auditing a quarter of the time trace the same rays for a quarter of that.
    var auditC = 2u;
    if (!fresh2Pix && auditTile && Wd[0] + Wd[1] > 0.0) { auditC = select(0u, 1u, rnd() * (Wd[0] + Wd[1]) < Wd[1]); }   // the class by its share of the dark weight (both dark sets get audited over frames)
    for (var c = 0u; c < 2u; c++) {
      let lu = rndPick(cohPick); let lv = rndPick(cohPick);       // the fresh sample's lattice cell (drawn whether or not it is traced: lockstep, as above)
      if (Wl[c] <= 0.0) { continue; }
      let twB = select(tw.y, tw.w, c == 1u); let twA = select(tw.x, tw.z, c == 1u);
      var valid = rValid(twB) && curT[c] != 255u && pT[c] > 0.0;
      if (valid) {
        // its light's target here NOW ÷ what the same light gave this point LAST frame (its previous record, evaluated here — not the stored p̂, which belongs to whichever
        // texel the reservoir came from: under TAAU's jitter that is a neighbour half the time, and an irradiance gradient is not a light changing), ≤ 1:
        // a cone that swept off the pixel, a dimmed panel let go at once; a light that did not reach here last frame (the cone just arrived) keeps its confidence
        // (symmetric: a light that JUMPED up — a fluorescent restrike's strokes go 5 % ↔ 100 % frame to frame — is as badly represented by the history as one that dropped;
        // one-sided, the up-strokes came through at half weight for a frame)
        let lp = ru.prevLights[rSlot(twA)];
        let ep = evalLight(lp, P, N); pPT[c] = select(0.0, luminance(ep.E), ep.ok);
        if (pPT[c] > 0.0) {
          // The ratio that cuts confidence is the GEOMETRIC one — each target ÷ its light's power at the time (the luminance of the uploaded colour = colour × intensity):
          // a light that only dimmed, brightened or changed hue (a fluorescent's dropout strokes every other frame, a restrike's 5 % ↔ 100 %, the lightning's decay)
          // keeps its history — the sample's VISIBILITY is exactly as valid as it was, and the MIS below already weighs last frame's target against this frame's, so
          // the estimate follows the light within the frame either way. Cutting M there (the first cut did, symmetrically) rebuilt every reservoir under the panel
          // from one fresh sample twice per flicker period: 1–3-spp penumbrae the shadow filter could neither trust nor clamp, i.e. blotches that pumped with the
          // tube (docs/internal/tjank.md §A). A cone that swept off the pixel or a lamp that moved still lets go as before. ru.cfg.w & 32 = A/B: the raw ratio.
          var r = pT[c] / pPT[c];
          if ((ru.cfg.w & 32u) == 0u) { let kNow = luminance(wgLights[curT[c]].color); let kPrev = luminance(lp.color); if (kNow > 0.0 && kPrev > 0.0) { r *= kPrev / kNow; } }
          Mt[c] = min(rM(twA), mCapPix) * clamp(min(r, 1.0 / r) * 1.02, 0.0, 1.0);
        }
        else { Mt[c] = min(rM(twA), mCapPix); pPT[c] = pT[c]; }
      }
      var raysC = raysCfg; var dimC = false;
      if (RESTIR_TRADE && dimShare > 0.0 && Wl[c] < dimShare * (Wl[0] + Wl[1] + luminance(Ut[0] + Ut[1]))) { raysC = min(raysCfg, 2u); dimC = true; }   // TRADE (dim class): this class is a sliver of the light here — the 2-ray tier's alternation for it alone
      var planT = raysC >= 3u || alt == c;
      if (stableRe && planT && alt != c && valid && rV(twA) >= 1.0 && rM(twA) >= 0.75 * mCap && rHint(tw.x) <= 0.0 && rHint(tw.z) <= 0.0) { planT = false; }   // TRADE (stable re-trace): lit, confident, no penumbra at the pixel — off its own frame it reads last frame's visibility
      let planF = raysC >= 4u || (raysC == 3u && alt == c) || (raysC <= 2u && alt != c);
      let darkT = valid && rW(twB) <= 0.0;                          // a zero-weight history ('looked, was dark'): nothing to re-trace — its planned ray goes to a fresh draw instead (budget-neutral, and it is
      if ((planF || !valid || (darkT && planT)) && pickF[c] != 255u) {   // exactly where climbing back out of a dark memory wants the sample); no history at all: a fresh sample regardless of the plan
        let iu = u32(lu * 16.0) & 15u; let iv = u32(lv * 16.0) & 15u; uvF[c] = iu | (iv << 4u);
        rqSlot[c * 3u] = pickF[c]; rqUv[c * 3u] = uvF[c];
      }
      if (fresh2Pix && pickG[c] != 255u && !dimC) {
        let iu = u32(rnd() * 16.0) & 15u; let iv = u32(rnd() * 16.0) & 15u; uvG[c] = iu | (iv << 4u);
        rqSlot[c * 3u + 1u] = pickG[c]; rqUv[c * 3u + 1u] = uvG[c];
      } else if (c == auditC && pickD[c] != 255u) {
        rqSlot[c * 3u + 1u] = pickD[c]; rqUv[c * 3u + 1u] = (u32(rnd() * 16.0) & 15u) | ((u32(rnd() * 16.0) & 15u) << 4u);
      }
      if (valid) {
        if (darkT) { VT[c] = 0.0; }                                 // (its confidence M is what it carries; see darkT above)
        else if (planT) { rqSlot[c * 3u + 2u] = curT[c]; rqUv[c * 3u + 2u] = rIu(twA) | (rIv(twA) << 4u); VT[c] = 1.0; }
        else { VT[c] = rV(twA); if (VT[c] > 0.0) { atomicOr(&wgSeen[curT[c] >> 5u], 1u << (curT[c] & 31u)); } }   // not re-traced this frame: last frame's visibility, one frame stale — still this surface's word that its light is seen from the tile
      }
      validT[c] = valid;
    }
    for (var c = 0u; c < 2u; c++) { if (pickT[c] != 255u) { rqSlot[6u + c] = pickT[c]; rqUv[6u + c] = (u32(rnd() * 16.0) & 15u) | ((u32(rnd() * 16.0) & 15u) << 4u); } }   // the transient stratum's ray (whether or not the class has any persistent light here) — under the hybrid: the held TAIL's ray per class
    var hUv = vec2u(0u); for (var h = 0u; h < 2u; h++) { if (hS[h] != 255u) { hUv[h] = (u32(rnd() * 16.0) & 15u) | ((u32(rnd() * 16.0) & 15u) << 4u); } }   // HELD: each leader's own lattice offset for its K strata (per pixel, per frame)
    wgHeld[lidx] = vec4f(hE0, 0.0); wgHeld[lidx + 64u] = vec4f(hE1, 0.0);   // parked with Uv / Wf below
    wgP[lidx] = vec4f(Uv[0], Wf[0]); wgStash[lidx] = vec4f(Uv[1], Wf[1]);   // parked: phase 2 wants them, the trace loop does not (read back across the barrier below, so the compiler cannot keep them in flight)
    // HELD: queue positions 8‥ = the two leaders' K strata each, leader-interleaved (8 + 2k + h) — the same ONE call site; a lane no carried light reaches walks 8 positions as it always did
    let nq = select(8u, 8u + 2u * heldK, hybrid && (hS.x != 255u || hS.y != 255u));
    for (var q = 0u; q < nq; q++) {
      var slot: u32; var iu: u32; var iv: u32; var c = 0u; var kind = 3u; var hh = 0u; var hk = 0u;
      if (q < 8u) {
        slot = rqSlot[q]; if (slot == 255u) { continue; }
        c = q / 3u; kind = q - c * 3u; if (q >= 6u) { c = q - 6u; kind = 3u; }   // (kind 3 = the transient ray / the held tail's)
        iu = rqUv[q] & 15u; iv = rqUv[q] >> 4u;
      } else {   // HELD leader hh, stratum k: shadowSample's own golden-ratio disk sequence off the leader's lattice offset, snapped to the lattice (every prefix well spread over the disk)
        hh = (q - 8u) & 1u; let k = (q - 8u) >> 1u; slot = hS[hh]; if (slot == 255u) { continue; }
        if (heldAdapt) { if (k >= 2u && hStop[hh] != 0u) { continue; } hk = k; }   // TRADE (held adaptive): its first two strata agreed
        kind = 4u; c = select(0u, 1u, lightBroad(wgLights[slot]));
        let uv0 = latticeUV(hUv[hh] & 15u, hUv[hh] >> 4u); iu = u32(fract(uv0.x + f32(k) * 0.618034) * 16.0) & 15u; iv = u32(fract(uv0.y + f32(k) * 0.7548777) * 16.0) & 15u;
      }
      let vs = traceSample(slot, select(PoT, PoJ, hybrid && kind >= 3u), N, owner, iu, iv); nRays++;   // (HELD: a carried light's rays leave the pixel's OWN point — the raster's, jitter and all — not the reservoir domain's unjittered one: no history rides on them, and on a face thinner than a pixel plus its jitter (a jamb's reveal beside the leaf's slot) the unjittered centre lies on the next surface and its rays answered for the wrong face — dashes down every door frame the cone crossed)
      atomicOr(&wgSeen[(slot >> 5u) + select(2u, 0u, vs.x > 0.0)], 1u << (slot & 31u));   // the tile's vote on this light: seen (any transmittance) / blocked
      var share = pT[c];
      if (kind == 0u) { VF[c] = vs.x; share = pF[c]; } else if (kind == 1u) { if (fresh2Pix) { VG[c] = vs.x; share = pG[c]; } } else if (kind == 2u) { VT[c] = vs.x; } else if (kind == 3u) { VTr[c] = vs.x; share = Wt[c]; } else { hV[hh] += vs.x; share = hW[hh]; }   // (kind 1 without fresh2 = the audit ray: its vote above is all it is for; kind 3 = the transient stratum's / the held tail's; 4 = a held leader's stratum)
      if (heldAdapt && kind == 4u) { if (hk == 0u) { hFirst[hh] = vs.x; } else if (hk == 1u && abs(vs.x - hFirst[hh]) < 0.02) { hStop[hh] = 1u; hN[hh] = 2.0; } }   // TRADE (held adaptive): two strata, one answer — they stand for the K
      if (vs.y >= 0.0 && !tileDark(bel, slot)) { blurPx[c] = max(blurPx[c], hintPx(vs.y, pxPerMetre, share / W[c])); }   // a blocked ray is a penumbra measurement — unless the whole tile found that light dark last frame (a lamp behind the wall measures nothing here; the audit ray never hints)
      if (vs.y == SOFT_CLEAR_Y && q < 6u && !tileDark(bel, slot)) { softC[c] = true; }   // (gated like the hint: never off an audit ray, and never off the transient stratum's ray (slots 6, 7) — a muzzle flash past a man must not drop the class's history in his flash-shadow)
    }
  }
  workgroupBarrier();   // (uniform control flow) the parked values come back; nothing else crosses here
  if (live) {
    let st0 = wgP[lidx]; let st1 = wgStash[lidx]; Uv[0] = st0.xyz; Wf[0] = st0.w; Uv[1] = st1.xyz; Wf[1] = st1.w;
    hE0 = wgHeld[lidx].xyz; hE1 = wgHeld[lidx + 64u].xyz;   // (HELD: the leaders' irradiance back)
    for (var c = 0u; c < 2u; c++) {
      // the pixel's own dark memory: a fresh ray blocked toward a light the tile believes lit (the inside of THIS light's shadow within a lit tile) names it;
      // seeing that light from here again (a lit fresh ray, or the reservoir holding it lit) clears it. One slot for both classes: the last such light wins.
      if (VF[c] == 0.0 && pickF[c] < 63u && !tileDark(bel, pickF[c])) { darkSlot = pickF[c] + 1u; }
      else if ((VF[c] > 0.0 && pickF[c] + 1u == darkSlot) || (validT[c] && VT[c] > 0.0 && curT[c] + 1u == darkSlot)) { darkSlot = 0u; }
      var valid = validT[c];
      // A history sample that WAS visible (stored V > 0) and re-traces OCCLUDED from here is let go (M 0): either the shadow moved, or — every other frame under TAAU's
      // jitter — the reservoir came from the neighbouring texel across a shadow edge, whose visibility is simply not this point's; keeping its confidence at zero
      // weight dilutes the fresh candidate by 1/(M+1) and biased soft shadows DARK by 5–11 %. A fresh candidate that comes back dark, on the other hand, IS this
      // point's information and is stored as a zero-weight reservoir with its M (below): discarding those kept only the lucky samples and biased soft shadows
      // BRIGHT by 5–35 %. (Measured both ways on the cubicle floor under the panels, docs/internal/p2a-restir.md §3.4.)
      if (valid && VT[c] <= 0.0 && rW(select(tw.y, tw.w, c == 1u)) > 0.0) { valid = false; }
      if (!valid) { Mt[c] = -1.0; }                                 // (−1: no temporal at all)
      // gradient vote: the fresh one-sample estimate vs the temporal one (both estimate the class's visible luminance here)
      if (VF[c] >= 0.0 && valid) {
        let twB = select(tw.y, tw.w, c == 1u);
        var f = Wf[c] * VF[c]; if (VG[c] >= 0.0) { f = 0.5 * (f + Wf[c] * VG[c]); }   // (Wf: what the fresh draw ranged over — the tile-dark lights left out add their known 0)
        let t = pT[c] * VT[c] * rW(twB);
        if (c == 0u) { gradIn.x = f; gradIn.y = t; } else { gradIn.z = f; gradIn.w = t; }
      }
    }
  }

  // ---- tile temporal gradient (uniform control flow: every lane takes part) ----
  // A paired test per class over the lanes that have both estimates: d = fresh − temporal per lane, z = Σd / √(Σd² + floor) — the tile's mean disagreement
  // in units of its own sampling noise (one-sample fresh estimates are all-or-nothing, and Σd² carries exactly that spread). Confidence 1 below z = g, 0 past
  // 1.6 g. A shadow edge sweeping through the tile, a door letting light in, a man stepping in front of a lamp shifts dozens of lanes the same way at once
  // (z ≫ 5) and the tile lets go of its history within the frame; the steady state's z is ~N(0, 1) whatever the light level, so it does not twitch in the dark.
  // The same three barriers also carry the tile's light BELIEFS out: lane s turns this frame's votes on slot s into the 2-bit verdict next frame inherits
  // (seen by any ray → LIT; tried and blocked every time → DARK; untried → what it was, let go every 8th frame so no verdict outlives its evidence for long)
  // and lane 0 stores the record. (The gradient's own sums are skipped when its bit is off; the skeleton runs either way — the beliefs need it.)
  var conf = vec2f(1.0); var gz = vec2f(0.0);
  let gradOn = (ru.cfg.w & 1u) != 0u;
  {
    var v = vec4f(0.0);   // (d0, d0², d1, d1²); a lane without a vote adds zeros
    if (gradIn.y >= 0.0) { let d = gradIn.x - gradIn.y; v.x = d; v.y = d * d; }
    if (gradIn.w >= 0.0) { let d = gradIn.z - gradIn.w; v.z = d; v.w = d * d; }
    wgP[lidx] = v;
    wgKeep[lidx] = select(0u, 1u, gradIn.y >= 0.0) | select(0u, 2u, gradIn.w >= 0.0) | (u32(clamp((abs(gradIn.x) + abs(gradIn.y)) * 1e3, 0.0, 32767.0)) << 2u) | (u32(clamp((abs(gradIn.z) + abs(gradIn.w)) * 1e3, 0.0, 32767.0)) << 17u);   // votes + the lane's signal level (mW/m², for the noise floor)
    workgroupBarrier();
    { // the record out, slot lidx: seen lit by any ray of the tile → LIT; tried and only ever blocked → DARK; untried → what it was (a DARK bit has to be re-earned on the tile's
      // audit frames — 64 lanes drawing ∝ weight over the dark set re-test everything that matters, and what none of them drew starts over unknown; a LIT bit only ever
      // errs toward drawing a light, so it stands until contradicted)
      let w = lidx >> 5u; let bit = 1u << (lidx & 31u);
      let lit = (atomicLoad(&wgSeen[w]) & bit) != 0u; let blocked = (atomicLoad(&wgSeen[w + 2u]) & bit) != 0u;
      var dk = (atomicLoad(&wgOwn[w]) & bit) != 0u && !auditTile; var lt = (atomicLoad(&wgOwn[w + 2u]) & bit) != 0u;
      if (lit) { dk = false; lt = true; } else if (blocked) { dk = true; lt = false; }
      if (dk) { atomicOr(&wgTileOut[w], bit); }
      if (lt) { atomicOr(&wgTileOut[w + 2u], bit); } }
    if (gradOn && lidx < 8u) {
      var acc = vec4f(0.0); var n0 = 0.0; var n1 = 0.0; var l0 = 0.0; var l1 = 0.0;
      for (var k = 0u; k < 8u; k++) { let j = lidx * 8u + k; acc += wgP[j]; let fl = wgKeep[j]; n0 += f32(fl & 1u); n1 += f32((fl >> 1u) & 1u); l0 += f32((fl >> 2u) & 0x7fffu); l1 += f32(fl >> 17u); }
      wgRowMin[lidx] = acc; wgRowMax[lidx] = vec4f(n0, n1, l0, l1);
    }
    workgroupBarrier();
    if (lidx == 0u) {
      resOut[tileRecIndex(wid.xy, dims)] = vec4u(atomicLoad(&wgTileOut[0]), atomicLoad(&wgTileOut[1]), atomicLoad(&wgTileOut[2]), atomicLoad(&wgTileOut[3]));
      var cf = vec2f(1.0);
      var zs = vec2f(0.0);   // the signed statistic per class (+ = the tile's fresh estimates run above its temporal ones: getting brighter)
      if (gradOn) {
        var acc = vec4f(0.0); var n = vec4f(0.0);
        for (var r = 0u; r < 8u; r++) { acc += wgRowMin[r]; n += wgRowMax[r]; }
        let g = max(ru.cfg2.y, 1.0);
        if (n.x >= 8.0) { let fl = 0.02 * n.z * 1e-3 / n.x; zs.x = acc.x / sqrt(acc.y + fl * fl * n.x + 1e-12); cf.x = 1.0 - smoothstep(g, 1.6 * g, abs(zs.x)); }   // floor: 2 % of the mean lane level counts as noise even where every lane agrees to the bit
        if (n.y >= 8.0) { let fl = 0.02 * n.w * 1e-3 / n.y; zs.y = acc.z / sqrt(acc.w + fl * fl * n.y + 1e-12); cf.y = 1.0 - smoothstep(g, 1.6 * g, abs(zs.y)); }
      }
      wgGrad = vec4f(cf, zs);
    }
    workgroupBarrier();
    conf = wgGrad.xy; gz = wgGrad.zw;
  }

  // ---- phase 2 per class: temporal combine → the reservoir next frame inherits; spatial reuse; shade ----
  var S = array<vec3f, 2>(vec3f(0.0), vec3f(0.0));
  var aOut = array<f32, 2>(0.0, 0.0);
  var stw = vec4u(0u);                   // the words to store (x,y class 0 · z,w class 1)
  if (live) {
    for (var c = 0u; c < 2u; c++) {
      if (Wl[c] <= 0.0) { continue; }                              // no live light of this class here: S 0 (U may still hold walled-off light), empty reservoir
      let twB = select(tw.y, tw.w, c == 1u); let twA = select(tw.x, tw.z, c == 1u);
      let hasT = Mt[c] >= 0.0;
      var M_t = max(Mt[c], 0.0) * select(conf.x, conf.y, c == 1u);
      // the trailing edge of a leaving shadow, per pixel: a DARK history (weight 0) meeting a LIT fresh sample inside a tile whose fresh estimates run above its
      // temporal ones on the whole (z > Z_RELEASE) lets go here and now — the tile-wide reset needs most of the tile's lanes to move and left the sliver behind a
      // walking man mottled at 8×8 granularity for the ~M frames the dilution takes. In the steady state z ~ N(0, 1): 2 % of tiles a frame qualify, and in those
      // only penumbra pixels whose history happens to be dark AND whose fresh ray happens to be lit — a bias too small to find in the tile means (§3.4).
      if (hasT && rW(twB) <= 0.0 && VF[c] > 0.0 && select(gz.x, gz.y, c == 1u) > Z_RELEASE) { M_t = 0.0; }
      let phT = pPT[c];                                             // p̂_prev(y_t): the sample's light as it was, at this point
      let Mf = select(0.0, 1.0, VF[c] >= 0.0) + select(0.0, 1.0, VG[c] >= 0.0);
      // ---- temporal combine: generalized balance heuristic between last frame's domain (M_t, its lights as they were) and this frame's fresh draws ----
      // Selection decides what next frame INHERITS; shading uses EVERY sample traced this frame, each with its own light's hue (col accumulates hue_j × w_j,
      // whose luminance is Σw): the rays are paid for, and a pixel lit by a warm lamp with the moon in its U but behind the ceiling then comes out warm, not the
      // class's aggregate blue-grey — the reservoir converges on the light it can actually see.
      var wsum = 0.0; var col = vec3f(0.0);
      var wOut = 0.0; var colOut = vec3f(0.0);   // HUE SPLIT (direct-quality lane, ru.cfg.w & 128): the part of Σw carried by samples whose light this pixel does NOT believe visible (tile-dark here, or its own darkSlot) — the belief hue below
                                                //  knows nothing of that light, so its share keeps the sample's own hue: deep in one light's shadow the believed set can be a far dim light of another colour (a green exit
                                                //  sign), and the blocked light's penumbra luminance came out painted in it — coloured fringes along shadow boundaries under two lights of different colour (S3: 6 663 green px, 0 with the split)
      var ySlot = 255u; var yUv = 0u; var yV = 0.0; var yP = 0.0;
      if (M_t > 0.0) {
        let mT = select(M_t * phT / (M_t * phT + Mf * pT[c]), 1.0, knownDark && tileDark(bel, curT[c]));   // p̂_prev(y_t) vs p̂_c(y_t) = pT (the stored p̂ stays what the SPATIAL pass reads: p̂_i(x_i) at the neighbour's own point); a y this frame's fresh draw could not have produced (its light tile-dark, out of the draw) is the temporal strategy's alone: m_T = 1
        wsum = mT * pT[c] * VT[c] * rW(twB); col = hueOf(curT[c]) * wsum;
        if (tileDark(bel, curT[c]) || curT[c] + 1u == darkSlot) { wOut = wsum; colOut = col; }   // (HUE SPLIT: a history sample of a light not in the believed set)
        ySlot = curT[c]; yUv = rIu(twA) | (rIv(twA) << 4u); yV = VT[c]; yP = pT[c];
      }
      for (var j = 0u; j < 2u; j++) {
        let Vj = select(VF[c], VG[c], j == 1u);
        if (Vj < 0.0) { continue; }
        let slot = select(pickF[c], pickG[c], j == 1u); let pj = select(pF[c], pG[c], j == 1u);
        // its target LAST frame at this point: the same light as it was then (new this frame → 0 → it enters at full weight)
        var pPrev = 0.0;
        if (M_t > 0.0) { let ps = invSlot(slot); if (ps != 255u) { let evp = evalLight(ru.prevLights[ps], P, N); if (evp.ok) { pPrev = luminance(evp.E); } } }
        let wj = pj / (M_t * pPrev + Mf * pj) * Vj * Wf[c];        // m_j × p̂_c(x_j)·W_j (= Wf exactly: W_j = 1 / p(x_j) = Wf / p̂ over the set the draw ranged over) × V
        if (wj > 0.0) { wsum += wj; col += hueOf(slot) * wj; if (tileDark(bel, slot) || slot + 1u == darkSlot) { wOut += wj; colOut += hueOf(slot) * wj; } }   // (HUE SPLIT: a fresh sample of its own darkSlot light / a light the tile calls dark)
        if (rnd() * wsum < wj) { ySlot = slot; yUv = select(uvF[c], uvG[c], j == 1u); yV = Vj; yP = pj; }
      }
      let Rm = min(M_t + Mf, mCapPix);
      var RW = 0.0;
      if (ySlot != 255u && yV > 0.0 && yP > 0.0) { RW = wsum / (yP * yV); }
      // what next frame inherits: the temporal stage; the hint is this frame's own measurement (0 = none), read back next frame as a one-frame memory.
      // A pixel whose every sample came back dark stores a ZERO-WEIGHT reservoir carrying its confidence M ('looked M times, dark'): next frame's fresh candidate is
      // weighed against that memory instead of being taken at face value — without it only visible outcomes ever reached the history and every soft shadow came
      // out bright. (Nothing at all to name — no candidate, no history — stores nothing.)
      var stSlot = ySlot; if (stSlot == 255u) { stSlot = pickF[c]; }   // (M_t > 0 ⇒ ySlot = curT already; a zero-weight record's lattice point is never re-traced, so uv 0 is fine)
      if (stSlot != 255u) { let pw = packRes(stSlot, Rm, select(0.0, yV, RW > 0.0), yUv & 15u, yUv >> 4u, blurPx[c], RW, select(pF[c], yP, yP > 0.0), 0u); if (c == 0u) { stw.x = pw.x; stw.y = pw.y; } else { stw.z = pw.x; stw.w = pw.y; } }
      // ---- spatial reuse: neighbours' temporal reservoirs (last frame's), pairwise MIS against the canonical sample (ySlot …) ----
      var sLum = wsum;                                              // Σw = the luminance estimate of the class's visible light
      var fSlot = ySlot; var fUv = yUv; var fV = yV; var fromNb = false;
      let motSpatial = RESTIR_MOTION && (ru.cfg.w & 1024u) != 0u && motionPx > ru.mot.z;   // (c) MOTION: spatial reuse wherever this pixel's history is being handed about by motion anyway …
      var kSp = kSpatial; if (motSpatial) { kSp = max(kSp, (ru.cfg.y >> 8u) & 15u); }      // … with at least the motion tap count (cfg.y bits 8‥11): the fresh candidates a cut-down history leans on are one or two rays a pixel; the neighbours' are the rest
      if (kSp > 0u && RW > 0.0 && (finalRay || Rm < ru.cfg2.z || (ru.cfg.w & 2u) != 0u || motSpatial)) {
        let kf = f32(kSp); let Mck = Rm / kf;
        var mc = 0.0;                                               // canonical MIS weight, accumulated pair by pair
        var wsel = 0.0; var ncol = vec3f(0.0);                      // Σ over accepted neighbours: weight, hue × weight
        var nOut = 0.0; var ncolOut = vec3f(0.0);                   // (HUE SPLIT: … of neighbours' samples whose light this pixel does not believe visible)
        var nSlot = 255u; var nUv = 0u; var nV = 0.0; var nP = 0.0;
        let rad = min(ru.cfg2.x, 0.6 * pxPerMetre);                 // never wider than ~0.6 m on the surface
        let phi0 = rnd() * 6.2831853; let r0 = rnd();
        for (var t = 0u; t < kSp; t++) {
          let ang = phi0 + f32(t) * 2.3999632; let rr = rad * sqrt((f32(t) + r0) / kf);
          let q = vec2i(gxy) + vec2i(i32(round(cos(ang) * rr)), i32(round(sin(ang) * rr)));
          var took = false;
          if (all(q >= vec2i(0)) && all(q < vec2i(dims)) && any(q != vec2i(gxy))) {
            let dq = textureLoad(gDepth, vec2u(q), 0);
            if (dq < 1.0) {
              let Pq = worldFromDepth(vec2f(q) + 0.5 + ru.jitter.xy, dq);   // its domain point (unjittered centre), as ours
              let Nq = normalize(textureLoad(gNormal, vec2u(q), 0).xyz * 2.0 - 1.0);
              if (abs(dot(Pq - P, N)) < max(viewW * 0.004, 0.04) && dot(Nq, N) > 0.9) {
                var Pxq = Pq; if (RESTIR_MOTION && (ru.cfg.w & 256u) != 0u) { Pxq = worldFromDepth(vec2f(q) + 0.5, dq); }   // (its raster point, for the stochastic pick's exact flow — its own canonical call measured the same; (b) / (c) never read a tap's motion)
                let tq = prevTexelAt(Pq, Pxq, vec2u(q), dims, false);
                let qa = select(tq.x, tq.z, c == 1u); let qb = select(tq.y, tq.w, c == 1u);
                let cs = select(255u, fwdSlot(rSlot(qa)), rValid(qb));
                let qW = rW(qb); let qPh = rPh(qb);
                if (cs != 255u && qW > 0.0 && qPh > 0.0) {
                  // p̂_c(x_i): the neighbour's light at OUR point now; p̂_i(y_c): our light at ITS point (its stored p̂ is p̂_i(x_i))
                  var tq: array<f32, 2>;   // (both through ONE targetAt call, p̂_c(x_i) first: DXC — Chrome's compiler on Windows — inlines each call it meets)
                  for (var q = 0u; q < 2u; q++) { tq[q] = targetAt(select(ySlot, cs, q == 0u), select(Pq, P, q == 0u), select(Nq, N, q == 0u), q == 0u); }
                  let pcx = tq[0]; let piy = tq[1];
                  let Mi = min(rM(qa), mCap);
                  mc += (Mck * yP) / (Mi * piy + Mck * yP + 1e-12) / kf;
                  let wi = (Mi * qPh) / (Mi * qPh + Mck * pcx + 1e-12) / kf * pcx * rV(qa) * qW;
                  took = true; nTaps++;
                  if (wi > 0.0) { wsel += wi; ncol += hueOf(cs) * wi; if (tileDark(bel, cs) || cs + 1u == darkSlot) { nOut += wi; ncolOut += hueOf(cs) * wi; } if (rnd() * wsel < wi) { nSlot = cs; nUv = rIu(qa) | (rIv(qa) << 4u); nV = rV(qa); nP = pcx; } }
                }
              }
            }
          }
          if (!took) { mc += 1.0 / kf; }                            // a rejected pair: its share of the canonical weight comes home whole
        }
        let wc = mc * yP * yV * RW;                                 // = mc × Σw of the temporal stage: the canonical keeps that stage's colour, scaled
        wsel += wc;
        sLum = wsel; col = col * mc + ncol; wOut = wOut * mc + nOut; colOut = colOut * mc + ncolOut;   // (HUE SPLIT rides through the pairwise MIS scaling with the rest)
        if (rnd() * wsel >= wc && nSlot != 255u) { fSlot = nSlot; fUv = nUv; fV = nV; fromNb = true; yP = nP; nNb++; }
      }
      // ---- shade: S = hue × Σw (luminance Σw = the class's visible light, never above its live unshadowed total) × glass tint ----
      var tint = vec3f(1.0);
      var visK = 1.0;                                               // final-ray correction for a neighbour's sample: V here ÷ V there
      if (fSlot != 255u && sLum > 0.0) {
        if (fromNb && finalRay) {
          let vs = traceSample(fSlot, Po, N, owner, fUv & 15u, fUv >> 4u); nRays++;
          visK = vs.x / max(fV, 1e-3);
          if (vs.y >= 0.0) { blurPx[c] = max(blurPx[c], hintPx(vs.y, pxPerMetre, yP / W[c])); }
          if (vs.y == SOFT_CLEAR_Y) { softC[c] = true; }
        }
        if (visK > 0.0) { let gm = wgGlass[fSlot]; if (gm != 0u) { tint = glassVis(wgLights[fSlot], gm, P); } }
      }
      // hue: the believed-visible unshadowed mix at THIS pixel (Uv — exact irradiances, so two overlapping panels grade across the floor as they should and a
      // pixel reads the same colour whichever light its reservoir holds); the samples' own hues (col, luminance Σw too) only where nothing believed visible
      // lights the pixel — the frame a light first reaches a tile that had it dark — or under the A/B bit
      var shade = col;
      if ((ru.cfg.w & 8u) == 0u) { let lv = luminance(Uv[c]); if (lv > 0.0) {
        if ((ru.cfg.w & 128u) != 0u) { shade = Uv[c] * (max(sLum - wOut, 0.0) / lv) + colOut; }   // HUE SPLIT: the believed-visible mix colours only the luminance its own lights carried; the rest keeps its samples' hue
        else { shade = Uv[c] * (sLum / lv); } } }
      S[c] = shade * tint * (visK * min(1.0, Wl[c] / max(sLum * visK, 1e-9)));
      // hint: own measurement this frame, else last frame's own measurement at this surface (one frame of memory), else 0 = inherit in the filter
      var own = blurPx[c];
      if (own <= 0.0 && hasT) { own = rHint(twA); }
      aOut[c] = -clamp(min(own, frame.directCfg.z) / MAX_BLUR_PX, 0.0, 1.0);
      if (own <= 0.0 && softC[c]) { aOut[c] = -SOFT_HINT_FLAG; }   // no box penumbra measured or remembered here, and a man's DRAWN shadow on the pixel: the denoiser takes this frame's ratio as it is (SDF rig iii)
    }
    // + the TRANSIENT stratum (header): E × V of the picked transient ÷ its pick probability = Wt × V, in its own hue, through its own panes — exact in expectation, no history either way
    //   (under the hybrid this is the held TAIL: the carried lights past the two leaders, one importance-picked ray a class)
    // + the HELD leaders (header): each shaded EXACTLY — its irradiance here × the mean visibility of its K strata, through its own panes; a class lit by carried light alone hands its rays' hint on
    // (turns 0, 1 = the transient stratum's two classes, turns 2, 3 = the two held leaders: ONE glassVis call for the four — DXC inlines each call it meets)
    for (var q = 0u; q < 4u; q++) {
      var slot = 0u; var c = q;
      if (q < 2u) {
        if (pickT[c] == 255u || VTr[c] <= 0.0) { continue; }
        slot = pickT[c];
      } else {
        let h = q - 2u;
        if (hS[h] == 255u) { continue; }
        slot = hS[h]; c = select(0u, 1u, lightBroad(wgLights[slot]));
        if (Wl[c] <= 0.0) { aOut[c] = -clamp(min(blurPx[c], frame.directCfg.z) / MAX_BLUR_PX, 0.0, 1.0); }
        if (hV[h] <= 0.0) { continue; }
      }
      var tt = vec3f(1.0); let gm = wgGlass[slot]; if (gm != 0u) { tt = glassVis(wgLights[slot], gm, P); }
      if (q < 2u) {
        S[c] += hueOf(slot) * tt * (Wt[c] * VTr[c]);
        if (Wl[c] <= 0.0) { aOut[c] = -clamp(min(blurPx[c], frame.directCfg.z) / MAX_BLUR_PX, 0.0, 1.0); }   // (a class lit here by the transient alone still hands its ray's penumbra hint on)
      } else {
        let h = q - 2u;
        var hDiv = f32(heldK); if (heldAdapt) { hDiv = hN[h]; }   // (TRADE held adaptive: the mean is over the strata actually traced)
        S[c] += select(hE1, hE0, h == 0u) * tt * (hV[h] / hDiv);
      }
    }
  }
  // ---- store: reservoirs (temporal stage) with the depth signature and the pixel's darkSlot, the two S textures (U went out after scoring) ----
  if (onScreen) {
    let dcode = select(0u, depthEncode(viewW), live);
    stw.x = stw.x | ((dcode >> 6u) << 26u); stw.z = stw.z | ((dcode & 63u) << 26u);
    stw.y = stw.y | ((darkSlot & 7u) << 28u); stw.w = stw.w | ((darkSlot >> 3u) << 28u);   // 3 + 3 spare bits of the two B words (a class with no reservoir still carries them: its valid bit stays 0)
    resOut[resIndex(gxy, dims)] = stw;
    if (live) {
      if (frame.debugView == 11u) {   // diagnostic (passes.ts skips the filter chain for 11 / 12, composite shows S0 raw): r = history M / cap class 0, g = class 1, b = 1 − tile gradient confidence
        S[0] = vec3f(rM(stw.x) / mCap * select(0.0, 1.0, rValid(stw.y)), rM(stw.z) / mCap * select(0.0, 1.0, rValid(stw.w)), 1.0 - min(conf.x, conf.y)); S[1] = vec3f(0.0);
      } else if (frame.debugView == 12u) {   // r = shadow rays traced this frame ÷ 6, g = spatial taps accepted ÷ 2k, b = classes shaded from a neighbour's sample ÷ 2
        S[0] = vec3f(f32(nRays) / 6.0, f32(nTaps) / max(f32(kSpatial) * 2.0, 1.0), f32(nNb) * 0.5); S[1] = vec3f(0.0);
      }
      textureStore(outSharpS, gxy, vec4f(S[0], aOut[0]));
      textureStore(outBroadS, gxy, vec4f(S[1], aOut[1]));
    } else {
      textureStore(outSharpS, gxy, vec4f(0.0)); textureStore(outBroadS, gxy, vec4f(0.0));
    }
  }
}
