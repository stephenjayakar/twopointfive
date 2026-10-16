// THE ONE SWITCH for the destruction goal (walls and cover coming apart, and the chaos that comes with it on the loud levels). Off = the one build (e6188f6) by digest.
// OFF in this module, so everything headless (every older probe, frozen digest and level load) stands as it was; the PAGE turns it on at boot before the level loads
// (src/main.ts: on unless the URL carries ?nodestruction), tools/qa/playthrough.ts turns it on under PT_DESTR=1 (off otherwise, so every tally and frozen digest made before the goal still measures what it measured), and the destruction probes raise it themselves.
// No game import here: src/game is one import cycle.
export const DESTRUCTION = { on: false };
/** FURNITURE UNDER A BLAST (game/furnblast.ts): its own knob for the A/B — charges throw and break the furniture round them. Inert while the switch above is off;
 *  the page drops it with ?nofurnblast, tools/qa/playthrough.ts with PT_FURN=0. */
export const FURNBLAST = { on: true };
/** KICKED RUBBLE (game/debris.ts Debris.feet, called from destruction.ts update): men on their feet shove the broken pieces lying in their way aside, and a piece that
 *  came to rest in a man is pushed off him. OFF here, so everything headless stands as it was (the pass is not called: no hash drawn, no piece touched); the PAGE turns
 *  it on at boot unless the URL carries ?nokickrubble (host/profile.ts pageSwitches), tools/qa/playthrough.ts under PT_KICK=1. A boot's shove is silent to the AI (no
 *  hearing event), pushes no furniture and breaks nothing. The numbers: `radius` a man's (m), `reach` a boot's past it, `inside` how far a piece must lie INTO him to
 *  be pushed off a man standing still, `floor` how far over his own floor a piece's underside may lie and still be at his feet (one on a desk top is not), `heavy`
 *  the mass (kg) past which a boot shifts nothing (a cabinet on its side: he walks through it as before), `walk` the pace (m/s) under which he steps over things;
 *  `lead` how far ahead of his middle (s of his own pace) his leading foot meets things; a kick's speed = (base + gain × his pace) ÷ (1 + mass/4), ≤ vMax, `aside`
 *  of it across his line; `off` the push off a man (m/s); `slide` the floor's friction under a shoved piece (it stops in v² ÷ 2·slide·g);
 *  `spin` the turn a boot on one end gives; `perFrame` shoves a frame, `cooldown` s per piece, a piece shoved `giveUp` times running let be for `giveUpSecs`;
 *  `scuff` the gain of the sound it makes for the ear alone (0 = none). */
export const RUBBLE = { on: false, radius: 0.3, reach: 0.12, lead: 0.12, inside: 0.06, floor: 0.12, heavy: 12, walk: 0.35, base: 0.6, gain: 0.8, aside: 1.2, vMax: 2.2, off: 1.0, slide: 0.3, spin: 2.2, perFrame: 4, cooldown: 0.3, giveUp: 8, giveUpSecs: 3, scuff: 0.12 };
/** the editor group of the boxes a level file carries only as things to wreck (tools/levels/dress.ts appends them LAST; scene/levelLoad.ts leaves them out with the switch off,
 *  so every other box keeps its index and the level is the one build's) */
export const DRESS_GROUP = 'dressing';

/** THE EVICTION POP'S FIX (game/breakTable.ts pick + dissolve; only under the cut pieces switch, scene/cut.ts): a spawn over the pool's cap takes the SMALLEST
 *  resting piece's slot, not the oldest, and that piece goes as chips by its size born along its own shape, with its row's dust once — not a fixed ball of chips at
 *  its middle. OFF here (headless stands as it was: the oldest piece, the old ball); the PAGE raises it at boot unless the URL carries ?nopopfix (host/profile.ts
 *  pageSwitches), tools/qa/playthrough.ts under PT_POP=1. The sizes it deals by are BREAKS.sizedChips / sizedSpan. */
export const EVICT = { on: false };

/** THE BLAST FRAME'S PACE (the frame a wall goes on was one long game step: tools/qa/blast-frame.ts). Work on that frame that nothing in play reads is done ahead of
 *  it or handed to the frames after it — play's own state lands on the frame it always did (digests equal either way):
 *  the lights' reach masks (game.ts reachChanged — the picture's alone): a wall's change is noted and the wall raster built `reachHold` frames later, the masks from the
 *  frame after that; the rain's drip lines (rainFx.ts — drawn drops' alone): found again `dripSamples` edge samples a frame once the statics have stood still `dripHold` frames
 *  (a wall's pieces are new statics for some frames after it goes), the old lines dripping meanwhile, and found at all only once a frame somebody could see them or in those same shares; the furniture index (furnblast.ts — made on
 *  the first blast from the level as authored): made when a wall charge is set. ON everywhere; the page's ?blastpace=old and TPS_BLASTPACE=old in front of a headless
 *  tool = all of it on the blast frame, as it was. Under REACH_PACE.whole (?reachpace=old) the masks keep that pace's frame too. */
export const BLAST_PACE = { on: true, reachHold: 1, dripSamples: 16, dripHold: 8 };
