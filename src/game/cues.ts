// CUES — what the defenders decide, told to the player (the maintainer, 10-07, of defenders that hold their rooms after he is down: "maybe we just need more
// telegraphing from the NPCs then"; earlier "lean into unpredictability but with cues to be able to know what's happening"). Game.cues, behind `CUES.on`
// (off: nothing here runs, the radio strip is the 'radio: ' rows of Game.messages and every line is worded as it was).
//
// THIS FILE ONLY READS THE GAME. It writes nothing a man's AI, the dice or a digest reads: its rows and its bubbles live on the Cues object, never on a Guard
// (Guard.bubble is read by the bark clocks — suppression.ts, the stand-off's — and a line put there would move a die). A cue never moves a man.
//
//   1 · THE NET IS DELIVERED. A unit's radio line went into the log as '<callsign> (radio): …', which the strip (ui/overlay.ts)
//       never drew: no scenario defender's call ever reached the HUD. say() (guards.ts) now hands a room fight's defenders' radio lines here as well, and the
//       strip draws this file's rows (the team's own net, a showcase's cast and the night game's response are as they were). The rows are their own short
//       list: a line nothing draws can no longer push a drawn one out of the five-row message ring.
//   2 · PRIORITY AND RATE. About forty defender lines go out in a loud run and the strip has three rows of eight seconds. Every row has a CLASS (the order is
//       what a player would most want to know): 1 men coming round or coming to help · 2 stood down · 3 holding on purpose · 4 the net knows · 5 fell back
//       and planted · 6 alert but staying put (CLASSES for the lines they already had, by their words; LINES carries each new line's own). A squad's word
//       ranks a step ahead of a man's in its class. A row is NOT drawn when: the same words (whoever says them) went out inside `dupSecs`; two rows are up
//       and its class spoke inside its gap (`gaps`); the strip is full and every row up is better, or as good and not yet `minShow` old. A full strip gives
//       up, in order: the oldest row of a class holding more than `perClass` rows, the older of the new row's own class once it holds `perClass`, else the
//       worst-ranked row's oldest. A row that arrives squelches (once a frame).
//   3 · THE SILENT DECISIONS GET WORDS (LINES — one table). Each is read off what the man has already done, the frame he did it: the room fight's own notes
//       (RoomFight.log — the squads' and the press's come through it) and each defender's state. Nothing is said that he is not doing.
//         help       he leaves his room for the fight next door (he shouts it, too)   net   'moving to the fight — the mess'
//         stayOurs   he hears his side hit next door and the dice say stay            net   'they're hit in the mess — staying on my door'
//         stay       … or nobody of his side is posted where it came from             net   'shots outside the store — holding my room'
//         huntOver   his hunt is over, he holds where it ended                        net   'lost them — holding outside the store'
//         calm       he lowers his gun (state → patrol), still on his post            net   'quiet now — staying put'
//         cover      Sam is down at his feet: he keeps a gun on him                   net   'one of them down in the mess — covering him'
//         still      alert these `stillSecs` with nobody in sight, not moving         net   'they're still out there — holding the mess'
//         fellBack   he gives his room up (he shouts it, too)                         net   'the mess is lost — falling back'
//         planted    … and where he has set up again (pinnedIn: back in that room)    net   'fell back — set outside the mess'
//         squadHears a squad has word of the team and has not yet said what it does   net   'Bravo: copy, Alpha — stand by'
//         squadWaits … on Hard, a squad that could send men holds on purpose (drillNet)  net   'Bravo: copy, Alpha — hold, let them come in. Wait for my word!'
//         squadStays asked again, it stays on its doors                               net   'Bravo: still on the doors — nobody goes'
//         squadQuiet its rooms have gone quiet                                        net   'Bravo: gone quiet here — still holding'
//         surprised  caught looking the wrong way · flinch at a booted door           spoken (a bubble: he is in the room the team is entering)
//       A cue's bubble is drawn like any line's (ui/bubbles.ts: over a man the team sees, in the view). One man: a cue at most every `manSecs`, none on top
//       of a line of his own (bar the two he also shouts); the floor: KIND_GAP between two of a kind.
//   The one line that said what nobody then did — 'back to your posts', from a man whose side then stands where it is — is reworded for a unit (guards.ts),
//   and a place on the net is named by the level's own rooms (dialogue.ts placeName: 'coming at him from the car park' on a floor with no car park).
// (src/game is one import cycle: nothing below is built from another game module's exports at module load.)
import type { Vec3 } from '../math/vec';
import type { Game, Guard } from './game';
import type { RoomFight } from './roomfight';
import { placeName, hashStr } from './dialogue';
import { fightLive } from './roomfight';
import { bubbleSecs } from './guards';
import { pressOwns } from './pressure';
import { squadOwns, squadMen } from './enemysquads';
import { w } from './words';

export const CUES = {
  /** the switch: off = none of this file runs, the strip and every line as they were */
  on: true,
  /** the strip: rows drawn at most · s a row stays · s a row is owed before one of its own class may take its place · rows one class may hold at once */
  rows: 3, secs: 8, minShow: 2.5, perClass: 2,
  /** s inside which the same words are not drawn twice */
  dupSecs: 10,
  /** s between two rows of one class (index = class; 0 = a row that was always on the strip: control, the staff's net) */
  gaps: [0, 1.2, 3, 3, 2.5, 3, 12],
  /** every row of their net that reaches the strip squelches as it arrives (gain; 0 = silent) */
  squelch: 0.35,
  /** s between two cues from one man · s between two of his 'stay' / 'still' lines */
  manSecs: 2.5, againSecs: 28,
  /** s alert with nobody in his sight, standing, before he says he is still holding · … and with no shot in his ears */
  stillSecs: 8, stillQuiet: 5,
  /** s after a loud thing outside his room before a man who has not gone says he is staying */
  staySecs: 2,
};
export const CUES_DEFAULTS: typeof CUES = JSON.parse(JSON.stringify(CUES));
const LS = 'twopointsix.cues';
/** the panel's three rows are kept per machine (a scenario pick is a page load); `?nocues` / `?cues` set the switch for the visit */
const KEPT = ['on', 'squelch', 'stillSecs'] as const;
export function saveCues() { try { const o: Record<string, unknown> = {}; for (const k of KEPT) if (CUES[k] !== CUES_DEFAULTS[k]) o[k] = CUES[k]; if (Object.keys(o).length) globalThis.localStorage?.setItem(LS, JSON.stringify(o)); else globalThis.localStorage?.removeItem(LS); } catch { /* no store */ } }
try { const o = JSON.parse(globalThis.localStorage?.getItem(LS) ?? 'null'); if (o) for (const k of KEPT) if (typeof o[k] === typeof CUES[k]) (CUES as Record<string, unknown>)[k] = o[k]; } catch { /* no store, or not ours */ }
try { const q = new URLSearchParams(location.search); if (q.has('cues')) CUES.on = q.get('cues') !== '0'; if (q.has('nocues')) CUES.on = false; } catch { /* no page (the harness) */ }

/** THE RANKING of the lines the defenders already had: a radio line's class by its words, first match (what a player would most want to know first —
 *  rebuild/telegraphing/decisions.md §7); a line no row knows is the net knowing something (4). The new lines below carry their class themselves. */
const CLASSES: [RegExp, number][] = [
  [/fall(ing)? back|fell back|is lost|out the back|get back|behind me|i'm coming to you/i, 5],
  [/still out there/i, 6],
  [/hold where you are|lost them|quiet now|standing down|gone quiet|covering him|not answering — going back/i, 2],
  [/going round|moving round|moving to|moved on — after them|coming to you|coming at|with you|get round|hit the others|on that door|get in there|in position|^set\b|go go go|go — go|go, go|pushing|on my way|two on this room|everybody, go|stand and fight|charge first|moving up behind|coming in — i|bang out|move up|putting fire|covering — move|^moving!/i, 1],   // (… and Hard's own men on the move: stand to's word, the block's charge, the rescue crew's two — pressure.ts, tactics.ts, rescue.ts; a covered lane's tells — the can going at its guns, the men moving up once it is found empty, fire from a corner and, with `pinGo`, the run-in under it: lanes.ts)
  [/lock the doors|on the doors|back on our doors|stay on your doors|digging in|getting ready|room ready|staying on my door|holding my room|staying on my post|holding my post|let them come|not coming out|holding my corner|holding here|i've got this door|on my own/i, 3],
];
export function cueClass(text: string): number { for (const [re, c] of CLASSES) if (re.test(text)) return c; return 4; }

export type CueKind = 'help' | 'stay' | 'stayOurs' | 'huntOver' | 'calm' | 'cover' | 'still' | 'fellBack' | 'planted' | 'pinnedIn' | 'squadHears' | 'squadCopies' | 'squadWaits' | 'squadCopiesWaits' | 'squadStays' | 'squadQuiet' | 'surprised' | 'flinch';
/** THE NEW LINES: {at} = 'in the mess' / 'outside the mess', {the} = 'the mess' / 'outside the mess', {sq} / {ally} = squad names. cls = its row of the ranking
 *  on their net (the strip) — 0 = spoken only, not a net line; every one is also a bubble over a man the team can see. `now` = the same lines, place for place, as
 *  the dialogue pass has them (words.ts; read through `said()`): what he heard may have been a boot or a charge, so he does not call it 'shots', and a man told to stay
 *  is on his POST — he may have no door and no room of his own. */
const LINES: Record<CueKind, { cls: number; say: string[]; now?: string[] }> = {
  help: { cls: 1, say: ['moving to the fight — {the}', "they're hit {at} — moving to them"] },
  huntOver: { cls: 2, say: ['lost them — holding {the}', 'lost them — staying {at}'] },
  calm: { cls: 2, say: ['quiet now — staying put', 'standing down — holding here'] },
  cover: { cls: 2, say: ['one of them down {at} — covering him'] },
  squadQuiet: { cls: 2, say: ['{sq}: gone quiet here — still holding'] },
  stayOurs: { cls: 3, say: ["they're hit {at} — staying on my door", 'shots {at} — staying on my door'], now: ["they're hit {at} — staying on my post", 'that was {at} — staying on my post'] },
  stay: { cls: 3, say: ['shots {at} — holding my room', 'heard that, {the} — holding my room'], now: ['that was {at} — holding my post', 'heard that, {the} — holding my post'] },
  squadStays: { cls: 3, say: ['{sq}: still on the doors — nobody goes'] },
  squadHears: { cls: 4, say: ['{sq}: heard that — stand by'] },
  squadCopies: { cls: 4, say: ['{sq}: copy, {ally} — stand by'] },
  squadWaits: { cls: 3, say: ['{sq}: hold — let them come in. Wait for my word!'], now: ['{sq}: hold — let them come in. wait for my word!'] },   // (enemysquads.ts drillNet: a drilled garrison's squad that could go, holding on purpose — its word comes later than a 'stand by' squad's, and may be a pair going round)
  squadCopiesWaits: { cls: 3, say: ['{sq}: copy, {ally} — hold, let them come in. Wait for my word!'], now: ['{sq}: copy, {ally} — hold, let them come in. wait for my word!'] },
  fellBack: { cls: 5, say: ['{the} is lost — falling back', 'falling back — {the} is lost'] },
  planted: { cls: 5, say: ['fell back — set {at}'] },
  pinnedIn: { cls: 5, say: ["can't get out — fell back to cover {at}"] },
  still: { cls: 6, say: ["they're still out there — holding {the}", 'still out there — staying on this door'], now: ["they're still out there — holding {the}", 'still out there — staying on my post'] },
  surprised: { cls: 0, say: ['behind—!', 'there—!'] },
  flinch: { cls: 0, say: ['the door—!'] },
};
/** a kind's lines as they are said now: the pass's where it has any — as many as before, so the pick falls on the same place in the list either way */
const said = (k: CueKind): string[] => w(LINES[k].now ?? LINES[k].say, LINES[k].say);
/** s before the same KIND of cue is said again by anybody on the floor (three men over one body say it once; absent = no wait) */
const KIND_GAP: Partial<Record<CueKind, number>> = { cover: 15, huntOver: 4, calm: 4, still: 6, stay: 3, stayOurs: 3 };
/** every new line's words (the QA probe: each falls in a row of CLASSES, none is said twice by the table) */
export function cueLines(): { kind: CueKind; cls: number; text: string }[] { return (Object.keys(LINES) as CueKind[]).flatMap(k => said(k).map(text => ({ kind: k, cls: LINES[k].cls, text }))); }

type Def = RoomFight['defs'][number];
export interface CueRow { t: number; text: string; cls: number; /** class × 2, a squad's word a step ahead of a man's */ rank: number; who: string }
/** a row under a squad's name ('Bravo: …'), not a man's callsign ('Tango 4: …') */
const SQUAD_WORD = /^[A-Z][a-z]{1,11}: /;
type Bubble = { text: string; t: number; dur: number; radio: boolean };
interface Man { state: string; alertT: number; saidT: number; againT: number; stoodT: number; moved: 'fallback' | 'cover' | null; from: string; noiseT: number; ep: number; rallyAt: number; covered: boolean }
const newStats = () => ({ /** unit radio lines handed over by say() · of them drawn */ heard: 0, heardDrawn: 0, /** new lines said · of them on the net · of those drawn */ cues: 0, cueNet: 0, cueDrawn: 0,
  /** rows not drawn: the same words just went out · its class had just spoken · the strip was full of better rows */ dup: 0, gap: 0, full: 0, /** rows that had a drawn row's place · of them rows not yet 1.5 s old */ bumped: 0, bumpedYoung: 0,
  /** rows offered · drawn, by class (index 0 = the rows that were always on the strip) */ filed: [0, 0, 0, 0, 0, 0, 0], drawn: [0, 0, 0, 0, 0, 0, 0] });
const flat = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);

export class Cues {
  /** the strip's rows, oldest first (at most CUES.rows alive) */
  rows: CueRow[] = [];
  stats = newStats();
  /** every new line said, by kind (the QA tally) · every row filed, newest last (capped): what was drawn and what was not, and why */
  kinds: Partial<Record<CueKind, number>> = {};
  log: { t: number; who: string; text: string; cls: number; kind: CueKind | 'heard' | 'raw' | 'call'; drawn: boolean; why: string }[] = [];
  private bubbles = new WeakMap<Guard, Bubble>();
  private men = new WeakMap<Guard, Man>();
  private lastNote: unknown = null; private lastT = -1; private said = new Map<string, number>(); private classT: number[] = []; private squadT: number[] = []; private kindT: Partial<Record<CueKind, number>> = {}; private n = 0; private squelchDue = false;
  constructor(private g: Game) {}

  /** the encounter is another one (a restart, a checkpoint loaded: the clock may have gone back) */
  reset() { this.rows = []; this.bubbles = new WeakMap(); this.men = new WeakMap(); this.lastNote = null; this.said.clear(); this.classT = []; this.squadT = []; this.kindT = {}; this.squelchDue = false; this.stats = newStats(); this.kinds = {}; this.log = []; }

  // ---------------------------------------------------------------- the strip
  private alive(): CueRow[] { const t = this.g.time; return this.rows = this.rows.filter(r => r.t <= t && t - r.t < CUES.secs); }
  /** one row for the strip, or not (the rules at the head); `raw` = a 'radio: ' row as the game has always written them (control, the staff's net): always drawn */
  private file(text: string, cls: number, who: string, kind: CueKind | 'heard' | 'raw' | 'call'): boolean {
    const g = this.g, t = g.time, K = CUES, S = this.stats; const live = this.alive();
    S.filed[cls]++;
    const done = (drawn: boolean, why: string) => { if (drawn) S.drawn[cls]++; this.log.push({ t: +t.toFixed(2), who, text, cls, kind, drawn, why }); if (this.log.length > 400) this.log.splice(0, 100); return drawn; };
    const words = kind === 'raw' || !who || !text.startsWith(who + ': ') ? text : text.slice(who.length + 2);   // (the same words from another man are the same news)
    const squad = SQUAD_WORD.test(text), rank = cls * 2 + (squad ? 0 : 1), within = (at: number | undefined, secs: number) => at !== undefined && t >= at && t - at < secs;
    if (cls > 0) {
      if (within(this.said.get(words), K.dupSecs)) { S.dup++; return done(false, 'dup'); }
      const gap = K.gaps[cls] ?? 0;   // (a squad's word waits only on another squad's; with the strip nearly empty nobody waits)
      if (live.length >= K.rows - 1 && within(squad ? this.squadT[cls] : this.classT[cls], gap)) { S.gap++; return done(false, 'gap'); }
    }
    if (live.length >= K.rows) {   // the strip is full: whose place does it take?
      const held = (c: number) => live.filter(r => r.cls === c).length;
      const over = live.find(r => r.cls > 0 && r.cls !== cls && held(r.cls) > K.perClass);
      let v: number;
      if (over) v = live.indexOf(over);   // another class holds more than its share (it had the strip to itself): its oldest row
      else if (cls > 0 && held(cls) >= K.perClass) { v = live.findIndex(r => r.cls === cls); if (t - live[v].t < K.minShow) { S.full++; return done(false, 'full'); } }   // its own class has its share: the older of those, once that has been read
      else { v = 0; for (let i = 1; i < live.length; i++) if (live[i].rank > live[v].rank) v = i;   // else the worst-ranked row, the oldest of them — never a better one
        if (rank > live[v].rank || (rank === live[v].rank && cls > 0 && t - live[v].t < K.minShow)) { S.full++; return done(false, 'full'); } }
      if (t - live[v].t < 1.5) S.bumpedYoung++;
      live.splice(v, 1); S.bumped++;
    }
    if (cls > 0) this.squelchDue = true;   // the net in his ear: a row that arrives is heard arriving (tick: once a frame, not placed — the man may be four rooms off)
    live.push({ t, text, cls, rank, who }); this.said.set(words, t); this.classT[cls] = t; if (squad) this.squadT[cls] = t;
    if (this.said.size > 96) for (const [k, v] of this.said) if (t - v > K.dupSecs || v > t) this.said.delete(k);
    return done(true, '');
  }
  /** Game.msg: a row written 'radio: …' (control, the staff's net, Sam's own call) — on the strip as it always was */
  raw(text: string) { if (CUES.on && text.startsWith('radio: ')) this.file(text.slice(7), 0, '', 'raw'); }
  /** guards.ts say(): a UNIT's line went out on his side's net — the strip gets it, under his callsign (a squad's word is already under the squad's name) */
  heard(gd: Guard, text: string) {
    if (!CUES.on || gd.team !== 'hostile' || !fightLive(this.g)) return;   // (the defenders of a room fight: not a showcase's cast, not the team's own net, not the night game's response)
    this.stats.heard++;
    if (this.file(SQUAD_WORD.test(text) ? text : `${gd.callsign}: ${text}`, cueClass(text), gd.callsign, 'heard')) this.stats.heardDrawn++;
  }
  /** laststand.ts, enemysquads.ts's radio check: a defender's line on his side's net that is TELLING only — the strip's row under his callsign (a squad's
   *  word is already under the squad's name) and this file's own bubble over him, never Guard.bubble (the bark clocks and the digest read that) */
  net(gd: Guard, text: string, cls: number) {
    this.bubbles.set(gd, { text, t: this.g.time, dur: bubbleSecs(text), radio: true });
    if (!CUES.on || !fightLive(this.g)) return;
    this.stats.heard++;
    if (this.file(SQUAD_WORD.test(text) ? text : `${gd.callsign}: ${text}`, cls, gd.callsign, 'heard')) this.stats.heardDrawn++;
  }
  /** fogofwar.ts: a TEAMMATE calls what the fog's cone hides ('contact left!') — this file's own bubble over him (never Guard.bubble) and a row on the strip
   *  under his callsign, in the first class (men coming), logged under a kind of its own ('call': a tally of the defenders' 'heard' lines never counts the team's).
   *  Returns whether the strip drew it */
  call(gd: Guard, text: string): boolean {
    this.bubbles.set(gd, { text, t: this.g.time, dur: bubbleSecs(text), radio: false });
    return CUES.on && this.file(`${gd.callsign}: ${text}`, 1, gd.callsign, 'call');
  }
  /** deathrecap.ts: a word over a man for the player's eyes alone — the bubble, no strip row, no class clock: nothing the net's own lines wait on (laststand.ts netWait); false with the cues off (nothing is drawn) */
  aside(gd: Guard, text: string): boolean { if (!CUES.on) return false; this.bubbles.set(gd, { text, t: this.g.time, dur: bubbleSecs(text), radio: false }); return true; }
  /** laststand.ts: seconds until the strip would take a line of this class without dropping it for the class's gap (0 = now, and with the cues off) */
  netWait(cls: number): number { const at = this.classT[cls], t = this.g.time; return !CUES.on || at === undefined || t < at ? 0 : Math.max(0, at + (CUES.gaps[cls] ?? 0) + 0.05 - t); }
  /** savestate.ts: the message ring has been put back as it was saved — its 'radio: ' rows are the strip's again */
  adopt(msgs: { text: string; t: number }[]) { if (CUES.on) this.rows = msgs.filter(m => m.text.startsWith('radio: ')).slice(-CUES.rows).map(m => ({ t: m.t, text: m.text.slice(7), cls: 0, rank: 1, who: '' })); }
  /** what a man is saying, as the bubbles draw it: his line (Guard.bubble) or a cue of this file's, whichever is the later and still running */
  bubbleOf(gd: Guard): Bubble | null {
    const b = gd.bubble; if (!CUES.on) return b;
    const c = this.bubbles.get(gd); if (!c) return b;
    const t = this.g.time; if (t < c.t || t - c.t > c.dur) { this.bubbles.delete(gd); return b; }
    return b && b.t >= c.t ? b : c;
  }

  // ---------------------------------------------------------------- the words
  private at(p: Vec3): { the: string; at: string } { const n = placeName(this.g.level, p); return { the: n, at: /^outside /.test(n) ? n : `in ${n}` }; }
  private man(gd: Guard): Man { let M = this.men.get(gd); if (!M) { M = { state: gd.state, alertT: this.g.time, saidT: -100, againT: -100, stoodT: -100, moved: null, from: '', noiseT: -100, ep: -1, rallyAt: NaN, covered: false }; this.men.set(gd, M); } return M; }
  /** one cue from this man, if he can speak and has not just spoken: a bubble, and (a net line) a row for the strip */
  private cue(gd: Guard, kind: CueKind, vars: Record<string, string> = {}): boolean {
    const g = this.g, t = g.time, M = this.man(gd);
    if (gd.state === 'dead' || gd.held || t < gd.dazzledUntil || t - M.saidT < CUES.manSecs) return false;
    const b = gd.bubble, own = !!b && t >= b.t && t - b.t < 1.5;   // he has just said something of his own: that was his word on it —
    if (own && !(kind === 'help' || kind === 'fellBack' || kind === 'squadWaits' || kind === 'squadCopiesWaits')) return false;   // — but a shout to the men beside him ('fall back!', 'move!') is not the net: these two still go out on it (and a squad's 'hold — wait for my word' is the squad's word on its net, whatever he has just barked at the noise)
    if (this.kindBusy(kind)) return false;   // (the floor has just heard this from somebody)
    this.kindT[kind] = t;
    const L = LINES[kind], say = said(kind); const text = say[(hashStr(gd.callsign) + this.n++) % say.length].replace(/\{(\w+)\}/g, (_m, k: string) => vars[k] ?? '');
    M.saidT = t; this.stats.cues++; this.kinds[kind] = (this.kinds[kind] ?? 0) + 1;
    if (!own) this.bubbles.set(gd, { text, t, dur: bubbleSecs(text), radio: L.cls > 0 });
    if (!L.cls) return true;
    this.stats.cueNet++;
    if (this.file(SQUAD_WORD.test(text) ? text : `${gd.callsign}: ${text}`, L.cls, gd.callsign, kind)) this.stats.cueDrawn++;
    return true;
  }
  private kindBusy(kind: CueKind): boolean { const t = this.g.time, kt = this.kindT[kind]; return kt !== undefined && t >= kt && t - kt < (KIND_GAP[kind] ?? 0); }
  private fit(gd: Guard): boolean { const t = this.g.time; return gd.state !== 'dead' && !gd.held && t >= gd.dazzledUntil && t >= gd.staggerUntil; }
  private squadVoice(name: string, by: string): Guard | null {
    const g = this.g, men = squadMen(g, name).filter(m => this.fit(m)); if (!men.length) return null;
    return men.find(m => m.callsign === by) ?? men.find(m => g.fight.defs.some(D => D.gd === m && D.mode === 'hold')) ?? men[0];
  }

  // ---------------------------------------------------------------- once a frame, after everybody has moved
  tick() {
    const g = this.g, t = g.time, F = g.fight, K = CUES;
    if (!K.on || !F.live) return;   // (a room fight's defenders are whom this reads: the night game and the showcases pay one test a frame)
    if (t < this.lastT) this.reset(); this.lastT = t;
    // 1 · what the fight's modules noted this frame (roomfight.ts note, enemysquads.ts note / event, pressure.ts note)
    const L = F.log as { t: number; who: string; what: string }[];
    let i = this.lastNote ? L.lastIndexOf(this.lastNote as { t: number; who: string; what: string }) + 1 : 0;
    for (; i < L.length; i++) { const n = L[i]; this.lastNote = n; if (t - n.t <= 0.5) this.note(n.who, n.what); }
    // 2 · each defender as he now stands
    for (const D of F.defs) {
      const gd = D.gd, M = this.man(gd); if (gd.state === 'dead') continue;
      if (gd.state === 'alert' && M.state !== 'alert') M.alertT = t;
      const sight = t - gd.lastSeenT, still = Math.hypot(gd.char.vel[0], gd.char.vel[2]) < 0.3;
      if (gd.state === 'patrol' && M.state !== 'patrol' && D.mode === 'hold' && t - M.stoodT > 15) { if (this.cue(gd, 'calm')) M.stoodT = t; }
      else if (g.player.down && gd.foe === 'player' && gd.state === 'alert' && !M.covered && still && flat(gd.char.pos, g.player.char.pos) < 3.5) { if (this.cue(gd, 'cover', this.at(g.player.char.pos)) || this.kindBusy('cover')) M.covered = true; }   // (said, or a man beside him has just said it for both)
      else if (gd.state === 'alert' && D.mode === 'hold' && still && sight > K.stillSecs && t - M.alertT > K.stillSecs && t - gd.witness.heard.lastShotT > K.stillQuiet && t - M.againT > K.againSecs && !(gd.foe === 'player' && g.player.down) && !g.rescue?.crewHides(gd)) {   // (rescue.ts, Hard's crew: a man lying in wait does not name his room on the net)
        if (this.cue(gd, 'still', this.at(gd.char.pos))) M.againT = t; }
      // a loud thing outside his room, and he has not gone: the dice said stay (rallyAt drawn again), or nobody of his side is posted where it came from
      if (D.noiseAt && D.noiseOut && D.noiseT > M.noiseT && M.ep < 0 && D.mode === 'hold') M.ep = D.noiseT;
      if (M.ep >= 0) {
        const drawnAgain = !isNaN(M.rallyAt) && !isNaN(D.rallyAt) && D.rallyAt > M.rallyAt + 1;
        if (D.mode !== 'hold' || t - D.noiseT > 6) M.ep = -1;
        else if (!squadOwns(g, gd) && !pressOwns(g, D) && sight > 3 && t - M.againT > K.againSecs && D.noiseAt && (drawnAgain || isNaN(D.rallyAt) && t - M.ep >= K.staySecs && t - D.noiseT < 1.5)) {
          if (this.cue(gd, drawnAgain ? 'stayOurs' : 'stay', this.at(D.noiseAt))) M.againT = t; M.ep = -1; }
      }
      M.noiseT = D.noiseT; M.rallyAt = D.rallyAt; M.state = gd.state;
    }
    if (this.squelchDue) { this.squelchDue = false; if (K.squelch > 0) g.audio.play('radio', null, K.squelch); }
  }
  private note(who: string, what: string) {
    const g = this.g; const D: Def | undefined = who === '-' ? undefined : g.fight.defs.find(d => d.gd.callsign === who && d.gd.state !== 'dead');
    const sq = /^\[squads\] (\S+) (hears of them \((\S+?)'s call\)|hears of them|stays on its doors|quiet:)/.exec(what);
    if (sq) {
      const v = this.squadVoice(sq[1], who); if (!v) return;
      if (sq[2].startsWith('hears')) {
        const vars = { sq: sq[1], ally: sq[3] ?? '' };
        if (!/\), holds:/.test(what)) this.cue(v, sq[3] ? 'squadCopies' : 'squadHears', vars);
        // (a drilled garrison holding on purpose is the tell that its word comes late: if its voice has just spoken, the next man of the squad says it)
        else for (const m of [v, ...squadMen(this.g, sq[1]).filter(x => x !== v && this.fit(x))]) if (this.cue(m, sq[3] ? 'squadCopiesWaits' : 'squadWaits', vars)) break;
      }
      else this.cue(v, sq[2].startsWith('stays') ? 'squadStays' : 'squadQuiet', { sq: sq[1] });
      return;
    }
    if (!D) return;
    const gd = D.gd, M = this.man(gd), here = () => this.at(gd.char.pos);
    if (/^goes to the fight next door/.test(what)) this.cue(gd, 'help', this.at(D.noiseAt ?? gd.lastKnown ?? gd.char.pos));
    else if (/^holds where he ended up/.test(what)) { if (g.time - M.stoodT > 15 && this.cue(gd, 'huntOver', here())) M.stoodT = g.time; }
    else if (/^falls back (through|to his squad)/.test(what)) { M.moved = 'fallback'; M.from = placeName(g.level, D.station); M.saidT = -100; this.cue(gd, 'fellBack', { the: M.from }); }
    else if (/^takes cover/.test(what)) M.moved = 'cover';
    else if (/^plants \(/.test(what)) {
      if (M.moved === 'fallback' && !/^plants \(contact\)/.test(what)) { const h = here(); M.saidT = Math.min(M.saidT, g.time - CUES.manSecs); this.cue(gd, h.the === M.from ? 'pinnedIn' : 'planted', h); }
      M.moved = null;
    }
    else if (/^surprised /.test(what)) this.cue(gd, 'surprised');
    else if (/^flinches:/.test(what)) this.cue(gd, 'flinch');
    else if (/stays to keep his room/.test(what)) { if (g.time - M.againT > CUES.againSecs && D.noiseAt && this.cue(gd, 'stayOurs', this.at(D.noiseAt))) M.againT = g.time; }
  }

  /** 'on · 14 rows drawn of 41 · 9 new lines' — the panel's line */
  summary(): string {
    if (!CUES.on) return 'off';
    const S = this.stats, drawn = S.heardDrawn + S.cueDrawn, of = S.heard + S.cueNet;
    return `${drawn} of ${of} net lines drawn · ${S.cues} new lines${S.dup + S.gap + S.full ? ` · held back: ${S.dup} said already, ${S.gap} too soon, ${S.full} outranked` : ''}`;
  }
}

/** the strip's rows this frame, as 'radio: …' rows oldest first (both HUDs draw these): this file's while it is on, else the message ring's as ever */
export function stripRows(g: Game): { text: string; t: number }[] {
  if (!CUES.on) return g.messages.filter(m => g.time - m.t < 8 && m.text.startsWith('radio: ')).slice(-3);
  const live = [...g.cues.rows].filter(r => r.t <= g.time && g.time - r.t < CUES.secs);
  return live.slice(-CUES.rows).map(r => ({ text: 'radio: ' + r.text, t: r.t }));
}
