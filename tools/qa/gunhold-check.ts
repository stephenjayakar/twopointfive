// `bun run tools/qa/gunhold-check.ts [front|line|knife|all] [--verbose]` (also `probes.ts gunhold`): a pistol from behind a held man — the men who see it run for
// cover, work round, and use the line at Sam's back once he has fired (src/game/gunhold.ts). The maintainer, 10-12: "when you're holding a hostage, enemies
// pretty much ignore that you're shooting at them and you can just take them down. they should probably run for cover when you take out a gun and actively work
// on flanking you". Every staging is the standoff probes' own (Novak held in the break room, Kowalski and Reyes brought in), run with the rule OFF then ON:
//   front   the gun hold, both men in FRONT of the pair; Sam turns the pistol on whoever he has a line to and fires once a second. OFF = the fault (they stand
//           in his line for the whole of it and are shot down, not a round back); ON = out of his line inside a few seconds, at least one of them round to the
//           line at his back, and a round from there once Sam has fired — never one before, never one that is not down the clean line;
//   line    Reyes starts BEHIND the pair, Sam fires at Kowalski in front: ON = Reyes' first round only AFTER Sam's first, every round down the clean line, the
//           held man untouched; `GUNHOLD.fire` false = cover and the way round, the line silent; OFF = silent (the old rule);
//   knife   the ARM hold (no pistol in it): rule ON ≡ rule OFF frame for frame (the old ring — the rule is the pistol's).
// `GUNHOLD_BREAK=1` leaves the switch off in the ON arm: front, round and line must fail (knife is an identity: it holds either way). Exit 0 / 1.
if (import.meta.main) (globalThis as any).process.env.TPS_PROFILE ??= 'shipped';   // (run by name: the page's stand; under probes.ts the runner's own — the check holds on both)
const { ROOT } = await import('./headless.ts');   // (loaded AFTER the line above: a static import is hoisted over it, and the harness then stood frozen under a shipped word)
const { stageHold, bringIn, bearingPoint, rearDeg, roundClearance } = await import('./standoff-probes.ts');
const { v3, DEG } = await import(`${ROOT}/src/math/vec.ts`);
const { pairOf, flankShot, clearShot } = await import(`${ROOT}/src/game/guards.ts`);
const { GUNHOLD, GUNHOLD_DEBUG, gunHoldStats, gunHoldSummary, gunHoldPhase } = await import(`${ROOT}/src/game/gunhold.ts`);

type Vec3 = [number, number, number];
const DT = 1 / 60, FACE = 190; const AT: Vec3 = [33.0, 0, 17.8];
const f1 = (x: number) => x.toFixed(1), f2 = (x: number) => x.toFixed(2);
const NOTICE = 1.2, REACT = 0.35;   // s: to notice a man who steps out BEHIND him; to get the cursor onto a man who shows himself in front
let SEED = Number((globalThis as any).process?.env?.GH_SEED ?? 385);
const BREAK = String((globalThis as any).process?.env?.GUNHOLD_BREAK ?? '') === '1';
const VERBOSE = ((globalThis as any).process?.argv ?? []).includes('--verbose');

/** is this man in Sam's line of fire, forward of his rear arc (the check's own reading: the pair's TRUE place, a round's line to his chest or head) */
function inLine(game: any, m: any, P: any): boolean {
  if (rearDeg(game, m) <= 70) return false;
  const G: Vec3 = [P.sam[0], 1.35, P.sam[2]], p = m.char.pos, low = m.char.anim.crouch > 0.5;
  return !game.col.shotBlocked(G, [p[0], low ? 0.8 : 1.25, p[2]]) || !game.col.shotBlocked(G, [p[0], low ? 1.05 : 1.6, p[2]]);
}
interface Run { exc: string; ended: string; samShots: number; firstSamShot: number; guardShots: { t: number; who: string; clear: number; rear: number; ok: boolean }[]; hits: number; dead: string[]; deadT: number[]; lineSecs: Record<string, number>; lineAfter: Record<string, number>; stood: Record<string, number>; reachedBack: string[]; victim: string; trace: string[]; lines: string[]; stats: any; log: string[]; }
/** one staged run. `where` = bearings (deg, off the pair's facing) and ranges of Kowalski and Reyes; `gun` = the pistol in the hold; Sam's script: the cursor on
 *  the nearest living man he has a line of fire to (else where it was), a click every second from `firstClick` on while `shoot` */
async function run(on: boolean, gun: boolean, where: [number, number][], secs: number, shoot: boolean, firstClick = 1.5, fire = true, at: Vec3 = AT, face = FACE, blind = false, drawAt = -1): Promise<Run> {
  const S = await stageHold(SEED, 1, at, face * DEG, false, gun && drawAt < 0); const { W, game, victim, lines, faceDeg } = S;
  const was = { on: GUNHOLD.on, fire: GUNHOLD.fire }; GUNHOLD.on = on && !BREAK; GUNHOLD.fire = fire;
  const A = game.guards[0], C = game.guards[2], men = [A, C];
  const P0 = pairOf(game)!; const centre = v3.copy(P0.centre);
  bringIn(game, A, bearingPoint(centre, faceDeg + where[0][0], where[0][1]), centre); bringIn(game, C, bearingPoint(centre, faceDeg + where[1][0], where[1][1]), centre);
  const R: Run = { exc: '', ended: '', samShots: 0, firstSamShot: -1, guardShots: [], hits: 0, dead: [], deadT: [], lineSecs: {}, lineAfter: {}, stood: {}, reachedBack: [], victim: '', trace: [], lines: [], stats: null, log: [] };
  for (const m of men) { R.lineSecs[m.callsign] = 0; R.lineAfter[m.callsign] = 0; R.stood[m.callsign] = 0; }
  if (VERBOSE) GUNHOLD_DEBUG.log = (s: string) => R.log.push(`${f2(game.time - t0)}s ${s}`);
  const t0 = game.time; let prevHit = game.player.hitFlash, nextClick = firstClick, drew = false; let cursor: Vec3 = v3.add(A.char.pos, [0, 1.25, 0]);
  const seenBehind = new Map<any, number>(), seenAhead = new Map<any, number>();
  try {
    for (let f = 0; f < 60 * secs; f++) {
      const P = pairOf(game); const t = game.time - t0;
      // THE SCRIPTED PLAYER'S EYES: a man he has a line of fire to in the half of the floor he is facing is his at once; one who shows himself BEHIND him is
      // noticed only after NOTICE seconds in the open there (a person watching the men in front of him does not turn on the frame a man steps out at his back)
      if (P && blind) { if (A.state !== 'dead') cursor = v3.add(A.char.pos, [0, 1.25, 0]); }   // (`blind`: he never looks round — the cursor stays on the first man, then where he fell)
      else if (P) { let best: any = null, bd = 1e9; for (const m of men) { if (m.state === 'dead') { seenBehind.delete(m); continue; } const d = v3.distXZ(m.char.pos, P.sam); const open = !game.col.shotBlocked([P.sam[0], 1.35, P.sam[2]], m.char.bones.spine2 ?? v3.add(m.char.pos, [0, 1.25, 0]));
          const ahead = rearDeg(game, m) >= 80; if (!open) { seenBehind.delete(m); seenAhead.delete(m); continue; } if (!ahead) { const s0 = seenBehind.get(m) ?? t; seenBehind.set(m, s0); if (t - s0 < NOTICE) continue; } else { const s0 = seenAhead.get(m) ?? t; seenAhead.set(m, s0); if (t - s0 < REACT) continue; seenBehind.set(m, -1e9); }
          if (d < bd) { bd = d; best = m; } } if (best) cursor = v3.add(best.char.pos, [0, 1.25, 0]); }
      W.cursorAt(cursor);
      if (drawAt >= 0 && t >= drawAt && game.player.holding?.variant === 'arm' && !drew) { W.input.pressed.add('KeyE'); drew = true; }   // the pistol comes out with the man already in the arm (E)
      if (shoot && t >= nextClick && (blind || R.samShots === 0 || (P && men.some(m => m.state !== 'dead' && !game.col.shotBlocked([P.sam[0], 1.35, P.sam[2]], v3.add(m.char.pos, [0, m.char.anim.crouch > 0.5 ? 0.8 : 1.25, 0])))))) { W.input.clicked |= 1; nextClick = t + 1.0; }   // (his first round whatever is there; after it only with a man to put one on — `blind`: on into the room regardless)
      W.step(DT);
      const P2 = pairOf(game); const now = game.time;
      if (game.player.hitFlash > prevHit + 1e-9) R.hits++; prevHit = game.player.hitFlash;
      const sam = game.events.filter((e: any) => e.kind === 'shot' && e.time === now).length; if (sam && R.firstSamShot < 0) R.firstSamShot = now - t0; R.samShots += sam;
      if (!P2) { R.ended = `${f2(now - t0)}s: victim ${victim.state}/${victim.downKind ?? '-'}/${victim.downBy ?? '-'}`; break; }
      for (const e of game.events.filter((e: any) => e.kind === 'guardShot' && e.time === now)) for (const m of men) if (v3.distXZ(e.pos, m.char.pos) < 0.05) { const fs = flankShot(game, m, P2); R.guardShots.push({ t: now - t0, who: m.callsign, clear: roundClearance(game, m), rear: rearDeg(game, m), ok: fs.rear <= 70 * DEG + 1e-6 }); }
      for (const m of men) {
        if (m.state === 'dead') { if (!R.dead.includes(m.callsign)) { R.dead.push(m.callsign); R.deadT.push(now - t0); } continue; }
        if (inLine(game, m, P2)) { R.lineSecs[m.callsign] += DT; if (now - t0 > Math.max(0, drawAt) + 3.5) R.lineAfter[m.callsign] += DT;
          if (now - t0 > Math.max(0, drawAt) + 0.6 && now - t0 < Math.max(0, drawAt) + 3.6 && Math.hypot(m.char.vel[0], m.char.vel[2]) < 1.5) R.stood[m.callsign] += DT; }   // (the fault itself: in front of the pistol, in its line, and not running)
        if (rearDeg(game, m) <= 70 && v3.distXZ(m.char.pos, P2.sam) <= 5.5 && !R.reachedBack.includes(m.callsign)) R.reachedBack.push(m.callsign);
      }
      if (f % (process.env.GH_FINE && now - t0 >= +process.env.GH_FINE.split('-')[0] && now - t0 <= +process.env.GH_FINE.split('-')[1] ? 6 : 60) === 0) R.trace.push(`${f1(now - t0)}s ${men.map(m => `${m.callsign} ${m.state}${m.standoff ? '/so' : ''} ${gunHoldPhase(game, m) ?? '-'} (${f1(m.char.pos[0])}, ${f1(m.char.pos[2])}) rear ${f1(rearDeg(game, m))}°${m.state !== 'dead' && inLine(game, m, P2) ? ' IN LINE' : ''}${m.state !== 'dead' && P2 && process.env.GH_FS ? ((fs) => ` fs ${fs.ok ? 'OK' : 'no'} clr ${fs.clear.toFixed(2)} d ${fs.dist.toFixed(1)} cs ${clearShot(game, m.char, P2.aim) ? 1 : 0} cr ${m.char.anim.crouch.toFixed(1)} trk ${m.aim.track.toFixed(2)} cd ${m.fireCd.toFixed(2)} seen ${(game.time - m.lastSeenT).toFixed(2)} gy ${(m.char.gunYaw * 57.3).toFixed(0)} md ${m.muzzleDown ? 1 : 0} rT ${m.reactT.toFixed(2)} rl ${m.reloadT.toFixed(1)} v ${Math.hypot(m.char.vel[0], m.char.vel[2]).toFixed(1)}`)(flankShot(game, m, P2)) : ''}`).join(' · ')} · Sam ${R.samShots} rd`);
    }
  } catch (e: any) { R.exc = String(e?.stack ?? e); }
  R.victim = `${victim.state}${victim.state === 'dead' ? `/${victim.downKind}/${victim.downBy}` : ''}`;
  R.lines = lines.filter((l: any) => l.t > t0).map((l: any) => `${f1(l.t - t0)}s ${l.who}${l.radio ? ' (radio)' : ''}: "${l.text}"`);
  R.stats = { ...gunHoldStats(game) }; R.trace.push(gunHoldSummary(game));
  GUNHOLD_DEBUG.log = null; GUNHOLD.on = was.on; GUNHOLD.fire = was.fire; game.puppet = null;
  return R;
}
const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
function say(ok: boolean, head: string, R: Run[], fails: string[]) {
  console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${head}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
  if (VERBOSE || !ok) for (const r of R) console.log('    ' + [...r.trace, ...r.lines.map(l => 'said ' + l), ...r.log].join('\n    '));
}
const brief = (r: Run) => `in his line ${Object.entries(r.lineSecs).map(([k, v]) => `${k} ${f1(v)} s`).join(', ')} (not running, in the 3 s after the draw: ${f1(sum(r.stood))} s) · down: ${r.dead.map((d, i) => `${d} ${f1(r.deadT[i])} s`).join(', ') || 'nobody'} · Sam ${r.samShots} rd · their rounds ${r.guardShots.length} · Sam hit ${r.hits}× · at his back: ${r.reachedBack.join(', ') || 'nobody'}`;

export async function gunholdFront(): Promise<boolean> {
  const where: [number, number][] = [[15, 4.6], [-25, 4.8]];
  const off = await run(false, true, where, 24, true, 7.0, true, AT, FACE, false, 5), on = await run(true, true, where, 24, true, 7.0, true, AT, FACE, false, 5);
  const fails: string[] = [];
  for (const r of [off, on]) { if (r.exc) fails.push('exception: ' + r.exc.split('\n').slice(0, 3).join(' | ')); }
  // the fault, as it stood
  if (off.guardShots.length) fails.push(`rule off: ${off.guardShots.length} round(s) back (the old rule holds every one)`);
  if (off.dead.length < 1) fails.push(`rule off: Sam shot nobody down in 20 s (the staging no longer shows the fault)`);
  // the rule
  if (on.stats.armed < 1) fails.push('rule on: nobody saw the pistol in the hold');
  if (on.stats.ran < 1) fails.push('rule on: nobody ran for cover');
  if (sum(on.stood) > 1.0) fails.push(`rule on: ${f1(sum(on.stood))} s spent in the pistol's line and not running in the 3 s after the draw (${Object.entries(on.stood).map(([k, v]) => `${k} ${f1(v)}`).join(', ')}; want ≤ 1 between the two)`);
  if (sum(on.stood) > 0.5 * sum(off.stood)) fails.push(`rule on: ${f1(sum(on.stood))} s in his line not running against ${f1(sum(off.stood))} s with it off (want under half)`);
  if (on.dead.length > off.dead.length) fails.push(`rule on: ${on.dead.length} shot down against ${off.dead.length} with it off`);
  if (on.dead.length && on.samShots / on.dead.length < off.samShots / Math.max(1, off.dead.length)) fails.push(`rule on: ${on.samShots} rounds for ${on.dead.length} down — cheaper than with it off (${off.samShots} for ${off.dead.length})`);
  for (const s of on.guardShots) { if (on.firstSamShot < 0 || s.t < on.firstSamShot) fails.push(`rule on: ${s.who} fired at ${f2(s.t)} s, before Sam had (${f2(on.firstSamShot)} s)`); if (!s.ok || s.clear < 0.45 - 1e-3) fails.push(`rule on: ${s.who}'s round at ${f2(s.t)} s was not down the clean line (rear ${f1(s.rear)}°, ${f2(s.clear)} m off the held man)`); }
  if (on.victim.startsWith('dead') && !/player/.test(on.victim)) fails.push(`rule on: the held man died to his own side (${on.victim})`);
  const ok = !fails.length;
  say(ok, `gunhold-front: a bare room (no cover but out of its doors) — the pistol out at 5 s with two men in front, Sam fires at whoever he has a line to\n    OFF  ${brief(off)}\n    ON   ${brief(on)} · ${JSON.stringify(on.stats)}`, [off, on], fails);
  return ok;
}
/** the cubicle floor: the pair in the middle aisle facing west, two men up the aisle in front of them; desks and partitions either side, an aisle round each */
export async function gunholdRound(): Promise<boolean> {
  const where: [number, number][] = [[8, 4.6], [-8, 5.2]]; const at: Vec3 = [21.5, 0, 17.75];
  const off = await run(false, true, where, 45, true, 7.0, true, at, 270, false, 5), on = await run(true, true, where, 45, true, 7.0, true, at, 270, false, 5);
  const fails: string[] = [];
  for (const r of [off, on]) if (r.exc) fails.push('exception: ' + r.exc.split('\n').slice(0, 3).join(' | '));
  if (off.guardShots.length) fails.push(`rule off: ${off.guardShots.length} round(s) back`);
  if (on.stats.ran < 1) fails.push('rule on: nobody ran for cover');
  if (on.stats.rounds < 1) fails.push('rule on: nobody set off round him');
  if (!on.reachedBack.length) fails.push('rule on: nobody got round to his back in 45 s');
  if (!on.guardShots.length) fails.push('rule on: Sam fired from behind the man and no round ever came from the line at his back');
  for (const s of on.guardShots) { if (on.firstSamShot < 0 || s.t < on.firstSamShot) fails.push(`rule on: ${s.who} fired at ${f2(s.t)} s, before Sam had (${f2(on.firstSamShot)} s)`); if (!s.ok || s.clear < 0.45 - 1e-3) fails.push(`rule on: ${s.who}'s round at ${f2(s.t)} s was not down the clean line (rear ${f1(s.rear)}°, ${f2(s.clear)} m off the held man)`); }
  if (sum(on.stood) > 1.5) fails.push(`rule on: ${f1(sum(on.stood))} s spent in the pistol's line and not running after the draw (want ≤ 1.5 between the two)`);
  if (on.samShots < 2 * off.samShots) fails.push(`rule on: Sam needed ${on.samShots} rounds against ${off.samShots} with it off (want at least twice as many)`);
  if (on.dead.length && off.deadT.length && on.deadT[0] < off.deadT[off.deadT.length - 1] + 5) fails.push(`rule on: a man down at ${f1(on.deadT[0])} s — with it off both were down by ${f1(off.deadT[off.deadT.length - 1])} s (want cover to buy them 5 s and more)`);
  if (on.dead.length > off.dead.length) fails.push(`rule on: ${on.dead.length} shot down against ${off.dead.length} with it off`);
  if (on.victim.startsWith('dead') && !/player/.test(on.victim)) fails.push(`rule on: the held man died to his own side (${on.victim})`);
  const ok = !fails.length;
  say(ok, `gunhold-round: pistol hold in the cubicles' middle aisle, two men in front, Sam fires at whoever he has a line to\n    OFF  ${brief(off)}\n    ON   ${brief(on)} · ${JSON.stringify(on.stats)}`, [off, on], fails);
  return ok;
}
export async function gunholdLine(): Promise<boolean> {
  const where: [number, number][] = [[15, 4.6], [180 - 12, 4.4]];
  const off = await run(false, true, where, 14, true, 3.0, true, AT, FACE, true), on = await run(true, true, where, 14, true, 3.0, true, AT, FACE, true), mute = await run(true, true, where, 14, true, 3.0, false, AT, FACE, true);
  const fails: string[] = [];
  for (const r of [off, on, mute]) if (r.exc) fails.push('exception: ' + r.exc.split('\n').slice(0, 3).join(' | '));
  if (off.guardShots.length) fails.push(`rule off: ${off.guardShots.length} round(s) back`);
  if (mute.guardShots.length) fails.push(`fire switch off: ${mute.guardShots.length} round(s) from the line (want none: the line held silent)`);
  if (!on.guardShots.some(s => s.who === 'Reyes')) fails.push('rule on: Reyes, on the line at Sam\'s back from the start, never used it after Sam fired');
  for (const s of on.guardShots) { if (on.firstSamShot < 0 || s.t < on.firstSamShot) fails.push(`rule on: ${s.who} fired at ${f2(s.t)} s, before Sam had (${f2(on.firstSamShot)} s)`); if (!s.ok || s.clear < 0.45 - 1e-3) fails.push(`rule on: ${s.who}'s round at ${f2(s.t)} s was not down the clean line (rear ${f1(s.rear)}°, ${f2(s.clear)} m off the held man)`); }
  if (on.guardShots.length > 1) { const gaps = on.guardShots.filter(s => s.who === 'Reyes').map((s, i, a) => i ? s.t - a[i - 1].t : 9).slice(1); const least = Math.min(9, ...gaps); if (least < 1.0) fails.push(`rule on: two of Reyes' rounds ${f2(least)} s apart (the standoff's cadence is ≥ 1.2 s)`); }
  if (on.hits < 1) fails.push('rule on: not one of the rounds down the line found Sam');
  if (on.victim.startsWith('dead') && !/player/.test(on.victim)) fails.push(`rule on: the held man died to his own side (${on.victim})`);
  const ok = !fails.length;
  say(ok, `gunhold-line: Reyes behind the pair, Sam fires at Kowalski from 3 s\n    OFF  ${brief(off)}\n    ON   ${brief(on)} · first of theirs ${on.guardShots.length ? f2(on.guardShots[0].t) : '—'} s after Sam's at ${f2(on.firstSamShot)} s\n    ON, fire off  ${brief(mute)}`, [off, on, mute], fails);
  return ok;
}
export async function gunholdKnife(): Promise<boolean> {
  const where: [number, number][] = [[15, 4.6], [-25, 4.8]];
  const off = await run(false, false, where, 12, false), on = await run(true, false, where, 12, false);
  const fails: string[] = [];
  for (const r of [off, on]) if (r.exc) fails.push('exception: ' + r.exc.split('\n').slice(0, 3).join(' | '));
  if (!BREAK && on.stats.armed) fails.push('the rule armed on a hold with no pistol in it');
  if (!BREAK && on.stats.ran) fails.push('a man ran for cover from a knife');
  const a = off.trace.slice(0, -1).join('\n'), b = on.trace.slice(0, -1).join('\n');
  if (a !== b) fails.push('the arm hold played differently with the rule on (want the old ring, second for second)');
  const ok = !fails.length;
  say(ok, `gunhold-knife: the arm hold (no pistol) — the old ring with the rule on\n    OFF  ${brief(off)}\n    ON   ${brief(on)}`, [off, on], fails);
  return ok;
}
export async function gunholdCheck(which = 'all'): Promise<boolean> {
  console.log('\n=== gunhold: a pistol from behind a held man — cover, the way round, the line at his back ===');
  let ok = true;
  if (which === 'all' || which === 'front') ok = (await gunholdFront()) && ok;
  if (which === 'all' || which === 'round') ok = (await gunholdRound()) && ok;
  if (which === 'all' || which === 'line') ok = (await gunholdLine()) && ok;
  if (which === 'all' || which === 'knife') ok = (await gunholdKnife()) && ok;
  return ok;
}
/** `tally <front|round> [--seeds a-b]`: the staging over a spread of seeds (the dice of the rounds' cones and the men's beats), rule off against on — no verdict */
async function tally(scn: string, a: number, b: number) {
  const round = scn === 'round'; const where: [number, number][] = round ? [[8, 4.6], [-8, 5.2]] : [[15, 4.6], [-25, 4.8]]; const at: Vec3 = round ? [21.5, 0, 17.75] : AT, face = round ? 270 : FACE, secs = round ? 45 : 24;
  const T = { offDead: 0, onDead: 0, rounds: 0, hits: 0, samRd: 0, offRd: 0, first: 0, n: 0, hitRuns: 0 };
  for (let seed = a; seed <= b; seed++) {
    SEED = seed; const off = await run(false, true, where, secs, true, 7.0, true, at, face, false, 5), on = await run(true, true, where, secs, true, 7.0, true, at, face, false, 5);
    T.n++; T.offDead += off.dead.length; T.onDead += on.dead.length; T.rounds += on.guardShots.length; T.hits += on.hits; T.samRd += on.samShots; T.offRd += off.samShots; if (on.hits) T.hitRuns++;
    console.log(`  seed ${seed}: OFF ${off.dead.length} down [${off.deadT.map(f1).join(', ')}] s, Sam ${off.samShots} rd · ON ${on.dead.length} down [${on.deadT.map(f1).join(', ')}] s, Sam ${on.samShots} rd, their rounds ${on.guardShots.length}${on.guardShots.length ? ` (first ${f1(on.guardShots[0].t)} s)` : ''}, Sam hit ${on.hits}×, at his back: ${on.reachedBack.join(', ') || '-'}${on.exc ? ' EXC ' + on.exc.split('\n')[0] : ''}`);
  }
  console.log(`  ${scn}, ${T.n} seeds: OFF ${T.offDead} men down for ${T.offRd} of Sam's rounds · ON ${T.onDead} down for ${T.samRd} rounds, ${T.rounds} rounds back, Sam hit in ${T.hitRuns} of ${T.n} runs`);
}
if (import.meta.main) {
  const argv: string[] = ((globalThis as any).process?.argv ?? []).slice(2);
  if (argv[0] === 'tally') { const m = /^(\d+)-(\d+)$/.exec(argv[argv.indexOf('--seeds') + 1] ?? ''); await tally(argv[1] ?? 'round', m ? +m[1] : 1, m ? +m[2] : 8); (globalThis as any).process?.exit(0); }
  const arg = ((globalThis as any).process?.argv ?? []).slice(2).find((a: string) => !a.startsWith('--')) ?? 'all';
  const ok = await gunholdCheck(arg);
  console.log(ok ? '\n=== gunhold-check: ALL PASS ===' : '\n=== gunhold-check: FAILED ===');
  (globalThis as any).process?.exit(ok ? 0 : 1);
}
