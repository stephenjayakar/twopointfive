// FOG OF WAR — the picture's half (game/fogofwar.ts has the rule; render/fogofwar.ts owns this pass). Dispatched ONLY while the switch is on: off = no pass,
// no copy, and no other shader's text touched. Runs after the composite (+ the particles' splat, + GBAA) and before the resolve, IN PLACE on hdr: the host copies
// hdr → a copy first, this reads the copy and stores hdr (the GBAA arrangement).
//
// Per pixel: where is the surface it shows (depth → world), and can any of the team's eyes (≤ 7) see THAT SPOT IN PLAN — a ray from the eye, level at the eye's
// own height, to the spot's (x, z) through the renderer's own trace grid (occludedTBoxes: every box a shadow ray meets — statics, door leaves, furniture, and
// the things other men carry; glass panes are not in the grid, so sight passes them; characters' bodies are not asked, and the eye's own kit is skipped). In
// plan, at eye height: the floor behind a desk is seen (he sees over it) and the floor behind a wall, a tall cabinet or a shut leaf is not — the Door Kickers
// picture, on the statics and leaves the CPU's eye test (collision.ts segmentBlocked) walks for the men. The eye is handed in over the man's FEET at a nominal
// height for his stance (game/fogofwar.ts FogEye.at), not at his animated head: the mask must not move with his stride.
// The ray stops a hand short of the spot: a wall's FACE is seen when the floor at its foot is (the spot is pushed off the face along its normal first), and a
// top face above the eye — a wall's top, a tall cabinet's — when the line reaches within `topPad` of it (its own box stands in the way of anything nearer).
// A pixel nobody sees keeps its radiance, pushed toward its own grey by `desat` and scaled by `dim`. The sky is left alone.
// THE CONE (game/fogofwar.ts FOG.cone — hard's fog): an eye's wedge then has a SOFT edge in the picture — the dimming comes in across `soft.x ‥ soft.y` (the
// cosines either side of the wedge's own) and outward over `soft.z` metres from the near field's rim — so the mask a turning man sweeps over the floor has no
// hard line in it. All three 0 (every eye all round, or a plain fovDeg wedge) = seen or not, the answer as it always was.
//
// TWO PROGRAMS FROM THIS FILE (render/fogofwar.ts fogSource puts them together; FogFrame.pass / ?fogpass=old picks):
//   'old'  = the text down to the first //#SECTION line exactly as it stands — every //# line in it is a comment, so its tokens are the kernel's as it always was (but for the soft edge, fowEdge, in both programs alike):
//            one walk of the trace grid per eye per pixel until an eye sees the spot.
//   'hint' = the same kernel with its `//#H ` lines taken in and its `//#OLD` lines left out, plus the sections below it. THE SAME ANSWER FOR LESS WORK: every eye's
//            ray is level at the eye's own height, so what stands between an eye and a spot depends on the bearing alone. A tiny pass first (`pre`) walks FOW_BINS
//            level rays round each eye and keeps the box each one met first; a pixel then asks that one box (its bearing's two neighbours' boxes) before walking the
//            grid: if the pixel's own ray meets it short of the spot — the box drawn in a millimetre, so the meeting is well inside the cells it is registered
//            in (fowHintBox) — the walk would have met it too, by its own isectBox of the whole box in a cell it visits: the eye does not see the spot and the
//            walk is not taken. A box that does not answer proves nothing: the walk is taken as ever. The table only PROPOSES a box; the answer is the test's.
//            So a pixel nobody sees costs a box test or two an eye where it cost a walk an eye, and no pixel's answer can differ. It also leaves alone what it does
//            not change: a seen pixel and the sky are not stored back (hdr already holds them) and the copy is read only where it is needed.
//   (`//#C ` / `//#CH ` lines + the count section: tools/qa/fog-pass-check.cjs's counting programs — rays, box tests and cells per pixel instead of the picture.)
struct FowU {
  eyes: array<vec4f, 7>,    // xyz = the eye, w = his character id (0 = no eye in this slot): the ray skips the boxes he carries himself (goggles at the eye, the gun)
  looks: array<vec4f, 7>,   // xy = where it looks in plan (x, z; unit), z = cos of the half field (≤ −1.5: all round), w = the near field's radius (m)
  cfg: vec4f,               // x = eyes, y = dim, z = desaturation, w = topPad (m)
  soft: vec4f,              // the cone's soft edges: x = cos(half field − half band), y = cos(half field + half band) (x > y; both 0 = a hard line), z = the near rim's band (m; 0 = hard) · w = the fog's own light (0 = off: the live frame, dimmed)
  lit: vec4f,               // THE FOG LIT AS THE TEAM LAST KNEW IT (game/fogofwar.ts FOG.lit; read only under the fog's own light, soft.w > 0): x = gain on the remembered lamps' light, over cfg.y (0 = off: the one fixed light), y = the fill's level as displayed, z = lamps in fowLights, w = a lamp that would add less than this at the pixel (as displayed) is not traced, one under twice it is faded in
  lit2: vec4f,              // x = how much of the fill a corner, the foot of a wall or the floor under a table loses (0 = no such rays), y = how far those rays reach (m) · z = 1: THE FULL PICTURE (FOG.full) — soft.w's light, as lit.y, is a fill added to the live frame dimmed, and no lamp of fowLights is read
};
@group(1) @binding(0) var fowSrc: texture_2d<f32>;                          // the composite as written (a copy: hdr itself is stored over)
@group(1) @binding(1) var fowOut: texture_storage_2d<rgba16float, write>;   // hdr
@group(1) @binding(2) var fowDepth: texture_depth_2d;                       // the g-buffer's depth at the composite's size (the output-size raster under sharp direct)
@group(1) @binding(3) var fowNormal: texture_2d<f32>;                       // … and its normals
@group(1) @binding(4) var<uniform> fow: FowU;
@group(1) @binding(5) var fowAlbedo: texture_2d<f32>;                       // … and its paint (read only under the fog's own light)

const FOW_LIGHTS: u32 = 48u;                // render/fogofwar.ts FOG_LIGHTS (change both together)
struct FowLights { l: array<Light, 48> };
@group(1) @binding(8) var<uniform> fowLights: FowLights;                    // the level's own lamps as the team last knew them + the sun or moon (game/fogofwar.ts litBlock): never `lights`, the live frame's

const FOW_FACE_OFF: f32 = 0.06;   // the spot is taken this far off its surface along the normal (in plan), and the ray stops this short of it

// ---- THE FOG'S SOFT EDGE (game/fogofwar.ts FOG.edge — the maintainer, 10-15: 'fog of war edges shouldn't be so sharp'; fogSight.cfg.w = the band in metres, 0 = the
// hard line as it was). THE BAND LIES ACROSS THE SIGHT LINE, half on each side: an eye gives a spot it sees 1, less within half a band of its sight edge, and a
// spot it does not see 0, more within half a band of it — 0.5 on the line itself — and the team's answer is the most any eye gives, as it always was (so the line of a
// stack of men is one man's line, and the cone's soft edge is untouched). NOTHING HIDDEN SHOWS: what the band brightens past the line is the fog's own picture (rule 4g: the live frame with every
// light the team should not see already cut where it is made, no unseen man drawn, the things where last seen), dimmed less — and a light's fog class
// (common.wgsl lightFogK) is still cut ON the line. THE FOG PASS ALONE: no program that lights a pixel carries any of this, and the guards' meter reads what it
// read. The line is looked for in the sight table (common.wgsl FogSightT: how far each bearing's level ray goes), the bearings either side of the spot's own out
// to half a band at the spot's range (FOW_EDGE_BINS at most), every one of them — a table row is four bearings, and a row with nothing to say is one read:
//   · of a spot the eye SEES, the first bearing where a NEARER THING STARTS in front of the spot's range (fowFirstShort): its ray stops short, and nearer than the
//     bearings either side of the step carry on to (fowRel: 1 / range runs straight along a flat face, so a WALL through the spot's range — the wall a floor spot
//     stands at the foot of, a wall's own face seen at a slant, a room's corner — is passed over, and the line a pillar casts up that wall is still found);
//   · of a spot it does NOT see, the first bearing that goes as far as the spot (fowFirstClear; less FOW_EDGE_SLANT × the way across, which is what a wall
//     through the spot at a slant explains), and the same question of the step before it: past a thing that ends, not a wall that carries on.
// The band is `cfg.w` × how sure the step is (FOW_EDGE_JLO ‥ JHI: no pop as a man walks) × how far behind the nearer thing the spot is, up to a band (the line
// leaves a corner hard and widens behind it, as a shadow's edge does; a spot beside the thing is not dimmed). tools/qa/fog-probes.ts edgeReplica is this, in
// plan, statement for statement, and holds its rules: CHANGE BOTH TOGETHER (the probe pins this text's hash).
const FOW_EDGE_BINS: i32 = 64;      // the most bearings searched a side
const FOW_EDGE_JLO: f32 = 0.06;     // a nearer thing starts where 1 / range steps up by this share over the bearings beside it … (no band under it)
const FOW_EDGE_JHI: f32 = 0.18;     // … the whole band from this share up
const FOW_EDGE_SLANT: f32 = 2.0;    // a bearing 'goes as far' as an unseen spot when it stops short by no more than this × the way across to it
const FOW_EDGE_RUN: f32 = 0.03;     // the most 1 / range runs on by, a bearing, along a real face (one seen 84° off square), as a share of itself
const FOW_EDGE_THIN: f32 = 4.0;     // a band under a third of this many bearings wide at the spot is not drawn, the whole of it from this many up: right behind
                                    // the thing that casts it the band is narrower than the table can place it, and it beaded along a door leaf's end
fn fowBin(k: i32, j: i32) -> f32 { return max(fogSightD(k, j & (FOG_SIGHT_BINS - 1)), 1e-3); }
/// how much nearer the thing at bearing b is than the bearings beside the step carry on to, as a share of 1 / its range (b − s = the last bearing before it)
fn fowRel(k: i32, b: i32, s: i32) -> f32 {
  let ib = 1.0 / fowBin(k, b); let ic = 1.0 / fowBin(k, b - s);
  // (each side's run is held to what a face can give: a far thing one bearing wide beside the step must not 'explain' the step away — a band that blinked)
  let before = ic + clamp(ic - 1.0 / fowBin(k, b - 2 * s), -FOW_EDGE_RUN * ic, FOW_EDGE_RUN * ic);
  let after = ib + clamp(ib - 1.0 / fowBin(k, b + s), -FOW_EDGE_RUN * ib, FOW_EDGE_RUN * ib);
  return min(ib - before, after - ic) / ib;
}
/// of a spot the eye sees: (bearings from j0, going s, to the first where a nearer thing starts · that thing's range · fowRel there); x < 0 = none within H
fn fowFirstShort(k: i32, j0: i32, s: i32, H: i32, need: f32) -> vec3f {
  var o = 0;
  for (var it = 0; it <= FOW_EDGE_BINS; it++) {
    if (o > H) { break; }
    let b = j0 + s * o; let bw = b & (FOG_SIGHT_BINS - 1);
    if ((bw & 3) == select(3, 0, s > 0) && o + 3 <= H) {                    // a whole row ahead: all four as far as the spot = nothing starts in it
      if (all(fogSight.dist[(k * FOG_SIGHT_BINS + bw) >> 2u] >= vec4f(need))) { o += 4; continue; }
    }
    let rb = fowBin(k, bw);
    if (rb < need) { let rel = fowRel(k, b, s); if (rel > FOW_EDGE_JLO) { return vec3f(f32(o), rb, rel); } }
    o += 1;
  }
  return vec3f(-1.0, 0.0, 0.0);
}
/// of a spot the eye does not see: bearings from j0, going s, to the first that goes as far as the spot; −1 = none within H
fn fowFirstClear(k: i32, j0: i32, s: i32, H: i32, need: f32, perBin: f32) -> i32 {
  var o = 0;
  for (var it = 0; it <= FOW_EDGE_BINS; it++) {
    if (o > H) { break; }
    let bw = (j0 + s * o) & (FOG_SIGHT_BINS - 1);
    if ((bw & 3) == select(3, 0, s > 0) && o + 3 <= H) {                    // a whole row ahead: all four short of the spot = no bearing in it reaches
      if (all(fogSight.dist[(k * FOG_SIGHT_BINS + bw) >> 2u] < vec4f(need - FOW_EDGE_SLANT * f32(o + 4) * perBin))) { o += 4; continue; }
    }
    if (fogSightD(k, bw) >= need - FOW_EDGE_SLANT * f32(o + 1) * perBin) { return o; }
    o += 1;
  }
  return -1;
}
/// what eye k gives of the plan spot q, `need` along its ray: `clear` = the pixel's own ray reaches it (1, less near the eye's sight edge) or does not (0, more near it)
fn fowEdge(k: i32, e: vec4f, q: vec2f, need: f32, clear: bool) -> f32 {
  let hard = select(0.0, 1.0, clear);
  let band0 = fogSight.cfg.w;
  if (band0 <= 0.0 || fogSight.cfg.y != 1.0) { return hard; }
  let to = q - e.xz; let d = length(to);
  if (d < 0.05) { return hard; }
  let perBin = d * 6.283185307179586 / f32(FOG_SIGHT_BINS);                 // metres across the eye's line a bearing, at the spot's range
  let H = clamp(i32(ceil(0.5 * band0 / perBin)), 1, FOW_EDGE_BINS);
  let u = (atan2(to.y, to.x) / 6.283185307179586 + 0.5) * f32(FOG_SIGHT_BINS) - 0.5;
  let j0 = i32(floor(u + 0.5)); let fr = u - f32(j0);
  let most = 2.0 * f32(H) * perBin;                                         // (close to the eye the search is under half a band wide: the band is no wider than what was searched)
  var v = hard;
  for (var side = 0; side < 2; side++) {
    let s = select(-1, 1, side == 1);
    if (clear) {
      let f = fowFirstShort(k, j0, s, H, need); if (f.x < 0.0) { continue; }
      let be = min(most, band0 * smoothstep(FOW_EDGE_JLO, FOW_EDGE_JHI, f.z) * smoothstep(0.0, 1.0, (need - f.y) / band0)); if (be < 1e-4) { continue; }
      v = min(v, mix(1.0, smoothstep(0.0, 1.0, 0.5 + max(0.0, f.x - 0.5 - f32(s) * fr) * perBin / be), smoothstep(FOW_EDGE_THIN / 3.0, FOW_EDGE_THIN, be / perBin)));
    } else {
      let o = fowFirstClear(k, j0, s, H, need, perBin); if (o < 0) { continue; }
      let c = j0 + s * o; let rb = fowBin(k, c - s); if (rb >= need) { continue; }   // (the bearing before it is the nearer thing's last)
      // the thing bearing c reaches, carried back along its own run to the spot's bearing, stands in FRONT of the spot: a wall the spot is behind, and both
      // sides of this step are unseen (the line a pillar casts meeting a partition: no bright tick behind the partition)
      let ic = 1.0 / fowBin(k, c); if ((ic + f32(o) * clamp(ic - 1.0 / fowBin(k, c + s), -FOW_EDGE_RUN * ic, FOW_EDGE_RUN * ic)) * need > 1.0) { continue; }
      let be = min(most, band0 * smoothstep(FOW_EDGE_JLO, FOW_EDGE_JHI, fowRel(k, c - s, -s)) * smoothstep(0.0, 1.0, (need - rb) / band0)); if (be < 1e-4) { continue; }
      v = max(v, smoothstep(0.0, 1.0, 0.5 - max(0.0, f32(o) - 0.5 - f32(s) * fr) * perBin / be) * smoothstep(FOW_EDGE_THIN / 3.0, FOW_EDGE_THIN, be / perBin));
    }
  }
  return v;
}

/// how far the team sees this spot: 1 = seen, 0 = not, between = across a cone's soft edge or a sight edge's band (the most any eye gives it)
fn fowSeen(P: vec3f, N: vec3f) -> f32 {
  let n = u32(fow.cfg.x);
  let softEdge = fow.soft.x > fow.soft.y;
  var best = 0.0;
  for (var k = 0u; k < n; k++) {
    let e = fow.eyes[k]; if (e.w < 0.5) { continue; }
    let top = N.y > 0.5 && P.y > e.y - 0.05;                       // a top face at or above this eye: its own box is between the eye and it
    let q = vec3f(P.x + N.x * FOW_FACE_OFF, e.y, P.z + N.z * FOW_FACE_OFF);
    let to = q - e.xyz; let d = length(to);
    let pad = select(FOW_FACE_OFF, max(fow.cfg.w, FOW_FACE_OFF), top);
    if (d <= pad + 0.02) { return 1.0; }                           // at the eye's own feet
    let rd = to / d;
    let L = fow.looks[k];
    var w = 1.0;
    if (L.z > -1.5 && d > L.w) {                                   // outside this eye's near field: its wedge decides
      let c = dot(rd.xz, L.xy);
      if (softEdge) { w = smoothstep(fow.soft.y, fow.soft.x, c); } else if (c < L.z) { w = 0.0; }
      if (fow.soft.z > 0.0) { w = max(w, 1.0 - smoothstep(L.w, L.w + fow.soft.z, d)); }   // the near field's rim fades outward
    }
    if (w <= best) { continue; }                                   // nothing this eye could add (outside its wedge altogether: w 0)
    //#H if (fowHintBlocked(k, e, rd, d - pad)) {                  // HINTED: a box this bearing's table names stands in the pixel's own ray — the walk below would meet it
    //#CH   if (occludedTBoxes(e.xyz, rd, d - pad, u32(e.w + 0.5), -1.0) < 0.0) { fowCount.x += 64.0; }
    //#H   best = max(best, w * fowEdge(i32(k), e, q.xz, d - pad, false));   // (0 but within half a band of this eye's sight edge — THE SOFT EDGE, above)
    //#H   continue; }
    //#C fowTally(e.xyz, rd, d - pad, u32(e.w + 0.5));
    let clear = occludedTBoxes(e.xyz, rd, d - pad, u32(e.w + 0.5), -1.0) < 0.0;
    best = max(best, w * fowEdge(i32(k), e, q.xz, d - pad, clear));   // (1 or 0 with the band off; across the band between)
    if (best >= 1.0) { return 1.0; }
  }
  return best;
}

// ---- THE FOG LIT AS THE TEAM LAST KNEW IT (FOG.lit) — an unseen pixel's light is traced here from three things and nothing else: the paint under the pixel, the
// level's own lamps in the state the team last saw each in (fowLights — the CPU's list; `lights`, the live frame's, is never read), and the boxes as handed to the
// picture, which under the fog are the statics, the leaves and the loose things where the team last saw them (game/fogofwar.ts rules 4b, 4d). No radiance of the
// live frame, no man's torch, no flash; and no man's shadow either: a box somebody carries is passed through (fowLitHit), and bodies are not boxes.
/// occludedTBoxes (common.wgsl), its walk statement for statement, with two differences: no capsule cap, and EVERY box that has an owner is passed through. How far
/// along the ray the first box met stands (near-first by cell, as there), −1 = clear.
fn fowLitHit(ro: vec3f, rd: vec3f, tmaxIn: f32) -> f32 {
  let invRd = safeInv(rd);
  let tb = isectBounds(ro, invRd, WORLD_MIN, WORLD_MAX);
  if (tb.x > tb.y || tb.y < 0.0) { return -1.0; }
  let tmax = min(tmaxIn, tb.y);
  let gskip = (frame.flags & FLAG_GRID_SKIP) != 0u; let ycull = (frame.flags & FLAG_GRID_YCULL) != 0u; let fast = gskip || ycull; let axisFast = (frame.flags & FLAG_AXIS_BOX) != 0u;
  let slabs = (frame.flags & FLAG_GRID_SLABS) != 0u; let shrink = select(0.0, scene.grid.y, slabs);
  let yEnd = ro.y + rd.y * tmax;
  let pEnd = vec3f(ro.x + rd.x * tmax, yEnd, ro.z + rd.z * tmax);
  let sLo = min(ro, pEnd); let sHi = max(ro, pEnd);
  for (var g = 0u; g < scene.numGlobals; g++) {
    if (globalSkipped(g, sLo, sHi, ycull, slabs)) { continue; }
    let bi = scene.globals[g >> 2u][g & 3u];
    if (boxOwner(boxGeo[bi]) != 0u) { continue; }
    let r = isectBox(ro, rd, boxGeo[bi], tmax, bi, invRd, axisFast);
    if (r.x >= 0.0) { return r.x; }
  }
  var run = 0u;
  let t0 = max(tb.x, 0.0);
  let p = ro + rd * t0;
  var cell = vec2i(clamp(vec2i(floor(p.xz / GRID_CELL)), vec2i(0), vec2i(GRID_W - 1, GRID_H - 1)));
  let stp = vec2i(select(-1, 1, rd.x >= 0.0), select(-1, 1, rd.z >= 0.0));
  let tDelta = vec2f(abs(GRID_CELL * invRd.x), abs(GRID_CELL * invRd.z));
  let nextBoundary = (vec2f(cell) + vec2f(select(0.0, 1.0, rd.x >= 0.0), select(0.0, 1.0, rd.z >= 0.0))) * GRID_CELL;
  var tNext = vec2f(t0) + (nextBoundary - p.xz) * vec2f(invRd.x, invRd.z);
  tNext = select(tNext, vec2f(1e30), vec2<bool>(abs(rd.x) < 1e-20, abs(rd.z) < 1e-20));
  var tCell = t0;
  var tBack = 0.0;
  let slack = scene.grid.x / GRID_CELL;
  for (var iter = 0; iter < 96; iter++) {
    let ci = u32(cell.y * GRID_W + cell.x);
    var cw: CellWalk;
    if (fast) { cw = gridCell(ci, ro.y + rd.y * max(tCell - tBack, t0), yEnd, &run, gskip, ycull, shrink); }
    else { cw.start = gridCells[ci]; cw.end = gridCells[ci + 1u]; cw.qlo = 0u; cw.qhi = 255u; }
    var bestInCell = -1.0;
    for (var k = cw.start; k < cw.end; k++) {
      let gi = gridItem(k, cw, ycull); if (gi < 0) { continue; }
      let bi = u32(gi);
      let b = boxGeo[bi];
      if (boxOwner(b) != 0u) { continue; }
      let r = isectBox(ro, rd, b, tmax, bi, invRd, axisFast);
      if (r.x >= 0.0 && (bestInCell < 0.0 || r.x < bestInCell)) { bestInCell = r.x; }
    }
    if (bestInCell >= 0.0) { return bestInCell; }
    if (tNext.x < tNext.y) { tCell = tNext.x; tNext.x += tDelta.x; cell.x += stp.x; tBack = tDelta.x * slack; }
    else { tCell = tNext.y; tNext.y += tDelta.y; cell.y += stp.y; tBack = tDelta.y * slack; }
    if (tCell > tmax || cell.x < 0 || cell.y < 0 || cell.x >= GRID_W || cell.y >= GRID_H) { break; }
  }
  return -1.0;
}
/// how much of the fill reaches the spot, 0‥1: six fixed rays a short way up and out round the surface's normal, each shutting out more the nearer the box it meets —
/// the dark at the foot of a wall, in a corner, under a table. Fixed rays and a weight that falls off with distance: nothing in it moves from frame to frame.
/// −1 = the spot is INSIDE a box (a ray met one at its own start: the top of a wall under the ceiling slab the picture leaves out) — the caller gives it the fill whole.
fn fowLitOpen(Po: vec3f, N: vec3f) -> f32 {
  let reach = fow.lit2.y;
  if (fow.lit2.x <= 0.0 || reach <= 0.0) { return 1.0; }
  let up = select(vec3f(0.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), abs(N.y) > 0.9);
  let T = normalize(cross(up, N)); let B = cross(N, T);
  var shut = 0.0;
  for (var k = 0; k < 6; k++) {
    let a = (f32(k) + 0.25) * 1.0471975512;
    let rd = normalize((T * cos(a) + B * sin(a)) * 0.7 + N * 0.714);
    let t = fowLitHit(Po, rd, reach);
    if (t >= 0.0) { if (t < 0.002) { return -1.0; } shut += 1.0 - t / reach; }
  }
  return 1.0 - fow.lit2.x * min(shut * 0.3, 1.0);
}
/// the unseen pixel under FOG.lit: the paint under the fill (`form` = the fixed light's own shape; shut out where fowLitOpen says) + under each remembered lamp that
/// a ray from the spot reaches + the glow of a lit panel's own face (an area lamp stands 7 cm proud of the face it is the light of: game.ts)
fn fowLit(P: vec3f, N: vec3f, paint: vec3f, form: f32) -> vec3f {
  let Po = P + N * 0.03;
  let inv = 1.0 / max(frame.exposure, 1e-4);
  let open = fowLitOpen(Po, N);
  var E = vec3f(fow.lit.y * form * inv * select(open, 1.0, open < 0.0) * 3.14159265);
  if (open < 0.0) { return paint * E * (1.0 / 3.14159265); }
  let gain = fow.lit.x * fow.cfg.y;
  let n = min(u32(fow.lit.z), FOW_LIGHTS);
  let cut = fow.lit.w * inv * 3.14159265;
  var glow = vec3f(0.0);
  for (var i = 0u; i < n; i++) {
    let li = fowLights.l[i];
    if (lightKind(li) == 3u && dot(N, li.dir) > 0.9) {
      let rel = P - li.pos; let h = dot(rel, li.dir); let lat = rel - li.dir * h;
      if (h > -0.09 && h < -0.05 && dot(lat, lat) < li.radius * li.radius * 2.25) { glow += li.color * (gain / (3.14159265 * max(li.radius * li.radius, 1e-4))); continue; }
    }
    let ev = evalLight(li, P, N);
    if (!ev.ok) { continue; }
    let e = ev.E * gain;
    let k = smoothstep(cut, 2.0 * cut, max(e.x, max(e.y, e.z)));
    if (k <= 0.0) { continue; }
    if (fowLitHit(Po, ev.L, ev.dist.x - 0.05) >= 0.0) { continue; }
    E += e * k;
  }
  return paint * E * (1.0 / 3.14159265) + glow;
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let dims = vec2i(textureDimensions(fowOut));
  let p = vec2i(gid.xy);
  if (p.x >= dims.x || p.y >= dims.y) { return; }
  //#C fowCount = vec4f(0.0);
  let c = textureLoad(fowSrc, p, 0);   //#OLD
  let depth = textureLoad(fowDepth, p, 0);
  //#C if (depth >= 1.0) { textureStore(fowOut, p, vec4f(0.0)); return; }
  if (depth >= 1.0) { textureStore(fowOut, p, c); return; }       // the sky   //#OLD
  //#H if (depth >= 1.0) { return; }                              // the sky: hdr holds it already (the copy was made from hdr)
  let P = worldFromDepth(vec2f(p) + 0.5, depth);
  let N = normalize(textureLoad(fowNormal, p, 0).xyz * 2.0 - 1.0);
  fogEyeThin = fogThinOn();   // (FOG.thin: every ray fowSeen walks is a fog eye's; nothing after it in this pass meets a thin box as anything else)
  let seen = fowSeen(P, N);
  fogEyeThin = false;
  //#C if (true) { textureStore(fowOut, p, fowCount); return; }
  if (seen >= 1.0) { textureStore(fowOut, p, c); return; }   //#OLD
  //#H if (seen >= 1.0) { return; }                               // seen: likewise
  //#H let c = textureLoad(fowSrc, p, 0);
  let grey = vec3f(luminance(c.rgb));
  var unseen = mix(c.rgb, grey, fow.cfg.z) * fow.cfg.y;
  // THE FOG'S OWN LIGHT (game/fogofwar.ts FOG.flat): a pixel nobody sees is the surface's paint under one fixed light — nothing of the live frame is in it, so no
  // lamp, weapon light, muzzle flash, tracer, smoke, beam or particle in a room nobody watches shows there (soft.w = the level as displayed: the exposure is taken out)
  if (fow.soft.w > 0.0) {
    let paint = textureLoad(fowAlbedo, p, 0).rgb;
    let form = 0.62 + 0.38 * max(N.y, 0.0) + 0.07 * N.x;                 // floors and tops a little over walls, one side of a wall over the other: the building reads as a plan
    var lit = paint * (fow.soft.w * form / max(frame.exposure, 1e-4));
    // … LIT AS THE TEAM LAST KNEW IT (FOG.lit): the same paint under the level's own lamps as the team last saw them, with their shadows, and the fixed light
    // as a low fill that corners and the undersides of things shut out — still nothing of the live frame
    if (fow.lit.x > 0.0) { lit = fowLit(P, N, paint, form); }
    let own = mix(lit, vec3f(luminance(lit)), fow.cfg.z);
    // … or, under THE FULL PICTURE (FOG.full, lit2.z: the unseen pixel is the live frame dimmed, its hidden lights cut where they are made — common.wgsl
    // lightFogK), that light is only a fill ADDED to the dimmed frame, so a room with no lamp lit is not a black hole in the plan
    unseen = select(own, unseen + own, fow.lit2.z > 0.5);
  }
  if (seen <= 0.0) { textureStore(fowOut, p, vec4f(unseen, c.a)); return; }
  textureStore(fowOut, p, vec4f(mix(unseen, c.rgb, seen), c.a));
}
//#SECTION hint — the 'hint' program only (see the head of the file)
@group(1) @binding(6) var fowHint: texture_2d<u32>;                         // row = eye, column = bearing bin: (1 + the box that eye's level ray along the bin's bearing met first) | (how far, cm) << 16 — 0 = none
const FOW_BINS: i32 = 2048;                // bearing bins round an eye = render/fogofwar.ts FOG_BINS (change both together): 0.18 degrees, 3 cm across at 10 m
const FOW_TAU: f32 = 6.283185307179586;
const FOW_WALK_WHOLE: bool = GRID_W + GRID_H <= 96;   // the walk's 96-cell cap can never end a ray inside this world (a ray crosses fewer than W + H cells; boxes.ts asserts the same sum) — were it able to, a hint could answer where the walk gives up

/// Does box `bi` stand in the ray e + rd·[0, tmax]? true = the walk (occludedTBoxes with the same ray, tmax and owner) answers 'blocked' for certain. The box is
/// asked DRAWN IN: a traced box can reach scene.grid.x metres past the cells it is registered in (f16 yaw, f32 centres — common.wgsl, the notes above gridCell),
/// and a ray that only clips that sliver, or ends in it, is met by no cell of the walk. So the plan half sizes are cut by that slack + 1 mm: a ray that meets THAT
/// box inside [0, tmax] does so at a point a millimetre inside the registered footprint — in a cell the walk visits before tmax (or across a cell line its float
/// stepping puts a hair off: the footprint covers that side too), where the walk's own isectBox of the whole box, a superset with the same cut planes, answers
/// hit, 4 cm of height pad inside the cell's cull (a level ray: the hit is at the eye's own height). Or the walk answered 'blocked' before it got there: the same
/// answer. A global is asked by the walk unless its bounds, 5 mm proud, miss the segment's — they cannot, around a meeting point. Not asked at all: a tumbling box
/// (its footprint is not its yaw's) and anything the eye's own man carries (the walk skips those in the grid). false = no answer: the caller walks.
fn fowHintBox(bi: u32, e: vec3f, rd: vec3f, tmax: f32, invRd: vec3f, axisFast: bool, owner: u32) -> bool {
  var b = boxGeo[bi];
  if ((b.flags & BOX_ROT) != 0u || skipsOwner(boxOwner(b), owner) || fogThinBox(b, bi)) { return false; }   // (… nor one a fog eye passes: FOG.thin)
  let s = scene.grid.x + 0.001;
  if (b.h.x <= s || b.h.z <= s) { return false; }
  b.h = vec3f(b.h.x - s, b.h.y, b.h.z - s);
  return isectBox(e, rd, b, tmax, bi, invRd, axisFast).x >= 0.0;
}
/// does a box the table names for this bearing stand in the pixel's own ray, short of the spot? (fowHintBox: true = the walk would be blocked, for certain)
fn fowHintBlocked(k: u32, e: vec4f, rd: vec3f, tmaxIn: f32) -> bool {
  if (!FOW_WALK_WHOLE) { return false; }
  let invRd = safeInv(rd);
  let tb = isectBounds(e.xyz, invRd, WORLD_MIN, WORLD_MAX);
  if (tb.x > 0.0 || tb.y < 0.0) { return false; }                // an eye outside the traced world: the walk's own business
  let tmax = min(tmaxIn, tb.y);
  let axisFast = (frame.flags & FLAG_AXIS_BOX) != 0u;
  let j = i32(floor((atan2(rd.z, rd.x) / FOW_TAU + 0.5) * f32(FOW_BINS) - 0.5));   // the two bins whose bearings stand either side of this one
  let ha = textureLoad(fowHint, vec2i((j + FOW_BINS) % FOW_BINS, i32(k)), 0).x;
  let hb = textureLoad(fowHint, vec2i((j + 1) % FOW_BINS, i32(k)), 0).x;
  let a = ha & 0xffffu; let b = hb & 0xffffu;
  let reach = u32(tmax * 105.0) + 50u;                           // a box the table's ray met well past the spot is not asked (it would say no: the walk is taken either way)
  if (a != 0u && (ha >> 16u) <= reach) {
    //#C fowCount.y += 1.0;
    if (fowHintBox(a - 1u, e.xyz, rd, tmax, invRd, axisFast, u32(e.w + 0.5))) { return true; }
  }
  if (b != 0u && b != a && (hb >> 16u) <= reach) {
    //#C fowCount.y += 1.0;
    if (fowHintBox(b - 1u, e.xyz, rd, tmax, invRd, axisFast, u32(e.w + 0.5))) { return true; }
  }
  return false;
}
//#SECTION walk — occludedTBoxes (common.wgsl) statement for statement, answering WHICH box: (how far, 1 + its index), or (−1, 0) = clear. Keep the two in step — for the table's worth, not for the answer: a table from a walk that has drifted names worse boxes, and fowHintBox still decides (the counting twin reports any drift as a disagreement).
fn fowWalk(ro: vec3f, rd: vec3f, tmaxIn: f32, skipOwner: u32) -> vec2f {
  let invRd = safeInv(rd);
  let tb = isectBounds(ro, invRd, WORLD_MIN, WORLD_MAX);
  if (tb.x > tb.y || tb.y < 0.0) { return vec2f(-1.0, 0.0); }
  let tmax = min(tmaxIn, tb.y);
  let gskip = (frame.flags & FLAG_GRID_SKIP) != 0u; let ycull = (frame.flags & FLAG_GRID_YCULL) != 0u; let fast = gskip || ycull; let axisFast = (frame.flags & FLAG_AXIS_BOX) != 0u;
  let slabs = (frame.flags & FLAG_GRID_SLABS) != 0u; let shrink = select(0.0, scene.grid.y, slabs);
  let yEnd = ro.y + rd.y * tmax;
  let pEnd = vec3f(ro.x + rd.x * tmax, yEnd, ro.z + rd.z * tmax);
  let sLo = min(ro, pEnd); let sHi = max(ro, pEnd);
  for (var g = 0u; g < scene.numGlobals; g++) {
    if (globalSkipped(g, sLo, sHi, ycull, slabs)) { continue; }
    let bi = scene.globals[g >> 2u][g & 3u];
    //#C fowCount.z += 1.0;
    let r = isectBox(ro, rd, boxGeo[bi], tmax, bi, invRd, axisFast);
    if (r.x >= 0.0) { return vec2f(r.x, f32(bi) + 1.0); }
  }
  var run = 0u;
  let t0 = max(tb.x, 0.0);
  let p = ro + rd * t0;
  var cell = vec2i(clamp(vec2i(floor(p.xz / GRID_CELL)), vec2i(0), vec2i(GRID_W - 1, GRID_H - 1)));
  let stp = vec2i(select(-1, 1, rd.x >= 0.0), select(-1, 1, rd.z >= 0.0));
  let tDelta = vec2f(abs(GRID_CELL * invRd.x), abs(GRID_CELL * invRd.z));
  let nextBoundary = (vec2f(cell) + vec2f(select(0.0, 1.0, rd.x >= 0.0), select(0.0, 1.0, rd.z >= 0.0))) * GRID_CELL;
  var tNext = vec2f(t0) + (nextBoundary - p.xz) * vec2f(invRd.x, invRd.z);
  tNext = select(tNext, vec2f(1e30), vec2<bool>(abs(rd.x) < 1e-20, abs(rd.z) < 1e-20));
  var tCell = t0;
  var tBack = 0.0;
  let slack = scene.grid.x / GRID_CELL;
  for (var iter = 0; iter < 96; iter++) {
    //#C fowCount.w += 1.0;
    let ci = u32(cell.y * GRID_W + cell.x);
    var cw: CellWalk;
    if (fast) { cw = gridCell(ci, ro.y + rd.y * max(tCell - tBack, t0), yEnd, &run, gskip, ycull, shrink); }
    else { cw.start = gridCells[ci]; cw.end = gridCells[ci + 1u]; cw.qlo = 0u; cw.qhi = 255u; }
    var bestInCell = -1.0; var bestBox = 0.0;
    for (var k = cw.start; k < cw.end; k++) {
      let gi = gridItem(k, cw, ycull); if (gi < 0) { continue; }
      let bi = u32(gi);
      let b = boxGeo[bi];
      if (skipsOwner(boxOwner(b), skipOwner)) { continue; }
      //#C fowCount.z += 1.0;
      let r = isectBox(ro, rd, b, tmax, bi, invRd, axisFast);
      if (r.x >= 0.0 && (bestInCell < 0.0 || r.x < bestInCell) && !fogThinBox(b, bi)) { bestInCell = r.x; bestBox = f32(bi) + 1.0; }
    }
    if (bestInCell >= 0.0) { return vec2f(bestInCell, bestBox); }
    if (tNext.x < tNext.y) { tCell = tNext.x; tNext.x += tDelta.x; cell.x += stp.x; tBack = tDelta.x * slack; }
    else { tCell = tNext.y; tNext.y += tDelta.y; cell.y += stp.y; tBack = tDelta.y * slack; }
    if (tCell > tmax || cell.x < 0 || cell.y < 0 || cell.x >= GRID_W || cell.y >= GRID_H) { break; }
  }
  return vec2f(-1.0, 0.0);
}
//#SECTION pre — the table: one thread per (bearing bin, eye), FOW_BINS level rays round each living eye to the world's edge, dispatched in the kernel's own pass ahead of it
@group(1) @binding(7) var fowHintOut: texture_storage_2d<r32uint, write>;
@compute @workgroup_size(64, 1)
fn pre(@builtin(global_invocation_id) gid: vec3u) {
  let k = gid.y;
  if (gid.x >= u32(FOW_BINS) || k >= u32(fow.cfg.x)) { return; }
  //#C fowCount = vec4f(0.0);
  let e = fow.eyes[k];
  var h = 0u;
  if (e.w >= 0.5) {
    let a = (f32(gid.x) + 0.5) / f32(FOW_BINS) * FOW_TAU - 0.5 * FOW_TAU;   // the bin's own bearing (fowHintBlocked's map, the other way)
    fogEyeThin = fogThinOn();   // (FOG.thin: the table names the box a fog eye's ray would meet)
    let r = fowWalk(e.xyz, vec3f(cos(a), 0.0, sin(a)), 1e9, u32(e.w + 0.5));
    if (r.y > 0.5 && r.y < 65535.5) { h = u32(r.y) | (min(u32(r.x * 100.0), 0xffffu) << 16u); }   // (a box past the 16 bits is simply not named: the walk is taken)
  }
  textureStore(fowHintOut, vec2i(gid.xy), vec4u(h, 0u, 0u, 0u));
  //#C textureStore(fowHintOut, vec2i(i32(gid.x), i32(gid.y) + 7), vec4u(u32(fowCount.z) | (u32(fowCount.w) << 16u), 0u, 0u, 0u));   // (the counting table is twice as tall: what each ray cost, under the rows — 7 = the eyes, the arrays' own literal)
}
//#SECTION count — the counting programs only (tools/qa/fog-pass-check.cjs through FogPass.qaRun): per pixel x = walks taken (+ 64 for every disagreement: a hint that
// answered where the walk says clear, or fowWalk against occludedTBoxes) · y = the hints' box tests · z = the walks' box tests · w = the cells the walks crossed
var<private> fowCount: vec4f;
fn fowTally(ro: vec3f, rd: vec3f, tmax: f32, owner: u32) {
  fowCount.x += 1.0;
  let h = fowWalk(ro, rd, tmax, owner);
  if ((h.y > 0.5) != (occludedTBoxes(ro, rd, tmax, owner, -1.0) >= 0.0)) { fowCount.x += 64.0; }
}
