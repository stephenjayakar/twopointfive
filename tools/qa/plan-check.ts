// THE SQUAD'S PLAN DRAWN ON THE FLOOR (src/game/floorplan.ts → src/ui/planfloor.ts): what the overlay is handed, checked without a picture.
//   bun run tools/qa/plan-check.ts            (also `probes.ts plan`)
//   TPS_PROFILE=shipped bun run tools/qa/plan-check.ts      — the same lines on the page's stand
// PASS / FAIL each, all headless: the room clear on the office with its squad of four, the defenders left alive on the floor (the plan must list none of
// them). What is checked is `floorPlan(g)`: who is listed, the way from each man's feet to his mark, the mark, the fan, the menu's rings, the switch —
// and that asking for the plan every frame leaves the run's digest where it was.
// PLAN_BREAK=1 = the switch left off and the same lines asked: they must fail.   exit 0 = all hold · 1 = one does not
import { standUp, ROOT } from './headless.ts';

const FP: any = await import(`${ROOT}/src/game/floorplan.ts`);
const { NIGHTBREACH } = await import(`${ROOT}/src/game/nightbreach.ts`);
const { digestGame } = await import(`${ROOT}/src/game/digest.ts`);
const { PLAN, floorPlan, planTag } = FP;

const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : '—');
const len = (p: number[][]) => { let s = 0; for (let i = 1; i < p.length; i++) s += dist(p[i - 1], p[i]); return s; };
const BREAK = process.env.PLAN_BREAK === '1';

async function rig(seed: number, ask: boolean, squad = 4) {
  const squad0 = NIGHTBREACH.squad; Object.assign(NIGHTBREACH, { squad });
  Math.random = seeded(seed);
  const W: any = await standUp(); const game = W.game, O = game.orders;
  PLAN.on = !BREAK; PLAN.menuOnly = false;   // (lines 1‥10 ask the plan as it is drawn with the menu up; 11‥16 run under the page's own `menuOnly`; 17 is the rule itself)
  game.godMode = true;
  const why = game.roomClear.start(seed);
  Object.assign(NIGHTBREACH, { squad: squad0 });
  const R = { W, game, O, why, asked: 0,
    get team(): any[] { return O.squad(); },
    step(n = 1) { for (let i = 0; i < n; i++) { game.player.visibility = 0.05; W.step(DT); if (ask) { floorPlan(game); R.asked++; } } },
    until(pred: () => boolean, secs: number) { for (let i = 0; i < secs * 60 && !pred(); i++) R.step(); return pred(); },
  };
  R.step(30);
  for (const m of R.team) m.god = true;
  return R;
}
/** a spot of floor the menu takes, a walk of 7‥18 m from Sam */
function farFloor(R: any): number[] | null {
  const g = R.game, s = g.player.char.pos; let best: number[] | null = null, bd = 1e9;
  for (let dx = -16; dx <= 16; dx += 1) for (let dz = -16; dz <= 16; dz += 1) {
    const p = [s[0] + dx + 0.25, 0, s[2] + dz + 0.25], d = Math.hypot(dx, dz); if (d < 7 || d > 14) continue;
    const t = R.O.targetAt(p); if (t.kind !== 'floor' || dist(t.at, p) > 0.3) continue;
    const path = g.col.nav.findPath(s, p, 4000); if (!path) continue; const L = len([s, ...path]); if (L < 7 || L > 18) continue;
    if (Math.abs(L - 11) < bd) { bd = Math.abs(L - 11); best = p; }
  }
  return best;
}

let fails = 0, menuOnly0 = true;   // (the page's own `PLAN.menuOnly`, put back after the lines that turn it)
const line = (ok: boolean, name: string, detail: string) => { if (!ok) fails++; console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`); };

export async function planCheck(): Promise<boolean> {
  fails = 0;
  menuOnly0 = PLAN.menuOnly;
  try { return await planLines(); } finally { PLAN.menuOnly = menuOnly0; }
}
async function planLines(): Promise<boolean> {
  console.log(`plan-check: the squad's plan drawn on the floor${BREAK ? '  (PLAN_BREAK: the switch left off — these must fail)' : ''}`);
  // 0. the tag
  line(planTag('Red Two') === 'R2' && planTag('Blue One') === 'B1' && planTag('Kestrel') === 'K' && planTag('') === '', 'tags', `'Red Two' → ${planTag('Red Two')} · 'Blue One' → ${planTag('Blue One')} · 'Kestrel' → ${planTag('Kestrel')}`);

  const R = await rig(3, false), g = R.game, O = R.O, team = R.team;
  const hostiles = g.guards.filter((x: any) => x.team === 'hostile' && x.state !== 'dead').length;
  line(!R.why && team.length === 4 && hostiles > 0, 'staged', `room clear, ${team.length} teammates, ${hostiles} defenders alive${R.why ? ` · refused: ${R.why}` : ''}`);

  // 1. a move order: every man listed with a way from his feet to his mark
  const spot = farFloor(R);
  const why = spot ? O.give('move', O.targetAt(spot), 'all') : 'no floor found';
  R.step(2);
  {
    const P = floorPlan(g), men: any[] = P.men;
    const ok = men.length === 4 && men.every(m => m.path.length >= 2 && dist(m.path[0], m.gd.char.pos) < 0.15 && dist(m.path[m.path.length - 1], m.mark) < 0.06 && dist(m.mark, spot!) < 4 && !m.there && !m.held);
    line(!why && ok, 'a move order lists every man with his way', `${why ? `refused: ${why}` : men.map(m => `${m.tag} ${f1(len(m.path))} m in ${m.path.length} pts`).join(' · ')}`);
    const straight = men.every(m => len(m.path) >= dist(m.gd.char.pos, m.mark) - 0.01 && len(m.path) < 3 * Math.max(4, dist(m.gd.char.pos, m.mark)) + 12);
    const finite = men.every(m => m.path.every((q: number[]) => q.every(Number.isFinite)));
    const up = (q: number[]) => [q[0], 0.6, q[2]];
    const walls = men.reduce((n, m) => n + m.path.slice(1).filter((q: number[], i: number) => g.col.solidBlocked(up(m.path[i]), up(q))).length, 0);
    line(men.length > 0 && straight && finite && walls === 0, 'each way is a real walk, through no wall', `${men.map(m => `${m.tag}: ${f1(len(m.path))} m for ${f1(dist(m.gd.char.pos, m.mark))} m straight`).join(' · ')} · ${walls} legs through something solid`);
    const tags = new Set(men.map(m => m.tag)), tones = men.map(m => m.tone);
    line(tags.size === 4 && tones.filter(t => t === 'red').length === 2 && tones.filter(t => t === 'blue').length === 2, 'who: a tag a man, a colour a pair', men.map(m => `${m.tag}:${m.tone}`).join(' '));
    line(men.length > 0 && men.every(m => m.age < 0.5 && m.aim !== null), 'a fresh order is young, and says what he will watch', men.map(m => `${m.tag} age ${m.age.toFixed(2)} aim ${m.aim === null ? '—' : m.aim.toFixed(2)}`).join(' · '));
    // only our own men
    const own = new Set(team);
    line(men.length > 0 && men.every(m => own.has(m.gd) && m.gd.team === 'operative') && P.who.every((q: any) => own.has(q.gd)), 'our own men only', `${men.length} listed, ${hostiles} defenders on the floor, none of them in the plan`);
  }
  // 2. the way follows his own nav path once he walks it, and shortens
  {
    const before = (floorPlan(g).men as any[]).map(m => len(m.path));
    R.step(90);
    const P = floorPlan(g), men: any[] = P.men, after = men.map(m => len(m.path));
    const walking = men.filter(m => m.path.length >= 2);
    const shorter = walking.length > 0 && walking.every(m => { const i = men.indexOf(m); return after[i] < before[i] + 0.05; }) && after.reduce((a, b) => a + b, 0) < before.reduce((a, b) => a + b, 0) - 2;
    const onOwn = walking.filter(m => m.gd.pathGoal && m.gd.pathI < m.gd.path.length).length;
    line(shorter && onOwn > 0 && walking.every(m => dist(m.path[0], m.gd.char.pos) < 0.15), 'the way shortens from his feet as he walks, on his own nav path', `before ${before.map(f1).join(' ')} m · 1.5 s on ${after.map(f1).join(' ')} m · ${onOwn} of ${walking.length} on their own nav path`);
  }
  // 3. on their marks: no way, the mark under him, the fan along his gun
  {
    const got = R.until(() => (floorPlan(g).men as any[]).length === 4 && (floorPlan(g).men as any[]).every(m => m.there || BREAK), 40);
    R.step(30);
    const men: any[] = floorPlan(g).men;
    const ok = got && men.length === 4 && men.every(m => m.there && m.path.length === 0 && dist(m.mark, m.gd.char.pos) < 1.2 && m.aim !== null && Math.abs(m.aim - m.gd.char.aimYaw) < 1e-9);
    line(ok, 'standing: the mark and his gun\'s fan stay, the way is gone', men.map(m => `${m.tag} ${f1(dist(m.mark, m.gd.char.pos))} m off his mark`).join(' · ') || 'nobody listed');
  }
  // 4. the fight has a man: his mark alone
  {
    const m0 = team[0], A = O.of(m0), y0 = A?.yieldT;
    if (A) A.yieldT = g.time;
    const pm = (floorPlan(g).men as any[]).find(m => m.gd === m0);
    if (A) A.yieldT = y0;
    line(!!pm && pm.held && !pm.there && pm.path.length === 0 && pm.aim === null, 'a man the fight has: his mark alone', pm ? `${pm.tag} held ${pm.held} way ${pm.path.length} aim ${pm.aim}` : 'not listed');
  }
  // 4b. nothing of an enemy: a mark taken from a man the team cannot see is not listed; a watch on a sensed place is never drawn; the fight's point dims
  {
    const m0 = team[0], A = O.of(m0), foe = g.guards.find((x: any) => x.team === 'hostile' && x.state !== 'dead');
    const fp = foe.char.pos, seen0 = g.fogOfWar.seen;
    const keep = { foe: A.foe, watch: A.watch, order: A.order, door: A.door, fit: A.fit };
    A.foe = foe; g.fogOfWar.seen = (x: any) => x !== foe;
    const hid = !(floorPlan(g).men as any[]).some(m => m.gd === m0);
    g.fogOfWar.seen = () => true; A.watch = [fp[0], 0, fp[2]];
    const pm1 = (floorPlan(g).men as any[]).find(m => m.gd === m0);
    g.fogOfWar.seen = seen0; A.foe = keep.foe;
    A.order = 'openClear'; A.door = null; A.fit = undefined; A.watch = [fp[0], 0, fp[2]];   // (a door tool's 'threat first' writes a sensed place)
    const pm2 = (floorPlan(g).men as any[]).find(m => m.gd === m0);
    Object.assign(A, keep);
    const onFoe = (floorPlan(g).men as any[]).filter(m => g.guards.some((x: any) => x.team === 'hostile' && x.state !== 'dead' && ((m.watch && dist(m.watch, x.char.pos) < 1) || dist(m.mark, x.char.pos) < 0.5))).length;
    line(hid && !!pm1 && pm1.watch === null && !!pm2 && pm2.watch === null && onFoe === 0, 'nothing of an enemy: no mark from an unseen man, no line to a sensed one', `mark from an unseen man listed: ${!hid} · watch on a seen foe: ${pm1?.watch ? 'DRAWN' : 'none'} · on a sensed place: ${pm2?.watch ? 'DRAWN' : 'none'} · marks or lines on a defender now: ${onFoe}`);
    const sc = m0.script, o0 = sc?.over; if (sc) sc.over = { aimAt: [fp[0], 1, fp[2]], face: null };
    const pm3 = (floorPlan(g).men as any[]).find(m => m.gd === m0); if (sc) sc.over = o0;
    line(!!sc && !!pm3 && pm3.held && pm3.there, 'a man the room fight has on somebody: dim, his mark kept', pm3 ? `${pm3.tag} held ${pm3.held} there ${pm3.there}` : 'not listed');
  }
  // 5. the menu's rings
  {
    O.close(); const none = floorPlan(g).who.length, you0 = floorPlan(g).you;
    O.open(O.targetAt(spot ?? g.player.char.pos)); R.step(2);
    const who: any[] = floorPlan(g).who, menuMen = O.menu?.men ?? [], you = floorPlan(g).you;
    const ok = none === 0 && who.length === menuMen.length && who.length > 0 && who.every(q => menuMen.includes(q.gd) && dist(q.at, q.gd.char.pos) < 0.01);
    O.close(); R.step(1);
    line(ok && floorPlan(g).who.length === 0, 'the menu up rings the men it goes to', `${who.length} ringed of ${menuMen.length} in the menu · none before, none after`);
    line(!you0 && !!you && dist(you, g.player.char.pos) < 0.01 && !floorPlan(g).you, 'the menu up rings the player, at his feet', `${you ? 'ringed' : 'NOT ringed'} with the menu up · ${you0 ? 'ringed' : 'none'} before, ${floorPlan(g).you ? 'ringed' : 'none'} after`);
  }
  // 6. a door: stacked men's marks are by the door
  {
    const s = g.player.char.pos; let best: any = null, bd = 1e9, bwhy: string | null = 'no door';
    const doors = [...g.doors.list].sort((a: any, b: any) => dist(a.frameCentre, s) - dist(b.frameCentre, s));
    for (const d of doors) {
      const t = O.targetAt(d.frameCentre); if (t.kind !== 'door') continue;
      const w = O.give('stack', t, 'all'); if (w) { bwhy = w; continue; }
      best = d; bd = dist(d.frameCentre, s); bwhy = null; break;
    }
    R.step(2);
    const men: any[] = floorPlan(g).men;
    const ok = !!best && men.length === 4 && men.every(m => dist(m.mark, best.frameCentre) < 7 && (m.path.length >= 2 || m.there));
    line(ok, 'a stack order: a mark a man by the door', best ? `door ${f1(bd)} m off · ${men.map(m => `${m.tag} ${f1(dist(m.mark, best.frameCentre))} m from it${m.path.length ? `, ${f1(len(m.path))} m to walk` : ''}`).join(' · ')}` : `refused everywhere: ${bwhy}`);
  }
  // 6b. the word: the stacked door is the one door marked, with the key; the word given, the mark goes
  {
    const T = g.doorTools, P0 = floorPlan(g), d0: any[] = P0.doors;
    R.until(() => (floorPlan(g).men as any[]).every(m => m.there), 40);
    const d1: any[] = floorPlan(g).doors, one = d1[0];
    const jamb = one ? dist(one.a, one.b) : 0, mid = one ? [(one.a[0] + one.b[0]) / 2, 0, (one.a[2] + one.b[2]) / 2] : [0, 0, 0];
    line(d0.length === 1 && d1.length === 1 && one.why === 'stack' && one.key === 'F' && one.now && one.tone === 'gold' && Math.abs(jamb - one.door.def.width) < 1e-6 && dist(mid, one.door.frameCentre) < 0.01,
      'a stacked door waits on the word: one bar, the key on it', d1.length ? `${d1.length} door · ${one.why} · key ${one.key} · ${one.tone} · bar ${f1(jamb)} m across its doorway` : 'no door listed');
    const kw = PLAN.word; PLAN.word = false; const none = floorPlan(g).doors.length; PLAN.word = kw;
    const went = T.go('all'); R.step(3);
    const d2: any[] = floorPlan(g).doors;
    line(went === null && d2.length === 0 && none === 0, 'the word given, the bar is gone', `go() → ${went === null ? 'went' : `'${went}'`} · ${d2.length} door listed after · ${none} with the part off`);
    // (the other way round: nothing listed ⇒ nothing waits)
    const again = T.go('all');
    line(typeof again === 'string', 'nothing marked, nothing waits', `go() again → ${again === null ? 'something WENT' : `'${again}'`}`);
  }
  // 6c. a tool given on the word to one pair: marked in that pair's colour; the key only while orders go to them
  {
    O.give('fallIn', O.targetAt(g.player.char.pos), 'all'); R.until(() => g.doorTools.ops.length === 0, 20); R.step(60);
    const s = g.player.char.pos; let door: any = null, w: string | null = 'no door';
    for (const d of [...g.doors.list].sort((a: any, b: any) => dist(a.frameCentre, s) - dist(b.frameCentre, s))) { const t = O.targetAt(d.frameCentre); if (t.kind !== 'door') continue; w = O.give('openClear', t, 'red', { onWord: true }); if (!w) { door = d; break; } }
    R.step(3);
    const who0 = O.who; const d1: any[] = floorPlan(g).doors; O.who = 'blue'; const d2: any[] = floorPlan(g).doors; O.who = who0;
    const ok = !!door && d1.length === 1 && d1[0].door === door && d1[0].why === 'tool' && d1[0].tone === 'red' && d1[0].now && d2.length === 1 && !d2[0].now;
    line(ok, 'a tool on the word: the pair\'s colour, the key only for the men it would send', door ? `${d1.map(d => `${d.why} · ${d.tone} · now ${d.now}`).join(' | ')} · orders to blue: now ${d2[0]?.now}` : `refused everywhere: ${w}`);
    // the key itself: pressed where the bar has no key on it nothing goes; pressed where it has, it goes
    const T = g.doorTools, waitingOp = () => T.ops.find((o: any) => o.door === door && !o.word);
    O.who = 'blue'; R.W.input.pressed.add('KeyF'); R.step(2); const stillWaits = !!waitingOp();
    O.who = who0; const nowAll = (floorPlan(g).doors as any[])[0]?.now; R.W.input.pressed.add('KeyF'); R.step(2); const wentNow = !waitingOp();
    line(!!door && stillWaits && nowAll && wentNow, 'the key does what the bar says', `orders to blue, F: ${stillWaits ? 'still waiting' : 'WENT'} · orders to all (bar now ${nowAll}), F: ${wentNow ? 'went' : 'STILL WAITING'}`);
    // 6d. a charge: set, its door is the key's whoever the orders go to; Sam down, no key
    O.give('fallIn', O.targetAt(g.player.char.pos), 'all'); R.until(() => T.ops.length === 0, 30); R.step(60);
    let cd: any = null, cw: string | null = 'no door';
    for (const d of [...g.doors.list].sort((a: any, b: any) => dist(a.frameCentre, g.player.char.pos) - dist(b.frameCentre, g.player.char.pos))) { const t = O.targetAt(d.frameCentre); if (t.kind !== 'door') continue; cw = O.give('charge', t, 'blue'); if (!cw) { cd = d; break; } }
    const setOk = R.until(() => T.set.length > 0, 40); R.step(5);
    const c1: any[] = floorPlan(g).doors; O.who = 'red'; const c2: any[] = floorPlan(g).doors; O.who = who0;
    g.player.down = true; const c3: any[] = floorPlan(g).doors; g.player.down = false;
    const cok = !!cd && setOk && c1.length === 1 && c1[0].door === cd && c1[0].why === 'charge' && c1[0].key === 'F' && c1[0].now && c1[0].tone === 'blue' && c2[0]?.now && c3.length === 1 && !c3[0].now;
    R.W.input.pressed.add('KeyF'); R.step(2); const blown = R.until(() => T.set.length === 0, 4);
    line(cok && blown, 'a set charge: its door carries the key, and the key blows it', cd ? `${c1.map(d => `${d.why} · ${d.tone} · now ${d.now}`).join(' | ')} · orders to red: now ${c2[0]?.now} · Sam down: now ${c3[0]?.now} · F: ${T.set.length} set after` : `refused everywhere: ${cw}`);
    R.step(120);
    O.give('fallIn', O.targetAt(g.player.char.pos), 'all'); R.step(30);
  }
  // 7. fall in: followers have no mark, nothing is listed
  {
    const w = O.give('fallIn', O.targetAt(g.player.char.pos), 'all'); R.step(5);
    const P = floorPlan(g);
    line(!w && P.men.length === 0 && !BREAK, 'fall in: a follower has no mark, nothing drawn', w ? `refused: ${w}` : `${P.men.length} listed`);
  }
  // 8. the switch
  {
    O.give('hold', O.targetAt(g.player.char.pos), 'all'); R.step(60);
    const onN = floorPlan(g).men.length; const k = PLAN.on; PLAN.on = false; const offN = floorPlan(g).men.length + floorPlan(g).who.length; PLAN.on = k;
    line(onN === 4 && offN === 0, 'the switch off lists nothing', `on ${onN} men · off ${offN}`);
  }
  // 9. asking every frame moves nothing: two runs of one seed, one asked each frame and one never
  {
    const run = async (ask: boolean) => {
      const Q = await rig(7, ask); const sp = farFloor(Q);
      if (sp) Q.O.give('move', Q.O.targetAt(sp), 'all'); Q.step(60 * 6);
      Q.O.give('fallIn', Q.O.targetAt(Q.game.player.char.pos), 'all'); Q.step(60 * 3);
      return { d: JSON.stringify(digestGame(Q.game, true)), asked: Q.asked };
    };
    const a = await run(false), b = await run(true);
    line(a.d === b.d && b.asked > 500 && !BREAK, 'asked every frame, the run is the same', `digest ${a.d === b.d ? 'equal' : 'DIFFERS'} · asked ${b.asked} times against ${a.asked}`);
  }
  // 10. the pair's room clear drill: F stacks them, and the door it will go through then carries the key
  {
    const Q = await rig(3, false, 2), NB = Q.game.nightBreach, before = floorPlan(Q.game).doors.length;
    Q.W.input.pressed.add('KeyF'); Q.step(2);
    const set = Q.until(() => NB.state === 'set', 30);
    const ds: any[] = floorPlan(Q.game).doors, d = ds[0];
    Q.W.input.pressed.add('KeyF'); Q.step(2);
    line(before === 0 && set && ds.length === 1 && d.why === 'drill' && d.key === 'F' && d.now && d.door === NB.drill?.door && NB.state !== 'set' && floorPlan(Q.game).doors.every((x: any) => x.why !== 'drill'),
      'the drill stacked: its door carries the key, and the key sends it', `state ${set ? 'set' : NB.state} · ${ds.map(x => `${x.why} · key ${x.key} · now ${x.now}`).join(' | ') || 'no door'} · after F: ${NB.state}`);
  }
  PLAN.menuOnly = menuOnly0;
  // 11‥14. a teammate's throw (squadthrow.ts's own reader, folded in): the throw page's offer, the part's switch, the ordered throw until it leaves his hand
  {
    const ST: any = await import(`${ROOT}/src/game/squadthrow.ts`), { FRAG } = await import(`${ROOT}/src/game/frag.ts`), { rig: throwRig } = await import('./squadthrow-check.ts');
    const kept = { st: { ...ST.SQUADTHROW }, frag: FRAG.on, squad: NIGHTBREACH.squad, throws: PLAN.throws, on: PLAN.on, random: Math.random };
    try {
      const R: any = await throwRig(11, true, { walk: true }); PLAN.on = !BREAK; PLAN.throws = true;
      const game = R.game, team: any[] = R.team; let c: { at: number[]; d: number } | null = null;
      // a spot nobody has a throw to from where he stands and one man has after a walk: the longest such walk
      for (let x = 2.25; x <= 38; x += 1) for (let z = 2.25; z <= 26; z += 1) {
        const t = R.O.targetAt([x, 0, z]); if (t.kind !== 'floor' || dist(t.at, [x, 0, z]) > 0.3 || ST.squadThrower(game, team, t.at, 'frag')) continue;
        const th = ST.squadThrowPlan(game, team, t.at, 'frag', true); if (!th?.post || ST.squadFragCatches(game, th.rest, t.at)) continue;
        const d = dist(th.gd.char.pos, th.post); if (!c || d > c.d) c = { at: t.at, d };
      }
      if (!c) line(false, 'a teammate\'s throw: a spot one man must walk to throw at', 'none found on the office with the four holding');
      else {
        R.pageAt(c.at);
        const pre: any[] = floorPlan(game).throws, src: any[] = ST.squadThrowPlans(game), t = pre[0];
        line(pre.length === 1 && src.length === 1 && t.preview && team.includes(t.gd) && t.tag === planTag(t.gd.callsign) && t.walk.length > 1 && dist(t.walk[t.walk.length - 1], t.from) < 0.6 && t.arc.length > 2 && dist(t.arc[t.arc.length - 1], t.land) < 0.11 && dist(t.land, src[0].land) < 0.01 && t.reach === FRAG.lethalM && FP.planDrawsThrows(),
          'the throw page up: one offered throw is listed — who, his walk, the arc, where it rests, a frag\'s reach', t ? `${t.tag} · walk ${f1(len(t.walk))} m in ${t.walk.length} points · arc ${t.arc.length} points, ending ${f1(dist(t.arc[t.arc.length - 1], t.land))} m from the ring (the reader's own: ${f1(dist(src[0].points[src[0].points.length - 1], src[0].land))} m) · reach ${f1(t.reach)} m · the reader gave ${src.length}` : `listed ${pre.length} · the reader gave ${src.length}`);
        PLAN.throws = false; const offN = floorPlan(game).throws.length, hands = !FP.planDrawsThrows(); PLAN.throws = true;
        line(pre.length === 1 && offN === 0 && hands, 'that part switched off lists no throw, and the neighbour\'s own picture is let draw again', `on ${pre.length} · off ${offN} · planDrawsThrows ${!hands}`);
        const log0 = ST.SQUADTHROW_LOG.length; R.press('Digit1'); R.step(2);
        const live: any = floorPlan(game), th = live.throws[0], man = th && live.men.find((m: any) => m.gd === th.gd), own = live.throws.every((x: any) => team.includes(x.gd));
        line(live.throws.length === 1 && !th.preview && own && th.arc.length > 2 && ((!!man && man.path.length > 1 && th.walk.length === 0) || (!(man && man.path.length > 1) && th.walk.length > 1)),
          'ordered: the throw stays listed, his walk drawn once (his order\'s own way, else the throw\'s)', th ? `${th.tag} · his order's way ${man ? man.path.length : 0} points · the throw's walk ${th.walk.length} points · arc ${th.arc.length}` : `listed ${live.throws.length}`);
        const thrown = R.until(() => ST.SQUADTHROW_LOG.length > log0, 25); R.step(2);
        const after = floorPlan(game).throws.length;
        line(thrown && after === 0, 'the thing out of his hand: nothing of the throw is left listed', `thrown ${thrown} · listed after ${after}`);
      }
    } catch (e) { line(false, 'a teammate\'s throw: the lines threw', e instanceof Error ? (e.stack ?? e.message).split('\n').slice(0, 3).join(' · ') : String(e)); }
    finally { Object.assign(ST.SQUADTHROW, kept.st); FRAG.on = kept.frag; NIGHTBREACH.squad = kept.squad; PLAN.throws = kept.throws; PLAN.on = kept.on; Math.random = kept.random; }
  }
  // 15. the rescue's quiet start: the first F stacks them on the hostage room; while they hold for the second its door carries the key, and the key sends it
  {
    const { RESCUE } = await import(`${ROOT}/src/game/rescue.ts`), { rig: rescueRig } = await import('./rescue-probes.ts');
    const kept = { rescue: { ...RESCUE }, on: PLAN.on, random: Math.random };
    try {
      const T: any = await rescueRig(13, { start: 'quiet', doorMan: 'inside', roamers: 0 }); PLAN.on = !BREAK;
      const game = T.game, RS = game.rescue; T.secs(0.3);
      const before = floorPlan(game).doors.length;
      T.press('KeyF'); const onWay: any[] = (T.secs(0.5), floorPlan(game).doors);
      const set = T.secs(25, () => !!RS.entry && !isNaN(RS.entry.setT)); T.secs(0.5);
      const doors: any[] = RS.entry ? RS.entry.ops.filter((e: any) => e.ended === null).map((e: any) => e.op.door) : [], ds: any[] = floorPlan(game).doors;
      const held = !!RS.entry && !RS.entry.gate.go, barred = ds.length === doors.length && ds.length > 0 && ds.every(d => doors.includes(d.door) && d.key === 'F' && d.now);
      game.player.down = true; const downNow = (floorPlan(game).doors as any[]).some(d => d.now); game.player.down = false;
      T.press('KeyF'); T.secs(0.2);
      const went = !!RS.entry?.gate.go, after = floorPlan(game).doors.length;
      line(before === 0 && onWay.length > 0 && set && held && barred && !downNow && went && after === 0, 'the rescue\'s quiet start: the stacked door carries the key, and the key sends it',
        `before ${before} · on their way ${onWay.length} · set ${set} · ${ds.map(d => `${d.why} · key ${d.key} · now ${d.now}`).join(' | ') || 'no door'} of ${doors.length} · Sam down: ${downNow ? 'STILL now' : 'none now'} · after F: gate ${went ? 'open' : 'SHUT'}, ${after} listed`);
    } catch (e) { line(false, 'the rescue\'s quiet start: the lines threw', e instanceof Error ? (e.stack ?? e.message).split('\n').slice(0, 3).join(' · ') : String(e)); }
    finally { Object.assign(RESCUE, kept.rescue); PLAN.on = kept.on; Math.random = kept.random; }
  }
  // 16. the quiet pair's mark: a man waiting on it has a bar a step ahead of him with the key, the key is his before any door's, and it goes with the mark
  {
    const { PAIR } = await import(`${ROOT}/src/game/pairorders.ts`), { SILENT } = await import(`${ROOT}/src/game/silent.ts`), { scene } = await import('./pair-probes.ts');
    const kept = { pair: { ...PAIR }, silent: { ...SILENT }, squad: NIGHTBREACH.squad, on: PLAN.on, random: Math.random };
    try {
      const { R, foe, mate }: any = await scene(); PLAN.on = !BREAK;
      const game = R.game, P = R.P, before = floorPlan(game).doors.length;
      R.O.give('pairMark', R.foe(foe)); const set = R.until(() => !!P.jobOf(mate)?.set, 30); R.step(2);
      const ds: any[] = floorPlan(game).doors, d = ds[0], off = d ? dist([(d.a[0] + d.b[0]) / 2, 0, (d.a[2] + d.b[2]) / 2], mate.char.pos) : NaN;
      const fx = Math.sin(mate.char.aimYaw), fz = Math.cos(mate.char.aimYaw), ahead = d ? ((d.a[0] + d.b[0]) / 2 - mate.char.pos[0]) * fx + ((d.a[2] + d.b[2]) / 2 - mate.char.pos[2]) * fz : NaN;
      game.player.down = true; const downNow = (floorPlan(game).doors as any[]).some(x => x.now); game.player.down = false;
      R.press('KeyF'); R.step(2);
      const J = P.jobOf(mate), went = !J || J.go, after = (floorPlan(game).doors as any[]).filter(x => x.why === 'pair').length;
      line(before === 0 && set && ds.length === 1 && d.why === 'pair' && d.door === null && d.key === 'F' && d.now && off < 1 && ahead > 0.3 && !downNow && went && after === 0,
        'the quiet pair\'s mark: the man waiting has the key on a bar ahead of him, and the key is the mark', `before ${before} · set ${set} · ${ds.map(x => `${x.why} · key ${x.key} · now ${x.now}`).join(' | ') || 'no bar'} · ${f1(off)} m from him, ${f1(ahead)} m ahead · Sam down: ${downNow ? 'STILL now' : 'none now'} · after F: ${went ? 'gone' : 'STILL waiting'}, ${after} listed`);
    } catch (e) { line(false, 'the quiet pair\'s mark: the lines threw', e instanceof Error ? (e.stack ?? e.message).split('\n').slice(0, 3).join(' · ') : String(e)); }
    finally { Object.assign(PAIR, kept.pair); Object.assign(SILENT, kept.silent); NIGHTBREACH.squad = kept.squad; PLAN.on = kept.on; Math.random = kept.random; }
  }
  // 17. only in the order mode (PLAN.menuOnly): normal play has no man's mark on the floor; an order just given shows and goes; the menu up shows what stands
  {
    const Q = await rig(5, false), game = Q.game, QO = Q.O, sp = farFloor(Q); PLAN.menuOnly = true;
    const n = () => floorPlan(game).men.length;
    const w = sp ? QO.give('move', QO.targetAt(sp), 'all') : 'no spot'; Q.step(5);
    const flash = n(), flashMode = floorPlan(game).mode;
    Q.step(Math.round(PLAN.freshSecs * 60) + 30);
    const walking = Q.team.filter((m: any) => !QO.of(m)?.arrived).length, quiet = n();
    // a module's own re-assign (no order given) stamps him anew: still nothing
    const m0 = Q.team[0], A0 = QO.of(m0); QO.assign(m0, { order: A0.order, post: A0.post, face: A0.face, going: A0.going, there: A0.there }); Q.step(2);
    const reassigned = n();
    QO.open(QO.targetAt(sp ?? game.player.char.pos)); Q.step(2);
    const up = n(), upMode = floorPlan(game).mode;
    QO.close(); Q.step(2);
    const down = n(); PLAN.menuOnly = false; const always = n(); PLAN.menuOnly = true;
    line(!w && flash === 4 && !flashMode && walking > 0 && quiet === 0 && reassigned === 0 && up === 4 && upMode && down === 0 && always === 4, 'only in the order mode: an order given shows and goes, normal play is clean, the menu up shows what stands',
      w ? `refused: ${w}` : `just given ${flash} · ${f1(PLAN.freshSecs + 0.5)} s on ${quiet} listed with ${walking} still walking · a module's re-assign ${reassigned} · menu up ${up} · closed ${down} · the switch off ${always}`);
    PLAN.menuOnly = menuOnly0;
  }
  console.log(fails ? `plan-check: ${fails} FAIL` : 'plan-check: ALL PASS');
  return fails === 0;
}

if (import.meta.main) { const ok = await planCheck(); process.exit(ok ? 0 : 1); }
