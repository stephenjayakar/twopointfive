// Suppression (docs/internal/sc20k-design.md §4, lane R3): ONE scalar per living character — Sam and every guard alike — raised by rounds that pass close to
// him or strike close to him, decaying with a half-life of about a second. It is fed from the one place a round exists, combat.ts fireWeapon, off the
// segment the hit scan actually traced (muzzle → where it stopped: a round that ended in the jamb in front of a man suppresses him from the jamb), and it is
// ballistic, not visual and not acoustic: no line-of-sight test, no route through SoundPaths, nothing inferred from anybody's AI state — who fired the round
// and where from ride on the round itself, nothing more. The guards' behaviour branches on it (guards.ts: a flinch, a worse and later shot, the head going down
// behind whatever he stands at, a shift to cover when it will not stop — all behind Game.tune.suppression); Sam's own rounds open up with his (player.ts, the
// one mechanical effect this lane gives him; his picture / mix / reticle are lane R4's, reading the same Player.sup). What the player learns by feel — two close
// rounds put a man's head down for a second and a half — is literally the guards' rule with these constants.
import { SideMap } from '../math/side';
import { conditionSup } from './condition';
import { Vec3, v3, clamp } from '../math/vec';
import type { Game, Guard } from './game';
import { TEMPERAMENT } from './game';
import type { Character } from './character';
import { PLAYER_ID } from './consts';
import { temperamentOf } from './dialogue';
import { isHostile, teamOfChar, teamOfId, type Team } from './teams';
import { WORDS } from './words';
import { simRandom } from '../math/dice';   // the simulation's die (math/dice.ts): the Game's own when it has one, Math.random otherwise
import { PICTURE, PICTURE_STATS, ideasOf, exposedAt } from './picture';
import { wallMenLive, thinLine, topEnergy, WALLPEN_STATS } from './wallpen';
import { flinchRound, flinchScale, flinchInside } from './flinch';

/** Every number of the model and of the guards' reactions, in one place (panel-tunable; the QA probes read them rather than copy them). */
export const SUPPRESSION = {
  // ---- the scalar (§4.1)
  /** a round passing within nearR metres of the chest adds wNear·(1 − d/nearR); one striking within hitR of it adds wHit·(1 − d/hitR) — both, for a round into the
   *  partition beside your head. Two Five-seveN rounds into a jamb 0.6 m off a man's chest ≈ (0.27 + 0.23)·2 ≈ 1: pinned; one ≈ 0.5: a flinch. */
  nearR: 1.8, wNear: 0.4, hitR: 2.5, wHit: 0.3,
  /** the first metres out of a muzzle suppress nobody: the closest approach must lie at least this far along the round's travel (colleagues abreast, the man in
   *  Sam's arm under his own gun, and inside three metres nobody is being suppressed — he is being shot at point blank or grabbed). The doc's 1.5 doubled: a pair
   *  advancing a stride apart must not flinch at each other's rounds. */
  minTravel: 3.0,
  /** seconds for the scalar to halve once the rounds stop (1 → under the flinch line in ~2 s, gone in ~3.5); the ceiling it is clamped to; the pulse envelope's decay (/s, R4's) */
  halfLife: 1.1, cap: 1, kickDecay: 8,
  /** × what a round adds while the man already has his head down: you cannot pin-lock a man for ever with a metronome (with displaceAfter, the anti-lock) */
  downAccrual: 0.5,
  /** × what a COLLEAGUE's round adds to a guard (his own side's fire going past him, from behind and beside: he knows where it is going — it rattles, it does not
   *  pin; abreast and just-ahead are already nothing by minTravel and by muzzle discipline lowering the rear gun). Sam's rounds on them and theirs on Sam: × 1. */
  friendlyK: 0.5,
  /** temperament (game.ts TEMPERAMENT): how readily each kind of man accrues it — the hard man shrugs off what rattles the nervy one */
  keen: { steady: 1, nervy: 1.25, hard: 0.8 } as Record<string, number>,
  // ---- guard reactions (§4.2), all behind tune.suppression
  /** s ≥ flinch: the start (anim), a bark, the next round a beat late, every round wider and the cadence slower while it lasts, no running INTO fire;
   *  s ≥ pinned: head down — crouched behind whatever he stands at, gun lowered, feet still — for a drawn headDown seconds and then until s is under `release`;
   *  head down displaceAfter seconds running (s never falling under flinch) and he shifts to cover instead of squatting there for good */
  flinch: 0.3, pinned: 0.6, release: 0.45, headDown: [0.9, 1.5] as [number, number],
  /** fireCd floors: on the flinch's edge, and every frame the head is down (so the first round after coming up is a beat late, not on the frame) */
  flinchDelay: 0.25, headDownDelay: 0.6,
  /** extra cone on a guard's round per unit s (radians, on top of his row's aiSpread: at rest 0.05 → ×2.6 at full), and × his cadence after each round (1 + gapK·s) */
  guardSpread: 0.08, gapK: 1.0,
  /** the closing run drops to the investigate jog while s ≥ flinch (he advances, but not at a sprint into fire); the standoff's orbit at half pace */
  standoffPaceK: 0.5,
  /** displacement: after this long pinned; the cover looked for between dMin and dMax metres off, crouched-chest height there hidden from where the rounds came
   *  from; how long he then holds that spot before the plain fight may close again; the least time between two shifts; the walk's cap and pace (× guardInvestigate);
   *  how low he runs it (crouchTarget) */
  displaceAfter: 4, displaceMin: 2.0, displaceMax: 4.5, coverHold: 3.0, displaceCooldown: 6, displaceCapSecs: 6, displacePace: 1.1, displaceCrouch: 0.55,
  /** how long the origin of the last suppressing round stays 'where it is coming from' for the cover search (then his fix on Sam, then nothing) */
  srcMemorySecs: 4,
  /** the talking: seconds between one man's suppression lines, between anybody's, and the window inside which two men pinned is 'he's got us pinned' (once per floorLineSecs) */
  barkSecs: 6, floorBarkSecs: 1.5, pairSecs: 2, floorLineSecs: 20,
  // ---- Sam (§4.3 — the one mechanical effect in this lane; the look and the sound are R4's)
  /** extra cone on Sam's round per unit of HIS s (radians: dead-on at 0, ± ~2° at full — a torso at 8 m mostly). Not under the tour's puppet: its scripted double-taps land. */
  samSpread: 0.07,
};

/** Per character: the scalar and its pulse envelope, where the last suppressing round came from, and — for a guard — the reaction clocks (unused on Sam).
 *  Lives on Player.sup / Guard.sup; dies with them (restart, resetGuards), so nothing outlives an encounter. */
export class Sup {
  /** the scalar, 0‥cap */
  v = 0;
  /** envelope of the last increment (jumps to the round's add, decays at kickDecay/s): R4's per-round pulse */
  kick = 0;
  /** the muzzle the last suppressing round left, whose it was (Character id), and when */
  src: Vec3 | null = null; srcId = -1; srcT = -100;
  /** the largest single add lately and the game time the scalar last crossed each line upward (edges for the anim / barks; the QA probes print them) */
  lastAdd = 0; flinchAt = -100; pinnedAt = -100;
  /** last frame's band (0 under flinch, 1 flinch, 2 pinned) — the rising edges are the events */
  band = 0;
  // ---- guard reaction clocks (guards.ts, through headDown below)
  /** seconds of head-down still owed from the last crossing of `pinned` (drawn from SUPPRESSION.headDown) */
  downT = 0;
  /** latched above `pinned`, released under `release`: head down while this OR downT */
  latched = false;
  /** seconds spent head-down since s was last under `flinch` — displace at displaceAfter */
  pinnedT = 0;
  /** the cover spot he is shifting to right now (null = not displacing), when that shift began, how many this life, and until when he holds the spot he reached */
  cover: Vec3 | null = null; displacedAt = -100; displaces = 0; coverUntil = -1;
  /** his last suppression line: when, and which moment it was; a line the clocks (or his own radio call) held back, to be said inside the next couple of seconds if it still applies */
  barkT = -100; barkWas: SupMoment | null = null; pending: SupMoment | null = null; pendingT = -100;
  /** was over `pinned` at some point and has not been under 0.02 since (the hard man's 'that all you've got?' when it drains without him being hit) */
  wasPinned = false;
  /** everything the reactions keep, back to rest (a man no longer alert, the flag off, the AI off) — the scalar itself is physics and stays */
  clearReactions() { this.downT = 0; this.latched = false; this.pinnedT = 0; this.cover = null; this.coverUntil = -1; }
}

/** QA hook: set `log` and every add, edge, head-down decision and cover search says what it did */
export const SUPPRESSION_DEBUG: { log: ((s: string) => void) | null } = { log: null };
/** What one round did as it went past SAM (whether or not it added anything): where it flew from and stopped, its closest point to his chest and how far along
 *  its travel that was, how near it passed and struck, what it added. Lane R4's seam: its crack / whizz / debris voices play off this (at `closest`, so the mixer
 *  puts them on the correct side and muffles them through a wall) — set `onSamPass`; null = nothing, today. Called for every round bar his own and the ones
 *  that reach him inside minTravel, out to fxRange metres of pass distance (the whizz carries further than the flinch). */
export interface SamPass { from: Vec3; to: Vec3; closest: Vec3; travelled: number; dNear: number; dHit: number; add: number; shooterId: number; }
export const SUPPRESSION_FX: { onSamPass: ((g: Game, p: SamPass) => void) | null; fxRange: number } = { onSamPass: null, fxRange: 4 };

function keenOf(g: Game, c: Character): number {
  if (c === g.player.char) return 1;
  const gd = g.guards.find(x => x.char === c); const t = gd ? TEMPERAMENT[gd.callsign] : undefined;
  return (t && SUPPRESSION.keen[t]) || 1;
}

/** One round has just been traced (combat.ts fireWeapon, after the hit scan): `from` = the muzzle, `to` = where it stopped (a wall, a leaf, a prop nobody stood
 *  behind, a man, or 60 m out), `hit` = the character it went into if any (he is shot, not suppressed). Every OTHER living, free character whose chest the segment
 *  passed within nearR of — or stopped within hitR of — accrues; the shooter never does, nor anybody the round reached inside minTravel of the muzzle. */
export function noteRound(g: Game, shooter: Character, from: Vec3, to: Vec3, hit: Character | null) {
  const S = SUPPRESSION; const seg = v3.sub(to, from); const tHit = v3.len(seg); if (tHit < 1e-3) return;   // (into the panel at the muzzle: nobody)
  const dir = v3.scale(seg, 1 / tHit); const dbg = SUPPRESSION_DEBUG.log;
  const shooterTeam = teamOfChar(g, shooter);   // (teams: whose side's round — a round of a side NOT hostile to yours going past rattles at friendlyK; an enemy's pins at full weight, as Sam's always did)
  const each = (c: Character, sup: Sup, held: boolean, team: Team, gd: Guard | null) => {
    if (c === shooter || c === hit || !c.alive || held) return;
    const C = c.bones.chest ?? v3.add(c.pos, [0, 1.1, 0]);
    const s = clamp(v3.dot(v3.sub(C, from), dir), 0, tHit);          // closest approach along the round's actual travel (tHit when it stopped short, in the cover in front of him)
    const foe = isHostile(shooterTeam, team);
    if (s < S.minTravel && !(foe && flinchInside(s))) return;
    const closest = v3.mad(from, dir, s); const dNear = v3.dist(closest, C), dHit = v3.dist(to, C);
    let add = S.wNear * Math.max(0, 1 - dNear / S.nearR) + S.wHit * Math.max(0, 1 - dHit / S.hitR);
    if (s < S.minTravel) { flinchRound(g, c, gd, add, from, true); return; }   // (flinch.ts: a hostile round from across a small room still ducks him — the picture; this model weighs nothing of it, as before)
    if (c === g.player.char && SUPPRESSION_FX.onSamPass && dNear < SUPPRESSION_FX.fxRange) SUPPRESSION_FX.onSamPass(g, { from, to, closest, travelled: s, dNear, dHit, add: Math.max(0, add), shooterId: shooter.id });   // (R4's crack / whizz: the round went past him, whatever it adds)
    if (add <= 0) return;
    flinchRound(g, c, gd, add, from, foe);   // (flinch.ts: the duck at a close round, anybody's — the picture; off, nothing)
    if (sup.downT > 0 || sup.latched || sup.cover) add *= S.downAccrual;   // already down (or shifting): diminishing returns
    if (!foe) add *= S.friendlyK;   // a colleague's round past a guard: rattles, does not pin (a guard's past a guard — and, teams, any round of a side that is not this man's enemy)
    add *= keenOf(g, c);
    sup.v = Math.min(S.cap, sup.v + add); sup.kick = Math.max(sup.kick, add); sup.lastAdd = add;
    sup.src = v3.copy(from); sup.srcId = shooter.id; sup.srcT = g.time;
    dbg?.(`round by #${shooter.id}: #${c.id} s* ${s.toFixed(2)} of ${tHit.toFixed(2)} m, passed ${dNear.toFixed(2)} m, struck ${dHit.toFixed(2)} m off → +${add.toFixed(3)} = ${sup.v.toFixed(3)}`);
  };
  each(g.player.char, g.player.sup, false, 'player', null);
  for (const gd of g.guards) if (gd.state !== 'dead') each(gd.char, gd.sup, !!gd.held, gd.team, gd);
}

/** the floor's 'he's got us pinned' clock, and each man's last line (never the same twice running) */
const floorLineT = new SideMap<Game, number>('suppression.floorLineT'); const floorBarkT = new SideMap<Game, number>('suppression.floorBarkT'); const lastLine = new SideMap<Guard, string>('suppression.lastLine');
/** a checkpoint loaded (game/savestate.ts) puts Game.time BACK: the floor's line / bark clocks must not sit in the future muting everybody */
export function forgetSuppressionClocks(g: Game) { floorLineT.delete(g); floorBarkT.delete(g); }
export type SupMoment = 'flinch' | 'friendly' | 'pinned' | 'displace' | 'recover';
/** which held-back line outranks which (the worse news waits, the milder is dropped for it) */
const RANK: Record<SupMoment, number> = { recover: 0, friendly: 1, flinch: 1, pinned: 2, displace: 3 };
/** Placeholder lines (the writing pass is the maintainer's), by moment and temperament ('*' for anybody). */
const SUP_LINES: Record<SupMoment, Partial<Record<string, string[]>>> = {
  flinch: { '*': ['taking fire!', 'rounds coming in!', 'he\'s shooting — get down!', 'that was close—'], nervy: ['christ— CHRIST—', 'he\'s shooting at me!'], hard: ['he\'s found his nerve.', 'incoming. stay on him.'] },
  friendly: { '*': ['watch your fire!', 'check fire — that\'s past MY head!', 'easy! I\'m in front of you!'], nervy: ['stop— stop shooting past me!'] },
  pinned: { '*': ['I\'m pinned!', 'can\'t get my head up—', 'he\'s got me pinned here!', 'head down— head down!'], nervy: ['I can\'t— I can\'t move—', 'jesus, he\'s right on me—'], hard: ['he\'s got the angle. wait him out.', 'let him spend them.'] },
  displace: { '*': ['moving!', 'shifting — cover me!', 'can\'t stay here — moving!'], nervy: ['I\'m getting out of here—'], hard: ['relocating.'] },
  recover: { hard: ['that all you\'ve got?', 'my turn.'] },
};
/** One suppression line from this man if the clocks allow (his own barkSecs, the floor's floorBarkSecs — `force` skips both: the shift is worth saying) and never
 *  over his own radio line of a moment ago. A line held back is kept `pending` for a couple of seconds and said then if it still applies (updateSuppression),
 *  so a man pinned the instant after his own hostage call still gets to say so. Never the line he said last. */
/** friendlyfire.ts: a teammate with the PLAYER's round going past him says what a man says of a colleague's — the same lines, on the same clocks */
export function watchYourFire(g: Game, gd: Guard): boolean { return supBark(g, gd, 'friendly'); }
function supBark(g: Game, gd: Guard, moment: SupMoment, force = false): boolean {
  const S = SUPPRESSION, sup = gd.sup, now = g.time;
  const held = (!force && (now - sup.barkT < S.barkSecs || now - (floorBarkT.get(g) ?? -100) < S.floorBarkSecs)) || (!!gd.bubble?.radio && now - gd.bubble.t < 2.5);
  if (held) { if (moment !== 'recover' && RANK[moment] > (sup.pending ? RANK[sup.pending] : -1)) { sup.pending = moment; sup.pendingT = now; } return false; }   // (a worse moment replaces a milder one waiting — its two seconds run from the moment itself, not from the retries; 'that all you've got' is now or never)
  const M = SUP_LINES[moment]; let pool = [...(M[temperamentOf(gd)] ?? []), ...(M['*'] ?? [])];
  if (WORDS.on && gd.team !== 'guard') pool = pool.filter(l => !/\b(he|he's|him|his)\b/.test(l));   // (words.ts: 'he' is the night staff's one intruder — a scenario's two sides are under a TEAM's fire)
  if (!pool.length) return false;
  let i = Math.floor(simRandom() * pool.length) % pool.length; if (pool.length > 1 && pool[i] === lastLine.get(gd)) i = (i + 1) % pool.length;
  lastLine.set(gd, pool[i]); sup.barkT = now; sup.barkWas = moment; sup.pending = null; floorBarkT.set(g, now);
  g.say(gd, pool[i]);
  return true;
}
/** the suppression lines — every moment's, or one moment's (the QA probes check a bark came from this pool; the soak that a 'recover' line is the only one said at rest) */
export function suppressionLines(moment?: SupMoment): string[] { return (moment ? [SUP_LINES[moment]] : Object.values(SUP_LINES)).flatMap(m => Object.values(m).flatMap(x => x ?? [])); }

/** may this man's behaviour react at all this frame (the scalar integrates regardless): the flag, the AI on, alive, free, not choreographed */
function reacts(g: Game, gd: Guard): boolean { return g.tune.suppression && g.aiEnabled && gd.state !== 'dead' && !gd.held && !gd.script; }

/** Once a frame, ahead of the player and the guards (game.ts update): decay everybody's scalar and pulse; zero the men who accrue nothing (dead, held); and the
 *  guards' EDGES — over `flinch`: the start (anim.flinch), the next round a beat late, a line ('taking fire!' at Sam's rounds, 'watch your fire!' at a colleague's);
 *  over `pinned`: the line; two men pinned inside pairSecs of each other: one floor line. The head-down state itself is the alert branch's (headDown below). */
export function updateSuppression(g: Game, dt: number) {
  const S = SUPPRESSION; const k = Math.pow(2, -dt / S.halfLife), kk = Math.exp(-S.kickDecay * dt);
  const decay = (sup: Sup) => { sup.v *= k; sup.kick *= kk; if (sup.v < 1e-5) sup.v = 0; if (sup.kick < 1e-5) sup.kick = 0; };
  { const P = g.player.sup; if (g.player.down) { P.v = 0; P.kick = 0; } else decay(P); }   // (down: nothing sticks on the death screen — R4's post effect reads this)
  for (const gd of g.guards) {
    const sup = gd.sup;
    if (gd.state === 'dead' || gd.held) { sup.v = 0; sup.kick = 0; sup.band = 0; sup.wasPinned = false; sup.clearReactions(); continue; }
    decay(sup);
    if (gd.state !== 'alert' || !reacts(g, gd)) sup.clearReactions();   // (the head-down clocks belong to the fight; a man talked calm, scripted, or with the flag / the AI off carries none)
    // his band, with hysteresis (pinned holds down to `release`, flinch to a hair under its line): a scalar hovering about a line under a steady volley is ONE
    // episode — one start, one line — not an edge every other round
    const v = sup.v; const band = v >= S.pinned || (sup.band === 2 && v >= S.release) ? 2 : v >= S.flinch || (sup.band >= 1 && v >= S.flinch - 0.05) ? 1 : 0;
    if (band > sup.band && sup.band < 1 && !reacts(g, gd) && gd.script?.flinch && g.tune.suppression) gd.char.anim.flinchFrom(sup.src ? v3.sub(sup.src, gd.char.pos) : null, flinchScale(g, gd));   // a CHOREOGRAPHED man ordered to (GuardScript.flinch — the day showcase's firefight): the start alone on the rising edge, none of the AI's reactions below; nothing for any other scripted man, as ever
    if (band > sup.band && reacts(g, gd)) {
      const friendly = sup.srcId !== PLAYER_ID && sup.srcId >= 0 && !isHostile(gd.team, teamOfId(g, sup.srcId));   // a colleague's rounds past his head: he says so to HIM, not 'taking fire' (teams: an enemy unit's rounds are fire taken, whatever his id)
      if (sup.band < 1) {   // over the flinch line: the start, the next round a beat late, a word (unless the head is going down this same frame: that line instead)
        sup.flinchAt = g.time; gd.char.anim.flinchFrom(sup.src ? v3.sub(sup.src, gd.char.pos) : null, flinchScale(g, gd)); gd.fireCd = Math.max(gd.fireCd, S.flinchDelay);
        if (band < 2) supBark(g, gd, friendly ? 'friendly' : 'flinch');
        SUPPRESSION_DEBUG.log?.(`#${gd.char.id} ${gd.callsign} FLINCH at ${sup.v.toFixed(2)} (${friendly ? 'a colleague\'s round' : 'the player\'s'})`);
      }
      if (band === 2) {   // over the pinned line: the line (past his own clock if his flinch line was a couple of seconds back) — and a second man pinned within pairSecs of another makes it the floor's
        sup.pinnedAt = g.time; sup.wasPinned = true;
        const other = g.guards.find(o => o !== gd && o.state !== 'dead' && g.time - o.sup.pinnedAt < S.pairSecs && (!WORDS.on || o.team === gd.team));   // ('us' is two men of ONE side: words.ts)
        if (other && g.time - (floorLineT.get(g) ?? -100) > S.floorLineSecs) { floorLineT.set(g, g.time); sup.barkT = g.time; sup.barkWas = 'pinned'; floorBarkT.set(g, g.time); g.say(gd, WORDS.on && gd.team !== 'guard' ? 'they\'ve got us pinned!' : 'he\'s got us pinned!', true); }
        else supBark(g, gd, friendly ? 'friendly' : 'pinned', sup.barkWas === 'flinch' && g.time - sup.barkT > 1.5);   // (over his own clock only to top a 'taking fire' of a moment ago with the worse news — never pinned on pinned)
        SUPPRESSION_DEBUG.log?.(`#${gd.char.id} ${gd.callsign} PINNED at ${sup.v.toFixed(2)}`);
      }
    }
    if (sup.wasPinned && sup.v < 0.02) { sup.wasPinned = false; if (reacts(g, gd) && gd.state === 'alert' && TEMPERAMENT[gd.callsign] === 'hard') supBark(g, gd, 'recover'); }   // drained right out without him being hit: the hard man has something to say about that
    if (sup.pending) {   // a line the clocks held back: said now if it still applies (still at least that rattled, still in the fight), dropped after two seconds
      const P = sup.pending; const still = reacts(g, gd) && g.time - sup.pendingT < 2 && (P === 'displace' ? !!sup.cover : P === 'pinned' ? band === 2 : band >= 1);
      if (!still) sup.pending = null; else supBark(g, gd, P, P === 'displace');
    }
    sup.band = band;
  }
}

/** The alert branch's question each frame (guards.ts updateGuard, ahead of everything else in `case 'alert'`): is this man's head down, or is he shifting to
 *  cover — and the clocks that decide it. 'down': crouch behind what he stands at, gun low, feet still, no round (the caller floors fireCd), eyes still toward the
 *  threat; entered on s ≥ pinned (a drawn headDown seconds owed), held while that runs or s ≥ release. 'displace': displaceAfter seconds of that without s ever
 *  dropping under flinch and he goes for `sup.cover` instead (coverFrom: a couple of strides off the line of fire, crouched-chest hidden from where the rounds
 *  come from) — the caller walks him; endDisplace when he is there or it is going nowhere. 'none': the plain fight (which still reads the flinch factors). */
export function headDown(g: Game, gd: Guard, dt: number): 'none' | 'down' | 'displace' {
  const S = SUPPRESSION, sup = gd.sup;
  if (!reacts(g, gd)) { sup.clearReactions(); return 'none'; }
  if (sup.cover) return 'displace';
  if (sup.v < S.flinch) sup.pinnedT = 0;
  if (sup.v >= S.pinned) { if (!sup.latched && sup.downT <= 0) { sup.downT = S.headDown[0] + simRandom() * (S.headDown[1] - S.headDown[0]); SUPPRESSION_DEBUG.log?.(`#${gd.char.id} ${gd.callsign} head DOWN for ${sup.downT.toFixed(2)} s (s ${sup.v.toFixed(2)})`); } sup.latched = true; }
  else if (sup.v < S.release) sup.latched = false;
  const down = sup.downT > 0 || sup.latched;
  if (!down) { if (sup.downT <= 0 && sup.pinnedT > 0 && sup.v < S.release) sup.pinnedT = Math.max(0, sup.pinnedT - dt); return 'none'; }   // (up again: the displace clock unwinds rather than banks half-seconds across separate volleys under the flinch line — reset outright once s < flinch, above)
  sup.downT = Math.max(0, sup.downT - dt); sup.pinnedT += dt;
  if (sup.pinnedT > S.displaceAfter && !gd.pinned && !gd.standoff && g.time - sup.displacedAt > S.displaceCooldown) {   // (a tour-pinned man shoots from where he was put and squats where he was put; a man in the standoff does not leave it — his colleague is still in Sam's arm — he stays down and keeps talking)
    const threat = sup.src && g.time - sup.srcT < S.srcMemorySecs ? sup.src : gd.lastKnown;
    const p = threat ? coverFrom(g, gd, threat) : null;
    if (p) { sup.cover = p; sup.displacedAt = g.time; sup.displaces++; sup.pinnedT = 0; sup.downT = 0; sup.latched = false; gd.path = []; gd.pathGoal = null; gd.stallRef = null; supBark(g, gd, 'displace', true); SUPPRESSION_DEBUG.log?.(`#${gd.char.id} ${gd.callsign} DISPLACES to (${p[0].toFixed(2)}, ${p[2].toFixed(2)}), ${v3.distXZ(p, gd.char.pos).toFixed(2)} m, threat at (${threat![0].toFixed(1)}, ${threat![2].toFixed(1)})`); return 'displace'; }
    sup.pinnedT = S.displaceAfter - 1.5; SUPPRESSION_DEBUG.log?.(`#${gd.char.id} ${gd.callsign} would displace: no cover found from (${gd.char.pos[0].toFixed(1)}, ${gd.char.pos[2].toFixed(1)}) — stays down, looks again in 1.5 s`);   // nowhere to go from here: stay down, look again shortly
  }
  return 'down';
}
/** The shift is over — he is there, or it went nowhere, or it has taken too long: hold the spot a few seconds (coverUntil: the plain fight does not run him
 *  straight back out), the first round from there a beat late. */
export function endDisplace(g: Game, gd: Guard, why: string) {
  const sup = gd.sup; sup.cover = null; sup.coverUntil = g.time + SUPPRESSION.coverHold; sup.pinnedT = 0; sup.downT = 0; sup.latched = false;
  gd.path = []; gd.pathGoal = null; gd.stallRef = null; gd.fireCd = Math.max(gd.fireCd, SUPPRESSION.headDownDelay);
  SUPPRESSION_DEBUG.log?.(`#${gd.char.id} ${gd.callsign} shift over (${why}) at (${gd.char.pos[0].toFixed(2)}, ${gd.char.pos[2].toFixed(2)})`);
}
/** may the plain fight close on Sam right now, or is he holding the cover he has just reached */
export function holdingCover(g: Game, gd: Guard): boolean { return g.tune.suppression && g.time < gd.sup.coverUntil; }

/** Where a pinned man shifts to: a free cell displaceMin‥Max metres off — to either SIDE of the line the rounds come down for choice (off it), else back, never
 *  toward — that he can walk to without a tour of the floor or a leg toward the shooter, where a crouched chest is hidden from the shooter's by something solid,
 *  and that no colleague stands on or is heading for. Preference order, first fit (coverSpot's pattern); a dozen path plans at most. null = nothing: he stays down. */
export function coverFrom(g: Game, gd: Guard, threat: Vec3): Vec3 | null {
  // (picture.ts PICTURE.cover: the man whose rounds came in is one of several he knows of — the first fit hidden from EVERY one of them is taken; the first
  // fit of all, the place as it was dealt, is kept meanwhile and is his if there is no such place. One pass, the same dozen plans. With both rules on, a
  // place that STOPS the shooter's round but is in another known man's line is kept over one a round goes through: the place as wallpen.ts alone deals it.)
  const all = PICTURE.on && PICTURE.cover && ideasOf(g, gd).length > 1; let asWas: Vec3 | null = null;
  // (wallpen.ts WALLPEN.men: rounds go through thin walls — a place hidden from the gun only by things its round goes through is kept the same way, and a
  // place behind something that STOPS a round is taken first; no such place: the hidden one is his, as it always was)
  const hard = wallMenLive(g); let soft = false, wasOpen = false; const two = PICTURE.coverHard; let keptThin: Vec3 | null = null, keptOpen: Vec3 | null = null;   // (the two kinds of place kept meanwhile; `two` off: one slot, whichever came first, as it was)
  const S = SUPPRESSION, nav = g.col.nav, c = gd.char, from = c.pos; const dbg = SUPPRESSION_DEBUG.log;
  const T: Vec3 = [threat[0], 1.15, threat[2]]; const d0 = v3.distXZ(from, threat);
  const away = Math.atan2(from[0] - threat[0], from[2] - threat[2]);   // bearing shooter → him: 0 = straight on back, ±π/2 = square off the line
  let plans = 0;
  /** no place hidden from everybody: the kept one — the hard place in another man's line over the thin one, when both were kept */
  const fall = () => { if (keptOpen) WALLPEN_STATS.harder++; return keptOpen ?? asWas; };
  for (const da of [1.2, -1.2, 0.8, -0.8, 1.65, -1.65, 0.4, -0.4, 0, 2.1, -2.1]) for (const r of [2.6, 3.4, S.displaceMin, S.displaceMax]) {
    const a = away + da; const p: Vec3 = [from[0] + Math.sin(a) * r, 0, from[2] + Math.cos(a) * r];
    if (nav.isBlocked(p[0], p[2])) continue;
    if (v3.distXZ(p, threat) < Math.max(d0 - 1.5, S.minTravel + 0.5)) { dbg?.(`  cover cand (${p[0].toFixed(1)}, ${p[2].toFixed(1)}): toward him`); continue; }   // (a stride and a half nearer at most — diving for the near end of a partition is fine, walking up his line of fire is not — and never to inside point-blank of him)
    if (!g.col.segmentBlocked(T, [p[0], 0.9, p[2]])) { dbg?.(`  cover cand (${p[0].toFixed(1)}, ${p[2].toFixed(1)}): open to him crouched`); continue; }   // not cover: a crouched chest there is in the open from where the rounds come
    const thin = hard && !!thinLine(g, T, [p[0], 0.9, p[2]], topEnergy(), 0);   // (wallpen.ts: a rifle round from where the rounds come gets to a chest there — hidden, not covered)
    if (thin && asWas) { dbg?.(`  cover cand (${p[0].toFixed(1)}, ${p[2].toFixed(1)}): a round goes through what hides it`); continue; }
    const open = all && exposedAt(g, gd, p, true) > 0.15; if (open && (keptOpen || (asWas && !(two && keptThin && plans < 8)))) { dbg?.(`  cover cand (${p[0].toFixed(1)}, ${p[2].toFixed(1)}): in another known enemy's line`); continue; }   // (…a hard place in another man's line may still better a kept thin one, while two thirds of the plans are unspent)
    let taken = false; for (const o of g.guards) if (o !== gd && o.state !== 'dead' && (v3.distXZ(o.char.pos, p) < 0.9 || (o.sup.cover && v3.distXZ(o.sup.cover, p) < 1.2))) { taken = true; break; }
    if (taken) { dbg?.(`  cover cand (${p[0].toFixed(1)}, ${p[2].toFixed(1)}): a colleague's`); continue; }
    if (++plans > 12) { dbg?.('  cover: out of path plans'); return fall(); }
    const path = nav.findPath(from, p); if (!path?.length) { dbg?.(`  cover cand (${p[0].toFixed(1)}, ${p[2].toFixed(1)}): no path`); continue; }
    let L = 0, q: Vec3 = from, toward = false; for (const w of path) { L += v3.distXZ(q, w); q = w; if (v3.distXZ(w, threat) < d0 - 1.5) toward = true; }
    if (L > 2.5 * r + 2 || toward) { dbg?.(`  cover cand (${p[0].toFixed(1)}, ${p[2].toFixed(1)}): ${toward ? 'the way there runs at him' : `path ${L.toFixed(1)} m for ${r} m`}`); continue; }
    const end = path[path.length - 1]; if (v3.distXZ(end, p) > 0.6) { dbg?.(`  cover cand (${p[0].toFixed(1)}, ${p[2].toFixed(1)}): path stops ${v3.distXZ(end, p).toFixed(2)} m short`); continue; }
    if (thin) { asWas = keptThin = [end[0], 0, end[2]]; soft = true; dbg?.(`  cover cand (${p[0].toFixed(1)}, ${p[2].toFixed(1)}): kept, a round goes through what hides it`); continue; }
    if (open) { wasOpen = true; if (keptThin) keptOpen = [end[0], 0, end[2]]; else asWas = [end[0], 0, end[2]]; dbg?.(`  cover cand (${p[0].toFixed(1)}, ${p[2].toFixed(1)}): kept, in another known enemy's line`); continue; }
    dbg?.(`  cover cand (${p[0].toFixed(1)}, ${p[2].toFixed(1)}): TAKEN (${(da * 57.3).toFixed(0)}° off straight-back, ${r} m, path ${L.toFixed(1)} m)`);
    if (soft) WALLPEN_STATS.harder++; if (wasOpen) PICTURE_STATS.moved++;
    return [end[0], 0, end[2]];
  }
  if (!asWas) dbg?.('  cover: no candidate survives');
  return fall();
}

/** What suppression does to a guard's NEXT round (the two fire sites read it, flag off = nothing): extra cone on top of his row's spread, and × the cadence he draws after it. */
export function guardFireMods(g: Game, gd: Guard): { spread: number; gap: number } {
  if (!g.tune.suppression) return { spread: 0, gap: 1 };
  return { spread: SUPPRESSION.guardSpread * conditionSup(g, gd, gd.sup.v), gap: 1 + SUPPRESSION.gapK * gd.sup.v };   // (condition.ts: a hurt man's rounds go wider, as if fire were on him; how fast he fires is the fire's alone)
}
/** is he rattled (s ≥ flinch, reactions on): the closing run drops to a jog, the standoff's orbit to half pace */
export function flinching(g: Game, gd: Guard): boolean { return reacts(g, gd) && gd.sup.v >= SUPPRESSION.flinch; }
/** Extra cone on Sam's own round for HIS suppression (player.ts, both fire sites): 0 with the flag off, and 0 under the tour's puppet (its scripted rounds must land). */
export function samSpread(g: Game): number { return g.tune.suppression && !g.puppet ? SUPPRESSION.samSpread * conditionSup(g, g.player, g.player.sup.v) : 0; }

/** Panel / QA: 'suppression ▸ Sam 0.00 · Reyes 0.71 head-down 0.6 s (pinned 2.1 s) · …' — Sam, then every living man with anything on him (or the nearest, at rest). */
export function suppressionSummary(g: Game): string {
  const f2 = (x: number) => x.toFixed(2), f1 = (x: number) => x.toFixed(1);
  const parts = [`Player ${f2(g.player.sup.v)}${g.player.sup.kick > 0.01 ? ` (kick ${f2(g.player.sup.kick)})` : ''}`];
  const men = g.guards.filter(x => x.state !== 'dead');
  let shown = men.filter(x => x.sup.v >= 0.005 || x.sup.cover || x.sup.downT > 0 || g.time < x.sup.coverUntil);
  if (!shown.length) { const n = g.nearestLivingGuard(); if (n) shown = [n]; }
  for (const gd of shown) {
    const s = gd.sup; const bits = [`${gd.callsign} ${f2(s.v)}`];
    if (s.cover) bits.push(`→ cover (${f1(s.cover[0])}, ${f1(s.cover[2])})`);
    else if (s.downT > 0 || s.latched) bits.push(`head-down ${f1(Math.max(s.downT, 0))} s (pinned ${f1(s.pinnedT)} s)`);
    else if (g.time < s.coverUntil) bits.push(`holding cover ${f1(s.coverUntil - g.time)} s`);
    else if (s.v >= SUPPRESSION.flinch) bits.push('flinching');
    if (s.displaces) bits.push(`${s.displaces} shift${s.displaces > 1 ? 's' : ''}`);
    parts.push(bits.join(' '));
  }
  return `suppression${g.tune.suppression ? '' : ' (reactions OFF)'} ▸ ${parts.join(' · ')}`;
}
