// THE PLAYER CARRIES AND SETS CHARGES LIKE THE SQUAD (the maintainer, 10-12, on the Team & kit screen: "weird that i can't use wall charges or door charges
// myself, should be symmetric").
//
// ONE SWITCH, `OWNCHARGE.on` — ON in the page (host/profile.ts pageSwitches; `?noowncharge` = as it was), OFF here and on the frozen harness stand
// (`TPS_OWNCHARGE=1`; a FROZEN_HOLDS row, in the knob registry and a journal's tables: a recording from before the table replays with it off). What hangs on it:
//
//   · THE CARD (kit.ts): YOUR kit card has a 'Door charges' row and a 'Wall charges' row at the teammates' own pouch prices (slots.json: one a door charge,
//     two a wall charge). What you carry goes into THE SQUAD'S COUNTS — the one bag the door tools and the wall charge spend, whoever's hands set one
//     (kit.ts kitPool / kitWalls). Alone (no teammate on the floor) the counts are your card's and nothing else: the two door charges a man alone was handed
//     whatever his card said are gone with the switch on (off = as it was).
//   · A DOOR CHARGE BY HAND (doortools.ts samRows / samTick): a row of a shut door, 'set a charge · N left', while the count has one — the squad's own
//     setSecs with both hands on it by the lock, a step / Space / Esc / the trigger breaks it off with nothing spent; F blows it (the door tools' trigger,
//     which was always any set charge's). The blast is DoorTools.blow, the one a teammate's charge goes through: nothing of it asks who set it.
//     State: `Player.charging` (not saved: savestate.ts playerBusy refuses a plain save while it runs, as for the wall's).
//   · THE SQUAD ON YOUR CHARGE (doortools.ts): the door tools' charge row on a door that carries a charge nobody of theirs is working, from the charge's
//     own face, reads 'stand off · in behind the charge' — the charge order from its stand-off stage (no second charge, nobody at the lock) — and F then
//     sends them in behind it as behind their own. Who is inside the blast is named on your row and on the trigger's line ('· too close: you, Red One').
//
// A wall charge by hand was already the wall charge's own (wallcharge.ts samRows): with the switch on it is paid from what the cards — yours among them —
// carry. No dice, no camera, nothing read off the renderer.
export const OWNCHARGE = {
  /** the switch (above). false = your card has no charge rows, no door offers 'set a charge', a man alone has the door tools' own bag */
  on: false,
};
