// THE SNATCH: one unarmed man the team has to take ALIVE — an overlay on a level's ROOM CLEAR, switched on by the block `scenarios.snatch` in the level file
// (scene/scenarios.ts SnatchData; levels/snatch.json is the level built for it). A level without the block returns on the first line of every entry point:
// the game as it was.
//
//   WHO HE IS      a civilian of the usual make (civilians.ts spawnTarget: on Game.civilians, so his eyes and ears, his run, the door he pushes, the round that
//                  finds him and Sam's own grab are the civilians' — nothing of that is forked here). He is put on the floor at every staging of the room clear.
//   QUIET          he keeps to his marks. Gunfire or a charge in his ears (civilians.ts hear) frightens him as it does anybody, and he runs for the nearest of
//                  the block's WAYS OUT by walking (civSpots hands the civilians' own flee those). A teammate or Sam he SEES frightens him the same.
//   WHAT HE SEES  one model with everybody else's eyes: a man of the team is SEEN by him only through the civilians' own eye (civilians.ts civilianSees: its
//                  cone and range, the guards' sight gain on the light that falls on that man, over `seeRate`). A man in the dark on his way out is not
//                  seen: he runs into him. What the TEAM has of him (the challenge, the tie, 'nobody on him') is a plain line to him inside `seeM`.
//   HE GIVES UP    (hands on his head, where he stands — the civilians' complied cower, with no end to it) to a teammate or Sam within `giveUpM` with a line
//                  to him, from any side; and, running, to one who stands BETWEEN him and the way out he is running at within `haltM` (ships equal to
//                  `giveUpM`: he stops only for a man he all but runs into; raise it for a tamer man — at 9 m the covered play won 24 of 24). One who is
//                  between him and it but farther than that only TURNS him: that way out is struck off and he runs for another, or goes to ground.
//   IN HAND        hands up with one of the team within `cuffM` and a line for `cuffSecs` = TIED (the wrists-behind pose; for good). Hands up and nobody in
//                  sight for `boltSecs` = he bolts again. In Sam's arm, or put out cold by Sam's hands, is in hand too.
//   THE END        WON = every defender down (the room clear's own 'taken') with him alive and in hand. LOST = he reached a way out, or a round killed him
//                  (anybody's: `killer` says whose, for the tally). The loss fails the mission the way a civilian's death can (the down card); the room
//                  clear's own 'wiped' is Sam's, as ever.
//
// Seams: game.ts (the field; `tick` right after updateMission), mission.ts objectiveText / objectivePos (his line stands over the room clear's while he is
// loose), savestate.ts (the slice — a checkpoint is refused with a squad on the floor, so today nothing reaches it), knobs.ts, civilians.ts (civSpots, the
// tied pose, civilianSees, no 'control will ring' call and no knockout row for him), combat.ts (whose round found him), roomclear.ts (its 'structure
// taken' line says he is still loose). The enemies' decision code is not touched: the defenders do not know he
// exists, and no teammate holds his fire for him — a round through him is the team's to avoid by where it stands.
// The team = Sam and every living operative unit; with a second player it is each player's character, asked the same way (teamOf below is the one place).
import type { Game } from './game';
import type { Guard } from './game';
import type { Character } from './character';
import type { SnatchData } from '../scene/scenarios';
import { v3, type Vec3 } from '../math/vec';
import { spawnTarget, civilianYield, civilianBolt, civilianTie, civilianSees, toAlarmed } from './civilians';
import { DOWN_CARD_SECS } from './mission';
import { SNATCH_LINES, snatchLines } from './dialogue';
import { SnatchOut, type SnatchOutSnap } from './snatchout';

export const SNATCH = {
  on: true,
  /** he gives up to one of the team this near with a line to him, whichever way he is going */
  giveUpM: 3.5,
  /** running at a way out with one of the team between him and it, in his sight, this near: he gives up; farther, he turns for another way */
  haltM: 3.5,
  /** how far the TEAM's hold on him reaches: one of the team within this with a line to him covers him (the challenge, the tie, 'nobody on him') */
  seeM: 14,
  /** what HE makes out is the civilians' own eye on the light that falls on the man (civilians.ts civilianSees: cone, range, the guards' sight gain); this is the
   *  gain at which a man of the team counts as seen — the guards' 'it moves his fix' bar. A man stood in the dark on his way out is not seen until he runs into him */
  seeRate: 0.05,
  /** hands up: one of the team this near with a line for `cuffSecs` and he is tied */
  cuffM: 4.5, cuffSecs: 3,
  /** hands up, not tied, and nobody of the team in sight for this long: he runs again */
  boltSecs: 6,
};
export type SnatchEnd = 'won' | 'lost';
export interface SnatchSnap { handsUp: boolean; tied: boolean; nearT: number; aloneT: number; end: SnatchEnd | null; why: string; seen: Vec3 | null; fear: Vec3 | null; lost: 'gone' | 'dead' | null; killer: { side: string; who: string } | null; times: { ran: number; up: number; tied: number; end: number }; stats: { turned: number; bolted: number }; lastExit: string | null; at: Vec3; yaw: number; out?: SnatchOutSnap }

export class Snatch {
  /** the man (null: no block, or not staged) */
  man: Guard | null = null;
  end: SnatchEnd | null = null; why = '';
  /** how it was lost: 'gone' | 'dead'; whose round, when dead */
  lost: 'gone' | 'dead' | null = null; killer: { side: string; who: string } | null = null;
  handsUp = false; tied = false;
  /** game time of: his first fright · his hands going up (the first time) · the tie · the end */
  times = { ran: -1, up: -1, tied: -1, end: -1 };
  /** ways out he was turned from · times he bolted with his hands up */
  stats = { turned: 0, bolted: 0 };
  log: string[] = [];
  private run: object | null = null;
  private nearT = 0; private aloneT = 0; private seen: Vec3 | null = null; private fear: Vec3 | null = null; private saidOut = false;
  /** how it ends while SNATCHOUT is up and the block names a van (snatchout.ts): he is led to it, and in it the mission is won */
  out: SnatchOut;
  constructor(private g: Game) { this.out = new SnatchOut(g, this); }

  /** this level's block while the overlay's switch is up (snatchout.ts reads the van off it) */
  get block(): SnatchData | null { return this.data; }
  /** the mission still hangs on him: loose — or, where he is to be driven off (snatchout.ts), not yet in the van (roomclear.ts: the house taken is not the end) */
  get owes(): boolean { return !this.end && (this.out.ruled || !this.inHand); }
  private get data(): SnatchData | null { return SNATCH.on ? this.g.level.scenarios?.snatch ?? null : null; }
  get active(): boolean { return !!this.man && !!this.data && !!this.g.roomClear?.active; }
  isMan(gd: Guard): boolean { return gd === this.man; }
  /** civilians.ts: the wrists-behind pose is his once he is tied */
  isTied(gd: Guard): boolean { return gd === this.man && this.tied; }
  /** alive and in the team's hands: tied, in Sam's arm, or out cold by Sam's hands */
  get inHand(): boolean { const m = this.man; return !!m && (m.state === 'dead' ? m.downKind !== 'shot' : this.tied || !!m.held); }
  /** civilians.ts civSay: what HE says in place of a civilian's line (dialogue.ts SNATCH_LINES) — by what he is doing; null = nothing (calm, he is silent: the
   *  glimpse, the shrug and the settling are the office worker's). A line that is already his passes as it is. No die: the pick is off the clock. */
  voice(gd: Guard, text: string): string | null {
    if (snatchLines().includes(text)) return text;
    const L = SNATCH_LINES, s = gd.civ!.state;
    const pool = this.tied ? L.tied : this.handsUp ? L.handsUp : s === 'cower' ? L.cornered : s === 'alarmed' || s === 'flee' ? L.running : null;
    return pool ? pool[Math.floor(this.g.time * 3 + text.length) % pool.length] : null;
  }
  /** combat.ts: a round has found him (before he goes down) — whose, for the tally */
  roundOn(gd: Guard, shooter: Guard | null) { if (gd === this.man) this.killer = shooter ? { side: shooter.team, who: shooter.callsign } : { side: 'player', who: 'Player' }; }

  /** the team's living characters: Sam and every operative unit that is up */
  private teamOf(): { c: Character; gd: Guard | null }[] {
    const g = this.g, out: { c: Character; gd: Guard | null }[] = [];
    if (!g.player.down) out.push({ c: g.player.char, gd: null });
    for (const gd of g.guards) if (gd.unit && gd.team === 'operative' && gd.state !== 'dead' && gd.char.alive) out.push({ c: gd.char, gd });
    return out;
  }
  /** notes made this run (the log itself is cut to its last rows) */
  notes = 0;
  note(what: string) { this.notes++; this.log.push(`${this.g.time.toFixed(1)} ${what}`); if (this.log.length > 60) this.log.splice(0, 20); }

  private stage(N: SnatchData) {
    const g = this.g;
    if (this.man) g.civilians = g.civilians.filter(c => c !== this.man);
    this.run = g.mission; this.end = null; this.why = ''; this.lost = null; this.killer = null; this.handsUp = false; this.tied = false;
    this.times = { ran: -1, up: -1, tied: -1, end: -1 }; this.stats = { turned: 0, bolted: 0 }; this.nearT = 0; this.aloneT = 0; this.seen = null; this.fear = null; this.saidOut = false; this.lastExit = null; this.log.length = 0; this.notes = 0; this.out.reset();
    this.man = spawnTarget(g, N.man);
    this.note(`${N.man.name} staged in his room`);
  }
  private drop() { const g = this.g; if (this.man) g.civilians = g.civilians.filter(c => c !== this.man); this.man = null; this.run = null; this.end = null; this.out.reset(); }

  tick(dt: number) {
    const g = this.g, N = this.data;
    if (!N) { if (this.man) this.drop(); return; }
    if (!g.roomClear?.active || g.touring) { if (this.man) this.drop(); return; }
    if (this.run !== g.mission || !this.man || !g.civilians.includes(this.man)) this.stage(N);
    if (this.end) return;
    const gd = this.man!, C = gd.civ!, c = gd.char, name = C.name;
    if (C.state !== 'work' && C.state !== 'startled' && this.times.ran < 0) this.times.ran = g.time;
    if (g.roomClear.end === 'wiped') return;   // (the team is gone: the room clear's own end stands, and what he does next is nobody's mission)
    // ---- the two ways it is lost
    if (C.state === 'gone') { this.lose('gone', `${name} got out by ${this.lastExit ?? 'a way nobody had a man on'}`); return; }
    if (gd.state === 'dead' && gd.downKind === 'shot') {
      // (no round of anybody's was on him: a BLAST killed him — frag.ts names its thrower on `killerId` after the fact)
      const blast = !this.killer; if (blast) { const by = gd.killerId >= 0 ? g.guards.find(x => x.char.id === gd.killerId) : null; this.killer = by ? { side: by.team, who: by.callsign } : gd.downBy === 'player' ? { side: 'player', who: 'Player' } : null; }
      const k = this.killer, what = blast ? 'grenade' : 'round';
      this.lose('dead', `${name} is dead — ${k ? (k.side === 'player' ? `your ${what}` : k.side === 'operative' ? `${k.who}'s ${what}` : `one of their own men's ${what}s`) : `a ${blast ? 'blast' : 'round'}`}`); return;
    }
    // ---- won: he is in the van (snatchout.ts, where the level has one and the rule is up) — or, as it was, the house is the team's and he is in hand
    const van = this.out.ruled;
    if (van) { if (this.out.tick(dt)) return; }
    else if (g.roomClear.end === 'taken' && this.inHand) { this.end = 'won'; this.why = `${name} taken alive`; this.times.end = g.time; this.note('WON'); g.msg(`MISSION COMPLETE — ${name} taken alive and the house is yours. Shift+Enter stages it again`); return; }
    if (gd.state === 'dead') { if (!this.saidOut) { this.saidOut = true; this.note('out cold'); g.msg(van ? `${name} is out cold — breathing, and yours. carry him to ${N.van!.name}` : g.roomClear.end === 'taken' ? `${name} is out cold — breathing, and yours` : `${name} is out cold — breathing, and yours. now the rest of the house`); } return; }
    if (gd.held) { this.handsUp = false; this.seen = v3.copy(c.pos); return; }   // (in Sam's arm: the civilians' own rows)
    // tied stays tied: Sam's arm letting go of him, or his own 'stay down' row with its clock, sets nobody running
    if (this.tied) { if (C.state !== 'cower' || !C.complied || C.complyUntil !== Infinity) civilianTie(g, gd); return; }
    // ---- who of the team has a line to him (the TEAM's hold on him: all round, whatever the light — their eyes, their goggles) and whom HE makes out (his own
    //      eye, by the light on the man: civilians.ts civilianSees)
    const eye = c.bones.head ?? v3.add(c.pos, [0, 1.5, 0]);
    let near: Character | null = null, nearD = Infinity; const inSight: { m: Character; d: number }[] = [];
    for (const { c: m, gd: mate } of this.teamOf()) {
      const d = v3.distXZ(m.pos, c.pos);
      if (d <= SNATCH.seeM && d < nearD) {
        const chest = m.bones.chest ?? v3.add(m.pos, [0, 1.1, 0]), head = m.bones.head ?? v3.add(m.pos, [0, 1.6, 0]);
        if (!(g.col.segmentBlocked(eye, chest) && g.col.segmentBlocked(eye, head))) { nearD = d; near = m; }
      }
      if (civilianSees(g, gd, m, mate, SNATCH.seeRate)) inSight.push({ m, d });
    }
    inSight.sort((a, b) => a.d - b.d);
    if (near) { this.seen = v3.copy(c.pos); this.fear = v3.copy(near.pos); }
    // a promise Sam took from him by hand (the civilians' 'stay down' row) is his hands up as well; one that something else took off him is not
    if (this.handsUp && (C.state !== 'cower' || !C.complied)) this.handsUp = false;
    if (!this.handsUp && C.state === 'cower' && C.complied) { this.handsUp = true; this.nearT = 0; this.aloneT = 0; if (this.times.up < 0) this.times.up = g.time; }
    if (this.handsUp) {
      C.complyUntil = Infinity;
      if (near && nearD <= SNATCH.cuffM) { this.nearT += dt; this.aloneT = 0; if (this.nearT >= SNATCH.cuffSecs) this.tie(near); }
      else if (near) { this.aloneT = 0; this.nearT = 0; }
      else { this.nearT = 0; this.aloneT += dt; if (this.aloneT >= SNATCH.boltSecs) { this.handsUp = false; this.aloneT = 0; this.stats.bolted++; this.note('nobody on him: he bolts'); civilianBolt(g, gd, this.fear ?? c.pos); } }
      return;
    }
    // ---- he gives up to one of the team close by with a line to him (the challenge is the team's: from any side)
    if (near && nearD <= SNATCH.giveUpM) { this.giveUp(near, 'close'); return; }
    // ---- quiet at his marks and he makes out one of the team: the fright the civilians give Sam with a gun out
    if ((C.state === 'work' || C.state === 'startled') && inSight.length) { toAlarmed(g, gd, 'gun', v3.copy(inSight[0].m.pos), true); return; }
    // ---- running at a way out and he makes out one of the team between him and it
    const T = C.state === 'flee' ? C.target : null;
    if (T && T.kind === 'exit') {
      this.lastExit = T.name;
      const mine = v3.distXZ(c.pos, T.pos);
      const ahead = inSight.find(x => v3.distXZ(x.m.pos, T.pos) < mine - 0.5);
      if (ahead) {
        if (ahead.d <= SNATCH.haltM) { this.giveUp(ahead.m, 'cut off'); return; }
        C.badTargets.add(T.spot!); C.target = null; this.stats.turned++; this.note(`turned from ${T.name}: a man on it`);
      }
    }
  }
  private lastExit: string | null = null;

  private giveUp(to: Character, how: string) {
    const g = this.g, gd = this.man!;
    civilianYield(g, gd, to.pos);
    this.handsUp = true; this.nearT = 0; this.aloneT = 0; if (this.times.up < 0) this.times.up = g.time;
    this.note(`hands up (${how})`);
    const mate = g.guards.find(x => x.char === to);
    if (mate) g.say(mate, 'hands! on your head! down!');
  }
  private tie(by: Character) {
    const g = this.g, gd = this.man!, name = gd.civ!.name;
    this.tied = true; this.times.tied = g.time; civilianTie(g, gd);
    this.note('tied');
    const mate = g.guards.find(x => x.char === by);
    if (mate) g.say(mate, `${name} secured.`, true);
    g.msg(this.out.ruled ? `${name} is secured — get him to ${this.data!.van!.name}` : g.roomClear?.end === 'taken' ? `${name} is secured` : `${name} is secured — now the rest of the house`);
  }
  /** snatchout.ts: he is in the van */
  win(why: string) {
    const g = this.g;
    this.end = 'won'; this.why = why; this.times.end = g.time; this.note('WON'); g.msg(`MISSION COMPLETE — ${why}. Shift+Enter stages it again`);
  }
  private lose(how: 'gone' | 'dead', why: string) {
    const g = this.g, m = g.mission;
    this.end = 'lost'; this.lost = how; this.why = why; this.times.end = g.time; this.note(`LOST — ${why}`);
    this.out.letGo();   // (snatchout.ts: nothing of its ticks after an end — the men it planted go back to the file here)
    if (m.stage !== 'failed' && m.stage !== 'done' && !g.player.down) { m.stage = 'failed'; m.driveT = -1; m.downCardAt = g.missionInTour ? -1 : g.time + DOWN_CARD_SECS; }
    g.msg(`MISSION FAILED — ${why}. Enter restarts`);
  }

  /** mission.ts objectiveText / objectivePos: his line and marker while he is loose (or it is over); null = the room clear's own. A live row leads with
   *  'objective ▸ ' as the room clear's, the defuse's and the rescue's do; the two end rows do not, as the room clear's 'structure taken' does not */
  objective(): { text: string; pos: Vec3 | null } | null {
    const gd = this.man; if (!this.active || !gd) return null;
    const N = this.data!, name = gd.civ!.name;
    if (this.end === 'won') return { text: this.out.inAt >= 0 ? this.why : `${name} taken alive — the house is yours`, pos: null };
    if (this.end === 'lost') return { text: `mission failed — ${this.why}`, pos: null };
    if (this.g.roomClear?.end === 'wiped') return null;
    if (this.inHand) return this.out.objective();   // (snatchout.ts: where to take him — null where the house is what is left)
    if (this.handsUp) return { text: `objective ▸ ${name} has his hands up — get a man to him before he runs again`, pos: v3.copy(gd.char.pos) };
    const loud = gd.civ!.state !== 'work' && gd.civ!.state !== 'startled';
    return { text: loud ? `objective ▸ ${name} is running — take him alive` : `objective ▸ take ${name} alive — he runs for ${N.exits[0].name} the moment it goes loud`, pos: v3.copy(this.seen ?? N.man.pos) };
  }
  summary(): string {
    const gd = this.man; if (!gd || !this.data) return 'snatch: none on this level';
    const st = this.end ? `${this.end}${this.why ? ` (${this.why})` : ''}` : this.tied ? 'tied' : this.handsUp ? 'hands up' : gd.civ!.state;
    return `snatch: ${gd.civ!.name} · ${st} · turned ${this.stats.turned} · bolted ${this.stats.bolted}`;
  }
  snapshot(): SnatchSnap | undefined {
    const m = this.man; if (!this.active || !m) return undefined;
    return { handsUp: this.handsUp, tied: this.tied, nearT: this.nearT, aloneT: this.aloneT, end: this.end, why: this.why, seen: this.seen ? v3.copy(this.seen) : null, fear: this.fear ? v3.copy(this.fear) : null,
      lost: this.lost, killer: this.killer ? { ...this.killer } : null, times: { ...this.times }, stats: { ...this.stats }, lastExit: this.lastExit, at: v3.copy(m.char.pos), yaw: m.char.bodyYaw, ...(this.out.ruled ? { out: this.out.snapshot() } : {}) };
  }
  /** savestate.ts, after the civilians are back. TODAY NOTHING REACHES THIS: a checkpoint is refused with a squad on the floor, and a snatch is never staged without one. Written
   *  for the day that changes: a load is a restart, and the restart's room clear has not staged him yet, so the civilians' own slice found nobody to put back — he is staged here,
   *  stood where the file had him, and the overlay's flags (and the pose they mean) are put back. What is NOT carried: his fright mid-run (he comes back as his flags say: at
   *  work, hands up, or tied) and a man out cold (he comes back standing). */
  restore(s: SnatchSnap | undefined) {
    const N = this.data; if (!s || !N) return;
    if (!this.man || !this.g.civilians.includes(this.man)) { this.stage(N); const c = this.man!.char; c.pos[0] = s.at[0]; c.pos[2] = s.at[2]; c.bodyYaw = s.yaw; }
    this.run = this.g.mission;
    this.handsUp = s.handsUp; this.tied = s.tied; this.nearT = s.nearT; this.aloneT = s.aloneT; this.end = s.end; this.why = s.why; this.seen = s.seen ? v3.copy(s.seen) : null; this.fear = s.fear ? v3.copy(s.fear) : null;
    this.lost = s.lost ?? null; this.killer = s.killer ? { ...s.killer } : null; if (s.times) this.times = { ...s.times }; if (s.stats) this.stats = { ...s.stats }; this.lastExit = s.lastExit ?? null;
    if (this.tied || this.handsUp) civilianTie(this.g, this.man!);   // (the complied cower with no end to it; the wrists-behind pose is asked of isTied)
    this.out.restore(s.out);
  }
}

/** the block against the built floor: he and his ways out stand on floor a man can walk, and every way out can be walked to from where he keeps */
export function checkSnatch(g: Game): string[] {
  const N = g.level.scenarios?.snatch; if (!N) return [];
  const out: string[] = [], nav = g.col.nav;
  const pts: [string, Vec3][] = [['man.pos', N.man.pos], ...(N.man.points ?? []).map((p, i): [string, Vec3] => [`man.points[${i}]`, p]), ...N.exits.map((e, i): [string, Vec3] => [`exits[${i}] ${e.name}`, e.pos])];
  for (const [w, p] of pts) if (nav.isBlocked(p[0], p[2])) out.push(`scenarios.snatch.${w}: (${p[0]}, ${p[2]}) is not floor a man can stand on`);
  const walk = N.exits.map(e => { const w = nav.findPath(N.man.pos, e.pos); if (!w?.length) { out.push(`scenarios.snatch: no way on foot from where he keeps to ${e.name}`); return Infinity; } let l = 0, q: Vec3 = N.man.pos; for (const p of w) { l += v3.distXZ(q, p); q = p; } return l; });
  if (N.van) { if (nav.isBlocked(N.van.pos[0], N.van.pos[2])) out.push(`scenarios.snatch.van.pos: (${N.van.pos[0]}, ${N.van.pos[2]}) is not floor a man can stand on`); else if (!nav.findPath(N.man.pos, N.van.pos)?.length) out.push(`scenarios.snatch: no way on foot from where he keeps to ${N.van.name}`); }
  if (walk.some(l => l < walk[0] - 0.5)) out.push(`scenarios.snatch.exits[0] (${N.exits[0].name}) is not his nearest way out on foot: the objective's line and the page name the first as the one he runs for`);
  return out;
}
