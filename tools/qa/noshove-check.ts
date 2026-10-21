// TEAMMATES FALLING IN NEVER SHOVE YOU — the check behind src/game/noshove.ts (NOSHOVE.on: on in the page, ?noshove=0; off on the frozen stand, TPS_NOSHOVE=1).
//   bun run tools/qa/noshove-check.ts [--verbose]      (also `probes.ts noshove`, family squadorders; run it on BOTH stands: plain, and TPS_PROFILE=shipped in front)
// Headless; nothing here looks at a picture. room-clear-four with the other side put far off the floor, the switch thrown by hand after the stand-up; the
// player stands with no key down unless a line says he walks. Each line is played with the switch off (the flaw must SHOW) and on (it must be gone):
//   1. THE CASE IT WAS FOUND IN, staged small: 'fall in' with one man a pace from the player and his place on the player's far side — off, the player is
//      shouldered aside and the squad reads him as walking; on, he is not moved, the man goes round him and is in his place;
//   2. THE WALK FROM A DISTANCE, square on and a foot off his line (the 'near enough already' rule held off so the man walks to his exact place): the same;
//   3. NO ROOM TO GO ROUND (the player stood in a passage): on, the man squeezes past and the player is not moved; with `through` off he stops short and waits;
//   4. HIS PLACE UNDER THE PLAYER: he stops short of it, at the ring, and the player is not moved;
//   5. LEFT STANDING IN THE PLAYER'S KEEP-OFF (set down on top of each other): the man steps back out, the player stays;
//   6. THE PLAYER STILL CANNOT WALK THROUGH A FOLLOWER: walked at one under his own keys (stepping out of his way held off), he gets no nearer than his keep-off;
//   7. A SHOVE IS NOT HIS WALKING (`own`): a teammate on ANOTHER order walks into the standing player — he is still shouldered (that man is not falling
//      in), but the pace the squad reads off him stays under the 'walking' bar and a follower standing in the line of the shove does not step aside (off: he does);
//   8. the arithmetic of `own`: a standing man shoved reads 0; a walk into a man who stands reads the ground he covered; a walk shouldered sideways reads his walk;
//   9. A ROOM KEEPER (the compound, the room taken through k_p, 'fall in' with the player stood inside — the case of the finding, which is the SHIPPED stand's:
//      the frozen stand's entry walks nobody across him): off, the player is shoved and the keeper walks out of his way; `own` alone, the player is shoved
//      and the keeper's legs stay still; on, nobody is moved;
//  10. the journal: a recording from before the key replays with it off, one that carries it keeps its own word.
// NOSHOVE_BREAK=1 = the module answers as if the switch were off in the 'on' arms: lines 1 to 9 must fail.   exit 0 = all hold · 1 = one does not
import { ROOT } from './headless.ts';
import { guarded, family } from './thresholdmenu-probes.ts';
const { rig } = (await import('./outerwall-probes.ts')) as any;
const { NOSHOVE, NOSHOVE_STATS, noShoveOwn, noShoveKeep } = await import(`${ROOT}/src/game/noshove.ts`);
const { ORDERS, sideOf } = await import(`${ROOT}/src/game/orders.ts`);
const { KEEP_OFF } = await import(`${ROOT}/src/game/player.ts`);
const { DESTRUCTION } = await import(`${ROOT}/src/game/destructionSwitch.ts`);
const { WALLCHARGE } = await import(`${ROOT}/src/game/wallcharge.ts`);
const { REARWATCH, roomKept } = await import(`${ROOT}/src/game/rearwatch.ts`);
const { stackRoomProbe } = await import(`${ROOT}/src/game/stackroom.ts`);
const VERBOSE = process.argv.includes('--verbose'), SCN = 'room-clear-four';
type V = number[];
const flat = (a: V, b: V) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : '—'), f3 = (x: number) => (Number.isFinite(x) ? x.toFixed(3) : '—');
const say = (s: string) => { if (VERBOSE) console.log(`    ${s}`); };

/** how far a body can stand from `p` along (dx, dz) before a static, at shin height (m, up to 3) */
const clear = (g: any, p: V, dx: number, dz: number) => { const h = g.col.raycast([p[0], 0.45, p[2]], [dx, 0, dz], 3); return h ? h.t : 3; };
const DIRS = Array.from({ length: 8 }, (_, i) => [Math.sin(i * Math.PI / 4), Math.cos(i * Math.PI / 4)]);

/** the scenario stood up with the other side far off the floor and the four fallen in; floor found for the lines: an OPEN spot (a body's room and more
 *  every way, 3 m of floor east and west of it) and a TIGHT one (a passage: no room to pass a man standing in its middle, 2.6 m of floor each way along it) */
async function stand() {
  const R = await rig(SCN, 5), g = R.game;
  for (const k of Object.keys(NOSHOVE_STATS)) (NOSHOVE_STATS as any)[k] = 0;
  for (const h of R.hostiles) if (h.state !== 'dead') R.put(h, [h.char.pos[0] + 400, 0, h.char.pos[2]]);
  const home = [...g.player.char.pos]; R.gather(home, 20); R.step(60);
  const nav = g.col.nav, free = (p: V) => !nav.isBlocked(p[0], p[2]);
  const cells: V[] = []; for (let x = home[0] - 14; x <= home[0] + 14; x += 0.25) for (let z = home[2] - 14; z <= home[2] + 14; z += 0.25) { const p = [x, 0, z]; if (free(p) && Number.isFinite(R.pathLen(home, p))) cells.push(p); }
  cells.sort((a, b) => flat(a, home) - flat(b, home));
  const line = (p: V, ax: number, az: number, m: number) => { for (let k = 0.25; k <= m; k += 0.25) for (const s of [1, -1]) { const q = [p[0] + ax * k * s, 0, p[2] + az * k * s]; if (!free(q) || g.col.solidBlocked([p[0], 0.45, p[2]], [q[0], 0.45, q[2]])) return false; } return true; };
  let open: { p: V; ax: number; az: number } | null = null, tight: { p: V; ax: number; az: number } | null = null;
  for (const p of cells) {
    if (!open && DIRS.every(d => clear(g, p, d[0], d[1]) >= 1.7)) for (const [ax, az] of [[1, 0], [0, 1]]) if (!open && line(p, ax, az, 3.25)) open = { p, ax, az };
    if (!tight) for (const [ax, az] of [[1, 0], [0, 1]]) { const l = clear(g, p, az, -ax), r = clear(g, p, -az, ax);
      if (!tight && l < NOSHOVE.ring + 0.25 && r < NOSHOVE.ring + 0.25 && l > 0.38 && r > 0.38 && line(p, ax, az, 2.5)) tight = { p, ax, az }; }
    if (open && tight) break;
  }
  if (!open) throw new Error('noshove: no open floor near the start');
  const men = () => R.up as any[];
  /** the player set down at `p` with the trail forgotten, the men put where `at` says, 'fall in' given: the man asked for is the one nearest the player */
  const deal = (p: V, at: (i: number) => V) => {
    g.teleportPlayer([p[0] + 60, 0, p[2]]); R.step(2); men().forEach((m, i) => R.put(m, at(i)));
    g.teleportPlayer([p[0], 0, p[2]]); R.step(2); men().forEach((m, i) => { R.put(m, at(i)); m.char.vel = [0, 0, 0]; });
    const why = R.O.give('fallIn', R.O.targetAt(g.player.char.pos), 'all'); if (why) throw new Error(`noshove: 'fall in' refused — ${why}`);
  };
  return { R, g, home, open, tight, men, deal };
}
type Stand = Awaited<ReturnType<typeof stand>>;

interface Walk { shoved: number; nearest: number; samV: number; passed: boolean; arrived: boolean; end: number; who: string; stats: Record<string, number>; legs: number; stuck: number }
/** a man `d` from the player on the far side of him from the other three (who stand off along the axis), `off` to the side of the line through him;
 *  'fall in'; `secs` played with no key down. Where: the open spot, or the passage. null: no such floor */
async function walk(on: boolean, o: { d: number; off?: number; tight?: boolean; nearOff?: boolean; through?: boolean; secs?: number }): Promise<Walk | null> {
  const S = await stand(), { R, g } = S, at = o.tight ? S.tight : S.open; if (!at) return null;
  NOSHOVE.on = on; NOSHOVE.through = o.through ?? true; const nearM = ORDERS.nearM;
  if (o.nearOff) ORDERS.nearM = 99;   // (nobody is 'near enough already': every man walks to his exact place)
  try {
    const { p, ax, az } = at, px = az, pz = -ax, off = o.off ?? 0;
    S.deal(p, i => i === 0 ? [p[0] - ax * o.d + px * off, 0, p[2] - az * o.d + pz * off]
      : o.tight ? [p[0] + ax * (1.7 + 0.27 * i), 0, p[2] + az * (1.7 + 0.27 * i)] : [p[0] + ax * (2.2 + 0.45 * i) + px * (i - 2) * 0.9, 0, p[2] + az * (2.2 + 0.45 * i) + pz * (i - 2) * 0.9]);
    const m = S.men()[0], s0 = [...g.player.char.pos], A = () => R.O.of(m);
    let shoved = 0, nearest = 9, samV = 0, passed = false, legs = 0; const frames = (o.secs ?? 5) * 60, stuck0 = m.stuckN;
    for (let f = 0; f < frames; f++) {
      R.step(); const sp = g.player.char.pos, mp = m.char.pos;
      shoved = Math.max(shoved, flat(sp, s0)); nearest = Math.min(nearest, flat(mp, sp)); samV = Math.max(samV, (R.O as any).samV);
      if ((mp[0] - sp[0]) * ax + (mp[2] - sp[2]) * az > 0.3) passed = true;
      if (f >= frames - 120) legs = Math.max(legs, m.char.anim.speed);   // (the pace his legs cycle at over the last two seconds)
      if (f % 20 === 0) say(`${on ? 'on ' : 'off'} f${f} ${m.callsign} (${f2(mp[0])}, ${f2(mp[2])}) ${f2(flat(mp, sp))} m off the player (${f3(sp[0])}, ${f3(sp[2])}) v${f2(m.speed)} goal ${A()?.goal ? `(${f2(A().goal[0])}, ${f2(A().goal[2])})` : '-'} · the squad reads his pace as ${f2((R.O as any).samV)}`);
    }
    return { shoved, nearest, samV, passed, arrived: !!A()?.arrived, end: flat(m.char.pos, g.player.char.pos), who: m.callsign, stats: { ...NOSHOVE_STATS }, legs, stuck: m.stuckN - stuck0 };
  } finally { ORDERS.nearM = nearM; NOSHOVE.through = true; }
}

/** lines 4, 5, 6 on one stand-up (the switch as asked): his place under the player · set down on top of each other · the player walked at a follower */
async function close(on: boolean) {
  const S = await stand(), { R, g } = S, { p, ax, az } = S.open!, px = az, pz = -ax; NOSHOVE.on = on;
  const sam = () => g.player.char.pos, spread = (i: number) => [p[0] + ax * (2.2 + 0.45 * i) + px * (i - 2) * 0.9, 0, p[2] + az * (2.2 + 0.45 * i) + pz * (i - 2) * 0.9];
  // 4. the mover asked directly, as squad.ts asks it after a step: a follower whose order's place is the player's own spot, one stride into the ring
  S.deal(p, spread); R.step(90);
  const m = S.men()[0]; let under = NaN, underSam = NaN;
  if (m.script) { const s0 = [...sam()], x0 = s0[0] - ax * (NOSHOVE.ring + 0.02), z0 = s0[2] - az * (NOSHOVE.ring + 0.02), goal = m.script.goal;
    m.script.goal = [s0[0], 0, s0[2]]; m.path = []; m.char.pos[0] = x0 + ax * 0.1; m.char.pos[2] = z0 + az * 0.1;
    noShoveKeep(g, m, x0, z0, 1 / 60); under = flat(m.char.pos, s0); underSam = flat(sam(), s0); m.script.goal = goal; }
  // 5. set down on top of each other: the man 0.3 m from the player, on the others' side of him (his place is not across the player)
  S.deal(p, i => i === 0 ? [p[0] + ax * 0.3, 0, p[2] + az * 0.3] : spread(i));
  const s5 = [...sam()], m5 = S.men()[0]; let apart = 0, moved5 = 0;
  for (let f = 0; f < 120; f++) { R.step(); moved5 = Math.max(moved5, flat(sam(), s5)); } apart = flat(m5.char.pos, sam());
  // 6. the player walked at a follower who stands (stepping out of his way held off): he is stopped at his keep-off, and does not come out the far side
  const asideM = ORDERS.asideM; ORDERS.asideM = 0; let nearest6 = 9, past6 = 9, back6 = 0;
  try {
    S.deal(p, i => i === 0 ? [p[0] + ax * 1.2, 0, p[2] + az * 1.2] : [p[0] + ax * (3 + 0.45 * i) + px * (i - 2) * 0.9, 0, p[2] + az * (3 + 0.45 * i) + pz * (i - 2) * 0.9]); R.step(60);
    const m6 = S.men()[0], to = [p[0] + ax * 3, 0, p[2] + az * 3];
    R.walk(to, 2.5, () => { nearest6 = Math.min(nearest6, flat(m6.char.pos, sam())); return false; });
    // … and walked past one's shoulder (the man a hand to the side of his line): he slides by at his keep-off, and the man is not made to step back
    S.deal(p, i => i === 0 ? [p[0] + ax * 1.2 + px * 0.3, 0, p[2] + az * 1.2 + pz * 0.3] : [p[0] + ax * (3 + 0.45 * i) + px * (i - 2) * 0.9, 0, p[2] + az * (3 + 0.45 * i) + pz * (i - 2) * 0.9]); R.step(60);
    const m7 = S.men()[0], back0 = NOSHOVE_STATS.back;
    R.walk(to, 2.5, () => { past6 = Math.min(past6, flat(m7.char.pos, sam())); return false; }); back6 = NOSHOVE_STATS.back - back0;
  } finally { ORDERS.asideM = asideM; }
  return { under, underSam, apart, moved5, nearest6, past6, back6 };
}

/** line 7: a teammate on a 'move' order walks through the standing player's spot, a foot to one side; a follower stands in the line of the shove */
async function pushed(on: boolean) {
  const S = await stand(), { R, g } = S, { p, ax, az } = S.open!, px = az, pz = -ax; NOSHOVE.on = on;
  const from = [p[0] - ax * 2.5 - px * 0.15, 0, p[2] - az * 2.5 - pz * 0.15], to = [p[0] + ax * 2.5 - px * 0.15, 0, p[2] + az * 2.5 - pz * 0.15];
  S.deal(p, i => i === 0 ? from : i === 1 ? [p[0] + px * 1.5, 0, p[2] + pz * 1.5] : [p[0] + ax * 1.2 * (i - 2.5) * 2 - px * 2.2, 0, p[2] + az * 1.2 * (i - 2.5) * 2 - pz * 2.2]);
  const W = S.men()[0], F = S.men()[1], idx = R.team.indexOf(W);
  const why = R.O.give('move', R.O.targetAt(to), idx); if (why) throw new Error(`noshove: 'move there' refused — ${why}`);
  const s0 = [...g.player.char.pos], f0 = [...F.char.pos]; let shoved = 0, samV = 0, moved = 0, nearest = 9;
  for (let f = 0; f < 300; f++) { R.step(); shoved = Math.max(shoved, flat(g.player.char.pos, s0)); samV = Math.max(samV, (R.O as any).samV); moved = Math.max(moved, flat(F.char.pos, f0)); nearest = Math.min(nearest, flat(W.char.pos, g.player.char.pos));
    if (f % 20 === 0) say(`${on ? 'on ' : 'off'} f${f} ${W.callsign} ${f2(flat(W.char.pos, g.player.char.pos))} m off the player, who is ${f3(flat(g.player.char.pos, s0))} m off his spot · pace read ${f2((R.O as any).samV)} · ${F.callsign} ${f2(flat(F.char.pos, f0))} m off his`); }
  return { shoved, samV, moved, nearest, follower: !!R.O.of(F) && R.O.of(F).post === null, mover: R.O.of(W)?.order, kept: NOSHOVE_STATS.notWalked as number };
}

/** line 9: the compound's room taken through k_p from its + face, a man left on the room's other door; the player stood inside, 'fall in', three seconds.
 *  null: the entry left nobody on another door on this stand */
async function keeper(mode: 'off' | 'own' | 'on') {
  const R = await rig('compound-four', 5), g = R.game, O = R.O; const room0 = REARWATCH.room;
  for (const k of Object.keys(NOSHOVE_STATS)) (NOSHOVE_STATS as any)[k] = 0;
  NOSHOVE.on = false; REARWATCH.room = true;
  try {
    for (const h of R.hostiles) if (h.state !== 'dead') R.put(h, [h.char.pos[0] + 400, 0, h.char.pos[2]]);
    R.step(30); const men = R.up as any[], d = g.doors.list.find((x: any) => x.def.name === 'k_p'), side = 1; if (!d || men.length < 3) return null;
    const F = stackRoomProbe(g, d, side); if (!F.floor) return null;
    const spots: V[] = []; for (const band of [[5, 14], [2, 30]]) for (const q of F.spots(band[0], band[1]) as V[]) { if (spots.length > men.length) break; if (spots.some(x => flat(x, q) < 1.1) || g.doors.list.some((x: any) => x !== d && flat(q, x.frameCentre) < 1.6)) continue; spots.push(q); }
    if (spots.length <= men.length) return null;
    for (const x of g.doors.list) { x.angle = 0; x.vel = 0; x.latched = true; x.closing = false; x.quietT = 10; x.locked = false; x.place(); }
    const c = d.frameCentre as V;
    men.forEach((m, i) => { const q = spots[i]; m.char.pos = [q[0], 0, q[2]]; m.char.vel = [0, 0, 0]; m.speed = 0; m.char.bodyYaw = m.char.aimYaw = Math.atan2(c[0] - q[0], c[2] - q[2]); m.path = []; m.pathGoal = null; m.char.update(0); });
    const out = spots[men.length]; g.teleportPlayer([out[0], 0, out[2]]); R.step(10);
    if (O.give('openClear', { kind: 'door', door: d, side }, 'all')) return null;
    for (let i = 0; i < 25 * 60; i++) { R.step(); if (i > 120 && !g.doorTools.ops.length) break; }
    R.step(30);
    const keepers: [any, any, any][] = g.doorTools.doorKeepers(); if (!keepers.length) return null;
    const room = g.fight.roomAt(keepers[0][0].char.pos); if (!room) return null;
    const th = d.def.closedDir, nx = -Math.sin(th), nz = Math.cos(th);
    const inside = ([1.6, 2.2, 1.1].flatMap(k => [[c[0] + nx * k, 0, c[2] + nz * k], [c[0] - nx * k, 0, c[2] - nz * k]]) as V[]).filter(q => sideOf(d, q) !== side && g.fight.roomAt(q) === room).map(q => ({ q, r: Math.min(...men.map(x => flat(x.char.pos, q))) })).filter(x => x.r >= 1.2).sort((a, b) => b.r - a.r)[0]?.q;
    if (!inside) return null;
    const near = keepers.find(k => g.fight.roomAt(k[0].char.pos) === room && flat(k[0].char.pos, inside) <= REARWATCH.roomM - 1); if (!near) return null; const m = near[0];
    NOSHOVE.on = mode !== 'off'; NOSHOVE.round = mode !== 'own';
    g.teleportPlayer([inside[0], 0, inside[2]]); R.step(2);
    O.give('fallIn', O.targetAt(g.player.char.pos), 'all');
    const p0 = [...m.char.pos], s0 = [...g.player.char.pos]; let moved = 0, shoved = 0, samV = 0, legs = 0;
    for (let i = 0; i < 180; i++) { R.step(); moved = Math.max(moved, flat(m.char.pos, p0)); shoved = Math.max(shoved, flat(g.player.char.pos, s0)); samV = Math.max(samV, (O as any).samV); legs = Math.max(legs, m.speed ?? 0); }
    return { who: m.callsign as string, moved, shoved, samV, legs, kept: !!roomKept(g, m) };
  } finally { REARWATCH.room = room0; NOSHOVE.round = true; }
}

export const noshoveCheck = guarded(async () => {
  const F = family('noshove: teammates falling in never shove you');
  const keep = { ns: { ...NOSHOVE }, rnd: Math.random, d: DESTRUCTION.on, w: WALLCHARGE.on, o: WALLCHARGE.outer };
  const BROKEN = process.env.NOSHOVE_BREAK === '1';
  try {
    if (BROKEN) console.log('  (NOSHOVE_BREAK: the module answers as with the switch off — lines 1 to 9 must fail)');
    const line = (a: Walk, b: Walk, what: string) => F.verdict(b.shoved > 0.1 && b.samV > 0.3 && a.shoved < 0.01 && a.samV < 0.05 && a.passed && a.arrived && a.nearest >= NOSHOVE.ring - 0.03 && a.stats.round > 0,
      what, `off: the player moved ${f2(b.shoved)} m, ${b.who} came to ${f2(b.nearest)} m of him, the squad read his pace as up to ${f2(b.samV)} m/s · on: moved ${f3(a.shoved)} m, ${a.who} no nearer than ${f2(a.nearest)} m, round him ${a.passed} and in his place ${a.arrived} (${f2(a.end)} m off), pace read ${f2(a.samV)} · frames turned round him ${a.stats.round}`);
    // ---- 1
    { const a = (await walk(true, { d: 0.58 }))!, b = (await walk(false, { d: 0.58 }))!;
      F.verdict(b.shoved > 0.1 && b.samV > 0.3 && a.shoved < 0.01 && a.samV < 0.05 && a.passed && a.nearest >= 0.55 && a.stats.round > 0, "the case it was found in: 'fall in' with a man a pace from the standing player, his place on the far side — the player is not moved, the man goes round (off: shouldered aside, and read as walking)",
        `off: the player moved ${f2(b.shoved)} m, ${b.who} came to ${f2(b.nearest)} m of him, the squad read his pace as up to ${f2(b.samV)} m/s · on: moved ${f3(a.shoved)} m, ${a.who} no nearer than ${f2(a.nearest)} m and round him ${a.passed}, pace read ${f2(a.samV)} · frames turned round him ${a.stats.round}`); }
    // ---- 2
    { const a = (await walk(true, { d: 2.5, nearOff: true }))!, b = (await walk(false, { d: 2.5, nearOff: true }))!;
      line(a, b, 'the walk from a distance, square on: he goes round the player and is in his place, the player not moved (off: shouldered aside)'); }
    { const a = (await walk(true, { d: 2.5, off: 0.3, nearOff: true }))!, b = (await walk(false, { d: 2.5, off: 0.3, nearOff: true }))!;
      line(a, b, 'the walk from a distance, a foot off his line: the same'); }
    // ---- 3
    { const a = await walk(true, { d: 2.4, nearOff: true, tight: true }), w = await walk(true, { d: 2.4, nearOff: true, tight: true, through: false }), b = await walk(false, { d: 2.4, nearOff: true, tight: true });
      if (!a || !w || !b) F.verdict(false, 'no room to go round: a passage to stand the player in', 'no passage near the start narrow enough that a man cannot pass one standing in its middle');
      else { F.verdict(a.shoved < 0.01 && a.passed && a.stats.through > 0 && a.samV < 0.05, 'no room to go round (the player stood in a passage): the man squeezes past and the player is not moved',
          `on: the player moved ${f3(a.shoved)} m, ${a.who} past him ${a.passed}, frames squeezing past ${a.stats.through} · off: the player moved ${f2(b.shoved)} m, pace read ${f2(b.samV)}`);
        F.verdict(w.shoved < 0.01 && !w.passed && w.nearest >= NOSHOVE.ring - 0.03 && w.stats.short > 0 && w.legs < 0.3 && w.stuck === 0, '… and with `through` off he stops short and waits, standing: never inside the ring, never past, the player not moved, no walking on the spot',
          `the player moved ${f3(w.shoved)} m, ${w.who} no nearer than ${f2(w.nearest)} m, past him ${w.passed}, frames held short ${w.stats.short} · his legs at ${f2(w.legs)} m/s over the last two seconds, the walker's stuck side-step woken ${w.stuck} times`); } }
    // ---- 4, 5, 6
    { const a = await close(true), b = await close(false);
      F.verdict(Math.abs(a.under - NOSHOVE.ring) < 0.02 && a.underSam < 1e-9 && !(Math.abs(b.under - NOSHOVE.ring) < 0.02), 'his place under the player: he stops short of it, at the ring (off: he walks in)',
        `on: ${f2(a.under)} m from the player after the stride (the ring is ${NOSHOVE.ring}), the player moved ${f3(a.underSam)} m · off: ${f2(b.under)} m`);
      F.verdict(a.moved5 < 0.01 && a.apart >= KEEP_OFF - 0.02 && b.moved5 > 0.03, 'set down on top of each other: the man steps back out and the player stays (off: the player is put out)',
        `on: the player moved ${f3(a.moved5)} m, ${f2(a.apart)} m apart after two seconds · off: the player moved ${f2(b.moved5)} m`);
      F.verdict(a.nearest6 >= KEEP_OFF - 0.02 && a.past6 >= KEEP_OFF - 0.004 && a.past6 < KEEP_OFF + 0.1 && a.back6 === 0, 'the player still cannot walk through a follower: walked at one under his own keys he gets no nearer than his keep-off, and walked past one\'s shoulder he slides by at it without the man being made to step back',
        `on: walked at him, no nearer than ${f2(a.nearest6)} m (his keep-off is ${KEEP_OFF}); past his shoulder, ${f3(a.past6)} m, frames the man stepped back ${a.back6} · off: ${f2(b.nearest6)} m, ${f3(b.past6)} m`); }
    // ---- 7
    { const a = await pushed(true), b = await pushed(false);
      F.verdict(a.follower && a.mover === 'move' && a.shoved > 0.1 && b.shoved > 0.1 && b.samV > 0.3 && b.moved > 0.3 && a.samV < 0.3 && a.moved < 0.1 && a.kept > 0,
        'a shove is not his walking: a teammate on another order walks into the standing player — still shouldered, but his pace reads under the walking bar and a follower in the line of the shove stays (off: he steps aside)',
        `on: the player moved ${f2(a.shoved)} m, pace read ${f2(a.samV)} m/s, the follower moved ${f2(a.moved)} m, frames a shove was kept out ${a.kept} · off: moved ${f2(b.shoved)} m, pace read ${f2(b.samV)}, the follower moved ${f2(b.moved)} m`); }
    // ---- 8
    { const S = await stand(), g = S.g, pl = g.player; NOSHOVE.on = true;
      // (the player's own step inside an update = where he is, less the shove, less where the update found him: staged through those three)
      const p = pl.char.pos, ask = (own: V, s: V, d: V = [own[0] + s[0], own[1] + s[1]]) => { pl.shovedT = g.time; pl.shoved[0] = s[0]; pl.shoved[1] = s[1]; pl.shovedFrom[0] = p[0] - own[0] - s[0]; pl.shovedFrom[1] = p[2] - own[1] - s[1]; return noShoveOwn(g, d[0], d[1]) as V | null; }, near = (r: V | null, x: number, z: number) => !!r && Math.abs(r[0] - x) < 1e-9 && Math.abs(r[1] - z) < 1e-9;
      const stood = ask([0, 0], [0.02, 0]), wall = ask([0.03, 0], [-0.03, 0]), part = ask([0.03, 0], [-0.01, 0]), side = ask([0.03, 0], [0, 0.02]), none = ask([0.03, 0.01], [0, 0]), door = ask([0, 0], [0.02, 0], [-0.04, 0.01]);
      NOSHOVE.own = false; const half = ask([0, 0], [0.02, 0]); NOSHOVE.own = true; NOSHOVE.on = false; const off = ask([0, 0], [0.02, 0]); pl.shoved[0] = pl.shoved[1] = 0; pl.shovedT = -1;
      F.verdict(near(stood, 0, 0) && near(wall, 0, 0) && near(part, 0.02, 0) && near(side, 0.03, 0) && near(none, 0.03, 0.01) && near(door, 0, 0) && half === null && off === null,
        'the arithmetic: a standing man shoved reads nothing (whatever a door did to him since the last tick); a walk into a man who stands reads the ground covered; a walk shouldered sideways reads the walk; no shove, as it was; not asked with `own` or the switch off',
        `shoved standing → ${JSON.stringify(stood)} · … a door having pushed him back since → ${JSON.stringify(door)} · walked into a man → ${JSON.stringify(wall)} · half stopped → ${JSON.stringify(part)} · shouldered sideways → ${JSON.stringify(side)} · no shove → ${JSON.stringify(none)} · own off → ${half} · switch off → ${off}`); }
    // ---- 9
    { const b = await keeper('off'), h = await keeper('own'), a = await keeper('on');
      const { harnessProfile } = await import(`${ROOT}/src/host/profile.ts`);
      if (!a || !b || !h) F.verdict(false, 'a room keeper: the compound\'s room with a man left on its other door', 'the entry left nobody on another door');
      // (the case is the page's: on the frozen stand the same entry leaves its men where 'fall in' walks nobody across the player — nothing to show there, said so)
      else if (harnessProfile() === 'frozen' && !BROKEN && b.shoved < 0.05) F.verdict(a.shoved < 0.01 && a.legs < 0.1 && a.kept && h.legs < 0.1 && h.kept, 'a room keeper: on this stand the entry stands nobody across the player, off or on (the case of the finding is the shipped stand\'s: run this check there) — the keeper stays either way',
        `off: the player moved ${f3(b.shoved)} m · own alone: ${f3(h.shoved)} m, the keeper's legs ${f2(h.legs)} · on: ${f3(a.shoved)} m, legs ${f2(a.legs)}, still keeping ${a.kept}`);
      else F.verdict(b.shoved > 0.1 && b.moved > 0.12 && b.legs > 0.3 && h.shoved > 0.1 && h.samV < 0.3 && h.legs < 0.1 && h.kept && a.shoved < 0.01 && a.samV < 0.3 && a.legs < 0.1 && a.moved < 0.05 && a.kept,
        'a room keeper (the case of the finding): off, the player is shoved and the keeper walks out of his way; `own` alone, the player is shoved and the keeper\'s legs stay still (a man walking by may jostle him); on, nobody is moved',
        `off: the player moved ${f2(b.shoved)} m, ${b.who} ${f2(b.moved)} m off his spot at up to ${f2(b.legs)} m/s (pace read off the player ${f2(b.samV)}) · own alone: ${f2(h.shoved)} m, ${f2(h.moved)} m, legs ${f2(h.legs)} m/s, still keeping ${h.kept} (pace read ${f2(h.samV)}) · on: ${f3(a.shoved)} m, ${f2(a.moved)} m, legs ${f2(a.legs)}, still keeping ${a.kept} (pace read ${f2(a.samV)})`); }
    // ---- 10
    { const J = await import(`${ROOT}/src/game/journal.ts`), R = await rig(SCN, 5), snap = () => JSON.parse(JSON.stringify(J.knobsSnapshot(R.game)));
      NOSHOVE.on = true; const old = snap(); delete old.tables.NOSHOVE; J.applyKnobs(R.game, old); const a = NOSHOVE.on;
      NOSHOVE.on = true; const yes = snap(); NOSHOVE.on = false; J.applyKnobs(R.game, yes); const b = NOSHOVE.on;
      NOSHOVE.on = false; const no = snap(); NOSHOVE.on = true; J.applyKnobs(R.game, no); const c = NOSHOVE.on;
      F.verdict(a === false && b === true && c === false, 'the journal: a recording from before the key replays with it off, one made with it on replays on, one made with it off replays off', `old → ${a} · recorded on → ${b} · recorded off → ${c}`); }
  } finally { Object.assign(NOSHOVE, keep.ns); Math.random = keep.rnd; DESTRUCTION.on = keep.d; WALLCHARGE.on = keep.w; WALLCHARGE.outer = keep.o; }
  return F.done();
});

if (import.meta.main) process.exit((await noshoveCheck()) ? 0 : 1);
