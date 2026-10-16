// LOOK ONLY — whether destruction dust is drawn as dust. What is dust, and in what colour, rides with the smoke PER CELL (SmokeEmitter.tint → smoke.ts emit → smoke.wgsl's K word →
// the atlas texel's .yzw → render/shaders/dust_look.wgsl, in the view march's dust twin only). Nothing the solver, the scene's shadow rays or the light probe's sight lines read
// comes from here, and with no tinted puff in the air the renderer runs its plain program (the engine takes the twin only while some brick holds dust: SmokeBinding.dusty).

/** A/B only (no panel row; `?nodustlook` on the page's URL, read once): false = no tint kept, no twin compiled, = the picture as it was */
export const DUST_DRAW = { on: typeof location !== 'undefined' && !/[?&]nodustlook\b/.test(location.search) };   // (the page only: the retired native app, which has no twin, gets neither half)
