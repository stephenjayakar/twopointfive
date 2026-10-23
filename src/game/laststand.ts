// THE LAST DEFENDERS (the maintainer, 10-08, playing the compound: "it also took a while to find the last two stragglers. ready or not has this problem too for
// the "bring order to chaos" objective. curious how we can make this more fun while still having the peril of barricaded defenders"). Two switches, both
// `regroup` ships OFF, `callOut` ON (10-08: telling only, so the run is the run with both off) — with both off nothing here runs, no die is drawn and the room fight is run for run what it was (the seams: `lastStandTick` at the tail of
// RoomFight.tick, `lastStandStop` in stop(), one clause each in rally(), lost(), the dig-in's gate / wedge rule / stand-down, the squads' home(), the press's
// consider(), and the room clear's objective()).
//
//   WHEN. A room clear (not the hostage rescue), once `few` (3) or fewer of its defenders are up and no more than a third of the staging (the compound's
//     eleven: three; the block's eight: two; the office's five: the last man). Until that frame a run with
//     either switch on IS the run with both off: nothing is drawn or written before it, so a tally pairs by seed up to the endgame.
//   THE RADIO CHECK (both switches). The survivors do not know they are the last by telepathy: one of them who is fit and has had nobody of the team in his
//     sight these `quiet` seconds asks the net who is still up. Whoever is fit and calm answers on his own beat; a man in a fight does not answer and is not
//     counted. What the check closes with — who answered — is ALL the survivors know of each other. It is asked again every `every` seconds (`again` once they
//     have made their stand): a man who was busy the first time answers the next.
//   `callOut` — CALL OUT (telling only: nothing a man's AI, the dice of the simulation or a digest reads is written). Every answer says where the man is by
//     the level's own rooms ('still up — in the kitchen'), and the one who asked says where he is. A man nobody answers knows he is the last, and says that
//     and his room ('…if anyone can hear me, I'm in the office!'). Their net is on the HUD's radio strip (cues.ts), so the player hears where to go — said by
//     men to each other, never to the team. (`regroup` says the same places: the one who picks the room has to know where they are. `callOut` is that
//     telling half alone.)
//   `places` — THE LINE IS TRUE OF WHERE HE STANDS (on; off = the lines as they were, word for word — `callOut` stays telling only either way). A man in floor
//     nobody holds — the compound's front hall, a corridor, a yard — is 'in the front hall' by the level's own name for it (dialogue.ts placeIn: the structure's
//     rooms, then `scenarios.places`), not 'outside' the nearest held room through a solid wall; a man on a room's threshold is in that room; and the HUD's
//     marker goes to the place he named when it is no room of the list. A man who has left the place he named says so once he has stopped ('moved — I'm in the
//     corridor now'); one who has gone after the team says he is out of it, and the marker comes off. Nobody is pinned to the room he named: the line follows
//     the man.
//   `regroup` — REGROUP AND DIG IN LOUDLY. At the close of a check the one who asked picks the room to make the stand in, by situation and never a die: a
//     room one of the answering men is holding, or the post one of them was staged on (the team not known to be in it, never entered) — the one MOST of
//     them are in or can reach, then the one with the most doors already wedged. A man can come if
//     he holds a post, nobody else has him (a squad about to give its word or with him out on a leg, the press, a door he is already working on), a squad
//     whose men stay in its rooms keeps to those, and his way there is at most `maxM` and does not pass within `clearM` of where the team was last seen or
//     heard; ties go to the most men already there, the farthest from the team, the least walking. He ORDERS it on the net, naming the room ('everybody to
//     the office — we hold it there!'), the men who come say so and run (pressure.ts `run` + `boots`: heard, and stopped by the room fight's own rules — an
//     enemy seen close and he fights where he is), a man with no way says that and where he digs in instead. In the room every man digs in through digin.ts —
//     furniture hauled and wedged under the doors (scrapes and thuds, any door of that room, squads' barricade lists or not), a spot off the door's line, set
//     on it and STEADY when it is booted — and they stay set: no standing down after the dig-in's `holdSecs`, no giving the room up through a door (cover
//     inside it still), no rally to a noise next door. When they are set one of them says so; from then one of them shores the wedge up every `thump` seconds
//     (a thud at the door, heard like any shoved furniture) and the check goes out with the room's name. A lone last man digs in where he stands;
//     a man out hunting (the room fight's 'free') is nobody's to order: he answers, and is counted, and is taken in once he holds a post again.
//     A man who arrives is the stand room's man for the room clear (roomclear.ts `rehome`): the room he left can clear behind him.
//   THE HUD. Under either switch the objective's marker sits on the first room still held that their net has NAMED, and the list brackets those rooms — what
//     the player has been told, not where the men truly are.
//   The die here is its own (mulberry32 off the room clear's seed and attempt): never Math.random. (digin.ts draws its own beats from Math.random as it always
//   has — once `regroup` has ordered a dig-in the run is a different run; `callOut` alone never is.)
// (src/game is one import cycle: nothing below is built from another game module's exports at module load.)
import { SideMap } from '../math/side';
import { Vec3, v3 } from '../math/vec';
import { dieOf, roll, type Die } from '../math/dice';
import type { Game, Guard } from './game';
import type { RoomFight } from './roomfight';
import { run, boots, pressOwns } from './pressure';
import { squadDefers, squadStaysIn, squadBusy, squadHolds } from './enemysquads';
import { CUES } from './cues';
import { placeIn } from './dialogue';
import { WORDS } from './words';
import { digInOrder, digInPhase, digInEntered, digInWedged, digInRelease } from './digin';
import { runnerFled } from './runner';   // (asked inside lastStandTick only: false with its switch off)
import { NETQUIET, netQuietClosed } from './netquiet';

export const LASTSTAND = {
  /** REGROUP AND DIG IN LOUDLY (shipped off): the last defenders gather in one room on a spoken order, wedge it and hold it to the end */
  regroup: false,
  /** CALL OUT (shipped ON since 10-08; telling only): the last defenders name their rooms on their net. `?callout=0`, the panel's row or `LASTSTAND=nocallout` in the harness's environment = off */
  callOut: true,
  /** THE LINE IS TRUE OF WHERE HE STANDS (telling only; rides on either switch above): a man is named by the level's own word for the floor he is on — a room
   *  of the structure, or a place nobody holds (dialogue.ts placeIn) — the marker goes there, and he says again when he has moved. Off = the lines as they were */
  places: true,
  /** `places`: he has been out of the place he named this long (s), and has stood still this long (s), before he says where he is now; no man says it more
   *  often than every `movedGap` s */
  movedSecs: 3, stillSecs: 2, movedGap: 8,
  /** 'most are down': this many defenders or fewer are up — and never more than a third of the staging (eleven: three; eight: two; five: the last man) */
  few: 3,
  /** nobody of the team in his sight these seconds: a man may ask, answer, be ordered */
  quiet: 3,
  /** seconds from 'most are down' to the first radio check [min, max] */
  first: [3, 6] as [number, number],
  /** seconds between checks, and between them once the stand is made */
  every: 22, again: 30,
  /** an answer's beat after the check [min, max], and between two answers (their net's strip takes a line of a kind every three seconds) */
  answer: [1.2, 2.2] as [number, number], between: [3.2, 3.9] as [number, number],
  /** the one who asked listens this long after the last answer is due [min, max] (what he says then is a line of the answers' kind: past the strip's three seconds) */
  listen: [3.2, 3.8] as [number, number],
  /** a man comes if his way is at most this long (m) and does not pass this near where the team was last seen or heard (m) these `knownSecs` */
  maxM: 38, clearM: 4, knownSecs: 30,
  /** his beat between the order and setting off [min, max]; the way is run in at most this many legs (the room fight's move is ten seconds long) */
  go: [1.3, 2] as [number, number], legs: 5,
  /** his beat between the order and starting on the room's doors [min, max] */
  dig: [0.6, 1.6] as [number, number],
  /** once set: seconds between two thuds at a wedged door [min, max], and how loud (a hauled chair's scrape is 0.5) */
  thump: [9, 14] as [number, number], thumpLevel: 0.6,
};
export const LASTSTAND_DEFAULTS: typeof LASTSTAND = JSON.parse(JSON.stringify(LASTSTAND));
const LS = 'twopointsix.laststand';
/** the panel's rows are kept per machine; `?regroup` / `?callout` (and `=0`) set a switch for the visit; the harness sets them by `LASTSTAND=regroup,callout`
 *  in the environment (tools/qa/playthrough.ts's --set reaches a fixed list of tables) */
const KEPT = ['regroup', 'callOut', 'places', 'few', 'every', 'again', 'maxM'] as const;   // (the panel's rows)
export function saveLastStand() { try { const o: Record<string, boolean | number> = {}; for (const k of KEPT) if (LASTSTAND[k] !== LASTSTAND_DEFAULTS[k]) o[k] = LASTSTAND[k]; if (Object.keys(o).length) globalThis.localStorage?.setItem(LS, JSON.stringify(o)); else globalThis.localStorage?.removeItem(LS); } catch { /* no store */ } }
try { const o = JSON.parse(globalThis.localStorage?.getItem(LS) ?? 'null'); if (o) for (const k of KEPT) if (typeof o[k] === typeof LASTSTAND[k]) (LASTSTAND as Record<string, unknown>)[k] = o[k]; } catch { /* no store, or not ours */ }
try { const q = new URLSearchParams(location.search); if (q.has('regroup')) LASTSTAND.regroup = q.get('regroup') !== '0'; if (q.has('callout')) LASTSTAND.callOut = q.get('callout') !== '0'; if (q.has('calloutplaces')) LASTSTAND.places = q.get('calloutplaces') !== '0'; } catch { /* no page (the harness) */ }
try { const e = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.LASTSTAND; if (e) { const w = e.toLowerCase().split(/[\s,+]+/); if (w.includes('regroup')) LASTSTAND.regroup = true; if (w.includes('callout')) LASTSTAND.callOut = true; if (w.includes('nocallout')) LASTSTAND.callOut = false; if (w.includes('places')) LASTSTAND.places = true; if (w.includes('noplaces')) LASTSTAND.places = false; } } catch { /* no process (the page) */ }

type Def = RoomFight['defs'][number];
type Room = NonNullable<Def['room']>;
type LineKind = 'check1' | 'checkN' | 'checkStand' | 'checkLoneAt' | 'ansAt' | 'ansFreeAt' | 'fewAt' | 'lastAt' | 'lastGo'
  | 'movedAt' | 'movedFree'
  | 'order' | 'orderFrom' | 'orderStay' | 'orderShut' | 'orderOut' | 'go' | 'cant' | 'in' | 'short' | 'set' | 'setOpen' | 'setLone' | 'setLoneOpen';
/** THE LINES, each to their own side on their net: {n} = how many answered (the one who asked among them), {the} = 'the office' / 'outside the office',
 *  {at} = 'in the office' / 'outside the office'. cls = its row of the strip's ranking (cues.ts: 1 men coming · 3 holding on purpose · 4 the net knows) */
const LINES: Record<LineKind, { cls: number; say: string[]; /** the same lines, place for place, as the dialogue pass has them (words.ts; read in net()) */ now?: string[] }> = {
  check1: { cls: 4, say: ['radio check — who\'s still up? sound off!', 'all posts, radio check — who\'s left? sound off!'] },
  checkN: { cls: 4, say: ['radio check — sound off, who\'s still up?', 'count off — who\'s still with us?'] },
  checkStand: { cls: 4, say: ['anyone else out there? we\'re holed up in {the} — get to us!', 'any post still up — we\'re in {the}. sound off!'] },
  checkLoneAt: { cls: 4, say: ['anybody? anybody still up? I\'m still {at}.', 'if anyone\'s left — I\'m still {at}. sound off!'] },
  ansAt: { cls: 3, say: ['still up — {at}.', 'here — holding {the}.', 'still here — {at}.'] },
  ansFreeAt: { cls: 3, say: ['still up — after them, {at}.', 'here — on them, {at}.'], now: ['still up — going after them, {at}.', 'here — I\'m on them, {at}.'] },
  fewAt: { cls: 3, say: ['that\'s only {n} of us — I\'m {at}. stay on your doors!', '{n} of us left — I\'m {at}. nobody opens a door!'],
    now: ['that\'s only {n} of us — I\'m {at}.', '{n} of us left — I\'m {at}.'] },   // (the count and where he is, no order with it: the men who answered may be out after the team, or on a post with no door)
  lastAt: { cls: 3, say: ['nobody\'s answering — if anyone can hear me, I\'m {at}!', 'no answer… it\'s just me. if anyone\'s left, I\'m {at}!'] },
  // (`places`: he is no longer where he said — {at} where he stands now; {the} the place he named and has left to go after the team)
  movedAt: { cls: 3, say: ['moved — I\'m {at} now.', 'I\'ve moved — {at} now.'] },
  movedFree: { cls: 3, say: ['I\'m out of {the} — going after them.', 'left {the} — I\'m on them.'] },
  lastGo: { cls: 3, say: ['nobody\'s answering — if anyone can hear me, I\'m going back to {the}!', 'no answer… it\'s just me. I\'ll be in {the} if anyone\'s left!'] },
  order: { cls: 1, say: ['that\'s {n} of us left — everybody to {the}, we hold it there!', 'only {n} of us — fall back on {the}. we make our stand there!'] },
  orderFrom: { cls: 1, say: ['that\'s {n} of us left — get together in {the} and hold it. I can\'t reach you: I\'m keeping {at}.', 'only {n} of us — make the stand in {the}. no way through for me, I\'m staying {at}.'] },
  orderStay: { cls: 3, say: ['that\'s {n} of us and no way to each other — I\'m {at}. block your doors and hold where you are!'] },
  orderShut: { cls: 3, say: ['that\'s {n} of us left — I\'m {at}. stay shut in where you are, nobody opens a door!'] },
  orderOut: { cls: 3, say: ['that\'s {n} of us and no way to each other — I\'m {at}. hold where you are and watch every way in!'] },   // (one of them stands outside: no door of his to block)
  go: { cls: 1, say: ['moving to {the} — don\'t shoot me coming in!', 'on my way to {the}!'] },
  cant: { cls: 3, say: ['can\'t get to you — digging in {at}.', 'no way through to you. I\'ll hold {the}.'] },
  in: { cls: 3, say: ['I\'m in — {n} of us in {the}.', 'made it. {n} of us in {the}.'] },
  short: { cls: 3, say: ['can\'t make it — holding {at}.', 'not getting through. holding {at}.'] },
  // (set / setLone: a door of it stands wedged. …Open: they are in place, no furniture under a door — a leaf that would not shut on a body, nothing to haul)
  set: { cls: 3, say: ['{the} is shut — let them come.', 'door\'s blocked. we\'re set in {the}.'] },
  setOpen: { cls: 3, say: ['we\'re set in {the}. they\'ll have to come through the door.', 'in position in {the} — guns on the door.'] },
  setLone: { cls: 3, say: ['I\'m shut in {the}. if anyone\'s left — I\'m not coming out.', 'door\'s blocked, {the}. I\'m staying put.'] },
  setLoneOpen: { cls: 3, say: ['I\'m set in {the}. if anyone\'s left — I\'m not coming out.', 'gun\'s on the door, {the}. I\'m staying put.'] },
};

interface Mover { D: Def; phase: 'beat' | 'run'; goAt: number; spot: Vec3; tries: number; stepT: number; t0: number; /** he has said where he is going already */ quiet: boolean }
interface Stand {
  /** the room they hold (null: nobody could reach anybody — each man digs in where he is) */ room: Room | null; id: string | null; the: string; anchor: Vec3; t: number;
  /** in the room · told to hold where they are · on their way */ in: Set<Def>; out: Set<Def>; movers: Mover[];
  setSaid: boolean; setT: number; thumpAt: number; lookT: number; orders: Map<Def, number>; homed: Set<Def>;
}
interface Check { caller: Def; t: number; closeAt: number; due: { D: Def; at: number }[]; got: Def[] }
export interface LastStandSaid { t: number; who: string; kind: string; text: string; /** where he stood as he said it (x, z): for the checks — nothing in the game reads it */ at: [number, number] }
const newStats = () => ({
  /** the endgame started (game clock; NaN = it never did) */ t0: NaN, /** defenders up then */ up0: 0,
  checks: 0, answers: 0, /** men up who did not answer, summed over the checks */ silent: 0, lastMan: 0,
  /** stands made · of them in one room with two or more · men sent (= arrived + stopped short + met on the way + down on the way + called off + still on their way) · no way */
  stands: 0, gathered: 0, sent: 0, arrived: 0, short: 0, met: 0, diedOnWay: 0, /** called off before he set out */ dropped: 0, /** sent without a 'moving' line (he has said where he goes, or goes back in) */ quiet: 0, noWay: 0,
  /** `places`: 'moved' lines said */ moved: 0,
  digOrders: 0, /** game clock of the order and of 'we're set' (NaN = never) */ standT: NaN, setT: NaN, /** men in the stand room when it was said set */ setMen: 0, thumps: 0, lines: 0,
});
interface Later { at: number; t0: number; gd: Guard; kind: LineKind; text: string; cls: number; then?: () => void; /** `places`: the line's wording and what fills it, asked again as it is said */ tpl: string; redo?: () => { vars: Record<string, string>; then?: () => void } }
interface State {
  die: Die; nextAt: number; check: Check | null; known: Set<Def>; named: Map<Def, string>; stand: Stand | null;
  /** `places`: the place each of them last named that is no room of the structure, and what every named man said last (to say again when it is no longer true) */
  spots: Map<Def, Spot>; at: Map<Def, Said>; loneSaid: boolean; fewN: number; told: Set<Def>;
  hint: Hint | null; said: LastStandSaid[]; stats: ReturnType<typeof newStats>; stale: boolean;
  /** the post each of them was staged on (room id), and the staging it was read off (seed:attempt) */ post: Map<Guard, string>; key: string;
  /** the lines: the next variant of each kind (two men never say the same words back to back), when a line of each class may next go out, and the lines waiting for that */
  rot: Map<LineKind, number>; clsAt: number[]; later: Later[];
}
/** a named place that is no room of the structure: its name as the list shows it ('front hall'), and where the marker goes (the middle of its floor) */
interface Spot { name: string; pos: Vec3 }
/** what a man last named: `key` the room's id or the place's name, `the` as he said it; since when he has been somewhere else (NaN: he has not), where and
 *  since when he has stood still, when he last said he moved */
interface Said { key: string; the: string; offT: number; stillAt: Vec3; stillT: number; saidT: number }
export interface Hint { key: string; rooms: Set<string>; /** `places`: named places that are no room of the list, first named first */ spots: Spot[] }
const STATES = new SideMap<Game, State>('laststand.STATES');

const flat = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const alive = (D: Def) => D.gd.state !== 'dead';
const pick = (st: State, r: [number, number]) => r[0] + roll(st.die) * (r[1] - r[0]);
const cellOf = (g: Game, p: Vec3) => { const nav = g.col.nav; return nav.idx(Math.floor(p[0] / nav.cell), Math.floor(p[2] / nav.cell)); };
const inRoom = (g: Game, R: Room | null, p: Vec3) => !!R && R.cells.has(cellOf(g, p));
const note = (g: Game, F: RoomFight, gd: Guard | null, what: string) => { F.log.push({ t: g.time, who: gd ? gd.callsign : '-', what: `[last] ${what}` }); if (F.log.length > 600) F.log.splice(0, 200); };
/** fit to speak or be spoken to: up, not held, his wits about him */
const fitGd = (g: Game, gd: Guard) => gd.state !== 'dead' && !gd.held && g.time >= gd.dazzledUntil && g.time >= gd.staggerUntil;
const fit = (g: Game, D: Def) => fitGd(g, D.gd);
/** … and nobody of the team in his sight these `quiet` seconds */
const calm = (g: Game, D: Def) => fit(g, D) && g.time - D.gd.lastSeenT > LASTSTAND.quiet;
/** … and free to be sent somewhere: holding a post, and nobody else's man (his squad's word or leg, the press, the rescue's men with the hostages), his hands
 *  not on a door or its furniture this moment (a man SET behind a door he has wedged may leave it for the stand: one room held by all of them, not three by one each) */
const movable = (g: Game, D: Def) => calm(g, D) && D.mode === 'hold' && D.rallyAt !== Infinity && !squadDefers(g, D.gd) && !squadBusy(g, D.gd) && !pressOwns(g, D) && (digInPhase(g, D.gd) === 'idle' || digInPhase(g, D.gd) === 'set');

/** where a point is, by the structure's own rooms (dialogue.ts placeName's rule, whatever the cues' switch says) */
function where(g: Game, p: Vec3): { id: string | null; the: string; at: string } {
  const rooms = g.roomClear.structure?.rooms ?? []; let best: (typeof rooms)[number] | null = null, bd = Infinity;
  const the = (n: string) => /^the |\d$/.test(n) ? n : `the ${n}`;
  for (const r of rooms) {
    const b = r.bounds, d = Math.hypot(Math.max(b.x0 - p[0], 0, p[0] - b.x1), Math.max(b.z0 - p[2], 0, p[2] - b.z1));
    if (d === 0) return { id: r.id, the: the(r.name), at: `in ${the(r.name)}` };
    if (d < bd) { bd = d; best = r; }
  }
  const out = best ? `outside ${the(best.name)}` : 'out here';
  return { id: null, the: out, at: out };
}
/** WHERE A MAN SAYS HE IS (`places`; off = `where`, word for word): the level's own name for the floor he stands on — a room of the structure (its id: the
 *  list brackets it), or a place nobody holds (`spot`: the marker goes to it) — and only on ground the level has no word for, 'outside' the nearest room */
function spoken(g: Game, p: Vec3): { id: string | null; the: string; at: string; spot: Spot | null } {
  const w = where(g, p); if (!LASTSTAND.places || w.id) return { ...w, spot: null };   // (inside a room of the list: its own word, as ever — on the office too, whose other names carry no id)
  const r = placeIn(g.level, p); if (!r) return { ...w, spot: null };
  const id = r.id && g.roomClear.structure?.rooms.some(x => x.id === r.id) ? r.id : null;
  return { id, the: r.name, at: `in ${r.name}`, spot: id ? null : { name: r.name.replace(/^the /, ''), pos: [(r.x0 + r.x1) / 2, 0, (r.z0 + r.z1) / 2] } };
}
/** a line on their net, and over the man if the team can see him: the log row every defender's radio line is, and the strip's row (cues.ts) — never
 *  Guard.bubble, never a clock anybody's AI reads */
function voice(g: Game, F: RoomFight, st: State, gd: Guard, kind: LineKind, text: string, cls: number) {
  g.msg(`${gd.callsign} (radio): ${text}`);
  g.cues?.net(gd, text, cls);
  st.said.push({ t: +g.time.toFixed(2), who: gd.callsign, kind, text, at: [+gd.char.pos[0].toFixed(2), +gd.char.pos[2].toFixed(2)] }); if (st.said.length > 200) st.said.splice(0, 50);
  st.stats.lines++; note(g, F, gd, `net: ${text}`);
}
/** the strip takes one line of a class every few seconds and DROPS the rest (cues.ts `gaps`, whoever spoke last — the squads' and the dig-in's lines too): a
 *  line that would land inside that waits its turn here, and is said by the same man if he is still fit to say it. `then` = what the line makes true for the
 *  HUD (the room it names): it happens when the line is said, never for a line that was not */
const fill = (tpl: string, vars: Record<string, string>) => tpl.replace(/\{(\w+)\}/g, (_m, k: string) => vars[k] ?? '');
function net(g: Game, F: RoomFight, st: State, gd: Guard, kind: LineKind, vars: Record<string, string> = {}, then?: () => void, redo?: Later['redo']) {
  const L = LINES[kind], i = st.rot.get(kind) ?? Math.floor(roll(st.die) * L.say.length) % L.say.length; st.rot.set(kind, (i + 1) % L.say.length);
  const tpl = (WORDS.on && L.now || L.say)[i], text = fill(tpl, vars);
  const at = Math.max(g.time + (g.cues?.netWait(L.cls) ?? 0), st.clsAt[L.cls] ?? 0); st.clsAt[L.cls] = at + (CUES.gaps[L.cls] ?? 0) + 0.1;
  if (at > g.time) st.later.push({ at, t0: g.time, gd, kind, text, cls: L.cls, then, tpl, redo }); else { voice(g, F, st, gd, kind, text, L.cls); then?.(); }
}
/** a line that says WHERE ITS MAN STANDS (`places`): the place is asked again as the line is said — one that waited its turn on the strip says where he is
 *  then, not where he was when it was queued. Off: `net`, the place as it was when the line was made */
function netAt(g: Game, F: RoomFight, st: State, D: Def, kind: LineKind, f: (w: ReturnType<typeof spoken>) => { vars: Record<string, string>; then?: () => void }) {
  const a = f(spoken(g, D.gd.char.pos));
  net(g, F, st, D.gd, kind, a.vars, a.then, LASTSTAND.places ? () => f(spoken(g, D.gd.char.pos)) : undefined);
}
function tickLater(g: Game, F: RoomFight, st: State) {
  if (!st.later.length) return;
  st.later = st.later.filter(l => {
    if (g.time < l.at) return true;
    if (!fitGd(g, l.gd)) return false;
    const w = g.cues?.netWait(l.cls) ?? 0; if (w > 0 && g.time - l.t0 < 8) { l.at = g.time + w; return true; }   // (somebody else's line took the slot: after it — but not for ever)
    if (l.redo) { const a = l.redo(); l.text = fill(l.tpl, a.vars); l.then = a.then; }
    voice(g, F, st, l.gd, l.kind, l.text, l.cls); l.then?.(); return false;
  });
}
const name = (st: State, D: Def, id: string | null) => { if (id) st.named.set(D, id); else st.named.delete(D); st.spots.delete(D); st.at.delete(D); st.hint = null; };
/** … named by what he SAID (`spoken`): the room, or the place that is no room; and what he said is kept, to be said again when it stops being true */
function nameAt(g: Game, st: State, D: Def, w: ReturnType<typeof spoken> | null) {
  name(st, D, w?.id ?? null); if (!w || !LASTSTAND.places || !(w.id || w.spot)) return;
  if (w.spot) st.spots.set(D, w.spot);
  st.at.set(D, { key: w.id ?? w.spot!.name, the: w.the, offT: NaN, stillAt: v3.copy(D.gd.char.pos), stillT: g.time, saidT: g.time });
}
/** `places`: A MAN WHO IS NO LONGER WHERE HE SAID says where he is now — once he has been out of it `movedSecs`, stands still (a man on a post) and is fit and
 *  calm; one who has gone after the team says he is out of it, and is no place to go to any more. Never a man of a stand (its own lines say where he goes) */
function tickMoved(g: Game, F: RoomFight, st: State) {
  const K = LASTSTAND, S = st.stand;
  for (const [D, M] of [...st.at]) {
    if (!alive(D)) { st.at.delete(D); continue; }
    const p = D.gd.char.pos; if (flat(p, M.stillAt) > 0.4) { M.stillAt = v3.copy(p); M.stillT = g.time; }
    if (S && member(S, D)) continue;
    const w = spoken(g, p), free = D.mode === 'free';
    if ((w.id ?? w.spot?.name) === M.key) { M.offT = NaN; continue; }   // (still where he said — a man gone after the team too: the line stays true until he is out of it)
    if (Number.isNaN(M.offT)) M.offT = g.time;
    if (g.time - M.offT < K.movedSecs || g.time - M.saidT < K.movedGap || !calm(g, D) || st.check?.caller === D || st.check?.due.some(d => d.D === D && d.at >= 0)) continue;   // (about to answer a check: that answer says it)
    if (!free && g.time - M.stillT < K.stillSecs) continue;
    if (st.later.some(l => l.gd === D.gd && (l.kind === 'movedAt' || l.kind === 'movedFree'))) continue;   // (his last 'moved' is still waiting its turn on the strip)
    M.saidT = g.time;
    if (free) net(g, F, st, D.gd, 'movedFree', { the: M.the }, () => { st.stats.moved++; name(st, D, null); });
    else netAt(g, F, st, D, 'movedAt', w => ({ vars: { at: w.at, the: w.the }, then: () => { st.stats.moved++; nameAt(g, st, D, w); } }));
  }
}

/** where the team is, as far as the survivors know: where each living defender last had one of it in his sight or last heard a loud thing, these
 *  `knownSecs` — and the latest of those whatever its age (`last`), else where a man of theirs lies nearest `near` (the team was there). Never the team's
 *  true positions */
function teamKnown(g: Game, F: RoomFight, near: Vec3): { pts: Vec3[]; last: Vec3 } {
  const pts: Vec3[] = []; let last: Vec3 | null = null, lt = -Infinity;
  for (const D of F.defs) {
    const gd = D.gd; if (!alive(D)) continue;
    if (gd.lastKnown && gd.lastKnown !== D.pt && gd.lastSeenT > -50) { if (g.time - gd.lastSeenT < LASTSTAND.knownSecs) pts.push(gd.lastKnown); if (gd.lastSeenT > lt) { lt = gd.lastSeenT; last = gd.lastKnown; } }
    if (D.noiseAt) { if (g.time - D.noiseT < LASTSTAND.knownSecs) pts.push(D.noiseAt); if (D.noiseT > lt) { lt = D.noiseT; last = D.noiseAt; } }
  }
  if (!last) { let bd = Infinity; for (const D of F.defs) if (!alive(D)) { const d = flat(D.gd.char.pos, near); if (d < bd) { bd = d; last = D.gd.char.pos; } } }
  return { pts, last: v3.copy(last ?? near) };
}
/** a free spot of a room a couple of strides from its anchor (a man already in it, or its middle), off its doorways and off the spots already given out */
function spotIn(g: Game, F: RoomFight, R: Room, p0: Vec3, taken: Vec3[]): Vec3 {
  const nav = g.col.nav;
  for (const r of [1.8, 2.6, 1.2, 3.4]) for (let a = 0; a < 8; a++) {
    const p: Vec3 = [p0[0] + Math.cos(a * Math.PI / 4) * r, 0, p0[2] + Math.sin(a * Math.PI / 4) * r];
    if (nav.isBlocked(p[0], p[2]) || !R.cells.has(cellOf(g, p))) continue;
    if (R.entries.some(e => flat(e.at, p) < 1.5)) continue;
    if (F.defs.some(X => alive(X) && flat(X.gd.char.pos, p) < 0.9) || taken.some(q => flat(q, p) < 0.9)) continue;
    if (g.col.segmentBlocked([p0[0], 1.2, p0[2]], [p[0], 1.2, p[2]])) continue;
    return p;
  }
  return [p0[0], 0, p0[2]];
}
/** his way to `spot`: its length, or null — none, too long, or past where the team is known to be */
function wayTo(g: Game, D: Def, spot: Vec3, known: Vec3[]): number | null {
  const path = g.col.nav.findPath(D.gd.char.pos, spot); if (!path?.length || flat(path[path.length - 1], spot) > 0.8) return null;
  let L = 0, q: Vec3 = D.gd.char.pos, bad = false; const m = LASTSTAND.clearM;
  for (const w of path) {
    const d = flat(q, w), n = Math.max(1, Math.ceil(d / 0.5));
    if (m > 0) for (let i = 1; i <= n && !bad; i++) { const p: Vec3 = [q[0] + (w[0] - q[0]) * i / n, 0, q[2] + (w[2] - q[2]) * i / n]; if (known.some(f => flat(f, p) < m)) bad = true; }
    L += d; q = w;
  }
  return bad || L > LASTSTAND.maxM ? null : L;
}
/** may this man walk to that spot: free, a squad that stays in its rooms keeps to them, and there is a way */
function canCome(g: Game, X: Def, spot: Vec3, known: Vec3[]): number | null {
  if (!movable(g, X)) return null;
  if (squadStaysIn(g, X.gd) && !squadHolds(g, X.gd, spot)) return null;
  return wayTo(g, X, spot, known);
}
/** a room the stand could be made in, as one of the men holding it stands: his own, a real room of the structure with doors, never entered, the team not known in it */
function standRoom(g: Game, D: Def, known: Vec3[]): { room: Room; id: string } | null {
  if (D.mode !== 'hold' || !D.room || !D.room.entries.length || !inRoom(g, D.room, D.gd.char.pos)) return null;
  const id = where(g, D.gd.char.pos).id; if (!id) return null;
  if (digInEntered(g, D.room) || known.some(p => inRoom(g, D.room, p))) return null;
  return { room: D.room, id };
}
/** … or the post one of them was staged on, standing empty: the room he knows (never one their net cannot vouch for — the posts of the men who no longer answer) */
function homeRoom(g: Game, F: RoomFight, D: Def, known: Vec3[]): { room: Room; id: string; anchor: Vec3 } | null {
  const id = STATES.get(g)?.post.get(D.gd), def = id ? g.roomClear.rooms.find(r => r.def.id === id)?.def : null; if (!def) return null;   // (as staged — roomclear.ts `rehome` moves him on the list)
  const c: Vec3 = [(def.bounds.x0 + def.bounds.x1) / 2, 0, (def.bounds.z0 + def.bounds.z1) / 2], anchor = (F as unknown as { freeNear(p: Vec3): Vec3 | null }).freeNear(c) ?? c;
  const room = F.roomAt(anchor) as Room | null; if (!room || !room.entries.length || where(g, anchor).id !== def.id) return null;
  if (digInEntered(g, room) || known.some(p => inRoom(g, room, p))) return null;
  return { room, id: def.id, anchor };
}
const theOf = (g: Game, id: string) => { const n = g.roomClear.rooms.find(r => r.def.id === id)?.def.name ?? id; return /^the |\d$/.test(n) ? n : `the ${n}`; };
interface Plan { room: Room; id: string; anchor: Vec3; inside: Def[]; come: { D: Def; spot: Vec3; L: number }[] }
/** WHICH ROOM (the rule at the head): the one most of the answering men are in or can reach; then the most doors already wedged, the most men already there,
 *  the farthest from the team, the least walking. `min` = how many it must gather to be worth an order */
function choose(g: Game, F: RoomFight, men: Def[], known: Vec3[], min = 2): Plan | null {
  const cands = new Map<Room, { id: string; anchor: Vec3; inside: Def[] }>();
  for (const D of men) { const r = standRoom(g, D, known); if (!r) continue; const c = cands.get(r.room); if (c) c.inside.push(D); else cands.set(r.room, { id: r.id, anchor: D.gd.char.pos, inside: [D] }); }
  for (const D of men) { const r = homeRoom(g, F, D, known); if (r && !cands.has(r.room)) cands.set(r.room, { id: r.id, anchor: r.anchor, inside: [] }); }
  let best: Plan | null = null, bs: number[] = [];
  for (const [room, c] of cands) {
    const come: Plan['come'] = [], taken: Vec3[] = []; let walk = 0;
    for (const X of men) {
      if (c.inside.includes(X)) continue;
      const spot = spotIn(g, F, room, c.anchor, taken), L = canCome(g, X, spot, known); if (L === null) continue;
      come.push({ D: X, spot, L }); taken.push(spot); walk += L;
    }
    const far = known.length ? Math.min(...known.map(p => flat(p, c.anchor))) : 0;
    const s = [c.inside.length + come.length, digInWedged(g, room).length, c.inside.length, Math.round(far), -walk];
    let better = !best; for (let i = 0; i < s.length && best; i++) { if (s[i] !== bs[i]) { better = s[i] > bs[i]; break; } }
    if (better) { best = { room, id: c.id, anchor: c.anchor, inside: c.inside, come }; bs = s; }
  }
  return best && bs[0] >= min ? best : null;
}

// ---------------------------------------------------------------- the radio check
function startCheck(g: Game, F: RoomFight, st: State) {
  const K = LASTSTAND, S = st.stand, men = F.defs.filter(alive);
  const can = men.filter(D => calm(g, D));
  const caller = (S ? can.find(D => S.in.has(D)) : null) ?? can.find(D => D.mode === 'hold') ?? can[0];
  if (!caller) { st.nextAt = g.time + 1; return; }   // (every one of them has the team in his face: nobody asks)
  const first = st.stats.checks === 0, lone = st.loneSaid && st.known.size <= 1;
  st.stats.checks++;
  if (S?.room && S.in.has(caller) && S.in.size + S.movers.length > 1) net(g, F, st, caller.gd, 'checkStand', { the: S.the });
  else if (lone) netAt(g, F, st, caller, 'checkLoneAt', w => ({ vars: { at: w.at }, then: () => nameAt(g, st, caller, caller.mode === 'free' ? null : w) }));
  else net(g, F, st, caller.gd, first ? 'check1' : 'checkN');
  let at = g.time + pick(st, K.answer); const due: Check['due'] = [];
  for (const D of men) { if (D === caller || (S?.room && S.in.has(D) && S.in.has(caller))) continue; due.push({ D, at }); at += pick(st, K.between); }   // (the men in the room with him do not answer over the radio: he can count them)
  st.check = { caller, t: g.time, closeAt: (due.length ? due[due.length - 1].at : g.time + 1.2) + pick(st, K.listen), due, got: [] };
  note(g, F, caller.gd, `asks the net who is up (check ${st.stats.checks}, ${men.length} up)`);
}
function tickCheck(g: Game, F: RoomFight, st: State, C: Check) {
  const K = LASTSTAND;
  if (!alive(C.caller)) { st.check = null; st.nextAt = g.time + 4; note(g, F, C.caller.gd, 'down mid-check'); return; }
  for (const d of C.due) {
    if (g.time < d.at || d.at < 0) continue;
    d.at = -1; const D = d.D; if (!calm(g, D)) continue;   // (in a fight, down, dazzled: no answer — and nobody counts him)
    const free = D.mode === 'free';
    netAt(g, F, st, D, free ? 'ansFreeAt' : 'ansAt', w => ({ vars: { at: w.at, the: w.the }, then: () => nameAt(g, st, D, free ? null : w) }));   // (a man out hunting is not a room to go to)
    C.got.push(D); st.stats.answers++;
  }
  if (g.time < C.closeAt) return;
  st.check = null; st.nextAt = g.time + (st.stand?.setSaid ? K.again : K.every);
  const S = st.stand, with_ = S?.room && S.in.has(C.caller) ? [...S.in].filter(alive) : [];
  const heard = [C.caller, ...C.got].filter(alive);   // (a man who answered and has gone down since is not counted)
  st.known = new Set([...heard, ...with_]);
  st.stats.silent += F.defs.filter(alive).length - st.known.size;
  if (NETQUIET.on) netQuietClosed(g, C.caller.gd, F.defs.filter(D => !st.known.has(D)).map(D => D.gd), heard.map(D => D.gd));   // (netquiet.ts, off = nothing asked: the men who did not answer the check — the dead among them, each counted once — shake the one who asked and the men who did answer)
  for (const D of [...st.named.keys(), ...st.spots.keys()]) if (!st.known.has(D) && !(S && (S.in.has(D) || S.out.has(D) || S.movers.some(m => m.D === D)))) name(st, D, null);   // (a room nobody speaks for any more is no longer what the net says)
  note(g, F, C.caller.gd, `check closes: ${st.known.size} known up (${[...st.known].map(D => D.gd.callsign).join(', ')})`);
  if (!calm(g, C.caller)) { st.nextAt = Math.min(st.nextAt, g.time + 5); return; }   // (the one who asked has the team in his face now: asked again shortly)
  if (K.regroup) decide(g, F, st, C.caller, heard);
  else tellOnly(g, F, st, C.caller);
}
/** nobody answers him: true the first time (counted once a man, said once) */
const lone = (st: State) => { if (st.loneSaid) return false; st.loneSaid = true; st.stats.lastMan++; return true; };
/** call out only: the one who asked says what the count is, and where he is */
function tellOnly(g: Game, F: RoomFight, st: State, C: Def) {
  const n = st.known.size, free = C.mode === 'free';
  const line = (w: ReturnType<typeof spoken>) => ({ vars: { n: String(n), at: w.at }, then: () => nameAt(g, st, C, free ? null : w) });
  if (n <= 1) { if (lone(st)) netAt(g, F, st, C, 'lastAt', line); return; }
  st.loneSaid = false;
  if (n !== st.fewN) { st.fewN = n; netAt(g, F, st, C, 'fewAt', line); }
}

// ---------------------------------------------------------------- the stand
const newStand = (g: Game, room: Room | null, id: string | null, the: string, anchor: Vec3): Stand => ({ room, id, the, anchor: v3.copy(anchor), t: g.time, in: new Set(), out: new Set(), movers: [], setSaid: false, setT: NaN, thumpAt: NaN, lookT: g.time, orders: new Map(), homed: new Set() });
/** where a man coming in is put beside: a man of theirs in the room, else the spot the room was picked by */
const anchorOf = (S: Stand): Vec3 => [...S.in].find(alive)?.gd.char.pos ?? S.anchor;
const member = (S: Stand, D: Def) => S.in.has(D) || S.out.has(D) || S.movers.some(m => m.D === D);
/** told to hold where he is: he says so (once), with where */
function holdsOwn(g: Game, F: RoomFight, st: State, S: Stand, D: Def, say: LineKind | null) {
  S.out.add(D); const w = spoken(g, D.gd.char.pos);
  if (say && calm(g, D) && !st.told.has(D)) { st.told.add(D); net(g, F, st, D.gd, say, { at: w.at, the: w.the }, () => nameAt(g, st, D, w)); }
}
/** the close of a check with `regroup` on: the first makes the stand; a later one takes in whoever has answered since, or can come now */
function decide(g: Game, F: RoomFight, st: State, C: Def, heard: Def[]) {
  const K = LASTSTAND, n = st.known.size, w = spoken(g, C.gd.char.pos), known = teamKnown(g, F, C.gd.char.pos).pts;   // (`w`: words and the HUD's name only — which room the stand is made in is standRoom's and choose's, by the structure)
  let S = st.stand;
  if (n > 1) st.loneSaid = false;
  else if (S && member(S, C)) {   // he made the stand with others and nobody answers any more: he is the last, he says so, and he holds what he holds
    if (lone(st)) { net(g, F, st, C.gd, 'lastAt', { at: w.at }); note(g, F, C.gd, `the last man of the stand, ${w.at}`); }
    return;
  } else if (S) {   // he was never one of the stand: with its men down the last man makes his own, below — with them up and busy he can only say he hears nobody
    if ([...S.in, ...S.out, ...S.movers.map(m => m.D)].some(alive)) { if (lone(st)) net(g, F, st, C.gd, 'lastAt', { at: w.at }, () => nameAt(g, st, C, C.mode === 'free' ? null : w)); return; }
    S = st.stand = null;
  }
  const send = (S: Stand, D: Def, spot: Vec3, at: number, quiet = false) => { S.out.delete(D); S.movers.push({ D, phase: 'beat', goAt: at, spot, tries: 0, stepT: g.time, t0: g.time, quiet }); name(st, D, S.id); st.stats.sent++; if (quiet) st.stats.quiet++; };
  if (!S || !S.room) {
    const men = heard.filter(D => calm(g, D) && D.mode === 'hold');   // (a man out hunting is nobody's to order)
    if (C.mode !== 'hold' || !men.length || (n > 1 && men.length < 2)) { tellOnly(g, F, st, C); return; }   // (… and gives no orders, nor does one man order hunters to their doors: he says the count; asked again at the next check)
    if (n <= 1) {   // nobody answered: the last man digs in where he stands
      const r = standRoom(g, C, known), P = r ? null : choose(g, F, [C], known, 1);   // (not in a room of the structure: the post he was staged on, if he can get back to it)
      S = st.stand = newStand(g, r?.room ?? P?.room ?? null, r?.id ?? P?.id ?? null, P ? theOf(g, P.id) : w.the, P?.anchor ?? C.gd.char.pos); st.stats.stands++; st.stats.standT = g.time;
      const first = lone(st);   // (he may have said it already, out hunting)
      if (P?.come.length) { net(g, F, st, C.gd, 'lastGo', { the: S.the }); send(S, C, P.come[0].spot, g.time + pick(st, K.go), true); note(g, F, C.gd, `the last man: back to ${S.the}`); }
      else { if (r) S.in.add(C); else S.out.add(C); if (first) net(g, F, st, C.gd, 'lastAt', { at: w.at }, () => nameAt(g, st, C, w)); else nameAt(g, st, C, w); note(g, F, C.gd, `the last man: digs in ${w.at}`); }
      return;
    }
    const P = choose(g, F, men, known);
    if (!P) {   // no room, or nobody can reach anybody: every man his own door (asked again at the next check)
      if (!S) {
        S = st.stand = newStand(g, null, null, '', C.gd.char.pos); st.stats.stands++; st.stats.standT = g.time;
        const shut = men.every(D => digInPhase(g, D.gd) !== 'idle');   // (every one of them already behind a door he has worked on: nobody is asked to leave it)
        const indoors = [C, ...men].every(D => !!D.room && inRoom(g, D.room, D.gd.char.pos));   // (a man holding outside has no door to block: the line does not tell him to)
        net(g, F, st, C.gd, !indoors ? 'orderOut' : shut ? 'orderShut' : 'orderStay', { n: String(n), at: w.at }); nameAt(g, st, C, w);
        note(g, F, C.gd, shut ? 'no way to each other, every man already dug in: they stay where they are' : 'no room they can gather in: every man digs in where he is');
      }
      for (const D of men) if (!member(S, D)) holdsOwn(g, F, st, S, D, null);
      return;
    }
    const the = theOf(g, P.id), was = S;
    S = st.stand = newStand(g, P.room, P.id, the, P.anchor); st.stats.gathered++; if (!was) { st.stats.stands++; st.stats.standT = g.time; }
    if (was) for (const D of was.out) S.out.add(D);
    const mine = P.inside.includes(C) || P.come.some(c => c.D === C);   // (the one who asked may be the one with no way: he sends the others together and says where he stays)
    net(g, F, st, C.gd, mine ? 'order' : 'orderFrom', { n: String(n), the, at: w.at });
    if (!mine) { st.told.add(C); S.out.add(C); nameAt(g, st, C, w); st.stats.noWay++; }
    note(g, F, C.gd, `orders the stand in ${the} (room ${P.room.id}): ${P.inside.length} there, ${P.come.length} to come, of ${men.length}`);
    for (const D of P.inside) { S.out.delete(D); S.in.add(D); name(st, D, P.id); S.homed.add(D); g.roomClear.rehome(D.gd, P.id); }
    let at = g.time; for (const c of P.come) { at += pick(st, K.go); send(S, c.D, c.spot, at); }
    for (const D of men) if (!member(S, D)) { st.stats.noWay++; holdsOwn(g, F, st, S, D, 'cant'); }
    return;
  }
  // a stand is made in a room: a man who answers now and is not in it comes if he can, or holds where he is
  if (digInEntered(g, S.room) || known.some(p => inRoom(g, S!.room, p))) return;   // (the team is known to be in it: nobody else is called there)
  for (const D of heard) {
    if (S.in.has(D) || S.movers.some(m => m.D === D) || !calm(g, D) || D.mode !== 'hold') continue;   // (out hunting, or on a leg of the room fight's own: not now)
    { const spot = spotIn(g, F, S.room, anchorOf(S), S.movers.map(m => m.spot)); if (canCome(g, D, spot, known) !== null) { send(S, D, spot, g.time + pick(st, K.go)); continue; } }
    if (!S.out.has(D)) { st.stats.noWay++; holdsOwn(g, F, st, S, D, 'cant'); }
  }
}
function tickMover(g: Game, F: RoomFight, st: State, S: Stand, m: Mover): boolean {
  const D = m.D, gd = D.gd, T = st.stats;
  if (!alive(D) || !F.defs.includes(D)) { T.diedOnWay++; note(g, F, gd, 'down on the way'); return true; }
  if (m.phase === 'beat') {
    if (g.time < m.goAt) return false;
    if (!S.room || !movable(g, D)) { T.dropped++; S.out.add(D); nameAt(g, st, D, spoken(g, gd.char.pos)); return true; }   // (his own trouble now, or nobody left to go to: he holds where he is)
    m.phase = 'run'; run(g, D, m.spot, null); m.stepT = g.time;
    if (!m.quiet) net(g, F, st, gd, 'go', { the: S.the }); note(g, F, gd, `sets off for ${S.the}`);
    return false;
  }
  if (D.mode === 'move') { m.stepT = boots(g, gd, m.stepT); return false; }
  if (D.mode === 'free') { T.met++; note(g, F, gd, 'met on the way: the fight has him'); name(st, D, null); return true; }   // (not the stand's man: he is picked up again when he next answers a check)
  // planted (roomfight.ts tickMove): there, in contact on the way, or stopped short
  const contact = g.time - gd.lastSeenT < 2;
  if (S.room && D.room === S.room && inRoom(g, S.room, gd.char.pos)) {
    S.in.add(D); T.arrived++; if (S.id) { S.homed.add(D); g.roomClear.rehome(gd, S.id); }   // (the stand room's man now, for the room clear's count: the room he left can clear)
    const n = [...S.in].filter(alive).length; if (!contact && n > 1) net(g, F, st, gd, 'in', { n: String(n), the: S.the });
    note(g, F, gd, `in ${S.the}, ${(g.time - m.t0).toFixed(1)} s after the order`);
    return true;
  }
  if (!contact && S.room && ++m.tries < LASTSTAND.legs && fit(g, D)) {
    const spot = spotIn(g, F, S.room, anchorOf(S), S.movers.filter(x => x !== m).map(x => x.spot));
    if (wayTo(g, D, spot, teamKnown(g, F, gd.char.pos).pts) !== null) { m.spot = spot; run(g, D, spot, null); return false; }
  }
  if (contact) { T.met++; note(g, F, gd, 'met on the way: fights where he is'); } else { T.short++; note(g, F, gd, 'stopped short: holds where he is'); }
  S.out.add(D); const w = spoken(g, gd.char.pos); nameAt(g, st, D, w);
  if (!contact && calm(g, D)) net(g, F, st, gd, 'short', { at: w.at });   // (the room is named either way: it is where the order's line left him)
  return true;
}
/** the door of his room they will likeliest come by — the shortest way round from where the survivors last knew the team, or where a man of theirs lies —
 *  as a point some strides back along that way: what the dig-in is handed as 'where they were heard' (it ranks the room's doors by the way from there). Never
 *  that old fix itself: the order is not a sighting, and a dead man by the door is not the team at it (digin.ts leaves the furniture alone with them that
 *  close; his own ears, after the order, still say so) */
function comeBy(g: Game, F: RoomFight, D: Def, R: Room): Vec3 {
  const nav = g.col.nav, free = (p: Vec3): Vec3 => (F as unknown as { freeNear(p: Vec3): Vec3 | null }).freeNear(p) ?? p, ref = free(teamKnown(g, F, D.gd.char.pos).last);
  const dear = (ix: number, iz: number) => R.cells.has(nav.idx(ix, iz)) ? 30 : 1;   // (round the room, not through it)
  let way: Vec3[] | null = null, wl = Infinity, e = R.entries[0];
  for (const x of R.entries) {
    const o = free([x.at[0] + x.out[0] * 1.2, 0, x.at[2] + x.out[1] * 1.2]), path = nav.findPath(o, ref, 6000, dear); if (!path) continue;
    let L = 0, q = o; for (const w of path) { L += flat(q, w); q = w; }
    if (L < wl) { wl = L; way = [o, ...path]; e = x; }
  }
  if (way) for (let i = 1, L = 0; i < way.length; i++) { L += flat(way[i - 1], way[i]); if (L >= 8 && flat(way[i], e.at) > 6.5) return v3.copy(way[i]); }
  return [e.at[0] + e.out[0] * 8, 0, e.at[2] + e.out[1] * 8];
}
function tickStand(g: Game, F: RoomFight, st: State, S: Stand) {
  const K = LASTSTAND, T = st.stats;
  for (const set of [S.in, S.out]) for (const D of set) if (!alive(D) || !F.defs.includes(D)) { set.delete(D); name(st, D, null); }
  if (S.movers.length) S.movers = S.movers.filter(m => !tickMover(g, F, st, S, m));
  if (g.time < S.lookT) return;
  S.lookT = g.time + 1;
  // every man of the stand who holds a room nobody has entered digs in (digin.ts: a door to wedge, a spot off its line) — asked again if something stopped him
  for (const D of [...S.in, ...S.out]) {
    if (D.mode !== 'hold' || !D.room || !calm(g, D)) continue;
    if (S.room && S.in.has(D) && D.room !== S.room) {   // planted outside the stand room (the room fight moved him — cover, a leg of somebody's): back in, or he holds where he is
      S.in.delete(D); const spot = spotIn(g, F, S.room, anchorOf(S), S.movers.map(m => m.spot));
      if (canCome(g, D, spot, teamKnown(g, F, D.gd.char.pos).pts) !== null) { T.sent++; T.quiet++; S.movers.push({ D, phase: 'beat', goAt: g.time, spot, tries: 0, stepT: g.time, t0: g.time, quiet: true }); }
      else { S.out.add(D); nameAt(g, st, D, spoken(g, D.gd.char.pos)); }
      continue;
    }
    const ph = digInPhase(g, D.gd);
    if (ph === 'set' && !S.homed.has(D)) { const id = where(g, D.gd.char.pos).id; if (id) { S.homed.add(D); g.roomClear.rehome(D.gd, id); } }   // (the room he is set in is the room he holds, for the room clear's count)
    if (S.room && S.movers.length && g.time - S.t < 25) continue;   // (nobody starts on a door the others are about to come in by: the furniture waits for them, a while)
    if ([...S.in, ...S.out].some(X => X !== D && X.room === D.room && !['idle', 'set'].includes(digInPhase(g, X.gd)))) continue;   // (one man at the doors at a time: three pairs of hands on one leaf never latch it)
    if (ph !== 'idle' || !D.room.entries.length || digInEntered(g, D.room) || (S.orders.get(D) ?? 0) >= 4) continue;   // (open floor has no door to wedge)
    if (digInOrder(g, D, comeBy(g, F, D, D.room), pick(st, K.dig))) { S.orders.set(D, (S.orders.get(D) ?? 0) + 1); T.digOrders++; note(g, F, D.gd, `told to dig in (room ${D.room.id})`); }
  }
  const here = S.room ? [...S.in].filter(D => D.room === S.room) : [...S.out];
  if (!S.setSaid) {
    const set = here.filter(D => digInPhase(g, D.gd) === 'set'), busy = S.movers.length > 0 || here.some(D => { const p = digInPhase(g, D.gd); return p !== 'set' && p !== 'idle'; });
    const who = set.find(D => calm(g, D));
    if (who && S.room && (!busy || g.time - S.t > 45)) {
      S.setSaid = true; S.setT = g.time; T.setT = g.time; T.setMen = here.length; S.thumpAt = g.time + pick(st, K.thump);
      const wedged = digInWedged(g, S.room).length;
      net(g, F, st, who.gd, here.length > 1 ? (wedged ? 'set' : 'setOpen') : wedged ? 'setLone' : 'setLoneOpen', { the: S.the }); note(g, F, who.gd, `the stand is set: ${here.length} in ${S.the}, ${wedged} door(s) wedged`);
      st.nextAt = Math.min(st.nextAt, g.time + K.again);
    }
    return;
  }
  // set: one of them shores the wedge up now and then — a thud at the door, heard like any shoved furniture
  if (S.room && g.time >= S.thumpAt) {
    S.thumpAt = g.time + pick(st, K.thump);
    if (digInEntered(g, S.room)) return;
    const doors = digInWedged(g, S.room), e = doors[Math.floor(roll(st.die) * doors.length)], who = e && here.find(D => calm(g, D) && D.mode === 'hold' && digInPhase(g, D.gd) === 'set');
    if (!e || !who) return;
    g.audio.play('propThud', e.at, 0.9, { rate: 0.8 });
    g.events.push({ kind: 'prop', pos: [e.at[0], 0, e.at[2]], time: g.time, loud: false, level: K.thumpLevel, who: who.gd.char.id });   // (blamed on him: his own side ignore it)
    T.thumps++; note(g, F, who.gd, `shores up ${e.door.def.name}`);
  }
}

// ---------------------------------------------------------------- the seams
const fresh = (g: Game): State => {
  const rc = g.roomClear, die = dieOf((Math.imul(rc.seed | 0, 0x9E3779B1) ^ Math.imul(rc.attempt | 0, 0x85EBCA6B) ^ 0x1A575A4D) | 0); for (let i = 0; i < 4; i++) roll(die);
  const key = `${rc.seed}:${rc.attempt}`, was = STATES.get(g); let post = was?.key === key ? was.post : null;   // (the same staging, the fight stopped and started: the lists have been moved on since)
  if (!post) { post = new Map<Guard, string>(); for (const r of rc.rooms) for (const gd of r.defenders) post.set(gd, r.def.id); }
  return { post, key, die, nextAt: 0, check: null, known: new Set(), named: new Map(), spots: new Map(), at: new Map(), stand: null, loneSaid: false, fewN: 0, told: new Set(), hint: null, said: [], stats: newStats(), stale: false, rot: new Map<LineKind, number>([['movedAt', 0], ['movedFree', 0]]), clsAt: [], later: [] };   // (`places`' own lines start on their first wording: they draw nothing from the die, so the checks fall on the same beats with it on and off)
};
/** `regroup` switched off with a stand made: every man lets go of what the stand told him to do, and the room fight has him as it had */
function dissolve(g: Game, st: State, S: Stand) { for (const D of [...S.in, ...S.out, ...S.movers.map(m => m.D)]) digInRelease(g, D.gd); st.stand = null; }
/** once a frame from RoomFight.tick, after the defenders', the press's and the buddy call's own ticks */
export function lastStandTick(g: Game, F: RoomFight) {
  const K = LASTSTAND; if (!K.regroup) { const S = STATES.get(g)?.stand; if (S) dissolve(g, STATES.get(g)!, S); if (!K.callOut) return; }   // (the switch flipped mid-stand)
  const rc = g.roomClear; if (!rc?.active || rc.end || g.rescue?.active) return;
  let st = STATES.get(g);
  if (!st || st.stale) {
    const all = g.nightBreach.hostiles, few = Math.min(K.few, Math.floor(all.length / 3));   // (three of eleven; two of the block's eight; the last man of five)
    let up = 0; for (const h of all) if (h.state !== 'dead' && !runnerFled(h)) up++;   // (runner.ts, false with its switch off: a man who dropped it and ran is not one of the few left)
    if (up > few || up === 0) return;
    st = fresh(g); STATES.set(g, st);
    st.stats.t0 = g.time; st.stats.up0 = up; st.nextAt = g.time + pick(st, K.first);
    note(g, F, null, `most are down: ${up} of ${all.length} up`);
  }
  if (!F.defs.some(alive)) return;
  for (const D of [...st.named.keys(), ...st.spots.keys()]) if (!alive(D)) name(st, D, null);   // (a room is the net's word only while the man who said it is up)
  tickLater(g, F, st);
  if (st.check) tickCheck(g, F, st, st.check); else if (g.time >= st.nextAt) startCheck(g, F, st);
  if (K.places && st.at.size) tickMoved(g, F, st);
  const S = st.stand;
  if (S) tickStand(g, F, st, S);
}
/** the fight is over (RoomFight.stop): everything forgotten but the counts and the lines, which stay for whoever reads them after the run */
export function lastStandStop(g: Game) { const st = STATES.get(g); if (!st) return; st.check = null; st.stand = null; st.known.clear(); st.named.clear(); st.spots.clear(); st.at.clear(); st.later.length = 0; st.hint = null; st.stale = true; }
/** this man is one of a last stand (in the room, on his way to it, or told to hold where he is): the dig-in runs for him on any level, wedges any door of his
 *  room and does not stand down; the squads do not send him, the press does not take him. False on its first line with `regroup` off */
export function lastStandMan(g: Game, gd: Guard): boolean {
  if (!LASTSTAND.regroup) return false;
  const S = STATES.get(g)?.stand; if (!S) return false;
  for (const D of S.in) if (D.gd === gd) return true;
  for (const D of S.out) if (D.gd === gd) return true;
  return S.movers.some(m => m.D.gd === gd);
}
/** roomfight.ts rally() and lost(): … and he does not walk off to a noise next door, or give his room up through a door (cover inside it he still takes) */
export function lastStandOwns(g: Game, D: Def): boolean { return lastStandMan(g, D.gd); }
/** roomclear.ts objective(): the rooms their net has named (STRUCTURE ids), the named places that are no room of it (`places`), and a key that changes when
 *  they do — null with both switches off or nothing said */
export function lastStandHint(g: Game): Hint | null {
  if (!LASTSTAND.regroup && !LASTSTAND.callOut) return null;
  const st = STATES.get(g); if (!st || st.stale) return null;
  if (!st.hint) {
    const rooms = new Set<string>(), spots: Spot[] = []; for (const [D, id] of st.named) if (alive(D)) rooms.add(id);
    for (const [D, s] of st.spots) if (alive(D) && !spots.some(x => x.name === s.name)) spots.push(s);
    st.hint = { key: [...rooms].sort().join(',') + (spots.length ? `|${spots.map(s => s.name).join(',')}` : ''), rooms, spots };
  }
  return st.hint.rooms.size || st.hint.spots.length ? st.hint : null;
}
export function lastStandStats(g: Game): Record<string, number> { const s = STATES.get(g)?.stats ?? newStats(); const r: Record<string, number> = {}; for (const [k, v] of Object.entries(s)) r[k] = Number.isFinite(v) ? +v.toFixed(2) : -1; return r; }
/** the endgame as it went, for the tallies and the probes: the counts, the lines their net said and where the stand is */
export function lastStandReport(g: Game): { on: string; stats: Record<string, number>; room: string | null; in: string[]; out: string[]; moving: string[]; known: string[]; named: string[]; said: LastStandSaid[] } {
  const st = STATES.get(g), S = st?.stand ?? null, cs = (a: Iterable<Def>) => [...a].map(D => D.gd.callsign);
  return { on: [LASTSTAND.regroup ? 'regroup' : '', LASTSTAND.callOut ? 'callOut' : ''].filter(Boolean).join('+') || 'off', stats: lastStandStats(g), room: S?.id ?? null,
    in: S ? cs(S.in) : [], out: S ? cs(S.out) : [], moving: S ? S.movers.map(m => m.D.gd.callsign) : [], known: st ? cs(st.known) : [], named: st ? [...new Set([...st.named.values(), ...[...st.spots.values()].map(x => x.name)])] : [], said: st ? st.said.slice() : [] };
}
export function lastStandSummary(g: Game): string {
  const st = STATES.get(g); if (!LASTSTAND.regroup && !LASTSTAND.callOut) return 'off'; if (!st || st.stale) return 'on — waiting for the last few';
  const S = st.stand, T = st.stats;
  return `${T.checks} check${T.checks === 1 ? '' : 's'} · ${st.known.size} known up` + (S ? ` · stand ${S.room ? `in ${S.the}` : 'each where he is'}: ${S.in.size} in, ${S.movers.length} coming, ${S.out.size} out${S.setSaid ? ' · set' : ''}` : '');
}
