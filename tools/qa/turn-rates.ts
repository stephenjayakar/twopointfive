// HOW FAST DO THEY TURN — every man's muzzle yaw (Character.aimYaw) and body yaw read each frame over whole scripted play-throughs (playthrough.ts's usual
// entry), by side: the rate distribution, and every SWING (a run of frames turning one way faster than 1 rad/s) with its angle, its length and its peak rate.
// The numbers the turn-weight knobs (character.ts TURN) were set against; run it with TPS_TURN=1 to read the same play with the weight on.
//   bun run tools/qa/turn-rates.ts [--scn night-breach,block-four] [--seeds 1-4] [--cap 300] [--json out.json]
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const { play } = await import('./playthrough.ts');
const { Character } = await import(`${ROOT}/src/game/character.ts`);
const { PLAYER_ID } = await import(`${ROOT}/src/game/consts.ts`);

const argv = process.argv.slice(2); const flag = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const seedsOf = (s: string): number[] => s.split(',').flatMap(p => { const m = p.match(/^(\d+)-(\d+)$/); if (m) { const o: number[] = []; for (let i = +m[1]; i <= +m[2]; i++) o.push(i); return o; } return [Number(p)]; });
const scns = (flag('--scn') ?? 'night-breach,block-four').split(','), seeds = seedsOf(flag('--seeds') ?? '1-4'), cap = Number(flag('--cap') ?? 300);

type Side = 'team' | 'theirs';
interface Swing { deg: number; secs: number; peak: number }
interface Track { aim: number; body: number; pos: [number, number]; sw: { aim: { sign: number; a: number; t: number; peak: number } | null; body: { sign: number; a: number; t: number; peak: number } | null } }
const wrap = (a: number) => { a = (a + Math.PI) % (2 * Math.PI); if (a < 0) a += 2 * Math.PI; return a - Math.PI; };
const DEG = 180 / Math.PI, SWING_MIN = 1.0;
const S: Record<Side, { rate: Record<'aim' | 'body', number[]>; swings: Record<'aim' | 'body', Swing[]>; frames: number }> = {
  team: { rate: { aim: [], body: [] }, swings: { aim: [], body: [] }, frames: 0 }, theirs: { rate: { aim: [], body: [] }, swings: { aim: [], body: [] }, frames: 0 } };
const tracks = new WeakMap<object, Track>();

const orig = Character.prototype.update;
Character.prototype.update = function (this: any, dt: number) {
  orig.call(this, dt);
  if (this.id === PLAYER_ID || this.ragdoll || !(dt > 0)) { tracks.delete(this); return; }
  const tr = this.anim.trained; const side: Side | null = tr > 0.9 ? 'team' : tr < 0.2 ? 'theirs' : null; if (!side) return;
  let T = tracks.get(this);
  const jumped = T && Math.hypot(this.pos[0] - T.pos[0], this.pos[2] - T.pos[1]) > 0.75;   // (staged / teleported: not a turn)
  if (!T || jumped) { tracks.set(this, { aim: this.aimYaw, body: this.bodyYaw, pos: [this.pos[0], this.pos[2]], sw: { aim: null, body: null } }); return; }
  const B = S[side]; B.frames++;
  for (const k of ['aim', 'body'] as const) {
    const now = k === 'aim' ? this.aimYaw : this.bodyYaw, d = wrap(now - T[k]), r = d / dt, ar = Math.abs(r); T[k] = now;
    if (ar > 0.2) B.rate[k].push(ar);
    const w = T.sw[k];
    if (ar >= SWING_MIN && (!w || Math.sign(r) === w.sign)) { if (w) { w.a += Math.abs(d); w.t += dt; w.peak = Math.max(w.peak, ar); } else T.sw[k] = { sign: Math.sign(r), a: Math.abs(d), t: dt, peak: ar }; }
    else { if (w && w.a * DEG >= 10) B.swings[k].push({ deg: w.a * DEG, secs: w.t, peak: w.peak }); T.sw[k] = ar >= SWING_MIN ? { sign: Math.sign(r), a: Math.abs(d), t: dt, peak: ar } : null; }
  }
  T.pos[0] = this.pos[0]; T.pos[1] = this.pos[2];
};

const q = (xs: number[], p: number) => { if (!xs.length) return NaN; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const quietly = async <T>(fn: () => Promise<T>): Promise<T> => { const l = console.log, e = console.error, w = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = l; console.error = e; console.warn = w; } };
for (const scn of scns) for (const seed of seeds) { const r = await quietly(() => play(scn, seed, cap)); console.error(`  ${scn}:${seed} ${r.end} ${r.t} s · team ${r.team}/${r.of}`); }

const BUCKETS: [number, number][] = [[10, 30], [30, 60], [60, 100], [100, 150], [150, 360]];
const f = (x: number, n = 0) => Number.isFinite(x) ? x.toFixed(n) : '—';
const out: any = { scns, seeds, sides: {} as any };
for (const side of ['team', 'theirs'] as const) {
  const B = S[side]; out.sides[side] = {};
  console.log(`\n${side === 'team' ? 'THE TEAM (operatives)' : 'THEIR MEN (defenders)'} — ${B.frames} man-frames`);
  for (const k of ['aim', 'body'] as const) {
    const R = B.rate[k], sw = B.swings[k];
    console.log(`  ${k === 'aim' ? 'muzzle' : 'body  '} yaw rate while turning (°/s): median ${f(q(R, 0.5) * DEG)} · p90 ${f(q(R, 0.9) * DEG)} · p99 ${f(q(R, 0.99) * DEG)} · max ${f(q(R, 1) * DEG)}`);
    const rows: any[] = [];
    for (const [lo, hi] of BUCKETS) { const m = sw.filter(s => s.deg >= lo && s.deg < hi); if (!m.length) continue;
      const row = { from: lo, to: hi, n: m.length, secs: q(m.map(s => s.secs), 0.5), secs10: q(m.map(s => s.secs), 0.1), peak: q(m.map(s => s.peak), 0.5) * DEG, peak90: q(m.map(s => s.peak), 0.9) * DEG }; rows.push(row);
      console.log(`     swings ${String(lo).padStart(3)}–${String(hi).padEnd(3)}°: ${String(row.n).padStart(5)} · median ${f(row.secs * 1000)} ms (fastest tenth ${f(row.secs10 * 1000)} ms) · peak rate median ${f(row.peak)} °/s, p90 ${f(row.peak90)} °/s`); }
    out.sides[side][k] = { rate: { p50: q(R, 0.5) * DEG, p90: q(R, 0.9) * DEG, p99: q(R, 0.99) * DEG, max: q(R, 1) * DEG }, swings: rows };
  }
}
if (flag('--json')) writeFileSync(flag('--json')!, JSON.stringify(out, null, 1));
process.exit(0);
