// The 'ai-pass-2' probe family (run through probes.ts: `bun run tools/qa/probes.ts ai-pass-2 | darkness | pieing`): the search that deals hide spots round the fix
// and reads the renderer's light (guards.ts searchPlanFor / searchProbes / scoreSpots), and threshold discipline at doorways (guards.ts pieDoorway). The GPU never
// answers headless, so the darkness probes swap the Game's light seam (lightQuery / lightAt / lightForget) for a table keyed by where the query was put: the west
// half of the cubicle farm pitch dark, the east half lit — and one run leaves the seam alone to show the plan completing on neutral readings. PASS / FAIL each.
import { standUp, ROOT } from './headless.ts';
const { v3, wrapAngle } = await import(`${ROOT}/src/math/vec.ts`);
const G = await import(`${ROOT}/src/game/guards.ts`);

type Vec3 = [number, number, number];
const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** Every guard from index `keep` on out of it: parked on the lot east of the building, held, pinned, deaf and blind. */
function parkFrom(game: any, keep: number) {
  for (const o of game.guards.slice(keep)) { o.hold = true; o.pinned = true; o.dazzledUntil = 1e9; o.heardUpTo = 1e12; o.char.pos = [37.5, 0, 6 + game.guards.indexOf(o)]; o.char.update(0); }
}
/** A man dropped to 'search' round `fix` this instant, standing at `at` (deaf: this is about where he looks, not what he hears). */
function dropSearcher(game: any, gd: any, at: Vec3, fix: Vec3) {
  gd.char.pos = v3.copy(at); gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.path = []; gd.pathGoal = null; gd.char.update(0); gd.char.update(DT);
  gd.hold = false; gd.pinned = false; gd.dazzledUntil = -1; gd.heardUpTo = 1e12; gd.script = null; gd.task = null; gd.bodyDuty = null;
  gd.state = 'search'; gd.searchT = 0; gd.reactT = 0; gd.awareness = 0.8; gd.lastKnown = v3.copy(fix); gd.searchPlan = null; gd.fixRef = null;   // (fixRef null: trackFix stamps the fix as placed now)
}
/** The light seam swapped for a table: `E(pos)` W/m² wherever a query is put (answered the same frame — the real probe is a frame or two behind, which the logic
 *  treats the same: no answer yet = neutral). Returns a restore function. */
function fakeLight(game: any, E: (p: Vec3) => number): () => void {
  const q0 = game.lightQuery, a0 = game.lightAt, f0 = game.lightForget; const posOf = new Map<string, Vec3>();
  game.lightQuery = (key: string, pos: Vec3) => { posOf.set(key, v3.copy(pos)); };
  game.lightAt = (key: string) => { const p = posOf.get(key); return p ? E(p) : undefined; };
  game.lightForget = (key: string) => { posOf.delete(key); };
  return () => { game.lightQuery = q0; game.lightAt = a0; game.lightForget = f0; };
}
/** west of x = 20 pitch dark (0.005 W/m²: visibility 0), east of it lit like a desk under a panel (3 W/m²: visibility ≈ 0.92) */
const WEST_DARK = (p: Vec3) => p[0] < 20 ? 0.005 : 3.0;

// ================================================================ darkness
/** (A) one searcher at a central fix in the cubicle farm, west half dark: his first three spots are in the dark half and are cover spots (not open floor);
 *  (B) two searchers on the same fix: no two visited spots within a metre of each other, both men's first spots dark-side, ≤ 8 light queries any frame;
 *  (C) the fix by the break room's west door with that leaf latched AND locked against the cubicle side (and the corridor door latched): not one break-room spot is
 *      dealt (Sam has no key); the same with the leaf latched but unlocked: break-room spots are dealt at plausibility 0 and come up to 1 as the seconds pass;
 *  (D) no light provider at all (the harness's silent GPU): the plan still builds, every spot reads neutral, spots get looked into, and the search ends by its own
 *      clock into 'suspicious' and then 'patrol' — the old behaviour's exits, untouched. */
export async function darkness() {
  console.log('\n=== darkness: the search deals hide spots round the fix, darkest and best-covered first, split between searchers, nothing implausible ===');
  let allPass = true; const verdict = (ok: boolean, label: string, detail: string) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  const FIX: Vec3 = [19.9, 0, 18.4];   // the middle aisle of the cubicle farm, between the four clusters
  const spotStr = (s: any) => `${s.kind}${s.hidden ? '/hid' : ''}@(${s.pos[0].toFixed(1)}, ${s.pos[2].toFixed(1)}) dark ${s.dark.toFixed(2)}${s.E === undefined ? '?' : ''} cov ${s.cover.toFixed(2)} pl ${s.plaus.toFixed(2)}`;
  // ---- (A) one man, west dark
  {
    Math.random = seeded(301);
    const W = await standUp(); const { game } = W;
    game.playerInvisible = true; game.godMode = true; game.teleportPlayer([37.5, 0, 26.5]);
    for (let i = 0; i < 10; i++) W.step(DT);
    parkFrom(game, 1); const gd = game.guards[0];
    dropSearcher(game, gd, FIX, FIX);
    const restore = fakeLight(game, WEST_DARK);
    W.step(DT);
    const P0 = gd.searchPlan; const dealt = P0 ? P0.spots.map(spotStr) : [];
    const looks: any[] = []; let lastPhase = ''; let maxN = 0; const t0 = game.time; let tSusp = -1, tPatrol = -1; let aimErr = 0, aimPitch = 0, aimN = 0;
    for (let f = 0; f < 60 * 45; f++) {
      W.step(DT); maxN = Math.max(maxN, game.searchProbeN);
      const P = gd.searchPlan;
      if (P && P.phase !== lastPhase) { lastPhase = P.phase; if (P.phase === 'look') looks.push({ ...P.spots[P.current], t: game.time - t0 }); }
      if (P && P.phase === 'look' && P.phaseT > 0.5) { const s = P.spots[P.current]; aimErr += Math.abs(wrapAngle(gd.char.aimYaw - Math.atan2(s.pos[0] - gd.char.pos[0], s.pos[2] - gd.char.pos[2]))); aimPitch += gd.char.aimPitch; aimN++; }   // torch INTO the spot: his aim on its bearing (a hand's wobble across it) and pitched down at the floor there
      if (tSusp < 0 && gd.state === 'suspicious') tSusp = game.time - t0;
      if (tPatrol < 0 && gd.state === 'patrol') { tPatrol = game.time - t0; break; }
    }
    restore();
    const first3 = looks.slice(0, 3); const errDeg = aimN ? aimErr / aimN * 180 / Math.PI : 99, pitchDeg = aimN ? aimPitch / aimN * 180 / Math.PI : 0;
    const ok = !!P0 && P0.spots.length >= 10 && first3.length === 3 && first3.every(s => s.pos[0] < 20 && s.kind !== 'open' && s.cover >= 0.3) && tSusp > 12 && tPatrol > tSusp && maxN <= 8 && errDeg < 20 && pitchDeg < -15;
    verdict(ok, '(A) one searcher, central fix, west half dark', `${P0 ? P0.spots.length : 0} spots dealt (want ≥ 10); looked into ${looks.length}: ${looks.map(s => `${s.kind}@(${s.pos[0].toFixed(1)},${s.pos[2].toFixed(1)}) d${s.dark.toFixed(2)} +${s.t.toFixed(1)}s`).join(' → ')}; first three all west of x=20 and cover spots: ${first3.every(s => s.pos[0] < 20 && s.kind !== 'open')}; while looking into one: aim ${errDeg.toFixed(1)}° off its bearing (want < 20), pitched ${pitchDeg.toFixed(1)}° (want below −15: down into it); search → suspicious +${tSusp.toFixed(1)} s → patrol +${tPatrol.toFixed(1)} s; most light queries in a frame ${maxN} (budget 8)`);
    console.log('    dealt: ' + dealt.join('\n           '));
  }
  // ---- (B) two men, same fix
  {
    Math.random = seeded(302);
    const W = await standUp(); const { game } = W;
    game.playerInvisible = true; game.godMode = true; game.teleportPlayer([37.5, 0, 26.5]);
    for (let i = 0; i < 10; i++) W.step(DT);
    parkFrom(game, 2); const [a, b] = game.guards;
    dropSearcher(game, a, FIX, FIX); dropSearcher(game, b, [20.7, 0, 17.3], FIX);
    const restore = fakeLight(game, WEST_DARK);
    const looks: Record<string, any[]> = { a: [], b: [] }; const last: Record<string, string> = {}; let maxN = 0; const t0 = game.time; let lines = 0;
    const origSay = game.say.bind(game); game.say = (gd: any, text: string, radio = false) => { if (/check the corners/.test(text)) lines++; return origSay(gd, text, radio); };
    for (let f = 0; f < 60 * 30; f++) {
      W.step(DT); maxN = Math.max(maxN, game.searchProbeN);
      for (const [k, gd] of [['a', a], ['b', b]] as [string, any][]) { const P = gd.searchPlan; if (P && P.phase !== last[k]) { last[k] = P.phase; if (P.phase === 'look') looks[k].push({ ...P.spots[P.current], t: game.time - t0 }); } }
      if (a.state !== 'search' && b.state !== 'search') break;
    }
    restore(); game.say = origSay;
    let shared = 0, nearest = Infinity; for (const p of looks.a) for (const q of looks.b) { const d = v3.distXZ(p.pos, q.pos); nearest = Math.min(nearest, d); if (d < 1.0) shared++; }
    const firstDark = [...looks.a.slice(0, 2), ...looks.b.slice(0, 2)].every(s => s.pos[0] < 20);
    const ok = shared === 0 && looks.a.length >= 2 && looks.b.length >= 2 && firstDark && maxN <= 8 && lines <= 1;
    verdict(ok, '(B) two searchers on one fix split the spots', `A looked into ${looks.a.length}: ${looks.a.map(s => `(${s.pos[0].toFixed(1)},${s.pos[2].toFixed(1)})`).join(' ')} · B ${looks.b.length}: ${looks.b.map(s => `(${s.pos[0].toFixed(1)},${s.pos[2].toFixed(1)})`).join(' ')}; pairs within 1 m: ${shared} (want 0; nearest ${nearest.toFixed(2)} m); each man's first two dark-side: ${firstDark}; most light queries in a frame ${maxN} (want ≤ 8); 'check the corners' said ${lines}× (want ≤ 1)`);
  }
  // ---- (C) behind a latched door
  for (const locked of [true, false]) {
    Math.random = seeded(303);
    const W = await standUp(); const { game } = W;
    game.playerInvisible = true; game.godMode = true; game.teleportPlayer([37.5, 0, 26.5]);
    for (let i = 0; i < 10; i++) W.step(DT);
    parkFrom(game, 1); const gd = game.guards[0];
    const dw = game.doors.byName('breakroom_w'), dn = game.doors.byName('breakroom_n');
    for (const d of [dw, dn]) { d.angle = 0; d.vel = 0; d.latched = true; d.closing = false; d.quietT = 5; d.place(); }
    dw.locked = locked;   // (its keyed face is the cubicle side: Doors.side +1 for x < 28)
    const fix: Vec3 = [26.6, 0, 17.6];   // the aisle a stride west of that door
    dropSearcher(game, gd, fix, fix);
    const restore = fakeLight(game, () => 0.005);   // all dark: only cover and plausibility tell the spots apart
    W.step(DT);
    const P0 = gd.searchPlan; const inBreak = (s: any) => s.pos[0] > 28.3 && s.pos[2] > 12.4;
    const br0 = P0 ? P0.spots.filter(inBreak) : [];
    for (let f = 0; f < 72; f++) W.step(DT);   // to the first pick (the 1.2 s sweep)
    G.scoreSpots(game, gd, gd.searchPlan);
    const plEarly = br0.map((s: any) => s.plaus); const firstPick = gd.searchPlan?.current >= 0 ? gd.searchPlan.spots[gd.searchPlan.current] : null;
    let earlyVisit = false;
    for (let f = 0; f < 60 * 4; f++) { W.step(DT); const P = gd.searchPlan; if (P && P.phase === 'look' && inBreak(P.spots[P.current]) && game.time - P.t0 < 4.5) earlyVisit = true; }
    for (let f = 0; f < 60 * 5; f++) W.step(DT);   // ~10 s on: re-flooded and re-scored since
    const P1 = gd.searchPlan; if (P1) G.scoreSpots(game, gd, P1);
    const plLate = P1 ? P1.spots.filter(inBreak).map((s: any) => s.plaus) : [];
    restore();
    if (locked) verdict(!!P0 && P0.spots.length >= 6 && br0.length === 0, '(C1) fix by the break room\'s west door, that leaf latched and LOCKED against him, the corridor door latched', `${P0?.spots.length ?? 0} spots dealt, ${br0.length} of them inside the break room (want 0: no key, and round by the corridor is beyond ${9} m); dealt: ${(P0?.spots ?? []).map((s: any) => `${s.kind}@(${s.pos[0].toFixed(1)},${s.pos[2].toFixed(1)})`).join(' ')}`);
    else verdict(!!P0 && br0.length > 0 && plEarly.every((p: number) => p === 0) && !!firstPick && !inBreak(firstPick) && !earlyVisit && plLate.length > 0 && plLate.every((p: number) => p >= 0.99), '(C2) the same with the leaf latched but unlocked: dealt, implausible at first, plausible once there has been time to slip through and let it swing to',
      `${br0.length} break-room spots dealt; their plausibility at the first pick (+1.2 s): [${plEarly.map((p: number) => p.toFixed(2)).join(' ')}] (want all 0); first pick ${firstPick ? `${firstPick.kind}@(${firstPick.pos[0].toFixed(1)},${firstPick.pos[2].toFixed(1)})` : 'none'} (want this side of the door); a break-room spot looked into inside 4.5 s of the fix: ${earlyVisit} (want false); their plausibility ~10 s on: [${plLate.map((p: number) => p.toFixed(2)).join(' ')}] (want all 1)`);
  }
  // ---- (D) no provider: the harness's own silence
  {
    Math.random = seeded(304);
    const W = await standUp(); const { game } = W;
    game.playerInvisible = true; game.godMode = true; game.teleportPlayer([37.5, 0, 26.5]);
    for (let i = 0; i < 10; i++) W.step(DT);
    parkFrom(game, 1); const gd = game.guards[0];
    dropSearcher(game, gd, FIX, FIX);
    let threw = ''; let looks = 0, lastPhase = ''; let tSusp = -1, tPatrol = -1; const t0 = game.time; let neutral = true; let maxN = 0; const lines: string[] = [];
    const origSay = game.say.bind(game); game.say = (who: any, text: string, radio = false) => { if (who === gd) lines.push(`+${(game.time - t0).toFixed(1)}s ${text}`); return origSay(who, text, radio); };
    try {
      for (let f = 0; f < 60 * 50; f++) {
        W.step(DT); maxN = Math.max(maxN, game.searchProbeN);
        const P = gd.searchPlan;
        if (P) { if (P.spots.some((s: any) => s.dark !== 0.5 || s.E !== undefined)) neutral = false; if (P.phase !== lastPhase) { lastPhase = P.phase; if (P.phase === 'look') looks++; } }
        if (tSusp < 0 && gd.state === 'suspicious') tSusp = game.time - t0;
        if (tPatrol < 0 && gd.state === 'patrol') { tPatrol = game.time - t0; break; }
      }
    } catch (e: any) { threw = String(e?.stack ?? e); }
    game.say = origSay;
    const ok = !threw && neutral && looks >= 2 && tSusp >= 12 && tSusp <= 27 && tPatrol > tSusp && tPatrol < 40 && maxN >= 1 && maxN <= 8 && game.probe.pending.length <= 32;
    verdict(ok, '(D) no light provider (headless GPU): neutral plan, completes, exits by the old clocks', `${threw ? 'EXCEPTION ' + threw.slice(0, 200) + ' · ' : ''}spots looked into ${looks} (want ≥ 2); every reading neutral throughout: ${neutral}; search → suspicious +${tSusp.toFixed(1)} s (want 12‥27) → patrol +${tPatrol.toFixed(1)} s; light queries a frame ≤ ${maxN} (still asked of the probe: its pending list holds ${game.probe.pending.length}/32); his lines: ${lines.join(' | ')}`);
  }
  console.log(`=== darkness: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}

// ================================================================ pieing
/** The doorway table: an alert man with a three-second-old fix beyond a door, started from the corridor either side of it, from inside the room, from the cubicle
 *  aisle — each run twice off the same seed, threshold discipline on and off (guards.ts AI_TUNE.pieing). Per door: he must come down to a walk inside 1.5 m of
 *  the sill, his look must sweep ≥ 60° during the slice before he crosses, the corner check must turn his aim ≥ 55° off his chest as he steps through, and the
 *  whole thing may cost < 1.5 s against the run without it (timed to a metre past the line). Then: (E) eyes on Sam — lit, in the room beyond — no pie and no
 *  brake; (F) the door he has just gone through, turned round and taken again inside six seconds: not pied twice; (G) under the tour flag: nothing. */
export async function pieing() {
  console.log('\n=== pieing: hunting men slice the doorways on their path — brake, sweep, corner, on — and know when not to ===');
  let allPass = true; const verdict = (ok: boolean, label: string, detail: string) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  type Case = { name: string; start: Vec3; fix: Vec3; door: string };
  const cases: Case[] = [
    { name: 'conference door from the corridor east of it', start: [13.0, 0, 11.2], fix: [7.0, 0, 6.5], door: 'conference' },
    { name: 'conference door from the corridor west of it', start: [6.0, 0, 11.2], fix: [7.0, 0, 6.5], door: 'conference' },
    { name: 'conference door from inside the room', start: [6.3, 0, 8.3], fix: [13.0, 0, 11.2], door: 'conference' },
    { name: 'conference door head-on out of the cubicle doorway', start: [13.7, 0, 12.6], fix: [7.0, 0, 6.5], door: 'conference' },
    { name: 'storage door (locked, latched: he has the key) from the corridor', start: [28.0, 0, 11.3], fix: [33.5, 0, 6.5], door: 'storage' },
    { name: 'server door (locked, latched) from the corridor east of it', start: [20.0, 0, 11.2], fix: [18.0, 0, 7.0], door: 'server' },
    { name: 'break room west door (standing open) from the cubicle aisle', start: [26.4, 0, 20.0], fix: [31.0, 0, 16.0], door: 'breakroom_w' },
    { name: 'break room corridor door (latched) from the corridor', start: [25.0, 0, 11.2], fix: [32.0, 0, 15.0], door: 'breakroom_n' },
  ];
  type Run = { crossedAt: number; past1At: number; phases: string; maxSpdNear: number; span: number; cornerMax: number; along: number };
  async function run(c: Case, pieOn: boolean, opts: { quiet?: boolean; seenAgo?: number } = {}): Promise<Run> {
    G.AI_TUNE.pieing = pieOn;
    Math.random = seeded(311);
    const W = await standUp(); const { game } = W;
    game.playerInvisible = true; game.godMode = true; game.quietUtility = !!opts.quiet; game.teleportPlayer([37.5, 0, 26.5]);
    for (let i = 0; i < 10; i++) W.step(DT);
    parkFrom(game, 1); const gd = game.guards[0]; gd.heardUpTo = 1e12;
    const d = game.doors.byName(c.door);
    gd.char.pos = v3.copy(c.start); gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.char.bodyYaw = gd.char.aimYaw = Math.atan2(c.fix[0] - c.start[0], c.fix[2] - c.start[2]); gd.path = []; gd.pathGoal = null; gd.char.update(0); gd.char.update(DT);
    gd.state = 'alert'; gd.awareness = 1; gd.reactT = 0; gd.lastKnown = v3.copy(c.fix); gd.lastSeenT = game.time - (opts.seenAgo ?? 3); G.resetChase(gd); gd.pinned = false; gd.hold = false; gd.dazzledUntil = -1;
    const ux = Math.cos(d.def.closedDir), uz = Math.sin(d.def.closedDir), nx = -uz, nz = ux, hx = d.def.hinge[0], hz = d.def.hinge[1], Wd = d.def.width;
    const perp = (p: Vec3) => (p[0] - hx) * nx + (p[2] - hz) * nz; const side0 = Math.sign(perp(gd.char.pos));
    const X: Vec3 = [hx + ux * Wd * 0.5, 0, hz + uz * Wd * 0.5];
    let crossedAt = -1, past1At = -1, maxSpdNear = 0, cornerMax = 0, along = NaN; const phases = new Set<string>(); const t0 = game.time;
    let prevYaw = gd.char.aimYaw, unwrapped = 0; const uw: number[] = [];
    for (let f = 0; f < 60 * 16; f++) {
      W.step(DT);
      const p = gd.char.pos; const pp = perp(p) * side0; const dX = v3.distXZ(p, X);
      unwrapped += wrapAngle(gd.char.aimYaw - prevYaw); prevYaw = gd.char.aimYaw;
      if (gd.pieing) phases.add(gd.pieing.phase);
      if (crossedAt < 0 && pp > 0 && dX < 1.5) maxSpdNear = Math.max(maxSpdNear, gd.speed);
      if (crossedAt < 0 && gd.pieing && gd.pieing.phase !== 'approach') uw.push(unwrapped);
      if (crossedAt < 0 && pp <= 0) { crossedAt = game.time - t0; along = (p[0] - hx) * ux + (p[2] - hz) * uz; uw.push(unwrapped); }
      if (crossedAt >= 0 && game.time - t0 - crossedAt < 0.55) cornerMax = Math.max(cornerMax, Math.abs(wrapAngle(gd.char.aimYaw - gd.char.bodyYaw)) * 180 / Math.PI);
      if (past1At < 0 && pp < -1.0) past1At = game.time - t0;
      if (past1At >= 0 && game.time - t0 > past1At + 0.6) break;
    }
    G.AI_TUNE.pieing = true;
    return { crossedAt, past1At, phases: [...phases].join(','), maxSpdNear, span: uw.length ? (Math.max(...uw) - Math.min(...uw)) * 180 / Math.PI : 0, cornerMax, along };
  }
  const walk = 1.15;   // game.tune.guardWalk
  for (const c of cases) {
    const on = await run(c, true), off = await run(c, false);
    const delay = on.past1At - off.past1At;
    const ok = on.phases.includes('slice') && on.phases.includes('cross') && on.crossedAt > 0 && on.maxSpdNear <= walk + 0.12 && on.span >= 60 && on.cornerMax >= 55 && delay < 1.5 && off.phases === '';
    verdict(ok, c.name, `phases ${on.phases || '—'}; fastest inside 1.5 m of the sill ${on.maxSpdNear.toFixed(2)} m/s (walk ${walk}); look swept ${on.span.toFixed(0)}° in the slice before crossing (want ≥ 60); corner check ${on.cornerMax.toFixed(0)}° off his chest as he steps through (want ≥ 55); crossed ${on.along.toFixed(2)} m along the frame from the hinge (width 1.16); a metre past the line at +${on.past1At.toFixed(2)} s vs +${off.past1At.toFixed(2)} s without = ${delay >= 0 ? '+' : ''}${delay.toFixed(2)} s (want < 1.5); off-run pied: ${off.phases || 'nothing'}`);
  }
  // ---- (E) hot on his heels: no drill. (With Sam actually IN sight and a line through the glazing he plants and shoots rather than walk anywhere; what takes a
  // man through a doorway with eyes on is Sam just gone through it ahead of him — so: the fix in the room beyond the conference door and the sighting held at
  // 0.7 s old every frame, inside pieDoorway's second of grace but past the half-second licence to fire.)
  {
    Math.random = seeded(312);
    const W = await standUp(); const { game } = W;
    game.playerInvisible = true; game.godMode = true; game.teleportPlayer([37.5, 0, 26.5]);
    for (let i = 0; i < 10; i++) W.step(DT);
    parkFrom(game, 1); const gd = game.guards[0]; gd.heardUpTo = 1e12;
    const d = game.doors.byName('conference');
    gd.char.pos = [14.5, 0, 11.2]; gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.char.bodyYaw = gd.char.aimYaw = -Math.PI / 2; gd.path = []; gd.pathGoal = null; gd.char.update(0); gd.char.update(DT);
    gd.state = 'alert'; gd.awareness = 1; gd.reactT = 0; gd.lastKnown = [6.8, 0, 7.4]; gd.lastSeenT = game.time - 0.7; G.resetChase(gd); gd.pinned = false; gd.hold = false; gd.dazzledUntil = -1;
    let pies = 0, maxSpdNear = 0, crossed = false; const t0 = game.time;
    for (let f = 0; f < 60 * 10 && !crossed; f++) {
      gd.lastSeenT = game.time - 0.7; gd.awareness = 1;
      W.step(DT);
      if (gd.pieing) pies++;
      const dX = v3.distXZ(gd.char.pos, d.frameCentre); if (dX < 1.5 && gd.char.pos[2] > 10) maxSpdNear = Math.max(maxSpdNear, gd.speed);
      if (gd.char.pos[2] < 9.9) crossed = true;
    }
    verdict(pies === 0 && crossed && maxSpdNear > 2.0, '(E) through the conference door 0.7 s behind Sam (chasing, not clearing)', `frames with a pie standing ${pies} (want 0); crossed into the room ${crossed} at up to ${maxSpdNear.toFixed(2)} m/s inside 1.5 m of the door (want > 2: no brake); ${(game.time - t0).toFixed(1)} s`);
  }
  // ---- (F) the door he has just gone through
  {
    Math.random = seeded(313);
    const W = await standUp(); const { game } = W;
    game.playerInvisible = true; game.godMode = true; game.teleportPlayer([37.5, 0, 26.5]);
    for (let i = 0; i < 10; i++) W.step(DT);
    parkFrom(game, 1); const gd = game.guards[0]; gd.heardUpTo = 1e12;
    const d = game.doors.byName('server');
    gd.char.pos = [20.0, 0, 11.2]; gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.char.bodyYaw = gd.char.aimYaw = -Math.PI / 2; gd.path = []; gd.pathGoal = null; gd.char.update(0); gd.char.update(DT);
    gd.state = 'alert'; gd.awareness = 1; gd.reactT = 0; gd.lastKnown = [18.0, 0, 7.0]; gd.lastSeenT = game.time - 3; G.resetChase(gd); gd.pinned = false; gd.hold = false; gd.dazzledUntil = -1;
    let firstPie = false, inAt = -1, secondPie = false, outAt = -1; const t0 = game.time; let turned = false;
    for (let f = 0; f < 60 * 14; f++) {
      W.step(DT);
      const z = gd.char.pos[2];
      if (inAt < 0) { if (gd.pieing?.door === d) firstPie = true; if (z < 9.4) inAt = game.time - t0; }
      else if (!turned) { turned = true; gd.lastKnown = [21.5, 0, 11.3]; gd.alertRef = null; gd.awareness = 1; gd.state = 'alert'; gd.lastSeenT = game.time - 3; }   // a new fix straight back out in the corridor: he turns about and takes the same door again
      else { if (gd.pieing?.door === d && gd.pieing.phase !== 'cross') secondPie = true; if (outAt < 0 && z > 10.6) outAt = game.time - t0; }   // (a fresh pie — the corner check of the one going in may still be running the frame he turns)
      if (outAt >= 0 && game.time - t0 > outAt + 0.5) break;
    }
    verdict(firstPie && inAt > 0 && outAt > 0 && outAt - inAt < 6 && !secondPie, '(F) back out through the server door he has just come in by', `pied going in: ${firstPie}; in at +${inAt.toFixed(1)} s, out again at +${outAt >= 0 ? outAt.toFixed(1) : '—'} s (${outAt >= 0 ? (outAt - inAt).toFixed(1) : '—'} s later, inside the 6); pied coming out: ${secondPie} (want false)`);
  }
  // ---- (G) under the tour flag
  {
    const c = cases[0]; const r = await run(c, true, { quiet: true });
    verdict(r.phases === '' && r.crossedAt > 0, '(G) the same doorway under quietUtility (the tour)', `pied: ${r.phases || 'nothing'} (want nothing); crossed at +${r.crossedAt.toFixed(2)} s`);
  }
  console.log(`=== pieing: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}
