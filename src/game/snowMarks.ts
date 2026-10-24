// EVERY THING THAT MOVES OVER LYING SNOW MARKS IT (SNOW_LOOK.marks; the maintainer, 10-15, from his play of the pass: "pushed objects (like the chair) should
// impact the snow", "we should make it so all physics objects can affect the snow", "and should be dependent on force"). PICTURE ONLY: it reads where the
// game's things are and writes the prints' map (snowTracks.ts); nothing in the game reads it back, and it rolls no die (hashes of place and a running count).
//
//   · A PUSHED PROP (props.ts: a chair, a jerry can, a drum, a carton) — every part of it that reaches the floor ploughs its own furrow as it goes: a chair's four
//     legs four thin grooves cut to the floor, a drum's foot a trough as wide as itself that only a heavy one presses deep. Laid in strokes `step` long, cut as
//     the thing goes (a quick-forming mark), the loose snow it shoulders aside thrown about it.
//   · A THROWN THING (throwables.ts: a grenade, a can, a dropped magazine, a rifle let go) — a dent where it lands, as deep as it came down hard; a skid between
//     two landings close together; and the small pit it lies in when it stops.
//   · A PIECE OF DEBRIS (debris.ts: a door's panel, a chunk of wall, a table's leg) — a dent each time it comes down, and where it comes to rest.
//
// HOW HARD (`force`, the forming's and the kick's own scale — snowTracks.ts stampMark: a walker's boot about 0.45, a sprinter's 1.2, a blast 2): a prop's by its
// weight and how fast it is shoved; a thrown thing's and a chunk's by how fast it came down and how big it is. Harder = it forms faster, throws its lumps
// further and kicks more loose snow up. Only where snow lies (the field's cover, as a boot's print), only on the ground (not a thing lying on a desk or a roof).
//
// NOTHING LIVE SHOWS IN THE FOG (fogofwar.ts rule 4d; a boot's print is kept off the map and found later — snowTracks.ts FOG.tracks — which these are not): a thing on floor the team does not
// see marks nothing while it is there — a furrow growing across unseen ground is the chair somebody over there just knocked. It is not caught up afterwards.
import { SideMap, rollbackVar } from '../math/side';
import type { Game } from './game';
import type { Prop } from './props';
import type { Item } from './throwables';
import type { Chunk } from './debris';
import { snowFieldAt, type SnowField } from '../render/snowField';
import { stampMark, pressGroove, pressClods, hash3, type SnowTracks } from './snowTracks';

/** The marks' numbers (never seen on a GPU, never seen moving: the maintainer's to move; `__snow.marks` on the console, all LIVE — they reach the next mark).
 *  Authored data, not player switches. */
export const SNOWMARKS = {
  // ---- a pushed prop
  minV: 0.08,         // m/s: a thing moving slower than this cuts nothing new
  step: 0.05,         // m: a furrow is laid in strokes this long
  jump: 0.7,          // m: a thing found further than this from where it last was has been PUT there (a restart): no furrow between
  reach: 0.1,         // m: a part whose underside is within this of the floor reaches the snow
  leg: 0.07,          // m: a part no wider than this (half) either way is a LEG: it cuts to the floor whatever the thing weighs
  legMin: 0.028,      // m: a leg's groove is never thinner than this (half): the map's texel is 3 cm
  wide: 0.3,          // m: the widest stroke (half) a broad part ploughs with
  deepKg: 14,         // kg: a broad part presses to a boot's depth at this weight, and rides higher under it (a 3 kg chair's seat would: a fifth)
  mess: 0.7,          // 0‥1: how ragged a furrow's edges are (a print's own SNOWTRACKS.mess scale)
  clods: 1.6,         // lumps thrown aside per stroke, × force
  force0: 0.15,       // a thing's force: this …
  forceKg: 0.45,      // … + this × its weight ÷ deepKg (no more than 1) …
  forceV: 0.2,        // … + this × its speed in m/s (no more than 2)
  quick: 0.35,        // × the time a mark's floor takes to sink: a furrow is cut as the thing goes
  kickEvery: 0.14,    // m of travel between two kicks of loose snow off one thing
  // ---- a thrown thing, a piece of debris
  landV: 0.7,         // m/s: coming down slower than this it dents nothing (it was set down)
  roll: 0.15,         // m: a thing ROLLING over the snow lays its shallow groove in strokes this long …
  rollDeep: 0.35,     // … this deep of a boot's print (0‥1), with a walker's-toe of force
  dent: 1.5,          // × a thrown thing's own radius = its dent's
  least: 0.02,        // m: a dent smaller than this is not pressed (a spent case)
  most: 0.4,          // m: … and none is wider than this (half)
  skid: 0.6,          // m: two landings of one thing closer than this are joined by the groove it skidded
  rest: 1.15,         // × its radius: the pit a thrown thing lies in when it stops
  landForce: 0.15,    // a landing's force: this …
  landForceV: 0.13,   // … + this × how fast it came down, m/s …
  landForceR: 2.5,    // … + this × its size in m (so a grenade lobbed high lands about as hard as a sprinter's boot, a door's panel harder, a magazine hardly)
  itemMess: 0.5,      // 0‥1: how ragged a dent's lip is
  dentClods: 4,       // lumps thrown about a dent, × force
};

interface Seen { x: number; z: number; vy: number; sp: number; n: number; rest: boolean; mx: number; mz: number; marked: boolean; }
// (each is made afresh by clearSnowMarks, so none takes a name: the snapshot holds the VARIABLE, and finds the table that hangs off it now)
let propSeen = new SideMap<Prop, Float32Array>();
rollbackVar('snowMarks.propSeen', () => propSeen, v => { propSeen = v; });
let itemSeen = new SideMap<Item, Seen>();
rollbackVar('snowMarks.itemSeen', () => itemSeen, v => { itemSeen = v; });
let chunkSeen = new SideMap<Chunk, Seen>();
rollbackVar('snowMarks.chunkSeen', () => chunkSeen, v => { chunkSeen = v; });
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lies = (field: SnowField, x: number, z: number) => snowFieldAt(field, x, z).cover >= 0.5;

/** a restart: nothing has been seen */
export function clearSnowMarks() { propSeen = new SideMap(); itemSeen = new SideMap(); chunkSeen = new SideMap(); }

/** Once a frame, after the boots (game.ts stepSnowTracks; everything has moved): the things' marks. */
export function updateSnowMarks(g: Game, T: SnowTracks, field: SnowField, dt: number) {
  if (!(dt > 0)) return;
  const fog = g.fogOfWar, dark = fog && fog.active && !fog.bared ? (x: number, z: number) => !fog.spotSeen(x, z) : null;   // (null: no fog — everything is seen)
  propMarks(g, T, field, dark);
  thrownMarks(g, T, field, dark);
  chunkMarks(g, T, field, dark);
}
type Dark = ((x: number, z: number) => boolean) | null;

function propMarks(g: Game, T: SnowTracks, field: SnowField, dark: Dark) {
  const K = SNOWMARKS, list = g.props?.props; if (!list) return;
  for (const p of list) {
    const parts = p.def.parts, n = parts.length;
    let st = propSeen.get(p);
    if (!st) { st = new Float32Array(n * 2 + 1); for (let i = 0; i < n; i++) { st[i * 2] = p.boxes[i].c[0]; st[i * 2 + 1] = p.boxes[i].c[2]; } propSeen.set(p, st); continue; }
    if (p.asleep) continue;
    const hid = !!dark && dark(p.x, p.z);   // (out of the team's sight: where it has got to is kept, nothing is cut)
    const sp = p.speed + Math.abs(p.w) * p.radius;
    const heavy = clamp(p.mass / Math.max(0.1, K.deepKg), 0, 1), force = K.force0 + K.forceKg * heavy + K.forceV * Math.min(2, sp);
    // which parts have gone a stroke's length since their last
    let strokes: number[] | null = null, far = 0;
    for (let i = 0; i < n; i++) {
      const part = parts[i]; if (part.off[1] - part.h[1] > K.reach) continue;
      const b = p.boxes[i], x = b.c[0], z = b.c[2], lx = st[i * 2], lz = st[i * 2 + 1], d = Math.hypot(x - lx, z - lz);
      if (d < K.step) continue;
      st[i * 2] = x; st[i * 2 + 1] = z;
      if (hid || d > K.jump || sp < K.minV || !lies(field, x, z)) continue;
      (strokes ??= []).push(i, lx, lz); if (d > far) far = d;
    }
    if (!strokes) continue;
    const S = strokes, serial = T.marks++;
    st[n * 2] += far;
    let kick: { x: number; z: number; dx: number; dz: number; wide: number } | null = null;
    if (st[n * 2] >= K.kickEvery && sp > 1e-3) { st[n * 2] = 0; const ux = p.vx / Math.max(p.speed, 1e-3), uz = p.vz / Math.max(p.speed, 1e-3); kick = { x: p.x + ux * p.radius * 0.6, z: p.z + uz * p.radius * 0.6, dx: ux, dz: uz, wide: Math.max(0.1, p.radius * 0.7) }; }
    stampMark(T, force, (body, thrown) => {
      for (let k = 0; k < S.length; k += 3) {
        const i = S[k], part = parts[i], b = p.boxes[i], x = b.c[0], z = b.c[2], lx = S[k + 1], lz = S[k + 2];
        const along = part.h[0] >= part.h[2], long = Math.max(part.h[0], part.h[2]), short = Math.min(part.h[0], part.h[2]);
        if (long <= K.leg) { pressGroove(body, lx, lz, x, z, Math.max(K.legMin, short), Math.max(K.legMin, short), 1, K.mess * 0.6); }
        else {
          // a broad foot: its own footprint swept along, as a row of strokes down its long side
          const r = clamp(short, K.legMin, K.wide), run = Math.max(0, long - r), m = Math.min(5, 1 + Math.ceil(run / Math.max(r, 0.04)));
          const yaw = b.yaw, cs = Math.cos(yaw), sn = Math.sin(yaw), ax = along ? cs : sn, az = along ? -sn : cs;   // (the part's long side in the world: props.ts place())
          const deep = clamp(0.2 + 0.8 * heavy, 0.2, 1);
          for (let j = 0; j < m; j++) { const o = m > 1 ? (j / (m - 1) * 2 - 1) * run : 0; pressGroove(body, lx + ax * o, lz + az * o, x + ax * o, z + az * o, r, r, deep, K.mess); }
        }
        const nc = Math.round(K.clods * force * (0.5 + hash3(serial, i, 0x51))); if (nc > 0) pressClods(thrown, x, z, nc, Math.max(short, 0.05) + 0.03, Math.max(short, 0.05) + 0.1 + 0.12 * force, 0, 0, serial * 8 + i);
      }
    }, kick, K.quick);
  }
}

/** one thing's landing: the dent, the skid from its last one, the lumps about it and the snow it kicks up */
function land(T: SnowTracks, K: typeof SNOWMARKS, s: Seen, x: number, z: number, r: number, v: number, mess: number) {
  if (r < K.least) return;
  const rr = Math.min(r, K.most), force = K.landForce + K.landForceV * v + K.landForceR * rr, serial = T.marks++;
  const skid = s.marked && Math.hypot(x - s.mx, z - s.mz) < K.skid ? [s.mx, s.mz] : null;
  const deep = clamp(0.35 + 0.5 * force, 0.3, 1);
  stampMark(T, force, (body, thrown) => {
    if (skid) pressGroove(body, skid[0], skid[1], x, z, rr * 0.7, rr * 0.7, deep * 0.6, mess);
    pressGroove(body, x, z, x, z, rr, rr, deep, mess);
    const nc = Math.round(K.dentClods * force); if (nc > 0) pressClods(thrown, x, z, nc, rr + 0.03, rr + 0.08 + 0.2 * force, 0, 0, serial);
  }, { x, z, wide: Math.max(0.08, rr) });
  s.mx = x; s.mz = z; s.marked = true;
}

function thrownMarks(g: Game, T: SnowTracks, field: SnowField, dark: Dark) {
  const K = SNOWMARKS, items = g.items?.items; if (!items) return;
  for (const it of items) {
    const x = it.pos[0], z = it.pos[2];
    let s = itemSeen.get(it);
    if (!s) { itemSeen.set(it, { x, z, vy: it.vel[1], sp: Math.hypot(it.vel[0], it.vel[2]), n: it.bounces, rest: it.settled, mx: 0, mz: 0, marked: false }); continue; }
    const low = it.pos[1] - it.radius < K.reach && !it.on;
    if (low && lies(field, x, z) && !(dark && dark(x, z))) {
      // (a LANDING is "it was coming down and no longer is" — the pool's own bounce count also ticks on every half step of a roll, so it cannot be asked)
      const came = s.vy < -K.landV && it.vel[1] > s.vy * 0.5;
      if (came) land(T, K, s, x, z, it.radius * K.dent, Math.hypot(s.vy, s.sp * 0.4), K.itemMess);
      else if (it.settled && !s.rest) { const r = it.radius * K.rest; if (r >= K.least) { T.marks++; stampMark(T, 0.3, body => { if (s!.marked && Math.hypot(x - s!.mx, z - s!.mz) < K.skid) pressGroove(body, s!.mx, s!.mz, x, z, r * 0.7, r * 0.7, 0.4, K.itemMess); pressGroove(body, x, z, x, z, Math.min(r, K.most), Math.min(r, K.most), 0.6, K.itemMess * 0.6); }); s.mx = x; s.mz = z; s.marked = true; } }
      else if (!it.settled && s.marked && it.radius * 0.7 >= K.least) {
        // ROLLING on from its last mark: a shallow groove behind it, a stroke at a time (further off than a skid's reach it has been in the air: no groove across)
        const d = Math.hypot(x - s.mx, z - s.mz);
        if (d >= K.roll) { const r = Math.min(it.radius * 0.7, K.most), mx = s.mx, mz = s.mz; if (d < K.skid) { T.marks++; stampMark(T, 0.2, body => pressGroove(body, mx, mz, x, z, r, r, K.rollDeep, K.itemMess), null, K.quick); } s.mx = x; s.mz = z; }
      }
    }
    s.x = x; s.z = z; s.vy = it.vel[1]; s.sp = Math.hypot(it.vel[0], it.vel[2]); s.n = it.bounces; s.rest = it.settled;
  }
}

function chunkMarks(g: Game, T: SnowTracks, field: SnowField, dark: Dark) {
  const K = SNOWMARKS, list = g.destr?.debris?.list; if (!list) return;
  for (const c of list) {
    const b = c.box, x = b.c[0], z = b.c[2];
    let s = chunkSeen.get(c);
    if (!s) { chunkSeen.set(c, { x, z, vy: c.v[1], sp: Math.hypot(c.v[0], c.v[2]), n: 0, rest: c.rest, mx: 0, mz: 0, marked: false }); continue; }
    const h0 = b.h[0], h1 = b.h[1], h2 = b.h[2], hi = Math.max(h0, h1, h2), lo = Math.min(h0, h1, h2), mid = h0 + h1 + h2 - hi - lo;
    const low = b.c[1] < hi + K.reach && !c.on;
    if (low && lies(field, x, z) && !(dark && dark(x, z))) {
      const r = Math.sqrt(hi * mid);   // (it lies on its broad face)
      const came = s.vy < -K.landV && c.v[1] > s.vy * 0.5;   // (it was coming down and no longer is: it hit)
      if (came) land(T, K, s, x, z, r, Math.hypot(s.vy, s.sp * 0.4), K.itemMess);
      else if (c.rest && !s.rest && r >= K.least && !(s.marked && Math.hypot(x - s.mx, z - s.mz) < r * 0.5)) land(T, K, s, x, z, r, K.landV, K.itemMess);
    }
    s.x = x; s.z = z; s.vy = c.v[1]; s.sp = Math.hypot(c.v[0], c.v[2]); s.rest = c.rest;
  }
}
