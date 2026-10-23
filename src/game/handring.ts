// HIS OWN ACTIONS ARE A RING ON ONE KEY (the maintainer, 10-22: "radial menu for our own actions, remove existing menu in top left and awkward scrolling
// thing", "move whistle to our actions and remove v binding", "rework equipment selection and move our actions to E", "i think same would go for our
// actions (1-5 with the ring open)", "we can make our actions and squad actions symmetric, where maybe we have some way of showing in the UI … what the
// default action might be. or maybe that could be in the top left, which might be fine", "do we need a way to cancel all in progress stuff? tab could be
// that for us").
//
// THE RULE. The interaction key's TAP does the default action, as it always did. The key kept down a moment puts his rows up as a ring at the cursor
// (interact.ts: the ring cmdring.ts CMDRING.hands drew as a prototype, now standing without the squad's switch — with this rule on, that prototype's
// own switch and tick change nothing), and the ring is read by the press rule agreed with the squad ring's owner: let go with the cursor out on a wedge
// and that wedge is done; let go in the middle and the ring STAYS with no key held. Standing, a digit 1 to 5 does its wedge at once, a left click does the lit one (and is not his trigger), the key again does the lit
// one, a right click or the back key (Tab) puts it away with nothing done. The held list with its wheel and its cancel row is gone.
//
// THE WHISTLE IS A WEDGE (interact.ts whistleWedge): the LAST wedge, always the same one, wherever fewer rows than wedges are on offer — so on open
// floor the ring is that one wedge. It is no row of the list, so it is never what a tap does (a noise is chosen, never fallen into) and nothing that
// reads the rows meets it. Where the rows fill every wedge, and while a verb runs, there is no whistle: a step away or the verb's end gives it back. The key the whistle had is taken off it by the page's board (host/keymap.ts: its row has no key until the player gives
// it one); the game still answers its old code, so a recording and every check that presses it are as they were.
//
// THE CORNER SHOWS ONE LINE (ui/overlay.ts deriveInteractions): what a tap would do now, and nothing where a tap does nothing. A running verb's own
// row and the squad's block under it are as they were.
//
// THE KEY (host/keymap.ts KEYMAP.handWhen): while this rule is on the whistle's row has no key, and while the empty-hands slot (handslot.ts) is on as
// well the E key gives the interaction's code and the Space key gives the game nothing; the game goes on asking for the code it always asked for
// (consts.ts INTERACT_KEY).
//
// OFF in the module and on the frozen stand (`TPS_HANDRING=1` raises it); ON in the page (`?handring=0`: the list on a held Space, the corner list, the
// whistle on its key, as it was). Registered in knobs.ts; a recording from before the key replays with it off (journal.ts applyKnobs).
export const HANDRING = {
  /** the interaction key held is a ring that stays; the whistle is its last wedge; the corner shows the default action alone */
  on: false,
  /** the key down this long (s) puts the ring up; let go sooner it is the tap. The squad ring's own number for a ring that stays (cmdring.ts) */
  holdSecs: 0.3,
  /** a digit pressed with the key down and the ring not yet up (inside `holdSecs`) puts the ring up at once and is its wedge — never the weapon slot
   *  or the gun's setup, which a quick "key, 2" used to reach. Off in the module and on the frozen stand with `on` (`TPS_HANDRING=1` raises both); a
   *  recording from before the key replays with it off */
  early: false,
  /** a tap of the key with nothing in reach says so in the corner for a moment (interact.ts files `EMPTY_WORD`, ui/overlay.ts shows it): on open floor
   *  the key looked dead. On and off with `on`, as `early` is (the same address word and stand word; a recording from before the key replays with it off) */
  empty: false,
  /** …and beside a thing that gave him no row the word names the thing and why, never 'nothing in reach' (interact.ts `emptyWord`; the maintainer on the
   *  stealth mission, an open door at his elbow: "nothing in reach to close the door?"): a door a tutorial mission has no row for, a door a stride out
   *  of reach. On and off with `on`, as `empty` is (the same address word and stand word; a recording from before the key replays with it off) */
  near: false,
  /** a ring with ONE row draws that row as a pill beside its middle, never as a lone slice of a wheel, and the cursor on that pill is on that row
   *  (ringlone.ts; the maintainer, 10-23: "they look weird when they just have one option"). Both rings' (the squad's ring is the same drawing and
   *  the same pointing: cmdring.ts ringWant). Off in the module and on the frozen stand (`TPS_HANDRING=1` raises it with the rest); on in the page
   *  with its own word, `?lonepill=0` (the slice, and only its own fifth of a turn). A recording from before the key replays with it off */
  lone: false,
  /** HIS RING STANDS ON THE THING IT IS ABOUT, never where the cursor happened to be (the maintainer, 10-23: "radial menu should always be near the
   *  player, probably on the most relevant option (like the rack in this caes)"): its middle on the thing its first row is about (the row lit as it
   *  opens), on his own body where no row is about a thing (the whistle alone), whole inside the view's edge as any ring (cmdring.ts edgeX / edgeY),
   *  and it stays on that point as the view moves (the squad ring's own rule: cmdring.ts ringPin). The cursor may be anywhere when it comes up, so
   *  the cursor ON a wedge's own shape lights it once it has been off every shape (cmdring.ts ringWant `shapes`: a cursor that was resting where a
   *  wedge came up lights nothing until it has left and come back, and a cursor at rest lights nothing); out past the ring, a direction still
   *  counts only from the middle, as before. Digits, a click and the key again are as they were. The squad's ring is not moved: it is opened on
   *  the place the order goes to, which is where the cursor is, and it stays on that place already. Off in the module and on the frozen stand
   *  (`TPS_HANDRING=1`); on in the page, `?ringonthing=0` (at the cursor, as it was). A recording from before the key replays with it off */
  onThing: false,
  /** …and no line of words under it (the maintainer, 10-23, of 'RACK 6 · THE DRIVE · PULL THE DRIVE — STAY ON IT' under the ring: "this is too
   *  busy, should just be the radial menu"): the wedges' own words are the ring's words. What the line said of the lit row is the corner's line
   *  still (ui/overlay.ts: the thing's name and the row's long words, 'stay on it' with them); the whistle's 'one guard will come to look' is said
   *  nowhere now. The picture only. On and off as `onThing` is; `?ringbare=0` puts the line back */
  bare: false,
  /** A ROW GIVEN AT A WALL SWITCH TURNS HIM TO IT (the maintainer, 10-23: "if you do the radial menu, turn around, and then hit the lights, player
   *  doesn't turn back to the light and do the animation"). The lights still go on the press, as they did; then he is stood at the plate and squared
   *  to it the way he is at the mains lever (handwork.ts samWork: his feet planted, the step in to arm's length), and his hand's move at the plate
   *  is given the time the turn takes on top of its own (lightswitch.ts: 0.3 s, and up to `turnMax` more), so the hand arrives after the turn. A
   *  tap's row and a ring's row alike. Every other row at a thing already turned him: a door's leaf (hands.ts), a lock, a pad, a kick, the wand,
   *  the mains, the rack, a charge (handwork.ts), a man or a body (close.ts and the haul). Off in the module and on the frozen stand
   *  (`TPS_HANDRING=1`), and nothing without hands at work (`HANDWORK.on`); on in the page, `?ringturn=0`. A recording from before the key replays
   *  with it off */
  turn: false,
  /** s more than the hand's own time that a turn may add (a half turn at the plant's 10 rad/s is 0.31 s, the step in the rest) */
  turnMax: 0.45,
};
/** the word an empty tap files, how long before it is filed again (s), and how long the corner shows it (s) */
export const EMPTY_WORD = 'nothing in reach', EMPTY_AGAIN_SECS = 3, EMPTY_SHOW_SECS = 1.6;
/** how far off (m) a door still answers an empty tap (its reach is 1.35), and what a thing answers after its name (interact.ts emptyThing): a door
 *  a step off `far`, a door his sprint keeps from him `run`, a thing in reach whose rows the mission's frame kept back (rails.ts `rows`) `held`, a
 *  door in reach while his hands are not his `no` */
export const EMPTY_NEAR_M = 2.2;
/** the sight line to a thing stops this far short of it (m): the thing itself is no wall between him and it */
export const EMPTY_SHY_M = 0.2;
export const EMPTY_WHY = { far: 'step closer', run: 'stop sprinting', held: 'not in this mission', no: 'not now' } as const;
