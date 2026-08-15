// Sam's low whistle (V) — Chaos Theory's "psst": a small deliberate noise to pull ONE man off his line and over to where you were. It is a GameEvent like every
// other sound ('whistle', level WHISTLE.level, at Sam's feet, who = the player) and it reaches the guards through the SAME propagation the mixer and every other
// event use (collision.ts SoundPaths: straight through the air, round the corner along the walkable space and in through the doorway, or dully through a shut
// leaf) — guards.ts hearingCheck hands each man's copy to hearWhistle below. What it does to them:
//   · every living man within WHISTLE.horizon (straight line) whose propagated path is shorter than reachK × carry (× the alarmed floor's keener ear) HEARS it:
//     ~8 m of open air, ~5.8 m round a corner, ~2.6 m through a shut door — the numbers the probes print (tools/qa/whistle-probes.ts);
//   · of the calm men who hear it (patrol / suspicious, on nobody's errand, not choreographed, not in Sam's arm) only the NEAREST by path answers: a line from a
//     small pool, half a second to place it, then he walks over to where it came from — the doorway or corner it came through if it was routed — and looks
//     about, exactly the suspicion a creaking door gives him (awareness 0.45: he talks himself out of it on arrival), torch still in hand, nothing on the net;
//     the others who heard it turn their heads that way for a second and a half and carry on;
//   · the same man answering a SECOND whistle inside twiceWindow seconds stops being polite: a proper search of that area (the 'search' state and its plan of
//     hiding places round the point, gun out), still without a word on the radio unless the search finds something;
//   · a man already hunting (alert / search) takes it as one more fix on where you are — no line, no change of state; a man about to go loud anyway (a shot in the
//     same half second) is not talked down to 'hello?' by it.
// The player's side (whistleKey / tryWhistle): V, anywhere but down, once per `cooldown` seconds — the event, the sound meter's tick, the synthesized two-note
// voice at his head (sfx.ts 'whistle'); no HUD line, it is diegetic. The knobs (WHISTLE) sit in Tab ▸ Sandbox and are kept per machine like the aim rows.
import { Vec3, v3, clamp, wrapAngle } from '../math/vec';
import type { Game, Guard, GameEvent } from './game';
import type { Input } from './input';
import type { UpperMode } from './character';
import { PLAYER_ID } from './consts';
import { isHostile } from './teams';

/** Every number of it (panel-tunable; the QA probes read them rather than copy them). */
export const WHISTLE = {
  /** the hearing-model level stamped on the event and shown on the SOUND meter (a crouched step on lino is ~0.2, a walk 0.33, the suppressed pistol 0.6) */
  level: 0.35,
  /** metres of OPEN AIR it carries (the propagated path must be shorter than this × the route's carry: 1 direct, 0.9 over a partition, 0.72 round a corner,
   *  0.32 through a shut door, 0.25 through the mass) — × KEEN on an alarmed floor, as every small noise */
  reachK: 8,
  /** straight-line pre-filter (m): nobody further off than this is even asked (the propagation is the dear part) */
  horizon: 12,
  /** seconds between two whistles (V inside it does nothing) */
  cooldown: 2,
  /** the same man answering a second one inside this many seconds searches the place properly instead of taking another look */
  twiceWindow: 60,
  /** what answering it leaves him with: the suspicion of a creak (under the 0.85 that is CONTACT, over the 0.3 that is 'huh?'), and the beat he takes to place it */
  awareness: 0.45, reactT: 0.5,
  /** while he is still WALKING over to one, his suspicion is held at least this high (guards.ts, the suspicious branch: it wears off at 0.06/s otherwise, and a spot
   *  eight metres off had him give up two strides short of it); arrived, it drains from here through the look round — ~3 s of torch into the corners — and he
   *  talks himself out of it ('must have been nothing') and goes back. 0 = the creak's behaviour exactly. */
  walkFloor: 0.32,
  /** the others who heard it: how long their heads stay turned toward it (s), and how far round a neck goes for it (rad) */
  glanceSecs: 1.5, glanceMax: 1.2,
  /** the voice's gain at Sam's head (sfx.ts 'whistle' peaks ~0.3: quiet — it is for the man six metres off, not the floor) */
  gain: 0.55,
};
export type WhistleKnobs = typeof WHISTLE;
export const WHISTLE_DEFAULTS: WhistleKnobs = { ...WHISTLE };
/** How the man who answers it CARRIES himself on the way over while it is still only a whistle to him (guards.ts, the suspicious branch, via whistleSoft): 'torch'
 *  = the torch comes up to shoulder height and goes where he looks (the animator's Idle_Torch_Loop over the walk); 'none' = the calm patrol's low carry, the beam
 *  swung up onto the spot from the hip. The one-line taste switch. Either way the pistol stays on his belt until something more than a whistle reaches him. */
export const WHISTLE_SOFT_UPPER: UpperMode = 'torch';

/** what the man who goes to look says (placeholder lines — the writing pass is the designer's), and what he says the second time */
const LOOK_LINES = ['hello?', 'someone there?', '…what was that?', 'who\'s that whistling?', 'somebody down there?'];
const TWICE_LINES = ['right — who\'s messing about?', 'that\'s twice now. come on out.', 'okay. not funny. where are you?'];
/** the whistle's lines, for the QA soak (its own smell, and only ever from a man who has just answered one) */
export function whistleLines(kind: 'look' | 'twice' | 'all' = 'all'): string[] { return kind === 'look' ? [...LOOK_LINES] : kind === 'twice' ? [...TWICE_LINES] : [...LOOK_LINES, ...TWICE_LINES]; }

// ---------------------------------------------------------------- per-man memory (dies with the Guard object: resetGuards makes fresh men)
/** 'never' for respondedAt: far enough back that no twiceWindow the panel allows reaches it, still finite for the logs */
const NEVER = -1e9;
export interface WhistleMem {
  /** game time he last ANSWERED one (went to look / to search), NEVER if not yet; how many answered, how many of those became searches */
  respondedAt: number; responses: number; searches: number;
  /** whistles that reached him while he was already hunting (a fix, nothing said) / that somebody nearer answered (a turned head) */
  cues: number; glances: number;
  /** the turned head: until when, and toward where */
  glanceUntil: number; glanceAt: Vec3 | null;
  /** his current suspicion is a whistle's and nothing more (whistleSoft): set answering one, cleared back on patrol / hunting; softAt = when */
  soft: boolean; softAt: number;
  /** the last line he used from each pool (no saying the same one twice running) */
  lastLook: number; lastTwice: number;
}
const memOf = new WeakMap<Guard, WhistleMem>();
function mem(gd: Guard): WhistleMem {
  let M = memOf.get(gd);
  if (!M) { M = { respondedAt: NEVER, responses: 0, searches: 0, cues: 0, glances: 0, glanceUntil: -1, glanceAt: null, soft: false, softAt: NEVER, lastLook: -1, lastTwice: -1 }; memOf.set(gd, M); }
  return M;
}
/** crane a calm man's head toward a point for `secs` — the whistle's glance lent to any small thing he noticed (a light on the blink: guards.ts hearingCheck); whistlePatrolTick does the craning */
export function glanceToward(g: Game, gd: Guard, at: Vec3, secs = WHISTLE.glanceSecs) { const M = mem(gd); M.glanceUntil = g.time + secs; M.glanceAt = v3.copy(at); }
/** read-only peek for the panel / the QA harness (null: no whistle has ever concerned this man) */
export function whistleMem(gd: Guard): Readonly<WhistleMem> | null { return memOf.get(gd) ?? null; }

// ---------------------------------------------------------------- the player's side
export interface Blower { readyAt: number; blown: number; lastAt: number; }
const blowerOf = new WeakMap<object, Blower>();   // keyed by the Player object: a restart's fresh Sam starts with a fresh breath
function blower(g: Game): Blower { let B = blowerOf.get(g.player); if (!B) { B = { readyAt: -1, blown: 0, lastAt: -100 }; blowerOf.set(g.player, B); } return B; }
/** module-wide counters for the QA soak (events blown, events resolved against the guards, men who answered / searched / took the cue / turned a head) */
export const WHISTLE_STATS = { blown: 0, resolved: 0, heardBy: 0, answered: 0, searched: 0, cued: 0, glanced: 0, unanswered: 0 };

/** seconds until V will sound again (0 = ready) */
export function whistleReadyIn(g: Game): number { return Math.max(0, blower(g).readyAt - g.time); }

/** V pressed this frame (player.ts, right after the sound meter's decay — so it runs in the arm lock, at the lock, mid-kick, on the wall: anywhere but down). */
export function whistleKey(g: Game, input: Input) { if (input.hit('KeyV')) tryWhistle(g); }

/** Blow it if the breath is back: the event at Sam's feet (hearWhistle lifts it to mouth height for the propagation), the meter's tick, the voice at his head.
 *  False = still inside the cooldown (or down): nothing happened. */
export function tryWhistle(g: Game): boolean {
  const pl = g.player; if (pl.down) return false;
  const B = blower(g); if (g.time < B.readyAt) return false;
  B.readyAt = g.time + WHISTLE.cooldown; B.blown++; B.lastAt = g.time; WHISTLE_STATS.blown++;
  const c = pl.char;
  g.events.push({ kind: 'whistle', pos: [c.pos[0], 0, c.pos[2]], time: g.time, loud: false, level: WHISTLE.level, who: PLAYER_ID });
  pl.noise = Math.max(pl.noise, WHISTLE.level);
  g.audio.play('whistle', c.bones.head ?? v3.add(c.pos, [0, pl.crouch ? 1.05 : 1.6, 0]), WHISTLE.gain);
  return true;
}

// ---------------------------------------------------------------- the guards' side
/** who a whistle reached and how (path length, where it seemed to come from), and which calm man is to answer it — worked out ONCE per event, the first time any
 *  man's hearingCheck meets it, against every living man on the floor at that moment */
interface Heard { d: number; at: Vec3; direct: boolean; carry: number; }
interface Resolution { hearers: Map<Guard, Heard>; responder: Guard | null; answeredBy: Guard | null; t: number; }
const resOf = new WeakMap<GameEvent, Resolution>();
/** the last few resolutions, newest last (QA: 'only one man answers', 'through the door nobody heard it') */
export const WHISTLE_LOG: { t: number; pos: Vec3; hearers: string[]; responder: string | null; answered: string | null; search: boolean }[] = [];

/** mouth height off the event's floor position (a crouched Sam whistles from lower — under a counter top it matters to the over-the-partition test) */
function mouthOf(g: Game, e: GameEvent): Vec3 { const crouched = (e.who ?? PLAYER_ID) === PLAYER_ID && g.player.crouch; return [e.pos[0], crouched ? 1.0 : 1.55, e.pos[2]]; }

/** can this man be the one who ANSWERS (goes to look): calm, free, on nobody's errand, and of a side that minds Sam at all */
function canAnswer(gd: Guard, who: number): boolean {
  if (gd.state !== 'patrol' && gd.state !== 'suspicious') return false;
  if (gd.held || gd.script || gd.task) return false;
  return who === PLAYER_ID ? isHostile(gd.team, 'player') : false;   // (only Sam whistles today; a whistling unit would need its own hostility test here)
}

function resolve(g: Game, e: GameEvent, keen: number): Resolution {
  let R = resOf.get(e); if (R) return R;
  R = { hearers: new Map(), responder: null, answeredBy: null, t: g.time }; resOf.set(e, R);
  const src = mouthOf(g, e); const who = e.who ?? PLAYER_ID;
  let best: Guard | null = null, bd = Infinity;
  for (const gd of g.guards) {
    if (gd.state === 'dead') continue;
    if (who === PLAYER_ID && !isHostile(gd.team, 'player')) continue;   // an operative does not turn round for Sam's whistle (teams): it is not for him
    if (v3.dist(e.pos, gd.char.pos) > WHISTLE.horizon) continue;
    const prop = g.col.sound.propagate(src, v3.add(gd.char.pos, [0, 1.5, 0]));
    const reach = WHISTLE.reachK * prop.carry * keen;
    if (prop.pathLen >= reach) continue;
    R.hearers.set(gd, { d: prop.pathLen, at: [prop.via[0], 0, prop.via[2]], direct: prop.direct, carry: prop.carry });
    if (canAnswer(gd, who) && prop.pathLen < bd) { bd = prop.pathLen; best = gd; }
  }
  R.responder = best;
  WHISTLE_STATS.resolved++; WHISTLE_STATS.heardBy += R.hearers.size; if (!best) WHISTLE_STATS.unanswered++;
  WHISTLE_LOG.push({ t: g.time, pos: v3.copy(e.pos), hearers: [...R.hearers.keys()].map(x => x.callsign), responder: best?.callsign ?? null, answered: null, search: false });
  if (WHISTLE_LOG.length > 32) WHISTLE_LOG.shift();
  return R;
}

/** guards.ts hearingCheck, for an event of kind 'whistle' inside the horizon: what it does to THIS man (see the header). `keen` = the alarmed floor's ×1.25 on small
 *  noises; `small(where)` = hearingCheck's own note in his witness memory of a small noise and where it seemed to come from. */
export function hearWhistle(g: Game, gd: Guard, e: GameEvent, keen: number, small: (where: Vec3) => void) {
  const who = e.who ?? PLAYER_ID;
  if (who === PLAYER_ID && g.playerInvisible) return;   // the tour's unseen Sam whistles at nobody (as his steps reach nobody)
  const R = resolve(g, e, keen);
  const h = R.hearers.get(gd); if (!h) return;          // it did not carry to him
  const M = mem(gd);
  small(h.at);
  // already hunting: one more fix on where you are (an alert man with eyes on you a second ago trusts them over a whistle, as over an echo), nothing said. His
  // awareness is lifted to the whistle's floor all the same — nothing to a free alert or searching man (he is past it), but the lockdown pair clearing a room
  // are 'searching' under a script with their senses run for them (squad.ts perceive), and a whistle at their backs breaks the clear off the way a creak does.
  if (gd.state === 'alert' || gd.state === 'search' || gd.awareness >= 0.85) {
    if (gd.state !== 'alert' || !gd.lastKnown || g.time - gd.lastSeenT > 1.0) gd.lastKnown = v3.copy(h.at);
    gd.awareness = Math.max(gd.awareness, WHISTLE.awareness);
    M.cues++; M.soft = false; WHISTLE_STATS.cued++; return;
  }
  // somebody nearer answers it (or nobody free can): he turns his head that way and carries on
  if (gd !== R.responder) { M.glanceUntil = g.time + WHISTLE.glanceSecs; M.glanceAt = v3.copy(h.at); M.glances++; WHISTLE_STATS.glanced++; return; }
  // he answers it
  const now = g.time; const twice = now - M.respondedAt <= WHISTLE.twiceWindow;
  M.respondedAt = now; M.responses++; R.answeredBy = gd; WHISTLE_STATS.answered++;
  gd.lastKnown = v3.copy(h.at); gd.path = []; gd.pathGoal = null; gd.stallRef = null; gd.stallT = 0; gd.searchT = 0;
  gd.awareness = Math.max(gd.awareness, WHISTLE.awareness);
  const log = WHISTLE_LOG[WHISTLE_LOG.length - 1]; if (log && log.t === R.t) log.answered = gd.callsign;
  if (twice) {   // the second inside the window: a proper search of the place, gun out, no more 'hello?'
    gd.state = 'search'; gd.searchPlan = null; gd.pieing = null; gd.bodyDuty = null; gd.reactT = 0;
    M.searches++; M.soft = false; WHISTLE_STATS.searched++; if (log && log.t === R.t) log.search = true;
    g.say(gd, pick(TWICE_LINES, M, 'lastTwice'));
  } else {       // the first: over to it for a look, torch in hand
    if (gd.state === 'patrol') gd.state = 'suspicious';
    gd.reactT = WHISTLE.reactT; M.soft = true; M.softAt = now;
    g.say(gd, pick(LOOK_LINES, M, 'lastLook'));
  }
}
function pick(pool: string[], M: WhistleMem, key: 'lastLook' | 'lastTwice'): string {
  let i = Math.floor(Math.random() * pool.length) % pool.length;
  if (pool.length > 1 && i === M[key]) i = (i + 1) % pool.length;
  M[key] = i; return pool[i];
}

/** Is this man's suspicion (still) only a whistle's: he answered one, is walking over or looking about, and nothing since has sharpened it — no footfall, no
 *  glimpse, no slam (any of those lifts his awareness past what the whistle left him), no CONTACT since. guards.ts handCarry keeps the torch in his hand for it. */
export function whistleSoft(gd: Guard): boolean {
  const M = memOf.get(gd);
  return !!M && M.soft && gd.state === 'suspicious' && gd.awareness <= WHISTLE.awareness + 0.02 && gd.witness.alertT < M.softAt;
}

/** guards.ts, the patrol branch, once a frame: back on his route the whistle is behind him (soft off), and a head still turned toward one somebody else answered
 *  is craned that way (written over the branch's own idle look-about; the neck's limit is the animator's). */
export function whistlePatrolTick(g: Game, gd: Guard) {
  const M = memOf.get(gd); if (!M) return;
  M.soft = false;
  if (g.time < M.glanceUntil && M.glanceAt) {
    const c = gd.char; const to = Math.atan2(M.glanceAt[0] - c.pos[0], M.glanceAt[2] - c.pos[2]);
    c.anim.lookYawExtra = clamp(wrapAngle(to - c.bodyYaw), -WHISTLE.glanceMax, WHISTLE.glanceMax);
  }
}

// ---------------------------------------------------------------- persistence (one key, per machine — the way the aim rows are kept)
const LS_KEY = 'twopointsix.whistle';
const KEPT: (keyof WhistleKnobs)[] = ['level', 'reachK', 'cooldown', 'twiceWindow'];
/** write the kept knobs to localStorage (the panel calls it on every change) */
export function saveWhistle() {
  try { const out: Record<string, number> = {}; for (const k of KEPT) out[k] = WHISTLE[k]; localStorage.setItem(LS_KEY, JSON.stringify(out)); }
  catch { /* no storage (the harness, a locked-down page): nothing to keep */ }
}
/** read them back (once, at module load): only finite numbers in a sane range are taken */
export function loadWhistle() {
  try {
    const j = JSON.parse(localStorage.getItem(LS_KEY) ?? 'null'); if (!j || typeof j !== 'object') return;
    for (const k of KEPT) { const v = (j as Record<string, unknown>)[k]; if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 600) WHISTLE[k] = v; }
  } catch { /* nothing stored, or not readable: the shipped values stand */ }
}
/** everything back to the shipped values, and the stored copy dropped */
export function resetWhistle() { Object.assign(WHISTLE, WHISTLE_DEFAULTS); try { localStorage.removeItem(LS_KEY); } catch { /* none */ } }
loadWhistle();

// ---------------------------------------------------------------- checkpoints (game/savestate.ts): Sam's breath, and every man's memory of the whistles by roster index
export interface WhistleSnap { blower: Blower; men: (WhistleMem | null)[]; }
export function whistleSnapshot(g: Game): WhistleSnap {
  return { blower: { ...blower(g) }, men: g.guards.map(gd => { const M = memOf.get(gd); return M ? { ...M, glanceAt: M.glanceAt ? v3.copy(M.glanceAt) : null } : null; }) };
}
/** …onto the FRESH Player (the blower is keyed by that object) and the fresh roster. The whistle EVENTS themselves are not put back (savestate.ts applyState drops
 *  kind 'whistle' from the restored half second): `resolve` above answers each event object once for the whole floor, and everybody in earshot heard it the frame
 *  it sounded — a fresh copy of it would be a second whistle nobody blew (review G3.8). */
export function whistleRestore(g: Game, s: WhistleSnap | null | undefined) {
  if (!s) return;
  const B = blower(g); const b = s.blower; if (b) { B.readyAt = Number.isFinite(b.readyAt) ? b.readyAt : -1; B.blown = b.blown | 0; B.lastAt = Number.isFinite(b.lastAt) ? b.lastAt : -100; }
  s.men?.forEach((M, i) => {
    const gd = g.guards[i]; if (!gd || !M) return;
    const m = mem(gd);
    m.respondedAt = Number.isFinite(M.respondedAt) ? M.respondedAt : NEVER; m.responses = M.responses | 0; m.searches = M.searches | 0; m.cues = M.cues | 0; m.glances = M.glances | 0;
    m.glanceUntil = Number.isFinite(M.glanceUntil) ? M.glanceUntil : -1; m.glanceAt = M.glanceAt ? v3.copy(M.glanceAt) : null; m.soft = !!M.soft; m.softAt = Number.isFinite(M.softAt) ? M.softAt : NEVER; m.lastLook = M.lastLook ?? -1; m.lastTwice = M.lastTwice ?? -1;
  });
}

// ---------------------------------------------------------------- panel / QA
/** 'whistle ▸ ready · 3 blown · Novak answered 4 s ago (×2, 1 search) · Reyes turned his head' — or what the last one did */
export function whistleSummary(g: Game): string {
  const parts: string[] = [];
  const B = blower(g); const rd = whistleReadyIn(g);
  parts.push(rd > 0 ? `again in ${rd.toFixed(1)} s` : 'ready (V)'); parts.push(`${B.blown} blown`);
  for (const gd of g.guards) {
    const M = memOf.get(gd); if (!M || gd.state === 'dead') continue;
    const bits: string[] = [];
    if (M.responses) bits.push(`answered ${(g.time - M.respondedAt).toFixed(0)} s ago ×${M.responses}${M.searches ? ` (${M.searches} search${M.searches > 1 ? 'es' : ''})` : ''}${whistleSoft(gd) ? ', torch' : ''}`);
    if (M.cues) bits.push(`${M.cues} cue${M.cues > 1 ? 's' : ''}`);
    if (M.glances) bits.push(`${M.glances} glance${M.glances > 1 ? 's' : ''}${g.time < M.glanceUntil ? ' (looking)' : ''}`);
    if (bits.length) parts.push(`${gd.callsign}: ${bits.join(', ')}`);
  }
  const L = WHISTLE_LOG[WHISTLE_LOG.length - 1];
  if (L) parts.push(`last: heard by ${L.hearers.length ? L.hearers.join('/') : 'nobody'}${L.answered ? ` — ${L.answered} ${L.search ? 'searches' : 'looks'}` : L.responder ? ` — ${L.responder} to answer` : ''}`);
  return 'whistle ▸ ' + parts.join(' · ');
}
