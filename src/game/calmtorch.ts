// A CALM GUARD BURNS HIS TORCH ONLY WHERE HE NEEDS IT (the maintainer, 10-10, the solo night at dusk: "seems a little odd to have guards walking around with
// flashlights when it's peaceful and the office worker is doing stuff").
//
// The shift used to walk its beats with the hand torch burning wherever it went — under the cubicles' ceiling panels, down the lit corridor, past the late worker at
// his desk. Now a staff man on a CALM patrol still carries it (rigProps draws it in his hand either way) but the light is off while the place he is in and the floor
// he is walking onto are lit enough to work in, and clicks on when he walks into real dark: a dark room at night, the lobby with its lamps out, a blackout, the patch
// under a fixture somebody shot out.
//   · LIT ENOUGH TO WORK IN = the place's own STEADY light (fixtures, lamps, screens, the hour's sun and sky — guards.ts lightEstimateAt with nothing anybody carries
//     counted and no flash, tracer, stroke of lightning or turning beacon) reads `litAt` or over at him OR on floor he has a line to within `spillM`: the estimate is
//     direct light only, and a pool of light a few strides off in plain view is what lights the gap between two fixtures on screen (the bounce); by day, floor the
//     sun or the sky lights counts from `dayM` off, through glass (a window is a far bigger lamp than a ceiling panel). The same is asked of the floor `aheadM` / 2
//     and `aheadM` along the way he faces, as far as the first wall.
//   · A DWELL keeps it from blinking at a pool's edge: on after `onSecs` of dark (quickly: he stands in it, or his next strides are), off after `offSecs` of floor
//     lit — at `offK` × the bar — all the way down his look; between the two readings the torch stays as it is, and no two clicks come inside `holdSecs`. The clocks
//     are seconds COUNTED, not stamps against Game.time (a checkpoint puts that clock back), and ride a checkpoint with the reading (calmTorchSnapshot / Restore).
//   · ONE MODEL: his torch is one of the lights the meter reads — Sam's, a body's — so a lit room loses a sweeping beam and a dark one keeps it. Nothing is added on the
//     AI side: no eye, ear or rule of his reads this file.
//   · EVERYTHING THAT IS NOT CALM IS AS IT WAS: the rule is asked only of a staff man whose hand holds the torch on a plain patrol (guards.ts handCarry 'torch' and
//     state 'patrol') with nothing on his mind — awareness under `calmAw`, no errand, no body duty. A whistle he is answering (suspicious, torch kept in hand), a
//     glimpse that has his attention, the walk to the breaker: burning. Drawn pistols, weapon lights, units, the QRF, teammates: not this file's. Never under a show
//     (the tour and the showcases are choreographed round the beams) or quietUtility.
// No dice, no camera, no graphics setting: the estimate is the CPU's, the same on every host.
// Type-only game imports but for guards.ts's two functions, used inside calls only (src/game is one import cycle).
import { SideMap } from '../math/side';
import type { Game, Guard } from './game';
import type { Vec3 } from '../math/vec';
import { lightEstimateAt, handCarry } from './guards';
import { hourOf, hourLightAt } from './hours';

/** the switch and its numbers: off in the module, raised by the page (host/profile.ts pageSwitches; ?calmtorch=0 = every patrol torch burns, as it did) and by the
 *  shipped stand; the harness's frozen stand leaves it off (TPS_CALMTORCH=1 turns it on). `litAt` is on the meter's 0‥1 scale (by the direct estimate the cubicles
 *  under their panels read 0.3‥0.5, the dark lobby and the break room under 0.1; at 0.3 the dusk coming in by the frontage did not count and Novak burned his
 *  torch a fifth of a dusk lap), `offK` × it is what the floor must read for the torch to go OFF; `spillM` = how far lit floor in plain view lights where he
 *  stands, `dayM` the same for floor the hour's sun or sky lights; `aheadM` = how far down his way he looks; `onSecs` / `offSecs` = the dwell, `holdSecs` = the
 *  least time between two clicks; `askSecs` = how often the place is read; `calmAw` = the awareness at which something has his attention and the torch is his to
 *  look with. UNTUNED by eye (nobody has seen it on a GPU). */
export const TORCH = { calmOff: false, litAt: 0.2, offK: 1.2, spillM: 3, dayM: 12, aheadM: 5, onSecs: 0.3, offSecs: 2, holdSecs: 1, askSecs: 0.25, calmAw: 0.3 };

/** per man: is the torch dark, the last reading of his place (placeRead), seconds the reading has stood against the torch, seconds since the place was read, seconds since the switch last moved */
interface TorchState { dark: boolean; read: -1 | 0 | 1; against: number; ask: number; held: number; }
const stateOf = new SideMap<Guard, TorchState>('calmtorch.stateOf');
/** a load is posing the men's lights (savestate.ts, between calmTorchRestore and calmTorchPosed): the light is decided, no time is counted */
let posing = false;
export const TORCH_STATS = { clicksOn: 0, clicksOff: 0, asks: 0 };

const carried = () => true;   // (the place's own lights only: nothing anybody carries)
/** the place's steady light at a point of floor, on the meter's scale */
export function placeLight(g: Game, x: number, z: number): number { return g.visibilityOf(lightEstimateAt(g, [x, 1.2, z], carried, true)); }
/** is this point lit enough to work in: `bar` there, or on floor in plain view of it inside `spillM` (two rings of eight) — by day also daylit floor out to `dayM` */
export function workLit(g: Game, x: number, z: number, bar = TORCH.litAt): boolean {
  if (placeLight(g, x, z) >= bar) return true;
  const eye: Vec3 = [x, 1.5, z];
  for (let ring = 1; ring <= 2; ring++) { const r = TORCH.spillM * ring / 2;
    for (let k = 0; k < 8; k++) { const a = (k + (ring & 1) * 0.5) * Math.PI / 4, qx = x + Math.sin(a) * r, qz = z + Math.cos(a) * r;
      if (g.col.segmentBlocked(eye, [qx, 1.5, qz])) continue;
      if (placeLight(g, qx, qz) >= bar) return true; } }
  if (hourOf(g) === 'night') return false;
  // by day: a window is a far bigger lamp than a ceiling panel — floor the hour's sun or sky lights, in plain view (through glass too) out to `dayM`
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, sx = Math.sin(a), sz = Math.cos(a);
    for (let r = TORCH.spillM + 3; r <= TORCH.dayM + 1e-6; r += 3) { const qx = x + sx * r, qz = z + sz * r;
      if (g.col.segmentBlocked(eye, [qx, 1.5, qz])) break;
      if (g.visibilityOf(hourLightAt(g, [qx, 1.2, qz])) >= bar) return true; } }
  return false;
}
/** his place read for the switch: 1 = LIT (where he stands, and the floor `aheadM` / 2 and `aheadM` down the way he faces as far as the first wall, all at
 *  `litAt` × `offK`: nothing he is about to walk into is dark), −1 = DARK (where he stands, or the nearer of the two, under `litAt`), 0 = between the two — the
 *  edge of a pool, dark floor still a few strides off: the torch stays as it is */
export function placeRead(g: Game, gd: Guard): -1 | 0 | 1 {
  const c = gd.char, x = c.pos[0], z = c.pos[2]; TORCH_STATS.asks++;
  if (!workLit(g, x, z)) return -1;
  const fx = Math.sin(c.bodyYaw), fz = Math.cos(c.bodyYaw), eye: Vec3 = [x, 1.5, z], hi = TORCH.litAt * TORCH.offK;
  let lit = workLit(g, x, z, hi);
  for (let k = 1; k <= 2; k++) { const r = TORCH.aheadM * k / 2, qx = x + fx * r, qz = z + fz * r;
    if (g.col.segmentBlocked(eye, [qx, 1.5, qz])) break;
    if (k === 1 && !workLit(g, qx, qz)) return -1;
    if (lit && !workLit(g, qx, qz, hi)) lit = false; }
  return lit ? 1 : 0;
}
/** is his torch this rule's to decide this frame: a staff man's hand torch on a plain patrol with nothing on his mind, in live play */
export function calmTorchRuled(g: Game, gd: Guard): boolean {
  return TORCH.calmOff && !g.touring && !g.quietUtility && !gd.unit && gd.team === 'guard' && gd.state === 'patrol' && handCarry(gd) === 'torch'
    && gd.awareness < TORCH.calmAw && !gd.task && !gd.bodyDuty;
}
/** THE SEAM (guards.ts poseFlashlight, the line that says whether a living man's light burns): true = his torch is dark this frame. Counts `dt` on his dwell. */
export function calmTorchDark(g: Game, gd: Guard, dt: number): boolean {
  if (!TORCH.calmOff) return false;
  if (posing) dt = 0;
  if (!calmTorchRuled(g, gd)) { const S = stateOf.get(gd); if (S && S.dark) { S.dark = false; S.against = 0; S.held = 0; click(g, gd, true); } return false; }   // (something has him: it burns from this frame)
  let S = stateOf.get(gd);
  if (!S) { const read = placeRead(g, gd); S = { dark: read > 0, read, against: 0, ask: (gd.char.id % 4) / 4 * TORCH.askSecs, held: TORCH.holdSecs }; stateOf.set(gd, S); return S.dark; }   // (first met: as his place reads, no click; the men's readings fall on different frames)
  S.held = Math.min(S.held + dt, 60); S.ask += dt; if (dt > 0 && S.ask >= TORCH.askSecs) { S.ask = 0; S.read = placeRead(g, gd); }
  if (S.read !== (S.dark ? -1 : 1)) S.against = 0;   // (the reading agrees with the torch, or is between: nothing counts)
  else { S.against += dt; if (dt > 0 && S.against >= (S.dark ? TORCH.onSecs : TORCH.offSecs) && S.held >= TORCH.holdSecs) { S.dark = !S.dark; S.against = 0; S.held = 0; click(g, gd, !S.dark); } }
  return S.dark;
}
/** the switch under his thumb, for the player's ears only: no event is filed, nobody hears it */
function click(g: Game, gd: Guard, on: boolean) { if (on) TORCH_STATS.clicksOn++; else TORCH_STATS.clicksOff++; g.audio.play('click', gd.char.pos, 0.25); }

/** QA / the panel: what the rule has of a man (null = never asked of him) */
export function calmTorchOf(gd: Guard): Readonly<TorchState> | null { return stateOf.get(gd) ?? null; }
/** 'calm torches ▸ Kowalski off (lit place) · Novak ON (dark) · Reyes burning (not calm)' */
export function calmTorchSummary(g: Game): string {
  if (!TORCH.calmOff) return 'calm torches ▸ every patrol torch burns (off)';
  const men = g.guards.filter(gd => !gd.unit && gd.team === 'guard' && gd.state !== 'dead');
  return 'calm torches ▸ ' + (men.map(gd => { const S = stateOf.get(gd); return `${gd.callsign} ${!calmTorchRuled(g, gd) ? 'burning (not calm)' : !S ? '—' : S.dark ? 'off (lit place)' : 'ON (dark)'}`; }).join(' · ') || 'nobody on the floor');
}

// ---------------------------------------------------------------- checkpoints (game/savestate.ts): each man's switch and dwell by roster index
export type CalmTorchSnap = (number[] | null)[];
/** nothing (no key in the file) with the switch off or before the rule has met anybody */
export function calmTorchSnapshot(g: Game): CalmTorchSnap | undefined {
  if (!TORCH.calmOff) return undefined;
  const men = g.guards.map(gd => { const S = stateOf.get(gd); return S ? [S.dark ? 1 : 0, S.read, S.against, S.ask, S.held] : null; });
  return men.some(m => m) ? men : undefined;
}
/** …onto the fresh roster, BEFORE the load poses the men's lights (a file without the slice: each man is read afresh on his first frame) */
export function calmTorchRestore(g: Game, s: CalmTorchSnap | null | undefined) {
  g.guards.forEach((gd, i) => { const M = s?.[i];
    if (!M) { stateOf.delete(gd); return; }
    stateOf.set(gd, { dark: !!M[0], read: M[1] > 0 ? 1 : M[1] < 0 ? -1 : 0, against: Number.isFinite(M[2]) ? Math.max(0, M[2]) : 0, ask: Number.isFinite(M[3]) ? Math.max(0, M[3]) : 0, held: Number.isFinite(M[4]) ? Math.max(0, M[4]) : TORCH.holdSecs }); });
  posing = true;
}
/** the load has posed the lights: time counts again */
export function calmTorchPosed() { posing = false; }
