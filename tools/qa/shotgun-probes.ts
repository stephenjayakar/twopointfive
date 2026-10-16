// The 'shotgun' family (game/shotgun.ts — the M870 breaching shotgun: weapons.ts row 'm870', a shell = nine pellets through combat.ts fireWeapon; the lock rule;
// doortools.ts toGun / gunStep; kit.ts 'shotgun'), run through probes.ts:
//   bun run tools/qa/probes.ts shotgun | shotgun-range | shotgun-door | shotgun-card | shotgun-identity
// PASS / FAIL each, all headless. Nothing here looks at a picture: how the gun is drawn, the nine holes and their bursts, and what a shell sounds like are untested.
//   shotgun-range     THE CURVE: kill chance of ONE shell by range, standing man, 400 shells a range — the bore dead on his chest ('still'), and off a
//                     teammate's hands as the room fight fires it ('hands': aiSpread × the operative's spreadK). Near certain inside a room, poor down a
//                     corridor; the rule itself (any pellet inside dropM, `need` of one shell past it; fewer = peppered, standing) on a real man both ways
//   shotgun-door      a LOCKED door under the usual entry orders with the lead carrying one (his loadout card): open and clear and bang and clear — the lock
//                     shot off from beside the frame (the man OUTSIDE the opening, where the boot's spot is square in front of the leaf), the leaf in, the
//                     order going on as after the boot (the can, the entry), against the same seed with the boot; only the second man carrying one: he
//                     shoots it; SHOTGUN.on false: the boot; a steel door: refused in the same words, no shell spent; you: a shell at the latch opens it,
//                     one at the hinge side does not. WITH THE GLASS PARTS ON (GLASSPARTS=on, as the page ships) the manager's stack stands off its
//                     sidelight, on the hinge side (orders.ts behindGlass): the gun man then takes the lock from his own side of the frame — every check
//                     here holds either way, and 'never in the opening, never in front of a pane' is the one that was red before he did
//                     ONE ORDER TAKES THE DOOR in all of the above: the page's door rule (DOORTOOLS.testDoor — the order halts at a door found locked,
//                     the same row again takes it) is held off by rig() on every stand, and asked by its own rows: the halt, then the same row SHOOTS it
//   shotgun-card      the loadout card offers it — a teammate's Weapon row and your Guns row step to 'shotgun', a stored card keeps it, the card's words
//                     name it, staging hands that man the m870 row (and nobody else), yours rides in slot 2 with no ring launcher and comes off for a
//                     showcase; no order is on a digit above 5 and the door tools' page is the same four rows
//   shotgun-identity  NOBODY CARRIES ONE: twenty seconds of the room clear's manager door under open and clear digest to the frozen word — one word with the
//                     glass parts off (e6188f6, the build before this file), another with them on (c2ab777: glass's rule stands that stack elsewhere,
//                     so it is another run) — and nothing of shotgun.ts ran (its counters all nought). The words are the FROZEN stand's: on the page's
//                     stand (TPS_PROFILE=shipped) none is asked; on every stand the same run with SHOTGUN.on false must digest to the same word
import { standUp, ROOT } from './headless.ts';
const { WEAPONS } = await import(`${ROOT}/src/game/weapons.ts`);
const { SHOTGUN, SHOTGUN_STATS, SHOTGUN_LAST, breachSpot, lockPoint, pelletDrops } = await import(`${ROOT}/src/game/shotgun.ts`);
const { fireWeapon } = await import(`${ROOT}/src/game/combat.ts`);
const { KIT, KIT_MEMBERS, SLOTS, kitDefault, kitRows, kitSet, kitStep, kitSanitize, kitWords, kitGun, kitPlayer, kitShow } = await import(`${ROOT}/src/game/kit.ts`);
const { FIGHT_SKILL } = await import(`${ROOT}/src/game/roomfight.ts`);
const { ORDERS } = await import(`${ROOT}/src/game/orders.ts`);
const { DOORTOOLS } = await import(`${ROOT}/src/game/doortools.ts`);
const { harnessProfile } = await import(`${ROOT}/src/host/profile.ts`);
const { COVER } = await import(`${ROOT}/src/game/cover.ts`);
const { GLASSPEN, glassPenLive } = await import(`${ROOT}/src/game/glasspen.ts`);
const { GLASSFX } = await import(`${ROOT}/src/game/glass.ts`);
const { GUNWALL } = await import(`${ROOT}/src/game/gunwall.ts`);
/** glass's stack rule is live in this game (orders.ts behindGlass answers; off, every place is as the walls leave it) */
const glassRule = (g: any): boolean => glassPenLive(g) && GLASSPEN.stackEyes > 0;
const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
const hashStr = (s: string): number => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; };

const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x));
const pct = (x: number) => `${Math.round(x * 100)} %`;
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const SG_DEFAULTS = JSON.parse(JSON.stringify(SHOTGUN));
const zero = () => { for (const k of Object.keys(SHOTGUN_STATS)) SHOTGUN_STATS[k] = 0; };
/** every probe leaves the card table and this module's knobs as it found them, pass, fail or throw */
const guarded = (fn: () => Promise<boolean>) => async () => { const was = KIT.members.map((m: any) => ({ ...m })), on = KIT.on, rule = SLOTS.on, test = DOORTOOLS.testDoor; try { return await fn(); } finally { KIT.on = on; SLOTS.on = rule; DOORTOOLS.testDoor = test; was.forEach((m: any, i: number) => (KIT.members[i] = m)); Object.assign(SHOTGUN, JSON.parse(JSON.stringify(SG_DEFAULTS))); } };
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
/** a door's own axes: metres along hinge → latch, and out from the frame line on face `side` */
const along = (d: any, p: number[]) => { const th = d.def.closedDir; return (p[0] - d.def.hinge[0]) * Math.cos(th) + (p[2] - d.def.hinge[1]) * Math.sin(th); };
const off = (d: any, p: number[], side: number) => { const th = d.def.closedDir; return (-(p[0] - d.def.hinge[0]) * Math.sin(th) + (p[2] - d.def.hinge[1]) * Math.cos(th)) * side; };

// where Sam stands for a door (his side of it is the side the squad works it from): the corridor, off the line of the opening
const SAM: Record<string, number[]> = { manager: [24.0, 0, 11.2], stairwell: [7.5, 0, 17.6] };

/** One game under a seed with the room clear staged (the pair: NB.ops; `cards`: member → fields written on his loadout card BEFORE the staging, so the staging
 *  hands him his gun), Sam by `door`, in god mode and dark.
 *  ONE ORDER TAKES THE DOOR: every staging of this file was written to that — the row given, the stack made, the lock booted or shot. The page's stand has
 *  since put a rule in front of it (DOORTOOLS.testDoor, doortools.ts haltAt: the order HALTS at a door found locked — 'found shut' — and the same row given
 *  again takes it), under which every run here ended at the handle with nothing asked. So the switch is this file's own premise: OFF in every game stood
 *  here, whatever the stand, unless the staging asks for it (`test`: the rows that are about the halt). Written after the game is stood (the frozen stand
 *  pins the row at stand-up; it is read as the order runs, never at stand-up) and put back by guarded(). */
async function rig(seed: number, o: { door?: string; cards?: Record<number, Record<string, unknown>>; stage?: boolean; glass?: boolean; test?: boolean } = {}) {
  for (let i = 0; i < KIT_MEMBERS; i++) KIT.members[i] = { ...kitDefault(i), ...(o.cards?.[i] ?? {}) };
  SLOTS.on = false;   // (the free rows: a card written here is the gun and nothing given up for it — under the pouches rule the staging would fit it back inside his pouches: a teammate's shotgun would stay home, and yours would cost your launcher rounds; the runner puts the rule back after the probe)
  Math.random = seeded(seed);
  const W: any = await standUp(); const game = W.game, RC = game.roomClear, NB = game.nightBreach, O = game.orders, D = game.doorTools;
  DOORTOOLS.testDoor = !!o.test;
  game.godMode = true; if (o.glass) GLASSFX.on = GLASSPEN.on = true;   // (glass: rounds pass panes and the stack's rule answers in this game — run() puts both switches back)
  const why = o.stage === false ? null : RC.start(seed);
  const seen = new Set<any>();
  const R = { W, game, input: W.input, RC, NB, O, D, why, t0: 0, shots: [] as { t: number; who: number; pos: number[] }[], bangs: 0, kicks: 0,
    get ops(): any[] { return NB.ops; }, get hostiles(): any[] { return NB.hostiles; },
    step(n = 1) { for (let i = 0; i < n; i++) { game.player.visibility = 0.05; W.step(DT);
      for (const e of game.events) { if (seen.has(e)) continue; seen.add(e);
        if (e.kind === 'guardShot' || e.kind === 'shot') R.shots.push({ t: e.time, who: e.who, pos: [...e.pos] });
        if (e.kind === 'bang') R.bangs++; if (e.kind === 'kick') R.kicks++; } } },
    until(pred: () => boolean, secs: number) { for (let i = 0; i < secs * 60 && !pred(); i++) R.step(); return pred(); },
    door(name: string): any { return game.doors.list.find((d: any) => d.def.name === name); },
    give(id: string, name: string): string | null { return O.give(id, O.targetAt(R.door(name).frameCentre)); },
    get op(): any { return D.ops[0] ?? D.done[D.done.length - 1] ?? null; },
    beatT(op: any, what: string): number { const b = op?.beats.find((b: any) => b.what === what || b.what.startsWith(what)); return b ? b.t : NaN; },
    beats(op: any): string { return (op?.beats ?? []).map((b: any) => `${f2(b.t - R.t0)} ${b.what}`).join(' | '); },
  };
  R.step(30);
  if (o.door) { game.teleportPlayer(SAM[o.door]); R.step(5); }
  R.t0 = game.time;
  return R;
}

// ---------------------------------------------------------------- the curve
const RANGES = [2, 4, 6, 8, 10, 12, 15, 20, 25], SHELLS = 400;
export const shotgunRange = guarded(async () => {
  const { verdict, done } = family('shotgun-range: one shell\'s kill chance by range — near certain in a room, poor down a corridor — and the rule on a real man');
  const def = WEAPONS.m870, P = def.pellets;
  // the rule, on the booking itself: inside dropM the first pellet drops him; past it only the `need`-th of one shell
  { const mk = () => ({ def, i: 0, dir: null, men: new Map(), ends: [] }); const who = {} as any; const a = mk(), b = mk();
    const near = pelletDrops(a, who, P.dropM - 0.5, [1, 0, 0]); const far: boolean[] = []; for (let i = 0; i < P.need; i++) far.push(pelletDrops(b, who, P.dropM + 6, [1, 0, 0]));
    verdict(near && far.slice(0, -1).every(x => !x) && far[far.length - 1], `the rule: any one pellet inside ${P.dropM} m drops a man; past it the ${P.need}th of ONE shell does, fewer do not — a pattern, never a count kept on him`, `inside: ${near} · past, pellet by pellet: ${far.join(', ')}`); }
  // the lane: 27 m of clear floor at chest height, found
  Math.random = seeded(11);
  const W: any = await standUp(); const g = W.game; g.godMode = true; g.aiEnabled = false;
  const step = (n = 1) => { for (let i = 0; i < n; i++) { g.player.visibility = 0.05; W.step(DT); } };
  let lane: { x: number; z: number } | null = null;
  for (let z = 1; z < 28 && !lane; z += 0.25) for (let x = 0; x <= 10; x += 0.5) {   // (the office has no 27 m of clear floor indoors: this finds the lot along its south face)
    if (!g.col.nav.isBlocked(x + 0.5, z) && !g.col.nav.isBlocked(x + 26.5, z) && [0.4, 1.0, 1.6].every(y => [-0.45, 0, 0.45].every(dz => !g.col.solidBlocked([x, y, z + dz], [x + 27, y, z + dz])))) { lane = { x, z }; break; } }
  if (!lane) { verdict(false, 'a 27 m clear lane in the level', 'none found'); return done(); }
  const sam: number[] = [lane.x + 0.5, 0, lane.z]; g.teleportPlayer(sam); step(20);
  const chest = (): number[] => [g.player.char.pos[0], 1.25, g.player.char.pos[2]];
  const shooter = g.guards.find((x: any) => x.team === 'guard' && x.state !== 'dead'); const sc = shooter.char;
  const op = FIGHT_SKILL.operative, S = def.aiSpread;
  const rows: { r: number; still: number; hands: number; pel: number; pep: number }[] = [];
  for (const r of RANGES) {
    sc.pos[0] = sam[0] + r + 0.7; sc.pos[2] = lane.z; sc.bodyYaw = sc.aimYaw = Math.PI; shooter.hold = true; step(3);
    const out = { still: 0, hands: 0, pel: 0, pep: 0 };
    for (const mode of ['still', 'hands'] as const) for (let i = 0; i < SHELLS; i++) {
      sc.muzzle[0] = sam[0] + r; sc.muzzle[1] = 1.35; sc.muzzle[2] = lane.z;   // (the bore's mouth exactly r from his chest line: the pose the harness leaves a parked guard in is not the point)
      const was = { ...SHOTGUN_STATS };
      fireWeapon(g, sc, chest(), false, { weapon: def, steady: true, spread: mode === 'still' ? 0 : (S.base + Math.max(0, r - S.rangeFrom) * S.rangeK) * op.spreadK });
      out[mode] += SHOTGUN_STATS.dropped - was.dropped; if (mode === 'still') { out.pel += SHOTGUN_STATS.inMen - was.inMen; out.pep += SHOTGUN_STATS.peppered - was.peppered; }
      g.events.length = 0; g.player.hitFlash = 0;
      if (i % 40 === 39) step(1);
    }
    rows.push({ r, still: out.still / SHELLS, hands: out.hands / SHELLS, pel: out.pel / SHELLS, pep: out.pep / SHELLS });
  }
  console.log(`    range    drops him (bore on his chest)    drops him (a teammate's hands)    pellets in him    peppered, standing     [${SHELLS} shells a row; pattern ${(2 * P.cone).toFixed(2)} m wide per metre]`);
  for (const x of rows) console.log(`    ${String(x.r).padStart(3)} m    ${pct(x.still).padStart(6)}                           ${pct(x.hands).padStart(6)}                            ${f2(x.pel)} of ${P.n}         ${pct(x.pep).padStart(6)}`);
  const at = (r: number) => rows.find(x => x.r === r)!;
  verdict(RANGES.filter(r => r <= 6).every(r => at(r).still >= 0.99 && at(r).hands >= 0.97), 'ACROSS A ROOM (2 to 6 m) one shell drops a standing man: near certain, off the bench and off a teammate\'s hands', RANGES.filter(r => r <= 6).map(r => `${r} m ${pct(at(r).still)} / ${pct(at(r).hands)}`).join(' · '));
  verdict(at(20).still <= 0.4 && at(25).still <= 0.25 && at(20).hands <= 0.4 && at(25).hands <= 0.25, 'DOWN A CORRIDOR (20 m, 25 m) it is a poor bet: the pattern has opened past a man', `20 m ${pct(at(20).still)} / ${pct(at(20).hands)} · 25 m ${pct(at(25).still)} / ${pct(at(25).hands)}`);
  verdict(rows.every((x, i) => i === 0 || x.still <= rows[i - 1].still + 0.06), 'and it only falls with range (no row beats the one nearer by more than the dice)', rows.map(x => pct(x.still)).join(' → '));
  verdict(at(20).pep > 0.2, 'a man the pattern only caught the edge of is PEPPERED — counted, standing (launcher.ts staggerGuard for anybody but you)', `at 20 m ${pct(at(20).pep)} of shells pepper him without dropping him`);
  // on real men, through killGuard: a teammate's shell across a room; and a peppered man stands, doubled over
  { const R = await rig(5, { cards: { 1: { weapon: 'shotgun' } } }); const g2 = R.game; g2.aiEnabled = false; const o1 = R.ops[0], h = R.hostiles.find((x: any) => x.state !== 'dead');
    const place = (r: number) => { o1.char.pos[0] = sam[0] + r + 0.7; o1.char.pos[2] = lane!.z; h.char.pos[0] = sam[0]; h.char.pos[2] = lane!.z; R.step(4); o1.char.muzzle[0] = sam[0] + r; o1.char.muzzle[1] = 1.35; o1.char.muzzle[2] = lane!.z; };
    g2.teleportPlayer([sam[0] + 3, 0, lane.z > 14 ? lane.z - 3 : lane.z + 3]); o1.hold = true; h.hold = true;
    let pepperedAlive = false, tries = 0;
    for (; tries < 60 && !pepperedAlive && h.state !== 'dead'; tries++) { place(22); const was = SHOTGUN_STATS.peppered; fireWeapon(g2, o1.char, [h.char.pos[0], 1.25, h.char.pos[2]], false, { steady: true, spread: 0 }); pepperedAlive = SHOTGUN_STATS.peppered > was && h.state !== 'dead' && h.staggerUntil > g2.time; R.step(2); }
    const aliveFar = h.state !== 'dead'; const h2 = aliveFar ? h : R.hostiles.find((x: any) => x.state !== 'dead'); let nearDead = false, behind = { had: false, alive: false, inMen: 0, dropped: 0 };
    if (h2) { h2.hold = true; o1.char.pos[0] = sam[0] + 4.7; o1.char.pos[2] = lane.z; h2.char.pos[0] = sam[0]; h2.char.pos[2] = lane.z; R.step(4); o1.char.muzzle[0] = sam[0] + 4; o1.char.muzzle[1] = 1.35; o1.char.muzzle[2] = lane.z;
      // …with a second man standing a stride BEHIND him in the same line: the whole pattern is the front man's, to the last pellet
      const h3 = R.hostiles.find((x: any) => x.state !== 'dead' && x !== h2); if (h3) { h3.hold = true; h3.char.pos[0] = sam[0] - 1.2; h3.char.pos[2] = lane.z; R.step(2); o1.char.muzzle[0] = sam[0] + 4; o1.char.muzzle[1] = 1.35; o1.char.muzzle[2] = lane.z; }
      const in0 = SHOTGUN_STATS.inMen, dr0 = SHOTGUN_STATS.dropped;
      fireWeapon(g2, o1.char, [h2.char.pos[0], 1.25, h2.char.pos[2]], false, { steady: true, spread: 0 }); nearDead = h2.state === 'dead';
      behind = { had: !!h3, alive: !!h3 && h3.state !== 'dead', inMen: SHOTGUN_STATS.inMen - in0, dropped: SHOTGUN_STATS.dropped - dr0 }; }
    verdict(o1.weapon.def.id === 'm870' && nearDead, 'a real defender, a teammate\'s M870 at 4 m: one shell and he is down (combat.ts killGuard, like any round)', `gun ${o1.weapon.def.id} · down ${nearDead}`);
    verdict(!behind.had || (behind.alive && behind.dropped === 1 && behind.inMen === WEAPONS.m870.pellets.n), 'and the man a stride BEHIND him in the same line is untouched: the man it drops stops his whole pattern (he is settled once all nine have flown)', behind.had ? `behind him alive ${behind.alive} · ${behind.inMen} pellets booked on men, ${behind.dropped} dropped` : 'no third defender on this seed to stand behind him');
    verdict(pepperedAlive || !aliveFar, 'and at 22 m a shell that only peppers him leaves him standing, doubled over (staggerUntil) — or, the dice willing, a full pattern drops him', `peppered and standing ${pepperedAlive} after ${tries} shell(s) · ${aliveFar ? 'never dropped at 22 m' : 'dropped at 22 m by a full pattern'}`); }
  return done();
});

// ---------------------------------------------------------------- the lock
export const shotgunDoor = guarded(async () => {
  const { verdict, done } = family('shotgun-door: a locked door under open and clear / bang and clear with a breaching shotgun in the stack — and in your hands');
  const SEED = 8;   // (a seed on which the pair lives through the room behind the door either way: what the fight does after it is the room fight's dice, not this probe's)
  /** `knobs`: over SHOTGUN's defaults · `glass`: glass's rule live for this run whatever the stand-up · `sam`: you, stood here instead of the rig's place ·
   *  `test`: the page's door rule ON for this run (DOORTOOLS.testDoor — rig): the row is given, the order halts at the handle ('found shut'), and the SAME ROW
   *  is given again; everything measured below is then of that second order, and `halt` is what the first one left */
  const run = async (kind: 'openClear' | 'bangClear', cards: Record<number, Record<string, unknown>>, o: { knobs?: Record<string, unknown>; glass?: boolean; sam?: number[]; test?: boolean } = {}) => {
    Object.assign(SHOTGUN, JSON.parse(JSON.stringify(SG_DEFAULTS)), o.knobs ?? {}); zero();
    const sw = { fx: GLASSFX.on, pen: GLASSPEN.on }; try { return await ran(kind, cards, o); } finally { GLASSFX.on = sw.fx; GLASSPEN.on = sw.pen; }
  };
  const ran = async (kind: 'openClear' | 'bangClear', cards: Record<number, Record<string, unknown>>, o: { glass?: boolean; sam?: number[]; test?: boolean }) => {
    const R = await rig(SEED, { door: 'manager', cards, glass: o.glass, test: o.test }); if (o.sam) { R.game.teleportPlayer(o.sam); R.step(5); } const d = R.door('manager'); const side = R.game.doors.side(d, R.game.player.char.pos) as 1 | -1;
    const locked0 = d.locked && d.latched; let w = R.give(kind, 'manager'), op = R.op;
    let halt: { w: string | null; ended: string; beats: string; shells: number; kicks: number; shut: boolean; halted: number } | null = null;
    if (o.test) { R.until(() => !!op?.ended, 60); R.step(30);
      halt = { w, ended: String(op?.ended), beats: R.beats(op), shells: SHOTGUN_STATS.shells, kicks: R.kicks + R.D.stats.kicks, shut: d.latched && d.locked && !d.lockBroken, halted: R.D.stats.halted };
      w = R.give(kind, 'manager'); op = R.D.ops[0] ?? null; }
    // where the man who opens it stood when it gave, and how far the leaf's own sweep and the opening were from him
    let spot: { who: string; along: number; off: number; shells: number; mate: number; glazed: boolean } | null = null, inOpening = 0;   // (inOpening: frames the man on the lock spent in front of the leaf between 'stacked' and its going in)
    R.until(() => { const o = R.op;
      if (o && d.latched && !isNaN(R.beatT(o, 'stacked'))) { const by = o.kick?.gun?.by ?? o.lead, a = along(d, by.char.pos); if (a > 0.1 && a < d.def.width - 0.1) inOpening++; }
      if (!spot && o && !d.latched) { const by = o.kick?.gun?.by ?? o.lead; spot = { who: by.callsign, along: along(d, by.char.pos), off: off(d, by.char.pos, side), shells: SHOTGUN_STATS.shells, mate: Math.min(...R.ops.filter((x: any) => x !== by && x.state !== 'dead').map((x: any) => flat(x.char.pos, by.char.pos))), glazed: R.O.behindGlass(d, side, by.char.pos) }; } return !!o?.ended || (o && !isNaN(R.beatT(o, 'go'))); }, 60);
    R.step(60 * 4);
    const t = (what: string) => R.beatT(op, what) - R.t0;
    return { R, d, op, w, halt, locked0, inOpening, glass: glassRule(R.game), spot: spot as { who: string; along: number; off: number; shells: number; mate: number; glazed: boolean } | null, stacked: t('stacked'), shotT: t('shotgun'), kickT: t('kick'), goT: t('go'), tossT: t('toss'), W: d.def.width as number, stats: { ...SHOTGUN_STATS }, crossed: op ? [...op.crossed.keys()].length : 0 };
  };
  for (const kind of ['openClear', 'bangClear'] as const) {
    const boot = await run(kind, {}), gun = await run(kind, { 1: { weapon: 'shotgun' } });
    const lead = gun.R.ops[0];
    console.log(`    ${kind} · the boot:    ${boot.R.beats(boot.op)}\n    ${kind} · the shotgun: ${gun.R.beats(gun.op)}`);
    verdict(boot.locked0 && gun.locked0 && !gun.w && !isNaN(gun.shotT) && isNaN(gun.kickT) && gun.d.lockBroken && gun.spot?.shells === 1 && gun.stats.locks === 1 && gun.R.kicks === 1 && gun.R.D.stats.kicks === 0 && gun.R.D.stats.shot === 1,
      `${kind}, the lead carrying the M870 (his card): the locked manager's door is SHOT OPEN — one shell, the lock broken, the leaf in, no boot — and heard like the boot`, `lead ${lead.callsign} carries ${lead.weapon.def.id} · shotgun beat at ${f2(gun.shotT)} s, kick beat ${f2(gun.kickT)} · shells into the lock ${gun.spot?.shells}, locks ${gun.stats.locks} · 'kick' events ${gun.R.kicks} · door tools: shot ${gun.R.D.stats.shot}, kicks ${gun.R.D.stats.kicks}`);
    const pastLatch = !!gun.spot && gun.spot.along > gun.W + 0.05 && gun.spot.off > 0.6, pastHinge = !!gun.spot && gun.spot.along < -0.05 && gun.spot.off > 0.4;   // (past the hinge edge: on his own jamb mark, the stack's own stand-off from the wall)
    verdict(!!gun.spot && !!boot.spot && (pastLatch || (gun.glass && pastHinge)) && boot.spot.along < boot.W && boot.spot.along > 0,
      'FROM A SAFER SPOT: the man with the gun stands beside the frame and off the opening — past the latch edge, or (glass having stood his stack off a sidelight there) past the hinge edge; the boot is thrown from square in front of the leaf', `shotgun: ${gun.spot?.who} ${pastHinge ? `${f2(-(gun.spot?.along ?? NaN))} m PAST the hinge edge` : `${f2((gun.spot?.along ?? NaN) - gun.W)} m PAST the latch edge`}, ${f2(gun.spot?.off ?? NaN)} m off the wall · boot: ${boot.spot?.who} ${f2(boot.spot?.along ?? NaN)} m along a ${f2(boot.W)} m leaf, ${f2(boot.spot?.off ?? NaN)} m off it · glass's stack rule ${gun.glass ? 'live' : 'off'}`);
    verdict(!!gun.spot && gun.inOpening === 0 && !gun.spot.glazed,
      'NEVER IN THE OPENING, NEVER IN FRONT OF A PANE: from \'stacked\' to the leaf going in he does not cross in front of the leaf, and where he shoots from no round reaches him through glass from the room beyond', `frames in front of the leaf: gun ${gun.inOpening}, boot ${boot.inOpening} · his place behind glass: ${gun.spot?.glazed}${gun.glass ? '' : ' (the glass parts are off: no place is)'}`);
    verdict(gun.shotT - gun.stacked < boot.kickT - boot.stacked, 'FASTER AT THE LOCK: stacked → the leaf going in takes less time with the gun than with the boot (same seed, same door)', `shotgun ${f2(gun.shotT - gun.stacked)} s · boot ${f2(boot.kickT - boot.stacked)} s after 'stacked'`);
    verdict(!isNaN(gun.goT) && gun.crossed >= 1 && (kind === 'openClear' || (!isNaN(gun.tossT) && gun.tossT >= gun.shotT && gun.R.bangs >= 1)), `and the order goes on as after the boot${kind === 'bangClear' ? ': the can follows the shell, goes off, then' : ':'} 'go' and men over the frame line`, `go at ${f2(gun.goT)} s · crossed ${gun.crossed}${kind === 'bangClear' ? ` · toss at ${f2(gun.tossT)} s · bangs ${gun.R.bangs}` : ''} · boot's go at ${f2(boot.goT)} s`);
  }
  { const g2 = await run('openClear', { 2: { weapon: 'shotgun' } });
    verdict(!isNaN(g2.shotT) && isNaN(g2.kickT) && g2.spot?.who === g2.R.ops[1].callsign && g2.R.ops[1].weapon.def.id === 'm870' && g2.R.ops[0].weapon.def.id !== 'm870' && !isNaN(g2.goT) && (g2.spot?.mate ?? 0) >= 0.45,
      'only the SECOND man carries one: he takes the lock with it from a spot of his own (not from inside the lead, who keeps his rifle and his jamb), and the entry goes', `shot by ${g2.spot?.who}, ${f2(g2.spot?.mate ?? NaN)} m from the lead, ${(g2.spot?.along ?? NaN) < 0 ? `${f2(-(g2.spot?.along ?? NaN))} m past the hinge edge` : `${f2((g2.spot?.along ?? NaN) - g2.W)} m past the latch edge`}, ${f2(g2.spot?.off ?? NaN)} m off the wall, frames in front of the leaf ${g2.inOpening}, his place behind glass ${g2.spot?.glazed} (${g2.R.ops[1].callsign} has the ${g2.R.ops[1].weapon.def.id}, lead ${g2.R.ops[0].callsign} the ${g2.R.ops[0].weapon.def.id}) · ${g2.R.beats(g2.op)}`); }
  { const off = await run('openClear', { 1: { weapon: 'shotgun' } }, { knobs: { on: false } });
    verdict(isNaN(off.shotT) && !isNaN(off.kickT) && off.spot?.shells === 0 && off.stats.locks === 0 && off.d.lockBroken, 'SHOTGUN.on false: the same stack boots it, as before (no shell fired at the door)', `kick at ${f2(off.kickT)} s · shells before it opened ${off.spot?.shells} · locks ${off.stats.locks}`); }
  // THE PAGE'S DOOR RULE ON (DOORTOOLS.testDoor, doortools.ts haltAt — on in the page; held off for every staging above, which is one order taking the door:
  // rig). What a player does there: the row, the halt at the handle, the same row again — and with the gun in the stack that second order SHOOTS the lock.
  { const t = await run('openClear', { 1: { weapon: 'shotgun' } }, { test: true }), h = t.halt!;
    console.log(`    the door rule on · the row: ${h.beats}\n    the door rule on · the same row again: ${t.R.beats(t.op)}`);
    verdict(t.locked0 && !h.w && h.ended === 'found shut' && h.halted === 1 && h.shells === 0 && h.kicks === 0 && h.shut,
      'THE PAGE\'S DOOR RULE ON (DOORTOOLS.testDoor), the lead carrying the M870: open and clear HALTS at the locked manager\'s door — the handle tried, the order over \'found shut\', no shell and no boot spent on it, the lock whole', `given: ${h.w ?? 'taken'} · ended: ${h.ended} · halts ${h.halted} · shells ${h.shells} · kicks ${h.kicks} · still locked and latched ${h.shut}`);
    verdict(!t.w && !!t.op && !isNaN(t.shotT) && isNaN(t.kickT) && t.d.lockBroken && t.spot?.shells === 1 && t.stats.locks === 1 && t.R.D.stats.kicks === 0 && t.R.D.stats.shot === 1 && t.inOpening === 0 && !isNaN(t.goT) && t.crossed >= 1,
      '… and the SAME ROW given again takes it with the gun, not the boot: one shell, the lock broken, nobody in front of the leaf, and the entry goes', `given again: ${t.w ?? 'taken'} · shotgun beat at ${f2(t.shotT)} s, kick beat ${f2(t.kickT)} · shells into the lock ${t.spot?.shells}, locks ${t.stats.locks} · door tools: shot ${t.R.D.stats.shot}, kicks ${t.R.D.stats.kicks} · frames in front of the leaf ${t.inOpening} · go at ${f2(t.goT)} s, crossed ${t.crossed} · ended: ${t.op?.ended ?? 'still on'} · the pair: ${t.R.ops.map((x: any) => x.state).join(', ')}`); }
  // GLASS'S RULE LIVE at this door (orders.ts behindGlass — the sidelight by the latch jamb files both men on the hinge side, and every spot of the list is in
  // front of that pane): he shoots it from his own side. Turned on here by name, so the gate asks it whatever the stand-up; under GLASSPARTS=on the loop above has too.
  { const boot = await run('openClear', {}, { glass: true }), gun = await run('openClear', { 1: { weapon: 'shotgun' } }, { glass: true }), g2 = await run('openClear', { 2: { weapon: 'shotgun' } }, { glass: true });
    const hingeSide = (r: typeof gun) => !!r.spot && r.spot.along < -0.05 && r.spot.off > 0.4;
    verdict(gun.glass && !isNaN(gun.shotT) && isNaN(gun.kickT) && gun.spot?.shells === 1 && hingeSide(gun) && gun.inOpening === 0 && !gun.spot?.glazed && gun.shotT - gun.stacked < boot.kickT - boot.stacked,
      'GLASS ON, the lead carrying it: the lock is shot off from HIS OWN SIDE of the frame — past the hinge edge, never in front of the leaf, not in a line of fire through the sidelight — with one shell, and sooner after \'stacked\' than the boot',
      `glass's rule ${gun.glass ? 'live' : 'OFF'} · ${gun.spot?.who} ${f2(-(gun.spot?.along ?? NaN))} m past the hinge edge, ${f2(gun.spot?.off ?? NaN)} m off the wall · frames in front of the leaf ${gun.inOpening} (boot ${boot.inOpening}) · behind glass ${gun.spot?.glazed} · shotgun ${f2(gun.shotT - gun.stacked)} s, boot ${f2(boot.kickT - boot.stacked)} s after 'stacked' · shells ${gun.spot?.shells}`);
    verdict(g2.glass && !isNaN(g2.shotT) && isNaN(g2.kickT) && g2.spot?.who === g2.R.ops[1].callsign && hingeSide(g2) && g2.inOpening === 0 && !g2.spot?.glazed && (g2.spot?.mate ?? 0) >= 0.45,
      'GLASS ON, only the second man carrying it: the same — from the hinge side, out from behind the lead, never across the opening',
      `${g2.spot?.who} ${f2(-(g2.spot?.along ?? NaN))} m past the hinge edge, ${f2(g2.spot?.off ?? NaN)} m off the wall, ${f2(g2.spot?.mate ?? NaN)} m from the lead · frames in front of the leaf ${g2.inOpening} · behind glass ${g2.spot?.glazed} · ${f2(g2.shotT - g2.stacked)} s after 'stacked'`); }
  // SHOTGUN.ownSide (off as shipped): a man whose mark is on the hinge side takes the lock from that side with no glass in it at all
  // (you a stride further back than the other runs stand you: there you are ON his hinge-side spots, and he goes round you to the list's — the run above)
  { const BACK = [23.2, 0, 12.6]; const was = await run('openClear', { 2: { weapon: 'shotgun' } }, { sam: BACK }), own = await run('openClear', { 2: { weapon: 'shotgun' } }, { knobs: { ownSide: true }, sam: BACK });
    if (was.glass) console.log('    (SHOTGUN.ownSide: the glass parts are on in this stand-up, where he shoots from his own side already — asked with them off)');
    else verdict(!own.glass && !isNaN(own.shotT) && isNaN(own.kickT) && (own.spot?.along ?? 0) < -0.05 && own.inOpening === 0 && own.shotT - own.stacked < was.shotT - was.stacked && (own.spot?.mate ?? 0) >= 0.45,
      'SHOTGUN.ownSide on, the glass parts out of it: the second man (his mark on the hinge side) shoots the lock from that side — he no longer walks across the front of the leaf to the latch side, and the leaf is in sooner',
      `own side: ${f2(-(own.spot?.along ?? NaN))} m past the hinge edge, frames in front of the leaf ${own.inOpening}, ${f2(own.shotT - own.stacked)} s after 'stacked' · as shipped: frames in front of the leaf ${was.inOpening}, ${f2(was.shotT - was.stacked)} s`); }
  { Object.assign(SHOTGUN, JSON.parse(JSON.stringify(SG_DEFAULTS))); zero();
    const R = await rig(3, { door: 'stairwell', cards: { 1: { weapon: 'shotgun' } } }); const d = R.door('stairwell'); const w = R.give('openClear', 'stairwell'); R.until(() => !!R.op?.ended, 40);
    verdict(!!d.def.steel && d.latched && !d.lockBroken && SHOTGUN_STATS.shells === 0 && (!!w || /steel/.test(R.op?.ended ?? '')), 'a STEEL door locked against them: refused as before, no shell spent on it', `give: ${w} · ended: ${R.op?.ended} · shells ${SHOTGUN_STATS.shells} · latched ${d.latched}`);
    // (the page's door rule on: the menu does not read a lock for them — the row is taken, the handle tried, and the refusal is the same row's the second time)
    zero(); const T = await rig(3, { door: 'stairwell', cards: { 1: { weapon: 'shotgun' } }, test: true }); const d2 = T.door('stairwell'); const w1 = T.give('openClear', 'stairwell'); T.until(() => !!T.op?.ended, 40); const e1 = T.op?.ended; T.step(30); const w2 = T.give('openClear', 'stairwell'); T.step(120);
    verdict(!!d2.def.steel && !w1 && e1 === 'found shut' && !!w2 && /steel/.test(w2) && d2.latched && !d2.lockBroken && SHOTGUN_STATS.shells === 0 && T.kicks === 0, 'the page\'s door rule on, the same steel door: the order halts at the handle, the same row again is refused as steel — no shell and no boot either time', `given: ${w1 ?? 'taken'} · ended: ${e1} · given again: ${w2} · shells ${SHOTGUN_STATS.shells} · kicks ${T.kicks} · latched ${d2.latched}`); }
  // where the man with the gun would stand at every lock of the level (shotgun.ts breachSpot): beside the frame wherever the wall leaves room
  { const R = await rig(3, {}); const g = R.game; const rows: string[] = []; let beside = 0, front = 0, none = 0;
    for (const d of g.doors.list) { if (!d.def.locked || d.def.steel) continue; for (const side of [1, -1] as const) { const sp = breachSpot(g, d, side), lp = lockPoint(d, side);
      if (!sp) none++; else if (sp.beside) beside++; else front++;
      rows.push(`${d.def.name} face ${side > 0 ? '+' : '−'}: ${sp ? `${sp.beside ? 'beside the frame' : 'in front of the leaf'}, ${f2(flat(sp.pos, lp))} m from the lock` : 'no spot → the boot'}`); } }
    console.log(`    ${rows.join('\n    ')}`);
    verdict(beside >= 1 && beside >= front, 'the spot is beside the frame at most faces of the level\'s locked doors (in front of the leaf, or the boot, only where a wall or furniture leaves no room)', `beside ${beside} · in front ${front} · none ${none}`); }
  // you: slot 2, the muzzle by the lock
  { Object.assign(SHOTGUN, JSON.parse(JSON.stringify(SG_DEFAULTS))); zero();
    const R = await rig(7, { stage: false }); const d = R.door('storage');   // (the plain night: the storage room's door stands locked and latched)
    const side = 1 as const, th = d.def.closedDir, H = d.def.hinge, Wd = d.def.width; const pt = (a: number, b: number): number[] => [H[0] + Math.cos(th) * a - Math.sin(th) * side * b, 0, H[1] + Math.sin(th) * a + Math.cos(th) * side * b];
    const P = pt;   // (the corridor face: +z of the manager's frame line)
    // fresh doors for the three cases: at the latch from a stride, at the hinge side from a stride, at the latch from across the corridor
    const fresh = async () => { zero(); const Q = await rig(7, { stage: false, cards: { 0: { weapon: 'shotgun' } } }); kitPlayer(Q.game); return Q; };
    const one = async (from: [number, number], at: [number, number], unlocked = false, aimY = 1.0) => { const Q = await fresh(); const g3 = Q.game, dd = Q.door('storage'); g3.aiEnabled = false; if (!dd.latched || !dd.locked) throw new Error('storage door not locked and latched'); if (unlocked) dd.locked = false;
      const f = P(from[0], from[1]), q = P(at[0], at[1]), pl = g3.player;
      g3.teleportPlayer(f); Q.step(30); Q.input.pressed.add('Digit2'); Q.step(40);
      // his aim put ON the point the way a showcase puts it (Game.puppet.aim: the page's cursor works through the camera, and its reticle snaps to the lamp over
      // this door) — then the left button, through player.ts's own rifle path
      g3.puppet = { goal: null, aim: [q[0], aimY, q[2]] }; Q.step(40);
      if (g3.aimTarget || g3.aimGuard) throw new Error('the reticle snapped to something by the door');
      const muz = off(dd, pl.char.muzzle, 1), gun = along(dd, pl.char.muzzle); Q.input.clicked |= 1; Q.step(1); g3.puppet = null; Q.step(20);
      const inLeaf = SHOTGUN_LAST.ends.filter((e: any) => e.index >= 1e6), alongs = inLeaf.map((e: any) => along(dd, e.at));
      return { open: !dd.latched && dd.lockBroken, flung: !dd.latched, shells: SHOTGUN_STATS.shells, locks: SHOTGUN_STATS.locks, muz, gun, kicks: Q.kicks, leaf: inLeaf.length, lo: Math.min(...alongs), hi: Math.max(...alongs) }; };
    const latch = await one([Wd - 0.25, 1.5], [Wd - 0.25, 0]), hinge = await one([0.25, 1.5], [0.25, 0]), across = await one([Wd - 0.25, 2.1], [Wd - 0.25, 0]), pressed = await one([Wd - 0.5, 0.42], [Wd - 0.5, 0]), shut = await one([Wd - 0.25, 1.5], [Wd - 0.25, 0], true);
    verdict(latch.open && latch.shells === 1 && latch.locks === 1 && latch.kicks === 1, 'YOUR shell into the latch edge from a stride off: the lock is gone, the leaf goes in, and it carries like the boot', `opened ${latch.open} · shells ${latch.shells} · 'kick' events ${latch.kicks} · muzzle ${f2(latch.muz)} m off the leaf · ${latch.leaf} pellets in the leaf, ${f2(latch.lo)} to ${f2(latch.hi)} m along a ${f2(Wd)} m leaf`);
    verdict(!hinge.open && hinge.shells === 1 && hinge.locks === 0, 'into the HINGE side of the same leaf: nine holes, the lock holds', `opened ${hinge.open} · shells ${hinge.shells} · locks ${hinge.locks}`);
    // (the guns' wall rule — src/game/gunwall.ts, as the page has it — brings a gun that close down, EXCEPT this one on a lock: a breach shot at a lock always fires)
    verdict(pressed.open && pressed.shells === 1 && pressed.locks === 1, 'with the muzzle PRESSED to the lock (close enough that the gun pokes through the leaf): it goes the same', `opened ${pressed.open} · shells ${pressed.shells} · muzzle ${f2(pressed.muz)} m off the leaf (negative: through it) · ${pressed.leaf} pellets booked in the leaf`);
    if (GUNWALL.on) {   // the exemption is the LOCK's: the same gun pressed to the hinge side of that leaf, or to a leaf that is only shut, is down like any gun at a wall
      // (THE GUN'S LINE, not his feet: pressed to a leaf the gun lies some 0.3 m to the latch side of where he stands, and gunwall.ts breachAim asks the gun's
      //  own line. On a 0.86 m leaf — the doors at real size — the lock's band is everything past 0.36 m from the hinge, so a man stood a quarter metre along
      //  it, as this row once stood him on a 1.16 m leaf, has his gun 0.54 m along: ON the lock, and that shell goes, by the rule. He is stood
      //  with the gun's line a hand from the hinge edge instead — his feet just past it — and the row holds where the gun lay.)
      const band = Wd - WEAPONS.m870.pellets.breach.latchM, pHinge = await one([-0.14, 0.42], [-0.14, 0]), pShut = await one([Wd - 0.5, 0.42], [Wd - 0.5, 0], true);
      verdict(pHinge.gun > 0.02 && pHinge.gun < band - 0.05 && pHinge.shells === 0 && !pHinge.flung && pShut.gun > band && pShut.gun < Wd && pShut.shells === 0 && !pShut.flung, 'pressed to the HINGE side of the locked leaf (the gun laid short of the lock\'s band), and pressed to the lock\'s own place on a leaf that is only shut: the gun is down and no shell is fired', `hinge side: the gun ${f2(pHinge.gun)} m along a ${f2(Wd)} m leaf (the lock's band starts at ${f2(band)}), shells ${pHinge.shells}, flung ${pHinge.flung} · only shut: the gun ${f2(pShut.gun)} m along, shells ${pShut.shells}, flung ${pShut.flung}`);
      for (const aimY of [1.0, 1.3, 0]) for (const back of aimY === 1.0 ? [0.45, 0.5, 0.55, 0.6, 0.8, 1.2] : [0.42, 0.5, 0.6, 0.9]) {   // (aimed at the lock a metre up, which pitches the gun down from close in · at the gun's own height = level, as the page's cursor on the floor keeps it · at the leaf's foot, steeper still)
        const r = await one([Wd - 0.35, back], [Wd - 0.35, 0], false, aimY); verdict(r.open && r.shells === 1 && r.locks === 1, `from ${back} m off the leaf at the lock, ${aimY === 1.3 ? 'the gun level' : aimY ? 'aimed at it' : "aimed at the leaf's foot"}: one shell, the lock is gone`, `opened ${r.open} · shells ${r.shells} · locks ${r.locks} · muzzle ${f2(r.muz)} m off the leaf`); }
    }
    verdict(!shut.flung && shut.shells === 1 && shut.locks === 0, 'the same shell into the latch edge of a leaf that is only SHUT, not locked: nothing is flung (it takes a lock; a stray pattern does not open rooms)', `flung ${shut.flung} · shells ${shut.shells} · locks ${shut.locks}`);
    console.log(`    (from as far back as the corridor lets you stand, the muzzle ${f2(across.muz)} m off the leaf: opened ${across.open} — the rule's reach is ${WEAPONS.m870.pellets.breach.reachM} m of muzzle, and this corridor is too narrow to stand outside it)`);
  }
  return done();
});

// ---------------------------------------------------------------- the card
export const shotgunCard = guarded(async () => {
  const { verdict, done } = family('shotgun-card: the loadout card offers it, staging hands it over, yours rides in slot 2 — and the menus are as they were');
  for (let i = 0; i < KIT_MEMBERS; i++) KIT.members[i] = kitDefault(i);
  SLOTS.on = false;   // (the free rows: this probe holds the row itself; that the shotgun's shells take a pouch is the 'pouches' family's — guarded() puts the rule back)
  const mate = kitRows(1).find((r: any) => r.field === 'weapon'), you = kitRows(0).find((r: any) => r.field === 'weapon');
  const stepped: string[] = []; for (let k = 0; k < 3; k++) stepped.push(String(kitStep(1, 'weapon', 1)));
  verdict(mate.values.includes('shotgun') && you.values.includes('shotgun') && stepped.includes('shotgun') && stepped[2] === 'rifle', 'a teammate\'s Weapon row and your Guns row both offer the shotgun; A / D step onto it and round again', `teammate: ${mate.values.join(' / ')} · you: ${you.values.join(' / ')} · stepping from rifle: ${stepped.join(' → ')}`);
  kitSet(1, 'weapon', 'shotgun'); kitSet(0, 'weapon', 'shotgun');
  const words1 = kitWords(1), words0 = kitWords(0), kept = kitSanitize(2, JSON.parse(JSON.stringify({ ...kitDefault(2), weapon: 'shotgun' }))), junk = kitSanitize(2, { weapon: 'bazooka' });
  verdict(kitGun(KIT.members[1]) === 'm870' && /M870/.test(words1) && /M870/.test(words0) && kept.weapon === 'shotgun' && junk.weapon === 'rifle' && /lock/.test(mate.note(KIT.members[1])) && WEAPONS.m870.enabled && !WEAPONS.m870.suppressed && WEAPONS.m870.report.level >= 1 && WEAPONS.m870.report.loud,
    'the card names it, says what it changes, a stored card keeps it (and a junk value falls back to the rifle); the row is LOUD: unsuppressed, a full report', `"${words1}" · "${words0}" · note: "${mate.note(KIT.members[1])}" · stored → ${kept.weapon}, junk → ${junk.weapon} · report level ${WEAPONS.m870.report.level}`);
  kitSet(0, 'weapon', 'rifle');
  { const R = await rig(4, { door: 'manager', cards: { 2: { weapon: 'shotgun' } } }); const [a, b] = R.ops;
    verdict(b.weapon.def.id === 'm870' && b.route.weapon === 'm870' && a.weapon.def.id !== 'm870' && R.game.player.rifle.def.id === 'fn2000' && b.weapon.roundsReady === 7,
      'staging hands the man whose card says shotgun the m870 row — him alone; everybody else, and you, as issued', `${a.callsign}: ${a.weapon.def.id} · ${b.callsign}: ${b.weapon.def.id} (${b.weapon.roundsReady} shells up) · you: ${R.game.player.rifle.def.id}`);
    R.step(120); verdict(b.weapon.def.id === 'm870' && b.state !== 'dead', 'and it is still his two seconds on (the row is dealt off his route every frame)', `${b.callsign}: ${b.weapon.def.id}`);
    // the menus: X on a door — rows as they were, nothing on a digit above 5
    const d = R.door('manager'); R.W.cursorAt(d.frameCentre); R.input.pressed.add(ORDERS.key); R.step(); for (let i = 0; i < 24; i++) { R.W.cursorAt(d.frameCentre); R.step(); }
    const M = R.O.menu; const ids = M ? M.rows.map((r: any) => r.id).join(' ') : ''; const keys1 = (M?.rows ?? []).map((r: any) => Number(r.key)); const opener = M?.rows.find((r: any) => r.opens); let tools = '';
    if (opener) { R.input.pressed.add(`Digit${opener.key}`); R.step(); R.step(4); tools = R.O.menu ? R.O.menu.rows.map((r: any) => r.id).join(' ') : ''; }
    const keys = [...keys1, ...(R.O.menu?.rows ?? []).map((r: any) => Number(r.key))].filter(Number.isFinite);
    R.input.pressed.add('Escape'); R.step(); R.input.pressed.add('Escape'); R.step();
    // (row 4 of the tools page is the stand's: the threshold's own page, or — DOORTOOLS.outsidePlain, on in the page, read as the menu is registered — the one order 'clear from outside')
    const row4 = DOORTOOLS.outsidePlain ? 'thresholdHold' : 'thr';
    verdict(ids === 'stack cover fallIn hold tools' && tools === `openClear bangClear charge ${row4} fragClear` && keys.every(k => k <= 5), 'the door\'s order menu and its tools page are the same rows with a shotgun in the stack (the tools page ends in the frag part\'s own row, on G) — no row of the shotgun\'s, no digit above 5', `rows: ${ids} ▸ ${tools} · highest digit ${Math.max(0, ...keys)}`); }
  { const R = await rig(4, { stage: false, cards: { 0: { weapon: 'shotgun' } } }); const g = R.game, pl = g.player, was = pl.rifle, worn = was.def.id === 'm870'; kitPlayer(g);   // (`worn`: the page's stand stands a plain game up as the solo night, your card already on you — kit.ts kitSoloStand; the frozen stand leaves it to the kitPlayer here)
    const got = pl.rifle.def.id, att = pl.rifle.attachments.length, slot2 = pl.hasRifle, shells = pl.rifle.roundsReady;
    R.input.pressed.add('Digit2'); R.step(40); const up = pl.rifleUp, name = pl.gunInHand()?.def.id; R.input.pressed.add('Digit2'); R.step(3); const noRing = pl.rifle.attachment === null;
    const carried = pl.rifle; kitShow(g);
    verdict(got === 'm870' && att === 0 && slot2 && up && name === 'm870' && noRing && shells === 7 && pl.rifle.def.id === 'fn2000' && pl.rifle !== carried && (worn ? carried === was : pl.rifle === was),
      'YOURS: the M870 in the rifle\'s place — slot 2 (the same digit, nothing above 5), seven shells, no ring launcher; a showcase gets the FN2000 back', `card on: ${got}, ${shells} shells, attachments ${att}, in the hands on 2: ${up} (${name}) · 2 again: attachment ${noRing ? 'none' : 'RING'} · after kitShow: ${pl.rifle.def.id}${worn ? ' (the stand had the card on him already)' : ', the very rifle he was built with'}`); }
  return done();
});

// ---------------------------------------------------------------- nobody carries one
/** the digest folded every half second over `secs` of the room clear's manager door under open and clear (seed 3), nobody's card touched, and which of the
 *  harness's two glass stand-ups the game is (`mix`: neither — a part switched by hand) — tools/qa/shotgun-probes.ts --identity prints both for whatever tree
 *  and environment it runs in */
export async function identityWord(secs = 20): Promise<{ word: string; glass: 'on' | 'off' | 'mix' }> {
  const R = await rig(3, { door: 'manager' }); R.give('openClear', 'manager'); let word = '0';
  for (let f = 1; f <= secs * 60; f++) { R.step(); if (f % 30 === 0) word = hashStr(word + hashDigest(digestGame(R.game, true))).toString(16); }
  const T = R.game.tune, parts = GLASSFX.on && T.glassBreak !== false;   // (under the master switch off nothing of glass runs, whatever its rows say)
  return { word, glass: glassRule(R.game) && parts && T.glassShards !== false ? 'on' : !glassPenLive(R.game) && !parts ? 'off' : 'mix' };
}
/** TWO WORDS, because they are two runs: with the glass parts off (the harness's stand-up) the pair splits on the manager's jambs and the word is e6188f6's, the
 *  build before the gun; with them on (GLASSPARTS=on: the page as shipped) glass's rule files both men on the hinge side, off the sidelight, and the same twenty
 *  seconds are a different entry — its word is c2ab777's, the one build with glass in and the gun not yet (the same on 0ee0094, glass and gear both in). */
/** RE-FROZEN 10-14 on 297c0667. The first words (off 1217e864 = e6188f6's, on e8635080 = c2ab777's) stood until the doors became real size (7a0e39c3: every
 *  level file exported again with 0.86 m leaves — level data, which no stand holds off): d546af02, its parent, still reads 1217e864, and from it on the glass-off
 *  word is 42535089. The words below are taken with COVER.backKeep held off, as this probe now holds it: that switch (81ef0af8) is on in the module with no row
 *  in FROZEN_HOLDS, and with it on the frozen stand reads 60731ea6 / 2a2baaea. The glass-on word's movers were not bisected; the last row (the gun's switch off:
 *  the same word) is what says the gun changes nothing on this tree. */
const IDENTITY = { off: '42535089', on: 'c96c0542' };
export const shotgunIdentity = guarded(async () => {
  const { verdict, done } = family('shotgun-identity: with nobody carrying one, a run is the run it was');
  const bk = COVER.backKeep; if (harnessProfile() === 'frozen') COVER.backKeep = false;   // (a newer rule the frozen words were not taken under — put back below)
  try {
  zero(); const { word, glass } = await identityWord();
  // (THE FROZEN WORDS ARE THE FROZEN STAND'S: both were taken on it, and the page's stand — TPS_PROFILE=shipped — plays every newer rule that stand holds off (src/host/profile.ts FROZEN_HOLDS);
  //  asked there the row was red by construction and said nothing of the gun. That stand gets the next row alone.)
  if (harnessProfile() !== 'frozen') console.log(`    (the page's stand: no word was frozen on it — now ${word}, glass parts ${glass}; asked against the same run with the gun switched off, below)`);
  else if (glass === 'mix') console.log(`    (a glass part switched by hand: neither frozen word is this run's — now ${word})`);
  else verdict(word === IDENTITY[glass], `twenty seconds of open and clear on the locked manager's door (seed 3, every card as issued) digest to the frozen word — ${glass === 'on' ? 'the glass parts ON (GLASSPARTS=on: the stack off the sidelight)' : 'the glass parts off'} — re-frozen 10-14 after the doors became real size`, `now ${word} · frozen ${IDENTITY[glass]}`);
  verdict(Object.values(SHOTGUN_STATS).every(n => n === 0), 'and nothing of shotgun.ts ran: no shell, no pellet, no lock', JSON.stringify(SHOTGUN_STATS));
  // … and on whatever stand and tree this is: the same twenty seconds with the gun's rule switched off are the same run, word for word (no frozen word needed —
  // a word that has moved under this row with this one still green was moved by something else than the gun)
  { SHOTGUN.on = false; const off = await identityWord(); SHOTGUN.on = SG_DEFAULTS.on;
    verdict(off.word === word && off.glass === glass, 'SHOTGUN.on false, the same twenty seconds: the same word — with nobody carrying one the switch changes nothing of the run', `on ${word} · off ${off.word}`); }
  } finally { COVER.backKeep = bk; }
  return done();
});

if (import.meta.main && process.argv.includes('--identity')) { const { word, glass } = await identityWord(); console.log(`${word} (glass parts ${glass})`); process.exit(0); }
