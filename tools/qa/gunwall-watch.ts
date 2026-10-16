// A BYSTANDER FOR THE PLAY-THROUGH (PT_GUNWALL=1): is anybody's weapon drawn through a wall or a door leaf?
// Every frame, for every living man with a gun in his hands (the team's, the defenders', Sam's): two collision rays along the arm and the gun as the frame left
// them — gun shoulder → gun hand, gun hand → muzzle (Character.muzzle: where the round, the flash and the laser start). A static or a leaf on either = the weapon
// (or the hand that holds it) is drawn inside it or out through its far face — the flaw src/game/gunwall.ts mends, so with GUNWALL on this should count next to
// nothing, and GUNWALL_STATS (the rule's own count of the guns it brought down) says how often it had to act; with it off this counts the flaw.
// tools/qa/lightwall-watch.ts asks the same of a burning weapon light. Reads only: positions, bones, the collision grid. Every run's JSON carries `gunwall`.
import { GUNWALL_STATS, gunWallIs } from '../../src/game/gunwall';

export interface GunSpell { who: string; side: string; what: string; /** the carriage he showed when it began */ how: string; t0: number; t1: number; frames: number; /** how far past the surface the muzzle stood, m, along the surface's normal (worst frame) */ worst: number; at: [number, number] }
export interface GunWallOut { on: boolean; frames: number; armedFrames: number; throughFrames: number; spells: GunSpell[]; bySide: Record<string, number>; byHow: Record<string, number>; byWhat: Record<string, number>; armedByHow: Record<string, number>; lowered: number; loweredS: number; tucked: number; worst: number;
  /** frames the RULE held a gun down, by side — and of those, the frames the man had a target of his own (alert / a scripted man's `over`) */ lowBySide: Record<string, number>; lowHotBySide: Record<string, number>;
  /** when the rule last held each man's gun down, s */ lastLow: Record<string, number> }

const TRACE = (globalThis as any).process?.env?.PT_GUNWALL_TRACE?.split(':') ?? null;
const GAP = 0.25;   // s: a spell broken for less than this is one spell

/** what he is doing with the gun, in a word: the long gun's carriage as shown, else the pistol's (null: no gun in a hand — holstered, hands at his sides) */
export function carriageOf(c: any): string | null {
  const an = c.anim; if (!an) return null;
  if (an.longGun) return an.longShown ?? 'long';
  if (an.upper === 'aim' || an.shootT >= 0) return 'pistolAim';
  if (an.stance && an.stance !== 'none') return `pistol:${an.stance}`;
  return null;
}
/** the arm and the gun against the statics and the leaves: the first surface on shoulder → hand → muzzle, and how far past it the muzzle stands (along its normal) */
export function gunThrough(col: any, c: any): { index: number; depth: number; seg: 'arm' | 'gun' } | null {
  const sh = c.bones?.upperArmR, hand = c.bones?.handR, m = c.muzzle; if (!sh || !hand || !m) return null;
  for (const [a, b, seg] of [[sh, hand, 'arm'], [hand, m, 'gun']] as const) {
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(d[0], d[1], d[2]); if (L < 1e-3) continue;
    const rd = [d[0] / L, d[1] / L, d[2] / L], h = col.raycast(a, rd, L); if (!h) continue;
    const p = [a[0] + rd[0] * h.t, a[1] + rd[1] * h.t, a[2] + rd[2] * h.t];
    return { index: h.index, seg, depth: Math.abs((m[0] - p[0]) * h.n[0] + (m[1] - p[1]) * h.n[1] + (m[2] - p[2]) * h.n[2]) };
  }
  return null;
}

export class GunWallWatch {
  private frames = 0; private armed = 0; private through = 0; private worst = 0; private open = new Map<string, GunSpell>(); private spells: GunSpell[] = [];
  private bySide: Record<string, number> = {}; private byHow: Record<string, number> = {}; private byWhat: Record<string, number> = {}; private armedByHow: Record<string, number> = {};
  private s0 = { ...GUNWALL_STATS }; private lowBySide: Record<string, number> = {}; private lowHotBySide: Record<string, number> = {}; private lastLow: Record<string, number> = {};
  constructor(private g: any, private on: () => boolean, private say?: (s: string) => void) {}
  private one(t: number, who: string, side: string, c: any) {
    const how = carriageOf(c); if (!how) return;
    if (TRACE && who === TRACE[0] && t >= +TRACE[1] && t <= +TRACE[2]) {   // PT_GUNWALL_TRACE='Red Two:21:23': that man, frame by frame, in his own frame (forward / right of his aim)
      const f = [Math.sin(c.aimYaw), Math.cos(c.aimYaw)], rel = (p: number[]) => `${((p[0] - c.pos[0]) * f[0] + (p[2] - c.pos[2]) * f[1]).toFixed(2)},${(-(p[0] - c.pos[0]) * f[1] + (p[2] - c.pos[2]) * f[0]).toFixed(2)},${p[1].toFixed(2)}`;
      const h = gunThrough(this.g.col, c), an = c.anim;
      console.log(`  gun ${t.toFixed(2)} ${who} ${how} pos ${c.pos[0].toFixed(2)},${c.pos[2].toFixed(2)} aim ${c.aimYaw.toFixed(2)} body ${c.bodyYaw.toFixed(2)} v ${Math.hypot(c.vel[0], c.vel[2]).toFixed(2)} upper ${an.upper} stance ${an.stance} gunWall ${an.gunWall.toFixed(2)} muzzle ${rel(c.muzzle)} hand ${rel(c.bones.handR)} sh ${rel(c.bones.upperArmR)}${h ? ` THROUGH ${h.index >= 1e6 ? 'leaf' : 'static'} ${h.depth.toFixed(3)} on ${h.seg}` : ''}`);
    }
    this.armed++; this.armedByHow[how] = (this.armedByHow[how] ?? 0) + 1;
    const h = gunThrough(this.g.col, c); if (!h) return;
    this.through++; this.bySide[side] = (this.bySide[side] ?? 0) + 1; this.byHow[how] = (this.byHow[how] ?? 0) + 1;
    const what = h.index >= 1e6 ? 'leaf' : 'static'; this.byWhat[what] = (this.byWhat[what] ?? 0) + 1; this.worst = Math.max(this.worst, h.depth);
    const key = `${who}|${what}`; let S = this.open.get(key);
    if (S && t - S.t1 > GAP) { this.open.delete(key); S = undefined; }
    if (!S) { S = { who, side, what, how, t0: +t.toFixed(2), t1: t, frames: 0, worst: 0, at: [+c.pos[0].toFixed(2), +c.pos[2].toFixed(2)] }; this.open.set(key, S); this.spells.push(S); this.say?.(`   >> gun · ${who}'s weapon (${how}) is in a ${what} at ${S.at.join(', ')}`); }
    S.t1 = t; S.frames++; S.worst = Math.max(S.worst, +h.depth.toFixed(3));
  }
  tick(t: number) {
    const g = this.g; this.frames++;
    for (const gd of g.guards) {
      if (gd.state === 'dead' || !gd.char?.alive) continue; const who = gd.callsign ?? `man ${gd.char.id}`, side = gd.team ?? 'guard';
      this.one(t, who, side, gd.char);
      if (gunWallIs(g, gd.char)) { this.lowBySide[side] = (this.lowBySide[side] ?? 0) + 1; this.lastLow[who] = +t.toFixed(2); if (gd.state === 'alert' || gd.script?.over) this.lowHotBySide[side] = (this.lowHotBySide[side] ?? 0) + 1; }
    }
    const pl = g.player; if (pl && !pl.down && (pl.rifleUp || pl.pistolUp)) this.one(t, 'Sam', 'player', pl.char);
  }
  out(): GunWallOut {
    for (const S of this.spells) S.t1 = +S.t1.toFixed(2);
    return { on: this.on(), frames: this.frames, armedFrames: this.armed, throughFrames: this.through, spells: this.spells, bySide: this.bySide, byHow: this.byHow, byWhat: this.byWhat, armedByHow: this.armedByHow,
      lowered: GUNWALL_STATS.lowered - this.s0.lowered, loweredS: +(GUNWALL_STATS.loweredS - this.s0.loweredS).toFixed(2), tucked: GUNWALL_STATS.tucked - this.s0.tucked, worst: +this.worst.toFixed(3), lowBySide: this.lowBySide, lowHotBySide: this.lowHotBySide, lastLow: this.lastLow };
  }
}
