// WHAT THE MEN DO WITH WHAT BROKE — a bystander for tools/qa/playthrough.ts (on whenever the destruction's switch is), like its Tally, DefWatch and WaysWatch: it
// reads the wall engine's change feed (wallbreak.ts `walls.since`) and the roster, and writes nothing the game reads (the digest is the same with it).
//   made      rows of the feed by kind and cause ('hole by blast', 'port by fire', 'cover by fire' …)
//   through   times a man of each side stepped onto floor a HOLE opened (a nav cell that was wall; once per man per 2 s — a man standing in it counts once),
//             and how many different men of each side did
//   killed    men of each side dropped by a round whose line (killer's feet → his, in plan) crosses something that was opened: through a hole, a port, or
//             where cover stood (the first of those it crosses) — 'shot through what broke'
//   react / walls / firstHole   wallreact.ts's and wallbreak.ts's own counters at the end, and the second the first hole was made
//   wallLog   wallcharge.ts's own log of its orders (set, stood off, blown, who took which point and door inside)
//   watch     blast holes and the team's guns, read four times a second: `open` = hole-seconds (each blown hole, from the blast to the end of the fight),
//             `held` = those with a living teammate's gun on it (a line from his chest to the gap's middle, his aim within 30 degrees of it, inside 14 m),
//             `near` = those with a living teammate within 6 m of it by a straight line — a hole with nobody near it is behind the team, not beside it
import { WALL_STATS } from '../../src/game/wallbreak.ts';
import { WALLREACT_STATS } from '../../src/game/wallreact.ts';

type Rect = [number, number, number, number];
type Side = 'team' | 'theirs';
const KINDS = ['hole', 'port', 'cover'] as const;
/** does the plan segment a→b cross the rect (grown by `pad`) */
function crosses(a: number[], b: number[], r: Rect, pad = 0.05): boolean {
  let t0 = 0, t1 = 1; const d = [b[0] - a[0], b[2] - a[2]], o = [a[0], a[2]], lo = [r[0] - pad, r[1] - pad], hi = [r[2] + pad, r[3] + pad];
  for (let k = 0; k < 2; k++) {
    if (Math.abs(d[k]) < 1e-9) { if (o[k] < lo[k] || o[k] > hi[k]) return false; continue; }
    let u = (lo[k] - o[k]) / d[k], v = (hi[k] - o[k]) / d[k]; if (u > v) [u, v] = [v, u];
    t0 = Math.max(t0, u); t1 = Math.min(t1, v); if (t0 > t1) return false;
  }
  return true;
}

function since(now: object, base: Record<string, number>): Record<string, number> { const o: Record<string, number> = {}; for (const [k, v] of Object.entries(now)) o[k] = typeof v === 'number' ? v - (base[k] ?? 0) : v; return o; }

export class HoleWatch {
  made: Record<string, number> = {}; firstHole = -1;
  through: Record<Side | 'sam', number> = { team: 0, theirs: 0, sam: 0 };
  killed: Record<Side, Record<string, number>> = { team: { hole: 0, port: 0, cover: 0 }, theirs: { hole: 0, port: 0, cover: 0 } };
  watch = { open: 0, held: 0, near: 0, nearHeld: 0 }; private blown: Rect[] = []; private q = -1;
  private serial: number; private cells = new Set<number>(); private rects: { kind: string; rect: Rect }[] = [];
  private lastIn = new Map<any, number>(); private men: Record<Side, Set<any>> = { team: new Set(), theirs: new Set() }; private was = new Map<any, string>();
  private base = { react: { ...WALLREACT_STATS } as Record<string, number>, walls: { ...WALL_STATS } as Record<string, number> };   // (the modules' counters are the process's: a tool that plays several fights in one process gets each fight's own)
  constructor(private g: any) { this.serial = g.destr?.walls?.serial ?? 0; }
  private read(t: number) {
    const W = this.g.destr?.walls; if (!W || W.serial === this.serial) return;
    const rows = W.since(this.serial) ?? []; this.serial = W.serial;
    for (const r of rows) {
      if (r.kind === 'reset') { this.cells.clear(); this.rects.length = 0; this.blown.length = 0; continue; }
      const k = `${r.kind} by ${r.cause}`; this.made[k] = (this.made[k] ?? 0) + 1;
      if (!(KINDS as readonly string[]).includes(r.kind)) continue;
      this.rects.push({ kind: r.kind, rect: r.rect }); if (r.kind === 'hole' && r.cause === 'blast') this.blown.push(r.rect);
      if (r.kind === 'hole') { for (const c of r.opened) this.cells.add(c); if (this.firstHole < 0) this.firstHole = +t.toFixed(1); }
    }
  }
  private step(who: any, pos: number[], t: number, side: Side | 'sam') {
    const nav = this.g.col.nav; if (!this.cells.has(nav.idx(Math.floor(pos[0] / nav.cell), Math.floor(pos[2] / nav.cell)))) return;
    const last = this.lastIn.get(who); this.lastIn.set(who, t);
    if (last !== undefined && t - last < 2) return;
    this.through[side]++; if (side !== 'sam') this.men[side].add(who);
  }
  /** the team's guns on the holes a charge blew (see `watch` in the head) */
  private guns(team: any[]) {
    const col = this.g.col;
    for (const r of this.blown) { const mid = [(r[0] + r[2]) / 2, 1.2, (r[1] + r[3]) / 2]; let held = false, near = false;
      for (const m of team) { if (m.state === 'dead') continue; const p = m.char.pos, d = Math.hypot(mid[0] - p[0], mid[2] - p[2]); if (d > 14) continue; if (d <= 6) near = true;
        if (d < 0.9) { held = true; continue; }   // (he stands in it)
        let e = Math.atan2(mid[0] - p[0], mid[2] - p[2]) - m.char.aimYaw; e = Math.abs(Math.atan2(Math.sin(e), Math.cos(e)));
        if (e <= 0.524 && !col.segmentBlocked([p[0], 1.2, p[2]], mid)) held = true; }
      this.watch.open += 0.25; if (held) this.watch.held += 0.25; if (near) { this.watch.near += 0.25; if (held) this.watch.nearHeld += 0.25; } }
  }
  tick(t: number, team: any[], hostiles: any[]) {
    this.read(t); const g = this.g;
    if (this.blown.length && Math.floor(t * 4) !== this.q) { this.q = Math.floor(t * 4); this.guns(team); }
    if (this.cells.size) { this.step(g.player, g.player.char.pos, t, 'sam'); for (const m of team) if (m.state !== 'dead') this.step(m, m.char.pos, t, 'team'); for (const m of hostiles) if (m.state !== 'dead') this.step(m, m.char.pos, t, 'theirs'); }
    for (const [list, side] of [[team, 'team'], [hostiles, 'theirs']] as [any[], Side][]) for (const m of list) {
      const was = this.was.get(m); this.was.set(m, m.state); if (was === undefined || was === 'dead' || m.state !== 'dead' || !this.rects.length) continue;
      const k = m.killerId === g.player.char.id ? g.player.char : g.guards.find((x: any) => x.char.id === m.killerId)?.char; if (!k) continue;
      for (const kind of KINDS) if (this.rects.some(r => r.kind === kind && crosses(k.pos, m.char.pos, r.rect))) { this.killed[side][kind]++; break; }
    }
  }
  close() { return { made: this.made, firstHole: this.firstHole, through: this.through, throughMen: { team: this.men.team.size, theirs: this.men.theirs.size }, killed: this.killed, watch: this.watch, react: since(WALLREACT_STATS, this.base.react), walls: since(WALL_STATS, this.base.walls),
    wallLog: ((this.g.wallCharge?.log ?? []) as { t: number; what: string }[]).map(x => `${x.t.toFixed(1)} ${x.what}`) }; }   // (the wall charge's own beats: who set, who was dealt which door inside)
}
