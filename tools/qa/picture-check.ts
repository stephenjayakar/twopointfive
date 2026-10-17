// EACH MAN'S OWN PICTURE OF THE FIGHT — the check behind PICTURE.on (src/game/picture.ts: on in the page, ?nopicture; off on the frozen stand, TPS_PICTURE=1).
//   bun run tools/qa/picture-check.ts        (also `probes.ts picture`)
// On the office with a squad of four (room-clear-four), one defender staged where the lines want him, everybody made proof against rounds:
//   (a) HIS OWN: a teammate with eyes on the defender has an idea of him, seen, where he stands; a teammate behind a wall has none (the net held shut);
//   (b) TOLD: the net open, the second man is told — the first man's place, as old as his sighting, by his name; the defender has his own idea of the man he sees;
//   (c) OUT OF DATE: the first man out of sight of the place, the defender walks off unseen — nobody's idea follows him: it stays where he was and grows older, and counts for less;
//   (d) LOST: the first man comes to the place and the man is not there — his idea is marked lost and counts for less again;
//   (e) SAFE: a spot in the believed place's line is exposed, one behind the wall is not; the spots come back safest first; an old idea reaches further (the
//       places he may have walked to);
//   (f) COVER: every place rated as cover is beside something solid and out of every believed line;
//   (g) BY EAR: a shot from a man nobody sees puts him, heard, where the sound came from;
//   (h) DOWN: a man dropped out of sight is still believed up; the man who sees the body knows, and the net is told;
//   (i) a checkpoint carries every idea, its age and how it was come by;
//   (j) the memory alone moves nothing: on with every rule that asks it off, the run digests as the run with the switch off;
//   (k) STAND-OFF: a door whose latch-side file is in a known enemy's line — the men are dealt the other file; the rule off, or the switch, the file as it was;
//   (l) COVER: a pinned man whose cover from the shooter is in a second known enemy's line shifts to a place hidden from both; the rule off, the place as it was;
//   (n) GRENADE: a man getting off a live grenade whose spot out of the blast is in a known enemy's line takes another the blast has no line to either; the
//       rule off, the spot as it was;
//   (p) STACK: at a door where a mark the walls deal is in a known enemy's line the order files on one hand of the door, plainly less seen, every mark on the
//       room's floor, none behind glass that was not, none in a doorway; men who stand on their marks keep them; the rule off, the marks as they were;
//   (o) FALL BACK: a defender giving his room up, who believes an enemy to be on the spot he would hold a door from, takes one out of that man's line; one
//       believed in the doorway, he leaves by another door or takes cover in the room; the rule off, the door and the spot as they were;
//   (q) STEP: a man in the file behind Sam, Sam standing, who learns his place is in an enemy's line takes cover a step or two off it that no believed
//       enemy has a line to, and keeps it; a man with a target in his eyes does not; the idea gone stale, his place is his again; the rule off, he keeps the place;
//   (r) DEALT AGAIN: the maintainer's tape (The pass, the charge on the bunk room's long wall): three men stood off with nobody known, then the team learns
//       of the men it knew of on the tape — a man whose mark is now under known fire is dealt one under less of it, still out of the blast, and walks to
//       it; nobody else moves; the rule off, every mark stays;
//   (s) A COLLEAGUE'S SHOT: a man who hears a colleague fire places the enemy where the SHOOTER believes him, as old as that word is; his own newer fix he keeps;
//       the rule off, the true place;
//   (m) WALL CHARGE: with the fog of war on and no record of a man, the stand-off's known enemies (wallcharge.ts knownFoes) have him where a teammate's
//       picture has him; the rule off, or an idea older than the stand-off counts, he is not known.
// PICTURE_BREAK=1 = the switch left off where the lines want it on: they are asked all the same and must fail.   exit 0 = all hold · 1 = one does not
import { resolve } from 'node:path';
const ROOT = resolve(import.meta.dir, '../..');
type Vec3 = [number, number, number];

export async function pictureCheck(): Promise<boolean> {
  const { rig } = (await import('./outerwall-probes.ts')) as any;
  const P = await import(`${ROOT}/src/game/picture.ts`);
  const { pictureTell, pictureReset, exposedFor } = P;
  const { coverFrom } = await import(`${ROOT}/src/game/suppression.ts`);
  const { WALLCHARGE } = await import(`${ROOT}/src/game/wallcharge.ts`);
  const { fleeSpot, FRAG, exposedTo: blastOn } = await import(`${ROOT}/src/game/frag.ts`);
  const { stackRoomHas } = await import(`${ROOT}/src/game/stackroom.ts`);
  const { doorwayInWay } = await import(`${ROOT}/src/game/doorway.ts`);
  const { PICTURE, PICTURE_STATS, ideaOf, ideasOf, ideaWeight, ideaReach, exposedAt, exposureAsker, safestSets, coverNear, pictureSummary, pictureViews } = P;
  const { pictureSnapshot, pictureRestore } = P;
  const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);
  const { lightEstimateAt } = await import(`${ROOT}/src/game/guards.ts`);
  const { hearPath } = await import(`${ROOT}/src/game/weather.ts`);
  const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
  const BREAK = process.env.PICTURE_BREAK === '1', ON = !BREAK; let all = true;
  const line = (ok: boolean, s: string, detail = '') => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}${detail ? `\n    ${detail}` : ''}`); };
  const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]), f2 = (x: number) => x.toFixed(2), at = (p: number[]) => `(${p[0].toFixed(1)}, ${p[2].toFixed(1)})`;
  const yawTo = (a: number[], b: number[]) => Math.atan2(b[0] - a[0], b[2] - a[2]);
  const was = { rnd: Math.random, pic: JSON.parse(JSON.stringify(PICTURE)) };
  console.log('\n=== picture: each man keeps his own picture of the fight ===');
  /** the office, a squad of four, the other side deaf and planted; everybody proof against rounds; one defender H, the rest out of the way */
  const stand = async (seed: number, on: boolean) => {
    const R = await rig('room-clear-four', seed), g = R.game, col = g.col, nav = col.nav;
    Object.assign(PICTURE, JSON.parse(JSON.stringify(was.pic)), { on });
    for (const k of Object.keys(PICTURE_STATS)) (PICTURE_STATS as any)[k] = 0;
    for (const gd of g.guards) gd.god = true; g.godMode = true;
    const sees = (a: number[], b: number[]) => !col.segmentBlocked([a[0], 1.6, a[2]], [b[0], 1.1, b[2]]) || !col.segmentBlocked([a[0], 1.6, a[2]], [b[0], 1.6, b[2]]) || !col.segmentBlocked([a[0], 1.45, a[2]], [b[0], 1.15, b[2]]) || !col.segmentBlocked([a[0], 1.45, a[2]], [b[0], 0.7, b[2]]);
    const either = (a: number[], b: number[]) => sees(a, b) || sees(b, a);
    const cells: Vec3[] = []; for (let x = 1; x < nav.W - 1; x += 2) for (let z = 1; z < nav.H - 1; z += 2) { const p: Vec3 = [(x + 0.5) * nav.cell, 0, (z + 0.5) * nav.cell]; if (!nav.isBlocked(p[0], p[2]) && [[0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]].every(([dx, dz]) => !nav.isBlocked(p[0] + dx, p[2] + dz))) cells.push(p); }
    const pins = new Map<any, number[]>();   // (every staged man is put back on his place each frame: the shipped stand's rules walk a planted defender about)
    const hold = (gd: any, p: number[], to: number[]) => { const c = gd.char; c.pos[0] = p[0]; c.pos[2] = p[2]; c.bodyYaw = c.aimYaw = yawTo(p, to); gd.path = []; gd.pathGoal = null; pins.set(gd, [p[0], 0, p[2]]);
      if (gd.team === 'operative') g.orders.assign(gd, { order: 'hold', post: [p[0], 0, p[2]], face: yawTo(p, to), going: 'holding', there: 'holding' }); else { gd.script = null; gd.hold = true; gd.pinned = true; } };
    const pin = () => { for (const [gd, p] of pins) if (gd.state !== 'dead') { gd.char.pos[0] = p[0]; gd.char.pos[2] = p[2]; } };
    return { R, g, col, nav, cells, sees, either, hold, pins, step: (secs: number) => { for (let i = 0; i < Math.round(secs * 60); i++) { pin(); R.step(1); } pin(); } };
  };
  /** the places of the staging: h (the defender), a (sees h from 5-9 m), b (hidden from h, 6 m or more off), h2 (where he walks to: hidden from a and b, 5 m or more
   *  from h), far (everybody else: hidden from all four) */
  const places = (s: Awaited<ReturnType<typeof stand>>) => {
    const { cells, either } = s, lit = (p: number[]) => lightEstimateAt(s.g, [p[0], 1.1, p[2]]) as number, bright = cells.filter(q => lit(q) > 0.3);   // (a night level: a man is seen where the light is)
    const hears = (from: number[], ear: number[]) => { const pr = hearPath(s.g, [from[0], 1, from[2]], [ear[0], 1.5, ear[2]]); return pr.direct || pr.routed; };
    for (const h of bright) {
      const floorSeen = (q: number[]) => !s.col.segmentBlocked([q[0], 1.6, q[2]], [h[0], 0.3, h[2]]) && !s.col.segmentBlocked([q[0], 1.6, q[2]], [h[0], 1.1, h[2]]) && !s.col.segmentBlocked([h[0], 1.6, h[2]], [q[0], 1.15, q[2]]);   // (open floor between them: the place itself, and a man lying on it, can be seen)
      const a = bright.find(q => flat(q, h) >= 4 && flat(q, h) <= 9 && s.sees(q, h) && s.sees(h, q) && floorSeen(q)); if (!a) continue;
      const b = cells.find(q => flat(q, h) >= 5 && flat(q, a) >= 3 && !either(q, h) && s.nav.findPath(q, a)); if (!b) continue;
      const h2 = cells.find(q => flat(q, h) >= 5 && !either(q, a) && !either(q, b) && !either(q, h) && hears(q, b)); if (!h2) continue;
      const far = cells.filter(q => [h, a, b, h2].every(p => !either(q, p) && flat(q, p) > 4)); if (far.length < 8) continue;
      return { h, a, b, h2, far };
    }
    return null;
  };

  try {
    const s = await stand(3, ON), { g, R } = s, L = places(s);
    if (!L) { line(false, 'a place on the office to stage it'); return false; }
    const [A, B, ...rest] = R.up as any[], H = R.hostiles[0], others = R.hostiles.slice(1), H2 = others[0], H3 = others[1];
    const park = () => { [...rest, ...others].forEach((gd: any, i: number) => s.hold(gd, L.far[i % L.far.length], L.far[(i + 1) % L.far.length])); g.teleportPlayer(L.far[L.far.length - 1]); };
    const awayFrom = (p: number[], q: number[]): Vec3 => [2 * p[0] - q[0], 0, 2 * p[2] - q[2]];
    console.log(`  — the defender at ${at(L.h)}, the man who sees him at ${at(L.a)}, the man behind a wall at ${at(L.b)}, where he walks to ${at(L.h2)}`);
    // (a) his own
    PICTURE.tellSecs = 1e9;
    park(); s.hold(H, L.h, L.a); s.hold(A, L.a, L.h); s.hold(B, L.b, awayFrom(L.b, L.h)); s.step(0.1); park(); s.hold(H, L.h, L.a); s.hold(A, L.a, L.h); s.hold(B, L.b, awayFrom(L.b, L.h)); s.step(0.6);
    { const IA = ideaOf(g, A, H), IB = ideaOf(g, B, H);
      line(!!IA && IA.how === 'seen' && flat(IA.at, H.char.pos) < 0.5 && g.time - IA.t < 0.5 && !IB, 'his own: the man with eyes on the defender has an idea of him, seen, where he stands; the man behind the wall has none',
        `${A.callsign}: ${IA ? `${IA.how} at ${at(IA.at)}, ${f2(g.time - IA.t)} s old` : 'no idea'} · ${B.callsign}: ${IB ? `${IB.how} at ${at(IB.at)}` : 'no idea'} · the defender stands at ${at(H.char.pos)}`); }
    // (b) told
    PICTURE.tellSecs = was.pic.tellSecs; s.step(was.pic.tellSecs + 1.2);
    { const IA = ideaOf(g, A, H), IB = ideaOf(g, B, H), IH = ideaOf(g, H, A);
      line(!!IA && !!IB && IB.how === 'told' && IB.by === A && flat(IB.at, IA.at) < 1 && IB.t <= IA.t + 1e-6, 'told: the net open, the second man is told — the first man\'s place, no fresher than his sighting, by his name',
        `${B.callsign}: ${IB ? `${IB.how} by ${IB.by?.callsign ?? 'nobody'} at ${at(IB.at)}, ${f2(g.time - IB.t)} s old` : 'no idea'} · ${A.callsign}'s own is ${IA ? f2(g.time - IA.t) : '-'} s old`);
      line(!!IH && IH.how !== 'told' && !ideaOf(g, H, B), 'both sides: the defender has his own idea of the man in front of him (his eyes, the man\'s fire, or the place his own senses work from), and none of the man behind the wall',
        `the defender: ${ideasOf(g, H).map((I: any) => `${I.who === 'player' ? 'Sam' : I.who.callsign} ${I.how} at ${at(I.at)}`).join(', ') || 'no idea'}`); }
    // (c) out of date — the first man steps out of sight of the place (a hold order faces a man its own way: where he stands is what a line can set), the defender walks off unseen
    const a2 = L.far[0];
    const fresh = { w: ideaOf(g, A, H) ? ideaWeight(g, ideaOf(g, A, H)) : 0, e: exposedAt(g, A, L.a) };
    s.hold(A, a2, awayFrom(a2, L.h)); s.step(0.5); s.hold(H, L.h2, awayFrom(L.h2, L.h)); s.step(8);
    { const IA = ideaOf(g, A, H), IB = ideaOf(g, B, H), w = IA ? ideaWeight(g, IA) : 0;
      line(!!IA && !!IB && flat(IA.at, L.h) < 0.5 && flat(IB.at, L.h) < 1 && flat(H.char.pos, L.h) > 4 && g.time - IA.t > 7.5 && !IA.lost && w < fresh.w - 0.1 && w > 0.3,
        'out of date: the defender walks off unseen and nobody\'s idea follows him — it stays where he was, grows older and counts for less',
        `${A.callsign}'s idea: ${IA ? `at ${at(IA.at)}, ${f2(g.time - IA.t)} s old, weight ${f2(w)} (it was ${f2(fresh.w)})` : 'gone'} · he stands at ${at(H.char.pos)}, ${f2(flat(H.char.pos, L.h))} m off`);
      // (e) safe, on the old idea
      const eA = exposedAt(g, A, L.a), eB = exposedAt(g, A, L.b), order = (safestSets(g, [A], [[{ pos: L.a as Vec3 }], [{ pos: L.b as Vec3 }]]) as { pos: Vec3 }[][]).map(S => S[0].pos), reach = IA ? ideaReach(g, IA) : 0;
      line(fresh.e > 0.9 && eA > 0.2 && eA < fresh.e && eB === 0 && order[0] === L.b && order[1] === L.a && reach > 3,
        'safe: the spot in the believed place\'s line is exposed (less so as the idea ages), the one behind the wall is not, the spots come back safest first, and an old idea reaches further',
        `exposed where he stands: ${f2(fresh.e)} fresh, ${f2(eA)} at ${f2(IA ? g.time - IA.t : 0)} s · behind the wall ${f2(eB)} · safest first: ${order.map(at).join(' then ')} · he may have walked ${f2(reach)} m`);
      // (f) cover
      const cov = coverNear(g, A, L.a, 8, 6) as any[], solid = (q: number[]) => [[0.75, 0], [-0.75, 0], [0, 0.75], [0, -0.75]].some(([dx, dz]) => s.nav.isBlocked(q[0] + dx, q[2] + dz));
      line(cov.length > 0 && cov.every(c => solid(c.at) && (c.stand === 0 || c.low === 0) && exposedAt(g, A, c.at, c.stand > 0) === 0) && cov.every((c, i) => i === 0 || cov[i - 1].score >= c.score),
        'cover: every place he rates is beside something solid and out of every believed line, best first', `${cov.length} places: ${cov.map(c => `${at(c.at)} ${c.stand > 0 ? 'low' : 'whole'}${c.edge ? ' edge' : ''} ${f2(c.score)}`).join(' · ')}`); }
    // (d) lost — he comes to the place itself
    { const w0 = ideaOf(g, A, H) ? ideaWeight(g, ideaOf(g, A, H)) : 0; s.hold(A, L.h, L.a); s.step(0.6); const IA = ideaOf(g, A, H), w1 = IA ? ideaWeight(g, IA) : 0;
      line(!!IA && IA.lost && flat(IA.at, L.h) < 0.5 && w1 < w0 * 0.7, 'lost: he comes to the place and the man is not there — the idea is marked lost and counts for less again', `lost ${IA?.lost} · weight ${f2(w0)} → ${f2(w1)}`); }
    // (g) by ear — a shot from where nobody sees him
    { const b4 = PICTURE_STATS.heard; g.events.push({ kind: 'guardShot', pos: [L.h2[0], 0, L.h2[2]], time: g.time, loud: true, level: 1, who: H.char.id }); s.step(0.1); const IB = ideaOf(g, B, H);
      line(!!IB && IB.how === 'heard' && g.time - IB.t < 0.3 && PICTURE_STATS.heard > b4, 'by ear: a shot from a man nobody sees puts him, heard, where the sound came from', `${B.callsign}: ${IB ? `${IB.how} at ${at(IB.at)} (the muzzle was at ${at(L.h2)})` : 'no idea'}`); }
    // (i) a checkpoint carries it
    { const list = () => (R.up as any[]).concat(R.hostiles).map((gd: any) => ideasOf(g, gd).map((I: any) => `${I.who === 'player' ? 'Sam' : I.who.callsign}:${I.how}:${at(I.at)}:${(g.time - I.t).toFixed(1)}:${I.lost}:${I.by?.callsign ?? '-'}`).sort().join(',')).join(' | ');
      const before = list(), snap = pictureSnapshot(g), kept = snap ? JSON.parse(JSON.stringify(snap)) : snap; s.step(3); const moved = list(); pictureRestore(g, kept); const after = list();   // (the slice itself, through JSON as a file carries it: a room clear's spawned units keep the whole checkpoint from being taken)
      line(before === after && before !== moved && before.length > 20 && (ON ? !!snap : !snap), 'a checkpoint carries every idea, its age and how it was come by', before === after ? `${before.split('|').filter((x: string) => x.trim()).length} men with ideas` : `before: ${before}\n    after:  ${after}`); }
    // (h) down, out of sight
    { PICTURE.tellSecs = 1e9; s.hold(A, a2, awayFrom(a2, L.h)); s.hold(B, L.b, awayFrom(L.b, L.h)); s.step(0.3); s.hold(H, L.h, L.a); s.step(0.2); H.god = false; killGuard(g, H, [0, 0, 1], true, 'struck'); s.step(1.5);
      const still = !!ideaOf(g, A, H) && !!ideaOf(g, B, H);
      s.hold(A, L.h, L.a); s.step(0.6); const knows = !ideaOf(g, A, H), notYet = !!ideaOf(g, B, H);
      PICTURE.tellSecs = was.pic.tellSecs; s.step(was.pic.tellSecs + 1.2); const told = !ideaOf(g, B, H);
      line(still && knows && notYet && told, 'down: a man dropped out of sight is still believed up; the man who sees the body knows; his net is told', `believed up by both after he fell: ${still} · the man who sees the body drops him: ${knows} · the other still believes it: ${notYet} · told: ${told}`); }
    line((pictureSummary(g) as string).startsWith(ON ? 'picture ▸ ' : 'picture ▸ off') && (ON ? PICTURE_STATS.seen > 0 && PICTURE_STATS.told > 0 : true), 'the panel line reads', (pictureSummary(g) as string).slice(0, 220));
    // the view: the man under the cursor
    { PICTURE.show = 'cursor'; g.aimPoint[0] = A.char.pos[0]; g.aimPoint[2] = A.char.pos[2]; const V = pictureViews(g) as any[]; PICTURE.show = 'off';
      line(V.length === 1 && V[0].gd === A, 'the floor view is the picture of the man under the cursor', V.length ? `${V[0].gd.callsign}: ${V[0].ideas.length} ideas, ${V[0].unsafe.length} cells in a believed line, ${V[0].cover.length} cover places` : 'no view'); }

    // (k) stand-off at a door: the file no known enemy has a line to
    { const D = g.doorTools, men = [A, B], same = (x: any[] | null, y: any[] | null) => JSON.stringify(x?.map(q => q.pos)) === JSON.stringify(y?.map(q => q.pos)); let found: string | null = null, tried = 0;
      PICTURE.tellSecs = 1e9; pictureReset(g);
      search: for (const d of g.doors.list) for (const side of [1, -1] as const) {
        pictureReset(g); const p0 = D.standoffPosts(d, side, 2, men); if (!p0) continue;
        for (const q of s.cells) { if (flat(q, p0[0].pos) > 12 || flat(q, p0[0].pos) < 3 || !s.sees(q, p0[0].pos)) continue; if (++tried > 4000) break search;
          pictureReset(g); pictureTell(g, A, H2, q); const p1 = D.standoffPosts(d, side, 2, men); if (!p1 || same(p0, p1)) continue;
          const e0 = Math.max(...p0.map((x: any) => exposedFor(g, men, x.pos))), e1 = Math.max(...p1.map((x: any) => exposedFor(g, men, x.pos)));
          PICTURE.standoff = false; const pOff = D.standoffPosts(d, side, 2, men); PICTURE.standoff = true; PICTURE.on = false; const pSw = D.standoffPosts(d, side, 2, men); PICTURE.on = ON;
          found = `door ${d.def.name ?? '?'} face ${side}: the file at ${p0.map((x: any) => at(x.pos)).join(' ')} is ${f2(e0)} exposed to a man believed at ${at(q)}; dealt ${p1.map((x: any) => at(x.pos)).join(' ')}, ${f2(e1)} exposed · rule off: ${same(pOff, p0) ? 'as it was' : 'DIFFERS'} · switch off: ${same(pSw, p0) ? 'as it was' : 'DIFFERS'}`;
          line(e1 < e0 && same(pOff, p0) && same(pSw, p0), 'stand-off: at a door whose first file is in a known enemy\'s line the men are dealt the other file; the rule off, or the switch, the file as it was', found); break search; } }
      if (!found) line(false, 'stand-off: at a door whose first file is in a known enemy\'s line the men are dealt the other file', `no door on the office where a believed enemy changes the file (${tried} places tried)`); }
    // (l) cover from every known enemy
    { let found = false, tried = 0; PICTURE.tellSecs = 1e9;
      search: for (const m of s.cells) for (const t1 of s.cells) { if (flat(m, t1) < 6 || flat(m, t1) > 10 || !s.sees(t1, m)) continue; if (++tried > 300) break search;
        s.pins.clear(); A.char.pos[0] = m[0]; A.char.pos[2] = m[2]; pictureReset(g); const c0 = coverFrom(g, A, t1) as Vec3 | null; if (!c0) continue;
        const t2 = s.cells.find(q => flat(q, c0) > 3 && flat(q, c0) < 12 && flat(q, t1) > 4 && !s.col.segmentBlocked([q[0], 1.6, q[2]], [c0[0], 0.7, c0[2]])); if (!t2) continue;
        pictureTell(g, A, H2, t1); pictureTell(g, A, H3, t2); const c1 = coverFrom(g, A, t1) as Vec3 | null; if (!c1 || flat(c1, c0) < 0.3) continue;
        const e0 = exposedAt(g, A, c0, true), e1 = exposedAt(g, A, c1, true); PICTURE.cover = false; const cOff = coverFrom(g, A, t1) as Vec3 | null; PICTURE.cover = true;
        found = true; line(e0 > 0.15 && e1 <= 0.15 && !!cOff && flat(cOff, c0) < 0.01, 'cover: a pinned man whose cover from the shooter is in a second known enemy\'s line shifts to a place hidden from both; the rule off, the place as it was',
          `pinned at ${at(m)} by a man at ${at(t1)}: the old place ${at(c0)} is ${f2(e0)} exposed to a second man believed at ${at(t2)}; dealt ${at(c1)}, ${f2(e1)} exposed · rule off: ${cOff ? at(cOff) : 'none'}`); break search; }
      if (!found) line(false, 'cover: a pinned man whose cover from the shooter is in a second known enemy\'s line shifts to a place hidden from both', `no such place found on the office (${tried} tried)`); }
    // (n) off a grenade: the spot out of the blast that no known enemy sees
    { let found = false, tried = 0; const blastHid = (gr: Vec3, p: Vec3) => blastOn(g, [gr[0], gr[1] + FRAG.lift, gr[2]], p, [p[0], 1.15, p[2]]) <= 0;
      search: for (const m of s.cells) for (const [dx, dz] of [[1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5]]) { const gr: Vec3 = [m[0] + dx, 0.05, m[2] + dz]; if (s.g.col.nav.isBlocked(gr[0], gr[2]) || blastHid(gr, m as Vec3)) continue; if (++tried > 400) break search;
        s.pins.clear(); A.char.pos[0] = m[0]; A.char.pos[2] = m[2]; pictureReset(g); const p0 = fleeSpot(g, A.char, gr, 3, 2.5, Infinity, undefined, A) as Vec3 | null; if (!p0 || !blastHid(gr, p0)) continue;
        const t2 = s.cells.find(q => flat(q, p0) > 4 && flat(q, p0) < 14 && !s.col.segmentBlocked([q[0], 1.6, q[2]], [p0[0], 0.7, p0[2]])); if (!t2) continue;
        pictureTell(g, A, H2, t2); const p1 = fleeSpot(g, A.char, gr, 3, 2.5, Infinity, undefined, A) as Vec3 | null; if (!p1 || flat(p1, p0) < 0.3) continue;
        const e0 = exposedAt(g, A, p0, true), e1 = exposedAt(g, A, p1, true); if (!(e0 >= 0.5)) continue; PICTURE.flee = false; const pOff = fleeSpot(g, A.char, gr, 3, 2.5, Infinity, undefined, A) as Vec3 | null; PICTURE.flee = true;
        const kOn = fleeSpot(g, A.char, gr, 3, 2.5, Infinity, { path: [], keep: p1 }, A), kOff = fleeSpot(g, A.char, gr, 3, 2.5, Infinity, { path: [], keep: p0 }, A) as Vec3 | null;   // (the leg he is on: a hidden one is his still; one in a firm line is left)
        const many = exposureAsker(g, A, true); found = true; line(e0 > 0 && e1 < e0 && !!many && many(p0) === e0 && many(p1) === e1 && blastHid(gr, p1) && !!pOff && flat(pOff, p0) < 0.01 && kOn === p1 && !!kOff && kOff !== p0 && exposedAt(g, A, kOff, true) < e0 && blastHid(gr, kOff), 'grenade: a man whose spot out of the blast is in a known enemy\'s line takes another the blast has no line to either; the rule off, the spot as it was',
          `a grenade at ${at(gr)}, the man at ${at(m)}: the old spot ${at(p0)} is ${f2(e0)} exposed to a man believed at ${at(t2)}; dealt ${at(p1)}, ${f2(e1)} exposed, out of the blast's line · rule off: ${pOff ? at(pOff) : 'none'} · already on his way to the new spot: kept ${kOn === p1} · on his way to the old one: turned to ${kOff ? at(kOff) : 'none'}`); break search; }
      if (!found) line(false, 'grenade: a man whose spot out of the blast is in a known enemy\'s line takes another the blast has no line to either', `no such place found on the office (${tried} tried)`); pictureReset(g); }
    // (p) the stack: the hand of the door no known enemy sees — read on the marks stackPosts hands out, after every rule above the makers
    { const O: any = g.orders, men = [A, B, ...rest].filter((x: any) => x.state !== 'dead').slice(0, 4), same = (x: any[] | null, y: any[] | null) => JSON.stringify(x?.map(q => q.pos)) === JSON.stringify(y?.map(q => q.pos)); let found = false, tried = 0;
      const sumOf = (P: any[]) => P.reduce((a: number, q: any) => a + exposedFor(g, men, q.pos), 0);
      PICTURE.tellSecs = 1e9; pictureReset(g);
      search: for (const d of g.doors.list) for (const side of [1, -1] as const) {
        pictureReset(g); const p0 = O.stackPosts(d, side, men) as any[] | null; if (!p0 || p0.length < men.length) continue;
        for (const q of s.cells) { if (flat(q, p0[0].pos) > 12 || flat(q, p0[0].pos) < 3 || !p0.some((m: any) => s.sees(q, m.pos))) continue; if (++tried > 6000) break search;
          pictureReset(g); pictureTell(g, A, H2, q); const p1 = O.stackPosts(d, side, men) as any[] | null; if (!p1 || same(p0, p1)) continue;
          const s0 = sumOf(p0), s1 = sumOf(p1), again = O.stackPosts(d, side, men) as any[] | null;
          const floor = p1.every((m: any) => stackRoomHas(g, d, side, m.pos)), way = p1.every((m: any) => m.lead || !doorwayInWay(g, m.pos)), walk = p1.every((m: any) => !!s.nav.findPath(p0[0].pos, m.pos)?.length || flat(p0[0].pos, m.pos) < 0.5);
          const glass = (p0.some((m: any) => O.behindGlass(d, side, m.pos)) || !p1.some((m: any) => O.behindGlass(d, side, m.pos))) && p1.reduce((a: number, m: any) => a + O.glassEyes(d, side, m.pos), 0) <= p0.reduce((a: number, m: any) => a + O.glassEyes(d, side, m.pos), 0);
          const hands = new Set(p1.map((m: any) => Math.sign((m.pos[0] - d.frameCentre[0]) * Math.cos(d.def.closedDir) + (m.pos[2] - d.frameCentre[2]) * Math.sin(d.def.closedDir))));
          PICTURE.stack = false; const pOff = O.stackPosts(d, side, men); PICTURE.stack = true; PICTURE.on = false; const pSw = O.stackPosts(d, side, men); PICTURE.on = ON;
          // (men who stand on the marks they were dealt keep them: the choice is made when the marks are first dealt)
          const pinsWas = new Map(s.pins), placeWas = men.map((m: any) => [...m.char.pos]);
          men.forEach((m: any, i: number) => { m.char.pos[0] = p0[i].pos[0]; m.char.pos[2] = p0[i].pos[2]; O.assign(m, { order: 'stack', post: [...p0[i].pos], face: p0[i].face, door: d, going: 'stacking', there: 'stacked' }); });
          const pOwn = O.stackPosts(d, side, men) as any[] | null;
          men.forEach((m: any, i: number) => { m.char.pos[0] = p1[i].pos[0]; m.char.pos[2] = p1[i].pos[2]; O.assign(m, { order: 'stack', post: [...p1[i].pos], face: p1[i].face, door: d, going: 'stacking', there: 'stacked' }); });
          const pFile = O.stackPosts(d, side, men) as any[] | null;   // (… and men who stand on the FILE keep the file: the next ask does not walk two of them back across the door)
          pictureReset(g); const pFileGone = O.stackPosts(d, side, men) as any[] | null; pictureTell(g, A, H2, q);   // (with no idea of anybody left, the marks are the walls' own again: the build as it was)
          men.forEach((m: any, i: number) => { const w = pinsWas.get(m) ?? placeWas[i]; s.hold(m, w, [w[0], 0, w[2] + 1]); });
          found = true; line(s0 >= 0.5 && s1 <= PICTURE.stackK * s0 && hands.size === 1 && floor && way && walk && glass && same(again, p1) && same(pOff, p0) && same(pSw, p0) && same(pOwn, p0) && same(pFile, p1),
            'stack: at a door where a mark the walls deal is in a known enemy\'s line the order files on one hand of it, plainly less seen — on the room\'s floor, out of doorways, behind no glass that was not; asked again, the same; men standing on their marks keep them; the rule off, or the switch, the marks as they were',
            `door ${d.def.name ?? '?'} face ${side}, ${men.length} men: the marks ${p0.map((x: any) => at(x.pos)).join(' ')} sum ${f2(s0)} exposed to a man believed at ${at(q)}; dealt ${p1.map((x: any) => at(x.pos)).join(' ')}, sum ${f2(s1)} · one hand ${hands.size === 1} · floor ${floor} · doorways ${way} · walk ${walk} · glass ${glass} · men standing on the walls' marks keep them ${same(pOwn, p0)} · men standing on the file keep it ${same(pFile, p1)} (nobody known: ${same(pFileGone, p1) ? 'the file' : 'the walls\' marks'}) · rule off ${same(pOff, p0) ? 'as it was' : 'DIFFERS'} · switch off ${same(pSw, p0) ? 'as it was' : 'DIFFERS'}`); break search; } }
      if (!found) line(false, 'stack: at a door where a mark the walls deal is in a known enemy\'s line the order files on one hand of it', `no door on the office where a believed enemy changes the stack (${tried} places tried)`); pictureReset(g); }
    // (o) the enemy's fall-back: no door a believed enemy is at (a stand of its own: every defender in the room he was dealt)
    { let found = false, tried = 0; const why: string[] = [];
      search: for (const seed of [3, 1, 2, 5, 7, 9, 11, 4]) { const t = await stand(seed, ON), G: any = t.g, fight: any = G.fight; const op = G.guards.find((x: any) => x.team === 'operative' && x.state !== 'dead');
        const deal = (D: any) => { const keep = { ...D }, gd = D.gd, sc = gd.script, pinned = gd.pinned, hold = gd.hold, st = { ...fight.stats }; fight.breakOff(D);
          const out = { kind: D.mode === 'move' ? D.moveKind as string : 'none', door: D.cameBy as any, spot: (gd.script?.goal ? [...gd.script.goal] : null) as Vec3 | null };
          Object.assign(D, keep); gd.script = sc; gd.pinned = pinned; gd.hold = hold; Object.assign(fight.stats, st); return out; };
        for (const D of fight.defs as any[]) { if (D.gd.state === 'dead' || !D.room || (D.room.entries?.length ?? 0) < 1 || !op) continue; tried++;
          pictureReset(G); D.gd.state = 'alert'; const r0 = deal(D); if (r0.kind !== 'fallback' || !r0.door || !r0.spot) { why.push(`${seed}:${r0.kind}${r0.door ? '' : '/no door'}`); continue; }
          pictureTell(G, D.gd, op, r0.spot); const e0 = exposedAt(G, D.gd, r0.spot), r1 = deal(D);
          const e1 = r1.spot ? exposedAt(G, D.gd, r1.spot) : 0; if (!(r1.kind === 'fallback' && r1.door === r0.door)) { why.push(`${seed}:no hidden spot beyond the same door`); continue; }   // (the case that proves the spot rule: the same door, another spot)
          const E = D.room.entries.find((e: any) => e.door === r0.door), mouth: Vec3 = [E.at[0] + E.out[0], 0, E.at[2] + E.out[1]];
          pictureReset(G); pictureTell(G, D.gd, op, mouth); const r2 = deal(D);   // (a man believed in the doorway itself: not that door)
          PICTURE.fallback = false; const rOff = deal(D); PICTURE.fallback = true;
          const says = (r: typeof r1) => r.kind === 'fallback' ? `out by ${r.door.def.name} to ${at(r.spot!)}` : r.kind === 'cover' ? `cover in the room at ${r.spot ? at(r.spot) : '?'}` : 'stays';
          const off1 = !!r1.spot && e1 <= 0 && flat(r1.spot, r0.spot) >= 2, off2 = r2.kind !== 'fallback' || r2.door !== r0.door;
          found = true; line(e0 > 0 && off1 && off2 && rOff.kind === 'fallback' && rOff.door === r0.door && !!rOff.spot && flat(rOff.spot, r0.spot) < 0.01,
            'fall back: a defender who believes an enemy to be on the spot he would hold a door from takes one out of that man\'s line; one believed in the doorway, he leaves by another door or takes cover in the room; the rule off, the door and the spot as they were',
            `seed ${seed}, the defender at ${at(D.gd.char.pos)}: as it was, ${says(r0)} · told of a man on that spot (it is ${f2(e0)} exposed to him): ${says(r1)}, ${f2(e1)} exposed · told of a man in that doorway: ${says(r2)} · rule off: ${says(rOff)}`); break search; } }
      if (!found) line(false, 'fall back: a defender who believes an enemy to be on the spot he would hold a door from takes one out of that man\'s line', `no defender on the office falls back through a door as dealt (${tried} tried: ${why.slice(0, 12).join(' ')})`); Object.assign(PICTURE, JSON.parse(JSON.stringify(was.pic)), { on: ON }); }
    // (m) the wall charge's known enemies: the fog's record and the squad's pictures, the freshest of each man
    { const fog = g.fogOfWar, C = g.wallCharge, was = { on: fog.on, recs: g.guards.map((h: any) => [h, fog.recs.get(h)] as [any, any]) }, spot: Vec3 = [L.h2[0], 0, L.h2[2]], old: Vec3 = [L.h[0], 0, L.h[2]];
      const n = () => (C.knownFoes() as Vec3[]), has = (K: Vec3[], q: Vec3) => K.some(k => flat(k, q) < 0.01), rec = (age: number) => fog.recs.set(H2, { seen: false, t: g.time - age, at: [old[0], 0, old[2]], body: false, smoked: false, smokeF: -1e9 });
      try {
        s.pins.clear(); pictureReset(g); fog.on = true; for (const h of g.guards) fog.recs.delete(h);
        const act = !!fog.active, k0 = n().length; pictureTell(g, A, H2, spot, 5); const k1 = n(); PICTURE.wall = false; const kOff = n().length; PICTURE.wall = true;
        pictureReset(g); pictureTell(g, A, H2, spot, WALLCHARGE.fireKnownS + 1); const kOld = n().length;
        // (the fog saw him at one place 20 s ago; a teammate has him somewhere else 2 s ago — the fresher word is where he is known; the other way about, the fog's)
        pictureReset(g); rec(20); pictureTell(g, A, H2, spot, 2); const kNew = n(); pictureReset(g); pictureTell(g, A, H2, spot, 25); const kFog = n();
        line(act && k1.length === k0 + 1 && has(k1, spot) && kOff === k0 && kOld === k0 && kNew.length === k0 + 1 && has(kNew, spot) && !has(kNew, old) && kFog.length === k0 + 1 && has(kFog, old) && !has(kFog, spot),
          'wall charge: a man the fog of war has no record of is known to the stand-off where a teammate\'s picture has him (the rule off, or an idea older than the stand-off counts: not); of the fog\'s record and a picture the fresher word places him, once',
          `fog ${act ? 'on' : 'OFF'} · nobody told: ${k0} known by the fog alone · ${A.callsign} told of a man at ${at(spot)} 5 s ago: ${k1.map(at).join(' ') || 'none'} · rule off: ${kOff} · told ${WALLCHARGE.fireKnownS + 1} s ago: ${kOld} · fog ${at(old)} 20 s, told 2 s: ${kNew.map(at).join(' ')} · fog 20 s, told 25 s: ${kFog.map(at).join(' ')}`);
      } finally { pictureReset(g); fog.on = was.on; for (const [h, r] of was.recs) { if (r) fog.recs.set(h, r); else fog.recs.delete(h); } } }
    // (q) a step off a place the squad chose for itself: one man in the file behind Sam, Sam standing, the rest held far off
    { const { pictureStep, pictureStepOf } = P; let found = false, tried = 0, none = 0;
      const stage = async (seed: number, on: boolean) => { const t = await stand(seed, on), M = places(t); if (!M) return null; const [a, ...more] = t.R.up as any[], h = t.R.hostiles[0], others = t.R.hostiles.slice(1) as any[];
        /** a place off the floor: nobody there sees, is seen, fights or is heard well enough to be placed (the staged picture has to stay the one man told of) */
        const off = (i: number): Vec3 => [500 + 3 * i, 0, 500];
        /** everybody else out of the way: his mates on places the spot `p` and the believed man's place have no line to either way, the other defenders off the
         *  floor (parked beside the mates they fought them, and a fight breaks glass and rolls chairs: a new line to the cover in the middle of the asking) */
        const park = (p: number[]): Vec3[] | null => { const hid = M.far.filter(q => !t.either(q, p) && !t.either(q, M.h)); if (hid.length < 2) return null; more.forEach((gd: any, i: number) => t.hold(gd, hid[i % (hid.length - 1)], hid[(i + 1) % hid.length])); others.forEach((gd, i) => t.hold(gd, off(i + 1), off(i))); return hid; };
        return { t, G: t.g as any, M, a, h, park, away: off(0) }; };
      search: for (const seed of [3, 5, 1]) { const T = await stage(seed, ON); if (!T) continue; const { t, G, M, a, h, park, away } = T, nav = t.nav;
        for (const p of t.cells) { const d = flat(p, M.h); if (d < 4 || d > 14 || !t.sees(M.h, p) || !t.sees(p, M.h)) continue;
          const sm = ([[1.3, 0], [-1.3, 0], [0, 1.3], [0, -1.3]] as number[][]).map(([dx, dz]) => [p[0] + dx, 0, p[2] + dz] as Vec3).find(q => !nav.isBlocked(q[0], q[2]) && nav.walkable(p, q) && t.sees(M.h, q)); if (!sm) continue;
          pictureReset(G); t.pins.clear(); if (!park(p)) continue; t.hold(h, M.h, p); t.hold(a, p, M.h); G.teleportPlayer(sm); t.step(0.1); pictureTell(G, a, h, M.h);
          // (cover the rule may take, by its own word: a straight walk from the place, off Sam, no nearer the believed man than a stride, hidden a foot either way)
          const mayBe = (q: Vec3) => nav.walkable(p, q) && flat(q, sm) >= 1.2 && flat(q, M.h) >= 3 && flat(q, M.h) >= d - 1, firm = (c: any) => ([[0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3]] as number[][]).every(([dx, dz]) => nav.isBlocked(c.at[0] + dx, c.at[2] + dz) || exposedAt(G, a, [c.at[0] + dx, 0, c.at[2] + dz]) <= 0);
          const such = () => (coverNear(G, a, p, PICTURE.stepM, 8, mayBe) as any[]).some(c => c.stand <= 0 && firm(c));
          if (!such()) continue; tried++; if (tried > 40) break;
          // the rule itself, asked as the file asks it: a frame at a time, the man held on the place
          const KEY = {}, ask = (secs: number, busy = false) => { let r: any = null; for (let i = 0; i < Math.round(secs * 60); i++) { t.step(1 / 60); pictureTell(G, a, h, M.h); r = pictureStep(G, a, KEY, p, undefined, busy); } return r; };
          const e0 = exposedAt(G, a, p), rBusy = ask(1.5, true), r1 = ask(1.5); if (ON && !r1) { if (such() && exposedAt(G, a, p) >= PICTURE.stepAt && (P.ideasOf(G, a) as any[]).length === 1) none++; continue; }   // (no step where his picture is still the one man he was told of and still has such cover: the rule missed it. A picture that grew meanwhile — his mates call the men parked beside them, he hears a shot — is another question than the one staged)
          const e1 = r1 ? exposedAt(G, a, r1.at, r1.low) : -1, near = !!r1 && flat(r1.at, p) <= PICTURE.stepM + 0.01 && nav.walkable(p, r1.at);
          PICTURE.step = false; const rOff = ask(1.5); PICTURE.step = true; const rBack = ask(1.5);
          // (held on the place, he never gets onto the cover: after stepSecs that cover is given up — another, or none — and with nobody asking the step is over)
          const rStuck = ask(PICTURE.stepSecs + 1.5), gaveUp = !rBack || !rStuck || flat(rStuck.at, rBack.at) >= 0.6; ask(0.1); const had = !!pictureStepOf(G, a) === !!rStuck; t.step(0.5); const over = !pictureStepOf(G, a);
          t.hold(h, away, M.h); let rStale: any = 1; for (let i = 0; i < 90; i++) { t.step(1 / 60); pictureTell(G, a, h, M.h, 80); rStale = pictureStep(G, a, KEY, p); }   // (the word of him 80 s old: it counts for next to nothing)
          // … and through the file itself: the man given 'fall in' behind Sam where he stands, told of the defender, left to the game
          const file = async (rule: boolean) => { const U = (await stage(seed, ON))!, g2 = U.G; PICTURE.step = rule; U.t.pins.clear(); U.park(p); U.t.hold(U.h, away, p);   // (the defender himself out of sight: a man with a target in his eyes takes no step)
            const c = U.a.char; c.pos[0] = p[0]; c.pos[2] = p[2]; U.a.path = []; U.a.pathGoal = null; g2.teleportPlayer(sm); U.t.step(0.1); const why = g2.orders.give('fallIn', g2.orders.targetAt(sm), g2.orders.squad().indexOf(U.a));
            let on = 0; for (let i = 0; i < 360; i++) { pictureTell(g2, U.a, U.h, M.h); U.t.step(1 / 60); }
            const st = pictureStepOf(g2, U.a), q = U.a.char.pos; return { why, st, at: [q[0], 0, q[2]] as Vec3, e: exposedAt(g2, U.a, q, !!st?.low), stepped: PICTURE_STATS.stepped, on }; };
          const fOn = await file(true), fOff = await file(false); PICTURE.step = true;
          const took = !!fOn.st && flat(fOn.at, fOn.st.at) < 0.6 && fOn.e < PICTURE.stepAt;
          found = true; line(e0 >= PICTURE.stepAt && !rBusy && !!r1 && e1 === 0 && near && !rOff && !!rBack && gaveUp && had && over && !rStale && took && !fOff.st && fOff.stepped === 0 && none === 0,
            'step: a man in the file who learns his place is in an enemy\'s line takes cover a step or two off it that no believed enemy has a line to; not with a target in his eyes; a cover he cannot get onto is given up; nobody asking, the step is over; the idea stale, the place is his again; the rule off, he keeps the place',
            `seed ${seed}, the place ${at(p)} is ${f2(e0)} exposed to a man believed at ${at(M.h)}, Sam at ${at(sm)} · busy: ${rBusy ? 'STEPPED' : 'no step'} · the step: ${r1 ? `${at(r1.at)}${r1.low ? ' on a knee' : ''}, ${f2(flat(r1.at, p))} m off, ${f2(e1)} exposed` : 'none'} · rule off: ${rOff ? 'STEPPED' : 'none'}, on again: ${rBack ? 'a step' : 'none'} · held off it ${PICTURE.stepSecs + 1.5} s: ${rStuck ? (gaveUp ? `another, ${at(rStuck.at)}` : 'THE SAME COVER') : 'given up'} · half a second unasked: ${over ? 'over' : 'STILL ON IT'} · ${none ? `${none} PLACES WITH SUCH COVER GAVE NO STEP` : 'no staged place with such cover was refused'} · word 80 s old: ${rStale ? 'STILL OFF IT' : 'his place again'} · in the file: ${fOn.why ?? ''}${fOn.st ? `stands at ${at(fOn.at)}, his step ${at(fOn.st.at)}, ${f2(fOn.e)} exposed` : `no step, at ${at(fOn.at)}`} · in the file, rule off: ${fOff.st ? 'STEPPED' : `no step, at ${at(fOff.at)}`}`); break search; } }
      if (!found) line(false, 'step: a man in the file who learns his place is in an enemy\'s line takes cover a step or two off it', `no place on the office where a believed enemy puts a man of the file in his line with cover a step off (${tried} tried)`); Object.assign(PICTURE, JSON.parse(JSON.stringify(was.pic)), { on: ON }); }
    // (r) the wall charge's stand-off marks dealt again: the maintainer's own tape (standfire-check.ts's staging — The pass, the charge on the bunk room's long
    //     wall from the yard, three men to stand off), nobody known when the order is given, the tape's three men learned of once the charge is armed
    { const { WALL_ORDER, wallAt, wallTarget } = await import(`${ROOT}/src/game/wallcharge.ts`); const { standUp } = await import('./headless.ts');
      const { DESTRUCTION } = await import(`${ROOT}/src/game/destructionSwitch.ts`); const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`); const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
      const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`); const { readFileSync } = await import('node:fs'); const { knobsCopy, knobsBack } = await import(`${ROOT}/src/game/knobs.ts`);
      const CHARGE: Vec3 = [31.28, 0, 18.14], SAM: Vec3 = [26.4, 0, 20.8], MEN: Record<string, Vec3> = { 'Red Two': [28.8, 0, 19.9], 'Blue One': [27.3, 0, 20.4], 'Blue Two': [27.6, 0, 19.3] };
      const KNOWN: [Vec3, number][] = [[[30.5, 0, 11.9], 2], [[31.0, 0, 15.2], 3], [[19.2, 0, 9.6], 3]];
      const knobs0 = knobsCopy(), destr0 = DESTRUCTION.on, log = console.log; const data = parseLevelData(readFileSync(`${ROOT}/levels/pass.json`, 'utf8'));
      const run = async (rule: boolean) => { console.log = () => { }; try {
        DESTRUCTION.on = true; WALLCHARGE.on = true; const W: any = await standUp({ level: loadLevel(data), seed: 1 }), G = W.game; G.godMode = true; G.tune.chaos = 0.5;
        Object.assign(WALLCHARGE, { outer: true, safe: true, outOfFire: true, farFurn: true }); Object.assign(PICTURE, JSON.parse(JSON.stringify(was.pic)), { on: ON, step: rule }); for (const k of Object.keys(PICTURE_STATS)) (PICTURE_STATS as any)[k] = 0;   // (farFurn: the bunk room's cots stand at this wall's foot — the page has it on; an earlier stage's rig put the knobs back to the module's)
        const why0 = (await startFromQuery(G, '?levelFile=pass.json&roomclear&squad4')).why; if (why0) return { why: `start refused — ${why0}` };
        const step = (secs: number) => { for (let i = 0; i < Math.round(secs * 60); i++) W.step(1 / 60); }, put = (gd: any, p: number[]) => { gd.char.pos[0] = p[0]; gd.char.pos[2] = p[2]; gd.path = []; gd.pathGoal = null; gd.speed = 0; };
        const O = G.orders, C = G.wallCharge, fog = G.fogOfWar, foes: any[] = G.guards.filter((h: any) => h.team === 'hostile'); if (C.carried !== null) C.setCarried(2);
        for (const h of foes) put(h, [h.char.pos[0] + 400, 0, h.char.pos[2]]);
        const men: any[] = O.men('all'), one = men.find(m => m.callsign === 'Red One'); if (one) killGuard(G, one, [1, 0, 0], true); for (const m of men) { m.god = true; if (MEN[m.callsign]) put(m, MEN[m.callsign]); }
        G.teleportPlayer(SAM); step(0.5); for (const m of men) if (MEN[m.callsign]) put(m, MEN[m.callsign]);
        fog.on = true; for (const h of foes) fog.recs.delete(h); pictureReset(G);
        const Wl = wallAt(G, CHARGE), why = O.give(WALL_ORDER, wallTarget(G, CHARGE, { kind: 'floor', at: O.freeSpot?.(CHARGE) ?? CHARGE }), 'all'), op = C.ops[0]; if (why || !op) return { why: `the order refused — ${why}` };
        for (let i = 0; i < 30 * 60 && op.phase !== 'armed'; i++) W.step(1 / 60); if (op.phase !== 'armed') return { why: `never armed (${op.phase})` };
        const posts0 = new Map<any, Vec3>([...op.post]), fire = (q: Vec3): number => C.fireAt(q, Wl), clear = (q: Vec3) => C.blastShare(Wl, q, undefined, false) === 0;
        KNOWN.forEach(([q, age], i) => fog.recs.set(foes[i], { seen: false, t: G.time - age, at: [q[0], 0, q[2]], body: false, smoked: false, smokeF: -1e9 }));   // (the team learns of them now: the fog's record, which knownFoes reads with the pictures)
        const f0 = new Map<any, number>([...posts0].map(([m, q]) => [m, fire(q)])); step(3);   // (under it at two asks running, a second apart)
        const rows = [...op.post].map(([m, q]: [any, Vec3]) => ({ m, was: posts0.get(m)!, now: q, f0: f0.get(m)!, f1: fire(q), moved: flat(q, posts0.get(m)!) > 0.01, clear: clear(q) }));
        step(12); const off = rows.map(r => flat(r.m.char.pos, op.post.get(r.m)!));
        return { rows, off, phase: op.phase as string, stepped: PICTURE_STATS.stepped as number };
      } finally { console.log = log; } };
      try { const a = await run(true), b = await run(false);
        if (!a.rows || !b.rows) line(false, 'dealt again: the staging', `${a.why ?? ''} ${b.why ?? ''}`);
        else { const bad = a.rows.filter(r => r.f0 > 0), ok = bad.length > 0 && bad.some(r => r.moved) && a.rows.every(r => (r.f0 > 0 || !r.moved) && (!r.moved || (r.f1 < r.f0 && r.clear))) && a.off.every(d => d < 0.6) && a.phase === 'armed';
          const says = (R: NonNullable<typeof a.rows>) => R.map(r => `${r.m.callsign} ${at(r.was)} fire ${r.f0}${r.moved ? ` → ${at(r.now)} fire ${r.f1}${r.clear ? '' : ' IN THE BLAST'}` : ' keeps it'}`).join(' · ');
          line(ok && b.rows.every(r => !r.moved) && b.stepped === 0, 'dealt again: a stand-off mark that comes under known fire while the charge waits for the word is left for one under less of it, still out of the blast; nobody else moves; the men walk to them; the rule off, every mark stays',
            `the tape's wall, nobody known at the order, three men learned of once armed · ${says(a.rows)} · ${a.off.map(d => f2(d)).join(', ')} m off their marks 12 s on, the charge still ${a.phase} · rule off: ${says(b.rows)}`); }
      } finally { knobsBack(knobs0); DESTRUCTION.on = destr0; Object.assign(PICTURE, JSON.parse(JSON.stringify(was.pic)), { on: ON }); } }
    // (s) a colleague's shot places the enemy where the shooter believes him
    { const { hearingCheck } = await import(`${ROOT}/src/game/guards.ts`); const t = await stand(3, ON), G: any = t.g, M = places(t);
      if (!M) line(false, 'a colleague\'s shot: a place to stage it'); else { const [h, h2] = t.R.hostiles as any[], X: Vec3 = [M.a[0], 0, M.a[2]], TO: Vec3 = [M.b[0], 0, M.b[2]], sam: Vec3 = [M.far[0][0], 0, M.far[0][2]];
        t.pins.clear(); t.hold(h, M.h, M.a); t.hold(h2, M.h2, M.h); G.teleportPlayer(sam); t.step(0.1); h.foe = 'player';
        const Y: Vec3 = [M.b[0], 0, M.b[2]], f1 = (x: number) => x.toFixed(1);
        /** the hearer, working from `lk` placed `fixAge` s ago (nothing: no fix), hears the shooter fire: where he works from after, and how old that fix is */
        const hearIt = (lk: Vec3 | null = null, fixAge = 0): { at: Vec3 | null; age: number } => { h2.lastKnown = lk ? [lk[0], 0, lk[2]] : null; h2.fixRef = lk ? [lk[0], 0, lk[2]] : null; h2.fixT = lk ? G.time - fixAge : -100; h2.heardUpTo = -1;
          G.events.push({ kind: 'guardShot', pos: [M.h[0], 1.4, M.h[2]], to: [TO[0], 1.1, TO[2]], time: G.time, loud: true, level: 1, who: h.char.id }); hearingCheck(G, h2); G.events.pop(); h2.trackFix(G.time);
          return { at: h2.lastKnown ? [h2.lastKnown[0], 0, h2.lastKnown[2]] : null, age: G.time - h2.fixT }; };
        const told = (age = 0) => { pictureReset(G); pictureTell(G, h, 'player', X, age); };
        told(); const kOn = hearIt(); PICTURE.shot = false; told(); const kOff = hearIt(); PICTURE.shot = true;
        // (his word 30 s old: the hearer with nothing takes the place AND its age, as his own idea of the man too; the hearer with a newer fix of his own keeps it)
        told(30); const kOld = hearIt(), iOld = ideaOf(G, h2, 'player'), ideaAge = iOld ? G.time - iOld.t : -1; told(30); const kKeep = hearIt(Y, 5); told(30); const kTake = hearIt(Y, 60);
        // (no fix at all, and his own idea of the man a second old: it is not written over by the shooter's older word — he works from his own; and a word the
        //  shooter has since seen empty is a place to go, nothing for the hearer's picture)
        told(30); pictureTell(G, h2, 'player', Y, 1); const kOwn = hearIt(), iOwn = ideaOf(G, h2, 'player'), ownOk = !!iOwn && flat(iOwn.at, Y) < 0.01 && Math.abs(G.time - iOwn.t - 1) < 0.5;
        told(30); { const I = ideaOf(G, h, 'player'); if (I) I.lost = true; } const kLost = hearIt(), lostOk = !ideaOf(G, h2, 'player');
        pictureReset(G); t.step(0); const none = !ideaOf(G, h, 'player'), kNone = hearIt(); const tr = G.player.char.pos, is = (k: { at: Vec3 | null }, q: number[]) => !!k.at && flat(k.at, q) < 0.01;
        line(is(kOn, X) && kOn.age < 0.5 && flat(X, tr) > 4 && is(kOff, tr) && is(kOld, X) && Math.abs(kOld.age - 30) < 0.5 && Math.abs(ideaAge - 30) < 0.5 && is(kKeep, Y) && Math.abs(kKeep.age - 5) < 0.5 && is(kTake, X) && is(kOwn, Y) && ownOk && Math.abs(kOwn.age - 1) < 0.5 && is(kLost, X) && lostOk && none && is(kNone, tr),
          'a colleague\'s shot: the man who hears it places the enemy where the SHOOTER believes him to be, not where he is, and that word is as old as the shooter\'s; his own newer fix he keeps; the shooter with no idea of him, or the rule off: as it was',
          `the shooter believes his man at ${at(X)}, the man stands at ${at(tr)} · the hearer's fix: ${kOn.at ? at(kOn.at) : 'none'}, ${f1(kOn.age)} s old · rule off: ${kOff.at ? at(kOff.at) : 'none'} · the shooter's word 30 s old: ${kOld.at ? at(kOld.at) : 'none'}, the fix ${f1(kOld.age)} s old, the hearer's idea ${f1(ideaAge)} s · the hearer with his own fix at ${at(Y)} 5 s old: ${kKeep.at ? at(kKeep.at) : 'none'}, ${f1(kKeep.age)} s · his own 60 s old: ${kTake.at ? at(kTake.at) : 'none'} · no fix, his own idea of the man at ${at(Y)} 1 s old: works from ${kOwn.at ? at(kOwn.at) : 'none'}, his idea ${ownOk ? 'kept' : 'WRITTEN OVER'} · the shooter has seen the place empty, the hearer with nothing: goes to ${kLost.at ? at(kLost.at) : 'none'}, ${lostOk ? 'no idea made of it' : 'AN IDEA MADE OF IT'} · no idea: ${kNone.at ? at(kNone.at) : 'none'}`); }
      Object.assign(PICTURE, JSON.parse(JSON.stringify(was.pic)), { on: ON }); }
    // (j) the memory alone moves nothing
    { const run = async (on: boolean) => { const t = await stand(5, on); Object.assign(PICTURE, { standoff: false, cover: false, wall: false, flee: false, fallback: false, stack: false, step: false, shot: false }); const M = places(t)!; const [a, b] = t.R.up as any[], h = t.R.hostiles[0]; let d = '';
        for (const gd of t.g.guards) gd.god = false; t.pins.clear();
        t.hold(a, M.a, M.h); t.hold(b, M.b, M.h); t.hold(h, M.h, M.a); t.pins.clear();   // (staged, then left to the game: a fight with the picture watching it)
        for (let i = 0; i < 600; i++) { if (i === 120) t.g.events.push({ kind: 'guardShot', pos: [M.h2[0], 0, M.h2[2]], time: t.g.time, loud: true, level: 1, who: h.char.id }); t.step(1 / 60); if (i % 60 === 59) d += hashDigest(digestGame(t.g, true)) + ' '; }
        return { d, seen: PICTURE_STATS.seen }; };
      const onRun = await run(ON), off = await run(false);
      line(onRun.d === off.d && (ON ? onRun.seen > 0 : true) && off.seen === 0, 'the memory alone moves nothing: on, with every rule that asks it off, the run digests as the run with the switch off', `digests ${onRun.d === off.d ? 'equal' : 'DIFFER'} over ten seconds · ${onRun.seen} sightings kept on, ${off.seen} off`); }
  } finally { Object.assign(PICTURE, was.pic); Math.random = was.rnd; }
  console.log(`=== picture: ${all ? 'ALL PASS' : 'FAIL'} ===`);
  return all;
}
if (import.meta.main) process.exit((await pictureCheck()) ? 0 : 1);
