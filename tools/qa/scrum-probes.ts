// The 'scrum' probe (run through probes.ts: `bun run tools/qa/probes.ts scrum [n] [--verbose]`): alert men bunched inside the conference room by its door with a
// chair wedged against the table's edge behind them and Sam lit a few metres off in the corner — the QA soak's seed-6 wedge (f41408, 690 s), where the man at
// the back of a three-man bunch, a colleague 0.6 m ahead of him in his line of fire, side-stepped his quarter-metre into that chair, was handed it straight back
// by the props, and a second later planned the very same step again, for as long as Sam stood there (guards.ts lineStep: the far side was fouled by the third
// man, the near side went nowhere, and nothing remembered that it had). Staged three ways — that bunch as it stood; the same bunch with Sam then running rings
// round the room through them for twenty seconds; two men and the chair, the masked one a metre back (the near side wedged, the far side free: he should learn
// the one and take the other) — and held to the soak's own invariants: nobody 'stuck' (ordered to move essentially all of a 4 s window and ending it where it
// began), plus the see-saw measured directly since the soak's fixed windows can miss a man the push-back creeps along at a centimetre a second (nobody
// 'dithers': ordered to move for 3 s on end without leaving a 0.3 m circle), no two men merged (centres inside 0.3 m for 2 s), the men with a line firing,
// the masked man getting a round off himself before long, and over the whole run no round whose muzzle → aim segment passes within 0.3 m of a living
// colleague's axis. PASS / FAIL each; --verbose prints lineStep's reasoning (guards.ts LINE_DEBUG) for the masked man through the first seconds. On the tree
// before the fix cases 0 and 1 fail (the masked man dithers 13.9 s of 14 and never fires; 6.6 s and his first round only once Sam runs); case 2 passed already.
import { standUp, ROOT } from './headless.ts';
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const guardsMod = await import(`${ROOT}/src/game/guards.ts`);
const { resetChase } = guardsMod;
const LINE_DEBUG: { log: ((gd: any, s: string) => void) | null } = guardsMod.LINE_DEBUG ?? { log: null };   // (a tree from before the hook: --verbose just prints nothing)

type Vec3 = [number, number, number];
const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function placeGuard(gd: any, p: Vec3, face: Vec3) { gd.char.pos = v3.copy(p); gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.char.bodyYaw = gd.char.aimYaw = Math.atan2(face[0] - p[0], face[2] - p[2]); gd.char.aimPitch = 0; gd.path = []; gd.pathGoal = null; gd.char.anim.upper = 'aim'; gd.char.update(0); gd.char.update(DT); }
/** a fresh 'alert' on `fix` with eyes on him now (licensed to shoot), no CONTACT beat left, every chase clock zeroed (probes.ts armAlert) */
function armAlert(gd: any, game: any, fix: Vec3, fireCd: number) {
  gd.state = 'alert'; gd.awareness = 1; gd.reactT = 0; gd.fireCd = fireCd; gd.weapon.rearm(); gd.reloadT = -1; gd.lastKnown = v3.copy(fix); gd.lastSeenT = game.time;
  resetChase(gd); gd.stuckT = 0; gd.stuckN = 0; gd.dazzledUntil = -1; gd.pinned = false; gd.hold = false; gd.ledT = game.time; gd.muzzleDown = false; gd.muzzleClearT = 0;
}
/** distance (m) from a vertical body axis at (ax, az), y in [y0, y1], to the segment a→b — the measure guards.ts colleagueInLine keeps the men to (ai-probes.ts) */
function segToAxis(a: Vec3, b: Vec3, ax: number, az: number, y0: number, y1: number): number {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2]; const L2 = dx * dx + dz * dz; if (L2 < 1e-8) return Math.hypot(a[0] - ax, a[2] - az);
  const t = Math.max(0, Math.min(1, ((ax - a[0]) * dx + (az - a[2]) * dz) / L2));
  const px = a[0] + dx * t, py = a[1] + dy * t, pz = a[2] + dz * t; const ddy = py < y0 ? y0 - py : py > y1 ? py - y1 : 0;
  return Math.hypot(px - ax, pz - az, ddy);
}
const axisOf = (o: any) => { const h = o.char.bones.hips ?? o.char.pos; return { x: h[0], z: h[2], y0: o.char.pos[1] + 0.05, y1: o.char.bones.headTop?.[1] ?? 1.75 }; };

/** the room's SE corner where the soak's Sam stood, and the ring he sprints round the table: up to the bunch along the south glass from the west, back round the
 *  north side, into them from the east, and round again (a man's body stops him like a wall — player.ts settles him back — so a leg that gets nowhere for half a
 *  second is given up for the next: he bounces off them and comes again from the other side) */
const SAM: Vec3 = [13.52, 0, 9.49];
const RING: Vec3[] = [[13.2, 0, 4.9], [5.2, 0, 4.9], [5.1, 0, 9.2], [8.9, 0, 9.2], [5.1, 0, 9.2], [5.2, 0, 4.9], [13.2, 0, 4.9], [13.3, 0, 9.35], [10.6, 0, 9.1], [13.3, 0, 9.35]];
/** chair39's home in the row along the table's south side, and where the soak had shoved it: hard against the table's edge, right behind the masked man */
const CHAIR_HOME: [number, number] = [9.6, 8.25], CHAIR_WEDGED: [number, number] = [9.78, 8.07];

type Case = {
  label: string;
  men: { route: string; at: Vec3; role: 'front' | 'masked' | 'third' }[];   // staged alert inside the room, facing Sam; 'masked' = the one with a colleague in his line at t0
  standSecs: number; circleSecs: number;                                    // Sam stands lit in the corner this long, then sprints the ring this long (0 = never)
  firstRoundWant: number;                                                   // the masked man's first round must come inside this (s from t0)
};
const CASES: Case[] = [
  { label: "the soak's bunch as it stood (seed 6, 690 s): three men inside the door, the back man 0.6 m behind-left of the one in his line, the third fouling his far side, chair39 wedged on the table at his near side; Sam standing lit in the SE corner 4 m off for 14 s",
    men: [{ route: 'lobby_break', at: [9.94, 0, 9.13], role: 'front' }, { route: 'cubicles', at: [9.62, 0, 8.61], role: 'masked' }, { route: 'corridor', at: [9.79, 0, 9.71], role: 'third' }], standSecs: 14, circleSecs: 0, firstRoundWant: 5 },
  { label: 'the same bunch, Sam standing 6 s then sprinting rings round the table for 20 s — into them along the south glass from the west, then from the east, every lap (god mode)',
    men: [{ route: 'lobby_break', at: [9.94, 0, 9.13], role: 'front' }, { route: 'cubicles', at: [9.62, 0, 8.61], role: 'masked' }, { route: 'corridor', at: [9.79, 0, 9.71], role: 'third' }], standSecs: 6, circleSecs: 20, firstRoundWant: 5 },
  { label: 'two men and the chair: the masked man a metre behind the one in his line, chair39 wedged on the table at his near side, the far side open floor — he should find the near side goes nowhere and take the far one; Sam standing lit 12 s',
    men: [{ route: 'lobby_break', at: [10.55, 0, 9.05], role: 'front' }, { route: 'cubicles', at: [9.6, 0, 8.7], role: 'masked' }], standSecs: 12, circleSecs: 0, firstRoundWant: 4 },
];

export async function scrum(verbose = process.argv.includes('--verbose')) {
  console.log('\n=== scrum: alert men bunched by the conference door, a chair wedged on the table behind them, Sam lit in the corner — nobody see-saws, nobody merges, lines fire, no round through a colleague ===');
  const only = process.argv[3] && /^\d+$/.test(process.argv[3]) ? Number(process.argv[3]) : -1;   // `scrum 2` runs case 2 alone
  let allPass = true;
  for (let ci = 0; ci < CASES.length; ci++) {
    if (only >= 0 && ci !== only) continue;
    const C = CASES[ci];
    Math.random = seeded(600 + ci);
    const W = await standUp(); const { game, input } = W;
    game.godMode = true; game.aiEnabled = true;
    for (let i = 0; i < 10; i++) W.step(DT);
    const name = (gd: any) => game.level.routes[gd.routeI]?.name ?? gd.callsign;
    // the men: the case's inside the room, alert on Sam with eyes on him; everybody else parked blind, deaf and pinned on the lot
    const men = C.men.map(m => ({ ...m, gd: game.guards.find((x: any) => name(x) === m.route) }));
    if (men.some(m => !m.gd)) { console.log(`- FAIL [${ci}] cannot stage: no guard on route ${C.men.filter((_, i) => !men[i].gd).map(m => m.route)}`); allPass = false; continue; }
    for (const o of game.guards) if (!men.some(m => m.gd === o)) { o.hold = true; o.pinned = true; o.dazzledUntil = 1e9; o.heardUpTo = 1e12; o.char.pos = [37.5, 0, 6 + game.guards.indexOf(o)]; o.char.update(0); }
    // the door as the soak had it (kicked in, standing into the room at −0.46), the chair wedged on the table's edge
    const door = game.doors.byName('conference'); door.angle = -0.46; door.vel = 0; door.closing = false; door.latched = false; door.locked = false; door.lockBroken = true; door.quietT = 5; door.place();
    const chair = game.props.props.filter((p: any) => p.def.kind === 'chair').sort((a: any, b: any) => Math.hypot(a.home[0] - CHAIR_HOME[0], a.home[1] - CHAIR_HOME[1]) - Math.hypot(b.home[0] - CHAIR_HOME[0], b.home[1] - CHAIR_HOME[1]))[0];
    chair.x = CHAIR_WEDGED[0]; chair.z = CHAIR_WEDGED[1]; chair.vx = chair.vz = chair.w = 0; chair.wake(); chair.dirty = true; chair.place();
    game.teleportPlayer(v3.copy(SAM)); game.player.visibility = 0.9; game.player.crouch = false;
    const bunch: Vec3 = [men.reduce((s, m) => s + m.at[0], 0) / men.length, 1.2, men.reduce((s, m) => s + m.at[2], 0) / men.length];
    game.puppet = { goal: v3.copy(SAM), aim: bunch };   // Sam faces them, pistol up, rooted (god mode keeps him up under their fire)
    men.forEach((m, i) => { placeGuard(m.gd, m.at, SAM); armAlert(m.gd, game, SAM, 0.3 + 0.15 * i); });
    const masked = men.find(m => m.role === 'masked')!.gd; const t0 = game.time;
    // instrumentation: every round's muzzle → aim segment against every OTHER living man's axis (fireWeapon plays 'pistolLoud' at the muzzle before the hit scan)
    const rounds = new Map<any, number[]>(); let badRounds = 0, worst = Infinity; const badNotes: string[] = [];
    const play = game.audio.play; game.audio.play = (n: string, pos: Vec3, ...rest: unknown[]) => {
      if (n === 'pistolLoud' && pos) {
        const shooter = game.guards.find((x: any) => x.state !== 'dead' && v3.dist(x.char.muzzle, pos) < 1e-3);
        if (shooter) {
          const arr = rounds.get(shooter) ?? []; arr.push(game.time); rounds.set(shooter, arr);
          const to: Vec3 = v3.add(game.player.char.pos, [0, game.player.crouch ? 0.8 : 1.25, 0]);
          for (const o of game.guards) { if (o === shooter || o.state === 'dead') continue; const ax = axisOf(o); const dd = segToAxis(v3.copy(pos), to, ax.x, ax.z, ax.y0, ax.y1); worst = Math.min(worst, dd); if (dd < 0.3) { badRounds++; if (badNotes.length < 6) badNotes.push(`${(game.time - t0).toFixed(2)}s ${name(shooter)}'s round ${dd.toFixed(2)} m off ${name(o)}`); } }
        }
      }
      return play(n, pos, ...rest);
    };
    const dbg: string[] = [];
    if (verbose) LINE_DEBUG.log = (gd: any, s: string) => { if (gd === masked && game.time - t0 < 6 && dbg.length < 400) dbg.push(`    ${(game.time - t0).toFixed(3)}s ${s}`); };
    // the soak's own invariants, kept the soak's way: 'stuck' per man per 4 s window; pairs inside 0.3 m accumulating past 2 s — and the see-saw itself, which the
    // soak's fixed windows can miss when the push-back creeps him a few centimetres a second: 'dithering' = ordered to move (speed > 0.3 on a path) frame after
    // frame without ever leaving a 0.3 m circle round where that began; the longest such spell per man (the base tree's masked man: all 14 s of it)
    const stuck = new Map<any, { t0: number; p0: Vec3; last: Vec3; ground: number; reach: number; want: number }>(); const stuckHits: string[] = []; let outAndBack = 0;
    const dither = new Map<any, { p0: Vec3; t: number; gap: number }>(); const ditherMax = new Map<any, number>();
    const closeT = new Map<string, number>(); const merged = new Set<string>(); let minPair = Infinity; let maxCloseT = 0;
    let phase: 'stand' | 'circle' = 'stand'; let ringI = 0; let firstMasked = -1; let standRounds = 0, circleRounds = 0; let hits = 0; let samLaps = 0, samBounces = 0;
    const legTrail: Vec3[] = [];   // Sam's spot each frame of the current leg (a leg getting nowhere for half a second is a man in the way: next leg)
    const rows: string[] = [];
    const total = C.standSecs + C.circleSecs;
    for (let f = 0; f < Math.round(60 * total); f++) {
      const t = game.time - t0;
      if (phase === 'stand' && t >= C.standSecs && C.circleSecs > 0) { phase = 'circle'; input.keys.add('ShiftLeft'); }
      if (phase === 'circle') {
        const sp = game.player.char.pos; legTrail.push(v3.copy(sp));
        const blocked = legTrail.length > 30 && v3.distXZ(legTrail[legTrail.length - 31], sp) < 0.3;
        if (v3.distXZ(sp, RING[ringI]) < 0.6 || blocked) { if (blocked) samBounces++; ringI = (ringI + 1) % RING.length; if (ringI === 0) samLaps++; legTrail.length = 0; }
        game.puppet = { goal: v3.copy(RING[ringI]), aim: null };
      }
      for (const m of men) { m.gd.lastSeenT = game.time; m.gd.awareness = 1; if (m.gd.state !== 'alert') { m.gd.state = 'alert'; m.gd.reactT = 0; } }   // (keep it a fight about lines and feet, not about losing him behind the table)
      const roundsBefore = [...rounds.values()].reduce((s, a) => s + a.length, 0);
      W.step(DT);
      const roundsNow = [...rounds.values()].reduce((s, a) => s + a.length, 0);
      if (phase === 'stand') standRounds += roundsNow - roundsBefore; else circleRounds += roundsNow - roundsBefore;
      if (firstMasked < 0 && (rounds.get(masked)?.length ?? 0) > 0) firstMasked = rounds.get(masked)![0] - t0;
      if (game.player.hitFlash > 1 - 3.5 * DT) hits++;
      // stuck (soak.ts invariants, verbatim in substance)
      for (const m of men) {
        const gd = m.gd, c = gd.char; if (gd.state === 'dead') continue;
        const pathing = (gd.path.length > 0 && gd.pathI < gd.path.length) || (gd.script && gd.script.goal && !gd.script.arrived);
        let s = stuck.get(gd); if (!s) { s = { t0: game.time, p0: v3.copy(c.pos), last: v3.copy(c.pos), ground: 0, reach: 0, want: 0 }; stuck.set(gd, s); }
        if (gd.speed > 0.3 && pathing) s.want += DT;
        s.ground += v3.distXZ(c.pos, s.last); s.last = v3.copy(c.pos); s.reach = Math.max(s.reach, v3.distXZ(c.pos, s.p0));
        if (game.time - s.t0 >= 4) {
          const moved = v3.distXZ(c.pos, s.p0);
          if (s.want >= 3.8 && moved < 0.05 && s.reach >= 1.0) outAndBack++;
          else if (s.want >= 3.8 && moved < 0.05) stuckHits.push(`${name(gd)} at +${(game.time - t0).toFixed(1)} s: ordered ${s.want.toFixed(1)} of 4 s, ended ${moved.toFixed(3)} m from where it began (excursion ${s.reach.toFixed(2)}, ground ${s.ground.toFixed(2)}) at (${c.pos[0].toFixed(2)}, ${c.pos[2].toFixed(2)}) path ${gd.pathI}/${gd.path.length} → ${gd.pathGoal ? `(${gd.pathGoal[0].toFixed(2)}, ${gd.pathGoal[2].toFixed(2)})` : '-'}`);
          s.t0 = game.time; s.p0 = v3.copy(c.pos); s.want = 0; s.ground = 0; s.reach = 0;
        }
        const ordered = gd.speed > 0.3 && pathing; let D = dither.get(gd);
        if (D && v3.distXZ(c.pos, D.p0) > 0.3) D = undefined;                    // got somewhere: whatever spell was running is over
        if (ordered) { if (!D) D = { p0: v3.copy(c.pos), t: 0, gap: 0 }; D.t += DT; D.gap = 0; ditherMax.set(gd, Math.max(ditherMax.get(gd) ?? 0, D.t)); }
        else if (D && ++D.gap > 6) D = undefined;                                 // standing on purpose for more than a tenth of a second ends it too
        if (D) dither.set(gd, D); else dither.delete(gd);
      }
      // pairs
      for (let i = 0; i < men.length; i++) for (let j = i + 1; j < men.length; j++) {
        const a = men[i].gd, b = men[j].gd; if (a.state === 'dead' || b.state === 'dead') continue;
        const key = `${name(a)}|${name(b)}`; const d = v3.distXZ(a.char.pos, b.char.pos); minPair = Math.min(minPair, d);
        if (d < 0.3) { const acc = (closeT.get(key) ?? 0) + DT; closeT.set(key, acc); maxCloseT = Math.max(maxCloseT, acc); if (acc > 2) merged.add(key); } else closeT.set(key, 0);
      }
      if (f % 30 === 29) rows.push(`    ${t.toFixed(1).padStart(4)}s ${phase.padEnd(6)} Sam (${game.player.char.pos[0].toFixed(1)}, ${game.player.char.pos[2].toFixed(1)}) · ` + men.map(m => `${name(m.gd)}${m.gd === masked ? '*' : ''} (${m.gd.char.pos[0].toFixed(2)}, ${m.gd.char.pos[2].toFixed(2)}) ${m.gd.state === 'alert' ? '' : m.gd.state + ' '}${m.gd.muzzleDown ? 'DOWN' : 'up'} spd ${m.gd.speed.toFixed(2)} path ${m.gd.pathI}/${m.gd.path.length} r${rounds.get(m.gd)?.length ?? 0}`).join(' · ') + ` · chair (${chair.x.toFixed(2)}, ${chair.z.toFixed(2)})`);
    }
    game.audio.play = play; game.puppet = null; input.keys.delete('ShiftLeft'); LINE_DEBUG.log = null;
    const totalRounds = standRounds + circleRounds;
    const wantStand = Math.max(4, Math.round(C.standSecs * 0.6));   // the men with a line: comfortably a round a couple of seconds between them while he stands there
    const DITHER_MAX = 3; const dithers = men.map(m => ({ who: name(m.gd), t: ditherMax.get(m.gd) ?? 0 })); const worstDither = dithers.reduce((a, b) => b.t > a.t ? b : a, { who: '-', t: 0 });
    const ok = stuckHits.length === 0 && worstDither.t <= DITHER_MAX && merged.size === 0 && badRounds === 0 && firstMasked >= 0 && firstMasked < C.firstRoundWant && standRounds >= wantStand;
    allPass &&= ok;
    console.log(`\n- ${ok ? 'PASS' : 'FAIL'} [${ci}] ${C.label}`);
    console.log(`  stuck (the soak's definition): ${stuckHits.length ? stuckHits.length + ' ✗ — ' + stuckHits.slice(0, 3).join(' | ') : 'nobody'}${outAndBack ? ` (out-and-back windows: ${outAndBack})` : ''}; longest dither (ordered to move without leaving a 0.3 m circle): ${dithers.map(d => `${d.who} ${d.t.toFixed(1)} s`).join(', ')} (want ≤ ${DITHER_MAX})${worstDither.t <= DITHER_MAX ? '' : ' ✗'}`);
    console.log(`  pairs: nearest two centres came ${isFinite(minPair) ? minPair.toFixed(2) : '—'} m, longest spell inside 0.3 m ${maxCloseT.toFixed(2)} s${merged.size ? ` ✗ merged > 2 s: ${[...merged].join(', ')}` : ''}`);
    console.log(`  rounds: ${totalRounds} (${standRounds} while he stood${C.circleSecs ? `, ${circleRounds} while he ran` : ''}; want ≥ ${wantStand} standing${standRounds >= wantStand ? '' : ' ✗'}), ${hits} reached Sam; by man: ${men.map(m => `${name(m.gd)}${m.gd === masked ? '*' : ''} ${rounds.get(m.gd)?.length ?? 0}`).join(', ')}; the masked man's first at ${firstMasked >= 0 ? '+' + firstMasked.toFixed(2) + ' s' : 'never'} (want < ${C.firstRoundWant})${firstMasked >= 0 && firstMasked < C.firstRoundWant ? '' : ' ✗'}`);
    console.log(`  rounds within 0.3 m of a living colleague's axis: ${badRounds}${badRounds ? ' ✗ — ' + badNotes.join('; ') : ''} (nearest ${isFinite(worst) ? worst.toFixed(2) : '—'} m)`);
    if (C.circleSecs) console.log(`  Sam's rings: ${samLaps} full laps of the table in ${C.circleSecs} s, ${samBounces} legs given up against a man in the way`);
    console.log(`  ends: ${men.map(m => `${name(m.gd)} ${m.gd.state} at (${m.gd.char.pos[0].toFixed(2)}, ${m.gd.char.pos[2].toFixed(2)})`).join(', ')}; chair39 at (${chair.x.toFixed(2)}, ${chair.z.toFixed(2)})`);
    console.log(rows.filter((_, i) => i % 2 === 1).join('\n'));
    if (dbg.length) { console.log(`  lineStep for ${name(masked)} (first 6 s):`); console.log(dbg.join('\n')); }
  }
  console.log(`\n=== scrum: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}
