// HOW A HOSTAGE RESCUE ENDS (RESCUEEND; rescue.ts outcome() asks here while the switch is up). The maintainer, 10-18: "the hostage rescue missions should have
// you safely extract the hostage or fully clear the map."
//
//   WHAT WAS THERE   the room taken and held RESCUE.holdSecs (15 s) was the win: men of theirs alive anywhere else did not matter, and there was nowhere to go.
//   THE RULE         a rescue is WON one of two ways, and by nothing else:
//     OUT       every hostage still alive stands inside `outM` of the WAY OUT — the team's own way in (scenarios.rescue.team.sam: the mark Sam is staged
//               on) — having been led there. A hostage is led by a row on her once nobody of theirs has her (rescue.ts captor() null): Space, 'on your
//               feet — with me': every living hostage gets up and follows whoever said it (civilians.ts hostageLead: the civilians' own legs and the nav
//               grid, a walk that becomes a run when she has fallen behind); the same row then reads 'stay here' and puts them down where they stand.
//     CLEARED   nobody of theirs is left on the floor: every man of the cast down, or run off with his gun dropped (runner.ts), for `clearSecs`.
//               A man in Sam's arm is still a man: put him down first.
//   LOST is as it was: every hostage dead, one hit by the team's own round, the player down.
//   THE ROOM taken is still said and logged ('secured'), and the line that said to hold it says what is asked now; it is let go of ('unsecured') only by
//   one of theirs coming back into it while the hostages are still in it.
//
// Off (the module's default, the frozen stand) = the build as it was: nothing here is asked and the 15 s hold ends the run. On in the page (host/profile.ts
// pageSwitches; ?norescueend) and on the shipped stand; TPS_RESCUEEND=1 raises it on a frozen run. UNTUNED by play.
// Per-player state (habit: 'which player, not the player'): the one who gave the word is kept as a character, never read off Game.player after the press.
import type { Vec3 } from '../math/vec';
import { v3 } from '../math/vec';
import type { Game, Guard, Interactable, Player, Verb } from './game';
import type { Character } from './character';
import type { Rescue } from './rescue';
import { hostageLead } from './civilians';
import { runnerFled } from './runner';

export const RESCUEEND = {
  on: false,
  /** a hostage is out inside this many metres of the way out */
  outM: 3.5,
  /** the beat between the last man of theirs going down and the run's end */
  clearSecs: 1.5,
  /** the row on a hostage: its marker shows inside `markerM`, the word can be given inside `reachM` */
  markerM: 2.4, reachM: 2.2,
  /** a led hostage stops this far behind whoever leads her, the next one this much further back */
  gapM: 1.3, gapStepM: 0.7,
};

type RowFn = (base: Interactable, verb: Verb, text: string, hints?: string, over?: Partial<Interactable>) => Interactable;
type OfferFn = (it: Interactable, verbs: Interactable[]) => void;
const flat = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
/** the player a row is built for and a press is read from (one today: the place a second would be asked for) */
const who = (g: Game): Player => g.player;

export interface RescueEndSnap { lead: number | null; clearAt: number; led: boolean }

export class RescueEnd {
  /** whom the hostages follow (null: they stay down where they are) */
  lead: Character | null = null;
  /** the word has been given at least once since the staging */
  led = false;
  /** the game time nobody of theirs was first found left (NaN: somebody is) */
  clearAt = NaN;
  constructor(private g: Game, private R: Rescue) {}

  /** a fresh staging (rescue.ts stage / clearCast): nobody led, nobody counted */
  reset() { this.lead = null; this.led = false; this.clearAt = NaN; }
  /** the way out: the mark the team was staged on */
  get out(): Vec3 | null { const T = this.R.data?.team; return T ? [T.sam[0], 0, T.sam[2]] : null; }
  /** the men of theirs still to be dealt with: not down, and not run off with the gun dropped */
  left(): Guard[] { return this.R.hostiles.filter(h => h.state !== 'dead' && !runnerFled(h)); }
  private alive(): Guard[] { return this.R.hostages.filter(h => h.state !== 'dead'); }
  /** a word can be given to the hostages: the rule is up, the run is on, and nobody of theirs has them */
  private get free(): boolean { const R = this.R; return RESCUEEND.on && R.active && !R.result && !R.captor(); }

  /** THE ROW on each living hostage in reach (player.ts buildInteractables, beside the other modules' rows): nothing with the switch off */
  rows(p: Vec3, busy: boolean, row: RowFn, offer: OfferFn) {
    const R = this.R; if (!RESCUEEND.on || !R.active || R.result) return;
    const g = this.g, pl = who(g), had = !!R.captor();   // (one of theirs has them: the row is there and dead, and says why)
    for (const h of this.alive()) {
      const hp = h.char.pos, d = flat(p, hp); if (d > RESCUEEND.markerM || g.fogOfWar.hidden(h)) continue;
      const near = d < RESCUEEND.reachM && !g.col.solidBlocked([p[0], 1.0, p[2]], [hp[0], 1.0, hp[2]]), can = near && !pl.sprinting;
      const C = h.civ!;
      const it: Interactable = { kind: 'guard', pos: v3.add(hp, [0, 1.35, 0]), line1: `${C.name} · the ${C.label}`, line2: had ? `one of them has a gun on ${C.her}` : can ? '' : near ? 'stop sprinting' : 'get closer', inReach: can && !had, off: false, guard: h };
      if (had) { offer(it, []); continue; }
      offer(it, can && !busy ? [this.lead ? row(it, 'stay', 'stay here') : row(it, 'lead', 'on your feet — with me')] : []);
    }
  }
  /** the word, for a caller that is not the key (a script, the console): the living hostages follow `by`, or (null) stay where they stand. False = refused */
  word(by: Character | null): boolean {
    if (!this.free) return false;
    const g = this.g, K = RESCUEEND;
    this.alive().forEach((h, i) => hostageLead(g, h, by, K.gapM + i * K.gapStepM));
    this.lead = by; if (by) this.led = true;
    this.R.note(by ? 'lead' : 'stay');
    return true;
  }
  /** once a frame, from rescue.ts tick before its outcome(): this frame's Space on a hostage's row; and at the run's end they stop where they are */
  tick() {
    if (!RESCUEEND.on || !this.R.active) return;
    const g = this.g, act = g.act;
    if (act && act.kind === 'guard' && act.guard && (act.verb === 'lead' || act.verb === 'stay') && this.R.isHostage(act.guard)) this.word(act.verb === 'lead' ? who(g).char : null);
    if (this.lead && this.R.result) { for (const h of this.alive()) hostageLead(g, h, null, 0); this.lead = null; }   // it is over: they stop where they are
  }
  /** has the run been won this frame, and how (rescue.ts outcome(), after its own losses): null = not yet */
  won(): 'out' | 'cleared' | null {
    const g = this.g, K = RESCUEEND, alive = this.alive(); if (!alive.length) return null;
    if (this.left().length) this.clearAt = NaN;
    else { if (isNaN(this.clearAt)) { this.clearAt = g.time; this.R.note('cleared'); } if (g.time - this.clearAt >= K.clearSecs) return 'cleared'; }
    const O = this.out;
    if (O && this.lead && alive.every(h => flat(h.char.pos, O) < K.outM)) return 'out';
    return null;
  }
  /** the objective row once the room is the team's or the hostages are on their feet: where to take them */
  objective(): { text: string; pos: Vec3 | null } {
    if (this.lead) return { text: 'objective ▸ bring them out the way you came in', pos: this.out };
    const p = who(this.g).char.pos, near = this.alive().reduce<Guard | null>((a, b) => !a || flat(b.char.pos, p) < flat(a.char.pos, p) ? b : a, null);
    return { text: 'objective ▸ bring them out, or clear the building', pos: near ? [near.char.pos[0], 0, near.char.pos[2]] : null };
  }

  /** the state a save would hold (habit: new state the game depends on has its pair beside it; no checkpoint is reachable while a rescue is staged —
   *  savestate.ts refuses both ways — so nothing calls these but the check) */
  snapshot(): RescueEndSnap { return { lead: this.lead ? this.lead.id : null, clearAt: this.clearAt, led: this.led }; }
  restore(s: RescueEndSnap) {
    const g = this.g, K = RESCUEEND, pl = who(g);
    const by = s.lead === null ? null : pl.char.id === s.lead ? pl.char : g.guards.find(x => x.char.id === s.lead)?.char ?? null;
    this.alive().forEach((h, i) => hostageLead(g, h, by, K.gapM + i * K.gapStepM));
    this.lead = by; this.led = s.led; this.clearAt = s.clearAt;
  }
}
/** player.ts buildInteractables: the hostages' rows (nothing unless a rescue is up with the rule on) */
export function rescueEndRows(g: Game, p: Vec3, busy: boolean, row: RowFn, offer: OfferFn) { if (RESCUEEND.on && g.rescue?.active) g.rescue.ending.rows(p, busy, row, offer); }
