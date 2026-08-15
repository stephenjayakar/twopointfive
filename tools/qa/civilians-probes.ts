// The 'civilians' probe family (run through probes.ts: `bun run tools/qa/probes.ts civilians | civilians-spots | civilians-sight | civilians-phone | civilians-comply |
// civilians-scoring | civilians-hearing | civilians-determinism | civilians-identity [--verbose] [--print]`): the cleaner and the late worker of src/game/civilians.ts —
// STATUS E12 (d). Each stands the full game up headless (headless.ts), stages one situation, steps it, prints what happened, PASS / FAIL.
//   civilians-spots        the phones, the ways out and every authored mark of both loops against the nav grid: free cells, reachable, consecutive marks joined by a path.
//   civilians-sight        Sam crouched a metre and a half off the kneeling cleaner in the dark, hands empty, gone again after four seconds: she is startled inside a frame or two,
//                          frightened inside half a second (point-blank is certain), screams — the men in earshot by the sound's own path turn toward HIM, not her —
//                          runs to the nearest calm guard, tells him: his fix is where she saw Sam, he is suspicious and walks it, his report goes over the net; the row
//                          and the count land on the card. Then again with the pistol in Sam's hand: 'gun, armed', the man SEARCHES the spot weapon out, the floor a step up.
//   civilians-phone        the panel's 'send her to a phone' from a quiet floor: she runs to the nearer set, six seconds on the line, control's line on the radio strip,
//                          the nearest calm man tasked to the spot ('copy, control — on my way'), one call only however long she stands there.
//   civilians-comply       grabbed from behind, questioned three times (fear, then the side door's own digits — Sam learns them — then who walks where), told to
//                          stay down: out of the arm on her feet, cowering, complied; a quiet minute and she has told nobody; a calm man stood beside her: he asks, she
//                          tells him, he searches it, the floor goes up.
//   civilians-scoring      the takedown on the cleaner (−10, a 'ko' row, breathing), a round in the worker (−40, 'CIVILIAN KILLED', the badge gone), the summary
//                          line's civilian block; the men finding them (a body found each, the dead one locks the floor down and control says so); and with
//                          tune.civilianKillFails the same round fails the mission on the frame.
//   civilians-hearing      the suppressed Five-seveN fired six metres from the worker at his desk: frightened ('shot'); fired eleven metres off across the farm:
//                          nothing — the guards' own odd-noise reach (7 m of open air per unit level × the path's carry + 0.5). And the FN2000's crack anywhere: fright.
//   civilians-determinism  the same seeded ninety seconds twice with a fright staged at twenty: the module's log identical line for line, the civilians' positions
//                          identical to the millimetre — her dice are her own.
//   civilians-identity     three quiet minutes of the seeded night floor (Sam parked unseen), digested frame by frame over the SHIFT (state, position, aim, awareness,
//                          waypoint, wait, path, neck, bubble), the events, the messages, the alarm and every leaf: civilians ON with the greetings off == civilians OFF
//                          (their presence alone moves nothing of the men's night); with the greetings on the digest may move (a man answering 'Evening, Marta' has a
//                          line in the air) — printed as information, with what differed first.
import { standUp, ROOT } from './headless.ts';
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const CV = await import(`${ROOT}/src/game/civilians.ts`);
const { CIV, CIV_STATS, CIV_LOG, CIV_DEBUG, CIV_SPOTS, checkCivSpots, civiliansSummary, civPanic } = CV;
const { CIV_LINES, civilianLines } = await import(`${ROOT}/src/game/dialogue.ts`);
const { startGrab, startTakedown } = await import(`${ROOT}/src/game/player.ts`);
const { fireWeapon } = await import(`${ROOT}/src/game/combat.ts`);
const { debriefOf, SCORE } = await import(`${ROOT}/src/game/chronicle.ts`);
const { WEAPONS } = await import(`${ROOT}/src/game/weapons.ts`);

type Vec3 = [number, number, number];
const DT = 1 / 60;
const VERBOSE = process.argv.includes('--verbose');
const PRINT = process.argv.includes('--print');
const f1 = (x: number) => x.toFixed(1), f2 = (x: number) => x.toFixed(2);
const posS = (p: Vec3 | null | undefined) => p ? `(${f1(p[0])}, ${f1(p[2])})` : '—';
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function verdict(ok: boolean, label: string, detail: string) { console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}: ${detail}`); return ok; }
let failures = 0;
export function civiliansFailures() { return failures; }
const CIV0 = JSON.parse(JSON.stringify(CIV));
function knobsBack() { for (const k of Object.keys(CIV0)) { const v = (CIV0 as any)[k]; if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign((CIV as any)[k], v); else (CIV as any)[k] = Array.isArray(v) ? [...v] : v; } }

/** FNV-1a over strings, 32 bits, chained */
class Digest {
  h = 0x811c9dc5 >>> 0; n = 0; trace: string[] | null = null;
  add(s: string) { for (let i = 0; i < s.length; i++) { this.h ^= s.charCodeAt(i); this.h = Math.imul(this.h, 0x01000193) >>> 0; } this.n++; }
  num(x: number | null | undefined) { this.add(x === null || x === undefined ? '~' : String(x)); }
  vec(p: number[] | null | undefined) { if (!p) { this.add('~'); return; } this.num(p[0]); this.num(p[1]); this.num(p[2]); }
  get hex() { return this.h.toString(16).padStart(8, '0'); }
}

/** what everybody says (game.say and the guards module's own say both land in a man's bubble: read the bubbles) — polled once a frame */
function bubbleTap(game: any) {
  const lines: { t: number; who: string; text: string; radio: boolean }[] = []; const seen = new WeakMap<object, number>();
  return { lines, poll() { for (const x of [...game.guards, ...game.civilians]) { const b = x.bubble; if (b && seen.get(x) !== b.t) { seen.set(x, b.t); lines.push({ t: b.t, who: x.callsign, text: b.text, radio: !!b.radio }); } } } };
}
/** the level up off `seed`: god mode, Sam parked unseen out on the verge, the module's log collected, the knobs as shipped (greetings OFF unless asked: the men's chatter clocks then stay theirs) */
async function stage(seed: number, opts: { greet?: boolean } = {}) {
  Math.random = seeded(seed); knobsBack(); CIV.greet = !!opts.greet;
  const W = await standUp(); const { game } = W; const pl = game.player;
  game.godMode = true; game.aiEnabled = true;
  const clog: string[] = []; CIV_DEBUG.log = (s: string) => clog.push(s);
  for (let i = 0; i < 5; i++) W.step(DT);
  game.teleportPlayer([2.0, 0, 2.0]); game.playerInvisible = true; pl.crouch = true;
  const tap = bubbleTap(game);
  const [K, N, R] = game.guards;   // Kowalski (corridor), Novak (cubicles), Reyes (lobby / break room)
  const [M, O] = game.civilians;   // Marta (cleaner), Owen (late worker)
  const step = (n = 1, vis = 0.02) => { for (let i = 0; i < n; i++) { pl.visibility = vis; W.step(DT); tap.poll(); } };
  return { W, game, pl, K, N, R, M, O, tap, clog, step };
}

// ================================================================ spots
export async function civiliansSpots() {
  console.log('\n=== civilians-spots: the phones, the ways out and both loops\' marks against levels/office.json — free nav cells, reachable, joined ===');
  const S = await stage(11);
  const errs = checkCivSpots(S.game);
  for (const s of [...CIV_SPOTS.phones, ...CIV_SPOTS.exits]) console.log(`    ${s.name.padEnd(22)} (${s.pos[0]}, ${s.pos[2]}) face ${f2(s.face)}`);
  for (const cv of S.game.civilians) console.log(`    ${cv.callsign}: ${cv.route.points.map((p: Vec3, i: number) => `${i}:${posS(p)} ${cv.civ.def.tasks?.[i] ?? 'stand'} ${cv.route.wait[i]} s`).join(' · ')}`);
  let ok = verdict(errs.length === 0, 'every phone / exit / mark a free cell, every spot reachable from each first mark, consecutive marks joined by a path', errs.length ? errs.join('; ') : `${CIV_SPOTS.phones.length} phones, ${CIV_SPOTS.exits.length} exits, ${S.game.civilians.map((c: any) => `${c.callsign} ${c.route.points.length} marks`).join(', ')}`);
  ok = verdict(S.game.civilians.length === 2 && S.M.team === 'civilian' && S.O.team === 'civilian' && !S.game.guards.some((g: any) => g.team === 'civilian') && S.M.char.id >= 10 && S.O.char.id >= 10, 'two civilians on the civilian side, none of them in Game.guards, ids past the staff\'s (a leaf she pushes is a door one of them opened)', `${S.game.civilians.map((c: any) => `${c.callsign} id ${c.char.id} ${c.team}`).join(', ')}; guards ${S.game.guards.length}`) && ok;
  console.log(`=== civilians-spots: ${ok ? 'ALL PASS' : 'FAILURES above'} ===`); if (!ok) failures++;
  return ok;
}

// ================================================================ sight → alarmed → flee → report
/** run to Marta WALKING down to her second bin (heading south-west across the farm) with a metre and a half of clear floor ahead of her and Novak six metres or
 *  more off: Sam is then stood in her way (seed 77: about 30 s in) */
async function toWalk(seed = 77): Promise<ReturnType<typeof stage> extends Promise<infer T> ? T & { ahead: Vec3 } : never> {
  const S = await stage(seed); const nav = S.game.col.nav;
  let ahead: Vec3 = [0, 0, 0];
  for (let i = 0; i < 60 * 90; i++) {
    S.step();
    const M = S.M, c = M.char, sp = Math.hypot(c.vel[0], c.vel[2]);
    if (M.wp === 2 && M.wait <= 0 && M.civ.state === 'work' && sp > 0.8 && c.pos[2] > 18.6) {
      ahead = [c.pos[0] + c.vel[0] / sp * 1.5, 0, c.pos[2] + c.vel[2] / sp * 1.5];
      if (!nav.isBlocked(ahead[0], ahead[2]) && !nav.isBlocked(ahead[0] + 0.3, ahead[2]) && !nav.isBlocked(ahead[0] - 0.3, ahead[2]) && !nav.isBlocked(ahead[0], ahead[2] + 0.3) && !nav.isBlocked(ahead[0], ahead[2] - 0.3) && nav.walkable(c.pos, ahead) && v3.distXZ(S.N.char.pos, ahead) > 6) break;
    }
  }
  return Object.assign(S, { ahead }) as any;
}
async function sightRun(gun: boolean) {
  const S = await toWalk(); const { game, pl, M, N } = S;
  const t0 = game.time; const novak0 = { state: N.state, pos: v3.copy(N.char.pos) };
  game.playerInvisible = false; game.teleportPlayer(S.ahead); pl.holstered = !gun; pl.slot = 'pistol'; pl.char.bodyYaw = M.char.bodyYaw + Math.PI; pl.crouch = true; pl.pistol.lightOn = false;   // a metre and a half dead ahead of her on the floor she is walking, facing her, crouched in the dark
  const at = v3.copy(pl.char.pos);
  if (VERBOSE) console.log(`    staged at ${f1(t0)} s: Marta ${posS(M.char.pos)} → Sam ${posS(at)}, Novak ${posS(N.char.pos)} ${N.state}`);
  let startledAt = -1, alarmedAt = -1, fleeAt = -1, reportAt = -1, toldAt = -1, cowerAt = -1; let target = ''; const noticed: string[] = [];
  let novakFix: Vec3 | null = null, novakStateAtTell = '', escAtTell = 0, escMax = 0, novakMaxAw = 0;
  const clog0 = S.clog.length;
  for (let f = 0; f < 60 * 40; f++) {
    S.step(1, 0.12);
    if (f === 60 * 4) { game.teleportPlayer([2, 0, 2]); game.playerInvisible = true; }   // he slips away after four seconds: what the men do is off her word alone
    const C = M.civ; const t = game.time - t0;
    if (startledAt < 0 && C.state === 'startled') startledAt = t;
    if (alarmedAt < 0 && C.state === 'alarmed') alarmedAt = t;
    if (fleeAt < 0 && C.state === 'flee') { fleeAt = t; target = C.target?.name ?? '?'; }
    if (reportAt < 0 && C.state === 'report') reportAt = t;
    if (toldAt < 0 && C.reported) { toldAt = t; novakFix = N.lastKnown ? v3.copy(N.lastKnown) : null; novakStateAtTell = N.state; escAtTell = game.escalation; }
    if (cowerAt < 0 && C.state === 'cower') cowerAt = t;
    escMax = Math.max(escMax, game.escalation); novakMaxAw = Math.max(novakMaxAw, N.awareness);
    if (VERBOSE && f % 60 === 0) console.log(`    ${f1(t)}s ${civiliansSummary(game)} · Novak ${N.state} aw ${f2(N.awareness)} lk ${posS(N.lastKnown)} @${posS(N.char.pos)} · esc ${game.escalation}`);
  }
  for (const l of S.clog.slice(clog0)) { const m = / (\w+) heard her .* → looks toward \(([-\d.]+), ([-\d.]+)\)/.exec(l); if (m && /Marta:/.test(l)) noticed.push(`${m[1]}→(${m[2]},${m[3]})`); }
  const radio = S.tap.lines.filter(l => l.radio && l.who === 'Novak');
  const rows = game.chronicle.events.filter((e: any) => e.kind === 'civilianReported' && e.data.who === 'Marta');
  const spotted = game.chronicle.events.filter((e: any) => e.kind === 'civilianSpotted' && e.data.who === 'Marta');
  return { S, at, novak0, startledAt, alarmedAt, fleeAt, reportAt, toldAt, cowerAt, target, noticed, novakFix, novakStateAtTell, escAtTell, escMax, novakMaxAw, radio, rows, spotted, cause: M.civ.cause, armed: M.civ.armed, counts: { ...game.chronicle.counts } };
}
export async function civiliansSight() {
  console.log('\n=== civilians-sight: Sam a metre off the kneeling cleaner in the dark (hands empty, then the pistol out), gone after 4 s — startled, frightened, the scream heard, the run to Novak, the telling, what he then knows and does ===');
  let ok = true;
  for (const gun of [false, true]) {
    const R = await sightRun(gun);
    console.log(`\n- ${gun ? 'PISTOL IN HAND' : 'HANDS EMPTY'}: startled ${f2(R.startledAt)} s · alarmed ${f2(R.alarmedAt)} s [${R.cause}${R.armed ? ', armed' : ''}] · flee ${f2(R.fleeAt)} s → ${R.target} · report ${f2(R.reportAt)} s · told ${f2(R.toldAt)} s · cower ${f2(R.cowerAt)} s`);
    console.log(`    the scream: ${R.noticed.join(', ') || 'nobody turned'} · Novak at the telling: ${R.novakStateAtTell}, fix ${posS(R.novakFix)} (Sam was at ${posS(R.at)}), esc then ${R.escAtTell}, max ${R.escMax} · his radio: ${R.radio.map(l => `"${l.text}"`).join(' / ') || '—'}`);
    console.log(`    card: spotted rows ${R.spotted.length}, reported rows ${R.rows.length} (${R.rows.map((e: any) => `${e.data.how}/${e.data.cause}`).join(', ')}), counts civSeen ${R.counts.civSeen} civReported ${R.counts.civReported}`);
    ok = verdict(R.startledAt >= 0 && R.startledAt < 0.5 && R.alarmedAt > R.startledAt && R.alarmedAt < 1.2, `${gun ? 'gun' : 'empty'}: a metre and a half ahead of her in the dark she is startled inside half a second and frightened inside 1.2 s (the guards' near-field floor: certain at arm's length)`, `startled ${f2(R.startledAt)} s, alarmed ${f2(R.alarmedAt)} s`) && ok;
    ok = verdict(R.cause === (gun ? 'gun' : 'sam') && R.armed === gun, `${gun ? 'gun' : 'empty'}: what frightened her is ${gun ? "'gun', armed" : "'sam', not armed"}`, `${R.cause}${R.armed ? ', armed' : ''}`) && ok;
    const atS = `Novak→(${f1(R.at[0])},${f1(R.at[2])})`;
    ok = verdict(R.noticed.some(n => n === atS), `${gun ? 'gun' : 'empty'}: her scream reaches Novak up the aisle by the sound's own path and turns him toward where SAM stood, not toward her`, R.noticed.join(', ') || 'nobody') && ok;
    ok = verdict(R.fleeAt > R.alarmedAt && R.fleeAt - R.alarmedAt >= CIV.freeze[0] - 0.02 && R.fleeAt - R.alarmedAt <= CIV.freeze[1] + 0.05 && R.target === 'Novak', `${gun ? 'gun' : 'empty'}: frozen for her beat (${CIV.freeze[0]}–${CIV.freeze[1]} s), then she runs to the NEAREST calm guard by path — Novak, not a phone, not the door`, `froze ${f2(R.fleeAt - R.alarmedAt)} s → ${R.target}`) && ok;
    ok = verdict(R.reportAt > R.fleeAt && R.toldAt > R.reportAt && R.toldAt - R.reportAt >= CIV.reportSecs - 0.05 && R.cowerAt > R.toldAt, `${gun ? 'gun' : 'empty'}: reaches him, tells him for ${CIV.reportSecs} s, then cowers`, `report ${f2(R.reportAt)} → told ${f2(R.toldAt)} → cower ${f2(R.cowerAt)}`) && ok;
    ok = verdict(!!R.novakFix && v3.distXZ(R.novakFix, R.at) < 0.5 && (gun ? R.novakStateAtTell === 'search' : R.novakStateAtTell === 'suspicious') && R.novakMaxAw < 0.85, `${gun ? 'gun' : 'empty'}: his fix is where she saw Sam (±0.5 m) and he ${gun ? 'SEARCHES it, weapon out' : 'walks it, suspicious'} — never 'alert' off her word alone`, `fix ${posS(R.novakFix)} vs ${posS(R.at)}, ${R.novakStateAtTell}, max aw ${f2(R.novakMaxAw)}`) && ok;
    ok = verdict(R.radio.length >= 1 && R.radio.some(l => /Marta/.test(l.text)) && (gun ? R.escMax === 1 : R.escMax === 0), `${gun ? 'gun' : 'empty'}: his report goes over the net naming her${gun ? ', and the floor goes up ONE step on an armed man' : '; the floor stays calm for a prowler'}`, `${R.radio.length} radio line(s), esc max ${R.escMax}`) && ok;
    ok = verdict(R.spotted.length === 1 && R.rows.length === 1 && R.rows[0].data.how === 'told' && R.counts.civSeen === 1 && R.counts.civReported === 1, `${gun ? 'gun' : 'empty'}: the card gets one 'saw you' row + count and one 'told them' row + count`, `spotted ${R.spotted.length}, reported ${R.rows.length}, counts ${R.counts.civSeen}/${R.counts.civReported}`) && ok;
  }
  console.log(`=== civilians-sight: ${ok ? 'ALL PASS' : 'FAILURES above'} ===`); if (!ok) failures++;
  return ok;
}

// ================================================================ phone
export async function civiliansPhone() {
  console.log("\n=== civilians-phone: 'send her to a phone' from a quiet floor — the run to the nearer set, six seconds on the line, control on the net, the nearest calm man sent, one call only ===");
  const S = await stage(31); const { game, M } = S;
  S.step(60 * 3);
  const note = civPanic(game, M, 'phone');
  const t0 = game.time; let phoneAt = -1, phonedAt = -1, target = M.civ.target?.name ?? '?', cowerAt = -1;
  const msgs: string[] = []; const seenMsg = new Set<object>();
  for (let f = 0; f < 60 * 50; f++) {
    S.step();
    for (const m of game.messages) if (!seenMsg.has(m)) { seenMsg.add(m); msgs.push(m.text); }
    const C = M.civ; const t = game.time - t0;
    if (phoneAt < 0 && C.state === 'phone') phoneAt = t;
    if (phonedAt < 0 && C.phoned) phonedAt = t;
    if (cowerAt < 0 && C.state === 'cower') cowerAt = t;
    if (VERBOSE && f % 60 === 0) console.log(`    ${f1(t)}s ${civiliansSummary(game)} · ${game.guards.map((g: any) => `${g.callsign} ${g.state}${g.task ? ' task:' + g.task.kind : ''}`).join(' ')}`);
  }
  const control = msgs.filter(m => /^radio: CONTROL — /.test(m));
  const sent = game.guards.filter((g: any) => g.task?.kind === 'device' || S.tap.lines.some(l => l.who === g.callsign && /copy, control — on my way/.test(l.text)));
  const rows = game.chronicle.events.filter((e: any) => e.kind === 'civilianReported' && e.data.how === 'phone');
  console.log(`- ${note} → ${target}: on the phone at ${f2(phoneAt)} s, the call lands at ${f2(phonedAt)} s (${f2(phonedAt - phoneAt)} s on the line), cowers ${f2(cowerAt)} s`);
  console.log(`    control: ${control.map(m => `"${m.slice(7, 90)}…"`).join(' / ') || '—'} · sent: ${sent.map((g: any) => g.callsign).join(', ') || 'nobody'} · rows ${rows.length} · calls counted ${CIV_STATS.phoned}`);
  let ok = verdict(/runs for/.test(note) && /phone/.test(target) && phoneAt > 2 && phoneAt < 25, 'she runs (not walks) to the nearer phone and is on it within 25 s', `${target}, ${f2(phoneAt)} s`);
  ok = verdict(phonedAt > 0 && Math.abs(phonedAt - phoneAt - CIV.phoneSecs) < 0.1, `the call takes ${CIV.phoneSecs} s on the line`, `${f2(phonedAt - phoneAt)} s`) && ok;
  ok = verdict(control.length === 1 && /rang in|rang it in/.test(control[0]) && rows.length === 1, "control puts it out ONCE on the radio strip ('… rang in a prowler …') and the card gets one 'rang it in' row", `${control.length} control line(s), ${rows.length} row(s)`) && ok;
  ok = verdict(sent.length === 1 && S.tap.lines.some(l => l.radio && /copy, control — on my way/.test(l.text)), "exactly one calm man is sent to the spot and says so on the net ('copy, control — on my way')", sent.map((g: any) => g.callsign).join(', ') || 'nobody') && ok;
  const phonedN = S.clog.filter(l => /rang it in/.test(l)).length;
  ok = verdict(phonedN === 1 && cowerAt > phonedAt, 'one call per fright however long she stands there, then she cowers', `${phonedN} call(s), cower ${f2(cowerAt)}`) && ok;
  console.log(`=== civilians-phone: ${ok ? 'ALL PASS' : 'FAILURES above'} ===`); if (!ok) failures++;
  return ok;
}

// ================================================================ grab → question → comply → found
export async function civiliansComply() {
  console.log("\n=== civilians-comply: grabbed from behind, questioned (fear, the side door's digits — learned — who walks where), told to stay down: complied, silent for a quiet minute; a calm man beside her: asked, told, searched, the floor up ===");
  const S = await stage(51); const { game, pl, M, N, K, R } = S;
  S.step(60 * 2);
  // The premise of this probe is a hold NOBODY SEES: the men are elsewhere on the floor. It used to get that for free — a held civilian was invisible to the standoff's
  // eyes (review A6.1) — while in fact Novak, walking the aisle eleven metres off, has her lit head and Sam's over the partitions and now calls it in inside three
  // seconds ('he's got Marta, the cleaner …', lockdown, everybody to her). So the three are parked out on the lot, blind and deaf, for the hold and the quiet minute,
  // and Novak is brought back by hand below exactly as he always was.
  [K, N, R].forEach((g: any, i: number) => { g.hold = true; g.pinned = true; g.dazzledUntil = 1e9; g.heardUpTo = 1e12; g.char.pos = [37.5, 0, 6 + i * 1.5]; g.char.vel = [0, 0, 0]; g.path = []; g.pathGoal = null; g.char.update(0); });
  // behind her at the cabinet (she faces east): Sam a step west of her, hands empty
  game.playerInvisible = false; game.teleportPlayer([M.char.pos[0] - 0.7, 0, M.char.pos[2]]); pl.char.bodyYaw = Math.PI / 2; pl.holstered = true; S.step(2);
  const rowsBefore = game.nearby.map((r: any) => `${r.verb}`).join(',');
  startGrab(game, M); S.step(1);
  const grabbed = !!pl.holding && pl.holding.g === M && M.held?.by === 'player';
  S.step(80);
  const heldRows = game.nearby.map((r: any) => r.verb).filter(Boolean);
  const answers: string[] = []; const kinds: (string | null)[] = [];
  for (let q = 0; q < 3; q++) {
    game.selectVerb('held', 'question'); S.W.input.pressed.add('Space'); S.step(1);
    for (let i = 0; i < 60 * 4; i++) { S.step(); }
    const last = S.tap.lines.filter(l => l.who === 'Marta').slice(-1)[0]; answers.push(last?.text ?? '—');
  }
  for (const e of game.chronicle.events) if (e.kind === 'interrogated' && e.data.who === 'Marta') kinds.push(e.data.gave || null);
  const code = [...pl.codes].join(',');
  game.selectVerb('held', 'comply'); S.W.input.pressed.add('Space'); S.step(2);
  const released = !pl.holding && !M.held && M.civ.state === 'cower' && M.civ.complied && M.state !== 'dead';
  const samLine = pl.bubble?.text ?? '—';
  game.teleportPlayer([2, 0, 2]); game.playerInvisible = true;
  S.step(60 * 60);   // a quiet minute: nobody comes (Novak's route does not pass the cabinet), she says nothing to anybody
  const quietReported = M.civ.reported; const quietState = M.civ.state;
  // Novak stood beside her, calm, facing her
  N.hold = false; N.pinned = false; N.dazzledUntil = -1; N.heardUpTo = game.eventSeq;   // (back from the lot: free, seeing and hearing again from now)
  N.char.pos = [M.char.pos[0], 0, M.char.pos[2] + 1.5]; N.char.bodyYaw = Math.PI; N.char.aimYaw = N.char.bodyYaw; N.path = []; N.pathGoal = null; N.wait = 4; N.state = 'patrol'; N.awareness = 0; N.char.update(0);   // a stride and a half south of her in the east aisle, facing her (nothing between them: the cluster's end partition is west of both)
  const t0 = game.time; let foundAt = -1, toldAt = -1, novakState = '', esc = 0; const clog0 = S.clog.length;
  for (let f = 0; f < 60 * 20; f++) {
    S.step();
    const t = game.time - t0;
    if (foundAt < 0 && S.clog.slice(clog0).some(l => /found her cowering/.test(l))) foundAt = t;
    if (toldAt < 0 && M.civ.reported) { toldAt = t; novakState = N.state; }
    esc = Math.max(esc, game.escalation);
    if (VERBOSE && f % 60 === 0) console.log(`    ${f1(t)}s ${civiliansSummary(game)} · Novak ${N.state} aw ${f2(N.awareness)} lk ${posS(N.lastKnown)} esc ${game.escalation}`);
  }
  const rows = game.chronicle.events.filter((e: any) => e.kind === 'civilianReported' && e.data.who === 'Marta');
  console.log(`- rows before the grab: [${rowsBefore}] · grabbed: ${grabbed} · her rows in the arm: [${heldRows.join(', ')}]`);
  console.log(`    her answers: ${answers.map(a => `"${a}"`).join(' / ')} · gave: [${kinds.map(k => k ?? '·').join(', ')}] · codes in Sam's head: [${code}]`);
  console.log(`    comply: released ${released} — Sam: "${samLine}" · after a quiet minute: ${quietState}, reported ${quietReported} · Novak beside her: found ${f2(foundAt)} s, told ${f2(toldAt)} s (${novakState}), esc ${esc}, rows ${rows.map((e: any) => e.data.how).join(',')}`);
  let ok = verdict(/grab/.test(rowsBefore) && grabbed, "from close behind her the row is 'grab', and the grab takes: she is in his arm (Player.holding, Guard.held)", `rows [${rowsBefore}], grabbed ${grabbed}`);
  ok = verdict(heldRows.join(',') === 'question,comply,choke', "her rows in the arm are exactly question · comply · choke (no pistol-whip with the hands empty, no letting-go row for a guard's shape)", heldRows.join(', ')) && ok;
  const K0 = game.devices?.padNear(M.char.pos); const digits = K0 ? K0.def.code.split('').map((d: string) => ['oh', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'][Number(d)]).join(' ') : '??';
  ok = verdict(CIV_LINES.heldFear.includes(answers[0]) && /sticky/i.test(answers[1]) && answers[1].toLowerCase().includes(digits) && kinds[1] === 'code' && code === 'pad_side' && CIV_LINES.intel.cleaner.includes(answers[2]), "fear first; then the side door's digits in the LEVEL's own numbers (dialogue kind 'code' — Sam learns pad_side); then who walks where", `digits '${digits}' in "${answers[1]}"; [${kinds.join(', ')}] codes [${code}]`) && ok;
  ok = verdict(released && CIV_LINES.comply.sam.includes(samLine), "'stay down, stay quiet': out of the arm on her feet, crouched where she stands, complied — Sam's own line over Sam", `released ${released}, "${samLine}"`) && ok;
  ok = verdict(!quietReported && quietState === 'cower', 'a quiet minute later she is still down and has told NOBODY (no guard passed her corner)', `${quietState}, reported ${quietReported}`) && ok;
  ok = verdict(foundAt >= CIV.foundSecs - 0.05 && foundAt < 3 && toldAt > foundAt && toldAt - foundAt < 5 && novakState === 'search' && esc >= 1 && rows.length === 1 && rows[0].data.how === 'found', "a calm man stood beside her asks inside a couple of seconds, she tells him (the arm at her throat: 'grabbed, armed'), he searches it and the floor goes up; the card's row says he found her hiding", `found ${f2(foundAt)}, told ${f2(toldAt)}, ${novakState}, esc ${esc}, rows ${rows.length}`) && ok;
  console.log(`=== civilians-comply: ${ok ? 'ALL PASS' : 'FAILURES above'} ===`); if (!ok) failures++;
  return ok;
}

// ================================================================ scoring, the men finding them, the fail rule
export async function civiliansScoring() {
  console.log('\n=== civilians-scoring: the takedown on the cleaner (−10), a round in the worker (−40, the badge gone), found by the men (a body each, the dead one locks it down, control says so); tune.civilianKillFails fails the run on the frame ===');
  let ok = true;
  for (const fails of [false, true]) {
    const S = await stage(61); const { game, pl, M, O, N, K } = S;
    game.tune.civilianKillFails = fails;
    S.step(60 * 2);
    game.playerInvisible = false; game.teleportPlayer([M.char.pos[0] - 0.6, 0, M.char.pos[2]]); pl.char.bodyYaw = Math.PI / 2; pl.holstered = true; S.step(2);
    startTakedown(game, M); S.step(50);
    const D1 = debriefOf(game);
    game.teleportPlayer([O.char.pos[0] - 2.5, 0, O.char.pos[2] - 1.2]); pl.holstered = false; pl.slot = 'pistol'; S.step(2);
    fireWeapon(game, pl.char, O.char.bones.chest ?? v3.add(O.char.pos, [0, 0.9, 0]), true); S.step(2);
    const stageAfterShot = game.mission.stage; const D2 = debriefOf(game);
    if (fails) {
      console.log(`- with the fail rule ON: after the round the mission is '${stageAfterShot}', down card due ${game.mission.downCardAt > 0 ? f1(game.mission.downCardAt - game.time) + ' s' : 'never'}; card state ${D2.state}, score ${D2.score}`);
      ok = verdict(stageAfterShot === 'failed' && game.mission.downCardAt > game.time && D2.state === 'down' && !D2.counts.down, 'a civilian killed by his hand fails the mission on the frame (Sam still standing), the down card due a beat later', `${stageAfterShot}, card ${D2.state}`) && ok;
      continue;
    }
    game.teleportPlayer([2, 0, 2]); game.playerInvisible = true;
    // the men: Novak walks onto the worker's body (put him three metres north of it, facing it); Kowalski onto the cleaner
    const place = (gd: any, body: any, dx: number, dz: number) => { const b = body.char.bones.hips ?? body.char.pos; gd.char.pos = [b[0] + dx, 0, b[2] + dz]; gd.char.bodyYaw = Math.atan2(-dx, -dz); gd.char.aimYaw = gd.char.bodyYaw; gd.path = []; gd.pathGoal = null; gd.wait = 3; gd.state = 'patrol'; gd.awareness = 0; gd.hold = true; gd.leader = null; gd.post = null; gd.char.update(0); };   // (held on the spot facing the body: a locked-down floor would otherwise walk him off to his pair / post before his eyes settle)
    S.step(90); place(N, O, 0, -3);
    let escAfterDead = 0; const msgs: string[] = []; const seenMsg = new Set<object>();
    for (let f = 0; f < 60 * 10; f++) { S.step(); escAfterDead = Math.max(escAfterDead, game.escalation); for (const m of game.messages) if (!seenMsg.has(m)) { seenMsg.add(m); msgs.push(m.text); } }
    place(K, M, -1.2, 3);   // (Kowalski a stride into the east aisle south of her, facing her: west of her would be inside the desks)
    for (let f = 0; f < 60 * 8; f++) { S.step(); for (const m of game.messages) if (!seenMsg.has(m)) { seenMsg.add(m); msgs.push(m.text); } }
    const D3 = debriefOf(game);
    const outrage = msgs.filter(m => /^radio: CONTROL — .*dead/.test(m));
    const foundLines = S.tap.lines.filter(l => l.radio && /(DOWN|DEAD)\./.test(l.text));
    console.log(`- takedown on Marta: ${M.state}/${M.downKind}/${M.downBy} → score ${D1.score} [${D1.lines.map((l: any) => `−${l.pts} ${l.label}`).join(', ')}]`);
    console.log(`  round in Owen: ${O.state}/${O.downKind} → score ${D2.score} [${D2.lines.map((l: any) => `−${l.pts} ${l.label}`).join(', ')}] · badges on: ${D2.badges.filter((b: any) => b.on).map((b: any) => b.id).join('/')} · stage ${stageAfterShot}`);
    console.log(`  the men: Owen found ${O.found}, Marta found ${M.found}, esc after the dead one ${escAfterDead}, bodies ${D3.counts.bodies}, calls: ${foundLines.map(l => `${l.who}: "${l.text.slice(0, 60)}…"`).join(' / ')} · control: ${outrage.map(m => `"${m.slice(17, 70)}…"`).join(' / ') || '—'}`);
    console.log(`  summary: ${D3.summary}`);
    ok = verdict(M.state === 'dead' && M.downKind === 'struck' && M.downBy === 'player' && D1.score === 100 - SCORE.civKO && D1.lines.some((l: any) => /civilian.* knocked out/.test(l.label)) && game.chronicle.events.some((e: any) => e.kind === 'civilianKO' && e.data.who === 'Marta'), `the takedown leaves her breathing (struck), −${SCORE.civKO} 'civilian knocked out', a civilianKO row`, `${M.downKind}, ${D1.score}`) && ok;
    ok = verdict(O.state === 'dead' && O.downKind === 'shot' && D2.score === D1.score - SCORE.civKilled - SCORE.shotNear && D2.lines.some((l: any) => /CIVILIAN.* KILLED/.test(l.label)) && !D2.badges.find((b: any) => b.id === 'unseenStaff').on && stageAfterShot !== 'failed' && game.chronicle.events.some((e: any) => e.kind === 'civilianKilled' && e.data.who === 'Owen'), `the round kills him: −${SCORE.civKilled} 'CIVILIAN KILLED' (+ the round near a man), the 'unseen by staff' badge gone, the mission NOT failed with the rule off, a civilianKilled row`, `${O.downKind}, ${D2.score}, stage ${stageAfterShot}`) && ok;
    ok = verdict(O.found && M.found && D3.counts.bodies === 2 && escAfterDead === 2 && foundLines.length >= 2 && outrage.length === 1, "the men find both like any bodies (2 on the card): the DEAD one radios 'DEAD', locks the floor down (2) and control's fury follows once; the cold one 'DOWN. out cold, breathing'", `found ${O.found}/${M.found}, bodies ${D3.counts.bodies}, esc ${escAfterDead}, ${foundLines.length} calls, ${outrage.length} control line(s)`) && ok;
    ok = verdict(/civilians: saw you 0 · told them 0 · KO 1 · KILLED 1/.test(D3.summary), "the summary line carries the civilian block ('civilians: saw you 0 · told them 0 · KO 1 · KILLED 1')", D3.summary.replace(/^.*?civilians:/, 'civilians:').slice(0, 60)) && ok;
  }
  console.log(`=== civilians-scoring: ${ok ? 'ALL PASS' : 'FAILURES above'} ===`); if (!ok) failures++;
  return ok;
}

// ================================================================ hearing
export async function civiliansHearing() {
  console.log("\n=== civilians-hearing: the suppressed pistol's report six metres from the worker at his desk frightens him ('shot'); eleven metres off across the farm it does not — the guards' own odd-noise reach; the FN2000's crack anywhere on the floor does ===");
  const lvl = WEAPONS.fiveseven.report.level; const reach = 7 * 1 * Math.max(0.3, lvl / 0.6) + 0.5;
  console.log(`    Five-seveN report level ${lvl} → odd-noise reach ${f2(reach)} m of open air (7 × carry × max(0.3, level/0.6) + 0.5); FN2000 level ${WEAPONS.fn2000.report.level} (≥ 1: gunfire, the whole floor)`);
  let ok = true;
  const cases: { name: string; at: Vec3; to: Vec3; weapon: 'pistol' | 'rifle'; want: boolean }[] = [
    { name: 'suppressed pistol 6 m off up the west aisle, into the west partition', at: [14.3, 0, 13.8], to: [12.3, 1.0, 13.9], weapon: 'pistol', want: true },
    { name: 'suppressed pistol 11 m off across the farm, into the east wall', at: [26.2, 0, 19.4], to: [27.9, 1.0, 19.0], weapon: 'pistol', want: false },
    { name: 'the FN2000 25 m off in the corridor', at: [33.0, 0, 11.2], to: [35.8, 1.0, 11.2], weapon: 'rifle', want: true },
  ];
  for (const c of cases) {
    const S = await stage(71); const { game, pl, O, M } = S;
    for (const gd of game.guards) { gd.hold = true; gd.pinned = true; gd.dazzledUntil = 1e9; gd.heardUpTo = 1e12; gd.char.pos = [-40, 0, -40]; gd.char.update(0); }   // the shift parked deaf and blind out of it: this is about HIS ears
    M.civ.state = 'gone';   // and the cleaner off the floor: her scream would frighten him second-hand
    for (let i = 0; i < 60 * 3; i++) S.step();
    if (!(O.wp === 0 && O.wait > 0 && O.civ.seated)) { for (let i = 0; i < 60 * 60 && !(O.wait > 0 && O.civ.seated); i++) S.step(); }
    game.teleportPlayer(c.at); pl.holstered = false; pl.slot = c.weapon === 'rifle' ? 'rifle' : 'pistol'; pl.crouch = true; S.step(3);
    const d = v3.distXZ(pl.char.pos, O.char.pos);
    const prop = game.col.sound.propagate(v3.add(pl.char.pos, [0, 1, 0]), v3.add(O.char.pos, [0, 1.5, 0]));
    fireWeapon(game, pl.char, c.to, true); S.step(20);
    const C = O.civ; const got = C.state !== 'work';
    console.log(`- ${c.name}: Sam at ${posS(pl.char.pos)}, ${f1(d)} m straight, path ${f1(prop.pathLen)} m carry ${f2(prop.carry)} → Owen ${C.state}${C.cause ? ` [${C.cause}]` : ''} (Marta ${M.civ.state})`);
    ok = verdict(got === c.want && (!c.want || C.cause === (c.weapon === 'rifle' ? 'gunfire' : 'shot')), c.name + (c.want ? ' frightens him' : ' does not reach him'), `${C.state}${C.cause ? '/' + C.cause : ''}, path ${f1(prop.pathLen)} m vs reach ${c.weapon === 'rifle' ? '80 (gunfire)' : f2(reach * prop.carry - 0.5 * (prop.carry - 1)) + ' m'}`) && ok;
  }
  console.log(`=== civilians-hearing: ${ok ? 'ALL PASS' : 'FAILURES above'} ===`); if (!ok) failures++;
  return ok;
}

// ================================================================ determinism
async function detRun(): Promise<{ log: string[]; pos: string; lines: string[] }> {
  const S = await stage(91, { greet: true }); const { game, M, O } = S;
  const clog0 = S.clog.length;
  for (let f = 0; f < 60 * 90; f++) {
    S.step();
    if (f === 60 * 20) civPanic(game, M, 'panic');
    if (f === 60 * 55) civPanic(game, O, 'phone');
  }
  return { log: S.clog.slice(clog0), pos: `${M.char.pos.map((x: number) => x.toFixed(3)).join(',')} | ${O.char.pos.map((x: number) => x.toFixed(3)).join(',')} | ${M.civ.state} ${O.civ.state}`, lines: S.tap.lines.map(l => `${f2(l.t)} ${l.who}: ${l.text}`) };
}
export async function civiliansDeterminism() {
  console.log('\n=== civilians-determinism: the same seeded 90 s twice (a fright at 20 s, a phone run at 55 s, greetings on): the module log, everybody\'s lines and the civilians\' positions identical ===');
  const A = await detRun(); const B = await detRun();
  let firstDiff = -1; for (let i = 0; i < Math.max(A.log.length, B.log.length); i++) if (A.log[i] !== B.log[i]) { firstDiff = i; break; }
  let lineDiff = -1; for (let i = 0; i < Math.max(A.lines.length, B.lines.length); i++) if (A.lines[i] !== B.lines[i]) { lineDiff = i; break; }
  console.log(`    run A: ${A.log.length} log lines, ${A.lines.length} spoken; ends ${A.pos}`);
  if (VERBOSE) for (const l of A.log) console.log('      ' + l);
  let ok = verdict(firstDiff < 0 && A.log.length > 8, 'the module log identical line for line (and there is one: a fright and a call happened)', firstDiff < 0 ? `${A.log.length} lines` : `differs at ${firstDiff}: "${A.log[firstDiff]}" vs "${B.log[firstDiff]}"`);
  ok = verdict(lineDiff < 0, 'every line said (men and civilians) identical', lineDiff < 0 ? `${A.lines.length} lines` : `differs at ${lineDiff}: "${A.lines[lineDiff]}" vs "${B.lines[lineDiff]}"`) && ok;
  ok = verdict(A.pos === B.pos, 'both civilians end on the same millimetre in the same state', A.pos === B.pos ? A.pos : `${A.pos} vs ${B.pos}`) && ok;
  console.log(`=== civilians-determinism: ${ok ? 'ALL PASS' : 'FAILURES above'} ===`); if (!ok) failures++;
  return ok;
}

// ================================================================ identity: their presence alone moves nothing of the men's night
async function identityRun(mode: 'off' | 'on' | 'greet'): Promise<{ digest: string; frames: number; states: string; trace: string[]; civ: string }> {
  Math.random = seeded(4401); knobsBack(); CIV.greet = mode === 'greet';
  const W = await standUp(); const { game } = W; const pl = game.player;
  game.godMode = true; game.aiEnabled = true;
  if (mode === 'off') { game.tune.civilians = false; game.civilians.length = 0; }
  for (let i = 0; i < 5; i++) W.step(DT);
  game.teleportPlayer([2.0, 0, 2.0]); game.playerInvisible = true; pl.crouch = true;
  const D = new Digest(); let states = ''; const trace: string[] = [];
  const FRAMES = 60 * 180;
  for (let frame = 0; frame < FRAMES; frame++) {
    pl.visibility = 0.02; W.step(DT);
    const h0 = D.h;
    for (const gd of game.guards) { D.add(gd.state); D.vec(gd.char.pos); D.num(gd.char.bodyYaw); D.num(gd.char.aimYaw); D.num(gd.char.aimPitch); D.num(gd.awareness); D.num(gd.wp); D.num(gd.wait); D.num(gd.path.length); D.num(gd.pathI); D.num(gd.speed); D.num(gd.char.anim.lookYawExtra); D.add(gd.bubble ? gd.bubble.text : '~'); D.num(gd.hold ? 1 : 0); D.add(gd.lastKnown ? gd.lastKnown.join(',') : '~'); }
    D.vec(pl.char.pos); D.num(game.events.length); D.num(game.messages.length); D.num(game.escalation);
    for (const d of game.doors.list) D.num(d.angle);
    if (frame % 30 === 0) trace.push(`${f1(game.time)}s ${(D.h ^ h0).toString(16)} ` + game.guards.map((g: any) => `${g.callsign[0]}:${g.state[0]}${g.wp} ${posS(g.char.pos)} ${g.bubble && game.time - g.bubble.t < g.bubble.dur ? '"' + g.bubble.text.slice(0, 24) + '"' : ''}`).join(' ') + ` msgs ${game.messages.length} doors ${game.doors.list.map((d: any) => f2(d.angle)).join(',')}`);
    if (frame % 600 === 0) states += game.guards.map((g: any) => `${g.state[0]}${g.wp}`).join('') + ' ';
  }
  return { digest: D.hex, frames: FRAMES, states, trace, civ: game.civilians.length ? civiliansSummary(game) + ` · greetings ${CIV_STATS.greetings}` : 'none' };
}
export async function civiliansIdentity() {
  console.log("\n=== civilians-identity: three quiet seeded minutes of the night floor digested frame by frame over the SHIFT, the events, the messages, the alarm and every leaf — civilians ON (greetings off) must equal civilians OFF; greetings on is printed as information ===");
  const g0 = CIV_STATS.greetings;
  const OFF = await identityRun('off'); const ON = await identityRun('on'); const GREET = await identityRun('greet');
  const firstDiff = (A: string[], B: string[]) => { for (let i = 0; i < Math.max(A.length, B.length); i++) if (A[i] !== B[i]) return `first differing half-second: OFF ${A[i]} | ON ${B[i]}`; return 'no trace difference'; };
  console.log(`    OFF   ${OFF.digest} · ${OFF.states.trim()}`);
  console.log(`    ON    ${ON.digest} · ${ON.states.trim()} · ${ON.civ}`);
  console.log(`    GREET ${GREET.digest} · ${GREET.states.trim()} · ${GREET.civ} (greetings this run ${CIV_STATS.greetings - g0})`);
  let ok = verdict(ON.digest === OFF.digest && ON.states === OFF.states, 'civilians ON with the greetings off == civilians OFF: their walking, kneeling, sitting, door contacts and prop contacts on the authored loops move nothing of the men\'s three minutes (state / position / aim / awareness / waypoint / wait / path / neck / bubble / fix), nor the events, the messages, the alarm or any leaf', ON.digest === OFF.digest ? `${ON.digest} over ${ON.frames} frames` : `${ON.digest} vs ${OFF.digest} — ${firstDiff(OFF.trace, ON.trace)}`);
  console.log(`- INFO — greetings ON: ${GREET.digest === OFF.digest ? 'identical too (no calm man passed within three metres of a working civilian in these minutes)' : `differs (${firstDiff(OFF.trace, GREET.trace)}) — a man answering 'Evening, Marta' has a line in the air, and the ambient chatter waits for it: the one designed coupling of an unprovoked civilian, off with CIV.greet`}`);
  if (PRINT) { console.log('\n--- OFF trace ---'); for (const l of OFF.trace) console.log(l); console.log('\n--- ON trace ---'); for (const l of ON.trace) console.log(l); }
  console.log(`=== civilians-identity: ${ok ? 'ALL PASS' : 'FAILURES above'} ===`); if (!ok) failures++;
  return ok;
}
void civilianLines;
