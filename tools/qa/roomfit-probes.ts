// A SPOT THAT FITS THE ROOM — the checks for src/game/roomfit.ts ('move there' deals each man a place and a watch from the room's ways in and what is cleared
// beyond them, where it was a line abreast with every man facing Sam's way). Run through tools/qa/probes.ts (family `roomfit`):
//   roomfit-rooms     every level in levels/, a point in every room, 2 / 3 / 4 men, nothing but Sam's start known: the fitted deal against the line abreast, by
//                     the counts of roomfit-map.ts — no mark in a frame, a body's room between marks, nobody further than the spread, far fewer men in a mate's
//                     line, more walls at backs, and the uncleared ways in sight watched where the line watched a fraction of them
//   roomfit-cleared   "what's cleared and what isn't": the same deal again after the floor beyond a watched way has been stood on — where an uncleared way had
//                     gone unwatched for want of a man, the gun is on it now
//   roomfit-walk      the order given in the office (the night breach's pair, then the four): they step off at once with nothing named, arrive each on his
//                     own mark, 'set.' once, each gun on what he was dealt, the row says what, nobody drifts; a man whose watch comes to weigh nothing looks
//                     again and his gun — never his feet — moves on
//   roomfit-off       ROOMFIT.on false: the same order is the line abreast it was (orders.ts spotsAt's own marks, Sam's facing, 'in position'), and a switch
//                     thrown while they stand puts the guns back
import { readdirSync } from 'node:fs';
import { standUp, ROOT } from './headless.ts';
import { stand, roomPoints, deals, measure, ZERO, add, line, type Counts } from './roomfit-map.ts';
const { NIGHTBREACH } = await import(`${ROOT}/src/game/nightbreach.ts`);
const { ORDERS } = await import(`${ROOT}/src/game/orders.ts`);
const { ROOMFIT, ROOMFIT_STATS, fitSpots } = await import(`${ROOT}/src/game/roomfit.ts`);
const { roomRead } = await import(`${ROOT}/src/game/roomread.ts`);

const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x));
const at = (p: number[]) => `(${f2(p[0])}, ${f2(p[2])})`;
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const NB_DEFAULTS = { ...NIGHTBREACH }, FIT_DEFAULTS = { ...ROOMFIT };
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const yawTo = (a: number[], b: number[]) => Math.atan2(b[0] - a[0], b[2] - a[2]);
const guarded = (fn: () => Promise<boolean>) => async () => { try { return await fn(); } finally { Object.assign(NIGHTBREACH, NB_DEFAULTS); Object.assign(ROOMFIT, FIT_DEFAULTS); } };

/** the levels a squad can be sent about in (the office's texel / relief twins are the office again) */
const LEVELS = readdirSync(`${ROOT}/levels`).filter(f => f.endsWith('.json') && !/^office-|\.lint\.json$/.test(f)).sort();

export const roomfitRooms = guarded(async () => {
  const { verdict, done } = family('roomfit-rooms: a point in every room of every level — the fitted deal against the line abreast');
  const T: Record<number, { fit: Counts; line: Counts; none: number; pts: number }> = {}; for (const n of [2, 3, 4]) T[n] = { fit: ZERO(), line: ZERO(), none: 0, pts: 0 };
  const bad: string[] = [], fell: string[] = []; let levels = 0;
  for (const file of LEVELS) {
    let W: any; try { W = await stand(`levels/${file}`, 4); } catch (e) { fell.push(`${file}: ${String((e as Error).message).slice(0, 80)}`); continue; }
    const g = W.game, from = [...g.player.char.pos]; g.cleared.mark(from); levels++;
    const L: string[] = [];
    for (const n of [2, 3, 4]) { const lf = ZERO(), ll = ZERO(); let none = 0;
      for (const P of roomPoints(g)) { const D = deals(g, P.at, from, n), cl = measure(g, P.at, from, D.line); T[n].pts++;
        if (!D.fit) { none++; T[n].none++; continue; }
        const cf = measure(g, P.at, from, D.fit); add(lf, cf); add(ll, cl);
        const spread = ROOMFIT.spread0 + ROOMFIT.spreadPer * n;
        if (cf.inFrame || cf.minGap < ROOMFIT.apart - 0.01 || cf.far > spread + 0.01) bad.push(`${file} room ${P.room} ${n} men: in a frame ${cf.inFrame} · nearest two ${f2(cf.minGap)} · furthest ${f2(cf.far)}`); }
      add(T[n].fit, lf); add(T[n].line, ll);
      L.push(`${n}: lanes ${lf.lanes}/${ll.lanes} · backs ${lf.backed}/${ll.backed} · uncleared watched ${lf.unclearedWatched}/${ll.unclearedWatched} of ${lf.unclearedWays}${none ? ` · ${none} no deal` : ''}`); }
    console.log(`    ${file.padEnd(22)} ${L.join('  |  ')}   (fitted/abreast)`);
  }
  for (const n of [2, 3, 4]) console.log(`    ${n} men · ${T[n].pts} points\n      fitted:  ${line(T[n].fit)}${T[n].none ? ` · ${T[n].none} points with no deal` : ''}\n      abreast: ${line(T[n].line)}`);
  verdict(levels === LEVELS.length && levels >= 20 && bad.length === 0, 'every level in levels/ stands; every fitted mark is off every frame and leaf, a body\'s room from the next, and no further from the point than the spread', `${levels} of ${LEVELS.length} levels${fell.length ? ` · DID NOT STAND: ${fell.join(' ; ')}` : ''} · ${bad.length ? bad.slice(0, 6).join(' ; ') : 'none out'}`);
  verdict([2, 3, 4].every(n => T[n].none <= T[n].pts * 0.1), 'nine points in ten and more have a deal (the rest — a cupboard with no floor for the men — fall back to the line)', [2, 3, 4].map(n => `${n} men: ${T[n].none} of ${T[n].pts} with none`).join(' · '));
  verdict([2, 3, 4].every(n => T[n].fit.lanes <= Math.max(2, T[n].line.lanes * 0.1)), 'a mate in a man\'s line: a tenth of the line abreast\'s at most', [2, 3, 4].map(n => `${n} men: ${T[n].fit.lanes} against ${T[n].line.lanes}`).join(' · '));
  verdict([2, 3, 4].every(n => T[n].fit.backed >= T[n].line.backed * 2), 'twice the men and more with a wall or a desk at their back', [2, 3, 4].map(n => `${n} men: ${T[n].fit.backed} against ${T[n].line.backed} of ${T[n].fit.men}`).join(' · '));
  verdict([2, 3, 4].every(n => T[n].fit.unclearedWatched >= T[n].line.unclearedWatched * 2) && T[4].fit.unclearedWatched >= T[4].fit.unclearedWays * 0.9 && T[2].fit.unclearedWatched >= T[2].fit.unclearedWays * 0.6,
    'the uncleared ways in sight have a gun on them: nine in ten with four men, six in ten and more with two (the line abreast: a fraction)', [2, 3, 4].map(n => `${n} men: ${T[n].fit.unclearedWatched} of ${T[n].fit.unclearedWays} against ${T[n].line.unclearedWatched} of ${T[n].line.unclearedWays}`).join(' · '));
  verdict([2, 3, 4].every(n => T[n].fit.inFunnelUncleared <= T[n].line.inFunnelUncleared * 0.9 && T[n].fit.inFunnel <= T[n].line.inFunnel * 0.5), 'half the men, at most, stood in the funnel of a way in — and fewer in an open, uncleared one\'s (with the rooms furnished, as the page ships them, there is less floor out of those: seven to eight tenths of the line\'s, where bare rooms gave six)', [2, 3, 4].map(n => `${n} men: ${T[n].fit.inFunnel} (${T[n].fit.inFunnelUncleared} uncleared) against ${T[n].line.inFunnel} (${T[n].line.inFunnelUncleared})`).join(' · '));
  return done();
});

export const roomfitCleared = guarded(async () => {
  const { verdict, done } = family('roomfit-cleared: what is cleared and what is not moves the guns');
  let cases = 0, moved = 0, ways = 0, worse = 0, kept = 0, fell = 0; const eg: string[] = [];
  for (const file of LEVELS) {
    let W: any; try { W = await stand(`levels/${file}`, 4); } catch { fell++; continue; }
    const g = W.game, from = [...g.player.char.pos]; g.cleared.mark(from);
    for (const P of roomPoints(g)) {
      const R = roomRead(g, P.at, ROOMFIT.reach, from), unc = R.ways.filter((w: any) => !w.farKnown && !w.locked && w.dist <= ROOMFIT.reach); if (unc.length < 3) continue;
      const D1 = fitSpots(g, P.at, 2, yawTo(from, P.at), from); if (!D1) continue;
      const on = unc.filter((w: any) => D1.some((f: any) => f.key === w.o.id)), free = unc.filter((w: any) => !on.includes(w)); if (on.length !== 2 || !free.length) continue;
      // the floor beyond the heavier of the two watched ways is stood on: is it a room of its own (not the one the point is in, nor the other ways')
      const w0 = on[0], room = w0.far; if (!room || room === R.room || unc.some((w: any) => w !== w0 && w.far === room)) continue;
      const before = g.cleared.known; g.cleared.mark(w0.beyond); if (g.cleared.known === before) continue;
      cases++;
      const D2 = fitSpots(g, P.at, 2, yawTo(from, P.at), from); if (!D2) { worse++; continue; }
      const now = unc.filter((w: any) => D2.some((f: any) => f.key === w.o.id));
      const k1 = D1.map((f: any) => f.key), toWay = now.some((w: any) => free.includes(w)); if (toWay) ways++;
      if (!now.includes(w0) && D2.some((f: any) => f.key && !k1.includes(f.key))) { moved++; if (eg.length < 4) eg.push(`${file} room ${P.room}: ${D1.map((f: any) => f.key).join(' + ')} → ${D2.map((f: any) => f.key).join(' + ')} once ${w0.o.id} was known`); }
      else { if (now.includes(w0)) kept++; if (process.argv.includes('--verbose')) console.log(`    not moved: ${file} room ${P.room} ${at(P.at)}: ${D1.map((f: any) => `${f.key} ${f2(f.w)}`).join(' + ')} → ${D2.map((f: any) => `${f.key} ${f2(f.w)}`).join(' + ')} once ${w0.o.id} was known · free were ${free.map((w: any) => `${w.o.id} ${f2(w.dist)} m`).join(', ')}`); }
    }
  }
  verdict(fell === 0 && cases >= 8 && moved === cases && ways >= cases * 0.4 && kept === 0 && worse === 0, 'two men, three uncleared ways and more: once the floor beyond one they watched is known, its gun is on something nobody had looked at — another uncleared way, or a long stretch of floor nobody has stood on (a hall\'s length outweighs a third door down its side)', `${cases} cases · the gun moved on ${moved} (to an uncleared way ${ways}) · stayed on the known one ${kept} · no deal ${worse}\n    ${eg.join('\n    ')}`);
  return done();
});

/** the office under a seed, the night breach's squad staged (two, or four), the defenders kept dazzled */
async function rig(seed: number, squad: 2 | 4) {
  Object.assign(NIGHTBREACH, NB_DEFAULTS, { blindFire: false, squad });
  Math.random = seeded(seed);
  const W: any = await standUp(); const game = W.game, NB = game.nightBreach, O = game.orders, input = W.input; game.godMode = true;
  const why = NB.start(); const heard = new WeakSet<any>();
  const R = { W, game, NB, O, input, why, said: [] as { who: string; text: string; t: number }[],
    step(n = 1) { for (let i = 0; i < n; i++) { game.player.visibility = 0.05; for (const h of NB.hostiles) if (h.state !== 'dead') h.dazzledUntil = game.time + 5; W.step(DT);
      for (const gd of game.guards) { const b = gd.bubble; if (b && !heard.has(b)) { heard.add(b); R.said.push({ who: gd.callsign, text: b.text, t: game.time }); } } } },
    until(pred: () => boolean, secs: number) { for (let i = 0; i < secs * 60 && !pred(); i++) R.step(); return pred(); },
    quick(p: number[]) { W.cursorAt([p[0], p[1], p[2]]); input.pressed.add(ORDERS.quickKey); R.step(); },
    lines(text: RegExp, since = 0) { return R.said.filter(s => s.t >= since && text.test(s.text)); } };
  return R;
}
// open floor on the aisle east of where the squad is staged, in plain view of the camera (orders-probes.ts's own point), and one further on by the break room's door
const AISLE: number[] = [15, 0, 17.6], AISLE_FAR: number[] = [21, 0, 17.6];
const gunYaw = (m: any) => m.char.aimYaw ?? m.char.bodyYaw;

export const roomfitWalk = guarded(async () => {
  const { verdict, done } = family('roomfit-walk: the order given, walked and stood — each man on his own mark with his gun on what he was dealt');
  for (const squad of [2, 4] as const) for (const P of [AISLE, AISLE_FAR]) {
    const R = await rig(11 + squad, squad); const { game: g, O } = R; const men: any[] = O.squad(); const sam = g.player.char; const tag = `${squad} men to ${at(P)}`;
    R.step(30); const from = men.map(m => [...m.char.pos]), t0 = g.time, moved0 = ROOMFIT_STATS.moved;
    R.quick(P); const A = men.map(m => O.of(m)), fits = A.map(a => a?.fit);
    const dealt = A.every(a => a?.order === 'move' && a.fit && a.post) && A.every(a => a.watch == null && a.face != null && Math.abs(wrap(a.face - yawTo(sam.pos, P))) < 0.05);
    R.step(20); const early = men.map((m, i) => dist(m.char.pos, from[i]));
    verdict(dealt && early.every(d => d > 0.05), `${tag}: every man has a mark and a watch dealt, nothing is named until he is there (the walk is the gun-up walk it was), and they step off at once`, `orders ${A.map(a => a?.order ?? '—').join(' ')} · moved after a third of a second ${early.map(f2).join(' / ')} m`);
    const set = R.until(() => men.every(m => O.of(m)?.arrived), 14), tSet = g.time - t0; R.step(90);
    const posts = A.map(a => a.post), dPost = men.map((m, i) => dist(m.char.pos, posts[i])), dAt = posts.map(p => dist(p, P)); let gap = Infinity; for (let i = 0; i < men.length; i++) for (let j = i + 1; j < men.length; j++) gap = Math.min(gap, dist(men[i].char.pos, men[j].char.pos));
    const spread = ROOMFIT.spread0 + ROOMFIT.spreadPer * squad;
    verdict(set && dPost.every(d => d < 0.35) && dAt.every(d => d <= spread + 0.01) && gap > ROOMFIT.apart - 0.3, `${tag}: all arrive, each on his own mark, the marks round the point and a body's room apart`, `in ${f2(tSet)} s · off his mark ${dPost.map(f2).join(' / ')} m · marks off the point ${dAt.map(f2).join(' / ')} m (≤ ${f2(spread)}) · nearest two ${f2(gap)} m`);
    const watching = men.map((m, i) => { const F = fits[i]; return F.on && (!F.watch || Math.abs(wrap(yawTo(m.char.pos, F.watch) - gunYaw(m))) < 0.35); });
    const rows = men.map(m => O.statusOf(m)), keys = fits.map(f => f.key), ways = keys.filter(k => k && !/^(floor|run):/.test(k));
    verdict(watching.every(Boolean) && rows.every((r, i) => fits[i].words ? r === `in position · ${fits[i].words}` : r === 'in position') && new Set(ways).size >= Math.min(ways.length, 2),
      `${tag}: stood, each gun is on what he was dealt and his row says what; no two on one way while there were ways for both`, `${men.map((m, i) => `${m.callsign} ${at(m.char.pos)} ${rows[i]}`).join(' · ')}`);
    const sets = R.lines(/^set\.$/, t0);
    const here = men.map(m => [...m.char.pos]); R.step(60 * 6); const drift = men.map((m, i) => dist(m.char.pos, here[i]));
    verdict(sets.length === 1 && R.lines(/^set\.$/, t0).length === 1 && drift.every(d => d < 0.1), `${tag}: "set." once, and six seconds on nobody has shifted or said it again`, `${sets.map(s => `${s.who} @${f2(s.t - t0)} s`).join(', ') || 'never'} · drift ${drift.map(f2).join(' / ')} m`);
    // a man whose watch has come to weigh next to nothing (what the floor beyond it becoming known does — roomfit-cleared holds the weights) looks again
    // within the second: with two men there are ways nobody is on, and his gun — never his feet — goes to the heaviest of them he has a line to
    if (squad === 2) { const F = fits[0], k0 = F.key, p0 = men.map(m => [...m.char.pos]); F.key = 'run:0'; F.w = 0.001; F.words = 'watching nothing much'; F.sig = '';
      R.step(60 * 3); const still = men.map((m, i) => dist(m.char.pos, p0[i])), gun = !!F.watch && Math.abs(wrap(yawTo(men[0].char.pos, F.watch) - gunYaw(men[0]))) < 0.35;
      verdict(still.every(d => d < 0.1) && ROOMFIT_STATS.moved === moved0 + 1 && !!F.key && !/^run:/.test(F.key) && F.key !== fits[1].key && F.w > 0.02 && gun && O.statusOf(men[0]) === `in position · ${F.words}`,
        `${tag}: a man whose watch has come to weigh nothing looks again inside three seconds — his gun, never his feet, goes to the heaviest thing nobody is on`, `${men[0].callsign}: ${k0} → run:0 (by hand) → ${F.key} (${f2(F.w)}) · his mate is on ${fits[1].key} · guns moved ${ROOMFIT_STATS.moved - moved0} · feet ${still.map(f2).join(' / ')} m · row "${O.statusOf(men[0])}"`); }
  }
  // one pair sent, then the other to the same spot: the second deal keeps the first pair's room and takes what the first is not on
  { const R = await rig(21, 4); const { O } = R; const men: any[] = O.squad(), red: any[] = O.men('red'), blue: any[] = O.men('blue'); R.step(30);
    const why1 = O.give('move', O.targetAt(AISLE_FAR), 'red'); R.until(() => red.every(m => O.of(m)?.arrived), 14); R.step(60); const r0 = red.map(m => [...m.char.pos]), rk = red.map(m => O.of(m)?.fit?.key);
    const why2 = O.give('move', O.targetAt([AISLE_FAR[0] - 0.8, 0, AISLE_FAR[2] + 0.2]), 'blue'); /* (a stride off it: on the point itself the cursor is on a man) */ const set = R.until(() => blue.every(m => O.of(m)?.arrived), 14); R.step(90);
    const keys = men.map(m => O.of(m)?.fit?.key ?? null), bk = blue.map(m => O.of(m)?.fit?.key), shared = bk.filter(k => k && !/^(floor|run):/.test(k) && rk.includes(k)).length;
    let gap = Infinity; for (let i = 0; i < men.length; i++) for (let j = i + 1; j < men.length; j++) gap = Math.min(gap, dist(men[i].char.pos, men[j].char.pos));
    const stayed = red.map((m, i) => dist(m.char.pos, r0[i]));
    verdict(why1 === null && why2 === null && red.length === 2 && blue.length === 2 && set && shared === 0 && new Set(keys.filter(Boolean)).size === 4 && gap > ROOMFIT.apart - 0.3 && stayed.every(d => d < 0.6) && red.every((m, i) => O.of(m)?.fit?.key === rk[i]),
      'red sent to a spot, then blue to the same spot: blue takes marks clear of red and ways red is not on; red keeps its marks and its watches', `give → ${why1} / ${why2} · ${men.map((m, i) => `${m.callsign} ${at(m.char.pos)} ${keys[i]}`).join(' · ')} · nearest two ${f2(gap)} m · red moved ${stayed.map(f2).join(' / ')} m`); }
  return done();
});

/** A HALL'S OWN LENGTH (the missions goal's hall, 10-11: four doors off a long bare hall, 'move there' dealt all four men a door and nobody the hall, where a gun
 *  stood at its far end): wherever four men are sent to a point with a clear run of 12 m and more along a bearing, somebody's gun is within 40° of that run —
 *  counted over every level, against the rule as it first shipped (`sectorAcross` 0: any door near the run's bearing stood for it, a side door included). */
export const roomfitHall = guarded(async () => {
  const { verdict, done } = family('roomfit-hall: a long clear run from the point has a gun down it');
  const count = async (across: number) => { let runs = 0, bare = 0; const eg: string[] = []; ROOMFIT.sectorAcross = across;
    for (const file of LEVELS) {
      let W: any; try { W = await stand(`levels/${file}`, 4); } catch { continue; } const g = W.game, from = [...g.player.char.pos], B = 24, step = 2 * Math.PI / B;
      for (const P of roomPoints(g)) {
        const D = fitSpots(g, P.at, 4, yawTo(from, P.at), from); if (!D) continue;
        const run: number[] = []; for (let b = 0; b < B; b++) { const hit = g.col.raycast([P.at[0], 1.55, P.at[2]], [Math.sin(b * step), 0, Math.cos(b * step)], 14); run.push(hit ? hit.t : 14); }
        for (let b = 0; b < B; b++) { if (run[b] < 12 || run[(b + 1) % B] > run[b] || run[(b + B - 1) % B] >= run[b]) continue;   // (a peak: one run, one count)
          runs++; if (D.some((f: any) => f.watch && Math.abs(wrap(yawTo(f.pos, f.watch) - b * step)) < 40 * Math.PI / 180)) continue;
          bare++; if (eg.length < 3) eg.push(`${file} room ${P.room} ${at(P.at)} bearing ${Math.round(b * 15)}°: ${D.map((f: any) => f.key ?? '—').join(' + ')}`); }
      }
    }
    return { runs, bare, eg }; };
  const was = await count(0), now = await count(FIT_DEFAULTS.sectorAcross);
  verdict(now.runs >= 20 && now.bare <= now.runs * 0.15 && now.bare <= was.bare * 0.6, 'four men sent to a point with 12 m and more of clear floor along a bearing: a gun is down that run in six cases of seven and more, and the runs left bare are well under those of the first rule (a side door near the bearing stood for the run)', `${now.runs} long runs · nobody within 40° of it: ${now.bare} (first rule: ${was.bare} of ${was.runs})${now.eg.length ? `\n    still bare: ${now.eg.join('\n    ')}` : ''}`);
  return done();
});

export const roomfitOff = guarded(async () => {
  const { verdict, done } = family('roomfit-off: ROOMFIT.on false — the line abreast it was');
  for (const squad of [2, 4] as const) {
    ROOMFIT.on = false; const R = await rig(11 + squad, squad); const { game: g, O } = R; const men: any[] = O.squad(); const sam = g.player.char;
    R.step(30); const s0 = [...sam.pos]; R.quick(AISLE); const aimed = [...g.aimPoint], face = yawTo(s0, aimed), A = men.map(m => O.of(m)), posts = A.map(a => [...(a?.post ?? [NaN, 0, NaN])]);
    const spots: number[][] = O.spotsAt(aimed, face, men.length), onLine = A.every((a, i) => a?.order === 'move' && !a.fit && spots.some(s => dist(s, posts[i]) < 0.03));
    const set = R.until(() => men.every(m => O.of(m)?.arrived), 14); R.step(60);
    const dYaw = men.map(m => Math.abs(wrap(m.char.bodyYaw - face)));
    verdict(onLine && set && dYaw.every(d => d < 0.3) && men.every(m => O.statusOf(m) === 'in position') && A.every(a => a.watch == null), `${squad} men: the marks are spotsAt's line abreast, every man faces the way Sam pointed, the row is "in position", nothing is watched`,
      `posts ${posts.map(at).join(' ')} · line ${spots.map(at).join(' ')} · off the heading ${dYaw.map(f2).join(' / ')} rad · ${men.map(m => O.statusOf(m)).join(' / ')}`);
  }
  // … and thrown while they stand under a fitted deal: the guns come back to Sam's facing, the rows to 'in position', the feet stay
  ROOMFIT.on = true; const R = await rig(15, 4); const { game: g, O } = R; const men: any[] = O.squad(); R.step(30); R.quick(AISLE);
  R.until(() => men.every(m => O.of(m)?.arrived), 14); R.step(90); const had = men.filter(m => O.of(m).fit?.on && O.of(m).watch).length, p0 = men.map(m => [...m.char.pos]);
  ROOMFIT.on = false; R.step(120);
  const face = yawTo(g.player.char.pos, AISLE), back = men.every(m => { const a = O.of(m); return !a.fit && a.watch == null && O.statusOf(m) === 'in position'; }), feet = men.map((m, i) => dist(m.char.pos, p0[i]));
  verdict(had >= 2 && back && feet.every(d => d < 0.1), 'the switch thrown while they stand: every watch is dropped, the rows read "in position", nobody walks', `${had} men had a watch · rows ${men.map(m => O.statusOf(m)).join(' / ')} · feet ${feet.map(f2).join(' / ')} m · Sam\'s facing ${f2(face)}`);
  return done();
});
