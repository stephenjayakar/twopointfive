// The 'needs' probe family (run through probes.ts: `bun run tools/qa/probes.ts needs | needs-determinism | needs-telegraph | needs-one-away | needs-interrupts |
// needs-frozen | needs-identity [--verbose] [--print]`): the needs-driven patrol variation of src/game/needs.ts — STATUS E12 (c) 'i actually really like the
// needs driven patrol variation, especially if it's telegraphed like fear!'. Each stands the full game up headless (headless.ts), stages one situation, steps it,
// prints what happened, PASS / FAIL.
//   needs-determinism  the same seeded five minutes twice (fill ×4, Sam unseen): the same men schedule the same kinds on the same frames, leave and come back on the
//                      same frames — the deal and the clocks hang off callsigns and game time, not the dice.
//   needs-telegraph    Kowalski waiting at the corridor's east end with his coffee full and Reyes stood eight metres up the corridor: the whole beat measured — the
//                      watch check at T−20 (the arm's weight over ½ for ½ s and more) with the glance the way he will go, the line to Reyes at T−12 from the pool and
//                      Reyes's answer 1.5 s later, the neck rub at T−5 and the turn, the first step at T (±0.3 s), the counter reached, the dwell within a second of
//                      the knob, back onto the SAME waypoint with the wait he had left, the route resumed (the next waypoint's index); then again with nobody in
//                      earshot: the line goes over the net in the radio's words.
//   needs-one-away     Kowalski and Novak both full and both standing at their waypoints: one goes, the other never has a trip while the first has one, and gets his
//                      the moment the first is back (the floor's gap permitting).
//   needs-interrupts   a whistle at T−8 (he answers it: no departure, ever, and he goes to look); a gunshot with him halfway to the counter (broken off inside two
//                      frames where he stands — off his route — and in the two minutes after, calm or not, the trip never comes back); frozen — no trip dealt in a
//                      minute of full needs at the waypoints — under quietUtility, with the response team not idle, and through a whole headless lap of the showcase tour.
//   needs-frozen-up    the floor at heightened: a minute of full needs at the waypoints deals nothing and the send button refuses; stood down, the next frame deals.
//   needs-identity     tune.needs = false: a seeded sixty seconds of the calm night patrol (three men on their routes, Sam parked unseen off the map's corner) — with
//                      the fill rate that would, needs ON, have a man scheduling a trip inside the first seconds — digested frame by frame against the digest FROZEN
//                      on the tree before needs.ts existed: the off path is the old patrol, byte for byte. `--print` re-measures the literal.
import { standUp, ROOT } from './headless.ts';
const { v3, wrapAngle } = await import(`${ROOT}/src/math/vec.ts`);

type Vec3 = [number, number, number];
const DT = 1 / 60;
const VERBOSE = process.argv.includes('--verbose');
const PRINT = process.argv.includes('--print');
const f1 = (x: number) => x.toFixed(1), f2 = (x: number) => x.toFixed(2);
const posS = (p: Vec3 | null | undefined) => p ? `(${f1(p[0])}, ${f1(p[2])})` : '—';
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function verdict(ok: boolean, label: string, detail: string) { console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}: ${detail}`); return ok; }

/** FNV-1a over strings, 32 bits, chained: the digest of a run */
class Digest {
  h = 0x811c9dc5 >>> 0; n = 0;
  add(s: string) { for (let i = 0; i < s.length; i++) { this.h ^= s.charCodeAt(i); this.h = Math.imul(this.h, 0x01000193) >>> 0; } this.n++; }
  num(x: number | null | undefined) { this.add(x === null || x === undefined ? '~' : String(x)); }
  vec(p: number[] | null | undefined) { if (!p) { this.add('~'); return; } this.num(p[0]); this.num(p[1]); this.num(p[2]); }
  get hex() { return this.h.toString(16).padStart(8, '0'); }
}

/** the needs module if this tree has it (the identity run below must load and pass on a tree from before it) */
async function needsModule(): Promise<any | null> { try { return await import(`${ROOT}/src/game/needs.ts`); } catch { return null; } }

// ================================================================ (e) identity: tune.needs off is the old patrol, byte for byte
/** Sixty seeded seconds of the calm floor exactly as a player who never shows himself leaves it: Kowalski, Novak and Reyes walking their routes, waiting at their
 *  waypoints, the ambient pair chatter and the handler's radio free to happen as they do — Sam parked out on the verge, invisible and inaudible. With needs ON at
 *  fifty times the fill rate a man would be over his threshold and standing at a two-second waypoint (Kowalski starts on one) inside the first frames, so the whole
 *  telegraph and a departure would fall inside the minute; with them OFF nothing of it may exist. Every frame: each man's state, position, body / aim yaw, aim
 *  pitch, awareness, waypoint, wait clock, path, speed, the neck's extra yaw, his bubble's text; Sam's position; the event and message counts; the alarm level;
 *  every leaf's angle. */
async function identityRun(): Promise<{ digest: string; frames: number; states: string }> {
  Math.random = seeded(4401);
  const W = await standUp(); const { game } = W; const pl = game.player;
  game.godMode = true; game.aiEnabled = true;
  (game.tune as any).needs = false;   // (a plain property on a tree from before needs.ts: nothing reads it there)
  if ((game as any).civilians) { (game.tune as any).civilians = false; (game as any).civilians.length = 0; }   // (the civilians — a later actor on the floor, src/game/civilians.ts — are not part of this card: its digest was frozen on a floor without them, and its claim is about THIS switch; their own identity card is probes.ts civilians-identity. Their construction drew nothing from the dice, so nothing else here moves.)
  const N = await needsModule(); const rate0 = N?.NEEDS?.rateK;
  if (N?.NEEDS) N.NEEDS.rateK = 50;   // (would have a trip scheduled inside seconds with the switch on — off, it must not matter)
  for (let i = 0; i < 5; i++) W.step(DT);
  game.teleportPlayer([2.0, 0, 2.0]); game.playerInvisible = true; pl.crouch = true;
  const D = new Digest(); let states = '';
  const FRAMES = 60 * 60;
  for (let frame = 0; frame < FRAMES; frame++) {
    pl.visibility = 0.02; W.step(DT);
    for (const gd of game.guards) { D.add(gd.state); D.vec(gd.char.pos); D.num(gd.char.bodyYaw); D.num(gd.char.aimYaw); D.num(gd.char.aimPitch); D.num(gd.awareness); D.num(gd.wp); D.num(gd.wait); D.num(gd.path.length); D.num(gd.pathI); D.num(gd.speed); D.num(gd.char.anim.lookYawExtra); D.add(gd.bubble ? gd.bubble.text : '~'); D.num(gd.hold ? 1 : 0); }
    D.vec(pl.char.pos); D.num(game.events.length); D.num(game.messages.length); D.num(game.escalation);
    for (const d of game.doors.list) D.num(d.angle);
    if (frame % 300 === 0) states += game.guards.map((g: any) => `${g.state[0]}${g.wp}`).join('') + ' ';
    if (VERBOSE && frame % 120 === 0) console.log(`    ${f1(game.time)}s ` + game.guards.map((g: any) => `${g.callsign} ${g.state} ${posS(g.char.pos)} wp ${g.wp} wait ${f2(g.wait)} path ${g.pathI}/${g.path.length}${g.hold ? ' HOLD' : ''}${g.bubble && game.time - g.bubble.t < g.bubble.dur ? ` "${g.bubble.text}"` : ''}`).join(' | '));
  }
  if (N?.NEEDS && rate0 !== undefined) N.NEEDS.rateK = rate0;
  return { digest: D.hex, frames: FRAMES, states };
}
export async function needsIdentity() {
  console.log('\n=== needs-identity: tune.needs off — a seeded 60 s of the calm patrol (fill rate ×50: needs ON would schedule a trip in seconds), digested frame by frame against the digest frozen before needs.ts ===');
  const R = await identityRun();
  if (PRINT) console.log(`\n--- measured (paste over EXPECT_IDENTITY) ---\nconst EXPECT_IDENTITY = ${JSON.stringify({ digest: R.digest, frames: R.frames, states: R.states })};\n`);
  const E = EXPECT_IDENTITY; let allPass = true;
  allPass = verdict(R.states === E.states, 'states + waypoints every 5 s as they were', `${R.states.trim()}${R.states === E.states ? '' : ` — want ${E.states.trim()}`}`) && allPass;
  allPass = verdict(R.digest === E.digest && R.frames === E.frames, 'the per-frame digest of everybody\'s state / position / aim / awareness / waypoint / wait / path / neck / bubble, Sam, the events, the messages, the alarm, the leaves', `${R.digest} over ${R.frames} frames${R.digest === E.digest ? '' : ` — want ${E.digest}`}`) && allPass;
  console.log(`=== needs-identity: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}
// frozen on the tree before needs.ts had any behaviour (commit cc33233: main's calm patrol; `needs-identity --print` regenerates the literal)
const EXPECT_IDENTITY = {"digest":"eade1caa","frames":3600,"states":"p0p0p0 p1p1p1 p1p2p2 p1p3p2 p1p4p3 p1p4p3 p1p5p3 p1p6p3 p1p7p3 p1p0p3 p3p1p4 p3p2p4 "};
void v3; void posS;

// ================================================================ shared staging for the behaviour probes (needs.ts imported here, not at the top: the identity run above must load on a tree without it)
const N = await import(`${ROOT}/src/game/needs.ts`);
const { NEEDS, NEED_SPOTS, NEEDS_STATS, NEEDS_LOG, NEEDS_DEBUG, needsTrip, needsMem, needsSetLevel, needsSend } = N;
const { NEEDS_LINES, needsLines } = await import(`${ROOT}/src/game/dialogue.ts`);
const { tryWhistle } = await import(`${ROOT}/src/game/whistle.ts`);
const { PLAYER_ID } = await import(`${ROOT}/src/game/consts.ts`);
const NEEDS0 = JSON.parse(JSON.stringify(NEEDS));
/** every knob back to what the module shipped with (a probe before may have leaned on one) */
function knobsBack() { for (const k of Object.keys(NEEDS0)) { if (k === 'dwell') Object.assign(NEEDS.dwell, NEEDS0.dwell); else (NEEDS as any)[k] = NEEDS0[k]; } }
/** A guard planted at `p` facing yaw, still, no path, posed twice (bones where the sight / sound tests read them). */
function place(gd: any, p: Vec3, yaw: number) { gd.char.pos = v3.copy(p); gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.char.bodyYaw = gd.char.aimYaw = yaw; gd.char.aimPitch = 0; gd.path = []; gd.pathGoal = null; gd.stallRef = null; gd.char.update(0); gd.char.update(DT); }
/** parked out on the lot east of the building — held, blind and deaf (a held man is dealt no trip and never counts as a partner unless within earshot: he is 40 m off) */
function park(gd: any, i: number) { gd.hold = true; gd.pinned = true; gd.dazzledUntil = 1e9; gd.heardUpTo = 1e12; place(gd, [37.5, 0, 6 + i * 1.5], Math.PI / 2); }
/** stand a man AT waypoint `wp` of his route as if he had just walked onto it: wp set, the authored wait (or `wait`) on the clock, calm */
function atWaypoint(gd: any, wp: number, yaw: number, wait?: number) { const p = gd.route.points[wp]; place(gd, p, yaw); gd.wp = wp; gd.wait = wait ?? (gd.route.wait[wp] ?? 0); gd.state = 'patrol'; gd.awareness = 0; gd.hold = false; gd.pinned = false; gd.dazzledUntil = -1; }
/** what everybody says (game.say) and radios from here on */
function tapSay(game: any) {
  const lines: { t: number; who: string; text: string; radio: boolean }[] = [];
  const orig = game.say.bind(game);
  game.say = (gd: any, text: string, radio = false) => { const r = orig(gd, text, radio); if (gd.bubble && gd.bubble.text === text && gd.bubble.t === game.time) lines.push({ t: game.time, who: gd.callsign, text, radio }); return r; };
  return lines;
}
/** the level up off `seed`: god mode, Sam parked unseen out on the verge (his meter pinned dark by the caller each frame), the knobs as shipped, the switch on, the module's log collected */
async function stage(seed: number, opts: { invisible?: boolean } = {}) {
  Math.random = seeded(seed); knobsBack();
  const W = await standUp(); const { game } = W; const pl = game.player;
  game.godMode = true; game.aiEnabled = true; game.tune.needs = true;
  const nlog: string[] = []; NEEDS_DEBUG.log = (s: string) => nlog.push(s);
  for (let i = 0; i < 5; i++) W.step(DT);
  game.teleportPlayer([2.0, 0, 2.0]); game.playerInvisible = opts.invisible ?? true; pl.crouch = true;
  const lines = tapSay(game);
  const [A, B, C] = game.guards;   // Kowalski (corridor), Novak (cubicles), Reyes (lobby / break room)
  return { W, game, pl, A, B, C, lines, nlog, step: (n = 1) => { for (let i = 0; i < n; i++) { pl.visibility = 0.02; W.step(DT); } } };
}
function dumpLog(nlog: string[], n = 40) { if (VERBOSE) console.log('    ' + nlog.slice(-n).join('\n    ')); }
const POOL_ANNOUNCE = new Set<string>(Object.values(NEEDS_LINES.announce as Record<string, string[]>).flat());
const POOL_BACK = new Set<string>(NEEDS_LINES.back);
const replyPool = (others: string[]) => new Set<string>([...NEEDS_LINES.reply, ...others.flatMap((o: string) => NEEDS_LINES.replyOther.map((s: string) => s.replace(/\{other\}/g, o)))]);

// ================================================================ (a) determinism
async function determinismRun(seed: number): Promise<{ events: string[]; frames: number }> {
  const S = await stage(seed); NEEDS.rateK = 4;
  const events: string[] = []; const phase = new Map<any, string>();
  const FRAMES = 60 * 300;
  for (let f = 0; f < FRAMES; f++) {
    S.step();
    for (const gd of S.game.guards) { const T = needsTrip(gd); const ph = T ? `${T.kind}:${T.phase}` : '-'; if (phase.get(gd) !== ph) { if (phase.has(gd) || ph !== '-') events.push(`f${f} ${gd.callsign} ${ph}`); phase.set(gd, ph); } }
  }
  return { events, frames: FRAMES };
}
export async function needsDeterminism() {
  console.log('\n=== needs-determinism: the same seeded five minutes twice at fill ×4 — the same men schedule / leave / arrive / return on the same frames ===');
  const R1 = await determinismRun(1201); const R2 = await determinismRun(1201);
  let allPass = true;
  const same = R1.events.length === R2.events.length && R1.events.every((e, i) => e === R2.events[i]);
  let firstDiff = ''; if (!same) { for (let i = 0; i < Math.max(R1.events.length, R2.events.length); i++) if (R1.events[i] !== R2.events[i]) { firstDiff = `#${i}: "${R1.events[i] ?? '—'}" vs "${R2.events[i] ?? '—'}"`; break; } }
  allPass = verdict(R1.events.length >= 4, 'trips happen at all in five minutes at ×4', `${R1.events.length} phase edges: ${R1.events.slice(0, 10).join(' · ')}${R1.events.length > 10 ? ' …' : ''}`) && allPass;
  allPass = verdict(same, 'run 2 = run 1, edge for edge and frame for frame', same ? `${R2.events.length} edges identical` : `first difference ${firstDiff}`) && allPass;
  console.log(`=== needs-determinism: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}

// ================================================================ (b) the telegraph's timeline, measured
interface Timeline { t0: number; watchAt: number; watchHeld: number; glanceMax: number; sayAt: number; sayText: string; sayRadio: boolean; partner: string | null; replyAt: number; replyText: string; replyWho: string;
  neckAt: number; neckHeld: number; faceErrAtGo: number; goAt: number; arriveAt: number; arrivePos: Vec3 | null; dwellEndAt: number; backAt: number; backPos: Vec3 | null; backText: string; wpAtBack: number; waitAtBack: number; wpLater: number; radioMsg: string; outSecs: number; backSecs: number; }
/** Kowalski put at his corridor east-end waypoint (wp1, wait 3 s) with his coffee full; `partnerAt` = where Reyes stands held (null = parked out of earshot with
 *  Novak). Steps until he is back and his route has moved him on (or 150 s), measuring every beat. */
async function telegraphRun(partnerAt: Vec3 | null): Promise<{ TL: Timeline; S: Awaited<ReturnType<typeof stage>> }> {
  const S = await stage(1301); const { game, A, B, C } = S;
  park(B, 1); if (partnerAt) { place(C, partnerAt, Math.PI / 2); C.hold = true; C.heardUpTo = 1e12; } else park(C, 2);
  atWaypoint(A, 1, Math.PI / 2);   // arrived walking east: the break room's door is back over his right shoulder
  S.step(2);
  if (!needsSetLevel(game, A, 'coffee', 1.2)) throw new Error('Kowalski was not dealt coffee (the deal changed?)');
  const TL: Timeline = { t0: -1, watchAt: -1, watchHeld: 0, glanceMax: 0, sayAt: -1, sayText: '', sayRadio: false, partner: null, replyAt: -1, replyText: '', replyWho: '', neckAt: -1, neckHeld: 0, faceErrAtGo: NaN, goAt: -1, arriveAt: -1, arrivePos: null, dwellEndAt: -1, backAt: -1, backPos: null, backText: '', wpAtBack: -1, waitAtBack: NaN, wpLater: -1, radioMsg: '', outSecs: NaN, backSecs: NaN };
  let prevPhase = '-'; let li = 0; const an = A.char.anim;
  for (let f = 0; f < 60 * 150; f++) {
    S.step();
    const t = game.time; const T = needsTrip(A); const ph = T ? T.phase : '-';
    if (T && TL.t0 < 0) TL.t0 = T.t0;
    if (T && ph === 'telegraph') {
      if (an.telling && an.tellKind === 'watch') { if (TL.watchAt < 0) TL.watchAt = t; if (an.tellShown > 0.5) TL.watchHeld += DT; }
      if (an.telling && an.tellKind === 'neck') { if (TL.neckAt < 0) TL.neckAt = t; if (an.tellShown > 0.5) TL.neckHeld += DT; }
      if (t - TL.t0 < 2.5) TL.glanceMax = Math.max(TL.glanceMax, Math.abs(an.lookYawExtra));
      if (!TL.partner && T.partner) TL.partner = T.partner.callsign;
    }
    if (ph !== prevPhase) {
      if (ph === 'going') { TL.goAt = t; TL.faceErrAtGo = Math.abs(wrapAngle(A.char.bodyYaw - T!.outYaw)); }
      if (ph === 'dwell') { TL.arriveAt = t; TL.arrivePos = v3.copy(A.char.pos); }
      if (ph === 'returning') TL.dwellEndAt = t;
      if (ph === '-' && prevPhase === 'returning') { TL.backAt = t; TL.backPos = v3.copy(A.char.pos); TL.wpAtBack = A.wp; TL.waitAtBack = A.wait; }
      prevPhase = ph;
    }
    for (; li < S.lines.length; li++) { const L = S.lines[li];
      if (L.who === 'Kowalski' && (POOL_ANNOUNCE.has(L.text) || /two minutes,/.test(L.text)) && TL.sayAt < 0) { TL.sayAt = L.t; TL.sayText = L.text; TL.sayRadio = L.radio; }
      else if (L.who !== 'Kowalski' && TL.sayAt >= 0 && TL.replyAt < 0 && replyPool(['Kowalski', 'Novak', 'Reyes']).has(L.text)) { TL.replyAt = L.t; TL.replyText = L.text; TL.replyWho = L.who; }
      else if (L.who === 'Kowalski' && POOL_BACK.has(L.text)) TL.backText = L.text; }
    if (TL.sayAt >= 0 && !TL.radioMsg) { const m = game.messages.find((x: any) => x.t === TL.sayAt && /^radio: /.test(x.text)); if (m) TL.radioMsg = m.text; }
    if (TL.backAt >= 0 && t - TL.backAt > 5) { TL.wpLater = A.wp; break; }
  }
  if (TL.goAt >= 0 && TL.arriveAt >= 0) TL.outSecs = TL.arriveAt - TL.goAt; if (TL.dwellEndAt >= 0 && TL.backAt >= 0) TL.backSecs = TL.backAt - TL.dwellEndAt;
  return { TL, S };
}
export async function needsTelegraph() {
  console.log('\n=== needs-telegraph: Kowalski at the corridor\'s east end, coffee full, Reyes 8 m up the corridor — watch @T−20 + glance, the line @T−12 + Reyes\'s answer, neck @T−5 + turn, walks @T, the counter, the dwell, back to the SAME waypoint, route resumed; then nobody near: over the net ===');
  let allPass = true;
  { const { TL, S } = await telegraphRun([26.5, 0, 11.4]);
    const lead = NEEDS.announceLead, sayLead = NEEDS.sayLead, stretchLead = NEEDS.stretchLead, dwell = NEEDS.dwell.coffee;
    const rel = (x: number) => x < 0 ? '—' : `T${(x - (TL.t0 + lead)) >= 0 ? '+' : ''}${(x - (TL.t0 + lead)).toFixed(2)}`;
    console.log(`    scheduled at ${f2(TL.t0)} s · watch ${rel(TL.watchAt)} (held ${f2(TL.watchHeld)} s, glance ${f2(TL.glanceMax)} rad) · says ${rel(TL.sayAt)} "${TL.sayText}"${TL.sayRadio ? ' (RADIO)' : ''} to ${TL.partner ?? 'nobody'} · answer ${rel(TL.replyAt)} ${TL.replyWho}: "${TL.replyText}" · neck ${rel(TL.neckAt)} (held ${f2(TL.neckHeld)} s) · walks ${rel(TL.goAt)} facing ${f2(TL.faceErrAtGo)} rad off the way out · at the counter ${rel(TL.arriveAt)} ${posS(TL.arrivePos)} (out ${f1(TL.outSecs)} s) · starts back ${rel(TL.dwellEndAt)} (dwell ${f1(TL.dwellEndAt - TL.arriveAt)} s) · back ${rel(TL.backAt)} at ${posS(TL.backPos)} wp${TL.wpAtBack} wait ${f2(TL.waitAtBack)} (back ${f1(TL.backSecs)} s) "${TL.backText}" · 5 s on: wp${TL.wpLater} · AWAY ${f1(TL.backAt - TL.goAt)} s`);
    dumpLog(S.nlog);
    const wp1 = S.A.route.points[1];
    allPass = verdict(TL.t0 >= 0 && Math.abs(TL.watchAt - TL.t0) <= DT + 1e-6 && TL.watchHeld >= 0.5, 'watch check the frame it is scheduled, the arm up (weight > ½) for ≥ ½ s', `at ${rel(TL.watchAt)}, held ${f2(TL.watchHeld)} s`) && allPass;
    allPass = verdict(TL.glanceMax >= 0.5, 'a glance the way he will go inside the first 2.5 s (neck ≥ 0.5 rad: the door is behind him)', `${f2(TL.glanceMax)} rad`) && allPass;
    allPass = verdict(TL.sayAt >= 0 && Math.abs(TL.sayAt - (TL.t0 + lead - sayLead)) <= 0.05 && POOL_ANNOUNCE.has(TL.sayText) && !TL.sayRadio && TL.partner === 'Reyes', `the line at T−${sayLead} from the coffee pool, a bubble (not the net), to Reyes`, `${rel(TL.sayAt)} "${TL.sayText}" radio=${TL.sayRadio} partner=${TL.partner}`) && allPass;
    allPass = verdict(TL.replyAt >= 0 && TL.replyWho === 'Reyes' && Math.abs(TL.replyAt - TL.sayAt - NEEDS.replyAfter) <= 0.05, `Reyes answers ${NEEDS.replyAfter} s later from the reply pool`, `${TL.replyWho || '—'} +${f2(TL.replyAt - TL.sayAt)} s "${TL.replyText}"`) && allPass;
    allPass = verdict(TL.neckAt >= 0 && Math.abs(TL.neckAt - (TL.t0 + lead - stretchLead)) <= 0.05 && TL.neckHeld >= 0.5, `neck rub at T−${stretchLead}, held ≥ ½ s`, `${rel(TL.neckAt)}, held ${f2(TL.neckHeld)} s`) && allPass;
    allPass = verdict(TL.goAt >= 0 && Math.abs(TL.goAt - (TL.t0 + lead)) <= 0.3 && TL.faceErrAtGo < 0.35, 'walks at T (±0.3 s), already turned to the way out (< 0.35 rad off it)', `${rel(TL.goAt)}, ${f2(TL.faceErrAtGo)} rad`) && allPass;
    allPass = verdict(!!TL.arrivePos && v3.distXZ(TL.arrivePos, NEED_SPOTS.coffee.pos) < 1.0, 'reaches the counter (within a metre of the spot)', `${posS(TL.arrivePos)} vs ${posS(NEED_SPOTS.coffee.pos)}: ${TL.arrivePos ? f2(v3.distXZ(TL.arrivePos, NEED_SPOTS.coffee.pos)) : '—'} m, ${f1(TL.outSecs)} s out`) && allPass;
    allPass = verdict(TL.dwellEndAt >= 0 && Math.abs((TL.dwellEndAt - TL.arriveAt) - dwell) <= 1.0, `dwells the knob's ${dwell} s (±1)`, `${f2(TL.dwellEndAt - TL.arriveAt)} s`) && allPass;
    allPass = verdict(!!TL.backPos && v3.distXZ(TL.backPos, wp1) < 1.2 && TL.wpAtBack === 1 && Math.abs(TL.waitAtBack - 3.0) < 0.1, 'back onto the SAME waypoint (wp1, within 1.2 m) with the wait he had left (3.0 s) still to run', `${posS(TL.backPos)} ${TL.backPos ? f2(v3.distXZ(TL.backPos, wp1)) : '—'} m off, wp${TL.wpAtBack}, wait ${f2(TL.waitAtBack)}`) && allPass;
    allPass = verdict(POOL_BACK.has(TL.backText), "'right, where was I' from the pool as he gets back", `"${TL.backText}"`) && allPass;
    allPass = verdict(TL.wpLater >= 2 && TL.wpLater <= 3, 'the route resumes: five seconds later the wait has run out and he is on to wp2 (or wp3: wp2 is a stride off wp1 with no wait)', `wp${TL.wpLater}`) && allPass;
    console.log(`    ABSENCE (coffee from the corridor's east end): ${f1(TL.backAt - TL.goAt)} s = out ${f1(TL.outSecs)} + dwell ${f1(TL.dwellEndAt - TL.arriveAt)} + back ${f1(TL.backSecs)}; the whole tell-to-back ${f1(TL.backAt - TL.t0)} s`);
  }
  { const { TL, S } = await telegraphRun(null);
    const want = NEEDS_LINES.radio.replace('{who}', 'Kowalski').replace('{short}', NEEDS_LINES.short.coffee);
    console.log(`    nobody near: says "${TL.sayText}"${TL.sayRadio ? ' (RADIO)' : ''} · log line "${TL.radioMsg}" · partner ${TL.partner ?? 'none'} · answer "${TL.replyText || '—'}"`);
    dumpLog(S.nlog, 12);
    allPass = verdict(TL.sayRadio && TL.sayText === want && /^radio: /.test(TL.radioMsg) && !TL.partner && TL.replyAt < 0, 'with nobody in earshot it goes over the net, in the radio\'s words, onto the strip (a "radio: …" message), and nobody answers', `"${TL.sayText}" radio=${TL.sayRadio} msg="${TL.radioMsg}"`) && allPass;
    allPass = verdict(TL.goAt >= 0 && TL.backAt >= 0 && TL.wpLater >= 2 && TL.wpLater <= 3, 'and the trip runs the same (walks, back, route resumed)', `walks ${f1(TL.goAt - TL.t0)} s after the watch, away ${f1(TL.backAt - TL.goAt)} s, then wp${TL.wpLater}`) && allPass;
  }
  console.log(`=== needs-telegraph: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}

// ================================================================ (c) one man away at a time
export async function needsOneAway() {
  console.log('\n=== needs-one-away: Kowalski (wp1) and Novak (wp4) both full and both standing at their waypoints — one trip at a time floor-wide; the second man goes the moment the first is back ===');
  const S = await stage(1401); const { game, A, B, C } = S;
  park(C, 2);
  atWaypoint(A, 1, Math.PI / 2); atWaypoint(B, 4, 0, 999);   // (Novak's wait pinned long: he stays put at wp4, eligible every frame, so the only thing keeping him is the floor's slot)
  S.step(2);
  needsSetLevel(game, A, 'coffee', 1.3); needsSetLevel(game, B, 'coffee', 1.2);
  let both = 0, aFirst = -1, aBack = -1, bFirst = -1; let prevA = false;
  for (let f = 0; f < 60 * 140; f++) {
    S.step();
    const ta = !!needsTrip(A), tb = !!needsTrip(B);
    if (ta && tb) both++;
    if (ta && aFirst < 0) aFirst = game.time; if (prevA && !ta && aBack < 0) aBack = game.time; prevA = ta;
    if (tb && bFirst < 0) bFirst = game.time;
    if (bFirst >= 0 && game.time - bFirst > 2) break;
  }
  console.log(`    Kowalski schedules at ${f2(aFirst)} s, back at ${f2(aBack)} s; Novak schedules at ${f2(bFirst)} s; frames with both on a trip: ${both}; floor gap ${NEEDS.floorGapSecs} s after a departure`);
  dumpLog(S.nlog, 20);
  let allPass = true;
  allPass = verdict(aFirst >= 0 && both === 0, 'never two trips at once', `${both} frames`) && allPass;
  allPass = verdict(aBack >= 0 && bFirst >= aBack && bFirst - aBack <= Math.max(2 * DT + 1e-6, NEEDS.floorGapSecs - (aBack - (aFirst + NEEDS.announceLead)) + 2 * DT), 'the second man goes only once the first is back — and then at once (or when the floor gap since the first departure has run)', `Novak ${f2(bFirst - aBack)} s after Kowalski is back`) && allPass;
  console.log(`=== needs-one-away: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}

// ================================================================ (d) interrupts, and frozen
export async function needsInterrupts() {
  console.log('\n=== needs-interrupts: a whistle at T−8 (answered: no departure, he looks into it) · a gunshot halfway to the counter (broken off where he stands, off-route; never resumed in 120 s) · frozen under quietUtility / the response team / a whole lap of the tour ===');
  let allPass = true;
  // 1. the whistle inside the telegraph
  { const S = await stage(1501, { invisible: false }); const { game, pl, A, B, C } = S;
    park(B, 1); park(C, 2); atWaypoint(A, 1, Math.PI / 2); S.step(2); needsSetLevel(game, A, 'coffee', 1.2);
    let t0 = -1, blown = false, departed = false, cancelledAt = -1, stateAfter = '', fixD = NaN;
    for (let f = 0; f < 60 * 60; f++) {
      S.step();
      const T = needsTrip(A); if (T && t0 < 0) t0 = T.t0;
      if (t0 >= 0 && !blown && game.time >= t0 + NEEDS.announceLead - 8) { game.teleportPlayer([29.5, 0, 11.2]); pl.crouch = true; S.step(); blown = tryWhistle(game); }   // 4.5 m west of him, behind his back, dark
      if (T && T.phase !== 'telegraph') departed = true;
      if (blown && !T && cancelledAt < 0) { cancelledAt = game.time; stateAfter = A.state; fixD = A.lastKnown ? v3.distXZ(A.lastKnown, pl.char.pos) : NaN; }
      if (cancelledAt >= 0 && game.time - cancelledAt > 20) break;
    }
    console.log(`    whistle ${blown ? 'blown' : 'NOT blown'} at T−8: trip ${cancelledAt >= 0 ? `gone ${f2(cancelledAt - (t0 + NEEDS.announceLead - 8))} s later` : 'still on'}, Kowalski ${stateAfter} with a fix ${f1(fixD)} m off Sam, departed=${departed}; 20 s on: ${A.state} at ${posS(A.char.pos)}`);
    dumpLog(S.nlog, 10);
    allPass = verdict(blown && cancelledAt >= 0 && cancelledAt - (t0 + NEEDS.announceLead - 8) < 0.1 && !departed && stateAfter === 'suspicious' && fixD < 1.5, 'the whistle he answers cancels the trip on the frame, he never walks off, and he goes to look (suspicious, fix on the whistle)', `cancel +${f2(cancelledAt - (t0 + NEEDS.announceLead - 8))} s, ${stateAfter}, fix ${f1(fixD)} m`) && allPass;
  }
  // 2. a gunshot mid-walk, then two minutes
  { const S = await stage(1502); const { game, pl, A, B, C } = S;
    park(B, 1); park(C, 2); atWaypoint(A, 1, Math.PI / 2); S.step(2); needsSetLevel(game, A, 'coffee', 1.2);
    let goAt = -1, shotAt = -1, cancelAt = -1, cancelPos: Vec3 | null = null, offRoute = NaN, stateAfter = '', later = 0, laterTrips = 0; const depBefore = NEEDS_STATS.departed;
    const segDist = (p: Vec3, a: Vec3, b: Vec3) => { const abx = b[0] - a[0], abz = b[2] - a[2]; const L2 = abx * abx + abz * abz || 1; const u = Math.max(0, Math.min(1, ((p[0] - a[0]) * abx + (p[2] - a[2]) * abz) / L2)); return Math.hypot(p[0] - (a[0] + abx * u), p[2] - (a[2] + abz * u)); };
    const routeDist = (p: Vec3) => { const pts = A.route.points; let d = Infinity; for (let i = 0; i < pts.length; i++) d = Math.min(d, segDist(p, pts[i], pts[(i + 1) % pts.length])); return d; };
    for (let f = 0; f < 60 * 200; f++) {
      S.step();
      const T = needsTrip(A);
      if (T?.phase === 'going' && goAt < 0) goAt = game.time;
      if (goAt >= 0 && shotAt < 0 && game.time - goAt >= 5.5) { shotAt = game.time; game.events.push({ kind: 'shot', pos: [20, 0, 11.2], time: game.time, loud: true, level: 1, who: PLAYER_ID }); }   // Sam's pistol at gunfire level, mid-corridor
      if (shotAt >= 0 && !T && cancelAt < 0) { cancelAt = game.time; cancelPos = v3.copy(A.char.pos); offRoute = routeDist(cancelPos!); stateAfter = A.state; game.teleportPlayer([2.0, 0, 2.0]); game.playerInvisible = true; }
      if (cancelAt >= 0) { later = game.time - cancelAt; if (needsTrip(A)) laterTrips++; if (later >= 120) break; }
    }
    console.log(`    walks at ${f2(goAt)} s; shot at +${f1(shotAt - goAt)} s; trip ${cancelAt >= 0 ? `broken off ${f2(cancelAt - shotAt)} s later at ${posS(cancelPos)} — ${f1(offRoute)} m off his route, ${stateAfter}` : 'NOT broken off'}; then ${f1(later)} s watched: ${laterTrips} frames with a trip on him; floor now ${game.escalationSummary()}; departures ${NEEDS_STATS.departed - depBefore}`);
    dumpLog(S.nlog, 10);
    allPass = verdict(cancelAt >= 0 && cancelAt - shotAt <= 2 * DT + 1e-6 && (stateAfter === 'alert' || stateAfter === 'suspicious') && offRoute > 1.0, 'the shot breaks it off inside two frames where he stands (off his route), and he reacts as the AI does', `+${f2(cancelAt - shotAt)} s, ${stateAfter}, ${f1(offRoute)} m off-route`) && allPass;
    allPass = verdict(later >= 120 && laterTrips === 0 && NEEDS_STATS.departed - depBefore === 1, 'and in the two minutes after — calm again or not — the trip never comes back', `${laterTrips} trip-frames in ${f1(later)} s`) && allPass;
  }
  // 3. frozen: quietUtility, the response team, the tour proper
  { const S = await stage(1503); const { game, A, B, C } = S;
    atWaypoint(A, 1, Math.PI / 2); atWaypoint(B, 4, 0, 999); atWaypoint(C, 1, 0, 999); A.wait = 999; S.step(2);
    for (const [gd, k] of [[A, 'coffee'], [B, 'coffee'], [C, 'coffee']] as const) needsSetLevel(game, gd, k, 1.4);
    const s0 = NEEDS_STATS.scheduled;
    game.quietUtility = true; game.touring = true; S.step(60 * 60); const sTour = NEEDS_STATS.scheduled - s0; const sendTour = needsSend(game, A, 'coffee');
    game.quietUtility = false; game.touring = false; game.qrf.state = 'requested'; S.step(60 * 60); const sQrf = NEEDS_STATS.scheduled - s0 - sTour;
    game.qrf.state = 'idle'; S.step(2); const sFree = NEEDS_STATS.scheduled - s0 - sTour - sQrf;
    console.log(`    a minute under quietUtility: ${sTour} scheduled (send says "${sendTour}"); a minute with the QRF requested: ${sQrf}; two frames free again: ${sFree}`);
    allPass = verdict(sTour === 0 && /not now/.test(sendTour) && sQrf === 0 && sFree >= 1, 'nothing is dealt under the tour flag or with the response team not idle (and the button refuses); freed, the next frames deal', `${sTour} / ${sQrf} / ${sFree}`) && allPass;
  }
  { // the showcase tour, one whole lap headless (as tools/qa/tour.ts steps it), fill ×50: not one trip may be dealt or run inside it
    Math.random = seeded(1504); knobsBack(); NEEDS.rateK = 50;
    const W = await standUp(); const { game, cam, input } = W; game.tune.needs = true;
    const { Demo } = await import(`${ROOT}/src/game/demo.ts`);
    for (let i = 0; i < 5; i++) W.step(DT);
    const demo = new Demo(game, cam, W.smoke, input);
    const s0 = NEEDS_STATS.scheduled, d0 = NEEDS_STATS.departed;
    demo.start();
    let frames = 0, tripFrames = 0; const started = demo.active;
    while (demo.active && frames < 60 * 60 * 14) { const p = demo.update(DT); W.step(DT, p); frames++; for (const gd of game.guards) if (needsTrip(gd)) tripFrames++; }
    const during = { scheduled: NEEDS_STATS.scheduled - s0, departed: NEEDS_STATS.departed - d0 };
    // and after the hand-over the live floor deals again (the tour's restartEncounter made fresh men: full needs at ×50 inside seconds, then a waypoint)
    let after = -1; for (let f = 0; f < 60 * 150 && after < 0; f++) { game.player.visibility = 0.02; W.step(DT); if (game.guards.some((gd: any) => needsTrip(gd))) after = f * DT; }
    console.log(`    the tour: started=${started}, ${(frames * DT).toFixed(0)} s over ${demo.active ? 'NOT finished' : 'a whole lap'}; during it ${during.scheduled} scheduled / ${during.departed} departed / ${tripFrames} trip-frames; after the hand-over the first trip is dealt ${after < 0 ? 'NEVER' : `${after.toFixed(1)} s in`} (quietUtility ${game.quietUtility}, touring ${game.touring})`);
    allPass = verdict(started && !demo.active && during.scheduled === 0 && during.departed === 0 && tripFrames === 0, 'a whole headless lap of the tour at fill ×50: zero trips dealt, walked or carried', `${during.scheduled} / ${during.departed} / ${tripFrames}`) && allPass;
    allPass = verdict(after >= 0, 'and the live floor it hands back deals again', after < 0 ? 'never' : `${after.toFixed(1)} s after`) && allPass;
    knobsBack();
  }
  console.log(`=== needs-interrupts: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}

// ================================================================ (f) no trip on a floor that is up
export async function needsFrozenUp() {
  console.log('\n=== needs-frozen-up: heightened floor, everybody full at his waypoint for a minute — nothing dealt, the button refuses; stood down — dealt on the next frames ===');
  const S = await stage(1601); const { game, A, B, C } = S;
  atWaypoint(A, 1, Math.PI / 2); atWaypoint(B, 4, 0, 999); atWaypoint(C, 1, 0, 999); A.wait = 999; S.step(2);
  for (const gd of [A, B, C]) needsSetLevel(game, gd, 'coffee', 1.4);
  game.escalate(); S.step(1);
  const s0 = NEEDS_STATS.scheduled; let tripFrames = 0;
  for (let f = 0; f < 60 * 60; f++) { S.step(); for (const gd of game.guards) if (needsTrip(gd)) tripFrames++; }
  const sUp = NEEDS_STATS.scheduled - s0; const send = needsSend(game, A, 'coffee'); const lvl = game.escalation;
  game.standDown(); for (const gd of [A, B, C]) { gd.awareness = 0; gd.state = 'patrol'; }
  S.step(2);
  const capped = [A, B, C].map(gd => Math.max(...(needsMem(gd)?.needs ?? []).map((n: any) => n.level)));   // the adrenaline cap: back on a calm floor every need of a man who has been through the alarm sits at ≤ afterAlert
  for (const gd of [A, B, C]) needsSetLevel(game, gd, 'coffee', 1.4);   // (minutes later, in effect: full again)
  let after = -1; for (let f = 0; f < 60 * 10 && after < 0; f++) { S.step(); if (game.guards.some((gd: any) => needsTrip(gd))) after = f; }
  console.log(`    at alarm level ${lvl}: ${sUp} scheduled, ${tripFrames} trip-frames in 60 s; the button: "${send}"; stood down: levels capped to ${capped.map(f2).join(' / ')} (afterAlert ${NEEDS.afterAlert}); full again, the first trip ${after < 0 ? 'NEVER' : `${after} frames later`} (${game.needsSummary()})`);
  let allPass = true;
  allPass = verdict(lvl >= 1 && sUp === 0 && tripFrames === 0 && /floor is up/.test(send), 'no trip starts (or is sent) at escalation > 0', `${sUp} scheduled, "${send}"`) && allPass;
  allPass = verdict(capped.every(x => x <= NEEDS.afterAlert + 0.01), `calm again, everybody's needs are capped at afterAlert (${NEEDS.afterAlert}) — nobody wants a coffee straight after an alarm`, capped.map(f2).join(' / ')) && allPass;
  allPass = verdict(after >= 0 && after <= 3, 'and once a need is full again the deal resumes within frames', `${after} frames`) && allPass;
  console.log(`=== needs-frozen-up: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}
void needsMem; void NEEDS_LOG; void needsLines;
