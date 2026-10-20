// A RESTART GIVES A CLEAN LEVEL — the one switch `CLEANRESTART.on` over what Game.restartEncounter left standing from the try that ended.
//
// A restart already made fresh men, hung the doors, mended the glass and the walls and took the marks off them. What it did not do, and what a player saw:
//   · THE LIGHTS CAME BACK ON IN FRONT OF HIM. Mains that were out (the breaker thrown, shot, or tripped by the OCP) were put back through the same call as a
//     hand on the breaker: 'mains restored' said and sounded, every fitting on the supply playing its restrike flicker for a second and more, each contactor
//     group a beat after the last, the beacons turning for another second. That is what power coming back looks like; a restart is not power coming back.
//     With the switch up the level's lights stand as a level just opened has them from the restart's own tick (lighting.ts freshLights).
//   · The last try's lines were still on the screen (and the restart wrote two of its own, 'guards reset' and 'encounter restarted': a level just opened says
//     neither), and its clocks still ran: the alarm's last raise (the roll call waits on it), the floor's fight (gunwall.ts keeps guns up through it), the torch
//     on him, the music's last sting, the pace his fresh body was 'moving' at (the jump back to the start read as a sprint), a vent a blast had stopped.
//   · The first tick read the lights as the last try's last frame painted them (the reticle's 'off' rows, the men's eyes): they are painted as the restart ends.
//   · The camera flew from where he fell to where he starts, with the new try already running under it. It cuts now, as it does when a mission is staged
//     (the seat's cut, cmd.ts takeCut) — unless a show, a spectator or a pin has the camera.
//   · THE PICTURE kept its histories: the screen's accumulated light, the reservoirs and the radiance cache still held the rooms as the last try left them lit
//     (or dark), and blended to the fresh level over the frames after. `picture`: the host is told the level restarted (HostApi.restartPicture) and starts those
//     from nothing, as on the first frame of a boot. Picture only; a host without the call (the harness's stand-in) is told nothing.
//
// TWO LAYERS (game.ts). Game.restartEncounter — every caller: the keys and cards, a mission's staging, a show's restore, a checkpoint's load, a recording's
// first frame — does the first three with the switch up. Game.restart — THE PLAYER'S restart: the pause and down cards' buttons, the panel's, Shift+Enter, Enter
// when down — is restartEncounter and then the last two. So a checkpoint's load (it resets the encounter under itself and lays the file over it: the file's own
// mains, clocks and lines), a recording's first frame and a tape's restart row keep their own camera and picture.
// Not touched: the panel's 'repair' button (lighting.ts repairLights, as it was), and the kit picture's own window (`?kitview` restages on every kit message
// under its own dissolve: the switch is off there, host/profile.ts).
//
// ONE switch: ON in the page (`?cleanrestart=0` = as it was), OFF in the module and on the frozen harness stand (`TPS_CLEANRESTART=1`); a FROZEN_HOLDS row, in the
// knob registry and a journal's tables (a recording from before the table replays its restarts as they were). Off = the restart as it was, by run digest.
// tools/qa/cleanrestart-check.ts holds it. Nothing here has been seen on a GPU.
export const CLEANRESTART = {
  /** the switch */
  on: false,
  /** the host starts the picture's histories from nothing on a restart (false = the game side only) */
  picture: true,
};
/** QA: restarts taken clean, of them with the mains out or a fitting broken or knocked out, lines taken off the screen, camera cuts, pictures restarted */
export const CLEANRESTART_STATS = { restarts: 0, relit: 0, lines: 0, cuts: 0, pictures: 0 };
