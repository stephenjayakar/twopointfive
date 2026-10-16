// UNSEEN probes — `bun run tools/qa/unseen-probes.ts [follow|wall|hold|entry|idle|all] [arm]` (src/game/unseen.ts: a squad nobody has found sneaks when Sam sneaks).
// Each check stands a fresh loud squad mission up (the pair and the four, the office and the records room, hard), drives Sam by keys and reads what the
// teammates did: posture, pace, lights, the round held, the place on his wall — and that nothing moves when Sam never sneaks or the switch is off.
// Exit 1 on any FAIL.
import { ROOT } from './headless.ts';
import { Run } from './pairsneak.ts';
const U: any = await import(`${ROOT}/src/game/unseen.ts`);
const { FRIENDS } = (await import(`${ROOT}/src/game/friends.ts`)) as any;
const HF: any = await import(`${ROOT}/src/game/holdfire.ts`);
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
let fails = 0;
const check = (ok: boolean, what: string) => { console.log(`${ok ? '- PASS —' : '- FAIL —'} ${what}`); if (!ok) fails++; return ok; };
const reset = () => { Object.assign(U.UNSEEN, JSON.parse(JSON.stringify(U.UNSEEN_DEFAULTS))); for (const k of Object.keys(U.UNSEEN_STATS)) U.UNSEEN_STATS[k] = 0; U.UNSEEN_LOG.length = 0; };
async function stand(query: string, level?: string, set: Record<string, unknown> = {}): Promise<Run> {
  const R = await Run.start(query, 1, { hard: true, level }); R.stopOnNotice = false; R.cap = 600;
  HF.HOLDFIRE.on = false;   // (this file asks about the SNEAK's own hold: the unfound squad's hold, holdfire.ts, which the shipped stand raises, would hold the same rounds with UNSEEN.hold off)
  reset(); Object.assign(U.UNSEEN, { on: true }, set);   // (after the stand-up: the frozen stand holds the switch off — src/host/standup.ts)
  const why = R.g.orders.give('fallIn', { kind: 'none', at: [R.pos[0], 0, R.pos[2]] }); if (why) throw new Error(`fall in refused — ${why}`);
  R.wait(1); return R;
}
const living = (R: Run) => R.ops.filter((o: any) => o.state !== 'dead');
/** the longest clear run from Sam along the axes, and the way back */
function runway(R: Run): [number[], number[]] { const nav = R.g.col.nav, dirs = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];
  const clear = (d: number[]) => { let k = 0; for (; k < 20; k++) if (nav.isBlocked(R.pos[0] + d[0] * (k + 1) * 0.5, R.pos[2] + d[2] * (k + 1) * 0.5)) break; return k; };
  dirs.sort((a, b) => clear(b) - clear(a)); return [dirs[0], [-dirs[0][0], 0, -dirs[0][2]]]; }
interface Phase { live: number; low: number; vmax: number; lit: number; far: number; rounds: number; sam: number }
/** Sam walks `secs` along `dir` (null: stands); the teammates are measured after `settle` s */
function phase(R: Run, secs: number, dir: number[] | null, settle = 1): Phase {
  const g = R.g, from = [...R.pos]; R.goal = dir ? [from[0] + dir[0] * 40, 0, from[2] + dir[2] * 40] : null;
  let live = 0, low = 0, n = 0, f = 0, vmax = 0, lit = 0, far = 0, rounds = 0; let seen = g.events[g.events.length - 1] ?? null;
  for (let i = 0; i < secs * 60; i++) { R.step();
    const E = g.events, i0 = seen ? E.indexOf(seen) : -1; for (const e of E.slice(i0 + 1)) if (e.kind === 'guardShot' && R.ops.some((o: any) => o.char.id === e.who)) rounds++; seen = E[E.length - 1] ?? seen;
    if (i < settle * 60) continue; f++; if (U.unseenLive(g)) live++;
    for (const o of living(R)) { n++; if (o.char.anim.crouch > 0.5) low++; vmax = Math.max(vmax, Math.hypot(o.char.vel[0], o.char.vel[2])); if (o.flashlight?.enabled) lit++; far = Math.max(far, flat(o.char.pos, R.pos)); } }
  R.goal = null;
  return { live: live / Math.max(1, f), low: low / Math.max(1, n), vmax, lit: lit / Math.max(1, n), far, rounds, sam: flat(R.pos, from) / secs };
}
const pc = (x: number) => `${Math.round(x * 100)} %`;
const words = (P: Phase) => `sneaking ${pc(P.live)} of the time · teammates low ${pc(P.low)} · fastest ${P.vmax.toFixed(2)} m/s · lights on ${pc(P.lit)} · furthest ${P.far.toFixed(1)} m · Sam ${P.sam.toFixed(2)} m/s`;

// ─────────────────────────────── follow: posture, pace, lights, and back to the fight ───────────────────────────────
async function follow(tag: string, query: string, level?: string) {
  const R = await stand(query, level), g = R.g, [D, B] = runway(R), n = living(R).length;
  console.log(`\n== follow · ${tag} (${n} teammate${n === 1 ? '' : 's'}; ${R.hostiles.length} defenders, ${R.hostiles.filter((h: any) => h.state === 'patrol').length} unaware at the start) ==`);
  try {
    const up = phase(R, 3, D); console.log(`   upright: ${words(up)}`);
    check(up.live === 0 && up.low === 0, `${tag}: Sam walking upright at full pace — nobody sneaks, nobody crouches (as the build)`);
    R.crouch(true); const lo = phase(R, 4, B); console.log(`   crouched: ${words(lo)} · HUD '${g.orders.posture.word()}'`);
    check(lo.live === 1 && lo.low > 0.95, `${tag}: Sam crouched — every teammate goes low with him (${pc(lo.low)})`);
    check(lo.vmax <= U.UNSEEN.lowPace + 0.12, `${tag}: crouched teammates keep under ${U.UNSEEN.lowPace} m/s (fastest ${lo.vmax.toFixed(2)})`);
    check(lo.far < (n > 2 ? 7.5 : 4.5), `${tag}: they keep up (furthest ${lo.far.toFixed(1)} m)`);
    check(/sneaking/.test(g.orders.posture.word()), `${tag}: the squad line says so ('${g.orders.posture.word()}')`);
    R.crouch(false); R.wait(U.UNSEEN.linger + 1); const up2 = phase(R, 2, D); console.log(`   upright again: ${words(up2)}`);
    check(up2.live === 0 && up2.low === 0, `${tag}: Sam stands and walks on — they stand too after the linger`);
    R.pl.pace = 0.48; const wh = phase(R, 4, B, 1.5); console.log(`   pace wheel at 0.48: ${words(wh)}`);
    check(wh.live === 1 && wh.low === 0 && wh.vmax <= U.UNSEEN.cap + 0.12, `${tag}: Sam slow on the wheel, upright — they slow with him, upright (fastest ${wh.vmax.toFixed(2)})`);
    R.pl.pace = 1; R.crouch(true); R.wait(1.5);
    check(U.unseenLive(g), `${tag}: crouched again — sneaking again`);
    // (the question is what a shot does to the sneak, not where the file stands: on the shipped stand Sam's gun comes down off a teammate in his line —
    //  friends.ts — and this walk has turned him back on his own file, so that rule is held off for the one round)
    { const low = FRIENDS.lowReady; FRIENDS.lowReady = false;
      R.slot(2); R.cursor([R.pos[0] + D[0] * 5, 1.2, R.pos[2] + D[2] * 5]); R.I.buttons |= 1; R.I.clicked |= 1; R.step(3); R.I.buttons &= ~1; R.step(40); FRIENDS.lowReady = low; }
    const hot = phase(R, 3, D, 0.5); console.log(`   after Sam's shot, still crouched: ${words(hot)} · ${U.unseenSummary(g)}`);
    check(hot.live === 0 && hot.low < 0.05, `${tag}: a loud shot — compromised: they are up and fighting as the build (low ${pc(hot.low)})`);
  } catch (e: any) { check(false, `${tag}: the run stopped — ${e?.message ?? e}`); }
}

// ─────────────────────────────── wall: Sam's back on a wall — theirs too ───────────────────────────────
async function wall(tag: string, query: string, level?: string) {
  const R = await stand(query, level, process.env.UNSEEN_SET ? JSON.parse(process.env.UNSEEN_SET) : {}), g = R.g, pl = R.pl;
  console.log(`\n== wall · ${tag} ==`);
  try {
    // a wall face near where he stands: the free cells with a shut one beside them, nearest first — walk there, face it, Q — until one takes him
    const nav = g.col.nav, home = [...R.pos], C: { p: number[]; w: number[]; d: number }[] = []; let clean = true;
    const solid = (x: number, z: number, w: number[]) => g.col.solidBlocked([x, 1.2, z], [x + w[0] * 0.95, 1.2, z + w[2] * 0.95]);   // (a wall there, not the edge of the map — and near: a walk across the level is a walk into the defenders)
    // (widest clean run first; a span whose faces are all too far a walk, or take no hold, hands on to the next — a furnished room breaks its walls' long runs up)
    const tryFaces = () => { C.sort((a, b) => a.d - b.d);
      for (let i = 0, tries = 0; i < C.length && tries < 10 && !pl.wall; i += 3, tries++) { const c = C[i]; const path: number[][] | null = nav.findPath(R.pos, c.p); let len = 0; if (path) for (let k = 0, a = R.pos; k < path.length; a = path[k++]) len += flat(a, path[k]);
        if (!path || len > 14) { tries--; continue; }   // (the face of the room next door: 3 m off through the wall, a walk round through the defenders)
        if (!R.go(c.p, 25)) continue;
        R.goal = [R.pos[0] + c.w[0] * 2, 0, R.pos[2] + c.w[2] * 2]; R.step(20); R.goal = null;
        R.cursor([R.pos[0] + c.w[0] * 2, 1.1, R.pos[2] + c.w[2] * 2]); R.press('KeyQ'); R.step(40); if (process.env.UNSEEN_TRACE) console.log(`   try ${c.p} toward ${c.w}: ${pl.wall ? 'on' : g.messages[g.messages.length - 1]?.text} · Sam ${R.pos.map((x: number) => x.toFixed(1))}`); } };
    for (const span of [6, 4, 3]) { if (pl.wall) break; C.length = 0; for (let ix = -24; ix <= 24; ix++) for (let iz = -24; iz <= 24; iz++) { const x = Math.round(home[0] * 2) / 2 + ix * 0.5, z = Math.round(home[2] * 2) / 2 + iz * 0.5; if (nav.isBlocked(x, z)) continue;
      for (const w of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]) { let ok = true;   // (a clean run of face: 3 m of it either side at the widest, the floor along it open)
        for (let k = -span; k <= span && ok; k++) { const ax = x + w[2] * k * 0.5, az = z + w[0] * k * 0.5; ok = !nav.isBlocked(ax, az) && nav.isBlocked(ax + w[0] * 0.5, az + w[2] * 0.5) && !nav.isBlocked(ax - w[0] * 0.5, az - w[2] * 0.5); }
        if (ok && solid(x, z, w)) C.push({ p: [x, 0, z], w, d: flat([x, 0, z], home) }); } }
      if (process.env.UNSEEN_TRACE) console.log(`   faces with ${span * 0.5} m clear either side: ${C.length}`);
      tryFaces(); }
    if (!pl.wall) { clean = false; C.length = 0; for (let ix = -16; ix <= 16; ix++) for (let iz = -16; iz <= 16; iz++) { const x = Math.round(home[0] * 2) / 2 + ix * 0.5, z = Math.round(home[2] * 2) / 2 + iz * 0.5; if (nav.isBlocked(x, z)) continue;
      for (const w of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]) if (nav.isBlocked(x + w[0] * 0.5, z + w[2] * 0.5) && nav.isBlocked(x + w[0] * 0.5 + w[2] * 1, z + w[2] * 0.5 + w[0] * 1) && nav.isBlocked(x + w[0] * 0.5 - w[2] * 1, z + w[2] * 0.5 - w[0] * 1) && solid(x, z, w)) C.push({ p: [x, 0, z], w, d: flat([x, 0, z], home) }); }
      tryFaces(); }
    if (!check(!!pl.wall, `${tag}: Sam is on a wall (Q)`)) return;
    if (process.env.UNSEEN_TRACE) { const w = pl.wall, su = R.pos[0] * w.along[0] + R.pos[2] * w.along[2]; console.log(`   wall: along ${w.along.map((x: number) => x.toFixed(0))} n ${w.n.map((x: number) => x.toFixed(0))} · room lo ${(su - w.lo).toFixed(2)} hi ${(w.hi - su).toFixed(2)} · side ${w.side} · Sam ${R.pos.map((x: number) => x.toFixed(1))}`); }
    const w = pl.wall, off = (o: any) => o.char.pos[0] * w.n[0] + o.char.pos[2] * w.n[2] - w.d;
    let offAt = -1; for (let i = 0; i < 480; i++) { R.step(); if (process.env.UNSEEN_TRACE && i % 30 === 0) console.log(`   t${(i / 60).toFixed(1)} ` + living(R).map((o: any) => `${(o.char.pos[0] * w.along[0] + o.char.pos[2] * w.along[2] - (R.pos[0] * w.along[0] + R.pos[2] * w.along[2])).toFixed(2)}/${off(o).toFixed(2)}${o.char.anim.crouch > 0.5 ? 'L' : ''}`).join('  ')); if (!pl.wall && offAt < 0) { offAt = i / 60; console.log(`   (Sam came off the wall after ${offAt.toFixed(1)} s: '${g.messages[g.messages.length - 1]?.text ?? ''}' · he is ${R.pos.map((x: number) => x.toFixed(2))} · teammates ${living(R).map((o: any) => `${o.char.pos[0].toFixed(2)},${o.char.pos[2].toFixed(2)}`).join(' | ')})`); } }
    const P = phase(R, 1, null, 0), offs = living(R).map(off); P.live = offAt < 0 ? P.live : 0;
    console.log(`   on the wall: ${words(P)} · off the wall face ${offs.map((x: number) => x.toFixed(2)).join(', ')} m · places dealt ${U.UNSEEN_STATS.wallPlaces} · taken back by a door's lane ${U.UNSEEN_STATS.wallLost} · refused past Sam ${U.UNSEEN_STATS.wallPast}`);
    if (P.live < 1) console.log(`   (${U.unseenSummary(g)} · on the wall still: ${!!pl.wall} · Sam ${R.pos.map((x: number) => x.toFixed(1))} · wall lo ${w.lo.toFixed(1)} hi ${w.hi.toFixed(1)} · log ${JSON.stringify(U.UNSEEN_LOG.slice(-4))} · defenders ${R.hostiles.map((h: any) => `${h.state[0]}${h.awareness.toFixed(1)}`).join(' ')})`);
    const near = Math.min(9, ...offs.filter((x: number) => x > 0.2)); const tall = living(R).filter((o: any) => off(o) > 0.95 && o.char.anim.crouch < 0.5).length;
    check(offAt < 0 && P.live === 1, `${tag}: Sam stays on his wall while they come in (nobody shoves him off it), and that counts as sneaking`);
    // (the doors' own manners come first: with a doorway standing open at the end of that face, the place behind Sam is in its lane — orders.ts hands the place
    //  back, unseenWallLost — and the man is off the face on a knee instead. Seen on the shipped stand in the office's corridor, by the lobby arch.)
    // (and the rule's own 'never past Sam': on a short run of face — a furnished room's — the place is on the side with room, and a file standing on the other
    //  side of him is not walked past him to it: unseen.ts wallSlot counts the refusals, wallPast, and those men are on a knee where they are.)
    const past = U.UNSEEN_STATS.wallPast > 0 && U.UNSEEN_STATS.wallPlaces === 0;
    const laned = U.UNSEEN_STATS.wallLost > 0 && near >= 0.95, lows = living(R).filter((o: any) => o.char.anim.crouch > 0.5).length;
    if (clean && !laned && !past) check(U.UNSEEN_STATS.wallPlaces > 0 && near < 0.95, `${tag}: a teammate puts his back to the same wall (nearest ${near.toFixed(2)} m off the face)`);
    if (clean && past) check(lows === living(R).length, `${tag}: the place on that face is on the far side of Sam from where the file stands, so nobody is walked past him to it: every teammate is on a knee where he is (${lows} of ${living(R).length} low)`);
    if (clean && laned && !past) check(lows === living(R).length, `${tag}: the face behind Sam is in an open doorway's lane, so nobody is put on it: every teammate is off it on a knee (${lows} of ${living(R).length} low)`);
    check(tall === 0, `${tag}: nobody is left standing tall in the open beside him: on the wall, or on a knee (${tall} standing)`);
    check(P.vmax < 0.3, `${tag}: and they settle (fastest ${P.vmax.toFixed(2)} m/s in the last second)`);
  } catch (e: any) { check(false, `${tag}: the run stopped — ${e?.message ?? e} · at ${R.t.toFixed(1)} s · Sam ${R.pos.map((x: number) => x.toFixed(1))} · ${U.unseenSummary(g)} · defenders ${R.hostiles.map((h: any) => `${h.state[0]}${h.awareness.toFixed(1)}@${h.char.pos[0].toFixed(0)},${h.char.pos[2].toFixed(0)}`).join(' ')} · last words: ${g.messages.slice(-3).map((m: any) => m.text).join(' | ')}`); }
}

// ─────────────────────────────── hold: no round at a man who has noticed nothing ───────────────────────────────
/** the four (or the pair) sent to the break room's west doorway on its two men, who are kept unaware: Sam stays crouched in the aisle */
async function hold(tag: string, query: string, level?: string) {
  console.log(`\n== hold · ${tag} ==`);
  for (const on of [true, false]) {
    const R = await stand(query, level, { hold: on }), g = R.g, O = g.orders;
    try {
      R.crouch(true); R.wait(1.5);
      let frozen = true, rounds = 0, unseenRounds = 0, live = 0, f = 0; let seen = g.events[g.events.length - 1] ?? null;
      const run = (secs: number) => { for (let i = 0; i < secs * 60; i++) {
        if (frozen) for (const h of R.hostiles) if (h.state !== 'dead') { h.state = 'patrol'; h.awareness = 0; }
        const was = U.unseenLive(g); R.step(); f++; const is = U.unseenLive(g); if (is) live++;
        const E = g.events, i0 = seen ? E.indexOf(seen) : -1; for (const e of E.slice(i0 + 1)) if (e.kind === 'guardShot' && R.ops.some((o: any) => o.char.id === e.who)) { rounds++; if (was && is) unseenRounds++; } seen = E[E.length - 1] ?? seen; } };
      // sent (a MOVE: no door tool) to the break room's west doorway, the leaf stood open: the room's two men are in their sight from there
      const d = R.door('breakroom_w'), c = d.frameCentre, th = d.def.closedDir, nx = -Math.sin(th), nz = Math.cos(th), sd = (R.pos[0] - c[0]) * nx + (R.pos[2] - c[2]) * nz >= 0 ? 1 : -1;
      d.angle = (d.swing ?? 1) > 0 ? d.maxA : d.minA; d.latched = false; d.vel = 0; d.quietT = -3600;   // (the closer off: it stands)
      const why = O.give('move', { kind: 'floor', at: R.free([c[0] - nx * sd * 0.9, 0, c[2] - nz * sd * 0.9]) }); if (why) { check(false, `${tag}: the move was refused — ${why}`); continue; }
      run(25); const down = R.hostiles.filter((h: any) => h.state === 'dead').length;
      console.log(`   hold ${on ? 'ON' : 'OFF'}: ${rounds} rounds from the team in 25 s into a room of men who have noticed nothing · ${down} down · frames a round was held ${U.UNSEEN_STATS.held} · sneaking ${pc(live / f)}`);
      if (on) { check(unseenRounds === 0 && U.UNSEEN_STATS.held > 0, `${tag}: while sneaking, not one round at a man who has not noticed the team (${U.UNSEEN_STATS.held} frames held${rounds ? `; ${rounds} after a defender found them` : ''})`);
        frozen = false; for (const h of R.hostiles) if (h.state !== 'dead') { h.state = 'alert'; h.awareness = 1; } const r0 = rounds; run(12);
        console.log(`   they notice: ${rounds - r0} rounds from the team in 12 s · ${R.hostiles.filter((h: any) => h.state === 'dead').length} down · ${U.unseenSummary(g)}`);
        check(rounds > r0 && !U.unseenLive(g), `${tag}: the moment the defenders are on them the hold is over and they shoot (${rounds - r0} rounds)`);
        console.log(`   (sneaking ended: ${U.UNSEEN_LOG.filter((e: any) => e.what === 'off').map((e: any) => `${e.why} at ${e.t.toFixed(1)}`).join(', ') || 'never'})`);
      } else check(rounds > 0, `${tag}: with the hold switched off (?sneakfire) they shoot on sight while sneaking, as the build (${rounds} rounds)`);
    } catch (e: any) { check(false, `${tag}: the run stopped — ${e?.message ?? e}`); }
  }
}

// ─────────────────────────────── entry: a door order is not a creep ───────────────────────────────
/** Sam crouched, 'open and clear' on the break room's west door, its men kept unaware: the entry men are the door tool's — they shoot on sight, as the build */
async function entry(tag: string, query: string, level?: string) {
  console.log(`\n== entry · ${tag} ==`);
  const R = await stand(query, level), g = R.g, O = g.orders;
  try {
    R.crouch(true); R.wait(1.5); let rounds = 0; let seen = g.events[g.events.length - 1] ?? null;
    const why = O.give('openClear', O.targetAt(R.door('breakroom_w').frameCentre)); if (why) { check(false, `${tag}: the door order was refused — ${why}`); return; }
    for (let i = 0; i < 25 * 60; i++) { for (const h of R.hostiles) if (h.state !== 'dead') { h.state = 'patrol'; h.awareness = 0; } R.step();
      const E = g.events, i0 = seen ? E.indexOf(seen) : -1; for (const e of E.slice(i0 + 1)) if (e.kind === 'guardShot' && R.ops.some((o: any) => o.char.id === e.who)) rounds++; seen = E[E.length - 1] ?? seen; }
    const down = R.hostiles.filter((h: any) => h.state === 'dead').length;
    console.log(`   'open and clear' with Sam crouched: ${rounds} rounds from the team in 25 s · ${down} down · frames a round was held ${U.UNSEEN_STATS.held}`);
    check(rounds > 0 && down > 0 && U.UNSEEN_STATS.held === 0, `${tag}: an entry Sam orders is not held — the room is shot as the build shoots it (${rounds} rounds, ${down} down)`);
  } catch (e: any) { check(false, `${tag}: the run stopped — ${e?.message ?? e}`); }
}

// ─────────────────────────────── idle: Sam never sneaks, or the switch is off — the build as it was ───────────────────────────────
async function idle(tag: string, query: string, level?: string) {
  console.log(`\n== idle · ${tag} ==`);
  const walk = async (set: Record<string, unknown>, sneak: boolean) => { const R = await stand(query, level, set), [D, B] = runway(R);
    try { if (sneak) R.crouch(true); phase(R, 4, D); phase(R, 3, B); phase(R, 2, null); } catch { /* the digest so far */ } return { d: R.digest, spells: U.UNSEEN_STATS.spells }; };
  const a = await walk({}, false), b = await walk({ on: false }, false), c = await walk({ on: false }, true), d = await walk({}, true);
  check(a.d === b.d && a.spells === 0, `${tag}: Sam never sneaking — switch on and switch off digest the same (${a.d} · ${b.d})`);
  check(c.spells === 0 && c.d !== d.d && d.spells > 0, `${tag}: Sam crouched — switch off: no sneaking; switch on: a different run (${c.d} · ${d.d})`);
}

const ARMS: [string, string, string | undefined][] = [
  ['pair · office', 'roomclear=7&squad=1', undefined], ['four · office', 'roomclear=7&squad4', undefined],
  ['pair · records', 'roomclear=7&squad=1', 'records.json'], ['four · records', 'roomclear=7&squad4', 'records.json'],
];
const want = process.argv[2] ?? 'all', only = process.argv[3];
const CHECKS: Record<string, (tag: string, q: string, lv?: string) => Promise<void>> = { follow, wall, hold, entry, idle };
const wanted = (c: string, tag: string, lv?: string) => ((c !== 'hold' && c !== 'entry') || !lv) && (c !== 'idle' || tag === 'pair · office' || tag === 'four · records');   // (the break room is the office's; two arms of the identity are enough)
if (want === 'all') {   // every check in a process of its own: a game stood up after another in one process is not the game stood up first (module state the harness does not reset)
  const jobs = Object.keys(CHECKS).flatMap(c => ARMS.filter(([tag, , lv]) => (!only || tag.includes(only)) && wanted(c, tag, lv)).map(([tag]) => [c, tag]));
  const outs = await Promise.all(jobs.map(async ([c, tag], i) => { await new Promise(r => setTimeout(r, (i % 3) * 50)); const p = Bun.spawn(['bun', 'run', import.meta.path, c, tag], { stdout: 'pipe', stderr: 'pipe' }); const out = await new Response(p.stdout).text(); return { out, code: await p.exited }; }));
  for (const o of outs) { process.stdout.write(o.out.split('\n').filter(l => /^(==|- (PASS|FAIL)|   )/.test(l)).join('\n') + '\n'); fails += (o.out.match(/^- FAIL/gm) ?? []).length + (o.code !== 0 && !/^- FAIL/m.test(o.out) ? 1 : 0); }
} else {
  const run = CHECKS[want]; if (!run) { console.log(`unknown check '${want}' — one of: ${Object.keys(CHECKS).join(', ')}, all`); process.exit(2); }
  for (const [tag, q, lv] of ARMS) if ((!only || tag.includes(only)) && wanted(want, tag, lv)) await run(tag, q, lv);
}
console.log(fails ? `\n=== unseen-probes: ${fails} FAILED ===` : '\n=== unseen-probes: ALL PASS ===');
process.exit(fails ? 1 : 0);
