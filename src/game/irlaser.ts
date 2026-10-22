// IR LASERS (the maintainer, 10-06: "and then we could also model IR lasers (assuming enemies don't have night vision)" — "ready or not is a good base case
// here"). The squad's aiming laser is ONE device with two bands, and which band it is in follows its carrier's goggles, nowhere else — no key, no order:
//
//   A TEAMMATE (a man who wears the goggles: nvg.ts nvgWorn — an operative unit of a scenario, never a showcase's cast). Goggles DOWN: the laser is infrared,
//     and it is ON whenever his gun is at his shoulder (IR.carry: he cannot use his sights through the tube — the laser is how a goggled man aims, so it
//     lies along every sector he covers; thumb off the switch with the muzzle lowered for a colleague in the line, as ever, and for any frame the bore
//     lies on Sam or a teammate: paintsOwn). Goggles UP (a lit place, or behind
//     his own white light — nvg.ts decides, every frame): he drops the infrared, and what he shows is what the build before this file showed — the red line,
//     on when it was on before. WHAT THAT WAS, measured: the red laser's switch is the guard AI's hunting
//     states (alert / search), and the room fight never puts a scenario's teammate in either — so before this file a teammate in a scenario showed no laser at
//     all, and with his goggles up he still shows none. The showcases' operatives (no goggles) are untouched.
//   SAM (IR.sam): the same device on the gun in his hands while a scenario's team is on the floor — infrared with his goggles down and the gun UP (the rifle
//     whenever it is in his hands; the pistol while it is pointed — just fired, or behind its light — not at the relaxed carry, where the bore is not his aim),
//     nothing with them up (he showed no laser before this file and shows none now: invisible to them and no use to him bare-eyed).
//   AN ENEMY has no night vision and no infrared anything: his laser, where the sandbox switch gives him one (combat.ts LASER.enemy), is the red one.
//
// WHO SEES AN INFRARED LASER: a viewer whose eyes are behind a tube. In this game the only picture is the player's, so an IR laser's line and dot are handed to
// the renderer exactly while that picture IS the tube's (irViewer: Player.nvAmount past the half-way at which post.wgsl swaps the bare-eyed picture for the
// intensifier's — not the N key's own frame: the goggles take a moment to come down and nothing infrared may show in a bare-eyed frame). Goggles up: no box.
// The rule sits in ONE place, combat.ts beamBoxes, which makes no infrared box otherwise whoever asks. (A band bit on the box that the post pass honours would
// hold it in the shader itself; that is renderer work on both engines, not done here.)
//
// WHO IT REACHES OTHERWISE: nobody, by construction, and that is the whole of how the one-model rule is held here. A weapon laser — red or infrared — was
// only ever a picture: combat.ts beamBoxes makes emissive boxes flagged NoShadow, which the trace grid never holds (scene/boxes.ts), so no shadow, gather,
// cascade or probe ray meets one, and it is not a light: nothing is added to the light list the picture and the light meter sum. An enemy's eye (guards.ts
// sightGain off the GPU meter), a camera's lens (devices.ts lensGain) and every CPU estimate read lights and occluders, never these boxes. So an IR laser
// cannot raise what an enemy or a camera reads — and neither can a red one: ENEMIES DO NOT NOTICE A TEAMMATE'S VISIBLE LASER TODAY either (said on the page as
// an open call, not built here). Teammates 'aim with it' in the only sense the simulation has: it lies along the bore their rounds leave by, in the frames they
// are up for; nobody's aim, sight or decision changes with the band or the switch.
// tools/qa/irlaser-probes.ts holds all of it (probes.ts irlaser).
//
// IR.on false = the lasers of the build before this file, box for box: every laser 'visible', Sam with none.
// IR.teamOff (ON in the page, ?teamlasers puts the lines back; off here and on the frozen stand): no man on the player's side shows a laser line, of either
// band, in any state; Sam's own is untouched. The band and every rule above still hold underneath it — the switch only keeps the boxes from being made.
// NOT here: the IR ILLUMINATOR — a LIGHT only a tube sees by, on the same goggles. That one is irlight.ts (it retired nvg.ts's 'too dark for the tube, so white
// light' for a man who carries one).
// (src/game is one import cycle: nothing here is built from another game module's exports at module load.)
import { SideSet } from '../math/side';
import type { Vec3 } from '../math/vec';
import type { Box } from '../scene/boxes';
import type { Game, Guard } from './game';
import { beamBoxes, laserReach } from './combat';
import { nvgWorn, nvgDown } from './nvg';
import { fightLive } from './roomfight';
import { isHostile } from './teams';
import type { Character } from './character';

export const IR = {
  /** off = the lasers as they were: a teammate's is the red line in anybody's picture whatever his goggles do, Sam has none */
  on: true,
  /** Sam's own gun carries one: an infrared line along his bore while his goggles are down and the gun is in his hands (off = he has no laser, as before) */
  sam: true,
  /** a goggled teammate's laser is on whenever his gun is at his shoulder — every sector he covers, not only a man he is hunting (off = on in the red laser's
   *  own frames only: the guard AI's alert / search, which a scenario's teammate is never in) */
  carry: true,
  /** the team's guns show NO laser line at all, infrared or red — the maintainer, 10-22, of the lines on his men all through a goggled mission: "why do we
   *  have the lasers for the guys? i think we can disable". Sam's own (IR.sam) is left: it is how the player sees his bore through the tube. Off = every
   *  man's laser as it was. A picture only, like every laser here: nobody's aim, sight or decision reads it */
  teamOff: false,
};
/** an IR line's emissive colour: no hue, at the red laser's own luminance (Rec. 709 of [1, 0.06, 0.03]) — through the tube, which counts luminance alone, it is
 *  the line the red one was. UNTUNED BY EYE: nothing here was seen on a GPU. */
const BREAK = (() => { try { return String((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.TEAMLASER_BREAK ?? '') === '1'; } catch { return false; } })();
export const IR_TINT: Vec3 = [0.2577, 0.2577, 0.2577];

export type LaserBand = 'ir' | 'visible';
/** the picture is the tube's: an infrared laser shows in it (post.wgsl: `frame.post.x > 0.5` is the intensifier, and post.x is Player.nvAmount — host/loop.ts;
 *  never under a debug view: the native post pass shows no tube there) */
export function irViewer(g: Game): boolean { return viewTube ?? (g.player.nvAmount > 0.5 && !(g.engine.settings.debugView > 0)); }
/** A REPLAY VIEWER'S OWN TUBE (the engine replay's 'NV' switch: the picture's night vision is the viewer's, the run's goggles stay the tape's). Set only for the
 *  length of `irViewAs`, which Game.fogLift calls BETWEEN steps to make the infrared lines of a picture whose tube the run did not have on; no step ever sees it. */
let viewTube: boolean | null = null;
export function irViewAs<T>(tube: boolean, fn: () => T): T { const was = viewTube; viewTube = tube; try { return fn(); } finally { viewTube = was; } }
/** the infrared boxes made (combat.ts beamBoxes notes each): how a picture with the viewer's tube OFF leaves out the lines the step drew for its own.
 *  Picture only — nothing in the simulation asks. */
const IR_MADE = new SideSet<Box>('irlaser.IR_MADE');
export function irNote(b: Box): Box { IR_MADE.add(b); return b; }
export function irMade(b: Box): boolean { return IR_MADE.has(b); }
/** the band of `gd`'s weapon laser this frame (combat.ts laserBoxes asks before it draws): 'visible' for every man without goggles and for everybody with
 *  IR.on off — the red line, as it was */
export function laserBand(g: Game, gd: Guard): LaserBand {
  return IR.on && nvgWorn(g, gd) && nvgDown(g, gd) ? 'ir' : 'visible';
}
/** Sam's laser is on: a scenario's team on the floor, his goggles down, a gun in his hands and UP — at the aim, so the bore is where he points (the rifle
 *  always, short of a sprint, a kick or a leaf under his hand; the pistol when it has come up) — hands not on a lock or round a man, not down */
export function samLaserOn(g: Game): boolean {
  const pl = g.player;
  return IR.on && IR.sam && fightLive(g) && pl.nv && (pl.pistolUp || pl.rifleUp) && pl.char.anim.upper === 'aim' && !pl.down && !pl.sprinting && !pl.holding && !pl.char.anim.hideHeldItem && pl.char.anim.kitHold === undefined;   // (kitHold: the gun is still on its way to his hands — kitanim.ts; always undefined with that switch off)
}
/** Sam's own IR laser, muzzle to whatever it meets (combat.ts handProps, right after his rig) — only ever in the tube's picture */
export function samLaserBoxes(g: Game, out: Box[]) {
  if (!samLaserOn(g) || !irViewer(g)) return;
  const R = laserReach(g, g.player.char, null, true); if (R) beamBoxes(g, R.from, R.dir, R.L, out, R.dot, true, true);
}
/** A TEAMMATE'S LASER IS ON this frame (combat.ts handProps asks, for a man carrying Sam's rifle): never with the muzzle lowered for a colleague in the line or
 *  pinned in somebody's arm; hunting (the guard AI's alert / search) as it always was; and, infrared, whenever the gun is at his shoulder (IR.carry) */
export function laserOn(g: Game, gd: Guard): boolean {
  if (gd.muzzleDown || gd.held) return false;
  if (IR.teamOff && !BREAK && !isHostile(gd.team, 'player')) return false;   // (teamOff: a man on the player's side carries none — goggled or not, hunting or not; an enemy's sandbox laser, combat.ts LASER.enemy, is not this switch's)
  if (gd.state === 'alert' || gd.state === 'search') return true;
  return IR.on && IR.carry && gd.char.anim.upper === 'aim' && laserBand(g, gd) === 'ir';
}
/** an INFRARED line would end on one of his own — Sam, a teammate: thumb off the switch for that frame (combat.ts laserBoxes asks with what laserReach met).
 *  The muzzle rule (guards.ts muzzleCheck) lowers the gun for a colleague where he AIMS; this is where the bore points this frame — a man turning in the file —
 *  and it counts Sam. The red laser painted whom it painted and is left alone. */
export function paintsOwn(g: Game, gd: Guard, on: Character): boolean {
  if (on === g.player.char) return !isHostile(gd.team, 'player');
  const o = g.guards.find(x => x.char === on); return !!o && !isHostile(gd.team, o.team);   // (a hostage is nobody's colleague: the line lies on him like on a wall)
}
/** QA / the panel: every teammate's band and whether his laser is on, Sam's, and whether the picture shows the infrared ones */
export function irState(g: Game): { viewer: boolean; sam: boolean; men: { gd: Guard; band: LaserBand; on: boolean }[] } {
  return { viewer: irViewer(g), sam: samLaserOn(g), men: g.guards.filter(gd => gd.state !== 'dead' && nvgWorn(g, gd)).map(gd => ({ gd, band: laserBand(g, gd), on: laserOn(g, gd) })) };
}
/** 'IR lasers off: …' / 'IR lasers: yours on · Blue One infrared · Blue Two off (goggles up) — infrared ones shown (your goggles are down)' */
export function irSummary(g: Game): string {
  if (!IR.on) return 'IR lasers off: the team\'s lasers are the red ones, yours has none';
  const S = irState(g); if (!S.men.length && !fightLive(g)) return 'IR lasers: no team on the floor';
  if (IR.teamOff) return `IR lasers: ${IR.sam ? `yours ${S.sam ? 'on' : 'off'}` : 'you carry none'} · the team's guns show none — yours ${S.viewer ? 'shown (your goggles are down)' : 'not shown (your goggles are up)'}`;
  const men = S.men.map(m => `${m.gd.callsign} ${m.on ? (m.band === 'ir' ? 'infrared' : 'red') : m.band === 'ir' ? 'off (gun lowered)' : 'off (goggles up)'}`);
  return `IR lasers: ${IR.sam ? `yours ${S.sam ? 'on' : 'off'}` : 'you carry none'}${men.length ? ' · ' + men.join(' · ') : ''} — infrared ones ${S.viewer ? 'shown (your goggles are down)' : 'not shown (your goggles are up)'}`;
}
