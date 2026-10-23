// SAM WATCHES THE MAN WHO MATTERS, AND GIVES A MAN ROOM AS HE PASSES HIM (the maintainer, 10-23: "another thing CT did really well is having sam look at
// enemies! curious how that might fit with our control scheme" · "i'm also curious if we can make the experience of 'slithering' through guards also feel
// just as amazing as approaching them for a grab").
//
// HOW IT FITS THE CONTROLS: the cursor is still where he aims and which way his body faces; nothing here moves either, and no key is added. It is his HEAD
// that goes to a man — and the man it goes to is picked by the game, so the head is something to READ: who is nearest, and above all who is beginning to
// notice him (that man is looked at before a nearer one who is not). With a gun up and aimed the head is the gun's, as it was.
//
//   SAMLOOK.on    THE LOOK. Each frame one man is his (`samLookMan`): the man a held click is creeping up on (stalk.ts), else — of the men the fog shows, inside
//                 `nearM`, no more than `backDeg`° round from the way he aims (the cursor's side, which his chest turns to), with nothing solid between the two heads — the one with the lowest
//                 score: his distance, less `noticeM` for a man who is onto him or has him in view with his notice risen (so a watcher a few metres further
//                 off wins), less `swapM` for the man he is already watching (two men at the same distance do not trade him back and forth), and the man
//                 already his is kept out to `keepDeg`°. Nobody while he is down, sprinting, has a man in his arm or in a takedown, kicks, picks, works a
//                 wand or a keypad, has his back on a wall, a body in tow or a hand on a door or a breaker, or has a gun in the aim. The head's strength is whole inside `fullM` and nothing at `nearM`.
//   SAMLOOK.slip  THE SLIP. Crouched, hands empty, off a wall: the nearest such man who is not onto him, at any bearing, inside `slipFrom` m — he tips away
//                 from him, sinks, and the arm on that side goes out low toward him (character.ts WATCH), whole by `slipBy` m — over whatever the close-in's
//                 carriage has him in (close.ts). Behind a man's back it lets go (`backCos`: the cosine of Sam's bearing off the man's nose where it is
//                 gone, and where it is whole): there the creep's own body has him (stalk.ts). The slip is the pass, the creep the back going by.
// Both are LOOKS, and no rule reads either back; his head and chest joints move with them by a few centimetres, and those are what the eyes that look for
// him read (character.ts bones), so a run with them on is not the same run to the digit. Both are off here and on the frozen stand (TPS_SAMLOOK=1,
// TPS_SAMSLIP=1); the page turns them on (?samlook=0, ?slip=0). The pick is exported for a camera that wants the same man.
import type { Game, Guard } from './game';
import type { Vec3 } from '../math/vec';
import { SideMap } from '../math/side';
import { closeSubject } from './close';
import { STALK, stalkOn } from './stalk';

export const SAMLOOK = {
  on: false, nearM: 8, fullM: 5.5, backDeg: 120, keepDeg: 140, noticeM: 3, swapM: 0.75,
  slip: false, slipFrom: 2.6, slipBy: 1.2, backCos: [-0.45, -0.1] as [number, number],
};
interface St { on: Guard | null }
const STATE = new SideMap<Game, St>('samlook.STATE');
const stateOf = (g: Game): St => { let s = STATE.get(g); if (!s) { s = { on: null }; STATE.set(g, s); } return s; };
const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** his head is his own to turn */
function free(g: Game): boolean {
  const pl = g.player;
  return !pl.down && !pl.sprinting && !pl.holding && !pl.takedown && !pl.kick && !pl.picking && !pl.wanding && !pl.coding && !pl.wall && !pl.dragging && !pl.doorMove && !pl.breakerMove && !g.touring && !g.puppet && pl.char.anim.upper !== 'aim';
}
/** a man who is onto him, or has him in view this moment with his notice risen */
export const samLookNoticed = (g: Game, gd: Guard): boolean => gd.state === 'alert' || gd.state === 'search' || gd.state === 'suspicious' || (gd.awareness > 0.08 && g.time - gd.sightT < 0.4);
/** metres to a man his head could go to (Infinity: not one) — `deg` = how far round from his body's facing, 180 = anywhere */
function reach(g: Game, gd: Guard, maxM: number, deg: number): number {
  if (!closeSubject(g, gd)) return Infinity;
  const c = g.player.char, p = c.pos, q = gd.char.pos, dx = q[0] - p[0], dz = q[2] - p[2], d = Math.hypot(dx, dz);
  if (d > maxM || d < 0.15) return Infinity;
  if (deg < 180 && Math.abs(wrap(Math.atan2(dx, dz) - c.aimYaw)) > deg * Math.PI / 180) return Infinity;   // (his aim's line, which his chest and head turn to: with the cursor off to one side that, not his feet's, is where his head starts from)
  if (g.col.solidBlocked([p[0], p[1] + 1.2, p[2]], [q[0], q[1] + 1.4, q[2]])) return Infinity;
  return d;
}
function pick(g: Game): Guard | null {
  const S = stateOf(g), K = SAMLOOK;
  if (!free(g)) return (S.on = null);
  const st = STALK.on ? stalkOn(g) : null; if (st && closeSubject(g, st)) return (S.on = st);   // (asked of the stalk only while it is on, and only of a man still his to take: its state is not cleared by the switch)
  let best: Guard | null = null, bs = Infinity;
  for (const gd of g.guards) {
    const mine = gd === S.on, d = reach(g, gd, mine ? K.nearM + 0.5 : K.nearM, mine ? K.keepDeg : K.backDeg); if (d === Infinity) continue;
    const s = d - (samLookNoticed(g, gd) ? K.noticeM : 0) - (mine ? K.swapM : 0);
    if (s < bs) { bs = s; best = gd; }
  }
  return (S.on = best);
}
/** the man his head is on (null: nobody) — as of this frame's samLookStep */
export function samLookMan(g: Game): Guard | null { return SAMLOOK.on ? STATE.get(g)?.on ?? null : null; }
/** how much room one man asks of him: 0 past `slipFrom`, for a man who is onto him, and behind a man's back */
function slipOf(g: Game, gd: Guard): number {
  const K = SAMLOOK; if (gd.state === 'alert') return 0;
  const d = reach(g, gd, K.slipFrom, 180); if (!(d < K.slipFrom)) return 0;
  const p = g.player.char.pos, q = gd.char.pos, nose = Math.cos(wrap(Math.atan2(p[0] - q[0], p[2] - q[2]) - gd.char.bodyYaw));   // (1 = Sam dead ahead of him, −1 = dead behind)
  return (1 - smooth(K.slipBy, K.slipFrom, d)) * smooth(K.backCos[0], K.backCos[1], nose);
}
const slips = (g: Game): boolean => SAMLOOK.slip && free(g) && g.player.crouch && g.player.holstered;
/** THE SLIP's man: crouched with empty hands, the man who asks the most room of him (the nearest off a man's back), and how much (0‥1) */
export function samSlipMan(g: Game): { gd: Guard; k: number } | null {
  if (!slips(g)) return null;
  let best: Guard | null = null, bk = 0;
  for (const gd of g.guards) { const k = slipOf(g, gd); if (k > bk) { bk = k; best = gd; } }
  return best ? { gd: best, k: bk } : null;
}
/** THE SLIP as the animator is handed it: `k` the most any man asks, `away` the way they pull on him summed (a unit step from Sam toward the men, null when
 *  they cancel), `lean` how much of the lean is left of it — 1 beside one man, 0 dead between two (he does not tip into the other man: he only gets small) */
function slipNow(g: Game): { k: number; lean: number; at: Vec3 } | null {
  if (!slips(g)) return null;
  const p = g.player.char.pos; let vx = 0, vz = 0, top = 0;
  for (const gd of g.guards) { const k = slipOf(g, gd); if (k <= 0) continue; const dx = gd.char.pos[0] - p[0], dz = gd.char.pos[2] - p[2], L = Math.hypot(dx, dz) || 1; vx += k * dx / L; vz += k * dz / L; if (k > top) top = k; }
  if (top <= 0) return null;
  const L = Math.hypot(vx, vz), u = L > 1e-3 ? 1 / L : 0;
  return { k: top, lean: Math.min(1, L / top), at: [p[0] + vx * u, p[1] + 1.1, p[2] + vz * u] };
}
const headOf = (gd: Guard, up: number): Vec3 => [gd.char.pos[0], gd.char.pos[1] + up, gd.char.pos[2]];
/** ONCE A STEP, after the player's own update: what his animator is handed for the next frame's pose */
export function samLookStep(g: Game) {
  const an = g.player.char.anim; an.watchAt = null; an.watchK = 0; an.slipAt = null; an.slipK = 0; an.slipLean = 1;
  if (!SAMLOOK.on && !SAMLOOK.slip) return;
  if (SAMLOOK.on) {
    const gd = pick(g);
    if (gd) { const p = g.player.char.pos, d = Math.hypot(gd.char.pos[0] - p[0], gd.char.pos[2] - p[2]); const h = gd.char.bones.head; an.watchAt = h ? [h[0], h[1], h[2]] : headOf(gd, 1.6);   // (his head as posed: a man sat down, crouched or on the floor is looked at where he is)
      an.watchK = STALK.on && stalkOn(g) === gd ? 1 : 1 - smooth(Math.min(SAMLOOK.fullM, SAMLOOK.nearM * 0.7), SAMLOOK.nearM, d); }   // (whole inside `fullM` — or 0.7 of a range brought in under it)
  }
  const sl = slipNow(g); if (sl) { an.slipAt = sl.at; an.slipK = sl.k; an.slipLean = sl.lean; }
}
