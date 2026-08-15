// The final blit from the LDR frame into the swapchain: FXAA (compact 3.11-style; mode 1 — the chain WITHOUT the temporal resolve), or a contrast-adaptive
// sharpen (mode 2 — what TAAU ends with: its reconstruction is a touch soft by design and FXAA on top of a temporal resolve would only blur it further), or
// nothing (0); plus film grain — added AFTER either so it is not mistaken for aliasing and smoothed away, nor sharpened into snow. Standalone (no scene prelude).
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(1) var samp: sampler;
struct Params { invSize: vec2f, enabled: f32, grain: f32, seed: f32, sharp: f32, _p1: f32, _p2: f32 };   // enabled: 0 plain · 1 FXAA · 2 sharpen (strength `sharp` 0‥1)
@group(0) @binding(2) var<uniform> params: Params;

struct VOut { @builtin(position) pos: vec4f, @location(0) uv: vec2f };
@vertex fn vs(@builtin(vertex_index) i: u32) -> VOut {
  var o: VOut;
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  o.pos = vec4f(p * 2.0 - 1.0, 0.0, 1.0);
  o.uv = vec2f(p.x, 1.0 - p.y);
  return o;
}

fn luma(c: vec3f) -> f32 { return dot(c, vec3f(0.299, 0.587, 0.114)); }
fn hash13(p: vec3f) -> f32 { var q = fract(p * 0.1031); q += dot(q, q.zyx + 31.32); return fract((q.x + q.y) * q.z); }
// display-space grain, faded out of the highlights where it would only read as noise
fn withGrain(c: vec3f, pix: vec2f) -> vec4f {
  if (params.grain <= 0.0) { return vec4f(c, 1.0); }
  let n = hash13(vec3f(floor(pix), params.seed)) - 0.5;
  return vec4f(c + vec3f(n * params.grain * (1.0 - smoothstep(0.0, 0.8, luma(c)))), 1.0);
}
fn tex(uv: vec2f) -> vec3f { return textureSampleLevel(src, samp, uv, 0.0).rgb; }

// RCAS-style sharpen (after AMD's FidelityFX CAS / FSR 1 RCAS, re-derived): a 5-tap cross; the negative lobe on the four neighbours is chosen per pixel as
// large as it can be WITHOUT pushing the result outside the cross's own min / max (so no ringing halo and no clipping), capped at `sharp` × the filter's
// stability limit; noise-adaptive: where the centre is an outlier against all four neighbours (grain, a lone firefly) the lobe is scaled back.
const RCAS_LIMIT: f32 = 0.1875;   // 0.25 − 1/16: the most the lobe may take before the kernel's DC gain misbehaves
fn rcas(pix: vec2i, sharp: f32) -> vec3f {
  let d = vec2i(textureDimensions(src)) - 1;
  let e = textureLoad(src, pix, 0).rgb;
  let b = textureLoad(src, clamp(pix + vec2i(0, -1), vec2i(0), d), 0).rgb;
  let dd = textureLoad(src, clamp(pix + vec2i(-1, 0), vec2i(0), d), 0).rgb;
  let f = textureLoad(src, clamp(pix + vec2i(1, 0), vec2i(0), d), 0).rgb;
  let h = textureLoad(src, clamp(pix + vec2i(0, 1), vec2i(0), d), 0).rgb;
  let mn = min(min(b, dd), min(f, h)); let mx = max(max(b, dd), max(f, h));
  let hitMin = mn / (4.0 * mx + 1e-4);
  let hitMax = (vec3f(1.0) - mx) / (4.0 * mn - 4.0 - 1e-4);
  let lobe3 = max(-hitMin, hitMax);
  var lobe = max(-RCAS_LIMIT, min(max(lobe3.r, max(lobe3.g, lobe3.b)), 0.0)) * clamp(sharp, 0.0, 1.0);
  // noise attenuation: how far the centre sits outside its neighbours, relative to the local range
  let lB = luma(b); let lD = luma(dd); let lE = luma(e); let lF = luma(f); let lH = luma(h);
  let nz = clamp(abs(0.25 * (lB + lD + lF + lH) - lE) / max(max(max(lB, lD), max(lE, max(lF, lH))) - min(min(lB, lD), min(lE, min(lF, lH))), 1e-4), 0.0, 1.0);
  lobe *= 1.0 - 0.5 * nz;
  return clamp((lobe * (b + dd + f + h) + e) / (4.0 * lobe + 1.0), vec3f(0.0), vec3f(1.0));
}

@fragment fn fs(v: VOut) -> @location(0) vec4f {
  let uv = v.uv;
  let px = params.invSize;
  if (params.enabled > 1.5) { if (params.sharp <= 0.0) { return withGrain(textureLoad(src, vec2i(v.pos.xy), 0).rgb, v.pos.xy); } return withGrain(rcas(vec2i(v.pos.xy), params.sharp), v.pos.xy); }
  let cM = tex(uv);
  if (params.enabled < 0.5) { return withGrain(cM, v.pos.xy); }
  let lM = luma(cM);
  let lN = luma(tex(uv + vec2f(0.0, -px.y)));
  let lS = luma(tex(uv + vec2f(0.0, px.y)));
  let lW = luma(tex(uv + vec2f(-px.x, 0.0)));
  let lE = luma(tex(uv + vec2f(px.x, 0.0)));
  let lMin = min(lM, min(min(lN, lS), min(lW, lE)));
  let lMax = max(lM, max(max(lN, lS), max(lW, lE)));
  let range = lMax - lMin;
  if (range < max(0.0312, lMax * 0.125)) { return withGrain(cM, v.pos.xy); }
  let lNW = luma(tex(uv + vec2f(-px.x, -px.y)));
  let lNE = luma(tex(uv + vec2f(px.x, -px.y)));
  let lSW = luma(tex(uv + vec2f(-px.x, px.y)));
  let lSE = luma(tex(uv + vec2f(px.x, px.y)));
  let edgeH = abs(lNW + lNE - 2.0 * lN) + 2.0 * abs(lW + lE - 2.0 * lM) + abs(lSW + lSE - 2.0 * lS);
  let edgeV = abs(lNW + lSW - 2.0 * lW) + 2.0 * abs(lN + lS - 2.0 * lM) + abs(lNE + lSE - 2.0 * lE);
  let horz = edgeH >= edgeV;
  var stepLen = select(px.x, px.y, horz);
  var l1 = select(lW, lN, horz);
  var l2 = select(lE, lS, horz);
  let g1 = abs(l1 - lM); let g2 = abs(l2 - lM);
  var lEdge: f32;
  if (g1 >= g2) { stepLen = -stepLen; lEdge = (l1 + lM) * 0.5; } else { lEdge = (l2 + lM) * 0.5; }
  let gradScaled = max(g1, g2) * 0.25;
  var uvE = uv;
  if (horz) { uvE.y += stepLen * 0.5; } else { uvE.x += stepLen * 0.5; }
  let along = select(vec2f(0.0, px.y), vec2f(px.x, 0.0), horz);
  var uvN = uvE - along; var uvP = uvE + along;
  var endN = luma(tex(uvN)) - lEdge; var endP = luma(tex(uvP)) - lEdge;
  var doneN = abs(endN) >= gradScaled; var doneP = abs(endP) >= gradScaled;
  var steps = array<f32, 6>(1.5, 2.0, 2.0, 4.0, 8.0, 8.0);
  for (var i = 0; i < 6; i++) {
    if (doneN && doneP) { break; }
    if (!doneN) { uvN -= along * steps[i]; endN = luma(tex(uvN)) - lEdge; doneN = abs(endN) >= gradScaled; }
    if (!doneP) { uvP += along * steps[i]; endP = luma(tex(uvP)) - lEdge; doneP = abs(endP) >= gradScaled; }
  }
  let dN = select(uv.y - uvN.y, uv.x - uvN.x, horz);
  let dP = select(uvP.y - uv.y, uvP.x - uv.x, horz);
  let dMin = min(dN, dP);
  let edgeLen = dN + dP;
  let lMlessEdge = lM < lEdge;
  let goodSpan = select(endP < 0.0, endN < 0.0, dN < dP) != lMlessEdge;
  var pixOffset = select(0.0, 0.5 - dMin / edgeLen, goodSpan);
  // subpixel aliasing
  let lAvg = (2.0 * (lN + lS + lW + lE) + (lNW + lNE + lSW + lSE)) / 12.0;
  let sub = clamp(abs(lAvg - lM) / range, 0.0, 1.0);
  let subOff = (-2.0 * sub + 3.0) * sub * sub * 0.75;
  pixOffset = max(pixOffset, subOff * subOff);
  var uvF = uv;
  if (horz) { uvF.y += pixOffset * stepLen; } else { uvF.x += pixOffset * stepLen; }
  return withGrain(tex(uvF), v.pos.xy);
}
