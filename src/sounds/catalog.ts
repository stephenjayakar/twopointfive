// THE LISTENING PAGE'S LIST (src/sounds/main.ts, /sounds): every sound in the table (audio/sfx.ts SfxName — a name missing here fails the typecheck), in plain words, at the gain
// and rate the game plays it. `also` = the other ways the game uses the same sound (another rate, a burst, stacked with others): several sounds have no sample of their own and
// borrow one — those rows are how the borrowing sounds. Gains and rates are copied from the call sites each group's comment names; a number that moves there wants moving here.
import type { SfxName } from '../audio/sfx';

export type Group = 'guns' | 'newguns' | 'kit' | 'feet' | 'doors' | 'hands' | 'things' | 'glass' | 'blasts' | 'voices' | 'weather';
export const GROUPS: { id: Group; name: string }[] = [
  { id: 'guns', name: 'Guns' }, { id: 'newguns', name: 'New guns: reports and reloads (first takes)' }, { id: 'kit', name: 'Kit' }, { id: 'feet', name: 'Feet' }, { id: 'doors', name: 'Doors and locks' }, { id: 'hands', name: 'Hands and bodies' },
  { id: 'things', name: 'Lights, furniture, devices' }, { id: 'glass', name: 'Glass' }, { id: 'blasts', name: 'Blasts' }, { id: 'voices', name: 'Voices and radio' }, { id: 'weather', name: 'Weather' },
];

/** one more voice stacked on a row: `after` seconds late */
export interface Layer { name: SfxName; gain: number; rate?: number; after?: number; flat?: boolean }
export interface Use {
  /** what it is, in the player's words */
  what: string;
  gain: number;
  /** a fixed rate, or [lo, hi] drawn per play; absent = the mixer's own 0.96‥1.04 */
  rate?: number | [number, number];
  /** not in the world: straight to the bus (UI, stings, the radio in his ear) */
  flat?: boolean;
  /** played n times, `every` seconds apart (a burst, a walk) */
  burst?: { n: number; every: number };
  /** thunder's own options */
  lowpass?: number; wet?: number;
  /** other sounds the game plays with it */
  plus?: Layer[];
}
export interface Sound extends Use { group: Group; also?: Use[] }

export const SOUNDS: Record<SfxName, Sound> = {
  // ---- guns (combat.ts fireWeapon: the weapon row's voice at gain 1) ----
  pistolSuppressed: { group: 'guns', what: 'your pistol, suppressed', gain: 1, also: [{ what: 'three rounds', gain: 1, burst: { n: 3, every: 0.22 } }] },
  pistolLoud: { group: 'guns', what: "a guard's pistol", gain: 1, also: [{ what: 'three rounds', gain: 1, burst: { n: 3, every: 0.26 } }] },
  carbineReport: { group: 'guns', what: 'a carbine, unsuppressed', gain: 1, also: [{ what: 'a burst on auto', gain: 1, burst: { n: 6, every: 0.1 } }] },
  rifleSuppressed: { group: 'guns', what: 'your rifle, suppressed', gain: 1, also: [{ what: 'semi, four rounds', gain: 1, burst: { n: 4, every: 0.2 } }, { what: 'a burst on auto', gain: 1, burst: { n: 8, every: 0.1 } }] },
  launcher: { group: 'guns', what: 'the launcher: sponge round', gain: 0.8, also: [{ what: 'the launcher: 40 mm HE (borrowed, slowed)', gain: 1, rate: 0.6 }] },
  dryFire: { group: 'guns', what: 'trigger on an empty gun', gain: 0.7 },
  magOut: { group: 'guns', what: 'magazine out', gain: 0.7, also: [
    { what: 'a pistol reload', gain: 0.7, plus: [{ name: 'magIn', gain: 0.8, after: 0.64 }, { name: 'rack', gain: 0.8, after: 1.0 }] },
    { what: 'a rifle reload (all three slowed)', gain: 0.75, rate: 0.85, plus: [{ name: 'magIn', gain: 0.85, rate: 0.85, after: 1.0 }, { name: 'rack', gain: 0.85, rate: 0.8, after: 1.5 }] },
    { what: 'pulling the drive from the rack (borrowed, slowed)', gain: 0.4, rate: 0.55, plus: [{ name: 'click', gain: 0.8 }] }] },
  magIn: { group: 'guns', what: 'magazine in', gain: 0.8 },
  rack: { group: 'guns', what: 'slide / charging handle', gain: 0.8 },
  magDrop: { group: 'guns', what: 'a magazine hits the floor', gain: 0.6, also: [{ what: 'a dropped pistol (borrowed, slowed)', gain: 0.7, rate: 0.72 }] },
  casingTink: { group: 'guns', what: 'one spent case lands', gain: 0.16, rate: [0.85, 1.25], also: [{ what: 'brass from a burst', gain: 0.16, rate: [0.85, 1.25], burst: { n: 6, every: 0.11 } }] },
  bulletImpact: { group: 'guns', what: 'a round hits a wall', gain: 0.8, also: [{ what: 'a burst into a wall', gain: 0.8, burst: { n: 6, every: 0.1 } }] },
  bodyHit: { group: 'guns', what: 'a round hits a man', gain: 0.8, also: [{ what: 'a sponge round to the head (slowed)', gain: 0.6, rate: 0.75 }, { what: 'the takedown blow (slowed)', gain: 0.55, rate: 0.8 }] },

  // ---- the guns a card's two slots offer, each its own report (combat.ts fireWeapon through gunlook.ts voiceOf: the row's own voice at gain 1; the bursts are each
  //      row's own cadence — weapons.ts), and how they are fed (gunreload.ts: the times in the two whole reloads are the rows' own beats). FIRST TAKES ----
  mk12Suppressed: { group: 'newguns', what: 'the Mk 12, suppressed', gain: 1, also: [{ what: 'three rounds', gain: 1, burst: { n: 3, every: 0.3 } }] },
  mp7Suppressed: { group: 'newguns', what: 'the MP7, suppressed', gain: 1, also: [{ what: 'a burst on auto', gain: 1, burst: { n: 10, every: 4 / 60 } }, { what: 'three single rounds', gain: 1, burst: { n: 3, every: 0.2 } }] },
  mk46Report: { group: 'newguns', what: 'the Mk 46, one round', gain: 1, also: [{ what: 'a string off the belt', gain: 1, burst: { n: 12, every: 5 / 60 } }, { what: 'a short burst', gain: 1, burst: { n: 5, every: 5 / 60 } }] },
  m1014Report: { group: 'newguns', what: 'the M1014, one shell', gain: 1, also: [{ what: 'four shells as fast as it fires', gain: 1, burst: { n: 4, every: 0.28 } }] },
  m870Report: { group: 'newguns', what: 'the pump shotgun: a shell, then the pump', gain: 1, also: [{ what: 'two shells', gain: 1, burst: { n: 2, every: 0.9 } }] },
  hk45Suppressed: { group: 'newguns', what: 'the HK45, suppressed', gain: 1, also: [{ what: 'three rounds', gain: 1, burst: { n: 3, every: 0.3 } }] },
  g18Report: { group: 'newguns', what: 'the Glock 18, one round', gain: 1, also: [{ what: 'a burst on auto', gain: 1, burst: { n: 10, every: 3 / 60 } }, { what: 'three single rounds', gain: 1, burst: { n: 3, every: 0.2 } }] },
  beltCoverUp: { group: 'newguns', what: 'the Mk 46: feed cover up', gain: 0.8, also: [
    { what: 'the Mk 46 fed a new belt, all of it', gain: 0.8, plus: [{ name: 'beltBoxOff', gain: 0.8, after: 0.7 }, { name: 'magDrop', gain: 0.45, rate: 0.8, after: 1.2 }, { name: 'beltBoxOn', gain: 0.85, after: 2.5 }, { name: 'beltLay', gain: 0.8, after: 3.9 }, { name: 'beltCoverDown', gain: 0.9, after: 4.4 }, { name: 'chargeLmg', gain: 0.9, after: 4.9 }] }] },
  beltBoxOff: { group: 'newguns', what: 'the Mk 46: the empty belt box off', gain: 0.8 },
  beltBoxOn: { group: 'newguns', what: 'the Mk 46: a full belt box on', gain: 0.85 },
  beltLay: { group: 'newguns', what: 'the Mk 46: the belt laid in the tray', gain: 0.8 },
  beltCoverDown: { group: 'newguns', what: 'the Mk 46: feed cover slapped shut', gain: 0.9 },
  chargeLmg: { group: 'newguns', what: 'the Mk 46: cocking handle', gain: 0.9 },
  shellIn: { group: 'newguns', what: 'one shell thumbed into the tube', gain: 0.8, rate: [0.94, 1.06], also: [
    { what: 'four shells, one at a time', gain: 0.8, rate: [0.94, 1.06], burst: { n: 4, every: 0.33 } },
    { what: 'an empty M1014: one in the port, the bolt, then three in the tube', gain: 0.6, rate: 0.94, plus: [{ name: 'boltDrop', gain: 0.9, after: 0.3 }, { name: 'shellIn', gain: 0.8, rate: 1.0, after: 0.75 }, { name: 'shellIn', gain: 0.8, rate: 1.08, after: 1.08 }, { name: 'shellIn', gain: 0.8, rate: 0.94, after: 1.41 }] }] },
  boltDrop: { group: 'newguns', what: 'the M1014: bolt release, the bolt home', gain: 0.9 },

  // ---- kit (player.ts, lighting.ts, combat.ts throwables) ----
  equip: { group: 'kit', what: 'drawing or stowing a weapon', gain: 0.45, flat: true },
  click: { group: 'kit', what: 'a switch: gun light, breaker, fire mode', gain: 0.7 },
  ocp: { group: 'kit', what: 'the OCP fired at a light', gain: 1 },
  deny: { group: 'kit', what: 'the OCP has nothing to do', gain: 0.5, flat: true },
  nvOn: { group: 'kit', what: 'night vision on', gain: 0.7, flat: true },
  nvOff: { group: 'kit', what: 'night vision off', gain: 0.7, flat: true },
  throw: { group: 'kit', what: 'throwing a can', gain: 0.7 },
  canisterBounce: { group: 'kit', what: 'a can bounces', gain: 0.8, also: [{ what: 'three bounces, dying', gain: 0.9, rate: 0.9, plus: [{ name: 'canisterBounce', gain: 0.5, rate: 1.1, after: 0.38 }, { name: 'canisterBounce', gain: 0.25, rate: 1.3, after: 0.62 }] }] },
  smokePop: { group: 'kit', what: 'a smoke can goes off (its hiss is under Loops)', gain: 0.9 },

  // ---- feet (audio.ts footstep: 0.55 × loudness for you, 0.7 × for anyone else; rate 0.9‥1.15 × the floor's) ----
  footHard: { group: 'feet', what: 'one step on a hard floor', gain: 0.55, rate: [0.9, 1.15], also: [{ what: 'you walking, lino', gain: 0.55, rate: [0.9, 1.15], burst: { n: 8, every: 0.5 } }, { what: 'a guard walking, stone', gain: 0.77, rate: [0.97, 1.24], burst: { n: 8, every: 0.52 } }, { what: 'running', gain: 0.9, rate: [0.9, 1.15], burst: { n: 10, every: 0.3 } }] },
  footSoft: { group: 'feet', what: 'one step on carpet or grass', gain: 0.33, rate: [0.85, 1.08], also: [{ what: 'you walking, carpet', gain: 0.33, rate: [0.85, 1.08], burst: { n: 8, every: 0.5 } }, { what: 'crouched, carpet', gain: 0.12, rate: [0.85, 1.08], burst: { n: 6, every: 0.7 } }] },
  stairBoots: { group: 'feet', what: 'the response team on the stairs', gain: 0.75 },

  // ---- doors and locks (game.ts onDoorEvent) ----
  doorCreak: { group: 'doors', what: 'a door pushed open', gain: 0.8 },
  doorBang: { group: 'doors', what: 'a door slams', gain: 0.9 },
  doorLatch: { group: 'doors', what: 'a door clicks shut', gain: 0.6 },
  doorBash: { group: 'doors', what: 'a shoulder into a door', gain: 0.9, also: [{ what: 'a boot the frame holds (slowed)', gain: 1, rate: 0.8 }] },
  doorRattle: { group: 'doors', what: 'trying a locked handle', gain: 0.55 },
  lockPick: { group: 'doors', what: 'one click of the pick', gain: 0.5, rate: [0.9, 1.15], also: [{ what: 'picking a lock', gain: 0.5, rate: [0.9, 1.15], burst: { n: 7, every: 0.55 }, plus: [{ name: 'lockOpen', gain: 0.8, after: 4.1 }] }] },
  lockOpen: { group: 'doors', what: 'the lock turns over', gain: 0.8, also: [{ what: 'a key in it (quieter)', gain: 0.56 }] },
  lockBreak: { group: 'doors', what: 'a kick breaks the lock', gain: 0.95, plus: [{ name: 'doorBash', gain: 1, rate: 0.9 }], also: [{ what: 'the lock alone', gain: 0.95 }] },
  stairDoor: { group: 'doors', what: 'the steel stair door thrown open', gain: 1, also: [{ what: 'a boot on a steel door (borrowed, faster)', gain: 0.55, rate: 1.3, plus: [{ name: 'doorBash', gain: 1, rate: 0.7 }] }] },
  padBeep: { group: 'doors', what: 'one keypad key', gain: 0.5, also: [{ what: 'a four digit code, then the bolt', gain: 0.5, rate: 1, plus: [{ name: 'padBeep', gain: 0.5, rate: 1.03, after: 0.3 }, { name: 'padBeep', gain: 0.5, rate: 1.06, after: 0.6 }, { name: 'padBeep', gain: 0.5, rate: 1.09, after: 0.9 }, { name: 'padOpen', gain: 0.6, after: 1.3 }] }] },
  padOpen: { group: 'doors', what: 'the keypad bolt opens', gain: 0.6 },

  // ---- hands and bodies (player.ts the hold, game.ts ragdolls) ----
  bodyFall: { group: 'hands', what: 'a body hits the floor', gain: 0.8, also: [{ what: 'a body laid down', gain: 0.12 }] },
  grabScuffle: { group: 'hands', what: 'grabbing a man from behind', gain: 0.4 },
  // (the grab as three beats, on the maintainer's own times of 10-24: the catch at his throat, the strip 0.25 s on at his gun hand, the gun on the floor 0.70 s
  //  on, his protest as the hold locks at 0.47; tools/qa/grabvoice-check.ts holds these rows to the game's beats; a carbine = the strip and the knock slowed to 0.8)
  grabCatch: { group: 'hands', what: 'the grab: the catch', gain: 0.5, rate: 1, also: [
    { what: 'the whole grab: catch, his pistol stripped and thrown down', gain: 0.5, rate: 1, plus: [{ name: 'gunStrip', gain: 0.45, rate: 1, after: 0.25 }, { name: 'heldProtest', gain: 0.18, after: 0.47 }, { name: 'gunDown', gain: 0.4, rate: 1, after: 0.7 }] },
    { what: 'the whole grab, a carbine (strip and knock slowed)', gain: 0.5, rate: 1, plus: [{ name: 'gunStrip', gain: 0.45, rate: 0.8, after: 0.25 }, { name: 'heldProtest', gain: 0.18, after: 0.47 }, { name: 'gunDown', gain: 0.4, rate: 0.8, after: 0.7 }] }] },
  // (…and the grab as the page plays it with HOLD.stripFirst up: the strip first, 0.15 s after the frame he is taken on, the catch 0.12 s after it as the arm
  //  lands, his protest at 0.47 and the gun down at 0.70 from that frame; the rows above are the beats with it down. Both are counted on a man taken by the
  //  key, as the page takes him: grabvoice-check holds all four rows to the game, to the frame)
  gunStrip: { group: 'hands', what: 'the grab: his pistol twisted out of his hand', gain: 0.45, rate: 1, also: [{ what: 'a carbine stripped (slowed)', gain: 0.45, rate: 0.8 },
    { what: 'the whole grab, the gun first: strip, catch, his pistol thrown down', gain: 0.45, rate: 1, plus: [{ name: 'grabCatch', gain: 0.5, rate: 1, after: 0.12 }, { name: 'heldProtest', gain: 0.18, after: 0.32 }, { name: 'gunDown', gain: 0.4, rate: 1, after: 0.55 }] },
    { what: 'the whole grab, the gun first, a carbine (strip and knock slowed)', gain: 0.45, rate: 0.8, plus: [{ name: 'grabCatch', gain: 0.5, rate: 1, after: 0.12 }, { name: 'heldProtest', gain: 0.18, after: 0.32 }, { name: 'gunDown', gain: 0.4, rate: 0.8, after: 0.55 }] }, { what: 'rapped out of his hand by Sam\'s own pistol (quicker)', gain: 0.45, rate: 1.12 }] },
  gunDown: { group: 'hands', what: 'the grab: his pistol hits the floor', gain: 0.4, rate: 1, also: [{ what: 'a carbine hits the floor (slowed)', gain: 0.4, rate: 0.8 }] },
  chokeStrain: { group: 'hands', what: 'the choke, one strain', gain: 0.25, also: [{ what: 'choking him out', gain: 0.25, burst: { n: 6, every: 0.4 }, plus: [{ name: 'chokeLimp', gain: 0.35, after: 2.5 }] }] },
  chokeLimp: { group: 'hands', what: 'he goes limp', gain: 0.35 },
  whipThud: { group: 'hands', what: 'the pistol whip', gain: 0.7 },
  shove: { group: 'hands', what: 'letting a held man go', gain: 0.3 },
  wallOn: { group: 'hands', what: 'his back onto a wall', gain: 0.35 },
  wallOff: { group: 'hands', what: 'stepping off a wall', gain: 0.5 },

  // ---- lights, furniture, devices ----
  lightBreak: { group: 'things', what: 'a light shot out', gain: 1 },
  lightOff: { group: 'things', what: 'a light switched off', gain: 0.65 },
  powerDown: { group: 'things', what: 'the mains go out', gain: 1, plus: [{ name: 'powerDown', gain: 0.35, flat: true }] },
  powerUp: { group: 'things', what: 'the mains come back', gain: 1, plus: [{ name: 'powerUp', gain: 0.3, flat: true }] },
  propScrape: { group: 'things', what: 'furniture shoved', gain: 0.5 },
  fireBed: { group: 'things', what: 'a fire burning in an oil drum (looped for as long as it burns)', gain: 0.5 },
  fireCrack: { group: 'things', what: 'the wood in the fire cracking', gain: 0.4, rate: [0.8, 1.3] },
  chairRoll: { group: 'things', what: 'an office chair rolling on its castors (looped for as long as it coasts)', gain: 0.5 },
  propThud: { group: 'things', what: 'furniture knocked over', gain: 0.7, also: [{ what: 'a ceiling tile lands (with a slowed magazine drop)', gain: 0.9, rate: 0.75, plus: [{ name: 'magDrop', gain: 0.35, rate: 0.5 }] }, { what: 'a monitor knocked off a desk', gain: 1, rate: 0.6, plus: [{ name: 'lightBreak', gain: 0.45, rate: 0.8 }] }] },
  alarmChirp: { group: 'things', what: 'a tripwire trips', gain: 0.7 },

  // ---- glass (glass.ts, glassbreak.ts, shards.ts) ----
  glassCrack: { group: 'glass', what: 'a round stars a pane', gain: 0.9, also: [{ what: 'a toughened pane dices (slowed)', gain: 1, rate: 0.7 }, { what: 'rounds through a window', gain: 0.9, rate: [1.0, 1.3], burst: { n: 4, every: 0.12 }, plus: [{ name: 'glassShatter', gain: 0.8, rate: 1.2, after: 0.5 }, { name: 'glassTinkle', gain: 0.6, after: 0.75 }, { name: 'glassTinkle', gain: 0.4, rate: 1.2, after: 1.0 }] }] },
  glassTinkle: { group: 'glass', what: 'small pieces land', gain: 0.6 },
  glassShatter: { group: 'glass', what: 'a big piece breaks on the floor', gain: 0.8 },
  glassCrunch: { group: 'glass', what: 'a step on broken glass', gain: 0.6, also: [{ what: 'walking over it', gain: 0.6, rate: [0.85, 1.15], burst: { n: 6, every: 0.5 } }] },

  // ---- blasts (combat.ts detonateStun, frag.ts, blastFeel.ts) ----
  stunBang: { group: 'blasts', what: 'a flashbang, with your ears ringing', gain: 1, plus: [{ name: 'earRing', gain: 0.7, flat: true }], also: [{ what: 'a frag grenade (borrowed, slowed)', gain: 1, rate: 0.62, plus: [{ name: 'earRing', gain: 0.6, flat: true }] }, { what: 'the bang alone', gain: 1 }] },
  earRing: { group: 'blasts', what: 'ears ringing', gain: 0.7, flat: true },
  wallCrack: { group: 'blasts', what: 'a wall charge: the crack', gain: 1, also: [{ what: 'a wall charge, all of it', gain: 1, plus: [{ name: 'wallThump', gain: 1, after: 0.03 }, { name: 'wallDebris', gain: 0.6, after: 0.1 }, { name: 'earRing', gain: 0.2, rate: 0.9, flat: true }] }] },
  wallThump: { group: 'blasts', what: 'a wall charge: the thump', gain: 1 },
  wallDebris: { group: 'blasts', what: 'a wall charge: rubble coming down', gain: 0.6 },

  // ---- voices and radio ----
  radio: { group: 'voices', what: 'radio squelch', gain: 0.55, flat: true, also: [{ what: "a guard's radio, in the room", gain: 0.9 }] },
  alertSting: { group: 'voices', what: 'you have been seen', gain: 0.75, flat: true },
  murmur: { group: 'voices', what: 'your voice, low', gain: 0.2 },
  heldProtest: { group: 'voices', what: 'a held man protests, under your arm', gain: 0.18, also: [{ what: 'a held worker, a gun on him', gain: 0.5, rate: 1.15 }, { what: 'a hostage cries out', gain: 0.7, rate: 1.5 }] },
  whistle: { group: 'voices', what: 'your whistle', gain: 0.55 },

  // ---- weather (weather.ts playThunder) ----
  thunderNear: { group: 'weather', what: 'thunder, close', gain: 0.9, flat: true, lowpass: 6200, wet: 0.35 },
  thunderFar: { group: 'weather', what: 'thunder, three kilometres off', gain: 0.75, rate: 0.84, flat: true, lowpass: 950, wet: 0.55 },
};

/** where you stand: the mixer's own numbers for each (audio.ts play: gain × (1 − 0.55 × muffle), a low-pass at 20 kHz × 0.045^muffle, a reverb send of 0.25 + 0.5 × muffle + 0.02 × metres) */
export interface Place { id: string; name: string; metres: number; muffle: number; wet: number; dry?: boolean }
export const PLACES: Place[] = [
  { id: 'room', name: 'Same room', metres: 2.5, muffle: 0, wet: 0.3 },
  { id: 'door', name: 'Round a doorway', metres: 9, muffle: 0.35, wet: 0.3 },
  { id: 'shut', name: 'Behind a shut door', metres: 9, muffle: 0.85, wet: 0.3 },
  { id: 'wall', name: 'Through a wall', metres: 6, muffle: 1, wet: 0.3 },
  { id: 'far', name: 'Outside, 25 m', metres: 25, muffle: 0, wet: 0.08 },
  { id: 'dry', name: 'Raw', metres: 0, muffle: 0, wet: 0, dry: true },
];
