// THE G QUICK THROW IS GONE FROM THE PAGE (the maintainer, 10-10: "we can also probably remove the quick throw behavior, seems confusing").
//
// G held used to arc 'the can chosen last' from whatever was in his hands and throw it on release, slinging the rifle on the way: a second way to throw, on a key
// that remembered something the HUD had to label. A can is now thrown one way: its slot (3 smoke · 4 stun · 5 frag) and a click.
//   · the page and the shipped stand play with `on` false: G is a dead key for Sam (the order menu's own G row — frag.ts FRAG.orderKey — is the menu's and stays);
//   · the harness's FROZEN stand keeps it (host/standup.ts; TPS_QUICKTHROW=0 takes it away there): its probes (frag, restart, the journal's self-test) and a recorded session press G — the soak never did —,
//     and a recording made before this table existed replays with it on (journal.ts);
//   · ?quickthrow brings it back on the page for a visit.
// No state of its own: Player.throwHeld / heldKind / throwEaten are as they were and simply never set while it is off.
export const QUICKTHROW = { on: false };
