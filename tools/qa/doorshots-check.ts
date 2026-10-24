// ROUNDS THROUGH A DOORWAY KEEP HIS GUN ON IT (ROOMFIGHT.doorShots; ?doorshots=0; TPS_DOORSHOTS=1 raises it on the frozen stand).
// The maintainer, on a replay of his four stacked on a door an enemy had opened: "enemy was immediately in front of them and shooting, nothing happened". The man firing stood behind the far
// jamb where three of the four had no line to him; one of them looked at the doorway for the door's own few seconds and then turned his back to it with the rounds still coming.
// Staged: the office, four men told to stack on the server-room door, every defender but one put down, that one stood by hand behind the far jamb where nobody outside has a line to him. He
// opens the door (his hand, from inside), the look a door gets is waited out, he is stood where the open leaf and the wall leave nobody a line, and then fires a round every half second out
// through the opening, past every man, for five seconds.
//   (1) the stand says what it holds: the page has the rule, the frozen stand does not;
//   (2) rule off: with the rounds coming, nobody's look is on that doorway and a man with a line to it has his gun well off it (the build as it was);
//   (3) rule on: every man with a line to the doorway and nobody in his sight (on the page's stand a jamb man leaning has the shooter in sight: he is not asked) is looking at it within a second of the first round and still is at the last, his gun on it, and a man who was turned away is turned away again after;
//   (4) rule on, the door shut: nobody is turned (no round comes through a shut leaf: the rule's own open-leaf test is not what this line reaches);
//   (5) rule on, the reach set shorter than where he stands from the frame: nobody is turned (the number is read); and his rounds sent into his own room instead: nobody is turned
//       (no round came through the doorway);
//   (6) off, nothing reads its number: the same run with the reach moved, every gun where it was;
//   (7) a recording from before the key replays with it off; one that carries it keeps it; ?doorshots=0 puts it off.
//
//   bun run tools/qa/doorshots-check.ts            (both stands; also `probes.ts door-shots`, family roomfight)
//   DOORSHOTS_BREAK=1 …                            (the rule's own body left out, the same lines asked: must fail)
// What it cannot say: one door, one room, the shooter stood and fired by hand and blind himself, nobody hit; whether a gun on the doorway wins the exchange when he steps into it is the fight's
// dice and is not asked here. His rounds are fired by hand with his own hands' spread: one may clip the frame. Not staged: a shooter on the men's own side of the wall, a hold's arc, a man walking to a door order, a gun an order has on another door, two doorways, two
// shooters, a room next door. Never seen on a GPU, nobody has played it.
import { standUp, ROOT } from './headless.ts';
import { guarded, family } from './thresholdmenu-probes.ts';
const { ROOMFIGHT } = (await import(`${ROOT}/src/game/roomfight.ts`)) as any;
const { NIGHTBREACH } = (await import(`${ROOT}/src/game/nightbreach.ts`)) as any;
const { killGuard, fireWeapon } = (await import(`${ROOT}/src/game/combat.ts`)) as any;
const PROFILE: any = await import(`${ROOT}/src/host/profile.ts`), { FROZEN_HOLDS } = PROFILE;
const JOURNAL: any = await import(`${ROOT}/src/game/journal.ts`);
const { knobsCopy, knobsBack } = (await import(`${ROOT}/src/game/knobs.ts`)) as any;

const DT = 1 / 60, SEEDS = (process.env.DOORSHOTS_SEEDS ?? '3').split(',').map(Number), DOOR = 'server', QUIET_S = 5, FIRE_S = 5, EVERY = 30, DEG = Math.PI / 180;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
async function quiet<T>(fn: () => T | Promise<T>): Promise<T> { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } }
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

interface Man { who: string; line: boolean; off0: number; first: number; last: number; held: number; asked: number; worst: number; after: boolean; back: number; tgt: number }
interface Run { stood: boolean | null; why: string; men: Man[]; looks: number; yaws: number[]; hit: number; seen: number; foeUp: boolean; g: any }

/** the office stood up, the four on the server door, one defender behind its far jamb: he opens it (unless `shut`), waits, fires `FIRE_S` seconds into his own room */
async function play(SEED: number, on: boolean, o: { shut?: boolean; reach?: number; away?: boolean } = {}): Promise<Run> {
  const R: Run = { stood: null, why: '', men: [], looks: 0, yaws: [], hit: 0, seen: 0, foeUp: false, g: null };
  Math.random = seeded(0x51ab + SEED * 7919); Object.assign(NIGHTBREACH, { squad: 4 }); ROOMFIGHT.doorShotM = 8;
  const W: any = await quiet(() => standUp({ uploadEvery: 4 })), g = W.game, NB = g.nightBreach, O = g.orders; R.g = g;
  R.stood = !!ROOMFIGHT.doorShots; ROOMFIGHT.doorShots = on; if (o.reach !== undefined) ROOMFIGHT.doorShotM = o.reach;
  g.godMode = true; await quiet(() => g.roomClear.start(SEED));
  const d = g.doors.list.find((x: any) => x.def.name === DOOR); if (!d) { R.why = `no door ${DOOR}`; return R; }
  const foes: any[] = NB.hostiles.filter((h: any) => h.state !== 'dead'), h = foes[0]; if (!h) { R.why = 'no defender'; return R; }
  for (const x of foes) if (x !== h) killGuard(g, x, [0, 0, 1], false);
  const ops = (): any[] => NB.ops.filter((m: any) => m.state !== 'dead');
  let spot: number[] | null = null, held: number | null = null;   // (held: the leaf kept where it swung to — on the frozen stand a leaf a defender's hand opened swings to again)
  const step = (n = 1) => { for (let i = 0; i < n; i++) { g.player.visibility = 0.05; h.dazzledUntil = g.time + 5; const p = spot ?? [37.5, 0, 1]; h.char.pos[0] = p[0]; h.char.pos[2] = p[2]; h.char.vel[0] = h.char.vel[2] = 0; if (held !== null) { d.angle = held; d.vel = 0; d.closing = false; d.latched = false; } W.step(DT); } };
  await quiet(() => { step(30); O.give('stack', O.targetAt(d.frameCentre)); for (let i = 0; i < 60 * 70 && !ops().every((m: any) => O.of(m)?.order === 'stack' && O.of(m).arrived); i++) step(); step(120); });
  if (!ops().every((m: any) => O.of(m)?.order === 'stack' && O.of(m).arrived) || ops().length < 4) { R.why = `the stack never formed (${ops().map((m: any) => `${m.callsign} ${O.of(m)?.order ?? '—'}${O.of(m)?.arrived ? ' there' : ''}`).join(', ')})`; return R; }
  // the far side of that wall, and a place behind its jamb nobody outside has a line to
  const fc = d.frameCentre, th = d.def.closedDir, n = [-Math.sin(th), Math.cos(th)], u = [Math.cos(th), Math.sin(th)];
  const side = Math.sign(ops().reduce((s: number, m: any) => s + (m.char.pos[0] - fc[0]) * n[0] + (m.char.pos[2] - fc[2]) * n[1], 0)) || 1, far = -side;
  const eye = (m: any) => [m.char.pos[0], 1.55, m.char.pos[2]];
  const hidden = (p: number[], deep: number) => Math.hypot(p[0] - fc[0], p[2] - fc[2]) <= 2.6 && !g.col.segmentBlocked([p[0], 1.1, p[2]], [fc[0] + n[0] * far * deep, 1.1, fc[2] + n[1] * far * deep]) && ops().every((m: any) => g.col.segmentBlocked(eye(m), [p[0], 1.1, p[2]]) && g.col.segmentBlocked(eye(m), [p[0], 1.6, p[2]]));
  // the door opened from inside by his hand (he is not stood there yet), the look a door gets waited out, THEN his place chosen with the leaf where it came to rest
  await quiet(() => { step(2); if (!o.shut) { g.doors.use(d, [fc[0] + n[0] * far * 0.6, 0, fc[2] + n[1] * far * 0.6], h.char.id); let wide = 0; for (let i = 0; i < 90; i++) { step(); if (Math.abs(d.angle) > Math.abs(wide)) wide = d.angle; } if (Math.abs(wide) > 0.3) held = wide; }
    step(QUIET_S * 60); });
  if (!o.shut && (d.latched || Math.abs(d.angle) < 0.3)) { R.why = `the door did not open (angle ${d.angle.toFixed(2)})`; return R; }
  for (const deep of [0.8, 0.6, 1.1, 1.4]) for (const s of [1, -1]) for (const k of [0.5, 0.8, 1.1, 1.4]) { const p = [fc[0] + u[0] * s * (d.def.width / 2 + k) + n[0] * far * deep, 0, fc[2] + u[1] * s * (d.def.width / 2 + k) + n[1] * far * deep]; if (!spot && hidden(p, deep)) spot = p; }
  if (!spot) { R.why = 'no place behind the far jamb is out of every line'; return R; }
  await quiet(() => step(30));
  // where his rounds go: out through the opening, past every man (or, `away`, into his own room)
  const into = [spot[0] + n[0] * far * 4, 1.2, spot[2] + n[1] * far * 4]; let out: number[] | null = null;
  const off2 = (q: number[], a: number[], b: number[]) => { const dx = b[0] - a[0], dz = b[2] - a[2], t = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[2] - a[2]) * dz) / (dx * dx + dz * dz))); return Math.hypot(q[0] - a[0] - dx * t, q[2] - a[2] - dz * t); };
  for (const clear of [0.45, 0.3]) for (const D of [3, 4.5, 2.2]) for (const L of [0, -0.4, 0.4, -0.8, 0.8, -1.2, 1.2, -1.6, 1.6, -2, 2, -2.6, 2.6]) { if (out) break; const t = [fc[0] + n[0] * side * D + u[0] * L, 1.4, fc[2] + n[1] * side * D + u[1] * L];
    const sa = (spot[0] - fc[0]) * n[0] + (spot[2] - fc[2]) * n[1], sb = (t[0] - fc[0]) * n[0] + (t[2] - fc[2]) * n[1], k = sa / (sa - sb), cx = spot[0] + (t[0] - spot[0]) * k, cz = spot[2] + (t[2] - spot[2]) * k;
    if (Math.abs((cx - fc[0]) * u[0] + (cz - fc[2]) * u[1]) > d.def.width / 2 - 0.2) continue;
    const end = [spot[0] + (t[0] - spot[0]) * 4, 0, spot[2] + (t[2] - spot[2]) * 4]; if ([...ops().map((m: any) => m.char.pos), g.player.char.pos].some((q: number[]) => off2(q, spot!, end) < clear)) continue;
    t[1] = 1.4 + 0.45 / k; out = t; }   // (through the opening at head height and climbing: under the lintel, over the men outside)
  if (!out && !o.shut) { R.why = 'no line out through the opening passes every man'; return R; }
  const aim = o.away || !out ? into : out;
  const pt = (m: any): number[] => { const p = m.char.pos, near = Math.hypot(p[0] - fc[0], p[2] - fc[2]), k = 0.35 / near; return [fc[0] + (p[0] - fc[0]) * k, 1.1, fc[2] + (p[2] - fc[2]) * k]; };
  const lineTo = (m: any) => !g.col.segmentBlocked(eye(m), pt(m));
  const off = (m: any) => { const a = pt(m), p = m.char.pos; return Math.abs(wrap(Math.atan2(a[0] - p[0], a[2] - p[2]) - m.char.aimYaw)) / DEG; };   // (a yaw is measured from +z)
  const looking = (m: any) => g.fight.ops.find((X: any) => X.gd === m)?.turn?.door === d && g.fight.ops.find((X: any) => X.gd === m).turn.until > g.time;
  const men = ops(), M: Man[] = men.map((m: any) => ({ who: m.callsign, line: lineTo(m), off0: off(m), first: NaN, last: NaN, held: 0, asked: 0, worst: 0, after: false, back: NaN, tgt: 0 })); R.men = M;
  const t0 = g.time;
  await quiet(() => {
    for (let f = 0; f < FIRE_S * 60; f++) {
      if (f % EVERY === 0) fireWeapon(g, h.char, aim, false, { spread: 0 });
      step();
      men.forEach((m: any, i: number) => { const L = looking(m), t = g.time - t0; if (g.fight.ops.find((X: any) => X.gd === m)?.tgt === h) { M[i].tgt++; R.seen++; } if (L) { R.looks++; if (isNaN(M[i].first)) M[i].first = t; M[i].last = t; }
        if (t >= 1.5) { M[i].asked++; if (L) M[i].held++; M[i].worst = Math.max(M[i].worst, off(m)); } });
      if (f % 20 === 0) for (const m of men) R.yaws.push(Math.round(m.char.aimYaw * 1e4));
    }
    step(Math.round((ROOMFIGHT.doorLookSecs + 1.5) * 60)); men.forEach((m: any, i: number) => { M[i].after = !looking(m); M[i].back = off(m); });
  });
  R.foeUp = h.state !== 'dead'; R.hit = men.filter((m: any) => m.state === 'dead' || (m.staggerUntil ?? 0) > t0).length;
  return R;
}
const show = (R: Run) => R.why || R.men.map(m => `${m.who}${m.line ? '' : ' (no line)'}${m.tgt ? ` (has him in sight ${m.tgt} steps: not asked)` : ''} ${m.off0.toFixed(0)}° off it before · ${isNaN(m.first) ? 'never looks' : `looks ${m.first.toFixed(2)}–${m.last.toFixed(2)} s, ${m.held}/${m.asked}`} · at most ${m.worst.toFixed(0)}° off under fire · ${m.back.toFixed(0)}° off it after`).join(' | ') + (R.hit ? ` · ${R.hit} of them HIT` : '') + (R.foeUp ? '' : ' · he is DOWN');

export const doorShotsCheck = guarded(async () => {
  const F = family('door-shots: rounds through a doorway keep his gun on it');
  const knobs0 = knobsCopy(), rnd0 = Math.random;
  try {
    const off: Run[] = [], on: Run[] = []; for (const s of SEEDS) { off.push(await play(s, false)); on.push(await play(s, true)); }
    const say = (A: Run[]) => A.map((R, i) => `seed ${SEEDS[i]}: ${show(R)}`).join(' ‖ ');
    { const shipped = process.env.TPS_PROFILE === 'shipped', env = process.env.TPS_DOORSHOTS, want = env !== undefined ? env === '1' : shipped, row = FROZEN_HOLDS['ROOMFIGHT.doorShots'];
      F.verdict(off[0].stood === want && row === 'TPS_DOORSHOTS=1', `the stand: ${want ? 'on, as the page opens' : 'held off, as every frozen tally was recorded'}; FROZEN_HOLDS carries the row and its word`, `after the stand-up: ${off[0].stood} · TPS_DOORSHOTS ${env ?? 'unset'} · TPS_PROFILE ${process.env.TPS_PROFILE ?? 'unset'} · row ${row ?? 'MISSING'}`); }
    F.verdict(off.every(R => !R.why && R.looks === 0 && R.hit === 0 && R.foeUp && R.men.some(m => m.line && !m.tgt && m.worst > 60)), 'rule off: with the rounds coming nobody\'s look is on that doorway, and a man with a line to it has his gun well off it', say(off));
    F.verdict(on.every(R => !R.why && R.hit === 0 && R.foeUp && R.men.filter(m => m.line && !m.tgt).length >= 2 && R.men.some(m => m.line && !m.tgt && m.off0 > 60) && R.men.filter(m => m.line && !m.tgt).every(m => m.first <= 1 && m.held === m.asked && m.worst <= 25 && m.after && (m.off0 <= 60 || m.back > 40))),
      'rule on: every man with a line to the doorway and nobody in his sight (one who was turned away among them) looks at it inside a second of the first round and to the last, his gun on it, and a man who was turned away is turned away again after', say(on));
    { const R = await play(SEEDS[0], true, { shut: true });
      F.verdict(!R.why && R.looks === 0 && R.men.some(m => m.line), 'rule on, the door shut: nobody is turned, with the doorway still in their lines (no round comes through a shut leaf)', show(R)); }
    { const R = await play(SEEDS[0], true, { reach: 0.4 });
      F.verdict(!R.why && R.looks === 0, 'rule on, the reach set shorter than where he stands from the frame: nobody is turned (the number is read)', show(R)); }
    { const R = await play(SEEDS[0], true, { away: true });
      F.verdict(!R.why && R.looks === 0, 'rule on, his rounds sent into his own room: nobody is turned (no round came through the doorway)', show(R)); }
    { const R = await play(SEEDS[0], false, { reach: 2 }), same = R.yaws.length === off[0].yaws.length && R.yaws.every((y, i) => y === off[0].yaws[i]);
      F.verdict(!R.why && same && R.looks === 0, 'off, nothing reads its number: the same run with the reach moved, every gun where it was', `${R.yaws.length} gun readings, ${same ? 'all the same' : 'DIFFERENT'}`); }
    { const g = on[0].g, snap = () => JSON.parse(JSON.stringify(JOURNAL.knobsSnapshot(g)));
      ROOMFIGHT.doorShots = true; const old = snap(); delete old.tables.ROOMFIGHT.doorShots; JOURNAL.applyKnobs(g, old); const without = ROOMFIGHT.doorShots;
      ROOMFIGHT.doorShots = true; const own = snap(); ROOMFIGHT.doorShots = false; JOURNAL.applyKnobs(g, own); const withIt = ROOMFIGHT.doorShots;
      PROFILE.pageSwitches(new URLSearchParams('')); const a = ROOMFIGHT.doorShots; PROFILE.pageSwitches(new URLSearchParams('doorshots=0')); const b = ROOMFIGHT.doorShots;
      F.verdict(without === false && withIt === true && a === true && b === false, 'a recording from before the key replays with the rule off (journal.ts applyKnobs), one that carries it keeps it; the page opens with it on and ?doorshots=0 puts it off', `applyKnobs with no key → ${without} · with it on → ${withIt} · '' → ${a} · 'doorshots=0' → ${b}`); }
  } finally { knobsBack(knobs0); Math.random = rnd0; }
  return F.done();
});

if (import.meta.main) process.exit((await doorShotsCheck()) ? 0 : 1);
