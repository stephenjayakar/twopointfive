// THE PAIR — two person stealth as ONE thing: the switch over its three parts, and the rules that only exist once the three are in one build.
//
// The play note (10-08): "oh we also haven't tried anything with two person stealth yet, we should try this and polish". The three parts, each behind its own
// switch (each still works alone, and each alone is its own part's build):
//   pairorders.ts  PAIR.on     the quiet ORDERS for one partner (take him on your mark / now, watch him, hold in the dark; F is the mark)
//   sneak.ts       SNEAK.on    how he FOLLOWS while nobody has noticed (low with Sam, in Sam's steps, waits short of a lit stretch somebody is looking at)
//   spotted.ts     SPOTTED.on  what he does once a defender is SUSPICIOUS, and once the pair is CAUGHT
//
// THE SWITCH. `PAIRUP.on`, OFF by default: `?pair` for the visit (`?pair=0` off), PAIR=1 in the harness's environment, Tab ▸ Sandbox ▸ 'The pair (two person
// stealth)'. On, it turns the three parts on (pairUpApply, from the Game's constructor and from the panel's row) and switches these rules in — each with its
// own row, so one can be put back to see what it was doing:
//   oneEye   ONE judgement of 'seen'. The orders' stalk (the way round to a man's back) asks the SNEAK's eye, step for step: guards.ts's own eye test from every
//            defender to a man low on that floor, widened as the sneak widens it (a glance travels), lit by the sneak's bar or at his elbow — and it is
//            PRICED the sneak's way: what walking the watched steps would add to the most stirred watcher's awareness by the eye's own arithmetic, with the
//            sneak's margin, inside the sneak's budget. Off: the stalk's own rule (lit floor inside `coneM` 9 m of a defender looking that way, his near
//            field whatever the light). One model: the partner no longer walks a stretch on a take order that he would have waited short of following Sam,
//            nor refuses one he would have crossed.
//   hunted   the sneak does not stop the moment ANY defender is alert or searching (as it does alone: sneak.ts sneakLive) — the partner goes on sneaking
//            until the PAIR is caught (spotted.ts 'caught': an alert man with his eyes on one of them, or loud in their ears). Alone, the two parts left a
//            gap: a defender searching for a noise two rooms off, and the partner walked upright into the light exactly when the floor was looking hardest.
//            A hunting man's eye is priced as the eye prices it (twice as quick on the uptake).
//   rejoin   a partner sent on a take order from Sam's shoulder FALLS IN again when the man is down ('he's down. on you.') — and so sneaks again. Off: he
//            holds where the man fell, as the orders part alone has it. A job called off (no way, watched, blown) leaves him holding either way: where
//            next is Sam's call.
//   stay     where a mission's own flow peels a following teammate off to cover an opening on Sam's route (the hostage rescue: rescueflow.ts), it leaves the
//            ONE partner at Sam's shoulder while the squad is silent and has not been compromised. Off: the flow takes him as it takes any follower — gun
//            up on an opening, alone, a third of the quiet walk (played: he was following in 63 to 83 % of the calm seconds of a rescue, 100 % elsewhere).
//   word     the squad line says why a following partner is not at Sam's shoulder (the sneak's word: 'waiting on eyes', 'crossing', …).
//   hands    ONE takedown. spotted.ts has hands of its own (a roused man turned to him at arm's length is taken by hand): (1) a take ORDER blown with the
//            partner a pace or two from the man's back is finished by those hands — turned to him or not — instead of ending with a gun on a man who is
//            about to shout (pairorders.ts takeTick; then 'rejoin' as after any take); (2) a man with THOSE hands on him sees nobody until they are off,
//            as a man in the order's hands does (PAIR.grip; guards.ts asks pairGripped). Off: a blown job stands and covers, and spotted's hands shield nothing.
// AND ALWAYS, wherever two parts are on together (nothing to switch: these are who-wins rules, not behaviour of their own):
//   FEET     a following partner's feet are spotted.ts's while it gives him a spot (freeze / slip / step: a defender is suspicious of them, or has them),
//            else the sneak's step along Sam's trail, else the order's own place; he is low if any of the three says low (orders.ts, the order() call).
//   ONE VOICE  while spotted.ts has him (a suspicious man about, or caught) the sneak says nothing over the net: spotted's line is the cue.
//   CAUGHT ENDS A TAKE JOB  a take order whose hands are not yet on the man is off the frame spotted.ts says the pair is caught — the same exit as the man
//            himself noticing — and he stands with his gun on the man who has them; none is GIVEN while they are caught ("they're onto us. no hands.").
//            Not on the last paces once sent (inside the ring, on his way, nothing between): there he finishes it, and until the man is down his gun and
//            his chest are nobody else's (pairorders.ts finishing: spotted's gun watch and the room fight's targets both stand off).
//
// NEVER a buff: nothing here changes a defender, a meter, a weapon or what a man can take. It is all about where the partner chooses to put his feet and when.
//
// (src/game is one import cycle: nothing below is built from another game module's exports at module load — the three tables are only touched inside
//  pairUpApply, which the Game's constructor calls.)
import { PAIR } from './pairorders';
import { saveTeamFeel } from './teamfeel';
import { SNEAK, saveSneak } from './sneak';
import { SPOTTED, saveSpotted } from './spotted';

export const PAIRUP = {
  /** THE switch: the three parts on, and the rules below */
  on: false,
  oneEye: true,
  hunted: true,
  rejoin: true,
  stay: true,
  word: true,
  hands: true,
};
export type PairUpRule = 'oneEye' | 'hunted' | 'rejoin' | 'stay' | 'word' | 'hands';
export const PAIRUP_DEFAULTS = { ...PAIRUP };
export const PAIRUP_STATS = { eyeAsks: 0, waysKept: 0, rejoins: 0, caughtOff: 0, stays: 0, handoffs: 0, finishes: 0 };
/** what a part's own store holds for its `on` (its own row's word, which a save made under the switch must not rewrite) */
export function keptOn(ls: string): boolean | undefined { try { const o = JSON.parse(globalThis.localStorage?.getItem(ls) ?? 'null'); return typeof o?.on === 'boolean' ? o.on : undefined; } catch { return undefined; } }
/** a rule is in force: the switch, and its own row */
export function pairUp(k: PairUpRule): boolean { return PAIRUP.on && PAIRUP[k]; }

const LS = 'twopointsix.pair';
/** a run that holds the switch on for its own length (quiet.ts: a quiet mission with a partner): `row` is the switch's own word while it is held, and that is
 *  what a save made meanwhile keeps — the run's hold is never written to the store. null = nobody holds it */
export const PAIR_HELD: { row: boolean | null } = { row: null };
const RULES = ['oneEye', 'hunted', 'rejoin', 'stay', 'word', 'hands'] as const, KEPT = ['on', ...RULES] as const;
export function savePairUp() { try { const o: Record<string, boolean> = {}; for (const k of KEPT) { const v = k === 'on' && PAIR_HELD.row !== null ? PAIR_HELD.row : PAIRUP[k]; if (v !== PAIRUP_DEFAULTS[k]) o[k] = v; } if (Object.keys(o).length) globalThis.localStorage?.setItem(LS, JSON.stringify(o)); else globalThis.localStorage?.removeItem(LS); } catch { /* no store */ } }
try { const o = JSON.parse(globalThis.localStorage?.getItem(LS) ?? 'null'); if (o) for (const k of KEPT) if (typeof o[k] === 'boolean') PAIRUP[k] = o[k]; } catch { /* no store, or not ours */ }
try { const q = new URLSearchParams(location.search); if (q.has('pair')) PAIRUP.on = q.get('pair') !== '0'; } catch { /* no page (the harness) */ }
try { const e = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.PAIR; if (e) { PAIRUP.on = e !== '0' && e.toLowerCase() !== 'off';
  for (const w of e.toLowerCase().split(/[\s,+]+/)) { const m = w.match(/^(no)?([a-z]+)$/); const k = m && KEPT.find(x => x.toLowerCase() === m[2]); if (k && k !== 'on') PAIRUP[k] = !m![1]; } } } catch { /* no process (the page) */ }   // (PAIR=1 · PAIR=nooneeye,nohunted: the switch on with those rules put back)

/** The switch reaches the three parts: on → all three on (their own rows can still put one back afterwards); `off` (the panel's row turned off) → all three
 *  off. With the switch off and no `off`, nothing is touched: each part is as its own flag, stored row or environment has it. Called by the Game's
 *  constructor (after the stored team feel is read back, before the pair's order rows are seated) and by the panel's row. */
export function pairUpApply(off = false) {
  if (PAIRUP.on) { if (!putBack('pairorders')) PAIR.on = true; if (!putBack('sneak')) SNEAK.on = true; if (!putBack('spotted')) SPOTTED.on = true; }
  else if (off) { PAIR.on = SNEAK.on = SPOTTED.on = false; saveTeamFeel('PAIR.on'); saveSneak(); saveSpotted(); }   // (… and out of the three parts' own stores: the row turned off is 'all three off', on the next visit too)
}
/** this visit's own word against one part (`?sneak=0`, SNEAK=off / =0 in the harness) stands under the switch: it is how one part is put back for an A/B */
function putBack(name: string): boolean {
  try { const q = new URLSearchParams(location.search); if (q.get(name) === '0' || q.has('no' + name)) return true; } catch { /* no page */ }
  try { const e = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name.toUpperCase()]?.toLowerCase(); if (e === '0' || e === 'off') return true; } catch { /* no process */ }
  return false;
}
export function pairUpSummary(): string {
  if (!PAIRUP.on) return PAIR.on || SNEAK.on || SPOTTED.on ? `off · parts on by their own switches: ${[PAIR.on && 'orders', SNEAK.on && 'sneak', SPOTTED.on && 'spotted'].filter(Boolean).join(', ')}` : 'off';
  const parts = [PAIR.on && 'orders', SNEAK.on && 'sneak', SPOTTED.on && 'spotted'].filter(Boolean).join(' + ');
  return `on · ${parts || 'every part put back off'} · rules ${RULES.filter(k => PAIRUP[k]).join(', ') || 'none'} · rejoins ${PAIRUP_STATS.rejoins} · jobs ended by caught ${PAIRUP_STATS.caughtOff} · finished by hand ${PAIRUP_STATS.finishes}`;
}
