// Two rules for a room cleared from outside, each behind its own switch (on in the page, off on the frozen stand), from the maintainer's tape of 10-18
// (training 5, the kitchen's door: the pair held a diagonal each for three seconds, said 'holding on the door' with a defender stood square in front of
// it — in the wedge neither diagonal shows — and both were shot stepping in; "men should try to pie from the outside as much as they can before considering
// their job done … I think we could add some element of leaning to the AI"):
//   DOORTOOLS.thrPie    both jamb men CUT THE OPENING toward its middle, a few degrees a step, until the outside shows no more floor; only then is the door
//                       quiet and 'holding on the door' said
//   DOORTOOLS.thrLean   the man cutting LEANS — head and gun past the edge, hips short of the station — and takes the cuts that look down the door's own
//                       line on a knee (teammates only)
//   bun run tools/qa/thrpie-check.ts            (probes.ts thrpie; THRPIE_BREAK=1 must FAIL — both switches are left off where they are asked for)
// Headless, on the tape's own level and door, the order given as the menu's row gives it ('clear from outside' = thresholdHold). The defender is the level's
// own man in that room, where the level stands him. Nothing here says how any of it LOOKS: the lean is measured off the bones, never seen on a GPU.
import { ROOT } from './headless.ts';
import { stage, quiet, guarded, family } from './thresholdmenu-probes.ts';
const { DOORTOOLS, doorPt, alongOf, offOf } = await import(`${ROOT}/src/game/doortools.ts`);
const { ALL_MISSIONS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const { knobsCopy, knobsBack } = await import(`${ROOT}/src/game/knobs.ts`) as any;

const BREAK = !!process.env.THRPIE_BREAK;
const LEVEL = 'train-orders', DOOR = 'hut_d', SAM = [18.5, 0, 14.2];
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const f2 = (v: number) => v.toFixed(2);

interface Man { name: string; stations: number; lead: number; gun: number; knee: number; leanAsked: boolean; leanAfter: number; kneeAfter: number; walked: number; /** the stations he was sent to, and those of them his hips stood on */ sent: Set<number>; stood: Set<number>; fin: boolean; /** he was asked to lean while still on his first spot (his diagonal, hips not drawn back) */ lean0: boolean; /** how far he moved in the two seconds before the door was called held */ drift: number }
interface Out { why: string | null; told: number; unseen: number; cells: number; foe: string; foeSeen: boolean; foeDown: boolean; lost: number; over: number; men: Man[]; apart: number; beats: string; g: any; /** K.word: the word was given with a man mid-cut on a knee — the op's phase, and who still leaned or knelt outside, four seconds on */ word: { given: boolean; phase: string; bent: string[] } }

/** the tape's door, the order given, run until the lead says the door is held (or `secs`) and a second more */
async function held(K: { pie: boolean; lean: boolean; blind?: boolean; word?: boolean }, secs = 40): Promise<Out> {
  const E = ALL_MISSIONS.find((s: any) => s.id === LEVEL); if (!E) throw new Error(`no scenario ${LEVEL}`);
  const R = await stage(E, 1), g = R.g, d = g.doors.byName(DOOR); if (!d) throw new Error(`no door ${DOOR}`);
  DOORTOOLS.thrPie = K.pie && !BREAK; DOORTOOLS.thrLean = K.lean && !BREAK;   // (after the stand-up: the frozen stand pins both off)
  const on = await quiet(() => R.place(SAM, d)); if (!on) throw new Error(`X does not open on ${DOOR} from the spot`);
  const t = g.orders.targetUnder(R.input, R.W.cam, R.W.canvas), side = t.side as 1 | -1, W = d.def.width;
  const why = await quiet(() => g.orders.give('thresholdHold', t)) as string | null;
  const mid = doorPt(d, W / 2, 2.5, -side as 1 | -1);
  const foe = g.guards.filter((x: any) => x.team === 'hostile' && x.state !== 'dead').sort((a: any, b: any) => flat(a.char.pos, mid) - flat(b.char.pos, mid))[0];
  const team = () => R.team as any[], t0 = g.time;
  const rec = new Map<any, Man & { trail: number[][] }>(); const word = { given: false, phase: '', bent: [] as string[] }; let op: any = null, told = NaN, unseen = -1, cells = 0, over = Infinity, foeSeen = false, foeDown = false, lostAtTold = 0, apart = Infinity;
  const inw = (m: any): number[] => { const s = alongOf(d, m.char.pos) < W / 2 ? 1 : -1, a = doorPt(d, 0, 0, side), b = doorPt(d, 1, 0, side); return [(b[0] - a[0]) * s, 0, (b[2] - a[2]) * s]; };
  const tick = () => {
    op ??= R.D.ops.find((o: any) => o.door === d) ?? null; const T = op?.thr; if (!T) return;
    if (K.blind && op.search) op.search = undefined;   // (no model of the room's floor: every cut is walked, the ones down the door's own line too)
    for (const m of T.jamb as any[]) { const s = op.slice.get(m);
      let r = rec.get(m); if (!r) { r = { name: m.callsign, stations: s ? s.pts.length : 0, lead: -9, gun: -9, knee: 0, leanAsked: false, leanAfter: 0, kneeAfter: 0, walked: 0, sent: new Set(), stood: new Set(), fin: false, lean0: false, drift: NaN, trail: [] }; rec.set(m, r); }
      if (m.state === 'dead') continue;
      if (isNaN(told)) { r.trail.push([m.char.pos[0], 0, m.char.pos[2]]); if (r.trail.length > 120) r.trail.shift(); }
      if (!s) continue;
      r.sent.add(s.i); if (flat(m.char.pos, s.pts[s.i]) < 0.15) r.stood.add(s.i); r.fin = !!s.pie?.fin; if (s.i === 0 && !s.pie?.fin && m.script?.lean) r.lean0 = true;
      const u = inw(m), c = m.char, h = c.bones.head, hp = c.bones.hips ?? c.pos, mz = c.muzzle;
      if (isNaN(told) && s.i > 0) { if (h) r.lead = Math.max(r.lead, (h[0] - hp[0]) * u[0] + (h[2] - hp[2]) * u[2]); if (mz) r.gun = Math.max(r.gun, (mz[0] - hp[0]) * u[0] + (mz[2] - hp[2]) * u[2]); r.knee = Math.max(r.knee, c.anim.crouch); if (m.script?.lean) r.leanAsked = true; }
      r.walked = Math.max(r.walked, s.i); }
    if (K.word && !word.given && (T.jamb as any[]).some(m => op.slice.get(m)?.pie && !op.slice.get(m).pie.fin && m.char.anim.crouch > 0.9)) { word.given = true; R.D.go(); }
    if (isNaN(told)) { for (const m of team()) if (m.state !== 'dead') over = Math.min(over, offOf(d, m.char.pos, side), m.char.bones.head ? offOf(d, m.char.bones.head, side) : Infinity);
      if (foe && (op.beats ?? []).some((b: any) => String(typeof b === 'string' ? b : b.what ?? b.text ?? '').includes(`seen · ${foe.callsign}`))) foeSeen = true;
      if (T.told) { told = g.time - t0; unseen = op.search?.left ?? -1; cells = op.search?.pts.length ?? 0; foeDown = !!foe && foe.state === 'dead'; lostAtTold = team().filter(m => m.state === 'dead').length; for (const r of rec.values()) if (r.trail.length) r.drift = flat(r.trail[0], r.trail[r.trail.length - 1]);
        const J = (T.jamb as any[]).filter(m => m.state !== 'dead'); if (J.length > 1) apart = flat(J[0].char.pos, J[1].char.pos); } } };
  await quiet(() => { for (let i = 0; i < secs * 60 && isNaN(told) && !word.given; i++) { R.step(); tick(); } R.step(word.given ? 240 : 90); });
  if (word.given) { word.phase = String(op?.phase ?? op?.ended ?? ''); word.bent = team().filter(m => m.state !== 'dead' && (m.script?.lean || (m.char.anim.crouch > 0.5 && offOf(d, m.char.pos, side) > 0))).map(m => m.callsign); }
  for (const [m, r] of rec) { r.leanAfter = Math.abs(m.script?.lean ?? 0); r.kneeAfter = m.char.anim.crouch; }
  return { why: why ?? null, told, unseen, cells, foe: foe ? `${foe.callsign} ${f2(flat(foe.char.pos, mid))} m off the door's own line, 2.5 m in` : 'nobody', foeSeen, foeDown, lost: lostAtTold, over, men: [...rec.values()], apart,
    beats: (op?.beats ?? []).map((b: any) => typeof b === 'string' ? b : b.what ?? b.text ?? '').join(' | '), g, word };
}
/** a teammate stood in the open with his gun in his shoulder, leaned each way through an order's own field: where his head, his muzzle, the middle of his
 *  trunk and his hips are, to his right of where his hips were */
async function pose() {
  const E = ALL_MISSIONS.find((s: any) => s.id === LEVEL), R = await stage(E, 1), g = R.g, m = R.team[0], c = m.char, p = [c.pos[0], 0, c.pos[2]];
  let yaw = 0; const hold = (lean: number) => g.orders.assign(m, { order: 'move', post: p, face: yaw, watch: [p[0] + Math.sin(yaw) * 6, 1.2, p[2] + Math.cos(yaw) * 6], stance: 'none', upper: 'aim', going: 'x', there: 'x', ...(lean ? { lean } : {}) });
  for (const y of [0, 1.57, 3.14, -1.57, 0.8, -0.8, 2.4, -2.4]) { yaw = y; await quiet(() => { hold(0); R.step(60); }); if (!m.muzzleDown) break; }   // (a way to face with nobody and nothing in front of the gun)
  const h0 = [...(c.bones.hips ?? c.pos)], right = [-Math.cos(yaw), Math.sin(yaw)], lat = (q: number[] | undefined) => q ? (q[0] - h0[0]) * right[0] + (q[2] - h0[2]) * right[1] : NaN;
  const at = async (lean: number) => { const o = { head: 0, gun: 0, trunk: 0, hips: 0 }, N = 60;   // (settled, then the mean of a second, each off his hips of that frame: he breathes and shifts his weight)
    await quiet(() => { hold(lean); R.step(90); for (let i = 0; i < N; i++) { R.step(); const hp = lat(c.bones.hips ?? c.pos); o.head += (lat(c.bones.head) - hp) / N; o.gun += (lat(c.muzzle) - hp) / N; o.trunk += (lat(c.bones.spine2) - hp) / N; o.hips += hp / N; } }); return o; };
  const mid = await at(0), r = await at(BREAK ? 0 : 1), l = await at(BREAK ? 0 : -1), back = await at(0);
  return { up: !m.muzzleDown, mid: mid.head, right: r.head, left: l.head, back: back.head, gunRight: r.gun, gunLeft: l.gun, trunk: Math.max(Math.abs(r.trunk - mid.trunk), Math.abs(l.trunk - mid.trunk)), hips: Math.max(Math.abs(r.hips), Math.abs(l.hips)) };
}
const menOf = (o: Out) => o.men.map(m => `${m.name}: ${m.stations} stations, sent to ${[...m.sent].map(i => i + 1).join(',')}, stood on ${[...m.stood].map(i => i + 1).join(',')}, done ${m.fin}, head ${f2(m.lead)} m past his hips toward the middle, knee ${f2(m.knee)}`).join(' · ');

export const thrpieCheck = guarded(async () => {
  const F = family('thrpie: the jamb men slice a doorway before they call it held · the man cutting leans, the last cut on a knee');
  const keep = { p: DOORTOOLS.thrPie, l: DOORTOOLS.thrLean }, knobs0 = knobsCopy();
  try {
    const off = await held({ pie: false, lean: false }), pie = await held({ pie: true, lean: false }), lean = await held({ pie: true, lean: true }), deep = await held({ pie: true, lean: true, blind: true }), deepSq = await held({ pie: true, lean: false, blind: true }), worded = await held({ pie: true, lean: true, blind: true, word: true });
    if (process.env.THRPIE_SHOW) for (const [n, o] of [['off', off], ['pie', pie], ['lean', lean], ['deep', deep], ['deepSq', deepSq], ['worded', worded]] as [string, Out][]) process.stderr.write(`${n}: why ${o.why} told ${f2(o.told)} unseen ${o.unseen}/${o.cells} foe ${o.foe} seen ${o.foeSeen} down ${o.foeDown} lost ${o.lost} over ${f2(o.over)} apart ${f2(o.apart)}\n   ${menOf(o)}\n   ${o.beats.slice(0, 600)}\n`);
    // (1) as it was: a diagonal each, the man in the middle never seen, 'holding' said over him
    F.verdict(off.why === null && !isNaN(off.told) && off.men.length === 2 && off.men.every(m => m.stations <= 1 && m.drift < 0.05 && m.knee === 0 && !m.leanAsked) && !off.foeSeen && !off.foeDown && !/slice/.test(off.beats),
      'with the rule off it is the build as it was, and the tape: a diagonal each, held still, and the door called held with the man in the middle of the room never in either gun\'s sight',
      `told at ${f2(off.told)} s · ${off.unseen} of ${off.cells} cells unseen · ${off.foe}: seen ${off.foeSeen}, down ${off.foeDown} · moved in the two seconds before: ${off.men.map(m => `${m.name} ${f2(m.drift)} m`).join(', ')}`);
    // (2) the slice
    const stoodAll = (o: Out) => o.men.every(m => m.sent.size >= 2 && [...m.sent].every(i => m.stood.has(i))), outside = (o: Out) => o.foeSeen && o.foeDown && o.beats.includes('down from outside');
    F.verdict(pie.why === null && !isNaN(pie.told) && pie.told < DOORTOOLS.thrCap - 2 && pie.men.length === 2 && pie.men.every(m => m.stations >= 4 && m.fin) && stoodAll(pie) && outside(pie) && pie.lost === 0 && pie.unseen < off.unseen && pie.told > off.told,
      'with it on both jamb men cut the opening, their hips on every station they were sent to, and both are done before the door is called held (well inside the hold\'s cap): the man in the middle is seen and dropped from outside, nobody is lost, less of the floor is left unseen',
      `told at ${f2(pie.told)} s (off ${f2(off.told)}) · ${pie.unseen} of ${pie.cells} cells unseen (off ${off.unseen}) · seen ${pie.foeSeen}, down ${pie.foeDown} · lost ${pie.lost} · ${pie.men.map(m => `${m.name}: sent to ${[...m.sent].map(i => i + 1).join(',')} of ${m.stations}, stood on ${[...m.stood].map(i => i + 1).join(',')}, done ${m.fin}`).join(' · ')}`);
    F.verdict(pie.over > 0.3 && lean.over > 0.3 && deep.over > 0.3 && [pie, lean, deep, deepSq].every(o => Number.isFinite(o.apart) && o.apart >= DOORTOOLS.thrPieApart - 0.05),
      'nobody\'s hips or head cross the frame line (or come within 0.3 m of it) while it is worked from outside, and the two end no nearer each other than a man is wide — every cut walked too',
      `nearest the frame line: ${f2(pie.over)} m (leaning ${f2(lean.over)}, every cut ${f2(deep.over)}) · apart at the end: ${[pie, lean, deep, deepSq].map(o => f2(o.apart)).join(', ')} m`);
    // (3) the lean and the knee
    const P = await pose();
    F.verdict(P.up && P.right - P.mid > 0.08 && P.mid - P.left > 0.08 && P.gunRight > P.right - 0.02 && Math.abs(P.trunk) < 0.06 && Math.abs(P.hips) < 0.08 && Math.abs(P.back - P.mid) < 0.04,
      'the lean is in the bones: a man with his gun up, leaned to a side, has his head a hand or more that way of where it was, his hips and the middle of his trunk where they were (the columns a round is tested against stay); leaned to his gun side the muzzle is out past his head; told to stand square he is back',
      `head right of his hips (a second's mean): square ${f2(P.mid)} m · leaned right ${f2(P.right)} · leaned left ${f2(P.left)} · square again ${f2(P.back)} · muzzle leaned right ${f2(P.gunRight)}, left ${f2(P.gunLeft)} · the trunk's middle moved ${f2(P.trunk)} m, the hips ${f2(P.hips)} m`);
    F.verdict(lean.men.length === 2 && lean.men.every(m => m.leanAsked && m.fin) && [lean, deep].every(o => o.men.every(m => !m.lean0)) && !pie.men.some(m => m.leanAsked) && deep.men.length === 2 && deep.men.every(m => m.walked + 1 === m.stations && m.knee > 0.9 && m.fin) && stoodAll(deep) && deepSq.men.every(m => m.walked + 1 === m.stations && m.knee < 0.1) && pie.men.every(m => m.knee < 0.1)
      && deep.men.every((m, i) => m.lead > (deepSq.men[i]?.lead ?? 9) + 0.05) && [lean, deep].every(o => o.men.every(m => m.leanAfter === 0 && m.kneeAfter < 0.1)) && outside(lean) && lean.lost === 0 && lean.unseen <= pie.unseen + 2 && lean.told < DOORTOOLS.thrCap - 2,
      'with the lean on every cut is taken leaned (his first spot, the diagonal, square as ever) — over the same cuts each man\'s head gets further past his own hips toward the middle of the door than it does square — and, the floor\'s model taken away so that every cut is walked, the cuts that look down the door\'s own line are taken on a knee (square: nobody leans or kneels); once the door is held every man stands square again; the man in the middle is dropped from outside this way too, nobody lost, no more floor left unseen',
      `leaned: ${lean.men.map(m => `${m.name} ${m.leanAsked}`).join(', ')} · head past his hips toward the middle, every cut walked: ${deep.men.map((m, i) => `${f2(m.lead)} m against ${f2(deepSq.men[i]?.lead ?? NaN)} square`).join(', ')} · every cut walked: knee ${deep.men.map(m => `${m.name} ${f2(m.knee)} at ${m.walked + 1} of ${m.stations}`).join(', ')} (square ${deepSq.men.map(m => f2(m.knee)).join(', ')}) · after: lean ${lean.men.map(m => m.leanAfter).join(', ')}, knee ${lean.men.map(m => f2(m.kneeAfter)).join(', ')} · seen ${lean.foeSeen}, down ${lean.foeDown} · lost ${lean.lost} · ${lean.unseen} of ${lean.cells} cells unseen (square ${pie.unseen}) · told at ${f2(lean.told)} s`);
    F.verdict(worded.word.given && worded.word.phase !== 'thr' && worded.word.bent.length === 0,
      'the word given while a man is mid-cut on a knee: the order goes on, and four seconds later nobody outside the frame is still leaned or kneeling',
      `the word given ${worded.word.given} · the order then: ${worded.word.phase} · still bent outside: ${worded.word.bent.join(', ') || 'nobody'}`);
    // (4) an old recording, the page's flags
    { const JOURNAL = await import(`${ROOT}/src/game/journal.ts`) as any, { pageSwitches } = await import(`${ROOT}/src/host/profile.ts`) as any, g = lean.g, snap = () => JSON.parse(JSON.stringify(JOURNAL.knobsSnapshot(g)));
      DOORTOOLS.thrPie = DOORTOOLS.thrLean = true; const old = snap(); delete old.tables.DOORTOOLS.thrPie; delete old.tables.DOORTOOLS.thrLean; JOURNAL.applyKnobs(g, old); const without = [DOORTOOLS.thrPie, DOORTOOLS.thrLean];
      DOORTOOLS.thrPie = DOORTOOLS.thrLean = true; const own = snap(); DOORTOOLS.thrPie = DOORTOOLS.thrLean = false; JOURNAL.applyKnobs(g, own); const withIt = [DOORTOOLS.thrPie, DOORTOOLS.thrLean];
      let a: unknown[] = ['no pageSwitches'], b: unknown[] = a; if (typeof pageSwitches === 'function') { pageSwitches(new URLSearchParams('')); a = [DOORTOOLS.thrPie, DOORTOOLS.thrLean]; pageSwitches(new URLSearchParams('thrpie=0&thrlean=0')); b = [DOORTOOLS.thrPie, DOORTOOLS.thrLean]; }
      F.verdict(without.every(v => v === false) && withIt.every(v => v === true) && a.every(v => v === true) && b.every(v => v === false),
        'a recording from before the keys replays with both off (journal.ts applyKnobs), one that carries them keeps them; the page opens with both on and ?thrpie=0 / ?thrlean=0 put them off',
        `applyKnobs with no keys → ${without} · with them → ${withIt} · the page → ${a} · the flags → ${b}`); }
  } finally { knobsBack(knobs0); DOORTOOLS.thrPie = keep.p; DOORTOOLS.thrLean = keep.l; }
  return F.done();
});

if (import.meta.main) process.exit((await thrpieCheck()) ? 0 : 1);
