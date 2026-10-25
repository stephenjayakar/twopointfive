// THE FOG OF WAR'S SIGHT TABLE (render/fogofwar.ts FogSight; game/fogofwar.ts rule 4g) — one tiny pass at the head of the frame, only while the full-picture fog is
// on. For each of the team's eyes and each of FOG_SIGHT_BINS bearings round it: how far that eye's level ray, at its own height, goes before it meets a box —
// the fog pass's own eye ray (occludedTBoxes with the eye's man's kit skipped), walked to the world's edge. What stands between an eye and a spot depends on the
// bearing alone, so every pass of the picture can then ask "does the team see this spot" of ANY point in the world for two reads an eye (common.wgsl
// fogSeenAt) — which is what lets a light be cut where nobody sees (LIGHT_FOG_SEEN) at the place it is evaluated, in every pass, instead of the fog pass
// painting over the frame afterwards. The table's head (the eyes, their looks, the count and the cone's soft edges) is written by the CPU with this pass's own
// block: the table is one self-contained answer, whole each frame.
// (Bound with the scene group whose binding 11 is the stand-in: this pass writes, as storage, the buffer every other pass reads there as a uniform.)
struct SightU {
  eyes: array<vec4f, 7>,    // FowU's head (shaders/fogofwar.wgsl), field for field
  looks: array<vec4f, 7>,
  cfg: vec4f,               // x = eyes
  soft: vec4f,              // xyz = FowU's · w is NOT FowU's (its own light): here the table's own three bits (4 = FOG.kept, not read here) (common.wgsl FogSightT.soft): 1 = smoke is drawn under the fog too, 2 = thin things that stand free do not stop an eye
};
@group(1) @binding(0) var<uniform> sight: SightU;
@group(1) @binding(1) var<storage, read_write> sightOut: array<f32>;   // FogSightT.dist, a float a bin

@compute @workgroup_size(64, 1)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let x = gid.x; let k = gid.y;
  if (x >= u32(FOG_SIGHT_BINS) || k >= 7u) { return; }
  var t = 0.0;
  if (k < u32(sight.cfg.x) && sight.eyes[k].w >= 0.5) {
    fogEyeThin = (u32(sight.soft.w + 0.5) & 2u) != 0u;   // (FOG.thin: every ray below is a fog eye's. Read off this pass's own block — the table it writes is not bound here; the marked boxes' bits are, in the stand-in: common.wgsl fogThinBox)
    let e = sight.eyes[k];
    let a = (f32(x) + 0.5) / f32(FOG_SIGHT_BINS) * 6.283185307179586 - 3.141592653589793;   // the bin's own bearing (fogEyeSay's map, the other way)
    let rd = vec3f(cos(a), 0.0, sin(a));
    t = occludedTBoxes(e.xyz, rd, 1e9, u32(e.w + 0.5), -1.0);
    // THE NEAREST box, not the first cell's: the walk answers with the nearest of the boxes registered in the first cell that has a hit, and a long wall
    // registered there but met far along wins over a pillar a cell further on. So the ray is asked again short of each answer until nothing stands nearer.
    for (var again = 0; again < 8 && t > 0.002; again++) { let nearer = occludedTBoxes(e.xyz, rd, t - 0.001, u32(e.w + 0.5), -1.0); if (nearer < 0.0) { break; } t = nearer; }
    t = select(t, 1e9, t < 0.0);
  }
  sightOut[k * u32(FOG_SIGHT_BINS) + x] = t;
}
