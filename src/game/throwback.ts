// A CAN IN THE WIND-UP GOES BACK ON THE BELT WHEN HIS HANDS START SOMETHING ELSE.
//
// A throw is counted off the belt at the click and leaves the hand THROW_RELEASE into the wind-up (player.ts doThrow, `Player.pendingThrow`). That
// countdown runs in the open part of his update, after the early returns for a kick, a pick, the wand, hands at work and the keypad. So a can clicked
// and then one of those rows taken inside the wind-up froze in his fist for the whole beat and left it afterwards, from wherever he then stood, on the
// arc solved at the click: a stun or a frag at his own feet, or through the door he had just worked, seconds late. A grab already gave the can back
// (startGrab); the lunge of a takedown dropped the wind-up and kept the can it had counted.
//
// THE RULE: any of those beats beginning with a can in the wind-up puts the can back on the belt and ends the wind-up (player.ts, ahead of the early
// returns; the takedown's start). Nothing is thrown. He throws again when his hands are his own.
//
// OFF in the module and on the frozen stand (`TPS_THROWBACK=1` raises it): the can freezes and leaves late, as every older run has it. ON in the page
// (`?throwback=0`). Registered in knobs.ts; a recording from before the key replays with it off (journal.ts applyKnobs).
export const THROWBACK = {
  /** a kick, a pick, the wand, hands at work, the keypad or a takedown beginning inside a throw's wind-up gives the can back instead of holding it */
  on: false,
};
