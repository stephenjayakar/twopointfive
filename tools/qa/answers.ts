// THE DEFENDERS' ANSWER TO THE PLAN, level by level — one table: every listed squad mission × three plans (a loud entry at the front, a quiet one at the back,
// the mains cut) → the move the garrison makes, and what of it the team could hear or see before it lands.
//   bun run tools/qa/answers.ts [--scn id,id] [--plan loud,quiet,lights] [--seed n] [--json file] [--verbose]     (TPS_PROFILE=shipped in front = the page's rules)
// exit 0 = every level answers the three plans with three different moves, each with word of it before it lands · 1 = a level does not · 2 = bad arguments
//
// HOW A PLAN IS STAGED (the mission as its row starts it but with no teammates — `squad=0` — and Sam out of everybody's sight: what is read is the garrison,
// not a fight; a man who walks out meets nobody):
//   · FRONT and BACK are read off the floor, not written in it: of the rooms the room fight's defenders hold, the FRONT is the one whose door is the shortest
//     walk from where Sam starts, the BACK the one whose nearest door is the longest.
//   · loud   — a charge's report at the front room's door, a stun charge's a stride inside, three seconds of unsuppressed fire there, and the room's men shot.
//   · quiet  — the back room's men put down one a second without a sound (combat.ts killGuard, quiet): nothing is filed for anybody's ears.
//   · lights — the mains thrown by hand (Game.setBlackout): the team's hand on the breaker, wherever it is.
// WHAT IS READ, for `secs` after it: every living defender who gets further than `MOVE_M` from where he stood; how near any of them comes to the noise, to a
// post that went silent, and to the breaker; whether any man digs in (digin.ts); every line their side puts on its net (the WORD is the first of them the
// team's strip would rank as a move — cues.ts cueClass 1 — else as holding, else any that is not a routine check); the first boot a mover files for the
// team's ears and the first frame a mover's lamp burns. THE MOVE is named by where the movers got to:
//     counter  a man comes to the noise (inside `NOISE_M` of it)          look     a man comes to a post that went silent (inside `POST_M`)
//     lights   a man comes to the breaker (inside `LEVER_M`)             pull     a rescue: a man comes off his post to the hostage room's door (inside
//                                                                                 `PULL_M`, or stopped nearer it than his post with a line on it)
//     away     men moved, to none of those
//     brace    nobody came, a man dug in                                  words    nobody moved or dug in; their net spoke          none   nothing at all
// IT LANDS when the first mover is inside that distance (brace: the first man digging in). THE TELEGRAPH is the earliest of a line on their net, a mover's boot
// and a mover's lamp; `lead` = lands − telegraph. A level HOLDS when its three plans draw three different moves out of counter / look / lights / pull / brace,
// each with a lead of `LEAD_S` or more. A level with ONE defended room has no front and back to choose between (a loud way in there is the room's own
// fight): it is printed ONE ROOM, held to the lights plan alone, and counted apart from the levels that hold.
// THE HARNESS HAS NO GPU: a lamp is a flag, a line is a string, a boot is an event. Nobody has seen or heard any of this in play.
import { resolve } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
const ROOT = resolve(import.meta.dir, '../..');
const MOVE_M = 1.5, NOISE_M = 6, COVER_M = 25, POST_M = 3.5, LEVER_M = 2.5, PULL_M = 6, LEAD_S = 1.5, DT = 1 / 60;
const SECS = { loud: 45, quiet: 90, lights: 45 } as const;
type Plan = keyof typeof SECS;
type Kind = 'counter' | 'look' | 'lights' | 'pull' | 'away' | 'brace' | 'words' | 'none';
export interface Answer { scn: string; plan: Plan; kind: Kind; men: string[]; word: number; boots: number; lamp: number; leave: number; lands: number; lead: number; line: string; lines: string[]; nearNoise: number; nearPost: number; nearLever: number; note: string; /** one defended room: the quiet plan has no back to be run at, and is not held against the row */ oneRoom?: boolean; /** where each man who left his post went, a point every half second from the plan's first frame (his post first) */ tracks: { who: string; pts: number[][]; /** when each point was read, s from the plan's first frame (his post: when he left it) */ t: number[] }[]; /** the loud plan's noise: the front room's door */ noise: number[] | null; /** squads staged on the floor · the run's digest at its last frame (digest.ts) */ squads: number; digest: string }

/** what a run asks: which rows (absent: every listed one), which plans, the seed, hard, the trace */
/** the listed rows, for a caller that asks one plan of one of them */
export const answerRow = (id: string): any => rows.find(e => e.id === id) ?? null;
export function answerSetup(o: { seed?: number; hard?: boolean } = {}) { SEED = o.seed ?? 7; HARD = !!o.hard; VERBOSE = false; }
export interface AnswersOpts { scn?: string[]; plans?: Plan[]; seed?: number; hard?: boolean; verbose?: boolean; json?: string; print?: boolean }
export interface Verdict { id: string; ok: boolean; /** one defended room: held to the lights plan alone */ oneRoom?: boolean; why: string[]; answers: Answer[] }
let HARD = false, VERBOSE = false, SEED = 7, PLANS: Plan[] = ['loud', 'quiet', 'lights'];

export function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const quiet = async <T>(fn: () => Promise<T> | T): Promise<T> => { if (VERBOSE) return await fn(); const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => {}; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };

const { standUp } = await import('./headless.ts');
const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`), { scenarioQuery } = await import(`${ROOT}/src/scene/scenarios.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`), { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { cueClass } = await import(`${ROOT}/src/game/cues.ts`);
const { killGuard } = await import(`${ROOT}/src/game/combat.ts`), { digInPhase } = await import(`${ROOT}/src/game/digin.ts`), { isHostile } = await import(`${ROOT}/src/game/teams.ts`); const { setDifficulty, difficultyNow } = await import(`${ROOT}/src/game/difficulty.ts`);
const { squadsReport } = await import(`${ROOT}/src/game/enemysquads.ts`), { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);

const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const f1 = (x: number) => Number.isFinite(x) ? x.toFixed(1) : '—';
const rows = (SCENARIOS as any[]).filter(e => (e.kind === 'roomclear' || e.kind === 'rescue' || e.kind === 'nightbreach') && !e.offList);

const blank = (scn: string, plan: Plan, note = ''): Answer => ({ scn, plan, kind: 'none', men: [], word: NaN, boots: NaN, lamp: NaN, leave: NaN, lands: NaN, lead: NaN, line: '', lines: [], nearNoise: NaN, nearPost: NaN, nearLever: NaN, note, tracks: [], noise: null, squads: 0, digest: '' });
/** the mission of a row stood up as every plan is read on it: no teammates, Sam out of everybody's sight (`stood`: the caller's hand on the switches the
 *  moment the game stands, before the mission starts). The caller owns Math.random and the difficulty: see `answer` */
export async function answerStand(E: any, stood?: (g: any) => void): Promise<{ W: any; g: any; why: string | null }> {
  const W: any = await quiet(() => standUp({ uploadEvery: 4, ...(E.level ? { level: loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', E.level), 'utf8'))) } : {}) })), g = W.game;
  g.playerInvisible = true; g.godMode = true; stood?.(g);
  const { why } = await quiet(() => startFromQuery(g, new URLSearchParams((scenarioQuery(E) as string).replace(/&squad4\b/, '').replace(/&squad=\d\b/, '') + '&squad=0')));
  return { W, g, why: why ?? null };
}
/** one row's one plan. `before`: the caller's hand on the floor the frame before the plan starts (a check that blows a wall first); `stood`: its hand on the
 *  switches the moment the game stands, before the mission starts; `take`: the most men the plan puts down (absent: the room's). The dice and the difficulty
 *  are put back as they were found */
export async function answer(E: any, plan: Plan, before?: (g: any, W: any, at: { noise: number[] | null }) => void | Promise<void>, stood?: (g: any) => void, take = Infinity): Promise<Answer> {
  const rnd0 = Math.random, diff0 = difficultyNow();
  try { Math.random = seeded(SEED); setDifficulty(HARD ? 'hard' : 'standard', false); return await answer0(E, plan, before, stood, take); }
  finally { Math.random = rnd0; setDifficulty(diff0, false); }
}
async function answer0(E: any, plan: Plan, before: ((g: any, W: any, at: { noise: number[] | null }) => void | Promise<void>) | undefined, stood: ((g: any) => void) | undefined, take: number): Promise<Answer> {
  const out = blank(E.id, plan);
  const { W, g, why } = await answerStand(E, stood); if (why) { out.note = `start refused: ${why}`; return out; }
  out.squads = (squadsReport(g) as any[]).length;
  const step = (n: number, each?: () => void) => quiet(async () => { for (let i = 0; i < n; i++) { W.step(DT); each?.(); } });
  await step(90);
  const alive = (gd: any) => gd.state !== 'dead' && gd.char.alive;
  const defs: any[] = g.fight.defs.filter((D: any) => D.gd.unit && isHostile(D.gd.team, 'player') && alive(D.gd));
  if (!defs.length) { out.note = 'no room fight defenders on this floor'; return out; }
  // front and back, off the floor
  const sam: number[] = [...g.player.char.pos], walk = (to: number[]) => { const p = g.col.nav.findPath(sam, to, 20000); if (!p?.length) return flat(sam, to) + 1000; let L = 0, w0 = sam; for (const w of p) { L += flat(w0, w); w0 = w; } return L; };
  const rooms = [...new Set(defs.map(D => D.room).filter(Boolean))].map((R: any) => { const es = R.entries.map((e: any) => ({ at: [...e.at] as number[], L: walk(e.at) })).sort((a: any, b: any) => a.L - b.L); return { R, men: defs.filter(D => D.room === R).map(D => D.gd), door: es[0]?.at ?? null, L: es[0]?.L ?? Infinity }; }).filter(r => r.door).sort((a, b) => a.L - b.L);
  const captor = g.rescue?.captor?.() ?? null;
  // (a room is a front or a back by the men in it the plan can take: the man who holds the hostages is not one of them)
  // — and the back is not the room he stands in while another room has such a man: nobody is put down without a sound at the captor's elbow
  const held = rooms.filter(r => r.men.some((gd: any) => gd !== captor)), front = held[0] ?? rooms[0] ?? null, far = held.filter(r => r !== front && !r.men.includes(captor)), back = far.length ? far[far.length - 1] : held.length > 1 ? held[held.length - 1] : null;
  out.oneRoom = rooms.length === 1;
  const keep: number[] | null = captor ? [...((g.rescue as any).roomPoint?.('outside') ?? captor.char.pos)] : null;   // (the hostage room's door, from outside: where the rescue sends a roamer with nothing loud to go to)
  const breaker: number[] | null = g.level.breaker ? [...g.level.breaker.pos] : null;
  let victims: any[] = [], noise: number[] | null = null;
  if (plan === 'loud') { if (!front) { out.note = 'no defended room with a door'; return out; } victims = front.men.filter((gd: any) => gd !== captor); noise = front.door; }
  if (plan === 'quiet') { const from = back ?? front; if (!from) { out.note = 'no defended room with a door'; return out; } victims = from.men.filter((gd: any) => gd !== captor); if (!back) out.note = 'one defended room: its own men are the silent posts'; }
  if (plan === 'lights' && !breaker) { out.note = 'no breaker on this floor'; return out; }
  victims = victims.slice(0, take);
  if (plan !== 'lights' && victims.length >= defs.length) { victims = victims.slice(0, Math.max(1, defs.length - 1)); out.note = (out.note ? out.note + ' · ' : '') + 'one man of the room left standing (the floor has no other)'; }
  const posts = victims.map(gd => [...gd.char.pos]);
  const watch = defs.map(D => D.gd).filter(gd => !victims.includes(gd)), post = new Map<any, number[]>(watch.map(gd => [gd, [...gd.char.pos]])), ids = new Map<number, any>(watch.map(gd => [gd.char.id, gd]));
  const roused0 = watch.filter(gd => gd.state === 'alert' || gd.state === 'search').length; if (roused0) out.note = (out.note ? out.note + ' · ' : '') + `${roused0} of theirs already roused before the plan`;
  const lines: { t: number; s: string }[] = [], msg0 = g.msg.bind(g); g.msg = (s: string) => { if (/\(radio\): /.test(s)) lines.push({ t: g.time, s }); return msg0(s); };
  out.noise = noise ? [...noise] : null;
  if (before) await quiet(async () => before(g, W, { noise }));
  // the plan
  const t0 = g.time, inside: number[] | null = noise && front ? (() => { const c = front.men.reduce((a: number[], gd: any) => [a[0] + gd.char.pos[0] / front.men.length, 0, a[2] + gd.char.pos[2] / front.men.length], [0, 0, 0]), d = Math.max(0.01, flat(noise!, c)), k = Math.min(1.5, d) / d; return [noise![0] + (c[0] - noise![0]) * k, 0, noise![2] + (c[2] - noise![2]) * k]; })() : null;
  if (plan === 'lights') g.setBlackout(86400, 'hand');
  if (plan === 'loud') g.events.push({ kind: 'bang', pos: [...noise!], time: g.time, loud: true, charge: true });
  const trace: string[] = []; let frame = 0, lastEv = g.time; const movers = new Set<any>(), near = { noise: Infinity, post: Infinity, lever: Infinity }; let dug = NaN, pullAt = NaN; const dug0 = new Map<any, string>(), setAt = new Map<any, number>();
  const at = { leave: NaN, boots: NaN, lamp: NaN, noise: NaN, post: NaN, lever: NaN, rest: NaN }, was = new Map<any, number[]>(), still = new Map<any, number>();
  await step(SECS[plan] * 60, () => { frame++; const t = g.time - t0;
    if (plan === 'loud') {
      if (frame === 30) g.events.push({ kind: 'bang', pos: [...inside!], time: g.time, loud: true });
      if (frame >= 48 && frame <= 228 && frame % 12 === 0) g.events.push({ kind: 'shot', pos: [...inside!], time: g.time, loud: true });
      const k = (frame - 60) / 24; if (Number.isInteger(k) && k >= 0 && k < victims.length && alive(victims[k])) killGuard(g, victims[k], [0, 0, 1], false);
    }
    if (plan === 'quiet' && frame % 60 === 1) { const i = (frame - 1) / 60; if (i < victims.length && alive(victims[i])) killGuard(g, victims[i], [0, 0, 1], true); }
    for (const e of g.events as any[]) if (e.kind === 'step' && e.time > lastEv - 1e-9 && e.time <= g.time && ids.has(e.who) && movers.has(ids.get(e.who)) && !(at.boots <= t)) at.boots = t;
    lastEv = g.time;
    if (VERBOSE && frame % 30 === 0 && t < 14) trace.push(`   men ${f1(t)} ${g.guards.filter((x: any) => x.team !== 'operative' && x.state !== 'dead').map((x: any) => `${x.callsign}:${x.state}${x.task ? `/${x.task.kind}` : ''}${ids.has(x.char.id) ? '' : '(not a defender)'}${x.state === 'alert' || x.state === 'search' ? `[by ${x.witness.alertedBy} · heard ${JSON.stringify(x.witness.heard)} · saw ${x.witness.sawAct}/${x.witness.sawBody} · aw ${x.awareness.toFixed(2)} · seenT ${(g.time - x.lastSeenT).toFixed(1)}]` : ''}`).join(' ')}`);
    for (const gd of watch) { if (!alive(gd)) continue; const p = gd.char.pos, off = flat(p, post.get(gd)!);
      if (off > MOVE_M && !movers.has(gd)) { movers.add(gd); if (!(at.leave <= t)) at.leave = t; }
      { const ph = digInPhase(g, gd); if (!dug0.has(gd)) dug0.set(gd, ph); if (ph === 'set' && dug0.get(gd) !== 'set' && !setAt.has(gd)) { setAt.set(gd, t); dug = t; } }   // (dug in = SET: thought, door shut or wedged, furniture hauled, gun on the door — a man already set when the plan starts has not answered it. `dug` ends as the LAST man's: locked doors have landed when the last of them is set, and the men still wedging theirs after the word are what the team can beat)
      if (!movers.has(gd)) continue;
      if (frame % 30 === 0) { let T = out.tracks.find(x => x.who === gd.callsign); if (!T) out.tracks.push(T = { who: gd.callsign, pts: [[...post.get(gd)!]], t: [t] }); T.pts.push([...p]); T.t.push(t); }
      if (frame % 30 === 0) { const q = was.get(gd); const stood = !!q && flat(p, q) < 0.15; if (stood && !(at.rest <= t)) at.rest = t; if (!stood) still.delete(gd); else if (!still.has(gd)) still.set(gd, t); was.set(gd, [...p]); }   // (he has stopped: where he was going, he is)
      if (gd.flashlight?.enabled && !gd.unit.light && !(at.lamp <= t)) at.lamp = t;
      // (he has ARRIVED inside the place's own reach, or — his post nearer the place than twice that — once he has covered half the way: a man three metres
      // from his mate's post has not landed the moment he stirs)
      const p0 = post.get(gd)!, reach = (R: number, q: number[]) => Math.min(R, flat(p0, q) / 2);
      if (noise) { const d = flat(p, noise); near.noise = Math.min(near.noise, d); if (d <= reach(NOISE_M, noise) && !(at.noise <= t)) at.noise = t; }
      // (COVERING the hostage door: off his post now, nearer the door than his post is, and stopped a second or more at a spot with a clear line on it at
      // gun height — a lone man does not walk up to a door he expects them at, he takes a corner that has it under his gun: tactics.ts)
      const covers = (q: number[]) => frame % 30 === 0 && off > MOVE_M && flat(p, q) < flat(p0, q) && t - (still.get(gd) ?? Infinity) >= 1 && flat(p, q) <= COVER_M && !g.col.segmentBlocked([p[0], 1.3, p[2]], [q[0], 1.0, q[2]]);
      if (keep && gd !== captor && !(pullAt <= t) && (flat(p, keep) <= reach(PULL_M, keep) || covers(keep))) pullAt = t;
      for (const q of posts) { const d = flat(p, q); near.post = Math.min(near.post, d); if (d <= reach(POST_M, q) && !(at.post <= t)) at.post = t; }
      if (breaker && plan === 'lights') { const d = flat(p, breaker); near.lever = Math.min(near.lever, d); if (d <= reach(LEVER_M, breaker) && !(at.lever <= t)) at.lever = t; }
    } });
  const theirs = lines.filter(l => l.t >= t0).map(l => ({ t: l.t - t0, s: l.s }));
  out.men = [...movers].map(gd => gd.callsign); out.lines = theirs.map(l => `${f1(l.t)} ${l.s}`); { const cls = (l: { s: string }) => cueClass(l.s.replace(/^.*?\(radio\): /, '')), first = theirs.find(l => cls(l) === 1) ?? theirs.find(l => cls(l) === 3 || cls(l) === 5) ?? theirs.find(l => !/radio check/.test(l.s)); out.word = first?.t ?? NaN; out.line = first?.s ?? ''; }   // (the word that counts is one about a move — the strip's 'on the move' class first, then 'holding' — not a routine check)
  out.boots = at.boots; out.lamp = at.lamp; out.leave = at.leave; out.nearNoise = near.noise; out.nearPost = near.post; out.nearLever = near.lever;
  // (a loud plan's dead lie where the noise was: a man who comes to one of them has come to the fight)
  const own = plan === 'loud' ? Math.min(...[at.noise, at.post].filter(Number.isFinite)) : plan === 'quiet' ? at.post : at.lever;
  // (the plan's own place first: a man who comes to the noise on a loud plan is its counter even if his way took him past the breaker)
  // what their squads CHOSE (enemysquads.ts's own timeline): men sent to the fight, or the doors locked — a man who crosses a room to wedge his door has not
  // come to the noise, however near his door is to it
  const chose = (squadsReport(g) as any[]).flatMap(q => q.events).filter((e: any) => e.t >= t0 - 0.05).map((e: any) => e.what as string);
  const sent = chose.some(w => w === 'reinforce' || w === 'flank' || w === 'help'), locked = chose.includes('barricade'), set = Number.isFinite(dug) ? dug : at.rest;
  if (plan === 'loud' && locked && !sent && Number.isFinite(set)) { out.kind = 'brace'; out.lands = set; }
  else if (Number.isFinite(own)) { out.kind = plan === 'loud' ? 'counter' : plan === 'quiet' ? 'look' : 'lights'; out.lands = own; }
  else if (Number.isFinite(at.noise)) { out.kind = 'counter'; out.lands = at.noise; }
  else if (Number.isFinite(at.post)) { out.kind = 'look'; out.lands = at.post; }
  else if (Number.isFinite(pullAt)) { out.kind = 'pull'; out.lands = pullAt; }
  else if (locked && Number.isFinite(set)) { out.kind = 'brace'; out.lands = set; }
  else if (movers.size) { out.kind = 'away'; out.lands = at.leave; }
  else if (Number.isFinite(dug)) { out.kind = 'brace'; out.lands = dug; }
  else if (theirs.length) out.kind = 'words';
  if (VERBOSE) out.lines.push(...trace, ...(g.fight.log as any[]).filter(l => l.t >= t0).slice(0, 80).map(l => `   log ${f1(l.t - t0)} ${l.who}: ${l.what}`));
  const tele = Math.min(...[out.word, at.boots, at.lamp].filter(Number.isFinite)); out.lead = Number.isFinite(tele) && Number.isFinite(out.lands) ? out.lands - tele : NaN;
  out.digest = hashDigest(digestGame(g));
  return out;
}

const GOOD: Kind[] = ['counter', 'look', 'lights', 'pull', 'brace'];
/** the table: each asked row's three plans, its verdict printed (`print: false` = silent), the count of rows that do not hold */
export async function answersRun(o: AnswersOpts = {}): Promise<{ red: number; verdicts: Verdict[] }> {
  HARD = !!o.hard; VERBOSE = !!o.verbose; SEED = o.seed ?? 7; PLANS = o.plans ?? ['loud', 'quiet', 'lights'];
  const say = (t: string) => { if (o.print !== false) console.log(t); };
  for (const id of o.scn ?? []) if (!rows.some(e => e.id === id)) throw new Error(`no such squad mission: ${id} (known: ${rows.map(e => e.id).join(', ')})`);
  const all: Answer[] = [], verdicts: Verdict[] = []; let red = 0, ones = 0;
  say(`\n=== answers: every listed squad mission × ${PLANS.join(' / ')} (seed ${SEED}, ${HARD ? 'hard' : 'standard'}, ${process.env.TPS_PROFILE === 'shipped' ? 'the shipped stand' : 'the frozen stand'}) ===`);
  for (const E of rows) { if (o.scn && !o.scn.includes(E.id)) continue;
    const A: Answer[] = []; for (const plan of PLANS) { try { A.push(await answer(E, plan)); } catch (e) { A.push(blank(E.id, plan, `threw: ${(e as Error).message}`)); } }
    all.push(...A);
    const why: string[] = [], oneRoom = A.some(a => a.oneRoom);
    for (const a of A) { if (oneRoom && a.plan !== 'lights') { if (/^(threw|start refused)/.test(a.note)) why.push(`${a.plan}: ${a.note}`); continue; } if (!GOOD.includes(a.kind)) why.push(`${a.plan}: ${a.kind === 'none' ? 'no answer' : a.kind === 'words' ? 'words only' : 'men moved, to nothing of the plan\'s'}${a.note ? ` (${a.note})` : ''}`); else if (!(a.lead >= LEAD_S)) why.push(`${a.plan}: ${Number.isFinite(a.lead) ? `only ${f1(a.lead)} s of warning` : 'lands with no word, boot or lamp before it'}`); }
    for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) if (A[i].kind === A[j].kind && GOOD.includes(A[i].kind) && !oneRoom) why.push(`${A[i].plan} and ${A[j].plan} draw the same move (${A[i].kind})`);
    const ok = !why.length; if (!ok && A.length === 3) red++;
    verdicts.push({ id: E.id, ok, oneRoom, why, answers: A }); if (ok && oneRoom && A.length === 3) ones++;
    say(`${A.length < 3 ? '-     ' : !ok ? '- FAIL' : oneRoom ? '- ONE ROOM' : '- PASS'} — ${E.id}${oneRoom ? ' (one defended room, no front and back: held to the lights plan)' : ''}${why.length ? `: ${why.join(' · ')}` : ''}`);
    for (const a of A) say(`    ${a.plan.padEnd(6)} ${a.kind.padEnd(7)} ${a.men.length ? `${a.men.length} men` : 'nobody'} · word ${f1(a.word)} · boots ${f1(a.boots)} · lamp ${f1(a.lamp)} · off his post ${f1(a.leave)} · lands ${f1(a.lands)} (lead ${f1(a.lead)}) · nearest: noise ${f1(a.nearNoise)} post ${f1(a.nearPost)} lever ${f1(a.nearLever)} m${a.line ? ` · "${a.line}"` : ''}${a.note ? ` · ${a.note}` : ''}`);
    if (VERBOSE) for (const a of A) for (const l of a.lines) say(`        ${a.plan}: ${l}`);
  }
  if (o.json) writeFileSync(o.json, JSON.stringify({ seed: SEED, hard: HARD, stand: process.env.TPS_PROFILE === 'shipped' ? 'shipped' : 'frozen', answers: all }, null, 1));
  say(`=== answers: ${red ? `${red} level(s) do not answer the three plans with three telegraphed moves` : PLANS.length === 3 ? `ALL PASS${ones ? ` (${ones} of them one room: lights only)` : ''}` : 'read only (not all three plans asked)'} ===`);
  return { red, verdicts };
}

if (import.meta.main) {
  const argv = process.argv.slice(2), flag = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  for (const a of argv) if (a.startsWith('--') && !['--scn', '--plan', '--seed', '--json', '--verbose', '--hard'].includes(a)) { console.error(`unknown flag ${a} (known: --scn id,id · --plan loud,quiet,lights · --seed n · --json file · --verbose · --hard)`); process.exit(2); }
  const seed = Number(flag('--seed') ?? 7), plans = (flag('--plan') ?? 'loud,quiet,lights').split(',') as Plan[];
  if (!Number.isInteger(seed) || plans.some(p => !(p in SECS))) { console.error('--seed takes a whole number, --plan a list out of loud,quiet,lights'); process.exit(2); }
  try { const { red } = await answersRun({ scn: flag('--scn')?.split(','), plans, seed, hard: argv.includes('--hard'), verbose: argv.includes('--verbose'), json: flag('--json') }); process.exit(red ? 1 : 0); }
  catch (e) { console.error((e as Error).message); process.exit(2); }
}
