// X IS WHERE THE PLAN IS LAID (PLANLAY.on; the maintainer, 10-13: 'X is the sweatier mode where you can micromanage them a bit' — and the Door Kickers 2
// focus list's item 7: 'The plan is laid in real time at the start mark, waits on F and survives Enter').
//
// The order menu's 'wait for my word' row used to be the squad of four's, on a door, for a door tool: the men walked to the door, stacked and waited for
// the word. With the switch on that row is under EVERY menu that has an order in it (a door, a spot on the floor, a teammate, nothing; the pair too), and
// a row picked with it on is LAID, not given:
//   · NOBODY MOVES. The order is written down (LaidOrder: the row, the men by callsign, the door by its place on the level's list or the spot) and the
//     menu goes away. A man has ONE laid order: laying him another replaces it, and an order given him at once (the menu with the row off, B) takes his
//     name off the plan — a laid order nobody is left on is gone;
//   · THE WORD'S KEY SENDS IT (doortools.ts blowKey, F), all of it, in the order it was laid — read in orders.ts input ahead of every other reader of that
//     key, and taken out of the frame. Each laid order is then GIVEN as the menu would give it (SquadOrders.give: the refusals asked afresh, a man says
//     why not), a door tool of the four's on the word as it always could be: they walk, stack and wait, and F again (or B on the door) is 'go' — two
//     doors laid are two stacks that go on one word. Where every laid door tool finds its men ALREADY on its door (stacked on it, holding it from
//     outside) there is nothing to walk to and the press is the word itself: they go — which is the row as it was, for men at a door. With the menu up
//     the key is still its 'wait for my word' row (or a row of that page that is on the key and can be given: 'go' with somebody waiting);
//   · LAYING IS FREE OF THE CLOCK: nothing is put in the order book until the plan is sent, so the par clock (par.ts: the first row of orders.log) has not
//     started and the squad's fight has not either;
//   · IT SURVIVES ENTER (`keep`): the first plan sent in a try is kept, and a fresh cast of the same men on the same level
//     (orders.ts sync: a restart) finds it laid again — to be sent as it is, or changed first;
//   · IT IS DRAWN ONLY IN THE ORDER MODE (floorplan.ts → ui/planfloor.ts): each man's way from his feet to the door or the spot, broken, and the key on
//     it; with the menu down a laid order is drawn as it is laid and fades like an order just given. The squad's HUD block has the key's line while a plan
//     waits. The menu opens with the row already ON while a plan is laid: the second order of a plan is one key shorter than the first.
//
// PER SEAT, for a second player: the plan is the squad's orders-to-be and lives with the order book (SquadOrders.lay); who lays and who sends is whoever's
// input the order book reads. STATE: LayState, plain data — `laySnapshot` / `layRestore` are its pair (savestate.ts files it with the switch on).
// Off (the module's default, the frozen stand): the row is where it was and means what it meant, nothing is ever laid, the key is the word's alone.
import type { Vec3 } from '../math/vec';
import type { Game, Guard } from './game';
import type { OrderDef, OrderTarget } from './orders';
import { sideOf } from './orders';   // (these five are called inside functions only: src/game is one import cycle)
import { DOORTOOLS } from './doortools';
import { wallAt, wallPt } from './wallcharge';
import { workNear } from './workthings';
import { activeScenario } from './scenarioRun';

export const PLANLAY = {
  /** the menu's 'wait for my word' row is under every menu, and an order picked with it on is laid: nobody moves until the word's key sends the plan */
  on: false,
  /** a restart of the encounter (Enter) puts the plan back as it stood when it was first sent */
  keep: true,
  /** the order menu opens with 'wait for my word' already on while a plan is laid */
  sticky: true,
};
export const PLANLAY_STATS = { laid: 0, replaced: 0, sent: 0, refused: 0, dropped: 0, relaid: 0, struck: 0 };

/** an order written down for the word: the row's id, the men's callsigns, and what it is on — a door by its place on the level's list (`door`), a spot
 *  (`at`; `found`: the spot is a wall's or a thing's to work, looked up again by `pick`), a teammate (`man`), or nothing */
export interface LaidOrder { id: string; who: string[]; kind: 'door' | 'floor' | 'none'; at: Vec3; door?: number; man?: string; found?: 'wall' | 'thing'; /** the point the wall or the thing is found again by: on the wall's face, on the thing's */ pick?: Vec3; /** game time it was laid */ t: number }
/** `kept`: the first plan sent in this try, for the next one (`keptFor`: the start it was laid from — `tryKey` as the try began: the scenario, the cast,
 *  the mark Sam was stood on) · `started`: a plan has been sent this try (one sent after it is not kept over it) · `sending`: the plan is being given now ·
 *  `restoredT`: a checkpoint put the plan back at that game time — the fresh cast it stands up in that same step leaves it be */
export interface LayState { laid: LaidOrder[]; kept: LaidOrder[] | null; keptFor: string; tryKey: string; started: boolean; sending: boolean; restoredT: number }
export interface LaySnap { laid: LaidOrder[]; kept: LaidOrder[] | null; keptFor: string; started: boolean }

const copy = (a: LaidOrder[]): LaidOrder[] => a.map(o => ({ ...o, who: [...o.who], at: [o.at[0], o.at[1], o.at[2]] as Vec3, ...(o.pick ? { pick: [o.pick[0], o.pick[1], o.pick[2]] as Vec3 } : {}) }));
/** the key that sends the plan: the word's own (one knob — the HUD's line, the floor's cap and the press all read it here) */
export function layKey(): string { return DOORTOOLS.blowKey; }
const WORD_ROWS = new Set(['go', 'thrWord']);

/** can that row be laid: an order (not a page, not a row that costs nobody his order, not the word itself) */
export function layable(d: OrderDef): boolean { return !d.opens && !d.free && !WORD_ROWS.has(d.id); }
/** is something laid and waiting on the key */
export function layPending(g: Game): boolean { return PLANLAY.on && g.orders.lay.laid.some(o => layMen(g, o).length > 0); }
/** once a frame while something is laid (orders.ts input): a man who is down is off the plan, and an order nobody is left on is gone — so 'something is
 *  laid' (the key, the row already on, the floor's marks) is never about dead men */
export function layPrune(g: Game): void {
  const L = g.orders.lay, S = g.orders.squad(); if (!L.laid.length || !S.length) return;
  const up = new Set(S.filter(m => m.state !== 'dead').map(m => m.callsign)); let n = 0;
  for (const o of L.laid) { const was = o.who.length; o.who = o.who.filter(c => up.has(c)); n += was - o.who.length; }
  if (n) { L.laid = L.laid.filter(o => o.who.length > 0); PLANLAY_STATS.dropped += n; }
}

/** the start a plan is kept for: the scenario that is up, the cast, the mark Sam stands on as the try begins (another way in is another start) */
const startKey = (g: Game) => { const p = g.player.char.pos; return `${activeScenario(g) ?? 'none'}|${g.orders.squad().map(m => m.callsign).join(',')}|${Math.round(p[0] * 2)},${Math.round(p[2] * 2)}`; };
/** the living men of the squad a laid order names */
export function layMen(g: Game, o: LaidOrder): Guard[] { const S = g.orders.squad(); return o.who.map(c => S.find(m => m.callsign === c && m.state !== 'dead')).filter((m): m is Guard => !!m); }
/** where a laid order is on the floor (null: nowhere — fall in, hold) */
export function layPoint(g: Game, o: LaidOrder): Vec3 | null {
  if (o.kind === 'door') { const d = g.doors.list[o.door ?? -1]; return d ? [d.frameCentre[0], 0, d.frameCentre[2]] : null; }
  return o.kind === 'floor' ? [o.at[0], 0, o.at[2]] : null;
}
/** a laid order's target as the menu would hand it to give() now (null: its door or its man is gone) */
function targetOf(g: Game, o: LaidOrder): OrderTarget | null {
  const S = g.orders, at: Vec3 = [o.at[0], 0, o.at[2]];
  if (o.kind === 'door') { const d = g.doors.list[o.door ?? -1]; return d ? { kind: 'door', at: [d.frameCentre[0], 0, d.frameCentre[2]], door: d, side: sideOf(d, g.player.char.pos) } : null; }
  if (o.kind === 'none') { if (!o.man) return { kind: 'none', at }; const m = S.squad().find(x => x.callsign === o.man && x.state !== 'dead'); return m ? { kind: 'none', at: [m.char.pos[0], 0, m.char.pos[2]], man: m } : null; }
  // (a wall's or a thing's own order: found again by the point ON it — never by the spot the man stands on, which is a stride off it and may have a man near)
  if (o.found === 'wall' && o.pick) { const W = wallAt(g, o.pick); return W ? { kind: 'floor', at, wall: W } : null; }
  if (o.found === 'thing' && o.pick) { const w = workNear(g, o.pick); return w && w.target.kind === 'floor' && w.target.thing ? w.target : null; }
  return { kind: 'floor', at };
}
/** those callsigns taken off every laid order (one with nobody left on it is gone) */
function strike(L: LayState, names: Set<string>): number {
  let n = 0;
  for (const o of L.laid) { const was = o.who.length; o.who = o.who.filter(c => !names.has(c)); if (o.who.length !== was) n++; }
  L.laid = L.laid.filter(o => o.who.length > 0); return n;
}

/** The menu's row `d`, picked with 'wait for my word' on: laid for `men` on `t`. Null = laid, else why not (said by a man, as a refused order is). */
export function layOrder(g: Game, d: OrderDef, t: OrderTarget, men: Guard[]): string | null {
  const S = g.orders, L = S.lay;
  if (t.kind === 'foe' || !d.targets.includes(t.kind)) return 'not here.';
  let asked = men.filter(m => m.state !== 'dead' && S.mine(m)); if (!asked.length) { g.msg('nobody to take that order'); return 'nobody to take it'; }
  if (d.only) { const o = d.only(S, asked, t); if (o.length) asked = o; }
  const tm = S.forMen(t, asked), cant: [Guard, string][] = [];
  // (as give() has it: a man who cannot do his part says so and is left exactly as he was — on the plan he was on)
  const all = d.can ? asked.filter(m => { const w = d.can!(S, m, tm); if (w !== true) cant.push([m, w]); return w === true; }) : asked;
  const no = all.length ? S.whyNot(d, tm, all) : cant[0][1];
  if (no) { g.say(all.length ? all[0] : cant[0][0], no); PLANLAY_STATS.refused++; return no; }
  for (const [m, w] of cant) g.say(m, w);
  asked = all;
  if (strike(L, new Set(asked.map(m => m.callsign)))) PLANLAY_STATS.replaced++;
  const o: LaidOrder = { id: d.id, who: asked.map(m => m.callsign), kind: t.kind, at: [t.at[0], 0, t.at[2]], t: g.time };
  if (t.kind === 'door') o.door = g.doors.list.indexOf(t.door);
  if (t.kind === 'none' && t.man) o.man = t.man.callsign;
  if (t.kind === 'floor' && t.thing) { o.found = 'thing'; o.pick = [t.thing.face[0], t.thing.face[1], t.thing.face[2]]; }
  else if (t.kind === 'floor' && t.wall && d.id !== 'move' && d.id !== 'cover' && d.id !== 'hold' && d.id !== 'fallIn') { o.found = 'wall'; o.pick = wallPt(t.wall, 0, 0); }   // (the floor's own rows on a spot under a wall are the spot's: no wall to find again)
  L.laid.push(o); PLANLAY_STATS.laid++;
  g.msg(`you: ${S.whoWords(asked)} — wait · ${(typeof d.label === 'string' ? d.label : d.label(tm)).replace(/ · (\d+ left|uses .+)$/, '')}`);
  return null;
}

/** The word's key with a plan laid: every laid order given, in the order laid. Returns how many were given. */
export function laySend(g: Game): number {
  const S = g.orders, L = S.lay; if (!L.laid.length) return 0;
  layPrune(g); if (!L.laid.length) return 0;
  if (!L.started && PLANLAY.keep) { L.kept = copy(L.laid); L.keptFor = L.tryKey; }
  const plan = L.laid; L.laid = []; L.sending = true; let n = 0;
  // the door tools of the plan that can wait on the word (the four's): given ON THE WORD — they walk, stack and wait, and the key again is 'go' — unless
  // every one of them finds its men already standing on its door (stacked on it, holding it from outside): then this press IS the word, and they go
  const items = plan.map(o => { const men = layMen(g, o), t = targetOf(g, o), d = S.defs.find(x => x.id === o.id) ?? null, tool = !!d?.onWord && S.big && !!t && t.kind === 'door'; return { o, men, t, d, tool }; });
  const there = (x: typeof items[number]) => { const W = x.t && x.t.kind === 'door' ? g.doorTools.waitsOn(x.men, x.t.door) : null; return !!W && W.set && x.men.every(m => W.men.includes(m)); };
  const tools = items.filter(x => x.tool && x.men.length > 0), wait = !tools.every(there);
  try {
    for (const { o, men, t, d, tool } of items) {
      if (!men.length || !t || !d) { PLANLAY_STATS.dropped++; continue; }
      const tail = S.log[S.log.length - 1], no = S.give(o.id, t, S.who, { men, onWord: tool && wait });
      if (no !== null) { PLANLAY_STATS.refused++; continue; }
      const row = S.log[S.log.length - 1]; if (row && row !== tail) row.laid = true;
      n++; PLANLAY_STATS.sent++;
    }
  } finally { L.sending = false; L.started = true; }
  return n;
}

/** an order was given at once (orders.ts give, once it is in the order book): its men are off the plan */
export function layGiven(g: Game, men: Guard[]): void {
  if (!PLANLAY.on) return; const L = g.orders.lay;
  if (!L.sending && L.laid.length && strike(L, new Set(men.map(m => m.callsign)))) PLANLAY_STATS.struck++;
}
/** a fresh cast (orders.ts sync: a staging, a restart): nothing is laid — but the plan kept from the last try of these men on this level, laid again */
export function layFresh(g: Game): void {
  const L = g.orders.lay; L.sending = false;
  if (L.restoredT >= 0 && g.time >= L.restoredT && g.time - L.restoredT < 0.1) return;   // (the cast a checkpoint's own restart stood up: the file's plan stands)
  L.restoredT = -1; L.started = false; L.laid = [];
  if (!PLANLAY.on || !PLANLAY.keep) { L.kept = null; L.keptFor = ''; return; }   // (switched off: nothing kept from before comes back when it is switched on)
  if (!g.orders.squad().length) return;   // (nobody on the floor yet: the cast is still to come)
  L.tryKey = startKey(g);
  if (!L.kept) return;
  if (L.keptFor !== L.tryKey) { L.kept = null; L.keptFor = ''; return; }
  L.laid = copy(L.kept).map(o => ({ ...o, t: g.time })); PLANLAY_STATS.relaid++;
}
/** the plan thrown away (the debugger; a tool) — the kept one with it */
export function layClear(g: Game): void { const L = g.orders.lay; L.laid = []; L.kept = null; L.keptFor = ''; L.started = false; L.sending = false; L.restoredT = -1; }

/** the HUD's line for the key while a plan waits (orders.ts hud) */
export function layNote(g: Game, key: string): { key: string; text: string }[] {
  if (!layPending(g)) return [];
  const S = g.orders, men = new Set<Guard>(); for (const o of S.lay.laid) for (const m of layMen(g, o)) men.add(m);
  return men.size ? [{ key, text: `go · ${S.whoWords([...men])} on the plan` }] : [];
}

export function laySnapshot(g: Game): LaySnap { const L = g.orders.lay; return { laid: copy(L.laid), kept: L.kept ? copy(L.kept) : null, keptFor: L.keptFor, started: L.started }; }
/** onto a fresh encounter (savestate.ts, after the restart it runs first, the file's clock already back). A file with no slice: nothing laid */
export function layRestore(g: Game, s: LaySnap | null | undefined): void {
  const L = g.orders.lay; L.sending = false; L.restoredT = g.time;
  if (!s) { L.laid = []; L.started = false; return; }
  L.laid = copy(s.laid ?? []); L.kept = s.kept ? copy(s.kept) : null; L.keptFor = s.keptFor ?? ''; L.started = !!s.started;
}
export function laySummary(g: Game): string {
  const L = g.orders.lay; if (!PLANLAY.on) return 'off';
  return `${L.laid.length ? L.laid.map(o => `${o.who.join('+')}: ${o.id}${o.kind === 'door' ? ` door ${g.doors.list[o.door ?? -1]?.def.name ?? '?'}` : o.kind === 'floor' ? ` ${o.at[0].toFixed(1)},${o.at[2].toFixed(1)}` : ''}`).join(' · ') : 'nothing laid'}${L.kept ? ` · kept ${L.kept.length}` : ''}`;
}
