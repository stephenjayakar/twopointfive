// THE SQUAD REACHES YOU, AND THE QUICK KEY SAYS WHY. Four rules, a switch each, all on in the page and off here and on the frozen stand:
//   SQUADNET.on     A TEAMMATE'S LINE SAID WHERE YOU CANNOT SEE IT STILL REACHES YOU. A bubble was drawn only over a head on the screen: with the squad two
//                   rooms off, 'stacked up.', 'can't get there.' and a room called clear were said to nobody. With the rule the line is drawn NEAR YOU, on
//                   the side he is on, with his name and an arrow his way (ui/bubbles.ts), and the net clicks in your ear as it arrives. A TEAMMATE GOING DOWN
//                   is a row of its own ('<name> is down.', drawn the same way from where he fell) with a sound of its own: the net's click, pitched down.
//                   Nothing here writes a man's bubble: his line is the line he said, and only where it is drawn changes.
//   SQUADNET.why    THE QUICK KEY SAYS WHY WHEN ITS PICK IS NOT THE PLAIN ONE (autopilot.ts picks the entry on a door the men wait on). The pick was shown and
//                   answered ('bang and clear · 2 left', 'bang and clear.'); the reason it held was shown nowhere. With the rule the quick key's row ends on
//                   the reason and the man who answers says it: an enemy the team can see inside, a room nobody has been in, the last stun kept back for a
//                   room they know is held, a door they know is shut. A plain open says nothing more. No press waits on any of it.
//   SQUADNET.clear  'CLEAR' MEANS CLEAR. A room was called clear when no enemy stood in it, with floor the search never saw. With the rule the call is made
//                   only when the search ended by its own bar (DOORTOOLS.deadCells: less floor unseen than sends a man on); with a search cut short and
//                   nobody in sight there, the lead says the room is quiet and that they did not see all of it. An entry onto open floor has no search
//                   and is called as it was.
//   SQUADNET.endCall  EVERY ENTRY ENDS WITH A CALL. The lead called only a room the mission has a name for (the room clear's own rooms): an entry into any
//                   other room (the office's conference room, a hall, every room of a mission with no room list) ended with nobody saying anything. With
//                   the rule the lead calls those too, by the same rule and of the room fight's own flood: 'room clear.', 'room's quiet. we didn't see
//                   all of it.', and of open floor, which nobody searches, 'clear so far.' while no enemy on it is in the team's sight. A lead who
//                   ends outside every room of the mission's calls the named room the entry's own points are in. Sam's own squad only: the response
//                   team runs the same door orders and says none of it.
// WHAT IT COSTS: the first is the page's alone (where a line is drawn, a click): no man's state, no die, no digest. The second and third change WORDS a man
// says, so the length of his bubble, which bark clocks read: a run with either on is not the run with it off by digest once such a line is said. The
// fourth adds a line where there was none: the same.
// SWITCHES: ?squadnet=0 · ?qwhy=0 · ?honestclear=0 · ?endcall=0 on the address; the frozen stand holds all four off (TPS_SQUADNET=1 · TPS_QWHY=1 ·
// TPS_HONESTCLEAR=1 · TPS_ENDCALL=1 raise them). A recording from before a key replays with it off (journal.ts applyKnobs).
// STATE: one SquadNet on the Game (rows, the men already called down, what is owed the ear this frame): in the rollback snapshot with everything else the
// Game reaches. THIS FILE ONLY READS THE GAME, as cues.ts does.
// CHECK: bun run tools/qa/squadnet-check.ts (probes.ts squadnet), both stands; SQUADNET_BREAK=1 must fail.
import type { Vec3 } from '../math/vec';
import type { Game, Guard } from './game';
import type { AutoPick } from './autopilot';
import type { Door } from './doors';
import { doorCells } from './guards';   // (asked inside a call only)

export const SQUADNET = {
  /** a teammate's line said off your screen is drawn near you, the net clicks, and a teammate going down is called */
  on: false,
  /** the quick key's row and the man who answers it say why the pick is not a plain open */
  why: false,
  /** a room is called clear only when its search was not cut short */
  clear: false,
  /** an entry into a room the mission has no name for ends with the lead's call too */
  endCall: false,
  /** how far from you a line from off the screen is drawn, as a share of the view's shorter side */
  near: 0.24,
  /** the click a line from off the screen arrives with (gain; 0 = silent), pitched up off the defenders' net's own squelch (cues.ts plays the same voice at rate 1) */
  click: 0.3, clickRate: 1.3,
  /** a teammate down: the same click, louder and pitched down (gain; rate) */
  downGain: 0.7, downRate: 0.55,
  /** seconds a 'down' row stands */
  downSecs: 5,
};

/** a row of the squad's net that no living man's bubble carries (a man down): where it came from, and until when */
export interface NetRow { text: string; at: Vec3; t: number; dur: number }
const newStats = () => ({ lines: 0, downs: 0, whys: 0, quiets: 0, clears: 0, ends: 0 });

export class SquadNet {
  rows: NetRow[] = [];
  stats = newStats();
  private down: string[] = []; private seeded = false; private clickDue = false; private downDue = false; private lastT = -1;
  constructor(private g: Game) { }
  reset() { this.rows = []; this.down = []; this.seeded = false; this.clickDue = this.downDue = false; this.stats = newStats(); }

  /** a teammate said a line with his head off your screen (guards.ts say asks, with the switch on): the net clicks */
  line() { this.stats.lines++; this.clickDue = true; }

  /** once a frame, after everybody has moved: who went down this frame, rows that have had their time, and the one sound owed */
  tick() {
    const g = this.g, K = SQUADNET, t = g.time;
    if (t < this.lastT) this.reset(); this.lastT = t;
    const squad = g.orders.squad();
    if (this.down.length) this.down = this.down.filter(c => squad.some(gd => gd.callsign === c && gd.state === 'dead'));   // (a roster stood up again under the same names: its men have not been called)
    for (const gd of squad) {
      if (gd.state !== 'dead' || this.down.includes(gd.callsign)) continue;
      this.down.push(gd.callsign);
      if (!K.on || !this.seeded) continue;   // (down before the run was watched: a checkpoint's dead are not called again)
      const p = gd.char.pos; this.rows.push({ text: `${gd.callsign} is down.`, at: [p[0], p[1], p[2]], t, dur: K.downSecs }); this.stats.downs++; this.downDue = true;
    }
    this.seeded = true;
    if (this.rows.length && t - this.rows[0].t > this.rows[0].dur) this.rows = this.rows.filter(r => t - r.t <= r.dur);
    if (this.downDue) { if (K.downGain > 0) g.audio.play('radio', null, K.downGain, { rate: K.downRate }); }
    else if (this.clickDue && K.click > 0) g.audio.play('radio', null, K.click, { rate: K.clickRate });
    this.clickDue = this.downDue = false;
  }
}

/** what a quick-key pick that is not a plain open adds: the end of the quick key's row, and the line the man who answers says in place of the row's own
 *  (null: the plain thing, the switch off, or nothing a door's entry) */
export function whyWords(P: AutoPick): { row: string; ack: string } | null {
  if (!SQUADNET.why || P.word || P.t.kind !== 'door') return null;
  if (P.id === 'bangClear' && P.why === 'contact') return { row: 'they see one inside', ack: 'banging it. i see one in there.' };
  if (P.id === 'bangClear' && P.why === 'unknown') return { row: "nobody's been in there", ack: "banging it. nobody's been in there." };
  if (P.id === 'charge' && P.why === 'shut') return { row: "they can't open it", ack: "we can't open it. setting a charge." };
  if (P.id === 'openClear' && P.kept) return { row: "they're saving the last bang", ack: "going in. i'm saving the last bang." };
  return null;
}

/** the call a lead makes when an entry is over (doortools.ts): `left` = floor of the room its search was cut short of (0 where it ended by its own bar, and
 *  where the entry had no search of its own: open floor), `inside` = a living enemy stands in the room, `seen` = one of them the team has in sight. Null:
 *  nothing is said. */
export function roomCall(g: Game, name: string, left: number, inside: boolean, seen: boolean): string | null {
  if (!SQUADNET.clear) return inside ? null : `${name} clear.`;
  const S = g.squadNet.stats;
  if (!inside && left <= 0) { S.clears++; return `${name} clear.`; }
  if (left > 0 && !seen) { S.quiets++; return `${name}${/[^s]s$/.test(name) ? ' are' : "'s"} quiet. we didn't see all of it.`; }   // ('bunks are quiet', 'server room's quiet')
  return null;
}

/** the call at the end of an entry into a room the mission has no name for (doortools.ts): `open` = open floor (a hall, a yard: nobody searches it), the
 *  rest as roomCall's, counted of the room fight's own flood. Null: nothing is said — and with the switch off nothing ever is, as it was. */
export function plainCall(g: Game, open: boolean, left: number, inside: boolean, seen: boolean): string | null {
  if (!SQUADNET.endCall) return null;
  const call = open ? (seen ? null : 'clear so far.') : roomCall(g, 'room', left, inside, seen);   // (open floor: what they can see of it, and they say so)
  if (call) g.squadNet.stats.ends++;
  return call;
}

/** does a man at p stand in that room of the room fight's (its flood of nav cells) — a doorway of the room's own counted: a man in its far door is in it */
export function inFlood(g: Game, R: { cells: Set<number>; entries: { door: Door }[] }, p: Vec3): boolean {
  const nav = g.col.nav, c = nav.idx(Math.floor(p[0] / nav.cell), Math.floor(p[2] / nav.cell)); if (R.cells.has(c)) return true;
  const d = doorCells(g).get(c); return !!d && R.entries.some(e => e.door === d);
}
