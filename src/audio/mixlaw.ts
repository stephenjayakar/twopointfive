// The mixer's LAW for one positional voice, as plain arithmetic: what a sound's gain, tone and room share become once the propagation has said how muffled it is and how far it
// travelled. One place, read by the mixer (audio.ts play) and by the listening page (src/sounds/main.ts), so the page plays what the game plays. No game code is imported here.

/** the mixer's levels as a fresh page has them: what the engine starts on and what the Options screen's Reset puts back (ui/options.ts) */
export const VOLUME_DEFAULTS = { master: 0.8, sfx: 1.0, music: 0.55, ambience: 0.6 };
/** the positional panners' distance law (inverse) — one place, so the mixer's level estimate matches what the graph does */
export const REF_DIST = 1.6, ROLLOFF = 1.1, MAX_DIST = 80;
/** the occlusion low-pass: 20 kHz clear → ~900 Hz through solid mass */
export const cutoffOf = (muffle: number) => 20000 * Math.pow(0.045, muffle);
/** the gain the graph applies to a voice `muffle` (0 clear ‥ 1 through mass) occluded */
export const occludedGain = (gain: number, muffle: number) => gain * (1 - 0.55 * muffle);
/** its reverb send: more when muffled / routed (you hear the room, not the source) and with distance travelled */
export const sendOf = (muffle: number, pathLen: number) => Math.min(1, 0.25 + 0.5 * muffle + pathLen * 0.02);
/** HRTF where a sound can be heard AS a place — travelled under 12 m, or louder than −26 dB at the ear; the far and faint take the cheap panner */
export const HRTF_NEAR_M = 12, HRTF_LOUD_LEVEL = 0.05;
export const hrtfFor = (pathLen: number, level: number) => pathLen < HRTF_NEAR_M || level > HRTF_LOUD_LEVEL;
/** what the panner's inverse-distance law leaves at `d` metres */
export const distanceGain = (d: number) => REF_DIST / (REF_DIST + ROLLOFF * (Math.max(d, REF_DIST) - REF_DIST));
