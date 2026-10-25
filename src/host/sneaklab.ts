// THE SNEAK LAB — a place to play the close-in on a man and move its numbers while playing. The page opened with ?sneaklab (the dev server's /sneaklab: the
// level levels/sneak-lab.json, eleven men each walking one case — tools/levels/sneak-lab.ts) gets its own system in the panel, open from the first frame:
//   the five scenarios to tune (SCENES), a button each, and nothing that says what to do but one line at the top of the page
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
import { TAPSTEP, TAPSTEP_STATS } from '../game/tapstep';
import { CLOSE, closeSeat, closeUnseat, closeSeated } from '../game/close';
import { TWOGEARS, CROUCHRUN } from '../game/player';
import { SAMLOOK } from '../game/samlook';
import { WATCH, DASH, HOLD } from '../game/character';
import { STALKVIZ } from '../ui/stalkviz';

export const SNEAKLAB = { on: false, unseen: true, safe: true, clear: true, scene: 0 };
/** THE FIVE THINGS TO TUNE, as he named them. A button puts every man back and Sam where the scenario starts, hands empty and low, and says nothing else: no steps, no
 *  cards. `sam` and `yaw` are his start, `seen` whether the men can see him there (the walks through the dark are nothing without it), `behind` the beat of a man Sam starts 3 m behind, wherever the night's opening has found him on it, `end` the far end of such a walk, `line` the line at the top of the
 *  page, `tip` what to look for. The men are the level's own (tools/levels/sneak-lab.ts): every man is on his beat in every scenario, and walls keep the others out of it. */
export const SCENES: { name: string; sam: Vec3; yaw: number; seen: boolean; behind?: string; end?: Vec3; line: string; tip: string }[] = [
  { name: 'man standing', sam: [10.4, 0, 16.5], yaw: 1.03, seen: false, line: 'Sneak up behind him and grab him', tip: 'a man who stands with his back to you. Look at the whole of it: the walk in, the stop, the grab' },
  { name: 'man walking', sam: [13.2, 0, 13.6], yaw: Math.PI / 2, seen: false, behind: 'beat', line: 'Catch up with him from behind and grab him', tip: 'a man who walks away from you down the yard, waits, and turns back. Look for: can you match his pace and stay behind him?' },
  { name: 'dark room', sam: [34.2, 0, 25.9], yaw: Math.PI, seen: true, end: [36.2, 0, 7.4], line: 'Get to the far end of the room without being seen', tip: 'three men among the shelves, and they can see you. Look for: does slipping between them feel careful and quick to read?' },
  { name: 'dark corridor', sam: [4.3, 0, 25.8], yaw: Math.PI, seen: true, end: [4.3, 0, 2.0], line: 'Get to the far end of the corridor without being seen', tip: 'two men walking up and down, three niches, and they can see you. Look for: does ducking into a niche as one comes feel good?' },
  { name: 'corner', sam: [10.7, 0, 12.45], yaw: 0, seen: false, line: 'Wait at the corner and grab him as he comes past', tip: 'your back is on the wall, and a man comes round the corner past you. Look for: is the moment to grab easy to feel?' },
];
export const SNEAKLAB_SYSTEM = 'Sneak lab';
type Table = Record<string, unknown>;
type Grp = 'step' | 'start' | 'pace' | 'pose' | 'grab' | 'rmb' | 'pass' | 'run' | 'corner' | 'turn' | 'old';
/** the lab's groups, in the order they are read: a short name, whether it is open on a first visit, and what the group is for (its header's hover) */
const GROUPS: { id: Grp; name: string; open: boolean; title: string }[] = [
  { id: 'step', name: 'Tap to step', open: true, title: 'crouched, a press lifts his foot, holding reaches further and letting go plants it. Tap in time with his weight settling and watch the sound bar' },
  { id: 'start', name: 'Start and stop', open: false, title: 'when a press on a man begins the creep and when the creep lets go. Watch the rings and the arc drawn on the floor round the nearest man' },
  { id: 'pace', name: 'Pace', open: true, title: 'how fast he closes on the man and how he starts and stops. Watch "you … m/s, he … m/s" in Right now' },
  { id: 'pose', name: 'Pose', open: true, title: 'what his body does on the way in: how low he gets and where his arms are. Stop a metre and a half behind the man and look at him' },
  { id: 'grab', name: 'The grab', open: true, title: 'the last metre: where he waits, the spring up, the step in, the haul back and the gun. Grab the rifleman and the man who stands' },
  { id: 'rmb', name: 'Right click', open: false, title: 'the quick knockout and the held choke' },
  { id: 'pass', name: 'Passing guards', open: false, title: 'his head going to a man and the room he gives a man he passes. Use "two men, a gap" and walk between them' },
  { id: 'run', name: 'Fast crouch walk', open: false, title: 'Shift in a crouch' },
  { id: 'corner', name: 'Corner wait', open: false, title: 'back on a wall with the click held: the man who walks past is taken' },
  { id: 'turn', name: 'When he turns', open: false, title: 'the duck Sam gives when the man he is creeping up on turns round. Turn "they can\'t notice you" off to see it' },
  { id: 'old', name: 'Old pose (lower off)', open: false, title: 'the arm coming up and the rise out of the crouch. These only act with "lower, hands down" off, in Pose' },
];
interface Num { g: Grp; t: Table; name: string; key: string; label: string; min: number; max: number; step: number; tip: string }
const deg = (cos: number) => Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI, cosOf = (d: number) => Math.cos(d * Math.PI / 180);
/** every number: a name short enough for the row, and a hover that says what it is and what to look for or try when moving it */
const NUMS = (): Num[] => [
  { g: 'start', t: STALK, name: 'STALK', key: 'lowBeginM', label: 'start radius m', min: 3, max: 8, step: 0.1, tip: 'a press on a man begins the creep from this far off (with "lower, hands down" on). Look for: the outer dashed ring on the floor. Try: stand just outside it and press, then just inside' },
  { g: 'start', t: STALK, name: 'STALK', key: 'lowOutM', label: 'let-go radius m', min: 3.6, max: 10, step: 0.1, tip: 'the creep ends when he gets further off than this (with "lower, hands down" on). Try: start on a walking man and stop. It should not drop while he is still close enough to catch' },
  { g: 'start', t: STALK, name: 'STALK', key: 'cursorM', label: 'click this near m', min: 0.3, max: 4, step: 0.1, tip: 'the press counts as on him when the cursor is this near his feet, or right on him. Try: raise it if a press misses a walking man, lower it if a press picks the wrong man of two' },
  { g: 'start', t: STALK, name: 'STALK', key: 'dragDead', label: 'stick dead zone px', min: 0, max: 60, step: 1, tip: 'with "drag to steer" on: the mouse can wander this far from where you pressed and Sam stays still. Try: raise it if he creeps when you meant to hold still' },
  { g: 'start', t: STALK, name: 'STALK', key: 'dragFull', label: 'stick full at px', min: 40, max: 400, step: 5, tip: 'with "drag to steer" on: drag this far from where you pressed for the top speed. Less = a twitchy stick, more = finer control and a longer drag' },
  { g: 'start', t: CLOSE, name: 'CLOSE', key: 'modeM', label: 'old start radius m', min: 1.5, max: 7, step: 0.1, tip: 'the close-in range: inside it the sneak holds its pose. With "lower, hands down" on the start radius above is used when it is larger' },
  { g: 'start', t: CLOSE, name: 'CLOSE', key: 'modeOutM', label: 'old let-go m', min: 2, max: 9, step: 0.1, tip: 'with "lower, hands down" off, the creep ends past this' },
  { g: 'pace', t: STALK, name: 'STALK', key: 'pace', label: 'top speed m/s', min: 0.6, max: 2.6, step: 0.05, tip: 'the creep is never faster than this, however far ahead he is. Look for: "you … m/s" in Right now. Try: chase the man on the long straight. Too low and you never catch a walker' },
  { g: 'pace', t: STALK, name: 'STALK', key: 'closeMin', label: 'arrival speed m/s', min: 0.05, max: 1.2, step: 0.05, tip: 'how fast Sam is still gaining on him at the end. Low is a soft arrival, high is a pounce. Try: the man who stands, and watch the last half metre' },
  { g: 'pace', t: STALK, name: 'STALK', key: 'lowK', label: 'far-off boost', min: 0, max: 2, step: 0.05, tip: 'each metre he is from the man adds this to the closing speed (with "lower, hands down" on). Less is a slower, more deliberate creep. Try: 0 for one steady speed all the way in' },
  { g: 'pace', t: STALK, name: 'STALK', key: 'closeK', label: 'boost, lower off', min: 0, max: 2, step: 0.05, tip: 'the same boost per metre, used with "lower, hands down" off' },
  { g: 'pace', t: STALK, name: 'STALK', key: 'easeUp', label: 'start-up rate', min: 1, max: 14, step: 0.5, tip: 'how quickly he gets going when you press. Low starts like a breath, high snaps to speed (his own walk uses 6). Try: tap the click in short presses and feel each start' },
  { g: 'pace', t: STALK, name: 'STALK', key: 'easeDown', label: 'braking rate', min: 1, max: 20, step: 0.5, tip: 'how hard he brakes as he comes up on the man. Low glides in, high stops short. Look for: a slide or a lurch as he stops behind the man who stands' },
  { g: 'pace', t: STALK, name: 'STALK', key: 'stationM', label: 'aim point m', min: 0.2, max: 1.2, step: 0.05, tip: 'the point the game walks Sam toward, this far straight behind the man (the dot on the floor). Nearer swings him in tighter behind. Try: come in from the side' },
  { g: 'pace', t: STALK, name: 'STALK', key: 'keyM', label: 'waits at m', min: 0.6, max: 0.94, step: 0.01, tip: 'with "press the key to grab" on: how far behind the man he stops and waits for the key. It has to be inside the grab range. Look for: does he look close enough to reach him?' },
  { g: 'pace', t: TWOGEARS, name: 'TWOGEARS', key: 'crouch', label: 'crouch walk m/s', min: 0.8, max: 2.2, step: 0.05, tip: 'your own crouch walk on the keys, the speed you arrive at before the creep takes over. Try: walk in on the keys, then press, and feel the change of speed' },
  { g: 'pose', t: STALK, name: 'STALK', key: 'lowFrom', label: 'sink starts at m', min: 1.2, max: 5, step: 0.05, tip: 'how far from the man he starts to go lower. Look for: where on the way in his hips begin to drop. Try: creep in and stop every half metre' },
  { g: 'pose', t: STALK, name: 'STALK', key: 'lowBy', label: 'fully down by m', min: 0.95, max: 3, step: 0.05, tip: 'how far from the man he is as low as he goes' },
  { g: 'pose', t: STALK, name: 'STALK', key: 'lowDrop', label: 'hips lower m', min: 0, max: 0.25, step: 0.01, tip: 'all the way down, his hips are this much lower than the creep\'s own crouch. Look for: his knees. Too much and he sits on his heels' },
  { g: 'pose', t: STALK, name: 'STALK', key: 'lowBack', label: 'hips back m', min: 0, max: 0.15, step: 0.01, tip: 'all the way down, his hips sit this much further back over his heels' },
  { g: 'pose', t: STALK, name: 'STALK', key: 'lowLean', label: 'back flatter °', min: 0, max: 30, step: 1, tip: 'all the way down, his back is bowed this much more. Look for: his head against the man\'s back from the side' },
  { g: 'pose', t: STALK, name: 'STALK', key: 'lowHands', label: 'hands down', min: 0, max: 1, step: 0.05, tip: '1 = his hands are let down out of the old raised carry. 0 = held up ahead of him, as the creep first had them. "arms out" only shows with this up' },
  { g: 'start', t: STALK, name: 'STALK', key: 'orbitK', label: 'hold to circle', min: 0, max: 8, step: 0.5, tip: 'with "keys go round him" on: how hard Sam is pulled back onto his circle round the man. Look for: going round, does the gap stay the same? 0 = he drifts out as he goes' },
  { g: 'start', t: STALK, name: 'STALK', key: 'orbitEdge', label: 'short of his side', min: 0, max: 0.4, step: 0.02, tip: 'how far short of the edge of his back arc Sam stops going round. More = he stays further behind him. Look for: he never ends up beside him where the creep breaks off' },
  { g: 'start', t: STALK, name: 'STALK', key: 'orbitSnap', label: 'nearly across', min: 0, max: 0.6, step: 0.05, tip: 'with "keys go round him" on: how far off straight across the man a key can point and still take Sam round him on the same circle. 0 = any slant at all closes or opens the gap as he goes. Look for: hold a key that is a little off across him, does he spiral in?' },
  { g: 'pose', t: STALK, name: 'STALK', key: 'heftTwist', label: 'shoulders turn °', min: 0, max: 40, step: 1, tip: 'with "weight in the step" on: how far his shoulders come round against each step. Look for: the whole back turning, not just the arms. Try 10 against 30' },
  { g: 'pose', t: STALK, name: 'STALK', key: 'heftSwing', label: 'arms swing m', min: 0, max: 0.35, step: 0.01, tip: 'how far each hand swings ahead and back, against its own foot. Look for: the arms balancing him. Too much and he looks like he is marching' },
  { g: 'pose', t: STALK, name: 'STALK', key: 'heftSide', label: 'weight shift m', min: 0, max: 0.1, step: 0.005, tip: 'how far his hips go over the foot he is standing on. Look for: his weight going from foot to foot, not a body gliding on legs' },
  { g: 'pose', t: STALK, name: 'STALK', key: 'heftLean', label: 'back bowed °', min: 0, max: 35, step: 1, tip: 'how much further forward his back bows. Look for: from the game\'s camera, his head out ahead of his shoulders. Try 8 against 25' },
  { g: 'pose', t: STALK, name: 'STALK', key: 'heftDip', label: 'hips dip m', min: 0, max: 0.06, step: 0.005, tip: 'how much lower his hips go when his feet are furthest apart. Look for: a slow rise and fall with each step, not a bounce' },
  { g: 'pose', t: STALK, name: 'STALK', key: 'heftSurge', label: 'start and stop', min: 0, max: 2, step: 0.1, tip: 'how much his back and hands feel him setting off and stopping. Look for: a small tip forward and a settle as he stops. 0 for none' },
  { g: 'pose', t: STALK, name: 'STALK', key: 'heftOut', label: 'hanging arms out m', min: 0, max: 0.4, step: 0.01, tip: 'with "weight in the step" on: how far outside his shoulder each hand hangs. Look for: arms balancing him, not wings. Try 0.08 against 0.25' },
  { g: 'pose', t: STALK, name: 'STALK', key: 'heftDown', label: 'hanging arms down m', min: 0.2, max: 0.6, step: 0.01, tip: 'how far under his shoulder each hand hangs. Look for: long arms with a soft elbow. Near 0.6 the arm goes straight' },
  { g: 'pose', t: STALK, name: 'STALK', key: 'heftFwd', label: 'hanging arms ahead m', min: -0.35, max: 0.2, step: 0.01, tip: 'how far ahead of his shoulder each hand hangs: under 0 is behind it, by his hip. Look for: from the side, his hands under him and never out past his face' },
  { g: 'pose', t: STALK, name: 'STALK', key: 'heftLead', label: 'left hand ahead m', min: 0, max: 0.2, step: 0.01, tip: 'how much further ahead his left hand hangs than his right. Look for: one hand a little ahead, without both reaching' },
  { g: 'pose', t: STALK, name: 'STALK', key: 'wideOut', label: 'arms out m', min: 0, max: 0.45, step: 0.01, tip: 'with "arms out" on: each hand is this far outside its own shoulder. Look for: from the game\'s camera, do his arms read as ready or as wings? Try 0.05 against 0.2' },
  { g: 'pose', t: STALK, name: 'STALK', key: 'wideDown', label: 'arms down m', min: 0.1, max: 0.55, step: 0.01, tip: 'how far under his shoulders his hands hang. More = nearer the floor. Look for: hands by his knees read as picking something up, hands at his ribs read as hands up' },
  { g: 'pose', t: STALK, name: 'STALK', key: 'wideFwd', label: 'arms ahead m', min: -0.1, max: 0.4, step: 0.01, tip: 'how far ahead of his shoulders his hands are. More = his hands lead him toward the man' },
  { g: 'pose', t: STALK, name: 'STALK', key: 'wideLead', label: 'left hand leads m', min: 0, max: 0.2, step: 0.01, tip: 'how much further ahead his left hand is than his right (the footage reaches with one hand). Look for: one hand reaching for the man, not two held out level' },
  { g: 'pose', t: STALK, name: 'STALK', key: 'wideBy', label: 'arms out by', min: 0.05, max: 1, step: 0.05, tip: 'how far into the sink his arms are all the way out. Small = out as soon as he starts to go lower. 1 = they come out only as fast as he sinks' },
  { g: 'grab', t: STALK, name: 'STALK', key: 'grabM', label: 'grab range m', min: 0.5, max: 1.05, step: 0.05, tip: 'with "press the key to grab" off, the hold becomes the grab this close (the grab itself reaches 1.05). Look for: the inner ring on the floor' },
  { g: 'grab', t: STALK, name: 'STALK', key: 'lowSpring', label: 'spring-up speed', min: 6, max: 40, step: 1, tip: 'how fast he comes up out of the low creep once you press the key. 10 is how he stands up anywhere else. Look for: does the grab feel like a pounce? Try 10 against 30' },
  { g: 'grab', t: STALK, name: 'STALK', key: 'lowWind', label: 'spring wind-up s', min: 0, max: 0.3, step: 0.01, tip: '0 = he jumps up at once. More = he leaves the floor slowly and arrives fast. Look for: the delay between your key and his arm' },
  { g: 'grab', t: STALK, name: 'STALK', key: 'catchSecs', label: 'step-in time s', min: 0, max: 0.45, step: 0.01, tip: 'the grab closes the last of the gap in one eased step this long. 0 = the grab\'s own snap. Look for: his feet. Too long and he floats in' },
  { g: 'grab', t: STALK, name: 'STALK', key: 'catchStride', label: 'step-in legs m/s', min: 0, max: 3, step: 0.1, tip: 'the most walking speed his legs are given for the step in. Look for: sliding feet (too low) or a scurry (too high)' },
  { g: 'grab', t: STALK, name: 'STALK', key: 'catchM', label: 'long step from m', min: 0.3, max: 1.5, step: 0.05, tip: 'a step in longer than this takes longer, in proportion. Try: grab from as far off as the key lets you' },
  { g: 'grab', t: STALK, name: 'STALK', key: 'catchLong', label: 'long step, times', min: 1, max: 1.3, step: 0.01, tip: 'the most a long step in is stretched. 1 = every step in takes the same time. Much over 1.1 and the haul back has too little of the grab left' },
  { g: 'grab', t: STALK, name: 'STALK', key: 'yank', label: 'haul back m', min: 0, max: 0.6, step: 0.02, tip: 'once the step in has landed the man is pulled this far straight back, Sam going with him. 0 = held where he stood. Look for: the man going off his feet' },
  { g: 'grab', t: STALK, name: 'STALK', key: 'yankRoom', label: 'room behind m', min: 0.2, max: 1, step: 0.05, tip: 'the haul back stops this far short of anything solid behind Sam. Try: grab a man with your back near a wall' },
  { g: 'step', t: TAPSTEP, name: 'TAPSTEP', key: 'tapM', label: 'a tap is m', min: 0.15, max: 0.6, step: 0.01, tip: 'how far a quick tap takes him. Look for: can you stop exactly where you mean to' },
  { g: 'step', t: TAPSTEP, name: 'TAPSTEP', key: 'beatM', label: 'tap on beat m', min: 0.2, max: 0.8, step: 0.01, tip: 'how far a tap takes him when you press just as his weight has settled. Try: tap a steady rhythm across the dark room' },
  { g: 'step', t: TAPSTEP, name: 'TAPSTEP', key: 'reachM', label: 'a held step is m', min: 0.4, max: 1.3, step: 0.01, tip: 'how far one step reaches if you keep the key down. Look for: how far apart his feet get' },
  { g: 'step', t: TAPSTEP, name: 'TAPSTEP', key: 'secs', label: 'a held step takes s', min: 0.3, max: 1.4, step: 0.01, tip: 'how long a full step takes, rest to rest. Longer is softer and slower. Look for: does the foot come down gently' },
  { g: 'step', t: TAPSTEP, name: 'TAPSTEP', key: 'rushed', label: 'rushed step quicker', min: 0, max: 0.7, step: 0.01, tip: 'how much of its time a step loses when you press right after the last one. 0 = a rushed step looks like any other' },
  { g: 'step', t: TAPSTEP, name: 'TAPSTEP', key: 'settle', label: 'settles in s', min: 0, max: 0.5, step: 0.01, tip: 'how long his weight takes to come down after a step. Press before it is over and the step scuffs. A held key always waits for it' },
  { g: 'step', t: TAPSTEP, name: 'TAPSTEP', key: 'beat', label: 'beat lasts s', min: 0, max: 0.4, step: 0.01, tip: 'how long after he settles a press still counts as on the beat' },
  { g: 'step', t: TAPSTEP, name: 'TAPSTEP', key: 'quiet', label: 'quiet step', min: 0.02, max: 0.2, step: 0.005, tip: 'how loud a step on time is. The crouch walk is 0.125' },
  { g: 'step', t: TAPSTEP, name: 'TAPSTEP', key: 'scuff', label: 'worst scuff', min: 0.1, max: 0.8, step: 0.01, tip: 'how loud a step is when you press right after the last one. Each 0.1 is heard about 0.7 m further' },
  { g: 'step', t: TAPSTEP, name: 'TAPSTEP', key: 'maskSecs', label: 'under his step s', min: 0, max: 0.4, step: 0.01, tip: 'a step that lands this soon after a man\'s footfall is covered by it' },
  { g: 'step', t: TAPSTEP, name: 'TAPSTEP', key: 'maskM', label: 'covers inside m', min: 1, max: 12, step: 0.5, tip: 'only a man this near Sam covers his step' },
  { g: 'step', t: TAPSTEP, name: 'TAPSTEP', key: 'mask', label: 'covered step keeps', min: 0, max: 1, step: 0.05, tip: 'how much of its sound a covered step keeps. 0 = silent' },
  { g: 'step', t: TAPSTEP, name: 'TAPSTEP', key: 'landM', label: 'lands inside m', min: 0.6, max: 2.5, step: 0.05, tip: 'a step toward a man\'s back from this close bends onto the spot behind him and goes all the way there. Look for: does it feel like he chose it' },
  { g: 'step', t: TAPSTEP, name: 'TAPSTEP', key: 'landCos', label: 'lands within', min: 0, max: 0.95, step: 0.05, tip: 'how close to the line of the step his back has to be. 1 = dead ahead, 0 = anywhere in front of him' },
  { g: 'step', t: TAPSTEP, name: 'TAPSTEP', key: 'follow', label: 'keeps up with him', min: 0, max: 1.5, step: 0.05, tip: 'how much of a walking man\'s speed goes into a step behind him. 0 = the steps can\'t catch him without a scuff' },
  { g: 'step', t: TAPSTEP, name: 'TAPSTEP', key: 'turn', label: 'steers in the air', min: 2, max: 30, step: 1, tip: 'how quickly a step in the air comes round to the keys' },
  { g: 'step', t: TAPSTEP, name: 'TAPSTEP', key: 'legs', label: 'legs follow', min: 3, max: 20, step: 0.5, tip: 'how quickly his legs catch up with the ground a step covers' },
  { g: 'grab', t: HOLD.first, name: 'HOLD.first', key: 'take', label: 'gun out at s', min: 0.08, max: 0.2, step: 0.01, tip: 'with "gun out before the arm" on: his gun is out of his hands this long after the grab begins. The arm is at his neck at about 0.27. Try: the rifleman. Look for: Sam\'s right hand reaching the gun before it moves' },
  { g: 'grab', t: HOLD.first, name: 'HOLD.first', key: 'drop', label: 'gun let go at s', min: 0.2, max: 0.42, step: 0.01, tip: 'Sam lets the gun fly this long after the grab begins. Look for: where it lands, and that it has left his hand before the arm closes' },
  { g: 'rmb', t: CLOSE, name: 'CLOSE', key: 'rmbTapSecs', label: 'tap shorter than s', min: 0.08, max: 0.5, step: 0.01, tip: 'let go of the right button inside this and it is the knockout. Keep it down past this behind a man and it is the choke. Try: raise it if your quick clicks turn into chokes' },
  { g: 'rmb', t: CLOSE, name: 'CLOSE', key: 'rmbLoud', label: 'knockout louder', min: 0, max: 0.5, step: 0.01, tip: 'added to how loud the knockout is to the room. Each 0.1 is about 0.7 m further that a guard hears it. The choke stays as quiet as it was. Try: turn "they can\'t notice you" off and knock one out near another' },
  { g: 'pass', t: SAMLOOK, name: 'SAMLOOK', key: 'nearM', label: 'looks inside m', min: 3, max: 14, step: 0.5, tip: 'his head starts to go to a man here, and is fully on him a couple of metres nearer. Look for: his head as you walk past the men' },
  { g: 'pass', t: SAMLOOK, name: 'SAMLOOK', key: 'noticeM', label: 'noticing bonus m', min: 0, max: 8, step: 0.5, tip: 'a man who is starting to notice him counts as this much nearer, so his head goes to that man first. Try: "they can\'t notice you" off, between two men' },
  { g: 'pass', t: WATCH, name: 'WATCH', key: 'yaw', label: 'head turn °', min: 30, max: 90, step: 1, tip: 'how far his head turns off the line of his chest, to either side. Look for: an owl (too much) or a stiff neck (too little)' },
  { g: 'pass', t: SAMLOOK, name: 'SAMLOOK', key: 'slipFrom', label: 'room starts at m', min: 1.4, max: 5, step: 0.1, tip: 'the lean away, the sink and the low arm begin this far from a man beside him and are whole at arm\'s length. Try: walk past a man\'s shoulder' },
  { g: 'pass', t: WATCH, name: 'WATCH', key: 'lean', label: 'tip away °', min: 0, max: 20, step: 0.5, tip: 'how far his trunk tips away from the man he passes' },
  { g: 'pass', t: WATCH, name: 'WATCH', key: 'squeeze', label: 'lower between two', min: 0, max: 1.5, step: 0.05, tip: 'between two men he leans into neither and sinks this much more, as a share of the sink beside one man. Try: "two men, a gap" in Right now' },
  { g: 'run', t: CROUCHRUN, name: 'CROUCHRUN', key: 'pace', label: 'speed m/s', min: 1.6, max: 3.6, step: 0.05, tip: 'the fast crouch walk on Shift. Your walk is 1.55 and your sprint 4.7. Try: cross the yard behind the men and see if you can pass a walker' },
  { g: 'run', t: CROUCHRUN, name: 'CROUCHRUN', key: 'loud', label: 'footfall loudness', min: 0.125, max: 0.7, step: 0.005, tip: 'each footfall. The crouch walk is 0.125, the walk 0.26, a run 0.6. Each 0.1 is about 0.7 m further that a guard hears it. Try: "they can\'t notice you" off' },
  { g: 'run', t: DASH, name: 'DASH', key: 'stride', label: 'longer stride', min: 0, max: 0.6, step: 0.02, tip: 'longer steps and fewer of them. 0 = the crouch walk wound up fast. Look for: his feet' },
  { g: 'run', t: DASH, name: 'DASH', key: 'lean', label: 'lean °', min: 0, max: 16, step: 0.5, tip: 'how far over his knees he goes' },
  { g: 'corner', t: STALK, name: 'STALK', key: 'cornerM', label: 'takes him inside m', min: 0.8, max: 2.5, step: 0.05, tip: 'waiting on a wall with the click held: how close the man must pass to be taken' },
  { g: 'corner', t: STALK, name: 'STALK', key: 'cornerDeg', label: 'how far past °', min: 30, max: 150, step: 5, tip: 'how far round from his nose Sam must be before the wait takes him. 90 = level with his shoulder, more = he has gone further past' },
  { g: 'corner', t: STALK, name: 'STALK', key: 'cornerSee', label: 'hand goes out at m', min: 1.5, max: 5, step: 0.1, tip: 'how far off the man is when Sam\'s lead hand starts out toward him' },
  { g: 'corner', t: STALK, name: 'STALK', key: 'cornerCoil', label: 'how low he waits', min: 0, max: 1, step: 0.05, tip: 'how far he sinks while he waits with the click held. 0 = stood as he was' },
  { g: 'corner', t: STALK, name: 'STALK', key: 'cornerRise', label: 'comes up over s', min: 0, max: 0.4, step: 0.01, tip: 'how long into the step in he is still coming up out of the wait. 0 = at once' },
  { g: 'turn', t: STALK, name: 'STALK', key: 'jolt', label: 'duck size', min: 0, max: 1, step: 0.05, tip: 'how hard Sam shrinks back when the man he is creeping up on turns off his back. 0 = none' },
  { g: 'turn', t: STALK, name: 'STALK', key: 'joltFace', label: 'ducks if facing °', min: 20, max: 180, step: 5, tip: 'Sam ducks only when the man has come round this close to facing him. 180 = at any turn that ends the creep' },
  { g: 'turn', t: STALK, name: 'STALK', key: 'joltSecs', label: 'duck window s', min: 0.1, max: 1.5, step: 0.05, tip: 'how long after the creep is broken off the man still has to come round to face him' },
  { g: 'old', t: STALK, name: 'STALK', key: 'reachFrom', label: 'arm starts at m', min: 1.0, max: 3.5, step: 0.05, tip: 'from this far behind the man Sam\'s left arm begins to come up for his neck' },
  { g: 'old', t: STALK, name: 'STALK', key: 'reach', label: 'arm up at grab', min: 0, max: 1, step: 0.05, tip: '1 = the whole reach held out as the grab fires, 0 = no arm before the grab at all' },
  { g: 'old', t: STALK, name: 'STALK', key: 'riseFrom', label: 'rise starts at m', min: 1.0, max: 3.5, step: 0.05, tip: 'from this far behind a man on his feet Sam begins to stand up into him' },
  { g: 'old', t: STALK, name: 'STALK', key: 'rise', label: 'risen at grab', min: 0, max: 1, step: 0.05, tip: '0 = still in the full crouch when the grab fires, 1 = on his feet by then' },
  { g: 'old', t: STALK, name: 'STALK', key: 'riseBy', label: 'risen by m', min: 0.6, max: 2.5, step: 0.05, tip: 'the distance behind the man by which Sam is as far out of the crouch as the row above says' },
];
/** the two arcs are kept as cosines; the lab shows them as degrees off his nose (Start and stop) */
const ARCS: { key: 'beginCos' | 'outCos'; label: string; tip: string }[] = [
  { key: 'beginCos', label: 'start arc °', tip: 'a press begins the creep only when Sam is at least this far round from the man\'s nose. 180 is dead behind him (the grab itself needs 104.5). Look for: the two arc edges on the floor' },
  { key: 'outCos', label: 'ends if he turns °', tip: 'he turned around: the creep ends once Sam is less than this far round from his nose' },
];
/** the switches, each in its group: a short name and a hover that says what on and off are and what to try */
const TOGS = (): { g: Grp; label: string; get: () => boolean; set: (v: boolean) => void; tip: string }[] => [
  { g: 'step', label: 'keys are steps in a crouch', get: () => TAPSTEP.on, set: v => { TAPSTEP.on = v; }, tip: 'on: crouched, a press lifts his foot, holding reaches and letting go plants it, and between steps he stands still. Shift is still the fast crouch walk. Off = the crouch walk' },
  { g: 'start', label: 'hold click to creep', get: () => STALK.on, set: v => { STALK.on = v; }, tip: 'on: hold the left button on a man from behind and Sam creeps up on him, let go and he stops. Off = the build before it: your own keys all the way in, and the grab on its key' },
  { g: 'start', label: 'drag to steer', get: () => STALK.drag, set: v => { STALK.drag = v; }, tip: 'on: press on a man from behind, keep the button down and drag the mouse the way you want Sam to creep, like a stick centred where you pressed. Further = faster. Back to where you pressed = he holds still. He always faces the man and stops just behind him. Off = the hold walks him in by itself' },
  { g: 'start', label: 'weight in the step', get: () => STALK.heft, set: v => { STALK.heft = v; }, tip: 'on: his back, shoulders and arms go with his legs, a beat behind them. off: the arms as they were, held still. Look for: does he look heavy and careful as he steps, and does he settle when he stops?' },
  { g: 'start', label: 'keys go round him', get: () => STALK.orbit, set: v => { STALK.orbit = v; }, tip: 'on: with the button held on a man, a move key takes Sam round him on a circle, still facing him, and the stick does the same. Toward or away still closes or opens the gap. Off = a move key ends the creep. Try: hold the click behind him and tap A or D' },
  { g: 'start', label: 'click is the only way in', get: () => STALK.only, set: v => { STALK.only = v; }, tip: 'off = the grab\'s row is back beside the held click. It only matters with "press the key to grab" off' },
  { g: 'pose', label: 'lower, hands down', get: () => STALK.low, set: v => { STALK.low = v; }, tip: 'on: no arm comes up and he sinks lower and slower as he closes, then springs up into the grab. Off = the old pose: the arm comes up and he rises as he closes' },
  { g: 'pose', label: 'arms out', get: () => STALK.wide, set: v => { STALK.wide = v; }, tip: 'on: as he closes on a man in his crouch his arms come out a little from his sides, elbows bent and back, open hands by his knees with the left ahead, and stay out while he waits behind him. Off = his hands hang by his knees. Needs "lower, hands down". Try: flip it while stopped a metre and a half behind a man' },
  { g: 'pose', label: 'body shows distance', get: () => STALK.tell, set: v => { STALK.tell = v; }, tip: 'on: his pose changes as he closes on the man\'s back, by distance, so a pause holds the pose. Off = the pose in reach alone' },
  { g: 'grab', label: 'press the key to grab', get: () => STALK.key, set: v => { STALK.key = v; }, tip: 'on: holding the click only sneaks you up behind him, and you press the action key to grab. Off = the hold ends in the grab by itself' },
  { g: 'grab', label: 'gun out before the arm', get: () => HOLD.stripFirst, set: v => { HOLD.stripFirst = v; }, tip: 'grabbing a man with a gun in his hands: on = Sam strips the gun first and the arm lands a beat later, with the strip heard before the catch. Off = both at once. Try: the rifleman, with sound on' },
  { g: 'rmb', label: 'tap knocks out, hold chokes', get: () => CLOSE.rmbHold, set: v => { CLOSE.rmbHold = v; }, tip: 'on: a quick right click behind him is the knockout (fast, a little louder), and the right button kept down takes him into your arm and chokes him while you hold it (quiet, slow). Off = the right click is the knockout alone' },
  { g: 'pass', label: 'head goes to the man', get: () => SAMLOOK.on, set: v => { SAMLOOK.on = v; }, tip: 'on: he looks at the nearest man in front of him, and at a man who is starting to notice him before a nearer one. The cursor still aims. Off = his head stays where his body faces' },
  { g: 'pass', label: 'gives a man room', get: () => SAMLOOK.slip, set: v => { SAMLOOK.slip = v; }, tip: 'on: crouched beside a man he tips away, sinks, and the arm on that side goes out low. Off = the plain crouch' },
  { g: 'run', label: 'Shift is a fast crouch walk', get: () => CROUCHRUN.on, set: v => { CROUCHRUN.on = v; }, tip: 'on: Shift in a crouch keeps you down and moves you quickly, and you stand up to sprint. Off = Shift stands you up into the sprint' },
  { g: 'corner', label: 'click on a wall waits', get: () => STALK.corner, set: v => { STALK.corner = v; }, tip: 'on: with your back on a wall and empty hands, hold the left button and the man who walks past the corner is grabbed as he passes. Off = the button on a wall does nothing' },
];
const WHY: Record<string, string> = { '': 'nothing yet', grab: 'the grab', let: 'you let go', far: 'he got too far away', turned: 'he turned around', wall: 'a wall or a door came between you', him: 'he noticed you, or he is out of it', hands: 'your hands were busy or not empty', keys: 'you moved by yourself' };

/** is this page the lab (the word on its address) */
export const sneakLabAsked = (q: URLSearchParams): boolean => q.has('sneaklab');
const nearest = (g: Game): Guard | null => { const p = g.player.char.pos; let best: Guard | null = null, bd = 1e9; for (const x of g.guards) { if (x.state === 'dead' || x.civ) continue; const d = Math.hypot(x.char.pos[0] - p[0], x.char.pos[2] - p[2]); if (d < bd) { best = x; bd = d; } } return best; };
/** the man who stands (the first route of the lab's level), for the chair */
const stander = (g: Game): Guard | null => g.guards.find(x => x.state !== 'dead' && !x.civ) ?? null;

/** two of the walkers (the second and third beats) stood side by side `GAP` apart on the yard's open floor, their backs to the yard as the stander's is: a place to slip
 *  between two men. Each is given a two-point beat of his own, half a metre long with a long wait at its end, so he walks the last step and stands facing it. */
const GAP = 2.4;
function gap(g: Game) {
  const men = g.guards.filter(x => x.state !== 'dead' && !x.civ).slice(1, 3); if (men.length < 2) return;
  const open = (x: number, z: number) => !g.col.nav.isBlocked(x, z);
  const fits = (x: number, z: number) => { for (let dz = -1.5; dz <= 1.5; dz += 0.5) for (const dx of [-GAP / 2, 0, GAP / 2]) if (!open(x + dx, z + dz)) return false; return true; };
  let at: [number, number] | null = null;   // (the open yard south of the long straight, under the west flood, clear of the man who stands)
  for (let z = 18.5; z <= 19.5 && !at; z += 0.5) for (let x = 16.5; x >= 15.5 && !at; x -= 0.5) if (fits(x, z)) at = [x, z];
  if (!at) return;
  men.forEach((gd, i) => { const x = at![0] + (i === 0 ? -1 : 1) * GAP / 2;
    gd.route = { name: 'gap', points: [[x, 0, at![1] - 0.5], [x, 0, at![1]]], wait: [0, 900] }; gd.wp = 1; gd.wait = 0; gd.path = []; gd.pathGoal = null;
    gd.char.pos = [x, 0, at![1] - 0.5]; gd.char.vel = [0, 0, 0]; gd.char.bodyYaw = gd.char.aimYaw = 0; });
}

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
  panel.text(now, () => TAPSTEP.on ? `${TAPSTEP_STATS.steps} steps · ${TAPSTEP_STATS.beats} on the beat · ${TAPSTEP_STATS.scuffs} scuffs · ${TAPSTEP_STATS.masked} under his step · the last one: ${TAPSTEP_STATS.last || 'none yet'}` : 'keys walk');
  panel.text(now, () => `${STALK_STATS.grabs} grabs from ${STALK_STATS.begun} holds · the last one ended with: ${WHY[STALK_STATS.last] ?? STALK_STATS.last}`);
  const dark = new Set<Game['targets'][number]>();   // (the lamps the 'lights out' box put out: only those come back on)
  panel.buttons(now, 'the men', [
    { text: 'start over', run: () => { dark.clear(); game.restart(); }, title: 'every man back on his beat, you back at the start of this scenario with empty hands (also Shift+Enter)' },
    { text: 'sit / stand one', run: () => { const gd = stander(game); if (!gd) return; if (closeSeated(game, gd)) closeUnseat(game, gd, true); else closeSeat(game, gd); }, title: 'the man who stands by the wall sits where he is, to try the creep on a seated man' },
    { text: 'two men, a gap', run: () => gap(game), title: 'two of the walkers stop side by side, a little over two metres apart and facing the same way, so you can slip between them ("start over" sends them walking again)' },
  ]);
  panel.buttons(now, 'try', SCENES.map((c, i) => ({ text: c.name, run: () => { SNEAKLAB.scene = i; dark.clear(); game.restart(); }, title: c.tip })));
  panel.toggleBox(now, 'they can\'t notice you', () => SNEAKLAB.unseen, v => { SNEAKLAB.unseen = v; }, 'on: nobody sees or hears you, so you can work on the motion. Off: the real guards, and the creep ends when one is onto you');
  panel.toggleBox(now, 'nothing hurts you', () => SNEAKLAB.safe, v => { SNEAKLAB.safe = v; }, 'god mode while the lab is open');
  panel.toggleBox(now, 'lights out', () => dark.size > 0, v => { if (v) { for (const t of game.targets) if (t.on && !t.broken) { t.on = false; dark.add(t); } } else { for (const t of dark) if (!t.broken) t.on = true; dark.clear(); } }, 'every lamp that is lit goes off, to try all of this in the dark (the moon stays). Off = those lamps come back on');
  panel.toggleBox(now, 'keep Sam clear of this panel', () => SNEAKLAB.clear, v => { SNEAKLAB.clear = v; }, 'the view slides over so Sam stands in the middle of what this panel leaves; off = the middle of the page, as the game has him');
  panel.toggleBox(now, 'draw the geometry on the floor', () => STALKVIZ.on, v => { STALKVIZ.on = v; }, 'round the nearest man: the ring it can begin inside and the one it lets go past, the edges of his rear arc, the point Sam is walked to, the ring the grab fires inside');
  // (the knobs in named groups that fold, each with its own '↺' and a count of what has been moved; every row has a dot that puts its own number back)
  const togs = TOGS(), wasTog = togs.map(t => t.get()), moved = (n: Num, i: number) => Math.abs((n.t[n.key] as number) - was[i]) > n.step * 0.5;
  for (const G of GROUPS) {
    const mine = nums.map((n, i) => ({ n, i })).filter(x => x.n.g === G.id), arcs = G.id === 'start' ? ARCS.map((a, i) => ({ a, i })) : [];
    const sec = panel.section(G.name, { open: G.open, title: G.title, resetTitle: 'this group\'s numbers back to the build\'s',
      reset: () => { for (const { n, i } of mine) n.t[n.key] = was[i]; for (const { a, i } of arcs) STALK[a.key] = wasArc[i]; },
      summary: () => { const c = mine.filter(x => moved(x.n, x.i)).length + arcs.filter(x => Math.abs(STALK[x.a.key] - wasArc[x.i]) > 1e-4).length; return c ? `${c} moved` : ''; } });
    togs.forEach((t, i) => { if (t.g === G.id) panel.toggleBox(sec, t.label, t.get, t.set, t.tip, wasTog[i]); });
    for (const { n, i } of mine) panel.slider(sec, n.label, n.min, n.max, n.step, () => n.t[n.key] as number, v => { n.t[n.key] = v; }, n.tip, was[i]);
    for (const { a, i } of arcs) panel.slider(sec, a.label, 60, 180, 1, () => deg(STALK[a.key]), v => { STALK[a.key] = cosOf(v); }, a.tip, deg(wasArc[i]));
  }
  const out = panel.section('Hand the numbers back', { open: true });
  panel.buttons(out, 'numbers', [{ text: 'copy them', run: () => { copied = asText(); try { void navigator.clipboard?.writeText(copied); } catch { /* no clipboard here: the line below shows them */ } }, title: 'the numbers as they stand, as one line of text on the clipboard (and shown below)' }]);
  panel.text(out, () => copied || 'Move the sliders until it feels right, then copy the numbers and paste them where you send notes.');
  game.objectiveText = () => `sneak lab ▸ ${SCENES[SNEAKLAB.scene].line}`;   // (the level has no mission of its own: the HUD's line says what the scenario asks, and no more)
  { const back = game.restart.bind(game); game.restart = (said?: string) => { back(said); stage(game); }; }   // (Shift+Enter is the game's own restart: the scenario comes back with it)
  { const n = typeof location === 'undefined' ? NaN : Number(new URLSearchParams(location.search).get('scene')); if (n >= 1 && n <= SCENES.length) SNEAKLAB.scene = n - 1; }
  stage(game); sneakLabFrame(game);
  panel.show(SNEAKLAB_SYSTEM);
}
/** empty hands and low: how a creep begins */
function hands(game: Game) { game.player.holstered = true; game.player.crouch = true; }
/** Sam at the start of the scenario SNEAKLAB.scene names, and whether the men can see him there */
export function stage(game: Game) {
  const c = SCENES[SNEAKLAB.scene], p = game.player.char; SNEAKLAB.unseen = !c.seen;
  const gd = c.behind ? game.guards.find(x => game.level.routes[x.routeI]?.name === c.behind) : null, y = gd?.char.bodyYaw ?? 0;
  const at: Vec3 = gd ? [gd.char.pos[0] - Math.sin(y) * 3, 0, gd.char.pos[2] - Math.cos(y) * 3] : [...c.sam], free = !game.col.nav.isBlocked(at[0], at[2]);
  game.teleportPlayer(free ? at : [...c.sam]); p.bodyYaw = p.aimYaw = gd && free ? y : c.yaw; p.vel = [0, 0, 0]; hands(game);
}
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
