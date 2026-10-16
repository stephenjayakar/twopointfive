// A BYSTANDER FOR THE PLAY-THROUGH (PT_LIGHTWALL=1): is anybody's burning weapon light on the far side of a wall from the man who carries it?
// Every frame, for every living man whose light is lit (the team's, the defenders', Sam's): one collision ray from his gun shoulder to where the LIGHT is
// (RtLight.pos, as the frame left it). A static or a door leaf on that line = the light shines from beyond it — the flaw src/game/lighting.ts lensClear mends,
// so with LIGHTWALL on this should count nothing (a man whose shoulder itself is inside a leaf is the case the rule's ray cannot see), and LENS_STATS (the
// rule's own count of the lights it pulled back) says how often it had to act; with it off this counts the flaw. tools/qa/paths-watch.ts counts a light through a
// LEAF among its door spells; this one asks statics too, and from the shoulder. Reads only: positions, the collision grid, the lights. Every run's JSON carries `lightwall`.
import { LENS_STATS } from '../../src/game/lighting';

export interface LightSpell { who: string; side: string; what: string; t0: number; t1: number; frames: number; /** how far past the surface the light stood, m (worst frame) */ worst: number; at: [number, number] }
export interface LightWallOut { on: boolean; frames: number; litFrames: number; throughFrames: number; spells: LightSpell[]; bySide: Record<string, number>; pulled: number; asked: number; maxBack: number }

const GAP = 0.25;   // s: a spell broken for less than this is one spell

export class LightWallWatch {
  private frames = 0; private lit = 0; private through = 0; private open = new Map<string, LightSpell>(); private spells: LightSpell[] = []; private bySide: Record<string, number> = {};
  private asked0 = LENS_STATS.asked; private pulled0 = LENS_STATS.pulled;
  constructor(private g: any, private on: () => boolean, private say?: (s: string) => void) { LENS_STATS.maxBack = 0; }
  private one(t: number, who: string, side: string, c: any, L: any) {
    if (!L?.enabled || !(L.intensity > 0)) return; const from = c.bones?.upperArmR; if (!from) return;
    this.lit++;
    const d = [L.pos[0] - from[0], L.pos[1] - from[1], L.pos[2] - from[2]], len = Math.hypot(d[0], d[1], d[2]); if (len < 1e-3) return;
    const h = this.g.col.raycast(from, [d[0] / len, d[1] / len, d[2] / len], len); if (!h) return;
    this.through++; this.bySide[side] = (this.bySide[side] ?? 0) + 1;
    const what = h.index >= 1e6 ? 'leaf' : 'static', key = `${who}|${what}`; let S = this.open.get(key);
    if (S && t - S.t1 > GAP) { this.open.delete(key); S = undefined; }
    if (!S) { S = { who, side, what, t0: +t.toFixed(2), t1: t, frames: 0, worst: 0, at: [+c.pos[0].toFixed(2), +c.pos[2].toFixed(2)] }; this.open.set(key, S); this.spells.push(S); this.say?.(`   >> light · ${who}'s light is beyond a ${what} at ${S.at.join(', ')}`); }
    S.t1 = t; S.frames++; S.worst = Math.max(S.worst, +(len - h.t).toFixed(3));
  }
  tick(t: number) {
    const g = this.g; this.frames++;
    for (const gd of g.guards) { if (gd.state === 'dead' || (gd.torchLostAt >= 0 && gd.dropped)) continue;   // (a torch on the floor is nobody's carried light: the rule asks from the torch itself there)
      this.one(t, gd.callsign ?? `man ${gd.char.id}`, gd.team ?? 'guard', gd.char, gd.flashlight); }
    const pl = g.player; if (pl && !pl.down) this.one(t, 'Sam', 'player', pl.char, pl.light);
  }
  out(): LightWallOut {
    for (const S of this.spells) S.t1 = +S.t1.toFixed(2);
    return { on: this.on(), frames: this.frames, litFrames: this.lit, throughFrames: this.through, spells: this.spells, bySide: this.bySide, pulled: LENS_STATS.pulled - this.pulled0, asked: LENS_STATS.asked - this.asked0, maxBack: +LENS_STATS.maxBack.toFixed(3) };
  }
}
