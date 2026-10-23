// THE SNEAK LAB — a place to play the close-in on a man and move its numbers while playing. The page opened with ?sneaklab (the dev server's /sneaklab: the
// level levels/sneak-lab.json, six men each walking one case — tools/levels/sneak-lab.ts) gets its own system in the panel, open from the first frame:
//   every number of the stalk (game/stalk.ts) and the few of the close-in mode it leans on, as live sliders · the build's numbers back by a button · the
//   numbers as they stand copied out as one line of text, to hand back
//   the men put back on their beats by a button · 'they can't notice you' and 'nothing hurts' (both on to begin with: the lab is for the motion) · a man sat down
//   a line that says what the stalk is doing right now and why the last one ended · the stalk's geometry drawn on the floor (ui/stalkviz.ts)
// Nothing here is the game's: it writes the same tables the panel's other rows write, and two of the sandbox's flags. Without the word none of it is made.
import type { Game, Guard } from '../game/game';
import type { Panel } from '../ui/panel';
import type { FollowCamera } from '../game/camera';
import type { Vec3 } from '../math/vec';
import { STALK, STALK_STATS, stalkOn } from '../game/stalk';
import { CLOSE, closeSeat, closeUnseat, closeSeated } from '../game/close';
import { TWOGEARS } from '../game/player';
import { STALKVIZ } from '../ui/stalkviz';

export const SNEAKLAB = { on: false, unseen: true, safe: true, clear: true };
export const SNEAKLAB_SYSTEM = 'Sneak lab';
type Table = Record<string, unknown>;
interface Num { t: Table; name: string; key: string; label: string; min: number; max: number; step: number; tip: string }
const deg = (cos: number) => Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI, cosOf = (d: number) => Math.cos(d * Math.PI / 180);
const NUMS = (): Num[] => [
  { t: STALK, name: 'STALK', key: 'pace', label: 'top speed m/s', min: 0.6, max: 2.6, step: 0.05, tip: 'the creep is never faster than this, however far ahead he is' },
  { t: STALK, name: 'STALK', key: 'closeMin', label: 'closing speed at the grab m/s', min: 0.05, max: 1.2, step: 0.05, tip: 'how fast Sam is still gaining on him as the grab fires: low is a soft arrival, high is a pounce' },
  { t: STALK, name: 'STALK', key: 'closeK', label: 'extra closing speed per metre out', min: 0, max: 2, step: 0.05, tip: 'each metre beyond the grab adds this to the closing speed: high closes the gap early and then eases, 0 is one steady speed all the way' },
  { t: STALK, name: 'STALK', key: 'easeUp', label: 'how quickly he gets going 1/s', min: 1, max: 14, step: 0.5, tip: 'low starts the creep like a breath, high snaps to speed (his own walk uses 6)' },
  { t: STALK, name: 'STALK', key: 'easeDown', label: 'how quickly he stops 1/s', min: 1, max: 20, step: 0.5, tip: 'how hard he brakes as he comes up on the man: low glides in, high stops short (letting go hands him back to his own walk, which stops at 12)' },
  { t: STALK, name: 'STALK', key: 'stationM', label: 'aims for this far behind his back m', min: 0.2, max: 1.2, step: 0.05, tip: 'the point the game walks Sam toward, straight behind the man: nearer swings Sam in tighter behind him' },
  { t: STALK, name: 'STALK', key: 'grabM', label: 'the grab fires inside m', min: 0.5, max: 1.05, step: 0.05, tip: 'the hold becomes the grab this close (the grab itself reaches 1.05)' },
  { t: STALK, name: 'STALK', key: 'cursorM', label: 'how near him the cursor must be m', min: 0.3, max: 4, step: 0.1, tip: 'the press counts as on him when the cursor is this near his feet (or right on him)' },
  { t: STALK, name: 'STALK', key: 'reachFrom', label: 'his arm starts to come up at m', min: 1.0, max: 3.5, step: 0.05, tip: 'from this far behind the man Sam\'s left arm begins to come up for his neck; it is all the way up as the grab fires' },
  { t: STALK, name: 'STALK', key: 'reach', label: 'how far the arm is up at the grab', min: 0, max: 1, step: 0.05, tip: '1 = the whole reach held out as the grab fires, 0 = no arm before the grab at all' },
  { t: STALK, name: 'STALK', key: 'riseFrom', label: 'he starts to come up out of the crouch at m', min: 1.0, max: 3.5, step: 0.05, tip: 'from this far behind a man on his feet Sam begins to stand up into him' },
  { t: STALK, name: 'STALK', key: 'rise', label: 'how far up he is at the grab', min: 0, max: 1, step: 0.05, tip: '0 = still in the full crouch when the grab fires (the grab stands him up in one go), 1 = on his feet by then' },
  { t: STALK, name: 'STALK', key: 'riseBy', label: 'he is that far up by m', min: 0.6, max: 2.5, step: 0.05, tip: 'the distance behind the man by which Sam is as far out of the crouch as the row above says' },
  { t: STALK, name: 'STALK', key: 'catchSecs', label: 'the step into the grab, s', min: 0, max: 0.45, step: 0.01, tip: 'the grab closes the last of the gap in one eased step this long. 0 = the grab\'s own snap' },
  { t: STALK, name: 'STALK', key: 'catchStride', label: 'his legs in that step, m/s', min: 0, max: 3, step: 0.1, tip: 'the most walking speed his legs are given for the step in' },
  { t: STALK, name: 'STALK', key: 'yank', label: 'he is hauled back, m', min: 0, max: 0.6, step: 0.02, tip: 'once the step in has landed the man is pulled this far straight back, Sam going with him. 0 = held where he stood' },
  { t: STALK, name: 'STALK', key: 'yankRoom', label: 'room kept behind the pair, m', min: 0.2, max: 1, step: 0.05, tip: 'the haul back stops this far short of anything solid behind Sam' },
  { t: STALK, name: 'STALK', key: 'cornerM', label: 'at a corner he is taken inside m', min: 0.8, max: 2.5, step: 0.05, tip: 'waiting on a wall with the button held: how close the man must pass' },
  { t: STALK, name: 'STALK', key: 'catchM', label: 'a step in longer than m takes longer', min: 0.3, max: 1.5, step: 0.05, tip: 'the step into the grab takes its own time up to this far; a longer one takes longer, in proportion' },
  { t: STALK, name: 'STALK', key: 'catchLong', label: 'and at most this many times as long', min: 1, max: 1.3, step: 0.01, tip: '1 = every step in takes the same time. Much over 1.1 and the haul back has too little of the grab left' },
  { t: STALK, name: 'STALK', key: 'cornerRise', label: 'at a corner he comes up over s', min: 0, max: 0.4, step: 0.01, tip: 'how long into the step in he is still coming up out of the wait. 0 = at once' },
  { t: STALK, name: 'STALK', key: 'cornerSee', label: 'at a corner his hand goes out from m', min: 1.5, max: 5, step: 0.1, tip: 'waiting on a wall with the button held: how far off the man is when the lead hand starts out toward him' },
  { t: STALK, name: 'STALK', key: 'cornerCoil', label: 'at a corner, how low he waits', min: 0, max: 1, step: 0.05, tip: 'how far he sinks while he waits with the button held. 0 = stood as he was' },
  { t: STALK, name: 'STALK', key: 'cornerDeg', label: 'at a corner, how far past you he must be, degrees', min: 30, max: 150, step: 5, tip: 'how far round from his nose Sam must be before the wait takes him: 90 = level with his shoulder, more = he has gone further past' },
  { t: CLOSE, name: 'CLOSE', key: 'modeM', label: 'it can begin inside m', min: 1.5, max: 7, step: 0.1, tip: 'the close-in range: inside it the sneak holds its pose and a press on a man begins the creep' },
  { t: CLOSE, name: 'CLOSE', key: 'modeOutM', label: 'it lets go past m', min: 2, max: 9, step: 0.1, tip: 'he got too far away: the creep ends past this' },
  { t: TWOGEARS, name: 'TWOGEARS', key: 'crouch', label: 'your own crouch walk m/s', min: 0.8, max: 2.2, step: 0.05, tip: 'the speed you arrive at before the creep takes over' },
];
/** the two arcs are kept as cosines; the lab shows them as degrees off his nose */
const ARCS: { key: 'beginCos' | 'outCos'; label: string; tip: string }[] = [
  { key: 'beginCos', label: 'it can begin this far round from his nose °', tip: '180 is dead behind him. A press begins the creep only when Sam is at least this far round (the grab itself needs 104.5)' },
  { key: 'outCos', label: 'it ends when he has turned to °', tip: 'he turned around: the creep ends once Sam is less than this far round from his nose' },
];
const WHY: Record<string, string> = { '': 'nothing yet', grab: 'the grab', let: 'you let go', far: 'he got too far away', turned: 'he turned around', wall: 'a wall or a door came between you', him: 'he noticed you, or he is out of it', hands: 'your hands were busy or not empty', keys: 'you moved by yourself' };

/** is this page the lab (the word on its address) */
export const sneakLabAsked = (q: URLSearchParams): boolean => q.has('sneaklab');
const nearest = (g: Game): Guard | null => { const p = g.player.char.pos; let best: Guard | null = null, bd = 1e9; for (const x of g.guards) { if (x.state === 'dead' || x.civ) continue; const d = Math.hypot(x.char.pos[0] - p[0], x.char.pos[2] - p[2]); if (d < bd) { best = x; bd = d; } } return best; };
/** the man who stands (the first route of the lab's level), for the chair */
const stander = (g: Game): Guard | null => g.guards.find(x => x.state !== 'dead' && !x.civ) ?? null;

/** ONCE, after the panel is built: the lab's system, its rows, the panel open on it */
export function sneakLabBoot(game: Game, panel: Panel) {
  SNEAKLAB.on = true; STALKVIZ.on = true;
  const nums = NUMS(), was = nums.map(n => n.t[n.key] as number), wasArc = ARCS.map(a => STALK[a.key]);
  let copied = '';
  const asText = () => JSON.stringify(Object.fromEntries([...nums.map(n => [`${n.name}.${n.key}`, n.t[n.key]] as [string, unknown]), ...ARCS.map(a => [`STALK.${a.key}`, +STALK[a.key].toFixed(3)] as [string, unknown])]));
  panel.system(SNEAKLAB_SYSTEM, { icon: '◔', short: 'sneak', title: 'play the close-in on a man and move its numbers while you play' });
  const now = panel.section('Right now', { open: true });
  panel.text(now, () => { const on = stalkOn(game), gd = on ?? nearest(game), p = game.player.char; if (!gd) return 'nobody left on the floor';
    const d = Math.hypot(p.pos[0] - gd.char.pos[0], p.pos[2] - gd.char.pos[2]), b = Math.atan2(p.pos[0] - gd.char.pos[0], p.pos[2] - gd.char.pos[2]) - gd.char.bodyYaw, round = Math.abs(Math.atan2(Math.sin(b), Math.cos(b))) * 180 / Math.PI;
    return `${game.player.holding ? 'you have him' : on ? 'creeping in' : 'not creeping'} · ${d.toFixed(2)} m from him · ${round.toFixed(0)}° round from his nose · you ${Math.hypot(p.vel[0], p.vel[2]).toFixed(2)} m/s, he ${Math.hypot(gd.char.vel[0], gd.char.vel[2]).toFixed(2)} m/s`; });
  panel.text(now, () => `${STALK_STATS.grabs} grabs from ${STALK_STATS.begun} holds · the last one ended with: ${WHY[STALK_STATS.last] ?? STALK_STATS.last}`);
  panel.buttons(now, 'the men', [
    { text: 'put everyone back', run: () => { game.restart(); hands(game); }, title: 'every man back on his beat, you back at the gate with empty hands (also Shift+Enter)' },
    { text: 'sit one down / stand him up', run: () => { const gd = stander(game); if (!gd) return; if (closeSeated(game, gd)) closeUnseat(game, gd, true); else closeSeat(game, gd); }, title: 'the man who stands by the wall sits where he is, to try the creep on a seated man' },
  ]);
  panel.toggleBox(now, 'they can\'t notice you', () => SNEAKLAB.unseen, v => { SNEAKLAB.unseen = v; }, 'on: nobody sees or hears you, so you can work on the motion. Off: the real guards, and the creep ends when one is onto you');
  panel.toggleBox(now, 'nothing hurts you', () => SNEAKLAB.safe, v => { SNEAKLAB.safe = v; }, 'god mode while the lab is open');
  panel.toggleBox(now, 'keep Sam clear of this panel', () => SNEAKLAB.clear, v => { SNEAKLAB.clear = v; }, 'the view slides over so Sam stands in the middle of what this panel leaves; off = the middle of the page, as the game has him');
  panel.toggleBox(now, 'draw the geometry on the floor', () => STALKVIZ.on, v => { STALKVIZ.on = v; }, 'round the nearest man: the ring it can begin inside and the one it lets go past, the edges of his rear arc, the point Sam is walked to, the ring the grab fires inside');
  const cr = panel.section('The creep', { open: true, reset: () => { nums.forEach((n, i) => { n.t[n.key] = was[i]; }); ARCS.forEach((a, i) => { STALK[a.key] = wasArc[i]; }); }, resetTitle: 'every number back to the build\'s' });
  panel.toggleBox(cr, 'holding the click creeps in', () => STALK.on, v => { STALK.on = v; }, 'off = the build before it: your own keys all the way, and the grab on its key');
  panel.toggleBox(cr, 'his body shows how close he is', () => STALK.tell, v => { STALK.tell = v; }, 'the arm comes up and he comes out of the crouch as he closes on the man\'s back, by distance, so a pause holds the pose. Off = the pose in reach alone');
  panel.toggleBox(cr, 'on a wall, holding the click waits for him', () => STALK.corner, v => { STALK.corner = v; }, 'with your back on a wall [Q] and empty hands, hold the left button: the man who walks past the corner is grabbed as he passes. Off = the button on a wall does nothing');
  panel.toggleBox(cr, 'the click is the only way to grab', () => STALK.only, v => { STALK.only = v; }, 'off = the grab\'s row is back beside the held click');
  for (const n of nums) panel.slider(cr, n.label, n.min, n.max, n.step, () => n.t[n.key] as number, v => { n.t[n.key] = v; }, n.tip);
  for (const a of ARCS) panel.slider(cr, a.label, 60, 180, 1, () => deg(STALK[a.key]), v => { STALK[a.key] = cosOf(v); }, a.tip);
  const out = panel.section('Hand the numbers back', { open: true });
  panel.buttons(out, 'numbers', [{ text: 'copy them', run: () => { copied = asText(); try { void navigator.clipboard?.writeText(copied); } catch { /* no clipboard here: the line below shows them */ } }, title: 'the numbers as they stand, as one line of text on the clipboard (and shown below)' }]);
  panel.text(out, () => copied || 'Move the sliders until it feels right, then copy the numbers and paste them where you send notes.');
  game.objectiveText = () => 'sneak lab ▸ hold left click on a man from behind';   // (the level has no mission of its own: the HUD's line says what the floor is for)
  hands(game); sneakLabFrame(game);
  panel.show(SNEAKLAB_SYSTEM);
}
/** empty hands and low: how a creep begins */
function hands(game: Game) { game.player.holstered = true; game.player.crouch = true; }
/** ONCE A PAGE FRAME, before the game's update: the lab's two flags */
export function sneakLabFrame(game: Game, cam?: FollowCamera) {
  if (!SNEAKLAB.on) return; game.playerInvisible = SNEAKLAB.unseen; game.godMode = SNEAKLAB.safe;
  if (cam) cam.hostShift = SNEAKLAB.clear ? panelShift(cam) : null;
}
/** THE PANEL COVERS THE RIGHT OF THE PAGE: the floor vector from the middle of the page to the middle of what the panel leaves, so Sam (and the three metres
 *  round him) stand clear of it. null with the panel shut or no page. */
function panelShift(cam: FollowCamera): Vec3 | null {
  if (typeof document === 'undefined') return null;
  const el = document.getElementById('panel'), W = window.innerWidth; if (!el || el.classList.contains('hidden') || !(W > 0)) return null;
  const half = (W - el.getBoundingClientRect().left) / 2 / W, a = cam.groundPoint(0.5, 0.5), b = cam.groundPoint(0.5 + half, 0.5);
  return a && b ? [b[0] - a[0], 0, b[2] - a[2]] : null;
}
