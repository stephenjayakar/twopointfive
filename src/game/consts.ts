// Small shared constants for the game layer (kept out of game.ts so the split-out modules can import them without a value cycle).
export const PLAYER_ID = 1;                 // character id of the player (guards are 10 + index); also the owner byte on everything the player carries
/** the `who` of a noise NOBODY living made (a ceiling tile let go on its own, a chunk a vent shook loose): the men take it as unexplained — hearingCheck's 'by a
 *  guard' is who ≥ 10 — but the debrief does not put it on Sam (chronicle.ts chronHeard writes 'heard' rows for PLAYER_ID and the dropped-gun 0 only) */
export const NOBODY_ID = 2;
export const DRIVE_REACH = 1.1, DRIVE_SECS = 3.5;   // hands on the rack: within this of its face (planar), for this long
/** The one interact key (Chaos Theory: Space). Tap = the highlighted interaction, hold = its HOLD variant (crack a door, pick a lock, pull the drive). */
export const INTERACT_KEY = 'Space';
