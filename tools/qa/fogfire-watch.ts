// A BYSTANDER FOR THE PLAY-THROUGH (PT_FOGFIRE=1): under the fog of war, does a teammate fire at a man the picture does not show?
// Every frame, for every teammate the room fight drives (RoomFight.ops): a round left his gun since the last frame (Op.rounds) at the man he is on (Op.tgt) —
// was that man in the picture (FogOfWar.drawn)? Where he was not, WHY the fog's own rule (fogofwar.ts update) had him unseen, asked of the shooter himself:
//   'not an eye'  the shooter's eyes do not lift the fog (FOG.own, blinded, past the fog's five)
//   'field'       the man is outside the shooter's field (hard's cone about his gaze)
//   'line'        nothing on the gun's line, but the line from his HEAD to the man's chest and head is shut
//   'smoke'       a clear line, lost in a plume by the fog's bar
//   'other'       the shooter's own eye would have him — another rule left him out
// `all` beside `rounds` = every aimed round a teammate's gun filed, so what the count above never sees is a number, not a guess.
// Reads only. Every run's JSON carries `fogfire`. With FOG.squadFire on the unseen count should be next to nothing.
import { FOG } from '../../src/game/fogofwar';

export interface FogFireOut { on: boolean; cone: boolean; own: boolean; /** every aimed (not blind) round a living teammate's gun filed as gunfire, whoever drove him: the ones `rounds` does not count are rounds the rule cannot see either — cover fire at a man behind cover, a drill's own exchange, a teammate on the alert AI */ all: number; rounds: number; unseen: number; undrawn: number; why: Record<string, number>;
  /** spells a man was fired at while out of the picture: who fired, at whom, from when to when (s), rounds */ spells: { by: string; at: string; t0: number; t1: number; rounds: number; why: string }[] }

export class FogFireWatch {
  private last = new WeakMap<object, number>(); private rounds = 0; private unseen = 0; private undrawn = 0; private why: Record<string, number> = {};
  private all = 0; private heard = new WeakSet<object>();
  private open = new Map<string, FogFireOut['spells'][number]>(); private spells: FogFireOut['spells'] = [];
  constructor(private g: any, private say?: (s: string) => void) {}
  private reason(F: any, O: any, h: any): string {
    const g = this.g, c = O.gd.char; const e = (F.eyes as any[]).find(x => x.id === c.id);
    if (!e) return 'not an eye';
    const chest = h.char.bones.chest ?? [h.char.pos[0], h.char.pos[1] + 1.1, h.char.pos[2]];
    if (!F.inField(e, chest)) return 'field';
    const head = h.char.bones.head ?? [h.char.pos[0], h.char.pos[1] + 1.6, h.char.pos[2]];
    if (g.col.segmentBlocked(e.pos, chest) && g.col.segmentBlocked(e.pos, head)) return 'line';
    if (F.recs.get(h)?.smoked) return 'smoke';
    return 'other';
  }
  tick(t: number) {
    const g = this.g, F = g.fogOfWar; if (!F?.active) return;
    { const ids = new Set<number>(); for (const x of g.guards) if (x.team === 'operative' && x.unit) ids.add(x.char.id);
      for (const e of g.events) if (e.kind === 'guardShot' && !e.blind && ids.has(e.who) && !this.heard.has(e)) { this.heard.add(e); this.all++; } }
    for (const O of g.fight?.ops ?? []) {
      const was = this.last.get(O) ?? O.rounds; this.last.set(O, O.rounds);
      const n = O.rounds - was; if (n <= 0 || !O.tgt) continue;
      const h = O.tgt; this.rounds += n;
      if (F.drawn(h)) { if (!F.seen(h)) this.unseen += n; continue; }
      this.unseen += n; this.undrawn += n;
      const why = this.reason(F, O, h); this.why[why] = (this.why[why] ?? 0) + n;
      const key = `${O.gd.callsign}|${h.callsign}`; let S = this.open.get(key);
      if (S && t - S.t1 > 1) { this.open.delete(key); S = undefined; }
      if (!S) { S = { by: O.gd.callsign, at: h.callsign, t0: +t.toFixed(2), t1: t, rounds: 0, why }; this.open.set(key, S); this.spells.push(S); this.say?.(`   fog · ${O.gd.callsign} fires at ${h.callsign}, who is not in the picture (${why}${O.gd.state === 'dead' ? ' · the shooter went down on that frame' : ''}${h.state === 'dead' ? ' · the man went down on that frame' : ''})`); }
      S.t1 = +t.toFixed(2); S.rounds += n;
    }
  }
  out(): FogFireOut { return { on: !!(FOG as any).squadFire, cone: FOG.cone, own: FOG.own, all: this.all, rounds: this.rounds, unseen: this.unseen, undrawn: this.undrawn, why: this.why, spells: this.spells }; }
}
