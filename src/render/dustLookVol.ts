// The volumetric pass's DUST TWIN (look only; shaders/dust_look.wgsl is what it adds, smoke/dustTint.ts decides when it runs). The twin is volumetrics.wgsl's OWN text
// with five statements swapped at their eleven sites — so volumetrics.wgsl stays byte for byte what it is, the pass with no dust alive is the very program it always was (canister smoke, gun
// gas, a stun charge with destruction off: nothing to prove), and an edit to the march reaches both. If one of the statements below is ever rewritten the count check
// fails, the twin is not built, one console error says which — and dust is drawn as plain smoke again (the game is otherwise untouched).
const SWAPS: [from: string, to: string, count: number][] = [
  // the two lit marches' density: the drawn one + whose it is
  ['let dens = fogSmoke(smokeDensityIn(X, onMask), X);', 'let dl = dustDensity(X, onMask, true); let dens = fogSmoke(dl.d, X); let dTint = dustTintOf(dl);', 2],   // (fogSmoke — common.wgsl: the fog of war's full picture draws no plume over floor the team does not see)
  // (the K = 0 march, which no quality row ships: dust stays plain smoke there)
  ['let dens = fogSmoke(smokeDensityAt(X), X);', 'let dens = fogSmoke(smokeDensityAt(X), X); let dTint = vec3f(1.0);', 1],
  // the in-scatter takes the tint
  ['inscatter += T * Lin * sigS * (1.0 - stepT) / max(sigT, 1e-4);', 'inscatter += dTint * (T * Lin * sigS * (1.0 - stepT) / max(sigT, 1e-4));', 3],
  ['inscatter += msGain * sqrt(T) * Lin2 * (sigS / max(sigT, 1e-4)) * (1.0 - sqrt(stepT));', 'inscatter += dTint * (msGain * sqrt(T) * Lin2 * (sigS / max(sigT, 1e-4)) * (1.0 - sqrt(stepT)));', 3],
  // a dust sample's self-shadow reads the drawn density (a plain sample's: as ever)
  ['if (vis) { selfC[c] = smokeSelfShadowIn(X, ev.L, nearMask); }', 'if (vis) { if (dl.dust > 0.0) { selfC[c] = smokeSelfShadowLook(X, ev.L, nearMask); } else { selfC[c] = smokeSelfShadowIn(X, ev.L, nearMask); } }', 2],
];
/** volumetrics.wgsl's text → its dust twin's (to be compiled behind vol_common.wgsl + dust_look.wgsl), or null when the march no longer has the statements */
export function dustLookVol(vol: string): string | null {
  let out = vol;
  for (const [from, to, count] of SWAPS) {
    const parts = out.split(from);
    if (parts.length - 1 !== count) { console.error(`dust look: volumetrics.wgsl has ${parts.length - 1} × "${from}" where the dust twin expects ${count} — dust is drawn as plain smoke`); return null; }
    out = parts.join(to);
  }
  return out;
}
