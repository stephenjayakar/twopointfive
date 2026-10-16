// The 'cover' family — UNASKED COVER (src/game/cover.ts: while they follow, or hold with nothing named to watch, the teammates each take an opening an enemy
// could come through, with no order given), run through probes.ts:
//   bun run tools/qa/probes.ts cover | cover-openings | cover-walk | cover-halt | cover-order | cover-step | cover-side | cover-settle
// PASS / FAIL each, with counts, all headless (the Game of headless.ts under the room clear's staging, the four and the pair). The harness has no light meter and
// draws nothing: Sam is planted dark and in god mode, what anybody SEES of anybody is guards.ts's direct-light estimate, and "facing" is the gun's yaw, not a
// picture. The defenders are parked outside the building for the walks (the probes are about who watches what, not the fight) and brought back for cover-side.
//   cover-openings   what counts as an opening: the finder on four hand-made grids (a hole in a wall = one; a corridor with a side doorway = its two mouths and
//                    the doorway, not chopped at the doorway; a slot nothing blocks sight across = none; a blind nook = one once it is deep enough), then the
//                    office: every door, the two leafless doorways of the corridor wall, the lobby's way into the aisle, the gaps between the cubicle blocks
//   cover-walk       NO ORDERS but 'fall in', the four and then the pair: Sam walked down the cubicle aisle, in at the break room's west door, across the room,
//                    out at its north door and along the corridor. Counted: a door in reach of a free man is always on the live list; no free man stands idle
//                    beside an opening he could take for more than two seconds; a man is facing what he was dealt within two seconds; never two men on one
//                    opening; the rear (four: the last man's, counted against where he himself came from); cover re-dealt as they move (how many different
//                    openings were taken, none kept out of reach); the file's feet (nobody left behind, nobody inside anybody)
//   cover-halt       the squad stopped in the aisle: everybody on a different opening and squared up to it inside two seconds, the heaviest openings the ones
//                    taken, the way they came among them; then SAM'S OWN GUN put on a covered opening — it counts as his, and the man moves to one nobody has
//   cover-order      an order wins and cover comes back: 'stack up' on a door takes all four off their openings the frame it is given and for as long as it
//                    stands; an order to the red pair alone leaves blue still dealt; 'fall in' and every free man is on an opening again inside two seconds;
//                    the pair's plain 'hold' keeps them dealt where they stand; COVER.on false = nobody dealt, the followers' carriage the base's
//   cover-step       STEP TO SEE (COVER.step): for every door of the office that can be stood open with free floor behind its leaf, the pair stood behind the
//                    leaf with Sam, 'fall in' — with the switch off nobody ever has a line through the door (the before); on, a man steps to where he has
//                    one and is dealt the doorway itself, within COVER.stepM of where he stood, never in or across an opening, his mate left where he was;
//                    (three quarters of the stagings where the deal ASKED a man — a step begun, or its own 'no spot for any of them' — and it must ask in
//                    three quarters of all of them: where both men are on openings of their own that the door does not outweigh by COVER.sticky + 0.3 nobody
//                    is asked, counted apart; a free man with nothing left unasked, or a step that earns nobody the doorway, is a FAIL);
//                    Sam walks on and both fall in again; the same under a plain 'hold' (he is walked off a mark that stays put, nothing 'stopped short')
//   cover-side       an enemy steps out of a gap between the cubicle blocks beside the walking file: the same seeds with cover on and off (off = the commit
//                    this was built on: the seam returns the order's own pose) — how soon a teammate has eyes on him, how soon the first round goes
//                    (COVER_SIDE_FULL=1: 36 trials a squad instead of 12)
//   cover-settle     ONE JOB AT A TIME (cover.ts REAR). The rule itself, staged on a stack's rear man stood on his mark with the deal stopped and his job let
//                    go of by hand as the deal lets go of one: (a) with nothing else dealt his gun stays on the opening REAR.secs, then the door has it;
//                    (b) Sam stepping into its line takes it off at once; (c) dealt again 0.4 s on, the gun never starts for the door — and with the
//                    switch off it does. Round that, a non-regression walk: the four and then the pair walked to three doors and stacked on each, off
//                    and on — every stack has its rear man and he is dealt a rear, nobody twitches (playthrough.ts's arithmetic, copied: keep the two
//                    in step), the rear watched no less than nine tenths as long. Flicks to the door and back are PRINTED, not judged: a mate in the
//                    line or the gun told to run still takes it off at once, by the rule, and these short walks differ by one either way. (They do
//                    not reproduce the play-throughs' twitch: off and on can read the same here. The count that moved is the play-through one.)
import { standUp, ROOT } from './headless.ts';
const { NIGHTBREACH } = await import(`${ROOT}/src/game/nightbreach.ts`);
const { COVER, REAR, gapsOf } = await import(`${ROOT}/src/game/cover.ts`);
const { NVG } = await import(`${ROOT}/src/game/nvg.ts`);
const { START } = await import(`${ROOT}/src/game/startfile.ts`);   // (read, never set: cover-order and cover-step ask what the stand they are run on stages)

const DT = 1 / 60, DEG = Math.PI / 180;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : String(x)), f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x));
const at = (p: number[]) => `(${p[0].toFixed(1)}, ${p[2].toFixed(1)})`;
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const yawTo = (a: number[], b: number[]) => Math.atan2(b[0] - a[0], b[2] - a[2]);
const wrap = (x: number) => { while (x > Math.PI) x -= 2 * Math.PI; while (x < -Math.PI) x += 2 * Math.PI; return x; };
const pct = (a: number, b: number) => `${b ? Math.round(a / b * 100) : 0} %`;
const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const COVER_DEFAULTS = { ...COVER }, REAR_DEFAULTS = { ...REAR }, NB_DEFAULTS = { ...NIGHTBREACH }, NVG_ON = NVG.on;
/** every probe leaves the knob tables and the die as it found them, pass, fail or throw */
const guarded = (fn: () => Promise<boolean>) => async () => { const die = Math.random; try { return await fn(); } finally { Math.random = die; Object.assign(COVER, COVER_DEFAULTS); Object.assign(REAR, REAR_DEFAULTS); Object.assign(NIGHTBREACH, NB_DEFAULTS); NVG.on = NVG_ON; } };

/** where the defenders stand while a probe is about the squad alone: outside the north wall, out of everybody's sight */
const PARK = (i: number): number[] => [37.5 + (i % 2) * 0.8, 0, 1 + (i >> 1) * 0.9];
// the walk: down the cubicle aisle, in at the break room's west door, across the room, out at its north door, west along the corridor
const WALK: number[][] = [[13, 0, 17.6], [26.6, 0, 17.6], [29.6, 0, 17.6], [30.75, 0, 13.6], [30.75, 0, 11.0], [22, 0, 11.0]];

/** One game under a seed: the room clear staged with `squad` teammates, Sam in god mode and dark, 'fall in' NOT yet given. `park`: the defenders kept outside and
 *  dazzled (the walks); else they stand as dealt, dazzled (cover-side moves one by hand). */
async function rig(seed: number, squad: 2 | 4, park = true) {
  Object.assign(COVER, COVER_DEFAULTS); Object.assign(NIGHTBREACH, NB_DEFAULTS, { squad });
  Math.random = seeded(seed);
  const W: any = await standUp(); const game = W.game; const RC = game.roomClear, NB = game.nightBreach, O = game.orders, C = game.cover;
  game.godMode = true; RC.start(seed);
  const sam = game.player.char;
  const R = { W, game, NB, O, C, sam, pre: null as null | (() => void), post: null as null | (() => void), closest: Infinity, closestWho: '',
    get ops(): any[] { return NB.ops; }, get hostiles(): any[] { return NB.hostiles; },
    step(n = 1) {
      for (let i = 0; i < n; i++) {
        game.player.visibility = 0.05;
        NB.hostiles.forEach((h: any, k: number) => { if (h.state === 'dead') return; h.dazzledUntil = game.time + 5; if (park) { const p = PARK(k); h.char.pos[0] = p[0]; h.char.pos[2] = p[2]; h.char.vel[0] = h.char.vel[2] = 0; } });
        R.pre?.(); W.step(DT);
        const up = R.ops.filter((x: any) => x.state !== 'dead');
        for (let a = 0; a < up.length; a++) for (let b = a + 1; b < up.length; b++) { const dd = dist(up[a].char.pos, up[b].char.pos); if (dd < R.closest) { R.closest = dd; R.closestWho = `${up[a].callsign} / ${up[b].callsign} at ${f1(game.time)} s`; } }
        R.post?.();
      }
    },
    until(pred: () => boolean, secs: number) { for (let i = 0; i < secs * 60 && !pred(); i++) R.step(); return pred(); },
    door(name: string): any { return game.doors.list.find((d: any) => d.def.name === name); },
    fallIn() { O.give('fallIn', O.targetAt(sam.pos)); },
    /** Sam walked (set down a step at a time, his reticle ahead of him) along the nav path through `legs` at `speed`; returns when he is there */
    walk(legs: number[][], speed = 1.55, secs = 120) {
      const path: number[][] = [[sam.pos[0], 0, sam.pos[2]]];
      for (const p of legs) { const leg = game.col.nav.findPath(path[path.length - 1], p); for (const q of leg ?? []) path.push([q[0], 0, q[2]]); path.push(p); }
      let seg = 0, t = 0; const was = R.pre;
      // (one-way doors: Sam cannot be set down through a latched leaf as he could be walked into a double-acting one — he works a shut door on his way as a
      //  player does, a use at the frame, and walks on once the leaf is clear of him; it stands where he left it for the file behind. Two-way doors: as recorded.)
      let opened: any = null, waited = 0; const oneWay = game.doors.list.length > 0 && game.doors.swingOf(game.doors.list[0]).oneWay;
      R.pre = () => { was?.(); if (seg >= path.length - 1) return; let left = speed * DT;
        if (oneWay) {
          if (opened) { if (Math.abs(opened.angle) < 1.2 && ++waited < 180) return; opened = null; }
          const A0 = path[seg], B0 = path[seg + 1], L0 = dist(A0, B0) || 1, hx = (B0[0] - A0[0]) / L0, hz = (B0[2] - A0[2]) / L0;
          for (const d of game.doors.list) { const fc = d.frameCentre, dx = fc[0] - sam.pos[0], dz = fc[2] - sam.pos[2]; if (d.off || !d.isClosed() || Math.hypot(dx, dz) > 1.1 || dx * hx + dz * hz < 0.5) continue;
            game.doors.use(d, sam.pos, 1, game.player.keys); opened = d; waited = 0; return; }
        }
        while (left > 0 && seg < path.length - 1) { const A = path[seg], B = path[seg + 1], L = dist(A, B); if (L - t <= left) { left -= L - t; seg++; t = 0; } else { t += left; left = 0; } }
        const A = path[seg], B = path[Math.min(seg + 1, path.length - 1)], L = dist(A, B) || 1, f = seg >= path.length - 1 ? 0 : t / L;
        const p = [A[0] + (B[0] - A[0]) * f, 0, A[2] + (B[2] - A[2]) * f]; game.teleportPlayer(p); W.cursorAt([p[0] + (B[0] - A[0]) / L * 4, 1.1, p[2] + (B[2] - A[2]) / L * 4]); };
      const ok = R.until(() => seg >= path.length - 1, secs); R.pre = was; return ok;
    },
    /** the men cover.ts would deal to right now, by this file's own reading of the orders: alive, under 'fall in' or a 'hold' naming nothing, not in a fight */
    free(): any[] { return R.ops.filter((m: any) => { const A = O.of(m); return m.state !== 'dead' && !!m.script && A && (A.order === 'fallIn' || (A.order === 'hold' && !A.watch)) && !game.fight.engaged(m); }); },
    job(m: any): any { return C.of(m); },
    jobs(): string { return R.ops.map((m: any) => `${m.callsign} ${C.of(m) ? C.nameOf(C.of(m).o) : '—'}`).join(' · '); },
  };
  R.step(30);
  return R;
}

// ---------------------------------------------------------------- cover-openings
function grid(W: number, H: number, wall: (u: number, v: number) => boolean) { const blocked = new Uint8Array(W * H); for (let v = 0; v < H; v++) for (let u = 0; u < W; u++) if (wall(u, v)) blocked[v * W + u] = 1; return { W, H, cell: 0.5, blocked }; }
export const coverOpenings = guarded(async () => {
  const { verdict, done } = family('cover-openings: a door, a doorway, a gap between partitions, the mouth of an aisle — and nothing else');
  const both = (nav: any, K = COVER, solid?: any) => [...gapsOf(nav, true, K, solid), ...gapsOf(nav, false, K, solid)];
  const list = (l: any[]) => l.map((o: any) => `${o.kind} ${at(o.at)}`).join(', ') || 'none';
  // a wall across the floor with a hole two cells wide
  { const l = both(grid(20, 20, (u, v) => v === 10 && u !== 8 && u !== 9));
    verdict(l.length === 1 && l[0].kind === 'gap' && Math.abs(l[0].at[0] - 4.5) < 0.01 && Math.abs(l[0].at[2] - 5.25) < 0.01 && l[0].n[1] === 1, 'a hole in a wall is ONE opening, at the hole, facing through it', list(l)); }
  // a corridor three cells wide, sixteen long, open at both ends, with a one-cell doorway in its far wall
  { const nav = grid(20, 20, (u, v) => (v === 4 || v === 8) && u >= 2 && u <= 17 && !(v === 8 && u === 10));
    const l = both(nav), m = l.filter((o: any) => o.kind === 'mouth'), g = l.filter((o: any) => o.kind === 'gap');
    const chopped = both(nav, { ...COVER, bridge: 0 });
    verdict(l.length === 3 && m.length === 2 && m[0].pass !== null && m[0].pass === m[1].pass && Math.abs(Math.abs(m[0].at[0] - m[1].at[0]) - 7.5) < 0.01 && g.length === 1 && Math.abs(g[0].at[0] - 5.25) < 0.01 && Math.abs(g[0].at[2] - 4.25) < 0.01 && chopped.length > 3,
      'a corridor with a side doorway: its two mouths (one passage) and the doorway — the corridor is not cut in two where the doorway widens it', `${list(l)} · passage ${m[0]?.pass} · with no bridging: ${chopped.length} (${list(chopped)})`); }
  // the same hole, but nothing that blocks SIGHT bounds it (a slot between a desk and a table)
  { const nav = grid(20, 20, (u, v) => v === 10 && u !== 8 && u !== 9); const l = both(nav, COVER, () => false), l2 = both(nav, COVER, () => true);
    verdict(l.length === 0 && l2.length === 1, 'a slot between things a man can be seen over is no opening', `sight open across both sides: ${l.length} · shut: ${l2.length}`); }
  // a blind nook two cells wide: four deep is worth a gun, two deep is not
  { const nook = (deep: number) => both(grid(20, 20, (u, v) => v >= 10 && v < 10 + deep + 1 && !(u >= 8 && u <= 9 && v < 10 + deep)));
    const d4 = nook(4), d2 = nook(2);
    verdict(d4.length === 1 && d4[0].kind === 'mouth' && d4[0].pass === null && Math.abs(d4[0].at[2] - 5.25) < 0.01 && d2.length === 0, 'a blind nook has a mouth once it is deep enough to hide a man', `four deep: ${list(d4)} · two deep: ${list(d2)}`); }
  // the office
  const R = await rig(3, 4); const g = R.game, C = R.C; C.build();
  const O: any[] = C.openings, doors = O.filter(o => o.kind === 'door'), gaps = O.filter(o => o.kind === 'gap'), mouths = O.filter(o => o.kind === 'mouth');
  const names = g.doors.list.map((d: any) => d.def.name);
  verdict(doors.length === names.length && names.every((n: string) => doors.some(o => o.id === `door:${n}` && dist(o.at, o.door.frameCentre) < 0.01)), 'every door of the level is an opening, at its frame, open or shut', `${doors.length} of ${names.length}: ${names.join(', ')}`);
  const has = (p: number[], kinds: string[]) => O.some(o => kinds.includes(o.kind) && dist(o.at, p) < 0.8);
  const WANT: [string, number[], string[]][] = [['the corridor wall\'s west doorway', [15.75, 0, 12.25], ['gap']], ['the corridor wall\'s east doorway', [22.75, 0, 12.25], ['gap']], ['the lobby\'s way into the aisle', [12.0, 0, 18.8], ['gap']],
    ['the gap north of the aisle at x 19.75', [19.75, 0, 16.25], ['mouth']], ['the gap south of the aisle at x 19.75', [19.75, 0, 19.75], ['mouth']], ['the gap north of the aisle at x 26.75', [26.6, 0, 15.75], ['mouth']], ['the gap south of the aisle at x 26.75', [26.75, 0, 19.75], ['mouth']]];
  const miss = WANT.filter(w => !has(w[1], w[2]));
  verdict(miss.length === 0, 'the office\'s leafless ways are found off the floor plan alone: the corridor wall\'s two doorways, the lobby\'s way into the aisle, the gaps between the cubicle blocks', `${WANT.length - miss.length} of ${WANT.length}${miss.length ? ` — missing: ${miss.map(w => w[0]).join(', ')}` : ''} · ${gaps.length} gaps, ${mouths.length} mouths in all`);
  // nothing in the open: every gap and mouth is a narrow place (blocked floor within its half-width + a cell on both sides across it), on free floor, and none twice
  const nav = g.col.nav; const narrow = (o: any) => { const tx = -o.n[1], tz = o.n[0]; const hit = (s: number) => { for (let r = 0.25; r <= o.half + 0.75; r += 0.25) if (nav.isBlocked(o.at[0] + tx * s * r, o.at[2] + tz * s * r)) return true; return false; }; return hit(1) && hit(-1); };
  const open = [...gaps, ...mouths], wide = open.filter(o => !narrow(o)), onWall = open.filter(o => nav.isBlocked(o.at[0], o.at[2]));
  let twice = 0; for (let i = 0; i < O.length; i++) for (let j = i + 1; j < O.length; j++) if (dist(O[i].at, O[j].at) < 0.6) twice++;
  verdict(wide.length === 0 && onWall.length === 0 && twice === 0 && O.length <= 60, 'nothing in the open floor is called an opening, none stands in a wall, none is counted twice', `${open.length} gaps and mouths: ${wide.length} not between two blocked sides${wide.length ? ` (${wide.map(o => at(o.at)).join(' ')})` : ''}, ${onWall.length} on blocked floor, ${twice} doubled · ${O.length} openings on the level`);
  return done();
});

// ---------------------------------------------------------------- cover-walk
interface WalkCount { frames: number; doorSeen: number; doorLive: number; doorMiss: string[]; snaps: number; snapMax: number; snapWho: string; offFrames: number; idleMax: number; idleWho: string; idleFrames: number; jobs2: number; faced2: number; jobFrames: number; faceFrames: number; manFrames: number;
  doubles: number; rearFrames: number; rearOn: number; taken: Set<string>; stale: number; uncovered: number; samples: number; topOn: number; topN: number; backFrames: number; worstLag: number; lagWho: string }
/** watch a rig for as long as `run` takes: every frame's bookkeeping for the walk's verdicts */
function watch(R: Awaited<ReturnType<typeof rig>>, run: () => void): WalkCount {
  const { game: g, C, O, sam } = R; const K = COVER;
  const N: WalkCount = { frames: 0, doorSeen: 0, doorLive: 0, doorMiss: [], snaps: 0, snapMax: 0, snapWho: '', offFrames: 0, idleMax: 0, idleWho: '', idleFrames: 0, jobs2: 0, faced2: 0, jobFrames: 0, faceFrames: 0, manFrames: 0, doubles: 0, rearFrames: 0, rearOn: 0, taken: new Set(), stale: 0, uncovered: 0, samples: 0, topOn: 0, topN: 0, backFrames: 0, worstLag: 0, lagWho: '' };
  const inReach = new Map<any, number>();
  const cur = new Map<any, { id: string; t0: number; faced: boolean; counted: boolean }>(), idle = new Map<any, number>(), aimWas = new Map<any, number | undefined>(), hist = new Map<any, { t: number; p: number[] }[]>();
  const was = R.post;
  R.post = () => {
    was?.(); N.frames++;
    const free = R.free(), bodies: number[][] = [...R.ops.filter((m: any) => m.state !== 'dead').map((m: any) => m.char.pos), sam.pos];
    // ---- each man's job: facing it inside two seconds of taking it
    const ids: string[] = [];
    R.ops.forEach((m: any, i: number) => {
      const J = C.of(m), c = cur.get(m); N.manFrames++;
      const lag = dist(m.char.pos, sam.pos) - (i + 1) * 1.2; if (lag > N.worstLag) { N.worstLag = lag; N.lagWho = `${m.callsign} ${at(m.char.pos)}, Sam ${at(sam.pos)}, ${f1(g.time)} s`; }
      // (the gun TRAVELS to a new opening: the most it turns in one frame while he has a job, and how often it is off its job with his order running him on)
      const yaw0 = aimWas.get(m); aimWas.set(m, J && !J.off && m.script?.aimAt === J.aim ? m.char.aimYaw : undefined);
      if (aimWas.get(m) !== undefined && yaw0 !== undefined) { const dy = Math.abs(wrap(m.char.aimYaw - yaw0)) / DEG; if (dy > N.snapMax) { N.snapMax = dy; N.snapWho = `${m.callsign} at ${f1(g.time)} s`; } if (dy > 45) N.snaps++; }
      if (J?.off) N.offFrames++;
      if (!J) { cur.delete(m); return; }
      ids.push(J.o.id); N.taken.add(J.o.id); N.jobFrames++; if (J.back) N.backFrames++;
      const facing = C.facing(m, 20); if (facing) N.faceFrames++;
      let e = c; if (!e || e.id !== J.o.id) { e = { id: J.o.id, t0: g.time, faced: false, counted: false }; cur.set(m, e); }
      if (facing && g.time - e.t0 <= 2) e.faced = true;
      if (!e.counted && g.time - e.t0 >= 2) { e.counted = true; N.jobs2++; if (e.faced) N.faced2++; }
      if (J.o.kind !== 'rear' && Math.min(...bodies.map(b => dist(b, J.o.at))) > K.reach + 1) N.stale++;
    });
    if (new Set(ids).size !== ids.length) N.doubles++;
    // ---- a free man with nothing, beside a live opening nobody has that he could take
    for (const m of R.ops) {
      const spare = free.includes(m) && !C.of(m) && C.live.some((L: any) => !L.by && !L.sam && !L.held && L.can.includes(m));
      const n = spare ? (idle.get(m) ?? 0) + 1 : 0; idle.set(m, n); if (spare) N.idleFrames++;
      if (n > N.idleMax) { N.idleMax = n; const L = C.live.find((L: any) => !L.by && !L.sam && !L.held && L.can.includes(m)); N.idleWho = `${m.callsign} ${at(m.char.pos)} beside ${C.nameOf(L.o)} at ${f1(g.time)} s`; }
    }
    // ---- the rear: the last man of a file of three or more, on the move — is what he is on back the way HE came (where he stood two seconds ago)?
    const file = free.filter((m: any) => O.of(m).post === null).sort((a: any, b: any) => O.of(a).follow - O.of(b).follow), last = file[file.length - 1];
    for (const m of R.ops) { const h = hist.get(m) ?? []; h.push({ t: g.time, p: [...m.char.pos] }); while (h.length && g.time - h[0].t > 2) h.shift(); hist.set(m, h); }
    if (last && file.length >= K.rearFrom) { const h = hist.get(last)!; const moved = dist(h[0].p, last.char.pos);
      if (moved > 1.5 && g.time - h[0].t > 1.9) { N.rearFrames++; const J = C.of(last); if (J && Math.abs(wrap(yawTo(last.char.pos, J.o.at) - yawTo(last.char.pos, h[0].p))) < 80 * DEG) N.rearOn++; } }
    // ---- every quarter second: this file's own reading of which DOORS are in reach, against the live list; what is left uncovered; is the heaviest taken
    if (N.frames % 15 !== 0) return;
    N.samples++; N.uncovered += C.live.filter((L: any) => !L.by && !L.sam && !L.held).length;
    const open = C.live.filter((L: any) => !L.sam && !L.held); if (open.length) { N.topN++; if (open[0].by) N.topOn++; }
    for (const d of g.doors.list) {
      const fc = d.frameCentre, th = d.def.closedDir, nx = -Math.sin(th), nz = Math.cos(th);
      let pos = false, neg = false; for (const b of bodies) { if (dist(b, fc) > 2.5 + 0.4) continue; if ((b[0] - fc[0]) * nx + (b[2] - fc[2]) * nz >= 0) pos = true; else neg = true; }
      const can = !bodies.some(b => dist(b, fc) < K.inM + 0.4) && !(pos && neg) && free.some((m: any) => { const p = m.char.pos, dd = dist(p, fc); if (dd < K.inM + 0.4 || dd > K.reach - 0.6) return false;
        const v = m.char.vel, sp = Math.hypot(v[0], v[2]), Jm = C.of(m); if (Math.max(sp, Jm?.pace ?? 0) > (Jm?.back ? K.backOut : K.backIn) - 0.4 && sp > 0.3 && Math.abs(wrap(yawTo(p, fc) - Math.atan2(v[0], v[2]))) > K.twist - 0.25) return false;   // (running with it behind him: not his)
        const k = 1 - 0.7 / dd; if (g.col.segmentBlocked([p[0], 1.55, p[2]], [p[0] + (fc[0] - p[0]) * k, 1.1, p[2] + (fc[2] - p[2]) * k])) return false;
        if (K.leaf && Math.abs(d.angle) >= 0.3 && g.col.segmentBlocked([p[0], 1.55, p[2]], [fc[0], 1.1, fc[2]])) return false;   // (standing open, seen from behind its leaf: not a doorway he can watch — COVER.leaf; a margin under the game's 0.5 rad)
        const fx = (fc[0] - p[0]) / dd, fz = (fc[2] - p[2]) / dd;   // nobody of ours anywhere near the line (well clear of COVER.lane)
        return !bodies.some(b => { if (b === p) return false; const sx = b[0] - p[0], sz = b[2] - p[2], al = sx * fx + sz * fz; return al > -0.2 && al < dd + 0.2 && Math.abs(sx * fz - sz * fx) < K.lane + 0.35; }); });
      // (the list is the last deal's, up to a quarter second old: a door counts once it has been in reach for three samples running)
      const run = can ? (inReach.get(d) ?? 0) + 1 : 0; inReach.set(d, run); if (run < 3) continue;
      N.doorSeen++; if (C.live.some((L: any) => L.o.door === d)) N.doorLive++; else if (N.doorMiss.length < 4) N.doorMiss.push(`${d.def.name} at ${f1(g.time)} s`);
    }
  };
  run(); R.post = was; return N;
}
async function walkProbe(squad: 2 | 4, verdict: Verdict) {
  const tag = squad === 4 ? 'the four' : 'the pair';
  const R = await rig(3, squad); const { C, O, sam } = R;
  R.fallIn(); R.step(120);
  const given = O.log.length;
  let ok = false; const N = watch(R, () => { ok = R.walk(WALK); R.step(180); });
  const orders = O.log.length - given;
  verdict(ok && orders === 0 && N.frames > 60 * 20, `${tag}: walked down the cubicle aisle, through the break room and out along the corridor with no order given but the first 'fall in'`, `${f1(N.frames / 60)} s · ${orders} orders after it · Sam at ${at(sam.pos)}`);
  verdict(N.doorSeen > 20 && N.doorLive === N.doorSeen, `${tag}: a door in reach of a free man (in his sight, nobody of ours in the line or in the doorway) is always on the list of openings to cover`, `${N.doorLive} of ${N.doorSeen} door sightings, sampled four times a second${N.doorMiss.length ? ` — missed: ${N.doorMiss.join(', ')}` : ''}`);
  verdict(N.idleMax <= 120, `${tag}: no free man stands with nothing while an opening he could take has nobody — never for two seconds`, `longest ${f2(N.idleMax / 60)} s${N.idleWho ? ` (${N.idleWho})` : ''} · ${N.idleFrames} man-frames of ${N.manFrames} in all (${pct(N.idleFrames, N.manFrames)})`);
  verdict(N.jobs2 >= (squad === 4 ? 12 : 6) && N.faced2 >= N.jobs2 * 0.95, `${tag}: a man has his gun on the opening he was dealt within two seconds of being dealt it`, `${N.faced2} of ${N.jobs2} openings held two seconds or longer · gun within 20° of it ${pct(N.faceFrames, N.jobFrames)} of the time a man has one · a man has one ${pct(N.jobFrames, N.manFrames)} of the walk · walking backwards or sideways for it ${pct(N.backFrames, N.jobFrames)}`);
  verdict(N.doubles === 0, `${tag}: never two men on one opening`, `${N.doubles} frames of ${N.frames}`);
  if (squad === 4) verdict(N.rearFrames > 300 && N.rearOn >= N.rearFrames * 0.8, 'the four: the rear is the last man\'s — on the move he is on something back the way he came', `${N.rearOn} of ${N.rearFrames} moving frames (${pct(N.rearOn, N.rearFrames)}) within 80° of where he stood two seconds before`);
  else console.log(`    (the pair has no man to spare for the rear: it is weighed with the rest — the nearest and heaviest two are taken, see cover-halt)`);
  verdict(N.taken.size >= (squad === 4 ? 10 : 6) && N.stale === 0, `${tag}: cover is re-dealt as the squad moves — openings passed are let go, the next ones taken`, `${N.taken.size} different openings taken over the walk (${C.stats.takes} takes, ${C.stats.swaps} changes) · ${N.stale} man-frames on one out of reach · on average ${f1(N.uncovered / Math.max(1, N.samples))} live openings with nobody on them (more ways in than men) · the heaviest of them all taken ${pct(N.topOn, N.topN)} of the time`);
  const end = R.ops.map((m: any) => dist(m.char.pos, sam.pos));
  verdict(N.snaps === 0, `${tag}: a gun travels onto a new opening — it never jumps more than 45° in a frame while its man has one`, `${N.snaps} jumps · the most in one frame ${f1(N.snapMax)}° (${N.snapWho}) · ${N.offFrames} of ${N.jobFrames} job frames with his order running him on and the opening behind him (the next deal takes it off him)`);
  verdict(end.every((d: number, i: number) => d < 2.2 + i * 1.3) && R.closest > 0.3 && N.worstLag < 3.2, `${tag}: the file keeps its feet — nobody left behind, nobody inside anybody`, `at the end ${end.map(f1).join(' / ')} m from Sam · furthest behind his place ${f2(N.worstLag)} m (${N.lagWho}) · closest two men ${f2(R.closest)} m (${R.closestWho})`);
  console.log(`    ${C.summary()}`);
}
export const coverWalk = guarded(async () => {
  const { verdict, done } = family('cover-walk: no orders — the four, then the pair, through the cubicle office and a room behind a door');
  await walkProbe(4, verdict); await walkProbe(2, verdict);
  return done();
});

// ---------------------------------------------------------------- cover-halt
export const coverHalt = guarded(async () => {
  const { verdict, done } = family('cover-halt: stopped, everybody squares up to a different opening — and Sam\'s own gun counts');
  for (const squad of [4, 2] as const) {
    const tag = squad === 4 ? 'the four' : 'the pair';
    const R = await rig(3, squad); const { C, O, sam, game: g } = R;
    R.fallIn(); R.step(120); R.walk([[13, 0, 17.6], [20.6, 0, 17.6]]);
    const t0 = g.time; R.W.cursorAt([sam.pos[0] + 4, 1.1, sam.pos[2]]);   // Sam looks on down the aisle
    // a man is SET when he is squared up to the opening he was dealt, gun on it, feet still — or has none because nothing with nobody on it is his to take (the
    // file itself is in his line to everything left: cover.ts deals nobody an opening he would have to cover through one of his own)
    const boxed = (m: any) => !C.of(m) && !C.live.some((L: any) => !L.by && !L.sam && L.can.includes(m));
    const set = (m: any) => { const J = C.of(m); return J ? Math.abs(wrap(yawTo(m.char.pos, J.o.at) - m.char.aimYaw)) < 10 * DEG && Math.abs(wrap(yawTo(m.char.pos, J.o.at) - m.char.bodyYaw)) < 30 * DEG && m.speed < 0.2 : boxed(m); };
    const got = R.until(() => R.ops.every(set) && C.live.length > 0, 4); const took = g.time - t0; R.step(60);
    const withJob = R.ops.filter((m: any) => C.of(m)), ids = withJob.map((m: any) => C.of(m).o.id), distinct = new Set(ids).size === ids.length, box = R.ops.filter(boxed);
    verdict(got && took <= 3 && distinct && withJob.length >= squad - 1 && R.ops.every(set), `${tag}: stopped in the aisle, every man with a clear line to something is squared up to an opening of his own, gun on it`, `${f2(took)} s after Sam stopped · ${R.jobs()}${box.length ? ` · boxed in by the file, nothing in a clear line: ${box.map((m: any) => m.callsign).join(', ')}` : ''}`);
    // the heaviest openings are the ones taken: nothing left with nobody on it outweighs one a man has by more than his hold on it (COVER.sticky, in weight)
    const open = C.live.filter((L: any) => !L.by && !L.sam && !L.held), mine = C.live.filter((L: any) => L.by);
    const worse = open.filter((L: any) => mine.some((M: any) => L.can.includes(M.by) && L.w > M.w + COVER.sticky / 10 + 0.02));
    verdict(mine.length === withJob.length && worse.length === 0, `${tag}: with more ways in than men, the nearest are the ones taken`, `taken: ${mine.map((L: any) => `${C.nameOf(L.o)} ${f2(L.w)}`).join(', ')} · left: ${open.map((L: any) => `${C.nameOf(L.o)} ${f2(L.w)}${L.can.length ? '' : ' (nobody has a clear line)'}`).join(', ') || 'none'}`);
    // the way they came: somebody's opening is behind the file (the squad came from the west)
    const back = R.ops.filter((m: any) => { const J = C.of(m); return J && Math.abs(wrap(yawTo(m.char.pos, J.o.at) - (-Math.PI / 2))) < 75 * DEG; });
    if (squad === 4) verdict(back.length >= 1 && back.includes(R.ops[R.ops.length - 1]), 'the four: the last man is on the way they came', `looking back west: ${back.map((m: any) => m.callsign).join(', ') || 'nobody'}`);
    else console.log(`    the pair, looking back west: ${back.map((m: any) => m.callsign).join(', ') || 'nobody'} (two men, ${C.live.length} ways in: nearest first)`);
    // SAM'S OWN GUN: put on an opening a man has, with another going spare he could take — it is Sam's now, the man's is the spare one
    let tried = 0, moved = 0, marked = 0; const said: string[] = [];
    for (const m of R.ops.slice(0, 3)) {
      const J = C.of(m); if (!J || J.o.kind === 'rear') continue;
      const spare = C.live.some((L: any) => !L.by && !L.sam && L.can.includes(m)); if (!spare) continue;
      if (g.col.segmentBlocked([sam.pos[0], 1.55, sam.pos[2]], J.o.at)) continue;
      tried++; const was = J.o; R.W.cursorAt([was.at[0], 1.1, was.at[2]]); R.step(120);
      const L = C.live.find((x: any) => x.o === was); if (L?.sam) marked++; const now = C.of(m)?.o ?? null; if (now && now !== was) moved++;
      said.push(`${m.callsign}: ${C.nameOf(was)} → ${now ? C.nameOf(now) : '—'}${L?.sam ? ' (Sam\'s)' : ''}`);
      R.W.cursorAt([sam.pos[0] + 4, 1.1, sam.pos[2]]); R.step(90);
    }
    if (squad === 2) verdict(tried >= 1 && marked === tried && moved === tried, 'Sam\'s own gun on an opening counts as covering it: the man who had it takes one nobody has', `${moved} of ${tried} moved, ${marked} marked as Sam's · ${said.join(' · ')}`);
    else console.log(`    Sam's gun on a covered opening, the four: ${tried ? `${moved} of ${tried} moved · ${said.join(' · ')}` : 'no man here has a spare opening in a clear line to move to'}`);
  }
  return done();
});

// ---------------------------------------------------------------- cover-order
export const coverOrder = guarded(async () => {
  const { verdict, done } = family('cover-order: an order wins, and cover comes back with no word');
  const R = await rig(3, 4); const { C, O, sam, game: g } = R;
  COVER.stacked = false;   // (the plain contract first — an order has every man it names; the rear man of a stack, COVER.stacked, is checked at the end)
  const dealt = () => R.ops.filter((m: any) => C.of(m)).length;
  // nobody is dealt anything before the squad is Sam's (no order = no 'fall in' yet: the men wait where they were staged)
  // … where the team starts fallen in (startfile.ts START.fallIn, as the page opens) the squad IS Sam's from the staging: all four hold the menu's own 'fall in',
  // unspoken, so they follow with no other order before a word is said and cover is theirs already. What the line asks there: every man holds that order, nobody
  // is dealt who does not, and a man with nothing has nothing left that is his to take — the same four dealt after the walk
  const boxed = (m: any) => !C.of(m) && !C.live.some((L: any) => !L.by && !L.sam && L.can.includes(m));   // (nothing left that is his to take: the file is in his line to all of it)
  R.step(60); const before = dealt();
  const under0 = R.ops.filter((m: any) => O.of(m)?.order === 'fallIn').length, stray = R.ops.filter((m: any) => C.of(m) && O.of(m)?.order !== 'fallIn').length, spare0 = R.ops.filter((m: any) => !C.of(m) && !boxed(m)).length;
  const quiet = START.fallIn ? under0 === 4 && stray === 0 && spare0 === 0 && before >= 1 : before === 0;
  R.fallIn(); R.step(120); R.walk([[13, 0, 17.6]]); R.walk([[19.0, 0, 11.0]]); R.step(120);
  const following = dealt(), rows = () => O.hud().status[0]?.opts.slice(0, 4).map((o: any) => o.text) ?? [];
  const r0 = rows();
  verdict(quiet && following === 4 && r0.every((t: string) => / · on /.test(t)), 'following with no other order, all four are dealt an opening — and the squad block says which', `${START.fallIn ? `fallen in from the staging, ${under0} of 4 under 'fall in' with nothing said: ${before} dealt, ${stray} dealt with no such order, ${spare0} with nothing beside an opening that is his to take` : `before 'fall in': ${before} dealt`} · after: ${following} · ${r0.join(' | ')}`);
  // an order to everybody: stack up on the server door
  const server = R.door('server'); O.give('stack', O.targetAt(server.frameCentre)); R.step(1);
  const at1 = dealt(); let most = 0; for (let i = 0; i < 60 * 5; i++) { R.step(); most = Math.max(most, dealt()); }
  const on = R.ops.filter((m: any) => O.of(m)?.order === 'stack').length, r1 = rows();
  verdict(at1 === 0 && most === 0 && on === 4 && r1.every((t: string) => !/ · on /.test(t)), 'stack up on a door: the order has all four the frame it is given, and for as long as it stands', `dealt the frame after: ${at1} · the most over the next 5 s: ${most} · ${on} under 'stack' · ${r1.join(' | ')}`);
  // … back with no word but 'fall in'
  R.fallIn(); const t0 = g.time; const back = R.until(() => dealt() >= 3 && R.ops.every((m: any) => C.of(m) ? C.facing(m, 20) : boxed(m)), 4); const took = g.time - t0;
  verdict(back && took <= 2.5, 'fall in again: every man with a clear line to something is back on an opening of his own, gun on it, with nothing asked', `${f2(took)} s · ${R.jobs()}${R.ops.some(boxed) ? ` · boxed in by the file in the corridor: ${R.ops.filter(boxed).map((m: any) => m.callsign).join(', ')}` : ''}`);
  // an order to the red pair alone: blue is still dealt
  O.give('stack', O.targetAt(server.frameCentre), 'red'); R.step(1);
  let redMost = 0, blueLeast = 9, blueFrames = 0; for (let i = 0; i < 60 * 5; i++) { R.step(); const red = R.ops.filter((m: any) => O.pairOf(m) === 'red' && C.of(m)).length, blue = R.ops.filter((m: any) => O.pairOf(m) === 'blue' && C.of(m)).length; redMost = Math.max(redMost, red); if (i > 90) { blueLeast = Math.min(blueLeast, blue); blueFrames++; } }
  verdict(redMost === 0 && blueLeast >= 1, 'an order to the red pair alone: red is the order\'s, blue is still watching openings', `red dealt at most ${redMost} · blue never fewer than ${blueLeast} of 2 over ${f1(blueFrames / 60)} s · ${R.jobs()}`);
  // … and with REAR SECURITY on (as shipped): a stack's last men — the last two of four, the second of a pair — are dealt an opening or the way they came,
  // but only from their last steps to the mark on; the men at the jambs are the order's and stay on the door
  { COVER.stacked = true; R.fallIn(); R.step(120);
    const spare = (m: any) => !!O.of(m)?.spare, far = (m: any) => { const A = O.of(m); return !!A?.post && dist(m.char.pos, A.post) > COVER.rearWalkM + 0.3; };
    O.give('stack', O.targetAt(server.frameCentre)); R.step(1);
    let jamb = 0, early = 0, rear = 0; const watch = (n: number) => { for (let i = 0; i < n; i++) { R.step(); for (const m of R.ops) { if (!C.of(m) || O.of(m)?.order !== 'stack') continue; if (!spare(m)) jamb++; else if (far(m)) early++; } rear = Math.max(rear, R.ops.filter((m: any) => spare(m) && C.of(m)).length); } };
    watch(60 * 8); const nSpare = R.ops.filter(spare).length, on = R.ops.filter((m: any) => O.of(m)?.order === 'stack').length, jobs1 = R.jobs();
    verdict(on === 4 && nSpare === 2 && jamb === 0 && early === 0 && rear >= 1, 'rear security on: of four stacked, the last two watch an opening or the way they came — never the men at the jambs, and never before the last steps to the mark', `${on} under 'stack' · ${nSpare} with spare eyes · frames a jamb man was dealt: ${jamb} · frames a rear man was dealt more than ${COVER.rearWalkM} m from his mark: ${early} · rear men dealt at once: ${rear} · ${jobs1}`);
    R.fallIn(); R.step(120); O.give('stack', O.targetAt(server.frameCentre), 'red'); R.step(1); jamb = 0; early = 0; rear = 0;
    let blueLeast2 = 9; for (let i = 0; i < 60 * 5; i++) { watch(1); if (i > 90) blueLeast2 = Math.min(blueLeast2, R.ops.filter((m: any) => O.pairOf(m) === 'blue' && C.of(m)).length); }
    const redSpare = R.ops.filter((m: any) => O.pairOf(m) === 'red' && spare(m)).length;
    verdict(redSpare === 1 && jamb === 0 && early === 0 && blueLeast2 >= 1, 'rear security on, the red pair alone: its second man is the rear, its jamb man the order\'s; blue is still watching openings', `red with spare eyes ${redSpare} · jamb man dealt ${jamb} frames · dealt early ${early} frames · blue never fewer than ${blueLeast2} of 2 · ${R.jobs()}`); }
  // the pair's plain 'hold' names nothing to watch: they are dealt where they stand, and their feet stay
  const P = await rig(3, 2); P.fallIn(); P.step(120); P.walk([[13, 0, 17.6], [20.6, 0, 17.6]]); P.step(60);
  P.O.give('hold', P.O.targetAt(P.sam.pos)); P.step(30); const stood = P.ops.map((m: any) => [...m.char.pos]);
  const held = P.until(() => P.ops.every((m: any) => P.C.of(m) && P.C.facing(m, 15)), 4); P.step(120);
  const off = P.ops.map((m: any, i: number) => dist(m.char.pos, stood[i])), under = P.ops.map((m: any) => P.O.of(m)?.order);
  verdict(held && under.every((o: string) => o === 'hold') && off.every((d: number) => d < 0.3), 'the pair told to hold (nothing named to watch): each squares up to an opening where he stands, feet still', `${under.join(' / ')} · ${P.jobs()} · moved ${off.map(f2).join(' / ')} m`);
  // a contact still warm is the man's before any opening is: one of the pair with a living defender in his eyes half a second ago is dealt nothing until COVER.contactSecs are up
  { const m = P.ops[0], M = P.game.fight.opOf(m)?.meters.get(P.hostiles.find((h: any) => h.state !== 'dead')), had = !!P.C.of(m);
    if (M) M.seenT = P.game.time - 0.5; P.step(20); const warm = !P.C.of(m), mate = !!P.C.of(P.ops[1]), t1 = P.game.time;
    const again = P.until(() => !!P.C.of(m), COVER.contactSecs + 2), took = P.game.time - t1 + 20 * DT + 0.5;
    verdict(!!M && had && warm && mate && again && took >= COVER.contactSecs - 0.3, 'a man who had a living enemy in his eyes a moment ago keeps looking where he was: no opening is dealt him until that is COVER.contactSecs old — his mate keeps his', `on an opening before: ${had} · with the sighting 0.5 s old: ${warm ? 'nothing dealt' : 'still dealt'} (his mate: ${mate ? 'still on his' : 'dropped'}) · dealt again ${f1(took)} s after the sighting (contactSecs ${COVER.contactSecs})`); }
  // taken off their orders mid back-pedal (orders.ts clear() does not re-pose a man, nor does a drill that takes him): what the cover wrote into his script goes with it
  { const T = await rig(5, 4); T.fallIn(); T.step(120);
    let cut = -1, who = ''; const aims = new Map<any, any>();
    T.post = () => { if (cut >= 0) { cut++; return; } const b = T.ops.filter((m: any) => m.script?.strafe && T.C.of(m)?.back); if (!b.length) return;
      for (const m of T.ops) aims.set(m, T.C.of(m)?.aim); who = b.map((m: any) => m.callsign).join(', '); T.O.clear(); cut = 0; };
    T.walk([[13, 0, 17.6], [20.6, 0, 17.6]]); T.post = null; T.step(5);
    const stale = T.ops.filter((m: any) => m.script && (m.script.strafe || (aims.get(m) && m.script.aimAt === aims.get(m)) || (m.script.upper === 'aim' && m.script.aimAt == null)));
    verdict(cut > 0 && stale.length === 0 && T.ops.every((m: any) => !T.C.of(m)), 'the squad taken off its orders while a man walks backwards on his opening: nobody keeps the sidestep, the aim point or the raised gun', `${who || 'nobody'} walking backwards when the orders were cleared · ${cut} frames on: ${stale.length} men with anything of the cover's left in their script · ${T.ops.map((m: any) => `${m.script?.upper ?? '-'}${m.script?.strafe ? '+strafe' : ''}`).join(' / ')}`); }
  // off: nobody dealt, the followers carry their guns as the order alone has them
  const F = await rig(3, 4); COVER.on = false; F.fallIn(); F.step(120); F.walk([[13, 0, 17.6], [20.6, 0, 17.6]]); F.step(120);
  const offDealt = F.ops.filter((m: any) => F.C.of(m)).length, upper = F.ops.map((m: any) => m.script?.upper ?? '?'), offRows = F.O.hud().status[0]?.opts.slice(0, 4).map((o: any) => o.text) ?? [];
  verdict(offDealt === 0 && F.C.live.length === 0 && upper.every((u: string) => u !== 'aim') && offRows.every((t: string) => / · with you$/.test(t)), 'COVER.on false: nobody is dealt anything, the followers\' guns are down as the order alone carries them, the squad block is the base\'s', `${offDealt} dealt · upper ${upper.join(' / ')} · ${offRows.join(' | ')} · ${F.C.summary()}`);
  return done();
});

// ---------------------------------------------------------------- cover-side
/** one trial: the file walking east down the aisle; when Sam passes `trig` a defender walks out of the gap between the cubicle blocks at x 19.75 (north or south
 *  of the aisle) and a metre into the aisle. From the first frame any teammate has a line to him: seconds until one has EYES ON him (roomfight.ts's own note),
 *  until the first round, until he is down. */
async function sideTrial(squad: 2 | 4, on: boolean, side: 'north' | 'south', trig: number, seed: number) {
  NVG.on = false;   // (bare eyes: the defenders STAND AS DEALT in their dark rooms for this one, held dazzled — a team on its goggles, nvg.ts, sees and shoots them on the
                    //  walk up, the man who is to step out among them, before the trial starts. What goggles find in the dark is probes.ts nvg-sight / nvg-fight.)
  const R = await rig(seed * 97 + 5, squad, false); COVER.on = on; const { game: g, sam } = R;
  const X = R.hostiles[0]; const S = side === 'north' ? { from: [19.75, 0, 13.3], to: [19.75, 0, 17.0] } : { from: [19.75, 0, 22.7], to: [19.75, 0, 18.9] };
  let xp: number[] = [...S.from]; R.pre = () => { if (X.state !== 'dead') { X.char.pos[0] = xp[0]; X.char.pos[2] = xp[2]; X.char.vel[0] = X.char.vel[2] = 0; } };
  R.fallIn(); R.step(120);
  const walked = R.walk([[13, 0, 17.6], [trig, 0, 17.6]]);
  // Sam walks on while the man comes out
  const keep = R.pre; let sx = sam.pos[0]; R.pre = () => { keep?.(); sx = Math.min(26.6, sx + 1.55 * DT); g.teleportPlayer([sx, 0, 17.6]); R.W.cursorAt([sx + 4, 1.1, 17.6]); };
  const t0 = g.time, r0 = g.fight.stats.opRounds, L = dist(S.from, S.to); let T0 = NaN, eyes = NaN, round = NaN, dead = NaN;
  while (g.time - t0 < 8) {
    const f = Math.min(1, (g.time - t0) * 1.5 / L); xp = [S.from[0] + (S.to[0] - S.from[0]) * f, 0, S.from[2] + (S.to[2] - S.from[2]) * f];
    R.step();
    if (isNaN(T0) && R.ops.some((m: any) => m.state !== 'dead' && !g.col.segmentBlocked([m.char.pos[0], 1.55, m.char.pos[2]], [X.char.pos[0], 1.1, X.char.pos[2]]))) T0 = g.time;
    if (isNaN(eyes) && g.fight.log.some((x: any) => x.t >= t0 && x.what === `eyes on ${X.callsign}`)) eyes = g.time;
    if (isNaN(round) && g.fight.stats.opRounds > r0) round = g.time;
    if (X.state === 'dead') { dead = g.time; break; }
  }
  return { walked, eyes: eyes - T0, round: round - T0, dead: dead - T0 };
}
export const coverSide = guarded(async () => {
  const { verdict, done } = family('cover-side: an enemy stepping out of a side opening is seen sooner than with cover off (the base), same seeds');
  const full = !!process.env.COVER_SIDE_FULL; const trigs = full ? [19.5, 20.5, 21.5, 22.5, 23.5, 24.5] : [19.5, 21.5, 23.5], seeds = full ? [1, 2, 3] : [1, 2];
  for (const squad of [4, 2] as const) {
    const tag = squad === 4 ? 'the four' : 'the pair';
    const rows: { on: Awaited<ReturnType<typeof sideTrial>>; off: Awaited<ReturnType<typeof sideTrial>> }[] = [];
    for (const side of ['north', 'south'] as const) for (const trig of trigs) for (const seed of seeds) rows.push({ on: await sideTrial(squad, true, side, trig, seed), off: await sideTrial(squad, false, side, trig, seed) });
    const fin = (a: number[]) => a.filter(Number.isFinite), n = rows.length, cap = 8;
    const col = (arm: 'on' | 'off', k: 'eyes' | 'round') => rows.map(r => r[arm][k]);
    const capped = (a: number[]) => a.map(x => Number.isFinite(x) ? x : cap);   // (never seen inside the 8 s = 8 s, for the medians and the trial-by-trial count)
    const eOn = col('on', 'eyes'), eOff = col('off', 'eyes'), rOn = col('on', 'round'), rOff = col('off', 'round');
    let sooner = 0, later = 0; capped(eOn).forEach((x, i) => { const y = capped(eOff)[i]; if (x < y - 0.05) sooner++; else if (x > y + 0.05) later++; });
    const mOn = median(capped(eOn)), mOff = median(capped(eOff)), mrOn = median(capped(rOn)), mrOff = median(capped(rOff));
    verdict(rows.every(r => r.on.walked && r.off.walked) && fin(eOn).length >= fin(eOff).length && mOn < mOff && sooner > later, `${tag}: a teammate has eyes on him sooner with cover on, over the same ${n} seeded step-outs`,
      `seen inside 8 s: ${fin(eOn).length} of ${n} on, ${fin(eOff).length} of ${n} off · median to eyes on ${f2(mOn)} s on, ${f2(mOff)} s off · trial by trial: sooner ${sooner}, later ${later}, the same ${n - sooner - later}`);
    verdict(fin(rOn).length >= fin(rOff).length && mrOn <= mrOff, `${tag}: and the first round goes no later`, `a round off inside 8 s: ${fin(rOn).length} of ${n} on, ${fin(rOff).length} of ${n} off · median to the first round ${f2(mrOn)} s on, ${f2(mrOff)} s off${mrOn >= cap ? ' (8.00 = never, in most trials)' : ''}`);
  }
  return done();
});

// ---------------------------------------------------------------- cover-settle
export const coverSettle = guarded(async () => {
  const { verdict, done } = family('cover-settle: a stack\'s rear man settles on one job at a time (REAR.settle), off against on over the same walks');
  // (the approach, then the door: the aisle to the server room, the corridor to the manager's, the break room from its west side)
  const LEGS: { door: string; walk: number[][] }[] = [{ door: 'server', walk: [[13, 0, 17.6], [19.0, 0, 11.0]] }, { door: 'manager', walk: [[24.5, 0, 11.0]] }, { door: 'breakroom_w', walk: [[26.6, 0, 17.6]] }];
  interface Row { changes: number; flicks: number; twitch: number; rearT: number; doorT: number; men: number; stacks: number; said: string[] }
  const run = async (squad: 2 | 4, settle: boolean): Promise<Row> => {
    const R = await rig(3, squad); const { C, O, game: g } = R; REAR.settle = settle;
    const out: Row = { changes: 0, flicks: 0, twitch: 0, rearT: 0, doorT: 0, men: 0, stacks: 0, said: [] };
    R.fallIn(); R.step(120);
    for (const leg of LEGS) {
      const d = R.door(leg.door); if (!d) continue;
      R.walk(leg.walk); R.step(60);
      if (O.give('stack', O.targetAt(d.frameCentre)) !== null) { R.fallIn(); R.step(60); continue; }
      out.stacks++;
      const tr = new Map<any, { tag: string; doorAt: number; fl: number; ext: number; dir: number; turns: number[]; tw: boolean; n: number }>();
      let stood = 0;
      for (let i = 0; i < 60 * 14 && stood < 60 * 4; i++) {
        R.step();
        const on = R.ops.filter((m: any) => m.state !== 'dead' && O.of(m)?.order === 'stack'); if (on.length && on.every((m: any) => O.of(m).arrived)) stood++;
        for (const m of on) { const A = O.of(m); if (!A.spare) continue;
          const J = C.of(m) ?? C.keptJob(m), tag = J && m.script?.aimAt === J.aim ? J.o.id : 'the door', yaw = m.char.aimYaw;
          let T = tr.get(m); if (!T) { tr.set(m, T = { tag, doorAt: -100, fl: 0, ext: yaw, dir: 0, turns: [], tw: false, n: 0 }); out.men++; }
          if (T.tag !== tag) { if (tag === 'the door') T.doorAt = g.time; else if (T.tag === 'the door' && T.n > 0 && g.time - T.doorAt < 0.75) { T.fl++; out.flicks++; } T.tag = tag; T.n++; out.changes++; }
          if (tag === 'the door') out.doorT += DT; else out.rearT += DT;
          // (playthrough.ts's twitch, the same arithmetic: a reversal once the aim has come back 15° from its last extreme, four inside 2 s)
          const cont = T.ext + wrap(yaw - T.ext);
          if (T.dir === 0) { if (Math.abs(cont - T.ext) > 0.26) { T.dir = Math.sign(cont - T.ext); T.ext = cont; } }
          else if ((cont - T.ext) * T.dir > 0) T.ext = cont;
          else if ((T.ext - cont) * T.dir > 0.26) { T.turns.push(g.time); T.dir = -T.dir; T.ext = cont; }
          while (T.turns.length && g.time - T.turns[0] > 2) T.turns.shift();
          if (T.turns.length >= 4 && !T.tw) { T.tw = true; out.twitch++; } }
      }
      out.said.push(`${leg.door}: ${[...tr].map(([m, T]) => `${m.callsign} ${T.n} change${T.n === 1 ? '' : 's'}${T.fl ? `, ${T.fl} flick${T.fl === 1 ? '' : 's'} to the door` : ''}${T.tw ? ', TWITCH' : ''}, ends on ${T.tag}`).join(' · ') || 'no rear man'}`);
      R.fallIn(); R.step(90);
    }
    return out;
  };
  for (const squad of [4, 2] as const) {
    const off = await run(squad, false), on = await run(squad, true), tag = squad === 4 ? 'the four' : 'the pair';
    const words = (r: Row) => `${r.stacks} stacks, ${r.men} rear men · ${r.changes} changes of what the gun is on · ${r.flicks} flicks to the door and back · ${r.twitch} twitches · behind the stack ${f1(r.rearT)} s, on the door ${f1(r.doorT)} s\n      ${r.said.join('\n      ')}`;
    console.log(`    ${tag}, REAR.settle off (as it was): ${words(off)}`);
    verdict(on.stacks === LEGS.length && on.men >= on.stacks && on.twitch === 0 && on.rearT > 0, `${tag}, settled: every stack has its rear man, each is dealt a rear, none twitches`, words(on));
    verdict(on.twitch <= off.twitch && on.rearT >= 0.9 * off.rearT, `${tag}: no more twitches than with the switch off, and the rear watched no less (nine tenths of the time or more)`, `flicks ${off.flicks} → ${on.flicks} · twitches ${off.twitch} → ${on.twitch} · behind the stack ${f1(off.rearT)} s → ${f1(on.rearT)} s`);
  }
  // ---- the rule itself: the four stacked on the server door, one rear man stood on his mark with his gun on an opening — the deal stopped, his job let go of
  //      by hand exactly as the deal lets go of one (Cover.drop)
  const stood = async (settle: boolean) => {
    const R = await rig(3, 4); const { C, O } = R; REAR.settle = settle;
    R.fallIn(); R.step(120); R.walk(LEGS[0].walk); R.step(60);
    O.give('stack', O.targetAt(R.door('server').frameCentre));
    const on = (m: any) => { const J = C.of(m), A = O.of(m); return !!J && !!A?.spare && !!A.arrived && m.script?.aimAt === J.aim && Math.hypot(m.char.vel[0], m.char.vel[2]) < 0.1; };
    R.until(() => R.ops.some(on), 14);
    return { R, on, m: R.ops.find(on) as any };
  };
  const brg = (m: any, p: number[]) => Math.atan2(p[0] - m.char.pos[0], p[2] - m.char.pos[2]), off = (m: any, p: number[]) => Math.abs(wrap(m.char.aimYaw - brg(m, p))) * 57.3;
  { // (a) let go of and nothing dealt: the gun stays REAR.secs, then the door has it
    const { R, m } = await stood(true); const { C, O, game: g } = R;
    if (!m) verdict(false, 'staged: a rear man stood on his mark with an opening dealt', 'none found');
    else {
      const J = C.of(m), A = O.of(m), t0 = g.time; (C as any).dealAt = g.time + 100; (C as any).drop(m);
      R.step(1); const at1 = C.keptJob(m) === J && m.script.aimAt === J.aim;
      R.until(() => g.time - t0 >= REAR.secs - 0.1, 5); const held = C.keptJob(m) === J && m.script.aimAt === J.aim, offHeld = off(m, J.to);
      R.until(() => g.time - t0 >= REAR.secs + 0.1, 5); const gone = C.keptJob(m) === null && m.script.aimAt === A.watch;
      R.step(90); const offDoor = off(m, A.watch);
      verdict(at1 && held && offHeld < 12 && gone && offDoor < 12, `let go of with nothing else dealt, ${m.callsign}'s gun stays on ${J.o.id} for REAR.secs (${REAR.secs} s), then the door has it`,
        `the frame after: ${at1 ? 'still on it' : 'OFF it'} · at ${f2(REAR.secs - 0.1)} s: ${held ? 'on it' : 'OFF it'}, ${Math.round(offHeld)}° off the opening · at ${f2(REAR.secs + 0.1)} s: ${gone ? 'the order has the gun' : 'NOT handed back'} · 1.5 s on: ${Math.round(offDoor)}° off the door`);
      // (b) Sam steps into the line of a kept gun: it comes off at once
      (C as any).dealAt = 0; R.until(() => !!C.of(m) && m.script?.aimAt === C.of(m).aim, 6); R.step(30);
      const J2 = C.of(m);
      if (!J2) verdict(false, 'staged: the same man dealt an opening again', 'he was not');
      else { (C as any).dealAt = g.time + 100; (C as any).drop(m); R.step(1); const was = C.keptJob(m) === J2;
        const p = m.char.pos, k = Math.min(0.5, 1.2 / Math.max(1.2, Math.hypot(J2.to[0] - p[0], J2.to[2] - p[2]))); g.teleportPlayer([p[0] + (J2.to[0] - p[0]) * k, 0, p[2] + (J2.to[2] - p[2]) * k]);
        R.step(2);
        verdict(was && C.keptJob(m) === null && m.script.aimAt !== J2.aim, 'Sam stepping into the line of a gun left on an opening takes it off at once', `kept before he stepped in: ${was ? 'yes' : 'NO'} · two frames after: ${C.keptJob(m) ? 'STILL kept' : 'let go'}, gun ${m.script.aimAt === J2.aim ? 'STILL the cover\'s' : 'the order\'s'}`); }
    }
  }
  { // (c) let go of and dealt again 0.4 s later (what the deal does on the move): on, the gun never visits the door; off, it does
    const visit = async (settle: boolean) => { const { R, m } = await stood(settle); if (!m) return null; const { C, O, game: g } = R;
      const A = O.of(m); (C as any).dealAt = g.time + 0.4; (C as any).drop(m);
      let door = 0; for (let i = 0; i < 60; i++) { R.step(); if (m.script?.aimAt === A.watch) door++; }
      return { who: m.callsign, door, again: !!C.of(m) }; };
    const a = await visit(false), b = await visit(true);
    verdict(!!a && !!b && b.door === 0 && b.again && a.door > 0, 'let go of and dealt again 0.4 s on: settled, the gun never starts for the door (off: it does)',
      a && b ? `off: ${a.who}'s gun the order's for ${a.door} frames of 60 · on: ${b.who}'s for ${b.door}${b.again ? '' : ' · NOT dealt again'}` : 'no rear man staged');
  }
  return done();
});

// ---------------------------------------------------------------- cover-step
/** one staging: door `name` stood open at `ang`, the pair behind its leaf with Sam beside them looking away, the order given, `secs` run. What happened. */
interface StepCase { door: string; ang: number; men: number[][]; sam: number[] }
type StepEnd = 'saw' | 'stepped' | 'noSpot' | 'owed' | 'kept';
const STEP_END: Record<Exclude<StepEnd, 'saw'>, string> = { stepped: 'a step begun, NOBODY dealt the doorway', noSpot: 'nobody sees through, no spot', owed: 'nobody sees through, a free man NOT ASKED', kept: 'nobody sees through, nobody asked' };
async function stepTrial(c: StepCase, on: boolean, order: 'fallIn' | 'hold', then?: (R: Awaited<ReturnType<typeof rig>>, d: any) => void) {
  const R = await rig(5, 2); const { C, O, sam, game: g } = R; COVER.step = on;
  const d = R.door(c.door), o = C.openings.length ? C.openings.find((x: any) => x.door === d) : null;
  R.pre = () => { d.angle = c.ang; d.vel = 0; d.latched = false; d.closing = false; d.quietT = -3600; };
  const away = [c.sam[0] * 2 - d.frameCentre[0], 1.1, c.sam[2] * 2 - d.frameCentre[2]];
  g.teleportPlayer(c.sam); R.W.cursorAt(away);
  R.ops.forEach((m: any, i: number) => { m.char.pos[0] = c.men[i][0]; m.char.pos[2] = c.men[i][2]; m.char.vel[0] = m.char.vel[2] = 0; });
  R.step(2); R.W.cursorAt(away);
  const start = R.ops.map((m: any) => [...m.char.pos]);
  if (order === 'fallIn') R.fallIn(); else O.give('hold', O.targetAt(sam.pos));
  const posts = R.ops.map((m: any) => { const q = O.of(m)?.post; return q ? [...q] : null; });
  const op = () => C.openings.find((x: any) => x.door === d) ?? o;
  let blind0 = false, inOpening = 0, worst = Infinity, sawAt = -1, who: any = null, far = 0, stepD = false, noSpotD = false, idle = false, jobs = ''; const t0 = g.time;
  R.post = () => {
    const D = op(); if (!D) return;
    // (what the deal did about THIS door: a step begun for it · men who could go and no spot for any of them (its own doorTry) · and, once the deal has
    //  settled, a free man stood still with nothing, or on the leaf's edge, while nobody sees into it: him the rule owes a try)
    for (const S of C.steps.values()) if (S.o === D) stepD = true;
    if (((C as any).doorTry.get(D) ?? 0) > 0) noSpotD = true;
    const el = g.time - t0, settled = el > 1.5 && el < 6, unseen = !C.live.some((L: any) => L.o === D), free: any[] = settled && unseen ? R.free() : [];
    if (settled) jobs = R.jobs();
    for (const m of R.ops) { const J = C.of(m), S = C.steps.get(m);
      if (!S && free.includes(m) && Math.hypot(m.char.vel[0], m.char.vel[2]) < 0.3 && (!J || (J.o === D && J.to !== D.at))) idle = true;
      if (g.time - t0 < 0.7 && ((J && J.o === D && J.to !== D.at) || (!J && !C.live.some((L: any) => L.o === D && L.by)))) blind0 = true;
      // (the team fallen in from the staging — startfile.ts START.fallIn, as the page opens — comes to the leaf already dealt: there is no moment between the
      //  order and its first deal in which a man has nothing. The case arises there as the deal itself has it once it has dealt them where they now stand:
      //  each man on an opening of his own and the door on nobody's list — no free man has a line into its doorway)
      if (START.fallIn && g.time - t0 >= COVER.dealSecs && g.time - t0 < 0.7 && J && J.o !== D && !C.live.some((L: any) => L.o === D)) blind0 = true;
      if (S) { far = Math.max(far, dist(m.char.pos, S.from)); for (const x of C.openings) { const k = dist(m.char.pos, x.at) - x.half; worst = Math.min(worst, k); if (k < 0.2) inOpening++; } }
      if (sawAt < 0 && J && J.o === D && J.to === D.at && C.facing(m, 20)) { sawAt = g.time - t0; who = m; } } };
  R.step(60 * 7);
  const moved = R.ops.map((m: any, i: number) => dist(m.char.pos, start[i]));
  // (how it ended, said once: a man sees through · a step begun for the door and nobody dealt its doorway · asked, no spot · a free man with nothing never asked ·
  //  nobody asked, each man on an opening of his own)
  const end: StepEnd = sawAt >= 0 ? 'saw' : stepD ? 'stepped' : noSpotD ? 'noSpot' : idle ? 'owed' : 'kept';
  const out = { R, d, blind0, inOpening, worst, sawAt, who, far, moved, end, jobs, steps: C.stats.steps, stepped: C.stats.stepped, stepSaw: C.stats.stepSaw, short: R.ops.some((m: any) => O.of(m)?.there === 'stopped short'), arrived: R.ops.every((m: any) => O.of(m)?.arrived),
    postMoved: Math.max(0, ...R.ops.map((m: any, i: number) => { const q = O.of(m)?.post; return q && posts[i] ? dist(q, posts[i]!) : 0; })), offPost: Math.max(0, ...R.ops.map((m: any, i: number) => posts[i] ? dist(m.char.pos, posts[i]!) : 0)) };
  if (then) then(R, d);
  return out;
}
export const coverStep = guarded(async () => {
  const { verdict, done } = family('cover-step: a man dealt an open door he cannot see through steps to where he does — never into an opening');
  // the cases, found off the level itself: every door, each way it can stand open, with free floor behind the leaf for two men and Sam in plain sight of each other
  const R0 = await rig(5, 2); const g0 = R0.game, nav = g0.col.nav; const cases: StepCase[] = [];
  const freeAt = (p: number[]) => !nav.isBlocked(p[0], p[2]);
  const seen = (a: number[], b: number[]) => !g0.col.solidBlocked([a[0], 0.45, a[2]], [b[0], 0.45, b[2]]) && !g0.col.solidBlocked([a[0], 1.1, a[2]], [b[0], 1.1, b[2]]);
  for (const d of g0.doors.list as any[]) for (const s of [1, -1]) {
    const ang = s * 1.45; if (ang > d.maxA || ang < d.minA || d.def.steel) continue;
    const th = d.def.closedDir, u = [Math.cos(th), Math.sin(th)], n = [-u[1] * s, u[0] * s], H = d.def.hinge;
    const pt = (along: number, off: number) => [H[0] + u[0] * along + n[0] * off, 0, H[1] + u[1] * along + n[1] * off];
    const men = [pt(-1.0, 1.3), pt(-2.1, 1.7)], samP = pt(-1.3, 2.4);
    if (![...men, samP].every(freeAt) || !seen(men[0], samP) || !seen(men[1], samP) || !seen(men[0], men[1])) continue;
    if ([...men, samP].some(p => (g0.doors.list as any[]).some(x => dist(p, x.frameCentre) < 1.2))) continue;
    cases.push({ door: d.def.name, ang, men, sam: samP });
  }
  verdict(cases.length >= 3, 'the office has doors that can stand open with a pair behind the leaf', `${cases.length} stagings: ${cases.map(c => `${c.door} ${c.ang > 0 ? '+' : '−'}`).join(', ')}`);
  // ---- following: off (the before), on
  let arose = 0, offSaw = 0, offMoved = 0, onSaw = 0, onIn = 0, onFar = 0, mateMoved = 0, noSpot: string[] = [], keep: string[] = [], owed: string[] = [], wasted: string[] = [], back = 0, backOf = 0; const secs: number[] = [], rows: string[] = [];
  for (const c of cases) { const tag = `${c.door} ${c.ang > 0 ? '+' : '−'}`;
    const A = await stepTrial(c, false, 'fallIn'); if (!A.blind0) { rows.push(`${tag}: a man has a line from the start — not a case`); continue; }
    arose++; if (A.sawAt >= 0) offSaw++; if (Math.max(...A.moved) > 0.3) offMoved++;
    let fell = '';
    const B = await stepTrial(c, true, 'fallIn', (R, d) => {   // Sam walks on, away from the door: they fall in again
      const sam = R.sam.pos, dx = sam[0] - d.frameCentre[0], dz = sam[2] - d.frameCentre[2], L = Math.hypot(dx, dz) || 1;
      let to: number[] | null = null; for (const k of [5, 4, 3]) { const p = [sam[0] + dx / L * k, 0, sam[2] + dz / L * k]; if (!R.game.col.nav.isBlocked(p[0], p[2]) && R.game.col.nav.findPath(sam, p)) { to = p; break; } }
      if (!to) { fell = 'nowhere for Sam to walk'; return; }
      R.post = null; R.walk([to], 1.4, 20); R.step(60 * 3); backOf++;
      const ok = R.C.steps.size === 0 && R.ops.every((m: any) => dist(m.char.pos, R.sam.pos) < 4.2); if (ok) back++; fell = ok ? 'fell in again' : `NOT back in file (${R.ops.map((m: any) => f1(dist(m.char.pos, R.sam.pos))).join(' / ')} m from Sam, ${R.C.steps.size} steps kept)`; });
    // (asked = a step begun or the deal's own 'no spot for any of them'. Where nobody is asked, both men are on openings of their own that the door does not
    //  outweigh by COVER.sticky + 0.3 — the deal's bar for taking a man off what he is on: its weighing, not the step's — and that is counted apart, and
    //  bounded below; a free man with NOTHING left unasked, or a step that did not earn its man the doorway, is the rule's fault)
    if (B.end === 'saw') { onSaw++; secs.push(B.sawAt); } else (B.end === 'stepped' ? wasted : B.end === 'noSpot' ? noSpot : B.end === 'owed' ? owed : keep).push(B.end === 'kept' ? `${tag} (${B.jobs})` : tag);
    if (B.inOpening) onIn++; if (B.far > COVER.stepM + 0.4) onFar++;
    const mate = B.who ? B.moved[B.R.ops.indexOf(B.who) ^ 1] : Math.max(...B.moved); if (B.sawAt >= 0 && mate > 0.5 && B.steps < 2) mateMoved++;
    rows.push(`${tag}: off — ${A.sawAt >= 0 ? 'SEEN' : 'nobody sees through'}, moved ${A.moved.map(f2).join(' / ')} m · on — ${B.end === 'saw' ? `${B.who.callsign} sees through at ${f1(B.sawAt)} s` : STEP_END[B.end]}, moved ${B.moved.map(f2).join(' / ')} m, ${B.steps} step${B.steps === 1 ? '' : 's'} begun ${B.stepped} made, nearest an opening's edge ${f2(B.worst)} m${fell ? ' · ' + fell : ''}`);
  }
  console.log(rows.map(r => `    ${r}`).join('\n'));
  verdict(arose >= 3 && offSaw === 0 && offMoved === 0, 'the BEFORE (COVER.step off): behind the leaf nobody has a line through the door, and nobody moves', `${arose} stagings where it arises · a man dealt the doorway itself in ${offSaw} · anybody moved in ${offMoved}`);
  const asked = arose - keep.length - owed.length;
  verdict(asked >= Math.ceil(arose * 0.75) && onSaw >= Math.ceil(asked * 0.75), 'ON: a man steps to where he sees through it and is dealt the doorway itself, gun on it', `${onSaw} of the ${asked} stagings where the deal asked a man, of ${arose} (median ${f1(median(secs))} s after the order, worst ${f1(Math.max(...secs))} s)${noSpot.length ? ` · no spot within ${COVER.stepM} m: ${noSpot.join(', ')}` : ''}`);
  verdict(owed.length === 0 && wasted.length === 0, 'ON: no step is wasted and no free man passed over — a step begun earns its man the doorway; where nobody is asked, each man is on an opening of his own', `a step that did not earn the doorway: ${wasted.join(', ') || 'none'} · a free man with nothing left unasked: ${owed.join(', ') || 'none'} · nobody asked: ${keep.join(' ; ') || 'none'}`);
  verdict(onIn === 0 && onFar === 0, 'never in or across an opening, never further than COVER.stepM from where he stood', `stagings with a stepping man inside 0.2 m of an opening's width: ${onIn} · further than ${COVER.stepM} m (+ the arrival's slack): ${onFar}`);
  verdict(mateMoved === 0, 'one man a door: his mate stays where he is', `stagings where the other man moved over half a metre without a step of his own: ${mateMoved}`);
  verdict(back === backOf && backOf > 0, 'Sam walks on: the step is dropped and both fall in again', `${back} of ${backOf}`);
  // ---- holding: the mark moves with him
  let hSaw = 0, hKept = 0, hShort = 0, hArr = 0, hN = 0, hPost = 0, hOff = 0, hStand = 0, hStandOf = 0, hStray = 0;
  for (const c of cases.slice(0, 4)) { const A = await stepTrial(c, false, 'hold'); if (!A.blind0 || A.sawAt >= 0) continue; hN++;
    const B = await stepTrial(c, true, 'hold', R => {   // both blinded a while — no deal has a free man: the step stands, he is not walked back behind the leaf and out again
      const C = R.C, g = R.game, m = R.ops.find((x: any) => C.steps.get(x)?.done); if (!m) return; hStandOf++;
      const q = [...C.steps.get(m).q]; let stray = 0; for (const x of R.ops) x.dazzledUntil = g.time + 2.5;
      R.post = () => { stray = Math.max(stray, dist(m.char.pos, q)); }; R.step(60 * 6); R.post = null;
      hStray = Math.max(hStray, stray); if (C.steps.get(m)?.done && stray < 0.5) hStand++; });
    if (B.sawAt >= 0) hSaw++; else if (B.end === 'kept') hKept++; if (B.short) hShort++; if (B.arrived) hArr++; hPost = Math.max(hPost, B.postMoved); hOff = Math.max(hOff, B.offPost); }
  verdict(hN > hKept && hSaw >= Math.ceil((hN - hKept) * 0.75) && hShort === 0 && hArr === hN && hPost < 0.01 && hOff <= COVER.stepM + 0.4, "under a plain 'hold' too: he is walked off a mark that stays where the order put it, nothing 'stopped short'", `${hSaw} of ${hN - hKept} see through${hKept ? ` (nobody asked in ${hKept} more)` : ''} · stopped short ${hShort} · settled at the end ${hArr} of ${hN} · a mark moved by at most ${f2(hPost)} m · a man at most ${f2(hOff)} m off his mark`);
  verdict(hStandOf > 0 && hStand === hStandOf, 'a step taken stands while nobody is free (both blinded): he stays where he sees through it', `${hStand} of ${hStandOf} · furthest he strayed from his spot ${f2(hStray)} m`);
  return done();
});
